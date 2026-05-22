package controller

import (
	"strings"

	"github.com/gin-gonic/gin"
)

func parseListStatusFilters(c *gin.Context) []string {
	rawValues := c.QueryArray("status")
	if len(rawValues) == 0 {
		rawValues = c.QueryArray("status[]")
	}
	if len(rawValues) == 0 {
		if raw := strings.TrimSpace(c.Query("status")); raw != "" {
			rawValues = []string{raw}
		}
	}

	filters := make([]string, 0, len(rawValues))
	for _, rawValue := range rawValues {
		for _, item := range strings.Split(rawValue, ",") {
			if value := strings.TrimSpace(item); value != "" {
				filters = append(filters, value)
			}
		}
	}
	return filters
}
