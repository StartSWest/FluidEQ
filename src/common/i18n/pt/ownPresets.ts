/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The listener's own presets. See `en/ownPresets.ts`. */
export default {
  'eq.own.new': 'Novo preset',
  'eq.own.newHint': 'Uma curva e um rack seus',
  'eq.own.dialogHint':
    'Uma curva para o EQ principal e um rack para a página DSP, salvos com o seu nome.',
  'eq.own.name': 'Nome',
  'eq.own.defaultName': 'Meu preset',
  'eq.own.defaultFrom': 'Meu {name}',
  'eq.own.curveFrom': 'A curva começa de',
  'eq.own.curveFromHint': 'Depois você dá forma a ela',
  'eq.own.fromPlaying': '{name}, tocando',
  'eq.own.flat': 'Plana',
  'eq.own.rackFrom': 'O rack começa de',
  'eq.own.rackOf': 'Rack de {name}',
  'eq.own.rackNow': 'A página DSP atual',
  'eq.own.rackEmpty': 'Vazio',
  'eq.own.create': 'Criar e moldar a curva',
  'eq.own.editing': 'Editando',
  'eq.own.parts': 'Partes do preset',
  'eq.own.curve': 'Curva',
  'eq.own.rack': 'Rack',
  'eq.own.unsaved': 'Não salvo',
  'eq.own.discard': 'Descartar',
  'eq.own.save': 'Salvar preset',
  'eq.own.addBand': 'Adicionar banda',
  'eq.own.curveBands': 'Bandas da curva de “{name}”',
  'eq.own.edit': 'Editar',
  'eq.own.more': 'Mais para “{name}”',
  'eq.own.renameLabel': 'Novo nome para “{name}”',
  'eq.own.about':
    'Um dos seus. A curva toca no EQ principal; o rack, na página DSP.',
  'eq.own.deleteAsk':
    'Excluir “{name}”? Ele sai de Seus. Se estiver tocando, a curva e o rack param.',
  'eq.own.keep': 'Manter',
  'eq.own.emptyTitle': 'Nada seu ainda',
  'eq.own.emptyHint':
    'Novo preset cria um: uma curva para o EQ principal e um rack para a página DSP.',
} as const;
