const terms = {
  'terms.eyebrow': 'FluidEQ Plus',
  'terms.title': '条款，以及应用会发送什么',
  'terms.meta': '第 {version} 版 · 自 {date} 起生效',
  'terms.intro':
    '全部用直白的话写成。这是你订阅时同意的内容，并逐项列出应用发送的每一条信息、何时发送、谁能看到。',
  'terms.link': 'Plus 条款，以及应用会发送什么',

  'terms.short.title': '简要版本',
  'terms.short.price.title': '{price}，随时可取消',
  'terms.short.price.body':
    '通过 Buy Me a Coffee 付款。FluidEQ 从不接触你的银行卡。',
  'terms.short.free.title': '免费的一切都不会被拿走',
  'terms.short.free.body': 'FluidEQ 依然可以离线、无需账户地使用，一如既往。',
  'terms.short.choice.title': '分享什么由你决定',
  'terms.short.choice.body':
    '除非你加入，否则排行榜是关闭的；发什么内容、分享哪些自己的场景，也由你决定。',
  'terms.short.music.title': '绝不涉及你的音乐',
  'terms.short.music.body': '曲目名称、文件、音频和设备永远不会离开你的电脑。',

  'terms.membership.title': '会员',
  'terms.membership.p1':
    'Plus 为 FluidEQ 增加高级可视化效果、用来创作自己的场景并与其他会员分享的工作室、在社区发言和排行榜。价格为 {price}，在每个已付费周期结束时自动续订，直到你取消。',
  'terms.membership.p2':
    '付款由 Buy Me a Coffee 按其自身条款处理。FluidEQ 从不接触你的银行卡或银行信息。你可以随时在 Buy Me a Coffee 上取消：Plus 会保持到已付费周期结束，之后不再扣费。',
  'terms.membership.p3':
    '如果某次扣款是误操作，或者 Plus 不适合你，请在该次扣款后 {refundDays} 天内提出，将全额退款，不问原因。',
  'terms.membership.p4':
    '会员结束后，Plus 样式和会员创作的场景会重新锁定，FluidEQ 回到免费样式；你创作的内容不会被删除。应用最后一次确认你的会员后，Plus 可以离线继续使用最多 {graceDays} 天。免费的一切永远不受影响。',

  'terms.account.title': '你的账户',
  'terms.account.p1':
    '账户由一个电子邮箱和一个密码组成，你需要年满 {age} 岁才能创建。密码经加密传送到登录服务，并且只以单向哈希的形式保存，任何人都无法读回，包括作者。',
  'terms.account.p2':
    '你的邮箱会收到确认地址和重置密码的验证码。邮箱永远不会展示给其他会员：在社区里，你以自己选择的用户名和显示名称出现。',
  'terms.account.p3':
    '在你的电脑上，应用会保存由操作系统加密的登录会话。账户仅限个人使用，请勿与他人分享密码。',

  'terms.sent.title': '应用会发送什么，以及何时发送',
  'terms.sent.intro':
    '只为你使用的功能发送，并且始终通过加密连接。没有账户时，唯一的请求是获取公开的 Plus 样式列表，其中不含任何关于你的信息。',
  'terms.sent.when': '何时',
  'terms.sent.who': '谁能看到',
  'terms.sent.signIn.what': '你的邮箱和密码',
  'terms.sent.signIn.when': '创建账户、登录或确认邮箱时',
  'terms.sent.signIn.who': '登录服务保存你的邮箱，密码只以无人能读的哈希保存。',
  'terms.sent.membership.what': '你的登录令牌',
  'terms.sent.membership.when':
    '应用启动时、你回到电脑前时，以及打开 Plus 功能时',
  'terms.sent.membership.who': '不保存任何内容。服务器只回答你的会员是否有效。',
  'terms.sent.payment.what': '你的付款邮箱和会员状态，由 Buy Me a Coffee 发送',
  'terms.sent.payment.when': '你付款、续订或取消时',
  'terms.sent.payment.who':
    '作者，用于把付款对应到你的账户。请使用登录所用的邮箱付款。',
  'terms.sent.looks.what': '你的登录令牌',
  'terms.sent.looks.when':
    '下载或更新 Plus 样式时，以及应用检查哪些分享的场景已被下架时',
  'terms.sent.looks.who':
    '不保存任何内容。每个样式都带有签名，你的电脑会在播放前校验签名。',
  'terms.sent.catalogue.what': '不含任何关于你的信息',
  'terms.sent.catalogue.when':
    '样式选择器显示有哪些 Plus 样式时，无论是否有账户',
  'terms.sent.catalogue.who': '不保存任何内容。该请求只获取公开的样式列表。',
  'terms.sent.community.what':
    '你的用户名和显示名称、你的消息及其中的 @提及、你提交的举报，以及你屏蔽的人',
  'terms.sent.community.when': '创建个人资料、发言、举报或屏蔽时',
  'terms.sent.community.who':
    '消息、用户名和显示名称：所有已登录的会员。举报：作者。屏蔽：只有你。',
  'terms.sent.board.what':
    '每天一个数字：实际播放音乐的整分钟数，最多 {capHours} 小时，以及对应日期',
  'terms.sent.board.when':
    '仅在你加入排行榜后：你回到电脑前时（最多每 {uploadHours} 小时一次），以及打开排行榜时',
  'terms.sent.board.who':
    '你的用户名、显示名称、积分及其构成：所有已登录的会员。',
  'terms.sent.sceneExport.what': '你导出的场景，附带你的显示名称和账户 ID',
  'terms.sent.sceneExport.when': '在工作室中点击“导出”时',
  'terms.sent.sceneExport.who':
    '场景本身不会被保存。作者会保留一条记录：你导出了哪个场景、哪个版本、何时导出，以及一个指纹，用来识别被封禁的场景。收到文件的人会看到你的显示名称和账户 ID。',
  'terms.sent.sceneLike.what': '屏幕上正在显示哪位会员的场景，以及你对它的赞',
  'terms.sent.sceneLike.when':
    '播放会员的场景时（用于显示点赞数），以及你点击爱心或取消点赞时',
  'terms.sent.sceneLike.who':
    '屏幕上显示的内容不会被保存。会员能看到一个场景有多少个赞，但看不到是谁点的。',
  'terms.sent.scenePublish.what':
    '你发布的场景、它的图片、你选的分类、你的显示名和账户 ID',
  'terms.sent.scenePublish.when': '在工作室中点击“发布”时',
  'terms.sent.scenePublish.who':
    '在你取消发布之前，“可视化”中的所有 Plus 会员：场景、图片、分类和你的显示名。作者会保留你发布过的记录，与导出相同。',
  'terms.sent.gallery.what':
    '在“可视化”中：你搜索的内容、你打开和添加的场景，以及你举报的场景及其原因',
  'terms.sent.gallery.when': '浏览“可视化”、点击“添加”或发送举报时',
  'terms.sent.gallery.who':
    '搜索和打开的内容不会被保存。会员能看到一个场景被添加了多少次，但看不到是谁。举报：仅作者可见。',

  'terms.never.title': '永远不会离开你电脑的内容',
  'terms.never.p1':
    '你的音频，以及关于你所听内容的一切：曲目名称、艺人、文件、文件夹和播放列表。',
  'terms.never.p2': '你的 EQ 设置、预设和配置文件。',
  'terms.never.p3': '你的音频设备及其名称，以及你电脑上的其他应用。',
  'terms.never.p4':
    '你创作的场景和你的工作室文件夹，除非你导出或发布某个场景。',

  'terms.protect.title': '如何保护',
  'terms.protect.p1': '每个请求在传输中都经过加密。',
  'terms.protect.p2':
    '规则在服务器上，而不在应用里：每个账户只能修改自己的数据，被修改过的 FluidEQ 副本得到的回答完全相同。',
  'terms.protect.p3': '排行榜和聊天只显示用户名，从不显示邮箱或账户 ID。',
  'terms.protect.p4':
    '服务器由作者运营，作者可以看到其中保存的内容，用于维持运行和管理社区。任何内容都不会被出售、分享或用于广告，也没有跟踪或统计分析。',
  'terms.protect.p5':
    '服务运行在 Supabase 上（登录、数据库和文件），邮件通过 Resend 发送；付款经由 Buy Me a Coffee。每一方只获得其环节所需的信息。',
  'terms.protect.p6':
    'FluidEQ 不保存 IP 地址。托管服务商会把请求（含地址）记录在短期日志中，以保证服务运行和安全。',

  'terms.fair.title': '排行榜的公平规则',
  'terms.fair.p1':
    '收听时长由你电脑上的应用统计，服务器无法亲眼看到。因此它会核查每个数字：每天不超过 {capHours} 小时，不接受尚未开始的日期，不接受超过 {windowDays} 天的旧数据，任何一天的增长都不能快过时钟。消息和提及在服务器上根据实际发布的内容统计。',
  'terms.fair.p2':
    '每个人获得积分的方式都一样，作者也不例外。篡改应用或其发送的数据、自动化收听或发帖、或用多个账户刷榜，都会被移出排行榜，也可能被移出社区。',
  'terms.fair.p3':
    '你的场景每获得一个赞，就得 {likePoints} 分。每位会员对每个场景只计一次，只计 Plus 会员的赞，且永远不计你自己账户的赞。用你自己的第二个账户点赞，视同用多个账户刷榜。',

  'terms.community.title': '社区规则',
  'terms.community.p1':
    '友善待人。禁止骚扰、仇恨、威胁、垃圾信息、违法内容，以及任何人的个人信息。所有会员都能读到你发布的内容，只分享你愿意被读到的内容。',
  'terms.community.p2':
    '你可以随时删除自己的消息。作者可以删除违反规则的消息并暂停相关账户。举报一条消息即可标记它；只有作者能看到举报。',

  'terms.keep.title': '保存哪些内容，以及如何删除',
  'terms.keep.p1':
    '排行榜：在账户面板中点“删除我的所有数据”，会一次性删除你发送过的每一天。你的电脑只保留最近 {windowDays} 天的总数。',
  'terms.keep.p2': '消息：一直保留，直到你或作者删除。',
  'terms.keep.p3':
    '会员：你的付款邮箱和状态会被保存，用于把付款对应到你的账户，并随账户一起删除。',
  'terms.keep.p4':
    '你的账户：申请删除后，它会在 {deletionDays} 天内连同你的个人资料、消息、排行榜记录和会员记录一起删除。',
  'terms.keep.p5':
    '场景：你发布的场景会一直留在“可视化”中，直到你取消发布，届时它和它的图片会被立即移除。你发布的内容、你的导出记录、你添加的场景、你点过的赞以及你的场景收到的赞，都会随账户一起删除。因违反本条款而被封禁的场景只保留其指纹，不含你的名字，以便继续封禁。',

  'terms.looks.title': 'Plus 样式',
  'terms.looks.p1':
    'Plus 样式是作者本人的作品，在你作为会员期间授权你个人使用。请不要复制、分享或转售。',
  'terms.looks.p2':
    'FluidEQ 本身仍是基于 GPL 的自由软件。这里的任何内容都不会改变 GPL 赋予你的权利。',

  'terms.scenes.title': '你创作的场景',
  'terms.scenes.p1':
    '你在工作室中创作的场景归你所有。FluidEQ 不拥有它，适用于 FluidEQ 的 GPL 也不适用于它。',
  'terms.scenes.p2':
    '在你选择导出之前，它只保存在你的电脑上。你不分享，你创作的任何内容就不会被分享。',
  'terms.scenes.p3':
    '导出场景时，你允许 FluidEQ 检查它、移除其着色器中的注释，并以你的名字为它签名，让其他 Plus 会员可以播放它，并看到它是你创作的。这就是全部的许可。未经你事先同意，作者不会出售你的场景、将其用于广告，或把它变成 Plus 样式之一；你对自己的作品做其他任何事情也不受限制。',
  'terms.scenes.p4':
    '分享是 Plus 的一部分，而不是一份工作：没有人因场景获得报酬，也没有人为场景付费。你得到的回报，是其他会员分享的所有场景。',
  'terms.scenes.p5':
    '如果你加入了排行榜，喜欢你场景的会员会让你获得积分。点赞由服务器统计；参见“排行榜的公平规则”。',
  'terms.scenes.p6':
    '只分享你有权分享的作品：你自己的照片和绘画，或其所有者允许使用的作品。社区规则对场景与对消息同样适用。如果某个场景违反本条款或侵犯他人权利，作者可以阻止它被打开。',
  'terms.scenes.p7':
    '其他会员分享的场景是他们的作品，在你是会员期间授权你个人使用。你可以播放它、为它点赞，并把文件原样转给其他 Plus 会员。请不要修改它、把它当作你的作品、在其他地方发布或出售它。',
  'terms.scenes.p8':
    '你发出的文件会留在拥有它的人手中。如果你希望某个场景在所有地方都无法打开，请联系作者，他可以像封禁违规场景一样封禁它。',
  'terms.scenes.p9':
    '如果你把场景发布到“可视化”，你也允许 FluidEQ 在你取消发布之前把它保存在那里，并连同它的图片、分类和你的显示名一起展示给 Plus 会员。无论是否拥有 Plus，你都可以随时取消发布。已添加它的会员会保留自己的副本，条件与你发给他们的文件相同。',
  'terms.scenes.p10':
    '发布是自愿的，与导出文件是两回事。任何会员都可以举报已发布的场景；只有作者会阅读举报，并可下架违反本条款或他人权利的场景。',

  'terms.changes.title': '变更与细则',
  'terms.changes.p1':
    '如果这些条款发生变更，新版本会连同日期显示在这里，并在对你生效前由应用通知你。',
  'terms.changes.p2':
    '在法律允许的范围内，FluidEQ 和 Plus 按现状提供，不附带任何保证。作者承担的责任不超过你过去十二个月为 Plus 支付的金额。这里的任何内容都不会剥夺法律赋予你作为消费者的权利。',

  'terms.contact.title': '联系方式',
  'terms.contact.p1':
    '问题、退款、删除账户，或举报使用了你作品的场景：{contact}。',

  'terms.agree.check': '我已阅读这些条款（包括应用会发送的内容），并同意。',
  'terms.agree.continue': '同意并前往付款',
  'terms.agree.opening': '正在打开 Buy Me a Coffee…',
  'terms.agree.hint':
    '付款页面会在你的浏览器中打开。请使用与 FluidEQ 账户相同的邮箱。',
  'terms.back': '返回',
  'terms.error.outdated': '条款已更新。请先更新 FluidEQ 阅读新版本，再订阅。',
  'terms.error.priceOutdated':
    '价格已变更。请先更新 FluidEQ 查看当前价格，再订阅。',
};

export default terms;
