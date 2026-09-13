const lighting = {
  'lighting.title': '动态灯效',
  'lighting.rail.blurb': '桌面灯光跟随场景',
  'lighting.description': '键盘、鼠标、鼠标垫、耳机和支架随场景亮起',

  'lighting.gate.title': '让键盘、鼠标和耳机随每个 Plus 场景亮起',
  'lighting.gate.body':
    '动态灯效是 FluidEQ Plus 的一部分。你的设备会采用图表上场景的颜色，并随节拍律动。',
  'lighting.gate.cta': '了解 Plus',

  'lighting.unsupported.title': '动态灯效仅适用于 Windows',
  'lighting.unsupported.body':
    '它通过 Windows Dynamic Lighting 和 Razer Chroma 点亮设备，而两者都只在 Windows 上提供。',

  'lighting.switch': '播放 Plus 场景时点亮我的设备',
  'lighting.status.live': '正在跟随 {scene}',
  'lighting.status.waiting': '等待音乐',
  'lighting.status.nothingLit': '场景正在播放，但没有设备亮起',
  'lighting.status.off': '已关闭：你的设备保持自己的灯效',
  'lighting.status.noScene': '选择一个 Plus 场景，你的设备就会跟随它',
  'lighting.pickScene': '浏览可视化',
  'lighting.showGraph': '显示图表',

  'lighting.brightness': '亮度',
  'lighting.brightness.value': '{percent}%',
  'lighting.pulse': '随节拍律动',
  'lighting.pulse.off': '关',
  'lighting.pulse.gentle': '轻柔',
  'lighting.pulse.full': '强烈',
  'lighting.colours.hint': '颜色直接取自场景本身，无需挑选。',

  'lighting.devices.title': '你的设备',
  'lighting.devices.found': '在你的桌面上找到',
  'lighting.devices.searching': '正在查找设备…',
  'lighting.devices.none.title': '未找到灯效设备',
  'lighting.devices.none.body':
    '支持 Windows Dynamic Lighting 的设备会显示在这里；安装 Razer Chroma 后，Razer 设备也会显示。接入一个设备，它就会出现。',
  'lighting.devices.together': 'Razer 设备通过 Razer Chroma 一起点亮。',

  'lighting.route.synapse': 'Razer Chroma',
  'lighting.route.windows': 'Windows Dynamic Lighting',
  'lighting.route.none': '无法连接',

  'lighting.kind.keyboard': '键盘',
  'lighting.kind.mouse': '鼠标',
  'lighting.kind.mousepad': '鼠标垫',
  'lighting.kind.headset': '耳机',
  'lighting.kind.keypad': '小键盘',
  'lighting.kind.stand': '支架',
  'lighting.kind.speaker': '音箱',
  'lighting.kind.accessory': '配件',

  'lighting.device.toggle': '点亮 {name}',

  'lighting.notice.windows.title': 'Windows 正将 {devices} 留给前台应用。',
  'lighting.notice.windows.body':
    '若要在 FluidEQ 位于其他窗口后面时也保持点亮，请在 Windows 的动态灯效设置中允许 FluidEQ 在后台控制灯光。',
  'lighting.notice.windows.action': '打开灯效设置',
  'lighting.notice.chroma.title': 'Razer Chroma 没有响应。',
  'lighting.notice.chroma.body':
    '你的 Razer 设备通过 Razer Chroma 获取颜色。启动它，设备就会加入。',
  'lighting.notice.chroma.action': '打开 Razer Chroma',
  'lighting.notice.appsOff.title': 'Razer Chroma 不允许应用点亮你的设备。',
  'lighting.notice.appsOff.body':
    '请在 Razer Chroma 中开启 Chroma Apps，并在那里允许 FluidEQ。',

  'lighting.graph.on': '停止点亮我的设备',
  'lighting.graph.off': '用这个场景点亮我的设备',
} as const;

export default lighting;
