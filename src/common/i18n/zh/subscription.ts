/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const subscription: Partial<Dictionary> = {
  'subscription.name': 'Plus',
  'subscription.get': '开通 Plus',
  'subscription.getAgain': '重新开通 Plus',
  'subscription.manage': '管理 Plus',
  'subscription.included': 'Plus 包含',

  'subscription.plan.monthly': '按月',
  'subscription.plan.yearly': '按年',
  'subscription.plan.perMonth': '每月 {price}',
  'subscription.plan.perYear': '每年 {price}',
  'subscription.plan.both': '每月 {monthly} 或每年 {yearly}',
  'subscription.plan.cancelAnytime': '随时可取消。',
  'subscription.plan.monthlyEquivalent': '相当于每月 {price}。',
  'subscription.plan.save': '省 {percent}%',

  'subscription.status.grace':
    'FluidEQ 无法在服务器上确认你的 Plus。它会继续使用到 {date}。',
  'subscription.status.waiting':
    '正在等待 Stripe 确认付款。Plus 会在这里自动开启。',

  'subscription.ways.title': 'Plus 还是点数？',
  'subscription.ways.credits.each': '一次一个场景，每个 {credits}',
  'subscription.ways.credits.keep': '永久归你，即使没有 Plus',
  'subscription.ways.plus.every': '场景中的所有场景，新的也包括',
  'subscription.ways.plus.while': '会员期间',

  'subscription.scene.twoWays': '两种获取方式',
  'subscription.scene.keep.title': '保留这个场景',
  'subscription.scene.keep.body': '永久归你，包含每次更新。{credits}。',
  'subscription.scene.plus.title': '用 Plus 获取所有场景',
  'subscription.scene.plus.body':
    '这个和其他所有场景，会员期间都可以。{prices}。',
  'subscription.scene.member.note':
    '只要你有 Plus，它就会在图表、桌面和灯光上播放。',
  'subscription.scene.member.keep':
    '希望 Plus 结束后也能保留？用一个点数保留它，永久归你。',
  'subscription.scene.member.keepButton': '永久保留 · {credits}',

  'subscription.lapse.title': '你的 Plus 会员已结束',
  'subscription.lapse.body':
    '这些场景通过 Plus 播放，其下载内容已从这台电脑上删除。用点数获取一个即可永久保留，或重新开通 Plus 获取所有场景。',
  'subscription.lapse.more': '还有 {count} 个',
  'subscription.lapse.find': '查找',
  'subscription.lapse.notNow': '暂不',

  'subscription.sheet.eyebrow': '场景',
  'subscription.sheet.description':
    '场景中的所有场景，包括 FluidEQ 的和社区的。',
  'subscription.sheet.heading': '只要有 Plus，所有场景都归你用',
  'subscription.sheet.lead':
    '它们会在你的图表、桌面和灯光上播放，在这里和 FluidWallpapers 中，在你登录的每台电脑上。',
  'subscription.sheet.choose': '付款方式',
  'subscription.sheet.renews':
    'Plus 会一直续订，直到你取消。随时可在 Stripe 页面上取消。',
  'subscription.sheet.ends':
    'Plus 结束时，它播放的场景会停止，其下载内容会从这台电脑上删除。',
  'subscription.sheet.pay': '继续付款 · {price}',
  'subscription.sheet.again': '再次打开 Stripe 页面',
  'subscription.sheet.waiting':
    '请在浏览器的 Stripe 页面上完成。Plus 会在这里自动开启。',
  'subscription.sheet.fine':
    '继续即记录你同意条款。你在 Stripe 页面上付款；FluidEQ 永远看不到你的银行卡。',
  'subscription.sheet.notNow': '暂不',
  'subscription.sheet.done.title': 'Plus 已开启',
  'subscription.sheet.done.body': '现在你可以使用场景中的所有场景。',
  'subscription.sheet.done.see': '查看场景',

  'subscription.error.termsChanged': '条款已更新。请阅读后再继续。',
  'subscription.error.needsEmail': '请先确认你的电子邮件地址，然后重试。',
  'subscription.error.needsUpdate': '请更新 FluidEQ 以开通 Plus。',
  'subscription.error.alreadySubscribed': '此账户已开通 Plus。',
  'subscription.error.notOnSale': 'Plus 目前未开售。',
  'subscription.error.banned': '此账户目前无法开通 Plus。',
  'subscription.error.signedOut': '请重新登录以开通 Plus。',
  'subscription.error.failed': '无法打开 Stripe 页面。请检查网络连接后重试。',

  'subscription.manage.opened': 'Stripe 页面已在浏览器中打开。',
  'subscription.manage.none': '此账户没有可管理的 Plus 会员。',
  'subscription.manage.signedOut': '请重新登录以管理 Plus。',
  'subscription.manage.failed': '无法打开 Stripe 页面。请检查网络连接后重试。',

  'subscription.cardGet': '获取',
  'subscription.makeScenes': '在 FluidWallpapers 中制作你自己的场景',
  'subscription.banner.title': 'Plus：图库中的所有场景',
  'subscription.banner.body':
    '播放并添加所有场景，新的也包括。FluidEQ 和 FluidWallpapers 共用一个订阅。',
  'subscription.banner.credit':
    '没有 Plus 也想要某个场景？用点数获取，它就永久归你。',
  'subscription.banner.or': '或 {price}',
  'subscription.line.renews':
    '所有场景都可播放 · {date} 续订 · FluidWallpapers 中同样可用',
  'subscription.line.ends':
    '所有场景可播放至 {date} · FluidWallpapers 中同样可用',
  'subscription.line.plain': '所有场景都可播放 · FluidWallpapers 中同样可用',
  'subscription.sheet.both':
    'FluidEQ 和 FluidWallpapers 共用一个订阅：在任一应用中开通，两个应用都有效。',
  'subscription.sheet.keepOne': '或者只永久保留 {name}，即使没有 Plus：',
};

export default subscription;
