/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Plus, the scene subscription, inside Scenes (`renderer/plus/PlusPage.tsx`
 * and the sheet, strip, card and scene parts beside it). The `plus.` keys are
 * the Scenes gallery's, from when the whole tab was called Plus; these are
 * the subscription's own. Credits and Plus are always said the same two ways:
 * a credit keeps one scene forever, Plus plays every scene while it lasts.
 */
const subscription = {
  'subscription.name': 'Plus',
  'subscription.get': 'Get Plus',
  'subscription.getAgain': 'Get Plus again',
  'subscription.manage': 'Manage Plus',
  'subscription.included': 'Included with Plus',

  'subscription.rail.blurb': "Every scene, while you're a member",
  'subscription.rail.get': 'Get Plus',
  'subscription.rail.member': 'Member',

  'subscription.plan.monthly': 'Monthly',
  'subscription.plan.yearly': 'Yearly',
  'subscription.plan.perMonth': '{price} a month',
  'subscription.plan.perYear': '{price} a year',
  'subscription.plan.both': '{monthly} a month or {yearly} a year',
  'subscription.plan.cancelAnytime': 'Cancel anytime.',
  'subscription.plan.monthlyEquivalent': "That's {price} a month.",
  'subscription.plan.save': 'Save {percent}%',

  'subscription.page.lead':
    'Every scene in Scenes plays for you, here and in FluidWallpapers.',
  'subscription.page.new': 'New with Plus',

  'subscription.status.member': 'Member',
  'subscription.status.renews': '{plan} · Renews on {date}',
  'subscription.status.ends': '{plan} · Ends on {date}',
  'subscription.status.renewsNote':
    "Change your plan or card, or cancel, on Stripe's page.",
  'subscription.status.endsNote':
    'The scenes it plays stop on that day. Scenes you got with credits stay yours. To keep Plus, renew it with Manage Plus.',
  'subscription.status.grace':
    "FluidEQ couldn't check your Plus with the server. It keeps playing until {date}.",
  'subscription.status.waiting':
    'Waiting for Stripe to confirm your payment. Plus switches on here by itself.',
  'subscription.status.ended.title': 'Your Plus membership ended',
  'subscription.status.ended.body':
    'The scenes it played stopped, and their downloads were removed from this computer. Scenes you got with credits stay yours.',

  'subscription.ways.title': 'Plus or credits?',
  'subscription.ways.credits.have': 'Credits · you have {credits}',
  'subscription.ways.credits.body':
    'Get one scene and keep it forever, even after Plus.',
  'subscription.ways.credits.each': 'One scene at a time, {credits} each',
  'subscription.ways.credits.keep': 'Yours forever, even without Plus',
  'subscription.ways.plus.body':
    "Every scene, while you're a member. Add any, no credits.",
  'subscription.ways.plus.every': 'Every scene in Scenes, new ones too',
  'subscription.ways.plus.while': "While you're a member",

  'subscription.choice.credits.title': 'Credits: one scene',
  'subscription.choice.credits.body': 'Yours forever. {credits} each.',
  'subscription.choice.or': 'or',
  'subscription.choice.plus.title': 'Plus: every scene',
  'subscription.choice.plus.body': "While you're a member. {price}.",
  'subscription.choice.hide': 'Hide',

  'subscription.scene.twoWays': 'Two ways to play it',
  'subscription.scene.keep.title': 'Keep this scene',
  'subscription.scene.keep.body':
    'Yours forever, with every update. {credits}.',
  'subscription.scene.plus.title': 'Every scene with Plus',
  'subscription.scene.plus.body':
    "This one and all the others, while you're a member. {prices}.",
  'subscription.scene.member.note':
    'Plays on your graph, desktop and lights for as long as you have Plus.',
  'subscription.scene.member.keep':
    'Want it even if Plus ends? Keep it with a credit, yours forever.',
  'subscription.scene.member.keepButton': 'Keep it forever · {credits}',

  'subscription.lapse.title': 'Your Plus membership ended',
  'subscription.lapse.body':
    'These scenes played with Plus, and their downloads were removed from this computer. Get one with a credit to keep it forever, or get Plus again for every scene.',
  'subscription.lapse.more': '+{count} more',
  'subscription.lapse.find': 'Find it',
  'subscription.lapse.notNow': 'Not now',

  'subscription.sheet.eyebrow': 'Scenes',
  'subscription.sheet.description':
    "Every scene in Scenes, FluidEQ's own and the community's.",
  'subscription.sheet.heading': 'Every scene, for as long as you have Plus',
  'subscription.sheet.lead':
    'They play on your graph, your desktop and your lights, here and in FluidWallpapers, on every computer you sign in to.',
  'subscription.sheet.choose': 'How to pay',
  'subscription.sheet.renews':
    "Plus renews until you cancel. Cancel anytime on Stripe's page.",
  'subscription.sheet.ends':
    'When Plus ends, the scenes it played stop, and their downloads are removed from this computer.',
  'subscription.sheet.pay': 'Continue to payment · {price}',
  'subscription.sheet.again': "Open Stripe's page again",
  'subscription.sheet.waiting':
    "Finish on Stripe's page in your browser. Plus switches on here by itself.",
  'subscription.sheet.fine':
    "Continuing records your agreement to the terms. You pay on Stripe's page; FluidEQ never sees your card.",
  'subscription.sheet.notNow': 'Not now',
  'subscription.sheet.done.title': 'Plus is on',
  'subscription.sheet.done.body': 'Every scene in Scenes plays for you now.',
  'subscription.sheet.done.see': 'See the scenes',

  'subscription.error.termsChanged':
    'The terms were updated. Read them, then continue.',
  'subscription.error.needsEmail':
    'Confirm your email address first, then try again.',
  'subscription.error.needsUpdate': 'Update FluidEQ to get Plus.',
  'subscription.error.alreadySubscribed': 'This account already has Plus.',
  'subscription.error.notOnSale': "Plus isn't on sale right now.",
  'subscription.error.banned': "This account can't have Plus right now.",
  'subscription.error.signedOut': 'Sign in again to get Plus.',
  'subscription.error.failed':
    "Stripe's page could not be opened. Check your connection and try again.",

  'subscription.manage.opened': "Stripe's page opened in your browser.",
  'subscription.manage.none': 'This account has no Plus membership to manage.',
  'subscription.manage.signedOut': 'Sign in again to manage Plus.',
  'subscription.manage.failed':
    "Stripe's page could not be opened. Check your connection and try again.",
};

export default subscription;
