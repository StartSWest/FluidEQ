/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The listener's own presets. See `en/ownPresets.ts`. */
export default {
  'eq.own.new': 'Nuovo preset',
  'eq.own.newHint': 'Una curva e un rack tutti tuoi',
  'eq.own.dialogHint':
    'Una curva per l’EQ principale e un rack per la pagina DSP, salvati con il tuo nome.',
  'eq.own.name': 'Nome',
  'eq.own.defaultName': 'Il mio preset',
  'eq.own.defaultFrom': 'Il mio {name}',
  'eq.own.curveFrom': 'La curva parte da',
  'eq.own.curveFromHint': 'Poi le dai forma',
  'eq.own.fromPlaying': '{name}, in riproduzione',
  'eq.own.flat': 'Piatta',
  'eq.own.rackFrom': 'Il rack parte da',
  'eq.own.rackOf': 'Rack di {name}',
  'eq.own.rackNow': 'La pagina DSP attuale',
  'eq.own.rackEmpty': 'Vuoto',
  'eq.own.create': 'Crea e dai forma alla curva',
  'eq.own.editing': 'In modifica',
  'eq.own.parts': 'Parti del preset',
  'eq.own.curve': 'Curva',
  'eq.own.rack': 'Rack',
  'eq.own.unsaved': 'Non salvato',
  'eq.own.discard': 'Scarta',
  'eq.own.save': 'Salva preset',
  'eq.own.addBand': 'Aggiungi banda',
  'eq.own.curveBands': 'Bande della curva di «{name}»',
  'eq.own.edit': 'Modifica',
  'eq.own.editCopy': 'Modifica una copia',
  'eq.own.copyName': '{name} (copia)',
  'eq.own.more': 'Altro per «{name}»',
  'eq.own.renameLabel': 'Nuovo nome per «{name}»',
  'eq.own.about':
    'Uno dei tuoi. La sua curva suona nell’EQ principale, il suo rack nella pagina DSP.',
  'eq.own.deleteAsk':
    'Eliminare «{name}»? Esce da I tuoi. Se è in riproduzione, la sua curva e il suo rack si fermano.',
  'eq.own.keep': 'Tienilo',
  'eq.own.emptyTitle': 'Ancora niente di tuo',
  'eq.own.emptyHint':
    'Nuovo preset ne crea uno: una curva per l’EQ principale e un rack per la pagina DSP.',
} as const;
