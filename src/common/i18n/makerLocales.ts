/* FluidEQ Karaoke Maker translations. GPL-3.0-or-later. */

import { Dictionary } from './en';

type MakerDictionary = Partial<Dictionary>;

export const makerPt: MakerDictionary = {
  'karaoke.maker.open': 'Criar',
  'karaoke.maker.openTitle': 'Criar ou editar este karaokê',
  'karaoke.maker.dialog': 'Criador de karaokê',
  'karaoke.maker.eyebrow': 'CRIADOR DE KARAOKÊ FLUIDEQ',
  'karaoke.maker.close': 'Fechar criador',
  'karaoke.maker.songTitle': 'Título da música',
  'karaoke.maker.untitled': 'Karaokê sem título',
  'karaoke.maker.undo': 'Desfazer',
  'karaoke.maker.redo': 'Refazer',
  'karaoke.maker.preview': 'Prévia · 1, 2, 3',
  'karaoke.maker.apply': 'Usar no reprodutor',
  'karaoke.maker.lyrics': 'Letra',
  'karaoke.maker.toolsEdit': 'Ferramentas de edição',
  'karaoke.maker.toolsAnalysis': 'Ferramentas de análise',
  'karaoke.maker.lyricsTiming': 'Tempo da letra',
  'karaoke.maker.timingAll': 'Música inteira',
  'karaoke.maker.timingFromWord': 'Da palavra selecionada',
  'karaoke.maker.timingAllHint':
    'Move juntas todas as palavras e notas sincronizadas.',
  'karaoke.maker.timingFromWordHint':
    'Move “{word}” e tudo depois dela. O trecho anterior fica fixo.',
  'karaoke.maker.earlier': 'Mover toda a letra para antes',
  'karaoke.maker.later': 'Mover toda a letra para depois',
  'karaoke.maker.openProject': 'Importar karaokê',
  'karaoke.maker.projectLoaded':
    'Projeto carregado. O áudio atual permanece anexado.',
  'karaoke.maker.karaokeImported':
    'Sincronização importada. O áudio atual permanece anexado.',
  'karaoke.maker.tapWords': 'Marcar palavras',
  'karaoke.maker.addNote': 'Nota',
  'karaoke.maker.hearNote': 'Ouvir nota',
  'karaoke.maker.split': 'Dividir',
  'karaoke.maker.delete': 'Excluir',
  'karaoke.maker.analyze': 'Analisar melodia',
  'karaoke.maker.prepare': 'Preparar karaokê',
  'karaoke.maker.advanced': 'Avançado',
  'karaoke.maker.prepared':
    'Este karaokê já tem notas de melodia sincronizadas.',
  'karaoke.maker.autoAlign': 'Alinhar automaticamente',
  'karaoke.maker.aiMelody': 'Melodia por IA',
  'karaoke.maker.transcribe': 'Transcrever',
  'karaoke.maker.vocalStem': 'Usar faixa vocal',
  'karaoke.maker.vocalStemLoaded': 'Faixa vocal carregada',
  'karaoke.maker.vocalFocus': 'Foco vocal central',
  'karaoke.maker.export': 'Exportar',
  'karaoke.maker.exportProject': 'Projeto FluidEQ',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': 'LRC aprimorado',
  'karaoke.maker.tapHint':
    'Pressione ESPAÇO ou ENTER para “{word}” · Backspace desfaz',
  'karaoke.maker.editHint':
    'Arraste notas para mudar tom/tempo. Arraste as bordas para redimensionar. Ctrl + roda amplia.',
  'karaoke.maker.stats':
    '{notes} notas · {words} palavras · {checks} verificações',
  'karaoke.maker.artist': 'Artista',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': 'Zoom',
  'karaoke.maker.songPosition': 'Posição na música',
  'karaoke.maker.previousView': 'Seção anterior',
  'karaoke.maker.nextView': 'Próxima seção',
  'karaoke.maker.livePreview': 'Prévia ao vivo',
  'karaoke.maker.showPreview': 'Mostrar prévia',
  'karaoke.maker.hidePreview': 'Ocultar prévia',
  'karaoke.maker.previewEmpty':
    'Adicione ou alinhe letras com tempo para ver a prévia ao vivo.',
  'karaoke.maker.noteNormal': 'Nota',
  'karaoke.maker.noteGolden': 'Dourada',
  'karaoke.maker.noteFree': 'Livre',
  'karaoke.maker.untimed': 'Sem tempo',
  'karaoke.maker.applyUntimed':
    'Ainda há {count} palavras da letra sem tempo de voz verificado. Detecte ou posicione-as antes de usar este karaokê no player.',
  'karaoke.maker.selectHint':
    'Selecione uma palavra ou nota melódica para inspecionar.',
  'karaoke.maker.rights':
    'Tenho permissão para usar e exportar este áudio e esta letra.',
  'karaoke.maker.cancel': 'Cancelar',
  'karaoke.maker.localAnalysis': 'Análise local',
  'karaoke.maker.lyricsEyebrow': 'LETRA',
  'karaoke.maker.lyricsTitle': 'Cole ou edite uma linha da letra por linha',
  'karaoke.maker.lyricsWarning':
    'Substituir o texto remove os vínculos para que as palavras possam ser marcadas ou alinhadas com segurança.',
  'karaoke.maker.replaceLyrics': 'Substituir letra',
  'karaoke.maker.transcriptionEyebrow': 'TRANSCRIÇÃO LOCAL OPCIONAL',
  'karaoke.maker.transcriptionTitle': 'Baixar o modelo de voz local?',
  'karaoke.maker.transcriptionBody':
    'O FluidEQ baixará do Hugging Face o modelo {model}, sob licença MIT, e o armazenará neste PC. Seu áudio permanece no FluidEQ e é processado localmente. A primeira execução pode demorar e usar bastante memória.',
  'karaoke.maker.transcriptionReview':
    'O reconhecimento é apenas um ponto de partida. O FluidEQ mantém a grafia da sua letra ao comparar texto e todos os tempos continuam editáveis.',
  'karaoke.maker.notNow': 'Agora não',
  'karaoke.maker.downloadTranscribe': 'Baixar e transcrever',
  'karaoke.maker.analysisSource':
    'Usando “{file}” apenas como fonte de análise local.',
  'karaoke.maker.rightsRequired':
    'Confirme que você tem os direitos do áudio e da letra antes de publicar uma exportação.',
  'karaoke.maker.draftRestored': 'Rascunho restaurado',
  'karaoke.maker.playerTimingLoaded':
    'Usando o tempo atual do player. Desfazer restaura o rascunho salvo.',
  'karaoke.maker.applyHint':
    'Use estas edições no player. O arquivo original não muda; Exportar cria um novo arquivo.',
  'karaoke.maker.panView': 'Mão · mover linha do tempo',
  'karaoke.maker.panHint':
    'Ferramenta mão: arraste no canvas para percorrer a música sem editar.',
  'karaoke.maker.scrubHint':
    'Clique ou arraste o cursor de reprodução para percorrer a música.',
  'karaoke.maker.wordStateLegend': 'Status do tempo da letra',
  'karaoke.maker.userAdjustedWords': '{count} ajustadas',
  'karaoke.maker.pendingWords': '{count} pendentes',
  'karaoke.maker.resetZoom': 'Clique duas vezes para ajustar a letra',
  'karaoke.maker.lyricsAutoAligned':
    'Nova letra aplicada e alinhada à melodia disponível.',
  'karaoke.maker.downloadingWhisper': 'Baixando o modelo Whisper',
  'karaoke.maker.loadingWhisper': 'Carregando o modelo Whisper',
  'karaoke.maker.analysisRunning': 'Analisando afinação localmente',
  'karaoke.maker.analysisAligned':
    '{count} regiões de notas detectadas foram alinhadas às palavras não editadas. O tempo manual foi preservado.',
  'karaoke.maker.analysisFound':
    'A análise encontrou {count} regiões de notas.',
  'karaoke.maker.basicPitchRunning': 'Executando o modelo Basic Pitch incluído',
  'karaoke.maker.basicPitchFound':
    'O Basic Pitch encontrou {count} notas de melodia editáveis. Uma faixa vocal limpa produz o melhor resultado.',
  'karaoke.maker.whisperPreparing': 'Preparando o Whisper',
  'karaoke.maker.whisperDecoding': 'Decodificando o áudio localmente',
  'karaoke.maker.whisperTranscribing': 'Transcrevendo localmente',
  'karaoke.maker.whisperComplete': 'Transcrição concluída',
  'karaoke.maker.whisperMatched':
    'O Whisper associou {count} palavras reconhecidas. Revise os tempos editáveis antes de exportar.',
  'karaoke.maker.autoAlignComplete':
    'A letra não editada foi alinhada à melodia detectada. O tempo manual foi preservado.',
  'karaoke.maker.exported': '{file} foi exportado',
  'karaoke.maker.exportFallback': 'arquivo de karaokê',
  'karaoke.maker.projectTooLarge': 'O projeto ultrapassa 16 MB.',
  'karaoke.maker.previewResize': 'Redimensionar a prévia ao vivo',
  'karaoke.maker.seekBack': 'Voltar {seconds} segundos',
  'karaoke.maker.seekForward': 'Avançar {seconds} segundos',
  'karaoke.maker.jumpToStart': 'Ir para o início da música',
  'karaoke.maker.jumpToEnd': 'Ir para o fim da música',
  'karaoke.maker.errorAudioLimits':
    'A análise local aceita áudios de até 1 GB e gravações com menos de 30 minutos.',
  'karaoke.maker.errorComponentUnavailable':
    'Um componente necessário para a análise local não está disponível. Reinicie o FluidEQ e tente novamente.',
  'karaoke.maker.errorAnalysis':
    'O FluidEQ não conseguiu analisar este áudio localmente.',
  'karaoke.maker.errorExportNeedsNotes':
    'A exportação UltraStar precisa de pelo menos uma nota de melodia.',
  'karaoke.maker.errorExport': 'O FluidEQ não conseguiu exportar este karaokê.',
  'karaoke.maker.errorProjectVersion':
    'Este projeto foi criado por uma versão não compatível do FluidEQ.',
  'karaoke.maker.errorImport':
    'O FluidEQ não conseguiu importar este karaokê ou projeto.',
  'karaoke.maker.errorParse':
    'Não foi possível interpretar o arquivo de letra ou karaokê selecionado.',
  'karaoke.maker.downloadFailed': 'Falha ao baixar o modelo Whisper',
  'karaoke.maker.localAnalysisFailed': 'Falha na análise local',
  'karaoke.maker.whisperDownloadError':
    'O FluidEQ não conseguiu baixar o modelo do Hugging Face. Verifique a conexão ou o firewall e tente novamente.',
  'karaoke.maker.tryAgain': 'Tentar novamente',
  'karaoke.maker.dismiss': 'Fechar erro',
};

