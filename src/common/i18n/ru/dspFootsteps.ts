/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': 'Игра',
  'dsp.footsteps.description':
    'Всё, что заставляет игру звучать правильно: тихие шаги поднимаются в момент звучания, голоса выходят вперёд, погода и гул уровня становятся тише или громче, а мир окружает вас. Задержки не добавляет.',
  'dsp.footsteps.isolate': 'Изолировать',
  'dsp.footsteps.isolateHint': 'Слушать только то, что меняет Игра.',
  'dsp.footsteps.isolateOn':
    'Звучит только то, что меняет Игра. Вы должны слышать, как поднимаются шаги и мелкие звуки, но никогда не выстрелы.',
  'dsp.footsteps.engineOld':
    'Для Игры нужен новейший FluidEQ Engine. Остальная цепочка играет; этот фильтр заработает после обновления движка.',

  'dsp.footsteps.lift': 'Подъём',
  'dsp.footsteps.liftHint':
    'Насколько поднимается тихий звук, пока он звучит. То, что уже громко, остаётся как есть.',
  'dsp.footsteps.calm': 'Смягчение',
  'dsp.footsteps.upTo': 'До {db} дБ',
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

  'dsp.footstepsPreset.competitive': 'Соревновательные',
  'dsp.footstepsPreset.competitiveGames': 'CS2, Valorant, Rainbow Six',
  'dsp.footstepsPreset.battleRoyale': 'Королевская битва',
  'dsp.footstepsPreset.battleRoyaleGames': 'Warzone, Apex, PUBG, Fortnite',
  'dsp.footstepsPreset.tactical': 'Тактическое выживание',
  'dsp.footstepsPreset.tacticalGames': 'Tarkov, Hunt, Arma',
  'dsp.footstepsPreset.story': 'Сюжет и хоррор',
  'dsp.footstepsPreset.storyGames': 'Одиночные игры и открытые миры',

  'dsp.footstepsPresetGroup.kinds': 'По типу игры',
  'dsp.footstepsPresetGroup.competitive': 'Соревновательные шутеры',
  'dsp.footstepsPresetGroup.battle': 'Королевские битвы и большие сражения',
  'dsp.footstepsPresetGroup.tactical': 'Тактика и выживание',
  'dsp.footstepsPresetGroup.moba': 'MOBA и стратегии',
  'dsp.footstepsPresetGroup.rpg': 'MMO и RPG',
  'dsp.footstepsPresetGroup.story': 'Сюжет и хоррор',
  'dsp.footstepsPreset.immersive': 'Любая игра, комната вокруг вас',
  'dsp.footstepsPreset.immersiveGames': 'Стереоигры в наушниках',
  'dsp.footstepsPreset.topDown': 'Сверху',
  'dsp.footstepsPreset.topDownGames': 'MOBA, RTS, стратегии',
  'dsp.footstepsPreset.worlds': 'Миры',
  'dsp.footstepsPreset.worldsGames': 'MMO, RPG с открытым миром',
  'dsp.footstepsPreset.speed': 'Скорость',
  'dsp.footstepsPreset.speedGames': 'Гонки и вождение',
  'dsp.footstepsPreset.impact': 'Удар',
  'dsp.footstepsPreset.impactGames': 'Файтинги, экшен, спорт',
  'dsp.game.hintOwn3d': 'Свой 3D-звук',
  'dsp.game.hintRoom': 'Комната: {room}',
  'dsp.game.noteOwn3d':
    '{game} сама расставляет звуки вокруг вас, поэтому комната выключена: с двумя сразу шаг звучал бы из двух мест.',
  'dsp.game.noteRoom': '{game}: в наушниках комната помещает её в {room}.',
  'dsp.game.engineOld':
    'Для диалогов, окружения и копыт нужен новейший FluidEQ Engine. Шаги уже работают; остальное заработает после обновления движка.',
  'dsp.game.footsteps': 'Шаги',
  'dsp.game.heavy': 'Копыта и тяжёлые шаги',
  'dsp.game.heavyHint':
    'Низкий глухой удар сапога или лошади тоже поднимается.',
  'dsp.game.dialogue': 'Диалоги',
  'dsp.game.dialogueHint':
    'Пока кто-то говорит в центре сцены, его голос выходит вперёд.',
  'dsp.game.voices': 'Голоса',
  'dsp.game.duck': 'Дать место голосам',
  'dsp.game.duckHint':
    'Музыка и эффекты немного отступают, пока звучит реплика.',
  'dsp.game.voiceMeter': 'Кто-то говорит',
  'dsp.game.environment': 'Окружение',
  'dsp.game.environmentHint':
    'Погода и гул уровня: дождь, ветер, гудение комнаты. Тише — чтобы слышать подсказки поверх, громче — ради атмосферы.',
  'dsp.game.environmentDial': 'Атмосфера',
  'dsp.game.environmentDown': 'Тише до {db} дБ',
  'dsp.game.environmentUp': 'Громче до {db} дБ',
  'dsp.game.environmentLeft': 'Как сделала игра',
  'dsp.game.ambienceMeter': 'Слышимое окружение',

  'dsp.game.hintNoRoom': 'Лучше без комнаты',
  'dsp.game.noteNoRoom':
    '{game} страшнее всего в своём исходном сведении, поэтому комната выключена.',

  // The Gaming tab's own presets, on every stage.
  'dsp.eqPresetGroup.gaming': 'Игры',
  'dsp.deEsserPresetGroup.gaming': 'Игры',
  'dsp.gamingPreset.tightLows': 'Собранный бас',
  'dsp.gamingPreset.impact': 'Удар',
  'dsp.gamingPreset.night': 'Ночь',
  'dsp.gamingPreset.positionSafe': 'Точное направление',
  'dsp.gamingPreset.openWorld': 'Открытый мир',
  'dsp.gamingPreset.battlefieldView': 'Вид на поле боя',
  'dsp.gamingPreset.cleanCeiling': 'Чистый потолок',
  'dsp.gamingPreset.battle': 'Бой',
  'dsp.gamingPreset.cinematicPunch': 'Кинематографичный удар',
  'dsp.gamingPreset.rumble': 'Гул на маленьких динамиках',
  'dsp.gamingPreset.engineWeight': 'Вес мотора',
  'dsp.gamingPreset.cueDetail': 'Детали сигналов',
  'dsp.gamingPreset.dullHeadset': 'Глухая гарнитура',
  'dsp.gamingPreset.callouts': 'Переговоры команды',
  'dsp.gamingPreset.footstepFocus': 'Шаги в фокусе',
  'dsp.gamingPreset.blastTamer': 'Укрощение взрывов',
  'dsp.gamingPreset.voicesForward': 'Голоса вперёд',
  'dsp.gamingPreset.cinematicWeight': 'Кинематографичный вес',
  'dsp.gamingPreset.dread': 'Жуть',
  'dsp.gamingPreset.engineTyres': 'Мотор и шины',
  'dsp.gamingPreset.abilityClarity': 'Чёткие способности',

  // The Gaming tab's whole-rack chains.
  'dsp.gamingChain.pinpoint': 'Точность',
  'dsp.gamingChain.blast': 'Пережить взрыв',
  'dsp.gamingChain.stealth': 'Скрытность',
  'dsp.gamingChain.cinematic': 'Кинематографично',
  'dsp.gamingChain.dread': 'Жуть',
  'dsp.gamingChain.topDown': 'Сверху',
  'dsp.gamingChain.worlds': 'Миры',
  'dsp.gamingChain.speed': 'Скорость',
  'dsp.gamingChain.impact': 'Удар',
  'dsp.gamingChain.night': 'Ночная игра',
};
