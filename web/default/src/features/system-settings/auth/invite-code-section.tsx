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
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Download, History, Loader2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SettingsSection } from '../components/settings-section'

type InviteCode = {
  id: number
  code_prefix: string
  status: number
  max_uses: number
  used_count: number
  created_by: number
  created_time: number
  expired_time: number
  used_time: number
  remark: string
}

type InviteCodeUsage = {
  id: number
  invite_code_id: number
  user_id: number
  username: string
  provider: string
  ip: string
  user_agent: string
  used_time: number
}

type PageResponse<T> = {
  success: boolean
  message: string
  data: {
    items: T[]
    total: number
    page: number
    page_size: number
  }
}

type CreateResponse = {
  success: boolean
  message: string
  data: {
    codes: string[]
    inviteCodes: InviteCode[]
  }
}

type GeneratedInviteCode = {
  code: string
  inviteCode: InviteCode | null
}

const STATUS_ENABLED = 1
const STATUS_DISABLED = 2
const STATUS_USED = 3
const PAGE_SIZE = 20
const USAGE_PAGE_SIZE = 20

function formatTime(timestamp: number) {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleString()
}

function statusLabel(code: InviteCode, t: (key: string) => string) {
  if (code.status === STATUS_USED || code.used_count >= code.max_uses) {
    return t('Used')
  }
  if (code.status === STATUS_DISABLED) return t('Disabled')
  if (code.expired_time && code.expired_time < Math.floor(Date.now() / 1000)) {
    return t('Expired')
  }
  return t('Enabled')
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvValue(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export function InviteCodeSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(1)
  const [expiredAt, setExpiredAt] = useState('')
  const [remark, setRemark] = useState('')
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedInviteCode[]>(
    []
  )
  const [selectedCodeId, setSelectedCodeId] = useState<number | null>(null)

  const inviteCodesQuery = useQuery({
    queryKey: ['invite-codes', page],
    queryFn: async () => {
      const res = await api.get<PageResponse<InviteCode>>('/api/invite-code/', {
        params: { p: page, page_size: PAGE_SIZE },
      })
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const expiredTime = expiredAt
        ? Math.floor(new Date(expiredAt).getTime() / 1000)
        : 0
      const res = await api.post<CreateResponse>('/api/invite-code/', {
        count,
        expired_time: expiredTime,
        remark,
      })
      return res.data
    },
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.message || t('Failed to create invite codes'))
        return
      }
      const generated = data.data.codes.map((code, index) => ({
        code,
        inviteCode: data.data.inviteCodes?.[index] ?? null,
      }))
      setGeneratedCodes((items) => [...generated, ...items])
      queryClient.invalidateQueries({ queryKey: ['invite-codes'] })
      toast.success(t('Invite codes created'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<InviteCode> & { id: number }) => {
      const res = await api.put('/api/invite-code/', payload)
      return res.data as { success: boolean; message: string }
    },
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.message || t('Failed to update invite code'))
        return
      }
      queryClient.invalidateQueries({ queryKey: ['invite-codes'] })
      toast.success(t('Invite code updated'))
    },
  })

  const inviteCodes = inviteCodesQuery.data?.data.items ?? []
  const total = inviteCodesQuery.data?.data.total ?? 0
  const canGoNext = useMemo(() => page * PAGE_SIZE < total, [page, total])
  const selectedInviteCode = useMemo(
    () => inviteCodes.find((code) => code.id === selectedCodeId),
    [inviteCodes, selectedCodeId]
  )

  const usagesQuery = useQuery({
    queryKey: ['invite-code-usages', selectedCodeId],
    enabled: selectedCodeId !== null,
    queryFn: async () => {
      const res = await api.get<PageResponse<InviteCodeUsage>>(
        `/api/invite-code/${selectedCodeId}/usages`,
        {
          params: { p: 1, page_size: USAGE_PAGE_SIZE },
        }
      )
      return res.data
    },
  })

  const usages = usagesQuery.data?.data.items ?? []
  const generatedCodeText = useMemo(
    () => generatedCodes.map((item) => item.code).join('\n'),
    [generatedCodes]
  )

  const handleCopy = async (text: string) => {
    const ok = await copyToClipboard(text)
    if (ok) {
      toast.success(t('Copied'))
    } else {
      toast.error(t('Copy failed'))
    }
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
        inviteCode ? statusLabel(inviteCode, t) : '',
        inviteCode?.used_count ?? '',
        inviteCode?.max_uses ?? '',
        inviteCode ? formatTime(inviteCode.expired_time) : '',
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
    <SettingsSection
      title={t('Admin Invite Codes')}
      description={t(
        'Generate and track one-time invite codes for account registration.'
      )}
    >
      <div className='grid gap-4 rounded-lg border p-4 md:grid-cols-3'>
        <div className='space-y-2'>
          <label className='text-sm font-medium'>{t('Count')}</label>
          <Input
            type='number'
            min={1}
            max={100}
            value={count}
            onChange={(event) => setCount(Number(event.target.value || 1))}
          />
        </div>
        <div className='space-y-2'>
          <label className='text-sm font-medium'>{t('Expires at')}</label>
          <Input
            type='datetime-local'
            value={expiredAt}
            onChange={(event) => setExpiredAt(event.target.value)}
          />
        </div>
        <div className='space-y-2'>
          <label className='text-sm font-medium'>{t('Remark')}</label>
          <Input
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
            placeholder={t('Optional note')}
          />
        </div>
        <div className='md:col-span-3'>
          <Button
            type='button'
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className='gap-2'
          >
            {createMutation.isPending ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : null}
            {t('Generate invite codes')}
          </Button>
        </div>
      </div>

      {generatedCodes.length > 0 ? (
        <div className='space-y-3 rounded-lg border p-4'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <label className='text-sm font-medium'>
              {t('Generated invite codes')} ({generatedCodes.length})
            </label>
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
                  <TableHead className='text-right'>
                    {t('Actions')}
                  </TableHead>
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
        </div>
      ) : null}

      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('ID')}</TableHead>
              <TableHead>{t('Prefix')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Used')}</TableHead>
              <TableHead>{t('Expires at')}</TableHead>
              <TableHead>{t('Remark')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inviteCodes.map((code) => (
              <TableRow key={code.id}>
                <TableCell>{code.id}</TableCell>
                <TableCell className='font-mono'>{code.code_prefix}</TableCell>
                <TableCell>{statusLabel(code, t)}</TableCell>
                <TableCell>
                  {code.used_count}/{code.max_uses}
                </TableCell>
                <TableCell>{formatTime(code.expired_time)}</TableCell>
                <TableCell className='max-w-[220px] truncate'>
                  {code.remark || '-'}
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-2'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => setSelectedCodeId(code.id)}
                    >
                      <History className='h-3.5 w-3.5' />
                      {t('Usages')}
                    </Button>
                    {code.status === STATUS_DISABLED ? (
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        disabled={updateMutation.isPending}
                        onClick={() =>
                          updateMutation.mutate({
                            id: code.id,
                            status: STATUS_ENABLED,
                          })
                        }
                      >
                        {t('Enable')}
                      </Button>
                    ) : (
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        disabled={
                          updateMutation.isPending ||
                          code.status === STATUS_USED
                        }
                        onClick={() =>
                          updateMutation.mutate({
                            id: code.id,
                            status: STATUS_DISABLED,
                          })
                        }
                      >
                        {t('Disable')}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {inviteCodes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='text-muted-foreground py-8 text-center'
                >
                  {inviteCodesQuery.isLoading
                    ? t('Loading...')
                    : t('No invite codes')}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-between'>
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

      {selectedCodeId !== null ? (
        <div className='space-y-3 rounded-lg border p-4'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <h3 className='text-sm font-medium'>{t('Usage tracking')}</h3>
              <p className='text-muted-foreground text-sm'>
                {selectedInviteCode
                  ? `${t('Invite code')} #${selectedInviteCode.id} (${selectedInviteCode.code_prefix})`
                  : `${t('Invite code')} #${selectedCodeId}`}
              </p>
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setSelectedCodeId(null)}
            >
              {t('Close')}
            </Button>
          </div>
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
                  <TableCell>{formatTime(usage.used_time)}</TableCell>
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
      ) : null}
    </SettingsSection>
  )
}
