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
import { INVITE_CODE_FILTER_EXPIRED, INVITE_CODE_STATUS } from '../constants'
import type { InviteCode } from '../types'

export function isTimestampExpired(timestamp: number) {
  return timestamp > 0 && timestamp < Math.floor(Date.now() / 1000)
}

export function isInviteCodeUsed(inviteCode: InviteCode) {
  const maxUses = inviteCode.max_uses > 0 ? inviteCode.max_uses : 1
  return (
    inviteCode.status === INVITE_CODE_STATUS.USED ||
    inviteCode.used_count >= maxUses
  )
}

export function isInviteCodeExpired(inviteCode: InviteCode) {
  return (
    inviteCode.status === INVITE_CODE_STATUS.ENABLED &&
    !isInviteCodeUsed(inviteCode) &&
    isTimestampExpired(inviteCode.expired_time)
  )
}

export function getInviteCodeStatusValue(inviteCode: InviteCode) {
  if (isInviteCodeUsed(inviteCode)) return String(INVITE_CODE_STATUS.USED)
  if (inviteCode.status === INVITE_CODE_STATUS.DISABLED) {
    return String(INVITE_CODE_STATUS.DISABLED)
  }
  if (isInviteCodeExpired(inviteCode)) return INVITE_CODE_FILTER_EXPIRED
  return String(INVITE_CODE_STATUS.ENABLED)
}

export function timestampToDate(timestamp: number) {
  return timestamp > 0 ? new Date(timestamp * 1000) : undefined
}

export function dateToTimestamp(date?: Date) {
  return date ? Math.floor(date.getTime() / 1000) : 0
}

export function csvValue(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
