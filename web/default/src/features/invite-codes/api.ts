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
  CreateInviteCodeData,
  CreateInviteCodeResponse,
  GetInviteCodesParams,
  InviteCode,
  InviteCodeUsage,
  PageResponse,
  UpdateInviteCodeData,
} from './types'

export async function getInviteCodes(
  params: GetInviteCodesParams = {}
): Promise<PageResponse<InviteCode>> {
  const { p = 1, page_size = 20, keyword, status } = params
  const res = await api.get('/api/invite-code/', {
    params: {
      p,
      page_size,
      keyword: keyword || undefined,
      status: status?.length ? status.join(',') : undefined,
    },
  })
  return res.data
}

export async function getInviteCode(
  id: number
): Promise<ApiResponse<InviteCode>> {
  const res = await api.get(`/api/invite-code/${id}`)
  return res.data
}

export async function createInviteCodes(
  data: CreateInviteCodeData
): Promise<ApiResponse<CreateInviteCodeResponse>> {
  const res = await api.post('/api/invite-code/', data)
  return res.data
}

export async function updateInviteCode(
  data: UpdateInviteCodeData
): Promise<ApiResponse<InviteCode>> {
  const res = await api.put('/api/invite-code/', data)
  return res.data
}

export async function getInviteCodeUsages(
  id: number,
  params: GetInviteCodesParams = {}
): Promise<PageResponse<InviteCodeUsage>> {
  const { p = 1, page_size = 20 } = params
  const res = await api.get(`/api/invite-code/${id}/usages`, {
    params: { p, page_size },
  })
  return res.data
}
