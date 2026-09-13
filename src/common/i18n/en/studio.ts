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

  'studio.gate.title':
    'Build your own scenes, and play the ones other members make',
  'studio.gate.body':
    'The Studio is part of FluidEQ Plus. Describe a scene to your AI and watch it come alive on your music while it writes it.',
  'studio.gate.cta': 'See Plus',

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
  'studio.action.publish': 'Publish…',
  'studio.action.import': 'Open a scene file…',

  'studio.project.label': 'Project',
  'studio.project.group': 'Your projects',
  'studio.project.none': 'Choose a project',
  'studio.project.empty': 'No project yet',
  'studio.project.add': 'Open a folder…',
  'studio.project.forget': 'Remove {name} from the list',
  'studio.project.new': 'New project…',
  'studio.project.forgetHint':
    'The folder and its files stay on your computer.',

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
  'studio.publish.category': 'Category',
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
    "My pet's photo, alive with the music. It breathes with the bass, a soft glow traces its outline on every beat, its colours warm with the mids, and sparkles drift up with the treble.",
  'studio.idea.city.label': 'Neon city',
  'studio.idea.city.text':
    'A neon city at night. Each building is a band of the spectrum, windows light with the mids, and a train crosses the skyline on each musical accent.',
  'studio.idea.sea.label': 'Deep sea',
  'studio.idea.sea.text':
    'Deep sea. Jellyfish pulse with the bass, plankton sparkle with the treble, and light rays sway with the overall level.',
  'studio.idea.vinyl.label': 'Vinyl',
  'studio.idea.vinyl.text':
    'A spinning vinyl record seen from above. The grooves glow from the waveform and the needle throws sparks on beats.',
  'studio.idea.fire.label': 'Campfire',
  'studio.idea.fire.text':
    'A campfire under stars. The flames are the spectrum, embers fly up on hi-hats, the stars twinkle with the treble.',
  'studio.idea.aurora.label': 'Northern lights',
  'studio.idea.aurora.text':
    'Northern lights over a lake. The curtains follow the slow spectrum, their reflection ripples with the waveform, a shooting star crosses on each accent.',

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

  'studio.signals.title': 'Test with',
  'studio.signals.hint':
    'Test signals only drive the stage. Your music is never touched.',
  'studio.signal.live': 'Live music',
  'studio.signal.silence': 'Silence',
  'studio.signal.bass': 'Bass',
  'studio.signal.mid': 'Mids',
  'studio.signal.treble': 'Treble',
  'studio.signal.beat': 'Beat',
  'studio.signal.accent': 'Accent',
  'studio.signal.showcase': 'Everything',
  'studio.signalHint.live':
    'What is playing on this computer, as the scene will hear it on the graph.',
  'studio.signalHint.silence':
    'Nothing at all. A good scene rests here, with only a slow drift.',
  'studio.signalHint.bass':
    'Only a steady bass. Shows what moves with the low end.',
  'studio.signalHint.mid': 'Only the mids: voices and chords.',
  'studio.signalHint.treble': 'Only hi-hats and air, ticking.',
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
    'Anyone using the scene can change these under View on the graph. Try the extremes: a low wave, or one lifted to the middle.',
  'studio.wave.fixed':
    'This scene reserves its own band for the spectrum, so these two do not change it.',
  'studio.grid.label': 'Show the graph grid',
  'studio.grid.hint':
    'Its frequency and level lines over the scene, with the room they take on the graph, so you can measure where the wave and each part of the scene land.',

  'studio.cost.full': 'Runs smoothly',
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
