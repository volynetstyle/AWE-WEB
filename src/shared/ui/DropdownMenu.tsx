import React, { FC, useState, memo, useEffect } from "react";
import { motion } from "framer-motion";
import s from "./DropdownMenu.module.scss";
import buildClassName from "../lib/buildClassName";
import captureKeyboardListeners from "@/lib/utils/captureKeyboardListeners";
import LightEffect from "./common/LightEffect";
import trapFocus from "@/lib/utils/trapFocus";
import {
  dispatchHeavyAnimation,
  throttle,
  withFreezeWhenClosed,
} from "@/lib/core";
import { pipe } from "@/lib/core/public/misc/Pipe";
import { useRefInstead } from "../hooks/base";
import { useLayoutEffectWithPreviousDeps } from "../hooks/effects/useEffectWithPreviousDependencies";

interface OwnTriggerProps<T = HTMLElement> extends React.HTMLAttributes<T> {
  onTrigger: NoneToVoidFunction;
  isOpen?: boolean;
  tabIndex?: number;
}

interface OwnSharedProps {
  position: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

interface OwnProps {
  reference?: React.RefObject<HTMLDivElement>;
  className?: string;
  containerClass?: string;
  children: React.ReactNode;
  triggerButton?: FC<OwnTriggerProps>;
  isOpen?: boolean;
  shouldClose?: boolean;
  usePortal?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onHide?: () => void;
  onEnter?: () => void;
  onTransitionEnd?: () => void;
  onBackdropMouseEnter?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => void;
}

const OUTBOX_SIZE = 60; //px
const SCALE_FACTOR = 0.85; //%
const THROTTLE_INTERVAL = 250; //1/4 per second
const TRANSITION_DURATION = 0.15;

const DropdownMenu: FC<OwnProps & OwnSharedProps> = ({
  reference,
  className,
  containerClass,
  children,
  triggerButton: TriggerButton,
  position = "top-right",
  shouldClose,
  onOpen,
  onClose,
  onEnter,
  onTransitionEnd,
  onBackdropMouseEnter,
}) => {
  const dropdownRef = useRefInstead<HTMLDivElement>(reference);

  const [isOpen, setIsOpen] = useState(false);

  const isTop = position.startsWith("top");
  const isLeft = position.endsWith("left");

  const handleTriggerClick = () => {
    setIsOpen((prev) => !prev);

    if (isOpen) {
      onOpen?.();
    } else {
      onClose?.();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  const handleEnter = (e: KeyboardEvent) => {
    e.preventDefault();

    return onEnter ? (onEnter?.(), true) : false;
  };

  useEffect(() => {
    if (shouldClose) {
      handleClose();
      return;
    }

    if (isOpen) {
      return captureKeyboardListeners({
        onEsc: handleClose,
        onEnter: handleEnter,
      });
    }
  }, [shouldClose, isOpen]);

  useEffect(() => {
    const menu = dropdownRef.current;

    if (!menu || !isOpen) return;

    const position = menu!.getBoundingClientRect();

    const handleMove = throttle((e: MouseEvent) => {
      const { clientX: x, clientY: y } = e;

      // TODO: Fix on diff alignments
      // Check if pointer is inside the expanded area
      // Scale factor is for forward compatibility
      const factoredPosition = {
        top: position.top / (isTop ? SCALE_FACTOR : 1),
        left: position.left / (isLeft ? SCALE_FACTOR : 1),
        right: position.right / (isLeft ? SCALE_FACTOR : 1),
        bottom: position.bottom / (isTop ? SCALE_FACTOR : 1),
      };

      const adjTop = factoredPosition.top - OUTBOX_SIZE;
      const adjLeft = factoredPosition.left - OUTBOX_SIZE;
      const adjRight = factoredPosition.right + OUTBOX_SIZE;
      const adjBottom = factoredPosition.bottom + OUTBOX_SIZE;

      const isPointerInside =
        x > adjLeft && x < adjRight && y > adjTop && y < adjBottom;

      if (!isPointerInside) {
        handleClose();
      }
    }, THROTTLE_INTERVAL);

    const trapFocusCleanup = trapFocus(menu);
    window.addEventListener("mousemove", handleMove);

    return () => {
      trapFocusCleanup();
      window.removeEventListener("mousemove", handleMove);
    };
  }, [isOpen, handleClose]);

  useLayoutEffectWithPreviousDeps(
    ([prevIsOpen]) => {
      document.body.classList.toggle("has-open-dialog", isOpen);

      const isOpened = !isOpen && prevIsOpen !== undefined;

      if (isOpen || isOpened) {
        dispatchHeavyAnimation(TRANSITION_DURATION);
      }

      return () => {
        document.body.classList.remove("has-open-dialog");
      };
    },
    [isOpen],
  );

  return (
    <div className={buildClassName(s.dropdownContainer, containerClass)}>
      {TriggerButton && (
        <TriggerButton
          isOpen={isOpen}
          onTrigger={handleTriggerClick}
          tabIndex={-1}
        />
      )}

      <motion.div
        initial={{
          visibility: "hidden",
          scale: SCALE_FACTOR,
          opacity: 0,
          willChange: "transform",
        }}
        animate={{
          visibility: isOpen ? "visible" : "hidden",
          scale: isOpen ? 1 : SCALE_FACTOR,
          opacity: isOpen ? 1 : 0,
        }}
        exit={{ scale: SCALE_FACTOR, opacity: 0 }}
        transition={{
          duration: TRANSITION_DURATION,
          ease: "easeInOut",
        }}
        role="menu"
        aria-hidden={!isOpen}
        aria-expanded={isOpen}
        data-position={position}
        tabIndex={-1}
        className={buildClassName(s.dropdownMenu, s[position])}
        onMouseEnter={onBackdropMouseEnter}
        ref={dropdownRef}
        onTransitionEnd={onTransitionEnd}
      >
        <section className={buildClassName(s.dropdownBody, className)}>
          {children}
        </section>
        <LightEffect gridRef={dropdownRef} lightSize={700} />
      </motion.div>

      {isOpen && (
        <div
          className={s.dropdownBackdrop}
          role="presentation"
          onClick={handleClose}
        />
      )}
    </div>
  );
};

export default pipe(withFreezeWhenClosed, memo)(DropdownMenu);
export type {
  OwnTriggerProps as TriggerProps,
  OwnSharedProps as DropdopwnSharedProps,
};
