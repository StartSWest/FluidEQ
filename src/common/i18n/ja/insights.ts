/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const insights = {
  'insights.tab': 'お気に入り',
  'insights.loading': 'メンバーが見ているシーンを読み込み中',
  'insights.period': '期間',
  'insights.period.week': '7日間',
  'insights.period.month': '30日間',
  'insights.period.quarter': '90日間',
  'insights.period.all': '全期間',
  'insights.favourites.hint':
    '期間中に再生・追加・いいねされたすべてのシーンを、再生した人数の多い順、次に画面に表示された時間の長い順に並べています。あなた自身のテストは含まれません。',
  'insights.favourites.summary': '{scenes} 本のシーンを {time} 再生',
  'insights.favourites.empty':
    'この期間に再生・追加・いいねされたシーンはありません。',
  'insights.favourites.kinds': '種類別の表示時間',
  'insights.favourites.noPlays': 'この期間にはまだ何も再生されていません。',
  'insights.favourites.advice':
    '{kind} が {count} 本のシーンで全視聴時間の {share} を占めています。{kind} のシーンを増やすのがいちばん確実です。',
  'insights.col.rank': '順位',
  'insights.col.scene': 'シーン',
  'insights.col.people': '人数',
  'insights.col.time': '時間',
  'insights.col.perPerson': '1人あたり',
  'insights.col.adds': '追加',
  'insights.col.likes': 'いいね',
  'insights.account.title': 'シーン',
  'insights.account.empty':
    'まだ追加・いいね・再生したシーンはありません。再生時間は、そのメンバーがこのバージョンの FluidEQ を使い、更新された利用規約を確認した時点から数えられます。',
  'insights.account.played': '再生したシーン',
  'insights.account.time': '表示時間',
  'insights.account.added': '追加',
  'insights.account.liked': 'いいね',
  'insights.account.kind': '好きな種類',
  'insights.account.notPlayed': '未再生',
  'insights.account.days': '{days} 日 · 最終 {date}',
  'insights.by': '作者：{maker}',
  'insights.byFluidEQ': '作者：FluidEQ',
  'insights.member': 'メンバー',
  'insights.chip.added': '{date} に追加',
  'insights.chip.liked': 'いいね済み',
  'insights.kind.other': 'カテゴリなし',
  'insights.time.underMinute': '1分未満',
  'insights.time.hoursMinutes': '{hours} {minutes}',
  'insights.error.offline':
    'FluidEQ がサーバーに接続できませんでした。接続を確認して、もう一度お試しください。',
  'insights.error.signedOut':
    'これを見るには、もう一度サインインしてください。',
  'insights.error.server': '読み込めませんでした。もう一度お試しください。',
  'insights.error.forbidden': 'これは FluidEQ の管理者だけが見られます。',
  'insights.error.notDeployed':
    'サーバーはまだこれに対応していません。このバージョンの FluidEQ に合わせたサーバー更新で対応します。',
} as const;

export default insights;
