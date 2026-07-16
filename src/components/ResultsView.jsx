import React, { useState } from 'react';
import { Award, CheckCircle2, XCircle, ArrowLeft, BookOpen } from 'lucide-react';
import { renderContextWithTables } from '../utils/tableParser';

export default function ResultsView({ paper, answers, report, onBack }) {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'numerical_ability' | 'reasoning_ability' | ...

  // Extract results safely depending on what was evaluated
  const numResults = report.numerical_ability_results;
  const reasResults = report.reasoning_ability_results;
  const advResults = report.advanced_quant_reasoning_results;
  const verbalReport = report.verbal_ability_results || {};

  const { sentence_completion_results, passage_recall_results, email_result } = verbalReport;

  // Grade color helpers
  const getScoreColor = (pct) => {
    if (pct >= 80) return 'var(--success)';
    if (pct >= 55) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getScoreBg = (pct) => {
    if (pct >= 80) return 'var(--success-light)';
    if (pct >= 55) return 'var(--warning-light)';
    return 'var(--danger-light)';
  };

  // Convert scores to numbers/percentages
  const numScore = numResults ? numResults.summary.correct : 0;
  const reasScore = reasResults ? reasResults.summary.correct : 0;
  const advScore = advResults ? advResults.summary.correct : 0;
  const scScore = sentence_completion_results ? sentence_completion_results.reduce((acc, r) => acc + r.score, 0) : 0;
  const prScore = passage_recall_results ? passage_recall_results.reduce((acc, r) => acc + r.score, 0) : 0;
  const emailScore = email_result ? email_result.score : 0;

  const numPct = (numScore / 20) * 100;
  const reasPct = (reasScore / 20) * 100;
  const advPct = (advScore / 14) * 100;
  const scPct = (scScore / 20) * 100;
  const prPct = (prScore / 40) * 100;
  const emailPct = emailScore;

  const type = paper.testType || 'full';
  let overallPct = 0;
  if (type === 'numerical_ability') {
    overallPct = Math.round(numPct);
  } else if (type === 'reasoning_ability') {
    overallPct = Math.round(reasPct);
  } else if (type === 'advanced_quant_reasoning') {
    overallPct = Math.round(advPct);
  } else if (type === 'sentence_completion') {
    overallPct = Math.round(scPct);
  } else if (type === 'passage_recall') {
    overallPct = Math.round(prPct);
  } else if (type === 'email_writing') {
    overallPct = Math.round(emailPct);
  } else if (type === 'verbal_ability') {
    overallPct = Math.round((scPct + prPct + emailPct) / 3);
  } else {
    // 'full' mock test
    overallPct = Math.round((numPct + reasPct + ((scPct + prPct + emailPct) / 3) + advPct) / 4);
  }

  // Helper to render objective sections review tab
  const renderObjectiveSectionReview = (sectionKey, resultsData) => {
    if (!resultsData) return null;
    const { results, by_topic, summary } = resultsData;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>SCORE</span>
            <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>{summary.correct} / {summary.total_questions}</span>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>ACCURACY</span>
            <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>{summary.accuracy_percent}%</span>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>ATTEMPTED</span>
            <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>{summary.attempted} / {summary.total_questions}</span>
          </div>
        </div>

        {/* Topic Breakdown Card */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Topic Breakdown & Mastery</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontWeight: 600 }}>Topic Area</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>Correct</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>Total</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>Accuracy</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(by_topic).map(([topicKey, stats]) => {
                  const pct = Math.round((stats.correct / stats.total) * 100);
                  let statusLabel = 'Strong';
                  let statusColor = 'var(--success)';
                  if (pct < 50) {
                    statusLabel = 'Needs Improvement';
                    statusColor = 'var(--danger)';
                  } else if (pct < 80) {
                    statusLabel = 'Moderate';
                    statusColor = 'var(--warning)';
                  }
                  
                  return (
                    <tr key={topicKey} style={{ borderBottom: '1px solid var(--bg-tertiary)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500, textTransform: 'capitalize' }}>
                        {topicKey.replaceAll('_', ' ')}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>{stats.correct}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>{stats.total}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>{pct}%</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 600, color: statusColor }}>
                        {statusLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Question Review */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0.5rem 0 0 0' }}>Detailed Answer Key</h3>
          {results.map((r, idx) => {
            const secPaper = paper[sectionKey];
            let qPaper = (secPaper?.standalone_questions || []).find(q => q.id === r.id);
            let contextText = null;
            if (!qPaper) {
              (secPaper?.grouped_sets || []).forEach(group => {
                const found = (group.questions || []).find(q => q.id === r.id);
                if (found) {
                  qPaper = found;
                  contextText = group.context;
                }
              });
            }

            return (
              <div key={r.id} className="card" style={{
                borderLeft: `4px solid ${r.correct ? 'var(--success)' : r.attempted ? 'var(--danger)' : 'var(--text-muted)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                    Question {idx + 1}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge" style={{ textTransform: 'capitalize' }}>
                      {r.topic_key?.replaceAll('_', ' ')}
                    </span>
                    {r.correct ? (
                      <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.15rem', fontWeight: 600, fontSize: '0.85rem' }}>
                        <CheckCircle2 size={14} /> Correct
                      </span>
                    ) : r.attempted ? (
                      <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.15rem', fontWeight: 600, fontSize: '0.85rem' }}>
                        <XCircle size={14} /> Incorrect
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.15rem', fontWeight: 600, fontSize: '0.85rem' }}>
                        Unattempted
                      </span>
                    )}
                  </div>
                </div>

                {contextText && (
                  <div style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.85rem',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)'
                  }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Context:</strong>
                    {renderContextWithTables(contextText)}
                  </div>
                )}

                <p style={{ fontWeight: 600, fontSize: '1rem', margin: 0 }}>
                  {r.question_text}
                </p>

                {r.question_type === 'mcq' && r.options && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }} className="grid-cols-2">
                    {r.options.map(opt => {
                      const isCorrectAnswer = opt === r.correct_answer;
                      const isUserAnswer = opt === r.user_answer;
                      let optionStyle = {
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)'
                      };
                      if (isCorrectAnswer) {
                        optionStyle.backgroundColor = 'var(--success-light)';
                        optionStyle.borderColor = 'var(--success)';
                        optionStyle.fontWeight = '600';
                      } else if (isUserAnswer) {
                        optionStyle.backgroundColor = 'var(--danger-light)';
                        optionStyle.borderColor = 'var(--danger)';
                      }
                      return (
                        <div key={opt} style={optionStyle}>
                          {opt} {isCorrectAnswer && ' (Correct)'} {isUserAnswer && !isCorrectAnswer && ' (Your Choice)'}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}>
                  <div>
                    <strong>Your Answer:</strong> <span style={{ color: r.correct ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{r.user_answer || 'None'}</span>
                  </div>
                  <div>
                    <strong>Correct Answer:</strong> <span style={{ color: 'var(--success)', fontWeight: 600 }}>{r.correct_answer}</span>
                  </div>
                  {r.explanation && (
                    <div style={{ marginTop: '0.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.25rem', color: 'var(--text-secondary)' }}>
                      <strong>Explanation:</strong> {r.explanation}
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>

      </div>
    );
  };

  // Determine which cards to show on Summary tab
  const getSummaryCardsCount = () => {
    return [
      !!paper.numerical_ability,
      !!paper.reasoning_ability,
      paper.verbal_ability?.sentence_completion?.length > 0,
      paper.verbal_ability?.passage_recall?.length > 0,
      !!paper.verbal_ability?.email_writing,
      !!paper.advanced_quant_reasoning
    ].filter(Boolean).length;
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Exam Evaluation Report</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Paper ID: {paper.paper_id} ({type === 'full' ? 'Full Mock Test' : type === 'numerical_ability' ? 'Numerical Ability Practice' : type === 'reasoning_ability' ? 'Reasoning Ability Practice' : type === 'advanced_quant_reasoning' ? 'Advanced Quant/Reasoning Practice' : type === 'sentence_completion' ? 'Sentence Completion Practice' : type === 'passage_recall' ? 'Passage Recall Practice' : 'Email Writing Practice'})
          </span>
        </div>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs-nav" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
        <button className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>
          Performance Summary
        </button>
        {paper.numerical_ability && (
          <button className={`tab-btn ${activeTab === 'numerical_ability' ? 'active' : ''}`} onClick={() => setActiveTab('numerical_ability')}>
            Numerical Ability ({numScore}/20)
          </button>
        )}
        {paper.reasoning_ability && (
          <button className={`tab-btn ${activeTab === 'reasoning_ability' ? 'active' : ''}`} onClick={() => setActiveTab('reasoning_ability')}>
            Reasoning Ability ({reasScore}/20)
          </button>
        )}
        {paper.verbal_ability?.sentence_completion && paper.verbal_ability.sentence_completion.length > 0 && (
          <button className={`tab-btn ${activeTab === 'sentence_completion' ? 'active' : ''}`} onClick={() => setActiveTab('sentence_completion')}>
            Sentence Completion ({scScore}/20)
          </button>
        )}
        {paper.verbal_ability?.passage_recall && paper.verbal_ability.passage_recall.length > 0 && (
          <button className={`tab-btn ${activeTab === 'passage_recall' ? 'active' : ''}`} onClick={() => setActiveTab('passage_recall')}>
            Passage Recall ({prScore}/40)
          </button>
        )}
        {paper.verbal_ability?.email_writing && (
          <button className={`tab-btn ${activeTab === 'email_writing' ? 'active' : ''}`} onClick={() => setActiveTab('email_writing')}>
            Email Writing ({emailScore}/100)
          </button>
        )}
        {paper.advanced_quant_reasoning && (
          <button className={`tab-btn ${activeTab === 'advanced_quant_reasoning' ? 'active' : ''}`} onClick={() => setActiveTab('advanced_quant_reasoning')}>
            Advanced Section ({advScore}/14)
          </button>
        )}
      </div>

      {/* Tab Content: Summary */}
      {activeTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Overall score card */}
          <div className="card" style={{
            background: `linear-gradient(135deg, ${getScoreBg(overallPct)}, var(--bg-secondary))`,
            borderColor: getScoreColor(overallPct),
            display: 'flex',
            alignItems: 'center',
            gap: '2rem',
            padding: '2.5rem 2rem',
            flexWrap: 'wrap'
          }}>
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-secondary)',
              border: `6px solid ${getScoreColor(overallPct)}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: 'var(--card-shadow)'
            }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: getScoreColor(overallPct), lineHeight: 1 }}>
                {overallPct}%
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.25rem' }}>
                Overall
              </span>
            </div>

            <div style={{ flex: '1 1 300px' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', fontWeight: 700 }}>
                <Award style={{ color: getScoreColor(overallPct) }} />
                Readiness Assessment
              </h3>
              <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: '1.6', fontStyle: 'italic' }}>
                "{report.summary?.overall_note || report.verbal_ability_results?.summary?.overall_note || 'Grading complete. Review individual sections for detailed feedback.'}"
              </p>
            </div>
          </div>

          {/* Section Breakdown Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${getSummaryCardsCount() > 0 ? getSummaryCardsCount() : 1}, minmax(0, 1fr))`,
            gap: '1rem'
          }} className="grid-cols-3">
            
            {paper.numerical_ability && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Numerical Ability</h4>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{numScore} <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ 20</span></div>
                <div className="progress-bar-bg" style={{ margin: '0.25rem 0' }}>
                  <div className="progress-bar-fill" style={{ width: `${numPct}%`, backgroundColor: getScoreColor(numPct) }}></div>
                </div>
                <span style={{ fontSize: '0.75rem', color: getScoreColor(numPct), fontWeight: 600 }}>
                  {numPct >= 80 ? 'Exceptional Quantitative Skills' : numPct >= 55 ? 'Satisfactory Ability' : 'Needs Practice'}
                </span>
              </div>
            )}

            {paper.reasoning_ability && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Reasoning Ability</h4>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{reasScore} <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ 20</span></div>
                <div className="progress-bar-bg" style={{ margin: '0.25rem 0' }}>
                  <div className="progress-bar-fill" style={{ width: `${reasPct}%`, backgroundColor: getScoreColor(reasPct) }}></div>
                </div>
                <span style={{ fontSize: '0.75rem', color: getScoreColor(reasPct), fontWeight: 600 }}>
                  {reasPct >= 80 ? 'Sharp Analytical Reasoning' : reasPct >= 55 ? 'Good Logical Thinking' : 'Needs Logical Focus'}
                </span>
              </div>
            )}

            {paper.verbal_ability?.sentence_completion && paper.verbal_ability.sentence_completion.length > 0 && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sentence Completion</h4>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{scScore} <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ 20</span></div>
                <div className="progress-bar-bg" style={{ margin: '0.25rem 0' }}>
                  <div className="progress-bar-fill" style={{ width: `${scPct}%`, backgroundColor: getScoreColor(scPct) }}></div>
                </div>
                <span style={{ fontSize: '0.75rem', color: getScoreColor(scPct), fontWeight: 600 }}>
                  {scPct >= 80 ? 'Excellent Grammar/Vocab' : scPct >= 55 ? 'Moderate Proficiency' : 'Requires Grammar Focus'}
                </span>
              </div>
            )}

            {paper.verbal_ability?.passage_recall && paper.verbal_ability.passage_recall.length > 0 && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Passage Recall</h4>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{prScore} <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ 40</span></div>
                <div className="progress-bar-bg" style={{ margin: '0.25rem 0' }}>
                  <div className="progress-bar-fill" style={{ width: `${prPct}%`, backgroundColor: getScoreColor(prPct) }}></div>
                </div>
                <span style={{ fontSize: '0.75rem', color: getScoreColor(prPct), fontWeight: 600 }}>
                  {prPct >= 80 ? 'High-fidelity Recall' : prPct >= 55 ? 'Satisfactory Recall' : 'Weak Memory Retention'}
                </span>
              </div>
            )}

            {paper.verbal_ability?.email_writing && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Email Writing</h4>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{emailScore} <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ 100</span></div>
                <div className="progress-bar-bg" style={{ margin: '0.25rem 0' }}>
                  <div className="progress-bar-fill" style={{ width: `${emailPct}%`, backgroundColor: getScoreColor(emailPct) }}></div>
                </div>
                <span style={{ fontSize: '0.75rem', color: getScoreColor(emailPct), fontWeight: 600 }}>
                  {emailPct >= 80 ? 'Corporate Ready Structure' : emailPct >= 55 ? 'Needs Formatting/Tone Polish' : 'Weak Email Mechanics'}
                </span>
              </div>
            )}

            {paper.advanced_quant_reasoning && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Advanced Section</h4>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{advScore} <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ 14</span></div>
                <div className="progress-bar-bg" style={{ margin: '0.25rem 0' }}>
                  <div className="progress-bar-fill" style={{ width: `${advPct}%`, backgroundColor: getScoreColor(advPct) }}></div>
                </div>
                <span style={{ fontSize: '0.75rem', color: getScoreColor(advPct), fontWeight: 600 }}>
                  {advPct >= 80 ? 'Outstanding Advanced Skills' : advPct >= 55 ? 'Competent Performance' : 'Needs Mixed Quant Practice'}
                </span>
              </div>
            )}

          </div>

        </div>
      )}

      {/* Tab Content: Numerical Ability */}
      {activeTab === 'numerical_ability' && renderObjectiveSectionReview('numerical_ability', numResults)}

      {/* Tab Content: Reasoning Ability */}
      {activeTab === 'reasoning_ability' && renderObjectiveSectionReview('reasoning_ability', reasResults)}

      {/* Tab Content: Sentence Completion */}
      {activeTab === 'sentence_completion' && sentence_completion_results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {paper.verbal_ability.sentence_completion.map((q, idx) => {
            const result = sentence_completion_results.find(r => r.id === q.id) || { score: 0, verdict: 'incorrect', reason: 'Unattempted' };
            const isCorrect = result.score === 1;
            const userAnswer = answers.verbal_ability?.sentence_completion?.[q.id] || '—';

            return (
              <div key={q.id} className="card" style={{
                borderLeft: `4px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}`,
                padding: '1.25rem 1.5rem',
                backgroundColor: 'var(--bg-secondary)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Question {idx + 1}
                    <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                      {q.topic_tag}
                    </span>
                  </span>
                  
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600, color: isCorrect ? 'var(--success)' : 'var(--danger)' }}>
                    {isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    {isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </div>

                <p style={{ fontSize: '1.05rem', fontWeight: 500, marginBottom: '1rem' }}>
                  {q.sentence}
                </p>

                <div className="grid-cols-2" style={{ gap: '1rem', backgroundColor: 'var(--bg-primary)', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.9rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                      Your Answer
                    </span>
                    <span style={{ fontWeight: 600, color: isCorrect ? 'var(--success)' : 'var(--danger)' }}>{userAnswer}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                      Acceptable Answers
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {q.acceptable_answers.join(' / ')}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Feedback: </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{result.reason}</span>
                  {q.explanation && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      <strong>Rule:</strong> {q.explanation}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab Content: Passage Recall */}
      {activeTab === 'passage_recall' && passage_recall_results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {paper.verbal_ability.passage_recall.map((q, idx) => {
            const result = passage_recall_results.find(r => r.id === q.id) || { score: 0, feedback: 'Unattempted' };
            const userAnswer = answers.verbal_ability?.passage_recall?.[q.id] || '—';
            const pct = (result.score / 10) * 100;

            return (
              <div key={q.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Passage {idx + 1}</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Score:</span>
                    <span className="badge" style={{ backgroundColor: getScoreBg(pct), color: getScoreColor(pct), fontWeight: 700, fontSize: '0.85rem' }}>
                      {result.score} / 10
                    </span>
                  </div>
                </div>

                <div className="grid-cols-2" style={{ gap: '1.5rem' }}>
                  <div className="card" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '1rem' }}>
                    <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <BookOpen size={14} /> Original Paragraph
                    </h5>
                    <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                      {q.paragraph}
                    </p>

                    <div style={{ marginTop: '1rem' }}>
                      <h6 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>
                        Key Points Required
                      </h6>
                      <ul style={{ paddingLeft: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {q.key_points.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="card" style={{ border: '1px solid var(--border-color)', padding: '1rem' }}>
                    <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.5rem' }}>
                      Your Recall Summary
                    </h5>
                    <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: '1.6', fontStyle: userAnswer === '—' ? 'italic' : 'normal' }}>
                      {userAnswer}
                    </p>
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                  <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Evaluator Feedback:
                  </h5>
                  <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                    {result.feedback}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab Content: Email Writing */}
      {activeTab === 'email_writing' && email_result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Corporate Email Evaluation</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Score:</span>
              <span className="badge" style={{ backgroundColor: getScoreBg(emailScore), color: getScoreColor(emailScore), fontWeight: 700, fontSize: '0.95rem' }}>
                {emailScore} / 100
              </span>
            </div>
          </div>

          <div className="grid-cols-2" style={{ gap: '1.5rem' }}>
            <div className="card" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Scenario & Directives
                </h5>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: '1.6' }}>
                  {paper.verbal_ability.email_writing.scenario}
                </p>
              </div>

              <div>
                <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>
                  Required Elements & Structure
                </h5>
                <ul style={{ paddingLeft: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {paper.verbal_ability.email_writing.required_elements.map((el, i) => (
                    <li key={i}>{el}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="card" style={{ border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h5 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 0 }}>
                Submitted Draft
              </h5>
              <pre style={{
                fontFamily: 'Courier New, Courier, monospace',
                fontSize: '0.9rem',
                backgroundColor: 'var(--bg-secondary)',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color)',
                whiteSpace: 'pre-wrap',
                margin: 0,
                color: 'var(--text-primary)',
                lineHeight: '1.5'
              }}>
                {answers.verbal_ability?.email_writing || '—'}
              </pre>
            </div>
          </div>

          {/* Evaluator Rubrics Breakdown */}
          <div className="card">
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Rubrics Breakdown</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }} className="grid-cols-2">
              
              <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                <h5 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                  Mechanics & Grammar ({email_result.grammar_mechanics_score}/30)
                </h5>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {email_result.grammar_mechanics_feedback}
                </p>
              </div>

              <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                <h5 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                  Structure & Flow ({email_result.structure_flow_score}/30)
                </h5>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {email_result.structure_flow_feedback}
                </p>
              </div>

              <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                <h5 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                  Target Audience & Tone ({email_result.target_audience_score}/20)
                </h5>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {email_result.target_audience_feedback}
                </p>
              </div>

              <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                <h5 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                  Required Information ({email_result.required_info_score}/20)
                </h5>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {email_result.required_info_feedback}
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Advanced Section */}
      {activeTab === 'advanced_quant_reasoning' && renderObjectiveSectionReview('advanced_quant_reasoning', advResults)}

    </div>
  );
}
