import React, { useState, useRef } from 'react';
import { Plus, Trash2, Upload, GripVertical, ChevronDown, ChevronRight, AlertCircle, X, FilePlus } from 'lucide-react';
import { CutItem, StockItem, Edges } from '../types';

interface InputFormsProps {
  items: CutItem[];
  setItems: React.Dispatch<React.SetStateAction<CutItem[]>>;
  stock: StockItem[];
  setStock: React.Dispatch<React.SetStateAction<StockItem[]>>;
  onImportCSV: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const CompactEdgeIndicator: React.FC<{ edges: Edges, onChange?: (e: Edges) => void, readonly?: boolean }> = ({ edges, onChange, readonly }) => {
  const toggle = (side: keyof Edges) => {
    if (readonly || !onChange) return;
    onChange({ ...edges, [side]: !edges[side] });
  };

  return (
    <div className="relative w-6 h-6 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-sm flex items-center justify-center shrink-0" title="Cantos (Click para editar)">
       <div onClick={() => toggle('top')} className={`absolute top-0 left-0 right-0 h-1 cursor-pointer transition-colors ${edges.top ? 'bg-red-500' : 'hover:bg-slate-200 dark:hover:bg-slate-500'}`}></div>
       <div onClick={() => toggle('right')} className={`absolute top-0 bottom-0 right-0 w-1 cursor-pointer transition-colors ${edges.right ? 'bg-red-500' : 'hover:bg-slate-200 dark:hover:bg-slate-500'}`}></div>
       <div onClick={() => toggle('bottom')} className={`absolute bottom-0 left-0 right-0 h-1 cursor-pointer transition-colors ${edges.bottom ? 'bg-red-500' : 'hover:bg-slate-200 dark:hover:bg-slate-500'}`}></div>
       <div onClick={() => toggle('left')} className={`absolute top-0 bottom-0 left-0 w-1 cursor-pointer transition-colors ${edges.left ? 'bg-red-500' : 'hover:bg-slate-200 dark:hover:bg-slate-500'}`}></div>
       <div className="w-2 h-2 rounded-full bg-slate-100 dark:bg-slate-600"></div>
    </div>
  );
};

export const InputForms: React.FC<InputFormsProps> = ({ items, setItems, stock, setStock, onImportCSV }) => {
  const [expandItems, setExpandItems] = useState(true);
  const [expandStock, setExpandStock] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'item' | 'stock' } | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const [newItem, setNewItem] = useState<Partial<CutItem>>({
    length: 80, width: 40, quantity: 1, name: '', material: 'Melamina Blanca', grain: false, edges: { top: false, right: false, bottom: false, left: false }
  });

  const [newStock, setNewStock] = useState<Partial<StockItem>>({
    length: 275, width: 183, quantity: 10, name: 'Placa Estándar', material: 'Melamina Blanca'
  });

  const nameInputRef = useRef<HTMLInputElement>(null);

  const updateItem = (id: string, field: keyof CutItem, value: any) => {
      setItems(prevItems => prevItems.map(item => {
          if (item.id === id) {
              return { ...item, [field]: value };
          }
          return item;
      }));
  };

  const handleAddItem = () => {
    setError(null);
    const length = Number(newItem.length);
    const width = Number(newItem.width);
    const qty = Number(newItem.quantity);

    if (!length || length <= 0) { setError("Longitud inválida"); return; }
    if (!width || width <= 0) { setError("Anchura inválida"); return; }
    if (!qty || qty <= 0 || !Number.isInteger(qty)) { setError("Cantidad inválida"); return; }
    
    const id = Math.random().toString(36).substr(2, 9);
    setItems(prev => [...prev, {
      ...newItem, id, name: newItem.name || `Pieza ${prev.length + 1}`,
      length, width, quantity: qty,
      edges: newItem.edges || { top: false, right: false, bottom: false, left: false },
      grain: newItem.grain || false, material: newItem.material || 'Melamina Blanca'
    } as CutItem]);

    setNewItem(prev => ({ ...prev, name: '', length: 0, width: 0, quantity: 1 }));
    if(nameInputRef.current) nameInputRef.current.focus();
  };

