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
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getInviteCodeUsages } from '../api'
import { useInviteCodes } from './invite-codes-provider'

const USAGE_PAGE_SIZE = 20

export function InviteCodesUsagesDialog() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow } = useInviteCodes()
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (open === 'usages') {
      setPage(1)
    }
  }, [open, currentRow?.id])

  const usagesQuery = useQuery({
    queryKey: ['invite-code-usages', currentRow?.id, page],
    enabled: open === 'usages' && !!currentRow,
    queryFn: async () =>
      getInviteCodeUsages(currentRow!.id, {
        p: page,
        page_size: USAGE_PAGE_SIZE,
      }),
  })

  const usages = usagesQuery.data?.data?.items ?? []
  const total = usagesQuery.data?.data?.total ?? 0
  const canGoNext = useMemo(() => page * USAGE_PAGE_SIZE < total, [page, total])

  return (
    <Dialog
      open={open === 'usages'}
      onOpenChange={(isOpen) => {
        if (!isOpen) setOpen(null)
      }}
    >
      <DialogContent className='max-w-[calc(100%-1rem)] sm:max-w-5xl'>
        <DialogHeader>
          <DialogTitle>{t('Usage tracking')}</DialogTitle>
          <DialogDescription>
            {currentRow
              ? `${t('Invite code')} #${currentRow.id} (${currentRow.code_prefix})`
              : t('Invite code usage records')}
          </DialogDescription>
        </DialogHeader>

        <div className='max-h-[520px] overflow-y-auto rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('User')}</TableHead>
                <TableHead>{t('Provider')}</TableHead>
                <TableHead>{t('IP')}</TableHead>
                <TableHead>{t('Used at')}</TableHead>
                <TableHead>{t('User agent')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usages.map((usage) => (
                <TableRow key={usage.id}>
                  <TableCell>
                    {usage.username || usage.user_id || '-'}
                  </TableCell>
                  <TableCell>{usage.provider || '-'}</TableCell>
                  <TableCell>{usage.ip || '-'}</TableCell>
                  <TableCell>
                    {formatTimestampToDate(usage.used_time)}
                  </TableCell>
                  <TableCell className='max-w-[360px] truncate'>
                    {usage.user_agent || '-'}
                  </TableCell>
                </TableRow>
              ))}
              {usages.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='text-muted-foreground py-8 text-center'
                  >
                    {usagesQuery.isLoading
                      ? t('Loading...')
                      : t('No usage records')}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <div className='flex items-center justify-between gap-2'>
          <div className='text-muted-foreground text-sm'>
            {t('Total')}: {total}
          </div>
          <div className='flex gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              {t('Previous')}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={!canGoNext}
              onClick={() => setPage((value) => value + 1)}
            >
              {t('Next')}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => setOpen(null)}>
            {t('Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
