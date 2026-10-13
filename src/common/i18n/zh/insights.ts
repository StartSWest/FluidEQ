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
} as const;

export default insights;
