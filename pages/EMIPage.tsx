import React, { useState } from 'react';
import { EMI, Account, CurrencyCode, AccountType } from '../types';
import Modal from '../components/Modal';
import FormField from '../components/forms/FormField';
import { PlusCircleIcon, TrashIcon, CreditCardIcon, ImportIcon, CalendarDaysIcon } from '../components/icons';
import { formatCurrency, formatDate, getTodayISOString } from '../utils/formatters';
import { excelParserService } from '../services/excelParserService';

interface EMIPageProps {
  emis: EMI[];
  addEMI: (emi: Omit<EMI, 'id'>) => void;
  batchAddEMIs: (emis: Omit<EMI, 'id'>[]) => void;
  deleteEMI: (emiId: string) => void;
  recordEmiPayment: (emiId: string, date: string, amount: number) => void;
  accounts: Account[];
  globalDisplayCurrency: CurrencyCode;
}

const EMICard: React.FC<{ 
  emi: EMI, 
  onDelete: (id: string) => void, 
  onRecordPayment: (emi: EMI) => void,
  displayCurrency: CurrencyCode, 
  accounts: Account[] 
}> = ({ emi, onDelete, onRecordPayment, displayCurrency, accounts }) => {
  const loanAccount = accounts.find(a => a.id === emi.loanAccountId);
  
  return (
    <div className="bg-surface p-5 rounded-lg shadow-lg hover:shadow-primary/30 transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-primary">{emi.name}</h3>
          <div className="flex flex-col">
            <p className="text-sm text-text-secondary">{emi.bankName}</p>
            {loanAccount && (
              <p className="text-xs text-amber-500 font-medium mt-0.5">Linked to: {loanAccount.name}</p>
            )}
          </div>
        </div>
        <button onClick={() => onDelete(emi.id)} className="text-danger hover:text-red-400" title="Delete EMI">
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Monthly Installment:</span>
          <span className="text-text-primary font-bold">{formatCurrency(emi.monthlyInstallment, displayCurrency)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Loan Amount:</span>
          <span className="text-text-primary font-medium">{formatCurrency(emi.loanAmount, displayCurrency)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Interest Rate:</span>
          <span className="text-text-primary font-medium">{emi.interestRate}%</span>
        </div>
        {emi.lastPaidDate && (
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Last Paid Date:</span>
            <span className="text-text-primary font-medium">{formatDate(emi.lastPaidDate)}</span>
          </div>
        )}
        {emi.lastPaidAmount !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Last Paid Amount:</span>
            <span className="text-text-primary font-bold">{formatCurrency(emi.lastPaidAmount, displayCurrency)}</span>
          </div>
        )}
        
        <div className="pt-2 border-t border-slate-700 flex justify-between text-xs text-text-secondary">
          <span>{formatDate(emi.startDate)} - {formatDate(emi.endDate)}</span>
        </div>

        <button 
          onClick={() => onRecordPayment(emi)} 
          className="mt-4 w-full flex items-center justify-center py-2 px-3 text-xs bg-slate-700 hover:bg-slate-600 rounded-md text-text-primary font-semibold transition-all border border-slate-600 active:scale-95"
        >
          <CalendarDaysIcon className="w-3.5 h-3.5 mr-2" />
          Record EMI Payment
        </button>
      </div>
    </div>
  );
};

const EMIPage: React.FC<EMIPageProps> = ({ emis, addEMI, batchAddEMIs, deleteEMI, recordEmiPayment, accounts, globalDisplayCurrency }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [currentEmi, setCurrentEmi] = useState<EMI | null>(null);
  const [importAccountId, setImportAccountId] = useState(accounts.length > 0 ? accounts[0].id : '');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  const getInitialEMIState = () => ({
    name: '',
    bankName: '',
    loanAmount: '' as unknown as number,
    monthlyInstallment: '' as unknown as number,
    interestRate: '' as unknown as number,
    startDate: getTodayISOString(),
    endDate: getTodayISOString(),
    accountId: accounts.filter(a => a.type !== AccountType.LOAN).length > 0 ? accounts.filter(a => a.type !== AccountType.LOAN)[0].id : '',
    loanAccountId: '',
    lastPaidDate: '',
    lastPaidAmount: '' as unknown as number,
  });

  const [paymentData, setPaymentData] = useState({
    date: getTodayISOString(),
    amount: 0
  });
  
  const [newEMI, setNewEMI] = useState(getInitialEMIState());
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setNewEMI(prev => {
        const updated = {
            ...prev,
            [name]: value
        };

        // If monthlyInstallment changes, set default payment amount if it was empty
        if (name === 'monthlyInstallment' && (!updated.lastPaidAmount || updated.lastPaidAmount === ('' as unknown as number))) {
            updated.lastPaidAmount = updated.monthlyInstallment;
        }

        // Auto-fill from Loan Account if selected
        if (name === 'loanAccountId' && value) {
            const loanAcc = accounts.find(a => a.id === value);
            if (loanAcc) {
                updated.name = `${loanAcc.name} EMI`;
                updated.bankName = loanAcc.institution || '';
                updated.loanAmount = loanAcc.loanAmount || 0;
                updated.monthlyInstallment = loanAcc.monthlyInstallment || 0;
                updated.interestRate = loanAcc.interestRate || 0;
                updated.lastPaidAmount = (loanAcc.monthlyInstallment || updated.lastPaidAmount) as unknown as number;
                updated.startDate = loanAcc.loanStartDate || updated.startDate;
                updated.endDate = loanAcc.loanEndDate || updated.endDate;
            }
        }
        
        return updated;
    });
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentEmi) {
      recordEmiPayment(
        currentEmi.id, 
        paymentData.date, 
        parseFloat(paymentData.amount as unknown as string)
      );
      setIsPaymentModalOpen(false);
      setCurrentEmi(null);
    }
  };

  const openPaymentModal = (emi: EMI) => {
    setCurrentEmi(emi);
    setPaymentData({
      date: getTodayISOString(),
      amount: emi.monthlyInstallment
    });
    setIsPaymentModalOpen(true);
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    const parseAmount = (val: unknown) => parseFloat(String(val)) || 0;
    
    if (!newEMI.name.trim()) errors.name = "Name is required.";
    if (!newEMI.bankName.trim()) errors.bankName = "Bank name is required.";
    if (parseAmount(newEMI.loanAmount) <= 0) errors.loanAmount = "Loan amount must be positive.";
    if (parseAmount(newEMI.monthlyInstallment) <= 0) errors.monthlyInstallment = "Monthly installment must be positive.";
    if (!newEMI.startDate) errors.startDate = "Start date is required.";
    if (!newEMI.endDate) errors.endDate = "End date is required.";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    const emiToAdd = {
        ...newEMI,
        loanAmount: parseFloat(newEMI.loanAmount as unknown as string) || 0,
        monthlyInstallment: parseFloat(newEMI.monthlyInstallment as unknown as string) || 0,
        interestRate: parseFloat(newEMI.interestRate as unknown as string) || 0,
        lastPaidAmount: (newEMI.lastPaidAmount as unknown as string) !== '' ? parseFloat(newEMI.lastPaidAmount as unknown as string) : undefined,
    };
    
    addEMI(emiToAdd);
    setIsModalOpen(false);
    setNewEMI(getInitialEMIState());
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !importAccountId) return;

    setIsImporting(true);
    const result = await excelParserService.parseEMIs(importFile, importAccountId);
    if (result.emis && result.emis.length > 0) {
      batchAddEMIs(result.emis);
      setIsImportModalOpen(false);
      setImportFile(null);
    } else if (result.error) {
      alert(result.error);
    }
    setIsImporting(false);
  };

  const handleDownloadSample = () => {
    excelParserService.downloadSampleExcel('emis');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-text-primary">EMIs</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-surface hover:bg-slate-700 text-text-primary font-semibold py-2 px-4 rounded-lg shadow-md transition-all flex items-center border border-slate-700"
          >
            <ImportIcon className="w-5 h-5 mr-2" />
            Import
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out flex items-center"
          >
            <PlusCircleIcon className="w-5 h-5 mr-2" />
            Add EMI
          </button>
        </div>
      </div>

      {emis.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {emis.map(emi => (
            <EMICard key={emi.id} emi={emi} onDelete={deleteEMI} onRecordPayment={openPaymentModal} displayCurrency={accounts.find(a => a.id === emi.accountId)?.currency || globalDisplayCurrency} accounts={accounts} />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 bg-surface rounded-lg">
          <CreditCardIcon className="w-16 h-16 mx-auto text-text-secondary mb-4" />
          <p className="text-text-secondary text-lg">No EMIs tracked yet.</p>
          <p className="text-text-secondary text-sm">Click "Add EMI" or "Import" to track your loans.</p>
        </div>
      )}


      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New EMI">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Loan Name" id="name" value={newEMI.name} onChange={handleInputChange} placeholder="e.g., Home Loan, Car Loan" required error={formErrors.name} />
          <FormField label="Bank Name" id="bankName" value={newEMI.bankName} onChange={handleInputChange} placeholder="e.g., HDFC, SBI" required error={formErrors.bankName} />
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Loan Amount" id="loanAmount" type="number" value={newEMI.loanAmount} onChange={handleInputChange} required error={formErrors.loanAmount} />
            <FormField label="Monthly Installment" id="monthlyInstallment" type="number" value={newEMI.monthlyInstallment} onChange={handleInputChange} required error={formErrors.monthlyInstallment} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Interest Rate (%)" id="interestRate" type="number" value={newEMI.interestRate} onChange={handleInputChange} step="0.1" />
            <FormField label="Deducted From" id="accountId" type="select" value={newEMI.accountId} onChange={handleInputChange} options={accounts.filter(a => a.type !== AccountType.LOAN).map(acc => ({ value: acc.id, label: acc.name }))} />
          </div>
          <FormField 
            label="Linked Loan Account (Optional)" 
            id="loanAccountId" 
            name="loanAccountId"
            type="select" 
            value={newEMI.loanAccountId} 
            onChange={handleInputChange} 
            options={[
              { value: '', label: 'None (Track EMI only)' },
              ...accounts.filter(a => a.type === AccountType.LOAN).map(acc => ({ value: acc.id, label: acc.name }))
            ]} 
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" id="startDate" type="date" value={newEMI.startDate} onChange={handleInputChange} required error={formErrors.startDate} />
            <FormField label="End Date" id="endDate" type="date" value={newEMI.endDate} onChange={handleInputChange} required error={formErrors.endDate} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Last Paid Date (Optional)" id="lastPaidDate" name="lastPaidDate" type="date" value={newEMI.lastPaidDate} onChange={handleInputChange} />
            <FormField label="Last Paid Amount (Optional)" id="lastPaidAmount" name="lastPaidAmount" type="number" value={newEMI.lastPaidAmount} onChange={handleInputChange} />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-text-secondary rounded-md hover:bg-slate-600 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md shadow-sm transition-colors">Add EMI</button>
          </div>
        </form>
      </Modal>

      {currentEmi && isPaymentModalOpen && (
        <Modal isOpen={isPaymentModalOpen} onClose={() => {setIsPaymentModalOpen(false); setCurrentEmi(null);}} title={`Record EMI Payment: ${currentEmi.name}`}>
          <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 mb-4">
               <div className="flex justify-between text-xs text-text-secondary uppercase tracking-widest font-bold">
                  <span>Loan Institution</span>
                  <span>Monthly EMI</span>
               </div>
               <div className="flex justify-between text-sm font-semibold text-text-primary mt-1">
                  <span>{currentEmi.bankName}</span>
                  <span>{formatCurrency(currentEmi.monthlyInstallment, accounts.find(a=>a.id===currentEmi.accountId)?.currency || globalDisplayCurrency)}</span>
               </div>
            </div>

            <FormField 
              label="Payment Date" 
              id="date" 
              type="date" 
              value={paymentData.date} 
              onChange={(e) => setPaymentData(prev => ({ ...prev, date: e.target.value }))} 
              required 
            />
            <FormField 
              label="Amount Paid" 
              id="amount" 
              type="number" 
              value={paymentData.amount} 
              onChange={(e) => setPaymentData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))} 
              required 
            />
            
            <p className="text-[10px] text-text-secondary leading-relaxed">
               Recording this will add an expense transaction to your account and update the last payment status for this EMI.
               {currentEmi.loanAccountId && " The principal loan account will also be updated with this payment."}
            </p>

            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={() => {setIsPaymentModalOpen(false); setCurrentEmi(null);}} className="px-4 py-2 text-sm font-medium text-text-secondary rounded-md hover:bg-slate-600 transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md shadow-sm transition-colors">Confirm Payment</button>
            </div>
          </form>
        </Modal>
      )}

      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Import EMIs from Excel">
        <form onSubmit={handleImportSubmit} className="space-y-4">
          <p className="text-sm text-text-secondary">
            Upload an Excel file with columns: Name, Bank, LoanAmount, MonthlyInstallment, StartDate, EndDate, InterestRate, PaidDate, PaidAmount.
          </p>
          
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h4 className="text-sm font-medium text-text-primary mb-2">Step 1: Download Template</h4>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="text-primary hover:text-primary-dark text-sm font-medium flex items-center"
            >
              <CreditCardIcon className="w-4 h-4 mr-1" />
              Download Sample EMI Excel
            </button>
          </div>

          <FormField 
            label="Step 2: Associated Account" 
            id="importAccountId" 
            type="select" 
            value={importAccountId} 
            onChange={(e) => setImportAccountId(e.target.value)}
            options={accounts.map(acc => ({ value: acc.id, label: acc.name }))}
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

export default EMIPage;
