/** @jest-environment node */
import {
  createChromaClient,
  type TChromaHttp,
} from 'main/lighting/chromaClient';

it('keeps queued key overlays paired with their copied canvas and sends only the newest waiting frame', async () => {
  const success = { status: 200, body: '{"result":0}' };
  let finish: (reply: typeof success) => void = () => {
    throw Error('No effect in flight');
  };
  let puts = 0;
  const request = jest
    .fn<ReturnType<TChromaHttp>, Parameters<TChromaHttp>>()
    .mockImplementation((method) => {
      if (method === 'POST') {
        return Promise.resolve({
          status: 200,
          body: '{"uri":"http://localhost:12345/chromasdk"}',
        });
      }
      if (method === 'PUT') {
        puts += 1;
        if (puts === 1) {
          return new Promise((resolve) => {
            finish = resolve;
          });
        }
      }
      return Promise.resolve(success);
    });
  const client = createChromaClient(jest.fn(), request);
  client.frame();
  await Promise.resolve();
  const rgb = new Uint8Array(6 * 22 * 3).fill(10);
  const keys = new Uint32Array(6 * 22).fill(0x010a0a0a);
  client.send('keyboard', rgb, keys);
  rgb.fill(20);
  keys.fill(0x01141414);
  client.send('keyboard', rgb, keys);
  rgb.fill(30);
  keys.fill(0x011e1e1e);
  client.send('keyboard', rgb, keys);
  rgb.fill(0);
  keys.fill(0);
  finish(success);
  await Promise.resolve();
  const effects = request.mock.calls
    .filter(([method]) => method === 'PUT')
    .map(([, , body]) => JSON.parse(body!));
  expect(effects).toHaveLength(2);
  expect(effects[0].param.color[0][0]).toBe(0x0a0a0a);
  expect(effects[0].param.key[0][0]).toBe(0x010a0a0a);
  expect(effects[1].param.color[0][0]).toBe(0x1e1e1e);
  expect(effects[1].param.key[0][0]).toBe(0x011e1e1e);
  client.release();
});
