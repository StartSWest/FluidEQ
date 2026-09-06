import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import GraphAutoCycle from 'renderer/graph/GraphAutoCycle';
import { readGraphAutoCycle } from 'renderer/utils/graphAutoCycle';

describe('Auto selector', () => {
  beforeEach(() => localStorage.clear());

  it('offers the intervals, remembers the choice, and can be switched off', () => {
    render(
      <GraphAutoCycle
        selectedLookId="bars-signal"
        isWaveHidden={false}
        isEditing={false}
      />,
    );
    const trigger = screen.getByRole('menu', {
      name: 'Automatic visualizer switching',
    });
    expect(trigger).toHaveTextContent('Auto: Off');
    fireEvent.click(trigger);
    expect(screen.getAllByRole('menuitem')).toHaveLength(6);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Auto: 30s' }));
    expect(trigger).toHaveTextContent('Auto: 30s');
    expect(readGraphAutoCycle()).toBe(30);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Auto: Off' }));
    expect(readGraphAutoCycle()).toBe(0);
  });

  it('disables switching when the visualizer is hidden', () => {
    render(
      <GraphAutoCycle
        selectedLookId="bars-signal"
        isWaveHidden
        isEditing={false}
      />,
    );
    const trigger = screen.getByRole('menu', {
      name: 'Automatic visualizer switching',
    });
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(trigger);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});
