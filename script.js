
const subjectSelect = document.getElementById("subject-select");
const timerDisplay = document.getElementById("timer-display");
const timerStatus = document.getElementById("timer-status");
const timerSubject = document.getElementById("timer-subject");
const startButton = document.getElementById("start-btn");
const finishButton = document.getElementById("finish-btn");

const totalStudyTime = document.getElementById("total-study-time");
const totalSessions = document.getElementById("total-sessions");
const goalProgress = document.getElementById("goal-progress");
const goalProgressBar = document.getElementById("goal-progress-bar");
const subjectSummary = document.getElementById("subject-summary");
const subjectTotalTime = document.getElementById("subject-total-time");
const weeklyChart = document.getElementById("weekly-chart");

const STORAGE_KEY = "focusflow-study-sessions-v1";
const DAILY_GOAL_SECONDS = 4 * 60 * 60;

let sessions = loadSessions();
let timerState = "idle";
let activeSubject = subjectSelect.value;
let sessionStartedAt = null;
let accumulatedSeconds = 0;
let ticker = null;

// Load saved sessions from this browser.
function loadSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

// Save completed sessions.
function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// Use local calendar dates, not UTC dates.
function getLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodaySessions() {
  const today = getLocalDate();

  return sessions.filter(session => session.date === today);
}

