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
import { api } from '@/lib/api'
import type {
  ApiResponse,
  RiskGuardConfig,
  RiskGuardConfigPatch,
  RiskGuardStats,
} from './types'

const actionConfig = {
  skipBusinessError: true,
  skipErrorHandler: true,
}

export async function getRiskGuardStats(): Promise<
  ApiResponse<RiskGuardStats>
> {
  const res = await api.get('/api/risk-guard/stats', {
    disableDuplicate: true,
  })
  return res.data
}

export async function updateRiskGuardConfig(
  patch: RiskGuardConfigPatch
): Promise<ApiResponse<RiskGuardConfig>> {
  const res = await api.patch('/api/risk-guard/config', patch, actionConfig)
  return res.data
}

export async function blockRiskGuardIp(
  ip: string
): Promise<ApiResponse<{ message?: string }>> {
  const res = await api.post('/api/risk-guard/block', { ip }, actionConfig)
  return res.data
}

export async function unblockRiskGuardIp(
  ip: string
): Promise<ApiResponse<{ message?: string }>> {
  const res = await api.post('/api/risk-guard/unblock', { ip }, actionConfig)
  return res.data
}

export async function syncRiskGuardCloudflare(): Promise<
  ApiResponse<{ message?: string }>
> {
  const res = await api.post('/api/risk-guard/sync', {}, actionConfig)
  return res.data
}
