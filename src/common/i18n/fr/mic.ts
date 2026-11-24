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
  'mic.live': 'En direct dans toutes les applis',
  'mic.notSetUp': 'Pas encore configuré sur ce micro',
  'mic.state.opening': 'Ouverture du micro…',
  'mic.state.noInput':
    'Windows n’affiche aucune entrée pour ce micro en ce moment',
  'mic.state.blocked': 'Windows n’a pas laissé FluidEQ ouvrir ce micro',
  'mic.state.waiting':
    'Micro ouvert · en attente du démarrage du moteur dessus',
  'mic.meter.gateOpen': 'La voix passe',
  'mic.meter.gateClosed': 'Gate fermé',
  'mic.meter.compressor': 'Compresseur',
  'mic.meter.limiter': 'Limiteur',
  'mic.monitor.label': 'Écouter le résultat final',
  'mic.monitor.hint':
    'Joue ce que les autres entendent sur la sortie que vous écoutez',
  'mic.monitor.warning':
    'Utilisez un casque : sur des enceintes, votre voix revient dans le micro et provoque un larsen.',
  'mic.effectsOff.short':
    'Les améliorations audio de Windows sont désactivées pour ce micro',
  'mic.effectsOff.title': 'Les améliorations audio sont désactivées pour {mic}',
  'mic.effectsOff.body':
    'Tant qu’elles sont désactivées, Windows n’applique aucun effet à ce micro et FluidEQ ne peut pas le traiter. Activez « Améliorations audio » dans les propriétés du micro.',
  'mic.effectsOff.button': 'Ouvrir les paramètres son de Windows',
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
  'mic.stage.cleaner': 'Réduction de bruit',
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
  'mic.monitor.on': 'Écoute du résultat final',
  'mic.delay.label': 'Délai',
  'mic.delay.measured':
    'mesuré par le moteur sur ce micro, de la capsule à chaque appli',
  'mic.delay.unknown': 'le moteur n’a pas encore mesuré ce micro',
  'mic.delay.windows': 'Windows',
  'mic.rail.master': 'Traitement du micro',
  'mic.rail.note':
    'Chaque interrupteur coupe entièrement son étage : aucun changement de son, aucun délai. Le nombre à côté d’un étage est le délai qu’il ajoute.',
  'mic.meter.noise': 'Bruit retiré',
  'mic.cleaner.description':
    'Retire clavier, ventilateurs et pièce sous votre voix pendant que vous parlez.',
  'mic.cleaner.strength': 'Intensité',
  'mic.cleaner.neverCuts': 'Ne coupe jamais',
  'mic.cleaner.neverCutsHint':
    'Si le modèle est en retard, la voix garde le niveau du dernier instant nettoyé et se raccorde sans clic, jamais avec la pièce brute. Ces instants sont comptés ici.',
  'mic.cleaner.lateMinute': 'blocs en retard dans la dernière minute',
  'mic.gate.live.title': 'Votre voix face au gate',
  'mic.gate.live.hint':
    'Faites glisser la ligne vers le haut ou le bas. Les plages grises montrent où le gate a atténué la pièce.',
  'mic.gate.live.opens': 's’ouvre à {db} dB',
  'mic.live.ago': '−{seconds} s',
  'mic.live.now': 'maintenant',
  'mic.gate.live.stateOpen': 'Ouvert',
  'mic.gate.live.stateClosed': 'Fermé',
  'mic.gate.live.waiting': 'En attente de votre voix',
  'mic.gate.live.keyLevel': 'Ce que le gate entend',
  'mic.gate.live.keyClosed': 'Atténué',
  'mic.gate.live.keyOpens': 'S’ouvre',
  'mic.gate.live.keyCloses': 'Se ferme',
  'mic.gate.live.label':
    'Le niveau que le gate entend sur les cinq dernières secondes, face aux lignes où il s’ouvre et se ferme',
  'mic.gate.live.openShare': 'Ouvert, {seconds} dernières s',
  'mic.lowCut.live.title': 'Où se trouve votre voix',
  'mic.lowCut.live.keyKept': 'Votre voix, gardée',
  'mic.lowCut.live.keyTaken': 'Retiré',
  'mic.lowCut.live.keyCut': 'La coupe',
  'mic.lowCut.live.label':
    'Votre voix telle qu’elle arrive, avec ce que le coupe-bas retire',
  'mic.lowCut.live.chip': '{hz} Hz · {slope} dB/oct',
  'mic.lowCut.live.hum': 'ronflement {hz} Hz',
  'mic.lowCut.live.taken': 'Grondement retiré maintenant',
  'mic.lowCut.live.lowest': 'Note la plus grave de votre voix',
  'mic.lowCut.live.hint':
    'Faites glisser le point à gauche ou à droite, et gardez-le sous votre note la plus grave.',
  'mic.cleaner.live.title': 'Voix et pièce, maintenant',
  'mic.cleaner.live.keyBefore': 'Ce que le micro entend',
  'mic.cleaner.live.keyAfter': 'Après nettoyage',
  'mic.cleaner.live.label':
    'Votre voix et votre pièce avant et après le nettoyage',
  'mic.cleaner.live.roomBefore': 'Pièce avant',
  'mic.cleaner.live.roomAfter': 'Pièce après',
  'mic.cleaner.live.taken': 'Pièce retirée',
  'mic.cleaner.live.over': 'Voix au-dessus de la pièce',
  'mic.cleaner.live.hint':
    'Le gris est votre pièce telle que le micro l’entend ; la couleur est ce que le nettoyage laisse.',
  'mic.cleaner.strengthHint':
    'Quelle part de la pièce le nettoyage retire. Au-delà de 80 %, une voix commence à sonner traitée.',
};
