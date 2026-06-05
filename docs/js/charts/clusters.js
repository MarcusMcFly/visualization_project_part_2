/* clusters.js — segmentación KMeans proyectada con PCA (objetivo D) */
function renderClusters(app) {
  const cl = app.data.clusters;
  const ev = cl.explained_variance || [0, 0];

  // --- Scatter PCA coloreado por cluster ---
  const traces = [];
  for (let c = 0; c < cl.k; c++) {
    const sub = cl.points.filter((p) => p.cluster === c);
    traces.push({
      type: "scatter", mode: "markers", name: `Grupo ${c + 1} (n=${sub.length})`,
      x: sub.map((p) => p.pca_x), y: sub.map((p) => p.pca_y),
      text: sub.map((p) => p.participant_id),
      marker: { size: 12, color: app.clusterColors[c], opacity: 0.85, line: { color: "#0f1420", width: 1.2 } },
      hovertemplate: `%{text}<extra>Grupo ${c + 1}</extra>`,
    });
  }
  Plotly.newPlot(
    "chart-clusters", traces,
    app.baseLayout(`Perfiles (KMeans k=${cl.k}, silueta=${cl.silhouette})`, {
      xaxis: { title: `PCA 1 · ${(ev[0] * 100).toFixed(0)}% var.`, gridcolor: "#2c3852" },
      yaxis: { title: `PCA 2 · ${(ev[1] * 100).toFixed(0)}% var.`, gridcolor: "#2c3852" },
      legend: { orientation: "h", y: -0.2 },
    }),
    app.config
  );

  // --- Tabla de perfiles medios ---
  const feats = cl.features;
  let html = "<table class='profiles'><thead><tr><th>Variable</th>";
  cl.profiles.forEach((p) => {
    html += `<th><span class="swatch" style="background:${app.clusterColors[p.cluster]}"></span>G${p.cluster + 1}</th>`;
  });
  html += "</tr><tr><td>n participantes</td>" + cl.profiles.map((p) => `<td>${p.n}</td>`).join("") + "</tr></thead><tbody>";
  feats.forEach((f) => {
    html += `<tr><td>${app.label(f)}</td>` +
      cl.profiles.map((p) => `<td>${p[f].toFixed(2)}</td>`).join("") + "</tr>";
  });
  html += "</tbody></table>";
  document.getElementById("cluster-profiles").innerHTML = html;
}
