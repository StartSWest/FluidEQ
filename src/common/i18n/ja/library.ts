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
  'library.karaokeSkipped':
    'カラオケの曲を {count} 曲スキップしました — カラオケタブで開いてください',

  'library.add': 'フォルダーを追加',
  'library.rescan': '再スキャン',
  'library.rescan.force': '強制的に再スキャン',
  'library.search': 'ライブラリを検索',
  'library.searchPlaceholder': '曲、アーティスト、アルバムを検索',

  'library.browse.album': 'アルバム',
  'library.browse.artist': 'アーティスト',
  'library.browse.genre': 'ジャンル',
  'library.browse.song': '曲',
  'library.browse.folder': 'フォルダ',
  'library.browse.directory': 'ツリー',
  'library.browse.folderHint': '音楽のあるフォルダーをすべて一度に',
  'library.browse.directoryHint': 'ルートフォルダーから中へ',
  'library.browse.folderReading': 'フォルダーの見せ方',
  'library.jumpTo': '頭文字へ移動',
  'library.coverflow.previous': '前のジャケット',
  'library.coverflow.next': '次のジャケット',
  'library.folderCount': '{count} 個のフォルダ',
  'library.filterHere': 'この中の曲を絞り込む',
  'library.view.list': 'リスト',
  'library.view.grid': 'グリッド',
  'library.view.coverflow': 'Cover Flow',
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

  'library.column.title': '曲名',
  'library.column.artist': 'アーティスト',
  'library.column.album': 'アルバム',
  'library.column.year': '年',
  'library.column.length': '長さ',
  'library.column.trackNo': 'トラック番号',

  'library.unknownAlbum': '不明なアルバム',
  'library.unknownArtist': '不明なアーティスト',
  'library.genre.unknown': '不明なジャンル',
  'library.trackCount': '{count} 曲',
  'library.albumCount': '{count} 枚のアルバム',
  'library.artistCount': '{count} 組のアーティスト',

  'library.videos': '動画',
  'library.videos.empty': '追加したフォルダー内に動画がありません。',

  'library.scan.running': '{name} を読み込み中',
  'library.scan.counted': '{seen} 件中 {parsed} 件のファイル',
  'library.scan.cancel': '停止',
  'library.scan.background': 'バックグラウンドで続ける',
  'library.scan.done': '{count} 曲を追加しました',

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

  'library.upNext': '次に再生',
  'library.upNext.empty': 'キューは空です',
  'library.upNext.added': 'あなたの選曲',
  'library.upNext.rest': 'そのあと',
  'library.upNext.continued': '似ている曲',
  'library.upNext.keepPlaying': '再生を続ける',
  'library.upNext.keepPlayingHint':
    'リストが終わったら、同じジャンルの曲を続けて再生します',
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
  'library.repeat': 'リピート',
  'library.repeat.all': 'すべてをリピート',
  'library.repeat.one': 'この曲をリピート',
  'library.repeat.off': 'リピートしない',
  'library.volume': '音量',
  'library.mute': 'ミュート',
  'library.unmute': 'ミュート解除',
  'library.playbackOptions': '再生オプション',
  'library.position': '再生位置',
  'library.queue': '再生キュー',
  'library.queue.remove': 'キューから削除',
  'library.nowPlaying': '再生中',
  'library.nothingPlaying': '再生していません',
  'library.nothingPlayingHint': '再生するものを選んでください',
  'library.systemAudio': 'システム音声',

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
};

export default library;
