/* FluidEQ Karaoke Maker workflow translations. GPL-3.0-or-later. */

import { Dictionary } from './en';

type MakerWorkflowDictionary = Partial<Dictionary>;

export const makerWorkflowPt: MakerWorkflowDictionary = {
  'karaoke.maker.recordLines': 'Gravar entradas de linhas',
  'karaoke.maker.syncLinesFromHere': 'Sincronizar linhas daqui',
  'karaoke.maker.syncWordsFromHere': 'Sincronizar palavras daqui',
  'karaoke.maker.syncNow': 'Agora',
  'karaoke.maker.syncNext': 'Próximo: {item}',
  'karaoke.maker.markLine': 'Marcar início da linha',
  'karaoke.maker.markLineEnd': 'Marcar fim da linha',
  'karaoke.maker.captureEnd': 'Ouvindo o final',
  'karaoke.maker.capturePressStart': 'Etapa 1 · Enter no INÍCIO',
  'karaoke.maker.captureReplaceStart':
    'Próxima letra pronta · Enter substitui o INÍCIO',
  'karaoke.maker.captureStartSaved': 'Início salvo em {time} · Enter no FIM',
  'karaoke.maker.captureAutomaticStart':
    'Início automático {time} · Enter no FIM',
  'karaoke.maker.captureAutomaticSuggestion':
    'Início sugerido {time} · Enter grava o INÍCIO',
  'karaoke.maker.captureFixEnd': 'Linha gravada · Enter corrige o FIM',
  'karaoke.maker.captureStartPoint': 'INÍCIO',
  'karaoke.maker.captureEndPoint': 'FIM',
  'karaoke.maker.markWord': 'Marcar palavra',
  'karaoke.maker.done': 'Concluir',
  'karaoke.maker.ignoreLine': 'Ignorar linha',
  'karaoke.maker.lineTimingComplete':
    'Sincronização das linhas concluída. Pronta para revisar e usar no player.',
  'karaoke.maker.recordLinesHint':
    'ENTER marca início/fim · ↑/↓ escolhe a linha · ←/→ move apenas o áudio 2 s · ESPAÇO reproduz ou pausa · Backspace desfaz',
  'karaoke.maker.acceptLyrics': 'Aceitar letra',
  'karaoke.maker.acceptAndRecordLines': 'Aceitar e gravar tempos',
  'karaoke.maker.captureGuideTitle': 'Tempo da linha',
  'karaoke.maker.captureGuideNext': 'A seguir',
  'karaoke.maker.captureGuideAudio':
    'move o áudio 2 segundos · Shift: 1 segundo',
  'karaoke.maker.captureGuideLyrics': 'escolhe a linha da letra',
  'karaoke.maker.captureGuidePlayback': 'reproduz ou pausa',
  'karaoke.maker.captureGuideUndo': 'desfaz a última marca',
  'karaoke.maker.repairLyrics': 'Detectar novamente o tempo da letra',
  'karaoke.maker.repairMelody': 'Detectar novamente as notas da melodia',
  'karaoke.maker.rebuildKaraoke': 'Reconstruir letra + melodia',
  'karaoke.maker.lyricsReferenceHint':
    'Forneça a letra completa, incluindo linhas repetidas e marcadores como [Verso] ou [Refrão]. O FluidEQ mantém esse texto e usa reconhecimento de voz local para encontrar o tempo.',
  'karaoke.maker.referenceLyrics': 'Letra de referência',
  'karaoke.maker.wordTiming': 'Tempo da palavra',
  'karaoke.maker.lyricsWordCount': '{count} palavras na referência',
  'karaoke.maker.lyricsTimedCount': '{timed} de {total} com tempo',
  'karaoke.maker.lyricsApplyBeforeTiming':
    'Detecte a nova letra antes de editar o tempo das palavras',
  'karaoke.maker.lyricsNoTimedWords': 'Ainda não há palavras com tempo',
  'karaoke.maker.lyricsTimingEditorHint':
    'Após a detecção, selecione qualquer palavra para corrigir o texto, o início ou a duração.',
  'karaoke.maker.lyricsSelectWord':
    'Selecione uma palavra para editar seu tempo.',
  'karaoke.maker.lyricsSelectedWord': 'Palavra selecionada',
  'karaoke.maker.lyricsWordNavigation': 'Navegação por palavras',
  'karaoke.maker.previousWord': 'Palavra anterior',
  'karaoke.maker.nextWord': 'Próxima palavra',
  'karaoke.maker.lyricsPlaceholder':
    'Cole a letra completa aqui…\n\n[Verso]\nPrimeira linha\nSegunda linha',
  'karaoke.maker.loadLyricsFile': 'Carregar arquivo de letra',
  'karaoke.maker.lyricsFileLoaded': 'Letra carregada de {file}.',
  'karaoke.maker.lyricsRequired':
    'Adicione ou cole a letra completa antes de detectar o tempo e a melodia.',
  'karaoke.maker.detectTimingMelody': 'Detectar tempo e melodia',
  'karaoke.maker.continueInBackground': 'Continuar em segundo plano',
  'karaoke.maker.clearLyrics': 'Limpar letra',
  'karaoke.maker.clearLyricsTitle': 'Limpar toda a letra?',
  'karaoke.maker.clearLyricsBody':
    'Isso remove toda a letra e seus tempos. As notas da melodia permanecem, mas seus vínculos com palavras são removidos. É possível desfazer depois.',
  'karaoke.maker.clearNotes': 'Limpar notas',
  'karaoke.maker.clearNotesTitle': 'Limpar todas as notas da melodia?',
  'karaoke.maker.clearNotesBody':
    'Isso remove todas as notas da melodia e mantém a letra e o tempo das palavras. É possível desfazer depois.',
  'karaoke.maker.notesCleared': 'Todas as notas da melodia foram removidas.',
  'karaoke.maker.lyricsCleared':
    'Toda a letra foi removida. As notas existentes foram mantidas sem vínculos com palavras.',
  'karaoke.maker.replaceLyricsWarning':
    'As palavras mudaram. Substituí-las recria os identificadores e o tempo automático; as correções manuais existentes não podem ser transferidas com segurança. As notas permanecem e serão vinculadas novamente.',
  'karaoke.maker.replaceAndDetect': 'Substituir e detectar',
  'karaoke.maker.wordText': 'Palavra',
  'karaoke.maker.wordStart': 'Início (ms)',
  'karaoke.maker.wordPosition': 'Posição',
  'karaoke.maker.wordDuration': 'Duração (ms)',
  'karaoke.maker.wordTimingSliderHint':
    'Ajusta o limite compartilhado; a palavra vizinha cede ou recebe tempo sem alterar o intervalo da linha.',
  'karaoke.maker.usePlayhead': 'Usar cursor de reprodução',
  'karaoke.maker.playWord': 'Reproduzir palavra',
  'karaoke.maker.syllableEditorEyebrow': 'Editor de sílabas',
  'karaoke.maker.syllableEditorTitle': 'Dividir “{word}”',
  'karaoke.maker.syllableEditorHint':
    'Clique entre as letras para adicionar ou remover uma divisão silábica.',
  'karaoke.maker.syllableSplitPoint': 'Alternar divisão após “{text}”',
  'karaoke.maker.syllableEditorPreview': 'Sílabas resultantes',
  'karaoke.maker.applySyllableSplit': 'Aplicar divisão silábica',
  'karaoke.maker.allowAutoTiming': 'Permitir tempo automático',
  'karaoke.maker.lyricsNeedPreparation':
    'Nova letra aplicada. Escolha Preparar karaokê para detectar seu tempo.',
  'karaoke.maker.downloadPrepare': 'Baixar e preparar a letra',
  'karaoke.maker.downloadOverall': 'Download geral',
  'karaoke.maker.downloadFiles': '{complete} de {total} arquivos',
  'karaoke.maker.speechMemory': 'Memória do modelo de voz',
  'karaoke.maker.speechMemoryReady': 'Pronto na RAM',
  'karaoke.maker.speechMemoryCached': 'Em cache no disco',
  'karaoke.maker.speechMemoryMissing': 'Não baixado',
  'karaoke.maker.freeMemory': 'Liberar RAM agora',
  'karaoke.maker.memoryReleased':
    'O modelo de voz foi removido da RAM. Os arquivos baixados continuam em cache.',
  'karaoke.maker.memoryReleaseBusy':
    'O modelo de voz está ocupado e ainda não pode ser liberado.',
  'karaoke.maker.memoryAfterUse': 'Quando estiver ocioso',
  'karaoke.maker.memoryPolicy.ask': 'Perguntar',
  'karaoke.maker.memoryPolicy.auto': 'Liberar automaticamente',
  'karaoke.maker.memoryPolicy.keep': 'Manter carregado',
  'karaoke.maker.memoryAfter': 'Depois de',
  'karaoke.maker.memoryMinutes': '{count} min',
  'karaoke.maker.memoryPromptTitle': 'Liberar a memória do modelo de voz?',
  'karaoke.maker.memoryPromptBody':
    'O modelo de voz local está ocioso. Liberá-lo economiza RAM; seus arquivos continuam em cache para recarregar mais rápido.',
  'karaoke.maker.keepLoaded': 'Manter carregado',
};

