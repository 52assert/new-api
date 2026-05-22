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
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { addTimeToDate } from '@/lib/time'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { DateTimePicker } from '@/components/datetime-picker'
import { createInviteCodes, updateInviteCode } from '../api'
import { dateToTimestamp, timestampToDate } from '../lib'
import type { InviteCode } from '../types'
import { useInviteCodes } from './invite-codes-provider'

type InviteCodesMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: InviteCode
}

const INVITE_CODE_FORM_DEFAULT_VALUES = {
  count: 1,
  expired_time: undefined as Date | undefined,
  remark: '',
}

function getInviteCodeFormSchema(t: (key: string) => string) {
  return z.object({
    count: z
      .number()
      .int(t('Quantity must be an integer'))
      .min(1, t('Quantity must be between 1 and 100'))
      .max(100, t('Quantity must be between 1 and 100')),
    expired_time: z.date().optional(),
    remark: z.string().max(255, t('Remark must be 255 characters or less')),
  })
}

type InviteCodeFormValues = z.infer<ReturnType<typeof getInviteCodeFormSchema>>

export function InviteCodesMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: InviteCodesMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const { setOpen, setGeneratedCodes, triggerRefresh } = useInviteCodes()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formSchema = useMemo(() => getInviteCodeFormSchema(t), [t])

  const form = useForm<InviteCodeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: INVITE_CODE_FORM_DEFAULT_VALUES,
  })

  useEffect(() => {
    if (open && isUpdate && currentRow) {
      form.reset({
        count: 1,
        expired_time: timestampToDate(currentRow.expired_time),
        remark: currentRow.remark || '',
      })
    } else if (open && !isUpdate) {
      form.reset(INVITE_CODE_FORM_DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: InviteCodeFormValues) => {
    setIsSubmitting(true)
    try {
      const basePayload = {
        expired_time: dateToTimestamp(data.expired_time),
        remark: data.remark.trim(),
      }

      if (isUpdate && currentRow) {
        const result = await updateInviteCode({
          id: currentRow.id,
          ...basePayload,
        })
        if (result.success) {
          toast.success(t('Invite code updated'))
          onOpenChange(false)
          triggerRefresh()
        } else {
          toast.error(result.message || t('Failed to update invite code'))
        }
        return
      }

      const result = await createInviteCodes({
        count: data.count,
        ...basePayload,
      })
      if (result.success && result.data) {
        const generated = result.data.codes.map((code, index) => ({
          code,
          inviteCode: result.data?.inviteCodes?.[index] ?? null,
        }))
        setGeneratedCodes(generated)
        toast.success(
          generated.length > 1
            ? t('Successfully created {{count}} invite codes', {
                count: generated.length,
              })
            : t('Invite codes created')
        )
        triggerRefresh()
        setOpen('generated')
      } else {
        toast.error(result.message || t('Failed to create invite codes'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSetExpiry = (months: number, days: number, hours: number) => {
    const newDate = addTimeToDate(months, days, hours)
    form.setValue('expired_time', newDate)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) {
          form.reset(INVITE_CODE_FORM_DEFAULT_VALUES)
        }
      }}
    >
      <SheetContent className='flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px]'>
        <SheetHeader className='border-b px-4 py-3 text-start sm:px-6 sm:py-4'>
          <SheetTitle>
            {isUpdate ? t('Update Invite Code') : t('Create Invite Code')}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? t('Update the invite code by providing necessary info.')
              : t('Add new invite code(s) by providing necessary info.')}{' '}
            {t('Click save when you&apos;re done.')}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='invite-code-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex-1 space-y-4 overflow-y-auto px-3 py-3 pb-4 sm:space-y-6 sm:px-4'
          >
            {!isUpdate && (
              <FormField
                control={form.control}
                name='count'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Quantity')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type='number'
                        min='1'
                        max='100'
                        placeholder={t('Number of codes to create')}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value, 10) || 1)
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Create multiple invite codes at once (1-100)')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name='expired_time'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Expiration Time')}</FormLabel>
                  <div className='space-y-2'>
                    <FormControl>
                      <DateTimePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={t('Never expires')}
                      />
                    </FormControl>
                    <div className='grid grid-cols-4 gap-1.5 sm:flex sm:gap-2'>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => form.setValue('expired_time', undefined)}
                      >
                        {t('Never')}
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => handleSetExpiry(1, 0, 0)}
                      >
                        {t('1M')}
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => handleSetExpiry(0, 7, 0)}
                      >
                        {t('1W')}
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => handleSetExpiry(0, 1, 0)}
                      >
                        {t('1 Day')}
                      </Button>
                    </div>
                  </div>
                  <FormDescription>
                    {t('Leave empty for never expires')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='remark'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Remark')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t('Optional note')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <SheetFooter className='grid grid-cols-2 gap-2 border-t px-4 py-3 sm:flex sm:px-6 sm:py-4'>
          <SheetClose render={<Button variant='outline' />}>
            {t('Close')}
          </SheetClose>
          <Button form='invite-code-form' type='submit' disabled={isSubmitting}>
            {isSubmitting ? t('Saving...') : t('Save changes')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
