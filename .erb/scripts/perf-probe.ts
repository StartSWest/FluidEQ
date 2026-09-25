/**
 * What the running window costs while somebody uses it, measured rather than
 * reasoned about: `pnpm perf:probe`, against a window `pnpm dev` started.
 *
 * It drives the window over the DevTools port main opens in development
 * (127.0.0.1:9222, `main.ts`), clicking the window's own tabs, and answers
 * three questions with numbers:
 *
 * - Does a page cost more every time it is visited? Every page is opened in
 *   turn, several rounds over; after each round the page collects its garbage
 *   and reports its heap, DOM nodes, event listeners and documents. The first
 *   round fills caches and is left out; growth that continues after it is a
 *   leak, and a leak per visit is the kind that turns an app sluggish over an
 *   afternoon.
 * - What does a page do while nobody touches it? A few seconds on each page,
 *   counted in frames: main-thread time, layouts, style recalculations, React
 *   commits, and which components rendered. A page with nothing moving that
 *   still renders is wasted work; one that renders every frame is a finding.
 * - How long does a page take to open? From the click to the frame after
 *   React's last commit of the switch.
 *
 * Re-renders are counted from React's own commit hook
 * (`__REACT_DEVTOOLS_GLOBAL_HOOK__`, which react-refresh installs in every
 * dev window): a component counts once per commit it actually ran in, which
 * is what React DevTools' "highlight updates" shows, as a table.
 *
 * Waiting is on frames and commits, never on a clock: a window that is hidden
 * or minimised draws no frames, so keep it on screen while this runs. Run it
 * once in silence and once with music playing — the visualizers only move
 * with sound, and both answers matter.
 *
 *   pnpm perf:probe [--rounds 5] [--idle-frames 180] [--port 9222] [--out f]
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import WebSocket from 'ws';

interface IOptions {
  rounds: number;
  idleFrames: number;
  port: number;
  out: string;
}

const readOptions = (argv: string[]): IOptions => {
  const valueOf = (flag: string): string | undefined => {
    const at = argv.indexOf(flag);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const numberOf = (flag: string, fallback: number): number => {
    const parsed = Number(valueOf(flag));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    rounds: numberOf('--rounds', 5),
    idleFrames: numberOf('--idle-frames', 180),
    port: numberOf('--port', 9222),
    out:
      valueOf('--out') ??
      path.join(os.tmpdir(), `fluideq-perf-probe-${Date.now()}.json`),
  };
};

// ---------------------------------------------------------------------------
// The DevTools protocol, as little of it as this needs.
// ---------------------------------------------------------------------------

interface ICdpMessage {
  id?: number;
  result?: unknown;
  error?: { message: string };
}

interface ICdp {
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
  close: () => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const opened = (socket: WebSocket): Promise<void> =>
  new Promise((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });

const connect = async (url: string): Promise<ICdp> => {
  const socket = new WebSocket(url, { perMessageDeflate: false });
  const waiting = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  let nextId = 0;

  // Only replies are read; the protocol's events are not asked for.
  socket.on('message', (data) => {
    const message = JSON.parse(String(data)) as ICdpMessage;
    if (message.id === undefined) {
      return;
    }
    const request = waiting.get(message.id);
    waiting.delete(message.id);
    if (message.error) {
      request?.reject(new Error(message.error.message));
    } else {
      request?.resolve(message.result);
    }
  });
  await opened(socket);

  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        nextId += 1;
        waiting.set(nextId, { resolve, reject });
        socket.send(JSON.stringify({ id: nextId, method, params }));
      }),
    close: () => socket.close(),
  };
};

/** The app's own window: the page whose document is `index.html`. */
const findWindow = async (port: number): Promise<string> => {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets: unknown = await response.json();
  const page = Array.isArray(targets)
    ? targets.find(
        (target: unknown) =>
          isRecord(target) &&
          target.type === 'page' &&
          typeof target.url === 'string' &&
          new URL(target.url).pathname.endsWith('/index.html'),
      )
    : undefined;
  if (!isRecord(page) || typeof page.webSocketDebuggerUrl !== 'string') {
    throw new Error(
      `No FluidEQ window on 127.0.0.1:${port}. Start it with \`pnpm dev\` and keep it on screen.`,
    );
  }
  return page.webSocketDebuggerUrl;
};

