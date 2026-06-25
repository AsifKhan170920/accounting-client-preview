import type { DesignElement } from '../types';

interface Props {
  elements: DesignElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
}

export function LayersPanel({ elements, selectedId, onSelect, onReorder, onToggleVisible, onToggleLock }: Props) {
  const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);

  if (!sorted.length) {
    return <div className="id-empty">No layers yet — add elements from the left panel</div>;
  }

  return (
    <div>
      {sorted.map((el) => (
        <div
          key={el.id}
          className={`id-layer-item${selectedId === el.id ? ' active' : ''}`}
          onClick={() => onSelect(el.id)}
        >
          <span>{el.visible ? '👁' : '🚫'}</span>
          <span className="name">{el.name}</span>
          <div className="id-layer-actions" onClick={(e) => e.stopPropagation()}>
            <button type="button" title="Move up" onClick={() => onReorder(el.id, 'up')}>↑</button>
            <button type="button" title="Move down" onClick={() => onReorder(el.id, 'down')}>↓</button>
            <button type="button" title="Toggle visibility" onClick={() => onToggleVisible(el.id)}>{el.visible ? '◌' : '●'}</button>
            <button type="button" title="Toggle lock" onClick={() => onToggleLock(el.id)}>{el.locked ? '🔒' : '🔓'}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
