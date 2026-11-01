/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': '脚步声',
  'dsp.footsteps.description':
    '在游戏里的细小声音（脚步、换弹、开门）响起的那一刻把它们提上来。枪声、爆炸、雨声和回声保持原样，两只耳朵得到同样的提升，而且不增加延迟。',
  'dsp.footsteps.isolate': '独听',
  'dsp.footsteps.isolateHint': '只听脚步声增加的部分。',
  'dsp.footsteps.isolateOn':
    '只在播放脚步声增加的部分。你应该听到脚步和其他细小声音，听不到枪声。',
  'dsp.footsteps.engineOld':
    '脚步声需要最新的 FluidEQ Engine。机架的其余部分正在工作；引擎更新后这一级就会开始。',

  'dsp.footsteps.lift': '提升',
  'dsp.footsteps.liftHint':
    '细小声音传来时提上来多少。已经很响的声音保持原样。',
  'dsp.footsteps.calm': '缓和',
  'dsp.footsteps.calmHint':
    '爆炸的低沉轰鸣降下多少。它在十分之一秒内放开，好让下一声脚步听得见。',
  'dsp.footsteps.upTo': '最多 {db} dB',
  'dsp.footsteps.bands': '提升哪些声音',
  'dsp.footsteps.bandsHint': '每个扬声器得到同样的提升，声音的位置保持不变。',
  'dsp.footsteps.band.weight': '脚步的分量',
  'dsp.footsteps.band.steps': '脚步和装备',
  'dsp.footsteps.band.detail': '前后与上下',

  'dsp.footsteps.graph.now': '现在',
  'dsp.footsteps.graph.lifting': '提升',
  'dsp.footsteps.graph.calming': '缓和',
  'dsp.footsteps.graph.background': '背景',
  'dsp.footsteps.graph.isolate': '只有增加的部分',
  'dsp.footsteps.graph.everything': '全部',
  'dsp.footsteps.graph.steps': '脚步频段',
  'dsp.footsteps.graph.lifted': '已提升',
  'dsp.footsteps.graph.calmed': '已缓和',

  'dsp.footstepsPresetGroup.games': '按游戏类型',
  'dsp.footstepsPreset.competitive': '竞技',
  'dsp.footstepsPreset.competitiveGames': 'CS2、无畏契约、彩虹六号',
  'dsp.footstepsPreset.battleRoyale': '大逃杀',
  'dsp.footstepsPreset.battleRoyaleGames':
    '使命召唤：战区、Apex 英雄、绝地求生、堡垒之夜',
  'dsp.footstepsPreset.tactical': '战术生存',
  'dsp.footstepsPreset.tacticalGames': '逃离塔科夫、Hunt、Arma',
  'dsp.footstepsPreset.story': '剧情与恐怖',
  'dsp.footstepsPreset.storyGames': '单人游戏和开放世界',
};
