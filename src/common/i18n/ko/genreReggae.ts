/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genreReggae = {
  'genre.reggae.hook': '베이스라인은 리드악기이다.',
  'genre.reggae.story':
    '약 76 BPM의 원 드롭: 부드럽고 깊은 킥과 밝은 스타카토 스컹크 아래 리드가 롤오프된 고음이 있는 두꺼운 베이스 기타입니다. 테이프에 라이브로 녹음되었으며 대부분 모노로 녹음되었습니다. Marley의 원본 CD의 다이나믹 레인지는 14~15입니다.',
  'genre.reggae.pin.80': '베이스가 리드한다',
  'genre.reggae.pin.80.why': '무게는 중간에 유지됩니다.',
  'genre.reggae.pin.500': '진흙탕',
  'genre.reggae.pin.500.why': '그래서 베이스 라인이 또렷하게 걸어요.',
  'genre.reggae.pin.12500': '소프트탑',
  'genre.reggae.pin.12500.why':
    '빈티지 테이프: 쉿쉿거리는 소리가 들리지 않습니다.',
  'genre.reggae.stage.dimension':
    '주파수 대역에 걸쳐 이 장르의 스테레오 폭 균형을 유지합니다. 중앙 보컬에 비상관 처리를 더하지 않습니다.',
  'genre.reggae.stage.deEsser':
    '중앙 보컬의 날카로운 S와 SH 소리를 5~10 kHz에서 최대 1.5 dB의 좁은 스펙트럼 감쇠로 제어하고, 심벌을 보호하며 저음은 그대로 유지합니다.',
  'genre.reggae.stage.maximizer':
    '정규화된 입력을 이 장르에서 측정한 감상 음량으로 올리고 피크를 −1 dBTP로 제한합니다. 녹음의 강약을 보존하도록 제한을 절제하며 Master와 Dynamics는 꺼 둡니다.느린 릴리스로 개별 비트를 따라가는 것을 피합니다.',
  'genre.reggae.off':
    'Bass Forge가 제공되고 중단됩니다. 베이스는 고유한 고조파를 전달합니다. 테이프 시대의 상단에는 Exciter가 없습니다.',
  'genre.dub.hook': '드럼, 베이스 그리고 드롭',
  'genre.dub.story':
    '드럼과 서브베이스는 65~75BPM으로 앞쪽에 있고 나머지는 테이프 에코와 스프링 리버브를 통해 들어오고 나갑니다. 방울은 구성입니다. 레코드는 9~15의 동적 범위를 유지합니다.',
  'genre.dub.pin.50': '모노의 하위 무게',
  'genre.dub.pin.50.why': '리딤의 바닥.',
  'genre.dub.pin.500': '메아리를 위한 공간',
  'genre.dub.pin.500.why': '지연이 피어나는 곳.',
  'genre.dub.pin.8000': '메아리와 봄의 빛',
  'genre.dub.pin.8000.why': '효과의 반짝임이 유지됩니다.',
  'genre.dub.stage.dimension':
    '주파수 대역에 걸쳐 이 장르의 스테레오 폭 균형을 유지합니다. 중앙 보컬에 비상관 처리를 더하지 않습니다.',
  'genre.dub.stage.deEsser':
    '중앙 보컬의 날카로운 S와 SH 소리를 5~10 kHz에서 최대 1.5 dB의 좁은 스펙트럼 감쇠로 제어하고, 심벌을 보호하며 저음은 그대로 유지합니다.',
  'genre.dub.stage.maximizer':
    '정규화된 입력을 이 장르에서 측정한 감상 음량으로 올리고 피크를 −1 dBTP로 제한합니다. 녹음의 강약을 보존하도록 제한을 절제하며 Master와 Dynamics는 꺼 둡니다.느린 릴리스로 개별 비트를 따라가는 것을 피합니다.',
  'genre.dub.off':
    'Bass Forge가 제공되고 중단되었으며, Exciter가 없으며 아무것도 레벨을 떨어뜨리지 않습니다.',
  'genre.dancehall.hook': '808 스타일 서브의 디지털 리딤',
  'genre.dancehall.story':
    '1985년 이후 약 100BPM의 디지털 리딤: 모노의 808 또는 사인 서브, 선명한 타악기 및 보컬 포워드.',
  'genre.dancehall.pin.80': '디지털 서브',
  'genre.dancehall.pin.80.why': '모노, 지원됩니다.',
  'genre.dancehall.pin.315': '진흙탕',
  'genre.dancehall.pin.315.why': '목소리를 위한 공간.',
  'genre.dancehall.pin.1250': '보컬 포워드',
  'genre.dancehall.pin.1250.why': '위에는 디제이.',
  'genre.dancehall.stage.dimension':
    '주파수 대역에 걸쳐 이 장르의 스테레오 폭 균형을 유지합니다. 중앙 보컬에 비상관 처리를 더하지 않습니다.',
  'genre.dancehall.stage.deEsser':
    '중앙 보컬의 날카로운 S와 SH 소리를 5~10 kHz에서 최대 1.5 dB의 좁은 스펙트럼 감쇠로 제어하고, 심벌을 보호하며 저음은 그대로 유지합니다.',
  'genre.dancehall.stage.maximizer':
    '정규화된 입력을 이 장르에서 측정한 감상 음량으로 올리고 피크를 −1 dBTP로 제한합니다. 녹음의 강약을 보존하도록 제한을 절제하며 Master와 Dynamics는 꺼 둡니다.',
  'genre.dancehall.off':
    'Bass Forge가 제공되고 중단되었으며, 선명한 타악기에는 Exciter가 없습니다.',
  'genre.ska.hook': '색다른 비트의 워킹 베이스와 호른',
  'genre.ska.story':
    '첫 번째 웨이브에서는 120~150BPM, 세 번째 웨이브에서는 더 빨라지고 워킹 베이스와 경적 아래의 가벼운 킥, 밝고 색다른 스컹크가 있습니다. 1960년대 음반은 모노와 테이프로 가득 차 있습니다.',
  'genre.ska.pin.32': '가짜 서브 없음',
  'genre.ska.pin.32.why': '빈티지 레코드 아래에서 발명된 것은 없습니다.',
  'genre.ska.pin.80': '걸어다니는 배스',
  'genre.ska.pin.80.why': '흔들리는 라인.',
  'genre.ska.pin.315': '진흙탕',
  'genre.ska.pin.315.why': '뿔을 위한 공간입니다.',
  'genre.ska.pin.2000': '뿔과 걸레',
  'genre.ska.pin.2000.why': '색다른, 밝은.',
  'genre.ska.stage.dimension':
    '주파수 대역에 걸쳐 이 장르의 스테레오 폭 균형을 유지합니다. 중앙 보컬에 비상관 처리를 더하지 않습니다.',
  'genre.ska.stage.deEsser':
    '중앙 보컬의 날카로운 S와 SH 소리를 5~10 kHz에서 최대 1.5 dB의 좁은 스펙트럼 감쇠로 제어하고, 심벌을 보호하며 저음은 그대로 유지합니다.',
  'genre.ska.stage.maximizer':
    '정규화된 입력을 이 장르에서 측정한 감상 음량으로 올리고 피크를 −1 dBTP로 제한합니다. 녹음의 강약을 보존하도록 제한을 절제하며 Master와 Dynamics는 꺼 둡니다.',
  'genre.ska.off':
    'Exciter 없음, Bass Punch 또는 Bass Forge: 빈티지 녹음에는 베이스가 없습니다.',
} satisfies Partial<Dictionary>;

export default genreReggae;
