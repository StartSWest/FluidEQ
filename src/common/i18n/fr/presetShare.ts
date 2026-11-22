/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Sharing the listener's own presets. See `en/presetShare.ts`. */
export default {
  'presetShare.share': 'Partager {name}',
  'presetShare.menu.community': 'Partager avec la communauté…',
  'presetShare.menu.copyLink': 'Copier le lien de partage',
  'presetShare.menu.export': 'Exporter…',
  'presetShare.linkCopied': 'Lien de partage copié',
  'presetShare.linkMaking': 'Création du lien…',
  'presetShare.linkFailed.signedOut': 'Connectez-vous pour créer un lien',
  'presetShare.linkFailed.suspended':
    'Ce compte ne peut pas partager pour l’instant',
  'presetShare.linkFailed.rateLimited': 'Trop de liens cette heure-ci',
  'presetShare.linkFailed.tooMany': 'Limite de liens atteinte pour ce compte',
  'presetShare.linkFailed.takenDown': 'Ce lien a été retiré',
  'presetShare.linkFailed.offline': 'Le serveur de FluidEQ n’a pas répondu',

  'presetShare.text.title': '{name} · préréglage FluidEQ',
  'presetShare.text.curve': 'Courbe : {count} bandes',
  'presetShare.text.rack': 'Rack : {stages}',
  'presetShare.text.open': 'Ouvrir dans FluidEQ',

  'presetShare.chip.curve': 'Courbe · {count} bandes',
  'presetShare.chip.flat': 'Aucun changement',

  'presetShare.export.title': 'Exporter {name}',
  'presetShare.export.hint':
    'La courbe et chaque étape du rack. Votre Normaliseur et la tête de votre Salle restent les vôtres.',
  'presetShare.export.tab.forum': 'Pour tout forum',
  'presetShare.export.tab.file': 'Fichier',
  'presetShare.export.tab.apo': 'Equalizer APO',
  'presetShare.format.markdown': 'Markdown',
  'presetShare.format.markdownFor': 'Reddit · Discord · GitHub',
  'presetShare.format.bbcode': 'BBCode',
  'presetShare.format.bbcodeFor': 'Head-Fi · autres forums',
  'presetShare.format.plain': 'Texte brut',
  'presetShare.format.plainFor': 'Partout ailleurs',
  'presetShare.export.withLink':
    'Ajouter un lien court vers sa page sur fluideq.com',
  'presetShare.export.linkSignIn': 'Connectez-vous pour ajouter un lien court',
  'presetShare.export.fits':
    '{count} caractères · tient dans un message Discord',
  'presetShare.export.long':
    '{count} caractères · trop long pour un message Discord. Envoyez le lien court seul.',
  'presetShare.export.pasteHint':
    'Toute personne ayant FluidEQ peut coller ceci dans Importer.',
  'presetShare.export.fileHint':
    'Un JSON lisible avec la courbe et chaque étape, le fichier qu’enregistre la page DSP. Déposez-le sur Importer pour le récupérer.',
  'presetShare.export.apoNoCurve':
    'Ce préréglage n’a pas de courbe : tout ce qu’il fait se trouve dans le rack, qui nécessite FluidEQ.',
  'presetShare.export.apoRack':
    'Seule la courbe passe dans ce format. {stages} nécessitent FluidEQ.',
  'presetShare.export.copy': 'Copier',
  'presetShare.export.copyCurve': 'Copier la courbe',
  'presetShare.export.save': 'Enregistrer le fichier…',
  'presetShare.export.copied': 'Copié',
  'presetShare.export.saved': 'Enregistré',
  'presetShare.export.failed': 'Cela n’a pas abouti. Réessayez.',

  'presetShare.forum.attached': 'Préréglage joint',
  'presetShare.forum.remove': 'Retirer le préréglage',
  'presetShare.forum.template':
    'Conçu pour : \nÉcouté sur : \nÀ essayer avec : \n\nCe qu’il fait : ',

  'presetShare.card.by': 'Partagé par @{author}',
  'presetShare.card.sharedBy': 'Partagé par {author}',
  'presetShare.card.sharedByMember': 'Partagé par un membre de FluidEQ',
  'presetShare.card.add': 'Ajouter à mes préréglages',
  'presetShare.card.added': 'Dans « Les vôtres » · en lecture',
  'presetShare.card.try': 'Essayer',
  'presetShare.card.stopTrying': 'Arrêter l’essai',
  'presetShare.card.tryingNote':
    'Joue jusqu’à ce que vous l’arrêtiez ou quittiez la publication ; votre propre son revient ensuite.',

  'presetShare.import.button': 'Importer',
  'presetShare.import.title': 'Importer un préréglage',
  'presetShare.import.hint':
    'Collez une publication de forum, un lien de partage ou un fichier de préréglage. Seul le préréglage qu’il contient est lu.',
  'presetShare.import.placeholder': 'Collez ici…',
  'presetShare.import.chooseFile': 'Choisir un fichier…',
  'presetShare.import.found': 'Un préréglage trouvé',
  'presetShare.import.missing':
    'Ce texte ne contient aucun préréglage FluidEQ. Collez la publication entière ou le lien de partage.',
  'presetShare.import.newer':
    'Ce préréglage a été créé avec une version plus récente de FluidEQ. Mettez FluidEQ à jour pour le lire.',
  'presetShare.import.damaged':
    'Le code du préréglage est tronqué ou endommagé. Copiez-le à nouveau du début à la fin.',
  'presetShare.import.gone':
    'Ce préréglage n’est plus partagé. Demandez plutôt son code.',
  'presetShare.import.offline':
    'FluidEQ n’a pas pu joindre son serveur pour ouvrir ce lien. Vérifiez la connexion et réessayez.',

  'presetShare.link.title': 'Ajouter ce préréglage ?',
  'presetShare.link.hint':
    'Depuis un lien que vous avez ouvert. Rien ne joue ni ne s’enregistre avant que vous appuyiez.',
  'presetShare.link.notNow': 'Pas maintenant',
  'presetShare.link.fetching': 'Récupération du préréglage auprès de FluidEQ…',
} as const;
