/**
 * TCS NQT Foundation - Numerical Ability, Reasoning Ability, and
 * Advanced Quant & Reasoning paper generation + local objective grading.
 *
 * Design note: unlike verbal (subjective, needs LLM grading), every question
 * type here has a single correct answer. Grading is done locally in JS —
 * no API call, no hallucination risk, instant results.
 */

import { callGroqWithJsonRetry } from './groq';

export const APTITUDE_TIMING = {
  numerical_ability: { total_questions: 20, total_seconds: 25 * 60 },
  reasoning_ability: { total_questions: 20, total_seconds: 25 * 60 },
  advanced_quant_reasoning: { total_questions: 14, total_seconds: 25 * 60 }
};

/**
 * Topic configs. tier meanings:
 *  - anchor: fixed count every paper (min === max), never trimmed
 *  - priority: has weight, filled by min first (highest weight first), can be bumped toward max with leftover budget
 *  - flex: same as priority but weight 0 (filled/trimmed after all priority topics)
 *  - optional: user-specified count was blank in the original spec; defaults to 1, first to be dropped under budget pressure
 */
export const TOPIC_CONFIG_NUMERICAL = [
  { key: 'number_system', label: 'Number System (Divisibility, LCM/HCF, Simplification)', min: 2, max: 2, tier: 'anchor' },
  { key: 'ratio_proportion_variation', label: 'Ratio, Proportion & Variation', min: 2, max: 3, tier: 'priority', weight: 1 },
  { key: 'averages', label: 'Averages', min: 2, max: 2, tier: 'anchor' },
  { key: 'ages', label: 'Ages', min: 1, max: 1, tier: 'anchor' },
  { key: 'percentage_pl_interest_installments', label: 'Percentage, Profit & Loss, Simple/Compound Interest, Installments', min: 7, max: 9, tier: 'priority', weight: 3 },
  { key: 'time_work', label: 'Time and Work', min: 1, max: 3, tier: 'flex', weight: 0 },
  { key: 'time_distance_boats_streams', label: 'Time, Distance, Boats & Streams', min: 1, max: 3, tier: 'priority', weight: 1 },
  { key: 'data_interpretation', label: 'Data Interpretation', min: 3, max: 3, tier: 'anchor', grouped: true },
  { key: 'permutation_combination_probability', label: 'Permutations, Combinations & Probability', min: 2, max: 4, tier: 'priority', weight: 1 },
  { key: 'quadratic_equations', label: 'Quadratic Equations', min: 1, max: 1, tier: 'optional' },
  { key: 'inequalities', label: 'Inequalities', min: 1, max: 1, tier: 'optional' },
  { key: 'logarithm', label: 'Logarithm', min: 1, max: 1, tier: 'anchor' },
  { key: 'mensuration', label: 'Mensuration', min: 2, max: 2, tier: 'anchor' },
  { key: 'statistics', label: 'Statistics', min: 1, max: 1, tier: 'optional' }
];

// Reasoning minimums sum to exactly 20 — no allocator needed, just use the floor every time.
export const TOPIC_CONFIG_REASONING = [
  { key: 'coding_decoding', label: 'Coding & Decoding', min: 2, max: 2, tier: 'anchor' },
  { key: 'ranking', label: 'Ranking', min: 1, max: 1, tier: 'anchor' },
  { key: 'blood_relations', label: 'Blood Relations', min: 2, max: 3, tier: 'priority', weight: 1 },
  { key: 'directions', label: 'Directions', min: 0, max: 1, tier: 'optional' },
  { key: 'clocks_calendars', label: 'Clocks and Calendars', min: 0, max: 1, tier: 'optional' },
  { key: 'seating_arrangement', label: 'Seating Arrangement (Puzzle)', min: 2, max: 3, tier: 'priority', weight: 1, grouped: true },
  { key: 'dice', label: 'Dice', min: 3, max: 3, tier: 'anchor', grouped: true },
  { key: 'syllogism_logical_deduction', label: 'Syllogisms & Logical Deduction', min: 3, max: 4, tier: 'priority', weight: 1 },
  { key: 'decision_making', label: 'Decision Making', min: 4, max: 5, tier: 'priority', weight: 1 },
  { key: 'data_sufficiency', label: 'Data Sufficiency', min: 1, max: 2, tier: 'priority', weight: 1 },
  { key: 'nonverbal_figure_analogy_series', label: 'Non-verbal Reasoning: Figure Analogy & Series (Letter/Number)', min: 2, max: 3, tier: 'priority', weight: 1 }
];

