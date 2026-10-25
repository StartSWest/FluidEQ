/* FluidEQ — GPL-3.0-or-later */
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const assert = require('node:assert/strict');
module.exports = async (executable) => {
  const child = spawn(executable, [], { stdio: ['pipe', 'pipe', 'inherit'] });
  const queued = [],
    waiting = [];
  let ended;
  const reject = (error) => {
    ended = error;
    waiting.splice(0).forEach((waiter) => waiter.reject(error));
  };
  child.on('error', reject);
  child.stdin.on('error', reject);
  const finished = new Promise((resolve) => child.on('close', resolve));
  finished.then((code) => reject(new Error(`Output fixture exited ${code}`)));
  readline.createInterface({ input: child.stdout }).on('line', (value) => {
    const waiter = waiting.shift();
    if (waiter) waiter.resolve(value);
    else queued.push(value);
  });
  const line = () => {
    if (queued.length) return Promise.resolve(queued.shift());
    if (ended) return Promise.reject(ended);
    return new Promise((resolve, refuse) =>
      waiting.push({ resolve, reject: refuse }),
    );
  };
  const ready = (await line()).split('\t');
  assert.equal(ready[0], 'ready');
  return {
    alternate: ready[1],
    original: ready[2],
    async select(name) {
      child.stdin.write(`${name}\n`);
      const applied = (await line()).split('\t');
      assert.equal(applied[0], 'applied');
      assert.equal(applied[1], name === 'alternate' ? ready[1] : ready[2]);
    },
    async close() {
      child.stdin.end();
      assert.equal(await finished, 0);
    },
  };
};
