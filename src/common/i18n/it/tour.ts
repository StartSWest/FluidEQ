/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
  'tour.contribute': 'Contribuisci, per favore',
  'tour.rainbow.title': 'Benvenuto nella modalità arcobaleno',
  'tour.rainbow.subtitle': 'Attivala con un clic',
  'tour.rainbow.lead':
    'Colori arcobaleno, accenti luminosi e un bordo che percorre lo spettro — e un movimento più fluido: il grafico, i misuratori e l’onda vengono disegnati alla piena frequenza del tuo schermo invece che a trenta fotogrammi al secondo. Il tuo suono non cambia mai.',
  'tour.rainbow.how':
    'Attivala subito qui, senza raggiungere ×10. La scelta viene salvata e puoi disattivarla quando vuoi. Contribuire è facoltativo.',
  'tour.rainbow.enable': 'Attiva la modalità arcobaleno',
  'tour.rainbow.disable': 'Disattiva la modalità arcobaleno',
  'tour.rainbow.waveform': 'Anteprima dell’onda in alto',
  'tour.rainbow.toggleHint':
    'Fai clic sul pulsante «RAINBOW MODE» qui sopra per attivare o disattivare la modalità.',
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
    'Un interruttore nella barra del titolo trasforma la finestra nel Lettore compatto: il brano, il tuo equalizzatore, un visualizzatore e In coda in un’unica colonna stretta. Lo stesso interruttore ti riporta alla pagina che avevi lasciato.',
  'tour.player.point1':
    'Tutto l’equalizzatore viene con te: preset, disposizioni delle bande, Modalità EQ, EQ intelligente, Bassi, Medi e Alti.',
  'tour.player.point2':
    'Riducilo a una riga, tienilo sopra le altre finestre o fai doppio clic sul visualizzatore per riempire lo schermo.',
  'tour.player.point3':
    'Un tema Chiaro o Scuro tutto suo, e i brani trascinati su In coda entrano nella Libreria e nella coda.',
  'tour.player.how':
    'Premi l’interruttore Lettore compatto nella barra del titolo, accanto ad Aiuto. Sul lettore, lo stesso interruttore riporta l’app completa.',
  'tour.player.open': 'Prova il Lettore compatto',
  'tour.player.imageAlt':
    'Il Lettore compatto due volte, nel tema Scuro e in quello Chiaro: il brano e il suo orologio in alto, l’equalizzatore a quindici bande, In coda sotto; e lo stesso lettore ridotto a una riga.',
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
    'La pagina Preset di gioco con quattro giochi, ognuno con il suo suono, e le schede che FluidEQ mostra sul desktop quando un gioco passa in primo piano e quando si chiude.',
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
    'Nessuno spegne tutti gli stadi con una sola scelta; le catene che segni con la stella vengono subito dopo.',
  'tour.presets.how':
    'Apri EQ e premi Preset, oppure scegli una catena in cima alla scheda DSP.',
  'tour.presets.open': 'Apri l’EQ',
  'tour.presets.imageAlt':
    'Il selettore dei preset con Rock scelto, gli stadi che la sua catena accende e tre catene misurate allo stesso volume.',
  'tour.presets.chain': 'Una catena completa, non solo una curva',
  'tour.presets.level': 'Tutte allo stesso volume',
  'tour.presets.levelNote':
    'Passare da un preset all’altro cambia il carattere, non il volume.',
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
    'Pubblica una scena e, una volta approvata, il tuo prossimo mese di Plus è gratis.',
  'tour.studio.point2':
    'Ogni scena dei membri viene esaminata prima di arrivare nella galleria.',
  'tour.studio.point3':
    'Tutto ciò che hai creato prima resta, nella cartella indicata dallo Studio.',
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
    'Ogni controllo in un’immagine è numerato come in un manuale stampato, e le immagini seguono il tuo tema.',
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
    'Un solo selettore per tutto: 28 stili gratuiti da modellare e colorare, e i visualizzatori Plus per categoria.',
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

  'tour.theme.kicker': 'UN NUOVO ASPETTO',
  'tour.theme.title': 'Ecco il tema Scuro',
  'tour.theme.subtitle': 'Quasi nero, per le notti tarde e gli schermi OLED',
  'tour.theme.lead':
    'FluidEQ ha ora un secondo volto. Scuro cancella ogni traccia del blu ardesia con cui l’app è nata: pannelli, menu e barre diventano monocromi, l’accento resta e lo spettro è l’unico colore nella stanza.',
  'tour.theme.point1':
    'Sfondi quasi neri: su uno schermo OLED lo spazio intorno al grafico si fa quasi buio.',
  'tour.theme.point2':
    'Ogni pagina segue: menu, finestre di dialogo, il palco del karaoke e la Libreria cambiano insieme. Il Lettore compatto mantiene un tema tutto suo.',
  'tour.theme.point3':
    'Il colore d’accento e la modalità arcobaleno restano. Il suono non cambia affatto: è solo la vernice.',
  'tour.theme.howTitle': 'Come cambiarlo',
  'tour.theme.how':
    'Apri il menu dietro l’icona a impulso in alto a destra e scegli Scuro accanto a Tema, nelle impostazioni in fondo al menu. Chiaro è a un clic se vuoi tornare indietro.',
  'tour.theme.tryBlack': 'Passa a Scuro adesso',
  'tour.theme.tryOcean': 'Torna a Chiaro',
  'tour.theme.imageAlt':
    'FluidEQ con il tema Scuro: la scheda EQ con quindici bande e lo spettro dal vivo mentre suona un brano.',

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
  'tour.looks.subtitle': 'Ventotto forme, i tuoi colori, il tuo movimento',
  'tour.looks.lead':
    'Lo spettro sotto l’EQ si può disegnare come vuoi. Scegli una delle ventotto forme, dalle semplici barre e linee a terrazze, profili urbani e un ponte notturno con il traffico; coloralo con la sua colorazione Auto, per frequenza, per livello o per calore; decidi quanto in fretta attacca e quanto resta un picco; segna i picchi con scintille, comete o increspature. Salvalo come aspetto tuo e condividilo come file.',
  'tour.looks.point1':
    'Ventotto forme, ognuna con i suoi controlli: elementi, spaziatura, riempimento, spessore, e se è riempita o a contorno.',
  'tour.looks.point2':
    'Colora ogni forma con la sua colorazione Auto, per frequenza, livello o calore con una sfumatura dei tuoi colori, oppure con un solo colore uniforme.',
  'tour.looks.point3':
    'Attacco e rilascio decidono il movimento; picchi luminosi, picchi riempiti e dodici segni di picco decidono come appare un colpo.',
  'tour.looks.point4':
    'Il bagliore funziona in ogni modalità, e la modalità arcobaleno aggiunge un bordo che percorre tutta la ruota dei colori. Gli aspetti si esportano in un file e si importano da un file.',
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
