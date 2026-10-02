/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': '共享音频',
  'remoteAudio.eyebrow': '局域网音频连接',
  'remoteAudio.title': '在这里收听其他电脑',
  'remoteAudio.subtitle':
    '链接两台电脑，每台都会播放对方的声音。每台都原样发送自己的声音；你收听的那台电脑会套用自己的 EQ、曲线和 DSP。',
  'remoteAudio.security': '连接属性',
  'remoteAudio.badge.local': '仅限私有局域网',
  'remoteAudio.badge.lossless': '无损 Float32 PCM 传输',
  'remoteAudio.badge.encrypted': 'AES-256-GCM 加密',
  'remoteAudio.link.section': '链接一台电脑',
  'remoteAudio.link.thisComputer': '这台电脑',
  'remoteAudio.link.thisHint':
    '把这个连接码粘贴到另一台电脑上，或者把那台电脑的连接码粘贴到这里，两种方式都可以。',
  'remoteAudio.link.or': '或',
  'remoteAudio.link.otherComputer': '另一台电脑的连接码',
  'remoteAudio.link.codeLabel': '连接码',
  'remoteAudio.link.placeholder': '粘贴 FLUIDEQ-LAN-2…',
  'remoteAudio.link.start': '链接',
  'remoteAudio.link.otherHint':
    '两台电脑会立即互相播放。如果只想要一个方向，之后关闭另一个方向即可。',
  'remoteAudio.link.once':
    '只需一次。链接后的电脑重启后会自动重新找到彼此，哪一边重启都一样。',
  'remoteAudio.rule.echoTitle': '双向，无回声',
  'remoteAudio.rule.echo':
    '每台电脑只发送自己播放的声音，绝不发送正在接收的声音，所以不会有声音绕回来。',
  'remoteAudio.rule.eqTitle': '在收听处套用 EQ',
  'remoteAudio.rule.eq':
    '声音原样发出。你收听的那台电脑会套用它的 EQ、耳机曲线和 DSP，只套用一次。',
  'remoteAudio.rule.steadyTitle': '稳定，不漂移',
  'remoteAudio.rule.steady':
    '延迟约 30 毫秒并保持不变：两台电脑的时钟保持同步，没有断音，也不会慢慢漂移。',
  'remoteAudio.linked.section': '已链接',
  'remoteAudio.linked.cardLabel': '与 {name} 的链接',
  'remoteAudio.linked.bothWays': '双向',
  'remoteAudio.linked.incomingOnly': '仅接收',
  'remoteAudio.linked.outgoingOnly': '仅发送',
  'remoteAudio.linked.paused': '已暂停',
  'remoteAudio.linked.looking': '正在你的网络中查找 {name}…',
  'remoteAudio.linked.lossless': '无损',
  'remoteAudio.linked.unlink': '取消链接',
  'remoteAudio.linked.noEcho': '无回声：{name} 的声音绝不会被发回给它。',
  'remoteAudio.linked.untouched':
    '双向都原样发送——每台电脑套用自己的 EQ 和 DSP。',
  'remoteAudio.lane.from': '来自 {name}',
  'remoteAudio.lane.to': '发往 {name}',
  'remoteAudio.lane.playsHere': '本机播放',
  'remoteAudio.lane.yourSound': '你的声音',
  'remoteAudio.lane.playItHere': '在此播放',
  'remoteAudio.lane.sendMySound': '发送我的声音',
  'remoteAudio.lane.delay': '延迟',
  'remoteAudio.lane.sent': '发送',
  'remoteAudio.lane.milliseconds': '{milliseconds} 毫秒',
  'remoteAudio.lane.megabits': '{megabits} Mb/s',
  'remoteAudio.lane.receiving': '接收中',
  'remoteAudio.lane.paused': '已暂停',
  'remoteAudio.lane.inQuiet': '{name} 上没有在播放',
  'remoteAudio.lane.inOff': '已关闭：{name} 的声音不会在这台电脑上播放。',
  'remoteAudio.lane.inNotSent': '{name} 关闭了“发送我的声音”。',
  'remoteAudio.lane.inOld': '{name} 需要最新版 FluidEQ 才能把声音发送到这里。',
  'remoteAudio.lane.inOneWay': '要双向播放，这台电脑需要 Windows。',
  'remoteAudio.lane.outQuiet': '这台电脑上没有在播放',
  'remoteAudio.lane.outOff': '未发送。{name} 听不到这台电脑。',
  'remoteAudio.lane.outNotPlayed': '{name} 关闭了“在此播放”。',
  'remoteAudio.lane.outOld':
    '{name} 需要最新版 FluidEQ 才能播放这台电脑的声音。',
  'remoteAudio.lane.outOneWay': '要双向发送，这台电脑需要 Windows。',
  'remoteAudio.lane.outFailed':
    '无法捕获这台电脑的声音。关闭再打开“发送我的声音”即可重试。',
  'remoteAudio.another.section': '链接另一台电脑',
  'remoteAudio.another.hub':
    '把这台电脑的连接码粘贴到另一台电脑上。每台已链接的电脑都会在上方有自己的一行。',
  'remoteAudio.another.spoke':
    '要链接第三台电脑，请在那台电脑上粘贴 {name} 的连接码：电脑会与它所用连接码的那台电脑链接。',
  'remoteAudio.singlePlayer.title': '同时只播放一处',
  'remoteAudio.singlePlayer.body':
    '同样适用于已链接的电脑：在其中一台开始播放，会暂停另一台正在播放的内容。',
  'remoteAudio.code.copy': '复制代码',
  'remoteAudio.code.copied': '已复制',
  'remoteAudio.code.forAddress': '{address} 的配对码',
  'remoteAudio.status.preparing': '正在准备…',
  'remoteAudio.status.playbackBlocked': '按“恢复”即可听到音频',
  'remoteAudio.resume': '恢复音频',
  'remoteAudio.retry': '重试',
  'remoteAudio.monitor.networkHealthy': '网络稳定',
  'remoteAudio.monitor.networkQueued': '排队 {milliseconds} 毫秒',
  'remoteAudio.note.title': '请从低音量开始。',
  'remoteAudio.note.body':
    '两台电脑同时播放会叠加音量。首次链接前请先调低音量。',
  'remoteAudio.error.lan':
    'FluidEQ 无法打开本地连接。请确认两台电脑位于同一专用网络，并且防火墙允许 FluidEQ。',
  'remoteAudio.error.capture':
    'FluidEQ 无法捕获这台电脑的系统音频。请检查当前输出设备，然后重试。',
  'remoteAudio.error.playback':
    'FluidEQ 无法启动无损音频引擎。请重启 FluidEQ 后重试。',
  'remoteAudio.error.connection':
    '加密音频连接已中断。FluidEQ 会继续查找另一台电脑，等它回来后会自动重新连接。',
};

export default remoteAudio;
