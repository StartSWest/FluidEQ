/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dictionary } from '../en';

/** `./en.ts` in Traditional Chinese, in the shared dictionary's own terms. */
const zhHant: Partial<Dictionary> = {
  'app.menu.restartAudio': '重新啟動音訊',
  'restart.title': '重新啟動音訊',
  'restart.failed': '無法重新啟動音訊。',
  'notice.restartConfirm':
    'FluidEQ 引擎重新啟動期間，音訊會停止幾秒鐘。要繼續嗎？',
  'notice.restartDone': '音訊已重新啟動。仍然沒有聲音的應用程式請重新開啟。',
  'troubleshoot.restart.title': '重新啟動音訊',
  'troubleshoot.restart.cost':
    'FluidEQ 引擎重新啟動時會靜音幾秒鐘。不需要密碼。',
  'engine.title': 'FluidEQ 如何處理您的聲音',
  'engine.subtitle':
    'FluidEQ 開啟期間，FluidEQ 引擎會在您的音訊伺服器（PipeWire 或 PulseAudio）旁執行。',
  'engine.fluid.l1': '在任何發行版上都能搭配 PipeWire 與 PulseAudio 使用',
  'engine.fluid.l2': 'EQ 與 DSP 效果器機架適用於您聽到的一切，無須重新啟動',
  'engine.fluid.l3': '設定中的 Plugin: 行與 VST 外掛不會執行',
  'output.hint':
    '編輯會儲存到目前開啟的設定檔，並在此輸出正在播放時跟隨此輸出。',
  'extraOutput.ambiguous':
    '有兩個輸出使用此名稱，FluidEQ 無法分辨您指的是哪一個。請在音效設定中重新命名其中一個。',
  'extraOutput.unmatched':
    '音效設定列出了此輸出，但 FluidEQ 無法連接它，因此無法鏡像到它。',
  'convolution.eyebrow': '脈衝響應',
  'convolution.notice.fluid':
    '可下載的目錄由 AutoEq 提供。每個下載都符合您的輸出所用的取樣率，其他取樣率則由 FluidEQ 引擎自行轉換。',
  'graph.scene.gpu.auto': '由系統決定',
  'settingsReset.body':
    '圖表與視覺化效果、視窗色彩、播放器、媒體庫、語言、動畫與「登入時啟動」都會回到全新安裝 FluidEQ 時的狀態。',
  'app.processes.hint':
    '它們都是同一個程式，所以系統以應用程式的名稱稱呼每一個。以下是每一個實際為 FluidEQ 做的事。',
  'app.processes.what.engine':
    'FluidEQ 自己的引擎。它解碼您播放的內容，同時套用等化器。它是與其餘部分分開的程式，所以忙碌的視窗不會讓音樂停頓。',
  'app.processes.what.devices':
    '應用程式詢問有哪些音訊裝置時由 Chromium 啟動；同一個請求也會列出視訊裝置。它不會開啟相機，也不會錄下任何東西。',
  'app.processes.name.systemEngine': 'FluidEQ 引擎（系統音訊）',
  'app.processes.what.systemEngine':
    '位於您的應用程式與音訊伺服器之間的等化器，套用到您聽到的一切。FluidEQ 會隨自身啟動與停止它；它的記憶體與 CPU 會顯示，但不計入總計。',
  'dsp.normalizer.liveGuidance':
    '即時音量平衡會依據正在播放的歌曲運作。遇到較大聲的段落時，會降低該曲剩餘部分的增益；下一首歌會沿用此音量，除非它小聲很多。曾經播放過的歌曲會從第一秒就套用音量平衡。在峰值餘裕允許的範圍內，增益最多提高 6 dB，因此不一定能達到目標響度。關閉後再開啟可重新學習；此功能無法修復既有的失真。',
  'dsp.latency.hint':
    '引擎增加的處理延遲。不包括音訊伺服器、裝置與網路的延遲。',
  'dsp.latency.note':
    '引擎在目前取樣率下回報的處理緩衝。不包括音訊伺服器、裝置與網路的延遲。',
  'dsp.surround.onHint':
    '依照您的輸出設定，在 5.1 或 7.1 輸出的每個聲道上執行機架，並對所有聲道做同一個音量決定。',
  'update.mandatory.failedInstall':
    '更新已下載，但安裝程式沒有啟動。下載的檔案可能已損壞。',
  'startup.label': '登入時啟動',
  'startup.blocked': '您的桌面已在啟動應用程式中關閉此項',
  'startup.failed': '系統無法變更此設定',
  'disclaimer.liability':
    'FluidEQ 會改變電腦處理音訊的方式：它的引擎位於您的應用程式與音訊伺服器之間，處理您聽到的一切。在法律允許的最大範圍內，{author} 不對因使用它而造成的任何損害承擔責任——無論是對您的聽力、喇叭、耳機或其他裝置、資料或其他軟體，或其他任何事物，包括您無法預見的損失。',
  'provenance.body':
    'FluidEQ 的官方套件僅透過 fluideq.com 提供。原始碼建置應來自官方儲存庫。GPL 允許第三方複製、修改、重新建置及販售 FluidEQ，但他們的建置不經 FluidEQ 審查、支援或認可。如果某個下載聲稱是官方版本，卻不是來自 fluideq.com 或官方儲存庫，請關閉它並回報。',
  'engineHealth.offBody':
    '此輸出正在播放沒有經過 EQ 的聲音。重新啟動音訊通常能讓引擎恢復，期間 FluidEQ 的其他功能都會繼續運作。',
  'engineHealth.rackNeedsEngine':
    'DSP 效果在引擎內部執行。重新啟動音訊會重新啟動引擎；如果仍然無效，重新安裝 FluidEQ 即可讓它自己的引擎回到原位。',
  'tour.engine.lead':
    'FluidEQ 現在有了自己的音訊引擎。它在您的音訊伺服器（PipeWire 或 PulseAudio）旁執行，把您的 EQ 與整個 DSP 效果器機架帶到電腦播放的一切：遊戲、瀏覽器、串流應用程式，而不只是媒體庫。',
  'tour.engine.flow.inside': '在音訊伺服器旁',
  'tour.dsp.lead':
    '一整排錄音室級的處理階段：Normalizer、Denoise、Exciter、Bass Forge、等化器、Bass Punch、Dimension、Room、Maximizer 與 Master，另有媒體庫曲目之間的交叉淡入淡出。它會作用於電腦播放的一切。每個階段都有自己的頁面與即時檢視，多數附有預設，其中五個有「隔離」開關，可以只聽它們正在做的事。',
  'tour.dsp.how':
    '開啟 DSP 分頁，在「預設」下選擇一條鏈，然後在側邊分頁中按一下某個階段並將它開啟。',
  'help.start.steps':
    '用 .deb 或 AppImage 安裝 FluidEQ 並開啟它：FluidEQ 引擎會隨之啟動，不需要密碼，也不需要重新開機。\n在「輸出裝置」中選擇您的聆聽裝置。開啟「系統等化器」，並保持「自動正規化」開啟。\n播放一首歌，開啟 EQ →「頻段」，做一個小調整，然後比較「系統等化器」關閉與開啟時的差別。',
  'help.start.tip':
    '在 Linux 上使用全系統 EQ 需要 PipeWire 或 PulseAudio，目前的桌面環境都使用其中之一。FluidEQ 開啟期間，您播放的一切都會經過它；結束 FluidEQ 後，聲音會原封不動地還給您。',
  'help.window.tip':
    '「幫助」可開啟本指南、「新功能介紹」、音訊疑難排解與「報告問題」。旁邊的脈衝按鈕裡有引擎卡片、您的帳戶、匯入 EQ 設定或脈衝響應、重新啟動音訊，以及顯示 FluidEQ 各部分用量的「處理程序」；最下方是「亮度」與「透明度」、動畫、「登入時啟動」和語言。其後的開關會把視窗切換為「輕巧播放器」。',
  'help.window.actions':
    '引擎、您的帳戶、匯入 EQ 設定、重新啟動音訊與「處理程序」；「亮度」與「透明度」、動畫、「登入時啟動」和語言。',
  'help.player.tip':
    '播放器的音量就是電腦本身的音量，所以它決定電腦播放的一切的音量。如果播放器跑到畫面外，請在頂端列的 FluidEQ 圖示上按右鍵，然後選擇「恢復視窗」。',
  'help.player.volume': '電腦的音量：它決定電腦播放的一切的音量。',
  'help.requirements.intro':
    'FluidEQ 可在近幾年的任何 64 位元 Linux 桌面上執行——Ubuntu、Debian、Fedora、Mint、Arch 等等。有兩個部分要求較多：視覺化效果在顯示卡上繪製，卡拉 OK 的 AI 會在第一次使用時下載模型。',
  'help.requirements.steps':
    '檢查您的系統：具備 PipeWire 或 PulseAudio（目前的桌面環境都有其中之一）的 64 位元 Linux、4 GB 記憶體，以及約 600 MB 的磁碟空間。.deb 適用於 Ubuntu、Debian 及其衍生版本；其他發行版請使用 AppImage。\n看看視覺化效果：2013 年以後的任何顯示卡或內建顯示晶片皆可。1080p 用內建顯示晶片就足夠；4K 搭配獨立顯示卡會更順暢。顯示卡忙碌時，FluidEQ 會把場景畫小一點，並放下您看不到的場景。\n試試卡拉 OK 的 AI：第一次分離人聲會下載 713 MB 的模型，音高模型約再加 180 MB，降噪 11 MB。它在處理器上執行，一首四分鐘的歌約需四分鐘分離。執行期間請保留 2 GB 可用記憶體。\n可以的話，建議：8 GB 記憶體、2018 年以後的顯示卡，若使用 AI 功能則保留 3 GB 可用磁碟空間。',
  'help.requirements.keywords':
    '系統需求, 需求, 規格, 硬體, 筆電, gpu, 顯示卡, cpu, 處理器, ram, 記憶體, 磁碟空間, 儲存空間, linux, ubuntu, debian, fedora, mint, arch, pipewire, pulseaudio, deb, appimage, 最低, 建議, 效能, 很慢, 延遲, 相容性',
  'help.engine.intro':
    'FluidEQ 用自己的引擎處理您的聲音。FluidEQ 引擎在您的音訊伺服器（PipeWire 或 PulseAudio）旁執行：它成為系統的輸出，把您的 EQ 與 DSP 效果器機架帶到電腦播放的一切，再把結果送到您真正的輸出，並在 FluidEQ 關閉的那一刻退開。',
  'help.engine.steps':
    '開啟動作選單——右上角的脈衝按鈕。最上方的引擎卡片會顯示引擎是否正在執行。\n在「輸出」面板中選擇您聆聽的輸出。FluidEQ 會播放到它，並在您於音效設定中選擇其他輸出時跟著切換。\n如果通知說引擎沒有執行，請按「重新啟動音訊」。',
  'help.engine.tip':
    '讓 FluidEQ 保持為系統的輸出：在音效設定中選擇喇叭或耳機沒有問題，FluidEQ 會跟著切換。結束 FluidEQ 後，每個應用程式都會回到您選擇的輸出。',
  'help.engine.keywords':
    '音訊引擎, 驅動程式, 全系統, 所有應用程式, spotify, 瀏覽器, discord, pipewire, pulseaudio, 音訊伺服器, 輸出, 預設輸出, 重新啟動音訊',
  'help.engine.apo':
    'Linux 上沒有：Equalizer APO 是 Windows 程式，在這裡由 FluidEQ 引擎負責它的工作。',
  'help.engine.apply':
    'Linux 上不需要：FluidEQ 引擎是唯一的引擎，而且已經在使用中。',
  'help.convolution.tip':
    'FluidEQ 引擎會自行轉換脈衝響應的取樣率。下載目錄需要網路連線；本指南則不需要。',
  'help.profiles.output':
    '您正在聆聽的輸出，藍牙耳機會顯示電量。OFF 表示您的 EQ 沒有作用於它；ACTIVE 表示它就是現在正在播放的輸出。',
  'help.config.tip':
    '產生的層檔案會在設定變更時重寫；要長期保留的手動行請放在各輸出的自訂檔案中。FluidEQ 引擎會讀取 Filter、Preamp、GraphicEQ 與 Convolution 行；Plugin: 行與 VST 外掛在 Linux 上不會執行。',
  'help.dsp.intro':
    'DSP 效果器機架是一串錄音室級的處理階段。在 FluidEQ 引擎下，它處理電腦播放的一切。FluidEQ 關閉時它也會關閉。',
  'help.room.tip':
    '遊戲與電影只會把環繞聲道送到設定了相應喇叭數量的輸出：如果您的裝置具備這些喇叭，請在音效設定中為它選擇 5.1 或 7.1。',
  'help.online.tip':
    '在 FluidEQ 引擎下，線上媒體和其他應用程式一樣會經過您的 EQ 與 DSP 效果器機架。',
  'help.library.tip':
    '媒體庫需要原始檔案：請重新連接磁碟，或重新加入已搬移的資料夾。',
  'help.share.tip':
    '請保密連線代碼：它授權連結。此電腦分享期間會保持 DSP 開啟，播放其聲音的電腦則套用自己的 DSP。要同時播放與傳送，該電腦需要 Windows，或 Linux 上的 FluidEQ 引擎；在其他系統上，連結只能單向運作。',
  'help.trouble.steps':
    '沒有聲音：確認正在播放、已選擇預期的輸出、音量已調高，且裝置已連線。檢查「一次使用一個播放器」是否暫停了另一個來源。\nEQ 沒有變化：確認「系統等化器」已開啟，且輸出沒有顯示 OFF 標記。如果通知說引擎沒有執行，請按「重新啟動音訊」。\n一切看起來都正確，EQ 卻仍然沒有作用：請在音效設定中確認 FluidEQ 仍是輸出；重新啟動音訊會讓它回來。\n失真或低音過重：保持「自動正規化」開啟，降低增益，並逐一略過各層。如果問題持續，請使用「報告問題」，並在送出前檢查報告內容。',
  'troubleshoot.description':
    '在 Linux 上，一個步驟就能解決幾乎所有問題：重新啟動 FluidEQ 引擎，只需幾秒鐘。',
  'troubleshoot.footer':
    '之後仍然不對嗎？請使用同一選單中的 **{report}**——它會收集記錄、刪除任何能識別您的內容，並在送出前讓您看到全部內容。',
  'help.window.plus': '視覺化效果、畫廊與工作室。',
  'help.plus.intro':
    '帳戶是選用的：原本免費的一切在這台電腦上無需帳戶即可執行。登入後，「視覺化效果」分頁包含畫廊與工作室。畫廊中的一個場景需要 1 點，並且永遠屬於您；已確認的帳戶可免費獲得一些點數，點數包則一次付清。',
  'help.gallery.desktop': '僅限 Windows：把場景放在桌面圖示後面。',
  'help.gallery.manage': '僅限 Windows：每個螢幕顯示為桌面背景的內容。',
  'help.gallery.stop': '僅限 Windows：停止所有桌面背景。',
  'help.library.steps':
    '開啟「媒體庫」並加入存放媒體的資料夾。先讓掃描完成，再判斷缺少了什麼。\n選擇演出者或專輯，或搜尋歌曲。從結果中開始播放曲目。\n使用視窗底部的列來暫停、跳轉與略過。它的音量就是電腦本身的音量。',
};

export default zhHant;
