/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Audio teilen',
  'remoteAudio.eyebrow': 'LAN-AUDIOVERBINDUNG',
  'remoteAudio.title': 'Audio zwischen Ihren Computern teilen',
  'remoteAudio.subtitle':
    'Verbinden Sie zwei Computer, und jeder spielt den Ton des anderen. Jeder sendet seinen Ton unverändert; der Computer, an dem Sie hören, wendet seinen eigenen EQ, seine Kurven und DSP an.',
  'remoteAudio.security': 'Verbindungseigenschaften',
  'remoteAudio.badge.local': 'Nur privates LAN',
  'remoteAudio.badge.lossless': 'Verlustfreie Float32-PCM-Übertragung',
  'remoteAudio.badge.encrypted': 'AES-256-GCM-verschlüsselt',
  'remoteAudio.link.section': 'Computer verbinden',
  'remoteAudio.link.thisComputer': 'Dieser Computer',
  'remoteAudio.link.thisHint':
    'Fügen Sie diesen Code auf dem anderen Computer ein oder den Code des anderen Computers hier. Beides funktioniert.',
  'remoteAudio.link.or': 'oder',
  'remoteAudio.link.otherComputer': 'Code des anderen Computers',
  'remoteAudio.link.codeLabel': 'Verbindungscode',
  'remoteAudio.link.placeholder': 'FLUIDEQ-LAN-2… einfügen',
  'remoteAudio.link.start': 'Verbinden',
  'remoteAudio.link.otherHint':
    'Beide Computer spielen sich sofort gegenseitig. Schalten Sie später eine Richtung aus, wenn Sie nur eine möchten.',
  'remoteAudio.link.once':
    'Nur einmal nötig. Verbundene Computer finden sich nach einem Neustart von selbst wieder, von beiden Seiten.',
  'remoteAudio.rule.echoTitle': 'In beide Richtungen, ohne Echo',
  'remoteAudio.rule.echo':
    'Jeder Computer sendet nur, was er selbst abspielt — nie den Ton, den er empfängt —, sodass nichts zurückkommt.',
  'remoteAudio.rule.eqTitle': 'Ihr EQ dort, wo Sie hören',
  'remoteAudio.rule.eq':
    'Der Ton geht unverändert hinaus. Der Computer, an dem Sie ihn hören, wendet seinen EQ, seine Kopfhörerkurve und DSP an — einmal.',
  'remoteAudio.rule.steadyTitle': 'Stabil, ohne Abdriften',
  'remoteAudio.rule.steady':
    'Etwa 30 ms dahinter und dort gehalten: Die beiden Uhren laufen im Gleichschritt, ohne Aussetzer und ohne langsames Abdriften.',
  'remoteAudio.linked.section': 'Verbunden',
  'remoteAudio.linked.cardLabel': 'Verbindung mit {name}',
  'remoteAudio.linked.bothWays': 'In beide Richtungen',
  'remoteAudio.linked.incomingOnly': 'Nur eingehend',
  'remoteAudio.linked.outgoingOnly': 'Nur ausgehend',
  'remoteAudio.linked.paused': 'Pausiert',
  'remoteAudio.linked.looking': '{name} wird im Netzwerk gesucht…',
  'remoteAudio.linked.lossless': 'Verlustfrei',
  'remoteAudio.linked.unlink': 'Trennen',
  'remoteAudio.linked.noEcho':
    'Kein Echo: Der Ton von {name} wird nie dorthin zurückgeschickt.',
  'remoteAudio.linked.untouched':
    'Geht in beide Richtungen unverändert — jeder Computer wendet seinen eigenen EQ und DSP an.',
  'remoteAudio.lane.from': 'Von {name}',
  'remoteAudio.lane.to': 'An {name}',
  'remoteAudio.lane.playsHere': 'Spielt hier',
  'remoteAudio.lane.yourSound': 'Ihr Ton',
  'remoteAudio.lane.playItHere': 'Hier abspielen',
  'remoteAudio.lane.sendMySound': 'Meinen Ton senden',
  'remoteAudio.lane.delay': 'Verzögerung',
  'remoteAudio.lane.sent': 'gesendet',
  'remoteAudio.lane.milliseconds': '{milliseconds} ms',
  'remoteAudio.lane.megabits': '{megabits} Mbit/s',
  'remoteAudio.lane.receiving': 'Empfang läuft',
  'remoteAudio.lane.paused': 'Pausiert',
  'remoteAudio.lane.inQuiet': 'Auf {name} läuft nichts',
  'remoteAudio.lane.inOff':
    'Ausgeschaltet: Der Ton von {name} wird auf diesem Computer nicht abgespielt.',
  'remoteAudio.lane.inNotSent': 'Bei {name} ist „Meinen Ton senden“ aus.',
  'remoteAudio.lane.inOld':
    '{name} braucht das neueste FluidEQ, um seinen Ton hierher zu senden.',
  'remoteAudio.lane.inOneWay':
    'Wiedergabe in beide Richtungen erfordert Windows auf diesem Computer.',
  'remoteAudio.lane.outQuiet': 'Auf diesem Computer läuft nichts',
  'remoteAudio.lane.outOff': 'Senden aus. {name} hört diesen Computer nicht.',
  'remoteAudio.lane.outNotPlayed': 'Bei {name} ist „Hier abspielen“ aus.',
  'remoteAudio.lane.outOld':
    '{name} braucht das neueste FluidEQ, um den Ton dieses Computers abzuspielen.',
  'remoteAudio.lane.outOneWay':
    'Senden in beide Richtungen erfordert Windows auf diesem Computer.',
  'remoteAudio.lane.outFailed':
    'Der Ton dieses Computers konnte nicht aufgenommen werden. Schalten Sie „Meinen Ton senden“ aus und wieder ein, um es erneut zu versuchen.',
  'remoteAudio.another.section': 'Weiteren Computer verbinden',
  'remoteAudio.another.hub':
    'Fügen Sie den Code dieses Computers auf einem anderen Computer ein. Jeder verbundene Computer bekommt oben seine eigene Zeile.',
  'remoteAudio.another.spoke':
    'Um einen dritten Computer zu verbinden, fügen Sie dort den Code von {name} ein: Ein Computer verbindet sich mit dem, dessen Code er verwendet.',
  'remoteAudio.singlePlayer.title': 'Nur ein Player',
  'remoteAudio.singlePlayer.body':
    'gilt auch für verbundene Computer: Wird auf einem etwas gestartet, pausiert, was auf dem anderen lief.',
  'remoteAudio.code.copy': 'Code kopieren',
  'remoteAudio.code.copied': 'Kopiert',
  'remoteAudio.code.forAddress': 'Kopplungscode für {address}',
  'remoteAudio.status.preparing': 'Wird vorbereitet…',
  'remoteAudio.status.playbackBlocked': 'Zum Hören Fortsetzen drücken',
  'remoteAudio.resume': 'Audio fortsetzen',
  'remoteAudio.retry': 'Erneut versuchen',
  'remoteAudio.monitor.networkHealthy': 'Netzwerk stabil',
  'remoteAudio.monitor.networkQueued': '{milliseconds} ms in Warteschlange',
  'remoteAudio.note.title': 'Leise anfangen.',
  'remoteAudio.note.body':
    'Zwei gleichzeitig spielende Computer addieren sich. Drehen Sie die Lautstärke vor der ersten Verbindung herunter.',
  'remoteAudio.error.lan':
    'FluidEQ konnte die lokale Verbindung nicht öffnen. Prüfen Sie, ob beide Computer im selben privaten Netzwerk sind und die Firewall FluidEQ zulässt.',
  'remoteAudio.error.capture':
    'FluidEQ konnte den Systemton dieses Computers nicht aufnehmen. Prüfen Sie das aktuelle Ausgabegerät und versuchen Sie es erneut.',
  'remoteAudio.error.playback':
    'FluidEQ konnte die verlustfreie Audio-Engine nicht starten. Starten Sie FluidEQ neu und versuchen Sie es erneut.',
  'remoteAudio.error.connection':
    'Die verschlüsselte Audioverbindung wurde unterbrochen. FluidEQ sucht weiter nach dem anderen Computer und verbindet sich von selbst, sobald er wieder da ist.',
};

export default remoteAudio;