/**
 * Generic budget allocator: fills anchors at fixed count, then fills priority/flex/optional
 * topics by min (highest weight first, least-recently-used first within a weight tier),
 * then distributes any leftover by bumping already-included topics toward their max.
 */
export function allocateQuestions(topicConfig, target, history = {}) {
  const allocation = {};
  let remaining = target;

  const anchors = topicConfig.filter(t => t.tier === 'anchor');
  anchors.forEach(t => {
    allocation[t.key] = t.min;
    remaining -= t.min;
  });

  const rest = topicConfig.filter(t => t.tier !== 'anchor');
  const tierRank = { priority: 0, flex: 1, optional: 2 };
  const sorted = [...rest].sort((a, b) => {
    const tierDiff = (tierRank[a.tier] ?? 3) - (tierRank[b.tier] ?? 3);
    if (tierDiff !== 0) return tierDiff;
    const weightDiff = (b.weight || 0) - (a.weight || 0);
    if (weightDiff !== 0) return weightDiff;
    return (history[a.key] || 0) - (history[b.key] || 0); // least-recently-used first
  });

  sorted.forEach(t => {
    if (remaining >= t.min && t.min > 0) {
      allocation[t.key] = t.min;
      remaining -= t.min;
    } else {
      allocation[t.key] = 0;
    }
  });

  // Distribute leftover by bumping included topics toward max, same priority order, round-robin.
  let progress = true;
  while (remaining > 0 && progress) {
    progress = false;
    for (const t of sorted) {
      if (remaining <= 0) break;
      const current = allocation[t.key] || 0;
      if (current > 0 && current < t.max) {
        allocation[t.key] = current + 1;
        remaining -= 1;
        progress = true;
      }
    }
  }

  // Last-resort fallback (shouldn't trigger given the configured ranges): bump an anchor.
  if (remaining > 0 && anchors.length > 0) {
    allocation[anchors[0].key] += remaining;
    remaining = 0;
  }

  return allocation;
}

/** Builds a { topicKey: appearanceCount } map from an array of past allocation objects. */
export function buildTopicHistory(pastAllocations = []) {
  const history = {};
  pastAllocations.forEach(alloc => {
    if (alloc) {
      Object.entries(alloc).forEach(([key, count]) => {
        if (count > 0) history[key] = (history[key] || 0) + 1;
      });
    }
  });
  return history;
}

const QUESTION_SCHEMA_BLOCK = `Each individual question object must follow exactly:
{
  "id": number (unique within the paper),
  "topic_key": "string, must exactly match one of the provided topic keys",
  "difficulty": "easy | moderate | hard",
  "question_type": "mcq" | "numeric_entry",
  "question_text": "string, the full question",
  "options": ["A", "B", "C", "D"],  // required and exactly 4 items if question_type is "mcq", otherwise null
  "correct_answer": "string — must exactly match one of the 4 options verbatim if mcq, or the exact numeric value (as a string, e.g. \\"42\\" or \\"12.5\\") if numeric_entry",
  "explanation": "string, 1-2 sentences",
  "time_seconds": number
}`;

/**
 * Builds the shared instructions for grouped-context topics (DI, seating puzzles, dice)
 * where multiple questions share one passage/table/scenario.
 */
