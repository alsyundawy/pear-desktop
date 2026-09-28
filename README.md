<div align="center" markdown="1">
   <sup>Special thanks to:</sup>
   <br>
   <br>
   <a href="https://go.warp.dev/pear-desktop">
      <img alt="Warp sponsorship" width="400" src="https://github.com/user-attachments/assets/8307ea56-e872-494a-8a9c-de0e296a06ed" />
   </a>

### [Warp, built for coding with multiple AI agents](https://go.warp.dev/pear-desktop)
[Available for macOS, Linux, & Windows](https://go.warp.dev/pear-desktop)<br>

</div>
<hr>

<div align="center">

# :pear: Pear Desktop Mac

[![GitHub release](https://img.shields.io/github/v/release/alsyundawy/pear-desktop-mac?style=for-the-badge&color=2ea44f)](https://github.com/alsyundawy/pear-desktop-mac/releases/latest)
[![GitHub license](https://img.shields.io/github/license/alsyundawy/pear-desktop-mac?style=for-the-badge)](https://github.com/alsyundawy/pear-desktop-mac/blob/master/license)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Code style: oxlint](https://img.shields.io/badge/code_style-oxlint-5ed9c7.svg?style=for-the-badge)](https://github.com/oxc-project/oxc)
[![Platform](https://img.shields.io/badge/platform-macOS%20(Apple%20Silicon%20%26%20Intel)-lightgrey?style=for-the-badge)](https://github.com/alsyundawy/pear-desktop-mac/releases/latest)

<p align="center">
  <b>Feature-packed, high-performance macOS desktop app for YouTube Music with built-in ad blocker (27+ vendor filters), SponsorBlock, synced lyrics, audio equalizer, and native macOS plugins.</b>
</p>

</div>

> [!IMPORTANT]
> ⚠️ Disclaimer
>
> **No Affiliation**
>
> This project, and its contributors, are not affiliated with, authorized by, endorsed by, or in any way officially connected with Google LLC, YouTube, or any of their subsidiaries or affiliates. **This is an independent, non-profit, and unofficial extension developed by a team of volunteers with the goal of providing a desktop experience.**
>
> **Trademarks**
>
> The names "Google" and "YouTube Music", as well as related names, marks, emblems, and images, are registered trademarks of their respective owners. Any use of these trademarks is for identification and reference purposes only and does not imply any association with the trademark holder. We have no intention of infringing upon these trademarks or causing harm to the trademark holders.
>
> **Limitation of Liability**
>
> This application (extension) is provided "AS IS", and you use it at your own risk. In no event shall the developers or contributors be liable for any claim, damages, or other liability, including any legal consequences, arising from, out of, or in connection with the software or the use or other dealings in the software. The responsibility for any and all outcomes of using this software rests entirely with the user.

## Features

- 🛡️ **Enterprise Ad Blocker & Do-Not-Track Engine**: Built with `@ghostery/adblocker-electron` and 27 canonical vendor filter lists (EasyList, EasyPrivacy, Peter Lowe, uBlock Origin Filters, AdGuard Mobile, URL Tracking Protection, Fanboy, 12 Regional Lists, and HaGeZi Multi PRO / Pop-up Ads / Threat Intelligence). Includes an **`AdSpeedup`** fast-forward mode (16x auto-skip + muted playback) and offline prebuilt fallback.
- ⏭️ **SponsorBlock Integration**: Automatically skips non-music segments, intros, outros, sponsor messages, previews, and filler jokes with real-time in-app category toggle checkboxes and RFC 3986 parameter sanitization.
- 🎬 **Modern Video Toggle Switcher**: Redesigned glassmorphism pill switcher (`Song` / `Video`) with real-time dynamic alignment (`left`, `center`, `right`) and smooth segmented animations matching native YouTube Music styling.
- 🎤 **Synchronized Lyrics**: Live synced LRC lyrics powered by multiple providers (YouTube Music, Genius, LRCLib, Megalobiz, MusixMatch).
- 🎚️ **Equalizer & Audio Controls**: Integrated multi-band parametric equalizer and custom audio presets.
- 📊 **Scrobbler Integration**: Automatic background scrobbling to Last.fm, ListenBrainz, and Libre.fm.
- 💬 **Discord Rich Presence & TouchBar**: Shows your currently playing track, artist, album, and duration on Discord with native macOS TouchBar support.
- 🎨 **Theme Engine & Glassmorphism**: Supports custom CSS styling, ambient lighting, dynamic accent colors, and macOS-native titlebars.
- 🌐 **Full Bilingual Localization**: Native English (`en`) and Indonesian (`id`) interface with extensive internationalization support.
- 💻 **Dedicated macOS Multi-Architecture**: Optimized native builds for both Apple Silicon (ARM64) and Intel macOS (x64).

## Content

- [Features](#features)
- [Translation](#translation)
- [Download](#download)
- [Themes](#themes)
- [Dev](#dev)
- [Build your own plugins](#build-your-own-plugins)
  - [Creating a plugin](#creating-a-plugin)
  - [Common use cases](#common-use-cases)
- [Build](#build)
- [Production Preview](#production-preview)
- [Tests](#tests)
- [License](#license)
- [FAQ](#faq)

## Translation

You can help with translation on [Hosted Weblate](https://bit.ly/48n5YF7).

<a href="https://bit.ly/48n5YF7">
  <img src="https://bit.ly/4q83L6S" alt="translation status" />
  <img src="https://bit.ly/4h3zBxo" alt="translation status 2" />
</a>

## Download

You can check out the [latest release](https://github.com/alsyundawy/pear-desktop-mac/releases/latest) to download prebuilt packages for macOS:

- 🍏 **Apple Silicon (M1 / M2 / M3 / M4)**: Download `*-arm64.dmg` or `*-arm64.zip`
- 🖥️ **Intel x64**: Download `*-x64.dmg` or `*-x64.zip`

### macOS Gatekeeper & Quarantine Removal

If you install the app manually on macOS and encounter the dialog *"is damaged and can’t be opened"*, remove the quarantine attribute via Terminal:

```bash
/usr/bin/xattr -cr /Applications/Pear\ Desktop.app
```

## Themes

You can load CSS files to change the look of the application (Options > Visual Tweaks > Themes).

Some predefined themes are available in https://github.com/kerichdev/themes-for-ytmdesktop-player.

## Dev

```bash
git clone https://github.com/alsyundawy/pear-desktop.git
cd pear-desktop
pnpm install --frozen-lockfile
pnpm dev
```

Instead of installing pnpm on your system, you can also use [devcontainers](https://containers.dev/). You can use devcontainers either as a development environment in VS Code, or as a way to easily build the project without installing dependencies on your host system.

Note that this has it's own limitations (for example, GUI doesn't work on, at least some, Linux hosts).

## Build your own plugins

Using plugins, you can:

- manipulate the app - the `BrowserWindow` from electron is passed to the plugin handler
- change the front by manipulating the HTML/CSS

### Creating a plugin

Create a folder in `src/plugins/YOUR-PLUGIN-NAME`:

- `index.ts`: the main file of the plugin
```typescript
import style from './style.css?inline'; // import style as inline

import { createPlugin } from '@/utils';

export default createPlugin({
  name: 'Plugin Label',
  restartNeeded: true, // if value is true, ytmusic show restart dialog
  config: {
    enabled: false,
  }, // your custom config
  stylesheets: [style], // your custom style,
  menu: async ({ getConfig, setConfig }) => {
    // All *Config methods are wrapped Promise<T>
    const config = await getConfig();
    return [
      {
        label: 'menu',
        submenu: [1, 2, 3].map((value) => ({
          label: `value ${value}`,
          type: 'radio',
          checked: config.value === value,
          click() {
            setConfig({ value });
          },
        })),
      },
    ];
  },
  backend: {
    start({ window, ipc }) {
      window.maximize();

      // you can communicate with renderer plugin
      ipc.handle('some-event', () => {
        return 'hello';
      });
    },
    // it fired when config changed
    onConfigChange(newConfig) { /* ... */ },
    // it fired when plugin disabled
    stop(context) { /* ... */ },
  },
  renderer: {
    async start(context) {
      console.log(await context.ipc.invoke('some-event'));
    },
    // Only renderer available hook
    onPlayerApiReady(api, context) {
      // set plugin config easily
      context.setConfig({ myConfig: api.getVolume() });
    },
    onConfigChange(newConfig) { /* ... */ },
    stop(_context) { /* ... */ },
  },
  preload: {
    async start({ getConfig }) {
      const config = await getConfig();
    },
    onConfigChange(newConfig) {},
    stop(_context) {},
  },
});
```

### Common use cases

- injecting custom CSS: create a `style.css` file in the same folder then:

```typescript
// index.ts
import style from './style.css?inline'; // import style as inline

import { createPlugin } from '@/utils';

export default createPlugin({
  name: 'Plugin Label',
  restartNeeded: true, // if value is true, pear-desktop will show a restart dialog
  config: {
    enabled: false,
  }, // your custom config
  stylesheets: [style], // your custom style
  renderer() {} // define renderer hook
});
```

- If you want to change the HTML:

```typescript
import { createPlugin } from '@/utils';

export default createPlugin({
  name: 'Plugin Label',
  restartNeeded: true, // if value is true, ytmusic will show the restart dialog
  config: {
    enabled: false,
  }, // your custom config
  renderer() {
    console.log('hello from renderer');
  } // define renderer hook
});
```

- communicating between the front and back: can be done using the ipcMain module from electron. See `index.ts` file and
  example in `sponsorblock` plugin.

## Build

1. Clone the repo:
   ```bash
   git clone https://github.com/alsyundawy/pear-desktop-mac.git
   cd pear-desktop-mac
   ```
2. Follow [this guide](https://pnpm.io/installation) to install `pnpm`
3. Run `pnpm install --frozen-lockfile` to install dependencies
4. Package the application for macOS:

- `pnpm dist:mac` - macOS (Intel x64 DMG)
- `pnpm dist:mac:arm64` - macOS (Apple Silicon ARM64 DMG)
- `pnpm dist` - macOS (Active architecture)

Builds native macOS distribution packages (`.dmg` & `.zip`) using [electron-builder](https://github.com/electron-userland/electron-builder).

## Production Preview

```bash
pnpm start
```

## Tests

```bash
pnpm test
```

Uses [Playwright](https://playwright.dev/) to test the app.

## License
 
MIT © [th-ch](https://github.com/th-ch/youtube-music) & [alsyundawy](https://github.com/alsyundawy/pear-desktop-mac)

## FAQ

### Why apps menu isn't showing up?

If `Hide Menu` option is on - you can show the menu with the <kbd>alt</kbd> key (or <kbd>\`</kbd> [backtick] if using
the in-app-menu plugin)
