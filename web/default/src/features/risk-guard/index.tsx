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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  CheckCircle2,
  RefreshCw,
  Save,
  Shield,
  ShieldOff,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SectionPageLayout } from '@/components/layout'
import {
  blockRiskGuardIp,
  getRiskGuardStats,
  syncRiskGuardCloudflare,
  unblockRiskGuardIp,
  updateRiskGuardConfig,
} from './api'
import type { RiskGuardConfig, RiskGuardIPStats } from './types'

const queryKey = ['risk-guard', 'stats'] as const

type ConfigForm = {
  enabled: boolean
  auto_enabled: boolean
  responses_threshold_per_min: number
  stats_window_seconds: number
  retention_seconds: number
  auto_cooldown_seconds: number
  cf_zone_id: string
  cf_ruleset_id: string
  cf_rule_id: string
  cf_rule_description: string
  cf_auth_token: string
  use_cf_connecting_ip: boolean
}

function toForm(config: RiskGuardConfig): ConfigForm {
  return {
    enabled: config.enabled,
    auto_enabled: config.auto_enabled,
    responses_threshold_per_min: config.responses_threshold_per_min,
    stats_window_seconds: config.stats_window_seconds,
    retention_seconds: config.retention_seconds,
    auto_cooldown_seconds: config.auto_cooldown_seconds,
    cf_zone_id: config.cf_zone_id || '',
    cf_ruleset_id: config.cf_ruleset_id || '',
    cf_rule_id: config.cf_rule_id || '',
    cf_rule_description: config.cf_rule_description || 'ip限制',
    cf_auth_token: '',
    use_cf_connecting_ip: config.use_cf_connecting_ip,
  }
}

function metricValue(value: number | string) {
  return value === '' ? '-' : value
}

function statusVariant(status: string) {
  const code = Number(status)
  if (code >= 500) return 'destructive'
  if (code >= 400) return 'secondary'
  return 'outline'
}

function IpActions({
  row,
  onBlock,
  onUnblock,
  busy,
}: {
  row: Pick<RiskGuardIPStats, 'ip' | 'blocked'>
  onBlock: (ip: string) => void
  onUnblock: (ip: string) => void
  busy: boolean
}) {
  return row.blocked ? (
    <Button
      type='button'
      size='sm'
      variant='outline'
      disabled={busy}
      onClick={() => onUnblock(row.ip)}
    >
      <ShieldOff />
      解封
    </Button>
  ) : (
    <Button
      type='button'
      size='sm'
      variant='destructive'
      disabled={busy}
      onClick={() => onBlock(row.ip)}
    >
      <Ban />
      封禁
    </Button>
  )
}

