package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func RiskGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !service.RiskGuardEnabled() {
			c.Next()
			return
		}

		ip := service.RiskGuardClientIP(c)
		if service.RiskGuardIsBlocked(ip) {
			abortWithOpenAiMessage(c, http.StatusForbidden, "IP has been blocked by risk guard")
			return
		}

		c.Next()

		service.RecordRiskGuardRequest(service.RiskGuardRequest{
			IP:        ip,
			Method:    c.Request.Method,
			Path:      c.Request.URL.Path,
			Status:    c.Writer.Status(),
			RequestID: c.GetString(common.RequestIdKey),
		})
	}
}
