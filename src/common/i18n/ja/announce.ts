/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const announce = {
  'announce.eyebrow': 'ビジュアライザーの新着 · {count} シーン',
  'announce.try': '今すぐ試す',
  'announce.later': 'あとで',
  'announce.previewNote':
    'プレビューです。何も送信されず、何も記録されていません。',
  'announce.untitled': '新しいシーン',
  'announce.tab': 'お知らせ',
  'announce.pageHint':
    'お知らせは、開いている画面の上に大きく、1人につき1回だけ表示されます。無料体験が2日以内に終わるメンバーには、Plus を続ける案内も1行表示されます。',
  'announce.field.title': 'タイトル',
  'announce.field.titlePlaceholder': '例：ナイトドライブ',
  'announce.field.body': '内容',
  'announce.field.bodyPlaceholder':
    '例：低音と高音に合わせて動く、夜の街の新しいシーン6本。',
  'announce.field.scenes':
    '含めるシーン：{count} / {most}。最初のシーンが大きな枠になります。',
  'announce.field.noScenes':
    'FluidEQ のシーンがまだ読み込まれていません。一度ビジュアライザーを開いてから戻ってください。',
  'announce.field.when': '公開日時',
  'announce.field.audience': '表示する相手',
  'announce.audience.everyone': 'サインインしている全員',
  'announce.audience.everyoneLine':
    'Plus メンバー、無料体験中の人、無料アカウント。無料アカウントは、シーンを試せるようビジュアライザーに案内されます。',
  'announce.audience.members': 'Plus メンバーと無料体験中の人',
  'announce.audience.membersLine': '今すぐシーンを再生できる全員。',
  'announce.audience.trialEnding': '2日以内に終わる無料体験のみ',
  'announce.audience.trialEndingLine':
    '支払うかどうかをまもなく決めるメンバー。',
  'announce.trials.dayAfter':
    '翌日の {date} に {count} 件の無料体験が終了します。',
  'announce.trials.twoAfter': 'その翌日にさらに {count} 件。',
  'announce.preview': 'プレビュー',
  'announce.schedule': '予約する',
  'announce.saveChanges': '変更を保存',
  'announce.stopEditing': '編集をやめる',
  'announce.done': '予約しました。{date} に公開されます。',
  'announce.listTitle': '予約中と表示中',
  'announce.listEmpty': '予約はありません。',
  'announce.state.out': '表示中',
  'announce.state.later': '予約中',
  'announce.edit': '編集',
  'announce.cancel': '取り消す',
  'announce.cancelAsk': 'このお知らせを取り消しますか？',
  'announce.cancelOut': 'まだ見ていない人への表示をやめますか？',
  'announce.keep': '残す',
} as const;

export default announce;
