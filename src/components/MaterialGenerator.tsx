import React, { useState, useEffect } from 'react';
import { geminiService } from '../lib/gemini';
import { firestoreService } from '../lib/firestore';
import { exportToPDF } from '../lib/pdf';
import { Sparkles, Download, Save, Loader2, CheckCircle2, XCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../hooks/useSettings';
import ConfirmModal from './ConfirmModal';

export default function MaterialGenerator() {
  const { settings } = useSettings();
  const [grade, setGrade] = useState('1');
  const [subject, setSubject] = useState('Matematik');
  const [topic, setTopic] = useState('');
  const [customRequest, setCustomRequest] = useState('');
  const [useCustomRequest, setUseCustomRequest] = useState(false);
  const [questionCount, setQuestionCount] = useState('10');
  const [questionType, setQuestionType] = useState('Test Sorusu');
  const [difficulty, setDifficulty] = useState('Orta');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setGrade(settings.defaultGrade);
    }
  }, [settings]);

  const handleGenerate = async () => {
    if (useCustomRequest && !customRequest) return;
    if (!useCustomRequest && !topic) return;
    
    setLoading(true);
    setResult(null);
    setUserAnswers({});
    try {
      const finalTopic = useCustomRequest ? customRequest : topic;
      const finalType = useCustomRequest ? 'Özel İstek' : `${questionCount} ${questionType} (Zorluk: ${difficulty})`;
      const data = await geminiService.generateQuestions(grade, subject, finalTopic, finalType);
      setResult(data);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Materyal oluşturulurken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setShowConfirmSave(false);
    try {
      await firestoreService.saveMaterial({
        id: crypto.randomUUID(),
        title: result.title,
        content: result,
        type: 'quiz',
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

  const handleAnswerSelect = (qIndex: number, answer: string) => {
    setUserAnswers(prev => ({ ...prev, [qIndex]: answer }));
  };

  return (
    <div className="space-y-6">
      {result && (
        <ConfirmModal
          isOpen={showConfirmSave}
          title="Materyali Kaydet"
          message={`"${result.title}" başlıklı materyali kayıtlı materyallerinize eklemek istiyor musunuz?`}
          confirmText="Kaydet"
          cancelText="Vazgeç"
          onConfirm={handleSave}
          onCancel={() => setShowConfirmSave(false)}
          variant="success"
        />
      )}
      <div className="glass p-6 rounded-3xl border-slate-700 shadow-sm bg-slate-800/70">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-primary">
            <Sparkles className="text-yellow-500" /> Akıllı Materyal Üretici
          </h2>
          <button 
            onClick={() => setUseCustomRequest(!useCustomRequest)}
            className="text-sm font-bold text-primary hover:underline"
          >
            {useCustomRequest ? 'Basit Moda Geç' : 'Gelişmiş Moda Geç (Özel İstek)'}
          </button>
        </div>
        
        {!useCustomRequest ? (
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              
              <div className="space-y-2">
                <label className="text-sm font-semibold opacity-70">Ders</label>
                <select 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)}
                  className="input-field border-slate-700 bg-slate-800"
                >
                  {['Matematik', 'Türkçe', 'Hayat Bilgisi', 'Fen Bilimleri', 'İngilizce'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold opacity-70">Konu</label>
                <input 
                  type="text" 
                  placeholder="Örn: Toplama İşlemi"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="input-field border-slate-700 bg-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold opacity-70">Soru Sayısı</label>
                <select 
                  value={questionCount} 
                  onChange={(e) => setQuestionCount(e.target.value)}
                  className="input-field border-slate-700 bg-slate-800"
                >
                  {['5', '10', '15', '20'].map(n => <option key={n} value={n}>{n} Soru</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold opacity-70">Soru Tipi</label>
                <select 
                  value={questionType} 
                  onChange={(e) => setQuestionType(e.target.value)}
                  className="input-field border-slate-700 bg-slate-800"
                >
                  <option value="Test Sorusu">Test Sorusu</option>
                  <option value="Boşluk Doldurma">Boşluk Doldurma</option>
                  <option value="Doğru/Yanlış">Doğru/Yanlış</option>
                  <option value="Karışık (Test, Boşluk, D/Y)">Karışık</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold opacity-70">Zorluk Seviyesi</label>
                <select 
                  value={difficulty} 
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="input-field border-slate-700 bg-slate-800"
                >
                  <option value="Kolay">Kolay</option>
                  <option value="Orta">Orta</option>
                  <option value="Zor">Zor</option>
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <label className="text-sm font-semibold opacity-70">Ders</label>
                <select 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)}
                  className="input-field border-slate-700 bg-slate-800"
                >
                  {['Matematik', 'Türkçe', 'Hayat Bilgisi', 'Fen Bilimleri', 'İngilizce'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold opacity-70">Özel İstek (Detaylı Belirtin)</label>
              <textarea 
                placeholder="Örn: 10 soru boşluk doldurma, 7 soru d/y ve 5 soru çoktan seçmeli matematik sorusu istiyorum."
                value={customRequest}
                onChange={(e) => setCustomRequest(e.target.value)}
                className="input-field min-h-[100px] py-3 border-slate-700 bg-slate-800"
              />
            </div>
          </div>
        )}

        <button 
          onClick={handleGenerate} 
          disabled={loading || (useCustomRequest ? !customRequest : !topic)}
          className="btn-primary w-full flex items-center justify-center gap-2 h-[50px] text-lg"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
          {loading ? 'Üretiliyor...' : 'Materyal Oluştur'}
        </button>
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-8 rounded-3xl border-slate-700 shadow-lg bg-slate-800/80"
        >
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
                onClick={async () => await exportToPDF(result.title, result, 'quiz')}
                className="flex-1 sm:flex-none px-6 py-3 bg-pink-900/30 text-pink-400 rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 border border-pink-800 font-bold"
              >
                <Download size={20} /> PDF İndir
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-6 relative px-2">
            <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-slate-700 -translate-x-1/2" />
            {result.questions.map((q: any, i: number) => (
              <div key={i} className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700 flex flex-col break-words overflow-hidden min-w-0">
                <p className="font-bold mb-4 text-lg break-words text-slate-100">{i + 1}. {q.question}</p>
                
                {q.options && q.options.length > 0 ? (
                  <div className="space-y-2 mt-auto">
                    {q.options.map((opt: string, j: number) => {
                      const isSelected = userAnswers[i] === opt;
                      const isCorrect = opt === q.answer;
                      const showResult = userAnswers[i] !== undefined;
                      
                      return (
                        <button
                          key={j}
                          onClick={() => handleAnswerSelect(i, opt)}
                          disabled={showResult}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                            showResult
                              ? isCorrect
                                ? 'bg-green-900/20 border-green-500 text-green-400'
                                : isSelected
                                  ? 'bg-red-900/20 border-red-500 text-red-400'
                                  : 'bg-slate-800 border-slate-700 opacity-50 text-slate-400'
                              : 'bg-slate-800 border-slate-700 hover:border-primary hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          <span className="flex-1">{String.fromCharCode(65 + j)}) {opt}</span>
                          {showResult && isCorrect && <CheckCircle2 size={18} className="shrink-0 ml-2" />}
                          {showResult && isSelected && !isCorrect && <XCircle size={18} className="shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                    {userAnswers[i] !== undefined && q.explanation && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 p-3 bg-blue-900/20 rounded-xl border border-blue-800 text-sm text-blue-300"
                      >
                        <p className="font-bold mb-1">Açıklama:</p>
                        {q.explanation}
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="mt-auto">
                    <input 
                      type="text"
                      placeholder="Cevabınızı yazın..."
                      className="input-field mb-2"
                      onBlur={(e) => handleAnswerSelect(i, e.target.value)}
                    />
                    {userAnswers[i] && (
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-primary">Doğru Cevap: {q.answer}</p>
                        {q.explanation && (
                          <div className="p-3 bg-blue-900/20 rounded-xl border border-blue-800 text-sm text-blue-300">
                            <p className="font-bold mb-1">Açıklama:</p>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
