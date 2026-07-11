"use client";

import { useMemo, useRef, useState, useEffect, type ReactNode } from "react";

/**
 * Lightweight windowed list — avoids rendering tens of thousands of DOM nodes.
 * No extra dependency; good enough for fiscal tables until @tanstack/react-virtual is adopted.
 */
export function VirtualList<T>({
  items,
  estimateSize = 52,
  height = 480,
  overscan = 8,
  renderRow,
  empty,
}: {
  items: T[];
  estimateSize?: number;
  height?: number;
  overscan?: number;
  renderRow: (item: T, index: number) => ReactNode;
  empty?: ReactNode;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const total = items.length * estimateSize;
  const start = Math.max(0, Math.floor(scrollTop / estimateSize) - overscan);
  const visibleCount = Math.ceil(height / estimateSize) + overscan * 2;
  const end = Math.min(items.length, start + visibleCount);
  const slice = useMemo(() => items.slice(start, end), [items, start, end]);

  if (!items.length) return <>{empty}</>;

  return (
    <div
      ref={parentRef}
      className="overflow-auto rounded-xl border border-white/10"
      style={{ height }}
      role="list"
      aria-label={`Lista com ${items.length} itens`}
    >
      <div style={{ height: total, position: "relative" }}>
        {slice.map((item, i) => {
          const index = start + i;
          return (
            <div
              key={index}
              role="listitem"
              style={{
                position: "absolute",
                top: index * estimateSize,
                left: 0,
                right: 0,
                height: estimateSize,
              }}
            >
              {renderRow(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
