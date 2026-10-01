<!-- markdownlint-disable-file MD033 MD041 -->

<p align="center">
  <a href="https://github.com/alsyundawy/pear-desktop-mac">
    <img src="assets/icon.png" width="96" height="96" alt="Pear Desktop Application Logo">
  </a>
</p>

# Release DocNote: 3.11.6

**Repository**: [alsyundawy/pear-desktop-mac](https://github.com/alsyundawy/pear-desktop-mac)  
**Release Version**: `3.11.6` (`v3.11.6`)  
**Base Version**: `3.11.5` (`v3.11.5`, commit `60da932c`)  
**Date**: 01 October 2026  
**Status**: Production-Grade Verified, Linters Clean (0 Errors), Typecheck Clean (0 Errors), Zero-Hallucination

---

## 1. Executive Summary

Release **3.11.6** (`v3.11.6`) is a focused security patch and stability hardening release built strictly from base tag **v3.11.5**.

This release remediates four security vulnerabilities and one latent type-safety bug discovered during deep code audit:

1. **Three unguarded `new URL()` constructor calls** in `src/index.ts` — Electron main process crash vectors when receiving malformed URLs from renderer events (`will-redirect`, `did-fail-load`) or network intercept callbacks (`onHeadersReceived`).
2. **MPRIS URI injection** in `src/plugins/shortcuts/mpris.ts` — A malicious or buggy MPRIS D-Bus client could inject arbitrary URI schemes into the Electron window via the `open` event.
3. **URL parameter injection** in `src/plugins/scrobbler/services/lastfm.ts` — Last.fm API key and token were interpolated into the auth URL without `encodeURIComponent()`, enabling URL injection and type-safety violation (`token` typed as `string | undefined`).

All changes maintain full backward compatibility. Zero new features are introduced. Verified 0 TypeScript errors, 0 ESLint errors.

---

## 2. Security & Bug Fixes (from v3.11.5)

### 2.1 Unguarded `new URL()` Crash Vectors (`src/index.ts`)

**Severity**: High (main process crash / denial of service)

Three locations in `src/index.ts` constructed `new URL(...)` from untrusted or externally-sourced strings without a try-catch guard. The `URL` constructor throws a `TypeError` for any malformed input, and in an Electron main process context, an uncaught exception can crash the entire application.

- **`will-redirect` event handler**: `new URL(event.url)` — wrapped in `try/catch { return; }` to safely discard malformed redirect URLs.
- **`did-fail-load` handler**: `!new URL(validatedURL).hostname.includes('doubleclick.net')` — refactored to extract hostname into a guarded variable (`validatedHostname`); crash-safe fallback shows error page.
- **`onHeadersReceived` CSP hook**: `new URL(details.url).protocol` — wrapped to safely pass-through on parse failure instead of crashing the interceptor.

### 2.2 MPRIS Open Event URI Injection (`src/plugins/shortcuts/mpris.ts`)

**Severity**: High (arbitrary URL load / protocol handler abuse)

The `player.on('open', ...)` handler directly passed `args.uri` to `win.loadURL()` with zero validation. A malicious or buggy MPRIS D-Bus client could supply `javascript:`, `data:`, `file:///`, or custom scheme URIs.

**Fix applied**:

- Parse `args.uri` with the `URL` constructor inside a try-catch; reject invalid URIs.
- Enforce an allowlist of permitted schemes: `Set(['https:', 'http:'])`.
- Log a warning and return early for any disallowed or unparseable URI.

### 2.3 Last.fm Auth URL Parameter Injection (`src/plugins/scrobbler/services/lastfm.ts`)

**Severity**: Moderate (URL injection, type safety bug)

The Last.fm authentication URL was constructed by directly interpolating `config.scrobblers.lastfm.apiKey` and `config.scrobblers.lastfm.token` without `encodeURIComponent()`. Additionally, the `token` field is typed as `string | undefined`, causing a latent `TS2345` type error.

**Fix applied**:

- Wrapped both `apiKey` and `token` with `encodeURIComponent(... ?? '')`.
- The `?? ''` nullish coalescing guard resolves the `undefined` type mismatch and prevents a runtime crash if the token is not yet populated.

---

## 3. Linter, Quality & TypeScript Verification

All code quality tools and compilers have been verified with **0 errors**:

| Check | Tool / Command | Result |
| :--- | :--- | :--- |
| **Type Check** | `pnpm tsc -p tsconfig.json --noEmit` | **0 Errors (Passed)** |
| **Linter** | `pnpm eslint ./src --quiet` | **0 Errors (Passed)** |
| **Targeted ESLint** | `pnpm eslint src/index.ts src/plugins/shortcuts/mpris.ts src/plugins/scrobbler/services/lastfm.ts --quiet` | **0 Errors (Passed)** |

---

## 4. Files Modified

| File | Change |
| :--- | :--- |
| `src/index.ts` | Guarded 3x unprotected `new URL()` crash vectors with try-catch |
| `src/plugins/shortcuts/mpris.ts` | URI scheme allowlist validation on MPRIS `open` event |
| `src/plugins/scrobbler/services/lastfm.ts` | `encodeURIComponent` + nullish coalescing for API key/token |
| `package.json` | Version bumped `3.11.5` to `3.11.6` |
| `DOCNOTE.md` | Updated for v3.11.6 |
| `changelog.md` | Entry added for v3.11.6 |

---

## 5. Scope Invariant & Verification

- All changes are strictly confined to the `v3.11.6` security patch line.
- No new features introduced. No breaking changes.
- Source code verified with 0 linter errors and 0 typecheck errors.
- Base tag `v3.11.5` (commit `60da932c`) is the clean ancestor for this release.
