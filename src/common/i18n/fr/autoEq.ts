/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Auto EQ on the EQ page: its button, its panel, Manage, and the note that
 * took the Output panel’s old switch’s place. */
export default {
  'autoEq.title': 'Égalisation auto',
  'autoEq.aria': 'Égalisation auto : ce qui décide du son de chaque chanson',
  'autoEq.tagline': 'Le son de chaque chanson, choisi pour vous',
  'autoEq.state.measuring': 'Mesure',
  'autoEq.state.paused': 'En pause',
  'autoEq.state.song': 'Chanson',
  'autoEq.state.album': 'Album',
  'autoEq.state.yours': 'Le vôtre',
  'autoEq.aside':
    'Se met en retrait tant que le DSP est désactivé, qu’une chaîne Jeux est active ou qu’un jeu joue son propre son. Elle revient ensuite telle qu’elle était.',
  'autoEq.now.nothing': 'Rien en lecture',
  'autoEq.now.yours': 'votre son',
  'autoEq.now.yoursWhy':
    'Rien d’enregistré pour cette chanson : elle joue le dernier son que vous avez choisi.',
  'autoEq.now.song': 'le son de cette chanson',
  'autoEq.now.songWhy': 'Revient chaque fois que cette chanson joue.',
  'autoEq.now.album': 'le son de {album}',
  'autoEq.now.albumUnnamed': 'le son de son album',
  'autoEq.now.albumWhy': 'Défini dans la Bibliothèque pour tout l’album.',
  'autoEq.songs.title': 'Sons des chansons',
  'autoEq.songs.hint':
    'Une chanson avec un son enregistré le joue. Modifiez-le et appuyez sur Enregistrer les modifications pour le garder. Les autres chansons jouent le vôtre.',
  'autoEq.songs.nothing': 'Lancez une chanson pour enregistrer son son',
  'autoEq.songs.saved': 'Enregistré pour cette chanson',
  'autoEq.songs.none': 'Rien d’enregistré pour cette chanson',
  'autoEq.songs.save': 'Enregistrer pour cette chanson',
  'autoEq.songs.forget': 'Oublier',
  'autoEq.button.save': 'Enregistrer',
  'autoEq.state.changed': 'Modifié',
  'autoEq.songs.changed': 'Modifié, non enregistré',
  'autoEq.songs.revert': 'Revenir à l’enregistré',
  'autoEq.songs.saveChanges': 'Enregistrer les modifications',
  'autoEq.button.saveFor': 'Enregistrer ce qui joue pour {title}',
  'autoEq.button.saved': 'Enregistré',
  'autoEq.holds.preset': 'Préréglage',
  'autoEq.holds.eq': 'Votre égaliseur',
  'autoEq.holds.curves': 'Courbes',
  'autoEq.holds.bands': '{count} bandes',
  'autoEq.holds.bandsOne': '1 bande',
  'autoEq.holds.flat': 'Plat',
  'autoEq.holds.none': 'Aucune',
  'autoEq.holds.curve': 'Courbe {preset}',
  'autoEq.holds.correction': 'La correction du casque reste avec la sortie',
  'autoEq.albums.title': 'Sons des albums',
  'autoEq.albums.hint':
    'Bibliothèque uniquement. Chaque chanson de l’album le joue, sauf une chanson qui a son propre préréglage.',
  'autoEq.albums.nothing':
    'Définissez le son d’un album sur sa page dans la Bibliothèque',
  'autoEq.albums.libraryOnly':
    'Bibliothèque uniquement : pas pour les autres lecteurs',
  'autoEq.albums.set': '{album} : {preset}',
  'autoEq.albums.none': 'Aucun son défini pour cet album',
  'autoEq.smart.title': 'Correction intelligente',
  'autoEq.smart.hint':
    'Mesure chaque chanson à la source et garde sa correction pour cette chanson. Par-dessus n’importe quel préréglage.',
  'autoEq.smart.modes': 'Façon de corriger',
  'autoEq.smart.waiting': 'En attente d’une chanson',
  'autoEq.smart.willSave': 'Enregistrée pour cette chanson à la fin',
  'autoEq.smart.savesIn': 'Enregistrée pour cette chanson dans {remaining}',
  'autoEq.smart.onceHint': 'Une mesure de ce qui joue, appliquée en une fois',
  'autoEq.smart.once': 'Mesurer une fois',
  'autoEq.smart.phase.listening': 'Écoute',
  'autoEq.smart.phase.settling': 'Stabilisation',
  'autoEq.smart.phase.held': 'Figée pour cette chanson',
  'autoEq.smart.phase.paused': 'En pause',
  'autoEq.smart.heard': '{seconds} s',
  'autoEq.smart.note.listening':
    'Ce qui joue maintenant continue jusqu’à ce que la correction de cette chanson soit figée.',
  'autoEq.smart.note.waitingOn':
    'En attente : {ranges}. Ce qui joue maintenant continue jusqu’à ce que la correction de cette chanson soit figée.',
  'autoEq.smart.note.settling':
    'Vérifie que la courbe ne bouge plus avant de l’écrire.',
  'autoEq.smart.note.held':
    'La mesure est terminée. Elle reprend à la chanson suivante.',
  'autoEq.smart.note.heldMissing':
    'Absent de cet enregistrement, donc laissé tel quel : {ranges}. La mesure est terminée.',
  'autoEq.smart.note.heldShort':
    'Trop peu de l’enregistrement pour corriger, le son reste tel quel.',
  'autoEq.smart.again': 'Mesurer à nouveau',
  'autoEq.smart.againHint':
    'Réécouter cette chanson et remplacer sa correction',
  'autoEq.savedCount': 'Enregistrés : {songs} · {albums}',
  'autoEq.manage': 'Gérer',
  'autoEq.manage.title': 'Sons enregistrés',
  'autoEq.manage.back': 'Retour à l’égalisation auto',
  'autoEq.manage.songs': 'Chansons',
  'autoEq.manage.albums': 'Albums',
  'autoEq.manage.search': 'Rechercher des sons enregistrés',
  'autoEq.manage.wholeSound': '{preset} avec sa Tonalité et son EQ',
  'autoEq.manage.forget': 'Oublier',
  'autoEq.manage.others': 'Chansons d’autres lecteurs : {count}',
  'autoEq.manage.othersHint':
    'Spotify, YouTube et le navigateur. Leurs titres ne sont jamais conservés.',
  'autoEq.manage.empty': 'Rien d’enregistré pour l’instant',
  'autoEq.manage.noMatch': 'Aucun résultat',
  'autoEq.manage.resetKeeps':
    'Réinitialiser tous les réglages les conserve. Seul Oublier les supprime.',
  'autoEq.manage.forgetAll': 'Tout oublier',
  'autoEq.manage.forgetAllConfirm': 'Tout oublier, définitivement',
  'autoEq.moved.title':
    'Le son de chaque chanson est maintenant dans l’égalisation auto',
  'autoEq.moved.body':
    'Mémoriser le son de chaque chanson a rejoint l’Égalisation auto, dans la page Égaliseur. Vos {count} chansons enregistrées ont suivi.',
  'autoEq.moved.bodyOne':
    'Mémoriser le son de chaque chanson a rejoint l’Égalisation auto, dans la page Égaliseur. Votre chanson enregistrée a suivi.',
  'autoEq.moved.open': 'Ouvrir l’égalisation auto',
  'autoEq.moved.dismiss': 'Compris',
};
