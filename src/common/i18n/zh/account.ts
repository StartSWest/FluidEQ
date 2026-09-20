const account = {
  'account.validation.passwordRequired': '请输入密码。',
  'account.validation.passwordShort': '请至少使用 {count} 个字符。',
  'account.validation.passwordLong': '请勿超过 128 个字符。',
  'account.validation.nameLong': '请勿超过 80 个字符。',
  'account.validation.code': '请输入六位验证码。',
  'account.menu': '账户',
  'account.eyebrow': 'FluidEQ',
  'account.title': '账户',
  'account.checking': '正在检查你的账户…',
  'account.close': '关闭',

  'account.optional':
    '登录是可选的。没有账户，FluidEQ 也和往常完全一样——一切都在这台电脑上运行，不会追踪任何内容。账户只用于确实需要它的功能。',

  'account.signIn': '登录',
  'account.signUp': '创建账户',
  'account.signInHint':
    '你的密码直接发送到账户服务，不会保存在应用的任何地方。',
  'account.signUpHint': '一个六位数验证码将发送到该地址。在此输入即可完成。',
  'account.working': '请稍候…',
  'account.standing.free': '免费账户',
  'account.signOut': '退出登录',
  'account.signOut.confirm': '要退出这个账户吗？',
  'account.signOut.detail': '你可以随时重新登录。',
  'account.signOut.detailPlus': '重新登录之前，Plus 在这里会保持锁定。',
  'account.signOut.kept': '这台电脑上的任何内容都不会被删除。',
  'account.name.change': '更改名字',
  'account.name.changeTitle': '更改你的显示方式',
  'account.name.changeBody':
    '你在排行榜和已发布场景上的昵称与名字。改动会同时在所有地方生效；你的邮箱仍然保密。',
  'account.name.cancel': '取消',
  'account.signedIn': '已登录',
  'account.backToSignIn': '返回登录',

  'account.field.email': '电子邮箱',
  'account.field.emailHint': '不会向任何人显示——仅用于登录和验证码',
  'account.field.password': '密码',
  'account.field.passwordHint': '至少 {count} 个字符',
  'account.field.name': '名字',
  'account.field.optional': '可选',
  'account.field.code': '邮件中的验证码',

  'account.code.sent': '我们已向 {email} 发送了一个六位数验证码。',
  'account.code.confirm': '确认',
  'account.code.sendAgain': '重新发送验证码',
  'account.code.sentAgain': '已重新发送',
  'account.code.otherEmail': '使用其他邮箱',
  'account.code.hint':
    '没有收到？请查看垃圾邮件文件夹。如果该地址已有账户，则不会发送验证码——请直接登录。',

  'account.forgot.link': '忘记密码？',
  'account.forgot.lead': '输入注册时使用的邮箱地址，验证码将发送到那里。',
  'account.forgot.submit': '发送重置验证码',
  'account.reset.sent':
    '我们已向 {email} 发送了一个六位数验证码。在此输入验证码和新密码。',
  'account.reset.submit': '设置新密码',

  'account.unavailable': '此系统不支持登录',
  'account.unavailableHint':
    '这台电脑上没有安全的地方保存登录信息，因此 FluidEQ 不会保存。其他功能一切正常。',

  'account.error.network': '无法连接账户服务。请检查网络连接后重试。',
  'account.error.rejected': '账户服务拒绝了该请求。请稍后重试。',
  'account.error.expired': '该登录已失效。请重新登录。',
  'account.error.signedOutElsewhere':
    '此电脑已退出登录，因为你的账户在另一台电脑上登录了。Plus 最多可同时在 5 台电脑上使用：在这里重新登录即可继续使用，最久未使用的那台电脑会被退出登录。',
  'account.error.malformed': '账户服务返回了 FluidEQ 无法读取的内容。',
  'account.error.wrongCredentials': '邮箱或密码错误。',
  'account.error.unconfirmed': '该账户尚未确认。请输入邮件中的验证码以完成。',
  'account.error.weakPassword':
    '该密码太容易被猜到。请换一个更长的、以前没用过的密码。',
  'account.error.badCode': '验证码错误或已过期。请重新获取。',
  'account.error.rateLimited': '短时间内尝试次数过多。请等待一分钟后重试。',
  'account.error.invalidEmail': '这看起来不像一个邮箱地址。',
  'account.error.alreadyRegistered': '该地址已有账户。请直接登录。',

  'account.plus.eyebrow': 'FluidEQ Plus',
  'account.plus.pitch':
    '别处没有的高级可视化效果、创作你自己场景的工作室、排行榜——以及从现在起的每一项新功能，会员优先。今天免费的一切依然免费。',
  'account.plus.upgrade': '升级到 Plus',
  'account.plus.opening': '正在打开…',
  'account.plus.checkoutHint':
    '在浏览器中打开 Buy Me a Coffee。请使用与此账户相同的邮箱付款，以便 FluidEQ 识别；应用永远不会看到你的银行卡。',
  'account.plus.active': '已激活',
  'account.plus.ending': '不再续订',
  'account.plus.renews': '{date} 续订',
  'account.plus.sorry': '很遗憾你要离开。',
  'account.plus.until': 'Plus 会用到 {date}，之后不再扣费。',
  'account.plus.gift': '来自 FluidEQ 的赠礼',
  'account.plus.giftUntil': '来自 FluidEQ 的赠礼，至 {date}',
  'account.plus.computers': '最多可同时在 {count} 台电脑上登录。',
  'account.plus.manage': '管理订阅',
  'account.plus.grace':
    '无法确认你的订阅。它将保持有效至 {date}——请在此之前连接网络以保留。',
  'account.plus.checkAgain': '再次检查',
  'account.plus.perMonth': '{price} / 月',
  'account.plus.perYear': '{price} / 年',
  'account.plus.priceChoice': '{monthly} 或 {yearly}',
  'account.plus.checkoutOpened':
    'Buy Me a Coffee 已在你的浏览器中打开。付款后回到这里，Plus 就会开启。',
  'account.plus.error.rejected': '无法打开付款页面。请稍后重试。',

  'account.dev.label': '开发',
  'account.dev.start': '模拟一次付款',
  'account.dev.cancel': '模拟一次取消',
  'account.dev.working': '发送中…',

  'account.perk.looks': '由显卡绘制的 Plus 样式。',
  'account.perk.visualizers': '“可视化”：会员创作的场景，向所有账户开放。',
  'account.perk.board': '谁听得最多的排行榜。',
  // What publishing earns: one approved scene a month keeps Plus free
  // (server migration 0041). Months earned while a paid membership runs
  // wait for it to end; nothing here changes what anybody pays.
  'account.maker.title': '创作者月份',
  'account.maker.badge': '免费',
  'account.maker.until': 'Plus 免费至 {date}。',
  'account.maker.endsDays':
    '还有 {days} 天结束：在此之前发布一个场景即可继续。',
  'account.maker.endsToday': '今天结束 — 发布一个场景即可继续。',
  'account.maker.endsTomorrow': '明天结束：在此之前发布一个场景即可继续。',
  'account.maker.keep': '本月发布一个场景，下个月就免费。',
  'account.maker.kept': '本月的场景已经收到。下个月再发布一个就能继续。',
  'account.maker.again': '发布一个场景，就又有一个月的 Plus 免费。',
  'account.maker.againWaiting': '发布一个场景，就会再多一个免费月份排队等候。',
  'account.maker.invite':
    '在工作室做一个场景：每月有一个通过审核，Plus 就一直免费。',
  'account.maker.waitingOne':
    '你有 1 个已获得的月份在等待，会在订阅结束后开始；这不会改变你的付款。',
  'account.maker.waitingMany':
    '你有 {count} 个已获得的月份在等待，会在订阅结束后开始；这不会改变你的付款。',
  // The week before an earned month runs out, and the day it does: an
  // earned month renews itself no more than a gift does, so it has to be
  // said out loud rather than simply stop.
  'account.maker.notice.endingTitle': '你的免费 Plus 将在 {days} 天后结束',
  'account.maker.notice.endingToday': '你的免费 Plus 今天结束',
  'account.maker.notice.endingTomorrow': '你的免费 Plus 明天结束',
  'account.maker.notice.endingBody':
    '在此之前发布一个场景，下个月也免费。两种情况都不会收费。',
  'account.maker.notice.endedTitle': '你的免费 Plus 已结束',
  'account.maker.notice.endedBody':
    '发布一个场景就会重新开始。你买过的东西依然是你的。',
  'account.maker.notice.open': '打开工作室',
  'account.maker.notice.later': '暂不',
} as const;

export default account;