  const handleAddStock = () => {
    if (!newStock.length || !newStock.width || newStock.length <= 0 || newStock.width <= 0) return;
    const id = Math.random().toString(36).substr(2, 9);
    setStock(prev => [...prev, {
      ...newStock, id,
      length: Number(newStock.length), width: Number(newStock.width), quantity: Number(newStock.quantity),
      name: newStock.name || 'Stock'
    } as StockItem]);
  };

  const requestDeleteItem = (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); setDeleteTarget({ id, type: 'item' });
  };
  const requestDeleteStock = (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); setDeleteTarget({ id, type: 'stock' });
  };
  const confirmDelete = () => {
    if (deleteTarget) {
      if (deleteTarget.type === 'item') setItems(prev => prev.filter(i => i.id !== deleteTarget.id));
      else setStock(prev => prev.filter(s => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    }
  };
  const handleClearAllItems = () => { setItems([]); setConfirmClearAll(false); };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800 text-sm select-none relative">
      <div className="flex flex-col border-b border-slate-300 dark:border-slate-800 flex-grow-[2] min-h-0">
        <div className="bg-slate-200 dark:bg-slate-800 p-2 flex justify-between items-center cursor-pointer border-b border-slate-300 dark:border-slate-700 shadow-sm z-10" onClick={() => setExpandItems(!expandItems)}>
          <div className="flex items-center gap-2"><GripVertical size={14} className="text-slate-500" /><span className="font-bold text-slate-700 dark:text-slate-200 text-xs uppercase">Paneles (Piezas)</span></div>
          <div className="flex items-center gap-2">
             <button onClick={(e) => { e.stopPropagation(); setConfirmClearAll(true); }} className="cursor-pointer text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 transition-colors" title="Nuevo Proyecto (Borrar lista)"><FilePlus size={10} /> Nuevo</button>
             <label className="cursor-pointer text-xs text-blue-600 hover:underline flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600"><Upload size={10} /> CSV<input type="file" accept=".csv" className="hidden" onChange={onImportCSV} /></label>
             {expandItems ? <ChevronDown size={14} className="text-slate-500"/> : <ChevronRight size={14} className="text-slate-500"/>}
          </div>
        </div>
        {expandItems && (
          <div className="flex-1 flex flex-col min-h-0">
             <div className="grid grid-cols-12 gap-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 font-semibold uppercase tracking-wider text-center py-2 sticky top-0 z-10 shadow-sm">
                <div className="col-span-2 border-r border-slate-100 dark:border-slate-800">Longitud</div>
                <div className="col-span-2 border-r border-slate-100 dark:border-slate-800">Anchura</div>
                <div className="col-span-1 border-r border-slate-100 dark:border-slate-800">Cant</div>
                <div className="col-span-3 border-r border-slate-100 dark:border-slate-800">Etiqueta</div>
                <div className="col-span-3 border-r border-slate-100 dark:border-slate-800">Opciones</div>
                <div className="col-span-1"></div>
             </div>
             <div className="overflow-y-auto custom-scrollbar flex-1 bg-slate-50 dark:bg-black/20">
                {items.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-12 gap-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 items-center text-xs hover:bg-blue-50 dark:hover:bg-slate-800/50 group h-9">
                    <div className="col-span-2 border-r border-slate-100 dark:border-slate-800 h-full"><input type="number" className="w-full h-full text-center bg-transparent focus:bg-blue-50 dark:focus:bg-slate-800 outline-none font-mono text-slate-700 dark:text-slate-300" value={item.length} onChange={(e) => updateItem(item.id, 'length', Math.max(0.1, parseFloat(e.target.value)))} /></div>
                    <div className="col-span-2 border-r border-slate-100 dark:border-slate-800 h-full"><input type="number" className="w-full h-full text-center bg-transparent focus:bg-blue-50 dark:focus:bg-slate-800 outline-none font-mono text-slate-700 dark:text-slate-300" value={item.width} onChange={(e) => updateItem(item.id, 'width', Math.max(0.1, parseFloat(e.target.value)))} /></div>
                    <div className="col-span-1 border-r border-slate-100 dark:border-slate-800 h-full"><input type="number" className="w-full h-full text-center bg-transparent focus:bg-blue-50 dark:focus:bg-slate-800 outline-none font-bold" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))} /></div>
                    <div className="col-span-3 border-r border-slate-100 dark:border-slate-800 h-full"><input type="text" className="w-full h-full px-2 text-left bg-transparent focus:bg-blue-50 dark:focus:bg-slate-800 outline-none truncate text-slate-600 dark:text-slate-400" value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)} /></div>
                    <div className="col-span-3 flex justify-center items-center gap-2 border-r border-slate-100 dark:border-slate-800 h-full">
                       <button type="button" onClick={() => updateItem(item.id, 'grain', !item.grain)} className={`text-[10px] font-bold px-1 py-0.5 rounded border transition-colors ${item.grain ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-400 border-slate-200 opacity-50 hover:opacity-100'}`} title="Toggle Veta">VETA</button>
                       <CompactEdgeIndicator edges={item.edges} onChange={(newEdges) => updateItem(item.id, 'edges', newEdges)} />
                    </div>
                    <div className="col-span-1 flex justify-center"><button type="button" onClick={(e) => requestDeleteItem(item.id, e)} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={12} className="pointer-events-none" /></button></div>
                  </div>
                ))}
             </div>
             {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs px-2 py-1 flex items-center gap-2 border-t border-red-100 dark:border-red-900/30"><AlertCircle size={12} />{error}</div>}
             <div className="grid grid-cols-12 gap-1 p-1 bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 shadow-inner">
                <div className="col-span-2"><input type="number" placeholder="L" className={`w-full h-7 px-1 text-xs text-center border rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 ${error && (!newItem.length || newItem.length <= 0) ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-300'}`} value={newItem.length || ''} onChange={e => setNewItem({...newItem, length: parseFloat(e.target.value)})} onKeyDown={e => e.key === 'Enter' && handleAddItem()} /></div>
                <div className="col-span-2"><input type="number" placeholder="A" className={`w-full h-7 px-1 text-xs text-center border rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 ${error && (!newItem.width || newItem.width <= 0) ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-300'}`} value={newItem.width || ''} onChange={e => setNewItem({...newItem, width: parseFloat(e.target.value)})} onKeyDown={e => e.key === 'Enter' && handleAddItem()} /></div>
                <div className="col-span-1"><input type="number" placeholder="#" className="w-full h-7 px-1 text-xs text-center border border-slate-300 rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: parseFloat(e.target.value)})} onKeyDown={e => e.key === 'Enter' && handleAddItem()} /></div>
                <div className="col-span-3"><input ref={nameInputRef} type="text" placeholder="Etiqueta" className="w-full h-7 px-1 text-xs border border-slate-300 rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleAddItem()} /></div>
                <div className="col-span-3 flex items-center justify-center gap-1"><button type="button" onClick={() => setNewItem({...newItem, grain: !newItem.grain})} className={`h-7 px-2 flex items-center justify-center border rounded text-[10px] font-bold transition-colors ${newItem.grain ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-slate-300 text-slate-300 dark:bg-slate-700 dark:border-slate-600'}`} title="Respetar Veta">VETA</button><CompactEdgeIndicator edges={newItem.edges!} onChange={(e) => setNewItem({...newItem, edges: e})} /></div>
                <div className="col-span-1"><button onClick={handleAddItem} className="w-full h-7 bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center justify-center"><Plus size={16} /></button></div>
             </div>
          </div>
        )}
      </div>
      <div className="flex flex-col flex-grow-[1] min-h-0">
        <div className="bg-slate-200 dark:bg-slate-800 p-2 flex justify-between items-center cursor-pointer border-b border-t border-slate-300 dark:border-slate-700 shadow-sm" onClick={() => setExpandStock(!expandStock)}>
          <div className="flex items-center gap-2"><GripVertical size={14} className="text-slate-500" /><span className="font-bold text-slate-700 dark:text-slate-200 text-xs uppercase">Hojas en inventario (Stock)</span></div>
          {expandStock ? <ChevronDown size={14} className="text-slate-500"/> : <ChevronRight size={14} className="text-slate-500"/>}
        </div>
        {expandStock && (
          <div className="flex-1 flex flex-col min-h-0">
             <div className="grid grid-cols-12 gap-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 font-semibold uppercase tracking-wider text-center py-2 sticky top-0"><div className="col-span-3 border-r border-slate-100 dark:border-slate-800">Longitud</div><div className="col-span-3 border-r border-slate-100 dark:border-slate-800">Anchura</div><div className="col-span-2 border-r border-slate-100 dark:border-slate-800">Cant</div><div className="col-span-3 border-r border-slate-100 dark:border-slate-800">Nombre</div><div className="col-span-1"></div></div>
             <div className="overflow-y-auto custom-scrollbar flex-1 bg-slate-50 dark:bg-black/20">
                {stock.map(s => (
                  <div key={s.id} className="grid grid-cols-12 gap-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 items-center text-xs hover:bg-slate-50 dark:hover:bg-slate-800 h-8">
                    <div className="col-span-3 text-center border-r border-slate-100 dark:border-slate-800 font-mono text-slate-700 dark:text-slate-300">{s.length}</div>
                    <div className="col-span-3 text-center border-r border-slate-100 dark:border-slate-800 font-mono text-slate-700 dark:text-slate-300">{s.width}</div>
                    <div className="col-span-2 text-center border-r border-slate-100 dark:border-slate-800">{s.quantity}</div>
                    <div className="col-span-3 pl-2 truncate border-r border-slate-100 dark:border-slate-800 text-slate-500">{s.name}</div>
                    <div className="col-span-1 flex justify-center"><button onClick={(e) => requestDeleteStock(s.id, e)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={12} className="pointer-events-none" /></button></div>
                  </div>
                ))}
             </div>
             <div className="grid grid-cols-12 gap-1 p-1 bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 shadow-inner">
                <div className="col-span-3"><input type="number" placeholder="L" className="w-full h-7 px-1 text-xs text-center border border-slate-300 rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600" value={newStock.length} onChange={e => setNewStock({...newStock, length: parseFloat(e.target.value)})} /></div>
                <div className="col-span-3"><input type="number" placeholder="A" className="w-full h-7 px-1 text-xs text-center border border-slate-300 rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600" value={newStock.width} onChange={e => setNewStock({...newStock, width: parseFloat(e.target.value)})} /></div>
                <div className="col-span-2"><input type="number" placeholder="#" className="w-full h-7 px-1 text-xs text-center border border-slate-300 rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600" value={newStock.quantity} onChange={e => setNewStock({...newStock, quantity: parseFloat(e.target.value)})} /></div>
                <div className="col-span-3"><input type="text" placeholder="Ref" className="w-full h-7 px-1 text-xs border border-slate-300 rounded focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600" value={newStock.name} onChange={e => setNewStock({...newStock, name: e.target.value})} /></div>
                <div className="col-span-1"><button onClick={handleAddStock} className="w-full h-7 bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center justify-center"><Plus size={16} /></button></div>
             </div>
          </div>
        )}
      </div>
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-sm p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
             <div className="flex items-center gap-3 text-red-600 dark:text-red-400"><div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full"><Trash2 size={24} /></div><h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Confirmar eliminación</h3></div>
             <p className="text-slate-600 dark:text-slate-400 text-sm">¿Desea borrar estas piezas? Esta acción no se puede deshacer.</p>
             <div className="flex justify-end gap-3 mt-2"><button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">Cancelar</button><button onClick={confirmDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors shadow-sm">Borrar</button></div>
          </div>
        </div>
      )}
      {confirmClearAll && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-sm p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
             <div className="flex items-center gap-3 text-red-600 dark:text-red-400"><div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full"><Trash2 size={24} /></div><h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">¿Limpiar lista?</h3></div>
             <p className="text-slate-600 dark:text-slate-400 text-sm">Se eliminarán todas las piezas de la lista de cortes. Esta acción no se puede deshacer.</p>
             <div className="flex justify-end gap-3 mt-2"><button onClick={() => setConfirmClearAll(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">Cancelar</button><button onClick={handleClearAllItems} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors shadow-sm">Confirmar</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
