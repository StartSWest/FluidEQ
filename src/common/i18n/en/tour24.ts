// What's New for 2.4 (`renderer/components/featureTour/release24.tsx`): the
// Studio's animations, pictures, stage, AI and scene controls, the
// visualizers' camera, and the rest of the release under it. Apart from
// `tour.ts`, which was already past the size a file is held to.
const tour24 = {
  'tour.animations.kicker': 'STUDIO · ANIMATIONS',
  'tour.animations.title': 'Creatures that move, drawn by your AI',
  'tour.animations.subtitle': 'Every animation in a scene, frame by frame',
  'tour.animations.lead':
    'Ask for a bird, a fish or a dancer, and your AI draws it frame by frame into the scene. The Animations tab plays them all.',
  'tour.animations.point1':
    'Play one on Ground, Sky or Water, uphill or downhill, at any speed, frame by frame, or bigger over the whole Studio.',
  'tour.animations.point2':
    'Each animation has its own animator, a chat beside it: it looks at every frame at once, finds the one that floats or jumps, and draws it again.',
  'tour.animations.point3':
    'Every new project starts with a moon in its orb and a swallow flying over it, so pictures and animations are there to learn from on day one.',
  'tour.animations.how':
    'Open Visualizers, then the Studio, and choose Animations under the stage. Ask the chat for an animation in your own words.',
  'tour.animations.open': 'Open Visualizers',
  'tour.animations.imageAlt':
    'The Studio’s Animations tab with a swallow beating its wings on the Sky background and its eight frames in a strip, beside its animator’s chat finding the frame that jumps.',
  'tour.animations.task': 'make the swallow glide between wing beats',
  'tour.animations.stepLook': 'Looked at all {count} frames side by side',
  'tour.animations.stepJump': 'Frame {frame} jumps above the others',
  'tour.animations.stepFix': 'Drew frame {frame} again, in line with the rest',
  'tour.animations.reply':
    'The glide reads now: the wings stay open a beat longer, and no frame jumps.',

  'tour.pictures.kicker': 'STUDIO · PICTURES',
  'tour.pictures.title': 'See every picture, mark it, send it back',
  'tour.pictures.subtitle': 'Zoom, copy and draw on pictures in the chat',
  'tour.pictures.lead':
    'Every picture your AI makes or opens shows right in the chat. Click one to see it large, and zoom in as far as you like.',
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
  'tour.pictures.ask': 'A moon for the orb, glowing at the edge.',
  'tour.pictures.reply': 'Here it is. You’ll find it in Pictures too.',
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
  'tour.ai.subtitle':
    'Several scenes at once, in the scene’s folder, any model',
  'tour.ai.lead':
    'Your AI now works on several scenes at once, each in its own chat, and uses less of your Claude plan to do it.',
  'tour.ai.point1':
    'It works only with the scene’s own files, inside its folder, and cannot touch anything else on your computer. When it wants to make a picture with ChatGPT, it asks first on a card in the chat.',
  'tour.ai.point2':
    'FluidEQ’s own skills for 3D worlds, photos in 3D and animation come with the app and are always up to date.',
  'tour.ai.point3':
    'Choose the model and the effort for each chat. The list follows Claude Code, so new models appear as soon as they arrive.',
  'tour.ai.how':
    'Open a scene in the Studio and write in its chat. The model and the effort are under the box you write in.',
  'tour.ai.open': 'Open Visualizers',
  'tour.ai.imageAlt':
    'Three scenes being worked on at once, two still in progress and one kept as version 7, above FluidEQ’s skills, beside a card asking to make a picture with ChatGPT and the menu for model and effort.',
  'tour.ai.skills': 'FluidEQ’s skills',
  'tour.ai.skillWorlds': '3D worlds',
  'tour.ai.skillPhotos': 'Photos in 3D',
  'tour.ai.skillAnimation': 'Animation',

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
  'tour.v24.level':
    'A song after a pause comes in at its own level, and Auto normalize keeps its level when Windows reopens an output.',
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
} as const;

export default tour24;
