/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const creator: Partial<Dictionary> = {
  'creator.title': 'クリエイターへの支払い',
  'creator.badge.active': '有効',
  'creator.badge.checking': '確認中',
  'creator.invite':
    'ギャラリーにシーンを公開すると、メンバーが購入したときに報酬を受け取れます。各販売の {share}% を Stripe があなたの銀行口座へ送金します。',
  'creator.unfinished':
    'Stripe での登録が完了していません。途中から続けてください。',
  'creator.newTerms':
    'クリエイター規約が変更されました。引き続き支払いを受けるには、内容を読んで同意してください。',
  'creator.checking':
    'Stripe があなたの情報を確認しています。通常は数分、場合によっては数日かかります。',
  'creator.paidLine': 'これまでの販売：{sales}。',
  'creator.sales.one': '{count} 件',
  'creator.sales.few': '{count} 件',
  'creator.sales.many': '{count} 件',
  'creator.sales.other': '{count} 件',
  'creator.ready': '支払い可能',
  'creator.held': '保留中',
  'creator.paid': '支払い済み',
  'creator.paidHint':
    '各販売は返金に備えて {days} 日間保留されます。クリエイターへの支払いは {every} 日ごとで、{amount} に達すると支払われます。',
  'creator.opened':
    'Stripe のページがブラウザで開いています。そちらで完了してください。戻るとこのカードが更新されます。',
  'creator.setUp': '支払いを設定',
  'creator.finish': '設定を完了',
  'creator.readTerms': '新しい規約を読む',
  'creator.checkAgain': 'もう一度確認',
  'creator.dashboard': 'Stripe ダッシュボード',
  'creator.dialog.title': 'シーンで報酬を受け取る',
  'creator.dialog.lead':
    '支払いは Stripe が行い、本人確認・銀行・税金の情報も Stripe が保管します。FluidEQ がそれを見ることはありません。',
  'creator.dialog.step1': 'ここで国を選び、規約に同意します。',
  'creator.dialog.step2': 'ブラウザで Stripe のページから登録します。',
  'creator.dialog.step3': 'FluidEQ に戻ると、ここに収益が表示されます。',
  'creator.dialog.country': 'お住まいの国',
  'creator.dialog.search': '国を検索',
  'creator.dialog.choose': '国を選択',
  'creator.dialog.countryHint':
    'Stripe が支払えるのは米国、英国、カナダ、スイス、欧州経済領域のクリエイターで、国は後から変更できません。一覧にない場合でも、メンバーはあなたのシーンを購入でき、2 回の販売ごとに代わりに 1 クレジットを受け取れます。',
  'creator.dialog.cancel': 'キャンセル',
  'creator.dialog.go': '同意して Stripe へ進む',
  'creator.dialog.opening': 'Stripe を開いています…',
  'creator.terms.title': 'クリエイター規約',
  'creator.terms.share':
    'Stripe の手数料を差し引いた、あなたのシーンの各販売による収入の {share}% を受け取ります。残りは FluidEQ が受け取ります。',
  'creator.terms.paidCredits':
    '収益になるのは、有料クレジットで購入されたシーンだけです。無料クレジットや FluidEQ 自身のシーンは収益になりません。',
  'creator.terms.hold':
    '各収益は {days} 日間保留され、その間は返金や異議申し立てで取り消されることがあります。支払い後に取り消された分は、次回の支払いから差し引かれます。',
  'creator.terms.minimum':
    'FluidEQ は {every} 日ごとに、{amount} 以上が支払い可能になったクリエイターに支払います。その後 Stripe が、あなたの設定したスケジュールで銀行口座へ送金します。',
  'creator.terms.stripe':
    'Stripe は本人確認・銀行・税金の情報を求め、独自の規約を表示します。Stripe があなたに支払えなくなった場合、支払いは停止します。',
  'creator.terms.rights':
    'シーンに含まれるものはすべて、あなたが販売できる権利を持っている必要があります。シーンは引き続き審査され、規約に反するものは取り下げられることがあります。',
  'creator.terms.taxes':
    '収益にかかる税金は、お住まいの国であなた自身が申告してください。',
  'creator.terms.changes':
    'この規約は変更されることがあります。変更はアプリでお知らせし、次の支払いの前に新しい規約への同意をお願いします。',
  'creator.error.signedOut':
    '支払いを管理するには、もう一度サインインしてください。',
  'creator.error.unconfirmed':
    '先にメールアドレスを確認してください。コードは受信トレイにあります。',
  'creator.error.offline':
    'FluidEQ に接続できませんでした。接続を確認して、もう一度お試しください。',
  'creator.error.unavailable':
    'クリエイターへの支払いはまだ開始されていません。後でもう一度お試しください。',
  'creator.error.agreementOutdated':
    'クリエイター規約が変更されました。もう一度読んで同意してください。',
  'creator.error.country':
    'Stripe はまだその国のクリエイターに支払うことができません。',
  'creator.error.banned': 'このアカウントはシーンの報酬を受け取れません。',
  'creator.error.server':
    'こちら側で問題が発生しました。何も変更されていません。少し待ってからもう一度お試しください。',
};

export default creator;