function getTodaySeconds() {
  return getTodaySessions().reduce(
    (total, session) => total + session.duration,
    0
  );
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${seconds}s`;
}

function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map(value => String(value).padStart(2, "0"))
    .join(":");
}

function getElapsedSeconds() {
  if (timerState !== "running" || sessionStartedAt === null) {
    return accumulatedSeconds;
  }

  const currentRunSeconds = Math.floor(
    (Date.now() - sessionStartedAt) / 1000
  );

  return accumulatedSeconds + Math.max(0, currentRunSeconds);
}

function updateTimerDisplay() {
  timerDisplay.textContent = formatClock(getElapsedSeconds());
  timerSubject.textContent = activeSubject;
}

function renderDashboard() {
  const todaySessions = getTodaySessions();
  const todaySeconds = getTodaySeconds();

  totalStudyTime.textContent = formatDuration(todaySeconds);
  totalSessions.textContent = todaySessions.length;
  goalProgress.textContent = formatDuration(todaySeconds);

  const goalPercent = Math.min(
    100,
    (todaySeconds / DAILY_GOAL_SECONDS) * 100
  );

  goalProgressBar.style.width = `${goalPercent}%`;

  renderSubjectSummary(todaySessions);
  renderWeeklyChart();
}

function renderSubjectSummary(todaySessions) {
  const totals = {};

  todaySessions.forEach(session => {
    totals[session.subject] =
      (totals[session.subject] || 0) + session.duration;
  });

  const subjects = Object.entries(totals).sort(
    (a, b) => b[1] - a[1]
  );

  const totalSeconds = subjects.reduce(
    (total, [, seconds]) => total + seconds,
    0
  );

  subjectTotalTime.textContent = formatDuration(totalSeconds);

  if (subjects.length === 0) {
    subjectSummary.innerHTML = `
      <div class="empty-state">
        <span>📚</span>
        <strong>Your study story starts here.</strong>
        <p>Complete a study session to see your subject-wise time.</p>
      </div>
    `;
    return;
  }

  const colors = [
    "#5865f2",
    "#8b5cf6",
    "#22c55e",
    "#f59e0b",
    "#ec4899",
    "#06b6d4",
    "#f97316",
    "#64748b"
  ];

  subjectSummary.innerHTML = subjects.map(
    ([subject, seconds], index) => {
      const percent = totalSeconds > 0
        ? (seconds / totalSeconds) * 100
        : 0;

      const color = colors[index % colors.length];

      return `
        <div class="subject-row">
          <div class="subject-name">
            <span class="subject-dot" style="background:${color}"></span>
            <span>${escapeHTML(subject)}</span>
          </div>

          <span class="subject-duration">
            ${formatDuration(seconds)}
          </span>

          <div class="subject-progress">
            <div
              class="subject-progress-fill"
              style="width:${percent}%;background:${color}"
            ></div>
          </div>
        </div>
      `;
    }
  ).join("");
}

function renderWeeklyChart() {
  const today = new Date();
  const days = [];

  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);

    const dateKey = getLocalDate(date);

    const seconds = sessions
      .filter(session => session.date === dateKey)
      .reduce((total, session) => total + session.duration, 0);

    days.push({
      dateKey,
      seconds,
      label: date.toLocaleDateString("en-US", {
        weekday: "short"
      }),
      isToday: offset === 0
    });
  }

  const maximumSeconds = Math.max(
    DAILY_GOAL_SECONDS,
    ...days.map(day => day.seconds)
  );

  weeklyChart.innerHTML = days.map(day => {
    const height = day.seconds > 0
      ? Math.max(4, (day.seconds / maximumSeconds) * 100)
      : 0;

    return `
      <div class="chart-day ${day.isToday ? "today" : ""}">
        <span class="chart-value">
          ${day.seconds > 0 ? formatDuration(day.seconds) : "—"}
        </span>

        <div class="chart-track">
          <div
            class="chart-bar"
            style="height:${height}%"
            title="${formatDuration(day.seconds)}"
          ></div>
        </div>

        <span class="chart-label">${day.label}</span>
      </div>
    `;
  }).join("");
}

// Prevent user-entered subject names from being treated as HTML.
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function startTicker() {
  if (ticker !== null) {
    clearInterval(ticker);
  }

  ticker = setInterval(updateTimerDisplay, 250);
}

function stopTicker() {
  if (ticker !== null) {
    clearInterval(ticker);
    ticker = null;
  }
}

function startSession() {
  if (timerState === "running") {
    // Pause the current session.
    accumulatedSeconds = getElapsedSeconds();
    sessionStartedAt = null;
    timerState = "paused";

    stopTicker();
    startButton.textContent = "▶ Resume session";
    timerStatus.textContent = "SESSION PAUSED";
    finishButton.disabled = false;
    updateTimerDisplay();
    return;
  }

  if (timerState === "idle") {
    activeSubject = subjectSelect.value;
    accumulatedSeconds = 0;
  }

  sessionStartedAt = Date.now();
  timerState = "running";

  subjectSelect.disabled = true;
  startButton.textContent = "Ⅱ Pause session";
  finishButton.disabled = false;
  timerStatus.textContent = "YOU'RE FOCUSED";

  updateTimerDisplay();
  startTicker();
}

function finishSession() {
  if (timerState === "idle") {
    return;
  }

  const duration = getElapsedSeconds();

  stopTicker();

  // Do not save accidental zero-second sessions.
  if (duration > 0) {
    const finishedAt = new Date();

    sessions.push({
      subject: activeSubject,
      duration,
      date: getLocalDate(finishedAt),
      finishedAt: finishedAt.toISOString()
    });

    saveSessions();
  }

 
resetTimer();
renderDashboard();
renderSessionHistory();

}

function resetTimer() {
  timerState = "idle";
  activeSubject = subjectSelect.value;
  sessionStartedAt = null;
  accumulatedSeconds = 0;

  subjectSelect.disabled = false;
  startButton.textContent = "▶ Start session";
  finishButton.disabled = true;
  timerStatus.textContent = "READY TO FOCUS";

  updateTimerDisplay();
}

subjectSelect.addEventListener("change", () => {
  if (timerState === "idle") {
    activeSubject = subjectSelect.value;
    updateTimerDisplay();
  }
});

startButton.addEventListener("click", startSession);
finishButton.addEventListener("click", finishSession);

document.addEventListener("visibilitychange", () => {
  if (timerState === "running") {
    updateTimerDisplay();
  }
});

// Initial dashboard.
updateTimerDisplay();
renderDashboard(); 

/* Custom Subject Feature */
const addSubjectForm = document.getElementById("add-subject-form");
const newSubjectInput = document.getElementById("new-subject-input");
const subjectMessage = document.getElementById("subject-message");


const CUSTOM_SUBJECTS_KEY = "focusflow-custom-subjects-v1";

function getCustomSubjects() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_SUBJECTS_KEY)) || [];
  } catch {
    return [];
  }
}

function loadCustomSubjects() {
  const customSubjects = getCustomSubjects();

  customSubjects.forEach((subject) => {
    const alreadyExists = Array.from(subjectSelect.options).some(
      (option) => option.value.toLowerCase() === subject.toLowerCase()
    );

    if (!alreadyExists) {
      const option = document.createElement("option");
      option.value = subject;
      option.textContent = subject;
      subjectSelect.appendChild(option);
    }
  });
}

addSubjectForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const subjectName = newSubjectInput.value.trim();

  if (!subjectName) {
    subjectMessage.textContent = "Please enter a subject name.";
    return;
  }

  const exists = Array.from(subjectSelect.options).some(
    (option) => option.value.toLowerCase() === subjectName.toLowerCase()
  );

  if (exists) {
    subjectMessage.textContent = "This subject already exists!";
    subjectMessage.style.color = "#dc2626";
    return;
  }

  const customSubjects = getCustomSubjects();
  customSubjects.push(subjectName);

  localStorage.setItem(
    CUSTOM_SUBJECTS_KEY,
    JSON.stringify(customSubjects)
  );

  const option = document.createElement("option");
  option.value = subjectName;
  option.textContent = subjectName;
  subjectSelect.appendChild(option);

  subjectSelect.value = subjectName;
  newSubjectInput.value = "";

  subjectMessage.textContent = `"${subjectName}" added successfully!`;
  subjectMessage.style.color = "#16a34a";
});

loadCustomSubjects(); 




/* Study History Feature with Delete */

const sessionHistory = document.getElementById("session-history");

function renderSessionHistory() {
  if (!sessionHistory) return;

  if (sessions.length === 0) {
    sessionHistory.innerHTML = `
      <div class="empty-state">
        <span>📖</span>
        <strong>No sessions yet</strong>
        <p>Your completed study sessions will appear here.</p>
      </div>
    `;
    return;
  }

  const recentSessions = sessions
    .map((session, index) => ({ ...session, originalIndex: index }))
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    .slice(0, 20);

  sessionHistory.innerHTML = recentSessions.map(session => {
    const date = new Date(session.finishedAt);
    const dateLabel = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
    const timeLabel = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit"
    });

    return `
      <div class="history-item">
        <div class="history-icon">📚</div>
        <div class="history-details">
          <strong>${escapeHTML(session.subject)}</strong>
          <span>${dateLabel} · ${timeLabel}</span>
        </div>
        <div class="history-duration">
          ${formatDuration(session.duration)}
        </div>
        <button
          type="button"
          class="history-delete-btn"
          data-index="${session.originalIndex}"
        >Delete</button>
      </div>
    `;
  }).join("");
}

sessionHistory.addEventListener("click", function(event) {
  const button = event.target.closest(".history-delete-btn");
  if (!button) return;

  const index = Number(button.dataset.index);
  if (!Number.isInteger(index) || index < 0 || index >= sessions.length) return;

  if (!confirm("Are you sure you want to delete this session?")) return;

  sessions.splice(index, 1);
  saveSessions();
  renderDashboard();
  renderSessionHistory();
});

renderSessionHistory();
