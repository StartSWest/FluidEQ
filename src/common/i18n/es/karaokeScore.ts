/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Karaoke's singing score: the verdicts, the line rows and the end card. */
import { Dictionary } from '../en';

const karaokeScore: Partial<Dictionary> = {
  'karaoke.score.title': 'Puntuación',
  'karaoke.score.verdictPerfect': 'Perfecto',
  'karaoke.score.verdictGood': 'Bien',
  'karaoke.score.verdictLate': 'Tarde',
  'karaoke.score.verdictLow': 'Bajo',
  'karaoke.score.verdictHigh': 'Alto',
  'karaoke.score.verdictMissed': 'Fallada',
  'karaoke.score.verdictSkipped': 'Sin puntuar',
  'karaoke.score.octaveMark': '{verdict} · 8ª',
  'karaoke.score.ratingExcellent': 'Excelente',
  'karaoke.score.ratingGreat': 'Muy bien',
  'karaoke.score.ratingGood': 'Bien',
  'karaoke.score.ratingFair': 'Regular',
  'karaoke.score.ratingPractice': 'A repasar',
  'karaoke.score.lineNumber': 'Línea {number}',
  'karaoke.score.lineWithText': '{line}, «{text}»',
  'karaoke.score.practiseLine': '{line}: cantarla otra vez',
  'karaoke.score.outOf': 'de {max}',
  'karaoke.score.streak': 'Racha',
  'karaoke.score.openReport': 'Ver resultados',
  'karaoke.score.close': 'Cerrar el resultado',
  'karaoke.score.recapTitle': 'Resumen',
  'karaoke.score.bestFirst': 'Tu primera marca en esta canción',
  'karaoke.score.bestNew': 'Nuevo récord · +{delta}',
  'karaoke.score.bestTied': 'Igualas tu récord',
  'karaoke.score.bestBehind': 'A {delta} de tu récord',
  'karaoke.score.inTune': 'Afinación',
  'karaoke.score.inTuneNote': 'del tiempo que cantaste dentro de la nota',
  'karaoke.score.onTime': 'A tiempo',
  'karaoke.score.onTimeNote': '{count} de {total} notas entraron a tiempo',
  'karaoke.score.notes': 'Notas',
  'karaoke.score.notesNote': 'acertadas',
  'karaoke.score.hardestTitle': 'Lo que más costó',
  'karaoke.score.hardestLow': '{line}: te quedaste unos {cents} cents abajo.',
  'karaoke.score.hardestHigh': '{line}: te fuiste unos {cents} cents arriba.',
  'karaoke.score.hardestLate': '{line}: entraste tarde en sus notas.',
  'karaoke.score.hardestMissed': '{line}: algunas de sus notas no se cantaron.',
  'karaoke.score.hardestLowest': '{line} fue la más baja, con {percent}.',
  'karaoke.score.tipTitle': 'Para la próxima',
  'karaoke.score.tipLow':
    'Piensa la nota un poco más arriba antes de cantarla y sostén el aire hasta el final para que no se caiga.',
  'karaoke.score.tipHigh':
    'Relaja la garganta y canta un poco más suave: empujar para sonar fuerte es lo que sube la nota.',
  'karaoke.score.tipLate':
    'Toma aire antes de la línea, no en su primera palabra, para que la primera nota entre a tiempo.',
  'karaoke.score.tipMissed':
    'Aprende la letra de las líneas que se quedaron sin cantar y cántalas suave con la grabación antes de ir a plena voz.',
  'karaoke.score.tipOctave':
    'Cantaste buena parte una octava aparte, y eso cuenta. Para igualar la grabación, prueba unas líneas en su propia octava.',
  'karaoke.score.tipClean':
    'Cantaste limpio de principio a fin. Prueba una canción más difícil, o esta con el tono de la melodía apagado.',
  'karaoke.score.practisePassage': 'Practicar ese pasaje',
  'karaoke.score.singAgain': 'Cantar otra vez',
  'karaoke.score.mapTitle': 'Mapa de la canción',
  'karaoke.score.mapSummary': '{points} puntos · {inTune} afinado',
  'karaoke.score.mapCanvas':
    'Todas las notas de la canción con el color de su resultado',
  'karaoke.score.deltaTitle': 'Contra tu mejor intento',
  'karaoke.score.historyTitle': 'Tus últimos intentos',
  'karaoke.score.historyNow': 'Ahora',
  'karaoke.score.historyBest': 'Tu mejor',
  'karaoke.score.progressTitle': 'Tu progreso',
  'karaoke.score.progressFirst':
    'Tu primera vez con esta canción: esta es la marca a superar.',
  'karaoke.score.progressSame':
    'Cada línea quedó donde estaba en tu mejor intento.',
  'karaoke.score.progressUp':
    '{line} es la que más mejoró desde tu mejor intento ({delta} puntos).',
  'karaoke.score.progressDown':
    '{line} bajó respecto a tu mejor intento ({delta}). Practícala sola dos o tres veces y vuelve a la canción entera.',
  'karaoke.score.progressUpDown':
    '{up} es la que más mejoró desde tu mejor intento ({delta} puntos). {down} bajó: practícala sola dos o tres veces y vuelve a la canción entera.',
};

export default karaokeScore;
