import { act, renderHook } from '@testing-library/react';
import type { GraphStyle } from '../../../../common/graphStyles';
import type { IScenePack } from '../../../../common/scenePacks';
import type { TEngineLookPhase } from '../../../../renderer/graph/engineLooks/EngineLookLayer';
import useLeavingEngineLook from '../../../../renderer/graph/engineLooks/useLeavingEngineLook';

/**
 * The engine's picture of the look being left, kept on screen while the next
 * one comes in (`useLeavingEngineLook`). Its canvas used to go with its
 * worker the moment another look was chosen, and the plot stood empty for a
 * tenth to four tenths of a second, measured frame by frame, before the new
 * look faded in from nothing (Ivan, 2026-09-28: "still doing the flashing
 * when switching viz").
 */

const packOf = (id: string) => ({ id }) as unknown as IScenePack;

const choose = () => {
  const phaseRef: { current: TEngineLookPhase } = { current: 'building' };
  const hook = renderHook(
    ({ style }: { style: GraphStyle }) =>
      useLeavingEngineLook({ style, pack: packOf(style) }, phaseRef),
    { initialProps: { style: 'ledbars' as GraphStyle } },
  );
  /** Chosen, as the trace canvas does it: its phase back to the start. */
  const pick = (style: GraphStyle) => {
    hook.rerender({ style });
    phaseRef.current = 'building';
  };
  const shown = () =>
    hook.result.current.layers.map((layer) => [layer.style, layer.leaving]);
  return { phaseRef, hook, pick, shown };
};

it('keeps the picture of a look the engine showed until the crossfade has taken it out', () => {
  const { phaseRef, hook, pick, shown } = choose();
  const [chosen] = hook.result.current.layers;
  phaseRef.current = 'showing';
  pick('neonbars');
  expect(shown()).toEqual([
    ['ledbars', true],
    ['neonbars', false],
  ]);
  // The same layer as before, so its worker and its picture are kept.
  expect(hook.result.current.layers[0].key).toBe(chosen.key);

  const host = document.createElement('div');
  act(() => hook.result.current.onLeavingHost(host));
  act(() => hook.result.current.fade(0));
  expect(host.style.opacity).toBe('1');
  act(() => hook.result.current.fade(0.5));
  expect(Number(host.style.opacity)).toBeCloseTo(0.75);
  // A crossfade started over by another choice never brings it back up.
  act(() => hook.result.current.fade(0.2));
  expect(Number(host.style.opacity)).toBeCloseTo(0.75);
  act(() => hook.result.current.fade(1));
  expect(shown()).toEqual([['neonbars', false]]);
});

it('leaves a look the engine had not shown yet to the page, which is drawing it', () => {
  const { phaseRef, pick, shown } = choose();
  phaseRef.current = 'drawing';
  pick('neonbars');
  expect(shown()).toEqual([['neonbars', false]]);
});

it('makes a look chosen again a layer of its own', () => {
  const { phaseRef, hook, pick } = choose();
  const [first] = hook.result.current.layers;
  phaseRef.current = 'showing';
  pick('neonbars');
  act(() => hook.result.current.fade(1));
  phaseRef.current = 'showing';
  pick('ledbars');
  const again = hook.result.current.layers.find((layer) => !layer.leaving);
  expect(again?.style).toBe('ledbars');
  expect(again?.key).not.toBe(first.key);
});
