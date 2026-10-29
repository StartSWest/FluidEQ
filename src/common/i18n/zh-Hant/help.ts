/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const help = {
  'help.menu': '幫助',
  'help.title': '使用者指南',
  'help.subtitle': '找到你的聲音。請隨便一點，就像在自己家一樣。',
  'help.intro':
    'FluidEQ 實用指南，以真實應用程式擷取進行說明。從您的第一次聆聽會話開始，然後按照您自己的步調探索應用程式的每個部分。',
  'help.offline': '離線可用',
  'help.search': '搜尋指南',
  'help.searchHint': '嘗試引擎、低音、視覺化器…',
  'help.contents': '在本指南中',
  'help.results': '{count} 章節',
  'help.resultsOne': '{count}章',
  'help.empty': '沒有找到章節。嘗試使用較短的短語或清除搜尋。',
  'help.clear': '清除搜尋',
  'help.close': '關閉指南',
  'help.enlarge': '放大截圖：{title}',
  'help.closeImage': '關閉截圖',
  'help.controlsOf': '{title} 中每個控制項的作用',
  'help.captureNote':
    'FluidEQ 視窗的真實擷取。您的版本中的顏色、標籤和控制位置可能有所不同。範例設定僅供參考，並非建議的預設。',
  'help.steps': '嘗試一下',
  'help.tip': '很高興知道',
  'help.back': '回到頂部',
  'help.group.start': '開始使用',
  'help.group.sound': '塑造你的聲音',
  'help.group.visuals': '檢視您的音樂',
  'help.group.plus': '展示臺和您的帳戶',
  'help.group.listen': '聆聽、唱歌和分享',
  'help.group.help': '當你需要幫助時',
  'help.start.title': '你的前五分鐘',
  'help.start.intro':
    '以舒適的音量播放一首熟悉的歌曲開始。左側導軌開啟 FluidEQ 並保持 前級增益；中心是您的工作空間；右軌跟隨您的輸出及其設定檔。視窗底部的欄控制正在播放的內容。',
  'help.start.steps':
    '安裝 FluidEQ 並在安裝程式詢問如何處理聲音時保持選擇 FluidEQ 引擎。 Windows 會要求一次許可，無須重新啟動。\n在輸出裝置下選擇您的收聽裝置。開啟系統等化器並保持自動標準化。\n播放一首歌曲，開啟 EQ → Bands，進行小的更改，然後與系統 EQ 進行比較。',
  'help.start.tip':
    '系統範圍的 EQ 需要 Windows 和音訊引擎：FluidEQ 引擎或 Equalizer APO。在 macOS 和 Linux 上，該應用程式顯示演示輸出，因此移動圖表並不能證明任何內容都已處理。',
  'help.start.keywords':
    '安裝、安裝程式、設定、設定、入門、第一步、快速入門、初學者、基礎知識、教學、如何使用、開始',
  'help.start.videoTitle': '使用 FluidEQ 的第一步',
  'help.start.videoNote':
    '約四分鐘，提供英語語音與英語字幕。按下播放後會從 fluideq.com 載入。',
  'help.video.play': '播放影片：{title}',
  'help.video.loading': '從 fluideq.com 載入...',
  'help.video.failed':
    '影片無法載入。它從 fluideq.com 播放，因此需要網路連線。',
  'help.video.retry': '再試一次',
  'help.video.open': '在 fluideq.com 上開啟',
  'help.window.title': '認識視窗介面',
  'help.window.intro':
    '標題將帶您在 FluidEQ 的頁面之間切換，並顯示播放時的聲音。左側導軌容納整個 EQ、前級增益 和電平表的開關；右軌跟隨您的輸出及其設定檔。',
  'help.window.steps':
    '按標題中的頁面：訊號之前的線上媒體、共享音訊和 EQ，之後是 DSP、庫、卡拉 OK 和展示臺。\n開啟左軌中的系統等化器並保持自動標準化，這樣就不會出現任何升壓削波的情況。\n按電平表可變更其繪製方式，按訊號上的彩色可在調色盤中顯示頻段、標題和點亮控制元件，而不是單一顏色。',
  'help.window.tip':
    '幫助可開啟本指南、新增功能、音訊疑難排解和回報問題。旁邊的選單按鈕，三行，包含引擎卡、您的帳戶、匯入 EQ 設定或 脈衝響應、重新啟動 Windows 音訊、程式（顯示 FluidEQ 的每個部分正在使用的內容）以及重設所有設定；其底部是亮度、色調、彩色托盤模式、色調應用程式（圖示開始和語言。他們後面的開關將視窗變成緊湊型播放器。',
  'help.window.keywords':
    '視窗, 視窗顏色, 多彩模式, 彩虹, 動畫, 語言, 亮度, 色調, 圖示, 工作列, 佈景主題, 開機',
  'help.window.headerLeftCaption': '標頭，直至訊號',
  'help.window.headerRightCaption': '標頭，在訊號之後',
  'help.window.railCaption': '左導軌',
  'help.window.media':
    'YouTube、YouTube Music、Bandcamp、Twitch 和 Suno 在 FluidEQ 中播放並使用您的 EQ。',
  'help.window.share':
    '將這臺電腦的聲音傳送到另一臺電腦，或在此處播放另一臺電腦的聲音。',
  'help.window.eq': '您的頻段、預設、耳機校正、遊戲預設和引擎的配置。',
  'help.window.waveName': '音訊訊號',
  'help.window.wave':
    '正在播放的內容，正如它所播放的那樣，具有最高水平。 Colourful（顏色）位於其頂部，用於開啟或關閉色彩模式；圖表的「檢視」功能表可以將其隱藏。',
  'help.window.dsp': '效果架：預設、房間和鏈的每個階段。',
  'help.window.library': '您的音樂檔案、專輯和播放佇列。',
  'help.window.karaoke': '跟著唱，用自己的歌製作卡拉 OK。',
  'help.window.plus': '展示臺、畫廊、工作室和動態照明。',
  'help.window.support': '支援 FluidEQ 工作的方法。',
  'help.window.help': '本指南、新增功能、音訊疑難排解和報告問題。',
  'help.window.actions':
    '引擎、您的帳戶、匯入 EQ 設定、重新啟動 Windows 音訊、處理和重設所有設定；亮度、色調、彩色模式和色調應用程式圖示、EQ 滑桿、動畫、從 Windows 開始和語言。',
  'help.window.systemEq': '開啟或關閉 FluidEQ 對 PC 播放的所有內容的處理。',
  'help.window.preamp':
    '降低 EQ 之前的電平，以便提升有空間。自動標準化為您設定。',
  'help.window.autoNormalize':
    '將 前級增益 保持在足夠低的水平，使任何增強都不會削波。',
  'help.window.responseGraph': '顯示或隱藏響應圖。',
  'help.window.meterName': '電平表',
  'help.window.meter': '左、右輸出電平，以實際分貝為單位。按它可以更改其樣式。',
  'help.player.title': '輕巧播放器',
  'help.player.intro':
    '一個開關將 FluidEQ 的視窗變成緊湊型播放器，一個狹窄的列：頂部有一個視覺化工具，上面有歌曲，下面是播放控制元件，然後是聲音、等化器，然後是下一個和播放清單。無論正在播放的內容都會繼續播放，並且相同的開關會將完整的應用程式帶回您離開的頁面。',
  'help.player.steps':
    '按標題列中「幫助」旁的「緊湊型播放器」開關。在播放器上，相同的開關可以恢復完整的應用程式。\n將“聲音”或“下一個”和“播放清單”折疊到其標題，視覺化工具佔據空間；按標題再次開啟它。拖曳播放器的頂部或底部邊緣以使其更高或更低。\n雙擊視覺化工具以使其充滿螢幕；逃脫將其還給你。按隨機播放旁邊的造型名稱並重複，即可從每種風格和場景中進行選擇。\n在 FluidEQ 標記的選單中選擇“折疊到一行”，將播放器折疊到一行；標記將其展開。\n在同一選單中，設定播放器自己的亮度、場景的透明度或標準樣式的視窗色調以及場景的日光。始終位於頂部、那裡或標題中，使其保持在其他視窗之上。\n將音樂檔案拖放到播放器上的任何位置：它們會加入庫和「下一個」的末尾，或者在清單上方，您放開的地方。',
  'help.player.tip':
    '播放器的音量是您電腦自己的音量，與 Windows 中的音量相同，因此它決定了電腦播放的所有內容的等級。如果播放器最終離開螢幕，請右鍵點選工作列托盤中的 FluidEQ，然後選擇恢復視窗。',
  'help.player.keywords':
    '迷你播放器、小播放器、緊湊、緊湊模式、winamp、amp、播放器模式、始終在頂部、固定、折疊、一行、佇列、下一個、刪除檔案、主題、淺色主題、深色主題、深色模式、淺色模式、小視窗、浮動播放器、音量',
  'help.player.topCaption': '頂部：歌曲及其演奏方式',
  'help.player.eqCaption': '聲音，你的等化器',
  'help.player.queueCaption': '接下來',
  'help.player.menuCaption': '播放器的選單',
  'help.player.foldedCaption': '折疊成一行',
  'help.player.menu':
    '返回完整的應用程式或其頁面之一；播放器自己的亮度、透明度或色調、場景的日光、彩色模式、色調應用程式圖示和 EQ 滑桿；始終位於頂部並折疊成一行。',
  'help.player.pin': '將播放器保持在所有其他視窗上方。',
  'help.player.switch': '返回完整的應用程式，在您離開的頁面上。',
  'help.player.clock': '時間發揮了。單擊它以獲取剩餘時間。',
  'help.player.level': '離開 FluidEQ 的聲音等級（以分貝為單位）。',
  'help.player.volume':
    '您電腦的音量，與 Windows 中的音量相同：它設定電腦播放的所有內容的音量。',
  'help.player.seek': '歌曲在哪裡。拖曳即可跳躍。',
  'help.player.playingName': '播放控制',
  'help.player.playing':
    '上一首、後退五秒、播放或暫停、前進五秒、下一首和停止。',
  'help.player.orderName': '隨機播放並重複',
  'help.player.order': '隨機播放下一首，不重複任何內容、所有內容或這首歌。',
  'help.player.lookName': '看',
  'help.player.look':
    '視覺化工具正在繪製的風格或場景。按它可以從所有選項中進行選擇。',
  'help.player.bands':
    '向上或向下拖曳頻段以增強或減弱它。它的頻率寫在它的下面。',
  'help.player.tone': '音調顯示低音、中音和高音旋鈕；旁邊的分頁，每個頻段。',
  'help.player.upNext':
    '接下來是播放清單，每個清單都包含有多少個播放清單，以及佇列中剩餘的時間。',
  'help.player.songsName': '歌曲',
  'help.player.songs':
    '接下來播放什麼。點選歌曲進行播放，拖曳進行移動，或將音樂檔案拖曳到此處以將其新增至您放開的位置。',
  'help.player.openIn': '在其頁面之一上開啟完整的應用程式。',
  'help.player.theme':
    '除了完整應用程式的亮度之外，播放器自己的亮度；場景的透明度，或標準樣式的視窗色調；場景的日光；多彩模式；以及為應用程式圖示著色，首先關閉，用於工作列圖示、托盤圖示和托盤選單中的圖示的視窗顏色。',
  'help.player.fold': '將播放器折疊到一行。',
  'help.player.unfold': '展開播放器。另一端的箭頭也是如此。',
  'help.player.foldedPlaying': '播放或暫停。',
  'help.player.fullScreen':
    '用視覺化工具填滿螢幕。雙擊圖片也會執行相同的操作，然後按 Escape 鍵返回螢幕。',
  'help.player.sourceName': '來源',
  'help.player.source':
    '歌曲的來源：媒體庫、線上媒體、卡拉 OK、另一臺電腦或此 PC 上的其他程式。按下它會在完整的應用程式中開啟該頁面。',
  'help.player.heart': '將歌曲從庫新增到您的收藏夾，或將其刪除。',
  'help.player.soundFold':
    '將聲音控制向下折疊到這一行，這樣可以保留預設、Smart EQ 和開關，然後再次開啟它們。',
  'help.player.mode': '開啟 EQ 模式：EQ 和曲線的應用強度、頻帶 Q、相位和高音。',
  'help.player.save': 'Keep Up next 作為自己的播放清單。',
  'help.player.queueFold':
    '接下來折疊起來，播放清單向下折疊到其分頁，視覺化工具佔據了空間。',
  'help.player.remove': '從 Up next 中取出一首尚未播放的歌曲。',
  'help.player.output': '聲音的去向：Windows 播放的輸出。',
  'help.player.engineName': '引擎',
  'help.player.engine': 'FluidEQ 開啟時，哪個引擎正在塑造聲音，該燈會亮起。',
  'help.player.sliders': 'EQ 滑桿上的圓形手柄或矩形蓋，位於此處和 EQ 頁面上。',
  'help.requirements.title': '您的電腦需要什麼',
  'help.requirements.intro':
    'FluidEQ 可在過去十年的任何 Windows PC 上運作。有兩個部分比其他部分要求更多：場景在顯示卡上繪製，卡拉 OK AI 在您第一次使用時下載其模型。',
  'help.requirements.steps':
    '檢查您的 Windows：Windows 10 版本 1803 或更高版本，或 Windows 11，64 位，4 GB 記憶體和約 600 MB 磁碟。處理 PC 播放的所有內容都需要 FluidEQ 引擎或 Equalizer APO，Windows 在安裝時會要求一次許可。\n檢視視覺化工具：2013 年以來的任何顯示卡或內建顯示卡。 1080p 內建顯示卡就足夠了； 4K 或同時在多個螢幕上顯示桌面背景更適合使用專用卡。在繁忙的卡片上，FluidEQ 將場景縮小並放棄您看不到的場景。\n試試卡拉 OK AI：分離語音第一次下載 713 MB 模型，音高模型增加約 360 MB，噪音移除 11 MB。使用 DirectX 12 顯示卡，一首四分鐘的歌曲在大約半分鐘內就可以分離；僅在處理器上就需要大約四分鐘。工作時保持 2 GB 空閒記憶體。\n如果可以的話，就瞄準這個目標：Windows 11、8 GB 記憶體、2018 年以後的顯示卡，如果使用 AI 功能，則需要 3 GB 可用磁碟空間。',
  'help.requirements.tip':
    '除了人工智慧模型之外的所有內容都在安裝程式中，並且僅在您第一次使用該功能時才下載。操作選單中的程式顯示 FluidEQ 的各個部分目前在您的電腦上使用的內容。',
  'help.requirements.keywords':
    '系統需求、需求、規格、硬體、筆記型電腦、GPU、顯示卡、顯示卡、CPU、處理器、RAM、記憶體、磁碟空間、儲存、Windows 10、Windows 11、最低、推薦、效能、慢、延遲、相容性、Mac、MacOS、Linux',
  'help.engine.title': 'FluidEQ 引擎',
  'help.engine.intro':
    'FluidEQ 使用自己的引擎或 Equalizer APO 處理您的聲音。 FluidEQ 引擎在音效卡效果之後在 Windows 音訊服務中執行，將 EQ 和 DSP 效果器機架 帶到 PC 播放的所有內容中，並在 FluidEQ 關閉時退出。',
  'help.engine.steps':
    '開啟操作選單（右上角的脈衝按鈕），然後按下其頂部的引擎卡。\n選擇 FluidEQ 引擎並按應用。 Windows 會要求許可，重新啟動時音訊會暫停幾秒鐘。\n如果輸出顯示“關閉”，請按其通知中的“啟用”。如果通知顯示引擎未執行，請按「重新啟動 Windows 音訊」。',
  'help.engine.tip':
    'Equalizer APO 仍可用於自訂 APO 指令、Peace 和 VST 外掛程式。當更新帶來更新的引擎時，會發出通知，提供更新引擎。從托盤中退出 FluidEQ 會關閉每個輸出上的等化器。',
  'help.engine.keywords':
    '音訊引擎、apo、驅動程式、系統範圍、所有應用程式、每個應用程式、Spotify、瀏覽器、不和諧、啟用、啟動、開啟、Windows 音訊、許可權、管理員、更新引擎、切換引擎',
  'help.engine.fluid':
    '推薦。您的音效卡效果繼續發揮作用，EQ 和 DSP 效果器機架 到達每個應用程式。',
  'help.engine.apo':
    '執行自訂 APO 命令、Peace 和 VST 外掛。 DSP 效果器機架 保持庫播放。',
  'help.engine.apply':
    '切換引擎。 Windows 詢問一次，然後音訊會重新啟動幾秒鐘。',
  'help.eq.title': '用 EQ 塑造您的聲音',
  'help.eq.intro':
    '頻率選擇頻段的作用位置，增益設定增強或減弱，Q 設定其寬度：Q 越高，越窄。在未選擇頻段的情況下，音調旋鈕（低音、中音和高音，以及兩側的低切和高切）將聲音塑造為自己的曲線，並讓您的頻段保持原樣。從小的、廣泛的改變開始，並經常進行比較。',
  'help.eq.steps':
    '開啟 EQ → 頻段。在不進行任何選擇的情況下，轉動低音、中音或高音可快速改變音調，轉動低切或高切可修剪極端。他們在圖表上繪製自己的音調線。\n單擊頻段的頻率或其在圖表上的點將其選中。轉動其頻率、增益和質量 (Q) 旋鈕，選擇一個濾波器，或使用“活動”將其關閉。當您移動滑塊時，曲線會跟隨滑塊移動。\n一切都可以透過鍵盤進行：按 Tab 切換到推桿、轉盤或圖表上的點，然後使用箭頭鍵步進； Page Up 和 Page Down 採取更大的步驟。\n若要在圖表上檢視每個頻段的頻率、Q 和增益，請開啟其上方的“檢視”並按“顯示 EQ 標籤”，或按 Ctrl+W 直至顯示“全部”。標籤位於其點的上方或下方，而不是在其旁邊，一旦有空間就會回到原來的位置。\n右鍵單擊頻段可將其重設、關閉或在其旁邊新增頻段。按 Clear EQ 將每個增益以及低音、中音和高音設定為 0 dB，同時保持頻段不變。它首先詢問。\n同一選單有刪除帶，要求在刪除之前再按一次。左 + 右將一個頻帶變成每隻耳朵的一個頻帶，頻率相同，因此您可以單獨移動每個頻帶：左耳的曲線繪製為實線，右耳的曲線繪製為虛線。兩隻耳朵再次在中間連線起來，重設頻段和清晰等化器也是如此。',
  'help.eq.tip':
    '曲線列出了除您的頻段之外的輸出形狀，每條曲線都有自己的強度和 ×。遊戲模式減少了 FluidEQ 增加的延遲，適合遊戲和通話；遊戲預設將其開啟。當 EQ 關閉時，其頻段會變暗並且無法意外更改；音調旋鈕仍然有效。',
  'help.eq.keywords':
    '等化器, EQ, 頻段, 頻率, 增益, Q, 標籤, 鍵盤, 快捷鍵, 低音, 中音, 高音, 濾波器, 參數, 圖形',
  'help.eq.bandsCaption': '頻段頁面，未選擇任何內容',
  'help.eq.bandCaption': '選定的頻段',
  'help.eq.gameMode': '減少 FluidEQ 為遊戲和通話增加的延遲。遊戲預設將其開啟。',
  'help.eq.layers':
    '還有什麼因素影響這個輸出——耳機校正、Smart EQ、卷積——每個都有其強度、開關和 ×。',
  'help.eq.bandName': '一支頻段',
  'help.eq.band':
    '拖動其點以增強或剪下，或使用箭頭鍵步進。單擊其頻率將其選中。',
  'help.eq.labelName': '帶標籤',
  'help.eq.label':
    '它的頻率、Q 和增益高於或低於其點。檢視 → 顯示 EQ 標籤，或 Ctrl+W。',
  'help.eq.bass': '升高或降低整個曲線的低端。',
  'help.eq.mid': '升高或降低聲音所在的中間位置。',
  'help.eq.treble': '升高或降低頂部、空氣和細節。',
  'help.eq.selected':
    '正在編輯的頻段。按住 Ctrl 鍵單擊或按住 Shift 鍵單擊可選擇多個。',
  'help.eq.filter': '其形狀：峰形、架形、陷波形或帶通濾波器。',
  'help.eq.voicing': '聲音的現成鏈，例如音樂或流派。沒有人只留下自己的頻段。',
  'help.eq.smart': '聆聽播放的內容並進行修正：細節、平衡或目標。',
  'help.eq.clear': '將每個增益設為 0 dB 並保留您的頻段。先問。',
  'help.eq.mode':
    '將 EQ 模式卡帶入視野：EQ 和曲線的應用強度、頻帶 Q、相位和高音。',
  'help.eq.add': '在所選頻段旁邊新增一個頻段，位於已有頻段的 Q 處。',
  'help.eq.layouts':
    '條帶很重要，每個條帶都從一個 Q 開始，以及您儲存的條帶設計。',
  'help.eq.frequency': '所選頻段起作用的地方，從 1 Hz 到 20 kHz。',
  'help.eq.gain': '它增加或減少了多少。按住 Ctrl 鍵可將其恢復至 0 dB。',
  'help.eq.q': '它有多寬：越高越窄。',
  'help.eq.delete': '按兩次刪除波段；不斷改變你的想法。',
  'help.eq.menuCaption': '頻段的右鍵選單',
  'help.eq.reset': '增益回到 0 dB，Q 回到 2。',
  'help.eq.disable': '將頻段從聲音中取出並保留其設定。',
  'help.eq.addLeft': '在其下方鄰居的中間新增一條帶。',
  'help.eq.addRight': '在其較高鄰居的中間新增一條帶。',
  'help.eqmode.title': 'EQ 模式和頻段設計',
  'help.eqmode.intro':
    'EQ 模式可以改變聲音的形成方式，而無需進行任何編輯。它的設定是 EQ 頁面上側面板的第一張卡，在它們更改的曲線旁邊，在兩個分頁中：您的 EQ 涵蓋您的頻段、音調、預設、驅動器型別和 Smart EQ；校正包括耳機校正和匯入或自定義曲線。頻段設計可保持您喜歡的佈局的頻率和 Q 值，為任何輸出做好準備。',
  'help.eqmode.steps':
    '按圖表上方的 EQ 模式。該卡將進入視野，如果側面板已關閉，則側面板將開啟。\n選擇“您的 EQ”或“校正”分頁，然後在播放音樂時嘗試選擇“強度”或“頻段 Q”。在 FluidEQ 引擎下，為每個分頁選擇最小或線性相位以及精確或經典高音。\n在校正上，曲線平滑可以軟化 1/12 或 1/3 倍頻程的取樣曲線；它處於關閉狀態，直到您選擇為止。重設使一切恢復正常，並平滑恢復關閉。\n您想要一份選單嗎？按下卡片上的引腳：EQ 模式然後在圖表上作為選單開啟，並且該選單中的引腳使卡片返回。\n開啟“新增頻段”旁邊的佈局按鈕。選擇 6、10、15、20 或 31 個頻段，或按「儲存設計...」命名目前佈局。',
  'help.eqmode.tip':
    '新的佈局以一個 Q 開始每個頻段，並且您新增的頻段採用其他頻段的 Q。設計僅儲存頻率和 Q：從 0 dB 開始載入每個頻段。線性相位會增加延遲，並且可能會在尖銳的撞擊之前響起。選擇內建佈局會帶來全新體驗：它自己的頻率和 Q 值，每個頻段均為 0 dB，雙耳均如此。',
  'help.eqmode.keywords':
    'EQ 模式, 固定, 釘選, 相位, 最小相位, 線性相位, 精準, 經典, Q 值, 強度, 校正',
  'help.eqmode.modeCaption': 'EQ 模式卡',
  'help.eqmode.tabsName': '您的 EQ 與校正',
  'help.eqmode.tabs': '兩個分頁，每個分頁都有自己的設定。',
  'help.eqmode.pin': '將這些設定放回圖表上方的選單中。選單的別針將卡帶回來。',
  'help.eqmode.strength': '正常、工作室 ×1.5 或 ×2。每個分頁都有自己的。',
  'help.eqmode.q':
    '固定 Q 會維持各頻段的 Q 值；比例式與非對稱式則會在增益提高時縮窄頻段。在「您的 EQ」中，它只影響您自己的頻段，不影響預設或校正。',
  'help.eqmode.smoothing':
    '軟化 1/12 或 1/3 倍頻程的取樣校正曲線。關閉直到您選擇為止。',
  'help.eqmode.phase': '每個分頁的最小值或線性。僅適用於 FluidEQ 引擎。',
  'help.eqmode.treble':
    '精準演奏所畫的高音；如 Equalizer APO 一樣經典。僅適用於 FluidEQ 引擎。',
  'help.eqmode.reset': '一切恢復正常，曲線平滑恢復關閉。',
  'help.eqmode.designsCaption': '頻段設計',
  'help.eqmode.builtIn': '6、10、15、20 或 31 段的標準版面。',
  'help.eqmode.save': '將目前頻率和 Q 命名為設計，列在「我的設計」下。',
  'help.games.title': '遊戲預設',
  'help.games.intro':
    '為每個遊戲賦予自己的聲音。當遊戲進行到最前面時，FluidEQ 會切換到該聲音並一直保持到您關閉遊戲為止，無論您在中間按 alt-tab 鍵選擇什麼。然後它會放回你擁有的東西。',
  'help.games.steps':
    '開啟 EQ → 遊戲預設並按下新增遊戲。從您的啟動器中選擇一個現在開啟的程式，或者您自己選擇它的程式。\n選擇應在其行的選擇器中獲得的聲音：遊戲預設或任何其他聲音。\n開始遊戲。桌面上的一張卡片顯示 FluidEQ 切換到的內容，另一張卡片顯示關閉它後返回的內容。',
  'help.games.tip':
    '當遊戲保留聲音時，視窗底部的欄會為其命名。在演奏時選擇另一個聲音，它會保持不變：FluidEQ 只會恢復它所放的內容。遊戲預設也會開啟遊戲模式。',
  'help.games.keywords':
    '遊戲、遊戲設定檔、每個遊戲、每個遊戲、每個應用程式、自動、自動切換、蒸氣、史詩、啟動器、FPS、射手、腳步、競技、alt-tab、遊戲模式',
  'help.games.tab': '您的遊戲和每個人都能聽到的聲音。',
  'help.games.add':
    '新增 Steam、Epic、EA、GOG、Ubisoft、Battle.net 或 Xbox 的遊戲，或任何現在開啟的程式。',
  'help.games.gameName': '一場遊戲',
  'help.games.game': '遊戲和資料夾 FluidEQ 都知道它。',
  'help.games.soundName': '它的聲音',
  'help.games.sound': '當這個遊戲來到前面時，聲音 FluidEQ 切換到，或保持原樣。',
  'help.games.removeName': '移除',
  'help.games.remove': '忘記了遊戲。它使用的預設保留。',
  'help.headphones.title': '耳機校正與匯入',
  'help.headphones.intro':
    '耳機校正可補償測量的模型。這是您可以與自己的頻段和預設相結合的起點。在應用結果之前，請檢查確切的型號和測量作者。',
  'help.headphones.steps':
    '開啟 EQ → EQ 預設並搜尋您的耳機型號。檢查可用的測量資料，選擇與型號相符的項目。\n如要使用其他工具匯出的 EQ 文字，請在操作選單中選擇「匯入 EQ 設定」。套用前先檢查解析出的頻段與曲線。\n如要使用 Squiglink，請開啟「我的曲線」並選擇「從 Squiglink 匯入」。貼上匯出內容，檢查即時曲線預覽。「儲存到我的曲線」會保留曲線供日後使用；「儲存並套用」也會將其用作耳機校正。「套用至可編輯的 EQ」則會在確認後取代您的頻段。\n「我的曲線」是 OPRA 媒體庫旁的個人清單：「新增曲線」可使用 Squiglink 匯出內容、.txt 檔案、目前的 EQ 或 OPRA 項目。每條曲線皆可「套用為曲線」或「套用為 EQ」，選單也可重新命名、編輯頻段、建立副本、複製為文字或刪除。「匯出清單」與「匯入清單」可將整份清單移至另一臺電腦。\n「套用為 EQ」旁的「匯入至」可選擇雙耳、左耳或右耳：選擇單耳時，只會取代該耳的頻段，另一耳維持原狀。',
  'help.headphones.tip':
    '標記為「未套用」的預覽不會改變您的聲音。避免對同一個耳機疊加兩個完整的校正，除非是故意的；與關閉耳機層進行比較。',
  'help.headphones.keywords':
    '耳機, 耳機麥克風, 入耳式耳機, 校正, 頻率響應, 測量, OPRA, AutoEQ, Squiglink',
  'help.convolution.title': '使用脈衝響應',
  'help.convolution.intro':
    '卷積會將 WAV 脈衝響應套用為另一層校正。FluidEQ 提供可搜尋的 AutoEq 目錄，也可匯入您自己的 WAV 檔案。它與可編輯的參數式 EQ 頻段分開運作。',
  'help.convolution.steps':
    '開啟 EQ → 卷積，依型號或測量作者搜尋。\n確認來源後，選擇「下載並套用」；下載檔案的取樣率會符合您的輸出。已有的檔案則使用「匯入 WAV」。\n在「曲線」中開啟及關閉卷積層，比較聆聽效果。',
  'help.convolution.tip':
    'FluidEQ Engine 會自行轉換脈衝響應的取樣率。Equalizer APO 則需要匯入與輸出取樣率相同的 WAV。下載目錄內容需要網路連線，閱讀指南則不需要。',
  'help.convolution.keywords':
    '脈衝響應、ir、wav、convolver、fir、房間校正、rew、autoeq 目錄、校正檔案',
  'help.profiles.title': '裝置、設定檔和第二個輸出',
  'help.profiles.intro':
    '每個輸出都保留自己的聲音：EQ、預設、音調、剪下、DSP 效果器機架、房間和調平都會隨之儲存，並在您切換到它時返回。設定檔保留相同輸出的其他聲音。第二個輸出同時在另一個裝置上播放，並具有自己的聲音和電平。',
  'help.profiles.steps':
    '編輯前檢查輸出卡頂部的輸出；藍牙耳機旁邊顯示了電池。對您想要保留的聲音使用新設定檔；更新儲存對該設定檔的更改，恢復則恢復其已儲存的設定。\n開啟記住每首歌曲的聲音，只要在此處播放該歌曲，您在歌曲中設定的預設、音調和等化器就會返回。通知上是這麼說的，「撤銷並忘記這首歌」。\n開啟第二個輸出，開啟裝置並設定其電平。選擇其下方的設定檔，或按「編輯聲音」在 EQ 頁面上更改其聲音，而無需切換主輸出；完成或編輯主要帶您返回。\n每個第二輸出保持其自身的時間並以毫秒為單位顯示其延遲；使用共享音訊，另一臺電腦的聲音會顯示其自身的延遲，包括網路延遲。',
  'help.profiles.tip':
    '在 FluidEQ 引擎下，第二個輸出直接從引擎播放，主輸出從不等待。記住每首歌曲的聲音開始時關閉，並記住每個輸出。在 EQ 頁面上，面板以 EQ 模式卡開始；折疊它以更快地達到輸出。',
  'help.profiles.keywords':
    '設定檔, 輸出, 裝置, 電量, 電池, 歌曲, 曲目, 編輯音效, 編輯聲音, 耳機, 音量, 靜音, 第二輸出, 鏡像, 每首歌的音效',
  'help.profiles.list':
    '聽起來你儲存了。 ON 標記該輸出所使用的輸出；按另一個即可切換。',
  'help.profiles.update':
    '將您的變更儲存到您所在的設定檔中。旁邊的「復原」可將設定檔還原為您上次儲存的狀態。',
  'help.profiles.new': '從您現有的 EQ 開始新的設定檔。',
  'help.profiles.eqMode':
    'EQ模式的設定，首先在EQ頁面。將卡片折疊起來，以免妨礙操作。',
  'help.profiles.songSound':
    '每當此處播放歌曲時，都會帶回歌曲的預設、音調和等化器。關閉直到您將其開啟。',
  'help.profiles.editSound': '在 EQ 頁面上編輯該輸出的聲音，而無需切換主輸出。',
  'help.profiles.output':
    '您正在收聽的輸出，以及用於藍牙耳機的電池。 OFF 表示你的EQ沒有達到；ACTIVE，Windows 正在透過它進行播放。',
  'help.profiles.onePlayer':
    '在 FluidEQ 中啟動某些內容會暫停 PC 上其他地方播放的內容，反之亦然。',
  'help.profiles.outputs':
    '你的其他輸出。開啟一臺也可以在那裡播放，有自己的聲音、電平和延遲（以毫秒為單位）。',
  'help.profiles.driver':
    '一個溫和的起點，從你所聽的東西開始——頭戴式耳機、入耳式耳機、驅動器尺寸或材料。如果聲音已經正確，請將其保留為“無補償”。',
  'help.config.title': '檢查並備份鏈條',
  'help.config.intro':
    'EQ → 設定顯示音訊引擎在磁碟上實際擁有的內容。輸出卡和包含樹可協助您檢視涉及哪些裝置和層。在大型實驗之前或移動設定時匯出鏈。',
  'help.config.steps':
    '開啟 EQ → 設定並選擇您想要檢查的輸出。讀取其狀態和活動層。\n使用匯出鏈儲存 .fluideq 檔。將副本保留在您可以再次找到的地方。\n若要恢復鏈，請先選擇預期輸出，然後使用匯入鏈並檢視結果。',
  'help.config.tip':
    '產生的圖層檔案在設定變更時會被重寫；將持久的手動行放入每個輸出的自訂檔案中。 FluidEQ 引擎讀取其 Filter、前級增益、GraphicEQ 和 Convolution 行；其他 APO 命令和外掛需要 Equalizer APO。',
  'help.config.keywords':
    '備份、還原、匯出、匯入、配置、設定檔、apo 配置、文字檔案、fluideq 檔案、鏈檔案、包含、自訂行、高階',
  'help.dsp.title': '探討 DSP 效果器機架',
  'help.dsp.intro':
    'DSP 效果器機架 是一系列工作室舞臺。在 FluidEQ 引擎下，它處理 PC 播放的所有內容；在 Equalizer APO 下，它處理庫音軌。當 FluidEQ 關閉時，它會關閉。',
  'help.dsp.steps':
    '開啟DSP。在「預設」下方選擇一條鏈，或在導軌中選擇一個階段並將其開啟。\n一次更改一個控制，並與相似音量下旁路的階段進行比較。隔離讓您只能聽到舞臺新增的內容。\n儲存您喜歡的機架，然後使用「匯出」和「匯入」來分享它。\n齒音消除器 僅在聲音發聲時調低尖銳的 S、T 和 SH，而只留下鐃鈸；語音、播客和有聲讀物將其開啟。每個階段都可以保留自己的設定檔：設定它，然後按「儲存」。',
  'help.dsp.tip':
    '響亮的聲音通常聽起來更好，只是因為聲音更大，因此請在匹配的級別進行比較。按住 Ctrl 鍵點選錶盤可將其還原為預設值。',
  'help.dsp.keywords':
    '效果，fx，音訊效果，機架，鏈，外掛，限制器，響度，標準化器，水平器，音量調節，激勵器，諧波，增強器，立體聲加寬器，加寬，立體聲寬度，低音增強器，低音，分諧波，打孔，瞬態，母帶處理，剪輯，峰值限制器，交叉淡入淡出，無間隙，齒音消除器，去嘶聲，嘶嘶聲，刺耳的聲音，尖銳的聲音，ess，聲音，語音、播客、設定檔、儲存設定檔',
  'help.dsp.normalizer': '使響度均勻。在現場音訊中，它會逐首歌地進行分級。',
  'help.dsp.denoise':
    '修復嘶嘶聲、嗡嗡聲和咔噠聲。神經語音清理器適用於庫曲目。',
  'help.dsp.exciter': '加入身體和空氣的和聲。',
  'help.dsp.bassForge':
    '在低音下方新增一個真正的八度音階，或為小型喇叭新增諧波。',
  'help.dsp.equaliser': '十五個引數帶，具有最小或線性相位。',
  'help.dsp.bassPunch': '塑造低音的起音、延音和綻放。',
  'help.dsp.dimension': '在不改變單聲道和的情況下拓寬立體聲影像。',
  'help.dsp.room': '耳機環繞聲：每個聲道都成為您周圍房間中的喇叭。',
  'help.dsp.maximizer': '提高電平而不讓峰值超過天花板。',
  'help.dsp.master': '最終電平、響度目標和峰值安全。',
  'help.dsp.crossfade': '將一個庫曲目混合到下一個庫曲目。',
  'help.dsp.presets': '適用於流派、裝置和維修的整架連鎖店。',
  'help.room.title': 'The Room：耳機環繞',
  'help.room.intro':
    'The Room 將耳機變成了聽音室。聲音的每個通道都變成了站在您頭部周圍的喇叭，透過測量的頭部和您自己塑造的房間的反射進行渲染，因此一部電影就在您面前，一場遊戲圍繞著您。它需要FluidEQ引擎和耳機；對喇叭來說它沒有任何用處。',
  'help.room.steps':
    '開啟 DSP，選擇軌道中的 Room 並將其開啟。立體聲變成您面前的兩個喇叭； 5.1 電影五及分；一場7.1遊戲全環。開關旁邊的晶片說明瞭具體情況。\n在頂部選擇一個房間——工作室、客廳、電影院、音樂廳等等——或者自己調整大小、牆壁和距離，然後在環上拖曳喇叭。播放串流無法到達的喇叭已進入睡眠狀態。\n按開始聽力測試並回答五個簡短的聽力對：房間佔據將聲音放在您面前的頭部。小號、中號和大號也可以手動選擇。\n以名字儲存您喜歡的房間；儲存的房間按一下即可返回，並且永遠不會改變您的想法。',
  'help.room.tip':
    '遊戲和電影僅將其環繞聲道傳送到 Windows 認為具有多個喇叭的輸出：當驅動程式使用它時，輸出面板會按一下即可提供 7.1。',
  'help.room.keywords':
    '聆聽室, 空間音訊, 環繞音效, 立體音場, 虛擬環繞, HRTF, 頭部模型, 聆聽測試, 殘響, 5.1, 7.1',
  'help.room.picker': '從房間開始，像其他舞臺的輪廓一樣分組；定型後即可定製。',
  'help.room.picture':
    '從上方看房間：牆壁在吸收時逐漸褪色，喇叭位於環上，頭部位於中間。所有這些都以一個比例繪製，因此站在比房間寬度更遠的位置的喇叭被繪製在牆外。拖曳一個，它的一對就會隨之移動；按住 Shift 鍵可單獨移動它。',
  'help.room.speaker':
    '按下房間中的喇叭，該窗格就會變成自己的：它的角度（作為數字）、它自己的距離、它的電平，以及靜音或獨奏以單獨聽到它。',
  'help.room.speakerName': '所選演講者',
  'help.room.dialsName': '空間、氛圍、距離',
  'help.room.dials':
    '您可以聽到多少牆壁、牆壁後面的軟尾音以及喇叭站立的距離。尺寸、牆壁和尾巴本身的長度和色調在下面的房間字元中。',
  'help.room.fit': '五對傾聽者，為你的耳朵挑選頭部。',
  'help.room.head': '房間渲染時所測量的頭部：小、中或大。',
  'help.room.saved': '以現在的情況命名房間；按一下它就會回來。',
  'help.room.liveName': '房間在做什麼',
  'help.room.live': '從引擎中讀取：播放串流到達哪些喇叭，或是房間為何空閒。',
  'help.denoise.title': '去噪和源分析',
  'help.denoise.intro':
    '降噪可減少嘶嘶聲、電源嗡嗡聲和喀噠聲。在 FluidEQ 引擎下，它可以在 PC 上播放的任何內容上即時執行；神經語音清理器和掃描本底噪聲適用於庫曲目。更強的減少並不一定會更好。',
  'help.denoise.steps':
    '播放一些您想要降低的噪音，然後在 DSP 中選擇「降噪」。\n在燈光設定下開啟嘶嘶聲、嗡嗡聲或喀噠聲，聆聽安靜的段落和音樂細節。\n逐漸增加減少量，然後繞過該階段以檢查改進是否值得任何細節損失。',
  'help.denoise.tip':
    '聆聽柔和的細節和水狀或泵動的紋理。這不是麥克風清理。如果您沒有聽到任何變化，請確認機架和載物臺均已開啟。',
  'help.denoise.keywords':
    '噪音、降噪、噪音消除、消除噪音、嘶嘶聲、嗡嗡聲、嗡嗡聲、喀噠聲、劈啪聲、靜態、清理、清理、恢復、修復、背景噪音、乙烯基',
  'help.graph.title': '圖表及其控制元件',
  'help.graph.intro':
    '響應圖繪製了現場聲音的等化器曲線。它上面的條帶選擇繪製的內容和方式，並且它隨外觀而變化：標準樣式或場景。',
  'help.graph.steps':
    '按一下外觀的名稱以選擇樣式或場景。旁邊的箭頭、Space 和 Ctrl+Space 會逐步穿過它們。\n開啟檢視以檢檢視形的大小、顯示的內容以及波浪的高度和位置。顯示 EQ 標籤寫下了每個頻段的頻率、Q 和增益。它的繪製方式決定了幀速率（顯示器提供的每一幀，或 60 或 30，電池保持在 60）以及解析度和平滑度；除了場景之外，標準樣式保留自己的選擇。\n場景將其自己的控制項新增至「檢視」 - 無論其作者留給您設定什麼 - 使用自己的波浪會將波浪恢復到作者選擇的高度和位置。\n雙擊該圖以全螢幕顯示，或按住 Ctrl 鍵並雙擊以將其展開到整個視窗；再次雙擊即可返回。按一下即可隱藏或顯示該條帶。\n按鍵：Ctrl+F 全螢幕、Ctrl+S 展開、Esc 返回正常檢視、Ctrl+G 網格、Ctrl+W 圖形顯示內容、包含波段標籤、Ctrl+I 波形面向的方向、Ctrl+A 每個波段。在頻段的點上，拖曳以移動它，使用箭頭鍵步進，然後右鍵單擊其選單； Ctrl+捲動更改選定點的 Q。',
  'help.graph.tip': '這裡的一切都只會改變繪圖，不會改變你的聲音。',
  'help.graph.keywords':
    '圖形、頻譜、頻譜分析儀、分析儀、分析儀、頻率響應、曲線、全螢幕、全螢幕、幀速率、fps、重新整理率、波、波形、網格、檢視、快捷鍵、鍵盤快捷鍵、熱鍵、雙擊、展開、展開、標籤、頻段標籤、EQ標籤、鍵盤、箭頭鍵、圖形、解析度、平滑',
  'help.graph.stripCaption': '具有標準的風格',
  'help.graph.live': '顯示或隱藏即時波形。',
  'help.graph.previous': '回到之前的樣子。',
  'help.graph.picker': '開啟每種樣式和視覺化工具。',
  'help.graph.next': '前進到下一個外觀。',
  'help.graph.autoName': '自動',
  'help.graph.auto': '每 10 秒到 2 分鐘改變一次外觀。',
  'help.graph.colouring': '為樣式著色：自動、平坦、頻率、水平或熱度。',
  'help.graph.newLook': '從這種風格中設計出您自己的外觀。',
  'help.graph.bandsName': '聆聽頻段',
  'help.graph.bands': '遮蔽您最常聽到的頻段。',
  'help.graph.bandsMenu': '相同的底紋；使一個從未描繪過的場景變得灰色。',
  'help.graph.gridName': '網格',
  'help.graph.grid': '顯示或隱藏網格和比例。',
  'help.graph.viewName': '檢視',
  'help.graph.view': '尺寸、繪製內容和波浪。',
  'help.graph.plusCaption': '有場景',
  'help.graph.tintName': '視窗顏色',
  'help.graph.tint':
    '應用程式的主題、視覺化工具的顏色、燈光顏色（環境）或整個視窗後面的視覺化工具（背景）。',
  'help.graph.likeName': '喜歡',
  'help.graph.like':
    '喜歡播放的場景，這給了它的製作者分數。在您自己的場景中，它顯示了它有多少個讚。',
  'help.graph.lighting': '使用此場景點亮您的 RGB 裝置。',
  'help.graph.desktop': '將此視覺化工具放在桌面圖示後面。',
  'help.graph.viewCaption': '檢視選單',
  'help.graph.expand': '圖表在編輯器上增長。',
  'help.graph.fullscreen': '圖表充滿螢幕。',
  'help.graph.showingName': '顯示中',
  'help.graph.showing': '逐步瀏覽圖表顯示的內容，包含波段標籤。',
  'help.graph.labels': '每個頻段的頻率、Q 值和增益。',
  'help.graph.waveName': '波浪',
  'help.graph.wave': '即時頻譜繪圖。',
  'help.graph.topWaveName': '頂波',
  'help.graph.topWave': '標題欄中的小波浪。',
  'help.graph.meterName': '電平表',
  'help.graph.meter': '左軌中的輸出表。',
  'help.graph.drawing': '幀速率、解析度和平滑度，與標準風格和場景分開。',
  'help.graph.waveHeight': '波浪被拉多高。',
  'help.graph.wavePosition': '從底部邊緣到中間。',
  'help.looks.title': '風格和場景',
  'help.looks.intro':
    '標準樣式是現場聲音的免費繪圖，您可以自己著色和設計：用於清晰軌跡的線條和區域，用於打孔的 LED 塊和尖峰，用於整個場景的桁架、天際線和舞動火焰。場景是在顯示卡上繪製的生動圖畫，例如阿爾卑斯山、極光、布魯姆和霓虹城，其中低音、節拍和高音各有不同的動感。',
  'help.looks.steps':
    '單擊圖表上的外觀名稱。按線條、填滿、條形、點或場景搜尋或過濾樣式。\n選擇右側的場景。不屬於您的一個已被鎖定，選擇它會說明如何取得它。\n在標準樣式上，按新外觀變更其顏色、動作和峰值，然後儲存；它出現在「您的」下方。',
  'help.looks.tip':
    '場景有自己的顏色：在檢視中設定其攻擊和釋放。除了場景之外，標準樣式在檢視中具有自己的圖形設定：首先是全解析度和簡單縮放。如果場景無法在此電腦上執行，圖形將繪製自由樣式而不是空白圖。',
  'help.looks.keywords':
    '樣式、樣式、皮膚、皮膚、外觀、視覺化工具、視覺化工具、視覺化、顏色、顏色、外觀、自訂、自訂、動畫、圖形、圖形設定、解析度、品質',
  'help.looks.searchName': '搜尋',
  'help.looks.search': '按名稱、製造商或類別尋找樣式和視覺化工具。',
  'help.looks.styles': '由 FluidEQ 繪製的自由樣式以及您儲存的外觀。',
  'help.looks.familiesName': '風格過濾器',
  'help.looks.families': '分析和場景，一旦您儲存了外觀，就屬於您了。',
  'help.looks.plus': '來自 FluidEQ 和成員的場景，以及由您製作的您自己的場景。',
  'help.looks.categoriesName': '類別',
  'help.looks.categories': '自然、城市、抽像等等。',
  'help.plus.title': '您的帳戶、點數和「展示臺」標籤',
  'help.plus.intro':
    '帳戶是可選的：所有免費的內容都可以在這臺電腦上執行，無需帳戶。登入後，「視覺化工具」標籤包含相簿、工作室、動態照明和桌面視覺化工具。畫廊中的一個場景只需花費一個點數，並且永遠屬於您；已確認的帳戶可免費獲得一些點數，並且一次性支付點數包。',
  'help.plus.steps':
    '在操作選單中開啟帳戶。登入或建立帳戶並輸入傳送到您的電子郵件的六位數程式碼。\n開啟視覺化工具標籤並選擇相簿。開啟一個場景，觀看它，然後按“獲取”以在其上花費點數。\n如需更多點數，請開啟帳戶並選擇套件。只需在您的瀏覽器中在 Stripe 上支付一次即可。',
  'help.plus.tip':
    '該應用程式永遠看不到您的卡，也不會更新任何內容。一個帳戶最多可在五臺電腦上保持登入狀態。',
  'help.plus.keywords':
    '帳戶、登入、登入、登入、註冊、註冊、點數、點數、套餐、購買、價格、定價、成本、付款、付款、溢價、付費、場景、訂閱、取消、會員資格、會員、電子郵件程式碼',
  'help.plus.visualizers': 'FluidEQ 和會員的場景，為您的音樂做好準備。',
  'help.plus.studio': '用你的人工智慧製作你自己的場景。',
  'help.plus.lighting': '您的 RGB 裝置跟隨場景。',
  'help.plus.fold': '將導軌折疊到其圖片上；懸停時它會再次開啟。',
  'help.gallery.title': '展示臺畫廊',
  'help.gallery.intro':
    'Visualizers 擁有 FluidEQ 自己的場景和成員發布的場景。任何帳號皆可瀏覽，任意場景觀看十秒鐘；您獲得的一個場景會在您的音樂中播放並永遠留在您的外觀中。',
  'help.gallery.steps':
    '開啟展示臺 → 相簿。搜尋，按最喜歡、本週或最新排序，或選擇一個類別。\n開啟一個場景並按下「取得」以保留其製作人員名單，然後在圖表上「播放」。箭頭或 ← 和 → 在場景之間移動。\n喜歡你用心的場景，檢舉不該有的場景。',
  'help.gallery.tip':
    '外觀中的場景會自行更新，場景頁面會說明每個版本中所發生的變化。一旦 FluidEQ 的製造商批准了您發布的場景，就會出現該場景。 Open in Studio展示了FluidEQ自己的場景是如何製作的。',
  'help.gallery.keywords':
    '場景、場景、視覺化工具、下載視覺化工具、瀏覽、社群場景、按讚、按讚、報告、樣本',
  'help.gallery.search': '尋找場景和製作者。',
  'help.gallery.sortName': '排序',
  'help.gallery.sort': '最喜歡的、本週喜歡的或最新的。',
  'help.gallery.categoriesName': '類別',
  'help.gallery.categories': '表現出一種景象。',
  'help.gallery.mine': '您發布的場景以及他們的喜歡。',
  'help.gallery.cardName': '一個場景',
  'help.gallery.card': '它的圖片開啟了場景。得之以點數，心之所喜。',
  'help.gallery.manage': '每個顯示器顯示的桌面背景。',
  'help.gallery.stop': '停止所有桌面背景。',
  'help.gallery.sceneCaption': '場景頁面',
  'help.gallery.back': '回到畫廊，你離開的地方。',
  'help.gallery.play':
    '播放圖表上的場景。您還沒有的場景可以提供「獲取」服務，只需一個點數。',
  'help.gallery.desktop': '將場景放在桌面圖示後面。',
  'help.gallery.inspect':
    '在 Studio 中開啟 FluidEQ 的場景，看看它是如何製作的。',
  'help.studio.title': '在工作室製作場景',
  'help.studio.intro':
    '工作室將描述轉化為視覺化工具。您自己的人工智慧助理將場景寫入專案資料夾中，FluidEQ 在儲存音樂時立即播放音樂上的每個版本。 Studio 對每個帳戶都是免費的。',
  'help.studio.steps':
    '開啟 Visualizers → Studio 並按下新建專案…。給它一個名字； FluidEQ 使其資料夾包含已移動的場景。\n描述您的想法，開啟 AI 助理中的資料夾，然後貼上複製 AI 提示中的提示。\n或在舞臺旁的聊天中輸入應該更改的內容：在這臺電腦上使用Claude Code，使用您自己的計劃登入，編輯場景並播放每個版本。每個回應都會保留其版本，並帶回。\n觀察檔案儲存過程並嘗試測試訊號。然後新增到我的外觀、發布...或匯出...。',
  'help.studio.tip':
    '雙擊舞臺以全螢幕顯示。檢視 FluidEQ 場景內部...開啟 FluidEQ 自己的場景之一進行學習；它不能被發布。閃爍劇烈或執行過重的場景會被抑制。您發布的場景首先會由 FluidEQ 的製作者閱讀，一旦獲得批准，您就可以在任何地方免費播放。',
  'help.studio.keywords':
    '建立視覺化工具、製作視覺化工具、製作場景、著色器、glsl、程式碼、ai、chatgpt、克勞德、提示、發布、匯出場景、場景編輯器、創作者、聊天、工作室聊天、要求更改、克勞德程式碼、帶回、版本',
  'help.studio.project': '您的專案和 FluidEQ 場景要檢視內部。',
  'help.studio.stageName': '舞臺',
  'help.studio.stage': '場景，播放著你的音樂。雙擊全屏。',
  'help.studio.hears': '場景接收的內容：電平、節拍、低音、中音、高音。',
  'help.studio.tabs':
    'Tune 嘗試波形和場景自己的設定，Code 在您的 AI 儲存時顯示其程式碼，Performance 它如何在此處執行，以及它現在聽到的內容在下面開啟。',
  'help.studio.chat':
    '請克勞德改變你自己的話。每個改變場景的回應都可以恢復那個版本。',
  'help.studio.signals': '測試僅驅動此預覽的訊號。',
  'help.studio.size': '嘗試全屏場景。',
  'help.desktop.title': '桌面視覺化工具',
  'help.desktop.intro':
    '只要 FluidEQ 執行，桌面視覺化工具就會將場景放在桌面圖示後面、一臺顯示器或每臺顯示器上。',
  'help.desktop.steps':
    '將場景放在圖表上，然後按下其名稱旁的監視器按鈕，或選擇「檢視」→「設定為桌面背景」。\n按地圖上的監視器，選擇“隨著音樂”或“平靜”，然後按“設定背景”。\n若要變更或停止它，請開啟 Visualizers → 相簿並使用頂部的管理或停止。',
  'help.desktop.tip':
    '當視窗覆蓋顯示器、PC 鎖定以及使用電池電源（如果您選擇）時，它會暫停，並在 FluidEQ 啟動時返回。退出 FluidEQ 將停止它。僅限 Windows。',
  'help.desktop.keywords':
    '桌布, 桌面背景, 動態桌布, 桌面, 螢幕, 視覺化效果, 背景',
  'help.desktop.monitors': '您的顯示器按照 Windows 的方式排列。按要使用的。',
  'help.desktop.music': '移動到正在播放的任何內容。',
  'help.desktop.calm': '忽略音樂的緩慢、安靜的動畫。',
  'help.desktop.follow': '無論您選擇還是自動切換，都會隨著圖表上的場景而變化。',
  'help.desktop.battery': '拔掉電腦插頭時可節省電力。',
  'help.desktop.start': '在您選擇的顯示器上啟動它。',
  'help.lighting.title': '動態光照（測試版）',
  'help.lighting.intro':
    '動態照明透過 Windows 動態照明和 Razer Chroma 為您的鍵盤、滑鼠、滑鼠墊、耳機和支架以及圖表上的場景提供照明。它處於測試階段，因此請告訴我們您的裝置的行為。',
  'help.lighting.steps':
    '開啟 Visualizers → 動態照明並將其開啟，或按下圖表上場景旁的照明按鈕。\n選擇該場景的照明風格 - 場景、色彩波、光譜或節拍波紋 - 並設定其亮度及其反應。\n點選「您的裝置」下的裝置可單獨調整；所有裝置都會返回每個裝置。',
  'help.lighting.tip':
    '如果 Windows 為另一個應用程式保留了一個裝置，該頁面會命名要變更的設定並為您開啟它。 Razer 裝置需要執行 Razer Synapse，並允許使用 Chroma 應用程式。',
  'help.lighting.keywords':
    'RGB、雷蛇、色度、突觸、鍵盤燈、鍵盤、滑鼠、耳機、LED、LED、環境照明、燈光、Windows 動態照明',
  'help.lighting.switch': '播放場景時點亮您的裝置。',
  'help.lighting.browse': '開啟相簿以選擇視覺化工具。',
  'help.lighting.previewName': '即時桌面預覽',
  'help.lighting.preview': '您自己的辦公桌，用傳送到它的顏色照亮。',
  'help.lighting.devices':
    '找到的每個裝置。點選其中一項單獨調音；清單上方的所有裝置都會再次對它們進行調整。',
  'help.lighting.style': '為每個視覺化工具保留場景、色彩波、頻譜或節拍波紋。',
  'help.online.title': '通過線上媒體聆聽',
  'help.online.intro':
    '線上媒體將支援的網站保留在您的 EQ 旁邊。網站播放和登入仍然取決於提供者和您的連線。 FluidEQ 底部的欄會跟隨目前播放器，其音量是您電腦自己的音量。',
  'help.online.steps':
    '開啟線上媒體並選擇支援的站點。在該頁面上查詢並啟動某些內容。\n聆聽時切換到 EQ 進行調音，然後在需要自己的控制時返回頁面。\n如果您希望 FluidEQ 和其他播放器彼此暫停而不是重疊，請一次使用一個播放器。',
  'help.online.tip':
    '在 FluidEQ 引擎下，線上媒體會像其他應用程式一樣通過您的 EQ 和 DSP 效果器機架。在 Equalizer APO 下，機架與庫軌道保持在一起。',
  'help.online.keywords':
    'youtube、youtube 音樂、bandcamp、抽搐、suno、流媒體、流、網路、網站、瀏覽器、線上',
  'help.library.title': '建立您的本地媒體庫',
  'help.library.intro':
    '庫匯集了驅動器中的音樂和視訊。按專輯、藝術家、流派、歌曲、資料夾、資料夾樹或播放清單進行瀏覽。專輯封面和詳細資訊來自您的檔案，因此同一集合可能看起來有所不同，具體取決於其標籤。',
  'help.library.steps':
    '開啟庫並新增包含您的媒體的資料夾。請先完成掃描，然後再判斷丟失的內容。\n選擇藝術家或專輯，或搜尋歌曲。從結果開始追蹤。\n使用視窗底部的欄來暫停、搜尋和跳過。它的音量是您電腦自己的音量，與 Windows 中的音量相同。',
  'help.library.tip':
    '將 FluidEQ 按鈕懸停在 Windows 工作列上即可檢視上一個、播放和下一個，即使該按鈕已最小化也是如此。庫需要原始檔案：重新連線驅動器或再次新增移動的資料夾。',
  'help.library.keywords':
    '音樂播放器、播放器、本地檔案、本地音樂、mp3、flac、wav、aac、資料夾、專輯、藝術家、流派、播放清單、影片、影片、掃描、標籤、封面藝術、專輯藝術',
  'help.queue.title': '專輯和您的播放佇列',
  'help.queue.intro':
    '佇列是監聽順序；瀏覽是您選擇音樂的地方。開啟另一張專輯可以讓您進行探索，而無需將其設為當前歌曲。活動曲目和下一個曲目可幫助您保住自己的位置。',
  'help.queue.steps':
    '開啟專輯檢查其曲目。開始說你想聽的吧。\n右鍵單擊歌曲以新增至下一首、新增至收藏夾或新增至播放清單。\n開啟“下一步”檢視之後播放的內容，然後開啟“繼續播放”以繼續播放更多相同型別的內容。',
  'help.queue.tip':
    '開始庫播放接管 FluidEQ 的其他播放器。使用欄中顯示的目前曲目來確認哪個來源擁有播放。',
  'help.queue.keywords':
    '佇列、下一首、下一首、隨機播放、重複、收藏夾、收藏夾、播放清單、繼續播放、自動播放、播放順序',
  'help.karaoke.title': '唱卡拉 OK',
  'help.karaoke.intro':
    '卡拉 OK 將您自己的音訊與歌詞配對。定時歌詞跟隨播放；音調目標取決於歌曲的音符資料。配置後，麥克風會新增您的現場音調，並且舞臺可以填滿螢幕。',
  'help.karaoke.steps':
    '開啟卡拉 OK。使用新增檔案或新增資料夾引入音訊和相符的歌詞檔案。\n選擇一首歌曲並開始播放。檢查歌詞和背景音樂是否配對正確。\n配置麥克風輸入以實現現場音調，根據您的觀看距離調整歌詞大小，並使用舞臺的全螢幕控制來唱歌。',
  'help.karaoke.tip':
    '僅歌詞檔案不包含目標音符。卡拉 OK 以電腦的音量播放；旋律、伴奏和引導聲電平位於混音設定下。',
  'help.karaoke.keywords':
    '唱歌、唱歌、一起唱、歌詞、麥克風、麥克風、音調、lrc、ultrastar、歌曲',
  'help.maker.title': '在 卡拉 OK 製作工具 中建立',
  'help.maker.intro':
    'Maker 將您的音訊變成可編輯的卡拉 OK 專案。它的時間軸匯集了音訊、歌詞和音調音符。自動結果是一個起點：根據錄音檢查單字、時間和音符。',
  'help.maker.steps':
    '開啟“Make from Karaoke”並載入來源音訊。選擇您需要的可用分離或轉錄工具。\n觀察進展；首次使用人工智慧工具可能需要下載模型。在時間軸中檢視生成的歌詞和音符。\n播放短段落，更正時間和文本，儲存專案以供以後編輯，然後匯出卡拉 OK 檔案。',
  'help.maker.lyricsCaption': '這些歌詞，以及每一個被唱出來的時候',
  'help.maker.referenceName': '參考歌詞',
  'help.maker.reference':
    '整首歌曲為文本，每行一行。貼上或載入檔案； FluidEQ 從中找到時序。',
  'help.maker.timingName': '單字計時',
  'help.maker.timing': '每個單詞，依序，有多少個都計時至今。按一即可進行操作。',
  'help.maker.wordName': '所選單字',
  'help.maker.word':
    '所選單字從哪裡開始以及持續多久。移動它的邊緣會給予或減少它旁邊的單字的時間；線保持其長度。',
  'help.maker.toolsCaption': '人工智慧工具及其所需的模型',
  'help.maker.separate':
    '將錄音分為語音和音樂，這樣卡拉 OK 就可以在沒有歌手的情況下播放。',
  'help.maker.loadVocals': '使用您已有的純聲音檔案，而不是在此處分離一個檔案。',
  'help.maker.redetectTiming': '再次聽聲音並重新計時您已經說過的單字。',
  'help.maker.redetectNotes': '再次聆聽旋律並重寫歌詞下的音符。',
  'help.maker.modelsName': 'AI模型記憶',
  'help.maker.models':
    '每個型號需要什麼以及是否在這臺電腦上。它們是在您第一次使用時下載的。',
  'help.maker.idleName': '當它閒置時',
  'help.maker.idle':
    '模型在兩次使用之間是否保留在記憶體中以及保留多長時間。釋放它可以釋放記憶體；保留它可以立即開始下一次執行。',
  'help.makerBar.caption': '製造商頂部的工具',
  'help.makerBar.import':
    '開啟卡拉 OK 檔案或已儲存的專案，並保留已載入的音訊。',
  'help.makerBar.lyrics': '文字和時間都在一個視窗中。',
  'help.makerBar.timing':
    '將歌詞和音符移到一起，適用於從第一秒開始較早或較晚執行的歌曲。',
  'help.makerBar.pan': '拖曳時間軸上的任何位置即可瀏覽歌曲，無需進行任何變更。',
  'help.makerBar.language':
    '歌詞所使用的語言，以及旁邊的第二種語言，以便這首歌可以用其中一種語言演唱。',
  'help.makerBar.record':
    '播放歌曲並在每行開始和結束時按下一個鍵。時機來自於你的壓力。',
  'help.makerBar.select': '在音符周圍畫一個框以將它們作為一個整體移動或刪除。',
  'help.makerBar.paint': '將旋律直接繪製到音高網格上。',
  'help.makerBar.split':
    '將單字切成音節，這樣一個長單字可以在每個音節上帶有一個音符。',
  'help.makerBar.repair': '為您傾聽的工具以及它們所需的模型。',
  'help.makerBar.export':
    '將完成的卡拉 OK 寫入為 FluidEQ 專案、UltraStar TXT、LRC 或增強型 LRC。',
  'help.maker.tip':
    '模型下載需要連線和可用磁碟空間。處理時間取決於您的硬體和歌曲長度。使用您有權使用的音訊並在共享之前檢查匯出內容。',
  'help.maker.keywords':
    '移除人聲, 去人聲, 伴奏, 卡拉 OK 製作, 歌詞, 字幕, 同步, 音高, 旋律, 音源分離',
  'help.share.title': '在電腦之間共享音訊',
  'help.share.intro':
    '共用音訊將同一專用網路上的電腦連線到一組，每臺電腦都播放其他電腦的聲音：無論您坐在哪一臺，您都可以聽到其餘的聲音。每臺電腦都將自己的聲音直接傳送給其他電腦，不受影響，也不會發回收到的聲音，因此沒有迴聲；您收聽的電腦應用其自己的 EQ、曲線和 DSP。這與映象到一臺電腦上的第二個裝置是分開的。',
  'help.share.steps':
    '在一臺電腦上，開啟“共享音訊”，按“新增電腦”，然後按“複製程式碼”。從低音量開始。\n在另一臺電腦上，按新增電腦，將程式碼貼到另一臺電腦的程式碼下，然後按連結。兩臺電腦立即互相玩遊戲。以相同的方式連結更多電腦：每臺電腦都加入整個群組，透過另一臺電腦加入的電腦顯示為「接收」關閉，直到您將其開啟。\n整個組中，每臺電腦都有兩個開關，分別是Receive和Send；共享會關閉所有電腦的聲音。您的混音設定了這臺電腦的音量和每臺電腦的音量。\n暫停、恢復和取消連結位於每臺電腦的選單中。離開的電腦仍被列為“離線”，並且該群組在重新啟動、睡眠、網路中斷或引擎切換後會再次發現自己。',
  'help.share.tip':
    '保持連執行緒式碼的私密性：它授權連結。在 FluidEQ 引擎下，該電腦在共享時保持其 DSP 開啟，並且播放其聲音的電腦應用其自己的聲音。立即播放和傳送需要該電腦上的 Windows；在其他地方，連結以一種方式執行。',
  'help.share.keywords':
    '分享音訊, 音訊分享, 電腦之間, 其他電腦, 傳送, 接收, 網路, 連線, 喇叭, 延遲',
  'help.trouble.title': '當某些事情聽起來不對時',
  'help.trouble.intro':
    '從來源和輸出開始，然後隔離各層。圖表、已儲存的預設或啟用的開關本身無法證明聲音到達了預期的裝置。 「幫助」選單還提供音訊故障排除、問題報告和論壇。',
  'help.trouble.steps':
    '無聲音：確認播放正在執行，已選擇預期輸出，音量已調高，且裝置已連線。檢查是否一次有一個播放器暫停了另一個來源。\n無 EQ 變更：確認系統 EQ 已開啟且輸出未顯示 OFF 標記；如果有，請按啟用。如果通知顯示引擎未執行，請按「重新啟動 Windows 音訊」。\n一切看起來都正常，但 EQ 仍然不起作用：Windows 可能正在透過引擎播放音樂。該通知是這麼說的，並提供一按即可將引擎移動到 Windows 將使用的地方；它需要一個許可提示和一秒鐘的沉默。\n失真或低音過多：將「自動標準化」保持開啟狀態，一次減少一個增強並旁通一層。如果問題仍然存在，請使用報告問題並在傳送前檢視報告。',
  'help.trouble.tip':
    'F1 開啟本指南。 Esc 關閉放大的捕獲，然後關閉指南。如果介面太大，Ctrl + 0 會重設縮放。操作選單中的程式顯示了 FluidEQ 的每個部分正在執行的操作。',
  'help.trouble.keywords':
    '沒有聲音, 沒聲音, 聽不到, 無聲, 音訊問題, 音效引擎, 靜音, 故障, 修復, 錯誤, 重新啟動',
  'help.forum.title': '在論壇中提問',
  'help.forum.intro':
    '該論壇將 FluidEQ 的 GitHub 討論帶入應用程式中：人們引以為傲的公告、想法、問題和調整。任何人都可以閱讀；發文使用您的 GitHub 帳戶，而不是 FluidEQ 帳戶。',
  'help.forum.steps':
    '開啟“幫助”→“論壇”並選擇一個版塊：公告、常規、想法、投票、問答或展示和講述。 New for you 收集自您上次檢視以來出現的問題，Issues 列出了 GitHub 上報告的問題。\n搜尋論壇，或開啟主題以閱讀回覆。\n按“使用 GitHub 登入”，在瀏覽器中完成，然後釋出新主題或回覆。',
  'help.forum.tip':
    '釋出的所有內容均以您的 GitHub 名稱在 GitHub 上公開。在問答中，標記有效的答案，以便下一個人找到它。',
  'help.forum.keywords':
    '社群、問題、支援、討論、github、回饋、功能請求、想法、建議、詢問、幫助、聯絡方式、公告',
  // A Mac's own wording for the lines above that describe Windows' engine
  // (`helpPlatformText.ts`): the same number of lines, so search pairs them.
  'help.start.steps.mac':
    '安裝並開啟 FluidEQ。第一次處理您的聲音時，macOS 會詢問是否允許 FluidEQ 錄製 Mac 播放的聲音：請允許。\n在「輸出裝置」中選擇您的聆聽裝置。開啟「系統等化器」，並保持「自動正規化」開啟。\n播放一首歌，開啟 EQ →「頻段」，做一個小調整，然後比較「系統等化器」關閉與開啟時的差別。',
  'help.start.tip.mac':
    '在 Mac 上，FluidEQ 引擎隨應用程式提供，只在 FluidEQ 開啟時運作：結束 FluidEQ 後，聲音會直接送到揚聲器。需要 macOS 14.2 或更新版本，並在「隱私權與安全性」›「螢幕與系統錄音」中允許 FluidEQ。',
  'help.window.tip.mac':
    '「幫助」可開啟本指南、「新功能介紹」和「報告問題」。旁邊的脈衝按鈕裡有引擎卡片、您的帳戶、匯入 EQ 設定或脈衝響應，以及顯示 FluidEQ 各部分用量的「處理程序」；最下方是「亮度」與「透明度」、動畫和語言。其後的開關會把視窗切換為「輕巧播放器」。',
  'help.window.actions.mac':
    '引擎、您的帳戶、匯入 EQ 設定與「處理程序」；「亮度」與「透明度」、動畫和語言。',
  'help.trouble.steps.mac':
    '沒有聲音：確認正在播放、已選擇預期的輸出、音量已調高，且裝置已連線。檢查「一次使用一個播放器」是否暫停了另一個來源。\nEQ 沒有變化：確認「系統等化器」已開啟。如果通知說 FluidEQ 無法接收 Mac 的聲音，請按「開啟系統設定」，並在「螢幕與系統錄音」中允許 FluidEQ。\n仍然沒有變化：結束 FluidEQ 後再重新開啟。關閉期間聲音會直接送到揚聲器，引擎也會隨它重新啟動。\n失真或低音過重：保持「自動正規化」開啟，降低增益，並逐一略過各層。如果問題持續，請使用「報告問題」，並在送出前檢查報告內容。',
} satisfies Partial<Dictionary>;

export default help;
