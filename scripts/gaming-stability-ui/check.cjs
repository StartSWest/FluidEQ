/*
Copyright (C) 2026 Ivan Carmenates Garcia
SPDX-License-Identifier: GPL-3.0-or-later
*/
// Real Game controls and app styles in a muted, headless browser. No Electron
// main, devices, saved profiles or installed engine are opened by this harness.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { once } = require('events');

const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'outputs/gaming-stability-ui');
const dist = path.join(output, 'dist');
const chrome =
  process.env.CHROME_PATH ||
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find(fs.existsSync);
if (!chrome) {
  throw new Error('Set CHROME_PATH to a Chromium browser');
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname;
    const file = path.join(dist, name === '/' ? 'index.html' : name);
    if (!file.startsWith(dist + path.sep) || !fs.existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader(
      'Content-Type',
      name.endsWith('.js') ? 'text/javascript' : 'text/html',
    );
    response.end(fs.readFileSync(file));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const profile = fs.mkdtempSync(path.join(output, 'chrome-'));
  const browser = spawn(
    chrome,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--mute-audio',
      'about:blank',
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let socket;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let seen = '';
      browser.stderr.on('data', (chunk) => {
        seen += chunk;
        const found = /DevTools listening on (ws:\/\/\S+)/.exec(seen);
        if (found) {
          resolve(found[1]);
        }
      });
      browser.once('exit', (code) =>
        reject(new Error(`Browser exited ${code}`)),
      );
    });
    socket = new WebSocket(endpoint);
    await once(socket, 'open');
    let next = 0;
    let sessionId;
    const pending = new Map();
    const events = new Map();
    const errors = [];
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.method === 'Runtime.exceptionThrown') {
        errors.push(message.params);
      }
      if (message.method) {
        events.get(message.method)?.(message.params);
      }
      const waiter = pending.get(message.id);
      if (!waiter) {
        return;
      }
      pending.delete(message.id);
      if (message.error) {
        waiter.reject(message.error);
      } else {
        waiter.resolve(message.result);
      }
    });
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        next += 1;
        const id = next;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params, sessionId }));
      });
    const { targetInfos } = await send('Target.getTargets');
    ({ sessionId } = await send('Target.attachToTarget', {
      targetId: targetInfos.find((info) => info.type === 'page').targetId,
      flatten: true,
    }));
    await send('Page.enable');
    await send('Runtime.enable');
    const evaluate = async (expression) => {
      const answer = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (answer.exceptionDetails) {
        throw new Error(JSON.stringify(answer.exceptionDetails));
      }
      return answer.result.value;
    };
    const frame = () =>
      evaluate(
        'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
      );
    const results = [];
    const cases = [
      [1280, 'en', 1],
      [1024, 'de', 1],
      [420, 'de', 1],
      [1920, 'es', 1],
      [320, 'fr', 1],
      [240, 'ru', 1],
      [1024, 'de', 1.5],
    ];
    for (let caseIndex = 0; caseIndex < cases.length; caseIndex += 1) {
      const [width, locale, zoom] = cases[caseIndex];
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 800,
        deviceScaleFactor: 1,
        mobile: false,
      });
      const loaded = new Promise((resolve) => {
        events.set('Page.loadEventFired', resolve);
      });
      await send('Page.navigate', {
        url: `http://127.0.0.1:${server.address().port}/?locale=${locale}`,
      });
      await loaded;
      await evaluate(`new Promise(resolve => {
        const ready = () => {
          if (!document.querySelector('.is-environment .knob') || document.documentElement.lang !== '${locale}') return false;
          document.fonts.ready.then(() => requestAnimationFrame(resolve)); return true;
        };
        if (!ready()) { const observer = new MutationObserver(() => { if (ready()) observer.disconnect(); }); observer.observe(document, {childList:true,subtree:true,attributes:true}); }
      })`);
      await evaluate(
        `document.body.style.zoom='${zoom}'; document.getAnimations().forEach(a => a.finish()); document.querySelector('.is-environment').scrollIntoView({block:'center'}); document.querySelector('.is-environment input').focus({preventScroll:true})`,
      );
      await frame();
      const measure = () =>
        evaluate(`Array.from(document.querySelectorAll('.labelled-knob'), node => {
        const rect = element => { const r=element.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; };
        return {label:node.querySelector('.labelled-knob__label').textContent, knob:rect(node.querySelector('.knob')), input:rect(node.querySelector('.knob__input')), value:rect(node.querySelector('.knob-readout__value')), focused:node.contains(document.activeElement)};
      })`);
      const before = await measure();
      const readings = ['', '+0.3 dB', '+10.0 dB', ''];
      for (let reading = 0; reading < readings.length; reading += 1) {
        const text = readings[reading];
        await evaluate(
          `document.querySelector('#words').click();document.querySelector('#tuning').click();document.querySelectorAll('.dsp-footsteps-lamp-figure .live-figure__text').forEach(n => n.textContent=${JSON.stringify(text)});document.querySelector('.is-dialogue .live-figure__text').textContent=${JSON.stringify(text ? '+6.0 dB · −6.0 dB' : '')};document.querySelector('.is-environment .live-figure__text').textContent=${JSON.stringify(text ? '−9.0 dB' : '')}`,
        );
        await frame();
        const after = await measure();
        before.forEach((control, i) => {
          ['knob', 'input', 'value'].forEach((part) => {
            const dimensions =
              part === 'value'
                ? ['y', 'height']
                : ['x', 'y', 'width', 'height'];
            dimensions.forEach((dimension) => {
              if (
                Math.abs(after[i][part][dimension] - control[part][dimension]) >
                0.1
              ) {
                throw new Error(
                  `${width}/${locale}/${zoom}: ${control.label} ${part} ${dimension} moved`,
                );
              }
            });
            if (
              part === 'value' &&
              Math.abs(
                after[i].value.x +
                  after[i].value.width / 2 -
                  control.value.x -
                  control.value.width / 2,
              ) > 0.1
            ) {
              throw new Error(`${width}/${locale}/${zoom}: value centre moved`);
            }
          });
          if (control.focused !== after[i].focused) {
            throw new Error('Keyboard focus changed');
          }
        });
      }
      await evaluate(
        "document.querySelectorAll('.dsp-footsteps-lamp-figure .live-figure__text').forEach(n => n.textContent='+10.0 dB');document.querySelector('.is-dialogue .live-figure__text').textContent='+6.0 dB · −6.0 dB';document.querySelector('.is-environment .live-figure__text').textContent='−9.0 dB'",
      );
      const panels = ['footsteps', 'dialogue', 'environment'];
      for (let panel = 0; panel < panels.length; panel += 1) {
        const part = panels[panel];
        await evaluate(
          `document.querySelector('.is-${part}').scrollIntoView({block:'center'})`,
        );
        await frame();
        const screenshot = await send('Page.captureScreenshot', {
          format: 'png',
        });
        fs.writeFileSync(
          path.join(output, `${width}-${locale}-${zoom}-${part}.png`),
          Buffer.from(screenshot.data, 'base64'),
        );
      }
      results.push({
        width,
        locale,
        zoom,
        controls: before.length,
        stable: true,
      });
    }
    if (errors.length) {
      throw new Error(JSON.stringify(errors));
    }
    fs.writeFileSync(
      path.join(output, 'results.json'),
      JSON.stringify(results, null, 2),
    );
    process.stdout.write(`${JSON.stringify(results)}\n`);
  } finally {
    socket?.close();
    browser.kill();
    server.close();
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
