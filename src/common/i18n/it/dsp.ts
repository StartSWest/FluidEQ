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
    'Si applica alla musica riprodotta dentro FluidEQ. Non cambia Spotify, YouTube o altre app.',
  'dsp.idle':
    'Si avvia quando riproduci qualcosa dalla Libreria. Elabora il lettore di FluidEQ, quindi non ha nulla da fare finché non carichi un brano.',
  'dsp.unavailable':
    "L'elaborazione audio non è riuscita ad avviarsi. La riproduzione non è interessata.",
  'dsp.presets': 'Preimpostazioni',
  'dsp.preset.flat': 'Spento',
  'dsp.preset.lossyRepair': 'Ripara compresso',
  'dsp.preset.loud': 'Forte',
  'dsp.enabled': 'Attivo',

  'dsp.exciter.title': 'Exciter',
  'dsp.exciter.description':
    'Genera le armoniche acute che un codec con perdita ha scartato. Le inventa, non le recupera.',
  'dsp.exciter.crossover': 'Sopra',
  'dsp.exciter.drive': 'Intensità',
  'dsp.exciter.mix': 'Quantità',

  'dsp.compressor.title': 'Compressore multibanda',
  'dsp.compressor.description':
    'Uniforma il livello in tre bande di frequenza in modo indipendente.',
  'dsp.compressor.band.low': 'Bassi',
  'dsp.compressor.band.mid': 'Medi',
  'dsp.compressor.band.high': 'Alti',
  'dsp.compressor.crossoverLow': 'Taglio bassi / medi',
  'dsp.compressor.crossoverHigh': 'Taglio medi / alti',
  'dsp.compressor.threshold': 'Soglia',
  'dsp.compressor.ratio': 'Rapporto',
  'dsp.compressor.attack': 'Attacco',
  'dsp.compressor.release': 'Rilascio',
  'dsp.compressor.makeup': 'Compensazione',

  'dsp.maximizer.title': 'Maximizer',
  'dsp.maximizer.description':
    'Alza il livello generale senza lasciare che i picchi superino il tetto.',
  'dsp.maximizer.ceiling': 'Tetto',
  'dsp.maximizer.lookAhead': 'Anticipo',
  'dsp.maximizer.release': 'Rilascio',
  'dsp.maximizer.headroomHint':
    'Il tetto lascia spazio ai {gain} dB che il tuo profilo di uscita aggiunge dopo.',

  'tabs.dsp': 'DSP',
};

export default dsp;
