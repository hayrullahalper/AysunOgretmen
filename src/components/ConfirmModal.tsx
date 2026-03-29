import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'primary' | 'success';
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Evet',
  cancelText = 'Vazgeç',
  onConfirm,
  onCancel,
  variant = 'primary'
}: ConfirmModalProps) {
  const variantClasses = {
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/20',
    primary: 'bg-primary hover:bg-primary/90 text-white shadow-primary/20',
    success: 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/20'
  };

  const iconClasses = {
    danger: 'text-red-500 bg-red-500/10',
    primary: 'text-primary bg-primary/10',
    success: 'text-green-500 bg-green-500/10'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="glass p-8 rounded-[2.5rem] w-full max-w-md space-y-6 bg-slate-900 border-slate-700 shadow-2xl relative overflow-hidden"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${iconClasses[variant]}`}>
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-100">{title}</h3>
            </div>

            <p className="text-slate-400 font-medium leading-relaxed">
              {message}
            </p>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <button
                onClick={onCancel}
                className="py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all border border-slate-700"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`py-4 rounded-2xl font-bold transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] ${variantClasses[variant]}`}
              >
                {confirmText}
              </button>
            </div>

            <button
              onClick={onCancel}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
