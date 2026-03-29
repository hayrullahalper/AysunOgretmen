import React, { useState, useEffect } from 'react';
import { firestoreService, Material } from '../lib/firestore';
import { exportToPDF } from '../lib/pdf';
import { FileText, Download, Trash2, Calendar, Search, BookOpen, Clock, Play, X, CheckCircle2, XCircle, Sparkles, Youtube, Filter, LayoutGrid, List } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';

export default function SavedMaterials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'quiz' | 'story' | 'research'>('all');
  const [solvingMaterial, setSolvingMaterial] = useState<Material | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

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
    setShowAnswers(false);
  };

  const handleAnswerSelect = (qIndex: number, answer: string) => {
    setUserAnswers(prev => ({ ...prev, [qIndex]: answer }));
  };

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeTab === 'all' || m.type === activeTab;
    return matchesSearch && matchesFilter;
  });

  const tabs = [
    { id: 'all', label: 'Tümü', icon: LayoutGrid },
    { id: 'quiz', label: 'Sınavlar', icon: FileText },
    { id: 'story', label: 'Hikayeler', icon: BookOpen },
    { id: 'research', label: 'Araştırmalar', icon: Search },
  ];

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
      
      <div className="glass p-8 rounded-3xl border-slate-700 shadow-sm bg-slate-800/70">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-black flex items-center gap-3 text-primary">
              <BookOpen className="text-primary" size={32} /> Materyal Kütüphanem
            </h2>
            <p className="text-slate-400 text-sm">Kaydettiğiniz tüm eğitim materyallerine buradan ulaşabilirsiniz.</p>
          </div>
          
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input 
              type="text"
              placeholder="Materyal başlığı ile ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border-2 border-slate-700 rounded-2xl pl-12 pr-4 py-3 text-slate-100 focus:border-primary transition-all outline-none"
            />
          </div>
        </div>

        {/* Tabs - Scrollable on mobile */}
        <div className="overflow-x-auto pb-2 mb-8 no-scrollbar">
          <div className="flex gap-2 p-1.5 bg-slate-900/50 rounded-[1.25rem] border border-slate-800 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
                <span className={`ml-2 px-2 py-0.5 rounded-md text-xs ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'
                }`}>
                  {materials.filter(m => tab.id === 'all' || m.type === tab.id).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredMaterials.map((material) => (
              <motion.div
                key={material.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative bg-slate-800/40 rounded-[2rem] border-2 border-slate-700/50 p-6 transition-all hover:border-primary/50 hover:bg-slate-800/60 flex flex-col"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className={`p-4 rounded-2xl ${
                    material.type === 'quiz' ? 'bg-blue-500/10 text-blue-400' : 
                    material.type === 'story' ? 'bg-pink-500/10 text-pink-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {material.type === 'quiz' && <FileText size={28} />}
                    {material.type === 'story' && <BookOpen size={28} />}
                    {material.type === 'research' && <Search size={28} />}
                  </div>
                  <button 
                    onClick={() => setDeletingId(material.id)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <h3 className="font-black text-xl mb-3 line-clamp-2 text-slate-100 min-h-[3.5rem] leading-tight">
                  {material.title}
                </h3>
                
                <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-500 mb-8 mt-auto">
                  <div className="flex items-center gap-1.5 bg-slate-900/50 px-3 py-1.5 rounded-lg">
                    <Calendar size={14} className="text-primary" />
                    <span>{new Date(material.createdAt).toLocaleDateString('tr-TR')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-900/50 px-3 py-1.5 rounded-lg uppercase tracking-wider">
                    <Sparkles size={14} className="text-secondary" />
                    <span>{material.type === 'quiz' ? 'Sınav' : material.type === 'story' ? 'Hikaye' : 'Araştırma'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleSolve(material)}
                    className="py-4 bg-primary hover:bg-primary-dark text-white rounded-2xl transition-all flex items-center justify-center gap-2 font-black shadow-lg shadow-primary/10 active:scale-95"
                  >
                    <Play size={20} /> {material.type === 'story' ? 'OKU' : material.type === 'research' ? 'GÖR' : 'ÇÖZ'}
                  </button>
                  <button 
                    onClick={async () => await exportToPDF(material.title, material.content, material.type)}
                    className="py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl transition-all flex items-center justify-center gap-2 font-black active:scale-95"
                  >
                    <Download size={20} /> PDF
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredMaterials.length === 0 && (
          <div className="text-center py-32 bg-slate-900/20 rounded-[3rem] border-2 border-dashed border-slate-800">
            <div className="bg-slate-800 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Search size={48} className="text-slate-600" />
            </div>
            <h4 className="text-xl font-bold text-slate-400 mb-2">Materyal Bulunamadı</h4>
            <p className="text-slate-500 max-w-xs mx-auto">Arama kriterlerinize uygun bir materyal yok veya henüz bu kategoride bir kayıt yapmadınız.</p>
          </div>
        )}
      </div>

      {/* Interactive Solving Modal */}
      <AnimatePresence>
        {solvingMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border-2 border-slate-700 rounded-[3rem] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${
                    solvingMaterial.type === 'quiz' ? 'bg-blue-500/10 text-blue-400' : 
                    solvingMaterial.type === 'story' ? 'bg-pink-500/10 text-pink-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {solvingMaterial.type === 'quiz' && <FileText size={24} />}
                    {solvingMaterial.type === 'story' && <BookOpen size={24} />}
                    {solvingMaterial.type === 'research' && <Search size={24} />}
                  </div>
                  <h3 className="text-2xl font-black text-slate-100">{solvingMaterial.title}</h3>
                </div>
                <button 
                  onClick={() => setSolvingMaterial(null)}
                  className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 transition-all hover:rotate-90"
                >
                  <X size={28} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                {solvingMaterial.type === 'quiz' ? (
                  <div className="space-y-8">
                    {solvingMaterial.content.questions.map((q: any, i: number) => (
                      <div key={i} className="p-8 bg-slate-800/40 rounded-[2.5rem] border-2 border-slate-700/50 space-y-6">
                        <p className="text-2xl font-bold text-slate-100 leading-tight">{i + 1}. {q.question}</p>
                        
                        {q.options && q.options.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {q.options.map((opt: string, j: number) => {
                              const isSelected = userAnswers[i] === opt;
                              const isCorrect = opt === q.answer;
                              const showResult = userAnswers[i] !== undefined;
                              
                              return (
                                <button
                                  key={j}
                                  onClick={() => handleAnswerSelect(i, opt)}
                                  disabled={showResult}
                                  className={`w-full text-left p-6 rounded-2xl border-2 transition-all flex items-center justify-between font-bold text-lg ${
                                    showResult
                                      ? isCorrect
                                        ? 'bg-green-500/10 border-green-500 text-green-400'
                                        : isSelected
                                          ? 'bg-red-500/10 border-red-500 text-red-400'
                                          : 'bg-slate-800/50 border-slate-700 opacity-50 text-slate-500'
                                      : 'bg-slate-800/80 border-slate-700 hover:border-primary hover:bg-slate-700 text-slate-300'
                                  }`}
                                >
                                  <span>{String.fromCharCode(65 + j)}) {opt}</span>
                                  {showResult && isCorrect && <CheckCircle2 size={24} className="text-green-500" />}
                                  {showResult && isSelected && !isCorrect && <XCircle size={24} className="text-red-500" />}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <input 
                              type="text"
                              placeholder="Cevabınızı buraya yazın..."
                              className="w-full bg-slate-900 border-2 border-slate-700 rounded-2xl p-6 text-xl text-slate-100 focus:border-primary outline-none"
                              onBlur={(e) => handleAnswerSelect(i, e.target.value)}
                            />
                            {userAnswers[i] && (
                              <div className="p-6 bg-primary/10 border-2 border-primary/20 rounded-2xl">
                                <p className="text-primary font-black text-lg">Doğru Cevap: {q.answer}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {userAnswers[i] !== undefined && q.explanation && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="p-6 bg-blue-500/10 rounded-2xl border-2 border-blue-500/20 text-blue-300"
                          >
                            <p className="font-black mb-2 flex items-center gap-2 uppercase tracking-wider text-sm">
                              <Sparkles size={18} /> Aysun Öğretmen'in Notu:
                            </p>
                            <p className="leading-relaxed">{q.explanation}</p>
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : solvingMaterial.type === 'story' ? (
                  <div className="space-y-10">
                    {solvingMaterial.content.image && (
                      <div className="relative group">
                        <img 
                          src={solvingMaterial.content.image} 
                          alt={solvingMaterial.title} 
                          className="w-full aspect-video object-cover rounded-[3rem] border-4 border-slate-800 shadow-2xl"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 rounded-[3rem] shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]"></div>
                      </div>
                    )}
                    <div className="p-12 bg-slate-800/40 rounded-[3rem] border-2 border-slate-700/50 whitespace-pre-wrap text-2xl leading-relaxed text-slate-200 font-serif italic">
                      {solvingMaterial.content.story}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-10">
                    <div className="p-10 bg-primary/10 border-4 border-primary/20 rounded-[3rem] space-y-6">
                      <h4 className="text-4xl font-black text-slate-100 leading-tight">{solvingMaterial.content.topic}</h4>
                      <p className="text-xl text-slate-300 leading-relaxed opacity-90">
                        {solvingMaterial.content.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                      <div className="p-8 bg-slate-800/40 rounded-[2.5rem] border-2 border-slate-700/50 space-y-6">
                        <h5 className="text-2xl font-black flex items-center gap-3 text-slate-100">
                          <BookOpen className="text-secondary" size={28} /> Araştırma Soruları
                        </h5>
                        <ul className="space-y-4">
                          {solvingMaterial.content.researchQuestions.map((q: any, i: number) => (
                            <li key={i} className="flex flex-col gap-3 p-6 bg-slate-800/80 rounded-2xl border-2 border-slate-700/50">
                              <div className="flex gap-4 text-slate-200 text-lg font-bold">
                                <span className="flex-shrink-0 w-8 h-8 bg-secondary/20 text-secondary rounded-full flex items-center justify-center text-sm font-black">
                                  {i + 1}
                                </span>
                                {q.question}
                              </div>
                              <div className="ml-12 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 italic text-sm">
                                {q.answer}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-8 bg-slate-800/40 rounded-[2.5rem] border-2 border-slate-700/50 space-y-8">
                        <div className="space-y-4">
                          <h5 className="text-2xl font-black flex items-center gap-3 text-slate-100">
                            <Youtube className="text-red-500" size={28} /> Video Materyal
                          </h5>
                          <p className="text-slate-400 leading-relaxed">
                            Bu konu hakkında daha fazla bilgi edinmek için hazırlanan özel video içeriğini izleyebilirsiniz.
                          </p>
                        </div>
                        <a 
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(solvingMaterial.content.videoSearchKeywords)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-8 bg-red-600 hover:bg-red-500 text-white rounded-3xl font-black flex items-center justify-center gap-4 shadow-2xl transition-all hover:scale-[1.02] active:scale-95 text-2xl"
                        >
                          <Youtube size={40} /> VİDEOYU İZLE
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-slate-800 bg-slate-900/80 backdrop-blur-md">
                <button 
                  onClick={() => setSolvingMaterial(null)}
                  className="w-full py-6 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-3xl font-black text-xl transition-all active:scale-[0.98]"
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
