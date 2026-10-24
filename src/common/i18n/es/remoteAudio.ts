/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'remoteAudio.group.title': 'Todo el grupo',
  'remoteAudio.group.mix': 'Tu mezcla',
  'remoteAudio.group.thisPC': 'Este PC',
  'remoteAudio.group.receive': 'Recibir',
  'remoteAudio.group.send': 'Enviar',
  'remoteAudio.group.share': 'Compartir',
  'remoteAudio.group.options': 'Opciones de {name}',
  'remoteAudio.group.count': '{count} equipos',
  'remoteAudio.group.sourceOff': 'Envío desactivado',
  'remoteAudio.group.offline': 'Sin conexión',
  'remoteAudio.group.unavailable': 'Volumen del sistema no disponible',
  'remoteAudio.group.mute': 'Silenciar este PC',
  'remoteAudio.group.unmute': 'Activar sonido de este PC',
  'remoteAudio.group.output': 'Salida',
  'remoteAudio.group.hint':
    'Vincula un equipo para unirte a su grupo. Cada equipo envía su propio sonido directamente a los demás; ajusta lo que escuchas en tu mezcla.',
  'tabs.share': 'Compartir audio',
  'remoteAudio.eyebrow': 'ENLACE DE AUDIO LAN',
  'remoteAudio.title': 'Escucha aquí tus otros ordenadores',
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
  'remoteAudio.link.many':
    'El mismo código enlaza cualquier número de ordenadores, y desenlazar uno deja enlazados a los demás.',
  'remoteAudio.rule.echoTitle': 'En las dos direcciones, sin eco',
  'remoteAudio.rule.echo':
    'Cada ordenador envía solo lo que reproduce él mismo —nunca el sonido que recibe—, así que nada vuelve.',
  'remoteAudio.rule.eqTitle': 'Tu EQ donde escuchas',
  'remoteAudio.rule.eq':
    'El sonido sale intacto. El ordenador en el que lo oyes aplica su EQ, su curva de auriculares y su DSP, una sola vez.',
  'remoteAudio.rule.steadyTitle': 'Estable, sin desfase',
  'remoteAudio.rule.steady':
    'Unos 30 ms por detrás y ahí se queda: los dos relojes van al compás, sin cortes y sin desfase lento.',
  'remoteAudio.linked.cardLabel': 'Enlace con {name}',
  'remoteAudio.linked.bothWays': 'En las dos direcciones',
  'remoteAudio.linked.incomingOnly': 'Solo entrante',
  'remoteAudio.linked.outgoingOnly': 'Solo saliente',
  'remoteAudio.linked.paused': 'En pausa',
  'remoteAudio.linked.lossless': 'Sin pérdida',
  'remoteAudio.linked.unlink': 'Desenlazar',
  'remoteAudio.linked.pause': 'Pausar',
  'remoteAudio.linked.resume': 'Reanudar',
  'remoteAudio.lane.inPaused':
    'En pausa. Aquí no suena nada hasta que reanudes.',
  'remoteAudio.lane.outPaused':
    'En pausa. No se envía nada hasta que reanudes.',
  'remoteAudio.lane.volume': 'Volumen del sonido de {name}',
  'remoteAudio.lane.pausedThere': '{name} puso el enlace en pausa.',
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
  'remoteAudio.lane.received': 'recibido',
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
    'Reproducir en las dos direcciones necesita Windows, o el FluidEQ Engine en Linux.',
  'remoteAudio.lane.outQuiet': 'No suena nada en este ordenador',
  'remoteAudio.lane.outOff': 'Sin enviar. {name} no oye este ordenador.',
  'remoteAudio.lane.outNotPlayed': '{name} tiene «Reproducir aquí» apagado.',
  'remoteAudio.lane.outOld':
    '{name} necesita la última versión de FluidEQ para reproducir el sonido de este ordenador.',
  'remoteAudio.lane.outOneWay':
    'Enviar en las dos direcciones necesita Windows, o el FluidEQ Engine en Linux.',
  'remoteAudio.lane.outFailed':
    'No se pudo capturar el sonido de este ordenador. Apaga y vuelve a encender «Enviar mi sonido» para intentarlo de nuevo.',
  'remoteAudio.another.section': 'Enlazar otro ordenador',
  'remoteAudio.singlePlayer.title': 'Un solo reproductor',
  'remoteAudio.singlePlayer.body':
    'también abarca los ordenadores enlazados: empezar algo en uno pausa lo que sonaba en el otro.',
  'remoteAudio.code.copy': 'Copiar código',
  'remoteAudio.code.copied': 'Copiado',
  'remoteAudio.code.label': 'Código de este ordenador',
  'remoteAudio.status.preparing': 'Preparando…',
  'remoteAudio.status.noNetwork':
    'Conecta este ordenador a una red para obtener su código.',
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
  'remoteAudio.error.code':
    'Eso no es un código de FluidEQ, o es el de este mismo ordenador. Copia el código de la página Compartir audio del otro ordenador.',
  'remoteAudio.error.capture':
    'FluidEQ no pudo capturar el audio del sistema de este ordenador. Revisa el dispositivo de salida actual e inténtalo de nuevo.',
  'remoteAudio.error.playback':
    'FluidEQ no pudo iniciar el motor de audio sin pérdidas. Reinicia FluidEQ e inténtalo de nuevo.',
  'remoteAudio.error.connection':
    'La conexión de audio cifrada se cortó. FluidEQ sigue buscando el otro ordenador y se reconecta solo cuando vuelve.',
};

export default remoteAudio;
