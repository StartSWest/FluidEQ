const files = {
  'files.title.sharePreset': 'Partager le préréglage d’égalisation',
  'files.title.exportDspChain': 'Exporter le préréglage de chaîne DSP',
  'files.title.importEq': 'Importer des réglages d’égalisation',
  'files.title.importImpulse': 'Importer une réponse impulsionnelle',
  'files.title.exportChain': 'Exporter cette chaîne',
  'files.title.importChain': 'Importer une chaîne',
  'files.title.exportKaraoke': 'Exporter le karaoké',
  'files.title.saveDownload':
    'Enregistrer le téléchargement sur votre ordinateur',
  'files.save': 'Enregistrer',
  'files.type.eqPreset': 'Préréglage d’égalisation FluidEQ',
  'files.type.dspChain': 'Chaîne DSP FluidEQ',
  'files.type.eqSettings': 'Réglages d’égalisation',
  'files.type.impulse': 'Réponse impulsionnelle WAV',
  'files.type.chain': 'Chaîne FluidEQ',
  'files.type.scene': 'Scène FluidEQ',
  'files.type.programs': 'Programmes',
  'files.type.pictures': 'Images',
  'files.type.all': 'Tous les fichiers',
  'files.imported.profile':
    '{count} bandes importées depuis le profil FluidEQ.',
  'files.imported.graphicEq':
    '{count} bandes importées depuis le fichier GraphicEQ.',
  'files.imported.parametricEq':
    '{count} bandes importées depuis le fichier ParametricEQ d’Equalizer APO.',
  'files.imported.skipped':
    '{count} bande(s) utilisaient un type de filtre que FluidEQ ne peut pas modifier et ont été ignorées.',
  'files.imported.squiglink':
    '{count} bandes importées depuis l’export Squiglink.',
  'files.imported.squiglinkSkipped':
    '{count} bande(s) ne pouvaient pas être modifiées dans FluidEQ et ont été ignorées.',
  'files.imported.preampKept':
    'Son préampli de {gain} dB a été conservé, la normalisation automatique est donc désactivée.',
  'files.impulse.applied': '{name} appliqué.',
  'files.chain.exported': 'La chaîne de {device} a été exportée.',
  'files.chain.imported': 'La chaîne a été importée.',
  'files.chain.importedFrom': 'La chaîne de {device} a été importée.',
  'files.chain.noOutput':
    'Aucune sortie n’est active : il n’y a rien sur quoi importer.',
  'files.chain.notChain': 'Ce fichier n’est pas une chaîne FluidEQ.',
  'files.squiglink.empty':
    'Collez un export d’égalisation Squiglink avant de l’importer.',
  'files.squiglink.tooLarge':
    'Cet export d’égalisation est trop volumineux pour être importé.',
  'files.squiglink.noFilters':
    'Aucun filtre Equalizer APO n’a été trouvé. Copiez le texte ParametricEQ ou GraphicEQ exporté depuis Squiglink.',
  'files.eq.tooLarge':
    'Ce fichier est trop volumineux pour être un réglage d’égalisation.',
  'files.eq.notProfile': 'Ce fichier JSON n’est pas un profil FluidEQ.',
  'files.eq.noFilters':
    'Aucun filtre Equalizer APO n’a été trouvé dans ce fichier. Un profil ParametricEQ, GraphicEQ ou FluidEQ était attendu.',
  'files.wav.notWav': 'Ce fichier n’est pas une réponse impulsionnelle WAV.',
  'files.wav.truncated': 'Ce fichier WAV est tronqué.',
  'files.wav.unsupported':
    'Equalizer APO ne prend pas en charge ce format WAV.',
  'files.wav.noFormat': 'Ce fichier WAV n’a pas de bloc de format.',
  'files.wav.tooLarge':
    'Cette réponse impulsionnelle est trop volumineuse pour être importée en toute sécurité.',
  'files.wav.rate':
    'Cette réponse impulsionnelle est à {rate} Hz. Equalizer APO a besoin de l’une de ces fréquences : {rates} Hz.',
  'files.wav.noChunks':
    'Ce fichier WAV n’a pas de bloc de format ou de données exploitable.',
  'files.wav.sampleFormat':
    'Le format d’échantillons de ce WAV ne peut pas être analysé en toute sécurité.',
  'files.wav.noSamples':
    'Cette réponse impulsionnelle WAV ne contient aucun échantillon.',
  'files.wav.badSamples':
    'Cette réponse impulsionnelle WAV contient des échantillons non valides.',
  'files.wav.silent':
    'Cette réponse impulsionnelle WAV n’a pas de réponse mesurable.',
  'files.apo.notLocated':
    'Equalizer APO n’est pas installé, ou son installation est introuvable.',
  'files.apo.selectorMissing':
    'Le configurateur d’appareils d’Equalizer APO est introuvable.',
  'files.apo.editorMissing': 'Les réglages d’Equalizer APO sont introuvables.',
  'files.wav.tooLong':
    'Cette réponse impulsionnelle est trop longue pour être analysée en vue d’une normalisation sûre.',
} as const;

export default files;
