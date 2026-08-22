/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const dsp = {
  'dsp.title': 'DSP',
  'dsp.scopeNotice':
    'Se aplica a la música reproducida dentro de FluidEQ. No cambia Spotify, YouTube ni otras aplicaciones.',
  'dsp.idle':
    'Se activa cuando reproduces algo desde la Biblioteca. Procesa el reproductor de FluidEQ, así que no tiene nada que hacer hasta que cargues una pista.',
  'dsp.unavailable':
    'El procesado de audio no pudo iniciarse. La reproducción no se ve afectada.',
  'dsp.presets': 'Ajustes',
  'dsp.preset.flat': 'Apagado',
  'dsp.preset.lossyRepair': 'Reparar comprimido',
  'dsp.preset.loud': 'Alto',
  'dsp.bypassed': 'Desactivado',
  'dsp.enabled': 'Activado',

  'dsp.eqPreset.custom': 'Personalizado',
  'dsp.eqPreset.label': 'Ajuste',
  'dsp.eqPreset.default': 'Por defecto',
  'dsp.eqPreset.reset': 'Restablecer',
  'dsp.eqPreset.flat': 'Plano',
  'dsp.eqPreset.vShape': 'Forma en V',
  'dsp.eqPreset.rock': 'Rock',
  'dsp.eqPreset.pop': 'Pop',
  'dsp.eqPreset.jazz': 'Jazz',
  'dsp.eqPreset.classical': 'Clásica',
  'dsp.eqPreset.electronic': 'Electrónica',
  'dsp.eqPreset.hiphop': 'Hip-hop',
  'dsp.eqPreset.acoustic': 'Acústica',
  'dsp.eqPreset.vocal': 'Voz',
  'dsp.eqPreset.podcast': 'Pódcast',
  'dsp.eqPreset.bassBoost': 'Realce de graves',
  'dsp.eqPreset.trebleBoost': 'Realce de agudos',
  'dsp.eqPreset.loudness': 'Loudness',
  'dsp.eqPreset.lateNight': 'De noche',
  'dsp.eqPreset.smallSpeakers': 'Altavoces pequeños',
  'dsp.eqPreset.car': 'Coche',
  'dsp.eqPreset.gaming': 'Juegos',
  'dsp.eqPreset.movie': 'Cine',
  'dsp.eqPreset.warm': 'Cálido',
  'dsp.eqPreset.air': 'Aire',

  'dsp.eqPreset.import': 'Importar',
  'dsp.eqPreset.export': 'Exportar',
  'dsp.eqPreset.imported': 'Se cargaron {count} filtros.',
  'dsp.eqPreset.importSkipped':
    'Se cargaron {count} filtros, {skipped} omitidos.',
  'dsp.eqPreset.importEmpty': 'Este ecualizador no pudo leer ningún filtro.',
  'dsp.eqPreset.importFailed': 'No se pudo leer ese archivo.',
  'dsp.eqPreset.importPreamp':
    'Sus {gain} dB de margen se miden aquí en su lugar.',

  'dsp.eq.rack': 'Bandas',
  'dsp.eqModel.label': 'Carácter',
  'dsp.eqModel.clean': 'Ninguno',
  'dsp.eqModel.proportional': 'Enfocado',
  'dsp.eqModel.wide': 'Amplio',
  'dsp.eqEngine.label': 'Motor',
  'dsp.eqPhase.label': 'Fase',
  'dsp.eqPhase.minimum': 'Mínima',
  'dsp.eqPhase.linear': 'Lineal',
  'dsp.eqPhase.linearLatency': 'Lineal (+{ms} ms)',
  'dsp.eqEngine.serial': 'En serie',
  'dsp.eqEngine.parallel': 'En paralelo',
  'dsp.eqStereo.label': 'Aplica a',
  'dsp.eqStereo.stereo': 'Estéreo',
  'dsp.eqStereo.mid': 'Solo centro',
  'dsp.eqStereo.side': 'Solo lados',
  'dsp.eqOversample.label': 'Sobremuestreo',
  'dsp.eqOversample.off': 'No',
  'dsp.eqOversample.on': '2x',
  'dsp.eqImport.title': 'Importar una curva de EQ',
  'dsp.eqImport.hint':
    'Pega una curva de Squiglink, AutoEq o Equalizer APO, o elige el archivo que la contiene.',
  'dsp.eqImport.placeholder':
    'Preamp: -5.4 dB\nFilter: ON PK Fc 1200 Hz Gain -2.1 dB Q 1.41',
  'dsp.eqImport.chooseFile': 'Elegir archivo',
  'dsp.eqImport.apply': 'Importar',
  'dsp.eqImport.cancel': 'Cancelar',

  'dsp.eq.title': 'Ecualizador',
  'dsp.eq.description':
    'Quince bandas paramétricas, dibujadas como responden los filtros de verdad y no como se les pidió.',
  'dsp.eq.band': 'Banda',
  'dsp.eq.bands': 'Bandas',
  'dsp.eq.shape': 'Tipo de banda',
  'dsp.eq.bandOff': 'Apagada',
  'dsp.eq.addLeft': 'Añadir una banda por debajo de esta',
  'dsp.eq.addRight': 'Añadir una banda por encima de esta',
  'dsp.eq.type.peak': 'Campana',
  'dsp.eq.type.lowShelf': 'Shelf grave',
  'dsp.eq.type.highShelf': 'Shelf agudo',
  'dsp.eq.type.notch': 'Notch',
  'dsp.eq.type.lowPass': 'Paso bajo',
  'dsp.eq.type.highPass': 'Paso alto',
  'dsp.eq.type.bandPass': 'Paso banda',
  'dsp.eq.frequency': 'Frec',
  'dsp.eq.gain': 'Ganancia',
  'dsp.eq.preamp': 'Preamp',
  'dsp.eq.trim': 'Ajuste auto',
  'dsp.eq.trimHint':
    'Espacio reservado antes de las bandas para que esta curva no sature.',
  'dsp.eq.overUnity': '{gain} dB de más',
  'dsp.eq.character': 'Carácter',
  'dsp.eq.subsonic': 'Subgraves',
  'dsp.eq.fuzz': 'Fuzz',
  'dsp.eq.monoBelow': 'Mono debajo',
  'dsp.eq.phase': 'Fase',
  'dsp.eq.quality': 'Ancho',
  'dsp.eq.threshold': 'Umbral',
  'dsp.eq.dynamic': 'Dinámico',
  'dsp.eq.dynamicOn': 'Dinámico SÍ',
  'dsp.eq.dynamicHint': 'Actúa solo mientras esta banda supera su umbral.',

  'dsp.exciter.title': 'Excitador',
  'dsp.exciter.description':
    'Genera armónicos agudos que el códec descartó. Los inventa; no los recupera.',
  'dsp.exciter.crossover': 'Por encima de',
  'dsp.exciter.drive': 'Intensidad',
  'dsp.exciter.mix': 'Cantidad',

  'dsp.compressor.title': 'Compresor multibanda',
  'dsp.compressor.description':
    'Iguala el nivel en tres bandas de frecuencia de forma independiente.',
  'dsp.compressor.band.low': 'Graves',
  'dsp.compressor.band.mid': 'Medios',
  'dsp.compressor.band.high': 'Agudos',
  'dsp.compressor.crossoverLow': 'Corte graves / medios',
  'dsp.compressor.crossoverHigh': 'Corte medios / agudos',
  'dsp.compressor.threshold': 'Umbral',
  'dsp.compressor.ratio': 'Proporción',
  'dsp.compressor.attack': 'Ataque',
  'dsp.compressor.release': 'Relajación',
  'dsp.compressor.makeup': 'Compensación',

  'dsp.maximizer.title': 'Maximizador',
  'dsp.maximizer.description':
    'Sube el nivel general sin dejar que los picos pasen del techo.',
  'dsp.maximizer.ceiling': 'Techo',
  'dsp.maximizer.lookAhead': 'Anticipación',
  'dsp.maximizer.release': 'Relajación',

  'tabs.dsp': 'DSP',
};

export default dsp;
