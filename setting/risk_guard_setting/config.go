package risk_guard_setting

import "github.com/QuantumNous/new-api/setting/config"

type RiskGuardSetting struct {
	Enabled                 bool     `json:"enabled"`
	AutoEnabled             bool     `json:"auto_enabled"`
	ResponsesThreshold      int      `json:"responses_threshold_per_min"`
	StatsWindowSeconds      int      `json:"stats_window_seconds"`
	RetentionSeconds        int      `json:"retention_seconds"`
	AutoCooldownSeconds     int      `json:"auto_cooldown_seconds"`
	CloudflareAuthToken     string   `json:"cf_auth_token"`
	CloudflareZoneID        string   `json:"cf_zone_id"`
	CloudflareRulesetID     string   `json:"cf_ruleset_id"`
	CloudflareRuleID        string   `json:"cf_rule_id"`
	CloudflareRuleDesc      string   `json:"cf_rule_description"`
	ManagedBlockedIPs       []string `json:"managed_blocked_ips"`
	UseCloudflareConnecting bool     `json:"use_cf_connecting_ip"`
}

var riskGuardSetting = RiskGuardSetting{
	Enabled:                 true,
	AutoEnabled:             true,
	ResponsesThreshold:      200,
	StatsWindowSeconds:      60,
	RetentionSeconds:        900,
	AutoCooldownSeconds:     900,
	CloudflareRuleDesc:      "ip限制",
	ManagedBlockedIPs:       []string{},
	UseCloudflareConnecting: true,
}

func init() {
	config.GlobalConfig.Register("risk_guard", &riskGuardSetting)
}

func GetSetting() *RiskGuardSetting {
	return &riskGuardSetting
}
