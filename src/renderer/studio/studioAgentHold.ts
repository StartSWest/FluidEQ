import { useEffect } from 'react';

/**
 * Whether the member is in the middle of something on the Studio's open
 * project — a dialog on it, or typing not yet saved in the code pane — so
 * their AI must not switch the Studio to another project under them
 * (`useStudioAgent.ts`).
 *
 * Every one of those acts on "the open project" when it finishes: Publish
 * sends whatever project is open at the press, the framing dialog saves into
 * it, the code pane writes into it. Switched mid-way, the member's work goes
 * to the project their AI was looking at, or is thrown away. The picture the
 * AI asked for does not need the switch — it is drawn from the folder — so a
 * held Studio costs it nothing.
 */

const holds = new Set<symbol>();

export const isStudioHeld = () => holds.size > 0;

/** Holds the Studio on its project for as long as `held` is true and this is mounted. */
export const useStudioAgentHold = (held: boolean) => {
  useEffect(() => {
    if (!held) {
      return undefined;
    }
    const hold = Symbol('studio hold');
    holds.add(hold);
    return () => {
      holds.delete(hold);
    };
  }, [held]);
};
