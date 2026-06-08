import { CutItem, StockItem, OptimizationResult, PlacedItem, UsedStock, Rect, Settings, Edges } from '../types';

// Helper to determine if a piece fits in a free rect
const fits = (pieceW: number, pieceH: number, freeRect: Rect) => {
  return pieceW <= freeRect.w && pieceH <= freeRect.h;
}

const colorCache = new Map<string, string>();

// Generate a consistent HSL color based on string
export const stringToColor = (str: string) => {
  const cached = colorCache.get(str);
  if (cached) return cached;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  const color = `hsl(${hue}, 40%, 85%)`;
  colorCache.set(str, color);
  return color;
};

type ItemToPlace = {
  originalId: string;
  name: string;
  w: number;
  h: number;
  area: number;
  grain: boolean;
  edges: Edges;
  itemRef: CutItem;
};

type StockSlot = { w: number; h: number; ref: StockItem };

function runPlacement(itemsToPlace: ItemToPlace[], pool: StockSlot[], bladeThickness: number) {
  const usedStockList: UsedStock[] = [];
  let currentStockIndex = 0;
  let totalEdgeLength = 0;

  while (itemsToPlace.length > 0 && currentStockIndex < pool.length) {
    const stock = pool[currentStockIndex];
    currentStockIndex++;

    const placedOnSheet: PlacedItem[] = [];
    let freeRects: Rect[] = [{ x: 0, y: 0, w: stock.w, h: stock.h }];
    const remainingItems: ItemToPlace[] = [];

    for (const item of itemsToPlace) {
      let bestPlacement: {
        rectIndex: number;
        rotated: boolean;
        scoreArea: number;
        scoreSide: number;
      } | null = null;

      for (let i = 0; i < freeRects.length; i++) {
        const fr = freeRects[i];

        if (fits(item.w, item.h, fr)) {
          const leftoverArea = (fr.w * fr.h) - item.area;
          const leftoverShortSide = Math.min(fr.w - item.w, fr.h - item.h);
          if (!bestPlacement || leftoverArea < bestPlacement.scoreArea ||
              (leftoverArea === bestPlacement.scoreArea && leftoverShortSide < bestPlacement.scoreSide)) {
            bestPlacement = { rectIndex: i, rotated: false, scoreArea: leftoverArea, scoreSide: leftoverShortSide };
          }
        }

        if (!item.grain && fits(item.h, item.w, fr)) {
          const leftoverArea = (fr.w * fr.h) - item.area;
          const leftoverShortSide = Math.min(fr.w - item.h, fr.h - item.w);
          if (!bestPlacement || leftoverArea < bestPlacement.scoreArea ||
              (leftoverArea === bestPlacement.scoreArea && leftoverShortSide < bestPlacement.scoreSide)) {
            bestPlacement = { rectIndex: i, rotated: true, scoreArea: leftoverArea, scoreSide: leftoverShortSide };
          }
        }
      }

      if (bestPlacement) {
        const rect = freeRects[bestPlacement.rectIndex];
        const placedW = bestPlacement.rotated ? item.h : item.w;
        const placedH = bestPlacement.rotated ? item.w : item.h;

        placedOnSheet.push({
          x: rect.x, y: rect.y, w: placedW, h: placedH,
          itemId: item.originalId, name: item.name,
          originalLength: item.itemRef.length, originalWidth: item.itemRef.width,
          rotated: bestPlacement.rotated, edges: item.edges,
        });

        if (item.edges.top === true) totalEdgeLength += item.itemRef.length;
        if (item.edges.bottom === true) totalEdgeLength += item.itemRef.length;
        if (item.edges.left === true) totalEdgeLength += item.itemRef.width;
        if (item.edges.right === true) totalEdgeLength += item.itemRef.width;

        freeRects.splice(bestPlacement.rectIndex, 1);

        const wRemaining = rect.w - placedW;
        const hRemaining = rect.h - placedH;
        const newRects: Rect[] = [];
        const usableWR = wRemaining > bladeThickness ? wRemaining - bladeThickness : 0;
        const usableHR = hRemaining > bladeThickness ? hRemaining - bladeThickness : 0;

        const areaVerticalRight = usableWR * rect.h;
        const areaVerticalBottom = placedW * usableHR;
        const maxAreaVertical = Math.max(areaVerticalRight, areaVerticalBottom);

        const areaHorizontalBottom = rect.w * usableHR;
        const areaHorizontalRight = usableWR * placedH;
        const maxAreaHorizontal = Math.max(areaHorizontalBottom, areaHorizontalRight);

        let splitVertically = false;
        const areaDiff = Math.abs(maxAreaVertical - maxAreaHorizontal);
        const totalPossibleArea = Math.max(maxAreaVertical, maxAreaHorizontal);

        if (totalPossibleArea > 0 && areaDiff / totalPossibleArea > 0.05) {
          splitVertically = maxAreaVertical > maxAreaHorizontal;
        } else {
          splitVertically = rect.w > rect.h;
        }

        if (splitVertically) {
          if (usableWR > 0) newRects.push({ x: rect.x + placedW + bladeThickness, y: rect.y, w: usableWR, h: rect.h });
          if (usableHR > 0) newRects.push({ x: rect.x, y: rect.y + placedH + bladeThickness, w: placedW, h: usableHR });
        } else {
          if (usableWR > 0) newRects.push({ x: rect.x + placedW + bladeThickness, y: rect.y, w: usableWR, h: placedH });
          if (usableHR > 0) newRects.push({ x: rect.x, y: rect.y + placedH + bladeThickness, w: rect.w, h: usableHR });
        }

        freeRects.push(...newRects);
        freeRects = freeRects.filter(r => r.w > bladeThickness && r.h > bladeThickness);
      } else {
        remainingItems.push(item);
      }
    }

    if (placedOnSheet.length > 0) {
      const usedItemArea = placedOnSheet.reduce((sum, i) => sum + (i.w * i.h), 0);
      const totalSheetArea = stock.ref.length * stock.ref.width;
      usedStockList.push({
        stockId: stock.ref.id,
        stockName: stock.ref.name,
        length: stock.ref.length,
        width: stock.ref.width,
        placedItems: placedOnSheet,
        waste: 1 - (usedItemArea / totalSheetArea),
        offcuts: freeRects.filter(r => r.w > bladeThickness * 4 && r.h > bladeThickness * 4),
      });
    }

    itemsToPlace = remainingItems;
  }

  const unplacedItems: { itemId: string; name: string; quantity: number }[] = [];
  itemsToPlace.forEach(i => {
    const existing = unplacedItems.find(u => u.itemId === i.originalId);
    if (existing) {
      existing.quantity++;
    } else {
      unplacedItems.push({ itemId: i.originalId, name: i.name, quantity: 1 });
    }
  });

  const totalArea = usedStockList.reduce((acc, s) => acc + (s.length * s.width), 0);
  const usedArea = usedStockList.reduce((acc, s) => acc + s.placedItems.reduce((pAcc, p) => pAcc + (p.w * p.h), 0), 0);

  return {
    usedStock: usedStockList,
    unplacedItems,
    stats: {
      totalArea,
      usedArea,
      wasteArea: totalArea - usedArea,
      efficiency: totalArea > 0 ? (usedArea / totalArea) : 0,
      totalBoards: usedStockList.length,
      totalCuts: usedStockList.reduce((acc, s) => acc + s.placedItems.length, 0),
      totalEdgeLength,
    },
  };
}

