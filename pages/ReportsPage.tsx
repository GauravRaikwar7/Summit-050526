
import React, { useState } from 'react';
import { Transaction, Account, Investment, EMI, Saving, CurrencyCode } from '../types';
import { exportService } from '../services/exportService';
import { DocumentArrowDownIcon, CalendarIcon, TableCellsIcon, ClipboardDocumentListIcon } from '../components/icons';
import FormField from '../components/forms/FormField';
import { formatCurrency } from '../utils/formatters';

interface ReportsPageProps {
  transactions: Transaction[];
  accounts: Account[];
  investments: Investment[];
  emis: EMI[];
  savings: Saving[];
  globalDisplayCurrency: CurrencyCode;
}

const ReportsPage: React.FC<ReportsPageProps> = ({
  transactions,
  accounts,
  investments,
  emis,
  savings,
  globalDisplayCurrency
}) => {
  const [reportType, setReportType] = useState<'monthly' | 'yearly' | 'custom'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getFilteredTransactions = () => {
    return transactions.filter(tx => {
      const d = new Date(tx.date);
      if (reportType === 'monthly') {
        return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
      } else if (reportType === 'yearly') {
        return d.getFullYear() === selectedYear;
      } else {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      }
    });
  };

  const getPeriodLabel = () => {
    if (reportType === 'monthly') return `${months[selectedMonth]} ${selectedYear}`;
    if (reportType === 'yearly') return `Year ${selectedYear}`;
    return `${startDate || 'Start'} to ${endDate || 'End'}`;
  };

  const handleExportExcel = () => {
    const filteredTx = getFilteredTransactions();
    exportService.exportToExcel(
      filteredTx,
      accounts,
      investments,
      emis,
      savings,
      `Summit_Statement_${getPeriodLabel().replace(/\s+/g, '_')}.xlsx`
    );
  };

  const handleExportCSV = () => {
    const filteredTx = getFilteredTransactions();
    exportService.exportToCSV(
      filteredTx,
      `Summit_Transactions_${getPeriodLabel().replace(/\s+/g, '_')}.csv`
    );
  };

  const handleExportHTML = () => {
    const filteredTx = getFilteredTransactions();
    exportService.exportToHTML(
      filteredTx,
      accounts,
      getPeriodLabel(),
      globalDisplayCurrency
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <DocumentArrowDownIcon className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold text-text-primary">Reports & Exports</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Card */}
        <div className="lg:col-span-1 bg-surface p-6 rounded-xl border border-slate-700 shadow-lg space-y-6">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Statement Period</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Report Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(['monthly', 'yearly', 'custom'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setReportType(type)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold capitalize transition-all ${
                      reportType === type 
                        ? 'bg-primary text-white shadow-md' 
                        : 'bg-slate-800 text-text-secondary hover:bg-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {reportType === 'monthly' && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Month"
                  id="month"
                  type="select"
                  value={selectedMonth.toString()}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  options={months.map((m, i) => ({ value: i.toString(), label: m }))}
                />
                <FormField
                  label="Year"
                  id="year"
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                />
              </div>
            )}

            {reportType === 'yearly' && (
              <FormField
                label="Year"
                id="year"
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              />
            )}

            {reportType === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="From"
                  id="start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <FormField
                  label="To"
                  id="end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-slate-700">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Export Options</h3>
            <div className="space-y-3">
              <button
                onClick={handleExportExcel}
                className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 text-text-primary rounded-lg transition-all border border-slate-700"
              >
                <div className="flex items-center">
                  <TableCellsIcon className="w-5 h-5 mr-3 text-success" />
                  <span className="font-medium">Excel Spreadsheet</span>
                </div>
                <span className="text-xs text-text-secondary">.xlsx</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 text-text-primary rounded-lg transition-all border border-slate-700"
              >
                <div className="flex items-center">
                  <ClipboardDocumentListIcon className="w-5 h-5 mr-3 text-amber-500" />
                  <span className="font-medium">CSV (Transactions only)</span>
                </div>
                <span className="text-xs text-text-secondary">.csv</span>
              </button>

              <button
                onClick={handleExportHTML}
                className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 text-text-primary rounded-lg transition-all border border-slate-700"
              >
                <div className="flex items-center">
                  <CalendarIcon className="w-5 h-5 mr-3 text-primary" />
                  <span className="font-medium">HTML Statement</span>
                </div>
                <span className="text-xs text-text-secondary">.html</span>
              </button>
            </div>
          </div>
        </div>

        {/* Preview Card */}
        <div className="lg:col-span-2 bg-surface p-6 rounded-xl border border-slate-700 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-text-primary">Statement Preview</h2>
            <div className="text-sm text-text-secondary">
              {getFilteredTransactions().length} Transactions
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-800 min-h-[400px]">
            <div className="flex justify-between items-start mb-8 border-b border-slate-800 pb-6">
              <div>
                <h3 className="text-2xl font-bold text-primary">Summit</h3>
                <p className="text-text-secondary text-sm">Financial Summary Report</p>
              </div>
              <div className="text-right">
                <p className="text-text-primary font-bold">{getPeriodLabel()}</p>
                <p className="text-text-secondary text-xs">Generated {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <p className="text-[10px] uppercase text-text-secondary font-bold mb-1">Income</p>
                <p className="text-lg font-bold text-success">
                  {formatCurrency(getFilteredTransactions().filter(t => t.type === 'Income').reduce((s,t) => s + t.amount, 0), globalDisplayCurrency)}
                </p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <p className="text-[10px] uppercase text-text-secondary font-bold mb-1">Expenses</p>
                <p className="text-lg font-bold text-danger">
                  {formatCurrency(getFilteredTransactions().filter(t => t.type !== 'Income').reduce((s,t) => s + t.amount, 0), globalDisplayCurrency)}
                </p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <p className="text-[10px] uppercase text-text-secondary font-bold mb-1">Accounts</p>
                <p className="text-lg font-bold text-text-primary">{accounts.length}</p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <p className="text-[10px] uppercase text-text-secondary font-bold mb-1">Savings</p>
                <p className="text-lg font-bold text-sky-400">
                  {formatCurrency(savings.filter(s => {
                    const d = new Date(s.date);
                    if (reportType === 'monthly') return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
                    if (reportType === 'yearly') return d.getFullYear() === selectedYear;
                    return true;
                  }).reduce((s,t) => s + t.amount, 0), globalDisplayCurrency)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-text-primary border-b border-slate-800 pb-2">Recent transactions in this period</h4>
              {getFilteredTransactions().slice(0, 8).map(tx => (
                <div key={tx.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-800/50 last:border-0 text-text-primary">
                  <div className="flex space-x-4">
                    <span className="text-text-secondary">{new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</span>
                    <span className="font-medium truncate max-w-[200px]">{tx.description}</span>
                  </div>
                  <span className={tx.type === 'Income' ? 'text-success' : 'text-danger'}>
                    {tx.type === 'Income' ? '+' : '-'}{formatCurrency(tx.amount, globalDisplayCurrency)}
                  </span>
                </div>
              ))}
              {getFilteredTransactions().length > 8 && (
                <p className="text-center text-[10px] text-text-secondary pt-2">... and {getFilteredTransactions().length - 8} more transactions</p>
              )}
              {getFilteredTransactions().length === 0 && (
                <p className="text-center text-text-secondary py-10">No transactions found for this period.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
