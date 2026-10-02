/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Condividi audio',
  'remoteAudio.eyebrow': 'COLLEGAMENTO AUDIO LAN',
  'remoteAudio.title': 'Ascolta qui gli altri computer',
  'remoteAudio.subtitle':
    'Collega due computer e ognuno riproduce il suono dell’altro. Ognuno invia il proprio suono intatto; il computer su cui ascolti applica il suo EQ, le sue curve e il suo DSP.',
  'remoteAudio.security': 'Proprietà della connessione',
  'remoteAudio.badge.local': 'Solo LAN privata',
  'remoteAudio.badge.lossless': 'Trasporto PCM Float32 senza perdite',
  'remoteAudio.badge.encrypted': 'Crittografia AES-256-GCM',
  'remoteAudio.link.section': 'Collega un computer',
  'remoteAudio.link.thisComputer': 'Questo computer',
  'remoteAudio.link.thisHint':
    'Incolla questo codice sull’altro computer, oppure incolla qui il codice di quel computer. Funziona in entrambi i modi.',
  'remoteAudio.link.or': 'o',
  'remoteAudio.link.otherComputer': 'Codice dell’altro computer',
  'remoteAudio.link.codeLabel': 'Codice di connessione',
  'remoteAudio.link.placeholder': 'Incolla FLUIDEQ-LAN-2…',
  'remoteAudio.link.start': 'Collega',
  'remoteAudio.link.otherHint':
    'I due computer si riproducono a vicenda subito. Più tardi spegni una direzione se te ne serve solo una.',
  'remoteAudio.link.once':
    'Basta una volta. I computer collegati si ritrovano dopo un riavvio, da entrambi i lati.',
  'remoteAudio.rule.echoTitle': 'In entrambe le direzioni, senza eco',
  'remoteAudio.rule.echo':
    'Ogni computer invia solo ciò che riproduce lui stesso — mai il suono che riceve —, così niente torna indietro.',
  'remoteAudio.rule.eqTitle': 'Il tuo EQ dove ascolti',
  'remoteAudio.rule.eq':
    'Il suono parte intatto. Il computer su cui lo ascolti applica il suo EQ, la curva delle cuffie e il DSP, una volta sola.',
  'remoteAudio.rule.steadyTitle': 'Stabile, senza deriva',
  'remoteAudio.rule.steady':
    'Circa 30 ms indietro e lì resta: i due orologi vanno a tempo, senza interruzioni né deriva lenta.',
  'remoteAudio.linked.section': 'Collegati',
  'remoteAudio.linked.cardLabel': 'Collegamento con {name}',
  'remoteAudio.linked.bothWays': 'In entrambe le direzioni',
  'remoteAudio.linked.incomingOnly': 'Solo in entrata',
  'remoteAudio.linked.outgoingOnly': 'Solo in uscita',
  'remoteAudio.linked.paused': 'In pausa',
  'remoteAudio.linked.looking': 'Cerco {name} nella tua rete…',
  'remoteAudio.linked.lossless': 'Senza perdita',
  'remoteAudio.linked.unlink': 'Scollega',
  'remoteAudio.linked.noEcho':
    'Niente eco: il suono di {name} non gli viene mai rimandato.',
  'remoteAudio.linked.untouched':
    'Parte intatto in entrambe le direzioni: ogni computer applica il proprio EQ e DSP.',
  'remoteAudio.lane.from': 'Da {name}',
  'remoteAudio.lane.to': 'A {name}',
  'remoteAudio.lane.playsHere': 'Suona qui',
  'remoteAudio.lane.yourSound': 'Il tuo suono',
  'remoteAudio.lane.playItHere': 'Riproduci qui',
  'remoteAudio.lane.sendMySound': 'Invia il mio suono',
  'remoteAudio.lane.delay': 'ritardo',
  'remoteAudio.lane.sent': 'inviato',
  'remoteAudio.lane.milliseconds': '{milliseconds} ms',
  'remoteAudio.lane.megabits': '{megabits} Mb/s',
  'remoteAudio.lane.receiving': 'In ricezione',
  'remoteAudio.lane.paused': 'In pausa',
  'remoteAudio.lane.inQuiet': 'Niente in riproduzione su {name}',
  'remoteAudio.lane.inOff':
    'Spento: il suono di {name} non suona su questo computer.',
  'remoteAudio.lane.inNotSent': '{name} ha «Invia il mio suono» spento.',
  'remoteAudio.lane.inOld':
    '{name} ha bisogno dell’ultima versione di FluidEQ per inviare qui il suo suono.',
  'remoteAudio.lane.inOneWay':
    'Per riprodurre in entrambe le direzioni questo computer ha bisogno di Windows.',
  'remoteAudio.lane.outQuiet': 'Niente in riproduzione su questo computer',
  'remoteAudio.lane.outOff': 'Invio spento. {name} non sente questo computer.',
  'remoteAudio.lane.outNotPlayed': '{name} ha «Riproduci qui» spento.',
  'remoteAudio.lane.outOld':
    '{name} ha bisogno dell’ultima versione di FluidEQ per riprodurre il suono di questo computer.',
  'remoteAudio.lane.outOneWay':
    'Per inviare in entrambe le direzioni questo computer ha bisogno di Windows.',
  'remoteAudio.lane.outFailed':
    'Non è stato possibile catturare il suono di questo computer. Spegni e riaccendi «Invia il mio suono» per riprovare.',
  'remoteAudio.another.section': 'Collega un altro computer',
  'remoteAudio.another.hub':
    'Incolla il codice di questo computer su un altro computer. Ogni computer collegato ha la sua riga qui sopra.',
  'remoteAudio.another.spoke':
    'Per collegare un terzo computer, incolla lì il codice di {name}: un computer si collega a quello di cui usa il codice.',
  'remoteAudio.singlePlayer.title': 'Un solo lettore',
  'remoteAudio.singlePlayer.body':
    'vale anche per i computer collegati: avviare qualcosa su uno mette in pausa ciò che suonava sull’altro.',
  'remoteAudio.code.copy': 'Copia codice',
  'remoteAudio.code.copied': 'Copiato',
  'remoteAudio.code.forAddress': 'Codice di associazione per {address}',
  'remoteAudio.status.preparing': 'Preparazione…',
  'remoteAudio.status.playbackBlocked': 'Premi Riprendi per ascoltare',
  'remoteAudio.resume': 'Riprendi audio',
  'remoteAudio.retry': 'Riprova',
  'remoteAudio.monitor.networkHealthy': 'Rete stabile',
  'remoteAudio.monitor.networkQueued': '{milliseconds} ms in coda',
  'remoteAudio.note.title': 'Inizia a volume basso.',
  'remoteAudio.note.body':
    'Due computer che suonano insieme si sommano. Abbassa il volume prima del primo collegamento.',
  'remoteAudio.error.lan':
    'FluidEQ non ha potuto aprire la connessione locale. Verifica che i due computer siano sulla stessa rete privata e che il firewall consenta FluidEQ.',
  'remoteAudio.error.capture':
    'FluidEQ non ha potuto catturare l’audio di sistema di questo computer. Controlla il dispositivo di uscita attuale e riprova.',
  'remoteAudio.error.playback':
    'FluidEQ non ha potuto avviare il motore audio senza perdita. Riavvia FluidEQ e riprova.',
  'remoteAudio.error.connection':
    'La connessione audio cifrata si è interrotta. FluidEQ continua a cercare l’altro computer e si ricollega da solo quando torna.',
};

export default remoteAudio;
