# Architecture

```text
experiments-guanyu-lab/
├── registry/
├── experiments/
│   └── motion-surface/
│       ├── ms-01-jelly-motion/
│       └── ms-02-jelly-switch/
├── packages/
│   ├── design-tokens/
│   ├── lab-shell/
│   └── experiment-runtime/
├── docs/
└── scripts/
```

The shell is shared and frozen; renderer and physics cores remain owned by each experiment. Registry metadata is the machine-readable catalogue used by the wider GUANYU LAB ecosystem.
