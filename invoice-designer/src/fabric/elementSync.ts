import {
  Canvas,
  Circle,
  FabricImage,
  FabricObject,
  Group,
  IText,
  Line,
  Rect,
  Textbox,
} from 'fabric';
import type { DesignElement, InvoiceData } from '../types';
import { placeholderLabel, resolvePlaceholder } from '../tokens';
import { uid } from '../constants';

export const ELEMENT_KEY = 'designElementId';

export function fabricObjectToElement(obj: FabricObject, base?: DesignElement): DesignElement {
  const id = (obj.get(ELEMENT_KEY) as string) || base?.id || uid();
  const type = (obj.get('elementType') as DesignElement['type']) || base?.type || 'text';
  const angle = obj.angle ?? 0;
  const opacity = obj.opacity ?? 1;
  const left = obj.left ?? 0;
  const top = obj.top ?? 0;
  const w = (obj.width ?? 0) * (obj.scaleX ?? 1);
  const h = (obj.height ?? 0) * (obj.scaleY ?? 1);

  const common: DesignElement = {
    id,
    type,
    name: (obj.get('elementName') as string) || base?.name || type,
    x: left,
    y: top,
    width: w,
    height: h,
    angle,
    opacity,
    locked: !obj.selectable,
    visible: obj.visible !== false,
    zIndex: base?.zIndex ?? 0,
    fill: (obj.fill as string) ?? base?.fill,
    stroke: (obj.stroke as string) ?? base?.stroke,
    strokeWidth: obj.strokeWidth ?? base?.strokeWidth,
    fontFamily: (obj.get('fontFamily') as string) ?? base?.fontFamily,
    fontSize: (obj.get('fontSize') as number) ?? base?.fontSize,
    fontWeight: (obj.get('fontWeight') as string) ?? base?.fontWeight,
    fontStyle: (obj.get('fontStyle') as string) ?? base?.fontStyle,
    textAlign: (obj.get('textAlign') as DesignElement['textAlign']) ?? base?.textAlign,
    lineHeight: (obj.get('lineHeight') as number) ?? base?.lineHeight,
    charSpacing: (obj.get('charSpacing') as number) ?? base?.charSpacing,
    underline: !!obj.get('underline'),
    text: base?.text,
    placeholder: (obj.get('placeholder') as string) ?? base?.placeholder,
    src: (obj.get('imageSrc') as string) ?? base?.src,
    columns: base?.columns,
    showHeader: base?.showHeader,
    showTotals: base?.showTotals,
    headerBg: base?.headerBg,
    headerColor: base?.headerColor,
    borderColor: base?.borderColor,
    rowHeight: base?.rowHeight,
  };

  if (obj instanceof IText || obj instanceof Textbox) {
    common.text = obj.text ?? '';
    common.fill = (obj.fill as string) ?? '#333333';
    common.fontFamily = obj.fontFamily ?? 'Inter';
    common.fontSize = obj.fontSize ?? 14;
    common.fontWeight = String(obj.fontWeight ?? '400');
    common.fontStyle = obj.fontStyle ?? 'normal';
    common.textAlign = (obj.textAlign as DesignElement['textAlign']) ?? 'left';
    common.lineHeight = obj.lineHeight ?? 1.2;
    common.charSpacing = obj.charSpacing ?? 0;
    common.underline = !!obj.underline;
  }

  return common;
}

function tablePreviewText(el: DesignElement): string {
  const cols = el.columns ?? [];
  const header = cols.map((c) => c.label).join(' | ');
  return `[Items Table]\n${header}\n— line items from accounting —`;
}

