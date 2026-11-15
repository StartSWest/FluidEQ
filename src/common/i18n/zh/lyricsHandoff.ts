const lyricsHandoff = {
  'library.lyrics.karaoke.open': '在卡拉OK中打开',
  'library.lyrics.karaoke.opening': '正在打开…',
  'library.lyrics.karaoke.hintTimed':
    '用这份同步歌词开始制作卡拉OK，并在制作器中修正时间',
  'library.lyrics.karaoke.hintPlain':
    '用这份歌词开始制作卡拉OK，并在制作器中为其对时',
  'library.lyrics.karaoke.failed': '无法在卡拉OK中打开这首歌。',
  'library.lyrics.remove.button': '移除歌词',
  'library.lyrics.remove.askFile': '移除 {name}？歌曲旁边的歌词文件将被删除。',
  'library.lyrics.remove.askKept': '移除 FluidEQ 为这首歌保存的歌词副本？',
  'library.lyrics.remove.busy': '正在移除歌词…',
  'library.lyrics.remove.confirm': '移除',
  'library.lyrics.remove.keep': '保留',
  'library.lyrics.remove.inSong':
    '这些歌词位于歌曲文件本身中。FluidEQ 从不修改你的歌曲，因此无法在这里移除。',
  'library.lyrics.remove.failed': '无法移除歌词。',
  'library.lyrics.remove.understood': '好',

  'karaoke.maker.song.save': '保存到媒体库',
  'karaoke.maker.song.saveHint': '将这份时间保存为媒体库中这首歌的歌词',
  'karaoke.maker.song.openedTimed': '已使用媒体库中这首歌的同步歌词打开。',
  'karaoke.maker.song.keptTimed':
    '你之前已在制作这首歌的卡拉OK，所以按你离开时的样子打开。“还原原始版本”会从这首歌的歌词重新开始。',
  'karaoke.maker.song.keptPlain':
    '你之前已在制作这首歌的卡拉OK，所以按你离开时的样子打开。如果想改用这首歌的歌词，它们就在编辑器里。',
  'karaoke.maker.song.savedBeside': '已在歌曲旁保存为 {name}。',
  'karaoke.maker.song.savedKept':
    '已保存到 FluidEQ 的歌词文件夹：无法写入歌曲所在文件夹。',
  'karaoke.maker.song.untimedLeftOut': '未对时的行已略去（{lines}）。',
  'karaoke.maker.song.tagsFirst':
    '这首歌自身的标签里也有同步歌词，媒体库会优先显示那份。',
  'karaoke.maker.song.nothingTimed': '还没有可保存的内容：没有任何一行有时间。',
  'karaoke.maker.song.failed': '无法将歌词保存到这首歌。',
  'karaoke.maker.song.gone': '这首歌已不在媒体库中。',
  'karaoke.maker.song.replaceTitle': '替换 {name}？',
  'karaoke.maker.song.replaceKeptTitle': '替换 FluidEQ 的副本？',
  'karaoke.maker.song.replaceBody':
    '这首歌已在 {name} 中有歌词。它将被制作器中的时间替换。',
  'karaoke.maker.song.replaceKeptBody':
    'FluidEQ 已为这首歌保存了歌词。它将被制作器中的时间替换。',
  'karaoke.maker.song.replace': '替换',
} as const;

export default lyricsHandoff;
