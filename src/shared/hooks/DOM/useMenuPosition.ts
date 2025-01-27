import { requestNextMutation } from "@/lib/modules/fastdom/fastdom";
import { useCallback, useLayoutEffect } from "react";
import { addExtraClass, setExtraStyles } from "../../lib/extraClassHelpers";
import { useStateRef } from "../base";

type IAnchorPosition = {
  x: number;
  y: number;
};

interface StaticPositionOptions {
  anchor?: IAnchorPosition;
  positionX?: "left" | "right";
  positionY?: "top" | "bottom";
  transformOriginX?: number;
  transformOriginY?: number;
  style?: string;
  heightStyle?: string;
}

interface DynamicPositionOptions {
  anchor: IAnchorPosition;
  getTriggerElement: () => HTMLElement | null;
  getRootElement: () => HTMLElement | null;
  getMenuElement: () => HTMLElement | null;
  getLayout?: () => Layout;
  withMaxHeight?: boolean;
}

export type MenuPositionOptions =
  | StaticPositionOptions
  | DynamicPositionOptions;

export interface Layout {
  extraPaddingX?: number;
  extraTopPadding?: number;
  extraMarginTop?: number;
  menuElMinWidth?: number;
  deltaX?: number;
  topShiftY?: number;
  shouldAvoidNegativePosition?: boolean;
  withPortal?: boolean;
  isDense?: boolean; //  Allows you to place the menu as close to the edges of the area as possible
}

const MENU_POSITION_VISUAL_COMFORT_SPACE_PX = 16;
const MENU_POSITION_BOTTOM_MARGIN = 12;
const EMPTY_RECT = {
  width: 0,
  left: 0,
  height: 0,
  top: 0,
};

export default function useMenuPosition(
  isOpen: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
  bubbleRef: React.RefObject<HTMLDivElement | null>,
  options: MenuPositionOptions,
) {
  const optionsRef = useStateRef(options);

  const applyPositioning = useCallback(() => {
    const options = optionsRef.current;

    if (!("getTriggerElement" in options)) {
      applyStaticOptions(containerRef!, bubbleRef!, options);
    } else {
      requestNextMutation(() => {
        const staticOptions = processDynamically(options);

        return () => {
          applyStaticOptions(containerRef!, bubbleRef!, staticOptions);
        };
      });
    }
  }, [containerRef, bubbleRef, optionsRef]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    applyPositioning();
  }, [isOpen, applyPositioning]);
}

function applyStaticOptions(
  containerRef: React.RefObject<HTMLDivElement | null>,
  bubbleRef: React.RefObject<HTMLDivElement | null>,
  {
    positionX = "left",
    positionY = "top",
    transformOriginX,
    transformOriginY,
    style,
    heightStyle,
  }: StaticPositionOptions,
) {
  const containerEl = containerRef.current!;
  const bubbleEl = bubbleRef.current!;

  if (style) {
    containerEl.style.cssText = style;
  }

  if (heightStyle) {
    bubbleEl.style.cssText = heightStyle;
  }

  if (positionX) {
    addExtraClass(bubbleEl, positionX);
  }

  if (positionY) {
    addExtraClass(bubbleEl, positionY);
  }

  setExtraStyles(bubbleEl, {
    transformOrigin: [
      transformOriginX ? `${transformOriginX}px` : positionX,
      transformOriginY ? `${transformOriginY}px` : positionY,
    ].join(" "),
  });
}

