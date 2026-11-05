/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/** Detailed guides for the current sound and playback tools. */
const helpDetails = {
  'help.dynamics.title': 'Dynamics: quiet and loud passages',
  'help.dynamics.intro':
    'Dynamics is a three-band compressor that lifts quiet passages and holds loud ones without adding delay. Use it on music, films, speech or a game’s own sound.',
  'help.dynamics.steps':
    'Open DSP → Dynamics, switch it on and choose a preset as a starting point. Everyday presets are here; presets for games are in the Gaming Lab.\nThe three bands cover lows below 150 Hz, the middle from 150 Hz to 4 kHz, and highs above 4 kHz. Tune the band containing the sound you want to change.\nUnder Lift, Below sets when quiet sound is raised, Ratio sets how strongly, and Up to limits the added gain. A ratio of 1:1 leaves it alone.\nUnder Hold, Above sets where loud sound is reduced and Ratio sets how firmly. Lowering Above makes the hold act more often.\nSet Attack and Release for the response, Mix to blend with the unprocessed signal, and Make-up to adjust the result’s level. Compare at a similar listening volume.\nThe graph shows sound before and after the stage and the gain actually applied: a rise is lift and a dip is hold. If a notice asks for an Engine update, sound processing may already work while the live display needs the update.',
  'help.dynamics.tip':
    'Keep the loudness similar when comparing. Strong lift also brings quiet background noise forward; less Mix can keep more of the original movement.',
  'help.dynamics.keywords':
    'dynamics, compressor, compression, upward compression, downward compression, lift, hold, attack, release, mix, makeup, quiet passages, loud passages',
  'help.deesser.title': 'De-esser: soften sharp voices',
  'help.deesser.intro':
    'The De-esser reduces sharp S, T and SH sounds when they occur. Its four groups decide what it hears, what it turns down, how fast, and where in the stereo sound it acts.',
  'help.deesser.steps':
    'Open DSP → De-esser, switch it on and try a preset while a recording with a sharp voice plays.\nIn Find, set the lower and upper listening frequencies around the harsh sound, then raise Sensitivity until those sounds are caught without reacting to every bright note.\nIn Reduce, Spectral follows only the offending frequencies; Treble turns down the upper band. Whole voice lowers the entire sound and is intended for an isolated voice. Set how far it may reduce, and the width where available.\nUse Timing to catch the beginning of the sound and set how quickly the treble returns. In Where, Centre only concentrates on a centred voice; Keep cymbals protects bright hits.\nTurn Isolate on to hear only what is removed, then turn it off to judge the complete recording. The display follows the control you are adjusting and shows what the stage did.\nSave a useful setting from the stage’s preset bar. Choosing a whole-rack chain later can replace the stage settings, so save the complete rack too if you want to keep it.',
  'help.deesser.tip':
    'If a voice lisps or the music loses air, reduce Sensitivity or the maximum reduction. This is playback processing, not a microphone effect.',
  'help.deesser.keywords':
    'de-esser, deesser, de essing, sibilance, sharp voice, harsh voice, spectral, centre only, center only, cymbals, isolate',
  'help.normalizer.title': 'Normalizer and live level control',
  'help.normalizer.intro':
    'The Normalizer changes the source level before the creative stages. Library files can be measured in full; other system audio is learned while it plays.',
  'help.normalizer.steps':
    'Open DSP → Normalizer. Choose Off, True Peak or Loudness. Leave it Off when you do not want source-level adjustment.\nFor Library playback, let Source analysis finish. True Peak sets one gain for the file against Peak ceiling; Loudness aims for Loudness target while respecting the peak limit.\nRead Applied gain and the limiting reason. A source cannot always reach the requested loudness without exceeding its peak ceiling.\nFor external audio under the FluidEQ Engine, the card becomes Live level control with Peak protection or Live leveling. Learning source and Holding gain describe what it is doing now.\nLive leveling follows the song Windows identifies. A louder passage can lower the gain held for that song. Switch Off and on to start learning again when the source or its identity was wrong.',
  'help.normalizer.tip':
    'This differs from Auto normalize in the left rail, which manages EQ headroom, and from Master, which trims the finished output. None can repair distortion already in a recording.',
  'help.normalizer.keywords':
    'normalizer, normalisation, normalization, lufs, loudness target, true peak, peak ceiling, applied gain, leveling, live level control, learning source, holding gain',
  'help.crossfade.title': 'Crossfade and custom fade curves',
  'help.crossfade.intro':
    'Crossfade overlaps consecutive Library tracks. Its playback settings are separate from the DSP filters and do not crossfade other apps or Karaoke.',
  'help.crossfade.steps':
    'Put at least two tracks in the Library queue. In DSP, choose Crossfade under Playback options and switch it on.\nSet Duration, then choose Equal power, Smooth or Linear. Let the first track reach its ending to hear the overlap.\nChoose Custom to shape the outgoing and incoming fades. Drag the handles, or focus a handle and use the arrow keys to adjust it.\nWatch both curves and the combined level. Keeping both high together can make the overlap louder.\nSave curve keeps a shape under its own name; choose it again from the saved list. Reset shape returns the editable shape to its starting form.',
  'help.crossfade.tip':
    'If the controls are unavailable, start a Library audio track. A fade shape changes the transition between songs, not the EQ curve of either song.',
  'help.crossfade.keywords':
    'crossfade, fade, transition, overlap, dj, equal power, custom curve, save curve, outgoing, incoming',
  'help.gamefilter.title': 'The Game filter: steps, surroundings and voices',
  'help.gamefilter.intro':
    'The Game filter gives each game separate control over quiet cues, its background and dialogue. Start from that game’s profile, then tune its own copy while listening.',
  'help.gamefilter.steps':
    'Open Gaming Lab, select a game and press Try it now if its sound is not already on. Choose Game in that game’s parts.\nRaise the footsteps lift for quiet steps, reloads and doors. Calm holds distracting loud events; compare before pushing both controls.\nHooves and heavy steps brings more of the low weight forward for boots, horses and vehicles. Leave it off when it makes cues too heavy.\nEnvironment turns the game’s bed down or up. The stage lets go when a step or another distinct sound stands out, so the cue is not lowered with the background.\nDialogue brings a centred voice forward. Make room lowers the rest a little while somebody speaks.\nUse Isolate to hear what Game changes, then return to the full game. Save as profile keeps your tuning for other games; resetting the game returns it to its starting profile.',
  'help.gamefilter.tip':
    'A profile for a game with its own 3D audio can keep the Room off to avoid processing its positioning twice. Room profiles are for headphones. Your music sound returns when the game’s sound is unloaded.',
  'help.gamefilter.keywords':
    'game filter, footsteps, lift, calm, environment, ambience, dialogue, voices, make room, hooves, heavy steps, isolate, hrtf, spatial audio',
  'help.songs.title': 'Remember each song’s sound',
  'help.songs.intro':
    'A song can remember its preset, Tone and EQ separately for each output. A song tuned on headphones does not change the sound saved for your speakers.',
  'help.songs.steps':
    'Under the output’s profiles, turn on Remember each song’s sound. It is off until you choose to use it.\nPlay an identifiable song, then change its preset, Tone or EQ. A notice tells you that the sound will be kept; use its do-not-save action if this was only an experiment.\nWhen that song plays again on the same output, its sound comes back temporarily. Undo skips it for this play; Forget this song also removes the saved memory.\nWhen the song ends, the output’s previous sound comes back. Choosing a different profile deliberately lets you take control again.\nSmart EQ has its own Save for this song control while it measures. That remembers the measured Smart EQ correction; it is separate from remembering your hand-tuned preset, Tone and bands.',
  'help.songs.tip':
    'Song identity comes from the local file or the player’s media information. Missing or wrong titles can prevent a match. The preamp is not stored with a song, and a game’s own sound takes priority while it is loaded.',
  'help.songs.keywords':
    'per song, song sound, song memory, remember song, save song eq, smart eq, undo, forget this song, preset per song, tone per song',
  'help.mycurves.title': 'My curves: import, edit and share',
  'help.mycurves.intro':
    'My curves is your own library beside the headphone measurement library. Keep a curve once, inspect its response and choose whether it becomes a correction layer or editable EQ bands.',
  'help.mycurves.steps':
    'Open the EQ Presets page and choose My curves. Search or sort the list to find a saved curve.\nUse Add curve for your current EQ, a text file, a measurement-library pick or pasted data. Import from Squiglink accepts its exported EQ text. Review the preview before saving.\nApply as curve adds a correction layer and leaves your editable bands in place. Apply as EQ replaces the selected ear’s editable bands after confirmation; choose Both ears, Left ear or Right ear under Import into.\nA curve’s menu can rename it, edit its bands, duplicate it, copy it as text or delete it. Editing a saved curve does not require starting the import again.\nExport list and Import list carry the whole collection between computers. Keep the measurement author and model clear when you share a correction.',
  'help.mycurves.tip':
    'A curve and a full sound profile are different: a curve describes a frequency response; an output profile also keeps the rest of that output’s sound. Check the model and source before applying a correction.',
  'help.mycurves.keywords':
    'my curves, custom curve, squiglink, import list, export list, apply as curve, apply as eq, left ear, right ear, curve editor, measurements',
} as const;

export default helpDetails;
