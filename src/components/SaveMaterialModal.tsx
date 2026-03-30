import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Save, X, Info } from 'lucide-react';

interface SaveMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  defaultName: string;
  title?: string;
}

export default function SaveMaterialModal({ 
  isOpen, 
  onClose, 
  onSave, 
  defaultName,
  title = "Materyali Kaydet"
}: SaveMaterialModalProps) {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
    }
  }, [isOpen, defaultName]);

  const handleSave = () => {
    onSave(name || defaultName);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="glass p-8 rounded-[2.5rem] w-full max-w-md space-y-6 bg-slate-800 border-slate-700 shadow-2xl"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-primary flex items-center gap-2">
                <Save className="text-green-500" /> {title}
              </h3>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 ml-1">Materyal Adı</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Materyal için bir isim girin..."
                  className="input-field bg-slate-900 border-slate-700 focus:border-primary text-lg py-4"
                  autoFocus
                />
              </div>

              <div className="p-4 bg-blue-900/20 rounded-2xl border border-blue-800/30 flex gap-3">
                <Info className="text-blue-400 shrink-0" size={20} />
                <p className="text-xs text-blue-300 leading-relaxed">
                  Materyalinize özel bir isim verebilirsiniz. Boş bırakırsanız varsayılan isim kullanılacaktır.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-bold transition-all"
              >
                Vazgeç
              </button>
              <button
                onClick={handleSave}
                className="flex-[2] py-4 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
              >
                Kaydet
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
