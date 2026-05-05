import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Saving, Account, Transaction, Investment, TransactionType, CurrencyCode, AccountType } from '../types';
import { formatCurrency } from '../utils/formatters';
import { calculateMonthlyBalances } from '../utils/finances';

interface DashboardPageProps {
  accounts: Account[];
  transactions: Transaction[];
  investments: Investment[];
  savings: Saving[];
  globalDisplayCurrency: CurrencyCode;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#A4DE6C', '#D0ED57', '#FFC658'];

const DashboardPage: React.FC<DashboardPageProps> = ({ accounts, transactions, investments, savings, globalDisplayCurrency }) => {
  const totalAssets = accounts
    .filter(acc => acc.type !== AccountType.LOAN)
    .reduce((sum, acc) => sum + acc.balance, 0);
  const totalDebts = accounts
    .filter(acc => acc.type === AccountType.LOAN)
    .reduce((sum, acc) => sum + acc.balance, 0);
  
  const totalInvestmentsValue = investments.reduce((sum, inv) => sum + inv.quantity * inv.currentPrice, 0);
  const totalUserSavingsValue = savings.reduce((sum, s) => sum + s.amount, 0);

  const netWorth = totalAssets + totalInvestmentsValue - totalDebts;

  const latestUpdateDate = accounts.reduce((latest, acc) => {
    if (!acc.lastUpdatedDate) return latest;
    if (!latest) return acc.lastUpdatedDate;
    return acc.lastUpdatedDate > latest ? acc.lastUpdatedDate : latest;
  }, undefined as string | undefined);

  const formattedAsOf = latestUpdateDate ? `As of ${new Date(latestUpdateDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : undefined;

  const recentTransactions = transactions.slice(0, 5);

  const expenseData = transactions
    .filter(t => t.type === TransactionType.EXPENSE || t.type === TransactionType.EMI)
    .reduce((acc, curr) => {
      const amount = isNaN(curr.amount) ? 0 : curr.amount;
      const categoryName = curr.type === TransactionType.EMI ? 'EMI' : curr.category;
      const existing = acc.find(item => item.name === categoryName);
      if (existing) {
        existing.value += amount;
      } else {
        acc.push({ name: categoryName, value: amount });
      }
      return acc;
    }, [] as { name: string; value: number }[])
    .sort((a,b) => b.value - a.value);

  const investmentChartData = transactions
    .filter(t => t.type === TransactionType.INVESTMENT || t.type === TransactionType.SIP)
    .reduce((acc, curr) => {
      const amount = isNaN(curr.amount) ? 0 : curr.amount;
      const categoryName = curr.type === TransactionType.SIP ? 'SIP' : curr.category;
      const existing = acc.find(item => item.name === categoryName);
      if (existing) {
        existing.value += amount;
      } else {
        acc.push({ name: categoryName, value: amount });
      }
      return acc;
    }, [] as { name: string; value: number }[])
    .sort((a,b) => b.value - a.value);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SummaryCard title="Net Worth" value={formatCurrency(netWorth, globalDisplayCurrency)} />
        <SummaryCard title="Total Assets" value={formatCurrency(totalAssets + totalInvestmentsValue, globalDisplayCurrency)} />
        <SummaryCard title="Total Debts" value={formatCurrency(totalDebts, globalDisplayCurrency)} />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard title="Account Balances" value={formatCurrency(totalAssets, globalDisplayCurrency)} description={formattedAsOf} />
        <SummaryCard title="Investment Value" value={formatCurrency(totalInvestmentsValue, globalDisplayCurrency)} />
        <SummaryCard title="Tracked Savings" value={formatCurrency(totalUserSavingsValue, globalDisplayCurrency)} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Expense & EMI Breakdown</h2>
          {expenseData.length > 0 ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={expenseData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {expenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value, globalDisplayCurrency)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-text-secondary">No expense or EMI data available to display chart.</p>
          )}
        </div>

        <div className="bg-surface p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Investment Distribution (SIP/One-time)</h2>
          {investmentChartData.length > 0 ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={investmentChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#82ca9d"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {investmentChartData.map((entry, index) => (
                      <Cell key={`cell-inv-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value, globalDisplayCurrency)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-text-secondary">No investment (SIP) data available to display chart.</p>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-surface p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Recent Transactions</h2>
          {recentTransactions.length > 0 ? (
            <ul className="space-y-3">
              {recentTransactions.map(tx => {
                const account = accounts.find(acc => acc.id === tx.accountId);
                return (
                  <li key={tx.id} className="flex justify-between items-center p-3 bg-slate-700 rounded-md">
                    <div>
                      <p className="font-medium text-text-primary">{tx.description}</p>
                      <p className="text-xs text-text-secondary">{tx.category} - {new Date(tx.date).toLocaleDateString()}</p>
                      <div className="text-[10px] uppercase text-text-secondary opacity-50 mt-1">{tx.type}</div>
                    </div>
                    <span className={`font-semibold ${tx.type === TransactionType.INCOME ? 'text-success' : 'text-danger'}`}>
                      {tx.type === TransactionType.INCOME ? '+' : '-'}
                      {formatCurrency(tx.amount, account?.currency || globalDisplayCurrency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-text-secondary">No recent transactions.</p>
          )}
        </div>
      </div>

      <div className="bg-surface p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold text-text-primary mb-4">Monthly Account Statement Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {accounts.map(acc => {
            const monthlyBalances = calculateMonthlyBalances(acc, transactions);
            if (monthlyBalances.length === 0) return null;
            
            return (
              <div key={acc.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <h3 className="font-semibold text-primary mb-1 flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                    {acc.name}
                  </div>
                  {acc.lastUpdatedDate && (
                    <span className="text-[10px] text-text-secondary opacity-70 font-normal">
                      As of {new Date(acc.lastUpdatedDate).toLocaleDateString()}
                    </span>
                  )}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-text-secondary">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="py-2 px-1">Month</th>
                        <th className="py-2 px-1">Opening</th>
                        <th className="py-2 px-1">Closing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyBalances.reverse().slice(0, 6).map(mb => (
                        <tr key={mb.month} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/50 transition-colors">
                          <td className="py-2 px-1 text-text-primary font-medium">{mb.month}</td>
                          <td className="py-2 px-1">{formatCurrency(mb.openingBalance, acc.currency)}</td>
                          <td className="py-2 px-1 text-text-primary">{formatCurrency(mb.closingBalance, acc.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {accounts.length === 0 && <p className="text-text-secondary">No accounts found.</p>}
        </div>
      </div>

    </div>
  );
};

interface SummaryCardProps {
  title: string;
  value: string;
  description?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, description }) => (
  <div className="bg-surface p-6 rounded-lg shadow-lg border border-slate-700/50">
    <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest opacity-70">{title}</h3>
    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-text-primary mt-1 break-words">{value}</p>
    {description && <p className="text-xs text-text-secondary mt-2">{description}</p>}
  </div>
);

export default DashboardPage;