const MAX_QUESTION_COUNT = Number(document.body.dataset.maxQuestionCount || 100);
const state = {
  sessionId: null,
  setup: null,
  question: null,
  questionNumber: 0,
  questionCount: 5,
  roundNumber: 1,
  hasReview: false,
  roundComplete: false,
  retryFocus: [],
  retryMode: false,
  previousQuestion: null,
};
const stages = ["setup", "practice", "review", "reset"];
const $ = (selector) => document.querySelector(selector);

function showStage(stage) {
  for (const name of stages) {
    const panel = $(`#panel-${name}`);
    panel.hidden = name !== stage;
    panel.classList.toggle("visible", name === stage);
    const link = $(`[data-stage="${name}"]`);
    link.classList.toggle("active", name === stage);
    link.disabled = !state.sessionId
      || (name === "practice" && !state.question)
      || (name === "review" && !state.hasReview)
      || (name === "reset" && !state.roundComplete);
    link.querySelector(".stage-state")?.remove();
    if (name === stage) link.insertAdjacentHTML("beforeend", '<span class="stage-state">NOW</span>');
  }
  const headings = {
    setup: ["STEP 01 / SET UP", "Build your practice"],
    practice: [`ROUND ${String(state.roundNumber).padStart(2, "0")} / PRACTICE`, "Choose the best answer"],
    review: ["ANSWER CHECK", state.roundComplete ? "Your readiness report" : "See how you did"],
    reset: ["PRACTICE AGAIN", "Choose what comes next"],
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

async function loadDashboard() {
  if (!$("#dashboard-sessions")) return;
  try {
    const data = await requestJson("/api/dashboard");
    $("#dashboard-sessions").textContent = data.session_count;
    $("#dashboard-attempted").textContent = data.attempted_count;
    $("#dashboard-accuracy").textContent = data.accuracy === null ? "—" : `${data.accuracy}%`;
    $("#recent-count").textContent = data.recent_sessions.length ? `${data.recent_sessions.length} RECENT` : "NO HISTORY";
    const list = $("#recent-session-list");
    list.replaceChildren();
    if (!data.recent_sessions.length) {
      const empty = document.createElement("p");
      empty.className = "dashboard-empty";
      empty.textContent = "Your practice sessions will show up here.";
      list.append(empty);
      return;
    }
    for (const session of data.recent_sessions) {
      const item = document.createElement("div");
      item.className = "recent-session";
      const role = document.createElement("strong");
      role.textContent = session.role;
      const detail = document.createElement("span");
      detail.textContent = session.accuracy === null
        ? `${session.attempted_count} of ${session.requested_question_count} answered · In progress`
        : `${session.attempted_count} of ${session.requested_question_count} answered · ${session.accuracy}% accuracy`;
      item.append(role, detail);
      list.append(item);
    }
  } catch {
    $("#recent-count").textContent = "UNAVAILABLE";
  }
}

$("#start-practice")?.addEventListener("click", () => {
  $("#setup-form").scrollIntoView({ behavior: "smooth", block: "start" });
  $("#role").focus({ preventScroll: true });
});

function setBusy(button, busy, label) {
  button.disabled = busy;
  const text = button.querySelector("span");
  if (text) text.textContent = busy ? label : (button.dataset.label || label);
}

function showSetupError(message) {
  const error = $("#setup-error");
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
  showToast(message);
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
    state.questionNumber = question.question_number;
    state.roundComplete = false;
    state.hasReview = false;
    state.retryMode = false;
    $("#question-focus").textContent = question.focus_area.toUpperCase();
    $("#question-index").textContent = `QUESTION ${state.questionNumber} OF ${state.questionCount}`;
    $("#question-text").textContent = question.question;
    $("#question-type").textContent = question.question_type.toUpperCase();
    $("#question-difficulty").textContent = question.difficulty.toUpperCase();
    $("#practice-error").textContent = "";
      const setupError = $("#setup-error");
      if (setupError) {
        setupError.hidden = true;
        setupError.textContent = "";
      }
    $("#review-error").textContent = "";
    $("#answer-explanation").hidden = true;
    $("#round-review").hidden = true;
    renderOptions(question.options);
    updateProgress();
    $("#session-count").textContent = `${state.questionNumber} / ${state.questionCount} QUESTIONS`;
    $("#continue-practice").querySelector("span").textContent = "Next Question";
    showStage("practice");
    return true;
  } catch (error) {
    if (state.sessionId && state.questionNumber === 0) {
      showSetupError(`Your session is saved, but its first question could not be loaded. ${error.message} Your selections are still here; retry below.`);
    } else {
      $("#practice-error").textContent = error.message;
    }
    return false;
  } finally {
    setBusy(button, false, "Next Question");
  }
}

function renderOptions(options) {
  const container = $("#answer-options");
  container.replaceChildren();
  $("#review-answer").disabled = true;
  for (const key of ["A", "B", "C", "D"]) {
    const label = document.createElement("label");
    label.className = "answer-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "selected-option";
    input.value = key;
    input.setAttribute("aria-label", `Option ${key}: ${options[key]}`);
    const letter = document.createElement("span");
    letter.className = "option-key";
    letter.textContent = key;
    const answer = document.createElement("span");
    answer.className = "option-text";
    answer.textContent = options[key];
    input.addEventListener("change", () => {
      $("#review-answer").disabled = false;
      for (const option of container.querySelectorAll(".answer-option")) option.classList.remove("is-selected");
      label.classList.add("is-selected");
      $("#practice-error").textContent = "";
    });
    label.append(input, letter, answer);
    container.append(label);
  }
}

function updateProgress() {
  const progress = document.querySelector('[role="progressbar"]');
  const completed = state.hasReview ? state.questionNumber : Math.max(0, state.questionNumber - 1);
  progress.setAttribute("aria-valuemax", String(state.questionCount));
  progress.setAttribute("aria-valuenow", String(completed));
  $("#progress-fill").style.width = `${state.questionCount ? (completed / state.questionCount) * 100 : 0}%`;
}

$("#role").addEventListener("change", () => {
  const isOther = $("#role").value === "Other";
  $("#other-role").hidden = !isOther;
  $("#other-role").required = isOther;
  refreshQuestionCapacity();
});

function selectedQuestionCount() {
  const selected = document.querySelector('input[name="question-count-choice"]:checked')?.value;
  return selected === "custom" ? Number($("#custom-count").value) : Number(selected);
}

let capacityRequest = 0;
async function refreshQuestionCapacity() {
  const role = $("#role").value === "Other" ? $("#other-role").value.trim() : $("#role").value;
  const experience = $("#experience").value;
  const interviewType = $("#interview-type").value;
  const focusAreas = [...document.querySelectorAll('input[name="focus"]:checked')].map((input) => input.value);
  const submitButton = $("#setup-form button[type='submit']");
  if (!role || !experience || !interviewType || !focusAreas.length) {
    submitButton.disabled = false;
    return;
  }
  const requestId = ++capacityRequest;
  try {
    const capacity = await requestJson("/api/question-capacity", {
      method: "POST",
      body: JSON.stringify({ role, experience, interview_type: interviewType, focus_areas: focusAreas }),
    });
    if (requestId !== capacityRequest) return;
    const note = $("#capacity-note");
    if (capacity.ai_generation_available) {
      note.textContent = `AI question generation is available. Request up to ${capacity.max_question_count} questions.`;
      note.classList.remove("capacity-warning");
      submitButton.disabled = false;
    } else {
      const requested = selectedQuestionCount();
      const exceedsCapacity = requested > capacity.available_question_count;
      note.textContent = exceedsCapacity
        ? `Only ${capacity.available_question_count} unseen questions match this setup. Choose Custom and enter ${capacity.available_question_count} or fewer.`
        : `${capacity.available_question_count} unseen MCQs match this setup.`;
      note.classList.toggle("capacity-warning", exceedsCapacity);
      submitButton.disabled = exceedsCapacity;
    }
  } catch {
    $("#capacity-note").textContent = "Question availability will be checked when the session starts.";
    submitButton.disabled = false;
  }
}

document.querySelectorAll('input[name="question-count-choice"]').forEach((input) => {
  input.addEventListener("change", () => {
    const custom = document.querySelector('input[name="question-count-choice"]:checked').value === "custom";
    $("#custom-count").hidden = !custom;
    $("#custom-count").required = custom;
    if (custom) $("#custom-count").focus();
    refreshQuestionCapacity();
  });
});

$("#custom-count").addEventListener("input", refreshQuestionCapacity);
$("#other-role").addEventListener("input", refreshQuestionCapacity);
$("#experience").addEventListener("change", refreshQuestionCapacity);
$("#interview-type").addEventListener("change", refreshQuestionCapacity);
document.querySelectorAll('input[name="focus"]').forEach((input) => input.addEventListener("change", refreshQuestionCapacity));

$("#setup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const questionCount = selectedQuestionCount();
  if (!Number.isSafeInteger(questionCount) || questionCount < 1 || questionCount > MAX_QUESTION_COUNT) {
    showSetupError(`Enter a whole number from 1 to ${MAX_QUESTION_COUNT}.`);
    return;
  }
  const button = event.submitter;
  button.dataset.label = button.querySelector("span").textContent;
  setBusy(button, true, "Setting up...");
  const selectedRole = $("#role").value;
  const setup = {
    role: selectedRole === "Other" ? $("#other-role").value.trim() : selectedRole,
    experience: $("#experience").value,
    interview_type: $("#interview-type").value,
    focus_areas: [...document.querySelectorAll('input[name="focus"]:checked')].map((input) => input.value),
    question_count: questionCount,
  };
  const setupError = $("#setup-error");
  if (setupError) {
    setupError.hidden = true;
    setupError.textContent = "";
  }
  try {
    const samePendingSetup = state.sessionId && !state.question && state.questionNumber === 0
      && state.setup?.role === setup.role
      && state.setup?.experience === setup.experience
      && state.setup?.interview_type === setup.interview_type
      && JSON.stringify(state.setup?.focus_areas) === JSON.stringify(setup.focus_areas)
      && state.questionCount === questionCount;
    if (samePendingSetup) {
      await makeQuestion();
      return;
    }
    const result = await requestJson("/api/sessions", { method: "POST", body: JSON.stringify(setup) });
    state.sessionId = result.session_id;
    state.setup = result.setup;
    state.questionCount = result.question_count;
    state.questionNumber = 0;
    state.roundNumber = 1;
    state.hasReview = false;
    state.roundComplete = false;
    state.retryFocus = [];
    state.retryMode = false;
    state.previousQuestion = null;
    state.startedAt = Date.now();
    await makeQuestion();
  } catch (error) {
    showSetupError(error.message);
  } finally {
    const buttonLabel = state.sessionId && !state.question ? "Retry first question" : "Start interview";
    setBusy(button, false, buttonLabel);
    button.dataset.label = buttonLabel;
    button.querySelector("span").textContent = buttonLabel;
  }
});

