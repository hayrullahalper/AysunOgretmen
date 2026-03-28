import React, { useState, useEffect } from 'react';
import { geminiService } from '../lib/gemini';
import { firestoreService } from '../lib/firestore';
import { Search, Youtube, Sparkles, Loader2, BookOpen, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function WeeklyResearch() {
  const [loading, setLoading] = useState(false);
  const [research, setResearch] = useState<any>(null);
  const [grade, setGrade] = useState('1');

  const generateResearch = async (currentGrade?: string) => {
    setLoading(true);
    setResearch(null);
    try {
      const data = await geminiService.generateWeeklyResearch(currentGrade || grade);
      setResearch(data);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Haftalık araştırma konusu oluşturulurken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await firestoreService.getSettings();
      if (settings) {
        setGrade(settings.defaultGrade);
        generateResearch(settings.defaultGrade);
      } else {
        generateResearch('1');
      }
    };
    loadSettings();
  }, []);

  return (
    <div className="space-y-6">
      <div className="glass p-8 rounded-3xl bg-slate-800/70 border-slate-700">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-black flex items-center gap-3 text-primary">
            <Search className="text-primary" size={32} /> Haftalık Araştırma Konusu
          </h2>
          <button 
            onClick={generateResearch}
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
              <Loader2 className="animate-spin text-primary" size={64} />
              <p className="text-xl font-bold opacity-70">Bu haftanın konusu belirleniyor...</p>
            </motion.div>
          ) : research ? (
            <motion.div 
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="p-8 bg-primary/10 border-2 border-primary/20 rounded-[2rem] space-y-4">
                <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-sm">
                  <Sparkles size={18} /> HAFTANIN KONUSU
                </div>
                <h3 className="text-4xl font-black text-slate-100">{research.topic}</h3>
                <p className="text-xl text-slate-300 leading-relaxed opacity-90">
                  {research.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glass p-6 rounded-3xl bg-slate-800/50 border-slate-700 space-y-4">
                  <h4 className="text-xl font-bold flex items-center gap-2 text-slate-100">
                    <BookOpen className="text-secondary" /> Araştırma Soruları
                  </h4>
                  <ul className="space-y-3">
                    {research.researchQuestions.map((q: string, i: number) => (
                      <li key={i} className="flex gap-3 p-4 bg-slate-800/80 rounded-2xl border border-slate-700 text-slate-300">
                        <span className="flex-shrink-0 w-6 h-6 bg-secondary/20 text-secondary rounded-full flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="glass p-6 rounded-3xl bg-slate-800/50 border-slate-700 space-y-6">
                  <h4 className="text-xl font-bold flex items-center gap-2 text-slate-100">
                    <Youtube className="text-red-500" /> Video Materyal
                  </h4>
                  <div className="p-6 bg-red-900/10 border border-red-900/20 rounded-2xl space-y-4">
                    <p className="text-slate-300 italic">
                      "Öğretmeniniz bu konuyla ilgili harika bir video seçti! Aşağıdaki butona tıklayarak YouTube üzerinden izleyebilirsiniz."
                    </p>
                    <a 
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(research.videoSearchKeywords)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg transition-all hover:scale-105 active:scale-95"
                    >
                      <Youtube size={24} /> VİDEOYU İZLE <ExternalLink size={18} />
                    </a>
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
