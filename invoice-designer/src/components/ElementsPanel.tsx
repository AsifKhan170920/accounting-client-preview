import { PLACEHOLDERS, type DesignElement } from '../types';
import { ELEMENT_TOOLS, createElement, createPlaceholderElement } from '../utils/elements';
import type { PlaceholderKey } from '../types';

interface Props {
  onAddElement: (el: DesignElement) => void;
}

export function ElementsPanel({ onAddElement }: Props) {
  return (
    <div>
      <div className="id-elements-grid">
        {ELEMENT_TOOLS.map((tool) => (
          <button
            key={tool.type}
            type="button"
            className="id-element-btn"
            onClick={() => onAddElement(createElement(tool.type))}
          >
            <span className="ico">{tool.icon}</span>
            {tool.label}
          </button>
        ))}
      </div>

      <div className="id-section-title">Data placeholders</div>
      <div className="id-placeholder-list">
        {PLACEHOLDERS.map((p) => (
          <button
            key={p.key}
            type="button"
            className="id-placeholder-btn"
            onClick={() => onAddElement(createPlaceholderElement(p.key as PlaceholderKey))}
          >
            {p.label}<br />
            <code>{'{{' + p.key + '}}'}</code>
          </button>
        ))}
      </div>
    </div>
  );
}
