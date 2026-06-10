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
import { CalendarCheck, EyeOff, Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAnnouncementColorClass } from '@/lib/colors'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Markdown } from '@/components/ui/markdown'
import { ScrollArea } from '@/components/ui/scroll-area'

type AnnouncementRecord = Record<string, unknown>

interface ForcedAnnouncementDialogProps {
  announcement: AnnouncementRecord | null
  onReadToday: () => void
  onDismissPermanently: () => void
}

function getStringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function getPublishDate(value: unknown): Date | null {
  if (!value) return null
  const date = new Date(value as string | number | Date)
  return Number.isNaN(date.getTime()) ? null : date
}

export function ForcedAnnouncementDialog({
  announcement,
  onReadToday,
  onDismissPermanently,
}: ForcedAnnouncementDialogProps) {
  const { t } = useTranslation()
  const content = getStringValue(announcement?.content).trim()
  const extra = getStringValue(announcement?.extra).trim()
  const type = getStringValue(announcement?.type)
  const publishDate = getPublishDate(announcement?.publishDate)

  if (!announcement || !content) return null

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        showCloseButton={false}
        className='max-h-[min(90vh,42rem)] gap-0 overflow-hidden p-0 sm:max-w-xl'
      >
        <DialogHeader className='gap-3 border-b px-5 py-4'>
          <div className='flex items-start gap-3'>
            <div
              className={cn(
                'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-white',
                getAnnouncementColorClass(type)
              )}
            >
              <Megaphone className='size-4' />
            </div>
            <div className='min-w-0 flex-1'>
              <DialogTitle>{t('System Announcement')}</DialogTitle>
              <DialogDescription className='mt-1'>
                {publishDate
                  ? `${t('Published:')} ${formatDateTimeObject(publishDate)}`
                  : t('Latest platform updates and notices')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className='max-h-[min(56vh,28rem)] px-5 py-4'>
          <Markdown>{content}</Markdown>
          {extra ? (
            <div className='bg-muted/40 text-muted-foreground mt-4 rounded-lg border px-3 py-2 text-sm'>
              <Markdown>{extra}</Markdown>
            </div>
          ) : null}
        </ScrollArea>

        <DialogFooter className='flex-col-reverse gap-2 sm:flex-row sm:justify-between'>
          <Button variant='outline' onClick={onDismissPermanently}>
            <EyeOff className='size-4' />
            {t('Do not remind again')}
          </Button>
          <Button onClick={onReadToday}>
            <CalendarCheck className='size-4' />
            {t('Read for today')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
