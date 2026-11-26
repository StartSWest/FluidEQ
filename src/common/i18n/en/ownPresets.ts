/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The listener's own presets on the EQ page: New preset, its dialog, the
 * strip that stands over the graph while one is edited, and what Yours
 * offers for each (own presets, 2026-11-20).
 */
export default {
  'eq.own.new': 'New preset',
  'eq.own.newHint': 'A curve and a rack of your own',
  'eq.own.dialogHint':
    'A curve for the main EQ and a rack for the DSP page, saved under your name.',
  'eq.own.name': 'Name',
  'eq.own.defaultName': 'My preset',
  'eq.own.defaultFrom': 'My {name}',
  'eq.own.curveFrom': 'Curve starts from',
  'eq.own.curveFromHint': 'You shape it next',
  'eq.own.fromPlaying': '{name}, playing',
  'eq.own.flat': 'Flat',
  'eq.own.rackFrom': 'Rack starts from',
  'eq.own.rackOf': '{name}’s rack',
  'eq.own.rackNow': 'The DSP page now',
  'eq.own.rackEmpty': 'Empty',
  'eq.own.create': 'Create and shape the curve',
  'eq.own.editing': 'Editing',
  'eq.own.parts': 'Preset parts',
  'eq.own.curve': 'Curve',
  'eq.own.rack': 'Rack',
  'eq.own.unsaved': 'Not saved',
  'eq.own.discard': 'Discard',
  'eq.own.save': 'Save preset',
  'eq.own.addBand': 'Add band',
  'eq.own.curveBands': 'Bands of the curve of “{name}”',
  'eq.own.edit': 'Edit',
  'eq.own.editCopy': 'Edit a copy',
  'eq.own.copyName': '{name} (copy)',
  'eq.own.more': 'More for “{name}”',
  'eq.own.renameLabel': 'New name for “{name}”',
  'eq.own.about':
    'One of yours. Its curve plays in the main EQ, its rack on the DSP page.',
  'eq.own.deleteAsk':
    'Delete “{name}”? It leaves Yours. If it is playing, its curve and rack stop.',
  'eq.own.keep': 'Keep it',
  'eq.own.emptyTitle': 'Nothing of yours yet',
  'eq.own.emptyHint':
    'New preset makes one: a curve for the main EQ and a rack for the DSP page.',
} as const;
