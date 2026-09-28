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
    videoChangeListener: (() => void) | null;
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
    videoChangeListener: null,
    injected: false,
    chooseQuality: null,

    injectButton() {
      if (!this.qualitySettingsButtonContainer) return;

      const target = document.querySelector<HTMLElement>(
        '.top-row-buttons.ytmusic-player, ytmusic-player .top-row-buttons, #top-row-buttons, .top-row-buttons',
      );
      if (!target) return;

      if (!target.contains(this.qualitySettingsButtonContainer)) {
        target.prepend(this.qualitySettingsButtonContainer);
      }
      this.injected = true;
    },

    onPlayerApiReady(api: MusicPlayer, context) {
      // Create container lazily inside lifecycle — not at module-parse time
      const container = document.createElement('div');
      container.id = 'ytmd-quality-changer-button-container';
      container.style.display = 'inline-flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      container.style.verticalAlign = 'middle';
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

      // Resilient injection: wait up to 5 s for top-row-buttons to appear
      if (!this.injected) {
        waitForElement<HTMLElement>(
          '.top-row-buttons.ytmusic-player, ytmusic-player .top-row-buttons, #top-row-buttons, .top-row-buttons',
          {
            maxRetry: 50,
            retryInterval: 100,
          },
        )
          .then((target) => {
            if (this.qualitySettingsButtonContainer) {
              if (!target.contains(this.qualitySettingsButtonContainer)) {
                target.prepend(this.qualitySettingsButtonContainer);
              }
              this.injected = true;
            }
          })
          .catch(() => {});
      }

      // Re-inject on video track/source changes
      const onVideoChange = () => {
        this.injectButton();
      };
      this.videoChangeListener = onVideoChange;
      const video = document.querySelector<HTMLVideoElement>('video');
      if (video) {
        video.removeEventListener('peard:src-changed', onVideoChange);
        video.addEventListener('peard:src-changed', onVideoChange);
      }

      // Re-inject when the player page navigates (YouTube SPA route changes
      // unmount / remount top-row-buttons between tracks or page transitions)
      const observer = new MutationObserver(() => {
        this.injectButton();
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
      if (this.videoChangeListener) {
        document
          .querySelector<HTMLVideoElement>('video')
          ?.removeEventListener('peard:src-changed', this.videoChangeListener);
        this.videoChangeListener = null;
      }
      this.qualitySettingsButtonContainer?.remove();
      this.qualitySettingsButtonContainer = null;
      this.injected = false;
      this.chooseQuality = null;
    },
  },
});
