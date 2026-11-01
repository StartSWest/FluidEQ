/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': 'Passi',
  'dsp.footsteps.description':
    'Alza i suoni deboli di un gioco, come passi, ricariche e porte, mentre accadono. Spari, esplosioni, pioggia ed echi restano come sono, entrambe le orecchie ricevono lo stesso aumento e non aggiunge ritardo.',
  'dsp.footsteps.isolate': 'Isola',
  'dsp.footsteps.isolateHint': 'Ascolta solo ciò che aggiunge Passi.',
  'dsp.footsteps.isolateOn':
    'Suona solo ciò che aggiunge Passi. Dovresti sentire passi e altri piccoli suoni, mai spari.',
  'dsp.footsteps.engineOld':
    'Passi ha bisogno del FluidEQ Engine più recente. Il resto del rack suona; questo stadio parte appena il motore è aggiornato.',

  'dsp.footsteps.lift': 'Alza',
  'dsp.footsteps.liftHint':
    'Quanto sale un suono debole mentre arriva. Ciò che è già forte resta com’è.',
  'dsp.footsteps.calm': 'Calma',
  'dsp.footsteps.calmHint':
    'Quanto scende il rombo di un’esplosione. Lo rilascia entro un decimo di secondo, così il passo successivo si sente.',
  'dsp.footsteps.upTo': 'Fino a {db} dB',
  'dsp.footsteps.bands': 'Cosa alza',
  'dsp.footsteps.bandsHint':
    'Lo stesso aumento su ogni altoparlante, così un suono resta dov’è.',
  'dsp.footsteps.band.weight': 'Peso di un passo',
  'dsp.footsteps.band.steps': 'Passi ed equipaggiamento',
  'dsp.footsteps.band.detail': 'Davanti, dietro, sopra e sotto',

  'dsp.footsteps.graph.now': 'ora',
  'dsp.footsteps.graph.lifting': 'Alza',
  'dsp.footsteps.graph.calming': 'Calma',
  'dsp.footsteps.graph.background': 'Sfondo',
  'dsp.footsteps.graph.isolate': 'Solo ciò che aggiunge',
  'dsp.footsteps.graph.everything': 'Tutto',
  'dsp.footsteps.graph.steps': 'Banda dei passi',
  'dsp.footsteps.graph.lifted': 'Alzato',
  'dsp.footsteps.graph.calmed': 'Calmato',

  'dsp.footstepsPresetGroup.games': 'Per tipo di gioco',
  'dsp.footstepsPreset.competitive': 'Competitivo',
  'dsp.footstepsPreset.competitiveGames': 'CS2, Valorant, Rainbow Six',
  'dsp.footstepsPreset.battleRoyale': 'Battle royale',
  'dsp.footstepsPreset.battleRoyaleGames': 'Warzone, Apex, PUBG, Fortnite',
  'dsp.footstepsPreset.tactical': 'Sopravvivenza tattica',
  'dsp.footstepsPreset.tacticalGames': 'Tarkov, Hunt, Arma',
  'dsp.footstepsPreset.story': 'Storia e horror',
  'dsp.footstepsPreset.storyGames':
    'Giochi per giocatore singolo e mondi aperti',
};
