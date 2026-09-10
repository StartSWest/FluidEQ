/**
 * The FluidEQ Plus terms: shown before anybody subscribes, and readable from
 * the Account panel and the leaderboard at any time.
 *
 * Written to be read rather than clicked past — short paragraphs, plain
 * words, and every piece of information the app sends listed with when it
 * goes and who can see it. The numbers are placeholders filled from
 * `common/plusTerms.ts` and the leaderboard's scoring, so the text cannot
 * promise what the code does not do. Changing what this says means raising
 * PLUS_TERMS_VERSION, in every language at once.
 */
const terms = {
  'terms.eyebrow': 'FluidEQ Plus',
  'terms.title': 'Terms, and what the app sends',
  'terms.meta': 'Version {version} · In effect since {date}',
  'terms.intro':
    'All of it in plain words. This is what you agree to when you subscribe, and it lists every piece of information the app sends, when it goes, and who can see it.',
  'terms.link': 'Plus terms, and what the app sends',

  'terms.short.title': 'The short version',
  'terms.short.price.title': '{price}, cancel any time',
  'terms.short.price.body':
    'Paid on Buy Me a Coffee. FluidEQ never sees your card.',
  'terms.short.free.title': 'Nothing free is taken away',
  'terms.short.free.body':
    'FluidEQ keeps working offline and without an account, as it always has.',
  'terms.short.choice.title': 'You choose what is shared',
  'terms.short.choice.body':
    'The leaderboard is off unless you join, and you decide what you post.',
  'terms.short.music.title': 'Never your music',
  'terms.short.music.body':
    'No track names, files, audio or devices ever leave your computer.',

  'terms.membership.title': 'The membership',
  'terms.membership.p1':
    'Plus adds premium visualizers, posting in the community and the leaderboard to FluidEQ. It costs {price} and renews every month until you cancel.',
  'terms.membership.p2':
    'Payment is handled by Buy Me a Coffee, under its own terms. FluidEQ never sees your card or bank details. You can cancel at any time on Buy Me a Coffee: Plus stays on until the end of the month you paid for, and nothing more is charged.',
  'terms.membership.p3':
    'If a charge was a mistake, or Plus is not for you, ask within {refundDays} days of that charge and it is refunded in full, no questions asked.',
  'terms.membership.p4':
    'When a membership ends, the Plus looks lock again and FluidEQ goes back to its free looks. Plus keeps working offline for up to {graceDays} days after the app last confirmed your membership. Nothing that is free is ever affected.',

  'terms.account.title': 'Your account',
  'terms.account.p1':
    'An account is an email address and a password, and you need to be at least {age} to create one. The password travels encrypted to the sign-in service and is stored there only as a one-way hash, which nobody can read back, the maker included.',
  'terms.account.p2':
    'Your email receives the codes that confirm your address and reset your password. It is never shown to other members: in the community you appear by the handle and display name you choose.',
  'terms.account.p3':
    'On your computer, the app keeps your session encrypted by the operating system. Accounts are personal, so keep your password to yourself.',

  'terms.sent.title': 'What the app sends, and when',
  'terms.sent.intro':
    'Only for the features you use, and always over an encrypted connection. Without an account, the only request is for the public list of Plus looks, and it carries nothing about you.',
  'terms.sent.when': 'When',
  'terms.sent.who': 'Who can see it',
  'terms.sent.signIn.what': 'Your email and password',
  'terms.sent.signIn.when':
    'When you create an account, sign in or confirm your address',
  'terms.sent.signIn.who':
    'The sign-in service keeps your email, and the password only as a hash nobody can read.',
  'terms.sent.membership.what': 'Your sign-in token',
  'terms.sent.membership.when':
    'When the app starts, when you come back to the computer, and when you open a Plus feature',
  'terms.sent.membership.who':
    'Nothing is kept. The server only answers whether your membership is active.',
  'terms.sent.payment.what':
    'Your payment email and membership status, sent by Buy Me a Coffee',
  'terms.sent.payment.when': 'When you pay, renew or cancel',
  'terms.sent.payment.who':
    'The maker, to match the payment to your account. Pay with the email you sign in with.',
  'terms.sent.looks.what': 'Your sign-in token',
  'terms.sent.looks.when': 'When Plus looks are downloaded or updated',
  'terms.sent.looks.who':
    'Nothing is kept. Every look is signed, and your computer checks the signature before playing it.',
  'terms.sent.catalogue.what': 'Nothing about you',
  'terms.sent.catalogue.when':
    'When the look picker shows which Plus looks exist, with or without an account',
  'terms.sent.catalogue.who':
    'Nothing is kept. The request only fetches the public list of looks.',
  'terms.sent.community.what':
    'Your handle and display name, your messages and their @mentions, the reports you file and the people you block',
  'terms.sent.community.when':
    'When you set up your profile, post, report or block',
  'terms.sent.community.who':
    'Messages, handles and display names: every signed-in member. Reports: the maker. Blocks: only you.',
  'terms.sent.board.what':
    'One number per day: the whole minutes of music that played, up to {capHours} hours, with its date',
  'terms.sent.board.when':
    'Only if you join the leaderboard: when you come back to the computer, at most every {uploadHours} hours, and when you open the board',
  'terms.sent.board.who':
    'Your handle, display name, points and what they are made of: every signed-in member.',

  'terms.never.title': 'What never leaves your computer',
  'terms.never.p1':
    'Your audio, and anything about what you play: track names, artists, files, folders and playlists.',
  'terms.never.p2': 'Your EQ settings, presets and profiles.',
  'terms.never.p3':
    'Your audio devices and their names, and the other apps on your computer.',

  'terms.protect.title': 'How it is protected',
  'terms.protect.p1': 'Every request is encrypted on its way.',
  'terms.protect.p2':
    'The rules live on the server, not in the app: each account can change only its own data, and a modified copy of FluidEQ gets exactly the same answers.',
  'terms.protect.p3':
    'The board and the chat show handles, never email addresses or account ids.',
  'terms.protect.p4':
    'The maker runs the server and can see what it stores, to keep it working and to moderate the community. Nothing is sold, shared or used for advertising, and there is no tracking or analytics.',
  'terms.protect.p5':
    'The service runs on Supabase (sign-in, database and files) and sends email through Resend; payments go through Buy Me a Coffee. Each receives only what its part needs.',
  'terms.protect.p6':
    'FluidEQ keeps no IP addresses. The hosting provider records requests, addresses included, in short-lived logs to keep the service running and safe.',

  'terms.fair.title': 'Fair play on the leaderboard',
  'terms.fair.p1':
    'Listening time is counted by the app on your computer, so the server cannot watch it happen. It checks every number instead: no more than {capHours} hours in a day, no day that has not begun, nothing older than {windowDays} days, and no day that grows faster than the clock. Messages and mentions are counted on the server, from what was actually posted.',
  'terms.fair.p2':
    'Everyone earns points the same way, the maker included. Changing the app or what it sends, automating listening or posting, or climbing with more than one account takes you off the board, and can take you out of the community.',

  'terms.community.title': 'Community rules',
  'terms.community.p1':
    'Be kind. No harassment, hate, threats, spam, illegal content, or anyone’s personal information. Every member can read what you post, so share only what you are happy to have read.',
  'terms.community.p2':
    'You can delete your own messages at any time. The maker can remove messages and suspend accounts that break these rules. Report a message to flag it; only the maker sees reports.',

  'terms.keep.title': 'What is kept, and how to delete it',
  'terms.keep.p1':
    'Leaderboard: “Remove all my data” in the Account panel deletes every day you ever sent, at once. Your computer keeps only the last {windowDays} days of totals.',
  'terms.keep.p2': 'Messages: they stay until you or the maker delete them.',
  'terms.keep.p3':
    'Membership: your payment email and status are kept to match payments to your account, and are deleted with it.',
  'terms.keep.p4':
    'Your account: ask for it to be deleted and it is gone within {deletionDays} days, together with your profile, messages, leaderboard days and membership record.',

  'terms.looks.title': 'The Plus looks',
  'terms.looks.p1':
    'The Plus looks are the maker’s own work, licensed to you for personal use while you are a member. Please do not copy, share or resell them.',
  'terms.looks.p2':
    'FluidEQ itself stays free software under the GPL. Nothing here changes a right the GPL gives you.',

  'terms.changes.title': 'Changes, and the fine print',
  'terms.changes.p1':
    'If these terms change, the new version appears here with its date, and the app tells you before it applies to you.',
  'terms.changes.p2':
    'FluidEQ and Plus are provided as they are, without warranties, as far as the law allows. The maker is not liable for more than you paid for Plus in the last twelve months. Nothing here takes away the rights the law gives you as a consumer.',

  'terms.contact.title': 'Contact',
  'terms.contact.p1':
    'Questions, refunds, or deleting your account: {contact}.',

  'terms.agree.check':
    'I have read these terms, including what the app sends, and I agree to them.',
  'terms.agree.continue': 'Agree and continue to payment',
  'terms.agree.opening': 'Opening Buy Me a Coffee…',
  'terms.agree.hint':
    'Payment opens in your browser. Use the same email as your FluidEQ account.',
  'terms.back': 'Back',
  'terms.error.outdated':
    'These terms have changed. Update FluidEQ to read the new version before subscribing.',
} as const;

export default terms;
