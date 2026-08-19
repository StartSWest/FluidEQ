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
  'library.view.list': 'Liste',
  'library.view.grid': 'Grille',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': 'Comment la bibliothèque est affichée',
  'library.browse.aria': 'Ce que la bibliothèque affiche',

  'library.sort': 'Trier',
  'library.sort.title': 'Titre',
  'library.sort.artist': 'Artiste',
  'library.sort.album': 'Album',
  'library.sort.year': 'Année',
  'library.sort.added': 'Ajoutés récemment',

  'library.column.title': 'Titre',
  'library.column.artist': 'Artiste',
  'library.column.album': 'Album',
  'library.column.year': 'Année',
  'library.column.length': 'Durée',

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

  'library.unplayable': 'FluidEQ ne peut pas lire ce format',
  'library.metadataError': 'FluidEQ n’a pas pu lire les tags de ce fichier.',
  'library.indexReset':
    'L’index de la bibliothèque n’a pas pu être lu et a été reconstruit.',

  'library.back': 'Retour',

  'library.play': 'Lire',
  'library.pause': 'Pause',
  'library.stop': 'Arrêter',
  'library.previous': 'Précédent',
  'library.next': 'Suivant',
  'library.shuffle': 'Aléatoire',
  'library.repeat': 'Répéter',
  'library.repeat.all': 'Tout répéter',
  'library.repeat.one': 'Répéter cette chanson',
  'library.repeat.off': 'Ne pas répéter',
  'library.volume': 'Volume',
  'library.position': 'Position',
  'library.queue': 'File d’attente',
  'library.queue.remove': 'Retirer de la file d’attente',
  'library.nowPlaying': 'Lecture en cours',
  'library.fullScreen': 'Plein écran',
};

export default library;
