/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Sharing the listener's own presets. See `en/presetShare.ts`. */
export default {
  'presetShare.share': 'Compartir {name}',
  'presetShare.menu.community': 'Compartir con la comunidad…',
  'presetShare.menu.copyLink': 'Copiar enlace para compartir',
  'presetShare.menu.export': 'Exportar…',
  'presetShare.linkCopied': 'Enlace para compartir copiado',

  'presetShare.text.title': '{name} · preset de FluidEQ',
  'presetShare.text.curve': 'Curva: {count} bandas',
  'presetShare.text.rack': 'Rack: {stages}',
  'presetShare.text.open': 'Abrir en FluidEQ',

  'presetShare.chip.curve': 'Curva · {count} bandas',
  'presetShare.chip.flat': 'Sin cambios',

  'presetShare.export.title': 'Exportar {name}',
  'presetShare.export.hint':
    'La curva y cada etapa del rack. Tu Normalizador y la cabeza de tu Sala se quedan contigo.',
  'presetShare.export.tab.forum': 'Para cualquier foro',
  'presetShare.export.tab.file': 'Archivo',
  'presetShare.export.tab.apo': 'Equalizer APO',
  'presetShare.format.markdown': 'Markdown',
  'presetShare.format.markdownFor': 'Reddit · Discord · GitHub',
  'presetShare.format.bbcode': 'BBCode',
  'presetShare.format.bbcodeFor': 'Head-Fi · otros foros',
  'presetShare.format.plain': 'Texto sin formato',
  'presetShare.format.plainFor': 'Cualquier otro sitio',
  'presetShare.export.withCode':
    'Añadir también el código como texto, para foros que acortan los enlaces',
  'presetShare.export.fits':
    '{count} caracteres · cabe en un mensaje de Discord',
  'presetShare.export.long':
    '{count} caracteres · demasiado largo para un mensaje de Discord, quita el código',
  'presetShare.export.pasteHint':
    'Cualquiera con FluidEQ puede pegarlo en Importar.',
  'presetShare.export.fileHint':
    'JSON legible con la curva y cada etapa, el archivo que guarda la página DSP. Suéltalo en Importar para recuperarlo.',
  'presetShare.export.apoNoCurve':
    'Este preset no tiene curva: todo su sonido está en el rack, que necesita FluidEQ.',
  'presetShare.export.apoRack':
    'En este formato solo viaja la curva. {stages} necesitan FluidEQ.',
  'presetShare.export.copy': 'Copiar',
  'presetShare.export.copyCurve': 'Copiar curva',
  'presetShare.export.save': 'Guardar archivo…',
  'presetShare.export.copied': 'Copiado',
  'presetShare.export.saved': 'Guardado',
  'presetShare.export.failed': 'No se pudo completar. Inténtalo de nuevo.',

  'presetShare.forum.attached': 'Preset adjunto',
  'presetShare.forum.remove': 'Quitar el preset',
  'presetShare.forum.template':
    'Hecho para: \nEscuchado en: \nPruébalo con: \n\nQué hace: ',

  'presetShare.card.by': 'Compartido por @{author}',
  'presetShare.card.add': 'Añadir a mis presets',
  'presetShare.card.added': 'En Tuyos · sonando',
  'presetShare.card.try': 'Probar',
  'presetShare.card.stopTrying': 'Dejar de probar',
  'presetShare.card.tryingNote':
    'Suena hasta que lo detengas o salgas de la publicación; luego vuelve tu propio sonido.',

  'presetShare.import.button': 'Importar',
  'presetShare.import.title': 'Importar un preset',
  'presetShare.import.hint':
    'Pega una publicación de un foro, un enlace para compartir o un archivo de preset. Solo se lee el preset que contiene.',
  'presetShare.import.paste': 'Pegar del portapapeles',
  'presetShare.import.placeholder': 'Pega aquí…',
  'presetShare.import.chooseFile': 'Elegir archivo…',
  'presetShare.import.found': 'Se encontró un preset',
  'presetShare.import.missing':
    'Este texto no contiene ningún preset de FluidEQ. Pega la publicación entera o el enlace para compartir.',
  'presetShare.import.newer':
    'Este preset se hizo con un FluidEQ más nuevo. Actualiza FluidEQ para leerlo.',
  'presetShare.import.damaged':
    'El código del preset está cortado o dañado. Cópialo otra vez de principio a fin.',
  'presetShare.import.clipboardFailed':
    'FluidEQ no pudo leer el portapapeles. Pégalo directamente en el cuadro.',

  'presetShare.link.title': '¿Añadir este preset?',
  'presetShare.link.hint':
    'Viene de un enlace que abriste. Nada suena ni se guarda hasta que pulses.',
  'presetShare.link.notNow': 'Ahora no',
} as const;
