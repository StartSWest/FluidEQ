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
  'tabs.library': '媒体库',

  'library.empty.title': '这里还没有音乐',
  'library.empty.body': '添加一个文件夹，FluidEQ 会读取其中的歌曲和视频。',
  'library.empty.add': '添加文件夹',
  'library.empty.drop': '或将文件夹拖放到这里',
  'library.karaokeSkipped':
    '已跳过 {count} 首卡拉OK歌曲 — 请在卡拉OK标签页中打开它们',

  'library.add': '添加文件夹',
  'library.rescan': '重新扫描',
  'library.rescan.force': '强制重新扫描',
  'library.search': '搜索媒体库',
  'library.searchPlaceholder': '搜索歌曲、歌手、专辑',

  'library.browse.album': '专辑',
  'library.browse.artist': '歌手',
  'library.browse.genre': '流派',
  'library.browse.song': '歌曲',
  'library.browse.folder': '文件夹',
  'library.browse.directory': '树状',
  'library.browse.folderHint': '一次列出所有含音乐的文件夹',
  'library.browse.directoryHint': '从根文件夹逐层进入',
  'library.browse.folderReading': '文件夹的呈现方式',
  'library.jumpTo': '跳转到字母',
  'library.coverflow.previous': '上一张封面',
  'library.coverflow.next': '下一张封面',
  'library.folderCount': '{count} 个文件夹',
  'library.filterHere': '筛选这些歌曲',
  'library.view.list': '列表',
  'library.view.grid': '网格',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': '媒体库的显示方式',
  'library.browse.aria': '媒体库正在显示的内容',

  'library.sort': '排序',
  'library.sortBy': '排序：{value}',
  'library.sort.direction': '排序方向',
  'library.sort.title': '标题',
  'library.sort.artist': '歌手',
  'library.sort.album': '专辑',
  'library.sort.year': '年份',
  'library.sort.added': '最近添加',
  'library.sort.track': '专辑曲序',

  'library.column.title': '标题',
  'library.column.artist': '歌手',
  'library.column.album': '专辑',
  'library.column.year': '年份',
  'library.column.length': '长度',
  'library.column.trackNo': '曲目编号',

  'library.unknownAlbum': '未知专辑',
  'library.unknownArtist': '未知歌手',
  'library.genre.unknown': '未知流派',
  'library.trackCount': '{count} 首歌曲',
  'library.albumCount': '{count} 张专辑',
  'library.artistCount': '{count} 位歌手',

  'library.videos': '视频',
  'library.videos.empty': '已添加的文件夹中没有视频。',

  'library.scan.running': '正在读取 {name}',
  'library.scan.counted': '{parsed} / {seen} 个文件',
  'library.scan.cancel': '停止',
  'library.scan.background': '在后台继续',
  'library.scan.done': '已添加 {count} 首歌曲',

  'library.roots': '文件夹',
  'library.root.remove': '移除此文件夹',
  'library.root.offline': '此文件夹当前不可用',
  'library.reveal': '在资源管理器中显示',
  'library.trackMenu': '更多操作',

  'library.unplayable': 'FluidEQ 无法播放此格式',
  'library.metadataError': 'FluidEQ 无法读取此文件的标签。',
  'library.pending': '已找到此文件，其详细信息仍在读取中。',
  'library.indexReset': '媒体库索引无法读取，已重新建立。',

  'library.back': '返回',

  'library.upNext': '接下来播放',
  'library.upNext.empty': '队列暂时为空',
  'library.upNext.added': '你选的',
  'library.upNext.rest': '之后',
  'library.upNext.continued': '相似音乐',
  'library.upNext.keepPlaying': '继续播放',
  'library.upNext.keepPlayingHint': '列表播完后，继续播放同一流派的音乐',
  'library.queueAdd': '加入播放队列',

  'library.alsoInFolder': '在此文件夹中，但不属于此专辑',
  'library.play': '播放',
  'library.pause': '暂停',
  'library.stop': '停止',
  'library.previous': '上一首',
  'library.back5': '后退 5 秒',
  'library.forward5': '前进 5 秒',
  'library.next': '下一首',
  'library.shuffle': '随机播放',
  'library.repeat': '循环播放',
  'library.repeat.all': '列表循环',
  'library.repeat.one': '单曲循环',
  'library.repeat.off': '不循环',
  'library.volume': '音量',
  'library.mute': '静音',
  'library.unmute': '取消静音',
  'library.playbackOptions': '播放选项',
  'library.position': '播放位置',
  'library.queue': '播放队列',
  'library.queue.remove': '从队列中移除',
  'library.nowPlaying': '正在播放',
  'library.nothingPlaying': '没有在播放',
  'library.nothingPlayingHint': '选择要播放的内容',
  'library.systemAudio': '系统音频',
  'library.fullScreen': '全屏',

  'library.trackActions': '对这首歌做什么',
  'library.browse.playlist': '播放列表',
  'library.playlist.favorites': '收藏',
  'library.playlist.addToFavorites': '加入收藏',
  'library.playlist.removeFromFavorites': '从收藏中移除',
  'library.playlist.favorite': '已在你的收藏里',
  'library.playlist.addTo': '加入播放列表',
  'library.playlist.alreadyIn': '已在这个播放列表里',
  'library.playlist.removeFrom': '从这个播放列表中移除',
  'library.playlist.new': '新建播放列表',
  'library.playlist.newName': '播放列表名称',
  'library.playlist.create': '创建',
  'library.playlist.rename': '重命名',
  'library.playlist.keep': '保留',
  'library.playlist.delete': '删除播放列表',
  'library.playlist.deleteConfirm': '删除“{name}”？歌曲仍会留在你的音乐库里。',
  'library.playlist.builtIn': '收藏一直都在，无法删除',
  'library.playlist.songCount': '{count} 首歌',
  'library.playlist.songCountOne': '1 首歌',
  'library.playlist.empty': '这个播放列表还是空的',
  'library.playlist.emptyHint': '右键点击一首歌，选择“加入播放列表”。',
  'library.playlist.missing':
    '这个播放列表里有 {count} 首歌现在不在你的音乐库中',
  'library.playlist.reset': '无法读取你的播放列表，已重置。',
  'library.karaoke.send': '发送到卡拉OK',
  'library.karaoke.sending': '正在发送到卡拉OK…',
  'library.karaoke.failed':
    '无法把这个文件发送到卡拉OK — 它可能太大或无法读取。',
};

export default library;
