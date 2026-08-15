/* FluidEQ recent Karaoke Maker and download translations. GPL-3.0-or-later. */

import { Dictionary } from './en';

type RecentDictionary = Partial<Dictionary>;

export const recentPt: RecentDictionary = {
  'karaoke.maker.captureSetupTitle': 'Pronto para gravar o tempo da letra?',
  'karaoke.maker.captureSetupBody':
    'Ouça o cantor. Pressione Enter no início da linha, Tab em cada nova palavra se desejar e Enter novamente no fim. Assim, a última palavra pode manter toda a duração.',
  'karaoke.maker.captureSetupStatus':
    'Leia o guia na prévia ao vivo e depois comece a gravar.',
  'karaoke.maker.captureStartRecording': 'Iniciar gravação',
  'karaoke.maker.captureMoveGuide':
    'Arraste para mover este guia. Clique duas vezes para restaurar a posição.',
  'karaoke.maker.selectionPanel': 'Ferramentas de seleção',
  'karaoke.maker.selectionMoveGuide':
    'Arraste para mover as ferramentas. Clique duas vezes para restaurar a posição.',
  'karaoke.maker.dismissSelection': 'Fechar ferramentas de seleção',
  'karaoke.maker.captureCountdownReady': 'Prepare-se para a primeira linha',
  'karaoke.maker.captureGuideWords': 'marcar a próxima palavra',
  'karaoke.maker.stopRecording': 'Parar gravação',
  'karaoke.maker.markNextWord': 'Próxima palavra',
  'karaoke.maker.selectNotes': 'Selecionar notas',
  'karaoke.maker.paintNotes': 'Desenhar notas',
  'karaoke.maker.selectNotesHint':
    'Arraste uma caixa ao redor das notas. Arraste uma nota selecionada para mover o grupo. Use Ctrl e arraste até uma palavra ou sílaba para anexar.',
  'karaoke.maker.paintNotesHint':
    'Arraste pela grade de afinação para desenhar uma nota. A ferramenta permanece ativa para adicionar várias notas.',
  'karaoke.maker.notesSelected': 'notas selecionadas',
  'karaoke.maker.copyNotes': 'Copiar notas selecionadas',
  'karaoke.maker.pasteNotes': 'Colar notas no cursor',
  'karaoke.maker.notePasted': 'Nota colada no cursor.',
  'karaoke.maker.notesPasted': '{count} notas coladas no cursor.',
  'karaoke.maker.attachNotesByTime': 'Anexar à letra',
  'karaoke.maker.detachNotes': 'Desanexar da letra',
  'karaoke.maker.noteAttachHelp':
    'Mantenha Ctrl pressionado e arraste uma nota até uma palavra ou sílaba. Notas anexadas seguem a letra e ficam bloqueadas.',
  'karaoke.maker.noteCopyHelp':
    'Ctrl+C copia a seleção · Ctrl+V cola a primeira nota no cursor.',
  'karaoke.maker.attachedTo': 'Anexada a “{word}”',
  'karaoke.maker.noteUnattached': 'Não anexada à letra',
  'karaoke.maker.splitWordSyllables': 'Dividir palavra em sílabas',
  'karaoke.maker.whisperTranscribingProgress':
    'Detectando tempo · passagem {pass}/{passes} · bloco {chunk}/{chunks}',
  'video.downloadChoosing': 'Escolha onde salvar este arquivo',
  'video.downloadSaving': 'Salvando {file}',
  'video.downloadComplete': 'Salvo no computador',
  'video.downloadFailed': 'Não foi possível salvar o download',
  'video.downloadProgress': 'Progresso do download',
  'video.downloadCopyPath': 'Copiar caminho',
  'video.downloadCopied': 'Caminho copiado',
  'video.downloadShowFolder': 'Mostrar na pasta',
};

