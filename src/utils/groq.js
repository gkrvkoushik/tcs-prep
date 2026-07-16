/**
 * API Wrapper for Groq Chat Completions
 * TCS NQT Foundation - Verbal Ability Practice Module
 */

const GROQ_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Single source of truth for timing — keep UI timers synced to this, not hardcoded elsewhere
export const SECTION_TIMING = {
  sentence_completion: { per_question_seconds: 20, count: 20 },
  passage_recall: { display_seconds: 30, writing_seconds: 90, count: 4 },
  email_writing: { total_seconds: 9 * 60, min_words: 100 }
};

/**
 * Validates a Groq API Key and Model by making a simple request
 * @param {string} apiKey
 * @param {string} model
 * @returns {Promise<boolean>}
 */
export async function testConnection(apiKey, model) {
  if (!apiKey) return false;

  try {
    const res = await fetch(GROQ_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Say "connected" in one word' }],
        max_tokens: 10
      })
    });

    return res.status === 200;
  } catch (err) {
    console.error('Connection test failed:', err);
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper to call Groq API with retries for JSON parsing AND transient failures.
 * Distinguishes rate limits (backoff) from malformed JSON (reprompt) from other HTTP errors (retry as-is).
 */
export async function callGroqWithJsonRetry(apiKey, model, systemPrompt, userPrompt, temperature, maxRetries = 2) {
  let attempt = 0;
  let currentPrompt = userPrompt;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(GROQ_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: currentPrompt }
          ],
          temperature: temperature,
          response_format: { type: 'json_object' }
        })
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after')) || (2 ** attempt);
        attempt++;
        if (attempt > maxRetries) throw new Error('Rate limited after max retries.');
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const rawText = data.choices?.[0]?.message?.content;
      if (!rawText) {
        throw new Error('API returned empty content');
      }

      try {
        return JSON.parse(rawText);
      } catch (parseErr) {
        console.warn(`JSON parsing failed on attempt ${attempt + 1}:`, parseErr, 'Raw response:', rawText);
        attempt++;
        if (attempt > maxRetries) {
          throw new Error(`Failed to parse JSON response after ${maxRetries} retries: ${parseErr.message}`);
        }
        currentPrompt = `The previous response failed to parse as valid JSON. Error: ${parseErr.message}.\n\nPlease output ONLY valid, well-formed JSON matching the exact schema requested, with no markdown fences, no formatting code blocks, and no extra commentary.\n\nOriginal Request:\n${userPrompt}`;
      }
    } catch (err) {
      if (attempt >= maxRetries) {
        throw err;
      }
      console.warn(`Error on attempt ${attempt + 1}: ${err.message}. Retrying...`);
      attempt++;
      await sleep(500 * (attempt + 1));
    }
  }
}

function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Generates a fresh mock paper (Key A)
 * @param {string} apiKey
 * @param {string} model
 * @param {Array<string>} recentExclusions - Topic tags/email scenarios to avoid
 * @param {string} testType - 'full' | 'sentence_completion' | 'passage_recall' | 'email_writing'
 * @returns {Promise<Object>} The parsed exam paper
 */
