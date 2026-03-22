import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import * as math from 'mathjs';
import { Delete, Info, Grid3X3, Calculator as CalcIcon, Plus, Minus, X, ArrowRightLeft, Scale, Coins, RefreshCcw, Star, Search, PlusCircle } from 'lucide-react';
import { OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface CalculatorProps {
  user: User | null;
}

type Mode = 'scientific' | 'matrix' | 'converters';
type ConverterType = 'units' | 'currency';

export function Calculator({ user }: CalculatorProps) {
  const [mode, setMode] = useState<Mode>('scientific');
  const [converterType, setConverterType] = useState<ConverterType>('units');
  
  // Scientific State
  const [display, setDisplay] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  // Matrix State
  const [rowsA, setRowsA] = useState(2);
  const [colsA, setColsA] = useState(2);
  const [rowsB, setRowsB] = useState(2);
  const [colsB, setColsB] = useState(2);
  const [matrixA, setMatrixA] = useState<string[][]>([['', ''], ['', '']]);
  const [matrixB, setMatrixB] = useState<string[][]>([['', ''], ['', '']]);
  const [matrixResult, setMatrixResult] = useState<any>(null);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  // Unit Converter State
  const [unitValue, setUnitValue] = useState('1');
  const [fromUnit, setFromUnit] = useState('m');
  const [toUnit, setToUnit] = useState('km');
  const [unitResult, setUnitResult] = useState<string | null>(null);
  const [unitSearch, setUnitSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('unit_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [customUnits, setCustomUnits] = useState<{name: string, definition: string}[]>(() => {
    const saved = localStorage.getItem('custom_units');
    return saved ? JSON.parse(saved) : [];
  });
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitDef, setNewUnitDef] = useState('');

  // Currency Converter State
  const [currencyValue, setCurrencyValue] = useState('1');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [currencyResult, setCurrencyResult] = useState<string | null>(null);
  const [rates, setRates] = useState<any>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [currencyFavorites, setCurrencyFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('currency_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [customCurrencies, setCustomCurrencies] = useState<{name: string, rate: number}[]>(() => {
    const saved = localStorage.getItem('custom_currencies');
    return saved ? JSON.parse(saved) : [];
  });
  const [showCustomCurrencyForm, setShowCustomCurrencyForm] = useState(false);
  const [newCurrencyName, setNewCurrencyName] = useState('');
  const [newCurrencyRate, setNewCurrencyRate] = useState('');

  const buttons = [
    { label: 'C', action: 'clear', type: 'util' },
    { label: '(', action: '(', type: 'op' },
    { label: ')', action: ')', type: 'op' },
    { label: '/', action: '/', type: 'op' },
    { label: 'd/dx', action: 'derivative(', type: 'func' },
    { label: '∫', action: 'integral(', type: 'func' },
    
    { label: 'sin', action: 'sin(', type: 'func' },
    { label: '7', action: '7', type: 'num' },
    { label: '8', action: '8', type: 'num' },
    { label: '9', action: '9', type: 'num' },
    { label: '*', action: '*', type: 'op' },
    { label: '[', action: '[', type: 'op' },

    { label: 'cos', action: 'cos(', type: 'func' },
    { label: '4', action: '4', type: 'num' },
    { label: '5', action: '5', type: 'num' },
    { label: '6', action: '6', type: 'num' },
    { label: '-', action: '-', type: 'op' },
    { label: ']', action: ']', type: 'op' },

    { label: 'tan', action: 'tan(', type: 'func' },
    { label: '1', action: '1', type: 'num' },
    { label: '2', action: '2', type: 'num' },
    { label: '3', action: '3', type: 'num' },
    { label: '+', action: '+', type: 'op' },
    { label: ';', action: ';', type: 'op' },

    { label: 'log', action: 'log10(', type: 'func' },
    { label: '0', action: '0', type: 'num' },
    { label: '.', action: '.', type: 'num' },
    { label: 'exp', action: 'exp(', type: 'func' },
    { label: '=', action: 'equal', type: 'equal' },
    { label: 'det', action: 'det(', type: 'func' },

    { label: 'sqrt', action: 'sqrt(', type: 'func' },
    { label: '^', action: '^', type: 'op' },
    { label: 'pi', action: 'PI', type: 'const' },
    { label: 'e', action: 'E', type: 'const' },
    { label: 'DEL', action: 'delete', type: 'util' },
    { label: 'inv', action: 'inv(', type: 'func' },
  ];

  const handleAction = async (action: string) => {
    setError(null);
    if (action === 'clear') {
      setDisplay('');
      setResult(null);
    } else if (action === 'delete') {
      setDisplay(prev => prev.slice(0, -1));
    } else if (action === 'equal') {
      try {
        if (display.includes('integral(')) {
          setError('Use AI for Integrals');
          return;
        }

        const res = math.evaluate(display);
        const formattedResult = math.format(res, { precision: 10 });
        setResult(formattedResult.toString());
        
        if (user) {
          const path = 'calculations';
          try {
            await addDoc(collection(db, path), {
              userId: user.uid,
              expression: display,
              result: formattedResult.toString(),
              timestamp: new Date().toISOString()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, path);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('Firestore Error')) {
          console.error(err);
        } else {
          setError('Invalid Expression');
        }
      }
    } else {
      setDisplay(prev => prev + action);
    }
  };

  // Matrix Logic
  useEffect(() => {
    setMatrixA(prev => {
      const newMatrix = Array(rowsA).fill(0).map((_, r) => 
        Array(colsA).fill(0).map((_, c) => prev[r]?.[c] || '')
      );
      return newMatrix;
    });
  }, [rowsA, colsA]);

  useEffect(() => {
    setMatrixB(prev => {
      const newMatrix = Array(rowsB).fill(0).map((_, r) => 
        Array(colsB).fill(0).map((_, c) => prev[r]?.[c] || '')
      );
      return newMatrix;
    });
  }, [rowsB, colsB]);

  const handleMatrixInput = (matrix: 'A' | 'B', r: number, c: number, value: string) => {
    if (matrix === 'A') {
      const newMatrix = [...matrixA];
      newMatrix[r][c] = value;
      setMatrixA(newMatrix);
    } else {
      const newMatrix = [...matrixB];
      newMatrix[r][c] = value;
      setMatrixB(newMatrix);
    }
  };

  const performMatrixOp = async (op: 'add' | 'sub' | 'mul' | 'transposeA' | 'transposeB') => {
    setMatrixError(null);
    try {
      const parseMatrix = (m: string[][]) => m.map(row => row.map(val => math.evaluate(val || '0')));
      
      let res;
      let expression = '';
      
      if (op === 'add') {
        if (rowsA !== rowsB || colsA !== colsB) throw new Error('Dimensions must match for addition');
        res = math.add(parseMatrix(matrixA), parseMatrix(matrixB));
        expression = 'Matrix A + Matrix B';
      } else if (op === 'sub') {
        if (rowsA !== rowsB || colsA !== colsB) throw new Error('Dimensions must match for subtraction');
        res = math.subtract(parseMatrix(matrixA), parseMatrix(matrixB));
        expression = 'Matrix A - Matrix B';
      } else if (op === 'mul') {
        if (colsA !== rowsB) throw new Error('Cols of A must match rows of B');
        res = math.multiply(parseMatrix(matrixA), parseMatrix(matrixB));
        expression = 'Matrix A * Matrix B';
      } else if (op === 'transposeA') {
        res = math.transpose(parseMatrix(matrixA));
        expression = 'Transpose(Matrix A)';
      } else if (op === 'transposeB') {
        res = math.transpose(parseMatrix(matrixB));
        expression = 'Transpose(Matrix B)';
      }

      setMatrixResult(res);

      if (user && res) {
        const path = 'calculations';
        try {
          await addDoc(collection(db, path), {
            userId: user.uid,
            expression,
            result: JSON.stringify(res),
            timestamp: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    } catch (err: any) {
      setMatrixError(err.message || 'Matrix Error');
    }
  };

  // Unit Converter Logic
  useEffect(() => {
    customUnits.forEach(u => {
      try {
        // Check if unit already exists to avoid errors
        math.unit(1, u.name);
      } catch (e) {
        try {
          math.createUnit(u.name, u.definition);
        } catch (err) {
          console.error('Failed to create unit', u.name);
        }
      }
    });
    localStorage.setItem('custom_units', JSON.stringify(customUnits));
  }, [customUnits]);

  useEffect(() => {
    localStorage.setItem('unit_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (unit: string) => {
    setFavorites(prev => 
      prev.includes(unit) ? prev.filter(u => u !== unit) : [...prev, unit]
    );
  };

  const addCustomUnit = () => {
    if (newUnitName && newUnitDef) {
      setCustomUnits(prev => [...prev, { name: newUnitName, definition: newUnitDef }]);
      setNewUnitName('');
      setNewUnitDef('');
      setShowCustomForm(false);
    }
  };

  useEffect(() => {
    try {
      const res = math.unit(parseFloat(unitValue) || 0, fromUnit).to(toUnit);
      setUnitResult(res.toString());
    } catch (err) {
      setUnitResult('Incompatible Units');
    }
  }, [unitValue, fromUnit, toUnit]);

  // Currency Converter Logic
  const fetchRates = async () => {
    setLoadingRates(true);
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await response.json();
      setRates(data.rates);
    } catch (err) {
      console.error('Failed to fetch rates', err);
    } finally {
      setLoadingRates(false);
    }
  };

  useEffect(() => {
    if (mode === 'converters' && converterType === 'currency' && !rates) {
      fetchRates();
    }
  }, [mode, converterType]);

  useEffect(() => {
    localStorage.setItem('currency_favorites', JSON.stringify(currencyFavorites));
  }, [currencyFavorites]);

  useEffect(() => {
    localStorage.setItem('custom_currencies', JSON.stringify(customCurrencies));
  }, [customCurrencies]);

  const toggleCurrencyFavorite = (curr: string) => {
    setCurrencyFavorites(prev => 
      prev.includes(curr) ? prev.filter(c => c !== curr) : [...prev, curr]
    );
  };

  const addCustomCurrency = () => {
    const rate = parseFloat(newCurrencyRate);
    if (newCurrencyName && !isNaN(rate)) {
      setCustomCurrencies(prev => [...prev, { name: newCurrencyName.toUpperCase(), rate }]);
      setNewCurrencyName('');
      setNewCurrencyRate('');
      setShowCustomCurrencyForm(false);
    }
  };

  useEffect(() => {
    if (rates && fromCurrency && toCurrency) {
      const val = parseFloat(currencyValue) || 0;
      
      const allRates = { ...rates };
      customCurrencies.forEach(c => {
        allRates[c.name] = c.rate;
      });

      const fromRate = allRates[fromCurrency];
      const toRate = allRates[toCurrency];
      if (fromRate && toRate) {
        const res = (val / fromRate) * toRate;
        setCurrencyResult(`${res.toFixed(4)} ${toCurrency}`);
      }
    }
  }, [currencyValue, fromCurrency, toCurrency, rates, customCurrencies]);

  useEffect(() => {
    if (displayRef.current) {
      displayRef.current.scrollLeft = displayRef.current.scrollWidth;
    }
  }, [display]);

  const unitCategories: Record<string, string[]> = {
    Length: ['m', 'cm', 'mm', 'km', 'in', 'ft', 'yd', 'mi', 'nm', 'um', 'angstrom', 'mil', 'fathom', 'rod', 'chain', 'furlong', 'lightyear', 'parsec'],
    Area: ['m2', 'cm2', 'mm2', 'km2', 'sqin', 'sqft', 'sqyd', 'sqmi', 'acre', 'hectare'],
    Volume: ['l', 'ml', 'm3', 'cm3', 'mm3', 'gal', 'qt', 'pt', 'cup', 'floz', 'tsp', 'tbsp', 'bushel'],
    Mass: ['kg', 'g', 'mg', 'lb', 'oz', 'ton', 'slug', 'grain', 'carat', 'stone'],
    Time: ['s', 'ms', 'us', 'ns', 'ps', 'min', 'h', 'day', 'week', 'month', 'year', 'decade', 'century', 'millennium'],
    Temperature: ['degC', 'degF', 'K', 'degR'],
    Speed: ['m/s', 'km/h', 'mi/h', 'knot', 'mach'],
    Force: ['N', 'lbf', 'dyne', 'pond'],
    Pressure: ['Pa', 'bar', 'psi', 'atm', 'torr', 'mmHg', 'inHg'],
    Energy: ['J', 'cal', 'kcal', 'kWh', 'BTU', 'eV', 'erg'],
    Power: ['W', 'kW', 'hp', 'mW'],
    Angle: ['rad', 'deg', 'grad', 'cycle', 'arcmin', 'arcsec'],
    Digital: ['b', 'B', 'kb', 'KB', 'mb', 'MB', 'gb', 'GB', 'tb', 'TB', 'pb', 'PB'],
  };

  if (customUnits.length > 0) {
    unitCategories['Custom'] = customUnits.map(u => u.name);
  }

  const filteredUnitCategories = Object.entries(unitCategories).reduce((acc, [cat, units]) => {
    const filtered = units.filter(u => u.toLowerCase().includes(unitSearch.toLowerCase()));
    if (filtered.length > 0) {
      acc[cat] = filtered;
    }
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="max-w-4xl mx-auto px-4">
      {/* Mode Switcher */}
      <div className="flex justify-center mb-8">
        <div className="bg-zinc-900/50 p-1 rounded-2xl border border-white/5 flex flex-wrap justify-center gap-1">
          <button
            onClick={() => setMode('scientific')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'scientific' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-zinc-400 hover:text-zinc-100'}`}
          >
            <CalcIcon className="w-4 h-4" />
            Scientific
          </button>
          <button
            onClick={() => setMode('matrix')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'matrix' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-zinc-400 hover:text-zinc-100'}`}
          >
            <Grid3X3 className="w-4 h-4" />
            Matrix
          </button>
          <button
            onClick={() => setMode('converters')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'converters' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-zinc-400 hover:text-zinc-100'}`}
          >
            <Scale className="w-4 h-4" />
            Converters
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'scientific' ? (
          <motion.div
            key="scientific"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-xl mx-auto"
          >
            <div className="bg-zinc-900 rounded-3xl p-6 border border-white/5 shadow-2xl">
              {/* Display */}
              <div className="mb-6 bg-black/40 rounded-2xl p-6 text-right min-h-[140px] flex flex-col justify-end border border-white/5 overflow-hidden">
                <div 
                  ref={displayRef}
                  className="text-zinc-500 text-xl font-mono whitespace-nowrap overflow-x-auto scrollbar-hide mb-2"
                >
                  {display || '0'}
                </div>
                <div className="text-4xl font-bold text-emerald-500 font-mono break-all leading-tight">
                  {error ? (
                    <span className="text-red-500 text-2xl">{error}</span>
                  ) : (
                    result || ' '
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-6 gap-2 sm:gap-3">
                {buttons.map((btn, i) => (
                  <button
                    key={i}
                    onClick={() => handleAction(btn.action)}
                    className={`
                      h-12 sm:h-14 rounded-xl font-semibold transition-all active:scale-95 flex items-center justify-center text-sm
                      ${btn.type === 'num' ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700' : ''}
                      ${btn.type === 'op' ? 'bg-zinc-800/50 text-emerald-500 hover:bg-emerald-500/10' : ''}
                      ${btn.type === 'func' ? 'bg-zinc-800/50 text-emerald-400 hover:bg-emerald-500/10' : ''}
                      ${btn.type === 'const' ? 'bg-zinc-800/50 text-emerald-400 italic hover:bg-emerald-500/10' : ''}
                      ${btn.type === 'util' ? 'bg-zinc-800 text-zinc-400 hover:text-zinc-100' : ''}
                      ${btn.type === 'equal' ? 'bg-emerald-500 text-black hover:bg-emerald-400' : ''}
                    `}
                  >
                    {btn.label === 'DEL' ? <Delete className="w-4 h-4" /> : btn.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : mode === 'matrix' ? (
          <motion.div
            key="matrix"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Matrix A */}
              <div className="bg-zinc-900 rounded-3xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-emerald-500">Matrix A</h3>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={rowsA} 
                      onChange={(e) => setRowsA(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                      className="w-12 bg-black/40 border border-white/10 rounded-lg p-1 text-center text-xs"
                    />
                    <span className="text-zinc-600 text-xs">×</span>
                    <input 
                      type="number" 
                      value={colsA} 
                      onChange={(e) => setColsA(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                      className="w-12 bg-black/40 border border-white/10 rounded-lg p-1 text-center text-xs"
                    />
                  </div>
                </div>
                <div 
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${colsA}, 1fr)` }}
                >
                  {matrixA.map((row, r) => row.map((val, c) => (
                    <input
                      key={`${r}-${c}`}
                      type="text"
                      value={val}
                      onChange={(e) => handleMatrixInput('A', r, c, e.target.value)}
                      placeholder="0"
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-center font-mono focus:border-emerald-500/50 outline-none"
                    />
                  )))}
                </div>
                <button 
                  onClick={() => performMatrixOp('transposeA')}
                  className="mt-6 w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4" /> Transpose A
                </button>
              </div>

              {/* Matrix B */}
              <div className="bg-zinc-900 rounded-3xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-emerald-500">Matrix B</h3>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={rowsB} 
                      onChange={(e) => setRowsB(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                      className="w-12 bg-black/40 border border-white/10 rounded-lg p-1 text-center text-xs"
                    />
                    <span className="text-zinc-600 text-xs">×</span>
                    <input 
                      type="number" 
                      value={colsB} 
                      onChange={(e) => setColsB(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                      className="w-12 bg-black/40 border border-white/10 rounded-lg p-1 text-center text-xs"
                    />
                  </div>
                </div>
                <div 
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${colsB}, 1fr)` }}
                >
                  {matrixB.map((row, r) => row.map((val, c) => (
                    <input
                      key={`${r}-${c}`}
                      type="text"
                      value={val}
                      onChange={(e) => handleMatrixInput('B', r, c, e.target.value)}
                      placeholder="0"
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-center font-mono focus:border-emerald-500/50 outline-none"
                    />
                  )))}
                </div>
                <button 
                  onClick={() => performMatrixOp('transposeB')}
                  className="mt-6 w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4" /> Transpose B
                </button>
              </div>
            </div>

            {/* Matrix Operations */}
            <div className="flex flex-wrap justify-center gap-4">
              <button 
                onClick={() => performMatrixOp('add')}
                className="px-8 py-4 bg-emerald-500 text-black rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-5 h-5" /> Add (A+B)
              </button>
              <button 
                onClick={() => performMatrixOp('sub')}
                className="px-8 py-4 bg-emerald-500 text-black rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                <Minus className="w-5 h-5" /> Subtract (A-B)
              </button>
              <button 
                onClick={() => performMatrixOp('mul')}
                className="px-8 py-4 bg-emerald-500 text-black rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                <X className="w-5 h-5" /> Multiply (A×B)
              </button>
            </div>

            {/* Matrix Result */}
            {(matrixResult || matrixError) && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-900 rounded-3xl p-8 border border-white/5 text-center"
              >
                <h3 className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-6">Result</h3>
                {matrixError ? (
                  <div className="text-red-500 font-bold">{matrixError}</div>
                ) : (
                  <div className="inline-block p-6 bg-black/40 rounded-2xl border border-white/5">
                    <div className="grid gap-4">
                      {matrixResult.map?.((row: any, r: number) => (
                        <div key={r} className="flex gap-4 justify-center">
                          {row.map?.((val: any, c: number) => (
                            <div key={c} className="w-16 h-16 flex items-center justify-center bg-zinc-800 rounded-xl font-mono text-emerald-500 font-bold">
                              {math.format(val, { precision: 4 })}
                            </div>
                          ))}
                        </div>
                      )) || <div className="text-emerald-500 font-bold font-mono text-2xl">{math.format(matrixResult, { precision: 10 })}</div>}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="converters"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl mx-auto space-y-6"
          >
            {/* Converter Switcher */}
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setConverterType('units')}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold transition-all ${converterType === 'units' ? 'bg-zinc-100 text-black' : 'bg-zinc-800 text-zinc-400'}`}
              >
                <Scale className="w-4 h-4" /> Units
              </button>
              <button
                onClick={() => setConverterType('currency')}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold transition-all ${converterType === 'currency' ? 'bg-zinc-100 text-black' : 'bg-zinc-800 text-zinc-400'}`}
              >
                <Coins className="w-4 h-4" /> Currency
              </button>
            </div>

            <div className="bg-zinc-900 rounded-3xl p-8 border border-white/5 shadow-2xl">
              {converterType === 'units' ? (
                <div className="space-y-6">
                  {/* Search and Custom Unit Controls */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Search units..."
                        value={unitSearch}
                        onChange={(e) => setUnitSearch(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm font-mono text-zinc-100 outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <button
                      onClick={() => setShowCustomForm(!showCustomForm)}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold transition-all"
                    >
                      <PlusCircle className="w-4 h-4" /> Custom Unit
                    </button>
                  </div>

                  {/* Custom Unit Form */}
                  <AnimatePresence>
                    {showCustomForm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden space-y-4 bg-black/20 p-4 rounded-2xl border border-white/5"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            type="text"
                            placeholder="Unit Name (e.g. 'myunit')"
                            value={newUnitName}
                            onChange={(e) => setNewUnitName(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-lg p-2 text-sm outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Definition (e.g. '5 m')"
                            value={newUnitDef}
                            onChange={(e) => setNewUnitDef(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-lg p-2 text-sm outline-none"
                          />
                        </div>
                        <button
                          onClick={addCustomUnit}
                          className="w-full py-2 bg-emerald-500 text-black rounded-lg text-xs font-bold"
                        >
                          Add Unit
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Favorites Section */}
                  {favorites.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest flex items-center gap-2">
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /> Favorites
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {favorites.map(u => (
                          <button
                            key={u}
                            onClick={() => {
                              // If it's already in 'from', swap to 'to', or vice versa
                              if (fromUnit === u) setToUnit(u);
                              else setFromUnit(u);
                            }}
                            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-full text-xs text-zinc-300 transition-all border border-white/5"
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500 uppercase font-mono">Value</label>
                      <input
                        type="number"
                        value={unitValue}
                        onChange={(e) => setUnitValue(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-emerald-500 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-zinc-500 uppercase font-mono">From</label>
                        <button onClick={() => toggleFavorite(fromUnit)}>
                          <Star className={`w-3 h-3 ${favorites.includes(fromUnit) ? 'fill-yellow-500 text-yellow-500' : 'text-zinc-600'}`} />
                        </button>
                      </div>
                      <select
                        value={fromUnit}
                        onChange={(e) => setFromUnit(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-zinc-100 outline-none appearance-none"
                      >
                        {Object.entries(filteredUnitCategories).map(([cat, units]) => (
                          <optgroup key={cat} label={cat}>
                            {units.map(u => <option key={u} value={u}>{u}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-zinc-500 uppercase font-mono">To</label>
                        <button onClick={() => toggleFavorite(toUnit)}>
                          <Star className={`w-3 h-3 ${favorites.includes(toUnit) ? 'fill-yellow-500 text-yellow-500' : 'text-zinc-600'}`} />
                        </button>
                      </div>
                      <select
                        value={toUnit}
                        onChange={(e) => setToUnit(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-zinc-100 outline-none appearance-none"
                      >
                        {Object.entries(filteredUnitCategories).map(([cat, units]) => (
                          <optgroup key={cat} label={cat}>
                            {units.map(u => <option key={u} value={u}>{u}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="pt-6 border-t border-white/5 text-center">
                    <div className="text-xs text-zinc-500 uppercase font-mono mb-2">Result</div>
                    <div className="text-3xl font-bold text-emerald-500 font-mono">{unitResult}</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-4">
                    <div className="relative flex-1 w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Search currencies..."
                        value={currencySearch}
                        onChange={(e) => setCurrencySearch(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm font-mono text-zinc-100 outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                      <button
                        onClick={() => setShowCustomCurrencyForm(!showCustomCurrencyForm)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold transition-all"
                      >
                        <PlusCircle className="w-4 h-4" /> Custom
                      </button>
                      <button onClick={fetchRates} className={`p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-all ${loadingRates ? 'animate-spin' : ''}`}>
                        <RefreshCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Custom Currency Form */}
                  <AnimatePresence>
                    {showCustomCurrencyForm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden space-y-4 bg-black/20 p-4 rounded-2xl border border-white/5"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            type="text"
                            placeholder="Currency Code (e.g. 'MYC')"
                            value={newCurrencyName}
                            onChange={(e) => setNewCurrencyName(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-lg p-2 text-sm outline-none"
                          />
                          <input
                            type="number"
                            placeholder="Rate relative to 1 USD"
                            value={newCurrencyRate}
                            onChange={(e) => setNewCurrencyRate(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-lg p-2 text-sm outline-none"
                          />
                        </div>
                        <button
                          onClick={addCustomCurrency}
                          className="w-full py-2 bg-emerald-500 text-black rounded-lg text-xs font-bold"
                        >
                          Add Currency
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Currency Favorites */}
                  {currencyFavorites.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest flex items-center gap-2">
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /> Favorites
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {currencyFavorites.map(c => (
                          <button
                            key={c}
                            onClick={() => {
                              if (fromCurrency === c) setToCurrency(c);
                              else setFromCurrency(c);
                            }}
                            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-full text-xs text-zinc-300 transition-all border border-white/5"
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500 uppercase font-mono">Amount</label>
                      <input
                        type="number"
                        value={currencyValue}
                        onChange={(e) => setCurrencyValue(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-emerald-500 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-zinc-500 uppercase font-mono">From</label>
                        <button onClick={() => toggleCurrencyFavorite(fromCurrency)}>
                          <Star className={`w-3 h-3 ${currencyFavorites.includes(fromCurrency) ? 'fill-yellow-500 text-yellow-500' : 'text-zinc-600'}`} />
                        </button>
                      </div>
                      <select
                        value={fromCurrency}
                        onChange={(e) => setFromCurrency(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-zinc-100 outline-none appearance-none"
                      >
                        {[...Object.keys(rates || {}), ...customCurrencies.map(c => c.name)]
                          .filter(c => c.toLowerCase().includes(currencySearch.toLowerCase()))
                          .sort()
                          .map(curr => (
                            <option key={curr} value={curr}>{curr}</option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-zinc-500 uppercase font-mono">To</label>
                        <button onClick={() => toggleCurrencyFavorite(toCurrency)}>
                          <Star className={`w-3 h-3 ${currencyFavorites.includes(toCurrency) ? 'fill-yellow-500 text-yellow-500' : 'text-zinc-600'}`} />
                        </button>
                      </div>
                      <select
                        value={toCurrency}
                        onChange={(e) => setToCurrency(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-zinc-100 outline-none appearance-none"
                      >
                        {[...Object.keys(rates || {}), ...customCurrencies.map(c => c.name)]
                          .filter(c => c.toLowerCase().includes(currencySearch.toLowerCase()))
                          .sort()
                          .map(curr => (
                            <option key={curr} value={curr}>{curr}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="pt-6 border-t border-white/5 text-center">
                    <div className="text-xs text-zinc-500 uppercase font-mono mb-2">Converted Amount</div>
                    <div className="text-3xl font-bold text-emerald-500 font-mono">
                      {loadingRates ? 'Loading...' : currencyResult || '---'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!user && (
        <div className="mt-8 max-w-xl mx-auto p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-start gap-3">
          <Info className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-400 leading-relaxed">
            Sign in to save your calculation history and access advanced AI features.
          </p>
        </div>
      )}
    </div>
  );
}
