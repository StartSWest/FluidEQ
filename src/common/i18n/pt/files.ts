const files = {
  'files.title.sharePreset': 'Compartilhar preset de EQ',
  'files.title.exportDspChain': 'Exportar preset de cadeia DSP',
  'files.title.importEq': 'Importar configurações de EQ',
  'files.title.importImpulse': 'Importar uma resposta ao impulso',
  'files.title.exportChain': 'Exportar esta cadeia',
  'files.title.importChain': 'Importar uma cadeia',
  'files.title.exportKaraoke': 'Exportar karaokê',
  'files.title.saveDownload': 'Salvar o download no computador',
  'files.save': 'Salvar',
  'files.type.eqPreset': 'Preset de EQ do FluidEQ',
  'files.type.dspChain': 'Cadeia DSP do FluidEQ',
  'files.type.eqSettings': 'Configurações de EQ',
  'files.type.impulse': 'Resposta ao impulso WAV',
  'files.type.chain': 'Cadeia do FluidEQ',
  'files.type.scene': 'Cena do FluidEQ',
  'files.type.programs': 'Programas',
  'files.type.pictures': 'Imagens',
  'files.type.all': 'Todos os arquivos',
  'files.imported.profile': '{count} bandas importadas do perfil do FluidEQ.',
  'files.imported.graphicEq': '{count} bandas importadas do arquivo GraphicEQ.',
  'files.imported.parametricEq':
    '{count} bandas importadas do arquivo ParametricEQ do Equalizer APO.',
  'files.imported.skipped':
    '{count} banda(s) usavam um tipo de filtro que o FluidEQ não consegue editar e foram ignoradas.',
  'files.imported.squiglink':
    '{count} bandas importadas da exportação do Squiglink.',
  'files.imported.squiglinkSkipped':
    '{count} banda(s) não podiam ser editadas no FluidEQ e foram ignoradas.',
  'files.imported.preampKept':
    'O pré-amplificador de {gain} dB foi mantido, então a normalização automática está desligada.',
  'files.impulse.applied': '{name} aplicado.',
  'files.chain.exported': 'A cadeia de {device} foi exportada.',
  'files.chain.imported': 'A cadeia foi importada.',
  'files.chain.importedFrom': 'A cadeia de {device} foi importada.',
  'files.chain.noOutput':
    'Nenhuma saída está ativa, então não há onde importar.',
  'files.chain.notChain': 'Esse arquivo não é uma cadeia do FluidEQ.',
  'files.squiglink.empty':
    'Cole uma exportação de EQ do Squiglink antes de importar.',
  'files.squiglink.tooLarge':
    'Essa exportação de EQ é grande demais para importar.',
  'files.squiglink.noFilters':
    'Nenhum filtro do Equalizer APO foi encontrado. Copie o texto ParametricEQ ou GraphicEQ exportado do Squiglink.',
  'files.eq.tooLarge':
    'Esse arquivo é grande demais para ser uma configuração de EQ.',
  'files.eq.notProfile': 'Esse arquivo JSON não é um perfil do FluidEQ.',
  'files.eq.noFilters':
    'Nenhum filtro do Equalizer APO foi encontrado nesse arquivo. Era esperado um perfil ParametricEQ, GraphicEQ ou do FluidEQ.',
  'files.wav.notWav': 'Esse arquivo não é uma resposta ao impulso WAV.',
  'files.wav.truncated': 'Esse arquivo WAV está truncado.',
  'files.wav.unsupported': 'O Equalizer APO não aceita esse formato WAV.',
  'files.wav.noFormat': 'Esse arquivo WAV não tem bloco de formato.',
  'files.wav.tooLarge':
    'Essa resposta ao impulso é grande demais para importar com segurança.',
  'files.wav.rate':
    'Essa resposta ao impulso é de {rate} Hz. O Equalizer APO precisa de uma destas: {rates} Hz.',
  'files.wav.noChunks':
    'Esse arquivo WAV não tem um bloco de formato ou de dados utilizável.',
  'files.wav.sampleFormat':
    'O formato de amostras desse WAV não pode ser analisado com segurança.',
  'files.wav.noSamples': 'Essa resposta ao impulso WAV não tem amostras.',
  'files.wav.badSamples':
    'Essa resposta ao impulso WAV contém amostras inválidas.',
  'files.wav.silent':
    'Essa resposta ao impulso WAV não tem resposta mensurável.',
  'files.apo.notLocated':
    'O Equalizer APO não está instalado ou a instalação não foi encontrada.',
  'files.apo.selectorMissing':
    'O configurador de dispositivos do Equalizer APO não foi encontrado.',
  'files.apo.editorMissing':
    'As configurações do Equalizer APO não foram encontradas.',
  'files.wav.tooLong':
    'Essa resposta ao impulso é longa demais para ser analisada com uma normalização segura.',
} as const;

export default files;
