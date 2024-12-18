import { useIntersectionObserver } from '@/lib/hooks/sensors/useIntersectionObserver';
import useAppLayout from '@/lib/hooks/ui/useAppLayout';
import useBackgroundMode from '@/lib/hooks/ui/useBackgroundMode';
import { IS_ANDROID } from '@/lib/utils/OS/windowEnviroment';
import { RefObject } from 'react';

const INTERSECTION_THROTTLE_FOR_READING = 150;
const INTERSECTION_THROTTLE_FOR_MEDIA = IS_ANDROID ? 1000 : 350;

export default function useMessageObservers(containerRef: RefObject<HTMLDivElement>) {
  const { isMobile } = useAppLayout();
  const INTERSECTION_MARGIN_FOR_LOADING = isMobile ? 300 : 500;

  const {
    observe: observeIntersectionForBottom,
    freeze: freezeForReading,
    unfreeze: unfreezeForReading,
  } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE_FOR_READING,
  });

  useBackgroundMode(freezeForReading, unfreezeForReading);

  const { observe: observeIntersectionForLoading } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE_FOR_MEDIA,
    margin: INTERSECTION_MARGIN_FOR_LOADING,
  });

  const { observe: observeIntersectionForPlaying } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE_FOR_MEDIA,
  });

  return {
    observeIntersectionForBottom,
    observeIntersectionForLoading,
    observeIntersectionForPlaying,
  };
}
