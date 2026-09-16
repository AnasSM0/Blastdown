# Google Play Store Assets — BlastDown 1.0.0

This checklist inventories repository assets only. It does not claim that a
Play Console asset has been uploaded or approved.

| Asset                  | Play requirement / recommendation                                      | Repository evidence                                                                                                                                       | Status                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Play icon              | 512×512 PNG, final production artwork                                  | `assets/icon.png` is 1024×1024 and is suitable source artwork, but no reviewed 512×512 Play export exists                                                 | **OWNER ACTION REQUIRED** — export/review a dedicated 512×512 icon and upload it                                                |
| Feature graphic        | 1024×500 JPG or PNG, no alpha                                          | No final feature graphic exists under `assets/store/`                                                                                                     | **OWNER ACTION REQUIRED** — design, review, and upload                                                                          |
| Phone screenshots      | At least two; current portrait gameplay and UI on a real/release build | No release screenshots exist under `assets/store/`. Reference/debug captures in `docs/` are not store-ready evidence                                      | **OWNER ACTION REQUIRED** — capture from the signed release on a representative Android phone; do not use mock or debug screens |
| Launcher/adaptive icon | Android launcher icon and adaptive layers                              | `assets/icon.png`, `assets/adaptive-icon-background.png`, `assets/adaptive-icon-foreground.png`, and `assets/adaptive-icon-monochrome.png` are configured | **PASS** — inspect launcher rendering on physical light/dark launchers before rollout                                           |
| Splash branding        | Branded production splash                                              | `assets/splash-icon.png` and configured background are present                                                                                            | **PASS** — inspect cold start on a physical phone before rollout                                                                |

## Recommended screenshot sequence

1. Home screen with **Play** and the visual identity clearly visible.
2. Early gameplay showing shape placement and a readable 8×8 board.
3. Countdown danger state showing the game's central twist.
4. A row/column clear or multi-clear captured from the real release build.
5. Explosion and rubble aftermath.
6. Freeze and Defuse actions in a legitimate eligible state.
7. Results screen with score and immediate replay.
8. Settings/accessibility screen, including Reduced Motion and Privacy.

Use consistent portrait crops, avoid system notifications or personal data,
and keep all claims faithful to what the uploaded AAB provides. The owner must
approve final marketing copy and artwork in Play Console.
