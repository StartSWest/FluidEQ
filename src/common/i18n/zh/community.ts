const community = {
  'community.title': '社区',
  'community.signIn.title': '登录后加入社区',
  'community.signIn.body':
    '任何有账户的人都可以阅读所有频道。发言——以及对未来功能的发言权——属于 Plus 会员。',
  'community.signIn.button': '登录',
  'community.loading': '加载中…',
  'community.live': '实时',
  'community.connecting': '连接中…',
  'community.offline': '实时连接已断开',
  'community.loadOlder': '显示更早的消息',
  'community.empty': '这里还没有内容。来当第一个吧。',
  'community.composer.placeholder': '在 #{channel} 发消息',
  'community.send': '发送',

  'community.plusOnly.title': 'Plus 会员可以发言',
  'community.plusOnly.body':
    '已登录的用户都可以免费阅读。发言以及参与决定未来功能，属于 Plus。',
  'community.upgrade': '升级到 Plus',
  'community.contributorsOnly': '这里由明星贡献者发言。所有人都可以阅读。',

  'community.handle.title': '选择你的名字',
  'community.handle.body':
    '一个用于 @提及 的用户名——字母、数字和下划线，3 到 20 个字符——以及别人看到的显示名。',
  'community.handle.handle': '用户名',
  'community.handle.name': '显示名',
  'community.handle.save': '加入',

  'community.conduct.title': '发出第一条消息之前',
  'community.conduct.rules':
    '友善待人。禁止骚扰、辱骂、垃圾信息和盗版链接。争论观点，而不是攻击个人。任何内容和任何人都可能被移除，且不接受申诉。',
  'community.conduct.accept': '我同意',

  'community.action.report': '举报',
  'community.action.reported': '已举报',
  'community.action.block': '屏蔽',
  'community.action.delete': '删除',
  'community.blocked.count': '已屏蔽 {count} 人',
  'community.blocked.unblockAll': '全部取消屏蔽',
  'community.role.contributor': '明星贡献者',
  'community.role.admin': '作者',
  'community.mentions.unread': '{count} 条未读提及',

  'community.channel.general': '综合',
  'community.channel.looks': '可视化',
  'community.channel.help': '求助',
  'community.channel.featureRequests': '功能建议',
  'community.channelDescription.general': '关于 FluidEQ 的一切。来打个招呼。',
  'community.channelDescription.looks': '可视化效果、自定义外观和高级场景。',
  'community.channelDescription.help': '遇到问题？在这里提问。',
  'community.channelDescription.featureRequests':
    '明星贡献者：直达作者的通道。',

  'community.error.banned': '此账户无法在社区发言。',
  'community.error.handleRequired': '发言前请先选择用户名。',
  'community.error.handleTaken': '该用户名已被使用，请换一个。',
  'community.error.conductRequired': '发言前请先同意社区守则。',
  'community.error.plusRequired': '发言仅限 Plus 会员。',
  'community.error.contributorRequired': '只有明星贡献者可以在此频道发言。',
  'community.error.adminRequired': '只有作者可以在此频道发言。',
  'community.error.rateLimited': '慢一点——请稍后再试。',
  'community.error.empty': '请先写点什么。',
  'community.error.immutable': '消息发送后无法编辑。',
  'community.error.network': '无法连接社区。请检查网络连接。',
  'community.error.signedOut': '你已退出登录，请重新登录。',
  'community.error.rejected': '社区服务拒绝了该操作。',

  'community.hero.read': '阅读所有频道',
  'community.hero.post': '使用 Plus 发言',
  'community.hero.board': '登上排行榜',
  'community.composer.hint': 'Enter 发送 · Shift+Enter 换行',
} as const;

export default community;
