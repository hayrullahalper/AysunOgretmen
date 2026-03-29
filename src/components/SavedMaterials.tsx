import React, { useState, useEffect } from 'react';
import { firestoreService, Material } from '../lib/firestore';
import { exportToPDF } from '../lib/pdf';
import { FileText, Download, Trash2, Calendar, Search, BookOpen, Clock, Play, X, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';

export default function SavedMaterials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'quiz' | 'story'>('all');
  const [solvingMaterial, setSolvingMaterial] = useState<Material | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = firestoreService.getMaterials(setMaterials);
    return () => unsubscribe();
  }, []);

  const handleDelete = async () => {
    if (!deletingId) return;
    await firestoreService.deleteMaterial(deletingId);
    setDeletingId(null);
  };

  const handleSolve = (material: Material) => {
    setSolvingMaterial(material);
    setUserAnswers({});
  };

  const handleAnswerSelect = (qIndex: number, answer: string) => {
    setUserAnswers(prev => ({ ...prev, [qIndex]: answer }));
  };

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || m.type === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={!!deletingId}
        title="Materyali Sil"
        message="Bu materyali kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        confirmText="Sil"
        cancelText="Vazgeç"
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
        variant="danger"
      />
      <div className="glass p-6 rounded-3xl border-slate-700 shadow-sm bg-slate-800/70">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-primary">
            <BookOpen className="text-primary" /> Kayıtlı Materyallerim
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Materyal ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10 py-2 text-sm border-slate-700 bg-slate-800 text-white"
              />
            </div>
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="input-field py-2 text-sm w-full sm:w-auto border-slate-700 bg-slate-800 text-white"
            >
              <option value="all">Tümü</option>
              <option value="quiz">Sınavlar</option>
              <option value="story">Hikayeler</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredMaterials.map((material) => (
              <motion.div
                key={material.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative bg-slate-800 rounded-2xl border border-slate-700 p-5 shadow-sm hover:shadow-md transition-all hover:border-primary"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl ${
                    material.type === 'quiz' ? 'bg-blue-900/20 text-blue-400' : 'bg-pink-900/20 text-pink-400'
                  }`}>
                    <FileText size={24} />
                  </div>
                  <button 
                    onClick={() => setDeletingId(material.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <h3 className="font-bold text-lg mb-2 line-clamp-1 text-slate-100">{material.title}</h3>
                
                <div className="flex flex-col gap-2 text-sm text-slate-400 mb-6">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    <span>{new Date(material.createdAt).toLocaleDateString('tr-TR')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} />
                    <span>{new Date(material.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleSolve(material)}
                    className="py-3 bg-primary/20 text-primary rounded-xl hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2 font-bold border border-primary/30"
                  >
                    <Play size={18} /> Çöz
                  </button>
                  <button 
                    onClick={async () => await exportToPDF(material.title, material.content, material.type)}
                    className="py-3 bg-slate-700/50 text-slate-300 rounded-xl hover:bg-slate-600 transition-all flex items-center justify-center gap-2 font-bold border border-slate-600"
                  >
                    <Download size={18} /> PDF
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredMaterials.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-slate-50 dark:bg-slate-800/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen size={40} className="text-slate-300" />
            </div>
            <p className="text-slate-400 font-medium italic">Henüz kaydedilmiş materyal bulunamadı.</p>
          </div>
        )}
      </div>

      {/* Interactive Solving Modal */}
      <AnimatePresence>
        {solvingMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-700 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10 rounded-t-[2.5rem]">
                <h3 className="text-2xl font-black text-slate-100">{solvingMaterial.title}</h3>
                <button 
                  onClick={() => setSolvingMaterial(null)}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar">
                {solvingMaterial.type === 'quiz' ? (
                  <div className="space-y-8">
                    {solvingMaterial.content.questions.map((q: any, i: number) => (
                      <div key={i} className="p-6 bg-slate-800/50 rounded-3xl border border-slate-700 space-y-4">
                        <p className="text-xl font-bold text-slate-100">{i + 1}. {q.question}</p>
                        
                        {q.options && q.options.length > 0 ? (
                          <div className="grid grid-cols-1 gap-3">
                            {q.options.map((opt: string, j: number) => {
                              const isSelected = userAnswers[i] === opt;
                              const isCorrect = opt === q.answer;
                              const showResult = userAnswers[i] !== undefined;
                              
                              return (
                                <button
                                  key={j}
                                  onClick={() => handleAnswerSelect(i, opt)}
                                  disabled={showResult}
                                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between font-medium ${
                                    showResult
                                      ? isCorrect
                                        ? 'bg-green-900/20 border-green-500 text-green-400'
                                        : isSelected
                                          ? 'bg-red-900/20 border-red-500 text-red-400'
                                          : 'bg-slate-800 border-slate-700 opacity-50 text-slate-400'
                                      : 'bg-slate-800 border-slate-700 hover:border-primary hover:bg-slate-700 text-slate-300'
                                  }`}
                                >
                                  <span>{String.fromCharCode(65 + j)}) {opt}</span>
                                  {showResult && isCorrect && <CheckCircle2 size={20} className="text-green-500" />}
                                  {showResult && isSelected && !isCorrect && <XCircle size={20} className="text-red-500" />}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <input 
                              type="text"
                              placeholder="Cevabınızı yazın..."
                              className="input-field py-4 text-lg"
                              onBlur={(e) => handleAnswerSelect(i, e.target.value)}
                            />
                            {userAnswers[i] && (
                              <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl">
                                <p className="text-primary font-bold">Doğru Cevap: {q.answer}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {userAnswers[i] !== undefined && q.explanation && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="p-4 bg-blue-900/20 rounded-2xl border border-blue-800 text-sm text-blue-300"
                          >
                            <p className="font-bold mb-1 flex items-center gap-2">
                              <Sparkles size={16} /> Açıklama:
                            </p>
                            {q.explanation}
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none">
                    {solvingMaterial.content.image && (
                      <img 
                        src={solvingMaterial.content.image} 
                        alt={solvingMaterial.title} 
                        className="w-full aspect-video object-cover rounded-3xl border border-slate-700 shadow-2xl mb-8"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="p-8 bg-slate-800/50 rounded-3xl border border-slate-700 whitespace-pre-wrap text-lg leading-relaxed text-slate-300">
                      {solvingMaterial.content.story}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-800 bg-slate-900/50 rounded-b-[2.5rem]">
                <button 
                  onClick={() => setSolvingMaterial(null)}
                  className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-2xl font-black transition-all"
                >
                  KAPAT
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
