const files = {
  'files.title.sharePreset': 'Condividi preset EQ',
  'files.title.exportDspChain': 'Esporta preset di catena DSP',
  'files.title.importEq': 'Importa impostazioni EQ',
  'files.title.importImpulse': 'Importa una risposta all’impulso',
  'files.title.exportChain': 'Esporta questa catena',
  'files.title.importChain': 'Importa una catena',
  'files.title.exportKaraoke': 'Esporta karaoke',
  'files.title.saveDownload': 'Salva il download sul computer',
  'files.save': 'Salva',
  'files.type.eqPreset': 'Preset EQ di FluidEQ',
  'files.type.dspChain': 'Catena DSP di FluidEQ',
  'files.type.eqSettings': 'Impostazioni EQ',
  'files.type.impulse': 'Risposta all’impulso WAV',
  'files.type.chain': 'Catena di FluidEQ',
  'files.type.scene': 'Scena di FluidEQ',
  'files.type.programs': 'Programmi',
  'files.type.pictures': 'Immagini',
  'files.type.all': 'Tutti i file',
  'files.imported.profile': 'Importate {count} bande dal profilo FluidEQ.',
  'files.imported.graphicEq': 'Importate {count} bande dal file GraphicEQ.',
  'files.imported.parametricEq':
    'Importate {count} bande dal file ParametricEQ di Equalizer APO.',
  'files.imported.skipped':
    '{count} banda/e usava/no un tipo di filtro che FluidEQ non può modificare e sono state saltate.',
  'files.imported.squiglink':
    'Importate {count} bande dall’esportazione di Squiglink.',
  'files.imported.squiglinkSkipped':
    '{count} banda/e non si potevano modificare in FluidEQ e sono state saltate.',
  'files.imported.preampKept':
    'Il suo preamp di {gain} dB è stato mantenuto, quindi la normalizzazione automatica è disattivata.',
  'files.impulse.applied': '{name} applicato.',
  'files.chain.exported': 'Esportata la catena di {device}.',
  'files.chain.imported': 'Catena importata.',
  'files.chain.importedFrom': 'Importata la catena da {device}.',
  'files.chain.noOutput':
    'Nessuna uscita è attiva, quindi non c’è niente su cui importare.',
  'files.chain.notChain': 'Quel file non è una catena di FluidEQ.',
  'files.squiglink.empty':
    'Incolla un’esportazione EQ di Squiglink prima di importarla.',
  'files.squiglink.tooLarge':
    'Quell’esportazione EQ è troppo grande da importare.',
  'files.squiglink.noFilters':
    'Non sono stati trovati filtri di Equalizer APO. Copia il testo ParametricEQ o GraphicEQ esportato da Squiglink.',
  'files.eq.tooLarge':
    'Quel file è troppo grande per essere un’impostazione EQ.',
  'files.eq.notProfile': 'Quel file JSON non è un profilo FluidEQ.',
  'files.eq.noFilters':
    'In quel file non sono stati trovati filtri di Equalizer APO. Era atteso un profilo ParametricEQ, GraphicEQ o FluidEQ.',
  'files.wav.notWav': 'Quel file non è una risposta all’impulso WAV.',
  'files.wav.truncated': 'Quel file WAV è troncato.',
  'files.wav.unsupported': 'Equalizer APO non supporta quel formato WAV.',
  'files.wav.noFormat': 'Quel file WAV non ha un blocco di formato.',
  'files.wav.tooLarge':
    'Quella risposta all’impulso è troppo grande da importare in sicurezza.',
  'files.wav.rate':
    'Quella risposta all’impulso è a {rate} Hz. Equalizer APO ne richiede una tra {rates} Hz.',
  'files.wav.noChunks':
    'Quel file WAV non ha un blocco di formato o di dati utilizzabile.',
  'files.wav.sampleFormat':
    'Il formato dei campioni di quel WAV non si può analizzare in sicurezza.',
  'files.wav.noSamples':
    'Quella risposta all’impulso WAV non contiene campioni.',
  'files.wav.badSamples':
    'Quella risposta all’impulso WAV contiene campioni non validi.',
  'files.wav.silent':
    'Quella risposta all’impulso WAV non ha una risposta misurabile.',
  'files.apo.notLocated':
    'Equalizer APO non è installato oppure la sua installazione non è stata trovata.',
  'files.apo.selectorMissing':
    'Il configuratore dei dispositivi di Equalizer APO non è stato trovato.',
  'files.apo.editorMissing':
    'Le impostazioni di Equalizer APO non sono state trovate.',
  'files.wav.tooLong':
    'Quella risposta all’impulso è troppo lunga da analizzare per una normalizzazione sicura.',
} as const;

export default files;
