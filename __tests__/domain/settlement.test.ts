import { createInitialGameState } from "../../src/domain/game";
import type { GameState } from "../../src/domain/gameTypes";
import { defaultProfile } from "../../src/services/storage/schemas";
import { computeBoltsEarned, runId, settleRun } from "../../src/services/profile/settlement";

const NOW = 1_752_800_000_000;

function finishedRun(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createInitialGameState("settle-seed", NOW),
    status: "gameOver",
    score: 5300,
    bestCombo: 8,
    linesCleared: 20,
    piecesPlaced: 40,
    piecesDefused: 6,
    explosions: 3,
    rubbleCleared: 12,
    ...overrides,
  };
}

describe("computeBoltsEarned", () => {
  it("is floor(score / 250) + pieces defused", () => {
    expect(computeBoltsEarned(finishedRun({ score: 5300, piecesDefused: 6 }))).toBe(21 + 6);
    expect(computeBoltsEarned(finishedRun({ score: 0, piecesDefused: 0 }))).toBe(0);
    expect(computeBoltsEarned(finishedRun({ score: 249, piecesDefused: 2 }))).toBe(0 + 2);
  });
});

describe("settleRun", () => {
  it("banks bolts, raises best score/combo, and accumulates stats", () => {
    const profile = { ...defaultProfile(NOW), bestScore: 4000, bestCombo: 10, bolts: 100 };
    const { profile: next, boltsEarned } = settleRun(profile, finishedRun(), NOW + 1);

    expect(boltsEarned).toBe(21 + 6);
    expect(next.bolts).toBe(100 + 27);
    expect(next.bestScore).toBe(5300); // 5300 > 4000
    expect(next.bestCombo).toBe(10); // 10 > 8 kept
    expect(next.totalRuns).toBe(1);
    expect(next.piecesPlaced).toBe(40);
    expect(next.linesCleared).toBe(20);
    expect(next.piecesDefused).toBe(6);
    expect(next.explosions).toBe(3);
    expect(next.rubbleCleared).toBe(12);
    expect(next.revivesUsed).toBe(0);
    expect(next.updatedAt).toBe(NOW + 1);
  });

  it("keeps the higher existing best score and counts a revive", () => {
    const profile = { ...defaultProfile(NOW), bestScore: 9999 };
    const { profile: next } = settleRun(profile, finishedRun({ reviveUsed: true }), NOW);
    expect(next.bestScore).toBe(9999);
    expect(next.revivesUsed).toBe(1);
  });

  it("accumulates across two settled runs", () => {
    const first = settleRun(defaultProfile(NOW), finishedRun(), NOW).profile;
    const second = settleRun(first, finishedRun({ score: 1000, piecesDefused: 1 }), NOW).profile;
    expect(second.totalRuns).toBe(2);
    expect(second.piecesPlaced).toBe(80);
    expect(second.bolts).toBe(27 + (4 + 1));
  });
});

describe("runId", () => {
  it("is stable for the same run and differs across runs", () => {
    const a = finishedRun();
    expect(runId(a)).toBe(runId({ ...a }));
    expect(runId(a)).not.toBe(runId({ ...a, startedAt: NOW + 1 }));
  });
});
