import { requestMeasure } from "@/lib/modules/fastdom/fastdom";
import { useRef, useCallback } from "react";
import useEffectOnce from "../effects/useEffectOnce";
import useLastCallback from "../callbacks/useLastCallback";
import useEffectSync from "../effects/useEffectSync";
import { IS_TEST } from "@/lib/config/dev";
import { IS_IOS } from "@/lib/core";
import { partition } from "@/lib/utils/iteratees";

const PATH_BASE = `${window.location.pathname}${window.location.search}`;
// Carefully selected by swiping and observing visual changes
// TODO: may be different on other devices such as iPad, maybe take dpi into account?
const SAFARI_EDGE_BACK_GESTURE_LIMIT = 300 * window.devicePixelRatio; // Adjust based on screen DPI
const SAFARI_EDGE_BACK_GESTURE_DURATION = 350;

type HistoryRecord = {
  index: number;
  // Should this record be replaced by the next record (for example Menu)
  shouldBeReplaced?: boolean;
  // Set if the element is closed in the UI, but not in the real history
  isClosed?: boolean;
  // Mark this record as replaced by the next record. Only used to check if needed to perform effectBack
  markReplaced?: VoidFunction;
  onBack?: VoidFunction;
};

type HistoryOperationGo = {
  type: "go";
  delta: number;
};

type HistoryOperationState<T extends any = any> = {
  type: "pushState" | "replaceState";
  data: T;
  hash?: string;
};

type HistoryOperation = HistoryOperationGo | HistoryOperationState;

// Needed to dismiss any 'trashed' history records from the previous page reloads.
const historyUniqueSessionId = Number(new Date());
// Reflects real history state, but also contains information on which records should be replaced by the next record and
// which records are deferred to close on the next operation
let historyState: HistoryRecord[];
// Reflects current real history index
let historyCursor: number;
// If we alter real history programmatically, the popstate event will be fired, which we don't need
let isAlteringHistory = false;
// Unfortunately Safari doesn't really like when there's 2+ consequent history operations in one frame, so we need
// to delay them to the next raf
let deferredHistoryOperations: HistoryOperation[] = [];
let deferredPopstateOperations: HistoryOperationState[] = [];
let isSafariGestureAnimation = false;

// Do not remove: used for history unit tests
if (IS_TEST) {
  (window as any).TEST_getHistoryState = () => historyState;
  (window as any).TEST_getHistoryCursor = () => historyCursor;
}

// #v-ifndef IS_IOS
const touchRanges: () => [(event: TouchEvent) => void, () => void] = () => {
  // Cache values that don't change frequently
  const gestureLimit = SAFARI_EDGE_BACK_GESTURE_LIMIT;
  const windowWidth = window.innerWidth;

  // Track the timeout to avoid redundant resets
  let animationTimeout: NodeJS.Timeout | null = null;

  return [
    (event: TouchEvent) => {
      const x = event.touches[0].pageX;

      // Check if touch is within the Safari back gesture range
      if (x <= gestureLimit || x >= windowWidth - gestureLimit) {
        isSafariGestureAnimation = true;
      }
    },
    () => {
      if (!isSafariGestureAnimation) {
        return;
      }

      // Clear any previous timeout if it's still active (debouncing)
      if (animationTimeout) {
        clearTimeout(animationTimeout);
      }

      // Reset animation state after a delay
      animationTimeout = setTimeout(() => {
        isSafariGestureAnimation = false;
        animationTimeout = null;
      }, SAFARI_EDGE_BACK_GESTURE_DURATION);
    },
  ];
};

const [handleTouchStart, handleTouchEnd] = touchRanges();

window.addEventListener("touchstart", handleTouchStart);
window.addEventListener("touchend", handleTouchEnd);
window.addEventListener("popstate", handleTouchEnd);
// #v-endlif

function applyDeferredHistoryOperations() {
  const [goOperations, stateOperations] = partition(
    deferredHistoryOperations,
    (op) => op.type === "go",
  ) as [HistoryOperationGo[], HistoryOperationState[]];

  deferredHistoryOperations = [];

  const goCount = goOperations.countBy((op) => op.delta);

  if (goCount) {
    window.history.go(goCount);

    // If we have some `state` operations after the `go` operations, we need to wait until the popstate event
    // so the order of operations is correctly preserved
    if (stateOperations.length) {
      deferredPopstateOperations.push(...stateOperations);
      return;
    }
  }

  processStateOperations(stateOperations);
}

function processStateOperations(stateOperations: HistoryOperationState[]) {
  stateOperations.forEach((operation) => {
    const { type, data, hash } = operation;
    const historyMethod = window.history[type];

    historyMethod(data, "", hash);
  });
}

function deferHistoryOperation(historyOperation: HistoryOperation) {
  if (!deferredHistoryOperations.length) {
    requestMeasure(applyDeferredHistoryOperations);
  }

  deferredHistoryOperations.push(historyOperation);
}

// Resets history to the `root` state
function resetHistory() {
  historyCursor = 0;
  historyState = [
    {
      index: 0,
      onBack: () => window.history.back(),
    },
  ];

  window.history.replaceState(
    { index: 0, historyUniqueSessionId },
    "",
    PATH_BASE,
  );
}

resetHistory();

