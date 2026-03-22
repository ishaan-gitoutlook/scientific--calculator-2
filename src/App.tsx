import { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signIn, logOut } from './firebase';
import { Calculator } from './components/Calculator';
import { History } from './components/History';
import { AIAssistant } from './components/AIAssistant';
import { HomeworkHelper } from './components/HomeworkHelper';
import { LogIn, LogOut, Calculator as CalcIcon, History as HistoryIcon, MessageSquare, Brain, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-red-500/20 p-8 rounded-3xl max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
            <p className="text-zinc-400 mb-6 text-sm leading-relaxed">
              An unexpected error occurred. This might be due to a connection issue or a security restriction.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-semibold transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'calc' | 'history' | 'ai' | 'solver'>('calc');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-pulse text-emerald-500 font-mono">INITIALIZING...</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Navigation */}
      <nav className="border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CalcIcon className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold tracking-tight text-xl hidden sm:block uppercase">Scientific<span className="text-emerald-500">AI</span></span>
          </div>

          <div className="flex items-center gap-1 sm:gap-4">
            <button 
              onClick={() => setActiveTab('calc')}
              className={`p-2 rounded-lg transition-all ${activeTab === 'calc' ? 'bg-emerald-500/10 text-emerald-500' : 'text-zinc-400 hover:text-zinc-100'}`}
              title="Calculator"
            >
              <CalcIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`p-2 rounded-lg transition-all ${activeTab === 'history' ? 'bg-emerald-500/10 text-emerald-500' : 'text-zinc-400 hover:text-zinc-100'}`}
              title="History"
            >
              <HistoryIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setActiveTab('ai')}
              className={`p-2 rounded-lg transition-all ${activeTab === 'ai' ? 'bg-emerald-500/10 text-emerald-500' : 'text-zinc-400 hover:text-zinc-100'}`}
              title="AI Assistant"
            >
              <Brain className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setActiveTab('solver')}
              className={`p-2 rounded-lg transition-all ${activeTab === 'solver' ? 'bg-emerald-500/10 text-emerald-500' : 'text-zinc-400 hover:text-zinc-100'}`}
              title="Homework Helper"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            
            <div className="w-px h-6 bg-white/10 mx-2" />

            {user ? (
              <div className="flex items-center gap-3">
                <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                <button 
                  onClick={logOut}
                  className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={signIn}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black font-semibold rounded-lg hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-4 sm:p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'calc' && (
            <motion.div
              key="calc"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Calculator user={user} />
            </motion.div>
          )}
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <History user={user} />
            </motion.div>
          )}
          {activeTab === 'ai' && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <AIAssistant user={user} />
            </motion.div>
          )}
          {activeTab === 'solver' && (
            <motion.div
              key="solver"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <HomeworkHelper user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-5xl mx-auto p-8 border-t border-white/5 text-center text-zinc-500 text-sm font-mono">
        &copy; {new Date().getFullYear()} SCIENTIFIC AI CALCULATOR • POWERED BY GEMINI
      </footer>
    </div>
    </ErrorBoundary>
  );
}
