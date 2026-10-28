/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genreUrban = {
  'genre.hiphop.hook': '붐뱁(Boom Bap): 강한 발차기와 그 위에 목소리',
  'genre.hiphop.story':
    '붐뱁은 85~95 BPM으로 스윙하며, 강렬하고 짧은 샘플 킥과 보이스가 차트에서 가장 좁은 믹스로 등장합니다. 오래된 레코드는 50Hz 미만으로 얇으며 샘플, 바이닐 및 808은 이미 포화 상태입니다.',
  'genre.hiphop.pin.50': '이전 기록에 대한 하위',
  'genre.hiphop.pin.50.why': '붐뱁이 얇은 곳을 들어 올렸다.',
  'genre.hiphop.pin.500': '베이스와 보이스 사이의 진흙',
  'genre.hiphop.pin.500.why': '구절이 맨 위에 오도록 지워졌습니다.',
  'genre.hiphop.pin.12500': '먼지가 많은 윗면',
  'genre.hiphop.pin.12500.why':
    '샘플링된 레코드로 구성된 비트가 소리를 내는 방식입니다.',
  'genre.hiphop.stage.dimension':
    '120Hz 이하의 모노에서 180까지 좁혀져 좁은 영상이 유지되었습니다.',
  'genre.hiphop.stage.maximizer': '거의 움직이지 않는 천장.',
  'genre.hiphop.off':
    'Exciter인 Bass Forge 및 Bass Punch가 제공되고 중단되었습니다. 샘플은 이미 포화되었으며 Bass Forge는 베이스 노트에 16%의 새로운 사운드를 추가했습니다.',
  'genre.rap.hook': '목소리가 곧 상품이다',
  'genre.rap.story':
    '템포는 85BPM 붐뱁부터 140BPM 드릴까지 비트를 따르지만 목소리는 중심에 있고 건조하며 이해하기 쉽습니다.',
  'genre.rap.pin.50': '목소리 밑에 머무는 베이스',
  'genre.rap.pin.50.why': '단어를 가리지 않고 무게를 잰다.',
  'genre.rap.pin.200': '가슴에서 목소리가 나온다',
  'genre.rap.pin.200.why': '베이스가 구절을 흐릿하게 만드는 곳.',
  'genre.rap.pin.2000': '자음',
  'genre.rap.pin.2000.why': '명료도, 조금 앞으로.',
  'genre.rap.stage.dimension':
    '중음은 레코드판보다 더 좁은 음영으로 목소리를 가만히 유지합니다.',
  'genre.rap.stage.maximizer': '거의 움직이지 않는 천장.',
  'genre.rap.off':
    'Bass Forge가 제공되고 중단됩니다. 베이스의 하모닉스가 목소리의 가슴에 닿습니다.',
  'genre.trap.hook': '전화기로 들을 수 있는 긴 808',
  'genre.trap.story':
    '140BPM으로 계산되고 70으로 느껴집니다. 30~60Hz의 긴 808, 의도적으로 왜곡되고 3박자 롤의 하이햇입니다. 120Hz 미만은 모두 모노입니다.',
  'genre.trap.pin.50': '808은 그대로 남아있다',
  'genre.trap.pin.50.why':
    '이미 기록상 가장 큰 소리를 내는 전대역 시스템에서는 부스트하지 마십시오.',
  'genre.trap.pin.315': '린 중저음',
  'genre.trap.pin.315.why': '트랩이 혼합되어 있습니다.',
  'genre.trap.pin.8000': '선명한 하이햇',
  'genre.trap.pin.8000.why': '롤은 깨끗합니다.',
  'genre.trap.stage.bassForge':
    '808의 배음(40Hz 음표의 80, 120 및 160Hz)이므로 작은 스피커로도 재생할 수 있습니다. 아래에는 옥타브가 없습니다.',
  'genre.trap.stage.dimension':
    '120Hz 모노 미만의 모든 것, 모자 및 신디사이저가 넓습니다.',
  'genre.trap.stage.maximizer': '거의 움직이지 않는 천장.',
  'genre.trap.off':
    'Exciter도 없고 Bass Punch도 없습니다. 808은 이미 왜곡되었습니다.',
  'genre.rnb.hook': '둥근 바닥 위에 실키한 탑이',
  'genre.rnb.story':
    '60~100BPM에서 느껴지는 808이나 신스 베이스 아래의 부드러운 라운드 킥, 스택과 패드가 주변에 있는 중앙에 있는 친밀한 보컬입니다.',
  'genre.rnb.pin.50': '둥근 바닥',
  'genre.rnb.pin.50.why': '따뜻하고 호황을 누리지 않습니다.',
  'genre.rnb.pin.1250': '콧물이 아닌 부드러운',
  'genre.rnb.pin.1250.why': '완화되어 목소리가 매끄럽게 유지됩니다.',
  'genre.rnb.pin.12500': '실크 탑',
  'genre.rnb.pin.12500.why': '목소리 위의 공기.',
  'genre.rnb.stage.dimension':
    '장르가 믹스된 만큼 패드는 보이스보다 조금 더 넓습니다.',
  'genre.rnb.stage.maximizer': '밝은 천장.',
  'genre.rnb.off':
    'Exciter는 제공되고 중단됩니다. 이 보컬의 하모닉스는 호흡과 연결됩니다.',
  'genre.soul.hook': '테이프, 튜브, 라이브 밴드',
  'genre.soul.story':
    '60~72BPM의 발라드와 88~110의 중간 템포, 멜로디 일렉트릭 베이스와 머플 킥이 밴드에 의해 테이프에 녹음되었습니다. 60년대 스테레오 믹스는 패닝이 심했고 원본은 -12 ~ -16 LUFS에 있었습니다.',
  'genre.soul.pin.32': '테이프 아래엔 아무것도 없어',
  'genre.soul.pin.32.why': '테이프 시대의 레코드는 50Hz보다 약간 낮습니다.',
  'genre.soul.pin.80': '멜로디 베이스의 따뜻함',
  'genre.soul.pin.80.why': '노래를 전달하는 라인입니다.',
  'genre.soul.pin.5000': '공기 없음',
  'genre.soul.pin.5000.why':
    '철거: 공기가 테이프를 쉭쉭 소리를 내며 들어 올립니다.',
  'genre.soul.stage.dimension':
    '하드 패닝된 60년대 믹스를 하나로 모으는 좁은 음영.',
  'genre.soul.stage.maximizer': '결코 제한되지 않는 마스터를 위한 느린 천장.',
  'genre.soul.off':
    'Exciter는 제공되고 중단됩니다. 테이프와 튜브가 소리이고 Exciter는 쉿쉿거리는 소리를 냅니다.',
  'genre.neoSoul.hook': '생동감 넘치는 취한 느낌의 주머니',
  'genre.neoSoul.story':
    '고스트 노트, 라이브 베이스, 로즈의 비트가 뒤섞인 60~85BPM의 느낌을 줍니다. 따뜻하고 어둡고 빈티지한 느낌을 의도한 것입니다.',
  'genre.neoSoul.pin.125': '따뜻하고 둥글다',
  'genre.neoSoul.pin.125.why': '라이브 베이스와 로즈.',
  'genre.neoSoul.pin.1250': '어둡고 매끄러움',
  'genre.neoSoul.pin.1250.why': '아무것도 튀어 나오지 않도록 완화되었습니다.',
  'genre.neoSoul.pin.12500': '반짝이 없음',
  'genre.neoSoul.pin.12500.why': '따뜻하고 어두운 것이 간단합니다.',
  'genre.neoSoul.stage.dimension':
    '라이브 밴드 영상은 그대로 유지하고 저음만 좁아졌습니다.',
  'genre.neoSoul.stage.maximizer': '아무것도 압박하지 않는 느린 천장.',
  'genre.neoSoul.off':
    'Exciter가 제공되고 중단됩니다. Exciter가 없으면 따뜻하고 어두운 상태를 유지합니다.',
  'genre.funk.hook': '베이스가 리드이고, 베이스가 전부다',
  'genre.funk.story':
    '100~125BPM의 연속 16분의 1, 묵직한 킥과 타이트한 스네어 위에 베이스와 고스트 노트를 두드립니다. 건조하고 펀치감 있고 미드 포워드; 70년대 마스터는 -12에서 -16 LUFS에 앉았습니다.',
  'genre.funk.pin.80': '타이트한 저음',
  'genre.funk.pin.80.why': '노트가 번지지 않고 무게가 나갑니다.',
  'genre.funk.pin.500': '관절을 위한 공간',
  'genre.funk.pin.500.why': '그래서 모든 때리고 유령 메모를 읽습니다.',
  'genre.funk.pin.2000': '때리고 기타 스크래치',
  'genre.funk.pin.2000.why': '타악기의 가장자리, 앞으로.',
  'genre.funk.pin.12500': '과장되지 않은 테이프 탑',
  'genre.funk.pin.12500.why': '완화되고 결코 밝아지지 않습니다.',
  'genre.funk.stage.bassPunch':
    '관절을 더럽힐 수 있는 꽃이 없는 타이트한 저음역대입니다.',
  'genre.funk.stage.dimension': '기록에 가까워지면 바닥이 좁아졌습니다.',
  'genre.funk.stage.maximizer': '밝은 천장.',
  'genre.funk.off':
    'Exciter 없음 또는 Bass Forge: 드라이하고 미드 포워드 사운드입니다.',
  'genre.disco.hook': '끈으로 된 벽 아래 바닥에 4개',
  'genre.disco.story':
    '현악기, 호른, 백킹 보이스로 이루어진 넓은 벽 아래 오픈 하이햇과 옥타브 베이스 라인이 있는 약 122BPM의 플로어 4개입니다. 원본은 -12 ~ -16 LUFS에서 마스터링되었습니다.',
  'genre.disco.pin.80': '킥의 무게',
  'genre.disco.pin.80.why': '바닥에 4개.',
  'genre.disco.pin.800': '현 아래 방',
  'genre.disco.pin.800.why': '벽이 숨을 쉴 수 있도록 가운데가 완화되었습니다.',
  'genre.disco.pin.8000': '하이햇을 열고 쉬머하세요',
  'genre.disco.pin.8000.why': '시대의 반짝임.',
  'genre.disco.stage.bassPunch':
    '킥에 약간의 무게가 가해졌고, 꼬리는 다음 박자보다 짧게 유지되었습니다.',
  'genre.disco.stage.dimension':
    '이미 오케스트라가 퍼뜨린 것의 확장은 없습니다.',
  'genre.disco.stage.maximizer':
    '가벼운 천장, 킥 아래로 빨리 놓을 수 있습니다.',
  'genre.disco.off':
    '익사이터 또는 Bass Forge 없음: 모자와 끈은 하나 아래에서 부서지기 쉽습니다.',
} satisfies Partial<Dictionary>;

export default genreUrban;
