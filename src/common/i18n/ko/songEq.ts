/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const songEq = {
  'songEq.saveAria': '재생 중인 항목의 스마트 보정을 기억합니다',
  'songEq.noticeTitle': '이 노래에 저장된 EQ 사용하기',
  'songEq.noticeBody': '{title} — {plays} 플레이를 통해 학습했습니다.',
  'songEq.noticeBodyOnce': '{title} — 한 번 학습됨',
  'songEq.undo': '실행 취소',
  'songEq.forget': '이 노래는 잊어버려',
  'songEq.badgeAria': '스마트 보정이 이 노래를 학습하고 있습니다',
} satisfies Partial<Dictionary>;

export default songEq;
