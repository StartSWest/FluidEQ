/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const subscription: Partial<Dictionary> = {
  'subscription.name': 'Plus',
  'subscription.get': 'Plus に登録',
  'subscription.getAgain': 'Plus に再登録',
  'subscription.manage': 'Plus を管理',
  'subscription.included': 'Plus に含まれます',

  'subscription.rail.blurb': 'メンバーの間はすべてのシーン',
  'subscription.rail.get': '登録',
  'subscription.rail.member': 'メンバー',

  'subscription.plan.monthly': '月額',
  'subscription.plan.yearly': '年額',
  'subscription.plan.perMonth': '月 {price}',
  'subscription.plan.perYear': '年 {price}',
  'subscription.plan.both': '月 {monthly} または年 {yearly}',
  'subscription.plan.cancelAnytime': 'いつでも解約できます。',
  'subscription.plan.monthlyEquivalent': '月あたり {price} です。',
  'subscription.plan.save': '{percent}% お得',

  'subscription.page.lead':
    'シーンのすべてのシーンを、ここでも FluidWallpapers でも使えます。',
  'subscription.page.new': 'Plus の新着',

  'subscription.status.member': 'メンバー',
  'subscription.status.renews': '{plan} · {date} に更新',
  'subscription.status.ends': '{plan} · {date} に終了',
  'subscription.status.renewsNote':
    'プランやカードの変更、解約は Stripe のページで行えます。',
  'subscription.status.endsNote':
    'その日に Plus で再生しているシーンは止まります。クレジットで入手したシーンはそのままあなたのものです。Plus を続けるには「Plus を管理」から更新してください。',
  'subscription.status.grace':
    'FluidEQ はサーバーで Plus を確認できませんでした。{date} までは引き続き使えます。',
  'subscription.status.waiting':
    'Stripe による支払いの確認を待っています。Plus はここで自動的に有効になります。',
  'subscription.status.ended.title': 'Plus メンバーシップが終了しました',
  'subscription.status.ended.body':
    'Plus で再生していたシーンは止まり、そのダウンロードはこのコンピューターから削除されました。クレジットで入手したシーンはそのままあなたのものです。',

  'subscription.ways.title': 'Plus とクレジット、どちら?',
  'subscription.ways.credits.have': 'クレジット · {credits} 保有',
  'subscription.ways.credits.body':
    'シーンを 1 つ入手して、Plus が終わってもずっと持てます。',
  'subscription.ways.credits.each': '1 回に 1 シーン、各 {credits}',
  'subscription.ways.credits.keep': 'Plus がなくてもずっとあなたのもの',
  'subscription.ways.plus.body':
    'メンバーの間はすべてのシーン。クレジットなしで自由に追加できます。',
  'subscription.ways.plus.every': 'シーンのすべてのシーン、新作も',
  'subscription.ways.plus.while': 'メンバーの間',

  'subscription.choice.credits.title': 'クレジット: 1 シーン',
  'subscription.choice.credits.body': 'ずっとあなたのもの。各 {credits}。',
  'subscription.choice.or': 'または',
  'subscription.choice.plus.title': 'Plus: すべてのシーン',
  'subscription.choice.plus.body': 'メンバーの間。{price}。',
  'subscription.choice.hide': '非表示',

  'subscription.scene.twoWays': '手に入れる 2 つの方法',
  'subscription.scene.keep.title': 'このシーンを持つ',
  'subscription.scene.keep.body':
    'すべてのアップデート込みで、ずっとあなたのもの。{credits}。',
  'subscription.scene.plus.title': 'Plus ですべてのシーン',
  'subscription.scene.plus.body':
    'このシーンもほかのシーンも、メンバーの間すべて。{prices}。',
  'subscription.scene.member.note':
    'Plus がある間、グラフ、デスクトップ、ライトで再生されます。',
  'subscription.scene.member.keep':
    'Plus が終わっても使いたいですか? クレジットで持てば、ずっとあなたのものです。',
  'subscription.scene.member.keepButton': 'ずっと持つ · {credits}',

  'subscription.lapse.title': 'Plus メンバーシップが終了しました',
  'subscription.lapse.body':
    'これらのシーンは Plus で再生していたため、ダウンロードはこのコンピューターから削除されました。クレジットで入手してずっと持つか、Plus に再登録してすべてのシーンを使えます。',
  'subscription.lapse.more': 'ほか {count} 件',
  'subscription.lapse.find': '探す',
  'subscription.lapse.notNow': '今はしない',

  'subscription.sheet.eyebrow': 'シーン',
  'subscription.sheet.description':
    'シーンのすべてのシーン。FluidEQ のものも、コミュニティのものも。',
  'subscription.sheet.heading': 'Plus がある間、すべてのシーン',
  'subscription.sheet.lead':
    'グラフ、デスクトップ、ライトで、ここでも FluidWallpapers でも、サインインするすべてのコンピューターで再生されます。',
  'subscription.sheet.choose': '支払い方法',
  'subscription.sheet.renews':
    'Plus は解約するまで更新されます。Stripe のページでいつでも解約できます。',
  'subscription.sheet.ends':
    'Plus が終了すると、Plus で再生していたシーンは止まり、そのダウンロードはこのコンピューターから削除されます。',
  'subscription.sheet.pay': '支払いへ進む · {price}',
  'subscription.sheet.again': 'Stripe のページをもう一度開く',
  'subscription.sheet.waiting':
    'ブラウザーの Stripe のページで手続きを完了してください。Plus はここで自動的に有効になります。',
  'subscription.sheet.fine':
    '続行すると規約への同意が記録されます。支払いは Stripe のページで行い、FluidEQ がカード情報を見ることはありません。',
  'subscription.sheet.notNow': '今はしない',
  'subscription.sheet.done.title': 'Plus が有効になりました',
  'subscription.sheet.done.body':
    'シーンのすべてのシーンが使えるようになりました。',
  'subscription.sheet.done.see': 'シーンを見る',

  'subscription.error.termsChanged':
    '規約が更新されました。内容を確認してから続行してください。',
  'subscription.error.needsEmail':
    '先にメールアドレスを確認してから、もう一度お試しください。',
  'subscription.error.needsUpdate':
    'Plus に登録するには FluidEQ を更新してください。',
  'subscription.error.alreadySubscribed':
    'このアカウントはすでに Plus に登録しています。',
  'subscription.error.notOnSale': '現在 Plus は販売されていません。',
  'subscription.error.banned': 'このアカウントは現在 Plus に登録できません。',
  'subscription.error.signedOut':
    'Plus に登録するには、もう一度サインインしてください。',
  'subscription.error.failed':
    'Stripe のページを開けませんでした。接続を確認して、もう一度お試しください。',

  'subscription.manage.opened': 'Stripe のページがブラウザーで開きました。',
  'subscription.manage.none':
    'このアカウントには管理する Plus メンバーシップがありません。',
  'subscription.manage.signedOut':
    'Plus を管理するには、もう一度サインインしてください。',
  'subscription.manage.failed':
    'Stripe のページを開けませんでした。接続を確認して、もう一度お試しください。',
};

export default subscription;
