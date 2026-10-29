/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genreJazzClassical = {
  'genre.jazz.hook': '演奏正在進行中',
  'genre.jazz.story':
    '民謠為 50 至 80 BPM，中等搖擺為 90 至 140，bebop 超過 200：直立低音、羽狀底鼓和踩鈸的空氣，在經典 Blue Note 唱片上強烈平移。爵士樂是所有人擁有的最安靜、最有活力的音樂之一，中位數為 -12.8 LUFS。',
  'genre.jazz.pin.125': '直立低音溫暖',
  'genre.jazz.pin.125.why': '適用於薄型舊轉印的主體。',
  'genre.jazz.pin.1250': '喇叭聲減弱了',
  'genre.jazz.pin.1250.why': '喇叭和鋼琴給了空間，沒有幫助。',
  'genre.jazz.pin.12500': '鈸的空氣',
  'genre.jazz.pin.12500.why': '套件頂部開啟。',
  'genre.jazz.stage.dimension':
    '燈罩較窄，將 20 世紀 50 年代的立體聲效果融入耳機中。',
  'genre.jazz.stage.maximizer': '在整個節拍上，天花板只觸及一個雜散的山峰。',
  'genre.jazz.off':
    '它的激勵器被提供並停止：新增和聲、彩色號角和鋼琴的聲音。沒有任何東西可以壓縮、加寬或產生低音。',
  'genre.smoothJazz.hook': '特意打造光澤、柔軟',
  'genre.smoothJazz.story':
    '90 至 105 BPM 的直接 R&B 十六分之一，光滑的寬立體聲，前面有薩克斯風或吉他，在軟頂上。',
  'genre.smoothJazz.pin.80': '溫暖的底部',
  'genre.smoothJazz.pin.80.why': '電貝司，圓形。',
  'genre.smoothJazz.pin.2000': '薩克斯上沒有存在感',
  'genre.smoothJazz.pin.2000.why': '放鬆，使鉛保持柔軟。',
  'genre.smoothJazz.pin.12500': '有光澤的上衣',
  'genre.smoothJazz.pin.12500.why': '工作室的光澤，得以保留。',
  'genre.smoothJazz.stage.dimension': '光滑的立體聲混合在一起，只有低音變窄。',
  'genre.smoothJazz.stage.maximizer': '緩慢的天花板。',
  'genre.smoothJazz.off':
    '它的 Exciter 被提供並停止，並且沒有 Bass Punch：這種型別是故意柔和的。',
  'genre.fusion.hook': '電動、明亮、精湛',
  'genre.fusion.story':
    '90 至 180 BPM 的奇怪米數的搖滾和放克節奏，電音和無品貝斯和合成器，以及加花和齊奏是重點。 70 年代的記錄為 -13 至 -17 LUFS。',
  'genre.fusion.pin.80': '貝斯和大鼓',
  'genre.fusion.pin.80.why': '凹槽的地板。',
  'genre.fusion.pin.315': '出泥',
  'genre.fusion.pin.315.why': '快速奔跑的空間。',
  'genre.fusion.pin.12500': '明亮，如記錄',
  'genre.fusion.pin.12500.why': '這些記錄都是頂級的。',
  'genre.fusion.stage.dimension': '多音軌在錄製時傳播，只有低音變窄。',
  'genre.fusion.stage.maximizer': '緩慢的天花板讓填充物不受幹擾。',
  'genre.fusion.off':
    '無激勵器、Bass Punch 或 Bass Forge：不會為產生自己諧波的樂器新增任何內容。',
  'genre.blues.hook': '原始和中鋒',
  'genre.blues.story':
    '慢速 12/8 為 60 至 75 BPM，隨機播放為 90 至 140，有行走的低音和過載的聲音。經典唱片是單聲道的，母帶大小為 -12 至 -16 LUFS。',
  'genre.blues.pin.50': '沒有假子',
  'genre.blues.pin.50.why': '留在舊記錄下。',
  'genre.blues.pin.200': '薄轉印體',
  'genre.blues.pin.200.why': '舊唱片失去的溫暖。',
  'genre.blues.pin.5000': '原始，不明亮',
  'genre.blues.pin.5000.why': '頂部緩和了。',
  'genre.blues.stage.dimension': '縮小的陰影；單聲道唱片保持單聲道。',
  'genre.blues.stage.maximizer': '緩慢的天花板。',
  'genre.blues.off':
    '它的激勵器被提供並停止：過載是聲音，並且沒有新增任何東西。',
  'genre.classical.hook': '大廳是錄音室',
  'genre.classical.story':
    '在大廳裡用一棵 Decca 樹或一對間隔的樹錄製的音樂，最多以半分貝的壓縮排行母帶處理。古典錄音的音域為 −16 至 −20 LUFS，範圍為 15 至 20 LU，是所有流派中動態範圍最廣的。',
  'genre.classical.pin.80': '底層大廳的觸感',
  'genre.classical.pin.80.why': '透過中間的傾斜來支付。',
  'genre.classical.pin.800': '中間緩和了',
  'genre.classical.pin.800.why': '因此兩端的電梯不會增加響度。',
  'genre.classical.pin.12500': '大廳的空氣',
  'genre.classical.pin.12500.why': '進行錄音的空間。',
  'genre.classical.stage.maximizer':
    '只有一個天花板，具有任何型別中最長的前瞻和發布，因此漸強永遠不會被它所抑制。',
  'genre.classical.off':
    '根本沒有維度：大廳就是錄音。其 Exciter 和 Bass Punch 已提供並保留。',
  'genre.orchestra.hook': '完整保留管絃樂團的動態',
  'genre.orchestra.story':
    '一個完整的管絃樂團在寬廣、深邃的大廳裡，以 −18 至 −23 LUFS 錄製，音域為 15 至 25 LU。罕見的合奏峰、定音鼓和低音鼓，奠定了整個錄音的水平。',
  'genre.orchestra.pin.125': '低音提琴和定音鼓，未抬起',
  'genre.orchestra.pin.125.why': '抬起的定音鼓捲只會推動天花板。',
  'genre.orchestra.pin.800': '擁堵有所緩解',
  'genre.orchestra.pin.800.why': '完整部分堆積的地方。',
  'genre.orchestra.pin.12500': '大廳的空氣',
  'genre.orchestra.pin.12500.why': '管絃樂團周圍的空間。',
  'genre.orchestra.stage.maximizer':
    '只有一個上限，具有任何型別中最長的前瞻和發布，因此永遠不會泵送合奏。',
  'genre.orchestra.off':
    'No Dimension、Exciter、Bass Punch 或 Bass Forge：沒有任何東西可以增強定音鼓過載的低音。',
  'genre.opera.hook': '已經可以在管絃樂團中演奏的聲音',
  'genre.opera.story':
    '歌手的共振峰約為 2.4 至 3.1 kHz，是在沒有麥克風的情況下透過管絃樂團傳送聲音的共振峰。歌劇錄音位於 -18 至 -23 LUFS，頂部音符非常響亮。',
  'genre.opera.pin.315': '管絃樂團的泥巴',
  'genre.opera.pin.315.why': '遠離聲音。',
  'genre.opera.pin.800': '聲音的本體',
  'genre.opera.pin.800.why': '向前一點。',
  'genre.opera.pin.3150': '共振峰單獨留下',
  'genre.opera.pin.3150.why': '它已經計劃了；舉起它會使聲音變得尖銳。',
  'genre.opera.stage.maximizer': '只有輕質天花板：沒有任何東西可以壓縮聲音。',
  'genre.opera.off':
    '無維度、激勵器或 Bass Punch：沒有任何東西可以拓寬、激勵或重塑聲音。',
  'genre.piano.hook': '最具啟發性的來源之一是',
  'genre.piano.story':
    '從 27.5 Hz 的 A0 到 C8，一臺儀器涵蓋了整個範圍，在 -16 至 -20 LUFS 處記錄並具有高峰值。限制器使音錘變平並提升衰減，和聲將和絃變成沙礫。',
  'genre.piano.pin.125': '重量在左手',
  'genre.piano.pin.125.why': '低音弦的琴身。',
  'genre.piano.pin.315': '近距離拾音的四四方方',
  'genre.piano.pin.315.why': '音板，不是蓋子。',
  'genre.piano.pin.5000': '錘子的攻擊',
  'genre.piano.pin.5000.why': '註釋開始的地方。',
  'genre.piano.stage.maximizer': '只有一個天花板。',
  'genre.piano.off':
    '無尺寸、激勵器或 Bass Punch：沒有任何東西可以使鋼琴飽和或重塑。',
  'genre.strings.hook': '諧波已經很豐富了',
  'genre.strings.story':
    '從低音提琴到小提琴的弓弦，在其自然的合奏畫面中，平滑且輕快，在-16至-22 LUFS。它們已經具有豐富的和聲，並且增加了存在感，並且變得刺耳。',
  'genre.strings.pin.200': '大提琴與貝斯琴體',
  'genre.strings.pin.200.why': '低段的溫暖。',
  'genre.strings.pin.2000': '沒有存在',
  'genre.strings.pin.2000.why': '取下來：弓弦在這裡變得刺耳。',
  'genre.strings.pin.12500': '截面周圍的空氣',
  'genre.strings.pin.12500.why': '弓樓上方的大廳。',
  'genre.strings.stage.maximizer': '只有一個天花板。',
  'genre.strings.off': '無維度，無激勵器：激勵器使弓弦變得刺耳。',
} satisfies Partial<Dictionary>;

export default genreJazzClassical;
