export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface SavedNote {
  id: string;
  title: string;
  originalText: string;
  summary: string;
  keyPoints: string;
  quiz: QuizQuestion[];
  flashcards: Flashcard[];
  timestamp: number;
}

export type Theme = 'light' | 'dark';
