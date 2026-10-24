/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dictionary } from '../en';

/** Italian of `./en.ts`, the Linux wording; see there. */
const it: Partial<Dictionary> = {
  'app.menu.restartAudio': 'Riavvia l’audio',
  'restart.title': 'Riavvia l’audio',
  'restart.failed': 'Impossibile riavviare l’audio.',
  'notice.restartConfirm':
    'L’audio si interromperà per qualche secondo mentre il motore FluidEQ riparte. Continuare?',
  'notice.restartDone':
    'L’audio è stato riavviato. Riapri le applicazioni ancora mute.',
  'troubleshoot.restart.title': 'Riavvia l’audio',
  'troubleshoot.restart.cost':
    'Qualche secondo di silenzio mentre il motore FluidEQ riparte. Nessuna password.',
  'engine.title': 'Come FluidEQ elabora il tuo suono',
  'engine.subtitle':
    'Il motore FluidEQ lavora accanto al tuo server audio, PipeWire o PulseAudio, finché FluidEQ resta aperto.',
  'engine.fluid.l1':
    'Funziona con PipeWire e PulseAudio, su qualsiasi distribuzione',
  'engine.fluid.l2':
    'EQ e rack DSP si applicano a tutto ciò che ascolti, senza riavvio',
  'engine.fluid.l3':
    'Le righe Plugin: e i plugin VST nella configurazione non funzionano',
  'output.hint':
    'Le modifiche si salvano nel profilo attivo e seguono questa uscita ogni volta che è quella in riproduzione.',
  'extraOutput.ambiguous':
    'Due uscite hanno lo stesso nome, quindi FluidEQ non può capire quale intendi. Rinominane una nelle impostazioni audio.',
  'extraOutput.unmatched':
    'Le impostazioni audio elencano questa uscita ma FluidEQ non riesce a raggiungerla, quindi non è possibile duplicare su di essa.',
  'convolution.eyebrow': 'RISPOSTE ALL’IMPULSO',
  'convolution.notice.fluid':
    'Il catalogo scaricabile è fornito da AutoEq. Ogni download corrisponde alla frequenza a cui funziona la tua uscita, e il motore FluidEQ converte da solo qualsiasi altra frequenza.',
  'graph.scene.gpu.auto': 'Decide il sistema',
  'settingsReset.body':
    'Il grafico e i visualizzatori, Colori della finestra, il lettore, la Libreria, la lingua, le Animazioni e Avvia all’accesso tornano come in una nuova installazione di FluidEQ.',
  'app.processes.hint':
    'Il sistema chiama ognuno di questi come l’app, perché sono lo stesso programma. Questo è ciò che ciascuno fa davvero per FluidEQ.',
  'app.processes.what.engine':
    'Il motore proprio di FluidEQ. Decodifica ciò che ascolti e applica l’equalizzatore strada facendo. È un programma a sé, così una finestra occupata non può bloccare la musica.',
  'app.processes.what.devices':
    'Avviato da Chromium quando l’app chiede quali dispositivi audio ci sono; la stessa richiesta elenca anche quelli video. Non apre alcuna fotocamera e non registra nulla.',
  'app.processes.name.systemEngine': 'Motore FluidEQ (audio di sistema)',
  'app.processes.what.systemEngine':
    'L’equalizzatore tra le tue app e il tuo server audio, che lo applica a tutto ciò che ascolti. FluidEQ lo avvia e lo ferma insieme a sé; la sua memoria e la sua CPU sono mostrate ma non sommate al totale.',
  'dsp.normalizer.liveGuidance':
    'Il livellamento dal vivo segue il brano in riproduzione. Un passaggio forte abbassa il guadagno per il resto del brano; il successivo mantiene quel livello, a meno che non sia molto più quieto. I brani già ascoltati sono livellati dal primo secondo. Il guadagno sale al massimo di 6 dB entro il margine sui picchi; l’obiettivo non è garantito. Disattiva e riattiva per una nuova analisi. Non ripara la distorsione esistente.',
  'dsp.latency.hint':
    'Ritardo aggiunto dall’elaborazione del motore. Server audio, dispositivo e rete sono esclusi.',
  'dsp.latency.note':
    'Buffer segnalati dal motore alla frequenza attuale. Server audio, dispositivo e rete sono esclusi.',
  'dsp.surround.onHint':
    'Applica il rack a ogni canale di un’uscita 5.1 o 7.1, seguendo l’impostazione della tua uscita, con una sola decisione di livello per tutti.',
  'update.mandatory.failedInstall':
    'L’aggiornamento è stato scaricato, ma il programma di installazione non è partito. Il file scaricato potrebbe essere danneggiato.',
  'startup.label': 'Avvia all’accesso',
  'startup.blocked': 'Il tuo desktop lo ha disattivato nelle sue app di avvio',
  'startup.failed': 'Il sistema non ha permesso la modifica',
  'disclaimer.liability':
    'FluidEQ cambia il modo in cui l’audio viene elaborato sul tuo computer: il suo motore si inserisce tra le tue app e il tuo server audio ed elabora tutto ciò che ascolti. Nella massima misura consentita dalla legge, {author} non risponde di alcun danno derivante dall’uso: al tuo udito, a diffusori, cuffie o altre apparecchiature, a dati o ad altri programmi, né a nient’altro, comprese le perdite che non avresti potuto prevedere.',
  'provenance.body':
    'I pacchetti ufficiali di FluidEQ vengono distribuiti soltanto tramite fluideq.com. Le build dal codice sorgente devono provenire dal repository ufficiale. La GPL consente a terzi di copiare, modificare, ricompilare e vendere FluidEQ, ma le loro build non sono riviste, supportate o approvate da FluidEQ. Se un download afferma di essere ufficiale e non proviene da fluideq.com o dal repository ufficiale, chiudilo e segnalalo.',
  'engineHealth.offBody':
    'Questa uscita sta suonando senza il tuo EQ. Riavviare l’audio di solito fa ripartire il motore, e nel frattempo tutto il resto di FluidEQ continua a funzionare.',
  'engineHealth.rackNeedsEngine':
    'Gli effetti DSP girano dentro il motore stesso. Riavviare l’audio lo fa ripartire; se non basta, reinstallare FluidEQ rimette al suo posto il motore di FluidEQ.',
  'tour.engine.lead':
    'FluidEQ ha ora un motore audio tutto suo. Gira accanto al tuo server audio, PipeWire o PulseAudio, e applica il tuo EQ e l’intero rack DSP a tutto ciò che il computer riproduce: giochi, browser, app di streaming, non solo la Libreria.',
  'tour.engine.flow.inside': 'Accanto al tuo server audio',
  'tour.dsp.lead':
    'Un rack di stadi da studio: Normalizzatore, Riduzione del rumore, Exciter, Fucina dei bassi, Equalizzatore, Punch dei bassi, Dimensione, Stanza, Maximizer e Master, più una dissolvenza incrociata tra i brani della Libreria. Agisce su tutto ciò che il computer riproduce. Ogni stadio ha una pagina tutta sua con una vista dal vivo, la maggior parte ha dei preset, e cinque hanno un interruttore Isola per sentire solo ciò che fanno.',
  'tour.dsp.how':
    'Apri la scheda DSP, scegli una catena in Preset, poi clicca uno stadio nelle schede laterali e mettilo su Attivo.',
  'help.start.steps':
    'Installa FluidEQ dal suo .deb o AppImage e aprilo: il motore FluidEQ parte insieme a lui, senza password e senza riavvio.\nScegli il tuo dispositivo d’ascolto in Dispositivo di uscita. Attiva EQ di sistema e lascia attivo Normalizza automaticamente.\nRiproduci un brano, apri EQ → Bande, modifica leggermente e confronta attivando e disattivando EQ di sistema.',
  'help.start.tip':
    'L’EQ di sistema su Linux richiede PipeWire o PulseAudio, che ogni desktop attuale usa. Mentre FluidEQ è aperto, tutto ciò che riproduci passa da lì; uscendo ti restituisce il suono intatto.',
  'help.window.tip':
    'Il menu Aiuto apre questa guida, Novità, la risoluzione dei problemi audio e Segnala un problema. Il pulsante a impulso accanto ad Aiuto contiene la scheda del motore, il tuo account, l’importazione di impostazioni EQ o di una risposta all’impulso, il riavvio dell’audio e Processi, che mostra cosa sta usando ogni parte di FluidEQ; in fondo al menu ci sono Luminosità e Trasparenza, le animazioni, Avvia all’accesso e la lingua. L’interruttore dopo questi due pulsanti trasforma la finestra nel Lettore compatto.',
  'help.window.actions':
    'Il motore, il tuo account, l’importazione delle impostazioni EQ, il riavvio dell’audio e Processi; Luminosità e Trasparenza, le animazioni, Avvia all’accesso e la lingua.',
  'help.player.tip':
    'Il volume del lettore è quello del tuo computer, quindi regola il livello di tutto ciò che il computer riproduce. Se il lettore finisce fuori dallo schermo, fai clic destro sull’icona di FluidEQ nella barra superiore e scegli Ripristina la finestra.',
  'help.player.volume':
    'Il volume del tuo computer: regola il livello di tutto ciò che il computer riproduce.',
  'help.requirements.intro':
    'FluidEQ gira su qualsiasi desktop Linux a 64 bit degli ultimi anni: Ubuntu, Debian, Fedora, Mint, Arch e tutti gli altri. Due parti chiedono più delle altre: i visualizzatori Plus disegnano sulla scheda grafica e il karaoke con IA scarica i suoi modelli la prima volta che lo usi.',
  'help.requirements.steps':
    'Controlla il tuo sistema: Linux a 64 bit con PipeWire o PulseAudio (ogni desktop attuale ne ha uno), 4 GB di memoria e circa 600 MB di disco. Il .deb è per Ubuntu, Debian e le loro derivate; l’AppImage funziona su tutte le altre.\nApri un visualizzatore: qualsiasi scheda grafica o grafica integrata dal 2013 in poi. A 1080p la grafica integrata basta; per il 4K è meglio una scheda dedicata. Se la scheda è occupata, FluidEQ disegna la scena più piccola e lascia andare quelle che non stai guardando.\nProva il karaoke con IA: separare la voce scarica un modello da 713 MB la prima volta, quello dell’intonazione aggiunge circa 180 MB e la rimozione del rumore 11 MB. Lavora sul processore, dove un brano di quattro minuti si separa in circa quattro minuti. Tieni liberi 2 GB di memoria mentre lavora.\nPunta a questo se puoi: 8 GB di memoria, grafica dal 2018 in poi e 3 GB di disco liberi se usi le funzioni con IA.',
  'help.requirements.keywords':
    'requisiti di sistema, requisiti minimi, requisiti consigliati, specifiche tecniche, hardware, sistema operativo, compatibilità, GPU, scheda video, CPU, RAM, spazio su disco, consumo risorse, portatile, notebook, prestazioni, lento, lag, Linux, Ubuntu, Debian, Fedora, Mint, Arch, PipeWire, PulseAudio, deb, AppImage',
  'help.engine.intro':
    'FluidEQ elabora il suono con il proprio motore. Il motore FluidEQ gira accanto al tuo server audio (PipeWire o PulseAudio): diventa l’uscita del sistema, applica il tuo EQ e il rack DSP a tutto ciò che il computer riproduce, invia il risultato alla tua uscita reale e si fa da parte appena FluidEQ si chiude.',
  'help.engine.steps':
    'Apri il menu delle azioni (il pulsante a impulso in alto a destra). La scheda del motore, in cima, dice se il motore è in funzione.\nScegli l’uscita con cui ascolti nel pannello Uscita. FluidEQ riproduce su di essa e ti segue quando ne scegli un’altra nelle impostazioni audio.\nSe un avviso dice che il motore non è in funzione, premi Riavvia l’audio.',
  'help.engine.tip':
    'Lascia FluidEQ come uscita del sistema: scegliere altoparlanti o cuffie nelle impostazioni audio va bene, FluidEQ li segue. Uscire da FluidEQ restituisce ogni app all’uscita che hai scelto.',
  'help.engine.keywords':
    'engine, equalizzatore di sistema, driver audio, globale, tutti i programmi, Spotify, Discord, browser, PipeWire, PulseAudio, server audio, uscita, uscita predefinita, riavviare audio',
  'help.engine.apo':
    'Non su Linux: Equalizer APO è un programma per Windows, e qui il suo lavoro lo fa il motore FluidEQ.',
  'help.engine.apply':
    'Non serve su Linux: il motore FluidEQ è l’unico motore ed è già quello in uso.',
  'help.convolution.tip':
    'Il motore FluidEQ converte da solo qualsiasi frequenza dell’impulso. Il catalogo richiede una connessione per scaricare; questa guida no.',
  'help.profiles.output':
    'L’uscita con cui stai ascoltando, con la batteria per le cuffie Bluetooth. DISATT. significa che il tuo EQ non la raggiunge; ATTIVO, che è l’uscita in riproduzione ora.',
  'help.config.tip':
    'I file generati vengono riscritti quando cambiano le loro impostazioni; metti le righe manuali permanenti nel file personalizzato dell’uscita. Il motore FluidEQ ne legge le righe Filter, Preamp, GraphicEQ e Convolution; le righe Plugin: e i plugin VST non funzionano su Linux.',
  'help.dsp.intro':
    'Il rack DSP è una catena di stadi da studio. Con il motore FluidEQ elabora tutto ciò che il computer riproduce. Resta spento mentre FluidEQ è spento.',
  'help.room.tip':
    'Giochi e film inviano i loro canali surround solo a un’uscita configurata con altrettanti altoparlanti: se il tuo dispositivo li ha, scegli 5.1 o 7.1 per quell’uscita nelle impostazioni audio.',
  'help.online.tip':
    'Con il motore FluidEQ, Media online passa dal tuo EQ e dal rack DSP come ogni altra app.',
  'help.library.tip':
    'Libreria ha bisogno dei file originali: ricollega il disco o aggiungi di nuovo una cartella spostata.',
  'help.share.tip':
    'Il codice di connessione autorizza il collegamento: tienilo privato. Questo computer mantiene il suo DSP mentre condivide, e il computer che riproduce il suo suono applica il proprio. Riprodurre e inviare insieme richiede, su quel computer, Windows oppure il motore FluidEQ su Linux; altrove un collegamento funziona in una sola direzione.',
  'help.trouble.steps':
    'Nessun suono: verifica riproduzione, uscita, volume e collegamento. Un solo lettore potrebbe aver messo in pausa un’altra sorgente.\nL’EQ non cambia nulla: verifica che EQ di sistema sia attivo e che l’uscita non mostri l’etichetta DISATT. Se un avviso dice che il motore non è in funzione, premi Riavvia l’audio.\nSembra tutto a posto e l’EQ continua a non fare nulla: verifica che FluidEQ sia ancora l’uscita nelle impostazioni audio; riavviare l’audio lo rimette al suo posto.\nDistorsione o bassi eccessivi: lascia attivo Normalizza automaticamente, riduci i rinforzi e spegni un livello alla volta. Se persiste, usa Segnala un problema e rivedi la segnalazione prima di inviarla.',
  'troubleshoot.description':
    'Su Linux un solo passaggio risolve quasi ogni problema: riavviare il motore FluidEQ, che richiede qualche secondo.',
  'troubleshoot.footer':
    'Ancora qualcosa non va dopo questo? Usa **{report}** nello stesso menu: raccoglie i log, toglie tutto ciò che potrebbe identificarti e te li mostra per intero prima di inviarli.',
  'help.window.plus': 'Visualizzatori, la galleria e lo Studio.',
  'help.plus.intro':
    'L’account è facoltativo: tutto ciò che era gratuito funziona su questo computer anche senza. Con l’accesso, la scheda Plus raccoglie Visualizzatori e lo Studio. Una scena di Visualizzatori costa un credito ed è tua per sempre; un account confermato riceve alcuni crediti gratis, e i pacchetti di crediti si pagano una sola volta.',
  'help.gallery.desktop':
    'Solo su Windows: mette la scena dietro le icone del desktop.',
  'help.gallery.manage':
    'Solo su Windows: cosa mostra ogni monitor come sfondo del desktop.',
  'help.gallery.stop':
    'Solo su Windows: interrompe tutti gli sfondi del desktop.',
  'help.library.steps':
    'Apri Libreria e aggiungi la cartella multimediale. Lascia finire la scansione prima di valutare cosa manca.\nScegli artista o album oppure cerca un brano e avvialo dai risultati.\nUsa la barra in fondo alla finestra per mettere in pausa, cercare e saltare. Il suo volume è quello del tuo computer.',
};

export default it;
