/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.menu': 'Aiuto',
  'help.title': 'Guida utente',
  'help.subtitle': 'Trova il tuo suono. Sentiti a casa.',
  'help.intro':
    'Una guida pratica a FluidEQ con schermate reali. Inizia dal primo ascolto ed esplora ogni parte dell’app con calma.',
  'help.offline': 'Disponibile offline',
  'help.search': 'Cerca nella guida',
  'help.searchHint': 'Prova motore, bassi, visualizzatore…',
  'help.contents': 'In questa guida',
  'help.results': '{count} capitoli',
  'help.resultsOne': '{count} capitolo',
  'help.empty':
    'Nessun capitolo trovato. Prova una frase più breve o cancella la ricerca.',
  'help.clear': 'Cancella ricerca',
  'help.close': 'Chiudi guida',
  'help.enlarge': 'Ingrandisci schermata: {title}',
  'help.closeImage': 'Chiudi schermata',
  'help.controlsOf': 'Cosa fa ogni controllo: {title}',
  'help.captureNote':
    'Schermate reali di FluidEQ 1.6 e 1.7. Colori, nomi e posizioni possono variare nella tua versione. Le impostazioni sono esempi, non preset consigliati.',
  'help.steps': 'Prova',
  'help.tip': 'Da sapere',
  'help.back': 'Torna in alto',

  'help.group.start': 'Per iniziare',
  'help.group.sound': 'Modella il tuo suono',
  'help.group.visuals': 'Guarda la tua musica',
  'help.group.plus': 'FluidEQ Plus',
  'help.group.listen': 'Ascolta, canta e condividi',
  'help.group.help': 'Quando ti serve aiuto',

  'help.start.title': 'I tuoi primi cinque minuti',
  'help.start.intro':
    'Inizia con un brano familiare a un volume comodo. La colonna di sinistra accende FluidEQ e ospita la preamplificazione; al centro c’è lo spazio di lavoro; la colonna di destra segue l’uscita e i suoi profili. La barra in fondo alla finestra controlla ciò che è in riproduzione.',
  'help.start.steps':
    'Installa FluidEQ e, quando l’installazione chiede come elaborare il suono, lascia selezionato il motore FluidEQ. Windows chiede il permesso una sola volta, senza riavvio.\nScegli il tuo dispositivo d’ascolto in Dispositivo di uscita. Attiva EQ di sistema e lascia attivo Normalizza automaticamente.\nRiproduci un brano, apri EQ → Bande, modifica leggermente e confronta attivando e disattivando EQ di sistema.',
  'help.start.tip':
    'L’EQ di sistema richiede Windows e un motore audio: il motore FluidEQ o Equalizer APO. Su macOS e Linux l’app mostra uscite dimostrative, quindi lì un grafico in movimento non prova che venga elaborato qualcosa.',
  'help.start.keywords':
    'installare, installer, setup, primi passi, primo avvio, come iniziare, come usare, guida rapida, guida introduttiva, avvio rapido, introduzione, tutorial, principianti',

  'help.window.title': 'Orientarsi nella finestra',
  'help.window.intro':
    'L’intestazione ti porta da una pagina all’altra di FluidEQ e mostra il suono in tempo reale. La colonna di sinistra ospita l’interruttore generale dell’EQ, la preamplificazione e il misuratore di livello; la colonna di destra segue l’uscita e i suoi profili.',
  'help.window.steps':
    'Premi una pagina nell’intestazione: Media online, Condividi audio ed EQ stanno prima del segnale; DSP, Libreria, Karaoke e Plus dopo.\nAttiva EQ di sistema nella colonna di sinistra e lascia attivo Normalizza automaticamente, così nessun rinforzo va in saturazione.\nPremi il segnale o il misuratore di livello per cambiare come viene disegnato, e Modalità arcobaleno per far muovere curve e misuratori alla piena frequenza del tuo schermo.',
  'help.window.tip':
    'Il menu Aiuto apre questa guida, Novità, la risoluzione dei problemi audio e Segnala un problema. Il pulsante a impulso accanto ad Aiuto contiene la scheda del motore, il tuo account, l’importazione di impostazioni EQ o di una risposta all’impulso, il riavvio dell’audio di Windows e Processi, che mostra cosa sta usando ogni parte di FluidEQ; in fondo al menu ci sono Luminosità e Trasparenza, le animazioni, Avvia con Windows e la lingua. L’interruttore dopo questi due pulsanti trasforma la finestra nel Lettore compatto.',
  'help.window.keywords':
    'interfaccia, navigazione, panoramica, schermata principale, barra superiore, barra di riproduzione, pannello laterale, layout, tab, header, toolbar, vumetro, VU meter, indicatore di livello, tema, tema scuro, tema chiaro, modalità scura, modalità chiara, dark mode, lingua, cambiare lingua, avvio con windows, avvio automatico, esecuzione automatica, all’avvio, account',
  'help.window.headerLeftCaption': 'L’intestazione, fino al segnale',
  'help.window.headerRightCaption': 'L’intestazione, dopo il segnale',
  'help.window.railCaption': 'La colonna di sinistra',
  'help.window.media':
    'YouTube, YouTube Music, Bandcamp, Twitch e Suno, riprodotti dentro FluidEQ con il tuo EQ applicato.',
  'help.window.share':
    'Invia il suono di questo computer a un altro, o riproduce qui quello di un altro.',
  'help.window.eq':
    'Le tue bande, i preset, la correzione delle cuffie, i preset di gioco e la configurazione del motore.',
  'help.window.waveName': 'Segnale audio',
  'help.window.wave':
    'Ciò che è in riproduzione, in tempo reale. Premilo per cambiare come viene disegnato.',
  'help.window.rainbow':
    'Colora la finestra e disegna curve e misuratori alla piena frequenza del tuo schermo.',
  'help.window.dsp':
    'Il rack degli effetti: i preset, la Stanza e ogni stadio della catena.',
  'help.window.library':
    'I tuoi file musicali, gli album e la coda di riproduzione.',
  'help.window.karaoke':
    'Canta insieme alla musica e trasforma i tuoi brani in karaoke.',
  'help.window.plus': 'Visualizzatori, la galleria, la classifica e lo Studio.',
  'help.window.support': 'Modi per sostenere il lavoro su FluidEQ.',
  'help.window.help':
    'Questa guida, Novità, la risoluzione dei problemi audio e Segnala un problema.',
  'help.window.actions':
    'Il motore, il tuo account, l’importazione delle impostazioni EQ, il riavvio dell’audio di Windows e Processi; Luminosità e Trasparenza, le animazioni, Avvia con Windows e la lingua.',
  'help.window.systemEq':
    'Attiva o disattiva l’elaborazione di FluidEQ per tutto ciò che il PC riproduce.',
  'help.window.preamp':
    'Abbassa il livello prima dell’EQ per lasciare spazio ai rinforzi. Normalizza automaticamente se ne occupa per te.',
  'help.window.autoNormalize':
    'Tiene la preamplificazione bassa quanto basta perché nessun rinforzo vada in saturazione.',
  'help.window.responseGraph': 'Mostra o nasconde il grafico di risposta.',
  'help.window.meterName': 'Misuratore di livello',
  'help.window.meter':
    'Il livello di uscita, sinistro e destro, in decibel reali. Premilo per cambiarne lo stile.',
  'help.player.title': 'Il Lettore compatto',
  'help.player.intro':
    'Un interruttore trasforma la finestra di FluidEQ nel Lettore compatto: una colonna stretta con il brano, il tuo equalizzatore, un visualizzatore e In coda, in pannelli che apri e chiudi. Ciò che è in riproduzione continua a suonare, e lo stesso interruttore riporta l’app completa sulla pagina che avevi lasciato.',
  'help.player.steps':
    'Premi l’interruttore Lettore compatto nella barra del titolo, accanto ad Aiuto. Sul lettore, lo stesso interruttore riporta l’app completa.\nApri e chiudi i pannelli con EQ, Visual e Coda. La finestra cresce e si riduce di quanto occupa ciascuno, e il lettore ricorda la sua dimensione e la sua posizione.\nPer ridurre il lettore a una riga, fai doppio clic sulla sua barra o scegli Riduci a una riga nel suo menu; il logo di FluidEQ lo espande di nuovo.\nNel menu del lettore scegli il suo tema, e tienilo sopra le altre finestre con Sempre in primo piano.\nTrascina file musicali su In coda: entrano nella Libreria e nella coda.',
  'help.player.tip':
    'Il volume del lettore è quello del tuo computer, lo stesso di Windows, quindi regola il livello di tutto ciò che il computer riproduce. Se il lettore finisce fuori dallo schermo, fai clic destro su FluidEQ nell’area di notifica della barra delle applicazioni e scegli Ripristina la finestra.',
  'help.player.keywords':
    'mini player, mini lettore, lettore piccolo, lettore compatto, modalità compatta, winamp, amp, modalità lettore, sempre in primo piano, always on top, in primo piano, ridurre a una riga, una riga, rimpicciolire, coda, prossimi brani, trascinare file, trascina e rilascia, tema, tema chiaro, tema scuro, modalità chiara, modalità scura, dark mode, finestra piccola, lettore fluttuante, volume',
  'help.player.topCaption': 'In alto: il brano e la sua riproduzione',
  'help.player.eqCaption': 'L’equalizzatore',
  'help.player.queueCaption': 'In coda',
  'help.player.menuCaption': 'Il menu del lettore',
  'help.player.foldedCaption': 'Ridotto a una riga',
  'help.player.menu':
    'Il ritorno all’app completa o a una delle sue pagine, il tema del lettore, Sempre in primo piano e Riduci a una riga.',
  'help.player.pin': 'Tiene il lettore sopra tutte le altre finestre.',
  'help.player.switch':
    'Torna all’app completa, sulla pagina che avevi lasciato.',
  'help.player.clock':
    'Il tempo trascorso. Fai clic per vedere quello rimanente.',
  'help.player.well':
    'Il suono in tempo reale. Fai clic per passare dalle barre all’onda.',
  'help.player.level': 'Il livello del suono in uscita da FluidEQ, in decibel.',
  'help.player.volume':
    'Il volume del tuo computer, lo stesso di Windows: regola il livello di tutto ciò che il computer riproduce.',
  'help.player.decksName': 'EQ, Visual e Coda',
  'help.player.decks':
    'Aprono e chiudono l’equalizzatore, il visualizzatore e In coda. La finestra cresce e si riduce di quanto occupa ciascuno.',
  'help.player.seek': 'A che punto è il brano. Trascina per spostarti.',
  'help.player.playingName': 'Controlli di riproduzione',
  'help.player.playing':
    'Precedente, indietro di cinque secondi, riproduci o pausa, avanti di cinque secondi, successivo e ferma.',
  'help.player.orderName': 'Casuale e ripetizione',
  'help.player.order':
    'Mescola In coda, e non ripete nulla, ripete tutto o solo questo brano.',
  'help.player.lookName': 'Stile successivo',
  'help.player.look':
    'Cambia l’aspetto del visualizzatore. Ctrl+click torna al precedente, e il clic destro li elenca tutti.',
  'help.player.screen':
    'Ciò che senti, disegnato: le tue bande, l’EQ intelligente e tutto il resto applicato, sopra un aspetto del visualizzatore. Applicato anche li elenca, e un’etichetta ne spegne uno senza toglierlo.',
  'help.player.bands':
    'Trascina una banda in su o in giù per rinforzarla o tagliarla. La sua frequenza è scritta sotto.',
  'help.player.tone':
    'Bande mostra tutte le bande; Tono le sostituisce con le manopole Bassi, Medi e Alti.',
  'help.player.upNext':
    'La tua posizione nella coda, il tempo che resta e quanto ne hai già ascoltato.',
  'help.player.library': 'Apre la Libreria nell’app completa.',
  'help.player.songsName': 'I brani',
  'help.player.songs':
    'Cosa suona dopo. Fai doppio clic su un brano per riprodurlo, o trascina qui dei file musicali per aggiungerli.',
  'help.player.openIn': 'Apre l’app completa su una delle sue pagine.',
  'help.player.theme':
    'Il tema Chiaro o Scuro del lettore, separato da quello dell’app completa.',
  'help.player.fold':
    'Riduce il lettore a una riga. Il doppio clic sulla sua barra fa lo stesso.',
  'help.player.unfold':
    'Espande il lettore. Lo fa anche la freccia all’altra estremità.',
  'help.player.foldedPlaying':
    'Precedente, riproduci o pausa, successivo e ferma.',
  'help.player.foldedClock': 'Il tempo, e a che punto è il brano.',

  'help.requirements.title': 'Che cosa serve al tuo PC',
  'help.requirements.intro':
    'FluidEQ gira su qualsiasi PC Windows degli ultimi dieci anni. Due parti chiedono più delle altre: i visualizzatori Plus disegnano sulla scheda grafica e il karaoke con IA scarica i suoi modelli la prima volta che lo usi.',
  'help.requirements.steps':
    'Controlla il tuo Windows: Windows 10 versione 1803 o successiva, oppure Windows 11, a 64 bit, 4 GB di memoria e circa 600 MB di disco. Per elaborare tutto ciò che il PC riproduce serve il motore FluidEQ o Equalizer APO, e Windows chiede il permesso una volta durante l’installazione.\nApri un visualizzatore: qualsiasi scheda grafica o grafica integrata dal 2013 in poi. A 1080p la grafica integrata basta; per il 4K, o uno sfondo del desktop su più schermi insieme, è meglio una scheda dedicata. Se la scheda è occupata, FluidEQ disegna la scena più piccola e lascia andare quelle che non stai guardando.\nProva il karaoke con IA: separare la voce scarica un modello da 713 MB la prima volta, quello dell’intonazione aggiunge circa 180 MB e la rimozione del rumore 11 MB. Con una scheda grafica con DirectX 12 un brano di quattro minuti si separa in circa mezzo minuto; con il solo processore servono circa quattro minuti. Tieni liberi 2 GB di memoria mentre lavora.\nPunta a questo se puoi: Windows 11, 8 GB di memoria, grafica dal 2018 in poi e 3 GB di disco liberi se usi le funzioni con IA.',
  'help.requirements.tip':
    'Tutto tranne i modelli di IA è nell’installatore, e quelli si scaricano solo al primo uso della funzione. Processi, nel menu delle azioni, mostra che cosa sta usando ogni parte di FluidEQ sulla tua macchina in questo momento.',
  'help.requirements.keywords':
    'requisiti di sistema, requisiti minimi, requisiti consigliati, specifiche tecniche, hardware, sistema operativo, compatibilità, GPU, scheda video, CPU, RAM, spazio su disco, consumo risorse, portatile, notebook, prestazioni, lento, lag, macOS, Linux',

  'help.engine.title': 'Il motore FluidEQ',
  'help.engine.intro':
    'FluidEQ elabora il suono con il proprio motore o con Equalizer APO. Il motore FluidEQ gira dentro il servizio audio di Windows dopo gli effetti della tua scheda audio, applica il tuo EQ e il rack DSP a tutto ciò che il PC riproduce e si fa da parte appena FluidEQ si chiude.',
  'help.engine.steps':
    'Apri il menu delle azioni (il pulsante a impulso in alto a destra) e fai clic sulla scheda del motore, in cima.\nScegli Motore FluidEQ e premi Applica. Windows chiede il permesso e l’audio si interrompe per qualche secondo mentre si riavvia.\nSe un’uscita mostra DISATT., premi Attiva nel suo avviso. Se un avviso dice che il motore non è in funzione, premi Riavvia l’audio di Windows.',
  'help.engine.tip':
    'Equalizer APO resta disponibile per i comandi personalizzati di APO, Peace e i plugin VST. Quando un aggiornamento porta un motore più recente, un avviso propone Aggiorna il motore. Uscire da FluidEQ dall’area di notifica spegne l’EQ su tutte le uscite.',
  'help.engine.keywords':
    'engine, equalizzatore di sistema, driver audio, globale, tutti i programmi, Spotify, Discord, browser, abilitare, attivare, amministratore, aggiornare motore',
  'help.engine.fluid':
    'Consigliato. Gli effetti della tua scheda audio continuano a funzionare, e l’EQ e il rack DSP arrivano a ogni app.',
  'help.engine.apo':
    'Esegue i comandi personalizzati di APO, Peace e i plugin VST. Il rack DSP resta legato alla riproduzione della Libreria.',
  'help.engine.apply':
    'Cambia il motore. Windows chiede il permesso una volta e l’audio si riavvia per qualche secondo.',

  'help.eq.title': 'Modella il suono con EQ',
  'help.eq.intro':
    'Frequenza sceglie dove agisce la banda; Guadagno, il rinforzo o taglio; Q, la larghezza: Q più alto significa banda più stretta. Senza bande selezionate, le manopole del Tono — Bassi, Medi e Alti, con Taglio bassi e Taglio alti ai lati — modellano il suono come una curva a sé e lasciano le tue bande come sono. Inizia con correzioni leggere e larghe e confronta spesso.',
  'help.eq.steps':
    'Apri EQ → Bande. Senza selezionare nulla, ruota Bassi, Medi o Alti per cambiare rapidamente il tono, e Taglio bassi o Taglio alti per rifilare gli estremi. Nel grafico disegnano la propria linea del Tono.\nFai clic sulla frequenza di una banda, o sul suo punto nel grafico, per selezionarla. Ruota le manopole Frequenza, Guadagno e Fattore Q, scegli un Filtro o spegnila con l’interruttore Attiva.\nFai clic destro su una banda per ripristinarla, disattivarla o aggiungere una banda accanto. Premi Azzera l’EQ per portare ogni guadagno, e anche Bassi, Medi e Alti, a 0 dB mantenendo le bande. Prima chiede conferma.',
  'help.eq.tip':
    'Applicato anche elenca i livelli che modellano questa uscita oltre alle tue bande, ognuno con la sua intensità e la sua ×. Modalità gioco riduce il ritardo aggiunto da FluidEQ, per giochi e chiamate; i preset Gaming la attivano.',
  'help.eq.keywords':
    'equalizzatore, equalizzazione, equalizzare, equalizer, parametrico, acuti, bass boost, aumentare bassi, alzare bassi, controllo toni, gain, peaking, shelving, low pass, high pass, regolare audio, migliorare audio, azzerare EQ, resettare EQ',
  'help.eq.bandsCaption': 'La pagina Bande, senza selezione',
  'help.eq.bandCaption': 'Una banda selezionata',
  'help.eq.gameMode':
    'Riduce il ritardo aggiunto da FluidEQ, per giochi e chiamate. I preset Gaming la attivano.',
  'help.eq.layers':
    'Cos’altro modella questa uscita — una correzione delle cuffie, l’EQ intelligente, una convoluzione — ognuno con la sua intensità, il suo interruttore e la sua ×.',
  'help.eq.bandName': 'Una banda',
  'help.eq.band':
    'Trascina il suo punto per rinforzare o tagliare. Fai clic sulla sua frequenza per selezionarla.',
  'help.eq.bass': 'Alza o abbassa le basse frequenze di tutta la curva.',
  'help.eq.mid': 'Alza o abbassa le frequenze medie, dove si trovano le voci.',
  'help.eq.treble': 'Alza o abbassa le alte frequenze, l’aria e il dettaglio.',
  'help.eq.selected':
    'La banda che stai modificando. Ctrl+click o Maiusc+click per selezionarne più di una.',
  'help.eq.filter':
    'La sua forma: Campana, Notch, Shelf bassi, Shelf alti, Passa-basso, Passa-alto o Passa-banda.',
  'help.eq.voicing':
    'Una catena già pronta per il suono, come Musica o un genere. Nessuno lascia solo le tue bande.',
  'help.eq.smart':
    'Ascolta ciò che suona e lo corregge: Dettaglio, Equilibrio o Obiettivo.',
  'help.eq.clear':
    'Porta ogni guadagno a 0 dB e mantiene le bande. Prima chiede conferma.',
  'help.eq.mode':
    'Quanto agiscono il tuo EQ e le curve, il Q delle bande e la fase.',
  'help.eq.add': 'Aggiunge una banda accanto a quella selezionata.',
  'help.eq.layouts': 'Il numero di bande e le disposizioni che hai salvato.',
  'help.eq.frequency': 'Dove agisce la banda selezionata, da 1 Hz a 20 kHz.',
  'help.eq.gain': 'Quanto rinforza o taglia. Ctrl+click lo riporta a 0 dB.',
  'help.eq.q':
    'Quanto è larga la banda: un valore più alto la rende più stretta.',
  'help.eq.delete':
    'Premi due volte per eliminare la banda; Mantieni annulla l’eliminazione.',
  'help.eq.menuCaption': 'Il menu contestuale di una banda',
  'help.eq.reset': 'Riporta il guadagno a 0 dB e il Q a 2.',
  'help.eq.disable': 'Toglie la banda dal suono e ne conserva le impostazioni.',
  'help.eq.addLeft':
    'Aggiunge una banda a metà strada verso la banda vicina più bassa.',
  'help.eq.addRight':
    'Aggiunge una banda a metà strada verso la banda vicina più alta.',

  'help.eqmode.title': 'Modalità EQ e disposizioni delle bande',
  'help.eqmode.intro':
    'Modalità EQ cambia il modo in cui il suono viene modellato, senza modificare nulla. Il tuo EQ comprende le tue bande, il Tono, i preset, il Tipo di driver e l’EQ intelligente; Correzioni comprende le correzioni delle cuffie e le curve importate o personalizzate. Le disposizioni delle bande salvano frequenze e Q di un assetto che ti piace, pronto per qualsiasi uscita.',
  'help.eqmode.steps':
    'Apri Modalità EQ nella barra di Bande. Prova un’opzione di Intensità, Q delle bande o Levigatura curve mentre suona la musica; il pannello resta aperto.\nCon il motore FluidEQ, scegli la fase Minima o Lineare, e Preciso o Classico per gli alti. Premi Ripristina per riportare tutto a Normale.\nPremi il pulsante delle disposizioni accanto ad Aggiungi banda. Scegli 6, 10, 15, 20 o 31 bande, oppure premi Salva disposizione… per dare un nome alla disposizione attuale.',
  'help.eqmode.tip':
    'Una disposizione salva solo frequenze e Q: caricarne una fa partire ogni banda da 0 dB. La fase lineare aggiunge ritardo e può risuonare prima dei transienti.',
  'help.eqmode.keywords':
    'numero di bande, quante bande, layout bande, equalizzatore grafico, smoothing, linear phase, alti, preciso, classico',
  'help.eqmode.modeCaption': 'Modalità EQ',
  'help.eqmode.strength':
    'Normale, Studio ×1.5 o ×2, per Il tuo EQ e per le Correzioni separatamente.',
  'help.eqmode.q':
    'Costante mantiene ogni Q; Proporzionale e Asimmetrico stringono le bande man mano che crescono.',
  'help.eqmode.smoothing': 'Ammorbidisce le curve di correzione campionate.',
  'help.eqmode.phase': 'Minima o Lineare. Solo con il motore FluidEQ.',
  'help.eqmode.treble':
    'Preciso suona come disegnato, Classico come in Equalizer APO. Solo con il motore FluidEQ.',
  'help.eqmode.reset': 'Riporta tutto a Normale.',
  'help.eqmode.designsCaption': 'Disposizioni delle bande',
  'help.eqmode.builtIn': 'Disposizioni standard da 6, 10, 15, 20 o 31 bande.',
  'help.eqmode.save':
    'Salva con un nome le frequenze e i Q attuali come disposizione, elencata in Le mie disposizioni.',

  'help.games.title': 'Preset di gioco',
  'help.games.intro':
    'Dai a ogni gioco il suo suono. Quando il gioco passa in primo piano, FluidEQ attiva quel suono e lo mantiene finché non chiudi il gioco, anche se nel frattempo passi ad altro con Alt+Tab. Poi rimette quello che avevi.',
  'help.games.steps':
    'Apri EQ → Preset di gioco e premi Aggiungi un gioco. Scegline uno dai tuoi launcher o tra i programmi aperti ora, oppure indica tu il suo programma.\nNel selettore sulla sua riga scegli il suono che deve avere: un preset Gaming o qualsiasi altro.\nAvvia il gioco. Una scheda sul desktop dice a quale suono è passato FluidEQ e, quando lo chiudi, un’altra dice quale è tornato.',
  'help.games.tip':
    'Finché il suono di un gioco è attivo, la barra in fondo alla finestra ne mostra il nome. Se scegli un altro suono mentre giochi, resta: FluidEQ annulla solo le proprie modifiche. I preset Gaming attivano anche Modalità gioco.',
  'help.games.keywords':
    'videogiochi, EQ per giochi, giocare, aggiungere gioco, profilo gioco, cambio automatico, sparatutto, FPS, competitivo, passi dei nemici, sentire i passi, game mode',
  'help.games.tab': 'I tuoi giochi e il suono che riceve ciascuno.',
  'help.games.add':
    'Aggiunge un gioco da Steam, Epic, EA, GOG, Ubisoft, Battle.net o Xbox, oppure qualsiasi programma aperto ora.',
  'help.games.gameName': 'Un gioco',
  'help.games.game': 'Il gioco e la cartella con cui FluidEQ lo riconosce.',
  'help.games.soundName': 'Il suo suono',
  'help.games.sound':
    'Il suono che FluidEQ attiva quando questo gioco passa in primo piano, oppure Lascia com’è.',
  'help.games.removeName': 'Rimuovi',
  'help.games.remove': 'Dimentica il gioco. Il preset che usava resta.',

  'help.headphones.title': 'Correzione delle cuffie e importazione',
  'help.headphones.intro':
    'La correzione compensa un modello misurato e si combina con le tue bande e i tuoi preset. Verifica il modello esatto e l’autore della misura.',
  'help.headphones.steps':
    'Apri EQ → Preset EQ e cerca le tue cuffie. Controlla le misure disponibili e scegli quella corrispondente.\nPer il testo EQ di un altro programma, usa Importa impostazioni EQ nel menu delle azioni. Controlla bande e curva prima di applicare.\nPer Squiglink, incolla la sua esportazione nel pannello di importazione. Applica come EQ sostituisce le tue bande; Applica come curva la aggiunge come correzione delle cuffie con la sua intensità.',
  'help.headphones.tip':
    'Un’anteprima segnata come Non applicata non cambia il suono. Evita di sommare per errore due correzioni complete per le stesse cuffie.',
  'help.headphones.keywords':
    'AutoEq, auricolari, cuffiette, IEM, in-ear, profilo cuffie, equalizzazione cuffie, importare EQ, calibrazione, Harman, curva target, misurazioni, risposta in frequenza, Crinacle, oratory1990',

  'help.convolution.title': 'Usa una risposta all’impulso',
  'help.convolution.intro':
    'Convoluzione applica un impulso WAV come livello separato. Cerca nel catalogo AutoEq o importa un WAV; le bande parametriche restano indipendenti.',
  'help.convolution.steps':
    'Apri EQ → Convoluzione e cerca per modello o autore della misura.\nControlla la fonte, poi usa Scarica e applica: il download corrisponde alla frequenza della tua uscita. Usa Importa un WAV per un file che hai già.\nAscolta con il livello di convoluzione acceso e spento in Applicato anche.',
  'help.convolution.tip':
    'Il motore FluidEQ converte da solo qualsiasi frequenza dell’impulso. Equalizer APO richiede un WAV importato alla frequenza dell’uscita. Il catalogo richiede una connessione per scaricare; questa guida no.',
  'help.convolution.keywords':
    'IR, risposta impulsiva, caricare IR, convolver, FIR, room correction, correzione acustica, REW, frequenza di campionamento, sample rate',

  'help.profiles.title': 'Dispositivi, profili e seconda uscita',
  'help.profiles.intro':
    'L’EQ segue il dispositivo di uscita. Le modifiche si salvano nel profilo attivo sull’uscita corrente; Profili conserva suoni alternativi. Seconda uscita duplica l’audio su altri dispositivi con un livello per ciascuno.',
  'help.profiles.steps':
    'Verifica l’uscita in cima alla scheda Uscita prima di modificare. Nuovo profilo conserva un suono; Aggiorna salva le modifiche e Ripristina recupera le impostazioni salvate.\nApri Seconda uscita, attiva un dispositivo raggiungibile e imposta il livello. Scegli il suo profilo EQ salvato subito sotto di esso.\nUsa Gioco/Video per una riserva iniziale minore o Musica per più margine. Controlla la sincronizzazione sui tuoi dispositivi.',
  'help.profiles.tip':
    'Ogni uscita duplicata usa il proprio profilo con entrambi i motori. La duplicazione richiede FluidEQ aperto e si ferma cambiando uscita principale. Conta anche la latenza dei dispositivi.',
  'help.profiles.keywords':
    'casse, speaker, cambiare dispositivo, creare profilo, due uscite, uscite multiple, Bluetooth, sync, ritardo, sfasato, DAC, salvare impostazioni',
  'help.profiles.list':
    'I suoni che hai salvato. ATT indica quello usato da questa uscita; premine un altro per passarci.',
  'help.profiles.update': 'Salva le tue modifiche nel profilo che stai usando.',
  'help.profiles.new': 'Crea un nuovo profilo dall’EQ che hai adesso.',
  'help.profiles.restore':
    'Riporta il profilo com’era quando l’hai salvato l’ultima volta.',
  'help.profiles.output':
    'L’uscita con cui stai ascoltando. DISATT. significa che il tuo EQ non la raggiunge; ATTIVO, che Windows sta riproducendo attraverso di essa.',
  'help.profiles.mapping':
    'Il profilo seguito da questa uscita. Ogni modifica che fai viene salvata lì automaticamente.',
  'help.profiles.onePlayer':
    'Avviare qualcosa in FluidEQ mette in pausa ciò che suona altrove sul PC, e viceversa.',
  'help.profiles.outputs':
    'Le tue altre uscite. Attivane una per sentire il suono anche lì, con il suo profilo.',
  'help.profiles.driver':
    'Un punto di partenza delicato per ciò con cui ascolti — cuffie, auricolari, dimensione o materiale del driver. Lascialo su Nessuna compensazione se il suono è già giusto.',

  'help.config.title': 'Controlla e salva una catena',
  'help.config.intro':
    'EQ → Config mostra ciò che il motore audio ha realmente su disco. Schede uscita e albero delle inclusioni mostrano dispositivi e livelli. Esporta una catena prima di grandi esperimenti o quando sposti una configurazione.',
  'help.config.steps':
    'Apri EQ → Config, scegli l’uscita e controlla stato e livelli.\nUsa Esporta catena per salvare un file .fluideq.\nPer ripristinarlo, scegli prima l’uscita giusta, usa Importa catena e controlla il risultato.',
  'help.config.tip':
    'I file generati vengono riscritti quando cambiano le loro impostazioni; metti le righe manuali permanenti nel file personalizzato dell’uscita. Il motore FluidEQ ne legge le righe Filter, Preamp, GraphicEQ e Convolution; gli altri comandi APO e i plugin richiedono Equalizer APO.',
  'help.config.keywords':
    'backup, copia di sicurezza, esportare, importare, trasferire impostazioni, impostazioni avanzate, config.txt, include',

  'help.dsp.title': 'Esplora il rack DSP',
  'help.dsp.intro':
    'Il rack DSP è una catena di stadi da studio. Con il motore FluidEQ elabora tutto ciò che il PC riproduce; con Equalizer APO elabora le tracce audio della Libreria. Resta spento mentre FluidEQ è spento.',
  'help.dsp.steps':
    'Apri DSP. Scegli una catena in Preset, oppure seleziona uno stadio nella colonna laterale e mettilo su Attivo.\nCambia un controllo alla volta e confronta disattivando lo stadio a volume simile. Isola ti fa sentire solo ciò che uno stadio aggiunge.\nSalva un rack che ti piace e usa Esporta e Importa per condividerlo.',
  'help.dsp.tip':
    'Un suono più forte spesso sembra migliore solo perché è più forte, quindi confronta a parità di livello. Ctrl+click su una manopola la riporta al valore predefinito.',
  'help.dsp.keywords':
    'effetti, FX, limiter, limitatore, loudness, normalizzazione volume, normalizzare, livellamento, volume costante, enhancer, allargamento stereo, stereo widener, sub bass, subarmoniche, transienti, mastering, crossfade, gapless, aumentare volume, alzare volume, amplificatore di volume',
  'help.dsp.normalizer':
    'Uniforma la sonorità. Sull’audio dal vivo livella un brano alla volta.',
  'help.dsp.denoise':
    'Ripara fruscio, ronzio e click. Il pulitore vocale neurale funziona sui brani della Libreria.',
  'help.dsp.exciter': 'Aggiunge armoniche per corpo e aria.',
  'help.dsp.bassForge':
    'Aggiunge un’ottava reale sotto il basso, o le sue armoniche per gli altoparlanti piccoli.',
  'help.dsp.equaliser': 'Quindici bande parametriche, a fase minima o lineare.',
  'help.dsp.bassPunch': 'Modella attacco, sostegno e fioritura dei bassi.',
  'help.dsp.dimension':
    'Allarga l’immagine stereo senza cambiare la somma mono.',
  'help.dsp.maximizer':
    'Alza il livello senza lasciare che i picchi superino il tetto.',
  'help.dsp.master':
    'Livello finale, obiettivo di sonorità e protezione dei picchi.',
  'help.dsp.crossfade': 'Fonde un brano della Libreria con il successivo.',
  'help.dsp.presets':
    'Catene complete del rack per generi, dispositivi e riparazioni.',
  'help.dsp.scopeName': 'Su tutto il sistema',
  'help.dsp.scope':
    'Dove sta lavorando il rack e l’eventuale ritardo aggiunto dalla fase lineare.',

  'help.room.title': 'La Stanza: surround in cuffia',
  'help.room.intro':
    'La Stanza trasforma le cuffie in una sala d’ascolto. Ogni canale del suono diventa un diffusore intorno alla tua testa, reso attraverso una testa misurata e le riflessioni di una stanza che modelli tu stesso, così un film sta davanti a te e un gioco ti circonda. Richiede il motore FluidEQ e le cuffie; sui diffusori non serve a nulla.',
  'help.room.steps':
    'Apri DSP, scegli Stanza nella barra e accendila. Lo stereo diventa due diffusori davanti a te; un film 5.1 cinque e il sub; un gioco 7.1 l’intero anello. Il chip accanto all’interruttore dice quale.\nScegli una stanza in alto — studio, salotto, cinema, sala da concerto e altre — oppure gira Dimensione, Pareti e Distanza da solo e trascina un diffusore lungo l’anello. I diffusori che il flusso in riproduzione non raggiunge sono disegnati addormentati.\nPremi Avvia la prova d’ascolto e rispondi a cinque brevi coppie d’ascolto: la stanza prende la testa che mette i suoni davanti a te. Piccola, Media e Grande si scelgono anche a mano.\nSalva una stanza che ti piace con un nome; una stanza salvata torna con una pressione e non cambia mai la tua testa.',
  'help.room.tip':
    "Giochi e film inviano i loro canali surround solo a un'uscita che Windows crede abbia altrettanti altoparlanti: quando il driver lo accetta, il pannello di uscita offre un tocco per passare a 7.1.",
  'help.room.keywords':
    'surround virtuale, simulazione surround, audio spaziale, immersivo, 3D, binaurale, HRTF, virtualizzatore, riverbero, eco, soundstage, crossfeed, room',
  'help.room.picker':
    'Le stanze da cui partire, raggruppate come i preset di ogni altro stadio; Personalizzato appena ne modelli una.',
  'help.room.picture':
    "La stanza vista dall'alto: pareti che sbiadiscono assorbendo, gli altoparlanti sul loro anello, la testa al centro. È tutto disegnato in un'unica scala, quindi un altoparlante più lontano di quanto la stanza sia larga viene disegnato fuori dalle sue pareti. Trascinane uno e il suo gemello lo segue; tieni Maiusc per spostarlo da solo.",
  'help.room.speaker':
    'Tocca un altoparlante nella stanza e questo riquadro diventa il suo: il suo angolo come numero, la sua distanza, il suo livello, e Muto o Solo per ascoltarlo da solo.',
  'help.room.speakerName': "L'altoparlante scelto",
  'help.room.dialsName': 'Spazio, Ambiente, Distanza',
  'help.room.dials':
    'Quanto senti delle pareti, la coda morbida che le segue e quanto sono lontani gli altoparlanti. Dimensione, Pareti e la lunghezza e il tono della coda sono in Carattere della stanza, qui sotto.',
  'help.room.fit':
    'Cinque coppie d’ascolto che scelgono la testa per le tue orecchie.',
  'help.room.head':
    'La testa misurata attraverso cui la stanza viene resa: piccola, media o grande.',
  'help.room.saved':
    'Dai un nome alla stanza così com’è; torna con una pressione.',
  'help.room.liveName': 'Cosa sta facendo la stanza',
  'help.room.live':
    'Letto dal motore: quali diffusori il flusso in riproduzione raggiunge, o perché la stanza è ferma.',

  'help.denoise.title': 'Riduzione del rumore e analisi',
  'help.denoise.intro':
    'Riduzione del rumore attenua fruscio, ronzio di rete e click. Con il motore FluidEQ lavora dal vivo su qualsiasi cosa il PC riproduca; il pulitore vocale neurale e il rumore di fondo analizzato sono per i brani della Libreria. Una riduzione più forte non è automaticamente migliore.',
  'help.denoise.steps':
    'Riproduci qualcosa con il rumore che vuoi ridurre e seleziona Riduzione del rumore in DSP.\nAttiva Fruscio, Ronzio o Click con un’impostazione leggera e ascolta i passaggi quieti e i dettagli musicali.\nAumenta gradualmente la riduzione, poi disattiva lo stadio per verificare che il miglioramento valga l’eventuale perdita di dettaglio.',
  'help.denoise.tip':
    'Ascolta se i dettagli si ammorbidiscono o se compaiono suoni acquosi o effetti di pompaggio. Non serve a pulire il microfono. Se non senti differenze, verifica che rack e stadio siano entrambi attivi.',
  'help.denoise.keywords':
    'rimuovere rumore, rimozione rumore, eliminare rumore, togliere rumore, pulire audio, pulizia audio, denoise, noise reduction, soffio, brusio, interferenze, crepitio, vinile, restauro, vecchie registrazioni',

  'help.graph.title': 'Il grafico e i suoi controlli',
  'help.graph.intro':
    'Il grafico di risposta disegna le curve del tuo EQ sopra il suono dal vivo. La barra sopra il grafico sceglie cosa viene disegnato e come, e cambia con l’aspetto: uno stile standard o un visualizzatore Plus.',
  'help.graph.steps':
    'Fai clic sul nome dell’aspetto per scegliere uno stile o un visualizzatore. Le frecce accanto, Spazio e Ctrl+Spazio li scorrono.\nApri Vista per la dimensione del grafico, ciò che mostra e l’altezza e la posizione dell’onda. Anche la frequenza dei fotogrammi è lì: tutti i fotogrammi che offre il tuo schermo, oppure 60 o 30, e 60 a batteria.\nUn visualizzatore Plus aggiunge a Vista i propri comandi — quello che il suo autore ti ha lasciato regolare — e Usa la sua onda originale riporta l’onda all’altezza e alla posizione scelte da quell’autore.\nFai doppio clic sul grafico per lo schermo intero, o Ctrl+doppio clic per espanderlo nella finestra; un altro doppio clic lo riporta indietro. Un clic singolo nasconde o mostra la barra.\nTasti: Ctrl+F schermo intero, Ctrl+S vista espansa, Esc torna alla vista normale, Ctrl+G la griglia, Ctrl+W ciò che mostra il grafico, Ctrl+I il verso dell’onda, Ctrl+A tutte le bande. Sul punto di una banda, trascinalo per spostarla e il clic destro apre il suo menu; Ctrl+rotellina cambia il Q di un punto selezionato.',
  'help.graph.tip':
    'Tutto qui cambia solo il disegno, mai il suono. La modalità arcobaleno (si attiva da Aiuto → Novità) disegna gli stili standard, i misuratori e l’onda alla piena frequenza del tuo schermo invece che a 30 fotogrammi al secondo.',
  'help.graph.keywords':
    'analizzatore di spettro, analyzer, RTA, FPS, frame rate, frequenza di aggiornamento, waveform, fullscreen, scorciatoie, scorciatoie da tastiera, doppio clic, espansa',
  'help.graph.stripCaption': 'Con uno stile standard',
  'help.graph.live': 'Mostra o nasconde l’onda in tempo reale.',
  'help.graph.previous': 'Torna all’aspetto precedente.',
  'help.graph.picker': 'Apre tutti gli stili e i visualizzatori.',
  'help.graph.next': 'Passa all’aspetto successivo.',
  'help.graph.autoName': 'Auto',
  'help.graph.auto': 'Cambia aspetto a intervalli da 10 secondi a 2 minuti.',
  'help.graph.colouring':
    'Colora lo stile: Auto, Uniforme, Frequenza, Livello o Calore.',
  'help.graph.newLook': 'Crea un aspetto tuo partendo da questo stile.',
  'help.graph.bandsName': 'Bande di ascolto',
  'help.graph.bands': 'Ombreggia le bande che senti di più.',
  'help.graph.bandsMenu':
    'La stessa ombreggiatura; è in grigio sopra un visualizzatore Plus, che non la disegna mai.',
  'help.graph.gridName': 'Griglia',
  'help.graph.grid': 'Mostra o nasconde griglia e scale.',
  'help.graph.viewName': 'Vista',
  'help.graph.view': 'Dimensione, cosa viene disegnato e l’onda.',
  'help.graph.plusCaption': 'Con un visualizzatore Plus',
  'help.graph.tintName': 'Colori della finestra',
  'help.graph.tint':
    'Il tema dell’app, i colori del visualizzatore, i suoi colori con la luce (Ambiente) o il visualizzatore dietro tutta la finestra (Fondale).',
  'help.graph.lighting': 'Illumina i tuoi dispositivi RGB con questa scena.',
  'help.graph.desktop':
    'Mette questo visualizzatore dietro le icone del desktop.',
  'help.graph.viewCaption': 'Il menu Vista',
  'help.graph.expand': 'Il grafico si ingrandisce sopra l’editor.',
  'help.graph.fullscreen': 'Il grafico riempie lo schermo.',
  'help.graph.showingName': 'Visualizzazione',
  'help.graph.showing': 'Passa in rassegna ciò che mostra il grafico.',
  'help.graph.waveName': 'L’onda',
  'help.graph.wave': 'Il disegno dello spettro dal vivo.',
  'help.graph.topWaveName': 'Onda superiore',
  'help.graph.topWave': 'La piccola onda nella barra del titolo.',
  'help.graph.meterName': 'Misuratore di livello',
  'help.graph.meter': 'Il misuratore di uscita nella colonna di sinistra.',
  'help.graph.waveHeight': 'Quanto è alta l’onda disegnata.',
  'help.graph.wavePosition': 'Dal bordo inferiore fino al centro.',
  'help.graph.attack':
    'Quanto in fretta un visualizzatore Plus sale con la musica.',
  'help.graph.release': 'Quanto lentamente ricade dopo ogni colpo.',
  'help.graph.ownTiming':
    'Torna ai tempi con cui è arrivato il visualizzatore.',
  'help.looks.title': 'Stili e visualizzatori Plus',
  'help.looks.intro':
    'Gli stili standard sono disegni gratuiti del suono dal vivo che puoi colorare e personalizzare tu: Linea e Area per una traccia pulita, Blocchi LED e Picchi per l’impatto, Traliccio, Profilo urbano e Fiamme danzanti per scene intere. I visualizzatori Plus sono scene disegnate dalla scheda grafica, come Alpino, Aurora, Fioritura e Città al neon, in cui bassi, battito e acuti muovono ognuno qualcosa di diverso.',
  'help.looks.steps':
    'Fai clic sul nome dell’aspetto sul grafico. Cerca, oppure filtra gli stili per Linee, Riempimenti, Barre, Punti o Scene.\nScegli un visualizzatore Plus sulla destra. Senza Plus è bloccato, e se lo scegli scopri come ottenerlo.\nSu uno stile standard, premi Nuovo aspetto per cambiarne colori, movimento e picchi, poi salvalo: compare in Tuoi.',
  'help.looks.tip':
    'Un visualizzatore Plus porta i suoi colori: regolane attacco e rilascio in Vista. Se una scena non può girare su questo computer, il grafico disegna uno stile gratuito invece di restare vuoto.',
  'help.looks.keywords':
    'visualizer, visualizzatore musicale, skin, temi, look, animazioni, barre animate',
  'help.looks.searchName': 'Cerca',
  'help.looks.search':
    'Trova stili e visualizzatori per nome, autore o categoria.',
  'help.looks.styles':
    'Stili gratuiti disegnati da FluidEQ e gli aspetti che hai salvato.',
  'help.looks.familiesName': 'Filtri degli stili',
  'help.looks.families': 'Linee, Riempimenti, Barre, Punti, Scene e Tuoi.',
  'help.looks.plus': 'Scene di FluidEQ e dei membri, ognuna con un’immagine.',
  'help.looks.categoriesName': 'Categorie',
  'help.looks.categories': 'Natura, Città, Astratto e altro.',

  'help.plus.title': 'FluidEQ Plus e il tuo account',
  'help.plus.intro':
    'Un account è facoltativo: tutto ciò che era gratuito funziona su questo computer anche senza. FluidEQ Plus, mensile o annuale, aggiunge Visualizzatori, la Classifica, lo Studio, l’Illuminazione dinamica e il visualizzatore del desktop. Un account nuovo può provare Plus gratis per quindici giorni, e una scena che pubblichi e che viene approvata ti regala un mese.',
  'help.plus.steps':
    'Apri Account nel menu delle azioni. Accedi, oppure crea un account e inserisci il codice di sei cifre inviato alla tua email.\nPremi Passa a Plus, leggi le condizioni, spunta la casella per accettarle e paga su Buy Me a Coffee nel browser con la stessa email.\nApri la scheda Plus. La sua barra laterale porta a Classifica, Visualizzatori, Studio e Illuminazione dinamica.',
  'help.plus.tip':
    'L’app non vede mai la tua carta; Gestisci abbonamento lo modifica o lo disdice. La prova gratuita non chiede la carta e non addebita nulla alla fine. Un account resta connesso su un massimo di cinque computer, e Plus continua a funzionare offline per un po’.',
  'help.plus.keywords':
    'login, logout, accedere, accesso, registrarsi, registrazione account, iscrizione, premium, prezzo, costo, quanto costa, pagamento, carta di credito, acquistare, comprare, trial, annullare abbonamento, rinnovo, upgrade, membership, codice di verifica, sbloccare',
  'help.plus.leaderboard':
    'Chi ascolta di più, tra i membri Plus che partecipano.',
  'help.plus.visualizers':
    'Scene di FluidEQ e dei membri, pronte per la tua musica.',
  'help.plus.studio': 'Crea le tue scene con la tua IA.',
  'help.plus.lighting': 'I tuoi dispositivi RGB seguono la scena.',
  'help.plus.fold':
    'Riduce la barra laterale alle sole immagini; si riapre passandoci sopra con il mouse.',

  'help.gallery.title': 'La galleria Visualizzatori',
  'help.gallery.intro':
    'Visualizzatori raccoglie le scene di FluidEQ e quelle pubblicate dai membri. Qualsiasi account può sfogliarle e provare per dieci secondi gli esempi gratuiti di FluidEQ; Plus riproduce ogni scena con la tua musica e la aggiunge ai tuoi aspetti.',
  'help.gallery.steps':
    'Apri Plus → Visualizzatori. Cerca, ordina per Più apprezzate, Questa settimana o Più recenti, oppure scegli una categoria.\nApri una scena, premi Aggiungi ai miei aspetti, poi Riproduci sul grafico. Le frecce, o ← e →, passano da una scena all’altra.\nMetti mi piace alle scene dei membri con il cuore e segnala quelle che non dovrebbero esserci.',
  'help.gallery.tip':
    'Le scene nei tuoi aspetti si aggiornano da sole, e la pagina di una scena dice cosa è cambiato in ogni versione. Una scena che pubblichi compare quando un moderatore l’ha approvata. Apri nello Studio mostra come sono fatte le scene di FluidEQ.',
  'help.gallery.keywords':
    'scaricare visualizer, download, scene della community, scene degli utenti, like, segnalare, popolari',
  'help.gallery.search': 'Trova scene e autori.',
  'help.gallery.sortName': 'Ordina',
  'help.gallery.sort':
    'Più apprezzate, più apprezzate questa settimana o più recenti.',
  'help.gallery.categoriesName': 'Categorie',
  'help.gallery.categories': 'Mostra un solo tipo di scena.',
  'help.gallery.mine': 'Le scene che hai pubblicato, con i loro mi piace.',
  'help.gallery.cardName': 'Una scena',
  'help.gallery.card':
    'La sua immagine apre la scena; Aggiungi la mette nei tuoi aspetti.',
  'help.gallery.manage': 'Cosa mostra ogni monitor come sfondo del desktop.',
  'help.gallery.stop': 'Interrompe tutti gli sfondi del desktop.',
  'help.gallery.sceneCaption': 'La pagina di una scena',
  'help.gallery.back': 'Torna alla galleria, dove l’avevi lasciata.',
  'help.gallery.play':
    'Aggiunge la scena ai tuoi aspetti o la riproduce sul grafico.',
  'help.gallery.desktop': 'Mette la scena dietro le icone del desktop.',
  'help.gallery.inspect':
    'Apre la scena di FluidEQ nello Studio per vedere come è fatta.',

  'help.leaderboard.title': 'La classifica',
  'help.leaderboard.intro':
    'La classifica ordina i membri Plus che vi partecipano in base a quanto ascoltano e ai mi piace ricevuti dalle loro scene. È disattivata finché non partecipi.',
  'help.leaderboard.steps':
    'Apri Account e premi Partecipa alla classifica.\nApri Plus → Classifica. Scegli il nickname e il nome che mostra la classifica, poi scegli tra Sempre e Questo mese.\nPer smettere, premi Esci dalla classifica. Rimuovi tutti i miei dati cancella tutto ciò che hai inviato.',
  'help.leaderboard.tip':
    'Dal tuo computer parte un solo numero al giorno (i minuti di musica riprodotta) e mai cosa ascolti. Ogni numero viene controllato sul server. Nickname e nome si possono cambiare in seguito da Account → Cambia nome; la classifica e le scene pubblicate si aggiornano.',
  'help.leaderboard.keywords':
    'ranking, graduatoria, leaderboard, punteggio, statistiche, tempo di ascolto, ascoltatori, competizione, partecipare',
  'help.leaderboard.periodName': 'Sempre o Questo mese',
  'help.leaderboard.period': 'Tutta la cronologia, o solo questo mese.',
  'help.leaderboard.standing':
    'La tua posizione e i tuoi punti, e quanto manca al posto successivo.',
  'help.leaderboard.earn':
    '10 punti all’ora, 20 per ogni giorno con 30 minuti o più, 5 per ogni mi piace.',

  'help.studio.title': 'Crea scene nello Studio',
  'help.studio.intro':
    'Lo Studio trasforma una descrizione in un visualizzatore. Il tuo assistente IA scrive la scena in una cartella di progetto, e FluidEQ riproduce ogni versione con la tua musica non appena viene salvata. Lo Studio fa parte di Plus; un account nuovo può aprirlo con la prova gratuita.',
  'help.studio.steps':
    'Apri Plus → Studio e premi Nuovo progetto…. Dagli un nome: FluidEQ crea la sua cartella con una scena che si muove già.\nDescrivi la tua idea, apri la cartella nel tuo assistente IA e incolla il prompt di Copia prompt per IA.\nGuarda il palco mentre i file vengono salvati e usa i segnali di prova. Poi Aggiungi ai miei aspetti, Pubblica… o Esporta….',
  'help.studio.tip':
    'Fai doppio clic sul palco per lo schermo intero. Guarda dentro una scena di FluidEQ… apre una delle scene di FluidEQ da cui imparare; non si può pubblicare. Le scene che lampeggiano troppo o sono troppo pesanti vengono bloccate. Una scena che pubblichi viene prima letta da un moderatore, e una scena approvata ti regala un mese di Plus.',
  'help.studio.keywords':
    'creare visualizzatore, shader, GLSL, intelligenza artificiale, ChatGPT, Claude, programmare, editor',
  'help.studio.project':
    'I tuoi progetti e le scene di FluidEQ da guardare dentro.',
  'help.studio.stageName': 'Palco',
  'help.studio.stage':
    'La scena, dal vivo con la tua musica. Doppio clic per lo schermo intero.',
  'help.studio.code':
    'Il codice della scena, dal vivo, aggiornato a ogni salvataggio della tua IA.',
  'help.studio.hears':
    'Ciò che riceve la scena: livello, battito, bassi, medi, acuti.',
  'help.studio.signals': 'Segnali di prova che animano solo questa anteprima.',
  'help.studio.size':
    'Prova la scena su un grafico o su un pannello stretto, largo o a schermo intero.',
  'help.studio.wave':
    'Prova l’altezza e la posizione dell’onda che chi ascolta può impostare.',

  'help.desktop.title': 'Il visualizzatore del desktop',
  'help.desktop.intro':
    'Il visualizzatore del desktop mette un visualizzatore Plus dietro le icone del desktop, su un monitor o su ciascuno di essi, finché FluidEQ è in esecuzione.',
  'help.desktop.steps':
    'Metti un visualizzatore Plus sul grafico e premi il pulsante del monitor accanto al suo nome, oppure scegli Vista → Imposta come sfondo del desktop.\nPremi i monitor sulla mappa, scegli Con la musica o Calmo e premi Imposta sfondo.\nPer cambiarlo o fermarlo, apri Plus → Visualizzatori e usa Gestisci o Interrompi in alto.',
  'help.desktop.tip':
    'Si mette in pausa mentre le finestre coprono il monitor, con il PC bloccato e, se vuoi, a batteria, e torna all’avvio di FluidEQ. Uscire da FluidEQ lo ferma. Solo su Windows.',
  'help.desktop.keywords':
    'wallpaper, sfondo animato, sfondo live, impostare sfondo, doppio monitor, multi monitor, più schermi',
  'help.desktop.monitors':
    'I tuoi monitor come li dispone Windows. Premi quelli da usare.',
  'help.desktop.music': 'Si muove con ciò che è in riproduzione.',
  'help.desktop.calm': 'Un’animazione lenta e tranquilla che ignora la musica.',
  'help.desktop.battery': 'Risparmia energia mentre il computer è scollegato.',
  'help.desktop.start': 'Lo avvia sui monitor che hai scelto.',

  'help.lighting.title': 'Illuminazione dinamica (beta)',
  'help.lighting.intro':
    'L’illuminazione dinamica accende tastiera, mouse, tappetino, cuffie e supporto con il visualizzatore Plus sul grafico, tramite Windows Dynamic Lighting e Razer Chroma. È in beta, quindi raccontaci come si comportano i tuoi dispositivi.',
  'help.lighting.steps':
    'Apri Plus → Illuminazione dinamica e attivala, oppure premi il pulsante dell’illuminazione accanto a un visualizzatore Plus sul grafico.\nScegli lo stile luminoso di questo visualizzatore (Scena, Onda di colore, Spettro o Onda ritmica) e regola la luminosità e ciò a cui reagisce.\nFai clic su un dispositivo in I tuoi dispositivi per regolarlo da solo; Tutti i dispositivi torna a regolarli insieme.',
  'help.lighting.tip':
    'Se Windows riserva un dispositivo a un’altra app, la pagina indica l’impostazione da cambiare e la apre per te. I dispositivi Razer richiedono Razer Synapse in esecuzione, con Chroma Apps consentito.',
  'help.lighting.keywords':
    'RGB, luci LED, retroilluminazione, illuminazione ambientale, periferiche, mousepad, luci a ritmo di musica',
  'help.lighting.switch':
    'Illumina i tuoi dispositivi mentre suona un visualizzatore Plus.',
  'help.lighting.browse': 'Apre la galleria per scegliere un visualizzatore.',
  'help.lighting.previewName': 'Anteprima della scrivania',
  'help.lighting.preview':
    'La tua scrivania, illuminata con i colori che le vengono inviati.',
  'help.lighting.devices':
    'Tutti i dispositivi trovati. Fai clic su uno per regolarlo da solo.',
  'help.lighting.all': 'Torna a regolare tutti i dispositivi insieme.',
  'help.lighting.style':
    'Scena, Onda di colore, Spettro o Onda ritmica, salvato per ogni visualizzatore.',

  'help.online.title': 'Ascolta con Media online',
  'help.online.intro':
    'Media online affianca i siti compatibili all’EQ. Riproduzione e accesso dipendono dal fornitore e dalla connessione. La barra in fondo a FluidEQ segue il lettore attivo, e il suo volume è quello del tuo computer.',
  'help.online.steps':
    'Apri Media online, scegli un sito e avvia qualcosa sulla pagina.\nPassa a EQ per regolare durante l’ascolto e torna alla pagina per i suoi controlli.\nAttiva Un solo lettore per evitare sovrapposizioni con altri lettori.',
  'help.online.tip':
    'Con il motore FluidEQ, Media online passa dal tuo EQ e dal rack DSP come ogni altra app. Con Equalizer APO il rack resta legato ai brani della Libreria.',
  'help.online.keywords':
    'YouTube, YouTube Music, Bandcamp, Twitch, Suno, musica online, streaming, web, browser',

  'help.library.title': 'Crea la tua libreria locale',
  'help.library.intro':
    'Libreria raccoglie musica e video dai tuoi dischi. Sfoglia per album, artisti, generi, brani, cartelle, albero delle cartelle o playlist. Copertine e dettagli provengono dai file, quindi la stessa collezione può apparire diversa a seconda dei tag.',
  'help.library.steps':
    'Apri Libreria e aggiungi la cartella multimediale. Lascia finire la scansione prima di valutare cosa manca.\nScegli artista o album oppure cerca un brano e avvialo dai risultati.\nUsa la barra in fondo alla finestra per mettere in pausa, cercare e saltare. Il suo volume è quello del tuo computer, lo stesso di Windows.',
  'help.library.tip':
    'Passa il mouse sul pulsante di FluidEQ nella barra delle applicazioni di Windows per Precedente, Riproduci e Successivo, anche quando è ridotto a icona. Libreria ha bisogno dei file originali: ricollega il disco o aggiungi di nuovo una cartella spostata.',
  'help.library.keywords':
    'lettore musicale, player, canzoni, aggiungere musica, raccolta, metadati, MP3, FLAC, AAC, WAV',

  'help.queue.title': 'Album e coda di riproduzione',
  'help.queue.intro':
    'La coda determina l’ordine d’ascolto. Aprire un altro album permette di esplorare senza cambiare il brano attuale. Il brano attivo e In coda aiutano a orientarti.',
  'help.queue.steps':
    'Apri un album e avvia il brano desiderato.\nFai clic destro su un brano per Aggiungi alla coda, Aggiungi ai Preferiti o Aggiungi a una playlist.\nApri In coda per vedere cosa suona dopo e attiva Continua a suonare per proseguire con altra musica dello stesso genere.',
  'help.queue.tip':
    'Avviare Libreria prende il posto degli altri lettori FluidEQ. Il brano attuale mostrato nella barra ti conferma quale sorgente ha la riproduzione.',
  'help.queue.keywords':
    'riproduzione casuale, shuffle, ripetizione, ripetere brano, loop, prossima canzone, autoplay, riproduzione automatica',

  'help.karaoke.title': 'Canta con Karaoke',
  'help.karaoke.intro':
    'Karaoke abbina audio e testi locali. I testi temporizzati seguono la riproduzione; gli obiettivi d’intonazione richiedono note. Un microfono configurato aggiunge la tua intonazione dal vivo.',
  'help.karaoke.steps':
    'Apri Karaoke e aggiungi file o cartella con audio e testi corrispondenti.\nScegli un brano, avvialo e controlla l’abbinamento.\nConfigura il microfono, regola la dimensione dei testi e usa lo schermo intero del palco.',
  'help.karaoke.tip':
    'Un file con soli testi non contiene note obiettivo. Karaoke suona al volume del tuo computer; i livelli di melodia, base e voce guida sono in Impostazioni mix.',
  'help.karaoke.keywords':
    'cantare, canzoni, lyrics, pitch, punteggio, stonato, accordi chitarra, LRC, UltraStar, testi sincronizzati',

  'help.maker.title': 'Crea nel Creatore di karaoke',
  'help.maker.intro':
    'Il Creatore di karaoke trasforma audio in un progetto modificabile con testi e note sulla timeline. Controlla sempre parole e tempi generati automaticamente.',
  'help.maker.steps':
    'Apri Crea da Karaoke e carica l’audio. Scegli gli strumenti di separazione o trascrizione necessari.\nSegui il progresso; al primo uso IA potrebbe scaricare modelli. Rivedi testi e note.\nAscolta brevi passaggi, correggi tempi e testo, salva il progetto ed esporta i file.',

  'help.maker.lyricsCaption': 'Il testo, e quando viene cantata ogni parola',
  'help.maker.referenceName': 'Testo di riferimento',
  'help.maker.reference':
    'Tutta la canzone come testo, una riga per ciascuna. Incollalo o carica un file; FluidEQ ne ricava i tempi.',
  'help.maker.timingName': 'Tempo della parola',
  'help.maker.timing':
    'Tutte le parole in ordine, con quante hanno già un tempo. Premine una per lavorarci.',
  'help.maker.wordName': 'Parola selezionata',
  'help.maker.word':
    'Dove comincia la parola scelta e quanto dura. Spostarne il bordo dà o toglie tempo a quella accanto; la riga mantiene la sua durata.',
  'help.maker.toolsCaption': 'Gli strumenti di IA e i modelli che richiedono',
  'help.maker.separate':
    'Divide la registrazione in voce e musica, così il karaoke suona senza il cantante.',
  'help.maker.loadVocals':
    'Usa un file di sola voce che hai già, invece di separarne uno qui.',
  'help.maker.redetectTiming':
    'Riascolta la voce e ricalcola i tempi delle parole che hai già.',
  'help.maker.redetectNotes':
    'Riascolta la melodia e riscrive le note sotto le parole.',
  'help.maker.modelsName': 'Memoria dei modelli IA',
  'help.maker.models':
    'Di cosa ha bisogno ogni modello e se è su questo computer. Vengono scaricati al primo utilizzo.',
  'help.maker.idleName': 'Quando è inattivo',
  'help.maker.idle':
    'Se un modello resta in memoria tra un uso e l’altro, e per quanto. Liberarlo restituisce memoria; tenerlo fa partire subito la volta dopo.',

  'help.makerBar.caption': 'Gli strumenti in cima al creatore',
  'help.makerBar.import':
    'Apre un file karaoke o un progetto salvato, e mantiene l’audio già caricato.',
  'help.makerBar.lyrics': 'Le parole e i loro tempi, in una sola finestra.',
  'help.makerBar.timing':
    'Sposta parole e note insieme, per una canzone in anticipo o in ritardo fin dal primo secondo.',
  'help.makerBar.pan':
    'Trascina sulla linea del tempo per percorrere la canzone senza cambiare nulla.',
  'help.makerBar.language':
    'In che lingua sono le parole, e una seconda accanto per cantarla in entrambe.',
  'help.makerBar.record':
    'Fai partire la canzone e premi un tasto all’inizio e alla fine di ogni riga. I tempi nascono dai tuoi tasti.',
  'help.makerBar.select':
    'Disegna un riquadro attorno alle note per spostarle o cancellarle insieme.',
  'help.makerBar.paint':
    'Disegna la melodia direttamente sulla griglia delle altezze.',
  'help.makerBar.split':
    'Divide una parola in sillabe, così una parola lunga porta una nota su ciascuna.',
  'help.makerBar.repair':
    'Gli strumenti che ascoltano per te, e i modelli che richiedono.',
  'help.makerBar.export':
    'Scrive il karaoke finito come progetto FluidEQ, UltraStar TXT, LRC o LRC avanzato.',
  'help.maker.tip':
    'Servono connessione e spazio per i modelli. I tempi dipendono da hardware e durata. Usa audio autorizzato e verifica prima di condividere.',
  'help.maker.keywords':
    'rimuovere voce, togliere voce, eliminare voce, estrarre voce, isolare voce, vocal remover, base strumentale, a cappella, acapella, stems, sincronizzare testi, timing, creare karaoke, karaoke maker, editor karaoke',

  'help.share.title': 'Condividi audio tra computer',
  'help.share.intro':
    'Condividi audio invia il suono di sistema tra computer della stessa rete privata. Il ricevitore ha cuffie o altoparlanti; gli altri inviano. È diverso dalla seconda uscita sullo stesso computer.',
  'help.share.steps':
    'Sul computer d’ascolto apri Condividi audio, scegli Riproduci l’audio su questo computer e premi Crea codice di connessione. Inizia a volume basso.\nSu ogni computer sorgente scegli Invia l’audio di questo computer, incolla il codice della tua rete e premi Connetti e invia.\nControlla il monitor della connessione. Al termine premi Interrompi invio o Interrompi ascolto; Crea nuovo codice scollega tutti gli abbinamenti salvati.',
  'help.share.tip':
    'Il codice autorizza l’abbinamento: tienilo privato. Più mittenti vengono miscelati e alzano il livello, che si regola con il volume del computer che riceve. Con il motore FluidEQ, anche l’audio ricevuto passa dal rack DSP.',
  'help.share.keywords':
    'rete locale, LAN, wifi, altro PC, collegare computer, condividere audio, inviare audio, ricevere audio, trasmettere audio, streaming audio',

  'help.trouble.title': 'Quando il suono non va',
  'help.trouble.intro':
    'Inizia da sorgente e uscita, poi isola il livello. Un grafico, un preset salvato o un interruttore attivo da soli non provano che il suono abbia raggiunto il dispositivo giusto. Il menu Aiuto porta anche alla risoluzione dei problemi audio, alle segnalazioni e al Forum.',
  'help.trouble.steps':
    "Nessun suono: verifica riproduzione, uscita, volume e collegamento. Un solo lettore potrebbe aver messo in pausa un’altra sorgente.\nL’EQ non cambia nulla: verifica che EQ di sistema sia attivo e che l’uscita non mostri l’etichetta DISATT., altrimenti premi Attiva. Se un avviso dice che il motore non è in funzione, premi Riavvia l’audio di Windows.\nSembra tutto a posto e l'EQ continua a non fare nulla: Windows potrebbe riprodurre la musica fuori dal motore. L'avviso lo dice e propone di spostarlo con un tocco dove Windows lo userà; costa un permesso e un secondo di silenzio.\nDistorsione o bassi eccessivi: lascia attivo Normalizza automaticamente, riduci i rinforzi e spegni un livello alla volta. Se persiste, usa Segnala un problema e rivedi la segnalazione prima di inviarla.",
  'help.trouble.tip':
    'F1 apre questa guida. Esc chiude prima la schermata ingrandita, poi la guida. Se l’interfaccia è troppo grande, Ctrl + 0 azzera lo zoom. Processi, nel menu delle azioni, mostra cosa sta facendo ogni parte di FluidEQ.',
  'help.trouble.keywords':
    'non funziona, non si sente niente, audio distorto, audio a scatti, bug, errore, crash, gracchiare, crepitio, scoppiettii, clipping, saturazione, volume basso, troppo forte, rimbombo, riavviare audio, reset zoom, troppo piccolo, segnalare problema, assistenza, supporto tecnico, scorciatoie da tastiera, tasti rapidi, hotkey',

  'help.forum.title': 'Chiedi nel Forum',
  'help.forum.intro':
    'Il Forum porta nell’app le GitHub Discussions di FluidEQ: annunci, idee, domande e regolazioni di cui le persone vanno fiere. Chiunque può leggere; per scrivere usi il tuo account GitHub, non un account FluidEQ.',
  'help.forum.steps':
    'Apri Aiuto → Forum e scegli una categoria: Annunci, Generale, Idee, Sondaggi, Q&A o Vetrina.\nCerca nel forum, oppure apri un argomento per leggere le risposte.\nPremi Accedi con GitHub, completa nel browser, poi pubblica un Nuovo argomento o una risposta.',
  'help.forum.tip':
    'Tutto ciò che pubblichi è pubblico su GitHub con il tuo nome GitHub. In Q&A, segna la risposta che ha funzionato, così chi arriva dopo la trova.',
  'help.forum.keywords':
    'community, comunità, suggerimenti, proposte, feedback, chiedere aiuto, supporto, contattare, sviluppatore, FAQ',
};

export default help;
