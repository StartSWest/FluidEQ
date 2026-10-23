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
    'Stripe が支払えるのは米国、英国、カナダ、スイス、欧州経済領域のクリエイターで、国は後から変更できません。一覧にない場合でも、メンバーはあなたのシーンを購入でき、販売ごとに代わりにクレジットを受け取れます。',
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
    'シーンに含まれるものはすべて、あなたが販売できる権利を持っている必要があります。シーンは引き続き審査され、Plus 規約に反するものは取り下げられることがあります。',
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
  'creator.admin.tab': '支払い',
  'creator.admin.plan': 'Stripe で支払うクリエイター',
  'creator.admin.loading': 'クリエイターへの未払い額を確認中',
  'creator.admin.creators': 'クリエイター：{count}',
  'creator.admin.available': 'Stripe の利用可能残高',
  'creator.admin.availableNote': '送金の原資',
  'creator.admin.short':
    'Stripe にある FluidEQ の利用可能残高が支払額を下回っています。残高を超える送金は失敗し、次回の支払いでもう一度送られます。',
  'creator.admin.list': '支払い先',
  'creator.admin.none':
    'まだ支払い対象者はいません。Stripe が支払える状態になり、保留期間を過ぎた収益が十分に貯まったクリエイターがここに表示されます。',
  'creator.admin.rules':
    '支払いは毎月1日と16日に自動で行われます。まずクリエイターへ、次にあなたの分をあなたの銀行へ。各支払いは一度だけ送られ、途中で止まった支払いは次回が完了させ、二重には送られません。',
  'creator.admin.lastPaid': '前回の支払い：{date}',
  'creator.admin.neverPaid': 'まだ支払いはありません',
  'creator.admin.nextDue': '次回の自動支払い：{date}',
  'creator.notice.title': '{date} のクリエイター支払い',
  'creator.notice.body':
    '{amount} が自動で送られます。支払い先のクリエイター：{count}。',
  'creator.notice.later': '後で',
  'creator.notice.open': '支払いを開く',
  'creator.notice.shortTitle': '{date} の支払いに Stripe の残高が足りません',
  'creator.notice.shortBody':
    '支払額：{amount}。支払い先のクリエイター：{count}。Stripe の残高は {available} です。超える分の送金は失敗し、次回の支払いを待ちます。',
  'creator.admin.owed': 'クリエイターへの未払い',
  'creator.admin.owedNote': '保留 {held} ・支払い可能 {ready}',
  'creator.admin.sending': '送金中 {amount}',
  'creator.admin.onItsWay': '+ {amount} 入金予定',
  'creator.admin.yours': 'あなたの分',
  'creator.admin.yoursNote':
    '毎回の支払いのあと自動であなたの銀行へ。{reserve} は返金用に残します',
  'creator.admin.lastToYou': '前回の銀行への送金：{amount}、{date}',
  'creator.admin.yoursShort':
    'Stripe の残高よりクリエイターへの未払いが {amount} 多い状態です',
  'creator.admin.next': '次回の支払い',
  'creator.admin.manual':
    'Stripe がまだ残高をすべて自動であなたの銀行へ送っており、クリエイターの分も含まれるため、FluidEQ はあなたの分を保留しています。Stripe の Settings → Payouts でスケジュールを一度 Manual にしてください。以後は FluidEQ が支払いのたびに自動であなたの分だけを送ります。',
  'creator.admin.pendingLine':
    '前回の実行で未完了の支払い：{count}。次回の実行で最初に完了します。',
};

export default creator;
