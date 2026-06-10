package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/netip"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/risk_guard_setting"
	"github.com/gin-gonic/gin"
)

const riskGuardTargetPath = "/v1/responses"

type RiskGuardRequest struct {
	IP        string
	Method    string
	Path      string
	Status    int
	RequestID string
}

type RiskGuardAudit struct {
	T       int64  `json:"t"`
	Action  string `json:"action"`
	Message string `json:"message"`
	IP      string `json:"ip"`
	OK      bool   `json:"ok"`
}

type RiskGuardIPStats struct {
	IP          string         `json:"ip"`
	Total       int            `json:"total"`
	Responses   int            `json:"responses"`
	Errors      int            `json:"errors"`
	Status      map[string]int `json:"status"`
	Paths       map[string]int `json:"paths"`
	LastSeen    int64          `json:"last_seen"`
	LastSeenAge string         `json:"last_seen_age"`
	Blocked     bool           `json:"blocked"`
}

type RiskGuardConfigView struct {
	Enabled                 bool   `json:"enabled"`
	AutoEnabled             bool   `json:"auto_enabled"`
	ResponsesThreshold      int    `json:"responses_threshold_per_min"`
	StatsWindowSeconds      int    `json:"stats_window_seconds"`
	RetentionSeconds        int    `json:"retention_seconds"`
	AutoCooldownSeconds     int    `json:"auto_cooldown_seconds"`
	CloudflareReady         bool   `json:"cf_ready"`
	CloudflareZoneID        string `json:"cf_zone_id"`
	CloudflareRulesetID     string `json:"cf_ruleset_id"`
	CloudflareRuleID        string `json:"cf_rule_id"`
	CloudflareRuleDesc      string `json:"cf_rule_description"`
	UseCloudflareConnecting bool   `json:"use_cf_connecting_ip"`
}

type RiskGuardStats struct {
	Now           int64               `json:"now"`
	UptimeSeconds int64               `json:"uptime_seconds"`
	WindowSeconds int                 `json:"window_seconds"`
	Total         int                 `json:"total"`
	RPM           int                 `json:"rpm"`
	TopIPs        []RiskGuardIPStats  `json:"top_ips"`
	StatusTotal   map[string]int      `json:"status_total"`
	PathTotal     map[string]int      `json:"path_total"`
	BlockedIPs    []string            `json:"blocked_ips"`
	Audit         []RiskGuardAudit    `json:"audit"`
	Config        RiskGuardConfigView `json:"config"`
}

type RiskGuardConfigPatch struct {
	Enabled                 *bool   `json:"enabled"`
	AutoEnabled             *bool   `json:"auto_enabled"`
	ResponsesThreshold      *int    `json:"responses_threshold_per_min"`
	StatsWindowSeconds      *int    `json:"stats_window_seconds"`
	RetentionSeconds        *int    `json:"retention_seconds"`
	AutoCooldownSeconds     *int    `json:"auto_cooldown_seconds"`
	CloudflareAuthToken     *string `json:"cf_auth_token"`
	CloudflareZoneID        *string `json:"cf_zone_id"`
	CloudflareRulesetID     *string `json:"cf_ruleset_id"`
	CloudflareRuleID        *string `json:"cf_rule_id"`
	CloudflareRuleDesc      *string `json:"cf_rule_description"`
	UseCloudflareConnecting *bool   `json:"use_cf_connecting_ip"`
}

type riskGuardEvent struct {
	T         time.Time
	IP        string
	Method    string
	Path      string
	Status    int
	RequestID string
}

type riskGuardState struct {
	mu             sync.RWMutex
	events         []riskGuardEvent
	audit          []RiskGuardAudit
	lastAutoAction map[string]time.Time
	startedAt      time.Time
}

var globalRiskGuard = &riskGuardState{
	events:         make([]riskGuardEvent, 0, 2048),
	audit:          make([]RiskGuardAudit, 0, 300),
	lastAutoAction: make(map[string]time.Time),
	startedAt:      time.Now(),
}

var riskGuardBlockListMu sync.Mutex

func RiskGuardEnabled() bool {
	return risk_guard_setting.GetSetting().Enabled
}

