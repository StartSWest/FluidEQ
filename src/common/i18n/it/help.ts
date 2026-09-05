/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/help';

const help: Record<keyof typeof en, string> = {
  'help.share.title': 'Condividi audio tra computer',
  'help.share.intro':
    'Condividi audio invia il suono di sistema tra computer della stessa rete privata. Il ricevitore ha cuffie o altoparlanti; gli altri inviano. È diverso dalla seconda uscita sullo stesso computer.',
  'help.share.steps':
    'Sul computer d’ascolto apri Condividi audio, scegli riproduzione su questo computer e crea un codice. Inizia a volume basso.\nSu ogni sorgente scegli invio da questo computer, incolla il codice del ricevitore e connetti. Mantieni FluidEQ aperto su entrambi.\nControlla il monitor e interrompi invio o ascolto al termine. In caso di errore verifica rete privata comune e autorizzazione firewall.',
  'help.share.tip':
    'Il codice autorizza l’abbinamento: tienilo privato. Più mittenti vengono miscelati e possono aumentare il livello. L’audio ricevuto bypassa il rack DSP della Libreria.',
  'help.menu': 'Aiuto',
  'help.title': 'Guida utente',
  'help.subtitle': 'Trova il tuo suono. Sentiti a casa.',
  'help.intro':
    'Una guida pratica a FluidEQ con schermate reali. Inizia dal primo ascolto ed esplora ogni area con calma.',
  'help.offline': 'Disponibile offline',
  'help.search': 'Cerca nella guida',
  'help.searchHint': 'Prova profili, bassi, testi…',
  'help.contents': 'In questa guida',
  'help.results': '{count} capitoli',
  'help.empty':
    'Nessun capitolo trovato. Prova una frase più breve o cancella la ricerca.',
  'help.clear': 'Cancella ricerca',
  'help.close': 'Chiudi guida',
  'help.enlarge': 'Ingrandisci schermata: {title}',
  'help.closeImage': 'Chiudi schermata',
  'help.captureNote':
    'Schermate reali di FluidEQ 1.6.x. Colori, nomi e posizioni possono variare nella tua versione. Le impostazioni sono esempi, non preset consigliati.',
  'help.steps': 'Prova',
  'help.tip': 'Da sapere',
  'help.back': 'Torna in alto',
  'help.start.title': 'I tuoi primi cinque minuti',
  'help.start.intro':
    'Inizia con un brano familiare e volume comodo. A sinistra trovi EQ di sistema e margine; al centro, lo spazio di lavoro; a destra, uscita e profili. Il trasporto è in basso.',
  'help.start.steps':
    'Su Windows, installa Equalizer APO quando proposto, seleziona il dispositivo nel suo selettore e riavvia quando richiesto.\nScegli lo stesso Dispositivo di uscita. Attiva EQ di sistema e lascia attiva la normalizzazione automatica.\nRiproduci un brano, apri EQ → Bande, modifica leggermente e confronta attivando e disattivando EQ di sistema.',
  'help.start.tip':
    'EQ di sistema richiede Windows ed Equalizer APO. macOS e Linux usano uscite dimostrative: un grafico in movimento non prova il trattamento dell’audio di sistema.',
  'help.eq.title': 'Modella il suono con EQ',
  'help.eq.intro':
    'Frequenza sceglie dove agisce la banda; Guadagno, il rinforzo o taglio; Q, la larghezza: Q più alto significa banda più stretta. Bassi danno corpo, medi sostengono la voce e alti aggiungono brillantezza.',
  'help.eq.steps':
    'Seleziona una banda in EQ → Bande. Regola frequenza, guadagno e Q oppure trascina il punto sul grafico.\nInizia con una banda larga e delicata. Confronta prima di aggiungerne altre; il selettore del filtro cambia la forma.\nConfronta cuffie, EQ, voicing e Smart EQ con interruttori e intensità. Mantieni la normalizzazione automatica durante i rinforzi.',
  'help.eq.tip':
    'La curva descrive i filtri; lo spettro mobile, il segnale misurato. Smart EQ richiede audio. Detail, Balance e Target correggono aspetti diversi: prova una modalità alla volta.',
  'help.headphones.title': 'Correzione cuffie e importazione',
  'help.headphones.intro':
    'La correzione compensa un modello misurato e si combina con le tue bande. Verifica il modello esatto e l’autore della misura.',
  'help.headphones.steps':
    'Apri EQ → Preset EQ, cerca le cuffie e scegli la misura corrispondente.\nPer testo di altre applicazioni, usa Importa impostazioni EQ nelle Azioni audio. Controlla bande e curva.\nDa Squiglink esporta il testo EQ, incollalo nel pannello e premi Applica EQ importata dopo la verifica.',
  'help.headphones.tip':
    'Un’anteprima non applicata non cambia il suono. Evita di sommare per errore due correzioni complete per le stesse cuffie.',
  'help.convolution.title': 'Usa una risposta all’impulso',
  'help.convolution.intro':
    'Convoluzione applica un impulso WAV come livello separato. Cerca nel catalogo AutoEq o importa un WAV; le bande parametriche restano indipendenti.',
  'help.convolution.steps':
    'Apri EQ → Convoluzione e cerca modello o autore.\nControlla fonte e frequenza di campionamento, poi Scarica e applica o Importa WAV.\nConfronta il livello acceso e spento e regolane l’intensità.',
  'help.convolution.tip':
    'La frequenza dell’impulso deve corrispondere all’uscita per Equalizer APO. Il catalogo richiede internet per scaricare; questa guida no.',
  'help.profiles.title': 'Dispositivi, profili e seconda uscita',
  'help.profiles.intro':
    'L’EQ segue l’uscita. La mappatura automatica salva le modifiche sul dispositivo corrente; i profili conservano alternative. Seconda uscita duplica l’audio con un livello per dispositivo.',
  'help.profiles.steps':
    'Verifica l’uscita prima di modificare. Nuovo profilo conserva un suono; Aggiorna salva le modifiche e Ripristina recupera le impostazioni salvate.\nApri Seconda uscita, attiva un dispositivo raggiungibile e imposta il livello. Nelle versioni attuali scegli il suo profilo EQ sotto di esso.\nUsa Gioco/Video per una riserva iniziale minore o Musica per più margine. Controlla la sincronizzazione.',
  'help.profiles.tip':
    'Ogni uscita duplicata Windows usa il proprio profilo APO. La duplicazione richiede FluidEQ aperto e si ferma cambiando uscita principale. Conta anche la latenza dei dispositivi.',
  'help.config.title': 'Controlla e salva una catena',
  'help.config.intro':
    'EQ → Config mostra ciò che Equalizer APO ha realmente su disco. Schede uscita e albero delle inclusioni mostrano dispositivi e livelli. Esporta prima di grandi esperimenti.',
  'help.config.steps':
    'Apri EQ → Config, scegli l’uscita e controlla stato e livelli.\nUsa Esporta catena per salvare un file .fluideq.\nPer ripristinarlo, scegli prima l’uscita giusta, usa Importa catena e controlla il risultato.',
  'help.config.tip':
    'I file generati vengono riscritti quando cambi impostazioni. Metti i comandi APO permanenti nel file personalizzato dell’uscita che FluidEQ preserva.',
  'help.online.title': 'Ascolta con Media online',
  'help.online.intro':
    'Media online affianca i siti compatibili all’EQ. Riproduzione e accesso dipendono dal fornitore e dalla connessione. Il trasporto inferiore segue il lettore attivo.',
  'help.online.steps':
    'Apri Media online, scegli un sito e avvia qualcosa sulla pagina.\nPassa a EQ per regolare durante l’ascolto e torna alla pagina per i suoi controlli.\nAttiva Un lettore alla volta per evitare sovrapposizioni con altri lettori.',
  'help.online.tip':
    'Il rack DSP tratta audio della Libreria, non Media online. Su Windows, EQ di sistema può comunque agire sull’uscita abilitata per APO.',
  'help.library.title': 'Crea la tua libreria locale',
  'help.library.intro':
    'Libreria raccoglie musica e video dai dischi, per album, artisti, brani, cartelle o video. Copertine e metadati provengono dai file.',
  'help.library.steps':
    'Apri Libreria e aggiungi la cartella multimediale. Attendi l’indicizzazione.\nScegli artista o album oppure cerca un brano e avvialo.\nUsa il trasporto inferiore per pausa, ricerca, salto e volume da ogni scheda.',
  'help.library.tip':
    'I file originali devono restare accessibili. Ricollega il disco o aggiungi la nuova posizione di una cartella spostata.',
  'help.queue.title': 'Album e coda di riproduzione',
  'help.queue.intro':
    'La coda determina l’ordine d’ascolto. Aprire un altro album permette di esplorare senza cambiare il brano attuale. Il brano attivo e In coda aiutano a orientarti.',
  'help.queue.steps':
    'Apri un album e avvia il brano desiderato.\nNel menu del brano scegli riproduzione successiva o aggiunta alla coda.\nControlla i prossimi brani e usa casuale o ripetizione quando vuoi.',
  'help.queue.tip':
    'Avviare Libreria prende il posto degli altri lettori FluidEQ. Il trasporto identifica brano e sorgente attuali.',
  'help.dsp.title': 'Esplora il rack DSP',
  'help.dsp.intro':
    'DSP tratta solo tracce audio della Libreria. Karaoke, video, audio condiviso ricevuto e altre app lo bypassano. Include Normalizer, Denoise, Exciter, Bass Forge, Equaliser, Bass Punch, Dimension, Maximizer e Master.',
  'help.dsp.steps':
    'Riproduci audio della Libreria, apri DSP e attiva il rack. Inizia da un preset o stadio.\nCambia un controllo e confronta disattivando lo stadio a volume simile.\nControlla i livelli e salva il rack. Esporta e Importa scambiano rack completi.',
  'help.dsp.tip':
    'Equaliser DSP ed EQ di sistema sono stadi separati e possono agire entrambi su Windows. Confronta a volumi simili per giudicare il timbro.',
  'help.denoise.title': 'Riduzione rumore e analisi',
  'help.denoise.intro':
    'Denoise riduce rumore nell’audio della Libreria. Il grafico aiuta a interpretare la risposta. Troppa riduzione può attenuare dettagli o creare un effetto di pompaggio.',
  'help.denoise.steps':
    'Riproduci una traccia rumorosa della Libreria e seleziona Denoise in DSP.\nAttiva una riduzione leggera e ascolta passaggi quieti e dettagli.\nAumenta gradualmente e confronta disattivando lo stadio.',
  'help.denoise.tip':
    'Non pulisce il microfono né Media online. Se non cambia nulla, verifica sorgente audio della Libreria, rack e stadio attivi.',
  'help.visuals.title': 'Personalizza il lettore',
  'help.visuals.intro':
    'Curva, spettro e misuratore mostrano aspetti diversi del suono. Forme, palette e picchi del visualizzatore cambiano l’aspetto senza modificare EQ.',
  'help.visuals.steps':
    'Attiva Grafico di risposta a sinistra e scegli le dimensioni da Vista.\nScegli una forma e apri Nuovo aspetto per colori, riempimento, bagliore, spaziatura e picchi. Salva con un nome.\nIn Azioni audio scegli tema o lingua. Ctrl + più, meno o 0 ingrandisce, riduce o azzera lo zoom.',
  'help.visuals.tip':
    'Uno spettro in movimento non prova che l’EQ raggiunga il dispositivo. Confronta l’ascolto e controlla lo stato dell’uscita.',
  'help.karaoke.title': 'Canta con Karaoke',
  'help.karaoke.intro':
    'Karaoke abbina audio e testi locali. I testi temporizzati seguono la riproduzione; gli obiettivi d’intonazione richiedono note. Un microfono configurato aggiunge la tua intonazione dal vivo.',
  'help.karaoke.steps':
    'Apri Karaoke e aggiungi file o cartella con audio e testi corrispondenti.\nScegli un brano, avvialo e controlla l’abbinamento.\nConfigura il microfono, regola la dimensione dei testi e usa lo schermo intero del palco.',
  'help.karaoke.tip':
    'Un file con soli testi non contiene note obiettivo. La loro assenza non dimostra un guasto del microfono.',
  'help.maker.title': 'Crea in Karaoke Maker',
  'help.maker.intro':
    'Maker trasforma audio in un progetto modificabile con testi e note sulla timeline. Controlla sempre parole e tempi generati automaticamente.',
  'help.maker.steps':
    'Apri Crea da Karaoke e carica l’audio. Scegli gli strumenti di separazione o trascrizione necessari.\nSegui il progresso; al primo uso IA potrebbe scaricare modelli. Rivedi testi e note.\nAscolta brevi passaggi, correggi tempi e testo, salva il progetto ed esporta i file.',
  'help.maker.tip':
    'Servono connessione e spazio per i modelli. I tempi dipendono da hardware e durata. Usa audio autorizzato e verifica prima di condividere.',
  'help.trouble.title': 'Quando il suono non va',
  'help.trouble.intro':
    'Inizia da sorgente e uscita, poi isola i livelli. Un grafico o interruttore non prova il percorso dell’audio. Aiuto offre riparazione audio e segnalazioni.',
  'help.trouble.steps':
    'Nessun suono: verifica riproduzione, uscita, volume e collegamento. Un lettore alla volta potrebbe aver messo in pausa un’altra sorgente.\nNessuna EQ: controlla EQ di sistema e dispositivo in Equalizer APO. Usa Risolvi problemi audio; i riavvii interrompono il suono.\nDistorsione o bassi eccessivi: mantieni la normalizzazione, riduci rinforzi e spegni un livello per volta. Se persiste, rivedi la segnalazione prima di inviarla.',
  'help.trouble.tip':
    'F1 apre la guida. Escape chiude prima la schermata ingrandita, poi la guida. Ctrl + 0 azzera lo zoom. Prova DSP con una traccia audio della Libreria.',
};

export default help;
