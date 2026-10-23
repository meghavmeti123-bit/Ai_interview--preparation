const QUESTIONS_PER_ROUND = 5;
const state = {
  sessionId: null,
  setup: null,
  question: null,
  questionNumber: 0,
  roundNumber: 1,
  hasReview: false,
  roundComplete: false,
  retryFocus: [],
  retryMode: false,
  previousQuestion: null,
};
const panels = ["setup", "practice", "review", "reset"];
const $ = (selector) => document.querySelector(selector);

function showStage(stage) {
  for (const name of panels) {
    const panel = $(`#panel-${name}`);
    panel.hidden = name !== stage;
    panel.classList.toggle("visible", name === stage);
    const link = $(`[data-stage="${name}"]`);
    link.classList.toggle("active", name === stage);
    link.disabled = !state.sessionId
      || (name === "practice" && !state.question && !state.roundComplete)
      || (name === "review" && !state.hasReview)
      || (name === "reset" && !state.roundComplete);
    link.querySelector(".stage-state")?.remove();
    if (name === stage) link.insertAdjacentHTML("beforeend", '<span class="stage-state">NOW</span>');
  }
  const headings = {
    setup: ["STEP 01 / SET UP", "Build your practice"],
    practice: [`ROUND ${String(state.roundNumber).padStart(2, "0")} / PRACTICE`, "Choose the best answer"],
    review: ["ANSWER CHECK", state.roundComplete ? "Your round results" : "See how you did"],
    reset: ["STEP 04 / PRACTICE AGAIN", "Choose what comes next"],
  };
  $("#stage-kicker").textContent = headings[stage][0];
  $("#page-title").textContent = headings[stage][1];
  $("#stage-back").hidden = stage === "setup";
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.querySelector("span").textContent = busy ? label : (button.dataset.label || label);
}

async function makeQuestion(focusAreas = []) {
  const button = $("#continue-practice");
  button.dataset.label = button.querySelector("span").textContent;
  setBusy(button, true, "Loading question...");
  try {
    const question = await requestJson(`/api/sessions/${state.sessionId}/practice`, {
      method: "POST",
      body: JSON.stringify({ round_number: state.roundNumber, focus_areas: focusAreas }),
    });
    state.question = question;
    state.questionNumber += 1;
    state.hasReview = false;
    $("#question-focus").textContent = question.focus_area.toUpperCase();
    $("#question-index").textContent = `QUESTION ${String(state.questionNumber).padStart(2, "0")} / ${QUESTIONS_PER_ROUND}`;
    $("#question-text").textContent = question.question;
    $("#practice-error").textContent = "";
    $("#open-answer").value = "";
    $("#question-type").textContent = question.question_type.toUpperCase();
    $("#question-difficulty").textContent = question.difficulty.toUpperCase();
    renderOptions(question.options);
    $("#open-answer").readOnly = false;
    $("#review-answer").disabled = false;
    $("#question-index").textContent = state.retryMode
      ? `INTENTIONAL RETRY · ROUND ${state.roundNumber}`
      : `QUESTION ${String(state.questionNumber).padStart(2, "0")} / ${QUESTIONS_PER_ROUND}`;
    $("#session-count").textContent = `ROUND ${state.roundNumber} · ${state.questionNumber} / ${QUESTIONS_PER_ROUND}`;
    showStage("practice");
  } catch (error) {
    $("#practice-error").textContent = error.message;
  } finally {
    setBusy(button, false, "Next question");
  }
}

function renderOptions(options) {
  const container = $("#answer-options");
  container.replaceChildren();
  const isMultipleChoice = state.question.format === "multiple_choice";
  $("#choice-fieldset").hidden = !isMultipleChoice;
  $("#open-answer-field").hidden = isMultipleChoice;
  $("#answer-hint").textContent = isMultipleChoice ? "One answer per question" : "Use the space provided to explain your reasoning";
  if (!isMultipleChoice) return;
  for (const [key, text] of Object.entries(options)) {
    const label = document.createElement("label");
    label.className = "answer-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "selected-option";
    input.value = key;
    const letter = document.createElement("span");
    letter.className = "option-key";
    letter.textContent = key;
    const answer = document.createElement("span");
    answer.className = "option-text";
    answer.textContent = text;
    label.append(input, letter, answer);
    container.append(label);
  }
}

