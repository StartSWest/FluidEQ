/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': '共享',
  'remoteAudio.eyebrow': '局域网音频连接',
  'remoteAudio.title': '在这里收听其他电脑',
  'remoteAudio.subtitle':
    '将连接耳机的电脑设为接收端。同一局域网上任意数量的 FluidEQ 电脑都可加入，并将系统音频发送到这里。',
  'remoteAudio.security': '连接属性',
  'remoteAudio.badge.local': '仅限局域网',
  'remoteAudio.badge.lossless': '无损 32 位 PCM',
  'remoteAudio.badge.encrypted': 'AES-256 加密',
  'remoteAudio.listen.kicker': '电脑 B · 耳机',
  'remoteAudio.listen.title': '在此电脑上播放音频',
  'remoteAudio.listen.body':
    '选择连接到此电脑的耳机或扬声器，然后将配对码分享给每台要收听的电脑。',
  'remoteAudio.listen.start': '开始接收',
  'remoteAudio.listen.activeTitle': '此电脑正在接收',
  'remoteAudio.listen.stop': '停止接收',
  'remoteAudio.send.kicker': '电脑 A · 音源',
  'remoteAudio.send.title': '发送此电脑的音频',
  'remoteAudio.send.body':
    '粘贴耳机电脑生成的配对码。FluidEQ 会发送未经压缩的系统回环音频。',
  'remoteAudio.send.codeLabel': '耳机电脑的配对码',
  'remoteAudio.send.codePlaceholder': '粘贴 FLUIDEQ-LAN-1…',
  'remoteAudio.send.start': '开始发送',
  'remoteAudio.send.activeTitle': '正在发送系统音频',
  'remoteAudio.send.activeBody':
    '请在两台电脑上保持 FluidEQ 开启。接收端会将此无损音频流与其他已连接发送端一起播放。',
  'remoteAudio.send.stop': '停止发送',
  'remoteAudio.output.label': '播放到',
  'remoteAudio.output.default': '默认音频输出',
  'remoteAudio.output.unnamed': '音频输出 {number}',
  'remoteAudio.status.preparing': '正在准备…',
  'remoteAudio.status.waiting': '正在等待电脑',
  'remoteAudio.status.connecting': '正在连接…',
  'remoteAudio.status.connectedOne': '已连接 {count} 台电脑',
  'remoteAudio.status.connectedMany': '已连接 {count} 台电脑',
  'remoteAudio.status.sending': '正在发送无损音频',
  'remoteAudio.status.playbackBlocked': '按“恢复”即可听到音频',
  'remoteAudio.status.disconnected': '接收端已断开',
  'remoteAudio.code.title': '配对其他电脑',
  'remoteAudio.code.hint':
    '将一个代码复制到每个发送端。只要接收端保持开启，同一个代码可连接多台电脑。如果出现多个地址，请选择两台电脑共同使用的网络。',
  'remoteAudio.code.copy': '复制代码',
  'remoteAudio.code.copied': '已复制',
  'remoteAudio.code.forAddress': '{address} 的配对码',
  'remoteAudio.resume': '恢复音频',
  'remoteAudio.note.title': '请从低音量开始。',
  'remoteAudio.note.body':
    '多台电脑的声音会混合，音量可能很快叠加。首次连接前请降低耳机音量。停止接收后，配对码会立即失效。',
  'remoteAudio.error.lan':
    'FluidEQ 无法打开本地连接。请确认两台电脑位于同一专用网络，并且防火墙允许 FluidEQ。',
  'remoteAudio.error.capture':
    'FluidEQ 无法捕获此电脑的系统音频。请检查当前输出设备，然后停止并重试。',
  'remoteAudio.error.connection':
    '加密音频连接已停止。请停止此会话，并使用当前配对码重新连接。',
};

export default remoteAudio;
