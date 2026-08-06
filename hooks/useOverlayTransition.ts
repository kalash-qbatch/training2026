"use client";

import { useEffect, useState } from "react";

/** Keeps overlay mounted during exit so CSS transitions can finish. */
export function useOverlayTransition(open: boolean, durationMs = 220) {
  const [present, setPresent] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setPresent(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(id);
    }

    setVisible(false);
    const t = window.setTimeout(() => setPresent(false), durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs]);

  return { present, visible };
}
