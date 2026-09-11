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
  'account.menu': 'Account',
  'account.eyebrow': 'FluidEQ',
  'account.title': 'Account',
  'account.close': 'Close',

  'account.optional':
    'Signing in is optional. FluidEQ works exactly as it always has without an account — everything runs on this machine, and nothing is tracked. An account is only there for the parts that genuinely need one.',

  'account.signIn': 'Sign in',
  'account.signUp': 'Create account',
  'account.signInHint':
    'Your password goes straight to the account service and is not kept anywhere in the app.',
  'account.signUpHint':
    'A six-digit code goes to that address. Type it here to finish.',
  'account.working': 'One moment…',
  'account.signOut': 'Sign out',
  'account.signedIn': 'Signed in',
  'account.backToSignIn': 'Back to sign in',

  'account.field.email': 'Email',
  'account.field.emailHint':
    'never shown to anyone — only for signing in and codes',
  'account.field.password': 'Password',
  'account.field.passwordHint': 'at least {count} characters',
  'account.field.name': 'Name',
  'account.field.optional': 'optional',
  'account.field.code': 'Code from the email',

  'account.code.sent': 'We sent a six-digit code to {email}.',
  'account.code.confirm': 'Confirm',
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

  'account.plus.eyebrow': 'FluidEQ Plus',
  'account.plus.pitch':
    'Premium visualizers that exist nowhere else, posting in the community, the leaderboard, a direct line for feature requests — and every new feature from here on, for members first. Everything that is free today stays free.',
  'account.plus.upgrade': 'Upgrade to Plus',
  'account.plus.opening': 'Opening…',
  'account.plus.checkoutHint':
    'Opens Buy Me a Coffee in your browser. Pay with the same email as this account so FluidEQ can recognise it; the app never sees your card.',
  'account.plus.active': 'Active',
  'account.plus.renews': 'Renews {date}',
  'account.plus.ends': 'Ends {date}',
  'account.plus.manage': 'Manage subscription',
  'account.plus.grace':
    'Your subscription could not be confirmed. It stays on until {date} — connect to the internet before then to keep it.',
  'account.plus.checkAgain': 'Check again',
  // The configured amount, as the checkout shows it ("$5"), per month.
  'account.plus.perMonth': '{price} / month',
  // The yearly amount ("$40"), per year, and the two offered together.
  'account.plus.perYear': '{price} / year',
  'account.plus.priceChoice': '{monthly} or {yearly}',
  'account.plus.checkoutOpened':
    'Buy Me a Coffee is open in your browser. Come back here once you have paid, and Plus turns on.',
  'account.plus.error.rejected':
    'The billing page could not be opened. Try again in a moment.',

  // Development only: the pretend membership under the Plus card. Shown in
  // no packaged build.
  'account.dev.label': 'Development',
  'account.dev.start': 'Pretend a payment',
  'account.dev.cancel': 'Pretend a cancellation',
  'account.dev.working': 'Sending…',

  'account.perk.looks': 'Plus looks, drawn on the graphics card.',
  'account.perk.community':
    'A community that everyone can read and members can post in.',
  'account.perk.board': 'A leaderboard of who listens most.',
} as const;

export default account;
