/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const creator: Partial<Dictionary> = {
  'creator.title': '创作者收益',
  'creator.badge.active': '已启用',
  'creator.badge.checking': '审核中',
  'creator.invite':
    '把场景发布到画廊，会员购买时你就能获得收益：每笔销售的 {share}%，由 Stripe 转入你的银行账户。',
  'creator.unfinished': '你在 Stripe 的注册尚未完成。请从上次中断的地方继续。',
  'creator.newTerms': '创作者条款已更新。阅读并接受后才能继续获得付款。',
  'creator.checking': 'Stripe 正在核实你的资料。通常需要几分钟，有时需要几天。',
  'creator.paidLine': '你的场景至今已售出：{sales}。',
  'creator.sales.one': '{count} 笔',
  'creator.sales.few': '{count} 笔',
  'creator.sales.many': '{count} 笔',
  'creator.sales.other': '{count} 笔',
  'creator.ready': '可支付',
  'creator.held': '暂扣中',
  'creator.paid': '已支付',
  'creator.paidHint':
    '每笔销售会暂扣 {days} 天以防退款。创作者每 {every} 天收款一次，累计满 {amount} 即付款。',
  'creator.opened':
    'Stripe 页面已在浏览器中打开。请在那里完成；回来后此卡片会自动更新。',
  'creator.setUp': '设置收款',
  'creator.finish': '完成设置',
  'creator.readTerms': '阅读新条款',
  'creator.checkAgain': '再次检查',
  'creator.dashboard': 'Stripe 控制台',
  'creator.dialog.title': '用你的场景赚钱',
  'creator.dialog.lead':
    '由 Stripe 向你付款，并保管你的身份、银行和税务信息。FluidEQ 永远看不到这些信息。',
  'creator.dialog.step1': '在这里选择国家或地区并接受条款。',
  'creator.dialog.step2': '在浏览器中的 Stripe 页面上注册。',
  'creator.dialog.step3': '回到 FluidEQ：你的收益会显示在这里。',
  'creator.dialog.country': '居住国家或地区',
  'creator.dialog.search': '搜索国家或地区',
  'creator.dialog.choose': '选择国家或地区',
  'creator.dialog.countryHint':
    'Stripe 可以向美国、英国、加拿大、瑞士和欧洲经济区的创作者付款，选定后无法更改。不在列表中？会员仍然可以购买你的场景，每两笔销售会改为给你 1 点数。',
  'creator.dialog.cancel': '取消',
  'creator.dialog.go': '同意并前往 Stripe',
  'creator.dialog.opening': '正在打开 Stripe…',
  'creator.terms.title': '创作者条款',
  'creator.terms.share':
    '你的场景每笔销售在扣除 Stripe 手续费后的收入，你获得其中的 {share}%，其余归 FluidEQ。',
  'creator.terms.paidCredits':
    '只有用付费积分购买的场景才会产生收益。免费积分以及 FluidEQ 自己的场景不产生收益。',
  'creator.terms.hold':
    '每笔收益会暂扣 {days} 天，期间退款或争议仍可将其撤销。付款后被撤销的部分会从你的下一次付款中扣除。',
  'creator.terms.minimum':
    'FluidEQ 每 {every} 天向可支付金额达到 {amount} 或以上的创作者付款。之后 Stripe 会按你自己设定的周期转入你的银行账户。',
  'creator.terms.stripe':
    'Stripe 会要求你提供身份、银行和税务信息，并向你展示其自身的条款。如果 Stripe 无法再向你付款，付款将停止。',
  'creator.terms.rights':
    '场景中的所有内容都必须是你有权出售的。场景仍需审核，违反条款的场景可能被下架。',
  'creator.terms.taxes': '你的收益所涉及的税款，由你在居住地自行申报。',
  'creator.terms.changes':
    '这些条款可能会变更。变更会在应用内通知你，你需要接受新条款后才能再次收款。',
  'creator.error.signedOut': '请重新登录以管理你的收款。',
  'creator.error.unconfirmed': '请先确认你的邮箱地址。验证码在你的收件箱中。',
  'creator.error.offline': '无法连接到 FluidEQ。请检查网络连接后重试。',
  'creator.error.unavailable': '创作者收益尚未开放。请稍后再试。',
  'creator.error.agreementOutdated': '创作者条款已更新。请重新阅读并接受。',
  'creator.error.country': 'Stripe 目前还无法向该国家或地区的创作者付款。',
  'creator.error.banned': '此账户无法因场景获得付款。',
  'creator.error.server': '我们这边出了问题。没有任何更改；请稍后再试。',
};

export default creator;
