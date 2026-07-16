import React, { useState, useEffect, useRef } from 'react';
import { Timer, ArrowRight, EyeOff, BookOpen, Mail, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { renderContextWithTables } from '../utils/tableParser';

export default function ExamEngine({
  paper,
  answers,
  activeSection, // 'numerical_ability' | 'reasoning_ability' | 'sentence_completion' | 'passage_recall' | 'email_writing' | 'advanced_quant_reasoning'
  activeIndex, // index within that active section
  activePhase, // 'reading' | 'writing' (only for passage_recall)
  endTimestamp, // absolute timestamp for active timer
  onAnswerChange,
  onStateChange, // to sync navigation states to App (which saves to localStorage)
  onSubmitExam,
  onExitExam
}) {
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);

  // Timer self-correcting sync
  useEffect(() => {
    if (!endTimestamp) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        handleTimeout();
      }
    };

    tick(); // run once immediately
    timerRef.current = setInterval(tick, 200);

    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endTimestamp, activeSection, activeIndex, activePhase]);

  // Flat-maps all questions for objective sections
  const getSectionQuestions = () => {
    const secData = paper[activeSection];
    if (!secData) return [];
    
    const standalone = secData.standalone_questions || [];
    const groupedSets = secData.grouped_sets || [];
    
    const flat = [...standalone];
    groupedSets.forEach(group => {
      group.questions.forEach(q => {
        flat.push({
          ...q,
          topic_key: q.topic_key || group.topic_key,
          context: group.context
        });
      });
    });
    
    return flat.sort((a, b) => a.id - b.id);
  };

  const getSectionDuration = () => {
    if (activeSection === 'numerical_ability') return 25 * 60;
    if (activeSection === 'reasoning_ability') return 25 * 60;
    if (activeSection === 'advanced_quant_reasoning') return 25 * 60;
    if (activeSection === 'sentence_completion') return 25; // per question
    if (activeSection === 'passage_recall') return activePhase === 'reading' ? 30 : 90; // per passage
    return 540; // email writing (9 mins)
  };

  const handleTimeout = () => {
    if (activeSection === 'numerical_ability' || activeSection === 'reasoning_ability') {
      handleNextSection();
    } else if (activeSection === 'advanced_quant_reasoning') {
      onSubmitExam();
    } else if (activeSection === 'sentence_completion') {
      handleNextSentence();
    } else if (activeSection === 'passage_recall') {
      if (activePhase === 'reading') {
        onStateChange({
          activePhase: 'writing',
          endTimestamp: Date.now() + 90 * 1000
        });
      } else {
        handleNextRecall();
      }
    } else if (activeSection === 'email_writing') {
      if (paper.advanced_quant_reasoning) {
        handleNextSection();
      } else {
        onSubmitExam();
      }
    }
  };

  // Navigations
  const handleNextSentence = () => {
    const sentenceList = paper.verbal_ability?.sentence_completion || [];
    if (activeIndex < sentenceList.length - 1) {
      onStateChange({
        activeIndex: activeIndex + 1,
        endTimestamp: Date.now() + 25 * 1000
      });
    } else {
      const recallList = paper.verbal_ability?.passage_recall || [];
      if (recallList.length > 0) {
        onStateChange({
          activeSection: 'passage_recall',
          activeIndex: 0,
          activePhase: 'reading',
          endTimestamp: Date.now() + 30 * 1000
        });
      } else if (paper.verbal_ability?.email_writing) {
        onStateChange({
          activeSection: 'email_writing',
          activeIndex: 0,
          activePhase: null,
          endTimestamp: Date.now() + 540 * 1000
        });
      } else if (paper.advanced_quant_reasoning) {
        onStateChange({
          activeSection: 'advanced_quant_reasoning',
          activeIndex: 0,
          endTimestamp: Date.now() + 25 * 60 * 1000
        });
      } else {
        onSubmitExam();
      }
    }
  };

  const handleNextRecall = () => {
    const recallList = paper.verbal_ability?.passage_recall || [];
    if (activeIndex < recallList.length - 1) {
      onStateChange({
        activeIndex: activeIndex + 1,
        activePhase: 'reading',
        endTimestamp: Date.now() + 30 * 1000
      });
    } else {
      if (paper.verbal_ability?.email_writing) {
        onStateChange({
          activeSection: 'email_writing',
          activeIndex: 0,
          activePhase: null,
          endTimestamp: Date.now() + 540 * 1000
        });
      } else if (paper.advanced_quant_reasoning) {
        onStateChange({
          activeSection: 'advanced_quant_reasoning',
          activeIndex: 0,
          endTimestamp: Date.now() + 25 * 60 * 1000
        });
      } else {
        onSubmitExam();
      }
    }
  };

  const startWritingRecall = () => {
    onStateChange({
      activePhase: 'writing',
      endTimestamp: Date.now() + 90 * 1000
    });
  };

  const handleNextSection = () => {
    if (activeSection === 'numerical_ability') {
      if (paper.reasoning_ability) {
        onStateChange({
          activeSection: 'reasoning_ability',
          activeIndex: 0,
          endTimestamp: Date.now() + 25 * 60 * 1000
        });
      } else {
        transitionFromReasoning();
      }
    } else if (activeSection === 'reasoning_ability') {
      transitionFromReasoning();
    } else if (activeSection === 'email_writing') {
      if (paper.advanced_quant_reasoning) {
        onStateChange({
          activeSection: 'advanced_quant_reasoning',
          activeIndex: 0,
          endTimestamp: Date.now() + 25 * 60 * 1000
        });
      } else {
        onSubmitExam();
      }
    }
  };

  const handlePrevQuestion = () => {
    if (activeIndex > 0) {
      onStateChange({ activeIndex: activeIndex - 1 });
    }
  };

  const handleNextQuestion = () => {
    const questions = getSectionQuestions();
    if (activeIndex < questions.length - 1) {
      onStateChange({ activeIndex: activeIndex + 1 });
    }
  };

  const transitionFromReasoning = () => {
    const verbalPaper = paper.verbal_ability;
    if (verbalPaper) {
      if (verbalPaper.sentence_completion && verbalPaper.sentence_completion.length > 0) {
        onStateChange({
          activeSection: 'sentence_completion',
          activeIndex: 0,
          endTimestamp: Date.now() + 25 * 1000
        });
      } else if (verbalPaper.passage_recall && verbalPaper.passage_recall.length > 0) {
        onStateChange({
          activeSection: 'passage_recall',
          activeIndex: 0,
          activePhase: 'reading',
          endTimestamp: Date.now() + 30 * 1000
        });
      } else if (verbalPaper.email_writing) {
        onStateChange({
          activeSection: 'email_writing',
          activeIndex: 0,
          endTimestamp: Date.now() + 540 * 1000
        });
      }
    } else if (paper.advanced_quant_reasoning) {
      onStateChange({
        activeSection: 'advanced_quant_reasoning',
        activeIndex: 0,
        endTimestamp: Date.now() + 25 * 60 * 1000
      });
    } else {
      onSubmitExam();
    }
  };

  // Timer style calculations
  const getTimerClass = (totalDuration) => {
    const percent = timeLeft / totalDuration;
    if (percent <= 0.15 || timeLeft < 5) return 'timer-danger';
    if (percent <= 0.3) return 'timer-warning';
    return 'timer-normal';
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Input change handler
  const handleTextChange = (e) => {
    if (activeSection === 'sentence_completion') {
      const q = paper.verbal_ability.sentence_completion[activeIndex];
      onAnswerChange('sentence_completion', q.id, e.target.value);
    } else if (activeSection === 'passage_recall') {
      const q = paper.verbal_ability.passage_recall[activeIndex];
      onAnswerChange('passage_recall', q.id, e.target.value);
    } else if (activeSection === 'email_writing') {
      onAnswerChange('email_writing', paper.verbal_ability.email_writing.id, e.target.value);
    }
  };

  // Keypress accessibility
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && activeSection === 'sentence_completion') {
      e.preventDefault();
      handleNextSentence();
    }
  };

  // Renders for individual sections

  // 1. Sentence Completion
  const renderSentenceCompletion = () => {
    const question = paper.verbal_ability.sentence_completion[activeIndex];
    const userAnswer = answers.verbal_ability?.sentence_completion?.[question.id] || '';
    
    return (
      <div className="card animate-fade-in" style={{ padding: '2rem', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <span className="badge badge-indigo">Question {activeIndex + 1} of {paper.verbal_ability.sentence_completion.length}</span>
          <span className="badge" style={{ textTransform: 'capitalize', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            Difficulty: {question.difficulty}
          </span>
        </div>

        <p style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2rem', lineHeight: '1.8' }}>
          {question.sentence}
        </p>

        <div className="form-group" style={{ marginBottom: '2rem' }}>
          <label className="form-label" htmlFor="sc-answer">Type your answer below:</label>
          <input
            id="sc-answer"
            type="text"
            className="form-input"
            style={{ fontSize: '1.1rem', padding: '0.8rem 1rem' }}
            placeholder="Type single word or short phrase..."
            value={userAnswer}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            autoFocus
            autoComplete="off"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleNextSentence}>
            {activeIndex < paper.verbal_ability.sentence_completion.length - 1 ? 'Next Question' : 'Next Section'} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  };

  // 2. Passage Recall
  const renderPassageRecall = () => {
    const paragraphData = paper.verbal_ability.passage_recall[activeIndex];
    const userAnswer = answers.verbal_ability?.passage_recall?.[paragraphData.id] || '';
    
    if (activePhase === 'reading') {
      return (
        <div className="card animate-fade-in" style={{ padding: '2.5rem 2rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <span className="badge badge-indigo">Passage {activeIndex + 1} of {paper.verbal_ability.passage_recall.length} (Reading Phase)</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
              <BookOpen size={14} /> Read carefully. Will hide in {timeLeft}s
            </span>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-tertiary)',
            borderLeft: '4px solid var(--primary)',
            padding: '1.5rem',
            borderRadius: '0 0.5rem 0.5rem 0',
            fontSize: '1.2rem',
            lineHeight: '1.8',
            color: 'var(--text-primary)',
            marginBottom: '2rem'
          }}>
            {paragraphData.paragraph}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Recall details, names, roles, figures, and logic.
            </span>
            <button className="btn btn-primary" onClick={startWritingRecall}>
              Start Writing Now <ArrowRight size={16} />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="card animate-fade-in" style={{ padding: '2rem', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <span className="badge badge-indigo" style={{ backgroundColor: 'var(--secondary)', color: 'white' }}>
            Passage {activeIndex + 1} of {paper.verbal_ability.passage_recall.length} (Recall Phase)
          </span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <EyeOff size={14} /> Passage Hidden
          </span>
        </div>

        <div className="form-group" style={{ marginBottom: '2rem' }}>
          <label className="form-label" htmlFor="pr-answer">
            Reconstruct the meaning and key details of the paragraph in your own words:
          </label>
          <textarea
            id="pr-answer"
            className="form-input form-textarea"
            style={{ fontSize: '1.05rem', minHeight: '150px' }}
            placeholder="Type your summary from memory..."
            value={userAnswer}
            onChange={handleTextChange}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleNextRecall}>
            {activeIndex < paper.verbal_ability.passage_recall.length - 1 ? 'Next Passage' : 'Next Section'} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  };

  // 3. Email Writing
  const renderEmailWriting = () => {
    const emailData = paper.verbal_ability.email_writing;
    const userAnswer = answers.verbal_ability?.email_writing || '';
    const hasNext = !!paper.advanced_quant_reasoning;
    
    return (
      <div className="card animate-fade-in" style={{ padding: '2rem', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <span className="badge badge-indigo">Email Writing</span>
          <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', textTransform: 'capitalize' }}>
            Tone: {emailData.tone}
          </span>
        </div>

        <div className="grid-cols-2" style={{ gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="card" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Scenario
              </h4>
              <p style={{ fontSize: '1rem', color: 'var(--text-primary)', lineHeight: '1.6' }}>
                {emailData.scenario}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Recipient
                </h4>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {emailData.recipient_role}
                </p>
              </div>
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Tone
                </h4>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {emailData.tone}
                </p>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Required Elements
              </h4>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {emailData.required_elements.map((el, i) => (
                  <li key={i}>{el}</li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group" style={{ flexGrow: 1, margin: 0 }}>
              <label className="form-label" htmlFor="email-editor" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Mail size={16} /> Compose Email
              </label>
              <textarea
                id="email-editor"
                className="form-input form-textarea"
                style={{ fontSize: '1rem', flexGrow: 1, minHeight: '300px', height: '100%', fontFamily: 'Courier New, Courier, monospace' }}
                placeholder="To: [Recipient]&#10;Subject: [Clear, concise subject line]&#10;&#10;Dear Sir/Madam,&#10;&#10;[Body of the email...]&#10;&#10;Sincerely,&#10;[Name]"
                value={userAnswer}
                onChange={handleTextChange}
                autoFocus
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />
            Ensure you include all required elements before submitting.
          </span>
          <button className="btn btn-primary" onClick={hasNext ? handleNextSection : onSubmitExam} style={{ padding: '0.75rem 1.5rem' }}>
            {hasNext ? 'Next Section' : 'Submit Exam'}
          </button>
        </div>
      </div>
    );
  };

  // 4. Objective Sections (Numerical, Reasoning, Advanced Quant/Reasoning)
  const renderObjectiveSection = () => {
    const questions = getSectionQuestions();
    const question = questions[activeIndex];
    const sectionAnswers = answers[activeSection] || {};
    const userAnswer = sectionAnswers[question?.id] || '';
    const hasNext = activeSection === 'numerical_ability' || activeSection === 'reasoning_ability' || (activeSection === 'email_writing' && paper.advanced_quant_reasoning);

    if (!question) {
      return (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <AlertTriangle size={32} style={{ margin: '0 auto 1rem auto' }} />
          No questions loaded for this section.
        </div>
      );
    }

    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Navigation Palette */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          backgroundColor: 'var(--bg-secondary)',
          padding: '0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-color)'
        }}>
          {questions.map((q, idx) => {
            const isAnswered = sectionAnswers[q.id] !== undefined && sectionAnswers[q.id] !== null && String(sectionAnswers[q.id]).trim() !== '';
            const isActive = idx === activeIndex;
            return (
              <button
                key={q.id}
                onClick={() => onStateChange({ activeIndex: idx })}
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  backgroundColor: isActive ? 'var(--primary-light)' : isAnswered ? 'var(--primary)' : 'var(--bg-primary)',
                  color: isActive ? 'var(--primary)' : isAnswered ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Question Panel */}
        <div className="grid-cols-2" style={{
          gridTemplateColumns: question.context ? '1.2fr 1fr' : '1fr',
          gap: '1.5rem',
          textAlign: 'left'
        }}>
          
          {/* Grouped Set Context Panel (if present) */}
          {question.context && (
            <div className="card" style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              fontSize: '1rem',
              lineHeight: '1.6',
              color: 'var(--text-primary)',
              overflowY: 'auto',
              maxHeight: '400px'
            }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Shared Context Details
              </h4>
              <div style={{ margin: 0 }}>
                {renderContextWithTables(question.context)}
              </div>
            </div>
          )}

          {/* Question Text & Options/Input Box */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '300px', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span className="badge badge-indigo">Question {activeIndex + 1} of {questions.length}</span>
                <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  {question.topic_key?.replaceAll('_', ' ')}
                </span>
              </div>

              <p style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                {question.question_text}
              </p>

              {/* MCQ Options Rendering */}
              {question.question_type === 'mcq' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {question.options.map((opt) => (
                    <label
                      key={opt}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                        backgroundColor: userAnswer === opt ? 'rgba(79, 70, 229, 0.04)' : 'transparent',
                        borderColor: userAnswer === opt ? 'var(--primary)' : 'var(--border-color)'
                      }}
                    >
                      <input
                        type="radio"
                        name={`q-${question.id}`}
                        value={opt}
                        checked={userAnswer === opt}
                        onChange={() => onAnswerChange(activeSection, question.id, opt)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{opt}</span>
                    </label>
                  ))}
                </div>
              ) : (
                /* Numeric Entry Box Rendering */
                <div className="form-group">
                  <label className="form-label" htmlFor="numeric-answer">Enter numeric answer (decimal or integer):</label>
                  <input
                    id="numeric-answer"
                    type="text"
                    className="form-input"
                    placeholder="Type number here..."
                    value={userAnswer}
                    onChange={(e) => onAnswerChange(activeSection, question.id, e.target.value)}
                    autoComplete="off"
                    style={{ fontSize: '1.1rem', maxWidth: '300px' }}
                  />
                </div>
              )}
            </div>

            {/* Bottom Nav inside Card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handlePrevQuestion}
                  disabled={activeIndex === 0}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleNextQuestion}
                  disabled={activeIndex === questions.length - 1}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>

              <div>
                {userAnswer && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => onAnswerChange(activeSection, question.id, '')}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'transparent' }}
                  >
                    Clear Response
                  </button>
                )}
              </div>

              <div>
                {activeIndex === questions.length - 1 && (
                  <button
                    className="btn btn-primary"
                    onClick={hasNext ? handleNextSection : onSubmitExam}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  >
                    {hasNext ? 'Next Section' : 'Submit Exam'} <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
    );
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Header Info Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '1rem 1.5rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
        
        <div style={{ textAlign: 'left' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            {activeSection === 'numerical_ability' && 'Numerical Ability'}
            {activeSection === 'reasoning_ability' && 'Reasoning Ability'}
            {activeSection === 'sentence_completion' && 'Sentence Completion'}
            {activeSection === 'passage_recall' && `Passage Recall (${activePhase === 'reading' ? 'Reading' : 'Writing'})`}
            {activeSection === 'email_writing' && 'Email Writing'}
            {activeSection === 'advanced_quant_reasoning' && 'Advanced Quant & Reasoning'}
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {paper.testType === 'numerical_ability' && 'Numerical Ability Practice'}
            {paper.testType === 'reasoning_ability' && 'Reasoning Ability Practice'}
            {paper.testType === 'advanced_quant_reasoning' && 'Advanced Quant & Reasoning Practice'}
            {paper.testType === 'verbal_ability' && 'Verbal Ability Practice'}
            {paper.testType === 'sentence_completion' && 'Sentence Completion Drill'}
            {paper.testType === 'passage_recall' && 'Passage Recall Drill'}
            {paper.testType === 'email_writing' && 'Email Writing Drill'}
            {paper.testType === 'full' && 'TCS NQT Comprehensive Practice Mock'}
          </span>
        </div>

        {/* Right side controls (Timer + Exit button) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Timer Box */}
          <div className={`timer-container ${getTimerClass(getSectionDuration())}`}>
            <Timer size={20} className={timeLeft <= 10 ? 'spin' : ''} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: '1.25rem' }}>
              {formatTime(timeLeft)}
            </span>
          </div>
          
          <button 
            className="btn btn-secondary" 
            onClick={onExitExam}
            style={{ 
              borderColor: 'var(--danger-light)', 
              color: 'var(--danger)', 
              padding: '0.5rem 1rem',
              fontSize: '0.85rem'
            }}
          >
            Exit Test
          </button>
        </div>
      </div>

      {/* Main Section Content Area */}
      <div>
        {activeSection === 'numerical_ability' && renderObjectiveSection()}
        {activeSection === 'reasoning_ability' && renderObjectiveSection()}
        {activeSection === 'sentence_completion' && renderSentenceCompletion()}
        {activeSection === 'passage_recall' && renderPassageRecall()}
        {activeSection === 'email_writing' && renderEmailWriting()}
        {activeSection === 'advanced_quant_reasoning' && renderObjectiveSection()}
      </div>
    </div>
  );
}
