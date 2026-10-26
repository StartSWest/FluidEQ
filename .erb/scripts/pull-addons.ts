import { pullAddons } from './addons';

// `pnpm dev` runs this first: every add-on that is a git repository of its
// own is brought up to date (fast-forward only) before development loads it.
pullAddons();
