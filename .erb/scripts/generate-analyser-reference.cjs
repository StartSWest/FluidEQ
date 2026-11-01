/**
 * Chromium's own AnalyserNode, read over a fixed signal, for
 * `coreAnalyser.test.ts` to hold the core's copy of it to
 * (`src/core/liveFrames/analyser.ts`). Run with the project's Electron, so
 * the readings are the Chromium the app ships:
 *
 *   node_modules/electron/dist/electron.exe .erb/scripts/generate-analyser-reference.cjs
 *
 * Writes `src/__tests__/data/read_only/liveFrames/chromium-analyser.json` and
 * quits. Nothing is played: an OfflineAudioContext renders into memory. The
 * signal is `analyserSignal.ts`'s, written out again here because it runs in
 * the page; change one and the other in the same commit.
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const OUT = path.join(
  __dirname,
  '../../src/__tests__/data/read_only/liveFrames/chromium-analyser.json',
);

const page = `
(async () => {
  const RATE = 48000;
  const LENGTH = 16384;
  let seed = 0x5eed1234;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const tone = (frequency, n) => Math.sin((2 * Math.PI * frequency * n) / RATE);
  const context = new OfflineAudioContext(2, LENGTH, RATE);
  const buffer = context.createBuffer(2, LENGTH, RATE);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  for (let n = 0; n < LENGTH; n += 1) {
    left[n] = Math.fround((random() * 2 - 1) * 0.05 + 0.5 * tone(440, n) + 0.2 * tone(60, n));
    right[n] = Math.fround((random() * 2 - 1) * 0.05 + 0.25 * tone(1000, n) + 0.2 * tone(60, n));
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  analyser.connect(context.destination);
  const reads = [
    { frame: 4096, smoothing: 0 },
    { frame: 5760, smoothing: 0.04 },
    { frame: 7424, smoothing: 0.04 },
    { frame: 11264, smoothing: 0.2 },
  ];
  const out = [];
  reads.forEach(({ frame, smoothing }) => {
    context.suspend(frame / RATE).then(() => {
      analyser.smoothingTimeConstant = smoothing;
      const frequency = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(frequency);
      out.push({
        frame,
        smoothing,
        frequencyDb: Array.from(frequency, (value) =>
          Number.isFinite(value) ? Math.round(value * 1e5) / 1e5 : null),
      });
      context.resume();
    });
  });
  source.start();
  await context.startRendering();
  return out;
})()`;

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false });
  await window.loadURL('data:text/html,<title>analyser reference</title>');
  const reads = await window.webContents.executeJavaScript(page);
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      chromium: process.versions.chrome,
      rate: 48000,
      length: 16384,
      reads,
    }),
  );
  console.log(
    `${reads.length} readings from Chromium ${process.versions.chrome}`,
  );
  app.quit();
});
