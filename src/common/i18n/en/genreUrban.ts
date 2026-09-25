/* FluidEQ — GPL-3.0-or-later */

/** The notes of hip-hop, R&B, soul and their dance music (`genres/urban.ts`). */
const genreUrban = {
  'genre.hiphop.hook': 'Boom bap: a hard kick and the voice on top',
  'genre.hiphop.story':
    'Boom bap swings at 85 to 95 BPM, a hard, short sampled kick and the voice on top, in the narrowest mixes in the charts. The older records are thin below 50 Hz, and the samples, the vinyl and the 808s are saturated already.',
  'genre.hiphop.pin.50': 'Sub for the older records',
  'genre.hiphop.pin.50.why': 'Lifted where boom bap was thin.',
  'genre.hiphop.pin.500': 'Mud between bass and voice',
  'genre.hiphop.pin.500.why': 'Cleared so the verse sits on top.',
  'genre.hiphop.pin.12500': 'A dusty top',
  'genre.hiphop.pin.12500.why':
    'The way a beat built from sampled records sounds.',
  'genre.hiphop.stage.dimension':
    'Mono under 120 Hz and narrowed up to 180, the narrow picture kept.',
  'genre.hiphop.stage.maximizer': 'A ceiling that barely drives.',
  'genre.hiphop.off':
    'Its Exciter, Bass Forge and Bass Punch are offered and left off: the samples are saturated already, and Bass Forge added 16% of new sound to a bass note.',

  'genre.rap.hook': 'The voice is the product',
  'genre.rap.story':
    'The tempo follows the beat, from 85 BPM boom bap to 140 BPM drill, but the voice is the record: centred, dry and intelligible.',
  'genre.rap.pin.50': 'Bass that stays under the voice',
  'genre.rap.pin.50.why': 'Weight without masking the words.',
  'genre.rap.pin.200': 'Off the chest of the voice',
  'genre.rap.pin.200.why': 'Where bass would muddy the verse.',
  'genre.rap.pin.2000': 'The consonants',
  'genre.rap.pin.2000.why': 'Intelligibility, a little forward.',
  'genre.rap.stage.dimension':
    'The mids a shade narrower than the record, to hold the voice still.',
  'genre.rap.stage.maximizer': 'A ceiling that barely drives.',
  'genre.rap.off':
    'Bass Forge is offered and left off: the harmonics of a bass land on the chest of the voice.',

  'genre.trap.hook': 'A long 808 a phone can hear',
  'genre.trap.story':
    'Counted at 140 BPM and felt at 70: a long 808 at 30 to 60 Hz, distorted on purpose, and hi-hats in triple-time rolls. Everything under 120 Hz is mono.',
  'genre.trap.pin.50': 'The 808 left as it is',
  'genre.trap.pin.50.why':
    'Never boosted on a full-range system, where it is already the loudest thing in the record.',
  'genre.trap.pin.315': 'Lean low-mids',
  'genre.trap.pin.315.why': 'As trap is mixed.',
  'genre.trap.pin.8000': 'Crisp hi-hats',
  'genre.trap.pin.8000.why': 'The rolls, clear.',
  'genre.trap.stage.bassForge':
    'The 808’s overtones (80, 120 and 160 Hz of a 40 Hz note), so a small speaker can play it; no octave below.',
  'genre.trap.stage.dimension':
    'Everything under 120 Hz mono, the hats and synths wide.',
  'genre.trap.stage.maximizer': 'A ceiling that barely drives.',
  'genre.trap.off':
    'No Exciter and no Bass Punch: the 808 is distorted already.',

  'genre.rnb.hook': 'A silky top over a round bottom',
  'genre.rnb.story':
    'Felt at 60 to 100 BPM, a soft round kick under an 808 or a synth bass, and a centred, intimate vocal with its stacks and pads around it.',
  'genre.rnb.pin.50': 'A round bottom',
  'genre.rnb.pin.50.why': 'Warm, not booming.',
  'genre.rnb.pin.1250': 'Smooth, not nasal',
  'genre.rnb.pin.1250.why': 'Eased so the voice stays silky.',
  'genre.rnb.pin.12500': 'A silky top',
  'genre.rnb.pin.12500.why': 'Air above the voice.',
  'genre.rnb.stage.dimension':
    'The pads a little wider than the voice, as the genre is mixed.',
  'genre.rnb.stage.maximizer': 'A light ceiling.',
  'genre.rnb.off':
    'Its Exciter is offered and left off: harmonics on this vocal land on its breaths.',

  'genre.soul.hook': 'Tape, tubes and a live band',
  'genre.soul.story':
    'Ballads at 60 to 72 BPM and mid-tempo at 88 to 110, a melodic electric bass and a muffled kick, recorded to tape by a band. The 60s stereo mixes panned hard, and the originals sat at −12 to −16 LUFS.',
  'genre.soul.pin.32': 'Nothing under the tape',
  'genre.soul.pin.32.why': 'Tape-era records have little below 50 Hz.',
  'genre.soul.pin.80': 'Melodic bass warmth',
  'genre.soul.pin.80.why': 'The line that carries the song.',
  'genre.soul.pin.5000': 'No air',
  'genre.soul.pin.5000.why': 'Taken down: air lifts the tape hiss.',
  'genre.soul.stage.dimension':
    'A shade of narrowing, which brings hard-panned 60s mixes together.',
  'genre.soul.stage.maximizer':
    'A slow ceiling for masters that were never limited.',
  'genre.soul.off':
    'Its Exciter is offered and left off: tape and tubes are the sound, and an exciter raises their hiss.',

  'genre.neoSoul.hook': 'A live, drunk-feeling pocket',
  'genre.neoSoul.story':
    'Felt at 60 to 85 BPM with a behind-the-beat pocket of ghost notes, a live bass and a Rhodes. Warm, dark and vintage on purpose.',
  'genre.neoSoul.pin.125': 'Warm and round',
  'genre.neoSoul.pin.125.why': 'The live bass and the Rhodes.',
  'genre.neoSoul.pin.1250': 'Dark and smooth',
  'genre.neoSoul.pin.1250.why': 'Eased so nothing pokes out.',
  'genre.neoSoul.pin.12500': 'No sparkle',
  'genre.neoSoul.pin.12500.why': 'Warm and dark is the brief.',
  'genre.neoSoul.stage.dimension':
    'The live-band picture kept, only the bass narrowed.',
  'genre.neoSoul.stage.maximizer': 'A slow ceiling that squeezes nothing.',
  'genre.neoSoul.off':
    'Its Exciter is offered and left off: without one it stays warm and dark.',

  'genre.funk.hook': 'The bass is the lead, and the one is everything',
  'genre.funk.story':
    'Straight sixteenths at 100 to 125 BPM, slapped bass and ghost notes over a muffled kick and a tight snare. Dry, punchy and mid-forward; the 70s masters sat at −12 to −16 LUFS.',
  'genre.funk.pin.80': 'A tight low bass',
  'genre.funk.pin.80.why': 'Weight without smearing the notes.',
  'genre.funk.pin.500': 'Room for the articulation',
  'genre.funk.pin.500.why': 'So every slap and ghost note reads.',
  'genre.funk.pin.2000': 'Slap and guitar scratch',
  'genre.funk.pin.2000.why': 'The percussive edge, forward.',
  'genre.funk.pin.12500': 'A tape top, not hyped',
  'genre.funk.pin.12500.why': 'Eased, never brightened.',
  'genre.funk.stage.bassPunch':
    'A tight low end with no bloom to smear the articulation.',
  'genre.funk.stage.dimension': 'Close to the record, the bottom narrowed.',
  'genre.funk.stage.maximizer': 'A light ceiling.',
  'genre.funk.off':
    'No Exciter or Bass Forge: dry and mid-forward is the sound.',

  'genre.disco.hook': 'Four on the floor under a wall of strings',
  'genre.disco.story':
    'Four on the floor at about 122 BPM with open hi-hats and an octave bass line, under a wide wall of strings, horns and backing voices. The originals were mastered at −12 to −16 LUFS.',
  'genre.disco.pin.80': 'The kick’s weight',
  'genre.disco.pin.80.why': 'Four on the floor.',
  'genre.disco.pin.800': 'Room under the strings',
  'genre.disco.pin.800.why': 'The middle eased so the wall breathes.',
  'genre.disco.pin.8000': 'Open hi-hats and shimmer',
  'genre.disco.pin.8000.why': 'The sparkle of the era.',
  'genre.disco.stage.bassPunch':
    'A little weight in the kick, its tail kept short of the next beat.',
  'genre.disco.stage.dimension':
    'No widening of what the orchestra spread already.',
  'genre.disco.stage.maximizer':
    'A light ceiling, quick to let go under the kick.',
  'genre.disco.off':
    'No Exciter or Bass Forge: the hats and strings turn brittle under one.',
};

export default genreUrban;
