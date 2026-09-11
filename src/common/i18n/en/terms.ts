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
    'The leaderboard is off unless you join, and you decide what you post and which of your scenes you share.',
  'terms.short.music.title': 'Never your music',
  'terms.short.music.body':
    'No track names, files, audio or devices ever leave your computer.',

  'terms.membership.title': 'The membership',
  'terms.membership.p1':
    'Plus adds premium visualizers, the Studio for making your own and sharing them with other members, posting in the community and the leaderboard to FluidEQ. It costs {price} and renews every month until you cancel.',
  'terms.membership.p2':
    'Payment is handled by Buy Me a Coffee, under its own terms. FluidEQ never sees your card or bank details. You can cancel at any time on Buy Me a Coffee: Plus stays on until the end of the month you paid for, and nothing more is charged.',
  'terms.membership.p3':
    'If a charge was a mistake, or Plus is not for you, ask within {refundDays} days of that charge and it is refunded in full, no questions asked.',
  'terms.membership.p4':
    'When a membership ends, the Plus looks and the scenes members made lock again and FluidEQ goes back to its free looks; nothing you made is deleted. Plus keeps working offline for up to {graceDays} days after the app last confirmed your membership. Nothing that is free is ever affected.',

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
  'terms.sent.looks.when':
    'When Plus looks are downloaded or updated, and when the app checks which shared scenes were taken down',
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
  'terms.sent.sceneExport.what':
    'A scene you export, with your display name and your account id',
  'terms.sent.sceneExport.when': 'When you press Export in the Studio',
  'terms.sent.sceneExport.who':
    'Nothing of the scene is kept. The maker keeps a record of which scene and version you exported, when, and a fingerprint, so a blocked scene can be recognised. Whoever you send the file to sees your display name and account id.',
  'terms.sent.sceneLike.what':
    'Which member’s scene is on screen, and your like on it',
  'terms.sent.sceneLike.when':
    'When a member’s scene plays, to show its likes, and when you press the heart or take a like back',
  'terms.sent.sceneLike.who':
    'Nothing about what is on screen is kept. Members see how many likes a scene has, never who gave them.',
  'terms.sent.scenePublish.what':
    'A scene you publish, its picture, the category you chose, your display name and your account id',
  'terms.sent.scenePublish.when': 'When you press Publish in the Studio',
  'terms.sent.scenePublish.who':
    'Every Plus member, in Visualizers, until you unpublish it: the scene, its picture, its category and your display name. The maker keeps the record that you published it, as for an export.',
  'terms.sent.gallery.what':
    'In Visualizers: what you search for, which scenes you open and add, and any scene you report with its reason',
  'terms.sent.gallery.when':
    'When you browse Visualizers, press Add, or send a report',
  'terms.sent.gallery.who':
    'Searches and what you open are not kept. Members see how many added a scene, never who. Reports: only the maker.',

  'terms.never.title': 'What never leaves your computer',
  'terms.never.p1':
    'Your audio, and anything about what you play: track names, artists, files, folders and playlists.',
  'terms.never.p2': 'Your EQ settings, presets and profiles.',
  'terms.never.p3':
    'Your audio devices and their names, and the other apps on your computer.',
  'terms.never.p4':
    'The scenes you make and your Studio folders, unless you export or publish a scene.',

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
  'terms.fair.p3':
    'Likes on your scenes earn {likePoints} points each. A like counts once per member per scene, only from Plus members, and never from your own account. Likes from a second account of your own count as climbing with more than one account.',

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
  'terms.keep.p5':
    'Scenes: a scene you publish stays in Visualizers until you unpublish it, which removes it and its picture at once. What you published, the record of what you exported, the scenes you added, the likes you gave and the likes your scenes received are deleted with your account. A scene blocked for breaking these terms keeps only its fingerprint, without your name, so it stays blocked.',

  'terms.looks.title': 'The Plus looks',
  'terms.looks.p1':
    'The Plus looks are the maker’s own work, licensed to you for personal use while you are a member. Please do not copy, share or resell them.',
  'terms.looks.p2':
    'FluidEQ itself stays free software under the GPL. Nothing here changes a right the GPL gives you.',

  'terms.scenes.title': 'Scenes you make',
  'terms.scenes.p1':
    'A scene you make in the Studio is yours. FluidEQ does not own it, and the GPL that covers FluidEQ does not cover it.',
  'terms.scenes.p2':
    'It stays on your computer until you choose to export it. Nothing you make is shared unless you share it.',
  'terms.scenes.p3':
    'When you export a scene, you let FluidEQ check it, remove the comments from its shader and sign it with your name, so other Plus members can play it and see that you made it. That is the whole permission. The maker will not sell your scene, use it in advertising, or make it one of the Plus looks without asking you first, and it does not stop you doing anything else with your own work.',
  'terms.scenes.p4':
    'Sharing is part of Plus, not a job: nobody is paid for a scene and nobody pays for one. What you get back is every scene the other members share.',
  'terms.scenes.p5':
    'Members who like your scene give you points on the leaderboard, if you have joined it. Likes are counted by the server; see Fair play.',
  'terms.scenes.p6':
    'Only share work you have the right to share: your own photos and drawings, or ones whose owner allows it. The community rules apply to scenes as they do to messages. The maker can stop a scene from opening if it breaks these terms or someone else’s rights.',
  'terms.scenes.p7':
    'A scene another member shares is their work, licensed to you for personal use while you are a member. You can play it, like it, and pass the file on unchanged to other Plus members. Please do not change it, present it as yours, publish it anywhere else, or sell it.',
  'terms.scenes.p8':
    'A file you have sent stays with whoever has it. If you want a scene to stop opening everywhere, ask the maker, who can block it the same way as a scene that breaks the rules.',
  'terms.scenes.p9':
    'If you publish a scene to Visualizers, you also let FluidEQ keep it there and show it — with its picture, its category and your display name — to Plus members until you unpublish it. You can unpublish it at any time, with or without Plus. Members who already added it keep their copy, under the same terms as a file you sent them.',
  'terms.scenes.p10':
    'Publishing is optional and separate from exporting a file. Any member can report a published scene; only the maker reads reports, and can take a scene down that breaks these terms or someone else’s rights.',

  'terms.changes.title': 'Changes, and the fine print',
  'terms.changes.p1':
    'If these terms change, the new version appears here with its date, and the app tells you before it applies to you.',
  'terms.changes.p2':
    'FluidEQ and Plus are provided as they are, without warranties, as far as the law allows. The maker is not liable for more than you paid for Plus in the last twelve months. Nothing here takes away the rights the law gives you as a consumer.',

  'terms.contact.title': 'Contact',
  'terms.contact.p1':
    'Questions, refunds, deleting your account, or reporting a scene that uses your work: {contact}.',

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
