/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

const help = {
  'help.share.title': 'Share audio between computers',
  'help.share.intro':
    'Share Audio sends system audio between computers on the same private network. The receiver is the computer connected to your headphones or speakers; other computers are senders. This is separate from mirroring to a second device on one computer.',
  'help.share.steps':
    'On the listening computer, open Share Audio, choose Play audio on this computer and create a connection code. Start at a low volume.\nOn each source computer, choose Send audio from this computer, paste the receiver’s code, and connect. Keep FluidEQ open on both computers.\nCheck the connection monitor. Stop sending or listening when finished. If connection fails, check the shared private network and firewall permission.',
  'help.share.tip':
    'Keep the connection code private: it authorizes pairing. Several senders can mix together and raise the level. Received shared audio bypasses the Library DSP rack.',
  'help.menu': 'Help',
  'help.title': 'User guide',
  'help.subtitle': 'Find your sound. Make yourself at home.',
  'help.intro':
    'A practical guide to FluidEQ, illustrated with real app captures. Start with your first listening session, then explore each workspace at your own pace.',
  'help.offline': 'Available offline',
  'help.search': 'Search the guide',
  'help.searchHint': 'Try profiles, bass, lyrics…',
  'help.contents': 'In this guide',
  'help.results': '{count} chapters',
  'help.empty': 'No chapters found. Try a shorter phrase or clear the search.',
  'help.clear': 'Clear search',
  'help.close': 'Close guide',
  'help.enlarge': 'Enlarge screenshot: {title}',
  'help.closeImage': 'Close screenshot',
  'help.captureNote':
    'Real FluidEQ captures from version 1.6.x. Colours, labels and control positions may differ in your version. Example settings are illustrations, not recommended presets.',
  'help.steps': 'Try it',
  'help.tip': 'Good to know',
  'help.back': 'Back to top',
  'help.start.title': 'Your first five minutes',
  'help.start.intro':
    'Start with a familiar song and a comfortable volume. The left rail controls system EQ and headroom; the centre holds your workspace; the right rail follows your output and its profiles. Playback controls stay at the bottom.',
  'help.start.steps':
    'On Windows, install Equalizer APO when the FluidEQ installer offers it, select the listening device in its Device Selector, and restart when requested.\nChoose that device under Output device. Turn on System EQ and leave Auto normalize enabled.\nPlay a song, open EQ → Bands, make a small change, and compare with System EQ off and on.',
  'help.start.tip':
    'System-wide EQ requires Windows and Equalizer APO. The macOS and Linux interfaces use demonstration endpoints; do not treat a moving graph there as proof of system-wide processing.',
  'help.eq.title': 'Shape your sound with EQ',
  'help.eq.intro':
    'Frequency chooses where a band acts, Gain sets the boost or cut, and Q sets its width: higher Q is narrower. Low frequencies affect bass, the middle carries much of a voice, and the high end adds brightness. Begin with small changes.',
  'help.eq.steps':
    'Select a band in EQ → Bands. Adjust Frequency, Gain and Quality (Q), or drag its point on the response graph.\nUse a broad, gentle band for tonal balance. Compare before adding another. The filter selector changes the shape, including peak and shelves.\nUse the layer switches and strengths to compare headphone correction, EQ, voicing and Smart EQ separately. Leave Auto normalize on while adding boosts.',
  'help.eq.tip':
    'The response curve describes your filters; the moving spectrum describes the signal being measured. Smart EQ needs audible material to measure. Detail, Balance and Target make different kinds of correction; begin by comparing one mode at a time.',
  'help.headphones.title': 'Headphone correction & imports',
  'help.headphones.intro':
    'A headphone correction compensates for a measured model. It is a starting point you can combine with your own bands and voicing. Check the exact model and the measurement author before applying a result.',
  'help.headphones.steps':
    'Open EQ → EQ presets and search for your headphone model. Review the available measurements and choose the matching entry.\nFor EQ text from another tool, use Import EQ settings in Audio actions. Review the parsed bands and curve before applying.\nFor Squiglink, export the EQ text there, paste it into the import panel, and press Apply imported EQ when the preview is right.',
  'help.headphones.tip':
    'A preview marked not applied is not changing your sound. Avoid stacking two full corrections for the same headphones unless that is deliberate; compare with the headphone layer switched off.',
  'help.convolution.title': 'Use an impulse response',
  'help.convolution.intro':
    'Convolution applies a WAV impulse response as another correction layer. FluidEQ includes a searchable AutoEq catalogue and can import your own WAV. It remains separate from the editable parametric bands.',
  'help.convolution.steps':
    'Open EQ → Convolution. Search by model or measurement author.\nCheck the source and sample rate, then use Download and apply; use Import a WAV for a file you already have.\nListen with the convolution layer enabled and disabled. Adjust its strength before changing other layers.',
  'help.convolution.tip':
    'The impulse sample rate must match the output for Equalizer APO. Catalogue downloads need an internet connection; the guide itself does not.',
  'help.profiles.title': 'Devices, profiles & second output',
  'help.profiles.intro':
    'Your EQ follows the output device. Automatic mapping saves edits to the current endpoint, while Named profiles lets you keep alternative sounds. Second output mirrors playback to other devices with a separate level for each.',
  'help.profiles.steps':
    'Confirm Output device before editing. Use New profile for a sound you want to keep; Update saves changes to that named profile, and Restore brings its saved settings back.\nOpen Second output, enable a reachable device, and set its level. In current versions, choose that device’s saved EQ profile directly beneath it.\nUse Game/Video for a smaller starting buffer or Music for more reserve. Compare synchronization on your devices.',
  'help.profiles.tip':
    'Each mirrored Windows output uses its own APO profile. Mirroring runs while FluidEQ is open; switching the main output stops the old mirrors. Device latency still affects synchronization.',
  'help.config.title': 'Inspect & back up a chain',
  'help.config.intro':
    'EQ → Config shows what Equalizer APO actually has on disk. The output cards and include tree help you see which device and layers are involved. Export a chain before a large experiment or when moving a setup.',
  'help.config.steps':
    'Open EQ → Config and choose the output you want to inspect. Read its status and active layers.\nUse Export chain to save a .fluideq file. Keep a copy somewhere you can find again.\nTo bring a chain back, select the intended output first, then use Import chain and review the result.',
  'help.config.tip':
    'Generated layer files are rewritten when their settings change. For manual APO commands, use the per-output custom file that FluidEQ leaves alone; do not put lasting edits in generated layers.',
  'help.online.title': 'Listen with Online Media',
  'help.online.intro':
    'Online Media keeps supported sites beside your EQ. Site playback and sign-in still depend on the provider and your connection. The transport at the foot of FluidEQ follows the active player.',
  'help.online.steps':
    'Open Online Media and choose a supported site. Find and start something on that page.\nSwitch to EQ to tune while listening, then return to the page when you need its own controls.\nUse One player at a time if you want FluidEQ and other players to pause one another instead of overlapping.',
  'help.online.tip':
    'The DSP rack processes Library audio tracks, not Online Media. On Windows, system EQ can still affect the selected APO-enabled output.',
  'help.library.title': 'Build your local library',
  'help.library.intro':
    'Library brings together music and video from your drives. Browse by albums, artists, songs, folders or videos. Album art and metadata come from your files, so the same collection may look different depending on its tags.',
  'help.library.steps':
    'Open Library and add the folder containing your media. Let indexing finish before judging what is missing.\nChoose an artist or album, or search for a song. Start a track from the results.\nUse the bottom transport to pause, seek, skip and adjust playback volume while you work in another tab.',
  'help.library.tip':
    'Library needs access to the original files. If a drive is disconnected or a folder moves, reconnect it or add the new location.',
  'help.queue.title': 'Albums & your play queue',
  'help.queue.intro':
    'The queue is the listening order; browsing is where you choose music. Opening another album lets you explore without making it the current song. The active track and Up next help you keep your place.',
  'help.queue.steps':
    'Open an album to inspect its tracks. Start the one you want to hear.\nOpen the track menu for queue actions, such as playing next or adding to the queue.\nInspect Up next, then use shuffle or repeat when you want a different listening order.',
  'help.queue.tip':
    'Starting Library playback takes over from FluidEQ’s other players. Use the current track shown in the transport to confirm which source owns playback.',
  'help.dsp.title': 'Explore the DSP rack',
  'help.dsp.intro':
    'DSP processes audio tracks played from Library only. Karaoke, videos, received shared audio and other apps bypass this rack. The rack includes Normalizer, Denoise, Exciter, Bass Forge, Equaliser, Bass Punch, Dimension, Maximizer and Master.',
  'help.dsp.steps':
    'Play an audio track from Library, open DSP, and enable the rack. Start with a preset or one stage.\nSelect a stage, change one control, and compare with that stage bypassed at a similar listening volume.\nWatch output levels as you add processing. Save a rack you like; use Export and Import to exchange complete racks.',
  'help.dsp.tip':
    'The DSP Equaliser and system EQ are separate stages and can both affect Library playback on Windows. Extra loudness can sound better simply because it is louder; compare at similar volumes.',
  'help.denoise.title': 'Denoise & source analysis',
  'help.denoise.intro':
    'Denoise reduces unwanted noise in Library audio. Source analysis and its graph help you judge what the stage is responding to. Stronger reduction is not automatically better: listen for softened detail and watery or pumping textures.',
  'help.denoise.steps':
    'Play a Library audio track with the noise you want to reduce and select Denoise in DSP.\nBegin with a light setting, enable the stage, and listen to both quiet passages and musical detail.\nIncrease reduction gradually, then bypass the stage to check whether the improvement is worth any loss of detail.',
  'help.denoise.tip':
    'This is not a microphone cleanup switch and does not process the Online Media player. If you hear no change, first confirm the source is a Library audio track and both rack and stage are enabled.',
  'help.visuals.title': 'Make the player your own',
  'help.visuals.intro':
    'The response graph, live spectrum and level meter show different aspects of your sound. The visualizer offers multiple forms, palettes and peak looks. Appearance changes are independent of EQ settings.',
  'help.visuals.steps':
    'Turn on Response graph in the left rail. Use View on the graph to choose its size.\nPick a visualizer form, then open New look to adjust colour, fill, glow, spacing and peaks. Save the look with a name.\nFor the whole interface, open Audio actions and choose a theme or language. Use Ctrl + plus, minus or 0 to enlarge, shrink or reset UI zoom.',
  'help.visuals.tip':
    'A spectrum moving on screen is not proof that an EQ change reached your device. Compare what you hear and check the output status when diagnosing audio.',
  'help.karaoke.title': 'Sing with Karaoke',
  'help.karaoke.intro':
    'Karaoke pairs your own audio with lyrics. Timed lyrics follow playback; pitch targets depend on the song’s note data. A microphone adds your live pitch when configured, and the stage can fill the screen.',
  'help.karaoke.steps':
    'Open Karaoke. Use Add files or Add folder to bring in audio and matching lyric files.\nChoose a song and start playback. Check that the correct lyrics and backing track are paired.\nConfigure microphone input for live pitch, adjust lyric size for your viewing distance, and use the stage’s fullscreen control to sing.',
  'help.karaoke.tip':
    'A lyric-only file does not contain target notes. Missing pitch targets can mean the song has no note data; it does not by itself mean your microphone has failed.',
  'help.maker.title': 'Create in Karaoke Maker',
  'help.maker.intro':
    'Maker turns your audio into an editable karaoke project. Its timeline brings together audio, lyrics and pitch notes. Automatic results are a starting point: check words, timing and notes against the recording.',
  'help.maker.steps':
    'Open Make from Karaoke and load the source audio. Choose the available separation or transcription tools you need.\nWatch progress; first use of an AI tool may require a model download. Review the resulting lyrics and notes in the timeline.\nPlay short passages, correct the timing and text, save the project for later editing, then export the karaoke files.',
  'help.maker.tip':
    'Model downloads need a connection and free disk space. Processing time depends on your hardware and song length. Use audio you are permitted to work with and review exports before sharing.',
  'help.trouble.title': 'When something sounds wrong',
  'help.trouble.intro':
    'Start with the source and output, then isolate the layer. A graph, a saved preset or an enabled switch alone cannot prove that sound reached the intended device. The Help menu also leads to audio troubleshooting and problem reporting.',
  'help.trouble.steps':
    'No sound: confirm playback is running, the expected output is selected, volume is up, and the device is connected. Check whether One player at a time paused another source.\nNo EQ change: confirm System EQ is enabled and the Windows endpoint is selected in Equalizer APO. Use Fix audio problems for the guided repair sequence; restarts interrupt audio.\nDistortion or excessive bass: leave Auto normalize on, reduce boosts and bypass layers one at a time. If it persists, use Report a problem and review the report before sending.',
  'help.trouble.tip':
    'F1 opens this guide. Escape closes an enlarged capture, then the guide. If the interface is too large, Ctrl + 0 resets zoom. For DSP problems, first test a Library audio track rather than video or another player.',
};

export default help;
