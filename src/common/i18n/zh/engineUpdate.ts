const engineUpdate = {
  'engineUpdate.badge': '引擎更新',
  'engineUpdate.title': '新的 FluidEQ 引擎已就绪',
  'engineUpdate.body':
    '此版本的 FluidEQ 附带更新的音频引擎。安装时需要 Windows 授权，音频会重启几秒钟。',
  'engineUpdate.action': '更新引擎',
  'engineUpdate.running': '正在更新引擎…',
  'engineUpdate.doneBadge': '已是最新',
  'engineUpdate.doneTitle': 'FluidEQ 引擎已是最新',
  'engineUpdate.doneBody':
    'Windows 音频已使用新引擎重启，你的输出设备和均衡器保持不变。请重新打开仍然没有声音的程序。',
  'engineUpdate.declined': 'Windows 授权被拒绝，你的均衡器仍在使用原来的引擎。',
  'engineUpdate.failed': '无法更新引擎，你的均衡器仍在使用原来的引擎。',
} as const;

export default engineUpdate;