export const recentFr: RecentDictionary = {
  'karaoke.maker.captureSetupTitle':
    'Prêt à enregistrer le minutage des paroles ?',
  'karaoke.maker.captureSetupBody':
    'Écoutez le chanteur. Appuyez sur Entrée au début de la ligne, éventuellement sur Tab à chaque nouveau mot, puis encore sur Entrée à la fin. Le dernier mot peut ainsi garder toute sa durée.',
  'karaoke.maker.captureSetupStatus':
    'Lisez le guide dans l’aperçu en direct, puis lancez l’enregistrement.',
  'karaoke.maker.captureStartRecording': 'Démarrer l’enregistrement',
  'karaoke.maker.captureMoveGuide':
    'Faites glisser ce guide. Double-cliquez pour rétablir sa position.',
  'karaoke.maker.selectionPanel': 'Outils de sélection',
  'karaoke.maker.selectionMoveGuide':
    'Faites glisser les outils. Double-cliquez pour rétablir leur position.',
  'karaoke.maker.dismissSelection': 'Fermer les outils de sélection',
  'karaoke.maker.captureCountdownReady': 'Préparez-vous pour la première ligne',
  'karaoke.maker.captureGuideWords': 'marquer le mot suivant',
  'karaoke.maker.stopRecording': 'Arrêter l’enregistrement',
  'karaoke.maker.markNextWord': 'Mot suivant',
  'karaoke.maker.selectNotes': 'Sélectionner des notes',
  'karaoke.maker.paintNotes': 'Dessiner des notes',
  'karaoke.maker.selectNotesHint':
    'Tracez un cadre autour des notes. Faites glisser une note sélectionnée pour déplacer le groupe. Maintenez Ctrl et faites-la glisser sur un mot ou une syllabe pour l’attacher.',
  'karaoke.maker.paintNotesHint':
    'Faites glisser sur la grille de hauteur pour dessiner une note. L’outil reste actif pour en ajouter plusieurs.',
  'karaoke.maker.notesSelected': 'notes sélectionnées',
  'karaoke.maker.copyNotes': 'Copier les notes sélectionnées',
  'karaoke.maker.pasteNotes': 'Coller les notes à la tête de lecture',
  'karaoke.maker.notePasted': 'Note collée à la tête de lecture.',
  'karaoke.maker.notesPasted': '{count} notes collées à la tête de lecture.',
  'karaoke.maker.attachNotesByTime': 'Attacher aux paroles',
  'karaoke.maker.detachNotes': 'Détacher des paroles',
  'karaoke.maker.noteAttachHelp':
    'Maintenez Ctrl et faites glisser une note sur un mot ou une syllabe. Une note attachée suit les paroles et reste verrouillée.',
  'karaoke.maker.noteCopyHelp':
    'Ctrl+C copie la sélection · Ctrl+V colle sa première note à la tête de lecture.',
  'karaoke.maker.attachedTo': 'Attachée à « {word} »',
  'karaoke.maker.noteUnattached': 'Non attachée aux paroles',
  'karaoke.maker.splitWordSyllables': 'Diviser le mot en syllabes',
  'karaoke.maker.whisperTranscribingProgress':
    'Détection du minutage · passe {pass}/{passes} · bloc {chunk}/{chunks}',
  'video.downloadChoosing': 'Choisissez où enregistrer ce fichier',
  'video.downloadSaving': 'Enregistrement de {file}',
  'video.downloadComplete': 'Enregistré sur votre ordinateur',
  'video.downloadFailed': 'Le téléchargement n’a pas pu être enregistré',
  'video.downloadProgress': 'Progression du téléchargement',
  'video.downloadCopyPath': 'Copier le chemin',
  'video.downloadCopied': 'Chemin copié',
  'video.downloadShowFolder': 'Afficher dans le dossier',
};

