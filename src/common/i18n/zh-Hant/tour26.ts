// 2.6 新功能（`renderer/components/featureTour/release26.tsx` 和 `release26Visuals.tsx`）。
const tour26 = {
  'tour.v26.window.name': '全新視窗',
  'tour.v26.window.subtitle': '平整安靜，深色或白色',
  'tour.v26.window.kicker': 'FLUIDEQ 2.6',
  'tour.v26.window.title': '整個視窗，煥然一新',
  'tour.v26.window.lead':
    '每個頁面都平整安靜，可從全黑調到全白，「色調」還多了第二種顏色。',
  'tour.v26.window.hint': '在視窗上拖曳控點，就能把它從深色變成白色。',
  'tour.v26.window.seamLabel': '白色與深色的分界',
  'tour.v26.window.seamValue': '白色佔 {percent}%',
  'tour.v26.window.white': '白色',
  'tour.v26.window.dark': '深色',

  'tour.v26.autoEq.name': 'Auto EQ',
  'tour.v26.autoEq.subtitle': '每首歌都有自己的聲音',
  'tour.v26.autoEq.kicker': 'EQ · AUTO EQ',
  'tour.v26.autoEq.title': '每首歌都用它該有的聲音播放',
  'tour.v26.autoEq.lead':
    '一個面板決定每首歌的聲音：儲存了聲音的歌曲播放它自己的聲音，設定了聲音的專輯讓每首歌都播放那個聲音，其他歌曲則按你離開時的樣子播放你自己的聲音。',
  'tour.v26.autoEq.point1':
    '正在播放的歌曲，以及聲音來自哪裡：它自己的、專輯的，還是你的。',
  'tour.v26.autoEq.point2':
    '「歌曲聲音」和「專輯聲音」，各有自己的開關，還有「為這首歌儲存」。',
  'tour.v26.autoEq.point3':
    '「智慧校正」為每首歌測量一次，穩定下來後保持它的校正，可疊加在任何預設組之上。',
  'tour.v26.autoEq.open': '開啟等化器',

  'tour.v26.mic.name': '麥克風',
  'tour.v26.mic.subtitle': '為你的麥克風準備的效果架',
  'tour.v26.mic.kicker': '麥克風',
  'tour.v26.mic.title': '你的聲音，在每個應用程式裡都清晰穩定',
  'tour.v26.mic.lead':
    '新的「麥克風」分頁在 FluidEQ Engine 中調整每個麥克風自己的聲音，所有使用它的應用程式都會聽到結果。',
  'tour.v26.mic.point1':
    '九個環節，從「低切」「降噪」到「人聲電平」「殘響」，每個都有自己的開關和預設組。',
  'tour.v26.mic.point2':
    '說話時聽到的自己：麥克風收到的聲音，輕輕墊在別人聽到的聲音後面。',
  'tour.v26.mic.point3':
    '可以直接上手的設定檔：實況、Podcast、遊戲語音、歌唱、人聲效果等。',
  'tour.v26.mic.open': '開啟麥克風',

  'tour.v26.eq.name': 'EQ 頁面',
  'tour.v26.eq.subtitle': '三個分頁和你自己的預設組',
  'tour.v26.eq.kicker': 'EQ',
  'tour.v26.eq.title': 'EQ 頁面，分成三個分頁',
  'tour.v26.eq.lead':
    '「你的 EQ」「預設組」和「音色」各自把工具放在一列，頻段就在圖表正下方。每張預設組卡片都會畫出它的曲線，「新增預設組」可以做出你自己的預設組。',
  'tour.v26.eq.point1':
    '「你的 EQ」「預設組」和「音色」，名稱旁邊顯示各自包含的內容。',
  'tour.v26.eq.point2':
    '在「你的」裡用「新增預設組」建立：在圖表上塑造的曲線，以及給 DSP 頁面的效果架。',
  'tour.v26.eq.point3':
    '每張預設組卡片都畫出曲線，點亮星號就能把它留在收藏夾裡。',
  'tour.v26.eq.open': '開啟等化器',

  'tour.v26.dynamics.name': '動態',
  'tour.v26.dynamics.subtitle': '每個頻段一條曲線',
  'tour.v26.dynamics.kicker': 'DSP · 動態',
  'tour.v26.dynamics.title': '看清「動態」對每個頻段做了什麼',
  'tour.v26.dynamics.lead':
    '每個頻段都畫出自己的曲線，電平隨音樂即時沿曲線移動：安靜時抬起，響亮時壓住。',
  'tour.v26.dynamics.point1':
    '每個頻段此刻在做什麼，抬起還是壓住，隨歌曲即時顯示。',
  'tour.v26.dynamics.point2':
    '拖曳點來塑造曲線：空心點是頻段開始作用的位置，實心點是作用的強度。',
  'tour.v26.dynamics.point3': '需要精確時，在曲線下方輸入數值。',
  'tour.v26.dynamics.open': '開啟 DSP',

  'tour.v26.library.name': '媒體庫',
  'tour.v26.library.subtitle': '歌詞、標籤和 3D Cover Flow',
  'tour.v26.library.kicker': '媒體庫',
  'tour.v26.library.title': '全新的媒體庫，每首歌都配上歌詞',
  'tour.v26.library.lead':
    '書架裡放著資料夾樹，專輯像頁面一樣打開，標籤可以修正，還有 3D Cover Flow，以及隨演唱逐字點亮的「歌詞」分頁。',
  'tour.v26.library.point1':
    '帶時間的歌詞隨歌曲逐字點亮；按一下某一行即可從那裡播放。',
  'tour.v26.library.point2':
    '在瀏覽器中到 LRCLIB、Genius 或 Musixmatch 查找歌詞，或直接匯入，歌詞會一直跟著這首歌。',
  'tour.v26.library.point3':
    '「在卡拉 OK 中開啟」會把歌詞帶到「卡拉 OK 製作工具」。',
  'tour.v26.library.open': '開啟媒體庫',

  'tour.v26.karaoke.name': '卡拉 OK',
  'tour.v26.karaoke.subtitle': '為你的演唱打分數',
  'tour.v26.karaoke.kicker': '卡拉 OK',
  'tour.v26.karaoke.title': '唱吧，看看你唱得有多準',
  'tour.v26.karaoke.lead':
    '卡拉 OK 會為你唱的每個音打分數，依歌曲自己的調來稱呼音名，聽和弦準確得多，並透過媒體庫的播放器播放。',
  'tour.v26.karaoke.point1': '你唱的時候，音高條會被你聲音的顏色填滿。',
  'tour.v26.karaoke.point2':
    '每個音都有評判，歌詞行以一排排格子顯示在音高條下方。',
  'tour.v26.karaoke.point3': '邊唱邊看得分，結束時還有附歌曲地圖的總結。',
  'tour.v26.karaoke.open': '開啟卡拉 OK',

  'tour.v26.also': '2.6 的其他新功能',
  'tour.v26.also.normalizer':
    '「正規化器」由你掌控：DSP 預設組不會再開啟或關閉它。',
  'tour.v26.also.deEsser':
    '更多 DSP 預設組讓「s」音更柔和，低切和高切在轉動旋鈕的瞬間就能聽到。',
  'tour.v26.also.wave':
    '標題列的波形新增十種樣式和「錄音機」，並顯示正在播放的預設組名稱。',
  'tour.v26.also.notices': '通知集中在一處：播放列的右下角。',
  'tour.v26.also.lighter': '電腦負擔更輕：視窗不再隨每個音訊區塊重繪自己。',

  'tour.v26.looks.name': '外觀選擇器',
  'tour.v26.looks.subtitle': '每種外觀都在動，即時繪製',
  'tour.v26.looks.kicker': '場景 · 外觀',
  'tour.v26.looks.title': '選擇器裡的每種外觀都在動',
  'tour.v26.looks.lead':
    '外觀選擇器像媒體庫一樣排列，開啟時停在正在播放的外觀上，即時繪製每種標準外觀，畫面中的每個場景都會播放它的片段。',
  'tour.v26.looks.point1': '和媒體庫一樣的位置欄：先是樣式，再依類別列出場景。',
  'tour.v26.looks.point2':
    '每種標準外觀都在自己的方塊裡即時繪製、動起來，正在播放的會被標出。',
  'tour.v26.looks.point3': '「網格」或「詳細資料」，以及涵蓋全部內容的搜尋。',
  'tour.v26.looks.open': '開啟圖表',

  'tour.v26.colours.name': '視窗顏色',
  'tour.v26.colours.subtitle': '場景借給視窗的顏色',
  'tour.v26.colours.kicker': '場景 · 視窗顏色',
  'tour.v26.colours.title': '調整場景借給視窗的顏色',
  'tour.v26.colours.lead':
    '每個場景有一套視窗顏色，也就是白天的顏色，入夜後逐漸變暗。「視窗顏色」讓你變更它們，「自動」可重新找回，「使用場景的顏色」可還原。',
  'tour.v26.colours.point1': '場景借給視窗的顏色，每種都是一個可以變更的色塊。',
  'tour.v26.colours.point2': '視窗本身，以這些顏色呈現的樣子。',
  'tour.v26.colours.point3':
    '「自動」重新找回場景自己的顏色，「使用場景的顏色」把它們還原。',
  'tour.v26.colours.open': '開啟場景',

  'tour.v26.gallery.name': '畫廊',
  'tour.v26.gallery.subtitle': '像媒體庫一樣排列',
  'tour.v26.gallery.kicker': '場景 · 畫廊',
  'tour.v26.gallery.title': '畫廊，像媒體庫一樣排列',
  'tour.v26.gallery.lead':
    '搜尋在頂端，類別排成一列。新帳號從一個免費點數開始，也就是一個可以保留的場景；場景依每日額度下載。',
  'tour.v26.gallery.point1': '搜尋在頂端，類別排成一列，和媒體庫的工具列一樣。',
  'tour.v26.gallery.point2':
    '畫面中的每個場景都會播放它的片段；關閉動畫後它們保持靜止。',
  'tour.v26.gallery.point3': '保留一個場景需要一個點數，新帳號附贈一個。',
  'tour.v26.gallery.open': '開啟場景',

  'tour.v26.publish.name': '一按即發布',
  'tour.v26.publish.subtitle': '預覽自動錄製',
  'tour.v26.publish.kicker': '工作室 · 發布',
  'tour.v26.publish.title': '按下「傳送以供審核」，預覽自動錄製',
  'tour.v26.publish.lead':
    '發布時，在你按下「傳送以供審核」的那一刻，會用靜音的示範歌曲錄下場景的預覽；「用 AI 撰寫」會根據場景的聊天填寫說明。',
  'tour.v26.publish.point1': '說明可以由「用 AI 撰寫」填寫，也可以自己寫。',
  'tour.v26.publish.point2': '你寫的一句話會在送出前翻譯成每種語言。',
  'tour.v26.publish.point3':
    '「傳送以供審核」會錄下預覽片段，不需要你另外準備。',
  'tour.v26.publish.open': '開啟場景',

  'tour.v26.alsoScenes': '2.6 的其他新功能',
  'tour.v26.alsoScenes.auto':
    '「自動」會在目前場景播放時準備好下一個場景並交叉淡入，不再出現載入圈。',
  'tour.v26.alsoScenes.ambient':
    '「氛圍」讓面板保持平整；在媒體庫裡，場景在封面後方播放。',
  'tour.v26.alsoScenes.karaoke':
    '卡拉 OK 的場景在歌詞視窗中播放，有自己的「透明度」和「模糊」。',
  'tour.v26.alsoScenes.studio':
    '工作室始終使用自己的場景，並像媒體庫一樣排列。',
} as const;

export default tour26;
