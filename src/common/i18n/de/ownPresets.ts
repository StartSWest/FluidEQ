/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The listener's own presets. See `en/ownPresets.ts`. */
export default {
  'eq.own.new': 'Neues Preset',
  'eq.own.newHint': 'Eine eigene Kurve und ein eigenes Rack',
  'eq.own.dialogHint':
    'Eine Kurve für den Haupt-EQ und ein Rack für die DSP-Seite, unter Ihrem Namen gespeichert.',
  'eq.own.name': 'Name',
  'eq.own.defaultName': 'Mein Preset',
  'eq.own.defaultFrom': 'Mein {name}',
  'eq.own.curveFrom': 'Die Kurve beginnt mit',
  'eq.own.curveFromHint': 'Danach formen Sie sie',
  'eq.own.fromPlaying': '{name}, läuft gerade',
  'eq.own.flat': 'Flach',
  'eq.own.rackFrom': 'Das Rack beginnt mit',
  'eq.own.rackOf': 'Rack von {name}',
  'eq.own.rackNow': 'Die DSP-Seite, wie sie ist',
  'eq.own.rackEmpty': 'Leer',
  'eq.own.create': 'Erstellen und Kurve formen',
  'eq.own.editing': 'Wird bearbeitet',
  'eq.own.parts': 'Teile des Presets',
  'eq.own.curve': 'Kurve',
  'eq.own.rack': 'Rack',
  'eq.own.unsaved': 'Nicht gespeichert',
  'eq.own.discard': 'Verwerfen',
  'eq.own.save': 'Preset speichern',
  'eq.own.addBand': 'Band hinzufügen',
  'eq.own.curveBands': 'Bänder der Kurve von „{name}“',
  'eq.own.edit': 'Bearbeiten',
  'eq.own.more': 'Mehr zu „{name}“',
  'eq.own.renameLabel': 'Neuer Name für „{name}“',
  'eq.own.about':
    'Eines Ihrer eigenen. Seine Kurve spielt im Haupt-EQ, sein Rack auf der DSP-Seite.',
  'eq.own.deleteAsk':
    '„{name}“ löschen? Es verschwindet aus „Eigene“. Läuft es gerade, stoppen Kurve und Rack.',
  'eq.own.keep': 'Behalten',
  'eq.own.emptyTitle': 'Noch nichts Eigenes',
  'eq.own.emptyHint':
    '„Neues Preset“ erstellt eines: eine Kurve für den Haupt-EQ und ein Rack für die DSP-Seite.',
} as const;
