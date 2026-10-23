import { ReactNode, startTransition, useReducer } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { getDefaultFilterWithId, IFiltersMap } from 'common/constants';
import useEqPageBands from 'renderer/eq/useEqPageBands';
import filterReducer from 'renderer/utils/filterReducer';
import {
  FilterActionEnum,
  FluidEqProviderWrapper,
} from 'renderer/utils/FluidEqContext';
import defaultContext from '__tests__/utils/mockFluidEqProvider';

jest.mock('renderer/utils/equalizerApi', () => ({
  ...jest.requireActual('renderer/utils/equalizerApi'),
  setFilterValues: jest.fn().mockResolvedValue(undefined),
}));

/**
 * Ivan, 2026-10-03: "if I move the curve the slider move well but if I move
 * the slider the curve movement has a lag". A slider step was put in the
 * store as a transition, which React throws away whenever a newer update
 * arrives, so while the hand kept moving the graph never caught up. A step
 * now renders with the event that made it, as a drag on the graph does.
 *
 * Measured outside `act`, as a real input event is: an update the event
 * owes is rendered by the first microtask after it, a transition only by a
 * later task.
 */
const band = { ...getDefaultFilterWithId(), frequency: 1000, gain: 0 };

const Store = ({ children }: { children: ReactNode }) => {
  const [filters, dispatchFilter] = useReducer(filterReducer, {
    [band.id]: band,
  } as IFiltersMap);
  return (
    <FluidEqProviderWrapper
      value={{ ...defaultContext, filters, dispatchFilter }}
    >
      {children}
    </FluidEqProviderWrapper>
  );
};

const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
const wasActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
});
afterEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = wasActEnvironment;
});

/** An `input` event whose listener runs `step`, then one microtask. */
const inputEvent = async (step: () => void) => {
  const input = document.createElement('input');
  document.body.append(input);
  input.addEventListener('input', step);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await Promise.resolve();
  input.remove();
};

it('shows a slider step in the bands the graph draws from, in the event that made it', async () => {
  const { result } = renderHook(() => useEqPageBands(), { wrapper: Store });
  await inputEvent(() => result.current.handleBandGainPreview(band.id, 6));
  expect(result.current.filters[band.id]?.gain).toBe(6);
});

it('would not have shown it yet as a transition (positive control)', async () => {
  const { result } = renderHook(() => useEqPageBands(), { wrapper: Store });
  await inputEvent(() =>
    startTransition(() =>
      result.current.dispatchFilter({
        type: FilterActionEnum.GAIN,
        id: band.id,
        newValue: 6,
      }),
    ),
  );
  expect(result.current.filters[band.id]?.gain).toBe(0);
  await waitFor(() => expect(result.current.filters[band.id]?.gain).toBe(6));
});
