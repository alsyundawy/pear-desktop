import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import { onPlayerApiReady, onUnload } from './renderer';

export interface PlaybackSpeedPluginConfig {
  enabled: boolean;
  varispeed: boolean;
}

export default createPlugin<
  unknown,
  unknown,
  unknown,
  PlaybackSpeedPluginConfig
>({
  name: () => t('plugins.playback-speed.name'),
  description: () => t('plugins.playback-speed.description'),
  restartNeeded: false,
  config: {
    enabled: false,
    varispeed: false,
  },
  menu: async ({ getConfig, setConfig }) => {
    const cfg = await getConfig();
    return [
      {
        label: t('plugins.playback-speed.menu.varispeed'),
        type: 'checkbox',
        checked: cfg.varispeed,
        click(item) {
          setConfig({ varispeed: item.checked });
        },
      },
    ];
  },
  renderer: {
    stop: onUnload,
    onPlayerApiReady,
  },
});
