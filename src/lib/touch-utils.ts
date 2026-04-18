/**
 * Touch device detection and utilities
 */

/** Detect if the current device has touch capabilities */
export function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore - Legacy IE
    navigator.msMaxTouchPoints > 0
  );
}

/** Detect if the user agent indicates a mobile device */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/** Get optimal touch target size in pixels (44px minimum for iOS HIG) */
export function getTouchTargetSize(): number {
  return 44;
}

/** Check if visual viewport API is available for virtual keyboard handling */
export function supportsVisualViewport(): boolean {
  return 'visualViewport' in window;
}

/**
 * Handle virtual keyboard appearance by adjusting element position
 * Returns cleanup function
 */
export function handleVirtualKeyboard(
  element: HTMLElement,
  callback?: (height: number, isVisible: boolean) => void
): (() => void) | null {
  if (!supportsVisualViewport()) {
    return null;
  }

  const visualViewport = window.visualViewport!;
  const initialHeight = visualViewport.height;

  const handleViewportChange = () => {
    const currentHeight = visualViewport.height;
    const keyboardHeight = initialHeight - currentHeight;
    const isKeyboardVisible = keyboardHeight > 50; // Threshold to account for browser UI changes

    callback?.(keyboardHeight, isKeyboardVisible);

    // Adjust element position if keyboard is visible
    if (isKeyboardVisible) {
      const elementRect = element.getBoundingClientRect();
      const elementBottom = elementRect.bottom;
      const viewportBottom = currentHeight;

      // If element is hidden behind keyboard, adjust its position
      if (elementBottom > viewportBottom) {
        const offset = elementBottom - viewportBottom + 20; // 20px padding
        element.style.transform = `translateY(-${offset}px)`;
      }
    } else {
      // Reset position when keyboard is hidden
      element.style.transform = '';
    }
  };

  visualViewport.addEventListener('resize', handleViewportChange);

  // Cleanup function
  return () => {
    visualViewport.removeEventListener('resize', handleViewportChange);
    element.style.transform = '';
  };
}

/**
 * Get CSS class names for touch-specific styling
 */
export function getTouchClasses(isTouch: boolean = isTouchDevice()) {
  return {
    touchOnly: isTouch ? '' : 'hidden',
    mouseOnly: isTouch ? 'hidden' : '',
    touchTarget: isTouch ? 'min-h-[44px] min-w-[44px]' : '',
  };
}