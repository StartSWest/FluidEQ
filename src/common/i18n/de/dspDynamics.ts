/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.appliedGain': 'Angewandte Verstärkung',
  'dsp.dynamics.graphHint':
    'Musik vor und nach Dynamics. Die Kurve steigt beim Anheben und sinkt beim Absenken.',
  'dsp.dynamics.engineLiveOld':
    'Aktualisiere die Engine, um Dynamics live zu sehen. Der Klang wird bereits verarbeitet.',
  'dsp.dynamics.title': 'Dynamik',
  'dsp.dynamics.description':
    'Hebt an, was leise ist, und hält zurück, was laut ist, in drei Bändern, sodass ein Flüstern und eine Explosion sich in der Mitte treffen. Es fügt keine Verzögerung hinzu.',
  'dsp.dynamics.engineOld':
    'Dynamik braucht die neueste FluidEQ Engine. Der Rest des Racks spielt; dieser Filter startet, sobald die Engine aktualisiert ist.',
  'dsp.dynamics.graphLabel': 'Was jedes Band mit seinem Pegel macht',
  'dsp.dynamics.band.low': 'Tiefen',
  'dsp.dynamics.band.lowHint':
    'Unter 150 Hz: das Dröhnen einer Explosion, eine Kick, ein Motor.',
  'dsp.dynamics.band.mid': 'Mitten',
  'dsp.dynamics.band.midHint':
    '150 Hz bis 4 kHz: Stimmen, Schritte und der Großteil des Klangs.',
  'dsp.dynamics.band.high': 'Höhen',
  'dsp.dynamics.band.highHint':
    'Über 4 kHz: Details, Luft, die Kante eines Schritts.',
  'dsp.dynamics.lift': 'Anheben',
  'dsp.dynamics.hold': 'Zurückhalten',
  'dsp.dynamics.upThreshold': 'Unter',
  'dsp.dynamics.upRatio': 'Verhältnis',
  'dsp.dynamics.upMax': 'Bis zu',
  'dsp.dynamics.downThreshold': 'Über',
  'dsp.dynamics.downRatio': 'Verhältnis',
  'dsp.dynamics.timing': 'Zeit und Pegel',
  'dsp.dynamics.timingHint':
    'Wie schnell das Zurückhalten einsetzt und das Anheben zurückkehrt, und wie laut das Ergebnis ist.',
  'dsp.dynamics.attack': 'Attack',
  'dsp.dynamics.release': 'Release',
  'dsp.dynamics.makeup': 'Ausgleich',
  'dsp.dynamics.mix': 'Mischung',
  'dsp.dynamicsPreset.gentle': 'Sanftes Ausgleichen',
  'dsp.dynamicsPreset.speech': 'Sprache',
  'dsp.gamingPreset.quietLift': 'Leises anheben',
  'dsp.gamingPreset.blastGuard': 'Explosionsschutz',
  'dsp.gamingPreset.longSession': 'Lange Sitzung',
  'dsp.gamingPreset.competitiveLight': 'Wettkampf leicht',
};
