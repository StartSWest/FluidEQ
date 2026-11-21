/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Sharing the listener's own presets. See `en/presetShare.ts`. */
export default {
  'presetShare.share': '分享 {name}',
  'presetShare.menu.community': '分享到社群…',
  'presetShare.menu.copyLink': '複製分享連結',
  'presetShare.menu.export': '匯出…',
  'presetShare.linkCopied': '已複製分享連結',
  'presetShare.linkMaking': '正在產生連結…',
  'presetShare.linkFailed.signedOut': '登入後才能產生連結',
  'presetShare.linkFailed.suspended': '此帳號目前無法分享',
  'presetShare.linkFailed.rateLimited': '這一小時的連結太多了',
  'presetShare.linkFailed.tooMany': '已達連結數量上限',
  'presetShare.linkFailed.takenDown': '這個連結已被移除',
  'presetShare.linkFailed.offline': 'FluidEQ 伺服器沒有回應',

  'presetShare.text.title': '{name} · FluidEQ 預設組',
  'presetShare.text.curve': '曲線：{count} 個頻段',
  'presetShare.text.rack': '效果架：{stages}',
  'presetShare.text.open': '在 FluidEQ 中開啟',

  'presetShare.chip.curve': '曲線 · {count} 個頻段',
  'presetShare.chip.flat': '沒有變更',

  'presetShare.export.title': '匯出 {name}',
  'presetShare.export.hint':
    '包含曲線與效果架的每個階段。你的正規化器和聆聽室的頭部仍屬於你。',
  'presetShare.export.tab.forum': '適用於任何論壇',
  'presetShare.export.tab.file': '檔案',
  'presetShare.export.tab.apo': 'Equalizer APO',
  'presetShare.format.markdown': 'Markdown',
  'presetShare.format.markdownFor': 'Reddit、Discord、GitHub',
  'presetShare.format.bbcode': 'BBCode',
  'presetShare.format.bbcodeFor': 'Head-Fi · 其他論壇',
  'presetShare.format.plain': '純文字',
  'presetShare.format.plainFor': '其他任何地方',
  'presetShare.export.withLink': '附上指向 fluideq.com 頁面的短連結',
  'presetShare.export.linkSignIn': '登入以附上短連結',
  'presetShare.export.fits': '{count} 個字元 · 一則 Discord 訊息放得下',
  'presetShare.export.long':
    '{count} 個字元 · 一則 Discord 訊息放不下，請只傳送短連結。',
  'presetShare.export.pasteHint': '任何有 FluidEQ 的人都能把它貼到「匯入」中。',
  'presetShare.export.fileHint':
    '可讀的 JSON，包含曲線與每個階段，就是 DSP 頁面儲存的檔案。把它拖到「匯入」即可還原。',
  'presetShare.export.apoNoCurve':
    '這個預設組沒有曲線：它的聲音全在效果架裡，而效果架需要 FluidEQ。',
  'presetShare.export.apoRack': '這個格式只能帶上曲線。{stages} 需要 FluidEQ。',
  'presetShare.export.copy': '複製',
  'presetShare.export.copyCurve': '複製曲線',
  'presetShare.export.save': '儲存檔案…',
  'presetShare.export.copied': '已複製',
  'presetShare.export.saved': '已儲存',
  'presetShare.export.failed': '沒有成功，請再試一次。',

  'presetShare.forum.attached': '附加的預設組',
  'presetShare.forum.remove': '移除預設組',
  'presetShare.forum.template':
    '適用於： \n試聽設備： \n推薦搭配： \n\n效果： ',

  'presetShare.card.by': '由 @{author} 分享',
  'presetShare.card.sharedBy': '由 {author} 分享',
  'presetShare.card.sharedByMember': '由一位 FluidEQ 成員分享',
  'presetShare.card.add': '加入我的預設組',
  'presetShare.card.added': '已在「你的」中 · 播放中',
  'presetShare.card.try': '試聽',
  'presetShare.card.stopTrying': '停止試聽',
  'presetShare.card.tryingNote':
    '會一直播放，直到你停止或離開這篇貼文；之後會恢復你自己的聲音。',

  'presetShare.import.button': '匯入',
  'presetShare.import.title': '匯入預設組',
  'presetShare.import.hint':
    '貼上論壇貼文、分享連結或預設組檔案。只會讀取其中的預設組。',
  'presetShare.import.paste': '從剪貼簿貼上',
  'presetShare.import.placeholder': '貼到這裡…',
  'presetShare.import.chooseFile': '選擇檔案…',
  'presetShare.import.found': '找到一個預設組',
  'presetShare.import.missing':
    '這段文字中沒有 FluidEQ 預設組。請貼上整篇貼文或分享連結。',
  'presetShare.import.newer':
    '這個預設組是用較新版本的 FluidEQ 製作的。請更新 FluidEQ 後再讀取。',
  'presetShare.import.damaged':
    '預設組的代碼被截斷或已損毀。請從頭到尾重新複製。',
  'presetShare.import.clipboardFailed':
    'FluidEQ 無法讀取剪貼簿。請改為直接貼到輸入框中。',
  'presetShare.import.gone': '這個預設組已不再分享。請改為索取它的代碼。',
  'presetShare.import.offline':
    'FluidEQ 無法連線到伺服器來開啟這個連結。請檢查網路連線後重試。',

  'presetShare.link.title': '要加入這個預設組嗎？',
  'presetShare.link.hint':
    '來自你開啟的連結。在你按下之前，不會播放或儲存任何內容。',
  'presetShare.link.notNow': '暫時不要',
  'presetShare.link.fetching': '正在從 FluidEQ 取得預設組…',
} as const;
