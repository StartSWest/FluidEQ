# FluidEQ agent instructions

Read [`CLAUDE.md`](CLAUDE.md) before changing this repository.

`main` is the Windows build and the base inherited by `macos` and Linux.
Merge updates from `main` into the platform branch, keeping that platform's
adaptations on its own branch. Commit and push Mac-specific changes only to
`macos`, never to `main`. A viewport size alone does not identify macOS:
Windows display scaling can produce the same logical laptop dimensions.
