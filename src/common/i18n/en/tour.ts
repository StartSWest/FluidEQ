/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The feature tour: the panel that opens on a new version to show off the
 * big things, one slide each. Strings are per slide, prefixed by the slide.
 */
const tour = {
  'tour.eyebrow': 'NEW IN THIS VERSION',
  'tour.title': "What's new in FluidEQ",
  'tour.close': 'Close',
  'tour.rail': 'New features',
  'tour.stepOf': '{current} of {total}',
  'tour.back': 'Back',
  'tour.next': 'Next',
  'tour.done': 'Got it',
  'tour.dontShowAgain': "Don't show this again for this version",
  'tour.releaseNotes': 'Full release notes',
  'tour.rail.new': 'NEW IN THIS VERSION',
  'tour.rail.always': 'ALSO IN FLUIDEQ',
  'tour.newBadge': 'NEW',
  'tour.howTitle': 'How to start',

  'tour.theme.kicker': 'A NEW LOOK',
  'tour.theme.title': 'Meet the Black theme',
  'tour.theme.subtitle': 'Pure black, for late nights and OLED screens',
  'tour.theme.lead':
    'FluidEQ now has a second face. Black drops every trace of the slate-navy the app was born with: panels, menus and bars go monochrome, the accent stays, and the spectrum is the only colour in the room.',
  'tour.theme.point1':
    'True black backgrounds. On an OLED display the pixels around the graph switch off.',
  'tour.theme.point2':
    'Every window follows: menus, dialogs, the karaoke stage and the Library all change together.',
  'tour.theme.point3':
    'Your accent colour and rainbow mode carry over. Nothing about your sound changes. It is only the paint.',
  'tour.theme.howTitle': 'How to switch',
  'tour.theme.how':
    'Open the menu behind the pulse icon in the top-right corner, then pick Theme → Black. Ocean is one pick away if you want it back.',
  'tour.theme.tryBlack': 'Switch to Black now',
  'tour.theme.tryOcean': 'Back to Ocean',
  'tour.theme.imageAlt':
    'FluidEQ in the Black theme: the EQ tab with fifteen bands and the live spectrum playing a song.',

  'tour.share.kicker': 'LISTEN TO EVERY PC',
  'tour.share.title': 'Share audio between your computers',
  'tour.share.subtitle': 'One headset, every machine on your desk',
  'tour.share.lead':
    'Your gaming PC, your work laptop and the media box all play into the one headset you are wearing: over your own network, losslessly, encrypted, and through the EQ you already tuned.',
  'tour.share.receiverLabel': 'RECEIVER',
  'tour.share.receiverName': 'The PC with your headset',
  'tour.share.senderLabel': 'SENDERS',
  'tour.share.senderName': 'Every other computer',
  'tour.share.wireLabel': 'Lossless · Encrypted · Private LAN',
  'tour.share.stepsTitle': 'Set it up in three steps',
  'tour.share.step1Title': 'On the headset PC, create a code',
  'tour.share.step1':
    'Open the Share Audio tab, choose "Play audio on this computer" and press "Create connection code". Copy the code shown for your network.',
  'tour.share.step2Title': 'On every other PC, paste it',
  'tour.share.step2':
    'Open FluidEQ there, go to Share Audio, choose "Send audio from this computer", paste the code and press "Connect and send". Its system audio starts flowing.',
  'tour.share.step3Title': 'Pick a priority and listen',
  'tour.share.step3':
    'Music keeps a bigger safety buffer for uninterrupted listening; Game/Video runs with the lowest delay for lip-sync. Every sender is mixed into the receiver’s output and shaped by its EQ. The receiver’s playback bar shows each sender’s song and its buttons work across the wire.',
  'tour.share.fact1Title': 'Lossless',
  'tour.share.fact1':
    'Float32 PCM end to end. No media codec, no generation loss.',
  'tour.share.fact2Title': 'Encrypted',
  'tour.share.fact2':
    'AES-256-GCM on every packet. The code is the key; nobody without it can listen in.',
  'tour.share.fact3Title': 'Stays paired',
  'tour.share.fact3':
    'The pairing survives app closes and reboots. Only creating a new code disconnects it.',
  'tour.share.tip':
    'Start quietly: several computers add up fast. Lower the headset volume before the first connection.',
  'tour.share.open': 'Open Share Audio',

  'tour.library.kicker': 'YOUR MUSIC, YOUR PLAYER',
  'tour.library.title': 'A Library for the music you own',
  'tour.library.subtitle': 'Folders in, albums out',
  'tour.library.lead':
    'Point FluidEQ at a folder and it reads every song and video inside, tags and cover art included, and turns them into a collection you browse by album, artist, genre, song or folder. Playback runs through FluidEQ’s own player, so the EQ and the DSP rack are always in the path.',
  'tour.library.point1':
    'Three ways to look at the same shelf: list, grid and cover flow, with a jump-to-letter for big collections.',
  'tour.library.point2':
    'An Up Next queue with "Keep playing", which carries on with more of the same genre when the list runs out.',
  'tour.library.point3':
    'Playlists and a permanent Favourites list. Right-click any song to add it to either, or to the queue.',
  'tour.library.point4':
    'Smart EQ song memory: flip "Save for this song" while it plays and the correction you make is remembered for that track.',
  'tour.library.how':
    'Open the Library tab, press "Add folder" or drop a folder on the page, and wait for "Added songs". Pick Albums, Artists, Genres, Songs, Folders or Tree, then press Play.',
  'tour.library.open': 'Open Library',

  'tour.dsp.kicker': 'A MASTERING RACK',
  'tour.dsp.title': 'The DSP rack',
  'tour.dsp.subtitle': 'Nine stages, each with its own graph',
  'tour.dsp.lead':
    'Everything the Library plays can go through a rack of studio stages, in order: Normalizer, Denoise, Exciter, Bass Forge, Equaliser, Bass Punch, Dimension, Maximizer and Master, plus a crossfade between tracks. Each stage is a card with a live graph, presets, and an Isolate button to hear only what it is doing.',
  'tour.dsp.point1':
    'Denoise repairs the recording itself: hiss, hum, clicks and a neural voice cleaner, measured from a scan of the track.',
  'tour.dsp.point2':
    'Bass Forge adds a real octave below the bass; Bass Punch shapes its attack, sustain, bloom and duck.',
  'tour.dsp.point3':
    'A fifteen-band parametric Equaliser with minimum or linear phase, mid/side, oversampling and dozens of named presets.',
  'tour.dsp.point4':
    'Master with a LUFS loudness target and true-peak safety, delivery presets from Streaming to Vinyl, and a Gain match to compare sound, not volume.',
  'tour.dsp.how':
    'Play a track from the Library, open the DSP tab, pick a chain under Presets, then click a stage in the side tabs and switch it On.',
  'tour.dsp.open': 'Open DSP',

  'tour.output.kicker': 'PLAYS IN TWO PLACES',
  'tour.output.title': 'A second output',
  'tour.output.subtitle':
    'Headset and speakers at once, each with its own profile',
  'tour.output.lead':
    'What you hear can play out of a second device at the same time: the headset and the room speakers, the desk and the kitchen. Mirroring takes the sound after your EQ has shaped it and sends it on, so the second output hears the same tuning. With a routing driver installed, both outputs stay in sync and each can carry its own profile, the way a mixer like Voicemeeter would do it.',
  'tour.output.point1':
    'Pick any other output under "Mirror to" and it starts playing what you already hear, with its own volume.',
  'tour.output.point2':
    'Each output keeps its own EQ profile, so the speakers and the headset can be tuned separately.',
  'tour.output.point3':
    'One player at a time: starting something in FluidEQ pauses the rest of the machine, and the other way round.',
  'tour.output.point4':
    'Mirrored sound arrives about a fifth of a second late: fine for music in another room, not for video or games.',
  'tour.output.how':
    'On the EQ tab, open "Second output" in the right-hand panel, choose a device under "Mirror to" and set its volume. The card says MIRRORING while it runs.',
  'tour.output.open': 'Open EQ',

  'tour.looks.kicker': 'YOUR OWN VISUALIZER',
  'tour.looks.title': 'Custom looks for the graph',
  'tour.looks.subtitle': 'Fifty-seven forms, your colours, your motion',
  'tour.looks.lead':
    'The spectrum under the EQ can be drawn any way you like. Pick one of fifty-seven forms, from plain bars and lines to ridges, silk, skyline and dot matrix, then colour it flat, by frequency, by level or by heat, set how fast it attacks and how long a peak hangs, and mark the peaks with sparks, comets, halos or crowns. Save it as a look of your own, and share it as a file.',
  'tour.looks.point1':
    'Fifty-seven forms, each with its own controls: pieces, gap, fill, weight, and whether it is filled or stroked.',
  'tour.looks.point2':
    'Colour by frequency, level or heat with a ramp of your own colours, or one flat colour.',
  'tour.looks.point3':
    'Attack and release set the motion; lit peaks and eighteen peak marks set what a hit looks like.',
  'tour.looks.point4':
    'Rainbow mode adds a glow on the beat and a border that travels the whole colour wheel. Looks export to a file and import from one.',
  'tour.looks.how':
    'On the EQ tab, press "New look" in the graph\'s toolbar. Pick a form with the picker or press Space to cycle them, adjust the colours and motion while the music plays, then Save.',
  'tour.looks.open': 'Open EQ',

  'tour.karaoke.kicker': 'A STAGE AT HOME',
  'tour.karaoke.title': 'Karaoke with a pitch guide',
  'tour.karaoke.subtitle': 'Your songs, your lyrics, your microphone',
  'tour.karaoke.lead':
    'Drop in a song with or without a lyric file and FluidEQ pairs them into a playlist, shows the timed lyrics over the cover art or video, listens to your microphone and draws your pitch against the melody. Everything stays on this computer; the mic is never recorded or played back.',
  'tour.karaoke.point1':
    'A Guide vocal slider that sweeps from the original to backing only, removing the lead voice without a separate file.',
  'tour.karaoke.point2':
    'A pitch lane in Notes or Curve view: the song’s notes as blocks, your voice as a live line, with High, In tune and Low feedback.',
  'tour.karaoke.point3':
    'A performance review afterwards that lists the parts to practise, with a count-in for another run.',
  'tour.karaoke.point4':
    'Reads LRC, enhanced LRC with word timing and UltraStar with syllables and pitch, over MP3, FLAC, WAV, OGG, M4A and more. Translated lyrics and estimated guitar chords come along.',
  'tour.karaoke.how':
    'Open the Karaoke tab, press "Open song" or "Add folder", pick a track in the playlist, turn on the mic, show the pitch guide and press Play.',
  'tour.karaoke.open': 'Open Karaoke',

  'tour.maker.kicker': 'MAKE YOUR OWN',
  'tour.maker.title': 'The Karaoke Maker',
  'tour.maker.subtitle': 'Any song becomes a karaoke file',
  'tour.maker.lead':
    'A full authoring studio inside the Karaoke tab. It can do the whole job by itself: separate the voice from the music, read the words and their timing with a local speech model and detect the melody notes. Or you tap, record and draw every timing by hand on a zoomable timeline. Everything runs on this computer.',
  'tour.maker.point1':
    '"Set this song up automatically": separate the voice, then read the words and timing, with a continue-in-background option.',
  'tour.maker.point2':
    'Keep the separated tracks: the voice and the backing track, each savable, including as MP3.',
  'tour.maker.point3':
    'Hand tools for the details: tap words, record line entries, a word inspector with start and length, and split a word into syllables.',
  'tour.maker.point4':
    'Paint the melody on a pitch grid, mark golden notes, then export as a FluidEQ project, UltraStar TXT, LRC, enhanced LRC or a backing track.',
  'tour.maker.how':
    'In Karaoke, load a song and press "Make". Accept "Set up automatically" in the wizard, correct the words on the timeline, then "Use in player" and "Export".',
  'tour.maker.open': 'Open Karaoke',

  'tour.media.kicker': 'THE WEB, THROUGH YOUR EQ',
  'tour.media.title': 'Online Media',
  'tour.media.subtitle': 'YouTube, YouTube Music, Bandcamp, Twitch and Suno',
  'tour.media.lead':
    'A built-in player for the streaming sites, so what you watch and listen to online runs through your EQ instead of a separate browser. Five sites are wired in, each with its own search, and links that lead off-site are held back with an "Open in browser" choice.',
  'tour.media.point1':
    'One search field that searches whichever site is open, with recent searches you can clear.',
  'tour.media.point2':
    '"Block ads" skips video ads and hides ad slots on YouTube.',
  'tour.media.point3':
    'Resume: the player remembers the last page and where you were in it, and brings you back there.',
  'tour.media.point4':
    'Downloads with a progress pill and "Show in folder" when done, and a "Sign out of all sites" button that clears every cookie and login in one press.',
  'tour.media.how':
    'Open the Online Media tab, pick a site from the row at the top, type in the search field and press Search. Back, Forward and Reload work as in a browser.',
  'tour.media.open': 'Open Online Media',
} as const;

export default tour;