export const makerFr: MakerDictionary = {
  'karaoke.maker.open': 'Créer',
  'karaoke.maker.openTitle': 'Créer ou modifier ce karaoké',
  'karaoke.maker.dialog': 'Créateur de karaoké',
  'karaoke.maker.eyebrow': 'CRÉATEUR DE KARAOKÉ FLUIDEQ',
  'karaoke.maker.close': 'Fermer le créateur',
  'karaoke.maker.songTitle': 'Titre de la chanson',
  'karaoke.maker.untitled': 'Karaoké sans titre',
  'karaoke.maker.undo': 'Annuler',
  'karaoke.maker.redo': 'Rétablir',
  'karaoke.maker.preview': 'Aperçu · 1, 2, 3',
  'karaoke.maker.apply': 'Utiliser dans le lecteur',
  'karaoke.maker.lyrics': 'Paroles',
  'karaoke.maker.toolsEdit': 'Outils d’édition',
  'karaoke.maker.toolsAnalysis': 'Outils d’analyse',
  'karaoke.maker.lyricsTiming': 'Calage des paroles',
  'karaoke.maker.timingAll': 'Chanson entière',
  'karaoke.maker.timingFromWord': 'Depuis le mot choisi',
  'karaoke.maker.timingAllHint':
    'Déplace ensemble tous les mots et toutes les notes synchronisés.',
  'karaoke.maker.timingFromWordHint':
    'Déplace « {word} » et la suite. Le calage précédent reste fixe.',
  'karaoke.maker.earlier': 'Avancer toutes les paroles',
  'karaoke.maker.later': 'Retarder toutes les paroles',
  'karaoke.maker.openProject': 'Importer un karaoké',
  'karaoke.maker.projectLoaded': 'Projet chargé. Le son actuel reste associé.',
  'karaoke.maker.karaokeImported':
    'Calage importé. Le son actuel reste associé.',
  'karaoke.maker.tapWords': 'Caler les mots',
  'karaoke.maker.addNote': 'Note',
  'karaoke.maker.hearNote': 'Écouter la note',
  'karaoke.maker.split': 'Diviser',
  'karaoke.maker.delete': 'Supprimer',
  'karaoke.maker.analyze': 'Analyser la mélodie',
  'karaoke.maker.prepare': 'Préparer le karaoké',
  'karaoke.maker.advanced': 'Avancé',
  'karaoke.maker.prepared':
    'Ce karaoké possède déjà des notes mélodiques synchronisées.',
  'karaoke.maker.autoAlign': 'Alignement auto',
  'karaoke.maker.aiMelody': 'Mélodie par IA',
  'karaoke.maker.transcribe': 'Transcrire',
  'karaoke.maker.vocalStem': 'Utiliser la piste vocale',
  'karaoke.maker.vocalStemLoaded': 'Piste vocale chargée',
  'karaoke.maker.vocalFocus': 'Centrer sur la voix',
  'karaoke.maker.export': 'Exporter',
  'karaoke.maker.exportProject': 'Projet FluidEQ',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': 'LRC enrichi',
  'karaoke.maker.tapHint':
    'Appuyez sur ESPACE ou ENTRÉE pour « {word} » · Retour arrière annule',
  'karaoke.maker.editHint':
    'Faites glisser les notes pour modifier hauteur/temps. Tirez un bord pour redimensionner. Ctrl + molette zoome.',
  'karaoke.maker.stats':
    '{notes} notes · {words} mots · {checks} vérifications',
  'karaoke.maker.artist': 'Artiste',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': 'Zoom',
  'karaoke.maker.songPosition': 'Position dans la chanson',
  'karaoke.maker.previousView': 'Section précédente',
  'karaoke.maker.nextView': 'Section suivante',
  'karaoke.maker.livePreview': 'Aperçu en direct',
  'karaoke.maker.showPreview': 'Afficher l’aperçu',
  'karaoke.maker.hidePreview': 'Masquer l’aperçu',
  'karaoke.maker.previewEmpty':
    'Ajoutez ou alignez des paroles minutées pour voir l’aperçu.',
  'karaoke.maker.noteNormal': 'Note',
  'karaoke.maker.noteGolden': 'Dorée',
  'karaoke.maker.noteFree': 'Libre',
  'karaoke.maker.untimed': 'Non calé',
  'karaoke.maker.applyUntimed':
    '{count} mots des paroles n’ont toujours pas de timing vocal vérifié. Détectez-les ou placez-les avant d’utiliser ce karaoké dans le lecteur.',
  'karaoke.maker.selectHint':
    'Sélectionnez une parole ou une note pour l’inspecter.',
  'karaoke.maker.rights':
    'J’ai l’autorisation d’utiliser et d’exporter ce son et ces paroles.',
  'karaoke.maker.cancel': 'Annuler',
  'karaoke.maker.localAnalysis': 'Analyse locale',
  'karaoke.maker.lyricsEyebrow': 'PAROLES',
  'karaoke.maker.lyricsTitle':
    'Collez ou modifiez une ligne de paroles par rangée',
  'karaoke.maker.lyricsWarning':
    'Remplacer le texte efface les liens de mots afin de pouvoir les recaler en toute sécurité.',
  'karaoke.maker.replaceLyrics': 'Remplacer les paroles',
  'karaoke.maker.transcriptionEyebrow': 'TRANSCRIPTION LOCALE FACULTATIVE',
  'karaoke.maker.transcriptionTitle': 'Télécharger le modèle vocal local ?',
  'karaoke.maker.transcriptionBody':
    'FluidEQ téléchargera depuis Hugging Face le modèle {model} sous licence MIT et le mettra en cache sur ce PC. Votre son reste dans FluidEQ et est traité localement. Le premier lancement peut être long et gourmand en mémoire.',
  'karaoke.maker.transcriptionReview':
    'La reconnaissance n’est qu’un point de départ. FluidEQ conserve l’orthographe de vos paroles lors de la correspondance et tous les temps restent modifiables.',
  'karaoke.maker.notNow': 'Pas maintenant',
  'karaoke.maker.downloadTranscribe': 'Télécharger et transcrire',
  'karaoke.maker.analysisSource':
    '« {file} » est utilisé uniquement comme source d’analyse locale.',
  'karaoke.maker.rightsRequired':
    'Confirmez que vous détenez les droits sur le son et les paroles avant de publier un export.',
  'karaoke.maker.draftRestored': 'Brouillon restauré',
  'karaoke.maker.playerTimingLoaded':
    'Le minutage actuel du lecteur est utilisé. Annuler restaure le brouillon enregistré.',
  'karaoke.maker.applyHint':
    'Utilisez ces modifications dans le lecteur. Le fichier original reste inchangé ; Exporter crée un nouveau fichier.',
  'karaoke.maker.panView': 'Main · déplacer la timeline',
  'karaoke.maker.panHint':
    'Outil main : faites glisser le canevas pour parcourir le morceau sans modifier.',
  'karaoke.maker.scrubHint':
    'Cliquez ou faites glisser la tête de lecture pour parcourir le morceau.',
  'karaoke.maker.wordStateLegend': 'État du minutage des paroles',
  'karaoke.maker.userAdjustedWords': '{count} ajustés',
  'karaoke.maker.pendingWords': '{count} en attente',
  'karaoke.maker.resetZoom': 'Double-cliquer pour ajuster les paroles',
  'karaoke.maker.lyricsAutoAligned':
    'Nouvelles paroles appliquées et alignées sur la mélodie disponible.',
  'karaoke.maker.downloadingWhisper': 'Téléchargement du modèle Whisper',
  'karaoke.maker.loadingWhisper': 'Chargement du modèle Whisper',
  'karaoke.maker.analysisRunning': 'Analyse locale de la hauteur',
  'karaoke.maker.analysisAligned':
    '{count} régions de notes détectées ont été alignées avec les mots non modifiés. Le minutage manuel a été conservé.',
  'karaoke.maker.analysisFound': 'L’analyse a trouvé {count} régions de notes.',
  'karaoke.maker.basicPitchRunning': 'Exécution du modèle Basic Pitch intégré',
  'karaoke.maker.basicPitchFound':
    'Basic Pitch a trouvé {count} notes mélodiques modifiables. Une piste vocale propre donne le meilleur résultat.',
  'karaoke.maker.whisperPreparing': 'Préparation de Whisper',
  'karaoke.maker.whisperDecoding': 'Décodage local de l’audio',
  'karaoke.maker.whisperTranscribing': 'Transcription locale',
  'karaoke.maker.whisperComplete': 'Transcription terminée',
  'karaoke.maker.whisperMatched':
    'Whisper a associé {count} mots reconnus. Vérifiez leur minutage modifiable avant l’exportation.',
  'karaoke.maker.autoAlignComplete':
    'Les paroles non modifiées ont été alignées avec la mélodie détectée. Le minutage manuel a été conservé.',
  'karaoke.maker.exported': '{file} a été exporté',
  'karaoke.maker.exportFallback': 'fichier de karaoké',
  'karaoke.maker.projectTooLarge': 'Le projet dépasse 16 Mo.',
  'karaoke.maker.previewResize': 'Redimensionner l’aperçu en direct',
  'karaoke.maker.seekBack': 'Reculer de {seconds} secondes',
  'karaoke.maker.seekForward': 'Avancer de {seconds} secondes',
  'karaoke.maker.jumpToStart': 'Aller au début du morceau',
  'karaoke.maker.jumpToEnd': 'Aller à la fin du morceau',
  'karaoke.maker.errorAudioLimits':
    'L’analyse locale accepte les fichiers audio jusqu’à 1 Go et les enregistrements de moins de 30 minutes.',
  'karaoke.maker.errorComponentUnavailable':
    'Un composant requis pour l’analyse locale est indisponible. Redémarrez FluidEQ et réessayez.',
  'karaoke.maker.errorAnalysis':
    'FluidEQ n’a pas pu analyser cet audio localement.',
  'karaoke.maker.errorExportNeedsNotes':
    'L’exportation UltraStar nécessite au moins une note mélodique.',
  'karaoke.maker.errorExport': 'FluidEQ n’a pas pu exporter ce karaoké.',
  'karaoke.maker.errorProjectVersion':
    'Ce projet a été créé avec une version de FluidEQ non prise en charge.',
  'karaoke.maker.errorImport':
    'FluidEQ n’a pas pu importer ce karaoké ou ce projet.',
  'karaoke.maker.errorParse':
    'Le fichier de paroles ou de karaoké sélectionné n’a pas pu être interprété.',
  'karaoke.maker.downloadFailed': 'Échec du téléchargement du modèle Whisper',
  'karaoke.maker.localAnalysisFailed': 'Échec de l’analyse locale',
  'karaoke.maker.whisperDownloadError':
    'FluidEQ n’a pas pu télécharger le modèle depuis Hugging Face. Vérifiez la connexion ou le pare-feu, puis réessayez.',
  'karaoke.maker.tryAgain': 'Réessayer',
  'karaoke.maker.dismiss': 'Fermer l’erreur',
};

