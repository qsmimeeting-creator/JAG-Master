import { collection, addDoc, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { Question, QuizSession } from '../types';

const BANK_COLLECTION = 'QuestionBank';
const RESULTS_COLLECTION = 'QuizResults';

export async function saveQuizResult(session: QuizSession) {
  if (!db) return;
  try {
    const docRef = await addDoc(collection(db, RESULTS_COLLECTION), {
      ...session,
      createdAt: Date.now(),
      // Store answered IDs to prevent repeating
      answeredIds: session.questions.map(q => q.id)
    });
    return docRef.id;
  } catch (error) {
    console.error("Error saving quiz result:", error);
  }
}

export async function getUserAnsweredQuestionIds(respondentName: string, category: string): Promise<Set<string>> {
  if (!db || !respondentName) return new Set();
  try {
    const q = query(
      collection(db, RESULTS_COLLECTION),
      where('respondentName', '==', respondentName),
      where('category', '==', category)
    );
    const querySnapshot = await getDocs(q);
    const answeredIds = new Set<string>();
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.answeredIds && Array.isArray(data.answeredIds)) {
        data.answeredIds.forEach((id: string) => answeredIds.add(id));
      }
    });
    return answeredIds;
  } catch (error) {
    console.error("Error getting user answered IDs:", error);
    return new Set();
  }
}

export async function getQuestionsFromBank(category: string, excludeIds: Set<string>, count: number): Promise<Question[]> {
  if (!db) return [];
  try {
    // We fetch a larger batch and filter out excluded IDs locally
    // Firestore 'not-in' is limited to 10 items, so local filtering is safer for large sets
    const q = query(
      collection(db, BANK_COLLECTION),
      where('category', '==', category),
      orderBy('createdAt', 'desc'),
      limit(100) 
    );
    const querySnapshot = await getDocs(q);
    const questions: Question[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as Question;
      if (!excludeIds.has(data.id)) {
        questions.push(data);
      }
    });

    // Shuffle and pick 'count'
    return questions.sort(() => 0.5 - Math.random()).slice(0, count);
  } catch (error) {
    console.error("Error getting questions from bank:", error);
    return [];
  }
}

export async function saveQuestionsToBank(questions: Question[], category: string) {
  if (!db || questions.length === 0) return;
  try {
    const promises = questions.map(q => {
      return addDoc(collection(db, BANK_COLLECTION), {
        ...q,
        category,
        createdAt: Date.now()
      });
    });
    await Promise.all(promises);
  } catch (error) {
    console.error("Error saving questions to bank:", error);
  }
}
