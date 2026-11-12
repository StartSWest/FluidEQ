/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const review = {
  'review.sent': '已傳送 {date}',
  'review.reason.flashing': '閃爍或頻閃',
  'review.reason.rights': '別人的工作',
  'review.reason.offensive': '進攻性',
  'review.reason.broken': '破損或太重而無法演奏',
  'review.reason.other': '其他的東西',
  'review.state.pending': '審核中',
  'review.state.pendingUpdate': '{version} 版本正在審核中',
  'review.state.rejected': '未獲批准',
  'review.state.rejectedUpdate': '版本 {version} 未獲批准',
  'review.withdraw': '撤回',
  'review.withdrawConfirm': '撤回審查？',
  'review.remove': '移除',
  'review.removeConfirm': '將其從該清單中刪除嗎？',
  'review.withdrawn': '{name} 被撤回。',
  'review.notice.approved': '{name} 在畫廊中',
  'review.notice.approvedBody':
    '它被批准了。現在您可以在任何地方免費玩它，任何人都可以獲得它。',
  'review.notice.approvedUpdate': '{name} 的版本 {version} 在相簿中',
  'review.notice.approvedUpdateBody':
    '它被批准了。每個擁有該場景的人都會獲得新版本。',
  'review.notice.rejected': '{name} 未獲批准',
  'review.notice.rejectedUpdate': '{name} 版本 {version} 未獲批准',
  'review.notice.keepsLive': '每個擁有它的人都會保留版本 {version}。',
  'review.notice.blockAccount': '{count} 天內您不能將場景送審。',
  'review.notice.blockScene': '{count} 天內您不能再次將它送審。',
  'review.notice.gotIt': '明白了',
  'review.notice.openStudio': '開啟工作室',
  'review.notice.openMine': '你的場景',
  'review.next': '修改後重新發布。',
  'review.mark.rejected': '未獲准進入藝廊',
  'review.mark.rejectedOn': '{date} 未獲核准',
  'review.mark.show': '未獲核准：查看原因',
  'review.mark.pending': '等待審核',
} satisfies Partial<Dictionary>;

export default review;
