# TCS NQT Verbal Ability Practice Portal (2026 Pattern)

A high-fidelity, premium Single Page Application (SPA) designed to simulate the exact layout, regulations, and timing of the TCS NQT Verbal Ability foundation exam. The portal uses a **Dual Groq API Key Architecture** to generate unique tests and grade responses without phrasing bias.

---

## 🚀 Key Features

* **Dual-Key Isolation**: Uses **Key A (Generator)** at `temperature: 0.9` to write unique tests, and **Key B (Evaluator)** at `temperature: 0.2` to grade submissions strictly against TCS rubrics. The grader never sees the generator prompts.
* **Cheating Defense**: Core questions are sanitized of answer keys, explanations, and recall requirements before rendering in the exam engine to prevent inspect-element leaks.
* **Auto-Save & Refresh Recovery**: Active inputs and exam stages are auto-saved to `localStorage` on every keystroke. If you refresh or drop connection, the exam resumes with the timer correctly ticking down.
* **Self-Correcting Timers**: Evaluates time via absolute target timestamps (`endTimestamp - Date.now()`) to bypass background browser tab timer throttling.
* **Topic Injection Freshness**: Feeds the topic tags and scenarios of your last 5 attempts back into Key A's seed to prevent content overlap.
* **Pure SVG Charting**: Renders metrics and score progress trends client-side with native SVG elements (no bloated charting libraries).

---

## 🛠️ Exam Structure & Regulations

| Section | Question Type | Count | Visibility | Timer | Regulations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Section 1** | Sentence Completion | 20 | Visible | **25s** per Q | Typed answer (no options/MCQs). Auto-advances. |
| **Section 2** | Passage Recall | 4 | 30s visible, then hidden | **30s** read, **90s** write | Paragraph is hidden during the 90s writing phase. |
| **Section 3** | Email Writing | 1 | Scenario stays visible | **540s** (9 min) | Corporate scenario compose panel. Auto-submits. |

---

## 📦 Tech Stack

* **Build Tool**: Vite 8
* **Library**: React 19
* **Icons**: Lucide React
* **Styling**: Vanilla CSS (Modern CSS Custom Tokens, Light/Dark Modes, Glassmorphic panels)

---

## ⚙️ Quick Start

### 1. Prerequisite
Ensure [Node.js](https://nodejs.org/) (v18 or higher) and npm are installed.

### 2. Setup Environment Variables
You can configure your Groq API credentials in two ways:

#### Option A: `.env.local` file (Recommended for local dev)
Copy the `.env.example` file to `.env.local` and add your Groq keys:
```bash
cp .env.example .env.local
```
Edit `.env.local` to fill in your API keys:
```env
VITE_GROQ_KEY_A=gsk_your_generator_api_key_here
VITE_GROQ_KEY_B=gsk_your_evaluator_api_key_here
```

#### Option B: Settings UI
Alternatively, launch the portal, open the **Settings** menu at the top right, insert the credentials, and save. The keys will be encrypted/persisted securely inside your browser's local sandbox (`localStorage`).

### 3. Run Locally

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```
Navigate to `http://localhost:5173` in your browser.

### 4. Build and Preview for Production
To build the application bundle and test it in a production-like environment:
```bash
# Build the optimized production bundles
npm run build

# Run local preview server on compiled dist folder
npm run preview
```

---

## 📂 Architecture Overview

* [src/App.jsx](file:///d:/TCS%20prep/src/App.jsx): Main state controller. Manages session cache hydration, navigation routes, theme switching, error fallbacks, and the sanitization layer.
* [src/utils/groq.js](file:///d:/TCS%20prep/src/utils/groq.js): Contains connection tests, prompt builders, schema validation, and JSON parsing retry loops.
* [src/index.css](file:///d:/TCS%20prep/src/index.css): Design Tokens, light/dark variables, buttons, grids, animations, and forms.
* [src/components/Dashboard.jsx](file:///d:/TCS%20prep/src/components/Dashboard.jsx): Score trends, stats tracking, SVG progress charts, and list of attempts.
* [src/components/Settings.jsx](file:///d:/TCS%20prep/src/components/Settings.jsx): API key configurator with input masking, model overrides, and connection test status.
* [src/components/ExamEngine.jsx](file:///d:/TCS%20prep/src/components/ExamEngine.jsx): Step indicators, self-correcting timers, phase transitions, and inputs.
* [src/components/ResultsView.jsx](file:///d:/TCS%20prep/src/components/ResultsView.jsx): Detailed feedback tabs, correct/incorrect comparison, recall score detail, and email rubric rating charts.
