/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const store: Partial<Dictionary> = {
  'store.credit.one': '{count} クレジット',
  'store.credit.few': '{count} クレジット',
  'store.credit.many': '{count} クレジット',
  'store.credit.other': '{count} クレジット',
  'store.credits.unit.one': 'クレジット',
  'store.credits.unit.few': 'クレジット',
  'store.credits.unit.many': 'クレジット',
  'store.credits.unit.other': 'クレジット',
  'store.credits.title': 'クレジット',
  'store.credits.buyTitle': 'クレジットを入手',
  'store.credits.lead':
    '1 クレジットで 1 つのシーンをずっと持てます。支払いは 1 回きりで、更新はありません。',
  'store.credits.what':
    '各クレジットでギャラリーのシーンを 1 つずっと持てます。グラフでも、デスクトップでも、ライトでも。',
  'store.credits.half':
    '0.5 クレジットが待っています。支払い済みのクレジットであなたのシーンがもう 1 つ手に入れられると、1 クレジットになります。',
  'store.credits.buy': 'クレジットを入手',
  'store.credits.getFree': '無料クレジットを受け取る',
  'store.error.offline':
    'FluidEQ に接続できませんでした。接続を確認して、もう一度お試しください。',
  'store.error.signedOut':
    'クレジットを使うには、もう一度サインインしてください。',
  'store.error.unavailable':
    'シーンストアはまだ開いていません。しばらくしてからお試しください。',
  'store.error.server':
    'こちらで問題が起きました。何も消費されていません。少し待ってからもう一度お試しください。',
  'store.error.unconfirmed':
    '先にメールアドレスを確認してください。コードは受信トレイにあります。',
  'store.error.notOnSale':
    'そのパックは現在販売していません。別のパックを選んでください。',
  'store.error.noCredits': 'クレジットがありません。',
  'store.error.alreadyOwned': 'このシーンはすでにあなたのものです。',
  'store.error.gone': 'このシーンはもうギャラリーにありません。',
  'store.error.negative':
    '返金により残高がマイナスになりました。パックで元に戻せます。',
  'store.error.banned': 'このアカウントではシーンを入手できません。',
  'store.notice.refundedBody':
    '{name} の購入が返金されたため、それで得た分は差し引かれました。',
  'store.notice.refunded': '購入が返金されました',
  'store.notice.restored': '{name} がギャラリーに戻りました。',
  'store.notice.blockScene': '{count} 日間はこのシーンを再公開できません。',
  'store.notice.blockAccount': '{count} 日間は公開できません。',
  'store.notice.takenDownBody':
    '{name} は規則に違反しているため、ギャラリーから外しました。購入した人にはクレジットが返却され、それらの購入であなたが得た分は差し引かれました。',
  'store.notice.takenDown': '{name} はギャラリーから外れました',
  'store.notice.returnedBody': 'このシーンのクレジットは返却されました。',
  'store.notice.returned': 'このシーンは利用できなくなりました。',
  'store.pack.each': '1 シーンあたり {price}',
  'store.pack.best': '最安値',
  'store.buy.title': '「{name}」をずっと持ちますか？',
  'store.buy.lead':
    'あなたのものになります。グラフでも、デスクトップでも、ライトでも、サインインするすべてのコンピューターで。',
  'store.buy.keep':
    'ずっとあなたのもの。作者が公開するすべての更新も届きます。',
  'store.buy.balance': '残り {credits}。この後：{after}。',
  'store.buy.final':
    'この操作は取り消せません。確定した時点でクレジットが消費されます。',
  'store.buy.buying': '入手中…',
  'store.buy.use': '{credits}を使う',
  'store.loading': 'クレジットを読み込んでいます…',
  'store.packs.title': 'クレジットが必要です',
  'store.packs.lead':
    '1 クレジットで 1 つのシーンをずっと持てます。パックを入手すれば、「{name}」はワンクリックです。',
  'store.packs.negative':
    '返金により使用済みのクレジットが差し引かれたため、残高は {credits} です。パックで 0 以上に戻せます。',
  'store.packs.choose': 'パックを選択',
  'store.packs.waiting':
    'ブラウザーで支払いを完了してください。支払いが完了すると、ここにクレジットが表示されます。',
  'store.packs.fine':
    'Stripe による安全な支払い。1 回の支払いで、更新はありません。クレジットに現金価値はありません。支払うと FluidEQ の利用条件に同意したことになります。',
  'store.packs.arrived': '{credits}を追加しました。ありがとうございます！',
  'store.packs.again': '支払いページをもう一度開く',
  'store.packs.pay': '{price} を支払う',
  'store.packs.none':
    '現在販売中のパックはありません。しばらくしてからお試しください。',
  'store.cancel': 'キャンセル',
  'store.done': '完了',
  'store.starter.title': 'はじめに {credits}無料',
  'store.starter.body':
    '1 アカウントにつき 1 回、確認済みのメールアドレスが必要です。',
  'store.starter.claim': '{credits}を受け取る',
  'store.welcome.title.one': '無料クレジットが {count} あります',
  'store.welcome.title.few': '無料クレジットが {count} あります',
  'store.welcome.title.many': '無料クレジットが {count} あります',
  'store.welcome.title.other': '無料クレジットが {count} あります',
  'store.welcome.claimedTitle.one': '{count} クレジットがあなたのものに',
  'store.welcome.claimedTitle.few': '{count} クレジットがあなたのものに',
  'store.welcome.claimedTitle.many': '{count} クレジットがあなたのものに',
  'store.welcome.claimedTitle.other': '{count} クレジットがあなたのものに',
  'store.welcome.cardTitle.one': '無料クレジット {count} が待っています',
  'store.welcome.cardTitle.few': '無料クレジット {count} が待っています',
  'store.welcome.cardTitle.many': '無料クレジット {count} が待っています',
  'store.welcome.cardTitle.other': '無料クレジット {count} が待っています',
  'store.welcome.cardClaimedTitle.one': '{count} クレジットを使えます',
  'store.welcome.cardClaimedTitle.few': '{count} クレジットを使えます',
  'store.welcome.cardClaimedTitle.many': '{count} クレジットを使えます',
  'store.welcome.cardClaimedTitle.other': '{count} クレジットを使えます',
  'store.welcome.eyebrow': 'FluidEQ へようこそ',
  'store.welcome.body':
    '1 クレジットで「{visualizers}」のシーンを 1 つ、ずっと自分のものにできます。今すぐ受け取って、最初のシーンを選びましょう。',
  'store.welcome.fine':
    '1 アカウントにつき 1 回。クレジットを使う前に、どのシーンも数秒間見られます。',
  'store.welcome.later': '後で',
  'store.welcome.claimedBody':
    '最初のシーンを選びましょう。「{notMine}」がオンなので、「{visualizers}」にはまだ持っていないシーンだけが表示されます。',
  'store.welcome.pick': '最初のシーンを選ぶ',
  'store.welcome.cardBody':
    '受け取って、ずっと使える最初のシーンを選びましょう。',
  'store.welcome.cardClaimedBody':
    'まだ持っていないシーンを表示しています。数秒間見てから、1 クレジットで手に入れられます。',
  'store.welcome.gotIt': 'OK',
  'store.get': '入手 · {credits}',
  'store.scene.tasted':
    '{seconds} 秒のお試しでした。入手すれば、ずっと見続けられます。',
  'store.scene.locked':
    '入手すると、ここであなたの音楽に合わせて再生できます。',
  'store.scene.yours': 'ずっとあなたのもの',
  'store.scene.keep': 'ずっと持てます',
  'store.scene.fine':
    '入手したシーンは、あなたのアカウントでずっとあなたのものです。誰も転売できません。',
  'store.official.fine':
    'FluidEQ コレクションの一部：入手すればずっとあなたのものです。',
  'store.like.ownersOnly':
    'いいね：{count} 件。シーンを入手すると、いいねできます。',
  'store.scene.free': 'すべての人に無料',
  'store.error.termsOutdated':
    '利用条件が変わりました。クレジットを購入する前に、FluidEQ を更新して新しい版をお読みください。',
};

export default store;
