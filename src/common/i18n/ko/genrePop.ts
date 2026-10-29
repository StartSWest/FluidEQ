/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genrePop = {
  'genre.pop.hook': '가장 완성된 기록은 다음과 같다',
  'genre.pop.story':
    '팝은 100에서 130 BPM, 즉 하프타임 약 90, 808 또는 신스 베이스에서 실행되며 보컬은 밝거나 거칠지 않습니다. 마스터는 풀 스케일에 대한 피크가 있는 약 -8 LUFS로 제한되어 도착하므로 재생 단계에서 추가할 수 있는 모든 것이 이미 마스터에 포함되어 있습니다. 프리셋은 마스터가 가질 수 없는 것만 추가합니다.',
  'genre.pop.pin.50': '서브와 킥팝이 기본으로 만들어졌습니다.',
  'genre.pop.pin.50.why':
    '듣는 것보다 느끼는 것: 작은 스피커의 무게가 먼저 줄어듭니다.',
  'genre.pop.pin.315': '목소리를 숨기는 박시함',
  'genre.pop.pin.315.why': '리드 보컬이 믹스에서 눈에 띄지 않도록 제거합니다.',
  'genre.pop.pin.5000': '존재감과 광택',
  'genre.pop.pin.5000.why':
    '보컬의 광택은 거칠지 않은 수준으로 유지되었습니다.',
  'genre.pop.stage.exciter':
    '1kHz 부근의 바디, 보컬의 윤기, 둘 다 아래의 따뜻함.',
  'genre.pop.stage.bassPunch':
    '타격보다는 조임: 베이스 라인 아래의 킥 테일이 짧아지고 어택이 방금 들어 올려졌습니다.',
  'genre.pop.stage.dimension':
    '140Hz 이하의 베이스는 모노로 팝 마스터가 만들어지며, 음반보다 공기가 조금 더 넓어집니다.',
  'genre.pop.stage.maximizer':
    '거의 구동되지 않는 가벼운 천장: 마스터는 이미 제한되어 있습니다.',
  'genre.pop.off':
    'Bass Forge는 Pop의 이름으로 제공되고 중단되었습니다. 서브가 마스터에 있습니다.',
  'genre.indiePop.hook': '차트보다 가볍고 따뜻해요',
  'genre.indiePop.story':
    '90~130BPM의 중심 목소리를 중심으로 장글링 기타와 쌓인 하모니는 종종 일부러 테이프나 카세트로 잘라냅니다. 차트 팝보다 더 부드럽고 약 데시벨 더 조용하며 서브가 적습니다. 따뜻함이 외관입니다.',
  'genre.indiePop.pin.50': '베이스 과대 광고 없음',
  'genre.indiePop.pin.50.why':
    '왼쪽 플랫: 인디 팝은 서브를 기반으로 만들어진 적이 없습니다.',
  'genre.indiePop.pin.315': '믹스에서 나온 판지',
  'genre.indiePop.pin.315.why': '박스형 중저음이 홈 녹음으로 쌓입니다.',
  'genre.indiePop.pin.1250': '쟁글과 하모니',
  'genre.indiePop.pin.1250.why': '기타가 울리고 백킹 보이스가 쌓이는 곳.',
  'genre.indiePop.pin.12500': '약간의 공기',
  'genre.indiePop.pin.12500.why': '처음부터 부드러웠던 위에 부드럽게.',
  'genre.indiePop.stage.exciter': '따뜻함, 중저음: 결코 더 밝지 않습니다.',
  'genre.indiePop.stage.dimension':
    '바닥은 좁아지고 공기는 좀 더 넓어졌습니다. 목소리를 움직이지 않고 하모니가 열립니다.',
  'genre.indiePop.stage.maximizer': '부드러움을 유지하는 가벼운 천장.',
  'genre.indiePop.off':
    '무대를 밝게 하거나 저음을 추가하는 무대는 없습니다. lo-fi 따뜻함이 핵심입니다.',
  'genre.synthPop.hook': '드럼 머신, 시퀀스 베이스 및 코러스 패드',
  'genre.synthPop.story':
    'Linn 및 808 드럼 머신, 시퀀스된 베이스 라인 및 넓은 코러스 패드, 100~135BPM. 초기 음반은 얇고 밝습니다. 80년대의 대가들은 현대의 대가들이 갖지 않는 역동성(12~13의 동적 범위)을 유지했습니다.',
  'genre.synthPop.pin.125': '초기 기록이 부족했던 신체',
  'genre.synthPop.pin.125.why':
    '중간 정도의 따뜻함, 이 믹스는 한 방향을 환영합니다.',
  'genre.synthPop.pin.500': '패드를 위한 공간',
  'genre.synthPop.pin.500.why':
    '코러스 패드와 드럼 머신이 쌓이는 중앙을 클리어합니다.',
  'genre.synthPop.pin.12500': '윗부분은 들리지 않고 편해졌습니다.',
  'genre.synthPop.pin.12500.why': '초기 신스팝은 이미 밝아졌다.',
  'genre.synthPop.stage.exciter':
    '따뜻함만, 중저음: 밝은 상단에는 고조파가 없습니다.',
  'genre.synthPop.stage.dimension':
    '베이스는 좁아지고 패드는 조금 넓어지는 등 장르를 믹스한 방식이다.',
  'genre.synthPop.stage.maximizer': '80년대의 역동성을 그대로 담은 느린 천장.',
  'genre.synthPop.off':
    'Bass Punch 및 Bass Forge 없음: 드럼 머신의 킥은 프로그래밍된 것과 정확하게 일치합니다.',
  'genre.newWave.hook': '찰칵하고 고르지 못한 기타와 날씬한 바닥',
  'genre.newWave.story':
    '110~160BPM의 빠른 템포와 저키: 타이트한 킥, 멜로디 베이스, 날씬한 바닥 위의 밝고 고르지 못한 기타. 원본은 공간(다이내믹 레인지 14)으로 마스터링되었습니다. 재발행은 대부분을 잃었습니다.',
  'genre.newWave.pin.125': '얇은 원본에 대한 약간의 따뜻함',
  'genre.newWave.pin.125.why': '베이스 라인을 운반하기에 충분한 바디입니다.',
  'genre.newWave.pin.315': '진흙이 빠져서 베이스가 움직인다',
  'genre.newWave.pin.315.why': '멜로디 베이스에는 명확한 레인이 필요합니다.',
  'genre.newWave.pin.1250': '고르지 못한 기타',
  'genre.newWave.pin.1250.why': '리듬기타의 바이트가 살아있는 곳.',
  'genre.newWave.stage.exciter':
    '얇은 원본이 환영하는 작은 몸체와 약간의 공기.',
  'genre.newWave.stage.dimension':
    '기록에 가깝게 유지됩니다. 아래쪽은 좁아지고 위쪽은 더 넓어집니다.',
  'genre.newWave.stage.maximizer': '잡기만 하는 천장:스냅이 장르입니다.',
  'genre.newWave.off':
    'Bass Punch 또는 Bass Forge 없음: 마른 바닥이 만들어진 방식입니다.',
  'genre.kPop.hook': '가장 시끄럽고 가장 세련된 음반 중',
  'genre.kPop.story':
    '115~130BPM의 걸그룹 댄스 트랙과 80~100에 가까운 보이그룹 노래, 서브 펀치를 위한 킥과 이미 3~5kHz 및 12kHz의 보컬이 들어있습니다. 마스터는 전체 규모에 걸쳐 피크가 있는 -10 ~ -6 LUFS에 있습니다.',
  'genre.kPop.pin.80': '서브가 아닌 킥의 펀치',
  'genre.kPop.pin.80.why':
    '킥이 착지되는 곳; 50Hz 미만에서는 아무것도 들리지 않습니다.',
  'genre.kPop.pin.315': '촘촘하게 배열된 공간',
  'genre.kPop.pin.315.why': '레이어가 흐릿해지지 않도록 중저음이 지워졌습니다.',
  'genre.kPop.pin.12500': '추가 공기 없음',
  'genre.kPop.pin.12500.why': '보컬은 이미 12kHz에서 자체적으로 전달됩니다.',
  'genre.kPop.stage.exciter':
    '보컬 자체의 리프트 아래에 바디와 존재감이 있고 그 위에는 아무 것도 없습니다.',
  'genre.kPop.stage.dimension':
    '베이스는 좁아졌고, 더블과 패드는 믹스된 것보다 조금 더 넓어졌습니다.',
  'genre.kPop.stage.maximizer':
    '간신히 움직이는 천장: 이 마스터는 마스터만큼 시끄럽습니다.',
  'genre.kPop.off':
    'Bass Punch 또는 Bass Forge 없음: 킥의 펀치와 서브가 이미 기록에 있습니다.',
  'genre.jPop.hook': '어떤 템포에서도 조밀하고 밝은 벽',
  'genre.jPop.story':
    '90BPM 미만의 발라드와 150~200 이상의 밴드, 아이돌, 애니메이션 노래, 촘촘하고 넓은 벽에 분주한 베이스와 디스토션 기타가 어우러져 있습니다. 마스터는 최대 +2.3dBTP의 피크로 클리핑된 상태로 도착합니다.',
  'genre.jPop.pin.125': '중저음의 따뜻함',
  'genre.jPop.pin.125.why': '이 믹스는 한 방향으로만 잘 진행됩니다.',
  'genre.jPop.pin.500': '통기성이 좋은 벽',
  'genre.jPop.pin.500.why': '붐비는 중앙에서 조금 벗어났습니다.',
  'genre.jPop.pin.3150': '중음역만 남음',
  'genre.jPop.pin.3150.why':
    '이미 밝고 앞으로 나아갑니다. 절대 밀지 않았습니다.',
  'genre.jPop.stage.exciter':
    '따뜻함, 중저음: 이렇게 밝은 상단에는 아무것도 없습니다.',
  'genre.jPop.stage.dimension': '넓어진 것은 없습니다. 벽이 충분히 넓습니다.',
  'genre.jPop.stage.maximizer':
    '이미 잘린 마스터에서는 거의 작동하지 않는 천장입니다.',
  'genre.jPop.off':
    'Bass Punch 또는 Bass Forge 없음: 벽이 촘촘하고 시끄럽게 도착합니다.',
  'genre.cPop.hook': '발라드, 목소리의 선두이자 중심',
  'genre.cPop.story':
    '60~90 BPM의 발라드와 95~120 정도의 팝, 따뜻하고 부드러운 보컬 아래의 피아노와 현악기. 만다린의 날카로운 자음은 설렘보다는 디에싱을 원한다.',
  'genre.cPop.pin.125': '따뜻한 발라드 몸매',
  'genre.cPop.pin.125.why': '클래식 만도팝 사운드의 콘솔 따뜻함.',
  'genre.cPop.pin.1250': '콧물이 아닌 부드러운',
  'genre.cPop.pin.1250.why': '완화되어 목소리가 부드럽게 유지됩니다.',
  'genre.cPop.pin.12500': '온화한 공기',
  'genre.cPop.pin.12500.why':
    '자음 위가 아닌 자음 위에 약간의 리프트가 있습니다.',
  'genre.cPop.stage.exciter': '따뜻함만: 치찰음에 고조파가 없습니다.',
  'genre.cPop.stage.dimension':
    '중음이 더 좁아져서 목소리가 중간을 잡고 현악기와 리버브가 조금 더 넓어집니다.',
  'genre.cPop.stage.maximizer': '발라드의 역동성을 위한 느린 천장.',
  'genre.cPop.off':
    'Bass Punch 또는 Bass Forge 없음: 피아노 발라드 아래에 발명된 서브가 없습니다.',
  'genre.ballad.hook': '느린 노래, 모든 것 위의 목소리',
  'genre.ballad.story':
    '모든 카탈로그, 팝, 록, 소울 및 라틴의 느린 노래(주로 60~85BPM): "Someone Like You"는 67.5로 이동하고 "November Rain"은 84로 이동합니다. 리드 보컬은 먼저 믹싱되어 긴 플레이트나 홀, 피아노, 현악기 또는 억제된 밴드 위에 모든 것 위에 위치하며 마스터는 같은 앨범의 싱글보다 더 많은 다이내믹을 유지합니다.',
  'genre.ballad.pin.125': '목소리와 피아노의 따뜻함',
  'genre.ballad.pin.125.why': '발라드의 목소리와 피아노가 따뜻한 작은 몸.',
  'genre.ballad.pin.500': '진흙이 완화됨',
  'genre.ballad.pin.500.why':
    '저음역대의 피아노와 가까운 보컬이 쌓이고, 내려가서 단어가 또렷하게 유지됩니다.',
  'genre.ballad.pin.3150': '존재',
  'genre.ballad.pin.3150.why':
    '목소리가 조금 앞으로 나와 그 말이 이해되는 곳입니다.',
  'genre.ballad.pin.8000': '치찰음이 밝아지지 않고 완화되었습니다.',
  'genre.ballad.pin.8000.why':
    '다정한 목소리는 그 본질을 여기에 전달하고, 리프트는 모든 사람을 날카롭게 할 것입니다.',
  'genre.ballad.stage.dimension':
    '베이스는 발라드가 섞인 중간으로 갈수록 좁아졌습니다. 목소리, 피아노, 현악기는 배치된 만큼 넓게 남았습니다.',
  'genre.ballad.stage.maximizer':
    '전체 비트를 통과시키는 가볍고 느린 천장으로 인해 조용한 구절은 조용하게 유지되고 마지막 코러스는 여전히 고조됩니다.',
  'genre.ballad.off':
    'Exciter 없음, Bass Forge 또는 Bass Punch: 고조파는 치찰음에 도달하고 발라드는 프로듀서가 서브를 넣은 곳에만 서브가 있으며 킥을 형성하는 경우가 거의 없습니다.',
} satisfies Partial<Dictionary>;

export default genrePop;