export function RiskGuard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ConfigForm | null>(null)
  const [manualIp, setManualIp] = useState('')

  const { data, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: getRiskGuardStats,
    refetchInterval: 5000,
  })

  const stats = data?.data
  const config = stats?.config
  const topIps = stats?.top_ips ?? []
  const blockedIps = stats?.blocked_ips ?? []
  const audit = stats?.audit ?? []

  useEffect(() => {
    if (config && !form) {
      setForm(toForm(config))
    }
  }, [config, form])

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey,
    })

  const saveConfig = useMutation({
    mutationFn: updateRiskGuardConfig,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Request failed'))
        return
      }
      toast.success(t('Saved successfully'))
      if (res.data)
        setForm((prev) => ({
          ...toForm(res.data!),
          cf_auth_token: prev?.cf_auth_token || '',
        }))
      invalidate()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('Request failed'))
    },
  })

  const blockMutation = useMutation({
    mutationFn: blockRiskGuardIp,
    onSuccess: (res) => {
      if (!res.success) {
        invalidate()
        toast.error(res.message || t('Request failed'))
        return
      }
      toast.success(res.data?.message || '已封禁')
      setManualIp('')
      invalidate()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('Request failed'))
    },
  })

  const unblockMutation = useMutation({
    mutationFn: unblockRiskGuardIp,
    onSuccess: (res) => {
      if (!res.success) {
        invalidate()
        toast.error(res.message || t('Request failed'))
        return
      }
      toast.success(res.data?.message || '已解封')
      invalidate()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('Request failed'))
    },
  })

  const syncMutation = useMutation({
    mutationFn: syncRiskGuardCloudflare,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Request failed'))
        return
      }
      toast.success(res.data?.message || 'Cloudflare 已同步')
      invalidate()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('Request failed'))
    },
  })

  const topResponses = useMemo(
    () => topIps.find((item) => item.responses > 0),
    [topIps]
  )

  const busy = blockMutation.isPending || unblockMutation.isPending

  const setField = <K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))

  const handleSave = () => {
    if (!form) return
    saveConfig.mutate({
      enabled: form.enabled,
      auto_enabled: form.auto_enabled,
      responses_threshold_per_min: Number(form.responses_threshold_per_min),
      stats_window_seconds: Number(form.stats_window_seconds),
      retention_seconds: Number(form.retention_seconds),
      auto_cooldown_seconds: Number(form.auto_cooldown_seconds),
      use_cf_connecting_ip: form.use_cf_connecting_ip,
    })
  }

  const handleSaveCloudflare = () => {
    if (!form) return
    saveConfig.mutate({
      cf_zone_id: form.cf_zone_id.trim(),
      cf_ruleset_id: form.cf_ruleset_id.trim(),
      cf_rule_id: form.cf_rule_id.trim(),
      cf_rule_description: form.cf_rule_description.trim() || 'ip限制',
      ...(form.cf_auth_token.trim()
        ? { cf_auth_token: form.cf_auth_token.trim() }
        : {}),
    })
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>风控</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          type='button'
          variant='outline'
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={isFetching ? 'animate-spin' : ''} />
          刷新
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          <div className='grid gap-3 md:grid-cols-4'>
            <Card size='sm'>
              <CardHeader>
                <CardDescription>成功 Responses RPM</CardDescription>
                <CardTitle className='text-2xl'>
                  {metricValue(stats?.rpm ?? '-')}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card size='sm'>
              <CardHeader>
                <CardDescription>Top IP</CardDescription>
                <CardTitle className='truncate text-2xl'>
                  {topResponses
                    ? `${topResponses.ip} / ${topResponses.responses}`
                    : '-'}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card size='sm'>
              <CardHeader>
                <CardDescription>自动阈值</CardDescription>
                <CardTitle className='text-2xl'>
                  {config ? `${config.responses_threshold_per_min}/min` : '-'}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card size='sm'>
              <CardHeader>
                <CardDescription>托管封禁</CardDescription>
                <CardTitle className='text-2xl'>
                  {metricValue(blockedIps.length)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {!config?.cf_ready && (
            <Alert>
              <AlertDescription>
                Cloudflare Token 未配置，自动和手动封禁会记录 IP，但无法同步
                WAF。
              </AlertDescription>
            </Alert>
          )}

          <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]'>
            <Card>
              <CardHeader>
                <CardTitle>IP 流量排行</CardTitle>
                <CardDescription>
                  最近 {stats?.window_seconds ?? 60} 秒，只统计 HTTP 200 的 POST
                  /v1/responses 作为 RPM。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table className='min-w-[860px]'>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-[180px]'>IP</TableHead>
                      <TableHead className='w-[88px] text-right'>
                        200 响应
                      </TableHead>
                      <TableHead className='w-[76px] text-right'>
                        Total
                      </TableHead>
                      <TableHead className='w-[76px] text-right'>
                        错误
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Top paths</TableHead>
                      <TableHead className='w-[96px] text-right'>
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topIps.length ? (
                      topIps.map((row) => (
                        <TableRow key={row.ip}>
                          <TableCell>
                            <div className='flex flex-wrap items-center gap-2'>
                              <span className='font-mono font-medium'>
                                {row.ip}
                              </span>
                              {row.blocked && (
                                <Badge variant='destructive'>已封禁</Badge>
                              )}
                            </div>
                            <div className='text-muted-foreground mt-1 text-xs'>
                              {row.last_seen_age} ago
                            </div>
                          </TableCell>
                          <TableCell className='text-right'>
                            {row.responses}
                          </TableCell>
                          <TableCell className='text-right'>
                            {row.total}
                          </TableCell>
                          <TableCell className='text-right'>
                            {row.errors}
                          </TableCell>
                          <TableCell>
                            <div className='flex flex-wrap gap-1'>
                              {Object.entries(row.status).map(
                                ([status, count]) => (
                                  <Badge
                                    key={status}
                                    variant={statusVariant(status)}
                                  >
                                    {status} {count}
                                  </Badge>
                                )
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='flex max-w-[360px] flex-wrap gap-1'>
                              {Object.entries(row.paths).map(
                                ([path, count]) => (
                                  <Badge key={path} variant='outline'>
                                    <span className='max-w-[220px] truncate font-mono'>
                                      {path}
                                    </span>
                                    {count}
                                  </Badge>
                                )
                              )}
                            </div>
                          </TableCell>
                          <TableCell className='text-right'>
                            <IpActions
                              row={row}
                              busy={busy}
                              onBlock={(ip) => blockMutation.mutate(ip)}
                              onUnblock={(ip) => unblockMutation.mutate(ip)}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className='text-muted-foreground h-24 text-center'
                        >
                          暂无 POST /v1/responses 流量
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className='space-y-4'>
              <Card>
                <CardHeader>
                  <CardTitle>自动风控</CardTitle>
                  <CardDescription>
                    超过阈值后自动写入 Cloudflare WAF。
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='grid grid-cols-2 gap-3'>
                    <Label className='justify-between rounded-lg border p-3'>
                      <span>启用风控</span>
                      <Switch
                        checked={Boolean(form?.enabled)}
                        onCheckedChange={(checked) =>
                          setField('enabled', checked)
                        }
                      />
                    </Label>
                    <Label className='justify-between rounded-lg border p-3'>
                      <span>自动封禁</span>
                      <Switch
                        checked={Boolean(form?.auto_enabled)}
                        onCheckedChange={(checked) =>
                          setField('auto_enabled', checked)
                        }
                      />
                    </Label>
                  </div>
                  <div className='grid grid-cols-2 gap-3'>
                    <div className='space-y-1.5'>
                      <Label>单 IP 每分钟阈值</Label>
                      <Input
                        type='number'
                        min={1}
                        value={form?.responses_threshold_per_min ?? 200}
                        onChange={(event) =>
                          setField(
                            'responses_threshold_per_min',
                            Number(event.target.value)
                          )
                        }
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>统计窗口秒数</Label>
                      <Input
                        type='number'
                        min={10}
                        max={600}
                        value={form?.stats_window_seconds ?? 60}
                        onChange={(event) =>
                          setField(
                            'stats_window_seconds',
                            Number(event.target.value)
                          )
                        }
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>保留秒数</Label>
                      <Input
                        type='number'
                        min={120}
                        value={form?.retention_seconds ?? 900}
                        onChange={(event) =>
                          setField(
                            'retention_seconds',
                            Number(event.target.value)
                          )
                        }
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>冷却秒数</Label>
                      <Input
                        type='number'
                        min={0}
                        value={form?.auto_cooldown_seconds ?? 900}
                        onChange={(event) =>
                          setField(
                            'auto_cooldown_seconds',
                            Number(event.target.value)
                          )
                        }
                      />
                    </div>
                  </div>
                  <Label className='justify-between rounded-lg border p-3'>
                    <span>使用 CF-Connecting-IP</span>
                    <Switch
                      checked={Boolean(form?.use_cf_connecting_ip)}
                      onCheckedChange={(checked) =>
                        setField('use_cf_connecting_ip', checked)
                      }
                    />
                  </Label>
                  <Button
                    type='button'
                    className='w-full'
                    onClick={handleSave}
                    disabled={saveConfig.isPending || !form}
                  >
                    <Save />
                    保存风控配置
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>手动封禁</CardTitle>
                  <CardDescription>
                    立即同步到托管的 Cloudflare WAF 规则。
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex gap-2'>
                    <Input
                      value={manualIp}
                      onChange={(event) => setManualIp(event.target.value)}
                      placeholder='IP 地址'
                    />
                    <Button
                      type='button'
                      disabled={!manualIp.trim() || busy}
                      onClick={() => blockMutation.mutate(manualIp.trim())}
                    >
                      <Ban />
                      封禁
                    </Button>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    {blockedIps.length ? (
                      blockedIps.map((ip) => (
                        <Badge key={ip} variant='outline' className='h-7 gap-2'>
                          <span className='font-mono'>{ip}</span>
                          <button
                            type='button'
                            className='text-destructive hover:underline'
                            disabled={busy}
                            onClick={() => unblockMutation.mutate(ip)}
                          >
                            解封
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className='text-muted-foreground text-sm'>
                        暂无托管封禁 IP
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cloudflare</CardTitle>
                  <CardDescription>
                    Token 只写入后端，不会从接口回显。
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='grid gap-3'>
                    <Input
                      value={form?.cf_auth_token ?? ''}
                      type='password'
                      placeholder={
                        config?.cf_ready
                          ? 'Token 已配置，留空不修改'
                          : 'Cloudflare API Token'
                      }
                      onChange={(event) =>
                        setField('cf_auth_token', event.target.value)
                      }
                    />
                    <Input
                      value={form?.cf_zone_id ?? ''}
                      placeholder='Zone ID'
                      onChange={(event) =>
                        setField('cf_zone_id', event.target.value)
                      }
                    />
                    <Input
                      value={form?.cf_ruleset_id ?? ''}
                      placeholder='Ruleset ID'
                      onChange={(event) =>
                        setField('cf_ruleset_id', event.target.value)
                      }
                    />
                    <Input
                      value={form?.cf_rule_id ?? ''}
                      placeholder='Rule ID'
                      onChange={(event) =>
                        setField('cf_rule_id', event.target.value)
                      }
                    />
                    <Input
                      value={form?.cf_rule_description ?? ''}
                      placeholder='规则描述'
                      onChange={(event) =>
                        setField('cf_rule_description', event.target.value)
                      }
                    />
                  </div>
                  <div className='grid grid-cols-2 gap-2'>
                    <Button
                      type='button'
                      variant='outline'
                      disabled={saveConfig.isPending || !form}
                      onClick={handleSaveCloudflare}
                    >
                      <Shield />
                      保存
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      disabled={syncMutation.isPending}
                      onClick={() => syncMutation.mutate()}
                    >
                      <CheckCircle2 />
                      同步
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>最近操作</CardTitle>
                </CardHeader>
                <CardContent className='max-h-72 space-y-2 overflow-auto'>
                  {audit.length ? (
                    audit.map((item, index) => (
                      <div
                        key={`${item.t}-${index}`}
                        className='border-border border-l-2 py-1 pl-3 text-sm'
                      >
                        <div className='flex items-center gap-2'>
                          <Badge variant={item.ok ? 'outline' : 'destructive'}>
                            {item.action}
                          </Badge>
                          {item.ip && (
                            <span className='font-mono'>{item.ip}</span>
                          )}
                        </div>
                        <p className='text-muted-foreground mt-1 break-words'>
                          {item.message}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className='text-muted-foreground text-sm'>
                      暂无操作记录
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
