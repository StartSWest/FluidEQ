const files = {
  'files.title.sharePreset': 'Compartir preset de EQ',
  'files.title.exportDspChain': 'Exportar preset de cadena DSP',
  'files.title.importEq': 'Importar ajustes de EQ',
  'files.title.importImpulse': 'Importar una respuesta al impulso',
  'files.title.exportChain': 'Exportar esta cadena',
  'files.title.importChain': 'Importar una cadena',
  'files.title.exportKaraoke': 'Exportar karaoke',
  'files.title.saveDownload': 'Guardar la descarga en tu equipo',
  'files.save': 'Guardar',
  'files.type.eqPreset': 'Preset de EQ de FluidEQ',
  'files.type.dspChain': 'Cadena DSP de FluidEQ',
  'files.type.eqSettings': 'Ajustes de EQ',
  'files.type.impulse': 'Respuesta al impulso WAV',
  'files.type.chain': 'Cadena de FluidEQ',
  'files.type.scene': 'Escena de FluidEQ',
  'files.type.programs': 'Programas',
  'files.type.pictures': 'Imágenes',
  'files.type.all': 'Todos los archivos',
  'files.imported.profile':
    'Se importaron {count} bandas del perfil de FluidEQ.',
  'files.imported.graphicEq':
    'Se importaron {count} bandas del archivo GraphicEQ.',
  'files.imported.parametricEq':
    'Se importaron {count} bandas del archivo ParametricEQ de Equalizer APO.',
  'files.imported.skipped':
    '{count} banda(s) usaban un tipo de filtro que FluidEQ no puede editar y se omitieron.',
  'files.imported.squiglink':
    'Se importaron {count} bandas de la exportación de Squiglink.',
  'files.imported.squiglinkSkipped':
    '{count} banda(s) no se podían editar en FluidEQ y se omitieron.',
  'files.imported.preampKept':
    'Se conservó su preamplificación de {gain} dB, así que la normalización automática está desactivada.',
  'files.impulse.applied': 'Se aplicó {name}.',
  'files.chain.exported': 'Se exportó la cadena de {device}.',
  'files.chain.imported': 'Se importó la cadena.',
  'files.chain.importedFrom': 'Se importó la cadena de {device}.',
  'files.chain.noOutput':
    'No hay ninguna salida activa, así que no hay dónde importar.',
  'files.chain.notChain': 'Ese archivo no es una cadena de FluidEQ.',
  'files.squiglink.empty':
    'Pega una exportación de EQ de Squiglink antes de importarla.',
  'files.squiglink.tooLarge':
    'Esa exportación de EQ es demasiado grande para importarla.',
  'files.squiglink.noFilters':
    'No se encontraron filtros de Equalizer APO. Copia el texto ParametricEQ o GraphicEQ exportado desde Squiglink.',
  'files.eq.tooLarge':
    'Ese archivo es demasiado grande para ser un ajuste de EQ.',
  'files.eq.notProfile': 'Ese archivo JSON no es un perfil de FluidEQ.',
  'files.eq.noFilters':
    'No se encontraron filtros de Equalizer APO en ese archivo. Se esperaba un perfil ParametricEQ, GraphicEQ o de FluidEQ.',
  'files.wav.notWav': 'Ese archivo no es una respuesta al impulso WAV.',
  'files.wav.truncated': 'Ese archivo WAV está truncado.',
  'files.wav.unsupported': 'Equalizer APO no admite ese formato WAV.',
  'files.wav.noFormat': 'Ese archivo WAV no tiene bloque de formato.',
  'files.wav.tooLarge':
    'Esa respuesta al impulso es demasiado grande para importarla con seguridad.',
  'files.wav.rate':
    'Esa respuesta al impulso es de {rate} Hz. Equalizer APO necesita una de estas frecuencias: {rates} Hz.',
  'files.wav.noChunks':
    'Ese archivo WAV no tiene un bloque de formato o de datos utilizable.',
  'files.wav.sampleFormat':
    'El formato de muestras de ese WAV no se puede analizar con seguridad.',
  'files.wav.noSamples': 'Esa respuesta al impulso WAV no contiene muestras.',
  'files.wav.badSamples':
    'Esa respuesta al impulso WAV contiene muestras no válidas.',
  'files.wav.silent':
    'Esa respuesta al impulso WAV no tiene una respuesta medible.',
  'files.apo.notLocated':
    'Equalizer APO no está instalado o no se encontró su instalación.',
  'files.apo.selectorMissing':
    'No se encontró el configurador de dispositivos de Equalizer APO.',
  'files.apo.editorMissing': 'No se encontraron los ajustes de Equalizer APO.',
  'files.wav.tooLong':
    'Esa respuesta al impulso es demasiado larga para analizarla y normalizarla con seguridad.',
} as const;

export default files;
