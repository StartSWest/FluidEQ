/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const bugReport = {
  'bugReport.title': '문제 신고',
  'bugReport.descriptionLabel': '무엇이 잘못되었나요?',
  'bugReport.descriptionPlaceholder':
    '당신은 무엇을 하고 있었고, 그 대신 무슨 일이 일어났나요?',
  'bugReport.reportLabel':
    '이것이 바로 전송될 내용입니다. 읽어보시고 공유하고 싶지 않은 내용은 삭제하세요.',
  'bugReport.logsUnreadable':
    '로그를 읽을 수 없으므로 이 보고서에는 로그가 없습니다. 아직 보낼 가치가 있습니다.',
  'bugReport.privacy':
    '계정 이름, 경로 및 이메일 주소는 자동으로 제거됩니다. 이 중 하나를 누를 때까지 아무 것도 전송되지 않습니다. 문제는 공개적입니다.',
  'bugReport.privacyWithEmail':
    '계정 이름, 경로 및 이메일 주소는 자동으로 제거됩니다. 이 중 하나를 누를 때까지 아무 것도 전송되지 않습니다. 이메일은 개발자에게만 전달됩니다. 문제는 공개적입니다.',
  'bugReport.openIssue': 'GitHub 문제 열기',
  'bugReport.email': '비공개로 이메일을 보내세요.',
  'bugReport.copy': '복사',
  'bugReport.copied': '보고서가 복사되었습니다.',
  'bugReport.issuePaste':
    '보고서가 복사되었습니다. 방금 연 이슈에 붙여넣으세요.',
  'bugReport.emailOpening': '보고서가 복사되었습니다. 이메일 앱을 여는 중…',
  'bugReport.emailOpened':
    '보고서가 복사되어 이메일 앱으로 전달되었습니다. 새 이메일을 확인한 후 보내세요.',
  'bugReport.emailOpenedPartial':
    '보고서가 복사되어 이메일 앱으로 전달되었습니다. 이메일에는 시작 부분만 포함됩니다. 보내기 전에 전체 보고서를 붙여넣으세요.',
  'bugReport.emailNotOpened':
    '보고서가 복사되었지만 이메일 앱을 열 수 없습니다. 이메일에 붙여넣어 다음 주소로 보내세요.',
} satisfies Partial<Dictionary>;

export default bugReport;
