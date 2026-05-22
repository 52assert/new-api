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
import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate } from '@/lib/format'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { INVITE_CODE_FILTER_EXPIRED, INVITE_CODE_STATUSES } from '../constants'
import { getInviteCodeStatusValue } from '../lib'
import type { InviteCode } from '../types'
import { DataTableRowActions } from './invite-codes-row-actions'

export function useInviteCodesColumns(): ColumnDef<InviteCode>[] {
  const { t } = useTranslation()
  return [
    {
      accessorKey: 'id',
      meta: { label: t('ID'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('ID')} />
      ),
      cell: ({ row }) => <div className='w-[60px]'>{row.getValue('id')}</div>,
    },
    {
      accessorKey: 'code_prefix',
      meta: { label: t('Prefix'), mobileTitle: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Prefix')} />
      ),
      cell: ({ row }) => (
        <div className='font-mono text-sm'>{row.getValue('code_prefix')}</div>
      ),
    },
    {
      accessorKey: 'status',
      meta: { label: t('Status'), mobileBadge: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Status')} />
      ),
      cell: ({ row }) => {
        const inviteCode = row.original
        const statusValue = getInviteCodeStatusValue(inviteCode)

        if (statusValue === INVITE_CODE_FILTER_EXPIRED) {
          return (
            <StatusBadge
              label={t('Expired')}
              variant='warning'
              showDot={true}
              copyable={false}
            />
          )
        }

        const statusConfig = INVITE_CODE_STATUSES[Number(statusValue)]
        if (!statusConfig) return null

        return (
          <StatusBadge
            label={t(statusConfig.labelKey)}
            variant={statusConfig.variant}
            showDot={statusConfig.showDot}
            copyable={false}
          />
        )
      },
      filterFn: (row, _id, value) => {
        const statusValue = getInviteCodeStatusValue(row.original)
        return value.includes(String(statusValue))
      },
    },
    {
      accessorKey: 'used_count',
      meta: { label: t('Used') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Used')} />
      ),
      cell: ({ row }) => {
        const inviteCode = row.original
        return (
          <span className='font-mono text-sm'>
            {inviteCode.used_count}/{inviteCode.max_uses}
          </span>
        )
      },
    },
    {
      accessorKey: 'created_time',
      meta: { label: t('Created'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Created')} />
      ),
      cell: ({ row }) => (
        <div className='min-w-[140px] font-mono text-sm'>
          {formatTimestampToDate(row.getValue('created_time'))}
        </div>
      ),
    },
    {
      accessorKey: 'expired_time',
      meta: { label: t('Expires'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Expires')} />
      ),
      cell: ({ row }) => {
        const expiredTime = row.getValue('expired_time') as number
        if (expiredTime === 0) {
          return (
            <StatusBadge
              label={t('Never')}
              variant='neutral'
              copyable={false}
            />
          )
        }
        return (
          <div className='min-w-[140px] font-mono text-sm'>
            {formatTimestampToDate(expiredTime)}
          </div>
        )
      },
    },
    {
      accessorKey: 'remark',
      meta: { label: t('Remark'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Remark')} />
      ),
      cell: ({ row }) => {
        const remark = row.getValue('remark') as string
        return (
          <div className='max-w-[260px] truncate text-sm'>{remark || '-'}</div>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => <DataTableRowActions row={row} />,
    },
  ]
}
