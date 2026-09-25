/* FluidEQ — GPL-3.0-or-later */

/** The notes of electronic music (`genres/electronic.ts`). */
const genreElectronic = {
  'genre.electronic.hook': 'The whole family at its median',
  'genre.electronic.story':
    'Electronic music runs from 70 to 175 BPM: house around 125, techno 133, trance 138, drum & bass 174. The sub carries a third to half of the energy, the low end is mono for club systems, and the masters sit near −9.3 LUFS with peaks often over full scale.',
  'genre.electronic.pin.50': 'The sub',
  'genre.electronic.pin.50.why': 'A third or more of the music lives here.',
  'genre.electronic.pin.315': 'Mud out for the kick',
  'genre.electronic.pin.315.why': 'Room for the kick to punch.',
  'genre.electronic.pin.8000': 'Hats and air',
  'genre.electronic.pin.8000.why': 'The top of a bright mix.',
  'genre.electronic.stage.dimension':
    'Mono under 150 Hz, and a little width above the mids.',
  'genre.electronic.stage.maximizer':
    'A light ceiling, driven half a decibel harder than the club styles beside it, which brings it level with them.',
  'genre.electronic.off':
    'Its Exciter, Bass Forge and Bass Punch are offered and left off: an exciter makes this top harsh quickly, and the sub needs nothing generated under it.',

  'genre.edm.hook': 'Big room: the kick is the bass',
  'genre.edm.story':
    'Big room at 126 to 132 BPM. In the drop the kick is the bass, the supersaws are spread already and the master is clipped, at a dynamic range of 3 to 6.',
  'genre.edm.pin.80': 'The kick is the bass',
  'genre.edm.pin.80.why': 'The weight of the drop.',
  'genre.edm.pin.315': 'Mud out',
  'genre.edm.pin.315.why': 'Space for the kick.',
  'genre.edm.pin.5000': 'Supersaw bite',
  'genre.edm.pin.5000.why': 'The lead’s edge.',
  'genre.edm.stage.dimension': 'A mono bottom, and nothing else.',
  'genre.edm.stage.maximizer':
    'A ceiling that barely drives on a clipped master.',
  'genre.edm.off':
    'Its Exciter is offered and left off: no sub boost, no widening and no harmonics on a drop that has everything.',

  'genre.house.hook': 'The pump is the groove',
  'genre.house.story':
    'Four on the floor at around 125 BPM, a deep 909 or 808 kick with the bass pumping against it. House is the widest of the club styles, and still narrow under 200 Hz.',
  'genre.house.pin.80': 'The kick and the pumping bass',
  'genre.house.pin.80.why': 'Where the groove is.',
  'genre.house.pin.500': 'Mud out',
  'genre.house.pin.500.why': 'It keeps the kick and the bass apart.',
  'genre.house.pin.12500': 'Warm, not bright',
  'genre.house.pin.12500.why': 'The top eased.',
  'genre.house.stage.dimension':
    'Mono under 150 Hz and narrowed up to 200, the top a little wider.',
  'genre.house.stage.maximizer': 'A light ceiling that leaves the pump alone.',
  'genre.house.off':
    'No Bass Punch, because nothing may re-time the kick; no Exciter or Bass Forge.',

  'genre.techno.hook': 'A compressed kick over a sustained rumble',
  'genre.techno.story':
    'A compressed 909 kick at around 133 BPM over a sustained rumble, dark and led by the low end: the narrowest style measured.',
  'genre.techno.pin.80': 'The 909 kick',
  'genre.techno.pin.80.why': 'The pulse.',
  'genre.techno.pin.800': 'Dark, as it should be',
  'genre.techno.pin.800.why': 'The middle eased under the rumble.',
  'genre.techno.pin.5000': 'No brightening',
  'genre.techno.pin.5000.why': 'The top barely touched.',
  'genre.techno.stage.bassPunch':
    'At most the kick tightened, so the rumble does not smear it.',
  'genre.techno.stage.dimension':
    'A mono bottom; nothing widened in the narrowest style there is.',
  'genre.techno.stage.maximizer': 'A light ceiling.',
  'genre.techno.off':
    'No Exciter and no Bass Forge: no sub boost and no harmonics.',

  'genre.trance.hook': 'Supersaws and a drop built on contrast',
  'genre.trance.story':
    'At 125 to 150 BPM, around 138, a punchy kick and a rolling offbeat bass under very wide supersaws. The drop is built on an eight to ten LU contrast with the breakdown.',
  'genre.trance.pin.50': 'Kick and rolling bass',
  'genre.trance.pin.50.why': 'The drive under the saws.',
  'genre.trance.pin.315': 'The mud trance fights',
  'genre.trance.pin.315.why': '200 to 350 Hz, where a mix clouds.',
  'genre.trance.pin.3150': 'The brittle band eased',
  'genre.trance.pin.3150.why': 'Around 3 kHz, where the saws turn glassy.',
  'genre.trance.stage.dimension': 'Mono under 120 Hz, and nothing more.',
  'genre.trance.stage.maximizer':
    'A ceiling that barely drives, so the drop keeps its contrast.',
  'genre.trance.off':
    'No Exciter or Bass Forge: supersaws already generate plenty of top.',

  'genre.drumBass.hook': 'Breaks at 174 over a mono sub',
  'genre.drumBass.story':
    'Breaks at 170 to 180 BPM over a mono sine sub and a reese or neuro mid-bass. The snare and the break are the genre’s identity.',
  'genre.drumBass.pin.50': 'The sine sub',
  'genre.drumBass.pin.50.why': 'Mono, and not boosted past what it is.',
  'genre.drumBass.pin.500': 'Room for the reese',
  'genre.drumBass.pin.500.why': 'The mid-bass given its lane.',
  'genre.drumBass.pin.5000': 'The crack of snare and break',
  'genre.drumBass.pin.5000.why': 'The genre’s identity.',
  'genre.drumBass.stage.bassPunch': 'The kick tightened, never lifted.',
  'genre.drumBass.stage.dimension': 'The sub mono.',
  'genre.drumBass.stage.maximizer':
    'A light ceiling that lets go inside a sixteenth, so the snare keeps its crack.',
  'genre.drumBass.off':
    'No Exciter or Bass Forge: no harmonics on neuro basses.',

  'genre.dubstep.hook': 'A sine sub under a growl',
  'genre.dubstep.story':
    'Around 140 BPM, felt at 70: a pure sine sub at 30 to 60 Hz in mono and a mid-bass growl distorted by design. The crack of the snare is what must survive.',
  'genre.dubstep.pin.32': 'The sub left as it is',
  'genre.dubstep.pin.32.why': 'Already the loudest thing in the record.',
  'genre.dubstep.pin.80': 'Weight a small speaker can play',
  'genre.dubstep.pin.80.why': 'The body above the sub.',
  'genre.dubstep.pin.500': 'Room for the snare and the growl',
  'genre.dubstep.pin.500.why': 'The middle cleared.',
  'genre.dubstep.stage.dimension': 'The sub mono under 120 Hz.',
  'genre.dubstep.stage.maximizer': 'A ceiling that barely drives.',
  'genre.dubstep.off':
    'No Exciter, Bass Punch or Bass Forge: the growl is fizz already.',

  'genre.downtempo.hook': 'Slowed breaks under deep bass',
  'genre.downtempo.story':
    'Slowed breakbeats around 90 to 105 BPM under deep, dub-influenced bass and wide atmospheres, the top kept dark and the vinyl grain left in.',
  'genre.downtempo.pin.50': 'Deep bass',
  'genre.downtempo.pin.50.why': 'The dub in it.',
  'genre.downtempo.pin.2000': 'The upper mids kept dark',
  'genre.downtempo.pin.2000.why': 'Eased, as recorded.',
  'genre.downtempo.pin.12500': 'Grain left dusty',
  'genre.downtempo.pin.12500.why': 'Not brightened.',
  'genre.downtempo.stage.dimension':
    'The atmospheres wider, the bass narrowed.',
  'genre.downtempo.stage.maximizer': 'A slow, light ceiling.',
  'genre.downtempo.off':
    'Bass Forge is offered and left off: the bass is deep already.',

  'genre.chillout.hook': 'Smooth and spacious',
  'genre.chillout.story':
    'Under 120 BPM, usually 70 to 100: soft kicks, a round bass and wide, smooth space, mastered with room, at a dynamic range of 7 to 13.',
  'genre.chillout.pin.80': 'A round bass',
  'genre.chillout.pin.80.why': 'Warm, never heavy.',
  'genre.chillout.pin.2000': 'Smooth mids',
  'genre.chillout.pin.2000.why': 'Nothing sharp.',
  'genre.chillout.pin.12500': 'Light air',
  'genre.chillout.pin.12500.why': 'The shimmer on top.',
  'genre.chillout.stage.exciter': 'Light air only.',
  'genre.chillout.stage.dimension': 'A wider top: here width is welcome.',
  'genre.chillout.stage.maximizer':
    'A slow ceiling over a whole beat: nothing pressed.',
  'genre.chillout.off': 'No Bass Punch or Bass Forge: nothing heavy.',

  'genre.lofi.hook': 'Dark and dusty on purpose',
  'genre.lofi.story':
    'Swung beats at 70 to 90 BPM, a soft dusty kick and a filtered bass, low-passed at 12 to 16 kHz with the crackle part of the record. Mastered around −12 LUFS, quieter than the rest of the family.',
  'genre.lofi.pin.32': 'No sub hype',
  'genre.lofi.pin.32.why': 'A soft kick stays soft.',
  'genre.lofi.pin.200': 'Low-mid warmth',
  'genre.lofi.pin.200.why': 'The one direction it takes well.',
  'genre.lofi.pin.3150': 'Deliberately dark',
  'genre.lofi.pin.3150.why': 'Nothing brighter than the record.',
  'genre.lofi.stage.dimension':
    'A slight narrowing, the bottom mono under 120 Hz.',
  'genre.lofi.stage.maximizer':
    'A little more drive than its siblings, for records mastered quieter.',
  'genre.lofi.off':
    'Its Exciter is offered and left off: the record is saturated on tape already.',

  'genre.ambient.hook': 'Drones and swells made for low levels',
  'genre.ambient.story':
    'Often beatless: drones, sub pads and swells made to be heard quietly, mastered at −14 to −18 LUFS with compression gentle at most.',
  'genre.ambient.pin.50': 'Sub pads and drones',
  'genre.ambient.pin.50.why': 'The floor of the sound.',
  'genre.ambient.pin.800': 'Space in the middle',
  'genre.ambient.pin.800.why': 'Room for the swells.',
  'genre.ambient.pin.12500': 'Air and shimmer',
  'genre.ambient.pin.12500.why': 'The top of the pads.',
  'genre.ambient.stage.dimension':
    'Wide, the widest of any genre, and still safe in mono.',
  'genre.ambient.stage.maximizer':
    'A ceiling that only ever meets the top of a swell.',
  'genre.ambient.off':
    'Its Exciter is offered and left off: nothing compresses or levels the quiet.',

  'genre.newAge.hook': 'Piano, flute and long reverbs',
  'genre.newAge.story':
    'Slow or free time, piano, flute and pads in long reverbs, soft and warm, with no sudden loud chords. Mastered at −14 to −20 LUFS.',
  'genre.newAge.pin.200': 'Soft warmth',
  'genre.newAge.pin.200.why': 'The body of the pads.',
  'genre.newAge.pin.2000': 'Nothing sharp',
  'genre.newAge.pin.2000.why': 'Eased.',
  'genre.newAge.pin.12500': 'A little air',
  'genre.newAge.pin.12500.why': 'Over the reverbs.',
  'genre.newAge.stage.dimension': 'Wide ambience.',
  'genre.newAge.stage.maximizer': 'Nothing levels the quiet.',
  'genre.newAge.off':
    'Its Exciter is offered and left off: transparent is the brief.',
};

export default genreElectronic;
