/* FluidEQ — GPL-3.0-or-later */

/** The notes of Latin music (`genres/latin.ts`). */
const genreLatin = {
  'genre.latin.hook': 'Clave, percussion and brass',
  'genre.latin.story':
    'From boleros at 60 to 80 BPM to salsa at 220, over clave and tresillo, with two ways of carrying the bottom: an anticipated bass under hand drums, often with no kick, or a kick on every beat over an 808. Most of the energy sits in the middle of the picture.',
  'genre.latin.pin.80': 'Bass warmth',
  'genre.latin.pin.80.why': 'Under the drums.',
  'genre.latin.pin.315': 'Mud out',
  'genre.latin.pin.315.why': 'Room for the percussion.',
  'genre.latin.pin.3150': 'Percussion and voice',
  'genre.latin.pin.3150.why': 'Presence, a little forward.',
  'genre.latin.pin.12500': 'The brass top not pushed',
  'genre.latin.pin.12500.why': 'Rich in harmonics already.',
  'genre.latin.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.latin.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.latin.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off.',
  'genre.latin.off':
    'Its Exciter is offered and left off: brass and güira turn harsh under one.',

  'genre.latinPop.hook': 'Dembow under a polished voice',
  'genre.latinPop.story':
    'Dembow and tresillo at 85 to 105 BPM, a programmed kick locked to a mono sub, bright and polished, mastered around −8 LUFS with peaks over full scale.',
  'genre.latinPop.pin.50': 'A tight mono sub',
  'genre.latinPop.pin.50.why': 'The programmed low end.',
  'genre.latinPop.pin.200': 'Low-mids cleared',
  'genre.latinPop.pin.200.why': 'Space between the sub and the voice.',
  'genre.latinPop.pin.3150': 'Vocal articulation',
  'genre.latinPop.pin.3150.why': 'Where the words are.',
  'genre.latinPop.stage.exciter':
    'Warmth and body under the vocal, nothing on the top.',
  'genre.latinPop.stage.bassPunch': 'The sub tightened a little.',
  'genre.latinPop.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.latinPop.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.latinPop.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off.',
  'genre.latinPop.off': 'No Bass Forge: the sub is locked to the kick already.',

  'genre.reggaeton.hook': 'A kick every beat over a tuned 808',
  'genre.reggaeton.story':
    'Dembow at about 95 BPM: a kick on every beat and a tresillo snare over a long, tuned, saturated 808 in mono, mastered at −8 LUFS with a dynamic range of 5.',
  'genre.reggaeton.pin.50': 'The deep mono 808',
  'genre.reggaeton.pin.50.why': 'Deepened, and centred.',
  'genre.reggaeton.pin.315': 'Mud out',
  'genre.reggaeton.pin.315.why': 'Space for the dembow.',
  'genre.reggaeton.pin.5000': 'The crack of the snare',
  'genre.reggaeton.pin.5000.why': 'Crisp.',
  'genre.reggaeton.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.reggaeton.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.reggaeton.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off.',
  'genre.reggaeton.off':
    'Bass Forge is offered and left off: its octave and harmonics under an 808 that is distorted already came to 13% of the note.',

  'genre.salsa.hook': 'Clave at speed, congas to one side',
  'genre.salsa.story':
    'Son clave at 160 to 220 BPM, a tumbao that skips the downbeat and no kick, congas to one side, timbales in the middle and the horns spread. The 70s records had a dynamic range of 12 to 13.',
  'genre.salsa.pin.80': 'A warm tumbao',
  'genre.salsa.pin.80.why': 'Gently, under the band.',
  'genre.salsa.pin.315': 'Mud out',
  'genre.salsa.pin.315.why': 'Space for the congas.',
  'genre.salsa.pin.1250': 'Piano montuno and chorus',
  'genre.salsa.pin.1250.why': 'The middle made clear.',
  'genre.salsa.pin.12500': 'Brass and cowbell not brightened',
  'genre.salsa.pin.12500.why': 'They turn harsh if lifted.',
  'genre.salsa.stage.exciter':
    'Warmth only, gently under the tumbao, and nothing on the brass.',
  'genre.salsa.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.salsa.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.salsa.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off. A slow release avoids following individual beats.',
  'genre.salsa.off':
    'No Bass Punch or Bass Forge, and nothing on the top: brass and cowbell are rich in harmonics already.',

  'genre.bachata.hook': 'A weeping requinto and a metallic güira',
  'genre.bachata.story':
    'At 120 to 140 BPM, a weeping lead guitar and a metallic güira over a syncopated bass. It is fatiguing if its 3 to 8 kHz is lifted, and the güira is the dancers’ metronome.',
  'genre.bachata.pin.50': 'A warm syncopated bass',
  'genre.bachata.pin.50.why': 'The only thing warmed.',
  'genre.bachata.pin.1250': 'The requinto, clear',
  'genre.bachata.pin.1250.why': 'The voice of the lead guitar.',
  'genre.bachata.pin.8000': '3 to 8 kHz never lifted',
  'genre.bachata.pin.8000.why': 'The güira and the requinto tire the ear fast.',
  'genre.bachata.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.bachata.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.bachata.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off.',
  'genre.bachata.off':
    'Its Exciter is offered and left off: it makes the requinto and the güira harsh.',

  'genre.merengue.hook': 'Tambora and a sixteenth-note güira',
  'genre.merengue.story':
    'Two-beat merengue at 120 to 160 BPM, tambora and a sixteenth-note güira under saxes and brass, dense enough for a limiter to smear.',
  'genre.merengue.pin.80': 'Tambora and bass',
  'genre.merengue.pin.80.why': 'The punch of the two-beat.',
  'genre.merengue.pin.315': 'Mud out',
  'genre.merengue.pin.315.why': 'Space in a dense band.',
  'genre.merengue.pin.5000': 'The top eased',
  'genre.merengue.pin.5000.why': 'The güira and the saxes are bright already.',
  'genre.merengue.stage.bassPunch': 'The tambora’s punch kept tight.',
  'genre.merengue.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.merengue.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.merengue.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off.',
  'genre.merengue.off':
    'No Exciter or Bass Forge: no top added to saxes and güira.',

  'genre.cumbia.hook': 'A steady scrape and a two-beat bass',
  'genre.cumbia.story':
    'The slowest of the dance family at 85 to 110 BPM: a steady guacharaca scrape and a simple two-beat bass, warm and mid-forward with accordion or keys.',
  'genre.cumbia.pin.125': 'A warm two-beat bass',
  'genre.cumbia.pin.125.why': 'Where the dance sits.',
  'genre.cumbia.pin.315': 'Mud out',
  'genre.cumbia.pin.315.why': 'Room for the accordion and the voice.',
  'genre.cumbia.pin.12500': 'The scraper not sharpened',
  'genre.cumbia.pin.12500.why': 'Its pulse left alone.',
  'genre.cumbia.stage.exciter': 'Warmth for the bass, and nothing on the top.',
  'genre.cumbia.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.cumbia.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.cumbia.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off. A slow release avoids following individual beats.',
  'genre.cumbia.off':
    'No Bass Punch or Bass Forge: the scrape and the bass stay as played.',

  'genre.bossaNova.hook': 'Nylon guitar and a restrained voice',
  'genre.bossaNova.story':
    'Counted at 120 to 150 BPM and felt at 60 to 75: a nylon guitar, a thumbed bass and brushes under a restrained voice. Among the most dynamic records in the family, with a dynamic range of 11 to 16.',
  'genre.bossaNova.pin.125': 'Nylon guitar warmth',
  'genre.bossaNova.pin.125.why': 'The body of the guitar.',
  'genre.bossaNova.pin.800': 'Soft, not boxy',
  'genre.bossaNova.pin.800.why': 'Eased.',
  'genre.bossaNova.pin.5000': 'A little air on the voice',
  'genre.bossaNova.pin.5000.why': 'Presence, gently.',
  'genre.bossaNova.stage.exciter':
    'Warmth for the guitar and a little air for the voice.',
  'genre.bossaNova.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.bossaNova.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.bossaNova.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off. A slow release avoids following individual beats.',
  'genre.bossaNova.off':
    'No Bass Punch or Bass Forge: nothing compresses it or adds sub.',

  'genre.samba.hook': 'Surdos in call and response',
  'genre.samba.story':
    'In 2/4, carioca at 100 to 120 BPM and enredo faster: the surdos accent the second beat under tamborim, pandeiro and caixa. The originals had a dynamic range of 12.',
  'genre.samba.pin.80': 'The surdo, tight',
  'genre.samba.pin.80.why': 'Tightened rather than booming.',
  'genre.samba.pin.315': 'Mud out',
  'genre.samba.pin.315.why': 'Space in the bateria.',
  'genre.samba.pin.5000': 'Tamborim and pandeiro',
  'genre.samba.pin.5000.why': 'Crisp and metallic.',
  'genre.samba.stage.bassPunch':
    'The surdo tightened rather than made to boom.',
  'genre.samba.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.samba.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.samba.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off.',
  'genre.samba.off':
    'No Exciter or Bass Forge on a top that is bright already.',

  'genre.flamenco.hook': 'Rasgueado, palmas and footwork',
  'genre.flamenco.story':
    'From free soleá to bulerías at 195 to 240 BPM, the guitar, the palmas and the footwork are the rhythm itself, on recordings as dynamic as any: Paco de Lucía’s have a dynamic range of 13 to 17.',
  'genre.flamenco.pin.50': 'A minimal low end',
  'genre.flamenco.pin.50.why': 'Guitar, cajón and feet, nothing more.',
  'genre.flamenco.pin.2000': 'The guitar’s attack',
  'genre.flamenco.pin.2000.why': 'The percussive strike.',
  'genre.flamenco.pin.12500': 'The top eased',
  'genre.flamenco.pin.12500.why': 'Bright already: nothing added.',
  'genre.flamenco.stage.exciter': 'Body, and never top.',
  'genre.flamenco.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.flamenco.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.flamenco.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off. A slow release avoids following individual beats.',
  'genre.flamenco.off':
    'No Bass Punch or Bass Forge: nothing compresses the rhythm.',

  'genre.regionalMexican.hook': 'Tuba, accordion and trumpets',
  'genre.regionalMexican.story':
    'Banda’s tuba and tambora, norteño’s accordion and bajo sexto, mariachi’s guitarrón and trumpets, in polkas, rancheras and sones. Bright, loud and forward; the classic records have a dynamic range of 9 to 14.',
  'genre.regionalMexican.pin.80': 'Tuba and guitarrón',
  'genre.regionalMexican.pin.80.why': 'Weight and warmth.',
  'genre.regionalMexican.pin.1250': 'The voice forward',
  'genre.regionalMexican.pin.1250.why': 'Powerful, in front.',
  'genre.regionalMexican.pin.3150': 'Trumpets and accordion tamed',
  'genre.regionalMexican.pin.3150.why': 'Eased, never lifted.',
  'genre.regionalMexican.pin.12500': 'The brass top eased',
  'genre.regionalMexican.pin.12500.why': 'Loud enough already.',
  'genre.regionalMexican.stage.bassPunch': 'The tambora’s punch kept tight.',
  'genre.regionalMexican.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.regionalMexican.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.regionalMexican.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off.',
  'genre.regionalMexican.off':
    'Its Exciter is offered and left off: brass, accordion and violins are bright already.',

  'genre.corridos.hook': 'A steel requinto over tuba',
  'genre.corridos.story':
    'Felt at about 105 BPM in 3/4 or 6/8: a steel-string requinto over tuba, and in the tumbados an 808 doubling the tuba.',
  'genre.corridos.pin.80': 'Tuba warmth, the 808 in mono',
  'genre.corridos.pin.80.why': 'The low end, centred.',
  'genre.corridos.pin.315': 'Mud out',
  'genre.corridos.pin.315.why': 'Space for the requinto.',
  'genre.corridos.pin.12500': 'The steel requinto not brightened',
  'genre.corridos.pin.12500.why': 'Articulate already.',
  'genre.corridos.stage.dimension':
    'Keeps this genre’s balance of stereo width across the frequency range. No decorrelation is added to the centred vocal.',
  'genre.corridos.stage.deEsser':
    'Tames sharp S and SH sounds in the centred vocal with narrow spectral cuts of up to 1.5 dB from 5 to 10 kHz, while protecting cymbals and leaving the bass alone.',
  'genre.corridos.stage.maximizer':
    'Levels the normalized input towards this genre’s measured listening level, with peaks caught at −1 dBTP. Limiting stays restrained to preserve the recording’s dynamics; Master and Dynamics remain off.',
  'genre.corridos.off':
    'Bass Forge is offered and left off: the 808 brings its own sub.',
};

export default genreLatin;
