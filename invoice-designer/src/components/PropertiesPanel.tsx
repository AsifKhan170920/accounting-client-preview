import { PLACEHOLDERS, type DesignElement } from '../types';
import { FONT_FAMILIES } from '../constants';

interface Props {
  element: DesignElement | null;
  onChange: (patch: Partial<DesignElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleLock: () => void;
}

export function PropertiesPanel({ element, onChange, onDelete, onDuplicate, onToggleLock }: Props) {
  if (!element) {
    return <div className="id-empty">Select an element to edit its properties</div>;
  }

  const isText = element.type === 'text' || element.type === 'placeholder';
  const isTable = element.type === 'itemsTable';

  return (
    <div>
      <div className="id-field">
        <label>Name</label>
        <input value={element.name} onChange={(e) => onChange({ name: e.target.value })} />
      </div>

      <div className="id-row">
        <div className="id-field">
          <label>X</label>
          <input type="number" value={Math.round(element.x)} onChange={(e) => onChange({ x: +e.target.value })} />
        </div>
        <div className="id-field">
          <label>Y</label>
          <input type="number" value={Math.round(element.y)} onChange={(e) => onChange({ y: +e.target.value })} />
        </div>
      </div>

      <div className="id-row">
        <div className="id-field">
          <label>Width</label>
          <input type="number" value={Math.round(element.width)} onChange={(e) => onChange({ width: +e.target.value })} />
        </div>
        <div className="id-field">
          <label>Height</label>
          <input type="number" value={Math.round(element.height)} onChange={(e) => onChange({ height: +e.target.value })} />
        </div>
      </div>

      <div className="id-field">
        <label>Rotation (°)</label>
        <input type="number" value={Math.round(element.angle)} onChange={(e) => onChange({ angle: +e.target.value })} />
      </div>

      <div className="id-field">
        <label>Opacity</label>
        <input type="range" min={0.1} max={1} step={0.05} value={element.opacity} onChange={(e) => onChange({ opacity: +e.target.value })} />
      </div>

      {isText && element.type === 'text' && (
        <div className="id-field">
          <label>Text</label>
          <textarea rows={3} value={element.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
        </div>
      )}

      {element.type === 'placeholder' && (
        <div className="id-field">
          <label>Placeholder</label>
          <select value={element.placeholder ?? ''} onChange={(e) => onChange({ placeholder: e.target.value })}>
            {PLACEHOLDERS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>
      )}

      {(isText || isTable) && (
        <>
          <div className="id-section-title">Typography</div>
          <div className="id-field">
            <label>Font</label>
            <select value={element.fontFamily ?? 'Inter'} onChange={(e) => onChange({ fontFamily: e.target.value })}>
              {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="id-row">
            <div className="id-field">
              <label>Size</label>
              <input type="number" min={8} max={96} value={element.fontSize ?? 14} onChange={(e) => onChange({ fontSize: +e.target.value })} />
            </div>
            <div className="id-field">
              <label>Color</label>
              <input type="color" value={element.fill ?? '#333333'} onChange={(e) => onChange({ fill: e.target.value })} />
            </div>
          </div>
          <div className="id-field">
            <label>Align</label>
            <select value={element.textAlign ?? 'left'} onChange={(e) => onChange({ textAlign: e.target.value as DesignElement['textAlign'] })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
              <option value="justify">Justify</option>
            </select>
          </div>
          <div className="id-row">
            <label><input type="checkbox" checked={element.fontWeight === '700'} onChange={(e) => onChange({ fontWeight: e.target.checked ? '700' : '400' })} /> Bold</label>
            <label><input type="checkbox" checked={element.fontStyle === 'italic'} onChange={(e) => onChange({ fontStyle: e.target.checked ? 'italic' : 'normal' })} /> Italic</label>
            <label><input type="checkbox" checked={!!element.underline} onChange={(e) => onChange({ underline: e.target.checked })} /> Underline</label>
          </div>
          <div className="id-field">
            <label>Line height</label>
            <input type="number" step={0.1} min={0.8} max={3} value={element.lineHeight ?? 1.2} onChange={(e) => onChange({ lineHeight: +e.target.value })} />
          </div>
          <div className="id-field">
            <label>Letter spacing</label>
            <input type="number" value={element.charSpacing ?? 0} onChange={(e) => onChange({ charSpacing: +e.target.value })} />
          </div>
        </>
      )}

      {(element.type === 'rect' || element.type === 'circle' || element.type === 'line') && (
        <>
          <div className="id-section-title">Shape</div>
          <div className="id-field">
            <label>Fill</label>
            <input type="color" value={element.fill ?? '#e8f4fd'} onChange={(e) => onChange({ fill: e.target.value })} />
          </div>
          <div className="id-field">
            <label>Stroke</label>
            <input type="color" value={element.stroke ?? '#2389d6'} onChange={(e) => onChange({ stroke: e.target.value })} />
          </div>
          <div className="id-field">
            <label>Stroke width</label>
            <input type="number" min={0} max={20} value={element.strokeWidth ?? 1} onChange={(e) => onChange({ strokeWidth: +e.target.value })} />
          </div>
        </>
      )}

      {(element.type === 'image' || element.placeholder === 'company_logo') && (
        <div className="id-field">
          <label>Image URL / upload</label>
          <input type="text" placeholder="Paste image URL or use upload below" value={element.src ?? ''} onChange={(e) => onChange({ src: e.target.value })} />
          <input type="file" accept="image/*" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => onChange({ src: String(reader.result) });
            reader.readAsDataURL(file);
          }} />
        </div>
      )}

      {isTable && element.columns && (
        <>
          <div className="id-section-title">Table columns</div>
          <div className="id-table-cols">
            {element.columns.map((col, i) => (
              <div key={col.id} className="id-table-col-row">
                <input value={col.label} onChange={(e) => {
                  const columns = [...(element.columns ?? [])];
                  columns[i] = { ...col, label: e.target.value };
                  onChange({ columns });
                }} />
                <input type="number" value={col.width} onChange={(e) => {
                  const columns = [...(element.columns ?? [])];
                  columns[i] = { ...col, width: +e.target.value };
                  onChange({ columns });
                }} />
                <select value={col.align} onChange={(e) => {
                  const columns = [...(element.columns ?? [])];
                  columns[i] = { ...col, align: e.target.value as typeof col.align };
                  onChange({ columns });
                }}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
                <button type="button" className="id-btn" onClick={() => onChange({ columns: element.columns!.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
          </div>
          <button type="button" className="id-btn" style={{ marginTop: 8, width: '100%' }} onClick={() => {
            const columns = [...(element.columns ?? []), { id: `col_${Date.now()}`, key: 'custom', label: 'Column', width: 15, align: 'left' as const }];
            onChange({ columns });
          }}>+ Add column</button>
          <div className="id-field" style={{ marginTop: 10 }}>
            <label>Header background</label>
            <input type="color" value={element.headerBg ?? '#2389d6'} onChange={(e) => onChange({ headerBg: e.target.value })} />
          </div>
        </>
      )}

      <div className="id-section-title">Actions</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button type="button" className="id-btn" onClick={onDuplicate}>Duplicate</button>
        <button type="button" className="id-btn" onClick={onToggleLock}>{element.locked ? 'Unlock' : 'Lock'}</button>
        <button type="button" className="id-btn danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