export const makerWorkflowFr: MakerWorkflowDictionary = {
  'karaoke.maker.recordLines': 'Enregistrer les débuts de lignes',
  'karaoke.maker.syncLinesFromHere': 'Caler les lignes à partir d’ici',
  'karaoke.maker.syncWordsFromHere': 'Caler les mots à partir d’ici',
  'karaoke.maker.syncNow': 'Maintenant',
  'karaoke.maker.syncNext': 'Suivant : {item}',
  'karaoke.maker.markLine': 'Marquer le début',
  'karaoke.maker.markLineEnd': 'Marquer la fin',
  'karaoke.maker.captureEnd': 'Écoute de la fin',
  'karaoke.maker.capturePressStart': 'Étape 1 · Entrée au DÉBUT',
  'karaoke.maker.captureReplaceStart':
    'Paroles suivantes prêtes · Entrée remplace le DÉBUT',
  'karaoke.maker.captureStartSaved':
    'Début enregistré à {time} · Entrée à la FIN',
  'karaoke.maker.captureAutomaticStart':
    'Début automatique {time} · Entrée à la FIN',
  'karaoke.maker.captureAutomaticSuggestion':
    'Début suggéré {time} · Entrée enregistre le DÉBUT',
  'karaoke.maker.captureFixEnd': 'Ligne enregistrée · Entrée corrige la FIN',
  'karaoke.maker.captureStartPoint': 'DÉBUT',
  'karaoke.maker.captureEndPoint': 'FIN',
  'karaoke.maker.markWord': 'Marquer le mot',
  'karaoke.maker.done': 'Terminer',
  'karaoke.maker.ignoreLine': 'Ignorer la ligne',
  'karaoke.maker.lineTimingComplete':
    'Synchronisation des lignes terminée. Prête à vérifier et à utiliser dans le lecteur.',
  'karaoke.maker.recordLinesHint':
    'ENTRÉE marque début/fin · ↑/↓ choisit la ligne · ←/→ déplace seulement l’audio de 2 s · ESPACE lit ou met en pause · Retour arrière annule',
  'karaoke.maker.acceptLyrics': 'Accepter les paroles',
  'karaoke.maker.acceptAndRecordLines': 'Accepter et enregistrer les temps',
  'karaoke.maker.captureGuideTitle': 'Calage de ligne',
  'karaoke.maker.captureGuideNext': 'À suivre',
  'karaoke.maker.captureGuideAudio':
    'déplace l’audio de 2 secondes · Maj : 1 seconde',
  'karaoke.maker.captureGuideLyrics': 'choisit la ligne de paroles',
  'karaoke.maker.captureGuidePlayback': 'lit ou met en pause',
  'karaoke.maker.captureGuideUndo': 'annule le dernier repère',
  'karaoke.maker.repairLyrics': 'Redétecter le calage des paroles',
  'karaoke.maker.repairMelody': 'Redétecter les notes de la mélodie',
  'karaoke.maker.rebuildKaraoke': 'Reconstruire paroles + mélodie',
  'karaoke.maker.lyricsReferenceHint':
    'Fournissez les paroles complètes, y compris les lignes répétées et les repères comme [Couplet] ou [Refrain]. FluidEQ conserve ce texte et utilise la reconnaissance vocale locale pour trouver son calage.',
  'karaoke.maker.referenceLyrics': 'Paroles de référence',
  'karaoke.maker.wordTiming': 'Calage du mot',
  'karaoke.maker.lyricsWordCount': '{count} mots dans la référence',
  'karaoke.maker.lyricsTimedCount': '{timed} sur {total} calés',
  'karaoke.maker.lyricsApplyBeforeTiming':
    'Détectez les nouvelles paroles avant de modifier le calage des mots',
  'karaoke.maker.lyricsNoTimedWords': 'Aucun mot calé pour le moment',
  'karaoke.maker.lyricsTimingEditorHint':
    'Après la détection, sélectionnez un mot pour corriger son texte, son début ou sa durée.',
  'karaoke.maker.lyricsSelectWord':
    'Sélectionnez un mot pour modifier son calage.',
  'karaoke.maker.lyricsSelectedWord': 'Mot sélectionné',
  'karaoke.maker.lyricsWordNavigation': 'Navigation entre les mots',
  'karaoke.maker.previousWord': 'Mot précédent',
  'karaoke.maker.nextWord': 'Mot suivant',
  'karaoke.maker.lyricsPlaceholder':
    'Collez les paroles complètes ici…\n\n[Couplet]\nPremière ligne\nDeuxième ligne',
  'karaoke.maker.loadLyricsFile': 'Charger un fichier de paroles',
  'karaoke.maker.lyricsFileLoaded': 'Paroles chargées depuis {file}.',
  'karaoke.maker.lyricsRequired':
    'Ajoutez ou collez les paroles complètes avant de détecter le calage et la mélodie.',
  'karaoke.maker.detectTimingMelody': 'Détecter le calage et la mélodie',
  'karaoke.maker.continueInBackground': 'Continuer en arrière-plan',
  'karaoke.maker.clearLyrics': 'Effacer les paroles',
  'karaoke.maker.clearLyricsTitle': 'Effacer toutes les paroles ?',
  'karaoke.maker.clearLyricsBody':
    'Cela supprime toutes les paroles et leur calage. Les notes de mélodie restent, mais leurs liens avec les mots sont retirés. Une annulation reste possible.',
  'karaoke.maker.clearNotes': 'Effacer les notes',
  'karaoke.maker.clearNotesTitle': 'Effacer toutes les notes de mélodie ?',
  'karaoke.maker.clearNotesBody':
    'Cela supprime toutes les notes de mélodie en conservant les paroles et leur calage. Une annulation reste possible.',
  'karaoke.maker.notesCleared': 'Toutes les notes de mélodie ont été effacées.',
  'karaoke.maker.lyricsCleared':
    'Toutes les paroles ont été effacées. Les notes existantes ont été conservées sans lien avec les mots.',
  'karaoke.maker.replaceLyricsWarning':
    'Les mots ont changé. Leur remplacement recrée les identifiants et le calage automatique ; les corrections manuelles existantes ne peuvent pas être transférées de façon fiable. Les notes restent et seront reconnectées.',
  'karaoke.maker.replaceAndDetect': 'Remplacer et détecter',
  'karaoke.maker.wordText': 'Mot',
  'karaoke.maker.wordStart': 'Début (ms)',
  'karaoke.maker.wordPosition': 'Position',
  'karaoke.maker.wordDuration': 'Durée (ms)',
  'karaoke.maker.wordTimingSliderHint':
    'Ajuste la limite partagée : le mot voisin cède ou reçoit du temps sans modifier la plage de la ligne.',
  'karaoke.maker.usePlayhead': 'Utiliser la tête de lecture',
  'karaoke.maker.playWord': 'Lire le mot',
  'karaoke.maker.syllableEditorEyebrow': 'Éditeur de syllabes',
  'karaoke.maker.syllableEditorTitle': 'Diviser « {word} »',
  'karaoke.maker.syllableEditorHint':
    'Cliquez entre les lettres pour ajouter ou retirer une coupure syllabique.',
  'karaoke.maker.syllableSplitPoint': 'Basculer la coupure après « {text} »',
  'karaoke.maker.syllableEditorPreview': 'Syllabes obtenues',
  'karaoke.maker.applySyllableSplit': 'Appliquer la division',
  'karaoke.maker.allowAutoTiming': 'Autoriser le calage automatique',
  'karaoke.maker.lyricsNeedPreparation':
    'Nouvelles paroles appliquées. Choisissez Préparer le karaoké pour détecter leur calage.',
  'karaoke.maker.downloadPrepare': 'Télécharger et préparer les paroles',
  'karaoke.maker.downloadOverall': 'Téléchargement global',
  'karaoke.maker.downloadFiles': '{complete} fichiers sur {total}',
  'karaoke.maker.speechMemory': 'Mémoire du modèle vocal',
  'karaoke.maker.speechMemoryReady': 'Prêt en mémoire vive',
  'karaoke.maker.speechMemoryCached': 'En cache sur le disque',
  'karaoke.maker.speechMemoryMissing': 'Non téléchargé',
  'karaoke.maker.freeMemory': 'Libérer la mémoire vive',
  'karaoke.maker.memoryReleased':
    'Le modèle vocal a été retiré de la mémoire vive. Ses fichiers téléchargés restent en cache.',
  'karaoke.maker.memoryReleaseBusy':
    'Le modèle vocal est occupé et ne peut pas encore être libéré.',
  'karaoke.maker.memoryAfterUse': 'Lorsqu’il est inactif',
  'karaoke.maker.memoryPolicy.ask': 'Me demander',
  'karaoke.maker.memoryPolicy.auto': 'Libérer automatiquement',
  'karaoke.maker.memoryPolicy.keep': 'Garder chargé',
  'karaoke.maker.memoryAfter': 'Après',
  'karaoke.maker.memoryMinutes': '{count} min',
  'karaoke.maker.memoryPromptTitle': 'Libérer la mémoire du modèle vocal ?',
  'karaoke.maker.memoryPromptBody':
    'Le modèle vocal local est inactif. Le libérer économise la mémoire vive ; ses fichiers restent en cache pour un rechargement plus rapide.',
  'karaoke.maker.keepLoaded': 'Garder chargé',
};

