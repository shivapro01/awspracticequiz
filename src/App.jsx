import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  GraduationCap,
  Home,
  Layers,
  Menu,
  Moon,
  Play,
  RotateCcw,
  Search,
  Send,
  Shuffle,
  Sparkles,
  Sun,
  Target,
  Timer,
  Trophy,
  X,
  XCircle,
} from "lucide-react";
import { createRoot } from "react-dom/client";
import data from "./data/questions.json";
import { getExplanation } from "./data/explanations";
import "./main.css";

const STORAGE_PREFIX = "aws-saa-c03-practice";
const THEME_KEY = "aws-saa-c03-theme";

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((part) => String(part).padStart(2, "0")).join(":");
}

function shuffledCopy(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function createFreshState(test) {
  return {
    currentIndex: 0,
    answers: {},
    skipped: {},
    checked: {},
    startedAt: Date.now(),
    elapsedBeforeSubmit: 0,
    submitted: false,
    questionOrder: shuffledCopy(test.questions.map((question) => question.id)),
    optionOrder: Object.fromEntries(
      test.questions.map((question) => [question.id, shuffledCopy(question.options.map((option) => option.key))]),
    ),
  };
}

function normalizeState(state, test) {
  if (state.questionOrder && state.optionOrder) {
    return state;
  }
  const fresh = createFreshState(test);
  return { ...fresh, ...state, questionOrder: state.questionOrder ?? fresh.questionOrder, optionOrder: state.optionOrder ?? fresh.optionOrder };
}

function loadState(test) {
  const testId = test.id;
  const saved = localStorage.getItem(`${STORAGE_PREFIX}:${testId}`);
  if (!saved) {
    return createFreshState(test);
  }
  try {
    return normalizeState(JSON.parse(saved), test);
  } catch {
    return createFreshState(test);
  }
}

function isCorrect(question, answer = []) {
  return question.correctAnswer.length === answer.length && question.correctAnswer.every((key) => answer.includes(key));
}

function readStoredTestState(testId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${testId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getTestProgress(test) {
  const saved = readStoredTestState(test.id);
  if (!saved) {
    return { status: "not-started", attempted: 0, answered: 0, skipped: 0, submitted: false, score: null, total: test.questions.length };
  }
  const answered = Object.keys(saved.answers ?? {}).length;
  const skipped = Object.keys(saved.skipped ?? {}).length;
  const submitted = Boolean(saved.submitted);
  let score = null;
  if (submitted) {
    score = test.questions.filter((q) => isCorrect(q, saved.answers?.[q.id])).length;
  }
  const status = submitted ? "completed" : answered > 0 || skipped > 0 ? "in-progress" : "not-started";
  return { status, attempted: answered, answered, skipped, submitted, score, total: test.questions.length };
}

const EXAM_DOMAINS = [
  { name: "Resilient Architectures", weight: "30%", Icon: Layers, desc: "High availability, decoupling, disaster recovery & multi-tier design." },
  { name: "High-Performing Architectures", weight: "28%", Icon: Sparkles, desc: "Scalable compute, storage, databases & networking for performance." },
  { name: "Secure Applications", weight: "24%", Icon: Award, desc: "IAM, encryption, network security & data protection controls." },
  { name: "Cost-Optimized Architectures", weight: "18%", Icon: Target, desc: "Right-sizing, pricing models & eliminating waste." },
];

function App() {
  const [activeTestId, setActiveTestId] = useState(data.tests[0].id);
  const activeTest = data.tests.find((test) => test.id === activeTestId) ?? data.tests[0];
  const [testState, setTestState] = useState(() => loadState(activeTest));
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState("home");
  const [progressTick, setProgressTick] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setTestState(loadState(activeTest));
  }, [activeTest]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}:${activeTestId}`, JSON.stringify(testState));
  }, [activeTestId, testState]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [sidebarOpen]);

  const questionById = useMemo(() => new Map(activeTest.questions.map((question) => [question.id, question])), [activeTest]);
  const orderedQuestions = useMemo(
    () => (testState.questionOrder ?? activeTest.questions.map((question) => question.id)).map((id) => questionById.get(id)).filter(Boolean),
    [activeTest.questions, questionById, testState.questionOrder],
  );
  const currentQuestion = orderedQuestions[testState.currentIndex] ?? orderedQuestions[0] ?? activeTest.questions[0];
  const visibleOptions = useMemo(() => orderedOptions(currentQuestion, testState.optionOrder), [currentQuestion, testState.optionOrder]);
  const selectedAnswers = testState.answers[currentQuestion.id] ?? [];
  const answerChecked = Boolean(testState.checked?.[currentQuestion.id]);
  const elapsedSeconds = testState.submitted
    ? testState.elapsedBeforeSubmit
    : Math.floor((now - testState.startedAt) / 1000);

  const result = useMemo(() => {
    const correct = orderedQuestions.filter((question) => isCorrect(question, testState.answers[question.id])).length;
    const attempted = Object.keys(testState.answers).length;
    const skipped = Object.keys(testState.skipped).length;
    const wrong = orderedQuestions.filter((question) => {
      const answer = testState.answers[question.id];
      return answer?.length && !isCorrect(question, answer);
    });
    return { correct, attempted, skipped, wrong };
  }, [orderedQuestions, testState.answers, testState.skipped]);

  function updateState(updater) {
    setTestState((previous) => ({ ...previous, ...updater(previous) }));
  }

  function chooseAnswer(key) {
    updateState((previous) => {
      const current = previous.answers[currentQuestion.id] ?? [];
      const next = currentQuestion.multiple
        ? current.includes(key)
          ? current.filter((item) => item !== key)
          : [...current, key].sort()
        : [key];
      const skipped = { ...previous.skipped };
      const answers = { ...previous.answers };
      const checked = { ...previous.checked };
      delete skipped[currentQuestion.id];
      delete checked[currentQuestion.id];
      if (next.length) {
        answers[currentQuestion.id] = next;
      } else {
        delete answers[currentQuestion.id];
      }
      return { answers, skipped, checked };
    });
  }

  function goTo(index) {
    updateState(() => ({ currentIndex: Math.max(0, Math.min(index, orderedQuestions.length - 1)) }));
  }

  function markLater() {
    updateState((previous) => {
      const answers = { ...previous.answers };
      const checked = { ...previous.checked };
      delete answers[currentQuestion.id];
      delete checked[currentQuestion.id];
      return { answers, checked, skipped: { ...previous.skipped, [currentQuestion.id]: true } };
    });
    goTo(testState.currentIndex + 1);
  }

  function checkCurrentAnswer() {
    if (!selectedAnswers.length) {
      return;
    }
    updateState((previous) => ({ checked: { ...previous.checked, [currentQuestion.id]: true } }));
  }

  function restartTest() {
    const fresh = createFreshState(activeTest);
    setTestState(fresh);
    localStorage.setItem(`${STORAGE_PREFIX}:${activeTestId}`, JSON.stringify(fresh));
  }

  function submitTest() {
    updateState(() => ({ submitted: true, elapsedBeforeSubmit: elapsedSeconds }));
  }

  function openTest(testId) {
    setActiveTestId(testId);
    setTestState(loadState(data.tests.find((t) => t.id === testId) ?? activeTest));
    setView("quiz");
    setSidebarOpen(false);
    window.scrollTo(0, 0);
  }

  function goHome() {
    setProgressTick((t) => t + 1);
    setView("home");
    setSidebarOpen(false);
    window.scrollTo(0, 0);
  }

  // ---- Home dashboard derived stats ----
  const [homeQuery, setHomeQuery] = useState("");
  const [homeFilter, setHomeFilter] = useState("all");

  const allProgress = useMemo(
    () => data.tests.map((t) => ({ test: t, progress: getTestProgress(t) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progressTick, testState, activeTestId, view],
  );

  const dashboard = useMemo(() => {
    const completed = allProgress.filter((x) => x.progress.status === "completed");
    const inProgress = allProgress.filter((x) => x.progress.status === "in-progress");
    const scores = completed.map((x) => x.progress.score ?? 0);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const totalAnswered = allProgress.reduce((a, x) => a + x.progress.answered, 0);
    const overallPct = Math.round((totalAnswered / Math.max(1, data.totalQuestions)) * 100);
    const best = completed.length
      ? completed.reduce((a, b) => ((a.progress.score ?? 0) > (b.progress.score ?? 0) ? a : b))
      : null;
    const continueItem = inProgress[0] ?? allProgress.find((x) => x.progress.status === "not-started") ?? allProgress[0];
    return { completed: completed.length, inProgress: inProgress.length, avgScore, totalAnswered, overallPct, best, continueItem };
  }, [allProgress]);

  const filteredTests = useMemo(() => {
    const q = homeQuery.trim().toLowerCase();
    return allProgress.filter(({ test, progress }) => {
      if (homeFilter !== "all" && progress.status !== homeFilter) return false;
      if (!q) return true;
      return (
        test.title.toLowerCase().includes(q) ||
        `${test.startQuestion}-${test.endQuestion}`.includes(q) ||
        String(test.startQuestion).includes(q)
      );
    });
  }, [allProgress, homeQuery, homeFilter]);

  function startRandom() {
    const pool = allProgress.filter((x) => x.progress.status !== "completed");
    const pick = (pool.length ? pool : allProgress)[Math.floor(Math.random() * (pool.length ? pool.length : allProgress.length))];
    if (pick) openTest(pick.test.id);
  }

  if (view === "home") {
    return (
      <HomeScreen
        theme={theme}
        setTheme={setTheme}
        dashboard={dashboard}
        filteredTests={filteredTests}
        homeQuery={homeQuery}
        setHomeQuery={setHomeQuery}
        homeFilter={homeFilter}
        setHomeFilter={setHomeFilter}
        onOpen={openTest}
        onRandom={startRandom}
      />
    );
  }

  return (
    <main className="app">
      <div
        className={`sidebar-backdrop ${sidebarOpen ? "show" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-top-row">
          <button className="home-link" onClick={goHome}>
            <span className="home-link-icon"><Home size={16} /></span>
            <span>Home</span>
          </button>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close practice test list">
            <X size={18} />
          </button>
        </div>
        <div className="brand">
          <div className="brand-badge"><Cloud size={18} /></div>
          <div>
            <h1>AWS SAA-C03 Quiz</h1>
            <p>{data.totalQuestions} questions · {data.tests.length} practice tests</p>
          </div>
        </div>
        <div className="sidebar-label">Practice tests</div>
        <div className="test-list">
          {allProgress.map(({ test, progress }) => (
            <button
              className={`test-button ${test.id === activeTestId ? "active" : ""}`}
              key={test.id}
              onClick={() => openTest(test.id)}
            >
              <span className="test-button-main">
                <span className={`dot dot-${progress.status}`} />
                <span>{test.title}</span>
              </span>
              <span className="muted">{test.startQuestion}-{test.endQuestion}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-foot">
          <div className="sidebar-progress">
            <div className="sidebar-progress-top"><span>Overall progress</span><span>{dashboard.overallPct}%</span></div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${dashboard.overallPct}%` }} /></div>
          </div>
          <button className="ghost-button compact full" onClick={goHome}><Home size={15} /> Dashboard</button>
        </div>
      </aside>

      <section className="content">
        <div className="topbar">
          <div className="topbar-title">
            <button
              className="hamburger-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open practice test list"
              aria-expanded={sidebarOpen}
            >
              <Menu size={19} />
            </button>
            <button className="ghost-button compact" onClick={goHome}><ChevronLeft size={15} /> Home</button>
            <div>
              <h1>{activeTest.title}</h1>
              <p className="muted">Questions {activeTest.startQuestion}-{activeTest.endQuestion}</p>
            </div>
          </div>
          <div className="stats">
            <button className="ghost-button compact" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <span className="pill"><Timer size={15} /> {formatDuration(elapsedSeconds)}</span>
            <span className="pill">Attempted {result.attempted}/{orderedQuestions.length}</span>
            <span className="pill">Skipped {result.skipped}</span>
          </div>
        </div>

        <div className="workspace workspace-questions-first">
          {testState.submitted ? (
            <ResultPanel questions={orderedQuestions} result={result} answers={testState.answers} optionOrder={testState.optionOrder} onRestart={restartTest} />
          ) : (
            <article className="panel">
              <div className="question-title">
                <h2>Question {testState.currentIndex + 1} of {orderedQuestions.length}</h2>
                <span className="pill">Source #{currentQuestion.id}{currentQuestion.multiple ? " - multiple answers" : ""}</span>
              </div>
              <div className="prompt">{currentQuestion.question}</div>
              <div className="options">
                {visibleOptions.map((option) => {
                  const selected = selectedAnswers.includes(option.key);
                  const correct = currentQuestion.correctAnswer.includes(option.key);
                  const checkedClass = answerChecked && selected ? (correct ? "correct" : "incorrect") : "";
                  return (
                  <label className={`option ${selected ? "selected" : ""} ${checkedClass}`} key={option.key}>
                    <input
                      type={currentQuestion.multiple ? "checkbox" : "radio"}
                      checked={selected}
                      onChange={() => chooseAnswer(option.key)}
                    />
                    <span><strong>{option.key}.</strong> {option.text}</span>
                  </label>
                  );
                })}
              </div>
              {answerChecked ? <Explanation questionId={currentQuestion.id} correctKeys={currentQuestion.correctAnswer} /> : null}
              <div className="actions">
                <div className="action-group">
                  <button className="ghost-button" onClick={() => goTo(testState.currentIndex - 1)} disabled={testState.currentIndex === 0}>
                    <ChevronLeft size={17} /> Previous
                  </button>
                  <button className="ghost-button" onClick={markLater}>
                    <XCircle size={17} /> Attempt later
                  </button>
                  <button className="ghost-button" onClick={checkCurrentAnswer} disabled={!selectedAnswers.length}>
                    <CheckCircle2 size={17} /> Check answer
                  </button>
                  <button className="ghost-button" onClick={() => goTo(testState.currentIndex + 1)} disabled={testState.currentIndex === orderedQuestions.length - 1}>
                    Next <ChevronRight size={17} />
                  </button>
                </div>
                <div className="action-group">
                  <button className="ghost-button danger" onClick={restartTest}><RotateCcw size={17} /> Restart</button>
                  <button className="primary-button" onClick={submitTest}><Send size={17} /> Submit test</button>
                </div>
              </div>
            </article>
          )}
          <nav className="question-nav" aria-label="Question list">
            <div className="question-nav-title">Questions</div>
            <div className="question-nav-grid">
            {orderedQuestions.map((question, index) => {
              const status = testState.skipped[question.id]
                ? "skipped"
                : testState.answers[question.id]?.length
                  ? "answered"
                  : "";
              return (
                <button
                  className={`qnum ${status} ${index === testState.currentIndex ? "current" : ""}`}
                  key={question.id}
                  onClick={() => goTo(index)}
                  title={`Question ${index + 1}`}
                >
                  {index + 1}
                </button>
              );
            })}
            </div>
          </nav>
        </div>
      </section>
    </main>
  );
}

function HomeScreen({
  theme,
  setTheme,
  dashboard,
  filteredTests,
  homeQuery,
  setHomeQuery,
  homeFilter,
  setHomeFilter,
  onOpen,
  onRandom,
}) {
  const continueTest = dashboard.continueItem?.test;
  const continueProgress = dashboard.continueItem?.progress;
  const filters = [
    { id: "all", label: "All tests" },
    { id: "not-started", label: "Not started" },
    { id: "in-progress", label: "In progress" },
    { id: "completed", label: "Completed" },
  ];

  return (
    <div className="home">
      <header className="home-nav">
        <div className="home-nav-inner">
          <div className="home-brand">
            <span className="home-logo"><Cloud size={20} /></span>
            <div>
              <strong>AWS SAA-C03</strong>
              <span>Practice Exams</span>
            </div>
          </div>
          <div className="home-nav-actions">
            <span className="pill hide-mobile"><BookOpenCheck size={15} /> {data.totalQuestions} questions</span>
            <button className="ghost-button compact" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="hero-badge"><Sparkles size={14} /> AWS Certified Solutions Architect · Associate</span>
            <h1>Ace the SAA-C03 exam with <span className="gradient-text">{data.totalQuestions} practice questions</span></h1>
            <p className="hero-sub">
              {data.tests.length} focused 20-question practice tests with instant explanations, shuffled options,
              timers, and progress tracking — everything you need to walk in confident.
            </p>
            <div className="hero-cta">
              {continueTest ? (
                <button className="primary-button large" onClick={() => onOpen(continueTest.id)}>
                  <Play size={18} />
                  {continueProgress?.status === "in-progress"
                    ? `Continue ${continueTest.title}`
                    : continueProgress?.status === "completed"
                      ? "Keep practicing"
                      : `Start ${continueTest.title}`}
                </button>
              ) : null}
              <button className="ghost-button large" onClick={onRandom}>
                <Shuffle size={18} /> Surprise me
              </button>
            </div>
            <div className="hero-meta">
              <span><CheckCircle2 size={15} /> Instant explanations</span>
              <span><Timer size={15} /> Timed sessions</span>
              <span><RotateCcw size={15} /> Auto-saved progress</span>
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-card-head">
              <span className="hero-card-title"><BarChart3 size={16} /> Your progress</span>
              <span className="pill">{dashboard.overallPct}% complete</span>
            </div>
            <div className="progress-track big"><div className="progress-fill" style={{ width: `${dashboard.overallPct}%` }} /></div>
            <div className="hero-stats">
              <div className="hero-stat">
                <span className="hero-stat-icon"><Trophy size={17} /></span>
                <div><strong>{dashboard.completed}/{data.tests.length}</strong><span>tests done</span></div>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-icon"><Target size={17} /></span>
                <div><strong>{dashboard.avgScore !== null ? `${dashboard.avgScore}/20` : "—"}</strong><span>avg. score</span></div>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-icon"><Clock size={17} /></span>
                <div><strong>{dashboard.totalAnswered}</strong><span>answered</span></div>
              </div>
            </div>
            {dashboard.best ? (
              <div className="hero-best">
                <GraduationCap size={16} />
                <span>Best: <strong>{dashboard.best.test.title}</strong> — {dashboard.best.progress.score}/{dashboard.best.progress.total}</span>
              </div>
            ) : (
              <div className="hero-best muted-box">
                <Sparkles size={16} />
                <span>Finish your first test to unlock your average score.</span>
              </div>
            )}
            <div className="hero-card-foot">
              <span><Layers size={14} /> {dashboard.inProgress} in progress</span>
              <button className="link-button" onClick={() => document.getElementById("tests")?.scrollIntoView({ behavior: "smooth" })}>
                Browse tests <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <main className="home-body">
        <section className="feature-grid">
          <div className="feature">
            <span className="feature-icon"><BookOpenCheck size={20} /></span>
            <h3>Bite-size practice tests</h3>
            <p>20 questions per test so you can fit a full session into a coffee break — no burnout.</p>
          </div>
          <div className="feature">
            <span className="feature-icon"><CheckCircle2 size={20} /></span>
            <h3>Learn as you go</h3>
            <p>Check any answer instantly and read why the correct option wins.</p>
          </div>
          <div className="feature">
            <span className="feature-icon"><Timer size={20} /></span>
            <h3>Real exam feel</h3>
            <p>Shuffled questions, shuffled options, live timer, and a wrong-answer review screen.</p>
          </div>
          <div className="feature">
            <span className="feature-icon"><Award size={20} /></span>
            <h3>Never lose progress</h3>
            <p>Answers, skips, and timers auto-save per test. Refresh freely.</p>
          </div>
        </section>

        <section className="domains">
          <div className="section-head">
            <h2>What the exam covers</h2>
            <p className="muted">SAA-C03 weights — every practice test draws from all four domains.</p>
          </div>
          <div className="domain-grid">
            {EXAM_DOMAINS.map(({ name, weight, Icon, desc }) => (
              <div className="domain-card" key={name}>
                <span className="feature-icon small"><Icon size={18} /></span>
                <div className="domain-top"><strong>{name}</strong><span className="pill">{weight}</span></div>
                <p className="muted">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="tests" className="tests-section">
          <div className="section-head split">
            <div>
              <h2>Choose your practice test</h2>
              <p className="muted">{filteredTests.length} of {data.tests.length} tests shown</p>
            </div>
            <div className="tests-controls">
              <label className="search-box">
                <Search size={16} />
                <input
                  placeholder="Search tests… e.g. Test 12 or 221"
                  value={homeQuery}
                  onChange={(e) => setHomeQuery(e.target.value)}
                />
              </label>
              <div className="filter-row">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    className={`chip ${homeFilter === f.id ? "active" : ""}`}
                    onClick={() => setHomeFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredTests.length === 0 ? (
            <div className="panel empty">
              <p>No tests match your search. Try clearing the filter.</p>
              <button className="ghost-button" onClick={() => { setHomeQuery(""); setHomeFilter("all"); }}>Reset filters</button>
            </div>
          ) : (
            <div className="test-grid">
              {filteredTests.map(({ test, progress }) => {
                const pct = Math.round((progress.answered / Math.max(1, progress.total)) * 100);
                const cta =
                  progress.status === "completed" ? "View results" :
                  progress.status === "in-progress" ? "Continue" : "Start test";
                return (
                  <article className={`test-card status-${progress.status}`} key={test.id}>
                    <div className="test-card-top">
                      <span className={`status-badge ${progress.status}`}>
                        {progress.status === "completed" ? "Completed" : progress.status === "in-progress" ? "In progress" : "Not started"}
                      </span>
                      <span className="muted small">Q {test.startQuestion}–{test.endQuestion}</span>
                    </div>
                    <h3>{test.title}</h3>
                    <p className="muted small">{progress.total} questions · shuffled every attempt</p>
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${progress.submitted ? 100 : pct}%` }} /></div>
                    <div className="test-card-meta">
                      {progress.submitted && progress.score !== null ? (
                        <span className="score">Score {progress.score}/{progress.total}</span>
                      ) : (
                        <span className="muted small">{progress.answered}/{progress.total} answered{progress.skipped ? ` · ${progress.skipped} skipped` : ""}</span>
                      )}
                    </div>
                    <button className={progress.status === "not-started" ? "primary-button full" : "ghost-button full"} onClick={() => onOpen(test.id)}>
                      <Play size={16} /> {cta} <ArrowRight size={15} />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="home-foot">
          <p className="muted">Question bank is scraped from a third-party dump — answers may contain mistakes. Use as extra practice, not your sole source of truth.</p>
        </footer>
      </main>
    </div>
  );
}

function ResultPanel({ questions, result, answers, optionOrder, onRestart }) {
  return (
    <article className="panel results">
      <h2>Result</h2>
      <div className="stats">
        <span className="pill">Score {result.correct}/{questions.length}</span>
        <span className="pill">Attempted {result.attempted}</span>
        <span className="pill">Skipped {result.skipped}</span>
        <span className="pill">Wrong {result.wrong.length}</span>
      </div>
      <button className="ghost-button danger" onClick={onRestart}><RotateCcw size={17} /> Restart this test</button>
      <h3>Wrong Answers</h3>
      {result.wrong.length === 0 ? (
        <p className="muted">No wrong attempted answers in this test.</p>
      ) : (
        result.wrong.map((question) => (
          <div className="wrong-item" key={question.id}>
            <strong>Question {questions.indexOf(question) + 1}</strong>
            <p>{question.question}</p>
            <div className="review-options">
              {orderedOptions(question, optionOrder).map((option) => {
                const selected = (answers[question.id] ?? []).includes(option.key);
                const correct = question.correctAnswer.includes(option.key);
                return (
                  <div className={`review-option ${selected && !correct ? "picked" : ""} ${correct ? "correct" : ""}`} key={option.key}>
                    <span><strong>{option.key}.</strong> {option.text}</span>
                    {selected && !correct ? <span className="tag">Your answer</span> : null}
                    {correct ? <span className="tag">Correct</span> : null}
                  </div>
                );
              })}
            </div>
            <Explanation questionId={question.id} correctKeys={question.correctAnswer} />
          </div>
        ))
      )}
    </article>
  );
}

function Explanation({ questionId, correctKeys }) {
  const text = getExplanation(questionId);
  return (
    <div className="explanation">
      <h3>Explanation</h3>
      <p className="explanation-answer">Correct answer: <strong>{correctKeys.join(" and ")}</strong></p>
      {text ? <p>{text}</p> : <p className="muted">No written explanation for this question yet.</p>}
    </div>
  );
}

function orderedOptions(question, optionOrder) {
  const optionsByKey = new Map(question.options.map((option) => [option.key, option]));
  return (optionOrder?.[question.id] ?? question.options.map((option) => option.key))
    .map((key) => optionsByKey.get(key))
    .filter(Boolean);
}

createRoot(document.getElementById("root")).render(<App />);
