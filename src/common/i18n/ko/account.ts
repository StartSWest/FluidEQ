/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const account = {
  'account.validation.passwordRequired': '비밀번호를 입력하세요.',
  'account.validation.passwordShort': '최소한 {count} 문자를 사용하세요.',
  'account.validation.passwordLong': '128자 이하를 사용하세요.',
  'account.validation.nameLong': '80자 이하를 사용하세요.',
  'account.validation.code': '6자리 코드를 입력하세요.',
  'account.menu': '계정',
  'account.eyebrow': 'FluidEQ',
  'account.title': '계정',
  'account.checking': '계정을 확인하는 중…',
  'account.close': '닫기',
  'account.optional':
    '로그인은 선택 사항입니다. FluidEQ는 계정 없이 항상 그랬던 것처럼 정확하게 작동합니다. 모든 것이 이 시스템에서 실행되며 아무것도 추적되지 않습니다. 계정은 정말로 필요한 부분에 대해서만 존재합니다.',
  'account.signIn': '로그인',
  'account.signUp': '계정 만들기',
  'account.signInHint':
    '귀하의 비밀번호는 계정 서비스로 바로 전달되며 앱 어디에도 보관되지 않습니다.',
  'account.signUpHint':
    '6자리 코드가 해당 주소로 이동합니다. 완료하려면 여기에 입력하세요.',
  'account.working': '잠시만…',
  'account.signOut': '로그아웃',
  'account.signOut.confirm': '이 계정에서 로그아웃하시겠습니까?',
  'account.signOut.detail': '언제든지 다시 로그인할 수 있습니다.',
  'account.signOut.detailPlus':
    '다시 로그인할 때까지 장면은 여기에 잠겨 있습니다.',
  'account.signOut.kept': '이 컴퓨터의 어떤 항목도 삭제되지 않습니다.',
  'account.cover.onGraph': '그래프의 {name}',
  'account.stats.owned': '소유',
  'account.stats.likes': '좋아요',
  'account.scenes.title': '당신의 컬렉션',
  'account.scenes.openGallery': '갤러리 열기',
  'account.scenes.empty':
    '얻은 장면은 그대로 유지되며 여기에서 그래프로 재생됩니다.',
  'account.scenes.playing': '재생',
  'account.scenes.play': '그래프에서 {name}를 플레이하세요',
  'account.published.title': '게시됨',
  'account.published.live': '갤러리에서',
  'account.name.change': '이름 변경',
  'account.name.changeTitle': '당신이 나타나는 방식을 변경',
  'account.name.changeBody':
    '귀하가 게시한 장면에 대한 귀하의 이름과 이름입니다. 그들은 한 번에 모든 곳에서 변합니다. 귀하의 이메일은 비공개로 유지됩니다.',
  'account.name.cancel': '취소',
  'account.backToSignIn': '로그인으로 돌아가기',
  'account.field.email': '이메일',
  'account.field.emailHint':
    '아무에게도 표시되지 않음 - 로그인 및 코드에만 표시됨',
  'account.field.password': '비밀번호',
  'account.field.passwordHint': '{count}자 이상',
  'account.field.name': '이름',
  'account.field.optional': '선택사항',
  'account.field.code': '이메일의 코드',
  'account.code.sent': '{email}로 6자리 코드를 보냈습니다.',
  'account.code.confirm': '확인',
  'account.code.sendAgain': '코드를 다시 보내세요',
  'account.code.sentAgain': '다시 보냈습니다',
  'account.code.otherEmail': '다른 이메일을 사용하세요',
  'account.code.hint':
    '아무것도 도착하지 않았나요? 스팸 폴더를 확인하세요. 이미 이 주소로 계정이 있는 경우에는 코드가 전송되지 않습니다. 대신 로그인하세요.',
  'account.forgot.link': '비밀번호를 잊으셨나요?',
  'account.forgot.lead': '가입한 주소를 입력하면 코드가 입력됩니다.',
  'account.forgot.submit': '재설정 코드 보내기',
  'account.reset.sent':
    '{email}로 6자리 코드를 보냈습니다. 여기에 새 비밀번호를 입력하세요.',
  'account.reset.submit': '새 비밀번호 설정',
  'account.unavailable': '이 시스템에서는 로그인할 수 없습니다',
  'account.unavailableHint':
    '이 컴퓨터에는 로그인을 보관할 안전한 장소가 없으므로 FluidEQ는 로그인을 저장하지 않습니다. 다른 모든 것은 정상적으로 작동합니다.',
  'account.error.network':
    '계정 서비스에 연결할 수 없습니다. 연결을 확인하고 다시 시도하세요.',
  'account.error.rejected':
    '계정 서비스에서 이를 거부했습니다. 잠시 후에 다시 시도해 보세요.',
  'account.error.expired':
    '해당 로그인은 더 이상 유효하지 않습니다. 다시 로그인해 주세요.',
  'account.error.signedOutElsewhere':
    '귀하의 계정이 다른 컴퓨터에 로그인되어 있기 때문에 이 컴퓨터에서 로그아웃되었습니다. 계정은 한 번에 최대 5대의 컴퓨터에 로그인된 상태로 유지됩니다. 여기에서 사용하려면 다시 로그인하세요. 최근에 가장 적게 사용한 컴퓨터가 대신 로그아웃됩니다.',
  'account.error.malformed':
    '계정 서비스에서 FluidEQ가 읽을 수 없는 내용을 보냈습니다.',
  'account.error.wrongCredentials': '이메일이나 비밀번호가 잘못되었습니다.',
  'account.error.unconfirmed':
    '해당 계정은 아직 확인되지 않았습니다. 완료하려면 이메일에 있는 코드를 입력하세요.',
  'account.error.weakPassword':
    '그 비밀번호는 추측하기 너무 쉽습니다. 이전에 사용했던 것이 아닌 더 긴 것을 사용해 보십시오.',
  'account.error.badCode':
    '코드가 잘못되었거나 만료되었습니다. 새로운 것을 요청하십시오.',
  'account.error.rateLimited':
    '짧은 시간에 너무 많은 시도를 했습니다. 잠시 기다렸다가 다시 시도해 보세요.',
  'account.error.invalidEmail': '이메일 주소가 아닌 것 같습니다.',
  'account.error.alreadyRegistered':
    '해당 주소를 사용하는 계정이 이미 있습니다. 대신 로그인하세요.',
  'account.plus.eyebrow': 'FluidEQ',
  'account.perk.looks': '영원히 당신의 것인 장면은 각각 1크레딧입니다.',
  'account.perk.visualizers':
    '비주얼라이저: 회원이 만드는 장면은 모든 계정에 공개됩니다.',
  'account.google': 'Google로 계속하기',
  'account.or': '또는',
  'account.google.waiting': '브라우저에서 Google로 로그인을 완료하세요.',
  'account.google.cancel': '취소',
  'account.error.googleUnfinished':
    'Google로 로그인이 완료되지 않았습니다. 다시 시도하거나 이메일을 사용하세요.',
  'account.google.doneTitle': '로그인되었습니다',
  'account.google.doneBody': '이 탭을 닫고 FluidEQ로 돌아갈 수 있습니다.',
  'account.google.failedTitle': '로그인이 완료되지 않았습니다.',
  'account.google.failedBody':
    'FluidEQ로 돌아가서 다시 시도하거나 이메일로 로그인하세요.',
} satisfies Partial<Dictionary>;

export default account;
