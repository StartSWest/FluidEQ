/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.tab': '承認待ち',
  'review.tabCount': '承認待ち：{count}',
  'review.badge': 'あなたの対応待ち：{count}',
  'review.hint':
    'メンバーが公開するシーンと、その新しいバージョンは、あなたが承認するまでここで待ちます。それまでは他の誰にも見えません。',
  'review.empty.title': '待っているものはありません',
  'review.empty.hint':
    'メンバーが新しいシーンや新しいバージョンを公開すると、ここに表示されます。',
  'review.kind.new': '新しいシーン',
  'review.kind.update': '更新 · v{from} → v{to}',
  'review.sent': '{date} に送信',
  'review.open': '確認する',
  'review.back': '待っているものすべて',
  'review.flag.takenDown': 'ギャラリーから取り下げ済み',
  'review.flag.takenDownHint':
    'ギャラリーから取り下げ済み：新しいバージョンを承認するには、「報告済み」で復元してください',
  'review.flag.reports': '公開中のバージョンへの未対応の報告：{count}',
  'review.note.title': '作者による新しい点',
  'review.note.none': '作者はこのバージョンについて何も書いていません。',
  'review.sceneFailed': 'このシーンを開いて見ることができませんでした。',
  'review.changed':
    '見ている間にシーンが変わりました。作者が新しいバージョンを送ったか、取り下げました。一覧に現在の待機分が表示されています。',
  'review.approve': '承認して公開',
  'review.approving': '承認中…',
  'review.reject': '承認しない',
  'review.reject.title': '承認しない理由は？',
  'review.reject.lead':
    '作者には理由と、書いた場合はあなたのひと言が届きます。',
  'review.reject.noteLabel': '作者へのひと言（任意）',
  'review.reject.notePlaceholder': '例：ドロップの白いフラッシュが強すぎます',
  'review.reject.cancel': '戻る',
  'review.reject.send': '回答を送信',
  'review.reject.sending': '送信中…',
  'review.reason.flashing': '点滅やストロボ',
  'review.reason.rights': '他人の作品',
  'review.reason.offensive': '不快な内容',
  'review.reason.broken': '動かない、または重すぎる',
  'review.reason.other': 'その他',
  'review.done.approved': '{name} がギャラリーに公開されました。',
  'review.done.rejected':
    '{name} は承認されませんでした。理由は作者に届きます。',
  'review.failed': '回答を送れませんでした。もう一度お試しください。',
  'review.versionRaised':
    'ギャラリーにはすでにこのバージョンか、より新しいバージョンがあります。',
  'review.takenDown':
    'その間に取り下げられたため、新しいバージョンは受け付けられません。先に「報告済み」で復元してください。',
  'review.deleted':
    '完全に削除されたため、新しいバージョンは受け付けられません。',
  'review.filesFailed':
    '承認されましたが、ファイルがギャラリーに届きませんでした。もう一度「承認して公開」を押して完了してください。',
  'review.forbidden': 'シーンを承認できるのは FluidEQ の管理者だけです。',
  'review.fine.new':
    '承認するとバージョン {version} としてギャラリーに公開され、サインインしている全員が見られ、Plus メンバーが追加できます。',
  'review.fine.update':
    '承認すると、このシーンを持つ全員のバージョン {version} が置き換わります。承認しなければバージョン {version} のままです。',
  'review.state.pending': '審査中',
  'review.state.pendingUpdate': 'バージョン {version} を審査中',
  'review.state.rejected': '承認されませんでした',
  'review.state.rejectedUpdate': 'バージョン {version} は承認されませんでした',
  'review.withdraw': '取り下げる',
  'review.withdrawConfirm': '審査から取り下げますか？',
  'review.remove': '削除',
  'review.removeConfirm': 'この一覧から削除しますか？',
  'review.withdrawn': '{name} を取り下げました。',
  'review.notice.waitingOne': 'シーンがあなたの承認を待っています',
  'review.notice.waitingMany': '{count} 件のシーンがあなたの承認を待っています',
  'review.notice.waitingWho': '{name}（作者：{maker}）',
  'review.notice.waitingNewest': '最新：{name}（作者：{maker}）',
  'review.notice.later': 'あとで',
  'review.notice.review': '今すぐ確認',
  'review.notice.approved': '{name} がギャラリーに公開されました',
  'review.notice.approvedBody':
    '承認されました。Plus メンバーが追加できるようになりました。',
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
  'review.notice.openStudio': 'Studio を開く',
  'review.notice.openMine': 'あなたのシーン',
} as const;

export default review;
