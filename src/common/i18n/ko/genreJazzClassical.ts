/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genreJazzClassical = {
  'genre.jazz.hook': '연주는 중반',
  'genre.jazz.story':
    '50~80BPM의 발라드, 90~140의 미디엄 스윙, 200을 넘는 비밥: 직립 베이스, 깃털 달린 킥, 라이드 심벌즈의 공기가 클래식 Blue Note 레코드에서 세게 패닝되었습니다. 재즈는 누구나 소유하고 있는 가장 조용하고 역동적인 음악 중 하나이며 평균값은 -12.8 LUFS입니다.',
  'genre.jazz.pin.125': '업라이트 베이스의 따뜻함',
  'genre.jazz.pin.125.why': '얇고 오래된 전송을 위한 바디입니다.',
  'genre.jazz.pin.1250': '경적 소리가 완화되었습니다',
  'genre.jazz.pin.1250.why':
    '호른과 피아노에는 공간이 주어졌지만 도움이 되지 않았습니다.',
  'genre.jazz.pin.12500': '라이드 심벌즈의 공기',
  'genre.jazz.pin.12500.why': '키트 상단을 엽니다.',
  'genre.jazz.stage.dimension':
    '좀 더 좁은 형태로 하드 패닝된 1950년대 스테레오를 헤드폰에 결합했습니다.',
  'genre.jazz.stage.maximizer':
    '전체 비트에 걸쳐 길 잃은 봉우리에만 닿는 천장.',
  'genre.jazz.off':
    'Exciter가 제공되고 중단됩니다. 고조파 색상 호른과 피아노가 청각적으로 추가됩니다. 저음을 압축하거나 넓히거나 생성하는 것은 없습니다.',
  'genre.smoothJazz.hook': '일부러 윤기나고 부드러워요',
  'genre.smoothJazz.story':
    '90~105BPM의 스트레이트 R&B 16분의 1, 윤기 나는 와이드 스테레오, 앞쪽의 색소폰이나 기타, 소프트 탑.',
  'genre.smoothJazz.pin.80': '바닥이 따뜻해요',
  'genre.smoothJazz.pin.80.why': '일렉트릭 베이스, 라운드.',
  'genre.smoothJazz.pin.2000': '색소폰에는 존재감이 없습니다',
  'genre.smoothJazz.pin.2000.why': '리드가 부드러워지도록 완화합니다.',
  'genre.smoothJazz.pin.12500': '글로시한 탑',
  'genre.smoothJazz.pin.12500.why': '스튜디오의 광택이 유지되었습니다.',
  'genre.smoothJazz.stage.dimension':
    '광택있는 스테레오가 혼합되어 저음만 좁아졌습니다.',
  'genre.smoothJazz.stage.maximizer': '느린 천장.',
  'genre.smoothJazz.off':
    'Exciter는 제공되고 중단되었으며 Bass Punch는 없습니다. 장르는 의도적으로 부드럽습니다.',
  'genre.fusion.hook': '일렉트릭하고 밝고 기교적인',
  'genre.fusion.story':
    '90~180BPM의 홀수 미터의 록 및 펑크 그루브, 일렉트릭 및 프렛리스 베이스 및 신디사이저, 필 및 유니슨 런이 핵심입니다. 70년대 기록은 -13 ~ -17 LUFS였습니다.',
  'genre.fusion.pin.80': '베이스와 킥',
  'genre.fusion.pin.80.why': '그루브의 바닥.',
  'genre.fusion.pin.315': '진흙탕',
  'genre.fusion.pin.315.why': '빠른 달리기를 위한 공간.',
  'genre.fusion.pin.12500': '녹음된 대로 밝게',
  'genre.fusion.pin.12500.why': '이 기록이 최고였습니다.',
  'genre.fusion.stage.dimension':
    '멀티트랙은 녹음된 대로 퍼지고 베이스만 좁아졌습니다.',
  'genre.fusion.stage.maximizer': '채우기만 남겨둔 느린 천장.',
  'genre.fusion.off':
    '자극기 없음, Bass Punch 또는 Bass Forge: 자체 고조파를 만드는 악기에는 아무것도 추가되지 않습니다.',
  'genre.blues.hook': '로우와 미드포워드',
  'genre.blues.story':
    '60~75BPM의 느린 12/8, 90~140의 셔플, 워킹 베이스, 오버드라이브가 사운드입니다. 클래식 레코드는 모노이며 -12 ~ -16 LUFS에서 마스터링되었습니다.',
  'genre.blues.pin.50': '가짜 서브 없음',
  'genre.blues.pin.50.why': '오래된 기록 아래 왼쪽에 있습니다.',
  'genre.blues.pin.200': '얇은 이동용 본체',
  'genre.blues.pin.200.why': '오래된 녹음이 잃어버린 따뜻함.',
  'genre.blues.pin.5000': '날것의, 밝지 않은',
  'genre.blues.pin.5000.why': '상단이 완화되었습니다.',
  'genre.blues.stage.dimension':
    '좁아지는 그늘; 모노 레코드는 모노로 유지됩니다.',
  'genre.blues.stage.maximizer': '느린 천장.',
  'genre.blues.off':
    'Exciter는 제공되고 꺼집니다. 오버드라이브는 사운드이며 아무것도 추가되지 않습니다.',
  'genre.classical.hook': '홀은 녹음이다',
  'genre.classical.story':
    'Decca 트리 또는 간격을 둔 쌍이 있는 홀에서 녹음된 음악은 최대 0.5데시벨의 압축으로 마스터링됩니다. 클래식 녹음은 −16 ~ −20 LUFS, 범위 15 ~ 20LUFS로 모든 장르에서 가장 넓은 다이내믹을 제공합니다.',
  'genre.classical.pin.80': '바닥에 홀 터치',
  'genre.classical.pin.80.why': '중간에 딥으로 지불됩니다.',
  'genre.classical.pin.800': '중간이 완화됨',
  'genre.classical.pin.800.why':
    '따라서 양쪽 끝의 리프트는 음량을 추가하지 않습니다.',
  'genre.classical.pin.12500': '홀의 공기',
  'genre.classical.pin.12500.why': '녹음이 이루어진 공간.',
  'genre.classical.stage.maximizer':
    '모든 장르 중 가장 긴 미리보기와 릴리스가 있는 천장만 있으므로 크레센도는 결코 억제할 수 없습니다.',
  'genre.classical.off':
    '차원이 전혀 없습니다. 홀이 녹음입니다. Exciter 및 Bass Punch가 제공되고 중단되었습니다.',
  'genre.orchestra.hook': '전체 오케스트라의 다이내믹을 그대로 유지',
  'genre.orchestra.story':
    '넓고 깊은 홀에 있는 전체 오케스트라는 15~25 LU 범위의 -18~-23 LUFS로 녹음되었습니다. 희귀한 투티 피크인 팀파니와 베이스 드럼이 전체 녹음 수준을 설정합니다.',
  'genre.orchestra.pin.125': '더블베이스와 팀파니(리프팅되지 않음)',
  'genre.orchestra.pin.125.why': '들어 올려진 팀파니 롤은 천장만 밀어냅니다.',
  'genre.orchestra.pin.800': '혼잡 완화',
  'genre.orchestra.pin.800.why': '전체 섹션이 쌓이는 곳.',
  'genre.orchestra.pin.12500': '홀의 공기',
  'genre.orchestra.pin.12500.why': '오케스트라 주변 공간.',
  'genre.orchestra.stage.maximizer':
    '모든 장르 중 가장 긴 미리보기와 릴리스가 있는 천장만 있으므로 투티는 절대 펌핑되지 않습니다.',
  'genre.orchestra.off':
    'No Dimension, Exciter, Bass Punch 또는 Bass Forge: 팀파니가 과부하할 정도로 베이스를 강화하는 것은 없습니다.',
  'genre.opera.hook': '이미 오케스트라를 압도하는 목소리',
  'genre.opera.story':
    '가수의 포먼트(2.4~3.1kHz)는 마이크 없이 오케스트라 위로 목소리를 전달하는 역할을 합니다. Opera 녹음은 매우 큰 최고 음표와 함께 -18 ~ -23 LUFS에 있습니다.',
  'genre.opera.pin.315': '오케스트라의 진흙',
  'genre.opera.pin.315.why': '목소리가 들리지 않게.',
  'genre.opera.pin.800': '목소리의 몸',
  'genre.opera.pin.800.why': '조금 앞으로.',
  'genre.opera.pin.3150': '홀로 남겨진 포먼트',
  'genre.opera.pin.3150.why':
    '그것은 이미 투영되어 있습니다. 들어올리면 목소리가 날카로워진다.',
  'genre.opera.stage.maximizer': '천장만 밝으면 목소리가 압축되지 않습니다.',
  'genre.opera.off':
    'No Dimension, Exciter 또는 Bass Punch: 목소리를 넓히거나 자극하거나 재구성하는 것은 없습니다.',
  'genre.piano.hook': '가장 공개적인 출처 중 하나는 다음과 같습니다.',
  'genre.piano.story':
    '27.5Hz의 A0부터 C8까지 하나의 장비가 전체 범위를 포괄하며 높은 피크와 함께 -16 ~ -20 LUFS로 기록됩니다. 리미터는 해머를 평평하게 하고 디케이를 들어 올리고 하모닉스는 코드를 거친 느낌으로 바꿉니다.',
  'genre.piano.pin.125': '왼손에 무게',
  'genre.piano.pin.125.why': '베이스 현의 몸체입니다.',
  'genre.piano.pin.315': '근접 마이크를 사용한 박진감 넘치는 아웃',
  'genre.piano.pin.315.why': '뚜껑이 아닌 사운드보드입니다.',
  'genre.piano.pin.5000': '망치의 공격',
  'genre.piano.pin.5000.why': '메모가 시작되는 곳.',
  'genre.piano.stage.maximizer': '천장만.',
  'genre.piano.off':
    'No Dimension, Exciter 또는 Bass Punch: 그 어떤 것도 피아노를 포화시키거나 모양을 바꾸지 않습니다.',
  'genre.strings.hook': '이미 고조파가 풍부함',
  'genre.strings.story':
    '-16 ~ -22 LUFS에서 부드럽고 경쾌한 자연스러운 앙상블 그림으로 더블 베이스에서 바이올린까지 활을 휘감은 현. 이미 고조파가 풍부하고 존재감이 추가되어 거칠어졌습니다.',
  'genre.strings.pin.200': '첼로와 베이스 바디',
  'genre.strings.pin.200.why': '낮은 부분의 따뜻함.',
  'genre.strings.pin.2000': '존재하지 않음',
  'genre.strings.pin.2000.why':
    '철거: 여기에서 활을 휘두르는 현이 거슬리게 변합니다.',
  'genre.strings.pin.12500': '단면 주변의 공기',
  'genre.strings.pin.12500.why': '활 위의 홀.',
  'genre.strings.stage.maximizer': '천장만.',
  'genre.strings.off':
    '차원 없음 및 익사이터 없음: 익사이터는 활을 휘감은 현을 강렬하게 만듭니다.',
} satisfies Partial<Dictionary>;

export default genreJazzClassical;
