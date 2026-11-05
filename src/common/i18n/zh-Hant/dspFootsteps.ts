/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': '遊戲',
  'dsp.footsteps.description':
    '讓遊戲聽起來對勁的一切：細小的腳步聲在出現的瞬間被提起，人聲推到前面，關卡裡的天氣和嗡鳴可調低或調高，世界環繞著你。不增加延遲。',
  'dsp.footsteps.isolate': '隔離',
  'dsp.footsteps.isolateHint': '只聽遊戲改變的部分。',
  'dsp.footsteps.isolateOn':
    '正在只播放遊戲改變的部分。你應該聽到腳步聲和細小聲音被提起，絕不會是槍聲。',
  'dsp.footsteps.engineOld':
    '遊戲需要最新的 FluidEQ Engine。機架的其餘部分正在播放；引擎更新後此濾鏡就會開始運作。',

  'dsp.footsteps.lift': '提升',
  'dsp.footsteps.liftHint':
    '細小聲音傳來時提上來多少。已經很響的聲音保持原樣。',
  'dsp.footsteps.calm': '緩和',
  'dsp.footsteps.upTo': '最多 {db} dB',
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

  'dsp.footstepsPreset.competitive': '競技',
  'dsp.footstepsPreset.competitiveGames': 'CS2、特戰英豪、虹彩六號',
  'dsp.footstepsPreset.battleRoyale': '大逃殺',
  'dsp.footstepsPreset.battleRoyaleGames':
    '決勝時刻：戰區、Apex 英雄、絕地求生、要塞英雄',
  'dsp.footstepsPreset.tactical': '戰術生存',
  'dsp.footstepsPreset.tacticalGames': '逃離塔科夫、Hunt、Arma',
  'dsp.footstepsPreset.story': '劇情與恐怖',
  'dsp.footstepsPreset.storyGames': '單人遊戲和開放世界',

  'dsp.footstepsPresetGroup.kinds': '依遊戲類型',
  'dsp.footstepsPresetGroup.competitive': '競技射擊',
  'dsp.footstepsPresetGroup.battle': '大逃殺與大型戰鬥',
  'dsp.footstepsPresetGroup.tactical': '戰術與生存',
  'dsp.footstepsPresetGroup.moba': 'MOBA 與策略',
  'dsp.footstepsPresetGroup.rpg': 'MMO 與角色扮演',
  'dsp.footstepsPresetGroup.story': '劇情與恐怖',
  'dsp.footstepsPreset.immersive': '任何遊戲，聆聽室環繞你',
  'dsp.footstepsPreset.immersiveGames': '用耳機玩的立體聲遊戲',
  'dsp.footstepsPreset.topDown': '俯視視角',
  'dsp.footstepsPreset.topDownGames': 'MOBA、即時戰略、策略',
  'dsp.footstepsPreset.worlds': '世界',
  'dsp.footstepsPreset.worldsGames': 'MMO、開放世界 RPG',
  'dsp.footstepsPreset.speed': '速度',
  'dsp.footstepsPreset.speedGames': '賽車與駕駛',
  'dsp.footstepsPreset.impact': '衝擊感',
  'dsp.footstepsPreset.impactGames': '格鬥、動作、體育',
  'dsp.game.hintOwn3d': '自帶 3D 音效',
  'dsp.game.hintRoom': '聆聽室：{room}',
  'dsp.game.noteOwn3d':
    '{game} 會自己把聲音放在你周圍，所以聆聽室保持關閉：兩者同時開啟，一個腳步聲會從兩個地方傳來。',
  'dsp.game.noteRoom': '{game}：戴耳機時，聆聽室把它放進{room}。',
  'dsp.game.engineOld':
    '對白、環境音和馬蹄需要最新的 FluidEQ Engine。腳步聲已在運作；其餘部分在引擎更新後開始。',
  'dsp.game.footsteps': '腳步聲',
  'dsp.game.heavy': '馬蹄與沉重腳步',
  'dsp.game.heavyHint': '靴子或馬匹低沉的咚咚聲也會被提起。',
  'dsp.game.dialogue': '對白',
  'dsp.game.dialogueHint': '當有人在畫面中央說話時，他的聲音會推到前面。',
  'dsp.game.voices': '人聲',
  'dsp.game.duck': '為人聲讓出空間',
  'dsp.game.duckHint': '說台詞時，音樂和音效會稍微退後。',
  'dsp.game.voiceMeter': '有人在說話',
  'dsp.game.environment': '環境音',
  'dsp.game.environmentHint':
    '關卡裡的天氣和嗡鳴：雨、風、房間的低鳴。調低可在其上聽清線索，調高可增強氛圍。',
  'dsp.game.environmentDial': '氛圍',
  'dsp.game.environmentDown': '最多降低 {db} dB',
  'dsp.game.environmentUp': '最多提高 {db} dB',
  'dsp.game.environmentLeft': '保持遊戲原樣',
  'dsp.game.ambienceMeter': '聽到的環境音',

  'dsp.game.hintNoRoom': '不用聆聽室最好',
  'dsp.game.noteNoRoom': '{game} 保持原混音時最嚇人，所以聆聽室保持關閉。',

  // The Gaming tab's own presets, on every stage.
  'dsp.eqPresetGroup.gaming': '遊戲',
  'dsp.deEsserPresetGroup.gaming': '遊戲',
  'dsp.gamingPreset.tightLows': '緊緻低音',
  'dsp.gamingPreset.impact': '衝擊感',
  'dsp.gamingPreset.night': '夜間',
  'dsp.gamingPreset.positionSafe': '定位不變',
  'dsp.gamingPreset.openWorld': '開放世界',
  'dsp.gamingPreset.battlefieldView': '戰場視角',
  'dsp.gamingPreset.cleanCeiling': '乾淨上限',
  'dsp.gamingPreset.battle': '戰鬥',
  'dsp.gamingPreset.cinematicPunch': '電影衝擊',
  'dsp.gamingPreset.rumble': '小單體的隆隆聲',
  'dsp.gamingPreset.engineWeight': '引擎分量',
  'dsp.gamingPreset.cueDetail': '線索細節',
  'dsp.gamingPreset.dullHeadset': '發悶的耳機',
  'dsp.gamingPreset.callouts': '隊友報點',
  'dsp.gamingPreset.footstepFocus': '腳步聚焦',
  'dsp.gamingPreset.blastTamer': '爆炸抑制',
  'dsp.gamingPreset.voicesForward': '人聲靠前',
  'dsp.gamingPreset.cinematicWeight': '電影分量',
  'dsp.gamingPreset.dread': '恐懼',
  'dsp.gamingPreset.engineTyres': '引擎與輪胎',
  'dsp.gamingPreset.abilityClarity': '技能清晰',

  // The Gaming tab's whole-rack chains.
  'dsp.gamingChain.pinpoint': '精準',
  'dsp.gamingChain.blast': '挺過爆炸',
  'dsp.gamingChain.stealth': '潛行',
  'dsp.gamingChain.cinematic': '電影感',
  'dsp.gamingChain.dread': '恐懼',
  'dsp.gamingChain.topDown': '俯視視角',
  'dsp.gamingChain.worlds': '世界',
  'dsp.gamingChain.speed': '速度',
  'dsp.gamingChain.impact': '衝擊感',
  'dsp.gamingChain.night': '夜間遊玩',
};
