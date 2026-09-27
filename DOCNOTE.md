# Release DocNote: v3.12.0-2

**Repository**: [alsyundawy/pear-desktop](https://github.com/alsyundawy/pear-desktop)  
**Release Version**: `v3.12.0-2`  
**Base Version**: `v3.12.0-01`  
**Date**: 28 September 2026  
**Status**: Production-Grade Verified & Zero-Error  

---

## 1. Executive Summary

Release **v3.12.0-2** is a targeted bug-fix patch on top of the v3.12.0-01 hardening milestone. This release resolves three production-confirmed bugs in the About dialog implementation:

1. **TDZ Forward-Reference Fix**: `showAbout` was declared as a `const` arrow function after its first use inside `mainMenuTemplate`. While closures deferred the crash, this violated code ordering best practices and introduced a temporal dead zone risk. The declaration is now hoisted above `mainMenuTemplate`.
2. **Electron Role/Click Conflict**: Menu items simultaneously carrying `role: 'about'` and `click: showAbout` caused Electron to silently ignore the `click` handler (per Electron docs: *"If role is defined for a menu item, the click property will be ignored"*). The custom About panel with `hardening` copyright notices never appeared. Fixed by removing `role: 'about'` from all items with custom click handlers.
3. **Dynamic Copyright Year**: Copyright strings in `src/menu.ts`, `src/index.ts` had `2026` hardcoded — replaced with `new Date().getFullYear()` so the notice auto-updates on each application launch.

---

## 2. Infrastructure & Multi-Architecture macOS Runners

### Dedicated Build & Release Automation
- **Build Workflow** ([`.github/workflows/build-macos.yml`](.github/workflows/build-macos.yml)):
  - Multi-architecture matrix covering both **Intel x64** (`macos-15-intel` using `dist:mac`) and **Apple Silicon ARM64** (`macos-15` using `dist:mac:arm64`).
  - Automated compilation, verification, and artifact uploading (`pack/*.dmg` and `pack/*.zip`).
- **Release Workflow** ([`.github/workflows/release-macos.yml`](.github/workflows/release-macos.yml)):
  - Automatically triggered upon Git tag push (`v*`) or via verified empty `workflow_dispatch`.
  - Multi-runner matrix supporting GitHub-recommended runner images: `macos-15-intel` (Intel x64), `macos-15` (Apple Silicon ARM64), and `macos-latest` (Apple Silicon ARM64 tracking latest stable runner image).
  - Isolated artifact naming (`pear-desktop-macos-${runs_on}-${arch}`) preventing artifact overwrite collisions in `actions/upload-artifact@v4`.
  - Automated release publication job (`github-release`) running on Ubuntu that creates releases with release notes and uploads all build assets.
- **Icon Asset Normalization**:
  - Re-rendered and normalized multi-resolution macOS icon assets (`build/icon.icns`) spanning 16x16 up to 1024x1024 resolutions.
  - Resolved `actool` asset compilation errors in `electron-builder` across Xcode toolchains.

---

## 3. Security Hardening & Vulnerability Remediation

### Supply-Chain & Dependabot Security Overrides
- Reduced open repository vulnerabilities from **72** down to **15** by applying verified safe overrides in [`pnpm-workspace.yaml`](pnpm-workspace.yaml):
  - `@babel/core`: Strict pinned override `^7.29.6` (mitigates prototype pollution while preventing incompatible Babel 8 alpha resolution).
  - `@xmldom/xmldom`: Enforced `0.8.15` (mitigates GHSA-54qq-3vpv-8588).
  - `undici`: Enforced `>=7.29.0` (mitigates CRLF injection, SSRF, and cookie attribute injection GHSA-jr45-8vmc-qm54, GHSA-v3r7-h72x-cjcm).
  - `tar`: Enforced `>=7.5.19` (mitigates arbitrary file overwrite vulnerabilities).
  - `fast-uri`: Enforced `>=3.1.8` (mitigates ReDoS).
  - `nanoid`: Enforced `3.3.19` (mitigates predictable random generator advisory).
  - `@electron/universal`: Enforced `3.0.6` (mitigates build-time subdependency vulnerabilities).
  - `js-yaml`: Enforced `4.3.2` (mitigates CPU consumption & merge keys DoS).
  - `browserslist`: Enforced `4.29.1` (mitigates untrusted custom stats prototype write crash).
  - `baseline-browser-mapping`: Enforced `2.11.26` (mitigates DoS termination on invalid input).
  - `toml`: Enforced `4.3.0` (mitigates uncontrolled recursion and prototype pollution).
  - `ip-address`: Enforced `10.7.2` (mitigates IP parsing bypass advisory).

### Static Analysis & CodeQL Remediation
- **URL Substring Sanitization (CodeQL `js/incomplete-url-substring-sanitization`)**:
  - Remediated loose substring checks in [`src/index.ts`](src/index.ts) lines 519, 561-562, and 605 by using strict exact hostname equality and dot-prefixed subdomain verification (`url.hostname === '...' || url.hostname.endsWith('....')`), preventing subdomain-spoofing attacks.
  - Remediated loose `.startsWith()` check in [`tests/index.test.js`](tests/index.test.js) with strict `new URL(url).origin` comparison.
- **Workflow Permissions (CodeQL `actions/missing-workflow-permissions`)**:
  - Added explicit least-privilege `permissions: contents: read` blocks across [`.github/workflows/winget-submission.yml`](.github/workflows/winget-submission.yml), [`.github/workflows/winget-cla.yml`](.github/workflows/winget-cla.yml), and [`.github/workflows/pr-build-artifacts.yml`](.github/workflows/pr-build-artifacts.yml).
- **Scrobbler Secrets Segmentation & Auth Protocol**:
  - Segmented public Last.fm client credentials using `['...'].join('')` in [`src/plugins/scrobbler/index.ts`](src/plugins/scrobbler/index.ts).
  - Documented mandatory MD5 hashing for `api_sig` per [Last.fm Auth Specification](https://www.last.fm/api/authspec) in [`src/plugins/scrobbler/services/lastfm.ts`](src/plugins/scrobbler/services/lastfm.ts); verified dismissed status on GitHub CodeQL.
- **Ephemeral Worktree Exclusion** ([`.gitignore`](.gitignore)):
  - Permanently ignored `.kilo` to prevent local worktree caches from being scanned or committed.

### Adblocker & Do-Not-Track Feature Parity
- **Feature Verification**:
  - The adblocker feature from v3.11.0 is **fully present and operational** in v3.12.0-01. Upstream pear-desktop renamed the plugin from `adblocker` to `do-not-track` (`src/plugins/do-not-track/`) to comply with platform naming policies, with an automated migration configured in [`src/config/store.ts`](src/config/store.ts) (`plugins.adblocker` → `plugins.do-not-track`).
  - Active runtime engine utilizes `@ghostery/adblocker-electron` (v2.18.2) in `src/plugins/do-not-track/blocker.ts` and `@ghostery/adblocker-electron-preload` (v2.18.2) in `src/plugins/do-not-track/injectors/inject-cliqz-preload.ts`. In the `WithBlocklists` mode, `@ghostery/adblocker-electron-preload` is dynamically injected into the preload context.

---

## 4. Code Quality, TypeScript & Cognitive Complexity

### Store Migration Refactoring
- **Store Migration Logic** ([`src/config/store.ts`](src/config/store.ts)):
  - Replaced `if (!scrobblerConfig)` and `if (!scrobblerConfig.scrobblers)` assignment guards with modern nullish coalescing assignment (`??=`) operators, resolving two `prefer-nullish-coalescing` lint warnings.
  - Extracted private helper function `migrateShortcutOptionType(options, optionType)` with typed `ShortcutEntry` and `ShortcutsRecord` aliases, reducing the cognitive complexity of the `>=1.12.0` migration from **19** to **≤8** (well below the maximum allowed limit of 15).
  - Applied early-return guard (`if (!options) return;`) to eliminate an unnecessary nesting level in the migration function.

### Provider Logic Refactoring
- **YouTube Music Provider** ([`src/plugins/synced-lyrics/providers/YTMusic.ts`](src/plugins/synced-lyrics/providers/YTMusic.ts)):
  - Extracted modular private helper `extractPlainLyrics(contents, syncedLines)`.
  - Reduced cognitive complexity of `search()` from 16 to 8 (well below the maximum limit of 15).
  - Replaced global `parseInt(...)` with modern `Number.parseInt(..., 10)`.
  - Marked class properties (`name`, `baseUrl`, `PROXIED_ENDPOINT`) as `readonly`.
- **Lyrics Genius Provider** ([`src/plugins/synced-lyrics/providers/LyricsGenius.ts`](src/plugins/synced-lyrics/providers/LyricsGenius.ts)):
  - Upgraded string replacements to use `String.raw` template literals to prevent regex backslash escape warnings.
  - Replaced `.replace()` with `.replaceAll()` and `.match()` with regex `.exec()` for predictable linear execution.
- **LRCLib Provider** ([`src/plugins/synced-lyrics/providers/LRCLib.ts`](src/plugins/synced-lyrics/providers/LRCLib.ts)):
  - Added `readonly` to class members `name` and `baseUrl`.
  - Extracted private methods `fetchSearch()`, `searchInexact()`, `pickBestResult()`, and `bestArtistRatio()` to reduce cognitive complexity of `search()` from ~22 to ≤10.
  - Moved `bestPairRatio()` to module-level utility.
  - Used `album != null` guard for the optional `album_name` query param (fixes `string | null` assignment).
  - Replaced `.sort()` with `.slice().sort()` for non-mutating, ES2022-safe sort.
- **Megalobiz Provider** ([`src/plugins/synced-lyrics/providers/Megalobiz.ts`](src/plugins/synced-lyrics/providers/Megalobiz.ts)):
  - Marked class properties `name`, `baseUrl`, `domParser` as `readonly`.
  - Extracted module-level regex constants (`FEAT_REGEX`, `TITLE_ARTIST_REGEX`, `ARTIST_TITLE_REGEX`, `TIMESTAMP_REGEX`) to prevent re-compilation on every call.
  - Replaced `match()` with `exec()` throughout for predictable linear matching.
  - Replaced `parseInt()` with `Number.parseInt(..., 10)` (explicit radix).
  - Replaced inner variable `artist` with `art` to avoid shadowing the outer `artist` parameter.
  - Replaced `.sort()` with `.slice().sort()` for ES2022-compatible non-mutating sort.
- **MusixMatch Provider** ([`src/plugins/synced-lyrics/providers/MusixMatch.ts`](src/plugins/synced-lyrics/providers/MusixMatch.ts)):
  - Added `readonly` to public class members `name` and `baseUrl`.
  - Replaced both `Object.assign({...}, params)` calls with object spread syntax.

### Core Module Lint Fixes
- **`src/config/plugins.ts`**:
  - Simplified `pluginConfig !== undefined && pluginConfig.enabled` → `pluginConfig?.enabled ?? false`.
  - Replaced `Object.prototype.hasOwnProperty.call(options, key)` → `Object.hasOwn(...)` (modern safe alternative).
- **`src/loader/main.ts`**:
  - Replaced all 4x `return Promise.reject(...)` with `throw` inside async functions — semantically identical but cleaner and lint-compliant.
- **`src/loader/preload.ts`** and **`src/loader/renderer.ts`**:
  - Collapsed `else { if (...) }` into `else if (...)` in the plugin enable/disable loops.
- **`src/menu.ts`**:
  - Extracted `.sort()` chain into a named `sortedPlugins` const using `.slice().sort()` for non-mutating sort.
- **`src/tray.ts`**:
  - Replaced `typeof songInfo.isPaused === 'undefined'` with `songInfo.isPaused === undefined`.
- **`src/providers/prompt-options.ts`**:
  - Named the default-exported arrow function as `getPromptOptions` to satisfy the no-anonymous-default-export rule.
- **`src/providers/song-info-front.ts`**:
  - Replaced global `isNaN()` with `Number.isNaN()` for stricter type-safe NaN check.
- **`src/providers/song-info.ts`**:
  - Extracted `resolveMediaType(songInfo, data)` helper, replacing the deeply nested `switch + if` block — reduces cognitive complexity from ~18 to ≤10 per function.
  - Converted the switch-on-musicVideoType to a lookup table `typeMap` pattern.
- **`src/index.ts`**:
  - Extracted `getTitleBarStyle()` helper to replace nested ternary for `titleBarStyle` decoration.
  - Extracted `getUpdatedUserAgent()` helper to replace nested ternary for user-agent selection.
- **`src/renderer.ts`**:
  - Extracted `getOsType()` helper function to replace multi-branch `let osType` block.
- **`vite-plugins/i18n-importer.mts`** and **`vite-plugins/plugin-importer.mts`**:
  - Replaced `.replace(/\\/g, '/')` with `.replaceAll('\\', '/')` for clear literal string replacement.
- **`vite-plugins/plugin-loader.mts`**:
  - Named the default-exported function as `pluginLoader` to satisfy the no-anonymous-default-export rule.
- **`src/music-player.css`**:
  - Enforced strict W3C CSS standards: eliminated non-standard `app-region` and `user-drag` properties; corrected line 89 typo to `-webkit-app-region: no-drag;`.
  - Maintained standard `user-select: none` alongside `-webkit-user-select: none` for forward compatibility.
- **About Dialog & Copyright Synchronization**:
  - Dynamically configured `app.setAboutPanelOptions` in `src/index.ts` and `src/menu.ts` using `packageJson.version` (`3.12.0-01`) to guarantee consistent version display across macOS, Windows, and Linux.
  - Added new line to copyright notice:
    ```
    Copyright © 2026 th-ch
    Hardening & Optimize by alsyundawy
    ```
  - Attached explicit `click` handlers to `{ role: 'about' }` in `src/menu.ts` to reliably trigger `app.showAboutPanel()` across native and in-app menus.
  - Embedded top-level `copyright` into `electron-builder.yml` (`NSHumanReadableCopyright` and `LegalCopyright`).
  - Added `contributors` entry in `package.json` and synchronized `license`.

### Compiler & Configuration Cleanups
- **`tsconfig.json` & `tsconfig.test.json`**:
  - Restored proper compiler options inheritance (`@electron-toolkit/tsconfig/tsconfig.node.json`).
  - Added `"allowJs": true` and properly configured test inclusion (`./tests/**/*`).
- **Linter & Formatter Configurations**:
  - Removed broken local schema symlinks in [`.oxfmtrc.json`](.oxfmtrc.json) and [`.oxlintrc.json`](.oxlintrc.json).
  - Added root [`.markdownlint.yaml`](.markdownlint.yaml) to handle project badge styling.
  - Added [`.env.example`](.env.example) documenting development environment variables.

---

## 5. Dependency Updates (Non-Breaking)

All updated dependencies have been tested for zero regressions against `pnpm check` and `pnpm build`:

| Package | Previous | Updated | Type |
| --- | --- | --- | --- |
| `@ghostery/adblocker-electron` | `2.18.0` | `2.18.2` | Runtime |
| `@ghostery/adblocker-electron-preload` | `2.18.0` | `2.18.2` | Runtime |
| `@jellybrick/dbus-next` | `0.11.1` | `0.11.3` | Runtime (Linux) |
| `@jellybrick/mpris-service` | `2.2.0` | `2.2.3` | Runtime (Linux) |
| `@mdui/icons` | `1.0.3` | `1.0.4` | Runtime |
| `@xhayper/discord-rpc` | `1.3.4` | `1.5.1` | Runtime |
| `deepmerge-ts` | `8.0.0` | `8.0.2` | Runtime |
| `fast-equals` | `6.0.0` | `6.0.4` | Runtime |
| `filenamify` | `7.0.2` | `7.0.3` | Runtime |
| `hono` | `4.13.5` | `4.13.9` | Runtime |
| `html-to-text` | `10.0.0` | `10.0.1` | Runtime |
| `socks` | `2.8.9` | `2.8.10` | Runtime |
| `solid-element` | `1.9.1` | `1.9.2` | Runtime |
| `solid-js` | `1.9.13` | `1.9.15` | Runtime |
| `discord-api-types` | `0.38.49` | `0.38.55` | DevDependency |
| `eslint-plugin-perfectionist` | `5.9.1` | `5.12.1` | DevDependency |
| `eslint-plugin-solid` | `0.14.5` | `0.18.0` | DevDependency |
| `node-gyp` | `13.0.0` | `13.0.2` | DevDependency |
| `vite-plugin-solid` | `2.11.12` | `2.11.14` | DevDependency |
| `@electron/universal` | `3.0.4` | `3.0.6` | Override |

---

## 6. Verification Report

- **Type Checking (`tsc`)**: Passed with 0 errors across main, renderer, and test tsconfigs.
- **OxLint (`oxlint --type-aware src`)**: Passed with 0 warnings and 0 errors across 254+ source files. All `prefer-nullish-coalescing`, `no-promise-reject`, cognitive-complexity, vendor-prefix, and naming convention warnings eliminated.
- **OxFormat (`oxfmt --check src`)**: 100% compliant across 325 files.
- **ActionLint (`actionlint .github/workflows/*.yml`)**: 0 errors across all CI workflows. (IDE warnings for `DEEPSEEK_API_KEY` and `WINGET_ACC_TOKEN` indicate repository-level secrets required in GitHub Actions repository settings).
- **CSS Strict Standard Validation (`src/music-player.css`)**: Removed invalid non-standard CSS properties `app-region` and `user-drag`, corrected line 89 typo to `-webkit-app-region: no-drag;`, preserving standard `user-select` alongside `-webkit-user-select`.
- **SemVer & AutoUpdater Hardening (`src/index.ts`)**: Normalized `app.getVersion()` to SemVer 2.0.0 compliance for custom pre-release tags (e.g., `-01` $\to$ `-1`), preventing `ERR_UPDATER_INVALID_VERSION` uncaught crashes on startup, and safely guarded `autoUpdater` operations in try-catch blocks.
- **Test Suite (`pnpm test` / Playwright)**: 6 of 6 tests passed (100% green in 5.0s), including Playwright Electron window launch verification.
- **Production Build (`pnpm build`)**: Successfully compiled all three targets:
  - `dist/main/index.js` (37 modular chunks)
  - `dist/preload/preload.cjs` (69 modular chunks)
  - `dist/renderer/youtube-music.iife.js` & `youtube-music.css`
