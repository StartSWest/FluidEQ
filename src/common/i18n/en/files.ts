/**
 * What the main process says around files: its dialogs' titles and type
 * lists, what an import or export did, and why an import was refused. Main
 * says it in the window's language (`mainText`).
 */
const files = {
  'files.title.sharePreset': 'Share EQ preset',
  'files.title.exportDspChain': 'Export DSP chain preset',
  'files.title.importEq': 'Import EQ settings',
  'files.title.importImpulse': 'Import an impulse response',
  'files.title.exportChain': 'Export this chain',
  'files.title.importChain': 'Import a chain',
  'files.title.exportKaraoke': 'Export karaoke',
  'files.title.saveDownload': 'Save download to your computer',
  'files.save': 'Save',
  'files.type.eqPreset': 'FluidEQ EQ preset',
  'files.type.dspChain': 'FluidEQ DSP chain',
  'files.type.eqSettings': 'EQ settings',
  'files.type.impulse': 'WAV impulse response',
  'files.type.chain': 'FluidEQ chain',
  'files.type.scene': 'FluidEQ scene',
  'files.type.programs': 'Programs',
  'files.type.pictures': 'Pictures',
  'files.type.all': 'All files',
  'files.imported.profile': 'Imported {count} bands from the FluidEQ profile.',
  'files.imported.graphicEq': 'Imported {count} bands from the GraphicEQ file.',
  'files.imported.parametricEq':
    'Imported {count} bands from the Equalizer APO ParametricEQ file.',
  'files.imported.skipped':
    '{count} band(s) used a filter type FluidEQ cannot edit and were skipped.',
  'files.imported.squiglink':
    'Imported {count} bands from the Squiglink export.',
  'files.imported.squiglinkSkipped':
    '{count} band(s) could not be edited in FluidEQ and were skipped.',
  'files.imported.preampKept':
    'Its {gain} dB preamp was kept, so Auto normalize is off.',
  'files.impulse.applied': 'Applied {name}.',
  'files.chain.exported': 'Exported the chain for {device}.',
  'files.chain.imported': 'Imported the chain.',
  'files.chain.importedFrom': 'Imported the chain from {device}.',
  'files.chain.noOutput':
    'No output is active, so there is nothing to import onto.',
  'files.chain.notChain': 'That file is not a FluidEQ chain.',
  'files.squiglink.empty': 'Paste a Squiglink EQ export before importing it.',
  'files.squiglink.tooLarge': 'That EQ export is too large to import.',
  'files.squiglink.noFilters':
    'No Equalizer APO filters were found. Copy the exported ParametricEQ or GraphicEQ text from Squiglink.',
  'files.eq.tooLarge': 'That file is too large to be an EQ setting.',
  'files.eq.notProfile': 'That JSON file is not a FluidEQ profile.',
  'files.eq.noFilters':
    'No Equalizer APO filters were found in that file. Expected a ParametricEQ, GraphicEQ or FluidEQ profile.',
  'files.wav.notWav': 'That file is not a WAV impulse response.',
  'files.wav.truncated': 'That WAV file is truncated.',
  'files.wav.unsupported': 'That WAV format is not supported by Equalizer APO.',
  'files.wav.noFormat': 'That WAV file has no format chunk.',
  'files.wav.tooLarge': 'That impulse response is too large to import safely.',
  'files.wav.rate':
    'That impulse response is {rate} Hz. Equalizer APO needs one of {rates} Hz.',
  'files.wav.noChunks': 'That WAV file has no usable format or data chunk.',
  'files.wav.sampleFormat': 'That WAV sample format cannot be analyzed safely.',
  'files.wav.noSamples': 'That WAV impulse response contains no samples.',
  'files.wav.badSamples': 'That WAV impulse response contains invalid samples.',
  'files.wav.silent': 'That WAV impulse response has no measurable response.',
  'files.apo.notLocated':
    'Equalizer APO is not installed or its installation could not be located.',
  'files.apo.selectorMissing':
    'Equalizer APO device configurator was not found.',
  'files.apo.editorMissing': 'Equalizer APO settings were not found.',
  'files.wav.tooLong':
    'That impulse response is too long to analyze for safe normalization.',
} as const;

export default files;
