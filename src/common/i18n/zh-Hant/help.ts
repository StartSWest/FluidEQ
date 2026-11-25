/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const help = {
  'help.menu': '幫助',
  'help.title': '使用者指南',
  'help.subtitle': '找到你的聲音。請隨便一點，就像在自己家一樣。',
  'help.intro':
    '一份實用的 FluidEQ 指南，配有應用程式自身控制項繪製的插圖。從第一次聆聽開始，依自己的步調探索。',
  'help.offline': '離線可用',
  'help.search': '搜尋指南',
  'help.searchHint': '嘗試引擎、低音、場景…',
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
    '即時插圖會配合您的語言和視窗配色。範例設定只是說明控制項的用法，並非建議的預設組。',
  'help.steps': '嘗試一下',
  'help.tip': '很高興知道',
  'help.back': '回到頂部',
  'help.group.start': '開始使用',
  'help.group.sound': '塑造你的聲音',
  'help.group.visuals': '檢視您的音樂',
  'help.group.plus': '場景和您的帳戶',
  'help.group.listen': '聆聽、唱歌和分享',
  'help.group.help': '當你需要幫助時',
  'help.start.title': '你的前五分鐘',
  'help.start.intro':
    '先用一首熟悉的歌，以舒適的音量開始。左側欄有 FluidEQ 的電源鍵和前級增益；中間是您的工作區，圖表位於頻段之上；右側的聲音面板跟隨您的輸出及其設定檔。視窗底部的列可以控制正在播放的內容。下面的導覽只有在您按下播放時才會載入。遊戲頁面請參閱「遊戲實驗室」。',
  'help.start.steps':
    '安裝 FluidEQ，安裝程式詢問如何處理聲音時，保持選取「FluidEQ引擎」。Windows 只會要求一次權限，不需重新啟動。\n在聲音面板的「輸出」卡片中選擇您的收聽裝置。按左側欄頂端的電源鍵，並保持「自動正規化」開啟。\n播放一首歌，開啟 EQ → 頻段，稍微拖動某個頻段的滑桿，然後關、開電源鍵比較一下。',
  'help.start.tip':
    '系統範圍的 EQ 需要 Windows 和音訊引擎：FluidEQ 引擎或 Equalizer APO。在 macOS 和 Linux 上，該應用程式顯示演示輸出，因此移動圖表並不能證明任何內容都已處理。',
  'help.start.keywords':
    '安裝、安裝程式、設定、設定、入門、第一步、快速入門、初學者、基礎知識、教學、如何使用、開始, 電源鍵, 圖表, 分頁, 頻段',
  'help.start.pagesName': 'EQ 的頁面',
  'help.start.pages':
    '頻段、耳機校正、卷積和設定檔：塑造聲音的各個部分，每樣一頁。',
  'help.start.engineName': '引擎',
  'help.start.engine':
    '由哪個引擎播放您的 EQ：FluidEQ引擎或 Equalizer APO。紅點表示它沒有作用到您正在收聽的輸出。',
  'help.start.delay':
    '引擎在這個輸出上播放聲音的延遲。按一下可查看每一級各增加了多少。',
  'help.start.graphName': '圖表',
  'help.start.graph':
    '您的 EQ 曲線和每個頻段上的一個點，背後是正在播放的聲音。拖動一個點來塑造聲音；其餘內容見圖表一章。',
  'help.start.tabsName': '你的 EQ、預設組、音色',
  'help.start.tabs':
    '圖表下方的三個分頁：您自己的頻段、墊在其下的現成預設組，以及音色的低切、高切和旋鈕。每個分頁的工具在這一列的末端。',
  'help.start.bandsName': '您的頻段',
  'help.start.bands':
    '每個頻段一個滑桿，上方是頻率，下方是增益。EQ 一章會介紹每個部分。',
  'help.video.play': '播放影片：{title}',
  'help.video.loading': '從 fluideq.com 載入...',
  'help.video.failed':
    '影片無法載入。它從 fluideq.com 播放，因此需要網路連線。',
  'help.video.retry': '再試一次',
  'help.window.title': '認識視窗介面',
  'help.window.intro':
    '標題列帶您在 FluidEQ 的各個頁面之間切換，並即時顯示正在播放的聲音。左側欄有 FluidEQ 的電源鍵、前級增益和電平表；右側的聲音面板跟隨您的輸出及其設定檔。',
  'help.window.steps':
    '從標題列開啟頁面：場景、分享音訊、麥克風、遊戲實驗室、EQ、DSP、媒體庫、卡拉 OK、線上媒體。\n按左側欄頂端的電源鍵開啟 FluidEQ，並保持「自動正規化」開啟，這樣任何提升都不會削波。\n按電平表可切換到下一種樣式；按住 Ctrl 再按則回到上一種。\n在 ≡ 選單中將「亮度」放在從全黑到全白之間的任何位置，並為「色調」設定第二種顏色，即可以兩種顏色之間的漸層繪製頻段、標題和點亮的控制項。\n要從其他應用程式切換處理，開啟 ≡ → 開關快速鍵 並選擇組合鍵。起初未指派快速鍵；其他視窗上方的通知會確認 FluidEQ 已開啟或關閉。\n在任何文字欄位按右鍵，即可使用剪下、複製、貼上和全選。搜尋會忽略大小寫、重音符號、空格與標點：輸入kpop就能找到K-pop。',
  'help.window.tip':
    '「幫助」可開啟本指南、新增功能、音訊疑難排解和回報問題。旁邊的 ≡ 選單分為兩欄。左欄是引擎卡、修復音訊問題、重新啟動 Windows 音訊、開關快速鍵、匯入 EQ 設定或脈衝響應、處理程序（顯示 FluidEQ 的每個部分正在使用的內容）、重設所有設定、動畫、隨 Windows 啟動（FluidEQ 會在系統匣中啟動，不開啟視窗即可處理您的聲音）和語言。右欄是視窗的外觀：亮度、色調（它的兩個色塊是視窗的顏色和用於漸層的第二種顏色）、給應用程式圖示著色（預設關閉；讓工作列、系統匣和系統匣選單中的圖示使用視窗的顏色）、等化器滑桿和設定為桌面背景。通知會疊放在視窗右下角。選單之後的開關會將視窗變成緊湊型播放器。',
  'help.window.keywords':
    '視窗, 視窗顏色, 顏色, 第二種顏色, 漸層, tint, colour, color, second colour, gradient, 動畫, 語言, 亮度, 色調, 圖示, 工作列, 佈景主題, 開機, 搜尋, 大小寫, 重音符號, 空格, 標點, search, accents, spaces, punctuation, case insensitive, 電源, 電源鍵, 白色視窗, 右鍵, 右鍵選單, 剪下, 複製, 貼上, 通知, 麥克風',
  'help.window.headerLeftCaption': '標頭，直至訊號',
  'help.window.headerRightCaption': '標頭，在訊號之後',
  'help.window.railCaption': '左導軌',
  'help.window.media':
    'YouTube、YouTube Music、Bandcamp、Twitch 和 Suno 在 FluidEQ 中播放並使用您的 EQ。',
  'help.window.share':
    '將這臺電腦的聲音傳送到另一臺電腦，或在此處播放另一臺電腦的聲音。',
  'help.window.mic':
    '您的麥克風，每個都有自己的人聲音色，所有應用程式都能聽到。',
  'help.window.gaming': '您的遊戲，每個都有為它調整的專屬聲音。',
  'help.window.eq': '您的頻段、預設、耳機校正和引擎的配置。',
  'help.window.waveName': '音訊訊號',
  'help.window.wave':
    '正在播放的內容，正如它所播放的那樣，具有最高水平；圖表的「檢視」功能表可以將其隱藏。',
  'help.window.dsp': '效果架：預設、房間和鏈的每個階段。',
  'help.window.library': '您的音樂檔案、專輯和播放佇列。',
  'help.window.karaoke': '跟著唱，用自己的歌製作卡拉 OK。',
  'help.window.plus': '場景：畫廊、工作室和動態照明。',
  'help.window.support': '支援 FluidEQ 工作的方法。',
  'help.window.help':
    '開啟本指南、更新內容、完整版本說明、論壇、音訊疑難排解、回報問題和關於 FluidEQ。完整版本說明可直接開啟。「關於」包含各節的跳轉連結；支援連結可用時，也會顯示附 QR 碼的 Buy Me a Coffee 卡片。',
  'help.window.actions':
    '分為兩欄。命令與行為：引擎、修復音訊問題、重新啟動 Windows 音訊、開關快速鍵（在其他應用程式位於前景時開關 FluidEQ 的全部處理；起初未指派，每次切換都會在其他視窗上方顯示一張卡片確認）、匯入 EQ 設定或脈衝響應、處理程序、重設所有設定、動畫、隨 Windows 啟動和語言。外觀：亮度、色調及其第二種顏色、給應用程式圖示著色、等化器滑桿和設定為桌面背景。',
  'help.window.systemEq':
    'FluidEQ 的電源鍵：為電腦播放的所有聲音開啟或關閉處理。下方一行顯示引擎名稱；當引擎沒有作用到您正在收聽的輸出時會變成紅色，此時按下會詢問引擎的狀況。',
  'help.window.preamp':
    '在等化器之前降低電平，為提升留出餘量。由「自動正規化」控制時顯示「自動」；關閉後可轉動旋鈕，或按數字輸入電平。Ctrl+按一下可回到 0 dB。',
  'help.window.autoNormalize':
    '將 前級增益 保持在足夠低的水平，使任何增強都不會削波。',
  'help.window.responseGraph': '顯示或隱藏響應圖。',
  'help.window.meterName': '電平表',
  'help.window.meter':
    '左右聲道的輸出電平，以真實分貝顯示，上方是較響聲道的峰值。按一下切換到下一種樣式；按住 Ctrl 再按則回到上一種。',
  'help.player.title': '輕巧播放器',
  'help.player.intro':
    '一個開關將 FluidEQ 的視窗變成緊湊型播放器，一個狹窄的列：頂部有一個場景或樣式，上面有歌曲，下面是播放控制元件，然後是聲音、等化器，然後是下一個和播放清單。無論正在播放的內容都會繼續播放，並且相同的開關會將完整的應用程式帶回您離開的頁面。',
  'help.player.steps':
    '按標題列中「幫助」旁的「緊湊型播放器」開關。在播放器上，相同的開關可以恢復完整的應用程式。\n將“聲音”或“下一個”和“播放清單”折疊到其標題，畫面佔據空間；按標題再次開啟它。拖曳播放器的頂部或底部邊緣以使其更高或更低。\n雙擊畫面以使其充滿螢幕；逃脫將其還給你。按隨機播放旁邊的造型名稱並重複，即可從每種風格和場景中進行選擇。\n在 FluidEQ 標記的選單中選擇“折疊到一行”，將播放器折疊到一行；標記將其展開。\n在同一選單中，設定播放器自己的亮度、場景的透明度或標準樣式的視窗色調以及場景的日光。始終位於頂部、那裡或標題中，使其保持在其他視窗之上。\n將音樂檔案拖放到播放器上的任何位置：它們會加入庫和「下一個」的末尾，或者在清單上方，您放開的地方。\n在聲音區，Tone 調整低、中、高頻，頻段頁提供完整 EQ。預設與 EQ 模式修改的輸出與完整應用程式相同。探索場景可在完整視窗開啟圖庫，精簡播放器也支援自動切換場景。',
  'help.player.tip':
    '播放器的音量是您電腦自己的音量，與 Windows 中的音量相同，因此它決定了電腦播放的所有內容的等級。如果播放器最終離開螢幕，請右鍵點選工作列托盤中的 FluidEQ，然後選擇恢復視窗。 遊戲聲音啟用時，輕巧播放器的遊戲按鈕只顯示遊戲名稱，避免佔用太多空間。',
  'help.player.keywords':
    '迷你播放器、小播放器、緊湊、緊湊模式、winamp、amp、播放器模式、始終在頂部、固定、折疊、一行、佇列、下一個、刪除檔案、主題、淺色主題、深色主題、深色模式、淺色模式、小視窗、浮動播放器、音量',
  'help.player.topCaption': '頂部：歌曲及其演奏方式',
  'help.player.eqCaption': '聲音，你的等化器',
  'help.player.queueCaption': '接下來',
  'help.player.menuCaption': '播放器的選單',
  'help.player.foldedCaption': '折疊成一行',
  'help.player.menu':
    '返回完整的應用程式或其頁面之一；播放器自己的亮度、透明度或色調、場景的日光、色調應用程式圖示和 EQ 滑桿；始終位於頂部並折疊成一行。',
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
  'help.player.look': '播放器上的風格或場景。按它可以從所有選項中進行選擇。',
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
    '除了完整應用程式的亮度之外，播放器自己的亮度；場景的透明度，或標準樣式的視窗色調；場景的日光；以及為應用程式圖示著色，首先關閉，用於工作列圖示、托盤圖示和托盤選單中的圖示的視窗顏色。',
  'help.player.fold': '將播放器折疊到一行。',
  'help.player.unfold': '展開播放器。另一端的箭頭也是如此。',
  'help.player.foldedPlaying': '播放或暫停。',
  'help.player.fullScreen':
    '用場景或樣式填滿螢幕。雙擊圖片也會執行相同的操作，然後按 Escape 鍵返回螢幕。',
  'help.player.sourceName': '來源',
  'help.player.source':
    '歌曲的來源：媒體庫、線上媒體、卡拉 OK、另一臺電腦或此 PC 上的其他程式。按下它會在完整的應用程式中開啟該頁面。',
  'help.player.heart': '將歌曲從庫新增到您的收藏夾，或將其刪除。',
  'help.player.soundFold':
    '將聲音控制向下折疊到這一行，這樣可以保留預設、智慧校正和開關，然後再次開啟它們。',
  'help.player.mode': '開啟 EQ 模式：EQ 和曲線的應用強度、頻帶 Q、相位和高音。',
  'help.player.save': 'Keep Up next 作為自己的播放清單。',
  'help.player.queueFold':
    '接下來折疊起來，播放清單向下折疊到其分頁，畫面佔據了空間。',
  'help.player.remove': '從 Up next 中取出一首尚未播放的歌曲。',
  'help.player.output': '聲音的去向：Windows 播放的輸出。',
  'help.player.engineName': '引擎',
  'help.player.engine': 'FluidEQ 開啟時，哪個引擎正在塑造聲音，該燈會亮起。',
  'help.player.sliders': 'EQ 滑桿上的圓形手柄或矩形蓋，位於此處和 EQ 頁面上。',
  'help.requirements.title': '您的電腦需要什麼',
  'help.requirements.intro':
    'FluidEQ 可在過去十年的任何 Windows PC 上運作。有兩個部分比其他部分要求更多：場景在顯示卡上繪製，卡拉 OK AI 在您第一次使用時下載其模型。',
  'help.requirements.steps':
    '檢查您的 Windows：Windows 10 版本 1803 或更高版本，或 Windows 11，64 位，4 GB 記憶體和約 600 MB 磁碟。處理 PC 播放的所有內容都需要 FluidEQ 引擎或 Equalizer APO，Windows 在安裝時會要求一次許可。\n播放場景：2013 年以來的任何顯示卡或內建顯示卡。 1080p 內建顯示卡就足夠了； 4K 或同時在多個螢幕上顯示桌面背景更適合使用專用卡。在繁忙的卡片上，FluidEQ 將場景縮小並放棄您看不到的場景。\n試試卡拉 OK AI：分離語音第一次下載 713 MB 模型，音高模型增加約 360 MB，噪音移除 11 MB。使用 DirectX 12 顯示卡，一首四分鐘的歌曲在大約半分鐘內就可以分離；僅在處理器上就需要大約四分鐘。工作時保持 2 GB 空閒記憶體。\n如果可以的話，就瞄準這個目標：Windows 11、8 GB 記憶體、2018 年以後的顯示卡，如果使用 AI 功能，則需要 3 GB 可用磁碟空間。',
  'help.requirements.tip':
    '除了人工智慧模型之外的所有內容都在安裝程式中，並且僅在您第一次使用該功能時才下載。操作選單中的程式顯示 FluidEQ 的各個部分目前在您的電腦上使用的內容。',
  'help.requirements.keywords':
    '系統需求、需求、規格、硬體、筆記型電腦、GPU、顯示卡、顯示卡、CPU、處理器、RAM、記憶體、磁碟空間、儲存、Windows 10、Windows 11、最低、推薦、效能、慢、延遲、相容性、Mac、MacOS、Linux',
  'help.engine.title': 'FluidEQ 引擎',
  'help.engine.intro':
    'FluidEQ 使用自己的引擎或 Equalizer APO 處理您的聲音。 FluidEQ 引擎在音效卡效果之後在 Windows 音訊服務中執行，將 EQ 和 DSP 效果器機架 帶到 PC 播放的所有內容中，並在 FluidEQ 關閉時退出。',
  'help.engine.steps':
    '開啟操作選單（≡），按一下頂端的引擎卡片。\n選擇 FluidEQ 引擎並按應用。 Windows 會要求許可，重新啟動時音訊會暫停幾秒鐘。\n如果輸出顯示“關閉”，請按其通知中的“啟用”。如果通知顯示引擎未執行，請按「重新啟動 Windows 音訊」。',
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
  'help.engine.nowName': '目前引擎',
  'help.engine.now':
    '目前播放您聲音的引擎；在選擇另一個之前，「套用」無法使用。',
  'help.eq.title': '用 EQ 塑造您的聲音',
  'help.eq.intro':
    '「你的 EQ」是您自己調的頻段。頻率決定頻段作用在哪裡，增益決定提升或衰減多少，Q 決定寬度：Q 越高越窄。圖表下方有三個分頁共用這一頁：你的 EQ、預設組和音色，各自是獨立的一層。先從小幅、寬緩的調整開始，並經常比較。',
  'help.eq.steps':
    '開啟 EQ → 頻段。「你的 EQ」是您的頻段；「預設組」在它們下面墊一種現成的聲音，「新增預設組」可以做一個您自己的；「音色」有低切、高切、低音、中音和高音，畫成單獨的一條線。\n拖動頻段的滑桿或它在圖表上的點來提升或衰減；曲線會跟著移動。按一下頻段的頻率或它的點即可選取。在頻段上按住 Ctrl 捲動可改變它的 Q。\n選取一個頻段後按住 Shift，旁邊會出現它的彈出面板：濾波器、頻率、增益和 Q 旋鈕、活躍和刪除。Shift+Tab 和 Shift+← → 切換到前一個或後一個頻段；Esc 或 × 將其收起。\n所有操作都可以用鍵盤完成：用 Tab 移到滑桿、旋鈕或圖表上的點，方向鍵調整；Page Up 和 Page Down 調整幅度更大。\n在頻段上按右鍵可重設、關閉、刪除（需再按一次確認）、在旁邊新增頻段，或選擇「左+右」：同一頻率上每隻耳朵各一個頻段，左耳曲線為實線，右耳為虛線。選「雙耳」可重新合併。\n用 Ctrl 或 Shift 選取多個頻段，或拖出方框框住它們，即可一起移動；在圖表上按 Ctrl+A 選取所有頻段。\n「儲存等化器」把正在播放的聲音存為已儲存的等化器，之後可以重新套用、更新或管理。「清除」把每個增益設為 0 dB 並保留您的頻段；會先詢問。\n您自己的預設組（預設組 → 新增預設組）從某個預設組或平直開始曲線；您在圖表上塑造它，在 DSP 頁面塑造它的效果架。它的卡片選單可以匯出為檔案，「預設組」分頁上的「匯入」可以讀回。',
  'help.eq.tip':
    '「曲線」列出除了您的頻段外塑造這個輸出的其他內容，每項都有自己的強度和 ×。圖表上方引擎名稱旁的「遊戲模式」會減少 FluidEQ 增加的延遲，適合遊戲和通話；遊戲預設組會開啟它。從標籤上關閉 EQ 時，頻段會變暗，不會被誤改；「音色」分頁仍可使用。',
  'help.eq.keywords':
    '等化器, EQ, 頻段, 頻率, 增益, Q, 標籤, 鍵盤, 快捷鍵, 低音, 中音, 高音, 濾波器, 參數, 圖形, 彈出面板, shift, 儲存等化器, 已儲存的等化器, 你的 EQ, 預設組分頁, 音色, 新增預設組, 匯出, 匯入',
  'help.eq.rowCaption': '圖表下方的分頁，位於「你的 EQ」',
  'help.eq.tabBands': '您自己的頻段，以及頻段數量。',
  'help.eq.tabPreset':
    '墊在您頻段下面的預設組，以及可選的預設組：按風格、按用途，還有您自己的。',
  'help.eq.tabTone':
    '低切、高切、低音、中音和高音：快速調整音色，不動您的頻段。全部未使用時顯示「關閉」。',
  'help.eq.bandsCaption': '您的頻段',
  'help.eq.bandCaption': '按住 Shift 時頻段的彈出面板',
  'help.eq.gameMode': '減少 FluidEQ 為遊戲和通話增加的延遲。遊戲預設將其開啟。',
  'help.eq.layers':
    '還有哪些在塑造這個輸出——預設組、耳機校正、智慧校正、卷積——每項都有自己的強度、開關和 ×。',
  'help.eq.bandName': '一個頻段',
  'help.eq.band':
    '拖動滑桿來提升或衰減，或用方向鍵調整。在上面按住 Ctrl 捲動可改變 Q。',
  'help.eq.caption':
    '按一下即可選取該頻段。Ctrl+按一下或按兩下可把它放回佈局的頻率。',
  'help.eq.gainCaption': '該頻段的增益，單位 dB。',
  'help.eq.scaleName': 'dB 刻度',
  'help.eq.scale':
    '滑桿旁從 +20 到 −20 dB，標出 0 dB，就像混音台印在推桿旁那樣。',
  'help.eq.stepName': '前後頻段',
  'help.eq.step':
    '‹ 和 › 把彈出面板移到下一個或上一個頻段，就像在面板內按 Shift+Tab 和 Tab。',
  'help.eq.close': '收起彈出面板，頻段保持選取。放開 Shift 效果相同。',
  'help.eq.filter': '它的形狀：峰值、擱架、陷波或通濾波器。',
  'help.eq.voicing': '聲音的現成鏈，例如音樂或流派。沒有人只留下自己的頻段。',
  'help.eq.smart':
    'Auto EQ：每首歌儲存的聲音、來自媒體庫的專輯聲音，以及疊加其上的智慧校正——細節、平衡或目標。',
  'help.eq.clear': '把每個增益和音色設為 0 dB，保留您的頻段。會先詢問。',
  'help.eq.saveEq':
    '把正在播放的聲音存為已儲存的等化器，更新目前使用的那個，換用另一個，或開啟全部進行管理。',
  'help.eq.mode':
    '您的 EQ 和曲線作用的強度、頻段 Q、相位、高頻和平滑；未做改動時顯示「正常」。等化器模式卡片已釘選時，它會把卡片帶到視野中。',
  'help.eq.add': '在選取的頻段旁新增一個頻段，Q 取已有頻段的值。',
  'help.eq.layouts':
    '頻段數量：讓每個頻段從同一個 Q 開始的頻段數、您儲存的頻段設計，以及重設佈局。',
  'help.eq.frequency': '頻段作用的位置，從 1 Hz 到 20 kHz。',
  'help.eq.gain': '提升或衰減多少。Ctrl+按一下回到 0 dB。',
  'help.eq.q': '寬度：越高越窄。Ctrl+按一下回到佈局的 Q。',
  'help.eq.delete': '按一次準備刪除，再按一次刪除頻段；旁邊的 × 可以反悔。',
  'help.eq.menuDelete': '變成紅色，再按一次才會刪除頻段。',
  'help.eq.ears':
    '同一頻率上每隻耳朵各一個頻段，可分別調整；「雙耳」可重新合併。',
  'help.eq.menuCaption': '頻段的右鍵選單',
  'help.eq.reset': '增益回到 0 dB，Q 回到 2。',
  'help.eq.disable': '把該頻段從聲音中移除，保留其設定。',
  'help.eq.addLeft': '在其下方鄰居的中間新增一條帶。',
  'help.eq.addRight': '在其較高鄰居的中間新增一條帶。',
  'help.eqmode.title': 'EQ 模式和頻段設計',
  'help.eqmode.intro':
    '等化器模式改變聲音的塑造方式，而不改動任何設定。它是圖表下方「你的 EQ」工具中的一個按鈕，釘選後會成為聲音面板的第一張卡片，就在它所改變的曲線旁邊。它有兩個分頁：「您的 EQ」涵蓋您的頻段、音色、預設組、驅動類型和智慧校正；「校正」涵蓋耳機校正以及匯入或自製的曲線。頻段設計可儲存您喜歡的佈局的頻率和 Q，隨時用於任何輸出。',
  'help.eqmode.steps':
    '在圖表下方「你的 EQ」工具中按「等化器模式」。若已釘選，卡片會出現在聲音面板中；否則會以選單形式在圖表上方開啟。\n選擇「您的 EQ」或「校正」分頁，在播放音樂時試試不同的強度或頻段 Q。使用 FluidEQ引擎時，可為每個分頁選擇精確或經典高音，並在分頁提供時選擇最小相位或線性相位。\n在「校正」上，曲線平滑可以 1/12 或 1/3 倍頻程柔化取樣曲線；選擇之前它是關閉的。「重設」會把一切恢復為正常，平滑恢復為關閉。\n更喜歡選單？按卡片上的圖釘：等化器模式就會以選單形式在圖表上方開啟，選單裡的圖釘可以把卡片找回來。\n在「你的 EQ」工具中開啟頻段數量按鈕。選擇 6、10、15、20 或 31 個頻段，或按「儲存設計...」為目前佈局命名。',
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
  'help.eqmode.treble':
    '精準演奏所畫的高音；如 Equalizer APO 一樣經典。僅適用於 FluidEQ 引擎。',
  'help.eqmode.reset': '一切恢復正常，曲線平滑恢復關閉。',
  'help.eqmode.designsCaption': '頻段設計',
  'help.eqmode.builtIn': '6、10、15、20 或 31 段的標準版面。',
  'help.eqmode.resetBands': '把每個頻段恢復到佈局的頻率和 Q；增益保持不變。',
  'help.eqmode.saved':
    '您儲存的設計：按一下即可載入其頻率和 Q，每個頻段設為 0 dB。旁邊的刪除按鈕會在詢問後刪除它。',
  'help.eqmode.sampleDesign': '錄音室監聽',
  'help.eqmode.save':
    '把目前的頻率和 Q 命名儲存為一個設計，列在「我的設計」下。',
  'help.games.title': '遊戲實驗室',
  'help.games.intro':
    '讓每個遊戲都有自己的聲音。遊戲從為它準備的遊戲設定檔開始，並得到自己的副本：您在遊戲實驗室裡調整副本，設定檔本身永遠不會改變。遊戲切到前景時，FluidEQ 會啟用它的聲音，並一直保持到您關閉遊戲，中途用 Alt+Tab 切到哪裡都一樣。之後您的音樂聲音會恢復。',
  'help.games.steps':
    '在標題列開啟遊戲實驗室，按「新增遊戲」。從您的啟動器、目前開啟的程式中選擇，或瀏覽尋找它的程式。它從為它建議的遊戲設定檔開始；隨時可以在它的遊戲設定檔清單裡換一個。清單提供 32 個特定遊戲設定檔，包括 Counter-Strike 2、Valorant 和 Fortnite，另有 9 類遊戲設定檔。\n按「立即試聽」啟用遊戲的聲音。在左側選一個部分——遊戲濾鏡、EQ、曲線或任一 DSP 階段——就地調整。每項變更都保存在這個遊戲的副本裡。\n「另存為設定檔」可以把副本保存為您自己的遊戲設定檔供其他遊戲使用、更新您的設定檔、把副本重設為它的設定檔、重新命名或刪除它。\n啟動遊戲。桌面上的卡片會告訴您它的聲音已啟用，關閉遊戲時另一張卡片會告訴您音樂聲音已恢復。 通知會顯示已載入的設定檔名稱，回到音樂時也會顯示還原的音樂設定檔名稱。',
  'help.games.tip':
    '遊戲的聲音啟用期間，DSP 頁面會顯示已暫停的音樂機架和一個調整該遊戲的按鈕，設定檔清單也會停用，所以在那裡做的任何操作都不會用遊戲的聲音覆寫您的音樂設定檔。遊戲濾鏡會在細小的腳步聲和換彈聲出現的瞬間把它們提上來，並把人聲推到前面。',
  'help.games.list':
    '您的遊戲列在左側，可獨立捲動。拖曳面板邊緣可調整寬度。圖釘可將面板收合為遊戲圖示，指標停在圖示上時面板會在頁面上方展開；再按一次圖釘即可保持展開。寬度與收合狀態都會保留。',
  'help.games.keywords':
    '遊戲、遊戲設定檔、每個遊戲、每個遊戲、每個應用程式、自動、自動切換、蒸氣、史詩、啟動器、FPS、射手、腳步、競技、alt-tab、遊戲模式, game filter, dialogue, voices, ambience, environment, hooves, 遊戲實驗室, gaming lab, 遊戲設定檔, 副本',
  'help.games.switch':
    '讓前景的遊戲啟用自己的聲音。關閉時，您的遊戲沿用您的音樂聲音。',
  'help.games.add':
    '新增 Steam、Epic、EA、GOG、Ubisoft、Battle.net 或 Xbox 的遊戲，或任何現在開啟的程式。 FluidEQ、Windows 檔案總管、已知的系統與啟動器程序，以及共用執行階段安裝程式不會列為遊戲。',
  'help.games.gameName': '一場遊戲',
  'help.games.game':
    '一個遊戲。已開啟的遊戲會標示出來，末端的圓點表示它現在在前景。提示中會說明它的聲音來自哪個設定檔，以及您是否調整過。',
  'help.games.profile':
    '這個遊戲的副本所根據的遊戲設定檔。選另一個會給遊戲一份它的全新副本。',
  'help.games.save':
    '把副本另存為新設定檔或更新您的某個設定檔，把它重設為設定檔、重新命名或刪除。設定檔本身永遠不會改變。',
  'help.games.try':
    '現在就啟用遊戲的聲音，讓您聽到所調整的內容。啟用期間，這裡顯示「卸載」，可恢復您的音樂聲音。',
  'help.games.statusName': '調整了什麼',
  'help.games.status': '這個副本中哪些部分與它的設定檔不同。',
  'help.games.railName': '各個部分',
  'help.games.rail':
    '遊戲聲音的每個部分，各自在清單旁的編輯器中調整。「已調整」標出與設定檔不同的部分。',
  'help.headphones.title': '耳機校正與匯入',
  'help.headphones.intro':
    '耳機校正可補償測量的模型。這是您可以與自己的頻段和預設相結合的起點。在應用結果之前，請檢查確切的型號和測量作者。',
  'help.headphones.steps':
    '開啟 EQ → 耳機校正。它會先開啟您自己的清單「我的曲線」；旁邊的「OPRA媒體庫」分頁收錄了數千款耳機型號的實測校正。搜尋您的確切型號並選擇對應的項目。\n來自其他工具的 EQ 文字，請使用動作選單中的「匯入等化器設定」。套用前請檢查讀取到的頻段和曲線。\n對於 Squiglink，在「我的曲線」上按「從 Squiglink 匯入」，貼上其匯出內容並查看曲線的即時預覽，然後把它作為曲線或可編輯的 EQ 使用。\n「新增曲線」可接受 Squiglink 匯出、.txt 檔案、您目前的 EQ 或從 OPRA 選的項目，並會詢問用於哪隻耳朵：雙耳、左耳或右耳。每條曲線都有「套用為曲線」和「套用為 EQ」；後者會在詢問後只替換這些耳朵的頻段。\n曲線的選單（≡）可以重新命名、編輯頻段、複製一份、複製為文字或刪除。「匯出清單」和「匯入清單」可把整個清單帶到另一台電腦。',
  'help.headphones.tip':
    '標記為「未套用」的預覽不會改變您的聲音。避免對同一個耳機疊加兩個完整的校正，除非是故意的；與關閉耳機層進行比較。',
  'help.headphones.keywords':
    '耳機, 耳機麥克風, 入耳式耳機, 校正, 頻率響應, 測量, OPRA, AutoEQ, Squiglink',
  'help.headphones.tabsName': '我的曲線與 OPRA',
  'help.headphones.tabs':
    '您自己的曲線（附數量），以及 OPRA 的實測耳機校正曲線庫。',
  'help.headphones.libraryName': 'OPRA 更新',
  'help.headphones.library':
    'OPRA 曲線庫是否為最新以及收錄的型號數量；有新版本時，「更新資料庫」會取得它。',
  'help.headphones.add':
    'Squiglink 匯出、.txt 檔案、您目前的 EQ 或從 OPRA 選的項目，可用於雙耳或單耳。旁邊的「從 Squiglink 匯入」可直接貼上 Squiglink 的內容；「匯入清單」和「匯出清單」可帶走整個清單。',
  'help.headphones.searchName': '搜尋與排序',
  'help.headphones.search':
    '按名稱尋找曲線；旁邊的「最近」和 A–Z 用於排序清單。',
  'help.headphones.applyEq':
    '「套用為曲線」把它作為校正層播放並保留您的頻段；「套用為 EQ」會在詢問後改為寫入您的頻段（只用於儲存時指定的耳朵）。',
  'help.headphones.moreName': '曲線選單',
  'help.headphones.more': '重新命名、編輯頻段、複製一份、複製為文字或刪除。',
  'help.convolution.title': '使用脈衝響應',
  'help.convolution.intro':
    '卷積會將 WAV 脈衝響應套用為另一層校正。FluidEQ 提供可搜尋的 AutoEq 目錄，也可匯入您自己的 WAV 檔案。它與可編輯的參數式 EQ 頻段分開運作。',
  'help.convolution.steps':
    '開啟 EQ → 卷積，依型號或測量作者搜尋。\n確認來源後，選擇「下載並套用」；下載檔案的取樣率會符合您的輸出。已有的檔案則使用「匯入 WAV」。\n在「曲線」中開啟及關閉卷積層，比較聆聽效果。',
  'help.convolution.tip':
    'FluidEQ Engine 會自行轉換脈衝響應的取樣率。Equalizer APO 則需要匯入與輸出取樣率相同的 WAV。下載目錄內容需要網路連線，閱讀指南則不需要。',
  'help.convolution.keywords':
    '脈衝響應、ir、wav、convolver、fir、房間校正、rew、autoeq 目錄、校正檔案',
  'help.convolution.import':
    '套用您已有的 WAV；使用 FluidEQ引擎時可為任意取樣率。',
  'help.convolution.applied': '這個輸出目前播放的脈衝。「清除」可將其移除。',
  'help.convolution.search': '按型號或測量作者搜尋 AutoEq 的目錄。',
  'help.convolution.resultName': '一筆結果',
  'help.convolution.result':
    '型號、測量者，以及脈衝的相位和取樣率。「來源」會開啟發布它的地方。',
  'help.convolution.apply':
    '按輸出的取樣率下載脈衝並套用。「已套用」標出正在播放的那個。',
  'help.profiles.title': '裝置、設定檔和第二個輸出',
  'help.profiles.intro':
    '每個輸出都保留自己的聲音：EQ、預設、音調、剪下、DSP 效果器機架、房間和調平都會隨之儲存，並在您切換到它時返回。設定檔保留相同輸出的其他聲音。第二個輸出同時在另一個裝置上播放，並具有自己的聲音和電平。',
  'help.profiles.steps':
    '編輯前檢查輸出卡頂部的輸出；藍牙耳機旁邊顯示了電池。對您想要保留的聲音使用新設定檔；更新儲存對該設定檔的更改，恢復則恢復其已儲存的設定。\n每首歌自己的聲音現在位於 EQ 頁面的 Auto EQ：一首歌在每個輸出上都保留它的預設、音色與 EQ，媒體庫還能為專輯設定一個聲音。\n開啟第二個輸出，開啟裝置並設定其電平。選擇其下方的設定檔，或按「編輯聲音」在 EQ 頁面上更改其聲音，而無需切換主輸出；完成或編輯主要帶您返回。\n每個第二輸出保持其自身的時間並以毫秒為單位顯示其延遲；使用共享音訊，另一臺電腦的聲音會顯示其自身的延遲，包括網路延遲。',
  'help.profiles.tip':
    '在 FluidEQ 引擎下，第二個輸出直接從引擎播放，主輸出從不等待。Auto EQ 預設為關閉。在 EQ 頁面上，面板以 EQ 模式卡開始；折疊它以更快地達到輸出。',
  'help.profiles.keywords':
    '設定檔, 輸出, 裝置, 電量, 電池, 編輯音效, 編輯聲音, 耳機, 音量, 靜音, 第二輸出, 鏡像',
  'help.profiles.list':
    '您儲存的聲音。「開啟」標出這個輸出正在使用的設定檔；按另一個即可切換。設定檔上的鉛筆可重新命名，刪除按鈕會在詢問後刪除。',
  'help.profiles.update':
    '將您的變更儲存到您所在的設定檔中。旁邊的「復原」可將設定檔還原為您上次儲存的狀態。',
  'help.profiles.new': '從您現有的 EQ 開始新的設定檔。',
  'help.profiles.output':
    '您正在收聽的輸出，以及用於藍牙耳機的電池。 OFF 表示你的EQ沒有達到；ACTIVE，Windows 正在透過它進行播放。',
  'help.profiles.onePlayer':
    '在 FluidEQ 中啟動某些內容會暫停 PC 上其他地方播放的內容，反之亦然。',
  'help.profiles.outputs':
    '您的其他輸出。開啟其中一個，聲音也會在那裡播放，並擁有它自己的聲音、音量和以毫秒計的延遲。「編輯音效」可在 EQ 頁面修改它的聲音，而不切換主輸出。',
  'help.profiles.driver':
    '一個溫和的起點，從你所聽的東西開始——頭戴式耳機、入耳式耳機、驅動器尺寸或材料。如果聲音已經正確，請將其保留為“無補償”。',
  'help.profiles.sampleHeadset': '耳機 (USB 音訊)',
  'help.profiles.sampleSpeakers': '喇叭 (Realtek Audio)',
  'help.profiles.sampleMusic': '音樂',
  'help.profiles.sampleMovies': '電影',
  'help.profiles.sampleNight': '深夜',
  'help.config.title': '檢查並備份鏈條',
  'help.config.intro':
    'EQ → 設定顯示音訊引擎在磁碟上實際擁有的內容。輸出卡和包含樹可協助您檢視涉及哪些裝置和層。在大型實驗之前或移動設定時匯出鏈。',
  'help.config.steps':
    '開啟 EQ → 設定並選擇您想要檢查的輸出。讀取其狀態和活動層。\n使用匯出鏈儲存 .fluideq 檔。將副本保留在您可以再次找到的地方。\n若要恢復鏈，請先選擇預期輸出，然後使用匯入鏈並檢視結果。',
  'help.config.tip':
    '產生的圖層檔案在設定變更時會被重寫；將持久的手動行放入每個輸出的自訂檔案中。 FluidEQ 引擎讀取其 Filter、前級增益、GraphicEQ 和 Convolution 行；其他 APO 命令和外掛需要 Equalizer APO。',
  'help.config.keywords':
    '備份、還原、匯出、匯入、配置、設定檔、apo 配置、文字檔案、fluideq 檔案、鏈檔案、包含、自訂行、高階',
  'help.config.statusName': '是否已套用',
  'help.config.status': '引擎是否正在讀取這份設定，最先說明。',
  'help.config.outputsName': '輸出',
  'help.config.outputs':
    '設定中的每個輸出，附其設定檔和所用濾波器數量；「正在播放」標出您正在聽的那個。按一個即可查看其效果鏈。',
  'help.config.transferName': '匯出與匯入',
  'help.config.transfer':
    '「匯出效果鏈」把這個輸出的效果鏈儲存為 .fluideq 檔案；「匯入效果鏈」把它帶回您正在收聽的輸出。',
  'help.config.treeName': '效果鏈的檔案',
  'help.config.tree':
    '輸出的檔案以及其下每一層的檔案，按引擎讀取的順序排列，並顯示各自的內容。',
  'help.config.customName': '您自己的檔案',
  'help.config.custom':
    'FluidEQ 永遠不會改寫的唯一檔案：用「編輯」把您自己的長期內容寫在這裡。',
  'help.config.reload': '重新從磁碟讀取設定。',
  'help.dsp.title': '探討 DSP 效果器機架',
  'help.dsp.intro':
    'DSP 效果器機架 是一系列工作室舞臺。在 FluidEQ 引擎下，它處理 PC 播放的所有內容；在 Equalizer APO 下，它處理庫音軌。當 FluidEQ 關閉時，它會關閉。',
  'help.dsp.steps':
    '打開 DSP，在頂端的「整條鏈」裡選一條鏈：它一次設定所有級。「關於」會打開流派鏈的說明，附有 YouTube 上的試聽範例。\n點選側欄中的某一級即可打開它，再用它自己的開關開啟。它的預設選擇只設定這一級，旁邊的「儲存」只儲存這一級。\nNormalizer 獨立於各條鏈：選擇鏈永遠不會改變它。\n在相近的音量下關掉某一級來比較。有「隔離」的級，只播放這一級改變的部分。按住 Ctrl 點選旋鈕即可恢復預設值。\n「儲存」把整個處理架存成您自己的鏈；「匯出」和「匯入」把它帶到另一台電腦，「重設」把鏈恢復原樣。\n「所有聲道」讓處理架作用於環繞輸出的每個聲道；旁邊的開關開啟或關閉整個處理架。\nDynamics、去齒音、Denoise、房間和 Crossfade 各有一章。遊戲濾鏡在 Gaming Lab；當某個遊戲自己的聲音在播放時，這個頁面會暫停，以免這裡的操作覆蓋它。',
  'help.dsp.tip':
    '響亮的聲音通常聽起來更好，只是因為聲音更大，因此請在匹配的級別進行比較。按住 Ctrl 鍵點選錶盤可將其還原為預設值。',
  'help.dsp.keywords':
    '效果，fx，音訊效果，機架，鏈，外掛，限制器，響度，標準化器，水平器，音量調節，激勵器，諧波，增強器，立體聲加寬器，加寬，立體聲寬度，低音增強器，低音，分諧波，打孔，瞬態，母帶處理，剪輯，峰值限制器，交叉淡入淡出，無間隙，齒音消除器，去嘶聲，嘶嘶聲，刺耳的聲音，尖銳的聲音，ess，聲音，語音、播客、設定檔、儲存設定檔, 腳步聲, 聽腳步, footsteps, 遊戲, 遊戲音效, 換彈, 響度均衡, game, game filter, dialogue, voice clarity, voices forward, ambience, environment, rain, wind, hooves, horses, headset',
  'help.dsp.normalizer':
    '在所有效果之前統一音源的電平：響度、True Peak 或關閉。選擇鏈不會改變它。',
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
  'help.dsp.presets':
    '為音樂、流派、裝置和修復準備好的鏈。選一條即可一次設定所有級。',
  'help.dsp.chainActionsName': '鏈的操作',
  'help.dsp.chainActions':
    '「重設」恢復這條鏈；「儲存」把處理架存成您自己的鏈；「匯出」和「匯入」把它帶到另一台電腦。',
  'help.dsp.switchesName': '處理架開關',
  'help.dsp.switches':
    '「所有聲道」讓處理架作用於環繞輸出的每個聲道，關閉時只作用於前方聲道；「開啟」切換整個處理架。',
  'help.dsp.stagePresetName': '這一級的預設',
  'help.dsp.stagePreset':
    '打開的這一級自己的預設，以及它的箭頭、「重設」和「儲存」，只作用於這一級。',
  'help.room.title': 'The Room：耳機環繞',
  'help.room.intro':
    'The Room 將耳機變成了聽音室。聲音的每個通道都變成了站在您頭部周圍的喇叭，透過測量的頭部和您自己塑造的房間的反射進行渲染，因此一部電影就在您面前，一場遊戲圍繞著您。它需要FluidEQ引擎和耳機；對喇叭來說它沒有任何用處。',
  'help.room.steps':
    '打開 DSP，在側欄選擇「房間」並開啟它。立體聲變成您面前的兩支喇叭；5.1 電影是五支加重低音；7.1 遊戲是整圈喇叭。預設下方的那一行會說明是哪種。\n在「房間預設」中選一個房間（先是精選房間，再是經典房間和您自己的），或者自己轉動空間、氛圍和距離，並沿著圓環拖動喇叭。正在播放的聲音到不了的喇叭會畫成睡著的樣子。\n點選一支喇叭：圖旁邊的面板就歸它所有，可設它的角度、距離、電平，以及靜音或獨奏。\n在「頭部模型」中點選「開始聽力測試」，回答五組簡短的聽音比較：房間會選用讓聲音出現在您面前的頭部。小、中、大也可以手動選擇。\n把喜歡的房間存成一個名字；儲存的房間一按即回，而且從不改變您的頭部。',
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
  'help.room.dials':
    '您可以聽到多少牆壁、牆壁後面的軟尾音以及喇叭站立的距離。尺寸、牆壁和尾巴本身的長度和色調在下面的房間字元中。',
  'help.room.head':
    '房間渲染所用的實測頭部（小、中或大），以及為您的耳朵挑選頭部的聽力測試。',
  'help.room.bass':
    '把喇叭的低音送往重低音或保持全頻，分頻點由您選擇，並設定中置和重低音的電平。',
  'help.room.stereo':
    '僅用於立體聲音源：保持在前方舞台，或依您選擇的程度充滿您周圍的房間。',
  'help.room.saved': '以現在的情況命名房間；按一下它就會回來。',
  'help.room.liveName': '房間在做什麼',
  'help.room.live': '從引擎中讀取：播放串流到達哪些喇叭，或是房間為何空閒。',
  'help.denoise.title': '去噪和源分析',
  'help.denoise.intro':
    '降噪可減少嘶嘶聲、電源嗡嗡聲和喀噠聲。在 FluidEQ 引擎下，它可以在 PC 上播放的任何內容上即時執行；神經語音清理器和掃描本底噪聲適用於庫曲目。更強的減少並不一定會更好。',
  'help.denoise.steps':
    '播放一些您想要降低的噪音，然後在 DSP 中選擇「降噪」。\n在燈光設定下開啟嘶嘶聲、嗡嗡聲或喀噠聲，聆聽安靜的段落和音樂細節。\n逐漸增加減少量，然後繞過該階段以檢查改進是否值得任何細節損失。\n播放媒體庫檔案時，等待音源分析後再比較測得的噪聲底或神經人聲清理。系統音訊可降低嘶聲、嗡聲與點擊聲；神經清理只用於媒體庫播放。',
  'help.denoise.tip':
    '聆聽柔和的細節和水狀或泵動的紋理。這不是麥克風清理。如果您沒有聽到任何變化，請確認機架和載物臺均已開啟。',
  'help.denoise.keywords':
    '噪音、降噪、噪音消除、消除噪音、嘶嘶聲、嗡嗡聲、嗡嗡聲、喀噠聲、劈啪聲、靜態、清理、清理、恢復、修復、背景噪音、乙烯基',
  'help.denoise.preset':
    '溫和或強力清理、嘶聲、嗡聲、咔噠聲、黑膠、磁帶或播客的起點。「儲存」保存您自己的設定。',
  'help.denoise.isolate':
    '只播放 Denoise 去掉的部分，方便您確認它沒有去掉想保留的聲音。',
  'help.denoise.graphName': '雜訊圖',
  'help.denoise.graph':
    '聲音與其本底雜訊對照，嘶聲衰減、嗡聲和咔噠修復隨發生隨畫出。',
  'help.denoise.analysis':
    '在資料庫曲目上：本底雜訊、嗡聲和每分鐘咔噠聲，均從檔案本身測得。「重新掃描」會再測一次。',
  'help.denoise.hiss':
    '降低音樂下方持續的嘶聲。「減少限額」保留一點，讓剩下的聲音不發顫。',
  'help.denoise.hum':
    '濾除電源嗡聲及其諧波。「自動」依掃描結果選用 50 或 60 Hz。',
  'help.denoise.clicks':
    '找出並修補短促的咔噠聲和爆裂聲；更長的聲音保持原樣，鼓聲得以保留。',
  'help.denoise.voice':
    '神經網路人聲清理器，用於資料庫播放。首次使用時下載它的模型。',
  'help.denoise.liveName': '正在做什麼',
  'help.denoise.live':
    '此刻衰減了多少、修復了多少咔噠聲，以及人聲清理器跟不上的時刻。',
  'help.graph.title': '圖表及其控制元件',
  'help.graph.intro':
    '響應圖表在即時聲音上繪製您的 EQ 曲線。它的選項平時隱藏，指標移上去就會回來：一角是圖例，另一角是「檢視」和全螢幕，底部是外觀畫廊——目前外觀及其開關在中間，前一個和後一個在兩端。畫廊提供的內容隨外觀而變：標準樣式或場景。',
  'help.graph.steps':
    '點選外觀名稱來選擇樣式或場景。旁邊的箭頭、空白鍵和 Ctrl+空白鍵可依序切換。\n打開「檢視」設定圖表繪製的內容（每種繪製都有開關，每條曲線也各有一個）、頻率範圍、波形的高度和位置，以及繪製方式：影格率（顯示器能提供的全部影格，或 60、30，使用電池時保持 60）、解析度和平滑。標準樣式與場景分開保存各自的設定。\n場景會在「檢視」中加入自己的控制項（作者留給您調整的部分），「使用自己的波浪」會把波形恢復到作者選擇的高度和位置。\n雙擊圖表讓它填滿螢幕，再雙擊即可返回。全螢幕時，視窗上緣喚出頁首，下緣喚出播放控制；點一下即可收起。\n按鍵：Ctrl+F 全螢幕，Esc 返回，Ctrl+G 格線，Ctrl+W 和 Ctrl+S 在「僅波形」「波形與曲線」「僅曲線」之間切換，Ctrl+I 波形朝向，Ctrl+A 全部頻段。在頻段的點上拖曳可移動，方向鍵可微調，右鍵開啟選單；Ctrl+滾輪改變選取點的 Q。\n在圖表圖例中點選曲線名稱可隱藏或顯示它的繪製。聲音不會改變。想改變聽到的聲音，請在「曲線」中移除或修改那一層。',
  'help.graph.tip': '這裡的一切都只會改變繪圖，不會改變你的聲音。',
  'help.graph.keywords':
    '圖形、頻譜、頻譜分析儀、分析儀、分析儀、頻率響應、曲線、全螢幕、全螢幕、幀速率、fps、重新整理率、波、波形、網格、檢視、快捷鍵、鍵盤快捷鍵、熱鍵、雙擊、展開、展開、標籤、頻段標籤、EQ標籤、鍵盤、箭頭鍵、圖形、解析度、平滑, 畫廊, 圖例, 頻率範圍, 分析儀斜率',
  'help.graph.stripCaption': '具有標準的風格',
  'help.graph.legend':
    '每條已繪製曲線的名稱，以及代表波形的「即時輸出」。按一項即可隱藏或顯示它的繪製；聲音不變。',
  'help.graph.previous': '回到之前的樣子。',
  'help.graph.picker': '開啟每種樣式和場景。',
  'help.graph.placeName': '在序列中的位置',
  'help.graph.place': '這個外觀在箭頭依次切換的外觀中所處的位置。',
  'help.graph.next': '前進到下一個外觀。',
  'help.graph.auto': '每 10 秒到 2 分鐘改變一次外觀。',
  'help.graph.colouring': '為樣式著色：自動、平坦、頻率、水平或熱度。',
  'help.graph.newLook': '從這種風格中設計出您自己的外觀。',
  'help.graph.gridName': '網格',
  'help.graph.grid': '顯示或隱藏網格和比例。',
  'help.graph.hintName': '如何在圖表上編輯',
  'help.graph.hint':
    '指標移上去可查看操作：拖動點，用 Ctrl 或 Shift 選取，Ctrl+捲動調 Q，Ctrl+拖動把一組點按鐘形移動。',
  'help.graph.viewName': '檢視',
  'help.graph.view':
    '圖表繪製什麼、如何繪製：每條曲線、標籤、圖例、波形、格線、頻率範圍和電平表。',
  'help.graph.plusCaption': '有場景',
  'help.graph.creditName': '場景及其作者',
  'help.graph.credit': '正在播放的場景及其作者。按一下可選擇其他樣式或場景。',
  'help.graph.likeName': '喜歡',
  'help.graph.like':
    '喜歡播放的場景，這給了它的製作者分數。在您自己的場景中，它顯示了它有多少個讚。',
  'help.graph.lighting': '使用此場景點亮您的 RGB 裝置。',
  'help.graph.desktop': '將此場景放在桌面圖示後面。',
  'help.graph.viewCaption': '檢視選單',
  'help.graph.fullscreen': '圖表充滿螢幕。',
  'help.graph.curves':
    '圖表繪製的每條曲線各有一個開關，按套用順序排列。Ctrl+W 依次切換「僅波形」「波形和曲線」「僅曲線」；Ctrl+S 反向切換。',
  'help.graph.labels': '每個頻段的頻率、Q 值和增益。',
  'help.graph.wave': '您所聽到聲音的即時波形，以您選擇的外觀繪製。',
  'help.graph.range':
    '圖表涵蓋的頻譜範圍：起初為 10 Hz–20 kHz，另有 20 Hz–20 kHz、10 Hz–30 kHz，或錄音中有聲音的 20 Hz–16 kHz。關閉格線時為 20 Hz–16 kHz。',
  'help.graph.slope':
    '把分析儀傾斜最多每倍頻程 6 dB，讓向高頻衰減的音樂看起來更平。預設關閉；只用於繪製分析儀的樣式。',
  'help.graph.meter': '左軌中的輸出表。',
  'help.graph.drawing': '幀速率、解析度和平滑度，與標準風格和場景分開。',
  'help.graph.sampleScene': '極光',
  'help.graph.sampleScenePrevious': '綻放',
  'help.graph.sampleSceneNext': '霓虹城市',
  'help.graph.sampleMaker': 'Lumen Works',
  'help.looks.title': '風格和場景',
  'help.looks.intro':
    '標準樣式是現場聲音的免費繪圖，您可以自己著色和設計：用於清晰軌跡的線條和區域，用於打孔的 LED 塊和尖峰，用於整個場景的桁架、天際線和舞動火焰。場景是在顯示卡上繪製的生動圖畫，例如阿爾卑斯山、極光、布魯姆和霓虹城，其中低音、節拍和高音各有不同的動感。',
  'help.looks.steps':
    '點擊圖表上的外觀名稱。在左側選擇一個分區，或一次搜尋全部。\n用「來源」只看 FluidEQ 的外觀、會員的場景或你自己的。還不屬於你的場景會被鎖定，選擇它會說明如何取得。\n在標準樣式上按「新外觀」，變更它的顏色、動作和峰值，然後儲存；它會出現在「來源：你的」下方。',
  'help.looks.tip':
    '場景有自己的顏色：在檢視中設定其攻擊和釋放。除了場景之外，標準樣式在檢視中具有自己的圖形設定：首先是全解析度和簡單縮放。如果場景無法在此電腦上執行，圖形將繪製自由樣式而不是空白圖。',
  'help.looks.keywords':
    '樣式、樣式、皮膚、皮膚、外觀、場景、視覺化工具、視覺化工具、視覺化、顏色、顏色、外觀、自訂、自訂、動畫、圖形、圖形設定、解析度、品質',
  'help.looks.searchName': '搜尋',
  'help.looks.search': '按名稱、製造商或類別尋找樣式和場景。',
  'help.looks.placesName': '分區',
  'help.looks.places':
    '全部、新增與更新、樣式類型和每個場景分類，各自標出數量。',
  'help.looks.from': '由誰製作：FluidEQ、會員或你。',
  'help.looks.viewName': '檢視和排序',
  'help.looks.view':
    '以圖片或詳細清單顯示，可按最新、最近更新、名稱或最常用排序。',
  'help.looks.plus':
    '每個外觀都以圖片顯示。「新」或「已更新」標出變化，「正在播放」標出圖表上的外觀。',
  'help.plus.title': '您的帳戶、點數和「場景」標籤',
  'help.plus.intro':
    '帳戶是可選的：所有免費的內容都可以在這臺電腦上執行，無需帳戶。登入後，「場景」標籤包含相簿、工作室、動態照明和桌面背景。畫廊中的一個場景只需花費一個點數，並且永遠屬於您；已確認的帳戶可免費獲得 1 個點數，並且一次性支付點數包。',
  'help.plus.steps':
    '開啟「場景」標籤，按「登入」或「建立免費帳戶」，然後輸入傳送到您電子郵件的六位數驗證碼。登入後，標籤左欄底部的卡片就是您的帳戶。\n選擇「畫廊」。開啟一個場景，觀看後按「取得」為它花費一點。\n如需更多點數，請從那張卡片開啟帳戶並選擇點數包。只需在瀏覽器中透過 Stripe 付款一次。',
  'help.plus.tip':
    '該應用程式永遠看不到您的卡，也不會更新任何內容。一個帳戶最多可在五臺電腦上保持登入狀態。',
  'help.plus.keywords':
    '帳戶、登入、登入、登入、註冊、註冊、點數、點數、套餐、購買、價格、定價、成本、付款、付款、溢價、付費、場景、訂閱、取消、會員資格、會員、電子郵件程式碼',
  'help.plus.visualizers': 'FluidEQ 和會員的場景，為您的音樂做好準備。',
  'help.plus.studio': '用你的人工智慧製作你自己的場景。',
  'help.plus.lighting': '您的 RGB 裝置跟隨場景。',
  'help.plus.fold': '將導軌折疊到其圖片上；懸停時它會再次開啟。',
  'help.gallery.title': '場景畫廊',
  'help.gallery.intro':
    '畫廊匯集了 FluidEQ 自己的場景和會員發布的場景。只要有帳號就能瀏覽相簿。如果場景有已發布的預覽，十秒的無聲短片會循環播放，直到你切換場景。沒有短片時會顯示封面。用一點數取得的場景會隨你的音樂播放，並保留在你的外觀中。',
  'help.gallery.steps':
    '開啟場景 → 相簿。搜尋，按最喜歡、本週或最新排序，或選擇一個類別。\n開啟一個場景並按下「取得」，用一個點數保留它，然後在圖表上「播放」。箭頭或 ← 和 → 在場景之間移動。\n喜歡你用心的場景，檢舉不該有的場景。',
  'help.gallery.tip':
    '外觀中的場景會自行更新，場景頁面會說明每個版本中所發生的變化。一旦 FluidEQ 的製造商批准了您發布的場景，就會出現該場景。 Open in Studio展示了FluidEQ自己的場景是如何製作的。3D 場景會在卡片和頁面上註明，並列出移動鏡頭的按鍵。場景播放時，在「檢視」→「視窗顏色」中選擇視窗的顏色：原始、顏色或氛圍。',
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
    '工作室將描述轉化為場景。您自己的人工智慧助理將場景寫入專案資料夾中，FluidEQ 在儲存音樂時立即播放音樂上的每個版本。 Studio 對每個帳戶都是免費的。',
  'help.studio.steps':
    '開啟場景 → Studio 並按下新建專案…。給它一個名字； FluidEQ 使其資料夾包含已移動的場景。\n描述您的想法，開啟 AI 助理中的資料夾，然後貼上複製 AI 提示中的提示。\n或在舞臺旁的聊天中輸入應該更改的內容：在這臺電腦上使用Claude Code，使用您自己的計劃登入，編輯場景並播放每個版本。每個回應都會保留其版本，並帶回。\n觀察檔案儲存過程並嘗試測試訊號。然後新增到我的外觀、發布...或匯出...。\n在「發布…」中為場景寫一句介紹，或點選「用 AI 撰寫」，然後點選「傳送以供審核」：傳送時，FluidEQ 會用示範歌曲錄製相簿用的十秒無聲預覽。',
  'help.studio.tip':
    '雙擊舞臺以全螢幕顯示。檢視 FluidEQ 場景內部...開啟 FluidEQ 自己的場景之一進行學習；它不能被發布。閃爍劇烈或執行過重的場景會被抑制。您發布的場景首先會由 FluidEQ 的製作者閱讀，一旦獲得批准，您就可以在任何地方免費播放。',
  'help.studio.keywords':
    '建立視覺化工具、製作視覺化工具、製作場景、場景、著色器、glsl、程式碼、ai、chatgpt、克勞德、提示、發布、匯出場景、場景編輯器、創作者、聊天、工作室聊天、要求更改、克勞德程式碼、帶回、版本',
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
  'help.desktop.title': '桌面背景',
  'help.desktop.intro':
    '只要 FluidEQ 執行，桌面背景就會將場景放在桌面圖示後面、一臺顯示器或每臺顯示器上。',
  'help.desktop.steps':
    '將場景放在圖表上，然後按下其名稱旁的監視器按鈕，或選擇「檢視」→「設定為桌面背景」。\n按地圖上的監視器，選擇“隨著音樂”或“平靜”，然後按“設定背景”。\n若要變更或停止它，請開啟場景 → 相簿並使用頂部的管理或停止。',
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
    '開啟場景 → 動態照明並將其開啟，或按下圖表上場景旁的照明按鈕。\n選擇該場景的照明風格 - 場景、色彩波、光譜或節拍波紋 - 並設定其亮度及其反應。\n點選「您的裝置」下的裝置可單獨調整；所有裝置都會返回每個裝置。',
  'help.lighting.tip':
    '如果 Windows 為另一個應用程式保留了一個裝置，該頁面會命名要變更的設定並為您開啟它。 Razer 裝置需要執行 Razer Synapse，並允許使用 Chroma 應用程式。',
  'help.lighting.keywords':
    'RGB、雷蛇、色度、突觸、鍵盤燈、鍵盤、滑鼠、耳機、LED、LED、環境照明、燈光、Windows 動態照明',
  'help.lighting.switch': '播放場景時點亮您的裝置。',
  'help.lighting.browse': '開啟相簿以選擇場景。',
  'help.lighting.previewName': '即時桌面預覽',
  'help.lighting.preview': '您自己的辦公桌，用傳送到它的顏色照亮。',
  'help.lighting.devices':
    '找到的每個裝置。點選其中一項單獨調音；清單上方的所有裝置都會再次對它們進行調整。',
  'help.lighting.style': '為每個場景保留場景、色彩波、頻譜或節拍波紋。',
  'help.online.title': '用線上媒體聆聽',
  'help.online.intro':
    '線上媒體在 FluidEQ 中播放 YouTube、YouTube Music、Bandcamp、Twitch 和 Suno，版面與媒體庫相同：側欄是網站和您最近的搜尋，頁面上方是工具列。播放的聲音會像其他應用程式一樣經過您的 EQ；播放與登入由各網站自行處理。',
  'help.online.steps':
    '在側欄選擇一個網站。從工具列搜尋，或在網站頁面上找到內容並播放。\n按一下最近的搜尋，即可在目前開啟的網站上再次搜尋。\n播放時切換到其他分頁：頁面會繼續播放，視窗底部的列會跟著它。\n如果您希望 FluidEQ 和其他播放器互相暫停而不是同時發聲，請開啟「一次使用一個播放器」。',
  'help.online.tip':
    '使用 FluidEQ 引擎時，線上媒體會像其他應用程式一樣經過您的 EQ 和 DSP 機架。使用 Equalizer APO 時，機架只作用於媒體庫的曲目。',
  'help.online.keywords':
    'youtube, youtube music, bandcamp, twitch, suno, 串流, 網頁, 網站, 瀏覽器, 線上, 搜尋紀錄, 最近的搜尋, 登出, 配色, 深色頁面',
  'help.online.sites':
    '網站清單。旁邊的圓點表示正在播放。側欄上方的圖釘可把它收合成圖示。',
  'help.online.recent':
    '您之前的搜尋。按一下即可在目前的網站再次搜尋；× 可刪除這筆紀錄。',
  'help.online.colours':
    '把網站頁面配成 FluidEQ 的顏色，只在您的螢幕上生效。影片、圖片和標誌不會改變；頁面本身是淺色的網站保持原樣。',
  'help.online.signOut': '清除播放器保存的所有登入、Cookie 和快取頁面。',
  'help.online.navName': '返回、前進和重新載入',
  'help.online.nav': '在網站上開啟過的頁面之間來回，或重新載入頁面。',
  'help.online.search': '搜尋目前開啟的網站，並把搜尋記入「最近的搜尋」。',
  'help.library.title': '瀏覽與整理您的媒體庫',
  'help.library.intro':
    '媒體庫把您磁碟上的音樂和影片匯集到一頁：側欄是各個書架，上方的列用來尋找和排列，列下顯示您所在的位置。封面和資訊來自檔案的標籤，可用標籤編輯器修正。',
  'help.library.steps':
    '按側欄底部的「新增資料夾」，選擇您的音樂所在的資料夾。頁面下方的狀態列會顯示媒體庫何時已是最新。\n選擇一個書架：專輯、藝術家、流派、歌曲、資料夾（您的資料夾會在其下以樹狀展開）、影片或某個播放清單。影片直接在頁面中播放，「字幕」分頁負責它的字幕。\n從工具列搜尋，用「詳細資料」「網格」或 Cover Flow 顯示書架，並用「排序」調整順序。箭頭可在去過的位置之間返回和前進。\n開啟專輯、藝術家或資料夾即可看到其中的歌曲。藝術家的名字無論出現在哪裡，按一下都會開啟其頁面：所有專輯以及參與的每首歌曲。\n要修正標籤，請以右鍵按一首歌、幾首歌或一張專輯，選擇「編輯標籤…」（Ctrl+I）或「自動修正標籤…」（Ctrl+Shift+I）。單首歌曲在頁面旁開啟；專輯、資料夾或所選歌曲以整頁開啟。\n檢查變更後按「儲存」。檔案在背景寫入，角落的卡片提供「復原」，可恢復原來的標籤。',
  'help.library.tip':
    '即使視窗已最小化，把指標停在 Windows 工作列上的 FluidEQ 按鈕上即可使用上一首、播放和下一首。把音樂拖放到媒體庫上即可播放。媒體庫需要檔案留在原本找到它們的位置：請重新連接磁碟機，或重新新增移動過的資料夾。',
  'help.library.keywords':
    '音樂播放器、播放器、本地檔案、本地音樂、mp3、flac、wav、aac、資料夾、資料夾樹、專輯、藝術家、流派、播放清單、影片、字幕、掃描、Cover Flow、網格、排序、標籤、編輯標籤、標籤編輯器、修正標籤、ID3、重新命名檔案、專輯封面、MusicBrainz、復原, 播放清單, 新播放清單',
  'help.library.shelvesName': '書架',
  'help.library.shelves':
    '媒體庫裡有什麼，以及每個書架上的數量。「資料夾」會在下方展開您的資料夾樹。',
  'help.library.playlists':
    '您的所有播放清單，也在這裡新增；下方是「收藏夾」和您自己的清單。',
  'help.library.addFolder':
    '新增一個音樂或影片資料夾。下方的「管理資料夾」列出它們，也可移除。',
  'help.library.history': '在開啟過的位置之間返回和前進。',
  'help.library.search': '在整個媒體庫中尋找歌曲、藝術家和專輯。',
  'help.library.views':
    '每個書架都可用「詳細資料」「網格」或 Cover Flow 顯示。',
  'help.library.sort':
    '依標題、藝術家、年份、最近新增、最常播放等為書架排序。箭頭可反轉順序。',
  'help.library.upNext':
    '開啟或收合右側面板：正在播放的歌曲、「接下來播放」「詳細資料」和「歌詞」。',
  'help.library.album':
    '開啟專輯。以右鍵按一下可整張播放、加入佇列、加入播放清單或編輯標籤。',
  'help.library.rescan':
    '顯示媒體庫是否已是最新。「重新掃描」檢查資料夾的變化；旁邊的「強制重新掃描」會把每個檔案重新讀一遍。',
  'help.library.tagsCaption': '自動修正之後，標籤編輯器中的一張專輯',
  'help.library.fixAuto':
    '根據檔名、資料夾名稱、.cue 檔以及多數歌曲一致的資訊補全缺少的內容，並把資料夾中的圖片作為封面。不會在網路上查找任何內容。',
  'help.library.searchWeb':
    '在瀏覽器中開啟 MusicBrainz 上的這張專輯。FluidEQ 不會下載任何內容。',
  'help.library.cover':
    '所有歌曲共用一張封面。按一下可選擇、貼上或搜尋圖片，也可以把圖片拖放上來。',
  'help.library.albumFields':
    '為所有歌曲一次填寫的值。變更的內容以彩色顯示，被取代的舊值以刪除線顯示在下方；箭頭可還原舊值。',
  'help.library.findReplace': '在所有標題中尋找文字並一次全部取代。',
  'help.library.fileNames':
    '依模式根據標籤重新命名檔案。每個新檔名顯示在對應歌曲下方，舊名以刪除線顯示。',
  'help.library.sheet':
    '像試算表一樣編輯每首歌的編號、標題和藝術家。拖動列左側的把手後，按「依順序重新編號」。',
  'help.library.save':
    '寫入變更；在此之前磁碟上什麼都不會變。「捨棄」會丟棄全部變更。',
  'help.library.changesCaption': '變更：按「儲存」會寫入的內容',
  'help.library.changes':
    '按「儲存」會寫入的全部內容及數量。編輯器開啟時，它顯示在「接下來播放」的位置。',
  'help.library.changesAlbum':
    '每首歌都會改變的內容。原本空著、新填入的值為綠色；被取代的值會以刪除線顯示舊值。',
  'help.library.changesSongs': '每首歌各自的變更，之後是將被重新命名的檔案。',
  'help.queue.title': '專輯、接下來播放與歌詞',
  'help.queue.intro':
    '開啟專輯時，歌曲清單顯示在封面下方，正在播放的內容不會停止。旁邊的右側面板顯示正在播放的歌曲和三個分頁：「接下來播放」、歌曲的「詳細資料」和「歌詞」。',
  'help.queue.steps':
    '開啟專輯並按「播放」，或按一首歌從那裡開始。對同一首歌再按一次會從頭播放。\n以右鍵按歌曲可選擇「新增到下一個」「加入收藏夾」或「新增到播放清單」；按住 Ctrl 或 Shift 可選多首。\n在「接下來播放」中，按一首歌立即播放，拖動可調整順序，指標移上去按 × 可移除。\n開啟「繼續播放」後，清單播完會繼續播放同一流派的歌曲。「給我驚喜」位於「接下來播放」底部和播放列上，會從媒體庫隨機播放一首歌，並依它的風格繼續。\n「歌詞」顯示歌曲標籤中的歌詞，或旁邊同名 .lrc、.txt 檔案中的歌詞。帶時間的歌詞行會隨歌曲逐字點亮。\n沒有歌詞，或歌詞不對？「尋找其他歌詞」會在瀏覽器中線上搜尋這首歌。匯入下載的檔案、貼上歌詞，或把檔案拖放到分頁上，FluidEQ 會把歌詞和歌曲保存在一起。',
  'help.queue.tip':
    '「在卡拉 OK 中開啟」會用歌曲的歌詞在卡拉 OK 製作工具中產生卡拉 OK，可在那裡修正時間。在 Windows 上，把音樂檔案或資料夾拖放到輕巧播放器上，即可加入媒體庫並排入佇列。',
  'help.queue.keywords':
    '佇列, 接下來播放, 下一首, 隨機播放, 重複, 收藏夾, 播放清單, 繼續播放, 自動播放, 給我驚喜, 隨機, 正在播放, 歌詞, lrc, 同步歌詞, 逐字歌詞, lrclib, genius, musixmatch, 卡拉 OK, 播放順序',
  'help.queue.recordCaption': '開啟的專輯',
  'help.queue.place': '您所在的位置：先是書架，再是專輯。按書架即可回到那裡。',
  'help.queue.artist': '開啟藝術家頁面：其所有專輯以及參與的每首歌曲。',
  'help.queue.fix': '在標籤編輯器中開啟專輯，並已填入修正建議。',
  'help.queue.actionsName': '專輯的按鈕',
  'help.queue.actions':
    '「播放」「隨機播放」「新增到下一個」「在檔案總管中顯示」，以及專輯選單：收藏夾、播放清單、編輯標籤等。',
  'help.queue.albumSound':
    '這張專輯的聲音（已儲存的 EQ 或預設），播放其中任何一首歌時都會使用。',
  'help.queue.filter':
    '輸入時過濾這張專輯的歌曲。工具列的搜尋則尋找整個媒體庫。',
  'help.queue.songsName': '歌曲',
  'help.queue.songs':
    '按一首歌即可播放。跳動的條表示正在播放的歌曲，星號表示收藏；以右鍵按一下開啟它的選單。',
  'help.queue.paneCaption': '右側面板，「接下來播放」',
  'help.queue.now': '正在播放的歌曲。按藝術家名稱可開啟其頁面。',
  'help.queue.tabs':
    '「接下來播放」、歌曲的「詳細資料」（檔案、格式和響度）及「歌詞」。影片的最後一個分頁是「字幕」。',
  'help.queue.keep': '清單播完後，繼續播放同一流派的歌曲，然後是驚喜。',
  'help.queue.rowsName': '接下來播放的內容',
  'help.queue.rows':
    '您正在聽的內容的其餘部分，以所屬專輯為標題。按一首歌立即播放，拖動可調整順序，指標移上去會出現 ×。',
  'help.queue.picks':
    '您自己加入的歌曲，排在專輯其餘部分之後，依加入的順序排列。',
  'help.queue.surprise':
    '立即從您的媒體庫隨機播放一首歌，之後繼續播放相同風格的音樂。',
  'help.queue.lyricsCaption': '「歌詞」與「尋找其他歌詞」',
  'help.queue.lyricsLine': '正在唱的歌詞行逐字點亮。按任意一行即可從那裡播放。',
  'help.queue.sourceName': '歌詞來源',
  'help.queue.source':
    '歌曲的標籤，或旁邊歌詞檔案的名稱。垃圾桶會刪除與歌曲一起保存的歌詞檔案；歌曲檔案內部的歌詞永遠不會被更動。',
  'help.queue.karaoke':
    '用這些歌詞在卡拉 OK 製作工具中開始一首卡拉 OK，可在那裡修正時間。',
  'help.queue.findOther': '開啟右側所示的尋找頁面，匯入其他歌詞。',
  'help.queue.sites':
    '在瀏覽器中到 LRCLIB（免費、帶時間）、Genius 或 Musixmatch 搜尋這首歌。FluidEQ 自己不擷取任何歌詞。',
  'help.queue.import':
    '把歌詞和歌曲保存在一起：下載的檔案、貼上的文字，或拖放到分頁上的檔案（.lrc、.srt、.vtt、.ttml、.json、.yaml 或 .txt）。',
  'help.karaoke.title': '唱卡拉 OK',
  'help.karaoke.intro':
    '卡拉 OK 把您自己的歌曲放上舞台：隨演唱推進的歌詞、和弦，以及一條音高條，在歌曲的音符上畫出您的聲音，並為每一行評分。歌曲像媒體庫一樣排在旁邊的清單裡，並透過媒體庫的播放器、依您的聲音設定播放。',
  'help.karaoke.steps':
    '開啟卡拉 OK，按歌曲旁的 + 新增檔案或整個資料夾：每首歌曲附上它的歌詞檔案。按兩下一首歌曲即可開唱。\n使用舞台頂端這一列：音高和和弦分別開關音高條和和弦標籤；場景、封面、影片或無決定歌詞後面顯示什麼。選了場景時，旁邊會出現場景選擇。\n在音高條角落開啟麥克風開始唱。每個音符是一個方塊，您的聲音是穿過它的一條線：唱準是綠色，接近是黃色，走音是紅色。每個音符結束時都會得到評判。\n音高條下方，歌曲的每一行是一排帶分數的格子。按下某一行，就會從它前面一點重新唱。歌曲結束時，總結會顯示滿分 10,000 的得分、最難的地方、一則建議，以及每一行與您最佳成績的比較；查看結果可再次開啟。\n在播放列開啟混音設定，可調整音量、旋律音量、伴奏曲目，以及製作工具分離歌曲後的指導聲樂：原唱的聲音墊在音樂下方，想多大聲就多大聲。\n全螢幕時整個視窗都給舞台。靜止幾秒後，這一列和播放列會讓開：把指標移到上緣顯示頁首，移到下緣顯示播放列，或用全螢幕旁的按鈕把它們固定。',
  'help.karaoke.tip':
    '只有文字的歌詞檔案沒有音符，音高條上就沒有可唱、可評分的內容；UltraStar 檔案自帶音符，卡拉 OK 製作工具也能補上。和弦優先取自歌曲自己的檔案（歌曲旁的和弦譜或歌詞檔案裡的和弦），沒有時再從音樂中推算。麥克風只在這台電腦上分析音量與音高；FluidEQ 從不錄音，也不會透過喇叭播放它。',
  'help.karaoke.keywords':
    '唱歌, 歌詞, 麥克風, 音高, 評分, 分數, 和弦, 指導聲樂, 全螢幕, lrc, ultrastar, sing, lyrics, karaoke',
  'help.karaoke.stageCaption': '舞台：歌詞、和弦、您的音高與得分',
  'help.karaoke.guides':
    '音高顯示音符條，和弦顯示和弦標籤。兩者各自開關；都關掉時舞台只顯示歌詞。',
  'help.karaoke.background':
    '歌詞後面顯示什麼：場景、歌曲封面、歌曲影片，或什麼都不放。歌曲附有封面和影片時才能選擇它們。',
  'help.karaoke.maker':
    '在卡拉 OK 製作工具中開啟這首歌，修正它的時間、歌詞或音符。',
  'help.karaoke.textSize': '依您唱歌時離螢幕的距離，把歌詞放大或縮小。',
  'help.karaoke.micSettings':
    '選擇用哪個麥克風、它聽到您的音量大小以及麥克風音量。麥克風開著時它會亮起。',
  'help.karaoke.fullScreen':
    '把整個視窗交給舞台；按兩下舞台也一樣。全螢幕時這裡會多出兩個按鈕，讓頁首或播放列一直顯示。',
  'help.karaoke.chords':
    '剛彈過的和弦、正在響的和弦（醒目標示），以及接下來的兩個。',
  'help.karaoke.pitch':
    '要唱的音符是一個個方塊，您的聲音是穿過它們的線：唱準是綠色，接近是黃色，走音是紅色。拖曳它可在歌曲中前後移動，拖曳上方的控點可把它拉高。',
  'help.karaoke.micToggle':
    '開啟或關閉麥克風。它在聽的時候，旁邊會顯示您正在唱的音。',
  'help.karaoke.score':
    '每一行是一排格子，每個音符一格，依評判上色，旁邊是目前得分和連擊。按下某一行可以重唱。',
  'help.karaoke.playlistCaption': '舞台旁的歌曲',
  'help.karaoke.search': '依標題或檔名在清單中尋找歌曲。',
  'help.karaoke.add': '新增檔案或資料夾、按資料夾分組清單，或清空清單。',
  'help.karaoke.fold':
    '把清單收起，讓出空間給舞台。舞台這一列開頭的播放清單按鈕可把它找回來。',
  'help.karaoke.singingName': '舞台上的歌曲',
  'help.karaoke.singing':
    '正在唱時它會顯示跳動的條。按一下歌曲選取它，按兩下開唱；把指標移到某一列上，可以上移、下移或從清單中移除。',
  'help.karaoke.folderName': '資料夾',
  'help.karaoke.folder':
    '清單按資料夾分組時，按下資料夾可收起或展開其中的歌曲。數字是它包含的歌曲數。',
  'help.karaoke.mixCaption': '混音設定，位於視窗底部的播放列',
  'help.karaoke.volume':
    '電腦的音量，與各分頁播放列上的推桿相同。點它的圖示可靜音。',
  'help.karaoke.melody': '彈奏歌曲音符的提示音，可跟著唱。它的按鈕可開關它。',
  'help.karaoke.backing':
    '音樂：歌曲本身，或卡拉 OK 製作工具分離人聲後的伴奏曲目。',
  'help.karaoke.vocal': '歌曲分離後墊在伴奏下方的原唱人聲。降到零就只剩音樂。',
  'help.karaoke.scene':
    '歌詞後面是場景時，它透出多少、模糊多少。卡拉 OK 有自己的數值，與圖表的分開。',
  'help.karaoke.micCaption': '麥克風設定',
  'help.karaoke.micInput': '您唱歌用的麥克風。',
  'help.karaoke.micOn': '開始或停止收音。是否開啟顯示在面板右上角。',
  'help.karaoke.micLevel': '麥克風此刻聽到您的音量。唱幾句，看它跳動。',
  'help.karaoke.micVolume': '麥克風太小聲、聽不出音高時調大，太大聲時調小。',
  'help.karaoke.scoreCaption': '一首歌結束時的總結',
  'help.karaoke.total':
    '滿分 10,000 的得分、它的評語，以及與這首歌最佳成績的比較。',
  'help.karaoke.statsName': '音準 · 節奏 · 音符',
  'help.karaoke.stats':
    '您在音符內唱的時間比例、準時進入的音符數和唱中的音符數，下方列出各種評判的次數。',
  'help.karaoke.hardest':
    '最讓您吃力的一行及原因，下方附一則下次可以試試的建議。',
  'help.karaoke.practise': '回到那一行之前一點，再唱一次。',
  'help.karaoke.again': '從頭再唱整首歌。',
  'help.karaoke.map':
    '每一行的評級，以及與您最佳成績相比變化了多少分。按下某一行即可練習它。',
  'help.karaoke.attempts': '您最近幾次唱這首歌的成績，包括這次和最佳的一次。',
  'help.maker.title': '在 卡拉 OK 製作工具 中建立',
  'help.maker.intro':
    '卡拉 OK 製作工具把一首歌做成可以唱的卡拉 OK：歌詞、每個詞何時唱，以及旋律的音符。它在一個編輯器裡開啟舞台上的歌曲：頂端是工具，下方是帶歌詞和音符的歌曲聲音，還有一個即時預覽，顯示舞台將如何呈現它們。',
  'help.maker.steps':
    '在卡拉 OK 舞台上按在製作工具中開啟。按歌詞，貼上歌曲的歌詞或載入歌詞檔案，每行一句，每次重複都寫出來。\n按檢測節奏和旋律，讓 FluidEQ 聽出每個詞何時唱、由哪些音符承載；或按接受並記錄時間，在歌曲播放時自己逐行點按。第一次會下載所需的 AI 模型。\n在格線中檢查結果：詞語排在音符上方的軌道裡，音符的畫法與舞台相同。拖曳詞語或音符可移動它，拖曳邊緣可改變長短。選取音符可框選多個；繪製音符可畫出新的音符。\n用格線下方的總覽在歌曲中移動，或在格線任意處按住滑鼠中鍵拖曳，同時在時間和音高上移動。格線左緣的音域可縮放和捲動音符。跟隨歌詞讓播放頭始終可見，到達邊緣時翻頁。\n按在播放器中使用即可在舞台上演唱。匯出可存成 FluidEQ 專案、UltraStar TXT、LRC 或增強 LRC；來自媒體庫的歌曲還可以用儲存到媒體庫寫回去。',
  'help.maker.editorCaption': '編輯器：歌曲的聲音、歌詞和音符',
  'help.maker.gridName': '格線',
  'help.maker.grid':
    '上方是歌曲的聲音，下面三條軌道是歌詞，音高格線上的方塊是音符，畫法與舞台相同。按住滑鼠中鍵拖曳，可在時間和音高上移動。',
  'help.maker.pitchRange':
    '格線在整個音域中所處的高度。拖曳兩端縮放，拖曳中間捲動；按兩下讓它配合音符。',
  'help.maker.overview':
    '整首歌曲，格線中顯示的部分用框標出。拖曳框可移動，拖曳框的邊緣可縮放。',
  'help.maker.follow': '播放時讓播放頭始終可見，到達邊緣時翻頁。',
  'help.maker.preview':
    '歌曲播放時，歌詞在舞台上的樣子。A 滑桿調整字級；隱藏它可騰出空間。',
  'help.maker.checked':
    '您手動調整過的詞數，以及仍保持檢測或匯入時狀態的詞數，旁邊是歌曲的音符、詞語和檢查數。',
  'help.maker.lyricsCaption': '這些歌詞，以及每一個被唱出來的時候',
  'help.maker.reference':
    '整首歌曲為文本，每行一行。貼上或載入檔案； FluidEQ 從中找到時序。',
  'help.maker.timing': '每個單詞，依序，有多少個都計時至今。按一即可進行操作。',
  'help.maker.word':
    '所選單字從哪裡開始以及持續多久。移動它的邊緣會給予或減少它旁邊的單字的時間；線保持其長度。',
  'help.maker.toolsCaption': '維修工具及其所需的 AI 模型',
  'help.maker.separate':
    '把錄音分成人聲和音樂。之後卡拉 OK 可以不帶原唱播放，指導聲樂推桿可以把人聲墊回去，檢測也能把歌詞聽得更清楚。',
  'help.maker.loadVocals': '使用您已有的純聲音檔案，而不是在此處分離一個檔案。',
  'help.maker.redetectTiming':
    '重新聽分離出的人聲，為已有的詞重新計時。需先分離人聲。',
  'help.maker.redetectNotes':
    '重新從分離出的人聲中聽取旋律，改寫歌詞下方的音符。需先分離人聲。',
  'help.maker.models':
    '每個型號需要什麼以及是否在這臺電腦上。它們是在您第一次使用時下載的。',
  'help.maker.idle':
    '模型在兩次使用之間是否保留在記憶體中以及保留多長時間。釋放它可以釋放記憶體；保留它可以立即開始下一次執行。',
  'help.makerBar.caption': '製作工具頂端的工具',
  'help.makerBar.import':
    '開啟卡拉 OK 檔案或已儲存的專案，並保留已載入的音訊。',
  'help.makerBar.lyrics': '文字和時間都在一個視窗中。',
  'help.makerBar.timing':
    '將歌詞和音符移到一起，適用於從第一秒開始較早或較晚執行的歌曲。',
  'help.makerBar.language':
    '歌詞所使用的語言，以及旁邊的第二種語言，以便這首歌可以用其中一種語言演唱。',
  'help.makerBar.record':
    '播放歌曲並在每行開始和結束時按下一個鍵。時機來自於你的壓力。',
  'help.makerBar.select': '在音符周圍畫一個框以將它們作為一個整體移動或刪除。',
  'help.makerBar.paint': '將旋律直接繪製到音高網格上。',
  'help.makerBar.repair':
    '把人聲與音樂分開，並重新聽取歌詞或旋律，附帶所需的 AI 模型。',
  'help.makerBar.export':
    '將完成的卡拉 OK 寫入為 FluidEQ 專案、UltraStar TXT、LRC 或增強型 LRC。',
  'help.makerBar.apply': '把做好的卡拉 OK 交給舞台，並關閉製作工具。',
  'help.maker.tip':
    '檢測只是起點：播放短片段，對照錄音修正詞語和音符。先把人聲與音樂分開，檢測能把歌詞聽得更清楚，播放器也會多出指導聲樂推桿。模型第一次需要連線和磁碟空間；請使用您有權處理的音訊和歌詞。',
  'help.maker.keywords':
    '去人聲, 人聲, 消音, 伴奏, 清唱, 分軌, 人聲分離, 擷取人聲, 歌詞同步, 時間, 旋律, 音符, 音高, ultrastar, lrc, 製作卡拉 OK, 轉錄, 製作工具',
  'help.share.title': '在電腦之間共享音訊',
  'help.share.intro':
    '共用音訊將同一專用網路上的電腦連線到一組，每臺電腦都播放其他電腦的聲音：無論您坐在哪一臺，您都可以聽到其餘的聲音。每臺電腦都將自己的聲音直接傳送給其他電腦，不受影響，也不會發回收到的聲音，因此沒有迴聲；您收聽的電腦應用其自己的 EQ、曲線和 DSP。這與映象到一臺電腦上的第二個裝置是分開的。',
  'help.share.steps':
    '在一臺電腦上，開啟“共享音訊”，按“新增電腦”，然後按“複製程式碼”。從低音量開始。\n在另一臺電腦上，按新增電腦，將程式碼貼到另一臺電腦的程式碼下，然後按連結。兩臺電腦立即互相玩遊戲。以相同的方式連結更多電腦：每臺電腦都加入整個群組，透過另一臺電腦加入的電腦顯示為「接收」關閉，直到您將其開啟。\n整個組中，每臺電腦都有兩個開關，分別是Receive和Send；共享會關閉所有電腦的聲音。您的混音設定了這臺電腦的音量和每臺電腦的音量。\n暫停、恢復和取消連結位於每臺電腦的選單中。離開的電腦仍被列為“離線”，並且該群組在重新啟動、睡眠、網路中斷或引擎切換後會再次發現自己。\n連線容易卡頓時，開啟分享旁的 Fluid 來聽音樂。它增加少量播放緩衝；更重視低延遲時可關閉。\n已儲存的電腦仍離線時，在其 ••• 選單選擇重新連線。它會重試儲存的代碼而不忘記連結；位址改變時，貼上對方目前的代碼。',
  'help.share.tip':
    '保持連執行緒式碼的私密性：它授權連結。在 FluidEQ 引擎下，該電腦在共享時保持其 DSP 開啟，並且播放其聲音的電腦應用其自己的聲音。立即播放和傳送需要該電腦上的 Windows；在其他地方，連結以一種方式執行。',
  'help.share.keywords':
    '分享音訊, 音訊分享, 電腦之間, 其他電腦, 傳送, 接收, 網路, 連線, 喇叭, 延遲',
  'help.share.mix': '這臺電腦的音量，以及您聽到的每台電腦各自的電平。',
  'help.share.outputName': '輸出',
  'help.share.output': '這臺電腦播放整個群組聲音所用的輸出。',
  'help.share.add':
    '複製這臺電腦的代碼，或貼上另一台電腦的代碼並點選「連線」。',
  'help.share.shareSwitch':
    '「分享」把這臺電腦的聲音傳送給整個群組；旁邊的 Fluid 為容易卡頓的連線加一點緩衝。',
  'help.share.switchesName': '接收與傳送',
  'help.share.switches':
    '「接收」在這裡播放那台電腦的聲音；「傳送」在那裡播放這臺電腦的聲音。它的 ••• 選單可暫停、繼續、重新連線或解除連結。',
  'help.share.laneName': '正在播放的內容',
  'help.share.lane':
    '那台電腦正在播放的歌曲和到達時的聲音，以及兩個方向的延遲。',
  'help.trouble.title': '當某些事情聽起來不對時',
  'help.trouble.intro':
    '從來源和輸出開始，然後隔離各層。圖表、已儲存的預設或啟用的開關本身無法證明聲音到達了預期的裝置。 「幫助」選單還提供音訊故障排除、問題報告和論壇。',
  'help.trouble.steps':
    '沒有聲音：確認正在播放、選取了預期的輸出、音量已調高且裝置已連接。檢查「一次使用一個播放器」是否暫停了其他來源。\nEQ 沒有效果：確認左側欄頂端的電源鍵已開啟，且輸出沒有顯示「關閉」標記；如有，請按「啟用」。如果引擎通知說它沒有執行，請按「重新啟動 Windows 音訊」。\n一切看起來都對但 EQ 仍然無效：Windows 可能繞過引擎播放音樂。通知會說明這一點，並提供一鍵把引擎移到 Windows 會使用的位置；這需要一次權限確認和一秒鐘的靜音。\n失真或低音過多：保持「自動正規化」開啟，減少提升，並逐一旁路各層。如果仍然存在，請使用「報告問題」，並在送出前檢查報告。',
  'help.trouble.tip':
    'F1 開啟本指南。 Esc 關閉放大的捕獲，然後關閉指南。如果介面太大，Ctrl + 0 會重設縮放。操作選單中的程式顯示了 FluidEQ 的每個部分正在執行的操作。',
  'help.trouble.keywords':
    '沒有聲音, 沒聲音, 聽不到, 無聲, 音訊問題, 音效引擎, 靜音, 故障, 修復, 錯誤, 重新啟動',
  'help.trouble.noticeName': '引擎通知',
  'help.trouble.notice':
    '一旦某個輸出有聲音，視窗右下角就會說明引擎沒有作用到哪個輸出以及原因。',
  'help.trouble.useApo': '改為透過引擎對話框切換到 Equalizer APO。',
  'help.trouble.restart':
    '重新啟動 Windows 音訊，通常能讓引擎恢復。Windows 會要求權限。',
  'help.forum.title': '在論壇中提問',
  'help.forum.intro':
    '該論壇將 FluidEQ 的 GitHub 討論帶入應用程式中：人們引以為傲的公告、想法、問題和調整。任何人都可以閱讀；發文使用您的 GitHub 帳戶，而不是 FluidEQ 帳戶。',
  'help.forum.steps':
    '開啟“幫助”→“論壇”並選擇一個版塊：公告、常規、想法、投票、問答、展示和講述、技巧與竅門或支持 FluidEQ。 New for you 收集自您上次檢視以來出現的問題，Issues 列出了 GitHub 上報告的問題。\n搜尋論壇，或開啟主題以閱讀回覆。\n按“使用 GitHub 登入”，在瀏覽器中完成，然後釋出新主題或回覆。',
  'help.forum.tip':
    '釋出的所有內容均以您的 GitHub 名稱在 GitHub 上公開。在問答中，標記有效的答案，以便下一個人找到它。 各看板的黃色數字表示有您尚未看過的動態的主題數；「問題」計算仍未關閉的問題。離開後，未寫完的主題和回覆仍會保留。按一下貼文中的圖片，即可在 FluidEQ 內放大。',
  'help.forum.keywords':
    '社群、問題、支援、討論、github、回饋、功能請求、想法、建議、詢問、幫助、聯絡方式、公告',
  'help.forum.boardsName': '版塊',
  'help.forum.boards':
    '每個版塊及其數量。「為您帶來新體驗」彙整您上次查看後的新帖，Issues 列出在 GitHub 上回報的問題。',
  'help.forum.textSize': '放大或縮小論壇和本指南的文字。',
  'help.forum.meName': '您的 GitHub 帳號',
  'help.forum.me': '您發文使用的身分。登出後仍可閱讀論壇，但不能發文。',
  'help.forum.newTopic':
    '「新主題」發起討論；「全部標為已讀」清除計數，箭頭取得新內容。',
  'help.forum.search': '搜尋所有版塊的主題和回覆。',
  'help.forum.topicsName': '主題',
  'help.forum.topics':
    '最新動態在前，每個都顯示版塊、狀態、回覆和投票。打開即可閱讀和回覆。',
  'help.games.profiles':
    '開啟「遊戲設定檔」可依設定檔、遊戲、曲線或效果鏈搜尋。篩選器維持在同一行，每種遊戲都有自己的顏色。您儲存的設定檔也會顯示曲線、遊戲濾波器的電平和效果鏈。「用於遊戲」會建立新副本。',
  'help.mic.title': '您的麥克風聲音',
  'help.mic.intro':
    '「麥克風」分頁給每支麥克風一套自己的人聲處理架。FluidEQ Engine 直接在麥克風上執行它，因此 Discord、OBS、遊戲或通話聽到的都是您調好的聲音。需要 FluidEQ Engine。',
  'help.mic.steps':
    '在頁首打開「麥克風」，在頂端選擇您的麥克風。如果 FluidEQ 還沒在它上面，點選「在這支麥克風上設定」；Windows 會請求一次權限。\n依用途（直播、Podcast、遊戲語音、會議）、依麥克風、為唱歌或為人聲效果選擇一個麥克風設定檔。它會為人聲設定每一級；改動某一級會把設定檔標為「已調校」，「重設」可以恢復。\n點選側欄中的某一級即可打開它。每一級都有自己的開關、隨您的聲音跳動的電平表和它增加的延遲；關掉的級會從聲音中完全移除。\n說話時看圖：淡色是麥克風收到的聲音，亮色是別人聽到的聲音，露出的灰色是濾鏡去掉的部分。「收聽最終效果」會回放給您聽；請戴耳機，否則會嘯叫。\n「麥克風內建效果」顯示麥克風廠商在 FluidEQ 之前給您的聲音加了什麼。關掉它們可避免對聲音清理兩次；Windows 會請求權限，重新開啟後它們會原樣恢復。',
  'help.mic.tip':
    '關掉的級不會改動聲音，也不增加延遲；如果「延遲」讀數偏高，就關掉不需要的級。在 Equalizer APO 下，「麥克風」分頁沒有可執行的地方。',
  'help.mic.keywords':
    '麥克風, 人聲, 直播, obs, discord, podcast, 通話, 會議, 降噪, 雜訊抑制, 噪聲門, 門限, 去齒音, 壓縮器, 限制器, 殘響, 人聲效果, 唱歌, usb 麥克風, 耳機麥克風, 內建效果',
  'help.mic.own':
    '麥克風廠商在 FluidEQ 之前給您的聲音加的處理。它的開關每次切換都會請求 Windows 權限。',
  'help.mic.master': '開啟或關閉這支麥克風的整套人聲處理架。',
  'help.mic.stagesName': '各級',
  'help.mic.stages':
    '依聲音經過的順序排列，每一級都有開關、隨聲音跳動的電平表和它增加的延遲。點選即可打開。',
  'help.mic.pick':
    '您正在調整的麥克風；每支麥克風都保留自己的聲音。下方那一行說明引擎此刻是否正在它上面工作。',
  'help.mic.pictureName': '您的聲音',
  'help.mic.picture':
    '淡色是麥克風收到的聲音，亮色是別人聽到的聲音，露出的灰色是濾鏡去掉的部分。',
  'help.mic.profile':
    '依用途、依麥克風、為唱歌以及作為人聲效果準備好的人聲音色。改動會把設定檔標為「已調校」，「重設」可以恢復。',
  'help.mic.delay': '整套處理架讓您的聲音延遲多少，以引擎測得的為準。',
} satisfies Partial<Dictionary>;

export default help;
