import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";

import type { BoardImpulse } from "../../ui/effects/eventEffects";
import { motionKey } from "../../ui/motionKey";

export type IdentifiedBoardImpulse = BoardImpulse & { id: string };

type BoardImpulseFrameProps = {
  children: ReactNode;
  impulse: IdentifiedBoardImpulse | null;
  reducedMotion: boolean;
};

// Two queue-cap windows are enough to remember any survivor that can reappear
// after a newer effect retires, without retaining an endless run's identities.
const MAX_REMEMBERED_IMPULSES = 12;

/** Moves the fallback board and its transient overlay as one visual object.
 *
 * The cinematic renderer applies the same presentation contract to its canvas
 * group. Keeping this wrapper outside GameBoard means clear and explosion
 * impulses share one driver, and an overlay can never lag behind the board it
 * belongs to. */
export const BoardImpulseFrame = forwardRef<View, BoardImpulseFrameProps>(
  function BoardImpulseFrame({ children, impulse, reducedMotion }, ref) {
    const [offset] = useState(() => new Animated.Value(0));
    const playedIdsRef = useRef(new Set<string>());
    const impulseId = impulse?.id ?? null;
    const amplitudePx = impulse?.amplitudePx ?? 0;
    const durationMs = impulse?.durationMs ?? 0;

    useEffect(() => {
      offset.stopAnimation();
      offset.setValue(0);
      if (
        impulseId === null ||
        reducedMotion ||
        amplitudePx <= 0 ||
        playedIdsRef.current.has(impulseId)
      ) {
        return;
      }
      playedIdsRef.current.add(impulseId);
      if (playedIdsRef.current.size > MAX_REMEMBERED_IMPULSES) {
        const oldest = playedIdsRef.current.values().next().value as string | undefined;
        if (oldest !== undefined) {
          playedIdsRef.current.delete(oldest);
        }
      }

      const segment = Math.max(1, Math.round(durationMs / 4));
      const animation = Animated.sequence([
        Animated.timing(offset, {
          toValue: -amplitudePx * 0.55,
          duration: segment,
          useNativeDriver: true,
        }),
        Animated.timing(offset, {
          toValue: amplitudePx,
          duration: segment,
          useNativeDriver: true,
        }),
        Animated.timing(offset, {
          toValue: -amplitudePx * 0.4,
          duration: segment,
          useNativeDriver: true,
        }),
        Animated.timing(offset, {
          toValue: 0,
          duration: Math.max(1, durationMs - segment * 3),
          useNativeDriver: true,
        }),
      ]);
      animation.start();
      return () => {
        animation.stop();
        offset.setValue(0);
      };
    }, [amplitudePx, durationMs, impulseId, offset, reducedMotion]);

    return (
      <Animated.View
        key={motionKey(reducedMotion)}
        ref={ref}
        collapsable={false}
        testID="board-impulse-frame"
        style={[
          styles.frame,
          impulse !== null && !reducedMotion && impulse.amplitudePx > 0
            ? { transform: [{ translateX: offset }] }
            : undefined,
        ]}
      >
        {children}
      </Animated.View>
    );
  },
);

const styles = StyleSheet.create({
  frame: {
    height: "100%",
    width: "100%",
  },
});