function groupedSetInstructions(groupedTopicKeys) {
  if (groupedTopicKeys.length === 0) return '';
  return `\n\nGROUPED TOPICS: ${groupedTopicKeys.join(', ')} each require ONE shared context (a table/chart described in text for data_interpretation, a seating/arrangement scenario for seating_arrangement, or a described 3D dice net/rotation for dice) followed by multiple questions that all reference that same context. For these topics, put their questions in "grouped_sets" instead of "standalone_questions", using this shape:
{
  "topic_key": "string",
  "context": "string — the shared passage/table/scenario, self-contained and fully specified in text",
  "questions": [ /* question objects as above, minus topic_key repetition is fine to keep, minus no context field */ ]
}`;
}

/**
 * Generates a Numerical Ability paper.
 */
export async function generateNumericalPaper(apiKey, model, history = {}, recentExclusions = []) {
  const allocation = allocateQuestions(TOPIC_CONFIG_NUMERICAL, APTITUDE_TIMING.numerical_ability.total_questions, history);
  const groupedKeys = TOPIC_CONFIG_NUMERICAL.filter(t => t.grouped && allocation[t.key] > 0).map(t => t.key);

  const allocationLines = TOPIC_CONFIG_NUMERICAL
    .filter(t => allocation[t.key] > 0)
    .map(t => `- ${t.key} (${t.label}): exactly ${allocation[t.key]} question(s), difficulty ${t.tier === 'priority' && t.weight >= 3 ? 'skewed hard' : 'moderate'}`)
    .join('\n');

  const standaloneQuestionsCount = TOPIC_CONFIG_NUMERICAL
    .filter(t => !t.grouped && allocation[t.key] > 0)
    .reduce((sum, t) => sum + allocation[t.key], 0);

  const groupedSetsInstructions = TOPIC_CONFIG_NUMERICAL
    .filter(t => t.grouped && allocation[t.key] > 0)
    .map(t => `- For "${t.key}": exactly 1 set containing exactly ${allocation[t.key]} questions`)
    .join('\n');

  const systemPrompt = `You are a question-paper setter for the TCS NQT Foundation Numerical Ability section (2026 pattern, overall difficulty: hard). Generate ONE complete, fresh paper totaling exactly ${APTITUDE_TIMING.numerical_ability.total_questions} questions across the specified topics below. Never reuse numbers, scenarios, or phrasing from any paper you've generated earlier in this conversation.

TOPIC ALLOCATION FOR THIS PAPER (fixed — do not add, drop, or resize topics):
${allocationLines}

${QUESTION_SCHEMA_BLOCK}
${groupedSetInstructions(groupedKeys)}

ARRAY SIZE CONSTRAINTS (CRITICAL):
- The "standalone_questions" array MUST contain exactly ${standaloneQuestionsCount} question objects.
- The "grouped_sets" array MUST contain exactly ${groupedKeys.length} group objects, structured as:
${groupedSetsInstructions || 'None'}
- Total questions across all sections MUST sum to exactly ${APTITUDE_TIMING.numerical_ability.total_questions}.

OUTPUT FORMAT: Return ONLY valid JSON, no markdown fences, no commentary:
{
  "paper_id": "string, uuid",
  "section": "numerical_ability",
  "standalone_questions": [ /* all non-grouped-topic questions */ ],
  "grouped_sets": [ /* only present if grouped topics were allocated above */ ]
}

CONTENT RULES:
- The percentage/profit-loss/interest/installments bucket should genuinely be the hardest, most calculation-heavy cluster in the paper — multi-step problems (e.g. successive percentage changes, CI with installments, PL with discount chains), matching its "hard, time-taking" designation.
- number_system should include at least one LCM/HCF and one divisibility-rule question if 2 are allocated.
- data_interpretation must present a single coherent table or bar/line-style dataset described precisely enough in text that all 3 questions are answerable from it alone.
- All numeric_entry answers must be a single unambiguous number (no ranges, no "approximately").
- All mcq distractors must be plausible (common calculation errors), not random noise.`;

  const userPrompt = `Generate a fresh numerical ability paper following the exact allocation given. ${
    recentExclusions.length > 0 ? `Avoid these recently-used scenarios/numbers: ${recentExclusions.join(', ')}.` : ''
  }`;

  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const paper = await callGroqWithJsonRetry(apiKey, model, systemPrompt, userPrompt, 0.8, 2);
      validateAptitudePaper(paper, allocation, APTITUDE_TIMING.numerical_ability.total_questions);
      paper.topic_allocation = allocation;
      return paper;
    } catch (err) {
      console.warn(`Numerical paper generation attempt ${attempt} failed:`, err);
      lastErr = err;
    }
  }
  throw new Error(`Numerical paper generation failed after 4 attempts. Reason: ${lastErr.message}`);
}