function processDynamically(
  // containerRef: React.RefObject<HTMLDivElement>,
  // bubbleRef: React.RefObject<HTMLDivElement>,
  {
    anchor,
    getRootElement,
    getMenuElement,
    getTriggerElement,
    getLayout,
    withMaxHeight,
  }: DynamicPositionOptions,
) {
  const triggerEl = getTriggerElement()!;

  let { x, y } = anchor;

  const anchorX = x;
  const anchorY = y;

  const menuEl = getMenuElement();
  const rootEl = getRootElement();

  const {
    extraPaddingX = 0,
    extraTopPadding = 0,
    extraMarginTop = 0,
    topShiftY = 0,
    menuElMinWidth = 0,
    deltaX = 0,
    shouldAvoidNegativePosition = false,
    withPortal = false,
    isDense = false,
  } = getLayout?.() || {};

  const marginTop = menuEl
    ? parseInt(getComputedStyle(menuEl).marginTop, 10) + extraMarginTop
    : 0;
  const { offsetWidth: menuElWidth, offsetHeight: menuElHeight } = menuEl || {
    offsetWidth: 0,
    offsetHeight: 0,
  };
  const menuRect = menuEl
    ? {
        width: Math.max(menuElWidth, menuElMinWidth),
        height: menuElHeight + marginTop,
      }
    : EMPTY_RECT;

  const rootRect = rootEl ? rootEl.getBoundingClientRect() : EMPTY_RECT;

  let positionX: "left" | "right";
  let positionY: "top" | "bottom";

  if (
    isDense ||
    x + menuRect.width + extraPaddingX < rootRect.width + rootRect.left
  ) {
    x += 3;
    positionX = "left";
  } else if (x - menuRect.width - rootRect.left > 0) {
    positionX = "right";
    x -= 3;
  } else {
    positionX = "left";
    x = 16;
  }

  x += deltaX;

  const yWithTopShift = y + topShiftY;

  if (
    isDense ||
    yWithTopShift + menuRect.height < rootRect.height + rootRect.top
  ) {
    positionY = "top";
    y = yWithTopShift;
  } else {
    positionY = "bottom";

    if (y - menuRect.height < rootRect.top + extraTopPadding) {
      y = rootRect.top + rootRect.height;
    }
  }

  const triggerRect = triggerEl.getBoundingClientRect();

  const addedYForPortalPositioning = withPortal ? triggerRect.top : 0;
  const addedXForPortalPositioning = withPortal ? triggerRect.left : 0;

  const leftWithPossibleNegative = Math.min(
    x - triggerRect.left,
    rootRect.width - menuRect.width - MENU_POSITION_VISUAL_COMFORT_SPACE_PX,
  );
  let left =
    (positionX === "left"
      ? withPortal || shouldAvoidNegativePosition
        ? Math.max(
            MENU_POSITION_VISUAL_COMFORT_SPACE_PX,
            leftWithPossibleNegative,
          )
        : leftWithPossibleNegative
      : x - triggerRect.left) + addedXForPortalPositioning;
  let top = y - triggerRect.top + addedYForPortalPositioning;

  if (isDense) {
    left = Math.min(
      left,
      rootRect.width - menuRect.width - MENU_POSITION_VISUAL_COMFORT_SPACE_PX,
    );
    top = Math.min(
      top,
      rootRect.height - menuRect.height - MENU_POSITION_VISUAL_COMFORT_SPACE_PX,
    );
  }

  // Avoid hiding external parts of menus on mobile devices behind the edges of the screen (ReactionSelector for example)
  const addedXForMenuPositioning = menuElMinWidth
    ? Math.max(0, (menuElMinWidth - menuElWidth) / 2)
    : 0;

  if (left - addedXForMenuPositioning < 0 && shouldAvoidNegativePosition) {
    left = addedXForMenuPositioning + MENU_POSITION_VISUAL_COMFORT_SPACE_PX;
  }

  const offsetX =
    anchorX + addedXForPortalPositioning - triggerRect.left - left;
  const offsetY =
    anchorY + addedYForPortalPositioning - triggerRect.top - top - marginTop;
  const transformOriginX =
    positionX === "left" ? offsetX : menuRect.width + offsetX;
  const transformOriginY =
    positionY === "bottom" ? menuRect.height + offsetY : offsetY;

  const style = `left: ${left}px; top: ${top}px`;

  let heightStyle;

  if (withMaxHeight) {
    const menuMaxHeight =
      rootRect.height - MENU_POSITION_BOTTOM_MARGIN - marginTop;
    heightStyle = `max-height: ${menuMaxHeight}px;`;
  }

  return {
    positionX,
    positionY,
    transformOriginX,
    transformOriginY,
    style,
    heightStyle,
  };
}
