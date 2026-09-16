const KEY = "macrotrack_v2";

const todayKey = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

let state = JSON.parse(localStorage.getItem(KEY) || "null") || {
  selectedDate: todayKey(),
  goals: {
    cal: 2000,
    p: 150,
    c: 200,
    f: 65
  },
  days: {}
};

if (!state.goals) {
  state.goals = {
    cal: 2000,
    p: 150,
    c: 200,
    f: 65
  };
}

if (!state.days) {
  state.days = {};
}

function ensureDay(date) {
  if (!state.days[date]) {
    state.days[date] = {
      foods: []
    };
  }
}

ensureDay(todayKey());

if (!state.selectedDate) {
  state.selectedDate = todayKey();
}

const $ = id => document.getElementById(id);

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  render();
}

function currentFoods() {
  ensureDay(state.selectedDate);
  return state.days[state.selectedDate].foods;
}

function totals() {
  return currentFoods().reduce(
    (a,x) => ({
      cal: a.cal + (+x.cal || 0),
      p: a.p + (+x.p || 0),
      c: a.c + (+x.c || 0),
      f: a.f + (+x.f || 0)
    }),
    {
      cal:0,
      p:0,
      c:0,
      f:0
    }
  );
}

function formatDate(date) {
  const d = new Date(date + "T12:00:00");

  return {
    name: d.toLocaleDateString("en-US", {
      weekday:"short"
    }),

    number: d.getDate(),

    full: d.toLocaleDateString("en-US", {
      month:"short",
      day:"numeric"
    })
  };
}

function getWeekDates() {
  const now = new Date();
  const day = now.getDay();

  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day);

  const dates = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth()+1).padStart(2,"0");
    const date = String(d.getDate()).padStart(2,"0");

    dates.push(`${year}-${month}-${date}`);
  }

  return dates;
}

function renderDays() {
  const picker = $("dayPicker");
  const dates = getWeekDates();
  const today = todayKey();

  picker.innerHTML = dates.map(date => {
    const info = formatDate(date);

    const selected = date === state.selectedDate ? "selected" : "";
    const isToday = date === today ? "today" : "";

    return `
      <button class="day ${selected} ${isToday}" data-date="${date}">
        <span class="dayName">${info.name}</span>
        <span class="dayCircle">${info.number}</span>
      </button>
    `;
  }).join("");
}

function render() {
  ensureDay(state.selectedDate);

  const t = totals();
  const g = state.goals;

  $("calories").textContent = Math.round(t.cal);
  $("goalCalories").textContent = g.cal;

  $("protein").textContent = Math.round(t.p) + "g";
  $("carbs").textContent = Math.round(t.c) + "g";
  $("fat").textContent = Math.round(t.f) + "g";

  $("proteinGoal").textContent = "/ " + g.p + "g";
  $("carbsGoal").textContent = "/ " + g.c + "g";
  $("fatGoal").textContent = "/ " + g.f + "g";

  const percentage = g.cal > 0
    ? Math.min(360, t.cal / g.cal * 360)
    : 0;

  document.querySelector(".ring")
    .style.setProperty("--deg", percentage + "deg");

  const selectedInfo = formatDate(state.selectedDate);

  $("foodTitle").textContent =
    state.selectedDate === todayKey()
      ? "Today's Food"
      : selectedInfo.full + " Food";

  const list = $("foodList");

  const foods = currentFoods();

  list.innerHTML = foods.length
    ? foods.map(x => `
      <div class="food">
        <div>
          <b>${esc(x.name)}</b>
          <small>${x.serving || "1 serving"}</small>
        </div>

        <div class="nums">
          <b>${Math.round(x.cal)} kcal</b>
          <small>
            P ${Math.round(x.p)}
            · C ${Math.round(x.c)}
            · F ${Math.round(x.f)}
          </small>
        </div>
      </div>
    `).join("")
    : '<p class="muted">Nothing logged yet.</p>';

  renderDays();
}

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    m => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[m])
  );
}

function modal(html) {
  $("modalContent").innerHTML = html;
  $("modal").classList.remove("hidden");
}

$("closeModal").onclick = () => {
  $("modal").classList.add("hidden");
};

/* DAY SELECTION */

document.addEventListener("click", e => {
  const day = e.target.closest(".day");

  if (!day) return;

  state.selectedDate = day.dataset.date;

  ensureDay(state.selectedDate);

  save();
});

/* QUICK ADD */

document.querySelectorAll("[data-food]").forEach(b => {
  b.onclick = () => {
    currentFoods().push({
      ...JSON.parse(b.dataset.food),
      serving:"1 serving"
    });

    save();
  };
});

/* SEARCH */

$("searchBtn").onclick = () => modal(`
  <h2>Search food</h2>

  <input
    id="foodQ"
    class="field"
    placeholder="e.g. chicken breast, banana"
  >

  <button class="primary" id="doSearch">
    Search
  </button>

  <div id="results"></div>
`);

