/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': '足音',
  'dsp.footsteps.description':
    '足音、リロード、ドアなど、ゲームの小さな音を鳴った瞬間に持ち上げます。銃声、爆発、雨、反響はそのままで、両耳に同じだけ持ち上げがかかり、遅延は加わりません。',
  'dsp.footsteps.isolate': 'アイソレート',
  'dsp.footsteps.isolateHint': '足音が加えた音だけを聴きます。',
  'dsp.footsteps.isolateOn':
    '足音が加えた音だけを再生しています。足音などの小さな音が聞こえ、銃声は聞こえないはずです。',
  'dsp.footsteps.engineOld':
    '足音には最新の FluidEQ Engine が必要です。ラックの他の部分は鳴っています。エンジンを更新するとこの段が動き始めます。',

  'dsp.footsteps.lift': '持ち上げ',
  'dsp.footsteps.liftHint':
    '小さな音が届くあいだにどれだけ持ち上げるか。すでに大きい音はそのままです。',
  'dsp.footsteps.calm': '抑制',
  'dsp.footsteps.calmHint':
    '爆発の低いうなりをどれだけ下げるか。10 分の 1 秒以内に戻るので、次の足音が聞こえます。',
  'dsp.footsteps.upTo': '最大 {db} dB',
  'dsp.footsteps.bands': '持ち上げる帯域',
  'dsp.footsteps.bandsHint':
    'すべてのスピーカーに同じ持ち上げがかかるので、音の位置は変わりません。',
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

  'dsp.footstepsPresetGroup.games': 'ゲームの種類別',
  'dsp.footstepsPreset.competitive': '競技',
  'dsp.footstepsPreset.competitiveGames': 'CS2、VALORANT、レインボーシックス',
  'dsp.footstepsPreset.battleRoyale': 'バトルロイヤル',
  'dsp.footstepsPreset.battleRoyaleGames':
    'ウォーゾーン、Apex、PUBG、フォートナイト',
  'dsp.footstepsPreset.tactical': 'タクティカル サバイバル',
  'dsp.footstepsPreset.tacticalGames': 'タルコフ、Hunt、Arma',
  'dsp.footstepsPreset.story': 'ストーリーとホラー',
  'dsp.footstepsPreset.storyGames': 'シングルプレイとオープンワールド',
};
