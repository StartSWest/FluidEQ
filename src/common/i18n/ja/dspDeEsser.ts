/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The De-esser's page. See `en/dspDeEsser.ts`. */
export default {
  'dsp.deEsser.title': 'ディエッサー',
  'dsp.deEsser.description':
    '声の鋭いサ行・タ行・シャ行を鳴っている間だけ下げ、シンバルや他の高域には手を付けません。',
  'dsp.deEsser.isolate': 'アイソレート',
  'dsp.deEsser.isolateHint': 'ディエッサーが取り除く音だけを聴きます。',
  'dsp.deEsser.isolateOn':
    'ディエッサーが取り除く音だけを再生中です。シンバルが聞こえるなら、取りすぎです。',

  'dsp.deEsser.group.find': '検出',
  'dsp.deEsser.group.findHint':
    '感度は曲そのもののレベルを基準に測るので、静かな曲も大きな曲も同じように扱われます。',
  'dsp.deEsser.group.reduce': '低減',
  'dsp.deEsser.group.timing': 'タイミング',
  'dsp.deEsser.group.timingHint':
    '立ち上がり検出は各歯擦音の直前に反応し、最初のエッジを逃しません。戻りは、その後に高域が戻る速さを決めます。',
  'dsp.deEsser.group.where': '範囲',

  'dsp.deEsser.sensitivity': '感度',
  'dsp.deEsser.lowHz': '下限',
  'dsp.deEsser.highHz': '上限',
  'dsp.deEsser.rangeDb': '最大',
  'dsp.deEsser.widthOct': '幅',
  'dsp.deEsser.attackMs': '立ち上がり検出',
  'dsp.deEsser.releaseMs': '戻り',
  'dsp.deEsser.keepCymbals': 'シンバルを残す',

  'dsp.deEsser.mode.label': '下げ方',
  'dsp.deEsser.mode.spectral': 'スペクトル',
  'dsp.deEsser.mode.treble': '高域',
  'dsp.deEsser.mode.whole': '声全体',
  'dsp.deEsser.mode.spectralHint':
    '歯擦音を作っている周波数だけを下げ、それが動けば追いかけます。',
  'dsp.deEsser.mode.trebleHint':
    '一般的なディエッサーと同じく、歯擦音より上をすべて下げます。より確実ですが、少しこもります。',
  'dsp.deEsser.mode.wholeHint':
    '歯擦音の間だけ音全体を下げます。話し声では自然、音楽では下げすぎです。',

  'dsp.deEsser.where.label': 'ステレオ像のどの部分か',
  'dsp.deEsser.where.centre': '中央',
  'dsp.deEsser.where.all': 'すべて',
  'dsp.deEsser.where.centreHint':
    '声は中央に、ハイハットはたいてい左右にあるので、中央で聴いて下げます。',
  'dsp.deEsser.where.allHint':
    'ステレオ像全体を聴きます。モノラル録音、話し声、ライブ録音向けです。',

  'dsp.deEsser.graph.s': '歯擦音',
  'dsp.deEsser.graph.cut': '低減',
  'dsp.deEsser.graph.isolate': '取り除いた音のみ',
  'dsp.deEsser.graph.spared': 'シンバルは通過',
  'dsp.deEsser.graph.now': '現在',
  'dsp.deEsser.graph.voice': '声',
  'dsp.deEsser.graph.notVoice': '声以外',
  'dsp.deEsser.graph.threshold': '効き始め',
  'dsp.deEsser.engineOld':
    'ここにインストールされている FluidEQ Engine はディエッサーより古いため、この段はまだ聞こえません。ラックの他の部分はこれまでどおり鳴ります。',
  'dsp.deEsser.upTo': '最大 {db}',

  'dsp.deEsserPresetGroup.music': '音楽',
  'dsp.deEsserPresetGroup.speech': '話し声',
  'dsp.deEsserPreset.gentle': 'ソフト',
  'dsp.deEsserPreset.vocalMusic': 'ボーカル曲',
  'dsp.deEsserPreset.brightHeadphones': '明るいヘッドホン',
  'dsp.deEsserPreset.harshStreams': '耳障りな配信',
  'dsp.deEsserPreset.live': 'ライブ録音',
  'dsp.deEsserPreset.podcast': 'ポッドキャストと話し声',
} as const;
