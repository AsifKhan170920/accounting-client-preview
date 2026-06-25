import { useCallback, useMemo, useRef, useState } from 'react';
import type { Canvas } from 'fabric';
import type { DesignElement, DesignerMountOptions, InvoiceDesign } from '../types';
import { HistoryStack } from '../utils/history';
import { createDefaultInvoiceTemplate, TEMPLATE_PRESETS } from '../templates';
import { duplicateObject, elementToFabricObject, syncCanvasToElements } from '../fabric/elementSync';
import { renderDesignPrintDocument } from '../render/renderDesign';
import { sampleInvoiceData } from '../tokens';
import { DesignerCanvas } from './DesignerCanvas';
import { ElementsPanel } from './ElementsPanel';
import { LayersPanel } from './LayersPanel';
import { PropertiesPanel } from './PropertiesPanel';
import '../styles.css';

type Tab = 'elements' | 'layers';

export function InvoiceDesigner({
  businessId,
  docKey,
  design: initialDesign,
  sampleData,
  onSave,
  onExit,
}: DesignerMountOptions) {
  const [design, setDesign] = useState<InvoiceDesign>(
    () => initialDesign ?? createDefaultInvoiceTemplate()
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('elements');
  const [rightTab, setRightTab] = useState<'properties' | 'layers'>('properties');
  const [reloadKey, setReloadKey] = useState(0);
  const canvasRef = useRef<Canvas | null>(null);
  const historyRef = useRef(new HistoryStack<DesignElement[]>());

  const previewData = sampleData ?? sampleInvoiceData();
  const selected = design.elements.find((e) => e.id === selectedId) ?? null;

  const updateElements = useCallback((elements: DesignElement[], recordHistory = false) => {
    if (recordHistory) historyRef.current.push(design.elements);
    setDesign((d) => ({ ...d, elements, updatedAt: new Date().toISOString() }));
  }, [design.elements]);

  const handleAddElement = useCallback(async (el: DesignElement) => {
    const canvas = canvasRef.current;
    const next = [...design.elements, { ...el, zIndex: design.elements.length }];
    historyRef.current.push(design.elements);
    setDesign((d) => ({ ...d, elements: next, updatedAt: new Date().toISOString() }));
    setSelectedId(el.id);
    if (canvas) {
      const obj = await elementToFabricObject(el, true, previewData);
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
    }
  }, [design.elements, previewData]);

  const patchSelected = useCallback(async (patch: Partial<DesignElement>) => {
    if (!selectedId) return;
    historyRef.current.push(design.elements);
    const next = design.elements.map((e) => (e.id === selectedId ? { ...e, ...patch } : e));
    setDesign((d) => ({ ...d, elements: next, updatedAt: new Date().toISOString() }));

    const canvas = canvasRef.current;
    if (canvas) {
      const el = next.find((e) => e.id === selectedId);
      if (el) {
        const idx = canvas.getObjects().findIndex((o) => o.get('designElementId') === selectedId);
        if (idx >= 0) canvas.remove(canvas.item(idx));
        const obj = await elementToFabricObject(el, true, previewData);
        canvas.add(obj);
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
        const synced = syncCanvasToElements(canvas, next);
        setDesign((d) => ({ ...d, elements: synced }));
        setReloadKey((k) => k + 1);
      }
    }
  }, [selectedId, design.elements, previewData]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    historyRef.current.push(design.elements);
    const canvas = canvasRef.current;
    const obj = canvas?.getObjects().find((o) => o.get('designElementId') === selectedId);
    if (obj && canvas) {
      canvas.remove(obj);
      canvas.requestRenderAll();
    }
    const next = design.elements.filter((e) => e.id !== selectedId);
    setDesign((d) => ({ ...d, elements: next, updatedAt: new Date().toISOString() }));
    setSelectedId(null);
  }, [selectedId, design.elements]);

  const duplicateSelected = useCallback(async () => {
    if (!selectedId) return;
    const copy = duplicateObject(canvasRef.current!, selectedId, design.elements);
    if (!copy) return;
    await handleAddElement(copy);
  }, [selectedId, design.elements, handleAddElement]);

  const toggleLock = useCallback((id?: string) => {
    const targetId = id ?? selectedId;
    if (!targetId) return;
    historyRef.current.push(design.elements);
    const next = design.elements.map((e) =>
      e.id === targetId ? { ...e, locked: !e.locked } : e
    );
    setDesign((d) => ({ ...d, elements: next, updatedAt: new Date().toISOString() }));
    const canvas = canvasRef.current;
    const obj = canvas?.getObjects().find((o) => o.get('designElementId') === targetId);
    if (obj) {
      obj.selectable = !obj.selectable;
      canvas?.requestRenderAll();
    }
  }, [selectedId, design.elements]);

  const toggleVisible = useCallback((id: string) => {
    historyRef.current.push(design.elements);
    const next = design.elements.map((e) => (e.id === id ? { ...e, visible: !e.visible } : e));
    setDesign((d) => ({ ...d, elements: next, updatedAt: new Date().toISOString() }));
  }, [design.elements]);

  const reorderLayer = useCallback((id: string, direction: 'up' | 'down') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obj = canvas.getObjects().find((o) => o.get('designElementId') === id);
    if (!obj) return;
    historyRef.current.push(design.elements);
    if (direction === 'up') canvas.bringObjectForward(obj);
    else canvas.sendObjectBackwards(obj);
    canvas.requestRenderAll();
    const synced = syncCanvasToElements(canvas, design.elements);
    setDesign((d) => ({ ...d, elements: synced, updatedAt: new Date().toISOString() }));
  }, [design.elements]);

  const undo = useCallback(() => {
    const prev = historyRef.current.undo(design.elements);
    if (prev) {
      setDesign((d) => ({ ...d, elements: prev, updatedAt: new Date().toISOString() }));
      setReloadKey((k) => k + 1);
    }
  }, [design.elements]);

  const redo = useCallback(() => {
    const next = historyRef.current.redo(design.elements);
    if (next) {
      setDesign((d) => ({ ...d, elements: next, updatedAt: new Date().toISOString() }));
      setReloadKey((k) => k + 1);
    }
  }, [design.elements]);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    const elements = canvas ? syncCanvasToElements(canvas, design.elements) : design.elements;
    const saved: InvoiceDesign = {
      ...design,
      elements,
      updatedAt: new Date().toISOString(),
    };
    onSave(saved);
  }, [design, onSave]);

  const handlePreview = useCallback(() => {
    const canvas = canvasRef.current;
    const elements = canvas ? syncCanvasToElements(canvas, design.elements) : design.elements;
    const html = renderDesignPrintDocument({ page: design.page, elements }, previewData, design.name);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }, [design, previewData]);

  const loadTemplate = useCallback((presetId: string) => {
    const preset = TEMPLATE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    if (!design.elements.length || confirm('Replace current design with this template?')) {
      historyRef.current.push(design.elements);
      setDesign(preset.factory());
      setSelectedId(null);
      setReloadKey((k) => k + 1);
    }
  }, [design.elements]);

  const canUndo = historyRef.current.canUndo();
  const canRedo = historyRef.current.canRedo();

  return (
    <div className="invoice-designer">
      <div className="id-topbar">
        <div className="brand">
          <div className="mark">✎</div>
          <span>Invoice Designer</span>
        </div>
        <input
          type="text"
          value={design.name}
          onChange={(e) => setDesign((d) => ({ ...d, name: e.target.value }))}
          style={{ border: '1px solid #3a4150', background: '#252a33', color: '#fff', borderRadius: 6, padding: '6px 10px', fontSize: 12, minWidth: 180 }}
        />
        <select className="id-template-select" onChange={(e) => { loadTemplate(e.target.value); e.target.value = ''; }} defaultValue="">
          <option value="" disabled>Load template…</option>
          {TEMPLATE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <span style={{ fontSize: 11, color: '#9aa3b2' }}>{docKey} · {businessId.slice(0, 8)}</span>
        <div className="spacer" />
        <button type="button" className="id-btn" disabled={!canUndo} onClick={undo}>↶ Undo</button>
        <button type="button" className="id-btn" disabled={!canRedo} onClick={redo}>↷ Redo</button>
        <button type="button" className="id-btn" onClick={handlePreview}>Preview</button>
        <button type="button" className="id-btn primary" onClick={handleSave}>Save design</button>
        <button type="button" className="id-btn" onClick={onExit}>Close</button>
      </div>

      <div className="id-body">
        <aside className="id-panel">
          <div className="id-panel-head">Add elements</div>
          <div className="id-panel-body">
            <ElementsPanel onAddElement={handleAddElement} />
          </div>
        </aside>

        <section className="id-canvas-area">
          <div className="id-canvas-toolbar">
            <label>
              <input
                type="checkbox"
                checked={design.grid.enabled}
                onChange={(e) => setDesign((d) => ({ ...d, grid: { ...d.grid, enabled: e.target.checked } }))}
              />
              Grid
            </label>
            <label>
              <input
                type="checkbox"
                checked={design.grid.snap}
                onChange={(e) => setDesign((d) => ({ ...d, grid: { ...d.grid, snap: e.target.checked } }))}
              />
              Snap
            </label>
            <label>
              Grid size
              <input
                type="number"
                min={5}
                max={50}
                value={design.grid.size}
                onChange={(e) => setDesign((d) => ({ ...d, grid: { ...d.grid, size: +e.target.value } }))}
                style={{ width: 48, marginLeft: 4 }}
              />
            </label>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#888' }}>
              A4 · {design.page.width}×{design.page.height}px · Double-click text to edit
            </span>
          </div>
          <div className="id-canvas-scroll">
            <DesignerCanvas
              design={design}
              reloadKey={reloadKey}
              sampleData={previewData}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onElementsChange={updateElements}
              onCanvasReady={(c) => { canvasRef.current = c; }}
            />
          </div>
        </section>

        <aside className="id-panel id-panel-right">
          <div className="id-panel-head id-panel-tabs">
            <button type="button" className={`id-tab-btn${rightTab === 'properties' ? ' active' : ''}`} onClick={() => setRightTab('properties')}>Properties</button>
            <button type="button" className={`id-tab-btn${rightTab === 'layers' ? ' active' : ''}`} onClick={() => setRightTab('layers')}>Layers</button>
          </div>
          <div className="id-panel-body">
            {rightTab === 'properties' ? (
              <PropertiesPanel
                element={selected}
                onChange={patchSelected}
                onDelete={deleteSelected}
                onDuplicate={duplicateSelected}
                onToggleLock={() => toggleLock()}
              />
            ) : (
              <LayersPanel
                elements={design.elements}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onReorder={reorderLayer}
                onToggleVisible={toggleVisible}
                onToggleLock={toggleLock}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
