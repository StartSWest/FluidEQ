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
  'terms.title': 'Terms and privacy of Plus',
  'terms.meta': 'Version {version} · In effect since {date}',
  'terms.intro':
    'These terms cover your FluidEQ account and Plus: membership, payments, Visualizers, the scenes you share and the leaderboard. They list everything the app sends to FluidEQ’s service, when it goes and who can see it, and, near the end, every other place FluidEQ connects to.',
  'terms.link': 'Terms and privacy of Plus',

  'terms.short.title': 'The short version',
  'terms.short.price.title': '{price}, cancel any time',
  'terms.short.price.body':
    'Paid on Buy Me a Coffee. FluidEQ never sees your card.',
  'terms.short.free.title': 'Nothing free is taken away',
  'terms.short.free.body':
    'FluidEQ keeps working offline and without an account, as it always has.',
  'terms.short.choice.title': 'You choose what is shared',
  'terms.short.choice.body':
    'The leaderboard is off unless you join, and nothing you make leaves your computer unless you export or publish it.',
  'terms.short.music.title': 'Never your music',
  'terms.short.music.body':
    'FluidEQ’s service never receives your audio, your track names or your EQ.',

  'terms.membership.title': 'The membership',
  'terms.membership.p1':
    'With a free account you can browse Visualizers, see every published scene’s picture and details, try each of FluidEQ’s free sample scenes for {tasteSeconds} seconds and see the leaderboard. Plus plays and adds every scene, unlocks the Plus looks, lets you make scenes in the Studio and export or publish them, lets you join the leaderboard, and puts scenes on your desktop and your RGB lights. It costs {price}, and renews at the end of each period you paid for until you cancel.',
  'terms.membership.p2':
    'Payment is handled by Buy Me a Coffee, under its own terms. FluidEQ never sees your card or bank details. You can cancel at any time on Buy Me a Coffee: Plus stays on until the end of the period you paid for, and nothing more is charged.',
  'terms.membership.p4':
    'When a membership ends, the Plus looks and the scenes members made lock again and FluidEQ goes back to its free looks; nothing you made is deleted. Without a connection, Plus keeps working until the end of the period you paid for, and for up to {graceDays} days after it if the app could not confirm a renewal. Nothing that is free is ever affected.',
  'terms.membership.p5':
    'The maker can give Plus to an email address as a gift. It turns on when an account confirms that address, and lasts until the end date the maker chose, if any, or until the maker takes it back.',

  'terms.account.title': 'Your account',
  'terms.account.p1':
    'An account is an email address, a password and, if you give one, a name, and you need to be at least {age} to create one. The password travels encrypted to the sign-in service and is stored there only as a one-way hash, which nobody can read back, the maker included.',
  'terms.account.p2':
    'Your email receives the codes that confirm your address and reset your password. It is never shown to other members: on the leaderboard and in Visualizers you appear by the handle and display name you choose.',
  'terms.account.p3':
    'On your computer, the app keeps your session encrypted by the operating system. Accounts are personal, so keep your password to yourself.',
  'terms.account.p4':
    'An account stays signed in on up to {computers} computers at a time — at home and at work, or the computers Share Audio plays between. Signing in on one more signs out the computer used least recently, within the hour.',

  'terms.sent.title': 'What the app sends, and when',
  'terms.sent.intro':
    'Everything the app sends to FluidEQ’s service, always over an encrypted connection. The other places FluidEQ connects to are listed further down.',
  'terms.sent.when': 'When',
  'terms.sent.who': 'Who can see it',
  'terms.sent.signIn.what':
    'Your email and password, and the name you give when you sign up',
  'terms.sent.signIn.when':
    'When you create an account, sign in, confirm your address or reset your password',
  'terms.sent.signIn.who':
    'The sign-in service keeps your email and name, and the password only as a hash nobody can read.',
  'terms.sent.membership.what': 'Your sign-in token and account id',
  'terms.sent.membership.when':
    'When the app starts, when you sign in, when you come back to the computer (at most every few hours), and when you press Check again',
  'terms.sent.membership.who':
    'Only you and the maker. The service confirms your membership, looks for a Buy Me a Coffee payment made with your confirmed email, and reads which version of these terms you agreed to, so the app can tell you when they change.',
  'terms.sent.payment.what':
    'The email you pay with, your membership status and period, and Buy Me a Coffee’s ids for your membership, sent by Buy Me a Coffee',
  'terms.sent.payment.when': 'When you pay, renew or cancel',
  'terms.sent.payment.who':
    'The maker, to match the payment to your account. It is matched only to a confirmed email address, so pay with the email you sign in with.',
  'terms.sent.agreement.what':
    'Which version of these terms you agreed to, and when',
  'terms.sent.agreement.when':
    'When you continue to payment, export a scene or publish one',
  'terms.sent.agreement.who':
    'The maker. It is kept with your account, even if you do not go on to pay.',
  'terms.sent.looks.what':
    'Your sign-in token, and the ids of the FluidEQ scenes you have installed that have a new version, to download them',
  'terms.sent.looks.when':
    'When the app starts, when you come back to the computer and when you open the list of looks, to fetch new versions and to learn which shared scenes were taken down',
  'terms.sent.looks.who':
    'Nothing is kept. Every look is signed, and your computer checks the signature before playing it.',
  'terms.sent.catalogue.what': 'Nothing about you',
  'terms.sent.catalogue.when':
    'When FluidEQ starts, at most every few hours, to show which Plus looks exist, with or without an account',
  'terms.sent.catalogue.who':
    'Nothing is kept. The request only fetches the public list of looks.',
  'terms.sent.profile.what': 'The handle and display name you choose',
  'terms.sent.profile.when': 'When you choose them on the leaderboard',
  'terms.sent.profile.who':
    'Every signed-in account: on the leaderboard, on the scenes you publish and on your maker page in Visualizers, where they can be searched. Names that pose as FluidEQ or its staff are refused.',
  'terms.sent.board.what':
    'One number per day from each of your computers: the whole minutes of music that played, up to {capHours} hours, with its date and a random number that tells your computers apart',
  'terms.sent.board.when':
    'Only if you join the leaderboard: when you join, when you come back to the computer at most every {uploadHours} hours, and when you open the board or a maker’s page in Visualizers',
  'terms.sent.board.who':
    'Your handle, display name, rank, points and what they are made of: every signed-in account, on the board and on your maker page.',
  'terms.sent.sceneExport.what':
    'A scene you export: its code, settings, pictures and ambient elements',
  'terms.sent.sceneExport.when': 'When you press Export in the Studio',
  'terms.sent.sceneExport.who':
    'The service checks the scene, removes the comments from its code and signs it, adding your display name and account id to the file. It keeps a record of which scene and version you exported, when, and a fingerprint of the file. Whoever you send the file to sees your display name and account id.',
  'terms.sent.sceneLike.what':
    'Which member’s scene is on screen, and your like on it',
  'terms.sent.sceneLike.when':
    'When a member’s scene plays, to show its likes, and when you press the heart or take a like back',
  'terms.sent.sceneLike.who':
    'Your like is kept with your account. Members see how many likes a scene has, never who gave them. Nothing else about what is on screen is kept.',
  'terms.sent.scenePublish.what':
    'A scene you publish, as for an export, with one cover picture, up to two categories and a note about what is new, if you write one',
  'terms.sent.scenePublish.when': 'When you press Publish in the Studio',
  'terms.sent.scenePublish.who':
    'In Visualizers, until you unpublish it, anyone signed in to FluidEQ sees its picture, name, categories, version notes, likes and adds, with your display name, handle and maker page. Only Plus members can play the scene and add it. FluidEQ’s maker keeps the scene and the record that you published it, as for an export.',
  'terms.sent.gallery.what':
    'In Visualizers: what you search for, the scenes and makers you open, the scenes you add, and any scene you report with its reason',
  'terms.sent.gallery.when':
    'When you browse Visualizers or press Add or Report, and when the app looks for new versions of the scenes you added by asking for their makers’ scenes',
  'terms.sent.gallery.who':
    'Searches and what you open are not kept. An add is kept with your account; members see how many added a scene, never who. A report is kept with your account and a fingerprint of the scene as it was; FluidEQ’s maker sees how many reports a scene has and why, never who sent them.',
  'terms.sent.forum.what':
    'In the Forum: your GitHub sign-in, and then what you read, search, preview, post, edit or react to',
  'terms.sent.forum.when':
    'Opening the Forum downloads its public topics from GitHub, which carries nothing about you; the rest only after you sign in with GitHub',
  'terms.sent.forum.who':
    'GitHub, under its own terms; posts are public in the project’s GitHub Discussions. Signing in, staying signed in and signing out pass your GitHub sign-in through FluidEQ’s service, which adds FluidEQ’s key and keeps nothing.',

  'terms.never.title': 'What FluidEQ’s service never receives',
  'terms.never.p1':
    'Your audio, and anything about what you play: track names, artists, files, folders and playlists.',
  'terms.never.p2': 'Your EQ settings, presets and profiles.',
  'terms.never.p3':
    'Your audio devices, monitors and RGB lights, their names, and the other apps on your computer.',
  'terms.never.p4':
    'Your Studio projects, their photos and your notes, unless you export or publish a scene. The prompt you copy for your AI assistant goes only where you paste it.',
  'terms.never.p5':
    'What FluidEQ remembers on your computer to work: your desktop backgrounds and lighting, the scene versions you have seen, and any scene that made your graphics driver reset.',

  'terms.protect.title': 'How it is protected',
  'terms.protect.p1': 'Every request is encrypted on its way.',
  'terms.protect.p2':
    'The rules live on the server, not in the app: each account can change only its own data, and a modified copy of FluidEQ gets exactly the same answers.',
  'terms.protect.p3':
    'The board and Visualizers show handles and display names, never email addresses. Account ids are never shown, but they are inside scene files and in what Visualizers sends to the app.',
  'terms.protect.p4':
    'The maker runs the service and can see what it stores, to keep it working, to match payments and to moderate what members publish. Nothing is sold or used for advertising, and there is no tracking or analytics.',
  'terms.protect.p5':
    'The service runs on Supabase (sign-in, database and files) and sends email through Resend; payments go through Buy Me a Coffee, and the Forum through GitHub. Each receives only what its part needs.',
  'terms.protect.p6':
    'FluidEQ keeps no IP addresses. Supabase records the address of each request in short-lived logs, and keeps the address and app details of each signed-in computer with that computer’s session and in Supabase’s own sign-in security log, to keep sign-in working and safe.',
  'terms.protect.p7':
    'Scenes are signed, and your computer checks the signature before playing one. An app update installs only after FluidEQ’s own signature on it has been checked.',

  'terms.fair.title': 'Fair play on the leaderboard',
  'terms.fair.p1':
    'Points come from listening and likes: {hourPoints} for each hour of music, {dayPoints} for each day with at least {activeMinutes} minutes of it, and {likePoints} for each like on your scenes. The board shows the top 100, and ranks an account only while it has Plus; its days are kept and count again when Plus returns.',
  'terms.fair.p2':
    'Listening time is counted by the app on your computer, so the server cannot watch it happen. It checks every number instead: no more than {capHours} hours in a day, no day that has not begun, nothing older than {windowDays} days, and no day that grows faster than the clock. Your computers’ numbers add up to one day, and that day too grows no faster than the clock, so several playing at once cannot add up to more time than has passed.',
  'terms.fair.p3':
    'Everyone earns points the same way, the maker included. Changing the app or what it sends, automating listening, or climbing with more than one account takes you off the board, and can stop the account from publishing, liking and reporting scenes.',
  'terms.fair.p4':
    'A like counts once per member per scene, only when a Plus member gives it, and never from your own account. Likes on a scene that was taken down, or from an account that was banned, do not count. Likes from a second account of your own count as climbing with more than one account.',

  'terms.rules.title': 'Rules for what you publish',
  'terms.rules.p1':
    'Be kind. No harassment, hate, threats, spam, illegal content, or anyone’s personal information — in a scene, its name, its picture or its note. Everyone signed in can see what you publish, so share only what you are happy to have seen.',
  'terms.rules.p2':
    'Take ideas from FluidEQ’s scenes, but make your own: a scene that is mostly a copy of one of them is refused when you export or publish it.',
  'terms.rules.p3':
    'You can unpublish your own scenes at any time. Anyone signed in can report a published scene. FluidEQ’s maker can take a scene down, which stops it opening everywhere, marks it as taken down in your scenes and pauses your exporting and publishing for {takedownDays} days, and can ban an account, which hides its scenes and stops it publishing, liking and reporting.',
  'terms.rules.p4':
    'To keep the service working for everyone, an account can export or publish up to {sharesPerHour} scenes an hour, refused attempts included, and keep up to {maxPublished} scenes published.',

  'terms.keep.title': 'What is kept, and how to delete it',
  'terms.keep.p1':
    'Leaderboard: the days you send stay on the board until you remove them. “Remove all my data” in the Account panel deletes every day you ever sent, at once; leaving the board only stops sending. Your computer keeps only the last {windowDays} days of totals.',
  'terms.keep.p2':
    'Your handle and display name: kept while you have an account, and deleted with it.',
  'terms.keep.p3':
    'Membership: your payment email, status and Buy Me a Coffee’s ids for your membership are kept to match payments to your account, and are deleted with it. The record of each payment event keeps only Buy Me a Coffee’s ids and the time.',
  'terms.keep.p4':
    'Your account: ask for it to be deleted and it is gone within {deletionDays} days, together with your profile, leaderboard days, membership, agreements, likes, adds, reports, and the scenes you published with their files. A gift of Plus to your email stays until the maker removes it.',
  'terms.keep.p5':
    'Scenes: unpublishing removes a scene from Visualizers with its picture, file and version history. Likes, adds and reports on it stay until those accounts are deleted, and count again if you publish it once more. A scene blocked for breaking these terms keeps a fingerprint made from your account id and the scene’s id, with the reason and the date, so it stays blocked.',
  'terms.keep.p6':
    'On your computer: the Plus looks and the scenes you added, encrypted; gallery pictures, up to 128 MB; and the list of blocked scenes. They stay until you remove them or uninstall FluidEQ.',

  'terms.looks.title': 'The Plus looks',
  'terms.looks.p1':
    'The Plus looks are the maker’s own work, licensed to you for personal use while you are a member. Please do not copy, share or resell them.',
  'terms.looks.p2':
    'Plus members can open FluidEQ’s own scenes in the Studio to look inside and take ideas. A copy opened that way cannot be added to your looks, exported or published.',
  'terms.looks.p3':
    'FluidEQ itself stays free software under the GPL. Nothing here changes a right the GPL gives you.',

  'terms.scenes.title': 'Scenes you make',
  'terms.scenes.p1':
    'A scene you make in the Studio is yours. FluidEQ does not own it, and the GPL that covers FluidEQ does not cover it.',
  'terms.scenes.p2':
    'Your Studio scenes stay on your computer unless you export or publish them, or choose to share them with another tool, such as your AI assistant.',
  'terms.scenes.p3':
    'When you export a scene, you let FluidEQ check it — including against FluidEQ’s own scenes — remove the comments from its code and sign it with your display name and account id, so other Plus members can play it and see that you made it. That is the whole permission: FluidEQ’s maker will not sell your scene or use it in advertising, will not make it one of the Plus looks without asking you first, and does not stop you doing anything else with your own work.',
  'terms.scenes.p4':
    'Sharing is part of Plus, not a job: nobody is paid for a scene and nobody pays for one. What you get back is every scene the other members share.',
  'terms.scenes.p5':
    'Members who like your scene give you points on the leaderboard, if you have joined it. Likes are counted by the server; see Fair play.',
  'terms.scenes.p6':
    'Only share work you have the right to share: your own photos and drawings, or ones whose owner allows it. The rules for what you publish apply to every scene you share. FluidEQ’s maker can stop a scene from opening if it breaks these terms or someone else’s rights.',
  'terms.scenes.p7':
    'A scene another member shares is their work, licensed to you for personal use while you are a member. You can play it, like it, and pass the file on unchanged to other Plus members. Please do not change it, present it as yours, publish it anywhere else, or sell it.',
  'terms.scenes.p8':
    'A file you have sent stays with whoever has it, and unpublishing does not take back copies members already added; they stay licensed for personal use while those members have Plus. If you want a scene to stop opening everywhere, ask FluidEQ’s maker, who can block it the same way as a scene that breaks the rules.',
  'terms.scenes.p9':
    'If you publish a scene to Visualizers, you also let FluidEQ keep it there until you unpublish it, show its picture, name, categories and version notes with your display name and handle to anyone signed in to FluidEQ, and offer the scene itself to Plus members, who can play it and add it. The ambient elements you give it travel with it, and members who choose Ambient mode see them around their window. You can unpublish it at any time, with or without Plus.',
  'terms.scenes.p10':
    'Publishing is optional and separate from exporting a file. A version note is public like the scene it belongs to.',

  'terms.elsewhere.title': 'Where else FluidEQ connects',
  'terms.elsewhere.p1':
    'Updates: when it starts and when you come back to the computer, FluidEQ checks its release feed for a new version, and installs one only after checking its signature. The request carries a random number the updater keeps on this computer, and nothing about you.',
  'terms.elsewhere.p2':
    'Headphone presets: when FluidEQ opens, it checks GitHub for new headphone presets, and the Convolution tab downloads AutoEq files from GitHub when you open it or choose a headphone.',
  'terms.elsewhere.p3':
    'Models you use: the Karaoke Maker downloads its speech, vocal and melody models from Hugging Face, and the voice denoiser its model from GitHub. Your audio is processed on your computer.',
  'terms.elsewhere.p4':
    'Share Audio: the audio, what is playing and this computer’s name go only to the computer you pair with on your local network, encrypted. This computer’s name is also announced on that network, so the other computer can find it.',
  'terms.elsewhere.p5':
    'Online Media: YouTube, Bandcamp, Twitch and the other sites you open inside FluidEQ receive what you do there, under their own terms.',
  'terms.elsewhere.p6':
    'Report a problem: opens a public GitHub issue in your browser or a private email to FluidEQ’s maker in your mail app, or copies the report for you, with recent log lines you can read before you send it. FluidEQ sends nothing itself.',
  'terms.elsewhere.p7':
    'Lighting and desktop backgrounds: lighting talks only to Razer Chroma and Windows on this computer, and desktop backgrounds never go online.',
  'terms.elsewhere.p8':
    'Your browser: payment, your membership page, the support links and the Forum’s GitHub sign-in open there, under those sites’ own terms.',

  'terms.changes.title': 'Changes, and the fine print',
  'terms.changes.p1':
    'If these terms change, the new version appears here with its date, and the app tells you before it applies to you.',
  'terms.changes.p2':
    'FluidEQ and Plus are provided as they are, without warranties, as far as the law allows. The maker is not liable for more than you paid for Plus in the last twelve months. Nothing here takes away the rights the law gives you as a consumer.',

  'terms.contact.title': 'Contact',
  'terms.contact.p1':
    'Questions, deleting your account, or reporting a scene that uses your work: {contact}.',

  'terms.agree.check':
    'I have read these terms, including what the app sends, and I agree to them.',
  'terms.agree.continue': 'Agree and continue to payment',
  'terms.agree.opening': 'Opening Buy Me a Coffee…',
  'terms.agree.hint':
    'Payment opens in your browser. Use the same email as your FluidEQ account.',
  'terms.back': 'Back',
  'terms.error.outdated':
    'These terms have changed. Update FluidEQ to read the new version before subscribing.',
  // The prices this copy of the app shows are not the ones being charged.
  'terms.error.priceOutdated':
    'The price has changed. Update FluidEQ to see the current price before subscribing.',
} as const;

export default terms;
