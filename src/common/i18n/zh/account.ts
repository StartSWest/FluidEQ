const account = {
  'account.menu': '账户',
  'account.eyebrow': 'FluidEQ',
  'account.title': '账户',
  'account.close': '关闭',

  'account.optional':
    '登录是可选的。没有账户，FluidEQ 也和往常完全一样——一切都在这台电脑上运行，不会追踪任何内容。账户只用于确实需要它的功能。',

  'account.signIn': '登录',
  'account.signUp': '创建账户',
  'account.signInHint':
    '你的密码直接发送到账户服务，不会保存在应用的任何地方。',
  'account.signUpHint': '一个六位数验证码将发送到该地址。在此输入即可完成。',
  'account.working': '请稍候…',
  'account.signOut': '退出登录',
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
    '别处没有的可视化效果、在社区发言、排行榜、直接提出功能需求的通道——以及从现在起的每一项新功能，会员优先。今天免费的一切依然免费。',
  'account.plus.upgrade': '升级到 Plus',
  'account.plus.opening': '正在打开…',
  'account.plus.checkoutHint':
    '在浏览器中打开 Buy Me a Coffee。请使用与此账户相同的邮箱付款，以便 FluidEQ 识别；应用永远不会看到你的银行卡。',
  'account.plus.active': '已激活',
  'account.plus.renews': '{date} 续订',
  'account.plus.ends': '{date} 到期',
  'account.plus.manage': '管理订阅',
  'account.plus.grace':
    '无法确认你的订阅。它将保持有效至 {date}——请在此之前连接网络以保留。',
  'account.plus.checkAgain': '再次检查',
  'account.plus.error.rejected': '无法打开付款页面。请稍后重试。',

  'account.dev.label': '开发',
  'account.dev.start': '模拟一次付款',
  'account.dev.cancel': '模拟一次取消',
  'account.dev.working': '发送中…',

  'account.perk.looks': '由显卡绘制的 Plus 样式。',
  'account.perk.community': '人人可读、会员可发言的社区。',
  'account.perk.board': '谁听得最多的排行榜。',
} as const;

export default account;
