import React from 'react';
import { Play, Settings, History, BarChart3, CheckCircle2, AlertCircle, Trash2, Award, BookOpen, Mail, AlignLeft, Calculator, Brain, GraduationCap } from 'lucide-react';

export default function Dashboard({ history, settings, onStartExam, onOpenSettings, onViewAttempt, onClearHistory }) {
  const keysConfigured = settings.keyA && settings.keyB;

  // Calculate averages
  const totalAttempts = history.length;
  
  const getAverage = (key) => {
    if (totalAttempts === 0) return 0;
    
    // Filter attempts to only those that had this section present
    const matchingAttempts = history.filter(attempt => {
      if (key === 'numerical_ability') {
        return !!attempt.paper?.numerical_ability;
      }
      if (key === 'reasoning_ability') {
        return !!attempt.paper?.reasoning_ability;
      }
      if (key === 'advanced_quant_reasoning') {
        return !!attempt.paper?.advanced_quant_reasoning;
      }
      // verbal sub-sections
      const verbalPaper = attempt.paper?.verbal_ability || attempt.paper;
      if (key === 'sentence_completion') {
        return verbalPaper?.sentence_completion && verbalPaper.sentence_completion.length > 0;
      }
      if (key === 'passage_recall') {
        return verbalPaper?.passage_recall && verbalPaper.passage_recall.length > 0;
      }
      if (key === 'email') {
        return !!verbalPaper?.email_writing;
      }
      return true;
    });

    if (matchingAttempts.length === 0) return 0;
    const sum = matchingAttempts.reduce((acc, attempt) => acc + (attempt.scores[key] || 0), 0);
    return Math.round((sum / matchingAttempts.length) * 10) / 10;
  };

  const avgNum = getAverage('numerical_ability');
  const avgReas = getAverage('reasoning_ability');
  const avgAdv = getAverage('advanced_quant_reasoning');
  const avgSC = getAverage('sentence_completion');

  // Helper to calculate percentage score for an attempt based on its test type
  const getPercent = (attempt) => {
    const type = attempt.testType || 'full';
    
    if (type === 'numerical_ability') {
      return ((attempt.scores?.numerical_ability || 0) / 20) * 100;
    }
    if (type === 'reasoning_ability') {
      return ((attempt.scores?.reasoning_ability || 0) / 20) * 100;
    }
    if (type === 'advanced_quant_reasoning') {
      return ((attempt.scores?.advanced_quant_reasoning || 0) / 14) * 100;
    }
    if (type === 'sentence_completion') {
      return ((attempt.scores?.sentence_completion || 0) / 20) * 100;
    }
    if (type === 'passage_recall') {
      return ((attempt.scores?.passage_recall || 0) / 40) * 100;
    }
    if (type === 'email_writing') {
      return (attempt.scores?.email || 0);
    }
    if (type === 'verbal_ability') {
      const scPct = ((attempt.scores?.sentence_completion || 0) / 20) * 100;
      const prPct = ((attempt.scores?.passage_recall || 0) / 40) * 100;
      const emailPct = (attempt.scores?.email || 0);
      return (scPct + prPct + emailPct) / 3;
    }
    
    // 'full'
    const numPct = ((attempt.scores?.numerical_ability || 0) / 20) * 100;
    const reasPct = ((attempt.scores?.reasoning_ability || 0) / 20) * 100;
    const scPct = ((attempt.scores?.sentence_completion || 0) / 20) * 100;
    const prPct = ((attempt.scores?.passage_recall || 0) / 40) * 100;
    const emailPct = (attempt.scores?.email || 0);
    const verbPct = (scPct + prPct + emailPct) / 3;
    const advPct = ((attempt.scores?.advanced_quant_reasoning || 0) / 14) * 100;
    
    return (numPct + reasPct + verbPct + advPct) / 4;
  };

  // SVG Trend Chart Data Calculation
  const renderTrendChart = () => {
    if (totalAttempts < 2) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', color: 'var(--text-muted)' }}>
          <BarChart3 size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
          <p style={{ fontSize: '0.875rem' }}>Complete 2 or more attempts to view progress trends.</p>
        </div>
      );
    }

    const width = 500;
    const height = 160;
    const padding = 25;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = history.slice(-7).map((attempt, index) => {
      const x = padding + (index / (Math.min(7, totalAttempts) - 1)) * chartWidth;
      const pct = getPercent(attempt);
      const y = padding + chartHeight - (pct / 100) * chartHeight;
      return { x, y, score: Math.round(pct), date: new Date(attempt.date).toLocaleDateString() };
    });

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    
    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        {/* Grid Lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--border-color)" strokeDasharray="3,3" />
        <line x1={padding} y1={padding + chartHeight / 2} x2={width - padding} y2={padding + chartHeight / 2} stroke="var(--border-color)" strokeDasharray="3,3" />
        <line x1={padding} y1={padding + chartHeight} x2={width - padding} y2={padding + chartHeight} stroke="var(--border-color)" />
        
        {/* Y Axis Labels */}
        <text x={padding - 5} y={padding + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10">100%</text>
        <text x={padding - 5} y={padding + chartHeight / 2 + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10">50%</text>
        <text x={padding - 5} y={padding + chartHeight + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10">0%</text>
 
        {/* Line Path */}
        <path d={pathData} fill="none" stroke="url(#chartGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Area fill */}
        <path d={`${pathData} L ${points[points.length - 1].x} ${padding + chartHeight} L ${points[0].x} ${padding + chartHeight} Z`} 
              fill="url(#areaGrad)" />
 
        {/* Data Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="var(--primary)" stroke="var(--bg-secondary)" strokeWidth="2" />
            <text x={p.x} y={p.y - 10} textAnchor="middle" fill="var(--text-primary)" fontSize="10" fontWeight="600">
              {p.score}%
            </text>
            <text x={p.x} y={padding + chartHeight + 15} textAnchor="middle" fill="var(--text-muted)" fontSize="8">
              Attempt {history.length - points.length + i + 1}
            </text>
          </g>
        ))}
 
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--secondary)" />
          </linearGradient>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    );
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* API Key Status Notice */}
      {!keysConfigured ? (
        <div style={{
          padding: '1.25rem',
          backgroundColor: 'var(--warning-light)',
          border: '1px solid var(--warning)',
          borderRadius: '0.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <AlertCircle style={{ color: 'var(--warning)', shrink: 0, marginTop: '0.125rem' }} />
            <div>
              <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>API Keys Required</h4>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Please configure Key A (Generator) and Key B (Evaluator) in settings before starting any practice modes.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary" style={{ borderColor: 'var(--warning)', color: 'var(--text-primary)' }} onClick={onOpenSettings}>
            <Settings size={16} /> Setup Keys
          </button>
        </div>
      ) : (
        <div style={{
          padding: '1rem 1.25rem',
          backgroundColor: 'var(--success-light)',
          border: '1px solid var(--success)',
          borderRadius: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          color: 'var(--success)'
        }}>
          <CheckCircle2 size={16} />
          Dual Groq keys (A: Generator & B: Evaluator) active. Ready to practice!
        </div>
      )}

      {/* Hero Welcome banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08), rgba(124, 58, 237, 0.08))',
        border: '1px solid var(--primary-light)',
        padding: '2rem',
        textAlign: 'left',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div style={{ flex: '1 1 500px' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, margin: '0 0 0.5rem 0', letterSpacing: '-0.025em' }}>
            TCS NQT Preparation Portal
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '580px', marginBottom: '1.5rem' }}>
            Simulate the exact 2026 TCS NQT exam interface. Practice Numerical, Reasoning, Verbal, and Advanced sections with instant local objective grading and AI evaluation.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={onOpenSettings} style={{ padding: '0.6rem 1.25rem' }}>
              <Settings size={18} /> API Settings
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid var(--border-color)', width: '120px', height: '120px', boxShadow: 'var(--card-shadow)' }}>
          <Award size={64} style={{ color: 'var(--primary)', opacity: 0.8 }} />
        </div>
      </div>

      {/* Practice Mode Selection Grid */}
      <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Core & Aptitude Sections */}
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GraduationCap size={20} style={{ color: 'var(--primary)' }} />
            Core Mock & Aptitude Exams
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            
            {/* Mode 1: Full Mock Test */}
            <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between', border: '1px solid var(--primary-light)', background: 'linear-gradient(to bottom right, var(--bg-secondary), rgba(79, 70, 229, 0.02))' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-indigo">Complete Mock</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>~101 mins</span>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Full NQT Mock Exam</h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Run all 4 sections (Numerical, Reasoning, Verbal, Advanced Quant & Reasoning) in NQT pattern.
                </p>
              </div>
              <button 
                className="btn btn-primary" 
                onClick={() => onStartExam('full')} 
                disabled={!keysConfigured}
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
              >
                <Play size={14} fill="white" /> Start Full Mock
              </button>
            </div>

            {/* Mode 2: Numerical Ability */}
            <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>Numerical</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>25 mins</span>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calculator size={16} style={{ color: '#ef4444' }} />
                  Numerical Ability
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Solve calculation-heavy percentages, interest, speed, work, & DI. (20 questions, Hard)
                </p>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={() => onStartExam('numerical_ability')} 
                disabled={!keysConfigured}
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
              >
                <Play size={14} /> Start Section
              </button>
            </div>

            {/* Mode 3: Reasoning Ability */}
            <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge" style={{ backgroundColor: '#ccfbf1', color: '#0f766e' }}>Reasoning</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>25 mins</span>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Brain size={16} style={{ color: '#0d9488' }} />
                  Reasoning Ability
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Practice coding-decoding, blood relations, seating arrangements, & decision making. (20 Qs)
                </p>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={() => onStartExam('reasoning_ability')} 
                disabled={!keysConfigured}
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
              >
                <Play size={14} /> Start Section
              </button>
            </div>

            {/* Mode 4: Advanced Quant & Reasoning */}
            <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#6b21a8' }}>Advanced</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>25 mins</span>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <GraduationCap size={16} style={{ color: '#8b5cf6' }} />
                  Advanced Section
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Tackle 14 harder-style mixed questions of quantitative & analytical reasoning. (Easy-Medium)
                </p>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={() => onStartExam('advanced_quant_reasoning')} 
                disabled={!keysConfigured}
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
              >
                <Play size={14} /> Start Section
              </button>
            </div>

          </div>
        </div>

        {/* Verbal Skills & Writing */}
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={20} style={{ color: 'var(--primary)' }} />
            Verbal Ability & Writing Practice
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            
            {/* Full Verbal Ability */}
            <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-indigo">Verbal Core</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>~26 mins</span>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Full Verbal Ability</h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Run the complete NQT Verbal section including Sentence, Recall, and Email tasks. (25 Qs)
                </p>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={() => onStartExam('verbal_ability')} 
                disabled={!keysConfigured}
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
              >
                <Play size={14} /> Start Section
              </button>
            </div>

            {/* Mode 2: Sentence Completion Practice */}
            <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>SC Drill</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>~8 mins</span>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <AlignLeft size={16} style={{ color: 'var(--primary)' }} />
                  Sentence Completion
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Practice NQT workplace collocations, phrasal verbs, prepositions, & vocabulary. (20 Qs)
                </p>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={() => onStartExam('sentence_completion')} 
                disabled={!keysConfigured}
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
              >
                <Play size={14} /> Start Drill
              </button>
            </div>

            {/* Mode 3: Passage Recall Practice */}
            <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>Recall Drill</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>~8 mins</span>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <BookOpen size={16} style={{ color: 'var(--primary)' }} />
                  Passage Recall
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Reconstruct dense corporate paragraphs from memory under strict reading timers. (4 passages)
                </p>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={() => onStartExam('passage_recall')} 
                disabled={!keysConfigured}
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
              >
                <Play size={14} /> Start Drill
              </button>
            </div>

            {/* Mode 4: Email Writing Practice */}
            <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>Email Drill</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>9 mins</span>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Mail size={16} style={{ color: 'var(--primary)' }} />
                  Email Writing
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Compose structured corporate emails matching scenarios & role constraints. (1 scenario)
                </p>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={() => onStartExam('email_writing')} 
                disabled={!keysConfigured}
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
              >
                <Play size={14} /> Start Drill
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* Metrics Row */}
      <div className="grid-cols-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'left' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Exams</span>
          <span style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--primary)' }}>{totalAttempts}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>completed attempts</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'left' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Aptitude (Numerical & Reasoning)</span>
          <span style={{ fontSize: '2.25rem', fontWeight: 800 }}>
            {totalAttempts > 0 ? `${avgNum > 0 ? avgNum : '—'}/20 | ${avgReas > 0 ? avgReas : '—'}/20` : '—'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            average quantitative & reasoning scores
          </span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'left' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Verbal & Advanced Avg</span>
          <span style={{ fontSize: '2.25rem', fontWeight: 800 }}>
            {totalAttempts > 0 ? `${avgSC > 0 ? avgSC : '—'}/20 | ${avgAdv > 0 ? avgAdv : '—'}/14` : '—'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            verbal sentence completions & advanced quant/reasoning
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }} className="grid-cols-2">
        {/* Historical Attempts Table */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <History size={18} style={{ color: 'var(--primary)' }} />
              Attempt History
            </h3>
            {totalAttempts > 0 && (
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--danger-light)', color: 'var(--danger)' }}
                onClick={onClearHistory}
              >
                <Trash2 size={12} /> Clear All
              </button>
            )}
          </div>

          <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '250px' }}>
            {totalAttempts === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', padding: '2rem 0' }}>
                <History size={24} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                <p style={{ fontSize: '0.875rem' }}>No practice history found.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {history.map((attempt, index) => {
                  const scorePct = Math.round(getPercent(attempt));

                  return (
                    <div 
                      key={attempt.id} 
                      className="card card-hover" 
                      style={{ 
                        padding: '0.75rem 1rem', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        cursor: 'pointer',
                        borderColor: 'var(--border-color)',
                        backgroundColor: 'var(--bg-primary)'
                      }}
                      onClick={() => onViewAttempt(attempt)}
                    >
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Attempt #{totalAttempts - index}</span>
                          <span className="badge" style={{ 
                            fontSize: '0.7rem', 
                            backgroundColor: 'var(--primary-light)', 
                            color: 'var(--primary)',
                            padding: '0.1rem 0.4rem',
                            fontWeight: 500
                          }}>
                            {attempt.testType === 'numerical_ability' && 'Numerical Ability'}
                            {attempt.testType === 'reasoning_ability' && 'Reasoning Ability'}
                            {attempt.testType === 'advanced_quant_reasoning' && 'Advanced Section'}
                            {attempt.testType === 'verbal_ability' && 'Verbal Ability'}
                            {attempt.testType === 'sentence_completion' && 'Sentence Completion'}
                            {attempt.testType === 'passage_recall' && 'Passage Recall'}
                            {attempt.testType === 'email_writing' && 'Email Writing'}
                            {(attempt.testType === 'full' || !attempt.testType) && 'Full Mock'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(attempt.date).toLocaleDateString()}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>
                          {attempt.overall_note || 'No notes generated.'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {scorePct}%
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {/* Display brief scores summary */}
                            {attempt.testType === 'numerical_ability' && `${attempt.scores.numerical_ability}/20`}
                            {attempt.testType === 'reasoning_ability' && `${attempt.scores.reasoning_ability}/20`}
                            {attempt.testType === 'advanced_quant_reasoning' && `${attempt.scores.advanced_quant_reasoning}/14`}
                            {attempt.testType === 'verbal_ability' && `${attempt.scores.sentence_completion}/20 | ${attempt.scores.passage_recall}/40 | ${attempt.scores.email}/100`}
                            {attempt.testType === 'full' && `${attempt.scores.numerical_ability + attempt.scores.reasoning_ability}/40 Apt | ${attempt.scores.sentence_completion}/20 SC | ${attempt.scores.passage_recall}/40 Rec`}
                            {attempt.testType === 'sentence_completion' && `${attempt.scores.sentence_completion}/20`}
                            {attempt.testType === 'passage_recall' && `${attempt.scores.passage_recall}/40`}
                            {attempt.testType === 'email_writing' && `${attempt.scores.email}/100`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }).reverse()}
              </div>
            )}
          </div>
        </div>

        {/* Progress Chart */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', margin: 0 }}>
            <BarChart3 size={18} style={{ color: 'var(--primary)' }} />
            Progress Trend
          </h3>
          <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {renderTrendChart()}
          </div>
        </div>
      </div>

    </div>
  );
}
