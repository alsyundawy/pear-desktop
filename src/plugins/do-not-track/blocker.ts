import fs, { promises } from 'node:fs';
import path from 'node:path';

import { ElectronBlocker } from '@ghostery/adblocker-electron';
import { app, net } from 'electron';

let blocker: ElectronBlocker | undefined;

const SOURCES = [
  // YouTube Specific Filters
  'https://raw.githubusercontent.com/kbinani/adblock-youtube-ads/master/signed.txt',
  'https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/ublock-origin/filters.txt',
  'https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/ublock-origin/quick-fixes.txt',
  'https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/ublock-origin/unbreak.txt',
  'https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/ublock-origin/filters-2020.txt',
  'https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/ublock-origin/filters-2021.txt',
  'https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/ublock-origin/filters-2022.txt',
  'https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/ublock-origin/filters-2023.txt',

  // Core Ads & Trackers
  'https://ublockorigin.github.io/uAssets/thirdparties/easylist.txt', // EasyList
  'https://ublockorigin.github.io/uAssets/thirdparties/easyprivacy.txt', // EasyPrivacy
  'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=1&mimetype=plaintext', // Peter Lowe – Ads, trackers, and more
  'https://ublockorigin.github.io/uAssets/filters/filters.txt', // uBlock filters – Ads
  'https://ublockorigin.github.io/uAssets/filters/privacy.txt', // uBlock filters – Privacy
  'https://ublockorigin.github.io/uAssets/filters/badware.txt', // uBlock filters – Badware

  // Mobile Ads & Privacy (URL Tracking Protection)
  'https://filters.adtidy.org/extension/ublock/filters/11.txt', // AdGuard/uBO – Mobile Ads
  'https://ublockorigin.github.io/uAssets/filters/privacy-removeparam.txt', // AdGuard/uBO – URL Tracking Protection

  // Annoyances & Miscellaneous
  'https://ublockorigin.github.io/uAssets/thirdparties/easylist-annoyances.txt', // EasyList – Other Annoyances
  'https://secure.fanboy.co.nz/fanboy-annoyance_ubo.txt', // Fanboy Annoyances
  'https://filters.adtidy.org/extension/ublock/filters/122_optimized.txt', // AdGuard Annoyances

  // Regional Filter Lists
  'https://raw.githubusercontent.com/AnXh3L0/blocklist/master/albanian-easylist-addition/Albania.txt', // al, xk: Adblock List for Albania
  'https://easylist-downloads.adblockplus.org/Liste_AR.txt', // eg, sa, ma, dz: Liste AR
  'https://stanev.org/abp/adblock_bg.txt', // bg: Bulgarian Adblock list
  'https://filters.adtidy.org/extension/ublock/filters/224.txt', // cn, tw: AdGuard Chinese (中文)
  'https://raw.githubusercontent.com/ABPindo/indonesianadblockrules/master/subscriptions/abpindo.txt', // id, my: ABPindo
  'https://easylist-downloads.adblockplus.org/indianlist.txt', // in, lk, np: IndianList
  'https://raw.githubusercontent.com/MasterKia/PersianBlocker/main/PersianBlocker.txt', // ir: PersianBlocker
  'https://raw.githubusercontent.com/brave/adblock-lists/master/custom/is.txt', // is: Icelandic ABP List
  'https://raw.githubusercontent.com/easylist/EasyListHebrew/master/EasyListHebrew.txt', // il: EasyList Hebrew
  'https://easylist-downloads.adblockplus.org/easylistitaly.txt', // it: EasyList Italy
  'https://filters.adtidy.org/extension/ublock/filters/7.txt', // jp: AdGuard Japanese
  'https://cdn.jsdelivr.net/npm/@filteringdev/filterslists-ko@latest/dist/filterslist-uBlockOrigin-classic.txt', // kr: 한국어 (Korean)

  // Security & Threat Intelligence (HaGeZi DNS Blocklists - Adblock format)
  'https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/adblock/pro.txt', // HaGeZi Multi PRO
  'https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/adblock/popupads.txt', // HaGeZi Pop-up Ads
  'https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/adblock/tif.mini.txt', // HaGeZi Threat Intelligence Feeds - Mini
];

export const loadTrackerBlockerEngine = async (
  session?: Electron.Session,
  cache: boolean = true,
  additionalBlockLists: string[] = [],
  disableDefaultLists: boolean | unknown[] = false,
) => {
  // Only use cache if no additional blocklists are passed
  const cacheDirectory = path.join(app.getPath('userData'), 'adblock_cache');
  if (!fs.existsSync(cacheDirectory)) {
    fs.mkdirSync(cacheDirectory, { recursive: true });
  }
  const cachingOptions =
    cache && additionalBlockLists.length === 0
      ? {
          path: path.join(cacheDirectory, 'adblocker-engine.bin'),
          read: promises.readFile,
          write: promises.writeFile,
        }
      : undefined;

  const lists = [
    ...((disableDefaultLists && !Array.isArray(disableDefaultLists)) ||
    (Array.isArray(disableDefaultLists) && disableDefaultLists.length > 0)
      ? []
      : SOURCES),
    ...additionalBlockLists,
  ];

  try {
    blocker = await ElectronBlocker.fromLists(
      (url: string) => net.fetch(url),
      lists,
      {
        enableCompression: true,
        // When generating the engine for caching, do not load network filters
        // So that enhancing the session works as expected
        // Allowing to define multiple webRequest listeners
        loadNetworkFilters: session !== undefined,
      },
      cachingOptions,
    );
    if (session) {
      blocker.enableBlockingInSession(session);
    }
  } catch (error) {
    console.error(
      'Error loading adblocker engine from lists, falling back to prebuilt',
      error,
    );
    try {
      blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(
        (url: string) => net.fetch(url),
        cachingOptions,
      );
      if (session) {
        blocker.enableBlockingInSession(session);
      }
    } catch (fallbackError) {
      console.error(
        'Error loading fallback prebuilt blocker engine',
        fallbackError,
      );
    }
  }
};

export const unloadTrackerBlockerEngine = (session: Electron.Session) => {
  if (blocker) {
    blocker.disableBlockingInSession(session);
  }
};

export const isBlockerEnabled = (session: Electron.Session) =>
  blocker?.isBlockingEnabled(session) ?? false;
