/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Condividi',
  'remoteAudio.eyebrow': 'COLLEGAMENTO AUDIO LAN',
  'remoteAudio.title': 'Ascolta qui gli altri computer',
  'remoteAudio.subtitle':
    'Usa come ricevitore il computer con le cuffie. Qualsiasi numero di computer FluidEQ sulla stessa rete locale può collegarsi e inviare qui l’audio di sistema.',
  'remoteAudio.security': 'Proprietà della connessione',
  'remoteAudio.badge.local': 'Solo rete locale',
  'remoteAudio.badge.lossless': 'PCM a 32 bit senza perdita',
  'remoteAudio.badge.encrypted': 'Crittografia AES-256',
  'remoteAudio.listen.kicker': 'COMPUTER B · CUFFIE',
  'remoteAudio.listen.title': 'Riproduci l’audio su questo computer',
  'remoteAudio.listen.body':
    'Scegli le cuffie o gli altoparlanti collegati qui e condividi il codice di associazione con ogni computer che vuoi ascoltare.',
  'remoteAudio.listen.start': 'Inizia ad ascoltare',
  'remoteAudio.listen.activeTitle': 'Questo computer è in ascolto',
  'remoteAudio.listen.stop': 'Interrompi ascolto',
  'remoteAudio.send.kicker': 'COMPUTER A · SORGENTE',
  'remoteAudio.send.title': 'Invia l’audio di questo computer',
  'remoteAudio.send.body':
    'Incolla un codice dal computer con le cuffie. FluidEQ invia il loopback audio di sistema senza compressione.',
  'remoteAudio.send.codeLabel': 'Codice dal computer con le cuffie',
  'remoteAudio.send.codePlaceholder': 'Incolla FLUIDEQ-LAN-1…',
  'remoteAudio.send.start': 'Inizia a inviare',
  'remoteAudio.send.activeTitle': 'Invio audio di sistema',
  'remoteAudio.send.activeBody':
    'Tieni FluidEQ aperto su entrambi i computer. Il ricevitore riproduce questo flusso senza perdita insieme a tutti gli altri mittenti collegati.',
  'remoteAudio.send.stop': 'Interrompi invio',
  'remoteAudio.output.label': 'Riproduci tramite',
  'remoteAudio.output.default': 'Uscita audio predefinita',
  'remoteAudio.output.unnamed': 'Uscita audio {number}',
  'remoteAudio.status.preparing': 'Preparazione…',
  'remoteAudio.status.waiting': 'In attesa di computer',
  'remoteAudio.status.connecting': 'Connessione…',
  'remoteAudio.status.connectedOne': '{count} computer collegato',
  'remoteAudio.status.connectedMany': '{count} computer collegati',
  'remoteAudio.status.sending': 'Invio audio senza perdita',
  'remoteAudio.status.playbackBlocked': 'Premi Riprendi per ascoltare',
  'remoteAudio.status.disconnected': 'Ricevitore disconnesso',
  'remoteAudio.code.title': 'Associa altri computer',
  'remoteAudio.code.hint':
    'Copia un codice in ogni mittente. Lo stesso codice collega più computer finché il ricevitore resta attivo. Se compaiono più indirizzi, usa la rete condivisa dai due computer.',
  'remoteAudio.code.copy': 'Copia codice',
  'remoteAudio.code.copied': 'Copiato',
  'remoteAudio.code.forAddress': 'Codice di associazione per {address}',
  'remoteAudio.resume': 'Riprendi audio',
  'remoteAudio.note.title': 'Inizia a volume basso.',
  'remoteAudio.note.body':
    'Più computer vengono mixati e il volume può sommarsi rapidamente. Abbassa il volume delle cuffie prima della prima connessione. Fermando il ricevitore, il codice viene invalidato subito.',
  'remoteAudio.error.lan':
    'FluidEQ non ha potuto aprire la connessione locale. Verifica che i due computer siano sulla stessa rete privata e che il firewall consenta FluidEQ.',
  'remoteAudio.error.capture':
    'FluidEQ non ha potuto acquisire l’audio di sistema. Controlla l’uscita corrente, interrompi e riprova.',
  'remoteAudio.error.connection':
    'La connessione audio crittografata si è interrotta. Ferma questa sessione e ricollegati con un codice aggiornato.',
};

export default remoteAudio;
