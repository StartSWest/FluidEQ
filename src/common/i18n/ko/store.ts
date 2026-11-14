/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const store = {
  'store.credit.one': '{count} 크레딧',
  'store.credit.few': '{count} 크레딧',
  'store.credit.many': '{count} 크레딧',
  'store.credit.other': '{count} 크레딧',
  'store.credits.unit.one': '크레딧',
  'store.credits.unit.few': '크레딧',
  'store.credits.unit.many': '크레딧',
  'store.credits.unit.other': '크레딧',
  'store.credits.title': '크레딧',
  'store.credits.buyTitle': '크레딧 받기',
  'store.credits.lead':
    '하나의 크레딧은 하나의 장면을 영원히 유지합니다. 한 번만 지불하면 갱신되지 않습니다.',
  'store.credits.what':
    '각 크레딧은 갤러리의 한 장면(그래프, 데스크탑 및 조명)을 영원히 유지합니다.',
  'store.credits.half':
    '절반의 크레딧이 기다리고 있습니다. 유료 크레딧으로 얻은 다음 장면이 전체를 만듭니다.',
  'store.credits.buy': '크레딧 더 받기',
  'store.credits.getFree': '무료 크레딧 신청',
  'store.error.offline':
    'FluidEQ에 연결할 수 없습니다. 연결을 확인하고 다시 시도하세요.',
  'store.error.signedOut': '크레딧을 사용하려면 다시 로그인하세요.',
  'store.error.unavailable':
    '현장 매장은 아직 오픈하지 않았습니다. 나중에 다시 시도하세요.',
  'store.error.server':
    '우리 측에 문제가 발생했습니다. 아무것도 지출되지 않았습니다. 잠시 후에 다시 시도해 보세요.',
  'store.error.unconfirmed':
    '먼저 이메일 주소를 확인하세요. 코드는 받은편지함에 있습니다.',
  'store.error.notOnSale':
    '그 팩은 지금은 판매되지 않습니다. 다른 것을 선택하세요.',
  'store.error.noCredits': '크레딧이 부족합니다.',
  'store.error.alreadyOwned': '이 장면은 이미 당신의 것입니다.',
  'store.error.gone': '이 장면은 더 이상 갤러리에 없습니다.',
  'store.error.negative':
    '환불로 인해 잔액이 0 미만이 되었습니다. 팩이 다시 가져옵니다.',
  'store.error.banned': '이 계정은 장면을 가져올 수 없습니다.',
  'store.notice.refundedBody':
    '{name} 구매가 환불되어 그로 얻은 수익이 차감되었습니다.',
  'store.notice.refunded': '구매가 환불되었습니다',
  'store.notice.restored': '{name}이(가) 갤러리에 다시 올라왔습니다.',
  'store.notice.blockScene':
    '{count}일 동안 이 장면을 다시 게시할 수 없습니다.',
  'store.notice.blockAccount': '{count}일 동안 게시할 수 없습니다.',
  'store.notice.takenDownBody':
    '{name}이(가) 규칙을 위반하여 갤러리에서 내렸습니다. 구매한 사람들은 크레딧을 돌려받았고, 그 구매로 얻은 수익은 차감되었습니다.',
  'store.notice.takenDown': '{name}이(가) 갤러리에서 내려갔습니다',
  'store.notice.returnedBody': '이 장면에 쓴 크레딧을 돌려드렸습니다.',
  'store.notice.returned': '이 장면은 더 이상 사용할 수 없습니다.',
  'store.pack.each': '{price} 장면',
  'store.pack.best': '최고의 가격',
  'store.buy.title': '{name}를 영원히 유지하시겠습니까?',
  'store.buy.lead':
    '그래프, 데스크탑, 조명, 로그인하는 모든 컴퓨터에서 이것이 당신의 것이 됩니다.',
  'store.buy.keep':
    '제작자가 게시하는 모든 업데이트에는 영원히 귀하의 것이 있습니다.',
  'store.buy.balance': '{credits}가 있습니다. 이후: {after}.',
  'store.buy.final':
    '이 작업은 취소할 수 없습니다. 확인하는 순간 크레딧이 사용됩니다.',
  'store.buy.buying': '그것을 얻는 중…',
  'store.buy.use': '{credits} 사용',
  'store.loading': '크레딧을 읽는 중…',
  'store.packs.title': '크레딧이 필요해요',
  'store.packs.lead':
    '각 크레딧은 한 장면을 영원히 유지합니다. 팩을 구매하고 {name}를 클릭 한 번으로 구매하세요.',
  'store.packs.negative':
    '환불 시 이미 사용한 크레딧이 회수되었으므로 잔액은 {credits}입니다. 팩은 그것을 0 이상으로 되돌립니다.',
  'store.packs.choose': '팩을 선택하세요',
  'store.packs.waiting':
    '브라우저에서 결제를 완료하세요. 결제가 완료되는 즉시 여기에 크레딧이 표시됩니다.',
  'store.packs.fine':
    'Stripe를 통해 안전하게 결제됩니다. 한 번의 지불; 아무것도 갱신되지 않습니다. 크레딧에는 현금 가치가 없습니다. 결제한다는 것은 FluidEQ의 약관에 동의한다는 것을 의미합니다.',
  'store.packs.arrived': '{credits}가 추가되었습니다. 감사합니다!',
  'store.packs.again': '결제 페이지를 다시 열어주세요',
  'store.packs.pay': '{price} 지불',
  'store.packs.none': '현재 판매중인 팩이 없습니다. 나중에 다시 시도하세요.',
  'store.cancel': '취소',
  'store.done': '완료',
  'store.starter.title': '{credits} 무료 시작',
  'store.starter.body': '계정당 한 번, 확인된 이메일 주소에 대해.',
  'store.starter.claim': '{credits} 청구',
  'store.welcome.title.one': '무료 크레딧 {count}개가 있습니다',
  'store.welcome.title.few': '무료 크레딧 {count}개가 있습니다',
  'store.welcome.title.many': '무료 크레딧 {count}개가 있습니다',
  'store.welcome.title.other': '무료 크레딧 {count}개가 있습니다',
  'store.welcome.claimedTitle.one': '크레딧 {count}개를 받았습니다',
  'store.welcome.claimedTitle.few': '크레딧 {count}개를 받았습니다',
  'store.welcome.claimedTitle.many': '크레딧 {count}개를 받았습니다',
  'store.welcome.claimedTitle.other': '크레딧 {count}개를 받았습니다',
  'store.welcome.cardTitle.one': '무료 크레딧 {count}개가 기다리고 있습니다',
  'store.welcome.cardTitle.few': '무료 크레딧 {count}개가 기다리고 있습니다',
  'store.welcome.cardTitle.many': '무료 크레딧 {count}개가 기다리고 있습니다',
  'store.welcome.cardTitle.other': '무료 크레딧 {count}개가 기다리고 있습니다',
  'store.welcome.cardClaimedTitle.one': '사용할 수 있는 크레딧 {count}개',
  'store.welcome.cardClaimedTitle.few': '사용할 수 있는 크레딧 {count}개',
  'store.welcome.cardClaimedTitle.many': '사용할 수 있는 크레딧 {count}개',
  'store.welcome.cardClaimedTitle.other': '사용할 수 있는 크레딧 {count}개',
  'store.welcome.eyebrow': 'FluidEQ에 오신 것을 환영합니다',
  'store.welcome.body':
    '크레딧 1개로 {visualizers} 탭의 장면 하나를 영구히 가질 수 있습니다. 지금 받고 첫 장면을 고르세요.',
  'store.welcome.fine':
    '계정당 한 번. 크레딧을 쓰기 전에 모든 장면을 몇 초 동안 볼 수 있습니다.',
  'store.welcome.later': '나중에',
  'store.welcome.claimedBody':
    '첫 장면을 고르세요. ‘{notMine}’이 켜져 있어 {visualizers} 탭에는 아직 없는 장면만 표시됩니다.',
  'store.welcome.pick': '첫 장면 고르기',
  'store.welcome.cardBody': '받고 나서 간직할 첫 장면을 고르세요.',
  'store.welcome.cardClaimedBody':
    '아직 없는 장면을 보여 줍니다. 몇 초 동안 본 다음 크레딧 1개로 가져가세요.',
  'store.welcome.gotIt': '확인',
  'store.get': '받기 · {credits}',
  'store.scene.tasted':
    '그것은 {seconds}-초의 맛이었습니다. 계속해서 시청해 보세요.',
  'store.scene.locked': '여기에서 귀하의 음악으로 재생되는 것을 확인해보세요.',
  'store.scene.yours': '영원히 당신의 것',
  'store.scene.keep': '영원히 보관하세요',
  'store.scene.fine':
    '당신이 얻는 장면은 당신의 계정에 영원히 당신의 것입니다. 누구도 재판매할 수 없습니다.',
  'store.official.fine':
    'FluidEQ 컬렉션의 일부: 일단 구입하면 영원히 사용할 수 있습니다.',
  'store.like.ownersOnly': '{count}가 좋아합니다. 장면을 좋아하게 만드세요.',
  'store.scene.free': '모두에게 무료',
  'store.error.termsOutdated':
    '약관이 변경되었습니다. 크레딧을 구매하기 전에 새 버전을 읽으려면 FluidEQ를 업데이트하세요.',
} satisfies Partial<Dictionary>;

export default store;
