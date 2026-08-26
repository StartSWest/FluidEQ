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

/** The Karaoke tab, its player and the Maker. */
import { Dictionary } from '../en';

const karaoke: Partial<Dictionary> = {
  'karaoke.eyebrow': 'KARAOKE LOCALE',
  'karaoke.title': 'Un palco costruito intorno alla tua musica',
  'karaoke.intro':
    'Questo spazio riunirà brani, testi sincronizzati, monitoraggio del microfono e guida dell’intonazione, tutto in locale sul tuo PC.',
  'karaoke.fullscreen.enter': 'Passa a schermo intero',
  'karaoke.fullscreen.exit': 'Esci da schermo intero',
  'karaoke.fullscreen.hideHeader': 'Nascondi l’intestazione FluidEQ',
  'karaoke.fullscreen.showHeader': 'Mostra l’intestazione FluidEQ',
  'karaoke.actions': 'Azioni karaoke',
  'karaoke.readiness.resize':
    'Ridimensiona i pannelli del microfono e dell’intonazione',
  'karaoke.empty.title': 'Il palco è pronto',
  'karaoke.empty.body':
    'Apri audio con testi facoltativi o aggiungi un’intera cartella. FluidEQ collega i file con lo stesso nome in una scaletta.',
  'karaoke.import.pending': 'Prossimo passo: importare brani',
  'karaoke.import.open': 'Apri brano',
  'karaoke.import.replace': 'Sostituisci brano',
  'karaoke.import.addFiles': 'Aggiungi file',
  'karaoke.import.folder': 'Aggiungi cartella',
  'karaoke.import.clear': 'Rimuovi',
  'karaoke.import.loading': 'Preparazione del brano…',
  'karaoke.import.formats':
    'Audio: MP3, WAV, OGG, Opus, FLAC, M4A o AAC · Testi: LRC, eLRC o TXT UltraStar · Aggiungi anche copertina e video',
  'karaoke.import.drop': 'Rilascia qui brani, testi o cartelle',
  'karaoke.error.missingAudio':
    'Aggiungi un file audio insieme a questo file di testo.',
  'karaoke.error.ambiguous':
    'Sono possibili più abbinamenti. Seleziona un file audio e, facoltativamente, un file di testo.',
  'karaoke.error.unsupported':
    'Nessuno di questi file è ancora un formato audio o testo Karaoke supportato. Copertina e video hanno bisogno di un brano accanto.',
  'karaoke.error.read': 'FluidEQ non ha potuto leggere i file locali scelti.',
  'karaoke.error.playback':
    'Questa versione di Chromium non ha potuto riprodurre il file o il codec audio.',
  'karaoke.warning.lyrics': 'non è stato interpretato.',
  'karaoke.warning.lyricsEmpty': 'è vuoto.',
  'karaoke.warning.lyricsMissingTiming':
    'non contiene tempi leggibili da FluidEQ.',
  'karaoke.warning.lyricsMissingBpm':
    'non dichiara alcun BPM, necessario a un file UltraStar.',
  'karaoke.warning.lyricsInvalidBpm':
    'dichiara un BPM che non è un numero utilizzabile.',
  'karaoke.warning.lyricsMalformedNote':
    'contiene una riga di nota che FluidEQ non è riuscito a leggere.',
  'karaoke.warning.lyricsUnsupportedVariant':
    'usa una variante karaoke che FluidEQ non sa ancora cantare, come un duetto.',
  'karaoke.warning.lyricsAtLine': 'Riga {line}.',
  'karaoke.warning.lyricsAudioIntact':
    'L’audio resta disponibile senza testo sincronizzato.',
  'karaoke.warning.setAside':
    'FluidEQ non sa ancora leggere questi file come karaoke, quindi li ha messi da parte: {formats}.',
  'karaoke.warning.unpairedLyrics':
    'Nessun file audio corrisponde a questi file di testo, quindi non sono stati usati: {files}.',
  'karaoke.warning.ambiguousLyrics':
    'Due file di testo corrispondevano allo stesso brano, quindi non ne è stato usato nessuno: {files}.',
  'karaoke.warning.andMore': 'e altri {count}',
  'karaoke.countdown.sing': 'Canta',
  'karaoke.song.unknownArtist': 'Brano locale',
  'karaoke.stage.videoUnsupported':
    'Non è possibile riprodurre video {format} qui',
  'karaoke.stage.videoFailed':
    'Non è stato possibile decodificare il video {format} qui',
  'karaoke.stage.hideArt': 'Nascondi la copertina',
  'karaoke.stage.showArt': 'Mostra la copertina',
  'karaoke.stage.noArt': 'Questo brano non ha una copertina',
  'karaoke.playlist.title': 'Scaletta',
  'karaoke.playlist.groupFolders': 'Raggruppa per cartella',
  'karaoke.playlist.looseFiles': 'File non raggruppati',
  'karaoke.playlist.resize': 'Ridimensiona playlist e palco',
  'karaoke.playlist.collapse': 'Comprimi playlist',
  'karaoke.playlist.expand': 'Espandi playlist',
  'karaoke.playlist.select': 'Seleziona {title}',
  'karaoke.playlist.moveUp': 'Sposta {title} in alto',
  'karaoke.playlist.moveDown': 'Sposta {title} in basso',
  'karaoke.playlist.remove': 'Rimuovi {title}',
  'karaoke.source.audioOnly': 'Solo audio',
  'karaoke.source.lrc': 'LRC · tempi per riga',
  'karaoke.source.elrc': 'eLRC · tempi per parola',
  'karaoke.source.ultrastar': 'UltraStar · sillabe + intonazione',
  'karaoke.lyrics.none':
    'Non hai scelto un testo sincronizzato. Riproduzione e accordatore restano disponibili.',
  'karaoke.lyrics.line': 'Riga del testo {number}',
  'karaoke.lyrics.previous': 'Testo precedente',
  'karaoke.lyrics.next': 'Testo successivo',
  'karaoke.lyrics.follow': 'Segui il testo',
  'karaoke.lyrics.textSize': 'Dimensione del testo',
  'karaoke.transport.title': 'Controlli di riproduzione Karaoke',
  'karaoke.transport.restart': 'Riavvia brano',
  'karaoke.transport.play': 'Riproduci',
  'karaoke.transport.pause': 'Pausa',
  'karaoke.transport.spaceShortcut': '{action} · Spazio',
  'karaoke.transport.seek': 'Posizione del brano',
  'karaoke.transport.volume': 'Volume',
  'karaoke.transport.vocalLevel': 'Voce guida',
  'karaoke.transport.vocalOff': 'Solo base',
  'karaoke.transport.vocalFull': 'Originale',
  'karaoke.transport.mixSettings': 'Impostazioni mix',
  'karaoke.transport.openMixSettings': 'Apri le impostazioni mix per {channel}',
  'karaoke.mic.title': 'Microfono',
  'karaoke.mic.settings': 'Impostazioni del microfono',
  'karaoke.mic.off': 'Disattivato',
  'karaoke.mic.hint':
    'Scegli un ingresso. FluidEQ chiede l’accesso al microfono solo quando lo attivi.',
  'karaoke.mic.select': 'Ingresso microfono',
  'karaoke.mic.default': 'Predefinito di sistema',
  'karaoke.mic.unnamed': 'Microfono {number}',
  'karaoke.mic.turnOn': 'Attiva microfono',
  'karaoke.mic.turnOff': 'Disattiva microfono',
  'karaoke.mic.requesting': 'Connessione…',
  'karaoke.mic.live': 'Attivo',
  'karaoke.mic.denied': 'Permesso negato',
  'karaoke.mic.unavailable': 'Nessun microfono',
  'karaoke.mic.disconnected': 'Disconnesso',
  'karaoke.mic.error': 'Avvio non riuscito',
  'karaoke.mic.level': 'Livello di ingresso del microfono',
  'karaoke.mic.levelValue': 'Livello di ingresso del microfono: {percent}%',
  'karaoke.mic.privacy':
    'Solo analisi locale del livello e dell’intonazione. FluidEQ non registra né riproduce il microfono dagli altoparlanti.',
  'karaoke.mic.volume': 'Volume microfono',
  'karaoke.mic.volumeValue': 'Volume microfono: {percent}%',
  'karaoke.pitch.title': 'Traccia dell’intonazione',
  'karaoke.pitch.resize': 'Ridimensiona la traccia dell’intonazione',
  'karaoke.pitch.show': 'Mostra la guida dell’intonazione',
  'karaoke.pitch.hide': 'Nascondi la guida dell’intonazione',
  'karaoke.pitch.guide': 'Guida melodica',
  'karaoke.pitch.toneGuide': 'Tono melodia',
  'karaoke.pitch.toneEnable': 'Riproduci il tono della melodia',
  'karaoke.pitch.toneDisable': 'Arresta il tono della melodia',
  'karaoke.pitch.toneVolume': 'Volume del tono melodia',
  'karaoke.pitch.scrubHint':
    'Trascina a sinistra o a destra per spostarti nel brano; rilascia per restare in pausa.',
  'karaoke.pitch.viewSelector': 'Vista dell’intonazione',
  'karaoke.pitch.viewNotes': 'Note',
  'karaoke.pitch.viewWave': 'Curva',
  'karaoke.pitch.waveCanvas':
    'Curva in tempo reale dell’intonazione del cantante sulle note del brano',
  'karaoke.pitch.waveSong': 'Brano',
  'karaoke.pitch.waveVoice': 'La tua voce',
  'karaoke.pitch.waveFooter':
    'I blocchi blu sono le note del brano; la sottile curva dal vivo è l’intonazione rilevata dal microfono.',
  'karaoke.pitch.review': 'Riepilogo esibizione',
  'karaoke.pitch.reviewCount': '{count} parti da esercitare',
  'karaoke.pitch.issueHigh':
    'Intonazione alta a {time}. Esercitati su questa parte.',
  'karaoke.pitch.issueLow':
    'Intonazione bassa a {time}. Esercitati su questa parte.',
  'karaoke.pitch.issueMissed':
    'Note mancate a {time}. Esercitati su questa parte.',
  'karaoke.practice.go': 'VIA!',
  'karaoke.practice.ready': 'Preparati a cantare di nuovo',
  'karaoke.countIn.ready': 'Preparati: il brano inizia dopo VIA',
  'karaoke.pitch.canvas':
    'Traccia dal vivo del microfono e delle note obiettivo',
  'karaoke.pitch.micOff': 'Attiva il microfono per vedere la tua intonazione.',
  'karaoke.pitch.loading': 'Avvio dell’analisi dell’intonazione…',
  'karaoke.pitch.unavailable':
    'L’analisi dell’intonazione non è disponibile. Il livello del microfono continua a funzionare.',
  'karaoke.pitch.noSignal':
    'Canta nel microfono per tracciare la tua intonazione.',
  'karaoke.pitch.empty':
    'Le note obiettivo appariranno solo se il brano importato le contiene davvero.',
  'karaoke.pitch.high': 'Alta',
  'karaoke.pitch.tuned': 'Intonata',
  'karaoke.pitch.low': 'Bassa',
  'karaoke.pitch.ultrastar':
    'Le barre blu sono le note obiettivo; la traccia indica se la voce è alta, intonata o bassa.',
  'karaoke.chords.aria': 'Accordi di chitarra stimati dalla base',
  'karaoke.chords.analyzing': 'Ricerca accordi… {percent}%',
  'karaoke.chords.estimate': 'Accordo stimato',
  'karaoke.chords.next': 'Successivo',
  'karaoke.chords.in': 'tra {seconds}s',
  'karaoke.chords.none': 'Nessun accordo stabile trovato',
  'karaoke.chords.confidence': 'Affidabilità della stima audio: {percent}%',
  'karaoke.maker.open': 'Crea',
  'karaoke.maker.openTitle': 'Crea o modifica questo karaoke',
  'karaoke.maker.dialog': 'Creatore di karaoke',
  'karaoke.maker.eyebrow': 'CREATORE KARAOKE FLUIDEQ',
  'karaoke.maker.close': 'Chiudi il creatore',
  'karaoke.maker.exitBusy':
    'Un modello locale è ancora in esecuzione. Annullalo o attendi che finisca prima di uscire dall’editor.',
  'karaoke.maker.songTitle': 'Titolo del brano',
  'karaoke.maker.untitled': 'Karaoke senza titolo',
  'karaoke.maker.undo': 'Annulla',
  'karaoke.maker.redo': 'Ripeti',
  'karaoke.maker.preview': 'Anteprima · 1, 2, 3',
  'karaoke.maker.apply': 'Usa nel lettore',
  'karaoke.maker.applyHint':
    'Usa queste modifiche nel lettore. Il file originale resta invariato; Esporta crea un nuovo file.',
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
  'karaoke.maker.captureGuideTitle': 'Tempi della riga',
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
  'karaoke.maker.captureGuideNext': 'Prossima',
  'karaoke.maker.captureGuideAudio':
    'sposta l’audio di 2 secondi · Maiusc: 1 secondo',
  'karaoke.maker.captureGuideLyrics': 'scegli la riga del testo',
  'karaoke.maker.captureGuidePlayback': 'riproduci o metti in pausa',
  'karaoke.maker.captureGuideWords': 'segna la parola successiva',
  'karaoke.maker.captureGuideUndo': 'annulla l’ultimo segno',
  'karaoke.maker.stopRecording': 'Interrompi registrazione',
  'karaoke.maker.markWord': 'Segna parola',
  'karaoke.maker.markNextWord': 'Parola successiva',
  'karaoke.maker.done': 'Fine',
  'karaoke.maker.ignoreLine': 'Ignora riga',
  'karaoke.maker.lineTimingComplete':
    'Sincronizzazione delle righe completata. Pronta da verificare e usare nel player.',
  'karaoke.maker.recordLinesHint':
    'INVIO segna inizio/fine · ↑/↓ sceglie la riga · ←/→ sposta solo l’audio di 2 s · SPAZIO riproduce o mette in pausa · Backspace annulla',
  'karaoke.maker.panView': 'Mano · sposta timeline',
  'karaoke.maker.panHint':
    'Strumento mano: trascina sul canvas per scorrere il brano senza modificare.',
  'karaoke.maker.scrubHint':
    'Fai clic o trascina la testina di riproduzione per scorrere il brano.',
  'karaoke.maker.addNote': 'Nota',
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
  'karaoke.maker.syllableEditorEyebrow': 'Editor sillabe',
  'karaoke.maker.syllableEditorTitle': 'Dividi “{word}”',
  'karaoke.maker.syllableEditorHint':
    'Fai clic tra le lettere per aggiungere o rimuovere una divisione sillabica.',
  'karaoke.maker.syllableSplitPoint': 'Cambia divisione dopo “{text}”',
  'karaoke.maker.syllableEditorPreview': 'Sillabe risultanti',
  'karaoke.maker.applySyllableSplit': 'Applica divisione',
  'karaoke.maker.hearNote': 'Ascolta la nota',
  'karaoke.maker.split': 'Dividi',
  'karaoke.maker.delete': 'Elimina',
  'karaoke.maker.analyze': 'Analizza melodia',
  'karaoke.maker.prepare': 'Prepara karaoke',
  'karaoke.maker.advanced': 'Avanzato',
  'karaoke.maker.prepared':
    'Questo karaoke contiene già note melodiche sincronizzate.',
  'karaoke.maker.repairLyrics': 'Rileva di nuovo i tempi del testo',
  'karaoke.maker.repairMelody': 'Rileva di nuovo le note della melodia',
  'karaoke.maker.rebuildKaraoke': 'Ricrea testo + melodia',
  'karaoke.maker.autoAlign': 'Allinea automaticamente',
  'karaoke.maker.aiMelody': 'Melodia IA',
  'karaoke.maker.transcribe': 'Trascrivi',
  'karaoke.maker.vocalStem': 'Usa traccia vocale',
  'karaoke.maker.vocalStemLoaded': 'Traccia vocale caricata',
  'karaoke.maker.groupVoice': 'Voce e musica',
  'karaoke.maker.stemsTitle': 'Tracce separate',
  'karaoke.maker.stemBacking': 'Base',
  'karaoke.maker.stemSaveAs': 'Salva {name} come',
  'karaoke.maker.stemSaveFormat': 'Salva {name} come {format}',
  'karaoke.maker.stemMp3Encoding': 'Codifica dell’MP3…',
  'karaoke.maker.stemMp3Saved': 'MP3 salvato.',
  'karaoke.maker.stemMp3Failed': 'Non è stato possibile codificare l’MP3.',
  'karaoke.maker.stemVoice': 'Voce',
  'karaoke.maker.stemSave': 'Salva',
  'karaoke.maker.groupLyrics': 'Testo e sincronizzazione',
  'karaoke.maker.removeBackground': 'Separa la voce dalla musica',
  'karaoke.maker.removeBackgroundDone': 'Voce già separata',
  'karaoke.maker.separationDownloading':
    'Download del modello di separazione ({percent}%) · una sola volta, circa 700 MB',
  'karaoke.maker.separationReading': 'Lettura del brano',
  'karaoke.maker.separating': 'Separazione della voce dalla musica',
  'karaoke.maker.separationDone':
    'Voce separata. Il rilevamento del testo è pronto.',
  'karaoke.maker.separationSlow':
    'Nessuna accelerazione grafica su questo computer: richiederà qualche minuto invece di meno di uno.',
  'karaoke.maker.separationRequired':
    'Separa prima la voce: il rilevamento del testo legge la traccia vocale isolata.',
  'karaoke.maker.separationRequiredMelody':
    'Separa prima la voce: il rilevamento delle note segue una sola voce, e in un mix di solito è uno strumento.',
  'karaoke.maker.wizardTitle': 'Prepara questo brano automaticamente',
  'karaoke.maker.wizardIntro':
    'Questo brano non ha ancora la sincronizzazione del testo. FluidEQ può separare la voce dalla musica e leggerne le parole e i tempi. Tutto viene eseguito su questo computer.',
  'karaoke.maker.wizardStepSeparate': 'Separa la voce',
  'karaoke.maker.wizardStepTranscribe': 'Leggi parole e tempi',
  'karaoke.maker.wizardLanguage': 'Lingua del testo',
  'karaoke.maker.wizardLanguageAuto': 'Rilevamento automatico',
  'karaoke.maker.wizardStart': 'Prepara automaticamente',
  'karaoke.maker.wizardSkip': 'Lo faccio io',
  'karaoke.maker.wizardCancel': 'Ferma',
  'karaoke.maker.wizardHide': 'Continua in background',
  'karaoke.maker.wizardCancelled':
    'Fermato. Ciò che è stato completato è stato mantenuto.',
  'karaoke.maker.vocalFocus': 'Metti a fuoco la voce centrale',
  'karaoke.maker.export': 'Esporta',
  'karaoke.maker.exportProject': 'Progetto FluidEQ',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': 'LRC avanzato',
  'karaoke.maker.exportInstrumental': 'Base musicale (senza voce)',
  'karaoke.maker.tapHint':
    'Premi SPAZIO o INVIO per “{word}” · Backspace annulla',
  'karaoke.maker.editHint':
    'Trascina le note per cambiare altezza/tempo. Trascina i bordi per ridimensionare. Ctrl + rotella ingrandisce.',
  'karaoke.maker.stats': '{notes} note · {words} parole · {checks} controlli',
  'karaoke.maker.wordStateLegend': 'Stato della temporizzazione del testo',
  'karaoke.maker.userAdjustedWords': '{count} regolate',
  'karaoke.maker.pendingWords': '{count} in sospeso',
  'karaoke.maker.artist': 'Artista',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': 'Zoom',
  'karaoke.maker.songPosition': 'Posizione nel brano',
  'karaoke.maker.previousView': 'Sezione precedente',
  'karaoke.maker.nextView': 'Sezione successiva',
  'karaoke.maker.resetZoom': 'Doppio clic per adattare il testo',
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
  'karaoke.maker.acceptLyrics': 'Accetta testo',
  'karaoke.maker.acceptAndRecordLines': 'Accetta e registra i tempi',
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
  'karaoke.maker.restore': 'Ripristina originale',
  'karaoke.maker.restoreTitle': 'Ripristinare il karaoke originale?',
  'karaoke.maker.restoreBody':
    'Questa operazione scarta tutte le modifiche di questa sessione e ricostruisce il karaoke come è stato importato, bozza salvata compresa. Dopo il ripristino è possibile annullare.',
  'karaoke.maker.restored': 'L’originale importato è stato ripristinato.',
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
  'karaoke.maker.allowAutoTiming': 'Consenti temporizzazione automatica',
  'karaoke.maker.replaceLyrics': 'Sostituisci testo',
  'karaoke.maker.lyricsAutoAligned':
    'Nuovo testo applicato e allineato alla melodia disponibile.',
  'karaoke.maker.lyricsNeedPreparation':
    'Nuovo testo applicato. Scegli Prepara karaoke per rilevarne i tempi.',
  'karaoke.maker.transcriptionEyebrow': 'TRASCRIZIONE LOCALE OPZIONALE',
  'karaoke.maker.transcriptionTitle': 'Scaricare il modello vocale locale?',
  'karaoke.maker.transcriptionBody':
    'FluidEQ scaricherà il modello {model} con licenza MIT da Hugging Face e lo terrà su questo PC: una sola volta, circa 570 MB con accelerazione grafica e circa 1,1 GB senza. Il tuo audio non lascia mai questo computer. La prima esecuzione richiede qualche minuto e molta memoria.',
  'karaoke.maker.transcriptionReview':
    'Il riconoscimento è solo un punto di partenza. FluidEQ conserva l’ortografia del tuo testo durante l’abbinamento e tutti i tempi restano modificabili.',
  'karaoke.maker.notNow': 'Non ora',
  'karaoke.maker.downloadTranscribe': 'Scarica e trascrivi',
  'karaoke.maker.downloadPrepare': 'Scarica e prepara il testo',
  'karaoke.maker.downloadingWhisper': 'Download del modello Whisper',
  'karaoke.maker.downloadOverall': 'Download complessivo',
  'karaoke.maker.downloadFiles': '{complete} di {total} file',
  'karaoke.maker.loadingWhisper': 'Caricamento del modello Whisper',
  'karaoke.maker.analysisRunning': 'Analisi locale dell’intonazione',
  'karaoke.maker.analysisAligned':
    'Le parole non modificate sono state allineate a {count} regioni di note rilevate. I tempi manuali sono stati conservati.',
  'karaoke.maker.analysisFound':
    'L’analisi ha trovato {count} regioni di note.',
  'karaoke.maker.basicPitchRunning':
    'Esecuzione del modello Basic Pitch incluso',
  'karaoke.maker.basicPitchFound':
    'Trovate {count} note di melodia modificabili dalla voce.',
  'karaoke.maker.whisperPreparing': 'Preparazione di Whisper',
  'karaoke.maker.whisperDecoding': 'Decodifica locale dell’audio',
  'karaoke.maker.whisperTranscribing': 'Trascrizione locale',
  'karaoke.maker.whisperTranscribingProgress':
    'Rilevamento tempi · passaggio {pass}/{passes} · blocco {chunk}/{chunks}',
  'karaoke.maker.whisperAligning': 'Adattamento del testo al canto',
  'karaoke.maker.whisperComplete': 'Trascrizione completata',
  'karaoke.maker.whisperMatched':
    'Whisper ha associato {count} parole riconosciute. Controlla i tempi modificabili prima dell’esportazione.',
  'karaoke.maker.autoAlignComplete':
    'Il testo non modificato è stato allineato alla melodia rilevata. I tempi manuali sono stati conservati.',
  'karaoke.maker.speechMemory': 'Memoria dei modelli IA',
  'karaoke.maker.speechMemoryReady': 'Pronto nella RAM',
  'karaoke.maker.speechMemoryCached': 'In cache sul disco',
  'karaoke.maker.speechMemoryMissing': 'Non scaricato',
  'karaoke.maker.modelWhisper': 'Voce (Whisper)',
  'karaoke.maker.modelPitch': 'Intonazione (RMVPE)',
  'karaoke.maker.modelSeparation': 'Separazione (RoFormer)',
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
  'karaoke.maker.exported': '{file} esportato',
  'karaoke.maker.exportedPartialLrc':
    '{file} esportato, senza {lines} righe di testo: LRC richiede un tempo sulla riga o su una delle sue parole, e queste non ne hanno alcuno. Assegna loro un tempo nel Maker ed esporta di nuovo per ottenere un file completo.',
  'karaoke.maker.exportedPartialUltraStar':
    '{file} esportato, senza {words} parole del testo: UltraStar riporta una parola solo dove la melodia ha una nota, e queste non ne hanno. Rileva o disegna le loro note ed esporta di nuovo per ottenere un file completo.',
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
  'karaoke.maker.analysisSource':
    '“{file}” viene usato solo come sorgente di analisi locale.',
  'karaoke.maker.rightsRequired':
    'Conferma di avere i diritti su audio e testo prima di pubblicare un’esportazione.',
  'karaoke.maker.draftRestored': 'Bozza ripristinata',
  'karaoke.maker.playerTimingLoaded':
    'Uso della temporizzazione attuale del lettore. Annulla ripristina la bozza salvata.',

  'karaoke.translation.picker': 'Lingua del testo',
  'karaoke.translation.original': 'Come registrato',
  'karaoke.translation.add': 'Aggiungi una lingua',
  'karaoke.translation.addPending':
    'Incollare una traduzione non è ancora disponibile.',
  'karaoke.translation.remove': 'Rimuovi questa lingua',
  'karaoke.translation.target': 'Lingua del testo che stai incollando',
  'karaoke.translation.paste':
    'Incolla il testo in quella lingua, una riga per ogni riga del brano.',
  'karaoke.translation.mismatch':
    'Il brano ha {expected} righe cantate e questo testo ne ha {received}. Allinea le righe a quelle numerate accanto al riquadro.',
  'karaoke.translation.fit': '{syllables} sillabe, {notes} note',
  'karaoke.translation.fitOk': 'Si adatta alla melodia',
  'karaoke.translation.empty': 'Ancora nessun testo in questa lingua.',
};

export default karaoke;
