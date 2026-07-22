# Capturing `placed-block-visibility-fixed.jpg`

The placed-block visibility fix (`fix-placed-block-visibility`, commits
`0e16a77` + `aa81096`) needs an **on-device** after-screenshot for final
approval. No Android device/emulator is available on the build machine (no
`adb`, no SDK, no AVDs), so this shot must be taken on your hardware — it
cannot be produced here, and a fabricated image would be worse than none.

In the meantime, the analysis stand-in is
`placed-block-visibility-comparison-computed.svg` — a truthful before/after
computed from the real `blockSurface` colour math over the actual Reactor
board. It is **not** a device screenshot and does not replace one.

## Steps (device or emulator)

1. Check out the fix branch and start the app:
   ```
   git checkout fix-placed-block-visibility
   npx expo run:android        # or: npx expo start  → open on device
   ```
2. Start a run and place a few pieces of each colour (cyan / violet / amber),
   including at least one timed piece, so placed blocks, a timer badge, and an
   empty region are all on screen — matching
   `placed-block-visibility-regression.jpeg`.
3. Capture at the same resolution as the regression shot:
   ```
   adb exec-out screencap -p > "docs/current game images/placed-block-visibility-fixed.jpg"
   ```
   (or use the device's own screenshot, then crop to match).
4. Compare against `placed-block-visibility-regression.jpeg`:
   - placed cyan / violet / amber are clearly coloured, not near-black;
   - each placed block is clearly stronger than the empty cells behind it;
   - timer badges/contours sit on top without hiding the block body.
5. If it looks right, approve; the fix branch can then merge and polish resumes.

## Expected result (computed luminance, empty cell L=29)

| colour | BEFORE (shipped) | AFTER (fixed) |
| ------ | ---------------- | ------------- |
| cyan   | 49               | 121           |
| violet | 33 (≈ empty)     | 58            |
| amber  | 52               | 134           |
