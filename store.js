/* ============================================================
   Learning OS — хранилище прогресса
   Всё живёт в localStorage браузера. Никакого сервера.
   ============================================================ */

const Store = (() => {
  const KEY = "learning-os-v1";
  const INTERVALS = [1, 2, 4, 7, 15];
  let s = null;

  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayKey = () => fmt(new Date());
  const monthKey = () => todayKey().slice(0, 7);

  function blank() {
    return {
      version: 1,
      name: LOS.meta.name,
      startDate: LOS.meta.startDate,
      days: {},
      journal: {},
      cards: {},
      achievements: {},
      freezes: {},
      log: {},
      ui: {}
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      s = raw ? JSON.parse(raw) : blank();
    } catch (e) {
      s = blank();
    }
    if (!s || typeof s !== "object") s = blank();
    s.days = s.days || {};
    s.journal = s.journal || {};
    s.cards = s.cards || {};
    s.achievements = s.achievements || {};
    s.freezes = s.freezes || {};
    s.log = s.log || {};
    s.ui = s.ui || {};
    if (!s.startDate) s.startDate = LOS.meta.startDate;
    return s;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {
      console.warn("Не удалось сохранить прогресс", e);
    }
  }

  function state() { return s; }

  /* ---------- Дни ---------- */

  function day(i) {
    const k = String(i);
    if (!s.days[k]) {
      s.days[k] = { tasks: {}, closed: false, minimal: false, focus: 0 };
    }
    return s.days[k];
  }

  function peekDay(i) { return s.days[String(i)]; }

  function toggleTask(i, id) {
    const d = day(i);
    if (d.closed) return;
    d.tasks[id] = !d.tasks[id];
    save();
  }

  function setTask(i, id, value) {
    const d = day(i);
    if (d.closed) return;
    d.tasks[id] = !!value;
    save();
  }

  function allDone(i) {
    const d = day(i);
    return LOS.tasks.every((t) => !!d.tasks[t.id]);
  }

  function xpOfDay(i) {
    const d = peekDay(i);
    if (!d) return 0;
    let xp = 0;
    if (d.minimal) {
      xp = LOS.minimalXp;
    } else {
      LOS.tasks.forEach((t) => { if (d.tasks[t.id]) xp += t.xp; });
      if (LOS.tasks.every((t) => d.tasks[t.id])) xp += LOS.bonusXp;
    }
    xp += Math.min(d.focus || 0, LOS.focusCap) * LOS.focusXp;
    return xp;
  }

  function totalXp() {
    return Object.keys(s.days).reduce((sum, k) => sum + xpOfDay(Number(k)), 0);
  }

  function needFor(level) {
    if (level <= 10) return 300;
    if (level <= 20) return 600;
    if (level <= 30) return 1000;
    return 1500;
  }

  function levelInfo(xp) {
    const total = xp == null ? totalXp() : xp;
    let level = 1;
    let acc = 0;
    while (level < 40 && total >= acc + needFor(level)) {
      acc += needFor(level);
      level += 1;
    }
    const need = needFor(level);
    return {
      level,
      into: Math.max(0, total - acc),
      need,
      floor: acc,
      pct: Math.min(100, Math.round(((total - acc) / need) * 100))
    };
  }

  function currentIndex() {
    for (let i = 0; i < LOS.meta.totalDays; i++) {
      const d = peekDay(i);
      if (!d || !d.closed) return i;
    }
    return LOS.meta.totalDays - 1;
  }

  function weekOf(i) { return Math.floor(i / 6) + 1; }
  function dayInWeekOf(i) { return (i % 6) + 1; }

  function closeDay(i, minimal) {
    const d = day(i);
    if (d.closed) return false;
    if (!minimal && !allDone(i)) return false;
    d.closed = true;
    d.minimal = !!minimal;
    if (minimal) d.tasks = {};
    const k = todayKey();
    if (!s.log[k]) s.log[k] = { day: i, closed: true, frozen: false };
    else { s.log[k].closed = true; s.log[k].day = i; }
    save();
    return true;
  }

  function addFocus() {
    const i = currentIndex();
    const d = day(i);
    if (d.closed) return false;
    if ((d.focus || 0) >= LOS.focusCap) return false;
    d.focus = (d.focus || 0) + 1;
    save();
    return true;
  }

  /* ---------- Streak ---------- */

  function dateShift(key, delta) {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta);
    return fmt(dt);
  }

  function streak() {
    let count = 0;
    let cur = todayKey();
    const todayRec = s.log[cur];
    if (!todayRec || (!todayRec.closed && !todayRec.frozen)) cur = dateShift(cur, -1);
    for (let guard = 0; guard < 2000; guard++) {
      const rec = s.log[cur];
      if (rec && (rec.closed || rec.frozen)) {
        count += 1;
        cur = dateShift(cur, -1);
      } else {
        break;
      }
    }
    return count;
  }

  function freezesUsed() { return s.freezes[monthKey()] || 0; }
  function freezesLeft() { return Math.max(0, 2 - freezesUsed()); }

  function canFreeze() {
    if (freezesLeft() <= 0) return false;
    const y = dateShift(todayKey(), -1);
    const rec = s.log[y];
    return !rec || (!rec.closed && !rec.frozen);
  }

  function useFreeze() {
    if (!canFreeze()) return false;
    const y = dateShift(todayKey(), -1);
    s.log[y] = { day: null, closed: false, frozen: true };
    s.freezes[monthKey()] = freezesUsed() + 1;
    save();
    return true;
  }

  /* ---------- Карточки ---------- */

  function cardState(id) {
    if (!s.cards[id]) s.cards[id] = { box: 1, due: todayKey(), reps: 0 };
    return s.cards[id];
  }

  function dueCards() {
    const today = todayKey();
    const week = weekOf(currentIndex());
    return LOS.cards.filter((c) => {
      if (c.w && c.w > week) return false;
      const st = s.cards[c.id];
      return !st || !st.due || st.due <= today;
    });
  }

  function reviewCard(id, grade) {
    const st = cardState(id);
    if (grade === "again") st.box = 1;
    else if (grade === "good") st.box = Math.min(5, st.box + 1);
    st.reps = (st.reps || 0) + 1;
    st.due = dateShift(todayKey(), INTERVALS[st.box - 1]);
    save();
    return st;
  }

  function nextDue() {
    const dates = LOS.cards
      .map((c) => s.cards[c.id] && s.cards[c.id].due)
      .filter(Boolean)
      .sort();
    return dates[0] || null;
  }

  /* ---------- Достижения ---------- */

  function weekClosed(w) {
    const start = (w - 1) * 6;
    for (let k = 0; k < 6; k++) {
      const d = peekDay(start + k);
      if (!d || !d.closed) return false;
    }
    return true;
  }

  function autoUnlocked() {
    const set = new Set();
    const days = Object.values(s.days);
    if (days.some((d) => d.closed)) set.add("first-day");
    const st = streak();
    if (st >= 7) set.add("streak-7");
    if (st >= 30) set.add("streak-30");
    for (let w = 1; w <= LOS.meta.totalWeeks; w++) {
      if (weekClosed(w)) { set.add("clean-week"); break; }
    }
    if (Object.values(s.freezes).some((n) => n > 0)) set.add("freeze");
    if (days.filter((d) => d.minimal).length >= 5) set.add("minimalist");
    if (Object.values(s.journal).filter((j) => j.learned && j.learned.trim().length > 40).length >= 10) set.add("explainer");
    if (weekClosed(10)) set.add("net-detective");
    if (weekClosed(14)) set.add("reader");
    return set;
  }

  function achievements() {
    const auto = autoUnlocked();
    const out = {};
    LOS.achievements.forEach((a) => {
      if (s.achievements[a.id]) out[a.id] = s.achievements[a.id];
      else if (auto.has(a.id)) out[a.id] = todayKey();
    });
    return out;
  }

  function grant(id) {
    if (!s.achievements[id]) {
      s.achievements[id] = todayKey();
      save();
      return true;
    }
    return false;
  }

  function isManual(id) { return LOS.manualAchievements.indexOf(id) !== -1; }

  /* ---------- Дневник ---------- */

  function journal(i) { return s.journal[String(i)] || { learned: "", stuck: "", next: "" }; }

  function saveJournal(i, data) {
    s.journal[String(i)] = {
      learned: data.learned || "",
      stuck: data.stuck || "",
      next: data.next || "",
      at: todayKey()
    };
    if (data.learned && data.learned.trim()) setTask(i, "journal", true);
    save();
  }

  function journalList() {
    return Object.keys(s.journal)
      .map(Number)
      .sort((a, b) => b - a)
      .map((i) => ({ i, ...s.journal[String(i)] }));
  }

  /* ---------- Служебное ---------- */

  function closedCount() {
    return Object.values(s.days).filter((d) => d.closed).length;
  }

  function reset() {
    localStorage.removeItem(KEY);
    s = blank();
    save();
  }

  function exportJson() { return JSON.stringify(s, null, 2); }

  function importJson(text) {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || !data.days) throw new Error("Это не файл прогресса Learning OS");
    s = Object.assign(blank(), data);
    save();
  }

  return {
    load, save, state,
    day, peekDay, toggleTask, setTask, allDone, xpOfDay, totalXp,
    levelInfo, currentIndex, weekOf, dayInWeekOf, closeDay, addFocus,
    streak, freezesLeft, canFreeze, useFreeze, freezesUsed,
    cardState, dueCards, reviewCard, nextDue,
    achievements, autoUnlocked, grant, isManual,
    journal, saveJournal, journalList,
    closedCount, reset, exportJson, importJson,
    todayKey, fmt
  };
})();
