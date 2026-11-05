/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The Gaming Lab. See `en/gaming.ts`. */
export default {
  'gaming.tab': 'Labo gaming',
  'gaming.view.games': 'Jeux',
  'gaming.view.profiles': 'Profils gaming',
  'gaming.switch': 'Basculer quand un jeu est au premier plan',
  'gaming.switch.hint':
    'Désactivé, vos jeux gardent votre son musique et rien ne bascule tout seul.',
  'gaming.add': 'Ajouter un jeu',
  'gaming.list.show': 'Afficher la liste des jeux',
  'gaming.list.hide': 'Masquer la liste des jeux',
  'gaming.list.resize': 'Redimensionner la liste des jeux',
  'gaming.list.count': 'Vos jeux · {count}',
  'gaming.list.from': 'Depuis {profile}',
  'gaming.list.tuned': 'ajusté',
  'gaming.list.playing': 'En cours',
  'gaming.empty.title': 'Aucun jeu pour l’instant',
  'gaming.empty.more':
    'Ajoutez un jeu et il reçoit un son à lui, copié d’un profil gaming fait pour lui. Vous ajustez la copie ici ; le profil reste tel qu’il était.',
  'gaming.game.where': '{source} · sur {output}',
  'gaming.profile.label': 'Profil gaming',
  'gaming.profile.kind.title': 'Pour ce jeu',
  'gaming.profile.kind.kind': 'Par genre',
  'gaming.profile.kind.yours': 'Les vôtres',
  'gaming.profile.kind.chain': 'Préréglage DSP',
  'gaming.profile.gone': 'Un profil qui n’existe plus',
  'gaming.profile.pickHint':
    'Choisir un autre profil donne à ce jeu une nouvelle copie de celui-ci.',
  'gaming.save': 'Enregistrer comme profil',
  'gaming.save.new': 'Enregistrer comme nouveau profil…',
  'gaming.save.newHint':
    'Il rejoint Les vôtres, pour que d’autres jeux puissent partir de lui. {game} part ensuite de lui.',
  'gaming.save.update': 'Mettre à jour {profile}',
  'gaming.save.updateHint':
    'Votre profil reprend ces changements. Les jeux partis de lui gardent leurs propres copies.',
  'gaming.save.reset': 'Revenir à {profile}',
  'gaming.save.resetHint':
    'Abandonne les réglages de ce jeu et repart du profil.',
  'gaming.save.rename': 'Renommer cette copie…',
  'gaming.save.delete': 'Supprimer cette copie',
  'gaming.save.deleteHint':
    'Retire ce jeu et ses réglages. Le profil reste tel quel.',
  'gaming.action.unload': 'Décharger',
  'gaming.action.unloadHint': 'Votre son musique revient maintenant.',
  'gaming.action.try': 'Essayer maintenant',
  'gaming.action.tryHint':
    'Active maintenant le son propre de {game}, pour que vous puissiez l’écouter et l’ajuster.',
  'gaming.status.tuned':
    'La copie de {profile} propre à ce jeu. Ajusté : {parts}. Le profil lui-même reste intact.',
  'gaming.status.tunedNamed':
    '{copy} : la copie de {profile} propre à ce jeu. Ajusté : {parts}. Le profil lui-même reste intact.',
  'gaming.status.same':
    'Identique au profil. Ce que vous changez ici reste avec ce jeu ; le profil lui-même ne change jamais.',
  'gaming.rail.game': 'Jeu',
  'gaming.rail.sound': 'Son',
  'gaming.rail.dsp': 'DSP',
  'gaming.rail.tuned': 'ajusté',
  'gaming.stage.footsteps': 'Filtre Jeu',
  'gaming.stage.mainEq': 'EQ',
  'gaming.stage.curve': 'Courbe',
  'gaming.curve.any': 'Tout jeu',
  'gaming.editor.notLoaded': 'Le son propre de {game} n’est pas en lecture',
  'gaming.editor.notLoadedMore':
    'Essayez-le maintenant pour l’écouter et l’ajuster ici même. Votre son musique revient avec Décharger, ou quand le jeu se ferme.',
  'gaming.editor.eqNote':
    'Les bandes propres à ce jeu, tracées sur le graphique ci-dessus quand il est affiché.',
  'gaming.editor.curveNote':
    'La correction de casque que joue ce jeu, tirée de vos courbes ou de celle d’un casque, et chaque courbe appliquée avec elle, chacune avec son × pour la retirer.',
  'gaming.saveDialog.title': 'Enregistrer comme profil gaming',
  'gaming.saveDialog.hint':
    'D’autres jeux peuvent partir de lui, dans la liste des profils gaming.',
  'gaming.saveDialog.placeholder': 'Nom du profil',
  'gaming.renameDialog.title': 'Renommer cette copie',
  'gaming.renameDialog.hint': 'Seule la copie de ce jeu prend ce nom.',
  'gaming.renameDialog.placeholder': 'Nom de la copie',
  'gaming.addDialog.title': 'Ajouter un jeu',
  'gaming.addDialog.intro':
    'Choisissez le jeu. Il part d’un profil gaming et reçoit sa propre copie : vous ajustez la copie pour ce jeu, le profil lui-même ne change jamais.',
  'gaming.addDialog.running': 'Ouvert maintenant',
  'gaming.addDialog.installed': 'Trouvé sur ce PC',
  'gaming.addDialog.startsFrom': 'Part de',
  'gaming.addDialog.browse':
    'Absent ? Parcourir pour trouver le programme du jeu…',
  'gaming.addDialog.later':
    'Vous pouvez lui choisir un autre profil gaming à tout moment.',
  'gaming.addDialog.add': 'Ajouter {game}',
  'gaming.addDialog.cancel': 'Annuler',
  'gaming.addDialog.loading': 'Recherche de vos jeux…',
  'gaming.addDialog.none':
    'Aucun de vos lanceurs ne liste un jeu qui ne soit pas déjà ici. Parcourez plutôt pour trouver le programme du jeu.',
  'gaming.addDialog.close': 'Fermer',
  'gaming.profiles.intro':
    'Un jeu reçoit sa propre copie d’un profil. Vous ajustez la copie ; le profil ne change jamais.',
  'gaming.profiles.search': 'Rechercher des profils et des jeux',
  'gaming.profiles.searchClear': 'Effacer la recherche',
  'gaming.profiles.noMatch': 'Aucun profil gaming ne correspond à « {query} ».',
  'gaming.profiles.filterLabel': 'Afficher',
  'gaming.profiles.noCurve': 'Pas de courbe : tel que le jeu a été mixé',
  'gaming.profiles.filter.all': 'Tous',
  'gaming.profiles.filter.yours': 'Les vôtres',
  'gaming.profiles.yours': 'Les vôtres · enregistrés depuis la copie d’un jeu',
  'gaming.profiles.yoursEmpty':
    'Aucun pour l’instant. Ajustez un jeu et utilisez Enregistrer comme profil pour garder son son ici.',
  'gaming.profiles.readyGroup': 'Prêts à l’emploi · {group}',
  'gaming.profiles.savedFrom': 'Enregistré depuis la copie de {game}',
  'gaming.profiles.usedBy': '{games} est parti de lui',
  'gaming.profiles.use': 'Utiliser pour un jeu',
  'gaming.profiles.rename': 'Renommer',
  'gaming.profiles.delete': 'Supprimer',
  'gaming.profiles.confirmDelete':
    'Le supprimer ? Les jeux gardent leurs propres copies.',
  'gaming.profiles.keep': 'Garder',
  'gaming.profiles.renameTitle': 'Renommer le profil gaming',
  'gaming.profiles.renameHint':
    'Les jeux partis de lui gardent leurs copies ; seul le nom change.',
  'gaming.toast.loaded': 'Son propre son est actif',
  'gaming.toast.restored': 'Votre son musique est de retour',
  'gaming.paused.notice': 'En pause : le son propre de {game} est en lecture',
  'gaming.paused.tune': 'Ajuster {game}',
  'gaming.paused.title': 'Votre rack musique attend',
  'gaming.paused.body':
    'Pendant que {game} tourne, son propre son est actif et ce rack est en pause. Il revient exactement tel qu’il était quand le jeu se ferme, ou maintenant avec Décharger.',
  'gaming.paused.stages': '{preset} · ce qui revient',
  'gaming.paused.none': 'Toutes ses étapes sont désactivées.',
  'gaming.profileSelect.game': '{game} · son du jeu',
  'gaming.preset.tuned': '{game} (personnalisé)',
  'gaming.preset.openHint':
    'Le son propre de {game} est chargé. Son préréglage se change dans le Labo gaming.',
  'gaming.now.hint': 'Le son propre de {game} est en cours. Afficher le jeu.',
} as const;
