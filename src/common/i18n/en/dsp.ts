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

/**
 * The DSP chain: exciter, multiband compressor, maximizer.
 *
 * `dsp.scopeNotice` is the load-bearing string in this file. Every other pill
 * in the EQ group configures Equalizer APO and therefore all system audio;
 * this one processes only what FluidEQ itself plays. A user who assumes
 * otherwise reports the feature as broken, so the panel says it in visible
 * text rather than in a tooltip.
 */
const dsp = {
  'dsp.title': 'DSP',
  'dsp.scopeNotice':
    'Applies to music played inside FluidEQ. It does not change Spotify, YouTube or other apps.',
  'dsp.idle':
    'Starts when you play something from the Library. It processes the FluidEQ player itself, so there is nothing for it to do until a track is loaded.',
  'dsp.unavailable':
    'Audio processing could not start. Playback is unaffected.',
  'dsp.presets': 'Presets',
  'dsp.preset.flat': 'Off',
  'dsp.preset.lossyRepair': 'Repair compressed',
  'dsp.preset.loud': 'Loud',
  'dsp.enabled': 'On',

  'dsp.eq.title': 'Equaliser',
  'dsp.eq.description':
    'Fifteen parametric bands, drawn as the filters actually respond rather than as they were asked to.',
  'dsp.eq.band': 'Band',
  'dsp.eq.bands': 'Bands',
  'dsp.eq.shape': 'Band shape',
  'dsp.eq.bandOff': 'Off',
  'dsp.eq.type.peak': 'Peak',
  'dsp.eq.type.lowShelf': 'Low shelf',
  'dsp.eq.type.highShelf': 'High shelf',
  'dsp.eq.type.notch': 'Notch',
  'dsp.eq.type.lowPass': 'Low pass',
  'dsp.eq.type.highPass': 'High pass',
  'dsp.eq.type.bandPass': 'Band pass',
  'dsp.eq.frequency': 'Freq',
  'dsp.eq.gain': 'Gain',
  'dsp.eq.quality': 'Width',

  'dsp.exciter.title': 'Exciter',
  'dsp.exciter.description':
    'Generates high harmonics a lossy encoder discarded. It invents them; it does not recover them.',
  'dsp.exciter.crossover': 'Above',
  'dsp.exciter.drive': 'Drive',
  'dsp.exciter.mix': 'Amount',

  'dsp.compressor.title': 'Multiband compressor',
  'dsp.compressor.description':
    'Evens out the level in three frequency bands independently.',
  'dsp.compressor.band.low': 'Low',
  'dsp.compressor.band.mid': 'Mid',
  'dsp.compressor.band.high': 'High',
  'dsp.compressor.crossoverLow': 'Low / mid split',
  'dsp.compressor.crossoverHigh': 'Mid / high split',
  'dsp.compressor.threshold': 'Threshold',
  'dsp.compressor.ratio': 'Ratio',
  'dsp.compressor.attack': 'Attack',
  'dsp.compressor.release': 'Release',
  'dsp.compressor.makeup': 'Makeup',

  'dsp.maximizer.title': 'Maximizer',
  'dsp.maximizer.description':
    'Raises the overall level without letting peaks pass the ceiling.',
  'dsp.maximizer.ceiling': 'Ceiling',
  'dsp.maximizer.lookAhead': 'Look-ahead',
  'dsp.maximizer.release': 'Release',
  'dsp.maximizer.headroomHint':
    'The ceiling leaves room for the {gain} dB your output profile adds after this.',

  'tabs.dsp': 'DSP',
};

export default dsp;
