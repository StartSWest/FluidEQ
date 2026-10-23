/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An output's battery, as the Output and Second output cards show it: the
 * level drawn and named, a level only from a reading that succeeded, and a
 * fresh reading each time the card or its pane comes into view.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { IAudioDevice } from 'common/constants';
import SidebarSection from 'renderer/components/SidebarSection';
import { I18nProvider } from 'renderer/utils/I18nContext';
import useReadWhenShown from 'renderer/utils/useReadWhenShown';
import withoutBatteryLevels from 'renderer/utils/withoutBatteryLevels';
import BatteryLevel from 'renderer/widgets/BatteryLevel';

const device = (over: Partial<IAudioDevice>): IAudioDevice => ({
  id: '{0.0.0.00000000}.{AAAA}',
  name: 'Headset',
  guid: '{AAAA}',
  isDefault: true,
  isActive: true,
  ...over,
});

const level = (percent: number) =>
  render(
    <I18nProvider>
      <BatteryLevel percent={percent} />
    </I18nProvider>,
  );

describe('the battery level', () => {
  it('names the level and shows it', () => {
    level(70);
    const battery = screen.getByRole('img', { name: 'Battery 70%' });
    expect(battery).toHaveTextContent('70%');
    expect(battery).not.toHaveClass('is-low');
    expect(battery).not.toHaveClass('is-empty');
  });

  it('turns amber at 20% and red at 10%, not before', () => {
    const { unmount } = level(21);
    expect(screen.getByRole('img')).not.toHaveClass('is-low');
    unmount();

    const low = level(20);
    expect(screen.getByRole('img')).toHaveClass('is-low');
    expect(screen.getByRole('img')).not.toHaveClass('is-empty');
    low.unmount();

    level(10);
    expect(screen.getByRole('img')).toHaveClass('is-empty');
    expect(screen.getByRole('img')).not.toHaveClass('is-low');
  });

  it('keeps a reported level inside 0 to 100, as a whole number', () => {
    const { unmount } = level(130);
    expect(screen.getByRole('img', { name: 'Battery 100%' })).toBeVisible();
    unmount();
    level(-4.6);
    expect(screen.getByRole('img', { name: 'Battery 0%' })).toBeVisible();
  });

  it('still draws where an empty battery is', () => {
    const { container } = level(0);
    const fill = container.querySelector('.battery-level__fill');
    expect(Number(fill?.getAttribute('width'))).toBeGreaterThan(0);
  });
});

describe('a reading that failed', () => {
  it('keeps every output and drops every level', () => {
    const listed = [
      device({ batteryPercent: 70 }),
      device({ id: 'speakers', name: 'Speakers', batteryPercent: null }),
    ];
    const after = withoutBatteryLevels(listed);
    expect(after.map((each) => each.id)).toEqual([
      '{0.0.0.00000000}.{AAAA}',
      'speakers',
    ]);
    expect(after.some((each) => 'batteryPercent' in each)).toBe(false);
  });

  it('hands back the same list when nothing carried a level', () => {
    const listed = [device({}), device({ batteryPercent: null })];
    expect(withoutBatteryLevels(listed)).toBe(listed);
  });
});

describe('reading again when shown', () => {
  it('reads each time it comes into view, and not on mount or on leaving', () => {
    const read = jest.fn();
    const { rerender } = renderHook(
      ({ isShown }: { isShown: boolean }) => useReadWhenShown(isShown, read),
      { initialProps: { isShown: true } },
    );
    expect(read).not.toHaveBeenCalled();

    rerender({ isShown: false });
    expect(read).not.toHaveBeenCalled();

    rerender({ isShown: true });
    expect(read).toHaveBeenCalledTimes(1);

    rerender({ isShown: true });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('tells a card it was opened, and not that it was folded', () => {
    const onOpen = jest.fn();
    render(
      <SidebarSection title="Second output" defaultOpen={false} onOpen={onOpen}>
        <p>outputs</p>
      </SidebarSection>,
    );
    const header = screen.getByRole('button', { name: /Second output/ });

    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
