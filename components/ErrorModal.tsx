import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, Info, Bug } from 'lucide-react';
import { GlobalErrorInfo } from '../types';

interface ErrorModalProps {
  error: GlobalErrorInfo | null;
  onClose: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ error, onClose }) => {
  if (!error) return null;

  const getIcon = () => {
    switch (error.type) {
      case 'warning':
        return <AlertTriangle className="w-12 h-12 text-amber-500" />;
      case 'info':
        return <Info className="w-12 h-12 text-blue-500" />;
      default:
        return <Bug className="w-12 h-12 text-error" />;
    }
  };

  const getTypeStyles = () => {
    switch (error.type) {
      case 'warning':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-500';
      case 'info':
        return 'border-blue-500/30 bg-blue-500/10 text-blue-500';
      default:
        return 'border-error/30 bg-error/10 text-error';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]"
        >
          <div className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-slate-800 rounded-2xl shadow-inner border border-slate-700/50">
                {getIcon()}
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-text-secondary hover:text-text-primary hover:bg-slate-800 rounded-xl transition-all active:scale-95"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getTypeStyles()}`}>
                {error.type || 'Error'}
              </div>
              
              <h2 className="text-2xl font-bold text-text-primary leading-tight">
                {error.title}
              </h2>
              
              <p className="text-text-secondary text-lg leading-relaxed font-medium">
                {error.message}
              </p>

              {error.technicalDetails && (
                <div className="mt-8 pt-6 border-t border-slate-800">
                  <p className="text-xs font-bold text-text-muted mb-3 uppercase tracking-widest flex items-center">
                    <span className="w-4 h-[1px] bg-slate-700 mr-2"></span>
                    Technical Breakdown
                  </p>
                  <div className="bg-black/40 rounded-2xl p-4 border border-slate-800/50">
                    <code className="text-xs text-amber-500/90 font-mono break-all whitespace-pre-wrap leading-relaxed">
                      {error.technicalDetails}
                    </code>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-10">
              <button
                onClick={onClose}
                className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-2xl transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
              >
                Got it, understood
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ErrorModal;
