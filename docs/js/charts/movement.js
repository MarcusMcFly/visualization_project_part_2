/* movement.js — fenotipos de movimiento (objetivo B) + reloj circadiano en D3 */
function renderMovement(app) {
  const d = app.data.derived_features;

  // --- Distribución de la intensidad media de movimiento por niño (Plotly) ---
  Plotly.newPlot(
    "chart-movement-bar",
    [{
      type: "histogram", x: d.map((p) => p.mean_intensity),
      nbinsx: 14, marker: { color: "#4ade80", line: { color: "#0f1420", width: 1 } },
    }],
    app.baseLayout("Intensidad media de movimiento por niño", {
      xaxis: { title: "Intensidad (G)", gridcolor: "#2c3852" },
      yaxis: { title: "nº de niños", gridcolor: "#2c3852" },
    }),
    app.config
  );

  drawCircadianClock(app);
}

/* Reloj circadiano radial con D3: cada sector = 1 hora, radio = intensidad media. */
function drawCircadianClock(app) {
  const data = app.data.hourly_activity.global; // [{hour, phase, mean_intensity, n_participants}]
  const container = document.getElementById("chart-circadian");
  container.innerHTML = "";

  const size = 340, inner = 42, R = size / 2 - 34;
  const maxI = d3.max(data, (d) => d.mean_intensity || 0) || 1;

  const svg = d3.select(container).append("svg").attr("width", size).attr("height", size);
  const g = svg.append("g").attr("transform", `translate(${size / 2},${size / 2})`);

  const ang = d3.scaleLinear().domain([0, 24]).range([0, 2 * Math.PI]);
  const rScale = d3.scaleLinear().domain([0, maxI]).range([inner, R]);
  const arc = d3.arc()
    .innerRadius(inner)
    .outerRadius((d) => rScale(d.mean_intensity || 0))
    .startAngle((d) => ang(d.hour))
    .endAngle((d) => ang(d.hour + 1))
    .padAngle(0.012).cornerRadius(2);

  // tooltip
  let tip = document.querySelector(".tooltip");
  if (!tip) { tip = document.createElement("div"); tip.className = "tooltip"; document.body.appendChild(tip); }

  g.selectAll("path.sector").data(data).join("path")
    .attr("class", "sector")
    .attr("d", arc)
    .attr("fill", (d) => (d.mean_intensity == null ? "#243049" : app.phaseColors[d.phase]))
    .attr("opacity", (d) => (d.mean_intensity == null ? 0.5 : 0.9))
    .on("mousemove", (e, d) => {
      tip.style.opacity = 1;
      tip.style.left = e.pageX + 12 + "px";
      tip.style.top = e.pageY + 12 + "px";
      tip.innerHTML = `<b>${String(d.hour).padStart(2, "0")}:00</b> · ${d.phase}<br>` +
        (d.mean_intensity == null ? "sin datos" : `intensidad ${d.mean_intensity.toFixed(3)} G<br>${d.n_participants} niños`);
    })
    .on("mouseleave", () => (tip.style.opacity = 0));

  // anillo guía
  g.append("circle").attr("r", R).attr("fill", "none").attr("stroke", "#2c3852");
  g.append("circle").attr("r", inner).attr("fill", "none").attr("stroke", "#2c3852");

  // etiquetas horarias cada 3h
  for (let h = 0; h < 24; h += 3) {
    const a = ang(h + 0.5) - Math.PI / 2;
    const rr = R + 16;
    g.append("text")
      .attr("x", Math.cos(a) * rr).attr("y", Math.sin(a) * rr)
      .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
      .text(String(h).padStart(2, "0") + "h");
  }

  // centro
  g.append("text").attr("text-anchor", "middle").attr("y", -4)
    .attr("fill", "#e6ebf5").style("font-size", "13px").text("Intensidad");
  g.append("text").attr("text-anchor", "middle").attr("y", 13)
    .attr("fill", "#93a0b8").style("font-size", "11px").text("por hora");
}
