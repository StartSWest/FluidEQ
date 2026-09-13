import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { IWindowsHold } from 'common/lighting/lightingModel';
import LightingWindowsNotice from 'renderer/plus/lighting/LightingWindowsNotice';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, values?: Record<string, string>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

const openWindowsLightingSettings = jest.fn(async () => undefined);

beforeEach(() => {
  openWindowsLightingSettings.mockClear();
  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: { openWindowsLightingSettings },
  };
});

const hold = (overrides: Partial<IWindowsHold>): IWindowsHold => ({
  reason: 'waiting',
  devices: ['Logitech G915 X'],
  above: [],
  resetNeeded: false,
  foregroundFirst: false,
  vendors: [],
  ...overrides,
});

const steps = () =>
  screen.queryAllByRole('listitem').map((item) => item.textContent);

it('walks through handing the device to FluidEQ, naming what is above it', () => {
  render(
    <LightingWindowsNotice
      hold={hold({
        reason: 'not-first',
        above: ['WindowsLighting', 'RazerDynamicLighting_qemfkr3nbbywc'],
        resetNeeded: true,
        vendors: ['logitech'],
      })}
      onLater={() => undefined}
    />,
  );
  expect(steps()).toEqual([
    'lighting.windows.step.open',
    'lighting.windows.step.reset',
    `lighting.windows.step.dragAbove ${JSON.stringify({
      above: 'lighting.windows.controller and Razer Chroma',
    })}`,
    'lighting.windows.step.wait',
  ]);
  expect(screen.getByText('lighting.windows.vendor.logitech')).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'lighting.notice.windows.action' }),
  );
  expect(openWindowsLightingSettings).toHaveBeenCalledWith('lighting');
});

it('opens the developer page for a copy that needs Developer Mode', () => {
  render(
    <LightingWindowsNotice
      hold={hold({ reason: 'needs-developer-mode', vendors: ['razer'] })}
      onLater={() => undefined}
    />,
  );
  expect(steps()).toEqual([
    'lighting.windows.step.openDevelopers',
    'lighting.windows.step.developerMode',
    'lighting.windows.step.comeBack',
  ]);
  // Maker tips are about Windows' own page; they would only distract here.
  expect(screen.queryByText('lighting.windows.vendor.razer')).toBeNull();
  const open = screen.getByRole('button', {
    name: 'lighting.windows.action.developers',
  });
  // The recommended action wears the filled style, the decline the quiet one.
  expect(open).not.toHaveClass('subtle');
  expect(screen.getByRole('button', { name: 'output.notNow' })).toHaveClass(
    'subtle',
  );
  fireEvent.click(open);
  expect(openWindowsLightingSettings).toHaveBeenCalledWith('developers');
});

it('offers no Settings page where no setting would help', () => {
  const later = jest.fn();
  render(
    <LightingWindowsNotice
      hold={hold({ reason: 'unavailable' })}
      onLater={later}
    />,
  );
  expect(screen.getAllByRole('button')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'output.notNow' }));
  expect(later).toHaveBeenCalled();
});

it('tells the member about a game in front only while Windows is handing over', () => {
  render(
    <LightingWindowsNotice
      hold={hold({ reason: 'waiting', foregroundFirst: true })}
      onLater={() => undefined}
    />,
  );
  expect(steps()).toEqual(['lighting.windows.step.foreground']);
});
