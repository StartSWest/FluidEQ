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

/** The Karaoke tab, its player and the Maker. */
const karaoke = {
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
    'Audio: MP3, WAV, OGG, Opus, FLAC, M4A or AAC · Lyrics: LRC, eLRC or UltraStar TXT · Add cover art and video too',
  'karaoke.import.drop': 'Drop songs, lyrics, or folders here',
  'karaoke.error.missingAudio':
    'Add an audio file together with that lyric file.',
  'karaoke.error.ambiguous':
    'More than one song pairing is possible. Select one audio file and, optionally, one lyric file.',
  'karaoke.error.unsupported':
    'None of those files is a supported Karaoke audio or lyric file yet. Cover art and video need a song beside them.',
  'karaoke.error.read': 'FluidEQ could not read the selected local files.',
  'karaoke.error.playback':
    'This Chromium build could not play that audio file or codec.',
  // Every one of these follows the file name in the strip, which is why they
  // open in lower case and carry no subject. The reason and the reassurance
  // are separate keys because six reasons repeating one tail would be sixty
  // sentences for the translators to keep identical.
  'karaoke.warning.lyrics': 'could not be parsed.',
  'karaoke.warning.lyricsEmpty': 'is empty.',
  'karaoke.warning.lyricsMissingTiming':
    'carries no timings FluidEQ could read.',
  'karaoke.warning.lyricsMissingBpm':
    'declares no BPM, which an UltraStar file needs.',
  'karaoke.warning.lyricsInvalidBpm':
    'declares a BPM that is not a usable number.',
  'karaoke.warning.lyricsMalformedNote':
    'has a note row FluidEQ could not read.',
  'karaoke.warning.lyricsUnsupportedVariant':
    'uses a karaoke variant FluidEQ cannot sing yet, such as a duet.',
  'karaoke.warning.lyricsAtLine': 'Line {line}.',
  'karaoke.warning.lyricsAudioIntact':
    'The audio remains available without timed lyrics.',
  'karaoke.warning.setAside':
    'FluidEQ has no karaoke reader for these files yet, so they were set aside: {formats}.',
  'karaoke.warning.unpairedLyrics':
    'No audio file matches these lyric files, so they were not used: {files}.',
  'karaoke.warning.ambiguousLyrics':
    'Two lyric files matched the same song, so neither was used: {files}.',
  'karaoke.warning.andMore': 'and {count} more',
  'karaoke.countdown.sing': 'Sing',
  'karaoke.song.unknownArtist': 'Local song',
  'karaoke.stage.videoUnsupported': '{format} video cannot be played here',
  'karaoke.stage.videoFailed': '{format} video could not be decoded here',
  'karaoke.stage.hideArt': 'Hide cover art',
  'karaoke.stage.showArt': 'Show cover art',
  'karaoke.stage.noArt': 'This song has no cover art',
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
  'karaoke.transport.spaceShortcut': '{action} · Space',
  'karaoke.transport.seek': 'Song position',
  'karaoke.transport.volume': 'Volume',
  'karaoke.transport.vocalLevel': 'Guide vocal',
  'karaoke.transport.vocalOff': 'Backing only',
  'karaoke.transport.vocalFull': 'Original',
  'karaoke.transport.mixSettings': 'Mix settings',
  'karaoke.transport.openMixSettings': 'Open mix settings for {channel}',
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
  'karaoke.pitch.show': 'Show pitch guide',
  'karaoke.pitch.hide': 'Hide pitch guide',
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
  'karaoke.maker.exitBusy':
    'A local model is still running. Cancel it, or wait for it to finish, before leaving the editor.',
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
  'karaoke.maker.recordLines': 'Record line entries',
  'karaoke.maker.syncLinesFromHere': 'Sync lines from here',
  'karaoke.maker.syncWordsFromHere': 'Sync words from here',
  'karaoke.maker.syncNow': 'Now',
  'karaoke.maker.syncNext': 'Next: {item}',
  'karaoke.maker.markLine': 'Mark line start',
  'karaoke.maker.markLineEnd': 'Mark line end',
  'karaoke.maker.captureEnd': 'Listening for the end',
  'karaoke.maker.capturePressStart': 'Step 1 · Press Enter at START',
  'karaoke.maker.captureReplaceStart':
    'Next lyric ready · Enter replaces its START',
  'karaoke.maker.captureStartSaved':
    'Start saved at {time} · Press Enter at END',
  'karaoke.maker.captureAutomaticStart':
    'Automatic start {time} · Press Enter at END',
  'karaoke.maker.captureAutomaticSuggestion':
    'Suggested start {time} · Enter now records START',
  'karaoke.maker.captureFixEnd': 'Recorded line · Enter fixes its END',
  'karaoke.maker.captureStartPoint': 'START',
  'karaoke.maker.captureEndPoint': 'END',
  'karaoke.maker.captureGuideTitle': 'Line timing',
  'karaoke.maker.captureSetupTitle': 'Ready to record the lyric timing?',
  'karaoke.maker.captureSetupBody':
    'Listen to the singer. Press Enter when the line starts, optionally press Tab at each new word, then press Enter again when the line ends. This lets a held final word keep its full length.',
  'karaoke.maker.captureSetupStatus':
    'Read the guide in Live Preview, then start recording.',
  'karaoke.maker.captureStartRecording': 'Start recording',
  'karaoke.maker.captureMoveGuide':
    'Drag to move this guide. Double-click to reset its position.',
  'karaoke.maker.selectionPanel': 'Selection tools',
  'karaoke.maker.selectionMoveGuide':
    'Drag to move the selection tools. Double-click to reset their position.',
  'karaoke.maker.dismissSelection': 'Close selection tools',
  'karaoke.maker.captureCountdownReady': 'Get ready for the first line',
  'karaoke.maker.captureGuideNext': 'Coming next',
  'karaoke.maker.captureGuideAudio': 'move audio 2 seconds · Shift: 1 second',
  'karaoke.maker.captureGuideLyrics': 'choose lyric line',
  'karaoke.maker.captureGuidePlayback': 'play or pause',
  'karaoke.maker.captureGuideWords': 'mark the next word',
  'karaoke.maker.captureGuideUndo': 'undo last mark',
  'karaoke.maker.stopRecording': 'Stop recording',
  'karaoke.maker.markWord': 'Mark word',
  'karaoke.maker.markNextWord': 'Next word',
  'karaoke.maker.done': 'Done',
  'karaoke.maker.ignoreLine': 'Ignore line',
  'karaoke.maker.lineTimingComplete':
    'Line timing complete. Ready to review and use in the player.',
  'karaoke.maker.recordLinesHint':
    'ENTER marks line start/end · TAB marks the next word · ↑ selects the previous lyric and jumps to its recorded start · ↓ selects the next lyric · ←/→ moves only the audio 2s · SPACE plays or pauses · Backspace undoes',
  'karaoke.maker.panView': 'Hand · pan timeline',
  'karaoke.maker.panHint':
    'Hand tool: drag anywhere on the canvas to move through the song without editing.',
  'karaoke.maker.scrubHint':
    'Drag the playhead to move silently. Over lyrics, FluidEQ plays only a tiny audio cue.',
  'karaoke.maker.addNote': 'Note',
  'karaoke.maker.selectNotes': 'Select notes',
  'karaoke.maker.paintNotes': 'Paint notes',
  'karaoke.maker.selectNotesHint':
    'Drag a box around notes. Drag any selected note to move the complete group. Ctrl-click a lyric syllable to attach the selection.',
  'karaoke.maker.paintNotesHint':
    'Drag across the pitch grid to paint a note. The paint tool stays active so you can add several notes.',
  'karaoke.maker.notesSelected': 'notes selected',
  'karaoke.maker.copyNotes': 'Copy selected notes',
  'karaoke.maker.pasteNotes': 'Paste notes at playhead',
  'karaoke.maker.notePasted': 'Note pasted at the playhead.',
  'karaoke.maker.notesPasted': '{count} notes pasted at the playhead.',
  'karaoke.maker.attachNotesByTime': 'Attach to lyrics',
  'karaoke.maker.detachNotes': 'Detach from lyrics',
  'karaoke.maker.noteAttachHelp':
    'Hold Ctrl and drag a selected note onto a word or syllable to attach it. Attached notes follow that lyric timing and remain fully locked until detached.',
  'karaoke.maker.noteCopyHelp':
    'Ctrl+C copies the selection · Ctrl+V pastes its first note at the playhead.',
  'karaoke.maker.attachedTo': 'Attached to “{word}”',
  'karaoke.maker.noteUnattached': 'Not attached to a lyric',
  'karaoke.maker.splitWordSyllables': 'Split word into syllables',
  'karaoke.maker.syllableEditorEyebrow': 'Syllable editor',
  'karaoke.maker.syllableEditorTitle': 'Split “{word}”',
  'karaoke.maker.syllableEditorHint':
    'Click between letters to add or remove a syllable boundary.',
  'karaoke.maker.syllableSplitPoint': 'Toggle split after “{text}”',
  'karaoke.maker.syllableEditorPreview': 'Resulting syllables',
  'karaoke.maker.applySyllableSplit': 'Apply syllable split',
  'karaoke.maker.hearNote': 'Hear note',
  'karaoke.maker.split': 'Split',
  'karaoke.maker.delete': 'Delete',
  'karaoke.maker.analyze': 'Analyze melody',
  'karaoke.maker.prepare': 'Prepare karaoke',
  'karaoke.maker.advanced': 'Repair tools',
  'karaoke.maker.prepared': 'This karaoke already has timed lyrics and melody.',
  'karaoke.maker.repairLyrics': 'Re-detect lyric timing',
  'karaoke.maker.repairMelody': 'Re-detect melody notes',
  'karaoke.maker.rebuildKaraoke': 'Rebuild lyrics + melody',
  'karaoke.maker.autoAlign': 'Auto align',
  'karaoke.maker.aiMelody': 'AI melody',
  'karaoke.maker.transcribe': 'Transcribe',
  'karaoke.maker.vocalStem': 'Load vocal-only track',
  'karaoke.maker.vocalStemLoaded': 'Vocal-only track loaded',
  'karaoke.maker.groupVoice': 'Voice and music',
  'karaoke.maker.stemsTitle': 'Separated tracks',
  'karaoke.maker.stemBacking': 'Backing track',
  'karaoke.maker.stemSaveAs': 'Save {name} as',
  'karaoke.maker.stemSaveFormat': 'Save {name} as {format}',
  'karaoke.maker.stemMp3Encoding': 'Encoding the MP3…',
  'karaoke.maker.stemMp3Saved': 'MP3 saved.',
  'karaoke.maker.stemMp3Failed': 'The MP3 could not be encoded.',
  'karaoke.maker.stemVoice': 'Voice',
  'karaoke.maker.stemSave': 'Save',
  'karaoke.maker.groupLyrics': 'Lyrics and timing',
  'karaoke.maker.removeBackground': 'Separate voice from music',
  'karaoke.maker.removeBackgroundDone': 'Voice already separated',
  'karaoke.maker.separationDownloading':
    'Downloading the separation model ({percent}%) · one time, about 700 MB',
  'karaoke.maker.separationReading': 'Reading the song',
  'karaoke.maker.separating': 'Separating the voice from the music',
  'karaoke.maker.separationDone': 'Voice separated. Lyric detection is ready.',
  'karaoke.maker.separationSlow':
    'No graphics acceleration on this machine, so this will take a few minutes instead of under one.',
  'karaoke.maker.separationRequired':
    'Separate the voice first — lyric detection reads the isolated vocal.',
  'karaoke.maker.separationRequiredMelody':
    'Separate the voice first — note detection follows a single voice, and in a mix that is usually an instrument.',
  'karaoke.maker.wizardTitle': 'Set this song up automatically',
  'karaoke.maker.wizardIntro':
    'This song has no lyric timing yet. FluidEQ can separate the voice from the music, then read the words and their timing from it. Everything runs on this computer.',
  'karaoke.maker.wizardStepSeparate': 'Separate the voice',
  'karaoke.maker.wizardStepTranscribe': 'Read the words and timing',
  'karaoke.maker.wizardLanguage': 'Language of the lyrics',
  'karaoke.maker.wizardLanguageAuto': 'Detect automatically',
  'karaoke.maker.wizardStart': 'Set up automatically',
  'karaoke.maker.wizardSkip': 'I will do it myself',
  'karaoke.maker.wizardCancel': 'Stop',
  'karaoke.maker.wizardHide': 'Continue in background',
  'karaoke.maker.wizardCancelled': 'Stopped. Anything finished has been kept.',
  'karaoke.maker.vocalFocus': 'Center vocal focus',
  'karaoke.maker.export': 'Export',
  'karaoke.maker.exportProject': 'FluidEQ project',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': 'Enhanced LRC',
  'karaoke.maker.exportInstrumental': 'Backing track (no vocals)',
  'karaoke.maker.tapHint':
    'SPACE or ENTER marks “{word}” · ←/→ nudges 25 ms · ↑/↓ changes word · Backspace undoes',
  'karaoke.maker.editHint':
    'Box-select notes to move or delete them together. Paint notes directly on the pitch grid. Ctrl-click a lyric syllable to attach selected notes. Ctrl + wheel zooms.',
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
  'karaoke.maker.applyUntimed':
    '{count} lyric words still have no verified voice timing. Detect or place them before using this karaoke in the player.',
  'karaoke.maker.selectHint': 'Select a lyric or melody note to inspect it.',
  'karaoke.maker.rights':
    'I have permission to use and export this audio and these lyrics.',
  'karaoke.maker.cancel': 'Cancel',
  'karaoke.maker.localAnalysis': 'Local analysis',
  'karaoke.maker.lyricsEyebrow': 'LYRICS',
  'karaoke.maker.lyricsTitle': 'Paste or edit one lyric line per row',
  'karaoke.maker.lyricsWarning':
    'Replacing the text clears word links so the new words can be tapped or aligned safely.',
  'karaoke.maker.lyricsReferenceHint':
    'Provide the complete lyrics, including repeated lines and markers such as [Verse] or [Chorus]. FluidEQ keeps this text and uses local speech recognition to find its timing.',
  'karaoke.maker.referenceLyrics': 'Reference lyrics',
  'karaoke.maker.wordTiming': 'Word timing',
  'karaoke.maker.lyricsWordCount': '{count} words in the reference',
  'karaoke.maker.lyricsTimedCount': '{timed} of {total} timed',
  'karaoke.maker.lyricsApplyBeforeTiming':
    'Accept the new lyrics before editing word timing',
  'karaoke.maker.lyricsNoTimedWords': 'No timed words yet',
  'karaoke.maker.lyricsTimingEditorHint':
    'After detection, select any word to correct its text, start time, or length.',
  'karaoke.maker.lyricsSelectWord': 'Select a word to edit its timing.',
  'karaoke.maker.lyricsSelectedWord': 'Selected word',
  'karaoke.maker.lyricsWordNavigation': 'Word navigation',
  'karaoke.maker.previousWord': 'Previous word',
  'karaoke.maker.nextWord': 'Next word',
  'karaoke.maker.lyricsPlaceholder':
    'Paste the complete lyrics here…\n\n[Verse]\nFirst line\nSecond line',
  'karaoke.maker.loadLyricsFile': 'Load lyrics file',
  'karaoke.maker.lyricsFileLoaded': 'Loaded lyrics from {file}.',
  'karaoke.maker.lyricsRequired':
    'Add or paste the complete lyrics before detecting timing and melody.',
  'karaoke.maker.detectTimingMelody': 'Detect timing and melody',
  'karaoke.maker.acceptLyrics': 'Accept lyrics',
  'karaoke.maker.acceptAndRecordLines': 'Accept and record timing',
  'karaoke.maker.continueInBackground': 'Continue in background',
  'karaoke.maker.clearLyrics': 'Clear lyrics',
  'karaoke.maker.clearLyricsTitle': 'Clear all lyrics?',
  'karaoke.maker.clearLyricsBody':
    'This removes every lyric and its timing. Melody notes remain, but their word links are removed. Undo is available after clearing.',
  'karaoke.maker.clearNotes': 'Clear notes',
  'karaoke.maker.clearNotesTitle': 'Clear all melody notes?',
  'karaoke.maker.clearNotesBody':
    'This removes every melody note while keeping all lyrics and word timing. Undo is available after clearing.',
  'karaoke.maker.notesCleared': 'All melody notes were cleared.',
  'karaoke.maker.lyricsCleared':
    'All lyrics were cleared. Existing notes were kept without word links.',
  'karaoke.maker.restore': 'Restore original',
  'karaoke.maker.restoreTitle': 'Restore the original karaoke?',
  'karaoke.maker.restoreBody':
    'This discards every edit in this session and rebuilds the karaoke as it was imported, including its saved draft. Undo is available after restoring.',
  'karaoke.maker.restored': 'The imported original was restored.',
  'karaoke.maker.replaceLyricsWarning':
    'The words changed. Replacing them rebuilds word IDs and automatic timing; existing manual word corrections cannot be transferred reliably. Melody notes remain and will be relinked.',
  'karaoke.maker.replaceAndDetect': 'Replace and detect',
  'karaoke.maker.wordText': 'Word',
  'karaoke.maker.wordStart': 'Start (ms)',
  'karaoke.maker.wordPosition': 'Position',
  'karaoke.maker.wordDuration': 'Length (ms)',
  'karaoke.maker.wordTimingSliderHint':
    'Adjusts the shared boundary; the neighbouring word gives or receives time while the line range stays fixed.',
  'karaoke.maker.usePlayhead': 'Use playhead',
  'karaoke.maker.playWord': 'Play word',
  'karaoke.maker.allowAutoTiming': 'Allow automatic timing',
  'karaoke.maker.replaceLyrics': 'Replace lyrics',
  'karaoke.maker.lyricsAutoAligned':
    'New lyrics applied and aligned to the available melody.',
  'karaoke.maker.lyricsNeedPreparation':
    'New lyrics applied. Choose Prepare karaoke to detect their timing.',
  'karaoke.maker.transcriptionEyebrow': 'ONE-TIME LOCAL MODEL',
  'karaoke.maker.transcriptionTitle': 'Download the speech model?',
  'karaoke.maker.transcriptionBody':
    'FluidEQ will download the MIT-licensed {model} model from Hugging Face and cache it on this PC — one time, about 570 MB with graphics acceleration and about 1.1 GB without it. Your audio never leaves this computer. The first run takes a few minutes and uses significant memory.',
  'karaoke.maker.transcriptionReview':
    'Recognition is only a starting point. FluidEQ keeps your original lyric spelling when matching existing text, and all timestamps remain editable.',
  'karaoke.maker.notNow': 'Not now',
  'karaoke.maker.downloadTranscribe': 'Download and transcribe',
  'karaoke.maker.downloadPrepare': 'Download and prepare lyrics',
  'karaoke.maker.downloadingWhisper': 'Downloading speech model',
  'karaoke.maker.downloadOverall': 'Overall download',
  'karaoke.maker.downloadFiles': '{complete} of {total} files',
  'karaoke.maker.loadingWhisper': 'Loading speech model',
  'karaoke.maker.analysisRunning': 'Analyzing pitch locally',
  'karaoke.maker.analysisAligned':
    'Aligned untouched words from {count} detected note regions. Manual timing was preserved.',
  'karaoke.maker.analysisFound': 'Analysis found {count} note regions.',
  'karaoke.maker.basicPitchRunning': 'Detecting the melody notes',
  'karaoke.maker.basicPitchFound':
    'Found {count} editable melody notes from the voice.',
  'karaoke.maker.whisperPreparing': 'Preparing lyric timing',
  'karaoke.maker.whisperDecoding': 'Decoding audio locally',
  'karaoke.maker.whisperTranscribing': 'Detecting lyric timing',
  'karaoke.maker.whisperTranscribingProgress':
    'Detecting lyric timing · pass {pass}/{passes} · block {chunk}/{chunks}',
  'karaoke.maker.whisperAligning': 'Fitting the lyrics to the singing',
  'karaoke.maker.whisperComplete': 'Lyric timing detected',
  'karaoke.maker.whisperMatched':
    'Whisper matched {count} recognized words. Review their editable timing before export.',
  'karaoke.maker.autoAlignComplete':
    'Untouched lyrics aligned to the detected melody. Manual timing was preserved.',
  'karaoke.maker.speechMemory': 'AI model memory',
  'karaoke.maker.speechMemoryReady': 'Ready in RAM',
  'karaoke.maker.speechMemoryCached': 'Cached on disk',
  'karaoke.maker.speechMemoryMissing': 'Not downloaded',
  'karaoke.maker.modelWhisper': 'Speech (Whisper)',
  'karaoke.maker.modelPitch': 'Pitch (RMVPE)',
  'karaoke.maker.modelSeparation': 'Separation (RoFormer)',
  'karaoke.maker.freeMemory': 'Free RAM now',
  'karaoke.maker.memoryReleased':
    'Speech model removed from RAM. Its downloaded files remain cached.',
  'karaoke.maker.memoryReleaseBusy':
    'The speech model is busy and cannot be released yet.',
  'karaoke.maker.memoryAfterUse': 'When it is idle',
  'karaoke.maker.memoryPolicy.ask': 'Ask me',
  'karaoke.maker.memoryPolicy.auto': 'Release automatically',
  'karaoke.maker.memoryPolicy.keep': 'Keep loaded',
  'karaoke.maker.memoryAfter': 'After',
  'karaoke.maker.memoryMinutes': '{count} min',
  'karaoke.maker.memoryPromptTitle': 'Free speech-model memory?',
  'karaoke.maker.memoryPromptBody':
    'The local speech model is idle. Freeing it saves RAM; its files stay cached for a faster reload.',
  'karaoke.maker.keepLoaded': 'Keep loaded',
  'karaoke.maker.exported': 'Exported {file}',
  'karaoke.maker.exportedPartialLrc':
    'Exported {file}, without {lines} lyric lines: LRC needs a time on the line or on one of its words, and these have neither. Time them in the Maker and export again for a complete file.',
  'karaoke.maker.exportedPartialUltraStar':
    'Exported {file}, without {words} lyric words: UltraStar carries a word only where the melody has a note, and these have none. Detect or draw their notes and export again for a complete file.',
  'karaoke.maker.exportFallback': 'karaoke file',
  'karaoke.maker.projectTooLarge': 'The project is larger than 16 MB.',
  'karaoke.maker.previewResize': 'Resize live preview',
  'karaoke.maker.seekBack': 'Go back {seconds} seconds',
  'karaoke.maker.seekForward': 'Go forward {seconds} seconds',
  'karaoke.maker.jumpToStart': 'Jump to song start',
  'karaoke.maker.jumpToEnd': 'Jump to song end',
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
  'karaoke.maker.playerTimingLoaded':
    'Using the current player timing. Undo restores your saved draft.',

  'karaoke.translation.picker': 'Lyrics language',
  'karaoke.translation.original': 'As recorded',
  'karaoke.translation.add': 'Add a language',
  'karaoke.translation.addPending': "Pasting a translation isn't built yet.",
  'karaoke.translation.remove': 'Remove this language',
  'karaoke.translation.target': 'Language of the lyrics you are pasting',
  'karaoke.translation.paste':
    'Paste the lyrics in that language, one line per line of the song.',
  'karaoke.translation.mismatch':
    'The song has {expected} sung lines and this text has {received}. Line them up against the numbered lines beside the box.',
  'karaoke.translation.fit': '{syllables} syllables, {notes} notes',
  'karaoke.translation.fitOk': 'Fits the melody',
  'karaoke.translation.empty': 'No lyrics in this language yet.',
} as const;

export default karaoke;