// Main Optimization Function
export const optimizeCuts = (
  items: CutItem[],
  stocks: StockItem[],
  settings: Settings
): OptimizationResult => {

  const { bladeThickness, stockMargin, edgeThickness } = settings;

  // Prepare Items
  const itemsToPlace: ItemToPlace[] = [];
  items.forEach(item => {
    for (let i = 0; i < item.quantity; i++) {
      let cutLength = item.length;
      let cutWidth = item.width;

      if (item.edges.left) cutLength -= edgeThickness;
      if (item.edges.right) cutLength -= edgeThickness;
      if (item.edges.top) cutWidth -= edgeThickness;
      if (item.edges.bottom) cutWidth -= edgeThickness;

      cutLength = Math.max(0.1, cutLength);
      cutWidth = Math.max(0.1, cutWidth);

      itemsToPlace.push({
        originalId: item.id,
        name: item.name,
        w: cutLength,
        h: cutWidth,
        area: cutLength * cutWidth,
        grain: item.grain,
        edges: item.edges,
        itemRef: item,
      });
    }
  });

  // Prepare stock pool
  const pool: StockSlot[] = [];
  stocks.forEach(stock => {
    for (let i = 0; i < stock.quantity; i++) {
      pool.push({ w: stock.length - (stockMargin * 2), h: stock.width - (stockMargin * 2), ref: stock });
    }
  });
  pool.sort((a, b) => (b.w * b.h) - (a.w * a.h));

  const sortByArea = (a: ItemToPlace, b: ItemToPlace) => {
    if (b.area !== a.area) return b.area - a.area;
    return Math.max(b.w, b.h) - Math.max(a.w, a.h);
  };
  const sortByLongestSide = (a: ItemToPlace, b: ItemToPlace) => {
    const aLong = Math.max(a.w, a.h);
    const bLong = Math.max(b.w, b.h);
    if (bLong !== aLong) return bLong - aLong;
    return b.area - a.area;
  };
  const sortByPerimeter = (a: ItemToPlace, b: ItemToPlace) => {
    const aPerim = 2 * (a.w + a.h);
    const bPerim = 2 * (b.w + b.h);
    if (bPerim !== aPerim) return bPerim - aPerim;
    return b.area - a.area;
  };

  const candidates: OptimizationResult[] = [];
  const sortOrders = settings.optimizePerformance === 'quality'
    ? [sortByArea, sortByLongestSide, sortByPerimeter]
    : [sortByArea];

  for (const sortFn of sortOrders) {
    const sorted = [...itemsToPlace].sort(sortFn);
    candidates.push(runPlacement(sorted, pool, bladeThickness));
  }

  // Pick the best result: higher efficiency, fewer boards, fewer unplaced items
  candidates.sort((a, b) => {
    const aPlaced = a.stats.totalCuts;
    const bPlaced = b.stats.totalCuts;
    const aUnplaced = a.unplacedItems.reduce((s, i) => s + i.quantity, 0);
    const bUnplaced = b.unplacedItems.reduce((s, i) => s + i.quantity, 0);
    // 1. Fewer unplaced items
    if (aUnplaced !== bUnplaced) return aUnplaced - bUnplaced;
    // 2. Higher efficiency (tighter packing)
    if (Math.abs(a.stats.efficiency - b.stats.efficiency) > 0.001) return b.stats.efficiency - a.stats.efficiency;
    // 3. Fewer boards
    return a.stats.totalBoards - b.stats.totalBoards;
  });

  return candidates[0];
};
