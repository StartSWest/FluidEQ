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
  'remoteAudio.badge.local': '仅限私有局域网',
  'remoteAudio.badge.lossless': '无损 Float32 PCM 传输',
  'remoteAudio.badge.encrypted': 'AES-256-GCM 加密',
  'remoteAudio.listen.kicker': '接收端 · 服务器',
  'remoteAudio.listen.title': '在此电脑上播放音频',
  'remoteAudio.listen.body':
    '在连接耳机或扬声器的电脑上使用此角色。它可接收一个或多个发送端，并通过 FluidEQ 中已选择的输出播放。',
  'remoteAudio.listen.start': '创建连接码',
  'remoteAudio.listen.activeTitle': '此电脑正在接收',
  'remoteAudio.listen.newCode': '创建新连接码',
  'remoteAudio.listen.stop': '停止接收',
  'remoteAudio.stream.title': '传输优先级',
  'remoteAudio.stream.lossless': '两种模式都发送无损 PCM',
  'remoteAudio.stream.video.title': '视频',
  'remoteAudio.stream.video.body':
    '最低延迟以匹配口型。Wi-Fi 繁忙时更容易断续。',
  'remoteAudio.stream.video.buffer': '起始约 60 ms',
  'remoteAudio.stream.music.title': '音乐',
  'remoteAudio.stream.music.body': '使用更大的安全缓冲区以保持连续播放。',
  'remoteAudio.stream.music.buffer': '起始约 240 ms',
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
  'remoteAudio.send.readyHint': '停止后，已保存的代码仍会保留在这里。',
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
  'remoteAudio.monitor.buffer': '播放 {milliseconds} ms',
  'remoteAudio.monitor.sendQueue': '发送队列 {milliseconds} ms',
  'remoteAudio.monitor.noRole': '尚未选择角色',
  'remoteAudio.monitor.noSources': '没有已连接的音源电脑',
  'remoteAudio.monitor.waitingSource': '正在等待发送端',
  'remoteAudio.monitor.outgoing': '此电脑发送的音频',
  'remoteAudio.monitor.transmitting': '正在传输',
  'remoteAudio.monitor.quiet': '静音',
  'remoteAudio.monitor.peakLevel': '实时音频峰值电平',
  'remoteAudio.monitor.peak': '峰值 {decibels} dB',
  'remoteAudio.monitor.networkUsage': '局域网 {megabits} Mb/s',
  'remoteAudio.monitor.networkHealthy': '网络稳定',
  'remoteAudio.monitor.networkQueued': '排队 {milliseconds} 毫秒',
  'remoteAudio.code.title': '配对其他电脑',
  'remoteAudio.code.hint':
    '将一个代码复制到每个发送端。关闭应用或重启电脑后，配对仍会保留。如果出现多个地址，请选择这些电脑共同使用的网络。',
  'remoteAudio.code.copy': '复制代码',
  'remoteAudio.code.copied': '已复制',
  'remoteAudio.code.forAddress': '{address} 的配对码',
  'remoteAudio.resume': '恢复音频',
  'remoteAudio.note.title': '请从低音量开始。',
  'remoteAudio.note.body':
    '多台电脑的声音会混合，音量可能很快叠加。首次连接前请降低耳机音量。只有创建新连接码才会断开已保存的配对。',
  'remoteAudio.error.lan':
    'FluidEQ 无法打开本地连接。请确认两台电脑位于同一专用网络，并且防火墙允许 FluidEQ。',
  'remoteAudio.error.capture':
    'FluidEQ 无法捕获此电脑的系统音频。请检查当前输出设备，然后停止并重试。',
  'remoteAudio.error.playback':
    'FluidEQ 无法启动无损音频引擎。请重启 FluidEQ 后重试。',
  'remoteAudio.error.connection':
    '加密音频连接已停止。已保存的代码仍在下方；接收端准备好后请重新连接。',
};

export default remoteAudio;
