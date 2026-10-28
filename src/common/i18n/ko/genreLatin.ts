/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genreLatin = {
  'genre.latin.hook': '클라이브, 타악기, 금관',
  'genre.latin.story':
    '60에서 80BPM의 볼레로부터 220의 살사, 클라베 및 트레실로 이상, 바닥을 전달하는 두 가지 방법이 있습니다. 핸드 드럼 아래 예상되는 베이스, 종종 킥이 없는 경우 또는 808 이상의 모든 비트에 킥이 있습니다. 대부분의 에너지는 그림의 중앙에 있습니다.',
  'genre.latin.pin.80': '베이스 따뜻함',
  'genre.latin.pin.80.why': '드럼 아래.',
  'genre.latin.pin.315': '진흙탕',
  'genre.latin.pin.315.why': '타악기를 위한 공간입니다.',
  'genre.latin.pin.3150': '타악기와 목소리',
  'genre.latin.pin.3150.why': '존재감, 조금 앞으로.',
  'genre.latin.pin.12500': '황동 상단이 밀리지 않음',
  'genre.latin.pin.12500.why': '이미 고조파가 풍부합니다.',
  'genre.latin.stage.dimension':
    '사진은 혼합된 상태로 유지되었으며 저음만 좁아졌습니다.',
  'genre.latin.stage.maximizer': '타악기의 공격을 유지하는 천장.',
  'genre.latin.off':
    'Exciter가 제공되고 중단됩니다. 황동과 güira가 하나 아래에서 거칠어집니다.',
  'genre.latinPop.hook': '세련된 목소리로 뎀보우',
  'genre.latinPop.story':
    '85 ~ 105 BPM의 Dembow 및 tresillo, 모노 서브에 고정된 프로그래밍된 킥, 밝고 광택, 풀 스케일에 대한 피크가 있는 약 -8 LUFS를 마스터링합니다.',
  'genre.latinPop.pin.50': '타이트한 모노 서브',
  'genre.latinPop.pin.50.why': '프로그래밍된 로우엔드.',
  'genre.latinPop.pin.200': '중저음이 지워졌습니다.',
  'genre.latinPop.pin.200.why': '서브와 보이스 사이의 공간.',
  'genre.latinPop.pin.3150': '보컬 표현',
  'genre.latinPop.pin.3150.why': '단어가 있는 곳.',
  'genre.latinPop.stage.exciter':
    '보컬 아래에는 따뜻함과 바디감이 있고 그 위에는 아무것도 없습니다.',
  'genre.latinPop.stage.bassPunch': '서브가 조금 조여졌습니다.',
  'genre.latinPop.stage.dimension': '150Hz 미만의 모노.',
  'genre.latinPop.stage.maximizer': '거의 움직이지 않는 천장.',
  'genre.latinPop.off': 'Bass Forge 없음: 서브가 이미 킥에 잠겨 있습니다.',
  'genre.reggaeton.hook': '조율된 808의 비트마다 킥을 선사합니다.',
  'genre.reggaeton.story':
    '약 95 BPM의 Dembow: 모든 비트의 킥과 모노로 조율되고 포화된 긴 808에 대한 트레실로 스네어, 다이내믹 범위 5의 -8 LUFS에서 마스터링됩니다.',
  'genre.reggaeton.pin.50': '딥 모노 808',
  'genre.reggaeton.pin.50.why': '심화되고 중앙에 위치합니다.',
  'genre.reggaeton.pin.315': '진흙탕',
  'genre.reggaeton.pin.315.why': '뎀보우를 위한 공간입니다.',
  'genre.reggaeton.pin.5000': '스네어의 균열',
  'genre.reggaeton.pin.5000.why': '바삭바삭.',
  'genre.reggaeton.stage.dimension': '150Hz 미만의 모노.',
  'genre.reggaeton.stage.maximizer':
    '주인을 이렇게 크게 밀어붙일 수 없는 천장.',
  'genre.reggaeton.off':
    'Bass Forge가 제공되고 중단되었습니다. 왜곡된 808 아래의 옥타브와 고조파가 이미 음표의 13%에 이르렀습니다.',
  'genre.salsa.hook': '빠른 속도로 클레이브, 한쪽으로 콩가스',
  'genre.salsa.story':
    'Son은 160~220BPM의 속도로 클라이브하며, 다운비트를 건너뛰고 킥도 없는 툼바오, 한쪽으로 콩가, 중앙에 팀발레, 호른이 퍼집니다. 70년대 레코드의 다이나믹 레인지는 12~13이었습니다.',
  'genre.salsa.pin.80': '따뜻한 툼바오',
  'genre.salsa.pin.80.why': '밴드 아래에서 부드럽게.',
  'genre.salsa.pin.315': '진흙탕',
  'genre.salsa.pin.315.why': '콩가를 위한 공간.',
  'genre.salsa.pin.1250': '피아노 몬투노와 합창',
  'genre.salsa.pin.1250.why': '중간이 명확해졌습니다.',
  'genre.salsa.pin.12500': '황동과 카우벨이 밝아지지 않음',
  'genre.salsa.pin.12500.why': '들어 올리면 거칠어집니다.',
  'genre.salsa.stage.exciter':
    '따뜻함만 있고, 툼바오 아래는 부드럽게, 황동 위에는 아무것도 없습니다.',
  'genre.salsa.stage.dimension':
    '밴드는 원래 있던 자리를 떠나고 베이스만 좁아졌습니다.',
  'genre.salsa.stage.maximizer': '모든 콩가가 뚫고 나올 수 있는 느린 천장.',
  'genre.salsa.off':
    'Bass Punch 또는 Bass Forge도 없고 상단에는 아무것도 없습니다. 브라스와 카우벨은 이미 고조파가 풍부합니다.',
  'genre.bachata.hook': '눈물 흘리는 레퀸토와 메탈릭 귀라',
  'genre.bachata.story':
    '120~140BPM의 울부짖는 리드 기타와 당김음 베이스 위의 금속성 귀라. 3~8kHz를 올리면 피곤한데, 구이라(Güira)는 댄서들의 메트로놈이다.',
  'genre.bachata.pin.50': '따뜻한 당김음 베이스',
  'genre.bachata.pin.50.why': '따뜻해진 유일한 것.',
  'genre.bachata.pin.1250': '레퀸토, 클리어',
  'genre.bachata.pin.1250.why': '리드 기타의 목소리.',
  'genre.bachata.pin.8000': '3~8kHz가 들리지 않음',
  'genre.bachata.pin.8000.why': '귀라와 레퀸토는 귀를 빨리 지치게 합니다.',
  'genre.bachata.stage.dimension':
    '혼합됨에 따라 두 기타는 서로 분리됩니다. 저음만 좁아졌습니다.',
  'genre.bachata.stage.maximizer': '구이라의 공격을 막아주는 가벼운 천장.',
  'genre.bachata.off':
    'Exciter는 제공되고 중단됩니다. 이는 requinto와 güira를 거칠게 만듭니다.',
  'genre.merengue.hook': '탐보라와 16분음표 귀라',
  'genre.merengue.story':
    '120~160 BPM의 2박자 메렝게, 탐보라, 색소폰과 금관 악기 아래의 16분음표 귀라. 리미터가 번질 정도로 밀도가 높습니다.',
  'genre.merengue.pin.80': '탐보라와 베이스',
  'genre.merengue.pin.80.why': '2박자의 펀치.',
  'genre.merengue.pin.315': '진흙탕',
  'genre.merengue.pin.315.why': '조밀한 밴드의 공간.',
  'genre.merengue.pin.5000': '위쪽이 완화됨',
  'genre.merengue.pin.5000.why': '기라와 색소폰은 이미 밝습니다.',
  'genre.merengue.stage.bassPunch': '탐보라의 펀치는 팽팽했다.',
  'genre.merengue.stage.dimension':
    '오르케스타는 혼합되어 베이스만 좁아졌습니다.',
  'genre.merengue.stage.maximizer': '구이라를 더럽히지 않는 가벼운 천장.',
  'genre.merengue.off':
    'Exciter 또는 Bass Forge 없음: 색소폰 및 Güira에 탑이 추가되지 않습니다.',
  'genre.cumbia.hook': '꾸준한 긁힘과 2비트 베이스',
  'genre.cumbia.story':
    '85~110BPM의 가장 느린 댄스 계열: 꾸준한 과차라카 스크레이프와 단순한 2비트 베이스, 아코디언이나 건반이 있는 따뜻하고 중간 전진음.',
  'genre.cumbia.pin.125': '따뜻한 2박자 베이스',
  'genre.cumbia.pin.125.why': '춤이 있는 곳.',
  'genre.cumbia.pin.315': '진흙탕',
  'genre.cumbia.pin.315.why': '아코디언과 목소리를 위한 공간.',
  'genre.cumbia.pin.12500': '스크레이퍼가 날카롭지 않음',
  'genre.cumbia.pin.12500.why': '맥박은 그대로 남아 있습니다.',
  'genre.cumbia.stage.exciter':
    '베이스에는 따뜻함이 있고 상단에는 아무것도 없습니다.',
  'genre.cumbia.stage.dimension': '밴드가 믹싱되면서 베이스만 좁아졌습니다.',
  'genre.cumbia.stage.maximizer':
    '스크레이퍼의 펄스를 그대로 유지하는 느린 천장.',
  'genre.cumbia.off':
    'Bass Punch 또는 Bass Forge 없음: 긁힘과 베이스가 재생된 상태로 유지됩니다.',
  'genre.bossaNova.hook': '나일론 기타와 절제된 목소리',
  'genre.bossaNova.story':
    '120에서 150 BPM으로 계산되고 60에서 75로 느껴집니다. 나일론 기타, 절제된 목소리 아래 엄지 손가락 베이스 및 브러시입니다. 11~16의 다이내믹 레인지를 갖춘 제품군 중 가장 다이내믹한 레코드 중 하나입니다.',
  'genre.bossaNova.pin.125': '나일론 기타 따뜻함',
  'genre.bossaNova.pin.125.why': '기타의 본체입니다.',
  'genre.bossaNova.pin.800': '박스형이 아닌 부드러움',
  'genre.bossaNova.pin.800.why': '완화되었습니다.',
  'genre.bossaNova.pin.5000': '목소리에 약간의 공기',
  'genre.bossaNova.pin.5000.why': '존재감, 부드럽게.',
  'genre.bossaNova.stage.exciter':
    '기타에는 따뜻함이 있고 목소리에는 약간의 공기가 있습니다.',
  'genre.bossaNova.stage.dimension': '녹음된 대로 친밀하고 중앙에 가깝습니다.',
  'genre.bossaNova.stage.maximizer': '잡기만 하는 천장.',
  'genre.bossaNova.off':
    'Bass Punch 또는 Bass Forge 없음: 아무것도 압축하거나 하위를 추가하지 않습니다.',
  'genre.samba.hook': '통화 및 응답의 과장된 표현',
  'genre.samba.story':
    '2/4박자에서는 카리오카가 100~120BPM이고 엔레도가 더 빠릅니다. 서도는 탐보림, 판데이로, 카이사에서 두 번째 비트를 강조합니다. 원본의 다이나믹 레인지는 12였습니다.',
  'genre.samba.pin.80': '서도, 꽉',
  'genre.samba.pin.80.why': '붐을 일으키기보다는 조여졌습니다.',
  'genre.samba.pin.315': '진흙탕',
  'genre.samba.pin.315.why': '배터리 내부의 공간.',
  'genre.samba.pin.5000': '탐보림과 판데이로',
  'genre.samba.pin.5000.why': '선명하고 금속성입니다.',
  'genre.samba.stage.bassPunch': '서도는 붐을 일으키기보다는 조여졌습니다.',
  'genre.samba.stage.dimension':
    '앙상블의 자연스러운 폭, 베이스만 좁아졌습니다.',
  'genre.samba.stage.maximizer': '퍼커션의 공격을 서두르지 않는 천장.',
  'genre.samba.off': '이미 밝은 상단에는 Exciter 또는 Bass Forge가 없습니다.',
  'genre.flamenco.hook': '라스게아도(Rasgueado), 팔마스 및 풋워크',
  'genre.flamenco.story':
    '195~240BPM의 프리 솔라부터 불레리아까지, 기타, 팔마스 및 풋워크는 리듬 그 자체이며 녹음에서 그 무엇보다도 역동적입니다. Paco de Lucía의 다이내믹 범위는 13~17입니다.',
  'genre.flamenco.pin.50': '최소한의 저음',
  'genre.flamenco.pin.50.why': '기타, 카혼, 발, 그 이상은 아닙니다.',
  'genre.flamenco.pin.2000': '기타의 공격',
  'genre.flamenco.pin.2000.why': '타악기 공격.',
  'genre.flamenco.pin.12500': '위쪽이 완화됨',
  'genre.flamenco.pin.12500.why': '이미 밝음: 아무것도 추가되지 않았습니다.',
  'genre.flamenco.stage.exciter': '몸, 결코 최고가 아닙니다.',
  'genre.flamenco.stage.dimension':
    '녹음된 대로 중앙에 기타와 가수가 있습니다.',
  'genre.flamenco.stage.maximizer': '가능한 모든 정점을 유지하는 천장입니다.',
  'genre.flamenco.off':
    'Bass Punch 또는 Bass Forge 없음: 아무것도 리듬을 압축하지 않습니다.',
  'genre.regionalMexican.hook': '튜바, 아코디언 및 트럼펫',
  'genre.regionalMexican.story':
    '반다의 튜바와 탐보라, 노르테뇨의 아코디언과 바호 섹스토, 마리아치의 기타론과 트럼펫, 폴카, 란체라, 소네. 밝고 시끄럽고 앞으로 나아갑니다. 클래식 레코드의 다이나믹 레인지는 9~14입니다.',
  'genre.regionalMexican.pin.80': '튜바와 기타론',
  'genre.regionalMexican.pin.80.why': '무게와 따뜻함.',
  'genre.regionalMexican.pin.1250': '목소리는 앞으로',
  'genre.regionalMexican.pin.1250.why': '강력해요, 앞에요.',
  'genre.regionalMexican.pin.3150': '트럼펫과 아코디언 길들이기',
  'genre.regionalMexican.pin.3150.why':
    '완화되었지만 결코 해제되지 않았습니다.',
  'genre.regionalMexican.pin.12500': '황동 상단이 완화되었습니다.',
  'genre.regionalMexican.pin.12500.why': '이미 충분히 시끄럽습니다.',
  'genre.regionalMexican.stage.bassPunch': '탐보라의 펀치는 팽팽했다.',
  'genre.regionalMexican.stage.dimension':
    '라이브 앙상블을 믹싱하여 베이스만 좁혀졌습니다.',
  'genre.regionalMexican.stage.maximizer': '밝은 천장.',
  'genre.regionalMexican.off':
    'Exciter는 제공되고 중단됩니다. 금관 악기, 아코디언 및 바이올린은 이미 밝습니다.',
  'genre.corridos.hook': '튜바 위에 강철 레퀸토',
  'genre.corridos.story':
    '3/4 또는 6/8 박자에서 약 105BPM으로 느껴집니다. 튜바 위의 강철 현 레퀸토, 툼바도스에서는 튜바를 두 배로 늘린 808입니다.',
  'genre.corridos.pin.80': 'Tuba의 따뜻함, 모노의 808',
  'genre.corridos.pin.80.why': '로우 엔드, 중앙.',
  'genre.corridos.pin.315': '진흙탕',
  'genre.corridos.pin.315.why': '레퀸토를 위한 공간입니다.',
  'genre.corridos.pin.12500': '강철 레퀸토는 밝아지지 않았다',
  'genre.corridos.pin.12500.why': '이미 분명히 표현했습니다.',
  'genre.corridos.stage.dimension':
    '120Hz 미만의 서브 모노; 레퀸토와 리듬 기타는 믹스가 놓인 자리에 남겨졌습니다.',
  'genre.corridos.stage.maximizer':
    '전방을 내다보는 천장이 픽 공격을 유지합니다.',
  'genre.corridos.off':
    'Bass Forge가 제공되고 중단되었습니다. 808은 자체 서브를 가져옵니다.',
} satisfies Partial<Dictionary>;

export default genreLatin;
