/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': '共享音频',
  'remoteAudio.eyebrow': '局域网音频连接',
  'remoteAudio.title': '在这里收听其他电脑',
  'remoteAudio.subtitle':
    '为这台电脑选择一个角色。接收端是连接耳机的电脑；其他电脑可作为发送端连接。',
  'remoteAudio.choose': '选择这台电脑的角色',
  'remoteAudio.security': '连接属性',
  'remoteAudio.badge.local': '仅限局域网',
  'remoteAudio.badge.lossless': '无损 32 位 PCM',
  'remoteAudio.badge.encrypted': 'AES-256 加密',
  'remoteAudio.listen.kicker': '接收端 · 服务器',
  'remoteAudio.listen.title': '在此电脑上播放音频',
  'remoteAudio.listen.body':
    '在连接耳机或扬声器的电脑上使用此角色。它可接收一个或多个发送端，并通过 FluidEQ 中已选择的输出播放。',
  'remoteAudio.listen.start': '创建连接码',
  'remoteAudio.listen.activeTitle': '此电脑正在接收',
  'remoteAudio.listen.stop': '停止接收',
  'remoteAudio.send.kicker': '发送端 · 客户端',
  'remoteAudio.send.title': '发送此电脑的音频',
  'remoteAudio.send.body':
    '在每台想要收听的电脑上执行此操作。粘贴耳机电脑显示的连接码。',
  'remoteAudio.send.codeLabel': '连接码',
  'remoteAudio.send.codePlaceholder': '粘贴 FLUIDEQ-LAN-2…',
  'remoteAudio.send.start': '连接并发送',
  'remoteAudio.send.activeTitle': '正在发送系统音频',
  'remoteAudio.send.activeBody':
    '请在两台电脑上保持 FluidEQ 开启。接收端会将此无损音频流与其他已连接发送端一起播放。',
  'remoteAudio.send.destination': '正在 {name} 上播放',
  'remoteAudio.send.stop': '停止发送',
  'remoteAudio.status.preparing': '正在准备…',
  'remoteAudio.status.waiting': '正在等待电脑',
  'remoteAudio.status.connecting': '正在连接…',
  'remoteAudio.status.connectedOne': '已连接 {count} 台电脑',
  'remoteAudio.status.connectedMany': '已连接 {count} 台电脑',
  'remoteAudio.status.sending': '正在发送无损音频',
  'remoteAudio.status.playbackBlocked': '按“恢复”即可听到音频',
  'remoteAudio.status.disconnected': '接收端已断开',
  'remoteAudio.monitor.title': '实时连接',
  'remoteAudio.monitor.inactive': '选择一个角色以开始',
  'remoteAudio.monitor.ready': '可输入连接码',
  'remoteAudio.monitor.waveform': '共享音频实时波形',
  'remoteAudio.monitor.waveformFor': '{name} 的实时音频波形',
  'remoteAudio.monitor.buffer': '{milliseconds} 毫秒缓冲',
  'remoteAudio.monitor.noRole': '尚未选择角色',
  'remoteAudio.monitor.noSources': '没有已连接的音源电脑',
  'remoteAudio.monitor.waitingSource': '正在等待发送端',
  'remoteAudio.monitor.outgoing': '此电脑发送的音频',
  'remoteAudio.monitor.transmitting': '正在传输',
  'remoteAudio.monitor.quiet': '静音',
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
  'remoteAudio.error.playback':
    'FluidEQ 无法启动无损音频引擎。请重启 FluidEQ 后重试。',
  'remoteAudio.error.connection':
    '加密音频连接已停止。请停止此会话，并使用当前配对码重新连接。',
};

export default remoteAudio;
