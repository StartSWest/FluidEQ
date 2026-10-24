/* FluidEQ — GPL-3.0-or-later. Behavioral checks for the design model. */
require('ts-node').register({ transpileOnly: true });
const assert = require('node:assert/strict');
const {
  initialGroup,
  orderedComputers,
  findRoute,
  routeState,
  updateComputer,
  updateRoute,
  togglePair,
  addComputer,
  removeComputer,
} = require('./groupModel.ts');

let count = 0;
const check = (description, run) => {
  run();
  count += 1;
  process.stdout.write(`PASS ${description}\n`);
};
const initial = initialGroup();

check(
  'Every view pins itself and preserves canonical remote order despite reversed arrival',
  () => {
    const canonical = orderedComputers(initial).map((pc) => pc.id);
    const reversed = {
      ...initial,
      computers: [...initial.computers].reverse(),
    };
    canonical.forEach((id) => {
      const view = orderedComputers(reversed, id).map((pc) => pc.id);
      assert.equal(view[0], id);
      assert.deepEqual(
        view.slice(1),
        canonical.filter((peer) => peer !== id),
      );
    });
  },
);

check('A sender switch affects exactly one directed route', () => {
  const changed = updateRoute(initial, 'win', 'mac', { send: false });
  assert.equal(routeState(changed, 'win', 'mac').reason, 'Sender switched off');
  assert.equal(routeState(changed, 'mac', 'win').active, true);
  assert.equal(routeState(changed, 'win', 'linux').active, true);
});

check(
  'A listener choice cannot be overridden by the sender enabling its side',
  () => {
    const blocked = updateRoute(initial, 'win', 'mac', { receive: false });
    const resent = updateRoute(blocked, 'win', 'mac', { send: true });
    assert.equal(
      routeState(resent, 'win', 'mac').reason,
      'Listener switched off',
    );
  },
);

check(
  'Receive gain is independent per destination and composes with source gain',
  () => {
    let changed = updateRoute(initial, 'mac', 'win', { level: 0.42 });
    changed = updateComputer(changed, 'mac', { sendLevel: 0.5 });
    assert.equal(routeState(changed, 'mac', 'win').gain, 0.21);
    assert.equal(routeState(changed, 'mac', 'linux').gain, 0.5);
    assert.equal(findRoute(changed, 'linux', 'win').level, 1);
    assert.equal(
      findRoute(updateRoute(changed, 'mac', 'win', { level: 0 }), 'mac', 'win')
        .receive,
      true,
    );
  },
);

check(
  'Pair pause preserves values and a resume cannot clear the other end’s pause',
  () => {
    const localPause = togglePair(initial, 'win', 'mac');
    assert.equal(routeState(localPause, 'win', 'mac').reason, 'Paused');
    assert.equal(routeState(localPause, 'mac', 'win').reason, 'Paused');
    assert.equal(routeState(localPause, 'win', 'linux').active, true);
    const bothPaused = togglePair(localPause, 'mac', 'win');
    const oneResumed = togglePair(bothPaused, 'win', 'mac');
    assert.equal(routeState(oneResumed, 'win', 'mac').reason, 'Paused');
    const resumed = togglePair(oneResumed, 'mac', 'win');
    assert.deepEqual(resumed.routes, initial.routes);
    assert.equal(routeState(resumed, 'win', 'mac').active, true);
  },
);

check(
  'Local pause leaves other computers talking and restores the local choices',
  () => {
    const paused = updateComputer(initial, 'win', { paused: true });
    assert.equal(routeState(paused, 'mac', 'win').active, false);
    assert.equal(routeState(paused, 'win', 'linux').active, false);
    assert.equal(routeState(paused, 'mac', 'linux').active, true);
    assert.deepEqual(updateComputer(paused, 'win', { paused: false }), initial);
  },
);

check(
  'Capture access loss stops only that source; receiving still works',
  () => {
    const blocked = updateComputer(initial, 'win', { captureReady: false });
    assert.equal(
      routeState(blocked, 'win', 'mac').reason,
      'Audio access needed',
    );
    assert.equal(routeState(blocked, 'mac', 'win').active, true);
  },
);

check(
  'Offline members retain their position and settings through reconnect',
  () => {
    const offline = updateComputer(initial, 'mac', { online: false });
    assert.deepEqual(
      orderedComputers(offline).map((pc) => pc.id),
      orderedComputers(initial).map((pc) => pc.id),
    );
    assert.equal(routeState(offline, 'mac', 'win').reason, 'Computer offline');
    assert.equal(
      routeState(updateComputer(offline, 'mac', { online: true }), 'mac', 'win')
        .gain,
      0.75,
    );
  },
);

check(
  'A newly admitted duplicate name has independent identity, settings and muted receive routes',
  () => {
    const duplicate = {
      ...initial.computers[0],
      id: 'win-second',
      name: 'Windows PC',
    };
    const added = addComputer(initial, duplicate);
    assert.equal(added.computers.length, 5);
    assert.equal(added.routes.length, 20);
    assert.equal(addComputer(added, duplicate), added);
    added.routes
      .filter(
        (route) => route.from === duplicate.id || route.to === duplicate.id,
      )
      .forEach((route) => assert.equal(route.receive, false));
    const changed = updateRoute(added, 'mac', duplicate.id, {
      receive: true,
      level: 0.2,
    });
    assert.equal(findRoute(changed, 'mac', 'win').level, 0.75);
    assert.equal(findRoute(changed, 'mac', duplicate.id).level, 0.2);
    assert.deepEqual(
      orderedComputers(changed)
        .filter((pc) => pc.name === 'Windows PC')
        .map((pc) => pc.id),
      ['win', 'win-second'],
    );
  },
);

check(
  'Removal clears only that member’s routes and pauses; there is no self-route',
  () => {
    const removed = removeComputer(togglePair(initial, 'win', 'mac'), 'mac');
    assert.equal(removed.computers.length, 3);
    assert.equal(removed.routes.length, 6);
    assert.equal(removed.pausedPairs.length, 0);
    assert.equal(routeState(removed, 'win', 'mac').active, false);
    assert.equal(routeState(removed, 'win', 'linux').active, true);
    assert.equal(routeState(initial, 'win', 'win').active, false);
  },
);

assert.deepEqual(
  initial,
  initialGroup(),
  'Model operations must not mutate their inputs',
);
process.stdout.write(
  `${count} design-model checks passed. No audio/network validation is implied.\n`,
);
