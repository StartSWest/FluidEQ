# Contributing to FluidEQ

Thanks for helping build a better open-source audio experience.

## Before you start

1. Search existing issues before opening a duplicate.
2. For a significant feature or architecture change, open an issue first so the
   approach can be discussed.
3. Keep changes focused and preserve all applicable copyright and license
   notices inherited from AQUA and other upstream sources.

## Local workflow

```powershell
pnpm install
pnpm dev
```

Before submitting a pull request, run:

```powershell
pnpm build
pnpm test:unit
pnpm lint
```

If a check cannot run on your platform, say so clearly in the pull request.

## Pull requests

- Explain what changed and why.
- Include manual test steps for behavior that touches Windows audio endpoints or
  Equalizer APO.
- Add or update tests when practical.
- Include screenshots for visible UI changes.
- Do not include proprietary presets, Dolby assets, private data, secrets, or
  generated build output.

By contributing, you agree that your contribution is licensed under GPL-3.0-or-
later, the license used by this project.
