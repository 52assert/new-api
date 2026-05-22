package model

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const inviteCodeGeneratedLength = 24

var (
	ErrInviteCodeRequired = errors.New("invite code is required")
	ErrInviteCodeInvalid  = errors.New("invite code is invalid")
	ErrInviteCodeDisabled = errors.New("invite code is disabled")
	ErrInviteCodeUsed     = errors.New("invite code has been used")
	ErrInviteCodeExpired  = errors.New("invite code has expired")
)

type InviteCode struct {
	Id          int            `json:"id"`
	CodeHash    string         `json:"-" gorm:"type:char(64);uniqueIndex"`
	CodePrefix  string         `json:"code_prefix" gorm:"type:varchar(12);index"`
	Status      int            `json:"status" gorm:"type:int;default:1"`
	MaxUses     int            `json:"max_uses" gorm:"type:int;default:1"`
	UsedCount   int            `json:"used_count" gorm:"type:int;default:0"`
	CreatedBy   int            `json:"created_by" gorm:"type:int;index"`
	CreatedTime int64          `json:"created_time" gorm:"bigint"`
	ExpiredTime int64          `json:"expired_time" gorm:"bigint"`
	UsedTime    int64          `json:"used_time" gorm:"bigint"`
	Remark      string         `json:"remark" gorm:"type:varchar(255)"`
	Count       int            `json:"count" gorm:"-:all"`
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

type InviteCodeUsage struct {
	Id           int    `json:"id"`
	InviteCodeId int    `json:"invite_code_id" gorm:"index"`
	UserId       int    `json:"user_id" gorm:"index"`
	Username     string `json:"username" gorm:"type:varchar(64);index"`
	Provider     string `json:"provider" gorm:"type:varchar(32);index"`
	Ip           string `json:"ip" gorm:"type:varchar(64)"`
	UserAgent    string `json:"user_agent" gorm:"type:varchar(255)"`
	UsedTime     int64  `json:"used_time" gorm:"bigint"`
}

func NormalizeInviteCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func HashInviteCode(code string) string {
	normalized := NormalizeInviteCode(code)
	sum := sha256.Sum256([]byte(normalized))
	return hex.EncodeToString(sum[:])
}

func InviteCodePrefix(code string) string {
	normalized := NormalizeInviteCode(code)
	if len(normalized) <= 8 {
		return normalized
	}
	return normalized[:8]
}

func GenerateInviteCode() (string, error) {
	randomPart, err := common.GenerateRandomCharsKey(inviteCodeGeneratedLength)
	if err != nil {
		return "", err
	}
	return "INV-" + strings.ToUpper(randomPart), nil
}

func CreateInviteCode(createdBy int, maxUses int, expiredTime int64, remark string) (string, *InviteCode, error) {
	if maxUses <= 0 {
		maxUses = 1
	}
	for i := 0; i < 5; i++ {
		code, err := GenerateInviteCode()
		if err != nil {
			return "", nil, err
		}
		inviteCode := &InviteCode{
			CodeHash:    HashInviteCode(code),
			CodePrefix:  InviteCodePrefix(code),
			Status:      common.InviteCodeStatusEnabled,
			MaxUses:     maxUses,
			CreatedBy:   createdBy,
			CreatedTime: common.GetTimestamp(),
			ExpiredTime: expiredTime,
			Remark:      strings.TrimSpace(remark),
		}
		if err := DB.Create(inviteCode).Error; err != nil {
			if i == 4 {
				return "", nil, err
			}
			continue
		}
		return code, inviteCode, nil
	}
	return "", nil, errors.New("failed to generate invite code")
}

func GetAllInviteCodes(startIdx int, num int, statusFilters []string) (inviteCodes []*InviteCode, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := applyInviteCodeStatusFilter(tx.Model(&InviteCode{}), statusFilters)

	if err = query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&inviteCodes).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return inviteCodes, total, nil
}

func SearchInviteCodes(keyword string, startIdx int, num int, statusFilters []string) (inviteCodes []*InviteCode, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	keyword = strings.TrimSpace(keyword)
	query := tx.Model(&InviteCode{})
	if id, convErr := strconv.Atoi(keyword); convErr == nil {
		query = query.Where("id = ? OR code_prefix LIKE ? OR remark LIKE ?", id, keyword+"%", "%"+keyword+"%")
	} else {
		query = query.Where("code_prefix LIKE ? OR remark LIKE ?", keyword+"%", "%"+keyword+"%")
	}
	query = applyInviteCodeStatusFilter(query, statusFilters)

	if err = query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}
	if err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&inviteCodes).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return inviteCodes, total, nil
}