/**
 * Generates a Reasoning Ability paper.
 */
export async function generateReasoningPaper(apiKey, model, recentExclusions = []) {
  const allocation = {};
  TOPIC_CONFIG_REASONING.forEach(t => { allocation[t.key] = t.min; });
  const groupedKeys = TOPIC_CONFIG_REASONING.filter(t => t.grouped && allocation[t.key] > 0).map(t => t.key);

  const allocationLines = TOPIC_CONFIG_REASONING
    .filter(t => allocation[t.key] > 0)
    .map(t => `- ${t.key} (${t.label}): exactly ${allocation[t.key]} question(s)`)
    .join('\n');

  const standaloneQuestionsCount = TOPIC_CONFIG_REASONING
    .filter(t => !t.grouped && allocation[t.key] > 0)
    .reduce((sum, t) => sum + allocation[t.key], 0);

  const groupedSetsInstructions = TOPIC_CONFIG_REASONING
    .filter(t => t.grouped && allocation[t.key] > 0)
    .map(t => `- For "${t.key}": exactly 1 set containing exactly ${allocation[t.key]} questions`)
    .join('\n');

  const systemPrompt = `You are a question-paper setter for the TCS NQT Foundation Reasoning Ability section (2026 pattern, overall difficulty: easy). Generate ONE complete, fresh paper totaling exactly ${APTITUDE_TIMING.reasoning_ability.total_questions} questions across the specified topics below. Never reuse scenarios, names, or arrangements from any paper you've generated earlier in this conversation.

TOPIC ALLOCATION FOR THIS PAPER (fixed):
${allocationLines}

${QUESTION_SCHEMA_BLOCK}
${groupedSetInstructions(groupedKeys)}

ARRAY SIZE CONSTRAINTS (CRITICAL):
- The "standalone_questions" array MUST contain exactly ${standaloneQuestionsCount} question objects.
- The "grouped_sets" array MUST contain exactly ${groupedKeys.length} group objects, structured as:
${groupedSetsInstructions || 'None'}
- Total questions across all sections MUST sum to exactly ${APTITUDE_TIMING.reasoning_ability.total_questions}.

OUTPUT FORMAT: Return ONLY valid JSON, no markdown fences, no commentary:
{
  "paper_id": "string, uuid",
  "section": "reasoning_ability",
  "standalone_questions": [ /* all non-grouped-topic questions */ ],
  "grouped_sets": [ /* dice and seating_arrangement question groups */ ]
}

CONTENT RULES:
- Keep this section genuinely easy — straightforward single-step logic, not multi-constraint puzzles, consistent with its difficulty designation.
- seating_arrangement: one small, fully-determined scenario (linear or circular, 4-6 people) that yields all its allocated questions unambiguously from the one context.
- dice: describe a single die (or net) precisely enough (which faces are adjacent/opposite) that all 3 questions are solvable from that one description.
- blood_relations: use clear relationship chains, not more than 3 hops, and avoid ambiguous gender-neutral names without contextual pronouns.
- data_sufficiency questions must follow the standard format: a question plus two statements, with options being the standard "statement I alone / statement II alone / both together / either alone / neither" set.`;

  const userPrompt = `Generate a fresh reasoning ability paper following the exact allocation given. ${
    recentExclusions.length > 0 ? `Avoid these recently-used scenarios/names/arrangements: ${recentExclusions.join(', ')}.` : ''
  }`;

  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const paper = await callGroqWithJsonRetry(apiKey, model, systemPrompt, userPrompt, 0.8, 2);
      validateAptitudePaper(paper, allocation, APTITUDE_TIMING.reasoning_ability.total_questions);
      paper.topic_allocation = allocation;
      return paper;
    } catch (err) {
      console.warn(`Reasoning paper generation attempt ${attempt} failed:`, err);
      lastErr = err;
    }
  }
  throw new Error(`Reasoning paper generation failed after 4 attempts. Reason: ${lastErr.message}`);
}

