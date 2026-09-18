/**
 * A path the window named, before main touches it.
 *
 * Almost nothing in this app takes a path from the window — folders and files
 * are chosen in a system dialog here, and named back to the page by an id
 * (see the header of `ipc/memberScenes.ts`). Two places have to, because the
 * page learns a real file's path from a real drop or file picker through
 * `webUtils.getPathForFile`: the Library's dropped folders and the Karaoke
 * session's remembered files.
 *
 * THE ONE THING THAT MUST NOT REACH THE FILESYSTEM IS A PATH ON ANOTHER
 * MACHINE. `\\host\share` is a perfectly ordinary path to Node, and merely
 * asking `stat` about one makes Windows open an SMB connection to that host
 * and authenticate as the logged-in user — handing whoever runs it this
 * person's username and an NTLMv2 hash to crack, from a string that arrived
 * over IPC. Nothing about it looks like an attack from inside the app: it is
 * one `statSync` on a path somebody typed. A drop or a picker can hand out a
 * network path legitimately, so this is a real cost — a library on a NAS has
 * to be mapped to a drive letter first — and it is worth it.
 *
 * This is a check on the SHAPE of a path, and not a permission. It does not
 * make a path the window named safe to read; it makes it safe to ask the
 * filesystem about. What may then be done with it is the caller's rule.
 */

/** Longer than any real path, and short enough that nothing chokes on it. */
const MAX_PATH_LENGTH = 2048;

/**
 * `\\host\share`, `//host/share`, and the extended-length spellings Windows
 * also accepts for them (`\\?\UNC\host\share`). Two leading separators is the
 * whole signature; `\\?\C:\...` is a local drive and is not one.
 */
const isNetworkPath = (value: string) => {
  const normalized = value.replace(/\//g, '\\');
  if (/^\\\\\?\\UNC\\/i.test(normalized)) {
    return true;
  }
  return normalized.startsWith('\\\\') && !/^\\\\[?.]\\/.test(normalized);
};

/**
 * Whether main may ask the filesystem about a path the window named: text, of
 * a sane length, with no NUL in it (which truncates the name every layer
 * below sees), and not on another machine.
 */
export const isLocalRendererPath = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= MAX_PATH_LENGTH &&
  !value.includes('\0') &&
  !isNetworkPath(value);