export const makerDe: MakerDictionary = {
  'karaoke.maker.open': 'Erstellen',
  'karaoke.maker.openTitle': 'Dieses Karaoke erstellen oder bearbeiten',
  'karaoke.maker.dialog': 'Karaoke-Editor',
  'karaoke.maker.eyebrow': 'FLUIDEQ KARAOKE-EDITOR',
  'karaoke.maker.close': 'Editor schließen',
  'karaoke.maker.songTitle': 'Songtitel',
  'karaoke.maker.untitled': 'Karaoke ohne Titel',
  'karaoke.maker.undo': 'Rückgängig',
  'karaoke.maker.redo': 'Wiederholen',
  'karaoke.maker.preview': 'Vorschau · 1, 2, 3',
  'karaoke.maker.apply': 'Im Player verwenden',
  'karaoke.maker.lyrics': 'Liedtext',
  'karaoke.maker.toolsEdit': 'Bearbeitungswerkzeuge',
  'karaoke.maker.toolsAnalysis': 'Analysewerkzeuge',
  'karaoke.maker.lyricsTiming': 'Liedtext-Timing',
  'karaoke.maker.timingAll': 'Ganzer Song',
  'karaoke.maker.timingFromWord': 'Ab gewähltem Wort',
  'karaoke.maker.timingAllHint':
    'Verschiebt alle synchronisierten Wörter und Noten gemeinsam.',
  'karaoke.maker.timingFromWordHint':
    'Verschiebt „{word}“ und alles danach. Frühere Zeiten bleiben fixiert.',
  'karaoke.maker.earlier': 'Gesamten Liedtext vorziehen',
  'karaoke.maker.later': 'Gesamten Liedtext verzögern',
  'karaoke.maker.openProject': 'Karaoke importieren',
  'karaoke.maker.projectLoaded':
    'Projekt geladen. Das aktuelle Audio bleibt verknüpft.',
  'karaoke.maker.karaokeImported':
    'Karaoke-Timing importiert. Das aktuelle Audio bleibt verknüpft.',
  'karaoke.maker.tapWords': 'Wörter takten',
  'karaoke.maker.addNote': 'Note',
  'karaoke.maker.hearNote': 'Note anhören',
  'karaoke.maker.split': 'Teilen',
  'karaoke.maker.delete': 'Löschen',
  'karaoke.maker.analyze': 'Melodie analysieren',
  'karaoke.maker.prepare': 'Karaoke vorbereiten',
  'karaoke.maker.advanced': 'Erweitert',
  'karaoke.maker.prepared':
    'Dieses Karaoke enthält bereits synchronisierte Melodienoten.',
  'karaoke.maker.autoAlign': 'Automatisch ausrichten',
  'karaoke.maker.aiMelody': 'KI-Melodie',
  'karaoke.maker.transcribe': 'Transkribieren',
  'karaoke.maker.vocalStem': 'Gesangsspur verwenden',
  'karaoke.maker.vocalStemLoaded': 'Gesangsspur geladen',
  'karaoke.maker.vocalFocus': 'Mittigen Gesang fokussieren',
  'karaoke.maker.export': 'Exportieren',
  'karaoke.maker.exportProject': 'FluidEQ-Projekt',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': 'Erweitertes LRC',
  'karaoke.maker.tapHint':
    'LEERTASTE oder EINGABE für „{word}“ · Rücktaste macht rückgängig',
  'karaoke.maker.editHint':
    'Noten ziehen, um Tonhöhe/Zeit zu ändern. An Kanten ziehen zum Skalieren. Strg + Rad zoomt.',
  'karaoke.maker.stats': '{notes} Noten · {words} Wörter · {checks} Prüfungen',
  'karaoke.maker.artist': 'Interpret',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': 'Zoom',
  'karaoke.maker.songPosition': 'Position im Song',
  'karaoke.maker.previousView': 'Vorheriger Abschnitt',
  'karaoke.maker.nextView': 'Nächster Abschnitt',
  'karaoke.maker.livePreview': 'Live-Vorschau',
  'karaoke.maker.showPreview': 'Vorschau anzeigen',
  'karaoke.maker.hidePreview': 'Vorschau ausblenden',
  'karaoke.maker.previewEmpty':
    'Füge zeitlich abgestimmten Liedtext hinzu, um die Vorschau zu sehen.',
  'karaoke.maker.noteNormal': 'Note',
  'karaoke.maker.noteGolden': 'Gold',
  'karaoke.maker.noteFree': 'Frei',
  'karaoke.maker.untimed': 'Ohne Zeit',
  'karaoke.maker.applyUntimed':
    '{count} Liedtextwörter haben noch kein bestätigtes Sprach-Timing. Erkennen oder platzieren Sie sie, bevor Sie dieses Karaoke im Player verwenden.',
  'karaoke.maker.selectHint':
    'Wählen Sie ein Wort oder eine Melodienote zum Prüfen.',
  'karaoke.maker.rights':
    'Ich darf dieses Audio und diesen Liedtext verwenden und exportieren.',
  'karaoke.maker.cancel': 'Abbrechen',
  'karaoke.maker.localAnalysis': 'Lokale Analyse',
  'karaoke.maker.lyricsEyebrow': 'LIEDTEXT',
  'karaoke.maker.lyricsTitle':
    'Pro Zeile eine Liedtextzeile einfügen oder bearbeiten',
  'karaoke.maker.lyricsWarning':
    'Beim Ersetzen werden Wortverknüpfungen gelöscht, damit die Wörter sicher neu getaktet werden können.',
  'karaoke.maker.replaceLyrics': 'Liedtext ersetzen',
  'karaoke.maker.transcriptionEyebrow': 'OPTIONALE LOKALE TRANSKRIPTION',
  'karaoke.maker.transcriptionTitle': 'Lokales Sprachmodell herunterladen?',
  'karaoke.maker.transcriptionBody':
    'FluidEQ lädt das MIT-lizenzierte Modell {model} von Hugging Face herunter und speichert es auf diesem PC. Ihr Audio bleibt in FluidEQ und wird lokal verarbeitet. Der erste Lauf kann dauern und viel Speicher benötigen.',
  'karaoke.maker.transcriptionReview':
    'Die Erkennung ist nur ein Ausgangspunkt. FluidEQ behält beim Abgleich Ihre Schreibweise bei und alle Zeiten bleiben bearbeitbar.',
  'karaoke.maker.notNow': 'Nicht jetzt',
  'karaoke.maker.downloadTranscribe': 'Herunterladen und transkribieren',
  'karaoke.maker.analysisSource':
    '„{file}“ wird nur als lokale Analysequelle verwendet.',
  'karaoke.maker.rightsRequired':
    'Bestätigen Sie vor dem Veröffentlichen die Rechte an Audio und Liedtext.',
  'karaoke.maker.draftRestored': 'Entwurf wiederhergestellt',
  'karaoke.maker.playerTimingLoaded':
    'Die aktuelle Player-Zeitsetzung wird verwendet. Rückgängig stellt den gespeicherten Entwurf wieder her.',
  'karaoke.maker.applyHint':
    'Diese Änderungen im Player verwenden. Die Originaldatei bleibt unverändert; Export erstellt eine neue Datei.',
  'karaoke.maker.panView': 'Hand · Zeitleiste verschieben',
  'karaoke.maker.panHint':
    'Handwerkzeug: Ziehen Sie auf der Fläche, um ohne Bearbeitung durch den Song zu navigieren.',
  'karaoke.maker.scrubHint':
    'Klicken oder ziehen Sie den Abspielkopf, um durch den Song zu navigieren.',
  'karaoke.maker.wordStateLegend': 'Status der Liedtext-Zeitsetzung',
  'karaoke.maker.userAdjustedWords': '{count} angepasst',
  'karaoke.maker.pendingWords': '{count} ausstehend',
  'karaoke.maker.resetZoom': 'Doppelklicken, um Liedtext einzupassen',
  'karaoke.maker.lyricsAutoAligned':
    'Neuer Liedtext angewendet und an der verfügbaren Melodie ausgerichtet.',
  'karaoke.maker.downloadingWhisper': 'Whisper-Modell wird heruntergeladen',
  'karaoke.maker.loadingWhisper': 'Whisper-Modell wird geladen',
  'karaoke.maker.analysisRunning': 'Tonhöhe wird lokal analysiert',
  'karaoke.maker.analysisAligned':
    'Unbearbeitete Wörter wurden an {count} erkannte Notenbereiche angepasst. Manuelle Zeitangaben blieben erhalten.',
  'karaoke.maker.analysisFound':
    'Die Analyse hat {count} Notenbereiche gefunden.',
  'karaoke.maker.basicPitchRunning':
    'Integriertes Basic-Pitch-Modell wird ausgeführt',
  'karaoke.maker.basicPitchFound':
    'Basic Pitch hat {count} bearbeitbare Melodienoten gefunden. Eine saubere Gesangsspur liefert das beste Ergebnis.',
  'karaoke.maker.whisperPreparing': 'Whisper wird vorbereitet',
  'karaoke.maker.whisperDecoding': 'Audio wird lokal dekodiert',
  'karaoke.maker.whisperTranscribing': 'Lokale Transkription läuft',
  'karaoke.maker.whisperComplete': 'Transkription abgeschlossen',
  'karaoke.maker.whisperMatched':
    'Whisper hat {count} erkannte Wörter zugeordnet. Prüfen Sie vor dem Export die bearbeitbaren Zeitangaben.',
  'karaoke.maker.autoAlignComplete':
    'Unbearbeiteter Liedtext wurde an die erkannte Melodie angepasst. Manuelle Zeitangaben blieben erhalten.',
  'karaoke.maker.exported': '{file} wurde exportiert',
  'karaoke.maker.exportFallback': 'Karaoke-Datei',
  'karaoke.maker.projectTooLarge': 'Das Projekt ist größer als 16 MB.',
  'karaoke.maker.previewResize': 'Live-Vorschau skalieren',
  'karaoke.maker.seekBack': '{seconds} Sekunden zurück',
  'karaoke.maker.seekForward': '{seconds} Sekunden vor',
  'karaoke.maker.jumpToStart': 'Zum Songanfang springen',
  'karaoke.maker.jumpToEnd': 'Zum Songende springen',
  'karaoke.maker.errorAudioLimits':
    'Die lokale Analyse unterstützt Audiodateien bis 1 GB und Aufnahmen unter 30 Minuten.',
  'karaoke.maker.errorComponentUnavailable':
    'Eine erforderliche Komponente für die lokale Analyse ist nicht verfügbar. Starten Sie FluidEQ neu und versuchen Sie es erneut.',
  'karaoke.maker.errorAnalysis':
    'FluidEQ konnte dieses Audio nicht lokal analysieren.',
  'karaoke.maker.errorExportNeedsNotes':
    'Für den UltraStar-Export ist mindestens eine Melodienote erforderlich.',
  'karaoke.maker.errorExport':
    'FluidEQ konnte dieses Karaoke nicht exportieren.',
  'karaoke.maker.errorProjectVersion':
    'Dieses Projekt wurde mit einer nicht unterstützten FluidEQ-Version erstellt.',
  'karaoke.maker.errorImport':
    'FluidEQ konnte dieses Karaoke oder Projekt nicht importieren.',
  'karaoke.maker.errorParse':
    'Die ausgewählte Liedtext- oder Karaoke-Datei konnte nicht gelesen werden.',
  'karaoke.maker.downloadFailed': 'Download des Whisper-Modells fehlgeschlagen',
  'karaoke.maker.localAnalysisFailed': 'Lokale Analyse fehlgeschlagen',
  'karaoke.maker.whisperDownloadError':
    'FluidEQ konnte das Modell nicht von Hugging Face herunterladen. Prüfen Sie Verbindung oder Firewall und versuchen Sie es erneut.',
  'karaoke.maker.tryAgain': 'Erneut versuchen',
  'karaoke.maker.dismiss': 'Fehler schließen',
};