/**
 * Generates the Advanced Quant & Reasoning paper.
 */
export async function generateAdvancedPaper(apiKey, model, history = {}, recentExclusions = []) {
  const target = APTITUDE_TIMING.advanced_quant_reasoning.total_questions;
  const half = Math.floor(target / 2); // 7 numerical, 7 reasoning

  // Eligible pool excludes data_interpretation, dice, and seating_arrangement due to set nature
  const numericalPool = TOPIC_CONFIG_NUMERICAL.filter(t => t.key !== 'data_interpretation');
  const reasoningPool = TOPIC_CONFIG_REASONING.filter(t => t.key !== 'dice' && t.key !== 'seating_arrangement');

  const pickTopics = (pool, count) => {
    const sorted = [...pool].sort((a, b) => (history[a.key] || 0) - (history[b.key] || 0));
    return sorted.slice(0, count).map(t => t.key);
  };

  const numericalTopics = pickTopics(numericalPool, half);
  const reasoningTopics = pickTopics(reasoningPool, target - half);

  const systemPrompt = `You are a question-paper setter for the TCS NQT Foundation "Advanced Quant & Reasoning" section (2026 pattern, overall difficulty: easy-medium despite the "advanced" label — these are harder-style variants of standard topics, not olympiad-level). Generate ONE complete, fresh paper totaling exactly ${target} questions: 1 question each from the following ${numericalTopics.length} numerical topics and ${reasoningTopics.length} reasoning topics (each topic appears exactly once):

Numerical topics: ${numericalTopics.join(', ')}
Reasoning topics: ${reasoningTopics.join(', ')}

${QUESTION_SCHEMA_BLOCK}

ARRAY SIZE CONSTRAINTS (CRITICAL):
- The "standalone_questions" array MUST contain exactly ${target} question objects (one for each of the 14 listed topics).
- The "grouped_sets" array MUST be empty [].

Each question should be a step up in complexity from a basic version of its topic (e.g. a two-step percentage-and-ratio combo instead of a single percentage calc; a 3-statement syllogism instead of 2) while staying within easy-medium difficulty — no question should require more than 2 combined concepts.

OUTPUT FORMAT: Return ONLY valid JSON, no markdown fences, no commentary:
{
  "paper_id": "string, uuid",
  "section": "advanced_quant_reasoning",
  "standalone_questions": [ /* exactly ${target} questions, one per listed topic */ ],
  "grouped_sets": []
}`;

  const userPrompt = `Generate a fresh advanced quant & reasoning paper covering exactly the listed topics, one question each. ${
    recentExclusions.length > 0 ? `Avoid these recently-used scenarios/numbers: ${recentExclusions.join(', ')}.` : ''
  }`;

  const allocation = {};
  [...numericalTopics, ...reasoningTopics].forEach(key => { allocation[key] = 1; });

  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const paper = await callGroqWithJsonRetry(apiKey, model, systemPrompt, userPrompt, 0.85, 2);
      validateAptitudePaper(paper, allocation, target);
      paper.topic_allocation = allocation;
      return paper;
    } catch (err) {
      console.warn(`Advanced paper generation attempt ${attempt} failed:`, err);
      lastErr = err;
    }
  }
  throw new Error(`Advanced paper generation failed after 4 attempts. Reason: ${lastErr.message}`);
}

