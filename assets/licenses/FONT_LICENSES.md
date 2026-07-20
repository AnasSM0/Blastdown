# Font Licenses

BlastDown loads two typeface families at runtime via `expo-font`, delivered as
npm packages under `@expo-google-fonts` (no font binaries are committed to this
repo). Both are licensed under the **SIL Open Font License 1.1 (OFL)**, which
permits bundling and redistribution in an app. Attribution is not required in
the app UI, but the copyright/OFL notice is retained here.

| Family         | Faces used                    | Package                             | License     | Attribution  |
| -------------- | ----------------------------- | ----------------------------------- | ----------- | ------------ |
| Geist          | 400 Regular, 600 SemiBold     | `@expo-google-fonts/geist`          | SIL OFL 1.1 | Not required |
| JetBrains Mono | 500 Medium, 600 SemiBold, 700 | `@expo-google-fonts/jetbrains-mono` | SIL OFL 1.1 | Not required |

- **Geist** — © Vercel. Provided via Google Fonts under the SIL OFL 1.1.
- **JetBrains Mono** — © JetBrains s.r.o. Provided via Google Fonts under the
  SIL OFL 1.1.

Usage (docs/STYLE_GUIDE.md typography):

- Geist → UI text, labels, buttons, body.
- JetBrains Mono → all numeric displays (score, timer badges, stat values).

The full OFL text ships with each `@expo-google-fonts` package under
`node_modules/@expo-google-fonts/<family>/`. Font family names are referenced
by string in `src/ui/theme.ts`; the faces are loaded in `src/ui/fonts.ts`. If
loading fails, React Native falls back to the system font automatically.
