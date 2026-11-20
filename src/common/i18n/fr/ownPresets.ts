/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The listener's own presets. See `en/ownPresets.ts`. */
export default {
  'eq.own.new': 'Nouveau préréglage',
  'eq.own.newHint': 'Une courbe et un rack à vous',
  'eq.own.dialogHint':
    'Une courbe pour l’égaliseur principal et un rack pour la page DSP, enregistrés sous votre nom.',
  'eq.own.name': 'Nom',
  'eq.own.defaultName': 'Mon préréglage',
  'eq.own.defaultFrom': 'Mon {name}',
  'eq.own.curveFrom': 'La courbe part de',
  'eq.own.curveFromHint': 'Vous la façonnez ensuite',
  'eq.own.fromPlaying': '{name}, en cours',
  'eq.own.flat': 'Plate',
  'eq.own.rackFrom': 'Le rack part de',
  'eq.own.rackOf': 'Rack de {name}',
  'eq.own.rackNow': 'La page DSP actuelle',
  'eq.own.rackEmpty': 'Vide',
  'eq.own.create': 'Créer et façonner la courbe',
  'eq.own.editing': 'Modification',
  'eq.own.parts': 'Parties du préréglage',
  'eq.own.curve': 'Courbe',
  'eq.own.rack': 'Rack',
  'eq.own.unsaved': 'Non enregistré',
  'eq.own.discard': 'Abandonner',
  'eq.own.save': 'Enregistrer le préréglage',
  'eq.own.addBand': 'Ajouter une bande',
  'eq.own.curveBands': 'Bandes de la courbe de « {name} »',
  'eq.own.edit': 'Modifier',
  'eq.own.more': 'Plus pour « {name} »',
  'eq.own.renameLabel': 'Nouveau nom pour « {name} »',
  'eq.own.about':
    'L’un des vôtres. Sa courbe joue dans l’égaliseur principal, son rack sur la page DSP.',
  'eq.own.deleteAsk':
    'Supprimer « {name} » ? Il quitte « Les vôtres ». S’il est en cours, sa courbe et son rack s’arrêtent.',
  'eq.own.keep': 'Le garder',
  'eq.own.emptyTitle': 'Rien à vous pour l’instant',
  'eq.own.emptyHint':
    '« Nouveau préréglage » en crée un : une courbe pour l’égaliseur principal et un rack pour la page DSP.',
} as const;
