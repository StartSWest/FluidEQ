/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genreWorld = {
  'genre.afrobeat.hook': '大型現場樂團演奏綿延的律動',
  'genre.afrobeat.story':
    'Fela 的非洲節拍為 105 至 135 BPM：重複的低音節奏、托尼艾倫的切分音踢腿、忙碌的帽子、喇叭下的謝克瑞舞和康加舞。 20 世紀 70 年代的原版動態範圍為 11 至 16。',
  'genre.afrobeat.pin.80': '大鼓與貝斯音型',
  'genre.afrobeat.pin.80.why': '凹槽的底板。',
  'genre.afrobeat.pin.315': '大樂隊中的空間',
  'genre.afrobeat.pin.315.why': '出泥。',
  'genre.afrobeat.pin.800': '號角和管風琴',
  'genre.afrobeat.pin.800.why': '保留豐富中頻的核心特色。',
  'genre.afrobeat.pin.3150': '柔軟的 70 年代上衣',
  'genre.afrobeat.pin.3150.why': '柔化這個區域，呈現類比母帶的音色。',
  'genre.afrobeat.stage.exciter': '替類比母帶增添暖度與少許空氣感。',
  'genre.afrobeat.stage.bassPunch': '讓低頻稍微更緊實。',
  'genre.afrobeat.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.afrobeat.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.afrobeat.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。較慢的釋放時間可避免跟隨每個鼓點起伏。',
  'genre.afrobeat.off':
    '沒有 Bass Forge，也沒有任何東西會擠壓樂團：它的上限只會卡住。',
  'genre.afrobeats.hook': '圓踢和正弦子',
  'genre.afrobeats.story':
    '大約 110 BPM：圓形、溫暖的底鼓和正弦重低音喇叭，新唱片中的原木鼓，單聲道和振動器寬範圍內 100 到 150 Hz 以下的所有內容。',
  'genre.afrobeats.pin.50': '溫暖的正弦子',
  'genre.afrobeats.pin.50.why': '單聲道，並且從未加寬。',
  'genre.afrobeats.pin.800': '房間在中間',
  'genre.afrobeats.pin.800.why': '鞦韆的空間。',
  'genre.afrobeats.pin.12500': '搖搖器和聲樂空氣',
  'genre.afrobeats.pin.12500.why': '輕，在上面。',
  'genre.afrobeats.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.afrobeats.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.afrobeats.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。',
  'genre.afrobeats.off':
    'Bass Forge 已提供並保留：正弦重低音喇叭是乾淨的，不需要八度音階或沙礫。',
  'genre.amapiano.hook': '原木鼓就是能量',
  'genre.amapiano.story':
    '大約 113 BPM：原木鼓是一種高音的打擊貝斯，其起音是能量，在爵士鋼琴、寬大的打擊墊和明亮的振動器的作用下。',
  'genre.amapiano.pin.125': '原木鼓的主體',
  'genre.amapiano.pin.125.why': '100 至 200 Hz，居中。',
  'genre.amapiano.pin.500': '中低泥漿輸出',
  'genre.amapiano.pin.500.why': '爵士鋼琴的房間。',
  'genre.amapiano.pin.8000': '明亮的搖瓶',
  'genre.amapiano.pin.8000.why': '一點電梯。',
  'genre.amapiano.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.amapiano.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.amapiano.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。',
  'genre.amapiano.off':
    'Bass Forge 已提供並保留：原木鼓的唯一規則是其上不飽和。',
  'genre.highlife.hook': '甜美的吉他和爵士號',
  'genre.highlife.story':
    '100 至 130 BPM 的鈴聲模式：互鎖的吉他，乾淨而甜美，爵士樂和旋律貝斯。較舊的記錄的動態範圍為 10 到 13。',
  'genre.highlife.pin.80': '旋律貝斯',
  'genre.highlife.pin.80.why': '一點溫暖。',
  'genre.highlife.pin.315': '出泥',
  'genre.highlife.pin.315.why': '吉他的空間。',
  'genre.highlife.pin.3150': '甜美的吉他',
  'genre.highlife.pin.3150.why': '清晰明亮。',
  'genre.highlife.stage.exciter': '為舊錄音帶來一點溫暖和空氣。',
  'genre.highlife.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.highlife.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.highlife.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。較慢的釋放時間可避免跟隨每個鼓點起伏。',
  'genre.highlife.off': '無 Bass Punch 或 Bass Forge：乾淨的吉他保持乾淨。',
  'genre.world.hook': '鏈條至少能做到的',
  'genre.world.story':
    '以各種方式錄製的錄音，其中包括單聲道現場錄音，其音色是西方參考文獻所不知道的。該研究的建議是不要強加任何東西。',
  'genre.world.pin.32': '下面幾乎什麼都沒有',
  'genre.world.pin.32.why': '按記錄留下。',
  'genre.world.pin.3150': '為了清晰起見，稍微抬起了一點',
  'genre.world.pin.3150.why': '一個分貝以下。',
  'genre.world.pin.12500': '一點空氣',
  'genre.world.pin.12500.why': '溫柔。',
  'genre.world.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.world.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。較慢的釋放時間可避免跟隨每個鼓點起伏。',
  'genre.world.off': '無尺寸、激勵器、Bass Punch 或 Bass Forge：圖片保持原樣。',
  'genre.bollywood.hook': '播放聲音周圍鬱鬱蔥蔥的背景',
  'genre.bollywood.story':
    '民謠為 70 至 95 BPM，舞曲為 110 至 140：豐富的電影背景、五個混響和四個深度延遲，圍繞著中心回放人聲。現代舞的曲目低音且響亮。',
  'genre.bollywood.pin.80': '舞曲貝斯',
  'genre.bollywood.pin.80.why': '緊，而不是轟隆隆。',
  'genre.bollywood.pin.315': '背景下的泥漿',
  'genre.bollywood.pin.315.why': '聲音的空間。',
  'genre.bollywood.pin.2000': '播放聲音',
  'genre.bollywood.pin.2000.why': '前進並清潔。',
  'genre.bollywood.stage.bassPunch': '潛艇收緊了。',
  'genre.bollywood.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.bollywood.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.bollywood.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。',
  'genre.bollywood.off': '聲音上沒有激勵器，也沒有 Bass Forge。',
  'genre.bhangra.hook': 'dhol 是一種流派',
  'genre.bhangra.story':
    '在 90 到 110 BPM 時，dhol 厚重的轟鳴聲和高音在 tumbi 和向前的聲音下破裂。 dhol 的攻擊就是音樂。',
  'genre.bhangra.pin.50': 'dhol 的繁榮',
  'genre.bhangra.pin.50.why': '緊，從未抬起。',
  'genre.bhangra.pin.500': '出泥',
  'genre.bhangra.pin.500.why': '裂縫的空間。',
  'genre.bhangra.pin.2000': 'Dhol 裂縫和 tumbi',
  'genre.bhangra.pin.2000.why': '明亮有力。',
  'genre.bhangra.stage.bassPunch': '吊桿尾部收緊，從未抬起。',
  'genre.bhangra.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.bhangra.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.bhangra.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。',
  'genre.bhangra.off': '無激勵器或 Bass Forge：未新增頂部。',
  'genre.indianClassical.hook': '無人機上空未計時的一圈',
  'genre.indianClassical.story':
    '在 tanpura 嗡嗡聲和塔布拉鼓上進行不計節奏的拍打，從緩慢的 vilambit 到超過 300 BPM 的 drut。 jivari 琴橋將和聲建構到西塔琴和 tanpura 中，並且錄音被輕微壓縮為 -14 至 -20 LUFS。',
  'genre.indianClassical.pin.125': '巴揚按演奏離開',
  'genre.indianClassical.pin.125.why': '它的彎音就是音樂。',
  'genre.indianClassical.pin.800': '獨奏者的身體',
  'genre.indianClassical.pin.800.why': '人聲或西塔琴，稍微向前一點。',
  'genre.indianClassical.pin.12500': 'tanpura 的微光',
  'genre.indianClassical.pin.12500.why': '無人機的光環。',
  'genre.indianClassical.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。較慢的釋放時間可避免跟隨每個鼓點起伏。',
  'genre.indianClassical.off':
    '無尺寸、激勵器或 Bass Punch：jivari 的諧波是內建的。',
  'genre.arabicPop.hook': '馬克蘇姆上的裝飾聲音',
  'genre.arabicPop.story':
    '民謠的節奏為 70 至 90 BPM，舞蹈的節奏為 95 至 130 BPM，使用 maqsum 的 doum 和 tek（一種混響的裝飾聲音、寬弦樂、qanun 和 oud）。',
  'genre.arabicPop.pin.80': '杜姆和低音，緊',
  'genre.arabicPop.pin.80.why': '節奏的低端。',
  'genre.arabicPop.pin.500': '出泥',
  'genre.arabicPop.pin.500.why': '聲音的空間。',
  'genre.arabicPop.pin.1250': '聲音向前',
  'genre.arabicPop.pin.1250.why': '飾物清晰。',
  'genre.arabicPop.pin.5000': '琴絃未變亮',
  'genre.arabicPop.pin.5000.why': '已經亮了',
  'genre.arabicPop.stage.exciter':
    '聲音下的溫暖；琴絃和泰克仍然像原來一樣明亮。',
  'genre.arabicPop.stage.bassPunch': '低端收緊。',
  'genre.arabicPop.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.arabicPop.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.arabicPop.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。',
  'genre.arabicPop.off': '沒有 Bass Forge：在 doum 下沒有產生任何內容。',
  'genre.turkishPop.hook': '拋光流行土耳其色',
  'genre.turkishPop.story':
    '約 90 至 130 BPM，有時為 9/8：底鼓、低音和 darbuka 在弦樂、bağlama 和單簧管下的低音擊打。拋光、光亮；現代專輯的動態範圍為 5 至 6。',
  'genre.turkishPop.pin.80': '緊實的底部',
  'genre.turkishPop.pin.80.why': '大鼓與達布卡鼓。',
  'genre.turkishPop.pin.315': '出泥',
  'genre.turkishPop.pin.315.why': '聲音的空間。',
  'genre.turkishPop.pin.1250': '讓人聲清晰突出',
  'genre.turkishPop.pin.1250.why': '在前面。',
  'genre.turkishPop.pin.8000': '不額外增加亮度',
  'genre.turkishPop.pin.8000.why': '原本就已經過細緻處理。',
  'genre.turkishPop.stage.exciter': '聲音裡充滿了溫暖，達爾布卡上什麼都沒有。',
  'genre.turkishPop.stage.bassPunch': '緊實的低頻。',
  'genre.turkishPop.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.turkishPop.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.turkishPop.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。',
  'genre.turkishPop.off': '這張經過打磨的唱片上沒有 Bass Forge。',
  'genre.gospel.hook': '合唱團和幾分鐘就能打造的鞋面',
  'genre.gospel.story':
    '民謠的節奏為 60 至 80 BPM，讚美詩的節奏為 110 至 130：低音 B 的繁忙電貝斯、哈蒙德風琴以及主唱和寬合唱團的現場演奏。鞋面會持續幾分鐘。',
  'genre.gospel.pin.80': '活躍的貝斯與大鼓',
  'genre.gospel.pin.80.why': '帶動樂團的節奏核心。',
  'genre.gospel.pin.315': '合唱團和哈蒙德出泥漿',
  'genre.gospel.pin.315.why': '替飽滿的聲音保留空間。',
  'genre.gospel.pin.2000': '主唱人聲',
  'genre.gospel.pin.2000.why': '讓人聲更靠前。',
  'genre.gospel.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.gospel.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.gospel.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。較慢的釋放時間可避免跟隨每個鼓點起伏。',
  'genre.gospel.off': '它的激勵器被提供並停止：合唱團沒有興奮。',
  'genre.christian.hook': '安靜的詩句築起一座大橋',
  'genre.christian.story':
    '以 75 至 115 BPM 的速度崇拜流行搖滾：安靜的詩句構建出一座大橋，歌詞清晰，環境吉他已經非常寬廣。',
  'genre.christian.pin.80': '流行搖滾低端',
  'genre.christian.pin.80.why': '大鼓和貝斯。',
  'genre.christian.pin.800': '房間在中間',
  'genre.christian.pin.800.why': '對於寬吉他。',
  'genre.christian.pin.3150': '歌詞清晰，',
  'genre.christian.pin.3150.why': '言語在哪裡。',
  'genre.christian.stage.dimension':
    '保持此曲風在各頻段的立體聲寬度平衡，不對中央人聲加入去相關處理。',
  'genre.christian.stage.deEsser':
    '以5至10 kHz範圍內最高1.5 dB的窄帶頻譜衰減，控制中央人聲刺耳的S和SH音，保護鈸片並保持低音不變。',
  'genre.christian.stage.maximizer':
    '將正規化後的輸入提升至此曲風實測的聆聽音量，峰值限制在 −1 dBTP。限制保持適度，以保留錄音的動態；Master 和 Dynamics 維持關閉。較慢的釋放時間可避免跟隨每個鼓點起伏。',
  'genre.christian.off': 'No Exciter、Bass Punch 或 Bass Forge：建構就是歌曲。',
} satisfies Partial<Dictionary>;

export default genreWorld;
