/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const video = {
  'video.sites': '影片網站',
  'video.back': '返回',
  'video.forward': '前進',
  'video.reload': '重新載入',
  'video.stop': '停止',
  'video.searchAria': '搜尋目前站點',
  'video.searchOn': '搜尋 {site}',
  'video.searchGo': '搜尋',
  'video.searchClear': '清除搜尋',
  'video.searchRecent': '最近的搜尋',
  'video.searchForget': '忘記“{term}”',
  'video.searchForgetAll': '清除最近的搜尋',
  'video.adBlock': '封鎖廣告',
  'video.adBlockHint': '跳過 YouTube 上的影片廣告並隱藏廣告版位。',
  'video.matchColours': '搭配 FluidEQ 的顏色',
  'video.matchColoursHint':
    '僅在您的螢幕上為該網站的頁面設定顏色以符合 FluidEQ。影片、圖片、廣告和標誌永遠不會改變。',
  'video.matchColoursUnavailable':
    '網站保留了自己的顏色：頁面顏色很淺，由藝術家自己設計。',
  'video.signOut': '退出所有網站',
  'video.signOutBusy': '正在退出…',
  'video.signOutHint': '清除播放器持有的所有 cookie、登入資訊和快取頁面。',
  'video.signOutDone': '已退出',
  'video.signOutFailed': '無法退出',
  'video.blockedTitle': '該連結通往播放器之外',
  'video.openInBrowser': '在瀏覽器中開啟',
  'video.downloadChoosing': '選擇儲存此檔案的位置',
  'video.downloadSaving': '儲存 {file}',
  'video.downloadComplete': '儲存到您的電腦',
  'video.downloadFailed': '下載無法儲存',
  'video.downloadProgress': '下載進度',
  'video.downloadCopyPath': '複製路徑',
  'video.downloadCopied': '已複製路徑',
  'video.downloadShowFolder': '在資料夾中顯示',
} satisfies Partial<Dictionary>;

export default video;
