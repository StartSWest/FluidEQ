/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The user guide. A chapter is `help.<id>.title|intro|steps|tip`, its steps
 * one per line. A control a capture explains is `help.<id>.<control>`, and its
 * name `…Name` where the app's own label for it does not read on its own; the
 * chapters, captures and controls themselves are listed in `common/helpGuide`.
 */
const help = {
  'help.menu': 'Help',
  'help.title': 'User guide',
  'help.subtitle': 'Find your sound. Make yourself at home.',
  'help.intro':
    'A practical guide to FluidEQ, illustrated with real app captures. Start with your first listening session, then explore each part of the app at your own pace.',
  'help.offline': 'Available offline',
  'help.search': 'Search the guide',
  'help.searchHint': 'Try engine, bass, visualizer…',
  'help.contents': 'In this guide',
  'help.results': '{count} chapters',
  'help.resultsOne': '{count} chapter',
  'help.empty': 'No chapters found. Try a shorter phrase or clear the search.',
  'help.clear': 'Clear search',
  'help.close': 'Close guide',
  'help.enlarge': 'Enlarge screenshot: {title}',
  'help.closeImage': 'Close screenshot',
  'help.controlsOf': 'What each control in {title} does',
  'help.captureNote':
    'Real FluidEQ captures from versions 1.6 and 1.7. Colours, labels and control positions may differ in your version. Example settings are illustrations, not recommended presets.',
  'help.steps': 'Try it',
  'help.tip': 'Good to know',
  'help.back': 'Back to top',

  'help.group.start': 'Get started',
  'help.group.sound': 'Shape your sound',
  'help.group.visuals': 'See your music',
  'help.group.plus': 'FluidEQ Plus',
  'help.group.listen': 'Listen, sing and share',
  'help.group.help': 'When you need help',

  'help.start.title': 'Your first five minutes',
  'help.start.intro':
    'Start with a familiar song at a comfortable volume. The left rail switches FluidEQ on and holds the preamp; the centre is your workspace; the right rail follows your output and its profiles. The bar at the foot of the window controls whatever is playing.',
  'help.start.steps':
    'Install FluidEQ and keep the FluidEQ Engine selected when setup asks how to process your sound. Windows asks for permission once, with no restart.\nChoose your listening device under Output device. Turn on System EQ and leave Auto normalize on.\nPlay a song, open EQ → Bands, make a small change, and compare with System EQ off and on.',
  'help.start.tip':
    'System-wide EQ needs Windows and an audio engine: the FluidEQ Engine or Equalizer APO. On macOS and Linux the app shows demonstration outputs, so a moving graph there is not proof that anything is processed.',
  'help.start.keywords':
    'install, installer, setup, set up, getting started, first steps, quick start, beginner, basics, tutorial, how to use, begin',

  'help.window.title': 'Around the window',
  'help.window.intro':
    'The header takes you between FluidEQ’s pages and shows the sound as it plays. The left rail holds the switch for the whole EQ, the preamp and the level meter; the right rail follows your output and its profiles.',
  'help.window.steps':
    'Press a page in the header: Online Media, Share Audio and EQ before the signal, DSP, Library, Karaoke and Plus after it.\nTurn System EQ on in the left rail and leave Auto normalize on, so no boost can clip.\nPress the signal or the level meter to change how it is drawn, and Rainbow mode to have the curves and meters move at your screen’s full rate.',
  'help.window.tip':
    'Help opens this guide, What’s new, the audio troubleshooter and Report a problem. The pulse button beside it holds the engine card, your account, importing EQ settings or an impulse response, restarting Windows audio and Processes, which shows what each part of FluidEQ is using; at its foot are the Light or Dark theme, animations, Start with Windows and the language. The switch after them turns the window into the Compact player.',
  'help.window.keywords':
    'header, tabs, pages, menu, navigation, interface, layout, toolbar, sidebar, top bar, bottom bar, player bar, meter, rainbow, theme, dark mode, light mode, dark theme, light theme, language, start with windows, autostart, startup, account',
  'help.window.headerLeftCaption': 'The header, up to the signal',
  'help.window.headerRightCaption': 'The header, after the signal',
  'help.window.railCaption': 'The left rail',
  'help.window.media':
    'YouTube, YouTube Music, Bandcamp, Twitch and Suno, played inside FluidEQ with your EQ on them.',
  'help.window.share':
    'Sends this computer’s sound to another one, or plays another one’s here.',
  'help.window.eq':
    'Your bands, presets, headphone correction, game presets and the engine’s config.',
  'help.window.waveName': 'Audio signal',
  'help.window.wave':
    'What is playing, as it plays. Press it to change how it is drawn.',
  'help.window.rainbow':
    'Colours the window and draws the curves and meters at your screen’s full rate.',
  'help.window.dsp':
    'The effects rack: presets, the Room and every stage of the chain.',
  'help.window.library': 'Your music files, albums and play queue.',
  'help.window.karaoke': 'Sing along, and make karaoke out of your own songs.',
  'help.window.plus':
    'Visualizers, the gallery, the leaderboard and the Studio.',
  'help.window.support': 'Ways to support the work on FluidEQ.',
  'help.window.help':
    'This guide, What’s new, the audio troubleshooter and Report a problem.',
  'help.window.actions':
    'The engine, your account, importing EQ settings, restarting Windows audio and Processes; the theme, animations, Start with Windows and the language.',
  'help.window.systemEq':
    'Turns FluidEQ’s processing on or off for everything the PC plays.',
  'help.window.preamp':
    'Lowers the level before the EQ so boosts have room. Auto normalize sets it for you.',
  'help.window.autoNormalize':
    'Keeps the preamp just low enough that nothing you boost can clip.',
  'help.window.responseGraph': 'Shows or hides the response graph.',
  'help.window.meterName': 'Level meter',
  'help.window.meter':
    'The output level, left and right, in real decibels. Press it to change its style.',
  'help.player.title': 'The Compact player',
  'help.player.intro':
    'One switch turns FluidEQ’s window into the Compact player: a narrow column with the song, your equaliser, a visualizer and Up Next, in decks you open and close. Whatever is playing keeps playing, and the same switch brings the full app back on the page you left.',
  'help.player.steps':
    'Press the Compact player switch in the title bar, beside Help. On the player, the same switch brings the full app back.\nOpen and close the decks with EQ, Vis and Queue. The window grows and shrinks by what each takes, and the player remembers its size and place.\nDouble-click the player’s strip, or choose Fold to one line in its menu, to fold it down to one line; the FluidEQ mark unfolds it.\nChoose the player’s own theme in its menu, and keep it above other windows with Always on top.\nDrop music files on Up Next: they join the Library and the queue.',
  'help.player.tip':
    'The player’s volume is your computer’s own, the same as in Windows, so it sets the level of everything the computer plays. If the player ends up off the screen, right-click FluidEQ in the taskbar’s tray and choose Recover the window.',
  'help.player.keywords':
    'mini player, small player, compact, compact mode, winamp, amp, player mode, always on top, pin, fold, one line, queue, up next, drop files, theme, light theme, dark theme, dark mode, light mode, small window, floating player, volume',
  'help.player.topCaption': 'The top: the song, and how it plays',
  'help.player.eqCaption': 'The equaliser',
  'help.player.queueCaption': 'Up Next',
  'help.player.menuCaption': 'The player’s menu',
  'help.player.foldedCaption': 'Folded to one line',
  'help.player.menu':
    'Back to the full app or to one of its pages, the player’s theme, Always on top and Fold to one line.',
  'help.player.pin': 'Keeps the player above every other window.',
  'help.player.switch': 'Back to the full app, on the page you left.',
  'help.player.clock': 'Time played. Click it for the time left.',
  'help.player.well':
    'The sound as it plays. Click it to switch between bars and the wave.',
  'help.player.level': 'The level of the sound leaving FluidEQ, in decibels.',
  'help.player.volume':
    'Your computer’s volume, the same as in Windows: it sets the level of everything the computer plays.',
  'help.player.decksName': 'EQ, Vis and Queue',
  'help.player.decks':
    'Open and close the equaliser, the visualizer and Up Next. The window grows and shrinks by what each takes.',
  'help.player.seek': 'Where the song is. Drag to jump.',
  'help.player.playingName': 'Play controls',
  'help.player.playing':
    'Previous, back five seconds, play or pause, forward five seconds, next and stop.',
  'help.player.orderName': 'Shuffle and repeat',
  'help.player.order':
    'Shuffles Up Next, and repeats nothing, everything or this song.',
  'help.player.lookName': 'Next look',
  'help.player.look':
    'Changes the visualizer’s look. Ctrl+click goes back one, and right-click lists them all.',
  'help.player.screen':
    'What you hear, drawn: your bands, Smart EQ and anything else applied, over a visualizer look. Also applied lists them, and a tag switches one off without removing it.',
  'help.player.bands':
    'Drag a band up or down to boost or cut it. Its frequency is written under it.',
  'help.player.tone':
    'Bands shows every band; Tone swaps them for the Bass, Mid and Treble dials.',
  'help.player.upNext':
    'Where you are in the queue, the time left in it, and how far through it you are.',
  'help.player.library': 'Opens the Library in the full app.',
  'help.player.songsName': 'The songs',
  'help.player.songs':
    'What plays next. Double-click a song to play it, or drop music files here to add them.',
  'help.player.openIn': 'Opens the full app on one of its pages.',
  'help.player.theme':
    'The player’s own Light or Dark theme, apart from the full app’s.',
  'help.player.fold':
    'Folds the player to one line. Double-clicking its strip does the same.',
  'help.player.unfold':
    'Unfolds the player. The arrow at the other end does too.',
  'help.player.foldedPlaying': 'Previous, play or pause, next and stop.',
  'help.player.foldedClock': 'The time, and where the song is.',

  'help.requirements.title': 'What your PC needs',
  'help.requirements.intro':
    'FluidEQ runs on any Windows PC of the last ten years. Two parts ask for more than the rest: the Plus visualizers draw on the graphics card, and the karaoke AI downloads its models the first time you use it.',
  'help.requirements.steps':
    'Check your Windows: Windows 10 version 1803 or later, or Windows 11, 64-bit, 4 GB of memory and about 600 MB of disk. Processing everything the PC plays needs the FluidEQ Engine or Equalizer APO, and Windows asks for permission once while it installs.\nLook at a visualizer: any graphics card or built-in graphics from 2013 onwards. At 1080p built-in graphics are enough; 4K, or a desktop background on several screens at once, is happier with a dedicated card. On a busy card FluidEQ draws the scene smaller and lets go of the ones you cannot see.\nTry the karaoke AI: separating a voice downloads a 713 MB model the first time, the pitch model adds about 180 MB, and noise removal 11 MB. With a DirectX 12 graphics card a four-minute song separates in around half a minute; on the processor alone it takes about four minutes. Keep 2 GB of memory free while it works.\nAim for this if you can: Windows 11, 8 GB of memory, graphics from 2018 onwards, and 3 GB of disk free if you use the AI features.',
  'help.requirements.tip':
    'Everything but the AI models is in the installer, and those download only when you first use the feature. Processes, in the actions menu, shows what each part of FluidEQ is using on your machine right now.',
  'help.requirements.keywords':
    'system requirements, requirements, specs, hardware, laptop, gpu, graphics card, video card, cpu, processor, ram, memory, disk space, storage, windows 10, windows 11, minimum, recommended, performance, slow, lag, compatibility, mac, macos, linux',

  'help.engine.title': 'The FluidEQ Engine',
  'help.engine.intro':
    "FluidEQ processes your sound with its own engine or with Equalizer APO. The FluidEQ Engine runs inside Windows' audio service after your sound card's effects, brings your EQ and the DSP rack to everything the PC plays, and steps aside the moment FluidEQ closes.",
  'help.engine.steps':
    'Open the actions menu — the pulse button at the top right — and press the engine card at the top of it.\nChoose FluidEQ Engine and press Apply. Windows asks for permission, and audio pauses for a few seconds while it restarts.\nIf an output shows OFF, press Enable on its notice. If a notice says the engine is not running, press Restart Windows audio.',
  'help.engine.tip':
    'Equalizer APO remains available for custom APO commands, Peace and VST plugins. When an update brings a newer engine, a notice offers Update engine. Quitting FluidEQ from the tray turns the EQ off on every output.',
  'help.engine.keywords':
    'audio engine, apo, driver, system-wide, all apps, every app, spotify, browser, discord, enable, activate, turn on, windows audio, permission, administrator, update engine, switch engine',
  'help.engine.fluid':
    "Recommended. Your sound card's effects keep working, and the EQ and DSP rack reach every app.",
  'help.engine.apo':
    'Runs custom APO commands, Peace and VST plugins. The DSP rack stays with Library playback.',
  'help.engine.apply':
    'Switches the engine. Windows asks once, and audio restarts for a few seconds.',

  'help.eq.title': 'Shape your sound with EQ',
  'help.eq.intro':
    'Frequency chooses where a band acts, Gain sets the boost or cut, and Q sets its width: higher Q is narrower. With no band selected, the Tone dials — Bass, Mid and Treble, with Low cut and High cut on either side — shape the sound as a curve of their own and leave your bands as they are. Begin with small, broad changes and compare often.',
  'help.eq.steps':
    'Open EQ → Bands. With nothing selected, turn Bass, Mid or Treble for a quick change of tone, and Low cut or High cut to trim the extremes. They draw their own Tone line on the graph.\nClick a band’s frequency, or its point on the graph, to select it. Turn its Frequency, Gain and Quality (Q) dials, pick a Filter, or switch it off with Active.\nRight-click a band to reset it, switch it off, or add a band beside it. Press Clear EQ to set every gain, and Bass, Mid and Treble, to 0 dB while keeping your bands. It asks first.',
  'help.eq.tip':
    'Also applied lists what shapes this output besides your bands, each with its own strength and ×. Game mode cuts the delay FluidEQ adds, for games and calls; Gaming presets turn it on.',
  'help.eq.keywords':
    'equalizer, equaliser, parametric, parametric eq, graphic eq, bass boost, treble boost, low end, lows, mids, highs, tone, tone controls, peaking, shelving, low pass, high pass, band pass, bandwidth, hz, db, boost, cut, adjust sound, latency',
  'help.eq.bandsCaption': 'The Bands page, nothing selected',
  'help.eq.bandCaption': 'A band selected',
  'help.eq.gameMode':
    'Cuts the delay FluidEQ adds, for games and calls. Gaming presets turn it on.',
  'help.eq.layers':
    'What else shapes this output — a headphone correction, Smart EQ, a convolution — each with its strength, its switch and ×.',
  'help.eq.bandName': 'A band',
  'help.eq.band':
    'Drag its point to boost or cut. Click its frequency to select it.',
  'help.eq.bass': 'Raises or lowers the low end of the whole curve.',
  'help.eq.mid': 'Raises or lowers the middle, where voices sit.',
  'help.eq.treble': 'Raises or lowers the top, the air and the detail.',
  'help.eq.selected':
    'The band being edited. Ctrl-click or Shift-click to select several.',
  'help.eq.filter': 'Its shape: a peak, a shelf, a notch or a pass filter.',
  'help.eq.voicing':
    'A ready-made chain for the sound, such as Music or a genre. None leaves only your own bands.',
  'help.eq.smart':
    'Listens to what plays and corrects it: Detail, Balance or Target.',
  'help.eq.clear': 'Sets every gain to 0 dB and keeps your bands. Asks first.',
  'help.eq.mode': 'How strongly your EQ and curves apply, band Q and phase.',
  'help.eq.add': 'Adds a band beside the selected one.',
  'help.eq.layouts': 'Band counts, and the band designs you saved.',
  'help.eq.frequency': 'Where the selected band acts, from 1 Hz to 20 kHz.',
  'help.eq.gain': 'How much it boosts or cuts. Ctrl-click returns it to 0 dB.',
  'help.eq.q': 'How wide it is: higher is narrower.',
  'help.eq.delete': 'Press twice to delete the band; Keep changes your mind.',
  'help.eq.menuCaption': "A band's right-click menu",
  'help.eq.reset': 'Gain back to 0 dB and Q back to 2.',
  'help.eq.disable': 'Takes the band out of the sound and keeps its settings.',
  'help.eq.addLeft': 'Adds a band halfway to its lower neighbour.',
  'help.eq.addRight': 'Adds a band halfway to its higher neighbour.',

  'help.eqmode.title': 'EQ mode and band designs',
  'help.eqmode.intro':
    'EQ mode changes how your sound is shaped, without editing anything. Your EQ covers your bands, the Tone, presets, Driver type and Smart EQ; Corrections covers headphone corrections and imported or custom curves. Band designs keep the frequencies and Q of a layout you like, ready for any output.',
  'help.eqmode.steps':
    'Open EQ mode on the Bands toolbar. Try a Strength, Band Q or Curve smoothing choice while music plays; the panel stays open.\nUnder the FluidEQ Engine, choose Minimum or Linear phase, and Precise or Classic treble. Press Reset to return everything to Normal.\nOpen the layouts button beside Add band. Pick 6, 10, 15, 20 or 31 bands, or press Save design… to name the current layout.',
  'help.eqmode.tip':
    'A design stores only frequencies and Q: loading one starts every band at 0 dB. Linear phase adds delay and can ring before sharp hits.',
  'help.eqmode.keywords':
    'band layout, band count, 10 band, 31 band, graphic eq, band design, strength, intensity, linear phase, minimum phase, smoothing, constant q, proportional q, treble, precise, classic',
  'help.eqmode.modeCaption': 'EQ mode',
  'help.eqmode.strength':
    'Normal, Studio ×1.5 or ×2, for Your EQ and your Corrections separately.',
  'help.eqmode.q':
    'Constant keeps each Q; Proportional and Asymmetric narrow bands as they grow.',
  'help.eqmode.smoothing': 'Softens sampled correction curves.',
  'help.eqmode.phase': 'Minimum or Linear. With the FluidEQ Engine only.',
  'help.eqmode.treble':
    'Precise plays treble as drawn; Classic as Equalizer APO does. With the FluidEQ Engine only.',
  'help.eqmode.reset': 'Everything back to Normal.',
  'help.eqmode.designsCaption': 'Band designs',
  'help.eqmode.builtIn': 'Standard layouts of 6, 10, 15, 20 or 31 bands.',
  'help.eqmode.save':
    'Names the current frequencies and Q as a design, listed under My designs.',

  'help.games.title': 'Game presets',
  'help.games.intro':
    'Give each game its own sound. When the game comes to the front, FluidEQ switches to that sound and keeps it until you close the game, whatever you alt-tab to in between. Then it puts back what you had.',
  'help.games.steps':
    'Open EQ → Game presets and press Add a game. Pick one from your launchers, a program that is open now, or choose its program yourself.\nPick the sound it should get in the picker on its row: a Gaming preset, or any other.\nStart the game. A card on the desktop says what FluidEQ switched to, and another says what came back when you close it.',
  'help.games.tip':
    'While a game holds the sound, the bar at the foot of the window names it. Pick another sound while you play and it stays: FluidEQ only puts back what it put on. Gaming presets also turn on Game mode.',
  'help.games.keywords':
    'gaming, game profile, per game, per-game, per app, automatic, auto switch, steam, epic, launcher, fps, shooter, footsteps, competitive, alt-tab, game mode',
  'help.games.tab': 'Your games and the sound each one gets.',
  'help.games.add':
    'Adds a game from Steam, Epic, EA, GOG, Ubisoft, Battle.net or Xbox, or any program that is open now.',
  'help.games.gameName': 'A game',
  'help.games.game': 'The game, and the folder FluidEQ knows it by.',
  'help.games.soundName': 'Its sound',
  'help.games.sound':
    'The sound FluidEQ switches to when this game comes to the front, or Leave it as it is.',
  'help.games.removeName': 'Remove',
  'help.games.remove': 'Forgets the game. The preset it used stays.',

  'help.headphones.title': 'Headphone correction & imports',
  'help.headphones.intro':
    'A headphone correction compensates for a measured model. It is a starting point you can combine with your own bands and presets. Check the exact model and the measurement author before applying a result.',
  'help.headphones.steps':
    'Open EQ → EQ presets and search for your headphone model. Review the available measurements and choose the matching entry.\nFor EQ text from another tool, use Import EQ settings in the actions menu. Review the parsed bands and curve before applying.\nFor Squiglink, paste its export into the import panel. Apply as EQ replaces your bands; Apply as curve adds it as a headphone correction with its own strength.',
  'help.headphones.tip':
    'A preview marked not applied is not changing your sound. Avoid stacking two full corrections for the same headphones unless that is deliberate; compare with the headphone layer switched off.',
  'help.headphones.keywords':
    'autoeq, headphone eq, headphone correction, headphone profile, harman, target curve, iem, iems, earphones, earbuds, in-ear, squiglink, crinacle, oratory1990, import eq, measurements, frequency response',

  'help.convolution.title': 'Use an impulse response',
  'help.convolution.intro':
    'Convolution applies a WAV impulse response as another correction layer. FluidEQ includes a searchable AutoEq catalogue and can import your own WAV. It remains separate from the editable parametric bands.',
  'help.convolution.steps':
    'Open EQ → Convolution. Search by model or measurement author.\nCheck the source, then use Download & apply; the download matches your output’s rate. Use Import a WAV for a file you already have.\nListen with the convolution layer on and off in Also applied.',
  'help.convolution.tip':
    'The FluidEQ Engine converts any impulse rate itself. Equalizer APO needs an imported WAV at the output’s own rate. Catalogue downloads need a connection; the guide does not.',
  'help.convolution.keywords':
    'impulse response, ir, wav, convolver, fir, room correction, rew, autoeq catalogue, correction file',

  'help.profiles.title': 'Devices, profiles & second output',
  'help.profiles.intro':
    'Your EQ follows the output device. Edits save to the profile playing on the current output, and Profiles lets you keep alternative sounds. Second output mirrors playback to other devices with a separate level for each.',
  'help.profiles.steps':
    'Check the output at the top of the Output card before editing. Use New profile for a sound you want to keep; Update saves changes to that profile, and Restore brings its saved settings back.\nOpen Second output, switch on a reachable device, and set its level. Choose that device’s saved EQ profile directly beneath it.\nUse Game/Video for a smaller starting buffer or Music for more reserve. Compare synchronization on your devices.',
  'help.profiles.tip':
    'Each mirrored output uses its own profile under either engine. Mirroring runs while FluidEQ is open; switching the main output stops the old mirrors. Device latency still affects synchronization.',
  'help.profiles.keywords':
    'output, output device, device, speakers, switch device, device switching, auto switch, profile, save settings, named profile, second output, mirror, multiple outputs, two outputs, bluetooth, sync, delay, latency, per device',
  'help.profiles.list':
    'Sounds you saved. ON marks the one this output uses; press another to switch.',
  'help.profiles.update': 'Saves your changes into the profile you are on.',
  'help.profiles.new': 'Starts a new profile from the EQ you have now.',
  'help.profiles.restore': 'Brings the profile back as you last saved it.',
  'help.profiles.output':
    'The output you are listening on. OFF means your EQ does not reach it; ACTIVE, that Windows is playing through it.',
  'help.profiles.mapping':
    'The profile this output follows. Any change you make is saved to it by itself.',
  'help.profiles.onePlayer':
    'Starting something in FluidEQ pauses what plays elsewhere on the PC, and the other way round.',
  'help.profiles.outputs':
    'Your other outputs. Switch one on to play there too, with its own profile.',
  'help.profiles.driver':
    'A gentle starting point for what you listen on — headphones, earphones, a driver size or material. Leave it at No compensation if the sound is already right.',

  'help.config.title': 'Inspect & back up a chain',
  'help.config.intro':
    'EQ → Config shows what the audio engine actually has on disk. The output cards and include tree help you see which device and layers are involved. Export a chain before a large experiment or when moving a setup.',
  'help.config.steps':
    'Open EQ → Config and choose the output you want to inspect. Read its status and active layers.\nUse Export chain to save a .fluideq file. Keep a copy somewhere you can find again.\nTo bring a chain back, select the intended output first, then use Import chain and review the result.',
  'help.config.tip':
    'Generated layer files are rewritten when their settings change; put lasting manual lines in the per-output custom file. The FluidEQ Engine reads its Filter, Preamp, GraphicEQ and Convolution lines; other APO commands and plugins need Equalizer APO.',
  'help.config.keywords':
    'backup, restore, export, import, config, config file, apo config, text file, fluideq file, chain file, include, custom lines, advanced',

  'help.dsp.title': 'Explore the DSP rack',
  'help.dsp.intro':
    'The DSP rack is a chain of studio stages. Under the FluidEQ Engine it processes everything the PC plays; under Equalizer APO it processes Library audio tracks. It is off while FluidEQ is switched off.',
  'help.dsp.steps':
    'Open DSP. Pick a chain under Presets, or select a stage in the rail and switch it On.\nChange one control at a time and compare with the stage bypassed at a similar volume. Isolate lets you hear only what a stage adds.\nSave a rack you like, and use Export and Import to share it.',
  'help.dsp.tip':
    'Louder often sounds better simply because it is louder, so compare at matched levels. Ctrl-click a dial to return it to its default.',
  'help.dsp.keywords':
    'effects, fx, audio effects, rack, chain, plugins, limiter, loudness, normalizer, leveler, volume leveling, exciter, harmonics, enhancer, stereo widener, widen, stereo width, bass enhancer, sub bass, subharmonic, punch, transient, mastering, clipping, peak limiter, crossfade, gapless',
  'help.dsp.normalizer':
    'Evens out loudness. On live audio it levels song by song.',
  'help.dsp.denoise':
    'Repairs hiss, hum and clicks. The neural voice cleaner works on Library tracks.',
  'help.dsp.exciter': 'Adds harmonics for body and air.',
  'help.dsp.bassForge':
    'Adds a real octave below the bass, or its harmonics for small speakers.',
  'help.dsp.equaliser':
    'Fifteen parametric bands, with minimum or linear phase.',
  'help.dsp.bassPunch': 'Shapes the attack, sustain and bloom of the bass.',
  'help.dsp.dimension':
    'Widens the stereo picture without changing the mono sum.',
  'help.dsp.maximizer':
    'Raises the level without letting peaks pass the ceiling.',
  'help.dsp.master': 'Final level, loudness target and peak safety.',
  'help.dsp.crossfade': 'Blends one Library track into the next.',
  'help.dsp.presets': 'Whole-rack chains for genres, devices and repairs.',
  'help.dsp.scopeName': 'System-wide',
  'help.dsp.scope':
    'Where the rack is running, and any delay linear phase adds.',

  'help.room.title': 'The Room: surround on headphones',
  'help.room.intro':
    'The Room turns headphones into a listening room. Every channel of the sound becomes a speaker standing around your head, rendered through a measured head and the reflections of a room you shape yourself, so a film sits in front of you and a game surrounds you. It needs the FluidEQ Engine and headphones; on speakers it does nothing useful.',
  'help.room.steps':
    'Open DSP, choose Room in the rail and switch it on. Stereo becomes two speakers in front of you; a 5.1 film five and the sub; a 7.1 game the whole ring. The chip beside the switch says which.\nPick a room at the top — studio, living room, cinema, concert hall and more — or turn Size, Walls and Distance yourself and drag a speaker around the ring. Speakers the playing stream cannot reach are drawn asleep.\nPress Start the listening test and answer five short listening pairs: the room takes the head that puts sounds in front of you. Small, Medium and Large can be chosen by hand too.\nSave a room you like under a name; a saved room comes back with a press and never changes your head.',
  'help.room.tip':
    'Games and films only send their surround channels to an output Windows believes has that many speakers: when the driver takes it, the output panel offers one press to 7.1.',
  'help.room.keywords':
    'surround, virtual surround, surround sound, spatial audio, spatial, 3d audio, 3d, 7.1, 5.1, binaural, hrtf, virtualizer, speakers on headphones, reverb, cinema, movies, films, head size, listening test, soundstage, crossfeed',
  'help.room.picker':
    "The rooms to start from, grouped like every other stage's profiles; Custom once you shape one.",
  'help.room.picture':
    'The room from above: walls that fade as they absorb, the speakers on their ring, the head in the middle. All of it is drawn to one scale, so a speaker standing further out than the room is wide is drawn outside its walls. Drag one and its pair moves with it; hold Shift to move it alone.',
  'help.room.speaker':
    'Press a speaker in the room and this pane becomes its own: its angle as a number, its own distance, its level, and Mute or Solo to hear it alone.',
  'help.room.speakerName': 'The chosen speaker',
  'help.room.dialsName': 'Space, Ambience, Distance',
  'help.room.dials':
    "How much of the walls you hear, the soft tail after them, and how far the speakers stand. Size, Walls and the tail's own length and tone are in Room character below.",
  'help.room.fit': 'Five listening pairs that pick the head for your ears.',
  'help.room.head':
    'The measured head the room renders through: small, medium or large.',
  'help.room.saved': 'Name the room as it stands; it comes back with a press.',
  'help.room.liveName': 'What the room is doing',
  'help.room.live':
    'Read from the engine: which speakers the playing stream reaches, or why the room is idle.',

  'help.denoise.title': 'Denoise & source analysis',
  'help.denoise.intro':
    'Denoise reduces hiss, mains hum and clicks. Under the FluidEQ Engine it works live on anything the PC plays; the neural voice cleaner and the scanned noise floor are for Library tracks. Stronger reduction is not automatically better.',
  'help.denoise.steps':
    'Play something with the noise you want to reduce and select Denoise in DSP.\nSwitch on Hiss, Hum or Clicks with a light setting, and listen to quiet passages and to musical detail.\nIncrease reduction gradually, then bypass the stage to check that the improvement is worth any loss of detail.',
  'help.denoise.tip':
    'Listen for softened detail and watery or pumping textures. This is not a microphone cleanup. If you hear no change, confirm the rack and the stage are both on.',
  'help.denoise.keywords':
    'noise, noise reduction, noise removal, remove noise, hiss, hum, buzz, clicks, crackle, static, clean up, cleanup, restoration, repair, background noise, vinyl',

  'help.graph.title': 'The graph and its controls',
  'help.graph.intro':
    'The response graph draws your EQ curves over the live sound. The strip above it chooses what is drawn and how, and it changes with the look: a standard style or a Plus visualizer.',
  'help.graph.steps':
    'Click the look’s name to choose a style or visualizer. The arrows beside it, Space and Ctrl+Space step through them.\nOpen View for the graph’s size, what it shows, and the wave’s height and position. Frame rate is there too: every frame your display offers, or 60 or 30, held at 60 on battery.\nA Plus visualizer adds its own controls to View — whatever its author left for you to set — and Use its own wave puts the wave back to the height and position that author chose.\nDouble-click the plot for full screen, or Ctrl+double-click to expand it over the window; double-click again to come back. A single click hides or shows the strip.\nKeys: Ctrl+F full screen, Ctrl+S expanded, Esc back to the normal view, Ctrl+G the grid, Ctrl+W what the graph shows, Ctrl+I which way the wave faces, Ctrl+A every band. On a band’s point, drag to move it and right-click for its menu; Ctrl+scroll changes the Q of a selected point.',
  'help.graph.tip':
    'Everything here changes only the drawing, never your sound. Rainbow mode — Help → What’s new turns it on — draws the standard styles, the meters and the wave at your screen’s full refresh rate instead of 30 frames a second.',
  'help.graph.keywords':
    'graph, spectrum, spectrum analyzer, analyzer, analyser, frequency response, curve, full screen, fullscreen, frame rate, fps, refresh rate, wave, waveform, grid, view, shortcuts, keyboard shortcuts, hotkeys, double-click, expanded, expand',
  'help.graph.stripCaption': 'With a standard style',
  'help.graph.live': 'Shows or hides the live wave.',
  'help.graph.previous': 'Steps back to the previous look.',
  'help.graph.picker': 'Opens every style and visualizer.',
  'help.graph.next': 'Steps forward to the next look.',
  'help.graph.autoName': 'Auto',
  'help.graph.auto': 'Changes the look every 10 seconds to 2 minutes.',
  'help.graph.colouring':
    'Colours the style: Auto, Flat, Frequency, Level or Heat.',
  'help.graph.newLook': 'Designs a look of your own from this style.',
  'help.graph.bandsName': 'Listening bands',
  'help.graph.bands': 'Shades the bands you hear most.',
  'help.graph.bandsMenu':
    'The same shading; greyed over a Plus visualizer, which never draws it.',
  'help.graph.gridName': 'Grid',
  'help.graph.grid': 'Shows or hides the grid and scales.',
  'help.graph.viewName': 'View',
  'help.graph.view': 'Size, what is drawn, and the wave.',
  'help.graph.plusCaption': 'With a Plus visualizer',
  'help.graph.tintName': 'Window colours',
  'help.graph.tint':
    "The app's theme, the visualizer's colours, its colours with light (Ambient), or the visualizer behind the whole window (Backdrop).",
  'help.graph.lighting': 'Lights your RGB devices with this scene.',
  'help.graph.desktop': 'Puts this visualizer behind your desktop icons.',
  'help.graph.viewCaption': 'The View menu',
  'help.graph.expand': 'The graph grows over the editor.',
  'help.graph.fullscreen': 'The graph fills the screen.',
  'help.graph.showingName': 'Showing',
  'help.graph.showing': 'Steps through what the graph shows.',
  'help.graph.waveName': 'The wave',
  'help.graph.wave': 'The live spectrum drawing.',
  'help.graph.topWaveName': 'Top wave',
  'help.graph.topWave': 'The small wave in the title bar.',
  'help.graph.meterName': 'Level meter',
  'help.graph.meter': 'The output meter in the left rail.',
  'help.graph.waveHeight': 'How tall the wave is drawn.',
  'help.graph.wavePosition': 'From the bottom edge up to the middle.',
  'help.graph.attack': 'How fast a Plus visualizer rises to the music.',
  'help.graph.release': 'How slowly it falls back after each hit.',
  'help.graph.ownTiming': 'Back to the timing the visualizer came with.',

  'help.looks.title': 'Styles and Plus visualizers',
  'help.looks.intro':
    'Standard styles are free drawings of the live sound that you can colour and design yourself: Line and Area for a clean trace, LED blocks and Spikes for punch, Truss, Skyline and Dancing flames for whole scenes. Plus visualizers are scenes drawn on the graphics card, such as Alpine, Aurora, Bloom and Neon City, where the bass, the beat and the treble each move something different.',
  'help.looks.steps':
    'Click the look’s name on the graph. Search, or filter the styles by Lines, Fills, Bars, Points or Scenes.\nChoose a Plus visualizer on the right. Without Plus it is locked, and choosing it explains how to get it.\nOn a standard style, press New look to change its colours, motion and peaks, then save it; it appears under Yours.',
  'help.looks.tip':
    'A Plus visualizer brings its own colours: set its attack and release in View. If a scene cannot run on this computer, the graph draws a free style instead of a blank plot.',
  'help.looks.keywords':
    'styles, style, skins, skin, appearance, visualizer, visualiser, visualization, colours, colors, look, customize, customise, animation',
  'help.looks.searchName': 'Search',
  'help.looks.search':
    'Finds styles and visualizers by name, maker or category.',
  'help.looks.styles': 'Free styles drawn by FluidEQ, and the looks you saved.',
  'help.looks.familiesName': 'Style filters',
  'help.looks.families': 'Lines, Fills, Bars, Points, Scenes and Yours.',
  'help.looks.plus':
    'Scenes from FluidEQ and from members, each with a picture.',
  'help.looks.categoriesName': 'Categories',
  'help.looks.categories': 'Nature, Cities, Abstract and more.',

  'help.plus.title': 'FluidEQ Plus and your account',
  'help.plus.intro':
    'An account is optional: everything that was free runs on this computer without one. FluidEQ Plus, monthly or yearly, adds Visualizers, the Leaderboard, the Studio, Dynamic lighting and the desktop visualizer. A new account can try Plus free for fifteen days, and a scene you publish that is approved earns you a month.',
  'help.plus.steps':
    'Open Account in the actions menu. Sign in, or create an account and type the six-digit code sent to your email.\nPress Upgrade to Plus, read the terms, tick that you agree, and pay on Buy Me a Coffee in your browser with the same email.\nOpen the Plus tab. Its rail leads to the Leaderboard, Visualizers, the Studio and Dynamic lighting.',
  'help.plus.tip':
    'The app never sees your card; Manage subscription changes or cancels it. The free trial asks for no card and charges nothing when it ends. An account stays signed in on up to five computers, and Plus keeps working offline for a while.',
  'help.plus.keywords':
    'account, sign in, login, log in, sign up, register, subscription, subscribe, premium, pro, paid, price, pricing, cost, buy, payment, pay, free trial, trial, cancel, upgrade, membership, member, email code',
  'help.plus.leaderboard': 'Who listens most, among Plus members who join.',
  'help.plus.visualizers':
    'Scenes by FluidEQ and members, ready for your music.',
  'help.plus.studio': 'Make your own scenes with your AI.',
  'help.plus.lighting': 'Your RGB devices follow the scene.',
  'help.plus.fold': 'Folds the rail to its pictures; it opens again on hover.',

  'help.gallery.title': 'The Visualizers gallery',
  'help.gallery.intro':
    'Visualizers holds FluidEQ’s own scenes and the ones members publish. Any account can browse and try FluidEQ’s free samples for ten seconds; Plus plays every scene on your music and adds it to your looks.',
  'help.gallery.steps':
    'Open Plus → Visualizers. Search, sort by Most liked, This week or Newest, or pick a category.\nOpen a scene, press Add to my looks, then Play on the graph. The arrows, or ← and →, step between scenes.\nLike members’ scenes with the heart, and report one that should not be there.',
  'help.gallery.tip':
    'Scenes in your looks update themselves, and a scene’s page says what changed in each version. A scene you publish appears once a moderator has approved it. Open in Studio shows how FluidEQ’s own scenes are made.',
  'help.gallery.keywords':
    'scenes, scene, visualizers, download visualizers, browse, community scenes, likes, like, report, samples',
  'help.gallery.search': 'Finds scenes and makers.',
  'help.gallery.sortName': 'Sort',
  'help.gallery.sort': 'Most liked, liked this week, or newest.',
  'help.gallery.categoriesName': 'Categories',
  'help.gallery.categories': 'Shows one kind of scene.',
  'help.gallery.mine': 'The scenes you published, with their likes.',
  'help.gallery.cardName': 'A scene',
  'help.gallery.card':
    'Its picture opens the scene; Add puts it in your looks.',
  'help.gallery.manage': 'What each monitor shows as a desktop background.',
  'help.gallery.stop': 'Stops every desktop background.',
  'help.gallery.sceneCaption': "A scene's page",
  'help.gallery.back': 'Back to the gallery, where you left it.',
  'help.gallery.play':
    'Adds the scene to your looks, or plays it on the graph.',
  'help.gallery.desktop': 'Puts the scene behind your desktop icons.',
  'help.gallery.inspect':
    'Opens FluidEQ’s scene in the Studio to see how it is made.',

  'help.leaderboard.title': 'The Leaderboard',
  'help.leaderboard.intro':
    'The Leaderboard ranks the Plus members who join it, by how much they listen and by the likes their scenes earn. It is off unless you join.',
  'help.leaderboard.steps':
    'Open Account and press Join the leaderboard.\nOpen Plus → Leaderboard. Choose the handle and name the board shows, then switch between All time and This month.\nTo stop, press Leave the leaderboard. Remove all my data deletes everything you sent.',
  'help.leaderboard.tip':
    'One number a day leaves your computer — the minutes of music that played — and never what you play. Every number is checked on the server. Your handle and name can be changed later from Account → Change name; the board and your published scenes follow.',
  'help.leaderboard.keywords':
    'ranking, ranks, rank, points, score, top listeners, stats, statistics, listening time, competition, board',
  'help.leaderboard.periodName': 'All time or This month',
  'help.leaderboard.period': 'The whole history, or this month only.',
  'help.leaderboard.standing':
    'Your rank and points, and how far the next place is.',
  'help.leaderboard.earn':
    '10 points an hour, 20 for each day of 30 minutes or more, 5 for each like.',

  'help.studio.title': 'Make scenes in the Studio',
  'help.studio.intro':
    'The Studio turns a description into a visualizer. Your own AI assistant writes the scene in a project folder, and FluidEQ plays each version on your music the moment it is saved. The Studio is part of Plus; a new account can open it on the free trial.',
  'help.studio.steps':
    'Open Plus → Studio and press New project…. Give it a name; FluidEQ makes its folder with a scene that already moves.\nDescribe your idea, open the folder in your AI assistant, and paste the prompt from Copy AI prompt.\nWatch the stage as files are saved and try the test signals. Then Add to my looks, Publish… or Export….',
  'help.studio.tip':
    'Double-click the stage for full screen. Look inside a FluidEQ scene… opens one of FluidEQ’s own scenes to learn from; it cannot be published. Scenes that flash hard or run too heavy are held back. A scene you publish is read by a moderator first, and one that is approved earns you a month of Plus.',
  'help.studio.keywords':
    'create visualizer, make visualizer, make a scene, shader, glsl, code, ai, chatgpt, claude, prompt, publish, export scene, scene editor, creator',
  'help.studio.project': 'Your projects, and FluidEQ scenes to look inside.',
  'help.studio.stageName': 'Stage',
  'help.studio.stage':
    'The scene, playing on your music. Double-click for full screen.',
  'help.studio.code': 'The scene’s code, live, updated as your AI saves it.',
  'help.studio.hears':
    'What the scene receives: level, beat, bass, mids, treble.',
  'help.studio.signals': 'Test signals that drive only this preview.',
  'help.studio.size':
    'Tries the scene on a graph, narrow, wide or full-screen panel.',
  'help.studio.wave': 'Tries the wave height and position listeners can set.',

  'help.desktop.title': 'The desktop visualizer',
  'help.desktop.intro':
    'The desktop visualizer puts a Plus visualizer behind your desktop icons, on one monitor or on each of them, for as long as FluidEQ runs.',
  'help.desktop.steps':
    'Put a Plus visualizer on the graph and press the monitor button beside its name, or choose View → Set as desktop background.\nPress the monitors on the map, choose With the music or Calm, and press Set background.\nTo change or stop it, open Plus → Visualizers and use Manage or Stop at the top.',
  'help.desktop.tip':
    'It pauses while windows cover the monitor, while the PC is locked and, if you choose, on battery power, and returns when FluidEQ starts. Quitting FluidEQ stops it. Windows only.',
  'help.desktop.keywords':
    'wallpaper, live wallpaper, animated wallpaper, desktop background, background, multiple monitors, second monitor, screens',
  'help.desktop.monitors':
    'Your monitors as Windows arranges them. Press the ones to use.',
  'help.desktop.music': 'Moves to whatever is playing.',
  'help.desktop.calm': 'A slow, quiet animation that ignores the music.',
  'help.desktop.battery': 'Saves power while the computer is unplugged.',
  'help.desktop.start': 'Starts it on the monitors you chose.',

  'help.lighting.title': 'Dynamic lighting (beta)',
  'help.lighting.intro':
    'Dynamic lighting lights your keyboard, mouse, mousepad, headset and stand with the Plus visualizer on the graph, through Windows Dynamic Lighting and Razer Chroma. It is in beta, so tell us how your devices behave.',
  'help.lighting.steps':
    'Open Plus → Dynamic lighting and switch it on, or press the lighting button beside a Plus visualizer on the graph.\nChoose this visualizer’s lighting style — Scene, Colour wave, Spectrum or Beat ripple — and set its brightness and what it responds to.\nClick a device under Your devices to tune it alone; All devices goes back to every device.',
  'help.lighting.tip':
    'If Windows keeps a device for another app, the page names the setting to change and opens it for you. Razer devices need Razer Synapse running, with Chroma Apps allowed.',
  'help.lighting.keywords':
    'rgb, razer, chroma, synapse, keyboard lights, keyboard, mouse, headset, led, leds, ambient lighting, lights, windows dynamic lighting',
  'help.lighting.switch': 'Lights your devices while a Plus visualizer plays.',
  'help.lighting.browse': 'Opens the gallery to choose a visualizer.',
  'help.lighting.previewName': 'Live desk preview',
  'help.lighting.preview': 'Your own desk, lit with the colours sent to it.',
  'help.lighting.devices': 'Every device found. Click one to tune it alone.',
  'help.lighting.all': 'Back to tuning every device at once.',
  'help.lighting.style':
    'Scene, Colour wave, Spectrum or Beat ripple, kept for each visualizer.',

  'help.online.title': 'Listen with Online Media',
  'help.online.intro':
    'Online Media keeps supported sites beside your EQ. Site playback and sign-in still depend on the provider and your connection. The bar at the foot of FluidEQ follows the active player, and its volume is your computer’s own.',
  'help.online.steps':
    'Open Online Media and choose a supported site. Find and start something on that page.\nSwitch to EQ to tune while listening, then return to the page when you need its own controls.\nUse One player at a time if you want FluidEQ and other players to pause one another instead of overlapping.',
  'help.online.tip':
    'Under the FluidEQ Engine, Online Media goes through your EQ and the DSP rack like every other app. Under Equalizer APO the rack stays with Library tracks.',
  'help.online.keywords':
    'youtube, youtube music, bandcamp, twitch, suno, streaming, stream, web, website, browser, online',

  'help.library.title': 'Build your local library',
  'help.library.intro':
    'Library brings together music and video from your drives. Browse by albums, artists, genres, songs, folders, a folder tree or your playlists. Album art and details come from your files, so the same collection may look different depending on its tags.',
  'help.library.steps':
    'Open Library and add the folder containing your media. Let the scan finish before judging what is missing.\nChoose an artist or album, or search for a song. Start a track from the results.\nUse the bar at the foot of the window to pause, seek and skip. Its volume is your computer’s own, the same as in Windows.',
  'help.library.tip':
    'Hover FluidEQ’s button on the Windows taskbar for Previous, Play and Next, even while it is minimized. Library needs the original files: reconnect a drive or add a moved folder again.',
  'help.library.keywords':
    'music player, player, local files, local music, mp3, flac, wav, aac, folders, albums, artists, genres, playlist, video, videos, scan, tags, cover art, album art',

  'help.queue.title': 'Albums & your play queue',
  'help.queue.intro':
    'The queue is the listening order; browsing is where you choose music. Opening another album lets you explore without making it the current song. The active track and Up next help you keep your place.',
  'help.queue.steps':
    'Open an album to inspect its tracks. Start the one you want to hear.\nRight-click a song for Add to up next, Add to Favourites or Add to playlist.\nOpen Up next to see what plays after, and turn on Keep playing to continue with more of the same genre.',
  'help.queue.tip':
    'Starting Library playback takes over from FluidEQ’s other players. Use the current track shown in the bar to confirm which source owns playback.',
  'help.queue.keywords':
    'queue, up next, next song, shuffle, repeat, favourites, favorites, playlist, keep playing, autoplay, play order',

  'help.karaoke.title': 'Sing with Karaoke',
  'help.karaoke.intro':
    'Karaoke pairs your own audio with lyrics. Timed lyrics follow playback; pitch targets depend on the song’s note data. A microphone adds your live pitch when configured, and the stage can fill the screen.',
  'help.karaoke.steps':
    'Open Karaoke. Use Add files or Add folder to bring in audio and matching lyric files.\nChoose a song and start playback. Check that the correct lyrics and backing track are paired.\nConfigure microphone input for live pitch, adjust lyric size for your viewing distance, and use the stage’s fullscreen control to sing.',
  'help.karaoke.tip':
    'A lyric-only file does not contain target notes. Karaoke plays at your computer’s volume; the melody, backing and guide vocal levels are under Mix settings.',
  'help.karaoke.keywords':
    'sing, singing, sing along, lyrics, microphone, mic, pitch, lrc, ultrastar, songs',

  'help.maker.title': 'Create in Karaoke Maker',
  'help.maker.intro':
    'Maker turns your audio into an editable karaoke project. Its timeline brings together audio, lyrics and pitch notes. Automatic results are a starting point: check words, timing and notes against the recording.',
  'help.maker.steps':
    'Open Make from Karaoke and load the source audio. Choose the available separation or transcription tools you need.\nWatch progress; first use of an AI tool may require a model download. Review the resulting lyrics and notes in the timeline.\nPlay short passages, correct the timing and text, save the project for later editing, then export the karaoke files.',
  'help.maker.lyricsCaption': 'The words, and when each one is sung',
  'help.maker.referenceName': 'Reference lyrics',
  'help.maker.reference':
    'The whole song as text, one line per row. Paste it or load a file; FluidEQ finds the timing from it.',
  'help.maker.timingName': 'Word timing',
  'help.maker.timing':
    'Every word, in order, with how many are timed so far. Press one to work on it.',
  'help.maker.wordName': 'Selected word',
  'help.maker.word':
    'Where the chosen word starts and how long it lasts. Moving its edge gives or takes time from the word beside it; the line keeps its length.',
  'help.maker.toolsCaption': 'The AI tools, and the models they need',
  'help.maker.separate':
    'Splits the recording into voice and music, so the karaoke can play without the singer.',
  'help.maker.loadVocals':
    'Use a vocal-only file you already have, instead of separating one here.',
  'help.maker.redetectTiming':
    'Listens to the voice again and re-times the words you already have.',
  'help.maker.redetectNotes':
    'Listens again for the melody and rewrites the notes under the words.',
  'help.maker.modelsName': 'AI model memory',
  'help.maker.models':
    'What each model needs and whether it is on this computer. They are downloaded the first time you use one.',
  'help.maker.idleName': 'When it is idle',
  'help.maker.idle':
    'Whether a model stays in memory between uses, and for how long. Releasing it frees memory; keeping it makes the next run start at once.',
  'help.makerBar.caption': 'The tools along the top of the maker',
  'help.makerBar.import':
    'Opens a karaoke file or a saved project, and keeps the audio already loaded.',
  'help.makerBar.lyrics': 'The words and their timing, in one window.',
  'help.makerBar.timing':
    'Moves the words and notes together, for a song that runs early or late from the first second.',
  'help.makerBar.pan':
    'Drag anywhere on the timeline to travel through the song without changing anything.',
  'help.makerBar.language':
    'Which language the words are in, and a second one beside it so the song can be sung in either.',
  'help.makerBar.record':
    'Play the song and press a key as each line starts and ends. The timing comes from your presses.',
  'help.makerBar.select':
    'Draw a box around notes to move or delete them as one.',
  'help.makerBar.paint': 'Draw the melody straight onto the pitch grid.',
  'help.makerBar.split':
    'Cuts a word into syllables, so a long word can carry a note on each one.',
  'help.makerBar.repair':
    'The tools that listen for you, and the models they need.',
  'help.makerBar.export':
    'Writes the finished karaoke out as a FluidEQ project, UltraStar TXT, LRC or enhanced LRC.',
  'help.maker.tip':
    'Model downloads need a connection and free disk space. Processing time depends on your hardware and song length. Use audio you are permitted to work with and review exports before sharing.',
  'help.maker.keywords':
    'vocals, vocal, remove vocals, vocal remover, voice removal, instrumental, acapella, a cappella, stems, stem separation, separate, isolate vocals, lyrics sync, timing, melody, notes, ultrastar, lrc, make karaoke, create karaoke, transcribe',

  'help.share.title': 'Share audio between computers',
  'help.share.intro':
    'Share Audio sends system audio between computers on the same private network. The receiver is the computer connected to your headphones or speakers; other computers are senders. This is separate from mirroring to a second device on one computer.',
  'help.share.steps':
    'On the listening computer, open Share Audio, choose Play audio on this computer and press Create connection code. Start at a low volume.\nOn each source computer, choose Send audio from this computer, paste the code for your network and press Connect and send.\nWatch the connection monitor. Press Stop sending or Stop listening when finished; Create new code disconnects every saved pairing.',
  'help.share.tip':
    'Keep the connection code private: it authorizes pairing. Several senders mix together and raise the level, which the receiving computer’s volume sets. Under the FluidEQ Engine, received audio also goes through the DSP rack.',
  'help.share.keywords':
    'network, lan, wifi, local network, stream audio, send audio, another pc, another computer, second computer, remote, receiver, sender, connection code, pair',

  'help.trouble.title': 'When something sounds wrong',
  'help.trouble.intro':
    'Start with the source and output, then isolate the layer. A graph, a saved preset or an enabled switch alone cannot prove that sound reached the intended device. The Help menu also leads to audio troubleshooting, problem reporting and the Forum.',
  'help.trouble.steps':
    'No sound: confirm playback is running, the expected output is selected, volume is up, and the device is connected. Check whether One player at a time paused another source.\nNo EQ change: confirm System EQ is on and the output shows no OFF badge; press Enable if it does. If a notice says the engine is not running, press Restart Windows audio.\nEverything looks right and the EQ still does nothing: Windows may be playing the music past the engine. The notice says so and offers one press to move the engine somewhere Windows will use; it costs a permission prompt and a second of silence.\nDistortion or excessive bass: leave Auto normalize on, reduce boosts and bypass layers one at a time. If it persists, use Report a problem and review the report before sending.',
  'help.trouble.tip':
    'F1 opens this guide. Esc closes an enlarged capture, then the guide. If the interface is too large, Ctrl + 0 resets zoom. Processes in the actions menu shows what each part of FluidEQ is doing.',
  'help.trouble.keywords':
    "no sound, not working, doesn't work, silent, silence, problem, issue, bug, broken, crackling, crackle, popping, distortion, distorted, clipping, too loud, too quiet, quiet, fix, troubleshoot, troubleshooting, report a problem, support, shortcuts, keyboard shortcuts, hotkeys, f1, zoom, reset zoom",

  'help.forum.title': 'Ask in the Forum',
  'help.forum.intro':
    'The Forum brings FluidEQ’s GitHub Discussions into the app: announcements, ideas, questions and tunings people are proud of. Anyone can read; posting uses your GitHub account, not a FluidEQ one.',
  'help.forum.steps':
    'Open Help → Forum and pick a board: Announcements, General, Ideas, Polls, Q&A or Show and tell.\nSearch the forum, or open a topic to read the replies.\nPress Sign in with GitHub, finish in your browser, then post a New topic or a reply.',
  'help.forum.tip':
    'Everything posted is public on GitHub under your GitHub name. On Q&A, mark the answer that worked so the next person finds it.',
  'help.forum.keywords':
    'community, questions, support, discussions, github, feedback, feature request, ideas, suggestions, ask, help, contact, announcements',
};

export default help;
