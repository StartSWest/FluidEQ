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
  'library.browse.song': '歌曲',
  'library.view.list': '列表',
  'library.view.grid': '网格',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': '媒体库的显示方式',
  'library.browse.aria': '媒体库正在显示的内容',

  'library.sort': '排序',
  'library.sort.title': '标题',
  'library.sort.artist': '歌手',
  'library.sort.album': '专辑',
  'library.sort.year': '年份',
  'library.sort.added': '最近添加',

  'library.column.title': '标题',
  'library.column.artist': '歌手',
  'library.column.album': '专辑',
  'library.column.year': '年份',
  'library.column.length': '长度',

  'library.unknownAlbum': '未知专辑',
  'library.unknownArtist': '未知歌手',
  'library.trackCount': '{count} 首歌曲',
  'library.albumCount': '{count} 张专辑',

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

  'library.unplayable': 'FluidEQ 无法播放此格式',
  'library.metadataError': 'FluidEQ 无法读取此文件的标签。',
  'library.indexReset': '媒体库索引无法读取，已重新建立。',

  'library.back': '返回',

  'library.play': '播放',
  'library.pause': '暂停',
  'library.stop': '停止',
  'library.previous': '上一首',
  'library.next': '下一首',
  'library.shuffle': '随机播放',
  'library.repeat': '循环播放',
  'library.repeat.all': '列表循环',
  'library.repeat.one': '单曲循环',
  'library.repeat.off': '不循环',
  'library.volume': '音量',
  'library.position': '播放位置',
  'library.queue': '播放队列',
  'library.queue.remove': '从队列中移除',
  'library.nowPlaying': '正在播放',
  'library.fullScreen': '全屏',
};

export default library;
