import { Group, RoundedRect } from "@shopify/react-native-skia";
import { memo } from "react";
import type { SharedValue } from "react-native-reanimated";

import type { PreClearScene, SceneGeometry } from "../types";

function PreClearLayerImpl({
  highlights,
  geometry,
  opacity,
}: {
  highlights: PreClearScene;
  geometry: SceneGeometry;
  opacity: number | SharedValue<number>;
}) {
  return (
    <Group opacity={opacity}>
      {highlights.map(({ orientation, index, rect, visual }) => (
        <Group key={`${orientation}-${index}`}>
          <RoundedRect {...rect} r={geometry.cellRadius} color={visual.fill} />
          <RoundedRect
            x={rect.x + visual.edgeWidth / 2}
            y={rect.y + visual.edgeWidth / 2}
            width={rect.width - visual.edgeWidth}
            height={rect.height - visual.edgeWidth}
            r={geometry.cellRadius}
            color={visual.edge}
            style="stroke"
            strokeWidth={visual.edgeWidth}
          />
        </Group>
      ))}
    </Group>
  );
}

export const PreClearLayer = memo(PreClearLayerImpl);
