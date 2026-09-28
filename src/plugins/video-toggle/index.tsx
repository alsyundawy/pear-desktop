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
    customDomObserver: MutationObserver | null;
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
    mode: 'custom',
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
    customDomObserver: null,
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
      } else if (config.mode !== 'disabled') {
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

      const avToggle = document.querySelector('ytmusic-av-toggle');
      if (!avToggle) {
        // Native element absent from DOM in modern YTM — fallback to custom switcher
        this.mountCustomSwitcher(this.config).catch(console.error);
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

          const toggle = document.querySelector('ytmusic-av-toggle');
          if (toggle?.hasAttribute('toggle-disabled')) {
            toggle.removeAttribute('toggle-disabled');
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

      // 2. Disconnect previous observers before re-binding
      this.cleanupNativeMode(false);

      const shouldReenforceNative = (mutation: MutationRecord): boolean => {
        if (mutation.type !== 'attributes') return false;
        const target = mutation.target as HTMLElement;
        const tag = target.tagName.toLowerCase();
        const attr = mutation.attributeName;

        if (tag === 'ytmusic-player-page') {
          return (
            (attr === 'has-av-switcher' &&
              !target.hasAttribute('has-av-switcher')) ||
            (attr === 'hidden' && !target.hasAttribute('hidden'))
          );
        }
        if (tag === 'ytmusic-player' && attr === 'has-av-switcher') {
          return !target.hasAttribute('has-av-switcher');
        }
        if (tag === 'ytmusic-av-toggle' && attr === 'toggle-disabled') {
          return target.hasAttribute('toggle-disabled');
        }
        return false;
      };

      const attrObserver = new MutationObserver((mutations) => {
        if (this.isApplyingNativeAttributes) return;
        for (const mutation of mutations) {
          if (shouldReenforceNative(mutation)) {
            enforce();
            if (
              (mutation.target as HTMLElement).tagName.toLowerCase() ===
                'ytmusic-player-page' &&
              mutation.attributeName === 'hidden'
            ) {
              observeTargetElements();
            }
            break;
          }
        }
      });

      const observeTargetElements = () => {
        const playerPage = document.querySelector('ytmusic-player-page');
        if (playerPage) {
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
        const toggle = document.querySelector('ytmusic-av-toggle');
        if (toggle) {
          attrObserver.observe(toggle, {
            attributes: true,
            attributeFilter: ['toggle-disabled'],
          });
        }
      };

      observeTargetElements();
      this.nativeAttrObserver = attrObserver;

      const domObserver = new MutationObserver((mutations) => {
        let needsReapply = false;
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
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
        '#song-video, #song-video.ytmusic-player',
      );
      if (songVideoElement) {
        songVideoElement.style.setProperty(
          'display',
          showVideo ? 'block' : 'none',
          'important',
        );
        if (showVideo) {
          songVideoElement.classList.remove('video-toggle-hidden');
        } else {
          songVideoElement.classList.add('video-toggle-hidden');
        }
      }

      const songImageElement = document.querySelector<HTMLElement>(
        '#song-image, #song-image.ytmusic-player',
      );
      if (songImageElement) {
        songImageElement.style.setProperty(
          'display',
          showVideo ? 'none' : 'block',
          'important',
        );
        if (showVideo) {
          songImageElement.classList.remove('video-toggle-visible');
        } else {
          songImageElement.classList.add('video-toggle-visible');
        }
      }

      if (showVideo && targetVideo && !targetVideo.style.top) {
        targetVideo.style.top = `${
          (targetPlayer.clientHeight - targetVideo.clientHeight) / 2
        }px`;
      }
    },

    async mountCustomSwitcher(config: VideoTogglePluginConfig) {
      if (config.mode === 'disabled' || config.forceHide) return;

      const playerElement = await waitForElement<HTMLElement>(
        '#player, ytmusic-player',
        { maxRetry: -1, retryInterval: 200 },
      );
      if (!playerElement) return;

      if (!this.switchButtonContainer) {
        const [showButton, setShowButton] = createSignal(true);
        const [isVideoActive, setIsVideoActive] = createSignal(
          !config.hideVideo,
        );
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
      this.switchButtonContainer.classList.add('is-visible');
      if (!this.switchButtonContainer.isConnected) {
        playerElement.prepend(this.switchButtonContainer);
      }

      this.applyAlign(config.align);
      this.setVideoStateFn?.(!config.hideVideo);
      this.forcePlaybackMode();
      this.observeThumbnail();

      // Ensure container stays prepended across SPA navigation or player re-rendering
      this.customDomObserver?.disconnect();
      const customDomObserver = new MutationObserver(() => {
        if (this.config?.mode === 'disabled' || this.config?.forceHide) return;
        const player = document.querySelector<HTMLElement>(
          '#player, ytmusic-player',
        );
        if (
          player &&
          this.switchButtonContainer &&
          (!this.switchButtonContainer.isConnected ||
            !player.contains(this.switchButtonContainer))
        ) {
          player.prepend(this.switchButtonContainer);
        }
      });

      const appOrLayout =
        document.querySelector('ytmusic-app-layout') ??
        document.querySelector('ytmusic-app') ??
        document.body;

      customDomObserver.observe(appOrLayout, {
        childList: true,
        subtree: true,
      });
      this.customDomObserver = customDomObserver;

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
      this.customDomObserver?.disconnect();
      this.customDomObserver = null;

      if (this.switchButtonContainer) {
        this.switchButtonContainer.style.display = 'none';
        this.switchButtonContainer.classList.remove('is-visible');
      }

      this.playbackModeObserver?.disconnect();
      this.playbackModeObserver = null;
      this.thumbnailObserver?.disconnect();
      this.thumbnailObserver = null;

      document.body.classList.remove('video-toggle-custom-mode');

      const songVideoElement = document.querySelector<HTMLElement>(
        '#song-video, #song-video.ytmusic-player',
      );
      if (songVideoElement) {
        songVideoElement.style.display = '';
        songVideoElement.classList.remove('video-toggle-hidden');
      }

      const songImageElement = document.querySelector<HTMLElement>(
        '#song-image, #song-image.ytmusic-player',
      );
      if (songImageElement) {
        songImageElement.style.display = '';
        songImageElement.classList.remove('video-toggle-visible');
      }

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
        case 'disabled': {
          this.cleanupNativeMode(true);
          this.cleanupCustomMode();
          break;
        }

        case 'native': {
          const avToggle = document.querySelector('ytmusic-av-toggle');
          if (avToggle) {
            this.applyNativeMode();
          } else {
            // Native element absent from DOM in modern YTM — fallback to custom switcher
            this.cleanupNativeMode(false);
            this.mountCustomSwitcher(config).catch(console.error);
          }
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
        if (this.config?.mode === 'disabled' || this.config?.forceHide) {
          return;
        }

        // Always show toggle button when not force-hidden or disabled
        this.setShowButtonFn?.(true);

        const playerResponse = this.playerApi?.getPlayerResponse?.();
        const musicVideoType = playerResponse?.videoDetails?.musicVideoType;

        if (musicVideoType === 'MUSIC_VIDEO_TYPE_ATV') {
          // Video doesn't exist -> default to song mode
          this.setVideoStateFn?.(false);
        } else {
          const songImage = document.querySelector<HTMLImageElement>(
            '#song-image img, #song-image #img',
          );
          if (songImage) {
            this.forceThumbnail(songImage);
          }

          if (this.config?.hideVideo) {
            this.setVideoStateFn?.(false);
          } else {
            this.setVideoStateFn?.(true);
          }
        }
      };
      this.videoStartedHandler = videoStarted;

      const video = document.querySelector<HTMLVideoElement>('video');
      if (video) {
        video.removeEventListener('peard:src-changed', videoStarted);
        video.addEventListener('peard:src-changed', videoStarted);
      }

      // Also listen on playerApi videodatachange so tracks stay in sync
      api.addEventListener('videodatachange', (name) => {
        if (name === 'dataloaded' || name === 'dataupdated') {
          videoStarted();
        }
      });

      this.updateMode(config);
      videoStarted();
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

      if (oldConfig?.hideVideo !== newConfig.hideVideo) {
        this.setVideoStateFn?.(!newConfig.hideVideo);
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

      document.body.classList.remove(
        'video-toggle-force-hide',
        'video-toggle-custom-mode',
      );

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
