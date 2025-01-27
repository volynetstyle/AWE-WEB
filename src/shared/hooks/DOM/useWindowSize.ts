import { useState, useEffect, useMemo } from "react";
import { throttle } from "@/lib/core";
import windowSize from "../../../lib/utils/windowSize";
import { useDebouncedFunction } from "@/shared/hooks/shedulers";

const THROTTLE = 250;

export default function useWindowSize() {
  const { width: initialWidth, height: initialHeight } = windowSize.get();
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [isResizing, setIsResizing] = useState(false);

  const setIsResizingDebounced = useDebouncedFunction(
    setIsResizing,
    [setIsResizing],
    THROTTLE,
    true,
  );

  useEffect(() => {
    const throttledSetIsResizing = throttle(
      () => {
        setIsResizing(true);
      },
      THROTTLE,
      true,
    );

    const throttledSetSize = throttle(
      () => {
        const { width: newWidth, height: newHeight } = windowSize.get();
        setWidth(newWidth);
        setHeight(newHeight);
        setIsResizingDebounced(false);
      },
      THROTTLE,
      false,
    );

    const handleResize = () => {
      throttledSetIsResizing();
      throttledSetSize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [setIsResizingDebounced]);

  return useMemo(
    () => ({ width, height, isResizing }),
    [height, isResizing, width],
  );
}
