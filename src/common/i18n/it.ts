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
  'tabs.eq': 'EQ e tipo di cuffie',
  'tabs.voicing': 'Carattere',
  'tabs.convolution': 'Convoluzione',

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
  'eq.smart.fromFlat': 'Da piatto',
  'eq.layers': 'Applicato anche',
  'eq.layers.aria': 'Cos’altro sta modellando questa uscita',
  'eq.layers.convolution': 'Convoluzione',
  'eq.layers.voicing': 'Carattere',
  'eq.layers.driver': 'Driver',
  'eq.layers.headset': 'Cuffie',
  'eq.layers.smart': 'EQ intelligente',
  'eq.layers.smart.fullRange': 'Misurato · tutta la banda',
  'eq.layers.smart.range': 'Misurato · da {low} a {high}',
  'eq.layers.remove': 'Rimuovi il livello {layer}',
  'eq.layers.clearReference':
    'Cancella il modello di riferimento e le bande che ha prodotto',
  'eq.layers.clearSmart':
    'Rimuove la correzione misurata. Le tue bande e il riferimento restano.',
  'eq.fromFlat': 'Da piatto',
  'eq.fromFlat.hint':
    'Scarta la precedente correzione dell’EQ intelligente prima di ascoltare. Serve quando un taglio già presente sta nascondendo proprio la zona su cui agisce: la misura non vede attraverso la propria correzione. Le tue bande non vengono mai toccate.',
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
  'voicing.none': 'Nessuno',
  'voicing.none.hint': 'Solo le tue bande di EQ, senza nulla sopra',
  'voicing.strength': 'Intensità',
  'voicing.off': 'Niente',
  'voicing.full': 'Massima',
  'voicing.inert': 'Allo 0% di intensità questo carattere non fa nulla.',
  'voicing.headroom':
    'Aggiunge fino a +{peak} dB. Normalizza automaticamente riserva il margine; lascialo attivo a meno che tu non regoli la preamplificazione a mano.',

  'support.eyebrow': 'DEL TUTTO FACOLTATIVO',

  'support.petHint': 'Premi spazio per farlo saltare',

  'support.game.hint': 'Premi a tempo quando il picco raggiunge la linea',

  'support.game.howTo':
    'Tocca la creatura o premi spazio a ogni battito. Continua così e a ×10 succede qualcosa.',

  'support.game.thanks':
    'Se qualcosa qui ti ha strappato un sorriso, idee e sostegno sono ciò che lo tiene vivo.',

  'support.game.noAudio': 'Metti della musica e il ritmo comparirà qui',

  'support.game.listening': 'Cerco il ritmo…',

  'support.game.best': 'Record',

  'support.game.share': 'Condividi',

  'support.game.shareEuphoria': "Condividi l'euforia",

  'support.game.shareTitle': 'Condividi il tuo punteggio',

  'support.game.shareNote':
    "Salva la scheda e allegala al post: nessuna di queste reti può ricavare un'immagine da un link.",

  'support.game.shareSave': 'Salva scheda',

  'support.game.shareCopy': 'Copia testo',

  'support.game.shareCopied': 'Copiato',

  'support.game.shareLinkOnly':
    'Condivide solo il link: incolla il testo tu stesso',

  'support.game.euphoria': 'Modalità euforia',

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
};

export default it;
