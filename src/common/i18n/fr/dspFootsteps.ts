/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': 'Jeu',
  'dsp.footsteps.description':
    'Tout ce qui fait bien sonner un jeu : les pas discrets remontent dès qu’ils arrivent, les voix passent devant, la météo et le bourdonnement d’un niveau baissent ou montent, et le monde vous entoure. Aucun retard ajouté.',
  'dsp.footsteps.isolate': 'Isoler',
  'dsp.footsteps.isolateHint': 'N’entendre que ce que Jeu modifie.',
  'dsp.footsteps.isolateOn':
    'Seul ce que Jeu modifie est joué. Vous devriez entendre monter des pas et de petits sons, jamais des tirs.',
  'dsp.footsteps.engineOld':
    'Jeu a besoin du FluidEQ Engine le plus récent. Le reste du rack joue ; ce filtre démarre dès que le moteur est mis à jour.',

  'dsp.footsteps.lift': 'Relever',
  'dsp.footsteps.liftHint':
    'De combien un son discret est relevé pendant qu’il arrive. Ce qui est déjà fort reste tel quel.',
  'dsp.footsteps.calm': 'Apaiser',
  'dsp.footsteps.upTo': 'Jusqu’à {db} dB',
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

  'dsp.footstepsPreset.competitive': 'Compétitif',
  'dsp.footstepsPreset.competitiveGames': 'CS2, Valorant, Rainbow Six',
  'dsp.footstepsPreset.battleRoyale': 'Battle royale',
  'dsp.footstepsPreset.battleRoyaleGames': 'Warzone, Apex, PUBG, Fortnite',
  'dsp.footstepsPreset.tactical': 'Survie tactique',
  'dsp.footstepsPreset.tacticalGames': 'Tarkov, Hunt, Arma',
  'dsp.footstepsPreset.story': 'Histoire et horreur',
  'dsp.footstepsPreset.storyGames': 'Jeux solo et mondes ouverts',

  'dsp.footstepsPresetGroup.kinds': 'Par type de jeu',
  'dsp.footstepsPresetGroup.competitive': 'Jeux de tir compétitifs',
  'dsp.footstepsPresetGroup.battle': 'Battle royale et grandes batailles',
  'dsp.footstepsPresetGroup.tactical': 'Tactique et survie',
  'dsp.footstepsPresetGroup.moba': 'MOBA et stratégie',
  'dsp.footstepsPresetGroup.rpg': 'MMO et RPG',
  'dsp.footstepsPresetGroup.story': 'Histoire et horreur',
  'dsp.footstepsPreset.immersive': 'Tout jeu, la salle autour de vous',
  'dsp.footstepsPreset.immersiveGames': 'Jeux en stéréo au casque',
  'dsp.footstepsPreset.topDown': 'Vue du dessus',
  'dsp.footstepsPreset.topDownGames': 'MOBA, RTS, stratégie',
  'dsp.footstepsPreset.worlds': 'Mondes',
  'dsp.footstepsPreset.worldsGames': 'MMO, RPG en monde ouvert',
  'dsp.footstepsPreset.speed': 'Vitesse',
  'dsp.footstepsPreset.speedGames': 'Course et conduite',
  'dsp.footstepsPreset.impact': 'Impact',
  'dsp.footstepsPreset.impactGames': 'Combat, action, sport',
  'dsp.game.hintOwn3d': 'Son 3D intégré',
  'dsp.game.hintRoom': 'Salle : {room}',
  'dsp.game.noteOwn3d':
    '{game} place lui-même ses sons autour de vous, donc la salle reste coupée : avec les deux, un pas viendrait de deux endroits.',
  'dsp.game.noteRoom': '{game} : au casque, la salle le place dans {room}.',
  'dsp.game.engineOld':
    'Dialogue, Environnement et les sabots ont besoin du FluidEQ Engine le plus récent. Pas joue déjà ; le reste démarre dès que le moteur est mis à jour.',
  'dsp.game.footsteps': 'Pas',
  'dsp.game.heavy': 'Sabots et pas lourds',
  'dsp.game.heavyHint':
    'Le choc sourd d’une botte ou d’un cheval remonte aussi.',
  'dsp.game.dialogue': 'Dialogue',
  'dsp.game.dialogueHint':
    'Quand quelqu’un parle au centre de la scène, sa voix passe devant.',
  'dsp.game.voices': 'Voix',
  'dsp.game.duck': 'Faire place aux voix',
  'dsp.game.duckHint':
    'La musique et les effets reculent un peu pendant qu’une réplique est dite.',
  'dsp.game.voiceMeter': 'Quelqu’un parle',
  'dsp.game.environment': 'Environnement',
  'dsp.game.environmentHint':
    'La météo et le bourdonnement d’un niveau : pluie, vent, le grondement d’une pièce. Baissez pour entendre les indices par-dessus, montez pour l’atmosphère.',
  'dsp.game.environmentDial': 'Ambiance',
  'dsp.game.environmentDown': 'Baisse jusqu’à {db} dB',
  'dsp.game.environmentUp': 'Monte jusqu’à {db} dB',
  'dsp.game.environmentLeft': 'Tel que le jeu l’a fait',
  'dsp.game.ambienceMeter': 'Environnement entendu',

  'dsp.game.hintNoRoom': 'Mieux sans la salle',
  'dsp.game.noteNoRoom':
    '{game} fait plus peur tel qu’il a été mixé, donc la salle reste coupée.',

  // The Gaming tab's own presets, on every stage.
  'dsp.eqPresetGroup.gaming': 'Jeux',
  'dsp.deEsserPresetGroup.gaming': 'Jeux',
  'dsp.gamingPreset.tightLows': 'Basses serrées',
  'dsp.gamingPreset.impact': 'Impact',
  'dsp.gamingPreset.night': 'Nuit',
  'dsp.gamingPreset.positionSafe': 'Position fidèle',
  'dsp.gamingPreset.openWorld': 'Monde ouvert',
  'dsp.gamingPreset.battlefieldView': 'Vue du champ de bataille',
  'dsp.gamingPreset.cleanCeiling': 'Plafond propre',
  'dsp.gamingPreset.battle': 'Bataille',
  'dsp.gamingPreset.cinematicPunch': 'Punch cinéma',
  'dsp.gamingPreset.rumble': 'Grondement sur petits haut-parleurs',
  'dsp.gamingPreset.engineWeight': 'Poids du moteur',
  'dsp.gamingPreset.cueDetail': 'Détail des indices',
  'dsp.gamingPreset.dullHeadset': 'Casque terne',
  'dsp.gamingPreset.callouts': 'Annonces d’équipe',
  'dsp.gamingPreset.footstepFocus': 'Pas en avant',
  'dsp.gamingPreset.blastTamer': 'Frein à explosions',
  'dsp.gamingPreset.voicesForward': 'Voix en avant',
  'dsp.gamingPreset.cinematicWeight': 'Poids cinéma',
  'dsp.gamingPreset.dread': 'Effroi',
  'dsp.gamingPreset.engineTyres': 'Moteur et pneus',
  'dsp.gamingPreset.abilityClarity': 'Compétences claires',

  // The Gaming tab's whole-rack chains.
  'dsp.gamingChain.pinpoint': 'Précision',
  'dsp.gamingChain.blast': 'Survivre aux explosions',
  'dsp.gamingChain.stealth': 'Infiltration',
  'dsp.gamingChain.cinematic': 'Cinématique',
  'dsp.gamingChain.dread': 'Effroi',
  'dsp.gamingChain.topDown': 'Vue du dessus',
  'dsp.gamingChain.worlds': 'Mondes',
  'dsp.gamingChain.speed': 'Vitesse',
  'dsp.gamingChain.impact': 'Impact',
  'dsp.gamingChain.night': 'Jouer la nuit',
};