func RiskGuardClientIP(c *gin.Context) string {
	cfg := risk_guard_setting.GetSetting()
	if cfg.UseCloudflareConnecting {
		if ip := normalizePublicIP(c.GetHeader("CF-Connecting-IP")); ip != "" {
			return ip
		}
	}
	if ip := normalizePublicIP(c.ClientIP()); ip != "" {
		return ip
	}
	return strings.TrimSpace(c.ClientIP())
}

func RiskGuardIsBlocked(ip string) bool {
	ip = normalizePublicIP(ip)
	if ip == "" {
		return false
	}
	return ipInSlice(risk_guard_setting.GetSetting().ManagedBlockedIPs, ip)
}

func RecordRiskGuardRequest(req RiskGuardRequest) {
	cfg := risk_guard_setting.GetSetting()
	if !cfg.Enabled {
		return
	}
	if strings.ToUpper(req.Method) != http.MethodPost || req.Path != riskGuardTargetPath {
		return
	}
	ip := normalizePublicIP(req.IP)
	if ip == "" {
		return
	}
	if req.Status == 0 {
		req.Status = http.StatusOK
	}

	event := riskGuardEvent{
		T:         time.Now(),
		IP:        ip,
		Method:    http.MethodPost,
		Path:      riskGuardTargetPath,
		Status:    req.Status,
		RequestID: req.RequestID,
	}

	globalRiskGuard.mu.Lock()
	globalRiskGuard.events = append(globalRiskGuard.events, event)
	pruneRiskGuardEventsLocked()
	globalRiskGuard.mu.Unlock()

	evaluateRiskGuardAuto(event)
}

func GetRiskGuardStats() RiskGuardStats {
	cfg := risk_guard_setting.GetSetting()
	window := clampInt(cfg.StatsWindowSeconds, 10, 600, 60)
	cutoff := time.Now().Add(-time.Duration(window) * time.Second)

	globalRiskGuard.mu.Lock()
	pruneRiskGuardEventsLocked()
	events := make([]riskGuardEvent, 0, len(globalRiskGuard.events))
	for _, event := range globalRiskGuard.events {
		if !event.T.Before(cutoff) {
			events = append(events, event)
		}
	}
	audit := append([]RiskGuardAudit(nil), globalRiskGuard.audit...)
	globalRiskGuard.mu.Unlock()

	blockedSet := sliceToSet(cfg.ManagedBlockedIPs)
	byIP := make(map[string]*RiskGuardIPStats)
	statusTotal := make(map[string]int)
	pathTotal := make(map[string]int)
	successResponses := 0

	for _, event := range events {
		row := byIP[event.IP]
		if row == nil {
			row = &RiskGuardIPStats{
				IP:      event.IP,
				Status:  make(map[string]int),
				Paths:   make(map[string]int),
				Blocked: blockedSet[event.IP],
			}
			byIP[event.IP] = row
		}
		row.Total++
		if event.Status >= 400 {
			row.Errors++
		}
		if isSuccessfulResponsesEvent(event) {
			row.Responses++
			successResponses++
		}
		statusKey := fmt.Sprintf("%d", event.Status)
		pathKey := event.Method + " " + event.Path
		row.Status[statusKey]++
		row.Paths[pathKey]++
		row.LastSeen = maxInt64(row.LastSeen, event.T.Unix())
		statusTotal[statusKey]++
		pathTotal[pathKey]++
	}

	rows := make([]RiskGuardIPStats, 0, len(byIP))
	for _, row := range byIP {
		row.Status = topMap(row.Status, 0)
		row.Paths = topMap(row.Paths, 5)
		row.LastSeenAge = formatRiskGuardAge(row.LastSeen)
		rows = append(rows, *row)
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Responses != rows[j].Responses {
			return rows[i].Responses > rows[j].Responses
		}
		if rows[i].Total != rows[j].Total {
			return rows[i].Total > rows[j].Total
		}
		return rows[i].IP < rows[j].IP
	})
	if len(rows) > 80 {
		rows = rows[:80]
	}

	if len(audit) > 80 {
		audit = audit[:80]
	}
	if audit == nil {
		audit = make([]RiskGuardAudit, 0)
	}

	return RiskGuardStats{
		Now:           time.Now().Unix(),
		UptimeSeconds: int64(time.Since(globalRiskGuard.startedAt).Seconds()),
		WindowSeconds: window,
		Total:         len(events),
		RPM:           successResponses * 60 / window,
		TopIPs:        rows,
		StatusTotal:   topMap(statusTotal, 0),
		PathTotal:     topMap(pathTotal, 20),
		BlockedIPs:    sortedPublicIPs(cfg.ManagedBlockedIPs),
		Audit:         audit,
		Config:        buildRiskGuardConfigView(),
	}
}

