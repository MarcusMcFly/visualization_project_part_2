/* main.js — carga de datos, navegación y utilidades compartidas. */
const APP = {
  data: {},
  byId: {},

  // Paleta de clusters y de fases circadianas
  clusterColors: ["#5cc8ff", "#b388ff", "#4ade80", "#fbbf24", "#fb7185"],
  phaseColors: { morning: "#fbbf24", afternoon: "#5cc8ff", evening: "#b388ff", night: "#334155" },

  // Etiquetas legibles para las variables
  LABELS: {
    mean_intensity: "Intensidad media",
    accel_variance: "Varianza aceleración",
    active_fraction: "Fracción activa",
    sedentary_fraction: "Fracción sedentaria",
    activity_fragmentation: "Fragmentación",
    circadian_stability: "Estabilidad circadiana",
    mobility_radius_m: "Radio de movilidad (m)",
    weekend_delta: "Δ finde vs. laborable",
    sdq_emotional: "SDQ Emocional",
    sdq_conduct: "SDQ Conducta",
    sdq_hyperactivity: "SDQ Hiperactividad",
    sdq_peer: "SDQ Iguales",
    sdq_prosocial: "SDQ Prosocial",
    sdq_total_difficulties: "SDQ Total dificultades",
    snap_inattention: "SNAP Inatención",
    snap_hyperactivity_impulsivity: "SNAP Hiperact./Impuls.",
    snap_odd: "SNAP ODD",
    bmi: "IMC",
  },

  label(key) { return this.LABELS[key] || key; },

  // Layout oscuro compartido para Plotly
  baseLayout(title, overrides = {}) {
    return Object.assign({
      title: { text: title, font: { size: 15, color: "#e6ebf5" }, x: 0.02 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#93a0b8", family: "Segoe UI, system-ui, sans-serif", size: 12 },
      margin: { l: 55, r: 20, t: 44, b: 48 },
      colorway: ["#5cc8ff", "#b388ff", "#4ade80", "#fbbf24", "#fb7185", "#38bdf8"],
      xaxis: { gridcolor: "#2c3852", zerolinecolor: "#2c3852" },
      yaxis: { gridcolor: "#2c3852", zerolinecolor: "#2c3852" },
      legend: { font: { color: "#93a0b8" } },
    }, overrides);
  },

  config: { responsive: true, displayModeBar: false },

  async init() {
    const files = ["participants", "psychometric_summary", "daily_summary",
      "hourly_activity", "derived_features", "correlations", "clusters"];
    try {
      const loaded = await Promise.all(
        files.map((f) => fetch(`data/${f}.json`).then((r) => {
          if (!r.ok) throw new Error(`${f}.json: ${r.status}`);
          return r.json();
        }))
      );
      files.forEach((f, i) => (this.data[f] = loaded[i]));
    } catch (e) {
      document.getElementById("loading").textContent =
        "Error cargando datos: " + e.message + " — sírvelo con un servidor (no abriendo el HTML como fichero).";
      return;
    }

    this.buildIndex();
    document.getElementById("loading").style.display = "none";
    document.querySelectorAll("section").forEach((s) => s.classList.remove("hidden"));

    // Renderiza cada sección (cada fichero define su función global)
    renderOverview(this);
    renderPsychometric(this);
    renderMovement(this);
    renderRelation(this);
    renderClusters(this);
    renderTemporal(this);

    this.setupNav();
  },

  // Une todas las tablas por participant_id en un único registro
  buildIndex() {
    const idx = {};
    const ensure = (id) => (idx[id] = idx[id] || { participant_id: id });
    this.data.participants.forEach((p) => Object.assign(ensure(p.participant_id), p));
    this.data.psychometric_summary.forEach((p) => Object.assign(ensure(p.participant_id), p));
    this.data.derived_features.forEach((p) => Object.assign(ensure(p.participant_id), p));
    this.data.clusters.points.forEach((p) =>
      Object.assign(ensure(p.participant_id), { cluster: p.cluster, pca_x: p.pca_x, pca_y: p.pca_y })
    );
    this.byId = idx;
    this.rows = Object.values(idx);
  },

  // Scroll-spy para resaltar la sección activa en la navegación
  setupNav() {
    const links = [...document.querySelectorAll(".nav a")];
    const sections = links.map((a) => document.querySelector(a.getAttribute("href")));
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            links.forEach((l) => l.classList.remove("active"));
            const link = links.find((l) => l.getAttribute("href") === "#" + en.target.id);
            if (link) link.classList.add("active");
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((s) => s && obs.observe(s));
  },
};
