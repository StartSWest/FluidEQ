/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The first thing the process holding the Studio's chats across a restart
// runs (`chatRelayClient.ts` starts it, Electron as Node). Plain JavaScript,
// so that before anything that can fail - loading TypeScript, the host
// itself - it has called the FluidEQ that started it: a host that cannot
// start says why over that line instead of leaving a chat working for ever.
// That line stays open after, and its closing tells the host its starter
// is gone.
const net = require('net');

// One variable, `RELAY_ENV` in `chatRelayProtocol.ts`, taken out before
// anything else runs: none of it is Claude Code's, nor anything it starts,
// and Electron as Node would make any Electron app a skill starts come up
// as a bare Node.
const raw = process.env.FLUIDEQ_CHAT_RELAY;
delete process.env.FLUIDEQ_CHAT_RELAY;
delete process.env.ELECTRON_RUN_AS_NODE;

let settings;
try {
  settings = JSON.parse(raw || '');
} catch {
  process.exit(1);
}

const starter = net.connect(settings.ready);
let connected = false;
// Unreachable, nobody is waiting for it. Once connected, a broken line only
// means the starter is gone, which the host hears as the line closing.
starter.on('error', () => {
  if (!connected) {
    process.exit(1);
  }
});
starter.on('connect', () => {
  connected = true;
  try {
    require('ts-node/register/transpile-only');
    require('./chatRelayHostMain.ts').default(starter, settings);
  } catch (error) {
    const why = String((error && error.message) || error).replace(/\s+/g, ' ');
    starter.end(`failed ${why}\n`, () => process.exit(1));
  }
});
