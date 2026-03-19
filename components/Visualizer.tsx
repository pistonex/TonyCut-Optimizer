import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { UsedStock, Settings } from '../types';
import { stringToColor } from '../services/optimizer';
import { LayoutGrid, List, FileText } from 'lucide-react';
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

export const Visualizer = forwardRef<VisualizerHandle, VisualizerProps>(({ usedStock, settings, boardOrientation = 'vertical' }, ref) => {
  const [isRotated, setIsRotated] = useState(boardOrientation === 'vertical');
  const [viewMode, setViewMode] = useState<'column' | 'grid'>('column');
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsRotated(boardOrientation === 'vertical');
  }, [boardOrientation]);

  useImperativeHandle(ref, () => ({
    handleDownloadPDF
  }));

  const handleDownloadPDF = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      let handle;
      try {
        // @ts-ignore
        if (window.showSaveFilePicker) {
          // @ts-ignore
          handle = await window.showSaveFilePicker({
            suggestedName: 'tonycut-optimizacion.pdf',
            types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }],
          });
        }
      } catch (e) { console.log("Picker cancelled"); }

      const element = containerRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff', ignoreElements: (el: Element) => el.classList.contains('no-print') });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      let finalW = pageWidth;
      let finalH = (imgHeight * pageWidth) / imgWidth;
      if (finalH > pageHeight) { finalH = pageHeight; finalW = (imgWidth * pageHeight) / imgHeight; }

      pdf.addImage(imgData, 'PNG', 0, 0, finalW, finalH);
      if (handle) {
        const writable = await handle.createWritable();
        const pdfBlob = pdf.output('blob');
        await writable.write(pdfBlob);
        await writable.close();
      } else {
        pdf.save('tonycut-optimizacion.pdf');
      }
    } catch (err) { alert("Error al generar PDF"); } finally { setIsExporting(false); }
  };

  const getRelativeFontSize = (boardSize: number) => Math.max(boardSize / 60, 0.5);

  if (usedStock.length === 0) return null;

  return (
    <div className="h-full flex flex-col relative bg-slate-200/50 dark:bg-black/20">
      <div className="absolute top-4 right-4 flex gap-2 z-20 no-print pointer-events-auto">
        <div className="flex gap-1 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded p-0.5">
          <button onClick={() => setViewMode('column')} className={`p-1.5 rounded ${viewMode === 'column' ? 'bg-slate-200 dark:bg-slate-700 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`} title="Vertical"><List size={16} /></button>
          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-200 dark:bg-slate-700 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`} title="Horizontal"><LayoutGrid size={16} /></button>
        </div>
        <button onClick={handleDownloadPDF} disabled={isExporting} className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded hover:bg-slate-50 text-slate-600 dark:text-slate-300 ml-2 disabled:opacity-50" title="Guardar PDF">{isExporting ? <span className="animate-spin text-xs">...</span> : <FileText size={16} />}</button>
      </div>

      <div className="flex-grow overflow-auto p-8 custom-scrollbar bg-slate-200/50 dark:bg-black/20">
        <div id="visualizer-container" ref={containerRef} className={`flex gap-12 items-start justify-center transition-all duration-300 ${viewMode === 'column' ? 'flex-col' : 'flex-row flex-wrap'}`} >
          {usedStock.map((board, index) => {
            const displayWidth = isRotated ? board.width : board.length;
            const displayHeight = isRotated ? board.length : board.width;
            const baseFS = getRelativeFontSize(Math.max(displayWidth, displayHeight));
            const rulerOffset = baseFS * 4;
            const transform = isRotated ? `translate(${board.width}, 0) rotate(90)` : undefined;

            const boardItemsSummary = board.placedItems.reduce((acc, item) => {
              const key = `${item.name}-${item.w}x${item.h}`;
              if (!acc[key]) {
                acc[key] = { name: item.name, w: item.w, h: item.h, count: 0 };
              }
              acc[key].count++;
              return acc;
            }, {} as Record<string, { name: string, w: number, h: number, count: number }>);

            return (
              <div key={index} className="relative group w-full max-w-6xl bg-white p-4 shadow-md rounded-sm print:shadow-none print:p-0">
                <div className="text-sm font-bold text-slate-500 mb-2 flex justify-between border-b pb-1">
                  <span>{board.stockName} <span className="font-normal opacity-70">#{index + 1}</span></span>
                  <span className="font-mono text-xs">{displayWidth} x {displayHeight} {settings.units}</span>
                </div>
                <div className="flex flex-col lg:flex-row gap-6 print:flex-row">
                  <div className="flex-1 min-w-0">
                    <svg viewBox={`-${rulerOffset} -${rulerOffset} ${displayWidth + rulerOffset} ${displayHeight + rulerOffset}`} className="w-full h-auto max-h-[85vh]" style={{ shapeRendering: 'geometricPrecision' }}>
                      <g className="opacity-60">
                        <line x1="0" y1={-baseFS} x2={displayWidth} y2={-baseFS} stroke="#64748b" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        <line x1="0" y1={-baseFS * 0.5} x2="0" y2={-baseFS * 1.5} stroke="#64748b" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        <line x1={displayWidth} y1={-baseFS * 0.5} x2={displayWidth} y2={-baseFS * 1.5} stroke="#64748b" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        <text x={displayWidth / 2} y={-baseFS * 2} textAnchor="middle" fontSize={baseFS} fill="#475569" fontWeight="bold">{displayWidth}</text>
                        <line x1={-baseFS} y1="0" x2={-baseFS} y2={displayHeight} stroke="#64748b" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        <line x1={-baseFS * 0.5} y1="0" x2={-baseFS * 1.5} y2="0" stroke="#64748b" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        <line x1={-baseFS * 0.5} y1={displayHeight} x2={-baseFS * 1.5} y2={displayHeight} stroke="#64748b" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        <text x={-baseFS * 2} y={displayHeight / 2} textAnchor="middle" fontSize={baseFS} fill="#475569" fontWeight="bold" transform={`rotate(-90, ${-baseFS * 2}, ${displayHeight / 2})`}>{displayHeight}</text>
                      </g>
                      <g transform={transform}>
                        <rect x="0" y="0" width={board.length} height={board.width} fill="#ffffff" stroke="#334155" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        {settings.stockMargin > 0 && (<rect x={settings.stockMargin} y={settings.stockMargin} width={board.length - settings.stockMargin * 2} height={board.width - settings.stockMargin * 2} fill="none" stroke="#cbd5e1" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4 2" />)}
                        {board.placedItems.map((item, i) => {
                          const baseColor = stringToColor(item.name);
                          const dimH = Number(item.w).toFixed(settings.units === 'mm' ? 0 : 1);
                          const dimV = Number(item.h).toFixed(settings.units === 'mm' ? 0 : 1);

                          let nameFS = baseFS * 1.2;
                          const estTextW = item.name.length * (nameFS * 0.6);
                          if (estTextW > item.w * 0.9) nameFS = (item.w * 0.9) / (item.name.length * 0.6);
                          if (nameFS > item.h * 0.8) nameFS = item.h * 0.8;
                          const showName = nameFS >= baseFS * 0.4;
                          const textStyle = { opacity: 0.9, textShadow: '0px 0px 3px rgba(255, 255, 255, 0.9)' };

                          return (
                            <g key={i}>
                              <rect x={item.x} y={item.y} width={item.w} height={item.h} fill={baseColor} fillOpacity="0.25" stroke="#000000" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                              {!item.rotated && (<>
                                {item.edges.top && <line x1={item.x} y1={item.y} x2={item.x + item.w} y2={item.y} stroke="#ef4444" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
                                {item.edges.bottom && <line x1={item.x} y1={item.y + item.h} x2={item.x + item.w} y2={item.y + item.h} stroke="#ef4444" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
                                {item.edges.left && <line x1={item.x} y1={item.y} x2={item.x} y2={item.y + item.h} stroke="#ef4444" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
                                {item.edges.right && <line x1={item.x + item.w} y1={item.y} x2={item.x + item.w} y2={item.y + item.h} stroke="#ef4444" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
                              </>)}
                              {item.rotated && (<>
                                {item.edges.top && <line x1={item.x + item.w} y1={item.y} x2={item.x + item.w} y2={item.y + item.h} stroke="#ef4444" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
                                {item.edges.bottom && <line x1={item.x} y1={item.y} x2={item.x} y2={item.y + item.h} stroke="#ef4444" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
                                {item.edges.left && <line x1={item.x} y1={item.y} x2={item.x + item.w} y2={item.y} stroke="#ef4444" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
                                {item.edges.right && <line x1={item.x} y1={item.y + item.h} x2={item.x + item.w} y2={item.y + item.h} stroke="#ef4444" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
                              </>)}
                              {showName && (<g style={{ pointerEvents: 'none' }}>
                                <text x={item.x + item.w / 2} y={item.y + item.h / 2} textAnchor="middle" dominantBaseline="middle" fill="#1e293b" fontSize={nameFS} fontWeight="bold" style={textStyle}>{item.name}</text>
                                {item.w > baseFS * 2 && item.h > baseFS * 2 && (<>
                                  <text x={item.x + item.w / 2} y={item.y + baseFS} textAnchor="middle" fill="#334155" fontSize={baseFS * 0.9} style={textStyle}>{dimH}</text>
                                  <text x={item.x + baseFS * 0.7} y={item.y + item.h / 2} textAnchor="middle" fill="#334155" fontSize={baseFS * 0.9} transform={`rotate(-90, ${item.x + baseFS * 0.7}, ${item.y + item.h / 2})`} style={textStyle}>{dimV}</text>
                                </>)}
                                {item.rotated && (<text x={item.x + item.w - baseFS} y={item.y + baseFS} fontSize={baseFS} fill="#64748b" style={textStyle}>↻</text>)}
                              </g>
                              )}
                            </g>
                          );
                        })}
                        {board.offcuts.map((off, k) => {
                          const dimH = Number(off.w).toFixed(settings.units === 'mm' ? 0 : 1);
                          const dimV = Number(off.h).toFixed(settings.units === 'mm' ? 0 : 1);
                          return (<g key={`off-${k}`}>
                            <rect x={off.x} y={off.y} width={off.w} height={off.h} fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4 2" />
                            {off.w > baseFS * 4 && off.h > baseFS * 4 && (<g opacity="0.6">
                              <text x={off.x + off.w / 2} y={off.y + baseFS} textAnchor="middle" fill="#94a3b8" fontSize={baseFS * 0.8}>{dimH}</text>
                              <text x={off.x + baseFS * 0.7} y={off.y + off.h / 2} textAnchor="middle" fill="#94a3b8" fontSize={baseFS * 0.8} transform={`rotate(-90, ${off.x + baseFS * 0.7}, ${off.y + off.h / 2})`}>{dimV}</text>
                            </g>)}
                          </g>)
                        })}
                      </g>
                    </svg>
                  </div>

                  <div className="w-full lg:w-48 print:w-48 shrink-0">
                    <h4 className="font-bold text-xs text-slate-700 mb-2 border-b border-slate-200 pb-1">Resumen de Cortes</h4>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 text-[10px] border-b border-slate-100">
                          <th className="py-1 text-left font-normal">Cant</th>
                          <th className="py-1 text-left font-normal">Medida</th>
                          <th className="py-1 text-right font-normal">Etiqueta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(boardItemsSummary).map((item: any, idx) => (
                          <tr key={idx} className="border-b border-slate-50">
                            <td className="py-1 font-mono text-slate-600">{item.count}</td>
                            <td className="py-1 font-mono text-slate-800">{Number(item.w).toFixed(settings.units === 'mm' ? 0 : 1)}x{Number(item.h).toFixed(settings.units === 'mm' ? 0 : 1)}</td>
                            <td className="py-1 text-right text-slate-500 truncate max-w-[80px]" title={item.name}>{item.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
