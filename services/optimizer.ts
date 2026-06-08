import { CutItem, StockItem, OptimizationResult, PlacedItem, UsedStock, Rect, Settings, Edges } from '../types';

// Helper to determine if a piece fits in a free rect
const fits = (pieceW: number, pieceH: number, freeRect: Rect) => {
  return pieceW <= freeRect.w && pieceH <= freeRect.h;
}

// Generate a consistent HSL color based on string
export const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Colores pasteles técnicos (Saturation baja, Lightness alta)
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 40%, 85%)`; 
};

// Main Optimization Function
export const optimizeCuts = (
  items: CutItem[],
  stocks: StockItem[],
  settings: Settings
): OptimizationResult => {

  const { bladeThickness, stockMargin, edgeThickness } = settings;

  // 1. Prepare Items
  // Expand quantities into individual items to place
  let itemsToPlace: { 
    originalId: string; 
    name: string;
    w: number; 
    h: number; 
    area: number; 
    grain: boolean; 
    edges: Edges; 
    itemRef: CutItem 
  }[] = [];

  items.forEach(item => {
    for (let i = 0; i < item.quantity; i++) {
      let cutLength = item.length;
      let cutWidth = item.width;

      // Adjust for edge banding (subtract thickness from cut size)
      if (item.edges.left) cutLength -= edgeThickness;
      if (item.edges.right) cutLength -= edgeThickness;
      if (item.edges.top) cutWidth -= edgeThickness;
      if (item.edges.bottom) cutWidth -= edgeThickness;

      // Ensure positive dimensions
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
        itemRef: item
      });
    }
  });

  // Sort items: Area Descending (Primary), Max Side Descending (Secondary)
  itemsToPlace.sort((a, b) => {
    if (b.area !== a.area) return b.area - a.area;
    return Math.max(b.w, b.h) - Math.max(a.w, a.h);
  });

  const usedStockList: UsedStock[] = [];
  const unplacedItems: { itemId: string; name: string; quantity: number }[] = [];

  // Available stock pool
  const availableStockPool: { w: number; h: number; ref: StockItem }[] = [];
  stocks.forEach(stock => {
    for (let i = 0; i < stock.quantity; i++) {
      availableStockPool.push({
        w: stock.length - (stockMargin * 2),
        h: stock.width - (stockMargin * 2),
        ref: stock
      });
    }
  });

  // Sort stock: Largest Area First
  availableStockPool.sort((a, b) => (b.w * b.h) - (a.w * a.h));

  let currentStockIndex = 0;
  let totalEdgeLength = 0;

  // Process until all items placed or no stock left
  while (itemsToPlace.length > 0 && currentStockIndex < availableStockPool.length) {
    const stock = availableStockPool[currentStockIndex];
    currentStockIndex++;

    const stockW = stock.w;
    const stockH = stock.h;

    const placedOnSheet: PlacedItem[] = [];
    // Start with one giant free rectangle representing the board
    let freeRects: Rect[] = [{ x: 0, y: 0, w: stockW, h: stockH }];
    
    const remainingItems: typeof itemsToPlace = [];

    // Attempt to place items on this sheet
    for (const item of itemsToPlace) {
      
      // Best Area Fit (BAF) Strategy
      let bestPlacement: { 
        rectIndex: number; 
        rotated: boolean; 
        scoreArea: number; 
        scoreSide: number 
      } | null = null;
      
      for (let i = 0; i < freeRects.length; i++) {
        const fr = freeRects[i];

        // 1. Check Normal Orientation
        if (fits(item.w, item.h, fr)) {
           const leftoverArea = (fr.w * fr.h) - item.area;
           const leftoverShortSide = Math.min(fr.w - item.w, fr.h - item.h);
           
           if (!bestPlacement || 
               leftoverArea < bestPlacement.scoreArea || 
               (leftoverArea === bestPlacement.scoreArea && leftoverShortSide < bestPlacement.scoreSide)) {
             
             bestPlacement = { rectIndex: i, rotated: false, scoreArea: leftoverArea, scoreSide: leftoverShortSide };
           }
        }

        // 2. Check Rotated Orientation (if allowed)
        if (!item.grain && fits(item.h, item.w, fr)) {
            const leftoverArea = (fr.w * fr.h) - item.area;
            const leftoverShortSide = Math.min(fr.w - item.h, fr.h - item.w);

            if (!bestPlacement || 
               leftoverArea < bestPlacement.scoreArea || 
               (leftoverArea === bestPlacement.scoreArea && leftoverShortSide < bestPlacement.scoreSide)) {
              
              bestPlacement = { rectIndex: i, rotated: true, scoreArea: leftoverArea, scoreSide: leftoverShortSide };
            }
        }
      }

      if (bestPlacement) {
        // Place the item
        const rect = freeRects[bestPlacement.rectIndex];
        const placedW = bestPlacement.rotated ? item.h : item.w;
        const placedH = bestPlacement.rotated ? item.w : item.h;

        placedOnSheet.push({
          x: rect.x,
          y: rect.y,
          w: placedW,
          h: placedH,
          itemId: item.originalId,
          name: item.name,
          originalLength: item.itemRef.length,
          originalWidth: item.itemRef.width,
          rotated: bestPlacement.rotated,
          edges: item.edges
        });

        // Calculate Edge Banding Usage
        if (item.edges.top === true) totalEdgeLength += item.itemRef.length;
        if (item.edges.bottom === true) totalEdgeLength += item.itemRef.length;
        if (item.edges.left === true) totalEdgeLength += item.itemRef.width;
        if (item.edges.right === true) totalEdgeLength += item.itemRef.width;

        // GUILLOTINE SPLIT LOGIC
        freeRects.splice(bestPlacement.rectIndex, 1);

        const wRemaining = rect.w - placedW;
        const hRemaining = rect.h - placedH;
        
        let newRects: Rect[] = [];
        
        const usableWR = wRemaining > bladeThickness ? wRemaining - bladeThickness : 0;
        const usableHR = hRemaining > bladeThickness ? hRemaining - bladeThickness : 0;

        // Max Area Surplus Heuristic
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
             // Tie-breaker: Short Axis Split
             splitVertically = rect.w > rect.h;
        }

        if (splitVertically) {
            // Vertical Split
            if (usableWR > 0) newRects.push({ x: rect.x + placedW + bladeThickness, y: rect.y, w: usableWR, h: rect.h });
            if (usableHR > 0) newRects.push({ x: rect.x, y: rect.y + placedH + bladeThickness, w: placedW, h: usableHR });
        } else {
            // Horizontal Split
            if (usableWR > 0) newRects.push({ x: rect.x + placedW + bladeThickness, y: rect.y, w: usableWR, h: placedH });
            if (usableHR > 0) newRects.push({ x: rect.x, y: rect.y + placedH + bladeThickness, w: rect.w, h: usableHR });
        }

        freeRects.push(...newRects);
        // Optimization: Filter tiny slivers
        freeRects = freeRects.filter(r => r.w > 1 && r.h > 1);

      } else {
        remainingItems.push(item);
      }
    }

    if (placedOnSheet.length > 0) {
      const usedItemArea = placedOnSheet.reduce((sum, i) => sum + (i.w * i.h), 0);
      const totalSheetArea = stock.ref.length * stock.ref.width;
      const wastePct = 1 - (usedItemArea / totalSheetArea);

      usedStockList.push({
        stockId: stock.ref.id,
        stockName: stock.ref.name,
        length: stock.ref.length,
        width: stock.ref.width,
        placedItems: placedOnSheet,
        waste: wastePct,
        offcuts: freeRects.filter(r => r.w > 10 && r.h > 10) 
      });
    }

    itemsToPlace = remainingItems;
  }

  // Aggregate unplaced items
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
      totalEdgeLength
    }
  };
};
