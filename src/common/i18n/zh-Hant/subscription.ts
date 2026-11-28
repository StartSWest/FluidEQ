/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const subscription = {
  'subscription.name': 'Plus',
  'subscription.get': '開通 Plus',
  'subscription.getAgain': '重新開通 Plus',
  'subscription.manage': '管理 Plus',
  'subscription.included': 'Plus 包含',

  'subscription.plan.monthly': '按月',
  'subscription.plan.yearly': '按年',
  'subscription.plan.perMonth': '每月 {price}',
  'subscription.plan.perYear': '每年 {price}',
  'subscription.plan.both': '每月 {monthly} 或每年 {yearly}',
  'subscription.plan.cancelAnytime': '隨時可取消。',
  'subscription.plan.monthlyEquivalent': '相當於每月 {price}。',
  'subscription.plan.save': '省 {percent}%',

  'subscription.status.grace':
    'FluidEQ 無法在伺服器上確認你的 Plus。它會繼續使用到 {date}。',
  'subscription.status.waiting':
    '正在等待 Stripe 確認付款。Plus 會在這裡自動開啟。',

  'subscription.ways.title': 'Plus 還是點數？',
  'subscription.ways.credits.each': '一次一個場景，每個 {credits}',
  'subscription.ways.credits.keep': '永遠屬於你，即使沒有 Plus',
  'subscription.ways.plus.every': '場景中的所有場景，新的也包括',
  'subscription.ways.plus.while': '會員期間',

  'subscription.scene.twoWays': '兩種取得方式',
  'subscription.scene.keep.title': '保留這個場景',
  'subscription.scene.keep.body': '永遠屬於你，包含每次更新。{credits}。',
  'subscription.scene.plus.title': '用 Plus 取得所有場景',
  'subscription.scene.plus.body':
    '這個和其他所有場景，會員期間都可以。{prices}。',
  'subscription.scene.member.note':
    '只要你有 Plus，它就會在圖表、桌面和燈光上播放。',
  'subscription.scene.member.keep':
    '希望 Plus 結束後也能保留？用一個點數保留它，永遠屬於你。',
  'subscription.scene.member.keepButton': '永久保留 · {credits}',

  'subscription.lapse.title': '你的 Plus 會員已結束',
  'subscription.lapse.body':
    '這些場景透過 Plus 播放，其下載內容已從這台電腦上刪除。用點數取得一個即可永久保留，或重新開通 Plus 取得所有場景。',
  'subscription.lapse.more': '還有 {count} 個',
  'subscription.lapse.find': '尋找',
  'subscription.lapse.notNow': '暫不',

  'subscription.sheet.eyebrow': '場景',
  'subscription.sheet.description':
    '場景中的所有場景，包括 FluidEQ 的和社群的。',
  'subscription.sheet.heading': '只要有 Plus，所有場景都能用',
  'subscription.sheet.lead':
    '它們會在你的圖表、桌面和燈光上播放，在這裡和 FluidWallpapers 中，在你登入的每台電腦上。',
  'subscription.sheet.choose': '付款方式',
  'subscription.sheet.renews':
    'Plus 會一直續訂，直到你取消。隨時可在 Stripe 頁面上取消。',
  'subscription.sheet.ends':
    'Plus 結束時，它播放的場景會停止，其下載內容會從這台電腦上刪除。',
  'subscription.sheet.pay': '繼續付款 · {price}',
  'subscription.sheet.again': '再次開啟 Stripe 頁面',
  'subscription.sheet.waiting':
    '請在瀏覽器的 Stripe 頁面上完成。Plus 會在這裡自動開啟。',
  'subscription.sheet.fine':
    '繼續即記錄你同意條款。你在 Stripe 頁面上付款；FluidEQ 永遠看不到你的信用卡。',
  'subscription.sheet.notNow': '暫不',
  'subscription.sheet.done.title': 'Plus 已開啟',
  'subscription.sheet.done.body': '現在你可以使用場景中的所有場景。',
  'subscription.sheet.done.see': '查看場景',

  'subscription.error.termsChanged': '條款已更新。請閱讀後再繼續。',
  'subscription.error.needsEmail': '請先確認你的電子郵件地址，然後重試。',
  'subscription.error.needsUpdate': '請更新 FluidEQ 以開通 Plus。',
  'subscription.error.alreadySubscribed': '此帳戶已開通 Plus。',
  'subscription.error.notOnSale': 'Plus 目前未開賣。',
  'subscription.error.banned': '此帳戶目前無法開通 Plus。',
  'subscription.error.signedOut': '請重新登入以開通 Plus。',
  'subscription.error.failed': '無法開啟 Stripe 頁面。請檢查網路連線後重試。',

  'subscription.manage.opened': 'Stripe 頁面已在瀏覽器中開啟。',
  'subscription.manage.none': '此帳戶沒有可管理的 Plus 會員。',
  'subscription.manage.signedOut': '請重新登入以管理 Plus。',
  'subscription.manage.failed': '無法開啟 Stripe 頁面。請檢查網路連線後重試。',

  'subscription.cardGet': '取得',
  'subscription.makeScenes': '在 FluidWallpapers 中製作你自己的場景',
  'subscription.banner.title': 'Plus：畫廊中的所有場景',
  'subscription.banner.body':
    '播放並新增所有場景，新的也包括。FluidEQ 和 FluidWallpapers 共用一個訂閱。',
  'subscription.banner.credit':
    '沒有 Plus 也想要某個場景？用點數取得，它就永遠屬於你。',
  'subscription.banner.or': '或 {price}',
  'subscription.line.renews':
    '所有場景都可播放 · {date} 續訂 · FluidWallpapers 中同樣可用',
  'subscription.line.ends':
    '所有場景可播放至 {date} · FluidWallpapers 中同樣可用',
  'subscription.line.plain': '所有場景都可播放 · FluidWallpapers 中同樣可用',
  'subscription.sheet.both':
    'FluidEQ 和 FluidWallpapers 共用一個訂閱：在任一應用程式中開通，兩個都有效。',
  'subscription.sheet.keepOne': '或者只永久保留 {name}，即使沒有 Plus：',

  'subscription.account.yours': '畫廊中的所有場景都可播放',
  'subscription.account.renews': '{date} 續訂 · FluidWallpapers 中同樣可用',
  'subscription.account.ends': '{date} 結束 · FluidWallpapers 中同樣可用',
  'subscription.welcome.title': '或者用 Plus 取得所有場景',
  'subscription.welcome.body':
    '會員期間，畫廊中的所有場景，新的也包括。FluidEQ 和 FluidWallpapers 共用一個訂閱。',
  'subscription.welcome.signIn': '登入以開通 Plus',
  'subscription.renew': '續訂 Plus',
  'subscription.pass.member': '會員',
  'subscription.pass.ending': '已取消 · 到期前仍可使用',
  'subscription.everyScene.title': '所有場景都屬於你',
  'subscription.everyScene.body':
    '此帳戶擁有畫廊中的所有場景，因此 Plus 不會為它增加任何內容。',
  'subscription.chip.until': 'Plus 至 {date}',
} satisfies Partial<Dictionary>;

export default subscription;
