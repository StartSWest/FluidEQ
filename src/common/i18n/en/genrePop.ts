/* FluidEQ — GPL-3.0-or-later */

/** The notes of the pop family (`genres/pop.ts`). */
const genrePop = {
  'genre.pop.hook': 'The most finished record there is',
  'genre.pop.story':
    'Contemporary pop puts a clear lead vocal over a tight bass and a bright, open mix. Songs first meet at −18 LUFS so a loud master and a quieter recording reach the processing at a common level. The Maximizer then raises the result towards −11 LUFS, catching peaks at −1 dBTP while keeping the contrast between verses, choruses and drum hits.',
  'genre.pop.pin.50': 'The sub and kick pop is built on',
  'genre.pop.pin.50.why':
    'Felt more than heard: the weight a small speaker loses first.',
  'genre.pop.pin.315': 'The boxiness that hides a voice',
  'genre.pop.pin.315.why':
    'Taken out so the lead vocal stands clear of the mix.',
  'genre.pop.pin.5000': 'Presence and sheen',
  'genre.pop.pin.5000.why':
    'The polish on the vocal, kept just short of harsh.',
  'genre.pop.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.pop.stage.exciter':
    'A small amount of vocal body and warmth. The treble-band exciter stays off, keeping the record’s own sheen.',
  'genre.pop.stage.bassPunch':
    'Tightens rather than hits: a shorter kick tail under the bass line, the attack only just lifted.',
  'genre.pop.stage.dimension':
    'Bass in mono under 140 Hz, as pop masters are made, and the air a little wider than the record.',
  'genre.pop.stage.maximizer':
    'Adds 7 dB after input normalization, aiming near −11 LUFS with a −1 dBTP ceiling. Master stays off: one final limiter keeps the punch.',
  'genre.pop.off':
    'Bass Forge is offered under Pop’s name and left off: the sub is in the master.',

  'genre.indiePop.hook': 'Lighter and warmer than the charts',
  'genre.indiePop.story':
    'Jangling guitars and stacked harmonies around a centred voice, 90 to 130 BPM, often cut to tape or cassette on purpose. Softer and about a decibel quieter than chart pop, with less sub: the warmth is the look.',
  'genre.indiePop.pin.50': 'No bass hype',
  'genre.indiePop.pin.50.why': 'Left flat: indie pop was never built on sub.',
  'genre.indiePop.pin.315': 'Cardboard out of the mix',
  'genre.indiePop.pin.315.why': 'The boxy low-mids a home recording piles up.',
  'genre.indiePop.pin.1250': 'Jangle and harmonies',
  'genre.indiePop.pin.1250.why':
    'Where the guitars ring and the backing voices stack.',
  'genre.indiePop.pin.12500': 'A little air',
  'genre.indiePop.pin.12500.why':
    'Gentle, over a top that was soft to begin with.',
  'genre.indiePop.stage.exciter':
    'Warmth only, in the low mids: never brighter.',
  'genre.indiePop.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.indiePop.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.indiePop.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off.',
  'genre.indiePop.off':
    'No stage brightens it or adds bass: the lo-fi warmth is the point.',

  'genre.synthPop.hook': 'Drum machines, sequenced bass and chorused pads',
  'genre.synthPop.story':
    'Linn and 808 drum machines, a sequenced bass line and wide chorused pads, 100 to 135 BPM. The early records lean thin and bright; the 80s masters kept their dynamics (a dynamic range of 12 to 13) where modern ones do not.',
  'genre.synthPop.pin.125': 'Body the early records lacked',
  'genre.synthPop.pin.125.why':
    'Low-mid warmth, the one direction these mixes welcome.',
  'genre.synthPop.pin.500': 'Room for the pads',
  'genre.synthPop.pin.500.why':
    'Clears the middle where chorused pads and drum machines pile up.',
  'genre.synthPop.pin.12500': 'The top eased, not lifted',
  'genre.synthPop.pin.12500.why': 'Early synth-pop leans bright already.',
  'genre.synthPop.stage.exciter':
    'Warmth only, in the low mids: no harmonics on a bright top.',
  'genre.synthPop.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.synthPop.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.synthPop.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off. A slow release avoids following individual beats.',
  'genre.synthPop.off':
    'No Bass Punch and no Bass Forge: a drum machine’s kick is exactly as programmed.',

  'genre.newWave.hook': 'Snap, choppy guitars and a lean bottom',
  'genre.newWave.story':
    'Up-tempo and jerky at 110 to 160 BPM: a tight kick, a melodic bass and bright, choppy guitars over a lean bottom. The originals were mastered with room (a dynamic range of 14); the reissues lost most of it.',
  'genre.newWave.pin.125': 'A little warmth for thin originals',
  'genre.newWave.pin.125.why': 'Just enough body for the bass line to carry.',
  'genre.newWave.pin.315': 'Mud out so the bass moves',
  'genre.newWave.pin.315.why': 'A melodic bass needs a clear lane.',
  'genre.newWave.pin.1250': 'The choppy guitars',
  'genre.newWave.pin.1250.why': 'Where the rhythm guitar’s bite lives.',
  'genre.newWave.stage.exciter':
    'A little low-mid warmth only. All three harmonic bands stay off, keeping the stacked vocals clear.',
  'genre.newWave.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.newWave.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.newWave.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off. A slow release avoids following individual beats.',
  'genre.newWave.off':
    'No Bass Punch or Bass Forge: the lean bottom is how it was made.',

  'genre.kPop.hook': 'Clear vocals, tight bass and a powerful drop',
  'genre.kPop.story':
    'BTS’s Dynamite brings disco-pop bass; BLACKPINK’s How You Like That brings a heavy hip-hop drop. Both need clear vocals, weight and contrast. Input meets at −18 LUFS before processing. This listening preset was calibrated on their official Apple previews, without headphone correction.',
  'genre.kPop.pin.80': 'The kick’s punch, not sub',
  'genre.kPop.pin.80.why':
    'Where the kick lands; nothing is lifted under 50 Hz.',
  'genre.kPop.pin.315': 'Space under a dense arrangement',
  'genre.kPop.pin.315.why':
    'A gentle low-mid cut clears the layers while keeping the vocal’s body.',
  'genre.kPop.pin.12500': 'No extra air',
  'genre.kPop.pin.12500.why':
    'Keeps the record’s own air without an added treble boost.',
  'genre.kPop.stage.deEsser':
    'Gentle spectral de-essing in the centred vocal from 5 to 10 kHz, capped at 1.5 dB, with cymbal protection and no bass reduction.',
  'genre.kPop.stage.exciter':
    'A little low-mid warmth only. All three harmonic bands stay off, keeping the stacked vocals clear.',
  'genre.kPop.stage.dimension':
    'Narrows the bass and slightly opens the recorded treble sides, without spreading the centred lead vocal.',
  'genre.kPop.stage.maximizer':
    'Adds 7 dB after −18 LUFS normalization, aiming near −11 LUFS with peaks at −1 dBTP. Dynamics and Master stay off.',
  'genre.kPop.off':
    'No Bass Punch or Bass Forge: the kick’s punch and the sub are in the record already.',

  'genre.jPop.hook': 'A dense, bright wall at any tempo',
  'genre.jPop.story':
    'Ballads under 90 BPM and band, idol and anime songs at 150 to 200 and more, with a busy bass and distorted guitars in a dense, wide wall. The masters arrive clipped, with peaks up to +2.3 dBTP.',
  'genre.jPop.pin.125': 'A touch of low-mid warmth',
  'genre.jPop.pin.125.why': 'The one direction these mixes take well.',
  'genre.jPop.pin.500': 'The wall made breathable',
  'genre.jPop.pin.500.why': 'A little out of the crowded middle.',
  'genre.jPop.pin.3150': 'Upper mids left alone',
  'genre.jPop.pin.3150.why': 'Bright and forward already; never pushed.',
  'genre.jPop.stage.exciter':
    'Warmth only, in the low mids: nothing on a top this bright.',
  'genre.jPop.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.jPop.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.jPop.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off.',
  'genre.jPop.off':
    'No Bass Punch or Bass Forge: the wall arrives dense and loud.',

  'genre.cPop.hook': 'Ballads, the voice front and centre',
  'genre.cPop.story':
    'Ballads at 60 to 90 BPM and pop around 95 to 120, piano and strings under a vocal that sits in front, warm and smooth. Mandarin’s sharp consonants want de-essing rather than excitement.',
  'genre.cPop.pin.125': 'Warm ballad body',
  'genre.cPop.pin.125.why': 'The console warmth of the classic Mandopop sound.',
  'genre.cPop.pin.1250': 'Smooth, not nasal',
  'genre.cPop.pin.1250.why': 'Eased so the voice stays soft.',
  'genre.cPop.pin.12500': 'Gentle air',
  'genre.cPop.pin.12500.why':
    'A little lift above the consonants, not on them.',
  'genre.cPop.stage.exciter': 'Warmth only: no harmonics on sibilants.',
  'genre.cPop.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.cPop.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.cPop.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off. A slow release avoids following individual beats.',
  'genre.cPop.off':
    'No Bass Punch or Bass Forge: no invented sub under a piano ballad.',

  'genre.ballad.hook': 'The slow song, the voice over everything',
  'genre.ballad.story':
    'The slow song of every catalogue, pop, rock, soul and Latin alike, mostly 60 to 85 BPM: “Someone Like You” moves at 67.5 and “November Rain” at 84. The lead vocal is mixed first and sits over everything, close and on a long plate or hall, above a piano, strings or a band held back, and the master keeps more of its dynamics than the same album’s singles.',
  'genre.ballad.pin.125': 'Warmth of the voice and the piano',
  'genre.ballad.pin.125.why':
    'A little body, where a ballad’s voice and piano are warm.',
  'genre.ballad.pin.500': 'Mud eased',
  'genre.ballad.pin.500.why':
    'The low-mids a piano and a close vocal pile up, taken down so the words stay clear.',
  'genre.ballad.pin.3150': 'Presence',
  'genre.ballad.pin.3150.why':
    'The voice a little forward, where its words are understood.',
  'genre.ballad.pin.8000': 'Sibilance eased, not brightened',
  'genre.ballad.pin.8000.why':
    'A close voice carries its esses here, and a lift would sharpen every one.',
  'genre.ballad.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.ballad.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.ballad.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off. A slow release avoids following individual beats.',
  'genre.ballad.off':
    'No Exciter, Bass Forge or Bass Punch: harmonics would land on the sibilants, a ballad has a sub only where its producer put one, and there is rarely a kick to shape.',
};

export default genrePop;
