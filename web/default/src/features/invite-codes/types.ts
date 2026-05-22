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
import { z } from 'zod'

export const inviteCodeSchema = z.object({
  id: z.number(),
  code_prefix: z.string(),
  status: z.number(),
  max_uses: z.number(),
  used_count: z.number(),
  created_by: z.number(),
  created_time: z.number(),
  expired_time: z.number(),
  used_time: z.number(),
  remark: z.preprocess((value) => value ?? '', z.string()),
})

export type InviteCode = z.infer<typeof inviteCodeSchema>

export type InviteCodeUsage = {
  id: number
  invite_code_id: number
  user_id: number
  username: string
  provider: string
  ip: string
  user_agent: string
  used_time: number
}

export type ApiResponse<T = unknown> = {
  success: boolean
  message?: string
  data?: T
}

export type PageResponse<T> = ApiResponse<{
  items: T[]
  total: number
  page: number
  page_size: number
}>

export type GetInviteCodesParams = {
  p?: number
  page_size?: number
  keyword?: string
}

export type CreateInviteCodeData = {
  count: number
  expired_time: number
  remark?: string
}

export type UpdateInviteCodeData = {
  id: number
  status?: number
  expired_time?: number
  remark?: string
}

export type CreateInviteCodeResponse = {
  codes: string[]
  inviteCodes: InviteCode[]
}

export type GeneratedInviteCode = {
  code: string
  inviteCode: InviteCode | null
}

export type InviteCodesDialogType = 'create' | 'update' | 'generated' | 'usages'
