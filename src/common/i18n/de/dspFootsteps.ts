/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': 'Schritte',
  'dsp.footsteps.description':
    'Hebt die leisen Geräusche eines Spiels an, etwa Schritte, Nachladen und Türen, während sie erklingen. Schüsse, Explosionen, Regen und Echos bleiben, wie sie sind, beide Ohren bekommen dieselbe Anhebung, und es entsteht keine Verzögerung.',
  'dsp.footsteps.isolate': 'Isolieren',
  'dsp.footsteps.isolateHint': 'Nur hören, was Schritte hinzufügt.',
  'dsp.footsteps.isolateOn':
    'Es spielt nur, was Schritte hinzufügt. Sie sollten Schritte und andere kleine Geräusche hören, nie Schüsse.',
  'dsp.footsteps.engineOld':
    'Schritte braucht die neueste FluidEQ Engine. Der Rest des Racks spielt; diese Stufe startet, sobald die Engine aktualisiert ist.',

  'dsp.footsteps.lift': 'Anheben',
  'dsp.footsteps.liftHint':
    'Wie weit ein leises Geräusch angehoben wird, während es eintrifft. Was schon laut ist, bleibt, wie es ist.',
  'dsp.footsteps.calm': 'Dämpfen',
  'dsp.footsteps.calmHint':
    'Wie weit das Grollen einer Explosion abgesenkt wird. Es lässt binnen einer Zehntelsekunde los, damit der nächste Schritt zu hören ist.',
  'dsp.footsteps.upTo': 'Bis zu {db} dB',
  'dsp.footsteps.bands': 'Was angehoben wird',
  'dsp.footsteps.bandsHint':
    'Auf jedem Lautsprecher dieselbe Anhebung, damit ein Geräusch bleibt, wo es ist.',
  'dsp.footsteps.band.weight': 'Gewicht eines Schritts',
  'dsp.footsteps.band.steps': 'Schritte und Ausrüstung',
  'dsp.footsteps.band.detail': 'Vorn, hinten, oben und unten',

  'dsp.footsteps.graph.now': 'jetzt',
  'dsp.footsteps.graph.lifting': 'Hebt an',
  'dsp.footsteps.graph.calming': 'Dämpft',
  'dsp.footsteps.graph.background': 'Hintergrund',
  'dsp.footsteps.graph.isolate': 'Nur was hinzukommt',
  'dsp.footsteps.graph.everything': 'Alles',
  'dsp.footsteps.graph.steps': 'Schrittband',
  'dsp.footsteps.graph.lifted': 'Angehoben',
  'dsp.footsteps.graph.calmed': 'Gedämpft',

  'dsp.footstepsPresetGroup.games': 'Nach Art des Spiels',
  'dsp.footstepsPreset.competitive': 'Kompetitiv',
  'dsp.footstepsPreset.competitiveGames': 'CS2, Valorant, Rainbow Six',
  'dsp.footstepsPreset.battleRoyale': 'Battle Royale',
  'dsp.footstepsPreset.battleRoyaleGames': 'Warzone, Apex, PUBG, Fortnite',
  'dsp.footstepsPreset.tactical': 'Taktisches Überleben',
  'dsp.footstepsPreset.tacticalGames': 'Tarkov, Hunt, Arma',
  'dsp.footstepsPreset.story': 'Story und Horror',
  'dsp.footstepsPreset.storyGames': 'Einzelspieler und offene Welten',
};
