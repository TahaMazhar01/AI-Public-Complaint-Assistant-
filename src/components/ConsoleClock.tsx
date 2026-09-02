"use client";

import { useEffect, useState } from "react";

/* A wall clock in an ops room. Renders blank on the server so the
   markup matches, then ticks once mounted. */
export default function ConsoleClock() {
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="type-meta text-console-muted hidden tabular-nums sm:inline">
      {now || "--:--:--"}
    </span>
  );
}
