/**
 * The notice that says the FluidEQ Engine is failing on an output — not
 * running there at all, or running without part of what it was asked for.
 * See `src/renderer/components/EngineTroubleNotice.tsx`.
 *
 * Its buttons reuse `app.menu.restartAudio`, `output.notNow` and
 * `output.gotIt`: the same action should read the same everywhere.
 */
const engineHealth = {
  'engineHealth.offTitle': 'The FluidEQ Engine isn’t running on {device}',
  'engineHealth.offBody':
    'Sound is playing on this output without your EQ. Restarting Windows audio usually brings the engine back, and everything else in FluidEQ keeps working meanwhile.',
  'engineHealth.partlyOff': 'PARTLY OFF',
  'engineHealth.problemsTitle': 'Part of your sound isn’t reaching {device}',
  'engineHealth.problem.convolution':
    'Convolution is off: the engine couldn’t load the impulse response. Try a different file.',
  'engineHealth.problem.eq-phase':
    'Linear-phase EQ could not start; the original filters remain active.',
  'engineHealth.problem.graphic-eq':
    'The graphic EQ is off: the engine couldn’t build its curve.',
  'engineHealth.problem.dsp-rack':
    'The DSP effects are off: the engine couldn’t start them.',
  'engineHealth.problem.reload-failed':
    'Your latest change didn’t load, so the one before it is still playing.',
  'engineHealth.problem.unwatched':
    'The engine can’t see the changes you make for this output.',
  'engineHealth.problem.other':
    'Something else the engine was asked to run isn’t running.',
  'engineHealth.useApo': 'Use Equalizer APO…',
} as const;

export default engineHealth;
