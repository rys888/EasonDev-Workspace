# Phase 4.2.1 water reference

Studied reference:

- Repository: https://github.com/Sui-IB/InternalBeyond
- Source inspected: `InternalBeyond.html`, current `main`, water renderer around
  lines 27111–27405 as retrieved on 2026-10-12.
- License inspected: root `LICENSE`, current `main`.

The reference code is covered by PolyForm Noncommercial License 1.0.0 plus the
repository's required notice and attribution terms. No source code or visual
assets were copied into Eason's Room.

The independent implementation only adopts the general numerical technique:
a low-resolution two-buffer height field, local impulses, fixed-step wave
propagation and gradient-based light/dark shading. Component structure,
interaction policy, palette, constants, lifecycle and renderer code are original
for Eason's Blog.
