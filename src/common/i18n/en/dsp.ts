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
  'dsp.bypassed': 'Bypassed',
  'dsp.enabled': 'On',

  'dsp.eqPreset.custom': 'Custom',
  'dsp.eqPreset.label': 'Preset',
  'dsp.eqPreset.saved': 'Yours',
  'dsp.eqPresetGroup.basic': 'Basic',
  'dsp.eqPresetGroup.genre': 'Genre',
  'dsp.eqPresetGroup.voice': 'Voice',
  'dsp.eqPresetGroup.scene': 'Situation',
  'dsp.eqPresetGroup.device': 'Device',
  'dsp.eqPresetGroup.character': 'Character',
  'dsp.eqPresetGroup.repair': 'Repair',
  'dsp.eqPreset.default': 'Default',
  'dsp.eqPreset.reset': 'Reset',
  'dsp.eqPreset.previous': 'Previous preset',
  'dsp.eqPreset.next': 'Next preset',
  'dsp.eqPreset.flat': 'Flat',
  'dsp.eqPreset.vShape': 'V-shape',
  'dsp.eqPreset.rock': 'Rock',
  'dsp.eqPreset.pop': 'Pop',
  'dsp.eqPreset.jazz': 'Jazz',
  'dsp.eqPreset.classical': 'Classical',
  'dsp.eqPreset.electronic': 'Electronic',
  'dsp.eqPreset.hiphop': 'Hip-hop',
  'dsp.eqPreset.acoustic': 'Acoustic',
  'dsp.eqPreset.vocal': 'Vocal',
  'dsp.eqPreset.podcast': 'Podcast',
  'dsp.eqPreset.bassBoost': 'Bass boost',
  'dsp.eqPreset.trebleBoost': 'Treble boost',
  'dsp.eqPreset.loudness': 'Loudness',
  'dsp.eqPreset.lateNight': 'Late night',
  'dsp.eqPreset.smallSpeakers': 'Small speakers',
  'dsp.eqPreset.car': 'Car',
  'dsp.eqPreset.gaming': 'Gaming',
  'dsp.eqPreset.movie': 'Movie',
  'dsp.eqPreset.warm': 'Warm',
  'dsp.eqPreset.air': 'Air',
  'dsp.eqPreset.deEss': 'De-esser',
  'dsp.eqPreset.tameBoom': 'Tame boom',
  'dsp.eqPreset.tape': 'Tape',
  'dsp.eqPreset.vinyl': 'Vinyl',
  'dsp.eqPreset.liveVocal': 'Live vocal',
  'dsp.eqPreset.orchestra': 'Orchestra',
  'dsp.eqPreset.metal': 'Metal',
  'dsp.eqPreset.punk': 'Punk',
  'dsp.eqPreset.reggae': 'Reggae',
  'dsp.eqPreset.country': 'Country',
  'dsp.eqPreset.blues': 'Blues',
  'dsp.eqPreset.lofi': 'Lo-fi',
  'dsp.eqPreset.ambient': 'Ambient',
  'dsp.eqPreset.trap': 'Trap',
  'dsp.eqPreset.drumBass': 'Drum & bass',
  'dsp.eqPreset.piano': 'Piano',
  'dsp.eqPreset.strings': 'Strings',
  'dsp.eqPreset.sibilance': 'Sibilance',
  'dsp.eqPreset.mudCut': 'Mud cut',
  'dsp.eqPreset.harshTamer': 'Harsh tamer',
  'dsp.eqPreset.earbuds': 'Earbuds',
  'dsp.eqPreset.laptop': 'Laptop',
  'dsp.eqPreset.openBack': 'Open-back',
  'dsp.eqPreset.audiobook': 'Audiobook',
  'dsp.eqPreset.nightMovie': 'Night movie',

  'dsp.eqPreset.import': 'Import',
  'dsp.eqPreset.export': 'Export',
  'dsp.eqSave.title': 'Save preset',
  'dsp.eqSave.hint': 'Save the rack as it stands.',
  'dsp.eqSave.placeholder': 'Name',
  'dsp.eqSave.save': 'Save',
  'dsp.eqSave.delete': 'Delete',
  'dsp.eqSave.overwrite':
    'A preset with that name already exists and will be replaced.',
  'dsp.eqSave.saved': 'Saved as {name}.',
  'dsp.eqSave.deleted': 'Deleted {name}.',
  'dsp.eqSave.imported': 'Imported {name}.',
  'dsp.eqShare.share': 'Share',
  'dsp.eqShare.hint': 'Saves this rack as a file others can open.',
  'dsp.eqPreset.imported': 'Loaded {count} filters.',
  'dsp.eqPreset.importSkipped': 'Loaded {count} filters, {skipped} skipped.',
  'dsp.eqPreset.importEmpty': 'No filters this equaliser could read.',
  'dsp.eqPreset.importFailed': 'That file could not be read.',
  'dsp.eqPreset.importPreamp':
    'Its {gain} dB of headroom is measured here instead.',

  'dsp.eq.rack': 'Bands',
  'dsp.eqModel.label': 'Character',
  'dsp.eqModel.clean': 'None',
  'dsp.eqModel.proportional': 'Focused',
  'dsp.eqModel.wide': 'Broad',
  'dsp.eqEngine.label': 'Engine',
  'dsp.eqPhase.label': 'Phase',
  'dsp.eqPhase.minimum': 'Minimum',
  'dsp.eqPhase.linear': 'Linear',
  'dsp.eqPhase.linearLatency': 'Linear (+{ms} ms)',
  'dsp.eqEngine.serial': 'Serial',
  'dsp.eqEngine.parallel': 'Parallel',
  'dsp.eqStereo.label': 'Applies to',
  'dsp.eqStereo.stereo': 'Stereo',
  'dsp.eqStereo.mid': 'Mid only',
  'dsp.eqStereo.side': 'Sides only',
  'dsp.eqOversample.label': 'Oversampling',
  'dsp.eqOversample.off': 'Off',
  'dsp.eqOversample.on': '2x',
  'dsp.eqImport.title': 'Import an EQ curve',
  'dsp.eqImport.hint':
    'Paste a curve from Squiglink, AutoEq or Equalizer APO — or choose the file it is in.',
  'dsp.eqImport.placeholder':
    'Preamp: -5.4 dB\nFilter: ON PK Fc 1200 Hz Gain -2.1 dB Q 1.41',
  'dsp.eqImport.chooseFile': 'Choose file',
  'dsp.eqImport.apply': 'Import',
  'dsp.eqImport.cancel': 'Cancel',

  'dsp.eq.title': 'Equaliser',
  'dsp.eq.description':
    'Fifteen parametric bands, drawn as the filters actually respond rather than as they were asked to.',
  'dsp.eq.band': 'Band',
  'dsp.eq.bands': 'Bands',
  'dsp.eq.shape': 'Band shape',
  'dsp.eq.bandOff': 'Off',
  'dsp.eq.addLeft': 'Add a band below this one',
  'dsp.eq.addRight': 'Add a band above this one',
  'dsp.eq.type.peak': 'Peak',
  'dsp.eq.type.lowShelf': 'Low shelf',
  'dsp.eq.type.highShelf': 'High shelf',
  'dsp.eq.type.notch': 'Notch',
  'dsp.eq.type.lowPass': 'Low pass',
  'dsp.eq.type.highPass': 'High pass',
  'dsp.eq.type.bandPass': 'Band pass',
  'dsp.eq.frequency': 'Freq',
  'dsp.eq.gain': 'Gain',
  'dsp.eq.preamp': 'Preamp',
  'dsp.eq.trim': 'Auto trim',
  'dsp.eq.adaptive': 'Adaptive',
  'dsp.eq.trimFixed': 'Fixed',
  'dsp.eq.trimOff': 'No trim',
  'dsp.eq.adaptiveHint':
    'Measures the song and gives back the headroom it does not need. Off holds the level perfectly still.',
  'dsp.eq.trimHint':
    'Room made in front of the bands so this curve cannot clip.',
  'dsp.eq.overUnity': '{gain} dB over',
  'dsp.eq.character': 'Character',
  'dsp.eq.subsonic': 'Subsonic',
  'dsp.eq.fuzz': 'Fuzz',
  'dsp.eq.monoBelow': 'Mono below',
  'dsp.eq.phase': 'Phase',
  'dsp.eq.phaseOff': 'Off',
  'dsp.eq.phaseNeedle': 'Correlation',
  'dsp.eq.phaseScope': 'Goniometer',
  'dsp.eq.quality': 'Width',
  'dsp.eq.threshold': 'Threshold',
  'dsp.eq.legend.curve': 'Curve',
  'dsp.eq.legend.spectrum': 'Output',
  'dsp.eq.legend.atRest': 'At rest',
  'dsp.eq.legend.threshold': 'Threshold',
  'dsp.eq.legend.subsonic': 'Subsonic',
  'dsp.eq.legend.input': 'Input',
  'dsp.eq.inputMark': 'input {gain} dB',
  'dsp.eq.legend.gain': 'gain',
  'dsp.eq.legend.level': 'level per band',
  'dsp.eq.thresholdMark': 'threshold {level} dBFS',
  'dsp.eq.dynamic': 'Dynamic',
  'dsp.eq.dynamicOn': 'Dynamic ON',
  'dsp.eq.dynamicHint':
    'Acts only while this band is louder than its threshold.',

  'dsp.exciter.title': 'Exciter',
  'dsp.exciter.description':
    'Generates harmonics that were never in the signal. Three bands, each choosing even orders for body or odd for air — plus Organic, for the density an equaliser cannot add.',
  'dsp.exciter.drive': 'Drive',
  'dsp.exciter.mix': 'Amount',
  'dsp.exciter.band.low': 'Low',
  'dsp.exciter.band.mid': 'Mid',
  'dsp.exciter.band.high': 'High',
  'dsp.exciter.crossoverLow': 'Low split',
  'dsp.exciter.crossoverHigh': 'High split',
  'dsp.exciter.texture': 'Texture',
  'dsp.exciter.threshold': 'Threshold',
  'dsp.exciter.dynamic': 'Dynamic',
  'dsp.exciter.organic': 'Organic',
  'dsp.exciter.organicHint':
    'Body for a midrange that measures fine and sounds thin. Even harmonics that follow the music and drift as they go, so it breathes instead of sitting still.',
  'dsp.exciter.organicAmount': 'Body',
  'dsp.exciter.organicFocus': 'Focus',
  'dsp.exciter.organicRange': 'Range',
  'dsp.exciter.isolate': 'Isolate',
  'dsp.exciter.isolateHint': 'Hear only the harmonics this stage is adding.',
  'dsp.exciter.isolateOn':
    'Dry signal dropped — you are hearing only what this adds.',

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

  'tabs.dsp': 'DSP',
};

export default dsp;
