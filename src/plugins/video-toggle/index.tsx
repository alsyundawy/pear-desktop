import { createSignal, Show } from 'solid-js';
import { render } from 'solid-js/web';

import { t } from '@/i18n';
import { type MenuTemplate } from '@/menu';
import { moveVolumeHud as preciseVolumeMoveVolumeHud } from '@/plugins/precise-volume/renderer';
import { type ThumbnailElement } from '@/types/get-player-response';
import { type MusicPlayer } from '@/types/music-player';
import { createPlugin } from '@/utils';
import { waitForElement } from '@/utils/wait-for-element';

import buttonSwitcherStyle from './button-switcher.css?inline';
import forceHideStyle from './force-hide.css?inline';
import { VideoSwitchButton } from './templates/video-switch-button';

export type VideoTogglePluginConfig = {
  enabled: boolean;
  hideVideo: boolean;
  mode: 'custom' | 'native' | 'disabled';
  forceHide: boolean;
  align: 'left' | 'middle' | 'right';
};

export default createPlugin<
  unknown,
  unknown,
  {
    config: VideoTogglePluginConfig | null;
    playerApi: MusicPlayer | null;
    switchButtonContainer: HTMLElement | null;
    playbackModeObserver: MutationObserver | null;
    thumbnailObserver: MutationObserver | null;
    nativeAttrObserver: MutationObserver | null;
    nativeDomObserver: MutationObserver | null;
    boundNativeButtons: WeakSet<Element>;
    isApplyingNativeAttributes: boolean;
    videoStartedHandler: (() => void) | null;
    setVideoStateFn: ((showVideo: boolean) => void) | null;
    setShowButtonFn: ((show: boolean) => void) | null;
    setIsVideoActiveFn: ((active: boolean) => void) | null;
    moveVolumeHud: (showVideo: boolean) => void;
    applyAlign: (align: 'left' | 'middle' | 'right') => void;
    applyStyleClass: (config: VideoTogglePluginConfig) => void;
    applyNativeMode: () => void;
    cleanupNativeMode: (resetDom?: boolean) => void;
    mountCustomSwitcher: (config: VideoTogglePluginConfig) => Promise<void>;
    cleanupCustomMode: () => void;
    updateMode: (config: VideoTogglePluginConfig) => void;
    forceThumbnail: (img?: HTMLImageElement | null) => void;
    forcePlaybackMode: () => void;
    observeThumbnail: () => void;
    updatePlayerDisplay: (
      targetPlayer: HTMLElement,
      targetVideo: HTMLVideoElement | null,
      showVideo: boolean,
    ) => void;
  },
  VideoTogglePluginConfig
