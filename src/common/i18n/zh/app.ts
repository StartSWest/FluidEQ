/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** The shell around everything: menus, tabs, updates, config, notices. */
import { Dictionary } from '../en';

const app: Partial<Dictionary> = {
  'app.tagline': '你的声音，每台设备，自动生效。',
  'app.actions': 'FluidEQ 操作',
  'app.actions.title': '音频操作',
  'app.status.ready': '已连接到 Equalizer APO',
  'app.status.checking': '正在检查 Equalizer APO…',
  'app.status.error': 'Equalizer APO 无响应',
  'app.menu.importEq': '导入均衡设置…',
  'app.menu.importConvolution': '导入脉冲响应…',
  'app.menu.restartAudio': '重启 Windows 音频',
  'app.menu.reconfigure': '重新配置 Equalizer APO',
  'app.menu.apoSettings': 'Equalizer APO 设置',
  'app.menu.support': '支持本项目',
  'app.menu.fix': '修复',
  'app.menu.reportProblem': '报告问题',
  'app.menu.about': '关于 {product}…',
  'app.menu.reinstallApp': '重新安装 {product}…',
  'app.menu.fixAudio': '修复音频问题…',
  'app.menu.reinstallApo': '重新安装 Equalizer APO…',
  'whatsNew.eyebrow': '更新说明',
  'whatsNew.title': 'FluidEQ 有什么新变化',
  'whatsNew.loading': '正在加载更新说明…',
  'whatsNew.missing': '这个版本里找不到更新说明。GitHub 上也有一份。',
  'whatsNew.ok': '确定',
  'app.menu.whatsNew': '更新说明',
  'app.menu.language': '语言',
  'app.window.minimize': '最小化',
  'app.window.maximize': '最大化',
  'app.window.restore': '还原',
  'app.window.close': '关闭',
  'app.tray.open': '打开 {product}',
  'app.tray.quit': '退出 {product}',
  'app.tray.tooltip': '{product} — 仍在运行',
  'app.tray.installUpdate': '安装更新并重启',
  'app.tray.checkForUpdates': '检查更新',
  'app.tray.tooltip.updateReady': '{product} — 更新已准备安装',
  'app.notification.updateReady.title': 'FluidEQ 更新已准备好',
  'app.notification.updateReady.body':
    '版本 {version} 已准备好。点击以重启 FluidEQ。',
  'app.notification.updateReady.bodyNoVersion':
    '更新已准备好。点击以重启 FluidEQ。',
  'app.notification.upToDate.title': 'FluidEQ 已是最新版本',
  'app.notification.upToDate.body': '您已经在使用最新版本。',
  'app.notification.updateFound.title': '发现 FluidEQ 更新',
  'app.notification.updateFound.body':
    '正在下载版本 {version}。准备好安装时会通知您。',
  'app.notification.checkFailed.title': '无法检查更新',
  'app.notification.checkFailed.body':
    '无法连接更新服务器。FluidEQ 稍后会再试。',
  'app.notification.installFailed.title': '无法安装更新',
  'app.notification.installFailed.body':
    'FluidEQ 无法启动安装程序。点击以打开 FluidEQ 并重试。',
  'app.window.minimizeApp': '最小化 FluidEQ',
  'app.window.maximizeApp': '最大化 FluidEQ',
  'app.window.restoreApp': '还原 FluidEQ',
  'app.window.closeApp': '关闭 FluidEQ',
  'app.media.previous': '上一曲',
  'app.media.playPause': '播放或暂停',
  'app.media.next': '下一曲',
  'app.media.previousAria': '上一曲，控制本机上正在播放的任何内容',
  'app.media.playPauseAria': '播放或暂停本机上正在播放的任何内容',
  'app.media.nextAria': '下一曲，控制本机上正在播放的任何内容',
  'app.dismiss': '知道了',
  'common.search': '搜索…',
  'common.recentSearches': '最近搜索',
  'common.clearRecentSearches': '清除最近搜索',
  'common.clearSearch': '清除搜索',
  'common.filterOptions': '筛选选项',
  'common.increase': '增大{item}',
  'common.decrease': '减小{item}',
  'common.icon.edit': '编辑',
  'common.icon.delete': '删除',
  'common.icon.trash': '移除',
  'common.icon.accept': '接受',
  'common.icon.cancel': '取消',
  'tabs.aria': '声音工作区',
  'tabs.eq': '均衡器',
  'tabs.eqMain': '频段',
  'tabs.presets': 'EQ 预设',
  'tabs.voicing': '声音风格',
  'tabs.convolution': '卷积',
  'tabs.config': 'Config',
  'tabs.media': '媒体',
  'tabs.karaoke': '卡拉OK',
  'tabs.scrollBack': '向前滚动标签',
  'tabs.scrollForward': '向后滚动标签',
  'notice.apoReconfigured':
    'Equalizer APO 已安装或重新配置。如果没有声音，请重启 Windows 音频服务，而不是重启电脑。',
  'notice.restartNow': '立即重启音频',
  'notice.importComplete': '导入完成',
  'notice.restartConfirm':
    '声音会中断几秒，Windows 会请求管理员权限。要继续吗？',
  'update.title': 'FluidEQ 更新',
  'update.available': '有新版本 {version}，正在下载。',
  'update.downloading': '正在下载更新… {percent}%',
  'update.ready': '版本 {version} 已就绪。重启 FluidEQ 即可完成。',
  'update.restart': '立即重启',
  'update.restarting': '正在重启…',
  'update.mandatory.title': '此版本必须更新',
  'update.mandatory.body':
    '本次发布修复的问题足够严重，FluidEQ 不应继续以当前状态运行。更新正在获取中。',
  'update.mandatory.notOptional':
    '这不是可选更新。你可以关掉这条提示，把手头的事做完——在 FluidEQ 更新之前，它还会再出现。',
  'update.mandatory.later': '暂不更新',
  'update.mandatory.waiting': '正在获取更新…',
  'update.mandatory.readyPrompt':
    '更新已下载完成。安装期间 FluidEQ 会关闭，随后自动重新打开。',
  'update.mandatory.install': '安装并重启',
  'update.mandatory.installing': '正在安装…',
  'update.mandatory.failedDownload':
    '更新下载失败。可能是无法连接下载服务器，也可能是连接在中途中断。',
  'update.mandatory.failedInstall':
    '更新已下载，但安装程序没有启动。可能被 Windows 拒绝，也可能是下载的文件已损坏。',
  'update.mandatory.manual':
    '你也可以自行安装：从发布页面下载最新版本并运行即可。你的设置和配置文件会保留。',
  'update.mandatory.releasePage': '打开下载页面',
  'notice.restartDone': 'Windows 音频已重启。请重新打开仍然没有声音的程序。',
  'sidebar.engine': '处理引擎',
  'sidebar.systemEq': '系统均衡',
  'sidebar.preamp': '前级增益',
  'sidebar.preampAria': '前级增益（dB）',
  'sidebar.preampAuto': '已自动设置。关闭自动归一化后才能手动调整。',
  'sidebar.headroom': 'APO 余量',
  'sidebar.autoPreamp': '自动归一化',
  'sidebar.visualizer': '可视化',
  'sidebar.graphView': '频响曲线',
  'config.eyebrow': '引擎实际读到的内容',
  'config.title': 'Equalizer APO 配置',
  'config.lede': '这是磁盘上此刻的内容，而不是 FluidEQ 打算写入的内容。',
  'config.reload': '重新读取',
  'config.reloadTitle': '再次从磁盘读取配置',
  'config.reading': '正在读取…',
  'config.absent': 'FluidEQ 还没有向这套 Equalizer APO 写入过任何内容。',
  'config.status.notIncluded':
    'Equalizer APO 没有包含这份配置，下面的内容全都没有生效。',
  'config.status.engineOff':
    'FluidEQ 引擎已关闭——这份配置没有指定任何输出，所以 Equalizer APO 不会应用其中的任何内容。',
  'config.status.active': '已生效——Equalizer APO 正在应用这份配置。',
  'config.outputsAria': 'Equalizer APO 配置里的输出',
  'config.filters.one': '{count} 个滤波器',
  'config.filters.many': '{count} 个滤波器',
  'config.impulse': '脉冲响应',
  'config.playingNow': '正在播放',
  'config.liveTitle': '持续均衡正在保持这项测量',
  'config.layer.on': '开',
  'config.layer.off': '关',
  'config.layers.noFile': '没有自己的文件',
  'config.layers.inFile': '写在这个文件里，而不是它自己的文件。',
  'config.empty': '没有包含任何内容——这个输出保持原样。',
  'config.file.missing': '缺失',
  'config.export': '导出链路',
  'config.import': '导入链路',
  'config.import.hint': '导入会应用到你正在收听的输出。',
  'config.import.customSkipped':
    '已跳过发送者自己的文件：其中的 Include: 或 Plugin: 行会把代码加载进 Windows 音频。',
  'config.file.yours': '你的',
  'config.hint.custom': '这是你的文件，永远不会被覆盖。',
  'config.hint.generated': '自动生成——下次改动时会被重写。',
  'config.hint.saving': '保存会写入文件；Equalizer APO 随即读取。',
  'config.edit': '编辑',
  'config.cancel': '取消',
  'config.save': '保存',
  'disclaimer.heading': '不提供担保，也不承担责任',
  'disclaimer.asIs':
    'FluidEQ 按现状提供，不附带任何形式的担保。没有人承诺它能正常工作、适合你的用途，或者会一直可用。这正是 GNU General Public License 第 15 条和第 16 条所说的内容；无论这份副本是别人给你的，还是你付费得到的，都同样适用。',
  'disclaimer.liability':
    'FluidEQ 会改变你电脑上的音频处理方式，并且会安装并驱动 Equalizer APO——那是一个独立程序，以管理员权限运行，位于 Windows 的音频通路上。在法律允许的最大范围内，{author} 对使用本软件所引起的损害不承担责任：包括对你的听力、对音箱、耳机或其他设备、对数据或其他软件的损害，以及任何其他损失，也包括你无法预见的损失。',
  'disclaimer.volume':
    '声音可能很大，而均衡处理可能让它比原始素材更响。改动设置前请先把音量调低，改完之后再调回去。',
  'disclaimer.localLaw':
    '有些国家不允许销售者排除某些担保或责任。在这些地方，以当地的规定为准，本声明不会剥夺法律赋予你的权利。',
  'disclaimer.accepting': '使用 FluidEQ 即表示你接受以上内容。',
  'disclaimer.language':
    '本声明以英文写成。若译文与英文文本有出入，以英文文本为准。',
  'disclaimer.accept': '我已理解并接受',
  'disclaimer.decline': '退出',
  'provenance.heading': '确认这份副本的来源',
  'provenance.body':
    'FluidEQ 的官方签名安装程序仅通过 fluideq.com 提供。源码构建应来自官方仓库。GPL 允许第三方复制、修改、重新构建并出售 FluidEQ，但他们的构建不会自动获得 FluidEQ 的签名、审核、支持或认可。如果某个下载自称是官方版本却没有有效的 Windows 数字签名，请关闭它并举报。',
  'provenance.site': '官方网站: fluideq.com',
  'provenance.repository': '官方源码: github.com/StartSWest/FluidEQ',
  'language.title': '语言',
  'language.aria': '界面语言',
};

export default app;
