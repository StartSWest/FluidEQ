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
  'leaderboard.part.messages': 'Messages',
  'leaderboard.part.mentions': 'Mentions',
  'leaderboard.part.likes': 'Scene likes',
  'leaderboard.guide.title': 'How to earn points',
  'leaderboard.guide.lead': 'Everyone earns the same way, the maker included.',
  'leaderboard.guide.hours':
    'Every hour of music that plays, up to {limit} hours a day.',
  'leaderboard.guide.days': 'Every day you listen for {limit} minutes or more.',
  'leaderboard.guide.messages': 'Every message you post, up to {limit} a day.',
  'leaderboard.guide.mentions':
    'Every person who @mentions you, once a day each.',
  'leaderboard.guide.likes':
    'Every like another member gives a scene you made.',
  'leaderboard.guide.value': '+{points}',
  'leaderboard.guide.fairTitle': 'How the numbers are known',
  'leaderboard.guide.fair':
    'Your computer counts the minutes of music and sends one total per day, only after you join, never what you play. Messages, mentions and likes are counted on the server. Every number is checked there, and tampering takes you off the board.',
  'leaderboard.guide.terms': 'Everything the app sends',
  'leaderboard.stat.hours': '{hours} hours listened',
  'leaderboard.stat.messages': '{count} messages posted',
  'leaderboard.stat.mentions': '{count} mentions from others',
  'leaderboard.stat.likes': 'Likes on their scenes: {count}',
  'leaderboard.scoring':
    'Points: {hours} per hour listened, {days} per active day, {messages} per message, {mentions} for each person who mentions you in a day, {likes} for each like on a scene you made. The maker earns them the same way.',
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
