/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genreUrban = {
  'genre.hiphop.hook': 'Boom bap：重踢與頂部的聲音',
  'genre.hiphop.story':
    'Boom bap 以 85 至 95 BPM 的速度擺動，是一種硬而短的取樣底鼓，聲音位於頂部，是圖表中最窄的混音。較舊的唱片頻率低於 50 Hz，並且樣本、黑膠唱片和 808 已經飽和。',
  'genre.hiphop.pin.50': '取代較舊的記錄',
  'genre.hiphop.pin.50.why': '舉起繁榮巴普薄的地方。',
  'genre.hiphop.pin.500': '低音與人聲之間的泥土',
  'genre.hiphop.pin.500.why': '清除後，這節經文位於頂部。',
  'genre.hiphop.pin.12500': '佈滿灰塵的頂部',
  'genre.hiphop.pin.12500.why': '從取樣記錄建立的節拍聽起來的方式。',
  'genre.hiphop.stage.dimension':
    '單聲道低於 120 Hz，並縮小到 180，窄畫面保持不變。',
  'genre.hiphop.stage.maximizer': '幾乎無法驅動的天花板。',
  'genre.hiphop.off':
    '它的 Exciter、Bass Forge 和 Bass Punch 已提供並保留：樣本已經飽和，Bass Forge 在低音音符中添加了 16% 的新聲音。',
  'genre.rap.hook': '聲音就是產品',
  'genre.rap.story':
    '節奏跟隨節拍，從 85 BPM Boom Bap 到 140 BPM Drill，但聲音就是唱片：居中、乾燥且清晰。',
  'genre.rap.pin.50': '低音保持在人聲之下',
  'genre.rap.pin.50.why': '不掩蓋文字的重量。',
  'genre.rap.pin.200': '離開胸口的聲音',
  'genre.rap.pin.200.why': '低音會使詩句變得混亂。',
  'genre.rap.pin.2000': '子音',
  'genre.rap.pin.2000.why': '可理解性，稍微靠前一點。',
  'genre.rap.stage.dimension': '中頻比唱片窄一些，以保持聲音靜止。',
  'genre.rap.stage.maximizer': '幾乎無法驅動的天花板。',
  'genre.rap.off': 'Bass Forge 被提供並被保留：低音的諧波落在聲音的胸部。',
  'genre.trap.hook': '手機聽得到的長長的808',
  'genre.trap.story':
    '計數為 140 BPM，感覺為 70：30 至 60 Hz 的長 808，故意扭曲，三拍子中的踩鈸。 120 Hz 以下的所有內容都是單聲道。',
  'genre.trap.pin.50': '808保持原樣',
  'genre.trap.pin.50.why':
    '從未在全頻系統上增強過，它已經是記錄中最響亮的東西了。',
  'genre.trap.pin.315': '精益中低頻',
  'genre.trap.pin.315.why': '由於陷阱是混合的。',
  'genre.trap.pin.8000': '清脆的踩鈸',
  'genre.trap.pin.8000.why': '卷子，清晰。',
  'genre.trap.stage.bassForge':
    '808 的泛音（40 Hz 音符的 80、120 和 160 Hz），因此小型喇叭可以播放它；沒有低於八度的。',
  'genre.trap.stage.dimension': '120 Hz 單聲道以下的一切，帽子和合成器都很寬。',
  'genre.trap.stage.maximizer': '幾乎無法驅動的天花板。',
  'genre.trap.off': '沒有激勵器，也沒有 Bass Punch：808 已經失真了。',
  'genre.rnb.hook': '絲質上衣搭配圓底',
  'genre.rnb.story':
    '感覺在 60 到 100 BPM，在 808 或合成貝斯下有柔和的圓形底鼓，以及居中、親密的人聲及其周圍的堆疊和音墊。',
  'genre.rnb.pin.50': '圓底',
  'genre.rnb.pin.50.why': '溫暖，不喧囂。',
  'genre.rnb.pin.1250': '光滑，不鼻塞',
  'genre.rnb.pin.1250.why': '放鬆，使聲音保持柔滑。',
  'genre.rnb.pin.12500': '絲綢上衣',
  'genre.rnb.pin.12500.why': '聲音上方的空氣。',
  'genre.rnb.stage.dimension': '由於流派是混合的，所以音墊比聲音稍寬。',
  'genre.rnb.stage.maximizer': '淺色天花板。',
  'genre.rnb.off': '它的激勵器被提供並停止：在這個聲音上的和聲落在它的呼吸上。',
  'genre.soul.hook': '磁帶、電子管和現場樂隊',
  'genre.soul.story':
    '慢板約 60 至 72 BPM，中速約 88 至 110 BPM。富有旋律的電貝斯與柔和的大鼓，由樂團一起錄到磁帶。60 年代的立體聲混音常將聲部大幅分置左右，原始錄音約為 −12 至 −16 LUFS。',
  'genre.soul.pin.32': '膠帶下方什麼也沒有',
  'genre.soul.pin.32.why': '磁帶時代的唱片頻率幾乎不低於 50 Hz。',
  'genre.soul.pin.80': '旋律低音溫暖',
  'genre.soul.pin.80.why': '承載歌曲的線條。',
  'genre.soul.pin.5000': '沒有空氣',
  'genre.soul.pin.5000.why': '取下來：空氣將磁帶抬起，發出嘶嘶聲。',
  'genre.soul.stage.dimension':
    '一種狹窄的色調，將硬調的 60 年代混音融合在一起。',
  'genre.soul.stage.maximizer': '大師的上限緩慢而不受限制。',
  'genre.soul.off':
    '它的激勵器被提供並停止：磁帶和電子管就是聲音，激勵器發出嘶嘶聲。',
  'genre.neoSoul.hook': '一個充滿活力、醉酒感覺的口袋',
  'genre.neoSoul.story':
    '感覺在 60 到 85 BPM 之間，帶有鬼音、現場貝斯和羅德的落後節奏。故意溫暖、黑暗和復古。',
  'genre.neoSoul.pin.125': '溫暖又圓潤',
  'genre.neoSoul.pin.125.why': '現場貝斯和羅茲。',
  'genre.neoSoul.pin.1250': '深色且光滑',
  'genre.neoSoul.pin.1250.why': '放鬆了所以什麼都沒有戳出來。',
  'genre.neoSoul.pin.12500': '無閃光',
  'genre.neoSoul.pin.12500.why': '溫暖和黑暗是簡短的。',
  'genre.neoSoul.stage.dimension': '現場樂隊的畫面保持不變，只是低音變窄了。',
  'genre.neoSoul.stage.maximizer': '緩慢的天花板不會擠壓任何東西。',
  'genre.neoSoul.off':
    '它的激勵器被提供並停止：沒有激勵器，它就會保持溫暖和黑暗。',
  'genre.funk.hook': '低音是主音，而聲音就是一切',
  'genre.funk.story':
    '100 至 125 BPM 的平直十六分音符，以拍弦貝斯與幽靈音符搭配悶厚的底鼓和緊實的小鼓。聲音乾爽、有力，突出中頻；70 年代的母帶響度約為 −12 至 −16 LUFS。',
  'genre.funk.pin.80': '緊實的低頻貝斯',
  'genre.funk.pin.80.why': '重量不弄髒音符。',
  'genre.funk.pin.500': '關節空間',
  'genre.funk.pin.500.why': '所以每一個巴掌和鬼紙條都會讀到。',
  'genre.funk.pin.2000': '貝斯拍弦與吉他刷弦',
  'genre.funk.pin.2000.why': '讓打擊般的起音更突出。',
  'genre.funk.pin.12500': '磁帶般的高頻，不刻意提亮',
  'genre.funk.pin.12500.why': '柔化高頻，不額外增加亮度。',
  'genre.funk.stage.bassPunch': '緊密的低音端，沒有花哨來玷汙發音。',
  'genre.funk.stage.dimension': '接近歷史紀錄，底部收窄。',
  'genre.funk.stage.maximizer': '淺色天花板。',
  'genre.funk.off':
    '不使用激勵器或 Bass Forge：乾淨俐落、突出的中頻就是這類音樂的特色。',
  'genre.disco.hook': '四拍大鼓，搭配層層弦樂',
  'genre.disco.story':
    '約 122 BPM 的四拍大鼓、開放踩鈸與八度貝斯線，搭配寬廣的弦樂、銅管和和聲人聲。原始母帶約為 −12 至 −16 LUFS。',
  'genre.disco.pin.80': '大鼓的重量感',
  'genre.disco.pin.80.why': '穩定的四拍大鼓。',
  'genre.disco.pin.800': '替弦樂騰出空間',
  'genre.disco.pin.800.why': '稍微減少中頻，讓層疊的聲部更透氣。',
  'genre.disco.pin.8000': '開啟踩鈸和閃光',
  'genre.disco.pin.8000.why': '閃耀著時代的光芒。',
  'genre.disco.stage.bassPunch': '踢腿時有點重，它的尾巴保持在下一拍的位置。',
  'genre.disco.stage.dimension': '樂團已經傳播的內容還沒有擴大。',
  'genre.disco.stage.maximizer': '輕度限制峰值，大鼓之間迅速恢復。',
  'genre.disco.off':
    '沒有激勵器或 Bass Forge：帽子和琴絃在沒有激勵器的情況下會變脆。',
} satisfies Partial<Dictionary>;

export default genreUrban;
