/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genreWorld = {
  'genre.afrobeat.hook': '대규모 라이브 밴드의 긴 그루브',
  'genre.afrobeat.story':
    '105~135BPM의 Fela의 아프로비트: 반복되는 베이스 형상, Tony Allen의 당김음 킥, 바쁜 모자, 경적 아래의 셰케레 및 콩가. 1970년대 원본의 다이나믹 레인지는 11~16이었습니다.',
  'genre.afrobeat.pin.80': '킥과 베이스의 모습',
  'genre.afrobeat.pin.80.why': '그루브의 바닥.',
  'genre.afrobeat.pin.315': '빅 밴드의 공간',
  'genre.afrobeat.pin.315.why': '진흙이 나옵니다.',
  'genre.afrobeat.pin.800': '호른과 오르간',
  'genre.afrobeat.pin.800.why': '그것의 중간 부자의 마음.',
  'genre.afrobeat.pin.3150': '부드러운 70년대 탑',
  'genre.afrobeat.pin.3150.why': '아날로그 마스터 사운드처럼 편안합니다.',
  'genre.afrobeat.stage.exciter':
    '아날로그 마스터를 위한 따뜻함과 약간의 공기.',
  'genre.afrobeat.stage.bassPunch': '베이스가 조금 조여졌습니다.',
  'genre.afrobeat.stage.dimension':
    '빅밴드는 녹음대로 퍼졌고, 베이스만 좁아졌다.',
  'genre.afrobeat.stage.maximizer': '역동성을 유지하는 느린 천장.',
  'genre.afrobeat.off':
    'Bass Forge도 없고 밴드를 압박하는 것도 없습니다. 천장만 잡아줍니다.',
  'genre.afrobeats.hook': '라운드 킥과 사인 서브',
  'genre.afrobeats.story':
    '약 110BPM: 둥글고 따뜻한 킥과 사인 서브, 최신 레코드의 로그 드럼, 모노에서 100~150Hz 미만의 모든 것, 셰이커는 넓습니다.',
  'genre.afrobeats.pin.50': '따뜻한 사인 서브',
  'genre.afrobeats.pin.50.why': '모노이며 결코 넓어지지 않습니다.',
  'genre.afrobeats.pin.800': '중앙에 있는 방',
  'genre.afrobeats.pin.800.why': '그네를 위한 공간.',
  'genre.afrobeats.pin.12500': '셰이커와 보컬 에어',
  'genre.afrobeats.pin.12500.why': '빛, 위에.',
  'genre.afrobeats.stage.dimension':
    '150Hz 미만의 모노에서는 셰이커가 약간 더 넓어집니다.',
  'genre.afrobeats.stage.maximizer': '그네를 지켜주는 가벼운 천장.',
  'genre.afrobeats.off':
    'Bass Forge가 제공되고 중단되었습니다. 사인 서브는 깨끗하고 그 아래에 옥타브나 그릿이 필요하지 않습니다.',
  'genre.amapiano.hook': '통나무 드럼은 에너지입니다',
  'genre.amapiano.story':
    '약 113 BPM: 로그 드럼은 재즈 피아노, 넓은 패드 및 밝은 쉐이커 아래에서 어택이 에너지인 음조의 타악기 베이스입니다.',
  'genre.amapiano.pin.125': '통나무 드럼 본체',
  'genre.amapiano.pin.125.why': '100~200Hz, 중앙.',
  'genre.amapiano.pin.500': '중저음 진흙 아웃',
  'genre.amapiano.pin.500.why': '재즈 피아노를 위한 공간입니다.',
  'genre.amapiano.pin.8000': '브라이트 셰이커',
  'genre.amapiano.pin.8000.why': '약간의 리프트.',
  'genre.amapiano.stage.dimension':
    '120Hz 이하의 서브 모노와 통나무 드럼의 몸체가 200으로 좁아져 중앙에 유지됩니다. 폭은 3kHz 이상입니다.',
  'genre.amapiano.stage.maximizer':
    '통나무 드럼의 공격을 막아주는 가벼운 천장.',
  'genre.amapiano.off':
    'Bass Forge가 제공되고 중단되었습니다. 통나무 드럼에 대한 한 가지 규칙은 포화되지 않는다는 것입니다.',
  'genre.highlife.hook': '감미로운 기타와 재즈 호른',
  'genre.highlife.story':
    '벨 패턴 위의 100~130BPM: 맞물린 기타, 깨끗하고 감미로운 소리, 멜로디 베이스 위의 재즈 호른. 이전 레코드의 동적 범위는 10~13이었습니다.',
  'genre.highlife.pin.80': '멜로디 베이스',
  'genre.highlife.pin.80.why': '약간의 따뜻함.',
  'genre.highlife.pin.315': '진흙탕',
  'genre.highlife.pin.315.why': '기타를 위한 공간입니다.',
  'genre.highlife.pin.3150': '달콤한 기타',
  'genre.highlife.pin.3150.why': '명확하고 밝습니다.',
  'genre.highlife.stage.exciter':
    '오래된 녹음에는 약간의 따뜻함과 공기가 있습니다.',
  'genre.highlife.stage.dimension': '녹음된 패닝 기타.',
  'genre.highlife.stage.maximizer': '느린 천장.',
  'genre.highlife.off':
    'Bass Punch 또는 Bass Forge 없음: 깨끗한 기타는 깨끗하게 유지됩니다.',
  'genre.world.hook': '체인이 할 수 있는 최소한의 일',
  'genre.world.story':
    '모든 방식으로 녹음된 녹음, 그 중에는 서양 참조가 알지 못하는 음색을 지닌 모노 필드 녹음도 있습니다. 연구의 조언은 아무것도 부과하지 않는 것입니다.',
  'genre.world.pin.32': '아래에는 거의 아무것도 없습니다',
  'genre.world.pin.32.why': '기록대로 남았습니다.',
  'genre.world.pin.3150': '명확성을 위해 약간의 상승',
  'genre.world.pin.3150.why': '데시벨 미만.',
  'genre.world.pin.12500': '약간의 공기',
  'genre.world.pin.12500.why': '온화한.',
  'genre.world.stage.maximizer': '잡기만 하는 천장.',
  'genre.world.off':
    'No Dimension, Exciter, Bass Punch 또는 Bass Forge: 사진이 그대로 남아 있습니다.',
  'genre.bollywood.hook': '재생 음성 주변의 무성한 배경',
  'genre.bollywood.story':
    '70 ~ 95 BPM의 발라드와 110 ~ 140의 댄스 넘버: 화려한 영화 배경, 5개의 리버브, 4개의 딜레이, 중앙 재생 보컬 주변. 현대 무용곡은 베이스가 무겁고 시끄럽습니다.',
  'genre.bollywood.pin.80': '댄스 넘버 베이스',
  'genre.bollywood.pin.80.why': '빡빡하지 않고 부밍하지 않습니다.',
  'genre.bollywood.pin.315': '배경 아래 진흙이 튀어 나와',
  'genre.bollywood.pin.315.why': '목소리를 위한 공간.',
  'genre.bollywood.pin.2000': '재생 음성',
  'genre.bollywood.pin.2000.why': '앞으로 깨끗합니다.',
  'genre.bollywood.stage.bassPunch': '서브가 조여졌습니다.',
  'genre.bollywood.stage.dimension':
    '사진은 나온 것만큼 넓게 남았습니다. 저음만 좁아졌습니다.',
  'genre.bollywood.stage.maximizer': '거의 움직이지 않는 천장.',
  'genre.bollywood.off': '음성에 Exciter가 없고 Bass Forge가 없습니다.',
  'genre.bhangra.hook': '돌(Dhol)이 장르다.',
  'genre.bhangra.story':
    '90~110BPM에서는 돌의 두꺼운 붐과 고음의 크랙이 텀비 아래에서 들리고 앞쪽 목소리가 나옵니다. 돌의 공격은 음악이다.',
  'genre.bhangra.pin.50': '돌의 붐',
  'genre.bhangra.pin.50.why': '단단하고 결코 올라가지 않습니다.',
  'genre.bhangra.pin.500': '진흙탕',
  'genre.bhangra.pin.500.why': '균열을 위한 공간.',
  'genre.bhangra.pin.2000': 'Dhol 균열 및 tumbi',
  'genre.bhangra.pin.2000.why': '밝고 펀치감이 있습니다.',
  'genre.bhangra.stage.bassPunch':
    '붐의 꼬리가 조여졌고 결코 올라가지 않았습니다.',
  'genre.bhangra.stage.dimension': '저음이 좁아져서 돌의 붐이 중간을 잡습니다.',
  'genre.bhangra.stage.maximizer':
    '균열이 통과할 수 있을 만큼 충분히 긴 미리보기입니다.',
  'genre.bhangra.off':
    'Exciter 또는 Bass Forge 없음: 상단이 추가되지 않았습니다.',
  'genre.indianClassical.hook': '드론 위에서 측정되지 않은 랩',
  'genre.indianClassical.story':
    '탄푸라 드론에 대한 무측정 alap, 그 다음 타블라, 느린 vilambit에서 300BPM을 넘는 drut까지. jivari 브릿지는 시타르와 탄푸라에 고조파를 생성하고 녹음은 -14 ~ -20 LUFS로 가볍게 압축됩니다.',
  'genre.indianClassical.pin.125': '바얀은 연주대로 떠났다',
  'genre.indianClassical.pin.125.why': '피치 벤드가 바로 음악입니다.',
  'genre.indianClassical.pin.800': '솔리스트의 신체',
  'genre.indianClassical.pin.800.why': '보이스나 시타르, 조금 앞으로.',
  'genre.indianClassical.pin.12500': '탄푸라의 반짝임',
  'genre.indianClassical.pin.12500.why': '드론의 후광.',
  'genre.indianClassical.stage.maximizer':
    '천장만 해당: 레벨러가 드론을 동시에 들어올립니다.',
  'genre.indianClassical.off':
    'No Dimension, Exciter 또는 Bass Punch: jivari의 고조파가 내장되어 있습니다.',
  'genre.arabicPop.hook': '막섬 위에 장식된 목소리',
  'genre.arabicPop.story':
    '70~90BPM의 발라드와 막숨의 돔과 텍, 반향적이고 장식적인 목소리, 넓은 현, 카눈과 우드로 95~130도로 춤을 춥니다.',
  'genre.arabicPop.pin.80': 'Doum과 베이스, 타이트하게',
  'genre.arabicPop.pin.80.why': '리듬의 낮은 끝.',
  'genre.arabicPop.pin.500': '진흙탕',
  'genre.arabicPop.pin.500.why': '목소리를 위한 공간.',
  'genre.arabicPop.pin.1250': '목소리는 앞으로',
  'genre.arabicPop.pin.1250.why': '장신구가 깨끗해졌습니다.',
  'genre.arabicPop.pin.5000': '문자열이 밝아지지 않음',
  'genre.arabicPop.pin.5000.why': '벌써 밝아요.',
  'genre.arabicPop.stage.exciter':
    '목소리 아래 따뜻함; 현과 텍은 그대로 밝게 남아 있습니다.',
  'genre.arabicPop.stage.bassPunch': '하단이 조여졌습니다.',
  'genre.arabicPop.stage.dimension':
    '문자열은 녹음된 너비만큼 남았습니다. 저음만 좁아졌습니다.',
  'genre.arabicPop.stage.maximizer': '다르부카의 공격을 막아주는 가벼운 천장.',
  'genre.arabicPop.off':
    'Bass Forge 없음: doum 아래에 아무것도 생성되지 않습니다.',
  'genre.turkishPop.hook': '터키 컬러가 가미된 세련된 팝',
  'genre.turkishPop.story':
    '약 90~130 BPM, 때로는 9/8: 킥, 베이스, 현악기 아래 다르부카의 낮은 스트로크, 바글라마 및 클라리넷. 세련되고 밝습니다. 현대 앨범의 다이내믹 레인지는 5~6입니다.',
  'genre.turkishPop.pin.80': '단단한 바닥',
  'genre.turkishPop.pin.80.why': '킥과 다르부카.',
  'genre.turkishPop.pin.315': '진흙탕',
  'genre.turkishPop.pin.315.why': '목소리를 위한 공간.',
  'genre.turkishPop.pin.1250': '현재의 목소리',
  'genre.turkishPop.pin.1250.why': '앞에.',
  'genre.turkishPop.pin.8000': '광택이 추가되지 않았습니다.',
  'genre.turkishPop.pin.8000.why': '이미 연마되었습니다.',
  'genre.turkishPop.stage.exciter':
    '목소리 아래에는 따뜻함이 있지만 다르부카에는 아무것도 없습니다.',
  'genre.turkishPop.stage.bassPunch': '단단한 바닥.',
  'genre.turkishPop.stage.dimension': '믹스되면서 저음만 좁아졌습니다.',
  'genre.turkishPop.stage.maximizer': '거의 밀리지 않는 천장.',
  'genre.turkishPop.off': '이렇게 다듬어진 음반에는 Bass Forge가 없습니다.',
  'genre.gospel.hook': '몇 분 동안 만들어지는 합창단과 뱀프',
  'genre.gospel.story':
    '60~80BPM의 발라드와 110~130BPM의 찬양: 낮은 B까지 바쁜 일렉트릭 베이스, 해먼드 오르간, 리드 보이스와 넓은 합창단 아래의 라이브 키트. 뱀파이어는 몇 분 동안 만들어집니다.',
  'genre.gospel.pin.80': '분주한 베이스와 킥',
  'genre.gospel.pin.80.why': '밴드의 엔진.',
  'genre.gospel.pin.315': '합창단과 해먼드의 진흙탕',
  'genre.gospel.pin.315.why': '완전한 사운드를 제공하는 공간.',
  'genre.gospel.pin.2000': '리드 보이스',
  'genre.gospel.pin.2000.why': '앞으로.',
  'genre.gospel.stage.dimension': '합창단은 녹음된 만큼 넓게 떠났다.',
  'genre.gospel.stage.maximizer': '뱀프를 만들 수 있는 느린 천장.',
  'genre.gospel.off':
    'Exciter가 제공되고 중단됩니다. 합창단에는 흥분이 없습니다.',
  'genre.christian.hook': '큰 다리에 조용한 구절 건물',
  'genre.christian.story':
    '75~115BPM의 팝록을 감상하세요. 조용한 시구부터 큰 다리까지, 가사가 선명하고 앰비언트 기타가 이미 매우 폭넓습니다.',
  'genre.christian.pin.80': '팝록 로우엔드',
  'genre.christian.pin.80.why': '킥과 베이스.',
  'genre.christian.pin.800': '중앙에 있는 방',
  'genre.christian.pin.800.why': '와이드 기타용.',
  'genre.christian.pin.3150': '가사가 명확해',
  'genre.christian.pin.3150.why': '단어가 있는 곳.',
  'genre.christian.stage.dimension':
    '저음이 좁아졌습니다. 기타는 넓게 남았습니다.',
  'genre.christian.stage.maximizer': '호를 유지할 만큼 느린 천장.',
  'genre.christian.off':
    'Exciter 없음, Bass Punch 또는 Bass Forge: 빌드가 노래입니다.',
} satisfies Partial<Dictionary>;

export default genreWorld;
