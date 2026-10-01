import { t } from '@/i18n';

import { providerNames } from './providers';

import type { SyncedLyricsPluginConfig } from './types';
import type { MenuContext } from '@/types/contexts';
import type { MenuItemConstructorOptions } from 'electron';

export const menu = async (
  ctx: MenuContext<SyncedLyricsPluginConfig>,
): Promise<MenuItemConstructorOptions[]> => {
  const config = await ctx.getConfig();

  return [
    {
      label: t('plugins.synced-lyrics.menu.preferred-provider.label'),
      toolTip: t('plugins.synced-lyrics.menu.preferred-provider.tooltip'),
      type: 'submenu',
      submenu: [
        {
          label: t('plugins.synced-lyrics.menu.preferred-provider.none.label'),
          toolTip: t(
            'plugins.synced-lyrics.menu.preferred-provider.none.tooltip',
          ),
          type: 'radio',
          checked: config.preferredProvider === undefined,
          click() {
            void ctx.setConfig({ preferredProvider: undefined });
          },
        },
        ...providerNames.map(
          (provider) =>
            ({
              label: provider,
              type: 'radio',
              checked: config.preferredProvider === provider,
              click() {
                void ctx.setConfig({ preferredProvider: provider });
              },
            }) as const,
        ),
      ],
    },
    {
      label: t('plugins.synced-lyrics.menu.precise-timing.label'),
      toolTip: t('plugins.synced-lyrics.menu.precise-timing.tooltip'),
      type: 'checkbox',
      checked: config.preciseTiming,
      click(item) {
        void ctx.setConfig({
          preciseTiming: item.checked,
        });
      },
    },
    {
      label: t('plugins.synced-lyrics.menu.line-effect.label'),
      toolTip: t('plugins.synced-lyrics.menu.line-effect.tooltip'),
      type: 'submenu',
      submenu: [
        {
          label: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.fancy.label',
          ),
          toolTip: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.fancy.tooltip',
          ),
          type: 'radio',
          checked: config.lineEffect === 'fancy',
          click() {
            void ctx.setConfig({
              lineEffect: 'fancy',
            });
          },
        },
        {
          label: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.scale.label',
          ),
          toolTip: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.scale.tooltip',
          ),
          type: 'radio',
          checked: config.lineEffect === 'scale',
          click() {
            void ctx.setConfig({
              lineEffect: 'scale',
            });
          },
        },
        {
          label: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.offset.label',
          ),
          toolTip: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.offset.tooltip',
          ),
          type: 'radio',
          checked: config.lineEffect === 'offset',
          click() {
            void ctx.setConfig({
              lineEffect: 'offset',
            });
          },
        },
        {
          label: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.focus.label',
          ),
          toolTip: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.focus.tooltip',
          ),
          type: 'radio',
          checked: config.lineEffect === 'focus',
          click() {
            void ctx.setConfig({
              lineEffect: 'focus',
            });
          },
        },
      ],
    },
    {
      label: t('plugins.synced-lyrics.menu.default-text-string.label'),
      toolTip: t('plugins.synced-lyrics.menu.default-text-string.tooltip'),
      type: 'submenu',
      submenu: [
        { label: '♪', value: '♪' },
        { label: '" "', value: ' ' },
        { label: '...', value: ['.', '..', '...'] },
        { label: '•••', value: ['•', '••', '•••'] },
        { label: '———', value: '———' },
      ].map(({ label, value }) => ({
        label,
        type: 'radio',
        checked:
          typeof value === 'string'
            ? config.defaultTextString === value
            : JSON.stringify(config.defaultTextString) ===
              JSON.stringify(value),
        click() {
          void ctx.setConfig({ defaultTextString: value });
        },
      })),
    },
    {
      label: t('plugins.synced-lyrics.menu.romanization.label'),
      toolTip: t('plugins.synced-lyrics.menu.romanization.tooltip'),
      type: 'checkbox',
      checked: config.romanization,
      click(item) {
        void ctx.setConfig({
          romanization: item.checked,
        });
      },
    },
    {
      label: t('plugins.synced-lyrics.menu.convert-chinese-character.label'),
      toolTip: t(
        'plugins.synced-lyrics.menu.convert-chinese-character.tooltip',
      ),
      type: 'submenu',
      submenu: [
        {
          label: t(
            'plugins.synced-lyrics.menu.convert-chinese-character.submenu.disabled.label',
          ),
          toolTip: t(
            'plugins.synced-lyrics.menu.convert-chinese-character.submenu.disabled.tooltip',
          ),
          type: 'radio',
          checked:
            config.convertChineseCharacter === 'disabled' ||
            config.convertChineseCharacter === undefined,
          click() {
            void ctx.setConfig({
              convertChineseCharacter: 'disabled',
            });
          },
        },
        {
          label: t(
            'plugins.synced-lyrics.menu.convert-chinese-character.submenu.simplified-to-traditional.label',
          ),
          toolTip: t(
            'plugins.synced-lyrics.menu.convert-chinese-character.submenu.simplified-to-traditional.tooltip',
          ),
          type: 'radio',
          checked: config.convertChineseCharacter === 'simplifiedToTraditional',
          click() {
            void ctx.setConfig({
              convertChineseCharacter: 'simplifiedToTraditional',
            });
          },
        },
        {
          label: t(
            'plugins.synced-lyrics.menu.convert-chinese-character.submenu.traditional-to-simplified.label',
          ),
          toolTip: t(
            'plugins.synced-lyrics.menu.convert-chinese-character.submenu.traditional-to-simplified.tooltip',
          ),
          type: 'radio',
          checked: config.convertChineseCharacter === 'traditionalToSimplified',
          click() {
            void ctx.setConfig({
              convertChineseCharacter: 'traditionalToSimplified',
            });
          },
        },
      ],
    },
    {
      label: t('plugins.synced-lyrics.menu.show-time-codes.label'),
      toolTip: t('plugins.synced-lyrics.menu.show-time-codes.tooltip'),
      type: 'checkbox',
      checked: config.showTimeCodes,
      click(item) {
        void ctx.setConfig({
          showTimeCodes: item.checked,
        });
      },
    },
    {
      label: t('plugins.synced-lyrics.menu.show-lyrics-even-if-inexact.label'),
      toolTip: t(
        'plugins.synced-lyrics.menu.show-lyrics-even-if-inexact.tooltip',
      ),
      type: 'checkbox',
      checked: config.showLyricsEvenIfInexact,
      click(item) {
        void ctx.setConfig({
          showLyricsEvenIfInexact: item.checked,
        });
      },
    },
  ];
};
