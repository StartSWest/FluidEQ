/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genreCountry = {
  'genre.country.hook': '가사가 먼저',
  'genre.country.story':
    '70~130BPM의 2단계, 셔플 및 왈츠, 어쿠스틱 킥 및 일렉트릭 베이스, 음성 중심 및 전면 가사. 전통적인 음반은 자연스럽고 깔끔하며, 마스터링 문학은 그 위에 약간의 조화로운 삶을 요구한다.',
  'genre.country.pin.125': '베이스 과대 광고 없음',
  'genre.country.pin.125.why':
    '거의 손대지 않았습니다. 국가는 결코 낮은 수준으로 건설되지 않았습니다.',
  'genre.country.pin.500': '목소리의 박진감',
  'genre.country.pin.500.why':
    '그래서 가수는 틀에 갇혔다기보다는 가깝게 들립니다.',
  'genre.country.pin.3150': '가사가 명확해',
  'genre.country.pin.3150.why': '자음에 존재합니다.',
  'genre.country.stage.exciter':
    '자음의 존재와 현의 한 옥타브 공기 모두 가볍습니다.',
  'genre.country.stage.dimension':
    '거의 기록된 것과 같습니다. 바닥이 좁아지고 측면에 약간의 공기가 있습니다.',
  'genre.country.stage.maximizer': '밝은 천장.',
  'genre.country.off':
    'Bass Punch 또는 Bass Forge 없음: 킥과 베이스가 재생된 상태로 유지됩니다.',
  'genre.modernCountry.hook': '스틸 기타를 활용한 팝 프로덕션',
  'genre.modernCountry.story':
    '75 ~ 125 BPM의 세련되고 밝으며 808 스타일의 킥이 서브를 채우고 중앙에 위치한 보이스와 하이 엔드로 넓어진 측면이 있습니다. 마스터는 5~6의 다이나믹 레인지에 위치합니다.',
  'genre.modernCountry.pin.125': '808 스타일의 킥',
  'genre.modernCountry.pin.125.why': '현대 로우엔드가 사는 곳.',
  'genre.modernCountry.pin.500': '중저음이 지워졌습니다.',
  'genre.modernCountry.pin.500.why': '목소리와 스틸 기타를 위한 공간.',
  'genre.modernCountry.pin.3150': '음성 존재',
  'genre.modernCountry.pin.3150.why': '조금 들어 올려 가혹함을 관찰했습니다.',
  'genre.modernCountry.stage.dimension':
    '믹스되면서 베이스가 좁아지고 측면이 조금 넓어졌습니다.',
  'genre.modernCountry.stage.maximizer':
    '이미 시끄러운 마스터를 거의 구동하지 않는 천장.',
  'genre.modernCountry.off':
    '아무것도 생성되지 않았습니다. 이미 서브를 채우는 808s 미만의 Exciter, Bass Punch 또는 Bass Forge가 없습니다.',
  'genre.americana.hook':
    '한 방에 밴드가 있고 그 안에는 다이나믹이 남아있습니다.',
  'genre.americana.story':
    '60~130BPM의 음악, 라이트 또는 브러시드 키트, 업라이트 또는 일렉트릭 베이스, 밴드가 함께 녹음하거나 테이프에 녹음하는 경우가 많습니다. 레코드는 7~12의 동적 범위를 유지합니다.',
  'genre.americana.pin.125': '따뜻한 업라이트 베이스',
  'genre.americana.pin.125.why': '방에 있는 밴드의 둥근 바닥.',
  'genre.americana.pin.800': '원룸 박시함 아웃',
  'genre.americana.pin.800.why': '그래서 방은 열린 것처럼 들립니다.',
  'genre.americana.pin.3150': '목소리',
  'genre.americana.pin.3150.why': '조금 앞으로.',
  'genre.americana.stage.exciter': '따뜻함과 현에 닿는 공기의 느낌.',
  'genre.americana.stage.dimension':
    '원룸 사진은 그대로 유지됩니다. 확대되지 않고 베이스가 더 좁아졌습니다.',
  'genre.americana.stage.maximizer': '전체 비트에 걸쳐 느린 천장.',
  'genre.americana.off':
    'Bass Punch 또는 Bass Forge 없음: 브러시드 키트나 업라이트 베이스의 모양을 바꾸는 것은 없습니다.',
  'genre.bluegrass.hook': '드럼 없음: 피킹이 리듬입니다',
  'genre.bluegrass.story':
    '밴조, 만돌린, 바이올린, 기타 및 업라이트 베이스, 50BPM에 가까운 발라드부터 130을 넘는 브레이크다운까지. 드럼은 전혀 없습니다. 업라이트 베이스가 바닥 전체이고 픽 어택이 비트입니다.',
  'genre.bluegrass.pin.80': '업라이트 베이스가 바닥이다.',
  'genre.bluegrass.pin.80.why': '그 아래에는 아무것도 추가되지 않았습니다.',
  'genre.bluegrass.pin.5000': '밴조와 만돌린의 광채',
  'genre.bluegrass.pin.5000.why': '따기가 빛나는 곳.',
  'genre.bluegrass.pin.12500': '현 위의 공기',
  'genre.bluegrass.pin.12500.why': '밴드 주변의 공간.',
  'genre.bluegrass.stage.exciter':
    '밴조와 만돌린보다 한 옥타브 높은 공기를 뿜어냅니다.',
  'genre.bluegrass.stage.dimension':
    '녹음된 대로 근접 마이킹되고 자연스럽습니다.',
  'genre.bluegrass.stage.maximizer':
    '픽 공격을 절대 평탄하게 만들지 않는 느린 천장.',
  'genre.bluegrass.off':
    'Bass Punch 또는 Bass Forge 없음: 형성할 킥도 없고 발명할 서브도 없습니다.',
  'genre.folk.hook': '미니멀하고 자연스러운',
  'genre.folk.story':
    '자연스러운 공간에서 60~130BPM의 보이스와 기타(종종 루바토). 포크 마스터링 자체는 반 데시벨 이동으로 작동하며 1~2%의 고조파를 추가합니다. 이 프리셋도 마찬가지입니다.',
  'genre.folk.pin.200': '기타의 몸체',
  'genre.folk.pin.200.why': '향판의 따뜻함.',
  'genre.folk.pin.3150': '온화한 존재감',
  'genre.folk.pin.3150.why': '목소리가 조금 더 가까워졌습니다.',
  'genre.folk.pin.12500': '공기',
  'genre.folk.pin.12500.why': '7kHz 이상에서는 약하게.',
  'genre.folk.stage.exciter':
    '2kHz 근처의 부드러운 존재감, 7 이상의 공기, 그리고 작은 비율의 하모닉스 포크 마스터링이 사용됩니다.',
  'genre.folk.stage.dimension': '녹음된 방.',
  'genre.folk.stage.maximizer': '결코 조용함을 평준화하지 않는 느린 천장.',
  'genre.folk.off':
    'Bass Punch 또는 Bass Forge 없음: 음성 및 기타에 저음이 과대포장되지 않습니다.',
  'genre.acoustic.hook': '기타의 몸체와 현',
  'genre.acoustic.story':
    '킥이 없는 60~130BPM의 어쿠스틱 기타, 스테레오 쌍으로 녹음. 원하는 것은 길들인 붐, 완화된 강철 현의 4~6kHz 취성, 10kHz 이상의 공기 셸프입니다.',
  'genre.acoustic.pin.32': '붐 완화',
  'genre.acoustic.pin.32.why': '가까운 마이크가 추가하는 낮은 쿵쿵 소리.',
  'genre.acoustic.pin.5000': '강철줄의 부서짐이 길들여졌습니다',
  'genre.acoustic.pin.5000.why': '귀를 지치게 하는 원밴드.',
  'genre.acoustic.pin.12500': '공기 셸프',
  'genre.acoustic.pin.12500.why': '10kHz 이상에서는 현이 희미하게 빛납니다.',
  'genre.acoustic.stage.exciter': '사운드보드의 몸체와 10kHz 이상의 공기.',
  'genre.acoustic.stage.dimension': '녹음된 스테레오 쌍입니다.',
  'genre.acoustic.stage.maximizer': '전체 비트를 넘어갈 수 있는 느린 천장.',
  'genre.acoustic.off':
    'Bass Punch 프로필이 제공되고 중단됩니다. 기타에는 모양을 지정할 수 있는 킥이 없습니다.',
  'genre.singerSongwriter.hook': '목소리와 하나의 악기, 친밀한',
  'genre.singerSongwriter.story':
    '기타나 피아노 위의 목소리, 60~120BPM, 종종 루바토, 중앙에 가깝고 가깝습니다. 기록의 중앙값은 -10.6 LUFS로 대부분의 것보다 조용합니다. 친밀감과 역동성이 전부입니다.',
  'genre.singerSongwriter.pin.80': '베이스 과대 광고 없음',
  'genre.singerSongwriter.pin.80.why': '목소리와 기타 아래에 숨겨져 있습니다.',
  'genre.singerSongwriter.pin.2000': '가깝고 또렷한 목소리',
  'genre.singerSongwriter.pin.2000.why': '단어가 있는 곳.',
  'genre.singerSongwriter.pin.12500': '온화한 공기',
  'genre.singerSongwriter.pin.12500.why': '목소리 위의 숨결.',
  'genre.singerSongwriter.stage.exciter':
    '바디만 있고 치찰음에는 하모닉스가 없습니다.',
  'genre.singerSongwriter.stage.dimension':
    '목소리를 중앙에 유지하기 위해 중음이 더 좁아집니다.',
  'genre.singerSongwriter.stage.maximizer': '느린 천장.',
  'genre.singerSongwriter.off':
    'Bass Punch 또는 Bass Forge 없음: 음성과 악기 하나를 혼잡하게 만드는 것은 없습니다.',
} satisfies Partial<Dictionary>;

export default genreCountry;
