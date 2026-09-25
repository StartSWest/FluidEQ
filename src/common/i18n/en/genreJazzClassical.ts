/* FluidEQ — GPL-3.0-or-later */

/** The notes of jazz, the blues and music of the hall (`genres/jazzClassical.ts`). */
const genreJazzClassical = {
  'genre.jazz.hook': 'The playing is in the mids',
  'genre.jazz.story':
    'Ballads at 50 to 80 BPM, medium swing at 90 to 140, bebop past 200: an upright bass, a feathered kick and the ride cymbal’s air, panned hard on the classic Blue Note records. Jazz is among the quietest and most dynamic music anyone owns, at a median of −12.8 LUFS.',
  'genre.jazz.pin.125': 'Upright bass warmth',
  'genre.jazz.pin.125.why': 'Body for thin old transfers.',
  'genre.jazz.pin.1250': 'The honk eased',
  'genre.jazz.pin.1250.why': 'Horns and piano given room, not help.',
  'genre.jazz.pin.12500': 'The ride cymbal’s air',
  'genre.jazz.pin.12500.why': 'The top of the kit, open.',
  'genre.jazz.stage.dimension':
    'A shade narrower, which brings hard-panned 1950s stereo together on headphones.',
  'genre.jazz.stage.maximizer':
    'A ceiling that touches only a stray peak, over a whole beat.',
  'genre.jazz.off':
    'Its Exciter is offered and left off: added harmonics colour horns and piano audibly. Nothing compresses, widens or generates bass.',

  'genre.smoothJazz.hook': 'Glossy, and soft on purpose',
  'genre.smoothJazz.story':
    'Straight R&B sixteenths at 90 to 105 BPM, glossy wide stereo and a saxophone or a guitar in front, over a soft top.',
  'genre.smoothJazz.pin.80': 'A warm bottom',
  'genre.smoothJazz.pin.80.why': 'The electric bass, round.',
  'genre.smoothJazz.pin.2000': 'No presence on the sax',
  'genre.smoothJazz.pin.2000.why': 'Eased so the lead stays soft.',
  'genre.smoothJazz.pin.12500': 'A glossy top',
  'genre.smoothJazz.pin.12500.why': 'The studio sheen, kept.',
  'genre.smoothJazz.stage.dimension':
    'The glossy stereo as mixed, only the bass narrowed.',
  'genre.smoothJazz.stage.maximizer': 'A slow ceiling.',
  'genre.smoothJazz.off':
    'Its Exciter is offered and left off, and there is no Bass Punch: the genre is soft on purpose.',

  'genre.fusion.hook': 'Electric, bright and virtuosic',
  'genre.fusion.story':
    'Rock and funk grooves in odd meters at 90 to 180 BPM, electric and fretless bass and synths, with fills and unison runs that are the point. The 70s records sat at −13 to −17 LUFS.',
  'genre.fusion.pin.80': 'Bass and kick',
  'genre.fusion.pin.80.why': 'The groove’s floor.',
  'genre.fusion.pin.315': 'Mud out',
  'genre.fusion.pin.315.why': 'Space for fast runs.',
  'genre.fusion.pin.12500': 'Bright, as recorded',
  'genre.fusion.pin.12500.why': 'The top these records had.',
  'genre.fusion.stage.dimension':
    'The multitrack spread as recorded, only the bass narrowed.',
  'genre.fusion.stage.maximizer': 'A slow ceiling that leaves the fills alone.',
  'genre.fusion.off':
    'No Exciter, Bass Punch or Bass Forge: nothing is added to instruments that make their own harmonics.',

  'genre.blues.hook': 'Raw and mid-forward',
  'genre.blues.story':
    'Slow 12/8 at 60 to 75 BPM and shuffles at 90 to 140, a walking bass, and an overdrive that is the sound. The classic records are mono and were mastered at −12 to −16 LUFS.',
  'genre.blues.pin.50': 'No fake sub',
  'genre.blues.pin.50.why': 'Left down under old records.',
  'genre.blues.pin.200': 'Body for thin transfers',
  'genre.blues.pin.200.why': 'The warmth an old recording lost.',
  'genre.blues.pin.5000': 'Raw, not bright',
  'genre.blues.pin.5000.why': 'The top eased.',
  'genre.blues.stage.dimension':
    'A shade of narrowing; the mono records stay mono.',
  'genre.blues.stage.maximizer': 'A slow ceiling.',
  'genre.blues.off':
    'Its Exciter is offered and left off: the overdrive is the sound, and nothing is added to it.',

  'genre.classical.hook': 'The hall is the recording',
  'genre.classical.story':
    'Music recorded in a hall with a Decca tree or a spaced pair and mastered with half a decibel of compression at most. Classical recordings sit at −16 to −20 LUFS with fifteen to twenty LU of range, the widest dynamics of any genre.',
  'genre.classical.pin.80': 'A touch of hall at the bottom',
  'genre.classical.pin.80.why': 'Paid for by the dip in the middle.',
  'genre.classical.pin.800': 'The middle eased',
  'genre.classical.pin.800.why': 'So the lift at either end adds no loudness.',
  'genre.classical.pin.12500': 'The hall’s air',
  'genre.classical.pin.12500.why': 'The space the recording was made in.',
  'genre.classical.stage.maximizer':
    'Only a ceiling, with the longest look-ahead and release of any genre, so a crescendo is never what it holds down.',
  'genre.classical.off':
    'No Dimension at all: the hall is the recording. Its Exciter and Bass Punch are offered and left off.',

  'genre.orchestra.hook': 'A full orchestra’s dynamics, kept',
  'genre.orchestra.story':
    'A full orchestra in a wide, deep hall, recorded at −18 to −23 LUFS with fifteen to twenty-five LU of range. The rare tutti peaks, timpani and bass drum, set a whole recording’s level.',
  'genre.orchestra.pin.125': 'Double basses and timpani, not lifted',
  'genre.orchestra.pin.125.why':
    'A lifted timpani roll only pushes the ceiling.',
  'genre.orchestra.pin.800': 'Congestion eased',
  'genre.orchestra.pin.800.why': 'Where a full section piles up.',
  'genre.orchestra.pin.12500': 'The hall’s air',
  'genre.orchestra.pin.12500.why': 'The space around the orchestra.',
  'genre.orchestra.stage.maximizer':
    'A ceiling only, with the longest look-ahead and release of any genre, so a tutti is never pumped.',
  'genre.orchestra.off':
    'No Dimension, Exciter, Bass Punch or Bass Forge: nothing boosts the bass that the timpani would overload.',

  'genre.opera.hook': 'A voice that already carries over an orchestra',
  'genre.opera.story':
    'The singer’s formant, around 2.4 to 3.1 kHz, is what carries a voice over an orchestra without a microphone. Opera recordings sit at −18 to −23 LUFS with very loud top notes.',
  'genre.opera.pin.315': 'The orchestra’s mud',
  'genre.opera.pin.315.why': 'Out of the voice’s way.',
  'genre.opera.pin.800': 'The voice’s body',
  'genre.opera.pin.800.why': 'A little forward.',
  'genre.opera.pin.3150': 'The formant left alone',
  'genre.opera.pin.3150.why':
    'It already projects; lifting it turns a voice shrill.',
  'genre.opera.stage.maximizer':
    'A light ceiling only: nothing compresses the voice.',
  'genre.opera.off':
    'No Dimension, Exciter or Bass Punch: nothing widens, excites or reshapes the voice.',

  'genre.piano.hook': 'One of the most revealing sources there is',
  'genre.piano.story':
    'From A0 at 27.5 Hz to C8, one instrument covers the whole range, recorded at −16 to −20 LUFS with high peaks. A limiter flattens the hammer and lifts the decay, and harmonics turn chords to grit.',
  'genre.piano.pin.125': 'Weight in the left hand',
  'genre.piano.pin.125.why': 'The body of the bass strings.',
  'genre.piano.pin.315': 'Close-miked boxiness out',
  'genre.piano.pin.315.why': 'The soundboard, not the lid.',
  'genre.piano.pin.5000': 'The hammer’s attack',
  'genre.piano.pin.5000.why': 'Where a note begins.',
  'genre.piano.stage.maximizer': 'A ceiling only.',
  'genre.piano.off':
    'No Dimension, Exciter or Bass Punch: nothing saturates or reshapes a piano.',

  'genre.strings.hook': 'Rich in harmonics already',
  'genre.strings.story':
    'Bowed strings from double bass to violin, in their natural ensemble picture, smooth and airy, at −16 to −22 LUFS. They are rich in harmonics already, and harsh with presence added.',
  'genre.strings.pin.200': 'Cello and bass body',
  'genre.strings.pin.200.why': 'The warmth of the low section.',
  'genre.strings.pin.2000': 'No presence',
  'genre.strings.pin.2000.why': 'Taken down: bowed strings turn strident here.',
  'genre.strings.pin.12500': 'Air around the section',
  'genre.strings.pin.12500.why': 'The hall above the bows.',
  'genre.strings.stage.maximizer': 'A ceiling only.',
  'genre.strings.off':
    'No Dimension and no Exciter: an exciter makes bowed strings strident.',
};

export default genreJazzClassical;
