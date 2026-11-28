/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const subscription = {
  'subscription.name': 'Plus',
  'subscription.get': 'Plus 가입',
  'subscription.getAgain': 'Plus 다시 가입',
  'subscription.manage': 'Plus 관리',
  'subscription.included': 'Plus에 포함',

  'subscription.plan.monthly': '월간',
  'subscription.plan.yearly': '연간',
  'subscription.plan.perMonth': '월 {price}',
  'subscription.plan.perYear': '연 {price}',
  'subscription.plan.both': '월 {monthly} 또는 연 {yearly}',
  'subscription.plan.cancelAnytime': '언제든지 해지할 수 있습니다.',
  'subscription.plan.monthlyEquivalent': '월 {price}에 해당합니다.',
  'subscription.plan.save': '{percent}% 절약',

  'subscription.status.grace':
    'FluidEQ가 서버에서 Plus를 확인하지 못했습니다. {date}까지는 계속 재생됩니다.',
  'subscription.status.waiting':
    'Stripe의 결제 확인을 기다리는 중입니다. Plus는 여기서 자동으로 켜집니다.',

  'subscription.ways.title': 'Plus와 크레딧 중 무엇을?',
  'subscription.ways.credits.each': '한 번에 장면 하나, 각 {credits}',
  'subscription.ways.credits.keep': 'Plus 없이도 영원히 당신의 것',
  'subscription.ways.plus.every': '장면의 모든 장면, 새 장면까지',
  'subscription.ways.plus.while': '회원인 동안',

  'subscription.scene.twoWays': '받는 두 가지 방법',
  'subscription.scene.keep.title': '이 장면 소장하기',
  'subscription.scene.keep.body':
    '모든 업데이트와 함께 영원히 당신의 것. {credits}.',
  'subscription.scene.plus.title': 'Plus로 모든 장면',
  'subscription.scene.plus.body':
    '이 장면과 다른 모든 장면을 회원인 동안. {prices}.',
  'subscription.scene.member.note':
    'Plus가 있는 동안 그래프, 데스크톱, 조명에서 재생됩니다.',
  'subscription.scene.member.keep':
    'Plus가 끝나도 갖고 싶나요? 크레딧으로 소장하면 영원히 당신의 것입니다.',
  'subscription.scene.member.keepButton': '영원히 소장 · {credits}',

  'subscription.lapse.title': 'Plus 멤버십이 종료되었습니다',
  'subscription.lapse.body':
    '이 장면들은 Plus로 재생되었고, 그 다운로드는 이 컴퓨터에서 삭제되었습니다. 크레딧으로 하나를 받아 영원히 갖거나, Plus에 다시 가입해 모든 장면을 사용하세요.',
  'subscription.lapse.more': '외 {count}개',
  'subscription.lapse.find': '찾기',
  'subscription.lapse.notNow': '나중에',

  'subscription.sheet.eyebrow': '장면',
  'subscription.sheet.description':
    '장면의 모든 장면. FluidEQ의 장면과 커뮤니티의 장면 모두.',
  'subscription.sheet.heading': 'Plus가 있는 동안 모든 장면',
  'subscription.sheet.lead':
    '그래프, 데스크톱, 조명에서, 여기와 FluidWallpapers에서, 로그인하는 모든 컴퓨터에서 재생됩니다.',
  'subscription.sheet.choose': '결제 방법',
  'subscription.sheet.renews':
    'Plus는 해지할 때까지 갱신됩니다. Stripe 페이지에서 언제든지 해지할 수 있습니다.',
  'subscription.sheet.ends':
    'Plus가 끝나면 Plus로 재생되던 장면이 멈추고, 그 다운로드는 이 컴퓨터에서 삭제됩니다.',
  'subscription.sheet.pay': '결제로 계속 · {price}',
  'subscription.sheet.again': 'Stripe 페이지 다시 열기',
  'subscription.sheet.waiting':
    '브라우저의 Stripe 페이지에서 마무리하세요. Plus는 여기서 자동으로 켜집니다.',
  'subscription.sheet.fine':
    '계속하면 약관 동의가 기록됩니다. 결제는 Stripe 페이지에서 하며, FluidEQ는 카드 정보를 보지 않습니다.',
  'subscription.sheet.notNow': '나중에',
  'subscription.sheet.done.title': 'Plus가 켜졌습니다',
  'subscription.sheet.done.body': '이제 장면의 모든 장면을 사용할 수 있습니다.',
  'subscription.sheet.done.see': '장면 보기',

  'subscription.error.termsChanged':
    '약관이 업데이트되었습니다. 읽은 다음 계속하세요.',
  'subscription.error.needsEmail':
    '먼저 이메일 주소를 확인한 뒤 다시 시도하세요.',
  'subscription.error.needsUpdate':
    'Plus에 가입하려면 FluidEQ를 업데이트하세요.',
  'subscription.error.alreadySubscribed':
    '이 계정은 이미 Plus에 가입되어 있습니다.',
  'subscription.error.notOnSale': '지금은 Plus를 판매하지 않습니다.',
  'subscription.error.banned': '이 계정은 지금 Plus에 가입할 수 없습니다.',
  'subscription.error.signedOut': 'Plus에 가입하려면 다시 로그인하세요.',
  'subscription.error.failed':
    'Stripe 페이지를 열 수 없습니다. 연결을 확인하고 다시 시도하세요.',

  'subscription.manage.opened': 'Stripe 페이지가 브라우저에서 열렸습니다.',
  'subscription.manage.none': '이 계정에는 관리할 Plus 멤버십이 없습니다.',
  'subscription.manage.signedOut': 'Plus를 관리하려면 다시 로그인하세요.',
  'subscription.manage.failed':
    'Stripe 페이지를 열 수 없습니다. 연결을 확인하고 다시 시도하세요.',

  'subscription.cardGet': '받기',
  'subscription.makeScenes': 'FluidWallpapers에서 나만의 장면 만들기',
  'subscription.banner.title': 'Plus: 갤러리의 모든 장면',
  'subscription.banner.body':
    '새 장면까지 모두 재생하고 추가하세요. FluidEQ와 FluidWallpapers에서 하나의 구독입니다.',
  'subscription.banner.credit':
    'Plus 없이도 장면을 원하나요? 크레딧으로 받으면 영원히 당신의 것입니다.',
  'subscription.banner.or': '또는 {price}',
  'subscription.line.renews':
    '모든 장면을 재생할 수 있습니다 · {date}에 갱신 · FluidWallpapers에서도 사용',
  'subscription.line.ends':
    '{date}까지 모든 장면을 재생할 수 있습니다 · FluidWallpapers에서도 사용',
  'subscription.line.plain':
    '모든 장면을 재생할 수 있습니다 · FluidWallpapers에서도 사용',
  'subscription.sheet.both':
    'FluidEQ와 FluidWallpapers에서 하나의 구독입니다. 어느 앱에서 가입해도 두 앱 모두에 적용됩니다.',
  'subscription.sheet.keepOne': '또는 Plus 없이도 {name}만 영원히 소장하기:',

  'subscription.account.yours': '갤러리의 모든 장면을 재생할 수 있습니다',
  'subscription.account.renews': '{date}에 갱신 · FluidWallpapers에서도 사용',
  'subscription.account.ends': '{date}에 종료 · FluidWallpapers에서도 사용',
  'subscription.welcome.title': '또는 Plus로 모든 장면',
  'subscription.welcome.body':
    '회원인 동안 새 장면까지 갤러리의 모든 장면. FluidEQ와 FluidWallpapers에서 하나의 구독입니다.',
  'subscription.welcome.signIn': '로그인하고 Plus 가입',
  'subscription.dev.notOnSale':
    '개발: 이 계정에는 Plus를 판매하지 않습니다. Stripe가 테스트 모드인 동안에는 관리자와 서버의 테스터 목록에 있는 계정만 가격을 받습니다. 이 계정을 그 목록에 추가하세요.',
  'subscription.renew': 'Plus 갱신',
  'subscription.pass.member': '회원',
  'subscription.pass.ending': '해지됨 · 그날까지는 계속 사용',
  'subscription.chip.until': 'Plus {date}까지',
} satisfies Partial<Dictionary>;

export default subscription;
