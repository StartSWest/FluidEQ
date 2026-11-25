// What's New for 2.6 (`renderer/components/featureTour/release26.tsx` and
// `release26Visuals.tsx`): look A, picked by Ivan on 2026-11-25. Every line
// says only what the 2.6.0 notes say (CHANGELOG.md), in the same words where
// it can: Smart correction measures, settles and holds; lyrics are looked
// up in the browser, never fetched; every scene in view plays, with no count.
const tour26 = {
  'tour.v26.window.name': 'A new window',
  'tour.v26.window.subtitle': 'Flat and calm, dark or white',
  'tour.v26.window.kicker': 'FLUIDEQ 2.6',
  'tour.v26.window.title': 'The whole window, redone',
  'tour.v26.window.lead':
    'Every page is laid out like the Library now: flat and calm, with no shadows and nothing boxed in. Brightness runs from fully dark to fully white, and the Tint has a second colour for the window’s marks.',
  'tour.v26.window.hint':
    'Move the pointer across the window to turn it from dark to white.',
  'tour.v26.window.next': 'More to hear in 2.6',
  'tour.v26.window.seamLabel': 'The window, white and dark',
  'tour.v26.window.seamValue': 'White on the left, dark on the right',
  'tour.v26.window.white': 'White',
  'tour.v26.window.dark': 'Dark',

  'tour.v26.autoEq.name': 'Auto EQ',
  'tour.v26.autoEq.subtitle': 'Each song keeps its own sound',
  'tour.v26.autoEq.kicker': 'EQ · AUTO EQ',
  'tour.v26.autoEq.title': 'Every song plays the sound it should',
  'tour.v26.autoEq.lead':
    'One panel decides each song’s sound: a song with a saved sound plays it, an album set to a sound plays it on every song, and anything else plays the sound you picked last.',
  'tour.v26.autoEq.point1':
    'The song that plays and whose sound it is: its own, its album’s or yours.',
  'tour.v26.autoEq.point2':
    'Song sounds and Album sounds, each with its own switch, and Save for this song.',
  'tour.v26.autoEq.point3':
    'Smart correction measures each song once, settles, and holds its correction, on top of any preset.',
  'tour.v26.autoEq.open': 'Open the EQ',

  'tour.v26.mic.name': 'Mic',
  'tour.v26.mic.subtitle': 'A rack for your microphone',
  'tour.v26.mic.kicker': 'MIC',
  'tour.v26.mic.title': 'Your voice, clean and steady in every app',
  'tour.v26.mic.lead':
    'The new Mic tab shapes each microphone’s own sound in the FluidEQ Engine, so every app that uses it hears the result.',
  'tour.v26.mic.point1':
    'Nine stages, from Low cut and Noise cancelling to Voice level and Reverb, each with its own switch and presets.',
  'tour.v26.mic.point2':
    'Your voice as you speak: what reaches the mic, faint, behind what others hear.',
  'tour.v26.mic.point3':
    'Profiles to start from: Streaming, Podcast, Game chat, Singing, voice effects and more.',
  'tour.v26.mic.open': 'Open Mic',

  'tour.v26.eq.name': 'The EQ page',
  'tour.v26.eq.subtitle': 'Three tabs and presets of your own',
  'tour.v26.eq.kicker': 'EQ',
  'tour.v26.eq.title': 'The EQ page, in three tabs',
  'tour.v26.eq.lead':
    'Your EQ, Preset and Tone each keep their tools on one row, with the bands right under the graph. Every preset card draws its curve, and New preset makes presets of your own.',
  'tour.v26.eq.point1':
    'Your EQ, Preset and Tone, each with what it holds beside its name.',
  'tour.v26.eq.point2':
    'Yours, where New preset makes one: a curve shaped on the graph and a rack for the DSP page.',
  'tour.v26.eq.point3':
    'Every preset card draws its curve, and its star keeps it with your favourites.',
  'tour.v26.eq.open': 'Open the EQ',

  'tour.v26.dynamics.name': 'Dynamics',
  'tour.v26.dynamics.subtitle': 'A curve for every band',
  'tour.v26.dynamics.kicker': 'DSP · DYNAMICS',
  'tour.v26.dynamics.title': 'See what Dynamics does to every band',
  'tour.v26.dynamics.lead':
    'Each band draws its curve, and its level rides it live with the music: lifted while it is quiet, held down while it is loud.',
  'tour.v26.dynamics.point1':
    'What each band is doing right now, lifting or holding, as the song plays.',
  'tour.v26.dynamics.point2':
    'Drag a point to shape the curve: hollow where a band starts, filled how hard.',
  'tour.v26.dynamics.point3':
    'Type a value under the curve when you want it exact.',
  'tour.v26.dynamics.open': 'Open DSP',

  'tour.v26.library.name': 'Library',
  'tour.v26.library.subtitle': 'Lyrics, tags and Cover Flow in 3D',
  'tour.v26.library.kicker': 'LIBRARY',
  'tour.v26.library.title': 'A new Library, with the words to every song',
  'tour.v26.library.lead':
    'Shelves with the folder tree inside them, albums opened as pages, tags you can fix and Cover Flow in 3D, and a Lyrics tab that lights each word as it is sung.',
  'tour.v26.library.point1':
    'Timed lines lit word by word as the song plays; press a line to play from there.',
  'tour.v26.library.point2':
    'Look lyrics up on LRCLIB, Genius or Musixmatch in your browser, or import them, and they stay with the song.',
  'tour.v26.library.point3':
    'Open in Karaoke takes the words to the Karaoke Maker.',
  'tour.v26.library.open': 'Open the Library',

  'tour.v26.karaoke.name': 'Karaoke',
  'tour.v26.karaoke.subtitle': 'It scores your singing',
  'tour.v26.karaoke.kicker': 'KARAOKE',
  'tour.v26.karaoke.title': 'Sing, and see how close you came',
  'tour.v26.karaoke.lead':
    'Karaoke scores every note you sing, names notes in the song’s own key, hears chords far more accurately and plays through the Library’s player.',
  'tour.v26.karaoke.point1':
    'The pitch strip fills with the colours of your voice as you sing.',
  'tour.v26.karaoke.point2':
    'A verdict on every note, and the lines as rows of cells under the strip.',
  'tour.v26.karaoke.point3':
    'Your score as you sing, and a summary with the song’s map at the end.',
  'tour.v26.karaoke.open': 'Open Karaoke',

  'tour.v26.also': 'Also in 2.6',
  'tour.v26.also.normalizer':
    'The Normalizer is yours: no DSP preset turns it on or off any more.',
  'tour.v26.also.deEsser':
    'Softer “s” sounds on more DSP presets, and the low and high cuts heard the moment their dial turns.',
  'tour.v26.also.wave':
    'The title bar’s wave has ten new styles and a Recorder, and names the preset that plays.',
  'tour.v26.also.notices':
    'Notices stand in one place, at the bottom right on the player bar.',
  'tour.v26.also.lighter':
    'Less work for your computer: the window no longer redraws itself with every block of audio.',

  'tour.v26.looks.name': 'The look picker',
  'tour.v26.looks.subtitle': 'Every look moves, drawn live',
  'tour.v26.looks.kicker': 'SCENES · LOOKS',
  'tour.v26.looks.title': 'Every look in the picker moves',
  'tour.v26.looks.lead':
    'The look picker is laid out like the Library, opens on the look that is playing and draws every standard look live, while every scene in view plays its clip.',
  'tour.v26.looks.point1':
    'A rail of places, as the Library’s: the styles, then the scenes by kind.',
  'tour.v26.looks.point2':
    'Every standard look moves in its tile, drawn live, the one playing marked.',
  'tour.v26.looks.point3': 'Grid or Details, and the search over them all.',
  'tour.v26.looks.open': 'Open the graph',

  'tour.v26.colours.name': 'Window colours',
  'tour.v26.colours.subtitle': 'What a scene lends the window',
  'tour.v26.colours.kicker': 'SCENES · WINDOW COLOURS',
  'tour.v26.colours.title': 'Tune the colours a scene lends the window',
  'tour.v26.colours.lead':
    'A scene has one set of window colours, the day’s, darkened as night comes. Window colours lets you change them, with Automatic to find them again and Reset.',
  'tour.v26.colours.point1':
    'The colours the scene lends the window, each a swatch to change.',
  'tour.v26.colours.point2':
    'The window itself, as it will look in those colours.',
  'tour.v26.colours.point3':
    'Automatic finds the scene’s own colours again, and Reset puts them back.',
  'tour.v26.colours.open': 'Open Scenes',

  'tour.v26.gallery.name': 'The gallery',
  'tour.v26.gallery.subtitle': 'Laid out like the Library',
  'tour.v26.gallery.kicker': 'SCENES · GALLERY',
  'tour.v26.gallery.title': 'The gallery, laid out like the Library',
  'tour.v26.gallery.lead':
    'Its search at the top and its categories in one row. A new account starts with one free credit, one scene to keep, and scenes download with a daily allowance.',
  'tour.v26.gallery.point1':
    'The search at the top and the categories in one row, as the Library’s bar.',
  'tour.v26.gallery.point2':
    'Every scene in view plays its clip; with animations off they stand still.',
  'tour.v26.gallery.point3':
    'A scene to keep takes a credit, and a new account starts with one.',
  'tour.v26.gallery.open': 'Open Scenes',

  'tour.v26.publish.name': 'Publish on press',
  'tour.v26.publish.subtitle': 'The preview records itself',
  'tour.v26.publish.kicker': 'STUDIO · PUBLISH',
  'tour.v26.publish.title': 'Press Send, and the preview records itself',
  'tour.v26.publish.lead':
    'Publishing records the scene’s preview when you press Send, on the silent demo song, and Write with AI fills the note from the scene’s chat.',
  'tour.v26.publish.point1':
    'The note, filled by Write with AI or written by you.',
  'tour.v26.publish.point2':
    'A line you write is translated into every language before it goes.',
  'tour.v26.publish.point3':
    'Send records the preview clip, so it never waits on you.',
  'tour.v26.publish.open': 'Open Scenes',

  'tour.v26.alsoScenes': 'Also in 2.6',
  'tour.v26.alsoScenes.auto':
    'Auto prepares the next scene while the current one plays and crossfades to it, with no loading ring.',
  'tour.v26.alsoScenes.ambient':
    'Ambient keeps the panes flat, and on the Library a scene plays behind the cover.',
  'tour.v26.alsoScenes.karaoke':
    'Karaoke’s scene plays in the lyric window, with its own See through and Blur.',
  'tour.v26.alsoScenes.studio':
    'The Studio always wears its own scene and is laid out like the Library.',
} as const;

export default tour26;