export const recentDe: RecentDictionary = {
  'karaoke.maker.captureSetupTitle': 'Bereit, das Liedtext-Timing aufzunehmen?',
  'karaoke.maker.captureSetupBody':
    'Höre auf den Gesang. Drücke am Zeilenanfang Enter, optional bei jedem neuen Wort Tab und am Zeilenende erneut Enter. So behält ein langes letztes Wort seine volle Dauer.',
  'karaoke.maker.captureSetupStatus':
    'Lies die Anleitung in der Live-Vorschau und starte dann die Aufnahme.',
  'karaoke.maker.captureStartRecording': 'Aufnahme starten',
  'karaoke.maker.captureMoveGuide':
    'Zum Verschieben ziehen. Doppelklicken, um die Position zurückzusetzen.',
  'karaoke.maker.selectionPanel': 'Auswahlwerkzeuge',
  'karaoke.maker.selectionMoveGuide':
    'Werkzeuge zum Verschieben ziehen. Doppelklicken, um die Position zurückzusetzen.',
  'karaoke.maker.dismissSelection': 'Auswahlwerkzeuge schließen',
  'karaoke.maker.captureCountdownReady': 'Bereit für die erste Zeile',
  'karaoke.maker.captureGuideWords': 'nächstes Wort markieren',
  'karaoke.maker.stopRecording': 'Aufnahme beenden',
  'karaoke.maker.markNextWord': 'Nächstes Wort',
  'karaoke.maker.selectNotes': 'Noten auswählen',
  'karaoke.maker.paintNotes': 'Noten zeichnen',
  'karaoke.maker.selectNotesHint':
    'Ziehe einen Rahmen um Noten. Ziehe eine ausgewählte Note, um die Gruppe zu bewegen. Halte Strg und ziehe sie auf ein Wort oder eine Silbe, um sie zu verknüpfen.',
  'karaoke.maker.paintNotesHint':
    'Ziehe über das Tonhöhenraster, um eine Note zu zeichnen. Das Werkzeug bleibt für weitere Noten aktiv.',
  'karaoke.maker.notesSelected': 'Noten ausgewählt',
  'karaoke.maker.copyNotes': 'Ausgewählte Noten kopieren',
  'karaoke.maker.pasteNotes': 'Noten am Abspielkopf einfügen',
  'karaoke.maker.notePasted': 'Note am Abspielkopf eingefügt.',
  'karaoke.maker.notesPasted': '{count} Noten am Abspielkopf eingefügt.',
  'karaoke.maker.attachNotesByTime': 'Mit Liedtext verknüpfen',
  'karaoke.maker.detachNotes': 'Vom Liedtext lösen',
  'karaoke.maker.noteAttachHelp':
    'Halte Strg und ziehe eine Note auf ein Wort oder eine Silbe. Verknüpfte Noten folgen dem Liedtext und sind gesperrt.',
  'karaoke.maker.noteCopyHelp':
    'Strg+C kopiert die Auswahl · Strg+V fügt die erste Note am Abspielkopf ein.',
  'karaoke.maker.attachedTo': 'Mit „{word}“ verknüpft',
  'karaoke.maker.noteUnattached': 'Nicht mit Liedtext verknüpft',
  'karaoke.maker.splitWordSyllables': 'Wort in Silben teilen',
  'karaoke.maker.whisperTranscribingProgress':
    'Timing wird erkannt · Durchlauf {pass}/{passes} · Block {chunk}/{chunks}',
  'video.downloadChoosing': 'Speicherort für diese Datei wählen',
  'video.downloadSaving': '{file} wird gespeichert',
  'video.downloadComplete': 'Auf dem Computer gespeichert',
  'video.downloadFailed': 'Der Download konnte nicht gespeichert werden',
  'video.downloadProgress': 'Downloadfortschritt',
  'video.downloadCopyPath': 'Pfad kopieren',
  'video.downloadCopied': 'Pfad kopiert',
  'video.downloadShowFolder': 'Im Ordner anzeigen',
};

