export interface Question {
  id: string;
  questionText: string;
  choices: string[];
  correctAnswerIndex: number;
  explanation: string;
  category?: string;
  createdAt?: number;
}

export interface QuizSession {
  respondentName: string;
  category: string;
  questions: Question[];
  answers: Record<number, number>;
  score: number;
  total: number;
  percentage?: number;
  source?: string; // 'bank', 'ai_mixed', 'fallback'
  createdAt?: number;
}
