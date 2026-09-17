/**
 * The Studio: where Plus members make scenes with their own AI and watch them
 * live. The AI prompt itself is English in every language (see
 * `renderer/studio/aiPrompt.ts`); everything a member reads is here.
 *
 * The problem sentences are keyed by the rule's own code, so a refusal
 * reaches the member as the thing to change, with the line to change it on.
 */
const studio = {
  'studio.notes.failed': 'Could not save the project description. Try again.',
  'studio.stage.loading': 'Loading scene…',
  'studio.picture.download': 'Save image',
  'studio.picture.downloaded': 'Image saved',
  'studio.picture.downloadFailed': 'Could not save the image.',
  'studio.picture.separate': 'Separate images ({count})',
  'studio.picture.separateHint':
    'These are parts of one image. Saving them leaves the scene unchanged.',
  // Any picture on the card, opened large over the app.
  'studio.picture.view': 'View {name} larger',
  'studio.picture.previous': 'Previous image',
  'studio.picture.next': 'Next image',
  'studio.picture.position': '{index} of {count}',
  'studio.picture.all': 'All images',
  'studio.picture.close': 'Close',
  'studio.picture.zoomIn': 'Zoom in',
  'studio.picture.zoomOut': 'Zoom out',
  'studio.picture.fit': 'Fit',
  'studio.project.previous': 'Previous project',
  'studio.project.next': 'Next project',
  'studio.title': 'Studio',
  'studio.description': 'Make scenes with your AI and watch them live',
  'studio.rail.blurb': 'Build your own scenes',

  'studio.plus.title': 'With Plus',
  'studio.plus.body':
    'Your scene stays on this computer. Plus puts it on the graph, on your desktop, in the gallery, or in a file you can send.',
  'studio.plus.locked': 'Only with Plus',
  'studio.plus.oneFolder':
    'Without Plus, the first of these opens; the rest are listed with a lock, for Plus.',
  'studio.plus.lockedProject':
    'With Plus this project opens too; without Plus the Studio keeps one.',
  'studio.plus.oneProject':
    'The Studio keeps one project without Plus. With Plus there is no limit.',

  'studio.maker.title': 'Make it with your AI',
  'studio.maker.describe': 'Describe your scene',
  'studio.maker.placeholder':
    'What it shows, and what moves with the beat, the bass or the treble. A photo of yours can come alive too.',
  'studio.maker.examples': 'Or start from one:',
  'studio.maker.openTitle': 'Open the project folder in your AI assistant',
  'studio.maker.openBody':
    'Any assistant that works on files: Claude, Cursor, Codex, Copilot. With a chat instead, save the files it gives you in this folder.',
  'studio.maker.openNoProject':
    'Start a project first: its folder is what your AI works in.',
  'studio.maker.copyPath': 'Copy path',
  'studio.maker.pathCopied': 'Path copied',
  'studio.maker.pathCopyFailed':
    'The clipboard is not available. The path is selected; press Ctrl+C.',
  'studio.maker.pasteTitle': 'Paste this prompt into it',
  'studio.maker.pasteBody':
    'It tells your AI how FluidEQ scenes are made, with your idea at the end. Every file it saves plays on the stage right away.',
  'studio.maker.copied': 'Copied',
  'studio.maker.showPrompt': 'See the prompt',
  'studio.maker.hidePrompt': 'Hide the prompt',

  'studio.action.copyPrompt': 'Copy AI prompt',
  'studio.action.showFolder': 'Show folder',
  'studio.action.addToLooks': 'Add to my looks',
  'studio.action.export': 'Export…',
  'studio.action.desktop': 'Put on desktop…',
  'studio.action.publish': 'Publish…',
  'studio.action.import': 'Open a scene file…',

  'studio.project.label': 'Project',
  'studio.project.group': 'Your projects',
  'studio.project.groupOfficial': 'FluidEQ scenes to look inside',
  'studio.project.inspect': 'Look inside a FluidEQ scene…',
  'studio.project.none': 'Choose a project',
  'studio.project.empty': 'No project yet',
  'studio.project.add': 'Open a folder…',
  'studio.project.forget': 'Remove {name} from the list',
  'studio.project.new': 'New project…',
  'studio.project.forgetHint':
    'The folder and its files stay on your computer.',
  'studio.project.rename': 'Rename {name}…',
  'studio.rename.title': 'Rename project',
  'studio.rename.lead':
    'The scene and its folder both take the new name. FluidEQ lets go of its files while the folder is renamed, then opens the scene again.',
  'studio.rename.where': 'Folder',
  'studio.rename.save': 'Rename',
  'studio.rename.saving': 'Renaming…',
  'studio.rename.exists':
    'There is already a folder called {name} beside it. Choose another name.',
  'studio.rename.failed':
    'The folder could not be renamed. Close anything using its files, then try again.',

  'studio.new.title': 'New project',
  'studio.new.lead':
    'Give it a name. FluidEQ makes its folder, with a scene that already moves.',
  'studio.new.name': 'Name',
  'studio.new.placeholder': 'Northern lights',
  'studio.new.where': 'It goes in',
  'studio.new.change': 'Change…',
  'studio.new.create': 'Create project',
  'studio.new.creating': 'Creating…',
  'studio.new.cancel': 'Cancel',
  'studio.new.exists':
    'There is already a folder called {name} there. Choose another name.',
  'studio.new.invalid':
    'That name cannot be a folder name. Try letters and numbers.',
  'studio.new.failed':
    'The folder could not be made there. Choose another place with Change.',

  // Publishing to the Plus gallery. Asked with the terms' own points the
  // first time, then only the category and the picture.
  'studio.publish.title': 'Publish {name}',
  'studio.publish.titleUpdate': 'Update {name} in the gallery',
  'studio.publish.version': 'Version {version}',
  'studio.publish.publishedVersion': 'In the gallery now: version {version}',
  'studio.publish.note': "What's new in this version",
  'studio.publish.notePlaceholder':
    'One line listeners will see, like: the peaks no longer get cut on wide panels',
  'studio.publish.hears': 'What the scene hears',
  'studio.publish.yourMusic': 'Your music',
  'studio.publish.demo': 'Demo',
  'studio.publish.capture': 'Capture this moment',
  'studio.publish.capturing': 'Capturing…',
  'studio.publish.quietTitle': 'Nothing is playing',
  'studio.publish.quietBody': 'Play music in any app, or use the demo.',
  'studio.publish.useDemo': 'Use the demo',
  'studio.publish.cover': 'Cover',
  'studio.publish.coverHint':
    'Capture the moment the scene looks its best. The cover with the tick is the one the gallery shows.',
  'studio.publish.auto': 'Auto',
  'studio.publish.shot': 'Cover {number}',
  'studio.publish.missed': 'That moment could not be captured. Try again.',
  'studio.publish.stageHeavy':
    'The scene is too heavy to play here. The covers below still work.',
  'studio.publish.stageUnavailable':
    'The scene cannot play here right now. The covers below still work.',
  'studio.publish.category': 'Categories',
  'studio.publish.categoryHint': 'Up to two. Its card shows the first.',
  'studio.publish.pickCategory': 'Choose a category first',
  'studio.publish.point1':
    'Anyone signed in can see it in Visualizers. Plus members can play it, add it to their looks and like it.',
  'studio.publish.point2': 'Each like earns you points on the leaderboard.',
  'studio.publish.point3':
    'You can unpublish it to stop new downloads. Copies already downloaded remain available with Plus.',
  'studio.publish.point3Update':
    'Members who added it see Update, and keep the old version until they press it.',
  'studio.publish.read': 'Read the terms',
  'studio.publish.cancel': 'Cancel',
  'studio.publish.go': 'Publish',
  'studio.publish.goUpdate': 'Publish update',
  'studio.publish.agree': 'Agree and publish',
  'studio.publish.running': 'Publishing…',
  'studio.publish.done': '{name} is in the gallery.',
  'studio.publish.updated': 'The gallery has the new version of {name}.',
  'studio.publish.noPicture':
    'The picture could not be taken. Let the scene play, then try again.',
  'studio.publish.offline': 'Publishing needs a connection. Try again online.',
  'studio.publish.rateLimited':
    'That is a lot of publishing for one hour. Try again later.',
  'studio.publish.signedOut': 'Sign in to publish your scene.',
  'studio.publish.failed': 'The scene could not be published. Try again.',
  'studio.publish.officialCopy':
    'Most of this scene is one of FluidEQ’s own. Take ideas from them, but make the scene your own before you publish it.',
  'studio.publish.outdated':
    'The Plus terms have a newer version. Update FluidEQ to read it and publish.',

  // The pictures a scene asks for: any photo for each, fitted by FluidEQ.
  'studio.picture.files': 'Pictures',
  'studio.picture.missing':
    'The scene uses pictures of yours, and the folder has none yet.',
  'studio.picture.hint':
    'Choose them below, in Pictures in the scene. Any photo works.',
  'studio.picture.title': 'Pictures in the scene',
  'studio.picture.lead':
    'The scene asks for these. Choose any photo for each and FluidEQ fits it in.',
  'studio.picture.pick': 'Choose a photo…',
  'studio.picture.replace': 'Change…',
  'studio.picture.empty': 'No photo yet',
  'studio.picture.size': '{width} × {height}',
  'studio.picture.unnamed': 'Picture {number}',
  'studio.picture.saving': 'Saving the picture…',
  'studio.picture.saved': 'Your picture is in the scene.',
  'studio.picture.noSlot': 'This scene does not use a picture.',
  'studio.picture.badSlot':
    'pack.json asks for a picture FluidEQ cannot make. Ask your AI for a plain file name and a size up to 4096 × 2048.',
  'studio.picture.tooLarge':
    'That file is over 40 MB. Choose a smaller picture.',
  'studio.picture.unreadable':
    'FluidEQ could not read that picture. Try a JPG or PNG.',
  'studio.picture.failed':
    'The picture could not be saved in the project folder. Try again.',

  'studio.notice.copyFailed':
    'The clipboard is not available. The prompt is selected below; press Ctrl+C.',
  'studio.notice.added': '{name} is in your looks, under Made by you.',
  'studio.notice.addFailed': 'This version can be added once it plays.',
  'studio.notice.exported':
    '{file} is ready. Any Plus member can open it in their Studio.',

  // Asked once, before the first export: the scene is the member's, and
  // sending it lets other members play it. The full text is in the Plus terms.
  'studio.share.title': 'Share scenes you make',
  'studio.share.lead':
    'Your scenes stay yours. Exporting one lets other Plus members play it, and that is part of what Plus is.',
  'studio.share.point1':
    'Anyone you give the file to can play it while they have Plus. They cannot sell it.',
  'studio.share.point2':
    'Every like from another member earns you points on the leaderboard.',
  'studio.share.point3':
    'Comments are removed from the shader, and your display name goes with the scene.',
  'studio.share.read': 'Read the terms',
  'studio.share.cancel': 'Not now',
  'studio.share.agree': 'Agree and export',
  'studio.share.running': 'Exporting…',

  'studio.export.offline': 'Exporting needs a connection. Try again online.',
  'studio.export.rateLimited':
    'That is a lot of exports for one hour. Try again later.',
  'studio.export.refused':
    'FluidEQ could not accept this version. Fix what it shows and save.',
  'studio.export.signedOut': 'Sign in to export your scene.',
  'studio.export.failed': 'The scene could not be exported. Try again.',
  'studio.export.officialCopy':
    'Most of this scene is one of FluidEQ’s own. Take ideas from them, but make the scene your own before you export it.',
  'studio.inspect.title': 'A FluidEQ scene, to look inside',
  'studio.inspect.body':
    'See how it is made and take ideas for your own scenes. Try any change here you like; it can’t be added to your looks, published or exported.',
  'studio.inspect.locked':
    'This is a FluidEQ scene, opened to look inside. It can’t be added to your looks, published or exported.',
  'studio.export.banned': 'This account can no longer share scenes.',
  'studio.export.outdated':
    'The Plus terms have a newer version. Update FluidEQ to read it and export.',

  'studio.import.done': '{name} by {author} is in your looks.',
  'studio.import.doneAnonymous': '{name} is in your looks.',
  'studio.import.own': '{name} is yours. It is back in your looks.',
  'studio.import.ownRestored':
    '{name} is yours. It is back in your looks, and open here to keep working on.',
  'studio.import.unreadable': 'That file is not a FluidEQ scene.',
  'studio.import.changed':
    'That file was changed after it was exported, so FluidEQ will not play it.',
  'studio.import.blocked': 'That scene has been taken down.',

  'studio.idea.pet.label': 'My pet, alive',
  'studio.idea.pet.text':
    "My pet's photo, alive with the music. It breathes gently with the bass, a soft rim of light traces its outline on every beat, its colours warm with the mids, and tiny sparkles rise around it with the treble. On each big moment, a burst of confetti blooms behind it in a new colour. In silence it only breathes, slowly. Sliders for glow, sparkles and how much it moves. Around the app in Ambient mode: little paw prints and hearts drifting by.",
  'studio.idea.city.label': 'Neon city',
  'studio.idea.city.text':
    "A neon city at night after the rain. The skyline is my spectrum: each tower rises with its own part of the music, bass on the left and treble on the right, standing where my wave's height and position put it. Windows flicker on with the mids, rooftop beacons blink on the beat, and on each big moment a train crosses the bridge in front. The wet street mirrors it all and ripples with the waveform. In silence only the traffic crawls. Sliders for rain, windows and neon glow. Around the app in Ambient mode: soft city lights drifting like bokeh.",
  'studio.idea.sea.label': 'Deep sea',
  'studio.idea.sea.text':
    "Deep in the ocean at night. A glowing jellyfish floats inside my wave, its bell pulsing with the bass and its long tentacles swaying with the mids, while plankton sparkles with the treble and faint light rays drift down from above. A small school of fish darts past on the beat, and on each big moment a whale's shadow glides across the back. Everything slows to a calm drift in silence. Sliders for glow, depth and how many jellyfish. Around the app in Ambient mode: bubbles rising slowly.",
  'studio.idea.vinyl.label': 'Vinyl',
  'studio.idea.vinyl.text':
    "A record player seen from above, in a dim, warm room. The record spins at a steady speed and its grooves light up in rings, bass near the label and treble at the edge. The stylus glows and throws tiny sparks on every beat, the label's colours shift with the mids, and dust floats in the lamp light with the treble. On each big moment a ring of light sweeps out across the record. In silence it keeps turning, softly lit. Sliders for spin speed, glow and dust. Around the app in Ambient mode: musical notes drifting upward.",
  'studio.idea.fire.label': 'Campfire',
  'studio.idea.fire.text':
    'A campfire in a pine forest under the stars. The flames are my spectrum, standing in my wave: each tongue of fire leaps with its own part of the music. Embers fly up on the hi-hats, the logs glow deeper with the bass, the trees around catch the firelight with the mids, and the stars twinkle with the treble. On each big moment a spiral of sparks climbs into the night. In silence it burns low and steady. Sliders for fire size, embers and smoke. Around the app in Ambient mode: fireflies wandering and a few sparks rising.',
  'studio.idea.sunset.label': 'Golden hour',
  'studio.idea.sunset.text':
    'A mountain valley at golden hour. The far ridgelines are my spectrum, rising and settling with their own parts of the music inside my wave, fading into haze with distance. The low sun swells softly with the bass, the clouds blush with the mids, and the river below glitters with the treble. On each big moment a flock of birds sweeps across the sun, a different way each time. In silence only the clouds drift. Sliders for sun height, haze and clouds. Around the app in Ambient mode: a few birds gliding across now and then.',

  'studio.prompt.label': 'The AI prompt',
  'studio.prompt.ideaHere': '← your idea goes here',

  'studio.hears.level': 'overall loudness',
  'studio.hears.beat': 'a pulse on every beat',
  'studio.hears.bass': 'the low end, on its own',
  'studio.hears.mid': 'voices and chords',
  'studio.hears.treble': 'hi-hats and air',
  'studio.hears.spectrum': 'every frequency, fast or smooth',
  'studio.hears.accent': 'a rare big moment, every few seconds',

  'studio.status.live': 'Updated from your last save',
  'studio.status.problem': 'The last working version is still playing',
  'studio.status.waiting': 'Waiting for a version that plays',
  'studio.empty': 'Nothing to show yet',
  'studio.stage.label': '{name}, playing live',
  'studio.stage.resize': 'Drag to resize the preview',
  'studio.stage.startTitle': 'Your scene plays here',
  'studio.stage.startBody':
    'Start a project and FluidEQ makes its folder, with a scene that already moves. Your AI changes it from there.',

  'studio.meters.title': 'What it hears now',
  'studio.meter.level': 'Level',
  'studio.meter.beat': 'Beat',
  'studio.meter.bass': 'Bass',
  'studio.meter.mid': 'Mids',
  'studio.meter.treble': 'Treble',
  'studio.meter.accent': 'Accent',

  'studio.test.title': 'Trying the scene',
  'studio.ship.title': 'When it’s ready',
  'studio.signals.title': 'Preview audio',
  'studio.signals.hint':
    'Listeners always see the scene react to their own music. Test signals only drive this preview: they are not saved or published and never change your audio.',
  'studio.signal.live': 'Your music',
  'studio.signal.silence': 'Silence',
  'studio.signal.bass': 'Bass',
  'studio.signal.mid': 'Mids',
  'studio.signal.treble': 'Treble',
  'studio.signal.beat': 'Beat',
  'studio.signal.accent': 'Accent',
  'studio.signal.showcase': 'Simulated mix',
  'studio.signalHint.live':
    'What is playing on this computer, as the scene will hear it on the graph.',
  'studio.signalHint.silence':
    'Nothing at all. A good scene rests here, with only a slow drift.',
  'studio.signalHint.bass':
    'Only the bass of what is playing. Shows what moves with the low end.',
  'studio.signalHint.mid':
    'Only the mids of what is playing: voices and chords.',
  'studio.signalHint.treble':
    'Only the treble of what is playing: hi-hats and air.',
  'studio.signalHint.beat': 'A kick on every beat, at 118 BPM.',
  'studio.signalHint.accent':
    'One big moment every 7.5 seconds, like a chorus hitting.',
  'studio.signalHint.showcase':
    'Every channel busy at once, as when a cover is taken.',
  'studio.meters.heard': 'played',
  'studio.meters.got': 'what the scene gets',

  // The scene's settings: its own controls, and how it answers the music.
  'studio.settings.title': 'Scene settings',
  'studio.settings.controls': 'Its controls',
  'studio.settings.controlsLead':
    'The sliders this scene brings, named as its code names them.',
  'studio.settings.response': 'How it answers the music',
  'studio.settings.responseLead':
    'Bend what it hears before it hears it. At 100% and zero it hears the music as it is.',
  'studio.settings.ambient': 'Elements in the window',
  'studio.settings.ambientLead':
    'What this scene adds around the app in the Ambient mode.',
  'studio.settings.sensitivity': 'Sensitivity',
  'studio.settings.sensitivityHint':
    'How strongly it reacts. More for a quiet track, less when a loud one keeps it pinned.',
  'studio.settings.threshold': 'Threshold',
  'studio.settings.thresholdHint':
    'Below this it hears nothing, so it can rest through the quiet parts.',
  'studio.settings.attack': 'Attack',
  'studio.settings.attackHint':
    'How fast it rises to what it hears. Short is punchy, long swells.',
  'studio.settings.release': 'Release',
  'studio.settings.releaseHint':
    'How slowly it falls back. Long leaves a glow after each hit.',
  'studio.settings.percent': '{percent}%',
  'studio.settings.ms': '{ms} ms',
  'studio.settings.reset': 'Reset',
  'studio.settings.resetsToScene':
    'Reset puts these back to the scene’s own settings.',
  'studio.settings.resetsToPublished':
    'Reset puts these back to version {version}, the one you published.',
  'studio.settings.carries':
    'Saved into the scene when you let go: your looks and the gallery get it too.',
  'studio.settings.saving': 'Saving into the scene…',
  'studio.settings.saved': 'Saved into the scene.',
  'studio.settings.savedLook': 'Saved into the scene and your look of it.',
  'studio.settings.failed': 'The settings could not be saved. Try again.',

  // Framing a photo into one of the scene's pictures.
  'studio.picture.adjust': 'Frame…',
  'studio.framing.title': 'Frame “{name}”',
  'studio.framing.hint':
    'Drag to move the photo. Scroll or use the slider to zoom.',
  'studio.framing.stage':
    '{name} in its place. The arrow keys move the photo, plus and minus zoom.',
  'studio.framing.role': 'photo framing',
  'studio.framing.fit': 'How the photo fits',
  'studio.framing.cover': 'Fill the space',
  'studio.framing.contain': 'Whole photo',
  'studio.framing.zoom': 'Zoom',
  'studio.framing.percent': '{percent}%',
  'studio.framing.reset': 'As the scene suggests',
  'studio.framing.another': 'Another photo…',
  'studio.framing.cancel': 'Cancel',
  'studio.framing.use': 'Use this photo',
  'studio.framing.saving': 'Saving…',

  'studio.size.title': 'Size',
  'studio.size.graph': 'Graph',
  'studio.size.narrow': 'Narrow',
  'studio.size.wide': 'Wide',
  'studio.size.full': 'Fullscreen',
  'studio.size.exit': 'Exit fullscreen',
  'studio.wave.title': 'Wave on the graph',
  'studio.wave.hint':
    'Saved into the scene and published with it, so it opens as you left it. Anyone using it can still change these under View on the graph, and put yours back. Try the extremes: a low wave, or one lifted to the middle.',

  // A switch under the size: the whole app in the colour of the scene on the
  // stage, for judging it as a theme without leaving the Studio.
  'studio.tint.label': 'FluidEQ with this scene',
  'studio.tint.hint':
    'While you work here, the whole app can take the scene’s colours, or glow softly around it with the music, so you can see and feel it as a theme.',
  'studio.grid.label': 'Show the graph grid',
  'studio.grid.hint':
    'Its frequency and level lines over the scene, with the room they take on the graph, so you can measure where the wave and each part of the scene land.',

  'studio.performance.title': 'Performance',
  'studio.performance.hint':
    'One choice for the graph, this stage and the desktop: the same rows as the graph’s menu.',
  'studio.cost.full': 'Runs smoothly',
  'studio.cost.reading': '{ms} ms · {fps} fps · {size}%',
  'studio.cost.readingRate': '{fps} fps · {size}%',
  'studio.cost.scaled': 'Drawn at {percent}% size',
  'studio.cost.heavy': 'Too heavy for this computer',
  'studio.cost.unavailable': "This computer can't draw scenes right now",

  'studio.file.pack': 'pack.json',
  'studio.file.source': 'The shader',
  'studio.file.artwork': 'The picture',
  'studio.problem.heading': 'This version cannot play yet',
  'studio.problem.line': '{file}, line {line}',
  'studio.problem.too-large': 'The shader is over 64 KB.',
  'studio.problem.unterminated-comment': 'A /* comment is never closed.',
  'studio.problem.preprocessor':
    'Lines that start with # are not allowed. Use const instead of #define.',
  'studio.problem.non-ascii':
    'Only plain ASCII characters are allowed outside comments.',
  'studio.problem.while':
    'while loops are not allowed. Use a for loop with a fixed count.',
  'studio.problem.do':
    'do loops are not allowed. Use a for loop with a fixed count.',
  'studio.problem.main': 'A scene must not define main(). FluidEQ writes it.',
  'studio.problem.loop-shape':
    'A loop must count from one fixed number to another.',
  'studio.problem.loop-bound': 'A loop runs more than 128 times.',
  'studio.problem.loop-assign': 'A loop changes its own counter inside it.',
  'studio.problem.loop-budget':
    'Loops inside loops, and the functions they call, run too many times per pixel. Nest less or use fewer turns.',
  'studio.problem.entry-point':
    'There is no vec4 sceneColour(vec2 uv) function.',
  'studio.problem.not-a-pack': 'This is not a scene FluidEQ can read.',
  'studio.problem.bad-id':
    'The id must be 2 to 48 lowercase letters, digits and dashes.',
  'studio.problem.names-missing': 'An English name is required.',
  'studio.problem.name-too-long': 'A name is longer than 40 characters.',
  'studio.problem.bad-fallback':
    'fallbackStyle is not one of the looks FluidEQ has.',
  'studio.problem.bad-swatch': 'swatch needs 2 to 4 colours like #00e5cf.',
  'studio.problem.bad-artwork':
    'The picture is not a WebP of the size pack.json gives.',
  'studio.problem.contract-too-new':
    'This scene was written for a newer FluidEQ. Update the app.',
  'studio.problem.bad-param':
    'A control in params needs an id of a-z, 0-9 and _, an English name, and a min below its max.',
  'studio.problem.too-many-params':
    'A scene can have at most 8 controls in params.',
  'studio.problem.bad-ambient':
    'Some ambient elements or controls in pack.json were left out. Check their shapes, motions, colours, counts and what each control moves.',
  'studio.problem.bad-json': 'pack.json is not valid JSON.',
  'studio.problem.missing-file': 'A file the scene needs is missing.',
  'studio.problem.unsafe-path':
    'File names must be plain names of files in this folder.',
  'studio.problem.file-too-large': 'A file is larger than a scene allows.',
  'studio.compile.heading': 'The shader did not compile',
  'studio.compile.hint': 'Fix it and save, or paste the error into your AI.',
  'studio.heavy.body':
    "It couldn't keep smooth motion even at an eighth of its size, so FluidEQ stopped it before it could freeze the screen. Try fewer loop steps, fewer texture reads, or fewer layers.",

  // The code pane under the stage.
  'studio.code.title': 'Code',
  'studio.code.label': 'Code of {file}',
  'studio.code.watching': 'Updates as it is saved',
  'studio.code.unsaved': 'Not saved',
  'studio.code.save': 'Save',
  'studio.code.saving': 'Saving…',
  'studio.code.failed': 'It could not be saved. Try again.',
  'studio.code.tooLarge': 'A scene can be at most 64 KB. It was not saved.',
  'studio.code.changed':
    'The file changed outside the Studio while you were typing here.',
  'studio.code.load': 'Load the new version',
  'studio.code.keep': 'Keep my edits',
  'studio.code.missing': 'This project has no scene file to show yet.',
  'studio.code.showChanges': 'Show changes',
  'studio.code.showCode': 'Back to the code',
  'studio.code.updatedAt': 'Changed outside at {time}',
  'studio.code.unchanged': '{count} unchanged lines',
  'studio.code.delta': '{added} lines added, {removed} removed',
} as const;

export default studio;
