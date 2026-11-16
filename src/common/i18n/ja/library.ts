/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** The Library tab: local music and video files. */
import { Dictionary } from '../en';

const library: Partial<Dictionary> = {
  'tabs.library': 'ライブラリ',

  'library.empty.title': 'まだ音楽がありません',
  'library.empty.body':
    'フォルダーを追加すると、FluidEQ がその中の曲と動画を読み込みます。',
  'library.empty.add': 'フォルダーを追加',
  'library.empty.drop': 'またはここにフォルダーをドロップ',
  'library.empty.feature.sound':
    'すべての曲があなたの EQ と DSP を通って再生されます',
  'library.empty.feature.lyrics': '歌詞が一語ずつ光ります',
  'library.empty.feature.browse':
    'アルバム、Cover Flow、次に再生、おまかせ再生',
  'library.karaokeSkipped':
    'カラオケの曲を {count} 曲スキップしました — カラオケタブで開いてください',

  'library.add': 'フォルダーを追加',
  'library.rescan': '再スキャン',
  'library.rescan.force': '強制的に再スキャン',
  'library.searchPlaceholder': '曲、アーティスト、アルバムを検索',

  'library.browse.album': 'アルバム',
  'library.browse.artist': 'アーティスト',
  'library.browse.genre': 'ジャンル',
  'library.browse.song': '曲',
  'library.browse.folder': 'フォルダ',
  'library.jumpTo': '頭文字へ移動',
  'library.coverflow.previous': '前のジャケット',
  'library.coverflow.next': '次のジャケット',
  'library.coverflow.emptyTitle': 'ここには何もありません',
  'library.coverflow.emptyHint':
    'この棚にはここに表示するものがありません。別の棚かフォルダーを選んでください。',
  'library.coverflow.noMatchTitle': '「{query}」に一致するものはありません',
  'library.coverflow.noMatchHint':
    '別の言葉で試すか、検索をクリアしてください。',
  'library.filterHere': 'この中の曲を絞り込む',
  'library.view.list': '詳細',
  'library.view.grid': 'グリッド',
  'library.view.coverflow': 'Cover Flow',
  'library.rail.library': 'ライブラリ',
  'library.rail.allPlaylists': 'すべてのプレイリスト',
  'library.roots.manage': 'フォルダーの管理',
  'library.rail.resize': 'リストの幅',
  'library.tree.more': 'ほか {count} 件…',
  'library.history': '戻る・進む',
  'library.forward': '進む',
  'library.length.minutes': '{minutes} 分',
  'library.length.hours': '{hours} 時間 {minutes} 分',
  'library.status.songs': '{count} 曲',
  'library.status.songsOne': '{count} 曲',
  'library.status.albums': '{count} 枚のアルバム',
  'library.status.albumsOne': '{count} 枚のアルバム',
  'library.status.videos': '{count} 本の動画',
  'library.status.videosOne': '{count} 本の動画',
  'library.status.upToDate': 'ライブラリは最新です',
  'library.sort.plays': '再生回数順',
  'library.sort.length': '長さ',
  'library.column.genre': 'ジャンル',
  'library.column.format': '形式',
  'library.column.plays': '再生回数',
  'library.columns.choose': '列を選択',
  'library.kind.album': 'アルバム',
  'library.kind.artist': 'アーティスト',
  'library.kind.genre': 'ジャンル',
  'library.kind.folder': 'フォルダー',
  'library.kind.folderAlbum': 'フォルダー · アルバム',
  'library.kind.playlist': 'プレイリスト',
  'library.pane.details': '詳細',
  'library.pane.lyrics': '歌詞',
  'library.pane.tabs': 'パネルの表示内容',
  'library.now.nothing': '再生していません',
  'library.now.nothingHint': '曲を選んで再生',
  'library.facts.nothing': '曲を再生すると詳細が表示されます',
  'library.facts.song': '曲',
  'library.facts.file': 'ファイル',
  'library.facts.sound': 'サウンド',
  'library.facts.location': '場所',
  'library.facts.track': 'トラック',
  'library.facts.disc': 'ディスク',
  'library.facts.codec': 'コーデック',
  'library.facts.bitrate': 'ビットレート',
  'library.facts.sampleRate': 'サンプルレート',
  'library.facts.bitDepth': 'ビット深度',
  'library.facts.channels': 'チャンネル',
  'library.facts.mono': 'モノラル',
  'library.facts.stereo': 'ステレオ',
  'library.facts.channelCount': '{count} チャンネル',
  'library.facts.duration': '再生時間',
  'library.facts.size': 'ファイルサイズ',
  'library.facts.loudness': 'ラウドネス',
  'library.facts.truePeak': 'トゥルーピーク',
  'library.facts.lossless': 'ロスレス',
  'library.facts.lossy': 'ロッシー',
  'library.facts.kbps': '{value} kbps',
  'library.facts.khz': '{value} kHz',
  'library.facts.bits': '{value} ビット',
  'library.facts.mb': '{value} MB',
  'library.facts.lufs': '{value} LUFS',
  'library.facts.dbtp': '{value} dBTP',
  'library.facts.readFailed':
    'FluidEQ はこのファイルの詳細を読み取れませんでした。',
  'library.lyrics.nothing': '曲を再生すると歌詞が表示されます',
  'library.lyrics.none': 'この曲には歌詞がありません',
  'library.lyrics.looked':
    'FluidEQ は曲のタグと、同じ名前の .lrc または .txt ファイルを探しました。',
  'library.lyrics.fromTags': '曲のタグから',
  'library.lyrics.fromFile': '{name} から',
  'library.lyrics.reading': '歌詞を探しています…',
  'library.lyrics.follow': '再生中の行に戻る',
  'library.lyrics.listLabel': '歌詞。行を押すとそこから再生します。',
  'library.lyrics.find.heading': 'オンラインで探す',
  'library.lyrics.find.free': '無料・タイミング付き',
  'library.lyrics.find.licensed': 'ライセンス済みの歌詞',
  'library.lyrics.find.open': 'この曲をブラウザーの {site} で検索',
  'library.lyrics.find.searches':
    '「{query}」で検索します。サイトで歌詞をダウンロードまたはコピーし、下から取り込んでください。',
  'library.lyrics.import.heading': '曲と一緒に保存',
  'library.lyrics.import.file': '歌詞を読み込む…',
  'library.lyrics.import.paste': '貼り付け',
  'library.lyrics.import.drop':
    '歌詞ファイル（.lrc、.srt、.vtt、.ttml、.json、.yaml、.txt）をこのタブにドロップすることもできます。',
  'library.lyrics.import.pasteLabel': 'この曲と一緒に保存する歌詞',
  'library.lyrics.import.pastePlaceholder':
    '歌詞、またはタイミング付きの .lrc を貼り付け',
  'library.lyrics.import.save': '歌詞を保存',
  'library.lyrics.import.cancel': 'キャンセル',
  'library.lyrics.import.busy': '歌詞を保存しています…',
  'library.lyrics.import.exists':
    '{name} はすでに曲の隣にあります。置き換えますか？',
  'library.lyrics.import.existsKept':
    'この曲の歌詞はすでに FluidEQ が保存しています。置き換えますか？',
  'library.lyrics.import.replace': '置き換える',
  'library.lyrics.import.keep': '古いものを残す',
  'library.lyrics.import.savedBeside': '曲の隣に {name} として保存しました',
  'library.lyrics.import.savedKept':
    'FluidEQ の歌詞フォルダーに保存しました（曲のフォルダーに書き込めません）',
  'library.lyrics.import.shadowed':
    '{name} として保存しました。曲にすでに含まれている歌詞が優先して表示されます。',
  'library.lyrics.import.shadowedKept':
    'FluidEQ の歌詞フォルダーに保存しました。曲にすでに含まれている歌詞が優先して表示されます。',
  'library.lyrics.import.tooBig':
    'このファイルは 512 KB を超えており、歌詞としては大きすぎます。',
  'library.lyrics.import.notText': 'このファイルはテキストではありません。',
  'library.lyrics.import.empty': '歌詞が含まれていません。',
  'library.lyrics.import.notLyricsFile':
    '読み込めるのは歌詞ファイル（.lrc、.srt、.vtt、.ttml、.json、.yaml、.txt）だけです。',
  'library.lyrics.import.failed': '歌詞を保存できませんでした。',
  'library.lyrics.fromKept':
    'FluidEQ の歌詞フォルダーから（曲のフォルダーに書き込めません）',
  'library.lyrics.other': '別の歌詞を探す',
  'library.lyrics.back': '歌詞に戻る',
  'library.pane.subtitles': '字幕',
  'library.subtitles.reading': '字幕を探しています…',
  'library.subtitles.none': 'この動画には字幕がありません',
  'library.subtitles.looked':
    'FluidEQ は動画の隣にある同じ名前の .srt または .vtt ファイルを探しました。名前のあとに言語を付けることもできます: {example}',
  'library.subtitles.variant': '{language} · {variant}',
  'library.subtitles.unreadable':
    'FluidEQ は {name} からタイミング付きの行を読み取れませんでした。',
  'library.subtitles.find.heading': 'オンラインで探す',
  'library.subtitles.find.moviesAndTv': '映画とテレビ番組',
  'library.subtitles.find.tv': 'テレビ番組',
  'library.subtitles.find.open': 'この動画をブラウザーの {site} で検索',
  'library.subtitles.find.searches':
    '「{query}」で検索します。サイトで .srt または .vtt ファイルをダウンロードし、下から取り込んでください。',
  'library.subtitles.import.heading': '動画と一緒に保存',
  'library.subtitles.import.file': '字幕を読み込む…',
  'library.subtitles.import.drop':
    'または .srt か .vtt ファイルをこのタブにドロップしてください。動画の隣に、動画と同じ名前で保存されます。',
  'library.subtitles.import.busy': '字幕を保存しています…',
  'library.subtitles.import.saved': '動画の隣に {name} として保存しました',
  'library.subtitles.import.failed': '字幕を動画の隣に保存できませんでした。',
  'library.subtitles.import.empty': 'タイミング付きの行が含まれていません。',
  'library.subtitles.import.tooBig':
    'このファイルは 2 MB を超えており、字幕としては大きすぎます。',
  'library.subtitles.import.notText': 'このファイルはテキストではありません。',
  'library.subtitles.import.notSubtitles':
    '読み込めるのは字幕ファイル (.srt または .vtt) だけです。',
  'library.subtitles.unnamed': '字幕 {number}',
  'library.subtitles.sample': 'ここに字幕が表示されます',
  'library.subtitles.dragHint': 'ドラッグして字幕の位置を決めます',
  'library.subtitles.menu': '字幕',
  'library.subtitles.show': '字幕を表示',
  'library.subtitles.files': '字幕ファイル',
  'library.subtitles.settings': '字幕のスタイル',
  'library.subtitles.size': 'サイズ',
  'library.subtitles.size.s': 'S',
  'library.subtitles.size.m': 'M',
  'library.subtitles.size.l': 'L',
  'library.subtitles.size.xl': 'XL',
  'library.subtitles.colour': '色',
  'library.subtitles.colour.white': '白',
  'library.subtitles.colour.yellow': '黄',
  'library.subtitles.colour.cyan': 'シアン',
  'library.subtitles.colour.green': '緑',
  'library.subtitles.colour.pink': 'ピンク',
  'library.subtitles.background': '背景',
  'library.subtitles.background.none': 'なし',
  'library.subtitles.background.outline': '縁取り',
  'library.subtitles.background.box': 'ボックス',
  'library.subtitles.opacity': 'ボックスの不透明度',
  'library.subtitles.edge': '縁取り',
  'library.subtitles.edge.thin': '細い',
  'library.subtitles.edge.thick': '太い',
  'library.subtitles.place': '位置',
  'library.subtitles.place.topLeft': '左上',
  'library.subtitles.place.topCentre': '上中央',
  'library.subtitles.place.topRight': '右上',
  'library.subtitles.place.middleLeft': '左中央',
  'library.subtitles.place.middleCentre': '中央',
  'library.subtitles.place.middleRight': '右中央',
  'library.subtitles.place.bottomLeft': '左下',
  'library.subtitles.place.bottomCentre': '下中央',
  'library.subtitles.place.bottomRight': '右下',
  'library.subtitles.move': '映像上で動かす',
  'library.subtitles.moveDone': '完了',
  'library.view.aria': 'ライブラリの表示方法',
  'library.browse.aria': 'ライブラリに表示している内容',

  'library.sort': '並べ替え',
  'library.sortBy': '並べ替え: {value}',
  'library.sort.direction': '並べ替えの方向',
  'library.sort.title': '曲名',
  'library.sort.artist': 'アーティスト',
  'library.sort.album': 'アルバム',
  'library.sort.year': '年',
  'library.sort.added': '最近追加した項目',
  'library.sort.track': 'アルバムの曲順',
  'library.sort.name': '名前',
  'library.sort.count': '曲数が多い順',

  'library.column.title': '曲名',
  'library.column.artist': 'アーティスト',
  'library.column.album': 'アルバム',
  'library.column.year': '年',
  'library.column.length': '時間',
  'library.column.trackNo': 'トラック番号',

  'library.unknownAlbum': '不明なアルバム',
  'library.unknownArtist': '不明なアーティスト',
  'library.genre.unknown': '不明なジャンル',
  'library.trackCount': '{count} 曲',
  'library.albumCount': '{count} 枚のアルバム',
  'library.artistCount': '{count} 組のアーティスト',
  'library.trackCountOne': '1 曲',
  'library.albumCountOne': '1 枚のアルバム',
  'library.artistCountOne': '1 組のアーティスト',

  'library.videos': '動画',
  'library.videos.empty': '追加したフォルダー内に動画がありません。',

  'library.scan.running': '{name} を読み込み中',
  'library.scan.counted': '{seen} 件中 {parsed} 件のファイル',
  'library.scan.cancel': '停止',
  'library.scan.hide': 'この通知を隠す',
  'library.scan.hideHint':
    'この通知を隠します。ライブラリはファイルの読み込みを続けます。',
  'library.scan.chip': '読み込み中 {percent}%',
  'library.scan.chipFinding': '読み込み中…',
  'library.scan.show': '進行状況と「停止」をもう一度表示します',

  'library.roots': 'フォルダー',
  'library.root.remove': 'このフォルダーを削除',
  'library.root.offline': 'このフォルダーは現在利用できません',
  'library.reveal': 'エクスプローラーで表示',
  'library.trackMenu': 'その他の操作',

  'library.unplayable': 'FluidEQ はこの形式を再生できません',
  'library.metadataError':
    'FluidEQ はこのファイルのタグを読み取れませんでした。',
  'library.pending':
    'このファイルは見つかりましたが、詳細情報はまだ読み込み中です。',
  'library.indexReset':
    'ライブラリの索引を読み込めなかったため、再構築しました。',

  'library.back': '戻る',
  'library.video.skip': '{seconds} 秒',
  'library.place.aria': 'ライブラリ内の現在地',
  'library.place.allHint': 'このフォルダーを出て、ライブラリ全体を表示',
  'library.search.near': '{folder} 内',
  'library.search.nearEmpty': '{folder} には該当なし',
  'library.search.elsewhere': 'ライブラリのその他の場所',

  'library.upNext': '次に再生',
  'library.upNext.empty': 'キューは空です',
  'library.upNext.added': 'あなたの選曲',
  'library.upNext.rest': 'そのあと',
  'library.upNext.continued': '似ている曲',
  'library.upNext.keepPlaying': '再生を続ける',
  'library.upNext.keepPlayingHint':
    'リストが終わったら、同じジャンルの曲を続けて再生し、それもなくなったらおまかせ再生で続けます',
  'library.upNext.surprise': 'おまかせ再生',
  'library.upNext.surpriseHint':
    'ライブラリからランダムに1曲再生し、続けて同じ雰囲気の曲を流します',
  'library.upNext.surpriseStart':
    'ライブラリからランダムに1曲。その後は同じ雰囲気の曲が続きます。',
  'library.upNext.surpriseNext':
    'この曲が終わったら、おまかせ再生が次の曲を選びます。',
  'library.upNext.surpriseNothing':
    '今はライブラリに再生できる曲がありません。',
  'library.queueAdd': 'キューに追加',

  'library.alsoInFolder':
    'このフォルダー内にありますが、このアルバムには含まれません',
  'library.play': '再生',
  'library.pause': '一時停止',
  'library.stop': '停止',
  'library.previous': '前の曲',
  'library.back5': '5秒戻る',
  'library.forward5': '5秒進む',
  'library.next': '次の曲',
  'library.shuffle': 'シャッフル',
  'library.repeat.all': 'すべてをリピート',
  'library.repeat.one': 'この曲をリピート',
  'library.repeat.off': 'リピートしない',
  'library.volume': '音量',
  'library.mute': 'ミュート',
  'library.unmute': 'ミュート解除',
  'library.playbackOptions': '再生オプション',
  'library.position': '再生位置',
  'library.queue.remove': 'キューから削除',
  'library.nowPlaying': '再生中',
  'library.nothingPlaying': '再生していません',
  'library.nothingPlayingHint': '再生するものを選んでください',
  'library.systemAudio': 'システム音声',
  'library.remoteAudio': 'リモート再生 · {name}',
  'library.remoteAudioDelay': 'リモート再生 · {name} · {milliseconds} ms',

  'library.trackActions': 'この曲をどうしますか',
  'library.browse.playlist': 'プレイリスト',
  'library.playlist.favorites': 'お気に入り',
  'library.playlist.addToFavorites': 'お気に入りに追加',
  'library.playlist.removeFromFavorites': 'お気に入りから削除',
  'library.playlist.favorite': 'お気に入りに入っています',
  'library.playlist.addTo': 'プレイリストに追加',
  'library.playlist.alreadyIn': 'このプレイリストにすでにあります',
  'library.playlist.removeFrom': 'このプレイリストから削除',
  'library.playlist.new': '新しいプレイリスト',
  'library.playlist.newName': 'プレイリスト名',
  'library.playlist.create': '作成',
  'library.playlist.rename': '名前を変更',
  'library.playlist.keep': 'そのままにする',
  'library.playlist.delete': 'プレイリストを削除',
  'library.playlist.deleteConfirm':
    '「{name}」を削除しますか？曲はライブラリに残ります。',
  'library.playlist.builtIn': 'お気に入りは常にあり、削除できません',
  'library.playlist.songCount': '{count} 曲',
  'library.playlist.songCountOne': '1 曲',
  'library.playlist.empty': 'このプレイリストにはまだ何もありません',
  'library.playlist.emptyHint':
    '曲を右クリックして「プレイリストに追加」を選んでください。',
  'library.playlist.missing':
    'このプレイリストの {count} 曲は今ライブラリにありません',
  'library.playlist.reset':
    'プレイリストを読み込めなかったため、リセットしました。',
  'library.karaoke.send': 'カラオケへ送る',
  'library.karaoke.sending': 'カラオケへ送っています…',
  'library.karaoke.failed':
    'このファイルはカラオケへ送れませんでした。大きすぎるか、読み取れない可能性があります。',
  'library.drop.empty': 'ドロップしたものに音楽がありません',
  'library.drop.already': 'ドロップした曲はすべて「次に再生」に入っています',
  'library.drop.failed': 'ドロップした音楽を追加できませんでした',
};

export default library;
