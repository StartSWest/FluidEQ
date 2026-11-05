/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genreReggae = {
  'genre.reggae.hook': '低音線是主奏樂器',
  'genre.reggae.story':
    '其中一首的速度約為 76 BPM：一把厚重的低音吉他，其高音從主音上滾落，在柔和的深底鼓和明亮的斷奏聲中。現場錄製到錄音帶，大部分是單聲道； Marley 的原版 CD 的動態範圍為 14 至 15。',
  'genre.reggae.pin.80': '低音主導',
  'genre.reggae.pin.80.why': '它的重量保持在中間。',
  'genre.reggae.pin.500': '出泥',
  'genre.reggae.pin.500.why': '所以低音線走得很清楚。',
  'genre.reggae.pin.12500': '軟頂',
  'genre.reggae.pin.12500.why': '老式磁帶：沒有什麼可以消除嘶嘶聲。',
  'genre.reggae.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.reggae.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.reggae.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。較慢的釋放時間可避免跟隨每個鼓點起伏。',
  'genre.reggae.off':
    'Bass Forge 已提供並保留：低音帶有自己的泛音。磁帶時代的陀螺儀上沒有激勵器。',
  'genre.dub.hook': '鼓、貝斯與滴奏',
  'genre.dub.story':
    '鼓和低音提琴以 65 至 75 BPM 的速度在前面，其餘部分則透過磁帶迴聲和彈簧混響進出。水滴是成分；記錄保持 9 到 15 的動態範圍。',
  'genre.dub.pin.50': '單聲道子重量',
  'genre.dub.pin.50.why': '裡丁的地板。',
  'genre.dub.pin.500': '迴聲的空間',
  'genre.dub.pin.500.why': '延誤盛行的地方。',
  'genre.dub.pin.8000': '迴聲與春天的光芒',
  'genre.dub.pin.8000.why': '保留了效果的閃光。',
  'genre.dub.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.dub.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.dub.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。較慢的釋放時間可避免跟隨每個鼓點起伏。',
  'genre.dub.off':
    'Bass Forge 已提供並被關閉，沒有激勵器，並且沒有任何東西可以使水滴保持平衡。',
  'genre.dancehall.hook': '808 型重低音喇叭上的數字 Riddims',
  'genre.dancehall.story':
    '自 1985 年以來，數位 Riddim 的速度約為 100 BPM：單聲道 808 或正弦重低音、清脆的打擊樂和人聲前奏。',
  'genre.dancehall.pin.80': '數字子',
  'genre.dancehall.pin.80.why': '單聲道，並且支援。',
  'genre.dancehall.pin.315': '出泥',
  'genre.dancehall.pin.315.why': '聲音的空間。',
  'genre.dancehall.pin.1250': '聲樂前鋒',
  'genre.dancehall.pin.1250.why': '上面是DJ。',
  'genre.dancehall.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.dancehall.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.dancehall.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。',
  'genre.dancehall.off':
    'Bass Forge 被提供並停止，並且清脆的打擊樂沒有激勵器。',
  'genre.ska.hook': '另類的行走貝斯和法國號',
  'genre.ska.story':
    '從第一波的 120 到 150 BPM 到第三波的速度更快，有行走的低音和喇叭下的輕踢，以及明亮的另類臭鼬。 20 世紀 60 年代的唱片以單聲道和磁帶為主。',
  'genre.ska.pin.32': '沒有假子',
  'genre.ska.pin.32.why': '老式唱片下沒有任何發明。',
  'genre.ska.pin.80': '行走的低音',
  'genre.ska.pin.80.why': '擺動的線。',
  'genre.ska.pin.315': '出泥',
  'genre.ska.pin.315.why': '為喇叭留出空間。',
  'genre.ska.pin.2000': '角和臭鼬',
  'genre.ska.pin.2000.why': '另類，明亮。',
  'genre.ska.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.ska.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.ska.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。',
  'genre.ska.off':
    '無激勵器、Bass Punch 或 Bass Forge：在老式錄音下沒有發明低音。',
} satisfies Partial<Dictionary>;

export default genreReggae;
