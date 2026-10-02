/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Compartir audio',
  'remoteAudio.eyebrow': 'ENLACE DE AUDIO LAN',
  'remoteAudio.title': 'Escucha aquí tus otros ordenadores',
  'remoteAudio.subtitle':
    'Enlaza dos ordenadores y cada uno reproduce el sonido del otro. Cada uno envía su sonido intacto; el ordenador en el que escuchas aplica su propio EQ, curvas y DSP.',
  'remoteAudio.security': 'Propiedades de la conexión',
  'remoteAudio.badge.local': 'Solo LAN privada',
  'remoteAudio.badge.lossless': 'Transporte PCM Float32 sin pérdidas',
  'remoteAudio.badge.encrypted': 'Cifrado AES-256-GCM',
  'remoteAudio.link.section': 'Enlazar un ordenador',
  'remoteAudio.link.thisComputer': 'Este ordenador',
  'remoteAudio.link.thisHint':
    'Pega este código en el otro ordenador, o pega aquí el código de ese ordenador. Funciona de las dos maneras.',
  'remoteAudio.link.or': 'o',
  'remoteAudio.link.otherComputer': 'Código del otro ordenador',
  'remoteAudio.link.codeLabel': 'Código de conexión',
  'remoteAudio.link.placeholder': 'Pega FLUIDEQ-LAN-2…',
  'remoteAudio.link.start': 'Enlazar',
  'remoteAudio.link.otherHint':
    'Los dos ordenadores se reproducen al instante. Si solo quieres una dirección, apaga la otra más tarde.',
  'remoteAudio.link.once':
    'Solo una vez. Los ordenadores enlazados se vuelven a encontrar tras un reinicio, desde cualquiera de los dos.',
  'remoteAudio.rule.echoTitle': 'En las dos direcciones, sin eco',
  'remoteAudio.rule.echo':
    'Cada ordenador envía solo lo que reproduce él mismo —nunca el sonido que recibe—, así que nada vuelve.',
  'remoteAudio.rule.eqTitle': 'Tu EQ donde escuchas',
  'remoteAudio.rule.eq':
    'El sonido sale intacto. El ordenador en el que lo oyes aplica su EQ, su curva de auriculares y su DSP, una sola vez.',
  'remoteAudio.rule.steadyTitle': 'Estable, sin desfase',
  'remoteAudio.rule.steady':
    'Unos 30 ms por detrás y ahí se queda: los dos relojes van al compás, sin cortes y sin desfase lento.',
  'remoteAudio.linked.section': 'Enlazados',
  'remoteAudio.linked.cardLabel': 'Enlace con {name}',
  'remoteAudio.linked.bothWays': 'En las dos direcciones',
  'remoteAudio.linked.incomingOnly': 'Solo entrante',
  'remoteAudio.linked.outgoingOnly': 'Solo saliente',
  'remoteAudio.linked.paused': 'En pausa',
  'remoteAudio.linked.looking': 'Buscando {name} en tu red…',
  'remoteAudio.linked.lossless': 'Sin pérdida',
  'remoteAudio.linked.unlink': 'Desenlazar',
  'remoteAudio.linked.noEcho':
    'Sin eco: el sonido de {name} nunca se le devuelve.',
  'remoteAudio.linked.untouched':
    'Sale intacto en las dos direcciones: cada ordenador aplica su propio EQ y DSP.',
  'remoteAudio.lane.from': 'Desde {name}',
  'remoteAudio.lane.to': 'Hacia {name}',
  'remoteAudio.lane.playsHere': 'Suena aquí',
  'remoteAudio.lane.yourSound': 'Tu sonido',
  'remoteAudio.lane.playItHere': 'Reproducir aquí',
  'remoteAudio.lane.sendMySound': 'Enviar mi sonido',
  'remoteAudio.lane.delay': 'retardo',
  'remoteAudio.lane.sent': 'enviado',
  'remoteAudio.lane.milliseconds': '{milliseconds} ms',
  'remoteAudio.lane.megabits': '{megabits} Mb/s',
  'remoteAudio.lane.receiving': 'Recibiendo',
  'remoteAudio.lane.paused': 'En pausa',
  'remoteAudio.lane.inQuiet': 'No suena nada en {name}',
  'remoteAudio.lane.inOff':
    'Apagado: el sonido de {name} no suena en este ordenador.',
  'remoteAudio.lane.inNotSent': '{name} tiene «Enviar mi sonido» apagado.',
  'remoteAudio.lane.inOld':
    '{name} necesita la última versión de FluidEQ para enviar su sonido aquí.',
  'remoteAudio.lane.inOneWay':
    'Para reproducir en las dos direcciones, este ordenador necesita Windows.',
  'remoteAudio.lane.outQuiet': 'No suena nada en este ordenador',
  'remoteAudio.lane.outOff': 'Sin enviar. {name} no oye este ordenador.',
  'remoteAudio.lane.outNotPlayed': '{name} tiene «Reproducir aquí» apagado.',
  'remoteAudio.lane.outOld':
    '{name} necesita la última versión de FluidEQ para reproducir el sonido de este ordenador.',
  'remoteAudio.lane.outOneWay':
    'Para enviar en las dos direcciones, este ordenador necesita Windows.',
  'remoteAudio.lane.outFailed':
    'No se pudo capturar el sonido de este ordenador. Apaga y vuelve a encender «Enviar mi sonido» para intentarlo de nuevo.',
  'remoteAudio.another.section': 'Enlazar otro ordenador',
  'remoteAudio.another.hub':
    'Pega el código de este ordenador en otro ordenador. Cada ordenador enlazado tiene su propia fila arriba.',
  'remoteAudio.another.spoke':
    'Para enlazar un tercer ordenador, pega en él el código de {name}: un ordenador se enlaza con aquel cuyo código usa.',
  'remoteAudio.singlePlayer.title': 'Un solo reproductor',
  'remoteAudio.singlePlayer.body':
    'también abarca los ordenadores enlazados: empezar algo en uno pausa lo que sonaba en el otro.',
  'remoteAudio.code.copy': 'Copiar código',
  'remoteAudio.code.copied': 'Copiado',
  'remoteAudio.code.forAddress': 'Código de emparejamiento para {address}',
  'remoteAudio.status.preparing': 'Preparando…',
  'remoteAudio.status.playbackBlocked': 'Pulsa Reanudar para oír el audio',
  'remoteAudio.resume': 'Reanudar audio',
  'remoteAudio.retry': 'Reintentar',
  'remoteAudio.monitor.networkHealthy': 'Red estable',
  'remoteAudio.monitor.networkQueued': '{milliseconds} ms en cola',
  'remoteAudio.note.title': 'Empieza con poco volumen.',
  'remoteAudio.note.body':
    'Dos ordenadores sonando a la vez se suman. Baja el volumen antes del primer enlace.',
  'remoteAudio.error.lan':
    'FluidEQ no pudo abrir esa conexión local. Comprueba que ambos ordenadores estén en la misma red privada y que el firewall permita FluidEQ.',
  'remoteAudio.error.capture':
    'FluidEQ no pudo capturar el audio del sistema de este ordenador. Revisa el dispositivo de salida actual e inténtalo de nuevo.',
  'remoteAudio.error.playback':
    'FluidEQ no pudo iniciar el motor de audio sin pérdidas. Reinicia FluidEQ e inténtalo de nuevo.',
  'remoteAudio.error.connection':
    'La conexión de audio cifrada se cortó. FluidEQ sigue buscando el otro ordenador y se reconecta solo cuando vuelve.',
};

export default remoteAudio;
