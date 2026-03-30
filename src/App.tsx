import React, { useState } from 'react';
import Welcome from './components/Welcome';
import Quiz from './components/Quiz';
import Result from './components/Result';
import Admin from './components/Admin';
import { generateQuestions } from './lib/gemini';
import { saveQuizResult } from './lib/db';
import { QuizSession } from './types';

type ViewState = 'welcome' | 'quiz' | 'result' | 'admin';

export default function App() {
  const [view, setView] = useState<ViewState>('welcome');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<QuizSession | null>(null);

  const handleStart = async (name: string, category: string) => {
    setLoading(true);
    try {
      const { questions, source } = await generateQuestions(category, name);
      setSession({
        respondentName: name,
        category,
        questions,
        answers: {},
        score: 0,
        total: questions.length,
        source,
      });
      setView('quiz');
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการสร้างข้อสอบ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async (answers: Record<number, number>) => {
    if (!session) return;
    
    let score = 0;
    session.questions.forEach((q, i) => {
      if (answers[i] === q.correctAnswerIndex) {
        score++;
      }
    });

    const finalSession = {
      ...session,
      answers,
      score,
      percentage: Math.round((score / session.total) * 100),
    };

    setSession(finalSession);
    setView('result');

    // Save to Firestore in background
    await saveQuizResult(finalSession);
  };

  const handleRestart = () => {
    setSession(null);
    setView('welcome');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans selection:bg-yellow-200">
      {view === 'welcome' && (
        <Welcome onStart={handleStart} loading={loading} onAdminClick={() => setView('admin')} />
      )}
      {view === 'quiz' && session && (
        <Quiz questions={session.questions} onFinish={handleFinish} source={session.source} />
      )}
      {view === 'result' && session && (
        <Result session={session} onRestart={handleRestart} />
      )}
      {view === 'admin' && (
        <Admin onBack={() => setView('welcome')} />
      )}
    </div>
  );
}