func UpdateRiskGuardConfig(patch RiskGuardConfigPatch) (RiskGuardConfigView, error) {
	cfg := risk_guard_setting.GetSetting()
	cfChanged := false

	if patch.Enabled != nil {
		if err := updateRiskGuardOption("enabled", fmt.Sprintf("%t", *patch.Enabled)); err != nil {
			return RiskGuardConfigView{}, err
		}
	}
	if patch.AutoEnabled != nil {
		if err := updateRiskGuardOption("auto_enabled", fmt.Sprintf("%t", *patch.AutoEnabled)); err != nil {
			return RiskGuardConfigView{}, err
		}
	}
	if patch.ResponsesThreshold != nil {
		value := *patch.ResponsesThreshold
		if value < 1 || value > 200000 {
			return RiskGuardConfigView{}, fmt.Errorf("responses_threshold_per_min must be between 1 and 200000")
		}
		if err := updateRiskGuardOption("responses_threshold_per_min", fmt.Sprintf("%d", value)); err != nil {
			return RiskGuardConfigView{}, err
		}
	}
	if patch.StatsWindowSeconds != nil {
		value := *patch.StatsWindowSeconds
		if value < 10 || value > 600 {
			return RiskGuardConfigView{}, fmt.Errorf("stats_window_seconds must be between 10 and 600")
		}
		if err := updateRiskGuardOption("stats_window_seconds", fmt.Sprintf("%d", value)); err != nil {
			return RiskGuardConfigView{}, err
		}
	}
	if patch.RetentionSeconds != nil {
		value := *patch.RetentionSeconds
		if value < 120 || value > 86400 {
			return RiskGuardConfigView{}, fmt.Errorf("retention_seconds must be between 120 and 86400")
		}
		if err := updateRiskGuardOption("retention_seconds", fmt.Sprintf("%d", value)); err != nil {
			return RiskGuardConfigView{}, err
		}
	}
	if patch.AutoCooldownSeconds != nil {
		value := *patch.AutoCooldownSeconds
		if value < 0 || value > 86400 {
			return RiskGuardConfigView{}, fmt.Errorf("auto_cooldown_seconds must be between 0 and 86400")
		}
		if err := updateRiskGuardOption("auto_cooldown_seconds", fmt.Sprintf("%d", value)); err != nil {
			return RiskGuardConfigView{}, err
		}
	}
	if patch.CloudflareAuthToken != nil {
		if err := updateRiskGuardOption("cf_auth_token", strings.TrimSpace(*patch.CloudflareAuthToken)); err != nil {
			return RiskGuardConfigView{}, err
		}
		cfChanged = true
	}
	if patch.CloudflareZoneID != nil {
		if err := updateRiskGuardOption("cf_zone_id", strings.TrimSpace(*patch.CloudflareZoneID)); err != nil {
			return RiskGuardConfigView{}, err
		}
		cfChanged = true
	}
	if patch.CloudflareRulesetID != nil {
		if err := updateRiskGuardOption("cf_ruleset_id", strings.TrimSpace(*patch.CloudflareRulesetID)); err != nil {
			return RiskGuardConfigView{}, err
		}
		cfChanged = true
	}
	if patch.CloudflareRuleID != nil {
		if err := updateRiskGuardOption("cf_rule_id", strings.TrimSpace(*patch.CloudflareRuleID)); err != nil {
			return RiskGuardConfigView{}, err
		}
		cfChanged = true
	}
	if patch.CloudflareRuleDesc != nil {
		value := strings.TrimSpace(*patch.CloudflareRuleDesc)
		if value == "" {
			value = "ip限制"
		}
		if err := updateRiskGuardOption("cf_rule_description", value); err != nil {
			return RiskGuardConfigView{}, err
		}
		cfChanged = true
	}
	if patch.UseCloudflareConnecting != nil {
		if err := updateRiskGuardOption("use_cf_connecting_ip", fmt.Sprintf("%t", *patch.UseCloudflareConnecting)); err != nil {
			return RiskGuardConfigView{}, err
		}
	}

	if cfChanged && len(cfg.ManagedBlockedIPs) > 0 {
		ok, msg := PatchRiskGuardCloudflare(context.Background())
		addRiskGuardAudit("config", "configuration updated; "+msg, "", ok)
	}

	return buildRiskGuardConfigView(), nil
}

