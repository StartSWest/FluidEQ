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
  'dsp.preset.lossyRepair': 'Komprimiertes reparieren',
  'dsp.preset.loud': 'Laut',
  'dsp.preset.broadcast': 'Rundfunk',
  'dsp.bypassed': 'Umgangen',
  'dsp.enabled': 'Ein',

  'dsp.normalizer.title': 'Normalisierung',
  'dsp.normalizer.description':
    'Misst die komplette Quelle einmal und wendet vor Exciter und EQ eine feste, stereogekoppelte Verstärkung an. Kein Pumpen, kein beweglicher RMS-Folger.',
  'dsp.normalizer.mode': 'Normalisierungsmodus',
  'dsp.normalizer.off': 'Aus',
  'dsp.normalizer.truePeak': 'True Peak',
  'dsp.normalizer.loudness': 'Lautheit',
  'dsp.normalizer.ceiling': 'Peak-Grenze',
  'dsp.normalizer.target': 'Lautheitsziel',
  'dsp.normalizer.analysis': 'Quellenanalyse',
  'dsp.normalizer.analyzing': 'Kompletter Titel wird analysiert · {progress}%',
  'dsp.normalizer.unavailable':
    'Diese Quelle konnte nicht analysiert werden. Sie wird mit Originalpegel abgespielt.',
  'dsp.normalizer.waiting':
    'Einen Bibliothekstitel abspielen, um ihn zu messen.',
  'dsp.normalizer.measuredPeak': 'Gemessener Peak',
  'dsp.normalizer.measuredLoudness': 'Integrierte Lautheit',
  'dsp.normalizer.appliedGain': 'Angewandte Verstärkung',
  'dsp.normalizer.limitedByCeiling':
    '{{requested}} nötig — durch Peak-Limit begrenzt',
  'dsp.normalizer.limitedByMaxGain':
    '{{requested}} nötig — maximale Anhebung erreicht',
  'dsp.normalizer.limitedByMinGain':
    '{{requested}} nötig — maximale Absenkung erreicht',
  'dsp.normalizer.limitedByGate':
    'Zu leise zum Messen — keine Verstärkung angewendet',
  'dsp.normalizer.liveMeter': 'Live vorher / nachher',
  'dsp.normalizer.before': 'Vorher',
  'dsp.normalizer.after': 'Nachher',
  'dsp.normalizer.liveMeterHint':
    'Tatsächliche Sample-Peaks direkt vor und nach der Normalisierung. Die Nullmarke entspricht 0 dBFS.',
  'dsp.normalizer.honesty':
    'Verhindert nachfolgende Übersteuerung; bereits in der Datei enthaltene Verzerrung kann nicht rekonstruiert werden.',

  'dsp.crossfade.title': 'Überblendung',
  'dsp.crossfade.description':
    'Überblendet ausgehende und eingehende Titel nach der Normalisierung und vor Exciter und EQ.',
  'dsp.crossfade.outgoing': 'Ausgehend',
  'dsp.crossfade.incoming': 'Eingehend',
  'dsp.crossfade.duration': 'Dauer',
  'dsp.crossfade.curve': 'Überblendkurve',
  'dsp.crossfade.equalPower': 'Gleiche Leistung',
  'dsp.crossfade.smooth': 'Weich',
  'dsp.crossfade.linear': 'Linear',
  'dsp.crossfade.custom': 'Benutzerdefiniert',
  'dsp.crossfade.saveCurve': 'Kurve speichern',
  'dsp.crossfade.resetCurve': 'Form zurücksetzen',
  'dsp.crossfade.deleteCurve': 'Kurve löschen',
  'dsp.crossfade.saveTitle': 'Überblendkurve speichern',
  'dsp.crossfade.saveHint':
    'Die gezogene Form wird unter diesem Namen gespeichert.',
  'dsp.crossfade.savePlaceholder': 'Kurvenname',
  'dsp.crossfade.handleOutgoing': 'Griffpunkt der ausgehenden Kurve',
  'dsp.crossfade.handleIncoming': 'Griffpunkt der eingehenden Kurve',
  'dsp.crossfade.sum': 'Kombinierter Pegel',
  'dsp.crossfade.hint':
    'Gilt für manuelles Weiter und natürliche Titelenden. Suchen bleibt sofort.',

  'dsp.eqPreset.custom': 'Eigen',
  'dsp.eqPreset.label': 'Voreinstellung',
  'dsp.eqPreset.saved': 'Eigene',
  'dsp.eqPresetGroup.basic': 'Basis',
  'dsp.eqPresetGroup.genre': 'Genre',
  'dsp.eqPresetGroup.voice': 'Stimme',
  'dsp.eqPresetGroup.scene': 'Situation',
  'dsp.eqPresetGroup.device': 'Gerät',
  'dsp.eqPresetGroup.character': 'Klangfarbe',
  'dsp.eqPresetGroup.repair': 'Korrektur',
  'dsp.eqPreset.default': 'Standard',
  'dsp.eqPreset.reset': 'Zurücksetzen',
  'dsp.eqPreset.previous': 'Vorheriges Preset',
  'dsp.eqPreset.next': 'Nächstes Preset',
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
  'dsp.eqPreset.deEss': 'De-Esser',
  'dsp.eqPreset.tameBoom': 'Dröhnen zähmen',
  'dsp.eqPreset.tape': 'Tape',
  'dsp.eqPreset.vinyl': 'Vinyl',
  'dsp.eqPreset.liveVocal': 'Live-Stimme',
  'dsp.eqPreset.orchestra': 'Orchester',
  'dsp.eqPreset.metal': 'Metal',
  'dsp.eqPreset.punk': 'Punk',
  'dsp.eqPreset.reggae': 'Reggae',
  'dsp.eqPreset.country': 'Country',
  'dsp.eqPreset.blues': 'Blues',
  'dsp.eqPreset.lofi': 'Lo-Fi',
  'dsp.eqPreset.ambient': 'Ambient',
  'dsp.eqPreset.trap': 'Trap',
  'dsp.eqPreset.drumBass': 'Drum & Bass',
  'dsp.eqPreset.piano': 'Klavier',
  'dsp.eqPreset.strings': 'Streicher',
  'dsp.eqPreset.sibilance': 'Zischlaute',
  'dsp.eqPreset.mudCut': 'Matsch weg',
  'dsp.eqPreset.harshTamer': 'Härte zähmen',
  'dsp.eqPreset.earbuds': 'In-Ears',
  'dsp.eqPreset.laptop': 'Laptop',
  'dsp.eqPreset.openBack': 'Offene Kopfhörer',
  'dsp.eqPreset.audiobook': 'Hörbuch',
  'dsp.eqPreset.nightMovie': 'Film bei Nacht',

  'dsp.eqPreset.import': 'Importieren',
  'dsp.eqPreset.export': 'Exportieren',
  'dsp.eqSave.title': 'Preset speichern',
  'dsp.eqSave.hint': 'Speichert das Rack, wie es ist.',
  'dsp.eqSave.placeholder': 'Name',
  'dsp.eqSave.save': 'Speichern',
  'dsp.eqSave.delete': 'Löschen',
  'dsp.eqSave.overwrite':
    'Ein Preset mit diesem Namen existiert bereits und wird ersetzt.',
  'dsp.eqSave.saved': 'Als {name} gespeichert.',
  'dsp.eqSave.deleted': '{name} gelöscht.',
  'dsp.eqSave.imported': '{name} importiert.',
  'dsp.eqShare.share': 'Teilen',
  'dsp.eqShare.hint':
    'Speichert dieses Rack als Datei, die andere öffnen können.',
  'dsp.eqShare.saved': 'Preset-Datei gespeichert.',
  'dsp.eqShare.failed': 'Die Preset-Datei konnte nicht gespeichert werden.',
  'dsp.eq.isolate': 'Isolieren',
  'dsp.eq.isolateHint': 'Nur hören, was der EQ verändert.',
  'dsp.eq.isolateOn':
    'Das trockene Signal ist entfernt — nur die Änderungen des EQ sind hörbar.',
  'dsp.eqPreset.imported': '{count} Filter geladen.',
  'dsp.eqPreset.importSkipped':
    '{count} Filter geladen, {skipped} übersprungen.',
  'dsp.eqPreset.importEmpty':
    'Dieser Equalizer konnte keine Filter darin lesen.',
  'dsp.eqPreset.importFailed': 'Diese Datei konnte nicht gelesen werden.',
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
  'dsp.eqImport.placeholder': 'Filter: ON PK Fc 1200 Hz Gain -2.1 dB Q 1.41',
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
  'dsp.eq.trim': 'Auto-Trim',
  'dsp.eq.adaptive': 'Adaptiv',
  'dsp.eq.trimFixed': 'Fest',
  'dsp.eq.trimOff': 'Kein Trim',
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
  'dsp.eq.phaseOff': 'Aus',
  'dsp.eq.phaseNeedle': 'Korrelation',
  'dsp.eq.phaseScope': 'Goniometer',
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
    'Erzeugt Obertöne, die nie im Signal waren. Drei Bänder, jedes mit geraden Ordnungen für Fülle oder ungeraden für Luft — dazu Organisch, für die Dichte, die ein Equalizer nicht liefern kann.',
  'dsp.exciter.bandFreq': 'Freq.',
  'dsp.exciter.bandRange': 'Umfang',
  'dsp.exciter.drive': 'Intensität',
  'dsp.exciter.mix': 'Anteil',
  'dsp.exciter.band.low': 'Tiefen',
  'dsp.exciter.band.mid': 'Mitten',
  'dsp.exciter.band.high': 'Höhen',
  'dsp.exciter.texture': 'Textur',
  'dsp.exciter.organic': 'Organisch',
  'dsp.exciter.organicHint':
    'Fügt im gewählten Bereich weiche Fülle aus geraden Obertönen hinzu. Ideal, um eine saubere, metallische Wiedergabe oder Titantreiber wärmer und organischer wirken zu lassen, ohne Details zu verlieren.',
  'dsp.exciter.organicAmount': 'Fülle',
  'dsp.exciter.organicFocus': 'Fokus',
  'dsp.exciter.organicRange': 'Umfang',
  'dsp.exciter.align': 'Timing',
  'dsp.exciter.alignHint':
    'Lässt Höhen vorangehen und verzögert Mitten und Bässe sanft für klare Attacken und runden Druck. Fügt keine Obertöne hinzu.',
  'dsp.exciter.alignAmount': 'Stärke',
  'dsp.exciter.isolate': 'Isolieren',
  'dsp.exciter.isolateHint':
    'Nur die Obertöne hören, die diese Stufe hinzufügt.',
  'dsp.exciter.isolateOn':
    'Direktsignal aus — Sie hören nur, was hier hinzukommt.',

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

  'dsp.master.title': 'Master',
  'dsp.master.description':
    'Transparente Ausgangskontrolle nach allen Prozessoren. Sie verändert nicht, wie stark EQ, Exciter oder andere Stufen angesteuert werden.',
  'dsp.master.outputTrim': 'Ausgangsverstärkung',
  'dsp.master.autoHeadroom': 'Auto-Headroom',
  'dsp.master.autoHeadroomHint':
    'Reduziert nur Spitzen nahe der gewählten stereo-gekoppelten True-Peak-Grenze weich.',
  'dsp.master.ceiling': 'Obergrenze',
  'dsp.master.release': 'Release',
  'dsp.master.loudnessMaximize': 'LUFS maximieren',
  'dsp.master.loudnessMaximizeHint':
    'Wendet anhand der Messung des ganzen Titels {gain} dB an und hält den finalen True Peak unter der Grenze. Die Verstärkung bleibt konstant; nur Peaks werden geregelt.',
  'dsp.master.loudnessTarget': 'Lautheitsziel',
  'dsp.master.meter': 'Endausgang',
  'dsp.master.safetyHint':
    '{factor}× True-Peak-Erkennung · {ceiling} dBTP Obergrenze · {knee} dB Soft Knee · stereo-gekoppelt.',
  'dsp.master.manualHint':
    'Manueller Ausgang: keine Spitzenabsenkung. Pegel über 0 dBFS übersteuern.',
  'dsp.master.truePeak': 'TP Eingang',
  'dsp.master.gainReduction': 'Pegelreduktion',
  'dsp.master.engineFallback':
    'Die Audio-Engine konnte nicht starten, daher läuft deine Musik unbearbeitet – ohne EQ, ohne Dynamik und ohne Limiter. Ein Neustart von FluidEQ hilft meist.',
  'dsp.master.devSafety': 'Sicherheit A/B',
  'dsp.master.devSafetyHint':
    'Nur Entwicklung: Umgeht den vollständigen Endschutz, damit seine Wirkung direkt hörbar wird.',
  'dsp.master.devSafetySpec':
    'Notfallschutz über +10 dBTP · 2 ms Vorausschau · Korrektur ohne Erholung · 3 Hz DC-Schutz · Reparatur ungültiger Samples',
  'dsp.master.dcCorrection': 'DC-Offset',
  'dsp.master.faults': 'Fehler',
  'dsp.master.graph.spectrum': 'Ausgangsspektrum',
  'dsp.master.graph.trim': 'Ausgangsverstärkung',
  'dsp.master.graph.applied': 'Angewandter Pegel',
  'dsp.master.graph.trimLine': 'Verstärkung {gain} dB',
  'dsp.master.graph.appliedLine': 'Angewendet {gain} dB',
  'dsp.master.graph.dcGuard': 'DC-Schutz',
  'dsp.master.graph.peakWarning':
    'Warnung · Ausgang {peak} dBTP über der Grenze',
  'dsp.master.graph.peakFixed':
    'Spitze kontrolliert · {gain} dB Pegelreduktion',
  'dsp.master.graph.peakSafe': 'True Peak innerhalb der Grenze',
  'dsp.master.graph.dcFixed': 'DC-Offset entfernt · {amount}',
  'dsp.master.graph.dcClean': 'DC-Offset sauber',
  'dsp.master.graph.faultFixed':
    '{count} ungültige oder fehlerhafte Samples repariert',
  'dsp.master.graph.faultClean': 'Samples gültig',
  'dsp.master.graph.safetyActive': 'Schutz aktiv',
  'dsp.master.graph.safetyBypassed': 'Warnung · Schutz umgangen',
  'dsp.master.graph.loudnessActive':
    'LUFS maximieren · +{gain} dB Richtung {target} LUFS',

  'tabs.dsp': 'DSP',
};

export default dsp;