export const makerWorkflowDe: MakerWorkflowDictionary = {
  'karaoke.maker.recordLines': 'Zeilenanfänge aufnehmen',
  'karaoke.maker.syncLinesFromHere': 'Zeilen ab hier synchronisieren',
  'karaoke.maker.syncWordsFromHere': 'Wörter ab hier synchronisieren',
  'karaoke.maker.syncNow': 'Jetzt',
  'karaoke.maker.syncNext': 'Als Nächstes: {item}',
  'karaoke.maker.markLine': 'Zeilenanfang markieren',
  'karaoke.maker.markLineEnd': 'Zeilenende markieren',
  'karaoke.maker.captureEnd': 'Auf Zeilenende achten',
  'karaoke.maker.capturePressStart': 'Schritt 1 · Enter beim START',
  'karaoke.maker.captureReplaceStart':
    'Nächste Zeile bereit · Enter ersetzt den START',
  'karaoke.maker.captureStartSaved':
    'Start bei {time} gespeichert · Enter beim ENDE',
  'karaoke.maker.captureAutomaticStart':
    'Automatischer Start {time} · Enter beim ENDE',
  'karaoke.maker.captureAutomaticSuggestion':
    'Startvorschlag {time} · Enter speichert den START',
  'karaoke.maker.captureFixEnd':
    'Zeile aufgenommen · Enter korrigiert das ENDE',
  'karaoke.maker.captureStartPoint': 'START',
  'karaoke.maker.captureEndPoint': 'ENDE',
  'karaoke.maker.markWord': 'Wort markieren',
  'karaoke.maker.done': 'Fertig',
  'karaoke.maker.ignoreLine': 'Zeile ignorieren',
  'karaoke.maker.lineTimingComplete':
    'Zeilensynchronisierung abgeschlossen. Bereit zum Prüfen und Abspielen.',
  'karaoke.maker.recordLinesHint':
    'ENTER markiert Start/Ende · ↑/↓ wählt die Zeile · ←/→ verschiebt nur das Audio um 2 s · LEERTASTE spielt oder pausiert · Rücktaste macht rückgängig',
  'karaoke.maker.acceptLyrics': 'Liedtext übernehmen',
  'karaoke.maker.acceptAndRecordLines': 'Übernehmen und Zeiten aufnehmen',
  'karaoke.maker.captureGuideTitle': 'Zeilen-Timing',
  'karaoke.maker.captureGuideNext': 'Als Nächstes',
  'karaoke.maker.captureGuideAudio':
    'Audio um 2 Sekunden verschieben · Umschalt: 1 Sekunde',
  'karaoke.maker.captureGuideLyrics': 'Liedtextzeile auswählen',
  'karaoke.maker.captureGuidePlayback': 'abspielen oder pausieren',
  'karaoke.maker.captureGuideUndo': 'letzte Markierung rückgängig',
  'karaoke.maker.repairLyrics': 'Liedtext-Timing neu erkennen',
  'karaoke.maker.repairMelody': 'Melodienoten neu erkennen',
  'karaoke.maker.rebuildKaraoke': 'Liedtext + Melodie neu erstellen',
  'karaoke.maker.lyricsReferenceHint':
    'Geben Sie den vollständigen Liedtext einschließlich Wiederholungen und Markierungen wie [Strophe] oder [Refrain] an. FluidEQ behält diesen Text und ermittelt sein Timing mit lokaler Spracherkennung.',
  'karaoke.maker.referenceLyrics': 'Referenz-Liedtext',
  'karaoke.maker.wordTiming': 'Wort-Timing',
  'karaoke.maker.lyricsWordCount': '{count} Wörter in der Vorlage',
  'karaoke.maker.lyricsTimedCount': '{timed} von {total} zeitlich zugeordnet',
  'karaoke.maker.lyricsApplyBeforeTiming':
    'Erkennen Sie den neuen Liedtext, bevor Sie das Wort-Timing bearbeiten',
  'karaoke.maker.lyricsNoTimedWords': 'Noch keine Wörter zeitlich zugeordnet',
  'karaoke.maker.lyricsTimingEditorHint':
    'Wählen Sie nach der Erkennung ein Wort aus, um Text, Startzeit oder Länge zu korrigieren.',
  'karaoke.maker.lyricsSelectWord':
    'Wählen Sie ein Wort aus, um sein Timing zu bearbeiten.',
  'karaoke.maker.lyricsSelectedWord': 'Ausgewähltes Wort',
  'karaoke.maker.lyricsWordNavigation': 'Wortnavigation',
  'karaoke.maker.previousWord': 'Vorheriges Wort',
  'karaoke.maker.nextWord': 'Nächstes Wort',
  'karaoke.maker.lyricsPlaceholder':
    'Vollständigen Liedtext hier einfügen…\n\n[Strophe]\nErste Zeile\nZweite Zeile',
  'karaoke.maker.loadLyricsFile': 'Liedtextdatei laden',
  'karaoke.maker.lyricsFileLoaded': 'Liedtext aus {file} geladen.',
  'karaoke.maker.lyricsRequired':
    'Fügen Sie den vollständigen Liedtext hinzu, bevor Timing und Melodie erkannt werden.',
  'karaoke.maker.detectTimingMelody': 'Timing und Melodie erkennen',
  'karaoke.maker.continueInBackground': 'Im Hintergrund fortsetzen',
  'karaoke.maker.clearLyrics': 'Liedtext löschen',
  'karaoke.maker.clearLyricsTitle': 'Gesamten Liedtext löschen?',
  'karaoke.maker.clearLyricsBody':
    'Dadurch werden der gesamte Liedtext und sein Timing entfernt. Melodienoten bleiben erhalten, ihre Wortverknüpfungen werden jedoch gelöst. Danach kann rückgängig gemacht werden.',
  'karaoke.maker.clearNotes': 'Noten löschen',
  'karaoke.maker.clearNotesTitle': 'Alle Melodienoten löschen?',
  'karaoke.maker.clearNotesBody':
    'Dadurch werden alle Melodienoten entfernt, Liedtext und Wort-Timing bleiben erhalten. Danach kann rückgängig gemacht werden.',
  'karaoke.maker.notesCleared': 'Alle Melodienoten wurden gelöscht.',
  'karaoke.maker.lyricsCleared':
    'Der gesamte Liedtext wurde gelöscht. Vorhandene Noten blieben ohne Wortverknüpfung erhalten.',
  'karaoke.maker.replaceLyricsWarning':
    'Die Wörter wurden geändert. Beim Ersetzen werden Wort-IDs und automatisches Timing neu erstellt; vorhandene manuelle Korrekturen können nicht zuverlässig übertragen werden. Die Noten bleiben erhalten und werden neu verknüpft.',
  'karaoke.maker.replaceAndDetect': 'Ersetzen und erkennen',
  'karaoke.maker.wordText': 'Wort',
  'karaoke.maker.wordStart': 'Start (ms)',
  'karaoke.maker.wordPosition': 'Position',
  'karaoke.maker.wordDuration': 'Länge (ms)',
  'karaoke.maker.wordTimingSliderHint':
    'Passt die gemeinsame Grenze an; das Nachbarwort gibt Zeit ab oder erhält sie, während der Zeilenbereich gleich bleibt.',
  'karaoke.maker.usePlayhead': 'Abspielposition verwenden',
  'karaoke.maker.playWord': 'Wort abspielen',
  'karaoke.maker.syllableEditorEyebrow': 'Silbeneditor',
  'karaoke.maker.syllableEditorTitle': '„{word}“ teilen',
  'karaoke.maker.syllableEditorHint':
    'Zwischen Buchstaben klicken, um eine Silbengrenze zu setzen oder zu entfernen.',
  'karaoke.maker.syllableSplitPoint': 'Trennung nach „{text}“ umschalten',
  'karaoke.maker.syllableEditorPreview': 'Ergebnis-Silben',
  'karaoke.maker.applySyllableSplit': 'Silbentrennung anwenden',
  'karaoke.maker.allowAutoTiming': 'Automatisches Timing erlauben',
  'karaoke.maker.lyricsNeedPreparation':
    'Neuer Liedtext angewendet. Wählen Sie Karaoke vorbereiten, um das Timing zu erkennen.',
  'karaoke.maker.downloadPrepare': 'Herunterladen und Liedtext vorbereiten',
  'karaoke.maker.downloadOverall': 'Gesamtdownload',
  'karaoke.maker.downloadFiles': '{complete} von {total} Dateien',
  'karaoke.maker.speechMemory': 'Speicher des Sprachmodells',
  'karaoke.maker.speechMemoryReady': 'Im Arbeitsspeicher bereit',
  'karaoke.maker.speechMemoryCached': 'Auf Datenträger zwischengespeichert',
  'karaoke.maker.speechMemoryMissing': 'Nicht heruntergeladen',
  'karaoke.maker.freeMemory': 'Arbeitsspeicher jetzt freigeben',
  'karaoke.maker.memoryReleased':
    'Das Sprachmodell wurde aus dem Arbeitsspeicher entfernt. Die heruntergeladenen Dateien bleiben zwischengespeichert.',
  'karaoke.maker.memoryReleaseBusy':
    'Das Sprachmodell ist beschäftigt und kann noch nicht freigegeben werden.',
  'karaoke.maker.memoryAfterUse': 'Wenn es inaktiv ist',
  'karaoke.maker.memoryPolicy.ask': 'Nachfragen',
  'karaoke.maker.memoryPolicy.auto': 'Automatisch freigeben',
  'karaoke.maker.memoryPolicy.keep': 'Geladen lassen',
  'karaoke.maker.memoryAfter': 'Nach',
  'karaoke.maker.memoryMinutes': '{count} Min.',
  'karaoke.maker.memoryPromptTitle': 'Speicher des Sprachmodells freigeben?',
  'karaoke.maker.memoryPromptBody':
    'Das lokale Sprachmodell ist inaktiv. Das Freigeben spart Arbeitsspeicher; seine Dateien bleiben für ein schnelleres Neuladen zwischengespeichert.',
  'karaoke.maker.keepLoaded': 'Geladen lassen',
};

