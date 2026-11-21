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
  'mic.live': 'Live in every app · low lag {ms} ms',
  'mic.notSetUp': 'Not set up on this mic yet',
  'mic.apoLive': 'EQ and low cut by Equalizer APO · 0 ms',
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
  'mic.profile.noisy.hint': 'Fans, children, traffic: the cleaner and gate at full',
  'mic.profile.meet': 'Meetings',
  'mic.profile.meet.hint':
    'Teams and Zoom: clear words, leaves their own cleanup to them',
  'mic.profile.laptop': 'Laptop mic',
  'mic.profile.laptop.hint': 'Thin, far and roomy: the low cut high, the cleaner strong',
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
  'mic.empty.title': 'No microphone found',
  'mic.empty.body':
    'Plug a microphone in, or update the FluidEQ Engine so it can list them.',
  'mic.stage.lowCut': 'Low cut',
  'mic.stage.cleaner': 'Voice cleaner',
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
};
