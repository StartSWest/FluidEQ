/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The De-esser's page. See `en/dspDeEsser.ts`. */
export default {
  'dsp.deEsser.title': 'Де-эссер',
  'dsp.deEsser.description':
    'Приглушает резкие С, Ц и Ш в голосе только пока они звучат и не трогает тарелки и остальные высокие.',
  'dsp.deEsser.isolate': 'Изолировать',
  'dsp.deEsser.isolateHint': 'Слушать только то, что убирает де-эссер.',
  'dsp.deEsser.isolateOn':
    'Звучит только то, что убирает де-эссер. Если в нём слышны тарелки, он убирает слишком много.',

  'dsp.deEsser.group.find': 'Поиск',
  'dsp.deEsser.group.findHint':
    'Чуткость отсчитывается от уровня самой песни, поэтому тихий и громкий трек обрабатываются одинаково.',
  'dsp.deEsser.group.reduce': 'Ослабление',
  'dsp.deEsser.group.timing': 'Тайминг',
  'dsp.deEsser.group.timingHint':
    'Захват начала срабатывает чуть раньше каждого «с», чтобы не упустить его первый фронт. Отпускание задаёт, как быстро высокие возвращаются после него.',
  'dsp.deEsser.group.where': 'Где',

  'dsp.deEsser.sensitivity': 'Чуткость',
  'dsp.deEsser.lowHz': 'От',
  'dsp.deEsser.highHz': 'До',
  'dsp.deEsser.rangeDb': 'Не более',
  'dsp.deEsser.widthOct': 'Ширина',
  'dsp.deEsser.attackMs': 'Захват начала',
  'dsp.deEsser.releaseMs': 'Отпускание',
  'dsp.deEsser.keepCymbals': 'Щадить тарелки',

  'dsp.deEsser.mode.label': 'Как ослабляет',
  'dsp.deEsser.mode.spectral': 'Спектрально',
  'dsp.deEsser.mode.treble': 'Высокие',
  'dsp.deEsser.mode.whole': 'Весь голос',
  'dsp.deEsser.mode.spectralHint':
    'Приглушает только частоты, из которых состоит «с», и следует за ним, когда он смещается.',
  'dsp.deEsser.mode.trebleHint':
    'Приглушает всё выше «с», как большинство де-эссеров. Твёрже, немного глуше.',
  'dsp.deEsser.mode.wholeHint':
    'Приглушает весь звук на время каждого «с». Естественно для речи, слишком сильно для музыки.',

  'dsp.deEsser.where.label': 'Какая часть стереокартины',
  'dsp.deEsser.where.centre': 'Центр',
  'dsp.deEsser.where.all': 'Всё',
  'dsp.deEsser.where.centreHint':
    'Голоса стоят в середине, а хай-хэты обычно по бокам, поэтому он слушает и ослабляет в центре.',
  'dsp.deEsser.where.allHint':
    'Слушает всю стереокартину. Для моно-записей, речи и концертных записей.',

  'dsp.deEsser.graph.s': '«С» на',
  'dsp.deEsser.graph.cut': 'Ослабление',
  'dsp.deEsser.graph.isolate': 'Только убранное',
  'dsp.deEsser.graph.spared': 'Тарелки пропущены',
  'dsp.deEsser.graph.now': 'сейчас',
  'dsp.deEsser.graph.voice': 'Голос',
  'dsp.deEsser.graph.notVoice': 'Не голос',
  'dsp.deEsser.graph.threshold': 'Где начинается',
  'dsp.deEsser.engineOld':
    'Установленный здесь FluidEQ Engine старше де-эссера, поэтому этот этап пока не слышен. Остальная цепочка звучит как раньше.',
  'dsp.deEsser.upTo': 'до {db}',

  'dsp.deEsserPresetGroup.music': 'Музыка',
  'dsp.deEsserPresetGroup.speech': 'Речь',
  'dsp.deEsserPreset.gentle': 'Мягкий',
  'dsp.deEsserPreset.vocalMusic': 'Музыка с вокалом',
  'dsp.deEsserPreset.brightHeadphones': 'Яркие наушники',
  'dsp.deEsserPreset.harshStreams': 'Резкие стримы',
  'dsp.deEsserPreset.live': 'Концертные записи',
  'dsp.deEsserPreset.podcast': 'Подкасты и речь',
} as const;
