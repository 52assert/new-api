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
import type { TFunction } from 'i18next'
import type { StatusVariant } from '@/components/status-badge'

export const INVITE_CODE_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
  USED: 3,
} as const

export const INVITE_CODE_FILTER_EXPIRED = 'expired'

export const INVITE_CODE_STATUS_VALUES = [
  String(INVITE_CODE_STATUS.ENABLED),
  String(INVITE_CODE_STATUS.DISABLED),
  String(INVITE_CODE_STATUS.USED),
  INVITE_CODE_FILTER_EXPIRED,
] as const

export type InviteCodeStatusFilter = (typeof INVITE_CODE_STATUS_VALUES)[number]

export const INVITE_CODE_STATUSES: Record<
  number,
  { labelKey: string; variant: StatusVariant; showDot: boolean }
> = {
  [INVITE_CODE_STATUS.ENABLED]: {
    labelKey: 'Enabled',
    variant: 'success',
    showDot: true,
  },
  [INVITE_CODE_STATUS.DISABLED]: {
    labelKey: 'Disabled',
    variant: 'neutral',
    showDot: true,
  },
  [INVITE_CODE_STATUS.USED]: {
    labelKey: 'Used',
    variant: 'info',
    showDot: true,
  },
}

export function getInviteCodeStatusOptions(t: TFunction) {
  return [
    {
      label: t('Enabled'),
      value: String(INVITE_CODE_STATUS.ENABLED),
    },
    {
      label: t('Disabled'),
      value: String(INVITE_CODE_STATUS.DISABLED),
    },
    {
      label: t('Used'),
      value: String(INVITE_CODE_STATUS.USED),
    },
    {
      label: t('Expired'),
      value: INVITE_CODE_FILTER_EXPIRED,
    },
  ]
}
