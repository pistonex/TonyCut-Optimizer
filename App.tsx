import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings as SettingsIcon, Layout, Save, Moon, Sun, Download, RefreshCcw, Calculator, Menu, FilePlus, FolderOpen, ChevronDown, ChevronRight, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, Trash2, AlertTriangle, FileUp, FileDown, LayoutTemplate, Printer, FileText } from 'lucide-react';
import { CutItem, StockItem, Settings, OptimizationResult, Template } from './types';
import { optimizeCuts } from './services/optimizer';
import { InputForms } from './components/InputForms';
import { Visualizer, VisualizerHandle } from './components/Visualizer';

const defaultItems: CutItem[] = [
  { id: '1', name: 'Puerta', length: 120, width: 60, quantity: 2, material: 'Melamina Blanca', grain: true, edges: { top: true, bottom: true, left: true, right: true } },
  { id: '2', name: 'Estante', length: 58, width: 30, quantity: 4, material: 'Melamina Blanca', grain: false, edges: { top: true, bottom: false, left: false, right: false } },
  { id: '3', name: 'Lateral', length: 200, width: 60, quantity: 2, material: 'Melamina Blanca', grain: true, edges: { top: false, bottom: true, left: false, right: false } }
];
const defaultStock: StockItem[] = [{ id: 's1', name: 'Tablero 1', length: 275, width: 183, quantity: 5, material: 'Melamina Blanca', grainDirection: 'long' }];
const defaultSettings: Settings = { units: 'cm', bladeThickness: 0.4, edgeThickness: 0.1, stockMargin: 1.0, optimizePerformance: 'quality' };

