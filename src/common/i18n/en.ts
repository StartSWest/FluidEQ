/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * The canonical dictionary. Every other locale is a partial of this one.
 *
 * English is the source of truth for two reasons: it is what the code is
 * written in, so a key with no translation yet falls back to something a
 * developer can read; and typing the other locales as `Partial<Dictionary>`
 * means adding a key here immediately tells every translator what is missing
 * without breaking the build.
 *
 * Keys are dotted and grouped by where the string appears, not by what it
 * says — `sidebar.output.title` is findable from the screen, `outputTitle` is
 * findable only from memory.
 *
 * Placeholders are `{name}` and are substituted positionally by name. Nothing
 * else is interpolated: no plural rules, no gender, no markup. Where a count
 * changes the wording, the two forms get separate keys.
 */
const en = {
  // *** Shell ***************************************************************
  'app.tagline': 'Your sound. Every device. Automatically.',
  'app.actions': 'FluidEQ actions',
  'app.actions.title': 'Audio actions',
  'app.status.ready': 'Connected to Equalizer APO',
  'app.status.checking': 'Checking Equalizer APO…',
  'app.status.error': 'Equalizer APO is not responding',
  'app.menu.importEq': 'Import EQ settings…',
  'app.menu.importConvolution': 'Import impulse response…',
  'app.menu.restartAudio': 'Restart Windows audio',
  'app.menu.reconfigure': 'Reconfigure Equalizer APO',
  'app.menu.apoSettings': 'Equalizer APO settings',
  'app.menu.support': 'Support the work',
  'app.menu.fix': 'Fix this',
  'app.menu.reportProblem': 'Report a problem',
  'app.menu.about': 'About {product}…',
  'app.menu.reinstallApp': 'Reinstall {product}…',
  'app.menu.fixAudio': 'Fix audio problems…',
  'app.menu.reinstallApo': 'Reinstall Equalizer APO…',
  'whatsNew.eyebrow': 'RELEASE NOTES',
  'whatsNew.title': "What's new in FluidEQ",
  'whatsNew.loading': 'Loading the release notes…',
  'whatsNew.missing':
    'The release notes could not be found in this build. They are also on GitHub.',
  'app.menu.whatsNew': "What's new",
  'app.menu.language': 'Language',
  'app.window.minimize': 'Minimize',
  'app.window.maximize': 'Maximize',
  'app.window.restore': 'Restore',
  'app.window.close': 'Close',
  'app.window.minimizeApp': 'Minimize FluidEQ',
  'app.window.maximizeApp': 'Maximize FluidEQ',
  'app.window.restoreApp': 'Restore FluidEQ',
  'app.window.closeApp': 'Close FluidEQ',
  // The titlebar's transport. The tooltips are the short form and the aria
  // labels carry the fact that makes these different from a player's own
  // buttons: they command whatever is playing on the machine, which is usually
  // not this application. Someone reading the screen has no other way to know
  // that, and someone who assumes these control the Video tab will press them
  // at the wrong moment.
  'app.media.previous': 'Previous track',
  'app.media.playPause': 'Play or pause',
  'app.media.next': 'Next track',
  'app.media.previousAria': 'Previous track, anywhere on this computer',
  'app.media.playPauseAria': 'Play or pause, anywhere on this computer',
  'app.media.nextAria': 'Next track, anywhere on this computer',
  'app.dismiss': 'Dismiss',
  'common.search': 'Search…',
  'common.recentSearches': 'Recent searches',
  'common.clearRecentSearches': 'Clear recent searches',
  'common.filterOptions': 'Filter options',
  'common.increase': 'Increase {item}',
  'common.decrease': 'Decrease {item}',
  'common.icon.edit': 'Edit',
  'common.icon.delete': 'Delete',
  'common.icon.trash': 'Remove',
  'common.icon.accept': 'Accept',
  'common.icon.cancel': 'Cancel',

  // *** Workspace tabs ******************************************************
  'tabs.aria': 'Sound workspace',
  // Just "EQ" since the reference picker moved out of it. It read "EQ &
  // headset mode" while the headset was chosen on that tab, and a label that
  // names something the tab no longer holds sends people to the wrong one.
  'tabs.eq': 'EQ',
  'tabs.autoeq': 'AutoEQ',
  'tabs.voicing': 'Voicing',
  'tabs.convolution': 'Convolution',
  'tabs.config': 'Config',
  'tabs.media': 'Media',
  'tabs.karaoke': 'Karaoke',

  // *** Karaoke ************************************************************
  'karaoke.eyebrow': 'LOCAL KARAOKE',
  'karaoke.title': 'A stage built around your music',
  'karaoke.intro':
    'This workspace will keep songs, timed lyrics, microphone monitoring and pitch feedback together — locally on your PC.',
  'karaoke.fullscreen.enter': 'Enter full screen',
  'karaoke.fullscreen.exit': 'Exit full screen',
  'karaoke.fullscreen.hideHeader': 'Hide the FluidEQ header',
  'karaoke.fullscreen.showHeader': 'Show the FluidEQ header',
  'karaoke.actions': 'Karaoke actions',
  'karaoke.readiness.resize': 'Resize microphone and pitch panels',
  'karaoke.empty.title': 'Your stage is ready',
  'karaoke.empty.body':
    'Open audio with optional lyrics, or add a whole folder. FluidEQ links same-name files into a playlist.',
  'karaoke.import.pending': 'Song import comes next',
  'karaoke.import.open': 'Open song',
  'karaoke.import.replace': 'Replace song',
  'karaoke.import.addFiles': 'Add files',
  'karaoke.import.folder': 'Add folder',
  'karaoke.import.clear': 'Clear',
  'karaoke.import.loading': 'Preparing your song…',
  'karaoke.import.formats':
    'Audio: MP3, WAV, OGG, FLAC or M4A · Lyrics: LRC, eLRC or UltraStar TXT',
  'karaoke.import.drop': 'Drop songs, lyrics, or folders here',
  'karaoke.error.missingAudio':
    'Add an audio file together with that lyric file.',
  'karaoke.error.ambiguous':
    'More than one song pairing is possible. Select one audio file and, optionally, one lyric file.',
  'karaoke.error.unsupported':
    'None of those files is a supported Karaoke audio or lyric file yet.',
  'karaoke.error.read': 'FluidEQ could not read the selected local files.',
  'karaoke.error.playback':
    'This Chromium build could not play that audio file or codec.',
  'karaoke.warning.lyrics':
    'could not be parsed, so the audio remains available without timed lyrics.',
  'karaoke.song.unknownArtist': 'Local song',
  'karaoke.playlist.title': 'Playlist',
  'karaoke.playlist.groupFolders': 'Group by folder',
  'karaoke.playlist.looseFiles': 'Loose files',
  'karaoke.playlist.resize': 'Resize playlist and stage',
  'karaoke.playlist.collapse': 'Collapse playlist',
  'karaoke.playlist.expand': 'Expand playlist',
  'karaoke.playlist.select': 'Select {title}',
  'karaoke.playlist.moveUp': 'Move {title} up',
  'karaoke.playlist.moveDown': 'Move {title} down',
  'karaoke.playlist.remove': 'Remove {title}',
  'karaoke.source.audioOnly': 'Audio only',
  'karaoke.source.lrc': 'LRC · line timing',
  'karaoke.source.elrc': 'eLRC · word timing',
  'karaoke.source.ultrastar': 'UltraStar · syllables + pitch',
  'karaoke.lyrics.none':
    'No timed lyrics were selected. Playback and the live tuner still work.',
  'karaoke.lyrics.line': 'Lyric line {number}',
  'karaoke.lyrics.previous': 'Previous lyric',
  'karaoke.lyrics.next': 'Next lyric',
  'karaoke.lyrics.follow': 'Follow lyrics',
  'karaoke.lyrics.textSize': 'Lyric text size',
  'karaoke.transport.title': 'Karaoke playback controls',
  'karaoke.transport.restart': 'Restart song',
  'karaoke.transport.play': 'Play',
  'karaoke.transport.pause': 'Pause',
  'karaoke.transport.seek': 'Song position',
  'karaoke.transport.volume': 'Volume',
  'karaoke.mic.title': 'Microphone',
  'karaoke.mic.settings': 'Microphone settings',
  'karaoke.mic.off': 'Off',
  'karaoke.mic.hint':
    'Choose an input. FluidEQ asks for microphone access only when you turn it on.',
  'karaoke.mic.select': 'Microphone input',
  'karaoke.mic.default': 'System default',
  'karaoke.mic.unnamed': 'Microphone {number}',
  'karaoke.mic.turnOn': 'Turn on mic',
  'karaoke.mic.turnOff': 'Turn off mic',
  'karaoke.mic.requesting': 'Connecting…',
  'karaoke.mic.live': 'Live',
  'karaoke.mic.denied': 'Permission denied',
  'karaoke.mic.unavailable': 'No microphone',
  'karaoke.mic.disconnected': 'Disconnected',
  'karaoke.mic.error': 'Could not start',
  'karaoke.mic.level': 'Microphone input level',
  'karaoke.mic.levelValue': 'Microphone input level: {percent}%',
  'karaoke.mic.privacy':
    'Local level and pitch analysis only. FluidEQ does not record or play the mic through your speakers.',
  'karaoke.mic.volume': 'Mic volume',
  'karaoke.mic.volumeValue': 'Mic volume: {percent}%',
  'karaoke.pitch.title': 'Pitch lane',
  'karaoke.pitch.resize': 'Resize pitch lane',
  'karaoke.pitch.guide': 'Melody guide',
  'karaoke.pitch.toneGuide': 'Melody tone',
  'karaoke.pitch.toneEnable': 'Play melody guide tone',
  'karaoke.pitch.toneDisable': 'Stop melody guide tone',
  'karaoke.pitch.toneVolume': 'Melody tone volume',
  'karaoke.pitch.scrubHint':
    'Drag left or right to move through the song; release to stay paused.',
  'karaoke.pitch.viewSelector': 'Pitch display',
  'karaoke.pitch.viewNotes': 'Notes',
  'karaoke.pitch.viewWave': 'Curve',
  'karaoke.pitch.waveCanvas':
    'Real-time singer pitch curve over the song notes',
  'karaoke.pitch.waveSong': 'Song pitch',
  'karaoke.pitch.waveVoice': 'Your voice',
  'karaoke.pitch.waveFooter':
    'Blue blocks are the song notes; the thin live curve is the pitch coming from your microphone.',
  'karaoke.pitch.review': 'Performance review',
  'karaoke.pitch.reviewCount': '{count} parts to practice',
  'karaoke.pitch.issueHigh': 'High pitch at {time}. Practice this part.',
  'karaoke.pitch.issueLow': 'Low pitch at {time}. Practice this part.',
  'karaoke.pitch.issueMissed': 'Missed notes at {time}. Practice this part.',
  'karaoke.practice.go': 'GO',
  'karaoke.practice.ready': 'Get ready to sing again',
  'karaoke.countIn.ready': 'Get ready — the song starts after GO',
  'karaoke.pitch.canvas': 'Live microphone pitch and target-note lane',
  'karaoke.pitch.micOff': 'Turn on the microphone to see your pitch.',
  'karaoke.pitch.loading': 'Starting pitch analysis…',
  'karaoke.pitch.unavailable':
    'Pitch analysis is unavailable. The microphone level still works.',
  'karaoke.pitch.noSignal': 'Sing into the microphone to trace your pitch.',
  'karaoke.pitch.empty':
    'Target notes will appear only when an imported song actually provides them.',
  'karaoke.pitch.high': 'High',
  'karaoke.pitch.tuned': 'In tune',
  'karaoke.pitch.low': 'Low',
  'karaoke.pitch.ultrastar':
    'Blue bars are target notes; the trace shows whether your voice is high, in tune, or low.',
  'karaoke.chords.aria': 'Estimated guitar chords from the backing track',
  'karaoke.chords.analyzing': 'Finding chords… {percent}%',
  'karaoke.chords.estimate': 'Estimated chord',
  'karaoke.chords.next': 'Next',
  'karaoke.chords.in': 'in {seconds}s',
  'karaoke.chords.none': 'No stable chord found',
  'karaoke.chords.confidence': 'Audio estimate confidence: {percent}%',
  'karaoke.maker.open': 'Make',
  'karaoke.maker.openTitle': 'Create or edit this karaoke',
  'karaoke.maker.dialog': 'Karaoke Maker',
  'karaoke.maker.eyebrow': 'FLUIDEQ KARAOKE MAKER',
  'karaoke.maker.close': 'Close maker',
  'karaoke.maker.songTitle': 'Song title',
  'karaoke.maker.untitled': 'Untitled karaoke',
  'karaoke.maker.undo': 'Undo',
  'karaoke.maker.redo': 'Redo',
  'karaoke.maker.preview': 'Preview · 1, 2, 3',
  'karaoke.maker.apply': 'Use in player',
  'karaoke.maker.applyHint':
    'Use these edits in the player. Your original karaoke file is unchanged; Export creates a new file.',
  'karaoke.maker.lyrics': 'Lyrics',
  'karaoke.maker.toolsEdit': 'Editing tools',
  'karaoke.maker.toolsAnalysis': 'Analysis tools',
  'karaoke.maker.lyricsTiming': 'Lyrics timing',
  'karaoke.maker.timingAll': 'Whole song',
  'karaoke.maker.timingFromWord': 'From selected word',
  'karaoke.maker.timingAllHint':
    'Moves every timed word and melody note together.',
  'karaoke.maker.timingFromWordHint':
    'Moves “{word}” and everything after it. Earlier timing stays locked.',
  'karaoke.maker.earlier': 'Move all lyrics earlier',
  'karaoke.maker.later': 'Move all lyrics later',
  'karaoke.maker.openProject': 'Import karaoke',
  'karaoke.maker.projectLoaded':
    'Project loaded. The current audio remains attached.',
  'karaoke.maker.karaokeImported':
    'Karaoke timing imported. The current audio remains attached.',
  'karaoke.maker.tapWords': 'Tap words',
  'karaoke.maker.panView': 'Hand · pan timeline',
  'karaoke.maker.panHint':
    'Hand tool: drag anywhere on the canvas to move through the song without editing.',
  'karaoke.maker.addNote': 'Note',
  'karaoke.maker.hearNote': 'Hear note',
  'karaoke.maker.split': 'Split',
  'karaoke.maker.delete': 'Delete',
  'karaoke.maker.analyze': 'Analyze melody',
  'karaoke.maker.prepare': 'Prepare karaoke',
  'karaoke.maker.advanced': 'Advanced',
  'karaoke.maker.prepared': 'This karaoke already has timed melody notes.',
  'karaoke.maker.autoAlign': 'Auto align',
  'karaoke.maker.aiMelody': 'AI melody',
  'karaoke.maker.transcribe': 'Transcribe',
  'karaoke.maker.vocalStem': 'Use vocal stem',
  'karaoke.maker.vocalStemLoaded': 'Vocal stem loaded',
  'karaoke.maker.vocalFocus': 'Center vocal focus',
  'karaoke.maker.export': 'Export',
  'karaoke.maker.exportProject': 'FluidEQ project',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': 'Enhanced LRC',
  'karaoke.maker.tapHint': 'Tap SPACE or ENTER for “{word}” · Backspace undoes',
  'karaoke.maker.editHint':
    'Drag notes to change pitch/time. Drag either edge to resize. Ctrl + wheel zooms.',
  'karaoke.maker.stats': '{notes} notes · {words} words · {checks} checks',
  'karaoke.maker.wordStateLegend': 'Lyric timing work status',
  'karaoke.maker.userAdjustedWords': '{count} adjusted',
  'karaoke.maker.pendingWords': '{count} pending',
  'karaoke.maker.artist': 'Artist',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': 'Zoom',
  'karaoke.maker.songPosition': 'Song position',
  'karaoke.maker.previousView': 'Previous section',
  'karaoke.maker.nextView': 'Next section',
  'karaoke.maker.resetZoom': 'Double-click to fit timed lyrics',
  'karaoke.maker.livePreview': 'Live preview',
  'karaoke.maker.showPreview': 'Show preview',
  'karaoke.maker.hidePreview': 'Hide preview',
  'karaoke.maker.previewEmpty':
    'Add or align timed lyrics to see the live preview.',
  'karaoke.maker.noteNormal': 'Note',
  'karaoke.maker.noteGolden': 'Golden',
  'karaoke.maker.noteFree': 'Free',
  'karaoke.maker.untimed': 'Untimed',
  'karaoke.maker.selectHint': 'Select a lyric or melody note to inspect it.',
  'karaoke.maker.rights':
    'I have permission to use and export this audio and these lyrics.',
  'karaoke.maker.cancel': 'Cancel',
  'karaoke.maker.localAnalysis': 'Local analysis',
  'karaoke.maker.lyricsEyebrow': 'LYRICS',
  'karaoke.maker.lyricsTitle': 'Paste or edit one lyric line per row',
  'karaoke.maker.lyricsWarning':
    'Replacing the text clears word links so the new words can be tapped or aligned safely.',
  'karaoke.maker.replaceLyrics': 'Replace lyrics',
  'karaoke.maker.lyricsAutoAligned':
    'New lyrics applied and aligned to the available melody.',
  'karaoke.maker.transcriptionEyebrow': 'OPTIONAL LOCAL TRANSCRIPTION',
  'karaoke.maker.transcriptionTitle': 'Download Whisper Tiny?',
  'karaoke.maker.transcriptionBody':
    'FluidEQ will download the Apache-2.0 {model} model from Hugging Face and cache it on this PC. Your audio remains in FluidEQ and is processed locally. The first run can take time and use significant memory.',
  'karaoke.maker.transcriptionReview':
    'Recognition is only a starting point. FluidEQ keeps your original lyric spelling when matching existing text, and all timestamps remain editable.',
  'karaoke.maker.notNow': 'Not now',
  'karaoke.maker.downloadTranscribe': 'Download and transcribe',
  'karaoke.maker.downloadingWhisper': 'Downloading Whisper model',
  'karaoke.maker.loadingWhisper': 'Loading Whisper model',
  'karaoke.maker.analysisRunning': 'Analyzing pitch locally',
  'karaoke.maker.analysisAligned':
    'Aligned untouched words from {count} detected note regions. Manual timing was preserved.',
  'karaoke.maker.analysisFound': 'Analysis found {count} note regions.',
  'karaoke.maker.basicPitchRunning': 'Running bundled Basic Pitch model',
  'karaoke.maker.basicPitchFound':
    'Basic Pitch found {count} editable melody notes. A vocal stem gives the cleanest result.',
  'karaoke.maker.whisperPreparing': 'Preparing Whisper',
  'karaoke.maker.whisperDecoding': 'Decoding audio locally',
  'karaoke.maker.whisperTranscribing': 'Transcribing locally',
  'karaoke.maker.whisperComplete': 'Transcription complete',
  'karaoke.maker.whisperMatched':
    'Whisper matched {count} recognized words. Review their editable timing before export.',
  'karaoke.maker.autoAlignComplete':
    'Untouched lyrics aligned to the detected melody. Manual timing was preserved.',
  'karaoke.maker.exported': 'Exported {file}',
  'karaoke.maker.exportFallback': 'karaoke file',
  'karaoke.maker.projectTooLarge': 'The project is larger than 16 MB.',
  'karaoke.maker.previewResize': 'Resize live preview',
  'karaoke.maker.seekBack': 'Go back {seconds} seconds',
  'karaoke.maker.seekForward': 'Go forward {seconds} seconds',
  'karaoke.maker.errorAudioLimits':
    'Local analysis supports audio files up to 1 GB and recordings under 30 minutes.',
  'karaoke.maker.errorComponentUnavailable':
    'A required local analysis component is unavailable. Restart FluidEQ and try again.',
  'karaoke.maker.errorAnalysis':
    'FluidEQ could not analyze this audio locally.',
  'karaoke.maker.errorExportNeedsNotes':
    'UltraStar export needs at least one melody note.',
  'karaoke.maker.errorExport': 'FluidEQ could not export this karaoke.',
  'karaoke.maker.errorProjectVersion':
    'This Karaoke Maker project was created by an unsupported version of FluidEQ.',
  'karaoke.maker.errorImport':
    'FluidEQ could not import this karaoke or project file.',
  'karaoke.maker.errorParse':
    'The selected lyric or karaoke file could not be parsed.',
  'karaoke.maker.downloadFailed': 'Whisper model download failed',
  'karaoke.maker.localAnalysisFailed': 'Local analysis failed',
  'karaoke.maker.whisperDownloadError':
    'FluidEQ could not download the model from Hugging Face. Check your internet connection or firewall, then try again.',
  'karaoke.maker.tryAgain': 'Try again',
  'karaoke.maker.dismiss': 'Dismiss error',
  'karaoke.maker.analysisSource':
    'Using “{file}” only as the local analysis source.',
  'karaoke.maker.rightsRequired':
    'Confirm that you have the rights to the audio and lyrics before publishing an export.',
  'karaoke.maker.draftRestored': 'Draft restored',

  // *** Response graph ******************************************************
  'graph.resize': 'Drag to resize the graph',
  'graph.view.title': 'How much of the screen the graph gets',
  'graph.view.normal': 'View',
  'graph.view.expanded': 'Expanded',
  'graph.view.fullscreen': 'Full screen',
  'graph.view.expand': 'Expand view',
  'graph.showing': 'Showing: {content}',
  'graph.contents.everything': 'Everything',
  'graph.contents.layers': 'Layers over wave',
  'graph.contents.curves': 'Curves only',
  'graph.contents.clean': 'Clean',
  'graph.contents.wave': 'Wave only',
  'graph.show': 'Show {item}',
  'graph.hide': 'Hide {item}',
  'graph.item.wave': 'the wave',
  'graph.item.topWave': 'top wave',
  'graph.item.grid': 'grid',
  'graph.item.bands': 'listening bands',
  'graph.item.meter': 'level meter',
  'graph.item.topBar': 'the top bar',
  'graph.fit': 'Fit the graph',
  'graph.stretch': 'Stretch to fill',
  'graph.orientation.down': 'Hang the wave down',
  'graph.orientation.mirror': 'Mirror the wave',
  'graph.orientation.centre': 'Mirror from the centre',
  'graph.orientation.up': 'Stand the wave up',
  'graph.style.next': 'Next style',
  'graph.style.previous': 'Previous style',
  'graph.style.search': 'Search styles',
  'graph.seeThrough': 'See through',
  'graph.seeThroughHint': 'How much of the page shows through the graph',
  'graph.blur': 'Blur',
  'graph.blurHint':
    'Blur what shows through, so it reads as light rather than as a second picture',
  'graph.curves': 'Curves',
  'graph.curvesHint': 'Which curves are drawn',
  'graph.liveOutput': 'Live output',
  'graph.clip': 'CLIPPING — reduce preamp',
  'graph.driverCurve': 'Frequency response of this driver correction',
  'graph.curve.convolution': 'Headset convolution',
  'graph.curve.driver': 'Driver',
  'graph.curve.headphone': 'Headphone',
  'graph.curve.eq': 'EQ response',
  'graph.curve.voicing': 'Voicing',
  'graph.curve.smart': 'Smart EQ',
  'graph.curve.custom': 'Custom FX',
  'graph.curve.total': 'Final output',
  'graph.design.showWave':
    'Show the wave first — there is nothing to design against',
  'graph.design.closeHint': 'Close the look designer (Esc)',
  'graph.design.createHint': 'Build a look of your own from this one',
  'graph.design.close': 'Close',
  'graph.design.edit': 'Edit look',
  'graph.design.new': 'New look',
  'graph.styleName.line': 'Line',
  'graph.styleName.area': 'Area',
  'graph.styleName.bars': 'Bars',
  'graph.styleName.dots': 'Dots',
  'graph.styleName.steps': 'Staircase',
  'graph.styleName.blocks': 'LED blocks',
  'graph.styleName.spikes': 'Spikes',
  'graph.styleName.ridge': 'Ridge',
  'graph.styleName.stems': 'Stems',
  'graph.styleName.terrace': 'Terrace',
  'graph.styleName.dashes': 'Dashes',
  'graph.styleName.scatter': 'Scatter',
  'graph.styleName.caps': 'Floating caps',
  'graph.styleName.ribs': 'Ribs',
  'graph.styleName.pillars': 'Pillars',
  'graph.styleName.crown': 'Crown',
  'graph.styleName.weave': 'Weave',
  'graph.styleName.contour': 'Topography',
  'graph.styleName.hatch': 'Hatching',
  'graph.styleName.matrix': 'Dot matrix',
  'graph.styleName.skyline': 'Skyline',
  'graph.styleName.bezier': 'Silk',
  'graph.styleName.ribbon': 'Ribbon',
  'graph.styleName.feather': 'Feather',
  'graph.styleName.truss': 'Truss',
  'graph.styleName.zipper': 'Zipper',
  'graph.styleName.slope': 'Slope field',
  'graph.styleName.stalactites': 'Stalactites',
  'graph.styleName.bubbles': 'Bubbles',
  'graph.styleName.diamonds': 'Diamonds',
  'graph.styleName.sawtooth': 'Sawtooth',
  'graph.styleName.ecg': 'Pulse',
  'graph.styleName.echo': 'Echo',
  'graph.styleName.racer': 'Road trip',
  'graph.styleName.invaders': 'Invaders',
  'graph.styleName.starfield': 'Warp speed',
  'graph.styleName.candles': 'Candles',
  'graph.styleName.arches': 'Arches',
  'graph.styleName.flames': 'Flames',
  'graph.styleName.barcode': 'Barcode',
  'graph.styleName.rain': 'Rainfall',
  'graph.styleName.honeycomb': 'Honeycomb',
  'graph.styleName.fence': 'Fence',
  'graph.styleName.braid': 'Braid',
  'graph.styleName.stitch': 'Cross-stitch',
  'graph.styleName.canyon': 'Canyon',
  'look.edit': 'Edit look',
  'look.create': 'Create look',
  'look.new': 'New look',
  'look.close': 'Close the look designer',
  'look.closeHint': 'Close without saving (Esc)',
  'look.pickForm': 'Pick the form with the picker above, or press Space.',
  'look.colourBy': 'Colour by',
  'look.palette.flat': 'Flat',
  'look.palette.flatHint': 'One colour for the whole figure',
  'look.palette.frequency': 'Frequency',
  'look.palette.frequencyHint':
    'Colour runs across the axis and shows where a bar sits in the range.',
  'look.palette.level': 'Level',
  'look.palette.levelHint':
    'Colour runs up the axis and shows how loud a bar is.',
  'look.colours': 'Colours',
  'look.colourValue': 'Colour {number}: {colour}',
  'look.removeColour': 'Remove colour {number}',
  'look.custom': 'Custom',
  'look.customColour': 'Any other colour',
  'look.reset': 'Reset',
  'look.addColour': 'Add a colour',
  'look.addColourHint': 'Add a colour to the end of the ramp',
  'look.pieces': 'Pieces',
  'look.continuous': 'This form is drawn as one continuous figure',
  'look.attack': 'Attack',
  'look.release': 'Release',
  'look.releaseHint': 'How long a peak hangs before it falls away',
  'look.drawnAs': 'Drawn as',
  'look.filled': 'Filled',
  'look.stroked': 'Stroked',
  'look.fill': 'Fill',
  'look.weight': 'Weight',
  'look.rainbow': 'Rainbow',
  'look.glow': 'Glow',
  'look.off': 'Off',
  'look.glowHint': 'How hard the figure swells and brightens on a beat.',
  'look.glowNeedsRainbow':
    'Needs Rainbow mode. With it off, glow does not change the drawing.',
  'look.needsRainbow': 'Needs Rainbow mode.',
  'look.rainbowBorder': 'Rainbow border',
  'look.rainbowBorderHint':
    'Rings the graph in a colour that travels around the whole wheel.',
  'look.borderWeight': 'Border weight',
  'look.litPeaks': 'Lit peaks',
  'look.noLitPeaks': 'This form has no lit tips to show',
  'look.name': 'Name',
  'look.resetAll': 'Reset every setting',
  'look.resetAllHint': 'Put every setting back to how this form ships',
  'look.export': 'Export this look to a file',
  'look.exportHint': 'Write this look to a file you can share',
  'look.import': 'Import a look from a file',
  'look.delete': 'Delete this look',
  'look.save': 'Save',
  'look.saveHint': 'Save this look and select it',
  'look.full': 'The list is full — delete a look to make room',
  'look.error.emptyFile': 'No looks were found in that file.',
  'look.error.readFile': 'FluidEQ could not read that look file.',
  // The level meter down the right-hand edge of the plot. "Below full scale"
  // is the part that has to survive translation: the trace beside it is drawn
  // against the record's own peak and this is not, and somebody who cannot see
  // the colours has only this sentence to tell the two apart.
  'graph.meter.aria': 'Live output level, in real decibels below full scale',
  // One letter each, over the bar it names. Kept as keys because L and R are
  // not universal — Russian audio gear says Л and П, Chinese 左 and 右 — and a
  // dictionary is the only place a translator can say so.
  'graph.meter.left': 'L',
  'graph.meter.right': 'R',
  // Only when Windows hands over a genuinely mono endpoint, in which case one
  // bar is drawn and labelled honestly rather than two showing the same number.
  'graph.meter.mono': 'M',

  // *** Built-in player *****************************************************
  'video.sites': 'Video sites',
  'video.back': 'Back',
  'video.forward': 'Forward',
  'video.reload': 'Reload',
  'video.stop': 'Stop',
  'video.searchAria': 'Search the current site',
  'video.searchOn': 'Search {site}',
  'video.searchGo': 'Search',
  'video.searchClear': 'Clear the search',
  'video.searchRecent': 'Recent searches',
  'video.searchForget': 'Forget “{term}”',
  'video.searchForgetAll': 'Clear recent searches',
  'video.adBlock': 'Block ads',
  'video.adBlockHint': 'Skips video ads and hides ad slots on YouTube.',
  'video.signOut': 'Sign out of all sites',
  'video.signOutBusy': 'Signing out…',
  'video.signOutHint':
    'Clears every cookie, login and cached page the player is holding.',
  'video.signOutDone': 'Signed out',
  'video.signOutFailed': 'Could not sign out',
  'video.blockedTitle': 'That link leads outside the player',
  'video.openInBrowser': 'Open in browser',
  'video.resize': 'Drag to resize the player',

  // *** Notices *************************************************************
  'notice.apoReconfigured':
    'Equalizer APO was installed or reconfigured. If audio is missing, reload Windows Audio instead of rebooting the PC.',
  'notice.restartNow': 'Restart audio now',
  'notice.importComplete': 'Import complete',
  'notice.restartConfirm':
    'Audio will stop for a few seconds and Windows will request administrator permission. Continue?',
  'update.title': 'FluidEQ update',
  'update.available': 'Version {version} is available. Downloading it now.',
  'update.downloading': 'Downloading the update… {percent}%',
  'update.ready': 'Version {version} is ready. Restart FluidEQ to finish.',
  'update.restart': 'Restart now',
  'update.restarting': 'Restarting…',
  // The release that says it has to be taken. Translated, unlike the About
  // panel and the first-run notice: those are legal statements, where a
  // mistranslation is worse than English. This is an instruction about what is
  // happening to somebody's computer, and English is worse than a translation.
  'update.mandatory.title': 'This version has to be updated',
  'update.mandatory.body':
    'This release fixes a problem serious enough that FluidEQ should not keep running as it is. The update is being fetched now.',
  // The line that stops a closable dialog reading like an ordinary update
  // banner. It says what closing it means, which is "later" and not "no".
  'update.mandatory.notOptional':
    'This is not an optional update. You can close this notice and finish what you are doing — it will come back until FluidEQ has been updated.',
  'update.mandatory.later': 'Not now',
  'update.mandatory.waiting': 'Fetching the update…',
  'update.mandatory.readyPrompt':
    'The update has been downloaded. FluidEQ will close while it installs, and open again afterwards.',
  'update.mandatory.install': 'Install and restart',
  'update.mandatory.installing': 'Installing…',
  'update.mandatory.failedDownload':
    'The update could not be downloaded. Either the download server could not be reached, or the connection stopped part of the way through.',
  'update.mandatory.failedInstall':
    'The update was downloaded, but the installer did not start. Windows may have refused it, or the downloaded file may be damaged.',
  'update.mandatory.manual':
    'You can install it yourself instead: download the latest version from the release page and run it. Your settings and profiles are kept.',
  'update.mandatory.releasePage': 'Open the download page',
  'notice.restartDone':
    'Windows Audio restarted. Reopen any application that is still silent.',

  // *** Sidebar *************************************************************
  'sidebar.engine': 'ENGINE',
  'sidebar.systemEq': 'System EQ',
  'sidebar.preamp': 'Preamp',
  'sidebar.preampAria': 'Pre-Amplification Gain (dB)',
  'sidebar.preampAuto': 'Set for you. Turn off Auto normalize to adjust it.',
  'sidebar.headroom': 'APO HEADROOM',
  'sidebar.autoPreamp': 'Auto normalize',
  'sidebar.visualizer': 'VISUALIZER',
  'sidebar.graphView': 'Response graph',

  // *** Output section ******************************************************
  'output.eyebrow': 'FOLLOWS YOUR OUTPUT',
  'output.title': 'Automatic profile',
  'output.device': 'Output device',
  'output.active': 'ACTIVE',
  'output.none': 'No active outputs found',
  'output.mapping': 'Automatic mapping',
  'output.mapping.neutral': 'Neutral output',
  'output.mapping.live': 'Live tuning attached',
  'output.mapping.hint':
    'Edit any EQ control to save and attach it automatically to this output.',
  'output.hint':
    'FluidEQ maps the stable endpoint ID, so this sound follows the device whenever Windows selects it.',

  // *** Extra outputs section ***********************************************
  'extraOutput.eyebrow': 'PLAYS IN TWO PLACES',
  'extraOutput.title': 'Second output',
  'extraOutput.target': 'Mirror to',
  'extraOutput.off': 'Off',
  'extraOutput.none': 'No other outputs found',
  'extraOutput.active': 'MIRRORING',
  'extraOutput.volume': 'Volume',
  'extraOutput.latency':
    'Mirrored sound arrives about a fifth of a second late. Fine for music in another room, unusable for video or games, and an echo if you can hear both at once.',
  'extraOutput.virtual':
    'A routing driver is installed. Point your applications at it and both outputs stay in sync, then give each one its own profile above.',
  'extraOutput.ambiguous':
    'Two outputs share this name, so FluidEQ cannot tell which one you mean. Rename one in Windows sound settings.',
  'extraOutput.unmatched':
    'Windows lists this output but FluidEQ cannot reach it, so it cannot be mirrored to.',
  'extraOutput.labelsHidden':
    'FluidEQ cannot read the output names yet, so it cannot match them. Allow microphone access for FluidEQ and reopen this panel.',
  'extraOutput.hint':
    'Mirroring plays what you already hear out of a second device. It runs only while FluidEQ is open.',

  // *** Driver section ******************************************************
  'driver.eyebrow': 'WHAT YOU LISTEN ON',
  'driver.title': 'Driver type',
  'driver.none': 'No compensation',
  'driver.none.hint': 'Your bands and voicing only',
  'driver.strength': 'Strength',
  'driver.range': '±1.5 dB',

  // *** Profiles section ****************************************************
  'profiles.eyebrow': 'YOUR SOUND',
  'profiles.title': 'Named profiles',
  'profiles.name': 'Profile name',
  'profiles.nameAria': 'Preset Name',
  'profiles.new': 'New profile',
  'profiles.newAria': 'Start a new profile from the current EQ',
  'profiles.untitled': 'Untitled profile',
  'profiles.save': 'Save as new',
  'profiles.update': 'Update',
  'profiles.saveAria': 'Save settings to preset',
  'profiles.restore': 'Restore',
  'profiles.restoring': 'Restoring…',
  'profiles.restoreAria':
    'Restore the last manually saved version of this profile',
  'profiles.attached': 'ON',
  'profiles.attachedTitle': 'Playing on this output',
  'profiles.detecting': 'Detecting your output…',
  'profiles.empty': 'No profiles yet. Create your first sound.',
  'profiles.error.empty': 'Preset name cannot be empty.',
  'profiles.error.restricted': 'Invalid preset name, please use another.',
  'profiles.error.duplicate': 'Duplicate name found, please use another.',
  'profiles.edit': 'Edit Preset Name',

  // *** AutoEQ library *****************************************************
  // The tab's own heading. The section inside it keeps `autoeq.eyebrow` and
  // `autoeq.title`, which name the library; these name the page.
  'autoeq.page.eyebrow': 'MATCH YOUR HEADPHONES',
  'autoeq.page.title': 'Headphone correction',
  'autoeq.page.intro':
    'Say which headphones you are listening on and FluidEQ applies the correction published for them. It goes in as a layer of its own, with its own strength and its own switch, so your EQ bands are never touched. Every measurement here was taken on a real rig and published — none of it is guessed from the model name.',
  'autoeq.source.hint':
    'The bundled correction library is the official AutoEq results database.',
  'autoeq.model.hint':
    'Search by brand or model. If yours is not measured, a close relation from the same range usually gets you most of the way.',
  'autoeq.target.hint':
    'Most models are measured more than once — different rigs, different target curves — and they do not sound alike. It is worth trying more than one.',
  'autoeq.eyebrow': 'START FROM A REFERENCE',
  'autoeq.title': 'AutoEQ library',
  'autoeq.selectSource': 'Select a source',
  'autoeq.applied': 'Applied: {name}',
  'autoeq.notApplied': 'No reference applied',
  'autoeq.source': 'Measurement source',
  'autoeq.model': 'Headphone model',
  'autoeq.target': 'Measurement / target',
  'autoeq.apply': 'Apply headset EQ',
  'autoeq.applying': 'Applying…',
  'autoeq.applyAria': 'Apply selected headset EQ',
  'autoeq.checking': 'Checking official database…',
  'autoeq.updateAvailable': 'Update available ({count} models)',
  'autoeq.upToDate': 'Official database up to date — {count} models',
  'autoeq.updateUnknown': 'Update check unavailable',
  'autoeq.update': 'Update database',
  'autoeq.updating': 'Updating…',
  'autoeq.updateAria': 'Update AutoEq database',
  'autoeq.allDatabases': 'All databases',
  'autoeq.allDatabases.hint': 'Search the official AutoEq database.',
  'autoeq.pickDevice': 'Pick a device first! 🎧',
  'autoeq.noResponses': 'No supported responses 😞',
  'autoeq.pickResponse': 'Pick a response! 🔊',
  'autoeq.selectSourcePlaceholder': 'Select a source…',
  'autoeq.searchSources': 'Search sources…',
  'autoeq.noModel': 'No measured model matches your search.',
  'autoeq.searchModels': 'Search by brand or model…',

  // *** Squiglink import ***************************************************
  'squigImport.eyebrow': 'BRING YOUR CURVE WITH YOU',
  'squigImport.title': 'Import a Squiglink EQ',
  'squigImport.intro':
    'Use Squiglink’s calculator for the headphone and target you want, then bring its exported EQ here. FluidEQ keeps the imported curve visible and ready to edit.',
  'squigImport.open': 'Open Squiglink',
  'squigImport.stepOne': 'Choose a headset and target',
  'squigImport.stepTwo': 'Export the EQ text',
  'squigImport.stepThree': 'Paste it here and apply',
  'squigImport.pasteLabel': 'EQ export',
  'squigImport.placeholder':
    'Paste the ParametricEQ or GraphicEQ text from Squiglink here…',
  'squigImport.fileAria': 'Choose an EQ export text file',
  'squigImport.chooseFile': 'Choose a .txt file',
  'squigImport.applyAria': 'Apply this imported EQ',
  'squigImport.importing': 'Applying…',
  'squigImport.apply': 'Apply imported EQ',
  'squigImport.applied': 'Applied curve',
  'squigImport.livePreview': 'Live preview',
  'squigImport.notApplied': 'Not applied',
  'squigImport.currentText': 'Current EQ text',
  'squigImport.flatPreview': 'Flat preview',
  'squigImport.flatCurve': 'No curve applied · 0 dB',
  'squigImport.bands': 'bands',
  'squigImport.clear': 'Remove import',
  'squigImport.chartAria': 'Frequency response of the imported EQ',
  'squigImport.emptyTitle': 'Your imported curve will appear here',
  'squigImport.emptyHint':
    'Paste an export to see its shape before you continue fine-tuning it in the EQ.',
  'voicing.quickAria': 'Voicing: {name}',
  'voicing.quickNone': 'Voicing: none',
  'voicing.quickTitle': 'No voicing applied',
  'voicing.quickLabel': 'Voicing',
  'voicing.quickNoneHint': 'Your EQ bands only',

  // *** Parametric EQ *******************************************************
  'eq.eyebrow': 'FINE TUNE',
  'eq.title': 'Parametric EQ',
  'eq.smart': 'Smart EQ',
  'eq.smart.cancel': 'Cancel',
  'eq.smart.aria': 'Smart EQ from live output',
  'eq.smart.cancelAria': 'Cancel Smart EQ measurement',
  'eq.smart.continuous': 'Continuous',
  'eq.smart.continuousAria':
    'Keep Smart EQ measuring and adjusting while music plays',
  'eq.smart.modeAria': 'Choose how Smart EQ measures',
  'eq.smart.mode.once.note': 'One measurement, applied at once',
  'eq.smart.mode.detail': 'Detail',
  'eq.smart.mode.detail.note': 'Keeps measuring · peaks and dips only',
  'eq.smart.mode.balance': 'Balance',
  'eq.smart.mode.balance.note':
    'Keeps measuring · also evens out bright and warm',
  'eq.smart.mode.target': 'Target',
  'eq.smart.mode.target.note':
    'Keeps measuring · every record to the same curve',
  'eq.layers': 'Also applied',
  'eq.layers.aria': 'Also shaping this output',
  'eq.layers.eq': 'EQ',
  'eq.layers.eq.modified': '(modified)',
  'eq.layers.eq.bands': '{count} bands',
  'eq.layers.convolution': 'Convolution',
  'eq.layers.voicing': 'Voicing',
  'eq.layers.driver': 'Driver',
  'eq.layers.headphone': 'Headphone',
  'eq.layers.custom': 'Custom FX',
  'eq.layers.disable': 'Switch {layer} off without removing it',
  'eq.layers.enable': 'Switch {layer} back on',
  'eq.layers.smart': 'Smart EQ',
  'eq.layers.smart.fullRange': 'Measured · full range',
  'eq.layers.smart.range': 'Measured · {low} to {high}',
  'eq.layers.remove': 'Remove the {layer} layer',
  'eq.layers.clearBands': 'Reset every band to 0 dB',
  'eq.layers.clearReference': 'Remove the headphone correction',
  'eq.layers.clearSmart':
    'Remove the measured correction. Your bands and the reference stay.',
  'eq.layers.clearCustom': 'Clear custom FX filters and text',
  'eq.clear': 'Clear EQ',
  'eq.addBand': 'Add band',
  'eq.addBandAria': 'Add EQ band',
  'eq.quickLayouts': 'Quick layouts',
  'eq.bandCount': '{count} Band',
  'eq.selected': 'Selected band',
  'eq.filter': 'Filter',
  'eq.frequency': 'Frequency',
  'eq.gain': 'Gain',
  'eq.gainDisabled': 'Gain · n/a',
  'eq.quality': 'Quality (Q)',
  'eq.delete': 'Delete band',
  'eq.deleteAria': 'Delete selected EQ band',

  // *** Smart EQ readout ****************************************************
  //
  // The bubble over the Smart EQ button, and every sentence in it is ASSEMBLED
  // rather than written: a clause per frequency range, the loudest three,
  // joined into one line.
  //
  // Which is why each clause is a whole key with the range dropped into a
  // placeholder, and never a verb and a noun glued together in code. English is
  // the one language where that would have worked. "lifted" + "air" is fine;
  // the same two halves in Spanish have to agree in gender, in Russian and
  // German in case, and in Japanese the verb goes last — so a translator needs
  // the whole clause in front of them, and the freedom to move the range
  // wherever their language puts it.
  //
  // The range names are separate keys because they are also said on their own,
  // in a list, after "waiting on". Several dictionaries deliberately phrase the
  // clauses so the noun can stay in its dictionary form — a label with a colon,
  // or a noun phrase — because a slot cannot be declined and a wrong case reads
  // worse than a plain one.
  'eq.smart.range.deepBass': 'deep bass',
  'eq.smart.range.bass': 'bass',
  'eq.smart.range.lowMids': 'low mids',
  'eq.smart.range.mids': 'mids',
  'eq.smart.range.upperMids': 'upper mids',
  'eq.smart.range.presence': 'presence',
  'eq.smart.range.treble': 'treble',
  'eq.smart.range.highTreble': 'high treble',
  'eq.smart.range.air': 'air',
  // Between two named ranges. Its own key because the comma-and-space of a
  // Latin script is an ideographic comma in Chinese and Japanese.
  'eq.smart.range.separator': ', ',
  // What a finished correction did. Past tense: it is printed beside the word
  // that says the measurement is over, and a present participle there reads as
  // a run still going.
  'eq.smart.shape.lifted': 'lifted {range}',
  'eq.smart.shape.eased': 'eased {range}',
  // What the correction still owes the music — the observation that made it
  // run, rather than the operation it is performing.
  'eq.smart.need.more': 'needs more {range}',
  'eq.smart.need.less': 'too much {range}',
  'eq.smart.status.listening': 'Listening',
  'eq.smart.status.listeningPercent': 'Listening {percent}%',
  'eq.smart.status.settling': 'Listening {percent}% - settling',
  // "Waiting on", not "needs": this names a range the measurement has not heard
  // enough of, and "needs air" over a top end somebody has just boosted reads as
  // the app asking for more of it.
  'eq.smart.status.waitingOn': 'Listening {percent}% - waiting on {ranges}',
  'eq.smart.status.waitingOnMore':
    'Listening {percent}% - waiting on {ranges} +{count}',
  'eq.smart.status.paused': 'Paused',
  'eq.smart.status.pausedResume': 'Paused - resume to finish',
  'eq.smart.status.pausedSilent': 'Paused - no sound playing',
  'eq.smart.status.waitingForSound': 'Waiting for sound',
  'eq.smart.status.soundChanged': 'Sound changed - measuring again',
  'eq.smart.status.keptChanging': 'The sound kept changing - stopped',
  'eq.smart.status.notEnoughRange': 'Not enough range to measure',
  'eq.smart.status.alreadyBalanced': 'Already balanced',
  'eq.smart.status.applying': 'Applying…',
  'eq.smart.status.cancelled': 'Cancelled - nothing changed',
  'eq.smart.status.failed': 'Could not measure the output.',
  'eq.smart.result.fullRange': 'Balanced - full range',
  'eq.smart.result.range': 'Balanced - {low} to {high} only',
  // What was heard, then what was done about it. One key so a language can
  // repunctuate the join or swap the halves.
  'eq.smart.result.withShape': '{result} · {shape}',
  'eq.smart.frequency.hz': '{value} Hz',
  'eq.smart.frequency.khz': '{value} kHz',
  // Why a measurement stopped. These are thrown as Error messages by the
  // capture hook and land in the same bubble as everything above, so they are
  // looked up where they are thrown rather than where they are caught — the
  // catch cannot tell one of ours from one the browser raised.
  'eq.smart.error.noCapture':
    'Media capture is not available in this environment.',
  'eq.smart.error.noLoopback':
    'Desktop loopback capture is not available in this environment.',
  'eq.smart.error.streamStopped':
    'The output stream stopped before the measurement finished.',
  'eq.smart.error.analyserPaused':
    'The analyser is paused, so the measurement stopped.',
  'eq.smart.error.noSound':
    'No sound was playing. Start some music and measure again.',
  'eq.smart.error.noAudioTrack':
    'Windows did not provide a system-audio stream.',
  'eq.smart.error.formatChanged':
    'The output format changed while measuring. Try again.',
  'eq.smart.error.deviceChanged':
    'The audio device changed while measuring. Try again.',
  'eq.smart.error.captureFailed':
    'Unable to capture the processed system output.',
  'eq.smart.error.analyserOff':
    'The live output analyser is not running, so there is nothing to measure.',
  'eq.smart.error.alreadyRunning': 'A measurement is already running.',
  'eq.smart.error.timedOut': 'The measurement timed out. Try again.',
  'eq.smart.error.closed': 'FluidEQ closed the measurement.',
  // The caption on the draggable presence line inside each listening band.
  // One key, not a range name with an English tail concatenated onto it: the
  // number goes in a different place in Japanese and the verb has to agree with
  // the range in several of the others.
  'eq.smart.presence.ignoredBelow': 'ignored below {db} dB',
  'eq.smart.presence.trustedAbove': 'trusted above {db} dB',
  'eq.smart.presence.reset': 'Reset {range} for this mode',
  'eq.smart.limit.label': 'Smart EQ limit {db} dB',
  'eq.smart.gap.title':
    '{range}: how far it disagrees, against the amount needed to act',
  'eq.smart.gap.countdown': 'writing in {seconds}s',

  // *** Convolution *********************************************************
  'convolution.eyebrow': 'APO impulse responses',
  'convolution.title': 'Convolution library',
  'convolution.intro':
    'Download a verified, minimum-phase headphone impulse and apply it before your parametric EQ. The shared response graph below keeps both curves visible.',
  'convolution.import': 'Import a WAV…',
  'convolution.importing': 'Importing…',
  'convolution.applied': 'Applied to this output',
  'convolution.clear': 'Clear',
  'convolution.search': 'Search headphone models',
  'convolution.searchPlaceholder':
    'Try “Kraken”, “HD 650”, or a measurement provider',
  'convolution.notice':
    'AutoEq provides the downloadable catalogue. Files are imported as 48 kHz WAV because Equalizer APO requires the impulse response to match the active output sample rate.',
  'convolution.loading': 'Loading official catalogue…',
  'convolution.empty':
    'No matching impulse responses. Try a shorter model name.',
  'convolution.source': 'Source',
  'convolution.apply': 'Download & apply',
  'convolution.downloading': 'Downloading…',
  'convolution.isApplied': 'Applied',
  'convolution.none':
    'No convolution loaded. The EQ tab remains fully independent.',

  // *** Voicing *************************************************************
  'voicing.eyebrow': 'TARGET CURVES',
  'voicing.title': 'Voicing',
  'voicing.intro':
    'A tuned target for what you are actually doing. Each one is written as its own layer after your EQ bands, so your own tuning is never touched and switching back to None restores it exactly.',
  'voicing.refused': 'Could not switch voicing',
  'voicing.groupPurpose': 'What for',
  'voicing.groupGenre': 'Genre',
  'voicing.none': 'None',
  'voicing.none.hint': 'Your EQ bands only, nothing layered on top',
  'voicing.strength': 'Strength',
  'voicing.off': 'Off',
  'voicing.full': 'Full',
  'voicing.inert': 'At 0% strength this voicing does nothing.',
  'voicing.headroom':
    'Adds up to +{peak} dB. Auto normalize reserves the headroom; leave it on unless you are setting the preamp by hand.',

  // *** Config inspector ****************************************************
  // Kicker, heading, lede — the same three the other tab pages carry. The
  // eyebrow used to be the whole header and read as the title; it is the
  // kicker now, and the name of the page has a heading of its own.
  'config.eyebrow': 'WHAT THE ENGINE READS',
  'config.title': 'Equalizer APO config',
  'config.lede': 'What is on disk right now, not what FluidEQ intends.',
  'config.reload': 'Reload',
  'config.reloadTitle': 'Read the config from disk again',
  'config.reading': 'Reading…',
  'config.absent':
    'FluidEQ has not written to this Equalizer APO installation yet.',
  'config.status.notIncluded':
    'Equalizer APO is not including this config. Nothing below is being applied.',
  'config.status.engineOff':
    'The FluidEQ engine is switched off — this config names no output, so Equalizer APO is applying none of it.',
  'config.status.active': 'Active — Equalizer APO is applying this config.',
  'config.outputsAria': 'Outputs in the Equalizer APO config',
  'config.filters.one': '{count} filter',
  'config.filters.many': '{count} filters',
  'config.impulse': 'impulse',
  'config.playingNow': 'Playing now',
  'config.liveTitle': 'Continuous EQ is keeping this measured',
  'config.layer.on': 'on',
  'config.layer.off': 'off',
  // The name column of a row that stands for a layer with no file: a bypassed
  // one, whose `Include:` is simply not written. It is drawn among the includes
  // it is missing from, so the row says where as well as what.
  'config.layers.noFile': 'No file of its own',
  // On the pill of a layer that has no file because it never gets one — the
  // impulse, which Equalizer APO applies ahead of the filters as one line of
  // the device file. Its pill sits in that file's row, and this says why.
  'config.layers.inFile': 'Written into this file, not one of its own.',
  'config.empty': 'Nothing included — this output is left alone.',
  'config.file.missing': 'missing',
  'config.export': 'Export chain',
  'config.import': 'Import chain',
  'config.import.hint': 'Import lands on the output you are listening to.',
  // Said after an import that otherwise worked. The custom block in a shared
  // chain is the sender's own text, and Include: and Plugin: are the two APO
  // commands that reach outside the audio — so it is dropped and named, rather
  // than the whole chain being refused over a line nobody asked for.
  'config.import.customSkipped':
    'Skipped the sender’s custom file: an Include: or Plugin: line in it would load code into Windows audio.',
  'config.file.yours': 'yours',
  'config.hint.custom': 'Yours. Never overwritten.',
  'config.hint.generated': 'Generated — rewritten on the next change.',
  'config.hint.saving': 'Saving writes the file; Equalizer APO picks it up.',
  'config.edit': 'Edit',
  'config.cancel': 'Cancel',
  'config.save': 'Save',

  // *** Support *************************************************************
  'support.eyebrow': 'ENTIRELY OPTIONAL',
  'support.petHint': 'Press space to make it jump',
  'support.game.hint': 'Tap on the beat when the spike reaches the line',
  'support.game.howTo':
    'Tap the pet or press space on every beat. Keep it up and something happens at ×10.',
  'support.game.thanks':
    'If any of this made you smile, ideas and support are what keep it coming.',
  'support.game.noAudio': 'Play something and the beat shows up here',
  'support.game.listening': 'Listening for the beat…',
  'support.game.share': 'Share',
  'support.game.shareEuphoria': 'Share rainbow',
  'support.game.shareTitle': 'Share your score',
  'support.game.shareUnlock':
    'Reach ×10 and this card turns into Rainbow mode — spectrum and all.',
  'support.game.shareNote':
    'Save the card, then attach it to your post — none of these networks can pull an image out of a link.',
  'support.game.shareSave': 'Save card',
  'support.game.shareCopyCard': 'Copy card',
  'support.game.shareCardCopied': 'Copied — paste it in',
  'support.game.shareCopy': 'Copy text',
  'support.game.shareCopied': 'Copied',
  'support.game.shareLinkOnly':
    'Shares the link only — paste the text yourself',
  'support.game.euphoria': 'Rainbow mode',
  'support.game.euphoriaToggle': 'Turn Rainbow mode on or off',
  'support.game.perfect': 'Perfect',
  'support.game.great': 'Great',
  'support.game.good': 'Good',
  'support.game.miss': 'Missed',
  'support.title': 'Support the work',
  'support.close': 'Close',
  'support.pitch':
    'FluidEQ is free and open source, and it stays that way — the source is public, you can always build it yourself for nothing, and nothing here is ever tracked. What is sold is the signed, ready-to-run build. If it earned a place in your setup, a contribution funds the time that keeps it maintained and the next ideas that come out of the same workshop.',
  'support.craft':
    'This is one person’s work, built with a lot of love and an unreasonable amount of attention to detail. Every panel was drawn by hand and argued over: how the response curve reads at a glance, the way a menu unfolds, what a knob does when you drag it slowly, which words go on a button. Nothing here is a stock component with a theme on top.',
  'support.card': 'Card or wallet',
  'support.card.hint':
    'Secure checkout hosted by Stripe. Opens in your browser — the app never sees your card details.',
  'support.coffee': 'Buy me a coffee',
  'support.coffee.hint':
    'A one-off tip, no account needed. Click to open it in your browser, or scan the code with your phone.',
  'support.verify': 'Verify the address before sending.',
  'support.copy': 'Copy address',
  'support.copied': 'Copied',
  'support.openWallet': 'Open in wallet',
  'support.contributed': 'I contributed — unlock the star and the dance',
  'support.thanks': 'Thank you — your pet has its star, and it dances now.',
  'support.releaseNotes': "See what's new in this version",
  'support.footerBefore':
    'Prefer to contribute time instead? Issues and pull requests are just as welcome on',

  // *** Warranty and liability **********************************************
  //
  // The one legal text in this file, and the exception to the rule that legal
  // text in this app is not translated. That rule holds for the rest of the
  // About panel — a licence name, an attribution, a trademark reservation are
  // identifiers, and translating one changes what it names. This is a notice a
  // consumer has to read and accept, and a term somebody cannot read is a term
  // that in much of the world does not bind them. English-only protects less
  // here, not more.
  //
  // Plain and direct in every language, in the register of the rest of the
  // dictionary. Nothing here is to be softened in translation and nothing is
  // to be embellished: "not liable for damage to hearing, equipment or data"
  // has to land as squarely everywhere as it does here. `disclaimer.localLaw`
  // is the sentence that must survive intact — it is the one that stops the
  // rest overstating itself. See `common/disclaimer`.
  'disclaimer.heading': 'No warranty, and no liability',
  'disclaimer.asIs':
    'FluidEQ is provided as is, with no warranty of any kind. Nobody promises that it works, that it suits what you want it for, or that it will keep working. This is what sections 15 and 16 of the GNU General Public License say, and it applies whether you were given this copy or paid for it.',
  'disclaimer.liability':
    'FluidEQ changes how audio is processed on your computer, and it installs and drives Equalizer APO, a separate program that runs with administrator rights and sits in the Windows audio path. To the fullest extent the law allows, {author} is not liable for any damage arising from using it — to your hearing, to speakers, headphones or other equipment, to data or other software, or to anything else, including loss you could not have foreseen.',
  'disclaimer.volume':
    'Sound can be loud, and equalisation can make it louder than the material was. Set your volume low before changing a setting, and turn it up afterwards.',
  'disclaimer.localLaw':
    'Some countries do not allow a seller to exclude certain warranties or liabilities. Where that is the case, those rules apply and this notice does not take away rights the law gives you.',
  'disclaimer.accepting': 'By using FluidEQ you accept the above.',
  'disclaimer.language':
    'This notice was written in English. If a translation differs from the English text, the English text is the one that applies.',
  'disclaimer.accept': 'I understand and accept',
  'disclaimer.decline': 'Quit',
  'provenance.heading': 'Check where this copy came from',
  'provenance.body':
    "FluidEQ's official signed installer is delivered only through fluideq.com. Source builds should come from the official repository. The GPL permits third parties to copy, modify, rebuild, and sell FluidEQ, but their builds are not automatically signed, reviewed, supported, or endorsed by FluidEQ. If a download claims to be official and has no valid Windows digital signature, close it and report it.",
  'provenance.site': 'Official site: fluideq.com',
  'provenance.repository': 'Official source: github.com/StartSWest/FluidEQ',

  // *** Language ************************************************************
  'language.title': 'Language',
  'language.aria': 'Interface language',
  'waveform.style': 'Change the meter style',
  'waveform.live': 'LIVE OUTPUT',
  'waveform.signal': 'AUDIO SIGNAL',
  'waveform.clip': 'CLIP',
  'autoeq.official': 'AutoEq official',
  'autoeq.officialDatabase': 'AutoEq official database',
  'autoeq.deviceAria': 'Audio device',
  'autoeq.targetAria': 'Target frequency response',
} as const;

export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;

export default en;
