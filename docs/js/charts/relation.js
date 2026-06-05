/* relation.js — correlaciones (heatmap) + scatter interactivo (objetivo C) */
function renderRelation(app) {
  const c = app.data.correlations;

  // --- Heatmap de correlación ---
  Plotly.newPlot(
    "chart-corr",
    [{
      type: "heatmap",
      z: c.matrix,
      x: c.cols.map((k) => app.label(k)),
      y: c.rows.map((k) => app.label(k)),
      zmin: -1, zmax: 1, zmid: 0,
      colorscale: [[0, "#fb7185"], [0.5, "#161d2e"], [1, "#5cc8ff"]],
      colorbar: { title: "r", tickfont: { color: "#93a0b8" } },
      hovertemplate: "%{y} ↔ %{x}<br>r = %{z}<extra></extra>",
    }],
    app.baseLayout("Correlación movimiento × salud mental (Pearson)", {
      margin: { l: 170, r: 20, t: 44, b: 150 },
      xaxis: { tickangle: -40, automargin: true },
      yaxis: { automargin: true },
    }),
    app.config
  );

  // --- Scatter interactivo con selectores ---
  const selX = document.getElementById("sel-x");
  const selY = document.getElementById("sel-y");
  selX.innerHTML = c.rows.map((k) => `<option value="${k}">${app.label(k)}</option>`).join("");
  selY.innerHTML = c.cols.map((k) => `<option value="${k}">${app.label(k)}</option>`).join("");
  selX.value = "mean_intensity";
  selY.value = "snap_hyperactivity_impulsivity";

  const draw = () => {
    const xk = selX.value, yk = selY.value;
    const pts = app.rows.filter((r) => r[xk] != null && r[yk] != null);
    Plotly.newPlot(
      "chart-scatter",
      [{
        type: "scatter", mode: "markers",
        x: pts.map((r) => r[xk]), y: pts.map((r) => r[yk]),
        text: pts.map((r) => r.participant_id),
        marker: { size: 10, color: "#b388ff", opacity: 0.8, line: { color: "#0f1420", width: 1 } },
        hovertemplate: `%{text}<br>${app.label(xk)}: %{x:.3f}<br>${app.label(yk)}: %{y:.2f}<extra></extra>`,
      }],
      app.baseLayout(`${app.label(yk)} vs ${app.label(xk)}`, {
        xaxis: { title: app.label(xk), gridcolor: "#2c3852" },
        yaxis: { title: app.label(yk), gridcolor: "#2c3852" },
      }),
      app.config
    );
  };
  selX.onchange = draw;
  selY.onchange = draw;
  draw();
}
