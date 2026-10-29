/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const review = {
  'review.sent': '{date}를 보냄',
  'review.reason.flashing': '깜박임 또는 섬광',
  'review.reason.rights': '다른 사람의 일',
  'review.reason.offensive': '공격적',
  'review.reason.broken': '깨지거나 너무 무거워서 놀 수 없음',
  'review.reason.other': '다른 것',
  'review.state.pending': '검토중',
  'review.state.pendingUpdate': '버전 {version} 검토 중',
  'review.state.rejected': '승인되지 않음',
  'review.state.rejectedUpdate': '버전 {version}가 승인되지 않음',
  'review.withdraw': '철수',
  'review.withdrawConfirm': '검토에서 철회하시겠습니까?',
  'review.remove': '제거',
  'review.removeConfirm': '이 목록에서 삭제하시겠습니까?',
  'review.withdrawn': '{name}가 철회되었습니다.',
  'review.notice.approved': '{name}가 갤러리에 있습니다',
  'review.notice.approvedBody':
    '승인되었습니다. 이제 어디서나 무료로 플레이할 수 있으며 누구나 다운로드할 수 있습니다.',
  'review.notice.approvedUpdate':
    '{name}의 {version} 버전이 갤러리에 있습니다.',
  'review.notice.approvedUpdateBody':
    '승인되었습니다. 장면이 있는 모든 사람은 새 버전을 얻습니다.',
  'review.notice.rejected': '{name}가 승인되지 않았습니다.',
  'review.notice.rejectedUpdate':
    '{name}의 {version} 버전이 승인되지 않았습니다.',
  'review.notice.keepsLive':
    '이를 가지고 있는 모든 사람은 {version} 버전을 유지합니다.',
  'review.notice.gotIt': '알았어요',
  'review.notice.openStudio': '스튜디오 열기',
  'review.notice.openMine': '당신의 장면',
} satisfies Partial<Dictionary>;

export default review;
