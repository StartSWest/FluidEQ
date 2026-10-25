// The guides a new project's starter scene comes with: its parts labelled
// on the Studio's stage, and "Start here" at the top of the chat. The ideas
// are sent to the member's AI as written, so each is one plain request.
const studioStarter = {
  'studioStarter.labels': 'Labels',
  'studioStarter.labelsHint': 'What each part of the scene listens to',
  'studioStarter.spectrum': 'Spectrum',
  'studioStarter.label.mids': 'The sky warms',
  'studioStarter.label.treble': 'Sparks twinkle',
  'studioStarter.label.bass': 'The orb swells and glows',
  'studioStarter.label.spectrum': 'The ring: bass at the bottom, treble on top',
  'studioStarter.label.beat': 'A ripple crosses the floor',
  'studioStarter.label.drop': 'The ring opens, its colours turn',
  'studioStarter.title': 'Start here',
  'studioStarter.count': '{done} of {total}',
  'studioStarter.close': 'Close the guide',
  'studioStarter.step.heard': 'Play a song',
  'studioStarter.step.heardHint': 'In any player. The stage answers by itself.',
  'studioStarter.step.dial': 'Move a dial',
  'studioStarter.step.dialHint':
    'Under Tune. Dials are what people get to change on your scene.',
  'studioStarter.step.asked': 'Ask your AI for one change',
  'studioStarter.step.askedHint': 'Pick an idea, or say it your own way.',
  'studioStarter.step.publish': 'Publish',
  'studioStarter.step.publishHint':
    'When it is done and tested on your graph: others find it in the gallery.',
  'studioStarter.ideas': 'Ideas to ask',
  'studioStarter.idea.planet': 'Turn the orb into a ringed planet',
  'studioStarter.idea.rain': 'Make it rain, harder on every kick',
  'studioStarter.idea.sunset': 'Give the sky sunset colours',
  'studioStarter.idea.city': 'Add a city skyline that lights up with the bass',
  'studioStarter.idea.galaxy': 'Put a slowly turning galaxy behind the orb',
  'studioStarter.idea.calm': 'Make it calmer for slow songs',
} as const;

export default studioStarter;
