import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, CheckCircle, XCircle, Zap, Database } from 'lucide-react';
import { Question } from '../types';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';

interface QuizProps {
  questions: Question[];
  onFinish: (answers: Record<number, number>) => void;
  source?: string;
}

export default function Quiz({ questions, onFinish, source }: QuizProps) {
  const [idx, setIdx] = useState(0);
  const [ans, setAns] = useState<Record<number, number>>({});
  const q = questions[idx];
  const isAnswered = ans[idx] !== undefined;
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    if (isAnswered && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' }); 
    }
  }, [isAnswered]);

  if (!q) return null;

  const isCorrect = isAnswered && ans[idx] === q.correctAnswerIndex;

  const cleanChoiceText = (text: string) => {
    return text.replace(/^([ก-ฮA-Za-z0-9]{1,2}[.):])\s+/, '');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl bg-white rounded-3xl shadow-lg p-6 sm:p-8 relative"
    >
      <div className="flex justify-between items-center mb-6">
        <span className="text-sm font-bold text-slate-400 uppercase tracking-wide">
          ข้อที่ {idx + 1} / {questions.length}
        </span>
        {source === 'bank' ? (
          <span className="text-[10px] px-2 py-1 rounded-full font-bold border bg-orange-50 text-orange-600 border-orange-100 flex items-center gap-1">
            <Database className="w-3 h-3" /> คลังข้อสอบ
          </span>
        ) : (
          <span className="text-[10px] px-2 py-1 rounded-full font-bold border bg-purple-50 text-purple-600 border-purple-100 flex items-center gap-1">
            <Zap className="w-3 h-3" /> AI สร้างใหม่
          </span>
        )}
      </div>
      
      <div className="w-full bg-slate-100 h-2 rounded-full mb-8 overflow-hidden">
        <div 
          className="bg-yellow-500 h-full transition-all duration-500 ease-out" 
          style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
        />
      </div>
  
      <div className="text-xl sm:text-2xl font-bold text-slate-800 mb-8 leading-relaxed prose prose-slate">
        <Markdown>{q.questionText}</Markdown>
      </div>
      
      <div className="space-y-3 mb-8">
        {q.choices.map((c, i) => {
          let style = "border-slate-200 hover:border-slate-300 text-slate-700";
          let mark = "bg-slate-100 text-slate-500";
          
          if (isAnswered) {
            if (i === q.correctAnswerIndex) { 
              style = "border-green-500 bg-green-50 text-green-800"; 
              mark = "bg-green-500 text-white"; 
            } else if (i === ans[idx]) { 
              style = "border-red-500 bg-red-50 text-red-800"; 
              mark = "bg-red-500 text-white"; 
            } else { 
              style = "opacity-50 border-slate-100"; 
            }
          }
          
          return (
            <button 
              key={i} 
              onClick={() => !isAnswered && setAns({ ...ans, [idx]: i })} 
              disabled={isAnswered} 
              className={`w-full p-4 rounded-xl text-left border-2 flex items-center transition-all ${style} ${!isAnswered ? 'active:scale-[0.98]' : ''}`}
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-4 flex-shrink-0 transition-colors ${mark}`}>
                {['ก', 'ข', 'ค', 'ง'][i]}
              </span>
              <span className="font-medium text-base leading-relaxed prose prose-sm">
                <Markdown>{cleanChoiceText(c)}</Markdown>
              </span>
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className={`mb-8 p-5 rounded-2xl border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
        >
          <h4 className={`font-bold mb-3 flex items-center gap-2 ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
            {isCorrect ? (
              <><CheckCircle className="w-5 h-5"/> ถูกต้อง!</>
            ) : (
              <><XCircle className="w-5 h-5"/> ไม่ถูกต้อง</>
            )}
          </h4>
          {!isCorrect && (
            <div className="mb-4 text-sm text-red-700 font-semibold bg-white/50 p-3 rounded-lg flex gap-2">
              <span>คำตอบที่ถูกคือ: {['ก', 'ข', 'ค', 'ง'][q.correctAnswerIndex]}.</span>
              <div className="prose prose-sm prose-p:m-0 text-red-700 font-semibold inline-block">
                <Markdown>{cleanChoiceText(q.choices[q.correctAnswerIndex])}</Markdown>
              </div>
            </div>
          )}
          <div className="text-sm text-slate-700 leading-relaxed">
            <span className="font-bold block mb-1">คำอธิบาย/หลักกฎหมาย:</span> 
            <div className="text-slate-600 prose prose-sm max-w-none">
              <Markdown>{q.explanation}</Markdown>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex justify-between pt-6 border-t border-slate-100" ref={bottomRef}>
        <button 
          disabled={idx === 0} 
          onClick={() => setIdx(idx - 1)} 
          className="text-slate-400 font-bold flex items-center gap-1 disabled:opacity-30 py-3 px-2 hover:text-slate-600 transition-colors"
        >
          <ChevronLeft className="w-5 h-5"/> ย้อนกลับ (ดูทบทวน)
        </button>
        {isAnswered && (
          <button 
            onClick={() => idx < questions.length - 1 ? setIdx(idx + 1) : onFinish(ans)} 
            className="bg-slate-800 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-slate-700 transition-all text-sm active:scale-95"
          >
            {idx === questions.length - 1 ? 'ดูผลคะแนน' : 'ข้อถัดไป'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
