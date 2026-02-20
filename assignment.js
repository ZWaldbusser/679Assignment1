//Setting Matrix Size
const w = 1000;
const h = 600;
const svg = d3.select("#matrix-chart")
  .attr("width", w)
  .attr("height", h);

let mode = "max"; // 🔹 toggle state (max ↔ min)

d3.csv("temperature_daily.csv").then(rawData => {
  
  // Data parsing
  console.log("Loaded rows:", rawData.length);
  const parseDate = d3.timeParse("%Y-%m-%d");
  rawData.forEach(d => {
    d.date = parseDate(d.date);
    d.max_temperature = +d.max_temperature;
    d.min_temperature = +d.min_temperature;
    d.avgTemp = (d.max_temperature + d.min_temperature) / 2;
    d.year = d.date.getFullYear();
    d.month = d.date.getMonth();
  });
  const latestYear = d3.max(rawData, d => d.year);
  const last10Years = rawData.filter(d => d.year >= latestYear - 9);

  // GROUP DAILY DATA FOR SPARKLINES
  const dailyLookup = d3.group(
    last10Years,
    d => d.year,
    d => d.month
  );

  const monthlyRollup = d3.rollups(
    last10Years,
    v => ({
      avgTemp: d3.mean(v, d => d.avgTemp),
      maxTemp: d3.max(v, d => d.max_temperature),
      minTemp: d3.min(v, d => d.min_temperature)
    }),
    d => d.year,
    d => d.month
  );

  const matrixData = monthlyRollup.flatMap(([year, months]) =>
    months.map(([month, stats]) => ({
      year,
      month,
      avgTemp: stats.avgTemp,
      max_temperature: stats.maxTemp,
      min_temperature: stats.minTemp
    }))
  );

  matrixData.sort((a, b) =>
    a.year === b.year ? a.month - b.month : a.year - b.year
  );

  // =========================
  // LAYOUT
  // =========================
  const margin = { top: 40, right: 60, bottom: 40, left: 60 };
  const width = w - margin.left - margin.right;
  const height = h - margin.top - margin.bottom;

  svg.selectAll("*").remove();

  const chart = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const years = [...new Set(matrixData.map(d => d.year))];
  const months = d3.range(12);

  const xScale = d3.scaleBand()
    .domain(years)
    .range([0, width])
    .padding(0.05);

  const yScale = d3.scaleBand()
    .domain(months)
    .range([0, height])
    .padding(0.05);

  // =========================
  // COLOR SCALE (Blue → Red)
  // =========================
  const colorScale = d3.scaleSequential()
    .domain([0, 40])
    .interpolator(d3.interpolateRdYlBu).domain([40, 0])
    .clamp(true);

  function getValue(d) {
    return mode === "max" ? d.max_temperature : d.min_temperature;
  }

  const tooltip = d3.select("#tooltip");

  // =========================
  // DRAW CELLS
  // =========================
  const cells = chart.selectAll("rect")
    .data(matrixData)
    .join("rect")
    .attr("x", d => xScale(d.year))
    .attr("y", d => yScale(d.month))
    .attr("width", xScale.bandwidth())
    .attr("height", yScale.bandwidth())
    .attr("fill", d => colorScale(getValue(d)))
    .on("mouseover", (event, d) => {
      tooltip.classed("hidden", false)
        .html(`
          <strong>${monthNames[d.month]} ${d.year}</strong><br>
          Max: ${d.max_temperature}°C<br>
          Min: ${d.min_temperature}°C<br>
          Avg: ${d.avgTemp.toFixed(1)}°C
        `);
    })
    .on("mousemove", (event) => {
      tooltip
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", () => tooltip.classed("hidden", true));

  // =========================
  // SPARKLINES (daily trends)
  // =========================
  const sparkGroup = chart.append("g").attr("class", "sparklines");

  matrixData.forEach(d => {
    const daily = dailyLookup.get(d.year)?.get(d.month);
    if (!daily) return;

    const xSpark = d3.scaleLinear()
      .domain([0, daily.length - 1])
      .range([2, xScale.bandwidth() - 2]);

    const ySpark = d3.scaleLinear()
      .domain([0, 40])
      .range([yScale.bandwidth() - 2, 2]);

    const line = d3.line()
      .x((_, i) => xSpark(i))
      .y(v => ySpark((v.max_temperature + v.min_temperature) / 2));

    sparkGroup.append("path")
      .datum(daily)
      .attr("transform", `translate(${xScale(d.year)}, ${yScale(d.month)})`)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "rgba(0,0,0,0.65)")
      .attr("stroke-width", 1.5)
      .attr("pointer-events", "none"); // don't block tooltip
  });

  // =========================
  // TOGGLE ON CLICK
  // =========================
  svg.on("click", () => {
    mode = mode === "max" ? "min" : "max";

    cells.transition()
      .duration(400)
      .attr("fill", d => colorScale(getValue(d)));
  });

  // =========================
  // AXIS LABELS
  // =========================
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  chart.selectAll(".month-label")
    .data(months)
    .join("text")
    .attr("class", "month-label")
    .attr("x", -10)
    .attr("y", d => yScale(d) + yScale.bandwidth()/2)
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "middle")
    .text(d => monthNames[d]);

  chart.selectAll(".year-label")
    .data(years)
    .join("text")
    .attr("class", "year-label")
    .attr("x", d => xScale(d) + xScale.bandwidth()/2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .text(d => d);

  // =========================
  // STATIC LEGEND (0–40 °C)
  // =========================
  const legendHeight = height;
  const legendWidth = 20;

  const legend = svg.append("g")
    .attr("transform", `translate(${width + margin.left + 20}, ${margin.top})`);

  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%").attr("y1", "100%")
    .attr("x2", "0%").attr("y2", "0%");

  const legendMin = 0;
  const legendMax = 40;

  const steps = 10;
  for (let i = 0; i < steps; i++) {
    const t = legendMin + i * (legendMax - legendMin) / (steps - 1);
    gradient.append("stop")
      .attr("offset", `${(i/(steps-1))*100}%`)
      .attr("stop-color", colorScale(t));
  }

  legend.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#legend-gradient)");

  const legendScale = d3.scaleLinear()
    .domain([legendMin, legendMax])
    .range([legendHeight, 0]);

  const legendAxis = d3.axisRight(legendScale)
    .ticks(8)
    .tickFormat(d => `${d}°C`);

  legend.append("g")
    .attr("transform", `translate(${legendWidth},0)`)
    .call(legendAxis);

}).catch(error => {
  console.error("CSV failed to load:", error);
});