function cleanupClosed(alreadyClosedCount = 1) {
  let countClosed = alreadyClosedCount;

  for (let i = historyCursor - 1; i > 0; i--) {
    if (historyState[i].isClosed) {
      countClosed++;
    }
  }

  if (countClosed) {
    isAlteringHistory = true;
    deferHistoryOperation({
      type: "go",
      delta: -countClosed,
    });
  }

  return countClosed;
}

function cleanupTrashedState() {
  // Navigation to previous page reload, state of which was trashed by reload
  let isAnimationDisabled = false;

  for (let i = historyState.length - 1; i > 0; i--) {
    if (historyState[i].isClosed) {
      continue;
    }

    // TODO[history]: probably we should not call this inside the loop
    if (!isAnimationDisabled && isSafariGestureAnimation) {
      isAnimationDisabled = true;
    }
    historyState[i].onBack?.();
  }

  resetHistory();
}

window.addEventListener("popstate", ({ state }: PopStateEvent) => {
  if (isAlteringHistory) {
    isAlteringHistory = false;

    if (deferredPopstateOperations.length) {
      processStateOperations(deferredPopstateOperations);
      deferredPopstateOperations = [];
    }

    return;
  }

  if (!state) {
    cleanupTrashedState();

    if (window.location.hash) {
      return;
    }
  }

  const { index, historyUniqueSessionId: previousUniqueSessionId } = state;

  if (previousUniqueSessionId !== historyUniqueSessionId) {
    cleanupTrashedState();
    return;
  }

  // New real history state matches the old virtual one. Not possible in theory, but in practice we have Safari
  if (index === historyCursor) {
    return;
  }

  if (index < historyCursor) {
    // Navigating back
    let alreadyClosedCount = 0;
    let isAnimationDisabled = false;

    for (let i = historyCursor; i > index - alreadyClosedCount; i--) {
      if (historyState[i].isClosed) {
        alreadyClosedCount++;
        continue;
      }

      // TODO[history]: probably we should not call this inside the loop
      if (!isAnimationDisabled && isSafariGestureAnimation) {
        isAnimationDisabled = true;
      }

      historyState[i].onBack?.();
    }

    const countClosed = cleanupClosed(alreadyClosedCount);
    historyCursor += index - historyCursor - countClosed;

    // Can happen when we have deferred a real back for some element (for example Menu), closed via UI,
    // pressed back button and caused a pushState.
    if (historyCursor < 0) {
      historyCursor = 0;
    }
  } else if (index > historyCursor) {
    // Forward navigation is not yet supported
    isAlteringHistory = true;

    deferHistoryOperation({
      type: "go",
      delta: -(index - historyCursor),
    });
  }
});

type OwnProps = {
  isActive?: boolean;
  shouldBeReplaced?: boolean;
  hash?: string;
  shouldResetUrlHash?: boolean;
  onBack: VoidFunction;
};

export default function useHistoryBack({
  isActive,
  shouldBeReplaced,
  shouldResetUrlHash,
  hash,
  onBack,
}: OwnProps) {
  const lastOnBack = useLastCallback(onBack);

  // Active index of the record
  const indexRef = useRef<number>(0);
  const wasReplaced = useRef(false);
  const isFirstRender = useRef(true);

  const pushState = useCallback(
    (forceReplace = false) => {
      // Check if the old state should be replaced
      const shouldReplace =
        forceReplace || historyState[historyCursor].shouldBeReplaced;
      indexRef.current = shouldReplace ? historyCursor : ++historyCursor;

      historyCursor = indexRef.current;

      // Mark the previous record as replaced so effectBack doesn't perform back operation on the new record
      const previousRecord = historyState[indexRef.current];
      if (previousRecord && !previousRecord.isClosed) {
        previousRecord.markReplaced?.();
      }

      historyState[indexRef.current] = {
        index: indexRef.current,
        onBack: lastOnBack,
        shouldBeReplaced,
        markReplaced: () => {
          wasReplaced.current = true;
        },
      };

      deferHistoryOperation({
        type: shouldReplace ? "replaceState" : "pushState",
        data: {
          index: indexRef.current,
          historyUniqueSessionId,
        },
        // Space is a hack to make the browser completely remove the hash
        hash: hash ? `#${hash}` : shouldResetUrlHash ? " " : undefined,
      });
    },
    [hash, shouldBeReplaced, shouldResetUrlHash],
  );

  const processBack = useCallback(() => {
    // Only process back on open records
    if (
      indexRef.current &&
      historyState[indexRef.current] &&
      !wasReplaced.current
    ) {
      historyState[indexRef.current].isClosed = true;
      wasReplaced.current = true;

      if (indexRef.current === historyCursor && !shouldBeReplaced) {
        historyCursor -= cleanupClosed();
      }
    }
  }, [shouldBeReplaced]);

  // Process back navigation when element is unmounted
  useEffectOnce(() => {
    isFirstRender.current = false;

    return () => {
      if (!isActive || wasReplaced.current) return;
      processBack();
    };
  });

  useEffectSync(
    ([prevIsActive]) => {
      if (prevIsActive === isActive || (isFirstRender.current && !isActive)) {
        return;
      }

      if (isActive) {
        pushState();
      } else {
        processBack();
      }
    },
    [isActive, processBack, pushState],
  );
}
