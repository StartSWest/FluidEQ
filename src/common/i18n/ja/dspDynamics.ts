/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.title': 'ダイナミクス',
  'dsp.dynamics.description':
    '小さな音を持ち上げ、大きな音を抑えます。3つの帯域で働き、ささやきと爆発が真ん中で出会います。遅延は加えません。',
  'dsp.dynamics.engineOld':
    'ダイナミクスには最新の FluidEQ Engine が必要です。ラックの他の部分は鳴っています。エンジンを更新するとこのフィルターが動き始めます。',
  'dsp.dynamics.graphLabel': '各帯域がレベルに何をするか',
  'dsp.dynamics.graphIn': '入力',
  'dsp.dynamics.graphOut': '出力',
  'dsp.dynamics.band.low': '低域',
  'dsp.dynamics.band.lowHint': '150 Hz 未満：爆発の轟き、キック、エンジン。',
  'dsp.dynamics.band.mid': '中域',
  'dsp.dynamics.band.midHint': '150 Hz〜4 kHz：声、足音、音のほとんど。',
  'dsp.dynamics.band.high': '高域',
  'dsp.dynamics.band.highHint': '4 kHz 超：ディテール、空気感、足音の輪郭。',
  'dsp.dynamics.lift': '持ち上げ',
  'dsp.dynamics.hold': '抑え',
  'dsp.dynamics.upThreshold': 'この下',
  'dsp.dynamics.upRatio': '比率',
  'dsp.dynamics.upMax': '最大',
  'dsp.dynamics.downThreshold': 'この上',
  'dsp.dynamics.downRatio': '比率',
  'dsp.dynamics.timing': 'タイミングとレベル',
  'dsp.dynamics.timingHint':
    '抑えがどれだけ速く入り、持ち上げがどれだけ速く戻るか、そして結果の音量。',
  'dsp.dynamics.attack': 'アタック',
  'dsp.dynamics.release': 'リリース',
  'dsp.dynamics.makeup': 'メイクアップ',
  'dsp.dynamics.mix': 'ミックス',
  'dsp.dynamicsPreset.gentle': 'やさしい均し',
  'dsp.dynamicsPreset.speech': '話し声',
  'dsp.gamingPreset.quietLift': '小さな音を持ち上げ',
  'dsp.gamingPreset.blastGuard': '爆発ガード',
  'dsp.gamingPreset.longSession': '長時間プレイ',
  'dsp.gamingPreset.competitiveLight': '競技向けライト',
};