func BlockRiskGuardIP(ctx context.Context, ip string, reason string) (bool, string) {
	ip = normalizePublicIP(ip)
	if ip == "" {
		return false, "invalid or non-public IP"
	}
	if reason == "" {
		reason = "manual"
	}

	if err := addManagedBlockedIP(ip); err != nil {
		addRiskGuardAudit("block", err.Error(), ip, false)
		return false, err.Error()
	}

	ok, msg := PatchRiskGuardCloudflare(ctx)
	addRiskGuardAudit("block", reason+"; "+msg, ip, ok)
	return ok, msg
}

func UnblockRiskGuardIP(ctx context.Context, ip string, reason string) (bool, string) {
	ip = normalizePublicIP(ip)
	if ip == "" {
		return false, "invalid or non-public IP"
	}
	if reason == "" {
		reason = "manual"
	}

	removed, err := removeManagedBlockedIP(ip)
	if err != nil {
		addRiskGuardAudit("unblock", err.Error(), ip, false)
		return false, err.Error()
	}
	if !removed {
		return false, "IP is not in managed block list"
	}

	ok, msg := PatchRiskGuardCloudflare(ctx)
	addRiskGuardAudit("unblock", reason+"; "+msg, ip, ok)
	return ok, msg
}

func PatchRiskGuardCloudflare(ctx context.Context) (bool, string) {
	cfg := risk_guard_setting.GetSetting()
	token := strings.TrimSpace(cfg.CloudflareAuthToken)
	if token == "" {
		return false, "missing Cloudflare token"
	}
	if strings.TrimSpace(cfg.CloudflareZoneID) == "" ||
		strings.TrimSpace(cfg.CloudflareRulesetID) == "" ||
		strings.TrimSpace(cfg.CloudflareRuleID) == "" {
		return false, "missing Cloudflare zone/ruleset/rule id"
	}

	body := map[string]any{
		"action":      "block",
		"description": cfg.CloudflareRuleDesc,
		"enabled":     true,
		"expression":  buildRiskGuardExpression(cfg.ManagedBlockedIPs),
		"id":          cfg.CloudflareRuleID,
		"ref":         cfg.CloudflareRuleID,
	}
	data, err := json.Marshal(body)
	if err != nil {
		return false, err.Error()
	}

	url := fmt.Sprintf(
		"https://api.cloudflare.com/client/v4/zones/%s/rulesets/%s/rules/%s",
		strings.TrimSpace(cfg.CloudflareZoneID),
		strings.TrimSpace(cfg.CloudflareRulesetID),
		strings.TrimSpace(cfg.CloudflareRuleID),
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, url, bytes.NewReader(data))
	if err != nil {
		return false, err.Error()
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, "Cloudflare request failed: " + err.Error()
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 65536))
	var payload struct {
		Success bool `json:"success"`
		Errors  any  `json:"errors"`
	}
	_ = json.Unmarshal(raw, &payload)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if payload.Errors != nil {
			return false, fmt.Sprintf("Cloudflare HTTP %d: %v", resp.StatusCode, payload.Errors)
		}
		return false, fmt.Sprintf("Cloudflare HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	if !payload.Success {
		return false, fmt.Sprintf("Cloudflare API error: %v", payload.Errors)
	}
	return true, "Cloudflare rule updated"
}

