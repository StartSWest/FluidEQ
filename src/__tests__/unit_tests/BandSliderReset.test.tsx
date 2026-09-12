import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  FilterTypeEnum,
  NO_GAIN_FILTER_TYPES,
  getDefaultFilterWithId,
} from 'common/constants';
import FrequencyBand from 'renderer/components/FrequencyBand';
import {
  FilterActionEnum,
  FluidEqProviderWrapper,
} from 'renderer/utils/FluidEqContext';
import defaultContext from '__tests__/utils/mockFluidEqProvider';
import { setGain } from 'renderer/utils/equalizerApi';

jest.mock('renderer/utils/equalizerApi', () => ({
  setGain: jest.fn(),
  removeEqualizerSlider: jest.fn(),
}));
const pointerDown = (target: Element, options: MouseEventInit) =>
  fireEvent(
    target,
    new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...options,
    }),
  );

describe('band slider reset', () => {
  const dispatchFilter = jest.fn();
  const onSelect = jest.fn();
  const onGainChange = jest.fn();
  const filter = {
    ...getDefaultFilterWithId(),
    frequency: 120,
    gain: 6,
    quality: 3.4,
  };
  const mount = (type = FilterTypeEnum.PK) =>
    render(
      <FluidEqProviderWrapper value={{ ...defaultContext, dispatchFilter }}>
        <FrequencyBand
          filter={{ ...filter, type }}
          isMinSliderCount={false}
          onSelect={onSelect}
          onGainChange={onGainChange}
        />
      </FluidEqProviderWrapper>,
    );
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-12T12:00:00Z'));
    jest.mocked(setGain).mockResolvedValue(undefined);
    onGainChange.mockResolvedValue(undefined);
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each([{ ctrlKey: true }, { metaKey: true }])(
    'resets only the clicked gain with %o and prevents a native drag or selection change',
    async (modifier) => {
      mount();
      await act(async () => {
        expect(pointerDown(screen.getByRole('slider'), modifier)).toBe(false);
      });
      expect(setGain).toHaveBeenCalledWith(filter.id, 0);
      expect(dispatchFilter).toHaveBeenCalledWith({
        type: FilterActionEnum.GAIN,
        id: filter.id,
        newValue: 0,
      });
      expect(onSelect).not.toHaveBeenCalled();
      expect(onGainChange).not.toHaveBeenCalled();
    },
  );

  it('keeps ordinary dragging and Ctrl-click caption selection working', async () => {
    mount();
    await act(async () => {
      pointerDown(screen.getByRole('slider'), {});
      fireEvent.change(screen.getByRole('slider'), { target: { value: '8' } });
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onGainChange).toHaveBeenCalledWith(filter.id, 8);
    expect(setGain).not.toHaveBeenCalled();
    pointerDown(screen.getByRole('button', { name: 'Edit 120 Hz band' }), {
      ctrlKey: true,
    });
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(setGain).not.toHaveBeenCalled();
  });

  it('replaces a queued drag value with the reset rather than restoring the old gain later', async () => {
    mount();
    await act(async () => {
      fireEvent.change(screen.getByRole('slider'), { target: { value: '8' } });
      fireEvent.change(screen.getByRole('slider'), { target: { value: '12' } });
      pointerDown(screen.getByRole('slider'), { ctrlKey: true });
      await jest.advanceTimersByTimeAsync(100);
    });
    expect(onGainChange).toHaveBeenCalledTimes(1);
    expect(onGainChange).toHaveBeenCalledWith(filter.id, 8);
    expect(setGain).toHaveBeenLastCalledWith(filter.id, 0);
  });

  it('ignores disabled sliders and right clicks', async () => {
    const { unmount } = mount(NO_GAIN_FILTER_TYPES[0]);
    await act(async () => {
      pointerDown(screen.getByRole('slider'), { ctrlKey: true });
    });
    expect(setGain).not.toHaveBeenCalled();
    unmount();
    mount();
    await act(async () => {
      pointerDown(screen.getByRole('slider'), { ctrlKey: true, button: 2 });
    });
    expect(setGain).not.toHaveBeenCalled();
  });
});
