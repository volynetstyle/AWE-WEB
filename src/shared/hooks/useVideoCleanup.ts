import { onIdleComplete } from '@/lib/core';
import { useStateRef } from '@/lib/hooks/state/useStateRef';
import unloadVideo from '@/lib/utils/unloadVideo';
import { useLayoutEffect } from 'react';

export default function useVideoCleanup(
  videoRef?: React.RefObject<HTMLVideoElement | null>,
  handlers?: Record<string, AnyFunction>,
) {
  const handlersRef = useStateRef(handlers);

  useLayoutEffect(() => {
    const videoEl = videoRef?.current;
    if (!videoEl) {
      return undefined;
    }

    return () => {
      const handlers = handlersRef.current;

      if (handlers) {
        Object.entries(handlers).forEach(([eventName, handler]) => {
          videoEl.removeEventListener(resolveEventType(eventName, videoEl), handler, false);
        });
      }

      // specifically on iOS, we postpone it after unmounting
      onIdleComplete(() => {
        unloadVideo(videoEl);
      });
    };
  }, [handlersRef, videoRef]);
}

export function resolveEventType(propName: string, element: Element) {
  const eventType = propName
    .replace(/^on/, '')
    .replace(/Capture$/, '')
    .toLowerCase();

  if (eventType === 'change' && element.tagName !== 'SELECT') {
    // React behavior repeated here.
    // https://stackoverflow.com/questions/38256332/in-react-whats-the-difference-between-onchange-and-oninput
    return 'input';
  }

  if (eventType === 'doubleclick') {
    return 'dblclick';
  }

  // Replace focus/blur by their "bubbleable" versions
  if (eventType === 'focus') {
    return 'focusin';
  }

  if (eventType === 'blur') {
    return 'focusout';
  }

  return eventType;
}
