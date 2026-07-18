import { StyleSheet, View } from "react-native";

import type { GridCell as DomainGridCell } from "../../domain/gameTypes";
import { colors, radius } from "../../ui/theme";
import { pieceColor } from "../../ui/pieceColors";

type GridCellProps = {
  cell: DomainGridCell;
  row: number;
  column: number;
  size: number;
};

function cellLabel(cell: DomainGridCell, row: number, column: number): string {
  const place = `row ${row + 1}, column ${column + 1}`;
  switch (cell.kind) {
    case "empty":
      return `Empty cell, ${place}`;
    case "timed":
      return `${cell.colorId} block with timer, ${place}`;
    case "normal":
      return `${cell.colorId} block, ${place}`;
    case "rubble":
      return `Rubble, ${place}`;
  }
}

/** Presentation of one board cell. The "glass" look is approximated with a
 *  translucent fill + colored border — deliberately no per-cell blur
 *  (docs/UI_REFERENCE_AUDIT.md item 9). */
export function GridCell({ cell, row, column, size }: GridCellProps) {
  const base = { width: size, height: size };

  let visual;
  switch (cell.kind) {
    case "empty":
      visual = styles.empty;
      break;
    case "rubble":
      visual = styles.rubble;
      break;
    case "timed":
    case "normal": {
      const accent = pieceColor(cell.colorId);
      visual = { backgroundColor: `${accent}22`, borderWidth: 1, borderColor: accent };
      break;
    }
  }

  return (
    <View
      style={[styles.cell, base, visual]}
      testID={`cell-${row}-${column}`}
      accessibilityLabel={cellLabel(cell, row, column)}
      accessible
    >
      {cell.kind === "rubble" ? (
        <>
          <View style={styles.crackA} />
          <View style={styles.crackB} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    borderRadius: radius.cell,
    overflow: "hidden",
  },
  empty: {
    backgroundColor: colors.boardBg,
    borderWidth: 1,
    borderColor: colors.boardFrame,
  },
  rubble: {
    backgroundColor: colors.boardFrame,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  crackA: {
    position: "absolute",
    width: "120%",
    height: 1.5,
    backgroundColor: colors.outline,
    transform: [{ rotate: "35deg" }],
    opacity: 0.7,
  },
  crackB: {
    position: "absolute",
    width: "80%",
    height: 1.5,
    backgroundColor: colors.outline,
    transform: [{ rotate: "-50deg" }],
    opacity: 0.5,
  },
});
