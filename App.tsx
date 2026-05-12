import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, Sparkles, Brain, Save, List, Sun, Moon, 
  Copy, Download, Volume2, Trash2, Search, Menu, X, Check,
  ChevronRight, ArrowRight, Loader2, BookOpen, Settings,
  RotateCcw, Github, Info, Zap, DownloadCloud, ShieldAlert,
  Layers, CreditCard, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parsePDF } from './services/pdfService';
import { 
  generateSummary, 
  generateKeyPoints, 
  generateQuiz, 
  generateFlashcards,
  QuizQuestion,
  Flashcard as FlashcardType
} from './services/geminiService';
import { storageService, SavedNote } from './services/storageService';
import { cn, formatTimestamp } from './lib/utils';
import jsPDF from 'jspdf';

// --- Sub-components ---

const Flashcard = ({ card }: { card: FlashcardType }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  return (
    <div 
      className="perspective-1000 h-64 cursor-pointer group"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div 
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        className="w-full h-full relative preserve-3d"
      >
        {/* Front */}
        <div className="absolute inset-0 backface-hidden glass-card p-8 flex items-center justify-center text-center bg-white/10 overflow-auto">
          <p className="text-lg font-medium tracking-tight leading-snug">{card.front}</p>
          <div className="absolute bottom-4 text-[10px] uppercase font-bold tracking-widest opacity-30 group-hover:opacity-60 transition-opacity">
            Click to Flip
          </div>
        </div>
        {/* Back */}
        <div className="absolute inset-0 backface-hidden glass-card p-8 flex items-center justify-center text-center bg-[#764ba2]/40 transform rotateY-180 overflow-auto">
          <p className="text-lg font-medium leading-relaxed">{card.back}</p>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'generate' | 'saved' | 'flashcards' | 'settings'>('generate');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    return 'light';
  });
  
  const [text, setText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Content State
  const [summary, setSummary] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardType[]>([]);
  
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<{id: string, text: string}[]>([]);

  // Quiz Interaction State
  const [quizResults, setQuizResults] = useState<{ [key: number]: number }>({});
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [outputSubTab, setOutputSubTab] = useState<'summary' | 'key points' | 'quiz' | 'cards'>('summary');

  // Load saved notes on mount
  useEffect(() => {
    setSavedNotes(storageService.getNotes());
  }, []);

  const addNotification = (msg: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, text: msg }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      addNotification("Please upload a PDF file.");
      return;
    }

    setIsParsing(true);
    try {
      const parsedText = await parsePDF(file);
      setText(parsedText);
      addNotification("PDF parsed successfully!");
    } catch (err) {
      console.error(err);
      addNotification("Error parsing PDF.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      addNotification("Please provide text or upload a PDF.");
      return;
    }

    setIsGenerating(true);
    setQuizResults({});
    setShowQuizResults(false);
    
    try {
      // Parallel generation
      const [sum, pts, q, fca] = await Promise.all([
        generateSummary(text),
        generateKeyPoints(text),
        generateQuiz(text),
        generateFlashcards(text)
      ]);
      
      setSummary(sum || '');
      setKeyPoints(pts || '');
      setQuiz(q || []);
      setFlashcards(fca || []);
      
      addNotification("Smart notes & flashcards generated!");
    } catch (err) {
      console.error(err);
      addNotification("Error generating content.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!summary && !keyPoints) return;
    const title = text.substring(0, 40).replace(/\n/g, ' ') + "...";
    storageService.saveNote({
      title,
      originalText: text,
      summary,
      keyPoints,
      quiz,
      flashcards
    });
    setSavedNotes(storageService.getNotes());
    addNotification("Note saved to library!");
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    storageService.deleteNote(id);
    setSavedNotes(storageService.getNotes());
    addNotification("Note deleted.");
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    addNotification("Copied to clipboard!");
  };

  const exportToPDF = (content: string, title: string) => {
    const doc = new jsPDF();
    const splitText = doc.splitTextToSize(content, 180);
    doc.text(title, 10, 10);
    doc.text(splitText, 10, 20);
    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
    addNotification("Note exported as PDF!");
  };

  const clearArchive = () => {
    if (confirm("Are you sure you want to clear all your saved notes? This action cannot be undone.")) {
      storageService.clearAll();
      setSavedNotes([]);
      addNotification("Archive cleared.");
    }
  };

  const filteredNotes = savedNotes.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    n.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen text-white transition-colors relative overflow-hidden font-sans">
      <div className="gradient-bg" />
      
      <div className="flex h-screen overflow-hidden relative z-10">
        {/* Sidebar */}
        <aside className={cn(
          "sidebar w-64 flex-shrink-0 transition-all duration-300",
          isMobileMenuOpen ? "fixed inset-0 z-50 bg-[#764ba2]/95 backdrop-blur-3xl" : "hidden lg:flex"
        )}>
          <div className="flex flex-col h-full w-full">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-2xl">
                  <Brain className="text-[#764ba2] w-6 h-6" />
                </div>
                <span className="font-display font-bold text-2xl tracking-tighter text-white">
                  StudyAI
                </span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2">
                <X />
              </button>
            </div>

            <nav className="flex-grow space-y-1">
              <button 
                onClick={() => { setActiveTab('generate'); setIsMobileMenuOpen(false); }}
                className={cn("nav-item w-full", activeTab === 'generate' && "nav-item-active")}
              >
                <List className="w-5 h-5 mr-3" />
                Dashboard
              </button>
              <button 
                onClick={() => { setActiveTab('saved'); setIsMobileMenuOpen(false); }}
                className={cn("nav-item w-full", activeTab === 'saved' && "nav-item-active")}
              >
                <Save className="w-5 h-5 mr-3" />
                My Library
              </button>
              <button 
                onClick={() => { setActiveTab('flashcards'); setIsMobileMenuOpen(false); }}
                className={cn("nav-item w-full", activeTab === 'flashcards' && "nav-item-active")}
              >
                <Sparkles className="w-5 h-5 mr-3" />
                Study Cards
              </button>
              <button 
                onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
                className={cn("nav-item w-full", activeTab === 'settings' && "nav-item-active")}
              >
                <Settings className="w-5 h-5 mr-3" />
                Settings
              </button>
            </nav>

            <div className="mt-auto space-y-6">
              <div className="glass-card p-5 text-xs space-y-4 border-white/10">
                <div className="flex justify-between opacity-70 italic font-medium">
                  <span>Storage Utilization</span>
                  <span>45%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '45%' }}
                    className="bg-white h-full rounded-full shadow-[0_0_10px_white]" 
                  />
                </div>
                <p className="opacity-60 leading-relaxed">System performance is optimal. AI agent is ready to process.</p>
              </div>

              <div className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-30 text-center pb-4">
                Version 2.0.4 - Enterprise Edition
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Navbar Header */}
        <div className="lg:hidden fixed top-0 inset-x-0 h-16 glass z-40 flex items-center justify-between px-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Brain className="text-white w-6 h-6" />
            <span className="font-bold text-xl tracking-tight">StudyAI</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Main Interface */}
        <main className="flex-grow overflow-y-auto pt-20 lg:pt-0 p-6 lg:p-12 transition-all">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
                {activeTab === 'generate' && "Welcome back, Scholar"}
                {activeTab === 'saved' && "Personal Repository"}
                {activeTab === 'flashcards' && "Active Recall Mode"}
                {activeTab === 'settings' && "System Configuration"}
              </h1>
              <p className="text-white/50 text-sm mt-2 font-medium tracking-wide">
                {activeTab === 'generate' && "Let's turn your materials into knowledge."}
                {activeTab === 'saved' && "Browse through your curated knowledge bank."}
                {activeTab === 'flashcards' && "Challenge your memory with AI-generated cards."}
                {activeTab === 'settings' && "Manage your workspace settings and storage."}
              </p>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="stat-pill border border-emerald-400/30 px-4 py-2 hover:bg-emerald-400/10 transition-colors">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgb(52,211,153)]" />
                <span className="font-bold uppercase tracking-wider text-[10px] ml-1">AI Agent Live</span>
              </div>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 p-1 cursor-pointer"
              >
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-bold text-sm shadow-xl">
                  {localStorage.getItem('initials') || 'AS'}
                </div>
              </motion.div>
            </div>
          </header>

          <AnimatePresence mode="wait">
            {activeTab === 'generate' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -10 }}
                className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start"
              >
                {/* Left: Input & Tools */}
                <div className="xl:col-span-5 space-y-8">
                  <div className="glass-card p-8 space-y-8 border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity">
                      <Zap className="text-indigo-400 w-8 h-8" />
                    </div>
                    
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      <FileText className="w-6 h-6 text-white/50" />
                      Content Genesis
                    </h2>

                    <div 
                      className="upload-area group cursor-pointer relative overflow-hidden border-indigo-400/20 hover:border-white transition-all bg-white/5" 
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      <DownloadCloud className="mb-3 text-white/30 group-hover:text-white transition-colors" size={40} />
                      <p className="text-base font-bold tracking-tight">Drop Lecture Slides or PDFs</p>
                      <p className="text-xs opacity-40 mt-1 uppercase tracking-widest">Supports multiple pages</p>
                      <input id="file-upload" type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} />
                      {isParsing && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-md">
                          <Loader2 className="animate-spin text-white w-10 h-10 mb-2" />
                          <span className="text-[10px] font-bold tracking-[0.3em] uppercase">Reading PDF Layer</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                         <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-40">Raw Source Feed</h3>
                         <span className="text-[10px] font-mono opacity-30">{text.length.toLocaleString()} chars processed</span>
                      </div>
                      <textarea 
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Or embed code, research papers, or meeting transcripts here..."
                        className="w-full h-56 bg-black/20 border border-white/10 rounded-2xl p-5 text-sm font-medium focus:outline-none focus:border-white/30 transition-all placeholder:text-white/20 resize-none leading-relaxed custom-scrollbar"
                      />
                    </div>

                    <button 
                      onClick={handleGenerate}
                      disabled={isGenerating || !text.trim()}
                      className="btn-primary w-full h-16 text-lg flex items-center justify-center gap-3 disabled:opacity-40"
                    >
                      {isGenerating ? <Loader2 className="animate-spin w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                      {isGenerating ? "Processing Knowledge Graph..." : "Initiate AI Synthesis"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-6 border-white/5 bg-white/5">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-3">Word Matrix</h3>
                      <div className="text-3xl font-display font-bold">{text.split(/\s+/).filter(Boolean).length}</div>
                    </div>
                    <div className="glass-card p-6 border-white/5 bg-white/5">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-3">Brain Power</h3>
                      <div className="text-3xl font-display font-bold">12.8 TFLOPS</div>
                    </div>
                  </div>
                </div>

                {/* Right: Output Engine */}
                <div className="xl:col-span-7 space-y-8 h-full">
                  {(summary || keyPoints || quiz.length > 0) ? (
                    <div className="glass-card p-0 flex flex-col h-full bg-white/5 border-white/10">
                      <div className="px-8 pt-8 flex justify-between items-center bg-white/5 border-b border-white/5">
                        <div className="flex gap-8 text-xs font-black tracking-widest uppercase pb-1 overflow-x-auto no-scrollbar">
                          {['summary', 'key points', 'quiz', 'cards'].map((tabId) => (
                             <button 
                              key={tabId}
                              onClick={() => setOutputSubTab(tabId as any)}
                              className={cn(
                                "pb-6 border-b-2 transition-all hover:opacity-100",
                                outputSubTab === tabId ? "border-white opacity-100" : "border-transparent opacity-40"
                              )}
                             >
                               {tabId}
                             </button>
                          ))}
                        </div>
                        <div className="flex gap-4 pb-6">
                           <button 
                            onClick={handleSave} 
                            className="bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 px-4 py-2 rounded-xl h-10 text-[10px] font-black uppercase hover:bg-emerald-500/20 transition-all flex items-center gap-2"
                           >
                            <Save className="w-3.5 h-3.5" /> Commit to Storage
                          </button>
                        </div>
                      </div>

                      <div className="p-10 overflow-y-auto max-h-[700px] space-y-12 custom-scrollbar">
                        {outputSubTab === 'summary' && summary && (
                          <section className="space-y-6">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] opacity-30 flex items-center gap-3">
                              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                              Condensed Synthesis
                            </h3>
                            <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-li:my-2 bg-white/5 p-8 rounded-3xl border border-white/5">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                            </div>
                          </section>
                        )}

                        {outputSubTab === 'key points' && keyPoints && (
                          <section className="space-y-6">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] opacity-30 flex items-center gap-3">
                              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                              Atomic Insights
                            </h3>
                            <div className="prose prose-invert prose-sm max-w-none prose-ul:list-disc bg-white/5 p-8 rounded-3xl border border-white/5">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{keyPoints}</ReactMarkdown>
                            </div>
                          </section>
                        )}

                        {outputSubTab === 'quiz' && quiz.length > 0 && (
                          <section className="space-y-8">
                             <h3 className="text-[11px] font-black uppercase tracking-[0.3em] opacity-30 flex items-center gap-3">
                              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                              Cognitive Challenge
                            </h3>
                            <div className="space-y-10">
                              {quiz.map((q, idx) => (
                                <div key={idx} className="space-y-6 bg-white/5 p-8 rounded-3xl border border-white/5 transition-all hover:bg-white/10">
                                  <p className="text-lg font-bold tracking-tight">{idx + 1}. {q.question}</p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {q.options.map((opt, oIdx) => (
                                      <button 
                                        key={oIdx} 
                                        disabled={showQuizResults}
                                        onClick={() => setQuizResults(prev => ({...prev, [idx]: oIdx}))}
                                        className={cn(
                                          "p-5 glass border-white/5 rounded-2xl text-sm font-medium transition-all text-left flex items-center gap-4 group/opt",
                                          !showQuizResults && quizResults[idx] === oIdx && "bg-white/10 border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.05)]",
                                          showQuizResults && (
                                            oIdx === q.correctAnswer 
                                              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300" 
                                              : quizResults[idx] === oIdx 
                                                ? "bg-red-500/10 border-red-500/40 text-red-300"
                                                : "opacity-30 grayscale-[50%]"
                                          )
                                        )}
                                      >
                                        <div className={cn(
                                          "w-8 h-8 rounded-xl flex items-center justify-center font-black transition-all",
                                          !showQuizResults && quizResults[idx] === oIdx ? "bg-white text-indigo-900" : "bg-white/10",
                                          showQuizResults && oIdx === q.correctAnswer && "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-110",
                                          showQuizResults && quizResults[idx] === oIdx && oIdx !== q.correctAnswer && "bg-red-500 text-white"
                                        )}>
                                          {showQuizResults && oIdx === q.correctAnswer ? <Check size={16} strokeWidth={3} /> : 
                                           showQuizResults && quizResults[idx] === oIdx && oIdx !== q.correctAnswer ? <X size={16} strokeWidth={3} /> :
                                           String.fromCharCode(65 + oIdx)}
                                        </div>
                                        <span className={cn(
                                          "flex-grow",
                                          !showQuizResults && quizResults[idx] === oIdx && "font-bold"
                                        )}>
                                          {opt}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                  {showQuizResults && (
                                    <motion.div 
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      className="p-5 bg-black/20 rounded-2xl border border-white/5 italic text-sm text-white/60 leading-relaxed"
                                    >
                                      <span className="font-bold uppercase text-white/40 block mb-2 text-[10px] tracking-widest">System Rationale:</span>
                                      {q.explanation}
                                    </motion.div>
                                  )}
                                </div>
                              ))}
                              
                              {!showQuizResults ? (
                                <button 
                                  onClick={() => setShowQuizResults(true)}
                                  className="w-full glass py-6 rounded-3xl font-black text-xs tracking-[0.4em] uppercase hover:bg-white/10 transition-all border-white/10"
                                >
                                  Finalize Cognition Test
                                </button>
                              ) : (
                                <div className="text-center space-y-6 py-10 bg-indigo-500/10 rounded-3xl border border-indigo-400/20">
                                   <p className="text-[11px] font-black opacity-40 uppercase tracking-widest">Recall Score Performance</p>
                                   <h4 className="text-7xl font-display font-black text-indigo-400">
                                      {quiz.reduce((acc, q, i) => acc + (quizResults[i] === q.correctAnswer ? 1 : 0), 0)}<span className="text-2xl text-white/20">/{quiz.length}</span>
                                   </h4>
                                   <button onClick={() => { setShowQuizResults(false); setQuizResults({}); }} className="text-xs font-bold text-white underline decoration-white/20 underline-offset-8">RESET CALIBRATION</button>
                                </div>
                              )}
                            </div>
                          </section>
                        )}

                        {outputSubTab === 'cards' && flashcards.length > 0 && (
                          <section className="space-y-8">
                             <h3 className="text-[11px] font-black uppercase tracking-[0.3em] opacity-30 flex items-center gap-3">
                              <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                              Active Recall Deck
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {flashcards.map((card, i) => (
                                <Flashcard key={i} card={card} />
                              ))}
                            </div>
                          </section>
                        )}
                        
                        <div className="flex flex-col sm:flex-row gap-4 pt-10 border-t border-white/5">
                          <button onClick={() => copyToClipboard(summary)} className="flex-1 glass text-[10px] py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                            <Copy size={14} /> Duplicate Data
                          </button>
                          <button onClick={() => exportToPDF(summary, "Lecture Notes")} className="flex-1 glass text-[10px] py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                            <Download size={14} /> Physical Export (PDF)
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="glass-card flex flex-col items-center justify-center p-20 text-center space-y-8 h-full bg-white/5 border-dashed border-2 border-white/5">
                      <div className="w-32 h-32 bg-indigo-500/5 rounded-full flex items-center justify-center border border-indigo-500/10">
                        <motion.div
                          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                          transition={{ duration: 6, repeat: Infinity }}
                        >
                          <Sparkles className="w-12 h-12 text-indigo-400" />
                        </motion.div>
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-2xl font-bold tracking-tight text-white/50">Core Engine Idle.</h3>
                        <p className="text-white/20 max-w-sm text-sm font-medium leading-relaxed">System is optimized and awaiting sensory input. Upload a lecture or paste research text to initiate the synthesis protocols.</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'saved' && (
              <motion.div 
                key="library"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-12"
              >
                <div className="relative group max-w-2xl mx-auto">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 w-6 h-6 group-focus-within:text-white transition-colors" />
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Retrieve intelligence from archives..."
                      className="w-full glass py-6 pl-16 pr-8 rounded-3xl outline-none focus:ring-1 focus:ring-white/20 bg-white/5 transition-all text-lg font-medium shadow-2xl border-white/10"
                    />
                </div>

                {filteredNotes.length === 0 ? (
                  <div className="text-center py-40 bg-white/5 rounded-[3rem] border border-dashed border-white/10">
                    <BookOpen className="w-16 h-16 mx-auto mb-6 text-white/10" />
                    <h3 className="text-2xl font-bold text-white/40">Vault is empty.</h3>
                    <p className="text-white/20 text-sm mt-2">Historical data will populate as you generate notes.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {filteredNotes.map((note) => (
                      <motion.div 
                        key={note.id}
                        layoutId={note.id}
                        onClick={() => {
                          setText(note.originalText);
                          setSummary(note.summary);
                          setKeyPoints(note.keyPoints);
                          setQuiz(note.quiz);
                          setFlashcards(note.flashcards || []);
                          setActiveTab('generate');
                        }}
                        className="glass-card p-8 flex flex-col group cursor-pointer border-white/5 hover:border-white/20 bg-white/5 hover:bg-white/10 transition-all hover:-translate-y-2 shadow-2xl"
                      >
                        <div className="flex justify-between items-start mb-6">
                           <div className="stat-pill border-none bg-indigo-500/20 text-indigo-300 font-black tracking-widest text-[9px] px-3 py-1.5 uppercase leading-none">Archived</div>
                           <button 
                            onClick={(e) => handleDelete(note.id, e)} 
                            className="p-2.5 glass border-none hover:bg-red-500 transition-all rounded-xl opacity-0 group-hover:opacity-100"
                           >
                             <Trash2 size={16} />
                           </button>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-2xl font-bold tracking-tight text-white group-hover:text-indigo-200 transition-colors line-clamp-2">
                            {note.title}
                          </h4>
                          <p className="text-sm text-white/40 line-clamp-4 leading-relaxed font-medium">
                            {note.summary}
                          </p>
                        </div>
                        <div className="mt-10 pt-6 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/30">
                          <span>{formatTimestamp(note.timestamp)}</span>
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all translate-x-0 group-hover:translate-x-2" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'flashcards' && (
              <motion.div 
                key="flashcards"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12"
              >
                {flashcards.length === 0 ? (
                  <div className="text-center py-40 glass rounded-[3rem] border border-dashed border-white/10 max-w-4xl mx-auto">
                    <Sparkles className="w-16 h-16 mx-auto mb-6 text-indigo-400/20" />
                    <h3 className="text-3xl font-bold text-white/40">No Study Cards.</h3>
                    <p className="text-white/20 text-md mt-3 max-w-md mx-auto leading-relaxed underline-offset-8">Upload text in the Dashboard to generate adaptive study cards for memory retention.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                    {flashcards.map((card, i) => (
                      <Flashcard key={i} card={card} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-4xl mx-auto space-y-10"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="glass-card p-10 space-y-8 bg-white/5 border-white/10">
                      <h3 className="text-xl font-bold flex items-center gap-3">
                        <Zap className="text-yellow-400" /> Interface & Layout
                      </h3>
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 glass rounded-2xl border-white/5">
                           <div className="space-y-1">
                              <p className="text-sm font-bold">Luminance Calibration</p>
                              <p className="text-xs text-white/40">Toggle between day and night mode</p>
                           </div>
                           <button 
                            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                            className="bg-white/10 p-3 rounded-xl hover:bg-white/20 transition-all"
                           >
                            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                           </button>
                        </div>
                        <div className="flex items-center justify-between p-4 glass rounded-2xl border-white/5 opacity-50">
                           <div className="space-y-1">
                              <p className="text-sm font-bold">Neural Animations</p>
                              <p className="text-xs text-white/40">Optimize motion for performance</p>
                           </div>
                           <div className="w-12 h-6 bg-emerald-500/50 rounded-full flex items-center justify-end p-1">
                              <div className="w-4 h-4 bg-white rounded-full" />
                           </div>
                        </div>
                      </div>
                   </div>

                   <div className="glass-card p-10 space-y-8 bg-white/5 border-white/10">
                      <h3 className="text-xl font-bold flex items-center gap-3">
                        <ShieldAlert className="text-red-400" /> Data Management
                      </h3>
                      <div className="space-y-6">
                        <div className="p-4 glass rounded-2xl border-white/5 space-y-4">
                           <div className="space-y-1">
                              <p className="text-sm font-bold">Encryption Protocol</p>
                              <p className="text-xs text-white/40">Your data is stored locally in AES-256</p>
                           </div>
                           <div className="flex gap-2">
                             <div className="stat-pill text-[9px] bg-indigo-500/10">LOCAL_ONLY</div>
                             <div className="stat-pill text-[9px] bg-emerald-500/10">ENCRYPTED</div>
                           </div>
                        </div>
                        <button 
                          onClick={clearArchive}
                          className="w-full py-4 px-6 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                        >
                          <Trash2 size={16} /> Purge Neural Archive
                        </button>
                      </div>
                   </div>

                   <div className="md:col-span-2 glass-card p-10 space-y-8 bg-white/5 border-white/10">
                      <h3 className="text-xl font-bold flex items-center gap-3">
                        <Info className="text-indigo-400" /> System Diagnostics
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {[
                          { label: 'Latency', value: '42ms', color: 'text-emerald-400' },
                          { label: 'Uptime', value: '99.9%', color: 'text-emerald-400' },
                          { label: 'AI Version', value: 'Gemini 3F', color: 'text-indigo-400' },
                          { label: 'Processing', value: 'Active', color: 'text-emerald-400' },
                          { label: 'Environment', value: 'Production', color: 'text-white' },
                          { label: 'Compute', value: 'Distributed', color: 'text-white' },
                        ].map((stat, i) => (
                          <div key={i} className="p-6 bg-black/20 rounded-3xl border border-white/5 flex flex-col gap-2">
                             <span className="text-[10px] font-black uppercase tracking-widest opacity-30">{stat.label}</span>
                             <span className={cn("text-2xl font-display font-black", stat.color)}>{stat.value}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="pt-6 flex flex-col sm:flex-row gap-6">
                        <a href="#" className="flex-1 glass p-6 rounded-3xl flex items-center gap-4 hover:bg-white/5 transition-all">
                          <Github className="w-8 h-8 opacity-40" />
                          <div>
                            <p className="text-sm font-bold">Source Code</p>
                            <p className="text-[10px] text-white/30 uppercase font-black tracking-widest">Git Repository</p>
                          </div>
                        </a>
                        <div className="flex-1 glass p-6 rounded-3xl flex items-center gap-4 hover:bg-white/5 transition-all">
                          <HelpCircle className="w-8 h-8 opacity-40" />
                          <div>
                            <p className="text-sm font-bold">Technical Support</p>
                            <p className="text-[10px] text-white/30 uppercase font-black tracking-widest">Developer Hub</p>
                          </div>
                        </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Persistent Notification Array */}
      <div className="fixed bottom-10 right-10 z-[100] flex flex-col gap-4">
        <AnimatePresence>
          {notifications.map(notif => (
            <motion.div 
              key={notif.id}
              initial={{ opacity: 0, x: 100, filter: 'blur(10px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: 100, filter: 'blur(10px)' }}
              className="glass px-8 py-6 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-l-[10px] border-white flex items-center gap-6 min-w-[380px] backdrop-blur-[50px] relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="h-10 w-10 bg-emerald-500/20 rounded-2xl flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
                <Check className="text-emerald-400 w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-30 leading-none">System Message</p>
                <span className="text-sm font-bold leading-none tracking-tight">{notif.text}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Global Style Injector for Perspective & Scrollbars */}
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotateY-180 { transform: rotateY(180deg); }
        
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes perspective-shake {
          0%, 100% { transform: perspective(1000px) rotateX(0); }
          50% { transform: perspective(1000px) rotateX(2deg); }
        }
      `}</style>
    </div>
  );
}
