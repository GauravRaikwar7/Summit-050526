import React, { useState } from 'react';
import { Account, AccountType, CurrencyCode, Transaction } from '../types';
import Modal from '../components/Modal';
import FormField from '../components/forms/FormField';
import { PlusCircleIcon, TrashIcon, WalletIcon } from '../components/icons';
import { formatCurrency, formatDate } from '../utils/formatters';
import { SUPPORTED_CURRENCIES } from '../constants';
import { calculateMonthlyBalances } from '../utils/finances';

interface AccountsPageProps {
  accounts: Account[];
  transactions: Transaction[];
  addAccount: (account: Omit<Account, 'id' | 'createdAt'>) => void;
  updateAccount: (account: Account) => void;
  deleteAccount: (accountId: string) => void;
  globalDisplayCurrency: CurrencyCode;
}

const AccountCard: React.FC<{ account: Account, transactions: Transaction[], onDelete: (id: string) => void }> = ({ account, transactions, onDelete }) => {
    const monthlyBalances = calculateMonthlyBalances(account, transactions);
    const [selectedMonthIndex, setSelectedMonthIndex] = useState(monthlyBalances.length - 1);
    
    // Instead of useEffect resetting state (which causes cascading renders), 
    // we set it initially. If length changes, we can manually adjust or let user decide.
    // If we want to force reset on length change, we can use a key on the component or this pattern:
    const lastIdx = monthlyBalances.length - 1;
    if (selectedMonthIndex === -1 && monthlyBalances.length > 0) {
        setSelectedMonthIndex(lastIdx);
    }

    const currentBalance = monthlyBalances[selectedMonthIndex];

    return (
    <div className="bg-surface p-5 rounded-lg shadow-lg hover:shadow-primary/30 transition-shadow space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-primary">{account.name}</h3>
          <p className="text-sm text-text-secondary">{account.type}</p>
        </div>
        <button onClick={() => onDelete(account.id)} className="text-danger hover:text-red-400" title="Delete Account" aria-label={`Delete account ${account.name}`}>
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>
      
      <div>
        <p className="text-2xl font-bold text-text-primary">
            {formatCurrency(account.balance, account.currency)}
            {account.type === AccountType.LOAN && <span className="text-xs font-normal text-text-secondary ml-2">outstanding</span>}
        </p>
        <div className="flex flex-col space-y-1">
          {account.lastUpdatedDate ? (
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center">
              <span className="w-1 h-1 bg-primary rounded-full mr-1.5 animate-pulse"></span>
              As of {formatDate(account.lastUpdatedDate)}
            </p>
          ) : (
            <p className="text-[10px] text-text-secondary uppercase tracking-wider">Created: {formatDate(account.createdAt)}</p>
          )}
        </div>
      </div>

      {account.type === AccountType.LOAN && (account.loanAmount || account.institution) && (
        <div className="bg-slate-800 p-3 rounded border border-slate-700 text-xs space-y-2">
            {account.institution && (
                <div className="flex justify-between">
                    <span className="text-text-secondary">Bank:</span>
                    <span className="text-text-primary font-medium">{account.institution}</span>
                </div>
            )}
            {account.loanAmount && (
                <div className="flex justify-between">
                    <span className="text-text-secondary">Original Loan:</span>
                    <span className="text-text-primary font-medium">{formatCurrency(account.loanAmount, account.currency)}</span>
                </div>
            )}
            {account.monthlyInstallment && (
                <div className="flex justify-between border-t border-slate-700 pt-1">
                    <span className="text-text-secondary">Monthly EMI:</span>
                    <span className="text-text-primary font-medium">{formatCurrency(account.monthlyInstallment, account.currency)}</span>
                </div>
            )}
            {account.interestRate && (
                <div className="flex justify-between">
                    <span className="text-text-secondary">Interest Rate:</span>
                    <span className="text-text-primary font-medium">{account.interestRate}%</span>
                </div>
            )}
        </div>
      )}

      {monthlyBalances.length > 0 && (
        <div className="pt-3 border-t border-slate-700">
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-semibold text-text-secondary uppercase">Monthly Summary</h4>
                {monthlyBalances.length > 1 && (
                    <select 
                        value={selectedMonthIndex} 
                        onChange={(e) => setSelectedMonthIndex(parseInt(e.target.value))}
                        className="text-[10px] bg-slate-800 border-none text-text-secondary rounded px-1 py-0"
                    >
                        {monthlyBalances.map((mb, idx) => (
                            <option key={mb.month} value={idx}>{mb.month}</option>
                        ))}
                    </select>
                )}
            </div>
            
            {currentBalance && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-700 p-2 rounded">
                        <p className="text-text-secondary">Opening ({currentBalance.month})</p>
                        <p className="font-medium text-text-primary">{formatCurrency(currentBalance.openingBalance, account.currency)}</p>
                    </div>
                    <div className="bg-slate-700 p-2 rounded">
                        <p className="text-text-secondary">Closing ({currentBalance.month})</p>
                        <p className="font-medium text-text-primary">{formatCurrency(currentBalance.closingBalance, account.currency)}</p>
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

const AccountsPage: React.FC<AccountsPageProps> = ({ accounts, transactions, addAccount, deleteAccount, globalDisplayCurrency }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const getInitialNewAccountState = () => ({
    name: '',
    type: AccountType.SAVINGS,
    balance: 0 as unknown as number,
    currency: globalDisplayCurrency,
    institution: '',
    loanAmount: '' as unknown as number,
    monthlyInstallment: '' as unknown as number,
    interestRate: '' as unknown as number,
    loanStartDate: '',
    loanEndDate: '',
  });

  const [newAccount, setNewAccount] = useState(getInitialNewAccountState());
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const handleOpenModal = () => {
    setNewAccount(getInitialNewAccountState());
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewAccount(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!newAccount.name.trim()) errors.name = "Account name is required.";
    const balanceNum = parseFloat(newAccount.balance as unknown as string);
    if (balanceNum < 0 && newAccount.type !== AccountType.CREDIT_CARD && newAccount.type !== AccountType.LOAN) {
       // Allow negative for credit cards/loans
    } else if (isNaN(balanceNum) && String(newAccount.balance) !== '') {
        errors.balance = "Initial balance must be a number.";
    }
    if (!newAccount.currency) errors.currency = "Currency is required.";
    
    if (newAccount.type === AccountType.LOAN) {
        if (!newAccount.institution?.trim()) errors.institution = "Bank Name is required.";
        if (!newAccount.loanAmount || parseFloat(newAccount.loanAmount as unknown as string) === 0) errors.loanAmount = "Loan Amount is required.";
        if (!newAccount.monthlyInstallment || parseFloat(newAccount.monthlyInstallment as unknown as string) === 0) errors.monthlyInstallment = "Monthly Installment is required.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    // Convert string inputs to proper numbers before saving
    const accountToAdd = {
        ...newAccount,
        balance: parseFloat(newAccount.balance as unknown as string) || 0,
        loanAmount: parseFloat(newAccount.loanAmount as unknown as string) || 0,
        monthlyInstallment: parseFloat(newAccount.monthlyInstallment as unknown as string) || 0,
        interestRate: parseFloat(newAccount.interestRate as unknown as string) || 0,
    };
    
    addAccount(accountToAdd);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-text-primary">Accounts</h1>
        <button
          onClick={handleOpenModal}
          className="bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out flex items-center"
        >
          <PlusCircleIcon className="w-5 h-5 mr-2" />
          Add Account
        </button>
      </div>

      {accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map(acc => (
            <AccountCard key={acc.id} account={acc} transactions={transactions} onDelete={deleteAccount} />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 bg-surface rounded-lg">
          <WalletIcon className="w-16 h-16 mx-auto text-text-secondary mb-4" />
          <p className="text-text-secondary text-lg">No accounts yet.</p>
          <p className="text-text-secondary text-sm">Click "Add Account" to get started.</p>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Account">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="Account Name"
            id="name"
            value={newAccount.name}
            onChange={handleInputChange}
            placeholder="e.g., Main Savings, Visa Card"
            required
            error={formErrors.name}
          />
          <FormField
            label="Account Type"
            id="type"
            type="select"
            value={newAccount.type}
            onChange={handleInputChange}
            options={Object.values(AccountType).map(type => ({ value: type, label: type }))}
            required
          />
          <FormField
            label="Initial Balance"
            id="balance"
            name="balance"
            type="number"
            value={newAccount.balance}
            onChange={handleInputChange}
            placeholder="0.00"
            step="0.01"
            required
            error={formErrors.balance}
            description={newAccount.type === AccountType.LOAN ? "The current total outstanding debt." : undefined}
          />

          {newAccount.type === AccountType.LOAN && (
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 space-y-4">
              <h4 className="text-sm font-semibold text-primary uppercase">Loan Particulars</h4>
              <FormField
                label="Bank Name"
                id="institution"
                name="institution"
                value={newAccount.institution}
                onChange={handleInputChange}
                placeholder="e.g., HDFC, SBI"
                required
                error={formErrors.institution}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Loan Amount"
                  id="loanAmount"
                  name="loanAmount"
                  type="number"
                  value={newAccount.loanAmount}
                  onChange={handleInputChange}
                  placeholder="Total sanctioned amount"
                  required
                  error={formErrors.loanAmount}
                />
                <FormField
                  label="Monthly Installment"
                  id="monthlyInstallment"
                  name="monthlyInstallment"
                  type="number"
                  value={newAccount.monthlyInstallment}
                  onChange={handleInputChange}
                  placeholder="Monthly payment"
                  required
                  error={formErrors.monthlyInstallment}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  label="Interest Rate (%)"
                  id="interestRate"
                  name="interestRate"
                  type="number"
                  value={newAccount.interestRate}
                  onChange={handleInputChange}
                  placeholder="e.g., 8.5"
                  step="0.01"
                />
                <FormField
                  label="Start Date"
                  id="loanStartDate"
                  name="loanStartDate"
                  type="date"
                  value={newAccount.loanStartDate}
                  onChange={handleInputChange}
                />
                <FormField
                  label="End Date"
                  id="loanEndDate"
                  name="loanEndDate"
                  type="date"
                  value={newAccount.loanEndDate}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          )}

          <FormField
            label="Currency"
            id="currency"
            type="select"
            value={newAccount.currency}
            onChange={handleInputChange}
            options={SUPPORTED_CURRENCIES.map(curr => ({ value: curr, label: curr }))}
            required
            error={formErrors.currency}
          />
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-text-secondary rounded-md hover:bg-slate-600 transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md shadow-sm transition-colors">
              Add Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AccountsPage;