/** Shared structural validation for all three objective paper types. */
function validateAptitudePaper(paper, expectedAllocation, expectedTotal) {
  if (!paper.paper_id || !Array.isArray(paper.standalone_questions)) {
    throw new Error('Generated paper is missing paper_id or standalone_questions array.');
  }
  const grouped = Array.isArray(paper.grouped_sets) ? paper.grouped_sets : (paper.grouped_sets = []);

  const groupedCount = grouped.reduce((sum, g) => sum + (Array.isArray(g.questions) ? g.questions.length : 0), 0);
  const total = paper.standalone_questions.length + groupedCount;
  if (total !== expectedTotal) {
    throw new Error(`Paper contains ${total} questions, expected exactly ${expectedTotal}.`);
  }

  const allQuestions = [
    ...paper.standalone_questions,
    ...grouped.flatMap(g => g.questions.map(q => ({ ...q, topic_key: q.topic_key || g.topic_key })))
  ];

  allQuestions.forEach((q, i) => {
    if (!q.question_text || !q.correct_answer || !q.question_type) {
      throw new Error(`Question at index ${i} is missing question_text, correct_answer, or question_type.`);
    }
    if (q.question_type === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`MCQ question "${q.id}" does not have exactly 4 options.`);
      }
      if (!q.options.includes(q.correct_answer)) {
        throw new Error(`MCQ question "${q.id}" correct_answer does not match any of its options.`);
      }
    }
  });

  const seenTopics = {};
  allQuestions.forEach(q => { seenTopics[q.topic_key] = (seenTopics[q.topic_key] || 0) + 1; });
  Object.entries(expectedAllocation).forEach(([key, count]) => {
    if (count > 0 && (seenTopics[key] || 0) !== count) {
      throw new Error(`Topic "${key}" expected ${count} question(s), got ${seenTopics[key] || 0}.`);
    }
  });
}

function numericMatches(userAnswer, correctAnswer, tolerancePercent = 0.5) {
  const u = parseFloat(userAnswer);
  const c = parseFloat(correctAnswer);
  if (Number.isNaN(u) || Number.isNaN(c)) return String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
  if (c === 0) return u === 0;
  return Math.abs((u - c) / c) * 100 <= tolerancePercent;
}

/**
 * Grades any objective aptitude paper (numerical / reasoning / advanced) locally — no API call.
 */
export function evaluateObjectivePaper(paper, candidateAnswers) {
  const grouped = Array.isArray(paper.grouped_sets) ? paper.grouped_sets : [];
  const allQuestions = [
    ...paper.standalone_questions,
    ...grouped.flatMap(g => g.questions.map(q => ({ ...q, topic_key: q.topic_key || g.topic_key })))
  ];

  const results = allQuestions.map(q => {
    const userAnswer = candidateAnswers[q.id];
    const attempted = userAnswer !== undefined && userAnswer !== null && String(userAnswer).trim() !== '';
    let correct = false;
    if (attempted) {
      correct = q.question_type === 'numeric_entry'
        ? numericMatches(userAnswer, q.correct_answer)
        : String(userAnswer).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase();
    }
    return {
      id: q.id,
      topic_key: q.topic_key,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      attempted,
      correct,
      score: correct ? 1 : 0,
      user_answer: attempted ? userAnswer : null,
      correct_answer: q.correct_answer,
      explanation: q.explanation
    };
  });

  const byTopic = {};
  results.forEach(r => {
    if (!byTopic[r.topic_key]) byTopic[r.topic_key] = { correct: 0, total: 0 };
    byTopic[r.topic_key].total += 1;
    if (r.correct) byTopic[r.topic_key].correct += 1;
  });

  const totalCorrect = results.filter(r => r.correct).length;
  const totalAttempted = results.filter(r => r.attempted).length;

  return {
    paper_id: paper.paper_id,
    section: paper.section,
    results,
    by_topic: byTopic,
    summary: {
      total_questions: results.length,
      attempted: totalAttempted,
      correct: totalCorrect,
      score_fraction: `${totalCorrect}/${results.length}`,
      accuracy_percent: totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 1000) / 10 : 0
    }
  };
}
