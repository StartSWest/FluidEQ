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
  'library.empty.feature.sound':
    'Chaque morceau passe par votre EQ et votre DSP',
  'library.empty.feature.lyrics': 'Des paroles qui s’allument mot à mot',
  'library.empty.feature.browse':
    'Albums, Cover Flow, À suivre et Surprenez-moi',
  'library.karaokeSkipped':
    '{count} chansons de karaoké ignorées — ouvrez-les dans l’onglet Karaoké',

  'library.add': 'Ajouter un dossier',
  'library.rescan': 'Analyser à nouveau',
  'library.rescan.force': 'Forcer une nouvelle analyse',
  'library.searchPlaceholder': 'Rechercher des chansons, artistes, albums',

  'library.browse.album': 'Albums',
  'library.browse.artist': 'Artistes',
  'library.browse.genre': 'Genres',
  'library.browse.song': 'Chansons',
  'library.browse.folder': 'Dossiers',
  'library.jumpTo': 'Aller à une lettre',
  'library.coverflow.previous': 'Pochette précédente',
  'library.coverflow.next': 'Pochette suivante',
  'library.coverflow.emptyTitle': 'Rien ici',
  'library.coverflow.emptyHint':
    'Cette étagère n’a rien à afficher ici. Choisissez une autre étagère ou un autre dossier.',
  'library.coverflow.noMatchTitle': 'Aucun résultat pour « {query} »',
  'library.coverflow.noMatchHint':
    'Essayez d’autres mots, ou effacez la recherche.',
  'library.filterHere': 'Filtrer ces chansons',
  'library.view.list': 'Détails',
  'library.view.grid': 'Grille',
  'library.view.coverflow': 'Cover Flow',
  'library.rail.library': 'Bibliothèque',
  'library.rail.allPlaylists': 'Toutes les playlists',
  'library.roots.manage': 'Vos dossiers',
  'library.rail.resize': 'Largeur de la liste',
  'library.tree.more': '{count} de plus…',
  'library.history': 'Précédent et suivant',
  'library.forward': 'Suivant',
  'library.length.minutes': '{minutes} min',
  'library.length.hours': '{hours} h {minutes} min',
  'library.status.songs': '{count} morceaux',
  'library.status.songsOne': '{count} morceau',
  'library.status.albums': '{count} albums',
  'library.status.albumsOne': '{count} album',
  'library.status.videos': '{count} vidéos',
  'library.status.videosOne': '{count} vidéo',
  'library.status.upToDate': 'Bibliothèque à jour',
  'library.sort.plays': 'Les plus écoutés',
  'library.sort.length': 'Durée',
  'library.column.genre': 'Genre',
  'library.column.format': 'Format',
  'library.column.plays': 'Écoutes',
  'library.columns.choose': 'Choisir les colonnes',
  'library.kind.album': 'Album',
  'library.kind.artist': 'Artiste',
  'library.kind.genre': 'Genre',
  'library.kind.folder': 'Dossier',
  'library.kind.folderAlbum': 'Dossier · album à l’intérieur',
  'library.kind.playlist': 'Playlist',
  'library.pane.details': 'Détails',
  'library.pane.lyrics': 'Paroles',
  'library.pane.tabs': 'Ce que montre le panneau',
  'library.now.nothing': 'Rien en lecture',
  'library.now.nothingHint': 'Choisissez un morceau',
  'library.facts.nothing': 'Lancez un morceau pour voir ses détails',
  'library.facts.song': 'Morceau',
  'library.facts.file': 'Fichier',
  'library.facts.sound': 'Son',
  'library.facts.location': 'Emplacement',
  'library.facts.track': 'Piste',
  'library.facts.disc': 'Disque',
  'library.facts.codec': 'Codec',
  'library.facts.bitrate': 'Débit',
  'library.facts.sampleRate': 'Fréquence d’échantillonnage',
  'library.facts.bitDepth': 'Profondeur de bits',
  'library.facts.channels': 'Canaux',
  'library.facts.mono': 'Mono',
  'library.facts.stereo': 'Stéréo',
  'library.facts.channelCount': '{count} canaux',
  'library.facts.duration': 'Durée',
  'library.facts.size': 'Taille du fichier',
  'library.facts.loudness': 'Volume perçu',
  'library.facts.truePeak': 'Crête réelle',
  'library.facts.lossless': 'Sans perte',
  'library.facts.lossy': 'Avec perte',
  'library.facts.kbps': '{value} kb/s',
  'library.facts.khz': '{value} kHz',
  'library.facts.bits': '{value} bits',
  'library.facts.mb': '{value} Mo',
  'library.facts.lufs': '{value} LUFS',
  'library.facts.dbtp': '{value} dBTP',
  'library.facts.readFailed':
    'FluidEQ n’a pas pu lire les détails de ce fichier.',
  'library.lyrics.nothing': 'Lancez un morceau pour voir ses paroles',
  'library.lyrics.none': 'Pas de paroles pour ce morceau',
  'library.lyrics.looked':
    'FluidEQ a cherché dans les tags du morceau et un fichier .lrc ou .txt du même nom à côté.',
  'library.lyrics.fromTags': 'Depuis les tags du morceau',
  'library.lyrics.fromFile': 'Depuis {name}',
  'library.lyrics.reading': 'Recherche des paroles…',
  'library.lyrics.follow': 'Revenir à la ligne en cours',
  'library.lyrics.listLabel':
    'Paroles. Cliquez sur une ligne pour lire à partir de là.',
  'library.lyrics.find.heading': 'Les trouver en ligne',
  'library.lyrics.find.free': 'Gratuites, synchronisées',
  'library.lyrics.find.licensed': 'Paroles sous licence',
  'library.lyrics.find.open':
    'Rechercher ce titre sur {site} dans votre navigateur',
  'library.lyrics.find.searches':
    'Recherche « {query} ». Téléchargez ou copiez les paroles sur le site, puis ajoutez-les ci-dessous.',
  'library.lyrics.import.heading': 'Les garder avec le titre',
  'library.lyrics.import.file': 'Importer des paroles…',
  'library.lyrics.import.paste': 'Coller',
  'library.lyrics.import.drop':
    'Ou déposez un fichier de paroles sur cet onglet : .lrc, .srt, .vtt, .ttml, .json, .yaml ou .txt.',
  'library.lyrics.import.pasteLabel': 'Paroles à garder avec ce titre',
  'library.lyrics.import.pastePlaceholder':
    'Collez les paroles ou un .lrc synchronisé',
  'library.lyrics.import.save': 'Enregistrer les paroles',
  'library.lyrics.import.cancel': 'Annuler',
  'library.lyrics.import.busy': 'Enregistrement des paroles…',
  'library.lyrics.import.exists':
    '{name} est déjà à côté du titre. Le remplacer ?',
  'library.lyrics.import.existsKept':
    'FluidEQ garde déjà des paroles pour ce titre. Les remplacer ?',
  'library.lyrics.import.replace': 'Remplacer',
  'library.lyrics.import.keep': 'Garder l’ancien',
  'library.lyrics.import.savedBeside':
    'Enregistrées à côté du titre sous {name}',
  'library.lyrics.import.savedKept':
    'Enregistrées dans le dossier de paroles de FluidEQ : impossible d’écrire dans le dossier du titre',
  'library.lyrics.import.shadowed':
    'Enregistrées sous {name}. Les paroles déjà présentes dans le titre s’affichent en premier.',
  'library.lyrics.import.shadowedKept':
    'Enregistrées dans le dossier de paroles de FluidEQ. Les paroles déjà présentes dans le titre s’affichent en premier.',
  'library.lyrics.import.tooBig':
    'Ce fichier dépasse 512 Ko : trop gros pour des paroles.',
  'library.lyrics.import.notText': 'Ce fichier n’est pas du texte.',
  'library.lyrics.import.empty': 'Il ne contient aucune parole.',
  'library.lyrics.import.notLyricsFile':
    'Seuls les fichiers de paroles peuvent être importés : .lrc, .srt, .vtt, .ttml, .json, .yaml ou .txt.',
  'library.lyrics.import.failed': 'Impossible d’enregistrer les paroles.',
  'library.lyrics.fromKept':
    'Du dossier de paroles de FluidEQ : impossible d’écrire dans le dossier du titre',
  'library.lyrics.other': 'Trouver d’autres paroles',
  'library.lyrics.back': 'Retour aux paroles',
  'library.pane.subtitles': 'Sous-titres',
  'library.subtitles.reading': 'Recherche des sous-titres…',
  'library.subtitles.none': 'Pas de sous-titres pour cette vidéo',
  'library.subtitles.looked':
    'FluidEQ a cherché à côté de la vidéo un fichier .srt ou .vtt du même nom. Une langue peut suivre le nom : {example}.',
  'library.subtitles.variant': '{language} · {variant}',
  'library.subtitles.unreadable':
    'FluidEQ n’a pu lire aucune ligne minutée dans {name}.',
  'library.subtitles.find.heading': 'Les trouver en ligne',
  'library.subtitles.find.moviesAndTv': 'Films et séries',
  'library.subtitles.find.tv': 'Séries',
  'library.subtitles.find.open':
    'Rechercher cette vidéo sur {site} dans votre navigateur',
  'library.subtitles.find.searches':
    'Recherche « {query} ». Téléchargez un fichier .srt ou .vtt sur le site, puis ajoutez-le ci-dessous.',
  'library.subtitles.import.heading': 'Les garder avec la vidéo',
  'library.subtitles.import.file': 'Importer des sous-titres…',
  'library.subtitles.import.drop':
    'Ou déposez un fichier .srt ou .vtt sur cet onglet. Il est enregistré à côté de la vidéo, sous son nom.',
  'library.subtitles.import.busy': 'Enregistrement des sous-titres…',
  'library.subtitles.import.saved':
    'Enregistrés à côté de la vidéo sous {name}',
  'library.subtitles.import.failed':
    'Les sous-titres n’ont pas pu être enregistrés à côté de la vidéo.',
  'library.subtitles.import.empty': 'Il ne contient aucune ligne minutée.',
  'library.subtitles.import.tooBig':
    'Ce fichier dépasse 2 Mo, trop pour des sous-titres.',
  'library.subtitles.import.notText': 'Ce fichier n’est pas du texte.',
  'library.subtitles.import.notSubtitles':
    'Seul un fichier de sous-titres peut être importé : .srt ou .vtt.',
  'library.subtitles.unnamed': 'Sous-titres {number}',
  'library.subtitles.sample': 'Les sous-titres apparaissent ici',
  'library.subtitles.dragHint': 'Faites glisser pour placer les sous-titres',
  'library.subtitles.menu': 'Sous-titres',
  'library.subtitles.show': 'Afficher les sous-titres',
  'library.subtitles.files': 'Fichiers de sous-titres',
  'library.subtitles.settings': 'Style des sous-titres',
  'library.subtitles.size': 'Taille',
  'library.subtitles.size.s': 'S',
  'library.subtitles.size.m': 'M',
  'library.subtitles.size.l': 'L',
  'library.subtitles.size.xl': 'XL',
  'library.subtitles.colour': 'Couleur',
  'library.subtitles.colour.white': 'Blanc',
  'library.subtitles.colour.yellow': 'Jaune',
  'library.subtitles.colour.cyan': 'Cyan',
  'library.subtitles.colour.green': 'Vert',
  'library.subtitles.colour.pink': 'Rose',
  'library.subtitles.background': 'Fond',
  'library.subtitles.background.none': 'Aucun',
  'library.subtitles.background.outline': 'Contour',
  'library.subtitles.background.box': 'Encadré',
  'library.subtitles.opacity': 'Opacité de l’encadré',
  'library.subtitles.edge': 'Bord',
  'library.subtitles.edge.thin': 'Fin',
  'library.subtitles.edge.thick': 'Épais',
  'library.subtitles.place': 'Position',
  'library.subtitles.place.topLeft': 'En haut à gauche',
  'library.subtitles.place.topCentre': 'En haut au centre',
  'library.subtitles.place.topRight': 'En haut à droite',
  'library.subtitles.place.middleLeft': 'Au milieu à gauche',
  'library.subtitles.place.middleCentre': 'Au centre',
  'library.subtitles.place.middleRight': 'Au milieu à droite',
  'library.subtitles.place.bottomLeft': 'En bas à gauche',
  'library.subtitles.place.bottomCentre': 'En bas au centre',
  'library.subtitles.place.bottomRight': 'En bas à droite',
  'library.subtitles.move': 'Déplacer sur l’image',
  'library.subtitles.moveDone': 'Terminé',
  'library.subtitles.remove.label': 'Retirer {name}',
  'library.subtitles.remove.ask':
    'Retirer {name} ? Le fichier ira dans la corbeille.',
  'library.subtitles.remove.confirm': 'Retirer',
  'library.subtitles.remove.cancel': 'Annuler',
  'library.subtitles.remove.failed': 'Impossible de retirer {name}.',
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
  'library.sort.name': 'Nom',
  'library.sort.count': 'Le plus de morceaux',

  'library.column.title': 'Titre',
  'library.column.artist': 'Artiste',
  'library.column.album': 'Album',
  'library.column.sound': 'Son',
  'library.column.year': 'Année',
  'library.column.length': 'Durée',
  'library.column.trackNo': 'Numéro de piste',

  'library.unknownAlbum': 'Album inconnu',
  'library.unknownArtist': 'Artiste inconnu',
  'library.genre.unknown': 'Genre inconnu',
  'library.trackCount': '{count} chansons',
  'library.albumCount': '{count} albums',
  'library.artistCount': '{count} artistes',
  'library.trackCountOne': '1 chanson',
  'library.albumCountOne': '1 album',
  'library.artistCountOne': '1 artiste',

  'library.videos': 'Vidéos',
  'library.videos.empty':
    'Aucune vidéo dans les dossiers que vous avez ajoutés.',

  'library.scan.running': 'Lecture de {name}',
  'library.scan.counted': '{parsed} sur {seen} fichiers',
  'library.scan.cancel': 'Arrêter',
  'library.scan.hide': 'Masquer cet avis',
  'library.scan.hideHint':
    'Masquer cet avis. La Bibliothèque continue de lire vos fichiers.',
  'library.scan.chip': 'Lecture {percent} %',
  'library.scan.chipFinding': 'Lecture…',
  'library.scan.show': 'Réafficher la progression et Arrêter',

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
  'library.video.skip': '{seconds} s',
  'library.place.aria': 'Où vous êtes dans la bibliothèque',
  'library.place.allHint':
    'Quitter ce dossier et afficher toute votre bibliothèque',
  'library.search.near': 'Dans {folder}',
  'library.search.nearEmpty': 'Rien dans {folder}',
  'library.search.elsewhere': 'Ailleurs dans votre bibliothèque',

  'library.upNext': 'À suivre',
  'library.upNext.empty': 'Rien dans la file',
  'library.upNext.added': 'Vos choix',
  'library.upNext.rest': 'Ensuite',
  'library.upNext.continued': 'Dans le même genre',
  'library.upNext.keepPlaying': 'Continuer la lecture',
  'library.upNext.keepPlayingHint':
    'Quand la liste est épuisée, poursuivre avec d’autres titres du même genre, puis avec une surprise quand il n’y en a plus',
  'library.upNext.surprise': 'Surprenez-moi',
  'library.upNext.surpriseHint':
    'Lire un titre au hasard de votre bibliothèque, puis d’autres dans le même genre',
  'library.upNext.surpriseStart':
    'Un titre au hasard de votre bibliothèque, puis d’autres dans le même genre.',
  'library.upNext.surpriseNext':
    'À la fin de ce titre, Surprenez-moi choisira le suivant.',
  'library.upNext.surpriseNothing':
    'Rien dans votre bibliothèque ne peut être lu pour le moment.',
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
  'library.repeat.all': 'Tout répéter',
  'library.repeat.one': 'Répéter cette chanson',
  'library.repeat.off': 'Ne pas répéter',
  'library.volume': 'Volume',
  'library.mute': 'Couper le son',
  'library.unmute': 'Rétablir le son',
  'library.playbackOptions': 'Options de lecture',
  'library.position': 'Position',
  'library.queue.remove': 'Retirer de la file d’attente',
  'library.nowPlaying': 'Lecture en cours',
  'library.nothingPlaying': 'Rien en lecture',
  'library.nothingPlayingHint': 'Choisissez quelque chose à écouter',
  'library.systemAudio': 'Audio du système',
  'library.remoteAudio': 'Lecture à distance · {name}',
  'library.remoteAudioDelay': 'Lecture à distance · {name} · {milliseconds} ms',

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
  'library.drop.empty': 'Aucune musique dans ce que vous avez déposé',
  'library.drop.already':
    'Tout ce que vous avez déposé est déjà dans « À suivre »',
  'library.drop.failed': 'La musique déposée n’a pas pu être ajoutée',
  'library.sound.title': 'Son',
  'library.sound.albumTitle': 'Son de l’album',
  'library.sound.albumAria': 'Son de l’album {album}',
  'library.sound.none': 'Aucun',
  'library.sound.choose': 'Choisir un son…',
  'library.sound.search': 'Rechercher des EQ enregistrés et des préréglages',
  'library.sound.albumIs': 'L’album joue {preset}',
  'library.sound.albumNone': 'Aucun son défini pour l’album',
  'library.sound.ownIs': 'Son propre : {preset}',
  'library.sound.noOwn': 'Joue le son de son album ou le vôtre',
  'library.sound.someOwn': '{count} sur {total} ont leur propre son',
  'library.sound.usePlaying': 'Utiliser ce qui joue maintenant',
  'library.sound.usePlayingHint': 'préréglage et réglages',
  'library.sound.forgetOwn': 'Oublier son propre son',
  'library.sound.forgetTheirs': 'Oublier les sons propres des chansons',
  'library.sound.noAlbumSound': 'Aucun son d’album',
  'library.sound.tagOwn': 'Propre · {preset}',
  'library.sound.tagAlbum': 'Album · {preset}',
  'library.sound.detailsYours': 'Votre son',
  'library.sound.change': 'Modifier',
};

export default library;