$("#role").addEventListener("change", () => {
  const otherRole = $("#other-role");
  otherRole.hidden = $("#role").value !== "Other";
  otherRole.required = !otherRole.hidden;
});

$("#setup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.dataset.label = button.querySelector("span").textContent;
  setBusy(button, true, "Setting up...");
  const selectedRole = $("#role").value;
  const setup = {
    role: selectedRole === "Other" ? $("#other-role").value.trim() : selectedRole,
    experience: $("#experience").value,
    interview_type: $("#interview-type").value,
    focus_areas: [...document.querySelectorAll('input[name="focus"]:checked')].map((input) => input.value),
  };
  try {
    const result = await requestJson("/api/sessions", { method: "POST", body: JSON.stringify(setup) });
    state.sessionId = result.session_id;
    state.setup = result.setup;
    state.questionNumber = 0;
    state.roundNumber = 1;
    state.hasReview = false;
    state.roundComplete = false;
    state.retryFocus = [];
    state.retryMode = false;
    state.previousQuestion = null;
    await makeQuestion();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(button, false, "Build my session");
  }
});

$("#review-answer").addEventListener("click", async (event) => {
  const selected = document.querySelector('input[name="selected-option"]:checked');
  const isMultipleChoice = state.question.format === "multiple_choice";
  const answer = $("#open-answer").value.trim();
  if (isMultipleChoice && !selected) {
    $("#practice-error").textContent = "Choose one of the four options before checking your answer.";
    return;
  }
  if (!isMultipleChoice && answer.length < 20) {
    $("#practice-error").textContent = "Add a little more detail before submitting your response.";
    return;
  }
  const button = event.currentTarget;
  $("#practice-error").textContent = "";
  button.dataset.label = button.querySelector("span").textContent;
  setBusy(button, true, "Checking answer...");
  try {
    const result = await requestJson(`/api/sessions/${state.sessionId}/reviews`, {
      method: "POST",
      body: JSON.stringify({
        question_id: state.question.question_id,
        selected_option: selected?.value || "",
        answer,
        round_number: state.roundNumber,
      }),
    });
    state.hasReview = true;
    state.roundComplete = state.retryMode || state.questionNumber === QUESTIONS_PER_ROUND;
    renderAnswerReview(result);
    showStage("review");
    if (state.roundComplete && !state.retryMode) await renderRoundSummary();
  } catch (error) {
    $("#practice-error").textContent = error.message;
  } finally {
    setBusy(button, false, "Check answer");
  }
});

function renderAnswerReview(result) {
  const { review } = result;
  document.querySelectorAll('input[name="selected-option"]').forEach((input) => { input.disabled = true; });
  $("#open-answer").readOnly = true;
  $("#review-answer").disabled = true;
  const verdict = $("#answer-verdict");
  verdict.classList.toggle("is-correct", review.is_correct);
  verdict.classList.toggle("is-incorrect", !review.is_correct);
  $("#verdict-mark").textContent = review.is_correct ? "✓" : "×";
  $("#verdict-label").textContent = state.question.format === "open_ended"
    ? "AI RUBRIC REVIEW"
    : review.is_correct ? "CORRECT" : "NOT QUITE";
  $("#verdict-title").textContent = state.question.format === "open_ended"
    ? (review.is_correct ? "Strong response" : "Keep developing")
    : review.is_correct ? "Good choice" : "Review this one";
  $("#answer-score").textContent = state.question.format === "open_ended" ? `${review.score} / 100` : "";
  $("#review-feedback").textContent = review.feedback || `You selected ${review.selected_option}: ${result.selected_text}`;
  $("#answer-explanation-text").textContent = review.format === "open_ended"
    ? (review.growth_areas || []).join(" · ") || review.feedback
    : review.explanation;
  $("#answer-comparison").textContent = state.question.format === "open_ended"
    ? `Reference approach: ${result.correct_text}`
    : review.is_correct
      ? `Correct answer: ${review.correct_option} · ${result.correct_text}`
      : `Best answer: ${review.correct_option} · ${result.correct_text}`;
  $("#review-progress").textContent = state.roundComplete
    ? "All five answers are in. Here is your focus summary."
    : `${state.questionNumber} of ${QUESTIONS_PER_ROUND} answers checked.`;
  $("#continue-practice").querySelector("span").textContent = state.retryMode
    ? "Back to round results"
    : state.roundComplete ? "View practice plan" : "Next question";
  if (!state.retryMode) $("#round-review").hidden = true;
}

