/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
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
  'tour.player.title': 'FluidEQ, racchiuso in un lettore',
  'tour.player.subtitle': 'Un interruttore trasforma la finestra in un lettore',
  'tour.player.lead':
    'Un interruttore nella barra del titolo trasforma tutto FluidEQ in un lettore. È l’ampli classico, con il suo orologio LED, le spie e l’equalizzatore completo; con {backdrop}, su un visualizzatore Plus, diventa di vetro. Lo stesso interruttore ti riporta alla pagina da cui eri partito.',
  'tour.player.point1':
    'Tutto l’equalizzatore viene con te: preset, disposizioni delle bande, Modalità EQ, EQ intelligente, Bassi, Medi e Alti.',
  'tour.player.point2':
    'Riducilo a una riga, tienilo sopra le altre finestre o fai doppio clic sul visualizzatore per riempire lo schermo.',
  'tour.player.point3':
    'Un tema tutto suo, e i brani trascinati su In coda entrano nella Libreria e nella coda.',
  'tour.player.how':
    'Premi l’interruttore Lettore compatto nella barra del titolo, accanto ad Aiuto. Sul lettore, lo stesso interruttore riporta l’app completa.',
  'tour.player.open': 'Prova il Lettore compatto',
  'tour.player.imageAlt':
    'L’angolo della barra del titolo con l’interruttore {player} cerchiato, e i due lettori che apre: l’ampli classico con orologio LED, spie, equalizzatore e coda, e il lettore di vetro, più largo, su un’aurora con {backdrop}.',
  'tour.player.classic': 'Ampli classico',
  'tour.player.glass': 'Vetro, con {backdrop}',
  'tour.look.kicker': 'UN NUOVO ASPETTO',
  'tour.look.title': 'Una finestra nuova, con colori nuovi',
  'tour.look.subtitle':
    'Un solo cursore del tema e un visualizzatore dietro a tutto',
  'tour.look.lead':
    'I pannelli poggiano su un unico piano aperto, nei colori della nuova icona, e un solo cursore, {brightness}, porta tutta la finestra dal quasi nero a un azzurro oceano chiaro. Con un visualizzatore Plus sul grafico, la finestra può prendere i suoi colori o mostrarlo dietro a tutto.',
  'tour.look.point1':
    '{brightness} è nel menu dietro l’icona a impulso, e accanto a {transparency} in {windowColours}.',
  'tour.look.point2':
    '{windowColours} offre {original}, {colours}, {ambient} e {backdrop}, ognuno con una riga su cosa fa alla finestra.',
  'tour.look.point3':
    'Finestre di dialogo e menu condividono un unico materiale, e la {rainbow} percorre i colori dell’icona, o quelli di un visualizzatore.',
  'tour.look.how':
    'Sposta {brightness} nel menu delle azioni dietro l’icona a impulso in alto a destra. Con un visualizzatore Plus sul grafico, apri {windowColours} dalla barra del grafico e scegli {backdrop}.',
  'tour.look.open': 'Apri l’EQ',
  'tour.look.imageAlt':
    'FluidEQ nella pagina EQ con l’aurora boreale su un lago dietro i pannelli, e il menu Colori della finestra con Fondale scelto, la Luminosità e la Trasparenza a metà.',
  'tour.gpu.kicker': 'UN NUOVO MOTORE PER I VISUALIZZATORI',
  'tour.gpu.title': 'Ogni visualizzatore sulla tua scheda grafica',
  'tour.gpu.subtitle': 'Quaranta stili al ritmo del tuo schermo, e mondi 3D',
  'tour.gpu.lead':
    'I quaranta stili del grafico ora si disegnano con il motore delle scene Plus: sulla tua scheda grafica, alla frequenza di aggiornamento del tuo schermo, così barre, particelle e picchi scorrono fluidi dove prima scattavano. E un visualizzatore Plus ora può essere un vero mondo 3D.',
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
    'Un visualizzatore Plus che è una città 3D di notte, e quattro nuovi stili fotografati sul grafico — {synthwave}, {horizon}, {towers} e {ledwall} — con il selettore degli stili cerchiato sul primo.',
  'tour.gpu.world': 'Mondo 3D',
  'tour.sparks.kicker': 'SCINTILLE DEL PUNTATORE',
  'tour.sparks.title': 'Visualizzatori che rispondono al tuo mouse',
  'tour.sparks.subtitle': 'Scintille, petali o neve dal puntatore',
  'tour.sparks.lead':
    'Passa il mouse su un visualizzatore Plus e lancia ciò di cui è fatto — scintille, petali, neve, braci — in una scia dietro il puntatore, ed esplode dove fai clic. Con {ambient} e con {backdrop}, i suoi uccelli, petali e luci fluttuano anche su tutta la finestra.',
  'tour.sparks.point1':
    'Ogni visualizzatore lancia i suoi: neve da una scena invernale, braci da un falò, petali da un giardino.',
  'tour.sparks.point2':
    'Il palco dello Studio le mostra sempre, così chi crea una scena può dare forma a ciò che lancia.',
  'tour.sparks.point3':
    'Un solo interruttore per tutti i visualizzatori: {sparks}, in {windowColours} sotto {rainbow}.',
  'tour.sparks.how':
    'Con un visualizzatore Plus sul grafico, passa il mouse sopra e fai clic. {sparks} è in {windowColours}, sotto {rainbow}.',
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
    'L’Analizzatore del grafico: lo spettro dal vivo a 80 dB di profondità, le barre a terzi d’ottava dietro e i picchi sopra, la curva dell’EQ in cima e le dodici viste elencate in Analisi.',

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
  'tour.studio.subtitle': 'Gratis per 15 giorni, o guadagna un mese',
  'tour.studio.lead':
    'Lo Studio trasforma un’idea in una scena che si muove con la tua musica. Ora fa parte di Plus, e un account nuovo può provarlo gratis per quindici giorni, senza carta e senza alcun addebito alla fine della prova.',
  'tour.studio.point1':
    'Ogni scena viene esaminata prima di arrivare nella galleria, e una scena approvata ti regala il mese di Plus successivo.',
  'tour.studio.point2':
    'Le scene possono essere veri mondi 3D che pestano sulla cassa e scattano sul drop.',
  'tour.studio.point3':
    'Copia il prompt per l’IA e il tuo assistente IA potrà vedere la tua scena e sentire come si muove il brano.',
  'tour.studio.how':
    'Apri Plus e scegli Studio nella sua barra laterale. Senza Plus, quella pagina ti offre la prova gratuita.',
  'tour.studio.open': 'Apri Plus',
  'tour.studio.imageAlt':
    'Un’aurora sopra le montagne creata nello Studio, l’idea da cui è nata, la prova di quindici giorni e il mese che si guadagna con una scena approvata.',
  'tour.studio.idea':
    'Aurora boreale sopra un lago di montagna. I bassi gonfiano l’aurora e le stelle tremolano a ritmo.',
  'tour.studio.earned': 'Approvata: prossimo mese gratis',
  'tour.help.kicker': 'AIUTO',
  'tour.help.title': 'Chiedi alla guida con parole tue',
  'tour.help.subtitle': 'Refusi, plurali e dieci lingue',
  'tour.help.lead':
    'Cerca nella guida come chiederesti a un amico — «nessun suono», «limitatore», «sfondo» — in una qualsiasi delle dieci lingue. Il capitolo più pertinente arriva per primo, e la guida ti porta al controllo, cerchiato nell’immagine.',
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

  'tour.plus.kicker': 'FLUIDEQ PLUS',
  'tour.plus.title': 'Benvenuto in FluidEQ Plus',
  'tour.plus.subtitle': 'Visualizzatori, Studio, illuminazione e altro',
  'tour.plus.lead':
    'Un abbonamento facoltativo che sostiene la crescita di FluidEQ, con una nuova scheda tutta sua: scene disegnate dalla tua scheda grafica, uno Studio per creare le tue, la classifica, gli sfondi del desktop e l’illuminazione dinamica. L’equalizzatore, il rack e i player restano gratuiti, come sono sempre stati.',
  'tour.plus.point1':
    'Accedi da Account nel menu delle azioni; il pagamento avviene nel browser e Plus si attiva da solo.',
  'tour.plus.point2':
    'Mensile o annuale, con condizioni in parole semplici prima di pagare. L’app non vede mai la tua carta.',
  'tour.plus.point3':
    'Accesso su un massimo di cinque computer, con nuovi visualizzatori aggiunti col tempo.',
  'tour.plus.how':
    'Apri la scheda Plus: Classifica, Visualizzatori, Studio e Illuminazione dinamica sono sul lato sinistro.',
  'tour.plus.open': 'Apri Plus',
  'tour.plus.imageAlt':
    'La scheda Plus: Classifica, Visualizzatori, Studio e Illuminazione dinamica sul lato, e la galleria Visualizzatori con Cromo, Fioritura, Aurora, Alpino e Città al neon.',
  'tour.scene.alpine': 'Alpino',
  'tour.scene.aurora': 'Aurora',
  'tour.scene.bloom': 'Fioritura',
  'tour.scene.chrome': 'Cromo',
  'tour.scene.neonCity': 'Città al neon',

  'tour.visualizers.kicker': 'VISUALIZZATORI',
  'tour.visualizers.title': 'Scene che si muovono con la tua musica',
  'tour.visualizers.subtitle': 'Disegnate dalla tua scheda grafica',
  'tour.visualizers.lead':
    'I visualizzatori Plus sono scene vive (montagne sotto le stelle, cortine d’aurora, una città al neon) disegnate dalla tua scheda grafica sotto le curve del tuo EQ. Bassi, battito e acuti muovono ognuno qualcosa di diverso, e la finestra intorno può prenderne i colori.',
  'tour.visualizers.point1':
    'Un solo selettore per tutto: {styles} stili gratuiti da modellare e colorare, e i visualizzatori Plus per categoria.',
  'tour.visualizers.point2':
    'Sfoglia la galleria, prova per dieci secondi gli esempi di FluidEQ e aggiungi le scene che ti piacciono.',
  'tour.visualizers.point3':
    'Cambia aspetto in automatico, passa a schermo intero e regola attacco e rilascio di una scena in Vista.',
  'tour.visualizers.how':
    'Fai clic sul nome dell’aspetto sul grafico e scegli una scena in Visualizzatori Plus, oppure sfogliale tutte in Plus → Visualizzatori.',
  'tour.visualizers.open': 'Apri l’EQ',
  'tour.visualizers.imageAlt':
    'Alpino, un visualizzatore Plus con montagne su un lago di notte, in riproduzione sul grafico sotto le curve dell’EQ, con altre quattro scene più in basso.',

  'tour.desktop.kicker': 'VISUALIZZATORE DEL DESKTOP',
  'tour.desktop.title': 'La tua musica dietro il desktop',
  'tour.desktop.subtitle': 'Una scena su ogni monitor',
  'tour.desktop.lead':
    'Metti un visualizzatore Plus dietro le icone del desktop. Si muove con ciò che stai ascoltando, o con calma per conto suo, e ogni monitor può mostrare una propria scena.',
  'tour.desktop.point1':
    'Scegli i monitor su una mappa della tua scrivania, ognuno con il suo visualizzatore.',
  'tour.desktop.point2':
    'Si mette in pausa mentre le finestre coprono il monitor, con il PC bloccato e quando va a batteria.',
  'tour.desktop.point3': 'Riparte da solo al prossimo avvio di FluidEQ.',
  'tour.desktop.how':
    'Con un visualizzatore Plus sul grafico, premi il pulsante del monitor accanto al suo nome oppure scegli Vista → Imposta come sfondo del desktop.',
  'tour.desktop.open': 'Apri l’EQ',
  'tour.desktop.imageAlt':
    'Tre monitor, ognuno con un visualizzatore Plus (Aurora, Alpino e Città al neon) dietro le icone del desktop e la barra delle applicazioni.',

  'tour.lighting.kicker': 'ILLUMINAZIONE DINAMICA',
  'tour.lighting.title': 'La tua scrivania si accende con la scena',
  'tour.lighting.subtitle':
    'Beta · i tuoi dispositivi RGB seguono il visualizzatore',
  'tour.lighting.lead':
    'Tastiera, mouse, tappetino, cuffie e supporto prendono i colori e il ritmo del visualizzatore Plus sul grafico, tramite Windows Dynamic Lighting e Razer Chroma.',
  'tour.lighting.point1':
    'Quattro stili per ogni visualizzatore: Scena, Onda di colore, Spettro e Onda ritmica.',
  'tour.lighting.point2':
    'Regola ogni dispositivo singolarmente e scegli cosa succede quando la musica si ferma.',
  'tour.lighting.point3':
    'Un’anteprima dal vivo disegna proprio la tua scrivania mentre si illumina. È in beta: facci sapere come si comportano i tuoi dispositivi.',
  'tour.lighting.how':
    'Apri Plus → Illuminazione dinamica e attivala, poi metti un visualizzatore Plus sul grafico.',
  'tour.lighting.open': 'Apri Plus',
  'tour.lighting.imageAlt':
    'Una tastiera, un mouse e un tappetino illuminati con il rosa, il viola e il ciano di Città al neon.',

  'tour.share.kicker': 'ASCOLTA OGNI PC',
  'tour.share.title': 'Condividi l’audio tra i tuoi computer',
  'tour.share.subtitle': 'Un paio di cuffie, tutte le macchine sulla scrivania',
  'tour.share.lead':
    'Il PC da gioco, il portatile del lavoro e il media center suonano tutti nelle cuffie che indossi: sulla tua rete, senza perdite, cifrato e attraverso l’EQ che hai già regolato.',
  'tour.share.receiverLabel': 'RICEVITORE',
  'tour.share.receiverName': 'Il PC con le tue cuffie',
  'tour.share.senderLabel': 'MITTENTI',
  'tour.share.senderName': 'Tutti gli altri computer',
  'tour.share.wireLabel': 'Senza perdite · Cifrato · LAN privata',
  'tour.share.stepsTitle': 'Configuralo in tre passaggi',
  'tour.share.step1Title': 'Sul PC delle cuffie, crea un codice',
  'tour.share.step1':
    'Apri la scheda Condividi audio, scegli «Riproduci l’audio su questo computer» e premi «Crea codice di connessione». Copia il codice della tua rete.',
  'tour.share.step2Title': 'Su ogni altro PC, incollalo',
  'tour.share.step2':
    'Apri FluidEQ lì, vai in Condividi audio, scegli «Invia l’audio di questo computer», incolla il codice e premi «Connetti e invia». L’audio di sistema inizia a scorrere, intatto: gli effetti vengono applicati sul computer su cui ascolti.',
  'tour.share.step3Title': 'Ascolta e regola il livello',
  'tour.share.step3':
    'Ogni mittente suona con un buffer breve che si risincronizza da solo dopo un intoppo. Ogni mittente viene mixato nell’uscita del ricevitore e modellato dal suo EQ. La barra di riproduzione del ricevitore mostra il brano del mittente più recente, e i suoi pulsanti funzionano attraverso la rete.',
  'tour.share.fact1Title': 'Senza perdite',
  'tour.share.fact1':
    'PCM Float32 da un capo all’altro. Nessun codec, nessuna perdita di generazione.',
  'tour.share.fact2Title': 'Cifrato',
  'tour.share.fact2':
    'AES-256-GCM su ogni pacchetto. Il codice è la chiave; senza, nessuno può ascoltare.',
  'tour.share.fact3Title': 'Resta abbinato',
  'tour.share.fact3':
    'L’abbinamento sopravvive a chiusure e riavvii. Solo creare un nuovo codice lo scollega.',
  'tour.share.tip':
    'Parti piano: più computer si sommano in fretta. Abbassa il volume delle cuffie prima della prima connessione.',
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
    'Scegli uno dei profili salvati dal selettore del profilo EQ sotto il dispositivo. L’uscita principale mantiene la sua regolazione.',
  'tour.output.point3':
    'Un solo lettore: avviare qualcosa in FluidEQ mette in pausa il resto della macchina, e viceversa.',
  'tour.output.point4':
    'Gioco/Video parte con circa 30 ms di riserva e si risincronizza dopo un’interruzione; Musica parte con circa 100 ms per un ascolto più fluido. Il buffer del dispositivo aggiunge ritardo.',
  'tour.output.how':
    'Apri la scheda EQ e poi Seconda uscita a destra. Attiva un dispositivo, scegli il profilo EQ sotto il suo nome, regola il volume e scegli Gioco/Video o Musica.',
  'tour.output.open': 'Apri l’EQ',
  'tour.output.imageAlt':
    'Il pannello Seconda uscita con BlackShark V2 Pro attivo, il selettore del profilo EQ, il volume e i modi Gioco/Video e Musica.',

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
};

export default tour;