export async function generatePaper(apiKey, model, recentExclusions = [], testType = 'full') {
  const paperUuid = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  let modeInstruction = "";
  if (testType === 'sentence_completion') {
    modeInstruction = `Generate ONLY the sentence_completion section (exactly 20 questions). For passage_recall, return an empty array []. For email_writing, return null.`;
  } else if (testType === 'passage_recall') {
    modeInstruction = `Generate ONLY the passage_recall section (exactly 4 paragraphs). For sentence_completion, return an empty array []. For email_writing, return null.`;
  } else if (testType === 'email_writing') {
    modeInstruction = `Generate ONLY the email_writing section (exactly 1 scenario). For sentence_completion, return an empty array []. For passage_recall, return an empty array [].`;
  } else {
    modeInstruction = `Generate a complete exam paper with exactly 20 sentence_completion questions, exactly 4 passage_recall items, and exactly 1 email_writing scenario.`;
  }

  const systemPrompt = `You are an expert question-paper setter for the TCS NQT Foundation Verbal Ability section (2026 pattern).
${modeInstruction}

Never reuse sentences, topics, or scenarios from any paper you have generated before in this conversation — treat every call as an independent, first-time paper.

OUTPUT FORMAT: Return ONLY valid JSON, no markdown fences, no commentary, matching this exact schema:

{
  "paper_id": "string, uuid",
  "sentence_completion": [
    {
      "id": 1,
      "sentence": "string with exactly one blank marked as ______",
      "difficulty": "basic | moderate | typical",
      "topic_tag": "e.g. workplace-vocab, idiom, analogy, collocation, tense-agreement",
      "acceptable_answers": ["primary answer", "close synonym 1", "close synonym 2"],
      "explanation": "one sentence on why this is correct, for later review",
      "time_seconds": 20
    }
    // ... exactly 20 items (if generating sentence completions), ids 1-20
  ],
  "passage_recall": [
    {
      "id": 21,
      "paragraph": "exactly 4 sentences, workplace/general-interest register, 40-70 words total",
      "key_points": ["point 1 that must survive a good rewrite", "point 2", "point 3", "point 4"],
      "display_seconds": 30,
      "writing_seconds": 90
    }
    // ... exactly 4 items (if generating passage recalls), ids 21-24
  ],
  "email_writing": {
    "id": 25,
    "scenario": "2-4 sentence workplace situation requiring a formal/professional email",
    "recipient_role": "e.g. manager, HR, client, vendor",
    "required_elements": ["element the email must contain, e.g. a specific date", "a request", "a reason", "a polite close"],
    "tone": "formal | semi-formal",
    "min_words": 100,
    "time_seconds": 540
  } // or null (if not generating email writing)
}

TCS NQT VERBAL LEVEL & CONTENT RULES:
- Sentence completion (if generated): exactly 8 basic, 8 moderate, 4 typical/harder difficulty — shuffle the order. The questions must match the corporate communication, business operations, and academic registers typical of TCS NQT.
  - Trivial grammar (e.g. simple past tense of "go", "is/are", or common nouns) is strictly prohibited.
  - Instead, focus on:
    1. Advanced Collocations: (e.g., "bear in mind", "take for granted", "mutual agreement", "vested interest", "disdain for").
    2. Professional Phrasal Verbs: (e.g., "phase out", "pencil in", "call off", "bring up", "wind down", "carry out").
    3. Workplace Prepositions/Conjunctions: (e.g., "in compliance with", "notwithstanding", "on short notice", "at the discretion of", "conducive to").
    4. Contextual Vocabulary: High-level words that fit corporate scenarios (e.g., "redundant", "streamlined", "mitigate", "discrepancy", "reconcile", "lucrative", "imperative").
  - Each sentence must contain exactly one "______" blank and must have a clear context indicating why the acceptable answers are correct. Acceptable answers must include the primary word and 2-3 close semantic synonyms.

- Passage recall paragraphs (if generated): Each paragraph must be a dense, well-structured 4-sentence passage of 40-70 words. Topics should focus on professional or modern domains (e.g., cloud computing implementation, remote work efficiency, data privacy regulations, agile development metrics, customer churn management). Avoid trivial stories. The 4 required key points must be distinct and capture the core logical details of the passage.

- Email scenario (if generated): Must simulate a realistic, professional workplace communication challenge. Examples: requesting a budget extension from a client, notifying a team lead about a server failure, declining a project offer from a vendor due to compliance, or rescheduling a product launch. Required elements must enforce formal/semi-formal email mechanics (like specific date references, call-to-actions, or formal greetings).

- Exclusions Rule: You MUST NOT generate any questions or content similar to the items provided in the user prompt's CRITICAL EXCLUSIONS list.

- Uniqueness token for this generation: ${paperUuid}`;

  const userPrompt = `Generate a fresh practice paper. Make sure to adhere to all content rules, especially for the requested mode: ${testType}.
${
  recentExclusions && recentExclusions.length > 0
    ? `CRITICAL EXCLUSIONS: You MUST NOT reuse or generate any of the following questions, sentences, paragraphs, or scenarios. They must be completely different in vocabulary, structure, and theme:
${recentExclusions.map((ex, idx) => `${idx + 1}. "${ex}"`).join('\n')}`
    : ''
}`;

  const paper = await callGroqWithJsonRetry(apiKey, model, systemPrompt, userPrompt, 0.9, 2);

  // Set testType on paper object for downstream consumption
  paper.testType = testType;

  // --- Schema validation ---
  if (!paper.paper_id) {
    throw new Error('Generated paper is missing paper_id.');
  }

  if (testType === 'full' || testType === 'sentence_completion') {
    if (!Array.isArray(paper.sentence_completion) || paper.sentence_completion.length !== 20) {
      throw new Error(`Sentence completion section contains ${paper.sentence_completion?.length || 0} questions, expected exactly 20.`);
    }
    paper.sentence_completion.forEach((q, i) => {
      if (!q.sentence || !q.sentence.includes('______')) {
        throw new Error(`Sentence completion item ${i + 1} (id ${q.id}) is missing a valid "______" blank.`);
      }
      if (!Array.isArray(q.acceptable_answers) || q.acceptable_answers.length === 0) {
        throw new Error(`Sentence completion item ${i + 1} (id ${q.id}) has no acceptable_answers.`);
      }
      q.time_seconds = SECTION_TIMING.sentence_completion.per_question_seconds;
    });
  } else {
    paper.sentence_completion = [];
  }

  if (testType === 'full' || testType === 'passage_recall') {
    if (!Array.isArray(paper.passage_recall) || paper.passage_recall.length !== 4) {
      throw new Error(`Passage recall section contains ${paper.passage_recall?.length || 0} paragraphs, expected exactly 4.`);
    }
    paper.passage_recall.forEach((p, i) => {
      if (!Array.isArray(p.key_points) || p.key_points.length !== 4) {
        throw new Error(`Passage recall item ${i + 1} (id ${p.id}) must have exactly 4 key_points.`);
      }
      p.display_seconds = SECTION_TIMING.passage_recall.display_seconds;
      p.writing_seconds = SECTION_TIMING.passage_recall.writing_seconds;
    });
  } else {
    paper.passage_recall = [];
  }

  if (testType === 'full' || testType === 'email_writing') {
    const email = paper.email_writing;
    if (!email || !email.scenario || !Array.isArray(email.required_elements) || email.required_elements.length === 0 || !email.tone) {
      throw new Error('Email writing section is missing required fields (scenario, required_elements, or tone).');
    }
    email.min_words = SECTION_TIMING.email_writing.min_words;
    email.time_seconds = SECTION_TIMING.email_writing.total_seconds;
  } else {
    paper.email_writing = null;
  }

  return paper;
}

