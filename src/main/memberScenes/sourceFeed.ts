import {
  readProject,
  readProjectSource,
  type IProjectSource,
  type TProjectBuild,
} from './project';

/**
 * The Studio code pane's text, kept in step with the open project's folder.
 *
 * It rides on the project watcher's own reads rather than a second watcher:
 * every save the watcher sees is read for the build and, beside it, for the
 * source text. The text is sent whenever it changed, whether or not the build
 * did — a comment edited in a scene that does not compile yet changes no
 * build, and the pane must still show it as the member's AI writes it.
 */
export interface ISourceFeed {
  /** A reader for one watcher, whose results count until the next reset. */
  reader(): (folder: string) => Promise<TProjectBuild>;
  /** Forgets the last text, and every read still in flight. */
  reset(): void;
}

export const createSourceFeed = (
  send: (source: IProjectSource | null) => void,
  read: (folder: string) => Promise<TProjectBuild> = readProject,
  readSource: (
    folder: string,
  ) => Promise<IProjectSource | undefined> = readProjectSource,
): ISourceFeed => {
  let last: IProjectSource | undefined;
  let generation = 0;
  return {
    reader: () => {
      const mine = generation;
      return async (folder) => {
        const [build, source] = await Promise.all([
          read(folder),
          readSource(folder),
        ]);
        // A watcher switched off mid-read belongs to a project no longer on
        // the bench; its text must not replace the new one's.
        if (
          mine === generation &&
          (source?.text !== last?.text || source?.file !== last?.file)
        ) {
          last = source;
          send(source ?? null);
        }
        return build;
      };
    },
    reset: () => {
      generation += 1;
      last = undefined;
    },
  };
};
