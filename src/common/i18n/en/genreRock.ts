/* FluidEQ — GPL-3.0-or-later */

/** The notes of the rock family (`genres/rock.ts`). */
const genreRock = {
  'genre.rock.hook': 'Kick and snare intact, guitars as they were panned',
  'genre.rock.story':
    'Guitar bands on a backbeat, 110 to 140 BPM, the guitars doubled hard left and right and the voice in the middle. Distortion already makes the guitars’ harmonics, so what a record needs from playback is its kick and snare intact and a bottom that cannot cancel.',
  'genre.rock.pin.80': 'Kick and bass guitar',
  'genre.rock.pin.80.why': 'The weight of the backbeat.',
  'genre.rock.pin.315': 'Where guitars turn to mud',
  'genre.rock.pin.315.why':
    'A wall of distorted guitar piles up here, so it comes down.',
  'genre.rock.pin.3150': 'The guitars’ bite',
  'genre.rock.pin.3150.why': 'Pick attack and edge, a little forward.',
  'genre.rock.pin.12500': 'Cymbals left alone',
  'genre.rock.pin.12500.why': 'The distortion already fills the top.',
  'genre.rock.stage.bassPunch':
    'The kick keeps its own hit, and its tail is shortened under the bass guitar.',
  'genre.rock.stage.dimension':
    'The bass narrowed under 160 Hz; the hard-panned guitars untouched.',
  'genre.rock.stage.maximizer': 'A light ceiling, quick enough for a backbeat.',
  'genre.rock.off':
    'Its Exciter and Bass Forge are offered and left off: distorted guitars make their own harmonics, and the bass guitar has a real bottom.',

  'genre.popRock.hook': 'Rock’s band with the voice in front',
  'genre.popRock.story':
    'Rock written for the radio, since the Beatles: a live kit and a bass guitar under piano, acoustic and clean electric guitars, with the singer and the hook out front. Fleetwood Mac made it an album form; Coldplay, The Killers, Maroon 5 and Imagine Dragons made it an arena one. Today’s CDs are as finished as pop’s, with a dynamic range of 4 to 7, and they are bright already.',
  'genre.popRock.pin.32': 'A bass guitar, not an 808',
  'genre.popRock.pin.32.why': 'No invented sub under a real instrument.',
  'genre.popRock.pin.80': 'The kick and the bass guitar',
  'genre.popRock.pin.80.why': 'The note the band stands on.',
  'genre.popRock.pin.315': 'A lighter clean-up than Rock',
  'genre.popRock.pin.315.why':
    'Piano and clean guitars do not turn to mud the way a wall of distortion does.',
  'genre.popRock.pin.3150': 'The voice and the hook',
  'genre.popRock.pin.3150.why': 'Where the song lives, brought forward.',
  'genre.popRock.stage.bassPunch':
    'Keeps the kick’s hit and shortens its tail under a moving bass line.',
  'genre.popRock.stage.dimension':
    'The bass narrowed under 150 Hz; the guitars stay where the mix put them.',
  'genre.popRock.stage.maximizer':
    'Catches peaks only and lets go within a sixteenth note.',
  'genre.popRock.off':
    'No Exciter over a voice that is bright already, and no Bass Forge under a real bass guitar.',

  'genre.classicRock.hook': 'Played without a click, with room to breathe',
  'genre.classicRock.story':
    'Bands in a room, 110 to 140 BPM with no click, cut to tape. The 60s mixes panned hard and the 70s ones more naturally, and the original CDs sat at −18 to −13 LUFS, with a dynamic range of 11 to 14 that most remasters took away.',
  'genre.classicRock.pin.32': 'No sub the tape never had',
  'genre.classicRock.pin.32.why':
    'Left down: these records were never built there.',
  'genre.classicRock.pin.125': 'Tape-warm bass',
  'genre.classicRock.pin.125.why': 'The round low end of the originals.',
  'genre.classicRock.pin.3150': 'A gentle top',
  'genre.classicRock.pin.3150.why': 'Eased, as the originals sounded.',
  'genre.classicRock.stage.exciter':
    'A little low-mid warmth, the tape sound, and nothing on the top.',
  'genre.classicRock.stage.dimension':
    'A shade narrower, which brings hard-panned 60s mixes together on headphones.',
  'genre.classicRock.stage.maximizer':
    'A slow ceiling that keeps the dynamics the originals had.',
  'genre.classicRock.off':
    'No Bass Punch or Bass Forge: a roomy kick and tape-warm bass stay as recorded.',

  'genre.alternativeRock.hook': 'Loud and quiet in the same song',
  'genre.alternativeRock.story':
    'The verse-to-chorus contrast is the form, at 90 to 150 BPM, with an overdriven bass and fuzz on hard-panned guitars. The late-90s masters are among the most clipped ever released, with a dynamic range of 4.',
  'genre.alternativeRock.pin.125': 'Overdriven bass weight',
  'genre.alternativeRock.pin.125.why': 'The body under the fuzz.',
  'genre.alternativeRock.pin.500': 'Fuzz mud out',
  'genre.alternativeRock.pin.500.why': 'Cleared so the guitars stay apart.',
  'genre.alternativeRock.pin.3150': 'The guitars’ edge',
  'genre.alternativeRock.pin.3150.why': 'Where the fuzz cuts through.',
  'genre.alternativeRock.pin.8000': 'A shade off the top',
  'genre.alternativeRock.pin.8000.why':
    'It softens the harshness of clipped 90s masters.',
  'genre.alternativeRock.stage.bassPunch':
    'The kick’s hit kept and its tail shortened.',
  'genre.alternativeRock.stage.dimension':
    'The bass narrowed, the guitars left where they were panned.',
  'genre.alternativeRock.stage.maximizer':
    'A ceiling that barely drives, so the loud part stays louder than the quiet one.',
  'genre.alternativeRock.off':
    'No Exciter and no Bass Forge: the fuzz makes its own harmonics.',

  'genre.indieRock.hook': 'A live kit in a room, warm and dark',
  'genre.indieRock.story':
    'Bands recorded live in a room, 100 to 140 BPM, often through tape, warm and deliberately dark. The room is the record.',
  'genre.indieRock.pin.50': 'No bass hype',
  'genre.indieRock.pin.50.why':
    'Held back: the room kit carries its own weight.',
  'genre.indieRock.pin.1250': 'Guitars and voice in the room',
  'genre.indieRock.pin.1250.why': 'Where the band sounds like a band.',
  'genre.indieRock.pin.8000': 'Warm and dark, as recorded',
  'genre.indieRock.pin.8000.why': 'The top stays soft.',
  'genre.indieRock.stage.dimension':
    'The room’s own width, only the bottom narrowed.',
  'genre.indieRock.stage.maximizer':
    'A light ceiling that lets go within a sixteenth note.',
  'genre.indieRock.off':
    'No Exciter, Bass Punch or Bass Forge: nothing shapes the drums or colours the room.',

  'genre.progressiveRock.hook': 'Long pieces built from near silence',
  'genre.progressiveRock.story':
    'Odd meters and changing tempos, melodic bass and Moog lows, panned in detail and recorded full-range. The records span a dynamic range of 10 to 14.',
  'genre.progressiveRock.pin.125': 'Moog and bass lows',
  'genre.progressiveRock.pin.125.why': 'The foundation of the long builds.',
  'genre.progressiveRock.pin.800': 'Room in the middle for detail',
  'genre.progressiveRock.pin.800.why': 'Eased so the layers stay apart.',
  'genre.progressiveRock.pin.12500': 'A full-range hi-fi top',
  'genre.progressiveRock.pin.12500.why':
    'The air these records were made with.',
  'genre.progressiveRock.stage.dimension':
    'The picture as mixed above the bass, with a touch of depth.',
  'genre.progressiveRock.stage.maximizer':
    'The longest look-ahead in the rock family and a whole beat of release: it touches only the climax.',
  'genre.progressiveRock.off':
    'No Exciter, Bass Punch or Bass Forge: nothing fast levels a quiet passage.',

  'genre.hardRock.hook': 'A big kick in a live room',
  'genre.hardRock.story':
    'Boogie and shuffle at 90 to 145 BPM, a strong kick and backbeat in a roomy space, and valve crunch on guitars panned left and right. The classic records had a dynamic range of 13; modern ones are far louder.',
  'genre.hardRock.pin.80': 'The big kick',
  'genre.hardRock.pin.80.why': 'Its weight, kept.',
  'genre.hardRock.pin.315': 'Low-mids tightened',
  'genre.hardRock.pin.315.why': 'As the genre is mixed.',
  'genre.hardRock.pin.3150': 'Valve crunch',
  'genre.hardRock.pin.3150.why': 'Where the guitars bite.',
  'genre.hardRock.pin.12500': 'Fizz eased',
  'genre.hardRock.pin.12500.why': 'The top of the overdrive, not lifted.',
  'genre.hardRock.stage.bassPunch':
    'The kick’s hit kept and its tail a little shorter.',
  'genre.hardRock.stage.dimension':
    'The bass narrowed; the guitars left as panned.',
  'genre.hardRock.stage.maximizer': 'A light ceiling for a live-room kick.',
  'genre.hardRock.off':
    'No Exciter or Bass Forge: valve crunch is harmonics enough.',

  'genre.metal.hook': 'Every double-kick hit on its own',
  'genre.metal.story':
    'Double-kick runs up to 220 BPM with every hit wanted on its own, and down-tuned guitars carrying the low end. It is the loudest genre there is, a median of −8.4 LUFS. The click that makes a hit read lives at 4 to 8 kHz, its weight at 60 to 110 Hz.',
  'genre.metal.pin.32': 'Nothing boosted under 75 Hz',
  'genre.metal.pin.32.why':
    'The guitars own the bottom; more would smear the kicks.',
  'genre.metal.pin.80': 'The kick’s weight, left level',
  'genre.metal.pin.80.why':
    'The bands that could lift it would lift everything under 75 Hz with it.',
  'genre.metal.pin.315': 'Mud out of down-tuned guitars',
  'genre.metal.pin.315.why':
    'The deepest cut of any genre, and why the riffs stay clear.',
  'genre.metal.pin.3150': 'The click that makes a hit read',
  'genre.metal.pin.3150.why':
    'Why a double-kick run sounds like separate hits.',
  'genre.metal.stage.bassPunch':
    'A shorter tail rather than a harder attack, so runs stay separate.',
  'genre.metal.stage.dimension':
    'The bass narrowed under 150 Hz, and nothing widened.',
  'genre.metal.stage.maximizer':
    'It barely drives: this is the loudest genre there is.',
  'genre.metal.off':
    'Its Exciter is offered and left off: more harmonics would land in the fizz. No Bass Forge under down-tuned guitars.',

  'genre.punk.hook': 'Dry, mid-heavy and fast',
  'genre.punk.story':
    'Root-note bass and heavy dry drums at 150 to 200 BPM (the Ramones sat around 170), under raw, buzzsaw guitars. The 70s originals had a dynamic range of 12 to 13.',
  'genre.punk.pin.32': 'No sub',
  'genre.punk.pin.32.why': 'Punk was never built there.',
  'genre.punk.pin.1250': 'The buzzsaw mids',
  'genre.punk.pin.1250.why': 'Where the guitars live.',
  'genre.punk.pin.5000': 'No air, dry',
  'genre.punk.pin.5000.why':
    'Taken down: nothing brighter than the band played it.',
  'genre.punk.stage.bassPunch': 'Only the kick tightened.',
  'genre.punk.stage.dimension': 'The bass narrowed, and nothing widened.',
  'genre.punk.stage.maximizer': 'A light ceiling that keeps the attack.',
  'genre.punk.off': 'No Exciter and no Bass Forge: raw is the sound.',

  'genre.popPunk.hook': 'A tight, clicky kick and glossy guitars',
  'genre.popPunk.story':
    'Fast at 150 to 185 BPM, a picked bass and guitars hard left and right, bright and aggressive. The masters are crushed to a dynamic range of 4 to 6 at −7 to −5 LUFS.',
  'genre.popPunk.pin.125': 'Picked bass punch',
  'genre.popPunk.pin.125.why': 'The note under the power chords.',
  'genre.popPunk.pin.500': 'Low-mids tightened',
  'genre.popPunk.pin.500.why': 'It keeps the wall of guitars clear.',
  'genre.popPunk.pin.3150': 'Only a little edge',
  'genre.popPunk.pin.3150.why': 'These masters are bright and crushed already.',
  'genre.popPunk.stage.bassPunch': 'A tighter kick, never a deeper one.',
  'genre.popPunk.stage.dimension':
    'The bass narrowed under 150 Hz, and nothing widened.',
  'genre.popPunk.stage.maximizer':
    'The lightest ceiling in the rock family: the master is loud already.',
  'genre.popPunk.off':
    'No Exciter or Bass Forge on masters this bright and this loud.',

  'genre.grunge.hook': 'Sludgy, soft then loud, and dark on purpose',
  'genre.grunge.story':
    'Down-tuned, distorted guitars and a big roomy kick at 75 to 140 BPM, soft verses into loud choruses. A thick middle and a rolled-off top are the sound; the originals had a dynamic range of 12, the remasters 7.',
  'genre.grunge.pin.125': 'The sludge',
  'genre.grunge.pin.125.why': 'Down-tuned weight, kept.',
  'genre.grunge.pin.2000': 'Soft-edged guitars',
  'genre.grunge.pin.2000.why':
    'Eased so the distortion stays thick, not scraped.',
  'genre.grunge.pin.12500': 'The rolled-off top',
  'genre.grunge.pin.12500.why': 'Taken further down: dark is the record.',
  'genre.grunge.stage.dimension':
    'Wide guitars and a centred voice, as mixed; only the bottom narrowed.',
  'genre.grunge.stage.maximizer':
    'A slow ceiling that keeps the soft half soft and the loud half loud.',
  'genre.grunge.off':
    'No Exciter, Bass Punch or Bass Forge: nothing brightens it.',
};

export default genreRock;
