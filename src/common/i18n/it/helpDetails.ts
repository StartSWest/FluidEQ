/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/** Detailed guides for the current sound and playback tools. */
const helpDetails = {
  'help.dynamics.title': 'Dinamica: passaggi deboli e forti',
  'help.dynamics.intro':
    'Dinamica è un compressore a tre bande: solleva i passaggi deboli e contiene quelli forti senza aggiungere ritardo. Funziona con musica, film, voce e suono dei giochi.',
  'help.dynamics.steps':
    'Apri DSP → Dinamica, attiva lo stadio e scegli un preset. Quelli per i giochi sono in Gaming Lab.\nLe bande coprono bassi sotto 150 Hz, medi da 150 Hz a 4 kHz e alti oltre 4 kHz. Lavora sulla banda del suono interessato.\nIn Alzare, Sotto stabilisce quando alzare i suoni deboli, Rapporto quanto e Fino a il guadagno massimo. Il rapporto 1:1 non modifica il suono.\nIn Trattenere, Sopra stabilisce quando ridurre i suoni forti e Rapporto con quale intensità. Abbassare la soglia fa intervenire più spesso.\nRegola Attacco e Rilascio, Mix per unire il segnale originale e Compensazione per il livello finale. Confronta a volume simile.\nIl grafico mostra prima, dopo e guadagno applicato: una salita solleva, una discesa contiene. Un avviso di aggiornamento del motore può riguardare solo il grafico dal vivo, mentre il suono è già elaborato.',
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
    'Regola il livello della sorgente prima degli stadi creativi. I file della Libreria possono essere analizzati interamente; le altre sorgenti vengono apprese durante la riproduzione.',
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
  'help.songs.title': 'Ricordare il suono di ogni brano',
  'help.songs.intro':
    'Un brano può ricordare preset, Tone ed EQ separatamente per ogni uscita. La regolazione delle cuffie non cambia la memoria degli altoparlanti.',
  'help.songs.steps':
    'Sotto i profili dell’uscita attiva Ricorda il suono di ogni brano. All’inizio è disattivato.\nRiproduci un brano riconoscibile e cambia preset, Tone o EQ. Un avviso annuncia il salvataggio; rifiutalo se era solo una prova.\nAlla prossima riproduzione sulla stessa uscita il suono ritorna temporaneamente. Annulla lo salta per questa volta; Dimentica il brano elimina anche la memoria.\nAlla fine torna il suono precedente dell’uscita. Scegliere un altro profilo ti restituisce esplicitamente il controllo.\nSmart EQ ha un comando separato per salvare il brano mentre misura. Conserva la correzione misurata, indipendentemente dalle regolazioni manuali ricordate.',
  'help.songs.tip':
    'L’identità viene dal file o dalle informazioni del lettore. Titoli mancanti o errati possono impedire il riconoscimento. Il preamplificatore non viene memorizzato; il suono di un gioco caricato ha la precedenza.',
  'help.songs.keywords':
    'per song, song sound, song memory, remember song, save song eq, smart eq, undo, forget this song, preset per song, tone per song',
  'help.mycurves.title': 'Le mie curve: importare, modificare e condividere',
  'help.mycurves.intro':
    'La tua raccolta di curve affianca la libreria delle misurazioni. Controlla la risposta e scegli tra livello di correzione e bande EQ modificabili.',
  'help.mycurves.steps':
    'Apri EQ Presets → Le mie curve. Cerca o ordina le curve salvate.\nAggiungi curva accetta l’EQ attuale, un file di testo, una misurazione o testo incollato. L’importazione Squiglink usa il suo export EQ. Verifica l’anteprima.\nApplica come curva aggiunge un livello senza sostituire le bande. Applica come EQ sostituisce dopo conferma le bande di entrambi gli orecchi, del sinistro o del destro secondo la destinazione.\nIl menu consente rinomina, modifica delle bande, duplicazione, copia come testo e cancellazione. Per modificare non serve importare di nuovo.\nEsporta elenco e Importa elenco trasferiscono la raccolta tra computer. Mantieni riconoscibili modello e autore della misurazione quando la condividi.',
  'help.mycurves.tip':
    'Una curva descrive una risposta in frequenza; un profilo di uscita conserva anche il resto del suono del dispositivo. Verifica modello e fonte prima di applicare la correzione.',
  'help.mycurves.keywords':
    'my curves, custom curve, squiglink, import list, export list, apply as curve, apply as eq, left ear, right ear, curve editor, measurements',
} as const;

export default helpDetails;
