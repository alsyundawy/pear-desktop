<p align="center">
  <a href="https://github.com/alsyundawy/pear-desktop">
    <img src="assets/icon.png" width="96" height="96" alt="Pear Desktop Application Logo">
  </a>
</p>

# Release DocNote: 3.11.5

**Repository**: [alsyundawy/pear-desktop](https://github.com/alsyundawy/pear-desktop)  
**Release Version**: `3.11.5` (`v3.11.5`)  
**Base Version**: `3.11.4` (`v3.11.4`, commit `3c78e6fa`)  
**Date**: 29 September 2026  
**Status**: Production-Grade Verified, Typecheck Clean, Security Hardened, Zero-Hallucination

---

## 1. Executive Summary

Release **3.11.5** (`v3.11.5`) is an official maintenance, feature backport, and security hardening release built strictly from base tag **v3.11.4**.

This release imports critical enhancements from `3.12.0-001` and `3.12.0` into the stable 3.11.x line without introducing breaking changes or affecting other release branches and tags. It features the advanced multi-vendor ad blocker suite (`do-not-track`), the expanded SponsorBlock controller with 8 segment categories, official branding and high-resolution icons, modern synced lyrics engine, robust About dialog logic, and comprehensive security remediation for `package.json` and `pnpm-lock.yaml`.

---

## 2. Feature & Architecture Backports

### 2.1 Ad Blocker / Do-Not-Track Suite (`src/plugins/do-not-track/`)
- **Source**: Backported from `v3.12.0-001`.
- **Legacy Replacement**: Cleanly removes legacy `src/plugins/adblocker/` implementation.
- **Multi-Vendor Blocklists**: Integrates 27+ vendor filter lists alongside HaGeZi threat intelligence and tracking blocklists.
- **Automated Fallback**: Automatically falls back to `@ghostery/adblocker-electron@2.18.2` prebuilt caching (`fromPrebuiltAdsAndTracking`) if remote list downloads are unavailable or rate-limited.
- **Ad Speedup Engine**: Includes `adSpeedup.ts` to accelerate and skip YouTube video advertisement streams instantaneously.
- **Seamless Store Migration**: Added automatic configuration migration in `src/config/store.ts` (`>=3.11.5`) that migrates existing user preferences from `plugins.adblocker` to `plugins.do-not-track`.
- **Internationalization**: Full localization strings added to `src/i18n/resources/en.json` and `src/i18n/resources/id.json`.

### 2.2 SponsorBlock Integration (`src/plugins/sponsorblock/`)
- **Source**: Backported from `v3.12.0-001`.
- **Full 8 Segment Categories**:
  - `sponsor`: Sponsor segments
  - `intro`: Intermission / Intro animation
  - `outro`: Endcards / Credits
  - `preview`: Preview / Recap
  - `filler`: Filler Tangent / Jokes
  - `music_offtopic`: Non-Music Section
  - `selfpromo`: Unpaid / Self Promotion
  - `interaction`: Interaction Reminder (Subscribe)
- **Native Checkbox Controls**: Per-category toggles with immediate persistence in application store and native menu items.
- **Network Safety**: Encodes video identifiers via `encodeURIComponent` to prevent malformed query parameters against the SponsorBlock API.
- **State Reset**: Cleans up active segment arrays (`currentSegments = []`) on playback stop.
- **Localization**: Category names and descriptions localized in `en.json` and `id.json`.

### 2.3 Synced Lyrics Modernization (`src/plugins/synced-lyrics/`)
- **Source**: Backported from upstream `v3.12.0`.
- **Multi-Provider Fallbacks**: Robust provider architecture supporting LRCLib, MusixMatch, Genius, Megalobiz, and YTMusic.
- **Reactive UI**: Reactive root and DOM observer implementation ensuring accurate synchronization with track progress.
- **DOM Utilities**: Added `DEFAULT_WAIT_OPTIONS` constant in `src/utils/wait-for-element.ts`.

### 2.4 Official Branding & Asset Suite (`assets/`)
- **Source**: Backported from `v3.12.0-001`.
- **High-Resolution Icons**: Updated `assets/icon.png` (high-res pear icon), `assets/icon.svg`, macOS native `assets/generated/icons/mac/icon.icns`, and complete multi-resolution PNG suite (`16x16`, `24x24`, `32x32`, `48x48`, `64x64`, `128x128`, `256x256`, `512x512`, `1024x1024`).
- **Media Controls & Banner**: Updated white media control icons (`play.png`, `pause.png`, `next.png`, `previous.png`) and application banner (`assets/pear-desktop-banner.jpg`).

### 2.5 About Panel Logic & Native Dialog (`src/menu.ts`, `src/index.ts`)
- **Source**: Backported from `v3.12.0-001`.
- **TDZ Elimination**: Hoisted `showAbout()` declaration above menu template creation to prevent temporal dead zone ReferenceErrors.
- **Dynamic Metadata**: Set `app.setAboutPanelOptions(...)` with dynamic copyright year (`new Date().getFullYear()`), application version, website link, and resolved icon path.
- **Menu Binding**: Bound direct `click: showAbout` handlers across macOS application menu and Help menu items (avoiding Electron's overriding native `role: 'about'`).
- **Initialization**: Registered `setupAboutPanel()` in `src/index.ts` during `app.whenReady()`.

---

## 3. Security Hardening & Dependency Upgrades

### 3.1 Direct Dependency Upgrades
- Bumped version in `package.json` to `"3.11.5"`.
- `@ghostery/adblocker-electron`: `^2.18.2`
- `@ghostery/adblocker-electron-preload`: `^2.18.2`
- `hono`: `^4.13.9`
- `@hono/node-server`: `^2.1.1`
- `@hono/swagger-ui`: `^0.6.1`
- `@hono/zod-openapi`: `^1.6.3`
- `@hono/zod-validator`: `^0.9.1`
- `socks`: `^2.8.10`
- `node-html-parser`: `^9.0.4`
- `youtubei.js`: `^18.1.0`
- `deepmerge-ts`: `^8.0.2`
- `electron-updater`: `^6.8.9`
- `zod`: `^4.6.5`

### 3.2 Transitive Vulnerability Remediations (`pnpm-workspace.yaml`)
To resolve known CVEs and adhere to pnpm v12 architecture, security overrides were configured in `pnpm-workspace.yaml`:
- `tar@>=7.5.7`: Remediates arbitrary file overwrite vulnerabilities (CVE-2026-31804).
- `fast-uri@>=3.1.0`: Remediates regular expression denial of service (CVE-2026-33758).
- `nanoid@>=5.1.6`: Remediates predictable ID generation (CVE-2026-32057).
- `undici@>=7.20.0`: Remediates HTTP request smuggling & CRLF injection (CVE-2026-32115).
- `ip-address@>=10.1.0`: Remediates incorrect IP address validation (CVE-2026-31998).
- `brace-expansion@>=4.0.1`: Remediates ReDoS.
- `postcss@>=8.5.8`: Remediates line return parsing vulnerability.
- `tmp@>=0.2.4`, `uuid@>=11.1.0`, `@xmldom/xmldom@>=0.9.9`, `node-gyp@>=11.5.0`.
- Configured explicit `allowBuilds` for native modules (`bufferutil`, `electron`, `electron-winstaller`, `esbuild`, `unrs-resolver`, `utf-8-validate`).
- Lockfile `pnpm-lock.yaml` completely regenerated and synchronized.

---

## 4. Empirical Verification & Quality Gate

- **TypeScript Compilation**: `pnpm typecheck` (`pnpm tsc -p tsconfig.json --noEmit`) completed with **0 errors**.
- **Changelog Integrity**: `changelog.md` updated with `v3.11.5` and `v3.11.4` sections while preserving all existing release notes.
- **Isolation Guarantee**: All changes strictly confined to branch `release/3.11.5` and tags `3.11.5` / `v3.11.5`. No existing tags or other branches were altered.
