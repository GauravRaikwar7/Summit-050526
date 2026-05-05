import { SUPPORTED_CURRENCIES } from './constants';

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number];

export const AccountType = {
  SAVINGS: 'Savings',
  CHECKING: 'Checking',
  CREDIT_CARD: 'Credit Card',
  INVESTMENT_ACCOUNT: 'Investment Account', // For holding stocks, crypto etc.
  LOAN: 'Loan',
} as const;
export type AccountType = typeof AccountType[keyof typeof AccountType];

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number; // Current balance or outstanding loan
  currency: CurrencyCode; // e.g., USD, INR
  createdAt: string;
  lastUpdatedDate?: string; // ISO string of the latest transaction/statement date
  institution?: string; // Bank Name
  loanAmount?: number;
  monthlyInstallment?: number;
  interestRate?: number;
  principalComponent?: number;
  interestComponent?: number;
  loanStartDate?: string;
  loanEndDate?: string;
}

export const TransactionType = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
  INVESTMENT: 'Investment',
  EMI: 'EMI',
  SIP: 'SIP',
} as const;
export type TransactionType = typeof TransactionType[keyof typeof TransactionType];

export interface Transaction {
  id: string;
  accountId: string; // Link to an account
  date: string; // ISO string
  description: string;
  friendlyDescription?: string;
  amount: number;
  type: TransactionType;
  category: string; // e.g., Food, Salary, Utilities
  notes?: string;
  balanceAfter?: number; // Real-time balance after this transaction (from statement)
  referenceId?: string; // Link to EMI, SIP, or Saving ID
}

export interface RawTransaction extends Omit<Transaction, 'id' | 'accountId'> {
  // Used for data coming from parsers before being fully processed
  friendlyDescription?: string;
}

export const InvestmentType = {
  STOCK: 'Stock',
  MUTUAL_FUNDS: 'Mutual Fund',
  CRYPTO: 'Crypto',
  GOLD: 'Gold',
  REAL_ESTATE: 'Real Estate',
  FIXED_DEPOSIT: 'Fixed Deposit',
  RECURRING_DEPOSIT: 'Recurring Deposit',
  OTHER: 'Other',
} as const;
export type InvestmentType = typeof InvestmentType[keyof typeof InvestmentType];

export const InvestmentMode = {
  LUMPSUM: 'Lumpsum',
  SIP: 'SIP',
} as const;
export type InvestmentMode = typeof InvestmentMode[keyof typeof InvestmentMode];

export interface Investment {
  id: string;
  name: string; // e.g., Apple Inc., Bitcoin, Nifty 50
  type: InvestmentType;
  mode: InvestmentMode;
  quantity: number; // Total units held
  purchasePrice: number; // Average purchase price per unit
  currentPrice: number; // Current market price per unit
  purchaseDate: string; // ISO string
  symbol?: string; // e.g., AAPL, BTC, NIFTY50
  schemeCode?: number; // MFAPI.in scheme code for Indian Mutual Funds
  accountId?: string; // Account where investment is held (Holding account)
  fundingAccountId?: string; // Bank account from which SIP is deducted
  currency?: CurrencyCode; // Currency of the investment
  
  // SIP / Recurring specifics
  monthlyAmount?: number;
  dayOfMonth?: number;
  lastPaidDate?: string;
  lastPaidAmount?: number;
  interestRate?: number; // Added for FD/RD
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType; // So categories can be for income or expense
}

export const PdfParserType = {
  AZURE: 'Azure Document Intelligence',
} as const;
export type PdfParserType = typeof PdfParserType[keyof typeof PdfParserType];

export const StorageMode = {
  LOCAL: 'Local Storage',
  COSMOS: 'Cosmos DB',
} as const;
export type StorageMode = typeof StorageMode[keyof typeof StorageMode];

export interface AppSettings {
  selectedPdfParser: PdfParserType;
  globalDisplayCurrency: CurrencyCode;
  storageMode: StorageMode;
  cosmosConnectionString?: string;
  azureDocIntelEndpoint?: string;
  azureDocIntelKey?: string;
  trackingFrequency: 'once' | 'thrice' | 'none'; // Tracker frequency (per day)
  lastValuesUpdate?: string; // Last time prices were auto-updated
}

export type RawInvestment = Omit<Investment, 'id'>;

export interface EMI {
  id: string;
  name: string;
  loanAmount: number;
  monthlyInstallment: number;
  startDate: string;
  endDate: string;
  interestRate: number;
  accountId: string; // Account from which EMI is deducted
  loanAccountId?: string; // Optional: Link to a Loan account if tracked
  bankName: string;
  category?: string;
  lastPaidDate?: string;
  lastPaidAmount?: number;
}

export const SavingType = {
  AUTO: 'Auto-calculated',
  USER: 'User-determined',
} as const;
export type SavingType = typeof SavingType[keyof typeof SavingType];

export interface Saving {
  id: string;
  name: string;
  amount: number;
  date: string; // ISO string
  type: SavingType;
  accountId?: string;
  notes?: string;
  paidDate?: string;
  paidAmount?: number;
}

// For PDF and Excel Parsing services
export interface DocumentParseResult {
  transactions: RawTransaction[];
  investments?: RawInvestment[];
  error?: string;
  message?: string; // General messages like "No transactions found"
  openingBalance?: number;
  finalBalance?: number;
  balanceDate?: string; // ISO string for when the final/opening balances were measured
}

export interface GlobalErrorInfo {
  title: string;
  message: string;
  technicalDetails?: string;
  type?: 'error' | 'warning' | 'info';
}

export interface AppData {
  accounts: Account[];
  transactions: Transaction[];
  investments: Investment[];
  emis: EMI[];
  savings: Saving[];
  appSettings: AppSettings;
  globalDisplayCurrency: CurrencyCode;
}
