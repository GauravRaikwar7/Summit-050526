
import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Transaction, Account, TransactionType, CurrencyCode } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ReceiptRefundIcon } from '../components/icons';
import { calculateMonthlyBalances } from '../utils/finances';
import { excelParserService } from '../services/excelParserService';

interface ExpensesPageProps {
  transactions: Transaction[];
  accounts: Account[];
  globalDisplayCurrency: CurrencyCode;
}

const PIE_CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#A4DE6C', '#D0ED57', '#FFC658', '#FF7F50', '#DC143C', '#00FFFF', '#FF00FF', '#DAA520'];


const ExpensesPage: React.FC<ExpensesPageProps> = ({ transactions, accounts, globalDisplayCurrency }) => {
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  const selectedYear = currentMonthDate.getFullYear();
  const selectedMonth = currentMonthDate.getMonth(); // 0-indexed
  const selectedMonthStr = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`;

  const monthlySnapshot = useMemo(() => {
    let totalOpening = 0;
    let totalClosing = 0;
    let totalIncome = 0;
    let totalExpenses = 0;

    accounts.forEach(acc => {
      const balances = calculateMonthlyBalances(acc, transactions);
      const targetMonth = balances.find(b => b.month === selectedMonthStr);
      if (targetMonth) {
        totalOpening += targetMonth.openingBalance;
        totalClosing += targetMonth.closingBalance;
        totalIncome += targetMonth.income;
        totalExpenses += targetMonth.expenses;
      }
    });

    return { totalOpening, totalClosing, totalIncome, totalExpenses };
  }, [accounts, transactions, selectedMonthStr]);

  const handlePreviousMonth = () => {
    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  
  const handleMonthYearChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [year, month] = event.target.value.split('-').map(Number);
    setCurrentMonthDate(new Date(year, month - 1, 1)); // Month is 1-indexed in input value
  };

  const monthlyExpenses = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.type !== TransactionType.EXPENSE && tx.type !== TransactionType.EMI) return false;
      const txDate = new Date(tx.date);
      return txDate.getFullYear() === selectedYear && txDate.getMonth() === selectedMonth;
    });
  }, [transactions, selectedYear, selectedMonth]);

  const categorizedExpenses = useMemo(() => {
    const categoriesMap: { [key: string]: { totalAmount: number, count: number, transactions: Transaction[] } } = {};
    
    monthlyExpenses.forEach(tx => {
      if (!categoriesMap[tx.category]) {
        categoriesMap[tx.category] = { totalAmount: 0, count: 0, transactions: [] };
      }
      // For simplicity in summing, we'll assume all amounts are positive
      // This part does not handle multi-currency aggregation well for display.
      // The chart will sum these raw numbers. Individual transactions list original currency.
      categoriesMap[tx.category].totalAmount += tx.amount;
      categoriesMap[tx.category].count += 1;
      categoriesMap[tx.category].transactions.push(tx);
    });
    return Object.entries(categoriesMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a,b) => b.totalAmount - a.totalAmount);
  }, [monthlyExpenses]);

  const totalMonthlyExpenses = useMemo(() => {
    return monthlyExpenses.reduce((sum, tx) => sum + tx.amount, 0);
  }, [monthlyExpenses]);

  const pieChartData = useMemo(() => {
    return categorizedExpenses.map(cat => ({
      name: cat.name,
      value: cat.totalAmount, // This is a direct sum of amounts
    })).filter(item => item.value > 0);
  }, [categorizedExpenses]);

  const getAccountForTransaction = (accountId: string): Account | undefined => {
    return accounts.find(acc => acc.id === accountId);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center space-x-3">
          <ReceiptRefundIcon className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-text-primary">Monthly Expenses</h1>
        </div>
        <div className="flex items-center space-x-2">
            <button 
              onClick={() => excelParserService.downloadSampleExcel('transactions')}
              className="text-xs text-primary hover:underline font-medium"
            >
              Download Sample
            </button>
            <div className="flex items-center gap-2 sm:gap-4 bg-surface p-2 rounded-lg">
           <input
            type="month"
            value={`${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`}
            onChange={handleMonthYearChange}
            className="bg-slate-700 text-text-primary border border-slate-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          <button onClick={handlePreviousMonth} className="px-3 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm">Prev</button>
          <button onClick={handleNextMonth} className="px-3 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm">Next</button>
        </div>
      </div>
    </div>

      <div className="bg-surface p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold text-text-primary mb-4">
          Statement Summary for {currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-700 p-4 rounded-lg">
            <p className="text-xs text-text-secondary uppercase">Opening Balance</p>
            <p className="text-xl font-bold text-text-primary">{formatCurrency(monthlySnapshot.totalOpening, globalDisplayCurrency)}</p>
          </div>
          <div className="bg-slate-700 p-4 rounded-lg">
            <p className="text-xs text-text-secondary uppercase">Total Income</p>
            <p className="text-xl font-bold text-success">+{formatCurrency(monthlySnapshot.totalIncome, globalDisplayCurrency)}</p>
          </div>
          <div className="bg-slate-700 p-4 rounded-lg">
            <p className="text-xs text-text-secondary uppercase">Total Expenses</p>
            <p className="text-xl font-bold text-danger">-{formatCurrency(monthlySnapshot.totalExpenses, globalDisplayCurrency)}</p>
          </div>
          <div className="bg-slate-700 p-4 rounded-lg border border-primary/30">
            <p className="text-xs text-text-secondary uppercase">Closing Balance</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(monthlySnapshot.totalClosing, globalDisplayCurrency)}</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-text-primary mb-1 mt-8">
          Expense Breakdown
        </h2>
        <p className="text-sm text-text-secondary mb-4">
           {formatCurrency(totalMonthlyExpenses, globalDisplayCurrency)} total spent this month
        </p>
        {pieChartData.length > 0 ? (
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${name}: ${formatCurrency(value, globalDisplayCurrency)}`, null]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-text-secondary text-center py-4">No expense data for this month to display chart.</p>
        )}
      </div>

      <div className="space-y-6">
        {categorizedExpenses.length > 0 ? (
          categorizedExpenses.map(category => (
            <div key={category.name} className="bg-surface p-6 rounded-lg shadow-lg">
              <div className="flex justify-between items-baseline mb-3">
                <h3 className="text-lg font-semibold text-text-primary">{category.name}</h3>
                <span className="text-md font-medium text-text-secondary">
                  Total: {formatCurrency(category.totalAmount, globalDisplayCurrency)}
                </span>
              </div>
              <ul className="space-y-2">
                {category.transactions.map(tx => {
                  const account = getAccountForTransaction(tx.accountId);
                  return (
                    <li key={tx.id} className="flex justify-between items-center p-3 bg-slate-700 rounded-md text-sm">
                      <div>
                        <p className="font-medium text-text-primary">{tx.description}</p>
                        <p className="text-xs text-text-secondary">{formatDate(tx.date)} - {account?.name || 'N/A'}</p>
                      </div>
                      <span className="font-semibold text-danger">
                        -{formatCurrency(tx.amount, account?.currency || globalDisplayCurrency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        ) : (
          <div className="bg-surface p-6 rounded-lg shadow-lg text-center">
            <ReceiptRefundIcon className="w-12 h-12 mx-auto text-text-secondary mb-3" />
            <p className="text-text-secondary">No expenses recorded for {currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpensesPage;
