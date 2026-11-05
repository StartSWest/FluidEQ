/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': 'ゲーム',
  'dsp.footsteps.description':
    'ゲームを正しく聞かせるためのすべて：小さな足音を鳴った瞬間に持ち上げ、声を前に出し、ステージの天候やうなりを下げたり上げたりし、世界であなたを包みます。遅延は加えません。',
  'dsp.footsteps.isolate': 'アイソレート',
  'dsp.footsteps.isolateHint': 'ゲームが変えた音だけを聴く。',
  'dsp.footsteps.isolateOn':
    'ゲームが変えた音だけを再生中。足音や小さな音が持ち上がるのが聞こえ、銃声は聞こえないはずです。',
  'dsp.footsteps.engineOld':
    'ゲームには最新の FluidEQ Engine が必要です。ラックの残りは再生中で、エンジンを更新するとこのフィルターが始まります。',

  'dsp.footsteps.lift': '持ち上げ',
  'dsp.footsteps.liftHint':
    '小さな音が届くあいだにどれだけ持ち上げるか。すでに大きい音はそのままです。',
  'dsp.footsteps.calm': '抑制',
  'dsp.footsteps.upTo': '最大 {db} dB',
  'dsp.footsteps.band.weight': '足音の重み',
  'dsp.footsteps.band.steps': '足音と装備',
  'dsp.footsteps.band.detail': '前後と上下',

  'dsp.footsteps.graph.now': '現在',
  'dsp.footsteps.graph.lifting': '持ち上げ',
  'dsp.footsteps.graph.calming': '抑制',
  'dsp.footsteps.graph.background': '背景',
  'dsp.footsteps.graph.isolate': '加えた音だけ',
  'dsp.footsteps.graph.everything': 'すべて',
  'dsp.footsteps.graph.steps': '足音の帯域',
  'dsp.footsteps.graph.lifted': '持ち上げた分',
  'dsp.footsteps.graph.calmed': '抑えた分',

  'dsp.footstepsPreset.competitive': '競技',
  'dsp.footstepsPreset.competitiveGames': 'CS2、VALORANT、レインボーシックス',
  'dsp.footstepsPreset.battleRoyale': 'バトルロイヤル',
  'dsp.footstepsPreset.battleRoyaleGames':
    'ウォーゾーン、Apex、PUBG、フォートナイト',
  'dsp.footstepsPreset.tactical': 'タクティカル サバイバル',
  'dsp.footstepsPreset.tacticalGames': 'タルコフ、Hunt、Arma',
  'dsp.footstepsPreset.story': 'ストーリーとホラー',
  'dsp.footstepsPreset.storyGames': 'シングルプレイとオープンワールド',

  'dsp.footstepsPresetGroup.kinds': 'ゲームの種類別',
  'dsp.footstepsPresetGroup.competitive': '対戦シューター',
  'dsp.footstepsPresetGroup.battle': 'バトルロイヤルと大規模戦闘',
  'dsp.footstepsPresetGroup.tactical': 'タクティカルとサバイバル',
  'dsp.footstepsPresetGroup.moba': 'MOBAとストラテジー',
  'dsp.footstepsPresetGroup.rpg': 'MMOとRPG',
  'dsp.footstepsPresetGroup.story': 'ストーリーとホラー',
  'dsp.footstepsPreset.immersive': 'どのゲームでも、周りにルーム',
  'dsp.footstepsPreset.immersiveGames': 'ヘッドホンで遊ぶステレオのゲーム',
  'dsp.footstepsPreset.topDown': '見下ろし型',
  'dsp.footstepsPreset.topDownGames': 'MOBA・RTS・ストラテジー',
  'dsp.footstepsPreset.worlds': 'ワールド',
  'dsp.footstepsPreset.worldsGames': 'MMO・オープンワールドRPG',
  'dsp.footstepsPreset.speed': 'スピード',
  'dsp.footstepsPreset.speedGames': 'レース・ドライブ',
  'dsp.footstepsPreset.impact': 'インパクト',
  'dsp.footstepsPreset.impactGames': '格闘・アクション・スポーツ',
  'dsp.game.hintOwn3d': '独自の3Dサウンド',
  'dsp.game.hintRoom': 'ルーム：{room}',
  'dsp.game.noteOwn3d':
    '{game} は自分で音をあなたの周りに配置するので、ルームはオフのままです。両方あると足音が二か所から聞こえます。',
  'dsp.game.noteRoom': '{game}：ヘッドホンでは、ルームが {room} に置きます。',
  'dsp.game.engineOld':
    'ダイアログ、環境音、ひづめには最新の FluidEQ Engine が必要です。足音はすでに鳴っていて、残りはエンジンを更新すると始まります。',
  'dsp.game.footsteps': '足音',
  'dsp.game.heavy': 'ひづめと重い足音',
  'dsp.game.heavyHint': 'ブーツや馬の低いドンという音も持ち上げます。',
  'dsp.game.dialogue': 'ダイアログ',
  'dsp.game.dialogueHint': '場面の中央で誰かが話す間、その声を前に出します。',
  'dsp.game.voices': '声',
  'dsp.game.duck': '声のために場所を空ける',
  'dsp.game.duckHint': 'セリフの間、音楽と効果音が少し下がります。',
  'dsp.game.voiceMeter': '誰かが話している',
  'dsp.game.environment': '環境音',
  'dsp.game.environmentHint':
    'ステージの天候とうなり：雨、風、部屋の低いうなり。下げると手がかりが聞き取りやすく、上げると雰囲気が増します。',
  'dsp.game.environmentDial': 'アンビエンス',
  'dsp.game.environmentDown': '最大 {db} dB 下げる',
  'dsp.game.environmentUp': '最大 {db} dB 上げる',
  'dsp.game.environmentLeft': 'ゲームが作ったまま',
  'dsp.game.ambienceMeter': '聞こえている環境音',

  'dsp.game.hintNoRoom': 'ルームなしが最適',
  'dsp.game.noteNoRoom':
    '{game} はミックスされたままが一番怖いので、ルームはオフのままです。',

  // The Gaming tab's own presets, on every stage.
  'dsp.eqPresetGroup.gaming': 'ゲーム',
  'dsp.deEsserPresetGroup.gaming': 'ゲーム',
  'dsp.gamingPreset.tightLows': 'タイトな低音',
  'dsp.gamingPreset.impact': 'インパクト',
  'dsp.gamingPreset.night': 'ナイト',
  'dsp.gamingPreset.positionSafe': '定位そのまま',
  'dsp.gamingPreset.openWorld': 'オープンワールド',
  'dsp.gamingPreset.battlefieldView': '戦場ビュー',
  'dsp.gamingPreset.cleanCeiling': 'クリーンな上限',
  'dsp.gamingPreset.battle': 'バトル',
  'dsp.gamingPreset.cinematicPunch': 'シネマティック・パンチ',
  'dsp.gamingPreset.rumble': '小型ドライバーで響く低音',
  'dsp.gamingPreset.engineWeight': 'エンジンの重み',
  'dsp.gamingPreset.cueDetail': '合図のディテール',
  'dsp.gamingPreset.dullHeadset': 'こもったヘッドセット',
  'dsp.gamingPreset.callouts': 'チームのコール',
  'dsp.gamingPreset.footstepFocus': '足音フォーカス',
  'dsp.gamingPreset.blastTamer': '爆発を抑える',
  'dsp.gamingPreset.voicesForward': '声を前に',
  'dsp.gamingPreset.cinematicWeight': 'シネマティックな重み',
  'dsp.gamingPreset.dread': '恐怖',
  'dsp.gamingPreset.engineTyres': 'エンジンとタイヤ',
  'dsp.gamingPreset.abilityClarity': 'スキルを明瞭に',

  // The Gaming tab's whole-rack chains.
  'dsp.gamingChain.pinpoint': 'ピンポイント',
  'dsp.gamingChain.blast': '爆発を生き抜く',
  'dsp.gamingChain.stealth': 'ステルス',
  'dsp.gamingChain.cinematic': 'シネマティック',
  'dsp.gamingChain.dread': '恐怖',
  'dsp.gamingChain.topDown': '見下ろし型',
  'dsp.gamingChain.worlds': 'ワールド',
  'dsp.gamingChain.speed': 'スピード',
  'dsp.gamingChain.impact': 'インパクト',
  'dsp.gamingChain.night': '夜のプレイ',
};
