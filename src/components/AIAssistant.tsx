import { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { Send, Brain, Zap, Sparkles, MessageSquare, Info } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

interface AIAssistantProps {
  user: User | null;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  type: 'lite' | 'pro';
}

export function AIAssistant({ user }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'lite' | 'pro'>('lite');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: input, type: mode };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      let response;
      if (mode === 'lite') {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: input,
          config: {
            systemInstruction: "You are a fast, helpful math assistant. Provide concise explanations and step-by-step solutions for mathematical problems."
          }
        });
      } else {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: input,
          config: {
            systemInstruction: "You are a deep-thinking mathematical expert. Analyze complex problems thoroughly, provide rigorous proofs or detailed explanations, and explore multiple perspectives if relevant.",
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
          }
        });
      }

      const aiMsg: Message = { 
        role: 'ai', 
        content: response.text || 'Sorry, I could not generate a response.',
        type: mode
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('AI Error:', err);
      setMessages(prev => [...prev, { role: 'ai', content: 'An error occurred while processing your request.', type: mode }]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/5">
          <Brain className="w-8 h-8 text-zinc-500" />
        </div>
        <h2 className="text-2xl font-bold mb-2">AI Math Expert</h2>
        <p className="text-zinc-500 max-w-md mx-auto">
          Sign in to unlock our AI Math Assistant, powered by Gemini 3.1. Get instant help with complex equations and deep conceptual insights.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-200px)] flex flex-col bg-zinc-900/50 rounded-3xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Sparkles className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-bold">Math Assistant</h3>
            <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Powered by Gemini 3.1</p>
          </div>
        </div>

        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setMode('lite')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === 'lite' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-zinc-400 hover:text-zinc-100'}`}
          >
            <Zap className="w-3 h-3" />
            <span>Lite</span>
          </button>
          <button
            onClick={() => setMode('pro')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === 'pro' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-zinc-400 hover:text-zinc-100'}`}
          >
            <Brain className="w-3 h-3" />
            <span>Pro</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
            <MessageSquare className="w-12 h-12 text-zinc-700" />
            <p className="text-zinc-500 max-w-xs">Ask me anything about math, from basic arithmetic to advanced calculus.</p>
          </div>
        )}
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] p-4 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-emerald-500 text-black font-medium' 
                  : 'bg-zinc-800/50 text-zinc-100 border border-white/5'
              }`}>
                {msg.role === 'ai' && (
                  <div className="flex items-center gap-2 mb-2">
                    {msg.type === 'lite' ? <Zap className="w-3 h-3 text-emerald-500" /> : <Brain className="w-3 h-3 text-emerald-500" />}
                    <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">
                      {msg.type === 'lite' ? 'Lite Mode' : 'Thinking Mode'}
                    </span>
                  </div>
                )}
                <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10">
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800/50 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
                {mode === 'pro' ? 'Analyzing Problem...' : 'Calculating...'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-black/20 border-t border-white/5">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={mode === 'lite' ? "Ask a quick question..." : "Describe a complex problem..."}
            className="w-full bg-zinc-800/50 border border-white/10 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-600"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-2 top-2 bottom-2 px-4 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 px-2">
          <Info className="w-3 h-3 text-zinc-600" />
          <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
            {mode === 'lite' ? 'Optimized for speed and basic math' : 'Optimized for deep reasoning and complex proofs'}
          </p>
        </div>
      </div>
    </div>
  );
}
