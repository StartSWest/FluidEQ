/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genreCountry = {
  'genre.country.hook': '首先是歌詞',
  'genre.country.story':
    '兩步、洗牌和華爾茲，節奏為 70 至 130 BPM，原聲底鼓和電貝司，人聲居中，歌詞在前。傳統的唱片自然而乾淨，而母帶文獻要求在它們之上有一點和諧的生活。',
  'genre.country.pin.125': '沒有低音炒作',
  'genre.country.pin.125.why': '幾乎沒有觸及：國家從來都不是建立在低端的。',
  'genre.country.pin.500': '聲音裡充滿了箱音',
  'genre.country.pin.500.why': '所以這位歌手聽起來很親近，而不是被困住了。',
  'genre.country.pin.3150': '歌詞清晰，',
  'genre.country.pin.3150.why': '存在於子音處。',
  'genre.country.stage.exciter': '子音的存在和絃樂上的空氣八度，都很輕。',
  'genre.country.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.country.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.country.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。',
  'genre.country.off': '無 Bass Punch 或 Bass Forge：大鼓和低音保持原樣演奏。',
  'genre.modernCountry.hook': '流行音樂製作中使用鋼吉他',
  'genre.modernCountry.story':
    '75 至 125 BPM 下的音色優美而明亮，低音區充滿了 808 風格的底鼓，聲音居中，兩側因高頻而變寬。大師的動態範圍為 5 到 6。',
  'genre.modernCountry.pin.125': '808式踢球',
  'genre.modernCountry.pin.125.why': '現代低端生活的地方。',
  'genre.modernCountry.pin.500': '中低頻已清除',
  'genre.modernCountry.pin.500.why': '聲音和鋼吉他的空間。',
  'genre.modernCountry.pin.3150': '語音存在',
  'genre.modernCountry.pin.3150.why': '抬起一點，觀察是否刺耳。',
  'genre.modernCountry.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.modernCountry.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.modernCountry.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。',
  'genre.modernCountry.off':
    '沒有產生任何內容：在 808 下沒有已填充子的激勵器、Bass Punch 或 Bass Forge。',
  'genre.americana.hook': '一個房間裡有一支樂隊，剩下的動力',
  'genre.americana.story':
    '根音樂為 60 至 130 BPM，輕質或拉絲套件和立式或電貝司，樂隊一起錄製並經常錄製成磁帶。記錄保持 7 到 12 的動態範圍。',
  'genre.americana.pin.125': '溫暖的直立式低音',
  'genre.americana.pin.125.why': '房間裡樂隊的圓形底部。',
  'genre.americana.pin.800': '一間四四方方的房間',
  'genre.americana.pin.800.why': '所以房間聽起來很開放。',
  'genre.americana.pin.3150': '聲音',
  'genre.americana.pin.3150.why': '向前一點。',
  'genre.americana.stage.exciter': '溫暖，還有琴絃上的一絲空氣。',
  'genre.americana.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.americana.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.americana.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。較慢的釋放時間可避免跟隨每個鼓點起伏。',
  'genre.americana.off':
    '沒有 Bass Punch 或 Bass Forge：沒有任何東西可以重塑拉絲套件或立式貝斯。',
  'genre.bluegrass.hook': '沒有鼓：撥弦就是節奏',
  'genre.bluegrass.story':
    '班卓琴、曼陀林、小提琴、吉他和直立式貝斯，從接近 50 BPM 的民謠到超過 130 BPM 的分解。完全沒有鼓：立式貝斯是整個底部，撥片起音是節拍。',
  'genre.bluegrass.pin.80': '立式貝斯是底部',
  'genre.bluegrass.pin.80.why': '其下沒有新增任何內容。',
  'genre.bluegrass.pin.5000': '班卓琴與曼陀林的輝煌',
  'genre.bluegrass.pin.5000.why': '採摘閃閃發光的地方。',
  'genre.bluegrass.pin.12500': '空氣在琴絃上',
  'genre.bluegrass.pin.12500.why': '樂團周圍的房間。',
  'genre.bluegrass.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.bluegrass.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.bluegrass.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。較慢的釋放時間可避免跟隨每個鼓點起伏。',
  'genre.bluegrass.off':
    '沒有 Bass Punch 或 Bass Forge：無需塑造大鼓，也無需發明重低音。',
  'genre.folk.hook': '簡約自然',
  'genre.folk.story':
    '在自然的房間裡，人聲和吉他的速度為 60 至 130 BPM，通常是自由節奏。民謠母帶本身以半分貝的音調工作，並新增百分之一或百分之二的和聲；此預設的作用相同。',
  'genre.folk.pin.200': '吉他的琴體',
  'genre.folk.pin.200.why': '音板的溫暖。',
  'genre.folk.pin.3150': '溫柔的存在',
  'genre.folk.pin.3150.why': '聲音又近了一些。',
  'genre.folk.pin.12500': '空氣',
  'genre.folk.pin.12500.why': '7 kHz 以上，輕微。',
  'genre.folk.stage.exciter':
    '接近 2 kHz 的柔和存在，高於 7 kHz 的空氣，以及民間母帶使用的一小部分和聲。',
  'genre.folk.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.folk.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.folk.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。較慢的釋放時間可避免跟隨每個鼓點起伏。',
  'genre.folk.off': '沒有 Bass Punch 或 Bass Forge：人聲和吉他上沒有低音炒作。',
  'genre.acoustic.hook': '吉他的琴身與琴絃',
  'genre.acoustic.story':
    '原聲吉他，60 至 130 BPM，無底鼓，以立體聲對錄製。它想要的是馴服曲目、緩解 4 至 6 kHz 鋼弦的脆性以及 10 kHz 以上的空氣架。',
  'genre.acoustic.pin.32': '繁榮緩和',
  'genre.acoustic.pin.32.why': '近距離麥克風會增加低沉的聲音。',
  'genre.acoustic.pin.5000': '鋼弦脆性得到控制',
  'genre.acoustic.pin.5000.why': '一條讓耳朵感到疲勞的帶子。',
  'genre.acoustic.pin.12500': '空氣架子',
  'genre.acoustic.pin.12500.why': '高於 10 kHz，琴絃會閃爍。',
  'genre.acoustic.stage.exciter': '琴體位於音板處，空氣頻率高於 10 kHz。',
  'genre.acoustic.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.acoustic.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.acoustic.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。較慢的釋放時間可避免跟隨每個鼓點起伏。',
  'genre.acoustic.off':
    '它的 Bass Punch 設定檔已提供並保留：吉他沒有底鼓形狀。',
  'genre.singerSongwriter.hook': '一種聲音、一種樂器，親密無間',
  'genre.singerSongwriter.story':
    '用吉他或鋼琴演奏的聲音，60 到 120 BPM，通常是自由節奏，居中且接近。這些唱片比大多數唱片都安靜，中位數為-10.6 LUFS：親密和動態就是全部。',
  'genre.singerSongwriter.pin.80': '沒有低音炒作',
  'genre.singerSongwriter.pin.80.why': '被聲音和吉他壓低。',
  'genre.singerSongwriter.pin.2000': '聲音親近而清晰',
  'genre.singerSongwriter.pin.2000.why': '言語在哪裡。',
  'genre.singerSongwriter.pin.12500': '溫柔的空氣',
  'genre.singerSongwriter.pin.12500.why': '聲音之上有一絲呼吸。',
  'genre.singerSongwriter.stage.exciter': '只有身體，沒有齒音上的和聲。',
  'genre.singerSongwriter.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.singerSongwriter.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.singerSongwriter.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。較慢的釋放時間可避免跟隨每個鼓點起伏。',
  'genre.singerSongwriter.off':
    '沒有 Bass Punch 或 Bass Forge：沒有任何東西會擠滿聲音和一臺樂器。',
} satisfies Partial<Dictionary>;

export default genreCountry;
