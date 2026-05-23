# Frotap Driver App

App mobile Android (e iOS) para motoristas da plataforma **Frotap** de gestão de frotas. React Native + Expo SDK 51, TypeScript estrito, pronto para compilar APK via EAS Build.

## O que o app faz

- Login de motorista (Supabase Auth, JWT salvo no SecureStore).
- Lista viagens atribuídas, mostra detalhes e atalho pro Google Maps.
- **Rastreamento GPS em tempo real** durante viagem ativa, com:
  - Captura em foreground + background (foreground service no Android).
  - Velocidade, direção, precisão, altitude e bateria.
  - Fila offline persistente (AsyncStorage) com sync automático ao reconectar.
  - Keep-awake durante a viagem.
- Registro rápido de **abastecimento** (envia pra aprovação no painel admin).
- Registro de **ocorrência** com tipo, descrição e localização GPS.
- Tela de perfil + ajustes (precisão GPS, fila offline, abrir permissões do sistema).
- LGPD: aviso explícito de GPS ativo durante viagem.

## Estrutura

```
driver-app/
├── src/
│   ├── assets/                 # ícones, splash (adicionar suas imagens aqui)
│   ├── components/             # Button, Input, ScreenContainer, Header, TripCard, StatusBadge, EmptyState
│   ├── config/                 # env.ts (variáveis), theme.ts (cores/spacing/text)
│   ├── contexts/               # AuthContext
│   ├── hooks/                  # useLocationTracking
│   ├── navigation/             # RootNavigator (stack + tabs)
│   ├── screens/                # Login, ForgotPassword, Home, Trips, TripDetails, ActiveTrip, Fuel, Occurrence, Profile, Settings, Notifications
│   ├── services/               # api.ts (axios), auth.ts, driverApi.ts, locationService.ts (TaskManager)
│   └── storage/                # secure.ts (SecureStore), offlineLocationQueue.ts (AsyncStorage)
├── App.tsx
├── index.js
├── app.json
├── eas.json
├── babel.config.js
├── metro.config.js
├── tsconfig.json
├── package.json
└── .env.example
```

## Setup

```bash
cd driver-app
npm install
cp .env.example .env
# preencha SUPABASE_URL, SUPABASE_ANON_KEY, API_BASE_URL
```

Variáveis usadas (prefixadas com `EXPO_PUBLIC_` para chegarem ao bundle):

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_API_BASE_URL=https://YOUR-PROJECT.supabase.co/rest/v1
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
```

## Rodar em desenvolvimento

```bash
npx expo start
```

Use o app **Expo Go** (Android/iOS) ou rode em emulador:

```bash
npx expo run:android
```

## Gerar APK (preview, sem Play Store)

Via EAS Build (recomendado — não precisa de Mac/Linux):

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

O APK é gerado na nuvem; baixe pelo link no terminal ou painel `expo.dev/builds`.

## Gerar APK local (Android Studio / gradlew)

Requer JDK 17, Android SDK 34, Gradle:

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease   # ou assembleDebug
```

APK final em:

```
android/app/build/outputs/apk/release/app-release.apk
```

## Permissões Android (já no app.json)

- `INTERNET`
- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION`
- `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_LOCATION`
- `POST_NOTIFICATIONS`
- `CAMERA`
- `READ_MEDIA_IMAGES`
- `WAKE_LOCK`

A captura em background usa `expo-task-manager` + `expo-location` com `foregroundService` (Android 14+ exige `FOREGROUND_SERVICE_LOCATION`).

## Backend

O app fala direto com **Supabase REST + Auth** — não há server intermediário. As tabelas relevantes (já no monorepo `../supabase/migrations/`):

- `drivers`, `vehicles`, `trips`
- `gps_points` (insert a cada ~5s durante viagem)
- `fuel_logs`, `trip_occurrences`

RLS isola por `company_id`; o motorista só consegue ler/escrever dados da sua empresa e suas viagens (papel `driver`).

## Critérios de aceite (status)

- [x] Estrutura completa para compilar APK
- [x] Login JWT salvo com segurança (SecureStore)
- [x] Listar viagens atribuídas
- [x] Visualizar detalhes da viagem
- [x] Iniciar viagem (solicita permissão GPS)
- [x] Captura GPS em foreground + background
- [x] Envio de coordenadas para o backend
- [x] Fila offline com sync automático
- [x] Registrar abastecimento
- [x] Registrar ocorrência (com GPS)
- [x] Finalizar viagem (encerra rastreio)
- [x] LGPD: aviso visível, GPS só com viagem ativa

## Notas

- `src/assets/` está vazio — adicione `icon.png` (1024x1024), `adaptive-icon.png`, `splash.png` antes do build.
- O `eas.json` está configurado com `appVersionSource: "local"`; bump `version` e `android.versionCode` no `app.json` a cada release.
- Para usar `react-native-maps` no Android, configure a chave do Google Maps em `app.json` (campo `android.config.googleMaps.apiKey`).
