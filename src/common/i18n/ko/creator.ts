/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const creator = {
  'creator.title': '크리에이터 지급액',
  'creator.badge.active': '활성',
  'creator.badge.checking': '확인 중',
  'creator.invite':
    '갤러리에 장면을 게시하고 회원이 장면을 구매할 때 대금을 받습니다. 각 판매 금액의 {share}%는 Stripe에서 은행으로 전송됩니다.',
  'creator.unfinished':
    'Stripe 가입이 완료되지 않았습니다. 중단한 부분부터 다시 시작하세요.',
  'creator.newTerms':
    '크리에이터 약관이 변경되었습니다. 계속해서 급여를 받으려면 해당 내용을 읽고 동의하세요.',
  'creator.checking':
    'Stripe이 귀하의 세부정보를 확인하고 있습니다. 일반적으로 몇 분 정도 걸리며 때로는 며칠이 걸릴 수도 있습니다.',
  'creator.paidLine': '지금까지의 장면 중 {sales}입니다.',
  'creator.sales.one': '{count} 판매',
  'creator.sales.few': '{count} 판매',
  'creator.sales.many': '{count} 판매',
  'creator.sales.other': '{count} 판매',
  'creator.ready': '결제 준비 완료',
  'creator.held': '보류 중',
  'creator.paid': '현재까지 결제됨',
  'creator.paidHint':
    '환불의 경우 각 판매는 {days}일 동안 유지됩니다. {amount}가 준비되면 {every}일마다 크리에이터에게 수익금이 지급됩니다.',
  'creator.opened':
    'Stripe의 페이지가 브라우저에 열려 있습니다. 거기서 끝내십시오. 이 카드는 당신이 돌아오면 업데이트됩니다.',
  'creator.setUp': '지급 설정',
  'creator.finish': '설정 완료',
  'creator.readTerms': '새로운 약관 읽기',
  'creator.checkAgain': '다시 확인하세요',
  'creator.dashboard': 'Stripe 대시보드',
  'creator.dialog.title': '장면에 대한 대가를 받으세요',
  'creator.dialog.lead':
    'Stripe은 귀하에게 비용을 지불하고 귀하의 신원, 은행 및 세금 정보를 보관합니다. FluidEQ는 이를 결코 볼 수 없습니다.',
  'creator.dialog.step1': '국가를 선택하고 여기에서 약관에 동의하세요.',
  'creator.dialog.step2': '브라우저에서 Stripe 페이지에 가입하세요.',
  'creator.dialog.step3': 'FluidEQ로 돌아오세요. 여기에 수입이 표시됩니다.',
  'creator.dialog.country': '당신이 살고 있는 국가',
  'creator.dialog.search': '국가 검색',
  'creator.dialog.choose': '국가를 선택하세요',
  'creator.dialog.countryHint':
    'Stripe은 미국, 영국, 캐나다, 스위스 및 유럽 경제 지역의 크리에이터에게 비용을 지불할 수 있으며 나중에 변경할 수 없습니다. 목록에 없나요? 회원은 여전히 장면을 구매할 수 있으며, 대신 두 번의 판매마다 크레딧을 받게 됩니다.',
  'creator.dialog.cancel': '취소',
  'creator.dialog.go': '동의하고 계속해서 Stripe을 사용하세요.',
  'creator.dialog.opening': 'Stripe 여는 중…',
  'creator.terms.title': '크리에이터 약관',
  'creator.terms.share':
    '귀하는 Stripe의 수수료를 제외하고 귀하의 장면을 판매할 때마다 가져오는 금액의 {share}%를 얻습니다. FluidEQ는 나머지를 유지합니다.',
  'creator.terms.paidCredits':
    '유료 크레딧으로 구매한 장면만 수익을 얻습니다. 무료 크레딧과 FluidEQ의 자체 장면은 아무것도 얻지 못합니다.',
  'creator.terms.hold':
    '각 수익은 {days}일 동안 유지되므로 환불이나 분쟁으로 인해 취소될 수 있습니다. 지급을 받은 후 취소한 항목은 다음 지급액에서 제외됩니다.',
  'creator.terms.minimum':
    'FluidEQ는 {amount} 이상이 준비되면 {every}일마다 제작자에게 비용을 지불합니다. 그런 다음 Stripe는 귀하의 일정에 따라 은행으로 보냅니다.',
  'creator.terms.stripe':
    'Stripe은 귀하의 신원, 은행 및 세금 세부 정보를 요청하고 자체 조건을 보여줍니다. Stripe이 더 이상 귀하에게 지불할 수 없는 경우 지급이 중단됩니다.',
  'creator.terms.rights':
    '판매하려면 장면에 있는 모든 것이 귀하의 것이어야 합니다. 장면은 계속 검토되며 용어를 위반하는 장면은 게시 중단될 수 있습니다.',
  'creator.terms.taxes':
    '귀하가 벌어들이는 세금은 귀하가 거주하는 곳에서 신고하는 것입니다.',
  'creator.terms.changes':
    '이 약관은 변경될 수 있습니다. 앱에서 메시지가 표시되며 다시 지불받기 전에 새로운 것을 수락하라는 메시지가 표시됩니다.',
  'creator.error.signedOut': '지급액을 관리하려면 다시 로그인하세요.',
  'creator.error.unconfirmed':
    '먼저 이메일 주소를 확인하세요. 코드는 받은편지함에 있습니다.',
  'creator.error.offline':
    'FluidEQ에 연결할 수 없습니다. 연결을 확인하고 다시 시도하세요.',
  'creator.error.unavailable':
    '크리에이터 지급은 아직 공개되지 않았습니다. 나중에 다시 시도하세요.',
  'creator.error.agreementOutdated':
    '크리에이터 약관이 변경되었습니다. 다시 읽어보시고 동의하세요.',
  'creator.error.country':
    'Stripe은 아직 해당 국가의 크리에이터에게 비용을 지불할 수 없습니다.',
  'creator.error.banned': '이 계정은 장면 결제가 불가능합니다.',
  'creator.error.server':
    '우리 측에 문제가 발생했습니다. 아무것도 변경되지 않았습니다. 잠시 후에 다시 시도해 보세요.',
} satisfies Partial<Dictionary>;

export default creator;
