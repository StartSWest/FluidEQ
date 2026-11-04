/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.appliedGain': 'Gain appliqué',
  'dsp.dynamics.graphHint':
    'Musique avant et après Dynamics. La courbe monte lors du renforcement et descend lors de la compression.',
  'dsp.dynamics.engineLiveOld':
    'Mettez le moteur à jour pour voir Dynamics en direct. Le son est déjà traité.',
  'dsp.dynamics.title': 'Dynamique',
  'dsp.dynamics.description':
    'Remonte ce qui est faible et retient ce qui est fort, sur trois bandes, pour qu’un murmure et une explosion se rejoignent au milieu. Aucun retard ajouté.',
  'dsp.dynamics.engineOld':
    'Dynamique demande le FluidEQ Engine le plus récent. Le reste du rack joue ; ce filtre démarre une fois le moteur mis à jour.',
  'dsp.dynamics.graphLabel': 'Ce que chaque bande fait de son niveau',
  'dsp.dynamics.band.low': 'Graves',
  'dsp.dynamics.band.lowHint':
    'Sous 150 Hz : le grondement d’une explosion, une grosse caisse, un moteur.',
  'dsp.dynamics.band.mid': 'Médiums',
  'dsp.dynamics.band.midHint':
    'De 150 Hz à 4 kHz : les voix, les pas et l’essentiel du son.',
  'dsp.dynamics.band.high': 'Aigus',
  'dsp.dynamics.band.highHint':
    'Au-dessus de 4 kHz : le détail, l’air, l’arête d’un pas.',
  'dsp.dynamics.lift': 'Remonter',
  'dsp.dynamics.hold': 'Retenir',
  'dsp.dynamics.upThreshold': 'Sous',
  'dsp.dynamics.upRatio': 'Rapport',
  'dsp.dynamics.upMax': 'Jusqu’à',
  'dsp.dynamics.downThreshold': 'Au-dessus de',
  'dsp.dynamics.downRatio': 'Rapport',
  'dsp.dynamics.timing': 'Temps et niveau',
  'dsp.dynamics.timingHint':
    'La vitesse à laquelle la retenue arrive et la remontée revient, et le niveau du résultat.',
  'dsp.dynamics.attack': 'Attaque',
  'dsp.dynamics.release': 'Relâchement',
  'dsp.dynamics.makeup': 'Compensation',
  'dsp.dynamics.mix': 'Mélange',
  'dsp.dynamicsPreset.gentle': 'Nivellement doux',
  'dsp.dynamicsPreset.speech': 'Parole',
  'dsp.gamingPreset.quietLift': 'Remonter le faible',
  'dsp.gamingPreset.blastGuard': 'Garde anti-explosions',
  'dsp.gamingPreset.longSession': 'Longue session',
  'dsp.gamingPreset.competitiveLight': 'Compétition légère',
};
