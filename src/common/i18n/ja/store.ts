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
  'store.credits.owned': '持っているシーン：{count}',
  'store.credits.what':
    '各クレジットでギャラリーのシーンを 1 つずっと持てます。グラフでも、デスクトップでも、ライトでも。',
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
  'store.admin.freeTitle': 'すべての人に無料',
  'store.admin.freeOn':
    'サインインしているすべてのアカウントが、クレジットを使わずに再生できます。',
  'store.admin.freeOff':
    '他のシーンと同じく 1 クレジットです。オンにすると全員に提供します。',
  'store.error.termsOutdated':
    '利用条件が変わりました。クレジットを購入する前に、FluidEQ を更新して新しい版をお読みください。',
};

export default store;
