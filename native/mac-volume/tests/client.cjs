/* FluidEQ — GPL-3.0-or-later */
const { spawn } = require('node:child_process');
const readline = require('node:readline');

module.exports = async function volumeClient(executable) {
  const child = spawn(executable, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  const waiting = new Set();
  let current;
  let errorText = '';
  let ended;
  child.stderr.on('data', (bytes) => {
    errorText = (errorText + bytes).slice(-8192);
  });
  const rejectAll = (error) => {
    ended = error;
    waiting.forEach((waiter) => waiter.reject(error));
    waiting.clear();
  };
  child.on('error', rejectAll);
  child.stdin.on('error', rejectAll);
  const finished = new Promise((resolve) => child.on('close', resolve));
  finished.then((code) =>
    rejectAll(new Error(`Volume helper exited ${code}: ${errorText}`)),
  );
  readline.createInterface({ input: child.stdout }).on('line', (line) => {
    if (line === 'none') current = null;
    else {
      const parts = line.split('\t');
      if (!['volume', 'applied'].includes(parts[0])) return;
      current = {
        level: parts[1] === '-' ? undefined : Number(parts[1]),
        muted: parts[2] === '-' ? undefined : parts[2] === '1',
        canSet: parts[3] === '1',
        canMute: parts[4] === '1',
        device: parts[5],
      };
    }
    waiting.forEach((waiter) => {
      if (waiter.predicate(current, line)) {
        waiting.delete(waiter);
        waiter.resolve(current);
      }
    });
  });
  const wait = (predicate, fresh = false) => {
    if (ended) return Promise.reject(ended);
    if (!fresh && current !== undefined && predicate(current, 'volume'))
      return Promise.resolve(current);
    return new Promise((resolve, reject) =>
      waiting.add({ predicate, resolve, reject }),
    );
  };
  await wait(() => true);
  return {
    current: () => current,
    wait,
    async command(kind, value, device = current?.device) {
      const applied = wait(
        (_state, line) => line.startsWith('applied\t') || line === 'none',
        true,
      );
      child.stdin.write(`${kind} ${value}${device ? ` ${device}` : ''}\n`);
      return applied;
    },
    async close() {
      child.stdin.end();
      return finished;
    },
  };
};
