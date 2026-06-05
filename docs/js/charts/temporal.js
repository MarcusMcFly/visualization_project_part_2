/* temporal.js — dinámica temporal (objetivo E) */
function renderTemporal(app) {
  // --- Curva de intensidad por hora del día (media poblacional) ---
  const h = app.data.hourly_activity.global;
  Plotly.newPlot(
    "chart-hourly",
    [{
      type: "scatter", mode: "lines+markers",
      x: h.map((d) => d.hour), y: h.map((d) => d.mean_intensity),
      line: { color: "#5cc8ff", width: 2, shape: "spline" },
      marker: { size: 7, color: "#5cc8ff" },
      connectgaps: false,
      hovertemplate: "%{x}:00<br>intensidad %{y:.3f} G<extra></extra>",
    }],
    app.baseLayout("Intensidad media por hora del día", {
      xaxis: { title: "hora", dtick: 3, gridcolor: "#2c3852" },
      yaxis: { title: "intensidad (G)", gridcolor: "#2c3852" },
    }),
    app.config
  );

  // --- Laborable vs. fin de semana ---
  const daily = app.data.daily_summary;
  const mean = (arr, k) => (arr.length ? arr.reduce((s, x) => s + x[k], 0) / arr.length : 0);
  const wd = daily.filter((x) => !x.weekend);
  const we = daily.filter((x) => x.weekend);

  Plotly.newPlot(
    "chart-weekday",
    [
      {
        type: "bar", name: "Intensidad media",
        x: ["Laborable", "Fin de semana"],
        y: [mean(wd, "mean_intensity"), mean(we, "mean_intensity")],
        marker: { color: "#b388ff" },
      },
      {
        type: "bar", name: "Fracción activa",
        x: ["Laborable", "Fin de semana"],
        y: [mean(wd, "active_fraction"), mean(we, "active_fraction")],
        marker: { color: "#4ade80" }, yaxis: "y2",
      },
    ],
    app.baseLayout("Laborable vs. fin de semana", {
      barmode: "group",
      xaxis: { gridcolor: "#2c3852" },
      yaxis: { title: "intensidad (G)", gridcolor: "#2c3852" },
      yaxis2: { title: "fracción activa", overlaying: "y", side: "right", range: [0, 1], showgrid: false },
      legend: { orientation: "h", y: -0.2 },
      annotations: [{
        text: `n laborable=${wd.length} · n finde=${we.length}`,
        showarrow: false, x: 0.5, xref: "paper", y: 1.08, yref: "paper",
        font: { color: "#93a0b8", size: 11 },
      }],
    }),
    app.config
  );
}
