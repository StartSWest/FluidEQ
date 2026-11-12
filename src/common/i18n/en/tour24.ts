// What's New for 2.4 (`renderer/components/featureTour/release24.tsx`): the
// Studio's animations, pictures, stage, AI and scene controls, the
// visualizers' camera, and the rest of the release under it. Apart from
// `tour.ts`, which was already past the size a file is held to.
const tour24 = {
  'tour.animations.kicker': 'STUDIO · ANIMATIONS',
  'tour.animations.title': 'Pictures that move, checked frame by frame',
  'tour.animations.subtitle': 'Every animation in a scene, frame by frame',
  'tour.animations.lead':
    'Ask the scene’s chat to animate a picture: it bends one into photo-real frames or uses what your own Claude can reach, then lays them out as a sheet and checks every frame.',
  'tour.animations.point1':
    'Play one on Ground, Sky or Water, uphill or downhill, at any speed, frame by frame, or bigger over the whole Studio.',
  'tour.animations.point2':
    'Import sheets, atlas JSON, GIF, APNG, WebP, Aseprite files or numbered pictures; each one plays in the tab before it is added.',
  'tour.animations.point3':
    'Every new project starts with a moon in its orb and a swallow flying over it, so pictures and animations are there to learn from on day one.',
  'tour.animations.how':
    'Open Visualizers, then the Studio, and choose Animations under the stage. Ask the chat to animate a picture in your scene.',
  'tour.animations.open': 'Open Visualizers',
  'tour.animations.imageAlt':
    'The Studio’s Animations tab with a swallow beating its wings on the Sky background and its eight frames in a strip, above the scene’s chat finding the frame that jumps.',
  'tour.animations.task': 'Check the swallow’s flight frame by frame.',
  'tour.animations.stepLook': 'Looked at all {count} frames side by side',
  'tour.animations.stepJump': 'Frame {frame} jumps above the others',
  'tour.animations.stepFix': 'Moved frame {frame} back in line with the rest',
  'tour.animations.reply':
    'The flight reads smoothly now: every frame sits on the same line.',
  'tour.pictures.kicker': 'STUDIO · PICTURES',
  'tour.pictures.title': 'See every picture, mark it, send it back',
  'tour.pictures.subtitle': 'Zoom, copy and draw on pictures in the chat',
  'tour.pictures.lead':
    'Every picture your AI opens or works with shows right in the chat. Click one to see it large, and zoom in as far as you like.',
  'tour.pictures.point1':
    'Draw on it where you are zoomed in: circle a spot, point an arrow, write a word or crop to the part that matters, then attach it to your next message.',
  'tour.pictures.point2':
    'Copy any picture with its button, Ctrl+C or a right click, and paste it wherever you like.',
  'tour.pictures.point3':
    'Your marks go with the picture, so the AI sees exactly what you mean.',
  'tour.pictures.how':
    'In the Studio’s chat, click a picture to open it. Press Draw to mark it, then Attach to chat.',
  'tour.pictures.open': 'Open Visualizers',
  'tour.pictures.imageAlt':
    'A moon picture opened large and zoomed in, a ring drawn round a crater with an arrow and a word, the crop box closing in, and the Copy image and Attach to chat buttons, beside the chat it came from.',
  'tour.pictures.ask': 'Put this moon in the orb, glowing at the edge.',
  'tour.pictures.reply':
    'Done: it glows at the edge, and it’s in Pictures too.',
  'tour.pictures.mark': 'brighter',
  'tour.pictures.followUp': 'Make this crater glow on the bass.',

  'tour.stage.kicker': 'STUDIO · THE STAGE',
  'tour.stage.title': 'Try your scene where it will play',
  'tour.stage.subtitle': 'Ultra-wide graph, Compact player, Calm and Music',
  'tour.stage.lead':
    'The stage shows your scene the way people will see it: as an ultra-wide graph, or in the Compact player’s column with the player’s song and controls over it.',
  'tour.stage.point1':
    'Zoom in and move around the stage. Your AI is shown exactly what the stage shows, so “this part” means this part.',
  'tour.stage.point2':
    'One press on the stage swaps the music for Calm, the slow animation a desktop background plays.',
  'tour.stage.point3':
    'With nothing playing, the scene moves to the demo song, so it is never standing still while you work.',
  'tour.stage.how':
    'In the Studio, pick a shape in the stage’s size menu. The Music and Calm button is on the stage itself.',
  'tour.stage.open': 'Open Visualizers',
  'tour.stage.imageAlt':
    'The Alpine scene on the Studio stage, zooming in with a frame marking what the AI sees and the Music and Calm button on it, beside the same scene as an ultra-wide graph and in the Compact player with its controls on top.',
  'tour.stage.agentSees': 'What the AI sees',

  'tour.ai.kicker': 'STUDIO · YOUR AI',
  'tour.ai.title': 'An AI that works on all your scenes',
  'tour.ai.subtitle': 'Several scenes at once, your own plugins, any model',
  'tour.ai.lead':
    'Your AI now works on several scenes at once, each in its own chat, and uses less of your Claude plan to do it.',
  'tour.ai.point1':
    'It works with whatever your own Claude has, your plugins, tools and commands, and asks first before it uses anything new.',
  'tour.ai.point2':
    'FluidEQ’s own skills for 3D worlds, photos in 3D and animation come with the app and are always up to date.',
  'tour.ai.point3':
    'Choose the model and the effort for each chat. The list follows Claude Code, so new models appear as soon as they arrive.',
  'tour.ai.how':
    'Open a scene in the Studio and write in its chat. The model and the effort are under the box you write in.',
  'tour.ai.open': 'Open Visualizers',
  'tour.ai.imageAlt':
    'Three scenes being worked on at once, two still in progress and one kept as version 7, above FluidEQ’s skills, beside what the AI works with and the menu for model and effort.',
  'tour.ai.skills': 'FluidEQ’s skills',
  'tour.ai.skillWorlds': '3D worlds',
  'tour.ai.skillPhotos': 'Photos in 3D',
  'tour.ai.skillAnimation': 'Animation',
  'tour.ai.claudeTitle': 'Works with your own Claude',
  'tour.ai.claudePlugins': 'Your plugins',
  'tour.ai.claudeTools': 'Your tools and commands',
  'tour.ai.claudeAsks': 'Asks first before anything new',
  'tour.controls.kicker': 'SCENES',
  'tour.controls.title': 'Scenes you can make your own',
  'tour.controls.subtitle': 'Palettes, choices, 3D worlds and kept versions',
  'tour.controls.lead':
    'A scene can now hand you colour palettes, choices with icons, a single colour, and controls that appear only for the options that use them.',
  'tour.controls.point1':
    '3D worlds get bent cylinders and cones and a real floor, and scenes publish with sharper preview clips, by daylight, to the demo song.',
  'tour.controls.point2':
    'The publish screen shows how heavy your scene is. Its version goes up only when you publish, and the status line says which version you are on.',
  'tour.controls.point3':
    'The Gallery keeps the last 10 versions of each scene, and you can save any of them on this computer from the scene’s page.',
  'tour.controls.how':
    'Open a scene’s Tune tab in the Studio. A scene’s versions are on its page in the Gallery.',
  'tour.controls.open': 'Open Visualizers',
  'tour.controls.imageAlt':
    'The Tune tab with two colour palettes and a weather choice moving through Clear, Rain and Snow, with a snowfall slider that appears for Snow, beside a scene’s page with its package size, its version and the versions kept.',
  'tour.controls.weather': 'Weather',
  'tour.controls.clear': 'Clear',
  'tour.controls.rain': 'Rain',
  'tour.controls.snow': 'Snow',
  'tour.controls.glow': 'Moon glow',
  'tour.controls.snowfall': 'Snowfall',

  'tour.camera.kicker': 'VISUALIZERS',
  'tour.camera.title': 'Move around a scene, on the graph and the desktop',
  'tour.camera.subtitle':
    'Your camera key, and a desktop that answers the mouse',
  'tour.camera.lead':
    'Choose the key that moves a 3D scene’s camera — Ctrl, Alt, Shift or any key you like — and whether you hold and drag, or just hold and move.',
  'tour.camera.point1':
    'Turn on Follow the mouse and the scene leans after your pointer, or let it Circle by itself. Reset view shows only while you hold the key.',
  'tour.camera.point2':
    'A visualizer on your desktop answers the mouse over the empty desktop, each monitor keeps its own time of day, and Set on desktop puts your newest Studio version there.',
  'tour.camera.point3':
    'Beat flashes land on the kick, Gallery previews move to the demo song while nothing plays, and a scene that breaks plays its last working version instead of the plain look.',
  'tour.camera.how':
    'The camera’s settings are in the graph’s View menu, under the scene.',
  'tour.camera.open': 'Open EQ',
  'tour.camera.imageAlt':
    'Two monitors with a visualizer on each desktop: on the first the scene leans after the pointer and Reset view shows while Ctrl is held, each with its own time of day, above the camera’s settings.',

  'tour.v24.also': 'Also in 2.4',
  'tour.v24.heroes':
    'Heroes of the Storm has a fuller mix of its own with optional Wide Stage, and the Game filter keeps music steadier while it brings out cues.',
  'tour.v24.graphSettings':
    'The graph keeps separate settings for standard looks and for visualizers.',
  'tour.v24.colourful':
    'Colourful mode takes the colours of the scene on the graph.',
  'tour.v24.gallery': 'The Gallery opens on its newest scenes.',
  'tour.v24.credits': 'Credits you buy in the browser arrive by themselves.',
  'tour.v24.sponsors':
    'Support FluidEQ through GitHub Sponsors, from About or the Support page.',
  'tour.v24.crashes':
    'If FluidEQ ever crashes, a record is kept on this computer only, for a bug report you choose to send.',
  'tour.visualsTitle': "What's new in Visualizers",
  'tour.rail.alwaysVisuals': 'ALSO IN VISUALIZERS',
  'visuals.news.open': "What's new",
  'visuals.news.blurb': 'Visualizers, Studio and lighting',
  'visuals.news.title': 'New in Visualizers {version}',
  'visuals.news.see': "See what's new",
  'visuals.news.later': 'Not now',

  'tour.level.kicker': 'DSP PRESETS',
  'tour.level.title': 'Presets at your song’s own level',
  'tour.level.subtitle': 'No loud starts, a level that stays',
  'tour.level.lead':
    'The factory DSP presets no longer level a song before their stages: each hears the music as it arrives, and the Maximizer adds a fixed gain and catches the peaks.',
  'tour.level.point1':
    'Switching away from a preset that adjusts its gain as it plays no longer carries that boost into the next sound.',
  'tour.level.point2':
    'No loud start after a pause: a song comes back in at its own level after silence.',
  'tour.level.point3':
    'Auto normalize on the EQ’s preamp keeps its level when Windows reopens an output, instead of starting over.',
  'tour.level.how':
    'A rack you already have keeps its settings until you pick its factory preset again on the DSP page.',
  'tour.level.open': 'Open DSP',

  'tour.edit.kicker': 'STUDIO · EDIT MODE',
  'tour.edit.title': 'Move things in your scene by hand',
  'tour.edit.subtitle':
    'Everything locked until you free it, nothing kept until Save',
  'tour.edit.lead':
    'Press Edit on the stage and pick anything in a 3D scene: a shape, a light, a 3D model or a group. Everything starts locked, so nothing moves by accident; one press on its lock frees it.',
  'tour.edit.point1':
    'Move, turn or resize it with its handles, with Snap for quarter steps and 15° turns. Hold Space to move the canvas, and Edit mode stays open in every view of the stage, the Ultra-wide graph and the Compact player included.',
  'tour.edit.point2':
    'Everything is in one list to search, rename, group, lock, solo and hide. Solo and Hide are for working only and never change the scene for listeners, and Solo is marked even inside a group.',
  'tour.edit.point3':
    'Nothing touches your scene until you press Save. Discard throws the changes away, and Undo and Redo step through them.',
  'tour.edit.how': 'Open a 3D scene in the Studio and press Edit on its stage.',
  'tour.edit.open': 'Open Visualizers',
  'tour.edit.imageAlt':
    'A scene on the Studio’s stage with one shape picked, its lock open and its handles out, the Move, Turn and Resize tools above it, and the list beside it with everything else locked and the picked shape shown alone.',
  'tour.watch.kicker': 'STUDIO · YOUR AI',
  'tour.watch.title': 'An AI that watches your scene move',
  'tour.watch.subtitle': 'Frames along the music, three views, the song',
  'tour.watch.lead':
    'Your AI no longer judges a scene from one picture. It watches it move and checks it the ways a listener will see it.',
  'tour.watch.point1':
    'A few frames along the music, side by side, to see which way a thing moves and whether it moves evenly.',
  'tour.watch.point2':
    'The standard graph, the ultra-wide graph and the Compact player’s whole column at the same moment, so nothing is cut off or left black.',
  'tour.watch.point3':
    'Six moments of the test song, from silence to the drop, to check that the drop shows, and how dark the night is at Daylight 0.',
  'tour.watch.how':
    'Ask the scene’s chat for a change. It looks at its work this way every time.',
  'tour.watch.open': 'Open Visualizers',
  'tour.watch.imageAlt':
    'Five frames of a scene along the music with how it moves, the scene in the standard, ultra-wide and Compact player views, and six moments of the test song from silence to the drop.',
  'tour.watch.frames': 'Frames along the music',
  'tour.watch.moves': 'Moves right, evenly',
  'tour.watch.standard': 'Standard',
  'tour.watch.song': 'Song check',
  'tour.watch.silence': 'Silence',
  'tour.watch.verse': 'Verse',
  'tour.watch.build': 'Build',
  'tour.watch.drop': 'Drop',
  'tour.watch.dropShows': 'The drop shows',
  'tour.watch.night': 'Night: {value}% lit',
  'tour.makers.kicker': 'STUDIO · PICTURES',
  'tour.makers.title': 'Now integrated with Higgsfield',
  'tour.makers.subtitle': 'Pictures and animations for your scenes',
  'tour.makers.lead':
    'The Studio’s AI creates pictures and animations for your scenes with Higgsfield.',
  'tour.makers.point1':
    'It uses your own Higgsfield account, set up once in the chat’s Accounts.',
  'tour.makers.point2':
    'Before anything is made, it tells you what it costs and asks you first.',
  'tour.makers.point3': 'A video it makes becomes an animation in your scene.',
  'tour.makers.how': 'Open a scene’s chat in the Studio and press Accounts.',
  'tour.makers.open': 'Open Visualizers',
  'tour.makers.imageAlt':
    'A scene’s chat asking you to allow Higgsfield before it makes an animation, beside the Accounts list with Claude and Higgsfield.',
  'tour.makers.request': 'Make the koi a swimming animation',
  'tour.code.kicker': 'STUDIO · CODE',
  'tour.code.title': 'Every file of your scene in the Code tab',
  'tour.code.subtitle':
    'Shader, world, materials, animations, and notes you can edit',
  'tour.code.lead':
    'The Code tab shows the whole scene, not only its shader: its pack, its 3D world and the materials it names, its animations, and its notes, which you edit as two plain fields and keep with Save.',
  'tour.code.point1':
    'Each file folds to its name and its count of lines, and Expand all opens them together.',
  'tour.code.point2':
    'It follows the files as your AI saves them, and Show changes marks what changed.',
  'tour.code.point3':
    'A sheet of frames your AI packed as a plain picture becomes a real animation, in the Animations tab.',
  'tour.code.how':
    'Open a scene in the Studio and choose Code under the stage.',
  'tour.code.open': 'Open Visualizers',
  'tour.code.imageAlt':
    'The Code tab with the scene’s files folded to their names and one material of its 3D world open.',
  'tour.v25.also': 'Also in 2.5',
  'tour.v25.recover':
    'A desktop background or the Compact player puts a scene that will not build right from your Studio project or the Gallery’s copy.',
  'tour.v25.never':
    'A scene that will not play is never swapped for another look: the graph says why and offers Try again.',
  'tour.v25.copy':
    'Another member’s scene opened in the Studio is a locked copy, and its chat asks before every command.',
  'tour.v25.review':
    'A scene that was not approved shows the reviewer’s reason beside its name.',
  'tour.v25.publish': 'No monthly limit on publishing.',
  'tour.signed.kicker': 'FLUIDEQ 2.5',
  'tour.signed.title': 'Now signed, for free!',
  'tour.signed.subtitle': 'The road so far, and a signed FluidEQ for everyone',
  'tour.signed.today':
    'Today it is one equaliser for everything your computer plays, a player for your own music, and visualizers that move with it.',
  'tour.signed.liveFor': 'FluidEQ has been live for',
  'tour.signed.since': 'Began on {date}',
  'tour.signed.roadTitle': 'The road so far',
  'tour.signed.intro':
    'FluidEQ began on 2 August 2026, and its first release, 0.4.0, came two days later. Since then it has grown its own audio engine inside Windows, a DSP rack for everything you hear, a Library and player for your music, visualizers with a gallery, a Studio for making scenes of your own, and twelve languages. A build signed by its developer is a milestone on that road.',
  'tour.signed.thanks':
    'Thank you to everyone who uses FluidEQ, reports what goes wrong, publishes scenes and writes in the forum. It is better for every one of you.',
  'tour.signed.signedTitle': 'Signed by its developer',
  'tour.signed.signedBody':
    'When you run its installer, Windows names the publisher: {publisher}.',
  'tour.signed.updatesTitle': 'It keeps updating itself',
  'tour.signed.updatesBody':
    'Each new version arrives by itself, and FluidEQ tells you when it is ready. Your settings stay.',
  'tour.signed.freeTitle': 'Free for everyone',
  'tour.signed.freeBody':
    'One FluidEQ, the same for everybody. The app costs nothing and needs no activation.',
  'tour.signed.unit.day.one': 'day',
  'tour.signed.unit.day.few': 'days',
  'tour.signed.unit.day.many': 'days',
  'tour.signed.unit.day.other': 'days',
  'tour.signed.unit.hour.one': 'hour',
  'tour.signed.unit.hour.few': 'hours',
  'tour.signed.unit.hour.many': 'hours',
  'tour.signed.unit.hour.other': 'hours',
  'tour.signed.unit.minute.one': 'minute',
  'tour.signed.unit.minute.few': 'minutes',
  'tour.signed.unit.minute.many': 'minutes',
  'tour.signed.unit.minute.other': 'minutes',
  'tour.signed.unit.second.one': 'second',
  'tour.signed.unit.second.few': 'seconds',
  'tour.signed.unit.second.many': 'seconds',
  'tour.signed.unit.second.other': 'seconds',
} as const;

export default tour24;
