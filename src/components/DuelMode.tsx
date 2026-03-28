import React, { useState, useEffect, useCallback } from 'react';
import { firestoreService, Student } from '../lib/firestore';
import { geminiService } from '../lib/gemini';
import { Swords, RotateCw, Trophy, Sparkles, Loader2, CheckCircle2, XCircle, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function DuelMode() {
  const [students, setStudents] = useState<Student[]>([]);
  const [duelists, setDuelists] = useState<[Student, Student] | null>(null);
  const [tempDuelists, setTempDuelists] = useState<[Student, Student] | null>(null);
  const [loading, setLoading] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const [question, setQuestion] = useState<any>(null);
  const [winner, setWinner] = useState<Student | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  // Settings
  const [grade, setGrade] = useState('1');
  const [subject, setSubject] = useState('Genel Kültür');
  const [topic, setTopic] = useState('Karışık');

  useEffect(() => {
    const unsubscribe = firestoreService.getStudents(setStudents);
    const loadSettings = async () => {
      const settings = await firestoreService.getSettings();
      if (settings) setGrade(settings.defaultGrade);
    };
    loadSettings();
    return () => unsubscribe();
  }, []);

  const generateNewQuestion = useCallback(async () => {
    setLoading(true);
    setQuestion(null);
    setWinner(null);
    setShowAnswer(false);

    try {
      const q = await geminiService.generateDuelQuestion(grade, subject, topic);
      setQuestion(q);
    } catch (error) {
      console.error(error);
    } finally {
      setTimeout(() => setLoading(false), 800);
    }
  }, [grade, subject, topic]);

  const startDuel = useCallback(async () => {
    if (students.length < 2) return;
    
    setShuffling(true);
    setDuelists(null);
    setWinner(null);
    setShowAnswer(false);
    setQuestion(null);

    // Shuffle animation
    const interval = setInterval(() => {
      const s1 = students[Math.floor(Math.random() * students.length)];
      let s2 = students[Math.floor(Math.random() * students.length)];
      while (s1.id === s2.id) {
        s2 = students[Math.floor(Math.random() * students.length)];
      }
      setTempDuelists([s1, s2]);
    }, 200);

    setTimeout(async () => {
      clearInterval(interval);
      setShuffling(false);
      
      const shuffled = [...students].sort(() => 0.5 - Math.random());
      const selected: [Student, Student] = [shuffled[0], shuffled[1]];
      setDuelists(selected);
      setTempDuelists(null);
      
      await generateNewQuestion();
    }, 2000);
  }, [students, generateNewQuestion]);

  const handleAnswer = (student: Student, selectedOption: string) => {
    if (winner || !question) return;
    
    if (selectedOption === question.answer) {
      setWinner(student);
      setShowAnswer(true);
    }
  };

  if (students.length < 2) {
    return (
      <div className="glass p-12 rounded-3xl text-center space-y-4 bg-slate-800/70 border-slate-700">
        <Users className="mx-auto text-slate-500" size={64} />
        <p className="text-xl font-semibold opacity-70 text-slate-300">Düello için en az 2 öğrenci eklemelisiniz.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Settings Bar */}
      <div className="glass p-4 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-800/70 border-slate-700">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold opacity-50 uppercase text-slate-400">Sınıf</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)} className="input-field py-1 text-sm bg-slate-800 border-slate-700 text-slate-200">
            {[1, 2, 3, 4].map(n => <option key={n} value={n.toString()}>{n}. Sınıf</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold opacity-50 uppercase text-slate-400">Ders</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className="input-field py-1 text-sm bg-slate-800 border-slate-700 text-slate-200">
            {['Genel Kültür', 'Matematik', 'Türkçe', 'Hayat Bilgisi', 'Fen Bilimleri'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold opacity-50 uppercase text-slate-400">Konu</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} className="input-field py-1 text-sm bg-slate-800 border-slate-700 text-slate-200" placeholder="Konu yazın..." />
        </div>
      </div>

      <div className="flex flex-col items-center space-y-12">
        <button 
          onClick={startDuel} 
          disabled={loading || shuffling}
          className="btn-primary flex items-center gap-2 text-xl px-12 h-[60px] shadow-lg hover:shadow-primary/20"
        >
          {shuffling || loading ? <Loader2 className="animate-spin" /> : <Swords size={24} />}
          {shuffling ? 'Kura Çekiliyor...' : loading ? 'Soru Hazırlanıyor...' : 'Düelloyu Başlat!'}
        </button>

        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          {/* Left Student */}
          <div className="flex flex-col items-center space-y-4">
            <AnimatePresence mode="wait">
              {(duelists || tempDuelists) && (
                <motion.div 
                  key={shuffling ? 'shuffling' : (duelists ? duelists[0].id : 'none')}
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className={`p-6 rounded-3xl w-full text-center border-4 transition-all ${winner === duelists?.[0] ? 'border-green-500 bg-green-900/20 shadow-green-500/20' : 'border-slate-700 bg-slate-800/50'}`}
                >
                  <div className="text-2xl font-black text-slate-100 mb-2">
                    {shuffling ? tempDuelists?.[0].name : duelists?.[0].name} {shuffling ? tempDuelists?.[0].surname : duelists?.[0].surname}
                  </div>
                  <div className="text-xs font-bold opacity-50 uppercase tracking-widest text-slate-400">SOL TARAF</div>
                  {question && !winner && duelists && (
                    <div className="grid grid-cols-1 gap-2 mt-6">
                      {question.options.map((opt: string, idx: number) => (
                        <button 
                          key={idx}
                          onClick={() => handleAnswer(duelists[0], opt)}
                          className="p-3 bg-slate-700 hover:bg-slate-600 rounded-2xl border border-slate-600 text-slate-100 font-bold text-base transition-all active:scale-95"
                        >
                          {String.fromCharCode(65 + idx)}) {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {winner === duelists?.[0] && (
                    <div className="mt-4 text-green-400 flex items-center justify-center gap-2 font-black text-xl">
                      <Trophy size={20} /> KAZANDI!
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* VS / Question Area */}
          <div className="flex flex-col items-center justify-center min-h-[300px]">
            <AnimatePresence mode="wait">
              {shuffling ? (
                <motion.div 
                  key="shuffling"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="text-primary flex flex-col items-center gap-4"
                >
                  <RotateCw size={60} className="animate-spin" />
                  <p className="font-black text-xl animate-pulse">Kura Çekiliyor...</p>
                </motion.div>
              ) : loading ? (
                <motion.div 
                  key="loading"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="text-primary flex flex-col items-center gap-4"
                >
                  <Sparkles size={60} className="animate-pulse" />
                  <p className="font-black text-xl">Soru Hazırlanıyor...</p>
                </motion.div>
              ) : question ? (
                <motion.div 
                  key="question"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="glass p-6 rounded-3xl w-full text-center space-y-4 bg-slate-800/80 border-slate-700 shadow-2xl"
                >
                  <div className="text-primary font-black text-4xl italic mb-2">VS</div>
                  <div className="h-px bg-slate-700 w-full" />
                  <div className="text-xl font-bold text-slate-100 leading-relaxed">
                    {question.question}
                  </div>

                  {showAnswer && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-blue-900/20 border border-blue-500 rounded-2xl text-left space-y-2"
                    >
                      <div className="text-blue-400 font-black text-base flex items-center gap-2">
                        <CheckCircle2 size={18} /> CEVAP: {question.answer}
                      </div>
                      <div className="text-xs text-blue-300 opacity-80 leading-relaxed">
                        {question.explanation}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <button 
                          onClick={generateNewQuestion}
                          className="py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm"
                        >
                          <RotateCw size={16} /> Devam
                        </button>
                        <button 
                          onClick={startDuel}
                          className="py-2 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm"
                        >
                          <Swords size={16} /> Yeni Kura
                        </button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  className="text-center space-y-4"
                >
                  <Swords size={80} className="mx-auto text-slate-600" />
                  <p className="text-lg font-bold text-slate-400">Kura çekerek düelloyu başlatın!</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Student */}
          <div className="flex flex-col items-center space-y-4">
            <AnimatePresence mode="wait">
              {(duelists || tempDuelists) && (
                <motion.div 
                  key={shuffling ? 'shuffling-right' : (duelists ? duelists[1].id : 'none-right')}
                  initial={{ x: 100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className={`p-6 rounded-3xl w-full text-center border-4 transition-all ${winner === duelists?.[1] ? 'border-green-500 bg-green-900/20 shadow-green-500/20' : 'border-slate-700 bg-slate-800/50'}`}
                >
                  <div className="text-2xl font-black text-slate-100 mb-2">
                    {shuffling ? tempDuelists?.[1].name : duelists?.[1].name} {shuffling ? tempDuelists?.[1].surname : duelists?.[1].surname}
                  </div>
                  <div className="text-xs font-bold opacity-50 uppercase tracking-widest text-slate-400">SAĞ TARAF</div>
                  {question && !winner && duelists && (
                    <div className="grid grid-cols-1 gap-2 mt-6">
                      {question.options.map((opt: string, idx: number) => (
                        <button 
                          key={idx}
                          onClick={() => handleAnswer(duelists[1], opt)}
                          className="p-3 bg-slate-700 hover:bg-slate-600 rounded-2xl border border-slate-600 text-slate-100 font-bold text-base transition-all active:scale-95"
                        >
                          {String.fromCharCode(65 + idx)}) {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {winner === duelists?.[1] && (
                    <div className="mt-4 text-green-400 flex items-center justify-center gap-2 font-black text-xl">
                      <Trophy size={20} /> KAZANDI!
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
