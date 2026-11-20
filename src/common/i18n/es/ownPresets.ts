/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The listener's own presets. See `en/ownPresets.ts`. */
export default {
  'eq.own.new': 'Nuevo preset',
  'eq.own.newHint': 'Una curva y un rack propios',
  'eq.own.dialogHint':
    'Una curva para el EQ principal y un rack para la página DSP, guardados con tu nombre.',
  'eq.own.name': 'Nombre',
  'eq.own.defaultName': 'Mi preset',
  'eq.own.defaultFrom': 'Mi {name}',
  'eq.own.curveFrom': 'La curva parte de',
  'eq.own.curveFromHint': 'Luego le das forma',
  'eq.own.fromPlaying': '{name}, sonando',
  'eq.own.flat': 'Plana',
  'eq.own.rackFrom': 'El rack parte de',
  'eq.own.rackOf': 'Rack de {name}',
  'eq.own.rackNow': 'La página DSP actual',
  'eq.own.rackEmpty': 'Vacío',
  'eq.own.create': 'Crear y dar forma a la curva',
  'eq.own.editing': 'Editando',
  'eq.own.parts': 'Partes del preset',
  'eq.own.curve': 'Curva',
  'eq.own.rack': 'Rack',
  'eq.own.unsaved': 'Sin guardar',
  'eq.own.discard': 'Descartar',
  'eq.own.save': 'Guardar preset',
  'eq.own.addBand': 'Añadir banda',
  'eq.own.curveBands': 'Bandas de la curva de «{name}»',
  'eq.own.edit': 'Editar',
  'eq.own.more': 'Más opciones de «{name}»',
  'eq.own.renameLabel': 'Nuevo nombre para «{name}»',
  'eq.own.about':
    'Uno de los tuyos. Su curva suena en el EQ principal y su rack en la página DSP.',
  'eq.own.deleteAsk':
    '¿Eliminar «{name}»? Sale de Tuyos. Si está sonando, su curva y su rack se detienen.',
  'eq.own.keep': 'Conservarlo',
  'eq.own.emptyTitle': 'Aún no tienes nada tuyo',
  'eq.own.emptyHint':
    'Nuevo preset crea uno: una curva para el EQ principal y un rack para la página DSP.',
} as const;
