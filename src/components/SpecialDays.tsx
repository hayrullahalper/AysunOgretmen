import React, { useState } from 'react';
import { geminiService as aiService } from '../lib/gemini';
import { Calendar, Sparkles, Book, Music, Image as ImageIcon, Loader2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SPECIAL_DAYS = [
  "29 Ekim Cumhuriyet Bayramı",
  "23 Nisan Ulusal Egemenlik ve Çocuk Bayramı",
  "19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramı",
  "30 Ağustos Zafer Bayramı",
  "15 Temmuz Demokrasi ve Milli Birlik Günü",
  "18 Mart Çanakkale Zaferi",
  "10 Kasım Atatürk'ü Anma Günü",
  "Ramazan Bayramı",
  "Kurban Bayramı",
  "Öğretmenler Günü",
  "Anneler Günü",
  "Babalar Günü",
  "Dünya Kitap Günü",
  "Orman Haftası",
  "Yerli Malı Haftası"
];

export default function SpecialDays() {
  const [selectedDay, setSelectedDay] = useState(SPECIAL_DAYS[0]);
  const [customDay, setCustomDay] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [imageResult, setImageResult] = useState<string | null>(null);

  const activeDay = customDay || selectedDay;

  const handleGenerate = async (type: 'Şiir' | 'Hikaye' | 'Etkinlik') => {
    setLoading(true);
    setResult(null);
    setImageResult(null);
    try {
      const data = await aiService.generateSpecialDayContent(activeDay, type);
      setResult({ ...data, type });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    setLoading(true);
    setResult(null);
    setImageResult(null);
    try {
      const url = await aiService.generateColoringPage(activeDay);
      setImageResult(url);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass p-6 rounded-3xl bg-slate-800/70 border-slate-700">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-primary">
          <Calendar className="text-primary" /> Belirli Gün ve Haftalar
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold opacity-70">Özel Gün Seçin</label>
            <select 
              value={selectedDay} 
              onChange={(e) => {
                setSelectedDay(e.target.value);
                setCustomDay('');
              }}
              className="input-field border-slate-700 bg-slate-800"
            >
              {SPECIAL_DAYS.map(day => <option key={day} value={day}>{day}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold opacity-70">Veya Kendiniz Yazın</label>
            <input 
              type="text" 
              placeholder="Örn: 18 Mart Çanakkale Zaferi..."
              value={customDay}
              onChange={(e) => setCustomDay(e.target.value)}
              className="input-field border-slate-700 bg-slate-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button 
            onClick={() => handleGenerate('Şiir')}
            disabled={loading}
            className="btn-secondary flex flex-col items-center gap-2 p-4 h-auto"
          >
            <Music size={24} />
            <span>Şiir Üret</span>
          </button>
          <button 
            onClick={() => handleGenerate('Hikaye')}
            disabled={loading}
            className="btn-secondary flex flex-col items-center gap-2 p-4 h-auto"
          >
            <Book size={24} />
            <span>Hikaye Üret</span>
          </button>
          <button 
            onClick={() => handleGenerate('Etkinlik')}
            disabled={loading}
            className="btn-secondary flex flex-col items-center gap-2 p-4 h-auto"
          >
            <Sparkles size={24} />
            <span>Etkinlik Öner</span>
          </button>
          <button 
            onClick={handleGenerateImage}
            disabled={loading}
            className="btn-secondary flex flex-col items-center gap-2 p-4 h-auto"
          >
            <ImageIcon size={24} />
            <span>Boyama Sayfası</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-12 space-y-4"
          >
            <Loader2 className="animate-spin text-primary" size={48} />
            <p className="text-lg font-medium opacity-70">İçerik hazırlanıyor...</p>
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass p-8 rounded-3xl bg-slate-800/80 border-slate-700 space-y-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold text-slate-100">{result.title}</h3>
              <span className="px-4 py-1 bg-primary/20 text-primary rounded-full text-sm font-bold">
                {result.type}
              </span>
            </div>
            <div className="prose prose-invert max-w-none p-6 bg-slate-800/50 rounded-2xl border border-slate-700 whitespace-pre-wrap text-slate-300 leading-relaxed">
              {result.content}
            </div>
            {result.suggestions && result.suggestions.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles size={18} className="text-yellow-500" /> Ek Öneriler
                </h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {result.suggestions.map((s: string, i: number) => (
                    <li key={i} className="p-3 bg-slate-800/30 rounded-xl border border-slate-700 text-sm opacity-80">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {imageResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass p-8 rounded-3xl bg-slate-800/80 border-slate-700 space-y-6 text-center"
          >
            <h3 className="text-2xl font-bold text-slate-100">{activeDay} Boyama Sayfası</h3>
            <div className="relative aspect-square max-w-2xl mx-auto bg-white rounded-2xl overflow-hidden border-4 border-slate-700">
              <img src={imageResult} alt="Coloring Page" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <a 
              href={imageResult} 
              download={`${activeDay}-boyama.png`}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Download size={20} /> Resmi İndir
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
