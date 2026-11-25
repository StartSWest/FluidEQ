/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/** Detailed guides for the current sound and playback tools. */
const helpDetails = {
  'help.dynamics.title': 'Dinamica: passaggi deboli e forti',
  'help.dynamics.intro':
    'Dinamica è un compressore a tre bande: solleva i passaggi deboli e contiene quelli forti senza aggiungere ritardo. Funziona con musica, film, voce e suono dei giochi.',
  'help.dynamics.steps':
    'Apri DSP → Dinamica, attiva lo stadio e scegli un preset. Quelli per i giochi sono in Gaming Lab.\nLe bande coprono bassi sotto 150 Hz, medi da 150 Hz a 4 kHz e alti oltre 4 kHz. Lavora sulla banda del suono interessato.\nIn Alzare, Sotto stabilisce quando alzare i suoni deboli, Rapporto quanto e Fino a il guadagno massimo. Il rapporto 1:1 non modifica il suono.\nIn Trattenere, Sopra stabilisce quando ridurre i suoni forti e Rapporto con quale intensità. Abbassare la soglia fa intervenire più spesso.\nRegola Attacco e Rilascio, Mix per unire il segnale originale e Compensazione per il livello finale. Confronta a volume simile.\nOgni banda ha la sua curva: livello in ingresso in orizzontale, in uscita in verticale. Trascina un punto vuoto per scegliere dove inizia un’alzata o una trattenuta e uno pieno per la sua forza, oppure scrivi un valore esatto nella tabella sotto. Mentre suona, un punto percorre ogni curva e mostra cosa fa la banda in quel momento. Un avviso di aggiornamento del motore può riguardare solo il grafico dal vivo, mentre il suono è già elaborato.',
  'help.dynamics.tip':
    'Un sollevamento forte mette in evidenza anche il rumore. Riduci il mix per conservare più movimento originale.',
  'help.dynamics.keywords':
    'dynamics, compressor, compression, upward compression, downward compression, lift, hold, attack, release, mix, makeup, quiet passages, loud passages',
  'help.deesser.title': 'De-esser: addolcire le voci aspre',
  'help.deesser.intro':
    'Riduce S, T e SH aggressive quando compaiono. Quattro gruppi definiscono cosa ascolta, cosa riduce, la velocità e la zona stereo trattata.',
  'help.deesser.steps':
    'Apri DSP → De-esser, attivalo e prova un preset su una voce sibilante.\nIn Trova, racchiudi il suono fastidioso tra le frequenze inferiore e superiore. Aumenta Sensibilità senza far reagire ogni nota brillante.\nIn Riduci, Spettrale segue solo le frequenze coinvolte; Acuti abbassa la banda alta. Voce intera abbassa tutto ed è pensato per una voce isolata. Regola riduzione massima e larghezza disponibile.\nIn Tempi, regola la cattura dell’inizio e il ritorno degli alti. In Dove, Centro concentra il lavoro sulla voce centrale e Risparmia i piatti protegge i colpi brillanti.\nAttiva Isola per sentire solo ciò che viene tolto, poi disattivalo per giudicare la registrazione intera. Il grafico segue il controllo che stai regolando.\nSalva l’impostazione nella barra dello stadio e anche l’intera catena per mantenere la combinazione: un’altra catena può sostituire più stadi.',
  'help.deesser.tip':
    'Se la voce perde naturalezza o la musica perde aria, riduci sensibilità o attenuazione massima. È elaborazione della riproduzione, non del microfono.',
  'help.deesser.keywords':
    'de-esser, deesser, de essing, sibilance, sharp voice, harsh voice, spectral, centre only, center only, cymbals, isolate',
  'help.normalizer.title': 'Normalizzatore e controllo del livello dal vivo',
  'help.normalizer.intro':
    'Il Normalizer cambia il livello della sorgente prima degli stadi creativi. I file della Libreria si possono misurare per intero; l’altro audio di sistema viene imparato mentre suona. Sta fuori dalle catene: sceglierne una non lo cambia mai.',
  'help.normalizer.steps':
    'Apri DSP → Normalizzatore e scegli Disattivato, True Peak o Loudness. Per l’audio esterno, la stessa scheda diventa Controllo livello live, con Protezione picchi e Livellamento live.\nIn True Peak, imposta il limite dei picchi. Questa modalità abbassa una sorgente se i picchi superano il limite; non amplifica le sorgenti più deboli.\nIn Loudness, imposta il livello obiettivo e il limite dei picchi. L’obiettivo riguarda i passaggi di tre secondi più forti; i clip più brevi usano il loudness integrato.\nNella Libreria, attendi la fine dell’analisi della sorgente. Leggi il loudness dei passaggi forti, quello integrato e il guadagno applicato. Il loudness integrato misura l’intera traccia.\nIn live, lascia suonare la sorgente durante l’apprendimento e osserva quando il guadagno viene mantenuto. Un passaggio più forte può ridurlo; i passaggi deboli conservano il livello relativo.\nPrima di alzare l’obiettivo, controlla il guadagno applicato e l’eventuale motivo del limite. Il margine dei picchi e il massimo incremento possono impedirne il raggiungimento. Confronta a un volume d’ascolto simile: lo stesso obiettivo per i passaggi forti non rende identico il loudness complessivo di ogni brano.',
  'help.normalizer.tip':
    'È diverso dalla normalizzazione automatica a sinistra, che crea margine per l’EQ, e da Master, che regola l’uscita finale. Nessuno ripara distorsioni già presenti.',
  'help.normalizer.keywords':
    'normalizer, normalisation, normalization, lufs, loudness target, true peak, peak ceiling, applied gain, leveling, live level control, learning source, holding gain',
  'help.crossfade.title':
    'Dissolvenza incrociata e curve di transizione personali',
  'help.crossfade.intro':
    'Sovrappone brani consecutivi della Libreria. È un’opzione di riproduzione separata dai filtri e non sfuma altre app o Karaoke.',
  'help.crossfade.steps':
    'Metti almeno due brani nella coda della Libreria. In DSP scegli Dissolvenza incrociata tra le opzioni di riproduzione e attivalo.\nImposta la durata e scegli potenza costante, morbida o lineare. Lascia arrivare il primo brano alla fine per ascoltare la transizione.\nScegli Personalizzata e trascina i punti delle curve in uscita e in entrata. Puoi anche selezionare un punto e usare le frecce della tastiera.\nOsserva le curve e la loro somma: tenerle entrambe alte può aumentare il volume della transizione.\nSalva curva conserva la forma con un nome nell’elenco; Reimposta forma riporta la forma modificabile all’inizio.',
  'help.crossfade.tip':
    'Se i controlli non sono disponibili, avvia un brano audio della Libreria. La curva cambia la transizione, non l’EQ dei brani.',
  'help.crossfade.keywords':
    'crossfade, fade, transition, overlap, dj, equal power, custom curve, save curve, outgoing, incoming',
  'help.gamefilter.title': 'Filtro Gioco: passi, ambiente e voci',
  'help.gamefilter.intro':
    'Ogni gioco ha controlli propri per indizi deboli, ambiente e dialoghi. Parti dal suo profilo e modifica la sua copia mentre ascolti.',
  'help.gamefilter.steps':
    'Apri Gaming Lab, seleziona un gioco e prova il suo suono se non è già caricato. Scegli Gioco tra le sue parti.\nAlza i passi per sentire passi deboli, ricariche e porte. Calm contiene gli eventi forti che distraggono; confronta prima di esagerare con entrambi.\nL’opzione per zoccoli e passi pesanti aumenta il peso grave di stivali, cavalli e veicoli. Spegnila se appesantisce troppo gli indizi.\nAmbiente abbassa o alza il fondo. Quando emerge un passo o un suono distinto lascia andare, per non abbassarlo insieme allo sfondo.\nDialogo avvicina una voce centrale. Fare spazio abbassa leggermente il resto mentre qualcuno parla.\nL’isolamento fa sentire le modifiche; poi torna al gioco completo. Salva come profilo mantiene la regolazione per altri giochi; ripristina torna al profilo di partenza.',
  'help.gamefilter.tip':
    'Un gioco con audio 3D proprio può mantenere Room spento per non posizionare due volte. Room è per cuffie. Quando scarichi il suono del gioco ritorna quello della musica.',
  'help.gamefilter.keywords':
    'game filter, footsteps, lift, calm, environment, ambience, dialogue, voices, make room, hooves, heavy steps, isolate, hrtf, spatial audio',
  'help.songs.title': 'EQ automatico: il suono di ogni brano',
  'help.songs.intro':
    'EQ automatico, nella pagina EQ, decide il suono di ogni brano: il suono salvato per il brano, il suono del suo album dalla Libreria o il tuo. La Correzione intelligente aggiunge sopra una correzione misurata. Il suono di un brano lo segue su ogni uscita; la correzione delle cuffie resta quella dell’uscita.',
  'help.songs.steps':
    'Apri EQ automatico in fondo agli strumenti di Il tuo EQ (il pulsante è pieno finché una delle sue parti è attiva) e attiva Suoni dei brani, Suoni degli album e Correzione intelligente come preferisci; ognuno si spegne da solo. Misura una volta, in fondo al pannello accanto a Gestisci, misura una volta ciò che suona e lo applica subito.\nMentre suona un brano, premi Salva per questo brano per conservare il suono che senti. Quando suona di nuovo, il suo suono torna; e quando segue un brano senza niente di salvato, torna il tuo suono.\nCambia il preset, il tono o una banda mentre suona un brano salvato e lo senti subito. Salva modifiche lo tiene per il brano, e così il pulsante Salva accanto a EQ automatico, senza aprirlo; Ripristina, seguito dal nome del suono salvato, rimette il suono salvato. Una modifica che non salvi non viene tenuta: la prossima volta il brano suona con il suo suono salvato. Una modifica su un brano senza niente di salvato diventa il tuo suono.\nNella Libreria, fai clic destro su un brano, una selezione o un album, oppure usa il Suono dell’album di un album, per scegliere un preset o tenere ciò che suona ora. Il suono proprio di un brano vince su quello del suo album; gli album cambiano solo nella Libreria.\nGestisci elenca ogni brano e album salvato, con Dimentica. Ripristina tutte le impostazioni spegne EQ automatico e li conserva.\nI tuoi EQ salvati sono nel menu Salva EQ, tra gli strumenti di Il tuo EQ: conserva ciò che suona come un EQ con nome, aggiorna quello attivo, mettine un altro o apri la gestione degli EQ salvati. Un brano salvato mentre è attivo un EQ salvato lo segue: aggiorna quell’EQ e il brano suona la nuova versione.',
  'help.songs.tip':
    'I brani da Spotify, YouTube o dal browser si riconoscono dal titolo e dall’artista che il lettore comunica, e tengono i loro suoni separati da quelli della Libreria. Film e video non ricevono mai il suono di un brano. EQ automatico si fa da parte mentre il DSP è spento, è attiva una catena Gaming o un gioco riproduce il proprio suono.',
  'help.songs.keywords':
    'auto eq, eq automatico, per brano, suono del brano, suono dell’album, ricorda brano, salva per questo brano, correzione intelligente, smart correction, smart eq, preset per brano, preset per album, dimentica, gestisci, canzone, eq salvato, salva eq',
  'help.mycurves.title': 'Le mie curve: importare, modificare e condividere',
  'help.mycurves.intro':
    'La tua raccolta di curve affianca la libreria delle misurazioni. Controlla la risposta e scegli tra livello di correzione e bande EQ modificabili.',
  'help.mycurves.steps':
    'Apri la pagina Correzioni cuffie; si apre su Le mie curve. Cerca o ordina l’elenco per trovare una curva salvata.\nUsa Aggiungi curva per il tuo EQ attuale, un file di testo, una scelta dalla libreria di misure o dati incollati, e indica per quali orecchie è. Importa da Squiglink accetta il suo testo EQ esportato. Controlla l’anteprima prima di salvare.\nApplica come curva aggiunge uno strato di correzione e lascia le bande modificabili come sono. Applica come EQ sostituisce, dopo conferma, le bande delle orecchie per cui la curva è stata salvata.\nIl menu di una curva può rinominarla, modificarne le bande, duplicarla, copiarla come testo o eliminarla. Modificare una curva salvata non richiede di ripetere l’importazione.\nEsporta elenco e Importa elenco portano l’intera raccolta da un computer all’altro. Indica chiaramente autore della misura e modello quando condividi una correzione.',
  'help.mycurves.tip':
    'Una curva descrive una risposta in frequenza; un profilo di uscita conserva anche il resto del suono del dispositivo. Verifica modello e fonte prima di applicare la correzione.',
  'help.mycurves.keywords':
    'my curves, custom curve, squiglink, import list, export list, apply as curve, apply as eq, left ear, right ear, curve editor, measurements',
} as const;

export default helpDetails;
