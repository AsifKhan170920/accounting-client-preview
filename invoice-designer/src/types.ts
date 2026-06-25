export type ElementType =
  | 'text'
  | 'placeholder'
  | 'image'
  | 'rect'
  | 'circle'
  | 'line'
  | 'itemsTable';

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface TableColumn {
  id: string;
  key: string;
  label: string;
  width: number;
  align: TextAlign;
}

export interface DesignElement {
  id: string;
  type: ElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  zIndex: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  placeholder?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: TextAlign;
  lineHeight?: number;
  charSpacing?: number;
  underline?: boolean;
  src?: string;
  columns?: TableColumn[];
  showHeader?: boolean;
  showTotals?: boolean;
  headerBg?: string;
  headerColor?: string;
  borderColor?: string;
  rowHeight?: number;
}

export interface InvoiceDesign {
  id: string;
  name: string;
  version: 1;
  page: {
    width: number;
    height: number;
    background: string;
    margin: number;
  };
  elements: DesignElement[];
  grid: {
    enabled: boolean;
    size: number;
    snap: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  item?: string;
  desc?: string;
  qty?: number | string;
  price?: number | string;
  tax?: string;
  taxAmt?: number | string;
  amount?: number | string;
  account?: string;
}

export interface InvoiceData {
  company_name?: string;
  company_logo?: string;
  company_address?: string;
  company_trn?: string;
  company_phone?: string;
  company_email?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  customer_name?: string;
  customer_address?: string;
  customer_trn?: string;
  description?: string;
  items?: InvoiceLineItem[];
  subtotal?: number | string;
  tax?: number | string;
  discount?: number | string;
  grand_total?: number | string;
  amount_in_words?: string;
  status?: string;
  [key: string]: unknown;
}

export interface DesignerMountOptions {
  businessId: string;
  docKey: string;
  design?: InvoiceDesign | null;
  sampleData?: InvoiceData;
  onSave: (design: InvoiceDesign) => void;
  onExit: () => void;
}

export const PLACEHOLDERS = [
  { key: 'company_name', label: 'Company Name' },
  { key: 'company_logo', label: 'Company Logo' },
  { key: 'company_address', label: 'Company Address' },
  { key: 'company_trn', label: 'Company TRN' },
  { key: 'invoice_number', label: 'Invoice Number' },
  { key: 'invoice_date', label: 'Invoice Date' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'customer_name', label: 'Customer Name' },
  { key: 'customer_address', label: 'Customer Address' },
  { key: 'customer_trn', label: 'Customer TRN' },
  { key: 'description', label: 'Description' },
  { key: 'items_table', label: 'Items Table' },
  { key: 'subtotal', label: 'Subtotal' },
  { key: 'tax', label: 'Tax' },
  { key: 'discount', label: 'Discount' },
  { key: 'grand_total', label: 'Grand Total' },
  { key: 'amount_in_words', label: 'Amount in Words' },
  { key: 'status', label: 'Status' },
] as const;

export type PlaceholderKey = (typeof PLACEHOLDERS)[number]['key'];
