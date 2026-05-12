import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import MinesGrid from './components/MinesGrid';
import { calculateProbabilities, getRecommendedClicks, getPredictedBoard } from './utils/analysis';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  History, 
  Settings, 
  TrendingUp, 
  ShieldAlert, 
  RefreshCw,
  Play,
  Save,
  Trash2,
  Zap,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// The client will only work if the anon key is populated!
const supabase = createClient(supabaseUrl, supabaseAnonKey || 'dummy_key_to_prevent_crash_until_added');

function App() {
  const [minesCount, setMinesCount] = useState(3);
  const [revealed, setRevealed] = useState([]);
  const [history, setHistory] = useState([]);
  const [probabilities, setProbabilities] = useState(Array(25).fill(0));
  const [recommended, setRecommended] = useState([]);
  const [predictedBoard, setPredictedBoard] = useState(Array(25).fill(false));
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [showPrediction, setShowPrediction] = useState(false);
  const [voucher, setVoucher] = useState('');
  const [voucherError, setVoucherError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [generatedVoucher, setGeneratedVoucher] = useState('');

  // Fetch history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('rounds')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
        
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  // Update probabilities when state changes
  useEffect(() => {
    const probs = calculateProbabilities(history, revealed, minesCount);
    setProbabilities(probs);
    setRecommended(getRecommendedClicks(probs, 3));
    
    // Calculate dynamic confidence
    const avgProb = probs.filter(p => p !== -1).reduce((a, b) => a + b, 0) / (25 - revealed.length);
    setConfidence(Math.round((1 - avgProb) * 100));
  }, [history, revealed, minesCount]);

  const trapOptions = [1, 3, 5, 7];

  const cycleTraps = (direction) => {
    setShowPrediction(false);
    const currentIndex = trapOptions.indexOf(minesCount);
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = trapOptions.length - 1;
    if (nextIndex >= trapOptions.length) nextIndex = 0;
    setMinesCount(trapOptions[nextIndex]);
  };

  const handleTileClick = (index) => {
    // Disabled manual clicking as per user request to stop skulls from appearing
  };

  const saveRound = async () => {
    if (revealed.length === 0) return;
    
    // Construct full grid (true for mine, false for safe)
    const gridData = Array(25).fill(false);
    revealed.forEach(t => {
      if (t.isMine) gridData[t.index] = true;
    });

    try {
      const { error } = await supabase
        .from('rounds')
        .insert([{
          mines_count: minesCount,
          grid_data: JSON.stringify(gridData),
          outcome: 'logged'
        }]);
        
      if (error) throw error;
      fetchHistory();
      setRevealed([]);
      setShowPrediction(false);
    } catch (err) {
      console.error('Failed to save round', err);
    }
  };

  const predictNextRound = async () => {
    if (voucher.trim().length < 4) {
      setVoucherError('Invalid voucher format');
      setTimeout(() => setVoucherError(''), 2000);
      return;
    }

    setIsSimulationRunning(true);
    setRevealed([]);
    setShowPrediction(false);
    
    try {
      // 1. Check if voucher exists and is unused
      const { data: voucherData, error: fetchError } = await supabase
        .from('vouchers')
        .select('*')
        .eq('code', voucher.trim())
        .single();
        
      if (fetchError || !voucherData) {
        setVoucherError('Invalid or expired voucher');
        setIsSimulationRunning(false);
        setTimeout(() => setVoucherError(''), 2000);
        return;
      }
      
      if (voucherData.is_used) {
        setVoucherError('Voucher has already been used');
        setIsSimulationRunning(false);
        setTimeout(() => setVoucherError(''), 2000);
        return;
      }
      
      // 2. Mark voucher as used
      const { error: updateError } = await supabase
        .from('vouchers')
        .update({ is_used: true })
        .eq('code', voucher.trim());
        
      if (updateError) throw updateError;
      
      // Consume voucher locally for UI
      setVoucher('');

      setTimeout(() => {
        // Final random board
        setPredictedBoard(getPredictedBoard(minesCount));
        setIsSimulationRunning(false);
        setShowPrediction(true);
      }, 2000);
      
    } catch (err) {
      setVoucherError('Database error');
      setIsSimulationRunning(false);
      setTimeout(() => setVoucherError(''), 2000);
    }
  };

  const generateVoucher = async () => {
    // Basic local security check (In a real production app, use Supabase RLS or Edge Functions)
    if (adminSecret !== 'Hazard442..123') {
      alert('Unauthorized: Invalid admin password');
      setIsAdmin(false);
      setAdminSecret('');
      return;
    }

    try {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const { error } = await supabase
        .from('vouchers')
        .insert([{ code }]);
        
      if (error) throw error;
      setGeneratedVoucher(code);
    } catch (err) {
      console.error('Failed to generate voucher', err);
      alert('Database error connecting to Supabase');
    }
  };

  const toggleAdmin = () => {
    if (isAdmin) {
      setIsAdmin(false);
      setAdminSecret('');
      setGeneratedVoucher('');
    } else {
      const secret = window.prompt("ENTER ADMIN PASSWORD:");
      if (secret) {
        setIsAdmin(true);
        setAdminSecret(secret);
      }
    }
  };

  return (
    <div className="app-container">
      <header className="dashboard-header glass">
        <div className="title-group">
          <h1>MINES PREDICTOR AI</h1>
          <div className="flex gap-2 items-center text-secondary text-xs">
            <Activity size={14} className="text-accent-safe" />
            <span>AI ENGINE ACTIVE</span>
            <span className="mx-2">|</span>
            <TrendingUp size={14} className="text-accent-predict" />
            <span>CONFIDENCE: {confidence}%</span>
            <span className="mx-2">|</span>
            <ShieldAlert size={14} className="text-orange-400" />
            <span>STREAK: {history.length} ROUNDS</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button className="btn btn-secondary" onClick={() => { setRevealed([]); setShowPrediction(false); }}>
            <RefreshCw size={18} /> Reset
          </button>
          <button className="btn btn-primary" onClick={saveRound}>
            <Save size={18} /> Log Round
          </button>
        </div>
      </header>

      <main className="main-layout">
        <div className="grid-section">
          <MinesGrid 
            probabilities={probabilities}
            revealed={revealed}
            onTileClick={handleTileClick}
            recommended={showPrediction ? recommended : []}
            predictedBoard={showPrediction ? predictedBoard : null}
            isShuffling={isSimulationRunning}
          />
          
          <div className="glass panel w-full">
            <div className="panel-title">
              <ShieldAlert size={18} /> RISK ANALYSIS
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">SAFE PROBABILITY</div>
                <div className="stat-value text-accent-safe">
                  {((1 - (minesCount / (25 - revealed.length))) * 100).toFixed(1)}%
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">NEXT MULTIPLIER</div>
                <div className="stat-value text-accent-predict">
                  {(25 / (25 - minesCount)).toFixed(2)}x
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">REMAINING TRAPS</div>
                <div className="stat-value text-accent-danger">
                  {minesCount - revealed.filter(t => t.isMine).length}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">BANKROLL SUGGESTION</div>
                <div className="stat-value">
                  {minesCount > 10 ? 'CONSERVATIVE' : 'AGGRESSIVE'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="sidebar">
          <div className="glass panel">
            <div className="panel-title">
              <Settings size={18} /> CONFIGURATION
            </div>
            <div className="mb-4">
              <div className="traps-selector">
                <button 
                  onClick={() => cycleTraps(-1)} 
                  className="traps-selector-btn"
                >
                  <ChevronLeft size={36} />
                </button>
                <div className="traps-display">
                  <span className="traps-number">{minesCount}</span>
                  <span className="traps-label">traps</span>
                </div>
                <button 
                  onClick={() => cycleTraps(1)} 
                  className="traps-selector-btn"
                >
                  <ChevronRight size={36} />
                </button>
              </div>
            </div>
            
            <div className="mb-6 relative">
              <label className="text-xs text-secondary block mb-2">VOUCHER CODE</label>
              <input 
                type="text" 
                value={voucher} 
                onChange={(e) => { setVoucher(e.target.value.toUpperCase()); setVoucherError(''); }}
                placeholder="ENTER VOUCHER"
                className={`input-field ${voucherError ? 'error' : ''}`}
              />
              {voucherError && (
                <span className="absolute -bottom-5 left-0 text-accent-danger text-[10px] uppercase font-bold tracking-wider">{voucherError}</span>
              )}
            </div>

            <button 
              className={`predict-btn ${isSimulationRunning ? 'analyzing' : 'ready'}`}
              onClick={predictNextRound}
              disabled={isSimulationRunning}
            >
              {isSimulationRunning ? <RefreshCw className="animate-spin mr-2" /> : <Zap className="mr-2" />}
              {isSimulationRunning ? 'ANALYZING PATTERNS...' : 'PREDICT NEXT ROUND'}
            </button>
          </div>

          <div className="glass panel flex-1 overflow-hidden flex flex-col">
            <div className="panel-title">
              <History size={18} /> BOARD HISTORY
            </div>
            <div className="overflow-y-auto pr-2 flex-1 space-y-2">
              {history.map((round, idx) => (
                <div key={idx} className="stat-card flex justify-between items-center py-2 px-3">
                  <div className="text-xs font-mono">
                    #{history.length - idx} | {round.mines_count} Traps
                  </div>
                  <div className="text-[10px] text-secondary">
                    {new Date(round.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="text-center text-secondary text-sm py-10">
                  No history found. Log some rounds!
                </div>
              )}
            </div>
          </div>
          
          {isAdmin && (
            <div className="glass panel mt-4 flex flex-col">
              <div className="panel-title text-accent-predict mb-2">
                <Settings size={18} /> ADMIN VOUCHER GEN
              </div>
              <button 
                onClick={generateVoucher}
                className="btn py-2 text-sm bg-white/10 hover:bg-white/20 transition-colors w-full rounded"
              >
                CREATE NEW VOUCHER
              </button>
              {generatedVoucher && (
                <div className="mt-3 p-3 bg-black/50 rounded text-center border border-accent-predict/30">
                  <div className="text-xs text-secondary mb-1">Generated Code:</div>
                  <div className="text-xl font-mono text-accent-predict tracking-widest">{generatedVoucher}</div>
                </div>
              )}
            </div>
          )}
        </aside>
      </main>

      <footer className="disclaimer">
        Predictions are based on statistical analysis and do not guarantee outcomes.
        <br />
        Educational and analytical purposes only.
        <div className="mt-4">
          <button 
            onClick={toggleAdmin}
            className="text-[10px] text-white/10 hover:text-white/30 transition-colors bg-transparent border-none cursor-pointer"
          >
            Admin Panel
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
