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

/** The Library's tag editor. See `../en/libraryTags.ts`. */
const libraryTags = {
  'library.tags.menu.edit': 'Modifier les tags…',
  'library.tags.menu.editMany': 'Modifier les tags de {count} chansons…',
  'library.tags.menu.editAlbum': 'Modifier les tags de l’album…',
  'library.tags.menu.cover': 'Changer la pochette…',
  'library.tags.menu.shortcut': 'Ctrl+I',
  'library.tags.selection.count': '{count} chansons',
  'library.tags.selection.edit': 'Modifier les tags',
  'library.tags.selection.clear': 'Effacer la sélection',

  'library.tags.field.title': 'Titre',
  'library.tags.field.artist': 'Artiste',
  'library.tags.field.composer': 'Compositeur',
  'library.tags.field.album': 'Album',
  'library.tags.field.albumArtist': 'Artiste de l’album',
  'library.tags.field.trackNo': 'Piste',
  'library.tags.field.trackTotal': 'Nombre de pistes',
  'library.tags.field.discNo': 'Disque',
  'library.tags.field.discTotal': 'Nombre de disques',
  'library.tags.field.year': 'Année',
  'library.tags.field.genre': 'Genre',
  'library.tags.field.bpm': 'BPM',
  'library.tags.field.comment': 'Commentaire',
  'library.tags.field.grouping': 'Regroupement',
  'library.tags.field.publisher': 'Label',
  'library.tags.field.copyright': 'Copyright',
  'library.tags.field.isrc': 'ISRC',
  'library.tags.field.conductor': 'Chef d’orchestre',
  'library.tags.field.subtitle': 'Sous-titre',
  'library.tags.field.remixer': 'Remixé par',
  'library.tags.field.initialKey': 'Tonalité',
  'library.tags.field.compilation': 'Compilation',
  'library.tags.field.titleSort': 'Tri du titre',
  'library.tags.field.artistSort': 'Tri de l’artiste',
  'library.tags.field.albumSort': 'Tri de l’album',
  'library.tags.field.albumArtistSort': 'Tri de l’artiste de l’album',
  'library.tags.field.composerSort': 'Tri du compositeur',
  'library.tags.field.musicBrainzTrackId': 'Enregistrement MusicBrainz',
  'library.tags.field.musicBrainzReleaseId': 'Parution MusicBrainz',
  'library.tags.field.musicBrainzArtistId': 'Artiste MusicBrainz',
  'library.tags.field.musicBrainzReleaseArtistId':
    'Artiste de l’album MusicBrainz',
  'library.tags.field.musicBrainzReleaseGroupId':
    'Groupe de parutions MusicBrainz',

  'library.tags.panel.title': 'Modifier les tags',
  'library.tags.panel.position': '{index} sur {count}',
  'library.tags.panel.previous': 'Chanson précédente (Alt+↑)',
  'library.tags.panel.next': 'Chanson suivante (Alt+↓)',
  'library.tags.panel.close': 'Fermer (Échap) : les modifications attendent',
  'library.tags.panel.reading': 'Lecture des tags du fichier…',
  'library.tags.panel.readFailed':
    'Impossible de lire les tags de ce fichier. Il est peut-être endommagé ou utilisé.',
  'library.tags.panel.missing': 'Cette chanson n’est plus sur le disque.',
  'library.tags.panel.unsupported':
    'FluidEQ ne modifie pas les tags de ce type de fichier.',
  'library.tags.group.song': 'Chanson',
  'library.tags.group.album': 'Album',
  'library.tags.group.details': 'Détails',
  'library.tags.group.file': 'Fichier',
  'library.tags.of': 'sur',
  'library.tags.sameAsArtist': 'Comme l’artiste',
  'library.tags.putBack': 'Rétablir',
  'library.tags.noArtist': 'Sans artiste',
  'library.tags.noAlbum': 'Sans album',
  'library.tags.genre.inLibrary': 'Dans votre bibliothèque',
  'library.tags.tip.fileName':
    'Le titre est le nom du fichier. Utiliser {title} ?',
  'library.tags.tip.fileNameTrack':
    'Le titre est le nom du fichier. Utiliser {title}, piste {track} ?',
  'library.tags.tip.use': 'Utiliser',

  'library.tags.cover.dropHint': 'Déposez ou collez une image',
  'library.tags.cover.facts': '{width} × {height} · {kind} · {size}',
  'library.tags.cover.factsShort': '{kind} · {size}',
  'library.tags.cover.none': 'Aucune pochette dans ce fichier',
  'library.tags.cover.new': 'Nouvelle pochette · {width} × {height}',
  'library.tags.cover.removed': 'Pochette retirée à l’enregistrement',
  'library.tags.cover.refused':
    'Uniquement une image JPEG ou PNG de 20 Mo au plus.',
  'library.tags.cover.emptyClipboard':
    'Il n’y a pas d’image dans le presse-papiers.',

  'library.tags.more.toggle': 'Plus de champs',
  'library.tags.more.count': '{count} dans ce fichier · ajoutez-en',
  'library.tags.more.countNone': 'ajoutez-en',
  'library.tags.more.add': 'Ajouter un champ',
  'library.tags.more.addHint':
    'Tout champ que le format autorise, par son code.',
  'library.tags.more.code': 'Code',
  'library.tags.more.value': 'Valeur',
  'library.tags.more.addConfirm': 'Ajouter',
  'library.tags.more.badCode':
    'Le format de ce fichier ne peut pas garder ce code en texte.',

  'library.tags.file.format': 'Format',
  'library.tags.file.tags': 'Tags du fichier',
  'library.tags.file.noTags': 'Aucun tag',
  'library.tags.file.writeAs': 'Écrire en',
  'library.tags.file.keep': 'Garder {version}',
  'library.tags.file.v23Note':
    'La v2.3 est ce que l’Explorateur Windows, les autoradios et les anciens lecteurs lisent le mieux. La v2.4 stocke l’UTF-8 et plusieurs valeurs par champ.',
  'library.tags.file.v24Note':
    'L’Explorateur Windows et certains autoradios lisent mal la v2.4 ; la v2.3 est le choix sûr si ce fichier voyage.',
  'library.tags.file.id3v1': 'Tenir à jour l’ancien tag ID3v1',
  'library.tags.file.readOnly':
    'Ce fichier est en lecture seule. On vous le demandera avant de l’écrire.',

  'library.tags.foot.none': 'Aucune modification',
  'library.tags.foot.noneHint':
    'Les modifications attendent pendant que vous parcourez l’album',
  'library.tags.foot.changes': '{count} modifications non enregistrées',
  'library.tags.foot.changesOne': '1 modification non enregistrée',
  'library.tags.foot.inSongs': 'dans {count} chansons',
  'library.tags.foot.inSongsOne': 'dans 1 chanson',
  'library.tags.revert': 'Annuler les modifications',
  'library.tags.save': 'Enregistrer',
  'library.tags.saveSongs': 'Enregistrer {count} chansons',
  'library.tags.saveFailed':
    'Certaines valeurs n’ont pas pu être écrites telles quelles. Vérifiez les champs signalés.',

  'library.tags.set.reading': 'Lecture des tags · {done} sur {count}',
  'library.tags.set.use': 'Utiliser {value}',
  'library.tags.set.coversMixed': '{count} pochettes différentes',
  'library.tags.set.coversNone': '{count} chansons n’en ont pas',
  'library.tags.set.coverOne': 'Une pochette pour toutes',
  'library.tags.set.coverNoneAll': 'Aucune chanson n’a de pochette',
  'library.tags.set.coverToAll': 'Pour les {count} chansons',
  'library.tags.set.songs': 'Chansons',
  'library.tags.set.renumber': 'Renuméroter dans l’ordre',
  'library.tags.files.title': 'Noms de fichier',
  'library.tags.files.keep': 'Ne pas changer',
  'library.tags.files.custom': 'Personnalisé…',
  'library.tags.files.pattern': 'Modèle du nom',
  'library.tags.files.patternHint':
    'Tapez, et ajoutez des tags avec les boutons',
  'library.tags.files.addTag': 'Ajouter un tag',
  'library.tags.files.token.track': 'N°',
  'library.tags.files.token.title': 'Titre',
  'library.tags.files.token.artist': 'Artiste',
  'library.tags.files.token.albumArtist': 'Artiste de l’album',
  'library.tags.files.token.album': 'Album',
  'library.tags.files.token.year': 'Année',
  'library.tags.files.token.disc': 'Disque',
  'library.tags.files.count': '{count} fichiers changent de nom',
  'library.tags.files.countOne': '1 fichier change de nom',
  'library.tags.files.none': 'Tous les fichiers portent déjà ce nom',
  'library.tags.files.clash':
    '{count} chansons auraient le même nom. Distinguez-les pour enregistrer.',
  'library.tags.files.clashOne':
    'Une chanson prendrait le nom d’un autre fichier. Distinguez-les pour enregistrer.',
  'library.tags.files.clashRow': 'Même nom qu’un autre fichier',
  'library.tags.set.fixAuto': 'Corriger automatiquement',
  'library.tags.set.moreFields': 'Plus de champs ({fields})',
  'library.tags.set.varies': 'Varie :',
  'library.tags.set.variesPlaceholder': 'Varie · saisissez-en un pour toutes',
  'library.tags.set.useForAll': 'Utiliser pour les {count} chansons',
  'library.tags.set.found': '{count} chansons trouvées',
  'library.tags.set.foundOne': '1 chanson trouvée',
  'library.tags.set.foundNone': 'Aucun titre ne le contient',
  'library.tags.cover.change': 'Changer la pochette',
  'library.tags.cover.changeShort': 'Changer',
  'library.tags.cover.chooseImage': 'Choisir une image…',
  'library.tags.cover.pasteImage': 'Coller depuis le presse-papiers',
  'library.tags.cover.removeCover': 'Retirer la pochette',
  'library.tags.set.find': 'Rechercher dans les titres',
  'library.tags.set.replaceWith': 'Remplacer par',
  'library.tags.set.replaceAll': 'Tout remplacer',
  'library.tags.set.sheetHint':
    'Entrée descend · Tab va à droite · Ctrl+D copie la cellule du dessus · faites glisser une ligne par sa poignée pour la déplacer, puis Renuméroter.',
  'library.tags.set.col.no': 'N°',
  'library.tags.set.col.time': 'Durée',
  'library.tags.set.grip': 'Glisser pour déplacer',
  'library.tags.set.missingCell': 'manquant',
  'library.tags.set.groupSongs': '{count} chansons',
  'library.tags.set.changes': '{count} modifications',
  'library.tags.set.changesOne': '1 modification',
  'library.tags.set.files': '{count} fichiers · rien n’est encore écrit',
  'library.tags.set.filesOne': '1 fichier · rien n’est encore écrit',
  'library.tags.set.discard': 'Abandonner',
  'library.tags.set.back': 'Retour',
  'library.tags.set.leaveAsk': 'Quitter sans enregistrer ces modifications ?',
  'library.tags.set.keepEditing': 'Continuer',
  'library.tags.set.unreadable':
    '{count} chansons n’ont pas pu être lues et sont laissées de côté.',

  'library.tags.write.progress': 'Écriture des tags · {done} sur {count}',
  'library.tags.write.undoing': 'Rétablissement des tags · {done} sur {count}',
  'library.tags.write.background': 'Continuer en arrière-plan',
  'library.tags.write.show': 'Afficher',
  'library.tags.write.cancel': 'Annuler',
  'library.tags.write.written': '{done} sur {count} écrits',
  'library.tags.write.needYou': '{count} ont besoin de vous',
  'library.tags.write.review': 'Examiner {count} fichiers',
  'library.tags.write.reviewOne': 'Examiner 1 fichier',
  'library.tags.write.done': '{count} fichiers mis à jour',
  'library.tags.write.doneOne': '1 fichier mis à jour',
  'library.tags.write.doneNote':
    'Les anciens tags sont conservés : Annuler les remet tous.',
  'library.tags.write.undo': 'Annuler',
  'library.tags.write.undone': 'Annulé',
  'library.tags.write.undoneNote':
    'Chaque fichier a retrouvé ses anciens tags, pochette comprise.',
  'library.tags.write.stopped': 'Arrêté après {done} sur {count}',
  'library.tags.write.stoppedNote':
    'Les fichiers déjà écrits gardent leurs nouveaux tags ; Annuler remet les anciens.',
  'library.tags.write.failed': '{count} n’ont pas pu être écrits',
  'library.tags.write.failedOne': '1 n’a pas pu être écrit',
  'library.tags.write.dismiss': 'Fermer',
  'library.tags.problems.title': '{count} fichiers ont besoin de vous',
  'library.tags.problems.titleOne': '1 fichier a besoin de vous',
  'library.tags.problems.allHandled': 'Tout est réglé',
  'library.tags.problems.waiting': '{count} attendent la fin de leur chanson',
  'library.tags.problems.waitingOne': '1 attend la fin de sa chanson',
  'library.tags.problems.held':
    'En lecture dans FluidEQ : écrit dès la fin de la chanson.',
  'library.tags.problems.locked':
    'Ouvert dans un autre programme. Fermez-le, puis réessayez.',
  'library.tags.problems.readOnly':
    'Ce fichier est en lecture seule : il ne peut pas être modifié tel quel.',
  'library.tags.problems.failed':
    'Impossible d’écrire ce fichier. Il est intact ; rien n’a été perdu.',
  'library.tags.problems.missing':
    'Ce fichier n’est plus là où la bibliothèque l’avait trouvé.',
  'library.tags.problems.retry': 'Réessayer',
  'library.tags.problems.skip': 'Ignorer',
  'library.tags.problems.makeWritable': 'Rendre modifiable et écrire',
  'library.tags.problems.skipAll': 'Tout ignorer',
  'library.tags.problems.failedCopy':
    'La copie par laquelle il est écrit n’a pas pu être créée à côté. Le fichier est intact. Réessayez ; si le disque est plein ou occupé, libérez-le d’abord.',
  'library.tags.problems.failedTags':
    'Ses tags n’ont pas pu être écrits : le fichier est peut-être abîmé ou inhabituel. Il est intact. Réessayez, ou ouvrez-le dans un autre éditeur de tags.',
  'library.tags.problems.failedCheck':
    'À la vérification, la copie écrite ne se lisait plus comme le même morceau ; elle n’a pas été utilisée. Le fichier est intact.',
  'library.tags.problems.failedUndo':
    'Ce dont Annuler a besoin n’a pas pu être gardé ; rien n’a été écrit. Le fichier est intact.',
  'library.tags.problems.failedPlace':
    'La copie écrite n’a pas pu prendre la place du fichier. Le fichier est intact. Si une synchronisation comme OneDrive s’en occupe, réessayez quand elle a fini.',
  'library.tags.problems.failedTaken':
    'Un autre fichier de son dossier porte déjà le nouveau nom, il a donc gardé le sien. Renommez ou déplacez l’autre fichier, puis réessayez.',
  'library.tags.problems.failedRename':
    'Le disque n’a pas accepté le nouveau nom, il a donc gardé le sien. Réessayez ; si une app de synchronisation comme OneDrive s’en occupe, attendez qu’elle ait fini.',
  'library.tags.problems.options': 'Options pour ce fichier',
  'library.tags.problems.openTags': 'Voir ses tags',
  'library.tags.problems.reveal': 'Afficher dans l’Explorateur',
  'library.tags.problems.nothingToDo': 'Rien à faire.',
  'library.tags.problems.everythingElse': 'Tout le reste est écrit',
  'library.tags.problems.undoCovers': 'Annuler s’applique aussi à ceux-ci',
  'library.tags.menu.fix': 'Corriger les tags automatiquement…',
  'library.tags.menu.fixAlbum': 'Corriger cet album…',
  'library.tags.menu.fixShortcut': 'Ctrl+Maj+I',
  'library.tags.hero.fix': 'Corriger les tags',
  'library.tags.selection.fix': 'Corriger',
  'library.tags.fix.empty': 'vide',
  'library.tags.fix.albums': '{count} albums',
  'library.tags.fix.albumChanges': '{count} modifications',
  'library.tags.fix.albumChangesOne': '1 modification',
  'library.tags.fix.nothingFound':
    'FluidEQ n’a rien trouvé à corriger dans ces chansons.',
  'library.tags.fix.noPicture':
    'L’image du dossier de l’album n’a pas pu être utilisée.',
  'library.tags.fix.filled':
    'FluidEQ a complété ce qui manquait. Ce qui change est en couleur, l’ancienne valeur barrée à côté : vérifiez puis enregistrez, ou annulez.',
  'library.tags.fix.fixAlbum': 'Corriger',
  'library.tags.fix.openAlbum': 'Ouvrir',
  'library.tags.fix.editByHand': 'Tout modifier à la main',
  'library.tags.folders.eyebrow': 'Grand dossier',
  'library.tags.folders.count': '{count} dossiers avec des chansons',
  'library.tags.folders.lead':
    'Trop de chansons pour les modifier d’un coup. Choisissez un dossier : il s’ouvre seul dans l’éditeur, et Retour ou Enregistrer vous ramène ici, le dossier marqué.',
  'library.tags.folders.saved': 'Enregistré',
  'library.tags.folders.edit': 'Modifier',
  'library.tags.set.cancelReading': 'Annuler',
  'library.tags.fix.albumComplete': 'Complet',
  'library.tags.changes.title': 'Modifications',
  'library.tags.changes.none':
    'Aucune modification pour l’instant. Ce que vous modifiez s’affiche ici avant l’enregistrement.',
  'library.tags.changes.album': 'Pour tout l’album',
  'library.tags.changes.songs': 'Chanson par chanson',
  'library.tags.changes.removed': 'retiré',
  'library.tags.changes.cover': 'Pochette',
  'library.tags.changes.coverNew': 'Nouvelle image',
  'library.tags.changes.coverRemoved': 'Retirée',
  'library.tags.cover.useOne': 'En utiliser une pour toutes les chansons',
  'library.tags.cover.useThis':
    'Utiliser cette pochette pour toutes les chansons',
  'library.tags.cover.searchWeb': 'Chercher la pochette sur Internet…',
  'library.tags.cover.searchHint':
    'Dans le navigateur, copiez l’image voulue puis choisissez Coller, ou faites-la glisser sur la pochette.',
  'library.tags.set.searchWeb': 'Chercher l’album sur Internet',
  'library.tags.set.searchWebNote':
    'Ouvre l’album sur MusicBrainz dans votre navigateur. FluidEQ ne télécharge rien.',
  'library.tags.write.undoAsk':
    'Remettre les anciens tags de {count} fichiers ?',
  'library.tags.write.undoAskOne': 'Remettre les anciens tags de 1 fichier ?',
  'library.tags.write.doneNoteNamed':
    'Les tags et les noms précédents sont conservés — Annuler les remet tous.',
  'library.tags.write.undoneNoteNamed':
    'Chaque fichier retrouve ses tags et son nom précédents, pochette comprise.',
  'library.tags.write.stoppedNoteNamed':
    'Les fichiers déjà écrits gardent leurs nouveaux tags et noms ; Annuler les remet.',
  'library.tags.write.undoAskNamed':
    'Remettre les tags et les noms précédents sur {count} fichiers ?',
  'library.tags.write.undoAskOneNamed':
    'Remettre les tags et le nom précédents sur 1 fichier ?',
  'library.tags.write.undoKeep': 'Non',
  'library.tags.write.undoConfirm': 'Annuler',
};

export default libraryTags;
