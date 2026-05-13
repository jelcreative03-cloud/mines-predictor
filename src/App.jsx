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
  const [totalVouchers, setTotalVouchers] = useState(0);
  
  // WhatsApp / Manual state
  const [buyerEmail, setBuyerEmail] = useState('');
  const WHATSAPP_NUMBER = '233204104033'; // Updated with your number!

  // Fetch history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const handleWhatsAppBuy = () => {
    if (!buyerEmail.trim()) {
      alert("Please enter your email first so we can track your order.");
      return;
    }
    const message = encodeURIComponent(`Hello! I want to purchase a Mines Predictor VIP Voucher for 50 GHS.\n\nMy Email: ${buyerEmail}`);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
  };

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

  const fetchVoucherCount = async () => {
    try {
      const { count, error } = await supabase
        .from('vouchers')
        .select('*', { count: 'exact', head: true });
      if (!error) {
        setTotalVouchers(count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch voucher count', err);
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
      fetchVoucherCount(); // Update the count when a new one is made
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
        fetchVoucherCount(); // Fetch count when admin logs in
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
              disabled={isSimulationRunning || !voucher.trim()}
            >
              {isSimulationRunning ? <RefreshCw className="animate-spin mr-2" /> : <Zap className="mr-2" />}
              {isSimulationRunning ? 'ANALYZING PATTERNS...' : 'PREDICT NEXT ROUND'}
            </button>

            <div className="mt-6 pt-4 border-t border-white/10">
              <div className="text-[10px] text-secondary mb-2 text-center text-accent-predict/80 uppercase tracking-widest">Premium Access</div>
              <div className="flex flex-col gap-2">
                <input
                  type="email"
                  placeholder="YOUR EMAIL"
                  className="w-full bg-black/40 border border-white/10 rounded px-4 py-2 text-white text-xs text-center focus:outline-none focus:border-accent-predict transition-all"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                />
                <button 
                  onClick={handleWhatsAppBuy}
                  className="w-full bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/40 py-2.5 rounded text-xs hover:bg-[#25D366]/20 transition-all flex items-center justify-center gap-2 font-bold"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.675 1.439 5.662 1.439h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  BUY VOUCHER (50 GHS)
                </button>
              </div>
            </div>
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
              <div className="panel-title text-accent-predict mb-2 flex justify-between items-center">
                <span><Settings size={18} className="inline mr-2"/> ADMIN VOUCHER GEN</span>
              </div>
              
              <div className="flex justify-between items-center mb-4 px-2 py-2 bg-black/30 rounded border border-white/5">
                <span className="text-xs text-secondary">Total Generated:</span>
                <span className="text-sm font-bold text-accent-predict">{totalVouchers}</span>
              </div>

              <button 
                onClick={generateVoucher}
                className="btn py-2 text-sm bg-white/10 hover:bg-white/20 transition-colors w-full rounded"
              >
                CREATE NEW VOUCHER
              </button>
              {generatedVoucher && (
                <div className="mt-3 p-3 bg-black/50 rounded text-center border border-accent-predict/30 flex flex-col items-center">
                  <div className="text-xs text-secondary mb-1">Generated Code:</div>
                  <div className="text-xl font-mono text-accent-predict tracking-widest mb-3">{generatedVoucher}</div>
                  <div className="flex gap-2 w-full">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(generatedVoucher);
                        alert("Code copied to clipboard!");
                      }}
                      className="flex-1 text-[10px] bg-accent-predict/10 text-accent-predict border border-accent-predict/30 py-2 rounded hover:bg-accent-predict/20 transition-all font-bold"
                    >
                      COPY CODE
                    </button>
                    <button 
                      onClick={() => {
                        const element = document.createElement("a");
                        const file = new Blob([`Mines Predictor AI - VIP Voucher\n--------------------------------\nCode: ${generatedVoucher}\n\nUse this code to predict your next round!`], {type: 'text/plain'});
                        element.href = URL.createObjectURL(file);
                        element.download = `Voucher-${generatedVoucher}.txt`;
                        document.body.appendChild(element);
                        element.click();
                        document.body.removeChild(element);
                      }}
                      className="flex-1 text-[10px] bg-white/5 text-white border border-white/10 py-2 rounded hover:bg-white/10 transition-all font-bold"
                    >
                      DOWNLOAD
                    </button>
                  </div>
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
