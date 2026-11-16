/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Karaoke's singing score: the verdicts, the line rows and the end card. */
import { Dictionary } from '../en';

const karaokeScore: Partial<Dictionary> = {
  'karaoke.score.title': 'Очки',
  'karaoke.score.verdictPerfect': 'Идеально',
  'karaoke.score.verdictGood': 'Хорошо',
  'karaoke.score.verdictLate': 'Поздно',
  'karaoke.score.verdictLow': 'Низко',
  'karaoke.score.verdictHigh': 'Высоко',
  'karaoke.score.verdictMissed': 'Пропуск',
  'karaoke.score.verdictSkipped': 'Без оценки',
  'karaoke.score.octaveMark': '{verdict} · окт.',
  'karaoke.score.ratingExcellent': 'Отлично',
  'karaoke.score.ratingGreat': 'Очень хорошо',
  'karaoke.score.ratingGood': 'Хорошо',
  'karaoke.score.ratingFair': 'Неплохо',
  'karaoke.score.ratingPractice': 'Стоит повторить',
  'karaoke.score.lineNumber': 'Строка {number}',
  'karaoke.score.lineWithText': '{line}, «{text}»',
  'karaoke.score.practiseLine': '{line}: спеть ещё раз',
  'karaoke.score.outOf': 'из {max}',
  'karaoke.score.streak': 'Серия',
  'karaoke.score.close': 'Закрыть результат',
  'karaoke.score.recapTitle': 'Итог',
  'karaoke.score.bestFirst': 'Ваш первый результат в этой песне',
  'karaoke.score.bestNew': 'Новый рекорд · +{delta}',
  'karaoke.score.bestTied': 'Наравне с вашим рекордом',
  'karaoke.score.bestBehind': 'На {delta} меньше вашего рекорда',
  'karaoke.score.inTune': 'Точность',
  'karaoke.score.inTuneNote': 'времени, спетого внутри ноты',
  'karaoke.score.onTime': 'Вовремя',
  'karaoke.score.onTimeNote': '{count} из {total} нот вступили вовремя',
  'karaoke.score.notes': 'Ноты',
  'karaoke.score.notesNote': 'попадание',
  'karaoke.score.hardestTitle': 'Сложнее всего',
  'karaoke.score.hardestLow':
    '{line}: вы пели примерно на {cents} центов ниже.',
  'karaoke.score.hardestHigh':
    '{line}: вы пели примерно на {cents} центов выше.',
  'karaoke.score.hardestLate': '{line}: вы вступали на её нотах с опозданием.',
  'karaoke.score.hardestMissed': '{line}: часть её нот осталась не спета.',
  'karaoke.score.hardestLowest': '{line} получила меньше всего — {percent}.',
  'karaoke.score.tipTitle': 'В следующий раз',
  'karaoke.score.tipLow':
    'Представьте ноту чуть выше, прежде чем петь, и держите дыхание до конца, чтобы она не проседала.',
  'karaoke.score.tipHigh':
    'Расслабьте горло и пойте чуть мягче: нажим ради громкости и уводит ноту вверх.',
  'karaoke.score.tipLate':
    'Берите дыхание перед строкой, а не на её первом слове, чтобы первая нота вступала в долю.',
  'karaoke.score.tipMissed':
    'Выучите слова пропущенных строк и тихо пропойте их вместе с записью, прежде чем петь в полный голос.',
  'karaoke.score.tipOctave':
    'Вы спели многое на октаву в стороне, и это засчитывается. Чтобы совпасть с записью, попробуйте несколько строк в её октаве.',
  'karaoke.score.tipClean':
    'Чисто от начала до конца. Попробуйте песню сложнее или эту без тона мелодии.',
  'karaoke.score.practisePassage': 'Отработать этот отрывок',
  'karaoke.score.singAgain': 'Спеть ещё раз',
  'karaoke.score.mapTitle': 'Карта песни',
  'karaoke.score.mapSummary': '{points} очков · {inTune} точно',
  'karaoke.score.mapCanvas': 'Все ноты песни цветом их оценки',
  'karaoke.score.deltaTitle': 'По сравнению с вашей лучшей попыткой',
  'karaoke.score.historyTitle': 'Ваши последние попытки',
  'karaoke.score.historyNow': 'Сейчас',
  'karaoke.score.historyBest': 'Рекорд',
  'karaoke.score.progressTitle': 'Ваш прогресс',
  'karaoke.score.progressFirst':
    'Вы впервые поёте эту песню: вот результат, который нужно превзойти.',
  'karaoke.score.progressSame':
    'Каждая строка осталась на уровне вашей лучшей попытки.',
  'karaoke.score.progressUp':
    '{line} улучшилась больше всех со времени вашей лучшей попытки ({delta} очков).',
  'karaoke.score.progressDown':
    '{line} просела по сравнению с вашей лучшей попыткой ({delta}). Отработайте её отдельно два-три раза, а затем спойте песню целиком.',
  'karaoke.score.progressUpDown':
    '{up} улучшилась больше всех со времени вашей лучшей попытки ({delta} очков). {down} просела: отработайте её отдельно два-три раза, а затем спойте песню целиком.',
};

export default karaokeScore;
