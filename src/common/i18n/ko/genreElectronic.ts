/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genreElectronic = {
  'genre.electronic.hook': '온 가족이 평균값에 속함',
  'genre.electronic.story':
    '전자 음악은 70에서 175 BPM으로 실행됩니다. 하우스는 125, 테크노는 133, 트랜스는 138, 드럼 및 베이스는 174입니다. 서브는 에너지의 3분의 1에서 절반을 전달하고 로우 엔드는 클럽 시스템용 모노이며 마스터는 -9.3 LUFS 근처에 위치하며 피크는 종종 풀 스케일에 걸쳐 있습니다.',
  'genre.electronic.pin.50': '서브',
  'genre.electronic.pin.50.why': '음악의 3분의 1 이상이 이곳에 있습니다.',
  'genre.electronic.pin.315': '킥을 위해 진흙 밖으로',
  'genre.electronic.pin.315.why': '킥과 펀치를 위한 공간.',
  'genre.electronic.pin.8000': '모자와 공기',
  'genre.electronic.pin.8000.why': '밝은 믹스의 상단입니다.',
  'genre.electronic.stage.dimension':
    '150Hz 미만의 모노, 중음보다 약간 높은 폭.',
  'genre.electronic.stage.maximizer':
    '가벼운 천장은 옆에 있는 클럽 스타일보다 반 데시벨 더 세게 구동되어 수평을 유지합니다.',
  'genre.electronic.off':
    'Exciter인 Bass Forge 및 Bass Punch는 제공되고 중단됩니다. Exciter는 이 상단을 빠르게 거칠게 만들고 서브는 그 아래에서 생성될 필요가 없습니다.',
  'genre.edm.hook': '큰 방: 킥은 베이스',
  'genre.edm.story':
    '126~132BPM의 큰 공간. 드롭에서 킥은 베이스이고, 슈퍼톱은 이미 펼쳐져 있으며 마스터는 3~6의 다이나믹 레인지에서 클리핑됩니다.',
  'genre.edm.pin.80': '킥은 베이스',
  'genre.edm.pin.80.why': '드롭의 무게입니다.',
  'genre.edm.pin.315': '진흙탕',
  'genre.edm.pin.315.why': '킥을 위한 공간.',
  'genre.edm.pin.5000': '슈퍼톱 바이트',
  'genre.edm.pin.5000.why': '리드의 가장자리.',
  'genre.edm.stage.dimension': '모노 바닥이고 다른 것은 없습니다.',
  'genre.edm.stage.maximizer': '잘린 마스터를 간신히 움직이는 천장.',
  'genre.edm.off':
    'Exciter는 제공되고 중단됩니다. 모든 것을 갖춘 드롭에는 서브 부스트도 없고 확장도 없고 고조파도 없습니다.',
  'genre.house.hook': '펌프는 홈이다',
  'genre.house.story':
    '약 125BPM의 바닥에 4개, 베이스가 펌핑되는 깊은 909 또는 808 킥입니다. 하우스는 클럽 스타일 중 가장 넓지만 여전히 200Hz 미만으로 좁습니다.',
  'genre.house.pin.80': '킥과 펌핑되는 베이스',
  'genre.house.pin.80.why': '그루브가 있는 곳.',
  'genre.house.pin.500': '진흙탕',
  'genre.house.pin.500.why': '킥과 베이스를 분리시켜줍니다.',
  'genre.house.pin.12500': '따뜻하다, 밝지 않다',
  'genre.house.pin.12500.why': '상단이 완화되었습니다.',
  'genre.house.stage.dimension':
    '150Hz 미만의 모노이고 200까지 좁아졌으며 상단이 조금 더 넓어졌습니다.',
  'genre.house.stage.maximizer': '펌프를 내버려두는 가벼운 천장.',
  'genre.house.off':
    'Bass Punch는 없습니다. 킥 시간을 재조정할 수 있는 방법이 없기 때문입니다. 자극기 또는 Bass Forge가 없습니다.',
  'genre.techno.hook': '지속적인 럼블 위에 압축된 킥',
  'genre.techno.story':
    '약 133BPM의 압축된 909 킥은 지속적인 럼블을 통해 어둡고 저음이 주도합니다. 측정된 가장 좁은 스타일입니다.',
  'genre.techno.pin.80': '909 킥',
  'genre.techno.pin.80.why': '맥박.',
  'genre.techno.pin.800': '어둡습니다. 그래야 합니다.',
  'genre.techno.pin.800.why': '중앙은 럼블 아래서 완화되었습니다.',
  'genre.techno.pin.5000': '브라이트닝 없음',
  'genre.techno.pin.5000.why': '윗부분은 거의 닿지 않았습니다.',
  'genre.techno.stage.bassPunch':
    '기껏해야 킥이 조여져서 럼블이 번지지 않습니다.',
  'genre.techno.stage.dimension':
    '모노 바닥; 가장 좁은 스타일에서는 넓어진 것이 없습니다.',
  'genre.techno.stage.maximizer': '밝은 천장.',
  'genre.techno.off':
    '여자기 없음 및 Bass Forge 없음: 서브 부스트 없음 및 고조파 없음.',
  'genre.trance.hook': '대조를 기반으로 한 슈퍼톱과 드롭',
  'genre.trance.story':
    '125~150BPM(약 138)에서 펀치감 있는 킥과 매우 넓은 슈퍼톱 아래에서 구르는 색다른 베이스가 나옵니다. 드롭은 고장과 8-10 LU 대비를 기반으로 구축됩니다.',
  'genre.trance.pin.50': '킥 앤 롤링 베이스',
  'genre.trance.pin.50.why': '톱 아래의 드라이브.',
  'genre.trance.pin.315': '진흙 트랜스 싸움',
  'genre.trance.pin.315.why': '200~350Hz, 혼합이 흐려지는 경우.',
  'genre.trance.pin.3150': '부서지기 쉬운 밴드가 완화되었습니다.',
  'genre.trance.pin.3150.why': '톱이 유리처럼 변하는 약 3kHz입니다.',
  'genre.trance.stage.dimension': '120Hz 미만의 모노, 그 이상은 아닙니다.',
  'genre.trance.stage.maximizer':
    '천장이 거의 움직이지 않아 낙하가 대비를 유지합니다.',
  'genre.trance.off':
    '익사이터 또는 Bass Forge 없음: 슈퍼톱은 이미 충분한 상단을 생성합니다.',
  'genre.drumBass.hook': '모노 서브를 통해 174에서 브레이크',
  'genre.drumBass.story':
    '모노 사인 서브와 리즈 또는 뉴로 미드베이스에서 170~180BPM으로 중단됩니다. 스네어와 브레이크는 장르의 정체성이다.',
  'genre.drumBass.pin.50': '사인 서브',
  'genre.drumBass.pin.50.why': '모노이며 현재보다 부스트되지 않습니다.',
  'genre.drumBass.pin.500': '리즈를 위한 방',
  'genre.drumBass.pin.500.why': '차선이 주어진 중저음.',
  'genre.drumBass.pin.5000': '스네어와 브레이크의 균열',
  'genre.drumBass.pin.5000.why': '장르의 정체성.',
  'genre.drumBass.stage.bassPunch':
    '발차기가 조여졌지만 결코 올라가지 않았습니다.',
  'genre.drumBass.stage.dimension': '서브 모노.',
  'genre.drumBass.stage.maximizer':
    '16분의 1 내부로 들어갈 수 있는 가벼운 천장으로 인해 스네어가 균열을 유지합니다.',
  'genre.drumBass.off':
    'Exciter 또는 Bass Forge 없음: 뉴로 베이스에 고조파가 없습니다.',
  'genre.dubstep.hook': '으르렁거리는 소리 아래 사인 서브',
  'genre.dubstep.story':
    '약 140BPM, 70에서 느껴짐: 모노에서 30~60Hz의 순수한 사인 서브와 설계에 따라 왜곡된 중저음의 으르렁거림. 올가미의 균열이 살아남아야 하는 것입니다.',
  'genre.dubstep.pin.32': '서브는 그대로 남아있다',
  'genre.dubstep.pin.32.why': '이미 기록상 가장 시끄러운 일입니다.',
  'genre.dubstep.pin.80': '작은 스피커가 재생할 수 있는 무게',
  'genre.dubstep.pin.80.why': '서브 위의 몸체.',
  'genre.dubstep.pin.500': '올가미와 으르렁거림을 위한 공간',
  'genre.dubstep.pin.500.why': '중간이 지워졌습니다.',
  'genre.dubstep.stage.dimension': '120Hz 이하의 서브 모노.',
  'genre.dubstep.stage.maximizer': '거의 움직이지 않는 천장.',
  'genre.dubstep.off':
    '익사이터 없음, Bass Punch 또는 Bass Forge: 으르렁거리는 소리가 이미 흥건합니다.',
  'genre.downtempo.hook': '깊은 베이스 아래에서 느린 브레이크',
  'genre.downtempo.story':
    '깊고 더빙에 영향을 받은 베이스와 넓은 분위기 속에서 약 90~105BPM의 느린 브레이크비트가 있으며 상단은 어둡게 유지되고 바이닐 그레인은 그대로 남아 있습니다.',
  'genre.downtempo.pin.50': '깊은 저음',
  'genre.downtempo.pin.50.why': '그 안에 더빙이 있습니다.',
  'genre.downtempo.pin.2000': '중상부는 어둡게 유지되었습니다.',
  'genre.downtempo.pin.2000.why': '기록된 대로 완화되었습니다.',
  'genre.downtempo.pin.12500': '먼지가 쌓인 곡물',
  'genre.downtempo.pin.12500.why': '밝아지지 않았습니다.',
  'genre.downtempo.stage.dimension':
    '분위기는 더 넓어지고 저음은 좁아졌습니다.',
  'genre.downtempo.stage.maximizer': '느리고 가벼운 천장.',
  'genre.downtempo.off':
    'Bass Forge가 제공되고 중단되었습니다. 저음이 이미 깊습니다.',
  'genre.chillout.hook': '부드럽고 넓음',
  'genre.chillout.story':
    '120BPM 미만, 일반적으로 70~100: 부드러운 킥, 둥근 베이스, 넓고 부드러운 공간, 공간이 있는 마스터링, 7~13의 다이내믹 범위.',
  'genre.chillout.pin.80': '둥근 베이스',
  'genre.chillout.pin.80.why': '따뜻하고 결코 무겁지 않습니다.',
  'genre.chillout.pin.2000': '부드러운 중음',
  'genre.chillout.pin.2000.why': '날카로운 것은 없습니다.',
  'genre.chillout.pin.12500': '가벼운 공기',
  'genre.chillout.pin.12500.why': '위에는 쉬머가 있습니다.',
  'genre.chillout.stage.exciter': '가벼운 공기만.',
  'genre.chillout.stage.dimension': '더 넓은 상단: 여기서는 너비를 환영합니다.',
  'genre.chillout.stage.maximizer':
    '전체 비트에 걸쳐 느린 천장: 아무것도 누르지 않았습니다.',
  'genre.chillout.off':
    'Bass Punch 또는 Bass Forge 없음: 무거운 것은 없습니다.',
  'genre.lofi.hook': '일부러 어둡고 먼지가 많음',
  'genre.lofi.story':
    'Swing은 70~90BPM의 비트, 부드러운 더스티 킥, 필터링된 베이스, 레코드의 딱딱한 부분이 있는 12~16kHz의 저역 통과를 제공합니다. 나머지 제품군보다 조용한 약 -12 LUFS를 마스터했습니다.',
  'genre.lofi.pin.32': '하위 과대광고 없음',
  'genre.lofi.pin.32.why': '부드러운 킥은 부드러움을 유지합니다.',
  'genre.lofi.pin.200': '중간 정도의 따뜻함',
  'genre.lofi.pin.200.why': '한 방향으로 잘 걸립니다.',
  'genre.lofi.pin.3150': '고의적으로 어둡게',
  'genre.lofi.pin.3150.why': '기록보다 더 밝은 것은 없습니다.',
  'genre.lofi.stage.dimension': '약간 좁아지고 하단 모노는 120Hz 미만입니다.',
  'genre.lofi.stage.maximizer':
    '기록을 더 조용하게 마스터하기 위해 형제보다 조금 더 추진력이 있습니다.',
  'genre.lofi.off':
    'Exciter가 제공되고 중단됩니다. 레코드는 이미 테이프에 포화 상태입니다.',
  'genre.ambient.hook': '낮은 레벨을 위해 만들어진 드론과 너울',
  'genre.ambient.story':
    '비트가 없는 경우가 많습니다. 드론, 서브 패드 및 부풀음은 조용하게 들리도록 만들어지며, 기껏해야 부드러운 압축으로 -14 ~ -18 LUFS에서 마스터링됩니다.',
  'genre.ambient.pin.50': '서브 패드 및 드론',
  'genre.ambient.pin.50.why': '소리의 바닥.',
  'genre.ambient.pin.800': '중간에 공간',
  'genre.ambient.pin.800.why': '파도를 위한 공간.',
  'genre.ambient.pin.12500': '공기와 쉬머',
  'genre.ambient.pin.12500.why': '패드의 상단입니다.',
  'genre.ambient.stage.dimension':
    '와이드, 모든 장르 중 가장 넓으며 모노에서도 여전히 안전합니다.',
  'genre.ambient.stage.maximizer': '너울의 꼭대기에만 닿는 천장.',
  'genre.ambient.off':
    'Exciter가 제공되고 중단됩니다. 아무것도 압축하거나 조용함을 평준화하지 않습니다.',
  'genre.newAge.hook': '피아노, 플루트 및 긴 리버브',
  'genre.newAge.story':
    '느리거나 자유로운 시간, 긴 리버브의 피아노, 플루트 및 패드, 부드럽고 따뜻하며 갑자기 시끄러운 코드가 없습니다. -14 ~ -20 LUFS에서 마스터했습니다.',
  'genre.newAge.pin.200': '부드러운 따뜻함',
  'genre.newAge.pin.200.why': '패드의 본체입니다.',
  'genre.newAge.pin.2000': '날카로운 것은 없습니다',
  'genre.newAge.pin.2000.why': '완화되었습니다.',
  'genre.newAge.pin.12500': '약간의 공기',
  'genre.newAge.pin.12500.why': '리버브 위에.',
  'genre.newAge.stage.dimension': '넓은 분위기.',
  'genre.newAge.stage.maximizer': '아무것도 조용함을 평준화하지 않습니다.',
  'genre.newAge.off':
    'Exciter는 제공되고 중단됩니다. 투명하다는 것이 간단합니다.',
} satisfies Partial<Dictionary>;

export default genreElectronic;
