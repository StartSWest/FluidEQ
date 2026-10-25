/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.sent': '提交于 {date}',
  'review.reason.flashing': '闪光或频闪',
  'review.reason.rights': '他人的作品',
  'review.reason.offensive': '令人反感',
  'review.reason.broken': '无法运行或过于吃性能',
  'review.reason.other': '其他原因',
  'review.state.pending': '审核中',
  'review.state.pendingUpdate': '版本 {version} 审核中',
  'review.state.rejected': '未通过',
  'review.state.rejectedUpdate': '版本 {version} 未通过',
  'review.withdraw': '撤回',
  'review.withdrawConfirm': '从审核中撤回？',
  'review.remove': '移除',
  'review.removeConfirm': '从这个列表中移除？',
  'review.withdrawn': '已撤回 {name}。',
  'review.notice.approved': '{name} 已进入图库',
  'review.notice.approvedBody':
    '它已获批准。现在它在任何地方为你免费播放，任何人都可以获取它。',
  'review.notice.approvedUpdate': '{name} 的版本 {version} 已进入图库',
  'review.notice.approvedUpdateBody':
    '已审核通过。拥有这个场景的人都会获得新版本。',
  'review.notice.rejected': '{name} 未通过审核',
  'review.notice.rejectedUpdate': '{name} 的版本 {version} 未通过审核',
  'review.notice.keepsLive': '已拥有它的人保留版本 {version}。',
  'review.notice.gotIt': '知道了',
  'review.notice.openStudio': '打开工作室',
  'review.notice.openMine': '你的场景',
} as const;

export default review;
