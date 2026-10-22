# Setup Capacitor untuk Try-D (Android)

## Persyaratan

- Node.js 18+ (sudah ter-install)
- Android Studio 2023+ dengan Android SDK
- Java JDK 17+
- Gradle 8.0+

**Catatan:** Termux tidak mendukung build Android APK. Setup berikut hanya untuk development di mesin desktop.

## Instalasi di Mesin Development

### 1. Clone dan setup repo

```bash
git clone https://github.com/r14bz/TryOn.git
cd TryOn
npm install
```

### 2. Tambahkan platform Android

```bash
npm run cap:add
# atau manual:
npx cap add android
```

Perintah ini akan membuat folder `android/` dengan Gradle project.

### 3. Buka di Android Studio

```bash
npm run cap:open
# atau manual:
npx cap open android
```

Ini akan membuka Android Studio dengan project siap di-build.

### 4. Sync dan Build

Di Android Studio:
1. Tunggu Gradle sync selesai (menu `File > Sync Now` jika perlu)
2. Pilih device atau emulator
3. Klik tombol "Run" atau tekan `Shift+F10`

Atau via CLI:

```bash
npm run cap:run
# Ini akan:
# - Build web app (npm run build)
# - Sync ke Android project
# - Deploy ke device/emulator yang terhubung
```

## Fitur Native yang Sudah Diintegrasikan

### 1. Camera & Gallery (`@capacitor/camera`)
- Ambil foto langsung dari kamera perangkat
- Pilih foto dari galeri

**File:**
- `src/utils/capacitorPlugins.ts` - Plugin wrapper
- `src/utils/useCapacitor.ts` - React hook
- `src/components/MobileActions.tsx` - UI komponen

**Penggunaan:**
```tsx
import { MobileActions } from './components/MobileActions';

export function App() {
  const [graphic, setGraphic] = useState<string>('');

  return (
    <MobileActions
      onImageSelected={(base64) => setGraphic(base64)}
      mockupBase64={mockupExport}
    />
  );
}
```

### 2. Filesystem (`@capacitor/filesystem`)
- Menyimpan mockup ke cache/storage lokal
- Persiapan untuk save ke galeri

### 3. Share (`@capacitor/share`)
- Bagikan mockup ke WhatsApp, Email, Media Sosial
- Integrasi dengan sistem share native Android

## Permissions (AndroidManifest.xml)

Kapasitor otomatis menambahkan permissions yang diperlukan. Pastikan `android/app/src/AndroidManifest.xml` memiliki:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

## Development Workflow

### Web Development
```bash
npm run dev
# http://localhost:3000
# Fitur Capacitor akan di-stub (tidak error di web)
```

### Android Development
```bash
npm run cap:sync   # Update web assets ke android/
npm run cap:open   # Buka di Android Studio
# Build dan run dari Android Studio
```

### Testing di Emulator
```bash
npm run build
npx cap sync android
npx cap run android
```

## Build APK untuk Release

Di Android Studio:
1. Menu `Build > Build Bundle(s) / APK(s) > Build APK(s)`
2. Atau untuk Google Play Store: `Build > Generate Signed Bundle / APK`

Via CLI:
```bash
cd android
./gradlew assembleRelease
# APK akan ada di: app/build/outputs/apk/release/
```

## Troubleshooting

### Gradle sync failed
```bash
cd android
./gradlew clean
./gradlew build
```

### Camera permission denied
- Emulator: Settings > Apps > Try-D > Permissions > Enable Camera
- Device: System Settings > Apps > Try-D > Permissions > Camera

### APK tidak install
```bash
adb uninstall com.tryd.app
npm run cap:run
```

## File Struktur

```
tryon3d/
├── capacitor.config.ts          # Konfigurasi Capacitor
├── src/
│   ├── utils/
│   │   ├── capacitorPlugins.ts  # Plugin wrapper
│   │   └── useCapacitor.ts      # React hook
│   └── components/
│       └── MobileActions.tsx    # UI komponen mobile
├── android/                      # Generated Gradle project
│   ├── app/
│   ├── build.gradle
│   └── gradlew
└── dist/                         # Build web output
```

## Next Steps

1. Update `App.tsx` untuk mengintegrasikan `MobileActions` di UI
2. Test di emulator Android atau device fisik
3. Untuk production: setup signing keys dan build release APK

## Referensi

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Capacitor Camera Plugin](https://capacitorjs.com/docs/apis/camera)
- [Capacitor Filesystem Plugin](https://capacitorjs.com/docs/apis/filesystem)
- [Capacitor Share Plugin](https://capacitorjs.com/docs/apis/share)
