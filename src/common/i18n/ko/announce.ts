/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const announce = {
  'announce.news.title': '앱 소식',
  'announce.news.description':
    'FluidEQ 공지 사항을 언제든지 여기에서 다시 읽을 수 있습니다.',
  'announce.news.read': '소식 읽기',
  'announce.news.offline':
    '오프라인입니다. 저장된 소식 중 아직 유효한 내용을 표시합니다.',
  'announce.news.empty': '현재 공지 사항이 없습니다.',

  'announce.eyebrow': '비주얼라이저 새 소식 · 장면 {count}개',
  'announce.try': '지금 사용해 보기',
  'announce.later': '나중에',
  'announce.previewNote':
    '미리보기. 아무 것도 전송되지 않았고 아무 것도 기록되지 않았습니다.',
} satisfies Partial<Dictionary>;

export default announce;
