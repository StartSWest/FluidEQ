/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const lighting = {
  'lighting.alignment.title': '장면 정렬',
  'lighting.alignment.hint':
    '이 장치에서 장면을 이동하거나 크기를 조정하세요. 위치는 너비 또는 높이의 백분율입니다.',
  'lighting.alignment.keyboardFit':
    '감지된 키 위치에 장착됩니다. 여기에서 장면을 미세 조정하세요.',
  'lighting.alignment.size': '장면 크기',
  'lighting.alignment.horizontal': '수평 위치(%)',
  'lighting.alignment.vertical': '수직 위치(%)',
  'lighting.alignment.reset': '센터 및 핏',
  'lighting.tuning.foregroundBrightness': '전경 밝기',
  'lighting.tuning.backgroundBrightness': '배경 밝기',
  'lighting.status.ambient': '조용히 흐르는 · {scene}',
  'lighting.scene.title': '{scene}용 조명',
  'lighting.scene.saved': '이 시각화 도우미용으로 저장됨',
  'lighting.device.edit': '{name} 조정',
  'lighting.target.all': '모든 기기',
  'lighting.target.shared': '공유 조명: {devices}',
  'lighting.tuning.title': '조명 스타일',
  'lighting.tuning.reset': '재설정',
  'lighting.effect.scene': '장면',
  'lighting.effect.flow': '컬러 웨이브',
  'lighting.effect.spectrum': '스펙트럼',
  'lighting.effect.pulse': '비트 물결',
  'lighting.tuning.sensitivity': '음악감수성',
  'lighting.tuning.speed': '모션 속도',
  'lighting.tuning.saturation': '색상 강도',
  'lighting.tuning.smoothing': '부드러움',
  'lighting.tuning.spread': '패턴 확산',
  'lighting.tuning.reverse': '역방향',
  'lighting.tuning.focus': '응답하다',
  'lighting.focus.balanced': '풀 믹스',
  'lighting.focus.bass': '베이스',
  'lighting.focus.mid': '미드',
  'lighting.focus.treble': '고음',
  'lighting.tuning.advanced': '미세 조정',
  'lighting.idle.title': '음악이 멈출 때',
  'lighting.idle.flow': '계속 흘러가',
  'lighting.idle.breathe': '느린 호흡',
  'lighting.idle.hold': '색상 유지',
  'lighting.idle.brightness': '유휴 밝기',
  'lighting.idle.speed': '유휴 동작',
  'lighting.tuning.master': '마스터 밝기',
  'lighting.title': '동적 조명',
  'lighting.rail.blurb': '당신의 책상은 장면을 따라갑니다',
  'lighting.description':
    '키보드, 마우스, 마우스패드, 헤드셋, 스탠드가 장면에 맞춰 빛납니다.',
  'lighting.gate.title': '장면에 맞춰 키보드, 마우스, 헤드셋에 조명을 켜세요',
  'lighting.gate.body':
    'Visualizer에서 장면을 가져오면 동적 조명이 귀하의 것입니다. 장치는 그래프에서 장면의 색상을 취하고 비트에 따라 펄스를 보냅니다.',
  'lighting.gate.cta': '장면 찾기',
  'lighting.preview.status':
    '미리보기 - 이 페이지가 열려 있는 동안 장치가 켜집니다.',
  'lighting.preview.lit': '장면에 맞춰 장치 조명',
  'lighting.preview.oneScene': '그것이 무엇인지 보여주는 한 장면',
  'lighting.preview.noScene': '책상 위의 한 장면',
  'lighting.preview.moreScenes': '장면 찾아보기',
  'lighting.preview.held':
    '나만의 장면을 사용하면 장치가 이렇게 켜져 있습니다.',
  'lighting.preview.locked': '밝기, 스타일, 정렬이 자신만의 장면을 연출합니다.',
  'lighting.unsupported.title': '동적 조명은 Windows에서 작동합니다.',
  'lighting.unsupported.body':
    'Windows Dynamic Lighting 및 Razer Chroma를 통해 장치를 조명하며 둘 다 Windows에서만 가능합니다.',
  'lighting.switch': '장면이 재생되는 동안 내 장치에 불을 켜세요',
  'lighting.status.live': '{scene} 팔로우',
  'lighting.status.waiting': '음악을 기다리는 중',
  'lighting.status.nothingLit':
    '장면이 재생 중이지만 장치에 불이 들어오지 않습니다',
  'lighting.status.off': '꺼짐 — 장치가 자체 조명을 유지합니다',
  'lighting.status.noScene': '장면을 선택하면 장치가 따라갑니다.',
  'lighting.pickScene': '비주얼라이저 찾아보기',
  'lighting.showGraph': '그래프 표시',
  'lighting.brightness': '밝기',
  'lighting.pulse': '비트에 맞춰 뛰다',
  'lighting.pulse.off': '끔',
  'lighting.pulse.gentle': '온화한',
  'lighting.pulse.full': '전체',
  'lighting.devices.title': '귀하의 기기',
  'lighting.devices.searching': '기기를 찾는 중…',
  'lighting.devices.none.title': '조명 장치를 찾을 수 없습니다.',
  'lighting.devices.none.body':
    'Windows Dynamic Lighting과 작동하는 장치가 여기에 표시되며, Razer Chroma가 설치되면 Razer 장치가 표시됩니다. 하나를 연결하면 나타납니다.',
  'lighting.devices.together':
    'Razer 장치는 Razer Chroma를 통해 함께 켜집니다.',
  'lighting.route.synapse': 'Razer Chroma',
  'lighting.route.windows': 'Windows 동적 조명',
  'lighting.route.none': '연결할 수 없음',
  'lighting.form.keyboard-full': '키보드',
  'lighting.form.keyboard-tkl': '텐키리스 키보드',
  'lighting.form.keyboard-compact': '컴팩트 키보드',
  'lighting.form.laptop': '노트북',
  'lighting.form.keypad': '키패드',
  'lighting.form.mouse': '마우스',
  'lighting.form.mouse-dock': '마우스 독',
  'lighting.form.charging-pad': '충전 패드',
  'lighting.form.mouse-bungee': '마우스 번지',
  'lighting.form.mousepad': '마우스패드',
  'lighting.form.desk-mat': '데스크 매트',
  'lighting.form.headset': '헤드셋',
  'lighting.form.headset-stand': '헤드셋 스탠드',
  'lighting.form.speakers': '스피커',
  'lighting.form.soundbar': '사운드바',
  'lighting.form.microphone': '마이크',
  'lighting.form.laptop-stand': '노트북 스탠드',
  'lighting.form.monitor-stand': '모니터 스탠드',
  'lighting.form.dock': '독',
  'lighting.form.light-strip': '라이트 스트립',
  'lighting.form.light-bar': '모니터 라이트 바',
  'lighting.form.lamp': '램프',
  'lighting.form.controller': '컨트롤러',
  'lighting.form.tower': 'PC 케이스',
  'lighting.form.mixer': '오디오 믹서',
  'lighting.form.monitor': '모니터',
  'lighting.form.chair': '의자',
  'lighting.form.accessory': '액세서리',
  'lighting.device.toggle': '라이트 {name}',
  'lighting.notice.windows.title':
    'Windows는 앱 앞에 {devices}를 유지하고 있습니다.',
  'lighting.notice.windows.body':
    'FluidEQ가 다른 창 뒤에 있는 동안 조명을 유지하려면 Windows 설정의 배경 조명 제어에서 FluidEQ를 허용하세요.',
  'lighting.notice.windows.action': 'Windows 조명 설정 열기',
  'lighting.windows.controller': '동적 조명 배경 컨트롤러',
  'lighting.windows.notFirst.title':
    'Windows는 먼저 다른 앱에 {devices}를 제공합니다.',
  'lighting.windows.off.title': 'Windows에서는 동적 조명이 꺼져 있습니다.',
  'lighting.windows.waiting.title':
    'Windows가 {devices}를 FluidEQ에 전달하고 있습니다.',
  'lighting.windows.waiting.body': '이 작업은 최대 1분 정도 걸릴 수 있습니다.',
  'lighting.windows.developerMode.title':
    'FluidEQ의 이 사본은 {devices}를 켜려면 개발자 모드가 필요합니다.',
  'lighting.windows.developerMode.body':
    'Windows는 식별할 수 있는 앱에만 조명을 제공합니다. FluidEQ의 개발 사본은 개발자 모드를 켠 상태에서 이를 얻습니다. 출시된 앱에는 이미 포함되어 있습니다.',
  'lighting.windows.unavailable.title':
    'Windows에서는 이 FluidEQ 복사본이 {devices}를 표시하도록 허용하지 않습니다.',
  'lighting.windows.unavailable.body':
    'Windows는 식별할 수 있는 앱에만 조명을 제공하며 이 복사본은 식별할 수 없습니다. FluidEQ를 다시 설치하면 일반적으로 문제가 해결됩니다.',
  'lighting.windows.step.open': '동적 조명 설정을 엽니다.',
  'lighting.windows.step.list': '"배경 조명 제어"를 엽니다.',
  'lighting.windows.step.reset':
    '"배경 조명 제어"에서 "모든 장치에 대해 재설정"을 누릅니다.',
  'lighting.windows.step.drag': 'FluidEQ를 목록 맨 위로 드래그합니다.',
  'lighting.windows.step.dragAbove':
    'FluidEQ를 목록 맨 위, {above} 위로 드래그합니다.',
  'lighting.windows.step.wait': '약 1분 안에 조명이 전환됩니다.',
  'lighting.windows.step.turnOn': '"내 장치에서 동적 조명 사용"을 켭니다.',
  'lighting.windows.step.deviceOn':
    '장치가 계속 어두워지면 카드를 열고 "이 장치에서 동적 조명 사용"을 켜십시오.',
  'lighting.windows.step.foreground':
    '게임이나 다른 조명 앱이 앞에 있는 동안에는 조명을 유지합니다. FluidEQ가 이를 유지하도록 하려면 "포그라운드의 호환 앱이 항상 조명 제어"를 끄십시오.',
  'lighting.windows.step.openDevelopers': 'Windows의 개발자 설정을 엽니다.',
  'lighting.windows.step.developerMode': '"개발자 모드"를 켭니다.',
  'lighting.windows.step.comeBack':
    'FluidEQ로 돌아오세요. 이 페이지는 자체적으로 변경 사항을 선택합니다.',
  'lighting.windows.action.developers': '개발자 설정 열기',
  'lighting.windows.vendor.razer':
    'Razer 장치에는 Razer Synapse 설정의 장치 조명에서 동적 조명을 선택해야 합니다.',
  'lighting.windows.vendor.logitech':
    'Windows에서 Logitech 장치의 조명을 켜는 동안 G HUB는 조명을 변경할 수 없습니다.',
  'lighting.windows.vendor.asus':
    'Armoury Crate에서 장치를 "Aura Sync 및 Windows Dynamic Lighting"으로 설정합니다.',
  'lighting.notice.chroma.title': 'Razer Chroma가 응답하지 않습니다.',
  'lighting.notice.chroma.body':
    'Razer 장치는 Razer Chroma를 통해 색상을 취합니다. 시작하면 사람들이 합류합니다.',
  'lighting.notice.chroma.action': 'Razer Chroma 열기',
  'lighting.notice.appsOff.title':
    'Razer Chroma는 앱이 장치를 밝히는 것을 허용하지 않습니다.',
  'lighting.notice.appsOff.body':
    'Razer Chroma에서 Chroma 앱을 켜고 거기에서 FluidEQ를 허용하세요.',
  'lighting.graph.on': '내 장치 조명 중지',
  'lighting.graph.off': '이 장면으로 내 장치에 불을 켜세요',
  'lighting.gate.eyebrow': '한 장면이 열립니다',
} satisfies Partial<Dictionary>;

export default lighting;
