/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Teilen',
  'remoteAudio.eyebrow': 'LAN-AUDIOVERBINDUNG',
  'remoteAudio.title': 'Andere Computer hier anhören',
  'remoteAudio.subtitle':
    'Der Computer mit dem Headset ist der Empfänger. Beliebig viele andere FluidEQ-Computer im selben lokalen Netzwerk können beitreten und ihren Systemton hierher senden.',
  'remoteAudio.security': 'Verbindungseigenschaften',
  'remoteAudio.badge.local': 'Nur lokales Netzwerk',
  'remoteAudio.badge.lossless': 'Verlustfreies 32-Bit-PCM',
  'remoteAudio.badge.encrypted': 'AES-256-verschlüsselt',
  'remoteAudio.listen.kicker': 'COMPUTER B · HEADSET',
  'remoteAudio.listen.title': 'Audio auf diesem Computer wiedergeben',
  'remoteAudio.listen.body':
    'Wähle das hier angeschlossene Headset oder die Lautsprecher und teile den Kopplungscode mit jedem Computer, den du hören möchtest.',
  'remoteAudio.listen.start': 'Empfang starten',
  'remoteAudio.listen.activeTitle': 'Dieser Computer empfängt',
  'remoteAudio.listen.stop': 'Empfang beenden',
  'remoteAudio.send.kicker': 'COMPUTER A · QUELLE',
  'remoteAudio.send.title': 'Audio dieses Computers senden',
  'remoteAudio.send.body':
    'Füge einen Code vom Headset-Computer ein. FluidEQ sendet den System-Loopback ohne Audiokompression.',
  'remoteAudio.send.codeLabel': 'Kopplungscode vom Headset-Computer',
  'remoteAudio.send.codePlaceholder': 'FLUIDEQ-LAN-1… einfügen',
  'remoteAudio.send.start': 'Senden starten',
  'remoteAudio.send.activeTitle': 'Systemaudio wird gesendet',
  'remoteAudio.send.activeBody':
    'Lass FluidEQ auf beiden Computern geöffnet. Der Empfänger spielt diesen verlustfreien Stream zusammen mit allen anderen verbundenen Sendern ab.',
  'remoteAudio.send.stop': 'Senden beenden',
  'remoteAudio.output.label': 'Wiedergabe über',
  'remoteAudio.output.default': 'Standard-Audioausgabe',
  'remoteAudio.output.unnamed': 'Audioausgabe {number}',
  'remoteAudio.status.preparing': 'Wird vorbereitet…',
  'remoteAudio.status.waiting': 'Warten auf Computer',
  'remoteAudio.status.connecting': 'Verbindung wird hergestellt…',
  'remoteAudio.status.connectedOne': '{count} Computer verbunden',
  'remoteAudio.status.connectedMany': '{count} Computer verbunden',
  'remoteAudio.status.sending': 'Verlustfreies Audio wird gesendet',
  'remoteAudio.status.playbackBlocked': 'Zum Hören Fortsetzen drücken',
  'remoteAudio.status.disconnected': 'Empfänger getrennt',
  'remoteAudio.code.title': 'Weitere Computer koppeln',
  'remoteAudio.code.hint':
    'Kopiere einen Code auf jeden Sender. Derselbe Code verbindet mehrere Computer, solange der Empfänger aktiv bleibt. Bei mehreren Adressen nimm das gemeinsame Netzwerk beider Computer.',
  'remoteAudio.code.copy': 'Code kopieren',
  'remoteAudio.code.copied': 'Kopiert',
  'remoteAudio.code.forAddress': 'Kopplungscode für {address}',
  'remoteAudio.resume': 'Audio fortsetzen',
  'remoteAudio.note.title': 'Leise anfangen.',
  'remoteAudio.note.body':
    'Mehrere Computer werden gemischt und ihre Lautstärke kann sich schnell addieren. Senke die Headset-Lautstärke vor der ersten Verbindung. Beim Stoppen des Empfängers wird sein Code sofort ungültig.',
  'remoteAudio.error.lan':
    'FluidEQ konnte die lokale Verbindung nicht öffnen. Prüfe, ob beide Computer im selben privaten Netzwerk sind und die Firewall FluidEQ zulässt.',
  'remoteAudio.error.capture':
    'FluidEQ konnte den Systemton dieses Computers nicht erfassen. Prüfe das aktuelle Ausgabegerät, stoppe und versuche es erneut.',
  'remoteAudio.error.connection':
    'Die verschlüsselte Audioverbindung wurde beendet. Stoppe diese Sitzung und verbinde dich mit einem aktuellen Code erneut.',
};

export default remoteAudio;
