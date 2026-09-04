/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Audio teilen',
  'remoteAudio.eyebrow': 'LAN-AUDIOVERBINDUNG',
  'remoteAudio.title': 'Andere Computer hier anhören',
  'remoteAudio.subtitle':
    'Wähle eine Rolle für diesen Computer. Der Empfänger ist der PC mit deinem Headset; alle anderen PCs können sich als Sender verbinden.',
  'remoteAudio.choose': 'Rolle dieses Computers wählen',
  'remoteAudio.security': 'Verbindungseigenschaften',
  'remoteAudio.badge.local': 'Nur lokales Netzwerk',
  'remoteAudio.badge.lossless': 'Verlustfreies 32-Bit-PCM',
  'remoteAudio.badge.encrypted': 'AES-256-verschlüsselt',
  'remoteAudio.listen.kicker': 'EMPFÄNGER · SERVER',
  'remoteAudio.listen.title': 'Audio auf diesem Computer wiedergeben',
  'remoteAudio.listen.body':
    'Verwende dies auf dem Computer mit Headset oder Lautsprechern. Er nimmt einen oder mehrere Sender an und spielt sie über die in FluidEQ ausgewählte Ausgabe ab.',
  'remoteAudio.listen.start': 'Verbindungscode erstellen',
  'remoteAudio.listen.activeTitle': 'Dieser Computer empfängt',
  'remoteAudio.listen.stop': 'Empfang beenden',
  'remoteAudio.send.kicker': 'SENDER · CLIENT',
  'remoteAudio.send.title': 'Audio dieses Computers senden',
  'remoteAudio.send.body':
    'Führe dies auf jedem Computer aus, den du hören möchtest. Füge den Code des Headset-Computers ein.',
  'remoteAudio.send.codeLabel': 'Verbindungscode',
  'remoteAudio.send.codePlaceholder': 'FLUIDEQ-LAN-2… einfügen',
  'remoteAudio.send.start': 'Verbinden und senden',
  'remoteAudio.send.activeTitle': 'Systemaudio wird gesendet',
  'remoteAudio.send.activeBody':
    'Lass FluidEQ auf beiden Computern geöffnet. Der Empfänger spielt diesen verlustfreien Stream zusammen mit allen anderen verbundenen Sendern ab.',
  'remoteAudio.send.destination': 'Wiedergabe auf {name}',
  'remoteAudio.send.stop': 'Senden beenden',
  'remoteAudio.status.preparing': 'Wird vorbereitet…',
  'remoteAudio.status.waiting': 'Warten auf Computer',
  'remoteAudio.status.connecting': 'Verbindung wird hergestellt…',
  'remoteAudio.status.connectedOne': '{count} Computer verbunden',
  'remoteAudio.status.connectedMany': '{count} Computer verbunden',
  'remoteAudio.status.sending': 'Verlustfreies Audio wird gesendet',
  'remoteAudio.status.playbackBlocked': 'Zum Hören Fortsetzen drücken',
  'remoteAudio.status.disconnected': 'Empfänger getrennt',
  'remoteAudio.monitor.title': 'Live-Verbindung',
  'remoteAudio.monitor.inactive': 'Wähle eine Rolle, um zu beginnen',
  'remoteAudio.monitor.ready': 'Bereit für einen Verbindungscode',
  'remoteAudio.monitor.waveform': 'Live-Wellenform des geteilten Audios',
  'remoteAudio.monitor.waveformFor': 'Live-Audiowellenform für {name}',
  'remoteAudio.monitor.buffer': '{milliseconds} ms Puffer',
  'remoteAudio.monitor.noRole': 'Keine Rolle ausgewählt',
  'remoteAudio.monitor.noSources': 'Keine Quell-Computer verbunden',
  'remoteAudio.monitor.waitingSource': 'Warten auf einen Sender',
  'remoteAudio.monitor.outgoing': 'Von diesem Computer gesendetes Audio',
  'remoteAudio.monitor.transmitting': 'Übertragung',
  'remoteAudio.monitor.quiet': 'Still',
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
  'remoteAudio.error.playback':
    'FluidEQ konnte die verlustfreie Audio-Engine nicht starten. Starte FluidEQ neu und versuche es erneut.',
  'remoteAudio.error.connection':
    'Die verschlüsselte Audioverbindung wurde beendet. Stoppe diese Sitzung und verbinde dich mit einem aktuellen Code erneut.',
};

export default remoteAudio;
