import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal fixed-row-height virtual scroller. Renders only the rows in view
 * (plus a small overscan), so a 9,000-row list stays as fast as a 20-row one.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  height,
  overscan = 8,
  renderRow,
  className,
}: {
  items: T[];
  rowHeight: number;
  height: number;
  overscan?: number;
  renderRow: (item: T, index: number) => ReactNode;
  className?: string;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const total = items.length;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(height / rowHeight) + overscan * 2;
  const end = Math.min(total, start + visibleCount);
  const slice = items.slice(start, end);

  return (
    <div
      ref={ref}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      style={{ height, overflowY: "auto" }}
      className={cn("relative", className)}
    >
      <div style={{ height: total * rowHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${start * rowHeight}px)` }}>
          {slice.map((item, i) => (
            <div key={start + i} style={{ height: rowHeight }}>
              {renderRow(item, start + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
