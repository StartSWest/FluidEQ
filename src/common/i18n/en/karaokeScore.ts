/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Karaoke's singing score: the verdicts, the line rows and the end card. */
const karaokeScore = {
  'karaoke.score.title': 'Score',
  'karaoke.score.verdictPerfect': 'Perfect',
  'karaoke.score.verdictGood': 'Good',
  'karaoke.score.verdictLate': 'Late',
  'karaoke.score.verdictLow': 'Low',
  'karaoke.score.verdictHigh': 'High',
  'karaoke.score.verdictMissed': 'Missed',
  'karaoke.score.verdictSkipped': 'Not scored',
  'karaoke.score.octaveMark': '{verdict} · 8ve',
  'karaoke.score.ratingExcellent': 'Excellent',
  'karaoke.score.ratingGreat': 'Great',
  'karaoke.score.ratingGood': 'Good',
  'karaoke.score.ratingFair': 'Fair',
  'karaoke.score.ratingPractice': 'Keep practising',
  'karaoke.score.lineNumber': 'Line {number}',
  'karaoke.score.lineWithText': '{line}, “{text}”',
  'karaoke.score.practiseLine': '{line}: sing it again',
  'karaoke.score.outOf': 'of {max}',
  'karaoke.score.streak': 'Streak',
  'karaoke.score.openReport': 'See results',
  'karaoke.score.close': 'Close the results',
  'karaoke.score.recapTitle': 'Summary',
  'karaoke.score.bestFirst': 'Your first score on this song',
  'karaoke.score.bestNew': 'New best · +{delta}',
  'karaoke.score.bestTied': 'Matches your best',
  'karaoke.score.bestBehind': '{delta} short of your best',
  'karaoke.score.inTune': 'In tune',
  'karaoke.score.inTuneNote': 'of the time you sang inside the notes',
  'karaoke.score.onTime': 'On time',
  'karaoke.score.onTimeNote': '{count} of {total} notes came in on time',
  'karaoke.score.notes': 'Notes',
  'karaoke.score.notesNote': 'hit',
  'karaoke.score.hardestTitle': 'What was hardest',
  'karaoke.score.hardestLow': '{line}: you sat about {cents} cents low.',
  'karaoke.score.hardestHigh': '{line}: you sat about {cents} cents high.',
  'karaoke.score.hardestLate': '{line}: you came in late on its notes.',
  'karaoke.score.hardestMissed': '{line}: some of its notes went unsung.',
  'karaoke.score.hardestLowest': '{line} scored lowest, at {percent}.',
  'karaoke.score.tipTitle': 'For next time',
  'karaoke.score.tipLow':
    'Hear the note a little higher before you sing it, and keep your breath going to the end of it so it does not sink.',
  'karaoke.score.tipHigh':
    'Relax your throat and sing a little softer: pushing for power is what sends a note sharp.',
  'karaoke.score.tipLate':
    'Take your breath before the line, not on its first word, so the first note starts on the beat.',
  'karaoke.score.tipMissed':
    'Learn the words of the lines you skipped, and sing them softly along with the record before going full voice.',
  'karaoke.score.tipOctave':
    'You sang much of it an octave away, which counts. To match the record, try a few lines in its own octave.',
  'karaoke.score.tipClean':
    'Clean singing all through. Try a harder song, or sing this one with the melody tone off.',
  'karaoke.score.practisePassage': 'Practise that passage',
  'karaoke.score.singAgain': 'Sing it again',
  'karaoke.score.mapTitle': 'Song map',
  'karaoke.score.mapSummary': '{points} points · {inTune} in tune',
  'karaoke.score.mapCanvas': 'Every note of the song in its verdict’s colour',
  'karaoke.score.deltaTitle': 'Against your best attempt',
  'karaoke.score.historyTitle': 'Your last attempts',
  'karaoke.score.historyNow': 'Now',
  'karaoke.score.historyBest': 'Your best',
  'karaoke.score.progressTitle': 'Your progress',
  'karaoke.score.progressFirst':
    'Your first time through this song: this is the score to beat.',
  'karaoke.score.progressSame': 'Every line landed where it did in your best.',
  'karaoke.score.progressUp':
    '{line} improved the most since your best ({delta} points).',
  'karaoke.score.progressDown':
    '{line} slipped against your best ({delta}). Practise it alone two or three times, then sing the whole song again.',
  'karaoke.score.progressUpDown':
    '{up} improved the most since your best ({delta} points). {down} slipped: practise it alone two or three times, then sing the whole song again.',
} as const;

export default karaokeScore;
