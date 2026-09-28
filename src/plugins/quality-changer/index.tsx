import { dialog } from 'electron';
import { render } from 'solid-js/web';

import { t } from '@/i18n';
import { createPlugin } from '@/utils';
import { waitForElement } from '@/utils/wait-for-element';

import { QualitySettingButton } from './templates/quality-setting-button';

import type { MusicPlayer } from '@/types/music-player';

export default createPlugin<
  unknown,
  unknown,
  {
    qualitySettingsButtonContainer: HTMLDivElement | null;
    playerPageObserver: MutationObserver | null;
    injected: boolean;
    chooseQuality: ((e: MouseEvent) => Promise<void>) | null;
    injectButton(): void;
    stop(): void;
  }
>({
  name: () => t('plugins.quality-changer.name'),
  description: () => t('plugins.quality-changer.description'),
  restartNeeded: false,
  config: {
    enabled: false,
  },

  backend({ ipc, window }) {
    ipc.handle(
      'peard:quality-changer',
      async (qualityLabels: string[], currentIndex: number) =>
        await dialog.showMessageBox(window, {
          type: 'question',
          buttons: qualityLabels,
          defaultId: currentIndex,
          title: t(
            'plugins.quality-changer.backend.dialog.quality-changer.title',
          ),
          message: t(
            'plugins.quality-changer.backend.dialog.quality-changer.message',
          ),
          detail: t(
            'plugins.quality-changer.backend.dialog.quality-changer.detail',
            {
              quality: qualityLabels[currentIndex],
            },
          ),
          cancelId: -1,
        }),
    );
  },

  renderer: {
    qualitySettingsButtonContainer: null,
    playerPageObserver: null,
    injected: false,
    chooseQuality: null,

    injectButton() {
      if (this.injected || !this.qualitySettingsButtonContainer) return;

      const target = document.querySelector<HTMLElement>(
        '.top-row-buttons.ytmusic-player',
      );
      if (!target) return;

      target.prepend(this.qualitySettingsButtonContainer);
      this.injected = true;
    },

    onPlayerApiReady(api: MusicPlayer, context) {
      // Create container lazily inside lifecycle — not at module-parse time
      const container = document.createElement('div');
      container.id = 'ytmd-quality-changer-button-container';
      this.qualitySettingsButtonContainer = container;
      this.injected = false;

      this.chooseQuality = async (e: MouseEvent) => {
        e.stopPropagation();

        const qualityLevels = api.getAvailableQualityLevels();
        const currentIndex = qualityLevels.indexOf(api.getPlaybackQuality());

        const quality = (await context.ipc.invoke(
          'peard:quality-changer',
          api.getAvailableQualityLabels(),
          currentIndex,
        )) as {
          response: number;
        };

        if (quality.response === -1) {
          return;
        }

        const newQuality = qualityLevels[quality.response];
        api.setPlaybackQualityRange(newQuality);
        api.setPlaybackQuality(newQuality);
      };

      render(
        () => (
          <QualitySettingButton
            label={t(
              'plugins.quality-changer.renderer.quality-settings-button.label',
            )}
            onClick={this.chooseQuality!}
          />
        ),
        container,
      );

      // Attempt immediate injection in case the player bar is already in DOM
      this.injectButton();

      // Resilient injection: wait up to 5 s for .top-row-buttons to appear
      if (!this.injected) {
        waitForElement<HTMLElement>('.top-row-buttons.ytmusic-player', {
          maxRetry: 50,
          retryInterval: 100,
        })
          .then((target) => {
            if (this.qualitySettingsButtonContainer && !this.injected) {
              target.prepend(this.qualitySettingsButtonContainer);
              this.injected = true;
            }
          })
          .catch(() => {});
      }

      // Re-inject when the player page navigates (YouTube SPA route changes
      // unmount / remount .top-row-buttons between tracks or page transitions)
      const observer = new MutationObserver(() => {
        if (!this.injected) {
          this.injectButton();
        } else if (
          this.qualitySettingsButtonContainer &&
          !this.qualitySettingsButtonContainer.isConnected
        ) {
          // Container was removed from DOM — re-inject
          this.injected = false;
          this.injectButton();
        }
      });

      const appOrLayout =
        document.querySelector('ytmusic-app-layout') ??
        document.querySelector('ytmusic-app') ??
        document.body;

      observer.observe(appOrLayout, {
        childList: true,
        subtree: true,
      });

      this.playerPageObserver = observer;
    },

    stop() {
      this.playerPageObserver?.disconnect();
      this.playerPageObserver = null;
      this.qualitySettingsButtonContainer?.remove();
      this.qualitySettingsButtonContainer = null;
      this.injected = false;
      this.chooseQuality = null;
    },
  },
});
