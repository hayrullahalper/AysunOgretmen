import React, { useState, useEffect } from 'react';
import { geminiService } from '../lib/gemini';
import { firestoreService } from '../lib/firestore';
import { exportToPDF } from '../lib/pdf';
import { BookOpen, Sparkles, Download, Save, Loader2, Book, XCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';

export default function StoryFactory() {
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [length, setLength] = useState<'Kısa' | 'Orta' | 'Uzun'>('Orta');
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await firestoreService.getSettings();
      // No default for story length yet, but we could add it to settings
    };
    loadSettings();
  }, []);

  const handleGenerate = async () => {
    if (!topic) return;
    setLoading(true);
    setResult(null);
    setImageError(null);
    try {
      const data = await geminiService.generateStory(topic, questionCount, length);
      setResult(data);
      
      // Generate image in background
      setImageLoading(true);
      try {
        const imageUrl = await geminiService.generateStoryImage(data.summary);
        if (imageUrl) {
          setResult((prev: any) => ({ ...prev, image: imageUrl }));
        } else {
          setImageError("Kota dolduğu için görsel oluşturulamadı.");
        }
      } catch (imgErr: any) {
        console.error("Image generation failed:", imgErr);
        setImageError(imgErr.message || "Görsel oluşturulamadı.");
      } finally {
        setImageLoading(false);
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Hikaye oluşturulurken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setShowConfirmSave(false);
    try {
      // Create a copy of the result without the image for saving
      const { image, ...contentWithoutImage } = result;
      
      await firestoreService.saveMaterial({
        id: crypto.randomUUID(),
        title: result.title,
        content: contentWithoutImage,
        type: 'story',
        createdAt: new Date().toISOString(),
        ownerId: '' // Set by service
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error(error);
      alert('Kaydedilirken bir hata oluştu.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass p-6 rounded-3xl bg-slate-800/70 border-slate-700 shadow-sm">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-primary">
          <BookOpen className="text-primary" /> Hikaye Fabrikası
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold opacity-70">Hikaye Konusu</label>
            <input 
              type="text" 
              placeholder="Örn: Yardımlaşma, Uzay macerası..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="input-field border-slate-700 bg-slate-800"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold opacity-70">Hikaye Uzunluğu</label>
            <select 
              value={length} 
              onChange={(e) => setLength(e.target.value as any)}
              className="input-field border-slate-700 bg-slate-800"
            >
              <option value="Kısa">Kısa (~100 kelime)</option>
              <option value="Orta">Orta (~300 kelime)</option>
              <option value="Uzun">Uzun (~600 kelime)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold opacity-70">Soru Sayısı</label>
            <input 
              type="number" 
              min="1" 
              max="10"
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value))}
              className="input-field border-slate-700 bg-slate-800"
            />
          </div>
        </div>

        <button 
          onClick={handleGenerate} 
          disabled={loading || !topic}
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Book size={20} />}
          {loading ? 'Yazılıyor...' : 'Hikaye Yaz'}
        </button>
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass p-8 rounded-3xl bg-slate-800/80 border-slate-700 shadow-lg"
        >
          <ConfirmModal
            isOpen={showConfirmSave}
            title="Hikayeyi Kaydet"
            message={`"${result.title}" başlıklı hikayeyi kayıtlı materyallerinize eklemek istiyor musunuz?`}
            confirmText="Kaydet"
            cancelText="Vazgeç"
            onConfirm={handleSave}
            onCancel={() => setShowConfirmSave(false)}
            variant="success"
          />
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 px-4">
            <h3 className="text-2xl font-bold text-slate-100">{result.title}</h3>
            <div className="flex gap-4 w-full sm:w-auto">
              <button 
                onClick={() => setShowConfirmSave(true)}
                disabled={saveSuccess}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 border font-bold ${
                  saveSuccess 
                    ? 'bg-green-600/20 text-green-400 border-green-500' 
                    : 'bg-green-900/30 text-green-400 border-green-800'
                }`}
              >
                {saveSuccess ? <Check size={20} /> : <Save size={20} />}
                {saveSuccess ? 'Kaydedildi' : 'Kaydet'}
              </button>
              <button 
                onClick={() => setShowPdfDialog(true)} 
                className="flex-1 sm:flex-none px-6 py-3 bg-pink-900/30 text-pink-400 rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 border border-pink-800 font-bold"
              >
                <Download size={20} /> PDF İndir
              </button>
            </div>
          </div>

          {/* PDF Dialog */}
          <AnimatePresence>
            {showPdfDialog && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="glass p-8 rounded-[2rem] w-full max-w-md space-y-6 bg-slate-800 border-slate-700"
                >
                  <h3 className="text-2xl font-black text-primary">PDF Seçenekleri</h3>
                  <p className="text-slate-400 font-medium">Hikaye görseli PDF dosyasına dahil edilsin mi?</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={async () => {
                        setShowPdfDialog(false);
                        await exportToPDF(result.title, result, 'story', { includeImage: true });
                      }}
                      disabled={!result.image}
                      className={`py-4 rounded-2xl font-bold flex flex-col items-center gap-2 transition-all ${result.image ? 'bg-primary text-white hover:scale-105' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                    >
                      <Sparkles size={24} />
                      Görselle Birlikte
                    </button>
                    <button 
                      onClick={async () => {
                        setShowPdfDialog(false);
                        await exportToPDF(result.title, result, 'story', { includeImage: false });
                      }}
                      className="py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-bold flex flex-col items-center gap-2 transition-all hover:scale-105"
                    >
                      <Book size={24} />
                      Sadece Metin
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => setShowPdfDialog(false)}
                    className="w-full py-3 text-slate-400 font-bold hover:text-white transition-colors"
                  >
                    Vazgeç
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {imageLoading ? (
            <div className="w-full aspect-video bg-slate-800/50 rounded-3xl border border-slate-700 flex flex-col items-center justify-center gap-4 mb-8">
              <Loader2 className="animate-spin text-primary" size={48} />
              <p className="text-slate-400 font-bold">Hikaye Görseli Hazırlanıyor...</p>
            </div>
          ) : imageError ? (
            <div className="flex justify-center mb-6">
              <button 
                onClick={async () => {
                  setImageLoading(true);
                  setImageError(null);
                  try {
                    const imageUrl = await geminiService.generateStoryImage(result.summary);
                    if (imageUrl) {
                      setResult((prev: any) => ({ ...prev, image: imageUrl }));
                    } else {
                      setImageError("Kota dolduğu için görsel oluşturulamadı.");
                    }
                  } catch (err: any) {
                    setImageError(err.message || "Tekrar deneme başarısız.");
                  } finally {
                    setImageLoading(false);
                  }
                }}
                className="text-xs text-slate-500 hover:text-primary transition-colors flex items-center gap-1"
              >
                Görsel oluşturulamadı. Tekrar denemek için tıklayın.
              </button>
            </div>
          ) : result.image && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full mb-8"
            >
              <img 
                src={result.image} 
                alt={result.title} 
                className="w-full aspect-video object-cover rounded-3xl border border-slate-700 shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          )}

          <div className="prose prose-invert max-w-none mb-8 p-6 bg-slate-800/50 rounded-2xl border border-slate-700 leading-relaxed text-lg whitespace-pre-wrap text-slate-300">
            {result.story}
          </div>

          <div className="space-y-4 px-2">
            <h4 className="text-xl font-bold flex items-center gap-2 text-slate-100">
              <Sparkles className="text-yellow-500" /> Okuma-Anlama Soruları
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.questions.map((q: any, i: number) => (
                <div key={i} className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700">
                  <p className="font-bold mb-3 text-slate-100">{i + 1}. {q.question}</p>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-secondary">Cevap: {q.answer}</p>
                    {q.explanation && (
                      <div className="p-3 bg-blue-900/20 rounded-xl border border-blue-800 text-xs text-blue-300">
                        <p className="font-bold mb-1">Açıklama:</p>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
