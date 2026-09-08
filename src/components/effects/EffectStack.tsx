import { memo } from "react";

import type { EffectSequence } from "../../ui/effects/effectQueue";
import { MAX_BOARD_PARTICLES } from "../../ui/effects/eventEffects";

import { EffectsLayer } from "./EffectsLayer";

type EffectStackProps = {
  /** Bottom-first. The caller has already applied the drawing order. */
  sequences: readonly EffectSequence[];
  cellSize: number;
  reducedMotion: boolean;
  onStarted?: (id: string, now: number) => void;
};

/** Every live effect, each drawn by its own layer.
 *
 *  The fallback renderer used to mount exactly one `EffectsLayer`, fed the
 *  animator's single `plan` and keyed by its single `effectKey`. The queue could
 *  hold six effects; five of them were retained, retired on schedule, and never
 *  drawn. On a device that is indistinguishable from an effect going missing.
 *
 *  Each layer is keyed by the effect's own id, which is what buys independence:
 *
 *   - Two effects of the same kind on different turns get different keys, so
 *     they mount as two layers rather than collapsing into one.
 *   - Removing one from the list unmounts only that layer. React keeps the
 *     others mounted, so their animations and their reported start times
 *     survive a sibling retiring.
 *   - A board state change re-renders this component but not the layers, so an
 *     ordinary placement cannot restart an effect in flight.
 *
 *  Order is the array order, which the animator has already sorted bottom-first,
 *  so a critical effect paints over a standard one.
 *
 *  Memoized because the game screen re-renders on every drag frame while this
 *  depends only on the effect list and the cell size. */
export const EffectStack = memo(function EffectStack({
  sequences,
  cellSize,
  reducedMotion,
  onStarted,
}: EffectStackProps) {
  if (cellSize <= 0 || sequences.length === 0) {
    return null;
  }

  let remainingFragments = MAX_BOARD_PARTICLES;

  return (
    <>
      {sequences.map((sequence) => {
        const fragmentLimit = Math.min(
          remainingFragments,
          sequence.explosion?.fragments.length ?? 0,
        );
        remainingFragments -= fragmentLimit;
        return (
          <EffectsLayer
            key={sequence.id}
            plan={sequence.plan}
            explosion={sequence.explosion}
            explosionFragmentLimit={fragmentLimit}
            cellSize={cellSize}
            reducedMotion={reducedMotion}
            effectId={sequence.id}
            onStarted={onStarted}
          />
        );
      })}
    </>
  );
});