async function renderRoundSummary() {
  try {
    const summary = await requestJson(`/api/sessions/${state.sessionId}?round=${state.roundNumber}`);
    state.retryFocus = summary.improvement_areas;
    const score = `${summary.correct_count} / ${QUESTIONS_PER_ROUND}`;
    $("#round-score").textContent = score;
    $("#round-score").classList.toggle("score-low", summary.correct_count < QUESTIONS_PER_ROUND);
    $("#round-score").classList.toggle("score-perfect", summary.correct_count === QUESTIONS_PER_ROUND);
    $("#round-feedback").textContent = summary.feedback;
    renderFocusSummary(summary.focus_stats);
    renderList("#improvement-list", summary.improvement_areas.map((area) => `Focus on ${area}.`));
    renderList("#next-steps-list", summary.next_steps);
    renderRoundResults(summary.items);
    $("#round-review").hidden = false;
    $("#stat-score").textContent = score;
    $("#stat-score").classList.toggle("score-low", summary.correct_count < QUESTIONS_PER_ROUND);
    $("#stat-score").classList.toggle("score-perfect", summary.correct_count === QUESTIONS_PER_ROUND);
    $("#stat-round").textContent = String(state.roundNumber).padStart(2, "0");
    $("#stat-improvements").textContent = summary.improvement_areas.length;
    $("#reset-copy").textContent = summary.improvement_areas.length
      ? `Your next round will focus on ${summary.improvement_areas.join(", ")}.`
      : "You got every question right. Choose another focus area for a fresh challenge.";
    renderRetryFocus(summary.improvement_areas.length ? summary.improvement_areas : state.setup.focus_areas);
  } catch (error) {
    $("#review-error").textContent = error.message;
  }
}

function renderFocusSummary(items) {
  const list = $("#focus-summary-list");
  list.replaceChildren();
  for (const item of items) {
    const entry = document.createElement("li");
    entry.className = item.correct < item.total ? "focus-needs-work" : "focus-mastered";
    entry.textContent = `${item.focus_area}: ${item.correct} / ${item.total} correct`;
    list.append(entry);
  }
}

function renderRoundResults(items) {
  const container = $("#round-results");
  container.replaceChildren();
  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = `recap-item ${item.is_correct ? "recap-correct" : "recap-incorrect"}`;
    const heading = document.createElement("div");
    heading.className = "recap-heading";
    const label = document.createElement("span");
    label.textContent = `Q${index + 1} · ${item.focus_area}`;
    const outcome = document.createElement("strong");
    outcome.textContent = item.is_correct ? "RIGHT" : "WRONG";
    heading.append(label, outcome);
    const question = document.createElement("p");
    question.className = "recap-question";
    question.textContent = item.question;
    const selected = document.createElement("p");
    selected.className = "recap-answer";
    selected.textContent = item.format === "open_ended"
      ? `Your response: ${item.candidate_answer}`
      : `Your choice: ${item.selected_option}. ${item.options[item.selected_option]}`;
    const correct = document.createElement("p");
    correct.className = "recap-answer";
    correct.textContent = item.format === "open_ended"
      ? `Reference approach: ${item.expected_answer}`
      : `Correct: ${item.correct_option}. ${item.options[item.correct_option]}`;
    const why = document.createElement("p");
    why.className = "recap-why";
    why.textContent = item.explanation;
    card.append(heading, question, selected, correct, why);
    if (item.format === "open_ended") {
      const score = document.createElement("p");
      score.className = "recap-answer";
      score.textContent = `Rubric score: ${item.score} / 100`;
      card.append(score);
      for (const point of item.strengths) {
        const strength = document.createElement("p");
        strength.className = "recap-why";
        strength.textContent = `Worked well: ${point}`;
        card.append(strength);
      }
      for (const point of item.growth_areas) {
        const growth = document.createElement("p");
        growth.className = "recap-why";
        growth.textContent = `To improve: ${point}`;
        card.append(growth);
      }
    }
    if (!item.is_correct && !item.intentional_retry) {
      const retry = document.createElement("button");
      retry.className = "retry-question button button-light";
      retry.type = "button";
      retry.textContent = "Retry this question";
      retry.addEventListener("click", () => retryQuestion(item.question_id));
      card.append(retry);
    }
    container.append(card);
  });
}

