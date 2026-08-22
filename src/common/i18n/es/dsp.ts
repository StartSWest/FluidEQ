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
  'dsp.enabled': 'Activado',

  'dsp.eq.title': 'Ecualizador',
  'dsp.eq.description':
    'Quince bandas paramétricas, dibujadas como responden los filtros de verdad y no como se les pidió.',
  'dsp.eq.band': 'Banda',
  'dsp.eq.bands': 'Bandas',
  'dsp.eq.shape': 'Tipo de banda',
  'dsp.eq.bandOff': 'Apagada',
  'dsp.eq.type.peak': 'Campana',
  'dsp.eq.type.lowShelf': 'Shelf grave',
  'dsp.eq.type.highShelf': 'Shelf agudo',
  'dsp.eq.type.notch': 'Notch',
  'dsp.eq.type.lowPass': 'Paso bajo',
  'dsp.eq.type.highPass': 'Paso alto',
  'dsp.eq.type.bandPass': 'Paso banda',
  'dsp.eq.frequency': 'Frec',
  'dsp.eq.gain': 'Ganancia',
  'dsp.eq.quality': 'Ancho',

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
  'dsp.maximizer.headroomHint':
    'El techo deja margen para los {gain} dB que tu perfil de salida añade después.',

  'tabs.dsp': 'DSP',
};

export default dsp;
