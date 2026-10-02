/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Compartilhar áudio',
  'remoteAudio.eyebrow': 'CONEXÃO DE ÁUDIO LAN',
  'remoteAudio.title': 'Ouça seus outros computadores aqui',
  'remoteAudio.subtitle':
    'Vincule dois computadores e cada um toca o som do outro. Cada um envia o próprio som intacto; o computador em que você ouve aplica o próprio EQ, as curvas e o DSP.',
  'remoteAudio.security': 'Propriedades da conexão',
  'remoteAudio.badge.local': 'Somente LAN privada',
  'remoteAudio.badge.lossless': 'Transporte PCM Float32 sem perdas',
  'remoteAudio.badge.encrypted': 'Criptografia AES-256-GCM',
  'remoteAudio.link.section': 'Vincular um computador',
  'remoteAudio.link.thisComputer': 'Este computador',
  'remoteAudio.link.thisHint':
    'Cole este código no outro computador ou cole aqui o código daquele computador. Funciona dos dois jeitos.',
  'remoteAudio.link.or': 'ou',
  'remoteAudio.link.otherComputer': 'Código do outro computador',
  'remoteAudio.link.codeLabel': 'Código de conexão',
  'remoteAudio.link.placeholder': 'Cole FLUIDEQ-LAN-2…',
  'remoteAudio.link.start': 'Vincular',
  'remoteAudio.link.otherHint':
    'Os dois computadores tocam um ao outro na hora. Desligue uma direção depois se quiser só uma.',
  'remoteAudio.link.once':
    'Só uma vez. Computadores vinculados se encontram de novo depois de reiniciar, de qualquer um dos lados.',
  'remoteAudio.rule.echoTitle': 'Nos dois sentidos, sem eco',
  'remoteAudio.rule.echo':
    'Cada computador envia só o que ele mesmo toca — nunca o som que está recebendo —, então nada volta.',
  'remoteAudio.rule.eqTitle': 'Seu EQ onde você ouve',
  'remoteAudio.rule.eq':
    'O som sai intacto. O computador em que você o ouve aplica o EQ, a curva do fone e o DSP — uma vez só.',
  'remoteAudio.rule.steadyTitle': 'Estável, sem deriva',
  'remoteAudio.rule.steady':
    'Cerca de 30 ms atrás e mantido ali: os dois relógios andam juntos, sem cortes e sem deriva lenta.',
  'remoteAudio.linked.section': 'Vinculados',
  'remoteAudio.linked.cardLabel': 'Vínculo com {name}',
  'remoteAudio.linked.bothWays': 'Nos dois sentidos',
  'remoteAudio.linked.incomingOnly': 'Só entrada',
  'remoteAudio.linked.outgoingOnly': 'Só saída',
  'remoteAudio.linked.paused': 'Pausado',
  'remoteAudio.linked.looking': 'Procurando {name} na sua rede…',
  'remoteAudio.linked.lossless': 'Sem perdas',
  'remoteAudio.linked.unlink': 'Desvincular',
  'remoteAudio.linked.noEcho': 'Sem eco: o som de {name} nunca volta para ele.',
  'remoteAudio.linked.untouched':
    'Sai intacto nos dois sentidos — cada computador aplica o próprio EQ e DSP.',
  'remoteAudio.lane.from': 'De {name}',
  'remoteAudio.lane.to': 'Para {name}',
  'remoteAudio.lane.playsHere': 'Toca aqui',
  'remoteAudio.lane.yourSound': 'Seu som',
  'remoteAudio.lane.playItHere': 'Tocar aqui',
  'remoteAudio.lane.sendMySound': 'Enviar meu som',
  'remoteAudio.lane.delay': 'atraso',
  'remoteAudio.lane.sent': 'enviado',
  'remoteAudio.lane.milliseconds': '{milliseconds} ms',
  'remoteAudio.lane.megabits': '{megabits} Mb/s',
  'remoteAudio.lane.receiving': 'Recebendo',
  'remoteAudio.lane.paused': 'Pausado',
  'remoteAudio.lane.inQuiet': 'Nada tocando em {name}',
  'remoteAudio.lane.inOff':
    'Desligado: o som de {name} não toca neste computador.',
  'remoteAudio.lane.inNotSent': '{name} está com “Enviar meu som” desligado.',
  'remoteAudio.lane.inOld':
    '{name} precisa da versão mais recente do FluidEQ para enviar o som para cá.',
  'remoteAudio.lane.inOneWay':
    'Tocar nos dois sentidos exige Windows neste computador.',
  'remoteAudio.lane.outQuiet': 'Nada tocando neste computador',
  'remoteAudio.lane.outOff': 'Sem enviar. {name} não ouve este computador.',
  'remoteAudio.lane.outNotPlayed': '{name} está com “Tocar aqui” desligado.',
  'remoteAudio.lane.outOld':
    '{name} precisa da versão mais recente do FluidEQ para tocar o som deste computador.',
  'remoteAudio.lane.outOneWay':
    'Enviar nos dois sentidos exige Windows neste computador.',
  'remoteAudio.lane.outFailed':
    'Não foi possível capturar o som deste computador. Desligue e ligue “Enviar meu som” para tentar de novo.',
  'remoteAudio.another.section': 'Vincular outro computador',
  'remoteAudio.another.hub':
    'Cole o código deste computador em outro computador. Cada computador vinculado ganha a própria linha acima.',
  'remoteAudio.another.spoke':
    'Para vincular um terceiro computador, cole nele o código de {name}: um computador se vincula àquele cujo código ele usa.',
  'remoteAudio.singlePlayer.title': 'Um reprodutor de cada vez',
  'remoteAudio.singlePlayer.body':
    'vale também para computadores vinculados: começar algo em um pausa o que tocava no outro.',
  'remoteAudio.code.copy': 'Copiar código',
  'remoteAudio.code.copied': 'Copiado',
  'remoteAudio.code.forAddress': 'Código de pareamento para {address}',
  'remoteAudio.status.preparing': 'Preparando…',
  'remoteAudio.status.playbackBlocked': 'Pressione Retomar para ouvir',
  'remoteAudio.resume': 'Retomar áudio',
  'remoteAudio.retry': 'Tentar de novo',
  'remoteAudio.monitor.networkHealthy': 'Rede estável',
  'remoteAudio.monitor.networkQueued': '{milliseconds} ms na fila',
  'remoteAudio.note.title': 'Comece com volume baixo.',
  'remoteAudio.note.body':
    'Dois computadores tocando ao mesmo tempo se somam. Abaixe o volume antes do primeiro vínculo.',
  'remoteAudio.error.lan':
    'O FluidEQ não conseguiu abrir essa conexão local. Verifique se os dois computadores estão na mesma rede privada e se o firewall permite o FluidEQ.',
  'remoteAudio.error.capture':
    'O FluidEQ não conseguiu capturar o áudio do sistema deste computador. Verifique o dispositivo de saída atual e tente de novo.',
  'remoteAudio.error.playback':
    'O FluidEQ não conseguiu iniciar o mecanismo de áudio sem perdas. Reinicie o FluidEQ e tente novamente.',
  'remoteAudio.error.connection':
    'A conexão de áudio criptografada caiu. O FluidEQ continua procurando o outro computador e reconecta sozinho quando ele voltar.',
};

export default remoteAudio;