const App: React.FC = () => {
  const [items, setItems] = useState<CutItem[]>(defaultItems);
  const [stock, setStock] = useState<StockItem[]>(defaultStock);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<'horizontal' | 'vertical'>('vertical');
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showConfirmNew, setShowConfirmNew] = useState(false);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [expandStats, setExpandStats] = useState(true);
  const [expandCuts, setExpandCuts] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visualizerRef = useRef<VisualizerHandle>(null);

  useEffect(() => {
    const savedData = localStorage.getItem('tonycut_data');
    if (savedData) {
      try { const data = JSON.parse(savedData); if (data.items) setItems(data.items); if (data.stock) setStock(data.stock); if (data.settings) setSettings(data.settings); if (data.darkMode !== undefined) setDarkMode(data.darkMode); } catch (e) { }
    }
    const savedTemplates = localStorage.getItem('tonycut_templates');
    if (savedTemplates) try { setTemplates(JSON.parse(savedTemplates)); } catch (e) { }
    const handleClickOutside = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsFileMenuOpen(false); };
    document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    localStorage.setItem('tonycut_data', JSON.stringify({ items, stock, settings, darkMode }));
    if (darkMode) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark');
  }, [items, stock, settings, darkMode]);
  useEffect(() => { localStorage.setItem('tonycut_templates', JSON.stringify(templates)); }, [templates]);

  const handleOptimize = useCallback(() => { setIsOptimizing(true); setTimeout(() => { const res = optimizeCuts(items, stock, settings); setResult(res); setIsOptimizing(false); }, 100); }, [items, stock, settings]);
  const handleConfirmNewProject = () => { setItems([]); setStock(defaultStock); setResult(null); setShowConfirmNew(false); };

  const handleSaveProjectJSON = async () => {
    const data = { items, stock, settings, darkMode, timestamp: Date.now() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    try {
      // @ts-ignore
      if (window.showSaveFilePicker) {
        // @ts-ignore
        const handle = await window.showSaveFilePicker({ suggestedName: `tonycut-${new Date().toISOString().slice(0, 10)}.json`, types: [{ description: 'JSON Project', accept: { 'application/json': ['.json'] } }] });
        const writable = await handle.createWritable(); await writable.write(blob); await writable.close();
      } else { throw new Error("Fallback"); }
    } catch (e) {
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `tonycut-project.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }
    setIsFileMenuOpen(false);
  };

  const handleLoadProjectJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => { try { const data = JSON.parse(evt.target?.result as string); if (data.items) setItems(data.items); if (data.stock) setStock(data.stock); if (data.settings) setSettings(data.settings); if (data.darkMode !== undefined) setDarkMode(data.darkMode); setResult(null); } catch (err) { alert("Error al leer archivo"); } };
    reader.readAsText(file); setIsFileMenuOpen(false); if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerPDFExport = () => { if (visualizerRef.current) { visualizerRef.current.handleDownloadPDF(); setIsFileMenuOpen(false); } else { alert("Calcula primero."); } };
  const handleSaveTemplate = () => { if (!newTemplateName.trim()) return; setTemplates(prev => [{ id: Date.now().toString(), name: newTemplateName, date: Date.now(), items: [...items], stock: [...stock] }, ...prev]); setNewTemplateName(''); };
  const handleLoadTemplate = (t: Template) => { setItems(t.items); setStock(t.stock); setShowTemplates(false); setResult(null); };
  const handleDeleteTemplate = (id: string) => { setTemplates(prev => prev.filter(t => t.id !== id)); };
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const lines = (evt.target?.result as string).split('\n');
      const newItems: CutItem[] = [];
      lines.forEach((line, i) => { if (i === 0) return; const cols = line.split(','); if (cols.length >= 3) newItems.push({ id: Math.random().toString(36), name: cols[0] || 'Pieza', length: parseFloat(cols[1]) || 0, width: parseFloat(cols[2]) || 0, quantity: parseInt(cols[3]) || 1, material: 'Importado', grain: false, edges: { top: false, right: false, bottom: false, left: false } }); });
      setItems(prev => [...prev, ...newItems]);
    }; reader.readAsText(file);
  };

  const handlePrintAll = () => {
    document.body.classList.remove('print-summary');
    setTimeout(() => { window.print(); }, 200);
  };

  const handlePrintSummary = () => {
    document.body.classList.add('print-summary');
    setTimeout(() => { window.print(); document.body.classList.remove('print-summary'); }, 200);
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      <nav className="h-12 bg-slate-800 dark:bg-slate-950 border-b border-slate-700 flex items-center justify-between px-4 shrink-0 shadow-md z-30 text-slate-100 no-print-ui">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 mr-2"><Layout size={20} className="text-blue-400" /><h1 className="font-bold text-lg tracking-tight">TonyCut <span className="text-[10px] font-normal opacity-70">Optimizer</span></h1></div>
          <div className="h-6 w-px bg-slate-600 mx-2"></div>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setIsFileMenuOpen(!isFileMenuOpen)} className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors border border-transparent ${isFileMenuOpen ? 'bg-slate-700 border-slate-600' : 'hover:bg-slate-700 hover:border-slate-600'}`}><Menu size={14} /><span>Archivo</span><ChevronDown size={12} className="opacity-70" /></button>
            {isFileMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <button onClick={() => { setShowConfirmNew(true); setIsFileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs flex items-center gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"><FilePlus size={14} className="text-blue-500" />Nuevo Proyecto</button>
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                <button onClick={() => { fileInputRef.current?.click(); setIsFileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs flex items-center gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"><FileUp size={14} className="text-amber-500" />Abrir Proyecto (.json)</button>
                <button onClick={handleSaveProjectJSON} className="w-full text-left px-4 py-2 text-xs flex items-center gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"><FileDown size={14} className="text-emerald-500" />Guardar Proyecto (.json)</button>
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                <button onClick={handlePrintAll} className="w-full text-left px-4 py-2 text-xs flex items-center gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"><Printer size={14} className="text-slate-500" />Imprimir Todo</button>
                <button onClick={handlePrintSummary} className="w-full text-left px-4 py-2 text-xs flex items-center gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"><FileText size={14} className="text-slate-500" />Imprimir Resumen</button>
                <button onClick={triggerPDFExport} className="w-full text-left px-4 py-2 text-xs flex items-center gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"><FileText size={14} className="text-red-500" />Exportar a PDF</button>
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                <button onClick={() => { setShowTemplates(true); setIsFileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-xs flex items-center gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"><LayoutTemplate size={14} className="text-purple-500" />Gestor de Plantillas</button>
              </div>
            )}
          </div>
          <input type="file" ref={fileInputRef} hidden accept=".json" onChange={handleLoadProjectJSON} />
          <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-2 px-3 py-1 hover:bg-slate-700 rounded text-xs font-medium transition-colors border border-transparent hover:border-slate-600 text-slate-300 hover:text-white"><SettingsIcon size={14} /><span>Configurar</span></button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleOptimize} disabled={isOptimizing} className="flex items-center gap-2 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-6 py-1 rounded shadow border border-blue-800 font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:grayscale">{isOptimizing ? <RefreshCcw className="animate-spin" size={16} /> : <Calculator size={16} fill="currentColor" className="opacity-80" />}<span>Calcular</span></button>
          <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors" title="Modo Oscuro">{darkMode ? <Sun size={16} /> : <Moon size={16} />}</button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden relative">
        <div className="w-[450px] shrink-0 h-full border-r border-slate-300 dark:border-slate-800 flex flex-col z-20 shadow-xl bg-white dark:bg-slate-900 input-panel"><InputForms items={items} setItems={setItems} stock={stock} setStock={setStock} onImportCSV={handleCSVImport} /></div>
        <div className="flex-1 h-full relative z-0 bg-slate-200/50 dark:bg-black/20 flex flex-col">
          <div className="h-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center text-xs text-slate-500 no-print-ui"><span>Proyecto actual</span><ChevronRight size={12} className="mx-2" /><span className="font-semibold text-slate-800 dark:text-slate-200">Visualización</span></div>
          <div className="flex-1 relative overflow-hidden" id="visualizer-container">
            {result ? (<Visualizer ref={visualizerRef} usedStock={result.usedStock} settings={settings} boardOrientation={boardOrientation} />) : (<div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-4"><div className="w-24 h-24 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center"><LayoutTemplate size={40} className="opacity-20" /></div><p className="text-sm">Configura y presiona <strong className="text-blue-600 font-bold">Calcular</strong></p></div>)}
          </div>
        </div>
        <div id="summary-panel" className="w-[320px] shrink-0 h-full border-l border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-y-auto print:visible">
          <div className="border-b border-slate-200 dark:border-slate-800">
            <div className="bg-slate-200 dark:bg-slate-800 px-3 py-2 flex justify-between items-center cursor-pointer select-none border-b border-slate-300 dark:border-slate-700" onClick={() => setExpandStats(!expandStats)}><h3 className="font-bold text-xs uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">Estadísticas Globales</h3>{expandStats ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}</div>
            {expandStats && (<div className="p-0 bg-white dark:bg-slate-900">{result ? (<table className="w-full text-xs text-left"><tbody><tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-2 px-3 text-slate-500 font-medium">Hojas utilizadas</td><td className="py-2 px-3 text-right font-mono text-slate-800 dark:text-slate-200">{result.stats.totalBoards}</td></tr><tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-2 px-3 text-slate-500 font-medium">Área utilizada</td><td className="py-2 px-3 text-right font-mono text-emerald-600">{result.stats.totalArea > 0 ? ((result.stats.usedArea / result.stats.totalArea) * 100).toFixed(1) : 0}%</td></tr><tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-2 px-3 text-slate-500 font-medium">Área desperdiciada</td><td className="py-2 px-3 text-right font-mono text-red-500">{result.stats.totalArea > 0 ? ((result.stats.wasteArea / result.stats.totalArea) * 100).toFixed(1) : 0}%</td></tr><tr className="border-b border-slate-100 dark:border-slate-800"><td className="py-2 px-3 text-slate-500 font-medium">Cortes totales</td><td className="py-2 px-3 text-right font-mono text-slate-800 dark:text-slate-200">{result.stats.totalCuts}</td></tr></tbody></table>) : (<div className="p-4 text-center text-slate-400 text-xs italic">Sin datos</div>)}</div>)}
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="bg-slate-200 dark:bg-slate-800 px-3 py-2 flex justify-between items-center cursor-pointer select-none border-b border-slate-300 dark:border-slate-700">
              <h3 className="font-bold text-xs uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">Resumen de Cortes</h3>
              <button onClick={handlePrintSummary} className="p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400" title="Imprimir Reporte"><FileText size={14} /></button>
            </div>
            {expandCuts && (<div className="flex-1 overflow-y-auto custom-scrollbar p-0">
              {result?.usedStock.map((s, i) => {
                const itemGroups = s.placedItems.reduce((acc, item) => { const dimKey = `${item.originalLength}x${item.originalWidth}`; acc[dimKey] = (acc[dimKey] || 0) + 1; return acc; }, {} as Record<string, number>);
                return (<div key={i} className="border-b border-slate-100 dark:border-slate-800"><div className="bg-slate-50 dark:bg-slate-850 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 flex justify-between"><span>Hoja {i + 1}</span><span className="font-normal text-[10px] text-slate-400">{s.width}x{s.length}</span></div><table className="w-full text-xs"><thead><tr className="text-slate-400 text-[10px] bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800"><th className="px-3 py-1 font-normal text-left">Cant</th><th className="px-3 py-1 font-normal text-left">Medida</th><th className="px-3 py-1 font-normal text-right">Etiqueta</th></tr></thead><tbody>{Object.entries(itemGroups).map(([dim, count], idx) => (<tr key={idx} className="hover:bg-blue-50 dark:hover:bg-slate-800"><td className="px-3 py-1 text-slate-600 dark:text-slate-300 border-b border-slate-50 dark:border-slate-800 font-mono">{count}</td><td className="px-3 py-1 text-slate-800 dark:text-slate-200 border-b border-slate-50 dark:border-slate-800 font-mono">{dim}</td><td className="px-3 py-1 text-slate-500 text-right border-b border-slate-50 dark:border-slate-800">-</td></tr>))}</tbody></table></div>);
              })}
              {!result && <div className="p-4 text-center text-slate-400 text-xs italic">Sin datos</div>}
            </div>)}
          </div>
        </div>
      </div>
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-[400px] rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex justify-between items-center"><h3 className="font-bold text-sm">Configuración</h3><button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-slate-800">✕</button></div>
            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 items-center"><label className="text-slate-600 dark:text-slate-400">Unidades</label><select value={settings.units} onChange={(e) => setSettings({ ...settings, units: e.target.value as any })} className="border rounded p-1.5 dark:bg-slate-800 dark:border-slate-700 w-full"><option value="mm">Milímetros (mm)</option><option value="cm">Centímetros (cm)</option><option value="inch">Pulgadas (in)</option></select></div>
              <div className="grid grid-cols-2 items-center"><label className="text-slate-600 dark:text-slate-400">Espesor de Sierra</label><div className="flex items-center"><input type="number" step="0.1" value={settings.bladeThickness} onChange={(e) => setSettings({ ...settings, bladeThickness: parseFloat(e.target.value) })} className="w-full border rounded p-1.5 dark:bg-slate-800 dark:border-slate-700" /><span className="ml-2 text-slate-400 text-xs w-8">{settings.units}</span></div></div>
              <div className="grid grid-cols-2 items-center"><label className="text-slate-600 dark:text-slate-400">Espesor Tapacanto</label><div className="flex items-center"><input type="number" step="0.1" value={settings.edgeThickness} onChange={(e) => setSettings({ ...settings, edgeThickness: parseFloat(e.target.value) })} className="w-full border rounded p-1.5 dark:bg-slate-800 dark:border-slate-700" /><span className="ml-2 text-slate-400 text-xs w-8">{settings.units}</span></div></div>
              <div className="grid grid-cols-2 items-center"><label className="text-slate-600 dark:text-slate-400">Margen de Tablero</label><div className="flex items-center"><input type="number" step="0.1" value={settings.stockMargin} onChange={(e) => setSettings({ ...settings, stockMargin: parseFloat(e.target.value) })} className="w-full border rounded p-1.5 dark:bg-slate-800 dark:border-slate-700" /><span className="ml-2 text-slate-400 text-xs w-8">{settings.units}</span></div></div>
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex justify-end"><button onClick={() => setShowSettings(false)} className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-xs">Guardar</button></div>
          </div>
        </div>
      )}
      {showConfirmNew && (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"><div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm p-6 flex flex-col gap-5 zoom-in-95 duration-200"><div className="flex flex-col items-center text-center gap-3"><div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full text-amber-600 dark:text-amber-400"><AlertTriangle size={32} /></div><h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">¿Crear nuevo proyecto?</h3><p className="text-slate-600 dark:text-slate-400 text-sm">Se eliminarán todas las piezas y configuraciones actuales.</p></div><div className="flex justify-center gap-3 mt-2"><button onClick={() => setShowConfirmNew(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors w-full">Cancelar</button><button onClick={handleConfirmNewProject} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm w-full">Confirmar</button></div></div></div>)}
      {showTemplates && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"><div className="bg-white dark:bg-slate-900 w-[500px] max-h-[80vh] flex flex-col rounded shadow-2xl border border-slate-200 dark:border-slate-700"><div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex justify-between items-center"><h3 className="font-bold text-sm flex items-center gap-2"><LayoutTemplate size={16} /> Plantillas</h3><button onClick={() => setShowTemplates(false)} className="text-slate-500 hover:text-slate-800">✕</button></div><div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850"><div className="flex gap-2"><input type="text" placeholder="Nombre de la nueva plantilla..." className="flex-1 border rounded px-3 py-1.5 text-xs dark:bg-slate-800 dark:border-slate-700" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} /><button onClick={handleSaveTemplate} disabled={!newTemplateName.trim()} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1 font-medium"><Save size={14} /> Guardar Actual</button></div></div><div className="flex-1 overflow-y-auto p-2 custom-scrollbar">{templates.length === 0 ? (<div className="text-center text-slate-400 text-xs py-8">No hay plantillas guardadas.</div>) : (<table className="w-full text-xs text-left"><thead className="bg-white dark:bg-slate-900 text-slate-400 border-b border-slate-200 dark:border-slate-700"><tr><th className="px-3 py-2 font-normal">Nombre</th><th className="px-3 py-2 font-normal">Fecha</th><th className="px-3 py-2 font-normal text-right">Acciones</th></tr></thead><tbody>{templates.map(t => (<tr key={t.id} className="hover:bg-blue-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800"><td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">{t.name}</td><td className="px-3 py-2 text-slate-500">{new Date(t.date).toLocaleDateString()}</td><td className="px-3 py-2 text-right flex justify-end gap-2"><button onClick={() => handleLoadTemplate(t)} className="text-blue-600 hover:underline" title="Cargar">Cargar</button><span className="text-slate-300">|</span><button onClick={() => handleDeleteTemplate(t.id)} className="text-red-500 hover:underline" title="Eliminar">Eliminar</button></td></tr>))}</tbody></table>)}</div></div></div>)}
    </div>
  );
};

export default App;
