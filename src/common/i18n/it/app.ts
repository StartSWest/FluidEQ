/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** The shell around everything: menus, tabs, updates, config, notices. */
import { Dictionary } from '../en';

const app: Partial<Dictionary> = {
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
  'app.menu.fix': 'Correggi',
  'app.menu.reportProblem': 'Segnala un problema',
  'app.menu.about': 'Informazioni su {product}…',
  'app.processes.menu': 'Processi…',
  'app.processes.eyebrow': 'Processi',
  'app.processes.hint':
    "Windows chiama ognuno di questi come l'app, perché sono lo stesso programma. Questo è ciò che ciascuno fa davvero.",
  'app.processes.process': 'Processo',
  'app.processes.pid': 'PID',
  'app.processes.memory': 'Memoria',
  'app.processes.cpu': 'CPU',
  'app.processes.thisWindow': 'questa finestra',
  'app.processes.total': '{megabytes} MB in totale.',
  'app.processes.kindMain': 'Principale',
  'app.processes.kindWindow': 'Finestra',
  'app.processes.kindGpu': 'GPU',
  'app.processes.kindUtility': 'Servizio',
  'app.processes.kindDsp': 'Motore DSP (C++)',
  'app.menu.reinstallApp': 'Reinstalla {product}…',
  'app.menu.fixAudio': 'Risolvi problemi audio…',
  'app.menu.reinstallApo': 'Reinstalla Equalizer APO…',
  'whatsNew.eyebrow': 'NOTE DI RILASCIO',
  'whatsNew.title': 'Novità di FluidEQ',
  'whatsNew.loading': 'Caricamento delle note di rilascio…',
  'whatsNew.missing':
    'Le note di rilascio non si trovano in questa build. Sono anche su GitHub.',
  'whatsNew.ok': 'OK',
  'app.menu.whatsNew': 'Novità',
  'app.menu.language': 'Lingua',
  'app.window.minimize': 'Riduci a icona',
  'app.window.maximize': 'Ingrandisci',
  'app.window.restore': 'Ripristina',
  'app.window.close': 'Chiudi',
  'app.tray.open': 'Apri {product}',
  'app.tray.quit': 'Esci da {product}',
  'app.tray.tooltip': '{product} — ancora in esecuzione',
  'app.tray.installUpdate': 'Installa aggiornamento e riavvia',
  'app.tray.checkForUpdates': 'Verifica aggiornamenti',
  'app.tray.tooltip.updateReady':
    '{product} — aggiornamento pronto per l’installazione',
  'app.notification.updateReady.title': 'Aggiornamento FluidEQ pronto',
  'app.notification.updateReady.body':
    'La versione {version} è pronta. Fai clic per riavviare FluidEQ.',
  'app.notification.updateReady.bodyNoVersion':
    'Un aggiornamento è pronto. Fai clic per riavviare FluidEQ.',
  'app.notification.upToDate.title': 'FluidEQ è aggiornato',
  'app.notification.upToDate.body': 'Hai già la versione più recente.',
  'app.notification.updateFound.title': 'Aggiornamento FluidEQ trovato',
  'app.notification.updateFound.body':
    'La versione {version} è in download. Ti avviseremo quando sarà pronta da installare.',
  'app.notification.checkFailed.title':
    'Impossibile verificare gli aggiornamenti',
  'app.notification.checkFailed.body':
    'Il server degli aggiornamenti non è raggiungibile. FluidEQ riproverà più tardi.',
  'app.notification.installFailed.title':
    'Impossibile installare l’aggiornamento',
  'app.notification.installFailed.body':
    'FluidEQ non è riuscito ad avviare il programma di installazione. Fai clic per aprire FluidEQ e riprovare.',
  'app.window.minimizeApp': 'Riduci a icona FluidEQ',
  'app.window.maximizeApp': 'Ingrandisci FluidEQ',
  'app.window.restoreApp': 'Ripristina FluidEQ',
  'app.window.closeApp': 'Chiudi FluidEQ',
  'app.media.previous': 'Traccia precedente',
  'app.media.playPause': 'Riproduci o metti in pausa',
  'app.media.next': 'Traccia successiva',
  'app.media.previousAria': 'Traccia precedente, ovunque su questo computer',
  'app.media.playPauseAria':
    'Riproduci o metti in pausa, ovunque su questo computer',
  'app.media.nextAria': 'Traccia successiva, ovunque su questo computer',
  'app.dismiss': 'Chiudi',
  'common.search': 'Cerca…',
  'common.recentSearches': 'Ricerche recenti',
  'common.clearRecentSearches': 'Cancella ricerche recenti',
  'common.clearSearch': 'Cancella la ricerca',
  'common.noMatches': 'Nessun risultato',
  'common.filterOptions': 'Filtra opzioni',
  'common.increase': 'Aumenta {item}',
  'common.decrease': 'Riduci {item}',
  'common.icon.edit': 'Modifica',
  'common.icon.delete': 'Elimina',
  'common.icon.trash': 'Rimuovi',
  'common.icon.accept': 'Accetta',
  'common.icon.cancel': 'Annulla',
  'tabs.aria': 'Area di lavoro del suono',
  'tabs.eq': 'EQ',
  'tabs.eqMain': 'Bande',
  'tabs.presets': 'Preset EQ',
  'tabs.voicing': 'Carattere',
  'tabs.convolution': 'Convoluzione',
  'tabs.config': 'Config',
  'tabs.media': 'Media online',
  'tabs.mediaShort': 'Media',
  'tabs.karaoke': 'Karaoke',
  'tabs.scrollBack': 'Scorri le schede indietro',
  'tabs.scrollForward': 'Scorri le schede avanti',
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
  'update.mandatory.title': 'Questa versione va aggiornata',
  'update.mandatory.body':
    'Questa versione risolve un problema abbastanza serio da sconsigliare che FluidEQ continui a funzionare così com’è. L’aggiornamento è in scaricamento.',
  'update.mandatory.notOptional':
    'Non è un aggiornamento facoltativo. Puoi chiudere questo avviso e finire quello che stai facendo: tornerà finché FluidEQ non sarà aggiornato.',
  'update.mandatory.later': 'Non ora',
  'update.mandatory.waiting': 'Recupero dell’aggiornamento…',
  'update.mandatory.readyPrompt':
    'L’aggiornamento è stato scaricato. FluidEQ si chiuderà durante l’installazione e si riaprirà subito dopo.',
  'update.mandatory.install': 'Installa e riavvia',
  'update.mandatory.installing': 'Installazione…',
  'update.mandatory.failedDownload':
    'Non è stato possibile scaricare l’aggiornamento. O il server di download non era raggiungibile, o la connessione si è interrotta a metà.',
  'update.mandatory.failedInstall':
    'L’aggiornamento è stato scaricato, ma il programma di installazione non è partito. Windows potrebbe averlo rifiutato, oppure il file scaricato è danneggiato.',
  'update.mandatory.manual':
    'Puoi anche installarlo a mano: scarica l’ultima versione dalla pagina delle release ed eseguila. Impostazioni e profili restano al loro posto.',
  'update.mandatory.releasePage': 'Apri la pagina di download',
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
  'config.layers.noFile': 'Senza file proprio',
  'config.layers.inFile': 'Scritto in questo file, non in uno proprio.',
  'config.empty': 'Non include nulla: questa uscita resta intatta.',
  'config.file.missing': 'assente',
  'config.export': 'Esporta catena',
  'config.import': 'Importa catena',
  'config.import.hint':
    'L’importazione si applica all’uscita che stai ascoltando.',
  'config.import.customSkipped':
    'File personale del mittente ignorato: una riga Include: o Plugin: caricherebbe codice nell’audio di Windows.',
  'config.file.yours': 'tuo',
  'config.hint.custom': 'È tuo. Non viene mai sovrascritto.',
  'config.hint.generated': 'Generato: riscritto alla prossima modifica.',
  'config.hint.saving':
    'Salvando si scrive il file; Equalizer APO lo recepisce.',
  'config.edit': 'Modifica',
  'config.cancel': 'Annulla',
  'config.save': 'Salva',
  'disclaimer.heading': 'Nessuna garanzia e nessuna responsabilità',
  'disclaimer.asIs':
    'FluidEQ è fornito così com’è, senza alcuna garanzia. Nessuno promette che funzioni, che vada bene per quello che vuoi farci, né che continuerà a funzionare. È quanto dicono le sezioni 15 e 16 della GNU General Public License, e vale sia che questa copia ti sia stata data sia che l’abbia pagata.',
  'disclaimer.liability':
    'FluidEQ cambia il modo in cui l’audio viene elaborato sul tuo computer e installa e comanda Equalizer APO, un programma separato che gira con diritti di amministratore e si inserisce nel percorso audio di Windows. Nella massima misura consentita dalla legge, {author} non risponde di alcun danno derivante dall’uso: al tuo udito, a diffusori, cuffie o altre apparecchiature, a dati o ad altri programmi, né a nient’altro, comprese le perdite che non avresti potuto prevedere.',
  'disclaimer.volume':
    'Il suono può essere forte, e l’equalizzazione può renderlo più forte di quanto fosse il materiale originale. Abbassa il volume prima di cambiare un’impostazione, e rialzalo dopo.',
  'disclaimer.localLaw':
    'Alcuni Paesi non consentono a un venditore di escludere certe garanzie o responsabilità. Dove è così, valgono quelle regole e questo avviso non ti toglie i diritti che la legge ti riconosce.',
  'disclaimer.accepting': 'Usando FluidEQ accetti quanto sopra.',
  'disclaimer.language':
    'Questo avviso è stato scritto in inglese. Se una traduzione differisce dal testo inglese, prevale il testo inglese.',
  'disclaimer.accept': 'Ho capito e accetto',
  'disclaimer.decline': 'Esci',
  'provenance.heading': 'Verifica da dove proviene questa copia',
  'provenance.body':
    'Il programma di installazione ufficiale firmato di FluidEQ viene distribuito soltanto tramite fluideq.com. Le build dal codice sorgente devono provenire dal repository ufficiale. La GPL consente a terzi di copiare, modificare, ricompilare e vendere FluidEQ, ma le loro build non sono automaticamente firmate, riviste, supportate o approvate da FluidEQ. Se un download afferma di essere ufficiale e non ha una firma digitale di Windows valida, chiudilo e segnalalo.',
  'provenance.site': 'Sito ufficiale: fluideq.com',
  'provenance.repository': 'Codice ufficiale: github.com/StartSWest/FluidEQ',
  'language.title': 'Lingua',
  'language.aria': 'Lingua dell’interfaccia',
};

export default app;
