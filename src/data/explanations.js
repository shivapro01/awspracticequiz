// Explanation loader for the practice quiz.
//
// Explanations live in `src/data/explanations/chunk-<start>-<end>.json`, one file per
// practice test. Each chunk maps question id -> explanation string (one entry per
// question; for multi-answer questions the rationale covers all correct options).
// Rationale written by hand/AI is unverified — review before relying on it for study.

const chunkModules = import.meta.glob("./explanations/chunk-*.json", { eager: true });

const byId = new Map();
for (const [path, module] of Object.entries(chunkModules)) {
  const chunk = module.default ?? module;
  for (const [questionId, text] of Object.entries(chunk)) {
    if (typeof text === "string" && text.trim()) {
      byId.set(Number(questionId), text.trim());
    }
  }
}

export function getExplanation(questionId) {
  return byId.get(Number(questionId)) ?? "";
}