function renderRetryFocus(areas) {
  const container = $("#retry-focus-list");
  container.replaceChildren();
  for (const area of areas) {
    const tag = document.createElement("span");
    tag.className = "retry-focus-tag";
    tag.textContent = area;
    container.append(tag);
  }
}

function renderList(selector, items) {
  const list = $(selector);
  list.replaceChildren();
  for (const item of items) {
    const entry = document.createElement("li");
    entry.textContent = item;
    list.append(entry);
  }
}

$("#continue-practice").addEventListener("click", async () => {
  if (state.retryMode) {
    state.retryMode = false;
    state.question = state.previousQuestion;
    state.previousQuestion = null;
    $("#round-review").hidden = false;
    showStage("review");
    return;
  }
  if (state.roundComplete) {
    showStage("reset");
    return;
  }
  await makeQuestion();
});

async function retryQuestion(questionId) {
  try {
    const retry = await requestJson(`/api/sessions/${state.sessionId}/retry`, {
      method: "POST",
      body: JSON.stringify({ question_id: questionId, round_number: state.roundNumber }),
    });
    state.previousQuestion = state.question;
    state.question = retry;
    state.retryMode = true;
    state.hasReview = false;
    renderOptions(retry.options);
    $("#question-focus").textContent = retry.focus_area.toUpperCase();
    $("#question-type").textContent = retry.question_type.toUpperCase();
    $("#question-difficulty").textContent = retry.difficulty.toUpperCase();
    $("#question-text").textContent = retry.question;
    $("#question-index").textContent = `INTENTIONAL RETRY · ROUND ${state.roundNumber}`;
    $("#practice-error").textContent = "";
    $("#open-answer").value = "";
    $("#open-answer").readOnly = false;
    $("#review-answer").disabled = false;
    showStage("practice");
  } catch (error) {
    showToast(error.message);
  }
}

$("#reset-practice").addEventListener("click", async () => {
  state.roundNumber += 1;
  state.questionNumber = 0;
  state.question = null;
  state.roundComplete = false;
  state.hasReview = false;
  $("#round-review").hidden = true;
  await makeQuestion(state.retryFocus);
});

$("#edit-setup").addEventListener("click", () => {
  state.sessionId = null;
  state.question = null;
  state.roundComplete = false;
  state.hasReview = false;
  showStage("setup");
});

for (const link of document.querySelectorAll(".stage-link")) {
  link.addEventListener("click", () => {
    if (link.dataset.stage === "reset" && state.roundComplete) showStage("reset");
    else if (link.dataset.stage === "practice" && state.question) showStage("practice");
    else if (link.dataset.stage === "review" && state.hasReview) showStage("review");
    else if (link.dataset.stage === "setup") showStage("setup");
  });
}

let toastTimer;
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

$("#stage-back").addEventListener("click", () => {
  const activeStage = panels.find((stage) => !$(`#panel-${stage}`).hidden);
  const previousStage = {
    practice: state.retryMode ? "review" : "setup",
    review: state.roundComplete ? "practice" : "practice",
    reset: "review",
  }[activeStage];
  if (previousStage) showStage(previousStage);
});