export const makerWorkflowIt: MakerWorkflowDictionary = {
  'karaoke.maker.recordLines': 'Registra gli inizi delle righe',
  'karaoke.maker.syncLinesFromHere': 'Sincronizza righe da qui',
  'karaoke.maker.syncWordsFromHere': 'Sincronizza parole da qui',
  'karaoke.maker.syncNow': 'Adesso',
  'karaoke.maker.syncNext': 'Prossima: {item}',
  'karaoke.maker.markLine': 'Segna inizio riga',
  'karaoke.maker.markLineEnd': 'Segna fine riga',
  'karaoke.maker.captureEnd': 'In ascolto della fine',
  'karaoke.maker.capturePressStart': 'Passo 1 · Invio all’INIZIO',
  'karaoke.maker.captureReplaceStart':
    'Testo successivo pronto · Invio sostituisce l’INIZIO',
  'karaoke.maker.captureStartSaved':
    'Inizio salvato a {time} · Invio alla FINE',
  'karaoke.maker.captureAutomaticStart':
    'Inizio automatico {time} · Invio alla FINE',
  'karaoke.maker.captureAutomaticSuggestion':
    'Inizio suggerito {time} · Invio registra l’INIZIO',
  'karaoke.maker.captureFixEnd': 'Riga registrata · Invio corregge la FINE',
  'karaoke.maker.captureStartPoint': 'INIZIO',
  'karaoke.maker.captureEndPoint': 'FINE',
  'karaoke.maker.markWord': 'Segna parola',
  'karaoke.maker.done': 'Fine',
  'karaoke.maker.ignoreLine': 'Ignora riga',
  'karaoke.maker.lineTimingComplete':
    'Sincronizzazione delle righe completata. Pronta da verificare e usare nel player.',
  'karaoke.maker.recordLinesHint':
    'INVIO segna inizio/fine · ↑/↓ sceglie la riga · ←/→ sposta solo l’audio di 2 s · SPAZIO riproduce o mette in pausa · Backspace annulla',
  'karaoke.maker.acceptLyrics': 'Accetta testo',
  'karaoke.maker.acceptAndRecordLines': 'Accetta e registra i tempi',
  'karaoke.maker.captureGuideTitle': 'Tempi della riga',
  'karaoke.maker.captureGuideNext': 'Prossima',
  'karaoke.maker.captureGuideAudio':
    'sposta l’audio di 2 secondi · Maiusc: 1 secondo',
  'karaoke.maker.captureGuideLyrics': 'scegli la riga del testo',
  'karaoke.maker.captureGuidePlayback': 'riproduci o metti in pausa',
  'karaoke.maker.captureGuideUndo': 'annulla l’ultimo segno',
  'karaoke.maker.repairLyrics': 'Rileva di nuovo i tempi del testo',
  'karaoke.maker.repairMelody': 'Rileva di nuovo le note della melodia',
  'karaoke.maker.rebuildKaraoke': 'Ricrea testo + melodia',
  'karaoke.maker.lyricsReferenceHint':
    'Fornisci il testo completo, incluse le righe ripetute e indicatori come [Strofa] o [Ritornello]. FluidEQ conserva questo testo e usa il riconoscimento vocale locale per trovarne i tempi.',
  'karaoke.maker.referenceLyrics': 'Testo di riferimento',
  'karaoke.maker.wordTiming': 'Tempo della parola',
  'karaoke.maker.lyricsWordCount': '{count} parole nel riferimento',
  'karaoke.maker.lyricsTimedCount': '{timed} di {total} temporizzate',
  'karaoke.maker.lyricsApplyBeforeTiming':
    'Rileva il nuovo testo prima di modificare i tempi delle parole',
  'karaoke.maker.lyricsNoTimedWords': 'Nessuna parola temporizzata',
  'karaoke.maker.lyricsTimingEditorHint':
    'Dopo il rilevamento, seleziona una parola per correggerne il testo, l’inizio o la durata.',
  'karaoke.maker.lyricsSelectWord':
    'Seleziona una parola per modificarne il tempo.',
  'karaoke.maker.lyricsSelectedWord': 'Parola selezionata',
  'karaoke.maker.lyricsWordNavigation': 'Navigazione tra le parole',
  'karaoke.maker.previousWord': 'Parola precedente',
  'karaoke.maker.nextWord': 'Parola successiva',
  'karaoke.maker.lyricsPlaceholder':
    'Incolla qui il testo completo…\n\n[Strofa]\nPrima riga\nSeconda riga',
  'karaoke.maker.loadLyricsFile': 'Carica file di testo',
  'karaoke.maker.lyricsFileLoaded': 'Testo caricato da {file}.',
  'karaoke.maker.lyricsRequired':
    'Aggiungi o incolla il testo completo prima di rilevare tempi e melodia.',
  'karaoke.maker.detectTimingMelody': 'Rileva tempi e melodia',
  'karaoke.maker.continueInBackground': 'Continua in background',
  'karaoke.maker.clearLyrics': 'Cancella testo',
  'karaoke.maker.clearLyricsTitle': 'Cancellare tutto il testo?',
  'karaoke.maker.clearLyricsBody':
    'Rimuove tutto il testo e i relativi tempi. Le note della melodia restano, ma i collegamenti alle parole vengono rimossi. È possibile annullare dopo la cancellazione.',
  'karaoke.maker.clearNotes': 'Cancella note',
  'karaoke.maker.clearNotesTitle': 'Cancellare tutte le note della melodia?',
  'karaoke.maker.clearNotesBody':
    'Rimuove tutte le note della melodia mantenendo testo e tempi delle parole. È possibile annullare dopo la cancellazione.',
  'karaoke.maker.notesCleared':
    'Tutte le note della melodia sono state cancellate.',
  'karaoke.maker.lyricsCleared':
    'Tutto il testo è stato cancellato. Le note esistenti sono state mantenute senza collegamenti alle parole.',
  'karaoke.maker.replaceLyricsWarning':
    'Le parole sono cambiate. La sostituzione ricrea gli ID e i tempi automatici; le correzioni manuali esistenti non possono essere trasferite in modo affidabile. Le note restano e verranno ricollegate.',
  'karaoke.maker.replaceAndDetect': 'Sostituisci e rileva',
  'karaoke.maker.wordText': 'Parola',
  'karaoke.maker.wordStart': 'Inizio (ms)',
  'karaoke.maker.wordPosition': 'Posizione',
  'karaoke.maker.wordDuration': 'Durata (ms)',
  'karaoke.maker.wordTimingSliderHint':
    'Regola il confine condiviso: la parola vicina cede o riceve tempo senza modificare l’intervallo della riga.',
  'karaoke.maker.usePlayhead': 'Usa testina di riproduzione',
  'karaoke.maker.playWord': 'Riproduci parola',
  'karaoke.maker.syllableEditorEyebrow': 'Editor sillabe',
  'karaoke.maker.syllableEditorTitle': 'Dividi “{word}”',
  'karaoke.maker.syllableEditorHint':
    'Fai clic tra le lettere per aggiungere o rimuovere una divisione sillabica.',
  'karaoke.maker.syllableSplitPoint': 'Cambia divisione dopo “{text}”',
  'karaoke.maker.syllableEditorPreview': 'Sillabe risultanti',
  'karaoke.maker.applySyllableSplit': 'Applica divisione',
  'karaoke.maker.allowAutoTiming': 'Consenti temporizzazione automatica',
  'karaoke.maker.lyricsNeedPreparation':
    'Nuovo testo applicato. Scegli Prepara karaoke per rilevarne i tempi.',
  'karaoke.maker.downloadPrepare': 'Scarica e prepara il testo',
  'karaoke.maker.downloadOverall': 'Download complessivo',
  'karaoke.maker.downloadFiles': '{complete} di {total} file',
  'karaoke.maker.speechMemory': 'Memoria del modello vocale',
  'karaoke.maker.speechMemoryReady': 'Pronto nella RAM',
  'karaoke.maker.speechMemoryCached': 'In cache sul disco',
  'karaoke.maker.speechMemoryMissing': 'Non scaricato',
  'karaoke.maker.freeMemory': 'Libera la RAM ora',
  'karaoke.maker.memoryReleased':
    'Il modello vocale è stato rimosso dalla RAM. I file scaricati restano in cache.',
  'karaoke.maker.memoryReleaseBusy':
    'Il modello vocale è occupato e non può ancora essere liberato.',
  'karaoke.maker.memoryAfterUse': 'Quando è inattivo',
  'karaoke.maker.memoryPolicy.ask': 'Chiedi',
  'karaoke.maker.memoryPolicy.auto': 'Libera automaticamente',
  'karaoke.maker.memoryPolicy.keep': 'Mantieni caricato',
  'karaoke.maker.memoryAfter': 'Dopo',
  'karaoke.maker.memoryMinutes': '{count} min',
  'karaoke.maker.memoryPromptTitle': 'Liberare la memoria del modello vocale?',
  'karaoke.maker.memoryPromptBody':
    'Il modello vocale locale è inattivo. Liberarlo consente di risparmiare RAM; i suoi file restano in cache per un caricamento più rapido.',
  'karaoke.maker.keepLoaded': 'Mantieni caricato',
};

