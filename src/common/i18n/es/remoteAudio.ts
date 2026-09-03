/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Compartir',
  'remoteAudio.eyebrow': 'ENLACE DE AUDIO LAN',
  'remoteAudio.title': 'Escucha aquí tus otros ordenadores',
  'remoteAudio.subtitle':
    'Usa como receptor el ordenador que tiene los auriculares. Cualquier cantidad de ordenadores con FluidEQ en la misma red local puede conectarse y enviar aquí el audio del sistema.',
  'remoteAudio.security': 'Propiedades de la conexión',
  'remoteAudio.badge.local': 'Solo red local',
  'remoteAudio.badge.lossless': 'PCM de 32 bits sin pérdidas',
  'remoteAudio.badge.encrypted': 'Cifrado AES-256',
  'remoteAudio.listen.kicker': 'ORDENADOR B · AURICULARES',
  'remoteAudio.listen.title': 'Reproducir audio en este ordenador',
  'remoteAudio.listen.body':
    'Elige los auriculares o altavoces conectados aquí y comparte el código de emparejamiento con cada ordenador que quieras escuchar.',
  'remoteAudio.listen.start': 'Empezar a escuchar',
  'remoteAudio.listen.activeTitle': 'Este ordenador está escuchando',
  'remoteAudio.listen.stop': 'Dejar de escuchar',
  'remoteAudio.send.kicker': 'ORDENADOR A · FUENTE',
  'remoteAudio.send.title': 'Enviar el audio de este ordenador',
  'remoteAudio.send.body':
    'Pega un código del ordenador con los auriculares. FluidEQ envía el audio de retorno del sistema sin compresión.',
  'remoteAudio.send.codeLabel': 'Código del ordenador con los auriculares',
  'remoteAudio.send.codePlaceholder': 'Pega FLUIDEQ-LAN-1…',
  'remoteAudio.send.start': 'Empezar a enviar',
  'remoteAudio.send.activeTitle': 'Enviando audio del sistema',
  'remoteAudio.send.activeBody':
    'Mantén FluidEQ abierto en ambos ordenadores. El receptor reproduce este flujo sin pérdidas junto con los demás emisores conectados.',
  'remoteAudio.send.stop': 'Dejar de enviar',
  'remoteAudio.output.label': 'Reproducir por',
  'remoteAudio.output.default': 'Salida de audio predeterminada',
  'remoteAudio.output.unnamed': 'Salida de audio {number}',
  'remoteAudio.status.preparing': 'Preparando…',
  'remoteAudio.status.waiting': 'Esperando ordenadores',
  'remoteAudio.status.connecting': 'Conectando…',
  'remoteAudio.status.connectedOne': '{count} ordenador conectado',
  'remoteAudio.status.connectedMany': '{count} ordenadores conectados',
  'remoteAudio.status.sending': 'Enviando audio sin pérdidas',
  'remoteAudio.status.playbackBlocked': 'Pulsa Reanudar para oír el audio',
  'remoteAudio.status.disconnected': 'El receptor se desconectó',
  'remoteAudio.code.title': 'Emparejar otros ordenadores',
  'remoteAudio.code.hint':
    'Copia un código en cada emisor. El mismo código conecta varios ordenadores mientras el receptor siga activo. Si aparecen varias direcciones, usa la red que compartan ambos ordenadores.',
  'remoteAudio.code.copy': 'Copiar código',
  'remoteAudio.code.copied': 'Copiado',
  'remoteAudio.code.forAddress': 'Código de emparejamiento para {address}',
  'remoteAudio.resume': 'Reanudar audio',
  'remoteAudio.note.title': 'Empieza con poco volumen.',
  'remoteAudio.note.body':
    'Varios ordenadores se mezclan y el volumen puede subir rápidamente. Baja el volumen de los auriculares antes de la primera conexión. Al detener el receptor, su código queda invalidado de inmediato.',
  'remoteAudio.error.lan':
    'FluidEQ no pudo abrir esa conexión local. Comprueba que ambos ordenadores estén en la misma red privada y que el firewall permita FluidEQ.',
  'remoteAudio.error.capture':
    'FluidEQ no pudo capturar el audio del sistema. Comprueba el dispositivo de salida actual, detén la sesión e inténtalo de nuevo.',
  'remoteAudio.error.connection':
    'La conexión de audio cifrada se detuvo. Detén esta sesión y vuelve a conectarte con un código actual.',
};

export default remoteAudio;
