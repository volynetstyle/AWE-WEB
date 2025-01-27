import {
  requestMutation,
  requestMeasure,
  requestNextMutation,
} from "@/lib/modules/fastdom/fastdom";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useStableCallback } from "../base";
import { useDebouncedFunction } from "../shedulers";
import useWindowSize from "@/shared/hooks/DOM/useWindowSize";

const WINDOW_RESIZE_LINE_RECALC_DEBOUNCE = 200;

export default function useCollapsibleLines<
  T extends HTMLElement,
  C extends HTMLElement,
>(
  ref: RefObject<T | null>,
  maxLinesBeforeCollapse: number,
  cutoutRef?: RefObject<C>,
  isDisabled?: boolean,
) {
  const isFirstRenderRef = useRef(true);
  const cutoutHeightRef = useRef<number | undefined>(0);
  const [isCollapsible, setIsCollapsible] = useState(!isDisabled);
  const [isCollapsed, setIsCollapsed] = useState(isCollapsible);

  useLayoutEffect(() => {
    const element = (cutoutRef || ref).current;
    if (isDisabled || !element) return;

    requestMutation(() => {
      element.style.maxHeight = isCollapsed
        ? `${cutoutHeightRef.current}px`
        : "100dvh";
    });
  }, [cutoutRef, isCollapsed, isDisabled, ref]);

  const recalculateTextLines = useStableCallback(() => {
    if (isDisabled || !ref.current) {
      return;
    }
    const element = ref.current;

    const { lineHeight, totalLines } = calcTextLineHeightAndCount(element);
    if (totalLines > maxLinesBeforeCollapse) {
      cutoutHeightRef.current = lineHeight * maxLinesBeforeCollapse;
      setIsCollapsible(true);
    } else {
      setIsCollapsible(false);
      setIsCollapsed(false);
    }
  });

  const debouncedRecalcTextLines = useDebouncedFunction(
    () => requestMeasure(recalculateTextLines),
    [recalculateTextLines],
    WINDOW_RESIZE_LINE_RECALC_DEBOUNCE,
  );

  useLayoutEffect(() => {
    if (!isDisabled && isFirstRenderRef.current) {
      requestNextMutation(() => {
        recalculateTextLines();

        return () => {
          isFirstRenderRef.current = false;
          const element = (cutoutRef || ref).current;

          if (!element) {
            return;
          }

          element.style.maxHeight = cutoutHeightRef.current
            ? `${cutoutHeightRef.current}px`
            : "";
        };
      });
    }
  }, [cutoutRef, isDisabled, recalculateTextLines, ref]);

  // Parent resize is triggered on every collapse/expand, so we do recalculation only on window resize to save resources
  const { width: windowWidth } = useWindowSize();
  useEffect(() => {
    if (!isDisabled) {
      if (isFirstRenderRef.current) {
        return;
      }

      debouncedRecalcTextLines();
    } else {
      setIsCollapsible(false);
      setIsCollapsed(false);
    }
  }, [debouncedRecalcTextLines, isDisabled, windowWidth]);

  return {
    isCollapsed,
    isCollapsible,
    setIsCollapsed,
  };
}

export function calcTextLineHeightAndCount(textContainer: HTMLElement) {
  const lineHeight = parseInt(getComputedStyle(textContainer).lineHeight, 10);

  const totalLines = textContainer.scrollHeight / lineHeight;

  return {
    totalLines,
    lineHeight,
  };
}
