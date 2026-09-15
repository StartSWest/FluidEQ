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

  'help.requirements.title': 'What your PC needs',
  'help.requirements.intro':
    'FluidEQ runs on any Windows PC of the last ten years. Two parts ask for more than the rest: the Plus visualizers draw on the graphics card, and the karaoke AI downloads its models the first time you use it.',
  'help.requirements.steps':
    'Check your Windows: Windows 10 version 1803 or later, or Windows 11, 64-bit, 4 GB of memory and about 600 MB of disk. Processing everything the PC plays needs the FluidEQ Engine or Equalizer APO, and Windows asks for permission once while it installs.\nLook at a visualizer: any graphics card or built-in graphics from 2013 onwards. At 1080p built-in graphics are enough; 4K, or a desktop background on several screens at once, is happier with a dedicated card. On a busy card FluidEQ draws the scene smaller and lets go of the ones you cannot see.\nTry the karaoke AI: separating a voice downloads a 713 MB model the first time, the pitch model adds about 180 MB, and noise removal 11 MB. With a DirectX 12 graphics card a four-minute song separates in around half a minute; on the processor alone it takes about four minutes. Keep 2 GB of memory free while it works.\nAim for this if you can: Windows 11, 8 GB of memory, graphics from 2018 onwards, and 3 GB of disk free if you use the AI features.',
  'help.requirements.tip':
    'Everything but the AI models is in the installer, and those download only when you first use the feature. Processes, in the actions menu, shows what each part of FluidEQ is using on your machine right now.',

  'help.engine.title': 'The FluidEQ Engine',
  'help.engine.intro':
    "FluidEQ processes your sound with its own engine or with Equalizer APO. The FluidEQ Engine runs inside Windows' audio service after your sound card's effects, brings your EQ and the DSP rack to everything the PC plays, and steps aside the moment FluidEQ closes.",
  'help.engine.steps':
    'Open the actions menu — the pulse button at the top right — and press the engine card at the top of it.\nChoose FluidEQ Engine and press Apply. Windows asks for permission, and audio pauses for a few seconds while it restarts.\nIf an output shows OFF, press Enable on its notice. If a notice says the engine is not running, press Restart Windows audio.',
  'help.engine.tip':
    'Equalizer APO remains available for custom APO commands, Peace and VST plugins. When an update brings a newer engine, a notice offers Update engine. Quitting FluidEQ from the tray turns the EQ off on every output.',
  'help.engine.fluid':
    "Recommended. Your sound card's effects keep working, and the EQ and DSP rack reach every app.",
  'help.engine.apo':
    'Runs custom APO commands, Peace and VST plugins. The DSP rack stays with Library playback.',
  'help.engine.apply':
    'Switches the engine. Windows asks once, and audio restarts for a few seconds.',

  'help.eq.title': 'Shape your sound with EQ',
  'help.eq.intro':
    'Frequency chooses where a band acts, Gain sets the boost or cut, and Q sets its width: higher Q is narrower. Begin with small, broad changes and compare often.',
  'help.eq.steps':
    'Select a band in EQ → Bands. Turn its Frequency, Gain and Quality (Q) dials, or drag its point on the graph.\nRight-click a band to reset it, switch it off, or add a band beside it. Ctrl-click a slider or dial to return it to its default.\nPress Clear EQ to set every gain to 0 dB while keeping your bands. It asks first.',
  'help.eq.tip':
    'The response curve describes your filters; the moving spectrum describes the sound. Switching a band off with Active keeps its settings for later.',
  'help.eq.bandsCaption': 'The Bands page',
  'help.eq.voicing':
    'A quick character for the sound, such as Music or Movies.',
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
    'EQ mode changes how your bands and your correction curves are applied, without editing them. Band designs keep the frequencies and Q of a layout you like, ready for any output.',
  'help.eqmode.steps':
    'Open EQ mode on the Bands toolbar. Try a Strength, Band Q or Curve smoothing choice while music plays; the panel stays open.\nUnder the FluidEQ Engine, choose Minimum or Linear phase. Press Reset to return everything to Normal.\nOpen the layouts button beside Add band. Pick 6, 10, 15 or 31 bands, or press Save design… to name the current layout.',
  'help.eqmode.tip':
    'A design stores only frequencies and Q: loading one starts every band at 0 dB. Linear phase adds delay and can ring before sharp hits.',
  'help.eqmode.modeCaption': 'EQ mode',
  'help.eqmode.strength':
    'Normal, Studio ×1.5 or ×2, for your EQ and your curves separately.',
  'help.eqmode.q':
    'Constant keeps each Q; Proportional and Asymmetric narrow bands as they grow.',
  'help.eqmode.smoothing': 'Softens sampled correction curves.',
  'help.eqmode.phase': 'Minimum or Linear. With the FluidEQ Engine only.',
  'help.eqmode.reset': 'Everything back to Normal.',
  'help.eqmode.designsCaption': 'Band designs',
  'help.eqmode.builtIn': 'Standard layouts of 6, 10, 15 or 31 bands.',
  'help.eqmode.save':
    'Names the current frequencies and Q as a design, listed under My designs.',

  'help.headphones.title': 'Headphone correction & imports',
  'help.headphones.intro':
    'A headphone correction compensates for a measured model. It is a starting point you can combine with your own bands and voicing. Check the exact model and the measurement author before applying a result.',
  'help.headphones.steps':
    'Open EQ → EQ presets and search for your headphone model. Review the available measurements and choose the matching entry.\nFor EQ text from another tool, use Import EQ settings in the actions menu. Review the parsed bands and curve before applying.\nFor Squiglink, paste its export into the import panel. Apply as EQ replaces your bands; Apply as curve adds it as a headphone correction with its own strength.',
  'help.headphones.tip':
    'A preview marked not applied is not changing your sound. Avoid stacking two full corrections for the same headphones unless that is deliberate; compare with the headphone layer switched off.',

  'help.convolution.title': 'Use an impulse response',
  'help.convolution.intro':
    'Convolution applies a WAV impulse response as another correction layer. FluidEQ includes a searchable AutoEq catalogue and can import your own WAV. It remains separate from the editable parametric bands.',
  'help.convolution.steps':
    'Open EQ → Convolution. Search by model or measurement author.\nCheck the source, then use Download & apply; the download matches your output’s rate. Use Import a WAV for a file you already have.\nListen with the convolution layer on and off in Also applied.',
  'help.convolution.tip':
    'The FluidEQ Engine converts any impulse rate itself. Equalizer APO needs an imported WAV at the output’s own rate. Catalogue downloads need a connection; the guide does not.',

  'help.profiles.title': 'Devices, profiles & second output',
  'help.profiles.intro':
    'Your EQ follows the output device. Automatic mapping saves edits to the current output, while Named profiles lets you keep alternative sounds. Second output mirrors playback to other devices with a separate level for each.',
  'help.profiles.steps':
    'Confirm Output device before editing. Use New profile for a sound you want to keep; Update saves changes to that named profile, and Restore brings its saved settings back.\nOpen Second output, enable a reachable device, and set its level. Choose that device’s saved EQ profile directly beneath it.\nUse Game/Video for a smaller starting buffer or Music for more reserve. Compare synchronization on your devices.',
  'help.profiles.tip':
    'Each mirrored output uses its own profile under either engine. Mirroring runs while FluidEQ is open; switching the main output stops the old mirrors. Device latency still affects synchronization.',

  'help.config.title': 'Inspect & back up a chain',
  'help.config.intro':
    'EQ → Config shows what the audio engine actually has on disk. The output cards and include tree help you see which device and layers are involved. Export a chain before a large experiment or when moving a setup.',
  'help.config.steps':
    'Open EQ → Config and choose the output you want to inspect. Read its status and active layers.\nUse Export chain to save a .fluideq file. Keep a copy somewhere you can find again.\nTo bring a chain back, select the intended output first, then use Import chain and review the result.',
  'help.config.tip':
    'Generated layer files are rewritten when their settings change; put lasting manual lines in the per-output custom file. The FluidEQ Engine reads its Filter, Preamp, GraphicEQ and Convolution lines; other APO commands and plugins need Equalizer APO.',

  'help.dsp.title': 'Explore the DSP rack',
  'help.dsp.intro':
    'The DSP rack is a chain of studio stages. Under the FluidEQ Engine it processes everything the PC plays; under Equalizer APO it processes Library audio tracks. It is off while FluidEQ is switched off.',
  'help.dsp.steps':
    'Open DSP. Pick a chain under Presets, or select a stage in the rail and switch it On.\nChange one control at a time and compare with the stage bypassed at a similar volume. Isolate lets you hear only what a stage adds.\nSave a rack you like, and use Export and Import to share it.',
  'help.dsp.tip':
    'Louder often sounds better simply because it is louder, so compare at matched levels. Ctrl-click a dial to return it to its default.',
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

  'help.denoise.title': 'Denoise & source analysis',
  'help.denoise.intro':
    'Denoise reduces hiss, mains hum and clicks. Under the FluidEQ Engine it works live on anything the PC plays; the neural voice cleaner and the scanned noise floor are for Library tracks. Stronger reduction is not automatically better.',
  'help.denoise.steps':
    'Play something with the noise you want to reduce and select Denoise in DSP.\nSwitch on Hiss, Hum or Clicks with a light setting, and listen to quiet passages and to musical detail.\nIncrease reduction gradually, then bypass the stage to check that the improvement is worth any loss of detail.',
  'help.denoise.tip':
    'Listen for softened detail and watery or pumping textures. This is not a microphone cleanup. If you hear no change, confirm the rack and the stage are both on.',

  'help.graph.title': 'The graph and its controls',
  'help.graph.intro':
    'The response graph draws your EQ curves over the live sound. The strip above it chooses what is drawn and how, and it changes with the look: a standard style or a Plus visualizer.',
  'help.graph.steps':
    'Click the look’s name to choose a style or visualizer. The arrows beside it, Space and Ctrl+Space step through them.\nOpen View for the graph’s size, what it shows, and the wave’s height and position.\nDouble-click the plot for full screen. A single click hides or shows the strip.',
  'help.graph.tip':
    'Everything here changes only the drawing, never your sound. Esc leaves the expanded and full-screen views.',
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
    "The app's theme, the visualizer's colours, or its colours with light (Ambient).",
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
    'Click the look’s name on the graph. Search, or filter the styles by Lines, Fills, Bars, Points, Scenes or Wave.\nChoose a Plus visualizer on the right. Without Plus it is locked, and choosing it explains how to get it.\nOn a standard style, press New look to change its colours, motion and peaks, then save it; it appears under Yours.',
  'help.looks.tip':
    'A Plus visualizer brings its own colours: set its attack and release in View. If a scene cannot run on this computer, the graph draws a free style instead of a blank plot.',
  'help.looks.searchName': 'Search',
  'help.looks.search':
    'Finds styles and visualizers by name, maker or category.',
  'help.looks.styles': 'Free styles drawn by FluidEQ, and the looks you saved.',
  'help.looks.familiesName': 'Style filters',
  'help.looks.families': 'Lines, Fills, Bars, Points, Scenes, Wave and Yours.',
  'help.looks.plus':
    'Scenes from FluidEQ and from members, each with a picture.',
  'help.looks.categoriesName': 'Categories',
  'help.looks.categories': 'Nature, Cities, Abstract and more.',

  'help.plus.title': 'FluidEQ Plus and your account',
  'help.plus.intro':
    'An account is optional: everything that was free runs on this computer without one. FluidEQ Plus, monthly or yearly, adds Visualizers, the Studio, the Leaderboard, Dynamic lighting and the desktop visualizer.',
  'help.plus.steps':
    'Open Account in the actions menu. Sign in, or create an account and type the six-digit code sent to your email.\nPress Upgrade to Plus, read the terms, tick that you agree, and pay on Buy Me a Coffee in your browser with the same email.\nOpen the Plus tab. Its rail leads to the Leaderboard, Visualizers, the Studio and Dynamic lighting.',
  'help.plus.tip':
    'The app never sees your card; Manage subscription changes or cancels it. An account stays signed in on up to five computers, and Plus keeps working offline for a while.',
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
    'Scenes in your looks update themselves, and a scene’s page says what changed in each version. Open in Studio shows how FluidEQ’s own scenes are made.',
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
  'help.gallery.stepName': 'Previous and next',
  'help.gallery.step': 'Steps through the list you opened the scene from.',
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
    'One number a day leaves your computer — the minutes of music that played — and never what you play. Every number is checked on the server.',
  'help.leaderboard.periodName': 'All time or This month',
  'help.leaderboard.period': 'The whole history, or this month only.',
  'help.leaderboard.standing':
    'Your rank and points, and how far the next place is.',
  'help.leaderboard.earn':
    '10 points an hour, 20 for each day of 30 minutes or more, 5 for each like.',

  'help.studio.title': 'Make scenes in the Studio',
  'help.studio.intro':
    'The Studio turns a description into a visualizer. Your own AI assistant writes the scene in a project folder, and FluidEQ plays each version on your music the moment it is saved.',
  'help.studio.steps':
    'Open Plus → Studio and press New project…. Give it a name; FluidEQ makes its folder with a scene that already moves.\nDescribe your idea, open the folder in your AI assistant, and paste the prompt from Copy AI prompt.\nWatch the stage as files are saved and try the test signals. Then Add to my looks, Publish… or Export….',
  'help.studio.tip':
    'Double-click the stage for full screen. Look inside a FluidEQ scene… opens one of FluidEQ’s own scenes to learn from; it cannot be published. Scenes that flash hard or run too heavy are held back.',
  'help.studio.project': 'Your projects, and FluidEQ scenes to look inside.',
  'help.studio.switchName': 'Previous and next project',
  'help.studio.switch': 'Steps back or forward through your projects.',
  'help.studio.stageName': 'Stage',
  'help.studio.stage':
    'The scene, playing on your music. Double-click for full screen.',
  'help.studio.code': 'The scene’s code, live, updated as your AI saves it.',
  'help.studio.prompt':
    'Copies the prompt that tells your AI how scenes are made.',
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
    'It pauses for full-screen apps, a locked PC and, if you choose, battery power, and returns when FluidEQ starts. Quitting FluidEQ stops it. Windows only.',
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
    'Online Media keeps supported sites beside your EQ. Site playback and sign-in still depend on the provider and your connection. The bar at the foot of FluidEQ follows the active player, and its volume is the site’s own.',
  'help.online.steps':
    'Open Online Media and choose a supported site. Find and start something on that page.\nSwitch to EQ to tune while listening, then return to the page when you need its own controls.\nUse One player at a time if you want FluidEQ and other players to pause one another instead of overlapping.',
  'help.online.tip':
    'Under the FluidEQ Engine, Online Media goes through your EQ and the DSP rack like every other app. Under Equalizer APO the rack stays with Library tracks.',

  'help.library.title': 'Build your local library',
  'help.library.intro':
    'Library brings together music and video from your drives. Browse by albums, artists, genres, songs, folders, a folder tree or your playlists. Album art and details come from your files, so the same collection may look different depending on its tags.',
  'help.library.steps':
    'Open Library and add the folder containing your media. Let the scan finish before judging what is missing.\nChoose an artist or album, or search for a song. Start a track from the results.\nUse the bar at the foot of the window to pause, seek and skip. Its volume is one level for every player.',
  'help.library.tip':
    'Hover FluidEQ’s button on the Windows taskbar for Previous, Play and Next, even while it is minimized. Library needs the original files: reconnect a drive or add a moved folder again.',

  'help.queue.title': 'Albums & your play queue',
  'help.queue.intro':
    'The queue is the listening order; browsing is where you choose music. Opening another album lets you explore without making it the current song. The active track and Up next help you keep your place.',
  'help.queue.steps':
    'Open an album to inspect its tracks. Start the one you want to hear.\nRight-click a song for Add to up next, Add to Favourites or Add to playlist.\nOpen Up next to see what plays after, and turn on Keep playing to continue with more of the same genre.',
  'help.queue.tip':
    'Starting Library playback takes over from FluidEQ’s other players. Use the current track shown in the bar to confirm which source owns playback.',

  'help.karaoke.title': 'Sing with Karaoke',
  'help.karaoke.intro':
    'Karaoke pairs your own audio with lyrics. Timed lyrics follow playback; pitch targets depend on the song’s note data. A microphone adds your live pitch when configured, and the stage can fill the screen.',
  'help.karaoke.steps':
    'Open Karaoke. Use Add files or Add folder to bring in audio and matching lyric files.\nChoose a song and start playback. Check that the correct lyrics and backing track are paired.\nConfigure microphone input for live pitch, adjust lyric size for your viewing distance, and use the stage’s fullscreen control to sing.',
  'help.karaoke.tip':
    'A lyric-only file does not contain target notes. Karaoke follows the app’s Volume; the melody, backing and guide vocal levels are under Mix settings.',

  'help.maker.title': 'Create in Karaoke Maker',
  'help.maker.intro':
    'Maker turns your audio into an editable karaoke project. Its timeline brings together audio, lyrics and pitch notes. Automatic results are a starting point: check words, timing and notes against the recording.',
  'help.maker.steps':
    'Open Make from Karaoke and load the source audio. Choose the available separation or transcription tools you need.\nWatch progress; first use of an AI tool may require a model download. Review the resulting lyrics and notes in the timeline.\nPlay short passages, correct the timing and text, save the project for later editing, then export the karaoke files.',
  'help.maker.tip':
    'Model downloads need a connection and free disk space. Processing time depends on your hardware and song length. Use audio you are permitted to work with and review exports before sharing.',

  'help.share.title': 'Share audio between computers',
  'help.share.intro':
    'Share Audio sends system audio between computers on the same private network. The receiver is the computer connected to your headphones or speakers; other computers are senders. This is separate from mirroring to a second device on one computer.',
  'help.share.steps':
    'On the listening computer, open Share Audio, choose Play audio on this computer and press Create connection code. Start at a low volume.\nOn each source computer, choose Send audio from this computer, pick Music or Game/Video, paste the code for your network and press Connect and send.\nWatch the connection monitor. Press Stop sending or Stop listening when finished; Create new code disconnects every saved pairing.',
  'help.share.tip':
    'Keep the connection code private: it authorizes pairing. Several senders mix together and raise the level, and the receiver’s Volume sets it. Under the FluidEQ Engine, received audio also goes through the DSP rack.',

  'help.trouble.title': 'When something sounds wrong',
  'help.trouble.intro':
    'Start with the source and output, then isolate the layer. A graph, a saved preset or an enabled switch alone cannot prove that sound reached the intended device. The Help menu also leads to audio troubleshooting, problem reporting and the Forum.',
  'help.trouble.steps':
    'No sound: confirm playback is running, the expected output is selected, volume is up, and the device is connected. Check whether One player at a time paused another source.\nNo EQ change: confirm System EQ is on and the output shows no OFF badge; press Enable if it does. If a notice says the engine is not running, press Restart Windows audio.\nDistortion or excessive bass: leave Auto normalize on, reduce boosts and bypass layers one at a time. If it persists, use Report a problem and review the report before sending.',
  'help.trouble.tip':
    'F1 opens this guide. Esc closes an enlarged capture, then the guide. If the interface is too large, Ctrl + 0 resets zoom. Processes in the actions menu shows what each part of FluidEQ is doing.',

  'help.forum.title': 'Ask in the Forum',
  'help.forum.intro':
    'The Forum brings FluidEQ’s GitHub Discussions into the app: announcements, ideas, questions and tunings people are proud of. Anyone can read; posting uses your GitHub account, not a FluidEQ one.',
  'help.forum.steps':
    'Open Help → Forum and pick a board: Announcements, General, Ideas, Polls, Q&A or Show and tell.\nSearch the forum, or open a topic to read the replies.\nPress Sign in with GitHub, finish in your browser, then post a New topic or a reply.',
  'help.forum.tip':
    'Everything posted is public on GitHub under your GitHub name. On Q&A, mark the answer that worked so the next person finds it.',
};

export default help;
