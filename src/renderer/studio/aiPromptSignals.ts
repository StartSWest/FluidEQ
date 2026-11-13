/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The part of the Studio's AI prompt (`aiPrompt.ts`) that says what each
 * thing a scene hears IS, and what it must never drive.
 *
 * Written as bans, not as recipes (Ivan, 2026-11-13: "more than giving
 * advice we can do forbid lists so he knows better what not to use for
 * what", "so the agent gets more creative instead of following what to do,
 * it is better to tell what not to do"). Told "the kick a floor pulse, the
 * snare a spark, the hats a glint", every scene came back with a floor
 * pulse, a spark and a glint; and told the voice was for "anything that
 * follows a voice", lights and whole landscapes were hung on it. A ban
 * leaves everything else open.
 *
 * Every fact here is how the listening behaves (`energyLevels.ts`,
 * `energyPulse.ts`, `rhythmKit.ts`, `rhythmSection.ts`, `voiceReading.ts`)
 * and every figure one measured on real songs: change them together.
 *
 * English, like the rest of the prompt: it is read by a model.
 */
const SIGNALS_SECTION = `WHAT EACH SIGNAL IS, AND WHAT IT MUST NEVER DRIVE
Each of these hears one thing in the music. What you make of it is yours to
invent - nothing below says what to draw. What is banned is using a signal
for something it does not hear: that is what makes a scene look out of time
with its song. The same holds for a 3D world's formulas, whose signals mean
what these do.
- uBands.x, BASS: the kick and the bass line, and nothing else - notes
  whose own pitch is 30 to 115 Hz. About 0.55 while the bass plays as it
  has been, 1 on a hit, 0 with no bass in the music. Up at once, down
  within a tenth of a second.
  NEVER for anything the singer, a guitar, a piano or the snare should
  move. NEVER as "how loud the song is". NEVER to shake, zoom or scale the
  whole picture or the camera: every kick would pump the frame.
- uBands.y, MIDS: what LASTS between 200 Hz and 4.5 kHz - chords, pianos,
  guitars, pads and voices, all together, with the drums' cracks taken
  out. The slowest and the steadiest of the three: mostly between 0.45 and
  0.75.
  NEVER as a beat or a hit: it has none. NEVER as the voice: it cannot tell
  a singer from a piano. NEVER expect it at 0 or at 1; anything that waits
  for those never happens.
- uBands.z, TREBLE: the drums' own part of the top, from 5 kHz - hats,
  cymbals, shakers. A singer's "s" and a synth's air are mostly left out of
  it. The fastest: it falls in a twentieth of a second, so eighth notes
  stay apart, and it rests near 0 where nothing is played up there.
  NEVER on a large area's brightness: eight hats a second on half the frame
  is the flashing FluidEQ refuses. NEVER to move a body or a camera. NEVER
  as melody or as the voice: neither is in it.
- uLevel: how full the whole mix is against its own loudest lately. In a
  loud song it stays between 0.75 and 1 nearly all the time, and falls only
  in a break, a fade or silence.
  NEVER as a beat: it does not pulse with the hits. NEVER as the one thing
  a scene answers: it would sit lit and still through the whole song.
  NEVER to tell a chorus from a verse: that is uSong.x.
- uBeat: a pulse on every beat of the tempo, 1 falling to 0 in a fifth of
  a second - on the beat whether or not a drum plays there.
  NEVER as the kick: it fires on beats with no kick. NEVER on a large
  area's brightness. NEVER to move a body: it is over before a body could
  arrive, and uRhythm knows where the beat WILL be.
- uDrums: the kick, the snare or clap, and the hats, each 1 the moment it
  is recognised and gone within a tenth of a second. Recognised: a song
  with no drums gives none, a busy mix hides some hits, and a drum new to
  the song takes a bar to be believed.
  NEVER the only thing that keeps a scene alive: it must look whole when
  uDrums stays at 0 for a minute. NEVER to count beats or keep time: a
  missed hit is a missed step. NEVER to move a body. NEVER the kick's for
  the bass line, or the hats' for brightness that fills the frame.
- uRhythm: a clock, not a sound. It says where in the beat and the bar the
  music is, ahead of the hits.
  NEVER without weighing by uRhythm.w: unsure, it is a clock nobody set.
  NEVER for light that should answer what is actually played: it keeps
  ticking through a break.
- uSong: the song's shape over seconds. x is how intense this part is
  against the rest of the song, y a build, z a drop landing.
  NEVER for anything that should move with a beat or a note: x takes a
  second and a half to follow. NEVER wait on z or y for the scene's main
  event: most songs have no build and no drop at all.
- uMusicAccent: a rare big moment, about one a minute.
  NEVER as a beat. NEVER for something the scene needs to keep going.
- uMusicRun: momentum that builds through a loud passage and coasts down.
  NEVER multiplied by anything but a whole number. NEVER as a hit: it has
  no edges.
- uSpectrum and uSpectrumSlow: the whole spectrum, for drawing it or for
  parts that each follow their own place in it.
  NEVER read raw as "how much": the bass end stands high all the time and
  the top octaves low, so a part hung on one raw place is stuck on or
  stuck off. NEVER uSpectrum (the fast one) on brightness: it flickers.
- uStereo: where the mix leans and how wide it is. Small, and often 0: a
  great many songs are nearly mono.
  NEVER for anything the scene needs to see happen.
- uVoice: a human voice, singing or speaking - x the mouth, syllable by
  syllable, y the note, z how sure it is that a voice is there.
  ONLY for a character who sings or speaks in the scene: its mouth, its
  jaw, its throat, its breath, its face as it sings. A scene with no such
  character NEVER reads uVoice at all.
  NEVER for lights, colours, particles, scenery, the camera, or any body
  that is not the singer's own: those belong to the music, and the voice
  comes and goes with every phrase. NEVER without weighing by
  smoothstep(0.3, 0.6, uVoice.z): a mouth must stay shut through an
  instrumental. NEVER to move a whole body by uVoice.x: it would chatter.
  It can take a lead instrument that bends its notes as a voice does - a
  violin's solo, a slide guitar - for one: never build a scene that breaks
  when it does.

`;

export default SIGNALS_SECTION;
