"use client"; // subscribes to browser-session API health for the cold-start banner (spec 006 AC23)

import { useEffect, useState } from "react";
import {
  isWithinColdStartWindow,
  subscribeToApiHealth,
} from "@/lib/api-health";

/**
 * Non-blocking banner shown when the API returns network errors / 502 /
 * 503 within the first 60s of the session (Render free-tier cold start).
 * Disappears on the first successful API response.
 */
export function ColdStartBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return subscribeToApiHealth((state) => {
      setVisible(state.waking && isWithinColdStartWindow());
    });
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950"
    >
      The service is waking up… (~30s)
    </div>
  );
}