// ---------------------------------------------------------------------------
// What runs inside the page. Each of these is sent as its own source text, so
// none of them may reach anything outside its own body.
// ---------------------------------------------------------------------------

interface IFiber {
  tag: number;
  flags: number;
  type: unknown;
  child: IFiber | null;
  sibling: IFiber | null;
  alternate: IFiber | null;
}

interface IDevToolsHook {
  onCommitFiberRoot?: (
    id: number,
    root: { current: IFiber },
    ...rest: unknown[]
  ) => unknown;
}

interface IProbe {
  react: boolean;
  commits: number;
  lastCommitAt: number;
  mounts: number;
  renders: Map<string, number>;
  longTasks: number;
  longTaskMs: number;
}

type TProbeWindow = Window & {
  fluideqProbe?: IProbe;
  __REACT_DEVTOOLS_GLOBAL_HOOK__?: IDevToolsHook;
};

interface ITally {
  commits: number;
  mounts: number;
  renders: [string, number][];
  longTasks: number;
  longTaskMs: number;
}

/**
 * Counts every commit and the components that ran in it.
 *
 * A component "ran" when it is new, or when React flagged it as having done
 * work in this commit (`PerformedWork`, flag 1 — the test React DevTools
 * uses). A subtree whose child list is the very one the previous commit had
 * was not visited at all, so the walk stops there.
 */
const installProbe = (): boolean => {
  const host = window as TProbeWindow;
  if (host.fluideqProbe) {
    return host.fluideqProbe.react;
  }
  const probe: IProbe = {
    react: false,
    commits: 0,
    lastCommitAt: 0,
    mounts: 0,
    renders: new Map(),
    longTasks: 0,
    longTaskMs: 0,
  };
  host.fluideqProbe = probe;

  // Function, class, forwardRef, memo and simple memo components.
  const components = new Set([0, 1, 11, 14, 15]);
  const nameOf = (fiber: IFiber): string => {
    const { type } = fiber;
    const named = (value: unknown): string => {
      if (
        typeof value !== 'function' &&
        !(value && typeof value === 'object')
      ) {
        return '';
      }
      const { displayName, name } = value as {
        displayName?: unknown;
        name?: unknown;
      };
      if (typeof displayName === 'string' && displayName) {
        return displayName;
      }
      return typeof name === 'string' ? name : '';
    };
    if (typeof type === 'function') {
      return named(type) || 'Anonymous';
    }
    if (type && typeof type === 'object') {
      const wrapper = type as { render?: unknown; type?: unknown };
      return (
        named(type) ||
        named(wrapper.render) ||
        named(wrapper.type) ||
        'Anonymous'
      );
    }
    return 'Anonymous';
  };
  const tally = (root: { current: IFiber }) => {
    probe.commits += 1;
    probe.lastCommitAt = performance.now();
    const stack: [IFiber, IFiber | null][] = [
      [root.current, root.current.alternate],
    ];
    while (stack.length > 0) {
      const top = stack.pop();
      if (!top) {
        break;
      }
      const [next, previous] = top;
      if (
        components.has(next.tag) &&
        // eslint-disable-next-line no-bitwise -- fiber flags are a bit field; PerformedWork is bit 1
        (previous === null || (next.flags & 1) === 1)
      ) {
        const name = nameOf(next);
        probe.renders.set(name, (probe.renders.get(name) ?? 0) + 1);
        if (previous === null) {
          probe.mounts += 1;
        }
      }
      if (previous === null || next.child !== previous.child) {
        let { child } = next;
        while (child) {
          stack.push([child, child.alternate]);
          child = child.sibling;
        }
      }
    }
  };

  // eslint-disable-next-line no-underscore-dangle -- React's own global name
  const hook = host.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const original = hook?.onCommitFiberRoot;
  if (hook && original) {
    hook.onCommitFiberRoot = (id, root, ...rest) => {
      try {
        tally(root);
      } catch {
        // A React whose fibers are shaped differently is counted as nothing,
        // never allowed to break the commit it is watching.
      }
      return original.call(hook, id, root, ...rest);
    };
    probe.react = true;
  }

  try {
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        probe.longTasks += 1;
        probe.longTaskMs += entry.duration;
      });
    }).observe({ type: 'longtask' });
  } catch {
    // No long-task timing in this build of Chromium: the column reads 0.
  }
  return probe.react;
};

