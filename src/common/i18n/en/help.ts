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
    'A practical guide to FluidEQ, with illustrations drawn by the app’s own controls. Start with your first listening session, then explore at your own pace.',
  'help.offline': 'Available offline',
  'help.search': 'Search the guide',
  'help.searchHint': 'Try engine, bass, scene…',
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
    'Live illustrations follow your language and window colours. Example settings illustrate the controls; they are not recommended presets.',
  'help.steps': 'Try it',
  'help.tip': 'Good to know',
  'help.back': 'Back to top',

  'help.group.start': 'Get started',
  'help.group.sound': 'Shape your sound',
  'help.group.visuals': 'See your music',
  'help.group.plus': 'Scenes and your account',
  'help.group.listen': 'Listen, sing and share',
  'help.group.help': 'When you need help',

  'help.start.title': 'Your first five minutes',
  'help.start.intro':
    'Start with a familiar song at a comfortable volume. The left rail holds FluidEQ’s power key and the preamp; the centre is your workspace, with the graph over your bands; the sound panel on the right follows your output and its profiles. The bar at the foot of the window controls whatever is playing. The tour below streams only when you press Play. For the gaming page, see Gaming Lab.',
  'help.start.steps':
    'Install FluidEQ and keep the FluidEQ Engine selected when setup asks how to process your sound. Windows asks for permission once, with no restart.\nChoose your listening device in the sound panel’s Output card. Press the power key at the top of the left rail and leave Auto normalize on.\nPlay a song, open EQ → Bands, drag one band’s slider a little, and compare with the power key off and on.',
  'help.start.tip':
    'System-wide EQ needs Windows and an audio engine: the FluidEQ Engine or Equalizer APO. On macOS and Linux the app shows demonstration outputs, so a moving graph there is not proof that anything is processed.',
  'help.start.keywords':
    'install, installer, setup, set up, getting started, first steps, quick start, beginner, basics, tutorial, how to use, begin, power key, graph, tabs, bands page',
  'help.start.pagesName': 'The EQ’s pages',
  'help.start.pages':
    'Bands, Headphone corrections, Convolution and Config: what shapes the sound, one page each.',
  'help.start.engineName': 'The engine',
  'help.start.engine':
    'Which engine plays your EQ: the FluidEQ Engine or Equalizer APO. A red dot means it is not reaching the output you are listening to.',
  'help.start.delay':
    'How late the engine plays the sound on this output. Press it to see which stage adds what.',
  'help.start.graphName': 'The graph',
  'help.start.graph':
    'Your EQ’s curve and a point on every band, with what you hear moving behind it. Drag a point to shape the sound; the graph chapter has the rest.',
  'help.start.tabsName': 'Your EQ, Preset, Tone',
  'help.start.tabs':
    'Three tabs under the graph: your own bands, a ready-made preset under them, and the Tone’s cuts and dials. Each tab’s tools stand at the row’s end.',
  'help.start.bandsName': 'Your bands',
  'help.start.bands':
    'One slider per band, its frequency on top and its gain below. The EQ chapter shows each part.',
  'help.video.play': 'Play the video: {title}',
  'help.video.loading': 'Loading from fluideq.com…',
  'help.video.failed':
    'The video could not be loaded. It plays from fluideq.com, so it needs an internet connection.',
  'help.video.retry': 'Try again',

  'help.window.title': 'Around the window',
  'help.window.intro':
    'The header takes you between FluidEQ’s pages and shows the sound as it plays. The left rail holds FluidEQ’s power key, the preamp and the level meter; the sound panel on the right follows your output and its profiles.',
  'help.window.steps':
    'Open a page from the header: Scenes, Share Audio, Mic, Gaming Lab, EQ, DSP, Library, Karaoke, Online Media.\nPress the power key at the top of the left rail to turn FluidEQ on, and leave Auto normalize on, so no boost can clip.\nPress the level meter for its next style; Ctrl+press goes back one.\nIn the ≡ menu, slide Brightness anywhere from fully dark to fully white, and give Tint a second colour to draw the bands, the title and the lit controls in a gradient between the two.\nTo switch processing from another app, open the ≡ menu → On/off key and choose your own key combination. No key is assigned at first; the confirmation above other windows says whether FluidEQ is on or off.\nRight-click any text field for Cut, Copy, Paste and Select all. Searches ignore case, accents, spaces and punctuation: typing kpop matches K-pop.',
  'help.window.tip':
    'Help opens this guide, What’s new, the audio troubleshooter and Report a problem. The ≡ menu beside it has two columns. On the left: the engine card, Fix audio problems, Restart Windows audio, the On/off key, importing EQ settings or an impulse response, Processes, which shows what each part of FluidEQ is using, Reset all settings, animations, Start with Windows (FluidEQ then starts in the tray, shaping your sound with no window open) and the language. On the right, the window’s looks: Brightness, Tint (its two swatches are the window’s colour and a second one for a gradient), Tint app icon (off at first; it puts the taskbar, tray and tray-menu icons in the window’s colours), the EQ sliders and Set as desktop background. Notices stack at the bottom right of the window. The switch after the menus turns the window into the Compact player.',
  'help.window.keywords':
    'header, tabs, pages, menu, navigation, interface, layout, toolbar, sidebar, top bar, bottom bar, player bar, meter, tint, colour, color, second colour, gradient, theme, dark mode, light mode, dark theme, light theme, language, start with windows, autostart, startup, search, find names, accents, spaces, punctuation, case insensitive, power, power key, on off, brightness, white window, right-click, context menu, cut, copy, paste, notices, mic',
  'help.window.headerLeftCaption': 'The header, up to the signal',
  'help.window.headerRightCaption': 'The header, after the signal',
  'help.window.railCaption': 'The left rail',
  'help.window.media':
    'YouTube, YouTube Music, Bandcamp, Twitch and Suno, played inside FluidEQ with your EQ on them.',
  'help.window.share':
    'Sends this computer’s sound to another one, or plays another one’s here.',
  'help.window.mic':
    'Your microphones, each with a voice sound of its own that every app hears.',
  'help.window.gaming':
    'Your games, each with a sound of its own, tuned for that game.',
  'help.window.eq':
    'Your bands, presets, headphone correction and the engine’s config.',
  'help.window.waveName': 'Audio signal',
  'help.window.wave':
    'What is playing, as it plays, with its peak level; the graph’s View menu can hide it.',
  'help.window.dsp':
    'The effects rack: presets, the Room and every stage of the chain.',
  'help.window.library': 'Your music files, albums and play queue.',
  'help.window.karaoke': 'Sing along, and make karaoke out of your own songs.',
  'help.window.plus': 'Scenes: the gallery, the Studio and Dynamic lighting.',
  'help.window.support': 'Ways to support the work on FluidEQ.',
  'help.window.help':
    'This guide, What’s new, Full release notes, Forum, the audio troubleshooter, Report a problem and About FluidEQ. Full release notes opens all the notes directly. About has links to its sections and, where the support link is available, a Buy Me a Coffee card with a QR code.',
  'help.window.actions':
    'Two columns. Commands and behaviour: the engine, Fix audio problems, Restart Windows audio, the On/off key (a shortcut that turns all FluidEQ processing off and on while another app is in front; none at first, and a card above your other windows confirms each switch), importing EQ settings or an impulse response, Processes, Reset all settings, animations, Start with Windows and the language. Looks: Brightness, Tint and its second colour, Tint app icon, the EQ sliders and Set as desktop background.',
  'help.window.systemEq':
    'FluidEQ’s power key: turns its processing on or off for everything the PC plays. The line under it names the engine; it turns red when the engine is not reaching the output you are listening to, and a press then asks about the engine.',
  'help.window.preamp':
    'Lowers the level before the EQ so boosts have room. While Auto normalize holds it, it reads AUTO; with it off, turn the dial or press its number to type a level. Ctrl+click returns it to 0 dB.',
  'help.window.autoNormalize':
    'Keeps the preamp just low enough that nothing you boost can clip.',
  'help.window.responseGraph': 'Shows or hides the response graph.',
  'help.window.meterName': 'Level meter',
  'help.window.meter':
    'The output level, left and right, in real decibels, with the louder channel’s peak above it. Press it for its next style; Ctrl+press goes back one.',
  'help.player.title': 'The Compact player',
  'help.player.intro':
    'One switch turns FluidEQ’s window into the Compact player, a single narrow column: a scene or style at the top with the song over it and the play controls under it, then Sound, your equaliser, then Up next and your playlists. Whatever is playing keeps playing, and the same switch brings the full app back on the page you left.',
  'help.player.steps':
    'Press the Compact player switch in the title bar, beside Help. On the player, the same switch brings the full app back.\nFold Sound, or Up next and Playlists, down to its header, and the picture takes the room; press the header to open it again. Drag the player’s top or bottom edge to make it taller or shorter.\nDouble-click the picture to fill the screen with it; Escape gives it back. Press the look’s name beside shuffle and repeat to choose from every style and scene.\nChoose Fold to one line in the FluidEQ mark’s menu to fold the player down to one line; the mark unfolds it.\nIn the same menu, set the player’s own Brightness, the Transparency over a scene or the window’s Tint over a standard style, and a scene’s Daylight. Always on top, there or in the header, keeps it above other windows.\nDrop music files anywhere on the player: they join the Library and the end of Up next or, over the list, the place where you let go.\nIn Sound, choose Tone for Bass, Mid and Treble or Bands for the full EQ. Its preset and EQ mode controls change the same output as the full app. Explore scenes opens the gallery in the full window; automatic scene switching works in the Compact player too.',
  'help.player.tip':
    'The player’s volume is your computer’s own, the same as in Windows, so it sets the level of everything the computer plays. If the player ends up off the screen, right-click FluidEQ in the taskbar’s tray and choose Recover the window. While a game’s sound is on, the game button shows just the game’s name so it fits the Compact player.',
  'help.player.keywords':
    'mini player, small player, compact, compact mode, winamp, amp, player mode, always on top, pin, fold, one line, queue, up next, drop files, theme, light theme, dark theme, dark mode, light mode, small window, floating player, volume',
  'help.player.topCaption': 'The top: the song, and how it plays',
  'help.player.eqCaption': 'Sound, your equaliser',
  'help.player.queueCaption': 'Up next',
  'help.player.menuCaption': 'The player’s menu',
  'help.player.foldedCaption': 'Folded to one line',
  'help.player.menu':
    'Back to the full app or to one of its pages; the player’s own Brightness, Transparency or Tint, a scene’s Daylight, Tint app icon and the EQ sliders; Always on top and Fold to one line.',
  'help.player.pin': 'Keeps the player above every other window.',
  'help.player.switch': 'Back to the full app, on the page you left.',
  'help.player.clock': 'Time played. Click it for the time left.',
  'help.player.level': 'The level of the sound leaving FluidEQ, in decibels.',
  'help.player.volume':
    'Your computer’s volume, the same as in Windows: it sets the level of everything the computer plays.',
  'help.player.seek': 'Where the song is. Drag to jump.',
  'help.player.playingName': 'Play controls',
  'help.player.playing':
    'Previous, back five seconds, play or pause, forward five seconds, next and stop.',
  'help.player.orderName': 'Shuffle and repeat',
  'help.player.order':
    'Shuffles Up Next, and repeats nothing, everything or this song.',
  'help.player.lookName': 'Look',
  'help.player.look':
    'The style or scene on the player. Press it to choose from all of them.',
  'help.player.bands':
    'Drag a band up or down to boost or cut it. Its frequency is written under it.',
  'help.player.tone':
    'Tone shows the Bass, Mid and Treble dials; the tab beside it, every band.',
  'help.player.upNext':
    'Up next and Playlists, each with how many it holds, and the time left in the queue.',
  'help.player.songsName': 'The songs',
  'help.player.songs':
    'What plays next. Click a song to play it, drag it to move it, or drop music files here to add them where you let go.',
  'help.player.openIn': 'Opens the full app on one of its pages.',
  'help.player.theme':
    'The player’s own Brightness, apart from the full app’s; Transparency over a scene, or the window’s Tint over a standard style; a scene’s Daylight; and Tint app icon, off at first, for the taskbar icon, the tray icon and the icon in the tray’s menu in the window’s colours.',
  'help.player.fold': 'Folds the player to one line.',
  'help.player.unfold':
    'Unfolds the player. The arrow at the other end does too.',
  'help.player.foldedPlaying': 'Play or pause.',
  'help.player.fullScreen':
    'Fills the screen with the scene or style. Double-clicking the picture does the same, and Escape gives the screen back.',
  'help.player.sourceName': 'Source',
  'help.player.source':
    'Where the song is coming from: the Library, Online Media, Karaoke, another computer or another program on this PC. Pressing it opens that page in the full app.',
  'help.player.heart':
    'Adds a song from the Library to your Favourites, or takes it out.',
  'help.player.soundFold':
    'Folds the sound controls down to this row, which keeps the preset, Smart correction and the switch at hand, and opens them again.',
  'help.player.mode':
    'Opens EQ mode: how strongly your EQ and the curves apply, their band Q, phase and treble.',
  'help.player.save': 'Keeps Up next as a playlist of its own.',
  'help.player.queueFold':
    'Folds Up next and Playlists down to their tabs, and the picture takes the room.',
  'help.player.remove': 'Takes a song that has not played yet out of Up next.',
  'help.player.output':
    'Where the sound is going: the output Windows plays through.',
  'help.player.engineName': 'Engine',
  'help.player.engine':
    'Which engine is shaping the sound, lit while FluidEQ is on.',
  'help.player.sliders':
    'Round handles or rectangular caps on the EQ’s sliders, here and on the EQ page.',

  'help.requirements.title': 'What your PC needs',
  'help.requirements.intro':
    'FluidEQ runs on any Windows PC of the last ten years. Two parts ask for more than the rest: the scenes draw on the graphics card, and the karaoke AI downloads its models the first time you use it.',
  'help.requirements.steps':
    'Check your Windows: Windows 10 version 1803 or later, or Windows 11, 64-bit, 4 GB of memory and about 600 MB of disk. Processing everything the PC plays needs the FluidEQ Engine or Equalizer APO, and Windows asks for permission once while it installs.\nPlay scenes: any graphics card or built-in graphics from 2013 onwards. At 1080p built-in graphics are enough; 4K, or a desktop background on several screens at once, is happier with a dedicated card. On a busy card FluidEQ draws the scene smaller and lets go of the ones you cannot see.\nTry the karaoke AI: separating a voice downloads a 713 MB model the first time, the pitch model adds about 360 MB, and noise removal 11 MB. With a DirectX 12 graphics card a four-minute song separates in around half a minute; on the processor alone it takes about four minutes. Keep 2 GB of memory free while it works.\nAim for this if you can: Windows 11, 8 GB of memory, graphics from 2018 onwards, and 3 GB of disk free if you use the AI features.',
  'help.requirements.tip':
    'Everything but the AI models is in the installer, and those download only when you first use the feature. Processes, in the actions menu, shows what each part of FluidEQ is using on your machine right now.',
  'help.requirements.keywords':
    'system requirements, requirements, specs, hardware, laptop, gpu, graphics card, video card, cpu, processor, ram, memory, disk space, storage, windows 10, windows 11, minimum, recommended, performance, slow, lag, compatibility, mac, macos, linux',

  'help.engine.title': 'The FluidEQ Engine',
  'help.engine.intro':
    "FluidEQ processes your sound with its own engine or with Equalizer APO. The FluidEQ Engine runs inside Windows' audio service after your sound card's effects, brings your EQ and the DSP rack to everything the PC plays, and steps aside the moment FluidEQ closes.",
  'help.engine.steps':
    'Open the actions menu (≡) and press the engine card at the top.\nChoose FluidEQ Engine and press Apply. Windows asks for permission, and audio pauses for a few seconds while it restarts.\nIf an output shows OFF, press Enable on its notice. If a notice says the engine is not running, press Restart Windows audio.',
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
  'help.engine.nowName': 'The engine now',
  'help.engine.now':
    'Which engine plays your sound now; Apply stays off until you choose the other.',

  'help.eq.title': 'Shape your sound with EQ',
  'help.eq.intro':
    'Your EQ is the bands you shape yourself. Frequency chooses where a band acts, Gain sets the boost or cut, and Q sets its width: higher Q is narrower. Under the graph three tabs share the page: Your EQ, Preset and Tone, each a layer of its own. Begin with small, broad changes and compare often.',
  'help.eq.steps':
    'Open EQ → Bands. Your EQ holds your bands; Preset puts a ready-made sound under them, and New preset makes one of your own; Tone has Low cut, High cut, Bass, Mid and Treble, drawn as a line of their own.\nDrag a band’s slider, or its point on the graph, to boost or cut; the curve follows as you move. Click a band’s frequency, or its point, to select it. Ctrl+scroll over a band changes its Q.\nHold Shift with a band selected to bring up its popover beside it: its filter, the Frequency, Gain and Q dials, Active and the bin. Shift+Tab and Shift+← → step to the band before or after; Esc or × puts it away.\nEverything works from the keyboard too: Tab to a slider, a dial or a point on the graph, and the arrow keys step it; Page Up and Page Down take bigger steps.\nRight-click a band to reset it, switch it off, delete it (it asks for a second press), add a band beside it, or choose Left + right: one band for each ear at the same frequency, the left ear’s curve drawn solid and the right’s dashed. Both ears joins the two again.\nSelect several bands with Ctrl or Shift, or drag a box round them, to move them together; Ctrl+A on the graph selects every band.\nSave EQ keeps what plays as a saved EQ you can put on again, update or manage. Clear sets every gain to 0 dB and keeps your bands; it asks first.\nA preset of your own (Preset → New preset) starts its curve from a preset or flat; you shape it on the graph and its rack on the DSP page. Its tile’s menu exports it to a file, and Import on the Preset tab reads one back.',
  'help.eq.tip':
    'Curves lists what shapes this output besides your bands, each with its own strength and ×. Game mode, beside the engine’s name over the graph, cuts the delay FluidEQ adds, for games and calls; Gaming presets turn it on. While the EQ is switched off from its chip, its bands are dimmed and cannot be changed by accident; the Tone tab still works.',
  'help.eq.keywords':
    'equalizer, equaliser, parametric, parametric eq, graphic eq, bass boost, treble boost, low end, lows, mids, highs, tone, tone controls, peaking, shelving, low pass, high pass, band pass, bandwidth, hz, db, boost, cut, adjust sound, latency, labels, band labels, eq labels, readout, keyboard, arrow keys, accessibility, screen reader, left ear, right ear, each ear, per ear, left and right, stereo eq, delete band, remove band, popover, shift, band popover, save eq, saved eqs, your eq, preset tab, tone tab, new preset, own preset, export preset, import preset',
  'help.eq.rowCaption': 'The tabs under the graph, on Your EQ',
  'help.eq.tabBands': 'Your own bands, and how many there are.',
  'help.eq.tabPreset':
    'The preset under your bands, and the presets to pick from: by genre, by use, and your own.',
  'help.eq.tabTone':
    'Low cut, High cut, Bass, Mid and Treble: quick tone that leaves your bands as they are. It says Off while none is in use.',
  'help.eq.bandsCaption': 'Your bands',
  'help.eq.bandCaption': 'A band’s popover, while Shift is held',
  'help.eq.gameMode':
    'Cuts the delay FluidEQ adds, for games and calls. Gaming presets turn it on.',
  'help.eq.layers':
    'What else shapes this output — a preset, a headphone correction, Smart correction, a convolution — each with its strength, its switch and ×.',
  'help.eq.bandName': 'A band',
  'help.eq.band':
    'Drag its slider to boost or cut, or step it with the arrow keys. Ctrl+scroll over it changes its Q.',
  'help.eq.caption':
    'Click it to select the band. Ctrl+click or double-click puts it back on the layout’s frequency.',
  'help.eq.gainCaption': 'The band’s gain, in dB.',
  'help.eq.scaleName': 'dB scale',
  'help.eq.scale':
    'From +20 to −20 dB beside the sliders, with 0 dB marked, as a console prints it beside its faders.',
  'help.eq.stepName': 'Band before and after',
  'help.eq.step':
    '‹ and › move the popover to the band below or above, as Shift+Tab and Tab do inside it.',
  'help.eq.close':
    'Puts the popover away and keeps the band selected. Letting go of Shift does the same.',
  'help.eq.filter': 'Its shape: a peak, a shelf, a notch or a pass filter.',
  'help.eq.voicing':
    'A ready-made chain for the sound, such as Music or a genre. None leaves only your own bands.',
  'help.eq.smart':
    'Auto EQ: each song’s saved sound, its album’s sound from the Library, and Smart correction on top.',
  'help.eq.clear':
    'Sets every gain, and the Tone, to 0 dB and keeps your bands. Asks first.',
  'help.eq.saveEq':
    'Keeps what plays as a saved EQ, updates the one that is on, puts another on, or opens them all to manage.',
  'help.eq.mode':
    'How strongly your EQ and the curves apply, band Q, phase, treble and smoothing; it says Normal until you change something. With the EQ mode card pinned, it brings the card into view.',
  'help.eq.add':
    'Adds a band beside the selected one, at the Q of the bands already there.',
  'help.eq.layouts':
    'How many bands: band counts that start every band at one Q, the band designs you saved, and Reset layout.',
  'help.eq.frequency': 'Where the band acts, from 1 Hz to 20 kHz.',
  'help.eq.gain': 'How much it boosts or cuts. Ctrl+click returns it to 0 dB.',
  'help.eq.q':
    'How wide it is: higher is narrower. Ctrl+click returns it to the layout’s Q.',
  'help.eq.delete':
    'Press once to arm it, again to delete the band; the × beside it changes your mind.',
  'help.eq.menuDelete':
    'Turns red and asks for a second press before it deletes the band.',
  'help.eq.ears':
    'One band for each ear at the same frequency, to move apart; Both ears joins them again.',
  'help.eq.menuCaption': "A band's right-click menu",
  'help.eq.reset': 'Gain back to 0 dB and Q back to 2.',
  'help.eq.disable': 'Takes the band out of the sound and keeps its settings.',
  'help.eq.addLeft': 'Adds a band halfway to its lower neighbour.',
  'help.eq.addRight': 'Adds a band halfway to its higher neighbour.',

  'help.eqmode.title': 'EQ mode and band designs',
  'help.eqmode.intro':
    'EQ mode changes how your sound is shaped, without editing anything. It is a button in Your EQ’s tools under the graph, and pinned it is the first card of the sound panel, beside the curves it changes. It has two tabs: Your EQ covers your bands, the Tone, presets, Driver type and Smart correction; Corrections covers headphone corrections and imported or custom curves. Band designs keep the frequencies and Q of a layout you like, ready for any output.',
  'help.eqmode.steps':
    'Press EQ mode in Your EQ’s tools under the graph. Pinned, the card comes into view in the sound panel; otherwise it opens as a menu over the graph.\nPick the Your EQ or Corrections tab, then try a Strength or Band Q choice while music plays. Under the FluidEQ Engine choose Precise or Classic treble for each tab, and Minimum or Linear phase where a tab offers it.\nOn Corrections, Curve smoothing can soften sampled curves at 1/12 or 1/3 octave; it is Off until you choose. Reset puts everything back to Normal, and smoothing back to Off.\nWould you rather have a menu? Press the pin on the card: EQ mode then opens as a menu over the graph, and the pin in that menu brings the card back.\nOpen the band count button in Your EQ’s tools. Pick 6, 10, 15, 20 or 31 bands, or press Save design… to name the current layout.',
  'help.eqmode.tip':
    'A new layout starts every band at one Q, and a band you add takes the Q of the others. A design stores only frequencies and Q: loading one starts every band at 0 dB. Linear phase adds delay and can ring before sharp hits. Picking a built-in layout starts it fresh: its own frequencies and Q, every band at 0 dB and on both ears.',
  'help.eqmode.keywords':
    'band layout, band count, 10 band, 31 band, graphic eq, band design, strength, intensity, linear phase, minimum phase, smoothing, constant q, proportional q, treble, precise, classic, pin, unpin, card, side panel, menu, tabs, your eq, corrections, 1/12 octave',
  'help.eqmode.modeCaption': 'The EQ mode card',
  'help.eqmode.tabsName': 'Your EQ and Corrections',
  'help.eqmode.tabs': 'Two tabs, each with its own settings.',
  'help.eqmode.pin':
    'Puts these settings back in a menu over the graph. The menu’s pin brings the card back.',
  'help.eqmode.strength': 'Normal, Studio ×1.5 or ×2. Each tab keeps its own.',
  'help.eqmode.q':
    'Constant keeps each Q; Proportional and Asymmetric narrow bands as they grow. On Your EQ it shapes your own bands alone, never a preset or a correction.',
  'help.eqmode.treble':
    'Precise plays treble as drawn; Classic as Equalizer APO does. With the FluidEQ Engine only.',
  'help.eqmode.reset':
    'Everything back to Normal, and Curve smoothing back to Off.',
  'help.eqmode.designsCaption': 'Band designs',
  'help.eqmode.builtIn': 'Standard layouts of 6, 10, 15, 20 or 31 bands.',
  'help.eqmode.resetBands':
    'Puts every band back at its layout’s frequency and Q; gains stay as they are.',
  'help.eqmode.saved':
    'A design you saved: press it to load its frequencies and Q, every band at 0 dB. The bin beside it deletes it, after asking.',
  'help.eqmode.sampleDesign': 'Studio monitors',
  'help.eqmode.save':
    'Names the current frequencies and Q as a design, listed under My designs.',

  'help.games.title': 'Gaming Lab',
  'help.games.intro':
    'Give each game its own sound. A game starts from a Gaming profile made for it and gets its own copy: you tune the copy in the Gaming Lab, and the profile never changes. When the game comes to the front, FluidEQ puts its sound on and keeps it until you close the game, whatever you alt-tab to in between. Then your music sound comes back.',
  'help.games.steps':
    'Open the Gaming Lab in the title bar and press Add a game. Pick one from your launchers, a program that is open now, or browse for its program. It starts from the Gaming profile suggested for it; pick another in its Gaming profile list any time. The list has 32 title-specific profiles, including Counter-Strike 2, Valorant and Fortnite, plus 9 kinds of game.\nPress Try it now to put the game’s sound on. Pick a part on the left — the Game filter, EQ, Curve or any DSP stage — and tune it right there. Every change stays in this game’s copy.\nSave as profile keeps the copy as one of your own Gaming profiles for other games, updates yours, resets the copy to its profile, renames the copy or deletes it.\nStart the game. A card on the desktop says its sound is on, and another says your music sound is back when you close it. The card shows the loaded profile’s name, and names the music profile when it returns.',
  'help.games.tip':
    'While a game’s sound is on, the DSP page shows your music rack paused with a button to tune the game, and the profile list rests, so nothing done there can overwrite your music profile with the game’s sound. The Game filter brings up quiet steps and reloads as they happen and puts voices forward.',
  'help.games.list':
    'Your games run down the left and scroll on their own. Drag the rail’s edge to change its width. The pin folds it to the games’ icons, which open it over the page while the pointer is on them; press the pin again to keep it open. Its width and fold are remembered.',
  'help.games.keywords':
    'gaming, gaming lab, gaming profile, game profile, game presets, per game, per-game, per app, copy, automatic, auto switch, steam, epic, launcher, fps, shooter, footsteps, competitive, alt-tab, game mode, game filter, dialogue, voices, ambience, environment, hooves, resize, splitter, collapse, game list, scrolling',
  'help.games.switch':
    'Lets a game in front put its own sound on. Off, your games keep your music sound.',
  'help.games.add':
    'Adds a game from Steam, Epic, EA, GOG, Ubisoft, Battle.net or Xbox, or any program that is open now. FluidEQ, Windows Explorer, known system and launcher processes, and shared runtime installers are left out.',
  'help.games.gameName': 'A game',
  'help.games.game':
    'A game. The one open is marked, and a dot at its end means it is in front now. Its tooltip says the profile its sound started from and whether you tuned it.',
  'help.games.profile':
    'The Gaming profile this game’s copy starts from. Picking another gives the game a fresh copy of it.',
  'help.games.save':
    'Saves the copy as a new profile or updates one of yours, resets it to its profile, renames it or deletes it. The profile itself never changes.',
  'help.games.try':
    'Puts the game’s sound on now, so you hear what you tune. While it is on, Unload stands here and brings your music sound back.',
  'help.games.statusName': 'What was tuned',
  'help.games.status':
    'Which parts of this copy are different from its profile.',
  'help.games.railName': 'Its parts',
  'help.games.rail':
    'Every part of the game’s sound, each tuned in its own editor beside the list. Tuned marks what moved away from the profile.',

  'help.headphones.title': 'Headphone correction & imports',
  'help.headphones.intro':
    'A headphone correction compensates for a measured model. It is a starting point you can combine with your own bands and presets. Check the exact model and the measurement author before applying a result.',
  'help.headphones.steps':
    'Open EQ → Headphone corrections. It opens on My curves, your own list; the OPRA library tab beside it holds measured corrections for thousands of headphone models. Search for your exact model and choose the matching entry.\nFor EQ text from another tool, use Import EQ settings in the actions menu. Review the parsed bands and curve before applying.\nFor Squiglink, press Import from Squiglink on My curves, paste its export and review the live curve preview, then use it as a curve or as editable EQ.\nAdd curve takes a Squiglink export, a .txt file, your EQ as it is now or an OPRA pick, and asks which ears it is for: both, the left or the right. Each curve has Apply as curve and Apply as EQ; Apply as EQ replaces only those ears’ bands, after asking.\nA curve’s menu (≡) renames it, edits its bands, duplicates it, copies it as text or deletes it. Export list and Import list carry the whole list to another computer.',
  'help.headphones.tip':
    'A preview marked not applied is not changing your sound. Avoid stacking two full corrections for the same headphones unless that is deliberate; compare with the headphone layer switched off.',
  'help.headphones.keywords':
    'autoeq, headphone eq, headphone correction, headphone profile, harman, target curve, iem, iems, earphones, earbuds, in-ear, squiglink, crinacle, oratory1990, import eq, measurements, frequency response, left ear, right ear, one ear, my curves, saved curves, curve list, export list, import list',
  'help.headphones.tabsName': 'My curves and OPRA',
  'help.headphones.tabs':
    'Your own curves, with how many you keep, and OPRA’s library of measured headphone corrections.',
  'help.headphones.libraryName': 'OPRA updates',
  'help.headphones.library':
    'Whether OPRA’s library is up to date, with how many models it holds; when a newer one is out, Update database fetches it.',
  'help.headphones.add':
    'A Squiglink export, a .txt file, your EQ as it is now or an OPRA pick, for both ears or one. Import from Squiglink beside it pastes straight from Squiglink; Import list and Export list carry the whole list.',
  'help.headphones.searchName': 'Search and order',
  'help.headphones.search':
    'Finds a curve by its name; Recent and A–Z beside it order the list.',
  'help.headphones.applyEq':
    'Apply as curve plays it as a correction layer and keeps your bands; Apply as EQ puts it in your bands instead (only the ears it was saved for), after asking.',
  'help.headphones.moreName': 'A curve’s menu',
  'help.headphones.more':
    'Rename, edit its bands, duplicate, copy as text or delete.',

  'help.convolution.title': 'Use an impulse response',
  'help.convolution.intro':
    'Convolution applies a WAV impulse response as another correction layer. FluidEQ includes a searchable AutoEq catalogue and can import your own WAV. It remains separate from the editable parametric bands.',
  'help.convolution.steps':
    'Open EQ → Convolution. Search by model or measurement author.\nCheck the source, then use Download & apply; the download matches your output’s rate. Use Import a WAV for a file you already have.\nListen with the convolution layer on and off in Curves.',
  'help.convolution.tip':
    'The FluidEQ Engine converts any impulse rate itself. Equalizer APO needs an imported WAV at the output’s own rate. Catalogue downloads need a connection; the guide does not.',
  'help.convolution.keywords':
    'impulse response, ir, wav, convolver, fir, room correction, rew, autoeq catalogue, correction file',
  'help.convolution.import':
    'Applies a WAV you already have, at any rate under the FluidEQ Engine.',
  'help.convolution.applied':
    'The impulse this output plays now. Clear takes it off.',
  'help.convolution.search':
    'Searches AutoEq’s catalogue by model or measurement author.',
  'help.convolution.resultName': 'A result',
  'help.convolution.result':
    'The model, who measured it, and the impulse’s phase and rate. Source opens where it was published.',
  'help.convolution.apply':
    'Downloads the impulse at your output’s rate and applies it. Applied marks the one playing.',

  'help.profiles.title': 'Devices, profiles & second output',
  'help.profiles.intro':
    'Every output keeps its own sound: the EQ, the preset, the Tone, the cuts, the DSP rack, the Room and the leveling are saved with it and come back the moment you switch to it. Profiles keep other sounds for the same output. Second output plays on another device at the same time, with a sound and a level of its own.',
  'help.profiles.steps':
    'Check the output at the top of the Output card before editing; Bluetooth headphones show their battery beside it. Use New profile for a sound you want to keep; Update saves changes to that profile, and Restore brings its saved settings back.\nEach song’s own sound is in Auto EQ on the EQ page now: a song keeps its preset, Tone and EQ on every output, and the Library sets one for an album.\nOpen Second output, switch on a device and set its level. Choose its profile beneath it, or press Edit sound to change its sound on the EQ page without switching the main output; Done or Edit main takes you back.\nEach second output keeps itself in time and shows its delay in milliseconds; with Share Audio, another computer’s sound shows its own delay, the network included.',
  'help.profiles.tip':
    'Under the FluidEQ Engine a second output plays straight from the engine, and the main output never waits for it. Auto EQ starts switched off. On the EQ page the panel starts with the EQ mode card; fold it to reach your outputs sooner.',
  'help.profiles.keywords':
    'output, output device, device, speakers, switch device, device switching, auto switch, profile, save settings, named profile, second output, mirror, multiple outputs, two outputs, bluetooth, sync, delay, latency, per device, per output, every output, own sound, battery, edit sound, edit main',
  'help.profiles.list':
    'Sounds you saved. ON marks the one this output uses; press another to switch. A profile’s pencil renames it and its bin deletes it, after asking.',
  'help.profiles.update':
    'Saves your changes into the profile you are on. Restore, beside it, brings the profile back as you last saved it.',
  'help.profiles.new': 'Starts a new profile from the EQ you have now.',
  'help.profiles.output':
    'The output you are listening on, with its battery for Bluetooth headphones. OFF means your EQ does not reach it; ACTIVE, that Windows is playing through it.',
  'help.profiles.onePlayer':
    'Starting something in FluidEQ pauses what plays elsewhere on the PC, and the other way round.',
  'help.profiles.outputs':
    'Your other outputs. Switch one on to play there too, with its own sound, level and delay in milliseconds. Edit sound changes its sound on the EQ page without switching the main output.',
  'help.profiles.driver':
    'A gentle starting point for what you listen on — headphones, earphones, a driver size or material. Leave it at No compensation if the sound is already right.',
  'help.profiles.sampleHeadset': 'Headphones (USB Audio)',
  'help.profiles.sampleSpeakers': 'Speakers (Realtek Audio)',
  'help.profiles.sampleMusic': 'Music',
  'help.profiles.sampleMovies': 'Films',
  'help.profiles.sampleNight': 'Late night',

  'help.config.title': 'Inspect & back up a chain',
  'help.config.intro':
    'EQ → Config shows what the audio engine actually has on disk. The output cards and include tree help you see which device and layers are involved. Export a chain before a large experiment or when moving a setup.',
  'help.config.steps':
    'Open EQ → Config and choose the output you want to inspect. Read its status and active layers.\nUse Export chain to save a .fluideq file. Keep a copy somewhere you can find again.\nTo bring a chain back, select the intended output first, then use Import chain and review the result.',
  'help.config.tip':
    'Generated layer files are rewritten when their settings change; put lasting manual lines in the per-output custom file. The FluidEQ Engine reads its Filter, Preamp, GraphicEQ and Convolution lines; other APO commands and plugins need Equalizer APO.',
  'help.config.keywords':
    'backup, restore, export, import, config, config file, apo config, text file, fluideq file, chain file, include, custom lines, advanced',
  'help.config.statusName': 'Whether it is applied',
  'help.config.status':
    'Whether the engine is reading this config at all, said before anything else.',
  'help.config.outputsName': 'Outputs',
  'help.config.outputs':
    'Each output in the config, with its profile and how many filters it applies; Playing now marks the one you hear. Press one to see its chain.',
  'help.config.transferName': 'Export and import',
  'help.config.transfer':
    'Export chain saves this output’s chain as a .fluideq file; Import chain brings one back onto the output you are listening to.',
  'help.config.treeName': 'The chain’s files',
  'help.config.tree':
    'The output’s file and each layer’s file under it, in the order the engine reads them, with what each one says.',
  'help.config.customName': 'Your own file',
  'help.config.custom':
    'The one file FluidEQ never rewrites: put lasting lines of your own here with Edit.',
  'help.config.reload': 'Reads the config from disk again.',

  'help.dsp.title': 'Explore the DSP rack',
  'help.dsp.intro':
    'The DSP rack is a chain of studio stages. Under the FluidEQ Engine it processes everything the PC plays; under Equalizer APO it processes Library audio tracks. It is off while FluidEQ is switched off.',
  'help.dsp.steps':
    'Open DSP and pick a chain under Whole chain, at the top: it sets every stage at once. About opens a genre chain’s notes, with listening examples on YouTube.\nPress a stage in the rail to open it, and switch it on with its own switch. Its preset picker sets that stage alone, and Save beside it keeps just that stage.\nThe Normalizer stands apart from the chains: picking a chain never changes it.\nCompare with a stage off at a similar volume. Isolate, where a stage has it, plays only what that stage changes. Ctrl-click a dial to put it back.\nSave keeps the whole rack as a chain of your own; Export and Import carry it to another computer, and Reset puts the chain back as it was.\nAll channels runs the rack on every channel of a surround output; the switch beside it turns the whole rack on or off.\nDynamics, De-esser, Denoise, the Room and Crossfade have chapters of their own. The Game filter is on the Gaming Lab; while a game’s own sound is on, this page rests so nothing here can overwrite it.',
  'help.dsp.tip':
    'Louder often sounds better simply because it is louder, so compare at matched levels. Ctrl-click a dial to return it to its default.',
  'help.dsp.keywords':
    'effects, fx, audio effects, rack, chain, plugins, limiter, loudness, normalizer, leveler, volume leveling, exciter, harmonics, enhancer, stereo widener, widen, stereo width, bass enhancer, sub bass, subharmonic, punch, transient, mastering, clipping, peak limiter, crossfade, gapless, de-esser, deesser, sibilance, harsh s, sharp s, ess, voice, speech, podcast, profiles, save profile, footsteps, footstep, hear footsteps, steps, gaming, game audio, reloads, loudness equalization, game, game filter, dialogue, voice clarity, voices forward, ambience, environment, rain, wind, hooves, horses',
  'help.dsp.normalizer':
    'Evens out the source’s level before every effect: Loudness, True Peak or off. Picking a chain never changes it.',
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
  'help.dsp.room':
    'Surround on headphones: each channel becomes a speaker in a room around you.',
  'help.dsp.maximizer':
    'Raises the level without letting peaks pass the ceiling.',
  'help.dsp.master': 'Final level, loudness target and peak safety.',
  'help.dsp.crossfade': 'Blends one Library track into the next.',
  'help.dsp.presets':
    'Ready-made chains for music, genres, devices and repairs. Picking one sets every stage at once.',
  'help.dsp.chainActionsName': 'Chain actions',
  'help.dsp.chainActions':
    'Reset puts the chain back; Save keeps the rack as a chain of your own; Export and Import carry it to another computer.',
  'help.dsp.switchesName': 'Rack switches',
  'help.dsp.switches':
    'All channels runs the rack on every channel of a surround output, or on the front pair alone; On switches the whole rack.',
  'help.dsp.stagePresetName': 'Stage preset',
  'help.dsp.stagePreset':
    'The open stage’s own presets, with its arrows, Reset and Save, which keep this stage alone.',

  'help.room.title': 'The Room: surround on headphones',
  'help.room.intro':
    'The Room turns headphones into a listening room. Every channel of the sound becomes a speaker standing around your head, rendered through a measured head and the reflections of a room you shape yourself, so a film sits in front of you and a game surrounds you. It needs the FluidEQ Engine and headphones; on speakers it does nothing useful.',
  'help.room.steps':
    'Open DSP, choose Room in the rail and switch it on. Stereo becomes two speakers in front of you; a 5.1 film five and the sub; a 7.1 game the whole ring. The line under the presets says which.\nPick a room under Room preset — the featured rooms first, then the classic ones and your own — or turn Space, Ambience and Distance yourself and drag a speaker around the ring. Speakers the playing stream cannot reach are drawn asleep.\nPress a speaker: the pane beside the picture becomes its own, with its angle, its distance, its level, and Mute or Solo.\nUnder Your head, press Start the listening test and answer five short listening pairs: the room takes the head that puts sounds in front of you. Small, Medium and Large can be chosen by hand too.\nSave a room you like under a name; a saved room comes back with a press and never changes your head.',
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
  'help.room.dials':
    "How much of the walls you hear, the soft tail after them, and how far the speakers stand. Size, Walls and the tail's own length and tone are in Room character below.",
  'help.room.head':
    'The measured head the room renders through — small, medium or large — and the listening test that picks it for your ears.',
  'help.room.bass':
    'Sends the speakers’ bass to the sub or keeps it full range, at a crossover you choose, and sets the centre and the sub’s levels.',
  'help.room.stereo':
    'For a stereo source only: keep it a front stage, or fill the room around you by the amount you choose.',
  'help.room.saved': 'Name the room as it stands; it comes back with a press.',
  'help.room.liveName': 'What the room is doing',
  'help.room.live':
    'Read from the engine: which speakers the playing stream reaches, or why the room is idle.',

  'help.denoise.title': 'Denoise & source analysis',
  'help.denoise.intro':
    'Denoise reduces hiss, mains hum and clicks. Under the FluidEQ Engine it works live on anything the PC plays; the neural voice cleaner and the scanned noise floor are for Library tracks. Stronger reduction is not automatically better.',
  'help.denoise.steps':
    'Play something with the noise you want to reduce and select Denoise in DSP.\nSwitch on Hiss, Hum or Clicks with a light setting, and listen to quiet passages and to musical detail.\nIncrease reduction gradually, then bypass the stage to check that the improvement is worth any loss of detail.\nFor a Library file, let its source analysis finish before comparing the measured noise floor or neural voice cleaner. Live system audio can use hiss, hum and click reduction, but the neural voice cleaner is for Library playback.',
  'help.denoise.tip':
    'Listen for softened detail and watery or pumping textures. This is not a microphone cleanup. If you hear no change, confirm the rack and the stage are both on.',
  'help.denoise.keywords':
    'noise, noise reduction, noise removal, remove noise, hiss, hum, buzz, clicks, crackle, static, clean up, cleanup, restoration, repair, background noise, vinyl',
  'help.denoise.preset':
    'Starting points for a gentle or a strong clean-up, hiss, hum, clicks, vinyl, tape or a podcast. Save keeps your own.',
  'help.denoise.isolate':
    'Plays only what Denoise takes away, so you can check it takes nothing you want to keep.',
  'help.denoise.graphName': 'Noise picture',
  'help.denoise.graph':
    'The sound against its noise floor, with the hiss reduction, the hum and the click repairs drawn as they happen.',
  'help.denoise.analysis':
    'On a Library track: the noise floor, the hum and the clicks a minute, measured from the file itself. Rescan measures again.',
  'help.denoise.hiss':
    'Lowers the steady hiss under the music. Reduction limit leaves a little of it, so what remains does not warble.',
  'help.denoise.hum':
    'Notches out mains hum and its harmonics. Auto takes 50 or 60 Hz from what the scan found.',
  'help.denoise.clicks':
    'Finds and bridges short clicks and crackle; anything longer is left alone, so drums survive.',
  'help.denoise.voice':
    'The neural voice cleaner, for Library playback. Its model downloads the first time you use it.',
  'help.denoise.liveName': 'What it is doing',
  'help.denoise.live':
    'How much it is reducing right now, the clicks repaired, and any moment the voice cleaner fell behind.',

  'help.graph.title': 'The graph and its controls',
  'help.graph.intro':
    'The response graph draws your EQ curves over the live sound. Its options rest out of sight and come back under the pointer: the legend in one corner, View and full screen in the other, and along the foot the gallery of looks, the one on the graph in the middle with its switches, the ones before and after it at the ends. What the gallery offers changes with the look: a standard style or a scene.',
  'help.graph.steps':
    'Click the look’s name to choose a style or scene. The arrows beside it, Space and Ctrl+Space step through them.\nOpen View for what the graph draws — every drawing has its switch, each curve its own — the frequency range, the wave’s height and position, and How it is drawn: the frame rate (every frame your display offers, or 60 or 30, held at 60 on battery), the resolution and smoothing. Standard styles keep their own choices, apart from scenes.\nA scene adds its own controls to View — whatever its author left for you to set — and Use its own wave puts the wave back to the height and position that author chose.\nDouble-click the plot to fill the screen with it, and double-click again to come back. In full screen the window’s top edge brings the header and its bottom edge the transport; a click puts them away.\nKeys: Ctrl+F full screen, Esc back, Ctrl+G the grid, Ctrl+W and Ctrl+S walk Wave only, Wave with curves and Curves only, Ctrl+I which way the wave faces, Ctrl+A every band. On a band’s point, drag to move it, use the arrow keys to step it, and right-click for its menu; Ctrl+scroll changes the Q of a selected point.\nPress a curve’s name in the graph legend to hide or show its drawing. This leaves the sound unchanged. Remove or change the layer under Curves when you want to change what you hear.',
  'help.graph.tip':
    'Everything here changes only the drawing, never your sound.',
  'help.graph.keywords':
    'graph, spectrum, spectrum analyzer, analyzer, analyser, frequency response, curve, full screen, fullscreen, frame rate, fps, refresh rate, wave, waveform, grid, view, shortcuts, keyboard shortcuts, hotkeys, double-click, expanded, expand, labels, band labels, eq labels, keyboard, arrow keys, graphics, resolution, smoothing, gallery, legend, frequency range, analyzer slope, tilt, place, edit hint',
  'help.graph.stripCaption': 'With a standard style',
  'help.graph.legend':
    'The name of every curve drawn, and Live output for the wave. Press one to hide or show its drawing; the sound stays the same.',
  'help.graph.previous': 'Steps back to the previous look.',
  'help.graph.picker': 'Opens every style and scene.',
  'help.graph.placeName': 'Place in the walk',
  'help.graph.place':
    'Where this look stands among the ones the arrows step through.',
  'help.graph.next': 'Steps forward to the next look.',
  'help.graph.auto': 'Changes the look every 10 seconds to 2 minutes.',
  'help.graph.colouring':
    'Colours the style: Auto, Flat, Frequency, Level or Heat.',
  'help.graph.newLook': 'Designs a look of your own from this style.',
  'help.graph.gridName': 'Grid',
  'help.graph.grid': 'Shows or hides the grid and scales.',
  'help.graph.hintName': 'How to edit on the graph',
  'help.graph.hint':
    'Point at it for the moves: drag a point, Ctrl or Shift to select, Ctrl+scroll for Q, Ctrl+drag to move a group as a bell.',
  'help.graph.viewName': 'View',
  'help.graph.view':
    'What the graph draws and how: every curve, the labels, the legend, the wave, the grid, the frequency range and the meter.',
  'help.graph.plusCaption': 'With a scene',
  'help.graph.creditName': 'The scene and its maker',
  'help.graph.credit':
    'Which scene is playing and who made it. Press it to choose another style or scene.',
  'help.graph.likeName': 'Like',
  'help.graph.like':
    'Likes the scene playing, which gives its maker points. On a scene of your own it shows how many likes it has.',
  'help.graph.lighting': 'Lights your RGB devices with this scene.',
  'help.graph.desktop': 'Puts this scene behind your desktop icons.',
  'help.graph.viewCaption': 'The View menu',
  'help.graph.fullscreen': 'The graph fills the screen.',
  'help.graph.curves':
    'A switch for each curve the graph draws, in the order they are applied. Ctrl+W walks Wave only, Wave with curves and Curves only; Ctrl+S walks back.',
  'help.graph.labels': 'Each band’s frequency, Q and gain over its point.',
  'help.graph.wave':
    'The live wave of what you hear, drawn in the look you chose.',
  'help.graph.range':
    'How much of the spectrum the graph spans: 10 Hz–20 kHz to start with, 20 Hz–20 kHz, 10 Hz–30 kHz, or 20 Hz–16 kHz where records have sound. With the grid off it spans 20 Hz–16 kHz.',
  'help.graph.slope':
    'Tilts the analyzer by up to 6 dB per octave, so music, which falls towards the treble, reads flatter. Off by default; only on styles that draw the analyzer.',
  'help.graph.meter': 'The output meter in the left rail.',
  'help.graph.drawing':
    'Frame rate, resolution and smoothing, kept apart for standard styles and scenes.',
  'help.graph.sampleScene': 'Aurora',
  'help.graph.sampleScenePrevious': 'Bloom',
  'help.graph.sampleSceneNext': 'Neon City',
  'help.graph.sampleMaker': 'Lumen Works',

  'help.looks.title': 'Styles and scenes',
  'help.looks.intro':
    'Standard styles are free drawings of the live sound that you can colour and design yourself: Line and Area for a clean trace, LED blocks and Spikes for punch, Truss, Skyline and Dancing flames for whole scenes. Scenes are living pictures drawn on the graphics card, such as Alpine, Aurora, Bloom and Neon City, where the bass, the beat and the treble each move something different.',
  'help.looks.steps':
    'Click the look’s name on the graph. Choose a place on the left, or search everything at once.\nUse From to see only FluidEQ’s looks, members’ scenes or your own. A scene that is not yours yet is locked, and choosing it explains how to get it.\nOn a standard style, press New look to change its colours, motion and peaks, then save it; it appears under From: Yours.',
  'help.looks.tip':
    'A scene brings its own colours: set its attack and release in View. Standard styles have graphics settings of their own in View, apart from scenes: full resolution and plain scaling to start with. If a scene cannot run on this computer, the graph draws a free style instead of a blank plot.',
  'help.looks.keywords':
    'styles, style, skins, skin, appearance, scene, scenes, visualizer, visualiser, visualization, colours, colors, look, customize, customise, animation, graphics, graphics settings, resolution, quality',
  'help.looks.searchName': 'Search',
  'help.looks.search': 'Finds styles and scenes by name, maker or category.',
  'help.looks.placesName': 'Places',
  'help.looks.places':
    'Everything, New and updated, the kinds of style and every category of scene, each with how many it holds.',
  'help.looks.from': 'Who made it: FluidEQ, members, or you.',
  'help.looks.viewName': 'View and order',
  'help.looks.view':
    'Pictures or a detailed list, sorted by newest, recently updated, name or most used.',
  'help.looks.plus':
    'Each look as a picture. New or Updated marks what changed, and Playing marks the look on the graph.',

  'help.plus.title': 'Your account, credits and the Scenes tab',
  'help.plus.intro':
    'An account is optional: everything that was free runs on this computer without one. Signed in, the Scenes tab holds the Gallery, the Studio, Dynamic lighting and the desktop background. A scene from the Gallery costs one credit and is yours for good; a confirmed account gets 1 credit free, and packs of credits are paid once.',
  'help.plus.steps':
    'Open the Scenes tab and press Sign in, or Create your free account and type the six-digit code sent to your email. Once you are in, your account is the card at the foot of the tab’s left rail.\nChoose Gallery. Open a scene, watch it, and press Get to spend a credit on it.\nFor more credits, open your account from that card and choose a pack. It is paid once on Stripe, in your browser.',
  'help.plus.tip':
    'The app never sees your card, and nothing renews. An account stays signed in on up to five computers.',
  'help.plus.keywords':
    'account, sign in, login, log in, sign up, register, credits, credit, pack, buy, price, pricing, cost, payment, pay, premium, paid, scene, subscription, cancel, membership, member, email code',
  'help.plus.visualizers':
    'Scenes by FluidEQ and members, ready for your music.',
  'help.plus.studio': 'Make your own scenes with your AI.',
  'help.plus.lighting': 'Your RGB devices follow the scene.',
  'help.plus.fold': 'Folds the rail to its pictures; it opens again on hover.',

  'help.gallery.title': 'The Scenes gallery',
  'help.gallery.intro':
    'The gallery brings together FluidEQ’s own scenes and scenes published by members. Anyone with an account can browse the gallery. If a scene has a published preview, its silent ten-second clip loops until you move on. Scenes without a clip show their cover. A scene you get with a credit plays with your music and stays in your looks.',
  'help.gallery.steps':
    'Open Scenes → Gallery. Search, sort by Most liked, This week or Newest, or pick a category.\nOpen a scene and press Get to keep it with a credit, then Play on the graph. The arrows, or ← and →, step between scenes.\nLike the scenes you have with the heart, and report one that should not be there.',
  'help.gallery.tip':
    'Scenes in your looks update themselves, and a scene’s page says what changed in each version. A scene you publish appears once FluidEQ’s maker has approved it. Open in Studio shows how FluidEQ’s own scenes are made. A 3D scene says so on its card and its page, with the keys that move its camera. While a scene plays, View → Window colours chooses what the window wears: Original, Colours or Ambient.',
  'help.gallery.keywords':
    'scenes, scene, scene gallery, download scenes, visualizers, download visualizers, browse, community scenes, likes, like, report, samples',
  'help.gallery.search': 'Finds scenes and makers.',
  'help.gallery.sortName': 'Sort',
  'help.gallery.sort': 'Most liked, liked this week, or newest.',
  'help.gallery.categoriesName': 'Categories',
  'help.gallery.categories': 'Shows one kind of scene.',
  'help.gallery.mine': 'The scenes you published, with their likes.',
  'help.gallery.cardName': 'A scene',
  'help.gallery.card':
    'Its picture opens the scene. Get keeps it with a credit, and the heart likes it.',
  'help.gallery.manage': 'What each monitor shows as a desktop background.',
  'help.gallery.stop': 'Stops every desktop background.',
  'help.gallery.sceneCaption': "A scene's page",
  'help.gallery.back': 'Back to the gallery, where you left it.',
  'help.gallery.play':
    'Plays the scene on the graph. A scene you do not have yet offers Get, for one credit.',
  'help.gallery.desktop': 'Puts the scene behind your desktop icons.',
  'help.gallery.inspect':
    'Opens FluidEQ’s scene in the Studio to see how it is made.',

  'help.studio.title': 'Make scenes in the Studio',
  'help.studio.intro':
    'The Studio turns a description into a scene. Your own AI assistant writes the scene in a project folder, and FluidEQ plays each version on your music the moment it is saved. The Studio is free for every account.',
  'help.studio.steps':
    'Open Scenes → Studio and press New project…. Give it a name; FluidEQ makes its folder with a scene that already moves.\nDescribe your idea, open the folder in your AI assistant, and paste the prompt from Copy AI prompt.\nOr type what should change in the chat beside the stage: Claude Code on this computer, signed in with your own plan, edits the scene and plays each version. Every reply keeps its version, with Bring back.\nWatch the stage as files are saved and try the test signals. Then Add to my looks, Publish… or Export….\nIn Publish…, write a line about the scene or press Write with AI, then Send for review: FluidEQ records the silent ten-second preview for the Gallery on the demo song as it sends.',
  'help.studio.tip':
    'Double-click the stage for full screen. Look inside a FluidEQ scene… opens one of FluidEQ’s own scenes to learn from; it cannot be published. Scenes that flash hard or run too heavy are held back. A scene you publish is read by FluidEQ’s maker first, and once it is approved it plays free for you everywhere.',
  'help.studio.keywords':
    'create a scene, make a scene, create visualizer, make visualizer, shader, glsl, code, ai, chatgpt, claude, prompt, publish, export scene, scene editor, creator, chat, studio chat, ask for a change, claude code, bring back, versions',
  'help.studio.project': 'Your projects, and FluidEQ scenes to look inside.',
  'help.studio.stageName': 'Stage',
  'help.studio.stage':
    'The scene, playing on your music. Double-click for full screen.',
  'help.studio.hears':
    'What the scene receives: level, beat, bass, mids, treble.',
  'help.studio.tabs':
    'Tune tries the wave and the scene’s own settings, Code shows its code as your AI saves it, Performance how it runs here, and What it hears now is open below.',
  'help.studio.chat':
    'Ask Claude for a change in your own words. Each reply that changed the scene can bring that version back.',
  'help.studio.signals': 'Test signals that drive only this preview.',
  'help.studio.size': 'Tries the scene full screen.',

  'help.desktop.title': 'The desktop background',
  'help.desktop.intro':
    'The desktop background puts a scene behind your desktop icons, on one monitor or on each of them, for as long as FluidEQ runs.',
  'help.desktop.steps':
    'Put a scene on the graph and press the monitor button beside its name, or choose View → Set as desktop background.\nPress the monitors on the map, choose With the music or Calm, and press Set background.\nTo change or stop it, open Scenes → Gallery and use Manage or Stop at the top.',
  'help.desktop.tip':
    'It pauses while windows cover the monitor, while the PC is locked and, if you choose, on battery power, and returns when FluidEQ starts. Quitting FluidEQ stops it. Windows only.',
  'help.desktop.keywords':
    'wallpaper, live wallpaper, animated wallpaper, desktop background, background, multiple monitors, second monitor, screens',
  'help.desktop.monitors':
    'Your monitors as Windows arranges them. Press the ones to use.',
  'help.desktop.music': 'Moves to whatever is playing.',
  'help.desktop.calm': 'A slow, quiet animation that ignores the music.',
  'help.desktop.follow':
    'Changes with the scene on the graph, whether you pick it or automatic switching does.',
  'help.desktop.battery': 'Saves power while the computer is unplugged.',
  'help.desktop.start': 'Starts it on the monitors you chose.',

  'help.lighting.title': 'Dynamic lighting (beta)',
  'help.lighting.intro':
    'Dynamic lighting lights your keyboard, mouse, mousepad, headset and stand with the scene on the graph, through Windows Dynamic Lighting and Razer Chroma. It is in beta, so tell us how your devices behave.',
  'help.lighting.steps':
    'Open Scenes → Dynamic lighting and switch it on, or press the lighting button beside a scene on the graph.\nChoose this scene’s lighting style — Scene, Colour wave, Spectrum or Beat ripple — and set its brightness and what it responds to.\nClick a device under Your devices to tune it alone; All devices goes back to every device.',
  'help.lighting.tip':
    'If Windows keeps a device for another app, the page names the setting to change and opens it for you. Razer devices need Razer Synapse running, with Chroma Apps allowed.',
  'help.lighting.keywords':
    'rgb, razer, chroma, synapse, keyboard lights, keyboard, mouse, headset, led, leds, ambient lighting, lights, windows dynamic lighting',
  'help.lighting.switch': 'Lights your devices while a scene plays.',
  'help.lighting.browse': 'Opens the gallery to choose a scene.',
  'help.lighting.previewName': 'Live desk preview',
  'help.lighting.preview': 'Your own desk, lit with the colours sent to it.',
  'help.lighting.devices':
    'Every device found. Click one to tune it alone; All devices, above the list, tunes them all at once again.',
  'help.lighting.style':
    'Scene, Colour wave, Spectrum or Beat ripple, kept for each scene.',

  'help.online.title': 'Listen with Online Media',
  'help.online.intro':
    'Online Media plays YouTube, YouTube Music, Bandcamp, Twitch and Suno inside FluidEQ, laid out like the Library: the sites and your recent searches down the rail, the bar over the page. What plays goes through your EQ like any other app; playback and sign-in are each site’s own.',
  'help.online.steps':
    'Pick a site on the rail. Search it from the bar, or find something on its page and start it.\nPress a recent search to run it again on the site that is open.\nGo to another tab while it plays: the page keeps playing, and the bar at the foot of the window follows it.\nTurn on One player at a time if FluidEQ and other players should pause each other instead of overlapping.',
  'help.online.tip':
    'Under the FluidEQ Engine, Online Media goes through your EQ and the DSP rack like every other app. Under Equalizer APO the rack stays with Library tracks.',
  'help.online.keywords':
    'youtube, youtube music, bandcamp, twitch, suno, streaming, stream, web, website, browser, online, search history, recent searches, sign out, log out, colours, dark page',
  'help.online.sites':
    'The sites. A dot beside one says it is playing. The pin above them folds the rail to its icons.',
  'help.online.recent':
    'What you searched before. Press one to search the open site again; its × forgets it.',
  'help.online.colours':
    'Colours the site’s page to match FluidEQ, on your screen only. Videos, pictures and logos are never changed, and sites with light pages keep their own.',
  'help.online.signOut':
    'Clears every login, cookie and cached page the player holds.',
  'help.online.navName': 'Back, forward and reload',
  'help.online.nav':
    'Move through the pages you opened on the site, or load the page again.',
  'help.online.search':
    'Searches the site that is open, and keeps the search in Recent searches.',

  'help.library.title': 'Browse and tidy your Library',
  'help.library.intro':
    'The Library gathers the music and videos on your drives in one page: the shelves down the rail, a bar to find and lay them out, and where you are under it. Covers and details come from the files’ tags, which the tag editor puts right.',
  'help.library.steps':
    'Press Add folder at the foot of the rail and choose the folder with your music. The status line under the page says when the Library is up to date.\nPick a shelf: Albums, Artists, Genres, Songs, Folders (your folders open as a tree under it), Videos, or a playlist. A video plays in the page, with a Subtitles tab for its captions.\nSearch from the bar, show the shelf in Details, Grid or Cover Flow, and order it with Sort. The arrows step back and forward through where you have been.\nOpen a record, an artist or a folder for its songs. An artist’s name, wherever it is shown, opens their page: their records and every song they are on.\nTo fix tags, right-click a song, several songs or a record and choose Edit tags (Ctrl+I) or Fix tags automatically (Ctrl+Shift+I). One song opens beside the page; an album, a folder or a selection opens as the page.\nLook the changes over and press Save. The files are written in the background, and the card in the corner offers Undo, which puts the old tags back.',
  'help.library.tip':
    'Hover FluidEQ’s button on the Windows taskbar for Previous, Play and Next, even while it is minimized. Drop music on the Library to play it. The Library needs the files where it found them: plug a drive back in, or add a moved folder again.',
  'help.library.keywords':
    'music player, player, local files, local music, mp3, flac, wav, aac, folders, folder tree, albums, artists, artist page, genres, playlist, video, videos, subtitles, scan, rescan, cover flow, grid, sort, tags, tag editor, edit tags, fix tags, id3, rename files, cover art, album art, musicbrainz, undo, Playlists, New playlist',
  'help.library.shelvesName': 'Shelves',
  'help.library.shelves':
    'What the Library holds, with how much is on each. Folders opens a tree of your folders under it.',
  'help.library.playlists':
    'All your playlists, where a new one is made; Favourites and your own under it.',
  'help.library.addFolder':
    'Adds a folder of music or videos. Your folders, under it, lists them and removes one.',
  'help.library.history':
    'Steps back and forward through the places you opened.',
  'help.library.search':
    'Finds songs, artists and albums in the whole Library.',
  'help.library.views': 'Details, Grid or Cover Flow, on every shelf.',
  'help.library.sort':
    'Orders the shelf by title, artist, year, recently added, most played and more. The arrow turns the order round.',
  'help.library.upNext':
    'Opens and folds the right pane: the song playing, Up next, Details and Lyrics.',
  'help.library.album':
    'Opens the record. Right-click it to play all of it, queue it, add it to a playlist or edit its tags.',
  'help.library.rescan':
    'Says whether the Library is up to date. Rescan reads your folders again for changes; Force rescan, beside it, reads every file afresh.',
  'help.library.tagsCaption': 'An album in the tag editor, after Fix tags',
  'help.library.fixAuto':
    'Fills in what is missing from the file names, the folder’s name, a .cue sheet and what most songs agree on, with the folder’s picture as the cover. Nothing is looked up online.',
  'help.library.searchWeb':
    'Opens the album on MusicBrainz in your browser. FluidEQ downloads nothing.',
  'help.library.cover':
    'One cover for every song. Press it to choose a picture, paste one or search for one, or drop an image on it.',
  'help.library.albumFields':
    'Values typed once for every song. What changed is in colour, a replaced value struck through under it; the arrow puts the old one back.',
  'help.library.findReplace':
    'Finds words in every title and replaces them at once.',
  'help.library.fileNames':
    'Renames the files from their tags by a pattern. Each new name shows under its song, the old one struck through.',
  'help.library.sheet':
    'Each song’s number, title and artist, edited like a spreadsheet. Drag a row by its grip, then press Renumber by order.',
  'help.library.save':
    'Writes the changes; nothing on disk changes before. Discard drops them all.',
  'help.library.changesCaption': 'Changes: what Save will write',
  'help.library.changes':
    'Everything Save will write, counted. It takes Up next’s place while the editor is open.',
  'help.library.changesAlbum':
    'What changes on every song. A value filled where there was none is green; a replaced one shows the old value struck through.',
  'help.library.changesSongs':
    'Each song’s own changes, then the files that get a new name.',

  'help.queue.title': 'Records, Up next and lyrics',
  'help.queue.intro':
    'A record opens under its cover without stopping what plays. Beside it, the right pane holds the song playing over three tabs: Up next, the song’s Details and its Lyrics.',
  'help.queue.steps':
    'Open a record and press Play, or press a song to start there. A second press on a song starts it again from the top.\nRight-click a song for Add to up next, Add to Favourites or Add to playlist; pick several with Ctrl or Shift.\nIn Up next, press a song to play it now, drag it to change the order, or point at it and press × to take it out.\nTurn on Keep playing to go on with more of the same genre when the list runs out. Surprise me, at Up next’s foot and on the playing bar, starts a random song from your Library and carries on in its style.\nLyrics shows the song’s words from its tags, or from a .lrc or .txt file of the same name beside it. Timed lines follow the song word by word.\nNo lyrics, or the wrong ones? Find other lyrics searches the song online in your browser. Import the file you download, paste the words, or drop the file on the tab; FluidEQ keeps them with the song.',
  'help.queue.tip':
    'Open in Karaoke turns a song’s lyrics into a karaoke in the Karaoke Maker, where their timing can be fixed. On Windows, drop music files or folders on the Compact player to add them to the Library and queue them.',
  'help.queue.keywords':
    'queue, up next, next song, shuffle, repeat, favourites, favorites, playlist, keep playing, autoplay, surprise me, random, now playing, lyrics, lrc, synced lyrics, timed lyrics, lrclib, genius, musixmatch, karaoke, play order',
  'help.queue.recordCaption': 'A record, open',
  'help.queue.place':
    'Where you are: the shelf, then the record. Press the shelf to go back to it.',
  'help.queue.artist':
    'Opens the artist’s page: their records, and every song they are on.',
  'help.queue.fix':
    'Opens the record in the tag editor with Fix tags’ proposals typed in.',
  'help.queue.actionsName': 'The record’s buttons',
  'help.queue.actions':
    'Play, Shuffle, Add to up next, Show in Explorer, and the record’s menu: Favourites, playlists, Edit tags and more.',
  'help.queue.albumSound':
    'A sound for this album, a saved EQ or a preset, that plays with any of its songs.',
  'help.queue.filter':
    'Narrows this record’s songs as you type. The bar’s search looks through the whole Library.',
  'help.queue.songsName': 'The songs',
  'help.queue.songs':
    'Press a song to play it. The bars mark the one playing, the star your Favourites; right-click for its menu.',
  'help.queue.paneCaption': 'The right pane, on Up next',
  'help.queue.now': 'The song playing. Its artist’s name opens their page.',
  'help.queue.tabs':
    'Up next, the song’s Details (its file, format and loudness), and its Lyrics. For a video the last tab is Subtitles.',
  'help.queue.keep':
    'When the list runs out, carries on with more of the same genre, then a surprise.',
  'help.queue.rowsName': 'What plays next',
  'help.queue.rows':
    'The rest of what you were playing, headed by its record. Press a song to play it now, drag it to reorder, point at it for its ×.',
  'help.queue.picks':
    'Songs you added, after the rest of the record, in the order you added them.',
  'help.queue.surprise':
    'A random song from your Library now, then more of its style.',
  'help.queue.lyricsCaption': 'Lyrics, and Find other lyrics',
  'help.queue.lyricsLine':
    'The line being sung, lit word by word. Press any line to play from it.',
  'help.queue.sourceName': 'Where they came from',
  'help.queue.source':
    'The song’s tags, or the lyrics file beside it, by name. The bin deletes a lyrics file kept with the song; words inside the song’s own file are never changed.',
  'help.queue.karaoke':
    'Starts a karaoke from these lyrics in the Karaoke Maker, where their timing can be fixed.',
  'help.queue.findOther':
    'Opens the finder, shown on the right, to bring in other lyrics.',
  'help.queue.sites':
    'Searches the song on LRCLIB (free, timed lyrics), Genius or Musixmatch, in your browser. FluidEQ fetches no lyrics itself.',
  'help.queue.import':
    'Keeps the words with the song: a file you downloaded, pasted words, or a file dropped on the tab (.lrc, .srt, .vtt, .ttml, .json, .yaml or .txt).',

  'help.karaoke.title': 'Sing with Karaoke',
  'help.karaoke.intro':
    "Karaoke puts your own songs on a stage: the words as they are sung, the chords, and a pitch strip that draws your voice against the song's notes and scores every line. Your songs stand in a list beside it, as in the Library, and a song plays through the Library's player, with your sound settings.",
  'help.karaoke.steps':
    "Open Karaoke and press + beside Songs to add files or a whole folder: each song with its lyric file. Double-click a song to sing it.\nUse the row at the top of the stage: Pitch and Chords turn the pitch strip and the chord chips on and off, each on its own; Scene, Art, Video or None chooses what stands behind the words. With Scene on, the scene picker appears beside it.\nTurn on the microphone in the pitch strip's corner and sing. Each note is a box and your voice is a line through it: green in tune, yellow close, red off. Every note gets its verdict as it ends.\nUnder the strip, each line of the song is a row of cells with its score. Press a line to sing it again from just before it. When the song ends, its summary shows your score out of 10,000, what was hardest, a tip and every line against your best; See results opens it again.\nOpen Mix settings on the player bar for the volume, the melody tone, the backing track and, once the Maker has separated the song, the Guide vocal: the singer's own voice under the music, as loud as you want it.\nFull screen gives the window to the stage. The row and the player bar step away after a few still seconds: move the pointer to the top edge for the header or to the bottom edge for the bar, or pin them with the buttons beside full screen.",
  'help.karaoke.tip':
    "A lyric file with only the words has no notes, so there is nothing on the strip to sing to or score; UltraStar files carry them, and the Karaoke Maker can add them. Chords come from the song's own files when it has them, a chord sheet beside the song or chords in its lyric file, and are worked out from the music otherwise. The microphone is analysed on this computer for level and pitch; FluidEQ never records it or plays it through your speakers.",
  'help.karaoke.keywords':
    'sing, singing, sing along, lyrics, microphone, mic, pitch, score, scoring, chords, guide vocal, full screen, lrc, ultrastar, songs',
  'help.karaoke.stageCaption':
    'The stage: the words, the chords, your pitch and your score',
  'help.karaoke.guides':
    'Pitch shows the strip of notes, Chords the chord chips. Each turns on and off by itself; with both off the stage shows only the words.',
  'help.karaoke.background':
    "What stands behind the words: the scene, the song's cover art, its video, or nothing. Art and Video are there when the song brings them.",
  'help.karaoke.maker':
    'Opens this song in the Karaoke Maker, to fix its timing, its words or its notes.',
  'help.karaoke.textSize':
    'Makes the words bigger or smaller for the distance you sing from.',
  'help.karaoke.micSettings':
    'Which microphone to sing into, how loud it hears you and its volume. It lights up while the microphone is on.',
  'help.karaoke.fullScreen':
    'Gives the whole window to the stage; double-clicking the stage does the same. In full screen two more buttons here keep the header or the player bar on screen.',
  'help.karaoke.chords':
    'The chord just played, the one sounding now, lit, and the next two.',
  'help.karaoke.pitch':
    'The notes to sing as boxes, and your voice as a line through them: green in tune, yellow close, red off. Drag it to move through the song, and drag the handle above it to make it taller.',
  'help.karaoke.micToggle':
    'Turns the microphone on or off. While it listens, the note you are singing shows beside it.',
  'help.karaoke.score':
    "Each line as a row of cells, one for each note, in its verdict's colour, with your running score and your streak. Press a line to sing it again.",
  'help.karaoke.playlistCaption': 'Your songs, beside the stage',
  'help.karaoke.search':
    "Finds a song in the list by its title or its file's name.",
  'help.karaoke.add':
    'Add files or a folder, group the list by folder, or clear it.',
  'help.karaoke.fold':
    "Folds the list away to give the stage the room. The Playlist button at the start of the stage's row brings it back.",
  'help.karaoke.singingName': 'The song on the stage',
  'help.karaoke.singing':
    'It wears moving bars while it is sung. Click a song to pick it and double-click it to sing; point at a row to move it up or down or take it out of the list.',
  'help.karaoke.folderName': 'A folder',
  'help.karaoke.folder':
    'With the list grouped by folder, press a folder to fold its songs away or open them again. The number is how many songs it holds.',
  'help.karaoke.mixCaption':
    'Mix settings, on the player bar at the foot of the window',
  'help.karaoke.volume':
    "Your computer's volume, the same fader every tab's bar has. Its icon mutes the sound.",
  'help.karaoke.melody':
    "A tone that plays the song's notes, to sing along with. Its button turns it on or off.",
  'help.karaoke.backing':
    'The music: the song itself, or its backing track once the Karaoke Maker has separated the voice from it.',
  'help.karaoke.vocal':
    "The singer's own voice, laid under the backing when the song has been separated. Down to zero for the music alone.",
  'help.karaoke.scene':
    "With the scene behind the words, how much of it shows through and how blurred it is. The Karaoke keeps its own, apart from the graph's.",
  'help.karaoke.micCaption': 'Microphone settings',
  'help.karaoke.micInput': 'The microphone you sing into.',
  'help.karaoke.micOn':
    "Starts or stops listening. Whether it is on shows at the panel's top right.",
  'help.karaoke.micLevel':
    'How loud the microphone hears you right now. Sing and watch it move.',
  'help.karaoke.micVolume':
    'Raises a microphone too quiet for your pitch to be heard, or lowers one that is too loud.',
  'help.karaoke.scoreCaption': 'The summary at the end of a song',
  'help.karaoke.total':
    'Your score out of 10,000, its word, and how it stands against your best on this song.',
  'help.karaoke.statsName': 'In tune · On time · Notes',
  'help.karaoke.stats':
    'How much of the time you sang inside the notes, how many notes you came in on time, and how many you hit, with every verdict counted under them.',
  'help.karaoke.hardest':
    'The line that gave you the most trouble and why, with one thing to try next time under it.',
  'help.karaoke.practise':
    'Takes you back to just before that line to sing it again.',
  'help.karaoke.again': 'The whole song again, from the start.',
  'help.karaoke.map':
    'Every line with its rating and how many points it moved since your best. Press a line to practise it.',
  'help.karaoke.attempts':
    'Your last tries at this song, this one and your best among them.',

  'help.maker.title': 'Create in Karaoke Maker',
  'help.maker.intro':
    "The Karaoke Maker turns a song into a karaoke you can sing: its words, when each one is sung, and the notes of the melody. It opens on the song on the stage, in one editor: the tools along the top, the song's sound with the words and notes under it, and a live preview of how the stage will show them.",
  'help.maker.steps':
    "On the Karaoke stage, press Open in Maker. Press Lyrics and paste the song's words or load a lyric file, one line per row, with every repeat written out.\nPress Detect timing and melody to let FluidEQ listen for when each word is sung and which notes carry it, or Accept and record timing to tap each line in yourself as the song plays. The first time, the AI models it needs are downloaded.\nCheck the result in the grid: the words sit in lanes above the notes, and the notes are drawn as the stage draws them. Drag a word or a note to move it, or its edge to change its length. Select notes draws a box round several; Paint notes draws new ones.\nMove through the song with the overview under the grid, or drag with the middle mouse button anywhere on the grid to move in time and pitch at once. The Pitch range against the grid's left edge zooms and scrolls the notes. Follow lyrics keeps the playhead in view, turning the page as it reaches the edge.\nPress Use in player to sing it on the stage. Export saves it as a FluidEQ project, UltraStar TXT, LRC or enhanced LRC; a song from your Library can also be saved back to it with Save to Library.",
  'help.maker.editorCaption':
    "The editor: the song's sound, its words and its notes",
  'help.maker.gridName': 'The grid',
  'help.maker.grid':
    "The song's sound across the top, its words in three lanes under it, and its notes as boxes on the pitch grid, as the stage draws them. Drag with the middle mouse button to move through it in time and pitch.",
  'help.maker.pitchRange':
    'Where the grid stands in pitch, against the whole range. Drag its ends to zoom, its middle to scroll; double-click it to fit the notes.',
  'help.maker.overview':
    'The whole song, with the part shown in the grid framed. Drag the frame to move, its edges to zoom.',
  'help.maker.follow':
    'Keeps the playhead in view as the song plays, turning the page when it reaches the edge.',
  'help.maker.preview':
    'The words as the stage will show them, as the song plays. Its A slider sizes the words; hide it for more room.',
  'help.maker.checked':
    "How many words you have adjusted by hand, and how many are still as they were detected or imported, with the song's notes, words and checks beside them.",
  'help.maker.lyricsCaption': 'The words, and when each one is sung',
  'help.maker.reference':
    'The whole song as text, one line per row. Paste it or load a file; FluidEQ finds the timing from it.',
  'help.maker.timing':
    'Every word, in order, with how many are timed so far. Press one to work on it.',
  'help.maker.word':
    'Where the chosen word starts and how long it lasts. Moving its edge gives or takes time from the word beside it; the line keeps its length.',
  'help.maker.toolsCaption': 'Repair tools, and the AI models they need',
  'help.maker.separate':
    'Splits the recording into voice and music. The karaoke can then play without the singer, the Guide vocal fader can bring the voice back under it, and detection hears the words more clearly.',
  'help.maker.loadVocals':
    'Use a vocal-only file you already have, instead of separating one here.',
  'help.maker.redetectTiming':
    'Listens to the separated voice again and re-times the words you already have. It waits until the voice is separated.',
  'help.maker.redetectNotes':
    'Listens to the separated voice again for the melody and rewrites the notes under the words. It waits until the voice is separated.',
  'help.maker.models':
    'What each model needs and whether it is on this computer. They are downloaded the first time you use one.',
  'help.maker.idle':
    'Whether a model stays in memory between uses, and for how long. Releasing it frees memory; keeping it makes the next run start at once.',
  'help.makerBar.caption': 'The tools along the top of the Maker',
  'help.makerBar.import':
    'Opens a karaoke file or a saved project, and keeps the audio already loaded.',
  'help.makerBar.lyrics': 'The words and their timing, in one window.',
  'help.makerBar.timing':
    'Moves the words and notes together, for a song that runs early or late from the first second.',
  'help.makerBar.language':
    'Which language the words are in, and a second one beside it so the song can be sung in either.',
  'help.makerBar.record':
    'Play the song and press a key as each line starts and ends. The timing comes from your presses.',
  'help.makerBar.select':
    'Draw a box around notes to move or delete them as one.',
  'help.makerBar.paint': 'Draw the melody straight onto the pitch grid.',
  'help.makerBar.repair':
    'Separates the voice from the music and listens again for the words or the melody, with the AI models they need.',
  'help.makerBar.export':
    'Writes the finished karaoke out as a FluidEQ project, UltraStar TXT, LRC or enhanced LRC.',
  'help.makerBar.apply':
    'Hands the finished karaoke to the stage and closes the Maker.',
  'help.maker.tip':
    'Detection is a starting point: play short passages and correct the words and notes against the recording. Separating the voice from the music first lets detection hear the words more clearly, and gives the player its Guide vocal fader. Models need a connection and disk space the first time; use audio and lyrics you are allowed to work with.',
  'help.maker.keywords':
    'vocals, vocal, remove vocals, vocal remover, voice removal, instrumental, acapella, a cappella, stems, stem separation, separate, isolate vocals, lyrics sync, timing, melody, notes, pitch, ultrastar, lrc, make karaoke, create karaoke, transcribe, maker',

  'help.share.title': 'Share audio between computers',
  'help.share.intro':
    'Share Audio links computers on the same private network into one group, and each one plays the others’ sound: whichever one you sit at, you hear the rest. Each computer sends its own sound straight to the others, untouched, and never sends back what it receives, so there is no echo; the computer you listen on applies its own EQ, curves and DSP. This is separate from mirroring to a second device on one computer.',
  'help.share.steps':
    'On one computer, open Share Audio, press Add computer and then Copy code. Start at a low volume.\nOn the other computer, press Add computer, paste the code under The other computer’s code and press Link. Both computers play each other right away. Link more computers the same way: each one joins the whole group, and computers that join through another one appear with Receive off until you turn it on.\nIn The whole group, each computer has two switches, Receive and Send; Share turns this computer’s sound off for all of them. Your mix sets This PC’s volume and a level for each computer.\nPause, Resume and Unlink are in each computer’s menu. A computer that is away stays listed as Offline, and the group finds itself again after a restart, sleep, a network drop or an engine switch.\nTurn Fluid on beside Share for music over a connection that stalls. It adds a small playback cushion; switch it off when lower delay matters more.\nFor a saved computer that stays Offline, open its ••• menu and choose Reconnect. It tries the saved code again without forgetting the link; if the other computer’s address changed, copy and paste its current code.',
  'help.share.tip':
    'Keep the connection code private: it authorizes linking. Under the FluidEQ Engine this computer keeps its DSP on while it shares, and the computer playing its sound applies its own. Playing and sending at once needs Windows on that computer; elsewhere a link runs one way.',
  'help.share.keywords':
    'network, lan, wifi, local network, stream audio, send audio, another pc, another computer, second computer, remote, receiver, sender, connection code, pair, both ways, two way, link, unlink, duplex, pause, resume, volume, group, add computer, receive, send, share, mix, offline, several computers',
  'help.share.mix': 'This PC’s volume, and a level for each computer you hear.',
  'help.share.outputName': 'Output',
  'help.share.output': 'Where this computer plays the group.',
  'help.share.add':
    'Copy this computer’s code, or paste another’s and press Link.',
  'help.share.shareSwitch':
    'Share sends this computer’s sound to the whole group; Fluid beside it adds a small cushion for a connection that stalls.',
  'help.share.switchesName': 'Receive and Send',
  'help.share.switches':
    'Receive plays that computer here; Send plays this one there. Its ••• menu pauses, resumes, reconnects or unlinks it.',
  'help.share.laneName': 'What it plays',
  'help.share.lane':
    'That computer’s song and its sound as it arrives, with the delay each way.',

  'help.trouble.title': 'When something sounds wrong',
  'help.trouble.intro':
    'Start with the source and output, then isolate the layer. A graph, a saved preset or an enabled switch alone cannot prove that sound reached the intended device. The Help menu also leads to audio troubleshooting, problem reporting and the Forum.',
  'help.trouble.steps':
    'No sound: confirm playback is running, the expected output is selected, volume is up, and the device is connected. Check whether One player at a time paused another source.\nNo EQ change: confirm the power key at the top of the left rail is on and the output shows no OFF badge; press Enable if it does. If the engine’s notice says it is not running, press Restart Windows audio.\nEverything looks right and the EQ still does nothing: Windows may be playing the music past the engine. The notice says so and offers one press to move the engine somewhere Windows will use; it costs a permission prompt and a second of silence.\nDistortion or excessive bass: leave Auto normalize on, reduce boosts and bypass layers one at a time. If it persists, use Report a problem and review the report before sending.',
  'help.trouble.tip':
    'F1 opens this guide. Esc closes an enlarged capture, then the guide. If the interface is too large, Ctrl + 0 resets zoom. Processes in the actions menu shows what each part of FluidEQ is doing.',
  'help.trouble.keywords':
    "no sound, not working, doesn't work, silent, silence, problem, issue, bug, broken, crackling, crackle, popping, distortion, distorted, clipping, too loud, too quiet, quiet, fix, troubleshoot, troubleshooting, report a problem, support, shortcuts, keyboard shortcuts, hotkeys, f1, zoom, reset zoom",
  'help.trouble.noticeName': 'The engine’s notice',
  'help.trouble.notice':
    'Says which output the engine is not reaching and why, at the bottom right of the window, once sound is heard there.',
  'help.trouble.useApo':
    'Switches to Equalizer APO instead, through the engine dialog.',
  'help.trouble.restart':
    'Restarts Windows audio, which usually brings the engine back. Windows asks for permission.',

  'help.forum.title': 'Ask in the Forum',
  'help.forum.intro':
    'The Forum brings FluidEQ’s GitHub Discussions into the app: announcements, ideas, questions and tunings people are proud of. Anyone can read; posting uses your GitHub account, not a FluidEQ one.',
  'help.forum.steps':
    'Open Help → Forum and pick a board: Announcements, General, Ideas, Polls, Q&A, Show and tell, Tips & tricks or Support FluidEQ. New for you gathers what came in since you last looked, and Issues lists the problems reported on GitHub.\nSearch the forum, or open a topic to read the replies.\nPress Sign in with GitHub, finish in your browser, then post a New topic or a reply.',
  'help.forum.tip':
    'Everything posted is public on GitHub under your GitHub name. On Q&A, mark the answer that worked so the next person finds it. Each board’s yellow count shows topics with activity you have not seen; Issues counts open issues. Half-written topics and replies are kept when you leave. Press a post’s picture to enlarge it inside FluidEQ.',
  'help.forum.keywords':
    'community, questions, support, discussions, github, feedback, feature request, ideas, suggestions, ask, help, contact, announcements',
  'help.forum.boardsName': 'Boards',
  'help.forum.boards':
    'Every board with its count. New for you gathers what came in since you last looked, and Issues lists the problems reported on GitHub.',
  'help.forum.textSize':
    'Makes the Forum’s text, and this guide’s, larger or smaller.',
  'help.forum.meName': 'Your GitHub account',
  'help.forum.me':
    'Who you post as. Sign out leaves the Forum readable and stops posting.',
  'help.forum.newTopic':
    'New topic starts a discussion; Mark all as read clears the counts, and the arrow fetches what is new.',
  'help.forum.search': 'Searches the topics and replies of every board.',
  'help.forum.topicsName': 'Topics',
  'help.forum.topics':
    'Latest activity first, each with its board, its state, its replies and its votes. Open one to read it and reply.',
  'help.games.profiles':
    'Open Gaming profiles to search by profile, game, curve or chain. The filters stay on one line and each kind of game has its own colour. Your saved profiles show their curve, Game filter levels and chain too. Use for a game starts a new copy.',
  'help.mic.title': 'Your microphone’s sound',
  'help.mic.intro':
    'The Mic tab gives each microphone a voice rack of its own. The FluidEQ Engine runs it on the microphone itself, so Discord, OBS, a game or a call hears your voice as you shaped it. It needs the FluidEQ Engine.',
  'help.mic.steps':
    'Open Mic in the header and choose your microphone at the top. If FluidEQ is not on it yet, press Set up on this mic; Windows asks for permission once.\nPick a Mic profile by use — Streaming, Podcast, Game chat, Meetings — by mic, for singing, or a voice effect. It sets every stage for a voice; a stage you change marks the profile tuned, and Reset brings it back.\nPress a stage in the rail to open it. Each has its own switch, a meter that moves with your voice and the delay it adds; a stage switched off is gone from the sound completely.\nSpeak and watch the picture: faint is what the mic picks up, bright is what others hear, and grey showing is what the filters took. Hear the final result plays it back to you; wear headphones, or it howls.\nMic’s own effects shows what the mic’s maker puts on your voice before FluidEQ. Switching them off stops the voice being cleaned twice; Windows asks for permission, and switched on again they come back exactly as they were.',
  'help.mic.tip':
    'A stage switched off leaves the voice untouched and adds no delay, so if Delay reads high, switch off what you do not need. Under Equalizer APO the Mic tab has nothing to run on.',
  'help.mic.keywords':
    'microphone, mic, voice, streaming, obs, discord, podcast, calls, meetings, noise cancelling, noise suppression, noise gate, gate, de-esser, compressor, limiter, reverb, voice effects, singing, usb mic, headset mic, own effects',
  'help.mic.own':
    'What the mic’s maker puts on your voice before FluidEQ. Its switch asks Windows for permission each way.',
  'help.mic.master': 'Turns the whole voice rack on or off for this mic.',
  'help.mic.stagesName': 'The stages',
  'help.mic.stages':
    'In the order your voice meets them, each with its switch, a meter that moves with your voice and the delay it adds. Press one to open it.',
  'help.mic.pick':
    'The microphone you are shaping; each one keeps its own sound. The line under it says whether the engine is working on it now.',
  'help.mic.pictureName': 'Your voice',
  'help.mic.picture':
    'Faint is what the mic picks up, bright is what others hear, and grey showing is what the filters took.',
  'help.mic.profile':
    'Ready-made voice sounds by use, by mic, for singing and as voice effects. A change marks the profile tuned; Reset brings it back.',
  'help.mic.delay':
    'How much the whole rack delays your voice, as the engine measures it.',
};

export default help;
