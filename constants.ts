import { Category, TransactionType, CurrencyCode } from './types';

export const APP_NAME = "Summit";
export const DEFAULT_CURRENCY: CurrencyCode = "USD";

export const SUPPORTED_CURRENCIES = ["USD", "INR"] as const;

export const DEFAULT_EXPENSE_CATEGORIES: Category[] = [
  { id: 'cat_food', name: 'Food & Dining', type: TransactionType.EXPENSE },
  { id: 'cat_groceries', name: 'Groceries', type: TransactionType.EXPENSE },
  { id: 'cat_transport', name: 'Transportation', type: TransactionType.EXPENSE },
  { id: 'cat_utilities', name: 'Utilities', type: TransactionType.EXPENSE },
  { id: 'cat_housing', name: 'Housing', type: TransactionType.EXPENSE },
  { id: 'cat_health', name: 'Health & Wellness', type: TransactionType.EXPENSE },
  { id: 'cat_entertainment', name: 'Entertainment', type: TransactionType.EXPENSE },
  { id: 'cat_shopping', name: 'Shopping', type: TransactionType.EXPENSE },
  { id: 'cat_education', name: 'Education', type: TransactionType.EXPENSE },
  { id: 'cat_travel', name: 'Travel', type: TransactionType.EXPENSE },
  { id: 'cat_personal_care', name: 'Personal Care', type: TransactionType.EXPENSE },
  { id: 'cat_gifts', name: 'Gifts & Donations', type: TransactionType.EXPENSE },
  { id: 'cat_investments', name: 'Investments Outflow', type: TransactionType.EXPENSE },
  { id: 'cat_other_expense', name: 'Other Expense', type: TransactionType.EXPENSE },
];

export const DEFAULT_INCOME_CATEGORIES: Category[] = [
  { id: 'cat_salary', name: 'Salary', type: TransactionType.INCOME },
  { id: 'cat_bonus', name: 'Bonus', type: TransactionType.INCOME },
  { id: 'cat_freelance', name: 'Freelance Income', type: TransactionType.INCOME },
  { id: 'cat_investment_income', name: 'Investment Income', type: TransactionType.INCOME },
  { id: 'cat_gifts_received', name: 'Gifts Received', type: TransactionType.INCOME },
  { id: 'cat_other_income', name: 'Other Income', type: TransactionType.INCOME },
];

export const INVESTMENT_CATEGORIES: Category[] = [
  { id: 'cat_stock_buy', name: 'Stock Purchase', type: TransactionType.INVESTMENT },
  { id: 'cat_mf_buy', name: 'Mutual Fund Purchase', type: TransactionType.INVESTMENT },
  { id: 'cat_fd_buy', name: 'Fixed Deposit', type: TransactionType.INVESTMENT },
  { id: 'cat_gold_buy', name: 'Metals/Gold', type: TransactionType.INVESTMENT },
  { id: 'cat_other_inv', name: 'Other Investment', type: TransactionType.INVESTMENT },
];

export const EMI_CATEGORIES: Category[] = [
  { id: 'cat_home_loan', name: 'Home Loan EMI', type: TransactionType.EMI },
  { id: 'cat_car_loan', name: 'Car Loan EMI', type: TransactionType.EMI },
  { id: 'cat_personal_loan', name: 'Personal Loan EMI', type: TransactionType.EMI },
  { id: 'cat_edu_loan', name: 'Education Loan EMI', type: TransactionType.EMI },
  { id: 'cat_other_emi', name: 'Other EMI', type: TransactionType.EMI },
];

export const ALL_CATEGORIES = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES, ...INVESTMENT_CATEGORIES, ...EMI_CATEGORIES];

export const AZURE_CONFIG_INFO = "Azure Document Intelligence requires Endpoint and Key to be configured in Settings for PDF import.";

// localStorage keys
export const STORAGE_KEYS = {
  ACCOUNTS: 'accounts',
  TRANSACTIONS: 'transactions',
  INVESTMENTS: 'investments',
  EMIS: 'emis',
  SIPS: 'sips',
  SAVINGS: 'savings',
  GLOBAL_DISPLAY_CURRENCY: 'globalDisplayCurrency',
  APP_SETTINGS: 'appSettings',
};
