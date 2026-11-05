/* FluidEQ — GPL-3.0-or-later */

/** The notes of Jamaica's music (`genres/reggae.ts`). */
const genreReggae = {
  'genre.reggae.hook': 'The bass line is the lead instrument',
  'genre.reggae.story':
    'The one drop at about 76 BPM: a thick bass guitar with its highs rolled off leads, under a soft deep kick and a bright staccato skank. Recorded live to tape, much of it in mono; Marley’s original CDs have a dynamic range of 14 to 15.',
  'genre.reggae.pin.80': 'The bass leads',
  'genre.reggae.pin.80.why': 'Its weight kept in the middle.',
  'genre.reggae.pin.500': 'Mud out',
  'genre.reggae.pin.500.why': 'So the bass line walks clearly.',
  'genre.reggae.pin.12500': 'A soft top',
  'genre.reggae.pin.12500.why': 'Vintage tape: nothing lifts the hiss.',
  'genre.reggae.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.reggae.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.reggae.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off. A slow release avoids following individual beats.',
  'genre.reggae.off':
    'Bass Forge is offered and left off: the bass carries its own harmonics. No Exciter on a tape-era top.',

  'genre.dub.hook': 'Drums, bass and the drops',
  'genre.dub.story':
    'Drums and sub-bass up front at 65 to 75 BPM, the rest dropping in and out through tape echo and spring reverb. The drops are the composition; the records keep a dynamic range of 9 to 15.',
  'genre.dub.pin.50': 'Sub weight in mono',
  'genre.dub.pin.50.why': 'The floor of the riddim.',
  'genre.dub.pin.500': 'Space for the echoes',
  'genre.dub.pin.500.why': 'Where the delays bloom.',
  'genre.dub.pin.8000': 'The shine of echo and spring',
  'genre.dub.pin.8000.why': 'The sparkle of the effects, kept.',
  'genre.dub.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.dub.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.dub.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off. A slow release avoids following individual beats.',
  'genre.dub.off':
    'Bass Forge is offered and left off, there is no Exciter, and nothing levels the drops.',

  'genre.dancehall.hook': 'Digital riddims on an 808-style sub',
  'genre.dancehall.story':
    'Digital riddims at around 100 BPM since 1985: an 808 or sine sub in mono, crisp percussion and the vocal forward.',
  'genre.dancehall.pin.80': 'The digital sub',
  'genre.dancehall.pin.80.why': 'Mono, and supported.',
  'genre.dancehall.pin.315': 'Mud out',
  'genre.dancehall.pin.315.why': 'Space for the voice.',
  'genre.dancehall.pin.1250': 'The vocal forward',
  'genre.dancehall.pin.1250.why': 'The deejay on top.',
  'genre.dancehall.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.dancehall.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.dancehall.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off.',
  'genre.dancehall.off':
    'Bass Forge is offered and left off, and there is no Exciter on crisp percussion.',

  'genre.ska.hook': 'A walking bass and horns on the offbeat',
  'genre.ska.story':
    'From 120 to 150 BPM in the first wave to faster in the third, a walking bass and a light kick under horns and a bright offbeat skank. The 1960s records are mono and tape-saturated.',
  'genre.ska.pin.32': 'No fake sub',
  'genre.ska.pin.32.why': 'Nothing invented under a vintage record.',
  'genre.ska.pin.80': 'The walking bass',
  'genre.ska.pin.80.why': 'The line that swings.',
  'genre.ska.pin.315': 'Mud out',
  'genre.ska.pin.315.why': 'Space for the horns.',
  'genre.ska.pin.2000': 'Horns and skank',
  'genre.ska.pin.2000.why': 'The offbeat, bright.',
  'genre.ska.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.ska.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.ska.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off.',
  'genre.ska.off':
    'No Exciter, Bass Punch or Bass Forge: no invented bass under a vintage recording.',
};

export default genreReggae;
