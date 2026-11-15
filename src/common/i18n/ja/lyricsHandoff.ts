const lyricsHandoff = {
  'library.lyrics.karaoke.open': 'カラオケで開く',
  'library.lyrics.karaoke.opening': '開いています…',
  'library.lyrics.karaoke.hintTimed':
    'このタイミング付き歌詞からカラオケを始め、カラオケメーカーでタイミングを直します',
  'library.lyrics.karaoke.hintPlain':
    'この歌詞からカラオケを始め、カラオケメーカーでタイミングを付けます',
  'library.lyrics.karaoke.failed': 'この曲をカラオケで開けませんでした。',
  'library.lyrics.remove.button': '歌詞を削除',
  'library.lyrics.remove.askFile':
    '{name} を削除しますか？曲の隣にある歌詞ファイルが消去されます。',
  'library.lyrics.remove.askKept':
    'FluidEQ がこの曲用に保管している歌詞のコピーを削除しますか？',
  'library.lyrics.remove.busy': '歌詞を削除しています…',
  'library.lyrics.remove.confirm': '削除',
  'library.lyrics.remove.keep': '残す',
  'library.lyrics.remove.inSong':
    'この歌詞は曲のファイル自体に含まれています。FluidEQ は曲を変更しないため、ここでは削除できません。',
  'library.lyrics.remove.failed': '歌詞を削除できませんでした。',
  'library.lyrics.remove.understood': 'OK',

  'karaoke.maker.song.save': 'ライブラリに保存',
  'karaoke.maker.song.saveHint':
    'このタイミングをライブラリの曲の歌詞として保存します',
  'karaoke.maker.song.openedTimed':
    'ライブラリにある曲のタイミング付き歌詞で開きました。',
  'karaoke.maker.song.keptTimed':
    'この曲のカラオケは作成途中だったため、前回の状態で開きました。「元に復元」で曲の歌詞からやり直せます。',
  'karaoke.maker.song.keptPlain':
    'この曲のカラオケは作成途中だったため、前回の状態で開きました。曲の歌詞を使いたい場合は、エディターに入っています。',
  'karaoke.maker.song.savedBeside': '曲の隣に {name} として保存しました。',
  'karaoke.maker.song.savedKept':
    'FluidEQ の歌詞フォルダーに保存しました（曲のフォルダーに書き込めません）。',
  'karaoke.maker.song.untimedLeftOut':
    'タイミングのない行は含めていません（{lines}）。',
  'karaoke.maker.song.tagsFirst':
    '曲のタグにもタイミング付き歌詞があり、ライブラリではそちらが先に表示されます。',
  'karaoke.maker.song.nothingTimed':
    'まだ保存するものがありません。時間の付いた行がありません。',
  'karaoke.maker.song.failed': '歌詞を曲に保存できませんでした。',
  'karaoke.maker.song.gone': 'この曲はもうライブラリにありません。',
  'karaoke.maker.song.replaceTitle': '{name} を置き換えますか？',
  'karaoke.maker.song.replaceKeptTitle': 'FluidEQ のコピーを置き換えますか？',
  'karaoke.maker.song.replaceBody':
    'この曲にはすでに {name} に歌詞があります。カラオケメーカーのタイミングで置き換えられます。',
  'karaoke.maker.song.replaceKeptBody':
    'FluidEQ はこの曲の歌詞をすでに保管しています。カラオケメーカーのタイミングで置き換えられます。',
  'karaoke.maker.song.replace': '置き換える',
} as const;

export default lyricsHandoff;
