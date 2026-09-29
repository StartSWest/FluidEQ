const files = {
  'files.title.sharePreset': 'EQ-Preset teilen',
  'files.title.exportDspChain': 'DSP-Ketten-Preset exportieren',
  'files.title.importEq': 'EQ-Einstellungen importieren',
  'files.title.importImpulse': 'Impulsantwort importieren',
  'files.title.exportChain': 'Diese Kette exportieren',
  'files.title.importChain': 'Kette importieren',
  'files.title.exportKaraoke': 'Karaoke exportieren',
  'files.title.saveDownload': 'Download auf dem Computer speichern',
  'files.save': 'Speichern',
  'files.type.eqPreset': 'FluidEQ-EQ-Preset',
  'files.type.dspChain': 'FluidEQ-DSP-Kette',
  'files.type.eqSettings': 'EQ-Einstellungen',
  'files.type.impulse': 'WAV-Impulsantwort',
  'files.type.chain': 'FluidEQ-Kette',
  'files.type.scene': 'FluidEQ-Szene',
  'files.type.programs': 'Programme',
  'files.type.pictures': 'Bilder',
  'files.type.all': 'Alle Dateien',
  'files.imported.profile': '{count} Bänder aus dem FluidEQ-Profil importiert.',
  'files.imported.graphicEq':
    '{count} Bänder aus der GraphicEQ-Datei importiert.',
  'files.imported.parametricEq':
    '{count} Bänder aus der ParametricEQ-Datei von Equalizer APO importiert.',
  'files.imported.skipped':
    '{count} Band/Bänder nutzten einen Filtertyp, den FluidEQ nicht bearbeiten kann, und wurden übersprungen.',
  'files.imported.squiglink':
    '{count} Bänder aus dem Squiglink-Export importiert.',
  'files.imported.squiglinkSkipped':
    '{count} Band/Bänder ließen sich in FluidEQ nicht bearbeiten und wurden übersprungen.',
  'files.imported.preampKept':
    'Sein Preamp von {gain} dB wurde übernommen, daher ist Auto-Normalisierung aus.',
  'files.impulse.applied': '{name} angewendet.',
  'files.chain.exported': 'Die Kette für {device} wurde exportiert.',
  'files.chain.imported': 'Die Kette wurde importiert.',
  'files.chain.importedFrom': 'Die Kette von {device} wurde importiert.',
  'files.chain.noOutput':
    'Es ist kein Ausgang aktiv, daher gibt es nichts, worauf importiert werden könnte.',
  'files.chain.notChain': 'Diese Datei ist keine FluidEQ-Kette.',
  'files.squiglink.empty':
    'Fügen Sie einen EQ-Export von Squiglink ein, bevor Sie ihn importieren.',
  'files.squiglink.tooLarge': 'Dieser EQ-Export ist zu groß zum Importieren.',
  'files.squiglink.noFilters':
    'Es wurden keine Equalizer-APO-Filter gefunden. Kopieren Sie den exportierten ParametricEQ- oder GraphicEQ-Text aus Squiglink.',
  'files.eq.tooLarge': 'Diese Datei ist zu groß für eine EQ-Einstellung.',
  'files.eq.notProfile': 'Diese JSON-Datei ist kein FluidEQ-Profil.',
  'files.eq.noFilters':
    'In dieser Datei wurden keine Equalizer-APO-Filter gefunden. Erwartet wird ein ParametricEQ-, GraphicEQ- oder FluidEQ-Profil.',
  'files.wav.notWav': 'Diese Datei ist keine WAV-Impulsantwort.',
  'files.wav.truncated': 'Diese WAV-Datei ist unvollständig.',
  'files.wav.unsupported': 'Equalizer APO unterstützt dieses WAV-Format nicht.',
  'files.wav.noFormat': 'Diese WAV-Datei hat keinen Format-Abschnitt.',
  'files.wav.tooLarge':
    'Diese Impulsantwort ist zu groß, um sie sicher zu importieren.',
  'files.wav.rate':
    'Diese Impulsantwort hat {rate} Hz. Equalizer APO braucht eine dieser Raten: {rates} Hz.',
  'files.wav.noChunks':
    'Diese WAV-Datei hat keinen verwendbaren Format- oder Datenabschnitt.',
  'files.wav.sampleFormat':
    'Das Sample-Format dieser WAV-Datei kann nicht sicher analysiert werden.',
  'files.wav.noSamples': 'Diese WAV-Impulsantwort enthält keine Samples.',
  'files.wav.badSamples': 'Diese WAV-Impulsantwort enthält ungültige Samples.',
  'files.wav.silent':
    'Diese WAV-Impulsantwort hat keinen messbaren Frequenzgang.',
  'files.apo.notLocated':
    'Equalizer APO ist nicht installiert, oder seine Installation wurde nicht gefunden.',
  'files.apo.selectorMissing':
    'Der Gerätekonfigurator von Equalizer APO wurde nicht gefunden.',
  'files.apo.editorMissing':
    'Die Einstellungen von Equalizer APO wurden nicht gefunden.',
  'files.wav.tooLong':
    'Diese Impulsantwort ist zu lang, um sie für eine sichere Normalisierung zu analysieren.',
} as const;

export default files;
