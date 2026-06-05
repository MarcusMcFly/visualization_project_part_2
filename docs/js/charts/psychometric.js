/* psychometric.js — distribuciones SDQ y SNAP-IV (objetivo A) */
function renderPsychometric(app) {
  const psy = app.data.psychometric_summary;
  const box = (k, name) => ({
    type: "box", name,
    y: psy.map((p) => p[k]).filter((v) => v != null),
    boxpoints: "all", jitter: 0.4, pointpos: 0,
    marker: { size: 5, opacity: 0.6 },
  });

  // SDQ — subescalas
  const sdq = [
    box("sdq_emotional", "Emocional"),
    box("sdq_conduct", "Conducta"),
    box("sdq_hyperactivity", "Hiperactividad"),
    box("sdq_peer", "Iguales"),
    box("sdq_prosocial", "Prosocial"),
  ];
  Plotly.newPlot(
    "chart-sdq", sdq,
    app.baseLayout("Subescalas SDQ", {
      showlegend: false,
      yaxis: { title: "Puntuación (0–10)", gridcolor: "#2c3852" },
    }),
    app.config
  );

  // SNAP-IV — subescalas
  const snap = [
    box("snap_inattention", "Inatención"),
    box("snap_hyperactivity_impulsivity", "Hiperact./Impuls."),
    box("snap_odd", "ODD"),
  ];
  Plotly.newPlot(
    "chart-snap", snap,
    app.baseLayout("Subescalas SNAP-IV (TDAH)", {
      showlegend: false,
      yaxis: { title: "Media por ítem (0–3)", gridcolor: "#2c3852" },
    }),
    app.config
  );
}
