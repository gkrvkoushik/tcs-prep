import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Moon, Sun, AlertTriangle, RefreshCw, Sparkles, ClipboardCheck } from 'lucide-react';

import Settings from './components/Settings';
import Dashboard from './components/Dashboard';
import ExamEngine from './components/ExamEngine';
import ResultsView from './components/ResultsView';

import { generatePaper, evaluatePaper } from './utils/groq';
import { generateNumericalPaper, generateReasoningPaper, generateAdvancedPaper, evaluateObjectivePaper, buildTopicHistory } from './utils/aptitude';

export default function App() {
  // --- Persistent Settings State ---
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('tcs_nqt_settings');
    const defaultSettings = {
      keyA: import.meta.env.VITE_GROQ_KEY_A || '',
      keyB: import.meta.env.VITE_GROQ_KEY_B || '',
      modelA: import.meta.env.VITE_GROQ_MODEL_A || 'llama-3.3-70b-versatile',
      modelB: import.meta.env.VITE_GROQ_MODEL_B || 'llama-3.3-70b-versatile'
    };
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        keyA: parsed.keyA || defaultSettings.keyA,
        keyB: parsed.keyB || defaultSettings.keyB,
        modelA: parsed.modelA || defaultSettings.modelA,
        modelB: parsed.modelB || defaultSettings.modelB
      };
    }
    return defaultSettings;
  });

  // --- Historical Attempts State ---
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('tcs_nqt_history');
    return saved ? JSON.parse(saved) : [];
  });

  // --- Theme State ---
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('tcs_nqt_theme');
    return saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  // --- Core Navigation View State ---
  // 'dashboard' | 'settings' | 'generating_paper' | 'exam' | 'grading_exam' | 'results'
  const [currentView, setCurrentView] = useState('dashboard');
  const [lastRequestedTestType, setLastRequestedTestType] = useState('full');
  
  // --- Active Exam / Review States ---
  const [activePaper, setActivePaper] = useState(null);
  const [activeAnswers, setActiveAnswers] = useState({
    sentence_completion: {},
    passage_recall: {},
    email_writing: ''
  });
  
  // Exam Engine steps state
  const [examState, setExamState] = useState({
    activeSection: 'sentence_completion', // 'sentence_completion' | 'passage_recall' | 'email_writing'
    activeIndex: 0,
    activePhase: null, // 'reading' | 'writing'
    endTimestamp: null
  });

  // Results Review State
  const [selectedAttempt, setSelectedAttempt] = useState(null);

  // --- Error Handling State ---
  const [apiError, setApiError] = useState(null); // { message, type: 'generation' | 'grading' }

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tcs_nqt_theme', theme);
  }, [theme]);

  // Load In-Progress Exam (Crash Recovery) on mount
  useEffect(() => {
    const inProgress = localStorage.getItem('tcs_nqt_in_progress');
    if (inProgress === 'true') {
      try {
        const paper = JSON.parse(localStorage.getItem('tcs_nqt_active_paper'));
        const answers = JSON.parse(localStorage.getItem('tcs_nqt_active_answers'));
        const examState = JSON.parse(localStorage.getItem('tcs_nqt_active_state'));
        
        if (paper && answers && examState) {
          // If the timer is still valid or it's email, restore it
          // Note: If the timestamp has passed, the ExamEngine will handle it instantly on load.
          setActivePaper(paper);
          setActiveAnswers(answers);
          setExamState(examState);
          setCurrentView('exam');
        }
      } catch (err) {
        console.error('Failed to restore in-progress exam state:', err);
        clearInProgressExam();
      }
    }
  }, []);

  // Save in-progress details on changes to prevent work loss
  const saveInProgressExam = (paper, answers, state) => {
    localStorage.setItem('tcs_nqt_in_progress', 'true');
    localStorage.setItem('tcs_nqt_active_paper', JSON.stringify(paper));
    localStorage.setItem('tcs_nqt_active_answers', JSON.stringify(answers));
    localStorage.setItem('tcs_nqt_active_state', JSON.stringify(state));
  };

  const clearInProgressExam = () => {
    localStorage.removeItem('tcs_nqt_in_progress');
    localStorage.removeItem('tcs_nqt_active_paper');
    localStorage.removeItem('tcs_nqt_active_answers');
    localStorage.removeItem('tcs_nqt_active_state');
  };

  // Save Settings Helper
  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('tcs_nqt_settings', JSON.stringify(newSettings));
  };

  // Toggle Theme Helper
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // --- Step 1: Start Exam (Call Key A) ---
  const handleStartExam = async (testTypeInput = 'full') => {
    const testType = typeof testTypeInput === 'string' ? testTypeInput : lastRequestedTestType;
    setLastRequestedTestType(testType);
    setApiError(null);
    setCurrentView('generating_paper');
    
    // Gather topic histories and exclusions
    const recentNumericalExclusions = [];
    const recentReasoningExclusions = [];
    const recentAdvancedExclusions = [];
    const recentVerbalExclusions = [];
    
    // Collect past allocations from history to pass to allocator
    const numericalAllocations = history
      .filter(h => h.paper?.numerical_ability?.topic_allocation)
      .map(h => h.paper.numerical_ability.topic_allocation);
    const numericalHistory = buildTopicHistory(numericalAllocations);
    
    const advancedAllocations = history
      .filter(h => h.paper?.advanced_quant_reasoning?.topic_allocation)
      .map(h => h.paper.advanced_quant_reasoning.topic_allocation);
    const advancedHistory = buildTopicHistory(advancedAllocations);

    // Exclusions for verbal and objective sections
    history.slice(-5).forEach(attempt => {
      const verbalPaper = attempt.paper?.verbal_ability || attempt.paper;
      if (verbalPaper?.sentence_completion) {
        verbalPaper.sentence_completion.forEach(q => {
          if (q.sentence && !recentVerbalExclusions.includes(q.sentence)) recentVerbalExclusions.push(q.sentence);
        });
      }
      if (verbalPaper?.passage_recall) {
        verbalPaper.passage_recall.forEach(p => {
          if (p.paragraph && !recentVerbalExclusions.includes(p.paragraph)) recentVerbalExclusions.push(p.paragraph);
        });
      }
      if (verbalPaper?.email_writing?.scenario) {
        if (!recentVerbalExclusions.includes(verbalPaper.email_writing.scenario)) recentVerbalExclusions.push(verbalPaper.email_writing.scenario);
      }

      const numPaper = attempt.paper?.numerical_ability;
      if (numPaper) {
        const numQs = [
          ...(numPaper.standalone_questions || []),
          ...((numPaper.grouped_sets || []).flatMap(g => g.questions || []))
        ];
        numQs.forEach(q => { if (q.question_text) recentNumericalExclusions.push(q.question_text.slice(0, 40)); });
      }

      const reasPaper = attempt.paper?.reasoning_ability;
      if (reasPaper) {
        const reasQs = [
          ...(reasPaper.standalone_questions || []),
          ...((reasPaper.grouped_sets || []).flatMap(g => g.questions || []))
        ];
        reasQs.forEach(q => { if (q.question_text) recentReasoningExclusions.push(q.question_text.slice(0, 40)); });
      }

      const advPaper = attempt.paper?.advanced_quant_reasoning;
      if (advPaper) {
        const advQs = advPaper.standalone_questions || [];
        advQs.forEach(q => { if (q.question_text) recentAdvancedExclusions.push(q.question_text.slice(0, 40)); });
      }
    });

    try {
      let paper = {
        paper_id: `paper-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        testType: testType,
        numerical_ability: null,
        reasoning_ability: null,
        verbal_ability: null,
        advanced_quant_reasoning: null
      };

      if (testType === 'full') {
        paper.numerical_ability = await generateNumericalPaper(settings.keyA, settings.modelA, numericalHistory, recentNumericalExclusions.slice(-10));
        paper.reasoning_ability = await generateReasoningPaper(settings.keyA, settings.modelA, recentReasoningExclusions.slice(-10));
        paper.verbal_ability = await generatePaper(settings.keyA, settings.modelA, recentVerbalExclusions, 'full');
        paper.advanced_quant_reasoning = await generateAdvancedPaper(settings.keyA, settings.modelA, advancedHistory, recentAdvancedExclusions.slice(-10));
      } else if (testType === 'numerical_ability') {
        paper.numerical_ability = await generateNumericalPaper(settings.keyA, settings.modelA, numericalHistory, recentNumericalExclusions.slice(-15));
      } else if (testType === 'reasoning_ability') {
        paper.reasoning_ability = await generateReasoningPaper(settings.keyA, settings.modelA, recentReasoningExclusions.slice(-15));
      } else if (testType === 'advanced_quant_reasoning') {
        paper.advanced_quant_reasoning = await generateAdvancedPaper(settings.keyA, settings.modelA, advancedHistory, recentAdvancedExclusions.slice(-15));
      } else {
        const verbalMode = (testType === 'verbal_ability') ? 'full' : testType;
        paper.verbal_ability = await generatePaper(settings.keyA, settings.modelA, recentVerbalExclusions, verbalMode);
      }

      const initialAnswers = {
        numerical_ability: {},
        reasoning_ability: {},
        verbal_ability: {
          sentence_completion: {},
          passage_recall: {},
          email_writing: ''
        },
        advanced_quant_reasoning: {}
      };

      let initialSection = '';
      let initialDuration = 0;
      let initialPhase = null;

      if (paper.numerical_ability) {
        initialSection = 'numerical_ability';
        initialDuration = 25 * 60; // 25 minutes
      } else if (paper.reasoning_ability) {
        initialSection = 'reasoning_ability';
        initialDuration = 25 * 60;
      } else if (paper.verbal_ability) {
        const verbalPaper = paper.verbal_ability;
        if (verbalPaper.sentence_completion && verbalPaper.sentence_completion.length > 0) {
          initialSection = 'sentence_completion';
          initialDuration = 25;
        } else if (verbalPaper.passage_recall && verbalPaper.passage_recall.length > 0) {
          initialSection = 'passage_recall';
          initialPhase = 'reading';
          initialDuration = 30;
        } else if (verbalPaper.email_writing) {
          initialSection = 'email_writing';
          initialDuration = 540;
        }
      } else if (paper.advanced_quant_reasoning) {
        initialSection = 'advanced_quant_reasoning';
        initialDuration = 25 * 60;
      }

      const initialExamState = {
        activeSection: initialSection,
        activeIndex: 0,
        activePhase: initialPhase,
        endTimestamp: Date.now() + initialDuration * 1000
      };

      setActivePaper(paper);
      setActiveAnswers(initialAnswers);
      setExamState(initialExamState);
      
      saveInProgressExam(paper, initialAnswers, initialExamState);
      setCurrentView('exam');
    } catch (err) {
      console.error('Paper generation failed:', err);
      setApiError({
        message: err.message || 'Network connectivity loss or invalid API Key A.',
        type: 'generation'
      });
    }
  };

  // --- Step 2: Handle Answer Updates (Keystroke Auto-Save) ---
  const handleAnswerChange = (section, questionId, value) => {
    setActiveAnswers(prev => {
      const updated = { ...prev };
      
      if (section === 'numerical_ability' || section === 'reasoning_ability' || section === 'advanced_quant_reasoning') {
        updated[section] = {
          ...updated[section],
          [questionId]: value
        };
      } else if (section === 'sentence_completion') {
        updated.verbal_ability = {
          ...updated.verbal_ability,
          sentence_completion: {
            ...updated.verbal_ability?.sentence_completion,
            [questionId]: value
          }
        };
      } else if (section === 'passage_recall') {
        updated.verbal_ability = {
          ...updated.verbal_ability,
          passage_recall: {
            ...updated.verbal_ability?.passage_recall,
            [questionId]: value
          }
        };
      } else if (section === 'email_writing') {
        updated.verbal_ability = {
          ...updated.verbal_ability,
          email_writing: value
        };
      }
      
      saveInProgressExam(activePaper, updated, examState);
      return updated;
    });
  };

  // --- Step 3: Handle Exam UI Navigation changes (Timer ticks, phase changes) ---
  const handleExamStateChange = (updatedStateFields) => {
    setExamState(prev => {
      const updated = { ...prev, ...updatedStateFields };
      saveInProgressExam(activePaper, activeAnswers, updated);
      return updated;
    });
  };

  // --- Step 4: Submit Exam (Call Key B for Verbal, grading locally for Aptitude) ---
  const handleSubmitExam = async () => {
    setApiError(null);
    setCurrentView('grading_exam');

    try {
      let report = {
        summary: {},
        numerical_ability_results: null,
        reasoning_ability_results: null,
        verbal_ability_results: null,
        advanced_quant_reasoning_results: null
      };

      if (activePaper.numerical_ability) {
        report.numerical_ability_results = evaluateObjectivePaper(activePaper.numerical_ability, activeAnswers.numerical_ability);
      }

      if (activePaper.reasoning_ability) {
        report.reasoning_ability_results = evaluateObjectivePaper(activePaper.reasoning_ability, activeAnswers.reasoning_ability);
      }

      if (activePaper.verbal_ability) {
        const verbalAnswers = {
          sentence_completion: activeAnswers.verbal_ability?.sentence_completion || {},
          passage_recall: activeAnswers.verbal_ability?.passage_recall || {},
          email_writing: activeAnswers.verbal_ability?.email_writing || ''
        };
        const verbalReport = await evaluatePaper(settings.keyB, settings.modelB, activePaper.verbal_ability, verbalAnswers);
        report.verbal_ability_results = verbalReport;
      }

      if (activePaper.advanced_quant_reasoning) {
        report.advanced_quant_reasoning_results = evaluateObjectivePaper(activePaper.advanced_quant_reasoning, activeAnswers.advanced_quant_reasoning);
      }

      const scScore = report.verbal_ability_results?.sentence_completion_results ? report.verbal_ability_results.sentence_completion_results.reduce((acc, r) => acc + r.score, 0) : 0;
      const prScore = report.verbal_ability_results?.passage_recall_results ? report.verbal_ability_results.passage_recall_results.reduce((acc, r) => acc + r.score, 0) : 0;
      const emailScore = report.verbal_ability_results?.email_result ? report.verbal_ability_results.email_result.score : 0;

      const numScore = report.numerical_ability_results ? report.numerical_ability_results.summary.correct : 0;
      const reasScore = report.reasoning_ability_results ? report.reasoning_ability_results.summary.correct : 0;
      const advScore = report.advanced_quant_reasoning_results ? report.advanced_quant_reasoning_results.summary.correct : 0;

      const attemptScores = {
        numerical_ability: numScore,
        reasoning_ability: reasScore,
        sentence_completion: scScore,
        passage_recall: prScore,
        email: emailScore,
        advanced_quant_reasoning: advScore
      };

      let overallNote = "";
      if (activePaper.testType === 'full') {
        overallNote = `Aptitude: ${numScore + reasScore}/40, Advanced: ${advScore}/14, Verbal: ${scScore}/20 SC, ${prScore}/40 Recall, ${emailScore}/100 Email. ` + 
                      (report.verbal_ability_results?.summary?.overall_note || 'Grading completed.');
      } else if (activePaper.testType === 'numerical_ability') {
        overallNote = `Numerical Ability Practice: scored ${numScore}/20.`;
      } else if (activePaper.testType === 'reasoning_ability') {
        overallNote = `Reasoning Ability Practice: scored ${reasScore}/20.`;
      } else if (activePaper.testType === 'advanced_quant_reasoning') {
        overallNote = `Advanced Quant & Reasoning Practice: scored ${advScore}/14.`;
      } else {
        overallNote = report.verbal_ability_results?.summary?.overall_note || 'Grading completed.';
      }

      const newAttempt = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        testType: activePaper.testType,
        scores: attemptScores,
        overall_note: overallNote,
        paper: activePaper,
        answers: activeAnswers,
        report: report
      };

      const updatedHistory = [...history, newAttempt];
      setHistory(updatedHistory);
      localStorage.setItem('tcs_nqt_history', JSON.stringify(updatedHistory));
      
      setSelectedAttempt(newAttempt);
      clearInProgressExam();
      setCurrentView('results');
    } catch (err) {
      console.error('Paper evaluation failed:', err);
      setApiError({
        message: err.message || 'Evaluation failed. Please double check Key B or connectivity.',
        type: 'grading'
      });
    }
  };

  // Clear History
  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear your entire practice exam history? This cannot be undone.')) {
      setHistory([]);
      localStorage.removeItem('tcs_nqt_history');
    }
  };

  // View Historical Report
  const handleViewAttempt = (attempt) => {
    setSelectedAttempt(attempt);
    setCurrentView('results');
  };

  // Exit and discard active exam attempt
  const handleExitExam = () => {
    if (window.confirm("Are you sure you want to exit? This will discard your current attempt and will not record it in your history.")) {
      clearInProgressExam();
      setActivePaper(null);
      setActiveAnswers(null);
      setExamState(null);
      setCurrentView('dashboard');
    }
  };

  // Data Sanitation: Strip correct answers, required points, and explanations before passing paper props
  const getSanitizedPaper = () => {
    if (!activePaper) return null;
    
    const sanitizeObjective = (p) => {
      if (!p) return null;
      return {
        paper_id: p.paper_id,
        section: p.section,
        standalone_questions: (p.standalone_questions || []).map(q => ({
          id: q.id,
          topic_key: q.topic_key,
          difficulty: q.difficulty,
          question_type: q.question_type,
          question_text: q.question_text,
          options: q.options
        })),
        grouped_sets: (p.grouped_sets || []).map(g => ({
          topic_key: g.topic_key,
          context: g.context,
          questions: (g.questions || []).map(q => ({
            id: q.id,
            difficulty: q.difficulty,
            question_type: q.question_type,
            question_text: q.question_text,
            options: q.options
          }))
        }))
      };
    };

    return {
      paper_id: activePaper.paper_id,
      testType: activePaper.testType,
      numerical_ability: sanitizeObjective(activePaper.numerical_ability),
      reasoning_ability: sanitizeObjective(activePaper.reasoning_ability),
      advanced_quant_reasoning: sanitizeObjective(activePaper.advanced_quant_reasoning),
      verbal_ability: activePaper.verbal_ability ? {
        paper_id: activePaper.verbal_ability.paper_id,
        testType: activePaper.verbal_ability.testType,
        sentence_completion: (activePaper.verbal_ability.sentence_completion || []).map(q => ({
          id: q.id,
          sentence: q.sentence,
          difficulty: q.difficulty
        })),
        passage_recall: (activePaper.verbal_ability.passage_recall || []).map(q => ({
          id: q.id,
          paragraph: q.paragraph
        })),
        email_writing: activePaper.verbal_ability.email_writing
      } : null
    };
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="logo-group">
          <ClipboardCheck className="logo-icon" size={24} />
          <h1 className="logo-text">TCS NQT Verbal Practice Portal</h1>
        </div>
        <div className="nav-controls">
          <button className="btn-icon-only" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          {currentView === 'dashboard' && (
            <button className="btn btn-secondary" onClick={() => setCurrentView('settings')}>
              <SettingsIcon size={16} /> Settings
            </button>
          )}
        </div>
      </header>

      {/* Main Routing Views */}
      <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        
        {currentView === 'dashboard' && (
          <Dashboard
            history={history}
            settings={settings}
            onStartExam={handleStartExam}
            onOpenSettings={() => setCurrentView('settings')}
            onViewAttempt={handleViewAttempt}
            onClearHistory={handleClearHistory}
          />
        )}

        {currentView === 'settings' && (
          <Settings
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onBack={() => setCurrentView('dashboard')}
          />
        )}

        {/* Paper Generator Loading Screen */}
        {currentView === 'generating_paper' && (
          <div className="card text-center animate-fade-in" style={{ padding: '3rem 2rem', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
            {!apiError ? (
              <>
                <Sparkles size={48} className="logo-icon spin" style={{ color: 'var(--primary)', marginBottom: '1.5rem', display: 'inline-block' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Generating Custom Exam Paper...</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  Calling Key A to create a fresh set of sentence completions, passage recall items, and email scenarios. This takes 10-15 seconds...
                </p>
              </>
            ) : (
              <div style={{ textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--danger)', marginBottom: '1rem', alignItems: 'center' }}>
                  <AlertTriangle size={32} />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Generation Failed</h3>
                </div>
                <p style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '0.95rem' }}>
                  An error occurred while compiling your mock exam:
                </p>
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '1rem', borderRadius: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--danger)', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
                  {apiError.message}
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setCurrentView('dashboard')}>
                    Return to Dashboard
                  </button>
                  <button className="btn btn-primary" onClick={handleStartExam}>
                    <RefreshCw size={14} /> Retry Generation
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Exam Running Engine */}
        {currentView === 'exam' && activePaper && (
          <ExamEngine
            paper={getSanitizedPaper()} // Sanitized fields passed!
            answers={activeAnswers}
            activeSection={examState.activeSection}
            activeIndex={examState.activeIndex}
            activePhase={examState.activePhase}
            endTimestamp={examState.endTimestamp}
            onAnswerChange={handleAnswerChange}
            onStateChange={handleExamStateChange}
            onSubmitExam={handleSubmitExam}
            onExitExam={handleExitExam}
          />
        )}

        {/* Evaluator Grading Loading Screen */}
        {currentView === 'grading_exam' && (
          <div className="card text-center animate-fade-in" style={{ padding: '3rem 2rem', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
            {!apiError ? (
              <>
                <RefreshCw size={48} className="logo-icon spin" style={{ color: 'var(--secondary)', marginBottom: '1.5rem', display: 'inline-block' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Assessing Your Answers...</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  Calling Key B to run structured rubrics on spelling, paragraph recall metrics, and corporate email structure. This takes 10-15 seconds...
                </p>
              </>
            ) : (
              <div style={{ textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--danger)', marginBottom: '1rem', alignItems: 'center' }}>
                  <AlertTriangle size={32} />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Evaluation Failed</h3>
                </div>
                <p style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '0.95rem' }}>
                  An error occurred during evaluation of your answers:
                </p>
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '1rem', borderRadius: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--danger)', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
                  {apiError.message}
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => {
                    // Let them go back to the exam state which is saved in local storage
                    setCurrentView('exam');
                  }}>
                    Back to Exam
                  </button>
                  <button className="btn btn-primary" onClick={handleSubmitExam}>
                    <RefreshCw size={14} /> Retry Evaluation
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Screen */}
        {currentView === 'results' && selectedAttempt && (
          <ResultsView
            paper={selectedAttempt.paper}
            answers={selectedAttempt.answers}
            report={selectedAttempt.report}
            onBack={() => {
              setSelectedAttempt(null);
              setCurrentView('dashboard');
            }}
          />
        )}

      </main>

      <footer style={{ marginTop: '2rem', padding: '1rem 0', borderTop: '1px solid var(--border-color)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        TCS NQT Verbal Ability Prep Tool &bull; Powered by Groq APIs (Dual Key Setup)
      </footer>
    </div>
  );
}
