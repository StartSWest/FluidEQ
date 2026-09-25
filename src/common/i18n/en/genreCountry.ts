/* FluidEQ — GPL-3.0-or-later */

/** The notes of the country, folk and acoustic family (`genres/country.ts`). */
const genreCountry = {
  'genre.country.hook': 'The lyric first',
  'genre.country.story':
    'Two-step, shuffle and waltz at 70 to 130 BPM, an acoustic kick and an electric bass, the voice centred and the lyric in front. Traditional records are natural and clean, and the mastering literature asks for a little harmonic life on top of them.',
  'genre.country.pin.125': 'No bass hype',
  'genre.country.pin.125.why':
    'Barely touched: country was never built on low end.',
  'genre.country.pin.500': 'Boxiness out of the voice',
  'genre.country.pin.500.why':
    'So the singer sounds close rather than boxed in.',
  'genre.country.pin.3150': 'The lyric, clear',
  'genre.country.pin.3150.why': 'Presence at the consonants.',
  'genre.country.stage.exciter':
    'Presence at the consonants and air an octave over the strings, both light.',
  'genre.country.stage.dimension':
    'Nearly as recorded: the bottom narrowed and a touch of air at the sides.',
  'genre.country.stage.maximizer': 'A light ceiling.',
  'genre.country.off':
    'No Bass Punch or Bass Forge: the kick and the bass stay as played.',

  'genre.modernCountry.hook': 'Pop production with a steel guitar in it',
  'genre.modernCountry.story':
    'Polished and bright at 75 to 125 BPM, with 808-style kicks filling the sub, a centred voice and sides widened by the high end. The masters sit at a dynamic range of 5 to 6.',
  'genre.modernCountry.pin.125': 'The 808-style kick',
  'genre.modernCountry.pin.125.why': 'Where the modern low end lives.',
  'genre.modernCountry.pin.500': 'Low-mids cleared',
  'genre.modernCountry.pin.500.why': 'Room for the voice and the steel guitar.',
  'genre.modernCountry.pin.3150': 'Voice presence',
  'genre.modernCountry.pin.3150.why': 'Lifted a little, watched for harshness.',
  'genre.modernCountry.stage.dimension':
    'The bass narrowed and the sides a little wider, as it is mixed.',
  'genre.modernCountry.stage.maximizer':
    'A ceiling that hardly drives on masters that are loud already.',
  'genre.modernCountry.off':
    'Nothing generated: no Exciter, Bass Punch or Bass Forge under 808s that fill the sub already.',

  'genre.americana.hook': 'A band in one room, dynamics left in',
  'genre.americana.story':
    'Roots music at 60 to 130 BPM, a light or brushed kit and an upright or electric bass, a band recorded together and often to tape. The records keep a dynamic range of 7 to 12.',
  'genre.americana.pin.125': 'Warm upright bass',
  'genre.americana.pin.125.why': 'The round bottom of a band in a room.',
  'genre.americana.pin.800': 'One-room boxiness out',
  'genre.americana.pin.800.why': 'So the room sounds open.',
  'genre.americana.pin.3150': 'The voice',
  'genre.americana.pin.3150.why': 'A little forward.',
  'genre.americana.stage.exciter':
    'Warmth, and a touch of air over the strings.',
  'genre.americana.stage.dimension':
    'The one-room picture kept: no widening, the bass a shade narrower.',
  'genre.americana.stage.maximizer': 'A slow ceiling over a whole beat.',
  'genre.americana.off':
    'No Bass Punch or Bass Forge: nothing reshapes a brushed kit or an upright bass.',

  'genre.bluegrass.hook': 'No drums: the picking is the rhythm',
  'genre.bluegrass.story':
    'Banjo, mandolin, fiddle, guitar and upright bass, from ballads near 50 BPM to breakdowns past 130. There are no drums at all: the upright bass is the whole bottom, and the pick attack is the beat.',
  'genre.bluegrass.pin.80': 'The upright bass is the bottom',
  'genre.bluegrass.pin.80.why': 'Nothing added under it.',
  'genre.bluegrass.pin.5000': 'Banjo and mandolin brilliance',
  'genre.bluegrass.pin.5000.why': 'Where the picking sparkles.',
  'genre.bluegrass.pin.12500': 'Air over the strings',
  'genre.bluegrass.pin.12500.why': 'The room around the band.',
  'genre.bluegrass.stage.exciter':
    'Air over the banjo and mandolin, an octave above their own.',
  'genre.bluegrass.stage.dimension': 'As recorded, close-miked and natural.',
  'genre.bluegrass.stage.maximizer':
    'A slow ceiling that never flattens a pick attack.',
  'genre.bluegrass.off':
    'No Bass Punch or Bass Forge: there is no kick to shape and no sub to invent.',

  'genre.folk.hook': 'Minimal and natural',
  'genre.folk.story':
    'Voices and guitars at 60 to 130 BPM, often rubato, in a natural room. Folk mastering itself works in half-decibel moves and adds one or two percent of harmonics; this preset does the same.',
  'genre.folk.pin.200': 'The guitar’s body',
  'genre.folk.pin.200.why': 'The soundboard’s warmth.',
  'genre.folk.pin.3150': 'Gentle presence',
  'genre.folk.pin.3150.why': 'The voice a little closer.',
  'genre.folk.pin.12500': 'Air',
  'genre.folk.pin.12500.why': 'Above 7 kHz, lightly.',
  'genre.folk.stage.exciter':
    'A gentle presence near 2 kHz, air above 7, and the small share of harmonics folk mastering uses.',
  'genre.folk.stage.dimension': 'The room as recorded.',
  'genre.folk.stage.maximizer': 'A slow ceiling that never levels the quiet.',
  'genre.folk.off':
    'No Bass Punch or Bass Forge: no bass hype on a voice and a guitar.',

  'genre.acoustic.hook': 'A guitar’s body and its strings',
  'genre.acoustic.story':
    'Acoustic guitar at 60 to 130 BPM with no kick, recorded with a stereo pair. What it wants is the boom tamed, the 4 to 6 kHz brittleness of steel strings eased and a shelf of air above 10 kHz.',
  'genre.acoustic.pin.32': 'Boom eased',
  'genre.acoustic.pin.32.why': 'The low thump a close microphone adds.',
  'genre.acoustic.pin.5000': 'Steel-string brittleness tamed',
  'genre.acoustic.pin.5000.why': 'The one band that tires the ear.',
  'genre.acoustic.pin.12500': 'A shelf of air',
  'genre.acoustic.pin.12500.why': 'Above 10 kHz, where strings shimmer.',
  'genre.acoustic.stage.exciter':
    'Body at the soundboard and air above 10 kHz.',
  'genre.acoustic.stage.dimension': 'The stereo pair as recorded.',
  'genre.acoustic.stage.maximizer':
    'A slow ceiling that lets go over a whole beat.',
  'genre.acoustic.off':
    'Its Bass Punch profile is offered and left off: a guitar has no kick to shape.',

  'genre.singerSongwriter.hook': 'A voice and one instrument, intimate',
  'genre.singerSongwriter.story':
    'A voice over a guitar or a piano, 60 to 120 BPM and often rubato, centred and close. The records sit quieter than most, at a median of −10.6 LUFS: intimacy and dynamics are the whole thing.',
  'genre.singerSongwriter.pin.80': 'No bass hype',
  'genre.singerSongwriter.pin.80.why': 'Kept down under a voice and a guitar.',
  'genre.singerSongwriter.pin.2000': 'The voice, close and clear',
  'genre.singerSongwriter.pin.2000.why': 'Where the words are.',
  'genre.singerSongwriter.pin.12500': 'Gentle air',
  'genre.singerSongwriter.pin.12500.why': 'A breath above the voice.',
  'genre.singerSongwriter.stage.exciter':
    'Only body, never harmonics on the sibilants.',
  'genre.singerSongwriter.stage.dimension':
    'The mids a shade narrower to keep the voice centred.',
  'genre.singerSongwriter.stage.maximizer': 'A slow ceiling.',
  'genre.singerSongwriter.off':
    'No Bass Punch or Bass Forge: nothing crowds a voice and one instrument.',
};

export default genreCountry;
