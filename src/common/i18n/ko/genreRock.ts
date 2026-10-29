/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genreRock = {
  'genre.rock.hook': '킥과 스네어는 그대로, 패닝된 기타',
  'genre.rock.story':
    '백비트의 기타 밴드, 110~140BPM, 기타는 왼쪽과 오른쪽으로 두 배로 커지고 목소리는 중앙에 있습니다. 디스토션은 이미 기타의 하모닉스를 만들고 있으므로 재생 시 레코드에 필요한 것은 온전한 킥과 스네어, 상쇄할 수 없는 저음입니다.',
  'genre.rock.pin.80': '킥 앤 베이스 기타',
  'genre.rock.pin.80.why': '백비트의 무게.',
  'genre.rock.pin.315': '기타가 진흙으로 변하는 곳',
  'genre.rock.pin.315.why': '일그러진 기타의 벽이 여기에 쌓여서 무너진다.',
  'genre.rock.pin.3150': '기타의 물린',
  'genre.rock.pin.3150.why': '조금 앞으로 공격과 가장자리를 선택하십시오.',
  'genre.rock.pin.12500': '혼자 남겨진 심벌즈',
  'genre.rock.pin.12500.why': '왜곡이 이미 상단을 채우고 있습니다.',
  'genre.rock.stage.bassPunch':
    '킥은 자체 히트를 유지하고 베이스 기타 아래에서 꼬리가 짧아집니다.',
  'genre.rock.stage.dimension':
    '저음은 160Hz 미만으로 좁아졌습니다. 하드 패닝 기타는 손대지 않았습니다.',
  'genre.rock.stage.maximizer': '백비트에 충분히 빠른 가벼운 천장.',
  'genre.rock.off':
    'Exciter와 Bass Forge가 제공되고 중단됩니다. 디스토션 기타는 자체 하모닉을 만들고 베이스 기타는 실제 바닥을 갖습니다.',
  'genre.popRock.hook': '목소리가 앞선 록밴드',
  'genre.popRock.story':
    '비틀즈 이후 라디오를 위해 작곡된 Rock: 피아노 아래 라이브 키트와 베이스 기타, 가수와 후크가 전면에 있는 어쿠스틱 및 깔끔한 일렉트릭 기타. Fleetwood Mac은 이를 앨범 형식으로 만들었습니다. Coldplay, The Killers, Maroon 5 및 Imagine Dragons가 이를 경기장으로 만들었습니다. 오늘날의 CD는 4~7의 다이내믹 레인지로 팝 CD만큼 완성되었으며 이미 밝습니다.',
  'genre.popRock.pin.32': '808이 아닌 베이스 기타',
  'genre.popRock.pin.32.why': '실제 악기 아래에는 서브를 발명하지 않았습니다.',
  'genre.popRock.pin.80': '킥과 베이스 기타',
  'genre.popRock.pin.80.why': '밴드가 서있는 메모.',
  'genre.popRock.pin.315': 'Rock보다 가벼운 정리',
  'genre.popRock.pin.315.why':
    '피아노와 깨끗한 기타는 왜곡의 벽처럼 진흙으로 변하지 않습니다.',
  'genre.popRock.pin.3150': '목소리와 훅',
  'genre.popRock.pin.3150.why': '노래가 사는 곳, 앞으로 가져 왔습니다.',
  'genre.popRock.stage.bassPunch':
    '킥의 타격을 유지하고 움직이는 베이스 라인 아래에서 꼬리를 짧게 만듭니다.',
  'genre.popRock.stage.dimension':
    '저음은 150Hz 미만으로 좁아졌습니다. 기타는 믹스가 놓인 곳에 그대로 있습니다.',
  'genre.popRock.stage.maximizer': '최고점만 포착하고 16분음표 이내로 갑니다.',
  'genre.popRock.off':
    '이미 밝은 목소리에는 자극이 없고 실제 베이스 기타에는 Bass Forge가 없습니다.',
  'genre.classicRock.hook': '클릭 한 번 없이 숨 쉴 공간이 있는 플레이',
  'genre.classicRock.story':
    '방 안의 밴드, 110~140BPM, 클릭 없음, 테이프로 절단. 60년대 믹스는 세게 패닝했고 70년대 믹스는 좀 더 자연스럽게 패닝했고, 원본 CD는 -18에서 -13 LUFS에 머물렀고 대부분의 리마스터에서는 11에서 14의 다이내믹 레인지를 잃었습니다.',
  'genre.classicRock.pin.32': '테이프에는 서브가 없었어',
  'genre.classicRock.pin.32.why':
    '왼쪽 아래: 이 기록은 그곳에서 만들어진 적이 없습니다.',
  'genre.classicRock.pin.125': '테이프처럼 따뜻한 베이스',
  'genre.classicRock.pin.125.why': '원본의 둥근 저음입니다.',
  'genre.classicRock.pin.3150': '부드러운 상단',
  'genre.classicRock.pin.3150.why': '원본의 소리처럼 편해졌습니다.',
  'genre.classicRock.stage.exciter':
    '약간의 중저음의 따뜻함, 테이프 사운드, 상단에는 아무것도 없습니다.',
  'genre.classicRock.stage.dimension':
    '하드 패닝된 60년대 믹스를 헤드폰에 결합하는 더 좁은 그늘.',
  'genre.classicRock.stage.maximizer': '원본의 역동성을 유지하는 느린 천장.',
  'genre.classicRock.off':
    'Bass Punch 또는 Bass Forge 없음: 녹음된 대로 넉넉한 킥과 테이프처럼 따뜻한 베이스가 유지됩니다.',
  'genre.alternativeRock.hook': '같은 노래 속에서 시끄럽고 조용하게',
  'genre.alternativeRock.story':
    '절과 코러스의 대비는 90~150BPM의 형태로, 하드 패닝된 기타의 오버드라이브 베이스와 퍼즈가 있습니다. 90년대 후반 마스터는 다이내믹 레인지가 4로 지금까지 출시된 것 중 가장 잘린 것 중 하나입니다.',
  'genre.alternativeRock.pin.125': '오버드라이브된 베이스 무게',
  'genre.alternativeRock.pin.125.why': '퍼즈 아래의 몸.',
  'genre.alternativeRock.pin.500': '퍼즈 머드 아웃',
  'genre.alternativeRock.pin.500.why':
    '기타가 서로 떨어져 있도록 지워졌습니다.',
  'genre.alternativeRock.pin.3150': '기타의 엣지',
  'genre.alternativeRock.pin.3150.why': '퍼즈가 잘리는 곳.',
  'genre.alternativeRock.pin.8000': '상단에 그늘이 있음',
  'genre.alternativeRock.pin.8000.why':
    '클리핑된 90년대 마스터의 거친 느낌을 완화합니다.',
  'genre.alternativeRock.stage.bassPunch':
    '킥의 타격이 유지되고 꼬리가 짧아졌습니다.',
  'genre.alternativeRock.stage.dimension':
    '베이스가 좁아지고 기타는 패닝된 위치에 그대로 남아 있습니다.',
  'genre.alternativeRock.stage.maximizer':
    '천장이 거의 움직이지 않아 시끄러운 부분이 조용한 부분보다 더 크게 유지됩니다.',
  'genre.alternativeRock.off':
    'Exciter 및 Bass Forge 없음: 퍼즈가 자체 고조파를 생성합니다.',
  'genre.indieRock.hook': '따뜻하고 어두운 방 안의 라이브 키트',
  'genre.indieRock.story':
    '방에서 100~140BPM으로 라이브로 녹음된 밴드는 종종 테이프를 통해 따뜻하고 고의적으로 어둡게 녹음되었습니다. 방은 기록이다.',
  'genre.indieRock.pin.50': '베이스 과대 광고 없음',
  'genre.indieRock.pin.50.why': '보류: 룸 키트는 자체 무게를 지닙니다.',
  'genre.indieRock.pin.1250': '방 안의 기타와 목소리',
  'genre.indieRock.pin.1250.why': '밴드가 밴드처럼 들리는 곳.',
  'genre.indieRock.pin.8000': '녹음된 대로 따뜻하고 어두움',
  'genre.indieRock.pin.8000.why': '윗부분은 부드러운 상태로 유지됩니다.',
  'genre.indieRock.stage.dimension': '방 자체의 너비, 바닥만 좁아졌습니다.',
  'genre.indieRock.stage.maximizer':
    '16분음표 안에 들어갈 수 있는 가벼운 천장.',
  'genre.indieRock.off':
    'Exciter 없음, Bass Punch 또는 Bass Forge: 드럼 모양을 형성하거나 방을 색칠하는 것은 없습니다.',
  'genre.progressiveRock.hook': '거의 침묵 속에서 만들어진 긴 조각들',
  'genre.progressiveRock.story':
    '이상한 미터와 변화하는 템포, 멜로디 베이스와 Moog 로우가 디테일하게 패닝되고 전대역으로 녹음되었습니다. 레코드의 범위는 10~14입니다.',
  'genre.progressiveRock.pin.125': '무그 앤 베이스 저음',
  'genre.progressiveRock.pin.125.why': '긴 빌드의 기초.',
  'genre.progressiveRock.pin.800': '세부 사항을 볼 수 있는 중앙 공간',
  'genre.progressiveRock.pin.800.why': '레이어가 떨어져 있도록 완화됩니다.',
  'genre.progressiveRock.pin.12500': '풀레인지 하이파이 탑',
  'genre.progressiveRock.pin.12500.why': '이 기록을 만든 공기.',
  'genre.progressiveRock.stage.dimension':
    '베이스 위에 깊이감이 더해진 믹스된 그림입니다.',
  'genre.progressiveRock.stage.maximizer':
    '록 계열에서 가장 긴 미리보기와 릴리스의 전체 비트: 이는 단지 클라이막스에 도달합니다.',
  'genre.progressiveRock.off':
    '여진 장치 없음, Bass Punch 또는 Bass Forge: 빠른 레벨은 조용한 통행을 보장하지 않습니다.',
  'genre.hardRock.hook': '라이브 룸에서 큰 킥',
  'genre.hardRock.story':
    '90~145BPM의 부기 및 셔플, 넓은 공간에서의 강한 킥과 백비트, 기타의 밸브 크런치가 좌우로 패닝됩니다. 클래식 레코드의 다이내믹 레인지는 13입니다. 현대의 소리는 훨씬 더 큽니다.',
  'genre.hardRock.pin.80': '큰 킥',
  'genre.hardRock.pin.80.why': '그 무게는 유지되었습니다.',
  'genre.hardRock.pin.315': '중저음 강화',
  'genre.hardRock.pin.315.why': '장르가 혼합되어 있기 때문입니다.',
  'genre.hardRock.pin.3150': '밸브 크런치',
  'genre.hardRock.pin.3150.why': '기타가 치는 곳.',
  'genre.hardRock.pin.12500': 'Fizz 완화',
  'genre.hardRock.pin.12500.why':
    '오버드라이브 상단은 들어 올려지지 않았습니다.',
  'genre.hardRock.stage.bassPunch':
    '킥의 타격은 유지되었고 꼬리는 조금 짧아졌습니다.',
  'genre.hardRock.stage.dimension':
    '저음이 좁아졌습니다. 기타는 패닝된 상태로 남겨졌습니다.',
  'genre.hardRock.stage.maximizer': '라이브 룸에서 즐길 수 있는 조명 천장.',
  'genre.hardRock.off':
    '익사이터 또는 Bass Forge 없음: 밸브 크런치가 고조파로 충분합니다.',
  'genre.metal.hook': '모든 더블킥은 저절로 이루어집니다.',
  'genre.metal.story':
    'Double-kick은 원하는 모든 히트 곡을 자체적으로 최대 220BPM까지 실행하고, 다운 튜닝된 기타는 로우 엔드를 전달합니다. 가장 시끄러운 장르로 중앙값은 -8.4 LUFS입니다. 히트 읽기를 수행하는 클릭은 4~8kHz에서 작동하며 그 무게는 60~110Hz입니다.',
  'genre.metal.pin.32': '75Hz 미만에서는 부스트가 없습니다.',
  'genre.metal.pin.32.why':
    '기타는 바닥을 소유합니다. 더 많은 것이 킥을 더럽힐 것입니다.',
  'genre.metal.pin.80': '킥의 무게, 왼쪽 레벨',
  'genre.metal.pin.80.why':
    '그것을 들어 올릴 수 있는 밴드는 75Hz 미만의 모든 것을 들어 올릴 것입니다.',
  'genre.metal.pin.315': '튜닝된 기타의 진흙',
  'genre.metal.pin.315.why':
    '모든 장르 중 가장 깊은 컷과 리프가 선명하게 유지되는 이유.',
  'genre.metal.pin.3150': '히트를 읽게 만드는 클릭',
  'genre.metal.pin.3150.why': '더블킥 실행이 별도의 안타처럼 들리는 이유',
  'genre.metal.stage.bassPunch':
    '더 강한 공격보다는 짧은 꼬리로 달리기가 분리됩니다.',
  'genre.metal.stage.dimension':
    '저음은 150Hz 미만으로 좁아졌고 아무것도 넓어지지 않았습니다.',
  'genre.metal.stage.maximizer':
    '거의 운전하지 않습니다. 이것은 가장 시끄러운 장르입니다.',
  'genre.metal.off':
    'Exciter가 제공되고 중단됩니다. 더 많은 고조파가 거품에 도달합니다. 다운 튜닝된 기타에는 Bass Forge가 없습니다.',
  'genre.punk.hook': '건조하고 중간 정도이며 빠름',
  'genre.punk.story':
    '원시 버즈소 기타 아래 150~200BPM(Ramones는 약 170BPM)의 근음 베이스와 묵직한 드라이 드럼. 70년대 원본의 다이나믹 레인지는 12~13이었습니다.',
  'genre.punk.pin.32': '하위 없음',
  'genre.punk.pin.32.why': '펑크는 그곳에서 만들어진 적이 없습니다.',
  'genre.punk.pin.1250': '버즈소 미드',
  'genre.punk.pin.1250.why': '기타가 사는 곳.',
  'genre.punk.pin.5000': '공기가 없고 건조함',
  'genre.punk.pin.5000.why':
    'Take down: 밴드가 연주한 것보다 더 밝은 것은 없습니다.',
  'genre.punk.stage.bassPunch': '킥만 조여졌습니다.',
  'genre.punk.stage.dimension': '저음은 좁아졌고 아무것도 넓어지지 않았습니다.',
  'genre.punk.stage.maximizer': '공격을 유지하는 가벼운 천장.',
  'genre.punk.off': 'Exciter 및 Bass Forge 없음: 원시 사운드입니다.',
  'genre.popPunk.hook': '타이트하고 딸깍거리는 킥과 윤기 나는 기타',
  'genre.popPunk.story':
    '150~185BPM의 빠른 속도, 왼쪽과 오른쪽으로 뚜렷하게 선택된 베이스와 기타가 밝고 공격적입니다. 마스터는 -7 ~ -5 LUFS에서 4 ~ 6의 동적 범위로 압축됩니다.',
  'genre.popPunk.pin.125': '엄선된 베이스 펀치',
  'genre.popPunk.pin.125.why': '전원 코드 아래에 있는 메모입니다.',
  'genre.popPunk.pin.500': '중저음 강화',
  'genre.popPunk.pin.500.why': '기타의 벽을 깨끗하게 유지합니다.',
  'genre.popPunk.pin.3150': '약간의 가장자리만',
  'genre.popPunk.pin.3150.why': '이 마스터들은 이미 똑똑하고 무너졌습니다.',
  'genre.popPunk.stage.bassPunch': '더 단단한 킥, 결코 더 깊은 킥이 아닙니다.',
  'genre.popPunk.stage.dimension':
    '저음은 150Hz 미만으로 좁아졌고 아무것도 넓어지지 않았습니다.',
  'genre.popPunk.stage.maximizer':
    '록 제품군 중 가장 가벼운 천장: 마스터는 이미 시끄럽습니다.',
  'genre.popPunk.off':
    '이렇게 밝고 시끄러운 마스터에는 Exciter나 Bass Forge가 없습니다.',
  'genre.grunge.hook': '슬러시하고 부드러우며 시끄럽고 일부러 어둡습니다.',
  'genre.grunge.story':
    '다운 튜닝되고 디스토션된 기타와 75~140BPM의 크고 넉넉한 킥, 부드러운 구절과 시끄러운 코러스. 두꺼운 중앙과 롤오프된 상단이 사운드입니다. 원본의 다이나믹 레인지는 12, 리마스터의 다이나믹 레인지는 7이었습니다.',
  'genre.grunge.pin.125': '슬러지',
  'genre.grunge.pin.125.why': '무게를 낮추어 유지했습니다.',
  'genre.grunge.pin.2000': '소프트 엣지 기타',
  'genre.grunge.pin.2000.why': '완화되어 왜곡이 긁히지 않고 두껍게 유지됩니다.',
  'genre.grunge.pin.12500': '롤오프된 탑',
  'genre.grunge.pin.12500.why': '더 자세히 설명하면 어두운 것이 기록입니다.',
  'genre.grunge.stage.dimension':
    '넓은 기타와 중앙에 위치한 목소리가 혼합되어 있습니다. 바닥만 좁아졌어요.',
  'genre.grunge.stage.maximizer':
    '부드러운 반은 부드럽고 시끄러운 반은 시끄러운 것을 유지하는 느린 천장.',
  'genre.grunge.off':
    '자극기 없음, Bass Punch 또는 Bass Forge: 아무것도 밝게 하지 않습니다.',
} satisfies Partial<Dictionary>;

export default genreRock;
