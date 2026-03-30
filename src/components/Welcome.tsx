import React, { useState } from 'react';
import { BookOpen, Scale, Shield, Gavel, FileText, User, Loader2 } from 'lucide-react';

const categories = [
  { id: 'general', label: 'ความรู้ความสามารถทั่วไป', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  { id: 'criminal', label: 'อาญา และ วิ.อาญา', icon: Gavel, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
  { id: 'civil', label: 'แพ่ง และ วิ.แพ่ง', icon: Scale, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
  { id: 'public', label: 'กฎหมายมหาชน', icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  { id: 'military', label: 'กฎหมายทหาร', icon: Shield, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100' },
];

interface WelcomeProps {
  onStart: (name: string, category: string) => void;
  loading: boolean;
}

export default function Welcome({ onStart, loading }: WelcomeProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');

  const handleStart = () => {
    if (!name.trim() || !category) return;
    onStart(name, category);
  };

  return (
    <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 py-6 px-6 flex items-center justify-center shadow-md">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-yellow-400" /> 
          เตรียมสอบนายทหารพระธรรมนูญ
        </h1>
      </div>
      
      <div className="p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <label className="block text-sm font-bold text-slate-700">ชื่อผู้เข้าสอบ <span className="text-red-500">*</span></label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <User className="w-5 h-5" />
            </div>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="กรอกชื่อของคุณ" 
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all"
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <h3 className="text-slate-800 font-bold text-lg mb-3">เลือกหมวดหมู่วิชา</h3>
          <div className="grid grid-cols-1 gap-2">
            {categories.map(cat => {
              const Icon = cat.icon;
              return (
                <button 
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  disabled={loading}
                  className={`flex items-center p-3 rounded-xl border transition-all text-left shadow-sm
                    ${category === cat.id 
                      ? 'bg-white border-slate-800 ring-2 ring-slate-200' 
                      : 'bg-white border-slate-100 hover:border-slate-300'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${cat.bg} ${cat.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={`text-sm font-bold ${category === cat.id ? 'text-slate-900' : 'text-slate-600'}`}>
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-4">
          <button 
            onClick={handleStart} 
            disabled={!category || !name.trim() || loading} 
            className="w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none bg-yellow-500 text-slate-900 hover:bg-yellow-400"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> 
                กำลังสร้างข้อสอบ...
              </>
            ) : 'เริ่มทำแบบทดสอบ'}
          </button>
        </div>
      </div>
    </div>
  );
}
