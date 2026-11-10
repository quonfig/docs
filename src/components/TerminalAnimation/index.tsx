import React, { useEffect, useRef, useState } from "react";
import styles from "./styles.module.css";

export type TerminalLine = { kind: "command" | "output"; text: string };

type Props = {
  lines: TerminalLine[];
  /** Accessible description of what the animation shows. */
  label: string;
  /** Milliseconds per typed character. */
  typeMs?: number;
  /** Pause after each line, and before the loop restarts. */
  pauseMs?: number;
  restartMs?: number;
};

/**
 * A looping terminal session: commands type out character by character
 * (CSS `steps()` on a `ch` width), then their output appears. Starts when
 * scrolled into view; shows the full transcript statically for
 * prefers-reduced-motion.
 */
export default function TerminalAnimation({
  lines,
  label,
  typeMs = 45,
  pauseMs = 900,
  restartMs = 4000,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(lines.length);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !ref.current) return;

    let timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      timers.forEach(clearTimeout);
      timers = [];
      setShown(0);
      setCycle((c) => c + 1);
      let at = 300;
      lines.forEach((line, i) => {
        timers.push(setTimeout(() => setShown(i + 1), at));
        at += (line.kind === "command" ? line.text.length * typeMs : 0) + pauseMs;
      });
      timers.push(setTimeout(run, at + restartMs));
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          run();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [lines, typeMs, pauseMs, restartMs]);

  return (
    <div ref={ref} className={styles.terminal} role="img" aria-label={label}>
      <div className={styles.bar} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <pre className={styles.body} aria-hidden="true">
        {lines.slice(0, shown).map((line, i) =>
          line.kind === "command" ? (
            <div key={`${cycle}-${i}`} className={styles.command}>
              <span className={styles.prompt}>$ </span>
              <span
                className={styles.typed}
                style={
                  {
                    "--chars": line.text.length,
                    "--duration": `${line.text.length * typeMs}ms`,
                  } as React.CSSProperties
                }
              >
                {line.text}
              </span>
              {i === shown - 1 && <span className={styles.caret} />}
            </div>
          ) : (
            <div key={`${cycle}-${i}`} className={styles.output}>
              {line.text}
            </div>
          ),
        )}
      </pre>
    </div>
  );
}