const resetTally = (): void => {
  const probe = (window as TProbeWindow).fluideqProbe;
  if (probe) {
    probe.mounts = 0;
    probe.renders = new Map();
    probe.longTasks = 0;
    probe.longTaskMs = 0;
  }
};

const readTally = (): ITally => {
  const probe = (window as TProbeWindow).fluideqProbe;
  return {
    commits: probe?.commits ?? 0,
    mounts: probe?.mounts ?? 0,
    renders: [...(probe?.renders ?? new Map<string, number>())].sort(
      (a, b) => b[1] - a[1],
    ),
    longTasks: probe?.longTasks ?? 0,
    longTaskMs: probe?.longTaskMs ?? 0,
  };
};

/** The window's tabs, top row first, as their accessible names. */
const listTabs = (scope: string): string[] =>
  [...document.querySelectorAll<HTMLElement>(`${scope} [role="tab"]`)]
    .map((tab) => tab.getAttribute('aria-label') ?? tab.textContent ?? '')
    .map((label) => label.trim())
    .filter((label) => label.length > 0);

const activeTab = (scope: string): string => {
  const tab = document.querySelector<HTMLElement>(
    `${scope} [role="tab"][aria-selected="true"]`,
  );
  return (tab?.getAttribute('aria-label') ?? tab?.textContent ?? '').trim();
};

interface IOpened {
  found: boolean;
  openMs: number;
  settled: boolean;
  frames: number;
}

/**
 * Click a tab and wait until the page has stopped committing.
 *
 * "Stopped" is `quiet` frames in a row with no commit; a page that never gets
 * there within `limit` frames is reported as not settling, which on its own
 * says it renders continuously. The open time is from the click to the first
 * frame after the switch's last commit — or, for a page that never stops, to
 * the first frame after its first one, when it was at least on screen.
 */
