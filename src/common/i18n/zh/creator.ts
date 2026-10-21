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
    'Stripe 可以向美国、英国、加拿大、瑞士和欧洲经济区的创作者付款，选定后无法更改。不在列表中？会员仍然可以购买你的场景，每笔销售会改为给你一个积分。',
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
    '场景中的所有内容都必须是你有权出售的。场景仍需审核，违反 Plus 条款的场景可能被下架。',
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
  'creator.admin.tab': '付款',
  'creator.admin.plan': '通过 Stripe 付款的创作者',
  'creator.admin.loading': '正在读取应付给创作者的金额',
  'creator.admin.creators': '创作者：{count}',
  'creator.admin.available': 'Stripe 可用余额',
  'creator.admin.availableNote': '转账的资金来源',
  'creator.admin.short':
    'FluidEQ 在 Stripe 的可用余额低于应付金额。超出余额的转账会失败，并等待下一次执行；请在余额结算后再付款。',
  'creator.admin.list': '收款人',
  'creator.admin.none':
    '目前还没有应付的人。当 Stripe 可以向创作者付款且足够的收益已过暂扣期时，他们会出现在这里。',
  'creator.admin.payLead':
    '不必等待，立即向列表中的所有人付款：共 {amount}，通过 Stripe。',
  'creator.admin.confirm':
    '现在发送 {amount}？这会从 FluidEQ 的 Stripe 余额中转出真实资金，且无法撤销。',
  'creator.admin.pay': '向创作者付款',
  'creator.admin.payNow': '是，立即付款',
  'creator.admin.paying': '正在付款…',
  'creator.admin.ran': '已付款：{paid}。未付款：{failed}。',
  'creator.admin.rules':
    '每月 1 日和 16 日自动付款；点击“向创作者付款”可立即发送。每笔付款只发送一次：中途停止的执行会由下一次完成，绝不会重复发送。',
  'creator.admin.lastPaid': '上次付款：{date}',
  'creator.admin.neverPaid': '尚未付款',
  'creator.admin.nextDue': '下次自动付款：{date}',
  'creator.notice.title': '{date} 的创作者付款',
  'creator.notice.body': '将自动发出 {amount}。待付款创作者：{count}。',
  'creator.notice.later': '稍后',
  'creator.notice.open': '打开付款',
  'creator.notice.shortTitle': 'Stripe 余额不足以支付 {date} 的款项',
  'creator.notice.shortBody':
    '应付：{amount}。待付款创作者：{count}。Stripe 余额为 {available}；超出部分的转账会失败，并等待下一次付款。',
  'creator.admin.owed': '欠创作者的款项',
  'creator.admin.owedNote': '暂扣 {held} · 可支付 {ready}',
  'creator.admin.sending': '发送中 {amount}',
  'creator.admin.onItsWay': '+ {amount} 正在到账',
  'creator.admin.yours': '你可提取的金额',
  'creator.admin.yoursNote': '余额减去欠创作者的款项',
  'creator.admin.yoursShort': '欠创作者的款项比 Stripe 余额多 {amount}',
  'creator.admin.next': '下次付款',
  'creator.admin.manual':
    'Stripe 自动提现到你的银行账户时，会把创作者的钱也一起转走。请在 Stripe 中将提现设为手动，只提取属于你的部分。',
  'creator.admin.pendingLine':
    '上次执行未完成的付款：{count}。下一次执行会先完成它们。',
};

export default creator;
