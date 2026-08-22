/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** The Library tab: local music and video files. */
import { Dictionary } from '../en';

const library: Partial<Dictionary> = {
  'tabs.library': 'Bibliothèque',

  'library.empty.title': 'Pas encore de musique',
  'library.empty.body':
    'Ajoutez un dossier et FluidEQ lira les chansons et les vidéos qu’il contient.',
  'library.empty.add': 'Ajouter un dossier',
  'library.empty.drop': 'ou déposez un dossier ici',
  'library.karaokeSkipped':
    '{count} chansons de karaoké ignorées — ouvrez-les dans l’onglet Karaoké',

  'library.add': 'Ajouter un dossier',
  'library.rescan': 'Analyser à nouveau',
  'library.rescan.force': 'Forcer une nouvelle analyse',
  'library.search': 'Rechercher dans la bibliothèque',
  'library.searchPlaceholder': 'Rechercher des chansons, artistes, albums',

  'library.browse.album': 'Albums',
  'library.browse.artist': 'Artistes',
  'library.browse.song': 'Chansons',
  'library.browse.folder': 'Dossiers',
  'library.browse.directory': 'Arborescence',
  'library.browse.folderHint':
    'Tous les dossiers contenant de la musique, d’un coup',
  'library.browse.directoryHint': 'Du dossier racine vers l’intérieur',
  'library.browse.folderReading': 'Comment les dossiers sont lus',
  'library.jumpTo': 'Aller à une lettre',
  'library.coverflow.previous': 'Pochette précédente',
  'library.coverflow.next': 'Pochette suivante',
  'library.folderCount': '{count} dossiers',
  'library.filterHere': 'Filtrer ces chansons',
  'library.view.list': 'Liste',
  'library.view.grid': 'Grille',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': 'Comment la bibliothèque est affichée',
  'library.browse.aria': 'Ce que la bibliothèque affiche',

  'library.sort': 'Trier',
  'library.sortBy': 'Trier : {value}',
  'library.sort.direction': 'Sens du tri',
  'library.sort.title': 'Titre',
  'library.sort.artist': 'Artiste',
  'library.sort.album': 'Album',
  'library.sort.year': 'Année',
  'library.sort.added': 'Ajoutés récemment',
  'library.sort.track': 'Ordre du disque',

  'library.column.title': 'Titre',
  'library.column.artist': 'Artiste',
  'library.column.album': 'Album',
  'library.column.year': 'Année',
  'library.column.length': 'Durée',
  'library.column.trackNo': 'Numéro de piste',

  'library.unknownAlbum': 'Album inconnu',
  'library.unknownArtist': 'Artiste inconnu',
  'library.trackCount': '{count} chansons',
  'library.albumCount': '{count} albums',

  'library.videos': 'Vidéos',
  'library.videos.empty':
    'Aucune vidéo dans les dossiers que vous avez ajoutés.',

  'library.scan.running': 'Lecture de {name}',
  'library.scan.counted': '{parsed} sur {seen} fichiers',
  'library.scan.cancel': 'Arrêter',
  'library.scan.background': 'Continuer en arrière-plan',
  'library.scan.done': '{count} chansons ajoutées',

  'library.roots': 'Dossiers',
  'library.root.remove': 'Retirer ce dossier',
  'library.root.offline': 'Ce dossier n’est pas disponible pour le moment',
  'library.reveal': 'Afficher dans l’Explorateur',
  'library.trackMenu': 'Plus d’actions',

  'library.unplayable': 'FluidEQ ne peut pas lire ce format',
  'library.metadataError': 'FluidEQ n’a pas pu lire les tags de ce fichier.',
  'library.pending':
    'Ce fichier a été trouvé et ses informations sont encore en cours de lecture.',
  'library.indexReset':
    'L’index de la bibliothèque n’a pas pu être lu et a été reconstruit.',

  'library.back': 'Retour',

  'library.upNext': 'À suivre',
  'library.upNext.empty': 'Rien dans la file',
  'library.upNext.added': 'Vos choix',
  'library.upNext.rest': 'Ensuite',
  'library.queueAdd': 'Ajouter à la file',

  'library.alsoInFolder': 'Dans ce dossier, pas dans cet album',
  'library.play': 'Lire',
  'library.pause': 'Pause',
  'library.stop': 'Arrêter',
  'library.previous': 'Précédent',
  'library.back5': 'Reculer de 5 secondes',
  'library.forward5': 'Avancer de 5 secondes',
  'library.next': 'Suivant',
  'library.shuffle': 'Aléatoire',
  'library.repeat': 'Répéter',
  'library.repeat.all': 'Tout répéter',
  'library.repeat.one': 'Répéter cette chanson',
  'library.repeat.off': 'Ne pas répéter',
  'library.volume': 'Volume',
  'library.mute': 'Couper le son',
  'library.unmute': 'Rétablir le son',
  'library.playbackOptions': 'Options de lecture',
  'library.position': 'Position',
  'library.queue': 'File d’attente',
  'library.queue.remove': 'Retirer de la file d’attente',
  'library.nowPlaying': 'Lecture en cours',
  'library.nothingPlaying': 'Rien en lecture',
  'library.nothingPlayingHint': 'Choisis quelque chose à écouter',
  'library.systemAudio': 'Audio du système',
  'library.fullScreen': 'Plein écran',

  'library.trackActions': 'Que faire de ce morceau',
  'library.browse.playlist': 'Playlists',
  'library.playlist.favorites': 'Favoris',
  'library.playlist.addToFavorites': 'Ajouter aux Favoris',
  'library.playlist.removeFromFavorites': 'Retirer des Favoris',
  'library.playlist.favorite': 'Dans vos Favoris',
  'library.playlist.addTo': 'Ajouter à une playlist',
  'library.playlist.alreadyIn': 'Déjà dans cette playlist',
  'library.playlist.removeFrom': 'Retirer de cette playlist',
  'library.playlist.new': 'Nouvelle playlist',
  'library.playlist.newName': 'Nom de la playlist',
  'library.playlist.create': 'Créer',
  'library.playlist.rename': 'Renommer',
  'library.playlist.keep': 'La garder',
  'library.playlist.delete': 'Supprimer la playlist',
  'library.playlist.deleteConfirm':
    'Supprimer « {name} » ? Les morceaux restent dans votre bibliothèque.',
  'library.playlist.builtIn':
    'Favoris est toujours là et ne peut pas être supprimé',
  'library.playlist.songCount': '{count} morceaux',
  'library.playlist.songCountOne': '1 morceau',
  'library.playlist.empty': 'Cette playlist est encore vide',
  'library.playlist.emptyHint':
    'Clic droit sur un morceau, puis « Ajouter à une playlist ».',
  'library.playlist.missing':
    '{count} morceaux de cette playlist ne sont pas dans votre bibliothèque en ce moment',
  'library.playlist.reset':
    'Vos playlists n’ont pas pu être lues et ont été réinitialisées.',
  'library.karaoke.send': 'Envoyer au Karaoké',
  'library.karaoke.sending': 'Envoi au Karaoké…',
  'library.karaoke.failed':
    'Ce fichier n’a pas pu être envoyé au Karaoké — il est peut-être trop volumineux ou illisible.',
};

export default library;
