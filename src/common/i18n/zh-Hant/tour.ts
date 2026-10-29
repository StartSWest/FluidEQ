/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const tour = {
  'tour.contribute': '請貢獻',
  'tour.eyebrow': '此版本的新功能',
  'tour.title': 'FluidEQ 的新增功能',
  'tour.close': '關閉',
  'tour.rail': '新功能',
  'tour.stepOf': '{current} 的 {total}',
  'tour.back': '返回',
  'tour.next': '下一個',
  'tour.done': '明白了',
  'tour.dontShowAgain': '此版本不再顯示此內容',
  'tour.releaseNotes': '完整發行說明',
  'tour.rail.newIn': '{version} 中的新功能',
  'tour.rail.always': '也在 FLUIDEQ 中',
  'tour.newBadge': '新',
  'tour.howTitle': '如何開始',
  'tour.beta': '貝塔',
  'tour.player.kicker': '緊湊型播放器',
  'tour.player.title': '整個應用程式集中在一列中',
  'tour.player.subtitle': '一名播放器，每個視窗顏色都相同',
  'tour.player.lead':
    '標題列中的一個開關將 FluidEQ 折疊成一欄：頂部的視覺化工具，上面有歌曲、控制、聲音以及接下來播放的內容。在 {backdrop} 上，每個視窗顏色都是相同的播放器，並且您選擇的場景在所有播放器後面播放。',
  'tour.player.point1':
    '{sound} 擁有低音、中音和高音旋鈕或 EQ 自己的頻段，旁邊還有預設、Smart EQ 和 EQ 模式。',
  'tour.player.point2':
    '{upNext} 和 {playlists} 就在腳下等候。將任一部分折疊起來以獲得更大的圖片，並將音樂放在播放器上的任何位置以將其新增到佇列中。',
  'tour.player.point3':
    '它保持一個寬度，其高度是從頂部或底部邊緣算起的高度。將其折疊成一行，將其保留在頂部，或雙擊圖片以填滿螢幕。',
  'tour.player.how':
    '按標題列中「幫助」旁的「緊湊型播放器」開關。在播放器上，相同的開關可以恢復完整的應用程式。',
  'tour.player.open': '嘗試緊湊型播放器',
  'tour.player.imageAlt':
    '標題欄的一角，{player} 開關響起，緊湊型播放器兩次：在 {backdrop} 上的場景上，其 EQ 頻段開啟，歌曲後面的標準視覺化器和音調旋鈕開啟。',
  'tour.player.scene': '有一個場景，在{backdrop}上',
  'tour.player.standard': '配備標準視覺化儀',
  'tour.look.kicker': '新面貌',
  'tour.look.title': '新視窗，新色',
  'tour.look.subtitle': '一個主題滑塊，以及背後的視覺化工具',
  'tour.look.lead':
    '這些窗格以新圖示的顏色矗立在一個開放的地板上，一個滑桿 {brightness} 將整個視窗從近乎黑色變為淺海藍色。透過圖表上的場景，視窗可以取得其顏色，或讓它在所有內容後面播放。',
  'tour.look.point1':
    '{brightness} 位於脈衝圖示後方的選單中，位於 {windowColours} 下的 {transparency} 旁。',
  'tour.look.point2':
    '{windowColours} 提供 {original}、{colours}、{ambient} 和 {backdrop}，每個都有一行說明其對視窗的作用。',
  'tour.look.point3':
    '對話方塊和選單共享一種材質，{rainbow} 貫穿圖示的顏色或視覺化工具自己的顏色。',
  'tour.look.how':
    '將選單中的 {brightness} 移至右上角脈衝圖示後面。對於圖形上的場景，從圖形欄中開啟 {windowColours} 並選擇 {backdrop}。',
  'tour.look.open': '開啟等化器',
  'tour.look.imageAlt':
    'FluidEQ 在 EQ 頁面上有自己的顏色，分析器在曲線下繪製一首歌曲，脈衝圖示後面的選單在其一角開啟，亮度為一半，彩色模式開啟。',
  'tour.gpu.kicker': '新的視覺化引擎',
  'tour.gpu.title': '顯示卡上的每個視覺化工具',
  'tour.gpu.subtitle': '四十看看你的螢幕本身的速度和 3D 世界',
  'tour.gpu.lead':
    '這張圖表的四十種外觀現在在場景執行的引擎上繪製：在圖形卡上，以螢幕自己的重新整理率，因此條形、粒子和峰值會在它們以前移動的地方滑動。現在場景可以是真正的 3D 世界。',
  'tour.gpu.point1':
    '{scenes} 下方有 18 種新外觀，其中包括 {synthwave}、{horizon}、{towers} 和 {ledwall}；沒有自己顏色的外觀會磨損視窗的顏色。',
  'tour.gpu.point2':
    '透過 {brightness}，3D 世界踩下底鼓，隨著軍鼓搖擺，跳躍，從夜晚轉向白天；拖動一個可以從另一側檢視它。',
  'tour.gpu.point3':
    '外觀的變化從一個到另一個逐漸消失，3D 世界在視窗被覆蓋時將其圖形記憶體交還回來。',
  'tour.gpu.how': '按一下圖表上的外觀名稱，然後在 {scenes} 下選擇外觀。',
  'tour.gpu.open': '開啟等化器',
  'tour.gpu.imageAlt':
    '夜晚的 3D 城市場景，以及圖表上拍攝的四個新外觀 - {synthwave}、{horizon}、{towers} 和 {ledwall} - 外觀選擇器在第一個上響起。',
  'tour.gpu.world': '3D世界',
  'tour.sparks.kicker': '指標火花',
  'tour.sparks.title': '響應滑鼠的視覺化工具',
  'tour.sparks.subtitle': '指標產生火花、花瓣或雪',
  'tour.sparks.lead':
    '將滑鼠移過場景，它會在指標後面的軌跡中丟擲它的組成部分（火花、花瓣、雪、餘燼），並在您單擊的任何地方爆發。在 {ambient} 和 {backdrop} 中，鳥兒、花瓣和燈光也在整個視窗上飄蕩。',
  'tour.sparks.point1':
    '每個視覺化者都會拋出自己的東西：冬天場景中的雪、篝火中的餘燼、花園中的花瓣。',
  'tour.sparks.point2':
    '工作室的舞臺總是展示它們，因此場景製作者可以塑造它所拋出的內容。',
  'tour.sparks.point3':
    '每個視覺化儀都有一個開關：{sparks}，位於 {windowColours} 下的 {rainbow} 中。',
  'tour.sparks.how':
    '對於圖表上的場景，將滑鼠移到其上並單擊。 {sparks} 位於 {windowColours} 中的 {rainbow} 下。',
  'tour.sparks.open': '開啟等化器',
  'tour.sparks.imageAlt':
    '極光視覺化儀的指標後面有一串發光的火花，點選時會發出一聲爆裂聲，{windowColours} 的 {sparks} 開關會響起。',
  'tour.sound.kicker': 'Fluideq 引擎',
  'tour.sound.title': '聽起來跟你畫的一模一樣',
  'tour.sound.subtitle': '高音如畫般，靜音開關，一步到位',
  'tour.sound.lead':
    '在 FluidEQ 引擎上，您的曲線現在完全按照繪製的方式一直播放到 20 kHz，每次更改都會交叉漸變而不是單擊，並且 {autoNormalize} 一步即可到達新曲線的級別。高音的建構方式由您選擇：{precise} 或 {classic}。',
  'tour.sound.point1':
    '{precise} 依照繪製來建構每個波段；在 48 kHz 輸出上，高音在 20 kHz 時會縮短 3.8 dB。 {classic} 以 Equalizer APO 的方式建構它們，以及 AutoEQ 調整校正的方式。',
  'tour.sound.point2':
    '預設在切換時會交叉：636 個開關中有 534 個曾經發出劈啪聲，現在沒有一個超過 -80 dBFS。',
  'tour.sound.point3':
    '每一次編輯都會在您進行編輯的那一刻被聽到，然後 {autoNormalize} 一步到位，根據音樂的最後十秒鐘計算出其等級。',
  'tour.sound.how':
    '開啟 EQ 並按 {eqMode}。在 {treble} 下，為您的 EQ 和校正分別選擇 {precise} 或 {classic}。',
  'tour.sound.open': '開啟等化器',
  'tour.sound.imageAlt':
    '{eqMode} 選單在按鈕下方開啟，{treble} 設為 {precise}。高頻曲線在 {precise} 下會依照圖形播放；{classic} 在 48 kHz 輸出、20 kHz 頻率處則少了 3.8 dB。旁邊顯示切換預設組時 5 kHz 以上的聲音：2.0 之前有 −26 dBFS 的爆音，目前則沒有高於 −80 dBFS 的訊號。',
  'tour.sound.trebleChart': '高音，1 至 20 kHz',
  'tour.sound.switchChart': '5 kHz 以上，作為預設開關',
  'tour.sound.before': '2.0之前',
  'tour.sound.now': '2.0',
  'tour.graph.kicker': '工作室景觀',
  'tour.graph.title': '一張聽起來像工作室的圖表',
  'tour.graph.subtitle': '十二個檢視，80 dB 分析儀',
  'tour.graph.lead':
    '這張圖表以錄音室分析儀的方式測量正在播放的內容：十二個檢視，從頻譜圖和瀑佈到立體聲、響度和相位，在音樂移動時保持靜止的音階。',
  'tour.graph.point1':
    '{analyzer}、{spectrogram}、{rta}、{waterfall}、{scope} 等七個位於外觀選擇器中的 {analysis} 下。',
  'tour.graph.point2':
    '現場聲音被繪製為 80 dB 深，低至 10 Hz，每個點十二個八度，因此音調讀取其真實水平。',
  'tour.graph.point3':
    '您的 EQ 保持 ±20 dB，在邊緣留出空間以容納進一步的曲線，並且在分析儀列印頻率時標記為 10、20、50、100。',
  'tour.graph.how':
    '按一下圖表上的外觀名稱，然後在 {analysis} 下選擇一個檢視。雙擊圖形填滿螢幕； Ctrl+G 顯示或隱藏網格。',
  'tour.graph.open': '開啟等化器',
  'tour.graph.imageAlt':
    '此圖的分析器顯示正在播放的歌曲：即時頻譜深度為 80 dB，峰值位於其上方，EQ 曲線位於頂部，角落中是「分析」下的檢視清單。',
  'tour.games.kicker': '遊戲預設',
  'tour.games.title': '每個遊戲都有自己的聲音',
  'tour.games.subtitle': '當遊戲進行到前面時切換',
  'tour.games.lead':
    '為每個遊戲選擇一次聲音。當遊戲來到前面時，FluidEQ 會切換到它並保留它，直到您關閉遊戲，無論您經常使用 alt-tab，然後放回您所擁有的內容。',
  'tour.games.point1':
    'Steam、Epic Games、EA、GOG、Ubisoft、Battle.net 和 Xbox 遊戲，或任何開放的程式。',
  'tour.games.point2':
    '遊戲預設會開啟遊戲模式，這會減少 FluidEQ 新增的延遲，並且頁面會顯示測量到的延遲。',
  'tour.games.point3':
    '桌面上的一張卡片顯示了已切換的內容，另一張卡片則顯示了遊戲關閉後返回的內容。',
  'tour.games.how':
    '開啟 EQ，選擇遊戲預設，然後按下新增遊戲。然後在其行的選擇器中選擇它的聲音。',
  'tour.games.open': '開啟遊戲預設',
  'tour.games.imageAlt':
    '桌面上的三個時刻：遊戲在前面，FluidEQ 的卡顯示聲音已載入，同一個遊戲最小化，聲音仍然存在，遊戲關閉，卡顯示之前的聲音又回來了。',
  'tour.games.stepFront': '前面：聲音負載',
  'tour.games.stepAway': '最小化或 alt-tabbed：聲音保持開啟',
  'tour.games.stepClosed': '關閉：你自己的聲音回來了',
  'tour.presets.kicker': '新預設',
  'tour.presets.title': '聽起來像是音樂的預設',
  'tour.presets.subtitle': '整條鏈條，齊聲響亮',
  'tour.presets.lead':
    '每個預設都經過再次測量和調平，因此切換會改變特性，而不是音量，現在每個預設在 FluidEQ 引擎上聽起來都像在 Equalizer APO 上一樣清晰。',
  'tour.presets.point1':
    '{chains} 鏈、{styles} 音樂風格，以及音樂、電影和遊戲的 Room 副本。',
  'tour.presets.point2':
    '預設的曲線在圖表上顯示為自己的一層，您可以調低其強度。',
  'tour.presets.point3':
    '每種風格都有其自身的解釋：指向一種風格，它的註釋就會在清單旁邊開啟。',
  'tour.presets.how': '開啟 EQ 並按 Presets，或選取 DSP 頂部的一個鏈。',
  'tour.presets.open': '開啟等化器',
  'tour.presets.imageAlt':
    '選擇 Rock 的預設選擇器及其清單旁邊的音符：帶有編號點的曲線、每個點的用途以及播放的音量。',
  'tour.tone.kicker': '音調控制',
  'tour.tone.title': '低音、中音和高音，就像擴大器',
  'tour.tone.subtitle': '三個旋鈕，一條自己的曲線',
  'tour.tone.lead':
    '在沒有選擇頻段的情況下，低音、中音和高音將聲音塑造成自己的曲線，兩側都有低音和高音剪下：這是溫暖歌曲或照亮歌曲的最快方式，並且每個頻段都完全按照您的設定進行設定。',
  'tour.tone.point1': '等化器在整個機架上開啟，沒有選擇任何內容。',
  'tour.tone.point2': '新的二十頻段佈局，以及標準頻率上的每個佈局。',
  'tour.tone.point3':
    '頻段的張開程度與他們的間距一樣寬：頻段之間沒有洞，也沒有兩個演奏相同的音符。',
  'tour.tone.how':
    '在未選擇頻段的情況下開啟 EQ，然後轉動低音、中音或高音。按住 Ctrl 鍵並按一下旋鈕可將其第三個旋鈕恢復為平直。',
  'tour.tone.open': '開啟等化器',
  'tour.tone.imageAlt':
    '等化器的低音、中音和高音三度曲線、移動它們的三個旋鈕以及從六到三十一個頻段的快速佈局。',
  'tour.studio.kicker': 'FLUIDEQ PLUS',
  'tour.studio.title': '製作自己的視覺化工具',
  'tour.studio.subtitle': '每個帳戶免費',
  'tour.studio.lead':
    '工作室將想法轉化為隨音樂而動的場景。每個帳戶都是免費的：製作、匯出和發布任意數量的場景。',
  'tour.studio.point1':
    '每個場景在到達畫廊之前都會經過審核，一旦獲得批准，它就會免費為您播放。',
  'tour.studio.point2':
    '場景可以是真實的 3D 世界，可以踩著踢腿並在下降時跳躍。',
  'tour.studio.point3':
    '複製 AI 提示，您的 AI 助理可以看到您的場景並聽到歌曲的動態。',
  'tour.studio.how': '開啟 Visualizers 並在其軌道中選擇 Studio。',
  'tour.studio.open': '開啟展示臺',
  'tour.studio.imageAlt':
    '工作室在舞臺上扮演阿爾卑斯山、雪峰下的湖泊和極光，用三個步驟製作一個帶有人工智慧的場景，還有兩個注意事項：每個帳戶免費，發布的場景對其製作者免費播放。',
  'tour.studio.earned': '已發布：免費為您播放',
  'tour.help.kicker': '幫助',
  'tour.help.title': '用自己的話詢問導遊',
  'tour.help.subtitle': '容許錯字與詞形變化，用您熟悉的語言搜尋',
  'tour.help.lead':
    '像問朋友一樣，用您熟悉的語言搜尋指南，例如「沒有聲音」、「限制器」或「桌布」。最相關的章節會排在最前面，指南也會帶您找到圖中圈選的控制項。',
  'tour.help.point1':
    '它可以原諒拼字錯誤和複數形式，並且知道人們用來形容事物的字詞。',
  'tour.help.point2': '圖片上的每個控制項都有編號，就像印刷手冊一樣。',
  'tour.help.point3': 'F1 從任何地方開啟它，然後 Enter 走到下一場比賽。',
  'tour.help.how':
    '按 F1，或在標題列中開啟書籍並選擇使用者指南，然後鍵入您要尋找的內容。',
  'tour.help.open': '開啟幫助',
  'tour.help.imageAlt':
    '使用者指南搜尋「沒有聲音」：其章節依標記的文字排列，圖片上的控制項編號。',
  'tour.help.query': '沒有聲音',
  'tour.engine.kicker': '我們自己的音訊引擎',
  'tour.engine.title': '瞭解 FluidEQ 引擎',
  'tour.engine.subtitle': 'EQ 和 DSP 滿足您所聽到的一切',
  'tour.engine.lead':
    'FluidEQ 現在擁有自己的音訊引擎。它在 Windows 音訊服務內部執行，在您的音效卡效果之後，並將您的 EQ 和整個 DSP 效果器機架 帶到電腦播放的所有內容：遊戲、瀏覽器、串流應用程式 - 不僅僅是庫。',
  'tour.engine.point1':
    '所有系統音訊上的 DSP 效果器機架，FluidEQ 中沒有播放任何內容。',
  'tour.engine.point2': '即時調平可辨識歌曲，降噪可在播放時進行清理。',
  'tour.engine.point3':
    '退出 FluidEQ，即使在崩潰後，您的聲音也會立即恢復正常。',
  'tour.engine.how':
    '安裝時選擇 FluidEQ 引擎，或開啟右上角脈衝圖示後面的操作選單，按其頂部的引擎卡，選擇 FluidEQ 引擎並按應用。然後開啟 DSP 並在任何應用程式播放時開啟舞臺。',
  'tour.engine.open': '開放式DSP',
  'tour.engine.flow.label':
    '電腦播放的所有內容都會經過 FluidEQ 引擎（您的 EQ），然後是 DSP 效果器機架 - 到達您的耳機和喇叭。',
  'tour.engine.flow.games': '遊戲',
  'tour.engine.flow.browser': '瀏覽器',
  'tour.engine.flow.music': '音樂應用程式',
  'tour.engine.flow.video': '影片',
  'tour.engine.flow.inside': 'Windows 內部音訊',
  'tour.engine.flow.eq': '您的 EQ',
  'tour.engine.flow.rack': 'DSP 效果器機架',
  'tour.engine.flow.headphones': '耳機',
  'tour.engine.flow.speakers': '喇叭',
  'tour.room.kicker': '耳機環繞聲',
  'tour.room.title': '坐在房間裡',
  'tour.room.subtitle': '二十四個房間，全部免費',
  'tour.room.lead':
    'The Room 將您的耳機變成一個聆聽室，每個通道都有一個喇叭站在您周圍。十三個新房間加入了十一個經典房間，每個房間都透過測量來區分，而且全部都是免費的。',
  'tour.room.point1':
    '立體聲變成您面前的兩個喇叭，或者如果您要求的話，可以充滿整個房間； 5.1 電影五及分；一場7.1遊戲全環。',
  'tour.room.point2':
    '在特色客房、經典客房或您的客房下選擇一個房間；房間的所有組成部分都在其頁面上。',
  'tour.room.point3': '聽力測試會挑選五對透過耳朵將聲音放在您面前的頭部。',
  'tour.room.how':
    '開啟 DSP，選擇軌道中的 Room 並將其開啟。選擇一個房間，然後拖曳喇叭或轉動旋鈕；在您的頭下，按開始聽力測試。',
  'tour.room.open': '開啟房間',
  'tour.room.imageAlt':
    '從上方看到的房間：七個喇叭和一個重低音喇叭站在中間的一個頭部周圍，每個喇叭都有通往耳朵的路徑。',
  'tour.plus.kicker': '視覺化工具',
  'tour.plus.title': '永遠屬於你的場景',
  'tour.plus.subtitle': '展示臺、工作室、燈光等',
  'tour.plus.lead':
    '讓 FluidEQ 不斷發展的一整套附加功能：在顯示卡上繪製的場景、自己製作的工作室、桌面背景和動態照明。一個場景需要花費一個點數，並且仍然屬於您，並且等化器、架子和球員保持免費，一如既往。',
  'tour.plus.point1': '從操作選單中的帳戶登入：確認的帳戶將獲得免費啟動點數。',
  'tour.plus.point2':
    '點數包只需支付一次，付款前會以簡單明瞭的方式提供條款。沒有任何更新，應用程式永遠不會看到您的卡。',
  'tour.plus.point3':
    '每個場景都可以首先觀看，並且您登入的每臺電腦上都可以播放這些場景。',
  'tour.plus.how': '開啟「視覺化工具」標籤：畫廊、工作室和動態照明位於其左側。',
  'tour.plus.open': '開啟展示臺',
  'tour.plus.imageAlt':
    '「視覺化工具」標籤：側面的相簿、工作室和動態照明，以及帶有 Chrome、Bloom、Aurora、Alpine 和 Neon City 的相簿。',
  'tour.scene.alpine': '阿爾卑斯山',
  'tour.scene.aurora': '極光',
  'tour.scene.bloom': '布魯姆',
  'tour.scene.chrome': '鍍鉻',
  'tour.scene.neonCity': '霓虹城',
  'tour.visualizers.kicker': '視覺化工具',
  'tour.visualizers.title': '隨音樂移動的場景',
  'tour.visualizers.subtitle': '畫在你的顯示卡上',
  'tour.visualizers.lead':
    '場景是活生生的圖片——星空下的山脈、極光的帷幕、霓虹燈的城市——繪製在顯示卡的 EQ 曲線下。低音、節拍和高音各自移動不同的東西，它們周圍的視窗可以呈現出它們的顏色。',
  'tour.visualizers.point1':
    '萬能選擇器：{styles} 自由設計形狀和顏色，以及按類別劃分的場景。',
  'tour.visualizers.point2':
    '瀏覽相簿，嘗試 FluidEQ 的範例十秒鐘，然後新增您喜歡的場景。',
  'tour.visualizers.point3':
    '自動切換外觀、全螢幕顯示並在檢視中設定場景的啟動和釋放。',
  'tour.visualizers.how':
    '按一下圖表上的外觀名稱，然後在「展示臺」下方選擇外觀，或在「展示臺」→「相簿」中瀏覽所有外觀。',
  'tour.visualizers.open': '開啟等化器',
  'tour.visualizers.imageAlt':
    'Alpine，夜間湖邊山脈的場景，在 EQ 曲線下的圖表上播放，下面還有四個場景。',
  'tour.desktop.kicker': '桌面視覺化工具',
  'tour.desktop.title': '桌面背後的音樂',
  'tour.desktop.subtitle': '每個監視器上都有一個場景',
  'tour.desktop.lead':
    '將場景放在桌面圖示後面。它會隨著您正在聆聽的內容而移動，或安靜地自行移動，並且每個監視器都可以顯示自己的場景。',
  'tour.desktop.point1':
    '在辦公桌地圖上選擇顯示器，每個顯示器都有自己的視覺化工具。',
  'tour.desktop.point2': '當視窗覆蓋顯示器、電腦鎖定且使用電池時，它會暫停。',
  'tour.desktop.point3': '下次 FluidEQ 啟動時它會自行回傳。',
  'tour.desktop.how':
    '對於圖表上的場景，按下其名稱旁的監視器按鈕，或選擇「檢視」→「設定為桌面背景」。',
  'tour.desktop.open': '開啟等化器',
  'tour.desktop.imageAlt':
    '三臺顯示器，每臺顯示器的桌面圖示和工作列後面都顯示一個場景－極光、高山和霓虹城。',
  'tour.lighting.kicker': '動態燈光',
  'tour.lighting.title': '你的辦公桌隨著場景亮起',
  'tour.lighting.subtitle': 'Beta · 您的 RGB 裝置跟隨視覺化工具',
  'tour.lighting.lead':
    '您的鍵盤、滑鼠、滑鼠墊、耳機和支架透過 Windows 動態照明和 Razer Chroma 呈現圖表上場景的色彩和節奏。',
  'tour.lighting.point1':
    '每個視覺化工具有四種樣式：場景、彩色波浪、頻譜和節拍波紋。',
  'tour.lighting.point2': '單獨調整每個裝置，並選擇音樂停止時發生的情況。',
  'tour.lighting.point3':
    '即時預覽會在燈光亮起時繪製您自己的辦公桌。它處於測試階段：請告訴我們您的裝置的行為。',
  'tour.lighting.how':
    '開啟 Visualizers → 動態照明並將其開啟，然後將場景放在圖表上。',
  'tour.lighting.open': '開啟展示臺',
  'tour.lighting.imageAlt':
    '鍵盤、滑鼠和滑鼠墊被霓虹城的粉紅色、紫色和青色點亮。',
  'tour.share.kicker': '每臺電腦，雙向',
  'tour.share.title': '在電腦之間共享音訊',
  'tour.share.subtitle': '聽到群組中每臺電腦的聲音，無論您坐在哪一臺電腦上',
  'tour.share.lead':
    '您的遊戲電腦、筆記型電腦和網路上的任何其他電腦都在一組中運作：無論您坐在哪一臺上，您都可以透過該電腦自己的等化器無損、加密地聽到其他電腦的聲音。',
  'tour.share.pairLabel': '雙向',
  'tour.share.pairName': '每臺電腦都播放其他電腦的聲音',
  'tour.share.wireLabel': '無損·加密·專用區域網',
  'tour.share.stepsTitle': '只需三步驟即可完成設定',
  'tour.share.step1Title': '在一臺電腦上，複製其程式碼',
  'tour.share.step1':
    '開啟“共享音訊”分頁，按“新增電腦”，然後按“複製程式碼”。程式碼每次都保持相同。',
  'tour.share.step2Title': '另一方面，貼上並連結',
  'tour.share.step2':
    '在那裡，按“新增電腦”，將程式碼貼到“另一臺電腦的程式碼”下，然後按“連結”。您稍後連結的電腦會加入整個群組。',
  'tour.share.step3Title': '選擇什麼去哪裡',
  'tour.share.step3':
    '每臺電腦都有「接收」和「傳送」功能，「共享」會關閉所有電腦的聲音。 「你的組合」設定了每個等級。暫停和取消連結位於每臺電腦的選單中，並且欄的按鈕可以透過電線工作。',
  'tour.share.fact1Title': '無損',
  'tour.share.fact1': 'Float32 PCM 端對端。無媒體編解碼器，無生成損失。',
  'tour.share.fact2Title': '加密的',
  'tour.share.fact2':
    '每個資料包均採用 AES-256-GCM。程式碼是關鍵；沒有它任何人都無法收聽。',
  'tour.share.fact3Title': '保持聯絡',
  'tour.share.fact3':
    '在重新啟動、睡眠、網路中斷或引擎切換後，該組會再次發現自己。不在的電腦仍保持列出狀態。',
  'tour.share.tip':
    '安靜地開始：同時玩的電腦數量會增加。在第一個連結之前降低音量。',
  'tour.share.open': '開啟共享音訊',
  'tour.library.kicker': '您的音樂，您的播放器',
  'tour.library.title': '您擁有的音樂庫',
  'tour.library.subtitle': '資料夾輸入，相簿輸出',
  'tour.library.lead':
    '將 FluidEQ 指向一個資料夾，它會讀取其中的每首歌曲和影片、標籤和封面藝術，並將它們變成您按專輯、藝術家、流派、歌曲或資料夾瀏覽的集合。播放透過 FluidEQ 自己的播放器執行，因此 EQ 和 DSP 效果器機架 始終在路徑中。',
  'tour.library.point1':
    '檢視同一個書架的三種方式：清單、網格和封面流，以及針對大型收藏的跳到字母。',
  'tour.library.point2':
    '帶有“繼續播放”的“下一個”佇列，當清單用完時，它會繼續播放更多相同型別的內容。',
  'tour.library.point3':
    '播放清單和永久收藏清單。右鍵單擊任何歌曲將其新增到任何歌曲或佇列中。',
  'tour.library.point4':
    'Smart EQ 歌曲記憶：當 Smart EQ 持續測量時，翻轉“儲存這首歌曲”，兩分鐘後，該曲目的校正將保留，並在再次播放時返回。',
  'tour.library.how':
    '開啟「庫」分頁，按「新增資料夾」或將資料夾拖曳到頁面上，然後完成掃描。選擇專輯、藝人、流派、歌曲、資料夾或樹，然後按「播放」。',
  'tour.library.open': '開放媒體庫',
  'tour.dsp.kicker': '母帶機架',
  'tour.dsp.title': 'DSP 效果器機架',
  'tour.dsp.subtitle': '十個階段，每個階段都有自己的一頁',
  'tour.dsp.lead':
    '一系列工作室舞臺：Normalizer、Denoise、Exciter、Bass Forge、等化器、Bass Punch、Dimension、Room、響度最大化器 和 Master，以及庫軌道之間的交叉淡入淡出。在 FluidEQ 引擎下，它可以播放電腦播放的所有內容；在庫中的 Equalizer APO 下。每個階段都有自己的帶有即時檢視的頁面，大多數都有預設，其中五個有一個隔離開關，可以只聽到他們正在做什麼。',
  'tour.dsp.point1':
    '降噪可以修復播放時的嘶嘶聲、嗡嗡聲和咔噠聲，神經語音清理器可以處理庫曲目。',
  'tour.dsp.point2':
    'Bass Forge 在低音下方添加了一個真正的八度音階； Bass Punch 塑造其起音、延音和綻放，混音高達 200%。',
  'tour.dsp.point3':
    '引數等化器有 6 到 31 個頻段，從 15 個頻段開始，具有最小或線性相位、中/側、過取樣和一百多個命名預設。',
  'tour.dsp.point4':
    '具有 LUFS 響度目標和真正峰值安全性的母帶，從串流媒體到 Vinyl 的交付預設，以及用於比較聲音而不是音量的增益匹配。',
  'tour.dsp.how':
    '開啟 DSP 分頁，在預設下選擇一個鏈，然後按一下側邊標籤中的一個階段並將其開啟。在 Equalizer APO 下，首先播放庫中的曲目。',
  'tour.dsp.open': '開放式DSP',
  'tour.output.kicker': '在兩個地方發揮作用',
  'tour.output.title': '第二輸出設定檔',
  'tour.output.subtitle': '耳機和喇叭同時使用，每個都有自己的設定檔',
  'tour.output.lead':
    '使用單獨的等化器一起播放耳機和喇叭。第二個輸出在主輸出的等化器之前接收聲音，然後套用自己儲存的設定檔。不需要路由驅動程式。',
  'tour.output.point1': '開啟第二個輸出中的另一個裝置並設定自己的音量。',
  'tour.output.point2':
    '選擇裝置下已儲存的設定檔之一，或按其旁邊的 {editSound} 以變更其聲音，而無需切換主輸出。主輸出保持其調諧。',
  'tour.output.point3':
    '一次一個播放器：在 FluidEQ 中啟動某些內容會暫停機器的其餘部分，反之亦然。',
  'tour.output.point4':
    '每個輸出都會維持自己的播放時序：起初約延遲 30 ms，只有發生斷音後才會略為增加，並以毫秒顯示延遲。透過音訊分享在此播放另一部電腦的聲音時，也會一併計入。',
  'tour.output.how':
    '開啟 EQ 標籤並展開右側的第二個輸出。開啟裝置，選擇其名稱下方的 EQ 設定檔案，然後設定音量；其延遲如下所示。',
  'tour.output.open': '開啟等化器',
  'tour.output.imageAlt':
    '第二個輸出面板啟用了 BlackShark V2 Pro 耳機，其 EQ 設定檔選擇器、音量滑桿和延遲。',
  'tour.outputs.kicker': '每個輸出都會記住',
  'tour.outputs.title': '每個輸出都保留自己的聲音',
  'tour.outputs.subtitle': '耳機和喇叭，各自以自己的方式進行調音',
  'tour.outputs.lead':
    '從耳機切換到喇叭，每個輸出都會帶回其聲音：等化器、預設、音調、剪下、DSP 效果器機架、房間和電平都保留在每個輸出中。',
  'tour.outputs.point1':
    '選擇一個輸出，您為其設定的所有內容都會立即返回。耳機和喇叭不再共用一個預設或一條曲線。',
  'tour.outputs.point2':
    '第二個輸出直接從 FluidEQ 引擎播放，具有自己的聲音，並且主輸出從不等待。 {editSound} 旁邊的聲音可以在不切換主輸出的情況下改變。',
  'tour.outputs.point3':
    '藍牙耳機在輸出旁顯示電池，第二個輸出顯示播放落後的距離（以毫秒為單位）。',
  'tour.outputs.how':
    '開啟 EQ 並在右側的 {output} 下選擇一個輸出：從那時起您設定的任何內容都會保留。對於第二個，請在 {secondOutput} 下將其開啟，然後按 {editSound}。',
  'tour.outputs.open': '開啟等化器',
  'tour.outputs.imageAlt':
    '帶有耳機和喇叭的輸出卡，每個都有自己的預設、曲線和 DSP 階段，輪流播放，第二個輸出卡在它們旁邊播放，有自己的聲音、電池和編輯聲音。',
  'tour.bands.kicker': 'EQ的數字',
  'tour.bands.title': '每個頻段的數字都在圖表上',
  'tour.bands.subtitle': '曲線上有標籤，旁邊有EQ模式',
  'tour.bands.lead':
    '每個頻段都可以在自己的點上顯示其頻率、Q 和增益，並且標籤不會相互幹擾。 EQ 模式現在位於圖表旁邊而不是上方，因此當您變更曲線的播放方式時，曲線仍處於可見狀態。',
  'tour.bands.point1':
    '標籤位於其點的正上方或正下方，永遠不會在另一個上方，當您拖曳其帶時，標籤會保持原狀，一旦有空間，就會返回其位置。',
  'tour.bands.point2':
    '{eqMode} 是側面板的第一張卡，{yourEq} 和 {corrections} 各有一個分頁。圖表上方的按鈕可將卡片帶入檢視。',
  'tour.bands.point3':
    '每個手柄、滑塊和旋鈕都可以透過鍵盤進行操作，移動滑桿可以在同一幀中重新繪製曲線。',
  'tour.bands.how':
    '開啟 EQ，選擇圖形上方的 {view} → {everything}（或按 {shortcut}）並移動一個頻段：其數字跟隨它。 {eqMode} 在右側面板頂部等待。',
  'tour.bands.open': '開啟等化器',
  'tour.bands.imageAlt':
    '每個頻段的頻率、Q 和增益堆疊在其點上的 EQ 圖表，一個頻段在箭頭鍵下移動，曲線下的 EQ 模式卡包含您的 EQ 和校正。',
  'tour.bands.shortcut': 'Ctrl+W',
  'tour.ears.kicker': '一條帶子，兩隻耳朵',
  'tour.ears.title': '單獨調整每隻耳朵',
  'tour.ears.subtitle': '頻段自己的選單中的左+右',
  'tour.ears.lead':
    '右鍵單擊某個頻段並選擇 {split}：它會成為每隻耳朵的一個頻段，頻率相同，並且您可以單獨移動每個頻段。左耳的曲線用實線繪製，右耳的曲線用虛線繪製。',
  'tour.ears.point1':
    '{both} 再次將兩者連線到中間，頻率和增益則處於中間位置。 {reset} 和 {clear} 也加入其中。',
  'tour.ears.point2':
    '{delete} 位於主等化器和 DSP 效果器機架 的相同選單中，並要求在刪除之前再按一次。',
  'tour.ears.point3':
    'Squiglink 曲線可匯入一隻耳朵：{importInto} 僅填充左耳或右耳，另一隻耳朵保持原樣。',
  'tour.ears.how':
    '開啟 EQ，以滑鼠右鍵按一下圖表上的頻段並選擇 {split}。 DSP 效果器機架 的 EQ 具有相同的選單，同時適用於立體聲。',
  'tour.ears.open': '開啟等化器',
  'tour.ears.imageAlt':
    '一個頻段的 EQ 圖表分為左耳頻段和右耳頻段，它們分開並在中間再次連線，左耳的曲線為實線，右耳的曲線為虛線，頻段選單旁邊有“雙耳”和“左 + 右”。',
  'tour.film.eachEar.intro': 'FluidEQ 的每個頻段，現在都能為左右耳分別調整。',
  'tour.film.eachEar.menu': '在頻段上按滑鼠右鍵，即可開啟選單。',
  'tour.film.eachEar.split':
    '選擇「左 + 右」。頻段會一分為二，分別處理左右耳。',
  'tour.film.eachEar.lines': '兩邊可以各自拖曳。實線代表左耳，虛線代表右耳。',
  'tour.film.eachEar.sliders': '每隻耳朵也都有專用滑桿，以 L 或 R 標示。',
  'tour.film.eachEar.join':
    '如要重新合併，請選擇「雙耳」。兩邊會在中間位置合而為一。',
  'tour.film.sound.intro': '在 FluidEQ 中變更設定，都能立即聽到平順的變化。',
  'tour.film.sound.glide':
    '在音樂播放時移動頻段。每次變化都會平順銜接，不會產生喀聲。',
  'tour.film.sound.precise':
    'EQ 模式選單中的高音設定為「精確」。每個頻段都會依照圖形處理，一直到二十千赫茲。',
  'tour.film.sound.classic':
    '選擇「經典」，即可使用 Equalizer APO 的方式建立頻段。',
  'tour.film.games.intro': 'FluidEQ 可以為每款遊戲設定專屬音效。',
  'tour.film.games.add': '按下「新增遊戲」，從啟動器已安裝的遊戲中選擇。',
  'tour.film.games.sound': '接著選擇該遊戲要使用的音效。',
  'tour.film.games.front': '遊戲切換至前景時，會自動載入它的音效設定。',
  'tour.film.games.closed': '關閉遊戲後，會還原原本的音效。',
  'tour.film.compact.intro':
    '只需要播放控制時，FluidEQ 可以收合為小巧的播放器。',
  'tour.film.compact.go': '按下頂端的播放器按鈕，視窗就會變成輕巧播放器。',
  'tour.film.compact.eq': 'EQ 也會一同保留。轉動旋鈕，就能立即聽到變化。',
  'tour.film.compact.back': '按一下即可返回完整視窗。',
  'tour.film.deleteImport.intro': '兩項小改進，讓您更安心地編輯 EQ。',
  'tour.film.deleteImport.asks':
    '刪除頻段現在會先確認。再按一次，才會真正刪除頻段。',
  'tour.film.deleteImport.oneEar':
    '匯入時也可以只取代單耳。選擇「匯入至」，再選「左耳」。',
  'tour.film.deleteImport.otherEar': '只會取代左耳，右耳完全維持原狀。',
  'tour.film.outputs.intro': '電腦上的每個輸出，都會保留自己的音效設定。',
  'tour.film.outputs.each': '從喇叭切換至耳機時，EQ 會改用耳機專屬的設定。',
  'tour.film.outputs.back': '切換回來後，喇叭會恢復您上次使用的音效。',
  'tour.film.outputs.second':
    '也可以同時透過第二個輸出播放，並使用它自己的音效設定。',
  'tour.film.outputs.edit':
    '按下「編輯音效」，即可在這裡調整，主輸出仍會繼續播放。',
  'tour.film.dsp.intro': 'DSP 效果器機架會在 EQ 之後，調整您聽到的所有聲音。',
  'tour.film.dsp.preset': '選擇一個預設，就能一次設定整個效果器機架。',
  'tour.film.dsp.stages': '每個處理階段都有專用頁面，所有控制項都清楚呈現。',
  'tour.film.dsp.meters': '儀表會隨音樂變化，讓您看見它正在做什麼。',
  'tour.film.deesser.intro':
    'DSP 效果器機架現在提供齒音消除器，用來柔化人聲中刺耳的 S 音。',
  'tour.film.deesser.cuts':
    '選擇「播客與語音」等預設。每個刺耳的 S 音都會降低，並以琥珀色顯示；鈸聲則保持原樣。',
  'tour.film.deesser.isolate': '按下「隔離」，即可只聽它移除的聲音。',
  'tour.film.headphones.intro':
    'FluidEQ 可以使用其他人提供的測量資料，校正您的耳機。',
  'tour.film.headphones.search': '開啟 EQ 預設，在 OPRA 媒體庫中搜尋您的耳機。',
  'tour.film.headphones.measure': '選擇一份測量資料，每份都會標明作者。',
  'tour.film.headphones.applied':
    '按下「套用耳機 EQ」。校正會套用至獨立圖層，您原本的頻段維持不變。',
  'tour.film.headphones.paste': '您也可以貼上 Squiglink 的匯出內容。',
  'tour.film.headphones.ears': '將它套用為 EQ，可用於雙耳或單耳。',
  'tour.film.headphones.curve': '也可以將它套用為獨立曲線。',
  'tour.film.karaoke.intro': '卡拉 OK 讓 FluidEQ 成為您演唱自己歌曲的舞臺。',
  'tour.film.karaoke.open': '按下「開啟歌曲」，一同選擇歌曲與歌詞檔案。',
  'tour.film.karaoke.words': '按下播放，歌詞中的每個字詞都會隨演唱亮起。',
  'tour.film.karaoke.pitch':
    '下方的音高導引會顯示要唱的每個音符。開啟麥克風，就能在上面看見自己的音高。',
  'tour.film.maker.intro': '卡拉 OK 製作工具可以將歌曲轉換為卡拉 OK 檔案。',
  'tour.film.maker.timeline':
    '載入歌曲並按下「製作」。歌曲的每個字詞與音符都會出現在時間軸上。',
  'tour.film.maker.play':
    '播放時，播放頭會依序經過每個字詞與音符。拖曳其中任一項，即可修正時間或音高。',
  'tour.film.maker.use':
    '製作工具也能根據歌手的人聲，自動準備歌曲。確認效果後，按下「在播放器中使用」。',
  'tour.film.looks.intro': 'EQ 下方的頻譜，可以依您的喜好繪製。',
  'tour.film.looks.open': '在圖形工具列中按下「新增樣式」。',
  'tour.film.looks.forms':
    '使用箭頭瀏覽 LED 條、霓虹條、天際線、玻璃高塔等造型。',
  'tour.film.looks.shape':
    '接著調整造型。「區塊數」決定長條數量，顏色、間距與動態也都由您決定。',
  'tour.film.looks.save':
    '按下儲存，即可保留為自己的樣式，也可以透過檔案分享。',
  'tour.film.engine.intro':
    'FluidEQ 擁有自己的音訊引擎，讓電腦播放的所有聲音都能使用 EQ 與 DSP 效果器機架。',
  'tour.film.engine.choose':
    '開啟右上角的操作選單，按下引擎卡片，選擇 FluidEQ Engine。',
  'tour.film.engine.rack':
    '接著開啟 DSP 並選擇預設。遊戲、瀏覽器與音樂應用程式的聲音，都會經過它處理。',
  'tour.film.library.intro': '媒體庫讓您透過 EQ，播放自己擁有的音樂。',
  'tour.film.library.albums': '專輯會以封面呈現，使用箭頭即可翻閱。',
  'tour.film.library.album': '點選專輯，即可開啟並查看其中所有歌曲。',
  'tour.film.library.play':
    '按下播放，便會經過與其他聲音相同的 EQ 和 DSP 效果器機架。',
  'tour.film.soundOn': '開啟聲音',
  'tour.film.soundOff': '關閉聲音',
  'tour.film.watch': '觀看影片',
  'tour.film.close': '關閉影片',
  'tour.deesser.kicker': '較軟的S',
  'tour.deesser.title': 'DSP 效果器機架 中的 齒音消除器',
  'tour.deesser.subtitle': '尖銳的 S 聲音下降，鈸獨自一人',
  'tour.deesser.lead':
    '{deEsser} 僅在聲音發聲時調低尖銳的 S、T 和 SH，並保留鈸、踩鈸和其餘高音。',
  'tour.deesser.point1':
    '它會根據歌曲本身的等級找到每個 S，因此安靜的曲目和響亮的曲目都會被同等對待，您會看到它捕獲的每一個以及它花費了多少時間。',
  'tour.deesser.point2':
    '它只調低 S 的組成頻率、上方的所有頻率或整個聲音，而 {isolate} 只播放它所去掉的部分。',
  'tour.deesser.point3':
    '{speech}、{podcast} 和 {audiobook} 將其開啟。機架上的每個過濾器現在都可以儲存您自己的設定檔。',
  'tour.deesser.how':
    '開啟DSP並在左側清單中選擇{deEsser}，或選擇{podcast}。從設定檔開始，然後提高 {sensitivity} 直到捕獲每個 S。',
  'tour.deesser.open': '開放式DSP',
  'tour.deesser.imageAlt':
    '齒音消除器 的條帶捲動經過：每個聲音的 S 都站在舞臺開始的線上，其切割懸掛在琥珀色的下方，而踩鑔則為灰色，單獨留下；上方是選擇 Spectral 的舞臺，下方是語音、播客和有聲讀物。',
  'tour.chat.kicker': '透過提問製造場面',
  'tour.chat.title': '提出修改要求，立即在舞台上查看',
  'tour.chat.subtitle': 'Studio 舞台旁的對話視窗',
  'tour.chat.lead':
    '{studio} 現在在其舞臺旁邊有一個聊天室。說出應該改變什麼——場景的外觀、它如何隨著音樂移動、顏色或燈光——然後您自己的人工智慧會編輯場景並在舞臺上播放每個版本。',
  'tour.chat.point1':
    '每次回覆都會保留當時產生的版本，{bringBack} 可以還原較早的版本。每個場景也會保留過去的聊天紀錄。',
  'tour.chat.point2':
    '{attach} 傳送帶有您的訊息的場景圖片，您可以在上面繪製以顯示您的意思。工作時傳送的訊息在佇列中等待並一起傳送。',
  'tour.chat.point3':
    '它按照您自己的計劃在安裝在這臺電腦上的 Claude Code 上執行，並顯示您還剩下多少限制。',
  'tour.chat.how':
    '開啟 {plus}，在其軌道中選擇 {studio}，選擇一個場景或啟動一個場景，然後在舞臺旁的方塊中鍵入。',
  'tour.chat.open': '開啟展示臺',
  'tour.chat.imageAlt':
    '工作室聊天旁邊的舞臺：請求讓舞檯燈光在軍鼓上閃爍，回覆的步驟滴答作響，版本 2 與「Bring back」保持一致，隨著版本 2 的播放，舞檯燈光開始閃爍。',
  'tour.chat.ask': '讓舞台燈光隨小鼓閃爍。',
  'tour.chat.reply': '完成：每個軍鼓上的兩個聚光燈都閃爍白色，然後褪回粉紅色。',
  'tour.myCurves.kicker': '您自己的曲線',
  'tour.myCurves.title': '除了 OPRA 的曲線之外，您自己的曲線清單',
  'tour.myCurves.subtitle': '保留、命名和重複使用您自己的曲線',
  'tour.myCurves.lead':
    '{eqPresets} 現在於 OPRA 媒體庫旁提供 {myCurves}：將想再次使用的曲線集中保存，為它們命名，並查看曲線圖形。您可以從 Squiglink 匯出內容、.txt 檔案、目前的 EQ 或 OPRA 項目新增曲線。',
  'tour.myCurves.point1':
    '{applyCurve}作為耳機校正播放曲線，自帶力度和開關； {applyEq} 將其頻段放入您的 EQ 中。',
  'tour.myCurves.point2':
    '{myCurves} 中的 {squiglink} 捷徑開啟匯入預覽； {save} 保留您的曲線以供日後使用。',
  'tour.myCurves.point3':
    '{exportList} 將整個清單寫入一個檔案，以進行備份或將其傳輸到另一臺電腦； {importList} 讀回它並說出它遺漏的內容。',
  'tour.myCurves.how': '開啟EQ下的{eqPresets}，選擇{myCurves}並按{add}。',
  'tour.myCurves.open': '開啟 EQ 預設',
  'tour.myCurves.imageAlt':
    'EQ 預設的「我的曲線」頁面：列出四條耳機曲線，每條皆有名稱、來源、新增日期與曲線圖形。剛從 Squiglink 儲存的曲線出現在最上方，並套用為耳機校正。',
  'tour.songs.kicker': '每首歌曲都有一個聲音',
  'tour.songs.title': '記住您的喜好的歌曲',
  'tour.songs.subtitle': '調一首歌，每次都這樣聽',
  'tour.songs.lead':
    '開啟 {songSound} 和預設，歌曲結束時的音調和 EQ 會在下次播放時返回您調好的輸出。',
  'tour.songs.point1':
    '在播放歌曲時更改預設、音調或頻段，這就是它所保留的。一首你從未接觸過的歌曲什麼也不會保留。',
  'tour.songs.point2':
    '它回來時會附上一條通知，其中列出了這首歌的名稱及其帶來的內容，其中包括 {undo} 和 {forget}。',
  'tour.songs.point3':
    '當歌曲結束時，您之前聽到的聲音會返回，並且每個輸出都會記住自己的聲音：一首歌曲可以在耳機上以一種方式播放，而在喇叭上可以以另一種方式播放。',
  'tour.songs.how':
    '開啟EQ並開啟右側{output}中的{songSound}。播放一首歌曲，選擇一個預設或轉動音調，然後讓它完成或跳過它。',
  'tour.songs.open': '開啟等化器',
  'tour.songs.imageAlt':
    '依序播放四首歌曲的佇列，其中三首帶有預設和曲線，每首都留下了一首從未調整過的歌曲，在其上方會彈出一首記住的歌曲的通知，並帶有“撤消”和“忘記這首歌曲”。',
  'tour.looks.kicker': '您自己的視覺化工具',
  'tour.looks.title': '自訂圖表外觀',
  'tour.looks.subtitle': '你的形式、你的顏色、你的動作',
  'tour.looks.lead':
    'EQ 下的頻譜可以按照您喜歡的任何方式繪製。選擇一種 {forms} 形式，從 LED 和霓虹燈條到露臺、天際線和玻璃塔，然後按照頻率、等級或熱量為其自己的自動著色著色，設定其攻擊速度和山峰懸掛的時間，並用火花、彗星或波紋標記山峰。將其儲存為您自己的外觀，並將其作為檔案共用。',
  'tour.looks.point1':
    '{forms} 表單，每個表單都有自己的控制項：區塊、間隙、填充、重量以及是否填充或描邊。',
  'tour.looks.point2':
    '使用您自己的顏色漸層或單一顏色，根據頻率、等級或熱量，以自己的自動著色方式為每個表格著色。',
  'tour.looks.point3':
    '攻擊和釋放設定動作；點亮的峰值、填充的峰值和十二個峰值標記決定了命中的外觀。',
  'tour.looks.point4':
    'Glow 適用於每種模式，看起來可以匯出到檔案並從檔案匯入。',
  'tour.looks.how':
    '在「EQ」標籤上，按圖表工具列中的「新外觀」。使用選擇器選擇一個表單或按空白鍵迴圈它們，在音樂播放時調整顏色和動作，然後儲存。',
  'tour.looks.open': '開啟等化器',
  'tour.karaoke.kicker': '在家的舞臺',
  'tour.karaoke.title': '帶音調指南的卡拉 OK',
  'tour.karaoke.subtitle': '你的歌曲，你的歌詞，你的麥克風',
  'tour.karaoke.lead':
    '放入有或沒有歌詞檔案的歌曲，FluidEQ 會將它們配對到播放清單中，在封面藝術或影片上顯示定時歌詞，聆聽麥克風並根據旋律繪製音高。所有內容都保留在這臺電腦上；麥克風永遠不會被錄製或播放。',
  'tour.karaoke.point1':
    '指南人聲滑塊，一旦 FluidEQ 在 Maker 中分離出歌曲的聲音：它就會從僅伴奏掃到完整的原始聲音，無需樂器檔案。',
  'tour.karaoke.point2':
    '音高通道：歌曲的音符作為塊，你的聲音作為它們上方的即時線，具有高、合調和低反饋。',
  'tour.karaoke.point3':
    '隨後進行表演回顧，列出要練習的部分，並為另一次跑步做好準備。',
  'tour.karaoke.point4':
    '透過 MP3、FLAC、WAV、OGG、M4A 等讀取 LRC、帶字定時的增強型 LRC 以及帶有音節和音調的 UltraStar。翻譯的歌詞和估計的吉他和絃隨之而來。',
  'tour.karaoke.how':
    '開啟卡拉 OK 分頁，按“開啟歌曲”或“新增資料夾”，在播放清單中選擇一首曲目，開啟麥克風，顯示音調指南，然後按“播放”。',
  'tour.karaoke.open': '開啟卡拉 OK',
  'tour.maker.kicker': '自己製作',
  'tour.maker.title': '卡拉 OK 製作工具',
  'tour.maker.subtitle': '任何歌曲都可以成為卡拉 OK 檔案',
  'tour.maker.lead':
    '卡拉 OK 分頁內的完整創作工作室。它可以自行完成整個工作：將聲音與音樂分離，使用本地語音模型讀取單字及其時間並檢測旋律音符。或者您可以在可縮放的時間軸上手動點選、記錄和繪製每個時間點。一切都在這臺電腦上運作。',
  'tour.maker.point1':
    '「自動設定這首歌」：分離聲音，然後朗讀歌詞和時間，並提供在後臺繼續播放的選項。',
  'tour.maker.point2':
    '保留單獨的音軌：語音和背景音軌，每個音軌均可儲存，包括儲存為 MP3。',
  'tour.maker.point3':
    '用於詳細資訊的手動工具：點選單字、記錄行條目、帶有開頭和長度的單字檢查器以及將單字拆分為音節。',
  'tour.maker.point4':
    '在音高網格上繪製旋律，標記金色音符，然後匯出為 FluidEQ 專案、UltraStar TXT、LRC、增強型 LRC 或背景音軌。',
  'tour.maker.how':
    '在卡拉 OK 中，載入歌曲並按下「製作」。在精靈中接受“自動設定”，修正時間線上的文字，然後“在播放器中使用”和“匯出”。',
  'tour.maker.open': '開啟卡拉 OK',
  'tour.media.kicker': '網路，通過您的情商',
  'tour.media.title': '網路媒體',
  'tour.media.subtitle': 'YouTube、YouTube 音樂、Bandcamp、Twitch 和 Suno',
  'tour.media.lead':
    '串流媒體網站的內建播放器，因此您線上上觀看和聆聽的內容可以透過 EQ 而不是單獨的瀏覽器運作。連線了五個站點，每個站點都有自己的搜尋，並且透過「在瀏覽器中開啟」選項來阻止指向站外的連結。',
  'tour.media.point1':
    '一個搜尋欄位可以搜尋開啟的任何網站，並且您可以清除最近的搜尋。',
  'tour.media.point2':
    '登入一次：播放器會在兩次訪問之間保留您的登入訊息，直到您登出為止。',
  'tour.media.point3':
    '恢復：播放器會記住最後一頁以及您在其中的位置，並將您帶回那裡。',
  'tour.media.point4':
    '下載帶有進度藥丸和“在資料夾中顯示”，完成後，還有一個登出按鈕，工具列末尾的門，一按即可清除每個 cookie 和登入。',
  'tour.media.how':
    '開啟「線上媒體」分頁，從頂部行中選擇一個網站，在搜尋欄位中鍵入內容，然後按「搜尋」。後退、前進和重新載入的工作方式與在瀏覽器中一樣。',
  'tour.media.open': '開放線上媒體',
  'tour.studio.free': '每個帳戶免費',
  'tour.film.englishAudio': '英語語音 · 翻譯字幕',
  'tour.karaokeBackground.title': '以視覺化效果襯托歌詞',
  'tour.karaokeBackground.subtitle': '將選擇的樣式呈現在卡拉 OK 舞臺',
  'tour.karaokeBackground.lead': '選擇視覺化效果或場景，作為卡拉 OK 的背景。',
  'tour.karaokeBackground.how':
    '在 EQ 的 {looks} 中選擇樣式，再到卡拉 OK 按下 {showGraph}。',
  'tour.karaokeBackground.open': '開啟卡拉 OK',
  'tour.karaokeBackground.imageAlt':
    '卡拉 OK 的背景控制項，以及歌詞後方的場景。',
  'tour.karaokeBackground.lyric': '讓我們的歌聲點亮這個夜晚',
} satisfies Partial<Dictionary>;

export default tour;
