import { uid } from '../constants';
import type { DesignElement, PlaceholderKey } from '../types';

export const ELEMENT_TOOLS = [
  { type: 'text' as const, label: 'Text', icon: 'T' },
  { type: 'rect' as const, label: 'Rectangle', icon: '▭' },
  { type: 'circle' as const, label: 'Circle', icon: '●' },
  { type: 'line' as const, label: 'Line', icon: '—' },
  { type: 'image' as const, label: 'Image', icon: '🖼' },
  { type: 'itemsTable' as const, label: 'Items Table', icon: '▦' },
];

export function createElement(type: DesignElement['type'], opts?: Partial<DesignElement>): DesignElement {
  const base: DesignElement = {
    id: uid(),
    type,
    name: type,
    x: 80,
    y: 80,
    width: type === 'line' ? 200 : 180,
    height: type === 'line' ? 2 : type === 'circle' ? 80 : 40,
    angle: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 0,
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    fontStyle: 'normal',
    textAlign: 'left',
    fill: '#333333',
    stroke: '#2389d6',
    strokeWidth: 1,
    lineHeight: 1.2,
    charSpacing: 0,
    ...opts,
  };

  if (type === 'text') base.text = 'Double-click to edit';
  if (type === 'rect') {
    base.fill = '#e8f4fd';
    base.name = 'Rectangle';
  }
  if (type === 'circle') {
    base.fill = '#e8f4fd';
    base.name = 'Circle';
  }
  if (type === 'line') {
    base.stroke = '#999999';
    base.strokeWidth = 2;
    base.name = 'Line';
  }
  if (type === 'image') {
    base.name = 'Image';
    base.height = 100;
  }
  if (type === 'itemsTable') {
    base.name = 'Items Table';
    base.placeholder = 'items_table';
    base.width = 500;
    base.height = 200;
    base.columns = [
      { id: uid('col'), key: 'item', label: 'Description', width: 40, align: 'left' },
      { id: uid('col'), key: 'qty', label: 'Qty', width: 12, align: 'right' },
      { id: uid('col'), key: 'price', label: 'Price', width: 18, align: 'right' },
      { id: uid('col'), key: 'amount', label: 'Amount', width: 18, align: 'right' },
    ];
    base.showHeader = true;
    base.headerBg = '#2389d6';
    base.headerColor = '#ffffff';
    base.borderColor = '#dcdcdc';
    base.rowHeight = 28;
  }

  return base;
}

export function createPlaceholderElement(key: PlaceholderKey): DesignElement {
  const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const isLogo = key === 'company_logo';
  const isTable = key === 'items_table';

  return createElement(isLogo ? 'image' : isTable ? 'itemsTable' : 'placeholder', {
    name: label,
    placeholder: key,
    text: isLogo ? undefined : `{{${key}}}`,
    width: isLogo ? 120 : isTable ? 500 : 220,
    height: isLogo ? 60 : isTable ? 200 : 28,
    fontSize: key === 'company_name' ? 20 : key === 'grand_total' ? 18 : 14,
    fontWeight: ['company_name', 'grand_total', 'customer_name'].includes(key) ? '700' : '400',
  });
}
