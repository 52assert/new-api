package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

var errInviteRegistrationDisabled = errors.New("registration disabled")

type InviteCodeCreateRequest struct {
	Count       int    `json:"count"`
	MaxUses     int    `json:"max_uses"`
	ExpiredTime int64  `json:"expired_time"`
	Remark      string `json:"remark"`
}

type InviteCodeUpdateRequest struct {
	Id          int     `json:"id"`
	Status      *int    `json:"status"`
	ExpiredTime *int64  `json:"expired_time"`
	Remark      *string `json:"remark"`
}

func resolveInviteCodeForRegistration(inviteCode string) (string, bool, error) {
	inviteCode = model.NormalizeInviteCode(inviteCode)
	if common.RegisterEnabled {
		if common.InviteCodeRequiredForRegistration {
			if inviteCode == "" {
				return "", false, model.ErrInviteCodeRequired
			}
			if !common.InviteCodeRegistrationEnabled {
				return "", false, model.ErrInviteCodeDisabled
			}
			return inviteCode, true, nil
		}
		if inviteCode != "" && common.InviteCodeRegistrationEnabled {
			return inviteCode, true, nil
		}
		return "", false, nil
	}
	if !common.InviteCodeRegistrationEnabled {
		return "", false, errInviteRegistrationDisabled
	}
	if inviteCode == "" {
		return "", false, model.ErrInviteCodeRequired
	}
	return inviteCode, true, nil
}

func handleInviteCodeError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, errInviteRegistrationDisabled):
		common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
	case errors.Is(err, model.ErrInviteCodeRequired):
		common.ApiErrorI18n(c, i18n.MsgInviteCodeRequired)
	case errors.Is(err, model.ErrInviteCodeInvalid):
		common.ApiErrorI18n(c, i18n.MsgInviteCodeInvalid)
	case errors.Is(err, model.ErrInviteCodeDisabled):
		common.ApiErrorI18n(c, i18n.MsgInviteCodeDisabled)
	case errors.Is(err, model.ErrInviteCodeUsed):
		common.ApiErrorI18n(c, i18n.MsgInviteCodeUsed)
	case errors.Is(err, model.ErrInviteCodeExpired):
		common.ApiErrorI18n(c, i18n.MsgInviteCodeExpired)
	default:
		common.ApiError(c, err)
	}
}

func validateInviteCodeExpiredTime(c *gin.Context, expired int64) (bool, string) {
	if expired != 0 && expired < common.GetTimestamp() {
		return false, i18n.T(c, i18n.MsgInviteCodeExpireTimeInvalid)
	}
	return true, ""
}

func GetAllInviteCodes(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	keyword := strings.TrimSpace(c.Query("keyword"))
	var inviteCodes []*model.InviteCode
	var total int64
	var err error
	if keyword == "" {
		inviteCodes, total, err = model.GetAllInviteCodes(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	} else {
		inviteCodes, total, err = model.SearchInviteCodes(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(inviteCodes)
	common.ApiSuccess(c, pageInfo)
}

func GetInviteCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	inviteCode, err := model.GetInviteCodeById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    inviteCode,
	})
}

func GetInviteCodeUsages(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo := common.GetPageQuery(c)
	usages, total, err := model.GetInviteCodeUsages(id, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(usages)
	common.ApiSuccess(c, pageInfo)
}

func AddInviteCode(c *gin.Context) {
	var req InviteCodeCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Count <= 0 {
		req.Count = 1
	}
	if req.Count > 100 {
		common.ApiErrorMsg(c, "一次最多生成 100 个邀请码")
		return
	}
	req.MaxUses = 1
	if ok, msg := validateInviteCodeExpiredTime(c, req.ExpiredTime); !ok {
		common.ApiErrorMsg(c, msg)
		return
	}

	createdCodes := make([]string, 0, req.Count)
	inviteCodes := make([]*model.InviteCode, 0, req.Count)
	for i := 0; i < req.Count; i++ {
		code, inviteCode, err := model.CreateInviteCode(c.GetInt("id"), req.MaxUses, req.ExpiredTime, req.Remark)
		if err != nil {
			common.SysError(fmt.Sprintf("failed to create invite code: %v", err))
			common.ApiError(c, err)
			return
		}
		createdCodes = append(createdCodes, code)
		inviteCodes = append(inviteCodes, inviteCode)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"codes":       createdCodes,
			"inviteCodes": inviteCodes,
		},
	})
}

func UpdateInviteCode(c *gin.Context) {
	var req InviteCodeUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	inviteCode, err := model.GetInviteCodeById(req.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if req.ExpiredTime != nil {
		if ok, msg := validateInviteCodeExpiredTime(c, *req.ExpiredTime); !ok {
			common.ApiErrorMsg(c, msg)
			return
		}
		inviteCode.ExpiredTime = *req.ExpiredTime
	}
	if req.Status != nil {
		inviteCode.Status = *req.Status
	}
	if req.Remark != nil {
		inviteCode.Remark = strings.TrimSpace(*req.Remark)
	}
	if err := inviteCode.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    inviteCode,
	})
}