$("#review-answer").addEventListener("click", async (event) => {
  const selected = document.querySelector('input[name="selected-option"]:checked');
  if (!selected) {
    $("#practice-error").textContent = "Choose one option before checking your answer.";
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
        selected_option: selected.value,
        round_number: state.roundNumber,
      }),
    });
    state.hasReview = true;
    state.roundComplete = state.retryMode || state.questionNumber >= state.questionCount;
    renderAnswerReview(result);
    showStage("review");
    if (state.roundComplete && !state.retryMode) await renderRoundSummary();
  } catch (error) {
    $("#practice-error").textContent = error.message;
  } finally {
    setBusy(button, false, "Check Answer");
    button.disabled = state.hasReview;
  }
});

function renderAnswerReview(result) {
  const { review } = result;
  document.querySelectorAll('input[name="selected-option"]').forEach((input) => { input.disabled = true; });
  $("#review-answer").disabled = true;
  const verdict = $("#answer-verdict");
  verdict.classList.toggle("is-correct", review.is_correct);
  verdict.classList.toggle("is-incorrect", !review.is_correct);
  $("#verdict-mark").textContent = review.is_correct ? "✓" : "×";
  $("#verdict-label").textContent = review.is_correct ? "CORRECT ANSWER" : "ANSWER REVIEW";
  $("#verdict-title").textContent = review.is_correct ? "Correct answer!" : "Incorrect answer";
  $("#answer-score").textContent = "";
  $("#review-feedback").textContent = review.is_correct
    ? `You selected ${review.selected_option}: ${result.selected_text}`
    : `Your answer (${review.selected_option}) was incorrect. ${review.option_explanations[review.selected_option]}`;
  $("#answer-explanation-text").textContent = review.option_explanations[review.selected_option];
  $("#answer-comparison").textContent = review.is_correct
    ? `Why it is best: ${result.correct_text}`
    : `Correct answer: ${review.correct_option}. ${result.correct_text}. ${review.explanation}`;
  const rationaleList = $("#option-explanations");
  rationaleList.replaceChildren();
  document.querySelectorAll(".answer-option").forEach((option) => {
    const input = option.querySelector("input");
    const stateLabel = document.createElement("strong");
    stateLabel.className = "option-state";
    if (input.value === review.correct_option) {
      option.classList.add("is-correct");
      stateLabel.textContent = "✓ Correct answer";
      option.append(stateLabel);
    } else if (input.value === review.selected_option) {
      option.classList.add("is-incorrect");
      stateLabel.textContent = "× Your answer";
      option.append(stateLabel);
    }
  });
  for (const key of ["A", "B", "C", "D"]) {
    const item = document.createElement("li");
    const isCorrect = key === review.correct_option;
    const isSelected = key === review.selected_option;
    item.className = isCorrect ? "explanation-correct" : isSelected ? "explanation-incorrect" : "";
    const heading = document.createElement("strong");
    heading.textContent = `${key}${isSelected && !isCorrect ? " · Your answer" : isCorrect ? " · Correct" : ""}: `;
    item.append(heading, document.createTextNode(review.option_explanations[key]));
    rationaleList.append(item);
  }
  $("#answer-explanation").hidden = false;
  $("#review-progress").textContent = state.roundComplete
    ? "All requested answers are in. Your readiness report is ready."
    : `Question ${state.questionNumber} of ${state.questionCount} checked.`;
  $("#continue-practice").querySelector("span").textContent = state.retryMode
    ? "Back to Results"
    : state.roundComplete ? "View Results" : "Next Question";
  updateProgress();
}