/**
 * Grades the candidate's answers using Key B (Evaluator)
 * @param {string} apiKey
 * @param {string} model
 * @param {Object} originalPaper - The source paper generated by Key A
 * @param {Object} candidateAnswers - The candidate's typed responses
 * @returns {Promise<Object>} The graded report JSON
 */
export async function evaluatePaper(apiKey, model, originalPaper, candidateAnswers) {
  const testType = originalPaper.testType || 'full';

  const trimmedSentenceCompletion = (originalPaper.sentence_completion || []).map(q => ({
    id: q.id,
    sentence: q.sentence,
    acceptable_answers: q.acceptable_answers,
    user_answer: candidateAnswers.sentence_completion?.[q.id] || ""
  }));

  const trimmedPassageRecall = (originalPaper.passage_recall || []).map(q => ({
    id: q.id,
    paragraph: q.paragraph,
    key_points: q.key_points,
    user_answer: candidateAnswers.passage_recall?.[q.id] || ""
  }));

  const emailUserAnswer = candidateAnswers.email_writing || "";
  const emailWordCount = countWords(emailUserAnswer);

  const trimmedEmail = originalPaper.email_writing ? {
    id: originalPaper.email_writing.id,
    scenario: originalPaper.email_writing.scenario,
    recipient_role: originalPaper.email_writing.recipient_role,
    required_elements: originalPaper.email_writing.required_elements,
    tone: originalPaper.email_writing.tone,
    min_words: SECTION_TIMING.email_writing.min_words,
    user_answer: emailUserAnswer,
    user_word_count: emailWordCount,
    meets_word_minimum: emailWordCount >= SECTION_TIMING.email_writing.min_words
  } : null;

  const payload = {
    paper_id: originalPaper.paper_id,
    testType: testType,
    sentence_completion: trimmedSentenceCompletion,
    passage_recall: trimmedPassageRecall,
    email_writing: trimmedEmail
  };

  const systemPrompt = `You are a strict but fair evaluator for TCS NQT Foundation Verbal Ability practice answers. You grade three question types with different rubrics. Return ONLY valid JSON, no commentary outside the JSON.

INPUT you will receive per call: the original question(s) plus the candidate's typed response(s), including a pre-computed word count and word-minimum flag for the email. Grade exactly what's given — do not invent missing answers, treat missing/empty responses as unattempted (0).

IMPORTANT: This is a "${testType}" test. If a section was not tested (e.g. sentence_completion or passage_recall is empty, or email_writing is null), return an empty array for its results, and for email_result return null or a score of 0. Reflect this properly in the summaries.

--- RUBRIC A: Sentence completion (per item) ---
- Compare the candidate's answer against \`acceptable_answers\` and general semantic fit — accept reasonable synonyms and minor spelling slips (e.g. one-letter typos) as correct if the word is unambiguous.
- Score: 1 (correct) or 0 (incorrect/unattempted). No partial credit.
- Give a one-line reason for the score.

--- RUBRIC B: Passage recall (per item) ---
Score 0-10 based on:
  - Coverage of \`key_points\` (how many of the 4 survived, in the candidate's own words) — weight 60%
  - Coherence and grammar of the rewrite — weight 25%
  - Should NOT be near-verbatim copying of the original if the original was somehow pasted in (flag as suspicious, cap score at 3) — weight 15% (penalty only, not a bonus)
Give 2-3 lines of specific feedback: what was retained, what was missed, one concrete improvement tip.

--- RUBRIC C: Email writing (single item) ---
Score 0-100 based on TCS-style workplace email criteria:
  - Correct formal structure: salutation, clear subject/purpose opening, body, polite closing, sign-off (25%)
  - Coverage of all \`required_elements\` from the scenario (30%)
  - Tone appropriateness (formal/semi-formal as specified) (15%)
  - Grammar, spelling, punctuation (15%)
  - Clarity and conciseness — no rambling, no missing context a recipient would need (15%)
- WORD MINIMUM: if \`meets_word_minimum\` is false, cap the total score at 40 regardless of quality, and say explicitly in feedback that the response fell below the ${SECTION_TIMING.email_writing.min_words}-word minimum with the actual word count stated. This is a hard exam requirement, not a soft preference — do not grade around it.
Give feedback as: 3-5 specific bullet points (what worked, what to fix), plus ONE rewritten example sentence for the weakest part of their email — not a full rewrite of the whole email, just enough to show the fix.

OUTPUT FORMAT:

{
  "sentence_completion_results": [
    { "id": 1, "score": 1, "verdict": "correct", "reason": "string" }
    // one per item received
  ],
  "passage_recall_results": [
    { "id": 21, "score": 7, "max_score": 10, "feedback": "string" }
  ],
  "email_result": {
    "id": 25,
    "score": 78,
    "max_score": 100,
    "word_count": 0,
    "meets_word_minimum": true,
    "breakdown": {
      "structure": 20, "coverage": 22, "tone": 13, "grammar": 12, "clarity": 11
    },
    "feedback_bullets": ["string", "string", "string"],
    "improved_example": "string, one rewritten sentence"
  },
  "summary": {
    "sentence_completion_total": "x/20",
    "passage_recall_total": "x/40",
    "email_total": "x/100",
    "overall_note": "1-2 sentence honest, non-inflated assessment of readiness for the real exam"
  }
}

GRADING PHILOSOPHY:
- Be honest and calibrated, not encouraging-by-default. This is exam prep; inflated scores are actively harmful to the candidate's readiness.
- Never fabricate a score without checking the actual text given.
- If a response is empty or clearly gibberish/timeout-cut-off, score 0 and say so plainly rather than being generous.`;

  const userPrompt = `Here is the candidate's test payload to evaluate:\n\n${JSON.stringify(payload, null, 2)}`;

  const result = await callGroqWithJsonRetry(apiKey, model, systemPrompt, userPrompt, 0.2, 2);

  // Belt-and-suspenders: enforce the word-count cap in code too, in case the model doesn't apply it
  if (result?.email_result && trimmedEmail && !trimmedEmail.meets_word_minimum && result.email_result.score > 40) {
    result.email_result.score = Math.min(result.email_result.score, 40);
  }
  if (result?.email_result && trimmedEmail) {
    result.email_result.word_count = emailWordCount;
    result.email_result.meets_word_minimum = trimmedEmail.meets_word_minimum;
  }

  return result;
}