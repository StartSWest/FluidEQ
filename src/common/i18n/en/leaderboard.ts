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
    'Who listens most, among Plus members. Off unless you join. If you do, the app sends one number for each day — whole minutes of music that played, capped at sixteen hours — with its date, and updates it when you come back to the computer or open the board. Never what you played, never where from.',
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
  'leaderboard.hero.title': 'Your standing',
  'leaderboard.hero.of': 'of {count}',
  'leaderboard.hero.toPass': '{points} pts to pass {name}',
  'leaderboard.hero.leading': 'You lead the board.',
  'leaderboard.part.hours': 'Listening',
  'leaderboard.part.days': 'Active days',
  'leaderboard.part.likes': 'Scene likes',
  'leaderboard.guide.title': 'How to earn points',
  'leaderboard.guide.lead': 'Everyone earns the same way, the maker included.',
  'leaderboard.guide.hours':
    'Every hour of music that plays, up to {limit} hours a day.',
  'leaderboard.guide.days': 'Every day you listen for {limit} minutes or more.',
  'leaderboard.guide.likes':
    'Every like another member gives a scene you made.',
  'leaderboard.guide.value': '+{points}',
  'leaderboard.guide.fairTitle': 'How the numbers are known',
  'leaderboard.guide.fair':
    'Your computer counts the minutes of music and sends one total per day, only after you join, never what you play. Likes are counted on the server. Every number is checked there, and tampering takes you off the board.',
  'leaderboard.guide.terms': 'Everything the app sends',
  'leaderboard.stat.hours': '{hours} hours listened',
  'leaderboard.stat.days': '{count} active days',
  'leaderboard.stat.likes': 'Likes on their scenes: {count}',
  'leaderboard.scoring':
    'Points: {hours} per hour listened, {days} per active day, {likes} for each like on a scene you made. The maker earns them the same way.',
  'leaderboard.rail.blurb': 'Who listens most',
  'leaderboard.role.admin': 'Maker',

  // The name the board ranks, chosen once on the board itself.
  'leaderboard.name.title': 'Choose how the board shows you',
  'leaderboard.name.body':
    'A handle and a name. The board ranks you by them, and the Visualizers gallery credits your scenes with them. Everyone signed in sees them; nobody sees your email.',
  'leaderboard.name.handle': 'Handle',
  'leaderboard.name.handleHint': '3 to 20 letters, numbers or _',
  'leaderboard.name.name': 'Display name',
  'leaderboard.name.previewName': 'Your name',
  'leaderboard.name.save': 'Save',
  'leaderboard.name.choose': 'Choose your name',
  'leaderboard.name.error.handleTaken': 'That handle is taken. Try another.',
  'leaderboard.name.error.signedOut':
    'You have been signed out. Sign in again.',
  'leaderboard.name.error.network':
    'Could not reach the server. Check your connection and try again.',
  'leaderboard.name.error.rejected':
    'The server refused that name. Try a different one.',
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
