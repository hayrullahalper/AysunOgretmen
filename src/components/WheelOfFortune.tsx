import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { firestoreService } from '../lib/firestore';
import { geminiService } from '../lib/gemini';
import { RotateCw, Trophy, Sparkles, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Wheel } from 'react-custom-roulette';
import { useStudents } from '../hooks/useStudents';
import { useSettings } from '../hooks/useSettings';

const MemoizedWheel = React.memo(({ mustSpin, prizeNumber, data, onStopSpinning }: any) => (
  <Wheel
    mustStartSpinning={mustSpin}
    prizeNumber={prizeNumber}
    data={data}
    onStopSpinning={onStopSpinning}
    outerBorderColor="#ffffff"
    outerBorderWidth={8}
    innerBorderColor="#ffffff"
    innerBorderWidth={0}
    innerRadius={0}
    radiusLineColor="#ffffff"
    radiusLineWidth={1}
    fontSize={12}
    textDistance={60}
    spinDuration={0.5}
  />
));

export default function WheelOfFortune() {
  const { students } = useStudents();
  const { settings } = useSettings();
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [winner, setWinner] = useState<any>(null);
  const [question, setQuestion] = useState<any>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [userAnswer, setUserAnswer] = useState<string | null>(null);
  const questionRef = useRef<HTMLDivElement>(null);

  // Settings for the question
  const [grade, setGrade] = useState('1');
  const [subject, setSubject] = useState('Genel Kültür');
  const [topic, setTopic] = useState('Karışık');

  useEffect(() => {
    if (settings) {
      setGrade(settings.defaultGrade);
    }
  }, [settings]);

  // Auto scroll to question when winner is selected
  useEffect(() => {
    if (winner && questionRef.current) {
      questionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [winner]);

  const data = useMemo(() => students.map((s, i) => ({
    option: `${s.name} ${s.surname}`,
    style: { backgroundColor: i % 2 === 0 ? '#5c6bc0' : '#26a69a', textColor: 'white' }
  })), [students]);

  const handleSpinClick = useCallback(() => {
    if (students.length < 2 || mustSpin) return;
    
    const newPrizeNumber = Math.floor(Math.random() * students.length);
    setPrizeNumber(newPrizeNumber);
    setMustSpin(true);
    setWinner(null);
    setQuestion(null);
    setUserAnswer(null);

    // Start generating question immediately while spinning
    setLoadingQuestion(true);
    geminiService.generateQuestions(grade, subject, topic, '1 Test Sorusu')
      .then(q => {
        setQuestion(q.questions[0]);
      })
      .catch(error => {
        console.error(error);
      })
      .finally(() => {
        setLoadingQuestion(false);
      });
  }, [students, mustSpin, grade, subject, topic]);

  const handleStopSpinning = useCallback(() => {
    setMustSpin(false);
    const selected = students[prizeNumber];
    setWinner(selected);
  }, [students, prizeNumber]);

  if (students.length < 2) {
    return (
      <div className="glass p-12 rounded-3xl text-center space-y-4 bg-slate-800/70 border-slate-700">
        <p className="text-xl font-semibold opacity-70 text-slate-300">Çarkıfelek için en az 2 öğrenci eklemelisiniz.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="flex flex-col items-center space-y-8">
          <div className="relative">
            <MemoizedWheel 
              mustSpin={mustSpin}
              prizeNumber={prizeNumber}
              data={data}
              onStopSpinning={handleStopSpinning}
            />
          </div>

          <button 
            onClick={handleSpinClick} 
            disabled={mustSpin}
            className="btn-primary flex items-center gap-2 text-xl px-12 h-[60px] shadow-lg hover:shadow-primary/20"
          >
            {mustSpin ? <RotateCw className="animate-spin" /> : <RotateCw size={24} />}
            {mustSpin ? 'Dönüyor...' : 'Çevir!'}
          </button>
        </div>

        <div ref={questionRef} className="min-h-[400px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            {winner && (
              <motion.div
                key={winner.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="glass p-8 rounded-3xl w-full space-y-6 text-center border-slate-700 shadow-xl bg-slate-800/80"
              >
                <div className="inline-block p-4 bg-yellow-900/30 rounded-full mb-2">
                  <Trophy className="text-yellow-400" size={48} />
                </div>
                <h3 className="text-3xl font-bold text-primary">
                  Sıradaki Şanslı: {winner.name} {winner.surname}!
                </h3>
                
                <div className="h-px bg-slate-700" />

                {loadingQuestion ? (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <p className="text-sm font-medium opacity-70 text-slate-300">Soru hazırlanıyor...</p>
                  </div>
                ) : question ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4 text-left"
                  >
                    <p className="text-lg font-bold flex gap-2 text-slate-100">
                      <Sparkles className="text-yellow-500 shrink-0" /> {question.question}
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      {question.options.map((opt: string, i: number) => {
                        const isSelected = userAnswer === opt;
                        const isCorrect = opt === question.answer;
                        const showResult = userAnswer !== null;

                        return (
                          <button 
                            key={i} 
                            onClick={() => setUserAnswer(opt)}
                            disabled={showResult}
                            className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between font-medium ${
                              showResult
                                ? isCorrect
                                  ? 'bg-green-900/20 border-green-500 text-green-400'
                                  : isSelected
                                    ? 'bg-red-900/20 border-red-500 text-red-400'
                                    : 'bg-slate-800 border-slate-700 opacity-50 text-slate-400'
                                : 'bg-slate-800 border-slate-700 hover:border-primary hover:bg-slate-700 text-slate-300'
                            }`}
                          >
                            <span>{String.fromCharCode(65 + i)}) {opt}</span>
                            {showResult && isCorrect && <CheckCircle2 size={20} className="text-green-500" />}
                            {showResult && isSelected && !isCorrect && <XCircle size={20} className="text-red-500" />}
                          </button>
                        );
                      })}
                    </div>
                    {userAnswer !== null && question.explanation && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 p-4 bg-blue-900/20 rounded-2xl border border-blue-800 text-sm text-blue-300"
                      >
                        <p className="font-bold mb-1 flex items-center gap-2">
                          <Sparkles size={16} /> Açıklama:
                        </p>
                        {question.explanation}
                      </motion.div>
                    )}
                  </motion.div>
                ) : null}
              </motion.div>
            )}
            {!winner && !mustSpin && (
              <div className="text-center opacity-50 space-y-4">
                <RotateCw size={64} className="mx-auto mb-4 text-primary" />
                <p className="text-xl font-medium text-slate-400">Çarkı çevirerek bir öğrenci seçin!</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
