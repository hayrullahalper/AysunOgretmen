import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from '../lib/gemini';
import { firestoreService } from '../lib/firestore';
import { exportToPDF } from '../lib/pdf';
import { 
  Camera, 
  Upload, 
  X, 
  Sparkles, 
  Loader2, 
  Save, 
  Download, 
  Check, 
  Eye, 
  EyeOff,
  FileText,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../hooks/useSettings';
import SaveMaterialModal from './SaveMaterialModal';

export default function PhotoToQuestion() {
  const { settings } = useSettings();
  const [files, setFiles] = useState<{ file: File, preview: string }[]>([]);
  const [grade, setGrade] = useState('1');
  const [subject, setSubject] = useState('Türkçe');

  useEffect(() => {
    if (settings) {
      setGrade(settings.defaultGrade);
    }
  }, [settings]);
  const [contentType, setContentType] = useState<'lesson' | 'story'>('lesson');
  const [counts, setCounts] = useState({ mc: 10, tf: 5, open: 2 });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    if (files.length + selectedFiles.length > 20) {
      alert('En fazla 20 dosya yükleyebilirsiniz.');
      return;
    }

    const newFiles = selectedFiles.map(file => ({
      file,
      preview: file.type === 'application/pdf' ? '' : URL.createObjectURL(file)
    }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleGenerate = async () => {
    if (files.length === 0) return;

    const totalQuestions = counts.mc + counts.tf + counts.open;
    if (totalQuestions > 30) {
      alert('Toplam soru sayısı 30\'u geçemez.');
      return;
    }
    
    setLoading(true);
    setResult(null);
    setShowAnswers(false);

    try {
      const base64Files = await Promise.all(
        files.map(async f => ({
          data: await fileToBase64(f.file),
          mimeType: f.file.type
        }))
      );

      const data = await geminiService.generateQuestionsFromImages(
        grade, 
        subject, 
        base64Files, 
        contentType, 
        counts
      );
      setResult(data);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Sorular oluşturulurken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (customName: string) => {
    if (!result) return;
    setShowConfirmSave(false);
    try {
      await firestoreService.saveMaterial({
        id: crypto.randomUUID(),
        title: customName || result.title,
        content: result,
        type: 'quiz',
        createdAt: new Date().toISOString(),
        ownerId: '' 
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error(error);
      alert('Kaydedilirken bir hata oluştu.');
    }
  };

  const defaultSaveName = `${grade}. Sınıf - ${subject} - ${contentType === 'lesson' ? 'Ders Materyali' : 'Hikaye Kitabı'}`;

  return (
    <div className="space-y-6">
      <SaveMaterialModal
        isOpen={showConfirmSave}
        onClose={() => setShowConfirmSave(false)}
        onSave={handleSave}
        defaultName={defaultSaveName}
      />

      <div className="glass p-6 rounded-3xl border-slate-700 shadow-sm bg-slate-800/70">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-primary mb-6">
          <Camera className="text-pink-500" /> Dosyadan Soru Üret
        </h2>

        <div className="space-y-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold opacity-70">İçerik Türü</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setContentType('lesson')}
                  className={`flex-1 py-2 rounded-xl border font-bold transition-all ${contentType === 'lesson' ? 'bg-primary text-white border-primary' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                >
                  Ders Materyali
                </button>
                <button 
                  onClick={() => setContentType('story')}
                  className={`flex-1 py-2 rounded-xl border font-bold transition-all ${contentType === 'story' ? 'bg-primary text-white border-primary' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                >
                  Hikaye Kitabı
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold opacity-70">Sınıf</label>
              <select 
                value={grade} 
                onChange={(e) => setGrade(e.target.value)}
                className="input-field border-slate-700 bg-slate-800"
              >
                {[1, 2, 3, 4].map(n => <option key={n} value={n.toString()}>{n}. Sınıf</option>)}
              </select>
            </div>
          </div>

          {contentType === 'lesson' && (
            <div className="space-y-2">
              <label className="text-sm font-semibold opacity-70">Ders</label>
              <select 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)}
                className="input-field border-slate-700 bg-slate-800"
              >
                {['Türkçe', 'Matematik', 'Hayat Bilgisi', 'Fen Bilimleri', 'İngilizce'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold opacity-70">Çoktan Seçmeli</label>
              <input 
                type="number" 
                min="0" max="20"
                value={counts.mc}
                onChange={(e) => setCounts(prev => ({ ...prev, mc: parseInt(e.target.value) || 0 }))}
                className="input-field border-slate-700 bg-slate-800"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold opacity-70">Doğru / Yanlış</label>
              <input 
                type="number" 
                min="0" max="20"
                value={counts.tf}
                onChange={(e) => setCounts(prev => ({ ...prev, tf: parseInt(e.target.value) || 0 }))}
                className="input-field border-slate-700 bg-slate-800"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold opacity-70">Açık Uçlu</label>
              <input 
                type="number" 
                min="0" max="20"
                value={counts.open}
                onChange={(e) => setCounts(prev => ({ ...prev, open: parseInt(e.target.value) || 0 }))}
                className="input-field border-slate-700 bg-slate-800"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 rounded-3xl p-8 text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/*,application/pdf"
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="p-4 bg-slate-700 group-hover:bg-primary/20 rounded-full text-slate-400 group-hover:text-primary transition-colors">
                <Upload size={32} />
              </div>
              <p className="font-bold text-lg">Dosyaları Yükle</p>
              <p className="text-sm opacity-50">Fotoğraf veya PDF dosyalarını buraya sürükleyin veya tıklayın (Maks. 20)</p>
            </div>
          </div>

          {files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-2">
              {files.map((f, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700 group bg-slate-800 flex items-center justify-center">
                  {f.preview ? (
                    <img src={f.preview} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-red-400">
                      <FileText size={24} />
                      <span className="text-[10px] font-bold">PDF</span>
                    </div>
                  )}
                  <button 
                    onClick={() => removeFile(idx)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button 
            onClick={handleGenerate} 
            disabled={loading || files.length === 0}
            className="btn-primary w-full flex items-center justify-center gap-2 h-[50px] text-lg"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
            {loading ? 'Analiz Ediliyor ve Sorular Üretiliyor...' : 'Soruları Oluştur'}
          </button>
        </div>
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-8 rounded-3xl border-slate-700 shadow-lg bg-slate-800/80"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h3 className="text-2xl font-bold text-slate-100">{result.title}</h3>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setShowAnswers(!showAnswers)}
                className="flex-1 sm:flex-none px-4 py-2 bg-blue-900/30 text-blue-400 rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 border border-blue-800 font-bold text-sm"
              >
                {showAnswers ? <EyeOff size={18} /> : <Eye size={18} />}
                {showAnswers ? 'Cevapları Gizle' : 'Cevapları Gör'}
              </button>
              <button 
                onClick={() => setShowConfirmSave(true)}
                disabled={saveSuccess}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 border font-bold text-sm ${
                  saveSuccess 
                    ? 'bg-green-600/20 text-green-400 border-green-500' 
                    : 'bg-green-900/30 text-green-400 border-green-800'
                }`}
              >
                {saveSuccess ? <Check size={18} /> : <Save size={18} />}
                {saveSuccess ? 'Kaydedildi' : 'Kaydet'}
              </button>
              <button 
                onClick={async () => await exportToPDF(result.title, result, 'quiz')}
                className="flex-1 sm:flex-none px-4 py-2 bg-pink-900/30 text-pink-400 rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 border border-pink-800 font-bold text-sm"
              >
                <Download size={18} /> PDF İndir
              </button>
            </div>
          </div>

          <div className="space-y-8">
            {/* Multiple Choice Section */}
            {result.questions.some((q: any) => q.type === 'multiple-choice') && (
              <section className="space-y-4">
                <h4 className="text-lg font-black text-primary flex items-center gap-2 border-b border-slate-700 pb-2">
                  <FileText size={20} /> Çoktan Seçmeli Sorular
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {result.questions.filter((q: any) => q.type === 'multiple-choice').map((q: any, i: number) => (
                    <div key={i} className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700">
                      <p className="font-bold mb-4 text-slate-100">{i + 1}. {q.question}</p>
                      <div className="space-y-2">
                        {q.options.map((opt: string, j: number) => (
                          <div key={j} className={`p-3 rounded-xl border text-sm ${
                            showAnswers && opt === q.answer 
                              ? 'bg-green-900/20 border-green-500 text-green-400' 
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}>
                            {String.fromCharCode(65 + j)}) {opt}
                          </div>
                        ))}
                      </div>
                      {showAnswers && (
                        <div className="mt-3 p-3 bg-blue-900/10 rounded-xl text-xs text-blue-300 border border-blue-900/30">
                          <span className="font-bold">Açıklama:</span> {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* True/False Section */}
            {result.questions.some((q: any) => q.type === 'true-false') && (
              <section className="space-y-4">
                <h4 className="text-lg font-black text-green-500 flex items-center gap-2 border-b border-slate-700 pb-2">
                  <CheckCircle2 size={20} /> Doğru / Yanlış Soruları
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {result.questions.filter((q: any) => q.type === 'true-false').map((q: any, i: number) => (
                    <div key={i} className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700">
                      <p className="font-bold mb-2 text-slate-100">{i + 1}. {q.question}</p>
                      <div className="flex gap-4">
                        <div className={`px-4 py-2 rounded-lg border text-sm font-bold ${
                          showAnswers && q.answer === 'Doğru' 
                            ? 'bg-green-900/20 border-green-500 text-green-400' 
                            : 'bg-slate-800 border-slate-700 text-slate-500'
                        }`}>D</div>
                        <div className={`px-4 py-2 rounded-lg border text-sm font-bold ${
                          showAnswers && q.answer === 'Yanlış' 
                            ? 'bg-red-900/20 border-red-500 text-red-400' 
                            : 'bg-slate-800 border-slate-700 text-slate-500'
                        }`}>Y</div>
                      </div>
                      {showAnswers && (
                        <div className="mt-3 p-3 bg-blue-900/10 rounded-xl text-xs text-blue-300 border border-blue-900/30">
                          <span className="font-bold">Açıklama:</span> {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Open Ended Section */}
            {result.questions.some((q: any) => q.type === 'open-ended') && (
              <section className="space-y-4">
                <h4 className="text-lg font-black text-purple-500 flex items-center gap-2 border-b border-slate-700 pb-2">
                  <HelpCircle size={20} /> Açık Uçlu Sorular
                </h4>
                <div className="space-y-4">
                  {result.questions.filter((q: any) => q.type === 'open-ended').map((q: any, i: number) => (
                    <div key={i} className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700">
                      <p className="font-bold mb-4 text-slate-100">{i + 1}. {q.question}</p>
                      <div className="h-24 border border-slate-700 rounded-xl bg-slate-900/50 mb-4" />
                      {showAnswers && (
                        <div className="p-4 bg-green-900/10 rounded-xl border border-green-900/30">
                          <p className="text-sm font-bold text-green-400 mb-1">Örnek Cevap / Anahtar:</p>
                          <p className="text-sm text-slate-300">{q.answer}</p>
                          <div className="mt-2 pt-2 border-t border-green-900/20 text-xs text-blue-300">
                            <span className="font-bold">Açıklama:</span> {q.explanation}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
