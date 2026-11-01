/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': '腳步聲',
  'dsp.footsteps.description':
    '在遊戲裡的細小聲音（腳步、換彈、開門）響起的那一刻把它們提上來。槍聲、爆炸、雨聲和回聲保持原樣，兩隻耳朵得到同樣的提升，而且不增加延遲。',
  'dsp.footsteps.isolate': '隔離',
  'dsp.footsteps.isolateHint': '只聽腳步聲增加的部分。',
  'dsp.footsteps.isolateOn':
    '只在播放腳步聲增加的部分。你應該聽到腳步和其他細小聲音，聽不到槍聲。',
  'dsp.footsteps.engineOld':
    '腳步聲需要最新的 FluidEQ 引擎。機架的其餘部分正在播放；引擎更新後這個階段就會開始。',

  'dsp.footsteps.lift': '提升',
  'dsp.footsteps.liftHint':
    '細小聲音傳來時提上來多少。已經很響的聲音保持原樣。',
  'dsp.footsteps.calm': '緩和',
  'dsp.footsteps.calmHint':
    '爆炸的低沉轟鳴降下多少。它在十分之一秒內放開，好讓下一聲腳步聽得見。',
  'dsp.footsteps.upTo': '最多 {db} dB',
  'dsp.footsteps.bands': '提升哪些聲音',
  'dsp.footsteps.bandsHint': '每個揚聲器得到同樣的提升，聲音的位置保持不變。',
  'dsp.footsteps.band.weight': '腳步的分量',
  'dsp.footsteps.band.steps': '腳步和裝備',
  'dsp.footsteps.band.detail': '前後與上下',

  'dsp.footsteps.graph.now': '現在',
  'dsp.footsteps.graph.lifting': '提升',
  'dsp.footsteps.graph.calming': '緩和',
  'dsp.footsteps.graph.background': '背景',
  'dsp.footsteps.graph.isolate': '只有增加的部分',
  'dsp.footsteps.graph.everything': '全部',
  'dsp.footsteps.graph.steps': '腳步頻段',
  'dsp.footsteps.graph.lifted': '已提升',
  'dsp.footsteps.graph.calmed': '已緩和',

  'dsp.footstepsPresetGroup.games': '依遊戲類型',
  'dsp.footstepsPreset.competitive': '競技',
  'dsp.footstepsPreset.competitiveGames': 'CS2、特戰英豪、虹彩六號',
  'dsp.footstepsPreset.battleRoyale': '大逃殺',
  'dsp.footstepsPreset.battleRoyaleGames':
    '決勝時刻：戰區、Apex 英雄、絕地求生、要塞英雄',
  'dsp.footstepsPreset.tactical': '戰術生存',
  'dsp.footstepsPreset.tacticalGames': '逃離塔科夫、Hunt、Arma',
  'dsp.footstepsPreset.story': '劇情與恐怖',
  'dsp.footstepsPreset.storyGames': '單人遊戲和開放世界',
};
