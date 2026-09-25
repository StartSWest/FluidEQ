/* FluidEQ — GPL-3.0-or-later */

/** The notes of the pop family (`genres/pop.ts`). */
const genrePop = {
  'genre.pop.hook': 'The most finished record there is',
  'genre.pop.story':
    'Pop runs at 100 to 130 BPM, or half time around 90, over an 808 or a synth bass, with a vocal bright to just short of harsh. The masters arrive limited to about −8 LUFS with peaks over full scale, so everything a playback stage could add is in them already. The preset adds only what a master cannot have.',
  'genre.pop.pin.50': 'The sub and kick pop is built on',
  'genre.pop.pin.50.why':
    'Felt more than heard: the weight a small speaker loses first.',
  'genre.pop.pin.315': 'The boxiness that hides a voice',
  'genre.pop.pin.315.why':
    'Taken out so the lead vocal stands clear of the mix.',
  'genre.pop.pin.5000': 'Presence and sheen',
  'genre.pop.pin.5000.why':
    'The polish on the vocal, kept just short of harsh.',
  'genre.pop.stage.bassPunch':
    'Tightens rather than hits: a shorter kick tail under the bass line, the attack only just lifted.',
  'genre.pop.stage.dimension':
    'Bass in mono under 140 Hz, as pop masters are made, and the air a little wider than the record.',
  'genre.pop.stage.maximizer':
    'A light ceiling that barely drives: the master is limited already.',
  'genre.pop.off':
    'The Exciter and Bass Forge are offered under Pop’s name and left off: the vocal is bright already, and the sub is in the master.',

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
  'genre.indiePop.stage.dimension':
    'The bottom narrowed and the air a shade wider: the harmonies open without moving the voice.',
  'genre.indiePop.stage.maximizer': 'A light ceiling that keeps the softness.',
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
    'The bass narrowed and the pads a little wider, the way the genre was mixed.',
  'genre.synthPop.stage.maximizer':
    'A slow ceiling that leaves the 80s dynamics in.',
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
    'A little body and a little air, which a thin original welcomes.',
  'genre.newWave.stage.dimension':
    'Kept close to the record: the bottom narrowed, the top a hair wider.',
  'genre.newWave.stage.maximizer':
    'A ceiling that only catches: the snap is the genre.',
  'genre.newWave.off':
    'No Bass Punch or Bass Forge: the lean bottom is how it was made.',

  'genre.kPop.hook': 'Among the loudest, most polished records made',
  'genre.kPop.story':
    'Girl-group dance tracks at 115 to 130 BPM and boy-group songs nearer 80 to 100, with a kick built for sub punch and a vocal already lifted at 3 to 5 kHz and at 12 kHz. The masters sit at −10 to −6 LUFS with peaks over full scale.',
  'genre.kPop.pin.80': 'The kick’s punch, not sub',
  'genre.kPop.pin.80.why':
    'Where the kick lands; nothing is lifted under 50 Hz.',
  'genre.kPop.pin.315': 'Space under a dense arrangement',
  'genre.kPop.pin.315.why': 'Low-mids cleared so the layers do not blur.',
  'genre.kPop.pin.12500': 'No extra air',
  'genre.kPop.pin.12500.why': 'The vocal already carries its own at 12 kHz.',
  'genre.kPop.stage.dimension':
    'The bass narrowed, and the doubles and pads a little wider than they were mixed.',
  'genre.kPop.stage.maximizer':
    'A ceiling that barely drives: these masters are as loud as masters get.',
  'genre.kPop.off':
    'No Exciter, Bass Punch or Bass Forge: everything a stage could add is in the record already.',

  'genre.jPop.hook': 'A dense, bright wall at any tempo',
  'genre.jPop.story':
    'Ballads under 90 BPM and band, idol and anime songs at 150 to 200 and more, with a busy bass and distorted guitars in a dense, wide wall. The masters arrive clipped, with peaks up to +2.3 dBTP.',
  'genre.jPop.pin.125': 'A touch of low-mid warmth',
  'genre.jPop.pin.125.why': 'The one direction these mixes take well.',
  'genre.jPop.pin.500': 'The wall made breathable',
  'genre.jPop.pin.500.why': 'A little out of the crowded middle.',
  'genre.jPop.pin.3150': 'Upper mids left alone',
  'genre.jPop.pin.3150.why': 'Bright and forward already; never pushed.',
  'genre.jPop.stage.dimension': 'Nothing widened: the wall is wide enough.',
  'genre.jPop.stage.maximizer':
    'A ceiling that barely drives on masters that are clipped already.',
  'genre.jPop.off':
    'Its Exciter is offered and left off: its engineers ask for none on a master this bright.',

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
    'The mids a shade narrower so the voice holds the middle, the strings and reverbs a little wider.',
  'genre.cPop.stage.maximizer': 'A slow ceiling for the ballads’ dynamics.',
  'genre.cPop.off':
    'No Bass Punch or Bass Forge: no invented sub under a piano ballad.',
};

export default genrePop;
