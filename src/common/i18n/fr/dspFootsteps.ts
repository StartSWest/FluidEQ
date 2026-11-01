/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': 'Bruits de pas',
  'dsp.footsteps.description':
    'Fait ressortir les sons discrets d’un jeu, comme les pas, les rechargements et les portes, au moment où ils se produisent. Les tirs, les explosions, la pluie et les échos restent tels quels, les deux oreilles reçoivent le même relèvement, et aucun retard n’est ajouté.',
  'dsp.footsteps.isolate': 'Isoler',
  'dsp.footsteps.isolateHint': 'N’entendre que ce qu’ajoute Bruits de pas.',
  'dsp.footsteps.isolateOn':
    'Seul ce qu’ajoute Bruits de pas est joué. Vous devriez entendre des pas et d’autres petits sons, jamais des tirs.',
  'dsp.footsteps.engineOld':
    'Bruits de pas a besoin du FluidEQ Engine le plus récent. Le reste du rack joue ; cet étage démarre dès que le moteur est mis à jour.',

  'dsp.footsteps.lift': 'Relever',
  'dsp.footsteps.liftHint':
    'De combien un son discret est relevé pendant qu’il arrive. Ce qui est déjà fort reste tel quel.',
  'dsp.footsteps.calm': 'Apaiser',
  'dsp.footsteps.calmHint':
    'De combien le grondement d’une explosion est baissé. Il est relâché en un dixième de seconde, pour que le pas suivant s’entende.',
  'dsp.footsteps.upTo': 'Jusqu’à {db} dB',
  'dsp.footsteps.bands': 'Ce qui est relevé',
  'dsp.footsteps.bandsHint':
    'Le même relèvement sur chaque enceinte, pour qu’un son reste là où il est.',
  'dsp.footsteps.band.weight': 'Poids d’un pas',
  'dsp.footsteps.band.steps': 'Pas et équipement',
  'dsp.footsteps.band.detail': 'Devant, derrière, haut et bas',

  'dsp.footsteps.graph.now': 'maintenant',
  'dsp.footsteps.graph.lifting': 'Relève',
  'dsp.footsteps.graph.calming': 'Apaise',
  'dsp.footsteps.graph.background': 'Fond',
  'dsp.footsteps.graph.isolate': 'Seulement ce qui est ajouté',
  'dsp.footsteps.graph.everything': 'Tout',
  'dsp.footsteps.graph.steps': 'Bande des pas',
  'dsp.footsteps.graph.lifted': 'Relevé',
  'dsp.footsteps.graph.calmed': 'Apaisé',

  'dsp.footstepsPresetGroup.games': 'Par type de jeu',
  'dsp.footstepsPreset.competitive': 'Compétitif',
  'dsp.footstepsPreset.competitiveGames': 'CS2, Valorant, Rainbow Six',
  'dsp.footstepsPreset.battleRoyale': 'Battle royale',
  'dsp.footstepsPreset.battleRoyaleGames': 'Warzone, Apex, PUBG, Fortnite',
  'dsp.footstepsPreset.tactical': 'Survie tactique',
  'dsp.footstepsPreset.tacticalGames': 'Tarkov, Hunt, Arma',
  'dsp.footstepsPreset.story': 'Histoire et horreur',
  'dsp.footstepsPreset.storyGames': 'Jeux solo et mondes ouverts',
};
