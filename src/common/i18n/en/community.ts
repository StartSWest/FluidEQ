/**
 * The community tab.
 *
 * Channel names and descriptions are here rather than on the server so they
 * translate; a channel the server adds later that the app has no key for shows
 * its server name. The error sentences are keyed by the one word the database
 * trigger raises, so a refusal reaches the person as the thing they can do
 * about it.
 */
const community = {
  'community.title': 'Community',
  'community.signIn.title': 'Sign in to join the community',
  'community.signIn.body':
    'Anyone with an account can read every channel. Posting — and a direct line to what gets built next — comes with Plus.',
  'community.signIn.button': 'Sign in',
  'community.loading': 'Loading…',
  'community.live': 'Live',
  'community.connecting': 'Connecting…',
  'community.offline': 'Feed offline',
  'community.loadOlder': 'Show earlier messages',
  'community.empty': 'Nothing here yet. Be the first.',
  'community.composer.placeholder': 'Message #{channel}',
  'community.send': 'Send',

  'community.plusOnly.title': 'Plus members can post',
  'community.plusOnly.body':
    'Reading is free for everyone signed in. Posting, and a say in what gets built, come with Plus.',
  'community.upgrade': 'Upgrade to Plus',
  'community.contributorsOnly':
    'Star contributors post here. Everyone can read.',

  'community.handle.title': 'Choose your name',
  'community.handle.body':
    'A handle for @mentions — letters, numbers and underscores, 3 to 20 — and the name people see.',
  'community.handle.handle': 'Handle',
  'community.handle.name': 'Display name',
  'community.handle.save': 'Join',

  'community.conduct.title': 'Before your first message',
  'community.conduct.rules':
    'Be kind. No harassment, no slurs, no spam, no piracy links. Disagree with ideas, not people. Anything can be removed, and anyone, without appeal.',
  'community.conduct.accept': 'I agree',

  'community.action.report': 'Report',
  'community.action.reported': 'Reported',
  'community.action.block': 'Block',
  'community.action.delete': 'Delete',
  'community.blocked.count': '{count} blocked',
  'community.blocked.unblockAll': 'Unblock all',
  'community.role.contributor': 'Star contributor',
  'community.role.admin': 'Maker',
  'community.mentions.unread': '{count} unread mentions',

  'community.channel.general': 'General',
  'community.channel.looks': 'Looks',
  'community.channel.help': 'Help',
  'community.channel.featureRequests': 'Feature requests',
  'community.channelDescription.general': 'Everything FluidEQ. Say hello.',
  'community.channelDescription.looks':
    'Visualizers, custom looks and premium scenes.',
  'community.channelDescription.help': 'Stuck? Ask here.',
  'community.channelDescription.featureRequests':
    'Star contributors: a direct line to the maker.',

  'community.error.banned': 'This account cannot post in the community.',
  'community.error.handleRequired': 'Choose a handle before posting.',
  'community.error.handleTaken': 'That handle is taken. Try another.',
  'community.error.conductRequired':
    'Agree to the code of conduct before posting.',
  'community.error.plusRequired': 'Posting is for Plus members.',
  'community.error.contributorRequired':
    'Only star contributors can post in this channel.',
  'community.error.adminRequired': 'Only the maker can post in this channel.',
  'community.error.rateLimited': 'Slow down a little — try again in a moment.',
  'community.error.empty': 'Write something first.',
  'community.error.immutable': 'Messages cannot be edited once sent.',
  'community.error.network':
    'Could not reach the community. Check your connection.',
  'community.error.signedOut': 'You have been signed out. Sign in again.',
  'community.error.rejected': 'The community service refused that.',

  'community.hero.read': 'Read every channel',
  'community.hero.post': 'Post with Plus',
  'community.hero.board': 'Climb the leaderboard',
  'community.composer.hint': 'Enter to send · Shift+Enter for a new line',
} as const;

export default community;