func applyInviteCodeStatusFilter(query *gorm.DB, statusFilters []string) *gorm.DB {
	if len(statusFilters) == 0 {
		return query
	}

	now := common.GetTimestamp()
	maxUsesExpr := "CASE WHEN max_uses <= 0 THEN 1 ELSE max_uses END"
	conditions := make([]string, 0, len(statusFilters))
	args := make([]any, 0, len(statusFilters)*3)
	seen := make(map[string]bool)
	for _, rawStatus := range statusFilters {
		status := strings.TrimSpace(rawStatus)
		if status == "" || seen[status] {
			continue
		}
		seen[status] = true

		switch status {
		case "1":
			conditions = append(conditions, "(status = ? AND used_count < "+maxUsesExpr+" AND (expired_time = 0 OR expired_time >= ?))")
			args = append(args, common.InviteCodeStatusEnabled, now)
		case "2":
			conditions = append(conditions, "status = ?")
			args = append(args, common.InviteCodeStatusDisabled)
		case "3":
			conditions = append(conditions, "(status = ? OR used_count >= "+maxUsesExpr+")")
			args = append(args, common.InviteCodeStatusUsed)
		case "expired":
			conditions = append(conditions, "(status = ? AND used_count < "+maxUsesExpr+" AND expired_time != 0 AND expired_time < ?)")
			args = append(args, common.InviteCodeStatusEnabled, now)
		}
	}
	if len(conditions) == 0 {
		return query
	}
	return query.Where("("+strings.Join(conditions, " OR ")+")", args...)
}

func GetInviteCodeById(id int) (*InviteCode, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	inviteCode := InviteCode{Id: id}
	err := DB.First(&inviteCode, "id = ?", id).Error
	return &inviteCode, err
}

func (inviteCode *InviteCode) Update() error {
	return DB.Model(inviteCode).Select("status", "expired_time", "remark").Updates(inviteCode).Error
}

func GetInviteCodeUsages(inviteCodeId int, startIdx int, num int) (usages []*InviteCodeUsage, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&InviteCodeUsage{}).Where("invite_code_id = ?", inviteCodeId)
	if err = query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}
	if err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&usages).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return usages, total, nil
}

func ConsumeInviteCodeWithTx(tx *gorm.DB, code string, userId int, username string, provider string, ip string, userAgent string) error {
	normalizedCode := NormalizeInviteCode(code)
	if normalizedCode == "" {
		return ErrInviteCodeRequired
	}
	if tx == nil {
		return errors.New("transaction is nil")
	}

	var inviteCode InviteCode
	err := tx.Set("gorm:query_option", "FOR UPDATE").Where("code_hash = ?", HashInviteCode(normalizedCode)).First(&inviteCode).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrInviteCodeInvalid
		}
		return err
	}

	now := common.GetTimestamp()
	if inviteCode.Status == common.InviteCodeStatusDisabled {
		return ErrInviteCodeDisabled
	}
	if inviteCode.Status == common.InviteCodeStatusUsed {
		return ErrInviteCodeUsed
	}
	if inviteCode.ExpiredTime != 0 && inviteCode.ExpiredTime < now {
		return ErrInviteCodeExpired
	}
	if inviteCode.MaxUses <= 0 {
		inviteCode.MaxUses = 1
	}
	if inviteCode.UsedCount >= inviteCode.MaxUses {
		inviteCode.Status = common.InviteCodeStatusUsed
		inviteCode.UsedTime = now
		_ = tx.Model(&inviteCode).Select("status", "used_time").Updates(&inviteCode).Error
		return ErrInviteCodeUsed
	}

	inviteCode.UsedCount++
	if inviteCode.UsedCount >= inviteCode.MaxUses {
		inviteCode.Status = common.InviteCodeStatusUsed
		inviteCode.UsedTime = now
	}
	if err := tx.Model(&inviteCode).Select("used_count", "status", "used_time").Updates(&inviteCode).Error; err != nil {
		return err
	}

	usage := &InviteCodeUsage{
		InviteCodeId: inviteCode.Id,
		UserId:       userId,
		Username:     username,
		Provider:     strings.TrimSpace(provider),
		Ip:           strings.TrimSpace(ip),
		UserAgent:    truncateString(strings.TrimSpace(userAgent), 255),
		UsedTime:     now,
	}
	if err := tx.Create(usage).Error; err != nil {
		return err
	}
	return nil
}

func IsInviteCodeError(err error) bool {
	return errors.Is(err, ErrInviteCodeRequired) ||
		errors.Is(err, ErrInviteCodeInvalid) ||
		errors.Is(err, ErrInviteCodeDisabled) ||
		errors.Is(err, ErrInviteCodeUsed) ||
		errors.Is(err, ErrInviteCodeExpired)
}

func truncateString(value string, maxLen int) string {
	if maxLen <= 0 || len(value) <= maxLen {
		return value
	}
	return value[:maxLen]
}

func InviteCodeErrorMessage(err error) string {
	switch {
	case errors.Is(err, ErrInviteCodeRequired):
		return "请输入邀请码"
	case errors.Is(err, ErrInviteCodeInvalid):
		return "邀请码无效"
	case errors.Is(err, ErrInviteCodeDisabled):
		return "邀请码已禁用"
	case errors.Is(err, ErrInviteCodeUsed):
		return "邀请码已被使用"
	case errors.Is(err, ErrInviteCodeExpired):
		return "邀请码已过期"
	default:
		return fmt.Sprintf("邀请码校验失败: %v", err)
	}
}
