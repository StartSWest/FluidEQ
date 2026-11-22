/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Sharing the listener's own presets. See `en/presetShare.ts`. */
export default {
  'presetShare.share': '分享 {name}',
  'presetShare.menu.community': '分享到社区…',
  'presetShare.menu.copyLink': '复制分享链接',
  'presetShare.menu.export': '导出…',
  'presetShare.linkCopied': '已复制分享链接',
  'presetShare.linkMaking': '正在生成链接…',
  'presetShare.linkFailed.signedOut': '登录后才能生成链接',
  'presetShare.linkFailed.suspended': '此账户目前无法分享',
  'presetShare.linkFailed.rateLimited': '这一小时的链接太多了',
  'presetShare.linkFailed.tooMany': '已达链接数量上限',
  'presetShare.linkFailed.takenDown': '这个链接已被移除',
  'presetShare.linkFailed.offline': 'FluidEQ 服务器没有响应',

  'presetShare.text.title': '{name} · FluidEQ 预设',
  'presetShare.text.curve': '曲线：{count} 个频段',
  'presetShare.text.rack': '效果架：{stages}',
  'presetShare.text.open': '在 FluidEQ 中打开',

  'presetShare.chip.curve': '曲线 · {count} 个频段',
  'presetShare.chip.flat': '无改动',

  'presetShare.export.title': '导出 {name}',
  'presetShare.export.hint':
    '包含曲线和效果架的每一级。你的标准化和房间的头部仍归你自己。',
  'presetShare.export.tab.forum': '适用于任何论坛',
  'presetShare.export.tab.file': '文件',
  'presetShare.export.tab.apo': 'Equalizer APO',
  'presetShare.format.markdown': 'Markdown',
  'presetShare.format.markdownFor': 'Reddit、Discord、GitHub',
  'presetShare.format.bbcode': 'BBCode',
  'presetShare.format.bbcodeFor': 'Head-Fi · 其他论坛',
  'presetShare.format.plain': '纯文本',
  'presetShare.format.plainFor': '其他任何地方',
  'presetShare.export.withLink': '附上指向 fluideq.com 页面的短链接',
  'presetShare.export.linkSignIn': '登录以附上短链接',
  'presetShare.export.fits': '{count} 个字符 · 一条 Discord 消息放得下',
  'presetShare.export.long':
    '{count} 个字符 · 一条 Discord 消息放不下，请只发送短链接。',
  'presetShare.export.pasteHint':
    '任何装有 FluidEQ 的人都可以把它粘贴到“导入”中。',
  'presetShare.export.fileHint':
    '可读的 JSON，包含曲线和每一级，与 DSP 页面保存的文件相同。把它拖到“导入”上即可恢复。',
  'presetShare.export.apoNoCurve':
    '这个预设没有曲线：它的声音全在效果架里，而效果架需要 FluidEQ。',
  'presetShare.export.apoRack': '此格式只能带上曲线。{stages} 需要 FluidEQ。',
  'presetShare.export.copy': '复制',
  'presetShare.export.copyCurve': '复制曲线',
  'presetShare.export.save': '保存文件…',
  'presetShare.export.copied': '已复制',
  'presetShare.export.saved': '已保存',
  'presetShare.export.failed': '没有成功，请重试。',

  'presetShare.forum.attached': '附带的预设',
  'presetShare.forum.remove': '移除预设',
  'presetShare.forum.template':
    '适用于： \n试听设备： \n推荐搭配： \n\n效果： ',

  'presetShare.card.by': '由 @{author} 分享',
  'presetShare.card.sharedBy': '由 {author} 分享',
  'presetShare.card.sharedByMember': '由一位 FluidEQ 成员分享',
  'presetShare.card.add': '添加到我的预设',
  'presetShare.card.added': '已在“我的”中 · 正在播放',
  'presetShare.card.try': '试听',
  'presetShare.card.stopTrying': '停止试听',
  'presetShare.card.tryingNote':
    '会一直播放，直到你停止或离开这个帖子；之后会恢复你自己的声音。',

  'presetShare.import.button': '导入',
  'presetShare.import.title': '导入预设',
  'presetShare.import.hint':
    '粘贴论坛帖子、分享链接或预设文件。只会读取其中的预设。',
  'presetShare.import.placeholder': '粘贴到这里…',
  'presetShare.import.chooseFile': '选择文件…',
  'presetShare.import.found': '找到一个预设',
  'presetShare.import.missing':
    '这段文本中没有 FluidEQ 预设。请粘贴整个帖子或分享链接。',
  'presetShare.import.newer':
    '这个预设是用更新版本的 FluidEQ 制作的。请更新 FluidEQ 后再读取。',
  'presetShare.import.damaged': '预设代码被截断或已损坏。请从头到尾重新复制。',
  'presetShare.import.gone': '这个预设已不再分享。请改为索取它的代码。',
  'presetShare.import.offline':
    'FluidEQ 无法连接服务器来打开这个链接。请检查网络连接后重试。',

  'presetShare.link.title': '添加这个预设？',
  'presetShare.link.hint':
    '来自你打开的链接。在你按下之前，不会播放或保存任何内容。',
  'presetShare.link.notNow': '暂不',
  'presetShare.link.fetching': '正在从 FluidEQ 获取预设…',
} as const;
