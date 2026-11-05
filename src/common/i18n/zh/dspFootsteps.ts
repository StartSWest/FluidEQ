/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': '游戏',
  'dsp.footsteps.description':
    '让游戏听起来对劲的一切：细小的脚步声在出现的瞬间被提起，人声推到前面，关卡里的天气和嗡鸣可调低或调高，世界环绕着你。不增加延迟。',
  'dsp.footsteps.isolate': '独听',
  'dsp.footsteps.isolateHint': '只听游戏改变的部分。',
  'dsp.footsteps.isolateOn':
    '正在只播放游戏改变的部分。你应该听到脚步声和细小声音被提起，绝不会是枪声。',
  'dsp.footsteps.engineOld':
    '游戏需要最新的 FluidEQ Engine。机架的其余部分正在播放；引擎更新后此滤镜就会开始工作。',

  'dsp.footsteps.lift': '提升',
  'dsp.footsteps.liftHint':
    '细小声音传来时提上来多少。已经很响的声音保持原样。',
  'dsp.footsteps.calm': '缓和',
  'dsp.footsteps.upTo': '最多 {db} dB',
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

  'dsp.footstepsPreset.competitive': '竞技',
  'dsp.footstepsPreset.competitiveGames': 'CS2、无畏契约、彩虹六号',
  'dsp.footstepsPreset.battleRoyale': '大逃杀',
  'dsp.footstepsPreset.battleRoyaleGames':
    '使命召唤：战区、Apex 英雄、绝地求生、堡垒之夜',
  'dsp.footstepsPreset.tactical': '战术生存',
  'dsp.footstepsPreset.tacticalGames': '逃离塔科夫、Hunt、Arma',
  'dsp.footstepsPreset.story': '剧情与恐怖',
  'dsp.footstepsPreset.storyGames': '单人游戏和开放世界',

  'dsp.footstepsPresetGroup.kinds': '按游戏类型',
  'dsp.footstepsPresetGroup.competitive': '竞技射击',
  'dsp.footstepsPresetGroup.battle': '大逃杀与大型战斗',
  'dsp.footstepsPresetGroup.tactical': '战术与生存',
  'dsp.footstepsPresetGroup.moba': 'MOBA 与策略',
  'dsp.footstepsPresetGroup.rpg': 'MMO 与角色扮演',
  'dsp.footstepsPresetGroup.story': '剧情与恐怖',
  'dsp.footstepsPreset.immersive': '任何游戏，房间环绕你',
  'dsp.footstepsPreset.immersiveGames': '用耳机玩的立体声游戏',
  'dsp.footstepsPreset.topDown': '俯视视角',
  'dsp.footstepsPreset.topDownGames': 'MOBA、即时战略、策略',
  'dsp.footstepsPreset.worlds': '世界',
  'dsp.footstepsPreset.worldsGames': 'MMO、开放世界 RPG',
  'dsp.footstepsPreset.speed': '速度',
  'dsp.footstepsPreset.speedGames': '赛车与驾驶',
  'dsp.footstepsPreset.impact': '冲击感',
  'dsp.footstepsPreset.impactGames': '格斗、动作、体育',
  'dsp.game.hintOwn3d': '自带 3D 音效',
  'dsp.game.hintRoom': '房间：{room}',
  'dsp.game.noteOwn3d':
    '{game} 会自己把声音放在你周围，所以房间保持关闭：两者同时开启，一个脚步声会从两个地方传来。',
  'dsp.game.noteRoom': '{game}：戴耳机时，房间把它放进{room}。',
  'dsp.game.engineOld':
    '对白、环境音和马蹄需要最新的 FluidEQ Engine。脚步声已在工作；其余部分在引擎更新后开始。',
  'dsp.game.footsteps': '脚步声',
  'dsp.game.heavy': '马蹄与沉重脚步',
  'dsp.game.heavyHint': '靴子或马匹低沉的咚咚声也会被提起。',
  'dsp.game.dialogue': '对白',
  'dsp.game.dialogueHint': '当有人在画面中央说话时，他的声音会推到前面。',
  'dsp.game.voices': '人声',
  'dsp.game.duck': '为人声让出空间',
  'dsp.game.duckHint': '说台词时，音乐和音效会稍微退后。',
  'dsp.game.voiceMeter': '有人在说话',
  'dsp.game.environment': '环境音',
  'dsp.game.environmentHint':
    '关卡里的天气和嗡鸣：雨、风、房间的低鸣。调低可在其上听清线索，调高可增强氛围。',
  'dsp.game.environmentDial': '氛围',
  'dsp.game.environmentDown': '最多降低 {db} dB',
  'dsp.game.environmentUp': '最多提高 {db} dB',
  'dsp.game.environmentLeft': '保持游戏原样',
  'dsp.game.ambienceMeter': '听到的环境音',

  'dsp.game.hintNoRoom': '不用房间最好',
  'dsp.game.noteNoRoom': '{game} 保持原混音时最吓人，所以房间保持关闭。',

  // The Gaming tab's own presets, on every stage.
  'dsp.eqPresetGroup.gaming': '游戏',
  'dsp.deEsserPresetGroup.gaming': '游戏',
  'dsp.gamingPreset.tightLows': '紧致低音',
  'dsp.gamingPreset.impact': '冲击感',
  'dsp.gamingPreset.night': '夜间',
  'dsp.gamingPreset.positionSafe': '定位不变',
  'dsp.gamingPreset.openWorld': '开放世界',
  'dsp.gamingPreset.battlefieldView': '战场视角',
  'dsp.gamingPreset.cleanCeiling': '干净上限',
  'dsp.gamingPreset.battle': '战斗',
  'dsp.gamingPreset.cinematicPunch': '电影冲击',
  'dsp.gamingPreset.rumble': '小单元的隆隆声',
  'dsp.gamingPreset.engineWeight': '引擎分量',
  'dsp.gamingPreset.cueDetail': '线索细节',
  'dsp.gamingPreset.dullHeadset': '发闷的耳机',
  'dsp.gamingPreset.callouts': '队友报点',
  'dsp.gamingPreset.footstepFocus': '脚步聚焦',
  'dsp.gamingPreset.blastTamer': '爆炸抑制',
  'dsp.gamingPreset.voicesForward': '人声靠前',
  'dsp.gamingPreset.cinematicWeight': '电影分量',
  'dsp.gamingPreset.dread': '恐惧',
  'dsp.gamingPreset.engineTyres': '引擎与轮胎',
  'dsp.gamingPreset.abilityClarity': '技能清晰',

  // The Gaming tab's whole-rack chains.
  'dsp.gamingChain.pinpoint': '精准',
  'dsp.gamingChain.blast': '挺过爆炸',
  'dsp.gamingChain.stealth': '潜行',
  'dsp.gamingChain.cinematic': '电影感',
  'dsp.gamingChain.dread': '恐惧',
  'dsp.gamingChain.topDown': '俯视视角',
  'dsp.gamingChain.worlds': '世界',
  'dsp.gamingChain.speed': '速度',
  'dsp.gamingChain.impact': '冲击感',
  'dsp.gamingChain.night': '夜间游玩',
};