async function renderRoundSummary() {
  try {
    const summary = await requestJson(`/api/sessions/${state.sessionId}?round=${state.roundNumber}`);
    state.retryFocus = summary.improvement_areas;
    const score = `${summary.correct_count} / ${summary.requested_question_count}`;
    $("#round-score").textContent = score;
    $("#round-score").classList.toggle("score-low", summary.accuracy < 60);
    $("#round-score").classList.toggle("score-perfect", summary.accuracy === 100);
    $("#result-attempted").textContent = summary.attempted_count;
    $("#result-correct").textContent = summary.correct_count;
    $("#result-incorrect").textContent = summary.incorrect_count;
    $("#result-accuracy").textContent = `${summary.accuracy}%`;
    $("#round-feedback").textContent = summary.feedback;
    renderFocusSummary(summary.focus_stats);
    renderList("#improvement-list", summary.improvement_areas.map((area) => `Focus on ${area}.`));
    renderList("#next-steps-list", summary.next_steps);
    renderRoundResults(summary.items);
    $("#round-review").hidden = false;
    $("#stat-score").textContent = score;
    $("#stat-score").classList.toggle("score-low", summary.accuracy < 60);
    $("#stat-score").classList.toggle("score-perfect", summary.accuracy === 100);
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
    selected.textContent = `Your choice: ${item.selected_option}. ${item.options[item.selected_option]}`;
    const correct = document.createElement("p");
    correct.className = "recap-answer";
    correct.textContent = `Correct: ${item.correct_option}. ${item.options[item.correct_option]}`;
    const explanation = document.createElement("p");
    explanation.className = "recap-why";
    explanation.textContent = item.explanation;
    card.append(heading, question, selected, correct, explanation);
    for (const [key, reason] of Object.entries(item.option_explanations || {})) {
      const detail = document.createElement("p");
      detail.className = "recap-why";
      detail.textContent = `${key}: ${reason}`;
      card.append(detail);
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
    state.hasReview = true;
    $("#round-review").hidden = false;
    showStage("review");
    return;
  }
  if (state.roundComplete) {
    $("#round-review").scrollIntoView({ behavior: "smooth", block: "start" });
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
    updateProgress();
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

$("#stage-back").addEventListener("click", () => {
  const activeStage = stages.find((stage) => !$(`#panel-${stage}`).hidden);
  const previousStage = { practice: "setup", review: "practice", reset: "review" }[activeStage];
  if (previousStage) showStage(previousStage);
});

let toastTimer;
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

loadDashboard();