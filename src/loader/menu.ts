import { deepmerge } from 'deepmerge-ts';
import { allPlugins } from 'virtual:plugins';

import * as config from '@/config';
import { t } from '@/i18n';
import { restart } from '@/providers/app-controls';
import { LoggerPrefix } from '@/utils';

import type { MenuContext } from '@/types/contexts';
import type { PluginConfig } from '@/types/plugins';
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';

type MenuRefresher = (win: BrowserWindow) => Promise<void> | void;
let menuRefresher: MenuRefresher | null = null;

export const setMenuRefresher = (refresher: MenuRefresher): void => {
  menuRefresher = refresher;
};

const menuTemplateMap: Record<string, MenuItemConstructorOptions[]> = {};
const createContext = (
  id: string,
  win: BrowserWindow,
): MenuContext<PluginConfig> => ({
  getConfig: async () =>
    deepmerge(
      (await allPlugins())[id].config ?? { enabled: false },
      config.get(`plugins.${id}`) ?? {},
    ) as PluginConfig,
  setConfig: async (newConfig) => {
    config.setPartial(
      `plugins.${id}`,
      newConfig,
      (await allPlugins())[id].config,
    );
  },
  restart: () => {
    restart();
  },
  window: win,
  refresh: async () => {
    if (menuRefresher) {
      await menuRefresher(win);
    }

    if (await config.plugins.isEnabled('in-app-menu')) {
      win.webContents.send('refresh-in-app-menu');
    }
  },
});

export const forceLoadMenuPlugin = async (id: string, win: BrowserWindow) => {
  try {
    const plugin = (await allPlugins())[id];
    if (!plugin) return;

    const menu = plugin.menu?.(createContext(id, win));
    if (menu) {
      const result = await menu;
      if (result.length > 0) {
        menuTemplateMap[id] = result;
      } else {
        return;
      }
    } else return;

    console.log(
      LoggerPrefix,
      t('common.console.plugins.loaded', { pluginName: `${id}::menu` }),
    );
  } catch (err) {
    console.error(
      LoggerPrefix,
      t('common.console.plugins.initialize-failed', {
        pluginName: `${id}::menu`,
      }),
    );
    console.trace(err);
  }
};

export const loadAllMenuPlugins = async (win: BrowserWindow) => {
  const pluginConfigs = config.plugins.getPlugins();

  for (const [pluginId, pluginDef] of Object.entries(await allPlugins())) {
    const config = deepmerge(
      pluginDef.config ?? { enabled: false },
      pluginConfigs[pluginId] ?? {},
    );

    if (config.enabled) {
      await forceLoadMenuPlugin(pluginId, win);
    }
  }
};

export const getMenuTemplate = (
  id: string,
): MenuItemConstructorOptions[] | undefined => {
  return menuTemplateMap[id];
};

export const getAllMenuTemplate = () => {
  return menuTemplateMap;
};
