/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { Dictionary } from './en';

/** Italian. */
const it: Partial<Dictionary> = {
  'app.tagline': 'Il tuo suono. Su ogni dispositivo. Automaticamente.',
  'app.actions': 'Azioni di FluidEQ',
  'app.actions.title': 'Azioni audio',
  'app.status.ready': 'Connesso a Equalizer APO',
  'app.status.checking': 'Controllo di Equalizer APO…',
  'app.status.error': 'Equalizer APO non risponde',
  'app.menu.importEq': 'Importa impostazioni EQ…',
  'app.menu.importConvolution': 'Importa risposta all’impulso…',
  'app.menu.restartAudio': 'Riavvia l’audio di Windows',
  'app.menu.reconfigure': 'Riconfigura Equalizer APO',
  'app.menu.apoSettings': 'Impostazioni di Equalizer APO',
  'app.menu.support': 'Sostieni il progetto',
  'whatsNew.eyebrow': 'NOTE DI RILASCIO',
  'whatsNew.title': 'Novità di FluidEQ',
  'whatsNew.loading': 'Caricamento delle note di rilascio…',
  'whatsNew.missing':
    'Le note di rilascio non si trovano in questa build. Sono anche su GitHub.',
  'app.menu.whatsNew': 'Novità',
  'app.menu.language': 'Lingua',
  'app.window.minimize': 'Riduci a icona',
  'app.window.maximize': 'Ingrandisci',
  'app.window.restore': 'Ripristina',
  'app.window.close': 'Chiudi',
  'app.window.minimizeApp': 'Riduci a icona FluidEQ',
  'app.window.maximizeApp': 'Ingrandisci FluidEQ',
  'app.window.restoreApp': 'Ripristina FluidEQ',
  'app.window.closeApp': 'Chiudi FluidEQ',
  'app.dismiss': 'Chiudi',

  'tabs.aria': 'Area di lavoro del suono',
  'tabs.eq': 'EQ',
  'tabs.autoeq': 'AutoEQ',
  'tabs.voicing': 'Carattere',
  'tabs.convolution': 'Convoluzione',
  'tabs.config': 'Config',
  'tabs.video': 'Video',

  'graph.resize': 'Trascina per ridimensionare il grafico',
  'graph.meter.aria':
    'Livello di uscita in tempo reale, in decibel reali sotto il fondo scala',
  'graph.meter.left': 'S',
  'graph.meter.right': 'D',
  'graph.meter.mono': 'M',
  'video.sites': 'Siti video',
  'video.back': 'Indietro',
  'video.forward': 'Avanti',
  'video.reload': 'Ricarica',
  'video.stop': 'Interrompi',
  'video.searchAria': 'Cerca nel sito corrente',
  'video.searchOn': 'Cerca su {site}',
  'video.searchGo': 'Cerca',
  'video.searchClear': 'Cancella la ricerca',
  'video.searchRecent': 'Ricerche recenti',
  'video.searchForget': 'Dimentica «{term}»',
  'video.searchForgetAll': 'Cancella le ricerche recenti',
  'video.adBlock': 'Blocca gli annunci',
  'video.adBlockHint':
    'Salta gli annunci video e nasconde gli spazi pubblicitari su YouTube.',
  'video.signOut': 'Disconnetti da tutti i siti',
  'video.signOutBusy': 'Disconnessione…',
  'video.signOutHint':
    'Cancella tutti i cookie, gli accessi e le pagine in cache conservati dal player.',
  'video.signOutDone': 'Disconnesso',
  'video.signOutFailed': 'Impossibile disconnettersi',
  'video.blockedTitle': 'Quel link porta fuori dal player',
  'video.openInBrowser': 'Apri nel browser',
  'video.resize': 'Trascina per ridimensionare il player',

  'notice.apoReconfigured':
    'Equalizer APO è stato installato o riconfigurato. Se manca l’audio, riavvia il servizio audio di Windows invece del PC.',
  'notice.restartNow': 'Riavvia l’audio adesso',
  'notice.importComplete': 'Importazione completata',
  'notice.restartConfirm':
    'L’audio si interromperà per qualche secondo e Windows chiederà i permessi di amministratore. Continuare?',
  'update.title': 'Aggiornamento di FluidEQ',
  'update.available': 'La versione {version} è disponibile. Download in corso.',
  'update.downloading': 'Download dell’aggiornamento… {percent}%',
  'update.ready':
    'La versione {version} è pronta. Riavvia FluidEQ per completare.',
  'update.restart': 'Riavvia adesso',
  'update.restarting': 'Riavvio…',
  'notice.restartDone':
    'L’audio di Windows è stato riavviato. Riapri le applicazioni ancora mute.',

  'sidebar.engine': 'MOTORE',
  'sidebar.systemEq': 'EQ di sistema',
  'sidebar.preamp': 'Preamplificazione',
  'sidebar.preampAria': 'Guadagno di preamplificazione (dB)',
  'sidebar.preampAuto':
    'Impostato per te. Disattiva Normalizza automaticamente per regolarlo.',
  'sidebar.headroom': 'MARGINE APO',
  'sidebar.autoPreamp': 'Normalizza automaticamente',
  'sidebar.visualizer': 'VISUALIZZATORE',
  'sidebar.graphView': 'Grafico di risposta',

  'output.eyebrow': 'SEGUE LA TUA USCITA',
  'output.title': 'Profilo automatico',
  'output.device': 'Dispositivo di uscita',
  'output.active': 'ATTIVO',
  'output.none': 'Nessuna uscita attiva trovata',
  'output.mapping': 'Associazione automatica',
  'output.mapping.neutral': 'Uscita neutra',
  'output.mapping.live': 'Regolazione dal vivo associata',
  'output.mapping.hint':
    'Modifica un qualsiasi controllo dell’EQ per salvarlo e associarlo automaticamente a questa uscita.',
  'output.hint':
    'FluidEQ usa l’identificativo stabile del dispositivo, così questo suono lo segue ogni volta che Windows lo seleziona.',

  'driver.eyebrow': 'CON COSA ASCOLTI',
  'driver.title': 'Tipo di driver',
  'driver.none': 'Nessuna compensazione',
  'driver.none.hint': 'Solo le tue bande e il carattere',
  'driver.strength': 'Intensità',
  'driver.range': '±1,5 dB',

  'profiles.eyebrow': 'IL TUO SUONO',
  'profiles.title': 'Profili salvati',
  'profiles.name': 'Nome del profilo',
  'profiles.nameAria': 'Nome del profilo',
  'profiles.new': 'Nuovo profilo',
  'profiles.newAria': 'Crea un nuovo profilo dall’EQ attuale',
  'profiles.untitled': 'Profilo senza titolo',
  'profiles.save': 'Salva come nuovo',
  'profiles.update': 'Aggiorna',
  'profiles.saveAria': 'Salva le impostazioni nel profilo',
  'profiles.restore': 'Ripristina',
  'profiles.restoring': 'Ripristino…',
  'profiles.restoreAria':
    'Ripristina l’ultima versione salvata a mano di questo profilo',
  'profiles.attached': 'ATT',
  'profiles.attachedTitle': 'In riproduzione su questa uscita',
  'profiles.detecting': 'Rilevamento dell’uscita…',
  'profiles.empty': 'Ancora nessun profilo. Crea il tuo primo suono.',
  'profiles.error.empty': 'Il nome del profilo non può essere vuoto.',
  'profiles.error.restricted': 'Nome non valido, scegline un altro.',
  'profiles.error.duplicate': 'Questo nome esiste già, scegline un altro.',
  'profiles.edit': 'Modifica il nome del profilo',

  'autoeq.page.eyebrow': 'ADATTA LE TUE CUFFIE',
  'autoeq.page.title': 'Correzione delle cuffie',
  'autoeq.page.intro':
    'Dì con quali cuffie stai ascoltando e FluidEQ applica la correzione pubblicata per quel modello. Entra come livello a sé, con la sua intensità e il suo interruttore, quindi le tue bande di EQ non vengono mai toccate. Ogni misura è stata presa su un banco vero e pubblicata da qualcuno: nulla viene indovinato dal nome del modello.',
  'autoeq.source.hint':
    'Da quale database vengono le misure. «Tutti i database» li cerca tutti insieme.',
  'autoeq.model.hint':
    'Cerca per marca o modello. Se il tuo non è misurato, un parente stretto della stessa serie di solito ti porta molto vicino.',
  'autoeq.target.hint':
    'La maggior parte dei modelli è misurata più di una volta — banchi diversi, curve obiettivo diverse — e non suonano allo stesso modo. Vale la pena provarne più di una.',
  'autoeq.eyebrow': 'PARTI DA UN RIFERIMENTO',
  'autoeq.title': 'Libreria AutoEQ',
  'autoeq.selectSource': 'Scegli una fonte',
  'autoeq.applied': 'Applicato: {name}',
  'autoeq.notApplied': 'Nessun riferimento applicato',
  'autoeq.source': 'Fonte della misura',
  'autoeq.model': 'Modello di cuffie',
  'autoeq.target': 'Misura / curva obiettivo',
  'autoeq.apply': 'Applica l’EQ del modello',
  'autoeq.applying': 'Applicazione…',
  'autoeq.applyAria': 'Applica l’EQ del modello selezionato',
  'autoeq.checking': 'Controllo del database ufficiale…',
  'autoeq.updateAvailable': 'Aggiornamento disponibile ({count} modelli)',
  'autoeq.upToDate': 'Database aggiornato — {count} modelli',
  'autoeq.updateUnknown': 'Impossibile controllare gli aggiornamenti',
  'autoeq.update': 'Aggiorna il database',
  'autoeq.updating': 'Aggiornamento…',
  'autoeq.updateAria': 'Aggiorna il database AutoEq',
  'autoeq.allDatabases': 'Tutti i database',
  'autoeq.allDatabases.hint':
    'Cerca insieme in AutoEq ufficiale e GadgetryTech.',
  'autoeq.pickDevice': 'Scegli prima un modello 🎧',
  'autoeq.noResponses': 'Nessuna misura supportata 😞',
  'autoeq.pickResponse': 'Scegli una misura! 🔊',
  'autoeq.selectSourcePlaceholder': 'Scegli una fonte…',
  'autoeq.searchSources': 'Cerca tra le fonti…',
  'autoeq.noModel': 'Nessun modello misurato corrisponde alla tua ricerca.',
  'autoeq.searchModels': 'Cerca per marca o modello…',
  'voicing.quickAria': 'Carattere: {name}',
  'voicing.quickNone': 'Carattere: nessuno',
  'voicing.quickTitle': 'Nessun carattere applicato',
  'voicing.quickLabel': 'Carattere',
  'voicing.quickNoneHint': 'Solo le tue bande di EQ',

  'eq.eyebrow': 'REGOLAZIONE FINE',
  'eq.title': 'EQ parametrico',
  'eq.smart': 'EQ intelligente',
  'eq.smart.cancel': 'Annulla',
  'eq.smart.aria': 'EQ intelligente dall’uscita dal vivo',
  'eq.smart.cancelAria': 'Annulla la misurazione dell’EQ intelligente',
  'eq.smart.continuous': 'Continuo',
  'eq.smart.continuousAria':
    'Continua a misurare e regolare l’EQ mentre suona la musica',
  'eq.smart.modeAria': 'Scegli come misura l’EQ intelligente',
  'eq.smart.mode.once.note': 'Una misurazione, applicata in una volta',
  'eq.smart.mode.detail': 'Dettaglio',
  'eq.smart.mode.detail.note': 'Continua a misurare · solo picchi e buchi',
  'eq.smart.mode.balance': 'Equilibrio',
  'eq.smart.mode.balance.note':
    'Continua a misurare · uniforma anche brillantezza e calore',
  'eq.smart.mode.target': 'Obiettivo',
  'eq.smart.mode.target.note':
    'Continua a misurare · ogni registrazione sulla stessa curva',
  'eq.layers': 'Applicato anche',
  'eq.layers.aria': 'Cos’altro sta modellando questa uscita',
  'eq.layers.eq': 'EQ',
  'eq.layers.eq.modified': '(modificato)',
  'eq.layers.eq.bands': '{count} bande',
  'eq.layers.convolution': 'Convoluzione',
  'eq.layers.voicing': 'Carattere',
  'eq.layers.driver': 'Driver',
  'eq.layers.headphone': 'Cuffie',
  'eq.layers.disable': 'Disattiva {layer} senza rimuoverlo',
  'eq.layers.enable': 'Riattiva {layer}',
  'eq.layers.smart': 'EQ intelligente',
  'eq.layers.smart.fullRange': 'Misurato · tutta la banda',
  'eq.layers.smart.range': 'Misurato · da {low} a {high}',
  'eq.layers.remove': 'Rimuovi il livello {layer}',
  'eq.layers.clearBands': 'Riporta tutte le bande a 0 dB',
  'eq.layers.clearReference': 'Rimuovi la correzione delle cuffie',
  'eq.layers.clearSmart':
    'Rimuove la correzione misurata. Le tue bande e il riferimento restano.',
  'eq.clear': 'Azzera l’EQ',
  'eq.addBand': 'Aggiungi banda',
  'eq.addBandAria': 'Aggiungi una banda di EQ',
  'eq.quickLayouts': 'Disposizioni rapide',
  'eq.bandCount': '{count} bande',
  'eq.selected': 'Banda selezionata',
  'eq.filter': 'Filtro',
  'eq.frequency': 'Frequenza',
  'eq.gain': 'Guadagno',
  'eq.gainDisabled': 'Guadagno · n/d',
  'eq.quality': 'Fattore Q',
  'eq.delete': 'Elimina banda',
  'eq.deleteAria': 'Elimina la banda di EQ selezionata',

  // Le clausole sono etichette — gamma, due punti, sostantivo — perché «di» si
  // elide davanti a vocale («aumento d’aria») e perché participi e quantitativi
  // concordano in genere e numero («troppo aria» sarebbe sbagliato). Un
  // sostantivo dopo i due punti non concorda con nulla.
  'eq.smart.range.deepBass': 'bassi profondi',
  'eq.smart.range.bass': 'bassi',
  'eq.smart.range.lowMids': 'medio-bassi',
  'eq.smart.range.mids': 'medi',
  'eq.smart.range.upperMids': 'medio-alti',
  'eq.smart.range.presence': 'presenza',
  'eq.smart.range.treble': 'acuti',
  'eq.smart.range.highTreble': 'acuti alti',
  'eq.smart.range.air': 'aria',
  'eq.smart.range.separator': ', ',
  'eq.smart.shape.lifted': '{range}: aumento',
  'eq.smart.shape.eased': '{range}: riduzione',
  'eq.smart.need.more': '{range}: carenza',
  'eq.smart.need.less': '{range}: eccesso',
  'eq.smart.status.listening': 'In ascolto',
  'eq.smart.status.listeningPercent': 'In ascolto {percent}%',
  'eq.smart.status.settling': 'In ascolto {percent}% - stabilizzazione',
  'eq.smart.status.waitingOn': 'In ascolto {percent}% - in attesa: {ranges}',
  'eq.smart.status.waitingOnMore':
    'In ascolto {percent}% - in attesa: {ranges} +{count}',
  'eq.smart.status.paused': 'In pausa',
  'eq.smart.status.pausedResume': 'In pausa - riprendi per finire',
  'eq.smart.status.pausedSilent': 'In pausa - nessun suono',
  'eq.smart.status.waitingForSound': 'In attesa di suono',
  'eq.smart.status.soundChanged': 'Il suono è cambiato - nuova misurazione',
  'eq.smart.status.keptChanging': 'Il suono continuava a cambiare - interrotto',
  'eq.smart.status.notEnoughRange': 'Gamma insufficiente per misurare',
  'eq.smart.status.alreadyBalanced': 'Già bilanciato',
  'eq.smart.status.applying': 'Applicazione…',
  'eq.smart.status.cancelled': 'Annullato - nulla è cambiato',
  'eq.smart.status.failed': 'Impossibile misurare l’uscita.',
  'eq.smart.result.fullRange': 'Bilanciato - gamma completa',
  'eq.smart.result.range': 'Bilanciato - solo da {low} a {high}',
  'eq.smart.result.withShape': '{result} · {shape}',
  'eq.smart.frequency.hz': '{value} Hz',
  'eq.smart.frequency.khz': '{value} kHz',
  'eq.smart.error.noCapture':
    'La cattura audio non è disponibile in questo ambiente.',
  'eq.smart.error.noLoopback':
    'La cattura dell’uscita di sistema non è disponibile in questo ambiente.',
  'eq.smart.error.streamStopped':
    'L’uscita si è fermata prima che la misurazione finisse.',
  'eq.smart.error.analyserPaused':
    'L’analizzatore è in pausa, quindi la misurazione si è fermata.',
  'eq.smart.error.noSound':
    'Non stava suonando nulla. Metti della musica e misura di nuovo.',
  'eq.smart.error.noAudioTrack':
    'Windows non ha fornito un flusso audio di sistema.',
  'eq.smart.error.formatChanged':
    'Il formato dell’uscita è cambiato durante la misurazione. Riprova.',
  'eq.smart.error.deviceChanged':
    'Il dispositivo audio è cambiato durante la misurazione. Riprova.',
  'eq.smart.error.captureFailed':
    'Impossibile catturare l’uscita di sistema elaborata.',
  'eq.smart.error.analyserOff':
    'L’analizzatore dell’uscita dal vivo non è attivo, quindi non c’è nulla da misurare.',
  'eq.smart.error.alreadyRunning': 'C’è già una misurazione in corso.',
  'eq.smart.error.timedOut': 'La misurazione è scaduta. Riprova.',
  'eq.smart.error.closed': 'FluidEQ ha chiuso la misurazione.',
  // Impersonale con «si», perché un participio concorderebbe con il nome della
  // gamma e nel segnaposto ci sta una forma sola.
  'eq.smart.presence.ignoredBelow': 'ignorato sotto {db} dB',
  'eq.smart.presence.trustedAbove': 'affidabile sopra {db} dB',
  'eq.smart.presence.reset': 'Ripristina {range} per questa modalità',
  'eq.smart.limit.label': 'Limite Smart EQ {db} dB',
  'eq.smart.gap.title':
    '{range}: quanto diverge, rispetto a quanto serve per agire',
  'eq.smart.gap.countdown': 'scrive tra {seconds}s',

  'convolution.eyebrow': 'RISPOSTE ALL’IMPULSO DI APO',
  'convolution.title': 'Libreria di convoluzione',
  'convolution.intro':
    'Scarica un impulso a fase minima verificato per le tue cuffie e applicalo prima dell’EQ parametrico. Il grafico qui sotto mostra entrambe le curve.',
  'convolution.import': 'Importa un WAV…',
  'convolution.importing': 'Importazione…',
  'convolution.applied': 'Applicato a questa uscita',
  'convolution.clear': 'Rimuovi',
  'convolution.search': 'Cerca modelli di cuffie',
  'convolution.searchPlaceholder':
    'Prova con «Kraken», «HD 650» o il nome di un laboratorio',
  'convolution.notice':
    'Il catalogo scaricabile è fornito da AutoEq. I file vengono importati come WAV a 48 kHz perché Equalizer APO richiede che la risposta all’impulso corrisponda alla frequenza di campionamento dell’uscita attiva.',
  'convolution.loading': 'Caricamento del catalogo ufficiale…',
  'convolution.empty':
    'Nessuna risposta all’impulso corrispondente. Prova con un nome più corto.',
  'convolution.source': 'Origine',
  'convolution.apply': 'Scarica e applica',
  'convolution.downloading': 'Scaricamento…',
  'convolution.isApplied': 'Applicato',
  'convolution.none':
    'Nessuna convoluzione caricata. La scheda EQ resta del tutto indipendente.',

  'voicing.eyebrow': 'CURVE OBIETTIVO',
  'voicing.title': 'Carattere',
  'voicing.intro':
    'Un obiettivo tarato su quello che stai davvero facendo. Ognuno viene scritto come livello a sé dopo le tue bande, quindi la tua taratura non viene mai toccata e tornare a Nessuno la ripristina esattamente.',
  'voicing.refused': 'Impossibile cambiare il voicing',
  'voicing.groupPurpose': 'Per cosa',
  'voicing.groupGenre': 'Genere',
  'voicing.none': 'Nessuno',
  'voicing.none.hint': 'Solo le tue bande di EQ, senza nulla sopra',
  'voicing.strength': 'Intensità',
  'voicing.off': 'Niente',
  'voicing.full': 'Massima',
  'voicing.inert': 'Allo 0% di intensità questo carattere non fa nulla.',
  'voicing.headroom':
    'Aggiunge fino a +{peak} dB. Normalizza automaticamente riserva il margine; lascialo attivo a meno che tu non regoli la preamplificazione a mano.',

  'config.eyebrow': 'QUELLO CHE LEGGE IL MOTORE',
  'config.title': 'Configurazione di Equalizer APO',
  'config.lede':
    'Quello che c’è sul disco adesso, non quello che FluidEQ vorrebbe.',
  'config.reload': 'Ricarica',
  'config.reloadTitle': 'Rileggi la configurazione dal disco',
  'config.reading': 'Lettura…',
  'config.absent':
    'FluidEQ non ha ancora scritto nulla in questa installazione di Equalizer APO.',
  'config.status.notIncluded':
    'Equalizer APO non sta includendo questa configurazione. Nulla di quanto segue viene applicato.',
  'config.status.engineOff':
    'Il motore di FluidEQ è spento: questa configurazione non nomina alcuna uscita, quindi Equalizer APO non ne applica nulla.',
  'config.status.active':
    'Attiva — Equalizer APO sta applicando questa configurazione.',
  'config.outputsAria': 'Uscite nella configurazione di Equalizer APO',
  'config.filters.one': '{count} filtro',
  'config.filters.many': '{count} filtri',
  'config.impulse': 'impulso',
  'config.playingNow': 'In riproduzione',
  'config.liveTitle': 'L’EQ continuo tiene aggiornata questa misura',
  'config.layer.on': 'attivo',
  'config.layer.off': 'inattivo',
  'config.empty': 'Non include nulla: questa uscita resta intatta.',
  'config.file.missing': 'assente',
  'config.export': 'Esporta catena',
  'config.import': 'Importa catena',
  'config.import.hint':
    'L’importazione si applica all’uscita che stai ascoltando.',
  'config.file.yours': 'tuo',
  'config.hint.custom': 'È tuo. Non viene mai sovrascritto.',
  'config.hint.generated': 'Generato: riscritto alla prossima modifica.',
  'config.hint.saving':
    'Salvando si scrive il file; Equalizer APO lo recepisce.',
  'config.edit': 'Modifica',
  'config.cancel': 'Annulla',
  'config.save': 'Salva',

  'support.eyebrow': 'DEL TUTTO FACOLTATIVO',

  'support.petHint': 'Premi spazio per farlo saltare',

  'support.game.hint': 'Premi a tempo quando il picco raggiunge la linea',

  'support.game.howTo':
    'Tocca la creatura o premi spazio a ogni battito. Continua così e a ×10 succede qualcosa.',

  'support.game.thanks':
    'Se qualcosa qui ti ha strappato un sorriso, idee e sostegno sono ciò che lo tiene vivo.',

  'support.game.noAudio': 'Metti della musica e il ritmo comparirà qui',

  'support.game.listening': 'Cerco il ritmo…',

  'support.game.share': 'Condividi',

  'support.game.shareEuphoria': "Condividi l'euforia",

  'support.game.shareTitle': 'Condividi il tuo punteggio',

  'support.game.shareUnlock':
    'Arriva a ×10 e questa scheda diventa modalità euforia, arcobaleno incluso.',

  'support.game.shareNote':
    "Salva la scheda e allegala al post: nessuna di queste reti può ricavare un'immagine da un link.",

  'support.game.shareSave': 'Salva scheda',

  'support.game.shareCopyCard': 'Copia scheda',

  'support.game.shareCardCopied': 'Copiata — incollala',

  'support.game.shareCopy': 'Copia testo',

  'support.game.shareCopied': 'Copiato',

  'support.game.shareLinkOnly':
    'Condivide solo il link: incolla il testo tu stesso',

  'support.game.euphoria': 'Modalità euforia',

  'support.game.euphoriaToggle': 'Attiva o disattiva la modalità euforia',

  'support.game.perfect': 'Perfetto',

  'support.game.great': 'Ottimo',

  'support.game.good': 'Bene',

  'support.game.miss': 'Mancato',
  'support.title': 'Sostieni il lavoro',
  'support.close': 'Chiudi',
  'support.pitch':
    'FluidEQ è libero e open source, e resterà così: qui non c’è nulla dietro a un paywall e non viene mai tracciato niente. Se si è guadagnato un posto nel tuo impianto, un contributo finanzia il tempo che lo tiene in vita e le prossime idee che escono dalla stessa bottega.',
  'support.craft':
    'Questo è il lavoro di una persona sola, fatto con tantissimo amore e una cura per i dettagli poco ragionevole. Ogni pannello è disegnato a mano e discusso: come si legge la curva a colpo d’occhio, come si apre un menu, cosa fa una manopola quando la giri piano, quali parole finiscono su un pulsante. Qui non c’è nessun componente preconfezionato con sopra un tema.',
  'support.card': 'Carta o wallet',
  'support.card.hint':
    'Pagamento sicuro ospitato da Stripe. Si apre nel browser: l’app non vede mai i dati della tua carta.',
  'support.coffee': 'Offrimi un caffè',
  'support.coffee.hint':
    'Una mancia una tantum, senza account. Clicca per aprirlo nel browser oppure scansiona il codice col telefono.',
  'support.verify': 'Verifica l’indirizzo prima di inviare.',
  'support.copy': 'Copia l’indirizzo',
  'support.copied': 'Copiato',
  'support.openWallet': 'Apri nel wallet',
  'support.contributed': 'Ho contribuito — sblocca la stella e il ballo',
  'support.thanks':
    'Grazie — il tuo animaletto ha la sua stella, e adesso balla.',
  'support.releaseNotes': 'Guarda le novità di questa versione',
  'support.footerBefore':
    'Preferisci contribuire con il tempo? Issue e pull request sono altrettanto benvenute su',

  'language.title': 'Lingua',
  'language.aria': 'Lingua dell’interfaccia',
  'waveform.style': "Cambia lo stile dell'indicatore",
};

export default it;
