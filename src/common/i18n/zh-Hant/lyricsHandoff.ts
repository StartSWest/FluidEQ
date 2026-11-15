const lyricsHandoff = {
  'library.lyrics.karaoke.open': '在卡拉 OK 中開啟',
  'library.lyrics.karaoke.opening': '正在開啟…',
  'library.lyrics.karaoke.hintTimed':
    '用這份同步歌詞開始製作卡拉 OK，並在製作器中修正時間',
  'library.lyrics.karaoke.hintPlain':
    '用這份歌詞開始製作卡拉 OK，並在製作器中為其對時',
  'library.lyrics.karaoke.failed': '無法在卡拉 OK 中開啟這首歌。',
  'library.lyrics.remove.button': '移除歌詞',
  'library.lyrics.remove.askFile': '移除 {name}？歌曲旁邊的歌詞檔案將被刪除。',
  'library.lyrics.remove.askKept': '移除 FluidEQ 為這首歌保存的歌詞副本？',
  'library.lyrics.remove.busy': '正在移除歌詞…',
  'library.lyrics.remove.confirm': '移除',
  'library.lyrics.remove.keep': '保留',
  'library.lyrics.remove.inSong':
    '這些歌詞位於歌曲檔案本身之中。FluidEQ 從不修改你的歌曲，因此無法在這裡移除。',
  'library.lyrics.remove.failed': '無法移除歌詞。',
  'library.lyrics.remove.understood': '好',

  'karaoke.maker.song.save': '儲存到媒體庫',
  'karaoke.maker.song.saveHint': '將這份時間儲存為媒體庫中這首歌的歌詞',
  'karaoke.maker.song.openedTimed': '已使用媒體庫中這首歌的同步歌詞開啟。',
  'karaoke.maker.song.keptTimed':
    '你之前已在製作這首歌的卡拉 OK，所以依你離開時的樣子開啟。「還原原始版本」會從這首歌的歌詞重新開始。',
  'karaoke.maker.song.keptPlain':
    '你之前已在製作這首歌的卡拉 OK，所以依你離開時的樣子開啟。如果想改用這首歌的歌詞，它們就在編輯器裡。',
  'karaoke.maker.song.savedBeside': '已在歌曲旁儲存為 {name}。',
  'karaoke.maker.song.savedKept':
    '已儲存到 FluidEQ 的歌詞資料夾：無法寫入歌曲所在的資料夾。',
  'karaoke.maker.song.untimedLeftOut': '未對時的行已略去（{lines}）。',
  'karaoke.maker.song.tagsFirst':
    '這首歌本身的標籤裡也有同步歌詞，媒體庫會優先顯示那一份。',
  'karaoke.maker.song.nothingTimed': '還沒有可儲存的內容：沒有任何一行有時間。',
  'karaoke.maker.song.failed': '無法將歌詞儲存到這首歌。',
  'karaoke.maker.song.gone': '這首歌已不在媒體庫中。',
  'karaoke.maker.song.replaceTitle': '取代 {name}？',
  'karaoke.maker.song.replaceKeptTitle': '取代 FluidEQ 的副本？',
  'karaoke.maker.song.replaceBody':
    '這首歌已在 {name} 中有歌詞。它將被製作器中的時間取代。',
  'karaoke.maker.song.replaceKeptBody':
    'FluidEQ 已為這首歌保存了歌詞。它將被製作器中的時間取代。',
  'karaoke.maker.song.replace': '取代',
} as const;

export default lyricsHandoff;
