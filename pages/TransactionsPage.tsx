
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, TransactionType, Account, RawTransaction } from '../types';
import Modal from '../components/Modal';
import FormField from '../components/forms/FormField';
import { PlusCircleIcon, TrashIcon, ArrowPathIcon, PencilSquareIcon } from '../components/icons';
import { formatCurrency, formatDate, getTodayISOString } from '../utils/formatters';
import { excelParserService } from '../services/excelParserService';
import { ALL_CATEGORIES } from '../constants';
import { documentParserService } from '../services/documentParserService';

interface TransactionsPageProps {
  transactions: Transaction[];
  addTransaction: (transaction: RawTransaction & { accountId: string }) => void;
  batchAddTransactions: (newTransactions: (RawTransaction & { accountId: string })[]) => void;
  updateTransaction: (transaction: Transaction) => void;
  deleteTransaction: (transactionId: string) => void;
  accounts: Account[];
  onError?: (error: import('../types').GlobalErrorInfo) => void;
}

interface TransactionRowProps {
  transaction: Transaction;
  account?: Account; 
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  balanceAfterTransaction: number;
}

const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, account, onEdit, onDelete, balanceAfterTransaction }) => {
  const currency = account?.currency;

  return (
    <tr className="hover:bg-slate-700 transition-colors duration-150 group">
      <td className="py-3 px-4 text-sm text-text-secondary">{formatDate(transaction.date)}</td>
      <td className="py-3 px-4">
        <div className="text-text-primary font-medium">{transaction.friendlyDescription || transaction.description}</div>
        <div className="text-xs text-text-secondary truncate max-w-[200px]" title={transaction.description}>{transaction.description}</div>
      </td>
      <td className="py-3 px-4 text-sm text-text-secondary">{account?.name || 'N/A'}</td>
      <td className="py-3 px-4 text-sm text-text-secondary">{transaction.category}</td>
      <td className="py-3 px-4 text-sm text-success text-right">
        {transaction.type === TransactionType.INCOME ? formatCurrency(transaction.amount, currency) : ''}
      </td>
      <td className="py-3 px-4 text-sm text-danger text-right">
        {(transaction.type === TransactionType.EXPENSE || transaction.type === TransactionType.EMI || transaction.type === TransactionType.INVESTMENT) ? formatCurrency(transaction.amount, currency) : ''}
      </td>
      <td className="py-3 px-4 text-sm text-text-secondary text-right font-mono">
        {currency ? formatCurrency(balanceAfterTransaction, currency) : 'N/A'}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end space-x-2">
          <button onClick={() => onEdit(transaction)} className="text-primary hover:text-blue-400 p-1 rounded hover:bg-slate-600 transition-colors" title="Edit Transaction">
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(transaction.id)} className="text-danger hover:text-red-400 p-1 rounded hover:bg-slate-600 transition-colors" title="Delete Transaction">
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};


