/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
export type RiskGuardConfig = {
  enabled: boolean
  auto_enabled: boolean
  responses_threshold_per_min: number
  stats_window_seconds: number
  retention_seconds: number
  auto_cooldown_seconds: number
  cf_ready: boolean
  cf_zone_id: string
  cf_ruleset_id: string
  cf_rule_id: string
  cf_rule_description: string
  use_cf_connecting_ip: boolean
}

export type RiskGuardIPStats = {
  ip: string
  total: number
  responses: number
  errors: number
  status: Record<string, number>
  paths: Record<string, number>
  last_seen: number
  last_seen_age: string
  blocked: boolean
}

export type RiskGuardAudit = {
  t: number
  action: string
  message: string
  ip: string
  ok: boolean
}

export type RiskGuardStats = {
  now: number
  uptime_seconds: number
  window_seconds: number
  total: number
  rpm: number
  top_ips: RiskGuardIPStats[]
  status_total: Record<string, number>
  path_total: Record<string, number>
  blocked_ips: string[]
  audit: RiskGuardAudit[]
  config: RiskGuardConfig
}

export type RiskGuardConfigPatch = Partial<
  Omit<RiskGuardConfig, 'cf_ready'> & {
    cf_auth_token: string
  }
>

export type ApiResponse<T = unknown> = {
  success: boolean
  message?: string
  data?: T
}
