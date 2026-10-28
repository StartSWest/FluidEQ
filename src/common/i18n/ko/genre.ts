/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const genre = {
  'genre.notes.eyebrow': '장르노트',
  'genre.notes.about': '{name} 소개',
  'genre.notes.aboutShort': '소개',
  'genre.notes.full': '전체 메모',
  'genre.notes.close': '닫기',
  'genre.notes.sound': '소리',
  'genre.notes.curve': '왜 이 곡선인가',
  'genre.notes.rack': '랙이 하는 일',
  'genre.notes.on': '켬',
  'genre.notes.leftOff': '중단됨',
  'genre.notes.measured': '{count} 노래에서 측정됨',
  'genre.notes.louder': 'DSP 끄기보다 더 크게',
  'genre.notes.quieter': 'DSP Off보다 조용함',
  'genre.notes.peak': '최고봉, 클립 없음',
  'genre.notes.none': '없음',
  'genre.notes.distortion': '왜곡이 추가됨',
  'genre.notes.byDesign': '설계상',
  'genre.notes.harmonics': '{stage}의 고조파',
  'genre.notes.listen': '들어보세요',
  'genre.notes.research': '연구: {sources}',
  'genre.notes.curveLabel': '{name}의 곡선',
  'genre.notes.pinOpen': '{name}에 대한 전체 참고 사항을 보려면 클릭하세요.',
  'genre.notes.hint': '장르를 가리키며 왜 그렇게 들리는지 알아보세요.',
} satisfies Partial<Dictionary>;

export default genre;
