/* FluidEQ — GPL-3.0-or-later */

const COLOUR = /^#[0-9a-f]{6}$/i;
const OWN_STYLE = /\s*\/\* FluidEQ colour \*\/[\s\S]*?\/\* FluidEQ end \*\//g;
const withoutColour = (style) => (style ?? '').replace(OWN_STYLE, '');

/** Transient actor styles: no desktop preferences, input regions or overlays. */
export default class DesktopColours {
  constructor(panel, group) {
    this.panel = panel;
    this.group = group;
    this.bindings = new Map();
    this.colour = null;
    this.added = null;
  }

  set(colour) {
    if (!COLOUR.test(colour)) {
      return;
    }
    this.colour = colour;
    if (this.added === null) {
      this.added = this.group.connect('child-added', (_group, child) =>
        this.findDocks(child),
      );
    }
    this.bind(this.panel);
    this.findDocks(this.group);
    this.bindings.forEach((_signals, actor) => this.paint(actor));
  }

  findDocks(actor, inDock = false) {
    const dock = inDock || actor.name === 'dashtodockContainer';
    if (dock && actor.has_style_class_name?.('dash-background')) {
      this.bind(actor);
    }
    actor.get_children?.().forEach((child) => this.findDocks(child, dock));
  }

  paint(actor) {
    const current = actor.get_style();
    const next = `${withoutColour(current)} /* FluidEQ colour */background-color: ${this.colour};/* FluidEQ end */`;
    // Dock transparency and Shell theme changes rewrite inline styles. React
    // to that event, keeping their other declarations and avoiding recursion
    // from our own identical style notification.
    if (next !== current) {
      actor.set_style(next);
    }
  }

  bind(actor) {
    if (this.bindings.has(actor)) {
      return;
    }
    this.bindings.set(actor, [
      actor.connect('notify::style', () => this.paint(actor)),
      actor.connect('destroy', () => this.bindings.delete(actor)),
    ]);
    this.paint(actor);
  }

  stop() {
    if (this.added !== null) {
      this.group.disconnect(this.added);
      this.added = null;
    }
    this.bindings.forEach((signals, actor) => {
      signals.forEach((signal) => actor.disconnect(signal));
      const current = actor.get_style();
      const restored = withoutColour(current);
      if (restored !== current) {
        actor.set_style(restored || null);
      }
    });
    this.bindings.clear();
    this.colour = null;
  }
}
