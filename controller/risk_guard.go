package controller

import (
	"context"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type riskGuardIPRequest struct {
	IP string `json:"ip"`
}

func GetRiskGuardStats(c *gin.Context) {
	common.ApiSuccess(c, service.GetRiskGuardStats())
}

func UpdateRiskGuardConfig(c *gin.Context) {
	var req service.RiskGuardConfigPatch
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "无效的参数")
		return
	}
	config, err := service.UpdateRiskGuardConfig(req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, config)
}

func BlockRiskGuardIP(c *gin.Context) {
	var req riskGuardIPRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "无效的参数")
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Second)
	defer cancel()

	ok, msg := service.BlockRiskGuardIP(ctx, req.IP, "manual")
	if !ok {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": msg,
		})
		return
	}
	common.ApiSuccess(c, gin.H{"message": msg})
}

func UnblockRiskGuardIP(c *gin.Context) {
	var req riskGuardIPRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "无效的参数")
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Second)
	defer cancel()

	ok, msg := service.UnblockRiskGuardIP(ctx, req.IP, "manual")
	if !ok {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": msg,
		})
		return
	}
	common.ApiSuccess(c, gin.H{"message": msg})
}

func SyncRiskGuardCloudflare(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Second)
	defer cancel()

	ok, msg := service.PatchRiskGuardCloudflare(ctx)
	if !ok {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": msg,
		})
		return
	}
	common.ApiSuccess(c, gin.H{"message": msg})
}
