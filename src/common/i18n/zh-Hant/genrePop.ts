/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genrePop = {
  'genre.pop.hook': '目前完成最多的紀錄是',
  'genre.pop.story':
    '流行音樂的執行速度為 100 至 130 BPM，或半時速度約為 90，超過 808 或合成貝斯，聲音明亮到略顯刺耳。母帶到達時限制為大約 −8 LUFS，峰值超過全尺寸，因此播放階段可以新增的所有內容都已經在其中了。預設僅新增母版無法擁有的內容。',
  'genre.pop.pin.50': '重低音和大鼓流行音樂是建立在',
  'genre.pop.pin.50.why': '感受到的比聽到的要多：小型喇叭首先減輕的重量。',
  'genre.pop.pin.315': '隱藏聲音的四四方方',
  'genre.pop.pin.315.why': '去掉後，主唱就可以從混音中脫穎而出。',
  'genre.pop.pin.5000': '存在感和光澤',
  'genre.pop.pin.5000.why': '人聲的潤色，不致於刺耳。',
  'genre.pop.stage.exciter': '琴體在 1kHz 左右，人聲上有光澤，下方有溫暖。',
  'genre.pop.stage.bassPunch':
    '收緊而不是打擊：低音線下方的踢尾較短，起音剛剛提升。',
  'genre.pop.stage.dimension':
    '單聲道低音低於 140 Hz，就像流行音樂大師的作品一樣，空氣比唱片寬一點。',
  'genre.pop.stage.maximizer':
    '一個幾乎無法驅動的輕型天花板：主人已經受到限制。',
  'genre.pop.off':
    'Bass Forge 以 Pop 的名義提供，並保留下來：低音砲位於母帶中。',
  'genre.indiePop.hook': '比圖表更輕更溫暖',
  'genre.indiePop.story':
    '刺耳的吉他聲和圍繞著中心聲音的堆疊和聲，90 到 130 BPM，通常被故意剪成磁帶或盒式磁帶。比流行音樂流行音樂更柔和，安靜約一個分貝，低音更少：溫暖就是外觀。',
  'genre.indiePop.pin.50': '沒有低音炒作',
  'genre.indiePop.pin.50.why': '左平：獨立流行音樂從來都不是建立在重低音上的。',
  'genre.indiePop.pin.315': '混合紙板',
  'genre.indiePop.pin.315.why': '家庭錄音中四四方方的中低音堆積起來。',
  'genre.indiePop.pin.1250': '叮噹聲與和聲',
  'genre.indiePop.pin.1250.why': '吉他聲響起、伴奏聲疊加的地方。',
  'genre.indiePop.pin.12500': '一點空氣',
  'genre.indiePop.pin.12500.why': '溫柔，覆蓋著原本柔軟的頂部。',
  'genre.indiePop.stage.exciter': '僅溫暖，在中低頻：從未如此明亮。',
  'genre.indiePop.stage.dimension':
    '底部變窄了，空氣也變寬了：和聲在不移動聲音的情況下開啟。',
  'genre.indiePop.stage.maximizer': '保持柔軟的淺色天花板。',
  'genre.indiePop.off': '沒有舞臺可以照亮它或增加低音：低保真溫暖才是重點。',
  'genre.synthPop.hook': '鼓機、音序貝斯和合唱墊',
  'genre.synthPop.story':
    'Linn 和 808 鼓機、有序低音線和寬合唱墊，100 至 135 BPM。早期的唱片薄而明亮； 80 年代的大師保留了現代大師所沒有的動態（動態範圍為 12 到 13）。',
  'genre.synthPop.pin.125': '早期記錄所缺乏的身體',
  'genre.synthPop.pin.125.why': '中低溫暖是這些混音受歡迎的方向。',
  'genre.synthPop.pin.500': '放置護墊的空間',
  'genre.synthPop.pin.500.why': '清除中間堆積的合唱墊和鼓機。',
  'genre.synthPop.pin.12500': '頂部是放鬆的，而不是抬起的',
  'genre.synthPop.pin.12500.why': '早期的合成器流行音樂已經變得光明。',
  'genre.synthPop.stage.exciter': '僅在中低音處溫暖：在明亮的頂部沒有諧波。',
  'genre.synthPop.stage.dimension':
    '低音變窄，音墊變寬，這就是這種流派的混合方式。',
  'genre.synthPop.stage.maximizer': '緩慢的天花板保留了 80 年代的活力。',
  'genre.synthPop.off':
    '沒有 Bass Punch 和沒有 Bass Forge：鼓機的底鼓完全按照程式設計進行。',
  'genre.newWave.hook': '急促、起伏不定的吉他和傾斜的底部',
  'genre.newWave.story':
    '110 至 160 BPM 的快節奏和生澀：緊繃的底鼓、旋律優美的貝斯和明亮、起伏不定的吉他在傾斜的底部。原版的母帶是有空間的（動態範圍為 14）；再版就失去了大部分。',
  'genre.newWave.pin.125': '為薄薄的原件帶來一點溫暖',
  'genre.newWave.pin.125.why': '剛好有足夠的身體來承載低音線。',
  'genre.newWave.pin.315': '出泥，使低音移動',
  'genre.newWave.pin.315.why': '旋律優美的低音需要一條清晰的通道。',
  'genre.newWave.pin.1250': '波濤洶湧的吉他',
  'genre.newWave.pin.1250.why': '節奏吉他的魅力所在。',
  'genre.newWave.stage.exciter':
    '一點點的身體和一點點的空氣，這是薄薄的原件所歡迎的。',
  'genre.newWave.stage.dimension': '接近記錄：底部變窄，頂部變寬。',
  'genre.newWave.stage.maximizer': '一個只吸引人的天花板：快照就是流派。',
  'genre.newWave.off':
    '沒有 Bass Punch 或 Bass Forge：精實底部就是它的製作方式。',
  'genre.kPop.hook': '最響亮、最精美的唱片之一',
  'genre.kPop.story':
    '女團舞曲多在 115 至 130 BPM，男團歌曲則常接近 80 至 100 BPM。大鼓強調極低頻衝擊，人聲在 3 至 5 kHz 和 12 kHz 通常已經提升。母帶約為 −10 至 −6 LUFS，峰值往往超過滿刻度。',
  'genre.kPop.pin.80': '是踢拳，而不是子拳',
  'genre.kPop.pin.80.why': '踢球落地的地方； 50 Hz 以下沒有任何物體被提升。',
  'genre.kPop.pin.315': '密集排列下的空間',
  'genre.kPop.pin.315.why': '中低頻已清除，因此各層不會模糊。',
  'genre.kPop.pin.12500': '沒有額外的空氣',
  'genre.kPop.pin.12500.why': '人聲已經帶有 12 kHz 的聲音。',
  'genre.kPop.stage.exciter':
    '身體和臨場感都在人聲自身的提升之下，而上面什麼都沒有。',
  'genre.kPop.stage.dimension': '低音變窄，雙音和低音比混合後稍寬。',
  'genre.kPop.stage.maximizer':
    '天花板幾乎無法驅動：這些大師的聲音與大師一樣響亮。',
  'genre.kPop.off':
    '沒有 Bass Punch 或 Bass Forge：踢擊和重低音喇叭已在記錄中。',
  'genre.jPop.hook': '任何節奏的密集、明亮的牆壁',
  'genre.jPop.story':
    '90 BPM 以下的民謠以及 150 至 200 甚至更多的樂隊、偶像和動漫歌曲，在密集、寬闊的牆壁上伴隨著繁忙的貝斯和扭曲的吉他。母帶到達時被削波，峰值高達 +2.3 dBTP。',
  'genre.jPop.pin.125': '一絲中低溫暖',
  'genre.jPop.pin.125.why': '這些混合的一個方向很好。',
  'genre.jPop.pin.500': '牆壁變得透氣',
  'genre.jPop.pin.500.why': '稍微遠離擁擠的中間。',
  'genre.jPop.pin.3150': '中高頻單獨留下',
  'genre.jPop.pin.3150.why': '已經光明正大；從來沒有推動過。',
  'genre.jPop.stage.exciter': '只有溫暖，在中低頻：頂部沒有任何東西如此明亮。',
  'genre.jPop.stage.dimension': '沒有任何東西變寬：牆壁夠寬。',
  'genre.jPop.stage.maximizer': '一個天花板幾乎無法驅動已經被剪裁的母版。',
  'genre.jPop.off': '沒有 Bass Punch 或 Bass Forge：牆壁變得密集且響亮。',
  'genre.cPop.hook': '民謠，聲音的前沿和中心',
  'genre.cPop.story':
    '民謠的節奏為 60 至 90 BPM，流行音樂的節奏為 95 至 120，鋼琴和絃樂的聲音位於前面，溫暖而流暢。普通話的尖銳子音想要的是消除嘶嘶聲而不是興奮。',
  'genre.cPop.pin.125': '溫暖的民謠體',
  'genre.cPop.pin.125.why': '經典華語流行音樂的控制台溫暖。',
  'genre.cPop.pin.1250': '光滑，不鼻塞',
  'genre.cPop.pin.1250.why': '放鬆下來，聲音保持柔和。',
  'genre.cPop.pin.12500': '溫柔的空氣',
  'genre.cPop.pin.12500.why': '稍微提升到子音上方，而不是子音上方。',
  'genre.cPop.stage.exciter': '僅溫暖：齒擦音上沒有和聲。',
  'genre.cPop.stage.dimension': '中頻較窄，因此聲音位於中間，弦樂和殘響較寬。',
  'genre.cPop.stage.maximizer': '民謠動態的緩慢上限。',
  'genre.cPop.off':
    '沒有 Bass Punch 或 Bass Forge：鋼琴民謠下沒有發明重低音喇叭。',
  'genre.ballad.hook': '慢歌，聲音蓋過一切',
  'genre.ballad.story':
    '每種音樂都有慢板歌曲，流行、搖滾、靈魂樂和拉丁音樂皆然，速度大多為 60 至 85 BPM：「Someone Like You」是 67.5，「November Rain」是 84。混音時先處理主唱，讓人聲貼近聽者、位於其他聲部之上，配上較長的板式或廳堂殘響；下方的鋼琴、弦樂或樂團則保持克制。母帶通常比同張專輯的單曲保留更多動態。',
  'genre.ballad.pin.125': '溫暖的聲音和鋼琴',
  'genre.ballad.pin.125.why': '小小的身體，民謠的聲音和鋼琴的聲音都很溫暖。',
  'genre.ballad.pin.500': '泥漿得到緩解',
  'genre.ballad.pin.500.why':
    '鋼琴的中低音和近距離的人聲堆積起來，被去掉，以便單字保持清晰。',
  'genre.ballad.pin.3150': '存在感',
  'genre.ballad.pin.3150.why': '聲音往前一點，那裡的話就聽得懂了。',
  'genre.ballad.pin.8000': '齒音減輕，但沒有變亮',
  'genre.ballad.pin.8000.why':
    '近距離的聲音在這裡傳遞出它的精髓，而一次提升會讓每個人都變得敏銳。',
  'genre.ballad.stage.dimension':
    '低音向中間變窄，民謠與其中混合；人聲、鋼琴和琴絃的寬度與它們放置的位置一樣寬。',
  'genre.ballad.stage.maximizer':
    '輕盈、緩慢的天花板讓整個節拍得以流逝，因此安靜的詩句保持安靜，最後的副歌仍然升起。',
  'genre.ballad.off':
    '不使用激勵器、Bass Forge 或 Bass Punch：新增的諧波容易落在齒音上，抒情歌曲的極低頻應保留製作人原有的安排，而且通常沒有需要塑形的大鼓。',
} satisfies Partial<Dictionary>;

export default genrePop;