export const makerIt: MakerDictionary = {
  'karaoke.maker.open': 'Crea',
  'karaoke.maker.openTitle': 'Crea o modifica questo karaoke',
  'karaoke.maker.dialog': 'Creatore di karaoke',
  'karaoke.maker.eyebrow': 'CREATORE KARAOKE FLUIDEQ',
  'karaoke.maker.close': 'Chiudi il creatore',
  'karaoke.maker.songTitle': 'Titolo del brano',
  'karaoke.maker.untitled': 'Karaoke senza titolo',
  'karaoke.maker.undo': 'Annulla',
  'karaoke.maker.redo': 'Ripeti',
  'karaoke.maker.preview': 'Anteprima · 1, 2, 3',
  'karaoke.maker.apply': 'Usa nel lettore',
  'karaoke.maker.lyrics': 'Testo',
  'karaoke.maker.toolsEdit': 'Strumenti di modifica',
  'karaoke.maker.toolsAnalysis': 'Strumenti di analisi',
  'karaoke.maker.lyricsTiming': 'Tempo del testo',
  'karaoke.maker.timingAll': 'Intero brano',
  'karaoke.maker.timingFromWord': 'Dalla parola scelta',
  'karaoke.maker.timingAllHint':
    'Sposta insieme tutte le parole e le note sincronizzate.',
  'karaoke.maker.timingFromWordHint':
    'Sposta “{word}” e tutto ciò che segue. I tempi precedenti restano fissi.',
  'karaoke.maker.earlier': 'Anticipa tutto il testo',
  'karaoke.maker.later': 'Posticipa tutto il testo',
  'karaoke.maker.openProject': 'Importa karaoke',
  'karaoke.maker.projectLoaded':
    'Progetto caricato. L’audio corrente resta collegato.',
  'karaoke.maker.karaokeImported':
    'Sincronizzazione importata. L’audio corrente resta collegato.',
  'karaoke.maker.tapWords': 'Sincronizza parole',
  'karaoke.maker.addNote': 'Nota',
  'karaoke.maker.hearNote': 'Ascolta la nota',
  'karaoke.maker.split': 'Dividi',
  'karaoke.maker.delete': 'Elimina',
  'karaoke.maker.analyze': 'Analizza melodia',
  'karaoke.maker.prepare': 'Prepara karaoke',
  'karaoke.maker.advanced': 'Avanzato',
  'karaoke.maker.prepared':
    'Questo karaoke contiene già note melodiche sincronizzate.',
  'karaoke.maker.autoAlign': 'Allinea automaticamente',
  'karaoke.maker.aiMelody': 'Melodia IA',
  'karaoke.maker.transcribe': 'Trascrivi',
  'karaoke.maker.vocalStem': 'Usa traccia vocale',
  'karaoke.maker.vocalStemLoaded': 'Traccia vocale caricata',
  'karaoke.maker.vocalFocus': 'Metti a fuoco la voce centrale',
  'karaoke.maker.export': 'Esporta',
  'karaoke.maker.exportProject': 'Progetto FluidEQ',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': 'LRC avanzato',
  'karaoke.maker.tapHint':
    'Premi SPAZIO o INVIO per “{word}” · Backspace annulla',
  'karaoke.maker.editHint':
    'Trascina le note per cambiare altezza/tempo. Trascina i bordi per ridimensionare. Ctrl + rotella ingrandisce.',
  'karaoke.maker.stats': '{notes} note · {words} parole · {checks} controlli',
  'karaoke.maker.artist': 'Artista',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': 'Zoom',
  'karaoke.maker.songPosition': 'Posizione nel brano',
  'karaoke.maker.previousView': 'Sezione precedente',
  'karaoke.maker.nextView': 'Sezione successiva',
  'karaoke.maker.livePreview': 'Anteprima dal vivo',
  'karaoke.maker.showPreview': 'Mostra anteprima',
  'karaoke.maker.hidePreview': 'Nascondi anteprima',
  'karaoke.maker.previewEmpty':
    'Aggiungi o allinea il testo temporizzato per vedere l’anteprima.',
  'karaoke.maker.noteNormal': 'Nota',
  'karaoke.maker.noteGolden': 'Dorata',
  'karaoke.maker.noteFree': 'Libera',
  'karaoke.maker.untimed': 'Senza tempo',
  'karaoke.maker.applyUntimed':
    '{count} parole del testo non hanno ancora un tempo vocale verificato. Rilevale o posizionale prima di usare questo karaoke nel lettore.',
  'karaoke.maker.selectHint':
    'Seleziona una parola o una nota melodica da esaminare.',
  'karaoke.maker.rights':
    'Ho il permesso di usare ed esportare questo audio e questo testo.',
  'karaoke.maker.cancel': 'Annulla',
  'karaoke.maker.localAnalysis': 'Analisi locale',
  'karaoke.maker.lyricsEyebrow': 'TESTO',
  'karaoke.maker.lyricsTitle': 'Incolla o modifica una riga di testo per riga',
  'karaoke.maker.lyricsWarning':
    'La sostituzione cancella i collegamenti per consentire una nuova sincronizzazione sicura.',
  'karaoke.maker.replaceLyrics': 'Sostituisci testo',
  'karaoke.maker.transcriptionEyebrow': 'TRASCRIZIONE LOCALE OPZIONALE',
  'karaoke.maker.transcriptionTitle': 'Scaricare il modello vocale locale?',
  'karaoke.maker.transcriptionBody':
    'FluidEQ scaricherà da Hugging Face il modello {model} con licenza MIT e lo salverà su questo PC. L’audio rimane in FluidEQ e viene elaborato localmente. Il primo avvio può richiedere tempo e molta memoria.',
  'karaoke.maker.transcriptionReview':
    'Il riconoscimento è solo un punto di partenza. FluidEQ conserva l’ortografia del tuo testo durante l’abbinamento e tutti i tempi restano modificabili.',
  'karaoke.maker.notNow': 'Non ora',
  'karaoke.maker.downloadTranscribe': 'Scarica e trascrivi',
  'karaoke.maker.analysisSource':
    '“{file}” viene usato solo come sorgente di analisi locale.',
  'karaoke.maker.rightsRequired':
    'Conferma di avere i diritti su audio e testo prima di pubblicare un’esportazione.',
  'karaoke.maker.draftRestored': 'Bozza ripristinata',
  'karaoke.maker.playerTimingLoaded':
    'Uso della temporizzazione attuale del lettore. Annulla ripristina la bozza salvata.',
  'karaoke.maker.applyHint':
    'Usa queste modifiche nel lettore. Il file originale resta invariato; Esporta crea un nuovo file.',
  'karaoke.maker.panView': 'Mano · sposta timeline',
  'karaoke.maker.panHint':
    'Strumento mano: trascina sul canvas per scorrere il brano senza modificare.',
  'karaoke.maker.scrubHint':
    'Fai clic o trascina la testina di riproduzione per scorrere il brano.',
  'karaoke.maker.wordStateLegend': 'Stato della temporizzazione del testo',
  'karaoke.maker.userAdjustedWords': '{count} regolate',
  'karaoke.maker.pendingWords': '{count} in sospeso',
  'karaoke.maker.resetZoom': 'Doppio clic per adattare il testo',
  'karaoke.maker.lyricsAutoAligned':
    'Nuovo testo applicato e allineato alla melodia disponibile.',
  'karaoke.maker.downloadingWhisper': 'Download del modello Whisper',
  'karaoke.maker.loadingWhisper': 'Caricamento del modello Whisper',
  'karaoke.maker.analysisRunning': 'Analisi locale dell’intonazione',
  'karaoke.maker.analysisAligned':
    'Le parole non modificate sono state allineate a {count} regioni di note rilevate. I tempi manuali sono stati conservati.',
  'karaoke.maker.analysisFound':
    'L’analisi ha trovato {count} regioni di note.',
  'karaoke.maker.basicPitchRunning':
    'Esecuzione del modello Basic Pitch incluso',
  'karaoke.maker.basicPitchFound':
    'Basic Pitch ha trovato {count} note melodiche modificabili. Una traccia vocale pulita offre il risultato migliore.',
  'karaoke.maker.whisperPreparing': 'Preparazione di Whisper',
  'karaoke.maker.whisperDecoding': 'Decodifica locale dell’audio',
  'karaoke.maker.whisperTranscribing': 'Trascrizione locale',
  'karaoke.maker.whisperComplete': 'Trascrizione completata',
  'karaoke.maker.whisperMatched':
    'Whisper ha associato {count} parole riconosciute. Controlla i tempi modificabili prima dell’esportazione.',
  'karaoke.maker.autoAlignComplete':
    'Il testo non modificato è stato allineato alla melodia rilevata. I tempi manuali sono stati conservati.',
  'karaoke.maker.exported': '{file} esportato',
  'karaoke.maker.exportFallback': 'file karaoke',
  'karaoke.maker.projectTooLarge': 'Il progetto supera 16 MB.',
  'karaoke.maker.previewResize': 'Ridimensiona l’anteprima dal vivo',
  'karaoke.maker.seekBack': 'Indietro di {seconds} secondi',
  'karaoke.maker.seekForward': 'Avanti di {seconds} secondi',
  'karaoke.maker.jumpToStart': 'Vai all’inizio del brano',
  'karaoke.maker.jumpToEnd': 'Vai alla fine del brano',
  'karaoke.maker.errorAudioLimits':
    'L’analisi locale supporta file audio fino a 1 GB e registrazioni inferiori a 30 minuti.',
  'karaoke.maker.errorComponentUnavailable':
    'Un componente necessario per l’analisi locale non è disponibile. Riavvia FluidEQ e riprova.',
  'karaoke.maker.errorAnalysis':
    'FluidEQ non ha potuto analizzare localmente questo audio.',
  'karaoke.maker.errorExportNeedsNotes':
    'L’esportazione UltraStar richiede almeno una nota melodica.',
  'karaoke.maker.errorExport':
    'FluidEQ non ha potuto esportare questo karaoke.',
  'karaoke.maker.errorProjectVersion':
    'Questo progetto è stato creato con una versione di FluidEQ non supportata.',
  'karaoke.maker.errorImport':
    'FluidEQ non ha potuto importare questo karaoke o progetto.',
  'karaoke.maker.errorParse':
    'Impossibile interpretare il file di testo o karaoke selezionato.',
  'karaoke.maker.downloadFailed': 'Download del modello Whisper non riuscito',
  'karaoke.maker.localAnalysisFailed': 'Analisi locale non riuscita',
  'karaoke.maker.whisperDownloadError':
    'FluidEQ non ha potuto scaricare il modello da Hugging Face. Controlla connessione o firewall e riprova.',
  'karaoke.maker.tryAgain': 'Riprova',
  'karaoke.maker.dismiss': 'Chiudi errore',
};