>({
  name: () => t('plugins.video-toggle.name'),
  description: () => t('plugins.video-toggle.description'),
  restartNeeded: false,
  config: {
    enabled: true,
    hideVideo: false,
    mode: 'native',
    forceHide: false,
    align: 'left',
  } as VideoTogglePluginConfig,
  stylesheets: [buttonSwitcherStyle, forceHideStyle],
  menu: async ({ getConfig, setConfig, restart }): Promise<MenuTemplate> => {
    const config = await getConfig();

    return [
      {
        label: t('plugins.video-toggle.menu.mode.label'),
        submenu: [
          {
            label: t('plugins.video-toggle.menu.mode.submenu.custom'),
            type: 'radio',
            checked: config.mode === 'custom',
            click() {
              setConfig({ mode: 'custom' });
            },
          },
          {
            label: t('plugins.video-toggle.menu.mode.submenu.native'),
            type: 'radio',
            checked: config.mode === 'native',
            click() {
              setConfig({ mode: 'native' });
            },
          },
          {
            label: t('plugins.video-toggle.menu.mode.submenu.disabled'),
            type: 'radio',
            checked: config.mode === 'disabled',
            click() {
              setConfig({ mode: 'disabled' });
            },
          },
        ],
      },
      {
        label: t('plugins.video-toggle.menu.align.label'),
        submenu: [
          {
            label: t('plugins.video-toggle.menu.align.submenu.left'),
            type: 'radio',
            checked: config.align === 'left',
            click() {
              setConfig({ align: 'left' });
            },
          },
          {
            label: t('plugins.video-toggle.menu.align.submenu.middle'),
            type: 'radio',
            checked: config.align === 'middle',
            click() {
              setConfig({ align: 'middle' });
            },
          },
          {
            label: t('plugins.video-toggle.menu.align.submenu.right'),
            type: 'radio',
            checked: config.align === 'right',
            click() {
              setConfig({ align: 'right' });
            },
          },
        ],
      },
      {
        label: t('plugins.video-toggle.menu.force-hide'),
        type: 'checkbox',
        checked: config.forceHide,
        click(item) {
          setConfig({ forceHide: item.checked });
        },
      },
      { type: 'separator' },
      {
        label: t('main.menu.navigation.submenu.restart'),
        click: restart,
      },
    ];
  },

  renderer: {
    config: null,
    playerApi: null,
    switchButtonContainer: null,
    playbackModeObserver: null,
    thumbnailObserver: null,
    nativeAttrObserver: null,
    nativeDomObserver: null,
    boundNativeButtons: new WeakSet<Element>(),
    isApplyingNativeAttributes: false,
    videoStartedHandler: null,
    setVideoStateFn: null,
    setShowButtonFn: null,
    setIsVideoActiveFn: null,
    moveVolumeHud: () => {},

    applyStyleClass(config: VideoTogglePluginConfig) {
      if (config.forceHide) {
        document.body.classList.add('video-toggle-force-hide');
        document.body.classList.remove('video-toggle-custom-mode');
      } else if (config.mode === 'custom') {
        document.body.classList.add('video-toggle-custom-mode');
        document.body.classList.remove('video-toggle-force-hide');
      } else {
        document.body.classList.remove(
          'video-toggle-force-hide',
          'video-toggle-custom-mode',
        );
      }
    },

    applyAlign(align: 'left' | 'middle' | 'right') {
      const container =
        this.switchButtonContainer ??
        document.getElementById('ytmd-video-toggle-switch-button-container');
      if (!container) return;

      switch (align) {
        case 'right':
          container.style.justifyContent = 'flex-end';
          break;
        case 'middle':
          container.style.justifyContent = 'center';
          break;
        case 'left':
        default:
          container.style.justifyContent = 'flex-start';
          break;
      }
    },

    applyNativeMode() {
      if (this.config?.forceHide || this.config?.mode !== 'native') {
        return;
      }

      this.cleanupCustomMode();

      const enforce = () => {
        if (this.isApplyingNativeAttributes) return;
        if (this.config?.forceHide || this.config?.mode !== 'native') return;

        this.isApplyingNativeAttributes = true;
        try {
          const playerPage = document.querySelector('ytmusic-player-page');
          if (playerPage && !playerPage.hasAttribute('has-av-switcher')) {
            playerPage.setAttribute('has-av-switcher', '');
          }

          const player = document.querySelector('ytmusic-player');
          if (player && !player.hasAttribute('has-av-switcher')) {
            player.setAttribute('has-av-switcher', '');
          }

          const avToggle = document.querySelector('ytmusic-av-toggle');
          if (avToggle && avToggle.hasAttribute('toggle-disabled')) {
            avToggle.removeAttribute('toggle-disabled');
          }

          const videoButton = document.querySelector<HTMLButtonElement>(
            'button.video-button.ytmusic-av-toggle',
          );
          if (videoButton && !this.boundNativeButtons.has(videoButton)) {
            this.boundNativeButtons.add(videoButton);
            videoButton.addEventListener('click', () => {
              window.dispatchEvent(new Event('resize'));
            });
          }
        } finally {
          this.isApplyingNativeAttributes = false;
        }
      };

      // 1. Immediate application on existing DOM elements
      enforce();

      // 2. Disconnect previous observers before re-binding to prevent duplicate observers
      this.cleanupNativeMode(false);

      // 3. Attribute Observer to prevent YTM from stripping attributes AND
      //    to detect when ytmusic-player-page becomes visible (hidden removed)
      const attrObserver = new MutationObserver((mutations) => {
        if (this.isApplyingNativeAttributes) return;
        for (const mutation of mutations) {
          if (mutation.type === 'attributes') {
            const target = mutation.target as HTMLElement;
            const tag = target.tagName.toLowerCase();
            if (tag === 'ytmusic-player-page') {
              if (
                mutation.attributeName === 'has-av-switcher' &&
                !target.hasAttribute('has-av-switcher')
              ) {
                // YTM stripped our attribute — restore it
                enforce();
                break;
              } else if (
                mutation.attributeName === 'hidden' &&
                !target.hasAttribute('hidden')
              ) {
                // Player page became visible — apply attributes so the pill renders
                enforce();
                observeTargetElements();
                break;
              }
            } else if (
              tag === 'ytmusic-player' &&
              mutation.attributeName === 'has-av-switcher' &&
              !target.hasAttribute('has-av-switcher')
            ) {
              enforce();
              break;
            } else if (
              tag === 'ytmusic-av-toggle' &&
              mutation.attributeName === 'toggle-disabled' &&
              target.hasAttribute('toggle-disabled')
            ) {
              enforce();
              break;
            }
          }
        }
      });

      const observeTargetElements = () => {
        const playerPage = document.querySelector('ytmusic-player-page');
        if (playerPage) {
          // Watch has-av-switcher (YTM may strip it) AND hidden (player page
          // visibility toggle) so enforce() fires when user opens full player
          attrObserver.observe(playerPage, {
            attributes: true,
            attributeFilter: ['has-av-switcher', 'hidden'],
          });
        }
        const player = document.querySelector('ytmusic-player');
        if (player) {
          attrObserver.observe(player, {
            attributes: true,
            attributeFilter: ['has-av-switcher'],
          });
        }
        const avToggle = document.querySelector('ytmusic-av-toggle');
        if (avToggle) {
          attrObserver.observe(avToggle, {
            attributes: true,
            attributeFilter: ['toggle-disabled'],
          });
        }
      };

      observeTargetElements();
      this.nativeAttrObserver = attrObserver;

      // 4. DOM ChildList Observer to catch player-page/player/av-toggle connect/reconnect
      const domObserver = new MutationObserver((mutations) => {
        let needsReapply = false;
        for (const mutation of mutations) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            if (node instanceof HTMLElement) {
              const tag = node.tagName.toLowerCase();
              if (
                tag === 'ytmusic-player-page' ||
                tag === 'ytmusic-player' ||
                tag === 'ytmusic-av-toggle' ||
                node.querySelector(
                  'ytmusic-player-page, ytmusic-player, ytmusic-av-toggle',
                )
              ) {
                needsReapply = true;
                break;
              }
            }
          }
          if (needsReapply) break;
        }

        if (needsReapply) {
          enforce();
          observeTargetElements();
        }
      });

      const appOrLayout =
        document.querySelector('ytmusic-app-layout') ??
        document.querySelector('ytmusic-app') ??
        document.body;

      domObserver.observe(appOrLayout, {
        childList: true,
        subtree: true,
      });
      this.nativeDomObserver = domObserver;

      // 5. Use waitForElement to be resilient if player elements are not mounted yet
      //    Increase retry to 100 (10 s) to handle slow cold starts
      waitForElement<HTMLElement>('ytmusic-player-page', {
        maxRetry: 100,
        retryInterval: 100,
      })
        .then((page) => {
          if (this.config?.mode === 'native' && !this.config.forceHide) {
            enforce();
            if (page && this.nativeAttrObserver) {
              // Watch has-av-switcher and hidden so pill appears when screen opens
              this.nativeAttrObserver.observe(page, {
                attributes: true,
                attributeFilter: ['has-av-switcher', 'hidden'],
              });
            }
          }
        })
        .catch(() => {});

      waitForElement<HTMLElement>('ytmusic-av-toggle', {
        maxRetry: 100,
        retryInterval: 100,
      })
        .then((toggle) => {
          if (this.config?.mode === 'native' && !this.config.forceHide) {
            enforce();
            if (toggle && this.nativeAttrObserver) {
              this.nativeAttrObserver.observe(toggle, {
                attributes: true,
                attributeFilter: ['toggle-disabled'],
              });
            }
          }
        })
        .catch(() => {});
    },

    cleanupNativeMode(resetDom = true) {
      this.nativeAttrObserver?.disconnect();
      this.nativeAttrObserver = null;
      this.nativeDomObserver?.disconnect();
      this.nativeDomObserver = null;

      if (resetDom) {
        document
          .querySelector('ytmusic-player-page')
          ?.removeAttribute('has-av-switcher');
        document
          .querySelector('ytmusic-player')
          ?.removeAttribute('has-av-switcher');
        document
          .querySelector('ytmusic-av-toggle')
          ?.setAttribute('toggle-disabled', '');
      }
    },

    forceThumbnail(img?: HTMLImageElement | null) {
      const targetImg =
        img ??
        document.querySelector<HTMLImageElement>(
          '#song-image img, #song-image #img',
        );
      if (!targetImg) return;
      const thumbnails: ThumbnailElement[] =
        this.playerApi?.getPlayerResponse()?.videoDetails?.thumbnail
          ?.thumbnails ?? [];
      if (thumbnails && thumbnails.length > 0) {
        const thumbnail = thumbnails.at(-1)?.url.split('?')[0];
        if (thumbnail) targetImg.src = thumbnail;
      }
    },

    forcePlaybackMode() {
      const player = document.querySelector<HTMLElement>('ytmusic-player');
      if (player) {
        this.playbackModeObserver?.disconnect();
        const playbackModeObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.target instanceof HTMLElement) {
              const target = mutation.target;
              if (target.getAttribute('playback-mode') !== 'ATV_PREFERRED') {
                playbackModeObserver.disconnect();
                target.setAttribute('playback-mode', 'ATV_PREFERRED');
              }
            }
          }
        });
        playbackModeObserver.observe(player, {
          attributeFilter: ['playback-mode'],
        });
        this.playbackModeObserver = playbackModeObserver;
      }
    },

    observeThumbnail() {
      const player = document.querySelector<
        HTMLElement & { videoMode_: boolean }
      >('ytmusic-player');
      this.thumbnailObserver?.disconnect();
      const thumbnailObserver = new MutationObserver((mutations) => {
        if (!player?.videoMode_) {
          return;
        }

        for (const mutation of mutations) {
          if (mutation.target instanceof HTMLImageElement) {
            const target = mutation.target;
            if (!target.src.startsWith('data:')) {
              continue;
            }

            this.forceThumbnail(target);
          }
        }
      });
      const thumbnailElement = document.querySelector(
        '#song-image img, #song-image #img',
      );
      if (thumbnailElement) {
        thumbnailObserver.observe(thumbnailElement, {
          attributeFilter: ['src'],
        });
        this.thumbnailObserver = thumbnailObserver;
      }
    },

    updatePlayerDisplay(
      targetPlayer: HTMLElement,
      targetVideo: HTMLVideoElement | null,
      showVideo: boolean,
    ) {
      targetPlayer.style.margin = showVideo ? '' : 'auto 0px';
      targetPlayer.setAttribute(
        'playback-mode',
        showVideo ? 'OMV_PREFERRED' : 'ATV_PREFERRED',
      );

      const songVideoElement = document.querySelector<HTMLElement>(
        '#song-video.ytmusic-player',
      );
      if (songVideoElement) {
        songVideoElement.style.display = showVideo ? 'block' : 'none';
      }

      const songImageElement =
        document.querySelector<HTMLElement>('#song-image');
      if (songImageElement) {
        songImageElement.style.display = showVideo ? 'none' : 'block';
      }

      if (showVideo && targetVideo && !targetVideo.style.top) {
        targetVideo.style.top = `${
          (targetPlayer.clientHeight - targetVideo.clientHeight) / 2
        }px`;
      }
    },

    async mountCustomSwitcher(config: VideoTogglePluginConfig) {
      if (config.mode !== 'custom' || config.forceHide) return;

      const playerElement = await waitForElement<HTMLElement>(
        '#player, ytmusic-player',
        { maxRetry: 50, retryInterval: 100 },
      );
      if (!playerElement) return;

      if (!this.switchButtonContainer) {
        const [showButton, setShowButton] = createSignal(true);
        const [isVideoActive, setIsVideoActive] = createSignal(true);
        this.setShowButtonFn = setShowButton;
        this.setIsVideoActiveFn = setIsVideoActive;

        const switchButtonContainer = document.createElement('div');
        switchButtonContainer.id = 'ytmd-video-toggle-switch-button-container';
        this.switchButtonContainer = switchButtonContainer;

        render(
          () => (
            <Show when={showButton()}>
              <VideoSwitchButton
                checked={isVideoActive()}
                onChange={(e) => {
                  const target = e.target as HTMLInputElement;
                  this.setVideoStateFn?.(target.checked);
                }}
                onClick={(e) => e.stopPropagation()}
                songButtonText={t('plugins.video-toggle.templates.button-song')}
                videoButtonText={t(
                  'plugins.video-toggle.templates.button-video',
                )}
              />
            </Show>
          ),
          switchButtonContainer,
        );
      }

      this.switchButtonContainer.style.display = 'flex';
      if (!this.switchButtonContainer.isConnected) {
        playerElement.prepend(this.switchButtonContainer);
      }

      this.applyAlign(config.align);
      this.setVideoStateFn?.(!config.hideVideo);
      this.forcePlaybackMode();
      this.observeThumbnail();

      const video = document.querySelector<HTMLVideoElement>('video');
      if (video) {
        video.style.height = 'auto';
        if (this.videoStartedHandler) {
          video.removeEventListener(
            'peard:src-changed',
            this.videoStartedHandler,
          );
          video.addEventListener('peard:src-changed', this.videoStartedHandler);
        }
      }

      this.videoStartedHandler?.();
    },

    cleanupCustomMode() {
      if (this.switchButtonContainer) {
        this.switchButtonContainer.style.display = 'none';
      }

      this.playbackModeObserver?.disconnect();
      this.playbackModeObserver = null;
      this.thumbnailObserver?.disconnect();
      this.thumbnailObserver = null;

      document.body.classList.remove('video-toggle-custom-mode');

      const songVideoElement = document.querySelector<HTMLElement>(
        '#song-video.ytmusic-player',
      );
      if (songVideoElement) songVideoElement.style.display = '';

      const songImageElement =
        document.querySelector<HTMLElement>('#song-image');
      if (songImageElement) songImageElement.style.display = '';

      const player = document.querySelector<HTMLElement>('ytmusic-player');
      if (player) {
        player.style.margin = '';
        player.removeAttribute('playback-mode');
      }

      const video = document.querySelector<HTMLVideoElement>('video');
      if (video) {
        video.style.height = '';
        video.style.top = '';
      }
    },

    updateMode(config: VideoTogglePluginConfig) {
      if (config.forceHide) {
        this.cleanupNativeMode(true);
        this.cleanupCustomMode();
        return;
      }

      switch (config.mode) {
        case 'native': {
          this.applyNativeMode();
          break;
        }

        case 'disabled': {
          this.cleanupNativeMode(true);
          this.cleanupCustomMode();
          break;
        }

        case 'custom':
        default: {
          this.cleanupNativeMode(true);
          this.mountCustomSwitcher(config).catch(console.error);
          break;
        }
      }
    },

    async start({ getConfig }) {
      const config = await getConfig();
      this.config = config;
      this.applyStyleClass(config);
      this.updateMode(config);
    },

    async onPlayerApiReady(api, { getConfig }) {
      this.playerApi = api;
      const config = await getConfig();
      this.config = config;
      this.applyStyleClass(config);

      this.moveVolumeHud = (await window.mainConfig.plugins.isEnabled(
        'precise-volume',
      ))
        ? (preciseVolumeMoveVolumeHud as (_: boolean) => void)
        : () => {};

      this.setVideoStateFn = (showVideo: boolean) => {
        if (this.config) {
          this.config.hideVideo = !showVideo;
        }
        window.mainConfig.plugins.setOptions('video-toggle', this.config);
        this.setIsVideoActiveFn?.(showVideo);

        const checkbox = document.querySelector<HTMLInputElement>(
          '#video-toggle-video-switch-button-checkbox',
        );
        if (checkbox) checkbox.checked = showVideo;

        const player = document.querySelector<
          HTMLElement & { videoMode_: boolean }
        >('ytmusic-player');
        const video = document.querySelector<HTMLVideoElement>('video');

        if (player) {
          this.updatePlayerDisplay(player, video, showVideo);
          this.moveVolumeHud(showVideo);
        }
      };

      const videoStarted = () => {
        if (this.config?.mode === 'native' && !this.config.forceHide) {
          this.applyNativeMode();
          return;
        }

        if (this.config?.mode !== 'custom' || this.config.forceHide) {
          return;
        }

        const playerResponse = this.playerApi?.getPlayerResponse?.();
        const musicVideoType = playerResponse?.videoDetails?.musicVideoType;

        if (musicVideoType === 'MUSIC_VIDEO_TYPE_ATV') {
          // Video doesn't exist -> switch to song mode
          this.setVideoStateFn?.(false);
          // Hide custom toggle button on ATV
          this.setShowButtonFn?.(false);
        } else {
          const songImage = document.querySelector<HTMLImageElement>(
            '#song-image img, #song-image #img',
          );
          if (songImage) {
            this.forceThumbnail(songImage);
          }
          // Show toggle button when video is available
          this.setShowButtonFn?.(true);

          if (
            !this.config?.hideVideo &&
            document.querySelector<HTMLElement>('#song-video.ytmusic-player')
              ?.style.display === 'none'
          ) {
            this.setVideoStateFn?.(true);
          } else {
            this.moveVolumeHud(!this.config?.hideVideo);
          }
        }
      };
      this.videoStartedHandler = videoStarted;

      const video = document.querySelector<HTMLVideoElement>('video');
      if (video) {
        video.removeEventListener('peard:src-changed', videoStarted);
        video.addEventListener('peard:src-changed', videoStarted);
      }

      this.updateMode(config);
    },

    onConfigChange(newConfig) {
      const oldConfig = this.config;
      this.config = newConfig;
      this.applyStyleClass(newConfig);

      if (
        oldConfig?.mode !== newConfig.mode ||
        oldConfig?.forceHide !== newConfig.forceHide
      ) {
        this.updateMode(newConfig);
      }

      if (newConfig.mode === 'custom' && !newConfig.forceHide) {
        this.applyAlign(newConfig.align);
      }
    },

    stop() {
      this.cleanupNativeMode(true);
      this.cleanupCustomMode();

      if (this.switchButtonContainer) {
        this.switchButtonContainer.remove();
        this.switchButtonContainer = null;
      } else {
        document
          .getElementById('ytmd-video-toggle-switch-button-container')
          ?.remove();
      }

      document.body.classList.remove('video-toggle-force-hide');

      const video = document.querySelector<HTMLVideoElement>('video');
      if (video && this.videoStartedHandler) {
        video.removeEventListener(
          'peard:src-changed',
          this.videoStartedHandler,
        );
        this.videoStartedHandler = null;
      }

      this.config = null;
      this.playerApi = null;
      this.setVideoStateFn = null;
      this.setShowButtonFn = null;
      this.setIsVideoActiveFn = null;
      this.moveVolumeHud = () => {};
    },
  },
});
