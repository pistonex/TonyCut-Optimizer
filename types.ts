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
