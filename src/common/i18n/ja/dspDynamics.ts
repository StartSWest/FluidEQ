/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.key.now': '現在のバンド',
  'dsp.dynamics.key.lifted': '持ち上げ',
  'dsp.dynamics.key.held': '抑え',
  'dsp.dynamics.untouched': 'そのまま',
  'dsp.dynamics.dragHint':
    '点をドラッグ：中抜きはバンドの始まり、塗りつぶしは強さです。',
  'dsp.dynamics.idleHint':
    '何も再生されていません。音が届くと、各バンドの点がカーブ上を動きます。',
  'dsp.dynamics.state.lifting': '持ち上げ中',
  'dsp.dynamics.state.holding': '抑え中',
  'dsp.dynamics.state.silent': '無音',
  'dsp.dynamics.bands': 'バンド',
  'dsp.dynamics.axisIn': '入力',
  'dsp.dynamics.axisOut': '出力',
  'dsp.dynamics.table.starts': '開始',
  'dsp.dynamics.table.atMost': '最大',
  'dsp.dynamics.table.liftUnder': 'この下で持ち上げ',
  'dsp.dynamics.table.holdOver': 'この上で抑え',
  'dsp.dynamics.point.liftStart': '持ち上げの開始点',
  'dsp.dynamics.point.liftTop': '持ち上げの量',
  'dsp.dynamics.point.liftPull': '持ち上げを引き出す',
  'dsp.dynamics.point.holdStart': '抑えの開始点',
  'dsp.dynamics.point.holdEnd': '抑えの強さ',
  'dsp.dynamics.engineLiveOld':
    'Dynamicsの動きを表示するにはエンジンを更新してください。音声の処理はすでに動作しています。',
  'dsp.dynamics.title': 'ダイナミクス',
  'dsp.dynamics.description':
    '小さな音を持ち上げ、大きな音を抑えます。3つの帯域で働き、ささやきと爆発が真ん中で出会います。遅延は加えません。',
  'dsp.dynamics.engineOld':
    'ダイナミクスには最新の FluidEQ Engine が必要です。ラックの他の部分は鳴っています。エンジンを更新するとこのフィルターが動き始めます。',
  'dsp.dynamics.graphLabel': '各帯域がレベルに何をするか',
  'dsp.dynamics.band.low': '低域',
  'dsp.dynamics.band.lowRange': '150 Hz 未満',
  'dsp.dynamics.band.lowHint': '150 Hz 未満：爆発の轟き、キック、エンジン。',
  'dsp.dynamics.band.mid': '中域',
  'dsp.dynamics.band.midRange': '150 Hz〜4 kHz',
  'dsp.dynamics.band.midHint': '150 Hz〜4 kHz：声、足音、音のほとんど。',
  'dsp.dynamics.band.high': '高域',
  'dsp.dynamics.band.highRange': '4 kHz 超',
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
