/**
 * The notice that tells a Plus member the terms changed since the version
 * they agreed to. Not the terms themselves — those are `terms.ts`, and a word
 * changed here raises no version.
 *
 * One sentence per version, saying what that version changed, in words a
 * member takes in at a glance; the terms carry the detail. Raising
 * PLUS_TERMS_VERSION means writing its sentence here and in every language,
 * and adding it to PLUS_TERMS_CHANGES in `common/plusTermsNotice.ts`.
 */
const termsNotice = {
  'termsNotice.title': 'The Plus terms have changed',
  'termsNotice.version': 'Version {version}',
  'termsNotice.read': 'Read the terms',
  'termsNotice.gotIt': 'Got it',

  'termsNotice.change.2':
    'You now need to be 18 to have an account, up from 16, because Buy Me a Coffee, which takes the payment, requires it.',
  'termsNotice.change.3':
    'Scenes you make in the Studio stay yours: sharing one by file lets other members play it, and likes on it earn you leaderboard points.',
  'termsNotice.change.4':
    'Visualizers, the new gallery: a scene you publish there is shown to Plus members until you unpublish it, and the terms list what browsing, adding and reporting sends.',
  'termsNotice.change.5':
    'Plus can now be paid yearly as well as monthly, and a membership renews at the end of whichever period you paid for. A scene you publish in Visualizers is now seen by anyone signed in, who can watch it play for a few seconds; only Plus members play it in full and add it. Plus runs on up to 5 computers at a time, and the leaderboard adds up your computers’ listening without letting a day grow faster than the clock.',
  'termsNotice.change.6':
    'The terms now also cover what a free account can try — FluidEQ’s sample scenes, not members’ scenes — reports and takedowns, sharing limits, the check against copies of FluidEQ’s scenes, version notes, gifts of Plus, and every other place FluidEQ connects to.',
  'termsNotice.change.7':
    'The leaderboard now ranks an account only while it has Plus, and Report a problem can also open a private email to FluidEQ’s maker.',
  'termsNotice.change.8':
    'The fourteen-day refund is withdrawn. Cancelling still keeps Plus on to the end of the period you paid for, and nothing more is charged.',
  'termsNotice.change.9':
    'Every scene published in Visualizers is now read by a moderator before anyone else sees it. And Plus can arrive without a payment: a free trial a new account can take once, and a month earned by a scene that is approved. Neither renews, and nothing is ever charged for either.',
} as const;

export default termsNotice;