export const makerRu: MakerDictionary = {
  'karaoke.maker.open': 'Создать',
  'karaoke.maker.openTitle': 'Создать или изменить это караоке',
  'karaoke.maker.dialog': 'Редактор караоке',
  'karaoke.maker.eyebrow': 'РЕДАКТОР КАРАОКЕ FLUIDEQ',
  'karaoke.maker.close': 'Закрыть редактор',
  'karaoke.maker.songTitle': 'Название песни',
  'karaoke.maker.untitled': 'Караоке без названия',
  'karaoke.maker.undo': 'Отменить',
  'karaoke.maker.redo': 'Повторить',
  'karaoke.maker.preview': 'Предпросмотр · 1, 2, 3',
  'karaoke.maker.apply': 'Использовать в проигрывателе',
  'karaoke.maker.lyrics': 'Текст',
  'karaoke.maker.toolsEdit': 'Инструменты редактирования',
  'karaoke.maker.toolsAnalysis': 'Инструменты анализа',
  'karaoke.maker.lyricsTiming': 'Время текста',
  'karaoke.maker.timingAll': 'Вся песня',
  'karaoke.maker.timingFromWord': 'От выбранного слова',
  'karaoke.maker.timingAllHint':
    'Сдвигает вместе все синхронизированные слова и ноты.',
  'karaoke.maker.timingFromWordHint':
    'Сдвигает «{word}» и всё после него. Предыдущая часть остаётся на месте.',
  'karaoke.maker.earlier': 'Сдвинуть весь текст раньше',
  'karaoke.maker.later': 'Сдвинуть весь текст позже',
  'karaoke.maker.openProject': 'Импортировать караоке',
  'karaoke.maker.projectLoaded':
    'Проект загружен. Текущее аудио осталось подключено.',
  'karaoke.maker.karaokeImported':
    'Синхронизация импортирована. Текущее аудио осталось подключено.',
  'karaoke.maker.tapWords': 'Разметить слова',
  'karaoke.maker.addNote': 'Нота',
  'karaoke.maker.hearNote': 'Прослушать ноту',
  'karaoke.maker.split': 'Разделить',
  'karaoke.maker.delete': 'Удалить',
  'karaoke.maker.analyze': 'Анализ мелодии',
  'karaoke.maker.prepare': 'Подготовить караоке',
  'karaoke.maker.advanced': 'Дополнительно',
  'karaoke.maker.prepared':
    'В этом караоке уже есть синхронизированные ноты мелодии.',
  'karaoke.maker.autoAlign': 'Автовыравнивание',
  'karaoke.maker.aiMelody': 'ИИ-мелодия',
  'karaoke.maker.transcribe': 'Распознать',
  'karaoke.maker.vocalStem': 'Использовать вокальную дорожку',
  'karaoke.maker.vocalStemLoaded': 'Вокальная дорожка загружена',
  'karaoke.maker.vocalFocus': 'Фокус на центральном вокале',
  'karaoke.maker.export': 'Экспорт',
  'karaoke.maker.exportProject': 'Проект FluidEQ',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': 'Расширенный LRC',
  'karaoke.maker.tapHint':
    'Нажмите ПРОБЕЛ или ENTER для «{word}» · Backspace отменяет',
  'karaoke.maker.editHint':
    'Перетаскивайте ноты для изменения высоты/времени. Тяните края для размера. Ctrl + колёсико — масштаб.',
  'karaoke.maker.stats': '{notes} нот · {words} слов · {checks} проверок',
  'karaoke.maker.artist': 'Исполнитель',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': 'Масштаб',
  'karaoke.maker.songPosition': 'Позиция в песне',
  'karaoke.maker.previousView': 'Предыдущий участок',
  'karaoke.maker.nextView': 'Следующий участок',
  'karaoke.maker.livePreview': 'Предпросмотр',
  'karaoke.maker.showPreview': 'Показать предпросмотр',
  'karaoke.maker.hidePreview': 'Скрыть предпросмотр',
  'karaoke.maker.previewEmpty':
    'Добавьте или выровняйте текст по времени для предпросмотра.',
  'karaoke.maker.noteNormal': 'Нота',
  'karaoke.maker.noteGolden': 'Золотая',
  'karaoke.maker.noteFree': 'Свободная',
  'karaoke.maker.untimed': 'Без времени',
  'karaoke.maker.applyUntimed':
    'У {count} слов текста ещё нет подтверждённого времени голоса. Определите или разместите их перед использованием караоке в плеере.',
  'karaoke.maker.selectHint': 'Выберите слово или ноту мелодии для просмотра.',
  'karaoke.maker.rights':
    'У меня есть разрешение использовать и экспортировать это аудио и текст.',
  'karaoke.maker.cancel': 'Отмена',
  'karaoke.maker.localAnalysis': 'Локальный анализ',
  'karaoke.maker.lyricsEyebrow': 'ТЕКСТ',
  'karaoke.maker.lyricsTitle':
    'Вставьте или измените по одной строке текста в каждой строке',
  'karaoke.maker.lyricsWarning':
    'При замене текста связи слов удаляются, чтобы их можно было безопасно разметить заново.',
  'karaoke.maker.replaceLyrics': 'Заменить текст',
  'karaoke.maker.transcriptionEyebrow':
    'НЕОБЯЗАТЕЛЬНОЕ ЛОКАЛЬНОЕ РАСПОЗНАВАНИЕ',
  'karaoke.maker.transcriptionTitle': 'Скачать локальную модель речи?',
  'karaoke.maker.transcriptionBody':
    'FluidEQ скачает с Hugging Face модель {model} под лицензией MIT и сохранит её на этом ПК. Аудио остаётся в FluidEQ и обрабатывается локально. Первый запуск может занять время и много памяти.',
  'karaoke.maker.transcriptionReview':
    'Распознавание — лишь начало. FluidEQ сохраняет написание вашего текста при сопоставлении, а все времена можно редактировать.',
  'karaoke.maker.notNow': 'Не сейчас',
  'karaoke.maker.downloadTranscribe': 'Скачать и распознать',
  'karaoke.maker.analysisSource':
    '«{file}» используется только как локальный источник анализа.',
  'karaoke.maker.rightsRequired':
    'Перед публикацией экспорта подтвердите права на аудио и текст.',
  'karaoke.maker.draftRestored': 'Черновик восстановлен',
  'karaoke.maker.playerTimingLoaded':
    'Используется синхронизация из проигрывателя. Отмена восстановит сохранённый черновик.',
  'karaoke.maker.applyHint':
    'Использовать эти изменения в проигрывателе. Исходный файл не изменится; экспорт создаст новый файл.',
  'karaoke.maker.panView': 'Рука · перемещение шкалы',
  'karaoke.maker.panHint':
    'Инструмент «Рука»: перетаскивайте холст для навигации по песне без редактирования.',
  'karaoke.maker.scrubHint':
    'Щёлкните или перетащите указатель воспроизведения для навигации по песне.',
  'karaoke.maker.wordStateLegend': 'Состояние синхронизации текста',
  'karaoke.maker.userAdjustedWords': 'Исправлено: {count}',
  'karaoke.maker.pendingWords': 'Ожидает: {count}',
  'karaoke.maker.resetZoom': 'Двойной щелчок — вместить текст',
  'karaoke.maker.lyricsAutoAligned':
    'Новый текст применён и выровнен по доступной мелодии.',
  'karaoke.maker.downloadingWhisper': 'Загрузка модели Whisper',
  'karaoke.maker.loadingWhisper': 'Запуск модели Whisper',
  'karaoke.maker.analysisRunning': 'Локальный анализ высоты тона',
  'karaoke.maker.analysisAligned':
    'Неизменённые слова выровнены по {count} найденным участкам нот. Ручная синхронизация сохранена.',
  'karaoke.maker.analysisFound': 'Анализ обнаружил участки нот: {count}.',
  'karaoke.maker.basicPitchRunning': 'Запуск встроенной модели Basic Pitch',
  'karaoke.maker.basicPitchFound':
    'Basic Pitch обнаружил редактируемые ноты мелодии: {count}. Чистая вокальная дорожка даёт лучший результат.',
  'karaoke.maker.whisperPreparing': 'Подготовка Whisper',
  'karaoke.maker.whisperDecoding': 'Локальное декодирование аудио',
  'karaoke.maker.whisperTranscribing': 'Локальное распознавание',
  'karaoke.maker.whisperComplete': 'Распознавание завершено',
  'karaoke.maker.whisperMatched':
    'Whisper сопоставил распознанные слова: {count}. Проверьте редактируемую синхронизацию перед экспортом.',
  'karaoke.maker.autoAlignComplete':
    'Неизменённый текст выровнен по обнаруженной мелодии. Ручная синхронизация сохранена.',
  'karaoke.maker.exported': 'Экспортировано: {file}',
  'karaoke.maker.exportFallback': 'файл караоке',
  'karaoke.maker.projectTooLarge': 'Размер проекта превышает 16 МБ.',
  'karaoke.maker.previewResize': 'Изменить размер предпросмотра',
  'karaoke.maker.seekBack': 'Назад на {seconds} с',
  'karaoke.maker.seekForward': 'Вперёд на {seconds} с',
  'karaoke.maker.jumpToStart': 'Перейти к началу песни',
  'karaoke.maker.jumpToEnd': 'Перейти к концу песни',
  'karaoke.maker.errorAudioLimits':
    'Локальный анализ поддерживает аудиофайлы до 1 ГБ и записи короче 30 минут.',
  'karaoke.maker.errorComponentUnavailable':
    'Необходимый компонент локального анализа недоступен. Перезапустите FluidEQ и повторите попытку.',
  'karaoke.maker.errorAnalysis':
    'FluidEQ не удалось локально проанализировать это аудио.',
  'karaoke.maker.errorExportNeedsNotes':
    'Для экспорта UltraStar нужна хотя бы одна нота мелодии.',
  'karaoke.maker.errorExport': 'FluidEQ не удалось экспортировать это караоке.',
  'karaoke.maker.errorProjectVersion':
    'Этот проект создан в неподдерживаемой версии FluidEQ.',
  'karaoke.maker.errorImport':
    'FluidEQ не удалось импортировать это караоке или проект.',
  'karaoke.maker.errorParse':
    'Не удалось прочитать выбранный файл текста или караоке.',
  'karaoke.maker.downloadFailed': 'Не удалось загрузить модель Whisper',
  'karaoke.maker.localAnalysisFailed': 'Ошибка локального анализа',
  'karaoke.maker.whisperDownloadError':
    'FluidEQ не удалось загрузить модель с Hugging Face. Проверьте подключение или брандмауэр и повторите попытку.',
  'karaoke.maker.tryAgain': 'Повторить',
  'karaoke.maker.dismiss': 'Закрыть ошибку',
};

