export type DocType =
  | "invoice"
  | "receipt"
  | "order"
  | "contract"
  | "customer"
  | "letter"
  | "inventory"
  | "other";

export const DOC_TYPES: DocType[] = [
  "invoice",
  "receipt",
  "order",
  "contract",
  "customer",
  "letter",
  "inventory",
  "other",
];

export interface ExtractedRecord {
  docType: DocType;
  title: string;
  party: string;
  date: string;
  amount: number | null;
  currency: string;
  summary: string;
  fields: { label: string; value: string }[];
  lineItems: { description: string; quantity: number | null; unitPrice: number | null; total: number | null }[];
  tags: string[];
}

/** A digitized paper document kept in the archive. */
export interface BusinessRecord extends ExtractedRecord {
  id: string;
  createdAt: string;
  source: string; // file name or "manual"
  status: "open" | "done";
}

export interface BusinessProfile {
  businessName: string;
  ownerName: string;
  address: string;
  email: string;
  phone: string;
  taxId: string;
  /** ISO country code, e.g. LV. Used for VAT defaults and e-invoices. */
  country: string;
  bankDetails: string;
  currency: string;
  defaultTaxRate: number; // percent, e.g. 21
  paymentTermsDays: number;
  invoicePrefix: string;
  quotePrefix: string;
  invoiceFooter: string;
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  /** ISO country code, e.g. LT. Empty means the same country as the business. */
  country?: string;
  /** VAT or company registration number, printed on invoices and e-invoices. */
  taxId?: string;
  notes: string;
  createdAt: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  productId?: string;
}

export type InvoiceKind = "invoice" | "quote";
export type InvoiceStatus = "draft" | "sent" | "paid" | "accepted" | "declined";
/** Status as shown to the user — "overdue" is derived from due date. */
export type DisplayStatus = InvoiceStatus | "overdue";

export interface Invoice {
  id: string;
  kind: InvoiceKind;
  number: string;
  customerId: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD (valid-until for quotes)
  items: LineItem[];
  taxRate: number; // percent
  notes: string;
  status: InvoiceStatus;
  paidAt?: string;
  convertedFrom?: string; // quote id this invoice was created from
  stockDeducted?: boolean; // linked stock items were booked out when the invoice was sent
  createdAt: string;
}

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
  costPrice: number;
  salePrice: number;
  location: string;
}

export interface RoadmapPhase {
  name: string;
  timeframe: string;
  goal: string;
  actions: string[];
  tools: string[];
  estimatedCost: string;
  aiOpportunity: string;
}

export interface Roadmap {
  score: number;
  headline: string;
  strengths: string[];
  risks: string[];
  quickWins: string[];
  phases: RoadmapPhase[];
}

export interface Assessment {
  industry: string;
  employees: string;
  yearsInBusiness: string;
  recordKeeping: string;
  invoicing: string;
  customerComms: string;
  inventory: string;
  onlinePresence: string;
  painPoints: string;
  budget: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface WorkspaceState {
  version: 2;
  profile: BusinessProfile;
  customers: Customer[];
  invoices: Invoice[];
  stock: StockItem[];
  records: BusinessRecord[];
  assessment: Assessment | null;
  roadmap: Roadmap | null;
  roadmapDone: string[]; // "phaseIndex:actionIndex"
  chat: ChatMessage[];
}
