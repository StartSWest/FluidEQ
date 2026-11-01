/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': 'Шаги',
  'dsp.footsteps.description':
    'Поднимает тихие звуки игры, например шаги, перезарядку и двери, в тот момент, когда они звучат. Выстрелы, взрывы, дождь и эхо остаются как есть, оба уха получают одинаковый подъём, и задержки нет.',
  'dsp.footsteps.isolate': 'Изолировать',
  'dsp.footsteps.isolateHint': 'Слушать только то, что добавляют «Шаги».',
  'dsp.footsteps.isolateOn':
    'Звучит только то, что добавляют «Шаги». Вы должны слышать шаги и другие мелкие звуки, но не выстрелы.',
  'dsp.footsteps.engineOld':
    '«Шагам» нужен новейший FluidEQ Engine. Остальная цепочка звучит; этот этап включится, как только движок будет обновлён.',

  'dsp.footsteps.lift': 'Подъём',
  'dsp.footsteps.liftHint':
    'Насколько поднимается тихий звук, пока он звучит. То, что уже громко, остаётся как есть.',
  'dsp.footsteps.calm': 'Смягчение',
  'dsp.footsteps.calmHint':
    'Насколько опускается гул взрыва. Он отпускается за десятую долю секунды, чтобы следующий шаг был слышен.',
  'dsp.footsteps.upTo': 'До {db} дБ',
  'dsp.footsteps.bands': 'Что поднимается',
  'dsp.footsteps.bandsHint':
    'Одинаковый подъём на каждом динамике, чтобы звук оставался на своём месте.',
  'dsp.footsteps.band.weight': 'Вес шага',
  'dsp.footsteps.band.steps': 'Шаги и снаряжение',
  'dsp.footsteps.band.detail': 'Спереди, сзади, сверху и снизу',

  'dsp.footsteps.graph.now': 'сейчас',
  'dsp.footsteps.graph.lifting': 'Подъём',
  'dsp.footsteps.graph.calming': 'Смягчение',
  'dsp.footsteps.graph.background': 'Фон',
  'dsp.footsteps.graph.isolate': 'Только добавленное',
  'dsp.footsteps.graph.everything': 'Всё',
  'dsp.footsteps.graph.steps': 'Полоса шагов',
  'dsp.footsteps.graph.lifted': 'Поднято',
  'dsp.footsteps.graph.calmed': 'Смягчено',

  'dsp.footstepsPresetGroup.games': 'По типу игры',
  'dsp.footstepsPreset.competitive': 'Соревновательные',
  'dsp.footstepsPreset.competitiveGames': 'CS2, Valorant, Rainbow Six',
  'dsp.footstepsPreset.battleRoyale': 'Королевская битва',
  'dsp.footstepsPreset.battleRoyaleGames': 'Warzone, Apex, PUBG, Fortnite',
  'dsp.footstepsPreset.tactical': 'Тактическое выживание',
  'dsp.footstepsPreset.tacticalGames': 'Tarkov, Hunt, Arma',
  'dsp.footstepsPreset.story': 'Сюжет и хоррор',
  'dsp.footstepsPreset.storyGames': 'Одиночные игры и открытые миры',
};
