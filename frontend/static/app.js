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
  stage: "setup",
  questionStartedAt: 0,
  timeLimitSeconds: 0,
  timeExpired: false,
  submittingAnswer: false,
};
const stages = ["setup", "practice", "review", "reset"];
const $ = (selector) => document.querySelector(selector);
let questionTimer = null;

function showStage(stage) {
  state.stage = stage;
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

  function stopQuestionTimer() {
    if (questionTimer !== null) {
      clearInterval(questionTimer);
      questionTimer = null;
    }
  }

  function renderTimer(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    $("#timer-display").textContent = `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    $(".question-timer").classList.toggle("is-urgent", seconds <= 60);
  }

  function startQuestionTimer(question, preserveStart = false) {
    stopQuestionTimer();
    state.timeLimitSeconds = Number(question.time_limit_seconds) || 0;
    state.timeExpired = false;
    if (!preserveStart || !state.questionStartedAt) state.questionStartedAt = Date.now();
    if (!state.timeLimitSeconds) {
      renderTimer(0);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - state.questionStartedAt) / 1000);
      const remaining = Math.max(0, state.timeLimitSeconds - elapsed);
      renderTimer(remaining);
      if (remaining === 0) {
        state.timeExpired = true;
        stopQuestionTimer();
        submitAnswer(true);
      }
    };
    tick();
    if (!state.timeExpired) questionTimer = setInterval(tick, 250);
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

const pageHeadings = {
  dashboard: ["YOUR PREPARATION SPACE", "Dashboard"],
  hub: ["PREPARATION LIBRARY", "Prep Hub"],
  roadmap: ["A STRUCTURED PATH", "Learning Roadmap"],
  mock: ["TEXT-BASED PRACTICE", "Mock Interviews"],
  progress: ["SAVED WORKBOOK DATA", "Progress Tracker"],
  experiences: ["CANDIDATE STORIES", "Interview Experiences"],
  "topic-status": ["QUESTION BANK STATUS", "Topic status"],
};

function setView(view) {
  const workspace = $(".workspace");
  workspace.dataset.view = view;
  $(".sidebar").dataset.view = view;
  for (const page of document.querySelectorAll(".app-page")) {
    page.hidden = page.id !== `page-${view}`;
  }
  for (const link of document.querySelectorAll("[data-view-link]")) {
    link.classList.toggle("active", link.dataset.viewLink === view);
  }
  if (view === "practice") {
    showStage(state.stage || "setup");
    return;
  }
  const heading = pageHeadings[view];
  if (heading) {
    $("#stage-kicker").textContent = heading[0];
    $("#page-title").textContent = heading[1];
    $("#stage-back").hidden = true;
    $("#session-count").textContent = "YOUR PREPARATION SPACE";
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const responseText = await response.text();
  let data;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    const detail = responseText.trim().startsWith("<!doctype") || responseText.trim().startsWith("<html")
      ? "The server returned an HTML page instead of API data. Check that the app is running and sign in again."
      : "The server returned an unreadable response.";
    throw new Error(`${detail} (HTTP ${response.status})`);
  }
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("The server response was not JSON. Please reload the page and try again.");
  }
  return data;
}

async function loadDashboard() {
  if (!$("#dashboard-sessions")) return;
  try {
    const data = await requestJson("/api/dashboard");
    $("#dashboard-sessions").textContent = data.session_count;
    $("#dashboard-attempted").textContent = data.attempted_count;
    $("#dashboard-accuracy").textContent = data.accuracy === null ? "—" : `${data.accuracy}%`;
    $("#progress-attempted").textContent = data.attempted_count;
    $("#progress-accuracy").textContent = data.accuracy === null ? "—" : `${data.accuracy}%`;
    $("#progress-completed").textContent = data.completed_session_count || 0;
    renderTopicPerformance(data.topic_stats || []);
    renderRecentActivity(data.recent_sessions || []);
    $("#recent-count").textContent = data.recent_sessions.length ? `${data.recent_sessions.length} RECENT` : "NO HISTORY";
    const list = $("#recent-session-list");
    list.replaceChildren();
    if (!data.recent_sessions.length) {
      const empty = document.createElement("p");
      empty.className = "dashboard-empty";
      empty.textContent = "Your preparation journey starts here.";
      list.append(empty);
      return;
    }
    for (const session of data.recent_sessions) {
      const item = document.createElement("div");
      item.className = "recent-session";
      const role = document.createElement("strong");
      role.textContent = session.role;
      const detail = document.createElement("span");
      const date = formatDate(session.created_at);
      detail.textContent = session.completed
        ? `Attempt ${session.attempt_number} · ${date} · ${session.accuracy}% · Grade ${session.grade}`
        : `${session.attempted_count} of ${session.requested_question_count} answered · In progress · ${date}`;
      item.append(role, detail);
      list.append(item);
    }
  } catch (error) {
    $("#recent-count").textContent = "UNAVAILABLE";
    $("#dashboard-accuracy").textContent = "Unavailable";
    $("#progress-accuracy").textContent = "Unavailable";
    showToast(`Saved progress could not be loaded: ${error.message}`);
  }
}

function renderTopicPerformance(topics) {
  const container = $("#topic-performance");
  container.replaceChildren();
  if (!topics.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No reviewed topic data yet.";
    container.append(empty);
    return;
  }
  for (const topic of topics) {
    const row = document.createElement("div");
    row.className = "topic-performance-row";
    const label = document.createElement("span");
    label.textContent = topic.focus_area;
    const track = document.createElement("div");
    track.className = "topic-progress-track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", `${topic.focus_area} accuracy`);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    const fill = document.createElement("span");
    const accuracy = topic.total ? Math.round(100 * topic.correct / topic.total) : 0;
    fill.style.width = `${accuracy}%`;
    track.setAttribute("aria-valuenow", String(accuracy));
    track.append(fill);
    const score = document.createElement("strong");
    score.textContent = `${topic.correct}/${topic.total} · ${accuracy}%`;
    row.append(label, track, score);
    container.append(row);
  }
}

function renderRecentActivity(sessions) {
  const container = $("#progress-activity");
  container.replaceChildren();
  if (!sessions.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No practice sessions saved yet.";
    container.append(empty);
    return;
  }
  for (const session of sessions) {
    const row = document.createElement("div");
    row.className = "activity-row";
    const role = document.createElement("strong");
    role.textContent = session.role;
    const detail = document.createElement("span");
    detail.textContent = session.completed
      ? `Attempt ${session.attempt_number} · ${formatDate(session.created_at)} · ${session.accuracy}% · Grade ${session.grade}`
      : `${session.attempted_count}/${session.requested_question_count} answered · In progress · ${formatDate(session.created_at)}`;
    row.append(role, detail);
    container.append(row);
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString();
}

async function loadTopicAvailability() {
  const source = $("#dashboard-topics");
  const destination = $("#hub-topics");
  destination.replaceChildren(...[...source.children].map((card) => card.cloneNode(true)));
  try {
    const data = await requestJson("/api/topics");
    const counts = new Map(data.topics.map((topic) => [topic.focus_area, topic.available_question_count]));
    for (const label of document.querySelectorAll("[data-count-focus]")) {
      const count = counts.get(label.dataset.countFocus);
      label.textContent = count === undefined
        ? "Availability not reported"
        : count > 0 ? `${count} matching questions available` : "No matching questions yet";
      label.classList.toggle("is-muted", count === undefined || count === 0);
    }
    const hubTopics = new Set([...destination.querySelectorAll(".topic-card")].map((card) => card.dataset.topicName));
    for (const topic of data.topics) {
      if (hubTopics.has(topic.topic) || topic.topic === "Data Structures and Algorithms" || topic.available_question_count === 0) continue;
      const card = document.createElement("article");
      card.className = "topic-card";
      card.dataset.topicName = topic.topic;
      card.dataset.topicFocus = topic.focus_area;
      const icon = document.createElement("span");
      icon.className = "topic-icon";
      icon.textContent = "◈";
      const title = document.createElement("h4");
      title.textContent = topic.topic;
      const description = document.createElement("p");
      description.textContent = `${topic.topic} questions from the curated practice bank.`;
      const count = document.createElement("span");
      count.className = "topic-count";
      count.textContent = `${topic.available_question_count} matching questions available`;
      const practice = document.createElement("button");
      practice.type = "button";
      practice.className = "topic-action";
      practice.dataset.topicPractice = "";
      practice.textContent = "Practise topic →";
      const status = document.createElement("button");
      status.type = "button";
      status.className = "topic-action";
      status.dataset.topicStatus = "";
      status.textContent = "View topic status →";
      card.append(icon, title, description, count, practice, status);
      destination.append(card);
    }
    for (const card of document.querySelectorAll(".topic-card")) {
      if (!card.querySelector("[data-topic-status]")) {
        const status = document.createElement("button");
        status.type = "button";
        status.className = "topic-action";
        status.dataset.topicStatus = "";
        status.textContent = "View topic status →";
        card.append(status);
      }
    }
    for (const topic of data.topics) {
      if (topic.topic !== "Data Structures and Algorithms") ensureFocusInput(topic.focus_area);
    }
    const dsaCard = destination.querySelector('[data-topic-status-name="Data Structures and Algorithms"]');
    if (dsaCard) {
      const dsa = data.topics.find((topic) => topic.topic === "Data Structures and Algorithms");
      const label = dsaCard.querySelector(".topic-count");
      if (dsa && label) {
        label.textContent = dsa.available_question_count
          ? `${dsa.available_question_count} matching questions available`
          : "No matching questions yet";
        label.classList.toggle("is-muted", !dsa.available_question_count);
        dsaCard.dataset.topicStatusName = dsa.topic;
      }
    }
  } catch (error) {
    for (const label of document.querySelectorAll("[data-count-focus]")) {
      label.textContent = "Availability unavailable";
      label.classList.add("is-muted");
    }
    showToast(`Topic availability could not be loaded: ${error.message}`);
  }
}

function ensureFocusInput(focusArea) {
  const options = $(".focus-options");
  if ([...options.querySelectorAll('input[name="focus"]')].some((input) => input.value === focusArea)) return;
  const label = document.createElement("label");
  label.className = "focus-option";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = "focus";
  input.value = focusArea;
  input.addEventListener("change", refreshQuestionCapacity);
  const text = document.createElement("span");
  text.textContent = focusArea;
  label.append(input, text);
  options.append(label);
}

async function openTopicStatus(topicName) {
  try {
    const topic = await requestJson(`/api/topics/${encodeURIComponent(topicName)}`);
    $("#topic-status-title").textContent = topic.topic;
    $("#topic-status-description").textContent = topic.available_question_count
      ? `${topic.available_question_count} matching multiple-choice questions are available in the current curated bank.`
      : "No matching questions are available yet. You can return to the Prep Hub to explore another topic.";
    $("#topic-status-count").textContent = topic.available_question_count;
    for (const difficulty of ["easy", "medium", "hard"]) {
      $(`#topic-status-${difficulty}`).textContent = topic.difficulty_counts[difficulty[0].toUpperCase() + difficulty.slice(1)] || 0;
    }
    const questions = $("#topic-status-questions");
    questions.replaceChildren();
    for (const item of topic.question_titles) {
      const row = document.createElement("p");
      row.className = "topic-question-preview";
      row.textContent = item.subtopic ? `${item.subtopic}: ${item.question}` : item.question;
      questions.append(row);
    }
    if (!topic.question_titles.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "There are no question previews for this topic yet.";
      questions.append(empty);
    }
    const reference = $("#topic-reference");
    reference.hidden = !topic.reference_url;
    if (topic.reference_url) reference.href = topic.reference_url;
    const practice = $("#topic-status-practice");
    practice.dataset.topicFocusAreas = JSON.stringify(topic.practice_focus_areas || []);
    practice.disabled = !topic.available_question_count || !topic.practice_focus_areas?.length;
    setView("topic-status");
  } catch (error) {
    showToast(`Topic status could not be loaded: ${error.message}`);
  }
}

