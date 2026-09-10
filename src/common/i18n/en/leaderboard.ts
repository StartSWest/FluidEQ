/**
 * The leaderboard.
 *
 * The card in the Account panel has one job before any other: to say, in
 * plain words, exactly what leaves the machine if you join — because it is the
 * one place this app ever sends anything about you, and it is off by default.
 */
const leaderboard = {
  'leaderboard.title': 'Leaderboard',
  'leaderboard.card.title': 'Leaderboard',
  'leaderboard.card.body':
    'Who listens most, among Plus members. Off unless you join. If you do, once a day the app sends one number — whole minutes of music that played, capped at sixteen hours — with the date, the app version and your language. Never what you played, never where from.',
  'leaderboard.card.today': 'Today so far: {hours} h',
  'leaderboard.card.join': 'Join the leaderboard',
  'leaderboard.card.leave': 'Leave the leaderboard',
  'leaderboard.card.remove': 'Remove all my data',
  'leaderboard.card.removed': 'Removed. Nothing of yours remains on the board.',
  'leaderboard.card.removeConfirmTitle': 'Remove everything you ever sent?',
  'leaderboard.card.removeConfirmBody':
    'Your rank and every day of listening on the board are deleted for good. There is no way to get them back; joining again starts from zero.',
  'leaderboard.card.removeKeep': 'Keep my data',
  'leaderboard.card.removeConfirm': 'Remove everything',
  'leaderboard.card.plusOnly':
    'Only Plus members are ranked. Joining does nothing until then.',
  'leaderboard.allTime': 'All time',
  'leaderboard.thisMonth': 'This month',
  'leaderboard.hours': '{hours} h',
  'leaderboard.you': 'You',
  'leaderboard.players': '{count} listeners ranked',
  'leaderboard.points': '{points} pts',
  'leaderboard.stat.hours': '{hours} hours listened',
  'leaderboard.stat.messages': '{count} messages posted',
  'leaderboard.stat.replies': '{count} replies from the maker',
  'leaderboard.scoring':
    'Points: 10 per hour listened, 20 per active day, 5 per message, 50 per reply from the maker, 2 per mention by someone else.',
  'leaderboard.empty': 'Nobody is ranked yet.',
  'leaderboard.notJoined':
    'You are not on the board. Join from the Account panel.',
  'leaderboard.loading': 'Loading…',
  'leaderboard.error.network':
    'Could not reach the leaderboard. Check your connection.',
  'leaderboard.error.plusRequired': 'Only Plus members are ranked.',
  'leaderboard.error.signedOut': 'You have been signed out. Sign in again.',
  'leaderboard.error.rejected': 'The leaderboard service refused that.',
} as const;

export default leaderboard;
