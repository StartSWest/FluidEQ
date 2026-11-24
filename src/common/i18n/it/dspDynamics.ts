/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.key.now': 'La banda ora',
  'dsp.dynamics.key.lifted': 'Alzato',
  'dsp.dynamics.key.held': 'Trattenuto',
  'dsp.dynamics.untouched': 'Intatto',
  'dsp.dynamics.dragHint':
    'Trascina un punto: vuoto dove inizia una banda, pieno per quanto agisce.',
  'dsp.dynamics.idleHint':
    'Non suona nulla. Il punto di ogni banda segue la sua curva appena arriva il suono.',
  'dsp.dynamics.state.lifting': 'Alza',
  'dsp.dynamics.state.holding': 'Trattiene',
  'dsp.dynamics.state.silent': 'Nessun suono',
  'dsp.dynamics.bands': 'Bande',
  'dsp.dynamics.axisIn': 'Ingresso',
  'dsp.dynamics.axisOut': 'Uscita',
  'dsp.dynamics.table.starts': 'Inizia',
  'dsp.dynamics.table.atMost': 'Al massimo',
  'dsp.dynamics.table.liftUnder': 'Alzare sotto',
  'dsp.dynamics.table.holdOver': 'Trattenere sopra',
  'dsp.dynamics.point.liftStart': 'Dove inizia l’alzata',
  'dsp.dynamics.point.liftTop': 'Fin dove arriva l’alzata',
  'dsp.dynamics.point.liftPull': 'Crea un’alzata',
  'dsp.dynamics.point.holdStart': 'Dove inizia la trattenuta',
  'dsp.dynamics.point.holdEnd': 'Quanto trattiene',
  'dsp.dynamics.engineLiveOld':
    'Aggiorna il motore per vedere Dynamics in movimento. Il suono viene già elaborato.',
  'dsp.dynamics.title': 'Dinamica',
  'dsp.dynamics.description':
    'Alza ciò che è piano e trattiene ciò che è forte, su tre bande, così un sussurro e un’esplosione si incontrano a metà. Non aggiunge ritardo.',
  'dsp.dynamics.engineOld':
    'Dinamica richiede il FluidEQ Engine più recente. Il resto del rack sta suonando; questo filtro parte quando il motore viene aggiornato.',
  'dsp.dynamics.graphLabel': 'Cosa fa ogni banda al suo livello',
  'dsp.dynamics.band.low': 'Bassi',
  'dsp.dynamics.band.lowRange': 'sotto 150 Hz',
  'dsp.dynamics.band.lowHint':
    'Sotto i 150 Hz: il boato di un’esplosione, una cassa, un motore.',
  'dsp.dynamics.band.mid': 'Medi',
  'dsp.dynamics.band.midRange': '150 Hz – 4 kHz',
  'dsp.dynamics.band.midHint':
    'Da 150 Hz a 4 kHz: voci, passi e quasi tutto il suono.',
  'dsp.dynamics.band.high': 'Alti',
  'dsp.dynamics.band.highRange': 'sopra 4 kHz',
  'dsp.dynamics.band.highHint':
    'Sopra i 4 kHz: dettaglio, aria, il bordo di un passo.',
  'dsp.dynamics.lift': 'Alzare',
  'dsp.dynamics.hold': 'Trattenere',
  'dsp.dynamics.upThreshold': 'Sotto',
  'dsp.dynamics.upRatio': 'Rapporto',
  'dsp.dynamics.upMax': 'Fino a',
  'dsp.dynamics.downThreshold': 'Sopra',
  'dsp.dynamics.downRatio': 'Rapporto',
  'dsp.dynamics.timing': 'Tempi e livello',
  'dsp.dynamics.timingHint':
    'Quanto in fretta arriva il trattenere e torna l’alzare, e quanto è forte il risultato.',
  'dsp.dynamics.attack': 'Attacco',
  'dsp.dynamics.release': 'Rilascio',
  'dsp.dynamics.makeup': 'Compensazione',
  'dsp.dynamics.mix': 'Mix',
  'dsp.dynamicsPreset.gentle': 'Livellamento dolce',
  'dsp.dynamicsPreset.speech': 'Parlato',
  'dsp.gamingPreset.quietLift': 'Alza il piano',
  'dsp.gamingPreset.blastGuard': 'Freno alle esplosioni',
  'dsp.gamingPreset.longSession': 'Sessione lunga',
  'dsp.gamingPreset.competitiveLight': 'Competitivo leggero',
};
