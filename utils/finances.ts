import { Transaction, TransactionType, Account } from '../types';

export interface MonthlyBalance {
  month: string; // YYYY-MM
  openingBalance: number;
  closingBalance: number;
  income: number;
  expenses: number;
}

export const calculateMonthlyBalances = (
  account: Account,
  transactions: Transaction[]
): MonthlyBalance[] => {
  const accountTxs = transactions
    .filter(tx => tx.accountId === account.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (accountTxs.length === 0) return [];

  const monthsMap = new Map<string, { 
    income: number; 
    expenses: number; 
    lastBalanceAfter?: number;
    firstBalanceAfter?: number;
    firstAmount?: number;
    firstType?: TransactionType;
  }>();

  // Group transactions by month
  accountTxs.forEach(tx => {
    const month = tx.date.substring(0, 7); // YYYY-MM
    const current = monthsMap.get(month) || { income: 0, expenses: 0 };
    if (tx.type === TransactionType.INCOME) {
      current.income += tx.amount;
    } else {
      current.expenses += tx.amount;
    }

    if (tx.balanceAfter !== undefined) {
      current.lastBalanceAfter = tx.balanceAfter;
      if (current.firstBalanceAfter === undefined) {
        current.firstBalanceAfter = tx.balanceAfter;
        current.firstAmount = tx.amount;
        current.firstType = tx.type;
      }
    }
    monthsMap.set(month, current);
  });

  const sortedMonths = Array.from(monthsMap.keys()).sort();
  const results: MonthlyBalance[] = [];
  
  // Anchor on the account's current balance and work backwards
  let workingBalance = account.balance;

  for (let i = sortedMonths.length - 1; i >= 0; i--) {
    const month = sortedMonths[i];
    const data = monthsMap.get(month)!;
    
    // Closing is either the last recorded balanceAfter in that month, or the workingBalance (if it's the current month)
    const closing = data.lastBalanceAfter !== undefined ? data.lastBalanceAfter : workingBalance;
    const net = data.income - data.expenses;
    
    // Opening is either calculated from the first recorded balanceAfter, or derived from closing - net
    const opening = data.firstBalanceAfter !== undefined && data.firstAmount !== undefined && data.firstType !== undefined
      ? data.firstBalanceAfter - (data.firstType === TransactionType.INCOME ? data.firstAmount : -data.firstAmount)
      : closing - net;

    results.unshift({
      month,
      openingBalance: opening,
      closingBalance: closing,
      income: data.income,
      expenses: data.expenses,
    });

    workingBalance = opening;
  }

  return results;
};
