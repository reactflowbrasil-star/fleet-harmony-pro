# Assets

Antes de fazer build de produção, adicione aqui:

- `icon.png` — 1024×1024 PNG (sem transparência)
- `adaptive-icon.png` — 1024×1024 PNG, foreground do adaptive icon Android (com transparência)
- `splash.png` — 1284×2778 PNG (splash do iOS) ou centrado, fundo cobrirá

Esses caminhos são referenciados em `app.json` (`expo.icon`, `expo.android.adaptiveIcon.foregroundImage`, `expo.splash.image`).

Para gerar rapidamente: use ferramentas como [easyappicon.com](https://easyappicon.com/) ou a CLI `npx expo install expo-asset` + design no Figma.
