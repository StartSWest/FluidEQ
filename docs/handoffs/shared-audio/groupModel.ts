/* FluidEQ — GPL-3.0-or-later. Design preview only; no network or audio I/O. */

export interface IComputer {
  id: string;
  name: string;
  platform: 'Windows' | 'macOS' | 'Linux';
  online: boolean;
  captureReady: boolean;
  sharing: boolean;
  paused: boolean;
  systemVolume: number;
  isMuted?: boolean;
  output: string;
  source: string;
}

export interface IRoute {
  from: string;
  to: string;
  send: boolean;
  receive: boolean;
  level: number;
  muted?: boolean;
  unlinked?: boolean;
}

export interface IGroup {
  computers: IComputer[];
  routes: IRoute[];
  pausedPairs: string[];
}

const compare = (a: string, b: string) => (a < b ? -1 : Number(a > b));
const nameKey = (name: string) => name.normalize('NFKC').toLowerCase();

// A browser's locale and socket arrival order must never reorder the roster.
// The same shared names and lasting IDs produce the same order on every PC.
export const orderedComputers = (group: IGroup, localId?: string) =>
  [...group.computers].sort((a, b) => {
    if (a.id === b.id) {
      return 0;
    }
    if (a.id === localId) {
      return -1;
    }
    if (b.id === localId) {
      return 1;
    }
    return compare(nameKey(a.name), nameKey(b.name)) || compare(a.id, b.id);
  });

// Each end owns its pause. Resuming here cannot undo a pause over there.
export const pairKey = (owner: string, other: string) => `${owner}:${other}`;

export const findRoute = (group: IGroup, from: string, to: string) =>
  group.routes.find((route) => route.from === from && route.to === to);

export const routeState = (group: IGroup, from: string, to: string) => {
  const source = group.computers.find((pc) => pc.id === from);
  const target = group.computers.find((pc) => pc.id === to);
  const route = findRoute(group, from, to);
  if (!source || !target || !route || from === to) {
    return { active: false, reason: 'No route', gain: 0 };
  }
  let reason = 'Playing';
  if (route.unlinked) {
    reason = 'Unlinked';
  } else if (!source.online || !target.online) {
    reason = 'Computer offline';
  } else if (
    source.paused ||
    target.paused ||
    group.pausedPairs.includes(pairKey(from, to)) ||
    group.pausedPairs.includes(pairKey(to, from))
  ) {
    reason = 'Paused';
  } else if (!source.captureReady) {
    reason = 'Audio access needed';
  } else if (!source.sharing || !route.send) {
    reason = 'Sender switched off';
  } else if (!route.receive) {
    reason = 'Listener switched off';
  }
  const active = reason === 'Playing';
  return { active, reason, gain: active && !route.muted ? route.level : 0 };
};

export const updateComputer = (
  group: IGroup,
  id: string,
  patch: Partial<Omit<IComputer, 'id'>>,
): IGroup => ({
  ...group,
  computers: group.computers.map((pc) =>
    pc.id === id ? { ...pc, ...patch } : pc,
  ),
});

export const updateRoute = (
  group: IGroup,
  from: string,
  to: string,
  patch: Partial<
    Pick<IRoute, 'send' | 'receive' | 'level' | 'muted' | 'unlinked'>
  >,
): IGroup => ({
  ...group,
  routes: group.routes.map((route) =>
    route.from === from && route.to === to ? { ...route, ...patch } : route,
  ),
});

export const togglePair = (group: IGroup, a: string, b: string): IGroup => {
  const key = pairKey(a, b);
  return {
    ...group,
    pausedPairs: group.pausedPairs.includes(key)
      ? group.pausedPairs.filter((value) => value !== key)
      : [...group.pausedPairs, key],
  };
};

export const addComputer = (group: IGroup, computer: IComputer): IGroup => {
  if (group.computers.some((pc) => pc.id === computer.id)) {
    return group;
  }
  return {
    ...group,
    computers: [...group.computers, computer],
    routes: [
      ...group.routes,
      ...group.computers.flatMap((pc) => [
        { from: pc.id, to: computer.id, send: true, receive: false, level: 1 },
        { from: computer.id, to: pc.id, send: true, receive: false, level: 1 },
      ]),
    ],
  };
};

export const removeComputer = (group: IGroup, id: string): IGroup => ({
  computers: group.computers.filter((pc) => pc.id !== id),
  routes: group.routes.filter((route) => route.from !== id && route.to !== id),
  pausedPairs: group.pausedPairs.filter((key) => !key.split(':').includes(id)),
});

export const initialGroup = (): IGroup => {
  const computers: IComputer[] = [
    {
      id: 'win',
      name: 'Windows PC',
      platform: 'Windows',
      online: true,
      captureReady: true,
      sharing: true,
      paused: false,
      systemVolume: 1,
      output: 'Headphones',
      source: 'System audio · Browser & apps',
    },
    {
      id: 'mac',
      name: 'MacBook Pro',
      platform: 'macOS',
      online: true,
      captureReady: true,
      sharing: true,
      paused: false,
      systemVolume: 1,
      output: 'MacBook speakers',
      source: 'Music · Evening playlist',
    },
    {
      id: 'linux',
      name: 'Linux Desktop',
      platform: 'Linux',
      online: true,
      captureReady: true,
      sharing: true,
      paused: false,
      systemVolume: 1,
      output: 'USB speakers',
      source: 'System audio · Browser & apps',
    },
    {
      id: 'studio',
      name: 'Studio PC',
      platform: 'Windows',
      online: false,
      captureReady: true,
      sharing: true,
      paused: false,
      systemVolume: 1,
      output: 'Studio monitors',
      source: 'System audio',
    },
  ];
  return {
    computers,
    pausedPairs: [],
    routes: computers.flatMap((from) =>
      computers
        .filter((to) => to.id !== from.id)
        .map((to) => ({
          from: from.id,
          to: to.id,
          send: true,
          receive: true,
          level: from.id === 'mac' && to.id === 'win' ? 0.75 : 1,
        })),
    ),
  };
};