export const makerZh: MakerDictionary = {
  'karaoke.maker.open': '制作',
  'karaoke.maker.openTitle': '创建或编辑此卡拉 OK',
  'karaoke.maker.dialog': '卡拉 OK 制作器',
  'karaoke.maker.eyebrow': 'FLUIDEQ 卡拉 OK 制作器',
  'karaoke.maker.close': '关闭制作器',
  'karaoke.maker.songTitle': '歌曲标题',
  'karaoke.maker.untitled': '未命名卡拉 OK',
  'karaoke.maker.undo': '撤销',
  'karaoke.maker.redo': '重做',
  'karaoke.maker.preview': '预览 · 1、2、3',
  'karaoke.maker.apply': '在播放器中使用',
  'karaoke.maker.applyHint':
    '在播放器中使用这些编辑。原始卡拉 OK 文件不会改变；导出会创建新文件。',
  'karaoke.maker.lyrics': '歌词',
  'karaoke.maker.toolsEdit': '编辑工具',
  'karaoke.maker.toolsAnalysis': '分析工具',
  'karaoke.maker.lyricsTiming': '歌词时间',
  'karaoke.maker.timingAll': '整首歌曲',
  'karaoke.maker.timingFromWord': '从所选歌词开始',
  'karaoke.maker.timingAllHint': '一起移动所有已同步歌词和音符。',
  'karaoke.maker.timingFromWordHint':
    '移动“{word}”及其后的全部内容，之前的时间保持锁定。',
  'karaoke.maker.earlier': '将全部歌词提前',
  'karaoke.maker.later': '将全部歌词延后',
  'karaoke.maker.openProject': '导入卡拉 OK',
  'karaoke.maker.projectLoaded': '项目已加载，当前音频保持关联。',
  'karaoke.maker.karaokeImported': '卡拉 OK 时间已导入，当前音频保持关联。',
  'karaoke.maker.tapWords': '敲击对词',
  'karaoke.maker.panView': '手形工具 · 平移时间线',
  'karaoke.maker.panHint':
    '手形工具：在画布任意位置拖动以浏览歌曲，不会编辑内容。',
  'karaoke.maker.scrubHint': '点击或拖动播放指针以浏览歌曲。',
  'karaoke.maker.addNote': '音符',
  'karaoke.maker.hearNote': '试听音符',
  'karaoke.maker.split': '拆分',
  'karaoke.maker.delete': '删除',
  'karaoke.maker.analyze': '分析旋律',
  'karaoke.maker.prepare': '准备卡拉 OK',
  'karaoke.maker.advanced': '高级',
  'karaoke.maker.prepared': '此卡拉 OK 已包含同步的旋律音符。',
  'karaoke.maker.autoAlign': '自动对齐',
  'karaoke.maker.aiMelody': 'AI 旋律',
  'karaoke.maker.transcribe': '转写',
  'karaoke.maker.vocalStem': '使用人声分轨',
  'karaoke.maker.vocalStemLoaded': '人声分轨已加载',
  'karaoke.maker.vocalFocus': '聚焦中央人声',
  'karaoke.maker.export': '导出',
  'karaoke.maker.exportProject': 'FluidEQ 项目',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': '增强 LRC',
  'karaoke.maker.tapHint': '按空格或回车标记“{word}” · 退格键撤销',
  'karaoke.maker.editHint':
    '拖动音符可更改音高/时间，拖动边缘可调整长度，Ctrl + 滚轮缩放。',
  'karaoke.maker.wordStateLegend': '歌词时间编辑状态',
  'karaoke.maker.userAdjustedWords': '已调整 {count} 个',
  'karaoke.maker.pendingWords': '待处理 {count} 个',
  'karaoke.maker.stats': '{notes} 个音符 · {words} 个词 · {checks} 项检查',
  'karaoke.maker.artist': '歌手',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': '缩放',
  'karaoke.maker.resetZoom': '双击以显示全部定时歌词',
  'karaoke.maker.songPosition': '歌曲位置',
  'karaoke.maker.previousView': '上一段',
  'karaoke.maker.nextView': '下一段',
  'karaoke.maker.livePreview': '实时预览',
  'karaoke.maker.showPreview': '显示预览',
  'karaoke.maker.hidePreview': '隐藏预览',
  'karaoke.maker.previewEmpty': '添加或对齐定时歌词以查看实时预览。',
  'karaoke.maker.noteNormal': '音符',
  'karaoke.maker.noteGolden': '金色',
  'karaoke.maker.noteFree': '自由',
  'karaoke.maker.untimed': '未定时',
  'karaoke.maker.applyUntimed':
    '仍有 {count} 个歌词词语没有经过验证的人声时间。请先检测或放置它们，再在播放器中使用此卡拉 OK。',
  'karaoke.maker.selectHint': '请选择歌词或旋律音符进行检查。',
  'karaoke.maker.rights': '我有权使用并导出此音频和歌词。',
  'karaoke.maker.cancel': '取消',
  'karaoke.maker.localAnalysis': '本地分析',
  'karaoke.maker.downloadingWhisper': '正在下载 Whisper 模型',
  'karaoke.maker.loadingWhisper': '正在加载 Whisper 模型',
  'karaoke.maker.analysisRunning': '正在本地分析音高',
  'karaoke.maker.analysisAligned':
    '已将未编辑歌词与 {count} 个检测到的音符区域对齐，并保留手动时间。',
  'karaoke.maker.analysisFound': '分析找到 {count} 个音符区域。',
  'karaoke.maker.basicPitchRunning': '正在运行内置 Basic Pitch 模型',
  'karaoke.maker.basicPitchFound':
    'Basic Pitch 找到 {count} 个可编辑旋律音符。干净的人声轨可获得最佳结果。',
  'karaoke.maker.whisperPreparing': '正在准备 Whisper',
  'karaoke.maker.whisperDecoding': '正在本地解码音频',
  'karaoke.maker.whisperTranscribing': '正在本地转写',
  'karaoke.maker.whisperComplete': '转写完成',
  'karaoke.maker.whisperMatched':
    'Whisper 匹配了 {count} 个识别词。导出前请检查可编辑时间。',
  'karaoke.maker.autoAlignComplete':
    '未编辑歌词已与检测到的旋律对齐，并保留手动时间。',
  'karaoke.maker.exported': '已导出 {file}',
  'karaoke.maker.exportFallback': '卡拉 OK 文件',
  'karaoke.maker.projectTooLarge': '项目超过 16 MB。',
  'karaoke.maker.previewResize': '调整实时预览大小',
  'karaoke.maker.seekBack': '后退 {seconds} 秒',
  'karaoke.maker.seekForward': '前进 {seconds} 秒',
  'karaoke.maker.jumpToStart': '跳到歌曲开头',
  'karaoke.maker.jumpToEnd': '跳到歌曲结尾',
  'karaoke.maker.errorAudioLimits':
    '本地分析支持最大 1 GB 的音频文件和少于 30 分钟的录音。',
  'karaoke.maker.errorComponentUnavailable':
    '本地分析所需组件不可用。请重启 FluidEQ 后重试。',
  'karaoke.maker.errorAnalysis': 'FluidEQ 无法在本地分析此音频。',
  'karaoke.maker.errorExportNeedsNotes':
    '导出 UltraStar 至少需要一个旋律音符。',
  'karaoke.maker.errorExport': 'FluidEQ 无法导出此卡拉 OK。',
  'karaoke.maker.errorProjectVersion': '此项目由不受支持的 FluidEQ 版本创建。',
  'karaoke.maker.errorImport': 'FluidEQ 无法导入此卡拉 OK 或项目文件。',
  'karaoke.maker.errorParse': '无法解析所选歌词或卡拉 OK 文件。',
  'karaoke.maker.downloadFailed': 'Whisper 模型下载失败',
  'karaoke.maker.localAnalysisFailed': '本地分析失败',
  'karaoke.maker.whisperDownloadError':
    'FluidEQ 无法从 Hugging Face 下载模型。请检查网络连接或防火墙，然后重试。',
  'karaoke.maker.tryAgain': '重试',
  'karaoke.maker.dismiss': '关闭错误',
  'karaoke.maker.lyricsEyebrow': '歌词',
  'karaoke.maker.lyricsTitle': '每行粘贴或编辑一句歌词',
  'karaoke.maker.lyricsWarning':
    '替换文字会清除词语关联，以便安全地重新敲击或对齐。',
  'karaoke.maker.replaceLyrics': '替换歌词',
  'karaoke.maker.lyricsAutoAligned': '新歌词已应用并与可用旋律自动对齐。',
  'karaoke.maker.transcriptionEyebrow': '可选本地转写',
  'karaoke.maker.transcriptionTitle': '下载本地语音模型？',
  'karaoke.maker.transcriptionBody':
    'FluidEQ 将从 Hugging Face 下载采用 MIT 许可的 {model} 模型并缓存在此电脑。音频始终留在 FluidEQ 中并在本地处理。首次运行可能较慢并占用较多内存。',
  'karaoke.maker.transcriptionReview':
    '识别结果仅是起点。匹配现有文字时 FluidEQ 会保留原歌词拼写，所有时间仍可编辑。',
  'karaoke.maker.notNow': '暂不',
  'karaoke.maker.downloadTranscribe': '下载并转写',
  'karaoke.maker.analysisSource': '仅将“{file}”用作本地分析源。',
  'karaoke.maker.rightsRequired':
    '发布导出文件前，请确认您拥有音频和歌词的权利。',
  'karaoke.maker.draftRestored': '草稿已恢复',
  'karaoke.maker.playerTimingLoaded':
    '正在使用播放器的当前时间。撤销可恢复已保存的草稿。',
};

