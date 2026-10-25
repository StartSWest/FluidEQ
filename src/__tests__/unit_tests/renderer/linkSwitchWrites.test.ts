/* FluidEQ — GPL-3.0-or-later */
import { LINK_SWITCHES_ON } from '../../../common/remoteAudio';
import createLinkSwitchWrites from '../../../renderer/remoteAudio/linkSwitchWrites';

it('applies the latest receive level after the in-flight change and never restores an older toggle', async () => {
  const apply: Array<() => void> = [];
  const write = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        apply.push(resolve);
      }),
  );
  const choose = createLinkSwitchWrites(write);
  const a = choose('pc', { ...LINK_SWITCHES_ON, volume: 0.2 });
  const b = choose('pc', { ...LINK_SWITCHES_ON, volume: 0.5 });
  const c = choose('pc', { ...LINK_SWITCHES_ON, volume: 0.8, muted: true });
  expect(write).toHaveBeenCalledTimes(1);
  apply[0]();
  await a;
  expect(write).toHaveBeenLastCalledWith('pc', {
    ...LINK_SWITCHES_ON,
    volume: 0.8,
    muted: true,
  });
  apply[1]();
  await Promise.all([b, c]);
  expect(write).toHaveBeenCalledTimes(2);
});