func buildRiskGuardConfigView() RiskGuardConfigView {
	cfg := risk_guard_setting.GetSetting()
	cfReady := strings.TrimSpace(cfg.CloudflareAuthToken) != "" &&
		strings.TrimSpace(cfg.CloudflareZoneID) != "" &&
		strings.TrimSpace(cfg.CloudflareRulesetID) != "" &&
		strings.TrimSpace(cfg.CloudflareRuleID) != ""
	return RiskGuardConfigView{
		Enabled:                 cfg.Enabled,
		AutoEnabled:             cfg.AutoEnabled,
		ResponsesThreshold:      clampInt(cfg.ResponsesThreshold, 1, 200000, 200),
		StatsWindowSeconds:      clampInt(cfg.StatsWindowSeconds, 10, 600, 60),
		RetentionSeconds:        clampInt(cfg.RetentionSeconds, 120, 86400, 900),
		AutoCooldownSeconds:     clampInt(cfg.AutoCooldownSeconds, 0, 86400, 900),
		CloudflareReady:         cfReady,
		CloudflareZoneID:        cfg.CloudflareZoneID,
		CloudflareRulesetID:     cfg.CloudflareRulesetID,
		CloudflareRuleID:        cfg.CloudflareRuleID,
		CloudflareRuleDesc:      cfg.CloudflareRuleDesc,
		UseCloudflareConnecting: cfg.UseCloudflareConnecting,
	}
}

func evaluateRiskGuardAuto(event riskGuardEvent) {
	cfg := risk_guard_setting.GetSetting()
	if !cfg.Enabled || !cfg.AutoEnabled || !isSuccessfulResponsesEvent(event) {
		return
	}
	if RiskGuardIsBlocked(event.IP) {
		return
	}
	threshold := clampInt(cfg.ResponsesThreshold, 1, 200000, 200)
	count := countRiskGuardResponsesForIP(event.IP, 60)
	if count < threshold {
		return
	}

	globalRiskGuard.mu.Lock()
	last := globalRiskGuard.lastAutoAction[event.IP]
	cooldown := time.Duration(clampInt(cfg.AutoCooldownSeconds, 0, 86400, 900)) * time.Second
	if !last.IsZero() && time.Since(last) < cooldown {
		globalRiskGuard.mu.Unlock()
		return
	}
	globalRiskGuard.lastAutoAction[event.IP] = time.Now()
	globalRiskGuard.mu.Unlock()

	reason := fmt.Sprintf("auto: POST /v1/responses %d/min >= %d/min", count, threshold)
	go func(ip string) {
		_, _ = BlockRiskGuardIP(context.Background(), ip, reason)
	}(event.IP)
}

func countRiskGuardResponsesForIP(ip string, seconds int) int {
	cutoff := time.Now().Add(-time.Duration(seconds) * time.Second)
	globalRiskGuard.mu.RLock()
	defer globalRiskGuard.mu.RUnlock()

	count := 0
	for _, event := range globalRiskGuard.events {
		if event.IP == ip && !event.T.Before(cutoff) && isSuccessfulResponsesEvent(event) {
			count++
		}
	}
	return count
}

func pruneRiskGuardEventsLocked() {
	cfg := risk_guard_setting.GetSetting()
	retention := clampInt(cfg.RetentionSeconds, 120, 86400, 900)
	cutoff := time.Now().Add(-time.Duration(retention) * time.Second)
	idx := 0
	for idx < len(globalRiskGuard.events) && globalRiskGuard.events[idx].T.Before(cutoff) {
		idx++
	}
	if idx > 0 {
		copy(globalRiskGuard.events, globalRiskGuard.events[idx:])
		globalRiskGuard.events = globalRiskGuard.events[:len(globalRiskGuard.events)-idx]
	}
}

func addRiskGuardAudit(action, message, ip string, ok bool) {
	globalRiskGuard.mu.Lock()
	defer globalRiskGuard.mu.Unlock()

	item := RiskGuardAudit{
		T:       time.Now().Unix(),
		Action:  action,
		Message: message,
		IP:      ip,
		OK:      ok,
	}
	globalRiskGuard.audit = append([]RiskGuardAudit{item}, globalRiskGuard.audit...)
	if len(globalRiskGuard.audit) > 300 {
		globalRiskGuard.audit = globalRiskGuard.audit[:300]
	}
}

