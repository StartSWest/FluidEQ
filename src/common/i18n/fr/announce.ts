/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const announce = {
  'announce.eyebrow': 'Nouveau dans Visualiseurs · {count} scènes',
  'announce.try': 'Les essayer maintenant',
  'announce.later': 'Plus tard',
  'announce.previewNote':
    'Aperçu. Rien n’a été envoyé et rien n’a été enregistré.',
  'announce.untitled': 'Nouvelles scènes',
  'announce.tab': 'Annonces',
  'announce.pageHint':
    'Chaque personne voit une annonce une seule fois, en grand, par-dessus ce qu’elle a ouvert. Les membres dont l’essai se termine dans les deux jours voient aussi une ligne pour garder Plus.',
  'announce.field.title': 'Titre',
  'announce.field.titlePlaceholder': 'Par exemple : Route de nuit',
  'announce.field.body': 'Ce que c’est',
  'announce.field.bodyPlaceholder':
    'Par exemple : six nouvelles scènes de ville la nuit qui bougent avec vos basses et vos aigus.',
  'announce.field.scenes':
    'Scènes incluses : {count} sur {most}. La première est la grande image.',
  'announce.field.noScenes':
    'Les scènes de FluidEQ ne sont pas encore chargées. Ouvrez Visualiseurs une fois, puis revenez.',
  'announce.field.when': 'Publication',
  'announce.field.audience': 'Qui la voit',
  'announce.audience.everyone': 'Toutes les personnes connectées',
  'announce.audience.everyoneLine':
    'Membres Plus, essais et comptes gratuits. Les comptes gratuits sont envoyés vers Visualiseurs pour essayer les scènes.',
  'announce.audience.members': 'Membres Plus et essais',
  'announce.audience.membersLine':
    'Tous ceux qui peuvent lire les scènes dès maintenant.',
  'announce.audience.trialEnding':
    'Seulement les essais qui se terminent dans 2 jours',
  'announce.audience.trialEndingLine':
    'Les membres qui sont sur le point de décider s’ils paient.',
  'announce.trials.dayAfter':
    '{count} essais se terminent le {date}, le lendemain.',
  'announce.trials.twoAfter': '{count} de plus le jour suivant.',
  'announce.preview': 'Aperçu',
  'announce.schedule': 'Programmer',
  'announce.saveChanges': 'Enregistrer les modifications',
  'announce.stopEditing': 'Arrêter de modifier',
  'announce.done': 'Programmée. Elle paraît le {date}.',
  'announce.listTitle': 'Programmées et affichées',
  'announce.listEmpty': 'Rien de programmé.',
  'announce.state.out': 'Affichée',
  'announce.state.later': 'Programmée',
  'announce.edit': 'Modifier',
  'announce.cancel': 'L’annuler',
  'announce.cancelAsk': 'Annuler cette annonce ?',
  'announce.cancelOut':
    'Ne plus l’afficher aux personnes qui ne l’ont pas encore vue ?',
  'announce.keep': 'La garder',
} as const;

export default announce;
