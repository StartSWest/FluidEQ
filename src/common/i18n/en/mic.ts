/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab: each microphone's own sound, played by the FluidEQ Engine on
 * the microphone itself, so every app hears it (Ivan, 2026-11-20).
 */
export default {
  'mic.tab': 'Mic',
  'mic.label': 'Microphone',
  'mic.pickHint': 'Choose the microphone to shape',
  'mic.list.heading': 'Microphones on this PC',
  'mic.list.on': 'On',
  'mic.list.off': 'Not set up',
  'mic.live': 'Live in every app',
  'mic.notSetUp': 'Not set up on this mic yet',
  'mic.state.opening': 'Opening the mic…',
  'mic.state.noInput': 'Windows lists no input for this mic right now',
  'mic.state.blocked': 'Windows would not let FluidEQ open this mic',
  'mic.state.waiting': 'Mic open · waiting for the engine to start on it',
  'mic.meter.gateOpen': 'Voice passing',
  'mic.meter.gateClosed': 'Gate closed',
  'mic.meter.compressor': 'Compressor',
  'mic.meter.limiter': 'Limiter',
  'mic.monitor.label': 'Hear the final result',
  'mic.monitor.hint':
    'Plays what others hear to the output you are listening on',
  'mic.monitor.warning':
    'Use headphones: on speakers your voice goes back into the mic and howls.',
  'mic.effectsOff.short': 'Windows’ audio enhancements are off for this mic',
  'mic.effectsOff.title': 'Audio enhancements are off for {mic}',
  'mic.effectsOff.body':
    'With them off, Windows runs no effect on this mic, so FluidEQ cannot shape it. Turn on “Audio enhancements” in the mic’s properties.',
  'mic.effectsOff.button': 'Open Windows sound settings',
  'mic.picture.label':
    'Your voice: what the mic picks up, faint, and what others hear, bright',
  'mic.picture.raw': 'Your mic',
  'mic.picture.heard': 'What others hear',
  'mic.picture.gate': 'Gate',
  'mic.profile.label': 'Mic profile',
  'mic.profile.pickHint': 'Start from a profile made for how you use the mic',
  'mic.profile.group.use': 'By use',
  'mic.profile.group.mic': 'By mic',
  'mic.profile.tuned': 'tuned',
  'mic.profile.stream': 'Streaming',
  'mic.profile.stream.hint': 'Warm, close and steady for Twitch and YouTube',
  'mic.profile.podcast': 'Podcast',
  'mic.profile.podcast.hint': 'A natural voice with gentle control',
  'mic.profile.chat': 'Game chat',
  'mic.profile.chat.hint':
    'Clear and forward in Discord and team chat, nothing between words',
  'mic.profile.sing': 'Singing',
  'mic.profile.sing.hint':
    'Open and airy, nothing that pumps, every breath kept',
  'mic.profile.broadcast': 'Broadcast',
  'mic.profile.broadcast.hint': 'Radio voice: a big low end, tight and dense',
  'mic.profile.noisy': 'Noisy room',
  'mic.profile.noisy.hint':
    'Fans, children, traffic: the cleaner and gate at full',
  'mic.profile.meet': 'Meetings',
  'mic.profile.meet.hint':
    'Teams and Zoom: clear words, leaves their own cleanup to them',
  'mic.profile.laptop': 'Laptop mic',
  'mic.profile.laptop.hint':
    'Thin, far and roomy: the low cut high, the cleaner strong',
  'mic.profile.headset': 'Headset boom',
  'mic.profile.headset.hint':
    'A small capsule close to the mouth: warmth back, pops out',
  'mic.reset': 'Reset to {profile}',
  'mic.setup.title': 'The FluidEQ Engine isn’t on {mic} yet.',
  'mic.setup.body':
    'Windows asks once for permission. Your outputs keep playing while it is set up.',
  'mic.setup.button': 'Set up on this mic',
  'mic.setup.working': 'Setting up…',
  'mic.setup.declined': 'Windows did not give permission, so nothing changed.',
  'mic.setup.failed': 'It could not be set up on this mic.',
  'mic.notFluid.title': 'A mic’s own sound plays on the FluidEQ Engine.',
  'mic.notFluid.body':
    'Its sound is kept, and plays as soon as the FluidEQ Engine is the one chosen.',
  'mic.empty.backTitle': 'Windows is bringing your microphones back',
  'mic.empty.backBody':
    'They show here as soon as Windows lists them again, usually a moment after its audio restarts.',
  'mic.empty.lookAgain': 'Look again',
  'mic.empty.title': 'No microphone found',
  'mic.empty.body':
    'Plug a microphone in, or update the FluidEQ Engine so it can list them.',
  'mic.stage.lowCut': 'Low cut',
  'mic.stage.cleaner': 'Noise cancelling',
  'mic.stage.gate': 'Gate',
  'mic.stage.deEsser': 'De-esser',
  'mic.stage.eq': 'EQ',
  'mic.stage.compressor': 'Compressor',
  'mic.stage.limiter': 'Limiter',
  'mic.lowCut.title': 'Low cut',
  'mic.lowCut.description':
    'Takes away rumble, desk knocks and the fan below the voice, before the cleaner hears it.',
  'mic.lowCut.group.below': 'Below the voice',
  'mic.lowCut.group.belowHint':
    'Close to the mic takes back the extra bass a voice gets a few centimetres from the capsule.',
  'mic.lowCut.cut': 'Cut below',
  'mic.lowCut.proximity': 'Close to the mic',
  'mic.lowCut.group.pops': 'Pops',
  'mic.lowCut.group.popsHint':
    'Softens the thump of a P or a B and leaves a steady voice alone.',
  'mic.lowCut.plosive': 'Pop guard',
  'mic.gate.title': 'Gate',
  'mic.gate.description':
    'Closes the mic between words so the room, the fan and the keyboard stay out. A small range makes it a gentle expander.',
  'mic.gate.group.level': 'When it opens',
  'mic.gate.group.levelHint':
    'Watch the dashed line in the picture: your voice should pass it, the room should stay under it.',
  'mic.gate.threshold': 'Opens at',
  'mic.gate.range': 'Closes by',
  'mic.gate.group.time': 'How fast',
  'mic.gate.group.timeHint':
    'Hold keeps it open between syllables, so the ends of words are never cut.',
  'mic.gate.attack': 'Opens in',
  'mic.gate.hold': 'Hold',
  'mic.gate.release': 'Closes in',
  'mic.monitor.on': 'Hearing the final result',
  'mic.delay.label': 'Delay',
  'mic.delay.measured':
    'measured by the engine on this mic, from the capsule to every app',
  'mic.delay.unknown': 'the engine has not measured this mic yet',
  'mic.delay.windows': 'Windows',
  'mic.rail.master': 'Mic processing',
  'mic.rail.note':
    'Every switch turns its stage fully off: no sound change, no delay. The number beside a stage is the delay it adds.',
  'mic.meter.noise': 'Noise taken',
  'mic.cleaner.description':
    'Takes keyboards, fans and the room out from under your voice, as you speak.',
  'mic.cleaner.strength': 'Strength',
  'mic.cleaner.neverCuts': 'Never cuts',
  'mic.cleaner.neverCutsHint':
    'If the model is ever late, the voice keeps the level of the last cleaned moment and is joined without a click, never the raw room. Late moments are counted here.',
  'mic.cleaner.lateMinute': 'late blocks in the last minute',
  'mic.gate.live.title': 'Your voice against the gate',
  'mic.gate.live.hint':
    'Drag the line up or down. The grey stretches are where the gate held the room down.',
  'mic.gate.live.opens': 'opens {db} dB',
  'mic.live.ago': '−{seconds} s',
  'mic.live.now': 'now',
  'mic.gate.live.stateOpen': 'Open',
  'mic.gate.live.stateClosed': 'Closed',
  'mic.gate.live.waiting': 'Waiting for your voice',
  'mic.gate.live.keyLevel': 'What the gate hears',
  'mic.gate.live.keyClosed': 'Held down',
  'mic.gate.live.keyOpens': 'Opens',
  'mic.gate.live.keyCloses': 'Closes',
  'mic.gate.live.label':
    'The level the gate hears over the last five seconds, against where it opens and where it closes',
  'mic.gate.live.openShare': 'Open, last {seconds} s',
  'mic.lowCut.live.title': 'Where your voice sits',
  'mic.lowCut.live.keyKept': 'Your voice, kept',
  'mic.lowCut.live.keyTaken': 'Taken away',
  'mic.lowCut.live.keyCut': 'The cut',
  'mic.lowCut.live.label':
    'Your voice as it arrives, with what the low cut takes away',
  'mic.lowCut.live.chip': '{hz} Hz · {slope} dB/oct',
  'mic.lowCut.live.hum': 'hum {hz} Hz',
  'mic.lowCut.live.taken': 'Rumble taken now',
  'mic.lowCut.live.lowest': 'Lowest note of your voice',
  'mic.lowCut.live.hint':
    'Drag the dot left or right, and keep it under your lowest note.',
  'mic.cleaner.live.title': 'Voice and room, now',
  'mic.cleaner.live.keyBefore': 'What the mic hears',
  'mic.cleaner.live.keyAfter': 'After cleaning',
  'mic.cleaner.live.label':
    'Your voice and your room before and after the cleaner',
  'mic.cleaner.live.roomBefore': 'Room before',
  'mic.cleaner.live.roomAfter': 'Room after',
  'mic.cleaner.live.taken': 'Room taken',
  'mic.cleaner.live.over': 'Voice over the room',
  'mic.cleaner.live.hint':
    'Grey is your room as the mic hears it; the colour is what the cleaner leaves.',
  'mic.cleaner.strengthHint':
    'How much of the room the cleaner takes. Past 80% a voice starts to sound processed.',
};