const checklistProgress = {
  roadmapCompleted: new Set(),
  plannerCompleted: new Set(),
  plannerDate: "",
};
const userScope = document.body.dataset.userScope || "local";
const csrfToken = document.body.dataset.csrfToken || "";
const roadmapTopicGroups = {
  "arrays-strings": ["Arrays", "Strings"],
  "search-sort": ["Sorting", "Binary Search"],
  "hashing-lists": ["Hashing", "Linked Lists"],
  "stacks-recursion": ["Stacks and Queues", "Recursion and Backtracking"],
  "trees-heaps-graphs": ["Trees and Binary Search Trees", "Heaps", "Graphs"],
  "greedy-dp": ["Greedy Algorithms", "Dynamic Programming"],
  oop: ["Object-Oriented Programming"],
  databases: ["Database Management Systems"],
  "operating-systems": ["Operating Systems"],
  networks: ["Computer Networks"],
};

function localPlannerDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function readLegacyChecklist(key) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      throw new TypeError("Saved checklist data has an unexpected format.");
    }
    return parsed;
  } catch (error) {
    showToast(`Previous browser checklist data could not be migrated: ${error.message}`);
    return null;
  }
}

function setChecklistControlsDisabled(disabled) {
  for (const control of document.querySelectorAll("[data-roadmap-complete], [data-planner-task], #reset-planner")) {
    control.disabled = disabled;
  }
}

