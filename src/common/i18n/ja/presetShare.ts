/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Sharing the listener's own presets. See `en/presetShare.ts`. */
export default {
  'presetShare.share': '{name} を共有',
  'presetShare.menu.community': 'コミュニティに共有…',
  'presetShare.menu.copyLink': '共有リンクをコピー',
  'presetShare.menu.export': 'エクスポート…',
  'presetShare.linkCopied': '共有リンクをコピーしました',
  'presetShare.linkMaking': 'リンクを作成しています…',
  'presetShare.linkFailed.signedOut': 'リンクを作るにはサインインしてください',
  'presetShare.linkFailed.suspended': 'このアカウントは今は共有できません',
  'presetShare.linkFailed.rateLimited': 'この 1 時間のリンクが多すぎます',
  'presetShare.linkFailed.tooMany': 'リンクの上限に達しました',
  'presetShare.linkFailed.takenDown': 'このリンクは削除されました',
  'presetShare.linkFailed.offline': 'FluidEQ のサーバーが応答しません',

  'presetShare.text.title': '{name} · FluidEQ プリセット',
  'presetShare.text.curve': 'カーブ: {count} バンド',
  'presetShare.text.rack': 'ラック: {stages}',
  'presetShare.text.open': 'FluidEQ で開く',

  'presetShare.chip.curve': 'カーブ · {count} バンド',
  'presetShare.chip.flat': '変更なし',

  'presetShare.export.title': '{name} をエクスポート',
  'presetShare.export.hint':
    'カーブとラックのすべての段を含みます。ノーマライザーとルームの頭は含まれず、あなたのもののままです。',
  'presetShare.export.tab.forum': 'どのフォーラムにも',
  'presetShare.export.tab.file': 'ファイル',
  'presetShare.export.tab.apo': 'Equalizer APO',
  'presetShare.format.markdown': 'Markdown',
  'presetShare.format.markdownFor': 'Reddit、Discord、GitHub',
  'presetShare.format.bbcode': 'BBCode',
  'presetShare.format.bbcodeFor': 'Head-Fi · その他の掲示板',
  'presetShare.format.plain': 'プレーンテキスト',
  'presetShare.format.plainFor': 'それ以外の場所',
  'presetShare.export.withLink': 'fluideq.com のページへの短いリンクを添える',
  'presetShare.export.linkSignIn': 'サインインして短いリンクを添える',
  'presetShare.export.fits':
    '{count} 文字 · Discord のメッセージ 1 件に収まります',
  'presetShare.export.long':
    '{count} 文字 · Discord のメッセージ 1 件には長すぎます。短いリンクだけを送ってください。',
  'presetShare.export.pasteHint':
    'FluidEQ があれば、誰でもこれを「インポート」に貼り付けられます。',
  'presetShare.export.fileHint':
    'カーブとすべての段を含む読みやすい JSON で、DSP ページが保存するファイルと同じです。「インポート」にドロップすると元に戻せます。',
  'presetShare.export.apoNoCurve':
    'このプリセットにはカーブがありません。音はすべてラックにあり、ラックには FluidEQ が必要です。',
  'presetShare.export.apoRack':
    'この形式で運べるのはカーブだけです。{stages} には FluidEQ が必要です。',
  'presetShare.export.copy': 'コピー',
  'presetShare.export.copyCurve': 'カーブをコピー',
  'presetShare.export.save': 'ファイルを保存…',
  'presetShare.export.copied': 'コピーしました',
  'presetShare.export.saved': '保存しました',
  'presetShare.export.failed':
    'うまくいきませんでした。もう一度お試しください。',

  'presetShare.forum.attached': '添付されたプリセット',
  'presetShare.forum.remove': 'プリセットを外す',
  'presetShare.forum.template': '用途: \n試聴環境: \n試すなら: \n\n効果: ',

  'presetShare.card.by': '@{author} が共有',
  'presetShare.card.sharedBy': '{author} が共有',
  'presetShare.card.sharedByMember': 'FluidEQ のメンバーが共有',
  'presetShare.card.add': '自分のプリセットに追加',
  'presetShare.card.added': '「自分の」に追加済み · 再生中',
  'presetShare.card.try': '試す',
  'presetShare.card.stopTrying': '試すのをやめる',
  'presetShare.card.tryingNote':
    '止めるか投稿を離れるまで再生します。その後、元の音に戻ります。',

  'presetShare.import.button': 'インポート',
  'presetShare.import.title': 'プリセットをインポート',
  'presetShare.import.hint':
    'フォーラムの投稿、共有リンク、プリセットファイルを貼り付けてください。読み取るのは中のプリセットだけです。',
  'presetShare.import.paste': 'クリップボードから貼り付け',
  'presetShare.import.placeholder': 'ここに貼り付け…',
  'presetShare.import.chooseFile': 'ファイルを選択…',
  'presetShare.import.found': 'プリセットが 1 つ見つかりました',
  'presetShare.import.missing':
    'このテキストには FluidEQ のプリセットが含まれていません。投稿全体か共有リンクを貼り付けてください。',
  'presetShare.import.newer':
    'このプリセットは新しい FluidEQ で作られています。読み込むには FluidEQ を更新してください。',
  'presetShare.import.damaged':
    'プリセットのコードが途中で切れているか、壊れています。最初から最後までもう一度コピーしてください。',
  'presetShare.import.clipboardFailed':
    'FluidEQ はクリップボードを読み取れませんでした。代わりにボックスに貼り付けてください。',
  'presetShare.import.gone':
    'このプリセットはもう共有されていません。代わりにコードを尋ねてください。',
  'presetShare.import.offline':
    'このリンクを開くために FluidEQ のサーバーに接続できませんでした。接続を確認してもう一度お試しください。',

  'presetShare.link.title': 'このプリセットを追加しますか？',
  'presetShare.link.hint':
    '開いたリンクからです。押すまで、再生も保存も行われません。',
  'presetShare.link.notNow': '今はしない',
  'presetShare.link.fetching': 'FluidEQ からプリセットを取得しています…',
} as const;
