import React, { useState, useMemo } from 'react';
import { Saving, SavingType, Account, CurrencyCode, Transaction, TransactionType } from '../types';
import Modal from '../components/Modal';
import FormField from '../components/forms/FormField';
import { PlusCircleIcon, TrashIcon, ChartPieIcon, ArrowUpTrayIcon } from '../components/icons';
import { formatCurrency, formatDate, getTodayISOString } from '../utils/formatters';
import { excelParserService } from '../services/excelParserService';

interface SavingsPageProps {
  savings: Saving[];
  addSaving: (saving: Omit<Saving, 'id'>) => void;
  batchAddSavings: (savings: Omit<Saving, 'id'>[]) => void;
  deleteSaving: (id: string) => void;
  transactions: Transaction[];
  accounts: Account[];
  globalDisplayCurrency: CurrencyCode;
}

const SavingsPage: React.FC<SavingsPageProps> = ({ 
  savings, 
  addSaving, 
  batchAddSavings,
  deleteSaving, 
  transactions,
  accounts, 
  globalDisplayCurrency 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importAccountId, setImportAccountId] = useState(accounts.length > 0 ? accounts[0].id : '');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const handleDownloadSample = () => {
    excelParserService.downloadSampleExcel('savings');
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !importAccountId) return;

    setIsImporting(true);
    const result = await excelParserService.parseSavings(importFile, importAccountId);
    if (result.savings && result.savings.length > 0) {
      batchAddSavings(result.savings as Omit<Saving, 'id'>[]);
      setIsImportModalOpen(false);
      setImportFile(null);
    } else if (result.error) {
      alert(result.error);
    }
    setIsImporting(false);
  };

  const getInitialSavingState = (): Omit<Saving, 'id'> => ({
    name: '',
    amount: 0,
    date: getTodayISOString(),
    type: SavingType.USER,
    accountId: accounts.length > 0 ? accounts[0].id : '',
    notes: '',
    paidDate: '',
    paidAmount: 0,
  });

  const [newSaving, setNewSaving] = useState<Omit<Saving, 'id'>>(getInitialSavingState());
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Auto-calculated savings for the selected month
  const autoCalculatedSavings = useMemo(() => {
    const monthlyTransactions = transactions.filter(tx => {
      const d = new Date(tx.date);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });

    const income = monthlyTransactions
      .filter(tx => tx.type === TransactionType.INCOME)
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const expense = monthlyTransactions
      .filter(tx => tx.type === TransactionType.EXPENSE || tx.type === TransactionType.EMI)
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const investment = monthlyTransactions
      .filter(tx => tx.type === TransactionType.INVESTMENT)
      .reduce((sum, tx) => sum + tx.amount, 0);

    return income - expense - investment;
  }, [transactions, selectedYear, selectedMonth]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setNewSaving(prev => ({
      ...prev,
      [id]: (id === 'amount' || id === 'paidAmount') ? parseFloat(value) || 0 : value
    }));
    if (formErrors[id]) {
      setFormErrors(prev => ({ ...prev, [id]: '' }));
    }
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!newSaving.name.trim()) errors.name = 'Name is required';
    if (newSaving.amount <= 0) errors.amount = 'Amount must be greater than 0';
    if (!newSaving.date) errors.date = 'Date is required';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    addSaving(newSaving);
    setIsModalOpen(false);
    setNewSaving(getInitialSavingState());
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(v => v - 1);
    } else {
      setSelectedMonth(v => v - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(v => v + 1);
    } else {
      setSelectedMonth(v => v + 1);
    }
  };

  const filteredUserSavings = savings.filter(s => {
    const d = new Date(s.date);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  });

  const totalUserSavings = filteredUserSavings.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <ChartPieIcon className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-text-primary">Savings</h1>
        </div>
        
        <div className="flex items-center space-x-4 bg-surface p-2 rounded-lg border border-slate-700">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-700 rounded-md text-text-primary">
            &larr;
          </button>
          <div className="text-center min-w-[120px]">
            <span className="font-bold text-text-primary">{months[selectedMonth]} {selectedYear}</span>
          </div>
          <button onClick={handleNextMonth} className="p-2 hover:bg-slate-700 rounded-md text-text-primary">
            &rarr;
          </button>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-slate-700 hover:bg-slate-600 text-text-primary font-semibold py-2 px-4 rounded-lg shadow-md transition-all flex items-center"
          >
            <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
            Import
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-all flex items-center"
          >
            <PlusCircleIcon className="w-5 h-5 mr-2" />
            Record Saving
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-text-primary">Auto-Calculated Savings</h2>
            <span className="text-xs px-2 py-1 bg-sky-500/20 text-sky-400 rounded-full font-medium">Automatic</span>
          </div>
          <p className="text-sm text-text-secondary mb-4">
            Derived from Income - (Expenses + EMIs + Investments) for {months[selectedMonth]}.
          </p>
          <div className="text-3xl font-bold text-success mb-2">
            {formatCurrency(autoCalculatedSavings, globalDisplayCurrency)}
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2.5 mt-4">
            <div 
              className={`h-2.5 rounded-full ${autoCalculatedSavings >= 0 ? 'bg-success' : 'bg-danger'}`} 
              style={{ width: `${Math.min(100, Math.max(0, autoCalculatedSavings / 1000 * 100))}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-lg text-white" style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">User-Determined Savings</h2>
            <span className="text-xs px-2 py-1 bg-white/20 text-white rounded-full font-medium">Manual Tracking</span>
          </div>
          <p className="text-sm text-blue-100 mb-4">
            Manually recorded savings or specific allocations for {months[selectedMonth]}.
          </p>
          <div className="text-3xl font-bold mb-2">
            {formatCurrency(totalUserSavings, globalDisplayCurrency)}
          </div>
          <div className="text-sm text-blue-100 italic">
            Total of {filteredUserSavings.length} entries this month.
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-slate-700 shadow-lg overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-text-primary">Savings Log</h2>
        </div>
        
        {filteredUserSavings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-800 text-text-secondary text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">Account</th>
                  <th className="px-6 py-4 font-semibold">Type</th>
                  <th className="px-6 py-4 font-semibold text-right">Amount</th>
                  <th className="px-6 py-4 font-semibold text-center">Paid Detail</th>
                  <th className="px-6 py-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredUserSavings.map((saving) => {
                  const account = accounts.find(acc => acc.id === saving.accountId);
                  return (
                    <tr key={saving.id} className="hover:bg-slate-800 transition-colors text-text-primary">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDate(saving.date)}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium">{saving.name}</div>
                        {saving.notes && <div className="text-xs text-text-secondary">{saving.notes}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary">
                        {account ? account.name : 'Unknown'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${saving.type === SavingType.AUTO ? 'bg-sky-500/20 text-sky-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {saving.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-success">
                        {formatCurrency(saving.amount, globalDisplayCurrency)}
                      </td>
                      <td className="px-6 py-4 text-center text-xs">
                        {saving.paidDate && (
                          <div className="text-text-secondary">
                            Paid: {formatDate(saving.paidDate)}
                            {saving.paidAmount !== undefined && (
                              <div className="font-medium text-white">{formatCurrency(saving.paidAmount, globalDisplayCurrency)}</div>
                            )}
                          </div>
                        )}
                        {!saving.paidDate && <span className="text-slate-600">-</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => deleteSaving(saving.id)}
                          className="p-2 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-full transition-all"
                          title="Delete"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center">
            <ChartPieIcon className="w-16 h-16 mx-auto text-slate-700 mb-4" />
            <p className="text-text-secondary">No manual savings recorded for this month.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record New Saving">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField 
            label="Saving Name/Goal" 
            id="name" 
            value={newSaving.name} 
            onChange={handleInputChange} 
            placeholder="e.g., Emergency Fund, House Downpayment" 
            required 
            error={formErrors.name} 
          />
          
          <div className="grid grid-cols-2 gap-4">
            <FormField 
              label="Amount" 
              id="amount" 
              type="number" 
              value={newSaving.amount} 
              onChange={handleInputChange} 
              placeholder="0.00" 
              required 
              error={formErrors.amount} 
            />
            <FormField 
              label="Date" 
              id="date" 
              type="date" 
              value={newSaving.date} 
              onChange={handleInputChange} 
              required 
              error={formErrors.date} 
            />
          </div>

          <FormField 
            label="Account" 
            id="accountId" 
            type="select" 
            value={newSaving.accountId || ''} 
            onChange={handleInputChange}
            options={accounts.map(acc => ({ value: acc.id, label: `${acc.name} (${acc.currency})` }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField 
              label="Paid Date (Optional)" 
              id="paidDate" 
              type="date" 
              value={newSaving.paidDate || ''} 
              onChange={handleInputChange} 
            />
            <FormField 
              label="Paid Amount (Optional)" 
              id="paidAmount" 
              type="number" 
              value={newSaving.paidAmount || 0} 
              onChange={handleInputChange} 
            />
          </div>

          <FormField 
            label="Notes (Optional)" 
            id="notes" 
            type="textarea" 
            value={newSaving.notes || ''} 
            onChange={handleInputChange} 
            placeholder="Additional details..." 
          />

          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="mr-3 px-4 py-2 border border-slate-700 text-text-primary rounded-lg hover:bg-slate-800 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg shadow-md font-semibold transition-all"
            >
              Save Entry
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Import Savings from Excel">
        <form onSubmit={handleImportSubmit} className="space-y-4">
          <p className="text-sm text-text-secondary">
            Upload an Excel file with columns: Name, Amount, Date, Type, Notes, PaidDate, PaidAmount.
          </p>
          
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h4 className="text-sm font-medium text-text-primary mb-2">Step 1: Download Template</h4>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="text-primary hover:text-primary-dark text-sm font-medium flex items-center"
            >
              <ChartPieIcon className="w-4 h-4 mr-1" />
              Download Sample Savings Excel
            </button>
          </div>

          <FormField 
            label="Step 2: Associated Account" 
            id="importAccountId" 
            type="select" 
            value={importAccountId} 
            onChange={(e) => setImportAccountId(e.target.value)}
            options={accounts.map(acc => ({ value: acc.id, label: `${acc.name} (${acc.currency})` }))}
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-secondary">Step 3: Select File</label>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-slate-700 file:text-text-primary
                hover:file:bg-slate-600 cursor-pointer"
            />
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="mr-3 px-4 py-2 border border-slate-700 text-text-primary rounded-lg hover:bg-slate-800 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isImporting || !importFile || !importAccountId}
              className={`px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg shadow-md font-semibold transition-all ${
                (isImporting || !importFile || !importAccountId) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isImporting ? 'Importing...' : 'Upload & Import'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SavingsPage;
