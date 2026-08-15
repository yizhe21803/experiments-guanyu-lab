# GUANYU LAB Repository Standard v1

1. Discoverable GUANYU LAB repositories MUST end with `-guanyu-lab`.
2. Small related experiments belong in `experiments-guanyu-lab`.
3. Larger independent products use their own `<slug>-guanyu-lab` repository.
4. Every experiment has a unique ID and `experiment.json`.
5. Every source-adapted experiment has `SOURCE.md`.
6. Released experiments inherit the frozen lab-shell contract.
7. Renderer/physics remain experiment-owned until an abstraction is proven across at least three works.
8. Auto-demo/runtime infrastructure must not contaminate renderer/shader state.
9. `registry/experiments.json` is the catalogue source of truth.
10. Released snapshots are protected by `FREEZE_MANIFEST.json` checksums.
