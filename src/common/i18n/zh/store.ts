/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const store: Partial<Dictionary> = {
  'store.credit.one': '{count} 点数',
  'store.credit.few': '{count} 点数',
  'store.credit.many': '{count} 点数',
  'store.credit.other': '{count} 点数',
  'store.credits.unit.one': '点数',
  'store.credits.unit.few': '点数',
  'store.credits.unit.many': '点数',
  'store.credits.unit.other': '点数',
  'store.credits.title': '点数',
  'store.credits.buyTitle': '获取点数',
  'store.credits.lead': '每 1 点数可永久保留一个场景。只付一次，不会续费。',
  'store.credits.owned': '你拥有的场景：{count}',
  'store.credits.what':
    '每 1 点数都能永久保留画廊中的一个场景：在图表、桌面和你的灯光上。',
  'store.credits.buy': '获取点数',
  'store.credits.getFree': '领取免费点数',
  'store.error.offline': '无法连接到 FluidEQ。请检查网络连接后重试。',
  'store.error.signedOut': '请重新登录以使用你的点数。',
  'store.error.unavailable': '场景商店尚未开放。请稍后再试。',
  'store.error.server': '我们这边出了问题。没有扣除任何点数；请稍后重试。',
  'store.error.unconfirmed': '请先确认你的电子邮箱。验证码在你的收件箱里。',
  'store.error.notOnSale': '该点数包目前不出售。请选择其他点数包。',
  'store.error.noCredits': '你的点数已用完。',
  'store.error.alreadyOwned': '这个场景已经是你的了。',
  'store.error.gone': '这个场景已不在画廊中。',
  'store.error.negative': '一笔退款让你的余额低于零。购买点数包即可恢复。',
  'store.error.banned': '此账户无法获取场景。',
  'store.pack.each': '每个场景 {price}',
  'store.pack.best': '最优价格',
  'store.buy.title': '永久保留「{name}」？',
  'store.buy.lead':
    '它将归你所有：在图表、桌面和你的灯光上，在你登录的每台电脑上。',
  'store.buy.keep': '永久归你，并获得作者发布的每次更新。',
  'store.buy.balance': '你有 {credits}。之后：{after}。',
  'store.buy.final': '此操作无法撤销。确认后立即扣除点数。',
  'store.buy.buying': '正在获取…',
  'store.buy.use': '使用 {credits}',
  'store.loading': '正在读取你的点数…',
  'store.packs.title': '你需要点数',
  'store.packs.lead':
    '每 1 点数可永久保留一个场景。买一个点数包，「{name}」就只差一次点击。',
  'store.packs.negative':
    '一笔退款收回了你已用掉的点数，所以你的余额是 {credits}。购买点数包可将其恢复到零以上。',
  'store.packs.choose': '选择点数包',
  'store.packs.waiting':
    '请在浏览器中完成付款。付款成功后，点数会立即显示在这里。',
  'store.packs.fine':
    '通过 Stripe 安全付款。一次付款，不会续费。点数没有现金价值。付款即表示你同意 FluidEQ 的条款。',
  'store.packs.arrived': '已添加 {credits}。谢谢！',
  'store.packs.again': '重新打开付款页面',
  'store.packs.pay': '支付 {price}',
  'store.packs.none': '目前没有在售的点数包。请稍后再试。',
  'store.cancel': '取消',
  'store.done': '完成',
  'store.starter.title': '新手免费送 {credits}',
  'store.starter.body': '每个账户一次，需已确认的电子邮箱。',
  'store.starter.claim': '领取 {credits}',
  'store.get': '获取 · {credits}',
  'store.scene.tasted': '这是 {seconds} 秒的试看。获取它即可永久继续观看。',
  'store.scene.locked': '获取它，即可在这里随你的音乐播放。',
  'store.scene.yours': '永久归你',
  'store.scene.keep': '永久保留',
  'store.scene.fine':
    '你获取的场景永久归你，保存在你的账户中。任何人都不能转卖它。',
  'store.official.fine': 'FluidEQ 合集的一部分：获取后永久归你。',
  'store.like.ownersOnly': '{count} 个赞。获取场景后即可点赞。',
  'store.scene.free': '对所有人免费',
  'store.admin.freeTitle': '对所有人免费',
  'store.admin.freeOn': '每个已登录的账户都能播放，无需花费点数。',
  'store.admin.freeOff': '与其他场景一样需要 1 点数。打开即可送给所有人。',
  'store.error.termsOutdated':
    '条款已更新。请先更新 FluidEQ 并阅读新版本，再购买点数。',
};

export default store;