export const makerWorkflowRu: MakerWorkflowDictionary = {
  'karaoke.maker.recordLines': 'Записать начала строк',
  'karaoke.maker.syncLinesFromHere': 'Синхронизировать строки отсюда',
  'karaoke.maker.syncWordsFromHere': 'Синхронизировать слова отсюда',
  'karaoke.maker.syncNow': 'Сейчас',
  'karaoke.maker.syncNext': 'Далее: {item}',
  'karaoke.maker.markLine': 'Отметить начало строки',
  'karaoke.maker.markLineEnd': 'Отметить конец строки',
  'karaoke.maker.captureEnd': 'Ожидание конца',
  'karaoke.maker.capturePressStart': 'Шаг 1 · Enter в НАЧАЛЕ',
  'karaoke.maker.captureReplaceStart':
    'Следующая строка готова · Enter заменит НАЧАЛО',
  'karaoke.maker.captureStartSaved':
    'Начало сохранено в {time} · Enter в КОНЦЕ',
  'karaoke.maker.captureAutomaticStart':
    'Автоматическое начало {time} · Enter в КОНЦЕ',
  'karaoke.maker.captureAutomaticSuggestion':
    'Предложенное начало {time} · Enter записывает НАЧАЛО',
  'karaoke.maker.captureFixEnd': 'Строка записана · Enter исправляет КОНЕЦ',
  'karaoke.maker.captureStartPoint': 'НАЧАЛО',
  'karaoke.maker.captureEndPoint': 'КОНЕЦ',
  'karaoke.maker.markWord': 'Отметить слово',
  'karaoke.maker.done': 'Готово',
  'karaoke.maker.ignoreLine': 'Пропустить строку',
  'karaoke.maker.lineTimingComplete':
    'Синхронизация строк завершена. Можно проверить и использовать в проигрывателе.',
  'karaoke.maker.recordLinesHint':
    'ENTER отмечает начало/конец · ↑/↓ выбирает строку · ←/→ двигает только аудио на 2 с · ПРОБЕЛ запускает или ставит на паузу · Backspace отменяет',
  'karaoke.maker.acceptLyrics': 'Принять текст',
  'karaoke.maker.acceptAndRecordLines': 'Принять и записать время',
  'karaoke.maker.captureGuideTitle': 'Тайминг строки',
  'karaoke.maker.captureGuideNext': 'Далее',
  'karaoke.maker.captureGuideAudio':
    'сдвигает аудио на 2 секунды · Shift: 1 секунда',
  'karaoke.maker.captureGuideLyrics': 'выбирает строку текста',
  'karaoke.maker.captureGuidePlayback': 'воспроизводит или ставит на паузу',
  'karaoke.maker.captureGuideUndo': 'отменяет последнюю метку',
  'karaoke.maker.repairLyrics': 'Повторно определить время текста',
  'karaoke.maker.repairMelody': 'Повторно определить ноты мелодии',
  'karaoke.maker.rebuildKaraoke': 'Пересоздать текст + мелодию',
  'karaoke.maker.lyricsReferenceHint':
    'Укажите полный текст, включая повторяющиеся строки и метки вроде [Куплет] или [Припев]. FluidEQ сохраняет этот текст и использует локальное распознавание речи для определения времени.',
  'karaoke.maker.referenceLyrics': 'Эталонный текст',
  'karaoke.maker.wordTiming': 'Время слова',
  'karaoke.maker.lyricsWordCount': '{count} слов в тексте',
  'karaoke.maker.lyricsTimedCount': '{timed} из {total} с временем',
  'karaoke.maker.lyricsApplyBeforeTiming':
    'Определите новый текст перед редактированием времени слов',
  'karaoke.maker.lyricsNoTimedWords': 'Слов с временем пока нет',
  'karaoke.maker.lyricsTimingEditorHint':
    'После определения выберите слово, чтобы исправить его текст, начало или длительность.',
  'karaoke.maker.lyricsSelectWord': 'Выберите слово для изменения его времени.',
  'karaoke.maker.lyricsSelectedWord': 'Выбранное слово',
  'karaoke.maker.lyricsWordNavigation': 'Навигация по словам',
  'karaoke.maker.previousWord': 'Предыдущее слово',
  'karaoke.maker.nextWord': 'Следующее слово',
  'karaoke.maker.lyricsPlaceholder':
    'Вставьте полный текст здесь…\n\n[Куплет]\nПервая строка\nВторая строка',
  'karaoke.maker.loadLyricsFile': 'Загрузить файл текста',
  'karaoke.maker.lyricsFileLoaded': 'Текст загружен из {file}.',
  'karaoke.maker.lyricsRequired':
    'Добавьте или вставьте полный текст перед определением времени и мелодии.',
  'karaoke.maker.detectTimingMelody': 'Определить время и мелодию',
  'karaoke.maker.continueInBackground': 'Продолжить в фоне',
  'karaoke.maker.clearLyrics': 'Очистить текст',
  'karaoke.maker.clearLyricsTitle': 'Очистить весь текст?',
  'karaoke.maker.clearLyricsBody':
    'Это удалит весь текст и его время. Ноты мелодии останутся, но связи со словами будут удалены. Действие можно отменить.',
  'karaoke.maker.clearNotes': 'Очистить ноты',
  'karaoke.maker.clearNotesTitle': 'Очистить все ноты мелодии?',
  'karaoke.maker.clearNotesBody':
    'Это удалит все ноты мелодии, сохранив текст и время слов. Действие можно отменить.',
  'karaoke.maker.notesCleared': 'Все ноты мелодии удалены.',
  'karaoke.maker.lyricsCleared':
    'Весь текст удалён. Существующие ноты сохранены без связей со словами.',
  'karaoke.maker.replaceLyricsWarning':
    'Слова изменились. Замена пересоздаст идентификаторы и автоматическое время; существующие ручные исправления нельзя надёжно перенести. Ноты останутся и будут привязаны заново.',
  'karaoke.maker.replaceAndDetect': 'Заменить и определить',
  'karaoke.maker.wordText': 'Слово',
  'karaoke.maker.wordStart': 'Начало (мс)',
  'karaoke.maker.wordPosition': 'Позиция',
  'karaoke.maker.wordDuration': 'Длительность (мс)',
  'karaoke.maker.wordTimingSliderHint':
    'Изменяет общую границу: соседнее слово отдаёт или получает время, а диапазон строки остаётся неизменным.',
  'karaoke.maker.usePlayhead': 'Использовать позицию воспроизведения',
  'karaoke.maker.playWord': 'Воспроизвести слово',
  'karaoke.maker.syllableEditorEyebrow': 'Редактор слогов',
  'karaoke.maker.syllableEditorTitle': 'Разделить «{word}»',
  'karaoke.maker.syllableEditorHint':
    'Нажмите между буквами, чтобы добавить или убрать границу слога.',
  'karaoke.maker.syllableSplitPoint': 'Переключить границу после «{text}»',
  'karaoke.maker.syllableEditorPreview': 'Полученные слоги',
  'karaoke.maker.applySyllableSplit': 'Применить деление',
  'karaoke.maker.allowAutoTiming': 'Разрешить автоматическое время',
  'karaoke.maker.lyricsNeedPreparation':
    'Новый текст применён. Выберите Подготовить караоке, чтобы определить его время.',
  'karaoke.maker.downloadPrepare': 'Скачать и подготовить текст',
  'karaoke.maker.downloadOverall': 'Общая загрузка',
  'karaoke.maker.downloadFiles': '{complete} из {total} файлов',
  'karaoke.maker.speechMemory': 'Память речевой модели',
  'karaoke.maker.speechMemoryReady': 'Готова в ОЗУ',
  'karaoke.maker.speechMemoryCached': 'Сохранена на диске',
  'karaoke.maker.speechMemoryMissing': 'Не загружена',
  'karaoke.maker.freeMemory': 'Освободить ОЗУ сейчас',
  'karaoke.maker.memoryReleased':
    'Речевая модель удалена из ОЗУ. Загруженные файлы остались в кэше.',
  'karaoke.maker.memoryReleaseBusy':
    'Речевая модель занята и пока не может быть выгружена.',
  'karaoke.maker.memoryAfterUse': 'Когда модель не используется',
  'karaoke.maker.memoryPolicy.ask': 'Спрашивать',
  'karaoke.maker.memoryPolicy.auto': 'Выгружать автоматически',
  'karaoke.maker.memoryPolicy.keep': 'Оставлять загруженной',
  'karaoke.maker.memoryAfter': 'Через',
  'karaoke.maker.memoryMinutes': '{count} мин',
  'karaoke.maker.memoryPromptTitle': 'Освободить память речевой модели?',
  'karaoke.maker.memoryPromptBody':
    'Локальная речевая модель не используется. Её выгрузка освободит ОЗУ; файлы останутся в кэше для быстрой повторной загрузки.',
  'karaoke.maker.keepLoaded': 'Оставить загруженной',
};

