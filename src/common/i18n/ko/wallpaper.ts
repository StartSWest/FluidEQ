/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const wallpaper = {
  'wallpaper.action': '데스크탑 배경으로 설정',
  'wallpaper.title': '데스크탑 배경',
  'wallpaper.description':
    '이 시각화 도우미를 데스크탑 아이콘 뒤에 두고 음악과 함께 움직이거나 그 자체로 조용히 움직이세요.',
  'wallpaper.manage.description':
    '각 모니터가 데스크탑 아이콘 뒤에 표시하는 내용입니다.',
  'wallpaper.manage.empty':
    '모든 모니터에는 일반적인 Windows 배경이 표시됩니다.',
  'wallpaper.monitors': '모니터',
  'wallpaper.monitors.hint':
    '재생되는 위치를 선택하세요. 각 모니터는 자체 시각화 도우미를 표시할 수 있습니다.',
  'wallpaper.monitors.all': '모든 모니터',
  'wallpaper.monitor.name': '{number} 모니터',
  'wallpaper.monitor.primary': '기본',
  'wallpaper.monitor.size': '{width} × {height}',
  'wallpaper.monitor.ordinary': '윈도우 배경',
  'wallpaper.monitor.disconnected': '연결이 끊긴 모니터',
  'wallpaper.visualizer.unknown': '비주얼라이저',
  'wallpaper.pauseOnBattery': '배터리 전원 일시중지',
  'wallpaper.pauseOnBattery.hint':
    '이 컴퓨터의 플러그를 뽑으면 전원이 절약됩니다.',
  'wallpaper.motion': '모션',
  'wallpaper.motion.music': '음악과 함께',
  'wallpaper.motion.music.hint': '재생 중인 항목으로 이동합니다.',
  'wallpaper.motion.calm': '진정',
  'wallpaper.motion.calm.hint': '음악을 무시하는 느리고 조용한 애니메이션.',
  'wallpaper.follow': '그래프 따르기',
  'wallpaper.follow.hint':
    '그래프가 표시하는 장면을 표시하고 선택하든 자동 전환을 선택하든 그에 따라 변경됩니다. 대신 그래프에는 스타일이 표시되지만 이 화면은 마지막 장면을 유지합니다.',
  'wallpaper.follow.choice':
    '선택한 모니터는 사용자가 선택하든 자동 전환을 선택하든 그래프의 장면에 따라 변경되며 그래프가 스타일을 표시하는 동안 마지막 모니터를 유지합니다.',
  'wallpaper.cancel': '취소',
  'wallpaper.done': '완료',
  'wallpaper.start': '배경 설정',
  'wallpaper.start.many': '{count} 모니터에 설정',
  'wallpaper.retry': '다시 시도하세요',
  'wallpaper.stop': '정지',
  'wallpaper.stopAll': '모두 중지',
  'wallpaper.manage': '관리하다',
  'wallpaper.phase.playing': '재생',
  'wallpaper.phase.starting': '시작',
  'wallpaper.phase.paused': '일시중지됨',
  'wallpaper.phase.stopped': '중지됨',
  'wallpaper.status.starting': '바탕화면 배경 시작 중…',
  'wallpaper.status.running': '바탕 화면 배경이 재생 중입니다.',
  'wallpaper.status.runningMany': '{count} 모니터에서 재생 중',
  'wallpaper.status.paused': '데스크톱 배경이 일시중지되었습니다.',
  'wallpaper.status.pausedMany': '{count} 모니터에서 일시중지됨',
  'wallpaper.status.failedMany': '{count} 모니터에서 중지됨',
  'wallpaper.status.stopping': '바탕화면 배경을 중지하는 중…',
  'wallpaper.pause.locked': 'Windows가 잠겨 있는 동안 일시 중지됨',
  'wallpaper.pause.suspended': '컴퓨터가 절전 모드인 동안 일시 중지됨',
  'wallpaper.pause.battery': '배터리 절약을 위해 일시중지됨',
  'wallpaper.pause.game': '게임이 진행 중인 동안 일시중지됨',
  'wallpaper.pause.covered': '창이 이 모니터를 가리는 동안 일시중지되었습니다.',
  'wallpaper.error.unsupported':
    '데스크탑 배경은 Windows와 macOS에서 사용할 수 있습니다.',
  'wallpaper.error.unavailable':
    '데스크탑 배경에 접근할 수 없습니다. 다시 시도해 보세요.',
  'wallpaper.error.notEntitled':
    '이 장면은 아직 당신의 것이 아닙니다. 갤러리에 가져와 데스크탑에 올려보세요.',
  'wallpaper.error.missingScene':
    '이 시각화 도우미는 더 이상 설치되지 않습니다. 다시 추가하고 다시 시도해 보세요.',
  'wallpaper.error.refused':
    '이 시각화 도우미는 이 컴퓨터의 그래픽에서 실패했습니다. 한 번 더 시도하려면 다시 설정하세요.',
  'wallpaper.error.missingDisplay':
    '해당 모니터의 연결이 끊어졌습니다. 다시 연결되면 배경이 돌아옵니다.',
  'wallpaper.error.host':
    'Windows에서 시각화 도우미를 바탕 화면에 배치할 수 없습니다. 다시 시도해 보세요.',
  'wallpaper.error.renderer':
    '시각화 도우미가 바탕 화면에 그릴 수 없습니다. 다시 시도해 보세요.',
  'wallpaper.error.audio':
    '데스크탑 비주얼라이저의 음악 신호가 손실되었습니다. 다시 시도해 보세요.',
} satisfies Partial<Dictionary>;

export default wallpaper;