export const recentIt: RecentDictionary = {
  'karaoke.maker.captureSetupTitle': 'Pronto a registrare i tempi del testo?',
  'karaoke.maker.captureSetupBody':
    'Ascolta il cantante. Premi Invio all’inizio della riga, facoltativamente Tab a ogni nuova parola, poi ancora Invio alla fine. Così l’ultima parola può mantenere tutta la sua durata.',
  'karaoke.maker.captureSetupStatus':
    'Leggi la guida nell’anteprima dal vivo, poi avvia la registrazione.',
  'karaoke.maker.captureStartRecording': 'Avvia registrazione',
  'karaoke.maker.captureMoveGuide':
    'Trascina per spostare la guida. Fai doppio clic per ripristinarne la posizione.',
  'karaoke.maker.selectionPanel': 'Strumenti di selezione',
  'karaoke.maker.selectionMoveGuide':
    'Trascina per spostare gli strumenti. Fai doppio clic per ripristinarne la posizione.',
  'karaoke.maker.dismissSelection': 'Chiudi strumenti di selezione',
  'karaoke.maker.captureCountdownReady': 'Preparati per la prima riga',
  'karaoke.maker.captureGuideWords': 'segna la parola successiva',
  'karaoke.maker.stopRecording': 'Interrompi registrazione',
  'karaoke.maker.markNextWord': 'Parola successiva',
  'karaoke.maker.selectNotes': 'Seleziona note',
  'karaoke.maker.paintNotes': 'Disegna note',
  'karaoke.maker.selectNotesHint':
    'Trascina un riquadro attorno alle note. Trascina una nota selezionata per spostare il gruppo. Tieni premuto Ctrl e trascinala su una parola o sillaba per collegarla.',
  'karaoke.maker.paintNotesHint':
    'Trascina sulla griglia dell’intonazione per disegnare una nota. Lo strumento resta attivo per aggiungerne altre.',
  'karaoke.maker.notesSelected': 'note selezionate',
  'karaoke.maker.copyNotes': 'Copia note selezionate',
  'karaoke.maker.pasteNotes': 'Incolla note alla testina',
  'karaoke.maker.notePasted': 'Nota incollata alla testina.',
  'karaoke.maker.notesPasted': '{count} note incollate alla testina.',
  'karaoke.maker.attachNotesByTime': 'Collega al testo',
  'karaoke.maker.detachNotes': 'Scollega dal testo',
  'karaoke.maker.noteAttachHelp':
    'Tieni premuto Ctrl e trascina una nota su una parola o sillaba. Le note collegate seguono il testo e restano bloccate.',
  'karaoke.maker.noteCopyHelp':
    'Ctrl+C copia la selezione · Ctrl+V incolla la prima nota alla testina.',
  'karaoke.maker.attachedTo': 'Collegata a “{word}”',
  'karaoke.maker.noteUnattached': 'Non collegata al testo',
  'karaoke.maker.splitWordSyllables': 'Dividi la parola in sillabe',
  'karaoke.maker.whisperTranscribingProgress':
    'Rilevamento tempi · passaggio {pass}/{passes} · blocco {chunk}/{chunks}',
  'video.downloadChoosing': 'Scegli dove salvare questo file',
  'video.downloadSaving': 'Salvataggio di {file}',
  'video.downloadComplete': 'Salvato sul computer',
  'video.downloadFailed': 'Impossibile salvare il download',
  'video.downloadProgress': 'Avanzamento download',
  'video.downloadCopyPath': 'Copia percorso',
  'video.downloadCopied': 'Percorso copiato',
  'video.downloadShowFolder': 'Mostra nella cartella',
};

export const recentRu: RecentDictionary = {
  'karaoke.maker.captureSetupTitle': 'Готовы записать тайминг текста?',
  'karaoke.maker.captureSetupBody':
    'Слушайте вокал. Нажмите Enter в начале строки, при желании Tab на каждом новом слове, затем Enter в конце. Так последнее протяжное слово сохранит полную длительность.',
  'karaoke.maker.captureSetupStatus':
    'Прочитайте подсказку в предпросмотре и начните запись.',
  'karaoke.maker.captureStartRecording': 'Начать запись',
  'karaoke.maker.captureMoveGuide':
    'Перетащите подсказку. Двойной щелчок вернёт её на место.',
  'karaoke.maker.selectionPanel': 'Инструменты выделения',
  'karaoke.maker.selectionMoveGuide':
    'Перетащите инструменты. Двойной щелчок вернёт их на место.',
  'karaoke.maker.dismissSelection': 'Закрыть инструменты выделения',
  'karaoke.maker.captureCountdownReady': 'Приготовьтесь к первой строке',
  'karaoke.maker.captureGuideWords': 'отметить следующее слово',
  'karaoke.maker.stopRecording': 'Остановить запись',
  'karaoke.maker.markNextWord': 'Следующее слово',
  'karaoke.maker.selectNotes': 'Выбрать ноты',
  'karaoke.maker.paintNotes': 'Рисовать ноты',
  'karaoke.maker.selectNotesHint':
    'Обведите ноты рамкой. Перетащите выбранную ноту, чтобы переместить группу. Удерживайте Ctrl и перетащите её на слово или слог для привязки.',
  'karaoke.maker.paintNotesHint':
    'Проведите по сетке высоты, чтобы нарисовать ноту. Инструмент останется активным для следующих нот.',
  'karaoke.maker.notesSelected': 'нот выбрано',
  'karaoke.maker.copyNotes': 'Копировать выбранные ноты',
  'karaoke.maker.pasteNotes': 'Вставить ноты у курсора',
  'karaoke.maker.notePasted': 'Нота вставлена у курсора.',
  'karaoke.maker.notesPasted': 'У курсора вставлено нот: {count}.',
  'karaoke.maker.attachNotesByTime': 'Привязать к тексту',
  'karaoke.maker.detachNotes': 'Отвязать от текста',
  'karaoke.maker.noteAttachHelp':
    'Удерживайте Ctrl и перетащите ноту на слово или слог. Привязанные ноты следуют таймингу текста и блокируются.',
  'karaoke.maker.noteCopyHelp':
    'Ctrl+C копирует выбор · Ctrl+V вставляет первую ноту у курсора.',
  'karaoke.maker.attachedTo': 'Привязана к «{word}»',
  'karaoke.maker.noteUnattached': 'Не привязана к тексту',
  'karaoke.maker.splitWordSyllables': 'Разделить слово на слоги',
  'karaoke.maker.whisperTranscribingProgress':
    'Определение тайминга · проход {pass}/{passes} · блок {chunk}/{chunks}',
  'video.downloadChoosing': 'Выберите место сохранения файла',
  'video.downloadSaving': 'Сохранение {file}',
  'video.downloadComplete': 'Сохранено на компьютере',
  'video.downloadFailed': 'Не удалось сохранить загрузку',
  'video.downloadProgress': 'Ход загрузки',
  'video.downloadCopyPath': 'Копировать путь',
  'video.downloadCopied': 'Путь скопирован',
  'video.downloadShowFolder': 'Показать в папке',
};

