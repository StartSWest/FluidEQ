/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab: each microphone's own sound, played by the FluidEQ Engine on
 * the microphone itself, so every app hears it (Ivan, 2026-11-20).
 */
export default {
  'mic.tab': 'Micro',
  'mic.label': 'Microphone',
  'mic.pickHint': 'Choisissez le micro dont vous voulez façonner le son',
  'mic.list.heading': 'Micros de ce PC',
  'mic.list.on': 'Activé',
  'mic.list.off': 'Non configuré',
  'mic.live': 'En direct dans toutes les applis · faible latence {ms} ms',
  'mic.notSetUp': 'Pas encore configuré sur ce micro',
  'mic.picture.label':
    'Votre voix : en pâle ce que capte le micro, en vif ce que les autres entendent',
  'mic.picture.raw': 'Votre micro',
  'mic.picture.heard': 'Ce que les autres entendent',
  'mic.picture.gate': 'Gate',
  'mic.profile.label': 'Profil de micro',
  'mic.profile.pickHint':
    'Partez d’un profil pensé pour l’usage que vous faites du micro',
  'mic.profile.group.use': 'Par usage',
  'mic.profile.group.mic': 'Par micro',
  'mic.profile.tuned': 'ajusté',
  'mic.profile.stream': 'Streaming',
  'mic.profile.stream.hint':
    'Chaleureux, proche et régulier pour Twitch et YouTube',
  'mic.profile.podcast': 'Podcast',
  'mic.profile.podcast.hint': 'Une voix naturelle, maîtrisée en douceur',
  'mic.profile.chat': 'Chat de jeu',
  'mic.profile.chat.hint':
    'Claire et en avant sur Discord et le chat d’équipe, rien entre les mots',
  'mic.profile.sing': 'Chant',
  'mic.profile.sing.hint':
    'Ouvert et aérien, sans pompage, chaque respiration conservée',
  'mic.profile.broadcast': 'Radio',
  'mic.profile.broadcast.hint':
    'Voix radio : des graves amples, un son serré et dense',
  'mic.profile.noisy': 'Pièce bruyante',
  'mic.profile.noisy.hint':
    'Ventilateurs, enfants, circulation : nettoyeur et gate au maximum',
  'mic.profile.meet': 'Réunions',
  'mic.profile.meet.hint':
    'Teams et Zoom : des mots clairs, en laissant leur propre nettoyage à ces applis',
  'mic.profile.laptop': 'Micro de portable',
  'mic.profile.laptop.hint':
    'Maigre, lointain et réverbérant : coupe-bas haut, nettoyeur appuyé',
  'mic.profile.headset': 'Micro de casque',
  'mic.profile.headset.hint':
    'Une petite capsule près de la bouche : la chaleur revient, les plosives partent',
  'mic.reset': 'Revenir à {profile}',
  'mic.setup.title': 'Le FluidEQ Engine n’est pas encore installé sur {mic}.',
  'mic.setup.body':
    'Windows demande l’autorisation une seule fois. Vos sorties continuent de jouer pendant l’installation.',
  'mic.setup.button': 'Installer sur ce micro',
  'mic.setup.working': 'Installation…',
  'mic.setup.declined':
    'Windows n’a pas donné l’autorisation, rien n’a donc été modifié.',
  'mic.setup.failed': 'Impossible de l’installer sur ce micro.',
  'mic.notFluid.title':
    'Le son propre d’un micro est joué par le FluidEQ Engine.',
  'mic.notFluid.body':
    'Son réglage est conservé et s’appliquera dès que le FluidEQ Engine sera le moteur choisi.',
  'mic.empty.title': 'Aucun microphone trouvé',
  'mic.empty.body':
    'Branchez un microphone, ou mettez à jour le FluidEQ Engine pour qu’il puisse les lister.',
  'mic.stage.lowCut': 'Coupe-bas',
  'mic.stage.cleaner': 'Nettoyeur vocal',
  'mic.stage.gate': 'Gate',
  'mic.stage.deEsser': 'Dé-esseur',
  'mic.stage.eq': 'EQ',
  'mic.stage.compressor': 'Compresseur',
  'mic.stage.limiter': 'Limiteur',
  'mic.lowCut.title': 'Coupe-bas',
  'mic.lowCut.description':
    'Retire le grondement, les coups sur le bureau et le ventilateur sous la voix, avant que le nettoyeur ne les entende.',
  'mic.lowCut.group.below': 'Sous la voix',
  'mic.lowCut.group.belowHint':
    'Près du micro retire le surplus de graves qu’une voix prend à quelques centimètres de la capsule.',
  'mic.lowCut.cut': 'Coupe sous',
  'mic.lowCut.proximity': 'Près du micro',
  'mic.lowCut.group.pops': 'Plosives',
  'mic.lowCut.group.popsHint':
    'Adoucit le choc d’un P ou d’un B et laisse une voix régulière intacte.',
  'mic.lowCut.plosive': 'Anti-pop',
  'mic.gate.title': 'Gate',
  'mic.gate.description':
    'Ferme le micro entre les mots pour que la pièce, le ventilateur et le clavier restent dehors. Avec une faible plage, il devient un expandeur doux.',
  'mic.gate.group.level': 'Quand il s’ouvre',
  'mic.gate.group.levelHint':
    'Surveillez la ligne pointillée sur l’image : votre voix doit la dépasser, la pièce doit rester en dessous.',
  'mic.gate.threshold': 'S’ouvre à',
  'mic.gate.range': 'Atténue de',
  'mic.gate.group.time': 'À quelle vitesse',
  'mic.gate.group.timeHint':
    'Le maintien le garde ouvert entre les syllabes, pour ne jamais couper la fin des mots.',
  'mic.gate.attack': 'S’ouvre en',
  'mic.gate.hold': 'Maintien',
  'mic.gate.release': 'Se ferme en',
};
