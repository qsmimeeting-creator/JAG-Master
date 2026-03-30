import React, { useState } from 'react';
import { Trophy, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { QuizSession } from '../types';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';

interface ResultProps {
  session: QuizSession;
  onRestart: () => void;
}

export default function Result({ session, onRestart }: ResultProps) {
  const [showReview, setShowReview] = useState(false);
  
  const getPraise = () => {
    const p = session.percentage || 0;
    if (p === 100) return "ยอดเยี่ยม! คะแนนเต็ม 🏆";
    if (p >= 80) return "ดีมาก! มีโอกาสสอบผ่านสูง 🌟";
    if (p >= 60) return "ผ่านเกณฑ์! แต่อ่านทบทวนอีกนิด 👍";
    return "ต้องพยายามเพิ่มขึ้น สู้ๆ! ✌️";
  };

  const cleanChoiceText = (text: string) => {
    return text.replace(/^([ก-ฮA-Za-z0-9]{1,2}[.):])\s+/, '');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-2xl mx-auto space-y-6"
    >
      <div className="bg-white p-8 rounded-3xl shadow-xl text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 to-yellow-600"></div>
        
        <div className="w-24 h-24 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-yellow-100">
          <Trophy className="w-12 h-12 text-yellow-500" />
        </div>
        
        <h2 className="text-2xl font-bold text-slate-800 mb-2">{getPraise()}</h2>
        
        <div className="mb-8">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">ผู้เข้าสอบ</span>
          <h3 className="text-xl text-slate-700 font-bold mt-1 truncate px-4">
            {session.respondentName}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            หมวด: {session.category}
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
          <span className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">คะแนนที่ได้</span>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-6xl font-black text-slate-800">{session.score}</span>
            <span className="text-slate-400 text-2xl font-bold">/{session.total}</span>
          </div>
          <div className="mt-2 text-sm font-medium text-slate-500">
            คิดเป็น {session.percentage}%
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button 
            onClick={() => setShowReview(!showReview)} 
            className={`py-4 rounded-xl font-bold border-2 transition-all ${
              showReview 
                ? 'bg-slate-50 border-slate-200 text-slate-700' 
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {showReview ? 'ซ่อนเฉลย' : 'ดูเฉลยละเอียด'}
          </button>
          <button 
            onClick={onRestart} 
            className="py-4 rounded-xl bg-slate-800 text-white font-bold shadow-lg active:scale-95 transition-transform hover:bg-slate-700 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            ทำแบบทดสอบใหม่
          </button>
        </div>
      </div>

      {showReview && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-bold text-slate-700 pl-2">เฉลยละเอียด</h3>
          {session.questions.map((q, idx) => {
            const userAnswer = session.answers[idx];
            const isCorrect = userAnswer === q.correctAnswerIndex;
            
            return (
              <div key={idx} className={`bg-white p-6 rounded-2xl border-l-4 shadow-sm ${isCorrect ? 'border-green-500' : 'border-red-500'}`}>
                <div className="flex gap-3 mb-4">
                  <span className="font-bold text-slate-400 mt-1">#{idx + 1}</span>
                  <div className="font-bold text-slate-800 flex-1 leading-relaxed prose prose-sm">
                    <Markdown>{q.questionText}</Markdown>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm mb-5">
                  {q.choices.map((c, cIdx) => {
                    let style = "flex items-start gap-3 p-3 rounded-xl";
                    let icon = null;
                    
                    if (cIdx === q.correctAnswerIndex) {
                      style += " text-green-800 font-bold bg-green-50";
                      icon = <CheckCircle className="w-5 h-5 shrink-0 text-green-600"/>;
                    } else if (cIdx === userAnswer && !isCorrect) {
                      style += " text-red-800 font-bold bg-red-50";
                      icon = <XCircle className="w-5 h-5 shrink-0 text-red-600"/>;
                    } else {
                      style += " text-slate-500 bg-slate-50";
                      icon = <div className="w-5 h-5 shrink-0 rounded-full border-2 border-slate-200 flex items-center justify-center text-[10px] font-bold">{['ก','ข','ค','ง'][cIdx]}</div>;
                    }
                    
                    return (
                      <div key={cIdx} className={style}>
                        {icon}
                        <div className="flex-1 leading-relaxed prose prose-sm prose-p:m-0">
                          <Markdown>{cleanChoiceText(c)}</Markdown>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-700 border border-slate-100">
                  <span className="font-bold text-slate-800 block mb-2">คำอธิบาย/หลักกฎหมาย:</span> 
                  <div className="prose prose-sm max-w-none">
                    <Markdown>{q.explanation}</Markdown>
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
