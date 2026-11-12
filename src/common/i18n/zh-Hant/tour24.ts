// 2.4 新功能（`renderer/components/featureTour/release24.tsx`）。
const tour24 = {
  'tour.animations.kicker': '工作室 · 動畫',
  'tour.animations.title': '會動的圖片，逐格檢查',
  'tour.animations.subtitle': '場景裡的每段動畫，一格一格',
  'tour.animations.lead':
    '請場景的聊天讓一張圖片動起來：它會把圖片彎折成照片般真實的畫格，或使用你自己的 Claude 能用到的東西，再排成畫格圖並檢查每一格。',
  'tour.animations.point1':
    '放在地面、天空或水上，上坡或下坡，任何速度，逐格播放，或在整個工作室上方放大播放。',
  'tour.animations.point2':
    '可匯入畫格圖、圖集 JSON、GIF、APNG、WebP、Aseprite 檔案或編號圖片；加入前會先在分頁裡播放。',
  'tour.animations.point3':
    '每個新專案都從球體裡的月亮和飛過上方的燕子開始，第一天就能學會圖片和動畫的用法。',
  'tour.animations.how':
    '開啟展示臺，進入工作室，在舞臺下方選擇動畫。在聊天裡請它讓場景中的一張圖片動起來。',
  'tour.animations.open': '開啟展示臺',
  'tour.animations.imageAlt':
    '工作室的動畫分頁：燕子在天空背景上拍動翅膀，八個畫格排成一列；下方是場景的聊天，正在找出跳動的那一格。',
  'tour.animations.task': '逐格檢查燕子的飛行。',
  'tour.animations.stepLook': '並排檢視了全部 {count} 格',
  'tour.animations.stepJump': '第 {frame} 格比其他格跳得更高',
  'tour.animations.stepFix': '把第 {frame} 格放回與其他格同一條線上',
  'tour.animations.reply': '現在飛行很流暢：每一格都在同一條線上。',
  'tour.pictures.kicker': '工作室 · 圖片',
  'tour.pictures.title': '看清每張圖，標出來，再傳回去',
  'tour.pictures.subtitle': '在聊天裡放大、複製圖片，並在上面畫',
  'tour.pictures.lead':
    'AI 開啟或處理的每張圖片都會直接顯示在聊天裡。點一下就能放大檢視，想放多大就放多大。',
  'tour.pictures.point1':
    '就在放大的地方畫：圈出一處、用箭頭指出、寫一個字，或裁切到重要的部分，再附加到下一則訊息。',
  'tour.pictures.point2':
    '任何圖片都能用按鈕、Ctrl+C 或按右鍵複製，貼到任何地方。',
  'tour.pictures.point3': '你的標記會跟著圖片一起送出，AI 能準確明白你的意思。',
  'tour.pictures.how':
    '在工作室的聊天裡點一下圖片開啟它。按「畫畫」來標記，再按「附加到聊天」。',
  'tour.pictures.open': '開啟展示臺',
  'tour.pictures.imageAlt':
    '一張放大開啟的月亮圖片：隕石坑周圍畫了一個圈，還有箭頭和文字，裁切框正在收攏，旁邊是「複製影像」和「附加到聊天」按鈕；下方是圖片所在的聊天。',
  'tour.pictures.ask': '把這個月亮放進球體，邊緣發光。',
  'tour.pictures.reply': '好了：邊緣在發光，它也在「圖片」裡。',
  'tour.pictures.mark': '再亮一點',
  'tour.pictures.followUp': '讓這個隕石坑隨低音發光。',

  'tour.stage.kicker': '工作室 · 舞臺',
  'tour.stage.title': '在它真正播放的地方試場景',
  'tour.stage.subtitle': '超寬圖表、輕巧播放器、冷靜與音樂',
  'tour.stage.lead':
    '舞臺依照大家看到的樣子呈現你的場景：作為超寬圖表，或在輕巧播放器的欄位裡，上面疊著歌曲和控制按鈕。',
  'tour.stage.point1':
    '可以放大舞臺並四處移動。AI 看到的正是舞臺顯示的內容，所以「這裡」就是這裡。',
  'tour.stage.point2':
    '在舞臺上按一下，就把音樂換成「冷靜」——桌面背景播放的那種緩慢動畫。',
  'tour.stage.point3':
    '沒有播放任何內容時，場景會隨示範歌曲動起來，工作時它從不會停住。',
  'tour.stage.how':
    '在工作室裡，從舞臺的尺寸選單選一個形狀。音樂和冷靜按鈕就在舞臺上。',
  'tour.stage.open': '開啟展示臺',
  'tour.stage.imageAlt':
    '工作室舞臺上的 Alpine 場景，正在放大，一個框標出 AI 看到的範圍，還有音樂和冷靜按鈕；旁邊是同一場景的超寬圖表，以及疊著控制按鈕的輕巧播放器。',
  'tour.stage.agentSees': 'AI 看到的範圍',

  'tour.ai.kicker': '工作室 · 你的 AI',
  'tour.ai.title': '一個照顧你所有場景的 AI',
  'tour.ai.subtitle': '同時做多個場景，用你自己的外掛，任選模型',
  'tour.ai.lead':
    '你的 AI 現在能同時處理多個場景，每個場景一個聊天，而且消耗的 Claude 方案額度更少。',
  'tour.ai.point1':
    '它使用你自己的 Claude 擁有的一切：你的外掛、工具和指令；用到任何新東西之前都會先詢問。',
  'tour.ai.point2':
    'FluidEQ 自己的 3D 世界、3D 照片和動畫技能隨應用程式提供，永遠保持最新。',
  'tour.ai.point3':
    '為每個聊天選擇模型和投入程度。清單跟隨 Claude Code，新模型一推出就會出現。',
  'tour.ai.how':
    '在工作室開啟一個場景，在它的聊天裡輸入。模型和投入程度就在輸入框下方。',
  'tour.ai.open': '開啟展示臺',
  'tour.ai.imageAlt':
    '同時進行的三個場景，兩個仍在處理，一個已保存為版本 7，下方是 FluidEQ 的技能；旁邊是 AI 使用的東西，以及模型和投入程度選單。',
  'tour.ai.skills': 'FluidEQ 的技能',
  'tour.ai.skillWorlds': '3D 世界',
  'tour.ai.skillPhotos': '3D 照片',
  'tour.ai.skillAnimation': '動畫',
  'tour.ai.claudeTitle': '使用你自己的 Claude',
  'tour.ai.claudePlugins': '你的外掛',
  'tour.ai.claudeTools': '你的工具和指令',
  'tour.ai.claudeAsks': '用新東西前先詢問',
  'tour.controls.kicker': '場景',
  'tour.controls.title': '可以照你心意打造的場景',
  'tour.controls.subtitle': '調色盤、選項、3D 世界和保留的版本',
  'tour.controls.lead':
    '場景現在可以提供調色盤、附圖示的選項、單一顏色，以及只在用到它們的選項下才出現的控制項。',
  'tour.controls.point1':
    '3D 世界加入了彎曲的圓柱和圓錐，以及真正的地面；場景發布時會附上更清晰的白天預覽片段，配著示範歌曲。',
  'tour.controls.point2':
    '發布畫面會顯示場景有多大。版本只在發布時才升高，狀態列會告訴你目前是哪個版本。',
  'tour.controls.point3':
    '畫廊為每個場景保留最近 10 個版本，你可以在場景頁面把其中任何一個儲存到這台電腦。',
  'tour.controls.how':
    '在工作室開啟場景的「調音」分頁。場景的各個版本在畫廊中它的頁面上。',
  'tour.controls.open': '開啟展示臺',
  'tour.controls.imageAlt':
    '「調音」分頁：兩個調色盤，以及在晴、雨、雪之間切換的天氣選項，選雪時才出現降雪滑桿；旁邊是場景頁面，顯示大小、版本和保留的版本。',
  'tour.controls.weather': '天氣',
  'tour.controls.clear': '晴',
  'tour.controls.rain': '雨',
  'tour.controls.snow': '雪',
  'tour.controls.glow': '月光',
  'tour.controls.snowfall': '降雪',

  'tour.camera.kicker': '展示臺',
  'tour.camera.title': '在場景中穿梭，在圖表上，也在桌面上',
  'tour.camera.subtitle': '你自己的鏡頭鍵，以及回應滑鼠的桌面',
  'tour.camera.lead':
    '選擇移動 3D 場景鏡頭的按鍵——Ctrl、Alt、Shift 或任何按鍵——以及要按住拖曳，還是按住移動就好。',
  'tour.camera.point1':
    '開啟「跟隨滑鼠」，場景會朝指標傾斜；也可以讓它「自動環繞」。「重設檢視」只在按住按鍵時出現。',
  'tour.camera.point2':
    '桌面上的展示會回應空白桌面上的滑鼠，每台螢幕都有自己的時間，工作室會把你最新的版本放到桌面上。',
  'tour.camera.point3':
    '節拍閃光落在大鼓上，沒有播放時畫廊預覽會隨示範歌曲動起來，出錯的場景會播放最後一個能用的版本，而不是素色外觀。',
  'tour.camera.how': '鏡頭設定在圖表的「檢視」選單中，場景下方。',
  'tour.camera.open': '開啟等化器',
  'tour.camera.imageAlt':
    '兩台螢幕，每個桌面上都有展示：第一台上場景朝指標傾斜，按住 Ctrl 時出現「重設檢視」；每台都有自己的時間；下方是鏡頭設定。',

  'tour.v24.also': '2.4 的其他更新',
  'tour.v24.heroes':
    '《暴雪英霸》有了更飽滿的專屬混音，可選廣闊的舞臺。遊戲濾鏡在凸顯提示音的同時讓音樂更平穩。',
  'tour.v24.graphSettings': '圖表為標準樣式和展示分別保存設定。',
  'tour.v24.colourful': '多彩模式採用圖表上場景的顏色。',
  'tour.v24.gallery': '畫廊開啟時顯示最新的場景。',
  'tour.v24.credits': '在瀏覽器購買的點數會自動入帳。',
  'tour.v24.sponsors':
    '可以在「關於」或支援頁面透過 GitHub Sponsors 支持 FluidEQ。',
  'tour.v24.crashes':
    '萬一 FluidEQ 當機，紀錄只會保存在這台電腦上，供你自己決定是否送出的錯誤回報使用。',
  'tour.visualsTitle': '視覺化效果的新增功能',
  'tour.rail.alwaysVisuals': '也在視覺化效果中',
  'visuals.news.open': '新增功能',
  'visuals.news.blurb': '視覺化效果、工作室和燈光',
  'visuals.news.title': '視覺化效果 {version} 的新功能',
  'visuals.news.see': '查看新增功能',
  'visuals.news.later': '稍後再說',

  'tour.level.kicker': 'DSP 預設',
  'tour.level.title': '依歌曲本身音量播放的預設',
  'tour.level.subtitle': '不再突然變大聲，音量保持穩定',
  'tour.level.lead':
    '原廠 DSP 預設不再於各級處理之前統一歌曲音量：每一級都依音樂進來的原樣處理，由響度最大化器加上固定增益並壓住峰值。',
  'tour.level.point1':
    '從播放時會調整增益的預設切換走後，這份提升不會再帶到接下來的聲音裡。',
  'tour.level.point2': '暫停後不會突然變大聲：靜音之後，歌曲以自己的音量回來。',
  'tour.level.point3':
    '等化器前級的自動正規化在 Windows 重新開啟輸出時會保持音量，而不是從頭開始。',
  'tour.level.how':
    '已有的效果鏈會保留原本的設定，直到你在 DSP 頁面重新選擇它的原廠預設。',
  'tour.level.open': '開啟 DSP',

  'tour.edit.kicker': '工作室 · 編輯模式',
  'tour.edit.title': '親手移動場景裡的東西',
  'tour.edit.subtitle': '移動、旋轉、縮放，然後儲存',
  'tour.edit.lead':
    '在舞台上按「編輯」，選取 3D 場景裡的任何東西：形狀、燈光、3D 模型或它們的群組。',
  'tour.edit.point1':
    '用控制點移動、旋轉或縮放它，「貼齊」讓它以四分之一步和 15° 轉動。「單獨顯示」只顯示這一個。',
  'tour.edit.point2':
    '場景裡的每樣東西都在一個清單裡，可以搜尋、隱藏、鎖定、重新命名和群組。',
  'tour.edit.point3':
    '按「儲存」之前，場景不會有任何改變。「放棄」丟掉更改，復原和重做可以來回查看。',
  'tour.edit.how': '在工作室開啟一個 3D 場景，在它的舞台上按「編輯」。',
  'tour.edit.open': '開啟展示臺',
  'tour.edit.imageAlt':
    '工作室舞台上的場景裡選取了一個形狀並顯示控制點，上方是移動、旋轉和縮放工具，旁邊是場景裡所有東西的清單。',
  'tour.watch.kicker': '工作室 · 你的 AI',
  'tour.watch.title': '會看場景動起來的 AI',
  'tour.watch.subtitle': '隨音樂的畫面、三種檢視、整首歌',
  'tour.watch.lead':
    '你的 AI 不再憑一張圖判斷場景。它會看場景怎麼動，並依聽眾看到的樣子檢查。',
  'tour.watch.point1': '沿著音樂取幾格並排放，看清東西往哪邊動、動得是否均勻。',
  'tour.watch.point2':
    '同一時刻的一般圖表、超寬圖表和精簡播放器的整欄，確保沒有被裁掉或留黑。',
  'tour.watch.point3':
    '測試歌曲的六個時刻，從靜音到高潮，檢查高潮是否看得出來，以及日光為 0 時夜晚有多暗。',
  'tour.watch.how': '在場景的聊天裡提出修改。它每次都這樣檢查自己的成果。',
  'tour.watch.open': '開啟展示臺',
  'tour.watch.imageAlt':
    '一個場景隨音樂的五格畫面及其移動方式，場景在一般、超寬和精簡播放器檢視中的樣子，以及測試歌曲從靜音到高潮的六個時刻。',
  'tour.watch.frames': '隨音樂的畫面',
  'tour.watch.moves': '向右移動，均勻',
  'tour.watch.standard': '一般',
  'tour.watch.song': '用歌曲檢查',
  'tour.watch.silence': '靜音',
  'tour.watch.verse': '主歌',
  'tour.watch.build': '鋪陳',
  'tour.watch.drop': '高潮',
  'tour.watch.dropShows': '高潮看得出來',
  'tour.watch.night': '夜晚：亮度 {value}%',
  'tour.makers.kicker': '工作室 · 圖片',
  'tour.makers.title': '現已整合 Higgsfield',
  'tour.makers.subtitle': '為您的場景製作圖片和動畫',
  'tour.makers.lead': '工作室的 AI 透過 Higgsfield 為您的場景製作圖片和動畫。',
  'tour.makers.point1':
    '它使用您自己的 Higgsfield 帳戶，只需在聊天的「帳戶」中設定一次。',
  'tour.makers.point2': '製作任何內容之前，它會告訴您費用，並先徵求您的同意。',
  'tour.makers.point3': '它製作的影片會成為場景中的動畫。',
  'tour.makers.how': '在工作室開啟一個場景的聊天，按「帳戶」。',
  'tour.makers.open': '開啟展示臺',
  'tour.makers.imageAlt':
    '場景聊天在產生動畫之前請你允許 Higgsfield，旁邊是列有 Claude 和 Higgsfield 的帳戶清單。',
  'tour.makers.request': '把錦鯉做成游動的動畫',
  'tour.code.kicker': '工作室 · 程式碼',
  'tour.code.title': '在「程式碼」分頁查看場景的每個檔案',
  'tour.code.subtitle': '著色器、世界、材質、動畫、筆記',
  'tour.code.lead':
    '「程式碼」分頁顯示整個場景，而不只是著色器：它的套件、3D 世界及其引用的材質、動畫和筆記。',
  'tour.code.point1':
    '每個檔案都能摺疊成名稱和行數，「全部展開」一次全部打開。',
  'tour.code.point2': '它隨 AI 儲存即時跟上檔案，「顯示更改」會標出改了哪裡。',
  'tour.code.point3':
    'AI 當作一般圖片打包的一張畫格圖，會變成「動畫」分頁裡真正的動畫。',
  'tour.code.how': '在工作室開啟一個場景，在舞台下方選擇「程式碼」。',
  'tour.code.open': '開啟展示臺',
  'tour.code.imageAlt':
    '「程式碼」分頁，場景的檔案摺疊成名稱，其 3D 世界的一個材質處於展開狀態。',
  'tour.v25.also': '2.5 的其他更新',
  'tour.v25.recover':
    '桌面背景或精簡播放器會用你的工作室專案或圖庫的副本修好無法建置的場景。',
  'tour.v25.never':
    '無法播放的場景絕不會被換成別的外觀：圖表會說明原因並提供「重試」。',
  'tour.v25.copy':
    '在工作室開啟的其他成員的場景是鎖定的副本，它的聊天會在每個指令前詢問。',
  'tour.v25.review': '未通過審核的場景會在名稱旁顯示審核者的理由。',
  'tour.v25.publish': '發布不再有每月上限。',
  'tour.signed.kicker': 'FLUIDEQ 2.5',
  'tour.signed.title': '現已簽署，免費！',
  'tour.signed.subtitle': '一路走來，以及為所有人簽署的 FluidEQ',
  'tour.signed.today':
    '如今，它是電腦上所有聲音的等化器，是您的音樂播放器，也是隨音樂律動的視覺化效果。',
  'tour.signed.liveFor': 'FluidEQ 已經運作',
  'tour.signed.since': '始於 {date}',
  'tour.signed.roadTitle': '一路走來',
  'tour.signed.intro':
    'FluidEQ 始於 2026年8月2日，兩天後推出了第一個版本 0.4.0。三個多月後，它有了在 Windows 內運作、屬於它自己的音訊引擎，處理您聽到的一切聲音的 DSP 機架，用於您的音樂的媒體庫和播放器，附畫廊的視覺化效果，用來製作自己場景的工作室，以及十二種語言。由開發者簽署的版本，是這段路上的一個里程碑。',
  'tour.signed.thanks':
    '感謝每一位使用 FluidEQ、回報問題、發布場景和在論壇發言的人：是您們每一位讓它變得更好。',
  'tour.signed.signedTitle': '由開發者簽署',
  'tour.signed.signedBody':
    '執行安裝程式時，Windows 會顯示發行者：{publisher}。',
  'tour.signed.updatesTitle': '持續自動更新',
  'tour.signed.updatesBody':
    '每個新版本都會自動送達，準備好後 FluidEQ 會通知您。您的設定會保留。',
  'tour.signed.freeTitle': '人人免費',
  'tour.signed.freeBody': '只有一個 FluidEQ，人人相同，不必購買，也不必啟用。',
  'tour.signed.unit.day.one': '天',
  'tour.signed.unit.day.few': '天',
  'tour.signed.unit.day.many': '天',
  'tour.signed.unit.day.other': '天',
  'tour.signed.unit.hour.one': '小時',
  'tour.signed.unit.hour.few': '小時',
  'tour.signed.unit.hour.many': '小時',
  'tour.signed.unit.hour.other': '小時',
  'tour.signed.unit.minute.one': '分鐘',
  'tour.signed.unit.minute.few': '分鐘',
  'tour.signed.unit.minute.many': '分鐘',
  'tour.signed.unit.minute.other': '分鐘',
  'tour.signed.unit.second.one': '秒',
  'tour.signed.unit.second.few': '秒',
  'tour.signed.unit.second.many': '秒',
  'tour.signed.unit.second.other': '秒',
} as const;

export default tour24;
