/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Compartir audio',
  'remoteAudio.eyebrow': 'ENLACE DE AUDIO LAN',
  'remoteAudio.title': 'Escucha aquí tus otros ordenadores',
  'remoteAudio.subtitle':
    'Elige una función para este ordenador. El receptor es el PC con tus auriculares; los demás pueden conectarse como emisores.',
  'remoteAudio.choose': 'Elige la función de este ordenador',
  'remoteAudio.security': 'Propiedades de la conexión',
  'remoteAudio.badge.local': 'Solo LAN privada',
  'remoteAudio.badge.lossless': 'Transporte PCM Float32 sin pérdidas',
  'remoteAudio.badge.encrypted': 'Cifrado AES-256-GCM',
  'remoteAudio.listen.kicker': 'RECEPTOR · SERVIDOR',
  'remoteAudio.listen.title': 'Reproducir audio en este ordenador',
  'remoteAudio.listen.body':
    'Úsalo en el ordenador con los auriculares o altavoces. Acepta uno o varios emisores y los reproduce por la salida seleccionada en FluidEQ.',
  'remoteAudio.listen.start': 'Crear código de conexión',
  'remoteAudio.listen.activeTitle': 'Este ordenador está escuchando',
  'remoteAudio.listen.newCode': 'Crear código nuevo',
  'remoteAudio.listen.stop': 'Dejar de escuchar',
  'remoteAudio.stream.title': 'Prioridad de transmisión',
  'remoteAudio.stream.lossless': 'Ambos envían PCM sin pérdidas',
  'remoteAudio.stream.video.title': 'Juego/Vídeo',
  'remoteAudio.stream.video.body':
    'Menor retardo para sincronizar labios. Puede entrecortarse antes con Wi-Fi saturado.',
  'remoteAudio.stream.video.buffer': 'Inicio ~100 ms',
  'remoteAudio.stream.music.title': 'Música',
  'remoteAudio.stream.music.body':
    'Mayor búfer de seguridad para escuchar sin cortes.',
  'remoteAudio.stream.music.buffer': 'Inicio ~240 ms',
  'remoteAudio.send.kicker': 'EMISOR · CLIENTE',
  'remoteAudio.send.title': 'Enviar el audio de este ordenador',
  'remoteAudio.send.body':
    'Haz esto en cada ordenador que quieras escuchar. Pega el código que muestra el ordenador con los auriculares.',
  'remoteAudio.send.codeLabel': 'Código de conexión',
  'remoteAudio.send.codePlaceholder': 'Pega FLUIDEQ-LAN-2…',
  'remoteAudio.send.start': 'Conectar y enviar',
  'remoteAudio.send.activeTitle': 'Enviando audio del sistema',
  'remoteAudio.send.activeBody':
    'Mantén FluidEQ abierto en ambos ordenadores. El receptor reproduce este flujo sin pérdidas junto con los demás emisores conectados.',
  'remoteAudio.send.destination': 'Reproduciendo en {name}',
  'remoteAudio.send.stop': 'Dejar de enviar',
  'remoteAudio.send.readyHint':
    'El código guardado permanece aquí después de detener.',
  'remoteAudio.status.preparing': 'Preparando…',
  'remoteAudio.status.waiting': 'Esperando ordenadores',
  'remoteAudio.status.connecting': 'Conectando…',
  'remoteAudio.status.connectedOne': '{count} ordenador conectado',
  'remoteAudio.status.connectedMany': '{count} ordenadores conectados',
  'remoteAudio.status.sending': 'Enviando audio sin pérdidas',
  'remoteAudio.status.playbackBlocked': 'Pulsa Reanudar para oír el audio',
  'remoteAudio.status.disconnected': 'El receptor se desconectó',
  'remoteAudio.monitor.title': 'Conexión en directo',
  'remoteAudio.monitor.inactive': 'Elige una función para empezar',
  'remoteAudio.monitor.ready': 'Listo para un código de conexión',
  'remoteAudio.monitor.waveform': 'Forma de onda del audio compartido',
  'remoteAudio.monitor.waveformFor': 'Forma de onda en directo de {name}',
  'remoteAudio.monitor.buffer': 'Reproducción {milliseconds} ms',
  'remoteAudio.monitor.sendQueue': 'Cola de envío {milliseconds} ms',
  'remoteAudio.monitor.noRole': 'Ninguna función seleccionada',
  'remoteAudio.monitor.noSources': 'No hay ordenadores emisores conectados',
  'remoteAudio.monitor.waitingSource': 'Esperando un emisor',
  'remoteAudio.monitor.outgoing': 'Audio enviado por este ordenador',
  'remoteAudio.monitor.transmitting': 'Transmitiendo',
  'remoteAudio.monitor.receiving': 'Recibiendo',
  'remoteAudio.monitor.quiet': 'En silencio',
  'remoteAudio.monitor.nowPlaying': 'Sonando',
  'remoteAudio.monitor.paused': 'En pausa',
  'remoteAudio.monitor.peakLevel': 'Nivel máximo de audio en directo',
  'remoteAudio.monitor.peak': 'Pico {decibels} dB',
  'remoteAudio.monitor.networkUsage': 'LAN: {megabits} Mb/s',
  'remoteAudio.monitor.networkHealthy': 'Red estable',
  'remoteAudio.monitor.networkQueued': '{milliseconds} ms en cola',
  'remoteAudio.code.title': 'Emparejar otros ordenadores',
  'remoteAudio.code.hint':
    'Copia un código en cada emisor. El emparejamiento queda guardado al cerrar la app o reiniciar el PC. Si aparecen varias direcciones, usa la red que compartan ambos ordenadores.',
  'remoteAudio.code.copy': 'Copiar código',
  'remoteAudio.code.copied': 'Copiado',
  'remoteAudio.code.forAddress': 'Código de emparejamiento para {address}',
  'remoteAudio.resume': 'Reanudar audio',
  'remoteAudio.note.title': 'Empieza con poco volumen.',
  'remoteAudio.note.body':
    'Varios ordenadores se mezclan y el volumen puede subir rápidamente. Baja el volumen de los auriculares antes de la primera conexión. Solo crear un código nuevo desconecta los emparejamientos guardados.',
  'remoteAudio.error.lan':
    'FluidEQ no pudo abrir esa conexión local. Comprueba que ambos ordenadores estén en la misma red privada y que el firewall permita FluidEQ.',
  'remoteAudio.error.capture':
    'FluidEQ no pudo capturar el audio del sistema. Comprueba el dispositivo de salida actual, detén la sesión e inténtalo de nuevo.',
  'remoteAudio.error.playback':
    'FluidEQ no pudo iniciar el motor de audio sin pérdidas. Reinicia FluidEQ e inténtalo de nuevo.',
  'remoteAudio.error.connection':
    'La conexión de audio cifrada se detuvo. El código guardado sigue abajo; reconecta cuando el receptor esté listo.',
};

export default remoteAudio;
