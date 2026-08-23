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
    'Gilt für Musik, die in FluidEQ abgespielt wird. Spotify, YouTube und andere Apps bleiben unverändert.',
  'dsp.idle':
    'Startet, sobald du etwas aus der Bibliothek abspielst. Es verarbeitet FluidEQs eigenen Player und hat daher nichts zu tun, bis ein Titel geladen ist.',
  'dsp.unavailable':
    'Die Audioverarbeitung konnte nicht gestartet werden. Die Wiedergabe ist davon nicht betroffen.',
  'dsp.presets': 'Voreinstellungen',
  'dsp.preset.flat': 'Aus',
  'dsp.preset.lossyRepair': 'Komprimiertes reparieren',
  'dsp.preset.loud': 'Laut',
  'dsp.bypassed': 'Umgangen',
  'dsp.enabled': 'Ein',

  'dsp.eqPreset.custom': 'Eigen',
  'dsp.eqPreset.label': 'Voreinstellung',
  'dsp.eqPreset.default': 'Standard',
  'dsp.eqPreset.reset': 'Zurücksetzen',
  'dsp.eqPreset.flat': 'Neutral',
  'dsp.eqPreset.vShape': 'V-Form',
  'dsp.eqPreset.rock': 'Rock',
  'dsp.eqPreset.pop': 'Pop',
  'dsp.eqPreset.jazz': 'Jazz',
  'dsp.eqPreset.classical': 'Klassik',
  'dsp.eqPreset.electronic': 'Elektronisch',
  'dsp.eqPreset.hiphop': 'Hip-Hop',
  'dsp.eqPreset.acoustic': 'Akustisch',
  'dsp.eqPreset.vocal': 'Stimme',
  'dsp.eqPreset.podcast': 'Podcast',
  'dsp.eqPreset.bassBoost': 'Bass-Anhebung',
  'dsp.eqPreset.trebleBoost': 'Höhen-Anhebung',
  'dsp.eqPreset.loudness': 'Loudness',
  'dsp.eqPreset.lateNight': 'Spät abends',
  'dsp.eqPreset.smallSpeakers': 'Kleine Lautsprecher',
  'dsp.eqPreset.car': 'Auto',
  'dsp.eqPreset.gaming': 'Gaming',
  'dsp.eqPreset.movie': 'Film',
  'dsp.eqPreset.warm': 'Warm',
  'dsp.eqPreset.air': 'Luft',

  'dsp.eqPreset.import': 'Importieren',
  'dsp.eqPreset.export': 'Exportieren',
  'dsp.eqPreset.imported': '{count} Filter geladen.',
  'dsp.eqPreset.importSkipped':
    '{count} Filter geladen, {skipped} übersprungen.',
  'dsp.eqPreset.importEmpty':
    'Dieser Equalizer konnte keine Filter darin lesen.',
  'dsp.eqPreset.importFailed': 'Diese Datei konnte nicht gelesen werden.',
  'dsp.eqPreset.importPreamp':
    'Seine {gain} dB Reserve werden hier stattdessen gemessen.',

  'dsp.eq.rack': 'Bänder',
  'dsp.eqModel.label': 'Charakter',
  'dsp.eqModel.clean': 'Keiner',
  'dsp.eqModel.proportional': 'Fokussiert',
  'dsp.eqModel.wide': 'Breit',
  'dsp.eqEngine.label': 'Engine',
  'dsp.eqPhase.label': 'Phase',
  'dsp.eqPhase.minimum': 'Minimal',
  'dsp.eqPhase.linear': 'Linear',
  'dsp.eqPhase.linearLatency': 'Linear (+{ms} ms)',
  'dsp.eqEngine.serial': 'Seriell',
  'dsp.eqEngine.parallel': 'Parallel',
  'dsp.eqStereo.label': 'Wirkt auf',
  'dsp.eqStereo.stereo': 'Stereo',
  'dsp.eqStereo.mid': 'Nur Mitte',
  'dsp.eqStereo.side': 'Nur Seiten',
  'dsp.eqOversample.label': 'Oversampling',
  'dsp.eqOversample.off': 'Aus',
  'dsp.eqOversample.on': '2x',
  'dsp.eqImport.title': 'EQ-Kurve importieren',
  'dsp.eqImport.hint':
    'Füge eine Kurve aus Squiglink, AutoEq oder Equalizer APO ein – oder wähle die Datei, in der sie steht.',
  'dsp.eqImport.placeholder':
    'Preamp: -5.4 dB\nFilter: ON PK Fc 1200 Hz Gain -2.1 dB Q 1.41',
  'dsp.eqImport.chooseFile': 'Datei wählen',
  'dsp.eqImport.apply': 'Importieren',
  'dsp.eqImport.cancel': 'Abbrechen',

  'dsp.eq.title': 'Equalizer',
  'dsp.eq.description':
    'Fünfzehn parametrische Bänder, gezeichnet wie die Filter tatsächlich reagieren und nicht wie sie angefordert wurden.',
  'dsp.eq.band': 'Band',
  'dsp.eq.bands': 'Bänder',
  'dsp.eq.shape': 'Bandform',
  'dsp.eq.bandOff': 'Aus',
  'dsp.eq.addLeft': 'Band unterhalb dieses einfügen',
  'dsp.eq.addRight': 'Band oberhalb dieses einfügen',
  'dsp.eq.type.peak': 'Glocke',
  'dsp.eq.type.lowShelf': 'Bassshelf',
  'dsp.eq.type.highShelf': 'Höhenshelf',
  'dsp.eq.type.notch': 'Kerbe',
  'dsp.eq.type.lowPass': 'Tiefpass',
  'dsp.eq.type.highPass': 'Hochpass',
  'dsp.eq.type.bandPass': 'Bandpass',
  'dsp.eq.frequency': 'Freq',
  'dsp.eq.gain': 'Pegel',
  'dsp.eq.preamp': 'Vorverst.',
  'dsp.eq.trim': 'Auto-Trim',
  'dsp.eq.adaptive': 'Adaptiv',
  'dsp.eq.trimFixed': 'Fest',
  'dsp.eq.adaptiveHint':
    'Misst den Song und gibt die nicht benötigte Reserve zurück. Aus hält den Pegel völlig konstant.',
  'dsp.eq.trimHint':
    'Reserve vor den Bändern, damit diese Kurve nicht übersteuert.',
  'dsp.eq.overUnity': '{gain} dB darüber',
  'dsp.eq.character': 'Charakter',
  'dsp.eq.subsonic': 'Subsonic',
  'dsp.eq.fuzz': 'Fuzz',
  'dsp.eq.monoBelow': 'Mono unter',
  'dsp.eq.phase': 'Phase',
  'dsp.eq.quality': 'Breite',
  'dsp.eq.threshold': 'Schwelle',
  'dsp.eq.legend.curve': 'Kurve',
  'dsp.eq.legend.spectrum': 'Ausgang',
  'dsp.eq.legend.atRest': 'In Ruhe',
  'dsp.eq.legend.threshold': 'Schwelle',
  'dsp.eq.legend.subsonic': 'Subsonic',
  'dsp.eq.legend.input': 'Eingang',
  'dsp.eq.inputMark': 'Eingang {gain} dB',
  'dsp.eq.legend.gain': 'Pegel',
  'dsp.eq.legend.level': 'Pegel pro Band',
  'dsp.eq.thresholdMark': 'Schwelle {level} dBFS',
  'dsp.eq.dynamic': 'Dynamisch',
  'dsp.eq.dynamicOn': 'Dynamisch AN',
  'dsp.eq.dynamicHint':
    'Greift nur, solange dieses Band lauter als seine Schwelle ist.',

  'dsp.exciter.title': 'Exciter',
  'dsp.exciter.description':
    'Erzeugt hohe Obertöne, die ein verlustbehafteter Encoder verworfen hat. Er erfindet sie, er stellt sie nicht wieder her.',
  'dsp.exciter.crossover': 'Oberhalb von',
  'dsp.exciter.drive': 'Intensität',
  'dsp.exciter.mix': 'Anteil',

  'dsp.compressor.title': 'Multiband-Kompressor',
  'dsp.compressor.description':
    'Gleicht den Pegel in drei Frequenzbändern unabhängig voneinander aus.',
  'dsp.compressor.band.low': 'Tiefen',
  'dsp.compressor.band.mid': 'Mitten',
  'dsp.compressor.band.high': 'Höhen',
  'dsp.compressor.crossoverLow': 'Trennung Tiefen / Mitten',
  'dsp.compressor.crossoverHigh': 'Trennung Mitten / Höhen',
  'dsp.compressor.threshold': 'Schwelle',
  'dsp.compressor.ratio': 'Verhältnis',
  'dsp.compressor.attack': 'Attack',
  'dsp.compressor.release': 'Release',
  'dsp.compressor.makeup': 'Ausgleich',

  'dsp.maximizer.title': 'Maximizer',
  'dsp.maximizer.description':
    'Hebt den Gesamtpegel an, ohne Spitzen über die Obergrenze zu lassen.',
  'dsp.maximizer.ceiling': 'Obergrenze',
  'dsp.maximizer.lookAhead': 'Vorausschau',
  'dsp.maximizer.release': 'Release',

  'tabs.dsp': 'DSP',
};

export default dsp;
