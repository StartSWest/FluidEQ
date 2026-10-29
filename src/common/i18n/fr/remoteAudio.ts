/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'remoteAudio.group.add': 'Ajouter un ordinateur',
  'remoteAudio.group.title': 'Tout le groupe',
  'remoteAudio.group.mix': 'Votre mixage',
  'remoteAudio.group.thisPC': 'Ce PC',
  'remoteAudio.group.receive': 'Recevoir',
  'remoteAudio.group.send': 'Envoyer',
  'remoteAudio.group.share': 'Partager',
  'remoteAudio.group.options': 'Options de {name}',
  'remoteAudio.group.count.one': '{count} ordinateur',
  'remoteAudio.group.count.few': '{count} ordinateurs',
  'remoteAudio.group.count.many': '{count} d’ordinateurs',
  'remoteAudio.group.count.other': '{count} ordinateurs',
  'remoteAudio.group.sourceOff': 'Partage désactivé',
  'remoteAudio.group.offline': 'Hors ligne',
  'remoteAudio.group.unavailable': 'Volume système indisponible',
  'remoteAudio.group.mute': 'Couper le son de ce PC',
  'remoteAudio.group.unmute': 'Rétablir le son de ce PC',
  'remoteAudio.group.output': 'Sortie',
  'remoteAudio.group.hint':
    'Reliez un ordinateur pour rejoindre son groupe. Chaque ordinateur envoie son propre son directement aux autres ; réglez ce que vous écoutez dans votre mixage.',
  'tabs.share': 'Partager l’audio',
  'remoteAudio.eyebrow': 'LIAISON AUDIO LAN',
  'remoteAudio.title': 'Écoutez vos autres ordinateurs ici',
  'remoteAudio.security': 'Propriétés de la connexion',
  'remoteAudio.badge.local': 'Réseau local privé uniquement',
  'remoteAudio.badge.lossless': 'Transport PCM Float32 sans perte',
  'remoteAudio.badge.encrypted': 'Chiffré en AES-256-GCM',
  'remoteAudio.link.thisComputer': 'Cet ordinateur',
  'remoteAudio.link.thisHint':
    'Collez ce code sur l’autre ordinateur, ou collez ici le code de cet ordinateur. Les deux fonctionnent.',
  'remoteAudio.link.or': 'ou',
  'remoteAudio.link.otherComputer': 'Code de l’autre ordinateur',
  'remoteAudio.link.codeLabel': 'Code de connexion',
  'remoteAudio.link.placeholder': 'Collez FLUIDEQ-LAN-2…',
  'remoteAudio.link.start': 'Relier',
  'remoteAudio.link.otherHint':
    'Les deux ordinateurs se jouent l’un l’autre aussitôt. Coupez une direction plus tard si vous n’en voulez qu’une.',
  'remoteAudio.link.once':
    'Une seule fois. Les ordinateurs reliés se retrouvent après un redémarrage, d’un côté comme de l’autre.',
  'remoteAudio.link.many':
    'Le même code relie autant d’ordinateurs que vous voulez, et en délier un laisse les autres reliés.',
  'remoteAudio.rule.echoTitle': 'Dans les deux sens, sans écho',
  'remoteAudio.rule.echo':
    'Chaque ordinateur n’envoie que ce qu’il joue lui-même — jamais le son qu’il reçoit —, donc rien ne revient.',
  'remoteAudio.rule.eqTitle': 'Votre EQ là où vous écoutez',
  'remoteAudio.rule.eq':
    'Le son part intact. L’ordinateur sur lequel vous l’écoutez applique son EQ, sa courbe de casque et son DSP — une seule fois.',
  'remoteAudio.rule.steadyTitle': 'Stable, sans dérive',
  'remoteAudio.rule.steady':
    'Environ 30 ms de retard, et ça tient : les deux horloges restent en phase, sans coupure ni dérive lente.',
  'remoteAudio.linked.cardLabel': 'Liaison avec {name}',
  'remoteAudio.linked.bothWays': 'Dans les deux sens',
  'remoteAudio.linked.incomingOnly': 'Entrant seulement',
  'remoteAudio.linked.outgoingOnly': 'Sortant seulement',
  'remoteAudio.linked.paused': 'En pause',
  'remoteAudio.linked.lossless': 'Sans perte',
  'remoteAudio.linked.unlink': 'Délier',
  'remoteAudio.linked.pause': 'Pause',
  'remoteAudio.linked.resume': 'Reprendre',
  'remoteAudio.lane.inPaused':
    'En pause. Rien ne joue ici tant que vous ne reprenez pas.',
  'remoteAudio.lane.outPaused':
    'En pause. Rien n’est envoyé tant que vous ne reprenez pas.',
  'remoteAudio.lane.volume': 'Volume du son de {name}',
  'remoteAudio.lane.pausedThere': '{name} a mis la liaison en pause.',
  'remoteAudio.linked.noEcho':
    'Pas d’écho : le son de {name} ne lui est jamais renvoyé.',
  'remoteAudio.linked.untouched':
    'Part intact dans les deux sens — chaque ordinateur applique son propre EQ et son DSP.',
  'remoteAudio.lane.from': 'De {name}',
  'remoteAudio.lane.to': 'Vers {name}',
  'remoteAudio.lane.playsHere': 'Joue ici',
  'remoteAudio.lane.yourSound': 'Votre son',
  'remoteAudio.lane.playItHere': 'Le jouer ici',
  'remoteAudio.lane.sendMySound': 'Envoyer mon son',
  'remoteAudio.lane.delay': 'retard',
  'remoteAudio.lane.sent': 'envoyé',
  'remoteAudio.lane.received': 'reçu',
  'remoteAudio.lane.milliseconds': '{milliseconds} ms',
  'remoteAudio.lane.megabits': '{megabits} Mb/s',
  'remoteAudio.lane.receiving': 'Réception',
  'remoteAudio.lane.paused': 'En pause',
  'remoteAudio.lane.inQuiet': 'Rien ne joue sur {name}',
  'remoteAudio.lane.inOff':
    'Coupé : le son de {name} ne joue pas sur cet ordinateur.',
  'remoteAudio.lane.inNotSent': '{name} a « Envoyer mon son » coupé.',
  'remoteAudio.lane.inOld':
    '{name} a besoin de la dernière version de FluidEQ pour envoyer son son ici.',
  'remoteAudio.lane.inOneWay':
    'Jouer dans les deux sens demande Windows, ou le FluidEQ Engine sous Linux.',
  'remoteAudio.lane.outQuiet': 'Rien ne joue sur cet ordinateur',
  'remoteAudio.lane.outSounding': 'Du son joue sur cet ordinateur',
  'remoteAudio.lane.outOff': 'Pas d’envoi. {name} n’entend pas cet ordinateur.',
  'remoteAudio.lane.outNotPlayed': '{name} a « Le jouer ici » coupé.',
  'remoteAudio.lane.outOld':
    '{name} a besoin de la dernière version de FluidEQ pour jouer le son de cet ordinateur.',
  'remoteAudio.lane.outOneWay':
    'Envoyer dans les deux sens demande Windows, ou le FluidEQ Engine sous Linux.',
  'remoteAudio.lane.outFailed':
    'Le son de cet ordinateur n’a pas pu être capturé. Coupez puis réactivez « Envoyer mon son » pour réessayer.',
  'remoteAudio.singlePlayer.title': 'Un seul lecteur',
  'remoteAudio.singlePlayer.body':
    'couvre aussi les ordinateurs reliés : lancer quelque chose sur l’un met en pause ce qui jouait sur l’autre.',
  'remoteAudio.code.copy': 'Copier le code',
  'remoteAudio.code.copied': 'Copié',
  'remoteAudio.code.label': 'Code de cet ordinateur',
  'remoteAudio.status.preparing': 'Préparation…',
  'remoteAudio.status.noNetwork':
    'Connectez cet ordinateur à un réseau pour obtenir son code.',
  'remoteAudio.status.playbackBlocked': 'Appuyez sur Reprendre pour écouter',
  'remoteAudio.resume': 'Reprendre le son',
  'remoteAudio.retry': 'Réessayer',
  'remoteAudio.monitor.networkHealthy': 'Réseau stable',
  'remoteAudio.monitor.networkQueued': '{milliseconds} ms en attente',
  'remoteAudio.note.title': 'Commencez à faible volume.',
  'remoteAudio.note.body':
    'Deux ordinateurs qui jouent en même temps s’additionnent. Baissez le volume avant la première liaison.',
  'remoteAudio.error.lan':
    'FluidEQ n’a pas pu ouvrir cette connexion locale. Vérifiez que les deux ordinateurs sont sur le même réseau privé et que le pare-feu autorise FluidEQ.',
  'remoteAudio.error.code':
    'Ce n’est pas un code FluidEQ, ou c’est celui de cet ordinateur. Copiez le code depuis la page Partager l’audio de l’autre ordinateur.',
  'remoteAudio.error.capture':
    'FluidEQ n’a pas pu capturer le son système de cet ordinateur. Vérifiez le périphérique de sortie actuel, puis réessayez.',
  'remoteAudio.error.playback':
    'FluidEQ n’a pas pu démarrer le moteur audio sans perte. Redémarrez FluidEQ et réessayez.',
  'remoteAudio.error.connection':
    'La connexion audio chiffrée s’est interrompue. FluidEQ continue de chercher l’autre ordinateur et se reconnecte tout seul dès qu’il revient.',
};

export default remoteAudio;
