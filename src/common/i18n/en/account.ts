/**
 * The optional account.
 *
 * Every string here has to carry one idea before any other: nothing about
 * FluidEQ changes if you never sign in. The app has promised for its whole life
 * that it is local and account-free, and that promise is still true for anybody
 * who does not want one — so the panel says so first, rather than treating the
 * signed-out state as something to be fixed.
 */
const account = {
  'account.validation.passwordRequired': 'Enter your password.',
  'account.validation.passwordShort': 'Use at least {count} characters.',
  'account.validation.passwordLong': 'Use no more than 128 characters.',
  'account.validation.nameLong': 'Use no more than 80 characters.',
  'account.validation.code': 'Enter the six-digit code.',
  'account.menu': 'Account',
  'account.eyebrow': 'FluidEQ',
  'account.title': 'Account',
  'account.checking': 'Checking your account…',
  'account.close': 'Close',

  'account.optional':
    'Signing in is optional. FluidEQ works exactly as it always has without an account — everything runs on this machine, and nothing is tracked. An account is only there for the parts that genuinely need one.',

  'account.signIn': 'Sign in',
  'account.signUp': 'Create account',
  'account.working': 'One moment…',
  'account.signOut': 'Sign out',
  'account.signOut.confirm': 'Sign out of this account?',
  'account.signOut.detail': 'You can sign back in whenever you like.',
  'account.suspended.failed': 'The refund couldn’t be requested. Try again.',
  'account.suspended.until': 'until {date}',
  'account.suspended.daysLeft.other': '{count} days left',
  'account.suspended.daysLeft.many': '{count} days left',
  'account.suspended.daysLeft.few': '{count} days left',
  'account.suspended.daysLeft.one': '{count} day left',
  'account.suspended.asked':
    'Refund requested: {amount}. It will reach you on {date}, when the account is deleted.',
  'account.suspended.ask': 'Ask for a refund',
  'account.suspended.maker':
    'Your scenes are no longer in the gallery, and what you had waiting to be paid was cancelled.',
  'account.suspended.paid': 'You paid in those days',
  'account.suspended.bodyAsked':
    'Your account is suspended for breaking the rules. You can no longer use it or buy anything.',
  'account.suspended.bodyNothing':
    'Your account is suspended for breaking the rules. You can no longer use it or buy anything. On {until} your account will be deleted.',
  'account.suspended.body':
    'Your account is suspended for breaking the rules. You can no longer use it or buy anything. You can ask for a refund of what you paid between {from} and {to} until {until}. On that day your account will be deleted.',
  'account.suspended.title': 'Account suspended',
  'account.suspended.eyebrow': 'Account',
  'account.signOut.detailPlus':
    'Your scenes stay locked here until you sign back in.',
  'account.signOut.kept': 'Nothing on this computer is deleted.',
  'account.cover.onGraph': '{name} on the graph',
  'account.stats.owned': 'Owned',
  'account.stats.likes': 'Likes',
  'account.scenes.title': 'Your collection',
  'account.scenes.openGallery': 'Open the gallery',
  'account.scenes.empty':
    'The scenes you get stay yours, and play on the graph from here.',
  'account.scenes.playing': 'Playing',
  'account.scenes.unpublished': 'Unpublished',
  'account.scenes.unpublishedHint':
    'Its maker took it out of the gallery. It stays yours.',
  'account.scenes.play': 'Play {name} on the graph',
  'account.published.title': 'Published',
  'account.published.live': 'In the gallery',
  // The name on published scenes, changed from here. The fields and their
  // refusals are the name form's own (profile.name.*).
  'account.name.change': 'Change name',
  'account.name.changeTitle': 'Change how you appear',
  'account.name.changeBody':
    'Your handle and name on the scenes you have published. They change everywhere at once; your email stays private.',
  'account.name.cancel': 'Cancel',
  'account.backToSignIn': 'Back to sign in',

  'account.field.email': 'Email',
  'account.field.emailHint':
    'never shown to anyone — only for signing in and codes',
  'account.field.password': 'Password',
  'account.field.passwordHint': 'at least {count} characters',
  'account.field.code': 'Code from the email',

  'account.code.sent': 'We sent a six-digit code to {email}.',
  'account.code.sendAgain': 'Send the code again',
  'account.code.sentAgain': 'Sent again',
  'account.code.otherEmail': 'Use a different email',
  'account.code.hint':
    'Nothing arrived? Check the spam folder — and if you already had an account with this address, no code is sent: sign in instead.',

  'account.forgot.link': 'Forgot your password?',
  'account.forgot.lead':
    'Enter the address you signed up with and a code goes there.',
  'account.forgot.submit': 'Send a reset code',
  'account.reset.sent':
    'We sent a six-digit code to {email}. Type it here with your new password.',
  'account.reset.submit': 'Set new password',

  'account.unavailable': 'Signing in is not available on this system',
  'account.unavailableHint':
    'There is no secure place to keep a sign-in on this machine, so FluidEQ will not store one. Everything else works as normal.',

  'account.error.network':
    'Could not reach the account service. Check your connection and try again.',
  'account.error.rejected':
    'The account service refused that. Try again in a moment.',
  'account.error.expired':
    'That sign-in is no longer valid. Please sign in again.',
  // Signing in on a sixth computer signs out the least recently used one.
  'account.error.signedOutElsewhere':
    'This computer was signed out because your account signed in on another one. An account stays signed in on up to 5 computers at a time: sign in again to use it here, and the one used least recently is signed out instead.',
  'account.error.malformed':
    'The account service sent something FluidEQ could not read.',
  'account.error.wrongCredentials': 'Wrong email or password.',
  'account.error.unconfirmed':
    'That account has not been confirmed yet. Type the code from the email to finish.',
  'account.error.weakPassword':
    'That password is too easy to guess. Try a longer one, and not one you have used before.',
  'account.error.badCode':
    'That code is wrong or has expired. Ask for a new one.',
  'account.error.rateLimited':
    'Too many attempts in a short time. Wait a minute and try again.',
  'account.error.invalidEmail': 'That does not look like an email address.',
  'account.error.alreadyRegistered':
    'There is already an account with that address. Sign in instead.',

  'account.plus.eyebrow': 'FluidEQ',

  // Signing in with Google, in the browser (main/account/googleSignIn.ts).
  'account.google': 'Continue with Google',
  'account.google.waiting': 'Finish signing in with Google in your browser.',
  'account.google.cancel': 'Cancel',
  // The sign-in screens Ivan approved on 2026-11-13 (`AccountWelcome`).
  'account.welcome.createTitle.one': 'Your {count} scene is waiting',
  'account.welcome.createTitle.few': 'Your {count} scenes are waiting',
  'account.welcome.createTitle.many': 'Your {count} scenes are waiting',
  'account.welcome.createTitle.other': 'Your {count} scenes are waiting',
  'account.welcome.createLine.one':
    'A free account starts with {count} credit. It gets you a scene to keep for good.',
  'account.welcome.createLine.few':
    'A free account starts with {count} credits. Each one gets you a scene to keep for good.',
  'account.welcome.createLine.many':
    'A free account starts with {count} credits. Each one gets you a scene to keep for good.',
  'account.welcome.createLine.other':
    'A free account starts with {count} credits. Each one gets you a scene to keep for good.',
  'account.welcome.step.create': 'Create your account',
  'account.welcome.step.confirm': 'Confirm your email',
  'account.welcome.step.pick.one': 'Pick your {count} scene',
  'account.welcome.step.pick.few': 'Pick your {count} scenes',
  'account.welcome.step.pick.many': 'Pick your {count} scenes',
  'account.welcome.step.pick.other': 'Pick your {count} scenes',
  'account.welcome.backTitle': 'Welcome back',
  'account.welcome.backLine':
    'Your scenes, your credits and your Studio projects are where you left them.',
  'account.welcome.back.scenes':
    'Your scenes play on every computer you sign in to',
  'account.welcome.back.credits': 'Your credits, ready to spend',
  'account.welcome.back.studio': 'Your Studio scenes and the gallery',
  'account.welcome.free':
    'FluidEQ’s equaliser and audio stay free, with or without an account.',
  'account.google.note': 'Fastest: one click, no password to remember.',
  'account.or.email': 'or with your email',
  'account.signUp.withEmail': 'Create account with email',
  'account.signIn.withEmail': 'Sign in with email',
  'account.signUp.terms':
    'By creating an account you agree to the Terms and the Privacy policy.',
  'account.code.step': 'Step 2 of 3',
  'account.code.title': 'Check your email',
  'account.code.confirmEmail': 'Confirm my email',
  'account.error.googleUnfinished':
    'Signing in with Google did not finish. Try again, or use your email.',
  'account.google.doneTitle': 'You are signed in',
  'account.google.doneBody': 'You can close this tab and go back to FluidEQ.',
  'account.google.doneInvite.one':
    'New accounts start with {count} free credit to spend on scenes in FluidEQ.',
  'account.google.doneInvite.few':
    'New accounts start with {count} free credits to spend on scenes in FluidEQ.',
  'account.google.doneInvite.many':
    'New accounts start with {count} free credits to spend on scenes in FluidEQ.',
  'account.google.doneInvite.other':
    'New accounts start with {count} free credits to spend on scenes in FluidEQ.',
  'account.google.failedTitle': 'Signing in did not finish',
  'account.google.failedBody':
    'Go back to FluidEQ to try again, or sign in with your email.',
} as const;

export default account;
