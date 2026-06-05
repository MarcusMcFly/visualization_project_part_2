/* overview.js — KPIs, distribución por sexo e IMC */
function renderOverview(app) {
  const parts = app.data.participants;
  const psy = app.data.psychometric_summary;

  const nTotal = parts.length;
  const nSensor = parts.filter((p) => p.has_F || p.has_T).length;
  const nPsy = psy.filter((p) => p.sdq_total_difficulties != null).length;
  const nDays = app.data.daily_summary.length;

  const cards = [
    { value: nTotal, label: "Participantes" },
    { value: nSensor, label: "Con datos de sensor" },
    { value: nPsy, label: "Con cuestionario válido" },
    { value: nDays, label: "Días-persona grabados" },
  ];
  document.getElementById("kpi-cards").innerHTML = cards
    .map((c) => `<div class="card"><div class="value">${c.value}</div><div class="label">${c.label}</div></div>`)
    .join("");

  // --- Sexo ---
  const sexMap = { female: "Niñas", male: "Niños" };
  const counts = {};
  parts.forEach((p) => {
    const s = sexMap[p.sex] || "Desconocido";
    counts[s] = (counts[s] || 0) + 1;
  });
  Plotly.newPlot(
    "chart-sex",
    [{
      type: "pie", hole: 0.55,
      labels: Object.keys(counts), values: Object.values(counts),
      marker: { colors: ["#b388ff", "#5cc8ff", "#334155"] },
      textinfo: "label+percent",
    }],
    app.baseLayout("Distribución por sexo", { showlegend: false }),
    app.config
  );

  // --- IMC ---
  const bmis = parts.map((p) => p.bmi).filter((v) => v != null);
  Plotly.newPlot(
    "chart-bmi",
    [{ type: "histogram", x: bmis, nbinsx: 14, marker: { color: "#5cc8ff", line: { color: "#0f1420", width: 1 } } }],
    app.baseLayout("Distribución de IMC", {
      xaxis: { title: "IMC", gridcolor: "#2c3852" },
      yaxis: { title: "nº de niños", gridcolor: "#2c3852" },
    }),
    app.config
  );
}
