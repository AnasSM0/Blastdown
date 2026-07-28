/** Jest stand-in for `@shopify/react-native-skia`.
 *
 *  Skia draws through a native canvas, and its own jest setup wants a real
 *  CanvasKit WASM build loaded by a custom jest environment. Adopting that would
 *  replace `jest-expo`'s environment for the entire suite to gain pixels no test
 *  asserts on. This mock takes the other road: the Skia tree mounts and unmounts
 *  cleanly and draws nothing.
 *
 *  The consequence is deliberate and shapes the renderer's design. `Canvas`
 *  renders `null`, so nothing inside it runs under jest — which means no logic
 *  worth testing may live inside it. Everything that decides WHAT to draw is a
 *  pure module outside the canvas (`scene.ts`, `geometry.ts`, `palette.ts`,
 *  `effects/effectModel.ts`) and is tested directly; the canvas subtree only
 *  turns that description into draw calls. Anything the canvas alone could get
 *  wrong is a pixel question, and pixel questions are settled on the device.
 *
 *  `__tests__/rendering/skiaMockParity.test.ts` guards the other half: it asserts
 *  every name mocked here still exists in the real package, so an upstream
 *  rename fails the suite instead of failing silently on a phone. */
import type { ReactNode } from "react";

/** A drawing element: it exists, it accepts children, it renders nothing. */
const Draw = (_props: { children?: ReactNode; [key: string]: unknown }) => null;

/** `Canvas` renders null rather than its children. See the note above — this is
 *  what keeps testable logic out of the canvas subtree by construction. */
export const Canvas = Draw;

export const Group = Draw;
export const Rect = Draw;
export const RoundedRect = Draw;
export const Circle = Draw;
export const Line = Draw;
export const Path = Draw;
export const Points = Draw;
export const Text = Draw;
export const Fill = Draw;
export const Paint = Draw;
export const Shadow = Draw;
export const Blur = Draw;
export const BlurMask = Draw;
export const LinearGradient = Draw;
export const RadialGradient = Draw;
export const Picture = Draw;
export const Mask = Draw;
export const DashPathEffect = Draw;

export const vec = (x = 0, y = 0) => ({ x, y });

export const rect = (x = 0, y = 0, width = 0, height = 0) => ({ x, y, width, height });

export const rrect = (r: any, rx = 0, ry = 0) => ({ rect: r, rx, ry });

export const createPicture = (_draw: (canvas: unknown) => void) => ({ __picture: true });

export const useFont = () => null;
export const matchFont = () => null;
export const useFonts = () => null;

const path = {
  Make: () => ({
    moveTo() {
      return this;
    },
    lineTo() {
      return this;
    },
    close() {
      return this;
    },
    addRRect() {
      return this;
    },
    addRect() {
      return this;
    },
  }),
};

/** A paint that REMEMBERS what it was given.
 *
 *  Not gratuitous. Skia composites a `saveLayer` using only the paint's alpha,
 *  colour filter, image filter and blend mode — a mask filter set on that paint
 *  is silently ignored. The renderer shipped exactly that mistake once, paying
 *  for an offscreen layer and getting no blur, and a source-scanning test
 *  certified it because the code *looked* right.
 *
 *  Recording the setters lets a test ask what the paint actually carries, which
 *  is the only question that distinguishes a working bloom from a wasted layer
 *  without a device. */
export type RecordedPaint = {
  imageFilter: unknown;
  maskFilter: unknown;
  colorFilter: unknown;
  setImageFilter: (value: unknown) => void;
  setMaskFilter: (value: unknown) => void;
  setColorFilter: (value: unknown) => void;
  setColor: () => void;
  setAlphaf: () => void;
  setBlendMode: () => void;
  setAntiAlias: () => void;
  setStyle: () => void;
  setStrokeWidth: () => void;
};

function makePaint(): RecordedPaint {
  const paint: RecordedPaint = {
    imageFilter: null,
    maskFilter: null,
    colorFilter: null,
    setImageFilter(value) {
      paint.imageFilter = value;
    },
    setMaskFilter(value) {
      paint.maskFilter = value;
    },
    setColorFilter(value) {
      paint.colorFilter = value;
    },
    setColor() {},
    setAlphaf() {},
    setBlendMode() {},
    setAntiAlias() {},
    setStyle() {},
    setStrokeWidth() {},
  };
  return paint;
}

export const Skia = {
  Path: path,
  Paint: makePaint,
  MaskFilter: {
    MakeBlur: (style: unknown, sigma: unknown) => ({ __maskFilter: true, style, sigma }),
  },
  ImageFilter: {
    MakeBlur: (sigmaX: unknown, sigmaY: unknown, mode: unknown) => ({
      __imageFilter: true,
      sigmaX,
      sigmaY,
      mode,
    }),
  },
  Color: (value: unknown) => value,
  Point: vec,
  XYWHRect: rect,
  RRectXY: rrect,
};

export const BlurStyle = { Normal: 0, Solid: 1, Outer: 2, Inner: 3 } as const;
export const BlendMode = { Plus: "plus", SrcOver: "srcOver", Screen: "screen" } as const;
export const PaintStyle = { Fill: 0, Stroke: 1 } as const;
export const StrokeCap = { Butt: 0, Round: 1, Square: 2 } as const;
export const StrokeJoin = { Miter: 0, Round: 1, Bevel: 2 } as const;
export const TileMode = { Clamp: "clamp", Decal: "decal" } as const;
export const FilterMode = { Linear: "linear", Nearest: "nearest" } as const;
export const MipmapMode = { None: "none", Linear: "linear" } as const;
