/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const insights = {
  'insights.tab': '最爱',
  'insights.loading': '正在加载会员观看的场景',
  'insights.period': '时段',
  'insights.period.week': '7 天',
  'insights.period.month': '30 天',
  'insights.period.quarter': '90 天',
  'insights.period.all': '全部时间',
  'insights.favourites.hint':
    '该时段内被播放、添加或点赞的每个场景，先按播放人数排序，再按屏幕显示时长排序。你自己的测试不计在内。',
  'insights.favourites.summary': '{scenes} 个场景，共播放 {time}',
  'insights.favourites.empty': '这个时段内没有场景被播放、添加或点赞。',
  'insights.favourites.kinds': '按类型统计的屏幕显示时长',
  'insights.favourites.noPlays': '这个时段内还没有任何播放。',
  'insights.favourites.advice':
    '{kind} 在 {count} 个场景中占了全部观看时长的 {share}。多做 {kind} 场景是最稳妥的选择。',
  'insights.col.rank': '排名',
  'insights.col.scene': '场景',
  'insights.col.people': '人数',
  'insights.col.time': '时长',
  'insights.col.perPerson': '人均',
  'insights.col.adds': '添加',
  'insights.col.likes': '赞',
  'insights.account.title': '场景',
  'insights.account.empty':
    '还没有添加、点赞或播放过场景。会员使用这个版本的 FluidEQ 并看过更新后的条款之后，才开始统计播放时长。',
  'insights.account.played': '播放过的场景',
  'insights.account.time': '屏幕显示',
  'insights.account.added': '已添加',
  'insights.account.liked': '已点赞',
  'insights.account.kind': '最爱类型',
  'insights.account.notPlayed': '未播放',
  'insights.account.days': '{days} 天 · 最近一次 {date}',
  'insights.by': '作者：{maker}',
  'insights.byFluidEQ': '作者：FluidEQ',
  'insights.member': '一位会员',
  'insights.chip.added': '{date} 添加',
  'insights.chip.liked': '已点赞',
  'insights.kind.other': '无分类',
  'insights.time.hoursMinutes': '{hours} {minutes}',
  'insights.error.offline': 'FluidEQ 无法连接到服务器。请检查网络连接后重试。',
  'insights.error.signedOut': '请重新登录后查看。',
  'insights.error.server': '无法加载。请重试。',
  'insights.error.forbidden': '只有 FluidEQ 管理员可以查看。',
  'insights.error.notDeployed':
    '服务器还没有这项功能。它会随与这个版本的 FluidEQ 配套的服务器更新一起到来。',
  'insights.server.tab': '服务器',
  'insights.server.loading': '正在测量服务器',
  'insights.server.plan': 'Supabase 免费计划',
  'insights.server.measured': '测量于 {time}',
  'insights.server.database': '数据库',
  'insights.server.files': '文件',
  'insights.server.active': '活跃账户（30 天）',
  'insights.server.activeNote': '共 {accounts} 个账户',
  'insights.server.of': '/ {limit}',
  'insights.server.used': '已用 {share}',
  'insights.server.requests': '请求（最近 7 天）',
  'insights.server.unlimited': '免费计划不限量',
  'insights.server.kind.rest': '数据库',
  'insights.server.kind.auth': '登录',
  'insights.server.kind.storage': '文件',
  'insights.server.kind.realtime': '实时',
  'insights.server.noToken': '请求数需要一个用量密钥。',
  'insights.server.tokenSteps':
    '在 supabase.com 的 Account → Access tokens 中创建访问令牌（如果可以选择，只勾选“read analytics usage”），然后在项目的 Edge Functions → Secrets 中以 USAGE_ACCESS_TOKEN 为名添加。',
  'insights.server.tokenRefused':
    'Supabase 拒绝了这个用量密钥。请新建一个，并以同样的名称重新保存。',
  'insights.server.tables': '最大的表',
  'insights.server.buckets': '按文件夹的文件',
  'insights.server.bucketFiles': '{count} 个文件',
  'insights.server.noFiles': '还没有保存任何文件。',
  'insights.server.egress': '发送的数据',
  'insights.server.egressBody':
    '免费计划每月包含 {limit}，通常这是最先用完的额度：成员下载的每个场景和每张图片都会计入。没有 API 提供这个数字；Supabase 在项目的 Usage 页面中显示。',
  'insights.server.openSupabase': '打开 Supabase',
  'insights.server.rules':
    '免费计划没有截止日期。超出某项额度会收到一封邮件并进入宽限期；如果持续超出，Supabase 会对请求返回“payment required”，直到下个月或升级计划。连续 {days} 天没有任何请求的项目会被暂停，而 FluidEQ 自身的流量可以防止这种情况。',
} as const;

export default insights;