function renderRoadmapProgress() {
  const completed = checklistProgress.roadmapCompleted;
  const rows = document.querySelectorAll("[data-roadmap-id]");
  for (const row of rows) {
    const topicNames = roadmapTopicGroups[row.dataset.roadmapId] || [];
    const content = row.querySelector("h4")?.parentElement;
    if (content) {
      for (const stale of content.querySelectorAll("button")) stale.remove();
      const actions = document.createElement("div");
      actions.className = "roadmap-actions";
      for (const topicName of topicNames) {
        const practice = document.createElement("button");
        practice.type = "button";
        practice.dataset.roadmapPractice = topicName;
        practice.textContent = `Practise ${topicName}`;
        actions.append(practice);
        const status = document.createElement("button");
        status.type = "button";
        status.dataset.roadmapStatus = topicName;
        status.textContent = "Topic status";
        actions.append(status);
      }
      const existingButtons = [...row.querySelectorAll("button")];
      for (const button of existingButtons) actions.append(button);
      if (topicNames.length) {
        const description = content.querySelector("p");
        if (description) description.textContent = "Check current coverage or practise questions from this topic.";
      }
      row.append(actions);
    }
    const isComplete = completed.has(row.dataset.roadmapId);
    row.classList.toggle("is-complete", isComplete);
    const button = row.querySelector("[data-roadmap-complete]");
    if (button) {
      const overview = button.textContent.toLocaleLowerCase().includes("overview");
      button.textContent = isComplete ? "Completed · undo" : overview ? "Mark overview complete" : "Mark complete";
    }
  }
  $("#roadmap-completed").textContent = String(completed.size);
  $("#roadmap-progress-fill").style.width = `${rows.length ? Math.min(100, 100 * completed.size / rows.length) : 0}%`;
}

