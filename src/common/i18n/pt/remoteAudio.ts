/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'Compartilhar',
  'remoteAudio.eyebrow': 'CONEXÃO DE ÁUDIO LAN',
  'remoteAudio.title': 'Ouça seus outros computadores aqui',
  'remoteAudio.subtitle':
    'Use como receptor o computador com o fone de ouvido. Qualquer quantidade de computadores com FluidEQ na mesma rede local pode entrar e enviar o áudio do sistema para cá.',
  'remoteAudio.security': 'Propriedades da conexão',
  'remoteAudio.badge.local': 'Somente rede local',
  'remoteAudio.badge.lossless': 'PCM de 32 bits sem perdas',
  'remoteAudio.badge.encrypted': 'Criptografia AES-256',
  'remoteAudio.listen.kicker': 'COMPUTADOR B · FONE',
  'remoteAudio.listen.title': 'Reproduzir áudio neste computador',
  'remoteAudio.listen.body':
    'Escolha o fone ou os alto-falantes conectados aqui e compartilhe o código de pareamento com cada computador que deseja ouvir.',
  'remoteAudio.listen.start': 'Começar a ouvir',
  'remoteAudio.listen.activeTitle': 'Este computador está ouvindo',
  'remoteAudio.listen.stop': 'Parar de ouvir',
  'remoteAudio.send.kicker': 'COMPUTADOR A · FONTE',
  'remoteAudio.send.title': 'Enviar o áudio deste computador',
  'remoteAudio.send.body':
    'Cole um código do computador com o fone. O FluidEQ envia o retorno de áudio do sistema sem compressão.',
  'remoteAudio.send.codeLabel': 'Código do computador com o fone',
  'remoteAudio.send.codePlaceholder': 'Cole FLUIDEQ-LAN-1…',
  'remoteAudio.send.start': 'Começar a enviar',
  'remoteAudio.send.activeTitle': 'Enviando áudio do sistema',
  'remoteAudio.send.activeBody':
    'Mantenha o FluidEQ aberto nos dois computadores. O receptor reproduz este fluxo sem perdas junto com todos os outros emissores conectados.',
  'remoteAudio.send.stop': 'Parar de enviar',
  'remoteAudio.output.label': 'Reproduzir em',
  'remoteAudio.output.default': 'Saída de áudio padrão',
  'remoteAudio.output.unnamed': 'Saída de áudio {number}',
  'remoteAudio.status.preparing': 'Preparando…',
  'remoteAudio.status.waiting': 'Aguardando computadores',
  'remoteAudio.status.connecting': 'Conectando…',
  'remoteAudio.status.connectedOne': '{count} computador conectado',
  'remoteAudio.status.connectedMany': '{count} computadores conectados',
  'remoteAudio.status.sending': 'Enviando áudio sem perdas',
  'remoteAudio.status.playbackBlocked': 'Pressione Retomar para ouvir',
  'remoteAudio.status.disconnected': 'Receptor desconectado',
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
  'remoteAudio.error.connection':
    'A conexão de áudio criptografada parou. Encerre esta sessão e reconecte usando um código atual.',
};

export default remoteAudio;
