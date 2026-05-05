import React, { useState, useEffect } from 'react';
import { AppSettings, PdfParserType, StorageMode } from '../types';
import FormField from '../components/forms/FormField';
import { Cog6ToothIcon } from '../components/icons';

interface SettingsPageProps {
  initialSettings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onPushToCosmos: (connectionString?: string) => Promise<boolean>;
  onPullFromCosmos: (connectionString?: string) => Promise<boolean>;
  onWipeLocalData: () => void;
  onArchiveCosmosData: () => Promise<boolean>;
  onError: (error: import('../types').GlobalErrorInfo) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ 
  initialSettings, 
  onSaveSettings,
  onPushToCosmos,
  onPullFromCosmos,
  onWipeLocalData,
  onArchiveCosmosData,
  onError
}) => {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ loading: boolean; message: string | null; error: boolean }>({
    loading: false,
    message: null,
    error: false
  });

  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; action: () => void | Promise<void> }>({
    open: false,
    title: "",
    message: "",
    action: () => {}
  });

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSettings(initialSettings); // Sync with props if they change (e.g. on initial load)
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [initialSettings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
    setSaveMessage(null); // Clear message on change
  };
  
  const handleParserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings(prev => ({ ...prev, selectedPdfParser: e.target.value as PdfParserType }));
    setSaveMessage(null);
  };

  const handleStorageModeChange = (mode: StorageMode) => {
    setSettings(prev => ({ ...prev, storageMode: mode }));
    setSaveMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(settings);
    setSaveMessage("Settings saved successfully!");
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handlePush = async () => {
    setSyncStatus({ loading: true, message: "Pushing data to Cosmos DB...", error: false });
    try {
      await onPushToCosmos(settings.cosmosConnectionString);
      setSyncStatus({ loading: false, message: "Data pushed successfully!", error: false });
    } catch (err) {
      setSyncStatus({ loading: false, message: "Push failed", error: true });
      onError({
        title: "Push to Cosmos Failed",
        message: "We encountered an error while trying to upload your local data to Azure Cosmos DB.",
        technicalDetails: err instanceof Error ? err.message : String(err),
        type: 'error'
      });
    }
    setTimeout(() => setSyncStatus(prev => ({ ...prev, message: null })), 5000);
  };

  const handlePull = async () => {
    setSyncStatus({ loading: true, message: "Pulling data from Cosmos DB...", error: false });
    try {
      const success = await onPullFromCosmos(settings.cosmosConnectionString);
      if (success) {
        setSyncStatus({ loading: false, message: "Data pulled successfully!", error: false });
      } else {
        setSyncStatus({ loading: false, message: "No data found or pull failed", error: true });
        onError({
          title: "Pull from Cosmos Failed",
          message: "We couldn't retrieve any data from your Cosmos DB. Please check your connection string and ensure data exists.",
          type: 'warning'
        });
      }
    } catch (err) {
      setSyncStatus({ loading: false, message: "Pull failed", error: true });
      onError({
        title: "Cloud Sync Error",
        message: "A technical error occurred while fetching your data from the cloud.",
        technicalDetails: err instanceof Error ? err.message : String(err),
        type: 'error'
      });
    }
    setTimeout(() => setSyncStatus(prev => ({ ...prev, message: null })), 5000);
  };

  const handleWipeLocal = () => {
    setConfirmModal({
      open: true,
      title: "Confirm Local Wipe",
      message: "Are you sure you want to WIPE all local data? This cannot be undone and will clear every record from this browser.",
      action: () => {
        onWipeLocalData();
        setSaveMessage("Local data wiped successfully.");
        setConfirmModal(prev => ({ ...prev, open: false }));
        setTimeout(() => setSaveMessage(null), 3000);
      }
    });
  };

  const handleArchiveCosmos = () => {
    setConfirmModal({
      open: true,
      title: "Archive Cosmos Data",
      message: "Are you sure you want to ARCHIVE your Cosmos DB data? This will move the current state to history and start fresh with an empty cloud database.",
      action: async () => {
        setSyncStatus({ loading: true, message: "Archiving Cosmos data...", error: false });
        setConfirmModal(prev => ({ ...prev, open: false }));
        try {
          await onArchiveCosmosData();
          setSyncStatus({ loading: false, message: "Data archived successfully!", error: false });
        } catch (err) {
          setSyncStatus({ loading: false, message: "Archive failed", error: true });
          onError({
            title: "Archival Operation Failed",
            message: "Something went wrong while attempting to archive your Cosmos DB records.",
            technicalDetails: err instanceof Error ? err.message : String(err),
            type: 'error'
          });
        }
        setTimeout(() => setSyncStatus(prev => ({ ...prev, message: null })), 5000);
      }
    });
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center space-x-3">
        <Cog6ToothIcon className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold text-text-primary">Settings</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-surface p-6 md:p-8 rounded-lg shadow-xl max-w-2xl mx-auto">
        
        <section className="space-y-4 border-b border-slate-700 pb-6">
          <h2 className="text-xl font-semibold text-text-primary">Storage Mode</h2>
          <div className="flex p-1 bg-slate-800 rounded-xl">
            {Object.values(StorageMode).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleStorageModeChange(mode)}
                className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 
                  ${settings.storageMode === mode 
                    ? 'bg-primary text-white shadow-lg' 
                    : 'text-text-secondary hover:text-text-primary'}`}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-secondary">
            {settings.storageMode === StorageMode.LOCAL 
              ? "All your financial data remains in this browser's local storage. This is fast and private but not synced across devices." 
              : "Your data is securely stored in Azure Cosmos DB and can be accessed from multiple devices using the same connection string."}
          </p>
        </section>

        <section className="space-y-4 border-b border-slate-700 pb-6">
          <h2 className="text-xl font-semibold text-text-primary">Document Import Configuration</h2>
          <FormField
            label="Preferred Parser for PDFs"
            id="selectedPdfParser"
            type="select"
            value={settings.selectedPdfParser}
            onChange={handleParserChange}
            options={Object.values(PdfParserType).map(type => ({ value: type, label: type }))}
            required
          />
           <p className="text-xs text-text-secondary">
            Choose the service to use for extracting transactions from PDF files.
          </p>
        </section>

        <section className="space-y-4 border-b border-slate-700 pb-6">
          <h2 className="text-xl font-semibold text-text-primary">Azure Cosmos DB</h2>
          <FormField
            label="Cosmos DB Connection String"
            id="cosmosConnectionString"
            type="password" 
            value={settings.cosmosConnectionString || ''}
            onChange={handleInputChange}
            placeholder="AccountEndpoint=https://...;AccountKey=...;"
          />
          <p className="text-xs text-text-secondary">
            Set your connection string to enable cloud synchronization.
          </p>
        </section>

        <section className="space-y-4 border-b border-slate-700 pb-6">
          <h2 className="text-xl font-semibold text-text-primary">Manual Synchronization</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={handlePush}
              disabled={syncStatus.loading}
              className="flex flex-col items-center justify-center p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center mb-2">
                <span className="text-primary text-xl">↑</span>
              </div>
              <span className="text-sm font-medium text-text-primary">Push to Cosmos</span>
              <span className="text-xs text-text-secondary mt-1 text-center">Update cloud with local data</span>
            </button>
            <button
              type="button"
              onClick={handlePull}
              disabled={syncStatus.loading}
              className="flex flex-col items-center justify-center p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center mb-2">
                <span className="text-primary text-xl">↓</span>
              </div>
              <span className="text-sm font-medium text-text-primary">Pull from Cosmos</span>
              <span className="text-xs text-text-secondary mt-1 text-center">Fetch cloud data into local</span>
            </button>
          </div>
          {syncStatus.message && (
            <div className={`p-3 rounded-lg text-sm font-medium text-center ${syncStatus.error ? 'bg-error/20 text-error' : 'bg-success/20 text-success'}`}>
              {syncStatus.message}
            </div>
          )}
        </section>

        <section className="space-y-4 border-b border-slate-700 pb-6">
          <h2 className="text-xl font-semibold text-text-primary">Data Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={handleWipeLocal}
              className="flex items-center justify-center space-x-2 p-3 bg-error/10 border border-error/30 text-error rounded-lg hover:bg-error/20 transition-colors"
            >
              <span>🗑️</span>
              <span className="font-medium">Wipe Local App Data</span>
            </button>
            <button
              type="button"
              onClick={handleArchiveCosmos}
              disabled={syncStatus.loading}
              className="flex items-center justify-center space-x-2 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            >
              <span>📦</span>
              <span className="font-medium">Archive Cosmos App Data</span>
            </button>
          </div>
          <p className="text-xs text-text-secondary">
            Wiping local data clears everything from this browser. Archiving Cosmos data moves your cloud data to history and starts fresh in the cloud.
          </p>
        </section>

        <section className="space-y-4 border-b border-slate-700 pb-6">
          <h2 className="text-xl font-semibold text-text-primary">Investment Tracking</h2>
          <FormField
            label="Automatic Price Refresh Frequency"
            id="trackingFrequency"
            type="select"
            value={settings.trackingFrequency}
            onChange={handleInputChange}
            options={[
              { value: 'none', label: 'Manual Only' },
              { value: 'once', label: 'Once a Day' },
              { value: 'thrice', label: 'Thrice a Day (Morning, Mid-day, EOD)' }
            ]}
          />
          <p className="text-xs text-text-secondary">
            Determine how often investments and SIPs should automatically pull the latest NAV/Market price.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">Azure Document Intelligence</h2>
          <FormField
            label="Azure Document Intelligence Endpoint"
            id="azureDocIntelEndpoint"
            type="url"
            value={settings.azureDocIntelEndpoint || ''}
            onChange={handleInputChange}
            placeholder="e.g., https://your-doc-intel.cognitiveservices.azure.com"
          />
          <FormField
            label="Azure Document Intelligence API Key"
            id="azureDocIntelKey"
            type="password"
            value={settings.azureDocIntelKey || ''}
            onChange={handleInputChange}
            placeholder="Enter your Azure DI API Key"
          />
           <p className="text-xs text-text-secondary">
            Required if you select Azure Document Intelligence as the PDF parser.
          </p>
        </section>
        
        <div className="pt-4 flex items-center justify-end">
            {saveMessage && <p className="text-sm text-success mr-4">{saveMessage}</p>}
            <button 
                type="submit" 
                className="bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out"
            >
            Save Settings
            </button>
        </div>
      </form>

      {confirmModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-text-primary mb-2">{confirmModal.title}</h3>
            <p className="text-text-secondary mb-6 leading-relaxed">{confirmModal.message}</p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-slate-700 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmModal.action()}
                className="px-6 py-2 bg-error hover:bg-error-dark text-white rounded-lg transition-colors font-semibold shadow-lg shadow-error/20"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
