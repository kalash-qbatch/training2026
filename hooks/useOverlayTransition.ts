"use client";

import { useEffect, useState } from "react";

/** Keeps overlay mounted during exit so CSS transitions can finish. */
export function useOverlayTransition(open: boolean, durationMs = 220) {
  const [present, setPresent] = useState(open);
  const [visible, setVisible] = useState(false);

  // Adjust state during render instead of inside the effect
  // (https://react.dev/learn/you-might-not-need-an-effect)
  if (open && !present) setPresent(true);
  if (!open && visible) setVisible(false);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(id);
    }

    const t = window.setTimeout(() => setPresent(false), durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs]);

  return { present, visible };
}
