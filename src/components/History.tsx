import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Trash2, Clock, Calculator as CalcIcon, History as HistoryIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Calculation, OperationType } from '../types';

interface HistoryProps {
  user: User | null;
}

export function History({ user }: HistoryProps) {
  const [history, setHistory] = useState<Calculation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const path = 'calculations';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const calcs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Calculation[];
      setHistory(calcs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const deleteEntry = async (id: string) => {
    const path = `calculations/${id}`;
    try {
      await deleteDoc(doc(db, 'calculations', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/5">
          <HistoryIcon className="w-8 h-8 text-zinc-500" />
        </div>
        <h2 className="text-2xl font-bold mb-2">History is Locked</h2>
        <p className="text-zinc-500 max-w-md mx-auto">
          Sign in to securely store and access your calculation history across all your devices.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-zinc-900/50 rounded-2xl animate-pulse border border-white/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <HistoryIcon className="w-5 h-5 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold">Calculation History</h2>
        </div>
        <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
          {history.length} RECORDS
        </span>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/30 rounded-3xl border border-dashed border-white/10">
          <CalcIcon className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-500">No calculations found yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {history.map((calc) => (
              <motion.div
                key={calc.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group bg-zinc-900/50 hover:bg-zinc-900 p-6 rounded-2xl border border-white/5 transition-all flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono mb-2">
                    <Clock className="w-3 h-3" />
                    {new Date(calc.timestamp).toLocaleString()}
                  </div>
                  <div className="text-zinc-400 font-mono text-sm">{calc.expression}</div>
                  <div className="text-xl font-bold text-emerald-500 font-mono">= {calc.result}</div>
                </div>
                
                <button
                  onClick={() => calc.id && deleteEntry(calc.id)}
                  className="p-3 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
