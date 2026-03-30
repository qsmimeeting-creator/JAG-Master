import React, { useState, useEffect } from 'react';
import { Lock, LogOut, Trash2, Edit, Plus, RefreshCw, User } from 'lucide-react';
import { Question, QuizSession } from '../types';
import { getAllQuestions, addQuestion, updateQuestion, deleteQuestion, getAllResults, deleteResult } from '../lib/db';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

interface AdminProps {
  onBack: () => void;
}

export default function Admin({ onBack }: AdminProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'questions' | 'results'>('questions');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<(QuizSession & { id: string })[]>([]);
  const [loading, setLoading] = useState(false);

  // Question Form State
  const [isEditing, setIsEditing] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>({
    questionText: '',
    choices: ['', '', '', ''],
    correctAnswerIndex: 0,
    explanation: '',
    category: 'general'
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // If user is logged in as the admin email, we can auto-authenticate if they've also entered the password
      // or just require both for extra security.
    });
    return () => unsubscribe();
  }, []);

  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'admin1234';
  const ADMIN_EMAIL = 'tropmed.cu@gmail.com';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
      fetchData();
    } else {
      setError('รหัสผ่านไม่ถูกต้อง');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setError('');
    } catch (err) {
      console.error(err);
      setError('ไม่สามารถเข้าสู่ระบบด้วย Google ได้');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fetchedQuestions, fetchedResults] = await Promise.all([
        getAllQuestions(),
        getAllResults()
      ]);
      setQuestions(fetchedQuestions);
      setResults(fetchedResults);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการดึงข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm('คุณต้องการลบข้อสอบนี้ใช่หรือไม่?')) return;
    try {
      await deleteQuestion(id);
      setQuestions(questions.filter(q => q.id !== id));
    } catch (err) {
      alert('ไม่สามารถลบได้');
    }
  };

  const handleDeleteResult = async (id: string) => {
    if (!window.confirm('คุณต้องการลบผลสอบนี้ใช่หรือไม่?')) return;
    try {
      await deleteResult(id);
      setResults(results.filter(r => r.id !== id));
    } catch (err) {
      alert('ไม่สามารถลบได้');
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentQuestion.id) {
        await updateQuestion(currentQuestion.id, currentQuestion);
      } else {
        await addQuestion(currentQuestion as Omit<Question, 'id'>);
      }
      setIsEditing(false);
      fetchData();
      setCurrentQuestion({
        questionText: '',
        choices: ['', '', '', ''],
        correctAnswerIndex: 0,
        explanation: '',
        category: 'general'
      });
    } catch (err) {
      alert('ไม่สามารถบันทึกได้');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden p-8">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-slate-700" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">ผู้ดูแลระบบ</h2>
        
        <div className="space-y-6">
          {/* Google Login Section */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-3 text-center">Step 1: ยืนยันตัวตน (Firebase Auth)</p>
            {user ? (
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold truncate">{user.displayName || 'User'}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <button onClick={() => auth.signOut()} className="text-xs text-red-500 hover:underline">ออก</button>
              </div>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm"
              >
                <img src="https://www.gstatic.com/firebase/explore/images/google-logo.svg" alt="" className="w-5 h-5" />
                เข้าสู่ระบบด้วย Google
              </button>
            )}
            {user && user.email !== ADMIN_EMAIL && (
              <p className="text-xs text-amber-600 mt-2 text-center">คำเตือน: อีเมลนี้ไม่มีสิทธิ์จัดการข้อมูล</p>
            )}
          </div>

          {/* Password Section */}
          <form onSubmit={handleLogin} className="space-y-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1 text-center">Step 2: รหัสผ่านเข้าถึงแผงควบคุม</p>
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน Admin"
                disabled={!user}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={!user}
              className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors disabled:opacity-50 shadow-lg shadow-slate-200"
            >
              เข้าสู่ระบบ Admin
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
            >
              กลับหน้าหลัก
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col h-[90vh]">
      {/* Header */}
      <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Lock className="w-5 h-5" /> ระบบจัดการข้อมูล (Admin)
        </h1>
        <div className="flex gap-4">
          <button onClick={fetchData} className="flex items-center gap-1 hover:text-slate-300">
            <RefreshCw className="w-4 h-4" /> รีเฟรช
          </button>
          <button onClick={onBack} className="flex items-center gap-1 hover:text-slate-300">
            <LogOut className="w-4 h-4" /> ออกจากระบบ
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          className={`flex-1 py-3 font-bold ${activeTab === 'questions' ? 'bg-slate-50 text-slate-800 border-b-2 border-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}
          onClick={() => setActiveTab('questions')}
        >
          คลังข้อสอบ ({questions.length})
        </button>
        <button
          className={`flex-1 py-3 font-bold ${activeTab === 'results' ? 'bg-slate-50 text-slate-800 border-b-2 border-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}
          onClick={() => setActiveTab('results')}
        >
          ผลการสอบ ({results.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bg-slate-50">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : activeTab === 'questions' ? (
          <div className="space-y-6">
            {!isEditing ? (
              <>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setCurrentQuestion({
                        questionText: '',
                        choices: ['', '', '', ''],
                        correctAnswerIndex: 0,
                        explanation: '',
                        category: 'general'
                      });
                      setIsEditing(true);
                    }}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" /> เพิ่มข้อสอบใหม่
                  </button>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="p-4 font-bold">หมวดหมู่</th>
                        <th className="p-4 font-bold">คำถาม</th>
                        <th className="p-4 font-bold w-24">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {questions.map(q => (
                        <tr key={q.id} className="hover:bg-slate-50">
                          <td className="p-4">{q.category}</td>
                          <td className="p-4 line-clamp-2">{q.questionText}</td>
                          <td className="p-4 flex gap-2">
                            <button onClick={() => { setCurrentQuestion(q); setIsEditing(true); }} className="text-blue-600 hover:bg-blue-50 p-2 rounded">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteQuestion(q.id)} className="text-red-600 hover:bg-red-50 p-2 rounded">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {questions.length === 0 && (
                        <tr><td colSpan={3} className="p-8 text-center text-slate-500">ไม่มีข้อมูล</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold mb-4">{currentQuestion.id ? 'แก้ไขข้อสอบ' : 'เพิ่มข้อสอบใหม่'}</h2>
                <form onSubmit={handleSaveQuestion} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">หมวดหมู่</label>
                    <select
                      value={currentQuestion.category}
                      onChange={e => setCurrentQuestion({...currentQuestion, category: e.target.value})}
                      className="w-full p-2 border rounded"
                    >
                      <option value="general">ความรู้ความสามารถทั่วไป</option>
                      <option value="criminal">อาญา และ วิ.อาญา</option>
                      <option value="civil">แพ่ง และ วิ.แพ่ง</option>
                      <option value="public">กฎหมายมหาชน</option>
                      <option value="military">กฎหมายทหาร</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">คำถาม</label>
                    <textarea
                      required
                      value={currentQuestion.questionText}
                      onChange={e => setCurrentQuestion({...currentQuestion, questionText: e.target.value})}
                      className="w-full p-2 border rounded"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold mb-1">ตัวเลือก (เลือกข้อที่ถูก)</label>
                    {currentQuestion.choices?.map((choice, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correctAnswer"
                          checked={currentQuestion.correctAnswerIndex === idx}
                          onChange={() => setCurrentQuestion({...currentQuestion, correctAnswerIndex: idx})}
                        />
                        <input
                          required
                          value={choice}
                          onChange={e => {
                            const newChoices = [...(currentQuestion.choices || [])];
                            newChoices[idx] = e.target.value;
                            setCurrentQuestion({...currentQuestion, choices: newChoices});
                          }}
                          className="flex-1 p-2 border rounded"
                          placeholder={`ตัวเลือก ${idx + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">คำอธิบาย</label>
                    <textarea
                      required
                      value={currentQuestion.explanation}
                      onChange={e => setCurrentQuestion({...currentQuestion, explanation: e.target.value})}
                      className="w-full p-2 border rounded"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-200 rounded font-bold">ยกเลิก</button>
                    <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded font-bold">บันทึก</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-4 font-bold">วันที่</th>
                  <th className="p-4 font-bold">ชื่อผู้สอบ</th>
                  <th className="p-4 font-bold">หมวดหมู่</th>
                  <th className="p-4 font-bold">คะแนน</th>
                  <th className="p-4 font-bold w-24">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-4">{new Date(r.createdAt || 0).toLocaleString('th-TH')}</td>
                    <td className="p-4">{r.respondentName}</td>
                    <td className="p-4">{r.category}</td>
                    <td className="p-4 font-bold">{r.score} / {r.total} ({r.percentage}%)</td>
                    <td className="p-4">
                      <button onClick={() => handleDeleteResult(r.id)} className="text-red-600 hover:bg-red-50 p-2 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500">ไม่มีข้อมูล</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
