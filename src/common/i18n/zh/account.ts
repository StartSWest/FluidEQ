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
  'account.signOut': '退出登录',
  'account.signOut.confirm': '要退出这个账户吗？',
  'account.signOut.detail': '你可以随时重新登录。',
  'account.signOut.detailPlus': '在你重新登录之前，你的场景在这里会保持锁定。',
  'account.signOut.kept': '这台电脑上的任何内容都不会被删除。',
  'account.name.change': '更改名字',
  'account.name.changeTitle': '更改你的显示方式',
  'account.name.changeBody':
    '你在已发布场景上的昵称与名字。改动会同时在所有地方生效；你的邮箱仍然保密。',
  'account.name.cancel': '取消',
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
    '这台电脑已退出登录，因为你的账户在另一台电脑上登录了。一个账户最多可同时在 5 台电脑上保持登录：重新登录即可在这里使用，届时最久未使用的那台会被退出。',
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

  'account.perk.looks': '永久归你的场景，每个一点。',
  'account.perk.visualizers': '“可视化”：会员创作的场景，向所有账户开放。',
  // Signing in with Google, in the browser (main/account/googleSignIn.ts).
  'account.google': '使用 Google 继续',
  'account.or': '或',
  'account.google.waiting': '请在浏览器中完成 Google 登录。',
  'account.google.cancel': '取消',
  'account.error.googleUnfinished':
    'Google 登录未完成。请重试，或使用电子邮件登录。',
  'account.google.doneTitle': '你已登录',
  'account.google.doneBody': '可以关闭此标签页并返回 FluidEQ。',
  'account.google.failedTitle': '登录未完成',
  'account.google.failedBody': '请返回 FluidEQ 重试，或使用电子邮件登录。',
} as const;

export default account;
