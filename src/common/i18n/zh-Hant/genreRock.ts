/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genreRock = {
  'genre.rock.hook': '大鼓和小鼓完好無損，吉他被平移',
  'genre.rock.story':
    '吉他樂團的節奏為 110 至 140 BPM，吉他左、右加倍，聲音位於中間。失真已經使吉他的和聲產生了，因此播放時唱片需要的是完整的底鼓和軍鼓以及無法取消的底部。',
  'genre.rock.pin.80': '大鼓和貝斯吉他',
  'genre.rock.pin.80.why': '反拍的重量。',
  'genre.rock.pin.315': '吉他變成泥的地方',
  'genre.rock.pin.315.why': '一堵扭曲的吉他牆在這裡堆積起來，所以它倒塌了。',
  'genre.rock.pin.3150': '吉他的咬合',
  'genre.rock.pin.3150.why': '挑攻擊和邊緣，向前一點。',
  'genre.rock.pin.12500': '單獨放置鈸',
  'genre.rock.pin.12500.why': '扭曲已經充滿了頂部。',
  'genre.rock.stage.bassPunch':
    '底鼓保持其自身的打擊力，其尾部在低音吉他下方縮短。',
  'genre.rock.stage.dimension': '低音在160Hz以下收窄；堅硬的吉他原封未動。',
  'genre.rock.stage.maximizer': '天花板很輕，速度夠快，可以進行反拍。',
  'genre.rock.off':
    '它的 Exciter 和 Bass Forge 提供並保留：失真吉他產生自己的和聲，而低音吉他有真正的底部。',
  'genre.popRock.hook': '搖滾樂團，聲音在前面',
  'genre.popRock.story':
    '自披頭四以來，為電臺創作的搖滾樂：現場演奏組和鋼琴下的低音吉他，原聲吉他和乾淨的電吉他，歌手和掛鉤在前面。 Fleetwood Mac 將其製成專輯形式； Coldplay、The Killers、Maroon 5 和 Imagine Dragons 使其成為了一場舞臺表演。現在的 CD 已經和流行音樂一樣精緻了，動態範圍為 4 到 7，而且已經很明亮了。',
  'genre.popRock.pin.32': '貝斯吉他，不是 808',
  'genre.popRock.pin.32.why': '真實樂器下沒有發明重低音。',
  'genre.popRock.pin.80': '大鼓和低音吉他',
  'genre.popRock.pin.80.why': '樂隊所站立的音符。',
  'genre.popRock.pin.315': '比 Rock 更輕鬆的清理',
  'genre.popRock.pin.315.why': '鋼琴和乾淨的吉他不會像失真牆那樣變成泥土。',
  'genre.popRock.pin.3150': '聲音和鉤子',
  'genre.popRock.pin.3150.why': '歌曲所居住的地方，被提出。',
  'genre.popRock.stage.bassPunch':
    '保持大鼓的打擊力並在移動的低音線下縮短其尾部。',
  'genre.popRock.stage.dimension':
    '低音在150Hz以下收窄；吉他留在混音放置的地方。',
  'genre.popRock.stage.maximizer': '僅捕獲峰值並在十六分音符內釋放。',
  'genre.popRock.off':
    '已經很明亮的聲音上沒有激勵器，真正的低音吉他下也沒有 Bass Forge。',
  'genre.classicRock.hook': '無需點選即可暢玩，有喘息的空間',
  'genre.classicRock.story':
    '樂團在同一個空間錄音，速度約 110 至 140 BPM，不跟節拍器，直接錄到磁帶。60 年代的混音常將聲部大幅分置左右，70 年代則較自然。原始 CD 約為 −18 至 −13 LUFS，動態範圍有 11 至 14；許多重製版已失去這些動態。',
  'genre.classicRock.pin.32': '磁帶從未有過的子項',
  'genre.classicRock.pin.32.why': '左下：這些記錄從未在那裡建立。',
  'genre.classicRock.pin.125': '溫暖的低音',
  'genre.classicRock.pin.125.why': '原件的圓形低端。',
  'genre.classicRock.pin.3150': '溫柔的上衣',
  'genre.classicRock.pin.3150.why': '緩和了，正如原曲聽起來那樣。',
  'genre.classicRock.stage.exciter':
    '有點中低溫暖，磁帶的聲音，頂部沒有任何東西。',
  'genre.classicRock.stage.dimension':
    '色調更窄，將 60 年代的硬調混音在耳機上融合在一起。',
  'genre.classicRock.stage.maximizer': '緩慢的天花板保持了原作的動態。',
  'genre.classicRock.off':
    '無 Bass Punch 或 Bass Forge：寬敞的大鼓和磁帶溫暖的低音保持錄製時的狀態。',
  'genre.alternativeRock.hook': '同一首歌大聲安靜',
  'genre.alternativeRock.story':
    '主歌與副歌的對比是這種形式，在 90 到 150 BPM 之間，在硬平底吉他上有過載的低音和法茲。 90 年代末的母帶是迄今為止發布的剪輯最多的母帶之一，動態範圍為 4。',
  'genre.alternativeRock.pin.125': '過載低音重量',
  'genre.alternativeRock.pin.125.why': '身體下面長滿絨毛。',
  'genre.alternativeRock.pin.500': '模糊泥漿',
  'genre.alternativeRock.pin.500.why': '清理乾淨，使吉他保持分開。',
  'genre.alternativeRock.pin.3150': '吉他的邊緣',
  'genre.alternativeRock.pin.3150.why': '絨毛穿過的地方。',
  'genre.alternativeRock.pin.8000': '頂部有一個陰影',
  'genre.alternativeRock.pin.8000.why': '它軟化了 90 年代大師剪裁的粗糙感。',
  'genre.alternativeRock.stage.bassPunch': '踢擊繼續，尾巴也縮短了。',
  'genre.alternativeRock.stage.dimension': '低音變窄，吉他離開了平移的位置。',
  'genre.alternativeRock.stage.maximizer':
    '天花板幾乎無法驅動，因此大聲的部分比安靜的部分更響亮。',
  'genre.alternativeRock.off':
    '沒有激勵器，也沒有 Bass Forge：法茲產生自己的和聲。',
  'genre.indieRock.hook': '房間裡的現場套件，溫暖而黑暗',
  'genre.indieRock.story':
    '樂團在房間裡現場錄製，節奏為 100 到 140 BPM，通常透過錄音帶錄製，溫暖且刻意黑暗。房間就是記錄。',
  'genre.indieRock.pin.50': '沒有低音炒作',
  'genre.indieRock.pin.50.why': '阻礙：房間套件具有自身重量。',
  'genre.indieRock.pin.1250': '房間裡的吉他和聲音',
  'genre.indieRock.pin.1250.why': '樂隊聽起來像樂隊。',
  'genre.indieRock.pin.8000': '根據記錄，溫暖和黑暗',
  'genre.indieRock.pin.8000.why': '頂部保持柔軟。',
  'genre.indieRock.stage.dimension': '房間本身的寬度，只有底部變窄了。',
  'genre.indieRock.stage.maximizer': '輕盈的天花板，可在十六分音符內釋放。',
  'genre.indieRock.off':
    '無激勵器、Bass Punch 或 Bass Forge：沒有任何東西可以塑造鼓或為房間增添色彩。',
  'genre.progressiveRock.hook': '近乎沉默的長作品',
  'genre.progressiveRock.story':
    '奇怪的米和變化的節奏，旋律低音和穆格低音，細節平移並記錄全音域。記錄的動態範圍為 10 到 14。',
  'genre.progressiveRock.pin.125': '穆格和低音低音',
  'genre.progressiveRock.pin.125.why': '長期建構的基礎。',
  'genre.progressiveRock.pin.800': '中間的房間有詳細資訊',
  'genre.progressiveRock.pin.800.why': '放鬆，使各層保持分開。',
  'genre.progressiveRock.pin.12500': '全音域高傳真頂級音響',
  'genre.progressiveRock.pin.12500.why': '這些唱片所用的空氣。',
  'genre.progressiveRock.stage.dimension':
    '這張圖片混合在低音之上，帶有一絲深度。',
  'genre.progressiveRock.stage.maximizer':
    '搖滾家族中最長的前瞻和完整的釋放節拍：它只觸及高潮。',
  'genre.progressiveRock.off':
    '無激勵器、Bass Punch 或 Bass Forge：沒有任何快速調整安靜通道。',
  'genre.hardRock.hook': '直播間裡的一腳大踢',
  'genre.hardRock.story':
    'Boogie 和 shuffle 的節奏為 90 至 145 BPM，寬敞的空間充滿強烈的大鼓和節奏，左右搖晃吉他上的閥門嘎吱聲。經典唱片的動態範圍為13；現代的聲音要大得多。',
  'genre.hardRock.pin.80': '大踢',
  'genre.hardRock.pin.80.why': '它的重量，保留下來。',
  'genre.hardRock.pin.315': '中低頻收緊',
  'genre.hardRock.pin.315.why': '由於流派是混合的。',
  'genre.hardRock.pin.3150': '閥門緊縮',
  'genre.hardRock.pin.3150.why': '吉他咬住的地方。',
  'genre.hardRock.pin.12500': '嘶嘶聲減輕',
  'genre.hardRock.pin.12500.why': '超速裝置的頂部，未抬起。',
  'genre.hardRock.stage.bassPunch': '踢擊繼續，尾巴也變短了一些。',
  'genre.hardRock.stage.dimension': '低音變窄；吉他保持平移狀態。',
  'genre.hardRock.stage.maximizer': '適合客廳踢球的淺色天花板。',
  'genre.hardRock.off': '無激勵器或 Bass Forge：閥門嘎吱聲就足夠諧波了。',
  'genre.metal.hook': '每一次雙踢都是獨立的',
  'genre.metal.story':
    'Double-kick 的執行速度高達 220 BPM，每首歌曲都可以單獨呈現，並且下調吉他的低音端。它是目前聲音最大的流派，中位數為 -8.4 LUFS。產生命中讀取的咔噠聲頻率為 4 至 8 kHz，其強度為 60 至 110 Hz。',
  'genre.metal.pin.32': '75 Hz 以下沒有任何提升',
  'genre.metal.pin.32.why': '吉他擁有底部；更多會玷汙踢球。',
  'genre.metal.pin.80': '踢腿重量，左側水平',
  'genre.metal.pin.80.why': '能夠提升它的頻段可以提升 75 Hz 以下的一切。',
  'genre.metal.pin.315': '調低吉他的泥漿',
  'genre.metal.pin.315.why':
    '任何型別中最深刻的剪輯，以及為什麼連複段保持清晰。',
  'genre.metal.pin.3150': '點選即可閱讀',
  'genre.metal.pin.3150.why': '為什麼雙踢跑聽起來像是單獨的擊球。',
  'genre.metal.stage.bassPunch': '尾巴較短，攻擊力較強，因此奔跑時保持分開。',
  'genre.metal.stage.dimension': '150 Hz 以下低音變窄，沒有任何變寬。',
  'genre.metal.stage.maximizer': '它幾乎不開車：這是最響亮的型別。',
  'genre.metal.off':
    '它的激勵器被提供並停止：更多的諧波會落在嘶嘶聲中。在調低調音的吉他下沒有 Bass Forge。',
  'genre.punk.hook': '乾、中重度、快速',
  'genre.punk.story':
    '在原始的圓鋸吉他下，以 150 至 200 BPM 的速度演奏根音貝斯和沈重的乾鼓（Ramones 的節奏約為 170）。 70 年代的原版動態範圍為 12 至 13。',
  'genre.punk.pin.32': '無子',
  'genre.punk.pin.32.why': '龐克從來都不是在那裡誕生的。',
  'genre.punk.pin.1250': '圓鋸中頻',
  'genre.punk.pin.1250.why': '吉他住的地方。',
  'genre.punk.pin.5000': '沒有空氣，乾燥',
  'genre.punk.pin.5000.why': '被記下來：沒有什麼比樂團演奏的更明亮的了。',
  'genre.punk.stage.bassPunch': '只是腳踢得更緊了。',
  'genre.punk.stage.dimension': '低音變窄了，沒有任何變寬。',
  'genre.punk.stage.maximizer': '保持攻擊的輕型天花板。',
  'genre.punk.off': '沒有激勵器，也沒有 Bass Forge：原始的聲音。',
  'genre.popPunk.hook': '緊緻、有咔嗒聲的底鼓和光滑的吉他',
  'genre.popPunk.story':
    '速度快於 150 至 185 BPM，精選貝斯和吉他左撥右撥，明亮而激進。母版在 -7 至 -5 LUFS 下被壓縮至 4 至 6 的動態範圍。',
  'genre.popPunk.pin.125': '精選低音沖床',
  'genre.popPunk.pin.125.why': '強力和絃下方的音符。',
  'genre.popPunk.pin.500': '中低頻收緊',
  'genre.popPunk.pin.500.why': '它可以讓吉他牆保持乾淨。',
  'genre.popPunk.pin.3150': '只有一點點邊緣',
  'genre.popPunk.pin.3150.why': '這些大師都是光明正大的，也都已經被壓垮了。',
  'genre.popPunk.stage.bassPunch': '踢得更緊，而不是更深。',
  'genre.popPunk.stage.dimension': '150 Hz 以下低音變窄，沒有任何變寬。',
  'genre.popPunk.stage.maximizer': '搖滾家族中最輕的天花板：主人已經很大聲了。',
  'genre.popPunk.off': '如此明亮、如此響亮的母帶上沒有激勵器或 Bass Forge。',
  'genre.grunge.hook': '泥濘的、柔和的、響亮的、故意黑暗的',
  'genre.grunge.story':
    '降調、扭曲的吉他和 75 至 140 BPM 的寬大底鼓，柔和的詩句變成響亮的合唱。厚實的中音和捲起的頂部就是聲音；原版的動態範圍為 12，重製版為 7。',
  'genre.grunge.pin.125': '汙泥',
  'genre.grunge.pin.125.why': '下調重量，保留。',
  'genre.grunge.pin.2000': '軟邊吉他',
  'genre.grunge.pin.2000.why': '緩和，使變形保持較厚，而不是被刮掉。',
  'genre.grunge.pin.12500': '捲起的頂部',
  'genre.grunge.pin.12500.why': '再往下看：記錄是黑暗的。',
  'genre.grunge.stage.dimension':
    '寬闊的吉他和居中的聲音，混合在一起；只是底部變窄了。',
  'genre.grunge.stage.maximizer':
    '一個緩慢的天花板，使柔和的一半柔和，大聲的一半大聲。',
  'genre.grunge.off':
    '無激勵器、Bass Punch 或 Bass Forge：沒有任何東西可以照亮它。',
} satisfies Partial<Dictionary>;

export default genreRock;
