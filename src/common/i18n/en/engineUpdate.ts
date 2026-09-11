/**
 * The notice that offers this app's FluidEQ Engine in place of the one
 * installed, which an app update never replaces. See
 * `src/renderer/components/EngineUpdateNotice.tsx`.
 *
 * Its buttons reuse `output.notNow`, `output.gotIt`, `restart.tryAgain` and
 * `restart.close`: the same action should read the same everywhere.
 */
const engineUpdate = {
  'engineUpdate.badge': 'ENGINE UPDATE',
  'engineUpdate.title': 'A new FluidEQ Engine is ready',
  'engineUpdate.body':
    'This version of FluidEQ comes with an updated audio engine. Installing it asks Windows for permission and restarts audio for a few seconds.',
  'engineUpdate.action': 'Update engine',
  'engineUpdate.running': 'Updating the engine…',
  'engineUpdate.doneBadge': 'UP TO DATE',
  'engineUpdate.doneTitle': 'The FluidEQ Engine is up to date',
  'engineUpdate.doneBody':
    'Windows audio restarted onto the new engine, with your outputs and your EQ as they were. Reopen any app that is still silent.',
  'engineUpdate.declined':
    'Windows permission was declined, so the engine you had is still the one playing your EQ.',
  'engineUpdate.failed':
    'The engine couldn’t be updated, so the one you had is still playing your EQ.',
} as const;

export default engineUpdate;