export const makerWorkflowZh: MakerWorkflowDictionary = {
  'karaoke.maker.recordLines': '录制歌词行起点',
  'karaoke.maker.syncLinesFromHere': '从这里同步歌词行',
  'karaoke.maker.syncWordsFromHere': '从这里同步词语',
  'karaoke.maker.syncNow': '现在',
  'karaoke.maker.syncNext': '下一项：{item}',
  'karaoke.maker.markLine': '标记行开始',
  'karaoke.maker.markLineEnd': '标记行结束',
  'karaoke.maker.captureEnd': '等待结束位置',
  'karaoke.maker.capturePressStart': '步骤 1 · 在开始处按 Enter',
  'karaoke.maker.captureReplaceStart': '下一行已就绪 · Enter 替换开始位置',
  'karaoke.maker.captureStartSaved':
    '开始位置已保存于 {time} · 在结束处按 Enter',
  'karaoke.maker.captureAutomaticStart':
    '自动开始位置 {time} · 在结束处按 Enter',
  'karaoke.maker.captureAutomaticSuggestion':
    '建议开始位置 {time} · Enter 记录开始位置',
  'karaoke.maker.captureFixEnd': '歌词行已录制 · Enter 修正结束位置',
  'karaoke.maker.captureStartPoint': '开始',
  'karaoke.maker.captureEndPoint': '结束',
  'karaoke.maker.markWord': '标记词语',
  'karaoke.maker.done': '完成',
  'karaoke.maker.ignoreLine': '忽略此行',
  'karaoke.maker.lineTimingComplete':
    '歌词行计时已完成，可以检查并在播放器中使用。',
  'karaoke.maker.recordLinesHint':
    'ENTER 标记开始/结束 · ↑/↓ 选择歌词行 · ←/→ 仅移动音频 2 秒 · 空格播放或暂停 · Backspace 撤销',
  'karaoke.maker.acceptLyrics': '接受歌词',
  'karaoke.maker.acceptAndRecordLines': '接受并录制时间',
  'karaoke.maker.captureGuideTitle': '行定时',
  'karaoke.maker.captureGuideNext': '接下来',
  'karaoke.maker.captureGuideAudio': '移动音频 2 秒 · Shift：1 秒',
  'karaoke.maker.captureGuideLyrics': '选择歌词行',
  'karaoke.maker.captureGuidePlayback': '播放或暂停',
  'karaoke.maker.captureGuideUndo': '撤销上一个标记',
  'karaoke.maker.repairLyrics': '重新检测歌词时间',
  'karaoke.maker.repairMelody': '重新检测旋律音符',
  'karaoke.maker.rebuildKaraoke': '重建歌词和旋律',
  'karaoke.maker.lyricsReferenceHint':
    '请提供完整歌词，包括重复行以及 [主歌]、[副歌] 等标记。FluidEQ 会保留这些文字，并使用本地语音识别查找时间。',
  'karaoke.maker.referenceLyrics': '参考歌词',
  'karaoke.maker.wordTiming': '词语时间',
  'karaoke.maker.lyricsWordCount': '参考中有 {count} 个词',
  'karaoke.maker.lyricsTimedCount': '已定时 {timed}/{total}',
  'karaoke.maker.lyricsApplyBeforeTiming': '编辑词语时间前请先检测新歌词',
  'karaoke.maker.lyricsNoTimedWords': '尚无已定时词语',
  'karaoke.maker.lyricsTimingEditorHint':
    '检测后，选择任意词语以修正文字、开始时间或长度。',
  'karaoke.maker.lyricsSelectWord': '选择一个词语以编辑其时间。',
  'karaoke.maker.lyricsSelectedWord': '已选词语',
  'karaoke.maker.lyricsWordNavigation': '词语导航',
  'karaoke.maker.previousWord': '上一个词',
  'karaoke.maker.nextWord': '下一个词',
  'karaoke.maker.lyricsPlaceholder':
    '在此粘贴完整歌词…\n\n[主歌]\n第一行\n第二行',
  'karaoke.maker.loadLyricsFile': '加载歌词文件',
  'karaoke.maker.lyricsFileLoaded': '已从 {file} 加载歌词。',
  'karaoke.maker.lyricsRequired': '检测时间和旋律前，请添加或粘贴完整歌词。',
  'karaoke.maker.detectTimingMelody': '检测时间和旋律',
  'karaoke.maker.continueInBackground': '在后台继续',
  'karaoke.maker.clearLyrics': '清除歌词',
  'karaoke.maker.clearLyricsTitle': '清除全部歌词？',
  'karaoke.maker.clearLyricsBody':
    '这会删除所有歌词及其时间。旋律音符会保留，但会移除与词语的关联。清除后可以撤销。',
  'karaoke.maker.clearNotes': '清除音符',
  'karaoke.maker.clearNotesTitle': '清除全部旋律音符？',
  'karaoke.maker.clearNotesBody':
    '这会删除全部旋律音符，并保留歌词和词语时间。清除后可以撤销。',
  'karaoke.maker.notesCleared': '已清除全部旋律音符。',
  'karaoke.maker.lyricsCleared':
    '已清除全部歌词。现有音符已保留但不再关联词语。',
  'karaoke.maker.replaceLyricsWarning':
    '文字已更改。替换会重建词语 ID 和自动时间；现有手动修正无法可靠转移。音符会保留并重新关联。',
  'karaoke.maker.replaceAndDetect': '替换并检测',
  'karaoke.maker.wordText': '词语',
  'karaoke.maker.wordStart': '开始（毫秒）',
  'karaoke.maker.wordPosition': '位置',
  'karaoke.maker.wordDuration': '长度（毫秒）',
  'karaoke.maker.wordTimingSliderHint':
    '调整共享边界；相邻单词让出或获得时间，而整行范围保持不变。',
  'karaoke.maker.usePlayhead': '使用播放位置',
  'karaoke.maker.playWord': '播放单词',
  'karaoke.maker.syllableEditorEyebrow': '音节编辑器',
  'karaoke.maker.syllableEditorTitle': '拆分“{word}”',
  'karaoke.maker.syllableEditorHint': '点击字母之间以添加或移除音节分隔。',
  'karaoke.maker.syllableSplitPoint': '切换“{text}”之后的分隔',
  'karaoke.maker.syllableEditorPreview': '拆分后的音节',
  'karaoke.maker.applySyllableSplit': '应用音节拆分',
  'karaoke.maker.allowAutoTiming': '允许自动定时',
  'karaoke.maker.lyricsNeedPreparation':
    '已应用新歌词。请选择“准备卡拉 OK”以检测其时间。',
  'karaoke.maker.downloadPrepare': '下载并准备歌词',
  'karaoke.maker.downloadOverall': '总体下载',
  'karaoke.maker.downloadFiles': '已完成 {complete}/{total} 个文件',
  'karaoke.maker.speechMemory': '语音模型内存',
  'karaoke.maker.speechMemoryReady': '已在内存中就绪',
  'karaoke.maker.speechMemoryCached': '已缓存到磁盘',
  'karaoke.maker.speechMemoryMissing': '尚未下载',
  'karaoke.maker.freeMemory': '立即释放内存',
  'karaoke.maker.memoryReleased':
    '语音模型已从内存释放。下载文件仍保留在缓存中。',
  'karaoke.maker.memoryReleaseBusy': '语音模型正在使用，暂时无法释放。',
  'karaoke.maker.memoryAfterUse': '空闲时',
  'karaoke.maker.memoryPolicy.ask': '询问我',
  'karaoke.maker.memoryPolicy.auto': '自动释放',
  'karaoke.maker.memoryPolicy.keep': '保持加载',
  'karaoke.maker.memoryAfter': '经过',
  'karaoke.maker.memoryMinutes': '{count} 分钟',
  'karaoke.maker.memoryPromptTitle': '释放语音模型内存？',
  'karaoke.maker.memoryPromptBody':
    '本地语音模型处于空闲状态。释放它可以节省内存；文件仍会缓存，以便更快重新加载。',
  'karaoke.maker.keepLoaded': '保持加载',
};

