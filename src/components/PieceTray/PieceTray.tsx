import { Pressable, StyleSheet, View } from "react-native";

import type { HandPiece } from "../../domain/gameTypes";
import { getShapeById } from "../../domain/shapes";
import { colors, neonGlow, radius, spacing } from "../../ui/theme";
import { pieceColor } from "../../ui/pieceColors";

type PieceTrayProps = {
  hand: readonly HandPiece[];
  selectedHandId: string | null;
  onSelect: (handId: string) => void;
};

const SLOT_SIZE = 64;
const MINI_CELL = 14;
const MINI_GAP = 2;

function MiniShape({ shapeId, colorId }: { shapeId: string; colorId: string }) {
  const shape = getShapeById(shapeId);
  if (!shape) {
    return null;
  }
  const accent = pieceColor(colorId);
  const maxRow = Math.max(...shape.cells.map((cell) => cell.row));
  const maxColumn = Math.max(...shape.cells.map((cell) => cell.column));
  const width = (maxColumn + 1) * (MINI_CELL + MINI_GAP) - MINI_GAP;
  const height = (maxRow + 1) * (MINI_CELL + MINI_GAP) - MINI_GAP;

  return (
    <View style={{ width, height }}>
      {shape.cells.map((cell) => (
        <View
          key={`${cell.row}-${cell.column}`}
          style={[
            styles.miniCell,
            {
              top: cell.row * (MINI_CELL + MINI_GAP),
              left: cell.column * (MINI_CELL + MINI_GAP),
              backgroundColor: `${accent}33`,
              borderColor: accent,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function PieceTray({ hand, selectedHandId, onSelect }: PieceTrayProps) {
  return (
    <View style={styles.tray} testID="piece-tray">
      {hand.map((piece) => {
        const selected = piece.handId === selectedHandId;
        return (
          <Pressable
            key={piece.handId}
            onPress={() => onSelect(piece.handId)}
            style={[
              styles.slot,
              selected && styles.slotSelected,
              selected && neonGlow(pieceColor(piece.colorId), "low"),
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${piece.colorId} ${piece.shapeId} piece`}
            accessibilityState={{ selected }}
            testID={`tray-piece-${piece.handId}`}
          >
            <MiniShape shapeId={piece.shapeId} colorId={piece.colorId} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  slot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: radius.panel,
    backgroundColor: colors.surfaceBg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  slotSelected: {
    borderColor: colors.onSurface,
    transform: [{ scale: 1.08 }],
  },
  miniCell: {
    position: "absolute",
    width: MINI_CELL,
    height: MINI_CELL,
    borderWidth: 1,
    borderRadius: 2,
  },
});
