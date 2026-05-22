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
import { type Row } from '@tanstack/react-table'
import {
  Edit,
  History,
  MoreHorizontal as DotsHorizontalIcon,
  Power,
  PowerOff,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { updateInviteCode } from '../api'
import { INVITE_CODE_STATUS } from '../constants'
import { isInviteCodeExpired, isInviteCodeUsed } from '../lib'
import { inviteCodeSchema } from '../types'
import { useInviteCodes } from './invite-codes-provider'

interface DataTableRowActionsProps<TData> {
  row: Row<TData>
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const { t } = useTranslation()
  const inviteCode = inviteCodeSchema.parse(row.original)
  const { setOpen, setCurrentRow, triggerRefresh } = useInviteCodes()
  const isEnabled = inviteCode.status === INVITE_CODE_STATUS.ENABLED
  const isUsed = isInviteCodeUsed(inviteCode)
  const isExpired = isInviteCodeExpired(inviteCode)

  const handleToggleStatus = async () => {
    const newStatus = isEnabled
      ? INVITE_CODE_STATUS.DISABLED
      : INVITE_CODE_STATUS.ENABLED

    const result = await updateInviteCode({
      id: inviteCode.id,
      status: newStatus,
    })
    if (result.success) {
      toast.success(isEnabled ? t('Disabled') : t('Enabled'))
      triggerRefresh()
      return
    }
    toast.error(result.message || t('Failed to update invite code'))
  }

  const canEdit = !isUsed
  const canToggle = !isUsed && !isExpired

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            variant='ghost'
            className='data-popup-open:bg-muted flex h-8 w-8 p-0'
          />
        }
      >
        <DotsHorizontalIcon className='h-4 w-4' />
        <span className='sr-only'>{t('Open menu')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[180px]'>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(inviteCode)
            setOpen('update')
          }}
          disabled={!canEdit}
        >
          {t('Edit')}
          <DropdownMenuShortcut>
            <Edit size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(inviteCode)
            setOpen('usages')
          }}
        >
          {t('Usages')}
          <DropdownMenuShortcut>
            <History size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        {canToggle && (
          <DropdownMenuItem onClick={handleToggleStatus}>
            {isEnabled ? (
              <>
                {t('Disable')}
                <DropdownMenuShortcut>
                  <PowerOff size={16} />
                </DropdownMenuShortcut>
              </>
            ) : (
              <>
                {t('Enable')}
                <DropdownMenuShortcut>
                  <Power size={16} />
                </DropdownMenuShortcut>
              </>
            )}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
