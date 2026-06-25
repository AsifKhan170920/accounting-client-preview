export function snapValue(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled || gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function snapPoint(
  x: number,
  y: number,
  gridSize: number,
  enabled: boolean
): { x: number; y: number } {
  return {
    x: snapValue(x, gridSize, enabled),
    y: snapValue(y, gridSize, enabled),
  };
}

export interface GuideLine {
  orientation: 'horizontal' | 'vertical';
  position: number;
}

export function computeGuides(
  moving: { left: number; top: number; width: number; height: number },
  others: Array<{ left: number; top: number; width: number; height: number }>,
  page: { width: number; height: number },
  threshold = 6
): { x: number; y: number; guides: GuideLine[] } {
  const guides: GuideLine[] = [];
  let { left, top } = moving;
  const cx = left + moving.width / 2;
  const cy = top + moving.height / 2;
  const right = left + moving.width;
  const bottom = top + moving.height;

  const xTargets = [0, page.width / 2, page.width];
  const yTargets = [0, page.height / 2, page.height];

  others.forEach((o) => {
    xTargets.push(o.left, o.left + o.width / 2, o.left + o.width);
    yTargets.push(o.top, o.top + o.height / 2, o.top + o.height);
  });

  let bestDx = threshold + 1;
  let bestDy = threshold + 1;
  let snapX = left;
  let snapY = top;

  const movingX = [left, cx, right];
  const movingY = [top, cy, bottom];

  xTargets.forEach((tx) => {
    movingX.forEach((mx, i) => {
      const d = Math.abs(mx - tx);
      if (d < bestDx && d <= threshold) {
        bestDx = d;
        snapX = left + (tx - mx);
        guides.push({ orientation: 'vertical', position: tx });
      }
    });
  });

  yTargets.forEach((ty) => {
    movingY.forEach((my, i) => {
      const d = Math.abs(my - ty);
      if (d < bestDy && d <= threshold) {
        bestDy = d;
        snapY = top + (ty - my);
        guides.push({ orientation: 'horizontal', position: ty });
      }
    });
  });

  return { x: snapX, y: snapY, guides };
}
