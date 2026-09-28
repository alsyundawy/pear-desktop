export interface VideoSwitchButtonProps {
  checked?: boolean;
  onChange?: (event: Event) => void;
  onClick?: (event: MouseEvent) => void;
  songButtonText: string;
  videoButtonText: string;
}

export const VideoSwitchButton = (props: VideoSwitchButtonProps) => {
  let checkboxRef: HTMLInputElement | null = null;

  const handleContainerClick = (e: MouseEvent) => {
    props.onClick?.(e);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isRightHalf = clickX > rect.width / 2;
    const checkbox =
      checkboxRef ??
      document.querySelector<HTMLInputElement>(
        '#video-toggle-video-switch-button-checkbox',
      );
    if (checkbox && checkbox.checked !== isRightHalf) {
      checkbox.checked = isRightHalf;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const checkbox =
        checkboxRef ??
        document.querySelector<HTMLInputElement>(
          '#video-toggle-video-switch-button-checkbox',
        );
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  };

  return (
    <button
      aria-label="Toggle song or video mode"
      class="video-switch-button"
      data-video-button-text={props.videoButtonText}
      onChange={(e) => props.onChange?.(e)}
      onClick={handleContainerClick}
      onKeyDown={handleKeyDown}
      type="button"
    >
      <input
        checked={props.checked ?? true}
        class="video-switch-button-checkbox"
        id="video-toggle-video-switch-button-checkbox"
        ref={(el) => {
          checkboxRef = el;
        }}
        type="checkbox"
      />
      <label
        class="video-switch-button-label"
        for="video-toggle-video-switch-button-checkbox"
      >
        <span class="video-switch-button-label-span">
          {props.songButtonText}
        </span>
      </label>
    </button>
  );
};
