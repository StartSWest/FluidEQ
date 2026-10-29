/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const songEq = {
  'songEq.save': '이 노래에 저장',
  'songEq.saveAria': '재생 중인 항목에 대한 Smart EQ 수정 사항을 기억하세요.',
  'songEq.waiting': '재생 중인 항목 없음',
  'songEq.listening': '{remaining} 이동',
  'songEq.willSave': '저장 예정 — {title}',
  'songEq.noticeTitle': '이 노래에 저장된 EQ 사용하기',
  'songEq.noticeBody': '{title} — {plays} 플레이를 통해 학습했습니다.',
  'songEq.noticeBodyOnce': '{title} — 한 번 학습됨',
  'songEq.undo': '실행 취소',
  'songEq.forget': '이 노래는 잊어버려',
  'songEq.badgeAria': 'Smart EQ가 이 노래를 배우고 있습니다',
} satisfies Partial<Dictionary>;

export default songEq;
