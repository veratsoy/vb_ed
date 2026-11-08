/* ============================================================
   Learning OS — интерфейс
   ============================================================ */

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const esc = (v) =>
    String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

  const ROUTES = ["today", "program", "cards", "tree", "achievements", "journal"];
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

  const QUOTES = [
    "Код, который ты не понимаешь, — это не твой код. Это долг.",
    "Маленький шаг каждый день сильнее героического рывка раз в месяц.",
    "Не «я не умею», а «я пока не разобралась». Разница в одном слове — и в результате.",
    "Если застряла больше 20 минут — сформулируй вопрос вслух. Половина ответов находится на этом этапе.",
    "ИИ пишет быстро. Ты отвечаешь за то, что он написал.",
    "Плохой день — это 20 минут, а не ноль.",
    "Понимание приходит, когда объясняешь. Поэтому дневник — не формальность.",
    "Не сравнивай свой день 10 со своим днём 1 у кого-то другого.",
    "Работающий кривой код лучше идеального ненаписанного.",
    "Сначала заставь работать. Потом сделай красиво. Потом сделай быстро."
  ];

  let route = "today";
  let cardFlipped = false;
  const timer = { left: 25 * 60, running: false };

  /* ---------- Мелочи ---------- */

  function todayLabel() {
    const d = new Date();
    return `${WD[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }

  function mmss(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function toast(text, kind) {
    const box = $("#toasts");
    const el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.innerHTML = text;
    box.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 320);
    }, 2800);
  }

  function levelTitle(level) {
    if (level < 5) return "Ты только вошла. Дальше — интереснее.";
    if (level < 10) return "Инструменты уже в руках.";
    if (level < 15) return "Ты строишь, а не смотришь.";
    if (level < 20) return "Половина пути. Фундамент заложен.";
    if (level < 25) return "Теперь ты понимаешь, что под капотом.";
    if (level < 30) return "Ты умеешь то, чего не умеют многие джуны.";
    if (level < 35) return "Осталось упаковать. Ты почти на месте.";
    return "Финишная прямая. Ты это сделала.";
  }

  function showLevelUp(level) {
    const el = $("#levelup");
    el.innerHTML =
      `<div class="inner">
        <small>новый уровень</small>
        <div class="lvl">${level}</div>
        <p>${esc(levelTitle(level))}</p>
      </div>`;
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 2400);
    el.onclick = () => { el.hidden = true; };
  }

  function openModal(html) {
    const m = $("#modal");
    m.innerHTML = `<div class="modal-box">${html}</div>`;
    m.hidden = false;
  }

  function closeModal() {
    const m = $("#modal");
    m.hidden = true;
    m.innerHTML = "";
  }

  /* ---------- Верхняя панель ---------- */

  function renderTopbar() {
    const info = Store.levelInfo();
    const st = Store.streak();
    const fr = Store.freezesLeft();
    $("#topbar").innerHTML =
      `<div class="topbar-date">Сегодня <b>${todayLabel()}</b></div>
       <div class="topbar-stats">
         <div class="ring" style="--p:${info.pct}"><span>${info.level}</span></div>
         <div class="pill"><span>⚡</span><b>${Store.totalXp()}</b> XP</div>
         <div class="pill flame"><span>🔥</span><b>${st}</b> дн.</div>
         <div class="pill frost"><span>🧊</span><b>${fr}</b>/2</div>
         <button class="pill" data-act="settings" title="Настройки" style="cursor:pointer;border-color:var(--line)">⚙️</button>
       </div>`;
  }

  function renderNav() {
    $$("#nav a").forEach((a) => {
      a.classList.toggle("active", a.dataset.route === route);
    });
  }

  function renderSidebarFoot() {
    const info = Store.levelInfo();
    const closed = Store.closedCount();
    $("#sidebar-foot").innerHTML =
      `<div class="side-card">
         <div class="row"><small>уровень</small><b>${info.level}</b></div>
         <div class="progress" style="margin-top:8px"><i style="width:${info.pct}%"></i></div>
         <div style="color:var(--dim);font-size:11px;margin-top:6px">${info.into} / ${info.need} XP</div>
       </div>
       <div class="side-card">
         <div class="row"><small>пройдено</small><b>${closed}/96</b></div>
         <div class="progress" style="margin-top:8px"><i style="width:${Math.round(closed / 96 * 100)}%"></i></div>
         <div style="color:var(--dim);font-size:11px;margin-top:6px">${Math.round(closed / 96 * 100)}% программы</div>
       </div>`;
  }

  /* ---------- Экран «Сегодня» ---------- */

  function viewToday() {
    const i = Store.currentIndex();
    const weekN = Store.weekOf(i);
    const diw = Store.dayInWeekOf(i);
    const wk = LOS.weeks[weekN - 1];
    const day = wk.days[diw - 1];
    const block = LOS.blocks.find((b) => b.id === wk.block);
    const d = Store.day(i);
    const doneCount = LOS.tasks.filter((t) => d.tasks[t.id]).length;
    const all = Store.allDone(i);
    const xp = Store.xpOfDay(i);
    const finished = d.closed;

    const tasksHtml = LOS.tasks.map((t) => {
      const on = !!d.tasks[t.id];
      return `<button class="task ${on ? "done" : ""}" data-act="task" data-id="${t.id}" ${finished ? "disabled" : ""}>
        <span class="task-check">${on ? "✓" : ""}</span>
        <span class="task-body"><b>${t.icon} ${esc(t.label)}</b><small>${esc(t.hint)}</small></span>
        <span class="task-xp">+${t.xp} XP</span>
      </button>`;
    }).join("");

    const materials = day.link
      ? `<a class="material-link" href="${day.link}">
           <span><b>Материалы дня</b><small>теория, визуализация, задание</small></span>
           <span class="arrow">→</span>
         </a>`
      : `<div class="material-link" style="cursor:default;opacity:.7">
           <span><b>Материалы дня</b><small>откроются, когда дойдёшь до этой недели</small></span>
           <span style="color:var(--dim)">🔒</span>
         </div>`;

    const freezeBtn = Store.canFreeze()
      ? `<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px" data-act="freeze">🧊 Заморозить вчерашний день</button>`
      : "";

    return `
      <div class="page-head">
        <div>
          <div class="eyebrow"><span class="dot"></span>день ${i + 1} из 96 · неделя ${weekN}</div>
          <h1>${esc(day.t)}</h1>
          <p class="sub">${esc(wk.goal)}</p>
        </div>
        <div class="head-badges">
          <span class="chip" style="color:${block.color}">${block.icon} ${esc(block.name)}</span>
          <span class="chip" style="color:var(--muted)">${LOS.kinds[day.k]}</span>
        </div>
      </div>

      <div class="grid-2">
        <div class="stack">
          <div class="panel">
            <div class="panel-head">
              <h2>Задания дня</h2>
              <span class="count">${doneCount} / 4 · +${xp} XP</span>
            </div>
            <div class="tasks">${tasksHtml}</div>
            <div class="panel-foot">
              <div class="progress"><i style="width:${(doneCount / 4) * 100}%"></i></div>
              <div class="foot-row">
                <span style="color:var(--dim);font-size:12.5px">${finished ? "День закрыт. Иди отдыхай." : all ? "Всё готово. Закрывай день." : "Отмечай по мере выполнения."}</span>
                <button class="btn btn-primary" data-act="close" ${all && !finished ? "" : "disabled"}>
                  ${finished ? "День закрыт ✓" : `Закрыть день · +${LOS.bonusXp} XP`}
                </button>
              </div>
            </div>
          </div>

          <div class="panel timer-panel">
            <div class="timer-label">фокус · 25 минут</div>
            <div class="timer ${timer.running ? "running" : ""}" id="timer">${mmss(timer.left)}</div>
            <div class="timer-actions">
              <button class="btn ${timer.running ? "btn-ghost" : "btn-primary"}" data-act="timer-toggle">
                ${timer.running ? "Пауза" : "Старт"}
              </button>
              <button class="btn btn-ghost" data-act="timer-reset">Сброс</button>
            </div>
            <div class="timer-meta">сессий сегодня: ${d.focus || 0} / ${LOS.focusCap} · +${LOS.focusXp} XP за каждую</div>
          </div>
        </div>

        <div class="stack">
          <div class="panel">
            <div class="panel-head"><h2>Твой прогресс</h2></div>
            <div class="mini-stats">
              <div class="mini"><small>уровень</small><b>${Store.levelInfo().level}</b></div>
              <div class="mini"><small>всего XP</small><b>${Store.totalXp()}</b></div>
              <div class="mini"><small>streak</small><b>${Store.streak()} дн.</b></div>
              <div class="mini"><small>заморозки</small><b>${Store.freezesLeft()} / 2</b></div>
            </div>
            ${freezeBtn}
          </div>

          ${materials}

          <div class="panel">
            <div class="panel-head"><h2>Плохой день?</h2></div>
            <p style="color:var(--muted);font-size:13.5px">
              Правило «никогда не ноль». 20 минут — и день засчитан, streak жив.
              Это не читерство, это часть системы.
            </p>
            <button class="btn btn-ghost" style="margin-top:14px;width:100%" data-act="minimal" ${finished ? "disabled" : ""}>
              Закрыть минимальный день · 20 XP
            </button>
          </div>

          <div class="panel">
            <p class="quote">${esc(QUOTES[i % QUOTES.length])}</p>
          </div>
        </div>
      </div>`;
  }

  /* ---------- Программа ---------- */

  function viewProgram() {
    const closed = Store.closedCount();
    const pct = Math.round((closed / 96) * 100);
    const cur = Store.currentIndex();

    const heat = Array.from({ length: 96 }, (_, i) => {
      const st = Store.peekDay(i);
      let cls = "";
      if (st && st.closed) cls = st.minimal ? "min" : "done";
      if (i === cur) cls += " now";
      return `<i class="${cls}" title="День ${i + 1}"></i>`;
    }).join("");

    const weeksHtml = LOS.weeks.map((w) => {
      const start = (w.n - 1) * 6;
      let c = 0;
      for (let k = 0; k < 6; k++) {
        const st = Store.peekDay(start + k);
        if (st && st.closed) c += 1;
      }
      const block = LOS.blocks.find((b) => b.id === w.block);
      const isCur = cur >= start && cur < start + 6;
      return `<button class="week-card ${isCur ? "active" : ""}" data-act="week" data-n="${w.n}">
        <span class="week-num" style="color:${block.color}">${w.n}</span>
        <span class="week-body">
          <b>${esc(w.title)}</b>
          <small>${esc(block.name)} · ${esc(w.skills.join(" · "))}</small>
        </span>
        <span class="week-progress">
          <span class="progress"><i style="width:${Math.round((c / 6) * 100)}%"></i></span>
          <span>${c}/6</span>
        </span>
      </button>`;
    }).join("");

    return `
      <div class="page-head">
        <div>
          <div class="eyebrow"><span class="dot"></span>16 недель · 96 учебных дней</div>
          <h1>Программа</h1>
          <p class="sub">Порядок не случайный: сначала инструмент, потом язык, потом фундамент, потом сервер, потом продукт.</p>
        </div>
        <div class="head-badges">
          <span class="chip" style="color:var(--lime)">${pct}% пройдено</span>
        </div>
      </div>

      <div class="panel" style="margin-bottom:18px">
        <div class="panel-head">
          <h2>Карта прогресса</h2>
          <span class="count">${closed} / 96 дней</span>
        </div>
        <div class="heat-wrap"><div class="heat">${heat}</div></div>
        <div class="legend">
          <span><i style="background:var(--panel-2);border:1px solid var(--line)"></i> впереди</span>
          <span><i style="background:rgba(182,255,60,.35)"></i> минимальный</span>
          <span><i style="background:var(--lime)"></i> закрыт</span>
          <span><i style="outline:2px solid var(--cyan);outline-offset:1px"></i> сейчас</span>
        </div>
      </div>

      <div class="week-list">${weeksHtml}</div>`;
  }

  /* ---------- Карточки ---------- */

  function viewCards() {
    const due = Store.dueCards();
    const total = LOS.cards.length;

    if (!due.length) {
      return `
        <div class="page-head">
          <div>
            <div class="eyebrow"><span class="dot"></span>интервальное повторение</div>
            <h1>Карточки</h1>
            <p class="sub">Повторение по интервалам: 1 → 2 → 4 → 7 → 15 дней. Так знания не выветриваются.</p>
          </div>
        </div>
        <div class="empty">
          <div class="big">🌙</div>
          <b>На сегодня всё.</b>
          <p style="margin-top:8px">Следующая партия: ${Store.nextDue() || "—"}</p>
          <p style="margin-top:6px;font-size:12.5px;color:var(--dim)">Всего карточек в колоде: ${total}</p>
        </div>`;
    }

    const card = due[0];
    const st = Store.cardState(card.id);

    return `
      <div class="page-head">
        <div>
          <div class="eyebrow"><span class="dot"></span>интервальное повторение</div>
          <h1>Карточки</h1>
          <p class="sub">Осталось на сегодня: <b style="color:var(--text)">${due.length}</b> из ${total}. Коробка ${st.box} из 5.</p>
        </div>
      </div>

      <div class="flash-stage">
        <div class="flashcard ${cardFlipped ? "flipped" : ""}" data-act="flip">
          <div class="flash-face">
            <div class="flash-tag">${esc(card.tag)} · вопрос</div>
            <div class="flash-q">${esc(card.q)}</div>
          </div>
          <div class="flash-face back">
            <div class="flash-tag">${esc(card.tag)} · ответ</div>
            <div class="flash-a">${esc(card.a)}</div>
          </div>
        </div>
        <div class="flash-hint">${cardFlipped ? "Оцени себя честно" : "Нажми, чтобы увидеть ответ"}</div>
      </div>

      ${cardFlipped ? `
        <div class="review-actions">
          <button class="btn" data-act="review" data-grade="again" data-id="${card.id}">Не знаю<small>вернуть в начало</small></button>
          <button class="btn" data-act="review" data-grade="hard" data-id="${card.id}">Почти<small>оставить на месте</small></button>
          <button class="btn btn-primary" data-act="review" data-grade="good" data-id="${card.id}">Знаю<small>+1 коробка</small></button>
        </div>` : ""}`;
  }

  /* ---------- Дерево навыков ---------- */

  function viewTree() {
    const cur = Store.currentIndex();
    const cols = LOS.tree.map((col) => {
      const nodes = col.nodes.map((n) => {
        const on = cur >= (n.w - 1) * 6;
        return `<div class="tree-node ${on ? "on" : "off"}" style="--c:${col.color}" title="Неделя ${n.w}">
          ${esc(n.label)}${on ? "" : ' <span class="lock">🔒</span>'}
        </div>`;
      }).join("");
      return `<div class="tree-col">
        <div class="tree-col-head" style="color:${col.color}">${esc(col.name)}</div>
        ${nodes}
      </div>`;
    }).join("");

    return `
      <div class="page-head">
        <div>
          <div class="eyebrow"><span class="dot"></span>карта навыков</div>
          <h1>Навыки</h1>
          <p class="sub">Каждый узел открывается, когда ты доходишь до его недели. Серые — ещё впереди, и это нормально.</p>
        </div>
      </div>
      <div class="panel"><div class="tree">${cols}</div></div>`;
  }

  /* ---------- Ачивки ---------- */

  function viewAchievements() {
    const got = Store.achievements();
    const unlocked = Object.keys(got).length;

    const cats = Object.keys(LOS.achievementCats).map((catId) => {
      const cat = LOS.achievementCats[catId];
      const items = LOS.achievements.filter((a) => a.cat === catId).map((a) => {
        const date = got[a.id];
        const manual = Store.isManual(a.id);
        return `<div class="ach ${date ? "on" : ""}">
          <span class="ico">${a.icon}</span>
          <b>${esc(a.title)}</b>
          <small>${esc(a.desc)}</small>
          ${date ? `<div class="ach-date">${date}</div>` : manual ? `<button class="btn btn-sm btn-ghost" data-act="grant" data-id="${a.id}">Получить</button>` : ""}
        </div>`;
      }).join("");
      return `<div class="ach-cat">
        <h3>${cat.icon} ${esc(cat.name)}</h3>
        <div class="ach-grid">${items}</div>
      </div>`;
    }).join("");

    return `
      <div class="page-head">
        <div>
          <div class="eyebrow"><span class="dot"></span>коллекция</div>
          <h1>Ачивки</h1>
          <p class="sub">Часть открывается автоматически. Часть — на совесть: если сделала, забирай.</p>
        </div>
        <div class="head-badges">
          <span class="chip" style="color:var(--gold)">${unlocked} / ${LOS.achievements.length}</span>
        </div>
      </div>
      ${cats}`;
  }

  /* ---------- Дневник ---------- */

  function viewJournal() {
    const i = Store.currentIndex();
    const j = Store.journal(i);
    const weekN = Store.weekOf(i);
    const wk = LOS.weeks[weekN - 1];
    const day = wk.days[Store.dayInWeekOf(i) - 1];

    const history = Store.journalList().filter((e) => e.i !== i).slice(0, 20).map((e) => {
      const w = Store.weekOf(e.i);
      return `<div class="journal-entry">
        <div class="meta"><span>день ${e.i + 1} · неделя ${w}</span><span>${esc(e.at || "")}</span></div>
        ${e.learned ? `<p><b>Поняла:</b> ${esc(e.learned)}</p>` : ""}
        ${e.stuck ? `<p><b>Застряла:</b> ${esc(e.stuck)}</p>` : ""}
        ${e.next ? `<p><b>Дальше:</b> ${esc(e.next)}</p>` : ""}
      </div>`;
    }).join("") || `<p style="color:var(--dim);font-size:13px">Пока пусто. Первая запись появится сегодня.</p>`;

    return `
      <div class="page-head">
        <div>
          <div class="eyebrow"><span class="dot"></span>день ${i + 1} · неделя ${weekN}</div>
          <h1>Дневник</h1>
          <p class="sub">Три вопроса в конце дня. Это не отчёт — это способ поймать понимание за хвост.</p>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-head"><h2>${esc(day.t)}</h2></div>
          <div class="field">
            <label>Что поняла своими словами?</label>
            <textarea id="j-learned" rows="3" placeholder="Например: путь — это адрес файла, абсолютный начинается с диска, относительный — от текущей папки.">${esc(j.learned)}</textarea>
          </div>
          <div class="field">
            <label>Где застряла?</label>
            <textarea id="j-stuck" rows="2" placeholder="Что осталось непонятным — сформулируй вопрос.">${esc(j.stuck)}</textarea>
          </div>
          <div class="field">
            <label>Что делаю завтра?</label>
            <textarea id="j-next" rows="2" placeholder="Один конкретный шаг.">${esc(j.next)}</textarea>
          </div>
          <button class="btn btn-primary" data-act="save-journal">Сохранить запись · +40 XP</button>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>История</h2><span class="count">${Store.journalList().length}</span></div>
          ${history}
        </div>
      </div>`;
  }

  /* ---------- Рендер ---------- */

  function render() {
    renderTopbar();
    renderNav();
    renderSidebarFoot();

    const view = $("#view");
    if (route === "today") view.innerHTML = viewToday();
    else if (route === "program") view.innerHTML = viewProgram();
    else if (route === "cards") view.innerHTML = viewCards();
    else if (route === "tree") view.innerHTML = viewTree();
    else if (route === "achievements") view.innerHTML = viewAchievements();
    else view.innerHTML = viewJournal();
  }

  /* ---------- Действия ---------- */

  function commit(fn) {
    const before = Store.levelInfo().level;
    fn();
    render();
    const after = Store.levelInfo().level;
    if (after > before) showLevelUp(after);
  }

  function downloadProgress() {
    const blob = new Blob([Store.exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "learning-os-progress.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Файл прогресса скачан", "gold");
  }

  function openWeek(n) {
    const wk = LOS.weeks[n - 1];
    const block = LOS.blocks.find((b) => b.id === wk.block);
    const start = (n - 1) * 6;

    const rows = wk.days.map((d, k) => {
      const idx = start + k;
      const st = Store.peekDay(idx);
      const done = st && st.closed;
      const right = d.link
        ? `<a class="go" href="${d.link}">открыть →</a>`
        : `<span class="k">скоро</span>`;
      return `<div class="day-row ${done ? "done" : ""}">
        <span class="n">${k + 1}</span>
        <span class="t">${esc(d.t)}</span>
        <span class="k">${LOS.kinds[d.k]}</span>
        ${right}
      </div>`;
    }).join("");

    openModal(`
      <div class="modal-head">
        <div>
          <div class="eyebrow" style="color:${block.color}">неделя ${n} · ${esc(block.name)}</div>
          <h2>${esc(wk.title)}</h2>
          <p class="sub" style="margin-top:8px">${esc(wk.goal)}</p>
        </div>
        <button class="modal-close" data-act="close-modal" aria-label="Закрыть">×</button>
      </div>
      ${rows}
      <p style="color:var(--dim);font-size:12.5px;margin-top:14px">
        Материалы открываются по неделям. Так меньше соблазна прочитать всё сразу и ничего не сделать.
      </p>`);
  }

  function openSettings() {
    const s = Store.state();
    openModal(`
      <div class="modal-head">
        <div>
          <div class="eyebrow">настройки</div>
          <h2>Твой пульт</h2>
        </div>
        <button class="modal-close" data-act="close-modal" aria-label="Закрыть">×</button>
      </div>

      <div class="field">
        <label>Имя</label>
        <input id="set-name" value="${esc(s.name || "Вера")}">
      </div>
      <div class="field">
        <label>Дата старта</label>
        <input id="set-start" type="date" value="${esc(s.startDate || LOS.meta.startDate)}">
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
        <button class="btn" data-act="save-settings">Сохранить</button>
        <button class="btn btn-ghost" data-act="export">Экспорт прогресса</button>
        <button class="btn btn-ghost" data-act="import">Импорт</button>
      </div>

      <hr style="border:none;border-top:1px solid var(--line);margin:20px 0">

      <p style="color:var(--dim);font-size:12.5px">
        Прогресс хранится только в этом браузере, на этом компьютере. Никакого сервера.
        Раз в неделю делай экспорт — это твоя страховка.
      </p>
      <button class="btn btn-ghost" style="margin-top:12px;color:var(--red);border-color:rgba(255,95,109,.35)" data-act="reset">
        Сбросить весь прогресс
      </button>`);
  }

  function onClick(e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;

    if (act === "task") {
      const i = Store.currentIndex();
      const wasDone = !!Store.day(i).tasks[el.dataset.id];
      Store.toggleTask(i, el.dataset.id);
      if (!wasDone) {
        const t = LOS.tasks.find((x) => x.id === el.dataset.id);
        if (t) toast(`+${t.xp} XP · ${t.label}`, "xp");
      }
      commit(() => {});
      return;
    }

    if (act === "close") {
      const i = Store.currentIndex();
      if (!Store.allDone(i)) return;
      const xp = Store.xpOfDay(i);
      commit(() => { Store.closeDay(i, false); });
      toast(`День закрыт · +${xp} XP`, "xp");
      return;
    }

    if (act === "minimal") {
      const i = Store.currentIndex();
      if (Store.day(i).closed) return;
      if (!window.confirm("Закрыть день как минимальный? 20 минут — и streak сохранён.")) return;
      commit(() => { Store.closeDay(i, true); });
      toast("Минимальный день засчитан · +20 XP", "xp");
      return;
    }

    if (act === "freeze") {
      if (Store.useFreeze()) {
        render();
        toast("Заморозка использована. Без вины.", "gold");
      }
      return;
    }

    if (act === "timer-toggle") {
      timer.running = !timer.running;
      render();
      return;
    }

    if (act === "timer-reset") {
      timer.running = false;
      timer.left = 25 * 60;
      render();
      return;
    }

    if (act === "flip") {
      cardFlipped = !cardFlipped;
      const fc = $(".flashcard");
      if (fc) fc.classList.toggle("flipped", cardFlipped);
      render();
      return;
    }

    if (act === "review") {
      Store.reviewCard(el.dataset.id, el.dataset.grade);
      cardFlipped = false;
      render();
      toast("Записано", "xp");
      return;
    }

    if (act === "grant") {
      if (Store.grant(el.dataset.id)) {
        render();
        toast("Ачивка получена 🏆", "gold");
      }
      return;
    }

    if (act === "week") {
      openWeek(Number(el.dataset.n));
      return;
    }

    if (act === "settings") {
      openSettings();
      return;
    }

    if (act === "close-modal") {
      closeModal();
      return;
    }

    if (act === "save-settings") {
      const s = Store.state();
      const name = $("#set-name").value.trim();
      const start = $("#set-start").value;
      if (name) s.name = name;
      if (start) s.startDate = start;
      Store.save();
      render();
      closeModal();
      toast("Сохранено", "gold");
      return;
    }

    if (act === "export") {
      downloadProgress();
      return;
    }

    if (act === "import") {
      $("#import-file").click();
      return;
    }

    if (act === "reset") {
      if (!window.confirm("Точно сбросить весь прогресс? Это необратимо. Сначала сделай экспорт.")) return;
      Store.reset();
      closeModal();
      render();
      toast("Прогресс сброшен", "gold");
      return;
    }

    if (act === "save-journal") {
      const i = Store.currentIndex();
      const data = {
        learned: $("#j-learned").value,
        stuck: $("#j-stuck").value,
        next: $("#j-next").value
      };
      commit(() => { Store.saveJournal(i, data); });
      toast("Запись сохранена · +40 XP", "xp");
      return;
    }
  }

  /* ---------- Таймер ---------- */

  function startTimerLoop() {
    setInterval(() => {
      if (!timer.running) return;
      timer.left -= 1;

      if (timer.left <= 0) {
        timer.running = false;
        timer.left = 25 * 60;
        const ok = Store.addFocus();
        render();
        if (ok) toast("Фокус-сессия закрыта · +10 XP", "xp");
        return;
      }

      const el = $("#timer");
      if (el) {
        el.textContent = mmss(timer.left);
        el.classList.add("running");
      }
    }, 1000);
  }

  /* ---------- Старт ---------- */

  function init() {
    Store.load();
    route = (location.hash || "#today").slice(1);
    if (ROUTES.indexOf(route) === -1) route = "today";

    window.addEventListener("hashchange", () => {
      route = (location.hash || "#today").slice(1);
      if (ROUTES.indexOf(route) === -1) route = "today";
      cardFlipped = false;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    document.addEventListener("click", onClick);

    $("#import-file").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Store.importJson(String(reader.result));
          render();
          closeModal();
          toast("Прогресс восстановлен", "gold");
        } catch (err) {
          toast("Не получилось: " + err.message, "");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });

    render();
    startTimerLoop();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
