const terms = {
  'terms.eyebrow': 'FluidEQ Plus',
  'terms.title': 'Plus条款与隐私',
  'terms.meta': '第 {version} 版 · 自 {date} 起生效',
  'terms.intro':
    '这些条款涵盖你的 FluidEQ 账户和 Plus：会员、付款、“可视化”、你分享的场景以及排行榜。条款列出了应用发送到 FluidEQ 服务的全部内容、何时发送、谁能看到，并在末尾列出 FluidEQ 连接的所有其他地方。',
  'terms.link': 'Plus条款与隐私',

  'terms.short.title': '简要版本',
  'terms.short.price.title': '{price}，随时可取消',
  'terms.short.price.body':
    '通过 Buy Me a Coffee 付款。FluidEQ 从不接触你的银行卡。',
  'terms.short.free.title': '免费的一切都不会被拿走',
  'terms.short.free.body': 'FluidEQ 依然可以离线、无需账户地使用，一如既往。',
  'terms.short.choice.title': '分享什么由你决定',
  'terms.short.choice.body':
    '除非你加入，否则排行榜是关闭的；你创作的任何内容都不会离开你的电脑，除非你导出或发布它。',
  'terms.short.music.title': '绝不涉及你的音乐',
  'terms.short.music.body': 'FluidEQ 的服务从不接收你的音频、曲目名称或 EQ。',

  'terms.membership.title': '会员',
  'terms.membership.p1':
    '使用免费账户，你可以浏览“可视化”，查看每个已发布场景的图片和详情，试用 FluidEQ 的每个免费示例场景各 {tasteSeconds} 秒，并查看排行榜。Plus 可以播放和添加每一个场景，解锁 Plus 样式，让你在工作室中创作场景并导出或发布，让你加入排行榜，还能把场景放到你的桌面和 RGB 灯光上。价格为 {price}，在每个已付费周期结束时自动续订，直到你取消。',
  'terms.membership.p2':
    '付款由 Buy Me a Coffee 按其自身条款处理。FluidEQ 从不接触你的银行卡或银行信息。你可以随时在 Buy Me a Coffee 上取消：Plus 会保持到已付费周期结束，之后不再扣费。',
  'terms.membership.p4':
    '会员结束后，Plus 样式和会员创作的场景会重新锁定，FluidEQ 回到免费样式；你创作的内容不会被删除。没有网络连接时，Plus 仍可使用到已付费周期结束；如果应用未能确认续订，在此之后最多还可使用 {graceDays} 天。免费的一切永远不受影响。',
  'terms.membership.p5':
    '作者可以把 Plus 作为礼物赠送给某个电子邮箱地址。某个账户确认该地址后，赠送的 Plus 即会开启，并持续到作者设定的结束日期（如有），或直到作者将其收回。',

  'terms.account.title': '你的账户',
  'terms.account.p1':
    '账户由一个电子邮箱、一个密码以及（如果你提供的话）一个名字组成，你需要年满 {age} 岁才能创建。密码经加密传送到登录服务，并且只以单向哈希的形式保存，任何人都无法读回，包括作者。',
  'terms.account.p2':
    '你的邮箱会收到确认地址和重置密码的验证码。邮箱永远不会展示给其他会员：在排行榜和“可视化”中，你以自己选择的用户名和显示名称出现。',
  'terms.account.p3':
    '在你的电脑上，应用会保存由操作系统加密的登录会话。账户仅限个人使用，请勿与他人分享密码。',
  'terms.account.p4':
    '一个账户最多可同时在 {computers} 台电脑上保持登录——家里和公司，或“共享音频”在其间播放的那些电脑。如果再在一台电脑上登录，最久未使用的那台电脑会在一小时内退出登录。',

  'terms.sent.title': '应用会发送什么，以及何时发送',
  'terms.sent.intro':
    '以下是应用发送到 FluidEQ 服务的全部内容，始终通过加密连接传输。FluidEQ 连接的其他地方在下文列出。',
  'terms.sent.when': '何时',
  'terms.sent.who': '谁能看到',
  'terms.sent.signIn.what': '你的邮箱和密码，以及你注册时填写的名字',
  'terms.sent.signIn.when': '创建账户、登录、确认邮箱或重置密码时',
  'terms.sent.signIn.who':
    '登录服务保存你的邮箱和名字，密码只以无人能读的哈希保存。',
  'terms.sent.membership.what': '你的登录令牌和账户 ID',
  'terms.sent.membership.when':
    '应用启动时、你登录时、你回到电脑前时（最多每几个小时一次），以及你点击“再次检查”时',
  'terms.sent.membership.who':
    '只有你和作者。服务会确认你的会员资格，查找用你已确认的邮箱完成的 Buy Me a Coffee 付款，并读取你同意的是哪个版本的条款，以便条款变更时应用能通知你。',
  'terms.sent.payment.what':
    '你付款所用的邮箱、你的会员状态和周期，以及 Buy Me a Coffee 上你会员资格的 ID，由 Buy Me a Coffee 发送',
  'terms.sent.payment.when': '你付款、续订或取消时',
  'terms.sent.payment.who':
    '作者，用于把付款对应到你的账户。付款只会对应到已确认的邮箱地址，因此请使用登录所用的邮箱付款。',
  'terms.sent.agreement.what': '你同意了哪个版本的条款，以及同意的时间',
  'terms.sent.agreement.when': '你继续前往付款、导出场景或发布场景时',
  'terms.sent.agreement.who': '作者。它会随你的账户保存，即使你最终没有付款。',
  'terms.sent.looks.what':
    '你的登录令牌，以及你已安装且有新版本的 FluidEQ 场景的 ID，用于下载这些新版本',
  'terms.sent.looks.when':
    '应用启动时、你回到电脑前时以及你打开外观列表时，用于获取新版本，并了解哪些分享的场景已被下架',
  'terms.sent.looks.who':
    '不会保存任何内容。每个样式都带有签名，你的电脑会在播放前校验签名。',
  'terms.sent.catalogue.what': '不含任何关于你的信息',
  'terms.sent.catalogue.when':
    'FluidEQ 启动时（最多每几个小时一次），用于显示有哪些 Plus 样式，无论是否有账户',
  'terms.sent.catalogue.who': '不会保存任何内容。该请求只获取公开的样式列表。',
  'terms.sent.profile.what': '你选择的用户名和显示名称',
  'terms.sent.profile.when': '你在排行榜上选择它们时',
  'terms.sent.profile.who':
    '所有已登录的账户：显示在排行榜上、你发布的场景上，以及你在“可视化”中的作者主页上，并可在“可视化”中被搜索到。冒充 FluidEQ 或其工作人员的名称会被拒绝。',
  'terms.sent.board.what':
    '每台电脑每天一个数字：实际播放音乐的整分钟数，最多 {capHours} 小时，以及对应日期和一个用来区分你各台电脑的随机编号',
  'terms.sent.board.when':
    '只有你加入排行榜才会发送：加入时、你回到电脑前时（最多每 {uploadHours} 小时一次），以及你打开排行榜或“可视化”中某位作者的主页时',
  'terms.sent.board.who':
    '你的用户名、显示名称、名次、积分及其构成：所有已登录的账户，显示在排行榜和你的作者主页上。',
  'terms.sent.sceneExport.what': '你导出的场景：它的代码、设置、图片和氛围元素',
  'terms.sent.sceneExport.when': '在工作室中点击“导出”时',
  'terms.sent.sceneExport.who':
    '服务会检查场景、移除其代码中的注释并为它签名，同时把你的显示名称和账户 ID 写入文件。服务会保留一条记录：你导出了哪个场景、哪个版本、何时导出，以及该文件的指纹。收到文件的人会看到你的显示名称和账户 ID。',
  'terms.sent.sceneLike.what': '屏幕上正在显示哪位会员的场景，以及你对它的赞',
  'terms.sent.sceneLike.when':
    '播放会员的场景时（用于显示点赞数），以及你点击爱心或取消点赞时',
  'terms.sent.sceneLike.who':
    '你的赞会随你的账户保存。会员能看到一个场景有多少个赞，但看不到是谁点的。关于屏幕上显示的内容，其他任何信息都不会被保存。',
  'terms.sent.scenePublish.what':
    '你发布的场景，内容与导出时相同，并附带一张封面图片、最多两个分类，以及一段关于新内容的说明（如果你写了的话）',
  'terms.sent.scenePublish.when': '在工作室中点击“发布”时',
  'terms.sent.scenePublish.who':
    '在你取消发布之前，所有已登录 FluidEQ 的人都能在“可视化”中看到它的图片、名称、分类、版本说明、点赞数和添加数，以及你的显示名称、用户名和作者主页。只有 Plus 会员可以播放和添加这个场景。FluidEQ 的作者会保存该场景，并像导出时一样保存你发布它的记录。',
  'terms.sent.gallery.what':
    '在“可视化”中：你搜索的内容、你打开的场景和作者、你添加的场景，以及你举报的场景及其原因',
  'terms.sent.gallery.when':
    '浏览“可视化”、点击“添加”或“举报”时，以及应用为查找你添加的场景的新版本而请求这些场景作者的场景时',
  'terms.sent.gallery.who':
    '搜索和打开的内容不会被保存。添加会随你的账户保存；会员能看到一个场景被多少人添加，但看不到是谁。举报会随你的账户以及该场景当时状态的指纹一起保存；FluidEQ 的作者能看到一个场景有多少条举报及其原因，但看不到是谁发送的。',
  'terms.sent.forum.what':
    '在“论坛”中：你的 GitHub 登录信息，以及之后你阅读、搜索、预览、发布、编辑或做出反应的内容',
  'terms.sent.forum.when':
    '打开论坛会从 GitHub 下载其公开话题，其中不含任何关于你的信息；其余内容只在你使用 GitHub 登录之后才会发送',
  'terms.sent.forum.who':
    'GitHub，按其自身条款处理；帖子在本项目的 GitHub Discussions 中公开。登录、保持登录和退出登录时，你的 GitHub 登录信息会经过 FluidEQ 的服务，服务会附加 FluidEQ 的密钥，且不保存任何内容。',

  'terms.never.title': 'FluidEQ 的服务从不接收哪些内容',
  'terms.never.p1':
    '你的音频，以及关于你所听内容的一切：曲目名称、艺人、文件、文件夹和播放列表。',
  'terms.never.p2': '你的 EQ 设置、预设和配置文件。',
  'terms.never.p3':
    '你的音频设备、显示器和 RGB 灯光及其名称，以及你电脑上的其他应用。',
  'terms.never.p4':
    '你的工作室项目、其中的照片和你的备注，除非你导出或发布场景。你为 AI 助手复制的提示词只会去往你粘贴的地方。',
  'terms.never.p5':
    'FluidEQ 为了正常工作而在你电脑上记住的内容：你的桌面背景和灯光、你看过的场景版本，以及任何曾导致你的显卡驱动重置的场景。',

  'terms.protect.title': '如何保护',
  'terms.protect.p1': '每个请求在传输中都经过加密。',
  'terms.protect.p2':
    '规则在服务器上，而不在应用里：每个账户只能修改自己的数据，被修改过的 FluidEQ 副本得到的回答完全相同。',
  'terms.protect.p3':
    '排行榜和“可视化”只显示用户名和显示名称，从不显示邮箱地址。账户 ID 从不显示，但它包含在场景文件中，以及“可视化”发送给应用的数据中。',
  'terms.protect.p4':
    '服务由作者运营，作者可以看到其中保存的内容，用于维持服务运行、匹配付款和管理会员发布的内容。任何内容都不会被出售或用于广告，也没有跟踪或统计分析。',
  'terms.protect.p5':
    '服务运行在 Supabase 上（登录、数据库和文件），邮件通过 Resend 发送；付款经由 Buy Me a Coffee，论坛经由 GitHub。每一方只获得其环节所需的信息。',
  'terms.protect.p6':
    'FluidEQ 不保存 IP 地址。Supabase 会把每个请求的地址记录在短期日志中，并把每台已登录电脑的地址和应用信息与该电脑的会话一起保存，同时记入 Supabase 自己的登录安全日志，以保证登录正常且安全。',
  'terms.protect.p7':
    '场景都带有签名，你的电脑会在播放前校验签名。应用更新只有在其上 FluidEQ 自己的签名经过校验之后才会安装。',

  'terms.fair.title': '排行榜的公平规则',
  'terms.fair.p1':
    '积分来自收听和点赞：每播放一小时音乐得 {hourPoints} 分，每个播放音乐至少 {activeMinutes} 分钟的日子得 {dayPoints} 分，你的场景每获得一个赞得 {likePoints} 分。排行榜显示前 100 名，并且只在账户拥有 Plus 期间对其排名；其天数会保留，Plus 恢复后重新计入。',
  'terms.fair.p2':
    '收听时长由你电脑上的应用统计，服务器无法亲眼看到。因此它会核查每个数字：每天不超过 {capHours} 小时，不接受尚未开始的日期，不接受超过 {windowDays} 天的旧数据，任何一天的增长都不能快过时钟。你各台电脑的数字会加总为同一天，而这一天的增长同样不能快过时钟，因此多台电脑同时播放，加起来也不会超过实际经过的时间。',
  'terms.fair.p3':
    '每个人获得积分的方式都一样，作者也不例外。篡改应用或其发送的数据、自动化收听，或用多个账户刷榜，都会让你被移出排行榜，还可能导致该账户无法发布、点赞和举报场景。',
  'terms.fair.p4':
    '每位会员对每个场景的赞只计一次，只有 Plus 会员点的赞才计入，且永远不计你自己账户的赞。已下架场景上的赞，或来自被封禁账户的赞，都不计入。用你自己的第二个账户点赞，视同用多个账户刷榜。',

  'terms.rules.title': '发布内容的规则',
  'terms.rules.p1':
    '友善待人。无论是场景本身，还是它的名称、图片或说明，都禁止出现骚扰、仇恨、威胁、垃圾信息、违法内容，以及任何人的个人信息。所有已登录的人都能看到你发布的内容，所以只分享你愿意被人看到的内容。',
  'terms.rules.p2':
    '可以从 FluidEQ 的场景中汲取灵感，但请创作你自己的场景：如果一个场景的大部分内容照搬其中某个场景，你导出或发布它时会被拒绝。',
  'terms.rules.p3':
    '你可以随时取消发布自己的场景。任何已登录的人都可以举报已发布的场景。FluidEQ 的作者可以下架一个场景——这会让它在任何地方都无法打开，在“你的场景”中将其标记为已下架，并暂停你的导出和发布 {takedownDays} 天；还可以封禁一个账户——这会隐藏该账户的场景，并使其无法发布、点赞和举报。',
  'terms.rules.p4':
    '为了让服务对每个人都正常运行，每个账户每小时最多可导出或发布 {sharesPerHour} 个场景（被拒绝的尝试也计算在内），并且最多可保持 {maxPublished} 个场景处于已发布状态。',

  'terms.keep.title': '保存哪些内容，以及如何删除',
  'terms.keep.p1':
    '排行榜：你发送的每一天都会一直留在排行榜上，直到你删除它们。在账户面板中点击“删除我的全部数据”，会一次性删除你发送过的每一天；退出排行榜只会停止发送。你的电脑只保留最近 {windowDays} 天的总数。',
  'terms.keep.p2':
    '你的用户名和显示名称：在你拥有账户期间保留，并随账户一起删除。',
  'terms.keep.p3':
    '会员：你的付款邮箱、会员状态和 Buy Me a Coffee 上你会员资格的 ID 会被保存，用于把付款对应到你的账户，并随账户一起删除。每次付款事件的记录只保留 Buy Me a Coffee 的 ID 和时间。',
  'terms.keep.p4':
    '你的账户：申请删除后，它会在 {deletionDays} 天内被删除，一并删除的还有你的个人资料、排行榜上的每日记录、会员资格、同意记录、点赞、添加、举报，以及你发布的场景及其文件。赠送给你邮箱的 Plus 会一直保留，直到作者将其移除。',
  'terms.keep.p5':
    '场景：取消发布会把场景连同其图片、文件和版本历史从“可视化”中移除。它收到的点赞、添加和举报会一直保留到相应账户被删除为止，如果你再次发布它，这些会重新计入。因违反本条款而被封禁的场景会保留一个由你的账户 ID 和该场景 ID 生成的指纹，以及封禁原因和日期，以便它继续被封禁。',
  'terms.keep.p6':
    '在你的电脑上：Plus 样式和你添加的场景（加密保存）；图库图片（最多 128 MB）；以及被封禁场景的列表。它们会一直保留，直到你将其移除或卸载 FluidEQ。',

  'terms.looks.title': 'Plus 样式',
  'terms.looks.p1':
    'Plus 样式是作者本人的作品，在你作为会员期间授权你个人使用。请不要复制、分享或转售。',
  'terms.looks.p2':
    'Plus 会员可以在工作室中打开 FluidEQ 自己的场景，查看其内部并汲取灵感。以这种方式打开的副本不能添加到你的外观、导出或发布。',
  'terms.looks.p3':
    'FluidEQ 本身仍是基于 GPL 的自由软件。这里的任何内容都不会改变 GPL 赋予你的权利。',

  'terms.scenes.title': '你创作的场景',
  'terms.scenes.p1':
    '你在工作室中创作的场景归你所有。FluidEQ 不拥有它，适用于 FluidEQ 的 GPL 也不适用于它。',
  'terms.scenes.p2':
    '工作室场景保存在你的电脑上，除非你选择导出、发布或与AI助手等其他工具共享。',
  'terms.scenes.p3':
    '导出场景时，你允许 FluidEQ 检查它（包括与 FluidEQ 自己的场景进行比对）、移除其代码中的注释，并以你的显示名称和账户 ID 为它签名，让其他 Plus 会员可以播放它，并看到它是你创作的。这就是全部的许可：FluidEQ 的作者不会出售你的场景或将其用于广告，未经你事先同意不会把它变成 Plus 样式之一，也不会阻止你对自己的作品做任何其他事情。',
  'terms.scenes.p4':
    '分享是 Plus 的一部分，而不是一份工作：没有人因场景获得报酬，也没有人为场景付费。你得到的回报，是其他会员分享的所有场景。',
  'terms.scenes.p5':
    '如果你加入了排行榜，喜欢你场景的会员会让你获得积分。点赞由服务器统计；参见“排行榜的公平规则”。',
  'terms.scenes.p6':
    '只分享你有权分享的作品：你自己的照片和绘画，或其所有者允许使用的作品。发布内容的规则适用于你分享的每一个场景。如果某个场景违反本条款或侵犯他人权利，FluidEQ 的作者可以阻止它被打开。',
  'terms.scenes.p7':
    '其他会员分享的场景是他们的作品，在你是会员期间授权你个人使用。你可以播放它、为它点赞，并把文件原样转给其他 Plus 会员。请不要修改它、把它当作你的作品、在其他地方发布或出售它。',
  'terms.scenes.p8':
    '你发出的文件会留在持有它的人手中，取消发布也不会收回会员已经添加的副本；在这些会员拥有 Plus 期间，这些副本仍授权供个人使用。如果你希望某个场景在任何地方都无法打开，请向 FluidEQ 的作者提出，作者可以像处理违反规则的场景一样封禁它。',
  'terms.scenes.p9':
    '如果你把场景发布到“可视化”，你也允许 FluidEQ 在你取消发布之前把它保存在那里，把它的图片、名称、分类和版本说明连同你的显示名称和用户名展示给所有已登录 FluidEQ 的人，并把场景本身提供给 Plus 会员播放和添加。你为它设置的氛围元素会随场景一起分发，选择“氛围”模式的会员会在自己的窗口周围看到这些元素。无论是否拥有 Plus，你都可以随时取消发布。',
  'terms.scenes.p10':
    '发布是自愿的，与导出文件是两回事。版本说明和它所属的场景一样是公开的。',

  'terms.elsewhere.title': 'FluidEQ 还会连接哪些地方',
  'terms.elsewhere.p1':
    '更新：启动时以及你回到电脑前时，FluidEQ 会在其发布源中检查是否有新版本，并且只有在校验签名之后才会安装。该请求携带一个由更新程序保存在这台电脑上的随机编号，不含任何关于你的信息。',
  'terms.elsewhere.p2':
    '耳机预设：FluidEQ 打开时会在 GitHub 上检查是否有新的耳机预设；“卷积”标签页会在你打开它或选择耳机时从 GitHub 下载 AutoEq 文件。',
  'terms.elsewhere.p3':
    '你使用的模型：“卡拉 OK 制作器”从 Hugging Face 下载其语音、人声和旋律模型，语音降噪器从 GitHub 下载其模型。你的音频在你的电脑上处理。',
  'terms.elsewhere.p4':
    '“共享音频”：音频、正在播放的内容和这台电脑的名称只会以加密方式发送到你在局域网中配对的那台电脑。这台电脑的名称也会在该网络上广播，以便另一台电脑找到它。',
  'terms.elsewhere.p5':
    '“在线媒体”：YouTube、Bandcamp、Twitch 以及你在 FluidEQ 中打开的其他网站，会按其自身条款接收你在那里进行的操作。',
  'terms.elsewhere.p6':
    '“报告问题”：在你的浏览器中打开一个公开的 GitHub 议题，或在你的邮件应用中打开一封发给 FluidEQ 作者的私密邮件，或为你复制报告，其中附有最近的日志行，你可以在发送前阅读。FluidEQ 本身不发送任何内容。',
  'terms.elsewhere.p7':
    '灯光和桌面背景：灯光只与这台电脑上的 Razer Chroma 和 Windows 通信，桌面背景从不联网。',
  'terms.elsewhere.p8':
    '你的浏览器：付款、你的会员页面、支持链接以及论坛的 GitHub 登录都会在浏览器中打开，适用这些网站各自的条款。',

  'terms.changes.title': '变更与细则',
  'terms.changes.p1':
    '如果这些条款发生变更，新版本会连同日期显示在这里，并在对你生效前由应用通知你。',
  'terms.changes.p2':
    '在法律允许的范围内，FluidEQ 和 Plus 按现状提供，不附带任何保证。作者承担的责任不超过你过去十二个月为 Plus 支付的金额。这里的任何内容都不会剥夺法律赋予你作为消费者的权利。',

  'terms.contact.title': '联系方式',
  'terms.contact.p1': '问题、删除账户，或举报使用了你作品的场景：{contact}。',

  'terms.agree.check': '我已阅读这些条款（包括应用会发送的内容），并同意。',
  'terms.agree.continue': '同意并前往付款',
  'terms.agree.opening': '正在打开 Buy Me a Coffee…',
  'terms.agree.hint':
    '付款页面会在你的浏览器中打开。请使用与 FluidEQ 账户相同的邮箱。',
  'terms.back': '返回',
  'terms.error.outdated': '条款已更新。请先更新 FluidEQ 阅读新版本，再订阅。',
  'terms.error.priceOutdated':
    '价格已变更。请先更新 FluidEQ 查看当前价格，再订阅。',
} as const;

export default terms;