const TransactionsPage: React.FC<TransactionsPageProps> = ({ transactions, addTransaction, batchAddTransactions, updateTransaction, deleteTransaction, accounts, onError }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const getInitialTransactionState = useCallback(() => ({
    accountId: accounts.length > 0 ? accounts[0].id : '',
    date: getTodayISOString(),
    description: '',
    friendlyDescription: '',
    amount: '' as unknown as number,
    type: TransactionType.EXPENSE,
    category: '',
    notes: '',
  }), [accounts]);

  const [newTransaction, setNewTransaction] = useState(getInitialTransactionState());
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);
  const [importAccountId, setImportAccountId] = useState<string>(accounts.length > 0 ? accounts[0].id : '');
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Derived state for import readiness
  const selectedPdfParser = documentParserService.getSelectedParser();
  const isSelectedParserConfigured = documentParserService.isConfigured();
  const parserNotConfiguredReason = documentParserService.getNotConfiguredReason();


  useEffect(() => {
    if (accounts.length > 0 && !importAccountId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImportAccountId(accounts[0].id);
    } else if (accounts.length === 0 && importAccountId) {
      setImportAccountId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length]); 
  
  const availableCategories = useMemo(() => {
    const currentType = editingTransaction ? editingTransaction.type : newTransaction.type;
    return ALL_CATEGORIES.filter(c => c.type === currentType).map(c => ({ value: c.name, label: c.name }));
  }, [newTransaction.type, editingTransaction]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewTransaction(prev => {
        const next = {
            ...prev,
            [name]: value,
        };
        // If type changed, reset category to empty if current category is not valid for new type
        if (name === 'type') {
            const nextAvailableCategories = ALL_CATEGORIES.filter(c => c.type === (value as TransactionType)).map(c => c.name);
            if (!nextAvailableCategories.includes(next.category)) {
                next.category = '';
            }
        }
        return next;
    });
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    const parseAmount = (val: unknown) => parseFloat(String(val)) || 0;
    if (!newTransaction.accountId) errors.accountId = "Account is required.";
    if (!newTransaction.date) errors.date = "Date is required.";
    if (!newTransaction.description.trim()) errors.description = "Description is required.";
    if (isNaN(parseAmount(newTransaction.amount)) || parseAmount(newTransaction.amount) <= 0) errors.amount = "Amount must be a positive number.";
    if (!newTransaction.category) errors.category = "Category is required.";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    addTransaction({ // Ensure all fields for RawTransaction + accountId are present
        date: newTransaction.date,
        description: newTransaction.description,
        friendlyDescription: newTransaction.friendlyDescription || newTransaction.description,
        amount: parseFloat(newTransaction.amount as unknown as string) || 0,
        type: newTransaction.type,
        category: newTransaction.category,
        notes: newTransaction.notes,
        accountId: newTransaction.accountId,
    });
    setIsModalOpen(false);
    setNewTransaction(getInitialTransactionState());
    setFormErrors({});
  };

  const handleEditClick = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTransaction) {
      const txToUpdate = {
        ...editingTransaction,
        amount: parseFloat(editingTransaction.amount as unknown as string) || 0
      };
      updateTransaction(txToUpdate);
      setIsEditModalOpen(false);
      setEditingTransaction(null);
    }
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (editingTransaction) {
      setEditingTransaction({
        ...editingTransaction,
        [name]: value
      });
    }
  };
  
  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedPdfFile(e.target.files[0]);
      setImportMessage(null);
    } else {
      setSelectedPdfFile(null);
    }
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedExcelFile(e.target.files[0]);
      setImportMessage(null);
    } else {
      setSelectedExcelFile(null);
    }
  };

  const handlePdfImport = async () => {
    if (!selectedPdfFile || !importAccountId) {
      setImportMessage({ type: 'error', text: "Please select a PDF file and a target account." });
      return;
    }
    if (!isSelectedParserConfigured) {
      setImportMessage({ type: 'error', text: parserNotConfiguredReason || "Selected PDF parser is not configured. Check Settings." });
      return;
    }

    setIsImporting(true);
    setImportMessage(null);
    const targetAccount = accounts.find(acc => acc.id === importAccountId);
    if (!targetAccount) {
        setImportMessage({ type: 'error', text: "Selected account not found." });
        setIsImporting(false);
        return;
    }

    const result = await documentParserService.parseTransactionsFromPdf(selectedPdfFile);
    
    if (result.error) {
      setImportMessage({ type: 'error', text: result.error });
      if (onError) {
        onError({
          title: "PDF Parsing Failed",
          message: "The document extraction service returned an error.",
          technicalDetails: result.error,
          type: 'error'
        });
      }
    } else if (result.transactions.length === 0) {
      setImportMessage({ type: 'info', text: result.message || "No transactions were extracted from the PDF." });
    } else {
      const txsWithId = result.transactions.map(tx => ({ ...tx, accountId: importAccountId }));
      batchAddTransactions(txsWithId);
      setImportMessage({ type: 'success', text: `Successfully imported ${result.transactions.length} transaction(s). Duplicates were skipped.` });
      setSelectedPdfFile(null); 
      const fileInput = document.getElementById('pdfFileImport') as HTMLInputElement;
      if (fileInput) fileInput.value = ''; 
    }
    setIsImporting(false);
  };

  const handleExcelImport = async () => {
    if (!selectedExcelFile || !importAccountId) {
      setImportMessage({ type: 'error', text: "Please select an Excel file and a target account." });
      return;
    }

    setIsImporting(true);
    setImportMessage(null);
    const targetAccount = accounts.find(acc => acc.id === importAccountId);
    if (!targetAccount) {
        setImportMessage({ type: 'error', text: "Selected account not found." });
        setIsImporting(false);
        return;
    }

    const result = await documentParserService.parseTransactionsFromExcel(selectedExcelFile);
    
    if (result.error) {
      setImportMessage({ type: 'error', text: result.error });
      if (onError) {
        onError({
          title: "Excel Import Error",
          message: "We couldn't process the uploaded Excel file correctly.",
          technicalDetails: result.error,
          type: 'error'
        });
      }
    } else if (result.transactions.length === 0) {
      setImportMessage({ type: 'info', text: result.message || "No transactions were extracted from the Excel file." });
    } else {
      const txsWithId = result.transactions.map(tx => ({ ...tx, accountId: importAccountId }));
      batchAddTransactions(txsWithId, result.finalBalance);
      setImportMessage({ type: 'success', text: `Successfully imported ${result.transactions.length} transaction(s) from Excel. Duplicates were skipped. Account balance updated to statement closing balance.` });
      setSelectedExcelFile(null); 
      const fileInput = document.getElementById('excelFileImport') as HTMLInputElement;
      if (fileInput) fileInput.value = ''; 
    }
    setIsImporting(false);
  };

  const handleDownloadSample = () => {
    excelParserService.downloadSampleExcel('transactions');
  };
  
  const handleOpenModal = () => {
    setNewTransaction(getInitialTransactionState()); 
    setFormErrors({});
    setIsModalOpen(true);
  };

  const transactionsWithRunningBalance = useMemo(() => {
    const transactionsByAccount: { [accountId: string]: Transaction[] } = {};
    transactions.forEach(tx => {
      if (!transactionsByAccount[tx.accountId]) {
        transactionsByAccount[tx.accountId] = [];
      }
      transactionsByAccount[tx.accountId].push(tx);
    });

    for (const accId in transactionsByAccount) {
        transactionsByAccount[accId].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    
    return transactions.map(tx => {
      const account = accounts.find(acc => acc.id === tx.accountId);
      if (!account) {
        return { ...tx, balanceAfterTransaction: 0, account: undefined };
      }

      let balanceAfterTx = account.balance; 
      const accountTransactions = transactionsByAccount[tx.accountId] || [];
      const currentTxIndexInAccountList = accountTransactions.findIndex(t => t.id === tx.id);

      for (let i = 0; i < currentTxIndexInAccountList; i++) {
        const newerTx = accountTransactions[i];
        const impact = newerTx.type === TransactionType.INCOME ? newerTx.amount : -newerTx.amount;
        balanceAfterTx -= impact; 
      }
      return { ...tx, balanceAfterTransaction: balanceAfterTx, account };
    });
  }, [transactions, accounts]);


  if (accounts.length === 0 && !isModalOpen) {
    return (
       <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-text-primary">Transactions</h1>
          <button
            onClick={handleOpenModal}
            className="bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out flex items-center"
          >
            <PlusCircleIcon className="w-5 h-5 mr-2" />
            Add Manually
          </button>
        </div>
         <div className="text-center py-10 bg-surface rounded-lg">
            <ArrowPathIcon className="w-16 h-16 mx-auto text-text-secondary mb-4" />
            <p className="text-text-secondary text-lg">No accounts found.</p>
            <p className="text-text-secondary text-sm">Please add an account on the Accounts page before adding or importing transactions.</p>
          </div>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-text-primary">Transactions</h1>
        <button
          onClick={handleOpenModal}
          disabled={accounts.length === 0}
          className="bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlusCircleIcon className="w-5 h-5 mr-2" />
          Add Manually
        </button>
      </div>
      
      <div className="bg-surface p-6 rounded-lg shadow-lg space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-text-primary">Import Transactions</h2>
          {accounts.length > 0 && (
            <div className="w-full md:w-64">
              <FormField
                label="Target Account"
                id="importAccountId"
                type="select"
                value={importAccountId}
                onChange={(e) => setImportAccountId(e.target.value)}
                options={accounts.map(acc => ({ value: acc.id, label: `${acc.name} (${formatCurrency(0, acc.currency).replace(/[0-9.,\s]/g, '')})` }))} 
                required
                disabled={isImporting}
              />
            </div>
          )}
        </div>

        {accounts.length === 0 ? (
           <p className="text-amber-300 text-sm">Please add an account first to enable import.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4 lg:border-r lg:border-slate-700 lg:pr-8">
              <h3 className="text-lg font-medium text-text-primary">PDF Import (using {selectedPdfParser || 'N/A'})</h3>
              {!selectedPdfParser ? (
                <p className="text-amber-300 text-sm">No PDF parser selected. Please choose one in Settings.</p>
              ) : !isSelectedParserConfigured ? (
                <p className="text-amber-300 text-sm">{parserNotConfiguredReason}</p>
              ) : (
                <>
                  <div>
                    <label htmlFor="pdfFileImport" className="block text-sm font-medium text-text-secondary mb-1">
                      Select PDF File
                    </label>
                    <input
                      type="file"
                      id="pdfFileImport"
                      accept=".pdf"
                      onChange={handlePdfFileChange}
                      disabled={isImporting}
                      className="block w-full text-sm text-slate-300
                                 file:mr-4 file:py-2 file:px-4
                                 file:rounded-md file:border-0
                                 file:text-sm file:font-semibold
                                 file:bg-primary file:text-white
                                 hover:file:bg-primary-dark
                                 disabled:opacity-50"
                    />
                  </div>
                  <button
                    onClick={handlePdfImport}
                    disabled={isImporting || !selectedPdfFile || !importAccountId}
                    className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImporting && selectedPdfFile ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing PDF...
                      </>
                    ) : `Import PDF with ${selectedPdfParser}`}
                  </button>
                </>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-text-primary">Excel Import (.xlsx, .xls)</h3>
                <button onClick={handleDownloadSample} className="text-xs text-primary hover:underline font-medium">
                  Download Sample
                </button>
              </div>
              <div>
                <label htmlFor="excelFileImport" className="block text-sm font-medium text-text-secondary mb-1">
                  Select Excel File
                </label>
                <input
                  type="file"
                  id="excelFileImport"
                  accept=".xlsx, .xls"
                  onChange={handleExcelFileChange}
                  disabled={isImporting}
                  className="block w-full text-sm text-slate-300
                             file:mr-4 file:py-2 file:px-4
                             file:rounded-md file:border-0
                             file:text-sm file:font-semibold
                             file:bg-success file:text-white
                             hover:file:bg-emerald-600
                             disabled:opacity-50"
                />
              </div>
              <button
                onClick={handleExcelImport}
                disabled={isImporting || !selectedExcelFile || !importAccountId}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting && selectedExcelFile ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing Excel...
                  </>
                ) : `Import from Excel`}
              </button>
            </div>
          </div>
        )}

        {importMessage && (
          <p className={`text-sm mt-4 p-3 rounded-md bg-opacity-10 border border-current ${importMessage.type === 'success' ? 'text-success bg-success border-success' : importMessage.type === 'error' ? 'text-danger bg-danger border-danger' : 'text-amber-400 bg-amber-400 border-amber-400'}`}>
            {importMessage.text}
          </p>
        )}
      </div>


      {transactionsWithRunningBalance.length > 0 ? (
        <div className="bg-surface shadow-lg rounded-lg overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-slate-700">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Date</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Description</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Account</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Category</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Credit</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Debit</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Balance</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-600">
              {transactionsWithRunningBalance.map(txData => (
                <TransactionRow 
                  key={txData.id} 
                  transaction={txData} 
                  account={txData.account} 
                  onEdit={handleEditClick}
                  onDelete={deleteTransaction}
                  balanceAfterTransaction={txData.balanceAfterTransaction} 
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !isModalOpen && ( 
          <div className="text-center py-10 bg-surface rounded-lg">
            <ArrowPathIcon className="w-16 h-16 mx-auto text-text-secondary mb-4" />
            <p className="text-text-secondary text-lg">No transactions yet.</p>
            <p className="text-text-secondary text-sm">Add transactions manually or import them from a PDF.</p>
          </div>
        )
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Transaction">
        {accounts.length === 0 ? (
          <div className="p-4 text-center">
             <p className="text-text-primary text-lg mb-2">No Accounts Available</p>
             <p className="text-text-secondary text-sm">You need to add an account first before you can add a transaction.</p>
             <button 
                onClick={() => setIsModalOpen(false)} 
                className="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md shadow-sm transition-colors"
              >
                Close
              </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="Account"
            id="accountId"
            type="select"
            value={newTransaction.accountId}
            onChange={handleInputChange}
            options={accounts.map(acc => ({ value: acc.id, label: `${acc.name} (${formatCurrency(acc.balance, acc.currency)})` }))}
            required
            error={formErrors.accountId}
          />
          <FormField
            label="Date"
            id="date"
            type="date"
            value={newTransaction.date}
            onChange={handleInputChange}
            required
            error={formErrors.date}
          />
          <FormField
            label="Description"
            id="description"
            value={newTransaction.description}
            onChange={handleInputChange}
            placeholder="e.g., Groceries, Salary"
            required
            error={formErrors.description}
          />
          <FormField
            label="Friendly Description"
            id="friendlyDescription"
            value={newTransaction.friendlyDescription}
            onChange={handleInputChange}
            placeholder="Same as description if empty"
            error={formErrors.friendlyDescription}
          />
          <FormField
            label="Amount"
            id="amount"
            name="amount"
            type="number"
            value={newTransaction.amount}
            onChange={handleInputChange}
            placeholder="0.00"
            min="0.01"
            step="0.01"
            required
            error={formErrors.amount}
          />
          <FormField
            label="Type"
            id="type"
            type="select"
            value={newTransaction.type}
            onChange={handleInputChange}
            options={Object.values(TransactionType).map(type => ({ value: type, label: type }))}
            required
          />
           <div className="relative">
            <FormField
              label="Category"
              id="category"
              type="select"
              value={newTransaction.category}
              onChange={handleInputChange}
              options={availableCategories}
              placeholder="Select a category"
              required
              error={formErrors.category}
            />
          </div>

          <FormField
            label="Notes (Optional)"
            id="notes"
            type="textarea"
            value={newTransaction.notes || ''}
            onChange={handleInputChange}
            placeholder="Any additional details..."
          />
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-text-secondary rounded-md hover:bg-slate-600 transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md shadow-sm transition-colors">
              Add Transaction
            </button>
          </div>
        </form>
        )}
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Transaction">
        {editingTransaction && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <FormField
              label="Friendly Description"
              id="friendlyDescription"
              value={editingTransaction.friendlyDescription || ''}
              onChange={handleEditChange}
              placeholder="Enter friendly name"
              required
            />
             <FormField
              label="Date"
              id="date"
              type="date"
              value={editingTransaction.date}
              onChange={handleEditChange}
              required
            />
            <FormField
              label="Amount"
              id="amount"
              name="amount"
              type="number"
              value={editingTransaction.amount}
              onChange={handleEditChange}
              step="0.01"
              required
            />
            <FormField
              label="Type"
              id="type"
              type="select"
              value={editingTransaction.type}
              onChange={handleEditChange}
              options={Object.values(TransactionType).map(type => ({ value: type, label: type }))}
              required
            />
            <FormField
              label="Category"
              id="category"
              type="select"
              value={editingTransaction.category}
              onChange={handleEditChange}
              options={ALL_CATEGORIES.filter(c => c.type === editingTransaction.type).map(c => ({ value: c.name, label: c.name }))}
              required
            />
            <FormField
              label="Notes"
              id="notes"
              type="textarea"
              value={editingTransaction.notes || ''}
              onChange={handleEditChange}
            />
             <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-text-secondary rounded-md hover:bg-slate-600 transition-colors">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md shadow-sm transition-colors">
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default TransactionsPage;
