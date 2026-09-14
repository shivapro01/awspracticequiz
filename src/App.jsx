import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Moon, RotateCcw, Send, Sun, Timer, XCircle } from "lucide-react";
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

function App() {
  const [activeTestId, setActiveTestId] = useState(data.tests[0].id);
  const activeTest = data.tests.find((test) => test.id === activeTestId) ?? data.tests[0];
  const [testState, setTestState] = useState(() => loadState(activeTest));
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");
  const [now, setNow] = useState(Date.now());

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

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>AWS SAA-C03 Quiz</h1>
          <p>{data.totalQuestions} questions split into {data.tests.length} practice tests</p>
        </div>
        <div className="test-list">
          {data.tests.map((test) => (
            <button
              className={`test-button ${test.id === activeTestId ? "active" : ""}`}
              key={test.id}
              onClick={() => setActiveTestId(test.id)}
            >
              <span>{test.title}</span>
              <span className="muted">{test.startQuestion}-{test.endQuestion}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="content">
        <div className="topbar">
          <div>
            <h1>{activeTest.title}</h1>
            <p className="muted">Questions {activeTest.startQuestion}-{activeTest.endQuestion}</p>
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

        <div className="workspace">
          <nav className="question-nav" aria-label="Question list">
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
          </nav>

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
        </div>
      </section>
    </main>
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
