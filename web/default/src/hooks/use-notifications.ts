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
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNotificationStore } from '@/stores/notification-store'
import { getNotice } from '@/lib/api'
import { useStatus } from '@/hooks/use-status'

function hashString(input: string): string {
  let hash = 0
  if (!input) return '0'

  for (let i = 0; i < input.length; i += 1) {
    const chr = input.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0
  }

  return hash.toString(36)
}

/**
 * Generate a unique key for an announcement
 * Include both id and content fingerprint so edits register as a new notice.
 */
function getAnnouncementKey(item: Record<string, unknown>): string {
  if (!item) return ''

  const fingerprint = JSON.stringify({
    publishDate: (item?.publishDate as string) || '',
    content: ((item?.content as string) || '').trim(),
    extra: ((item?.extra as string) || '').trim(),
    type: (item?.type as string) || '',
    title: ((item?.title as string) || '').trim(),
    link: ((item?.link as string) || '').trim(),
  })
  const hash = hashString(fingerprint)
  if (item.id !== undefined && item.id !== null) {
    return `id:${item.id}:${hash}`
  }
  return `hash:${hash}`
}

function getTodayKey(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Hook to manage notifications (Notice + Announcements)
 * Provides unread counts and read status management
 */
export function useNotifications() {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'notice' | 'announcements'>(
    'notice'
  )

  // Fetch Notice from API
  const {
    data: noticeResponse,
    isLoading: noticeLoading,
    refetch: refetchNotice,
  } = useQuery({
    queryKey: ['notice'],
    queryFn: getNotice,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Fetch Announcements from status
  const { status, loading: statusLoading } = useStatus()
  const announcementsEnabled = status?.announcements_enabled ?? false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const announcements: Record<string, unknown>[] = announcementsEnabled
    ? ((status?.announcements || []) as Record<string, unknown>[]).slice(0, 20)
    : []

  // Notification store
  const {
    lastReadNotice,
    markNoticeRead,
    markAnnouncementsRead,
    markAnnouncementReadToday,
    isAnnouncementRead,
    isAnnouncementReadToday,
  } = useNotificationStore()

  // Extract notice content
  const noticeContent = noticeResponse?.success
    ? (noticeResponse.data || '').trim()
    : ''

  const todayKey = getTodayKey()

  // Calculate unread counts
  const unreadCounts = useMemo(() => {
    const noticeUnread =
      noticeContent && noticeContent !== lastReadNotice ? 1 : 0

    const announcementsUnread = announcements.filter(
      (item: Record<string, unknown>) => {
        const key = getAnnouncementKey(item)
        return (
          !isAnnouncementRead(key) && !isAnnouncementReadToday(key, todayKey)
        )
      }
    ).length

    return {
      notice: noticeUnread,
      announcements: announcementsUnread,
      total: noticeUnread + announcementsUnread,
    }
  }, [
    noticeContent,
    lastReadNotice,
    announcements,
    isAnnouncementRead,
    isAnnouncementReadToday,
    todayKey,
  ])

  const markAnnouncementsAsRead = () => {
    if (announcements.length > 0) {
      const allKeys = announcements.map((item: Record<string, unknown>) =>
        getAnnouncementKey(item)
      )
      markAnnouncementsRead(allKeys)
    }
  }

  const forcedAnnouncement = useMemo(() => {
    return (
      announcements.find((item: Record<string, unknown>) => {
        const key = getAnnouncementKey(item)
        return (
          !isAnnouncementRead(key) && !isAnnouncementReadToday(key, todayKey)
        )
      }) || null
    )
  }, [announcements, isAnnouncementRead, isAnnouncementReadToday, todayKey])

  const forcedAnnouncementKey = forcedAnnouncement
    ? getAnnouncementKey(forcedAnnouncement)
    : ''

  const markForcedAnnouncementReadToday = () => {
    if (!forcedAnnouncementKey) return
    markAnnouncementReadToday(forcedAnnouncementKey, todayKey)
  }

  const dismissForcedAnnouncementPermanently = () => {
    if (!forcedAnnouncementKey) return
    markAnnouncementsRead([forcedAnnouncementKey])
  }

  // Handle popover open
  const handleOpenPopover = (tab?: 'notice' | 'announcements') => {
    const nextTab = tab || activeTab

    // Mark currently visible content as read when opening the notification center
    if (noticeContent) {
      markNoticeRead(noticeContent)
    }
    if (nextTab === 'announcements') {
      markAnnouncementsAsRead()
    }

    setActiveTab(nextTab)
    setPopoverOpen(true)
  }

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      handleOpenPopover(activeTab)
      return
    }

    setPopoverOpen(false)
  }

  // Handle tab change - mark announcements as read when switching to that tab
  const handleTabChange = (tab: 'notice' | 'announcements') => {
    setActiveTab(tab)

    if (tab === 'announcements') {
      markAnnouncementsAsRead()
    }
  }

  return {
    // Data
    notice: noticeContent,
    announcements,
    forcedAnnouncement,
    forcedAnnouncementKey,
    loading: noticeLoading || statusLoading,

    // Unread counts
    unreadCount: unreadCounts.total,
    unreadNoticeCount: unreadCounts.notice,
    unreadAnnouncementsCount: unreadCounts.announcements,

    // Popover state
    popoverOpen,
    setPopoverOpen: handlePopoverOpenChange,
    activeTab,
    setActiveTab: handleTabChange,

    // Actions
    openPopover: handleOpenPopover,
    closePopover: () => setPopoverOpen(false),
    markForcedAnnouncementReadToday,
    dismissForcedAnnouncementPermanently,
    refetchNotice,
  }
}

export { getAnnouncementKey }
