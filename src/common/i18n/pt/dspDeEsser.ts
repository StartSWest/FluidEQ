/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The De-esser's page. See `en/dspDeEsser.ts`. */
export default {
  'dsp.deEsser.title': 'De-esser',
  'dsp.deEsser.description':
    'Abaixa os S, T e CH afiados de uma voz só enquanto soam, e deixa os pratos e o resto dos agudos em paz.',
  'dsp.deEsser.isolate': 'Isolar',
  'dsp.deEsser.isolateHint': 'Ouvir só o que o De-esser tira.',
  'dsp.deEsser.isolateOn':
    'Tocando só o que o De-esser tira. Se você ouvir pratos aí, ele está tirando demais.',

  'dsp.deEsser.group.find': 'Encontrar',
  'dsp.deEsser.group.findHint':
    'A sensibilidade é medida contra o nível da própria música, então uma faixa baixa e uma alta são tratadas igual.',
  'dsp.deEsser.group.reduce': 'Reduzir',
  'dsp.deEsser.group.timing': 'Tempos',
  'dsp.deEsser.group.timingHint':
    'Pegar o início reage logo antes de cada S, para não perder a primeira borda. Soltar define a rapidez com que os agudos voltam depois.',
  'dsp.deEsser.group.where': 'Onde',

  'dsp.deEsser.sensitivity': 'Sensibilidade',
  'dsp.deEsser.lowHz': 'De',
  'dsp.deEsser.highHz': 'Até',
  'dsp.deEsser.rangeDb': 'Até',
  'dsp.deEsser.widthOct': 'Largura',
  'dsp.deEsser.attackMs': 'Pegar o início',
  'dsp.deEsser.releaseMs': 'Soltar',
  'dsp.deEsser.keepCymbals': 'Poupar pratos',

  'dsp.deEsser.mode.label': 'Como reduz',
  'dsp.deEsser.mode.spectral': 'Espectral',
  'dsp.deEsser.mode.treble': 'Agudos',
  'dsp.deEsser.mode.whole': 'Voz inteira',
  'dsp.deEsser.mode.spectralHint':
    'Abaixa só as frequências de que o S é feito, e o segue quando ele se move.',
  'dsp.deEsser.mode.trebleHint':
    'Abaixa tudo acima do S, como a maioria dos de-essers. Mais firme, um pouco mais abafado.',
  'dsp.deEsser.mode.wholeHint':
    'Abaixa o som inteiro a cada S, incluindo tudo o que toca por baixo, por isso pode bombear. Só para uma voz gravada sozinha.',

  'dsp.deEsser.where.label': 'Que parte da imagem estéreo',
  'dsp.deEsser.where.centre': 'Centro',
  'dsp.deEsser.where.all': 'Tudo',
  'dsp.deEsser.where.centreHint':
    'As vozes ficam no meio e os hi-hats costumam ficar nas laterais, então ele escuta e corta no centro.',
  'dsp.deEsser.where.allHint':
    'Escuta toda a imagem estéreo. Para discos mono, fala e gravações ao vivo.',

  'dsp.deEsser.graph.s': 'S em',
  'dsp.deEsser.graph.cut': 'Corte',
  'dsp.deEsser.graph.isolate': 'Só o que é tirado',
  'dsp.deEsser.graph.spared': 'Pratos poupados',
  'dsp.deEsser.graph.now': 'agora',
  'dsp.deEsser.graph.voice': 'Voz',
  'dsp.deEsser.graph.notVoice': 'Não é voz',
  'dsp.deEsser.graph.threshold': 'Onde começa',
  'dsp.deEsser.engineOld':
    'O FluidEQ Engine instalado aqui é anterior ao De-esser, então esta etapa ainda não é ouvida. O resto do rack toca como antes.',
  'dsp.deEsser.upTo': 'até {db}',
  'dsp.deEsser.lens.trebleNow': 'Agudos agora',
  'dsp.deEsser.lens.underVoice': '{db} abaixo da voz',
  'dsp.deEsser.lens.ahead': 'ouvido {ms} antes',
  'dsp.deEsser.lens.cymbalNeeds': 'um prato precisa de {db} a mais',
  'dsp.deEsser.lens.cymbal': 'Prato',
  'dsp.deEsser.lens.s': 'S',
  'dsp.deEsser.lens.left': 'E',
  'dsp.deEsser.lens.right': 'D',

  'dsp.deEsserPresetGroup.music': 'Música',
  'dsp.deEsserPresetGroup.speech': 'Fala',
  'dsp.deEsserPreset.gentle': 'Suave',
  'dsp.deEsserPreset.vocalMusic': 'Música com voz',
  'dsp.deEsserPreset.brightHeadphones': 'Fones brilhantes',
  'dsp.deEsserPreset.harshStreams': 'Streams ásperos',
  'dsp.deEsserPreset.live': 'Gravações ao vivo',
  'dsp.deEsserPreset.podcast': 'Podcast e fala',
} as const;
