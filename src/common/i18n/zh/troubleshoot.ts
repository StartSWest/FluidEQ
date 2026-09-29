const troubleshoot = {
  'troubleshoot.title': '解决音频问题',
  'troubleshoot.description':
    '请从上往下逐项尝试，哪一步有效就停在哪一步。越往下改动越大，大多数问题第一步就能解决。',
  'troubleshoot.footer':
    '以上都试过还是不行？请使用同一菜单中的 **{report}**：它会收集日志，去掉任何能识别你的信息，并在发送前把完整内容给你看。',
  'troubleshoot.tried': '已尝试',
  'troubleshoot.restart.title': '重启 Windows 音频',
  'troubleshoot.restart.when':
    '声音停止了，或者正在播放时图表变成一条直线。几乎所有情况都能靠这一步解决，请先试它。',
  'troubleshoot.restart.cost': '会静音几秒钟。Windows 会请求权限。',
  'troubleshoot.apo.reselect.title': '在 Equalizer APO 中重新选择设备',
  'troubleshoot.apo.reselect.when':
    '一个设备有均衡效果而另一个没有，或者刚插上的耳机被忽略了。Equalizer APO 对每个输出分别挂接，新设备要勾选后才会挂接。',
  'troubleshoot.apo.reselect.cost':
    '会打开 Equalizer APO 的 Device Selector。之后需要重启。',
  'troubleshoot.apo.openSelector': '打开 Device Selector',
  'troubleshoot.apo.mode.title': '试试另一种安装方式',
  'troubleshoot.apo.mode.when':
    '设备已在 Device Selector 中勾选却没有效果，或者一勾选该设备就完全没声音了。Equalizer APO 可以用两种不同方式挂接到 Windows 音频上，有些硬件只支持其中一种。',
  'troubleshoot.apo.mode.cost': '需要重启一次。可以用同样的方法切回去。',
  'troubleshoot.apo.mode.detail':
    '在 Device Selector 中打开 **Troubleshooting options**。默认以 **APO** 方式安装，大多数电脑都适用。**Install as SFX/EFX** 是另一种方式，适合驱动自带音效的设备——很多笔记本和游戏音频设备都是这样。如果勾选后设备不工作了，先试试另一种方式，再下结论说它无法均衡。',
  'troubleshoot.apo.reinstall.title': '重新安装 Equalizer APO',
  'troubleshoot.apo.reinstall.when':
    '前两步都没有效果，或者 Windows 更新后均衡器就一直不工作。它的安装程序同时也是修复工具：会重新注册音频组件，并再次打开设备列表。',
  'troubleshoot.apo.reinstall.cost':
    '需要管理员权限，之后还要重启电脑。你的 FluidEQ 配置和预设不会受影响。',
  'troubleshoot.apo.readd.title': '移除设备、重启、再添加回来',
  'troubleshoot.apo.readd.when':
    '只在重装后某个设备仍然不对时才用。在 Device Selector 中取消勾选它，重启电脑，然后重新勾选并再重启一次。',
  'troubleshoot.apo.readd.cost': '需要重启两次。',
  'troubleshoot.apo.readd.detail':
    '重启两次并不是迷信。Equalizer APO 在电脑启动时挂接到音频端点上，所以在 Windows 运行时移除的设备会一直处于半挂接状态，直到重启为止；在那之前重新添加，只会把故障状态原样带回来。',
  'troubleshoot.engine.enable.title': '把 FluidEQ 引擎重新装回输出设备',
  'troubleshoot.engine.enable.when':
    '一个设备有均衡效果而另一个没有，或者刚插上的耳机被忽略了。引擎对每个输出分别挂接，而 Windows 更新可能会把它从原本已挂接的输出上移除。',
  'troubleshoot.engine.permission':
    'Windows 会请求权限，音频会短暂重启。不需要重启电脑。',
  'troubleshoot.engine.remove.title': '从这个输出上移除 FluidEQ 引擎',
  'troubleshoot.engine.remove.when':
    '只有这个输出出了问题，而上面的办法都解决不了，或者你想把它交还给另一个音频程序。引擎会从 Windows 当前正在播放的输出上移除，原先被它替换的内容会恢复。',
  'troubleshoot.engine.remove.cost':
    'Windows 会请求权限，音频会短暂重启。其他输出不受影响，上一步可以把它装回去。',
  'troubleshoot.engine.remove.action': '从这个输出移除',
} as const;

export default troubleshoot;