export const makerWorkflowJa: MakerWorkflowDictionary = {
  'karaoke.maker.recordLines': '行の開始位置を記録',
  'karaoke.maker.syncLinesFromHere': 'ここから行を同期',
  'karaoke.maker.syncWordsFromHere': 'ここから単語を同期',
  'karaoke.maker.syncNow': '現在',
  'karaoke.maker.syncNext': '次: {item}',
  'karaoke.maker.markLine': '行の開始をマーク',
  'karaoke.maker.markLineEnd': '行の終了をマーク',
  'karaoke.maker.captureEnd': '終了位置を待機中',
  'karaoke.maker.capturePressStart': '手順 1 · 開始時に Enter',
  'karaoke.maker.captureReplaceStart':
    '次の歌詞を表示中 · Enter で開始位置を置換',
  'karaoke.maker.captureStartSaved': '{time} に開始を保存 · 終了時に Enter',
  'karaoke.maker.captureAutomaticStart': '自動開始 {time} · 終了時に Enter',
  'karaoke.maker.captureAutomaticSuggestion':
    '開始候補 {time} · Enter で開始を記録',
  'karaoke.maker.captureFixEnd': '記録済み行 · Enter で終了を修正',
  'karaoke.maker.captureStartPoint': '開始',
  'karaoke.maker.captureEndPoint': '終了',
  'karaoke.maker.markWord': '単語をマーク',
  'karaoke.maker.done': '完了',
  'karaoke.maker.ignoreLine': '行を無視',
  'karaoke.maker.lineTimingComplete':
    '歌詞行のタイミングが完了しました。確認してプレーヤーで使用できます。',
  'karaoke.maker.recordLinesHint':
    'ENTER で開始/終了 · ↑/↓ で歌詞行を選択 · ←/→ は音声だけを2秒移動 · SPACE で再生/一時停止 · Backspace で元に戻す',
  'karaoke.maker.acceptLyrics': '歌詞を適用',
  'karaoke.maker.acceptAndRecordLines': '適用して時間を記録',
  'karaoke.maker.captureGuideTitle': '行タイミング',
  'karaoke.maker.captureGuideNext': '次の行',
  'karaoke.maker.captureGuideAudio': '音声を2秒移動 · Shift：1秒',
  'karaoke.maker.captureGuideLyrics': '歌詞行を選択',
  'karaoke.maker.captureGuidePlayback': '再生または一時停止',
  'karaoke.maker.captureGuideUndo': '最後のマークを元に戻す',
  'karaoke.maker.repairLyrics': '歌詞タイミングを再検出',
  'karaoke.maker.repairMelody': 'メロディーノートを再検出',
  'karaoke.maker.rebuildKaraoke': '歌詞とメロディーを再構築',
  'karaoke.maker.lyricsReferenceHint':
    '[Verse] や [Chorus] などのマーカーと繰り返し行を含む完全な歌詞を入力してください。FluidEQ はこのテキストを保持し、ローカル音声認識でタイミングを検出します。',
  'karaoke.maker.referenceLyrics': '参照歌詞',
  'karaoke.maker.wordTiming': '単語タイミング',
  'karaoke.maker.lyricsWordCount': '参照歌詞は {count} 語',
  'karaoke.maker.lyricsTimedCount': '{total} 語中 {timed} 語を設定済み',
  'karaoke.maker.lyricsApplyBeforeTiming':
    '単語タイミングを編集する前に新しい歌詞を検出してください',
  'karaoke.maker.lyricsNoTimedWords': 'タイミング設定済みの単語はありません',
  'karaoke.maker.lyricsTimingEditorHint':
    '検出後、任意の単語を選択してテキスト、開始時刻、長さを修正できます。',
  'karaoke.maker.lyricsSelectWord':
    'タイミングを編集する単語を選択してください。',
  'karaoke.maker.lyricsSelectedWord': '選択した単語',
  'karaoke.maker.lyricsWordNavigation': '単語ナビゲーション',
  'karaoke.maker.previousWord': '前の単語',
  'karaoke.maker.nextWord': '次の単語',
  'karaoke.maker.lyricsPlaceholder':
    '完全な歌詞をここに貼り付け…\n\n[Verse]\n1 行目\n2 行目',
  'karaoke.maker.loadLyricsFile': '歌詞ファイルを読み込む',
  'karaoke.maker.lyricsFileLoaded': '{file} から歌詞を読み込みました。',
  'karaoke.maker.lyricsRequired':
    'タイミングとメロディーを検出する前に完全な歌詞を追加してください。',
  'karaoke.maker.detectTimingMelody': 'タイミングとメロディーを検出',
  'karaoke.maker.continueInBackground': 'バックグラウンドで続行',
  'karaoke.maker.clearLyrics': '歌詞を消去',
  'karaoke.maker.clearLyricsTitle': 'すべての歌詞を消去しますか？',
  'karaoke.maker.clearLyricsBody':
    'すべての歌詞とタイミングを削除します。メロディーノートは残りますが、単語とのリンクは解除されます。消去後も元に戻せます。',
  'karaoke.maker.clearNotes': 'ノートを消去',
  'karaoke.maker.clearNotesTitle': 'すべてのメロディーノートを消去しますか？',
  'karaoke.maker.clearNotesBody':
    '歌詞と単語タイミングを残したまま、すべてのメロディーノートを削除します。消去後も元に戻せます。',
  'karaoke.maker.notesCleared': 'すべてのメロディーノートを消去しました。',
  'karaoke.maker.lyricsCleared':
    'すべての歌詞を消去しました。既存のノートは単語リンクなしで保持されました。',
  'karaoke.maker.replaceLyricsWarning':
    '単語が変更されています。置換すると単語 ID と自動タイミングが再構築され、既存の手動修正は確実に移行できません。ノートは保持され再リンクされます。',
  'karaoke.maker.replaceAndDetect': '置換して検出',
  'karaoke.maker.wordText': '単語',
  'karaoke.maker.wordStart': '開始（ms）',
  'karaoke.maker.wordPosition': '位置',
  'karaoke.maker.wordDuration': '長さ（ms）',
  'karaoke.maker.wordTimingSliderHint':
    '共有境界を調整します。行全体の範囲を固定したまま、隣の単語との時間を受け渡します。',
  'karaoke.maker.usePlayhead': '再生位置を使用',
  'karaoke.maker.playWord': '単語を再生',
  'karaoke.maker.syllableEditorEyebrow': '音節エディター',
  'karaoke.maker.syllableEditorTitle': '「{word}」を分割',
  'karaoke.maker.syllableEditorHint':
    '文字の間をクリックして音節の区切りを追加または削除します。',
  'karaoke.maker.syllableSplitPoint': '「{text}」の後の区切りを切り替え',
  'karaoke.maker.syllableEditorPreview': '分割後の音節',
  'karaoke.maker.applySyllableSplit': '音節分割を適用',
  'karaoke.maker.allowAutoTiming': '自動タイミングを許可',
  'karaoke.maker.lyricsNeedPreparation':
    '新しい歌詞を適用しました。「カラオケを準備」でタイミングを検出してください。',
  'karaoke.maker.downloadPrepare': 'ダウンロードして歌詞を準備',
  'karaoke.maker.downloadOverall': '全体のダウンロード',
  'karaoke.maker.downloadFiles': '{total} ファイル中 {complete} 完了',
  'karaoke.maker.speechMemory': '音声モデルのメモリ',
  'karaoke.maker.speechMemoryReady': 'RAM で準備完了',
  'karaoke.maker.speechMemoryCached': 'ディスクにキャッシュ済み',
  'karaoke.maker.speechMemoryMissing': '未ダウンロード',
  'karaoke.maker.freeMemory': '今すぐ RAM を解放',
  'karaoke.maker.memoryReleased':
    '音声モデルを RAM から解放しました。ダウンロード済みファイルはキャッシュに残ります。',
  'karaoke.maker.memoryReleaseBusy':
    '音声モデルは使用中のため、まだ解放できません。',
  'karaoke.maker.memoryAfterUse': 'アイドル時',
  'karaoke.maker.memoryPolicy.ask': '確認する',
  'karaoke.maker.memoryPolicy.auto': '自動的に解放',
  'karaoke.maker.memoryPolicy.keep': '読み込み状態を維持',
  'karaoke.maker.memoryAfter': '経過時間',
  'karaoke.maker.memoryMinutes': '{count} 分',
  'karaoke.maker.memoryPromptTitle': '音声モデルのメモリを解放しますか？',
  'karaoke.maker.memoryPromptBody':
    'ローカル音声モデルはアイドル状態です。解放すると RAM を節約でき、ファイルは高速な再読み込みのためキャッシュに残ります。',
  'karaoke.maker.keepLoaded': '読み込み状態を維持',
};