function initializePlanner() {
  for (const input of document.querySelectorAll("[data-planner-task]")) {
    input.checked = checklistProgress.plannerCompleted.has(input.dataset.plannerTask);
    input.addEventListener("change", async () => {
      const previous = new Set(checklistProgress.plannerCompleted);
      if (input.checked) checklistProgress.plannerCompleted.add(input.dataset.plannerTask);
      else checklistProgress.plannerCompleted.delete(input.dataset.plannerTask);
      setChecklistControlsDisabled(true);
      try {
        await requestJson("/api/user-progress/planner", {
          method: "PUT",
          headers: { "X-CSRF-Token": csrfToken },
          body: JSON.stringify({
            date: checklistProgress.plannerDate,
            completed: [...checklistProgress.plannerCompleted],
          }),
        });
      } catch (error) {
        checklistProgress.plannerCompleted = previous;
        input.checked = previous.has(input.dataset.plannerTask);
        showToast(`Planner progress could not be saved: ${error.message}`);
      } finally {
        setChecklistControlsDisabled(false);
      }
    });
  }
}

async function loadChecklistProgress() {
  const plannerDate = localPlannerDate();
  try {
    const saved = await requestJson(`/api/user-progress?date=${encodeURIComponent(plannerDate)}`);
    checklistProgress.roadmapCompleted = new Set(saved.roadmap_completed);
    checklistProgress.plannerCompleted = new Set(saved.planner_completed);
    checklistProgress.plannerDate = saved.date;
    const roadmapKey = `interviewready-roadmap-completed-${userScope}`;
    const plannerKey = `interviewready-planner-${userScope}-${plannerDate}`;
    const legacyRoadmap = readLegacyChecklist(roadmapKey);
    const legacyPlanner = readLegacyChecklist(plannerKey);
    let migrated = false;
    if (legacyRoadmap && legacyRoadmap.length) {
      const combined = new Set([...checklistProgress.roadmapCompleted, ...legacyRoadmap]);
      const completed = [...combined];
      await requestJson("/api/user-progress/roadmap", {
        method: "PUT",
        headers: { "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ completed }),
      });
      checklistProgress.roadmapCompleted = combined;
      localStorage.removeItem(roadmapKey);
      migrated = true;
    } else if (legacyRoadmap) {
      localStorage.removeItem(roadmapKey);
    }
    if (legacyPlanner && legacyPlanner.length) {
      const combined = new Set([...checklistProgress.plannerCompleted, ...legacyPlanner]);
      const completed = [...combined];
      await requestJson("/api/user-progress/planner", {
        method: "PUT",
        headers: { "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ date: plannerDate, completed }),
      });
      checklistProgress.plannerCompleted = combined;
      localStorage.removeItem(plannerKey);
      migrated = true;
    } else if (legacyPlanner) {
      localStorage.removeItem(plannerKey);
    }
    renderRoadmapProgress();
    initializePlanner();
    setChecklistControlsDisabled(false);
    if (migrated) showToast("Previous browser checklist progress was saved to your account.");
  } catch (error) {
    showToast(`Account checklist progress could not be loaded or migrated: ${error.message}`);
  }
}

function navigateToView(view) {
  setView(view);
  if (view === "practice") {
    $("#setup-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function configurePractice({ focusAreas = [], interviewType = "Mixed practice", difficulty = "" } = {}) {
  if (!focusAreas.length) focusAreas = ["Communication", "Problem solving", "Technical depth"];
  if (!$("#role").value) $("#role").value = "Software engineer";
  if (!$("#experience").value) $("#experience").value = "Mid-level (4-7 years)";
  $("#interview-type").value = interviewType;
  $("#difficulty").value = difficulty;
  for (const focus of focusAreas) ensureFocusInput(focus);
  for (const input of document.querySelectorAll('input[name="focus"]')) {
    input.checked = focusAreas.includes(input.value);
  }
  navigateToView("practice");
  refreshQuestionCapacity();
}

for (const link of document.querySelectorAll("[data-view-link]")) {
  link.addEventListener("click", () => navigateToView(link.dataset.viewLink));
}

document.querySelector("[data-home-link]")?.addEventListener("click", (event) => {
  event.preventDefault();
  setView("dashboard");
});

document.addEventListener("click", async (event) => {
  const topicButton = event.target.closest("[data-topic-practice]");
  if (topicButton) {
    const card = topicButton.closest("[data-topic-focus]");
    if (card) configurePractice({ focusAreas: [card.dataset.topicFocus] });
    return;
  }
  const statusButton = event.target.closest("[data-topic-status]");
  if (statusButton) {
    const card = statusButton.closest("[data-topic-name]");
    if (card) openTopicStatus(card.dataset.topicStatusName || card.dataset.topicFocus || card.dataset.topicName);
    return;
  }
  const unavailableButton = event.target.closest("[data-topic-unavailable]");
  if (unavailableButton) {
    const card = unavailableButton.closest("[data-topic-name]");
    setView("hub");
    $("#topic-search").value = card.dataset.topicName;
    $("#topic-search").dispatchEvent(new Event("input"));
    showToast(`No matching curated questions are available for ${card.dataset.topicName} yet.`);
    return;
  }
  const mockButton = event.target.closest("[data-mock-type]");
  if (mockButton) {
    configurePractice({
      interviewType: mockButton.dataset.mockType,
      focusAreas: mockButton.dataset.mockFocus ? [mockButton.dataset.mockFocus] : [],
    });
    return;
  }
  const roadmapPractice = event.target.closest("[data-roadmap-practice]");
  if (roadmapPractice) {
    const focus = roadmapPractice.dataset.roadmapPractice;
    configurePractice({
      focusAreas: [focus],
      interviewType: focus === "Communication" ? "Behavioral" : "Technical",
    });
    return;
  }
  const roadmapStatus = event.target.closest("[data-roadmap-status]");
  if (roadmapStatus) {
    openTopicStatus(roadmapStatus.dataset.roadmapStatus);
    return;
  }
  const completeButton = event.target.closest("[data-roadmap-complete]");
  if (completeButton) {
    const previous = new Set(checklistProgress.roadmapCompleted);
    const id = completeButton.dataset.roadmapComplete;
    if (checklistProgress.roadmapCompleted.has(id)) checklistProgress.roadmapCompleted.delete(id);
    else checklistProgress.roadmapCompleted.add(id);
    renderRoadmapProgress();
    setChecklistControlsDisabled(true);
    try {
      await requestJson("/api/user-progress/roadmap", {
        method: "PUT",
        headers: { "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ completed: [...checklistProgress.roadmapCompleted] }),
      });
    } catch (error) {
      checklistProgress.roadmapCompleted = previous;
      renderRoadmapProgress();
      showToast(`Roadmap progress could not be saved: ${error.message}`);
    } finally {
      setChecklistControlsDisabled(false);
    }
  }
});

$("#topic-status-practice").addEventListener("click", (event) => {
  const focusAreas = JSON.parse(event.currentTarget.dataset.topicFocusAreas || "[]");
  if (!Array.isArray(focusAreas) || !focusAreas.length) {
    showToast("No practice focus is available for this topic yet.");
    return;
  }
  const interviewType = focusAreas.includes("Communication") ? "Behavioral" : "Technical";
  configurePractice({ focusAreas, interviewType });
});

$("#topic-search").addEventListener("input", () => {
  const query = $("#topic-search").value.trim().toLocaleLowerCase();
  let visibleCount = 0;
  for (const card of document.querySelectorAll("#hub-topics .topic-card")) {
    const matches = card.dataset.topicName.toLocaleLowerCase().includes(query)
      || card.textContent.toLocaleLowerCase().includes(query);
    card.hidden = !matches;
    visibleCount += Number(matches);
  }
  $("#hub-empty").hidden = visibleCount > 0;
});

$("#reset-planner").addEventListener("click", async () => {
  const previous = new Set(checklistProgress.plannerCompleted);
  checklistProgress.plannerCompleted.clear();
  for (const input of document.querySelectorAll("[data-planner-task]")) input.checked = false;
  setChecklistControlsDisabled(true);
  try {
    await requestJson("/api/user-progress/planner", {
      method: "PUT",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ date: checklistProgress.plannerDate, completed: [] }),
    });
    showToast("Today's planner checklist has been reset.");
  } catch (error) {
    checklistProgress.plannerCompleted = previous;
    for (const input of document.querySelectorAll("[data-planner-task]")) {
      input.checked = previous.has(input.dataset.plannerTask);
    }
    showToast(`Planner progress could not be reset: ${error.message}`);
  } finally {
    setChecklistControlsDisabled(false);
  }
});

$("#start-practice")?.addEventListener("click", () => {
  setView("practice");
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
    startQuestionTimer(question);
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
  const difficulty = $("#difficulty").value;
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
      body: JSON.stringify({ role, experience, interview_type: interviewType, focus_areas: focusAreas, difficulty }),
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
$("#difficulty").addEventListener("change", refreshQuestionCapacity);
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
    difficulty: $("#difficulty").value,
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
      && state.setup?.difficulty === setup.difficulty
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

$("#review-answer").addEventListener("click", () => submitAnswer(state.timeExpired));

async function submitAnswer(timedOut) {
  if (state.submittingAnswer || state.hasReview || !state.question) return;
  const selected = document.querySelector('input[name="selected-option"]:checked');
  if (!selected && !timedOut) {
    $("#practice-error").textContent = "Choose one option before checking your answer.";
    return;
  }
  const button = $("#review-answer");
  state.submittingAnswer = true;
  $("#practice-error").textContent = "";
  button.dataset.label = button.querySelector("span").textContent;
  setBusy(button, true, timedOut ? "Saving timeout..." : "Checking answer...");
  stopQuestionTimer();
  const elapsedSeconds = Math.min(
    state.timeLimitSeconds,
    Math.floor((Date.now() - state.questionStartedAt) / 1000),
  );
  try {
    const result = await requestJson(`/api/sessions/${state.sessionId}/reviews`, {
      method: "POST",
      body: JSON.stringify({
        question_id: state.question.question_id,
        selected_option: selected?.value || "",
        round_number: state.roundNumber,
        elapsed_seconds: timedOut ? state.timeLimitSeconds : elapsedSeconds,
        timed_out: timedOut,
      }),
    });
    state.timeExpired = timedOut;
    state.hasReview = true;
    state.roundComplete = state.retryMode || state.questionNumber >= state.questionCount;
    renderAnswerReview(result);
    showStage("review");
    if (state.roundComplete && !state.retryMode) await renderRoundSummary();
  } catch (error) {
    $("#practice-error").textContent = error.message;
    if (timedOut) {
      state.timeExpired = true;
      renderTimer(0);
    } else {
      startQuestionTimer(state.question, true);
    }
  } finally {
    setBusy(button, false, "Check Answer");
    button.disabled = state.hasReview;
    state.submittingAnswer = false;
  }
}

function renderAnswerReview(result) {
  const { review } = result;
  document.querySelectorAll('input[name="selected-option"]').forEach((input) => { input.disabled = true; });
  $("#review-answer").disabled = true;
  const verdict = $("#answer-verdict");
  verdict.classList.toggle("is-correct", review.is_correct);
  verdict.classList.toggle("is-incorrect", !review.is_correct);
  $("#verdict-mark").textContent = review.is_correct ? "✓" : "×";
  $("#verdict-label").textContent = review.timed_out ? "TIME EXPIRED" : review.is_correct ? "CORRECT ANSWER" : "ANSWER REVIEW";
  $("#verdict-title").textContent = review.timed_out ? "Time is up" : review.is_correct ? "Correct answer!" : "Incorrect answer";
  $("#answer-score").textContent = "";
  $("#review-feedback").textContent = review.timed_out
    ? "The timer expired before an answer was submitted. This question is recorded as incorrect."
    : review.is_correct
    ? `You selected ${review.selected_option}: ${result.selected_text}`
    : `Your answer (${review.selected_option}) was incorrect. ${review.option_explanations[review.selected_option]}`;
  $("#answer-explanation-text").textContent = review.timed_out
    ? review.explanation
    : review.option_explanations[review.selected_option];
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
    $("#result-grade").textContent = summary.grade || "—";
    $("#candidate-result").textContent = [
      summary.full_name,
      summary.attempt_number ? `Attempt ${summary.attempt_number}` : "",
      formatDate(summary.created_at),
    ].filter(Boolean).join(" · ");
    $("#result-attempted").textContent = summary.attempted_count;
    $("#result-correct").textContent = summary.correct_count;
    $("#result-incorrect").textContent = summary.incorrect_count;
    $("#result-accuracy").textContent = `${summary.accuracy}%`;
    $("#round-feedback").textContent = summary.feedback;
    $("#performance-feedback").textContent = summary.performance_feedback;
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
    selected.textContent = item.timed_out
      ? "Your choice: Time expired."
      : `Your choice: ${item.selected_option}. ${item.options[item.selected_option]}`;
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
    startQuestionTimer(retry);
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

setView("dashboard");
setChecklistControlsDisabled(true);
loadChecklistProgress();
loadDashboard();
loadTopicAvailability();