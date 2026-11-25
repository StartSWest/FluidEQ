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
    'Ventilateurs, enfants, circulation : le nettoyeur à fond et un gate doux',
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
  'mic.empty.backTitle': 'Windows rétablit vos micros',
  'mic.empty.backBody':
    'Ils apparaissent ici dès que Windows les liste de nouveau, en général peu après le redémarrage de son audio.',
  'mic.empty.lookAgain': 'Chercher à nouveau',
  'mic.stage.level': 'Niveau de voix',
  'mic.level.title': 'Niveau de voix',
  'mic.level.description':
    'Amène votre voix à un niveau stable pendant que vous parlez : plus fort quand vous parlez bas ou loin du micro, moins fort quand vous criez. Il ne remonte jamais la pièce entre les mots.',
  'mic.level.group': 'Le niveau',
  'mic.level.groupHint':
    'La cible est le niveau où votre voix est tenue. La remontée maximale dit jusqu’où une voix faible peut être remontée.',
  'mic.level.target': 'Cible',
  'mic.level.maxLift': 'Remontée max.',
  'mic.level.live.title': 'Votre voix, nivelée',
  'mic.level.live.label':
    'Votre voix sur les dix dernières secondes, telle qu’elle arrive et nivelée, face à la cible',
  'mic.level.live.keyArrives': 'Telle qu’elle arrive',
  'mic.level.live.keyLevelled': 'Nivelée',
  'mic.level.live.keyTarget': 'Cible',
  'mic.level.live.target': 'cible {db} dB',
  'mic.level.live.lifted': 'Gain actuel',
  'mic.level.live.state': 'Maintenant',
  'mic.level.live.following': 'Suit votre voix',
  'mic.level.live.holding': 'Tient le niveau',
  'mic.preset.lowCut.speech': 'Parole',
  'mic.preset.lowCut.deep': 'Voix grave',
  'mic.preset.lowCut.headset': 'Casque proche',
  'mic.preset.lowCut.rumble': 'Anti-grondement',
  'mic.preset.lowCut.distant': 'Micro de bureau à distance',
  'mic.preset.denoise.light': 'Léger',
  'mic.preset.denoise.studio': 'Studio',
  'mic.preset.denoise.home': 'Bureau à la maison',
  'mic.preset.denoise.noisy': 'Pièce bruyante',
  'mic.preset.denoise.fan': 'Ventilateur et clim',
  'mic.preset.gate.gentle': 'Doux',
  'mic.preset.gate.calls': 'Appels',
  'mic.preset.gate.podcast': 'Podcast',
  'mic.preset.gate.stream': 'Streaming',
  'mic.preset.gate.tight': 'Serré',
  'mic.preset.level.gentle': 'Doux',
  'mic.preset.level.calls': 'Appels',
  'mic.preset.level.podcast': 'Podcast',
  'mic.preset.level.stream': 'Streaming',
  'mic.preset.level.soft': 'Voix douce',
  'mic.picture.taken': 'Le gris visible = ce que les filtres ont retiré',
  'mic.preset.level.everyday': 'Voix de tous les jours',
  'mic.stage.reverb': 'Réverb',
  'mic.reverb.title': 'Réverb',
  'mic.reverb.description':
    'Place votre voix dans un espace : une plaque pour le chant, une petite pièce pour un peu d’air. Seule la queue est ajoutée, votre voix garde son timing.',
  'mic.reverb.group.type': 'Espace',
  'mic.reverb.type.plate': 'Plaque',
  'mic.reverb.type.vocalPlate': 'Plaque vocale',
  'mic.reverb.type.room': 'Pièce',
  'mic.reverb.type.chamber': 'Chambre',
  'mic.reverb.type.hall': 'Salle',
  'mic.reverb.typeHint.plate':
    'Brillante et dense dès le premier instant, le son classique derrière une voix chantée.',
  'mic.reverb.typeHint.vocalPlate':
    'Plus sombre et plus courte : se place derrière la voix sans la noyer.',
  'mic.reverb.typeHint.room':
    'Petite et proche : un peu d’air autour de la voix, jamais un écho.',
  'mic.reverb.typeHint.chamber':
    'Chaude et ronde, avec une attaque plus douce qu’une plaque.',
  'mic.reverb.typeHint.hall':
    'Grande et lente à se construire, avec une longue queue pour les ballades.',
  'mic.reverb.group.tail': 'La queue',
  'mic.reverb.group.tailHint':
    'Le mix règle le niveau de la queue à côté de votre voix. Le pré-délai laisse un vide pour que les mots restent clairs.',
  'mic.reverb.mix': 'Mix',
  'mic.reverb.decay': 'Déclin',
  'mic.reverb.predelay': 'Pré-délai',
  'mic.reverb.group.colour': 'Couleur',
  'mic.reverb.group.colourHint':
    'Le ton assombrit la queue, le coupe-bas en retire la boue de la voix, la largeur l’étale sur un micro stéréo.',
  'mic.reverb.tone': 'Ton',
  'mic.reverb.lowCut': 'Coupe-bas',
  'mic.reverb.width': 'Largeur',
  'mic.reverb.group.duck': 'Pendant que vous parlez',
  'mic.reverb.group.duckHint':
    'La queue recule pendant que vous parlez et s’épanouit dans les pauses, pour que chaque mot reste clair.',
  'mic.reverb.duckDb': 'Recul',
  'mic.reverb.tail.title': 'La forme de la queue',
  'mic.reverb.tail.label':
    'Votre voix et la queue de réverb qui la suit, de son niveau jusqu’à 60 dB plus bas sur le déclin',
  'mic.reverb.tail.keyVoice': 'Votre voix',
  'mic.reverb.tail.keyTail': 'La queue',
  'mic.reverb.tail.keyDucked': 'Pendant que vous parlez',
  'mic.reverb.tail.voice': 'voix',
  'mic.reverb.tail.mix': '{db} dB',
  'mic.reverb.tail.decay': '−60 dB à {time}',
  'mic.reverb.tail.ducked': '−{db} dB pendant que vous parlez',
  'mic.preset.reverb.plate': 'Plaque',
  'mic.preset.reverb.vocalPlate': 'Plaque vocale',
  'mic.preset.reverb.intimate': 'Pièce intime',
  'mic.preset.reverb.chamber': 'Chambre',
  'mic.preset.reverb.hall': 'Salle de concert',
  'mic.preset.reverb.streamAir': 'De l’air pour le streaming',
  'mic.profile.group.singing': 'Chant',
  'mic.profile.group.fx': 'Effets de voix',
  'mic.profile.singPlate': 'Chant · Plaque',
  'mic.profile.singPlate.hint': 'Le chant avec une plaque brillante derrière',
  'mic.profile.singHall': 'Chant · Salle',
  'mic.profile.singHall.hint': 'Le chant dans une grande salle à longue queue',
  'mic.profile.singRoom': 'Chant · Pièce',
  'mic.profile.singRoom.hint': 'Le chant dans une pièce intime',
  'mic.profile.streamAir': 'Streaming · Air',
  'mic.profile.streamAir.hint':
    'Le streaming avec un peu de pièce qui recule pendant que vous parlez',
  'mic.profile.radio': 'Radio AM',
  'mic.profile.radio.hint':
    'Un vieux récepteur : la bande AM et un niveau compressé',
  'mic.profile.phone': 'Téléphone',
  'mic.profile.phone.hint': 'La bande du téléphone, étroite aux deux bouts',
  'mic.profile.whisper': 'Chuchotement',
  'mic.profile.whisper.hint':
    'Un chuchotement ramené devant, avec de l’air au-dessus',
  'mic.profile.megaphone': 'Mégaphone',
  'mic.profile.megaphone.hint':
    'Un médium étroit et poussé, et une courte claque de pièce',
  'mic.stage.own': 'Effets propres du micro',
  'mic.own.title': 'Effets propres du micro',
  'mic.own.description':
    'Le traitement que le fabricant de votre micro lui applique, avant que FluidEQ entende votre voix. Retirez-le et seul FluidEQ traite votre voix ; remettez-le et tout redevient exactement comme avant.',
  'mic.own.group.brings': 'Ce que votre micro apporte',
  'mic.own.group.taken': 'Retirés',
  'mic.own.group.how': 'Ce qui change',
  'mic.own.how':
    'Windows demande l’autorisation à chaque fois, et son son s’interrompt un instant pendant qu’il redémarre. Toutes les applis qui utilisent ce micro entendent le changement.',
  'mic.own.none':
    'Ce micro n’apporte aucun effet propre : seul FluidEQ le traite.',
  'mic.own.unknown':
    'Mettez à jour le FluidEQ Engine pour voir les effets propres de ce micro.',
  'mic.own.unnamed': 'Effet sans nom',
  'mic.own.kind.stream': 'S’applique à l’enregistrement de chaque app',
  'mic.own.kind.mode':
    'S’applique à un type d’enregistrement, comme les appels',
  'mic.own.kind.endpoint': 'S’applique à tout ce que ce micro enregistre',
  'mic.own.windows': 'Fait partie de Windows',
  'mic.own.makerUnknown': 'Fabricant non répertorié',
  'mic.own.fileVersion': '{file}, version {version}',
  'mic.own.source':
    'Noms, fabricants et fichiers tels que Windows les a enregistrés.',
  'mic.own.stateOn': 'Activé',
  'mic.own.stateOff': 'Retiré',
  'mic.own.prompt': 'Windows va demander l’autorisation.',
  'mic.own.working': 'En attente de Windows…',
  'mic.own.declined': 'Windows n’a pas donné l’autorisation, rien n’a changé.',
  'mic.own.failed': 'Impossible de le changer sur ce micro.',
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
  'mic.rail.master': 'Traitement du micro',
  'mic.rail.note':
    'Chaque interrupteur coupe entièrement son étage : aucun changement de son, aucun délai. Le nombre à côté d’un étage est le délai qu’il ajoute.',
  'mic.meter.noise': 'Bruit retiré',
  'mic.cleaner.description':
    'Retire clavier, ventilateurs et pièce sous votre voix pendant que vous parlez.',
  'mic.cleaner.strength': 'Intensité',
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
  'mic.preset.limiter.catch': 'Attraper les crêtes',
  'mic.preset.limiter.calls': 'Appels',
  'mic.preset.limiter.stream': 'Streaming',
  'mic.preset.limiter.loud': 'Fort par-dessus le jeu',
  'mic.preset.dynamics.gentle': 'Voix douce',
  'mic.preset.dynamics.broadcast': 'Voix radio',
  'mic.preset.dynamics.callouts': 'Annonces en jeu',
  'mic.preset.dynamics.singing': 'Chant',
  'mic.preset.deEsser.soft': 'Doux',
  'mic.preset.deEsser.podcast': 'Podcast',
  'mic.preset.deEsser.bright': 'Micro brillant',
  'mic.preset.eq.warm': 'Voix chaude',
  'mic.preset.eq.clear': 'Voix claire',
  'mic.preset.eq.radio': 'Radio',
  'mic.preset.eq.headset': 'Correction casque',
  'mic.preset.eq.thin': 'Étoffer un micro maigre',
};
