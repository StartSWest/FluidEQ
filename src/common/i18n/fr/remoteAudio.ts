/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Partager',
  'remoteAudio.eyebrow': 'LIAISON AUDIO LAN',
  'remoteAudio.title': 'Écoutez vos autres ordinateurs ici',
  'remoteAudio.subtitle':
    'Utilisez l’ordinateur avec votre casque comme récepteur. Autant d’ordinateurs FluidEQ que souhaité sur le même réseau local peuvent le rejoindre et envoyer leur son système ici.',
  'remoteAudio.security': 'Propriétés de la connexion',
  'remoteAudio.badge.local': 'Réseau local uniquement',
  'remoteAudio.badge.lossless': 'PCM 32 bits sans perte',
  'remoteAudio.badge.encrypted': 'Chiffrement AES-256',
  'remoteAudio.listen.kicker': 'ORDINATEUR B · CASQUE',
  'remoteAudio.listen.title': 'Lire le son sur cet ordinateur',
  'remoteAudio.listen.body':
    'Choisissez le casque ou les enceintes connectés ici, puis partagez le code d’appairage avec chaque ordinateur à écouter.',
  'remoteAudio.listen.start': 'Commencer l’écoute',
  'remoteAudio.listen.activeTitle': 'Cet ordinateur écoute',
  'remoteAudio.listen.stop': 'Arrêter l’écoute',
  'remoteAudio.send.kicker': 'ORDINATEUR A · SOURCE',
  'remoteAudio.send.title': 'Envoyer le son de cet ordinateur',
  'remoteAudio.send.body':
    'Collez un code de l’ordinateur avec le casque. FluidEQ envoie la boucle audio système sans compression.',
  'remoteAudio.send.codeLabel': 'Code de l’ordinateur avec le casque',
  'remoteAudio.send.codePlaceholder': 'Collez FLUIDEQ-LAN-1…',
  'remoteAudio.send.start': 'Commencer l’envoi',
  'remoteAudio.send.activeTitle': 'Envoi du son système',
  'remoteAudio.send.activeBody':
    'Gardez FluidEQ ouvert sur les deux ordinateurs. Le récepteur lit ce flux sans perte avec tous les autres émetteurs connectés.',
  'remoteAudio.send.stop': 'Arrêter l’envoi',
  'remoteAudio.output.label': 'Lire sur',
  'remoteAudio.output.default': 'Sortie audio par défaut',
  'remoteAudio.output.unnamed': 'Sortie audio {number}',
  'remoteAudio.status.preparing': 'Préparation…',
  'remoteAudio.status.waiting': 'En attente d’ordinateurs',
  'remoteAudio.status.connecting': 'Connexion…',
  'remoteAudio.status.connectedOne': '{count} ordinateur connecté',
  'remoteAudio.status.connectedMany': '{count} ordinateurs connectés',
  'remoteAudio.status.sending': 'Envoi audio sans perte',
  'remoteAudio.status.playbackBlocked': 'Appuyez sur Reprendre pour écouter',
  'remoteAudio.status.disconnected': 'Récepteur déconnecté',
  'remoteAudio.code.title': 'Appairer d’autres ordinateurs',
  'remoteAudio.code.hint':
    'Copiez un code sur chaque émetteur. Le même code peut connecter plusieurs ordinateurs tant que ce récepteur reste actif. Si plusieurs adresses apparaissent, utilisez le réseau commun aux deux ordinateurs.',
  'remoteAudio.code.copy': 'Copier le code',
  'remoteAudio.code.copied': 'Copié',
  'remoteAudio.code.forAddress': 'Code d’appairage pour {address}',
  'remoteAudio.resume': 'Reprendre le son',
  'remoteAudio.note.title': 'Commencez à faible volume.',
  'remoteAudio.note.body':
    'Plusieurs ordinateurs sont mixés et leur volume peut vite s’additionner. Baissez le casque avant la première connexion. Arrêter le récepteur invalide immédiatement son code.',
  'remoteAudio.error.lan':
    'FluidEQ n’a pas pu ouvrir cette connexion locale. Vérifiez que les deux ordinateurs sont sur le même réseau privé et que le pare-feu autorise FluidEQ.',
  'remoteAudio.error.capture':
    'FluidEQ n’a pas pu capturer le son système de cet ordinateur. Vérifiez la sortie actuelle, arrêtez puis réessayez.',
  'remoteAudio.error.connection':
    'La connexion audio chiffrée s’est arrêtée. Arrêtez cette session et reconnectez-vous avec un code actuel.',
};

export default remoteAudio;
