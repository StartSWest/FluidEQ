/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The scene store: credits, packs, and a scene kept for good (premium 0055,
// 0057). Credit counts are said through `creditsText` (`plus/credits.ts`),
// which picks the `store.credit.*` form the language's plural rules ask for;
// every locale writes all four forms, or a missing one falls back to English.
const store = {
  'store.credit.one': '{count} credit',
  'store.credit.few': '{count} credits',
  'store.credit.many': '{count} credits',
  'store.credit.other': '{count} credits',
  'store.credits.unit.one': 'credit',
  'store.credits.unit.few': 'credits',
  'store.credits.unit.many': 'credits',
  'store.credits.unit.other': 'credits',
  'store.credits.title': 'Credits',
  'store.credits.buyTitle': 'Get credits',
  'store.credits.lead':
    'One credit keeps one scene for good. You pay once, and nothing renews.',
  'store.credits.owned': 'Scenes you own: {count}',
  'store.credits.what':
    'Each credit keeps one scene from the gallery for good: on the graph, your desktop and your lights.',
  'store.credits.buy': 'Get credits',
  'store.credits.getFree': 'Claim free credits',
  'store.error.offline':
    "Couldn't reach FluidEQ. Check your connection and try again.",
  'store.error.signedOut': 'Sign in again to use your credits.',
  'store.error.unavailable': "The scene store isn't open yet. Try again later.",
  'store.error.server':
    'Something went wrong on our side. Nothing was spent; try again in a moment.',
  'store.error.unconfirmed':
    'Confirm your email address first. The code is in your inbox.',
  'store.error.notOnSale': "That pack isn't on sale right now. Choose another.",
  'store.error.noCredits': "You're out of credits.",
  'store.error.alreadyOwned': 'This scene is already yours.',
  'store.error.gone': 'This scene is no longer in the gallery.',
  'store.error.negative':
    'A refund left your balance below zero. A pack brings it back.',
  'store.error.banned': "This account can't get scenes.",
  'store.pack.each': '{price} a scene',
  'store.pack.best': 'Best price',
  'store.buy.title': 'Keep {name} for good?',
  'store.buy.lead':
    'It becomes yours: on the graph, your desktop and your lights, on every computer you sign in to.',
  'store.buy.keep': 'Yours for good, with every update its maker publishes.',
  'store.buy.balance': 'You have {credits}. After this: {after}.',
  'store.buy.final':
    "This can't be undone. The credit is spent the moment you confirm.",
  'store.buy.buying': 'Getting it…',
  'store.buy.use': 'Use {credits}',
  'store.loading': 'Reading your credits…',
  'store.packs.title': 'You need a credit',
  'store.packs.lead':
    'Each credit keeps one scene for good. Get a pack, and {name} is one click away.',
  'store.packs.negative':
    'A refund took back credits you had already used, so your balance is {credits}. A pack brings it back above zero.',
  'store.packs.choose': 'Choose a pack',
  'store.packs.waiting':
    'Finish paying in your browser. Your credits appear here as soon as the payment goes through.',
  'store.packs.fine':
    'Paid securely through Stripe. One payment; nothing renews. Credits have no cash value. Paying means you agree to FluidEQ’s terms.',
  'store.packs.arrived': '{credits} added. Thank you!',
  'store.packs.again': 'Open the payment page again',
  'store.packs.pay': 'Pay {price}',
  'store.packs.none': 'No packs are on sale right now. Try again later.',
  'store.cancel': 'Cancel',
  'store.done': 'Done',
  'store.starter.title': '{credits} free to start',
  'store.starter.body': 'Once per account, for a confirmed email address.',
  'store.starter.claim': 'Claim {credits}',
  'store.get': 'Get · {credits}',
  'store.scene.tasted':
    'That was a {seconds}-second taste. Get it to keep watching, for good.',
  'store.scene.locked': 'Get it to see it play here on your music.',
  'store.scene.yours': 'Yours for good',
  'store.scene.keep': 'Keep it for good',
  'store.scene.fine':
    'A scene you get is yours for good, on your account. Nobody can resell it.',
  'store.official.fine':
    'Part of the FluidEQ collection: yours for good once you get it.',
  'store.like.ownersOnly': '{count} likes. Get the scene to like it.',
  'store.scene.free': 'Free for everyone',
  'store.admin.freeTitle': 'Free for everyone',
  'store.admin.freeOn':
    'Every signed-in account plays it without spending a credit.',
  'store.admin.freeOff':
    'One credit, like every other scene. Switch it on to give it to everyone.',
  'store.error.termsOutdated':
    'The terms have changed. Update FluidEQ to read the new version before buying credits.',
};

export default store;
