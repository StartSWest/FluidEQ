/**
 * The FluidEQ terms: linked beside the credit packs before anybody pays, and
 * readable from the Account panel at any time.
 *
 * Written to be read rather than clicked past — short paragraphs, plain
 * words, and every piece of information the app sends listed with when it
 * goes and who can see it. The numbers are placeholders filled from
 * `common/plusTerms.ts` and the code that keeps them, so the text cannot
 * promise what the code does not do. Changing what this says means raising
 * PLUS_TERMS_VERSION, in every language at once.
 */
const terms = {
  'terms.eyebrow': 'FluidEQ account',
  'terms.title': 'Terms and privacy',
  'terms.meta': 'Version {version} · In effect since {date}',
  'terms.intro':
    'These terms cover your FluidEQ account: credits and the scenes you get with them, the old Plus membership for the members who still have it, Visualizers, the Studio, and the scenes you share. They list everything the app sends to FluidEQ’s service, when it goes and who can see it, and, near the end, every other place FluidEQ connects to.',
  'terms.introPayouts':
    'These terms cover your FluidEQ account: credits and the scenes you get with them, the old Plus membership for the members who still have it, Visualizers, the Studio, and the scenes you share and getting paid for them. They list everything the app sends to FluidEQ’s service, when it goes and who can see it, and, near the end, every other place FluidEQ connects to.',
  'terms.link': 'Terms and privacy',

  'terms.short.title': 'The short version',
  'terms.short.free.title': 'The equaliser, the rack and the players stay free',
  'terms.short.free.body':
    'FluidEQ keeps working offline and without an account, as it always has. The Studio and publishing are free too.',
  'terms.short.choice.title': 'You choose what is shared',
  'terms.short.choice.body':
    'Nothing you make leaves your computer unless you export or publish it.',
  'terms.short.music.title': 'Never your music',
  'terms.short.music.body':
    'FluidEQ’s service never receives your audio, your track names or your EQ.',

  'terms.membership.title': 'The old Plus membership',
  'terms.membership.p1':
    'Plus was a membership, and it is not sold any more: credits took its place. A membership already running keeps playing and adding every scene in Visualizers, FluidEQ’s own scenes, and scenes on your desktop and your RGB lights, until FluidEQ moves its members to credits. On that day every scene a member added becomes theirs for good, and every account that paid for Plus gets at least {moveCredits} credits. No new free trials are offered; a scene FluidEQ’s maker approves before that day can still earn a month of the membership. Without it, an account watches any scene for {tasteSeconds} seconds, gets scenes with credits, and makes, exports and publishes scenes in the Studio.',
  'terms.membership.p2':
    'Plus was paid through Buy Me a Coffee, under its own terms, and FluidEQ never saw your card or bank details. A membership you still pay for can be cancelled at any time on Buy Me a Coffee: it stays on until the end of the period you paid for, and nothing more is charged. Anything Buy Me a Coffee charges for it after FluidEQ moves its members to credits is refunded.',
  'terms.membership.p4':
    'When a membership ends, FluidEQ’s scenes and the scenes members made lock again — except the ones you own, the ones FluidEQ made free, and your own published scenes — and FluidEQ goes back to its free looks; nothing you made is deleted. Without a connection, a paid membership keeps working until the end of the period you paid for, and for up to {graceDays} days after it if the app could not confirm a renewal. A free trial, a gift and a month earned by publishing end on their own date, with no grace after them.',
  'terms.membership.p5':
    'Until that day, a gift from the maker to an email address works the same way as a membership: it turns on when an account confirms that address, and lasts until the end date the maker chose, if any, or until the maker takes it back.',

  'terms.account.title': 'Your account',
  'terms.account.p1':
    'An account is an email address, a password and, if you give one, a name, and you need to be at least {age} to create one. The password travels encrypted to the sign-in service and is stored there only as a one-way hash, which nobody can read back, the maker included.',
  'terms.account.p2':
    'Your email receives the codes that confirm your address and reset your password. It is never shown to other members: in Visualizers you appear by the handle and display name you choose.',
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
    'Only you and the maker. The service confirms a membership you already have, looks for a Buy Me a Coffee payment made with your confirmed email, and reads which version of these terms you agreed to, so the app can tell you when they change. The same token asks how a free trial or an earned month on this account stands.',
  'terms.sent.payment.what':
    'The email you pay with, your membership status and period, and Buy Me a Coffee’s ids for your membership, sent by Buy Me a Coffee',
  'terms.sent.payment.when': 'When you pay, renew or cancel',
  'terms.sent.payment.who':
    'The maker, to match the payment to your account. It is matched only to a confirmed email address, so pay with the email you sign in with.',
  'terms.sent.agreement.what':
    'Which version of these terms you agreed to, and when',
  'terms.sent.agreement.when':
    'When you continue to payment for credits, export a scene or publish one',
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
    'When FluidEQ starts, at most every few hours, to show which of FluidEQ’s scenes exist, with or without an account',
  'terms.sent.catalogue.who':
    'Nothing is kept. The request only fetches the public list of looks.',
  'terms.sent.profile.what': 'The handle and display name you choose',
  'terms.sent.profile.when':
    'When you choose or change them in the Account panel',
  'terms.sent.profile.who':
    'Every signed-in account: on the scenes you publish and on your maker page in Visualizers, where they can be searched. Names that pose as FluidEQ or its staff are refused.',
  'terms.sent.sceneExport.what':
    'A scene you export: its code, settings, pictures, 3D models and ambient elements',
  'terms.sent.sceneExport.when': 'When you press Export in the Studio',
  'terms.sent.sceneExport.who':
    'The service checks the scene, removes the comments from its code and signs it, adding your display name and account id to the file. It keeps a record of which scene and version you exported, when, and a fingerprint of the file. Whoever you send the file to sees your display name and account id; the scene plays for them once they own it.',
  'terms.sent.sceneLike.what':
    'Which member’s scene is on screen, and your like on it',
  'terms.sent.sceneLike.when':
    'When a member’s scene plays, to show its likes, and when you press the heart or take a like back',
  'terms.sent.sceneLike.who':
    'Your like is kept with your account. Members see how many likes a scene has, never who gave them.',
  'terms.sent.announcements.what':
    'Your sign-in token, to ask whether FluidEQ has announced new scenes',
  'terms.sent.announcements.when':
    'When FluidEQ starts, when you sign in and when you come back to the computer',
  'terms.sent.announcements.who':
    'Nothing is kept. Which announcements you have already seen stays on your computer.',
  'terms.sent.scenePublish.what':
    'A scene you publish, as for an export, with one cover picture, up to two categories and a note about what is new, if you write one',
  'terms.sent.scenePublish.when': 'When you press Publish in the Studio',
  'terms.sent.scenePublish.who':
    'Once FluidEQ’s maker approves it, in Visualizers, until you unpublish it, anyone signed in to FluidEQ sees its picture, name, categories, version notes, likes and adds, with your display name, handle and maker page, and can watch it for {tasteSeconds} seconds. Members who own it — got with a credit, or with a membership — play it and add it. FluidEQ’s maker keeps the scene and the record that you published it, as for an export.',
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
    'Your Studio projects, their photos, their 3D models and your notes, unless you export or publish a scene. The prompt you copy for your AI assistant goes only where you paste it.',
  'terms.never.p5':
    'What FluidEQ remembers on your computer to work: your desktop backgrounds and lighting, your Library — the folders you added, what it read from the files in them, and their cover pictures — the scene versions you have seen, and any scene that made your graphics driver reset.',

  'terms.protect.title': 'How it is protected',
  'terms.protect.p1': 'Every request is encrypted on its way.',
  'terms.protect.p2':
    'The rules live on the server, not in the app: each account can change only its own data, and a modified copy of FluidEQ gets exactly the same answers.',
  'terms.protect.p3':
    'Visualizers shows handles and display names, never email addresses. Account ids are never shown, but they are inside scene files and in what Visualizers sends to the app.',
  'terms.protect.p4':
    'The maker runs the service and can see what it stores, to keep it working, to match payments and to moderate what members publish. Nothing is sold or used for advertising, and there is no tracking or analytics.',
  'terms.protect.p5':
    'The service runs on Supabase (sign-in, database and files) and sends email through Resend; credits are paid through Stripe, the old membership through Buy Me a Coffee, and the Forum goes through GitHub. Each receives only what its part needs.',
  'terms.protect.p5Payouts':
    'The service runs on Supabase (sign-in, database and files) and sends email through Resend; credits are paid through Stripe, which also pays creators, the old membership through Buy Me a Coffee, and the Forum goes through GitHub. Each receives only what its part needs.',
  'terms.protect.p6':
    'FluidEQ keeps no IP addresses. Supabase records the address of each request in short-lived logs, and keeps the address and app details of each signed-in computer with that computer’s session and in Supabase’s own sign-in security log, to keep sign-in working and safe.',
  'terms.protect.p7':
    'Scenes are signed, and your computer checks the signature before playing one. An app update installs only after FluidEQ’s own signature on it has been checked.',

  'terms.rules.title': 'Rules for what you publish',
  'terms.rules.p1':
    'Be kind. No harassment, hate, threats, spam, illegal content, or anyone’s personal information — in a scene, its name, its picture or its note. Everyone signed in can see what you publish, so share only what you are happy to have seen.',
  'terms.rules.p2':
    'Take ideas from FluidEQ’s scenes, but make your own: a scene that is mostly a copy of one of them is refused when you export or publish it.',
  'terms.rules.p3':
    'You can unpublish your own scenes at any time. Anyone signed in can report a published scene. FluidEQ’s maker can take a scene down, which stops it opening everywhere, marks it as taken down in your scenes and pauses your exporting and publishing for {takedownDays} days, and can ban an account, which hides its scenes and stops it publishing, liking and reporting.',
  'terms.rules.p4':
    'To keep the service working for everyone, an account can export or publish up to {sharesPerHour} scenes an hour, refused attempts included, and keep up to {maxPublished} scenes published. A scene you publish, and each new version of it, waits for FluidEQ’s maker to read it before anyone else sees it; there is a limit on how many you can send for review in a calendar month, and the Studio says when you have reached it.',

  'terms.keep.title': 'What is kept, and how to delete it',
  'terms.keep.p2':
    'Your handle and display name: kept while you have an account, and deleted with it.',
  'terms.keep.p3':
    'Membership: your payment email, status and Buy Me a Coffee’s ids for your membership are kept to match payments to your account, and are deleted with it. The record of each payment event keeps only Buy Me a Coffee’s ids and the time.',
  'terms.keep.p4':
    'Your account: ask for it to be deleted and it is gone within {deletionDays} days, together with your profile, credits, the scenes you own, membership, free trials and earned months, agreements, likes, adds, reports, and the scenes you published with their files. Credits left on an account that is deleted are gone with it. A gift to your email stays until the maker removes it.',
  'terms.keep.p5':
    'Scenes: unpublishing removes a scene from Visualizers with its picture, file and version history. Likes, adds and reports on it stay until those accounts are deleted, and count again if you publish it once more. A scene blocked for breaking these terms keeps a fingerprint made from your account id and the scene’s id, with the reason and the date, so it stays blocked.',
  'terms.keep.p6':
    'On your computer: FluidEQ’s scenes and the scenes you added, encrypted; your credits and the scenes you own, encrypted; gallery pictures, up to 128 MB; and the list of blocked scenes. They stay until you remove them or uninstall FluidEQ.',

  'terms.looks.title': 'FluidEQ’s own scenes',
  'terms.looks.p1':
    'FluidEQ’s own scenes are the maker’s own work, licensed to you for personal use while you are a member, or for good once you own one — got with a credit or made free. Please do not copy, share or resell them.',
  'terms.looks.p2':
    'If you own one of FluidEQ’s own scenes, you can open it in the Studio to look inside and take ideas. A copy opened that way cannot be added to your looks, exported or published.',
  'terms.looks.p3':
    'FluidEQ itself stays free software under the GPL. Nothing here changes a right the GPL gives you.',

  'terms.scenes.title': 'Scenes you make',
  'terms.scenes.p1':
    'A scene you make in the Studio is yours. FluidEQ does not own it, and the GPL that covers FluidEQ does not cover it.',
  'terms.scenes.p2':
    'Your Studio scenes stay on your computer unless you export or publish them, or choose to share them with another tool, such as your AI assistant.',
  'terms.scenes.p3':
    'When you export a scene, you let FluidEQ check it — including against FluidEQ’s own scenes — remove the comments from its code and sign it with your display name and account id, so other members who own it can play it and see that you made it. That is the whole permission: FluidEQ’s maker will not sell your scene or use it in advertising, will not make it one of FluidEQ’s own scenes without asking you first, and does not stop you doing anything else with your own work.',
  'terms.scenes.p4':
    'When an account gets a scene of yours with a credit from a pack it paid for, you earn half a credit, and every two halves are one credit — credit to get scenes with, never cash. A scene got with a free credit, or with one earned from scenes, earns nothing. And, until FluidEQ moves its members to credits, a scene of yours that FluidEQ’s maker approves earns you a month of the membership.',
  'terms.scenes.p4Payouts':
    'When an account gets a scene of yours with a credit from a pack it paid for, you earn from it: once you have set up payouts in the Account panel, money, under the creator terms in Getting paid for your scenes; until then, or where Stripe cannot pay you, half a credit, and every two halves are one credit — credit to get scenes with, never cash. A scene got with a free credit, or with one earned from scenes, earns nothing. And, until FluidEQ moves its members to credits, a scene of yours that FluidEQ’s maker approves earns you a month of the membership.',
  'terms.scenes.p6':
    'Only share work you have the right to share: your own photos, drawings and 3D models, or ones whose owner allows it. The rules for what you publish apply to every scene you share. FluidEQ’s maker can stop a scene from opening if it breaks these terms or someone else’s rights.',
  'terms.scenes.p7':
    'A scene another member shares is their work, licensed to you for personal use for as long as you own it — for good, once you got it with a credit — or while you have a membership. You can play it, like it, and pass the file on unchanged; it plays for others only once they own it. Please do not change it, present it as yours, publish it anywhere else, or sell it.',
  'terms.scenes.p8':
    'A file you have sent stays with whoever has it, and unpublishing does not take back copies members already got; they stay licensed for personal use while those members own them. If you want a scene to stop opening everywhere, ask FluidEQ’s maker, who can block it the same way as a scene that breaks the rules.',
  'terms.scenes.p9':
    'If you publish a scene to Visualizers, you also let FluidEQ’s maker read it before anyone else sees it, and let FluidEQ keep it there until you unpublish it, show its picture, name, categories and version notes with your display name and handle to anyone signed in to FluidEQ, let them watch it for {tasteSeconds} seconds, and let members get it with a credit, or play it with a membership. The ambient elements you give it travel with it, and members who choose Ambient mode see them around their window. You can unpublish it at any time.',
  'terms.scenes.p10':
    'Publishing is optional and separate from exporting a file. A version note is public like the scene it belongs to.',

  'terms.elsewhere.title': 'Where else FluidEQ connects',
  'terms.elsewhere.p1':
    'Updates: when it starts and when you come back to the computer, FluidEQ checks its release feed for a new version, and installs one only after checking its signature. The request carries a random number the updater keeps on this computer, and nothing about you.',
  'terms.elsewhere.p2':
    'Headphone presets: when FluidEQ opens, it checks GitHub for new headphone presets, and the Convolution tab downloads AutoEq files from GitHub when you open it or choose a headphone.',
  'terms.elsewhere.p10':
    'The “First steps with FluidEQ” video in the User guide: nothing is fetched until you press play; then the video and its English captions stream from fluideq.com, FluidEQ’s own site. The request carries no cookie and nothing about you or your account, and the site keeps no record of it. If it cannot play, “Open on fluideq.com” shows it in your browser instead. The short films on What’s new slides come from fluideq.com in the same way, starting by themselves when a slide opens: no cookie, nothing about you or your account, and no record kept. Without a connection, a slide shows its drawing instead.',
  'terms.elsewhere.p3':
    'Models you use: the Karaoke Maker downloads its speech, vocal and melody models from Hugging Face, and the voice denoiser its model from GitHub. Your audio is processed on your computer.',
  'terms.elsewhere.p9':
    'Your AI assistant: only while “Let your AI see the stage” is on in the Studio (copying the prompt for your AI turns it on, unless you turned it off yourself), an AI tool on this computer that has your key can ask FluidEQ for pictures of your Studio scenes, with FluidEQ’s reasons when one cannot play, and for numbers describing how the music you play moves — never the sound itself, and never which song it is. What that tool does with them is under its own terms.',
  'terms.elsewhere.p4':
    'Share Audio: the audio, what is playing and this computer’s name go only to the computer you pair with on your local network, encrypted. This computer’s name is also announced on that network, so the other computer can find it.',
  'terms.elsewhere.p5':
    'Online Media: YouTube, Bandcamp, Twitch and the other sites you open inside FluidEQ receive what you do there, under their own terms.',
  'terms.elsewhere.p6':
    'Report a problem: opens a public GitHub issue in your browser or a private email to FluidEQ’s maker in your mail app, or copies the report for you, with recent log lines you can read before you send it. FluidEQ sends nothing itself.',
  'terms.elsewhere.p7':
    'Lighting and desktop backgrounds: lighting talks only to Razer Chroma and Windows on this computer, and desktop backgrounds never go online.',
  'terms.elsewhere.p8':
    'Your browser: payment for credits on Stripe and for the old membership on Buy Me a Coffee, your membership page, the support links and the Forum’s GitHub sign-in open there, under those sites’ own terms.',
  'terms.elsewhere.p8Payouts':
    'Your browser: payment for credits on Stripe and for the old membership on Buy Me a Coffee, Stripe’s sign-up and dashboard for creator payouts, your membership page, the support links and the Forum’s GitHub sign-in open there, under those sites’ own terms.',

  'terms.changes.title': 'Changes, and the fine print',
  'terms.changes.p1':
    'If these terms change, the new version appears here with its date, and the app tells you before it applies to you.',
  'terms.changes.p2':
    'FluidEQ, the membership and credits are provided as they are, without warranties, as far as the law allows. The maker is not liable for more than you paid for the membership and credits in the last twelve months. Nothing here takes away the rights the law gives you as a consumer.',

  'terms.contact.title': 'Contact',
  'terms.contact.p1':
    'Questions, deleting your account, or reporting a scene that uses your work: {contact}.',

  'terms.back': 'Back',
  'terms.short.credits.title': 'A scene is yours for good',
  'terms.short.credits.body':
    'One credit each, from packs you pay for once on Stripe. Nothing renews, and FluidEQ never sees your card.',
  'terms.credits.title': 'Credits and your scenes',
  'terms.credits.p1':
    'A credit gets you one scene from Visualizers — one of FluidEQ’s or one a member published — and the scene is then yours for good: on the graph, your desktop and your lights, on every computer you sign in to, with every new version its maker publishes. Before you get one, any scene plays on its page for {tasteSeconds} seconds. FluidEQ asks before it spends a credit, and a credit spent cannot be taken back.',
  'terms.credits.p2':
    'Credits come in packs, paid once on Stripe, under its own terms. FluidEQ never sees your card or bank details, and nothing renews. A confirmed account gets {starterCredits} credits once, free. Credits have no cash value, cannot be sold or moved to another account, and buy scenes and nothing else.',
  'terms.credits.p3':
    'If a payment for a pack is refunded in full or disputed, the pack’s credits are taken back, even ones you already spent: your balance can go below zero, and no scene can be got until a new pack brings it back up. Scenes you already have stay yours.',
  'terms.credits.p4':
    'Scenes you make are yours to play for free once they are published: after FluidEQ’s maker approves one and it is in Visualizers, it plays everywhere for you. Until then it is a draft, and plays only on the Studio’s stage, marked as a draft. A scene another member makes is never free for you; you get it with a credit like any other.',
  'terms.credits.p5':
    'FluidEQ’s maker can make some of FluidEQ’s own scenes free for every account, and make one paid again. While a scene is free it plays for everyone signed in; once it is paid again, it stays yours only if you got it with a credit.',
  'terms.credits.p6':
    'A scene its maker unpublishes cannot be got by anyone new; if you already had it, it keeps playing for you. A scene taken down for breaking these terms stops opening everywhere, as the rules for what you publish say.',
  'terms.sent.store.what':
    'Your sign-in token, to read your credits, the scenes you own, which of your own scenes are published and which of FluidEQ’s scenes are free',
  'terms.sent.store.when':
    'When the app starts, when you sign in, when you come back to the computer (at most every few hours, and every time while a payment you started is not in yet), and when you open your credits or get a scene',
  'terms.sent.store.who':
    'Only you and the maker. Your computer keeps the answer encrypted, so the scenes you own play without a connection.',
  'terms.sent.credits.what':
    'The pack you choose and the terms version you agreed to, and then, from Stripe: the email you pay with, the amount, the pack, and Stripe’s ids for the payment',
  'terms.sent.credits.when':
    'When you choose a pack and continue to payment, and when Stripe confirms, refunds or disputes that payment',
  'terms.sent.credits.who':
    'The maker, to give the pack’s credits to your account, and to take them back if the payment is refunded or disputed. Your card goes only to Stripe.',
  'terms.sent.sceneGet.what':
    'Which scene you get with a credit, and the starter credits when you take them',
  'terms.sent.sceneGet.when':
    'When you confirm getting a scene, and when you take the starter credits',
  'terms.sent.sceneGet.who':
    'Kept with your account, so the scene stays yours. When it was got with a paid credit, the maker of a member’s scene earns half a credit from it, and never learns who got it.',
  'terms.sent.sceneGet.whoPayouts':
    'Kept with your account, so the scene stays yours. When it was got with a paid credit, the maker of a member’s scene earns from it — money once Stripe can pay them, half a credit until then — and never learns who got it.',
  'terms.keep.p7':
    'Credits: each pack you paid for, each credit you spent and each scene you own are kept with your account, so your scenes stay yours on every computer; Stripe’s ids for each payment are kept to give its credits and to take them back after a refund. All of it is deleted with your account.',
  'terms.scenes.p11':
    'Until a scene of yours is published, it plays only on the Studio’s stage, marked as a draft. Once it is in Visualizers, it plays for you everywhere, for free.',
  'terms.credits.p7':
    'Credits you have not spent are refunded if you ask within {refundDays} days of buying their pack: write to {contact}. Only those credits are taken back; a credit already spent is not refunded, and the scenes you got stay yours.',
  'terms.payouts.title': 'Getting paid for your scenes',
  'terms.payouts.p1':
    'A member who publishes scenes can be paid for them through Stripe, by setting up payouts in the Account panel. Stripe pays creators in the US, the UK, Canada, Switzerland and the European Economic Area; anywhere else, each sale earns half a credit instead, and every two make one. These are the creator terms you accept before Stripe’s page opens:',
  'terms.sent.payouts.what':
    'Your sign-in token, to read where your payouts stand; if you set up payouts, the country you live in and which version of the creator terms you accepted; and then, from Stripe, your Stripe account’s id and whether Stripe can pay you',
  'terms.sent.payouts.when':
    'When you open the Account panel, when you press Set up payouts, Finish setting up or Check again, and when you come back from Stripe’s page; Stripe tells FluidEQ’s service when your account there changes',
  'terms.sent.payouts.who':
    'Only you and the maker. You see what is held, ready to pay and paid, never who bought; the maker sees what each creator is owed, to pay it. Your identity, bank and tax details go only to Stripe.',
  'terms.keep.p8':
    'Payouts: your Stripe account’s id, your country, the version of the creator terms you accepted, each sale your scenes earned and each payout are kept to pay you and to account for the payments, and are deleted with your account. When a buyer’s account is deleted, the sales it made stay in the creator’s earnings, without the buyer. What Stripe keeps is under its own terms.',
} as const;

export default terms;
