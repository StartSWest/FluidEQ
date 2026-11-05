/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The Gaming Lab. See `en/gaming.ts`. */
export default {
  'gaming.tab': 'Laboratorio gaming',
  'gaming.view.games': 'Juegos',
  'gaming.view.profiles': 'Perfiles gaming',
  'gaming.switch': 'Cambiar cuando un juego está al frente',
  'gaming.switch.hint':
    'Apagado, tus juegos conservan tu sonido de música y nada cambia por sí solo.',
  'gaming.add': 'Añadir un juego',
  'gaming.list.show': 'Mostrar lista de juegos',
  'gaming.list.hide': 'Ocultar lista de juegos',
  'gaming.list.resize': 'Cambiar tamaño de la lista de juegos',
  'gaming.list.count': 'Tus juegos · {count}',
  'gaming.list.from': 'De {profile}',
  'gaming.list.tuned': 'ajustado',
  'gaming.list.playing': 'Jugando',
  'gaming.empty.title': 'Aún no hay juegos',
  'gaming.empty.more':
    'Añade un juego y tendrá un sonido propio, copiado de un perfil gaming hecho para él. Aquí ajustas la copia; el perfil se queda como estaba.',
  'gaming.game.where': '{source} · en {output}',
  'gaming.profile.label': 'Perfil gaming',
  'gaming.profile.kind.title': 'Para este juego',
  'gaming.profile.kind.kind': 'Por tipo',
  'gaming.profile.kind.yours': 'Tuyos',
  'gaming.profile.kind.chain': 'Preset DSP',
  'gaming.profile.gone': 'Un perfil que ya no existe',
  'gaming.profile.pickHint':
    'Elegir otro perfil le da a este juego una copia nueva de él.',
  'gaming.save': 'Guardar como perfil',
  'gaming.save.new': 'Guardar como perfil nuevo…',
  'gaming.save.newHint':
    'Va a Tuyos, para que otros juegos puedan partir de él. {game} pasa a partir de él.',
  'gaming.save.update': 'Actualizar {profile}',
  'gaming.save.updateHint':
    'Tu perfil toma estos cambios. Los juegos que partieron de él conservan sus propias copias.',
  'gaming.save.reset': 'Volver a {profile}',
  'gaming.save.resetHint':
    'Descarta el ajuste de este juego y empieza de nuevo desde el perfil.',
  'gaming.save.rename': 'Renombrar esta copia…',
  'gaming.save.delete': 'Borrar esta copia',
  'gaming.save.deleteHint':
    'Quita este juego y su ajuste. El perfil se queda como está.',
  'gaming.action.unload': 'Descargar',
  'gaming.action.unloadHint': 'Tu sonido de música vuelve ahora.',
  'gaming.action.try': 'Probar ahora',
  'gaming.action.tryHint':
    'Pone ahora el sonido propio de {game}, para que lo oigas y lo ajustes.',
  'gaming.status.tuned':
    'La copia de {profile} de este juego. Ajustado: {parts}. El perfil en sí no se toca.',
  'gaming.status.tunedNamed':
    '{copy}: la copia de {profile} de este juego. Ajustado: {parts}. El perfil en sí no se toca.',
  'gaming.status.same':
    'Igual que el perfil. Lo que cambies aquí se queda con este juego; el perfil en sí nunca cambia.',
  'gaming.rail.game': 'Juego',
  'gaming.rail.sound': 'Sonido',
  'gaming.rail.dsp': 'DSP',
  'gaming.rail.tuned': 'ajustado',
  'gaming.stage.footsteps': 'Filtro Juego',
  'gaming.stage.mainEq': 'EQ',
  'gaming.stage.curve': 'Curva',
  'gaming.curve.any': 'Cualquier juego',
  'gaming.editor.notLoaded': 'El sonido propio de {game} no está sonando',
  'gaming.editor.notLoadedMore':
    'Pruébalo ahora para oírlo y ajustarlo aquí mismo. Tu sonido de música vuelve con Descargar, o cuando el juego se cierra.',
  'gaming.editor.eqNote':
    'Las bandas propias de este juego, dibujadas en la gráfica de arriba cuando se muestra.',
  'gaming.editor.curveNote':
    'La corrección de auriculares que suena en este juego, de tus curvas o la de unos auriculares, y cada curva aplicada con ella, cada una con su × para quitarla.',
  'gaming.saveDialog.title': 'Guardar como perfil gaming',
  'gaming.saveDialog.hint':
    'Otros juegos pueden partir de él, en la lista de perfiles gaming.',
  'gaming.saveDialog.placeholder': 'Nombre del perfil',
  'gaming.renameDialog.title': 'Renombrar esta copia',
  'gaming.renameDialog.hint': 'Solo la copia de este juego toma el nombre.',
  'gaming.renameDialog.placeholder': 'Nombre de la copia',
  'gaming.addDialog.title': 'Añadir un juego',
  'gaming.addDialog.intro':
    'Elige el juego. Parte de un perfil gaming y recibe su propia copia: ajustas la copia para este juego, el perfil en sí nunca cambia.',
  'gaming.addDialog.running': 'Abierto ahora',
  'gaming.addDialog.installed': 'Encontrado en este PC',
  'gaming.addDialog.startsFrom': 'Parte de',
  'gaming.addDialog.browse': '¿No está? Busca el programa del juego…',
  'gaming.addDialog.later':
    'Puedes elegirle otro perfil gaming cuando quieras.',
  'gaming.addDialog.add': 'Añadir {game}',
  'gaming.addDialog.cancel': 'Cancelar',
  'gaming.addDialog.loading': 'Buscando tus juegos…',
  'gaming.addDialog.none':
    'Ninguno de tus launchers tiene un juego que no esté ya aquí. Busca el programa del juego en su lugar.',
  'gaming.addDialog.close': 'Cerrar',
  'gaming.profiles.intro':
    'Un juego recibe su propia copia de un perfil. Tú ajustas la copia; el perfil nunca cambia.',
  'gaming.profiles.search': 'Buscar perfiles y juegos',
  'gaming.profiles.searchClear': 'Borrar la búsqueda',
  'gaming.profiles.noMatch': 'Ningún perfil gaming coincide con «{query}».',
  'gaming.profiles.filterLabel': 'Mostrar',
  'gaming.profiles.noCurve': 'Sin curva: tal como se mezcló el juego',
  'gaming.profiles.filter.all': 'Todos',
  'gaming.profiles.filter.yours': 'Tuyos',
  'gaming.profiles.yours': 'Tuyos · guardados de la copia de un juego',
  'gaming.profiles.yoursEmpty':
    'Ninguno aún. Ajusta un juego y usa Guardar como perfil para conservar su sonido aquí.',
  'gaming.profiles.readyGroup': 'Listos · {group}',
  'gaming.profiles.savedFrom': 'Guardado de la copia de {game}',
  'gaming.profiles.usedBy': '{games} partió de él',
  'gaming.profiles.use': 'Usar para un juego',
  'gaming.profiles.rename': 'Renombrar',
  'gaming.profiles.delete': 'Borrar',
  'gaming.profiles.confirmDelete':
    '¿Borrarlo? Los juegos conservan sus propias copias.',
  'gaming.profiles.keep': 'Conservar',
  'gaming.profiles.renameTitle': 'Renombrar perfil gaming',
  'gaming.profiles.renameHint':
    'Los juegos que partieron de él conservan sus copias; solo cambia el nombre.',
  'gaming.toast.loaded': 'Perfil de juego cargado',
  'gaming.toast.restored': 'Perfil de música restaurado',
  'gaming.paused.notice': 'En pausa: suena el sonido propio de {game}',
  'gaming.paused.tune': 'Ajustar {game}',
  'gaming.paused.title': 'Tu rack de música está esperando',
  'gaming.paused.body':
    'Mientras {game} está abierto, su propio sonido está puesto y este rack queda en pausa. Vuelve tal como estaba cuando el juego se cierra, o ahora con Descargar.',
  'gaming.paused.stages': '{preset} · lo que vuelve',
  'gaming.paused.none': 'Todas sus etapas están apagadas.',
  'gaming.profileSelect.game': '{game} · sonido del juego',
  'gaming.preset.tuned': '{game} (personalizado)',
  'gaming.preset.openHint':
    'El sonido propio de {game} está cargado. Su preset se cambia en el Laboratorio gaming.',
  'gaming.now.hint': 'Suena el sonido propio de {game}. Mostrar el juego.',
} as const;
