import { useStateRef } from '@/lib/hooks/state/useStateRef';
import { CallbackManager, createCallbackManager } from '@/lib/utils/callbacks';
import { useEffect } from 'react';

const elementObserverMap = new WeakMap<HTMLElement, [ResizeObserver, CallbackManager]>();

export default function useResizeObserver(
  ref: React.RefObject<HTMLElement | null>,
  onResize: (entry: ResizeObserverEntry) => void,
  isDisabled = false,
) {
  const onResizeRef = useStateRef(onResize);

  useEffect(() => {
    const element = ref?.current;
    if (!element || isDisabled) {
      return;
    }

    const callback: ResizeObserverCallback = ([entry]) => {
      const { width, height } = entry.contentRect;

      if (width === 0 && height === 0) {
        return;
      }

      onResizeRef.current(entry);
    };

    let [observer, callbackManager] = elementObserverMap.get(element) || [undefined, undefined];

    if (!observer) {
      callbackManager = createCallbackManager();
      observer = new ResizeObserver(callbackManager.runCallbacks);
      elementObserverMap.set(element, [observer, callbackManager]);
      observer.observe(element);
    }

    callbackManager!.addCallback(callback);

    return () => {
      callbackManager!.removeCallback(callback);

      if (!callbackManager!.hasCallbacks()) {
        observer!.unobserve(element);
        observer!.disconnect();
      }
    };
  }, [isDisabled, onResizeRef, ref]);
}