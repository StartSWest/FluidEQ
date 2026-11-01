const escapeForPattern = (part: string): string =>
  part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * What the renderer's dev server never watches: any `node_modules`, and the
 * `.claude` and `.gigaide` folders directly under the checkout at `rootPath`.
 *
 * Those two hold whole checkouts with their own node_modules, and a stale one
 * with a locked file once killed the entire dev process with an unhandled
 * EPERM from the watcher's scan. Only directly under this root: the pattern
 * used to match `.claude` anywhere in a path, and a dev server run from a
 * worktree — itself at `.claude/worktrees/<name>` — then ignored every file
 * it serves, so edits never rebuilt and the window kept running the code it
 * started with.
 *
 * Either separator, because watchpack hands the pattern forward slashes and
 * the root arrives with backslashes on Windows; any case there, because a
 * drive letter reported in the other case would otherwise switch the whole
 * guard off.
 */
const watchIgnored = (
  rootPath: string,
  caseInsensitive: boolean = process.platform === 'win32',
): RegExp =>
  new RegExp(
    `node_modules|^${rootPath
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .map(escapeForPattern)
      .join('[\\\\/]')}[\\\\/](?:\\.claude|\\.gigaide)[\\\\/]`,
    caseInsensitive ? 'i' : '',
  );

export default watchIgnored;
