/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const insights = {
  'insights.tab': 'お気に入り',
  'insights.loading': 'メンバーが手に入れたシーンを読み込み中',
  'insights.period': '期間',
  'insights.period.week': '7日間',
  'insights.period.month': '30日間',
  'insights.period.quarter': '90日間',
  'insights.period.all': '全期間',
  'insights.favourites.hint':
    '期間中に追加・いいねされたすべてのシーンを、追加の多い順、次にいいねの多い順に並べています。あなた自身の分は含まれません。',
  'insights.favourites.summary': '{scenes} 本のシーンが {adds} 回追加',
  'insights.favourites.empty':
    'この期間に追加・いいねされたシーンはありません。',
  'insights.favourites.kinds': '種類別の追加数',
  'insights.favourites.noAdds': 'この期間にはまだ何も追加されていません。',
  'insights.favourites.advice':
    '{kind} が {count} 本のシーンで全追加の {share} を占めています。{kind} のシーンを増やすのがいちばん確実です。',
  'insights.col.rank': '順位',
  'insights.col.scene': 'シーン',
  'insights.col.adds': '追加',
  'insights.col.likes': 'いいね',
  'insights.account.title': 'シーン',
  'insights.account.empty': 'まだ追加・いいねしたシーンはありません。',
  'insights.account.added': '追加',
  'insights.account.liked': 'いいね',
  'insights.account.kind': '好きな種類',
  'insights.by': '作者：{maker}',
  'insights.byFluidEQ': '作者：FluidEQ',
  'insights.member': 'メンバー',
  'insights.chip.added': '{date} に追加',
  'insights.chip.liked': 'いいね済み',
  'insights.chip.unpublished': '未公開',
  'insights.kind.other': 'カテゴリなし',
  'insights.error.offline':
    'FluidEQ がサーバーに接続できませんでした。接続を確認して、もう一度お試しください。',
  'insights.error.signedOut':
    'これを見るには、もう一度サインインしてください。',
  'insights.error.server': '読み込めませんでした。もう一度お試しください。',
  'insights.error.forbidden': 'これは FluidEQ の管理者だけが見られます。',
  'insights.error.notDeployed':
    'サーバーはまだこれに対応していません。このバージョンの FluidEQ に合わせたサーバー更新で対応します。',
  'insights.server.tab': 'サーバー',
  'insights.server.loading': 'サーバーを計測しています',
  'insights.server.plan': 'Supabase 無料プラン',
  'insights.server.measured': '{time} に計測',
  'insights.server.database': 'データベース',
  'insights.server.files': 'ファイル',
  'insights.server.active': 'アクティブなアカウント（30 日間）',
  'insights.server.activeNote': 'アカウント合計 {accounts}',
  'insights.server.of': '/ {limit}',
  'insights.server.used': '{share} 使用中',
  'insights.server.requests': 'リクエスト（過去 7 日間）',
  'insights.server.unlimited': '無料プランでは無制限',
  'insights.server.kind.rest': 'データベース',
  'insights.server.kind.auth': 'サインイン',
  'insights.server.kind.storage': 'ファイル',
  'insights.server.kind.realtime': 'ライブ',
  'insights.server.noToken':
    'このサーバーではリクエスト数の集計がオンになっていません。',
  'insights.server.tokenRefused':
    'サーバーがリクエスト数を読み取れませんでした。',
  'insights.server.tables': 'サイズの大きいテーブル',
  'insights.server.buckets': 'フォルダー別のファイル',
  'insights.server.bucketFiles': '{count} ファイル',
  'insights.server.noFiles': '保存されたファイルはまだありません。',
  'insights.server.egress': '送信データ',
  'insights.server.egressBody':
    '無料プランには月 {limit} が含まれ、たいていこれが最初に達する上限です。メンバーがダウンロードするシーンと画像がすべて数えられます。API では取得できず、Supabase がプロジェクトの Usage ページに表示します。',
  'insights.server.openSupabase': 'Supabase を開く',
  'insights.server.limit.warn': 'サーバーの容量が増えています',
  'insights.server.limit.full': 'サーバーがほぼ満杯です',
  'insights.server.limit.body':
    '{what}は Supabase 無料プランの {share} に達しています。満杯になる前にプロジェクトを有料プランに切り替えてください。そうしないと FluidEQ のオンライン機能が動かなくなります。',
  'insights.server.limit.database': 'データベース',
  'insights.server.limit.files': 'ファイル保存領域',
  'insights.server.limit.accounts': 'アクティブなアカウント',
  'insights.server.limit.later': '後で',
  'insights.server.limit.open': 'サーバーのページを開く',
  'insights.server.limit.badge': '無料プランの {share} を使用',
  'insights.server.rules':
    '無料プランに期限はありません。上限を超えるとメールが届いて猶予期間に入り、超過が続くと、翌月かアップグレードまで Supabase はリクエストに「payment required」と応答します。{days} 日間リクエストのないプロジェクトは一時停止されますが、FluidEQ 自体の通信がそれを防ぎます。',
} as const;

export default insights;
