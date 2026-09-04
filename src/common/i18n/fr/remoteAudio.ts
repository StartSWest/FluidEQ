/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Partager l’audio',
  'remoteAudio.eyebrow': 'LIAISON AUDIO LAN',
  'remoteAudio.title': 'Écoutez vos autres ordinateurs ici',
  'remoteAudio.subtitle':
    'Choisissez un rôle pour cet ordinateur. Le récepteur est le PC relié au casque ; les autres peuvent se connecter comme émetteurs.',
  'remoteAudio.choose': 'Choisissez le rôle de cet ordinateur',
  'remoteAudio.security': 'Propriétés de la connexion',
  'remoteAudio.badge.local': 'Réseau local privé uniquement',
  'remoteAudio.badge.lossless': 'Transport PCM Float32 sans perte',
  'remoteAudio.badge.encrypted': 'Chiffré en AES-256-GCM',
  'remoteAudio.listen.kicker': 'RÉCEPTEUR · SERVEUR',
  'remoteAudio.listen.title': 'Lire le son sur cet ordinateur',
  'remoteAudio.listen.body':
    'Utilisez ce rôle sur l’ordinateur relié au casque ou aux enceintes. Il accepte un ou plusieurs émetteurs et les lit sur la sortie sélectionnée dans FluidEQ.',
  'remoteAudio.listen.start': 'Créer le code de connexion',
  'remoteAudio.listen.activeTitle': 'Cet ordinateur écoute',
  'remoteAudio.listen.newCode': 'Créer un nouveau code',
  'remoteAudio.listen.stop': 'Arrêter l’écoute',
  'remoteAudio.stream.title': 'Priorité du flux',
  'remoteAudio.stream.lossless': 'Les deux envoient du PCM sans perte',
  'remoteAudio.stream.video.title': 'Vidéo',
  'remoteAudio.stream.video.body':
    'Latence minimale pour la synchronisation labiale. Plus sensible aux Wi-Fi chargés.',
  'remoteAudio.stream.video.buffer': 'Départ à ~30 ms',
  'remoteAudio.stream.music.title': 'Musique',
  'remoteAudio.stream.music.body':
    'Tampon de sécurité plus large pour une écoute sans interruption.',
  'remoteAudio.stream.music.buffer': 'Départ à ~240 ms',
  'remoteAudio.send.kicker': 'ÉMETTEUR · CLIENT',
  'remoteAudio.send.title': 'Envoyer le son de cet ordinateur',
  'remoteAudio.send.body':
    'Faites ceci sur chaque ordinateur à écouter. Collez le code affiché sur l’ordinateur du casque.',
  'remoteAudio.send.codeLabel': 'Code de connexion',
  'remoteAudio.send.codePlaceholder': 'Collez FLUIDEQ-LAN-2…',
  'remoteAudio.send.start': 'Connecter et envoyer',
  'remoteAudio.send.activeTitle': 'Envoi du son système',
  'remoteAudio.send.activeBody':
    'Gardez FluidEQ ouvert sur les deux ordinateurs. Le récepteur lit ce flux sans perte avec tous les autres émetteurs connectés.',
  'remoteAudio.send.destination': 'Lecture sur {name}',
  'remoteAudio.send.stop': 'Arrêter l’envoi',
  'remoteAudio.send.readyHint': 'Le code enregistré reste ici après l’arrêt.',
  'remoteAudio.status.preparing': 'Préparation…',
  'remoteAudio.status.waiting': 'En attente d’ordinateurs',
  'remoteAudio.status.connecting': 'Connexion…',
  'remoteAudio.status.connectedOne': '{count} ordinateur connecté',
  'remoteAudio.status.connectedMany': '{count} ordinateurs connectés',
  'remoteAudio.status.sending': 'Envoi audio sans perte',
  'remoteAudio.status.playbackBlocked': 'Appuyez sur Reprendre pour écouter',
  'remoteAudio.status.disconnected': 'Récepteur déconnecté',
  'remoteAudio.monitor.title': 'Connexion en direct',
  'remoteAudio.monitor.inactive': 'Choisissez un rôle pour commencer',
  'remoteAudio.monitor.ready': 'Prêt pour un code de connexion',
  'remoteAudio.monitor.waveform': 'Forme d’onde du son partagé en direct',
  'remoteAudio.monitor.waveformFor': 'Forme d’onde en direct de {name}',
  'remoteAudio.monitor.buffer': 'Lecture {milliseconds} ms',
  'remoteAudio.monitor.sendQueue': 'File d’envoi {milliseconds} ms',
  'remoteAudio.monitor.noRole': 'Aucun rôle sélectionné',
  'remoteAudio.monitor.noSources': 'Aucun ordinateur source connecté',
  'remoteAudio.monitor.waitingSource': 'En attente d’un émetteur',
  'remoteAudio.monitor.outgoing': 'Son envoyé par cet ordinateur',
  'remoteAudio.monitor.transmitting': 'Transmission',
  'remoteAudio.monitor.quiet': 'Silencieux',
  'remoteAudio.monitor.peakLevel': 'Niveau de crête audio en direct',
  'remoteAudio.monitor.peak': 'Crête {decibels} dB',
  'remoteAudio.monitor.networkUsage': 'LAN : {megabits} Mbit/s',
  'remoteAudio.monitor.networkHealthy': 'Réseau stable',
  'remoteAudio.monitor.networkQueued': '{milliseconds} ms en attente',
  'remoteAudio.code.title': 'Appairer d’autres ordinateurs',
  'remoteAudio.code.hint':
    'Copiez un code sur chaque émetteur. L’appairage reste enregistré après la fermeture de l’application ou le redémarrage du PC. Si plusieurs adresses apparaissent, utilisez le réseau commun.',
  'remoteAudio.code.copy': 'Copier le code',
  'remoteAudio.code.copied': 'Copié',
  'remoteAudio.code.forAddress': 'Code d’appairage pour {address}',
  'remoteAudio.resume': 'Reprendre le son',
  'remoteAudio.note.title': 'Commencez à faible volume.',
  'remoteAudio.note.body':
    'Plusieurs ordinateurs sont mixés et leur volume peut vite s’additionner. Baissez le casque avant la première connexion. Seul un nouveau code déconnecte les appairages enregistrés.',
  'remoteAudio.error.lan':
    'FluidEQ n’a pas pu ouvrir cette connexion locale. Vérifiez que les deux ordinateurs sont sur le même réseau privé et que le pare-feu autorise FluidEQ.',
  'remoteAudio.error.capture':
    'FluidEQ n’a pas pu capturer le son système de cet ordinateur. Vérifiez la sortie actuelle, arrêtez puis réessayez.',
  'remoteAudio.error.playback':
    'FluidEQ n’a pas pu démarrer le moteur audio sans perte. Redémarrez FluidEQ et réessayez.',
  'remoteAudio.error.connection':
    'La connexion audio chiffrée s’est arrêtée. Le code enregistré reste ci-dessous ; reconnectez-vous quand le récepteur est prêt.',
};

export default remoteAudio;