document.addEventListener("click", async e => {

  if (e.target.id === "doSearch") {

    const q = $("foodQ").value.trim();

    if (!q) return;

    $("results").innerHTML = "Searching…";

    try {

      const r = await fetch(
        "https://world.openfoodfacts.org/cgi/search.pl?search_terms="
        + encodeURIComponent(q)
        + "&search_simple=1&action=process&json=1&page_size=8"
      );

      const j = await r.json();

      $("results").innerHTML =
        j.products
          .filter(p => p.product_name)
          .map(p => {

            const n = p.nutriments || {};

            const food = {
              name:p.product_name,
              cal:n["energy-kcal_100g"] || 0,
              p:n.proteins_100g || 0,
              c:n.carbohydrates_100g || 0,
              f:n.fat_100g || 0,
              serving:"per 100g"
            };

            return `
              <div
                class="result"
                data-add='${JSON.stringify(food).replaceAll("'","&#39;")}'
              >
                <b>${esc(p.product_name)}</b>
                <small>
                  ${n["energy-kcal_100g"] || "?"} kcal / 100g
                </small>
              </div>
            `;
          })
          .join("")
        || "No results";

    } catch(err) {

      $("results").innerHTML =
        "Couldn't reach the food database.";
    }
  }

  if (e.target.closest(".result")) {

    const d = e.target.closest(".result").dataset.add;

    currentFoods().push(
      JSON.parse(d.replaceAll("&#39;","'"))
    );

    save();

    $("modal").classList.add("hidden");
  }
});

/* BARCODE */

$("barcodeBtn").onclick = () => modal(`
  <h2>Barcode</h2>

  <p>Enter the UPC/EAN number from the package.</p>

  <input
    id="barcode"
    class="field"
    inputmode="numeric"
    placeholder="e.g. 012345678901"
  >

  <button class="primary" id="lookup">
    Look up product
  </button>

  <div id="barcodeResult"></div>
`);

document.addEventListener("click", async e => {

  if (e.target.id === "lookup") {

    const code = $("barcode")
      .value
      .replace(/\D/g,"");

    if (!code) return;

    $("barcodeResult").innerHTML = "Looking up…";

    try {

      const r = await fetch(
        "https://world.openfoodfacts.org/api/v2/product/"
        + code
        + ".json"
      );

      const j = await r.json();

      if (j.status !== 1) {

        $("barcodeResult").innerHTML =
          "<p>Product not found. Try searching by name.</p>";

        return;
      }

      const p = j.product;
      const n = p.nutriments || {};

      const food = {
        name:p.product_name || "Scanned product",
        cal:n["energy-kcal_100g"] || 0,
        p:n.proteins_100g || 0,
        c:n.carbohydrates_100g || 0,
        f:n.fat_100g || 0,
        serving:"per 100g"
      };

      $("barcodeResult").innerHTML = `
        <div class="result">
          <b>${esc(food.name)}</b>

          <small>
            ${food.cal} kcal / 100g ·
            P ${food.p}g ·
            C ${food.c}g ·
            F ${food.f}g
          </small>
        </div>

        <button class="primary" id="addBarcode">
          Add to selected day
        </button>
      `;

      window._barcodeFood = food;

    } catch(err) {

      $("barcodeResult").innerHTML =
        "Couldn't reach the food database.";
    }
  }

  if (e.target.id === "addBarcode") {

    currentFoods().push(window._barcodeFood);

    save();

    $("modal").classList.add("hidden");
  }
});

/* PHOTO */

$("photoBtn").onclick = () => {
  $("photoInput").click();
};

$("photoInput").onchange = e => {

  if (!e.target.files[0]) return;

  modal(`
    <h2>Food photo</h2>

    <p>
      Your photo is ready. This free version doesn't send
      your food photos to a paid AI service, so use the
      fields below to enter the food and portion shown.
      You can then save it.
    </p>

    <input
      id="pn"
      class="field"
      placeholder="Food name"
    >

    <input
      id="pc"
      class="field"
      type="number"
      placeholder="Calories"
    >

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">

      <input
        id="pp"
        class="field"
        type="number"
        placeholder="Protein g"
      >

      <input
        id="pca"
        class="field"
        type="number"
        placeholder="Carbs g"
      >

      <input
        id="pf"
        class="field"
        type="number"
        placeholder="Fat g"
      >

    </div>

    <button class="primary" id="addPhoto">
      Add food
    </button>
  `);
};

document.addEventListener("click", e => {

  if (e.target.id === "addPhoto") {

    currentFoods().push({
      name:$("pn").value || "Photo food",
      cal:+$("pc").value || 0,
      p:+$("pp").value || 0,
      c:+$("pca").value || 0,
      f:+$("pf").value || 0,
      serving:"photo estimate"
    });

    save();

    $("modal").classList.add("hidden");
  }
});

/* SETTINGS */

$("settingsBtn").onclick = () => modal(`
  <h2>Daily goals</h2>

  <label>Calories</label>
  <input
    id="gc"
    class="field"
    type="number"
    value="${state.goals.cal}"
  >

  <label>Protein (g)</label>
  <input
    id="gp"
    class="field"
    type="number"
    value="${state.goals.p}"
  >

  <label>Carbs (g)</label>
  <input
    id="gca"
    class="field"
    type="number"
    value="${state.goals.c}"
  >

  <label>Fat (g)</label>
  <input
    id="gf"
    class="field"
    type="number"
    value="${state.goals.f}"
  >

  <button class="primary" id="saveGoals">
    Save goals
  </button>
`);

document.addEventListener("click", e => {

  if (e.target.id === "saveGoals") {

    state.goals = {
      cal:+$("gc").value || 2000,
      p:+$("gp").value || 150,
      c:+$("gca").value || 200,
      f:+$("gf").value || 65
    };

    save();

    $("modal").classList.add("hidden");
  }
});

/* START */

render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .catch(() => {});
}
