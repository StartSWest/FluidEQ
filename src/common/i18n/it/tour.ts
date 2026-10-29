/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.karaokeBackground.title': 'Visualizzazioni dietro le parole',
  'tour.karaokeBackground.subtitle': 'Lo stile scelto, sul palco del Karaoke',
  'tour.karaokeBackground.lead':
    'Scegli una visualizzazione o una scena come sfondo del Karaoke.',
  'tour.karaokeBackground.how':
    'Scegli uno stile in {looks} su EQ, poi premi {showGraph} nel Karaoke.',
  'tour.karaokeBackground.open': 'Apri Karaoke',
  'tour.karaokeBackground.imageAlt':
    'Il controllo dello sfondo del Karaoke con una scena dietro le parole.',
  'tour.karaokeBackground.lyric': 'La nostra canzone illumina la notte',
  'tour.tray.kicker': 'SILENZIOSO DALL’ACCESSO',
  'tour.tray.title': 'FluidEQ parte nell’area di notifica',
  'tour.tray.subtitle': 'Il tuo suono dall’accesso, senza finestre',
  'tour.tray.lead':
    'Con «{startup}» attivo, FluidEQ parte nell’area di notifica quando accedi a Windows e modella il tuo suono dal primo secondo, senza finestre in mezzo.',
  'tour.tray.point1':
    'Il tuo EQ, i preset e il suono di ogni uscita suonano dal primo brano, prima che tu apra qualcosa.',
  'tour.tray.point2':
    'L’icona nell’area di notifica apre la finestra, e il pulsante di chiusura della finestra la rimette lì.',
  'tour.tray.point3':
    'Se apri FluidEQ tu, si apre la sua finestra, come sempre.',
  'tour.tray.how': 'Attivalo qui, o in fondo al menu (tre linee):',
  'tour.tray.imageAlt':
    'L’area di notifica della barra delle applicazioni di Windows con l’icona di FluidEQ e, sopra, una scheda che dice che FluidEQ sta modellando il suono.',
  'tour.tray.card': 'Modella il suono di ogni app',
  'tour.languages.kicker': 'DODICI LINGUE',
  'tour.languages.title': 'Ora in coreano e cinese tradizionale',
  'tour.languages.subtitle': '한국어 e 繁體中文 si aggiungono ad altre dieci',
  'tour.languages.lead':
    'FluidEQ parla dodici lingue. Il cinese tradizionale viene scelto per Taiwan, Hong Kong e Macao, e una lingua che hai scelto tu resta sempre.',
  'tour.languages.point1':
    'Tutta la finestra, la Guida, le Novità e il programma di installazione parlano entrambe.',
  'tour.languages.point2':
    'Ogni lingua si chiama col proprio nome nell’elenco, così trovi sempre la tua.',
  'tour.languages.point3':
    'Il cinese semplificato resta per la Cina continentale e Singapore.',
  'tour.languages.how': 'Sceglila in fondo al menu (tre linee):',
  'tour.languages.imageAlt':
    'Le dodici lingue di FluidEQ, ognuna nella propria scrittura, con il coreano e il cinese tradizionale segnati come nuovi.',

  'tour.contribute': 'Contribuisci, per favore',
  'tour.eyebrow': 'NOVITÀ DI QUESTA VERSIONE',
  'tour.title': 'Novità di FluidEQ',
  'tour.close': 'Chiudi',
  'tour.rail': 'Nuove funzioni',
  'tour.stepOf': '{current} di {total}',
  'tour.back': 'Indietro',
  'tour.next': 'Avanti',
  'tour.done': 'Capito',
  'tour.dontShowAgain': 'Non mostrare più per questa versione',
  'tour.releaseNotes': 'Note di rilascio complete',
  'tour.rail.newIn': 'NOVITÀ DELLA {version}',
  'tour.rail.always': 'ANCHE IN FLUIDEQ',
  'tour.newBadge': 'NUOVO',
  'tour.howTitle': 'Come iniziare',
  'tour.beta': 'Beta',
  'tour.player.kicker': 'IL LETTORE COMPATTO',
  'tour.player.title': 'Tutta l’app in una colonna',
  'tour.player.subtitle': 'Un lettore, uguale in ogni colore della finestra',
  'tour.player.lead':
    'Un interruttore nella barra del titolo racchiude FluidEQ in una colonna: in alto il visualizzatore con il brano sopra, poi i comandi, il tuo suono e cosa viene dopo. È lo stesso lettore in ogni colore della finestra, e la scena che scegli scorre dietro a tutto, in {backdrop}.',
  'tour.player.point1':
    '{sound} contiene le manopole di Bassi, Medi e Alti o le bande del tuo EQ, con il preset, l’EQ intelligente e la modalità EQ accanto.',
  'tour.player.point2':
    '{upNext} e {playlists} stanno in fondo. Riduci una delle due parti per avere un’immagine più grande, e trascina la musica in qualsiasi punto del lettore per aggiungerla alla coda.',
  'tour.player.point3':
    'Ha una sola larghezza, e l’altezza la scegli tu dal bordo superiore o inferiore. Riducilo a una riga, tienilo sopra le altre finestre o fai doppio clic sull’immagine per riempire lo schermo.',
  'tour.player.how':
    'Premi l’interruttore Lettore compatto nella barra del titolo, accanto ad Aiuto. Sul lettore, lo stesso interruttore riporta l’app completa.',
  'tour.player.open': 'Prova il Lettore compatto',
  'tour.player.imageAlt':
    'L’angolo della barra del titolo con l’interruttore {player} evidenziato, e il Lettore compatto due volte: su una scena in {backdrop} con le bande dell’EQ aperte, e con un visualizzatore standard dietro al brano e le manopole del Tono aperte.',
  'tour.player.scene': 'Con una scena, in {backdrop}',
  'tour.player.standard': 'Con un visualizzatore standard',
  'tour.look.kicker': 'UN NUOVO ASPETTO',
  'tour.look.title': 'Una finestra nuova, con colori nuovi',
  'tour.look.subtitle':
    'Un solo cursore del tema e un visualizzatore dietro a tutto',
  'tour.look.lead':
    'I pannelli poggiano su un unico piano aperto, nei colori della nuova icona, e un solo cursore, {brightness}, porta tutta la finestra dal quasi nero a un azzurro oceano chiaro. Con una scena sul grafico, la finestra può prendere i suoi colori o mostrarla dietro a tutto.',
  'tour.look.point1':
    '{brightness} è nel menu dietro l’icona a impulso, e accanto a {transparency} in {windowColours}.',
  'tour.look.point2':
    '{windowColours} offre {original}, {colours}, {ambient} e {backdrop}, ognuno con una riga su cosa fa alla finestra.',
  'tour.look.point3':
    'Finestre di dialogo e menu condividono un unico materiale, e la {rainbow} percorre i colori dell’icona, o quelli di un visualizzatore.',
  'tour.look.how':
    'Sposta {brightness} nel menu delle azioni dietro l’icona a impulso in alto a destra. Con una scena sul grafico, apri {windowColours} dalla barra del grafico e scegli {backdrop}.',
  'tour.look.open': 'Apri l’EQ',
  'tour.look.imageAlt':
    'FluidEQ nei suoi colori nella pagina EQ, l’Analizzatore che disegna un brano sotto le curve, e il menu dietro l’icona a impulso aperto sul suo angolo, con la Luminosità a metà e la Modalità colorata attiva.',
  'tour.gpu.kicker': 'UN NUOVO MOTORE PER I VISUALIZZATORI',
  'tour.gpu.title': 'Ogni visualizzatore sulla tua scheda grafica',
  'tour.gpu.subtitle': 'Quaranta stili al ritmo del tuo schermo, e mondi 3D',
  'tour.gpu.lead':
    'I quaranta stili del grafico ora si disegnano con il motore delle scene: sulla tua scheda grafica, alla frequenza di aggiornamento del tuo schermo, così barre, particelle e picchi scorrono fluidi dove prima scattavano. E una scena ora può essere un vero mondo 3D.',
  'tour.gpu.point1':
    'Diciotto nuovi stili in {scenes}, tra cui {synthwave}, {horizon}, {towers} e {ledwall}; uno stile senza colori propri prende quelli della finestra.',
  'tour.gpu.point2':
    'I mondi 3D battono sulla cassa, ondeggiano con il rullante, saltano sul drop e passano dalla notte al giorno con {brightness}; trascinane uno per vederlo da un altro lato.',
  'tour.gpu.point3':
    'Cambiando stile, uno sfuma nel successivo, e un mondo 3D restituisce la memoria grafica mentre la finestra è coperta.',
  'tour.gpu.how':
    'Fai clic sul nome dello stile nel grafico e scegline uno in {scenes}.',
  'tour.gpu.open': 'Apri l’EQ',
  'tour.gpu.imageAlt':
    'Una scena che è una città 3D di notte, e quattro nuovi stili fotografati sul grafico — {synthwave}, {horizon}, {towers} e {ledwall} — con il selettore degli stili cerchiato sul primo.',
  'tour.gpu.world': 'Mondo 3D',
  'tour.sparks.kicker': 'SCINTILLE DEL PUNTATORE',
  'tour.sparks.title': 'Visualizzatori che rispondono al tuo mouse',
  'tour.sparks.subtitle': 'Scintille, petali o neve dal puntatore',
  'tour.sparks.lead':
    'Passa il mouse su una scena e lancia ciò di cui è fatta — scintille, petali, neve, braci — in una scia dietro il puntatore, ed esplode dove fai clic. Con {ambient} e con {backdrop}, i suoi uccelli, petali e luci fluttuano anche su tutta la finestra.',
  'tour.sparks.point1':
    'Ogni visualizzatore lancia i suoi: neve da una scena invernale, braci da un falò, petali da un giardino.',
  'tour.sparks.point2':
    'Il palco dello Studio le mostra sempre, così chi crea una scena può dare forma a ciò che lancia.',
  'tour.sparks.point3':
    'Un solo interruttore per tutti i visualizzatori: {sparks}, in {windowColours} sotto {rainbow}.',
  'tour.sparks.how':
    'Con una scena sul grafico, passa il mouse sopra e fai clic. {sparks} è in {windowColours}, sotto {rainbow}.',
  'tour.sparks.open': 'Apri l’EQ',
  'tour.sparks.imageAlt':
    'Un visualizzatore con un’aurora, una scia di scintille luminose dietro il puntatore e un’esplosione dove ha fatto clic, e {windowColours} con l’interruttore {sparks} cerchiato.',
  'tour.sound.kicker': 'IL MOTORE FLUIDEQ',
  'tour.sound.title': 'Il suono esattamente come l’hai disegnato',
  'tour.sound.subtitle': 'Alti fedeli, cambi senza clic, livello in un passo',
  'tour.sound.lead':
    'Sul motore FluidEQ la tua curva ora suona esattamente come l’hai disegnata fino a 20 kHz, ogni modifica si dissolve invece di fare clic e {autoNormalize} trova il livello di una nuova curva in un solo passo. Come costruire gli alti lo scegli tu: {precise} o {classic}.',
  'tour.sound.point1':
    '{precise} costruisce ogni banda come disegnata; su un’uscita a 48 kHz gli alti arrivavano 3,8 dB più bassi a 20 kHz. {classic} le costruisce come Equalizer APO, e come AutoEQ regola una correzione.',
  'tour.sound.point2':
    'I preset sfumano quando cambiano: 534 cambi su 636 crepitavano, e ora nessuno supera −80 dBFS.',
  'tour.sound.point3':
    'Ogni modifica si sente nel momento in cui la fai, e {autoNormalize} poi raggiunge il suo livello in un solo passo, calcolato dagli ultimi dieci secondi di musica.',
  'tour.sound.how':
    'Apri l’EQ e premi {eqMode}. In {treble}, scegli {precise} o {classic}, per il tuo EQ e per le correzioni separatamente.',
  'tour.sound.open': 'Apri l’EQ',
  'tour.sound.imageAlt':
    'Il menu {eqMode} aperto sotto il suo pulsante con {treble} su {precise}; una curva degli alti che {precise} suona come disegnata e {classic} 3,8 dB più bassa a 20 kHz su un’uscita a 48 kHz; e il suono sopra i 5 kHz durante un cambio di preset: un clic a −26 dBFS prima della 2.0, niente sopra −80 dBFS ora.',
  'tour.sound.trebleChart': 'Alti, da 1 a 20 kHz',
  'tour.sound.switchChart': 'Sopra i 5 kHz, durante un cambio di preset',
  'tour.sound.before': 'Prima della 2.0',
  'tour.sound.now': '2.0',
  'tour.graph.kicker': 'VISTE DA STUDIO',
  'tour.graph.title': 'Un grafico che legge il suono come uno studio',
  'tour.graph.subtitle': 'Dodici viste, un analizzatore da 80 dB',
  'tour.graph.lead':
    'Il grafico misura ciò che suona come fanno gli analizzatori da studio: dodici viste, dallo spettrogramma e dalla cascata allo stereo, al loudness e alla fase, su scale che restano ferme mentre la musica si muove.',
  'tour.graph.point1':
    '{analyzer}, {spectrogram}, {rta}, {waterfall}, {scope} e altre sette, in {analysis} nel selettore degli aspetti.',
  'tour.graph.point2':
    'Il suono dal vivo è disegnato a 80 dB di profondità e fino a 10 Hz, un dodicesimo d’ottava per punto, così un tono si legge al suo livello reale.',
  'tour.graph.point3':
    'Il tuo EQ mantiene i suoi ±20 dB, con margine ai bordi per una curva che va oltre, e le frequenze sono indicate 10, 20, 50, 100 come le stampano gli analizzatori.',
  'tour.graph.how':
    'Fai clic sul nome dell’aspetto sul grafico e scegli una vista in {analysis}. Doppio clic sul grafico per riempire lo schermo; Ctrl+G mostra o nasconde la griglia.',
  'tour.graph.open': 'Apri l’EQ',
  'tour.graph.imageAlt':
    'L’Analizzatore del grafico su un brano in riproduzione: lo spettro dal vivo a 80 dB di profondità con i picchi sopra, le curve dell’EQ in cima e, nell’angolo, l’elenco delle viste in Analisi.',

  'tour.games.kicker': 'PRESET DI GIOCO',
  'tour.games.title': 'Ogni gioco, il suo suono',
  'tour.games.subtitle': 'Attivato quando il gioco passa in primo piano',
  'tour.games.lead':
    'Scegli una volta sola un suono per ogni gioco. Quando il gioco passa in primo piano, FluidEQ lo attiva e lo mantiene finché non chiudi il gioco, per quante volte tu faccia Alt+Tab, poi rimette quello che avevi.',
  'tour.games.point1':
    'Giochi di Steam, Epic Games, EA, GOG, Ubisoft, Battle.net e Xbox, o qualsiasi programma aperto.',
  'tour.games.point2':
    'I preset Gaming attivano Modalità gioco, che riduce il ritardo aggiunto da FluidEQ, e la pagina mostra il ritardo misurato.',
  'tour.games.point3':
    'Una scheda sul desktop dice a quale suono è passato FluidEQ, e un’altra quale è tornato quando il gioco si è chiuso.',
  'tour.games.how':
    'Apri EQ, scegli Preset di gioco e premi Aggiungi un gioco. Poi scegli il suo suono nel selettore sulla sua riga.',
  'tour.games.open': 'Apri Preset di gioco',
  'tour.games.imageAlt':
    'Tre momenti sul desktop: un gioco in primo piano con la scheda di FluidEQ che dice che il suo suono è caricato, lo stesso gioco ridotto a icona con il suono ancora attivo, e il gioco chiuso con la scheda che dice che il suono di prima è tornato.',
  'tour.games.stepFront': 'In primo piano: si carica il suo suono',
  'tour.games.stepAway': 'Ridotto a icona o con Alt+Tab: il suono resta',
  'tour.games.stepClosed': 'Chiuso: torna il tuo suono',
  'tour.presets.kicker': 'NUOVI PRESET',
  'tour.presets.title': 'Preset che suonano come la musica',
  'tour.presets.subtitle': 'Catene complete, tutte allo stesso volume',
  'tour.presets.lead':
    'Ogni preset è stato misurato di nuovo e livellato: passare dall’uno all’altro cambia il carattere, non il volume, e ora ognuno si sente chiaramente con il motore FluidEQ come con Equalizer APO.',
  'tour.presets.point1':
    '{chains} catene, di cui {styles} stili musicali, più le versioni Stanza di Musica, Film e Gaming.',
  'tour.presets.point2':
    'La curva di un preset compare sul grafico come un livello a sé, con un’intensità che puoi abbassare.',
  'tour.presets.point3':
    'Ogni stile si spiega da sé: puntane uno e le sue note si aprono accanto all’elenco.',
  'tour.presets.how':
    'Apri EQ e premi Preset, oppure scegli una catena in cima alla scheda DSP.',
  'tour.presets.open': 'Apri l’EQ',
  'tour.presets.imageAlt':
    'Il selettore dei preset con Rock scelto e le sue note accanto all’elenco: la curva con i punti numerati, a cosa serve ogni punto e a che volume suona.',
  'tour.tone.kicker': 'CONTROLLI DI TONO',
  'tour.tone.title': 'Bassi, Medi e Alti, come su un amplificatore',
  'tour.tone.subtitle': 'Tre manopole con una curva propria',
  'tour.tone.lead':
    'Senza bande selezionate, Bassi, Medi e Alti modellano il suono come una curva a sé, con un taglio dei bassi e uno degli alti ai lati: il modo più rapido per scaldare un brano o renderlo più brillante, e ogni banda resta come l’hai regolata.',
  'tour.tone.point1':
    'L’equalizzatore si apre su tutte le bande, senza nessuna selezionata.',
  'tour.tone.point2':
    'Una nuova disposizione a venti bande, e ogni disposizione sulle frequenze standard.',
  'tour.tone.point3':
    'Le bande nascono larghe quanto la distanza tra loro: nessun vuoto in mezzo e mai due sulla stessa nota.',
  'tour.tone.how':
    'Apri EQ senza bande selezionate e ruota Bassi, Medi o Alti. Ctrl+click su una manopola rimette piatto il suo terzo.',
  'tour.tone.open': 'Apri l’EQ',
  'tour.tone.imageAlt':
    'La curva dell’equalizzatore divisa nei terzi dei bassi, dei medi e degli alti, le tre manopole che li muovono e le disposizioni rapide da sei a trentuno bande.',
  'tour.studio.kicker': 'FLUIDEQ PLUS',
  'tour.studio.title': 'Crea il tuo visualizzatore',
  'tour.studio.subtitle': 'Gratis per ogni account',
  'tour.studio.lead':
    'Lo Studio trasforma un’idea in una scena che si muove con la tua musica. È gratuito per ogni account: crea, esporta e pubblica tutte le scene che vuoi.',
  'tour.studio.point1':
    'Ogni scena viene controllata prima di arrivare nella galleria, e una volta approvata suona ovunque per te, gratis.',
  'tour.studio.point2':
    'Le scene possono essere veri mondi 3D che pestano sulla cassa e scattano sul drop.',
  'tour.studio.point3':
    'Copia il prompt per l’IA e il tuo assistente IA potrà vedere la tua scena e sentire come si muove il brano.',
  'tour.studio.how':
    'Apri Visualizzatori e scegli Studio nella barra laterale.',
  'tour.studio.open': 'Apri Visualizzatori',
  'tour.studio.imageAlt':
    'Lo Studio con Alpine sul palco, un lago sotto vette innevate e un’aurora, con sotto i tre passaggi per creare una scena con la tua IA, e due note: gratis per ogni account, e una scena pubblicata suona gratis per chi l’ha creata.',
  'tour.studio.earned': 'Pubblicata: suona gratis per te',
  'tour.help.kicker': 'AIUTO',
  'tour.help.title': 'Chiedi alla guida con parole tue',
  'tour.help.subtitle': 'Refusi, plurali e la tua lingua',
  'tour.help.lead':
    'Cerca nella guida come chiederesti a un amico — «nessun suono», «limitatore», «sfondo» — nella tua lingua. Il capitolo più pertinente arriva per primo, e la guida ti porta al controllo, cerchiato nell’immagine.',
  'tour.help.point1':
    'Perdona refusi e plurali, e conosce i nomi che le persone danno alle cose.',
  'tour.help.point2':
    'Ogni controllo in un’immagine è numerato, come in un manuale stampato.',
  'tour.help.point3':
    'F1 apre la guida da qualsiasi punto, e Invio passa alla corrispondenza successiva.',
  'tour.help.how':
    'Premi F1, oppure fai clic sul libro nella barra del titolo e scegli Guida utente, poi scrivi ciò che cerchi.',
  'tour.help.open': 'Apri la guida',
  'tour.help.imageAlt':
    'La guida utente con la ricerca «nessun suono»: i capitoli in ordine di pertinenza con le parole evidenziate, e un’immagine con i controlli numerati.',
  'tour.help.query': 'nessun suono',

  'tour.engine.kicker': 'IL NOSTRO MOTORE AUDIO',
  'tour.engine.title': 'Ecco il motore FluidEQ',
  'tour.engine.subtitle': 'EQ e DSP per tutto ciò che ascolti',
  'tour.engine.lead':
    'FluidEQ ha ora un motore audio tutto suo. Gira dentro il servizio audio di Windows, dopo gli effetti della tua scheda audio, e applica il tuo EQ e l’intero rack DSP a tutto ciò che il computer riproduce: giochi, browser, app di streaming, non solo la Libreria.',
  'tour.engine.point1':
    'Il rack DSP su tutto l’audio di sistema, anche quando in FluidEQ non suona nulla.',
  'tour.engine.point2':
    'Livellamento dal vivo che riconosce il brano e Riduzione del rumore che pulisce durante l’ascolto.',
  'tour.engine.point3':
    'Esci da FluidEQ e il suono torna subito come prima, anche dopo un arresto anomalo.',
  'tour.engine.how':
    'Scegli il motore FluidEQ durante l’installazione, oppure apri il menu delle azioni dietro l’icona a impulso in alto a destra, premi la scheda del motore in cima, scegli Motore FluidEQ e premi Applica. Poi apri DSP e attiva uno stadio mentre suona un’app qualsiasi.',
  'tour.engine.open': 'Apri il DSP',
  'tour.engine.flow.label':
    'Tutto ciò che il computer riproduce attraversa il motore FluidEQ, prima il tuo EQ e poi il rack DSP, per arrivare alle tue cuffie e ai tuoi altoparlanti.',
  'tour.engine.flow.games': 'Giochi',
  'tour.engine.flow.browser': 'Browser',
  'tour.engine.flow.music': 'App musicali',
  'tour.engine.flow.video': 'Video',
  'tour.engine.flow.inside': 'Dentro l’audio di Windows',
  'tour.engine.flow.eq': 'Il tuo EQ',
  'tour.engine.flow.rack': 'Rack DSP',
  'tour.engine.flow.headphones': 'Cuffie',
  'tour.engine.flow.speakers': 'Altoparlanti',

  'tour.room.kicker': 'SURROUND IN CUFFIA',
  'tour.room.title': 'Siediti nella Stanza',
  'tour.room.subtitle': 'Ventiquattro stanze, tutte gratuite',
  'tour.room.lead':
    'La Stanza trasforma le tue cuffie in una sala d’ascolto, ogni canale un diffusore intorno a te. Tredici nuove stanze si aggiungono alle undici classiche, ognuna diversa dalle altre, misure alla mano, ed è tutto gratuito.',
  'tour.room.point1':
    'Lo stereo diventa due diffusori davanti a te, o riempie la stanza se lo chiedi; un film 5.1 cinque e il sub; un gioco 7.1 l’intero anello.',
  'tour.room.point2':
    'Scegli una stanza sotto «In evidenza», «Stanze classiche» o «I tuoi»; tutto ciò di cui è fatta una stanza è nella sua pagina.',
  'tour.room.point3':
    'Una prova d’ascolto sceglie a orecchio la testa che mette i suoni davanti a te, in cinque coppie.',
  'tour.room.how':
    'Apri DSP, scegli Stanza nella barra e accendila. Scegli una stanza, poi trascina un diffusore o gira una manopola; sotto «La tua testa», premi «Avvia la prova d’ascolto».',
  'tour.room.open': 'Apri la Stanza',
  'tour.room.imageAlt':
    'Una stanza vista dall’alto: sette diffusori e un sub intorno a una testa al centro, ognuno con il suo percorso verso le orecchie.',

  'tour.plus.kicker': 'VISUALIZZATORI',
  'tour.plus.title': 'Scene che sono tue per sempre',
  'tour.plus.subtitle': 'Visualizzatori, Studio, illuminazione e altro',
  'tour.plus.lead':
    'Un’intera scheda di extra che fa crescere FluidEQ: scene disegnate sulla tua scheda grafica, uno Studio per creare le tue, sfondi del desktop e l’Illuminazione dinamica. Una scena costa un credito e resta tua, e l’equalizzatore, il rack e i player restano gratuiti, come sempre.',
  'tour.plus.point1':
    'Accedi da Account nel menu delle azioni: un account confermato riceve crediti gratis per iniziare.',
  'tour.plus.point2':
    'I pacchetti di crediti si pagano una sola volta, con condizioni in parole semplici prima di pagare. Nulla si rinnova, e l’app non vede mai la tua carta.',
  'tour.plus.point3':
    'Ogni scena si può guardare prima, e quelle che ottieni suonano su ogni computer in cui accedi.',
  'tour.plus.how':
    'Apri la scheda Visualizzatori: Galleria, Studio e Illuminazione dinamica sono sul lato sinistro.',
  'tour.plus.open': 'Apri Visualizzatori',
  'tour.plus.imageAlt':
    'La scheda Visualizzatori: Galleria, Studio e Illuminazione dinamica sul lato, e la Galleria con Cromo, Fioritura, Aurora, Alpino e Città al neon.',
  'tour.scene.alpine': 'Alpino',
  'tour.scene.aurora': 'Aurora',
  'tour.scene.bloom': 'Fioritura',
  'tour.scene.chrome': 'Cromo',
  'tour.scene.neonCity': 'Città al neon',

  'tour.visualizers.kicker': 'VISUALIZZATORI',
  'tour.visualizers.title': 'Scene che si muovono con la tua musica',
  'tour.visualizers.subtitle': 'Disegnate dalla tua scheda grafica',
  'tour.visualizers.lead':
    'Le scene sono immagini vive (montagne sotto le stelle, cortine d’aurora, una città al neon) disegnate dalla tua scheda grafica sotto le curve del tuo EQ. Bassi, battito e acuti muovono ognuno qualcosa di diverso, e la finestra intorno può prenderne i colori.',
  'tour.visualizers.point1':
    'Un solo selettore per tutto: {styles} stili gratuiti da modellare e colorare, e le scene per categoria.',
  'tour.visualizers.point2':
    'Sfoglia la galleria, prova per dieci secondi gli esempi di FluidEQ e aggiungi le scene che ti piacciono.',
  'tour.visualizers.point3':
    'Cambia aspetto in automatico, passa a schermo intero e regola attacco e rilascio di una scena in Vista.',
  'tour.visualizers.how':
    'Fai clic sul nome dell’aspetto sul grafico e scegline una in Visualizzatori, oppure sfogliale tutte in Visualizzatori → Galleria.',
  'tour.visualizers.open': 'Apri l’EQ',
  'tour.visualizers.imageAlt':
    'Alpino, una scena con montagne su un lago di notte, in riproduzione sul grafico sotto le curve dell’EQ, con altre quattro scene più in basso.',

  'tour.desktop.kicker': 'VISUALIZZATORE DEL DESKTOP',
  'tour.desktop.title': 'La tua musica dietro il desktop',
  'tour.desktop.subtitle': 'Una scena su ogni monitor',
  'tour.desktop.lead':
    'Metti una scena dietro le icone del desktop. Si muove con ciò che stai ascoltando, o con calma per conto suo, e ogni monitor può mostrare una propria scena.',
  'tour.desktop.point1':
    'Scegli i monitor su una mappa della tua scrivania, ognuno con il suo visualizzatore.',
  'tour.desktop.point2':
    'Si mette in pausa mentre le finestre coprono il monitor, con il PC bloccato e quando va a batteria.',
  'tour.desktop.point3': 'Riparte da solo al prossimo avvio di FluidEQ.',
  'tour.desktop.how':
    'Con una scena sul grafico, premi il pulsante del monitor accanto al suo nome oppure scegli Vista → Imposta come sfondo del desktop.',
  'tour.desktop.open': 'Apri l’EQ',
  'tour.desktop.imageAlt':
    'Tre monitor, ognuno con una scena (Aurora, Alpino e Città al neon) dietro le icone del desktop e la barra delle applicazioni.',

  'tour.lighting.kicker': 'ILLUMINAZIONE DINAMICA',
  'tour.lighting.title': 'La tua scrivania si accende con la scena',
  'tour.lighting.subtitle':
    'Beta · i tuoi dispositivi RGB seguono il visualizzatore',
  'tour.lighting.lead':
    'Tastiera, mouse, tappetino, cuffie e supporto prendono i colori e il ritmo della scena sul grafico, tramite Windows Dynamic Lighting e Razer Chroma.',
  'tour.lighting.point1':
    'Quattro stili per ogni visualizzatore: Scena, Onda di colore, Spettro e Onda ritmica.',
  'tour.lighting.point2':
    'Regola ogni dispositivo singolarmente e scegli cosa succede quando la musica si ferma.',
  'tour.lighting.point3':
    'Un’anteprima dal vivo disegna proprio la tua scrivania mentre si illumina. È in beta: facci sapere come si comportano i tuoi dispositivi.',
  'tour.lighting.how':
    'Apri Visualizzatori → Illuminazione dinamica e attivala, poi metti una scena sul grafico.',
  'tour.lighting.open': 'Apri Visualizzatori',
  'tour.lighting.imageAlt':
    'Una tastiera, un mouse e un tappetino illuminati con il rosa, il viola e il ciano di Città al neon.',

  'tour.share.kicker': 'OGNI PC, IN ENTRAMBE LE DIREZIONI',
  'tour.share.title': 'Condividi l’audio tra i tuoi computer',
  'tour.share.subtitle':
    'Senti ogni computer del gruppo, a qualunque tu sia seduto',
  'tour.share.lead':
    'Il tuo PC da gioco, il tuo portatile e qualsiasi altro computer della tua rete suonano in un unico gruppo: a qualunque tu sia seduto, senti gli altri, senza perdite, cifrato e con l’EQ di quel computer.',
  'tour.share.pairLabel': 'IN ENTRAMBE LE DIREZIONI',
  'tour.share.pairName': 'Ogni computer riproduce il suono degli altri',
  'tour.share.wireLabel': 'Senza perdite · Cifrato · LAN privata',
  'tour.share.stepsTitle': 'Configuralo in tre passaggi',
  'tour.share.step1Title': 'Su un computer, copia il suo codice',
  'tour.share.step1':
    'Apri la scheda Condividi audio, premi «Aggiungi computer» e poi «Copia codice». Il codice resta sempre lo stesso.',
  'tour.share.step2Title': 'Sull’altro, incollalo e collega',
  'tour.share.step2':
    'Lì premi «Aggiungi computer», incolla il codice in «Codice dell’altro computer» e premi «Collega». I computer che colleghi dopo entrano in tutto il gruppo.',
  'tour.share.step3Title': 'Scegli cosa va dove',
  'tour.share.step3':
    'Ogni computer ha «Ricevi» e «Invia», e «Condividi» spegne il tuo suono per tutti. «Il tuo mix» regola ogni livello. Pausa e Scollega sono nel menu di ogni computer, e i pulsanti della barra funzionano attraverso la rete.',
  'tour.share.fact1Title': 'Senza perdite',
  'tour.share.fact1':
    'PCM Float32 da un capo all’altro. Nessun codec, nessuna perdita di generazione.',
  'tour.share.fact2Title': 'Cifrato',
  'tour.share.fact2':
    'AES-256-GCM su ogni pacchetto. Il codice è la chiave; senza, nessuno può ascoltare.',
  'tour.share.fact3Title': 'Resta collegato',
  'tour.share.fact3':
    'Il gruppo si ritrova da solo dopo un riavvio, la sospensione, un’interruzione di rete o un cambio di motore. I computer assenti restano in elenco.',
  'tour.share.tip':
    'Parti piano: computer che suonano insieme si sommano. Abbassa il volume prima del primo collegamento.',
  'tour.share.open': 'Apri Condividi audio',

  'tour.library.kicker': 'LA TUA MUSICA, IL TUO LETTORE',
  'tour.library.title': 'Una Libreria per la musica che possiedi',
  'tour.library.subtitle': 'Entrano cartelle, escono album',
  'tour.library.lead':
    'Indica una cartella a FluidEQ e leggerà ogni brano e video al suo interno, tag e copertine compresi, trasformandoli in una collezione da sfogliare per album, artista, genere, brano o cartella. La riproduzione passa dal lettore di FluidEQ, così l’EQ e il rack DSP sono sempre sul percorso.',
  'tour.library.point1':
    'Tre modi di guardare lo stesso scaffale: elenco, griglia e cover flow, con il salto alla lettera per le collezioni grandi.',
  'tour.library.point2':
    'Una coda «In coda» con «Continua a suonare», che prosegue con altro dello stesso genere quando la lista finisce.',
  'tour.library.point3':
    'Playlist e una lista Preferiti permanente. Clic destro su un brano per aggiungerlo a una delle due, o alla coda.',
  'tour.library.point4':
    'Memoria dell’EQ intelligente per brano: mentre l’EQ intelligente continua a misurare, attiva «Salva per questo brano», e dopo due minuti la sua correzione resta memorizzata per quella traccia e torna quando la riascolti.',
  'tour.library.how':
    'Apri la scheda Libreria, premi «Aggiungi cartella» o trascina una cartella sulla pagina e lascia finire la scansione. Scegli Album, Artisti, Generi, Brani, Cartelle o Albero, poi premi Riproduci.',
  'tour.library.open': 'Apri la Libreria',

  'tour.dsp.kicker': 'UN RACK DA MASTERING',
  'tour.dsp.title': 'Il rack DSP',
  'tour.dsp.subtitle': 'Dieci stadi, ognuno su una pagina tutta sua',
  'tour.dsp.lead':
    'Un rack di stadi da studio: Normalizzatore, Riduzione del rumore, Exciter, Fucina dei bassi, Equalizzatore, Punch dei bassi, Dimensione, Stanza, Maximizer e Master, più una dissolvenza incrociata tra i brani della Libreria. Con il motore FluidEQ agisce su tutto ciò che il computer riproduce; con Equalizer APO, sulla Libreria. Ogni stadio ha una pagina tutta sua con una vista dal vivo, la maggior parte ha dei preset, e cinque hanno un interruttore Isola per sentire solo ciò che fanno.',
  'tour.dsp.point1':
    'Riduzione del rumore ripara fruscio, ronzio e click durante la riproduzione, e un pulitore vocale neurale lavora sui brani della Libreria.',
  'tour.dsp.point2':
    'Fucina dei bassi aggiunge un’ottava reale sotto il basso; Punch dei bassi ne modella attacco, sostegno e fioritura, con un Mix fino al 200%.',
  'tour.dsp.point3':
    'Un Equalizzatore parametrico da 6 a 31 bande, quindici di partenza, con fase minima o lineare, mid/side, sovracampionamento e oltre cento preset con nome.',
  'tour.dsp.point4':
    'Master con obiettivo di sonorità LUFS e protezione true-peak, preset di consegna da Streaming a Vinile, e Pareggia guadagno per confrontare il suono, non il volume.',
  'tour.dsp.how':
    'Apri la scheda DSP, scegli una catena in Preset, poi clicca uno stadio nelle schede laterali e mettilo su Attivo. Con Equalizer APO, riproduci prima un brano dalla Libreria.',
  'tour.dsp.open': 'Apri il DSP',

  'tour.output.kicker': 'SUONA IN DUE POSTI',
  'tour.output.title': 'Profili della seconda uscita',
  'tour.output.subtitle': 'Cuffie e casse insieme, ognuna con il suo profilo',
  'tour.output.lead':
    'Ascolta in cuffia e sugli altoparlanti con EQ separati. La seconda uscita riceve il suono prima dell’EQ dell’uscita principale e applica il proprio profilo salvato. Non serve un driver di routing.',
  'tour.output.point1':
    'Attiva un altro dispositivo in Seconda uscita e regola il suo volume.',
  'tour.output.point2':
    'Scegli uno dei suoi profili salvati sotto il dispositivo, oppure premi {editSound} accanto per cambiarne il suono senza cambiare l’uscita principale. L’uscita principale mantiene la sua regolazione.',
  'tour.output.point3':
    'Un solo lettore: avviare qualcosa in FluidEQ mette in pausa il resto della macchina, e viceversa.',
  'tour.output.point4':
    'Ogni uscita tiene il tempo da sola: circa 30 ms indietro all’inizio, un po’ di più solo dopo un’interruzione, e il suo ritardo mostrato in millisecondi, compreso il suono di un altro computer quando Condividi audio lo riproduce qui.',
  'tour.output.how':
    'Apri la scheda EQ e poi Seconda uscita a destra. Attiva un dispositivo, scegli il profilo EQ sotto il suo nome e regola il volume; sotto compare il suo ritardo.',
  'tour.output.open': 'Apri l’EQ',
  'tour.output.imageAlt':
    'Il pannello Seconda uscita con BlackShark V2 Pro attivo, il selettore del profilo EQ, il volume e il ritardo.',

  'tour.outputs.kicker': 'OGNI USCITA RICORDA',
  'tour.outputs.title': 'Ogni uscita mantiene il suo suono',
  'tour.outputs.subtitle': 'Cuffie e altoparlanti, ognuno regolato a modo suo',
  'tour.outputs.lead':
    'Passa dalle cuffie agli altoparlanti e ogni uscita riporta con sé il suo suono: l’EQ, il preset, il Tono, i tagli, il rack DSP, la Stanza e il livellamento vengono salvati con ogni uscita.',
  'tour.outputs.point1':
    'Scegli un’uscita e tutto ciò che hai impostato per lei torna subito. Cuffie e altoparlanti non condividono più lo stesso preset né la stessa curva.',
  'tour.outputs.point2':
    'Una seconda uscita suona direttamente dal motore FluidEQ con un suono tutto suo, e l’uscita principale non la aspetta mai. {editSound}, lì accanto, cambia quel suono senza cambiare l’uscita principale.',
  'tour.outputs.point3':
    'Le cuffie Bluetooth mostrano la batteria accanto all’uscita, e una seconda uscita mostra in millisecondi quanto è in ritardo.',
  'tour.outputs.how':
    'Apri l’EQ e scegli un’uscita in {output}, a destra: tutto ciò che imposti da quel momento resta con lei. Per una seconda, attivala in {secondOutput} e premi {editSound}.',
  'tour.outputs.open': 'Apri l’EQ',
  'tour.outputs.imageAlt':
    'Il riquadro Uscita con delle cuffie e degli altoparlanti, ciascuno con il suo preset, la sua curva e i suoi stadi DSP, che suonano a turno, e accanto una seconda uscita che suona insieme con il suo suono, la sua batteria e Modifica suono.',

  'tour.bands.kicker': 'L’EQ IN NUMERI',
  'tour.bands.title': 'I valori di ogni banda, direttamente sul grafico',
  'tour.bands.subtitle': 'Etichette sulla curva, Modalità EQ accanto',
  'tour.bands.lead':
    'Ogni banda può mostrare frequenza, Q e guadagno sopra il suo punto, e le etichette non si intralciano. La Modalità EQ ora sta accanto al grafico invece che sopra, così le curve restano in vista mentre cambi come suonano.',
  'tour.bands.point1':
    'Un’etichetta sta proprio sopra o sotto il suo punto, mai sopra un’altra, resta ferma mentre trascini la sua banda e torna al suo posto appena c’è spazio.',
  'tour.bands.point2':
    '{eqMode} è il primo riquadro del pannello laterale, con una scheda per {yourEq} e una per {corrections}. Il suo pulsante sopra il grafico porta il riquadro in vista.',
  'tour.bands.point3':
    'Ogni punto, cursore e manopola si usa da tastiera, e spostare un cursore ridisegna la curva nello stesso fotogramma.',
  'tour.bands.how':
    'Apri l’EQ, scegli {view} → {everything} sopra il grafico (o premi {shortcut}) e sposta una banda: i suoi valori la seguono. {eqMode} ti aspetta in cima al pannello di destra.',
  'tour.bands.open': 'Apri l’EQ',
  'tour.bands.imageAlt':
    'Il grafico dell’EQ con frequenza, Q e guadagno di ogni banda sopra il suo punto, una banda che si muove con le frecce della tastiera e, sotto, il riquadro Modalità EQ con Il tuo EQ e Correzioni.',
  'tour.bands.shortcut': 'Ctrl+W',

  'tour.ears.kicker': 'UNA BANDA, DUE ORECCHIE',
  'tour.ears.title': 'Regola ogni orecchio da solo',
  'tour.ears.subtitle': 'Sinistro + destro nel menu della banda',
  'tour.ears.lead':
    'Fai clic destro su una banda e scegli {split}: diventa una banda per ogni orecchio, alla stessa frequenza, e sposti ciascuna da sola. La curva dell’orecchio sinistro è continua, quella del destro tratteggiata.',
  'tour.ears.point1':
    '{both} le riunisce nel loro punto medio, a metà strada in frequenza e guadagno. Anche {reset} e {clear} le riuniscono.',
  'tour.ears.point2':
    '{delete} è nello stesso menu, nell’EQ principale e nel rack DSP, e chiede una seconda pressione prima di eliminare.',
  'tour.ears.point3':
    'Una curva di Squiglink si può importare in un solo orecchio: {importInto} riempie solo il sinistro o il destro e lascia l’altro com’era.',
  'tour.ears.how':
    'Apri l’EQ, fai clic destro su una banda nel grafico e scegli {split}. L’EQ del rack DSP ha lo stesso menu finché si applica allo stereo.',
  'tour.ears.open': 'Apri l’EQ',
  'tour.ears.imageAlt':
    'Il grafico dell’EQ con una banda divisa in una per l’orecchio sinistro e una per il destro, che si separano e si riuniscono nel loro punto medio, la curva sinistra continua e la destra tratteggiata, accanto al menu della banda con Entrambe le orecchie e Sinistro + destro.',
  // Film voice: generated from .claude/video-kit/films/narration/lines.cjs — edit there.
  'tour.film.eachEar.intro':
    'Ora ogni banda di FluidEQ può suonare in modo diverso in ciascun orecchio.',
  'tour.film.eachEar.menu': 'Fai clic destro su una banda per aprirne il menu.',
  'tour.film.eachEar.split':
    'Scegli Sinistro + destro. La banda si divide in due, una metà per ogni orecchio.',
  'tour.film.eachEar.lines':
    'Trascina ogni metà da sola. La linea continua è il tuo orecchio sinistro, quella tratteggiata il destro.',
  'tour.film.eachEar.sliders':
    'Ogni orecchio ha anche il suo cursore, segnato L o R.',
  'tour.film.eachEar.join':
    'Per riunirle, scegli Entrambe le orecchie. Le due metà si incontrano a metà strada.',
  'tour.film.sound.intro':
    'Ogni modifica che fai in FluidEQ si sente subito, e in modo fluido.',
  'tour.film.sound.glide':
    'Muovi una banda mentre suona la musica. Ogni modifica entra scivolando, senza mai un clic.',
  'tour.film.sound.precise':
    'Nel menu Modalità EQ, Alti è su Preciso. Ogni banda suona esattamente come disegnata, fino a venti kilohertz.',
  'tour.film.sound.classic':
    'Scegli Classico per costruire le bande come fa Equalizer APO.',
  'tour.film.games.intro':
    'FluidEQ può dare a ciascuno dei tuoi giochi un suono tutto suo.',
  'tour.film.games.add':
    'Premi Aggiungi un gioco e sceglilo tra i giochi installati dai tuoi launcher.',
  'tour.film.games.sound': 'Poi scegli il suono che deve avere.',
  'tour.film.games.front':
    'Quando il gioco passa in primo piano, il suo suono si carica da solo.',
  'tour.film.games.closed': 'Chiudi il gioco e torna il tuo suono.',
  'tour.film.compact.intro':
    'Quando ti servono solo i comandi, FluidEQ si richiude in un piccolo lettore.',
  'tour.film.compact.go':
    'Premi il pulsante del lettore in alto e la finestra diventa il Lettore compatto.',
  'tour.film.compact.eq':
    'Il tuo EQ ti segue. Gira una manopola e lo senti subito.',
  'tour.film.compact.back': 'Un solo clic ti riporta alla finestra completa.',
  'tour.film.deleteImport.intro':
    'Due piccole novità che proteggono il tuo EQ.',
  'tour.film.deleteImport.asks':
    'Elimina banda ora chiede prima conferma. Premi di nuovo per eliminare davvero la banda.',
  'tour.film.deleteImport.oneEar':
    'Un’importazione può anche riempire un solo orecchio. Scegli Importa in, poi Orecchio sinistro.',
  'tour.film.deleteImport.otherEar':
    'Viene sostituito solo l’orecchio sinistro. Il destro resta esattamente com’era.',
  'tour.film.outputs.intro':
    'Ogni uscita del tuo computer conserva il suo suono.',
  'tour.film.outputs.each':
    'Passa dagli altoparlanti alle cuffie e l’EQ diventa quello delle cuffie.',
  'tour.film.outputs.back':
    'Torna indietro e gli altoparlanti suonano esattamente come li avevi lasciati.',
  'tour.film.outputs.second':
    'Puoi anche suonare contemporaneamente da una Seconda uscita, con il suo suono.',
  'tour.film.outputs.edit':
    'Premi Modifica suono per regolarla proprio qui, mentre l’uscita principale continua a suonare.',
  'tour.film.dsp.intro':
    'Il rack DSP modella tutto ciò che senti, dopo il tuo EQ.',
  'tour.film.dsp.preset':
    'Scegli un preset e imposta tutto il rack in un colpo.',
  'tour.film.dsp.stages':
    'Ogni stadio ha una pagina tutta sua, con tutti i comandi in vista.',
  'tour.film.dsp.meters':
    'I suoi indicatori si muovono con la musica, così vedi cosa fa.',
  'tour.film.deesser.intro':
    'Il rack DSP ora ha un De-esser, per le voci con le S taglienti.',
  'tour.film.deesser.cuts':
    'Scegli un preset come Podcast e parlato. Ogni S tagliente viene abbassata e mostrata in ambra, mentre i piatti restano intatti.',
  'tour.film.deesser.isolate': 'Premi Isola per sentire solo ciò che toglie.',
  'tour.film.headphones.intro':
    'FluidEQ può correggere le tue cuffie con misure fatte da altri.',
  'tour.film.headphones.search':
    'Apri Preset EQ e cerca le tue cuffie nella libreria di OPRA.',
  'tour.film.headphones.measure':
    'Scegli una misura. Ognuna dice chi l’ha fatta.',
  'tour.film.headphones.applied':
    'Premi Applica l’EQ del modello. La correzione va su un livello tutto suo e le tue bande restano come sono.',
  'tour.film.headphones.paste':
    'Puoi anche incollare un’esportazione da Squiglink.',
  'tour.film.headphones.ears':
    'Applicala come tuo EQ, a entrambe le orecchie o a una sola.',
  'tour.film.headphones.curve': 'Oppure applicala come una curva a sé.',
  'tour.film.karaoke.intro':
    'Karaoke trasforma FluidEQ in un palco per le tue canzoni.',
  'tour.film.karaoke.open':
    'Premi Apri brano e scegli il brano insieme al suo file dei testi.',
  'tour.film.karaoke.words':
    'Premi Riproduci. Ogni parola si illumina mentre viene cantata.',
  'tour.film.karaoke.pitch':
    'Sotto, la guida dell’intonazione mostra ogni nota da cantare. Accendi il microfono per vederci sopra la tua voce.',
  'tour.film.maker.intro':
    'Il Creatore di karaoke trasforma un brano in un file karaoke.',
  'tour.film.maker.timeline':
    'Carica un brano e premi Crea. Ogni parola e ogni nota stanno su una linea del tempo.',
  'tour.film.maker.play':
    'Avvialo, e la testina scorre su ogni parola e nota. Trascinane una per correggerne il tempo o l’intonazione.',
  'tour.film.maker.use':
    'Il Creatore sa anche preparare un brano da solo, partendo dalla voce di chi canta. Quando suona bene, premi Usa nel lettore.',
  'tour.film.looks.intro':
    'Lo spettro sotto il tuo EQ si può disegnare come preferisci.',
  'tour.film.looks.open':
    'Premi Nuovo aspetto nella barra degli strumenti del grafico.',
  'tour.film.looks.forms':
    'Scorri le forme con la freccia: barre LED, barre al neon, skyline, torri di vetro e altro ancora.',
  'tour.film.looks.shape':
    'Poi dagli forma. Elementi decide quante barre ci sono, e anche colori, spazi e movimento li scegli tu.',
  'tour.film.looks.save':
    'Premi Salva per tenerlo come un aspetto tuo, oppure condividilo come file.',
  'tour.walkthrough.kicker': 'IL TOUR COMPLETO',
  'tour.walkthrough.title': 'Tutto FluidEQ in un solo video',
  'tour.walkthrough.subtitle': 'Guardalo dall’inizio alla fine',
  'tour.walkthrough.lead':
    'Una visita guidata a tutto ciò che fa FluidEQ, dalla prima banda che trascini fino ai visualizzatori, con una voce che ti dice come usare ogni parte.',
  'tour.film.walkthrough.intro':
    'Questo è FluidEQ 2.2: un equalizzatore per tutto ciò che suona sul tuo computer. Facciamo un giro.',
  'tour.film.walkthrough.graph':
    'Trascina un punto qualsiasi del grafico per modellare il suono. Ogni banda mostra frequenza e guadagno direttamente sulla curva.',
  'tour.film.walkthrough.sliders':
    'I cursori muovono le stesse bande, e la curva li segue subito. La banda che tocchi apre i suoi comandi qui sotto.',
  'tour.film.walkthrough.tone':
    'Fai clic altrove e torna il Tono: Bassi, Medi e Alti, con un taglio dei bassi e uno degli alti ai lati.',
  'tour.film.walkthrough.ears':
    'Fai clic destro su una banda e scegli Sinistro + destro per regolare ogni orecchio da solo. La linea continua è il sinistro, quella tratteggiata il destro.',
  'tour.film.walkthrough.eqmode':
    'La Modalità EQ sta accanto al grafico. Decide quanto forti suonano le tue curve, e Preciso riproduce gli alti esattamente come sono disegnati.',
  'tour.film.walkthrough.headphones':
    'In Preset EQ trovi le tue cuffie tra migliaia di modelli misurati, e applichi la loro correzione con un clic.',
  'tour.film.walkthrough.mycurves':
    'Salvala in Le mie curve, la tua lista accanto a quella di OPRA, pronta quando ti serve.',
  'tour.film.walkthrough.outputs':
    'Ogni uscita tiene il suo suono. Passa alle cuffie e tornano esattamente come le avevi lasciate. Una seconda uscita può suonare la stessa musica su un altro dispositivo.',
  'tour.film.walkthrough.songs':
    'Attiva Ricorda il suono di ogni brano, e ogni brano tornerà con il suono che gli hai dato.',
  'tour.film.walkthrough.games':
    'I preset di gioco cambiano il suono appena un gioco passa in primo piano, e lo riportano indietro quando lo chiudi.',
  'tour.film.walkthrough.dsp':
    'Il rack DSP è una catena di effetti da studio per tutto ciò che ascolti. Scegli un preset per l’intero rack, dai generi musicali ai film e ai giochi.',
  'tour.film.walkthrough.deesser':
    'Il nuovo De-esser abbassa solo la S tagliente di una voce, e lascia stare i piatti.',
  'tour.film.walkthrough.character':
    'L’Exciter aggiunge brillantezza, la Fucina dei bassi aggiunge corpo e Dimensione allarga lo stereo.',
  'tour.film.walkthrough.room':
    'La Stanza ti mette tra gli altoparlanti di uno spazio vero, anche in cuffia.',
  'tour.film.walkthrough.maximizer':
    'E il Maximizer tiene tutto forte e pulito, senza mai distorcere.',
  'tour.film.walkthrough.library':
    'La Libreria riproduce la tua musica con lo stesso suono, con album, playlist e In coda.',
  'tour.film.walkthrough.compact':
    'Il Lettore compatto mette tutto in una piccola finestra: il brano, i comandi e il tuo EQ.',
  'tour.film.walkthrough.oneline':
    'Piegalo su una riga e non ti intralcia, con un visualizzatore che si muove piano dietro il brano.',
  'tour.film.walkthrough.looks':
    'Il grafico può diventare un visualizzatore. Scegli uno stile, o un’intera scena, e la finestra ne prende i colori.',
  'tour.film.walkthrough.gallery':
    'In Visualizzatori, la Galleria raccoglie scene create da FluidEQ e dalla sua comunità. Ognuna è tua per sempre, per un credito.',
  'tour.film.walkthrough.studio':
    'Nello Studio descrivi una modifica con parole tue, e guardala prendere forma sul palco.',
  'tour.film.walkthrough.karaoke':
    'Karaoke trasforma i tuoi brani in canzoni da cantare, con testi sincronizzati e la tua intonazione sullo schermo.',
  'tour.film.walkthrough.share':
    'Condividi audio collega i computer della tua rete di casa, così la musica scorre tra loro, in entrambe le direzioni.',
  'tour.film.walkthrough.help':
    'E tutto questo è nella Guida utente, disegnata dall’app stessa.',
  'tour.film.walkthrough.outro':
    'Questo è FluidEQ. Fallo suonare, e apparire, come piace a te.',
  'tour.film.engine.intro':
    'FluidEQ ha un motore audio tutto suo. Porta il tuo EQ e il rack DSP a tutto ciò che suona sul computer.',
  'tour.film.engine.choose':
    'Apri il menu delle azioni in alto a destra e premi la scheda del motore. Il motore FluidEQ è quello da scegliere.',
  'tour.film.engine.rack':
    'Poi apri DSP e scegli un preset. Giochi, browser e app di musica passano tutti da lì.',
  'tour.film.library.intro':
    'La Libreria riproduce la musica che possiedi, attraverso il tuo EQ.',
  'tour.film.library.albums':
    'I tuoi album appaiono come copertine. Sfogliali con le frecce.',
  'tour.film.library.album':
    'Fai clic su un album per aprirlo, con tutti i suoi brani.',
  'tour.film.library.play':
    'Premi Riproduci e suona attraverso lo stesso EQ e lo stesso rack DSP di tutto il resto.',
  // End of film voice.
  'tour.film.soundOn': 'Attiva l’audio',
  'tour.film.soundOff': 'Disattiva l’audio',
  'tour.film.watch': 'Guarda il video',
  'tour.film.close': 'Chiudi il video',
  'tour.film.unavailable':
    'Questo video non si può riprodurre ora. Riprova più tardi.',

  'tour.myCurves.kicker': 'CURVE TUTTE TUE',
  'tour.myCurves.title': 'La tua lista di curve, accanto a quella di OPRA',
  'tour.myCurves.subtitle': 'Conserva, rinomina e riusa le tue curve',
  'tour.myCurves.lead':
    '{eqPresets} ora ha {myCurves} accanto alla libreria OPRA: ogni curva a cui vuoi tornare, con il nome che le dai e un disegno della sua forma. Aggiungine una da un’esportazione di Squiglink, da un file .txt, dal tuo EQ così com’è o da una scelta OPRA.',
  'tour.myCurves.point1':
    '{applyCurve} riproduce una curva come correzione delle cuffie, con la sua intensità e il suo interruttore; {applyEq} mette invece le sue bande nel tuo EQ.',
  'tour.myCurves.point2':
    'Il collegamento a {squiglink} in {myCurves} apre l’anteprima di importazione; {save} conserva la curva per dopo.',
  'tour.myCurves.point3':
    '{exportList} scrive l’intera lista in un file, per un backup o per portarla su un altro computer; {importList} la rilegge e ti dice cosa resta fuori.',
  'tour.myCurves.how':
    'Apri {eqPresets} sotto EQ, scegli {myCurves} e premi {add}.',
  'tour.myCurves.open': 'Apri Preset EQ',
  'tour.myCurves.imageAlt':
    'La pagina Preset EQ su Le mie curve: una lista di quattro curve per cuffie, ognuna con il nome, la provenienza, il giorno in cui è stata aggiunta e un disegno della sua forma. Una curva appena salvata da Squiglink arriva in cima e suona come correzione delle cuffie.',

  'tour.songs.kicker': 'UN SUONO PER OGNI BRANO',
  'tour.songs.title': 'Brani che ricordano come ti piacciono',
  'tour.songs.subtitle': 'Regolalo una volta, ascoltalo così ogni volta',
  'tour.songs.lead':
    'Attiva {songSound} e il preset, il Tono e l’EQ con cui finisce un brano tornano la volta successiva che suona, sull’uscita su cui l’hai regolato.',
  'tour.songs.point1':
    'Cambia il preset, il Tono o una banda mentre un brano suona e quello è ciò che conserva. Un brano che non tocchi non conserva nulla.',
  'tour.songs.point2':
    'Torna con un avviso che nomina il brano e ciò che riporta, con {undo} e {forget} lì accanto.',
  'tour.songs.point3':
    'Quando il brano finisce, torna il suono che avevi prima, e ogni uscita ricorda il proprio: lo stesso brano può suonare in un modo in cuffia e in un altro sugli altoparlanti.',
  'tour.songs.how':
    'Apri l’EQ e attiva {songSound} in {output}, a destra. Fai partire un brano, scegli un preset o gira il Tono, poi lascialo finire o saltalo.',
  'tour.songs.open': 'Apri l’EQ',
  'tour.songs.imageAlt':
    'Una coda di quattro brani che suonano a turno, tre con il preset e la curva con cui sono stati lasciati e uno mai regolato, e sopra l’avviso che mostra un brano ricordato, con Annulla e Dimentica questo brano.',

  'tour.deesser.kicker': 'UNA S PIÙ MORBIDA',
  'tour.deesser.title': 'Un de-esser nel rack DSP',
  'tour.deesser.subtitle': 'S taglienti più basse, piatti intatti',
  'tour.deesser.lead':
    '{deEsser} abbassa le S, T e SC taglienti di una voce solo mentre suonano, e lascia piatti, hi-hat e il resto degli acuti com’erano.',
  'tour.deesser.point1':
    'Trova ogni S rispetto al livello del brano stesso, così un brano piano e uno forte sono trattati allo stesso modo, e vedi ogni S che ha preso e quanto ha tolto.',
  'tour.deesser.point2':
    'Abbassa solo le frequenze di cui è fatta la S, tutto ciò che sta sopra o l’intera voce, e {isolate} fa sentire solo ciò che toglie.',
  'tour.deesser.point3':
    '{speech}, {podcast} e {audiobook} lo attivano. Ogni filtro del rack ora può salvare profili tuoi.',
  'tour.deesser.how':
    'Apri il DSP e scegli {deEsser} nell’elenco a sinistra, oppure il preset {podcast}. Parti da un profilo, poi alza {sensitivity} finché ogni S viene presa.',
  'tour.deesser.open': 'Apri il DSP',
  'tour.deesser.imageAlt':
    'La striscia del de-esser che scorre: ogni S di una voce sopra la linea in cui lo stadio entra in azione, con il suo taglio appeso sotto in ambra, e gli hi-hat in grigio, intatti; sopra lo stadio con Spettrale scelto e sotto Voce, Podcast e Audiolibro.',

  'tour.chat.kicker': 'UNA SCENA SU RICHIESTA',
  'tour.chat.title': 'Chiedi una modifica, guardala sul palco',
  'tour.chat.subtitle': 'Una chat accanto al palco dello Studio',
  'tour.chat.lead':
    'Lo {studio} ora ha una chat accanto al suo palco. Di’ cosa deve cambiare – come appare una scena, come si muove con la musica, i suoi colori o la sua luce – e la tua IA modifica la scena e suona ogni versione sul palco man mano.',
  'tour.chat.point1':
    'Ogni risposta tiene la versione che ha fatto, e {bringBack} rimette una versione precedente. Ogni scena tiene le sue chat passate.',
  'tour.chat.point2':
    '{attach} invia un’immagine della scena con il tuo messaggio, e puoi disegnarci sopra per mostrare cosa intendi. I messaggi inviati mentre lavora aspettano in coda e partono insieme.',
  'tour.chat.point3':
    'Funziona con Claude Code installato su questo computer, con il tuo piano, e mostra quanto resta dei tuoi limiti.',
  'tour.chat.how':
    'Apri {plus}, scegli {studio} nella sua barra, scegli una scena o iniziane una e scrivi nella casella accanto al palco.',
  'tour.chat.open': 'Apri Visualizzatori',
  'tour.chat.imageAlt':
    'Il palco dello Studio accanto alla sua chat: la richiesta di far lampeggiare le luci del palco sul rullante, i passi della risposta spuntati uno a uno, la versione 2 tenuta con Ripristina, e le luci del palco che iniziano a lampeggiare quando suona la versione 2.',
  'tour.chat.ask': 'Fai lampeggiare le luci del palco sul rullante.',
  'tour.chat.reply':
    'Fatto: i due fari lampeggiano bianchi a ogni rullante e tornano al rosa.',

  'tour.looks.kicker': 'IL TUO VISUALIZZATORE',
  'tour.looks.title': 'Aspetti personalizzati per il grafico',
  'tour.looks.subtitle': 'Le tue forme, i tuoi colori, il tuo movimento',
  'tour.looks.lead':
    'Lo spettro sotto l’EQ si può disegnare come vuoi. Scegli una delle {forms} forme, dalle barre LED e al neon a terrazze, profili urbani e torri di vetro; coloralo con la sua colorazione Auto, per frequenza, per livello o per calore; decidi quanto in fretta attacca e quanto resta un picco; segna i picchi con scintille, comete o increspature. Salvalo come aspetto tuo e condividilo come file.',
  'tour.looks.point1':
    '{forms} forme, ognuna con i suoi controlli: elementi, spaziatura, riempimento, spessore, e se è riempita o a contorno.',
  'tour.looks.point2':
    'Colora ogni forma con la sua colorazione Auto, per frequenza, livello o calore con una sfumatura dei tuoi colori, oppure con un solo colore uniforme.',
  'tour.looks.point3':
    'Attacco e rilascio decidono il movimento; picchi luminosi, picchi riempiti e dodici segni di picco decidono come appare un colpo.',
  'tour.looks.point4':
    'Il bagliore funziona in ogni modalità, e gli aspetti si esportano in un file e si importano da un file.',
  'tour.looks.how':
    'Nella scheda EQ premi «Nuovo aspetto» nella barra del grafico. Scegli una forma con il selettore o premi Spazio per scorrerle, regola colori e movimento mentre la musica suona, poi Salva.',
  'tour.looks.open': 'Apri l’EQ',

  'tour.karaoke.kicker': 'UN PALCO A CASA',
  'tour.karaoke.title': 'Karaoke con guida all’intonazione',
  'tour.karaoke.subtitle': 'Le tue canzoni, i tuoi testi, il tuo microfono',
  'tour.karaoke.lead':
    'Trascina una canzone con o senza file di testo e FluidEQ li abbina in una scaletta, mostra il testo sincronizzato sopra la copertina o il video, ascolta il microfono e disegna la tua intonazione contro la melodia. Tutto resta su questo computer; il microfono non viene mai registrato né riprodotto.',
  'tour.karaoke.point1':
    'Un cursore Voce guida, una volta che FluidEQ ha separato la voce della canzone nel Creatore di karaoke: va dalla sola base all’originale completo, senza bisogno di un file strumentale.',
  'tour.karaoke.point2':
    'Una traccia dell’intonazione: le note della canzone come blocchi e la tua voce come linea dal vivo sopra di esse, con feedback Alta, Intonata e Bassa.',
  'tour.karaoke.point3':
    'Un riepilogo dell’esibizione alla fine, con le parti da esercitare e un conto alla rovescia per riprovare.',
  'tour.karaoke.point4':
    'Legge LRC, LRC avanzato con tempi per parola e UltraStar con sillabe e intonazione, su MP3, FLAC, WAV, OGG, M4A e altro. In più testi tradotti e accordi di chitarra stimati.',
  'tour.karaoke.how':
    'Apri la scheda Karaoke, premi «Apri brano» o «Aggiungi cartella», scegli una traccia nella scaletta, accendi il microfono, mostra la guida all’intonazione e premi Riproduci.',
  'tour.karaoke.open': 'Apri il Karaoke',

  'tour.maker.kicker': 'FALLO TU',
  'tour.maker.title': 'Il Creatore di karaoke',
  'tour.maker.subtitle': 'Qualsiasi canzone diventa un file karaoke',
  'tour.maker.lead':
    'Uno studio di authoring completo dentro la scheda Karaoke. Può fare tutto da solo: separare la voce dalla musica, leggere le parole e i loro tempi con un modello vocale locale e rilevare le note della melodia. Oppure batti, registri e disegni ogni tempo a mano su una timeline zoomabile. Tutto gira su questo computer.',
  'tour.maker.point1':
    '«Prepara questo brano automaticamente»: separa la voce, poi legge parole e tempi, con l’opzione di continuare in background.',
  'tour.maker.point2':
    'Conserva le tracce separate: la voce e la base, ognuna salvabile, anche in MP3.',
  'tour.maker.point3':
    'Strumenti manuali per i dettagli: battere le parole, registrare gli inizi delle righe, un ispettore di parola con inizio e durata, e dividere una parola in sillabe.',
  'tour.maker.point4':
    'Dipingi la melodia su una griglia di intonazione, segna le note dorate ed esporta come progetto FluidEQ, UltraStar TXT, LRC, LRC avanzato o base senza voce.',
  'tour.maker.how':
    'In Karaoke carica una canzone e premi «Crea». Accetta «Prepara automaticamente» nella procedura guidata, correggi le parole sulla timeline, poi «Usa nel lettore» ed «Esporta».',
  'tour.maker.open': 'Apri il Karaoke',

  'tour.media.kicker': 'IL WEB, ATTRAVERSO IL TUO EQ',
  'tour.media.title': 'Media online',
  'tour.media.subtitle': 'YouTube, YouTube Music, Bandcamp, Twitch e Suno',
  'tour.media.lead':
    'Un lettore integrato per i siti di streaming, così ciò che guardi e ascolti online passa dal tuo EQ invece che da un browser a parte. Cinque siti sono già collegati, ognuno con la sua ricerca, e i link che portano fuori vengono fermati con la scelta «Apri nel browser».',
  'tour.media.point1':
    'Un solo campo di ricerca che cerca nel sito aperto, con ricerche recenti che puoi cancellare.',
  'tour.media.point2':
    'Accedi una volta sola: il lettore conserva i tuoi accessi tra una visita e l’altra finché non ti disconnetti.',
  'tour.media.point3':
    'Riprendi: il lettore ricorda l’ultima pagina e il punto in cui eri, e ti riporta lì.',
  'tour.media.point4':
    'Download con indicatore di avanzamento e «Mostra nella cartella» a fine lavoro, e un pulsante di disconnessione, la porta in fondo alla barra degli strumenti, che cancella ogni cookie e accesso in un colpo.',
  'tour.media.how':
    'Apri la scheda Media online, scegli un sito dalla riga in alto, scrivi nel campo di ricerca e premi Cerca. Indietro, Avanti e Ricarica funzionano come in un browser.',
  'tour.media.open': 'Apri Media online',
  'tour.studio.free': 'Gratis per ogni account',
  'tour.film.englishAudio': 'Audio in inglese · sottotitoli tradotti',
};

export default tour;
