import type { TSettingsWrite } from './projectSettings';

/**
 * Saves of a project's settings, one at a time per folder.
 *
 * A save reads `pack.json`, changes its values and writes it back. A slider
 * commits on release and again on blur, and two sliders moved in a row commit
 * back to back, so two saves could read the same manifest and the second
 * write dropped the first one's value. And Add to looks, export, publish and
 * the watcher each read the manifest themselves: pressed straight after a
 * slider, they could read it before the save landed and carry the old value.
 */
const pending = new Map<string, Promise<TSettingsWrite>>();

/** Runs `write` after every save already queued for `folder`. */
export const queueSettingsWrite = (
  folder: string,
  write: () => Promise<TSettingsWrite>,
): Promise<TSettingsWrite> => {
  const work = (pending.get(folder) ?? Promise.resolve()).then(write, write);
  pending.set(folder, work);
  const forget = () => {
    if (pending.get(folder) === work) {
      pending.delete(folder);
    }
  };
  work.then(forget, forget);
  return work;
};

/**
 * Settles once no save is queued for `folder`, so a read after it sees the
 * last one. A save that failed left the manifest as it was, which is then
 * what there is to read; its own caller says it failed.
 */
export const waitForSettingsWrites = async (folder: string): Promise<void> => {
  let work = pending.get(folder);
  while (work) {
    // Settled either way; the outcome belongs to the save's caller.
    // eslint-disable-next-line no-await-in-loop -- each save queued behind the last must settle before the next is looked up
    await work.catch(() => undefined);
    work = pending.get(folder);
  }
};
