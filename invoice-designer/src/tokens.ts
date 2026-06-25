import type { InvoiceData, InvoiceLineItem } from './types';

type BizRecord = Record<string, unknown>;
type Biz = {
  id?: string;
  name?: string;
  currency?: string;
  baseCurrency?: string;
  details?: {
    legalName?: string;
    logo?: string;
    address?: string;
    taxNumber?: string;
    phone?: string;
    email?: string;
  };
  records?: {
    customers?: Array<Record<string, unknown>>;
    suppliers?: Array<Record<string, unknown>>;
  };
};

function money(n: unknown, cur = ''): string {
  const v = Number(String(n ?? '').replace(/,/g, ''));
  if (Number.isNaN(v)) return String(n ?? '');
  const sym = cur === 'USD' ? '$' : cur === 'GBP' ? '£' : cur === 'EUR' ? '€' : '';
  return sym + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  return s;
}

function partyRecord(b: Biz, rec: BizRecord, isPurchase: boolean) {
  const name = String(rec.customer ?? rec.supplier ?? '');
  const listKey = isPurchase ? 'suppliers' : 'customers';
  const list = (b.records?.[listKey] ?? []) as Array<Record<string, unknown>>;
  return list.find((x) => String(x.name ?? x.customer ?? x.supplier ?? '') === name) ?? {};
}

export function mapRecordToInvoiceData(
  b: Biz,
  rec: BizRecord,
  opts?: { isPurchase?: boolean; amountInWords?: (n: number, cur: string) => string }
): InvoiceData {
  const d = b.details ?? {};
  const cur = String(d && (b.currency ?? b.baseCurrency) ? (b.currency ?? b.baseCurrency) : '');
  const isPurchase = !!opts?.isPurchase;
  const party = partyRecord(b, rec, isPurchase);
  const lines = (Array.isArray(rec.lines) ? rec.lines : []) as InvoiceLineItem[];

  const billing = String(rec.billingAddress ?? party.address ?? party.billingAddress ?? '');
  const total = Number(rec.total ?? 0);

  return {
    company_name: String(d.legalName ?? b.name ?? ''),
    company_logo: String(d.logo ?? ''),
    company_address: String(d.address ?? ''),
    company_trn: String(d.taxNumber ?? ''),
    company_phone: String(d.phone ?? ''),
    company_email: String(d.email ?? ''),
    invoice_number: String(rec.reference ?? ''),
    invoice_date: fmtDate(rec.issueDate ?? rec.date),
    due_date: fmtDate(rec.dueDate),
    customer_name: String(rec.customer ?? rec.supplier ?? ''),
    customer_address: billing,
    customer_trn: String(party.trn ?? party.taxNumber ?? party.vat ?? ''),
    description: String(rec.description ?? ''),
    items: lines.map((ln) => ({
      item: String(ln.item ?? ln.desc ?? ln.account ?? ''),
      desc: String(ln.desc ?? ''),
      qty: ln.qty ?? '',
      price: ln.price ?? '',
      tax: String(ln.tax ?? ''),
      taxAmt: ln.taxAmt ?? '',
      amount: ln.amount ?? '',
      account: String(ln.account ?? ''),
    })),
    subtotal: money(rec.subtotal, cur),
    tax: money(rec.tax, cur),
    discount: money(rec.discount ?? 0, cur),
    grand_total: money(total, cur),
    amount_in_words: opts?.amountInWords ? opts.amountInWords(total, cur) : String(total),
    status: String(rec.status ?? ''),
  };
}

export function sampleInvoiceData(): InvoiceData {
  return {
    company_name: 'Acme Trading LLC',
    company_logo: '',
    company_address: '123 Business Bay\nDubai, UAE',
    company_trn: '100123456789003',
    company_phone: '+971 4 123 4567',
    company_email: 'billing@acme.example',
    invoice_number: 'INV-2026-0042',
    invoice_date: '06/20/2026',
    due_date: '07/20/2026',
    customer_name: 'Global Retail Co.',
    customer_address: '456 Commerce St\nAbu Dhabi, UAE',
    customer_trn: '100987654321003',
    description: 'Professional services rendered',
    items: [
      { item: 'Consulting Services', desc: 'Monthly retainer', qty: 1, price: 5000, tax: '5%', taxAmt: 250, amount: 5250 },
      { item: 'Software License', desc: 'Annual subscription', qty: 2, price: 1200, tax: '5%', taxAmt: 120, amount: 2520 },
    ],
    subtotal: '7,400.00',
    tax: '370.00',
    discount: '0.00',
    grand_total: '7,770.00',
    amount_in_words: 'Seven thousand seven hundred seventy dirhams only',
    status: 'UNPAID',
  };
}

export function resolvePlaceholder(key: string, data: InvoiceData): string {
  if (key === 'items_table') return '';
  const val = data[key];
  if (val == null) return '';
  if (typeof val === 'object') return '';
  return String(val);
}

export function placeholderLabel(key: string): string {
  return `{{${key}}}`;
}