const openTab = (
  scope: string,
  label: string,
  quiet: number,
  limit: number,
): Promise<IOpened> =>
  new Promise((resolve) => {
    const probe = (window as TProbeWindow).fluideqProbe;
    const tab = [
      ...document.querySelectorAll<HTMLElement>(`${scope} [role="tab"]`),
    ].find(
      (candidate) =>
        (
          candidate.getAttribute('aria-label') ??
          candidate.textContent ??
          ''
        ).trim() === label,
    );
    if (!tab || !probe) {
      resolve({ found: false, openMs: 0, settled: false, frames: 0 });
      return;
    }
    const clickedAt = performance.now();
    // A click is a discrete event: React commits it before `click()`
    // returns, so the first frame below already sees the switch.
    let seen = probe.commits;
    tab.click();
    // Read from the clock, not the frame's own timestamp: that one is when
    // the frame was begun, which can be before the click was handled.
    let paintPending = false;
    let firstPaintAt = 0;
    let lastPaintAt = 0;
    let still = 0;
    let frames = 0;
    const step = () => {
      const now = performance.now();
      frames += 1;
      if (paintPending) {
        // The frame before this one drew the commit it saw.
        lastPaintAt = now;
        firstPaintAt = firstPaintAt || now;
        paintPending = false;
      }
      if (probe.commits !== seen) {
        seen = probe.commits;
        still = 0;
        paintPending = true;
      } else {
        still += 1;
      }
      if (still >= quiet || frames >= limit) {
        const settled = still >= quiet;
        const paintedAt = settled ? lastPaintAt : firstPaintAt;
        resolve({
          found: true,
          openMs: paintedAt > 0 ? paintedAt - clickedAt : 0,
          settled,
          frames,
        });
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

/** Wait for this many frames and say how long they took. */
const waitFrames = (count: number): Promise<number> =>
  new Promise((resolve) => {
    const startedAt = performance.now();
    let left = count;
    const step = (now: number) => {
      left -= 1;
      if (left <= 0) {
        resolve(now - startedAt);
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

// ---------------------------------------------------------------------------
// The measuring, from this side of the socket.
// ---------------------------------------------------------------------------

const inPage = async <R, A extends unknown[]>(
  cdp: ICdp,
  run: (...args: A) => R | Promise<R>,
  ...args: A
): Promise<R> => {
  const reply = await cdp.send('Runtime.evaluate', {
    expression: `(${run.toString()})(...${JSON.stringify(args)})`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (!isRecord(reply) || !isRecord(reply.result)) {
    throw new Error('The page gave no answer');
  }
  if (isRecord(reply.exceptionDetails)) {
    throw new Error(
      `The page threw: ${JSON.stringify(reply.exceptionDetails.exception ?? reply.exceptionDetails.text)}`,
    );
  }
  return reply.result.value as R;
};

type TMetrics = Record<string, number>;

const readMetrics = async (cdp: ICdp): Promise<TMetrics> => {
  const reply = await cdp.send('Performance.getMetrics');
  const metrics: TMetrics = {};
  if (isRecord(reply) && Array.isArray(reply.metrics)) {
    reply.metrics.forEach((metric: unknown) => {
      if (
        isRecord(metric) &&
        typeof metric.name === 'string' &&
        typeof metric.value === 'number'
      ) {
        metrics[metric.name] = metric.value;
      }
    });
  }
  return metrics;
};

const collectGarbage = async (cdp: ICdp): Promise<void> => {
  // Twice: the first pass can leave objects that only become unreachable
  // once finalisers from it have run.
  await cdp.send('HeapProfiler.collectGarbage');
  await inPage(cdp, waitFrames, 2);
  await cdp.send('HeapProfiler.collectGarbage');
};

interface IRoute {
  scope: string;
  label: string;
  /** The top tab to open first, for a pill that lives inside one. */
  parent?: string;
}

const TOP = '.workspace-tabs';
const PILLS = '.workspace-tab-group';
const QUIET_FRAMES = 12;
const SETTLE_LIMIT = 120;

const routeName = (route: IRoute) =>
  route.parent ? `${route.parent} › ${route.label}` : route.label;

const openRoute = async (cdp: ICdp, route: IRoute): Promise<IOpened> => {
  if (route.parent && (await inPage(cdp, activeTab, TOP)) !== route.parent) {
    await inPage(cdp, openTab, TOP, route.parent, QUIET_FRAMES, SETTLE_LIMIT);
  }
  return inPage(
    cdp,
    openTab,
    route.scope,
    route.label,
    QUIET_FRAMES,
    SETTLE_LIMIT,
  );
};

/** Every top tab, with the pills of any tab that has them in its place. */
const discoverRoutes = async (cdp: ICdp): Promise<IRoute[]> => {
  const routes: IRoute[] = [];
  const top = await inPage(cdp, listTabs, TOP);
  // Sequential on purpose: each tab has to be open to list its own pills.
  // eslint-disable-next-line no-restricted-syntax -- each tab has to be open to list its own pills
  for (const label of top) {
    // eslint-disable-next-line no-await-in-loop -- one tab open at a time
    await inPage(cdp, openTab, TOP, label, QUIET_FRAMES, SETTLE_LIMIT);
    // eslint-disable-next-line no-await-in-loop -- the pills of the tab just opened
    const pills = await inPage(cdp, listTabs, PILLS);
    if (pills.length > 0) {
      pills.forEach((pill) =>
        routes.push({ scope: PILLS, label: pill, parent: label }),
      );
    } else {
      routes.push({ scope: TOP, label });
    }
  }
  return routes;
};

interface IRouteReport {
  route: string;
  /** The first opening of the page this session, caches cold. */
  firstOpenMs: number;
  settled: boolean;
  openRenders: number;
  openMounts: number;
  openLongTasks: number;
  openLongTaskMs: number;
  idle: {
    seconds: number;
    busyMsPerSecond: number;
    scriptMsPerSecond: number;
    layoutsPerSecond: number;
    styleRecalcsPerSecond: number;
    commitsPerSecond: number;
    rendersPerSecond: number;
    topRenders: [string, number][];
  };
}

interface ICounters {
  heapKb: number;
  nodes: number;
  listeners: number;
  documents: number;
}

/** What one visit to a page left behind, round by round after the first. */
interface IVisitReport {
  route: string;
  openMs: number[];
  settled: boolean;
  kept: ICounters[];
}

const median = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const mean = (values: number[]) =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const readCounters = async (cdp: ICdp): Promise<ICounters> => {
  const metrics = await readMetrics(cdp);
  return {
    heapKb: (metrics.JSHeapUsedSize ?? 0) / 1024,
    nodes: metrics.Nodes ?? 0,
    listeners: metrics.JSEventListeners ?? 0,
    documents: metrics.Documents ?? 0,
  };
};

const difference = (after: ICounters, before: ICounters): ICounters => ({
  heapKb: after.heapKb - before.heapKb,
  nodes: after.nodes - before.nodes,
  listeners: after.listeners - before.listeners,
  documents: after.documents - before.documents,
});

/**
 * Whether a page keeps something every time it is visited.
 *
 * Each sample is one measured visit (see `measureVisits`). A page that cleans
 * up leaves nothing; one that leaks leaves the same thing every time. So a
 * count must grow on EVERY visit to be called a leak — one lazily built cache
 * on the second visit is not one — and the heap by more than V8's own jitter
 * after a full collection.
 */
const leaksOf = (kept: ICounters[]): string[] => {
  if (kept.length === 0) {
    return [];
  }
  const every = (pick: (sample: ICounters) => number, floor: number) =>
    kept.every((sample) => pick(sample) >= floor);
  const found: string[] = [];
  if (every((sample) => sample.listeners, 1)) {
    found.push(
      `+${mean(kept.map((sample) => sample.listeners)).toFixed(1)} listeners`,
    );
  }
  if (every((sample) => sample.nodes, 1)) {
    found.push(`+${mean(kept.map((sample) => sample.nodes)).toFixed(0)} nodes`);
  }
  if (every((sample) => sample.documents, 1)) {
    found.push(
      `+${mean(kept.map((sample) => sample.documents)).toFixed(0)} documents`,
    );
  }
  if (every((sample) => sample.heapKb, 64)) {
    found.push(
      `+${mean(kept.map((sample) => sample.heapKb)).toFixed(0)} KB heap`,
    );
  }
  return found;
};

const measureRoute = async (
  cdp: ICdp,
  route: IRoute,
  idleFrames: number,
): Promise<IRouteReport> => {
  await inPage(cdp, resetTally);
  const opened = await openRoute(cdp, route);
  const onOpen = await inPage(cdp, readTally);

  await inPage(cdp, resetTally);
  const before = await readMetrics(cdp);
  const commitsBefore = (await inPage(cdp, readTally)).commits;
  const idleMs = await inPage(cdp, waitFrames, idleFrames);
  const after = await readMetrics(cdp);
  const idle = await inPage(cdp, readTally);
  const seconds = Math.max(idleMs / 1000, 0.001);
  const perSecond = (name: string, scale = 1) =>
    (((after[name] ?? 0) - (before[name] ?? 0)) * scale) / seconds;
  const rendered = idle.renders.reduce((sum, [, count]) => sum + count, 0);

  return {
    route: routeName(route),
    firstOpenMs: opened.openMs,
    settled: opened.settled,
    openRenders: onOpen.renders.reduce((sum, [, count]) => sum + count, 0),
    openMounts: onOpen.mounts,
    openLongTasks: onOpen.longTasks,
    openLongTaskMs: onOpen.longTaskMs,
    idle: {
      seconds,
      busyMsPerSecond: perSecond('TaskDuration', 1000),
      scriptMsPerSecond: perSecond('ScriptDuration', 1000),
      layoutsPerSecond: perSecond('LayoutCount'),
      styleRecalcsPerSecond: perSecond('RecalcStyleCount'),
      commitsPerSecond: (idle.commits - commitsBefore) / seconds,
      rendersPerSecond: rendered / seconds,
      topRenders: idle.renders.slice(0, 8),
    },
  };
};

/**
 * Visit every page from the first one and back, `rounds` times over.
 *
 * Always from the same page, so each opening is timed from the same start and
 * what a visit leaves behind is that page's alone. Each page is visited twice
 * in a row and only the second visit is counted: React keeps the tree it last
 * drew beside the one on screen until its next commit, so right after a visit
 * the heap still holds the page just left — the previous page, if nothing
 * came between. After a first visit, both measurements hold this page's, and
 * that cancels. The first round is a warm-up — caches fill, lazily built
 * things get built — and is timed but not counted as leaking.
 */
const measureVisits = async (
  cdp: ICdp,
  routes: IRoute[],
  rounds: number,
): Promise<{ visits: IVisitReport[]; start: ICounters; end: ICounters }> => {
  const [home, ...pages] = routes;
  const visits: IVisitReport[] = pages.map((route) => ({
    route: routeName(route),
    openMs: [],
    settled: true,
    kept: [],
  }));
  const visitAndMeasure = async (route: IRoute) => {
    const opened = await openRoute(cdp, route);
    await openRoute(cdp, home);
    await collectGarbage(cdp);
    return { opened, counters: await readCounters(cdp) };
  };
  await openRoute(cdp, home);
  await collectGarbage(cdp);
  const start = await readCounters(cdp);
  let end = start;
  // Sequential on purpose: one window, one page at a time.
  // eslint-disable-next-line no-restricted-syntax -- sequential on purpose: one window, one page at a time
  for (const round of Array.from({ length: rounds }, (_, i) => i + 1)) {
    // eslint-disable-next-line no-restricted-syntax -- sequential on purpose: one window, one page at a time
    for (const [index, route] of pages.entries()) {
      // eslint-disable-next-line no-await-in-loop -- each page is measured only after the one before it has settled
      const primed = await visitAndMeasure(route);
      // eslint-disable-next-line no-await-in-loop -- each page is measured only after the one before it has settled
      const measured = await visitAndMeasure(route);
      visits[index].openMs.push(measured.opened.openMs);
      visits[index].settled = visits[index].settled && measured.opened.settled;
      if (round > 1) {
        visits[index].kept.push(difference(measured.counters, primed.counters));
      }
      end = measured.counters;
    }
  }
  return { visits, start, end };
};

const pad = (value: string | number, width: number) =>
  String(value).padStart(width);

const fixed = (value: number, digits = 1) => value.toFixed(digits);

const printRoutes = (reports: IRouteReport[]) => {
  console.log('\nEach page opened, then left alone:\n');
  console.log(
    `${'page'.padEnd(34)}${pad('renders', 9)}${pad('long tasks', 12)}${pad('busy ms/s', 11)}${pad('layout/s', 10)}${pad('style/s', 9)}${pad('commit/s', 10)}${pad('render/s', 10)}`,
  );
  reports.forEach((report) => {
    console.log(
      `${`${report.route}${report.settled ? '' : ' *'}`.slice(0, 33).padEnd(34)}${pad(report.openRenders, 9)}${pad(`${report.openLongTasks} / ${fixed(report.openLongTaskMs, 0)}ms`, 12)}${pad(fixed(report.idle.busyMsPerSecond), 11)}${pad(fixed(report.idle.layoutsPerSecond), 10)}${pad(fixed(report.idle.styleRecalcsPerSecond), 9)}${pad(fixed(report.idle.commitsPerSecond), 10)}${pad(fixed(report.idle.rendersPerSecond), 10)}`,
    );
  });
  console.log(
    '\n* never went 12 frames without a commit: that page re-renders continuously.',
  );
  console.log(
    'busy ms/s includes about 10 ms/s of the probe counting frames itself.',
  );
  const noisy = reports.filter((report) => report.idle.rendersPerSecond >= 1);
  if (noisy.length > 0) {
    console.log('\nComponents rendering while the page was left alone:');
    noisy.forEach((report) => {
      console.log(`  ${report.route}`);
      report.idle.topRenders.forEach(([name, count]) =>
        console.log(
          `    ${name.padEnd(40)}${pad(fixed(count / report.idle.seconds), 7)}/s`,
        ),
      );
    });
  }
};

const printVisits = (
  home: string,
  visits: IVisitReport[],
  start: ICounters,
  end: ICounters,
) => {
  console.log(
    `\nEach page visited from ${home} and back, garbage collected after each:\n`,
  );
  console.log(`${'page'.padEnd(34)}${pad('open ms', 9)}   kept per visit`);
  let leaking = 0;
  visits.forEach((visit) => {
    const leaks = leaksOf(visit.kept);
    leaking += leaks.length > 0 ? 1 : 0;
    const kept = mean(visit.kept.map((sample) => sample.heapKb));
    console.log(
      `${`${visit.route}${visit.settled ? '' : ' *'}`.slice(0, 33).padEnd(34)}${pad(fixed(median(visit.openMs), 0), 9)}   ${leaks.length > 0 ? `LEAKS ${leaks.join(', ')}` : `nothing (heap ${kept >= 0 ? '+' : ''}${fixed(kept, 0)} KB)`}`,
    );
  });
  console.log(
    `\nWhole run: heap ${fixed(start.heapKb / 1024, 1)} → ${fixed(end.heapKb / 1024, 1)} MB, nodes ${start.nodes} → ${end.nodes}, listeners ${start.listeners} → ${end.listeners}, documents ${start.documents} → ${end.documents}.`,
  );
  console.log(
    leaking > 0
      ? `${leaking} page(s) keep something on every visit.`
      : 'No page keeps anything from one visit to the next.',
  );
};

const main = async () => {
  const options = readOptions(process.argv.slice(2));
  const cdp = await connect(await findWindow(options.port));
  try {
    await cdp.send('Performance.enable');
    await cdp.send('HeapProfiler.enable');
    const hasReact = await inPage(cdp, installProbe);
    if (!hasReact) {
      console.log(
        'React commit counting is off: this window has no React DevTools hook (is it a `pnpm dev` window?). Heap, layout and timing are still measured.',
      );
    }
    const startedOn = await inPage(cdp, activeTab, TOP);
    const routes = await discoverRoutes(cdp);
    console.log(`${routes.length} pages: ${routes.map(routeName).join(', ')}`);

    const reports: IRouteReport[] = [];
    // Sequential on purpose: one window, one page at a time.
    // eslint-disable-next-line no-restricted-syntax -- sequential on purpose: one window, one page at a time
    for (const route of routes) {
      // eslint-disable-next-line no-await-in-loop -- each page is measured only after the one before it has settled
      reports.push(await measureRoute(cdp, route, options.idleFrames));
    }
    printRoutes(reports);

    const { visits, start, end } = await measureVisits(
      cdp,
      routes,
      options.rounds,
    );
    printVisits(routeName(routes[0]), visits, start, end);

    if (startedOn) {
      await inPage(cdp, openTab, TOP, startedOn, QUIET_FRAMES, SETTLE_LIMIT);
    }
    fs.writeFileSync(
      options.out,
      JSON.stringify(
        {
          measuredAt: new Date().toISOString(),
          options,
          pages: reports,
          visits,
          start,
          end,
        },
        null,
        2,
      ),
    );
    console.log(`\nFull numbers: ${options.out}`);
  } finally {
    cdp.close();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