export const makerWorkflowHi: MakerWorkflowDictionary = {
  'karaoke.maker.recordLines': 'पंक्ति आरंभ रिकॉर्ड करें',
  'karaoke.maker.syncLinesFromHere': 'यहाँ से पंक्तियाँ सिंक करें',
  'karaoke.maker.syncWordsFromHere': 'यहाँ से शब्द सिंक करें',
  'karaoke.maker.syncNow': 'अभी',
  'karaoke.maker.syncNext': 'अगला: {item}',
  'karaoke.maker.markLine': 'पंक्ति आरंभ चिह्नित करें',
  'karaoke.maker.markLineEnd': 'पंक्ति अंत चिह्नित करें',
  'karaoke.maker.captureEnd': 'अंत की प्रतीक्षा',
  'karaoke.maker.capturePressStart': 'चरण 1 · आरंभ पर Enter',
  'karaoke.maker.captureReplaceStart':
    'अगली पंक्ति तैयार · Enter आरंभ बदलता है',
  'karaoke.maker.captureStartSaved': '{time} पर आरंभ सहेजा · अंत पर Enter',
  'karaoke.maker.captureAutomaticStart': 'स्वचालित आरंभ {time} · अंत पर Enter',
  'karaoke.maker.captureAutomaticSuggestion':
    'सुझाया आरंभ {time} · Enter आरंभ रिकॉर्ड करता है',
  'karaoke.maker.captureFixEnd': 'पंक्ति रिकॉर्ड हुई · Enter अंत सुधारता है',
  'karaoke.maker.captureStartPoint': 'आरंभ',
  'karaoke.maker.captureEndPoint': 'अंत',
  'karaoke.maker.markWord': 'शब्द चिह्नित करें',
  'karaoke.maker.done': 'पूर्ण',
  'karaoke.maker.ignoreLine': 'पंक्ति छोड़ें',
  'karaoke.maker.lineTimingComplete':
    'पंक्ति समय पूरा हुआ। समीक्षा करके प्लेयर में उपयोग करने के लिए तैयार है।',
  'karaoke.maker.recordLinesHint':
    'ENTER आरंभ/अंत चिह्नित करता है · ↑/↓ पंक्ति चुनता है · ←/→ केवल ऑडियो 2 सेकंड चलाता है · SPACE चलाता/रोकता है · Backspace पूर्ववत करता है',
  'karaoke.maker.acceptLyrics': 'बोल स्वीकारें',
  'karaoke.maker.acceptAndRecordLines': 'स्वीकारें और समय रिकॉर्ड करें',
  'karaoke.maker.captureGuideTitle': 'पंक्ति समय',
  'karaoke.maker.captureGuideNext': 'अगली पंक्ति',
  'karaoke.maker.captureGuideAudio': 'ऑडियो 2 सेकंड चलाएँ · Shift: 1 सेकंड',
  'karaoke.maker.captureGuideLyrics': 'बोल की पंक्ति चुनें',
  'karaoke.maker.captureGuidePlayback': 'चलाएँ या रोकें',
  'karaoke.maker.captureGuideUndo': 'पिछला चिह्न पूर्ववत करें',
  'karaoke.maker.repairLyrics': 'बोल का समय फिर पहचानें',
  'karaoke.maker.repairMelody': 'धुन के सुर फिर पहचानें',
  'karaoke.maker.rebuildKaraoke': 'बोल और धुन फिर बनाएँ',
  'karaoke.maker.lyricsReferenceHint':
    '[Verse] या [Chorus] जैसे चिह्न और दोहराई गई पंक्तियों सहित पूरे बोल दें। FluidEQ इस पाठ को रखता है और स्थानीय वाणी पहचान से उसका समय खोजता है।',
  'karaoke.maker.referenceLyrics': 'संदर्भ बोल',
  'karaoke.maker.wordTiming': 'शब्द का समय',
  'karaoke.maker.lyricsWordCount': 'संदर्भ में {count} शब्द',
  'karaoke.maker.lyricsTimedCount': '{total} में से {timed} का समय तय',
  'karaoke.maker.lyricsApplyBeforeTiming':
    'शब्द का समय संपादित करने से पहले नए बोल पहचानें',
  'karaoke.maker.lyricsNoTimedWords': 'अभी कोई समयबद्ध शब्द नहीं',
  'karaoke.maker.lyricsTimingEditorHint':
    'पहचान के बाद किसी शब्द का पाठ, आरंभ या लंबाई सुधारने के लिए उसे चुनें।',
  'karaoke.maker.lyricsSelectWord': 'समय संपादित करने के लिए एक शब्द चुनें।',
  'karaoke.maker.lyricsSelectedWord': 'चुना हुआ शब्द',
  'karaoke.maker.lyricsWordNavigation': 'शब्द नेविगेशन',
  'karaoke.maker.previousWord': 'पिछला शब्द',
  'karaoke.maker.nextWord': 'अगला शब्द',
  'karaoke.maker.lyricsPlaceholder':
    'पूरे बोल यहाँ चिपकाएँ…\n\n[Verse]\nपहली पंक्ति\nदूसरी पंक्ति',
  'karaoke.maker.loadLyricsFile': 'बोल फ़ाइल लोड करें',
  'karaoke.maker.lyricsFileLoaded': '{file} से बोल लोड किए गए।',
  'karaoke.maker.lyricsRequired':
    'समय और धुन पहचानने से पहले पूरे बोल जोड़ें या चिपकाएँ।',
  'karaoke.maker.detectTimingMelody': 'समय और धुन पहचानें',
  'karaoke.maker.continueInBackground': 'पृष्ठभूमि में जारी रखें',
  'karaoke.maker.clearLyrics': 'बोल साफ़ करें',
  'karaoke.maker.clearLyricsTitle': 'सभी बोल साफ़ करें?',
  'karaoke.maker.clearLyricsBody':
    'यह सभी बोल और उनका समय हटाता है। धुन के सुर रहते हैं, लेकिन शब्दों से उनके लिंक हट जाते हैं। बाद में पूर्ववत किया जा सकता है।',
  'karaoke.maker.clearNotes': 'सुर साफ़ करें',
  'karaoke.maker.clearNotesTitle': 'धुन के सभी सुर साफ़ करें?',
  'karaoke.maker.clearNotesBody':
    'यह बोल और शब्द समय रखते हुए धुन के सभी सुर हटाता है। बाद में पूर्ववत किया जा सकता है।',
  'karaoke.maker.notesCleared': 'धुन के सभी सुर साफ़ कर दिए गए।',
  'karaoke.maker.lyricsCleared':
    'सभी बोल साफ़ कर दिए गए। मौजूदा सुर शब्द लिंक के बिना रखे गए।',
  'karaoke.maker.replaceLyricsWarning':
    'शब्द बदल गए हैं। बदलने पर शब्द ID और स्वचालित समय फिर बनेंगे; मौजूदा मैन्युअल सुधार भरोसे से स्थानांतरित नहीं हो सकते। सुर रहेंगे और फिर लिंक किए जाएँगे।',
  'karaoke.maker.replaceAndDetect': 'बदलें और पहचानें',
  'karaoke.maker.wordText': 'शब्द',
  'karaoke.maker.wordStart': 'आरंभ (ms)',
  'karaoke.maker.wordPosition': 'स्थिति',
  'karaoke.maker.wordDuration': 'लंबाई (ms)',
  'karaoke.maker.wordTimingSliderHint':
    'साझा सीमा समायोजित करता है; पंक्ति की सीमा स्थिर रखते हुए पड़ोसी शब्द समय देता या लेता है।',
  'karaoke.maker.usePlayhead': 'प्लेबैक स्थिति उपयोग करें',
  'karaoke.maker.playWord': 'शब्द चलाएँ',
  'karaoke.maker.syllableEditorEyebrow': 'अक्षरांश संपादक',
  'karaoke.maker.syllableEditorTitle': '“{word}” को बाँटें',
  'karaoke.maker.syllableEditorHint':
    'अक्षरांश सीमा जोड़ने या हटाने के लिए अक्षरों के बीच क्लिक करें।',
  'karaoke.maker.syllableSplitPoint': '“{text}” के बाद विभाजन बदलें',
  'karaoke.maker.syllableEditorPreview': 'बने हुए अक्षरांश',
  'karaoke.maker.applySyllableSplit': 'अक्षरांश विभाजन लागू करें',
  'karaoke.maker.allowAutoTiming': 'स्वचालित समय की अनुमति दें',
  'karaoke.maker.lyricsNeedPreparation':
    'नए बोल लागू किए गए। उनका समय पहचानने के लिए कराओके तैयार करें चुनें।',
  'karaoke.maker.downloadPrepare': 'डाउनलोड कर बोल तैयार करें',
  'karaoke.maker.downloadOverall': 'कुल डाउनलोड',
  'karaoke.maker.downloadFiles': '{total} में से {complete} फ़ाइलें',
  'karaoke.maker.speechMemory': 'वाणी मॉडल मेमोरी',
  'karaoke.maker.speechMemoryReady': 'RAM में तैयार',
  'karaoke.maker.speechMemoryCached': 'डिस्क पर कैश',
  'karaoke.maker.speechMemoryMissing': 'डाउनलोड नहीं हुआ',
  'karaoke.maker.freeMemory': 'अभी RAM खाली करें',
  'karaoke.maker.memoryReleased':
    'वाणी मॉडल RAM से हटा दिया गया। डाउनलोड फ़ाइलें कैश में रहती हैं।',
  'karaoke.maker.memoryReleaseBusy':
    'वाणी मॉडल व्यस्त है और अभी खाली नहीं किया जा सकता।',
  'karaoke.maker.memoryAfterUse': 'निष्क्रिय होने पर',
  'karaoke.maker.memoryPolicy.ask': 'मुझसे पूछें',
  'karaoke.maker.memoryPolicy.auto': 'अपने आप खाली करें',
  'karaoke.maker.memoryPolicy.keep': 'लोड रखा जाए',
  'karaoke.maker.memoryAfter': 'इसके बाद',
  'karaoke.maker.memoryMinutes': '{count} मिनट',
  'karaoke.maker.memoryPromptTitle': 'वाणी मॉडल की मेमोरी खाली करें?',
  'karaoke.maker.memoryPromptBody':
    'स्थानीय वाणी मॉडल निष्क्रिय है। उसे हटाने से RAM बचती है; तेज़ पुनः लोड के लिए फ़ाइलें कैश में रहती हैं।',
  'karaoke.maker.keepLoaded': 'लोड रखें',
};
