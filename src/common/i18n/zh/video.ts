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

/** The Remote Media tab. */
import { Dictionary } from '../en';

const video: Partial<Dictionary> = {
  'video.sites': '视频网站',
  'video.back': '后退',
  'video.forward': '前进',
  'video.reload': '刷新',
  'video.stop': '停止',
  'video.searchAria': '在当前网站中搜索',
  'video.searchOn': '在 {site} 中搜索',
  'video.searchGo': '搜索',
  'video.searchClear': '清除搜索内容',
  'video.searchRecent': '最近的搜索',
  'video.searchForget': '忘记“{term}”',
  'video.searchForgetAll': '清除最近的搜索',
  'video.adBlock': '拦截广告',
  'video.adBlockHint': '跳过视频广告，并隐藏 YouTube 上的广告位。',
  'video.signOut': '退出所有网站登录',
  'video.signOutBusy': '正在退出…',
  'video.signOutHint': '清除播放器保存的所有 Cookie、登录信息和缓存页面。',
  'video.signOutDone': '已退出登录',
  'video.signOutFailed': '无法退出登录',
  'video.blockedTitle': '这个链接会离开播放器',
  'video.openInBrowser': '在浏览器中打开',
  'video.downloadChoosing': '选择文件保存位置',
  'video.downloadSaving': '正在保存 {file}',
  'video.downloadComplete': '已保存到电脑',
  'video.downloadFailed': '无法保存下载内容',
  'video.downloadProgress': '下载进度',
  'video.downloadCopyPath': '复制路径',
  'video.downloadCopied': '路径已复制',
  'video.downloadShowFolder': '在文件夹中显示',
  'video.resize': '拖动可调整播放器大小',
};

export default video;
