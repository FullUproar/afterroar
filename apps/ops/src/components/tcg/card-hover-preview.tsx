"use client";

import { useRef, useState, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  CardHoverPreview — floating full-size card image on hover          */
/*                                                                     */
/*  Universal TCG-tool convention: hovering any card name should show  */
/*  the full card image. Moxfield, Archidekt, TappedOut, Scryfall all  */
/*  implement this. When missing, TCG players instantly notice.        */
/*                                                                     */
/*  Positions the preview to the right of the trigger, flipping left   */
/*  if it would overflow the viewport. Clamps vertically.              */
/* ------------------------------------------------------------------ */

const PREVIEW_W = 280;
const PREVIEW_H = 390;
const MARGIN = 8;
const HOVER_DELAY_MS = 180;
const LEAVE_DELAY_MS = 80;

interface Props {
  imageUrl: string | null | undefined;
  name?: string;
  children: React.ReactNode;
  className?: string;
}

export function CardHoverPreview({ imageUrl, name, children, className }: Props) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const handleEnter = useCallback(() => {
    if (!imageUrl) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      let x = rect.right + MARGIN;
      let y = rect.top - 20;

      // Flip left if overflowing right edge
      if (x + PREVIEW_W > window.innerWidth - MARGIN) {
        x = rect.left - PREVIEW_W - MARGIN;
      }
      // Clamp bottom
      if (y + PREVIEW_H > window.innerHeight - MARGIN) {
        y = window.innerHeight - PREVIEW_H - MARGIN;
      }
      // Clamp top
      if (y < MARGIN) y = MARGIN;

      setPos({ x, y });
      setShow(true);
    }, HOVER_DELAY_MS);
  }, [imageUrl]);

  const handleLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(false), LEAVE_DELAY_MS);
  }, []);

  // No image available — render children unchanged, no hover affordance.
  if (!imageUrl) {
    return <>{children}</>;
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}
        className={className}
      >
        {children}
      </span>
      {show && pos && (
        <div
          role="tooltip"
          aria-hidden="true"
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            zIndex: 200,
            pointerEvents: "none",
            width: PREVIEW_W,
            height: PREVIEW_H,
          }}
          className="animate-in fade-in zoom-in-95 duration-150"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={name ?? ""}
            className="w-full h-full rounded-xl shadow-2xl ring-1 ring-white/10 object-cover bg-card-hover"
            draggable={false}
          />
        </div>
      )}
    </>
  );
}
