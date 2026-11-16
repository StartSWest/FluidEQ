/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Karaoke's singing score: the verdicts, the line rows and the end card. */
import { Dictionary } from '../en';

const karaokeScore: Partial<Dictionary> = {
  'karaoke.score.title': 'Punteggio',
  'karaoke.score.verdictPerfect': 'Perfetto',
  'karaoke.score.verdictGood': 'Bene',
  'karaoke.score.verdictLate': 'In ritardo',
  'karaoke.score.verdictLow': 'Calante',
  'karaoke.score.verdictHigh': 'Crescente',
  'karaoke.score.verdictMissed': 'Mancata',
  'karaoke.score.verdictSkipped': 'Non valutata',
  'karaoke.score.octaveMark': '{verdict} · 8ª',
  'karaoke.score.ratingExcellent': 'Eccellente',
  'karaoke.score.ratingGreat': 'Molto bene',
  'karaoke.score.ratingGood': 'Bene',
  'karaoke.score.ratingFair': 'Sufficiente',
  'karaoke.score.ratingPractice': 'Da ripassare',
  'karaoke.score.lineNumber': 'Riga {number}',
  'karaoke.score.lineWithText': '{line}, «{text}»',
  'karaoke.score.practiseLine': '{line}: cantala di nuovo',
  'karaoke.score.outOf': 'su {max}',
  'karaoke.score.streak': 'Serie',
  'karaoke.score.close': 'Chiudi il risultato',
  'karaoke.score.recapTitle': 'Riepilogo',
  'karaoke.score.bestFirst': 'Il tuo primo punteggio su questo brano',
  'karaoke.score.bestNew': 'Nuovo record · +{delta}',
  'karaoke.score.bestTied': 'Pari al tuo record',
  'karaoke.score.bestBehind': 'A {delta} dal tuo record',
  'karaoke.score.inTune': 'Intonazione',
  'karaoke.score.inTuneNote': 'del tempo cantato dentro la nota',
  'karaoke.score.onTime': 'A tempo',
  'karaoke.score.onTimeNote': '{count} note su {total} entrate a tempo',
  'karaoke.score.notes': 'Note',
  'karaoke.score.notesNote': 'prese',
  'karaoke.score.hardestTitle': 'La parte più difficile',
  'karaoke.score.hardestLow': '{line}: sei rimasto circa {cents} cent sotto.',
  'karaoke.score.hardestHigh': '{line}: sei andato circa {cents} cent sopra.',
  'karaoke.score.hardestLate': '{line}: sei entrato in ritardo sulle sue note.',
  'karaoke.score.hardestMissed':
    '{line}: alcune sue note non sono state cantate.',
  'karaoke.score.hardestLowest': '{line} ha preso meno, con {percent}.',
  'karaoke.score.tipTitle': 'Per la prossima volta',
  'karaoke.score.tipLow':
    'Pensa la nota un po’ più in alto prima di cantarla e sostieni il fiato fino alla fine, così non cala.',
  'karaoke.score.tipHigh':
    'Rilassa la gola e canta un po’ più piano: spingere per avere potenza è ciò che fa crescere la nota.',
  'karaoke.score.tipLate':
    'Prendi fiato prima della riga, non sulla prima parola, così la prima nota parte a tempo.',
  'karaoke.score.tipMissed':
    'Impara il testo delle righe rimaste mute e cantale piano insieme alla registrazione prima di andare a piena voce.',
  'karaoke.score.tipOctave':
    'Hai cantato buona parte a un’ottava di distanza, e conta. Per raggiungere la registrazione, prova qualche riga nella sua ottava.',
  'karaoke.score.tipClean':
    'Canto pulito dall’inizio alla fine. Prova un brano più difficile, o questo con il tono della melodia spento.',
  'karaoke.score.practisePassage': 'Esercitati su quel passaggio',
  'karaoke.score.singAgain': 'Canta di nuovo',
  'karaoke.score.mapTitle': 'Mappa del brano',
  'karaoke.score.mapSummary': '{points} punti · {inTune} intonato',
  'karaoke.score.mapCanvas': 'Ogni nota del brano nel colore del suo esito',
  'karaoke.score.deltaTitle': 'Rispetto al tuo miglior tentativo',
  'karaoke.score.historyTitle': 'I tuoi ultimi tentativi',
  'karaoke.score.historyNow': 'Ora',
  'karaoke.score.historyBest': 'Il tuo record',
  'karaoke.score.progressTitle': 'I tuoi progressi',
  'karaoke.score.progressFirst':
    'La prima volta con questo brano: questo è il punteggio da battere.',
  'karaoke.score.progressSame':
    'Ogni riga è rimasta dov’era nel tuo miglior tentativo.',
  'karaoke.score.progressUp':
    '{line} è migliorata di più dal tuo miglior tentativo ({delta} punti).',
  'karaoke.score.progressDown':
    '{line} è peggiorata rispetto al tuo miglior tentativo ({delta}). Esercitala da sola due o tre volte, poi canta di nuovo tutto il brano.',
  'karaoke.score.progressUpDown':
    '{up} è migliorata di più dal tuo miglior tentativo ({delta} punti). {down} è peggiorata: esercitala da sola due o tre volte, poi canta di nuovo tutto il brano.',
};

export default karaokeScore;
