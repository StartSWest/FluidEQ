/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// Creators paid for their scenes (premium 0064): the account panel's card,
// the sign-up dialog before Stripe's pages, and the creator terms. The
// numbers in the terms are the server's, passed in. `creator.sales.*` is
// picked by the language's plural rules; every locale writes all four.
const creator = {
  'creator.title': 'Creator payouts',
  'creator.badge.active': 'Active',
  'creator.badge.checking': 'Checking',
  'creator.invite':
    'Publish scenes to the gallery and get paid when members buy them: {share}% of each sale, sent to your bank by Stripe.',
  'creator.unfinished':
    "Your sign-up with Stripe isn't finished. Pick up where you left off.",
  'creator.newTerms':
    'The creator terms have changed. Read and accept them to keep getting paid.',
  'creator.checking':
    'Stripe is checking your details. It usually takes a few minutes, sometimes a few days.',
  'creator.paidLine': '{sales} of your scenes so far.',
  'creator.sales.one': '{count} sale',
  'creator.sales.few': '{count} sales',
  'creator.sales.many': '{count} sales',
  'creator.sales.other': '{count} sales',
  'creator.ready': 'Ready to pay',
  'creator.held': 'On hold',
  'creator.paid': 'Paid so far',
  'creator.paidHint':
    'Each sale is held {days} days in case of a refund. Creators are paid every {every} days, once {amount} is ready.',
  'creator.opened':
    "Stripe's page is open in your browser. Finish there; this card updates when you come back.",
  'creator.setUp': 'Set up payouts',
  'creator.finish': 'Finish setting up',
  'creator.readTerms': 'Read the new terms',
  'creator.checkAgain': 'Check again',
  'creator.dashboard': 'Stripe dashboard',
  'creator.dialog.title': 'Get paid for your scenes',
  'creator.dialog.lead':
    'Stripe pays you and keeps your identity, bank and tax details. FluidEQ never sees them.',
  'creator.dialog.step1': 'Choose your country and accept the terms here.',
  'creator.dialog.step2': "Sign up on Stripe's page in your browser.",
  'creator.dialog.step3': 'Come back to FluidEQ: your earnings show here.',
  'creator.dialog.country': 'Country you live in',
  'creator.dialog.search': 'Search countries',
  'creator.dialog.choose': 'Choose a country',
  'creator.dialog.countryHint':
    "Stripe can pay creators in the US, the UK, Canada, Switzerland and the European Economic Area, and it can't be changed later. Not in the list? Members can still buy your scenes, and each sale earns you a credit instead.",
  'creator.dialog.cancel': 'Cancel',
  'creator.dialog.go': 'Agree and continue to Stripe',
  'creator.dialog.opening': 'Opening Stripe…',
  'creator.terms.title': 'Creator terms',
  'creator.terms.share':
    'You get {share}% of what each sale of your scenes brings in after Stripe’s fees. FluidEQ keeps the rest.',
  'creator.terms.paidCredits':
    'Only scenes bought with paid credits earn money. Free credits, and FluidEQ’s own scenes, earn nothing.',
  'creator.terms.hold':
    'Each earning is held {days} days, so a refund or a dispute can still undo it. One undone after you were paid comes off your next payout.',
  'creator.terms.minimum':
    'FluidEQ pays creators every {every} days, once {amount} or more is ready. Stripe then sends it to your bank on your own schedule.',
  'creator.terms.stripe':
    'Stripe asks for your identity, bank and tax details and shows you its own terms. Payouts stop if Stripe can no longer pay you.',
  'creator.terms.rights':
    'Everything in your scenes must be yours to sell. Scenes are still reviewed, and one that breaks the Plus terms can be taken down.',
  'creator.terms.taxes':
    'Taxes on what you earn are yours to declare where you live.',
  'creator.terms.changes':
    'These terms may change. You are told in the app, and asked to accept new ones before you are paid again.',
  'creator.error.signedOut': 'Sign in again to manage your payouts.',
  'creator.error.unconfirmed':
    'Confirm your email address first. The code is in your inbox.',
  'creator.error.offline':
    "Couldn't reach FluidEQ. Check your connection and try again.",
  'creator.error.unavailable':
    "Creator payouts aren't open yet. Try again later.",
  'creator.error.agreementOutdated':
    'The creator terms have changed. Read them again and accept.',
  'creator.error.country': "Stripe can't pay creators in that country yet.",
  'creator.error.banned': "This account can't be paid for scenes.",
  'creator.error.server':
    'Something went wrong on our side. Nothing was changed; try again in a moment.',
  'creator.admin.tab': 'Payouts',
  'creator.admin.plan': 'Creators paid through Stripe',
  'creator.admin.loading': 'Reading what creators are owed',
  'creator.admin.creators': 'Creators: {count}',
  'creator.admin.available': 'Available at Stripe',
  'creator.admin.availableNote': 'what the transfers come out of',
  'creator.admin.short':
    "FluidEQ's available balance at Stripe is below what is due. Transfers past it fail and are sent again at the next run.",
  'creator.admin.list': 'Who gets paid',
  'creator.admin.none':
    'Nobody is due yet. Creators appear here once Stripe can pay them and enough of their earnings is past its hold.',
  'creator.admin.rules':
    'Payouts go out by themselves on the 1st and the 16th: creators first, then your share to your bank. Each payout is sent once: a run that stopped halfway is finished by the next, never sent again.',
  'creator.admin.lastPaid': 'Last paid {date}',
  'creator.admin.neverPaid': 'No payout yet',
  'creator.admin.nextDue': 'next automatic payout {date}',
  'creator.notice.title': 'Creator payout on {date}',
  'creator.notice.body':
    '{amount} goes out automatically. Creators to pay: {count}.',
  'creator.notice.later': 'Later',
  'creator.notice.open': 'Open Payouts',
  'creator.notice.shortTitle': 'Stripe is short for the {date} payout',
  'creator.notice.shortBody':
    'Due: {amount}. Creators to pay: {count}. Stripe holds {available}; transfers past it will fail and wait for the next payout.',
  'creator.admin.owed': 'Owed to creators',
  'creator.admin.owedNote': 'held {held} · ready {ready}',
  'creator.admin.sending': 'sending {amount}',
  'creator.admin.onItsWay': '+ {amount} on its way',
  'creator.admin.yours': 'Yours',
  'creator.admin.yoursNote':
    'goes to your bank by itself after each run; {reserve} stays for refunds',
  'creator.admin.lastToYou': 'last sent to your bank: {amount}, {date}',
  'creator.admin.yoursShort':
    'creators are owed {amount} more than Stripe holds',
  'creator.admin.next': 'Next payout',
  'creator.admin.manual':
    "Stripe still sends your whole balance to your bank by itself, creators' money included, so FluidEQ holds your share back. In Stripe, Settings → Payouts, set the schedule to Manual once: FluidEQ then sends only your share, by itself, after each run.",
  'creator.admin.pendingLine':
    'Payouts an earlier run left unfinished: {count}. The next run finishes them first.',
};

export default creator;