export const makerJa: MakerDictionary = {
  'karaoke.maker.open': '作成',
  'karaoke.maker.openTitle': 'このカラオケを作成または編集',
  'karaoke.maker.dialog': 'カラオケメーカー',
  'karaoke.maker.eyebrow': 'FLUIDEQ カラオケメーカー',
  'karaoke.maker.close': 'メーカーを閉じる',
  'karaoke.maker.songTitle': '曲名',
  'karaoke.maker.untitled': '無題のカラオケ',
  'karaoke.maker.undo': '元に戻す',
  'karaoke.maker.redo': 'やり直す',
  'karaoke.maker.preview': 'プレビュー · 1、2、3',
  'karaoke.maker.apply': 'プレーヤーで使用',
  'karaoke.maker.lyrics': '歌詞',
  'karaoke.maker.toolsEdit': '編集ツール',
  'karaoke.maker.toolsAnalysis': '解析ツール',
  'karaoke.maker.lyricsTiming': '歌詞タイミング',
  'karaoke.maker.timingAll': '曲全体',
  'karaoke.maker.timingFromWord': '選択した歌詞から',
  'karaoke.maker.timingAllHint':
    '同期済みのすべての歌詞と音符をまとめて移動します。',
  'karaoke.maker.timingFromWordHint':
    '「{word}」以降を移動します。それ以前のタイミングは固定されます。',
  'karaoke.maker.earlier': '歌詞全体を早める',
  'karaoke.maker.later': '歌詞全体を遅らせる',
  'karaoke.maker.openProject': 'カラオケを読み込む',
  'karaoke.maker.projectLoaded':
    'プロジェクトを読み込みました。現在の音声は接続されたままです。',
  'karaoke.maker.karaokeImported':
    'タイミングを読み込みました。現在の音声は接続されたままです。',
  'karaoke.maker.tapWords': '歌詞をタップ',
  'karaoke.maker.addNote': 'ノート',
  'karaoke.maker.hearNote': 'ノートを聴く',
  'karaoke.maker.split': '分割',
  'karaoke.maker.delete': '削除',
  'karaoke.maker.analyze': 'メロディーを解析',
  'karaoke.maker.prepare': 'カラオケを準備',
  'karaoke.maker.advanced': '詳細',
  'karaoke.maker.prepared':
    'このカラオケには同期済みのメロディーノートがあります。',
  'karaoke.maker.autoAlign': '自動整列',
  'karaoke.maker.aiMelody': 'AI メロディー',
  'karaoke.maker.transcribe': '文字起こし',
  'karaoke.maker.vocalStem': 'ボーカルステムを使用',
  'karaoke.maker.vocalStemLoaded': 'ボーカルステム読み込み済み',
  'karaoke.maker.vocalFocus': '中央ボーカルを強調',
  'karaoke.maker.export': '書き出す',
  'karaoke.maker.exportProject': 'FluidEQ プロジェクト',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': '拡張 LRC',
  'karaoke.maker.tapHint':
    '「{word}」でスペースまたは Enter · Backspace で元に戻す',
  'karaoke.maker.editHint':
    'ノートをドラッグして音高/時間を変更。端をドラッグして長さを変更。Ctrl + ホイールでズーム。',
  'karaoke.maker.stats': '{notes} ノート · {words} 語 · {checks} チェック',
  'karaoke.maker.artist': 'アーティスト',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': 'ズーム',
  'karaoke.maker.songPosition': '曲内の位置',
  'karaoke.maker.previousView': '前の区間',
  'karaoke.maker.nextView': '次の区間',
  'karaoke.maker.livePreview': 'ライブプレビュー',
  'karaoke.maker.showPreview': 'プレビューを表示',
  'karaoke.maker.hidePreview': 'プレビューを隠す',
  'karaoke.maker.previewEmpty':
    'タイミング付き歌詞を追加または整列してプレビューします。',
  'karaoke.maker.noteNormal': 'ノート',
  'karaoke.maker.noteGolden': 'ゴールデン',
  'karaoke.maker.noteFree': 'フリー',
  'karaoke.maker.untimed': 'タイミングなし',
  'karaoke.maker.applyUntimed':
    '{count} 個の歌詞単語に、検証済みの音声タイミングがまだありません。プレーヤーで使用する前に検出または配置してください。',
  'karaoke.maker.selectHint':
    '歌詞またはメロディーノートを選択して確認します。',
  'karaoke.maker.rights': 'この音声と歌詞を使用・書き出す許可を持っています。',
  'karaoke.maker.cancel': 'キャンセル',
  'karaoke.maker.localAnalysis': 'ローカル解析',
  'karaoke.maker.lyricsEyebrow': '歌詞',
  'karaoke.maker.lyricsTitle': '1 行ごとに歌詞を貼り付けまたは編集',
  'karaoke.maker.lyricsWarning':
    'テキストを置き換えると、安全に再同期できるよう単語リンクが消去されます。',
  'karaoke.maker.replaceLyrics': '歌詞を置き換える',
  'karaoke.maker.transcriptionEyebrow': '任意のローカル文字起こし',
  'karaoke.maker.transcriptionTitle':
    'ローカル音声モデルをダウンロードしますか？',
  'karaoke.maker.transcriptionBody':
    'FluidEQ は MIT ライセンスの {model} モデルを Hugging Face からダウンロードしてこの PC にキャッシュします。音声は FluidEQ 内に留まりローカルで処理されます。初回は時間と多くのメモリを使う場合があります。',
  'karaoke.maker.transcriptionReview':
    '認識結果は出発点です。既存歌詞との照合では元の表記を保持し、すべての時刻を編集できます。',
  'karaoke.maker.notNow': '今はしない',
  'karaoke.maker.downloadTranscribe': 'ダウンロードして文字起こし',
  'karaoke.maker.analysisSource':
    '「{file}」をローカル解析元としてのみ使用します。',
  'karaoke.maker.rightsRequired':
    '書き出しを公開する前に音声と歌詞の権利を確認してください。',
  'karaoke.maker.draftRestored': '下書きを復元しました',
  'karaoke.maker.playerTimingLoaded':
    'プレイヤーの現在のタイミングを使用しています。元に戻すと保存済みの下書きを復元します。',
  'karaoke.maker.applyHint':
    'この編集をプレイヤーで使用します。元のカラオケファイルは変更されず、エクスポートで新しいファイルを作成します。',
  'karaoke.maker.panView': '手のひら · タイムライン移動',
  'karaoke.maker.panHint':
    '手のひらツール：キャンバスをドラッグして、編集せずに曲内を移動します。',
  'karaoke.maker.scrubHint':
    '再生ヘッドをクリックまたはドラッグして曲内を移動します。',
  'karaoke.maker.wordStateLegend': '歌詞タイミングの作業状況',
  'karaoke.maker.userAdjustedWords': '{count} 語を調整済み',
  'karaoke.maker.pendingWords': '{count} 語が未処理',
  'karaoke.maker.resetZoom': 'ダブルクリックで歌詞全体を表示',
  'karaoke.maker.lyricsAutoAligned':
    '新しい歌詞を適用し、利用可能なメロディーに揃えました。',
  'karaoke.maker.downloadingWhisper': 'Whisper モデルをダウンロード中',
  'karaoke.maker.loadingWhisper': 'Whisper モデルを読み込み中',
  'karaoke.maker.analysisRunning': 'ピッチをローカルで解析中',
  'karaoke.maker.analysisAligned':
    '未編集の歌詞を検出された {count} 個の音符領域に合わせました。手動タイミングは保持されています。',
  'karaoke.maker.analysisFound':
    '解析で {count} 個の音符領域が見つかりました。',
  'karaoke.maker.basicPitchRunning': '内蔵 Basic Pitch モデルを実行中',
  'karaoke.maker.basicPitchFound':
    'Basic Pitch が編集可能なメロディー音符を {count} 個検出しました。クリーンなボーカルトラックが最適です。',
  'karaoke.maker.whisperPreparing': 'Whisper を準備中',
  'karaoke.maker.whisperDecoding': '音声をローカルでデコード中',
  'karaoke.maker.whisperTranscribing': 'ローカルで文字起こし中',
  'karaoke.maker.whisperComplete': '文字起こし完了',
  'karaoke.maker.whisperMatched':
    'Whisper が認識した {count} 語を対応付けました。エクスポート前に編集可能なタイミングを確認してください。',
  'karaoke.maker.autoAlignComplete':
    '未編集の歌詞を検出されたメロディーに合わせました。手動タイミングは保持されています。',
  'karaoke.maker.exported': '{file} をエクスポートしました',
  'karaoke.maker.exportFallback': 'カラオケファイル',
  'karaoke.maker.projectTooLarge': 'プロジェクトが 16 MB を超えています。',
  'karaoke.maker.previewResize': 'ライブプレビューのサイズを変更',
  'karaoke.maker.seekBack': '{seconds} 秒戻る',
  'karaoke.maker.seekForward': '{seconds} 秒進む',
  'karaoke.maker.jumpToStart': '曲の先頭へ移動',
  'karaoke.maker.jumpToEnd': '曲の末尾へ移動',
  'karaoke.maker.errorAudioLimits':
    'ローカル解析は 1 GB 以下の音声ファイルと 30 分未満の録音に対応しています。',
  'karaoke.maker.errorComponentUnavailable':
    'ローカル解析に必要なコンポーネントを利用できません。FluidEQ を再起動して再試行してください。',
  'karaoke.maker.errorAnalysis':
    'FluidEQ はこの音声をローカルで解析できませんでした。',
  'karaoke.maker.errorExportNeedsNotes':
    'UltraStar のエクスポートにはメロディー音符が少なくとも 1 つ必要です。',
  'karaoke.maker.errorExport':
    'FluidEQ はこのカラオケをエクスポートできませんでした。',
  'karaoke.maker.errorProjectVersion':
    'このプロジェクトは未対応の FluidEQ バージョンで作成されています。',
  'karaoke.maker.errorImport':
    'FluidEQ はこのカラオケまたはプロジェクトを読み込めませんでした。',
  'karaoke.maker.errorParse':
    '選択した歌詞またはカラオケファイルを解析できませんでした。',
  'karaoke.maker.downloadFailed': 'Whisper モデルのダウンロードに失敗しました',
  'karaoke.maker.localAnalysisFailed': 'ローカル解析に失敗しました',
  'karaoke.maker.whisperDownloadError':
    'Hugging Face からモデルをダウンロードできませんでした。接続またはファイアウォールを確認して再試行してください。',
  'karaoke.maker.tryAgain': '再試行',
  'karaoke.maker.dismiss': 'エラーを閉じる',
};

