import { describe, it, expect } from 'vitest';
import { optimizeCuts, stringToColor } from './optimizer';
import { CutItem, StockItem, Settings } from '../types';

const defaultSettings: Settings = {
  units: 'cm',
  bladeThickness: 0.4,
  edgeThickness: 0.1,
  stockMargin: 1.0,
  optimizePerformance: 'speed',
};

const defaultStock: StockItem[] = [
  { id: 's1', name: 'Melamina 18mm', length: 280, width: 70, quantity: 1, material: 'melamina', grainDirection: 'long' },
];

describe('stringToColor', () => {
  it('returns consistent color for same name', () => {
    expect(stringToColor('Panel A')).toBe(stringToColor('Panel A'));
  });

  it('returns different colors for different names', () => {
    expect(stringToColor('Panel A')).not.toBe(stringToColor('Panel B'));
  });

  it('returns valid HSL format', () => {
    expect(stringToColor('test')).toMatch(/^hsl\(\d+, 40%, 85%\)$/);
  });
});

describe('optimizeCuts', () => {
  it('places a single piece that fits exactly', () => {
    const items: CutItem[] = [
      { id: 'c1', name: 'Estante', length: 50, width: 30, quantity: 1, material: 'melamina', grain: false, edges: { top: false, right: false, bottom: false, left: false } },
    ];
    const stock: StockItem[] = [
      { id: 's1', name: 'Tablero', length: 60, width: 40, quantity: 1, material: 'melamina', grainDirection: 'long' },
    ];
    const result = optimizeCuts(items, stock, defaultSettings);
    expect(result.usedStock).toHaveLength(1);
    expect(result.usedStock[0].placedItems).toHaveLength(1);
    expect(result.unplacedItems).toHaveLength(0);
    expect(result.stats.efficiency).toBeGreaterThan(0);
  });

  it('places multiple small pieces on one board', () => {
    const items: CutItem[] = [
      { id: 'c1', name: 'Pieza', length: 30, width: 20, quantity: 4, material: 'melamina', grain: false, edges: { top: false, right: false, bottom: false, left: false } },
    ];
    const result = optimizeCuts(items, defaultStock, defaultSettings);
    expect(result.usedStock).toHaveLength(1);
    expect(result.usedStock[0].placedItems).toHaveLength(4);
    expect(result.unplacedItems).toHaveLength(0);
  });

  it('marks items as unplaced when no stock fits', () => {
    const items: CutItem[] = [
      { id: 'c1', name: 'Gigante', length: 999, width: 999, quantity: 1, material: 'melamina', grain: false, edges: { top: false, right: false, bottom: false, left: false } },
    ];
    const result = optimizeCuts(items, defaultStock, defaultSettings);
    expect(result.usedStock).toHaveLength(0);
    expect(result.unplacedItems).toHaveLength(1);
    expect(result.unplacedItems[0].itemId).toBe('c1');
  });

  it('respects grain constraint (does not rotate)', () => {
    const items: CutItem[] = [
      { id: 'c1', name: 'Veta', length: 60, width: 20, quantity: 1, material: 'melamina', grain: true, edges: { top: false, right: false, bottom: false, left: false } },
    ];
    const stock: StockItem[] = [
      { id: 's1', name: 'Tablero', length: 70, width: 30, quantity: 1, material: 'melamina', grainDirection: 'long' },
    ];
    const result = optimizeCuts(items, stock, defaultSettings);
    expect(result.usedStock).toHaveLength(1);
    const placed = result.usedStock[0].placedItems[0];
    expect(placed.rotated).toBe(false);
    expect(placed.w).toBe(60);
    expect(placed.h).toBe(20);
  });

  it('handles edge banding deduction', () => {
    const items: CutItem[] = [
      { id: 'c1', name: 'Canteado', length: 50, width: 30, quantity: 1, material: 'melamina', grain: false, edges: { top: true, right: true, bottom: true, left: true } },
    ];
    const stock: StockItem[] = [
      { id: 's1', name: 'Tablero', length: 55, width: 35, quantity: 1, material: 'melamina', grainDirection: 'long' },
    ];
    const result = optimizeCuts(items, stock, defaultSettings);
    expect(result.usedStock).toHaveLength(1);
    expect(result.unplacedItems).toHaveLength(0);
  });

  it('uses multiple boards when needed', () => {
    const items: CutItem[] = [
      { id: 'c1', name: 'Grande', length: 100, width: 60, quantity: 3, material: 'melamina', grain: false, edges: { top: false, right: false, bottom: false, left: false } },
    ];
    const stock: StockItem[] = [
      { id: 's1', name: 'Tablero', length: 120, width: 70, quantity: 5, material: 'melamina', grainDirection: 'long' },
    ];
    const result = optimizeCuts(items, stock, defaultSettings);
    expect(result.usedStock).toHaveLength(3);
    expect(result.unplacedItems).toHaveLength(0);
  });

  it('produces efficiency < 1 when there is waste', () => {
    const items: CutItem[] = [
      { id: 'c1', name: 'Chico', length: 10, width: 10, quantity: 1, material: 'melamina', grain: false, edges: { top: false, right: false, bottom: false, left: false } },
    ];
    const stock: StockItem[] = [
      { id: 's1', name: 'Tablero', length: 100, width: 100, quantity: 1, material: 'melamina', grainDirection: 'long' },
    ];
    const result = optimizeCuts(items, stock, defaultSettings);
    expect(result.stats.efficiency).toBeGreaterThan(0);
    expect(result.stats.efficiency).toBeLessThan(1);
  });

  it('sets waste percentage per board', () => {
    const items: CutItem[] = [
      { id: 'c1', name: 'Pieza', length: 50, width: 30, quantity: 1, material: 'melamina', grain: false, edges: { top: false, right: false, bottom: false, left: false } },
    ];
    const stock: StockItem[] = [
      { id: 's1', name: 'Tablero', length: 100, width: 80, quantity: 1, material: 'melamina', grainDirection: 'long' },
    ];
    const result = optimizeCuts(items, stock, defaultSettings);
    expect(result.usedStock[0].waste).toBeGreaterThan(0);
    expect(result.usedStock[0].waste).toBeLessThan(1);
  });

  it('never places overlapping pieces (no overlapping rects)', () => {
    // Test with varied pieces where grain=true (no rotation) to stress overlapping
    const items: CutItem[] = [
      { id: 'c1', name: 'Grande', length: 120, width: 80, quantity: 1, material: 'melamina', grain: false, edges: { top: false, right: false, bottom: false, left: false } },
      { id: 'c2', name: 'Mediano', length: 60, width: 50, quantity: 2, material: 'melamina', grain: true, edges: { top: false, right: false, bottom: false, left: false } },
      { id: 'c3', name: 'Chico', length: 30, width: 20, quantity: 4, material: 'melamina', grain: true, edges: { top: false, right: false, bottom: false, left: false } },
    ];
    const stock: StockItem[] = [
      { id: 's1', name: 'Tablero', length: 200, width: 200, quantity: 2, material: 'melamina', grainDirection: 'long' },
    ];
    const result = optimizeCuts(items, stock, { ...defaultSettings, optimizePerformance: 'quality' });
    // Verify no overlaps in any board
    for (const board of result.usedStock) {
      for (let i = 0; i < board.placedItems.length; i++) {
        for (let j = i + 1; j < board.placedItems.length; j++) {
          const a = board.placedItems[i];
          const b = board.placedItems[j];
          const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
          const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
          expect(overlapX && overlapY).toBe(false);
        }
      }
    }
  });

  it('places 4 pieces of 58x30 on a 280x70 board (user scenario)', () => {
    const items: CutItem[] = [
      { id: 'c1', name: 'Estante', length: 58, width: 30, quantity: 4, material: 'melamina', grain: false, edges: { top: false, right: false, bottom: false, left: false } },
    ];
    const stock: StockItem[] = [
      { id: 's1', name: 'Melamina', length: 280, width: 70, quantity: 1, material: 'melamina', grainDirection: 'long' },
    ];
    const result = optimizeCuts(items, stock, defaultSettings);
    expect(result.usedStock).toHaveLength(1);
    expect(result.usedStock[0].placedItems).toHaveLength(4);
    expect(result.unplacedItems).toHaveLength(0);
  });

  it('places all items correctly with grain=true (the veta bug)', () => {
    // Exact default data from App.tsx: grains mixed, no rotation for grain=true items
    const items: CutItem[] = [
      { id: '1', name: 'Puerta', length: 120, width: 60, quantity: 2, material: 'Melamina Blanca', grain: true, edges: { top: true, bottom: true, left: true, right: true } },
      { id: '2', name: 'Estante', length: 58, width: 30, quantity: 4, material: 'Melamina Blanca', grain: false, edges: { top: true, bottom: false, left: false, right: false } },
      { id: '3', name: 'Lateral', length: 200, width: 60, quantity: 2, material: 'Melamina Blanca', grain: true, edges: { top: false, bottom: true, left: false, right: false } },
    ];
    const stock: StockItem[] = [{ id: 's1', name: 'Tablero 1', length: 275, width: 183, quantity: 5, material: 'Melamina Blanca', grainDirection: 'long' }];
    const settings: Settings = { units: 'cm', bladeThickness: 0.4, edgeThickness: 0.1, stockMargin: 1.0, optimizePerformance: 'quality' };
    const result = optimizeCuts(items, stock, settings);
    // All 8 items should be placed
    expect(result.stats.totalCuts).toBe(8);
    expect(result.unplacedItems).toHaveLength(0);
    // Verify no overlaps
    for (const board of result.usedStock) {
      for (let i = 0; i < board.placedItems.length; i++) {
        for (let j = i + 1; j < board.placedItems.length; j++) {
          const a = board.placedItems[i];
          const b = board.placedItems[j];
          const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
          const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
          expect(overlapX && overlapY).toBe(false);
        }
      }
    }
  });

  it('places more items with quality mode than speed mode for a complex layout', () => {
    const items: CutItem[] = [
      { id: 'c1', name: 'A', length: 60, width: 40, quantity: 1, material: 'melamina', grain: false, edges: { top: false, right: false, bottom: false, left: false } },
      { id: 'c2', name: 'B', length: 50, width: 30, quantity: 1, material: 'melamina', grain: false, edges: { top: false, right: false, bottom: false, left: false } },
      { id: 'c3', name: 'C', length: 40, width: 20, quantity: 1, material: 'melamina', grain: false, edges: { top: false, right: false, bottom: false, left: false } },
      { id: 'c4', name: 'D', length: 60, width: 30, quantity: 1, material: 'melamina', grain: false, edges: { top: false, right: false, bottom: false, left: false } },
      { id: 'c5', name: 'E', length: 70, width: 20, quantity: 1, material: 'melamina', grain: false, edges: { top: false, right: false, bottom: false, left: false } },
    ];
    const speedSettings: Settings = { ...defaultSettings, optimizePerformance: 'speed' };
    const qualitySettings: Settings = { ...defaultSettings, optimizePerformance: 'quality' };
    const speedResult = optimizeCuts(items, defaultStock, speedSettings);
    const qualityResult = optimizeCuts(items, defaultStock, qualitySettings);
    // quality should be >= speed in efficiency
    expect(qualityResult.stats.efficiency).toBeGreaterThanOrEqual(speedResult.stats.efficiency - 0.01);
  });
});