export const recentZh: RecentDictionary = {
  'karaoke.maker.captureSetupTitle': '准备录制歌词时间了吗？',
  'karaoke.maker.captureSetupBody':
    '聆听演唱者。在每行开始时按 Enter，可在每个新单词处按 Tab，然后在行结束时再次按 Enter。这样拖长的最后一个词可以保留完整时长。',
  'karaoke.maker.captureSetupStatus': '阅读实时预览中的指南，然后开始录制。',
  'karaoke.maker.captureStartRecording': '开始录制',
  'karaoke.maker.captureMoveGuide': '拖动此指南。双击可重置位置。',
  'karaoke.maker.selectionPanel': '选择工具',
  'karaoke.maker.selectionMoveGuide': '拖动选择工具。双击可重置位置。',
  'karaoke.maker.dismissSelection': '关闭选择工具',
  'karaoke.maker.captureCountdownReady': '准备第一行',
  'karaoke.maker.captureGuideWords': '标记下一个词',
  'karaoke.maker.stopRecording': '停止录制',
  'karaoke.maker.markNextWord': '下一个词',
  'karaoke.maker.selectNotes': '选择音符',
  'karaoke.maker.paintNotes': '绘制音符',
  'karaoke.maker.selectNotesHint':
    '拖出选框选择音符。拖动任一已选音符可移动整组。按住 Ctrl 并拖到单词或音节上即可关联。',
  'karaoke.maker.paintNotesHint':
    '在音高网格上拖动以绘制音符。工具会保持启用，便于连续添加。',
  'karaoke.maker.notesSelected': '个音符已选择',
  'karaoke.maker.copyNotes': '复制所选音符',
  'karaoke.maker.pasteNotes': '在播放头粘贴音符',
  'karaoke.maker.notePasted': '音符已粘贴到播放头。',
  'karaoke.maker.notesPasted': '已在播放头粘贴 {count} 个音符。',
  'karaoke.maker.attachNotesByTime': '关联到歌词',
  'karaoke.maker.detachNotes': '取消歌词关联',
  'karaoke.maker.noteAttachHelp':
    '按住 Ctrl，将音符拖到单词或音节上。已关联音符会跟随歌词时间并保持锁定。',
  'karaoke.maker.noteCopyHelp':
    'Ctrl+C 复制选择 · Ctrl+V 将第一个音符粘贴到播放头。',
  'karaoke.maker.attachedTo': '已关联到“{word}”',
  'karaoke.maker.noteUnattached': '未关联到歌词',
  'karaoke.maker.splitWordSyllables': '将单词拆分为音节',
  'karaoke.maker.whisperTranscribingProgress':
    '正在检测歌词时间 · 第 {pass}/{passes} 遍 · 区块 {chunk}/{chunks}',
  'video.downloadChoosing': '选择文件保存位置',
  'video.downloadSaving': '正在保存 {file}',
  'video.downloadComplete': '已保存到电脑',
  'video.downloadFailed': '无法保存下载内容',
  'video.downloadProgress': '下载进度',
  'video.downloadCopyPath': '复制路径',
  'video.downloadCopied': '路径已复制',
  'video.downloadShowFolder': '在文件夹中显示',
};

