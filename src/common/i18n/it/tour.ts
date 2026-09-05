/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const tour: Partial<Dictionary> = {
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
  'tour.rail.new': 'NUOVO IN QUESTA VERSIONE',
  'tour.rail.always': 'ANCHE IN FLUIDEQ',
  'tour.newBadge': 'NUOVO',
  'tour.howTitle': 'Come iniziare',

  'tour.theme.kicker': 'UN NUOVO ASPETTO',
  'tour.theme.title': 'Ecco il tema Nero',
  'tour.theme.subtitle': 'Nero puro, per le notti tarde e gli schermi OLED',
  'tour.theme.lead':
    'FluidEQ ha ora un secondo volto. Nero cancella ogni traccia del blu ardesia con cui l’app è nata: pannelli, menu e barre diventano monocromi, l’accento resta e lo spettro è l’unico colore nella stanza.',
  'tour.theme.point1':
    'Sfondi nero assoluto: su uno schermo OLED i pixel intorno al grafico si spengono.',
  'tour.theme.point2':
    'Ogni finestra segue: menu, finestre di dialogo, il palco del karaoke e la Libreria cambiano insieme.',
  'tour.theme.point3':
    'Il colore d’accento e la modalità arcobaleno restano. Il suono non cambia affatto: è solo la vernice.',
  'tour.theme.howTitle': 'Come cambiarlo',
  'tour.theme.how':
    'Apri il menu dietro l’icona a impulso in alto a destra, poi scegli Tema → Nero. Oceano è a un clic se vuoi tornare indietro.',
  'tour.theme.tryBlack': 'Passa a Nero adesso',
  'tour.theme.tryOcean': 'Torna a Oceano',
  'tour.theme.imageAlt':
    'FluidEQ con il tema Nero: la scheda EQ con quindici bande e lo spettro dal vivo mentre suona un brano.',

  'tour.share.kicker': 'ASCOLTA OGNI PC',
  'tour.share.title': 'Condividi l’audio tra i tuoi computer',
  'tour.share.subtitle': 'Un paio di cuffie, tutte le macchine sulla scrivania',
  'tour.share.lead':
    'Il PC da gioco, il portatile del lavoro e il media center suonano tutti nelle cuffie che indossi: sulla tua rete, senza perdite, cifrato e attraverso l’EQ che hai già regolato.',
  'tour.share.receiverLabel': 'RICEVITORE',
  'tour.share.receiverName': 'Il PC con le tue cuffie',
  'tour.share.senderLabel': 'TRASMETTITORI',
  'tour.share.senderName': 'Tutti gli altri computer',
  'tour.share.wireLabel': 'Senza perdite · Cifrato · LAN privata',
  'tour.share.stepsTitle': 'Configuralo in tre passaggi',
  'tour.share.step1Title': 'Sul PC delle cuffie, crea un codice',
  'tour.share.step1':
    'Apri la scheda Condividi audio, scegli «Riproduci l’audio su questo computer» e premi «Crea codice di connessione». Copia il codice della tua rete.',
  'tour.share.step2Title': 'Su ogni altro PC, incollalo',
  'tour.share.step2':
    'Apri FluidEQ lì, vai in Condividi audio, scegli «Invia l’audio di questo computer», incolla il codice e premi «Connetti e invia». L’audio di sistema inizia a scorrere.',
  'tour.share.step3Title': 'Scegli una priorità e ascolta',
  'tour.share.step3':
    'Musica mantiene un buffer più ampio per un ascolto senza interruzioni; Gioco/Video gira con il ritardo minimo per il labiale. Ogni trasmettitore viene mixato nell’uscita del ricevitore e modellato dal suo EQ. La barra di riproduzione del ricevitore mostra il brano di ogni trasmettitore e i suoi pulsanti funzionano attraverso la rete.',
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
    'Una coda «In coda» con «Continua a riprodurre», che prosegue con altro dello stesso genere quando la lista finisce.',
  'tour.library.point3':
    'Playlist e una lista Preferiti permanente. Clic destro su un brano per aggiungerlo a una delle due, o alla coda.',
  'tour.library.point4':
    'Memoria EQ per brano: attiva «Salva per questo brano» mentre suona e la correzione che fai resta memorizzata per quella traccia.',
  'tour.library.how':
    'Apri la scheda Libreria, premi «Aggiungi cartella» o trascina una cartella sulla pagina e aspetta «Brani aggiunti». Scegli Album, Artisti, Generi, Brani, Cartelle o Albero, poi premi Riproduci.',
  'tour.library.open': 'Apri la Libreria',

  'tour.dsp.kicker': 'UN RACK DA MASTERING',
  'tour.dsp.title': 'Il rack DSP',
  'tour.dsp.subtitle': 'Nove stadi, ognuno con il suo grafico',
  'tour.dsp.lead':
    'Tutto ciò che la Libreria riproduce può attraversare un rack di stadi da studio, in ordine: Normalizzatore, Denoise, Exciter, Bass Forge, Equalizzatore, Bass Punch, Dimension, Maximizer e Master, più un crossfade tra i brani. Ogni stadio è una scheda con grafico dal vivo, preset e un pulsante Isola per sentire solo ciò che fa.',
  'tour.dsp.point1':
    'Denoise ripara la registrazione stessa: fruscio, ronzio, click e un pulitore vocale neurale, misurati da un’analisi del brano.',
  'tour.dsp.point2':
    'Bass Forge aggiunge un’ottava reale sotto il basso; Bass Punch ne modella attacco, sustain, bloom e duck.',
  'tour.dsp.point3':
    'Un Equalizzatore parametrico a quindici bande con fase minima o lineare, mid/side, sovracampionamento e decine di preset con nome.',
  'tour.dsp.point4':
    'Master con obiettivo di loudness LUFS e protezione true-peak, preset di consegna da Streaming a Vinile, e un Gain match per confrontare il suono, non il volume.',
  'tour.dsp.how':
    'Riproduci un brano dalla Libreria, apri la scheda DSP, scegli una catena sotto Preset, poi clicca uno stadio nelle schede laterali e accendilo.',
  'tour.dsp.open': 'Apri il DSP',

  'tour.output.kicker': 'SUONA IN DUE POSTI',
  'tour.output.title': 'Una seconda uscita',
  'tour.output.subtitle': 'Cuffie e casse insieme, ognuna con il suo profilo',
  'tour.output.lead':
    'Quello che senti può uscire anche da un secondo dispositivo: le cuffie e le casse della stanza, la scrivania e la cucina. La duplicazione prende il suono dopo che il tuo EQ lo ha modellato e lo rimanda avanti, così la seconda uscita sente la stessa regolazione. Con un driver di instradamento installato, le due uscite restano sincronizzate e ognuna può avere il proprio profilo, come farebbe un mixer tipo Voicemeeter.',
  'tour.output.point1':
    'Scegli qualsiasi altra uscita sotto «Duplica su» e inizia a riprodurre quello che già senti, con il suo volume.',
  'tour.output.point2':
    'Ogni uscita conserva il proprio profilo EQ, così casse e cuffie si regolano separatamente.',
  'tour.output.point3':
    'Un lettore alla volta: avviare qualcosa in FluidEQ mette in pausa il resto della macchina, e viceversa.',
  'tour.output.point4':
    'Il suono duplicato arriva con circa un quinto di secondo di ritardo: bene per la musica in un’altra stanza, non per video o giochi.',
  'tour.output.how':
    'Nella scheda EQ, apri «Seconda uscita» nel pannello di destra, scegli un dispositivo sotto «Duplica su» e regola il volume. La scheda mostra DUPLICAZIONE mentre funziona.',
  'tour.output.open': 'Apri l’EQ',

  'tour.looks.kicker': 'IL TUO VISUALIZZATORE',
  'tour.looks.title': 'Aspetti personalizzati per il grafico',
  'tour.looks.subtitle':
    'Cinquantasette forme, i tuoi colori, il tuo movimento',
  'tour.looks.lead':
    'Lo spettro sotto l’EQ si può disegnare come vuoi. Scegli una delle cinquantasette forme, dalle semplici barre e linee a creste, seta, skyline e matrice di punti; coloralo piatto, per frequenza, per livello o per calore; decidi quanto in fretta attacca e quanto resta un picco; segna i picchi con scintille, comete, aloni o corone. Salvalo come aspetto tuo e condividilo come file.',
  'tour.looks.point1':
    'Cinquantasette forme, ognuna con i suoi controlli: pezzi, spazio, riempimento, spessore, e se piena o tratteggiata.',
  'tour.looks.point2':
    'Colore per frequenza, livello o calore con una rampa dei tuoi colori, oppure un solo colore piatto.',
  'tour.looks.point3':
    'Attacco e rilascio decidono il movimento; picchi accesi e diciotto segni di picco decidono come appare un colpo.',
  'tour.looks.point4':
    'La modalità arcobaleno aggiunge un bagliore sul battito e un bordo che percorre tutta la ruota dei colori. Gli aspetti si esportano in un file e si importano da un file.',
  'tour.looks.how':
    'Nella scheda EQ premi «Nuovo aspetto» nella barra del grafico. Scegli una forma con il selettore o premi Spazio per scorrerle, regola colori e movimento mentre la musica suona, poi Salva.',
  'tour.looks.open': 'Apri l’EQ',

  'tour.karaoke.kicker': 'UN PALCO A CASA',
  'tour.karaoke.title': 'Karaoke con guida all’intonazione',
  'tour.karaoke.subtitle': 'Le tue canzoni, i tuoi testi, il tuo microfono',
  'tour.karaoke.lead':
    'Trascina una canzone con o senza file di testo e FluidEQ li abbina in una playlist, mostra il testo sincronizzato sopra la copertina o il video, ascolta il microfono e disegna la tua intonazione contro la melodia. Tutto resta su questo computer; il microfono non viene mai registrato né riprodotto.',
  'tour.karaoke.point1':
    'Un cursore Voce guida che va dall’originale alla sola base, togliendo la voce principale senza un file a parte.',
  'tour.karaoke.point2':
    'Una corsia dell’intonazione in vista Note o Curva: le note della canzone come blocchi, la tua voce come linea dal vivo, con feedback Alto, Intonato e Basso.',
  'tour.karaoke.point3':
    'Un riepilogo della performance alla fine, con le parti da esercitare e un conto alla rovescia per riprovare.',
  'tour.karaoke.point4':
    'Legge LRC, LRC esteso con tempi per parola e UltraStar con sillabe e intonazione, su MP3, FLAC, WAV, OGG, M4A e altro. In più testi tradotti e accordi di chitarra stimati.',
  'tour.karaoke.how':
    'Apri la scheda Karaoke, premi «Apri brano» o «Aggiungi cartella», scegli una traccia nella playlist, accendi il microfono, mostra la guida all’intonazione e premi Riproduci.',
  'tour.karaoke.open': 'Apri il Karaoke',

  'tour.maker.kicker': 'FALLO TU',
  'tour.maker.title': 'Il Creatore di karaoke',
  'tour.maker.subtitle': 'Qualsiasi canzone diventa un file karaoke',
  'tour.maker.lead':
    'Uno studio di authoring completo dentro la scheda Karaoke. Può fare tutto da solo: separare la voce dalla musica, leggere le parole e i loro tempi con un modello vocale locale e rilevare le note della melodia. Oppure batti, registri e disegni ogni tempo a mano su una timeline zoomabile. Tutto gira su questo computer.',
  'tour.maker.point1':
    '«Imposta questa canzone automaticamente»: separa la voce, poi legge parole e tempi, con l’opzione di continuare in background.',
  'tour.maker.point2':
    'Conserva le tracce separate: la voce e la base, ognuna salvabile, anche in MP3.',
  'tour.maker.point3':
    'Strumenti manuali per i dettagli: battere le parole, registrare gli attacchi di riga, un ispettore di parola con inizio e durata, e dividere una parola in sillabe.',
  'tour.maker.point4':
    'Dipingi la melodia su una griglia di intonazione, segna le note dorate ed esporta come progetto FluidEQ, UltraStar TXT, LRC, LRC esteso o base senza voce.',
  'tour.maker.how':
    'In Karaoke carica una canzone e premi «Crea». Accetta «Imposta automaticamente» nella procedura guidata, correggi le parole sulla timeline, poi «Usa nel lettore» ed «Esporta».',
  'tour.maker.open': 'Apri il Karaoke',

  'tour.media.kicker': 'IL WEB, ATTRAVERSO IL TUO EQ',
  'tour.media.title': 'Media online',
  'tour.media.subtitle': 'YouTube, YouTube Music, Bandcamp, Twitch e Suno',
  'tour.media.lead':
    'Un lettore integrato per i siti di streaming, così ciò che guardi e ascolti online passa dal tuo EQ invece che da un browser a parte. Cinque siti sono già collegati, ognuno con la sua ricerca, e i link che portano fuori vengono fermati con la scelta «Apri nel browser».',
  'tour.media.point1':
    'Un solo campo di ricerca che cerca nel sito aperto, con ricerche recenti che puoi cancellare.',
  'tour.media.point2':
    '«Blocca pubblicità» salta gli annunci video e nasconde gli spazi pubblicitari su YouTube.',
  'tour.media.point3':
    'Riprendi: il lettore ricorda l’ultima pagina e il punto in cui eri, e ti riporta lì.',
  'tour.media.point4':
    'Download con indicatore di avanzamento e «Mostra nella cartella» a fine lavoro, e un pulsante «Esci da tutti i siti» che cancella ogni cookie e accesso in un colpo.',
  'tour.media.how':
    'Apri la scheda Media online, scegli un sito dalla riga in alto, scrivi nel campo di ricerca e premi Cerca. Indietro, Avanti e Ricarica funzionano come in un browser.',
  'tour.media.open': 'Apri Media online',
};

export default tour;
