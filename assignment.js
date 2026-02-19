console.log("assignment.js loaded");
const svg = d3.select("#matrix-chart")
  .attr("width", 800)
  .attr("height", 500);


d3.csv("temperature_daily.csv").then(rawData => {
  console.log("Loaded rows:", rawData.length);
  const parseDate = d3.timeParse("%Y-%m-%d");

  rawData.forEach(d => {
    d.date = parseDate(d.date);
    d.max_temperature = +d.max_temperature;
    d.min_temperature = +d.min_temperature;
    d.avgTemp = (d.max_temperature + d.min_temperature) / 2;
    d.year = d.date.getFullYear();
    d.month = d.date.getMonth(); // 0 = Jan
  });

  const latestYear = d3.max(rawData, d => d.year);
  const last10Years = rawData.filter(d => d.year >= latestYear - 9);

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
  
  console.log("Matrix rows:", matrixData.length);
  console.table(matrixData);

//DRAWING CELLS
const margin = { top: 40, right: 20, bottom: 40, left: 60 };
const width = 800 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// Clear SVG & create drawing group
svg.selectAll("*").remove();

const chart = svg
  .append("g")
  .attr("transform", `translate(${margin.left}, ${margin.top})`);

// ---- Unique years & months ----
const years = [...new Set(matrixData.map(d => d.year))];
const months = d3.range(12); // 0–11

// ---- Scales ----
const xScale = d3.scaleBand()
  .domain(years)
  .range([0, width])
  .padding(0.05);

const yScale = d3.scaleBand()
  .domain(months)
  .range([0, height])
  .padding(0.05);

// Color scale (warm palette for temperature)
const colorScale = d3.scaleSequential()
  .domain(d3.extent(matrixData, d => d.avgTemp))
  .interpolator(d3.interpolateYlOrRd);

const tooltip = d3.select("#tooltip");

chart.selectAll("rect")
  .data(matrixData)
  .join("rect")
  .attr("x", d => xScale(d.year))
  .attr("y", d => yScale(d.month))
  .attr("width", xScale.bandwidth())
  .attr("height", yScale.bandwidth())
  .attr("fill", d => colorScale(d.avgTemp))
  .on("mouseover", (event, d) => {
    tooltip.classed("hidden", false)
      .html(`
        <strong>${monthNames[d.month]} ${d.year}</strong><br>
        Max: ${d.max_temperature}°C<br>
        Min: ${d.min_temperature}°C<br>
        Avg: ${d.avgTemp.toFixed(1)}°C
      `)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px");
  })
  .on("mousemove", (event) => {
    tooltip
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px");
  })
  .on("mouseout", () => {
    tooltip.classed("hidden", true);
  });


  // ---- Month labels ----
const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

chart.selectAll(".month-label")
  .data(months)
  .join("text")
  .attr("class", "month-label")
  .attr("x", -10)
  .attr("y", d => yScale(d) + yScale.bandwidth() / 2)
  .attr("text-anchor", "end")
  .attr("dominant-baseline", "middle")
  .text(d => monthNames[d]);

// ---- Year labels ----
chart.selectAll(".year-label")
  .data(years)
  .join("text")
  .attr("class", "year-label")
  .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
  .attr("y", -10)
  .attr("text-anchor", "middle")
  .text(d => d);


// --- Legend parameters (unchanged)
const legendWidth = 20,
      legendHeight = height,
      legendMargin = 10;

const legend = svg.append("g")
  .attr("transform", `translate(${width + margin.left + legendMargin}, ${margin.top})`);

// --- Gradient (unchanged)
const defs = svg.append("defs");
const gradient = defs.append("linearGradient")
  .attr("id", "legend-gradient")
  .attr("x1","0%").attr("y1","100%")
  .attr("x2","0%").attr("y2","0%");

const [minTemp, maxTemp] = d3.extent(matrixData, d => d.avgTemp);
const nStops = 10;
for(let i=0;i<nStops;i++){
  const t = minTemp + i*(maxTemp-minTemp)/(nStops-1);
  gradient.append("stop")
    .attr("offset", `${(i/(nStops-1))*100}%`)
    .attr("stop-color", colorScale(t));
}

// --- Legend rectangle
legend.append("rect")
  .attr("width", legendWidth)
  .attr("height", legendHeight)
  .style("fill", "url(#legend-gradient)");

// --- Legend scale for axis
const legendScale = d3.scaleLinear()
  .domain([minTemp,maxTemp])
  .range([legendHeight,0]);  // flip so higher temp = top

// --- Add axis (with ticks)
const legendAxis = d3.axisRight(legendScale)
  .ticks(6)                 // number of markers/ticks
  .tickSize(6)               // length of the tick marks
  .tickFormat(d => d + "°C"); // label format

legend.append("g")
  .attr("transform", `translate(${legendWidth},0)`)
  .call(legendAxis);


}).catch(error => {
    console.error("CSV failed to load:", error);
  });