export const recentJa: RecentDictionary = {
  'karaoke.maker.captureSetupTitle': '歌詞のタイミングを記録しますか？',
  'karaoke.maker.captureSetupBody':
    '歌声を聴き、行の開始で Enter、新しい単語ごとに必要なら Tab、行の終了でもう一度 Enter を押します。最後の長い単語も正しい長さで残せます。',
  'karaoke.maker.captureSetupStatus':
    'ライブプレビューのガイドを確認してから記録を開始してください。',
  'karaoke.maker.captureStartRecording': '記録を開始',
  'karaoke.maker.captureMoveGuide':
    'ドラッグしてガイドを移動します。ダブルクリックで位置をリセットします。',
  'karaoke.maker.selectionPanel': '選択ツール',
  'karaoke.maker.selectionMoveGuide':
    'ドラッグして選択ツールを移動します。ダブルクリックで位置をリセットします。',
  'karaoke.maker.dismissSelection': '選択ツールを閉じる',
  'karaoke.maker.captureCountdownReady': '最初の行に備えてください',
  'karaoke.maker.captureGuideWords': '次の単語を記録',
  'karaoke.maker.stopRecording': '記録を停止',
  'karaoke.maker.markNextWord': '次の単語',
  'karaoke.maker.selectNotes': '音符を選択',
  'karaoke.maker.paintNotes': '音符を描画',
  'karaoke.maker.selectNotesHint':
    '音符を囲むようにドラッグします。選択した音符をドラッグするとグループが移動します。Ctrl を押しながら単語または音節へドラッグすると関連付けられます。',
  'karaoke.maker.paintNotesHint':
    '音高グリッド上をドラッグして音符を描きます。ツールは有効なままなので続けて追加できます。',
  'karaoke.maker.notesSelected': '個の音符を選択中',
  'karaoke.maker.copyNotes': '選択した音符をコピー',
  'karaoke.maker.pasteNotes': '再生ヘッドに音符を貼り付け',
  'karaoke.maker.notePasted': '再生ヘッドに音符を貼り付けました。',
  'karaoke.maker.notesPasted':
    '再生ヘッドに {count} 個の音符を貼り付けました。',
  'karaoke.maker.attachNotesByTime': '歌詞に関連付け',
  'karaoke.maker.detachNotes': '歌詞との関連付けを解除',
  'karaoke.maker.noteAttachHelp':
    'Ctrl を押しながら音符を単語または音節へドラッグします。関連付けた音符は歌詞のタイミングに従いロックされます。',
  'karaoke.maker.noteCopyHelp':
    'Ctrl+C で選択をコピー · Ctrl+V で先頭の音符を再生ヘッドに貼り付けます。',
  'karaoke.maker.attachedTo': '「{word}」に関連付け済み',
  'karaoke.maker.noteUnattached': '歌詞に関連付けられていません',
  'karaoke.maker.splitWordSyllables': '単語を音節に分割',
  'karaoke.maker.whisperTranscribingProgress':
    '歌詞タイミングを検出中 · パス {pass}/{passes} · ブロック {chunk}/{chunks}',
  'video.downloadChoosing': 'ファイルの保存先を選択',
  'video.downloadSaving': '{file} を保存中',
  'video.downloadComplete': 'コンピューターに保存しました',
  'video.downloadFailed': 'ダウンロードを保存できませんでした',
  'video.downloadProgress': 'ダウンロードの進行状況',
  'video.downloadCopyPath': 'パスをコピー',
  'video.downloadCopied': 'パスをコピーしました',
  'video.downloadShowFolder': 'フォルダーに表示',
};

