#!/bin/bash

echo "🚀 Terminando configuración de archivos..."

# Configurar tailwind.config.js (Sobrescribir el que se acaba de crear por defecto)
echo "⚙️ Configurando tailwind.config.js..."
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          850: '#151e2e',
          950: '#020617',
        }
      }
    },
  },
  plugins: [],
}
EOF

echo "💅 Configurando src/index.css..."
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Estilos personalizados de Scrollbar (Pro Look) */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent; 
}
::-webkit-scrollbar-thumb {
  background: #94a3b8; 
  border-radius: 4px;
}
.dark ::-webkit-scrollbar-thumb {
  background: #475569; 
}
::-webkit-scrollbar-thumb:hover {
  background: #64748b; 
}

/* Estilos de Impresión */
@media print {
  @page { margin: 0; size: landscape; }
  body { 
    background: white; 
    color: black;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  #visualizer-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
}
EOF

# CREAR CARPETAS
mkdir -p src/components
mkdir -p src/services

echo "📝 Escribiendo src/types.ts..."
cat > src/types.ts << 'EOF'
export interface Dimensions {
  width: number;
  height: number;
}

export interface Edges {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

export interface CutItem {
  id: string;
  name: string;
  length: number; // The major dimension (Largo)
  width: number;  // The minor dimension (Ancho)
  quantity: number;
  material: string;
  grain: boolean; // true = grain direction matters (cannot rotate 90 deg relative to grain)
  edges: Edges;
  color?: string; // Auto-generated color for visualization
}

export interface StockItem {
  id: string;
  name: string;
  length: number;
  width: number;
  quantity: number; // Available stock
  material: string; // Must match CutItem material
  grainDirection: 'long' | 'short' | 'none'; // usually long side
}

export interface Settings {
  units: 'mm' | 'cm' | 'inch';
  bladeThickness: number; // Kerf
  edgeThickness: number; // Thickness of the edge banding tape
  stockMargin: number; // Safety margin around the board
  optimizePerformance: 'speed' | 'quality';
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedItem extends Rect {
  itemId: string;
  name: string;
  originalWidth: number;
  originalLength: number;
  rotated: boolean;
  edges: Edges; // To visualize edge banding
}

export interface UsedStock {
  stockId: string;
  stockName: string;
  width: number;
  length: number;
  placedItems: PlacedItem[];
  waste: number; // Percentage
  offcuts: Rect[];
}

export interface OptimizationResult {
  usedStock: UsedStock[];
  unplacedItems: { itemId: string; name: string; quantity: number }[];
  stats: {
    totalArea: number;
    usedArea: number;
    wasteArea: number;
    efficiency: number;
    totalBoards: number;
    totalCuts: number;
    totalEdgeLength: number; // Linear length of edge banding used
  };
}

export interface Template {
  id: string;
  name: string;
  date: number;
  items: CutItem[];
  stock: StockItem[];
}
EOF

echo "📝 Escribiendo src/services/optimizer.ts..."
cat > src/services/optimizer.ts << 'EOF'
import { CutItem, StockItem, OptimizationResult, PlacedItem, UsedStock, Rect, Settings } from '../types';

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
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 60%, 45%)`;
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
    edges: any; 
    itemRef: CutItem 
  }[] = [];

  items.forEach(item => {
    for (let i = 0; i < item.quantity; i++) {
      let cutLength = item.length;
      let cutWidth = item.width;

      // Adjust for edge banding (subtract thickness from cut size)
      // Note: We subtract from the cut dimension because the tape adds thickness back to reach the final size.
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
  // This helps placing large/difficult items first.
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
      // We look for a free rect where the item fits, minimizing the leftover area in that specific rect.
      // Tie-breaker: Minimize the shorter side of the leftover space (Best Short Side Fit).
      
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

        // Calculate Edge Banding Usage for this item
        // CRITICAL: We use item.itemRef.length/width (Original Dimensions).
        // Even if the item is rotated on the board, the physical edge that needs tape
        // corresponds to the original dimension of that edge.
        if (item.edges.top === true) totalEdgeLength += item.itemRef.length;
        if (item.edges.bottom === true) totalEdgeLength += item.itemRef.length;
        if (item.edges.left === true) totalEdgeLength += item.itemRef.width;
        if (item.edges.right === true) totalEdgeLength += item.itemRef.width;

        // GUILLOTINE SPLIT LOGIC
        // We remove the used rectangle and add new free rectangles.
        freeRects.splice(bestPlacement.rectIndex, 1);

        const wRemaining = rect.w - placedW;
        const hRemaining = rect.h - placedH;
        
        let newRects: Rect[] = [];
        
        // REFINED STRATEGY: Maximize Primary Free Rectangle with Short Axis Tie-breaker
        // Calculate the dimensions of the potential free rectangles, accounting for blade thickness.
        // If a remaining dimension is less than blade thickness, that rect won't exist (area 0).
        
        const usableWR = wRemaining > bladeThickness ? wRemaining - bladeThickness : 0;
        const usableHR = hRemaining > bladeThickness ? hRemaining - bladeThickness : 0;

        // Scenario A: Vertical Split (Cut extends vertical line downwards)
        // New Rect 1 (Right): x = x + w + k, y = y, w = usableWR, h = rect.h
        // New Rect 2 (Bottom): x = x, y = y + h + k, w = placedW, h = usableHR
        const areaVerticalRight = usableWR * rect.h;
        const areaVerticalBottom = placedW * usableHR;
        const maxAreaVertical = Math.max(areaVerticalRight, areaVerticalBottom);

        // Scenario B: Horizontal Split (Cut extends horizontal line rightwards)
        // New Rect 1 (Bottom): x = x, y = y + h + k, w = rect.w, h = usableHR
        // New Rect 2 (Right): x = x + w + k, y = y, w = usableWR, h = placedH
        const areaHorizontalBottom = rect.w * usableHR;
        const areaHorizontalRight = usableWR * placedH;
        const maxAreaHorizontal = Math.max(areaHorizontalBottom, areaHorizontalRight);

        let splitVertically = false;

        // Decision Logic:
        // 1. Maximize the largest single free rectangle (primary metric for packing large items later).
        // 2. Tie-breaker: Minimize cut length (Short Axis Split) to keep free rectangles square.
        
        const areaDiff = Math.abs(maxAreaVertical - maxAreaHorizontal);
        const totalPossibleArea = Math.max(maxAreaVertical, maxAreaHorizontal);
        
        // If difference is significant (> 5%), choose the one with larger max area
        if (totalPossibleArea > 0 && areaDiff / totalPossibleArea > 0.05) {
             splitVertically = maxAreaVertical > maxAreaHorizontal;
        } else {
             // Tie-breaker: Short Axis Split on the Free Rectangle
             // If rect.w < rect.h (Portrait), horizontal cut is shorter (length w). Horizontal -> splitVertically = false.
             // If rect.w > rect.h (Landscape), vertical cut is shorter (length h). Vertical -> splitVertically = true.
             splitVertically = rect.w > rect.h;
        }

        if (splitVertically) {
            // Vertical Split
            if (usableWR > 0) {
                newRects.push({
                    x: rect.x + placedW + bladeThickness,
                    y: rect.y,
                    w: usableWR,
                    h: rect.h
                });
            }
            if (usableHR > 0) {
                newRects.push({
                    x: rect.x,
                    y: rect.y + placedH + bladeThickness,
                    w: placedW,
                    h: usableHR
                });
            }
        } else {
            // Horizontal Split
            if (usableWR > 0) {
                 newRects.push({
                    x: rect.x + placedW + bladeThickness,
                    y: rect.y,
                    w: usableWR,
                    h: placedH
                });
            }
            if (usableHR > 0) {
                newRects.push({
                    x: rect.x,
                    y: rect.y + placedH + bladeThickness,
                    w: rect.w,
                    h: usableHR
                });
            }
        }

        freeRects.push(...newRects);
        
        // Optimization: Filter out tiny unusable slivers to prevent array bloat
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
EOF

echo "📝 Escribiendo src/components/InputForms.tsx..."
cat > src/components/InputForms.tsx << 'EOF'
import React, { useState, useRef } from 'react';
import { Plus, Trash2, Upload, GripVertical, ChevronDown, ChevronRight, AlertCircle, X } from 'lucide-react';
import { CutItem, StockItem, Edges } from '../types';

interface InputFormsProps {
  items: CutItem[];
  setItems: React.Dispatch<React.SetStateAction<CutItem[]>>;
  stock: StockItem[];
  setStock: React.Dispatch<React.SetStateAction<StockItem[]>>;
  onImportCSV: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// Compact Edge Indicator for the Table Row
const CompactEdgeIndicator: React.FC<{ edges: Edges, onChange?: (e: Edges) => void, readonly?: boolean }> = ({ edges, onChange, readonly }) => {
  const toggle = (side: keyof Edges) => {
    if (readonly || !onChange) return;
    onChange({ ...edges, [side]: !edges[side] });
  };

  return (
    <div className="relative w-6 h-6 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-sm flex items-center justify-center shrink-0" title="Cantos (Click para editar)">
       {/* Top */}
       <div onClick={() => toggle('top')} className={`absolute top-0 left-0 right-0 h-1 cursor-pointer transition-colors ${edges.top ? 'bg-red-500' : 'hover:bg-slate-200 dark:hover:bg-slate-500'}`}></div>
       {/* Right */}
       <div onClick={() => toggle('right')} className={`absolute top-0 bottom-0 right-0 w-1 cursor-pointer transition-colors ${edges.right ? 'bg-red-500' : 'hover:bg-slate-200 dark:hover:bg-slate-500'}`}></div>
       {/* Bottom */}
       <div onClick={() => toggle('bottom')} className={`absolute bottom-0 left-0 right-0 h-1 cursor-pointer transition-colors ${edges.bottom ? 'bg-red-500' : 'hover:bg-slate-200 dark:hover:bg-slate-500'}`}></div>
       {/* Left */}
       <div onClick={() => toggle('left')} className={`absolute top-0 bottom-0 left-0 w-1 cursor-pointer transition-colors ${edges.left ? 'bg-red-500' : 'hover:bg-slate-200 dark:hover:bg-slate-500'}`}></div>
       
       <div className="w-2 h-2 rounded-full bg-slate-100 dark:bg-slate-600"></div>
    </div>
  );
};

export const InputForms: React.FC<InputFormsProps> = ({ items, setItems, stock, setStock, onImportCSV }) => {
  const [expandItems, setExpandItems] = useState(true);
  const [expandStock, setExpandStock] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'item' | 'stock' } | null>(null);

  // New Item State
  const [newItem, setNewItem] = useState<Partial<CutItem>>({
    length: 80, width: 40, quantity: 1, name: '', material: 'Melamina Blanca', grain: false, edges: { top: false, right: false, bottom: false, left: false }
  });

  const [newStock, setNewStock] = useState<Partial<StockItem>>({
    length: 275, width: 183, quantity: 10, name: 'Placa Estándar', material: 'Melamina Blanca'
  });

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Helper to update specific fields of an existing item
  const updateItem = (id: string, field: keyof CutItem, value: any) => {
      setItems(prevItems => prevItems.map(item => {
          if (item.id === id) {
              return { ...item, [field]: value };
          }
          return item;
      }));
  };

  const handleAddItem = () => {
    // Reset error
    setError(null);

    // Validation
    const length = Number(newItem.length);
    const width = Number(newItem.width);
    const qty = Number(newItem.quantity);

    if (!length || length <= 0) {
      setError("La longitud debe ser mayor a 0");
      return;
    }
    if (!width || width <= 0) {
      setError("La anchura debe ser mayor a 0");
      return;
    }
    if (!qty || qty <= 0 || !Number.isInteger(qty)) {
      setError("Cantidad inválida");
      return;
    }
    
    const id = Math.random().toString(36).substr(2, 9);
    setItems(prev => [...prev, {
      ...newItem,
      id,
      name: newItem.name || `Pieza ${prev.length + 1}`,
      length: length,
      width: width,
      quantity: qty,
      edges: newItem.edges || { top: false, right: false, bottom: false, left: false },
      grain: newItem.grain || false,
      material: newItem.material || 'Melamina Blanca'
    } as CutItem]);

    // Keep settings (Grain, Material, Edges) but clear dimensions
    setNewItem(prev => ({ 
      ...prev, 
      name: '', 
      length: 0, 
      width: 0, 
      quantity: 1 
    }));
    
    if(nameInputRef.current) nameInputRef.current.focus();
  };

  const handleAddStock = () => {
    if (!newStock.length || !newStock.width || newStock.length <= 0 || newStock.width <= 0) return;
    
    const id = Math.random().toString(36).substr(2, 9);
    setStock(prev => [...prev, {
      ...newStock,
      id,
      length: Number(newStock.length),
      width: Number(newStock.width),
      quantity: Number(newStock.quantity),
      name: newStock.name || 'Stock'
    } as StockItem]);
  };

  // --- Delete Handlers ---

  const requestDeleteItem = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget({ id, type: 'item' });
  };

  const requestDeleteStock = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget({ id, type: 'stock' });
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      if (deleteTarget.type === 'item') {
        setItems(prev => prev.filter(i => i.id !== deleteTarget.id));
      } else {
        setStock(prev => prev.filter(s => s.id !== deleteTarget.id));
      }
      setDeleteTarget(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800 text-sm select-none relative">
      
      {/* --- CUT LIST SECTION --- */}
      <div className="flex flex-col border-b border-slate-300 dark:border-slate-800 flex-grow-[2] min-h-0">
        
        {/* Accordion Header */}
        <div 
          className="bg-slate-200 dark:bg-slate-800 p-2 flex justify-between items-center cursor-pointer border-b border-slate-300 dark:border-slate-700 shadow-sm z-10"
          onClick={() => setExpandItems(!expandItems)}
        >
          <div className="flex items-center gap-2">
            <GripVertical size={14} className="text-slate-500" />
            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs uppercase">Paneles (Piezas)</span>
          </div>
          <div className="flex items-center gap-2">
             <label className="cursor-pointer text-xs text-blue-600 hover:underline flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600">
               <Upload size={10} /> CSV
               <input type="file" accept=".csv" className="hidden" onChange={onImportCSV} />
             </label>
             {expandItems ? <ChevronDown size={14} className="text-slate-500"/> : <ChevronRight size={14} className="text-slate-500"/>}
          </div>
        </div>

        {expandItems && (
          <div className="flex-1 flex flex-col min-h-0">
             
             {/* Table Header */}
             <div className="grid grid-cols-12 gap-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 font-semibold uppercase tracking-wider text-center py-2 sticky top-0 z-10 shadow-sm">
                <div className="col-span-2 border-r border-slate-100 dark:border-slate-800">Longitud</div>
                <div className="col-span-2 border-r border-slate-100 dark:border-slate-800">Anchura</div>
                <div className="col-span-1 border-r border-slate-100 dark:border-slate-800">Cant</div>
                <div className="col-span-3 border-r border-slate-100 dark:border-slate-800">Etiqueta</div>
                <div className="col-span-3 border-r border-slate-100 dark:border-slate-800">Opciones</div>
                <div className="col-span-1"></div>
             </div>

             {/* Items Container */}
             <div className="overflow-y-auto custom-scrollbar flex-1 bg-slate-50 dark:bg-black/20">
                {items.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-12 gap-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 items-center text-xs hover:bg-blue-50 dark:hover:bg-slate-800/50 group h-9">
                    
                    {/* Editable Length */}
                    <div className="col-span-2 border-r border-slate-100 dark:border-slate-800 h-full">
                        <input 
                            type="number" 
                            className="w-full h-full text-center bg-transparent focus:bg-blue-50 dark:focus:bg-slate-800 outline-none font-mono text-slate-700 dark:text-slate-300"
                            value={item.length}
                            onChange={(e) => updateItem(item.id, 'length', Math.max(0.1, parseFloat(e.target.value)))}
                        />
                    </div>
                    
                    {/* Editable Width */}
                    <div className="col-span-2 border-r border-slate-100 dark:border-slate-800 h-full">
                        <input 
                            type="number" 
                            className="w-full h-full text-center bg-transparent focus:bg-blue-50 dark:focus:bg-slate-800 outline-none font-mono text-slate-700 dark:text-slate-300"
                            value={item.width}
                            onChange={(e) => updateItem(item.id, 'width', Math.max(0.1, parseFloat(e.target.value)))}
                        />
                    </div>

                    {/* Editable Quantity */}
                    <div className="col-span-1 border-r border-slate-100 dark:border-slate-800 h-full">
                        <input 
                            type="number" 
                            className="w-full h-full text-center bg-transparent focus:bg-blue-50 dark:focus:bg-slate-800 outline-none font-bold"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        />
                    </div>

                    {/* Editable Name */}
                    <div className="col-span-3 border-r border-slate-100 dark:border-slate-800 h-full">
                        <input 
                            type="text" 
                            className="w-full h-full px-2 text-left bg-transparent focus:bg-blue-50 dark:focus:bg-slate-800 outline-none truncate text-slate-600 dark:text-slate-400"
                            value={item.name}
                            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                        />
                    </div>

                    <div className="col-span-3 flex justify-center items-center gap-2 border-r border-slate-100 dark:border-slate-800 h-full">
                       {/* Grain Toggle */}
                       <button 
                         type="button"
                         onClick={() => updateItem(item.id, 'grain', !item.grain)}
                         className={`text-[10px] font-bold px-1 py-0.5 rounded border transition-colors ${item.grain ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-400 border-slate-200 opacity-50 hover:opacity-100'}`}
                         title="Toggle Veta"
                       >
                         VETA
                       </button>
                       {/* Edge Widget - Editable */}
                       <CompactEdgeIndicator 
                            edges={item.edges} 
                            onChange={(newEdges) => updateItem(item.id, 'edges', newEdges)} 
                       />
                    </div>
                    <div className="col-span-1 flex justify-center">
                       <button 
                         type="button" 
                         onClick={(e) => requestDeleteItem(item.id, e)} 
                         className="text-slate-300 hover:text-red-500 transition-colors p-1"
                       >
                         <Trash2 size={12} className="pointer-events-none" />
                       </button>
                    </div>
                  </div>
                ))}
             </div>

             {/* Error Message */}
             {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs px-2 py-1 flex items-center gap-2 border-t border-red-100 dark:border-red-900/30">
                  <AlertCircle size={12} />
                  {error}
                </div>
             )}

             {/* Add Item Row (Sticky Bottom) */}
             <div className="grid grid-cols-12 gap-1 p-1 bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 shadow-inner">
                <div className="col-span-2">
                   <input type="number" placeholder="L" className={`w-full h-7 px-1 text-xs text-center border rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 ${error && (!newItem.length || newItem.length <= 0) ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-300'}`}
                    value={newItem.length || ''} onChange={e => setNewItem({...newItem, length: parseFloat(e.target.value)})}
                    onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                   />
                </div>
                <div className="col-span-2">
                   <input type="number" placeholder="A" className={`w-full h-7 px-1 text-xs text-center border rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 ${error && (!newItem.width || newItem.width <= 0) ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-300'}`}
                    value={newItem.width || ''} onChange={e => setNewItem({...newItem, width: parseFloat(e.target.value)})}
                    onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                   />
                </div>
                <div className="col-span-1">
                   <input type="number" placeholder="#" className="w-full h-7 px-1 text-xs text-center border border-slate-300 rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600" 
                    value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: parseFloat(e.target.value)})}
                    onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                   />
                </div>
                <div className="col-span-3">
                   <input 
                     ref={nameInputRef}
                     type="text" placeholder="Etiqueta" className="w-full h-7 px-1 text-xs border border-slate-300 rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600" 
                     value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})}
                     onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                   />
                </div>
                <div className="col-span-3 flex items-center justify-center gap-1">
                   {/* Grain Toggle */}
                   <button 
                     type="button"
                     onClick={() => setNewItem({...newItem, grain: !newItem.grain})}
                     className={`h-7 px-2 flex items-center justify-center border rounded text-[10px] font-bold transition-colors ${newItem.grain ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-slate-300 text-slate-300 dark:bg-slate-700 dark:border-slate-600'}`}
                     title="Respetar Veta"
                   >
                     VETA
                   </button>
                   {/* Edge Widget */}
                   <CompactEdgeIndicator edges={newItem.edges!} onChange={(e) => setNewItem({...newItem, edges: e})} />
                </div>
                <div className="col-span-1">
                  <button onClick={handleAddItem} className="w-full h-7 bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center justify-center">
                    <Plus size={16} />
                  </button>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* --- STOCK SECTION --- */}
      <div className="flex flex-col flex-grow-[1] min-h-0">
        <div 
          className="bg-slate-200 dark:bg-slate-800 p-2 flex justify-between items-center cursor-pointer border-b border-t border-slate-300 dark:border-slate-700 shadow-sm"
          onClick={() => setExpandStock(!expandStock)}
        >
          <div className="flex items-center gap-2">
            <GripVertical size={14} className="text-slate-500" />
            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs uppercase">Hojas en inventario (Stock)</span>
          </div>
          {expandStock ? <ChevronDown size={14} className="text-slate-500"/> : <ChevronRight size={14} className="text-slate-500"/>}
        </div>

        {expandStock && (
          <div className="flex-1 flex flex-col min-h-0">
             {/* Table Header */}
             <div className="grid grid-cols-12 gap-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 font-semibold uppercase tracking-wider text-center py-2 sticky top-0">
                <div className="col-span-3 border-r border-slate-100 dark:border-slate-800">Longitud</div>
                <div className="col-span-3 border-r border-slate-100 dark:border-slate-800">Anchura</div>
                <div className="col-span-2 border-r border-slate-100 dark:border-slate-800">Cant</div>
                <div className="col-span-3 border-r border-slate-100 dark:border-slate-800">Nombre</div>
                <div className="col-span-1"></div>
             </div>

             <div className="overflow-y-auto custom-scrollbar flex-1 bg-slate-50 dark:bg-black/20">
                {stock.map(s => (
                  <div key={s.id} className="grid grid-cols-12 gap-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 items-center text-xs hover:bg-slate-50 dark:hover:bg-slate-800 h-8">
                    <div className="col-span-3 text-center border-r border-slate-100 dark:border-slate-800 font-mono text-slate-700 dark:text-slate-300">{s.length}</div>
                    <div className="col-span-3 text-center border-r border-slate-100 dark:border-slate-800 font-mono text-slate-700 dark:text-slate-300">{s.width}</div>
                    <div className="col-span-2 text-center border-r border-slate-100 dark:border-slate-800">{s.quantity}</div>
                    <div className="col-span-3 pl-2 truncate border-r border-slate-100 dark:border-slate-800 text-slate-500">{s.name}</div>
                    <div className="col-span-1 flex justify-center">
                       <button onClick={(e) => requestDeleteStock(s.id, e)} className="text-slate-300 hover:text-red-500 transition-colors">
                         <Trash2 size={12} className="pointer-events-none" />
                       </button>
                    </div>
                  </div>
                ))}
             </div>

             {/* Add Stock Row */}
             <div className="grid grid-cols-12 gap-1 p-1 bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 shadow-inner">
                <div className="col-span-3">
                   <input type="number" placeholder="L" className="w-full h-7 px-1 text-xs text-center border border-slate-300 rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600" 
                    value={newStock.length} onChange={e => setNewStock({...newStock, length: parseFloat(e.target.value)})}
                   />
                </div>
                <div className="col-span-3">
                   <input type="number" placeholder="A" className="w-full h-7 px-1 text-xs text-center border border-slate-300 rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600" 
                    value={newStock.width} onChange={e => setNewStock({...newStock, width: parseFloat(e.target.value)})}
                   />
                </div>
                <div className="col-span-2">
                   <input type="number" placeholder="#" className="w-full h-7 px-1 text-xs text-center border border-slate-300 rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600" 
                     value={newStock.quantity} onChange={e => setNewStock({...newStock, quantity: parseFloat(e.target.value)})}
                   />
                </div>
                <div className="col-span-3">
                   <input type="text" placeholder="Ref" className="w-full h-7 px-1 text-xs border border-slate-300 rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600" 
                    value={newStock.name} onChange={e => setNewStock({...newStock, name: e.target.value})}
                   />
                </div>
                <div className="col-span-1">
                   <button onClick={handleAddStock} className="w-full h-7 bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center justify-center">
                    <Plus size={16} />
                   </button>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-sm p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
             <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
               <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                 <Trash2 size={24} />
               </div>
               <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Confirmar eliminación</h3>
             </div>
             <p className="text-slate-600 dark:text-slate-400 text-sm">
               ¿Desea borrar estas piezas? Esta acción no se puede deshacer.
             </p>
             <div className="flex justify-end gap-3 mt-2">
               <button 
                 onClick={() => setDeleteTarget(null)}
                 className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
               >
                 Cancelar
               </button>
               <button 
                 onClick={confirmDelete}
                 className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors shadow-sm"
               >
                 Borrar
               </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};
EOF

echo "📝 Escribiendo src/components/Visualizer.tsx..."
cat > src/components/Visualizer.tsx << 'EOF'
import React, { useState, useRef, useEffect, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import { UsedStock, PlacedItem, Settings } from '../types';
import { stringToColor } from '../services/optimizer';
import { ZoomIn, ZoomOut, Printer, RotateCw, LayoutGrid, List, FileText, Maximize } from 'lucide-react';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import html2canvas from 'html2canvas';

interface VisualizerProps {
  usedStock: UsedStock[];
  settings: Settings;
  boardOrientation?: 'horizontal' | 'vertical';
}

export interface VisualizerHandle {
  handleDownloadPDF: () => void;
}

export const Visualizer = forwardRef<VisualizerHandle, VisualizerProps>(({ usedStock, settings, boardOrientation = 'horizontal' }, ref) => {
  const [zoom, setZoom] = useState(1.0); 
  const [isRotated, setIsRotated] = useState(boardOrientation === 'vertical');
  const [viewMode, setViewMode] = useState<'column' | 'grid'>('column');
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync with global orientation preference
  useEffect(() => {
    setIsRotated(boardOrientation === 'vertical');
  }, [boardOrientation]);

  // Expose function to parent
  useImperativeHandle(ref, () => ({
    handleDownloadPDF
  }));

  // AUTO-FIT LOGIC
  const handleAutoFit = () => {
    if (!containerRef.current || usedStock.length === 0) return;
    const parent = containerRef.current.parentElement;
    if (!parent) return;

    // Get available viewport size (minus padding)
    const availableWidth = parent.clientWidth - 80;
    const availableHeight = parent.clientHeight - 80;

    if (availableWidth <= 0 || availableHeight <= 0) return;

    // Find dimensions of the largest board to fit nicely
    let maxW = 0;
    let maxH = 0;

    usedStock.forEach(board => {
        const w = isRotated ? board.width : board.length;
        const h = isRotated ? board.length : board.width;
        maxW = Math.max(maxW, w);
        maxH = Math.max(maxH, h);
    });

    // Add margin for rulers (approx 50 units)
    const targetW = maxW + 50;
    const targetH = maxH + 50;

    // Calculate scale factors
    const scaleX = availableWidth / targetW;
    const scaleY = availableHeight / targetH;
    
    // Choose the scale that fits best
    let optimalZoom = Math.min(scaleX, scaleY);

    // In column mode, we prioritize fitting width as scrolling down is natural
    if (viewMode === 'column') {
        optimalZoom = scaleX;
    }

    // Clamp zoom to reasonable limits
    optimalZoom = Math.min(Math.max(optimalZoom, 0.5), 6.0);
    
    // Apply with a slight safety margin
    setZoom(optimalZoom * 0.95);
  };

  // Trigger auto-fit when data or layout changes
  useLayoutEffect(() => {
    handleAutoFit();
  }, [usedStock, isRotated, viewMode, boardOrientation]);

  const handleDownloadPDF = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    
    const previousZoom = zoom;
    // Set fixed zoom for consistent PDF output
    setZoom(1.5);
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const element = containerRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff',
        ignoreElements: (el: Element) => el.classList.contains('no-print')
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      let finalW = pageWidth;
      let finalH = (imgHeight * pageWidth) / imgWidth;

      if (finalH > pageHeight) {
        finalH = pageHeight;
        finalW = (imgWidth * pageHeight) / imgHeight;
      }
      
      pdf.addImage(imgData, 'PNG', 0, 0, finalW, finalH);
      pdf.save('tonycut-optimizacion.pdf');
    } catch (err) {
      console.error("Error generating PDF", err);
      alert("Error al generar PDF");
    } finally {
      setZoom(previousZoom);
      setIsExporting(false);
    }
  };

  if (usedStock.length === 0) return null;

  return (
    <div className="h-full flex flex-col relative bg-slate-200/50 dark:bg-black/20">
      
      {/* Toolbar - Floating */}
      <div className="absolute top-4 right-4 flex gap-2 z-20 no-print flex-wrap justify-end pl-4 pointer-events-auto">
        
        {/* Layout Controls */}
        <div className="flex gap-1 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded p-0.5 mr-2">
           <button 
             onClick={() => setViewMode('column')} 
             className={`p-1.5 rounded ${viewMode === 'column' ? 'bg-slate-200 dark:bg-slate-700 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
             title="Vista Vertical (Lista)"
           >
             <List size={16} />
           </button>
           <button 
             onClick={() => setViewMode('grid')} 
             className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-200 dark:bg-slate-700 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
             title="Vista Horizontal (Grilla)"
           >
             <LayoutGrid size={16} />
           </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex gap-0 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded overflow-hidden">
          <button onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-r dark:border-slate-700" title="Alejar">
             <ZoomOut size={16} />
          </button>
          <span className="px-2 min-w-[3rem] text-center text-xs font-mono flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 text-slate-500">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom(z => Math.min(8, z + 0.2))} className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-l dark:border-slate-700" title="Acercar">
             <ZoomIn size={16} />
          </button>
        </div>
        
        <button 
           onClick={handleAutoFit}
           className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded hover:bg-slate-50 text-slate-600 dark:text-slate-300 ml-1" 
           title="Ajustar a Pantalla"
        >
           <Maximize size={16} />
        </button>
        
        <button 
           onClick={handleDownloadPDF} 
           disabled={isExporting}
           className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded hover:bg-slate-50 text-slate-600 dark:text-slate-300 ml-2 disabled:opacity-50" 
           title="Guardar como PDF"
        >
           {isExporting ? <span className="animate-spin text-xs">...</span> : <FileText size={16} />}
        </button>

        <button onClick={() => window.print()} className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded hover:bg-slate-50 text-slate-600 dark:text-slate-300 ml-1" title="Imprimir">
           <Printer size={16} />
        </button>
      </div>

      {/* Scrollable Canvas Area */}
      <div className="flex-grow overflow-auto p-8 custom-scrollbar bg-slate-200/50 dark:bg-black/20">
        <div 
          id="visualizer-container" 
          ref={containerRef}
          className={`flex gap-16 items-start origin-top-left transition-all duration-300 ${viewMode === 'column' ? 'flex-col items-center' : 'flex-row flex-wrap justify-center'} bg-slate-200/50 dark:bg-black/0 p-4`} 
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', width: 'fit-content', minWidth: '100%' }}
        >
          
          {usedStock.map((board, index) => {
            const displayWidth = isRotated ? board.width : board.length;
            const displayHeight = isRotated ? board.length : board.width;
            
            const offsetX = 30; 
            const offsetY = 30;

            const transform = isRotated ? `translate(${board.width}, 0) rotate(90)` : undefined;

            return (
              <div key={index} className="relative group">
                {/* Header Info */}
                <div className="absolute -top-8 left-0 text-sm font-bold text-slate-500 whitespace-nowrap bg-slate-200/80 px-3 py-1 rounded shadow-sm">
                  {board.stockName} <span className="font-normal opacity-70">#{index + 1}</span>
                </div>

                {/* SVG Container */}
                <div className="bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] print:shadow-none print:border print:border-black transition-all duration-300">
                  <svg
                    width={displayWidth + offsetX} 
                    height={displayHeight + offsetY}
                    viewBox={`-${offsetX} -${offsetY} ${displayWidth + offsetX} ${displayHeight + offsetY}`}
                    className="overflow-visible"
                    style={{ shapeRendering: 'geometricPrecision' }}
                  >
                     {/* Outer Rulers (Dimension Lines) */}
                     <g className="opacity-60">
                        {/* Top Ruler (Width) */}
                        <line x1="0" y1="-10" x2={displayWidth} y2="-10" stroke="#64748b" strokeWidth="1" />
                        <line x1="0" y1="-5" x2="0" y2="-15" stroke="#64748b" strokeWidth="1" />
                        <line x1={displayWidth} y1="-5" x2={displayWidth} y2="-15" stroke="#64748b" strokeWidth="1" />
                        <text x={displayWidth / 2} y="-15" textAnchor="middle" fontSize="12" fill="#475569" fontWeight="bold">{displayWidth}</text>

                        {/* Left Ruler (Height) */}
                        <line x1="-10" y1="0" x2="-10" y2={displayHeight} stroke="#64748b" strokeWidth="1" />
                        <line x1="-5" y1="0" x2="-15" y2="0" stroke="#64748b" strokeWidth="1" />
                        <line x1="-5" y1={displayHeight} x2="-15" y2={displayHeight} stroke="#64748b" strokeWidth="1" />
                        <text x="-15" y={displayHeight / 2} textAnchor="middle" fontSize="12" fill="#475569" fontWeight="bold" transform={`rotate(-90, -15, ${displayHeight / 2})`}>{displayHeight}</text>
                     </g>

                    <g transform={transform}>
                      {/* Board Background */}
                      <rect x="0" y="0" width={board.length} height={board.width} fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />

                      {/* Margins */}
                      {settings.stockMargin > 0 && (
                        <rect 
                          x={settings.stockMargin} 
                          y={settings.stockMargin} 
                          width={board.length - settings.stockMargin * 2} 
                          height={board.width - settings.stockMargin * 2} 
                          fill="none" 
                          stroke="#e2e8f0" 
                          strokeWidth="0.5" 
                          strokeDasharray="4 2"
                        />
                      )}

                      {/* Placed Items */}
                      {board.placedItems.map((item, i) => {
                        const baseColor = stringToColor(item.name);
                        const minDim = Math.min(item.w, item.h);
                        // Refined font scaling: visible but not explosive on large items
                        const fontSize = Math.max(10, Math.min(minDim / 3, 24)); 
                        
                        // Dimensions to show
                        const dimH = Math.round(item.w); // Visual horizontal dim
                        const dimV = Math.round(item.h); // Visual vertical dim

                        return (
                          <g key={i}>
                            <rect
                              x={item.x}
                              y={item.y}
                              width={item.w}
                              height={item.h}
                              fill={baseColor}
                              fillOpacity="0.35"
                              stroke="#334155"
                              strokeWidth="0.75"
                            />
                            
                            {/* Edge Banding - Bold Lines */}
                            {!item.rotated && (
                              <>
                                {item.edges.top && <line x1={item.x} y1={item.y} x2={item.x + item.w} y2={item.y} stroke="#ef4444" strokeWidth="3" />}
                                {item.edges.bottom && <line x1={item.x} y1={item.y + item.h} x2={item.x + item.w} y2={item.y + item.h} stroke="#ef4444" strokeWidth="3" />}
                                {item.edges.left && <line x1={item.x} y1={item.y} x2={item.x} y2={item.y + item.h} stroke="#ef4444" strokeWidth="3" />}
                                {item.edges.right && <line x1={item.x + item.w} y1={item.y} x2={item.x + item.w} y2={item.y + item.h} stroke="#ef4444" strokeWidth="3" />}
                              </>
                            )}
                            {item.rotated && (
                              <>
                                {item.edges.top && <line x1={item.x + item.w} y1={item.y} x2={item.x + item.w} y2={item.y + item.h} stroke="#ef4444" strokeWidth="3" />}
                                {item.edges.bottom && <line x1={item.x} y1={item.y} x2={item.x} y2={item.y + item.h} stroke="#ef4444" strokeWidth="3" />}
                                {item.edges.left && <line x1={item.x} y1={item.y} x2={item.x + item.w} y2={item.y} stroke="#ef4444" strokeWidth="3" />}
                                {item.edges.right && <line x1={item.x} y1={item.y + item.h} x2={item.x + item.w} y2={item.y + item.h} stroke="#ef4444" strokeWidth="3" />}
                              </>
                            )}

                            {/* LABELS & DIMENSIONS */}
                            {item.w > 15 && item.h > 15 && (
                              <g style={{pointerEvents: 'none'}}>
                                {/* Center Name */}
                                <text 
                                    x={item.x + item.w / 2} 
                                    y={item.y + item.h / 2 - (fontSize * 0.4)} 
                                    textAnchor="middle" 
                                    dominantBaseline="middle" 
                                    fill="#1e293b"
                                    fontSize={fontSize}
                                    fontWeight="bold"
                                    style={{ opacity: 0.9 }}
                                >
                                    {item.name}
                                </text>

                                {/* Dimensions text (similar to offcuts) */}
                                <text 
                                    x={item.x + item.w / 2} 
                                    y={item.y + item.h / 2 + (fontSize * 0.7)} 
                                    textAnchor="middle" 
                                    dominantBaseline="middle" 
                                    fill="#1e293b"
                                    fontSize={fontSize * 0.8}
                                    fontWeight="normal"
                                    style={{ opacity: 0.8 }}
                                >
                                    {dimH} x {dimV}
                                </text>

                                {/* Perimetric Technical Dimensions (Still keeping these as they are useful for cuts) */}
                                {/* Horizontal Dimension (Top Edge) */}
                                {item.h > 40 && (
                                    <text 
                                        x={item.x + item.w / 2} 
                                        y={item.y + 4} 
                                        textAnchor="middle" 
                                        dominantBaseline="hanging" 
                                        fill="#64748b"
                                        fontSize={fontSize * 0.6}
                                        fontWeight="normal"
                                    >
                                        {dimH}
                                    </text>
                                )}

                                {/* Vertical Dimension (Left Edge, Rotated) */}
                                {item.w > 40 && (
                                    <text 
                                        x={item.x + 4} 
                                        y={item.y + item.h / 2} 
                                        textAnchor="middle" 
                                        dominantBaseline="auto" 
                                        fill="#64748b"
                                        fontSize={fontSize * 0.6}
                                        fontWeight="normal"
                                        transform={`rotate(-90, ${item.x + 4}, ${item.y + item.h / 2})`}
                                    >
                                        {dimV}
                                    </text>
                                )}
                                
                                {item.rotated && (
                                    <text x={item.x + item.w - 5} y={item.y + 10} fontSize="10" fill="#64748b">↻</text>
                                )}
                              </g>
                            )}
                          </g>
                        );
                      })}

                      {/* Offcuts */}
                      {board.offcuts.map((off, k) => {
                         const offMin = Math.min(off.w, off.h);
                         const offFont = Math.max(8, Math.min(offMin / 4, 16));
                         return (
                        <g key={`off-${k}`}>
                          <rect 
                            x={off.x} y={off.y} width={off.w} height={off.h} 
                            fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.5" 
                          />
                           {off.w > 15 && off.h > 10 && (
                             <text x={off.x + off.w/2} y={off.y + off.h/2} textAnchor="middle" dominantBaseline="middle" fontSize={offFont} fill="#94a3b8" style={{userSelect: 'none'}}>
                               {Math.round(off.w)} x {Math.round(off.h)}
                             </text>
                           )}
                        </g>
                      )})}
                    </g>
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
Visualizer.displayName = 'Visualizer';
EOF

echo "📝 Escribiendo src/App.tsx..."
cat > src/App.tsx << 'EOF'
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings as SettingsIcon, Layout, Save, Moon, Sun, Download, RefreshCcw, Calculator, Menu, FilePlus, FolderOpen, ChevronDown, ChevronRight, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, Trash2, AlertTriangle, FileUp, FileDown, LayoutTemplate, Printer } from 'lucide-react';
import { CutItem, StockItem, Settings, OptimizationResult, Template } from './types';
import { optimizeCuts } from './services/optimizer';
import { InputForms } from './components/InputForms';
import { Visualizer, VisualizerHandle } from './components/Visualizer';

// Default Data
const defaultItems: CutItem[] = [
  { id: '1', name: 'Puerta', length: 120, width: 60, quantity: 2, material: 'Melamina Blanca', grain: true, edges: {top:true, bottom:true, left:true, right:true} },
  { id: '2', name: 'Estante', length: 58, width: 30, quantity: 4, material: 'Melamina Blanca', grain: false, edges: {top:true, bottom:false, left:false, right:false} },
  { id: '3', name: 'Lateral', length: 200, width: 60, quantity: 2, material: 'Melamina Blanca', grain: true, edges: {top:false, bottom:true, left:false, right:false} }
];

const defaultStock: StockItem[] = [
  { id: 's1', name: 'Tablero 1', length: 275, width: 183, quantity: 5, material: 'Melamina Blanca', grainDirection: 'long' }
];

const defaultSettings: Settings = {
  units: 'cm',
  bladeThickness: 0.4,
  edgeThickness: 0.1, // 1mm
  stockMargin: 1.0,
  optimizePerformance: 'quality'
};

const App: React.FC = () => {
  const [items, setItems] = useState<CutItem[]>(defaultItems);
  const [stock, setStock] = useState<StockItem[]>(defaultStock);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  
  // Modals State
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showConfirmNew, setShowConfirmNew] = useState(false); // Modal state for "New Project"
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false); // File dropdown state
  
  // UI State for Accordions
  const [expandStats, setExpandStats] = useState(true);
  const [expandCuts, setExpandCuts] = useState(true);
  
  // Templates State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);

  // References
  const fileInputRef = useRef<HTMLInputElement>(null); // For loading JSON projects
  const menuRef = useRef<HTMLDivElement>(null); // To close menu on click outside
  const visualizerRef = useRef<VisualizerHandle>(null); // Ref to Visualizer for PDF export

  // Load from local storage on mount
  useEffect(() => {
    // Load App Data
    const savedData = localStorage.getItem('tonycut_data');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        if (data.items) setItems(data.items);
        if (data.stock) setStock(data.stock);
        if (data.settings) setSettings(data.settings);
        if (data.darkMode !== undefined) setDarkMode(data.darkMode);
      } catch (e) {
        console.error("Failed to load saved data");
      }
    }

    // Load Templates
    const savedTemplates = localStorage.getItem('tonycut_templates');
    if (savedTemplates) {
      try {
        setTemplates(JSON.parse(savedTemplates));
      } catch (e) {
        console.error("Failed to load templates");
      }
    }

    // Click outside to close menu
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsFileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save to local storage (Data & Settings)
  useEffect(() => {
    localStorage.setItem('tonycut_data', JSON.stringify({ items, stock, settings, darkMode }));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [items, stock, settings, darkMode]);

  // Save Templates to local storage
  useEffect(() => {
    localStorage.setItem('tonycut_templates', JSON.stringify(templates));
  }, [templates]);

  // --- OPTIMIZATION LOGIC ---
  
  const handleOptimize = useCallback(() => {
    setIsOptimizing(true);
    // Small timeout to allow UI to show "Processing" state if dataset is large
    setTimeout(() => {
       const res = optimizeCuts(items, stock, settings);
       setResult(res);
       setIsOptimizing(false);
    }, 100);
  }, [items, stock, settings]);

  // --- ACTIONS ---

  const handleConfirmNewProject = () => {
      setItems([]);
      setStock(defaultStock);
      setResult(null);
      setShowConfirmNew(false);
  };

  const handleSaveProjectJSON = () => {
    const data = {
        items,
        stock,
        settings,
        darkMode,
        timestamp: Date.now()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tonycut-project-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsFileMenuOpen(false);
  };

  const handleLoadProjectJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const data = JSON.parse(evt.target?.result as string);
            if (data.items) setItems(data.items);
            if (data.stock) setStock(data.stock);
            if (data.settings) setSettings(data.settings);
            if (data.darkMode !== undefined) setDarkMode(data.darkMode);
            setResult(null); // Clear result
        } catch (err) {
            alert("Error al leer el archivo del proyecto");
        }
    };
    reader.readAsText(file);
    setIsFileMenuOpen(false);
    if(fileInputRef.current) fileInputRef.current.value = ''; // Reset input
  };

  const triggerPDFExport = () => {
    if (visualizerRef.current) {
      visualizerRef.current.handleDownloadPDF();
      setIsFileMenuOpen(false);
    } else {
      alert("No hay nada que exportar. Realiza un cálculo primero.");
    }
  };

  // --- TEMPLATE LOGIC ---

  const handleSaveTemplate = () => {
    if (!newTemplateName.trim()) return;
    const newTemplate: Template = {
      id: Date.now().toString(),
      name: newTemplateName,
      date: Date.now(),
      items: [...items],
      stock: [...stock]
    };
    setTemplates(prev => [newTemplate, ...prev]);
    setNewTemplateName('');
  };

  const handleLoadTemplate = (t: Template) => {
    // We can use the custom confirm for this too, but for now let's use the native for template specific actions or implement another modal.
    // To keep it consistent with "No native alerts", let's just do it directly for now or wrap in a small confirm if desired.
    // For simplicity in this step, I'll update to use a custom check in future, but standard react pattern:
    setItems(t.items);
    setStock(t.stock);
    setShowTemplates(false);
    setResult(null); 
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  // CSV Import (Keep existing logic for CSV specific import)
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n');
      const newItems: CutItem[] = [];
      lines.forEach((line, i) => {
        if (i === 0) return; // Header
        const cols = line.split(',');
        if (cols.length >= 3) {
          newItems.push({
            id: Math.random().toString(36),
            name: cols[0] || 'Pieza',
            length: parseFloat(cols[1]) || 0,
            width: parseFloat(cols[2]) || 0,
            quantity: parseInt(cols[3]) || 1,
            material: 'Importado',
            grain: false,
            edges: {top:false, right:false, bottom:false, left:false}
          });
        }
      });
      setItems(prev => [...prev, ...newItems]);
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      
      {/* Header / Navbar - Dark Theme like reference */}
      <nav className="h-12 bg-slate-800 dark:bg-slate-950 border-b border-slate-700 flex items-center justify-between px-4 shrink-0 shadow-md z-30 text-slate-100">
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 mr-2">
             <Layout size={20} className="text-blue-400" />
             <h1 className="font-bold text-lg tracking-tight">TonyCut <span className="text-[10px] font-normal opacity-70">Optimizer</span></h1>
           </div>
           
           <div className="h-6 w-px bg-slate-600 mx-2"></div>

           {/* --- FILE MENU DROPDOWN --- */}
           <div className="relative" ref={menuRef}>
             <button 
               onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
               className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors border border-transparent ${isFileMenuOpen ? 'bg-slate-700 border-slate-600' : 'hover:bg-slate-700 hover:border-slate-600'}`}
             >
               <Menu size={14} />
               <span>Archivo</span>
               <ChevronDown size={12} className="opacity-70" />
             </button>

             {/* Dropdown Content */}
             {isFileMenuOpen && (
               <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                 
                 <button 
                    onClick={() => { setShowConfirmNew(true); setIsFileMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs flex items-center gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                 >
                   <FilePlus size={14} className="text-blue-500"/>
                   Nuevo Proyecto
                 </button>
                 
                 <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>

                 <button 
                    onClick={() => { fileInputRef.current?.click(); setIsFileMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs flex items-center gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                 >
                   <FileUp size={14} className="text-amber-500"/>
                   Abrir Proyecto (.json)
                 </button>
                 
                 <button 
                    onClick={handleSaveProjectJSON}
                    className="w-full text-left px-4 py-2 text-xs flex items-center gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                 >
                   <FileDown size={14} className="text-emerald-500"/>
                   Guardar Proyecto (.json)
                 </button>

                 <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                 
                 <button 
                    onClick={triggerPDFExport}
                    className="w-full text-left px-4 py-2 text-xs flex items-center gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                 >
                   <Printer size={14} className="text-red-500"/>
                   Exportar a PDF
                 </button>
                 
                 <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>

                 <button 
                    onClick={() => { setShowTemplates(true); setIsFileMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs flex items-center gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                 >
                   <LayoutTemplate size={14} className="text-purple-500"/>
                   Gestor de Plantillas
                 </button>
               </div>
             )}
           </div>
           
           {/* Hidden File Input for JSON Load */}
           <input 
             type="file" 
             ref={fileInputRef} 
             hidden 
             accept=".json" 
             onChange={handleLoadProjectJSON} 
           />

           {/* Settings Button (Outside menu for quick access) */}
           <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-2 px-3 py-1 hover:bg-slate-700 rounded text-xs font-medium transition-colors border border-transparent hover:border-slate-600 text-slate-300 hover:text-white">
               <SettingsIcon size={14} />
               <span>Configurar</span>
           </button>

        </div>
        
        <div className="flex items-center gap-3">
           {/* Optimize Button - Prominent */}
           <button 
             onClick={handleOptimize} 
             disabled={isOptimizing}
             className="flex items-center gap-2 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-6 py-1 rounded shadow border border-blue-800 font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
           >
             {isOptimizing ? <RefreshCcw className="animate-spin" size={16}/> : <Calculator size={16} fill="currentColor" className="opacity-80"/>}
             <span>Calcular</span>
           </button>

           <div className="flex bg-slate-700 rounded p-0.5 border border-slate-600">
              <button 
                onClick={() => setBoardOrientation('horizontal')}
                className={`p-1 rounded transition-colors ${boardOrientation === 'horizontal' ? 'bg-slate-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                title="Vista Horizontal"
              >
                <AlignHorizontalJustifyCenter size={16} />
              </button>
              <button 
                onClick={() => setBoardOrientation('vertical')}
                className={`p-1 rounded transition-colors ${boardOrientation === 'vertical' ? 'bg-slate-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                title="Vista Vertical"
              >
                 <AlignVerticalJustifyCenter size={16} />
              </button>
           </div>
           
           <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors" title="Modo Oscuro">
             {darkMode ? <Sun size={16} /> : <Moon size={16} />}
           </button>
        </div>
      </nav>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Sidebar (Input) */}
        <div className="w-[450px] shrink-0 h-full border-r border-slate-300 dark:border-slate-800 flex flex-col z-20 shadow-xl bg-white dark:bg-slate-900">
           <InputForms 
             items={items} setItems={setItems} 
             stock={stock} setStock={setStock} 
             onImportCSV={handleCSVImport}
           />
        </div>

        {/* Center (Visualizer) */}
        <div className="flex-1 h-full relative z-0 bg-slate-200/50 dark:bg-black/20 flex flex-col">
           {/* Visualizer Header/Breadcrumb */}
           <div className="h-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center text-xs text-slate-500">
              <span>Proyecto actual</span>
              <ChevronRight size={12} className="mx-2"/>
              <span className="font-semibold text-slate-800 dark:text-slate-200">Visualización</span>
           </div>

           <div className="flex-1 relative overflow-hidden">
            {result ? (
                <Visualizer ref={visualizerRef} usedStock={result.usedStock} settings={settings} boardOrientation={boardOrientation} />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                    <div className="w-24 h-24 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center">
                         <LayoutTemplate size={40} className="opacity-20" />
                    </div>
                    <p className="text-sm">Configura tus paneles a la izquierda y presiona <strong className="text-blue-600 font-bold">Calcular</strong></p>
                </div>
            )}
           </div>
        </div>

        {/* Right Sidebar (Stats & Info) */}
        <div className="w-[320px] shrink-0 h-full border-l border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-y-auto no-print">
          
          {/* Panel: Global Stats */}
          <div className="border-b border-slate-200 dark:border-slate-800">
             <div 
               className="bg-slate-200 dark:bg-slate-800 px-3 py-2 flex justify-between items-center cursor-pointer select-none border-b border-slate-300 dark:border-slate-700"
               onClick={() => setExpandStats(!expandStats)}
             >
               <h3 className="font-bold text-xs uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                 Estadísticas Globales
               </h3>
               {expandStats ? <ChevronDown size={14} className="text-slate-500"/> : <ChevronRight size={14} className="text-slate-500"/>}
             </div>
             
             {expandStats && (
               <div className="p-0 bg-white dark:bg-slate-900">
                 {result ? (
                   <table className="w-full text-xs text-left">
                     <tbody>
                       <tr className="border-b border-slate-100 dark:border-slate-800">
                         <td className="py-2 px-3 text-slate-500 font-medium">Hojas utilizadas</td>
                         <td className="py-2 px-3 text-right font-mono text-slate-800 dark:text-slate-200">{result.stats.totalBoards}</td>
                       </tr>
                       <tr className="border-b border-slate-100 dark:border-slate-800">
                         <td className="py-2 px-3 text-slate-500 font-medium">Área utilizada</td>
                         <td className="py-2 px-3 text-right font-mono text-emerald-600">
                           {result.stats.totalArea > 0 ? ((result.stats.usedArea / result.stats.totalArea) * 100).toFixed(1) : 0}%
                         </td>
                       </tr>
                       <tr className="border-b border-slate-100 dark:border-slate-800">
                         <td className="py-2 px-3 text-slate-500 font-medium">Área desperdiciada</td>
                         <td className="py-2 px-3 text-right font-mono text-red-500">
                            {result.stats.totalArea > 0 ? ((result.stats.wasteArea / result.stats.totalArea) * 100).toFixed(1) : 0}%
                         </td>
                       </tr>
                       <tr className="border-b border-slate-100 dark:border-slate-800">
                         <td className="py-2 px-3 text-slate-500 font-medium">Cortes totales</td>
                         <td className="py-2 px-3 text-right font-mono text-slate-800 dark:text-slate-200">{result.stats.totalCuts}</td>
                       </tr>
                       <tr className="border-b border-slate-100 dark:border-slate-800">
                         <td className="py-2 px-3 text-slate-500 font-medium">Longitud de Canto</td>
                         <td className="py-2 px-3 text-right font-mono text-slate-800 dark:text-slate-200">
                           {(settings.units === 'mm' || settings.units === 'cm') 
                             ? `${(result.stats.totalEdgeLength / (settings.units === 'mm' ? 1000 : 100)).toFixed(2)} m`
                             : `${(result.stats.totalEdgeLength / 12).toFixed(2)} ft`
                          }
                         </td>
                       </tr>
                       <tr>
                         <td className="py-2 px-3 text-slate-500 font-medium">Grosor de corte</td>
                         <td className="py-2 px-3 text-right font-mono text-slate-800 dark:text-slate-200">{settings.bladeThickness} {settings.units}</td>
                       </tr>
                     </tbody>
                   </table>
                 ) : (
                   <div className="p-4 text-center text-slate-400 text-xs italic">Sin datos</div>
                 )}
               </div>
             )}
          </div>

          {/* Panel: Cut Summary */}
           <div className="flex-1 overflow-hidden flex flex-col">
             <div 
               className="bg-slate-200 dark:bg-slate-800 px-3 py-2 flex justify-between items-center cursor-pointer select-none border-b border-slate-300 dark:border-slate-700"
               onClick={() => setExpandCuts(!expandCuts)}
             >
               <h3 className="font-bold text-xs uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                 Resumen de Cortes
               </h3>
               {expandCuts ? <ChevronDown size={14} className="text-slate-500"/> : <ChevronRight size={14} className="text-slate-500"/>}
             </div>
             
             {expandCuts && (
               <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                 {result?.usedStock.map((s, i) => {
                     // Group items logic
                     const itemGroups = s.placedItems.reduce((acc, item) => {
                        const dimKey = `${item.originalLength}x${item.originalWidth}`;
                        acc[dimKey] = (acc[dimKey] || 0) + 1;
                        return acc;
                     }, {} as Record<string, number>);

                    return (
                     <div key={i} className="border-b border-slate-100 dark:border-slate-800">
                        <div className="bg-slate-50 dark:bg-slate-850 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 flex justify-between">
                            <span>Hoja {i + 1}</span>
                            <span className="font-normal text-[10px] text-slate-400">{s.width}x{s.length}</span>
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                             <tr className="text-slate-400 text-[10px] bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                                <th className="px-3 py-1 font-normal text-left">Cant</th>
                                <th className="px-3 py-1 font-normal text-left">Medida</th>
                                <th className="px-3 py-1 font-normal text-right">Etiqueta</th>
                             </tr>
                          </thead>
                          <tbody>
                             {Object.entries(itemGroups).map(([dim, count], idx) => (
                               <tr key={idx} className="hover:bg-blue-50 dark:hover:bg-slate-800">
                                  <td className="px-3 py-1 text-slate-600 dark:text-slate-300 border-b border-slate-50 dark:border-slate-800 font-mono">{count}</td>
                                  <td className="px-3 py-1 text-slate-800 dark:text-slate-200 border-b border-slate-50 dark:border-slate-800 font-mono">{dim}</td>
                                  <td className="px-3 py-1 text-slate-500 text-right border-b border-slate-50 dark:border-slate-800">-</td>
                               </tr>
                             ))}
                             {/* Waste Row */}
                             {s.waste > 0 && (
                               <tr className="bg-red-50/50 dark:bg-red-900/10">
                                  <td colSpan={2} className="px-3 py-1 text-red-400 italic">Desperdicio</td>
                                  <td className="px-3 py-1 text-right text-red-500 font-mono">{(s.waste * 100).toFixed(1)}%</td>
                               </tr>
                             )}
                          </tbody>
                        </table>
                     </div>
                   );
                 })}
                 {!result && <div className="p-4 text-center text-slate-400 text-xs italic">Sin datos</div>}
               </div>
             )}
           </div>

        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Settings Modal (Simplified visual) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-[400px] rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex justify-between items-center">
                 <h3 className="font-bold text-sm">Configuración</h3>
                 <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-slate-800">✕</button>
              </div>
              <div className="p-6 space-y-4 text-sm">
                
                <div className="grid grid-cols-2 items-center">
                  <label className="text-slate-600 dark:text-slate-400">Unidades</label>
                  <select 
                    value={settings.units}
                    onChange={(e) => setSettings({...settings, units: e.target.value as any})}
                    className="border rounded p-1.5 dark:bg-slate-800 dark:border-slate-700 focus:ring-1 focus:ring-blue-500 outline-none w-full"
                  >
                    <option value="mm">Milímetros (mm)</option>
                    <option value="cm">Centímetros (cm)</option>
                    <option value="inch">Pulgadas (in)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 items-center">
                  <label className="text-slate-600 dark:text-slate-400">Espesor de Sierra</label>
                  <div className="flex items-center">
                    <input type="number" step="0.1"
                      value={settings.bladeThickness}
                      onChange={(e) => setSettings({...settings, bladeThickness: parseFloat(e.target.value)})}
                      className="w-full border rounded p-1.5 dark:bg-slate-800 dark:border-slate-700"
                    />
                    <span className="ml-2 text-slate-400 text-xs w-8">{settings.units}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 items-center">
                  <label className="text-slate-600 dark:text-slate-400">Espesor Tapacanto</label>
                  <div className="flex items-center">
                    <input type="number" step="0.1"
                      value={settings.edgeThickness}
                      onChange={(e) => setSettings({...settings, edgeThickness: parseFloat(e.target.value)})}
                      className="w-full border rounded p-1.5 dark:bg-slate-800 dark:border-slate-700"
                    />
                    <span className="ml-2 text-slate-400 text-xs w-8">{settings.units}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 items-center">
                  <label className="text-slate-600 dark:text-slate-400">Margen de Tablero</label>
                  <div className="flex items-center">
                    <input type="number" step="0.1"
                      value={settings.stockMargin}
                      onChange={(e) => setSettings({...settings, stockMargin: parseFloat(e.target.value)})}
                      className="w-full border rounded p-1.5 dark:bg-slate-800 dark:border-slate-700"
                    />
                     <span className="ml-2 text-slate-400 text-xs w-8">{settings.units}</span>
                  </div>
                </div>

              </div>
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex justify-end">
                 <button onClick={() => setShowSettings(false)} className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-xs">Guardar</button>
              </div>
           </div>
        </div>
      )}

      {/* Custom Confirmation Modal for NEW PROJECT */}
      {showConfirmNew && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm p-6 flex flex-col gap-5 zoom-in-95 duration-200">
             <div className="flex flex-col items-center text-center gap-3">
               <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full text-amber-600 dark:text-amber-400">
                 <AlertTriangle size={32} />
               </div>
               <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">¿Crear nuevo proyecto?</h3>
               <p className="text-slate-600 dark:text-slate-400 text-sm">
                 Se eliminarán todas las piezas y configuraciones actuales. Asegúrate de guardar tu progreso antes de continuar.
               </p>
             </div>
             
             <div className="flex justify-center gap-3 mt-2">
               <button 
                 onClick={() => setShowConfirmNew(false)}
                 className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors w-full"
               >
                 Cancelar
               </button>
               <button 
                 onClick={handleConfirmNewProject}
                 className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm w-full"
               >
                 Confirmar
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-[500px] max-h-[80vh] flex flex-col rounded shadow-2xl border border-slate-200 dark:border-slate-700">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex justify-between items-center">
                 <h3 className="font-bold text-sm flex items-center gap-2"><LayoutTemplate size={16}/> Plantillas</h3>
                 <button onClick={() => setShowTemplates(false)} className="text-slate-500 hover:text-slate-800">✕</button>
              </div>
              
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
                 <div className="flex gap-2">
                   <input 
                      type="text" 
                      placeholder="Nombre de la nueva plantilla..." 
                      className="flex-1 border rounded px-3 py-1.5 text-xs dark:bg-slate-800 dark:border-slate-700"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                   />
                   <button 
                    onClick={handleSaveTemplate}
                    disabled={!newTemplateName.trim()}
                    className="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1 font-medium"
                   >
                     <Save size={14} /> Guardar Actual
                   </button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                {templates.length === 0 ? (
                  <div className="text-center text-slate-400 text-xs py-8">No hay plantillas guardadas.</div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white dark:bg-slate-900 text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-2 font-normal">Nombre</th>
                        <th className="px-3 py-2 font-normal">Fecha</th>
                        <th className="px-3 py-2 font-normal text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                    {templates.map(t => (
                      <tr key={t.id} className="hover:bg-blue-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">{t.name}</td>
                        <td className="px-3 py-2 text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                        <td className="px-3 py-2 text-right flex justify-end gap-2">
                          <button onClick={() => handleLoadTemplate(t)} className="text-blue-600 hover:underline" title="Cargar">Cargar</button>
                          <span className="text-slate-300">|</span>
                          <button onClick={() => handleDeleteTemplate(t.id)} className="text-red-500 hover:underline" title="Eliminar">Eliminar</button>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                )}
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default App;
EOF

echo "✅ ¡Configuración completa! Ahora ejecuta: npm run dev"