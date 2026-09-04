/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Compartilhar áudio',
  'remoteAudio.eyebrow': 'CONEXÃO DE ÁUDIO LAN',
  'remoteAudio.title': 'Ouça seus outros computadores aqui',
  'remoteAudio.subtitle':
    'Escolha uma função para este computador. O receptor é o PC com o fone; os outros podem se conectar como emissores.',
  'remoteAudio.choose': 'Escolha a função deste computador',
  'remoteAudio.security': 'Propriedades da conexão',
  'remoteAudio.badge.local': 'Somente rede local',
  'remoteAudio.badge.lossless': 'PCM de 32 bits sem perdas',
  'remoteAudio.badge.encrypted': 'Criptografia AES-256',
  'remoteAudio.listen.kicker': 'RECEPTOR · SERVIDOR',
  'remoteAudio.listen.title': 'Reproduzir áudio neste computador',
  'remoteAudio.listen.body':
    'Use isto no computador com o fone ou os alto-falantes. Ele aceita um ou mais emissores e os reproduz na saída selecionada no FluidEQ.',
  'remoteAudio.listen.start': 'Criar código de conexão',
  'remoteAudio.listen.activeTitle': 'Este computador está ouvindo',
  'remoteAudio.listen.stop': 'Parar de ouvir',
  'remoteAudio.send.kicker': 'EMISSOR · CLIENTE',
  'remoteAudio.send.title': 'Enviar o áudio deste computador',
  'remoteAudio.send.body':
    'Faça isto em cada computador que deseja ouvir. Cole o código mostrado no computador com o fone.',
  'remoteAudio.send.codeLabel': 'Código de conexão',
  'remoteAudio.send.codePlaceholder': 'Cole FLUIDEQ-LAN-2…',
  'remoteAudio.send.start': 'Conectar e enviar',
  'remoteAudio.send.activeTitle': 'Enviando áudio do sistema',
  'remoteAudio.send.activeBody':
    'Mantenha o FluidEQ aberto nos dois computadores. O receptor reproduz este fluxo sem perdas junto com todos os outros emissores conectados.',
  'remoteAudio.send.destination': 'Reproduzindo em {name}',
  'remoteAudio.send.stop': 'Parar de enviar',
  'remoteAudio.status.preparing': 'Preparando…',
  'remoteAudio.status.waiting': 'Aguardando computadores',
  'remoteAudio.status.connecting': 'Conectando…',
  'remoteAudio.status.connectedOne': '{count} computador conectado',
  'remoteAudio.status.connectedMany': '{count} computadores conectados',
  'remoteAudio.status.sending': 'Enviando áudio sem perdas',
  'remoteAudio.status.playbackBlocked': 'Pressione Retomar para ouvir',
  'remoteAudio.status.disconnected': 'Receptor desconectado',
  'remoteAudio.monitor.title': 'Conexão ao vivo',
  'remoteAudio.monitor.inactive': 'Escolha uma função para começar',
  'remoteAudio.monitor.ready': 'Pronto para um código de conexão',
  'remoteAudio.monitor.waveform': 'Forma de onda do áudio compartilhado',
  'remoteAudio.monitor.waveformFor': 'Forma de onda ao vivo de {name}',
  'remoteAudio.monitor.buffer': 'Buffer de {milliseconds} ms',
  'remoteAudio.monitor.noRole': 'Nenhuma função selecionada',
  'remoteAudio.monitor.noSources': 'Nenhum computador de origem conectado',
  'remoteAudio.monitor.waitingSource': 'Aguardando um emissor',
  'remoteAudio.monitor.outgoing': 'Áudio enviado por este computador',
  'remoteAudio.monitor.transmitting': 'Transmitindo',
  'remoteAudio.monitor.quiet': 'Silencioso',
  'remoteAudio.code.title': 'Parear outros computadores',
  'remoteAudio.code.hint':
    'Copie um código em cada emissor. O mesmo código conecta vários computadores enquanto o receptor estiver ativo. Se houver vários endereços, use a rede compartilhada pelos dois computadores.',
  'remoteAudio.code.copy': 'Copiar código',
  'remoteAudio.code.copied': 'Copiado',
  'remoteAudio.code.forAddress': 'Código de pareamento para {address}',
  'remoteAudio.resume': 'Retomar áudio',
  'remoteAudio.note.title': 'Comece com volume baixo.',
  'remoteAudio.note.body':
    'Vários computadores são mixados e o volume pode somar rapidamente. Abaixe o volume do fone antes da primeira conexão. Parar o receptor invalida o código imediatamente.',
  'remoteAudio.error.lan':
    'O FluidEQ não conseguiu abrir essa conexão local. Verifique se os dois computadores estão na mesma rede privada e se o firewall permite o FluidEQ.',
  'remoteAudio.error.capture':
    'O FluidEQ não conseguiu capturar o áudio do sistema. Verifique a saída atual, pare e tente novamente.',
  'remoteAudio.error.playback':
    'O FluidEQ não conseguiu iniciar o mecanismo de áudio sem perdas. Reinicie o FluidEQ e tente novamente.',
  'remoteAudio.error.connection':
    'A conexão de áudio criptografada parou. Encerre esta sessão e reconecte usando um código atual.',
};

export default remoteAudio;
