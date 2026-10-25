/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.sent': '{date} に送信',
  'review.reason.flashing': '点滅やストロボ',
  'review.reason.rights': '他人の作品',
  'review.reason.offensive': '不快な内容',
  'review.reason.broken': '動かない、または重すぎる',
  'review.reason.other': 'その他',
  'review.state.pending': '審査中',
  'review.state.pendingUpdate': 'バージョン {version} を審査中',
  'review.state.rejected': '承認されませんでした',
  'review.state.rejectedUpdate': 'バージョン {version} は承認されませんでした',
  'review.withdraw': '取り下げる',
  'review.withdrawConfirm': '審査から取り下げますか？',
  'review.remove': '削除',
  'review.removeConfirm': 'この一覧から削除しますか？',
  'review.withdrawn': '{name} を取り下げました。',
  'review.notice.approved': '{name} がギャラリーに公開されました',
  'review.notice.approvedBody':
    '承認されました。これからはどこでも無料であなたのために再生され、誰でも入手できます。',
  'review.notice.approvedUpdate':
    '{name} のバージョン {version} がギャラリーに公開されました',
  'review.notice.approvedUpdateBody':
    '承認されました。このシーンを持つ全員に新しいバージョンが届きます。',
  'review.notice.rejected': '{name} は承認されませんでした',
  'review.notice.rejectedUpdate':
    '{name} のバージョン {version} は承認されませんでした',
  'review.notice.keepsLive':
    'すでに持っている人はバージョン {version} のままです。',
  'review.notice.gotIt': 'OK',
  'review.notice.openStudio': 'スタジオを開く',
  'review.notice.openMine': 'あなたのシーン',
} as const;

export default review;
