/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.key.now': 'La bande maintenant',
  'dsp.dynamics.key.lifted': 'Remonté',
  'dsp.dynamics.key.held': 'Retenu',
  'dsp.dynamics.untouched': 'Intact',
  'dsp.dynamics.dragHint':
    'Faites glisser un point : creux là où une bande commence, plein pour sa force.',
  'dsp.dynamics.idleHint':
    'Rien ne joue. Le point de chaque bande suit sa courbe dès que le son arrive.',
  'dsp.dynamics.state.lifting': 'Remonte',
  'dsp.dynamics.state.holding': 'Retient',
  'dsp.dynamics.state.silent': 'Aucun son',
  'dsp.dynamics.bands': 'Bandes',
  'dsp.dynamics.axisIn': 'Entrée',
  'dsp.dynamics.axisOut': 'Sortie',
  'dsp.dynamics.table.starts': 'Début',
  'dsp.dynamics.table.atMost': 'Au plus',
  'dsp.dynamics.table.liftUnder': 'Remonter sous',
  'dsp.dynamics.table.holdOver': 'Retenir au-dessus',
  'dsp.dynamics.point.liftStart': 'Où la remontée commence',
  'dsp.dynamics.point.liftTop': 'Jusqu’où va la remontée',
  'dsp.dynamics.point.liftPull': 'Créer une remontée',
  'dsp.dynamics.point.holdStart': 'Où la retenue commence',
  'dsp.dynamics.point.holdEnd': 'Force de la retenue',
  'dsp.dynamics.engineLiveOld':
    'Mettez le moteur à jour pour voir Dynamics en direct. Le son est déjà traité.',
  'dsp.dynamics.title': 'Dynamique',
  'dsp.dynamics.description':
    'Remonte ce qui est faible et retient ce qui est fort, sur trois bandes, pour qu’un murmure et une explosion se rejoignent au milieu. Aucun retard ajouté.',
  'dsp.dynamics.engineOld':
    'Dynamique demande le FluidEQ Engine le plus récent. Le reste du rack joue ; ce filtre démarre une fois le moteur mis à jour.',
  'dsp.dynamics.graphLabel': 'Ce que chaque bande fait de son niveau',
  'dsp.dynamics.band.low': 'Graves',
  'dsp.dynamics.band.lowRange': 'sous 150 Hz',
  'dsp.dynamics.band.lowHint':
    'Sous 150 Hz : le grondement d’une explosion, une grosse caisse, un moteur.',
  'dsp.dynamics.band.mid': 'Médiums',
  'dsp.dynamics.band.midRange': '150 Hz – 4 kHz',
  'dsp.dynamics.band.midHint':
    'De 150 Hz à 4 kHz : les voix, les pas et l’essentiel du son.',
  'dsp.dynamics.band.high': 'Aigus',
  'dsp.dynamics.band.highRange': 'au-dessus de 4 kHz',
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