export async function elementToFabricObject(
  el: DesignElement,
  preview = true,
  data?: InvoiceData
): Promise<FabricObject> {
  const common = {
    left: el.x,
    top: el.y,
    angle: el.angle,
    opacity: el.opacity,
    selectable: !el.locked,
    visible: el.visible,
    fill: el.fill ?? '#333333',
    stroke: el.stroke,
    strokeWidth: el.strokeWidth ?? 0,
  };

  const setMeta = (obj: FabricObject) => {
    obj.set({
      [ELEMENT_KEY]: el.id,
      elementType: el.type,
      elementName: el.name,
      placeholder: el.placeholder,
      fontFamily: el.fontFamily,
      fontSize: el.fontSize,
      fontWeight: el.fontWeight,
      fontStyle: el.fontStyle,
      textAlign: el.textAlign,
      lineHeight: el.lineHeight,
      charSpacing: el.charSpacing,
      underline: el.underline,
    });
    if (el.type !== 'line') {
      obj.setControlsVisibility({
        mt: true,
        mb: true,
        ml: true,
        mr: true,
        mtr: true,
      });
    }
    return obj;
  };

  if (el.type === 'rect') {
    return setMeta(
      new Rect({
        ...common,
        width: el.width,
        height: el.height,
        fill: el.fill ?? '#e8f4fd',
        stroke: el.stroke ?? '#2389d6',
        strokeWidth: el.strokeWidth ?? 1,
      })
    );
  }

  if (el.type === 'circle') {
    return setMeta(
      new Circle({
        ...common,
        radius: Math.min(el.width, el.height) / 2,
        fill: el.fill ?? '#e8f4fd',
        stroke: el.stroke ?? '#2389d6',
        strokeWidth: el.strokeWidth ?? 1,
      })
    );
  }

  if (el.type === 'line') {
    return setMeta(
      new Line([el.x, el.y, el.x + el.width, el.y], {
        stroke: el.stroke ?? '#999999',
        strokeWidth: el.strokeWidth ?? 2,
        selectable: !el.locked,
        visible: el.visible,
        opacity: el.opacity,
        [ELEMENT_KEY]: el.id,
        elementType: el.type,
        elementName: el.name,
      } as never)
    );
  }

  if (el.type === 'image' || (el.type === 'placeholder' && el.placeholder === 'company_logo')) {
    const src = el.src || (data?.company_logo as string) || '';
    if (src) {
      try {
        const img = await FabricImage.fromURL(src, { crossOrigin: 'anonymous' });
        img.set({
          ...common,
          scaleX: el.width / (img.width || 1),
          scaleY: el.height / (img.height || 1),
          imageSrc: src,
        });
        return setMeta(img);
      } catch {
        /* fall through to placeholder rect */
      }
    }
    return setMeta(
      new Rect({
        ...common,
        width: el.width,
        height: el.height,
        fill: '#f0f0f0',
        stroke: '#cccccc',
        strokeWidth: 1,
        strokeDashArray: [6, 4],
      })
    );
  }

  if (el.type === 'itemsTable') {
    const text = preview
      ? tablePreviewText(el)
      : tablePreviewText(el);
    const tb = new Textbox(text, {
      ...common,
      width: el.width,
      height: el.height,
      fontSize: el.fontSize ?? 12,
      fontFamily: el.fontFamily ?? 'Inter',
      fill: el.fill ?? '#333333',
      backgroundColor: '#fafafa',
      editable: false,
    });
    tb.set('tableElement', true);
    return setMeta(tb);
  }

  let content = el.text ?? '';
  if (el.type === 'placeholder' && el.placeholder) {
    if (preview) {
      content = placeholderLabel(el.placeholder);
      if (data) {
        const resolved = resolvePlaceholder(el.placeholder, data);
        if (resolved) content = resolved;
      }
    } else if (data && el.placeholder !== 'items_table') {
      content = resolvePlaceholder(el.placeholder, data) || placeholderLabel(el.placeholder);
    } else {
      content = placeholderLabel(el.placeholder);
    }
  }

  const textObj = new Textbox(content, {
    ...common,
    width: el.width,
    fontSize: el.fontSize ?? 14,
    fontFamily: el.fontFamily ?? 'Inter',
    fontWeight: el.fontWeight ?? '400',
    fontStyle: el.fontStyle ?? 'normal',
    textAlign: el.textAlign ?? 'left',
    lineHeight: el.lineHeight ?? 1.2,
    charSpacing: el.charSpacing ?? 0,
    underline: el.underline ?? false,
    editable: el.type === 'text',
  });

  if (el.type === 'placeholder') {
    textObj.set({
      backgroundColor: 'rgba(35,137,214,0.08)',
      editable: false,
    });
  }

  return setMeta(textObj);
}

export async function loadDesignOntoCanvas(
  canvas: Canvas,
  elements: DesignElement[],
  preview = true,
  data?: InvoiceData
) {
  canvas.clear();
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const el of sorted) {
    const obj = await elementToFabricObject(el, preview, data);
    canvas.add(obj);
  }
  canvas.requestRenderAll();
}

export function syncCanvasToElements(canvas: Canvas, elements: DesignElement[]): DesignElement[] {
  const map = new Map(elements.map((e) => [e.id, e]));
  const updated: DesignElement[] = [];

  canvas.getObjects().forEach((obj, index) => {
    const id = obj.get(ELEMENT_KEY) as string;
    const base = map.get(id);
    const el = fabricObjectToElement(obj, base);
    el.zIndex = index;
    updated.push(el);
  });

  return updated;
}

export function bringForward(canvas: Canvas, id: string) {
  const obj = canvas.getObjects().find((o) => o.get(ELEMENT_KEY) === id);
  if (obj) {
    canvas.bringObjectForward(obj);
    canvas.requestRenderAll();
  }
}

export function sendBackward(canvas: Canvas, id: string) {
  const obj = canvas.getObjects().find((o) => o.get(ELEMENT_KEY) === id);
  if (obj) {
    canvas.sendObjectBackwards(obj);
    canvas.requestRenderAll();
  }
}

export function duplicateObject(canvas: Canvas, id: string, elements: DesignElement[]): DesignElement | null {
  const el = elements.find((e) => e.id === id);
  if (!el) return null;
  const copy = { ...structuredClone(el), id: uid(), name: `${el.name} copy`, x: el.x + 16, y: el.y + 16 };
  return copy;
}
