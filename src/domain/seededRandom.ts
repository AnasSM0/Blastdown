export type RandomResult = {
  value: number;
  nextState: number;
};

export function createInitialRngState(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function nextRandom(state: number): RandomResult {
  const nextState = (state + 0x6d2b79f5) | 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextState };
}

export function nextInt(state: number, maxExclusive: number): RandomResult {
  const { value, nextState } = nextRandom(state);
  return { value: Math.floor(value * maxExclusive), nextState };
}