func addManagedBlockedIP(ip string) error {
	riskGuardBlockListMu.Lock()
	defer riskGuardBlockListMu.Unlock()

	cfg := risk_guard_setting.GetSetting()
	ips := sortedPublicIPs(append(cfg.ManagedBlockedIPs, ip))
	return persistManagedBlockedIPs(ips)
}

func removeManagedBlockedIP(ip string) (bool, error) {
	riskGuardBlockListMu.Lock()
	defer riskGuardBlockListMu.Unlock()

	cfg := risk_guard_setting.GetSetting()
	removed := false
	next := make([]string, 0, len(cfg.ManagedBlockedIPs))
	for _, item := range cfg.ManagedBlockedIPs {
		normalized := normalizePublicIP(item)
		if normalized == "" {
			continue
		}
		if normalized == ip {
			removed = true
			continue
		}
		next = append(next, normalized)
	}
	if !removed {
		return false, nil
	}
	return true, persistManagedBlockedIPs(sortedPublicIPs(next))
}

func persistManagedBlockedIPs(ips []string) error {
	data, err := common.Marshal(ips)
	if err != nil {
		return err
	}
	return updateRiskGuardOption("managed_blocked_ips", string(data))
}

func updateRiskGuardOption(key string, value string) error {
	return model.UpdateOption("risk_guard."+key, value)
}

func buildRiskGuardExpression(ips []string) string {
	publicIPs := sortedPublicIPs(ips)
	if len(publicIPs) == 0 {
		return "(ip.src eq 255.255.255.255)"
	}
	parts := make([]string, 0, len(publicIPs))
	for _, ip := range publicIPs {
		parts = append(parts, "(ip.src eq "+ip+")")
	}
	return strings.Join(parts, " or ")
}

func isSuccessfulResponsesEvent(event riskGuardEvent) bool {
	return event.Method == http.MethodPost &&
		event.Path == riskGuardTargetPath &&
		event.Status == http.StatusOK
}

func normalizePublicIP(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	addr, err := netip.ParseAddr(value)
	if err != nil {
		return ""
	}
	if addr.IsPrivate() || addr.IsLoopback() || addr.IsMulticast() ||
		addr.IsUnspecified() || addr.IsLinkLocalUnicast() ||
		addr.IsLinkLocalMulticast() {
		return ""
	}
	return addr.String()
}

func sortedPublicIPs(ips []string) []string {
	seen := make(map[string]struct{}, len(ips))
	for _, ip := range ips {
		normalized := normalizePublicIP(ip)
		if normalized == "" {
			continue
		}
		seen[normalized] = struct{}{}
	}
	result := make([]string, 0, len(seen))
	for ip := range seen {
		result = append(result, ip)
	}
	sort.Strings(result)
	return result
}

func ipInSlice(ips []string, ip string) bool {
	for _, item := range ips {
		if normalizePublicIP(item) == ip {
			return true
		}
	}
	return false
}

func sliceToSet(ips []string) map[string]bool {
	result := make(map[string]bool, len(ips))
	for _, ip := range ips {
		normalized := normalizePublicIP(ip)
		if normalized != "" {
			result[normalized] = true
		}
	}
	return result
}

func topMap(input map[string]int, limit int) map[string]int {
	type pair struct {
		key   string
		value int
	}
	items := make([]pair, 0, len(input))
	for key, value := range input {
		items = append(items, pair{key: key, value: value})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].value != items[j].value {
			return items[i].value > items[j].value
		}
		return items[i].key < items[j].key
	})
	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}
	result := make(map[string]int, len(items))
	for _, item := range items {
		result[item.key] = item.value
	}
	return result
}

func formatRiskGuardAge(ts int64) string {
	if ts <= 0 {
		return "-"
	}
	seconds := int(time.Since(time.Unix(ts, 0)).Seconds())
	if seconds < 0 {
		seconds = 0
	}
	if seconds < 60 {
		return fmt.Sprintf("%ds", seconds)
	}
	if seconds < 3600 {
		return fmt.Sprintf("%dm", seconds/60)
	}
	return fmt.Sprintf("%dh", seconds/3600)
}

func clampInt(value, low, high, fallback int) int {
	if value == 0 {
		value = fallback
	}
	if value < low {
		return low
	}
	if value > high {
		return high
	}
	return value
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
