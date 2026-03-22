import { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { Upload, X, Send, Brain, Image as ImageIcon, Loader2, CheckCircle2, History as HistoryIcon, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

interface HomeworkHelperProps {
  user: User | null;
}

interface HistoryItem {
  id: string;
  problem: string;
  solution: string;
  timestamp: string;
  hasImage: boolean;
}

export function HomeworkHelper({ user }: HomeworkHelperProps) {
  const [problem, setProblem] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [solution, setSolution] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, 'homework_history'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HistoryItem[];
      setHistory(items);
    }, (err) => {
      console.error('Firestore Error:', err);
    });

    return () => unsubscribe();
  }, [user]);

  const saveToHistory = async (prob: string, sol: string, hasImg: boolean) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'homework_history'), {
        userId: user.uid,
        problem: prob,
        solution: sol,
        timestamp: new Date().toISOString(),
        hasImage: hasImg
      });
    } catch (err) {
      console.error('Failed to save history:', err);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'homework_history', id));
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const solveProblem = async () => {
    if (!problem && !image) {
      setError('Please provide a problem description or an image.');
      return;
    }

    setLoading(true);
    setError(null);
    setSolution(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3.1-pro-preview";

      let contents: any;
      if (image) {
        const base64Data = image.split(',')[1];
        const mimeType = image.split(';')[0].split(':')[1];
        contents = {
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: `Solve this math/science problem step-by-step. Provide a clear explanation for each step. Problem description: ${problem}` }
          ]
        };
      } else {
        contents = `Solve this math/science problem step-by-step. Provide a clear explanation for each step. Problem: ${problem}`;
      }

      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: "You are a world-class homework helper and tutor. Your goal is to help students understand complex math and science problems by breaking them down into clear, logical, and easy-to-follow steps. Always provide the final answer clearly at the end.",
        }
      });

      const sol = response.text || 'No solution generated.';
      setSolution(sol);
      
      if (user) {
        await saveToHistory(problem || 'Image-based problem', sol, !!image);
      }
    } catch (err: any) {
      console.error('AI Error:', err);
      setError('Failed to solve the problem. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-4">
          <h2 className="text-3xl font-bold tracking-tight uppercase">Homework <span className="text-emerald-500">Helper</span></h2>
          {user && (
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-xl transition-all ${showHistory ? 'bg-emerald-500 text-black' : 'bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white'}`}
              title="View History"
            >
              <HistoryIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-zinc-400 max-w-lg mx-auto text-sm">
          Upload a photo of your problem or describe it in text. Our AI will provide a detailed, step-by-step solution.
        </p>
      </div>

      <AnimatePresence>
        {showHistory && user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-zinc-900 rounded-3xl p-6 border border-white/5 shadow-xl space-y-4">
              <h3 className="text-sm font-mono text-zinc-500 uppercase tracking-widest">Recent Problems</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {history.length > 0 ? (
                  history.map((item) => (
                    <div key={item.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 group hover:border-emerald-500/30 transition-all">
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <div className="flex-1">
                          <p className="text-zinc-100 text-sm font-medium line-clamp-2">{item.problem}</p>
                          <p className="text-zinc-500 text-[10px] mt-1 font-mono">
                            {new Date(item.timestamp).toLocaleString()} {item.hasImage && '• WITH IMAGE'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setProblem(item.problem);
                              setSolution(item.solution);
                              setShowHistory(false);
                            }}
                            className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-emerald-500 transition-colors"
                            title="Load"
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteHistoryItem(item.id)}
                            className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-600 text-sm italic col-span-2 text-center py-4">No history yet.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          <div className="bg-zinc-900 rounded-3xl p-6 border border-white/5 shadow-xl space-y-6">
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 uppercase font-mono tracking-widest">Problem Description</label>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="Type your math or science problem here..."
                className="w-full h-40 bg-black/40 border border-white/10 rounded-2xl p-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 outline-none resize-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-zinc-500 uppercase font-mono tracking-widest">Image (Optional)</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`relative h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${image ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-white/20 bg-black/20'}`}
              >
                {image ? (
                  <div className="relative w-full h-full p-2">
                    <img src={image} alt="Problem" className="w-full h-full object-contain rounded-xl" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setImage(null); }}
                      className="absolute top-4 right-4 p-1.5 bg-black/60 rounded-full text-zinc-400 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mb-3">
                      <ImageIcon className="w-6 h-6 text-zinc-400" />
                    </div>
                    <p className="text-sm text-zinc-400">Click to upload or drag & drop</p>
                    <p className="text-xs text-zinc-600 mt-1">PNG, JPG up to 10MB</p>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
            </div>

            <button
              onClick={solveProblem}
              disabled={loading || (!problem && !image)}
              className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Analyzing Problem...</span>
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5" />
                  <span>Solve Step-by-Step</span>
                </>
              )}
            </button>

            {error && (
              <p className="text-red-500 text-sm text-center font-medium">{error}</p>
            )}
          </div>
        </div>

        {/* Solution Section */}
        <div className="space-y-6">
          <div className="bg-zinc-900 rounded-3xl p-6 border border-white/5 shadow-xl min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-bold uppercase tracking-tight">Solution</h3>
              </div>
              {loading && (
                <div className="flex items-center gap-2 text-xs text-emerald-500 font-mono animate-pulse">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  THINKING...
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {solution ? (
                <div className="prose prose-invert prose-emerald max-w-none">
                  <ReactMarkdown>{solution}</ReactMarkdown>
                </div>
              ) : loading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center animate-bounce">
                    <Brain className="w-8 h-8 text-emerald-500" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-zinc-100 font-medium">Processing your request</p>
                    <p className="text-zinc-500 text-sm">Gemini is breaking down the problem into steps...</p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center space-y-4 text-center opacity-50">
                  <div className="w-16 h-16 bg-zinc-800 rounded-3xl flex items-center justify-center">
                    <Send className="w-8 h-8 text-zinc-600" />
                  </div>
                  <p className="text-zinc-500 text-sm max-w-[200px]">
                    Submit a problem to see the step-by-step solution here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