export const makerHi: MakerDictionary = {
  'karaoke.maker.open': 'बनाएँ',
  'karaoke.maker.openTitle': 'इस कराओके को बनाएँ या संपादित करें',
  'karaoke.maker.dialog': 'कराओके मेकर',
  'karaoke.maker.eyebrow': 'FLUIDEQ कराओके मेकर',
  'karaoke.maker.close': 'मेकर बंद करें',
  'karaoke.maker.songTitle': 'गीत का शीर्षक',
  'karaoke.maker.untitled': 'बिना शीर्षक का कराओके',
  'karaoke.maker.undo': 'पूर्ववत',
  'karaoke.maker.redo': 'फिर करें',
  'karaoke.maker.preview': 'पूर्वावलोकन · 1, 2, 3',
  'karaoke.maker.apply': 'प्लेयर में उपयोग करें',
  'karaoke.maker.lyrics': 'बोल',
  'karaoke.maker.toolsEdit': 'संपादन उपकरण',
  'karaoke.maker.toolsAnalysis': 'विश्लेषण उपकरण',
  'karaoke.maker.lyricsTiming': 'बोल का समय',
  'karaoke.maker.timingAll': 'पूरा गीत',
  'karaoke.maker.timingFromWord': 'चुने हुए शब्द से',
  'karaoke.maker.timingAllHint':
    'सभी समयबद्ध शब्दों और सुरों को एक साथ खिसकाता है।',
  'karaoke.maker.timingFromWordHint':
    '“{word}” और उसके बाद सब कुछ खिसकाता है। पहले का समय स्थिर रहता है।',
  'karaoke.maker.earlier': 'पूरे बोल पहले करें',
  'karaoke.maker.later': 'पूरे बोल बाद में करें',
  'karaoke.maker.openProject': 'कराओके आयात करें',
  'karaoke.maker.projectLoaded': 'प्रोजेक्ट लोड हुआ। मौजूदा ऑडियो जुड़ा रहेगा।',
  'karaoke.maker.karaokeImported':
    'कराओके समय आयात हुआ। मौजूदा ऑडियो जुड़ा रहेगा।',
  'karaoke.maker.tapWords': 'शब्द टैप करें',
  'karaoke.maker.addNote': 'स्वर',
  'karaoke.maker.hearNote': 'स्वर सुनें',
  'karaoke.maker.split': 'विभाजित करें',
  'karaoke.maker.delete': 'हटाएँ',
  'karaoke.maker.analyze': 'धुन का विश्लेषण',
  'karaoke.maker.prepare': 'कराओके तैयार करें',
  'karaoke.maker.advanced': 'उन्नत',
  'karaoke.maker.prepared': 'इस कराओके में पहले से समयबद्ध धुन के नोट हैं।',
  'karaoke.maker.autoAlign': 'स्वतः मिलाएँ',
  'karaoke.maker.aiMelody': 'AI धुन',
  'karaoke.maker.transcribe': 'लिप्यंतरण',
  'karaoke.maker.vocalStem': 'वोकल स्टेम उपयोग करें',
  'karaoke.maker.vocalStemLoaded': 'वोकल स्टेम लोड हुआ',
  'karaoke.maker.vocalFocus': 'केंद्रीय आवाज़ पर ध्यान',
  'karaoke.maker.export': 'निर्यात',
  'karaoke.maker.exportProject': 'FluidEQ प्रोजेक्ट',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': 'उन्नत LRC',
  'karaoke.maker.tapHint':
    '“{word}” के लिए SPACE या ENTER दबाएँ · Backspace पूर्ववत करता है',
  'karaoke.maker.editHint':
    'स्वर/समय बदलने के लिए नोट खींचें। आकार के लिए किनारा खींचें। Ctrl + व्हील ज़ूम करता है।',
  'karaoke.maker.stats': '{notes} स्वर · {words} शब्द · {checks} जाँच',
  'karaoke.maker.artist': 'कलाकार',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': 'ज़ूम',
  'karaoke.maker.songPosition': 'गीत में स्थान',
  'karaoke.maker.previousView': 'पिछला भाग',
  'karaoke.maker.nextView': 'अगला भाग',
  'karaoke.maker.livePreview': 'लाइव पूर्वावलोकन',
  'karaoke.maker.showPreview': 'पूर्वावलोकन दिखाएँ',
  'karaoke.maker.hidePreview': 'पूर्वावलोकन छिपाएँ',
  'karaoke.maker.previewEmpty':
    'लाइव पूर्वावलोकन के लिए समयबद्ध गीत जोड़ें या संरेखित करें।',
  'karaoke.maker.noteNormal': 'स्वर',
  'karaoke.maker.noteGolden': 'गोल्डन',
  'karaoke.maker.noteFree': 'मुक्त',
  'karaoke.maker.untimed': 'बिना समय',
  'karaoke.maker.applyUntimed':
    '{count} बोल शब्दों का सत्यापित आवाज़ समय अभी नहीं है। इस कराओके को प्लेयर में उपयोग करने से पहले उन्हें पहचानें या रखें।',
  'karaoke.maker.selectHint': 'जाँचने के लिए कोई बोल या धुन का स्वर चुनें।',
  'karaoke.maker.rights':
    'मुझे इस ऑडियो और बोल का उपयोग और निर्यात करने की अनुमति है।',
  'karaoke.maker.cancel': 'रद्द करें',
  'karaoke.maker.localAnalysis': 'स्थानीय विश्लेषण',
  'karaoke.maker.lyricsEyebrow': 'बोल',
  'karaoke.maker.lyricsTitle':
    'हर पंक्ति में बोल की एक पंक्ति चिपकाएँ या संपादित करें',
  'karaoke.maker.lyricsWarning':
    'टेक्स्ट बदलने पर शब्द लिंक मिटते हैं ताकि उन्हें सुरक्षित रूप से फिर टैप या मिलाया जा सके।',
  'karaoke.maker.replaceLyrics': 'बोल बदलें',
  'karaoke.maker.transcriptionEyebrow': 'वैकल्पिक स्थानीय लिप्यंतरण',
  'karaoke.maker.transcriptionTitle': 'स्थानीय वॉइस मॉडल डाउनलोड करें?',
  'karaoke.maker.transcriptionBody':
    'FluidEQ MIT लाइसेंस वाले {model} मॉडल को Hugging Face से डाउनलोड कर इस PC पर कैश करेगा। आपका ऑडियो FluidEQ में ही रहता है और स्थानीय रूप से संसाधित होता है। पहली बार समय और अधिक मेमोरी लग सकती है।',
  'karaoke.maker.transcriptionReview':
    'पहचान केवल शुरुआती बिंदु है। मौजूदा बोल मिलाते समय FluidEQ आपकी वर्तनी रखता है और सभी समय संपादन योग्य रहते हैं।',
  'karaoke.maker.notNow': 'अभी नहीं',
  'karaoke.maker.downloadTranscribe': 'डाउनलोड और लिप्यंतरण करें',
  'karaoke.maker.analysisSource':
    '“{file}” को केवल स्थानीय विश्लेषण स्रोत के रूप में उपयोग किया जा रहा है।',
  'karaoke.maker.rightsRequired':
    'निर्यात प्रकाशित करने से पहले ऑडियो और बोल के अधिकारों की पुष्टि करें।',
  'karaoke.maker.draftRestored': 'ड्राफ़्ट बहाल हुआ',
  'karaoke.maker.playerTimingLoaded':
    'प्लेयर का मौजूदा समय उपयोग हो रहा है। पूर्ववत करने पर सहेजा ड्राफ़्ट वापस आएगा।',
  'karaoke.maker.applyHint':
    'इन बदलावों को प्लेयर में उपयोग करें। मूल कराओके फ़ाइल नहीं बदलेगी; निर्यात नई फ़ाइल बनाएगा।',
  'karaoke.maker.panView': 'हाथ · टाइमलाइन खिसकाएँ',
  'karaoke.maker.panHint':
    'हाथ टूल: बिना संपादन किए गीत में घूमने के लिए कैनवास पर खींचें।',
  'karaoke.maker.scrubHint':
    'गीत में जाने के लिए प्लेहेड पर क्लिक करें या उसे खींचें।',
  'karaoke.maker.wordStateLegend': 'गीत समय-निर्धारण की स्थिति',
  'karaoke.maker.userAdjustedWords': '{count} समायोजित',
  'karaoke.maker.pendingWords': '{count} लंबित',
  'karaoke.maker.resetZoom': 'गीत फिट करने के लिए डबल-क्लिक करें',
  'karaoke.maker.lyricsAutoAligned':
    'नए गीत लागू हुए और उपलब्ध धुन से संरेखित किए गए।',
  'karaoke.maker.downloadingWhisper': 'Whisper मॉडल डाउनलोड हो रहा है',
  'karaoke.maker.loadingWhisper': 'Whisper मॉडल लोड हो रहा है',
  'karaoke.maker.analysisRunning': 'पिच का स्थानीय विश्लेषण हो रहा है',
  'karaoke.maker.analysisAligned':
    'बिना बदले शब्दों को मिले {count} स्वर क्षेत्रों से मिलाया गया। मैन्युअल समय सुरक्षित रखा गया।',
  'karaoke.maker.analysisFound': 'विश्लेषण में {count} स्वर क्षेत्र मिले।',
  'karaoke.maker.basicPitchRunning': 'साथ दिया गया Basic Pitch मॉडल चल रहा है',
  'karaoke.maker.basicPitchFound':
    'Basic Pitch को {count} संपादन योग्य धुन के स्वर मिले। साफ़ वोकल ट्रैक सबसे अच्छा परिणाम देता है।',
  'karaoke.maker.whisperPreparing': 'Whisper तैयार हो रहा है',
  'karaoke.maker.whisperDecoding': 'ऑडियो स्थानीय रूप से डिकोड हो रहा है',
  'karaoke.maker.whisperTranscribing': 'स्थानीय लिप्यंतरण हो रहा है',
  'karaoke.maker.whisperComplete': 'लिप्यंतरण पूरा हुआ',
  'karaoke.maker.whisperMatched':
    'Whisper ने {count} पहचाने शब्द मिलाए। निर्यात से पहले उनके संपादन योग्य समय की जाँच करें।',
  'karaoke.maker.autoAlignComplete':
    'बिना बदले बोल पहचानी गई धुन से मिलाए गए। मैन्युअल समय सुरक्षित रखा गया।',
  'karaoke.maker.exported': '{file} निर्यात किया गया',
  'karaoke.maker.exportFallback': 'कराओके फ़ाइल',
  'karaoke.maker.projectTooLarge': 'प्रोजेक्ट 16 MB से बड़ा है।',
  'karaoke.maker.previewResize': 'लाइव पूर्वावलोकन का आकार बदलें',
  'karaoke.maker.seekBack': '{seconds} सेकंड पीछे जाएँ',
  'karaoke.maker.seekForward': '{seconds} सेकंड आगे जाएँ',
  'karaoke.maker.jumpToStart': 'गीत की शुरुआत पर जाएँ',
  'karaoke.maker.jumpToEnd': 'गीत के अंत पर जाएँ',
  'karaoke.maker.errorAudioLimits':
    'स्थानीय विश्लेषण 1 GB तक की ऑडियो फ़ाइल और 30 मिनट से छोटी रिकॉर्डिंग समर्थित करता है।',
  'karaoke.maker.errorComponentUnavailable':
    'स्थानीय विश्लेषण का आवश्यक घटक उपलब्ध नहीं है। FluidEQ फिर शुरू करें और दोबारा प्रयास करें।',
  'karaoke.maker.errorAnalysis':
    'FluidEQ इस ऑडियो का स्थानीय विश्लेषण नहीं कर सका।',
  'karaoke.maker.errorExportNeedsNotes':
    'UltraStar निर्यात के लिए कम से कम एक धुन का स्वर चाहिए।',
  'karaoke.maker.errorExport': 'FluidEQ यह कराओके निर्यात नहीं कर सका।',
  'karaoke.maker.errorProjectVersion':
    'यह प्रोजेक्ट FluidEQ के असमर्थित संस्करण में बनाया गया था।',
  'karaoke.maker.errorImport':
    'FluidEQ यह कराओके या प्रोजेक्ट आयात नहीं कर सका।',
  'karaoke.maker.errorParse': 'चुनी गई बोल या कराओके फ़ाइल पढ़ी नहीं जा सकी।',
  'karaoke.maker.downloadFailed': 'Whisper मॉडल डाउनलोड विफल',
  'karaoke.maker.localAnalysisFailed': 'स्थानीय विश्लेषण विफल',
  'karaoke.maker.whisperDownloadError':
    'FluidEQ Hugging Face से मॉडल डाउनलोड नहीं कर सका। इंटरनेट या फ़ायरवॉल जाँचें और फिर प्रयास करें।',
  'karaoke.maker.tryAgain': 'फिर प्रयास करें',
  'karaoke.maker.dismiss': 'त्रुटि बंद करें',
};
