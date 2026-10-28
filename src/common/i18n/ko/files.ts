/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const files = {
  'files.title.sharePreset': 'EQ 프리셋 공유',
  'files.title.exportDspChain': 'DSP 체인 프리셋 내보내기',
  'files.title.importEq': 'EQ 설정 가져오기',
  'files.title.importImpulse': '임펄스 응답 가져오기',
  'files.title.exportChain': '이 체인 내보내기',
  'files.title.importChain': '체인 가져오기',
  'files.title.exportKaraoke': '노래방 내보내기',
  'files.title.saveDownload': '컴퓨터에 다운로드 저장',
  'files.save': '저장',
  'files.type.eqPreset': 'FluidEQ EQ 프리셋',
  'files.type.dspChain': 'FluidEQ DSP 체인',
  'files.type.eqSettings': 'EQ 설정',
  'files.type.impulse': 'WAV 임펄스 응답',
  'files.type.chain': 'FluidEQ 체인',
  'files.type.scene': 'FluidEQ 장면',
  'files.type.programs': '프로그램',
  'files.type.pictures': '사진',
  'files.type.all': '모든 파일',
  'files.imported.profile': 'FluidEQ 프로필에서 {count} 밴드를 가져왔습니다.',
  'files.imported.graphicEq': 'GraphicEQ 파일에서 {count} 밴드를 가져왔습니다.',
  'files.imported.parametricEq':
    'Equalizer APO ParametricEQ 파일에서 {count} 밴드를 가져왔습니다.',
  'files.imported.skipped':
    '{count} 필터 유형 FluidEQ를 사용하는 밴드는 편집할 수 없으며 건너뛰었습니다.',
  'files.imported.squiglink':
    'Squiglink 내보내기에서 {count} 밴드를 가져왔습니다.',
  'files.imported.squiglinkSkipped':
    '{count} 밴드는 FluidEQ에서 편집할 수 없어 건너뛰었습니다.',
  'files.imported.preampKept':
    '{gain} dB 프리앰프가 유지되었으므로 자동 정규화가 꺼졌습니다.',
  'files.impulse.applied': '{name}를 적용하였습니다.',
  'files.chain.exported': '{device}에 대한 체인을 내보냈습니다.',
  'files.chain.imported': '체인을 수입했습니다.',
  'files.chain.importedFrom': '{device}에서 체인을 가져왔습니다.',
  'files.chain.noOutput': '활성화된 출력이 없으므로 가져올 항목이 없습니다.',
  'files.chain.notChain': '해당 파일은 FluidEQ 체인이 아닙니다.',
  'files.squiglink.empty':
    'Squiglink EQ 내보내기를 가져오기 전에 붙여넣으세요.',
  'files.squiglink.tooLarge': 'EQ 내보내기가 너무 커서 가져올 수 없습니다.',
  'files.squiglink.earsNeedBands':
    '이 내보내기는 양쪽 귀를 동시에 덮는 샘플링된 곡선입니다. 양쪽 귀에 적용하거나 파라메트릭 필터로 내보냅니다.',
  'files.squiglink.tooManyBands':
    '그것은 {max} 밴드보다 더 많은 것을 만들 것입니다. 먼저 일부 밴드를 삭제하거나 양쪽 귀에 적용해 보세요.',
  'files.squiglink.noFilters':
    'Equalizer APO 필터를 찾을 수 없습니다. Squiglink에서 내보낸 ParametricEQ 또는 GraphicEQ 텍스트를 복사합니다.',
  'files.eq.tooLarge': '해당 파일은 너무 커서 EQ 설정을 할 수 없습니다.',
  'files.eq.notProfile': '해당 JSON 파일은 FluidEQ 프로필이 아닙니다.',
  'files.eq.noFilters':
    '해당 파일에서 Equalizer APO 필터를 찾을 수 없습니다. ParametricEQ, GraphicEQ 또는 FluidEQ 프로필이 필요합니다.',
  'files.wav.notWav': '해당 파일은 WAV 임펄스 응답가 아닙니다.',
  'files.wav.truncated': '해당 WAV 파일이 잘립니다.',
  'files.wav.unsupported':
    '해당 WAV 형식은 Equalizer APO에서 지원되지 않습니다.',
  'files.wav.noFormat': '해당 WAV 파일에는 형식 청크가 없습니다.',
  'files.wav.tooLarge': '임펄스 응답가 너무 커서 안전하게 가져올 수 없습니다.',
  'files.wav.rate':
    '임펄스 응답은 {rate}Hz입니다. Equalizer APO에는 {rates}Hz 중 하나가 필요합니다.',
  'files.wav.noChunks':
    '해당 WAV 파일에는 사용 가능한 형식이나 데이터 청크가 없습니다.',
  'files.wav.sampleFormat': '해당 WAV 샘플 형식은 안전하게 분석할 수 없습니다.',
  'files.wav.noSamples':
    '해당 WAV 임펄스 응답에는 샘플이 포함되어 있지 않습니다.',
  'files.wav.badSamples': 'WAV 임펄스 응답에 잘못된 샘플이 포함되어 있습니다.',
  'files.wav.silent': 'WAV 임펄스 응답에는 측정 가능한 응답이 없습니다.',
  'files.apo.notLocated':
    'Equalizer APO가 설치되지 않았거나 해당 설치를 찾을 수 없습니다.',
  'files.apo.selectorMissing': 'Equalizer APO 장치 구성자를 찾을 수 없습니다.',
  'files.apo.editorMissing': 'Equalizer APO 설정을 찾을 수 없습니다.',
  'files.wav.tooLong':
    '임펄스 응답은 안전한 정규화를 분석하기에는 너무 깁니다.',
  'files.title.exportCurves': '내 곡선 내보내기',
  'files.type.curveList': 'FluidEQ 곡선 목록',
  'files.title.exportCurveFolder': '곡선 폴더를 선택하세요',
} satisfies Partial<Dictionary>;

export default files;
