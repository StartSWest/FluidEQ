/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Condividi audio',
  'remoteAudio.eyebrow': 'COLLEGAMENTO AUDIO LAN',
  'remoteAudio.title': 'Ascolta qui gli altri computer',
  'remoteAudio.subtitle':
    'Scegli un ruolo per questo computer. Il ricevitore è il PC con le cuffie; gli altri possono collegarsi come mittenti.',
  'remoteAudio.choose': 'Scegli il ruolo di questo computer',
  'remoteAudio.security': 'Proprietà della connessione',
  'remoteAudio.badge.local': 'Solo LAN privata',
  'remoteAudio.badge.lossless': 'Trasporto PCM Float32 senza perdite',
  'remoteAudio.badge.encrypted': 'Crittografia AES-256-GCM',
  'remoteAudio.listen.kicker': 'RICEVITORE · SERVER',
  'remoteAudio.listen.title': 'Riproduci l’audio su questo computer',
  'remoteAudio.listen.body':
    'Usalo sul computer collegato alle cuffie o agli altoparlanti. Accetta uno o più mittenti e li riproduce sull’uscita selezionata in FluidEQ.',
  'remoteAudio.listen.start': 'Crea codice di connessione',
  'remoteAudio.listen.activeTitle': 'Questo computer è in ascolto',
  'remoteAudio.listen.newCode': 'Crea nuovo codice',
  'remoteAudio.listen.stop': 'Interrompi ascolto',
  'remoteAudio.stream.title': 'Priorità dello streaming',
  'remoteAudio.stream.lossless': 'Entrambe inviano PCM senza perdite',
  'remoteAudio.stream.video.title': 'Video',
  'remoteAudio.stream.video.body':
    'Ritardo minimo per il labiale. Può interrompersi prima su Wi-Fi congestionato.',
  'remoteAudio.stream.video.buffer': 'Avvio ~30 ms',
  'remoteAudio.stream.music.title': 'Musica',
  'remoteAudio.stream.music.body':
    'Buffer di sicurezza maggiore per un ascolto senza interruzioni.',
  'remoteAudio.stream.music.buffer': 'Avvio ~240 ms',
  'remoteAudio.send.kicker': 'MITTENTE · CLIENT',
  'remoteAudio.send.title': 'Invia l’audio di questo computer',
  'remoteAudio.send.body':
    'Fallo su ogni computer che vuoi ascoltare. Incolla il codice mostrato sul computer con le cuffie.',
  'remoteAudio.send.codeLabel': 'Codice di connessione',
  'remoteAudio.send.codePlaceholder': 'Incolla FLUIDEQ-LAN-2…',
  'remoteAudio.send.start': 'Connetti e invia',
  'remoteAudio.send.activeTitle': 'Invio audio di sistema',
  'remoteAudio.send.activeBody':
    'Tieni FluidEQ aperto su entrambi i computer. Il ricevitore riproduce questo flusso senza perdita insieme a tutti gli altri mittenti collegati.',
  'remoteAudio.send.destination': 'Riproduzione su {name}',
  'remoteAudio.send.stop': 'Interrompi invio',
  'remoteAudio.send.readyHint':
    'Il codice salvato resta qui dopo l’interruzione.',
  'remoteAudio.status.preparing': 'Preparazione…',
  'remoteAudio.status.waiting': 'In attesa di computer',
  'remoteAudio.status.connecting': 'Connessione…',
  'remoteAudio.status.connectedOne': '{count} computer collegato',
  'remoteAudio.status.connectedMany': '{count} computer collegati',
  'remoteAudio.status.sending': 'Invio audio senza perdita',
  'remoteAudio.status.playbackBlocked': 'Premi Riprendi per ascoltare',
  'remoteAudio.status.disconnected': 'Ricevitore disconnesso',
  'remoteAudio.monitor.title': 'Connessione in tempo reale',
  'remoteAudio.monitor.inactive': 'Scegli un ruolo per iniziare',
  'remoteAudio.monitor.ready': 'Pronto per un codice di connessione',
  'remoteAudio.monitor.waveform': 'Forma d’onda dell’audio condiviso',
  'remoteAudio.monitor.waveformFor': 'Forma d’onda in tempo reale di {name}',
  'remoteAudio.monitor.buffer': 'Riproduzione {milliseconds} ms',
  'remoteAudio.monitor.sendQueue': 'Coda invio {milliseconds} ms',
  'remoteAudio.monitor.noRole': 'Nessun ruolo selezionato',
  'remoteAudio.monitor.noSources': 'Nessun computer sorgente connesso',
  'remoteAudio.monitor.waitingSource': 'In attesa di un mittente',
  'remoteAudio.monitor.outgoing': 'Audio inviato da questo computer',
  'remoteAudio.monitor.transmitting': 'Trasmissione',
  'remoteAudio.monitor.quiet': 'Silenzioso',
  'remoteAudio.monitor.peakLevel': 'Livello di picco audio in diretta',
  'remoteAudio.monitor.peak': 'Picco {decibels} dB',
  'remoteAudio.monitor.networkUsage': 'LAN: {megabits} Mb/s',
  'remoteAudio.monitor.networkHealthy': 'Rete stabile',
  'remoteAudio.monitor.networkQueued': '{milliseconds} ms in coda',
  'remoteAudio.code.title': 'Associa altri computer',
  'remoteAudio.code.hint':
    'Copia un codice in ogni mittente. L’associazione resta salvata quando chiudi l’app o riavvii il PC. Se compaiono più indirizzi, usa la rete condivisa dai due computer.',
  'remoteAudio.code.copy': 'Copia codice',
  'remoteAudio.code.copied': 'Copiato',
  'remoteAudio.code.forAddress': 'Codice di associazione per {address}',
  'remoteAudio.resume': 'Riprendi audio',
  'remoteAudio.note.title': 'Inizia a volume basso.',
  'remoteAudio.note.body':
    'Più computer vengono mixati e il volume può sommarsi rapidamente. Abbassa il volume delle cuffie prima della prima connessione. Solo un nuovo codice scollega le associazioni salvate.',
  'remoteAudio.error.lan':
    'FluidEQ non ha potuto aprire la connessione locale. Verifica che i due computer siano sulla stessa rete privata e che il firewall consenta FluidEQ.',
  'remoteAudio.error.capture':
    'FluidEQ non ha potuto acquisire l’audio di sistema. Controlla l’uscita corrente, interrompi e riprova.',
  'remoteAudio.error.playback':
    'FluidEQ non ha potuto avviare il motore audio senza perdita. Riavvia FluidEQ e riprova.',
  'remoteAudio.error.connection':
    'La connessione audio crittografata si è interrotta. Il codice salvato resta qui sotto; ricollegati quando il ricevitore è pronto.',
};

export default remoteAudio;
