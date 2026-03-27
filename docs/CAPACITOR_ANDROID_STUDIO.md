# Android Studio: open the Capacitor Android project

## 1. Use the `android` folder only

Do **not** open the monorepo root (`Bedi Delivery`). There is no `:app` Gradle module there, so **Module** stays `<no module>`.

| App    | Folder to open in Android Studio |
|--------|------------------------------------|
| Customer | `capacitor/customer/android` |
| Driver   | `capacitor/driver/android` |
| Tenant   | `capacitor/tenant/android` |

**File → Open…** → select that **`android`** directory (the one that contains `settings.gradle` and `app/`).

## 2. Install JS deps for that shell (required for Gradle)

Capacitor’s `settings.gradle` pulls in projects from `../node_modules/`. If that folder is missing, sync fails and no modules appear.

From the repo root:

```bash
npm run build:mobile:customer
```

(or `build:mobile:driver` / `build:mobile:tenant`)

Or manually:

```bash
cd capacitor/customer && npm install && npx cap sync
```

## 3. Sync Gradle

After opening the project: **File → Sync Project with Gradle Files** (or the elephant icon). Wait until it finishes. The **app** module should then appear in the run configuration **Module** dropdown (often named like `bedi-customer-android.app`).

## 4. If you still see “Module not specified”

1. **Build → Sync Project with Gradle Files** again and check the **Build** tool window for red errors.
2. **File → Invalidate Caches… → Invalidate and Restart**.
3. Still broken: quit Android Studio, delete inside that `android` folder:
   - `.idea` (IDE metadata; it will be recreated)
   - `.gradle` (local Gradle cache for this project)
   
   Re-open the same **`android`** folder and sync again.

## 5. JDK

Use **JDK 21** (Android Studio’s bundled **jbr-21** is fine): **Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK**.

## 6. `local.properties`

`local.properties` must define `sdk.dir` (Android Studio usually creates it). It should **not** be committed if it contains machine-specific paths; on a new machine, open the SDK Manager once so the IDE can recreate it.
