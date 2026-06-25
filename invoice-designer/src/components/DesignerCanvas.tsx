import { useEffect, useRef, useCallback } from 'react';
import { Canvas, FabricObject, IText, Textbox } from 'fabric';
import type { DesignElement, InvoiceData, InvoiceDesign } from '../types';
import {
  ELEMENT_KEY,
  elementToFabricObject,
  loadDesignOntoCanvas,
  syncCanvasToElements,
} from '../fabric/elementSync';
import { snapPoint } from '../utils/snapping';
import { A4_WIDTH, A4_HEIGHT } from '../constants';

interface Props {
  design: InvoiceDesign;
  reloadKey: number;
  sampleData?: InvoiceData;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onElementsChange: (elements: DesignElement[], recordHistory?: boolean) => void;
  onCanvasReady: (canvas: Canvas) => void;
}

export function DesignerCanvas({
  design,
  reloadKey,
  sampleData,
  selectedId,
  onSelect,
  onElementsChange,
  onCanvasReady,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const syncingRef = useRef(false);
  const elementsRef = useRef(design.elements);

  useEffect(() => {
    elementsRef.current = design.elements;
  }, [design.elements]);

  const syncFromCanvas = useCallback(
    (recordHistory = true) => {
      const canvas = fabricRef.current;
      if (!canvas || syncingRef.current) return;
      const updated = syncCanvasToElements(canvas, elementsRef.current);
      elementsRef.current = updated;
      onElementsChange(updated, recordHistory);
    },
    [onElementsChange]
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = new Canvas(canvasRef.current, {
      width: design.page.width,
      height: design.page.height,
      backgroundColor: design.page.background,
      preserveObjectStacking: true,
      selection: true,
    });

    fabricRef.current = canvas;
    onCanvasReady(canvas);

    canvas.on('selection:created', (e) => {
      const obj = e.selected?.[0] as FabricObject | undefined;
      onSelect(obj ? (obj.get(ELEMENT_KEY) as string) : null);
    });
    canvas.on('selection:updated', (e) => {
      const obj = e.selected?.[0] as FabricObject | undefined;
      onSelect(obj ? (obj.get(ELEMENT_KEY) as string) : null);
    });
    canvas.on('selection:cleared', () => onSelect(null));

    canvas.on('object:modified', () => syncFromCanvas(true));
    canvas.on('object:moving', (e) => {
      const obj = e.target;
      if (!obj || !design.grid.snap) return;
      const snapped = snapPoint(obj.left ?? 0, obj.top ?? 0, design.grid.size, design.grid.enabled);
      obj.set({ left: snapped.x, top: snapped.y });
      obj.setCoords();
    });

    canvas.on('text:changed', () => syncFromCanvas(true));

    canvas.on('mouse:dblclick', (opt) => {
      const target = opt.target;
      if (target instanceof IText || target instanceof Textbox) {
        const type = target.get('elementType');
        if (type === 'text') {
          target.enterEditing();
          target.selectAll();
        }
      }
    });

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    (async () => {
      syncingRef.current = true;
      await loadDesignOntoCanvas(canvas, design.elements, true, sampleData);
      if (selectedId) {
        const obj = canvas.getObjects().find((o) => o.get(ELEMENT_KEY) === selectedId);
        if (obj) canvas.setActiveObject(obj);
      }
      canvas.requestRenderAll();
      syncingRef.current = false;
    })();
  }, [reloadKey, sampleData]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.backgroundColor = design.page.background;
    canvas.setDimensions({ width: design.page.width, height: design.page.height });
    canvas.requestRenderAll();
  }, [design.page.background, design.page.width, design.page.height]);

  // Draw grid overlay via CSS background on wrapper instead of fabric

  return (
    <div
      className="id-canvas-wrap"
      style={{
        width: design.page.width,
        height: design.page.height,
        backgroundImage: design.grid.enabled
          ? `linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)`
          : undefined,
        backgroundSize: design.grid.enabled ? `${design.grid.size}px ${design.grid.size}px` : undefined,
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

export { A4_WIDTH, A4_HEIGHT };
