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
import { useMemo } from 'react'
import { Copy, Download, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
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
import { csvValue, downloadFile } from '../lib'
import { useInviteCodes } from './invite-codes-provider'

export function InviteCodesGeneratedDialog() {
  const { t } = useTranslation()
  const { open, setOpen, generatedCodes, setGeneratedCodes } = useInviteCodes()
  const generatedCodeText = useMemo(
    () => generatedCodes.map((item) => item.code).join('\n'),
    [generatedCodes]
  )

  const handleCopy = async (text: string) => {
    const ok = await copyToClipboard(text)
    if (ok) {
      toast.success(t('Copied'))
      return
    }
    toast.error(t('Copy failed'))
  }

  const handleDownloadTxt = () => {
    if (!generatedCodeText) return
    downloadFile(
      `invite-codes-${Date.now()}.txt`,
      generatedCodeText,
      'text/plain;charset=utf-8'
    )
  }

  const handleDownloadCsv = () => {
    if (!generatedCodes.length) return
    const header = [
      'id',
      'code',
      'prefix',
      'status',
      'used_count',
      'max_uses',
      'expired_time',
      'remark',
    ]
    const rows = generatedCodes.map(({ code, inviteCode }) =>
      [
        inviteCode?.id ?? '',
        code,
        inviteCode?.code_prefix ?? '',
        inviteCode?.status ?? '',
        inviteCode?.used_count ?? '',
        inviteCode?.max_uses ?? '',
        inviteCode?.expired_time ?? '',
        inviteCode?.remark ?? '',
      ]
        .map(csvValue)
        .join(',')
    )
    downloadFile(
      `invite-codes-${Date.now()}.csv`,
      [header.join(','), ...rows].join('\n'),
      'text/csv;charset=utf-8'
    )
  }

  return (
    <Dialog
      open={open === 'generated'}
      onOpenChange={(isOpen) => {
        if (!isOpen) setOpen(null)
      }}
    >
      <DialogContent className='max-w-[calc(100%-1rem)] sm:max-w-4xl'>
        <DialogHeader>
          <DialogTitle>{t('Generated invite codes')}</DialogTitle>
          <DialogDescription>
            {t(
              'Full invite codes are only shown once after creation. Copy or download them before closing this dialog.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='text-muted-foreground text-sm'>
            {t('Total')}: {generatedCodes.length}
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => handleCopy(generatedCodeText)}
            >
              <Copy className='h-3.5 w-3.5' />
              {t('Copy all')}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={handleDownloadTxt}
            >
              <Download className='h-3.5 w-3.5' />
              {t('Download TXT')}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={handleDownloadCsv}
            >
              <Download className='h-3.5 w-3.5' />
              {t('Download CSV')}
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => setGeneratedCodes([])}
            >
              <Trash2 className='h-3.5 w-3.5' />
              {t('Clear')}
            </Button>
          </div>
        </div>

        <div className='max-h-[420px] overflow-y-auto rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ID')}</TableHead>
                <TableHead>{t('Full invite code')}</TableHead>
                <TableHead>{t('Prefix')}</TableHead>
                <TableHead>{t('Remark')}</TableHead>
                <TableHead className='text-right'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {generatedCodes.map(({ code, inviteCode }, index) => (
                <TableRow key={`${code}-${index}`}>
                  <TableCell>{inviteCode?.id ?? '-'}</TableCell>
                  <TableCell className='max-w-[420px]'>
                    <div className='font-mono text-xs break-all'>{code}</div>
                  </TableCell>
                  <TableCell className='font-mono'>
                    {inviteCode?.code_prefix ?? '-'}
                  </TableCell>
                  <TableCell className='max-w-[220px] truncate'>
                    {inviteCode?.remark || '-'}
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => handleCopy(code)}
                    >
                      <Copy className='h-3.5 w-3.5' />
                      {t('Copy')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
