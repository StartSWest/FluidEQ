/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dictionary } from '../en';

/**
 * The Linux words for every string the Linux app shows that speaks of
 * Windows or Equalizer APO (`./index.ts` says how they are used). The keys
 * are the shared ones, so a merge from main changes none of them; a key whose
 * screen Linux hides (the APO repairs, Dynamic lighting)
 * is not here at all.
 */
const en: Partial<Dictionary> = {
  'wallpaper.manage.empty':
    'Every monitor is showing its ordinary desktop background.',
  'wallpaper.monitor.ordinary': 'Desktop background',
  'wallpaper.pause.locked': 'Paused while the screen is locked',
  'wallpaper.error.unsupported':
    'Desktop backgrounds require GNOME and the FluidEQ Desktop extension.',
  'wallpaper.error.host':
    'The visualizer could not reach the desktop. Enable FluidEQ Desktop in Extensions and try again.',
  'app.menu.restartAudio': 'Restart audio',
  'restart.title': 'Restart audio',
  'restart.failed': 'The audio could not be restarted.',
  'notice.restartConfirm':
    'Audio will stop for a few seconds while the FluidEQ Engine starts again. Continue?',
  'notice.restartDone':
    'Audio restarted. Reopen any application that is still silent.',
  'troubleshoot.restart.title': 'Restart audio',
  'troubleshoot.restart.cost':
    'A few seconds of silence while the FluidEQ Engine starts again. No password.',
  'engine.title': 'How FluidEQ processes your sound',
  'engine.subtitle':
    'The FluidEQ Engine runs beside your sound server, PipeWire or PulseAudio, for as long as FluidEQ is open.',
  'engine.fluid.l1': 'Works with PipeWire and PulseAudio, on any distribution',
  'engine.fluid.l2':
    'EQ and the DSP rack apply to everything you hear, no restart',
  'engine.fluid.l3': 'Plugin: lines and VST plugins in the config do not run',
  'output.hint':
    'Edits save to the profile that is on and follow this output whenever it is the one playing.',
  'extraOutput.ambiguous':
    'Two outputs share this name, so FluidEQ cannot tell which one you mean. Rename one in your sound settings.',
  'extraOutput.unmatched':
    'Your sound settings list this output but FluidEQ cannot reach it, so it cannot be mirrored to.',
  'convolution.eyebrow': 'Impulse responses',
  'convolution.notice.fluid':
    'AutoEq provides the downloadable catalogue. Each download matches the rate your output runs at, and the FluidEQ Engine converts any other rate itself.',
  'graph.scene.gpu.auto': 'The system decides',
  'settingsReset.body':
    'The graph and visualizers, Window colours, the player, the Library, the language, Animations, Start when you sign in and the desktop background go back to how a new install of FluidEQ starts.',
  'app.processes.hint':
    'Your system names every one of these after the app, because they are all the same program. This is what each one actually does for FluidEQ.',
  'app.processes.what.engine':
    'FluidEQ’s own engine. Decodes what you play and applies the equalizer as it goes. A separate program from the rest, so a busy window cannot stall the music.',
  'app.processes.what.devices':
    'Started by Chromium when the app asks which audio devices there are; the same request also lists video devices. It opens no camera and records nothing.',
  'app.processes.name.systemEngine': 'FluidEQ Engine (system audio)',
  'app.processes.what.systemEngine':
    'The equalizer between your apps and your sound server, which applies it to everything you hear. FluidEQ starts it and stops it with itself; its memory and CPU are shown but not added to the total.',
  'dsp.normalizer.liveGuidance':
    'Live leveling follows the song that is playing. A loud passage lowers the gain for the rest of the song; the next song keeps that level unless it is much quieter. Songs heard before are leveled from the first second. Gain rises at most 6 dB, within peak headroom; the target is not guaranteed. Switch Off and on to relearn. It cannot repair existing distortion.',
  'dsp.latency.hint':
    'The engine’s added processing delay. Sound server, device and network latency are not included.',
  'dsp.latency.note':
    'Engine-reported processing buffers at the current sample rate. Sound server, device and network latency are not included.',
  'dsp.surround.onHint':
    'Runs the rack on every channel of a 5.1 or 7.1 output, following what your output is set to, with one level decision for all of them.',
  'update.mandatory.failedInstall':
    'The update was downloaded, but the installer did not start. The downloaded file may be damaged.',
  'startup.label': 'Start when you sign in',
  'startup.blocked': 'Your desktop has this switched off in its startup apps',
  'startup.failed': 'Your system would not change this',
  'disclaimer.liability':
    'FluidEQ changes how audio is processed on your computer: its engine sits between your apps and your sound server and processes everything you hear. To the fullest extent the law allows, {author} is not liable for any damage arising from using it — to your hearing, to speakers, headphones or other equipment, to data or other software, or to anything else, including loss you could not have foreseen.',
  'provenance.body':
    'FluidEQ’s official packages are delivered only through fluideq.com. Source builds should come from the official repository. The GPL permits third parties to copy, modify, rebuild, and sell FluidEQ, but their builds are not reviewed, supported, or endorsed by FluidEQ. If a download claims to be official and did not come from fluideq.com or the official repository, close it and report it.',
  'engineHealth.offBody':
    'Sound is playing on this output without your EQ. Restarting audio usually brings the engine back, and everything else in FluidEQ keeps working meanwhile.',
  'engineHealth.rackNeedsEngine':
    'The DSP effects run inside the engine itself. Restarting audio starts it again; if that does not help, reinstalling FluidEQ puts its own engine back in place.',
  'tour.engine.lead':
    'FluidEQ now has an audio engine of its own. It runs beside your sound server, PipeWire or PulseAudio, and brings your EQ and the whole DSP rack to everything the computer plays: games, browsers, streaming apps — not only the Library.',
  'tour.engine.flow.inside': 'Beside your sound server',
  'tour.dsp.lead':
    'A rack of studio stages: Normalizer, Denoise, Exciter, Bass Forge, Equaliser, Bass Punch, Dimension, Room, Maximizer and Master, plus a crossfade between Library tracks. It plays on everything the computer plays. Each stage has its own page with a live view, most have presets, and five have an Isolate switch to hear only what they are doing.',
  'tour.dsp.how':
    'Open the DSP tab, pick a chain under Presets, then click a stage in the side tabs and switch it On.',
  'help.start.steps':
    'Install FluidEQ from its .deb or AppImage and open it: the FluidEQ Engine starts with it, with no password and no restart.\nChoose your listening device under Output device. Turn on System EQ and leave Auto normalize on.\nPlay a song, open EQ → Bands, make a small change, and compare with System EQ off and on.',
  'help.start.tip':
    'System-wide EQ on Linux needs PipeWire or PulseAudio, which every current desktop uses. While FluidEQ is open everything you play goes through it; quitting gives your sound back untouched.',
  'help.window.tip':
    'Help opens this guide, What’s new, the audio troubleshooter and Report a problem. The pulse button beside it holds the engine card, your account, importing EQ settings or an impulse response, restarting audio and Processes, which shows what each part of FluidEQ is using; at its foot are Brightness and Transparency, animations, Start when you sign in and the language. The switch after them turns the window into the Compact player.',
  'help.window.actions':
    'The engine, your account, importing EQ settings, restarting audio and Processes; Brightness and Transparency, animations, Start when you sign in and the language.',
  'help.player.tip':
    'The player’s volume is your computer’s own, so it sets the level of everything the computer plays. If the player ends up off the screen, right-click FluidEQ’s icon in the top bar and choose Recover the window.',
  'help.player.volume':
    'Your computer’s volume: it sets the level of everything the computer plays.',
  'help.requirements.intro':
    'FluidEQ runs on any 64-bit Linux desktop of the last several years — Ubuntu, Debian, Fedora, Mint, Arch and the rest. Two parts ask for more than the rest: the Plus visualizers draw on the graphics card, and the karaoke AI downloads its models the first time you use it.',
  'help.requirements.steps':
    'Check your system: 64-bit Linux with PipeWire or PulseAudio (every current desktop has one), 4 GB of memory and about 600 MB of disk. The .deb is for Ubuntu, Debian and their relatives; the AppImage runs on the rest.\nLook at a visualizer: any graphics card or built-in graphics from 2013 onwards. At 1080p built-in graphics are enough; 4K is happier with a dedicated card. On a busy card FluidEQ draws the scene smaller and lets go of the ones you cannot see.\nTry the karaoke AI: separating a voice downloads a 713 MB model the first time, the pitch model adds about 180 MB, and noise removal 11 MB. It runs on the processor, where a four-minute song separates in about four minutes. Keep 2 GB of memory free while it works.\nAim for this if you can: 8 GB of memory, graphics from 2018 onwards, and 3 GB of disk free if you use the AI features.',
  'help.requirements.keywords':
    'system requirements, requirements, specs, hardware, laptop, gpu, graphics card, video card, cpu, processor, ram, memory, disk space, storage, linux, ubuntu, debian, fedora, mint, arch, pipewire, pulseaudio, deb, appimage, minimum, recommended, performance, slow, lag, compatibility',
  'help.engine.intro':
    'FluidEQ processes your sound with its own engine. The FluidEQ Engine runs beside your sound server (PipeWire or PulseAudio): it becomes the system’s output, brings your EQ and the DSP rack to everything the computer plays, sends the result on to your real output, and steps aside the moment FluidEQ closes.',
  'help.engine.steps':
    'Open the actions menu — the pulse button at the top right. The engine card at the top of it says whether the engine is running.\nPick the output you listen on in the Output panel. FluidEQ plays to it, and follows you when you pick another one in your sound settings.\nIf a notice says the engine is not running, press Restart audio.',
  'help.engine.tip':
    'Leave FluidEQ as the system’s output: picking speakers or a headset in your sound settings is fine, FluidEQ follows them. Quitting FluidEQ gives every app back to the output you chose.',
  'help.engine.keywords':
    'audio engine, driver, system-wide, all apps, every app, spotify, browser, discord, pipewire, pulseaudio, sound server, output, default output, restart audio',
  'help.engine.apo':
    'Not on Linux: Equalizer APO is a Windows program, and the FluidEQ Engine does its work here.',
  'help.engine.apply':
    'Not needed on Linux: the FluidEQ Engine is the only engine, and it is already the one in use.',
  'help.convolution.tip':
    'The FluidEQ Engine converts any impulse rate itself. Catalogue downloads need a connection; the guide does not.',
  'help.profiles.output':
    'The output you are listening on, with its battery for Bluetooth headphones. OFF means your EQ does not reach it; ACTIVE, that it is the output playing now.',
  'help.config.tip':
    'Generated layer files are rewritten when their settings change; put lasting manual lines in the per-output custom file. The FluidEQ Engine reads its Filter, Preamp, GraphicEQ and Convolution lines; Plugin: lines and VST plugins do not run on Linux.',
  'help.dsp.intro':
    'The DSP rack is a chain of studio stages. Under the FluidEQ Engine it processes everything the computer plays. It is off while FluidEQ is switched off.',
  'help.room.tip':
    'Games and films only send their surround channels to an output set up with that many speakers: when your device has them, choose 5.1 or 7.1 for it in your sound settings.',
  'help.online.tip':
    'Under the FluidEQ Engine, Online Media goes through your EQ and the DSP rack like every other app.',
  'help.library.tip':
    'Library needs the original files: reconnect a drive or add a moved folder again.',
  'help.share.tip':
    'Keep the connection code private: it authorizes linking. This computer keeps its DSP on while it shares, and the computer playing its sound applies its own. Playing and sending at once needs Windows, or the FluidEQ Engine on Linux, on that computer; elsewhere a link runs one way.',
  'help.trouble.steps':
    'No sound: confirm playback is running, the expected output is selected, volume is up, and the device is connected. Check whether One player at a time paused another source.\nNo EQ change: confirm System EQ is on and the output shows no OFF badge. If a notice says the engine is not running, press Restart audio.\nEverything looks right and the EQ still does nothing: check that FluidEQ is still the output in your sound settings; restarting audio puts it back.\nDistortion or excessive bass: leave Auto normalize on, reduce boosts and bypass layers one at a time. If it persists, use Report a problem and review the report before sending.',
  'troubleshoot.description':
    'On Linux one step fixes almost every problem: restarting the FluidEQ Engine, which takes a few seconds.',
  'troubleshoot.footer':
    'Still wrong after that? Use **{report}** in the same menu — it collects the logs, with anything identifying you stripped out, and shows you the whole thing before it goes anywhere.',
  'help.window.plus': 'Visualizers, the gallery and the Studio.',
  'help.plus.intro':
    'An account is optional: everything that was free runs on this computer without one. Signed in, the Plus tab holds Visualizers and the Studio. A scene from Visualizers costs one credit and is yours for good; a confirmed account gets some credits free, and packs of credits are paid once.',
  'help.library.steps':
    'Open Library and add the folder containing your media. Let the scan finish before judging what is missing.\nChoose an artist or album, or search for a song. Start a track from the results.\nUse the bar at the foot of the window to pause, seek and skip. Its volume is your computer’s own.',
};

export default en;
