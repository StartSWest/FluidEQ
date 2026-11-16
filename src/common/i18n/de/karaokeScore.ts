/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Karaoke's singing score: the verdicts, the line rows and the end card. */
import { Dictionary } from '../en';

const karaokeScore: Partial<Dictionary> = {
  'karaoke.score.title': 'Punkte',
  'karaoke.score.verdictPerfect': 'Perfekt',
  'karaoke.score.verdictGood': 'Gut',
  'karaoke.score.verdictLate': 'Spät',
  'karaoke.score.verdictLow': 'Zu tief',
  'karaoke.score.verdictHigh': 'Zu hoch',
  'karaoke.score.verdictMissed': 'Verpasst',
  'karaoke.score.verdictSkipped': 'Nicht gewertet',
  'karaoke.score.octaveMark': '{verdict} · 8va',
  'karaoke.score.ratingExcellent': 'Hervorragend',
  'karaoke.score.ratingGreat': 'Sehr gut',
  'karaoke.score.ratingGood': 'Gut',
  'karaoke.score.ratingFair': 'Ausreichend',
  'karaoke.score.ratingPractice': 'Weiter üben',
  'karaoke.score.lineNumber': 'Zeile {number}',
  'karaoke.score.lineWithText': '{line}, „{text}“',
  'karaoke.score.practiseLine': '{line}: noch einmal singen',
  'karaoke.score.outOf': 'von {max}',
  'karaoke.score.streak': 'Serie',
  'karaoke.score.close': 'Ergebnis schließen',
  'karaoke.score.recapTitle': 'Zusammenfassung',
  'karaoke.score.bestFirst': 'Ihr erstes Ergebnis bei diesem Song',
  'karaoke.score.bestNew': 'Neuer Rekord · +{delta}',
  'karaoke.score.bestTied': 'So gut wie Ihr Rekord',
  'karaoke.score.bestBehind': '{delta} unter Ihrem Rekord',
  'karaoke.score.inTune': 'Treffsicherheit',
  'karaoke.score.inTuneNote': 'der Zeit, die Sie in der Note gesungen haben',
  'karaoke.score.onTime': 'Im Takt',
  'karaoke.score.onTimeNote': '{count} von {total} Noten pünktlich eingesetzt',
  'karaoke.score.notes': 'Noten',
  'karaoke.score.notesNote': 'getroffen',
  'karaoke.score.hardestTitle': 'Am schwierigsten',
  'karaoke.score.hardestLow': '{line}: Sie lagen etwa {cents} Cent zu tief.',
  'karaoke.score.hardestHigh': '{line}: Sie lagen etwa {cents} Cent zu hoch.',
  'karaoke.score.hardestLate':
    '{line}: Sie haben bei ihren Noten zu spät eingesetzt.',
  'karaoke.score.hardestMissed':
    '{line}: Einige ihrer Noten blieben ungesungen.',
  'karaoke.score.hardestLowest': '{line} lag am niedrigsten, bei {percent}.',
  'karaoke.score.tipTitle': 'Für das nächste Mal',
  'karaoke.score.tipLow':
    'Denken Sie die Note etwas höher, bevor Sie sie singen, und halten Sie den Atem bis zum Ende, damit sie nicht absinkt.',
  'karaoke.score.tipHigh':
    'Entspannen Sie den Hals und singen Sie etwas leiser: Wer auf Kraft drückt, treibt die Note nach oben.',
  'karaoke.score.tipLate':
    'Atmen Sie vor der Zeile ein, nicht auf ihrem ersten Wort, damit die erste Note auf dem Schlag kommt.',
  'karaoke.score.tipMissed':
    'Lernen Sie den Text der ausgelassenen Zeilen und singen Sie ihn leise mit der Aufnahme, bevor Sie voll aussingen.',
  'karaoke.score.tipOctave':
    'Sie haben vieles eine Oktave versetzt gesungen, und das zählt. Um die Aufnahme zu treffen, versuchen Sie ein paar Zeilen in ihrer Oktave.',
  'karaoke.score.tipClean':
    'Durchgehend sauber gesungen. Versuchen Sie einen schwierigeren Song oder diesen ohne den Melodieton.',
  'karaoke.score.practisePassage': 'Diese Stelle üben',
  'karaoke.score.singAgain': 'Noch einmal singen',
  'karaoke.score.mapTitle': 'Songkarte',
  'karaoke.score.mapSummary': '{points} Punkte · {inTune} getroffen',
  'karaoke.score.mapCanvas': 'Jede Note des Songs in der Farbe ihrer Wertung',
  'karaoke.score.deltaTitle': 'Im Vergleich zu Ihrem besten Versuch',
  'karaoke.score.historyTitle': 'Ihre letzten Versuche',
  'karaoke.score.historyNow': 'Jetzt',
  'karaoke.score.historyBest': 'Ihr Rekord',
  'karaoke.score.progressTitle': 'Ihr Fortschritt',
  'karaoke.score.progressFirst':
    'Ihr erster Durchgang bei diesem Song: Das ist das Ergebnis, das es zu schlagen gilt.',
  'karaoke.score.progressSame':
    'Jede Zeile lag dort, wo sie in Ihrem besten Versuch lag.',
  'karaoke.score.progressUp':
    '{line} hat sich seit Ihrem besten Versuch am meisten verbessert ({delta} Punkte).',
  'karaoke.score.progressDown':
    '{line} ist gegenüber Ihrem besten Versuch zurückgefallen ({delta}). Üben Sie sie zwei- oder dreimal allein und singen Sie dann den ganzen Song.',
  'karaoke.score.progressUpDown':
    '{up} hat sich seit Ihrem besten Versuch am meisten verbessert ({delta} Punkte). {down} ist zurückgefallen: Üben Sie sie zwei- oder dreimal allein und singen Sie dann den ganzen Song.',
};

export default karaokeScore;
