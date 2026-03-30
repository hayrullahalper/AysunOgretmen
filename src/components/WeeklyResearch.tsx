import React, { useState, useEffect, useCallback } from 'react';
import { geminiService } from '../lib/gemini';
import { firestoreService } from '../lib/firestore';
import { Search, Youtube, Sparkles, Loader2, BookOpen, ExternalLink, RefreshCw, Save, Check, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../hooks/useSettings';
import SaveMaterialModal from './SaveMaterialModal';

export default function WeeklyResearch() {
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [research, setResearch] = useState<any>(null);
  const [grade, setGrade] = useState('1');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  const generateResearch = useCallback(async (currentGrade?: string) => {
    setLoading(true);
    setResearch(null);
    setSaveSuccess(false);
    setShowAnswers(false);
    try {
      const data = await geminiService.generateWeeklyResearch(currentGrade || grade);
      setResearch(data);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Haftalık araştırma konusu oluşturulurken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [grade]);

  useEffect(() => {
    if (settings) {
      setGrade(settings.defaultGrade);
      generateResearch(settings.defaultGrade);
    } else {
      generateResearch('1');
    }
  }, [settings]);

  const handleSave = async (customName: string) => {
    if (!research) return;
    setShowConfirmSave(false);
    try {
      await firestoreService.saveMaterial({
        id: crypto.randomUUID(),
        title: customName || research.topic,
        content: research,
        type: 'research',
        createdAt: new Date().toISOString(),
        ownerId: ''
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error(error);
      alert('Kaydedilirken bir hata oluştu.');
    }
  };

  const defaultSaveName = `Araştırma - ${research?.topic || ''}`;

  return (
    <div className="space-y-6">
      <SaveMaterialModal
        isOpen={showConfirmSave}
        onClose={() => setShowConfirmSave(false)}
        onSave={handleSave}
        defaultName={defaultSaveName}
      />

      <div className="glass p-8 rounded-3xl bg-slate-800/70 border-slate-700">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-black flex items-center gap-3 text-primary">
            <Search className="text-primary" size={32} /> Haftalık Araştırma Konusu
          </h2>
          <button 
            onClick={() => generateResearch()}
            disabled={loading}
            className="p-3 rounded-2xl hover:bg-slate-700 text-slate-400 transition-all hover:scale-110 active:rotate-180"
            title="Yeni Konu Üret"
          >
            <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center p-20 space-y-4"
            >
              <div className="relative">
                <Loader2 className="animate-spin text-primary" size={64} />
                <Sparkles className="absolute -top-2 -right-2 text-yellow-500 animate-pulse" size={24} />
              </div>
              <p className="text-xl font-bold opacity-70">Bu haftanın konusu belirleniyor...</p>
            </motion.div>
          ) : research ? (
            <motion.div 
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="p-8 bg-primary/10 border-2 border-primary/20 rounded-[2rem] space-y-4 relative group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-sm">
                    <Sparkles size={18} /> HAFTANIN KONUSU
                  </div>
                  <button 
                    onClick={() => setShowConfirmSave(true)}
                    disabled={saveSuccess}
                    className={`p-2 rounded-xl transition-all ${saveSuccess ? 'text-green-500 bg-green-500/10' : 'text-slate-400 hover:text-primary hover:bg-primary/10'}`}
                    title="Kaydet"
                  >
                    {saveSuccess ? <Check size={24} /> : <Save size={24} />}
                  </button>
                </div>
                <h3 className="text-4xl font-black text-slate-100">{research.topic}</h3>
                <p className="text-xl text-slate-300 leading-relaxed opacity-90">
                  {research.description}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="glass p-6 rounded-3xl bg-slate-800/50 border-slate-700 space-y-4">
                  <h4 className="text-xl font-bold flex items-center gap-2 text-slate-100">
                    <BookOpen className="text-secondary" /> Araştırma Soruları
                  </h4>
                  <ul className="space-y-3">
                    {research.researchQuestions.map((q: any, i: number) => (
                      <li key={i} className="flex flex-col gap-2 p-4 bg-slate-800/80 rounded-2xl border border-slate-700">
                        <div className="flex gap-3 text-slate-300">
                          <span className="flex-shrink-0 w-6 h-6 bg-secondary/20 text-secondary rounded-full flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </span>
                          <span className="font-medium">{q.question}</span>
                        </div>
                        <AnimatePresence>
                          {showAnswers && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="ml-9 p-3 bg-green-900/20 border border-green-900/30 rounded-xl text-sm text-green-400 italic"
                            >
                              {q.answer}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="glass p-6 rounded-3xl bg-slate-800/50 border-slate-700 space-y-6">
                  <div className="space-y-4">
                    <h4 className="text-xl font-bold flex items-center gap-2 text-slate-100">
                      <HelpCircle className="text-primary" /> Yardımcı Materyaller
                    </h4>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Konuyu derinlemesine öğrenmek için hazırlanan yardımcı kaynakları aşağıda bulabilirsiniz.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <p className="text-slate-300 font-medium bg-slate-900/40 p-4 rounded-2xl border border-slate-700/50">
                      Konuyla ilgili eğitici videoyu izleyebilir ve araştırma sorularının cevaplarını kontrol ederek bilgilerinizi pekiştirebilirsiniz:
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <a 
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(research.videoSearchKeywords)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-5 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg transition-all hover:scale-[1.02] active:scale-95 text-lg"
                      >
                        <Youtube size={28} /> VİDEOYU İZLE
                      </a>
                      
                      <button 
                        onClick={() => setShowAnswers(!showAnswers)}
                        className={`flex-1 py-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg transition-all hover:scale-[1.02] active:scale-95 text-lg border-2 ${
                          showAnswers 
                            ? 'bg-slate-700 border-slate-600 text-slate-300' 
                            : 'bg-secondary border-secondary/50 text-white'
                        }`}
                      >
                        {showAnswers ? <EyeOff size={28} /> : <Eye size={28} />}
                        {showAnswers ? 'CEVAPLARI GİZLE' : 'CEVAPLARI GÖSTER'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