export const recentHi: RecentDictionary = {
  'karaoke.maker.captureSetupTitle':
    'बोल का समय रिकॉर्ड करने के लिए तैयार हैं?',
  'karaoke.maker.captureSetupBody':
    'गायक को सुनें। पंक्ति शुरू होते ही Enter दबाएँ, चाहें तो हर नए शब्द पर Tab दबाएँ, फिर पंक्ति समाप्त होने पर Enter दबाएँ। इससे आखिरी लंबा शब्द अपनी पूरी अवधि रखता है।',
  'karaoke.maker.captureSetupStatus':
    'लाइव पूर्वावलोकन में मार्गदर्शिका पढ़ें, फिर रिकॉर्डिंग शुरू करें।',
  'karaoke.maker.captureStartRecording': 'रिकॉर्डिंग शुरू करें',
  'karaoke.maker.captureMoveGuide':
    'मार्गदर्शिका को खींचकर ले जाएँ। स्थिति रीसेट करने के लिए डबल-क्लिक करें।',
  'karaoke.maker.selectionPanel': 'चयन उपकरण',
  'karaoke.maker.selectionMoveGuide':
    'चयन उपकरणों को खींचकर ले जाएँ। स्थिति रीसेट करने के लिए डबल-क्लिक करें।',
  'karaoke.maker.dismissSelection': 'चयन उपकरण बंद करें',
  'karaoke.maker.captureCountdownReady': 'पहली पंक्ति के लिए तैयार रहें',
  'karaoke.maker.captureGuideWords': 'अगला शब्द चिह्नित करें',
  'karaoke.maker.stopRecording': 'रिकॉर्डिंग रोकें',
  'karaoke.maker.markNextWord': 'अगला शब्द',
  'karaoke.maker.selectNotes': 'सुर चुनें',
  'karaoke.maker.paintNotes': 'सुर बनाएँ',
  'karaoke.maker.selectNotesHint':
    'सुरों के चारों ओर बॉक्स खींचें। पूरे समूह को ले जाने के लिए चुना हुआ सुर खींचें। जोड़ने के लिए Ctrl दबाकर उसे शब्द या अक्षरांश पर खींचें।',
  'karaoke.maker.paintNotesHint':
    'सुर बनाने के लिए पिच ग्रिड पर खींचें। कई सुर जोड़ने के लिए उपकरण सक्रिय रहता है।',
  'karaoke.maker.notesSelected': 'सुर चुने गए',
  'karaoke.maker.copyNotes': 'चुने हुए सुर कॉपी करें',
  'karaoke.maker.pasteNotes': 'प्लेबैक स्थिति पर सुर चिपकाएँ',
  'karaoke.maker.notePasted': 'प्लेबैक स्थिति पर सुर चिपकाया गया।',
  'karaoke.maker.notesPasted': 'प्लेबैक स्थिति पर {count} सुर चिपकाए गए।',
  'karaoke.maker.attachNotesByTime': 'बोल से जोड़ें',
  'karaoke.maker.detachNotes': 'बोल से अलग करें',
  'karaoke.maker.noteAttachHelp':
    'Ctrl दबाकर सुर को शब्द या अक्षरांश पर खींचें। जुड़े सुर बोल के समय के साथ चलते हैं और लॉक रहते हैं।',
  'karaoke.maker.noteCopyHelp':
    'Ctrl+C चयन कॉपी करता है · Ctrl+V पहला सुर प्लेबैक स्थिति पर चिपकाता है।',
  'karaoke.maker.attachedTo': '“{word}” से जुड़ा',
  'karaoke.maker.noteUnattached': 'किसी बोल से नहीं जुड़ा',
  'karaoke.maker.splitWordSyllables': 'शब्द को अक्षरांशों में बाँटें',
  'karaoke.maker.whisperTranscribingProgress':
    'बोल का समय पहचाना जा रहा है · चरण {pass}/{passes} · खंड {chunk}/{chunks}',
  'video.downloadChoosing': 'यह फ़ाइल कहाँ सहेजनी है चुनें',
  'video.downloadSaving': '{file} सहेजा जा रहा है',
  'video.downloadComplete': 'कंप्यूटर पर सहेजा गया',
  'video.downloadFailed': 'डाउनलोड सहेजा नहीं जा सका',
  'video.downloadProgress': 'डाउनलोड प्रगति',
  'video.downloadCopyPath': 'पथ कॉपी करें',
  'video.downloadCopied': 'पथ कॉपी हुआ',
  'video.downloadShowFolder': 'फ़ोल्डर में दिखाएँ',
};
