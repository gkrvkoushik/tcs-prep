# TCS NQT Foundation & Advanced Practice Portal

A high-fidelity, premium Single Page Application (SPA) designed to simulate the exact layout, regulations, and timing of the TCS NQT (National Qualifier Test) Foundation & Advanced sections. The portal uses a **Dual Groq API Key Architecture** to generate unique, syllabus-aligned exam papers on demand and grade response sheets dynamically.

---

## 🚀 Key Features

* **Complete Exam Coverage**:
  * **Full Mock Exam**: Simulates the full four-section exam sequence (**Numerical Ability** ➔ **Reasoning Ability** ➔ **Verbal Ability** ➔ **Advanced Quant & Reasoning**).
  * **Section Drills**: Start standalone practice sessions for any section or subsection.
* **Dual-Key Isolation**: Uses **Key A (Generator)** at `temperature: 0.8` to write unique tests, and **Key B (Evaluator)** at `temperature: 0.2` to grade subjective Verbal submissions.
* **Local Objective Grading**: Instantly scores Numerical, Reasoning, and Advanced sections inside the browser with zero API lag, utilizing tolerance-based comparisons for decimal inputs.
* **Data Interpretation & Grouped Sets**: Features a split-screen workspace displaying Seating Arrangements, Dice nets, or Data Interpretation tables alongside the active questions. Contains a built-in **Markdown Table Visualizer** that formats raw grids into beautiful, interactive HTML tables.
* **Interactive Question Palette**: Switch between questions freely in the section, tracking attempted vs. unattempted questions through a color-coded navigation grid.
* **Self-Correcting Timers**: Keeps time using absolute epoch timestamps (`endTimestamp - Date.now()`) to bypass background browser tab throttling.
* **Cheating Defense**: Sanitizes correct answers, explanations, and recall paragraphs from client memory before rendering the exam engine to prevent inspect-element leaks.
* **Save & Exit / Recovery**: Autosaves your exam state to `localStorage` on every keypress (recoverable on page refresh). Features an **Exit Test** button to abort and discard a practice run without recording a score.

---

## 🛠️ Exam Structure & Regulations

| Section | Topic Scope | Question Count | Timer | Regulations |
| :--- | :--- | :--- | :--- | :--- |
| **Numerical Ability** | Number System, DI, Mensuration, Averages, Ages, Percentages, PL, SI-CI, Ratio, Time & Work/Distance, Logarithm | 20 Questions | **25 Minutes** | Free section navigation. Typed numeric entry / MCQ. |
| **Reasoning Ability** | Coding-Decoding, Seating, Dice, Blood Relations, Syllogisms, Decision Making, Analogy, Sufficiency | 20 Questions | **25 Minutes** | Free section navigation. Typed numeric entry / MCQ. |
| **Verbal Ability** | Sentence Completion (20 Qs), Passage Recall (4 Qs), Email Writing (1 scenario) | 25 Questions total | **26 Minutes** total (~8.3m / 8m / 9m) | Per-question auto-advancing timers (25s SC, 30s/90s Recall, 9m Email). |
| **Advanced Quant & Reasoning** | Advanced variants of Quantitative Aptitude and Logical Reasoning | 14 Questions | **25 Minutes** | Free section navigation. Typed numeric entry / MCQ. |

---

## ⚙️ Quick Start

### 1. Prerequisites
Ensure [Node.js](https://nodejs.org/) (v18 or higher) and npm are installed.

### 2. Setup Environment Variables
You can configure your Groq API credentials in two ways:

#### Option A: `.env.local` file (Recommended for development)
Copy `.env.example` to `.env` or `.env.local`:
```bash
cp .env.example .env.local
```
Edit the file to configure your credentials:
```env
VITE_GROQ_API_KEY_A=gsk_your_generator_api_key_here
VITE_GROQ_API_KEY_B=gsk_your_evaluator_api_key_here

# Optional model overrides
VITE_GROQ_MODEL_A=llama-3.3-70b-versatile
VITE_GROQ_MODEL_B=llama-3.3-70b-versatile
```

#### Option B: Settings UI
Alternatively, launch the portal, open the **Settings** menu at the top right, insert the credentials, and save. The keys will be stored securely inside your browser's local sandbox (`localStorage`).

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
# Build the optimized production bundle
npm run build

# Run local preview server on compiled dist folder
npm run preview
```

---

## 📂 Architecture Overview

* [src/App.jsx](file:///e:/TCS-prep/src/App.jsx): Main state controller. Manages session cache hydration, navigation routes, theme switching, and the evaluation workflow.
* [src/utils/aptitude.js](file:///e:/TCS-prep/src/utils/aptitude.js): Handles question allocation budgets, stochastic rotation, local objective grading, and paper validation.
* [src/utils/tableParser.jsx](file:///e:/TCS-prep/src/utils/tableParser.jsx): Parses markdown syntax grids into beautiful, striped HTML tables.
* [src/components/Dashboard.jsx](file:///e:/TCS-prep/src/components/Dashboard.jsx): Score trends, stats tracking, SVG progress charts, and list of attempts.
* [src/components/ExamEngine.jsx](file:///e:/TCS-prep/src/components/ExamEngine.jsx): Step indicators, self-correcting timers, split-screen workspaces, and input fields.
* [src/components/ResultsView.jsx](file:///e:/TCS-prep/src/components/ResultsView.jsx): Detailed feedback tabs, correctness cards, topic mastery breakdowns, and explanation keys.
