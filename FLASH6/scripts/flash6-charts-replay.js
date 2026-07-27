/* FLASH6 runtime module: flash6-charts-replay.js. Loaded in manifest order by flash6.js. */
    // =====================
    // 캔버스 DPR 보정
    // =====================
    function ensureCanvasSize(canvas){
      const rect = canvas.getBoundingClientRect();
      if(rect.width < 2 || rect.height < 2 || canvas.offsetParent === null){
        return null;
      }
      if(!canvas._cssInit){
        const fixedW = canvas.dataset.fixedWidth ? Number(canvas.dataset.fixedWidth) : null;
        canvas.style.width = (fixedW && fixedW > 0) ? (fixedW + "px") : "100%";
        const fixedH = canvas.dataset.fixedHeight ? Number(canvas.dataset.fixedHeight) : null;
        canvas.style.height = (fixedH && fixedH > 0) ? (fixedH + "px") : "";
        canvas._cssInit = true;
      }

      let parentContentWidth = 0;
      if(canvas.parentElement){
        const parentRect = canvas.parentElement.getBoundingClientRect();
        const parentStyle = getComputedStyle(canvas.parentElement);
        const padLeft = parseFloat(parentStyle.paddingLeft) || 0;
        const padRight = parseFloat(parentStyle.paddingRight) || 0;
        parentContentWidth = Math.max(0, parentRect.width - padLeft - padRight);
      }
      const fixedW = canvas.dataset.fixedWidth ? Number(canvas.dataset.fixedWidth) : null;
      const cssW = Math.max(160, (fixedW && fixedW > 0) ? fixedW : Math.floor(parentContentWidth || rect.width || 200));
      const fixedH = canvas.dataset.fixedHeight ? Number(canvas.dataset.fixedHeight) : null;
      const cssH = Math.max(180, (fixedH && fixedH > 0) ? fixedH : (rect.height || 220));
      const dpr  = window.devicePixelRatio || 1;

      if(canvas._cssW!==cssW || canvas._cssH!==cssH || canvas._dpr!==dpr){
        canvas.width  = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        canvas._cssW = cssW; canvas._cssH = cssH; canvas._dpr = dpr;
      }
      if(!canvas || typeof canvas.getContext !== "function") return null;
      const ctx = canvas.getContext("2d");
      if(!ctx || typeof ctx.setTransform !== "function") return null;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      return { w: cssW, h: cssH, ctx };
    }
    // =====================
    // 차트
    // =====================
    function getChartAxisDigits(canvasId, min, max){
      if(canvasId === "thrustChart") return getLoadcellChartDigits();
      if(canvasId === "pressureChart") return 3;
      const span = Math.abs(Number(max || 0) - Number(min || 0));
      const absMax = Math.max(Math.abs(Number(min || 0)), Math.abs(Number(max || 0)));
      if(canvasId === "accelChartFlight") return absMax >= 100 ? 0 : 1;
      if(canvasId === "accelXYZChart" || canvasId === "accelXYZChartFlight") return absMax >= 10 ? 1 : 2;
      if(span >= 50 || absMax >= 100) return 0;
      if(span >= 5 || absMax >= 10) return 1;
      if(span >= 0.5 || absMax >= 1) return 2;
      return 3;
    }

    function calcAscentAccelG(ax, ay, az){
      const x = Number(ax);
      const y = Number(ay);
      const z = Number(az);
      if(!isFinite(x) || !isFinite(y) || !isFinite(z)) return NaN;
      return Math.sqrt((x * x) + (y * y) + (z * z)) - 1;
    }

    function calcTotalAccelG(ax, ay, az){
      const x = Number(ax);
      const y = Number(ay);
      const z = Number(az);
      if(!isFinite(x) || !isFinite(y) || !isFinite(z)) return NaN;
      return Math.sqrt((x * x) + (y * y) + (z * z));
    }

    function getChartPlotBox(width, height){
      return {
        left: Math.max(24, Math.min(32, Math.round(width * 0.058))),
        top: 4,
        right: Math.max(4, Math.min(12, Math.round(width * 0.02))),
        bottom: 16
      };
    }

    function getNiceStep(rawStep){
      if(!(rawStep > 0) || !isFinite(rawStep)) return 1;
      const exp = Math.floor(Math.log10(rawStep));
      const base = rawStep / Math.pow(10, exp);
      let niceBase = 1;
      if(base <= 1) niceBase = 1;
      else if(base <= 2) niceBase = 2;
      else if(base <= 2.5) niceBase = 2.5;
      else if(base <= 5) niceBase = 5;
      else niceBase = 10;
      return niceBase * Math.pow(10, exp);
    }

    function buildNiceTicks(min, max, targetCount){
      let safeMin = Number(min);
      let safeMax = Number(max);
      if(!isFinite(safeMin) || !isFinite(safeMax)){
        return {ticks:[], min:0, max:1, step:1};
      }
      if(safeMin === safeMax){
        const pad = Math.abs(safeMin) > 0 ? Math.abs(safeMin) * 0.25 : 1;
        safeMin -= pad;
        safeMax += pad;
      }
      const span = safeMax - safeMin;
      const step = getNiceStep(span / Math.max(2, Number(targetCount) || 4));
      const niceMin = Math.floor(safeMin / step) * step;
      const niceMax = Math.ceil(safeMax / step) * step;
      const ticks = [];
      for(let value = niceMin, i = 0; value <= niceMax + (step * 0.5) && i < 32; value += step, i++){
        ticks.push(Number(value.toFixed(10)));
      }
      return {ticks, min:niceMin, max:niceMax, step};
    }

    function expandChartValueRange(min, max){
      let safeMin = Number(min);
      let safeMax = Number(max);
      if(!isFinite(safeMin) || !isFinite(safeMax)){
        return {min:0, max:1};
      }
      if(safeMin === safeMax){
        const pad = Math.abs(safeMin) > 0 ? Math.abs(safeMin) * 0.18 : 1;
        return {min:safeMin - pad, max:safeMax + pad};
      }
      const pad = (safeMax - safeMin) * 0.08;
      return {min:safeMin - pad, max:safeMax + pad};
    }

    function getChartTimeMeta(dataLength, indices, timeData){
      const timeline = Array.isArray(timeData) && timeData.length === dataLength
        ? timeData
        : chartTimeHistory;
      if(timeline.length !== dataLength) return null;
      if(indices.start < 0 || indices.end >= timeline.length || indices.end <= indices.start) return null;
      const usingStageTimeline = timeline !== chartTimeHistory;
      const originMs = usingStageTimeline
        ? Number(timeline[0] || 0)
        : (isFinite(Number(firstSampleMs)) ? Number(firstSampleMs) : Number(timeline[0] || 0));
      const firstMs = Number(timeline[indices.start]);
      const lastMs = Number(timeline[indices.end]);
      if(!isFinite(firstMs) || !isFinite(lastMs)) return null;
      const min = (firstMs - originMs) / 1000;
      const max = (lastMs - originMs) / 1000;
      return {
        originMs,
        min,
        max: (max > min) ? max : (min + 1),
        timeline
      };
    }

    function chartTimeValueSec(timeMeta, absoluteIndex, fallbackIndex){
      if(!timeMeta) return fallbackIndex;
      const timeline = timeMeta.timeline || chartTimeHistory;
      const ms = Number(timeline[absoluteIndex]);
      if(!isFinite(ms)) return fallbackIndex;
      return (ms - timeMeta.originMs) / 1000;
    }

    function formatChartAxisNumber(value, digits){
      const out = formatFixedDisplay(value, digits, "--");
      return /^-0(?:\.0+)?$/.test(out) ? out.slice(1) : out;
    }

    function formatChartTimeTick(sec, stepSec){
      const step = Math.abs(Number(stepSec) || 0);
      let digits = 0;
      if(step > 0 && step < 0.2) digits = 2;
      else if(step > 0 && step < 1) digits = 1;
      const abs = Math.abs(Number(sec) || 0);
      if(abs >= 60 && digits === 0){
        const sign = sec < 0 ? "-" : "";
        const totalSec = Math.abs(sec);
        const minutes = Math.floor(totalSec / 60);
        const seconds = Math.round(totalSec % 60);
        return sign + minutes + ":" + String(seconds).padStart(2, "0");
      }
      return formatChartAxisNumber(sec, digits) + "s";
    }

    function drawChartAxes(ctx, width, height, plotBox, xTicks, yTicks, formatX, formatY){
      const plotLeft = plotBox.left;
      const plotTop = plotBox.top;
      const plotRight = width - plotBox.right;
      const plotBottom = height - plotBox.bottom;

      ctx.save();
      ctx.strokeStyle = "rgba(148,163,184,0.26)";
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3,5]);
      yTicks.forEach((tick)=>{
        ctx.beginPath();
        ctx.moveTo(plotLeft, tick.px);
        ctx.lineTo(plotRight, tick.px);
        ctx.stroke();
      });
      ctx.setLineDash([2,6]);
      xTicks.forEach((tick)=>{
        ctx.beginPath();
        ctx.moveTo(tick.px, plotTop);
        ctx.lineTo(tick.px, plotBottom);
        ctx.stroke();
      });
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(100,116,139,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotLeft, plotTop);
      ctx.lineTo(plotLeft, plotBottom);
      ctx.lineTo(plotRight, plotBottom);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = "10px -apple-system,BlinkMacSystemFont,system-ui,sans-serif";
      ctx.fillStyle = "rgba(71,85,105,0.82)";
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      yTicks.forEach((tick)=>{
        ctx.fillText(formatY(tick.value), plotLeft - 3, tick.px);
      });
      ctx.textBaseline = "top";
      xTicks.forEach((tick, index)=>{
        if(index === 0) ctx.textAlign = "left";
        else if(index === xTicks.length - 1) ctx.textAlign = "right";
        else ctx.textAlign = "center";
        ctx.fillText(formatX(tick.value), tick.px, plotBottom + 4);
      });
      ctx.restore();
    }

    function drawChart(canvasId, data, color, view, options){
      const canvas=document.getElementById(canvasId);
      if(!canvas) return;
      const opts = options || {};

      const size = ensureCanvasSize(canvas);
      if(!size) return;
      const { w:width, h:height, ctx } = size;
      ctx.clearRect(0,0,width,height);

      if(!data || data.length<2){
        ctx.save();
        ctx.fillStyle="rgba(71,85,105,0.65)";
        ctx.font="12px -apple-system,BlinkMacSystemFont,system-ui,sans-serif";
        ctx.textAlign="center";
        ctx.textBaseline="middle";
        ctx.fillText(t("chartNoData"), width/2, height/2);
        ctx.restore();
        return;
      }
      const indices=getViewIndices(data,view,opts.timeData);
      if(indices.end<indices.start) return;

      const count = indices.end - indices.start + 1;
      if(count<2) return;
      const valueAt = (typeof opts.valueMap === "function")
        ? (index)=>opts.valueMap(data[index], index)
        : (index)=>data[index];
      const timeMeta = getChartTimeMeta(data.length, indices, opts.timeData);
      const plotBox = getChartPlotBox(width, height);
      const plotLeft = plotBox.left;
      const plotTop = plotBox.top;
      const plotRight = width - plotBox.right;
      const plotBottom = height - plotBox.bottom;
      const plotWidth = Math.max(24, plotRight - plotLeft);
      const plotHeight = Math.max(24, plotBottom - plotTop);

      let firstValue = Number(valueAt(indices.start));
      if(!isFinite(firstValue)) firstValue = 0;
      let min=firstValue, max=firstValue, sum=0;
      for(let absIndex=indices.start;absIndex<=indices.end;absIndex++){
        const v = Number(valueAt(absIndex));
        const safeV = isFinite(v) ? v : 0;
        if(safeV<min) min=safeV;
        if(safeV>max) max=safeV;
        sum+=safeV;
      }
      const avg=sum/count;
      const hasCustomYRange =
        isFinite(Number(opts.yMin)) &&
        isFinite(Number(opts.yMax)) &&
        Number(opts.yMax) > Number(opts.yMin);
      const displayRange = hasCustomYRange
        ? {min:Number(opts.yMin), max:Number(opts.yMax)}
        : expandChartValueRange(min, max);
      const yAxis = buildNiceTicks(displayRange.min, displayRange.max, height < 220 ? 4 : 5);
      const yMin = yAxis.min;
      const yMax = yAxis.max;
      const ySpan = (yMax - yMin) || 1;
      const xMin = timeMeta ? timeMeta.min : 0;
      const xMax = timeMeta ? timeMeta.max : Math.max(1, count - 1);
      const xSpan = (xMax - xMin) || 1;
      const xAxis = buildNiceTicks(xMin, xMax, width < 260 ? 3 : (width < 420 ? 4 : 5));
      const xTicks = xAxis.ticks.map((value)=>{
        const px = plotLeft + (((value - xMin) / xSpan) * plotWidth);
        return {value, px};
      }).filter((tick)=>tick.px >= (plotLeft - 1) && tick.px <= (plotRight + 1));
      const yTicks = yAxis.ticks.map((value)=>{
        const px = plotBottom - (((value - yMin) / ySpan) * plotHeight);
        return {value, px};
      }).filter((tick)=>tick.px >= (plotTop - 1) && tick.px <= (plotBottom + 1));
      const valueDigits = getChartAxisDigits(canvasId, yMin, yMax);
      drawChartAxes(
        ctx,
        width,
        height,
        plotBox,
        xTicks,
        yTicks,
        (value)=>formatChartTimeTick(value, xAxis.step),
        (value)=>formatChartAxisNumber(value, valueDigits)
      );

      function yPos(value){
        return plotBottom - ((value-yMin)/ySpan)*plotHeight;
      }
      function xPos(absIndex){
        const xValue = chartTimeValueSec(timeMeta, absIndex, absIndex - indices.start);
        return plotLeft + (((xValue - xMin) / xSpan) * plotWidth);
      }

      const thresholdLines = Array.isArray(opts.thresholdLines) ? opts.thresholdLines : [];
      if(thresholdLines.length){
        ctx.save();
        ctx.font = "10px -apple-system,BlinkMacSystemFont,system-ui,sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        thresholdLines.forEach((line)=>{
          if(!line) return;
          const value = Number(line.value);
          if(!isFinite(value) || value < yMin || value > yMax) return;
          const y = yPos(value);
          const lineColor = line.color || "rgba(249,115,22,0.88)";
          ctx.strokeStyle = lineColor;
          ctx.setLineDash([5,4]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(plotLeft, y);
          ctx.lineTo(plotRight, y);
          ctx.stroke();
          if(line.label){
            ctx.fillStyle = lineColor;
            ctx.fillText(String(line.label), plotLeft + 4, Math.max(plotTop + 10, y - 3));
          }
        });
        ctx.restore();
      }

      ctx.beginPath();
      for(let absIndex=indices.start;absIndex<=indices.end;absIndex++){
        const x=xPos(absIndex);
        const v = Number(valueAt(absIndex));
        const y=yPos(isFinite(v) ? v : 0);
        if(absIndex===indices.start) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      }
      ctx.strokeStyle=color;
      ctx.lineWidth=1.4;
      ctx.stroke();

      const lastX=xPos(indices.end);
      const bottomY=plotBottom;
      ctx.lineTo(lastX,bottomY);
      ctx.lineTo(plotLeft,bottomY);
      ctx.closePath();

      const grad=ctx.createLinearGradient(0,0,0,height);
      grad.addColorStop(0,colorToRgba(color,0.35));
      grad.addColorStop(0.5,colorToRgba(color,0.18));
      grad.addColorStop(1,colorToRgba(color,0));
      ctx.fillStyle=grad;
      ctx.fill();

      const yAvg=yPos(avg);
      ctx.save();
      ctx.setLineDash([6,4]);
      ctx.strokeStyle=colorToRgba(color,0.7);
      ctx.lineWidth=1.0;
      ctx.beginPath(); ctx.moveTo(plotLeft,yAvg); ctx.lineTo(plotRight,yAvg); ctx.stroke();
      ctx.restore();

      const yMaxLine=yPos(max);
      ctx.save();
      ctx.setLineDash([3,3]);
      ctx.strokeStyle=colorToRgba(color,0.9);
      ctx.lineWidth=0.9;
      ctx.beginPath(); ctx.moveTo(plotLeft,yMaxLine); ctx.lineTo(plotRight,yMaxLine); ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font="10px -apple-system,BlinkMacSystemFont,system-ui,sans-serif";
      ctx.fillStyle=colorToRgba(color,0.9);
      ctx.textAlign="right";
      ctx.textBaseline="bottom";
      ctx.fillText("AVG "+formatFixedDisplay(avg, valueDigits, "--"),width-4,Math.max(plotTop + 10, yAvg - 2));
      ctx.textBaseline="top";
      ctx.fillText("MAX "+formatFixedDisplay(max, valueDigits, "--"),width-4,Math.min(plotBottom - 10, yMaxLine + 2));
      ctx.restore();
    }

    function drawChartMulti(canvasId, series, colors, view){
      const canvas=document.getElementById(canvasId);
      if(!canvas) return;

      const size = ensureCanvasSize(canvas);
      if(!size) return;
      const { w:width, h:height, ctx } = size;
      ctx.clearRect(0,0,width,height);

      const base = (series && series.length) ? series[0] : null;
      if(!base || base.length < 2){
        ctx.save();
        ctx.fillStyle="rgba(71,85,105,0.65)";
        ctx.font="12px -apple-system,BlinkMacSystemFont,system-ui,sans-serif";
        ctx.textAlign="center";
        ctx.textBaseline="middle";
        ctx.fillText(t("chartNoData"), width/2, height/2);
        ctx.restore();
        return;
      }

      const indices=getViewIndices(base,view);
      if(indices.end<indices.start) return;

      const timeMeta = getChartTimeMeta(base.length, indices);
      const plotBox = getChartPlotBox(width, height);
      const plotLeft = plotBox.left;
      const plotTop = plotBox.top;
      const plotRight = width - plotBox.right;
      const plotBottom = height - plotBox.bottom;
      const plotWidth = Math.max(24, plotRight - plotLeft);
      const plotHeight = Math.max(24, plotBottom - plotTop);
      const count = indices.end - indices.start + 1;
      if(count < 2) return;

      let min = Infinity;
      let max = -Infinity;
      for(const arr of series){
        for(let i = indices.start; i <= indices.end; i++){
          const v = Number(arr && arr[i]);
          if(!isFinite(v)) continue;
          if(v < min) min = v;
          if(v > max) max = v;
        }
      }
      if(!isFinite(min) || !isFinite(max)) return;
      const displayRange = expandChartValueRange(min, max);
      const yAxis = buildNiceTicks(displayRange.min, displayRange.max, height < 220 ? 4 : 5);
      const yMin = yAxis.min;
      const yMax = yAxis.max;
      const ySpan = (yMax - yMin) || 1;
      const xMin = timeMeta ? timeMeta.min : 0;
      const xMax = timeMeta ? timeMeta.max : Math.max(1, count - 1);
      const xSpan = (xMax - xMin) || 1;
      const xAxis = buildNiceTicks(xMin, xMax, width < 260 ? 3 : (width < 420 ? 4 : 5));
      const xTicks = xAxis.ticks.map((value)=>{
        const px = plotLeft + (((value - xMin) / xSpan) * plotWidth);
        return {value, px};
      }).filter((tick)=>tick.px >= (plotLeft - 1) && tick.px <= (plotRight + 1));
      const yTicks = yAxis.ticks.map((value)=>{
        const px = plotBottom - (((value - yMin) / ySpan) * plotHeight);
        return {value, px};
      }).filter((tick)=>tick.px >= (plotTop - 1) && tick.px <= (plotBottom + 1));
      const valueDigits = getChartAxisDigits(canvasId, yMin, yMax);
      drawChartAxes(
        ctx,
        width,
        height,
        plotBox,
        xTicks,
        yTicks,
        (value)=>formatChartTimeTick(value, xAxis.step),
        (value)=>formatChartAxisNumber(value, valueDigits)
      );

      function yPos(value){
        return plotBottom - ((value-yMin)/ySpan)*plotHeight;
      }
      function xPos(absIndex){
        const xValue = chartTimeValueSec(timeMeta, absIndex, absIndex - indices.start);
        return plotLeft + (((xValue - xMin) / xSpan) * plotWidth);
      }

      series.forEach((arr, idx)=>{
        const color = colors && colors[idx] ? colors[idx] : "#0f172a";
        ctx.beginPath();
        for(let i=indices.start;i<=indices.end;i++){
          const v = arr && arr[i];
          const x=xPos(i);
          const y=yPos(isFinite(v) ? v : min);
          if(i===indices.start) ctx.moveTo(x,y);
          else ctx.lineTo(x,y);
        }
        ctx.strokeStyle=color;
        ctx.lineWidth=1.2;
        ctx.stroke();
      });
    }

    function drawChartDualAxis(canvasId, leftData, rightData, leftColor, rightColor, view, options){
      const canvas = document.getElementById(canvasId);
      if(!canvas) return;
      const opts = options || {};
      const size = ensureCanvasSize(canvas);
      if(!size) return;
      const {w:width, h:height, ctx} = size;
      ctx.clearRect(0, 0, width, height);
      const base = leftData && leftData.length >= 2 ? leftData : rightData;
      if(!base || base.length < 2){
        ctx.save();
        ctx.fillStyle = "rgba(71,85,105,0.65)";
        ctx.font = "12px -apple-system,BlinkMacSystemFont,system-ui,sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(t("chartNoData"), width / 2, height / 2);
        ctx.restore();
        return;
      }
      const indices = getViewIndices(base, view, opts.timeData);
      if(indices.end < indices.start) return;
      const rangeFor = (data)=>{
        let min = Infinity, max = -Infinity;
        for(let i=indices.start;i<=indices.end;i++){
          const value = Number(data && data[i]);
          if(!isFinite(value)) continue;
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
        if(!isFinite(min) || !isFinite(max)) return {min:0, max:1};
        return expandChartValueRange(min, max);
      };
      const leftRange = rangeFor(leftData);
      const rightRange = rangeFor(rightData);
      const leftAxis = buildNiceTicks(leftRange.min, leftRange.max, height < 220 ? 4 : 5);
      const rightAxis = buildNiceTicks(rightRange.min, rightRange.max, height < 220 ? 4 : 5);
      const leftSpan = (leftAxis.max - leftAxis.min) || 1;
      const rightSpan = (rightAxis.max - rightAxis.min) || 1;
      const timeMeta = getChartTimeMeta(base.length, indices, opts.timeData);
      const xMin = timeMeta ? timeMeta.min : 0;
      const xMax = timeMeta ? timeMeta.max : Math.max(1, indices.end - indices.start);
      const xSpan = (xMax - xMin) || 1;
      const basePlotBox = getChartPlotBox(width, height);
      const plotBox = Object.assign({}, basePlotBox, {right:Math.max(basePlotBox.right, 44)});
      const plotLeft = plotBox.left;
      const plotTop = plotBox.top;
      const plotRight = width - plotBox.right;
      const plotBottom = height - plotBox.bottom;
      const plotWidth = Math.max(24, plotRight - plotLeft);
      const plotHeight = Math.max(24, plotBottom - plotTop);
      const xAxis = buildNiceTicks(xMin, xMax, width < 300 ? 3 : (width < 460 ? 4 : 5));
      const xTicks = xAxis.ticks.map((value)=>({
        value,
        px:plotLeft + (((value - xMin) / xSpan) * plotWidth)
      }));
      const leftTicks = leftAxis.ticks.map((value)=>({
        value,
        px:plotBottom - (((value - leftAxis.min) / leftSpan) * plotHeight)
      }));
      const leftDigits = getChartAxisDigits(canvasId, leftAxis.min, leftAxis.max);
      const rightDigits = getChartAxisDigits(canvasId + "Altitude", rightAxis.min, rightAxis.max);
      drawChartAxes(
        ctx,
        width,
        height,
        plotBox,
        xTicks,
        leftTicks,
        (value)=>formatChartTimeTick(value, xAxis.step),
        (value)=>formatChartAxisNumber(value, leftDigits)
      );
      ctx.save();
      ctx.strokeStyle = colorToRgba(rightColor, 0.42);
      ctx.fillStyle = rightColor;
      ctx.font = "9px -apple-system,BlinkMacSystemFont,system-ui,sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      rightAxis.ticks.forEach((value)=>{
        const y = plotBottom - (((value - rightAxis.min) / rightSpan) * plotHeight);
        ctx.beginPath();
        ctx.moveTo(plotRight, y);
        ctx.lineTo(plotRight + 4, y);
        ctx.stroke();
        ctx.fillText(formatChartAxisNumber(value, rightDigits), plotRight + 7, y);
      });
      ctx.restore();
      const xPos = (index)=>{
        const xValue = chartTimeValueSec(timeMeta, index, index - indices.start);
        return plotLeft + (((xValue - xMin) / xSpan) * plotWidth);
      };
      const drawSeries = (data, color, axisMin, axisSpan)=>{
        ctx.save();
        ctx.beginPath();
        let started = false;
        for(let i=indices.start;i<=indices.end;i++){
          const value = Number(data && data[i]);
          if(!isFinite(value)){
            started = false;
            continue;
          }
          const x = xPos(i);
          const y = plotBottom - (((value - axisMin) / axisSpan) * plotHeight);
          if(!started){
            ctx.moveTo(x, y);
            started = true;
          }else{
            ctx.lineTo(x, y);
          }
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      };
      drawSeries(leftData, leftColor, leftAxis.min, leftSpan);
      drawSeries(rightData, rightColor, rightAxis.min, rightSpan);
    }

    function redrawCharts(){
      const selectedStage = stageTelemetryModeActive
        ? stageTelemetryStore[dashboardTelemetryStageId]
        : null;
      const selectedStageHasData = !!(selectedStage && selectedStage.valid);
      const flightAltitudeHistory = selectedStageHasData
        ? selectedStage.altitudeHistory
        : (selectedStage ? [] : quickAltitudeHistory);
      const flightAccelHistory = selectedStageHasData
        ? selectedStage.ascentAccelHistory
        : (selectedStage ? [] : ascentAccelHistory);
      const flightTimeHistory = selectedStageHasData
        ? selectedStage.timeHistory
        : null;
      drawChart("thrustChart", thrustBaseHistory, "#ef4444", chartView, {valueMap: convertThrustForDisplay});
      drawChart("pressureChart", pressureBaseHistory, "#3b82f6", chartView);
      drawChart("accelChart", accelMagHistory, "#f59e0b", chartView);
      drawChart("accelChartFlight", flightAltitudeHistory, "#16a34a", chartView, {
        timeData:flightTimeHistory
      });
      drawChartMulti("accelXYZChart",
        [accelXHistory, accelYHistory, accelZHistory],
        ["#ef4444", "#22c55e", "#3b82f6"],
        chartView);
      drawChartDualAxis(
        "accelXYZChartFlight",
        flightAccelHistory,
        flightAltitudeHistory,
        "#f59e0b",
        "#16a34a",
        chartView,
        {timeData:flightTimeHistory}
      );
      renderMobileChartPreview();
    }

    function getMobileChartDefs(){
      return [
        {key:"altitude", label:"고도", short:"고도", color:"#22c55e", data:quickAltitudeHistory},
        {key:"speed", label:"G 가속도", short:"G", color:"#38bdf8", data:accelMagHistory},
        {key:"accel", label:"가속도", short:"가속도", color:"#f59e0b", data:accelMagHistory},
        {key:"thrust", label:"추력", short:"추력", color:"#ef4444", data:thrustBaseHistory},
        {key:"pressure", label:"압력", short:"압력", color:"#3b82f6", data:pressureBaseHistory},
        {key:"temp", label:"온도", short:"온도", color:"#a78bfa", data:chipTempHistory},
        {key:"battery", label:"배터리", short:"배터리", color:"#84cc16", data:batteryPctHistory},
        {key:"perf", label:"성능", short:"성능", color:"#0ea5e9", data:perfLoadHistory},
        {key:"gyroX", label:"자이로 X", short:"GYRO X", color:"#fb7185", data:gyroXHistory},
        {key:"gyroY", label:"자이로 Y", short:"GYRO Y", color:"#4ade80", data:gyroYHistory},
        {key:"gyroZ", label:"자이로 Z", short:"GYRO Z", color:"#60a5fa", data:gyroZHistory}
      ];
    }

    function getSelectedMobileChartDefs(){
      const defs = getMobileChartDefs();
      const selected = Array.isArray(mobileChartSelectedKeys) ? mobileChartSelectedKeys : [];
      return selected
        .map(key=>defs.find(def=>def.key === key))
        .filter(Boolean);
    }

    function setMobileChartPickerVisible(open){
      if(!el.mobileChartPickerOverlay) return;
      if(open){
        if(el.mobileChartOptions){
          el.mobileChartOptions.forEach(input=>{
            input.checked = mobileChartSelectedKeys.indexOf(input.value) >= 0;
          });
        }
      }
      setOverlayVisible(el.mobileChartPickerOverlay, !!open);
    }

    function updateMobileChartSelectButton(){
      if(!el.mobileChartSelectBtn) return;
      const selectedDefs = getSelectedMobileChartDefs();
      let text = "차트 데이터 선택하기 >";
      if(!isDeviceUiOnline()){
        text = "기기 오프라인";
      }else if(selectedDefs.length){
        const names = selectedDefs.slice(0, 2).map(def=>def.short).join(" · ");
        const more = selectedDefs.length > 2 ? " +" + (selectedDefs.length - 2) : "";
        text = names + more + " >";
      }
      el.mobileChartSelectBtn.textContent = text;
    }

    function drawMobileChartPreviewLines(canvas, defs){
      const size = ensureCanvasSize(canvas);
      if(!size) return false;
      const {w:width, h:height, ctx} = size;
      ctx.clearRect(0, 0, width, height);
      if(!defs || !defs.length) return false;
      const series = defs
        .map(def=>{
          const src = Array.isArray(def.data) ? def.data : [];
          const tail = src.slice(Math.max(0, src.length - 140))
            .map(v=>Number(v))
            .filter(v=>isFinite(v));
          return {...def, values:tail};
        })
        .filter(def=>def.values.length >= 2);
      if(!series.length) return false;

      const padL = 4;
      const padR = 3;
      const padT = 3;
      const padB = 4;
      const plotW = Math.max(20, width - padL - padR);
      const plotH = Math.max(20, height - padT - padB);

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.075)";
      ctx.lineWidth = 1;
      for(let i=0;i<=3;i++){
        const y = padT + (plotH * i / 3);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(width - padR, y);
        ctx.stroke();
      }
      for(let i=0;i<=4;i++){
        const x = padL + (plotW * i / 4);
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, height - padB);
        ctx.stroke();
      }
      ctx.restore();

      series.forEach(def=>{
        const values = def.values;
        let min = Infinity;
        let max = -Infinity;
        values.forEach(v=>{
          if(v < min) min = v;
          if(v > max) max = v;
        });
        if(!isFinite(min) || !isFinite(max)) return;
        if(Math.abs(max - min) < 1e-9){
          max += 1;
          min -= 1;
        }
        const span = max - min;
        ctx.save();
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 1.8;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        values.forEach((v, idx)=>{
          const x = padL + (values.length <= 1 ? 0 : (plotW * idx / (values.length - 1)));
          const y = padT + (plotH * (1 - ((v - min) / span)));
          if(idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.restore();
      });
      return true;
    }

    function drawMobileChartPreviewDefault(canvas){
      const size = ensureCanvasSize(canvas);
      if(!size) return false;
      const {w:width, h:height, ctx} = size;
      ctx.clearRect(0, 0, width, height);
      const padL = 6;
      const padR = 6;
      const padT = 6;
      const padB = 7;
      const plotW = Math.max(20, width - padL - padR);
      const plotH = Math.max(20, height - padT - padB);
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.085)";
      ctx.lineWidth = 1;
      for(let i=0;i<=3;i++){
        const y = padT + (plotH * i / 3);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(width - padR, y);
        ctx.stroke();
      }
      for(let i=0;i<=4;i++){
        const x = padL + (plotW * i / 4);
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, height - padB);
        ctx.stroke();
      }
      const defaults = [
        {color:"#22c55e", phase:0.2, amp:0.28, lift:0.54},
        {color:"#38bdf8", phase:1.6, amp:0.22, lift:0.48},
        {color:"#f59e0b", phase:2.7, amp:0.18, lift:0.60}
      ];
      defaults.forEach((line, lineIdx)=>{
        ctx.beginPath();
        for(let i=0;i<72;i++){
          const t = i / 71;
          const wave = Math.sin((t * Math.PI * 2.4) + line.phase) * line.amp;
          const ripple = Math.sin((t * Math.PI * 7.2) + line.phase) * 0.035;
          const value = Math.max(0.08, Math.min(0.92, line.lift + wave + ripple - (lineIdx * 0.025)));
          const x = padL + (plotW * t);
          const y = padT + (plotH * (1 - value));
          if(i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = line.color;
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 1.8;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
      });
      ctx.restore();
      return true;
    }

    function renderMobileChartPreview(){
      const slide = el.mobileChartPreviewSlide;
      if(!slide) return;
      const selectedDefs = getSelectedMobileChartDefs();
      const hasSelection = selectedDefs.length > 0;
      const online = isDeviceUiOnline();
      slide.classList.toggle("has-chart-selection", hasSelection);
      updateMobileChartSelectButton();
      if(el.mobileChartPreviewTitle){
        el.mobileChartPreviewTitle.textContent = hasSelection ? "SELECTED DATA" : "DEFAULT CHART";
      }
      if(el.mobileChartPreviewState){
        el.mobileChartPreviewState.textContent = hasSelection ? (online ? "LIVE" : "OFFLINE") : "PREVIEW";
      }
      if(el.mobileChartPreviewLegend){
        const legendDefs = hasSelection ? selectedDefs : [
          {short:"고도", color:"#22c55e"},
          {short:"G", color:"#38bdf8"},
          {short:"추력", color:"#f59e0b"}
        ];
        el.mobileChartPreviewLegend.innerHTML = legendDefs.map(def=>
          '<span><i style="--legend-color:' + def.color + '"></i>' + def.short + '</span>'
        ).join("");
      }
      if(!hasSelection || !online){
        if(el.mobileChartPreviewCanvas) drawMobileChartPreviewDefault(el.mobileChartPreviewCanvas);
        if(el.mobileChartPreviewMessage){
          el.mobileChartPreviewMessage.textContent = "";
          el.mobileChartPreviewMessage.classList.add("is-hidden");
        }
        return;
      }
      const ok = el.mobileChartPreviewCanvas
        ? drawMobileChartPreviewLines(el.mobileChartPreviewCanvas, selectedDefs)
        : false;
      if(el.mobileChartPreviewMessage){
        el.mobileChartPreviewMessage.textContent = ok ? "" : "선택됨 · 데이터 대기 중";
        el.mobileChartPreviewMessage.classList.toggle("is-hidden", !!ok);
      }
    }

    function initMobileChartPicker(){
      if(el.mobileChartSelectBtn){
        el.mobileChartSelectBtn.addEventListener("click", (ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          setMobileChartPickerVisible(true);
        });
      }
      if(el.mobileChartPickerClose){
        el.mobileChartPickerClose.addEventListener("click", ()=>setMobileChartPickerVisible(false));
      }
      if(el.mobileChartPickerOverlay){
        el.mobileChartPickerOverlay.addEventListener("click", (ev)=>{
          if(ev.target === el.mobileChartPickerOverlay) setMobileChartPickerVisible(false);
        });
      }
      if(el.mobileChartPickerReset){
        el.mobileChartPickerReset.addEventListener("click", ()=>{
          mobileChartSelectedKeys = [];
          if(el.mobileChartOptions) el.mobileChartOptions.forEach(input=>{ input.checked = false; });
          setMobileChartPickerVisible(false);
          renderMobileChartPreview();
        });
      }
      if(el.mobileChartPickerApply){
        el.mobileChartPickerApply.addEventListener("click", ()=>{
          const selected = [];
          if(el.mobileChartOptions){
            el.mobileChartOptions.forEach(input=>{
              if(input.checked) selected.push(input.value);
            });
          }
          mobileChartSelectedKeys = selected;
          setMobileChartPickerVisible(false);
          renderMobileChartPreview();
        });
      }
      renderMobileChartPreview();
    }
    let chartLayoutRaf = null;
    function scheduleChartLayoutRefresh(){
      if(chartLayoutRaf) cancelAnimationFrame(chartLayoutRaf);
      chartLayoutRaf = requestAnimationFrame(()=>{
        chartLayoutRaf = null;
        refreshChartLayout();
      });
    }
    let chartSyncTimer = null;
    function syncChartHeightToControls(attempt=0){
      if(chartSyncTimer) clearTimeout(chartSyncTimer);
      refreshChartLayout();
      if(isTabletControlsLayout()) return;
      if(window.matchMedia("(min-width: 901px)").matches) return;
      if(!window.matchMedia("(min-width: 1100px)").matches) return;
      const chartsCard = document.querySelector(".charts-card");
      const controlsCard = document.getElementById("controlsCard");
      if(!chartsCard || !controlsCard) return;
      const targetH = Math.round(controlsCard.getBoundingClientRect().height);
      if(targetH < 2){
        if(attempt < 8){
          chartSyncTimer = setTimeout(()=>syncChartHeightToControls(attempt + 1), 120);
        }
        return;
      }
      const currentH = Math.round(chartsCard.getBoundingClientRect().height);
      if(Math.abs(currentH - targetH) > 2 && attempt < 8){
        chartSyncTimer = setTimeout(()=>syncChartHeightToControls(attempt + 1), 120);
      }
    }
    function refreshChartLayout(){
      const row = document.querySelector(".chart-row");
      if(row) row.style.height = "";
      const chartsCard = document.querySelector(".charts-card");
      const controlsCard = document.getElementById("controlsCard");
      const rowBottom = document.querySelector(".row-bottom");
      const tabletLayoutActive = isTabletControlsLayout();
      if(chartsCard){
        chartsCard.style.height = "";
        chartsCard.style.minHeight = "";
      }
      if(rowBottom){
        rowBottom.style.minHeight = "";
      }
      if(chartsCard && tabletLayoutActive){
        chartsCard.style.height = "var(--chart-height)";
        chartsCard.style.minHeight = "var(--chart-height)";
      }
      if(rowBottom && tabletLayoutActive){
        rowBottom.style.minHeight = "var(--chart-height)";
      }
      const ids=["thrustChart","pressureChart","accelChart","accelXYZChart","accelChartFlight","accelXYZChartFlight"];
      ids.forEach((id)=>{
        const canvas=document.getElementById(id);
        if(!canvas) return;
        canvas._cssW=null;
        canvas._cssH=null;
      });
      redrawCharts();
    }

    // =====================
    // 상태/버튼
    // =====================
    function setStatusFromState(st, ignOK, aborted, lockout, seqActive, parachuteActive){
      if(!el.statusPill||!el.statusText) return 0;
      el.statusPill.classList.remove("hidden");
      if(el.statusPillMeta) el.statusPillMeta.classList.remove("hidden");

      if(lockout){
        el.statusPill.className="status-lock";
        if(el.statusPillMeta) el.statusPillMeta.className="status-lock";
        el.statusPill.textContent = t("statusLockout");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusLockout");
        const name = relayMaskName(lockoutRelayMask);
        el.statusText.textContent = t("statusLockoutText", {name});
        syncGyroStatusFromMain();
        return 9;
      }
      if(aborted){
        el.statusPill.className="status-abort";
        if(el.statusPillMeta) el.statusPillMeta.className="status-abort";
        el.statusPill.textContent = t("statusAbort");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusAbort");
        el.statusText.textContent = t("statusAbortTextReason", {reason:getAbortReasonLabel()});
        syncGyroStatusFromMain();
        return 4;
      }
      if(st===3){
        el.statusPill.className="status-seq";
        if(el.statusPillMeta) el.statusPillMeta.className="status-seq";
        el.statusPill.textContent = "T+";
        if(el.statusPillMeta) el.statusPillMeta.textContent = "T+";
        el.statusText.textContent = t("statusSequenceText");
        syncGyroStatusFromMain();
        return 5;
      }
      if(st===5){
        el.statusPill.className="status-abort";
        if(el.statusPillMeta) el.statusPillMeta.className="status-abort";
        el.statusPill.textContent = "LAUNCH FAULT";
        if(el.statusPillMeta) el.statusPillMeta.textContent = "LAUNCH FAULT";
        el.statusText.textContent = "점화 출력 후 1단 ARM 해제가 감지되지 않았습니다. 발사체에 접근하지 마세요.";
        syncGyroStatusFromMain();
        return 10;
      }
      if(st===4){
        el.statusPill.className="status-count";
        if(el.statusPillMeta) el.statusPillMeta.className="status-count";
        el.statusPill.textContent = "WAITING LAUNCH";
        if(el.statusPillMeta) el.statusPillMeta.textContent = "WAITING LAUNCH";
        el.statusText.textContent = "점화 출력 완료 · 1단 ARM 해제와 발사 인식을 계속 감시합니다.";
        syncGyroStatusFromMain();
        return 8;
      }
      if(st===2){
        el.statusPill.className="status-fire";
        if(el.statusPillMeta) el.statusPillMeta.className="status-fire";
        el.statusPill.textContent = t("statusIgnition");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusIgnition");
        el.statusText.textContent = t("statusIgnitionText");
        syncGyroStatusFromMain();
        return 2;
      }
      if(st===1){
        el.statusPill.className="status-count";
        if(el.statusPillMeta) el.statusPillMeta.className="status-count";
        el.statusPill.textContent = t("statusCountdown");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusCountdown");
        el.statusText.textContent = t("statusCountdownText");
        syncGyroStatusFromMain();
        return 1;
      }
      if(parachuteActive){
        const chuteCh = parachuteDeployChannel || normalizePyroChannel(uiSettings && uiSettings.daqSequencePyroChannel, 1);
        el.statusPill.className="status-parachute";
        if(el.statusPillMeta) el.statusPillMeta.className="status-parachute";
        el.statusPill.textContent = t("statusParachute");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusParachute");
        el.statusText.textContent = t("statusParachuteText", {ch:chuteCh});
        syncGyroStatusFromMain();
        return 7;
      }
      if(seqActive){
        el.statusPill.className="status-seq";
        if(el.statusPillMeta) el.statusPillMeta.className="status-seq";
        el.statusPill.textContent = t("statusSequence");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusSequence");
        el.statusText.textContent = t("statusSequenceText");
        syncGyroStatusFromMain();
        return 5;
      }
      if(loadcellErrorActive && st===0){
        el.statusPill.className="status-loadcell";
        if(el.statusPillMeta) el.statusPillMeta.className="status-loadcell";
        el.statusPill.textContent = t("statusLoadcellCheck");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusLoadcellCheck");
        el.statusText.textContent = t("statusLoadcellCheck");
        syncGyroStatusFromMain();
        return 6;
      }
      if(!ignOK){
        el.statusPill.className="status-disc";
        if(el.statusPillMeta) el.statusPillMeta.className="status-disc";
        el.statusPill.textContent = t("statusNotArmed");
        if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusNotArmed");
        const allowSeq = !isIgniterCheckEnabled();
        el.statusText.textContent = allowSeq ? t("statusNotArmedTextReady") : t("statusNotArmedTextBlocked");
        syncGyroStatusFromMain();
        return 3;
      }
      el.statusPill.className="status-ready";
      if(el.statusPillMeta) el.statusPillMeta.className="status-ready";
      el.statusPill.textContent = t("statusReady");
      if(el.statusPillMeta) el.statusPillMeta.textContent = t("statusReady");
      el.statusText.textContent = t("statusReadyText");
      syncGyroStatusFromMain();
      return 0;
    }

    function setButtonsFromState(st, lockout, seqActive){
      if(!el.igniteBtn||!el.abortBtn){ updateControlAccessUI(st); return; }
      const running = !!(virtualMissionActive || seqActive || isFirmwareSequenceRunningState(st) || localTplusActive);
      const storageGuard = getSequenceStorageGuard();
      const readyEligible = !replaySourceActive && isControlUnlocked() && (connOk || simEnabled) && !safetyModeEnabled && !storageGuard.blocked && st === 0 && !running;
      if(virtualMissionActive){
        el.igniteBtn.disabled = true;
        el.abortBtn.disabled = false;
        setIgniteButtonLabel("sequenceStartBtn");
        updateAbortButtonLabel(true);
        updateControlAccessUI(st);
        updateMobileAbortButton();
        updateMobileSequenceStatusLabel(true, st, lockout);
        updateVirtualMissionButtonUi();
        return;
      }
      if(replaySourceActive){
        el.igniteBtn.disabled = true;
        el.abortBtn.disabled = true;
        setIgniteButtonLabel("sequenceStartBtn");
        updateControlAccessUI(st);
        return;
      }
      if(lockout){
        el.igniteBtn.disabled=true;
        el.abortBtn.disabled=true;
        setIgniteButtonLabel("sequenceStartBtn");
        updateControlAccessUI(st);
        return;
      }
      if(!isControlUnlocked()){
        // Before inspection this primary action is the inspection entry point,
        // not a disabled sequence control. The click handler opens the
        // inspection flow and the label switches back after authority is granted.
        el.igniteBtn.disabled = !!inspectionRunning;
        el.abortBtn.disabled = (st===0);
        setIgniteButtonLabel("controlInspectionLabel");
        if(el.sequenceStatusDesktop) el.sequenceStatusDesktop.textContent = inspectionRunning ? "점검 중" : "점검 필요";
        if(el.mobileSequenceWideStatus) el.mobileSequenceWideStatus.textContent = inspectionRunning ? "점검 중" : "점검 필요";
        updateControlAccessUI(st);
        updateMobileSequenceCardButtons(st);
        updateMissionStandbyButtonUi();
        updateVirtualMissionButtonUi();
        return;
      }
      if(st===0){
        el.igniteBtn.disabled = !readyEligible;
        el.abortBtn.disabled = true;
        setIgniteButtonLabel(readyEligible ? "sequenceReadyBtn" : "sequenceStartBtn");
      }else{
        el.igniteBtn.disabled=false;
        el.abortBtn.disabled=false;
        setIgniteButtonLabel("sequenceStartBtn");
      }
      if(safetyModeEnabled){
        el.igniteBtn.disabled = true;
        if(st===0) el.abortBtn.disabled = true;
      }
      if(storageGuard.blocked && st===0){
        el.igniteBtn.disabled = true;
        if(!running) el.abortBtn.disabled = true;
      }
      if(running){
        el.igniteBtn.disabled = true;
        el.abortBtn.disabled = false;
        setIgniteButtonLabel("sequenceStartBtn");
      }
      updateControlAccessUI(st);
      updateMobileAbortButton();
      updateMobileSequenceStatusLabel(seqActive, st, lockout);
      updateMissionStandbyButtonUi();
      updateVirtualMissionButtonUi();
    }

    function updateMobileSequenceStatusLabel(seqActive, st, lockout){
      const running = !!(virtualMissionActive || seqActive || isFirmwareSequenceRunningState(st) || localTplusActive);
      const storageGuard = getSequenceStorageGuard();
      const readyEligible = !replaySourceActive && isControlUnlocked() && (connOk || simEnabled) && !safetyModeEnabled && !storageGuard.blocked && st === 0 && !running;
      let label = "불가";
      let iconTone = "tone-gray";
      if(lockout){
        label = "제한";
        iconTone = "tone-red";
      }else if(running){
        label = "진행중";
        iconTone = "tone-blue";
      }else if(storageGuard.blocked){
        label = "저장공간";
        iconTone = "tone-red";
      }else if(readyEligible){
        if(storageGuard.level === "orange"){
          label = "저장공간";
          iconTone = "tone-orange";
        }else if(storageGuard.level === "green"){
          label = "저장공간";
          iconTone = "tone-green";
        }else{
          label = "준비";
          iconTone = "tone-green";
        }
      }
      if(el.sequenceStatusLabel) el.sequenceStatusLabel.textContent = label;
      if(el.sequenceStatusDesktop) el.sequenceStatusDesktop.textContent = label;
      if(el.mobileSequenceWideStatus) el.mobileSequenceWideStatus.textContent = label;
      if(el.mobileControlButtonMap && el.mobileControlButtonMap.sequence){
        const icon = el.mobileControlButtonMap.sequence.querySelector(".mobile-quick-icon");
        if(icon){
          icon.classList.remove("tone-green", "tone-red", "tone-gray", "tone-blue", "tone-orange");
          icon.classList.add(iconTone);
        }
      }
      syncSequenceStorageGuardUi();
      syncMobileSequenceStatus();
    }

    function createReplayMissionRuntimeState(){
      return {
        prepared: false,
        enabled: false,
        blocks: [],
        blockState: {},
        pending: [],
        vars: [0,0,0,0,0,0,0,0],
        varsNamed: {},
        lastSwitch: 0,
        lastState: 0,
        firingStartMs: null,
        lastSampleMs: 0,
        lastSensorCtx: {},
        sensorHistory: {},
        varPrev: [null,null,null,null,null,null,null,null],
        varUpCount: [0,0,0,0,0,0,0,0],
        varDownCount: [0,0,0,0,0,0,0,0],
        varNamedPrev: {},
        varNamedUpCount: {},
        varNamedDownCount: {}
      };
    }

    const MISSION_SENSOR_HISTORY_MAX = 10;
    const MISSION_SENSOR_KEYS = [
      "altitude_m",
      "time_after_firing_ms",
      "gyro_x_deg",
      "gyro_y_deg",
      "gyro_z_deg",
      "thrust_kgf",
      "pressure_mpa",
      "acc_x_g",
      "acc_y_g",
      "acc_z_g",
      "gyro_x_dps",
      "gyro_y_dps",
      "gyro_z_dps",
      "switch_state"
    ];

    function resetReplayMissionRuntime(){
      replayMissionRuntime = createReplayMissionRuntimeState();
    }

    function replayMissionRuntimeBlocks(){
      const editorBlocks = buildMissionBlocksFromUi();
      const compiled = compileMissionRuntimeBlocks(editorBlocks);
      if(!Array.isArray(compiled)) return [];
      return compiled.filter((block)=>block && block.enabled !== false);
    }

    function prepareReplayMissionRuntime(){
      const runtimeBlocks = replayMissionRuntimeBlocks();
      resetReplayMissionRuntime();
      replayMissionRuntime.blocks = runtimeBlocks;
      replayMissionRuntime.prepared = true;
      replayMissionRuntime.enabled = runtimeBlocks.length > 0;
      const modeLabel = replaySourceActive ? "Replay avionics" : "Mission runtime";
      if(replayMissionRuntime.enabled){
        addLogLine(modeLabel + " armed: " + runtimeBlocks.length + " mission blocks", replaySourceActive ? "RPL-MSN" : "MSN");
      }else{
        addLogLine(modeLabel + ": no mission blocks to run", replaySourceActive ? "RPL-MSN" : "MSN");
      }
    }

    function replayMissionCompare(left, right, cmp){
      const a = Number(left);
      const b = Number(right);
      if(!isFinite(a) || !isFinite(b)) return false;
      const op = normalizeMissionComparator(cmp, "");
      if(op === "lt") return a <= b;
      if(op === "eq") return Math.abs(a - b) <= 1e-6;
      return a >= b;
    }
    function replayMissionGetVarValue(rt, varName, channel){
      const named = normalizeMissionVarName(varName);
      if(named){
        const val = Number(rt && rt.varsNamed ? rt.varsNamed[named] : 0);
        return isFinite(val) ? val : 0;
      }
      const slot = Math.max(1, Math.min(8, Math.round(Number(channel || 1)))) - 1;
      const val = Number(rt && rt.vars ? rt.vars[slot] : 0);
      return isFinite(val) ? val : 0;
    }
    function replayMissionSetVarValue(rt, varName, channel, nextVal){
      const value = Math.round(Number(nextVal) || 0);
      const slot = Math.max(1, Math.min(8, Math.round(Number(channel || 1)))) - 1;
      if(rt && Array.isArray(rt.vars)){
        rt.vars[slot] = value;
      }
      const named = normalizeMissionVarName(varName);
      if(named){
        if(!rt.varsNamed || typeof rt.varsNamed !== "object") rt.varsNamed = {};
        rt.varsNamed[named] = value;
      }
      return value;
    }
    function replayMissionUpdateVarChangeCounters(rt){
      if(!rt) return;
      if(!Array.isArray(rt.varPrev)) rt.varPrev = [null,null,null,null,null,null,null,null];
      if(!Array.isArray(rt.varUpCount)) rt.varUpCount = [0,0,0,0,0,0,0,0];
      if(!Array.isArray(rt.varDownCount)) rt.varDownCount = [0,0,0,0,0,0,0,0];
      for(let i = 0; i < 8; i++){
        const curr = Number((rt.vars && rt.vars[i]) || 0);
        const prev = rt.varPrev[i];
        if(isFinite(prev)){
          if(curr >= prev){
            rt.varUpCount[i] = Math.min(65535, Math.round(Number(rt.varUpCount[i] || 0) + 1));
          }else{
            rt.varUpCount[i] = 0;
          }
          if(curr <= prev){
            rt.varDownCount[i] = Math.min(65535, Math.round(Number(rt.varDownCount[i] || 0) + 1));
          }else{
            rt.varDownCount[i] = 0;
          }
        }else{
          rt.varUpCount[i] = 0;
          rt.varDownCount[i] = 0;
        }
        rt.varPrev[i] = curr;
      }
      if(!rt.varNamedPrev || typeof rt.varNamedPrev !== "object") rt.varNamedPrev = {};
      if(!rt.varNamedUpCount || typeof rt.varNamedUpCount !== "object") rt.varNamedUpCount = {};
      if(!rt.varNamedDownCount || typeof rt.varNamedDownCount !== "object") rt.varNamedDownCount = {};
      const named = (rt.varsNamed && typeof rt.varsNamed === "object") ? rt.varsNamed : {};
      Object.keys(named).forEach((key)=>{
        const name = normalizeMissionVarName(key);
        if(!name) return;
        const curr = Number(named[key] || 0);
        const prev = Number(rt.varNamedPrev[name]);
        if(isFinite(prev)){
          if(curr >= prev){
            rt.varNamedUpCount[name] = Math.min(65535, Math.round(Number(rt.varNamedUpCount[name] || 0) + 1));
          }else{
            rt.varNamedUpCount[name] = 0;
          }
          if(curr <= prev){
            rt.varNamedDownCount[name] = Math.min(65535, Math.round(Number(rt.varNamedDownCount[name] || 0) + 1));
          }else{
            rt.varNamedDownCount[name] = 0;
          }
        }else{
          rt.varNamedUpCount[name] = 0;
          rt.varNamedDownCount[name] = 0;
        }
        rt.varNamedPrev[name] = curr;
      });
    }
    function replayMissionGetVarChangeCount(rt, varName, channel, trendCmp){
      const direction = normalizeMissionComparator(trendCmp, "var_change_count");
      const named = normalizeMissionVarName(varName);
      if(named){
        if(direction === "lt"){
          return Math.max(0, Math.round(Number((rt && rt.varNamedDownCount) ? rt.varNamedDownCount[named] : 0)));
        }
        return Math.max(0, Math.round(Number((rt && rt.varNamedUpCount) ? rt.varNamedUpCount[named] : 0)));
      }
      const slot = Math.max(1, Math.min(8, Math.round(Number(channel || 1)))) - 1;
      if(direction === "lt"){
        return Math.max(0, Math.round(Number(rt && rt.varDownCount ? rt.varDownCount[slot] : 0)));
      }
      return Math.max(0, Math.round(Number(rt && rt.varUpCount ? rt.varUpCount[slot] : 0)));
    }
    function replayMissionGetSensorValue(rt, sensorType){
      const key = normalizeMissionExprSensorType(sensorType);
      const s = (rt && rt.lastSensorCtx && typeof rt.lastSensorCtx === "object") ? rt.lastSensorCtx : {};
      if(key === "altitude_m") return Number(s.altitudeM);
      if(key === "time_after_firing_ms") return Number(s.timeAfterFiringMs);
      if(key === "gyro_x_deg") return Number(s.gyroXDeg);
      if(key === "gyro_y_deg") return Number(s.gyroYDeg);
      if(key === "gyro_z_deg") return Number(s.gyroZDeg);
      if(key === "thrust_kgf") return Number(s.thrustKgf);
      if(key === "pressure_mpa") return Number(s.pressureMpa);
      if(key === "acc_x_g") return Number(s.axG);
      if(key === "acc_y_g") return Number(s.ayG);
      if(key === "acc_z_g") return Number(s.azG);
      if(key === "gyro_x_dps") return Number(s.gxDps);
      if(key === "gyro_y_dps") return Number(s.gyDps);
      if(key === "gyro_z_dps") return Number(s.gzDps);
      if(key === "switch_state") return Number(s.switchState);
      return 0;
    }
    function replayMissionPushSensorHistory(rt){
      if(!rt) return;
      if(!rt.sensorHistory || typeof rt.sensorHistory !== "object"){
        rt.sensorHistory = {};
      }
      MISSION_SENSOR_KEYS.forEach((sensorKey)=>{
        const value = Number(replayMissionGetSensorValue(rt, sensorKey));
        if(!isFinite(value)) return;
        let list = rt.sensorHistory[sensorKey];
        if(!Array.isArray(list)){
          list = [];
          rt.sensorHistory[sensorKey] = list;
        }
        list.push(value);
        if(list.length > MISSION_SENSOR_HISTORY_MAX){
          list.splice(0, list.length - MISSION_SENSOR_HISTORY_MAX);
        }
      });
    }
    function replayMissionSensorAverage(rt, sensorType, sampleCount){
      const key = normalizeMissionExprSensorType(sensorType);
      const count = Math.max(1, Math.min(MISSION_SENSOR_HISTORY_MAX, Math.round(Number(sampleCount || 1))));
      const list = (rt && rt.sensorHistory && Array.isArray(rt.sensorHistory[key])) ? rt.sensorHistory[key] : [];
      if(!list.length){
        const fallback = Number(replayMissionGetSensorValue(rt, key));
        return Math.round(isFinite(fallback) ? fallback : 0);
      }
      const take = Math.max(1, Math.min(count, list.length));
      let sum = 0;
      for(let i = list.length - take; i < list.length; i++){
        const v = Number(list[i]);
        sum += isFinite(v) ? v : 0;
      }
      return Math.round(sum / take);
    }
    function replayMissionEvalThenValue(rt, then, fallbackChannel){
      const action = (then && typeof then === "object") ? then : {};
      const baseValue = Math.round(Number(action.value || 0));
      const targetChannel = Math.max(1, Math.min(8, Math.round(Number(fallbackChannel || action.channel || 1))));
      const expr = normalizeMissionExprObject(action.expr, baseValue, targetChannel);
      if(!expr.enabled){
        return normalizeMissionExprValue(baseValue, 0);
      }
      return evaluateMissionExprValue(expr, (varName, channel)=>replayMissionGetVarValue(
        rt,
        varName,
        Math.max(1, Math.min(8, Math.round(Number(channel || targetChannel))))
      ), baseValue, (sensor)=>replayMissionGetSensorValue(rt, sensor));
    }

    function replayMissionSingleWhenSatisfied(when, ctx, rt){
      const cond = when && typeof when === "object" ? when : {};
      const type = String(cond.type || "");
      const cmp = cond.cmp;
      let threshold = Number(cond.value);
      if(type === "var_value"){
        const rhsType = normalizeMissionVarWhenRhsType(cond.rhsType);
        if(rhsType === "var"){
          threshold = replayMissionGetVarValue(rt, cond.rhsVarName, cond.pin);
        }else{
          threshold = Number(cond.rhsValue != null ? cond.rhsValue : cond.value);
        }
      }

      if(type === "switch_rising") return !!ctx.switchRising;
      if(type === "switch_falling") return !!ctx.switchFalling;
      if(type === "sequence_start") return !!ctx.sequenceStart;
      if(type === "boot") return true;
      if(type === "altitude_gte") return replayMissionCompare(ctx.altitudeM, threshold, cmp);
      if(type === "time_after_firing_ms") return replayMissionCompare(ctx.timeAfterFiringMs, threshold, cmp);
      if(type === "gyro_x_deg") return replayMissionCompare(ctx.gyroXDeg, threshold, cmp);
      if(type === "gyro_y_deg") return replayMissionCompare(ctx.gyroYDeg, threshold, cmp);
      if(type === "gyro_z_deg") return replayMissionCompare(ctx.gyroZDeg, threshold, cmp);
      if(type === "var_value"){
        const val = replayMissionGetVarValue(rt, cond.varName, cond.pin);
        return replayMissionCompare(val, threshold, cmp);
      }
      if(type === "var_change_count"){
        const trendCmp = normalizeMissionComparator(cmp, "var_change_count");
        const count = replayMissionGetVarChangeCount(rt, cond.varName, cond.pin, trendCmp);
        const need = Math.max(1, Math.round(Number(cond.value || 1)));
        return count >= need;
      }
      return false;
    }

    function replayMissionWhenSatisfied(block, ctx, rt){
      const whenAll = Array.isArray(block && block.whenAll) ? block.whenAll : null;
      const chain = (whenAll && whenAll.length) ? whenAll : [((block && block.when) ? block.when : {})];
      if(!chain.length) return false;
      for(let i = 0; i < chain.length; i++){
        if(!replayMissionSingleWhenSatisfied(chain[i], ctx, rt)){
          return false;
        }
      }
      return true;
    }

    function missionActionDispatchGate(actionType){
      const type = String(actionType || "");
      if(type === "pyro"){
        if(lockoutLatched){
          return {ok:false, reason:"LOCKOUT"};
        }
        if(safetyModeEnabled){
          return {ok:false, reason:"SAFETY_MODE"};
        }
      }
      return {ok:true, reason:""};
    }

    function replayMissionExecuteAction(item){
      const rt = replayMissionRuntime;
      if(!rt) return;
      const then = (item && item.then) ? item.then : {};
      const type = String(then.type || "");
      const blockNo = Math.max(1, Number(item.blockIndex) + 1);
      const ch = Math.max(1, Math.round(Number(then.channel || 1)));
      const applyHardware = !!(item && item.applyHardware);
      const isReplayItem = !!(item && item.isReplay);
      const logTag = isReplayItem ? "RPL-MSN" : "MSN";
      const logPrefix = isReplayItem ? "Replay" : "Mission";
      if(type === "servo"){
        const servoCh = Math.max(1, Math.min(SERVO_CHANNELS.length, ch));
        const servoHwCh = mapServoUiToHwChannel(servoCh);
        const angle = clampServoAngle(then.angle);
        setServoUiAngle(servoCh, angle);
        if(applyHardware){
          sendCommand({http:"/servo?ch=" + servoHwCh + "&deg=" + angle, ser:"SERVO " + servoHwCh + " " + angle}, false);
          if(isReplayItem){
            addLogLine("Replay block #" + blockNo + " → SERVO CH" + servoCh + " = " + angle + "° (HW)", logTag);
          }else{
            addLogLine("Mission block #" + blockNo + " → SERVO CH" + servoCh + " = " + angle + "°", logTag);
          }
        }else{
          addLogLine("Replay block #" + blockNo + " → SERVO CH" + servoCh + " = " + angle + "°", logTag);
        }
        return;
      }
      if(type === "pyro"){
        const pyroCh = normalizePyroChannel(ch, 1);
        const durationMs = Math.max(10, Math.round(Number(then.durationMs || 300)));
        if(applyHardware){
          sendCommand({http:"/pyro_test?ch=" + pyroCh + "&ms=" + durationMs, ser:"PYRO " + pyroCh + " " + durationMs}, false);
          if(isReplayItem){
            addLogLine("Replay block #" + blockNo + " → PYRO CH" + pyroCh + " for " + durationMs + "ms (HW)", logTag);
          }else{
            addLogLine("Mission block #" + blockNo + " → PYRO CH" + pyroCh + " for " + durationMs + "ms", logTag);
          }
        }else{
          addLogLine("Replay block #" + blockNo + " → PYRO CH" + pyroCh + " for " + durationMs + "ms", logTag);
        }
        return;
      }
      if(type === "buzzer"){
        const hz = Math.max(1, Math.min(10000, Math.round(Number(then.value || then.hz || 2000))));
        if(applyHardware){
          sendCommand({http:"/buzzer?hz=" + hz, ser:"BEEP " + hz}, false);
          if(isReplayItem){
            addLogLine("Replay block #" + blockNo + " → BUZZER " + hz + "Hz (HW)", logTag);
          }else{
            addLogLine("Mission block #" + blockNo + " → BUZZER " + hz + "Hz", logTag);
          }
        }else{
          playTone(hz, 220, 0);
          addLogLine("Replay block #" + blockNo + " → BUZZER " + hz + "Hz", logTag);
        }
        return;
      }
      if(type === "find_buzzer"){
        if(applyHardware){
          sendCommand({http:"/buzzer?pattern=find", ser:"FIND_BUZZER"}, false);
          addLogLine("Mission block #" + blockNo + " → FIND_BUZZER pattern", logTag);
        }else{
          playTone(1760, 120, 0);
          setTimeout(()=>playTone(2349, 160, 0), 220);
          setTimeout(()=>playTone(1568, 120, 0), 500);
          addLogLine("Replay block #" + blockNo + " → FIND_BUZZER pattern", logTag);
        }
        return;
      }
      if(type === "notone"){
        if(applyHardware){
          sendCommand({http:"/buzzer_stop", ser:"NOTONE"}, false);
          if(isReplayItem){
            addLogLine("Replay block #" + blockNo + " → NOTONE (HW)", logTag);
          }else{
            addLogLine("Mission block #" + blockNo + " → NOTONE", logTag);
          }
        }else{
          addLogLine("Replay block #" + blockNo + " → NOTONE", logTag);
        }
        return;
      }
      if(type === "alarm"){
        if(isReplayItem && replayHasStoredMissionAlarms) return;
        const title = normalizeMissionAlarmTitle(then.title);
        const message = normalizeMissionAlarmMessage(then.message) || "미션 알람";
        showToast(message, "notice", {
          key:"mission-alarm-" + blockNo + "-" + Date.now(),
          title:title,
          duration:9000,
          keep:true,
          forceToast:true
        });
        addLogLine(logPrefix + " block #" + blockNo + " → ALARM \"" + title + "\" : " + message, logTag);
        return;
      }
      if(type === "var_set"){
        const nextVal = replayMissionEvalThenValue(rt, then, ch);
        const saved = replayMissionSetVarValue(rt, then.varName, ch, nextVal);
        const named = normalizeMissionVarName(then.varName);
        const label = named ? named : ("VAR" + Math.max(1, Math.min(8, ch)));
        addLogLine(logPrefix + " block #" + blockNo + " → " + label + " = " + saved, logTag);
        return;
      }
      if(type === "var_add"){
        const delta = replayMissionEvalThenValue(rt, then, ch);
        const base = replayMissionGetVarValue(rt, then.varName, ch);
        const next = Math.round(base + delta);
        const saved = replayMissionSetVarValue(rt, then.varName, ch, next);
        const named = normalizeMissionVarName(then.varName);
        const label = named ? named : ("VAR" + Math.max(1, Math.min(8, ch)));
        addLogLine(logPrefix + " block #" + blockNo + " → " + label + " += " + delta + " (" + saved + ")", logTag);
        return;
      }
      if(type === "var_avg"){
        const sampleCount = Math.max(1, Math.min(MISSION_SENSOR_HISTORY_MAX, Math.round(Number(then.avgCount || then.samples || 1))));
        const sensorType = normalizeMissionExprSensorType(then.sensor != null ? then.sensor : then.sensorType);
        const avg = replayMissionSensorAverage(rt, sensorType, sampleCount);
        const saved = replayMissionSetVarValue(rt, then.varName, ch, avg);
        const named = normalizeMissionVarName(then.varName);
        const label = named ? named : ("VAR" + Math.max(1, Math.min(8, ch)));
        addLogLine(logPrefix + " block #" + blockNo + " → " + label + " = AVG(" + sensorType + ", " + sampleCount + ") = " + saved, logTag);
      }
    }

    function replayMissionFlushPending(sampleTimeMs){
      const rt = replayMissionRuntime;
      if(!rt || !rt.pending.length) return;
      let dueCount = 0;
      while(dueCount < rt.pending.length && rt.pending[dueCount].execAtMs <= sampleTimeMs){
        dueCount++;
      }
      for(let i = 0; i < dueCount; i++){
        replayMissionExecuteAction(rt.pending[i]);
      }
      if(dueCount > 0) rt.pending.splice(0, dueCount);
    }

    function replayMissionEnqueuePending(rt, item){
      if(!rt || !item) return;
      const pending = Array.isArray(rt.pending) ? rt.pending : (rt.pending = []);
      let insertAt = pending.length;
      while(insertAt > 0 && Number(pending[insertAt - 1].execAtMs) > Number(item.execAtMs)){
        insertAt--;
      }
      pending.splice(insertAt, 0, item);
      if(pending.length > 64) pending.length = 64;
    }

    function processReplayMissionRuntime(sample, ctx, isReplayMode){
      if(!replayMissionRuntime) resetReplayMissionRuntime();
      if(!replayMissionRuntime.prepared) prepareReplayMissionRuntime();
      const rt = replayMissionRuntime;
      if(!rt.enabled) return;
      const isReplay = !!isReplayMode;

      const sampleTimeMsRaw = Number(ctx && ctx.sampleTimeMs);
      const sampleTimeMs = isFinite(sampleTimeMsRaw) ? sampleTimeMsRaw : Date.now();
      const swNow = Number(ctx && ctx.sw) ? 1 : 0;
      const stNow = Math.round(Number(ctx && ctx.st));
      const thrustNow = Number(ctx && ctx.thrustKgf);
      const tdNow = Number(ctx && ctx.tdMs);
      const switchRising = (rt.lastSwitch === 0 && swNow === 1);
      const switchFalling = (rt.lastSwitch === 1 && swNow === 0);
      const sequenceStart = (rt.lastState === 0) && (stNow === 1 || stNow === 2);

      if((stNow === 2 || (isFinite(thrustNow) && thrustNow >= IGN_THRUST_THRESHOLD)) && rt.firingStartMs == null){
        rt.firingStartMs = sampleTimeMs;
      }
      let timeAfterFiringMs = NaN;
      if(isFinite(tdNow) && tdNow >= 0){
        timeAfterFiringMs = tdNow;
      }else if(rt.firingStartMs != null){
        timeAfterFiringMs = Math.max(0, sampleTimeMs - rt.firingStartMs);
      }

      rt.lastSensorCtx = {
        switchState: swNow,
        thrustKgf: isFinite(thrustNow) ? thrustNow : Number(sample && sample.t),
        pressureMpa: Number(sample && sample.p),
        altitudeM: Number(ctx && ctx.altitudeM),
        timeAfterFiringMs: isFinite(timeAfterFiringMs) ? timeAfterFiringMs : 0,
        gyroXDeg: Number(ctx && ctx.gyroXDeg),
        gyroYDeg: Number(ctx && ctx.gyroYDeg),
        gyroZDeg: Number(ctx && ctx.gyroZDeg),
        axG: Number(sample && sample.ax),
        ayG: Number(sample && sample.ay),
        azG: Number(sample && sample.az),
        gxDps: Number(sample && sample.gx),
        gyDps: Number(sample && sample.gy),
        gzDps: Number(sample && sample.gz)
      };
      replayMissionPushSensorHistory(rt);

      replayMissionFlushPending(sampleTimeMs);
      replayMissionUpdateVarChangeCounters(rt);

      const condCtx = {
        switchRising,
        switchFalling,
        sequenceStart,
        altitudeM: Number(ctx && ctx.altitudeM),
        timeAfterFiringMs,
        gyroXDeg: Number(ctx && ctx.gyroXDeg),
        gyroYDeg: Number(ctx && ctx.gyroYDeg),
        gyroZDeg: Number(ctx && ctx.gyroZDeg)
      };

      for(let i = 0; i < rt.blocks.length; i++){
        const block = rt.blocks[i];
        if(!block || block.enabled === false) continue;
        if(!rt.blockState[i]){
          rt.blockState[i] = { lastWhen: false, fired: false, lastGateReason: "" };
        }
        const state = rt.blockState[i];
        if(block.once && state.fired){
          state.lastWhen = false;
          continue;
        }
        const whenNow = replayMissionWhenSatisfied(block, condCtx, rt);
        const actionType = String(((block && block.then) ? block.then.type : "") || "");
        if(!whenNow){
          state.lastWhen = false;
          state.lastGateReason = "";
          continue;
        }
        const gate = missionActionDispatchGate(actionType);
        if(!gate.ok){
          const blockedReason = String(gate.reason || "BLOCKED");
          if(state.lastGateReason !== blockedReason){
            addLogLine((isReplay ? "Replay" : "Mission") + " block #" + (i + 1) + " blocked: " + blockedReason, isReplay ? "RPL-MSN" : "MSN");
            state.lastGateReason = blockedReason;
          }
          // Keep edge unconsumed so action can fire when gate is cleared.
          state.lastWhen = false;
          continue;
        }
        state.lastGateReason = "";
        const triggered = !state.lastWhen;
        state.lastWhen = true;
        if(!triggered) continue;
        const delayMs = Math.max(0, Math.round(Number(block.delayMs || 0)));
        replayMissionEnqueuePending(rt, {
          blockIndex: i,
          execAtMs: sampleTimeMs + delayMs,
          then: block.then || {},
          // Replay must never drive real hardware by accident.
          applyHardware: !isReplay,
          isReplay: isReplay
        });
        if(block.once) state.fired = true;
      }

      replayMissionFlushPending(sampleTimeMs);
      rt.lastSwitch = swNow;
      rt.lastState = isFinite(stNow) ? stNow : 0;
      rt.lastSampleMs = sampleTimeMs;
    }

    function setReplayStatus(text){
      if(el.replayStatusText) el.replayStatusText.textContent = String(text || "");
    }

    function setReplaySeekProcessingUi(visible, doneCount, totalCount){
      replaySeekProcessing = !!visible;
      if(!replaySeekProcessing){
        replaySeekDisplayIndex = -1;
      }
      const done = Math.max(0, Number(doneCount) || 0);
      const total = Math.max(0, Number(totalCount) || 0);
      if(el.replaySeekOverlayText){
        if(replaySeekProcessing){
          const percent = (total > 0) ? Math.min(100, Math.max(0, Math.round((done * 100) / total))) : 0;
          el.replaySeekOverlayText.textContent = "궤도 계산 중 (" + percent + "%)";
        }else{
          el.replaySeekOverlayText.textContent = "궤도 계산 중";
        }
      }
      setOverlayVisible(el.replaySeekOverlay, replaySeekProcessing);
    }

    function cancelReplaySeekProcessing(){
      replaySeekTaskToken += 1;
      setReplaySeekProcessingUi(false);
      updateReplayModeUi();
    }

    function setActiveDataSource(mode){
      const next = (mode === DATA_SOURCE_REPLAY) ? DATA_SOURCE_REPLAY : DATA_SOURCE_LIVE;
      if(activeDataSource === next) return;
      activeDataSource = next;
      replaySourceActive = (next === DATA_SOURCE_REPLAY);
      if(replaySourceActive){
        prepareReplayMissionRuntime();
      }else{
        resetReplayMissionRuntime();
      }
      updateInspectionAccess();
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
      updateControlAccessUI(currentSt);
      evaluateRuntimeAlarms(Date.now());
    }

    function resetReplayBuffers(){
      thrustBaseHistory = [];
      pressureBaseHistory = [];
      quickAltitudeHistory = [];
      quickAltitudeRateHistory = [];
      quickVelocityHistory = [];
      quickSpeedHistory = [];
      gyroSpeedHistory = [];
      chipTempHistory = [];
      perfLoadHistory = [];
      batteryPctHistory = [];
      accelMagHistory = [];
      ascentAccelHistory = [];
      accelXHistory = [];
      accelYHistory = [];
      accelZHistory = [];
      gyroXHistory = [];
      gyroYHistory = [];
      gyroZHistory = [];
      chartTimeHistory = [];
      sampleHistory = [];
      logData = [];
      logDataRevision = 0;
      reportExportedRevision = 0;
      reportExportedOnce = false;
      firstSampleMs = null;
      sampleCounter = 0;
      resetGyroAttitudeState();
      resetCameraStageSeparation(false);
      rxWindowStartMs = 0;
      rxWindowCount = 0;
      rxHzWindow = 0;
      sampleRateWindowStartMs = 0;
      sampleRateWindowCount = 0;
      sampleRateHzWindow = 0;
      lastSampleTimelineMs = NaN;
      prevSwState = null;
      prevIcState = null;
      prevGsState = null;
      prevSmState = null;
      prevStForIgn = 0;
      lastChipTempC = null;
      lastChipTempSampleMs = 0;
      lastPerfLoadRawPct = null;
      lastPerfLoadPct = null;
      lastPerfCpuUs = null;
      lastPerfLoopUs = null;
      lastPerfSampleMs = 0;
      ignitionAnalysis = createIgnitionAnalysis(null);
      lastBurnSeconds = null;
      resetQuickFlightMetricsState();
      lastStatusCode = -1;
      currentSt = 0;
      syncSequenceInteractionState(currentSt);
      sequenceActive = false;
      st2StartMs = null;
      localTplusActive = false;
      localTplusStartMs = null;
      resetParachuteDeployState();
      resetGyroPathTracking();
      resetReplayMissionRuntime();
      if(el.countdown) el.countdown.textContent = "T- --:--:--";
      if(el.countdownMobile) el.countdownMobile.textContent = "T- --:--:--";
      if(el.countdownBig) el.countdownBig.textContent = "T- --:--:--";
      syncMobileSequenceTime();
      updateAbortButtonLabel(false);
      autoScrollChart = true;
      chartView.startMs = null;
      chartView.allowSmallWindow = false;
      redrawCharts();
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
      updateControlAccessUI(currentSt);
      updateExportGuardUi();
    }

    function formatReplayMs(ms){
      const value = Math.max(0, Math.round(Number(ms) || 0));
      const min = Math.floor(value / 60000);
      const sec = Math.floor((value % 60000) / 1000);
      const msec = value % 1000;
      return String(min).padStart(2, "0") + ":" + String(sec).padStart(2, "0") + "." + String(msec).padStart(3, "0");
    }

    function collectReplayAlarmEvents(){
      const frames = Array.isArray(replayState && replayState.samples) ? replayState.samples : [];
      replayAlarmEvents = [];
      if(!frames.length) return replayAlarmEvents;
      const seen = new Set();
      const firstTs = Number(frames[0] && frames[0].tsMs);
      for(let index = 0; index < frames.length; index++){
        const frame = frames[index];
        const sample = frame && frame.sample;
        if(!sample) continue;
        const rawEvents = Array.isArray(sample.mission_alarm_events)
          ? sample.mission_alarm_events.slice()
          : [];
        if(Number(sample.mission_alarm_seq) > 0){
          rawEvents.push({
              seq:sample.mission_alarm_seq,
              block:sample.mission_alarm_block,
              title:sample.mission_alarm_title,
              message:sample.mission_alarm_message,
              timestampMs:sample.mission_alarm_ts
            });
        }
        for(const rawEvent of rawEvents){
          const seq = Number(rawEvent && rawEvent.seq);
          if(!isFinite(seq) || seq <= 0) continue;
          const block = Math.max(0, Math.round(Number(rawEvent.block) || 0));
          const title = normalizeMissionAlarmTitle(rawEvent.title) || "미션 알람";
          const message = normalizeMissionAlarmMessage(rawEvent.message) || "미션 알람";
          const timestampMs = Math.max(0, Math.round(Number(rawEvent.timestampMs) || 0));
          const key = "seq:" + seq;
          if(seen.has(key)) continue;
          seen.add(key);
          const frameTs = Number(frame.tsMs);
          const relativeMs = (isFinite(frameTs) && isFinite(firstTs))
            ? Math.max(0, frameTs - firstTs)
            : Math.max(0, index * REPLAY_DEFAULT_FRAME_DELAY_MS);
          replayAlarmEvents.push({
            key,
            index,
            seq,
            block,
            title,
            message,
            timestampMs,
            relativeMs
          });
        }
      }
      return replayAlarmEvents;
    }

    function syncReplayAlarmEventActive(){
      if(!el.replayAlarmEventsList || !Array.isArray(replayAlarmEvents) || !replayAlarmEvents.length) return;
      const currentIndex = replaySeekProcessing && replaySeekDisplayIndex >= 0
        ? replaySeekDisplayIndex
        : (replayState.lastIndex >= 0 ? replayState.lastIndex : Math.max(0, replayState.index - 1));
      let activeKey = "";
      for(const event of replayAlarmEvents){
        if(event.index <= currentIndex) activeKey = event.key;
        else break;
      }
      el.replayAlarmEventsList.querySelectorAll(".replay-event-item").forEach((node)=>{
        node.classList.toggle("is-active", !!activeKey && node.getAttribute("data-replay-alarm-key") === activeKey);
      });
    }

    function renderReplayAlarmEvents(){
      collectReplayAlarmEvents();
      const panel = el.replayAlarmEventsPanel;
      const list = el.replayAlarmEventsList;
      const count = el.replayAlarmEventsCount;
      if(count) count.textContent = replayAlarmEvents.length.toLocaleString("ko-KR") + "개";
      if(!panel || !list) return;
      if(!replayAlarmEvents.length){
        panel.classList.add("hidden");
        list.innerHTML = "";
        return;
      }
      panel.classList.remove("hidden");
      const visible = replayAlarmEvents.slice(0, 80);
      list.innerHTML = visible.map((event)=>{
        const blockText = event.block ? ("BLOCK " + event.block) : "MISSION";
        return '<button class="replay-event-item" type="button" data-replay-alarm-index="' + event.index + '" data-replay-alarm-key="' + escapeHtmlText(event.key) + '">' +
          '<span class="replay-event-headline">' +
            '<span class="replay-event-time">' + escapeHtmlText(formatReplayMs(event.relativeMs)) + '</span>' +
            '<span class="replay-event-item-title">' + escapeHtmlText(event.title) + '</span>' +
          '</span>' +
          '<span class="replay-event-message">' + escapeHtmlText(event.message) + '</span>' +
          '<span class="replay-event-meta">' + escapeHtmlText(blockText + " · seq " + event.seq) + '</span>' +
        '</button>';
      }).join("") +
      (replayAlarmEvents.length > visible.length
        ? '<div class="replay-event-meta">' + (replayAlarmEvents.length - visible.length).toLocaleString("ko-KR") + '개 더 있음</div>'
        : "");
      syncReplayAlarmEventActive();
    }

    function replayRelativeMsAt(index){
      if(!replayState.samples.length) return 0;
      const first = replayState.samples[0].tsMs;
      const maxIndex = replayState.samples.length - 1;
      const clamped = Math.max(0, Math.min(maxIndex, index));
      const ts = replayState.samples[clamped].tsMs;
      const rel = ts - first;
      return isFinite(rel) ? Math.max(0, rel) : 0;
    }

    function updateReplaySeekUi(overrideIndex){
      const total = replayState.samples.length;
      const maxIndex = Math.max(0, total - 1);
      const defaultIndex = (replayState.lastIndex >= 0)
        ? replayState.lastIndex
        : Math.max(0, replayState.index - 1);
      let index = (overrideIndex == null) ? defaultIndex : Math.max(0, Math.min(maxIndex, Number(overrideIndex) || 0));
      if(overrideIndex == null && replaySeekProcessing && replaySeekDisplayIndex >= 0){
        index = Math.max(0, Math.min(maxIndex, replaySeekDisplayIndex));
      }
      if(el.replaySeekRange){
        el.replaySeekRange.max = String(maxIndex);
        if(!replaySeekInteracting || overrideIndex != null){
          el.replaySeekRange.value = String(index);
        }
        el.replaySeekRange.disabled = total <= 1;
      }
      if(el.replaySeekLabel){
        const currentMs = (total > 0) ? replayRelativeMsAt(index) : 0;
        const totalMs = (total > 0) ? replayRelativeMsAt(maxIndex) : 0;
        el.replaySeekLabel.textContent = formatReplayMs(currentMs) + " / " + formatReplayMs(totalMs);
      }
    }

    function updateReplaySpeedUi(){
      if(!el.replaySpeedBtns || !el.replaySpeedBtns.length) return;
      el.replaySpeedBtns.forEach(btn=>{
        const speed = Number(btn.getAttribute("data-replay-speed"));
        const active = isFinite(speed) && Math.abs(speed - replayState.speed) < 0.001;
        btn.classList.toggle("is-active", active);
      });
    }

    function prepareReplayLinkQualityData(frames){
      const list = Array.isArray(frames) ? frames : [];
      let appRecorded = false;
      let appCommunicationRecorded = false;
      const linkSamples = [];
      list.forEach((frame, index)=>{
        const sample = frame && frame.sample ? frame.sample : null;
        if(!sample) return;
        const isAppSample =
          Number(sample.app_recorded) === 1 ||
          String(sample.data_capture_source || "").toLowerCase() === "app";
        if(isAppSample) appRecorded = true;
        const origin = String(sample.data_origin || "").trim().toLowerCase();
        const hasRecordedLinkPayload = Number(sample.app_link_quality_recorded) === 1;
        if(isAppSample && (
          origin === "avionics" ||
          (hasRecordedLinkPayload && Number(sample.fl_remote_valid) === 1)
        )){
          appCommunicationRecorded = true;
        }
        if(!hasRecordedLinkPayload) return;
        const rssi = Number(sample.fl_rssi_dbm);
        const lossPermille = Number(sample.fl_loss_permille);
        const hz = Number(sample.fl_rx_hz);
        linkSamples.push({
          index,
          time:Number(frame.tsMs),
          rssi:Number(sample.fl_rssi_valid) && isFinite(rssi) && rssi > -127 ? rssi : null,
          loss:Number(sample.fl_loss_valid) && isFinite(lossPermille)
            ? Math.max(0, lossPermille / 10)
            : null,
          hz:Number(sample.fl_rx_valid) && isFinite(hz) ? Math.max(0, hz) : null,
          linked:Number(sample.fl_link) === 1,
          remoteValid:Number(sample.fl_remote_valid) === 1
        });
      });
      replayState.appCommunicationRecorded = appRecorded && appCommunicationRecorded;
      replayState.linkSamples = linkSamples;
      replayState.linkSeries = {
        rssi:linkSamples.filter((sample)=>sample.rssi != null && isFinite(Number(sample.rssi))),
        loss:linkSamples.filter((sample)=>sample.loss != null && isFinite(Number(sample.loss))),
        hz:linkSamples.filter((sample)=>sample.hz != null && isFinite(Number(sample.hz)))
      };
      replayState.linkDefinitions = {
        rssi:getFlashLinkChartDefinition("rssi", replayState.linkSeries.rssi),
        loss:getFlashLinkChartDefinition("loss", replayState.linkSeries.loss),
        hz:getFlashLinkChartDefinition("hz", replayState.linkSeries.hz)
      };
      replayState.linkQualityAvailable = linkSamples.some((sample)=>(
        (sample.rssi != null && isFinite(Number(sample.rssi))) ||
        (sample.loss != null && isFinite(Number(sample.loss))) ||
        (sample.hz != null && isFinite(Number(sample.hz)))
      ));
      updateReplayLinkStatusButton();
      scheduleReplayLinkStatusRender();
    }

    function updateReplayLinkStatusButton(){
      const button = el.replayLinkStatusBtn;
      if(!button) return;
      const visible = !!replayUiActive && !!replayState.appCommunicationRecorded;
      button.classList.toggle("hidden", !visible);
      button.style.display = visible ? "" : "none";
      button.setAttribute("aria-hidden", visible ? "false" : "true");
      button.disabled = !visible;
      if(el.replayLinkStatusBtnHint){
        el.replayLinkStatusBtnHint.textContent = replayState.linkQualityAvailable
          ? "RSSI · 손실률 · 수신 Hz"
          : "이전 저장 형식 · 품질 데이터 없음";
      }
    }

    function updateReplayLinkChartTabs(){
      const tabs = el.replayLinkChartTabs || [];
      tabs.forEach((tab)=>{
        const active = tab.dataset.replayLinkMetric === replayLinkChartMetric;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
    }

    function setReplayLinkChartMetric(metric){
      replayLinkChartMetric = (metric === "loss" || metric === "hz") ? metric : "rssi";
      updateReplayLinkChartTabs();
      scheduleReplayLinkStatusRender();
    }

    function findReplayLinkSampleAt(index){
      const samples = replayState.linkSamples || [];
      if(!samples.length) return null;
      let lo = 0;
      let hi = samples.length - 1;
      let match = 0;
      while(lo <= hi){
        const mid = (lo + hi) >>> 1;
        if(samples[mid].index <= index){
          match = mid;
          lo = mid + 1;
        }else{
          hi = mid - 1;
        }
      }
      return samples[match] || null;
    }

    function setReplayLinkStatusVisible(visible){
      const show =
        !!visible &&
        !!replayUiActive &&
        !!replayState.appCommunicationRecorded;
      replayLinkStatusOpen = show;
      if(el.replayLinkStatusOverlay){
        setOverlayVisible(el.replayLinkStatusOverlay, show);
      }
      if(show){
        setReplayToolsPanelOpen(false);
        updateReplayLinkChartTabs();
        scheduleReplayLinkStatusRender();
        requestAnimationFrame(()=>{
          if(el.replayLinkStatusCloseBtn){
            el.replayLinkStatusCloseBtn.focus({preventScroll:true});
          }
        });
      }
    }

    function buildReplayHudLiveUrl(){
      const url = new URL("overlay.html", window.location.href);
      url.search = "";
      url.hash = "";
      const mission = String(
        (el.missionName && el.missionName.value) ||
        selectedMotorName ||
        DEFAULT_MISSION_NAME ||
        "FLASH6 MISSION"
      ).trim();
      if(mission) url.searchParams.set("mission", mission);
      try{
        const bases = (typeof getApiBaseCandidates === "function")
          ? getApiBaseCandidates().filter((base)=>!!base)
          : [];
        if(bases[0]) url.searchParams.set("source", bases[0]);
      }catch(_error){}
      return url.href;
    }

    function setReplayHudLiveVisible(visible){
      const show = !!visible && !!replayUiActive;
      if(el.replayHudLiveOverlay){
        setOverlayVisible(el.replayHudLiveOverlay, show);
      }
      if(!show) return;
      setReplayToolsPanelOpen(false);
      const url = buildReplayHudLiveUrl();
      if(el.replayHudLiveUrl) el.replayHudLiveUrl.value = url;
      requestAnimationFrame(()=>{
        if(el.replayHudLiveCopyBtn){
          el.replayHudLiveCopyBtn.focus({preventScroll:true});
        }
      });
    }

    async function copyReplayHudLiveUrl(){
      const url = buildReplayHudLiveUrl();
      if(el.replayHudLiveUrl) el.replayHudLiveUrl.value = url;
      let copied = false;
      try{
        if(navigator.clipboard && typeof navigator.clipboard.writeText === "function"){
          await navigator.clipboard.writeText(url);
          copied = true;
        }
      }catch(_error){}
      if(!copied && el.replayHudLiveUrl){
        try{
          el.replayHudLiveUrl.focus({preventScroll:true});
          el.replayHudLiveUrl.select();
          copied = document.execCommand("copy");
        }catch(_error){}
      }
      showToast(
        copied ? "HUD LIVE 링크를 복사했습니다." : "주소를 선택해 직접 복사해 주세요.",
        copied ? "success" : "warn",
        {key:"replay-hud-live-copy"}
      );
      return copied;
    }

    function scheduleReplayLinkStatusRender(){
      if(!replayLinkStatusOpen || replayLinkChartRaf) return;
      replayLinkChartRaf = requestAnimationFrame(()=>{
        replayLinkChartRaf = 0;
        drawReplayLinkQualityChart();
      });
    }

    function drawReplayLinkQualityChart(){
      if(!replayLinkStatusOpen) return;
      const canvas = el.replayLinkQualityChart;
      if(!canvas) return;
      const samples = replayState.linkSamples || [];
      const currentIndex = replayState.lastIndex >= 0
        ? replayState.lastIndex
        : Math.max(0, replayState.index - 1);
      const current = findReplayLinkSampleAt(currentIndex);
      const definition =
        replayState.linkDefinitions && replayState.linkDefinitions[replayLinkChartMetric]
          ? replayState.linkDefinitions[replayLinkChartMetric]
          : getFlashLinkChartDefinition(replayLinkChartMetric, samples);
      const currentValue = current && current[definition.key] != null
        ? Number(current[definition.key])
        : NaN;
      const valid =
        replayState.linkSeries && Array.isArray(replayState.linkSeries[definition.key])
          ? replayState.linkSeries[definition.key]
          : [];
      const hasMetricData = valid.length > 0;

      if(el.replayLinkRateValue){
        el.replayLinkRateValue.textContent = current && current.hz != null && isFinite(Number(current.hz))
          ? Number(current.hz).toFixed(Number(current.hz) % 1 ? 1 : 0) + " Hz"
          : "-- Hz";
      }
      if(el.replayLinkLossValue){
        el.replayLinkLossValue.textContent = current && current.loss != null && isFinite(Number(current.loss))
          ? Number(current.loss).toFixed(1) + " %"
          : "-- %";
      }
      if(el.replayLinkRssiValue){
        el.replayLinkRssiValue.textContent = current && current.rssi != null && isFinite(Number(current.rssi))
          ? Math.round(Number(current.rssi)) + " dBm"
          : "-- dBm";
      }
      if(el.replayLinkStateValue){
        const linked = !!(current && current.linked);
        el.replayLinkStateValue.classList.toggle("is-linked", linked);
        el.replayLinkStateValue.classList.toggle("is-offline", !!current && !linked);
        const label = current ? (linked ? "LINKED" : "OFFLINE") : "NO DATA";
        const strong = el.replayLinkStateValue.querySelector("strong");
        if(strong) strong.textContent = label;
      }
      if(el.replayLinkChartValue){
        el.replayLinkChartValue.textContent = formatFlashLinkChartValue(currentValue, definition);
        el.replayLinkChartValue.style.color = definition.color;
      }
      if(el.replayLinkChartEmpty){
        el.replayLinkChartEmpty.classList.toggle("hidden", hasMetricData);
      }
      if(el.replayLinkRecordSource){
        el.replayLinkRecordSource.textContent = replayState.linkQualityAvailable
          ? "APP COMMUNICATION RECORD"
          : "LEGACY APP RECORD";
      }
      if(el.replayLinkRecordTime){
        const lastFrameIndex = Math.max(0, replayState.samples.length - 1);
        el.replayLinkRecordTime.textContent =
          formatReplayMs(replayRelativeMsAt(currentIndex)) +
          " / " +
          formatReplayMs(replayRelativeMsAt(lastFrameIndex));
      }

      const size = ensureCanvasSize(canvas);
      if(!size) return;
      const {w:width, h:height, ctx} = size;
      const plot = {left:44, top:25, right:14, bottom:28};
      const plotLeft = plot.left;
      const plotTop = plot.top;
      const plotRight = width - plot.right;
      const plotBottom = height - plot.bottom;
      const plotWidth = Math.max(40, plotRight - plotLeft);
      const plotHeight = Math.max(40, plotBottom - plotTop);
      const valueSpan = Math.max(1, definition.max - definition.min);
      const firstTime = samples.length ? Number(samples[0].time) : 0;
      const lastTime = samples.length ? Number(samples[samples.length - 1].time) : firstTime + 1;
      const timeSpan = Math.max(1, lastTime - firstTime);
      const textColor = "rgba(181,187,198,.72)";
      const gridColor = "rgba(148,163,184,.15)";

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.font = "10px -apple-system,BlinkMacSystemFont,system-ui,sans-serif";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 1;
      for(let line = 0; line <= 4; line++){
        const ratio = line / 4;
        const y = plotTop + (plotHeight * ratio);
        const value = definition.max - (valueSpan * ratio);
        ctx.strokeStyle = gridColor;
        ctx.beginPath();
        ctx.moveTo(plotLeft, y);
        ctx.lineTo(plotRight, y);
        ctx.stroke();
        ctx.fillStyle = textColor;
        ctx.textAlign = "right";
        ctx.fillText(value.toFixed(definition.digits), plotLeft - 7, y);
      }
      for(let line = 0; line <= 4; line++){
        const ratio = line / 4;
        const x = plotLeft + (plotWidth * ratio);
        ctx.strokeStyle = gridColor;
        ctx.beginPath();
        ctx.moveTo(x, plotTop);
        ctx.lineTo(x, plotBottom);
        ctx.stroke();
        ctx.fillStyle = textColor;
        ctx.textAlign = line === 0 ? "left" : (line === 4 ? "right" : "center");
        ctx.fillText(formatReplayMs(timeSpan * ratio), x, plotBottom + 15);
      }

      if(valid.length >= 2){
        const maxPoints = Math.max(120, Math.floor(plotWidth * 2));
        const step = Math.max(1, Math.ceil(valid.length / maxPoints));
        const xForTime = (time)=>plotLeft + (((Number(time) - firstTime) / timeSpan) * plotWidth);
        const yForValue = (value)=>{
          const clamped = Math.max(definition.min, Math.min(definition.max, Number(value)));
          return plotBottom - (((clamped - definition.min) / valueSpan) * plotHeight);
        };
        ctx.strokeStyle = definition.color;
        ctx.lineWidth = 1.7;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        let started = false;
        for(let index = 0; index < valid.length; index += step){
          const sample = valid[index];
          const x = xForTime(sample.time);
          const y = yForValue(sample[definition.key]);
          if(!started){
            ctx.moveTo(x, y);
            started = true;
          }else{
            ctx.lineTo(x, y);
          }
        }
        const last = valid[valid.length - 1];
        if((valid.length - 1) % step){
          ctx.lineTo(xForTime(last.time), yForValue(last[definition.key]));
        }
        ctx.stroke();
      }

      if(current){
        const playheadX = plotLeft + (((Number(current.time) - firstTime) / timeSpan) * plotWidth);
        ctx.strokeStyle = "rgba(255,255,255,.64)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(playheadX, plotTop);
        ctx.lineTo(playheadX, plotBottom);
        ctx.stroke();
      }
      ctx.restore();
    }

    function updateReplayModeUi(){
      document.documentElement.classList.toggle("replay-ui-active", !!replayUiActive);
      if(!replayUiActive){
        setReplayToolsPanelOpen(false);
        setReplayLinkStatusVisible(false);
      }
      if(el.controlsCard){
        el.controlsCard.classList.toggle("replay-mode", replayUiActive);
      }
      if(el.replayPanel){
        el.replayPanel.classList.toggle("hidden", !replayUiActive);
        el.replayPanel.setAttribute("aria-hidden", replayUiActive ? "false" : "true");
      }
      if(el.replayOpenBtns && el.replayOpenBtns.length){
        el.replayOpenBtns.forEach(btn=>{
          btn.setAttribute("aria-label", "Replay");
          btn.setAttribute("title", "Replay");
        });
      }
      const hasSamples = replayState.samples.length > 0;
      const controlsDisabled = replaySeekProcessing;
      if(el.replayPanel){
        el.replayPanel.classList.toggle("replay-empty", !hasSamples);
      }
      if(el.replayFileBtn){
        el.replayFileBtn.classList.toggle("is-loaded", !!replayState.fileName);
      }
      syncControlsPanelTitle();
      if(el.replayDropTitle){
        el.replayDropTitle.textContent = replayState.fileName ? replayState.fileName : "Replay 파일 업로드";
      }
      if(el.replayDropGuide){
        el.replayDropGuide.textContent = replayState.fileName
          ? ("파일 변경: 클릭 또는 드래그 (" + replayState.samples.length + " samples)")
          : "파일을 드래그하거나 클릭해 업로드";
      }
      const hasProgress = replayState.lastIndex >= 0 || replayState.index > 0;
      if(el.replayStartBtn){
        const startLabel = replayState.playing ? "정지" : (hasProgress ? "재개" : "재생");
        el.replayStartBtn.setAttribute("aria-label", startLabel);
        el.replayStartBtn.setAttribute("title", startLabel);
        el.replayStartBtn.classList.toggle("is-playing", !!replayState.playing);
        el.replayStartBtn.disabled = !hasSamples || controlsDisabled;
      }
      if(el.replayRestartBtn){
        el.replayRestartBtn.setAttribute("aria-label", "처음으로");
        el.replayRestartBtn.setAttribute("title", "처음으로");
        el.replayRestartBtn.disabled = !hasSamples || controlsDisabled;
      }
      if(el.replayEndBtn){
        el.replayEndBtn.setAttribute("aria-label", "끝으로");
        el.replayEndBtn.setAttribute("title", "끝으로");
        el.replayEndBtn.disabled = !hasSamples || controlsDisabled;
      }
      if(el.replayTminus10Btn){
        el.replayTminus10Btn.disabled = !hasSamples || controlsDisabled;
      }
      if(el.replayConvertBtn){
        el.replayConvertBtn.setAttribute("aria-label", "Excel 보고서 내보내기");
        el.replayConvertBtn.setAttribute("title", "Excel 보고서 내보내기");
        el.replayConvertBtn.disabled = !hasSamples || controlsDisabled;
      }
      if(el.replayDocxBtn){
        el.replayDocxBtn.setAttribute("aria-label", "Word 보고서 내보내기");
        el.replayDocxBtn.setAttribute("title", "Word 보고서 내보내기");
        el.replayDocxBtn.disabled = !hasSamples || controlsDisabled;
      }
      updateReplaySeekUi();
      updateReplaySpeedUi();
      updateReplayLinkStatusButton();
      syncReplayAlarmEventActive();
      updateNavActionState();
      updateExportButtonState();
    }

    function clearReplayTimer(){
      if(replayState.timer){
        clearTimeout(replayState.timer);
        replayState.timer = null;
      }
    }

    function replayClockNowMs(){
      return (typeof performance !== "undefined" && typeof performance.now === "function")
        ? performance.now()
        : Date.now();
    }

    function resetReplayClock(){
      replayState.nextDeadlineMs = NaN;
      replayState.lastUiUpdateMs = 0;
      replayState.lastRenderMs = 0;
    }

    function mergeReplayAlarmEvents(replaySample, startIndex, endIndex){
      if(startIndex == null || !isFinite(Number(startIndex))) return replaySample;
      const firstIndex = Math.max(0, Math.min(endIndex, Number(startIndex) || 0));
      if(firstIndex >= endIndex) return replaySample;
      const merged = [];
      for(let index = firstIndex; index <= endIndex; index++){
        const source = replayState.samples[index] && replayState.samples[index].sample;
        if(!source) continue;
        if(Array.isArray(source.mission_alarm_events)){
          for(const event of source.mission_alarm_events){
            if(event) merged.push(Object.assign({}, event));
          }
        }
        const seq = Number(source.mission_alarm_seq);
        if(isFinite(seq) && seq > 0){
          merged.push({
            seq,
            block: source.mission_alarm_block,
            title: source.mission_alarm_title,
            message: source.mission_alarm_message,
            timestampMs: source.mission_alarm_ts
          });
        }
      }
      if(merged.length) replaySample.mission_alarm_events = merged;
      return replaySample;
    }

    function applyReplaySampleAt(index, opts){
      if(index < 0 || index >= replayState.samples.length) return false;
      const frame = replayState.samples[index];
      if(!frame || !frame.sample) return false;
      const options = opts || {};
      const replaySample = mergeReplayAlarmEvents(
        Object.assign({}, frame.sample, {_replayTsMs: frame.tsMs}),
        options.mergeFromIndex,
        index
      );
      onIncomingSample(replaySample, "REPLAY", {
        fastSeek: !!options.fastSeek,
        forceUi: !!options.forceUi
      });
      if(!options.suppressBoardSim){
        sendBoardMissionSimSample(replaySample).catch(()=>{});
      }
      replayState.lastIndex = index;
      const uiNowMs = replayClockNowMs();
      replayState.lastRenderMs = uiNowMs;
      const uiDue =
        !!options.forceUi ||
        index >= replayState.samples.length - 1 ||
        !isFinite(replayState.lastUiUpdateMs) ||
        (uiNowMs - replayState.lastUiUpdateMs) >= 32;
      if(!options.suppressSeekUi && uiDue){
        replayState.lastUiUpdateMs = uiNowMs;
        updateReplaySeekUi();
        syncReplayAlarmEventActive();
        scheduleReplayLinkStatusRender();
      }
      return true;
    }

    function scheduleReplayTick(delayMs, opts){
      clearReplayTimer();
      if(!replayState.playing) return;
      const waitMs = Math.max(0, Math.round(Number(delayMs) || 0));
      const nowMs = replayClockNowMs();
      const rebase = !!(opts && opts.rebase);
      if(rebase || !isFinite(replayState.nextDeadlineMs)){
        replayState.nextDeadlineMs = nowMs + waitMs;
      }else{
        // Keep an absolute media clock. Rendering/telemetry work performed by
        // the previous tick must not be added to the next sample interval.
        replayState.nextDeadlineMs += waitMs;
      }
      const untilDeadlineMs = Math.max(0, replayState.nextDeadlineMs - nowMs);
      const sinceRenderMs = replayState.lastRenderMs > 0
        ? Math.max(0, nowMs - replayState.lastRenderMs)
        : REPLAY_MIN_RENDER_INTERVAL_MS;
      const renderThrottleMs = Math.max(0, REPLAY_MIN_RENDER_INTERVAL_MS - sinceRenderMs);
      replayState.timer = setTimeout(runReplayTick, Math.round(Math.max(untilDeadlineMs, renderThrottleMs)));
    }

    function replayPlaybackDelayBetween(currentIndex, nextIndex){
      const frames = replayState.samples || [];
      const current = frames[currentIndex];
      const next = frames[nextIndex];
      const nowTs = Number(current && current.tsMs);
      const nextTs = Number(next && next.tsMs);
      let deltaMs = nextTs - nowTs;
      if(!isFinite(deltaMs) || deltaMs < REPLAY_MIN_FRAME_DELAY_MS){
        deltaMs = REPLAY_DEFAULT_FRAME_DELAY_MS;
      }
      if(deltaMs > REPLAY_MAX_FRAME_DELAY_MS){
        deltaMs = REPLAY_MAX_FRAME_DELAY_MS;
      }
      const speed = (isFinite(replayState.speed) && replayState.speed > 0) ? replayState.speed : 1;
      return Math.max(REPLAY_MIN_FRAME_DELAY_MS, deltaMs / speed);
    }

    function runReplayTick(){
      replayState.timer = null;
      if(!replayState.playing) return;
      const total = replayState.samples.length;
      if(total <= 0){
        replayState.playing = false;
        setReplayStatus("리플레이 데이터 없음");
        updateReplayModeUi();
        return;
      }
      if(replayState.index >= total){
        replayState.playing = false;
        setReplayStatus("리플레이 종료");
        updateReplayModeUi();
        notifyAlarm("REPLAY_AUTOSTOP");
        return;
      }

      const currentIndex = replayState.index;
      let renderIndex = currentIndex;
      let renderDeadlineMs = Number(replayState.nextDeadlineMs);
      const nowMs = replayClockNowMs();
      if(!isFinite(renderDeadlineMs)) renderDeadlineMs = nowMs;

      // Keep replay media time locked to the wall clock. When a 200 Hz log is
      // more dense than the browser can render, coalesce already-due samples
      // into the newest frame instead of letting an ever-growing queue slow
      // playback. Mission alarm records from coalesced samples are merged below.
      while(renderIndex + 1 < total){
        const nextDelayMs = replayPlaybackDelayBetween(renderIndex, renderIndex + 1);
        if((renderDeadlineMs + nextDelayMs) > nowMs) break;
        renderDeadlineMs += nextDelayMs;
        renderIndex++;
      }
      replayState.nextDeadlineMs = renderDeadlineMs;
      const nextDelayMs = (renderIndex + 1 < total)
        ? replayPlaybackDelayBetween(renderIndex, renderIndex + 1)
        : null;
      let applied = false;
      try{
        applied = applyReplaySampleAt(renderIndex, {mergeFromIndex:currentIndex});
      }catch(err){
        applied = false;
        console.warn("Replay sample apply failed", err);
      }
      if(!applied){
        replayState.index = renderIndex + 1;
        if(replayState.index < total){
          setReplayStatus("리플레이 샘플 일부를 건너뛰고 계속 재생합니다.");
          scheduleReplayTick(nextDelayMs);
          return;
        }
        replayState.playing = false;
        setReplayStatus("리플레이 종료");
        updateReplayModeUi();
        notifyAlarm("REPLAY_AUTOSTOP");
        return;
      }
      replayState.index = renderIndex + 1;

      if(!replayState.playing){
        clearReplayTimer();
        return;
      }
      if(replayState.index >= total){
        replayState.playing = false;
        setReplayStatus("리플레이 종료");
        updateReplayModeUi();
        notifyAlarm("REPLAY_AUTOSTOP");
        return;
      }
      scheduleReplayTick(nextDelayMs);
    }

    function pauseReplayPlayback(opts){
      const silent = !!(opts && opts.silent);
      clearReplayTimer();
      resetReplayClock();
      const wasPlaying = replayState.playing;
      replayState.playing = false;
      sendBoardMissionSimControl(false).catch(()=>{});
      updateReplayModeUi();
      if(wasPlaying && !silent){
        setReplayStatus("리플레이 정지");
      }
    }

    function startReplayPlayback(){
      if(!replayState.samples.length){
        showToast("리플레이 파일을 먼저 선택하세요.", "notice", {key:"replay-no-file"});
        return;
      }
      if(replaySeekProcessing) return;
      if(replayState.playing) return;
      if(replayState.index >= replayState.samples.length){
        replayState.index = 0;
        replayState.lastIndex = -1;
      }
      if(replayState.lastIndex < 0 && replayState.index === 0){
        resetReplayBuffers();
      }
      setActiveDataSource(DATA_SOURCE_REPLAY);
      sendBoardMissionSimControl(true).catch(()=>{});
      replayState.playing = true;
      setReplayStatus("리플레이 재생 중");
      updateReplayModeUi();
      scheduleReplayTick(0, {rebase:true});
    }

    function restartReplayPlayback(){
      if(!replayState.samples.length){
        showToast("리플레이 파일을 먼저 선택하세요.", "notice", {key:"replay-no-file"});
        return;
      }
      if(replaySeekProcessing) return;
      pauseReplayPlayback({silent:true});
      setActiveDataSource(DATA_SOURCE_REPLAY);
      sendBoardMissionSimControl(true).catch(()=>{});
      replayState.index = 0;
      replayState.lastIndex = -1;
      resetReplayBuffers();
      replayState.playing = true;
      setReplayStatus("리플레이를 처음부터 재생합니다.");
      updateReplayModeUi();
      scheduleReplayTick(0, {rebase:true});
    }

    function seekReplayToIndex(targetIndex, resumePlayback){
      if(!replayState.samples.length) return;
      const maxIndex = replayState.samples.length - 1;
      const index = Math.max(0, Math.min(maxIndex, Number(targetIndex) || 0));
      const shouldResume = !!resumePlayback;
      const taskToken = ++replaySeekTaskToken;
      replaySeekDisplayIndex = index;
      pauseReplayPlayback({silent:true});
      setActiveDataSource(DATA_SOURCE_REPLAY);
      const currentIndex = replayState.lastIndex;
      if(currentIndex === index && replayState.index === index + 1){
        updateReplaySeekUi(index);
        setReplayStatus("리플레이 시점 이동");
        if(shouldResume && replayState.index <= maxIndex){
          replayState.playing = true;
          scheduleReplayTick(
            replayPlaybackDelayBetween(index, replayState.index),
            {rebase:true}
          );
        }
        updateReplayModeUi();
        return;
      }
      const canReuseForwardState = currentIndex >= 0 &&
        currentIndex < index &&
        replayState.index === currentIndex + 1;
      const startIndex = canReuseForwardState ? currentIndex + 1 : 0;
      if(!canReuseForwardState){
        resetReplayBuffers();
      }
      const totalWork = Math.max(1, index - startIndex + 1);
      setReplaySeekProcessingUi(true, 0, totalWork);
      updateReplayModeUi();

      (async ()=>{
        await delay(0);
        let i = startIndex;
        while(i < index){
          if(taskToken !== replaySeekTaskToken) return;
          const chunkEnd = Math.min(index - 1, i + REPLAY_SEEK_REBUILD_CHUNK - 1);
          for(; i <= chunkEnd; i++){
            if(!applyReplaySampleAt(i, {suppressSeekUi:true, suppressBoardSim:true, fastSeek:true})){
              i = index;
              break;
            }
          }
          if(taskToken !== replaySeekTaskToken) return;
          setReplaySeekProcessingUi(true, Math.min(i - startIndex, totalWork), totalWork);
          await delay(0);
        }
        if(taskToken !== replaySeekTaskToken) return;
        applyReplaySampleAt(index, {suppressSeekUi:true, suppressBoardSim:true, forceUi:true});
        if(taskToken !== replaySeekTaskToken) return;
        setReplaySeekProcessingUi(true, totalWork, totalWork);
        updateReplaySeekUi(index);
        replayState.index = index + 1;
        setReplayStatus("리플레이 시점 이동");
        if(shouldResume && replayState.index <= maxIndex){
          replayState.playing = true;
          scheduleReplayTick(
            replayPlaybackDelayBetween(index, replayState.index),
            {rebase:true}
          );
        }
      })().catch((err)=>{
        if(taskToken !== replaySeekTaskToken) return;
        const reason = (err && err.message) ? err.message : String(err || "unknown");
        setReplayStatus("리플레이 시점 이동 실패: " + reason);
      }).finally(()=>{
        if(taskToken !== replaySeekTaskToken) return;
        setReplaySeekProcessingUi(false);
        updateReplayModeUi();
      });
    }

    function findReplayTminusIndex(targetMs){
      const target = Number(targetMs);
      if(!isFinite(target)) return -1;
      if(!replayState.samples.length) return -1;
      let bestIndex = -1;
      let bestDiff = Infinity;

      for(let i = 0; i < replayState.samples.length; i++){
        const frame = replayState.samples[i];
        const td = Number(frame && frame.sample ? frame.sample.td : NaN);
        if(!isFinite(td) || td >= 0) continue;
        const diff = Math.abs(td - target);
        if(diff < bestDiff){
          bestDiff = diff;
          bestIndex = i;
        }
      }
      if(bestIndex >= 0){
        return bestIndex;
      }

      let t0Ts = null;
      for(let i = 0; i < replayState.samples.length; i++){
        const frame = replayState.samples[i];
        const td = Number(frame && frame.sample ? frame.sample.td : NaN);
        if(isFinite(td) && td >= 0){
          t0Ts = Number(frame.tsMs);
          break;
        }
      }
      if(!isFinite(t0Ts)){
        for(let i = 0; i < replayState.samples.length; i++){
          const frame = replayState.samples[i];
          const st = Number(frame && frame.sample ? frame.sample.st : NaN);
          if(st === 2){
            t0Ts = Number(frame.tsMs);
            break;
          }
        }
      }
      if(!isFinite(t0Ts)){
        return -1;
      }

      const targetTs = t0Ts + target;
      let nearest = -1;
      let nearestDiff = Infinity;
      for(let i = 0; i < replayState.samples.length; i++){
        const frameTs = Number(replayState.samples[i].tsMs);
        if(!isFinite(frameTs)) continue;
        const diff = Math.abs(frameTs - targetTs);
        if(diff < nearestDiff){
          nearestDiff = diff;
          nearest = i;
        }
      }
      return nearest;
    }

    function seekReplayToTminus10(){
      if(!replayState.samples.length){
        showToast("리플레이 파일을 먼저 선택하세요.", "notice", {key:"replay-no-file"});
        return;
      }
      const idx = findReplayTminusIndex(-10000);
      if(idx < 0){
        setReplayStatus("T-10 지점 없음");
        showToast("T-10 지점을 찾지 못했습니다.", "notice", {key:"replay-tminus-missing"});
        return;
      }
      const resume = replayState.playing;
      seekReplayToIndex(idx, resume);
      setReplayStatus("T-10 지점 이동");
      showToast("T-10 지점으로 이동", "info", {key:"replay-tminus10"});
    }

    function enterReplayMode(){
      if(isTabletPanelModeBlocked()){
        showTabletPanelBlockedToast("replay");
        return;
      }
      setLauncherPanelVisible(false);
      setMissionPanelVisible(false);
      setInspectionPanelVisible(false);
      replayUiActive = true;
      if(!replayState.samples.length){
        showReplayDataPicker();
      }
      updateReplayModeUi();
      if(isTabletControlsLayout()){
        showTabletControlsPanel();
      }else{
        showControlsModal();
      }
    }

    function activateReplayModeAfterSelection(){
      if(el.welcomeConnectScreen && !el.welcomeConnectScreen.classList.contains("hidden")){
        welcomeConnectAttempted = true;
        markWelcomeConnectionReady();
        setWelcomeConnectStatus("connected", "리플레이");
        setWelcomeConnectVisible(false);
      }
      try{ ensureDashboardViewForPanels(); }catch(_e){}
      if(!replayUiActive){
        enterReplayMode();
      }else{
        updateReplayModeUi();
      }
    }

    function setReplayDataPickerVisible(visible){
      const overlay = el.replayDataPickerOverlay;
      if(!overlay) return;
      const show = !!visible;
      overlay.classList.toggle("hidden", !show);
      overlay.style.setProperty("position", "fixed", "important");
      overlay.style.setProperty("inset", "0", "important");
      overlay.style.setProperty("z-index", "2147483646", "important");
      overlay.style.setProperty("display", show ? "flex" : "none", "important");
      overlay.setAttribute("aria-hidden", show ? "false" : "true");
      if(!show){
        overlay.querySelectorAll(".is-dragover").forEach(node=>{
          node.classList.remove("is-dragover");
        });
      }
      if(show){
        requestAnimationFrame(()=>{
          const firstAction = overlay.querySelector(".replay-data-picker-item, #replayBrowseFileBtn");
          if(firstAction) firstAction.focus({preventScroll:true});
        });
      }
    }

    function formatReplaySessionDate(value){
      const date = new Date(Number(value || 0));
      if(!isFinite(date.getTime())) return "날짜 정보 없음";
      return new Intl.DateTimeFormat("ko-KR", {
        month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit"
      }).format(date);
    }

    function renderReplayRecentSessions(sessions){
      const list = el.replayRecentList;
      if(!list) return;
      const items = (Array.isArray(sessions) ? sessions : [])
        .filter(session=>session && session.id && Number(session.sampleCount || 0) > 0)
        .slice(0, 8);
      if(el.replayRecentCount) el.replayRecentCount.textContent = items.length + "개";
      if(!items.length){
        list.innerHTML = '<div class="replay-data-picker-empty">앱에 저장된 비행 기록이 없습니다.</div>';
        return;
      }
      list.innerHTML = items.map((session, index)=>{
        const origin = dataOriginLabel(session.origin);
        const samples = Math.max(0, Number(session.sampleCount || 0));
        const bytes = Math.max(0, Number(session.bytes || 0));
        return '<button class="replay-data-picker-item" type="button" data-replay-session-index="' + index + '">' +
          '<span class="replay-data-picker-item-mark" aria-hidden="true"></span>' +
          '<span class="replay-data-picker-item-copy">' +
            '<strong>' + escapeHtmlText(origin + " 비행 기록") + '</strong>' +
            '<small>' + escapeHtmlText(formatReplaySessionDate(session.startedAt)) + ' · ' +
              samples.toLocaleString("ko-KR") + ' 샘플 · ' + escapeHtmlText(formatBytesCompact(bytes)) + '</small>' +
          '</span>' +
          '<span class="replay-data-picker-file-arrow" aria-hidden="true">›</span>' +
        '</button>';
      }).join("");
      list.querySelectorAll("[data-replay-session-index]").forEach(button=>{
        button.addEventListener("click", async()=>{
          const session = items[Number(button.dataset.replaySessionIndex)];
          if(!session || typeof replayFileLoader !== "function") return;
          button.disabled = true;
          button.classList.add("is-loading");
          try{
            const file = await buildAppDataSessionFile(session);
            await replayFileLoader(file);
            if(replayState.samples.length) setReplayDataPickerVisible(false);
          }catch(err){
            const reason = (err && err.message) ? err.message : String(err || "unknown");
            showToast("저장 기록을 열지 못했습니다: " + reason, "error", {key:"replay-app-session-fail"});
          }finally{
            button.disabled = false;
            button.classList.remove("is-loading");
          }
        });
      });
    }

    async function showReplayDataPicker(){
      if(!el.replayDataPickerOverlay) return;
      if(el.replayDataPickerOverlay.parentElement !== document.body){
        document.body.appendChild(el.replayDataPickerOverlay);
      }
      const requestId = ++replayPickerRequestId;
      if(el.replayRecentList){
        el.replayRecentList.innerHTML = '<div class="replay-data-picker-empty">저장 기록을 불러오는 중입니다.</div>';
      }
      if(el.replayRecentCount) el.replayRecentCount.textContent = "--";
      setReplayDataPickerVisible(true);
      const sessions = await listAppDataSessions();
      if(requestId !== replayPickerRequestId) return;
      renderReplayRecentSessions(sessions);
    }

    function returnToWelcomeAfterReplay(){
      welcomeDashboardEntered = false;
      if(!isVerifiedBoardTransportConnected()){
        clearWelcomeConnectionReady();
        setWelcomeConnectStatus("idle", "연결 대기중");
      }
      syncWelcomeConnectScreen(isVerifiedBoardTransportConnected());
    }

    function exitReplayMode(options){
      const opts = options || {};
      setReplayHudLiveVisible(false);
      cancelReplaySeekProcessing();
      replayUiActive = false;
      pauseReplayPlayback({silent:true});
      sendBoardMissionSimControl(false).catch(()=>{});
      setActiveDataSource(DATA_SOURCE_LIVE);
      setReplayStatus("실시간 모드");
      updateReplayModeUi();
      updateData().catch(()=>{});
      if(opts.returnHome){
        returnToWelcomeAfterReplay();
      }
    }

    function replayNormalizeZipPath(path){
      const api = (typeof window !== "undefined") ? window.FLASH6_ZIP : null;
      return api && typeof api.normalizePath === "function"
        ? api.normalizePath(path)
        : String(path || "").replace(/\\/g, "/");
    }

    function replayResolveZipPath(baseDir, target){
      const api = (typeof window !== "undefined") ? window.FLASH6_ZIP : null;
      if(api && typeof api.resolvePath === "function") return api.resolvePath(baseDir, target);
      if(!target) return "";
      if(target[0] === "/") return replayNormalizeZipPath(target.slice(1));
      return replayNormalizeZipPath((baseDir ? (baseDir + "/") : "") + target);
    }

    async function replayUnzipEntries(arrayBuffer){
      const api = (typeof window !== "undefined") ? window.FLASH6_ZIP : null;
      if(!api || typeof api.readEntries !== "function"){
        throw new Error("FLASH6 ZIP helper missing");
      }
      return await api.readEntries(arrayBuffer);
    }

    function replayZipText(entries, path){
      const api = (typeof window !== "undefined") ? window.FLASH6_ZIP : null;
      if(api && typeof api.textFromEntries === "function") return api.textFromEntries(entries, path);
      const key = replayNormalizeZipPath(path);
      const bytes = entries.get(key);
      if(!bytes) return null;
      return new TextDecoder("utf-8").decode(bytes);
    }

    function replayParseXml(xmlText, name){
      const doc = new DOMParser().parseFromString(xmlText, "application/xml");
      if(doc.getElementsByTagName("parsererror").length){
        throw new Error("XML 파싱 오류: " + (name || "unknown"));
      }
      return doc;
    }

    function replayNodeText(node){
      if(!node) return "";
      const tNodes = Array.from(node.getElementsByTagName("t"));
      if(!tNodes.length){
        return node.textContent || "";
      }
      return tNodes.map(n=>n.textContent || "").join("");
    }

    function replayCellRefToColIndex(ref){
      const match = /^[A-Z]+/i.exec(ref || "");
      if(!match) return -1;
      const letters = match[0].toUpperCase();
      let col = 0;
      for(let i = 0; i < letters.length; i++){
        col = (col * 26) + (letters.charCodeAt(i) - 64);
      }
      return col - 1;
    }

    function replayReadSharedStrings(entries){
      const xml = replayZipText(entries, "xl/sharedStrings.xml");
      if(!xml) return [];
      const doc = replayParseXml(xml, "sharedStrings");
      return Array.from(doc.getElementsByTagName("si")).map(node=>replayNodeText(node));
    }

    function replayReadCellValue(cell, sharedStrings){
      const type = cell.getAttribute("t") || "";
      if(type === "inlineStr"){
        const isNode = cell.getElementsByTagName("is")[0];
        return replayNodeText(isNode || cell);
      }
      const vNode = cell.getElementsByTagName("v")[0];
      const raw = vNode ? String(vNode.textContent || "") : "";
      if(type === "s"){
        const idx = Number(raw);
        return (isFinite(idx) && sharedStrings[idx] != null) ? sharedStrings[idx] : "";
      }
      if(type === "b"){
        return raw === "1" ? 1 : 0;
      }
      if(raw === "") return "";
      const num = Number(raw);
      return isFinite(num) ? num : raw;
    }

    function replayReadSheetRows(sheetXml, sharedStrings){
      const doc = replayParseXml(sheetXml, "worksheet");
      const rows = [];
      const rowNodes = Array.from(doc.getElementsByTagName("row"));
      rowNodes.forEach(rowNode=>{
        const row = [];
        const cells = Array.from(rowNode.getElementsByTagName("c"));
        let fallbackCol = 0;
        cells.forEach(cell=>{
          let col = replayCellRefToColIndex(cell.getAttribute("r") || "");
          if(col < 0) col = fallbackCol;
          row[col] = replayReadCellValue(cell, sharedStrings);
          fallbackCol = col + 1;
        });
        rows.push(row);
      });
      return rows;
    }

    function replayNormalizeHeader(value){
      return String(value == null ? "" : value)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9가-힣_]/g, "");
    }

    function replayFindHeaderIndex(headers, candidates){
      const normalized = headers.map(replayNormalizeHeader);
      for(const candidate of candidates){
        const token = replayNormalizeHeader(candidate);
        const idx = normalized.indexOf(token);
        if(idx >= 0) return idx;
      }
      return -1;
    }

    function replayToNumber(value, fallback){
      if(value == null) return fallback;
      if(typeof value === "string"){
        const s = value.trim();
        if(s === "") return fallback;
        const commaDecimal = s.replace(",", ".");
        const numComma = Number(commaDecimal);
        if(isFinite(numComma)) return numComma;
      }
      const num = Number(value);
      return isFinite(num) ? num : fallback;
    }

    function replayConvertThrustToKgf(headerNorm, value){
      const v = Number(value);
      if(!isFinite(v)) return NaN;
      const h = String(headerNorm || "");
      if(h.includes("thrustn") || h.includes("motorthrustn")){
        return v / 9.80665;
      }
      return v;
    }

    function replayConvertPressureToMpa(headerNorm, value){
      const v = Number(value);
      if(!isFinite(v)) return NaN;
      const h = String(headerNorm || "");
      if(h.includes("pressurev") || h === "pv"){
        return pressureVoltToMpa(v);
      }
      if(h.includes("pressurepa")){
        return v / 1000000;
      }
      if(h.includes("pressurekpa")){
        return v / 1000;
      }
      if(h.includes("pressurebar")){
        return v * 0.1;
      }
      return v;
    }

    function replayConvertAccelToG(headerNorm, value){
      const v = Number(value);
      if(!isFinite(v)) return NaN;
      const h = String(headerNorm || "");
      if(h.includes("ms2")){
        return v / 9.80665;
      }
      return v;
    }

    function replayToBinary(value, fallback){
      if(typeof value === "string"){
        const token = value.trim().toLowerCase();
        if(token === "1" || token === "true" || token === "on" || token === "high" || token === "ok") return 1;
        if(token === "0" || token === "false" || token === "off" || token === "low" || token === "no") return 0;
      }
      const num = Number(value);
      if(isFinite(num)) return num ? 1 : 0;
      return fallback;
    }

    function replayExcelSerialToMs(serial){
      const n = Number(serial);
      if(!isFinite(n)) return null;
      return Math.round((n - 25569) * 86400000);
    }

    function replayBuildSamples(rows){
      if(!rows || !rows.length){
        throw new Error("시트에 데이터가 없습니다.");
      }

      let headerRow = 0;
      for(let i = 0; i < Math.min(rows.length, 12); i++){
        const row = rows[i] || [];
        const thrustIdx = replayFindHeaderIndex(row, [
          "thrust_kgf", "추력_kgf", "thrustkgf", "thrustn", "motorthrustn", "thrust", "t"
        ]);
        const pressureIdx = replayFindHeaderIndex(row, [
          "pressure_mpa", "압력_mpa", "pressure_v", "압력_v", "airpressurepa",
          "airpressurekpa", "airpressurebar", "airpressure",
          "pressurepa", "pressurekpa", "pressurebar", "pressure", "p"
        ]);
        const timeIdx = replayFindHeaderIndex(row, [
          "time_iso", "timestamp", "datetime", "time", "times", "timesec", "timesecs", "time_s", "time_sec"
        ]);
        const altIdx = replayFindHeaderIndex(row, [
          "altitude_m", "altitudem", "altitude", "alt_m", "alt",
          "baro_altitude_raw_m", "altitude_corrected_m"
        ]);
        if(thrustIdx >= 0 || pressureIdx >= 0 || timeIdx >= 0 || altIdx >= 0){
          headerRow = i;
          break;
        }
      }

      const headers = rows[headerRow] || [];
      const col = {
        timeIso: replayFindHeaderIndex(headers, [
          "time_iso", "시간_iso", "timestamp", "datetime", "utc_time", "time_iso8601", "date", "datetimeutc"
        ]),
        thrust: replayFindHeaderIndex(headers, [
          "thrust_kgf", "추력_kgf", "thrustkgf", "thrustn", "motorthrustn", "thrust", "t"
        ]),
        pressure: replayFindHeaderIndex(headers, [
          "pressure_mpa", "압력_mpa", "pressure_v", "압력_v", "pv",
          "airpressurepa", "airpressurekpa", "airpressurebar", "airpressure",
          "pressurepa", "pressurekpa", "pressurebar", "pressure", "p"
        ]),
        gpsLat: replayFindHeaderIndex(headers, [
          "gps_lat", "gpslat", "gpslatitude", "nav_lat", "latitude", "lat",
          "gps_위도_deg", "위도_deg", "위도"
        ]),
        gpsLon: replayFindHeaderIndex(headers, [
          "gps_lon", "gpslng", "gpslong", "gpslongitude", "nav_lon", "nav_lng", "longitude", "lon", "lng",
          "gps_경도_deg", "경도_deg", "경도"
        ]),
        gpsAlt: replayFindHeaderIndex(headers, [
          "gps_alt", "gpsalt", "gpsaltitude", "nav_alt", "altitude_gps_m",
          "gps_고도_m", "고도_gps_m"
        ]),
        altitudeM: replayFindHeaderIndex(headers, [
          "baro_altitude_raw_m", "altitude_m", "고도_m", "alt_m", "altitude", "alt", "gps_alt",
          "altitude_msl", "altitudem", "고도m", "고도"
        ]),
        altitudeCorrectedM: replayFindHeaderIndex(headers, [
          "altitude_corrected_m", "corrected_altitude_m", "보정고도_m"
        ]),
        speedMps: replayFindHeaderIndex(headers, [
          "speed_mps", "속도_mps", "gps_speed_mps", "ground_speed_mps", "velocity_mps", "speed",
          "velocity", "speedms", "speedmps", "totalvelocityms", "속도"
        ]),
        verticalSpeedMps: replayFindHeaderIndex(headers, [
          "vertical_speed_mps", "verticalspeedmps", "altitude_speed_mps", "altitudespeedmps",
          "verticalvelocity", "verticalvelocityms", "velocityzms",
          "climb_rate_mps", "climbratemps", "상승속도_mps", "고도속도_mps"
        ]),
        accelX: replayFindHeaderIndex(headers, [
          "accel_x_g", "가속도_x_g", "ax", "accel_x", "accelerationxms2", "accelerationx"
        ]),
        accelY: replayFindHeaderIndex(headers, [
          "accel_y_g", "가속도_y_g", "ay", "accel_y", "accelerationyms2", "accelerationy"
        ]),
        accelZ: replayFindHeaderIndex(headers, [
          "accel_z_g", "가속도_z_g", "az", "accel_z", "accelerationzms2", "accelerationz", "accelerationtotalms2"
        ]),
        gyroX: replayFindHeaderIndex(headers, [
          "gyro_x_dps", "자이로_x_dps", "gx", "gyro_x", "rotationratex", "rotationratexs", "rotationratexdegs", "rollratedegs", "rollrate"
        ]),
        gyroY: replayFindHeaderIndex(headers, [
          "gyro_y_dps", "자이로_y_dps", "gy", "gyro_y", "rotationratey", "rotationrateys", "rotationrateydegs", "pitchratedegs", "pitchrate"
        ]),
        gyroZ: replayFindHeaderIndex(headers, [
          "gyro_z_dps", "자이로_z_dps", "gz", "gyro_z", "rotationratez", "rotationratezs", "rotationratezdegs", "yawratedegs", "yawrate"
        ]),
        loopMs: replayFindHeaderIndex(headers, ["loop_ms", "루프_ms", "lt"]),
        hz: replayFindHeaderIndex(headers, ["hx_hz", "hz"]),
        cpuUs: replayFindHeaderIndex(headers, ["cpu_us", "cpu", "ct"]),
        sw: replayFindHeaderIndex(headers, ["switch", "스위치", "s"]),
        swPhysical: replayFindHeaderIndex(headers, ["arm_physical", "armphysical", "physical_arm", "sp"]),
        armLock: replayFindHeaderIndex(headers, ["arm_lock", "armlock", "al"]),
        ic: replayFindHeaderIndex(headers, ["ign_ok", "점화_정상", "ic", "igniter"]),
        relay: replayFindHeaderIndex(headers, ["relay", "릴레이", "r"]),
        gs: replayFindHeaderIndex(headers, ["igs_mode", "igs_모드", "igs", "gs"]),
        state: replayFindHeaderIndex(headers, ["state", "상태", "st"]),
        flightPhase: replayFindHeaderIndex(headers, ["flight_phase", "flightphase", "비행상태"]),
        flightPhaseCode: replayFindHeaderIndex(headers, ["flight_phase_code", "flightphasecode"]),
        tdMs: replayFindHeaderIndex(headers, ["td_ms", "tdms", "td"]),
        elapsedMs: replayFindHeaderIndex(headers, ["elapsed_ms", "경과_ms", "elapsed"]),
        relTimeSec: replayFindHeaderIndex(headers, [
          "rel_time_s", "상대시간_s", "reltime", "time_axis", "time", "times", "timesec", "timesecs", "timesseconds",
          "time_s", "time_sec", "time_seconds"
        ])
      };

      const hasFallbackSignal =
        (col.timeIso >= 0 || col.relTimeSec >= 0 || col.elapsedMs >= 0) ||
        (col.altitudeM >= 0 || col.speedMps >= 0) ||
        (col.accelX >= 0 || col.accelY >= 0 || col.accelZ >= 0) ||
        (col.gyroX >= 0 || col.gyroY >= 0 || col.gyroZ >= 0) ||
        (col.gpsLat >= 0 || col.gpsLon >= 0 || col.gpsAlt >= 0);
      if(col.thrust < 0 && col.pressure < 0 && !hasFallbackSignal){
        throw new Error("리플레이 컬럼을 찾지 못했습니다. (추력/압력/시간/고도)");
      }

      const thrustHeaderNorm = (col.thrust >= 0) ? replayNormalizeHeader(headers[col.thrust]) : "";
      const pressureHeaderNorm = (col.pressure >= 0) ? replayNormalizeHeader(headers[col.pressure]) : "";
      const accelXHeaderNorm = (col.accelX >= 0) ? replayNormalizeHeader(headers[col.accelX]) : "";
      const accelYHeaderNorm = (col.accelY >= 0) ? replayNormalizeHeader(headers[col.accelY]) : "";
      const accelZHeaderNorm = (col.accelZ >= 0) ? replayNormalizeHeader(headers[col.accelZ]) : "";

      const samples = [];
      let prevTs = null;
      const lastFinite = {
        t: null,
        p: null,
        ax: null,
        ay: null,
        az: null,
        gx: null,
        gy: null,
        gz: null
      };
      const holdFinite = (key, value, fallback)=>{
        if(isFinite(value)){
          lastFinite[key] = value;
          return value;
        }
        if(isFinite(lastFinite[key])) return lastFinite[key];
        return fallback;
      };
      for(let r = headerRow + 1; r < rows.length; r++){
        const row = rows[r] || [];
        if(!row.length) continue;

        const thrustRaw = replayToNumber(col.thrust >= 0 ? row[col.thrust] : null, NaN);
        const thrustVal = replayConvertThrustToKgf(thrustHeaderNorm, thrustRaw);
        const pressureRaw = replayToNumber(col.pressure >= 0 ? row[col.pressure] : null, NaN);
        const pressureVal = replayConvertPressureToMpa(pressureHeaderNorm, pressureRaw);

        const latReplay = replayToNumber(col.gpsLat >= 0 ? row[col.gpsLat] : null, NaN);
        const lonReplay = replayToNumber(col.gpsLon >= 0 ? row[col.gpsLon] : null, NaN);
        const gpsAltReplay = replayToNumber(col.gpsAlt >= 0 ? row[col.gpsAlt] : null, NaN);
        const altReplay = replayToNumber(col.altitudeM >= 0 ? row[col.altitudeM] : null, NaN);
        const correctedAltReplay = replayToNumber(
          col.altitudeCorrectedM >= 0 ? row[col.altitudeCorrectedM] : null,
          NaN
        );
        const speedReplay = replayToNumber(col.speedMps >= 0 ? row[col.speedMps] : null, NaN);

        const accelXVal = replayConvertAccelToG(
          accelXHeaderNorm,
          replayToNumber(col.accelX >= 0 ? row[col.accelX] : null, NaN)
        );
        const accelYVal = replayConvertAccelToG(
          accelYHeaderNorm,
          replayToNumber(col.accelY >= 0 ? row[col.accelY] : null, NaN)
        );
        const accelZVal = replayConvertAccelToG(
          accelZHeaderNorm,
          replayToNumber(col.accelZ >= 0 ? row[col.accelZ] : null, NaN)
        );
        const gyroXVal = replayToNumber(col.gyroX >= 0 ? row[col.gyroX] : null, NaN);
        const gyroYVal = replayToNumber(col.gyroY >= 0 ? row[col.gyroY] : null, NaN);
        const gyroZVal = replayToNumber(col.gyroZ >= 0 ? row[col.gyroZ] : null, NaN);

        const hasPayload =
          isFinite(thrustVal) || isFinite(pressureVal) ||
          isFinite(latReplay) || isFinite(lonReplay) || isFinite(gpsAltReplay) ||
          isFinite(altReplay) || isFinite(speedReplay) ||
          isFinite(accelXVal) || isFinite(accelYVal) || isFinite(accelZVal) ||
          isFinite(gyroXVal) || isFinite(gyroYVal) || isFinite(gyroZVal);
        if(!hasPayload) continue;

        let tsMs = null;
        if(col.timeIso >= 0){
          const rawTs = row[col.timeIso];
          if(typeof rawTs === "number"){
            if(rawTs > 1000000000000){
              tsMs = rawTs;
            }else if(rawTs > 1000000000){
              tsMs = rawTs * 1000;
            }else if(rawTs > 30000){
              tsMs = replayExcelSerialToMs(rawTs);
            }else if(rawTs >= 0){
              tsMs = rawTs * 1000;
            }else{
              tsMs = (rawTs > 1000000000000) ? rawTs : (rawTs * 1000);
            }
          }else if(rawTs != null && rawTs !== ""){
            const parsed = Date.parse(String(rawTs));
            if(isFinite(parsed)) tsMs = parsed;
          }
        }
        if(tsMs == null && col.elapsedMs >= 0){
          const elapsed = replayToNumber(row[col.elapsedMs], NaN);
          if(isFinite(elapsed)) tsMs = elapsed;
        }
        if(tsMs == null && col.relTimeSec >= 0){
          const relSec = replayToNumber(row[col.relTimeSec], NaN);
          if(isFinite(relSec)) tsMs = relSec * 1000;
        }
        if(tsMs == null && col.hz >= 0 && prevTs != null){
          const hz = replayToNumber(row[col.hz], NaN);
          if(isFinite(hz) && hz > 0) tsMs = prevTs + (1000 / hz);
        }
        if(tsMs == null){
          tsMs = (prevTs == null) ? 0 : (prevTs + 100);
        }
        if(prevTs != null && tsMs <= prevTs){
          tsMs = prevTs + 1;
        }
        prevTs = tsMs;

        const tOut = holdFinite("t", thrustVal, 0);
        const pOut = holdFinite("p", pressureVal, 0);
        const axOut = holdFinite("ax", accelXVal, 0);
        const ayOut = holdFinite("ay", accelYVal, 0);
        const azOut = holdFinite("az", accelZVal, 0);
        const gxOut = holdFinite("gx", gyroXVal, 0);
        const gyOut = holdFinite("gy", gyroYVal, 0);
        const gzOut = holdFinite("gz", gyroZVal, 0);

        samples.push({
          tsMs,
          sample: {
            t: tOut,
            p: pOut,
            gps_lat: isFinite(latReplay) ? latReplay : null,
            gps_lon: isFinite(lonReplay) ? lonReplay : null,
            gps_alt: isFinite(gpsAltReplay) ? gpsAltReplay : null,
            alt_m: isFinite(altReplay) ? altReplay : null,
            altitude_corrected_m:isFinite(correctedAltReplay) ? correctedAltReplay : null,
            speed_mps: isFinite(speedReplay) ? speedReplay : null,
            actual_speed_recorded:isFinite(speedReplay) ? 1 : 0,
            actual_speed_source:isFinite(speedReplay) ? "IMPORTED" : "",
            vertical_speed_mps: replayToNumber(col.verticalSpeedMps >= 0 ? row[col.verticalSpeedMps] : null, null),
            ax: axOut,
            ay: ayOut,
            az: azOut,
            gx: gxOut,
            gy: gyOut,
            gz: gzOut,
            lt: replayToNumber(col.loopMs >= 0 ? row[col.loopMs] : null, 0),
            hz: replayToNumber(col.hz >= 0 ? row[col.hz] : null, 0),
            ct: replayToNumber(col.cpuUs >= 0 ? row[col.cpuUs] : null, 0),
            s: replayToBinary(col.sw >= 0 ? row[col.sw] : null, 0),
            sp: col.swPhysical >= 0 ? replayToBinary(row[col.swPhysical], 0) : null,
            al: col.armLock >= 0 ? replayToBinary(row[col.armLock], 0) : null,
            ic: replayToBinary(col.ic >= 0 ? row[col.ic] : null, 0),
            r: replayToNumber(col.relay >= 0 ? row[col.relay] : null, 0),
            gs: replayToBinary(col.gs >= 0 ? row[col.gs] : null, 0),
            st: replayToNumber(col.state >= 0 ? row[col.state] : null, 0),
            flight_phase:col.flightPhase >= 0 ? String(row[col.flightPhase] || "").trim().toUpperCase() : null,
            flight_phase_code:replayToNumber(col.flightPhaseCode >= 0 ? row[col.flightPhaseCode] : null, null),
            td: (col.tdMs >= 0) ? replayToNumber(row[col.tdMs], 0) : null
          }
        });
      }

      if(!samples.length){
        throw new Error("리플레이 가능한 샘플이 없습니다.");
      }
      return samples;
    }

    function replaySelectSheetPath(entries){
      const workbookXml = replayZipText(entries, "xl/workbook.xml");
      const relsXml = replayZipText(entries, "xl/_rels/workbook.xml.rels");
      let preferred = null;
      if(workbookXml && relsXml){
        const wbDoc = replayParseXml(workbookXml, "workbook");
        const relDoc = replayParseXml(relsXml, "workbook.rels");
        const relMap = {};
        Array.from(relDoc.getElementsByTagName("Relationship")).forEach(rel=>{
          const id = rel.getAttribute("Id");
          const target = rel.getAttribute("Target");
          if(id && target){
            relMap[id] = replayResolveZipPath("xl", target);
          }
        });
        let fallback = null;
        Array.from(wbDoc.getElementsByTagName("sheet")).forEach(sheet=>{
          const rid = sheet.getAttribute("r:id");
          const name = String(sheet.getAttribute("name") || "").trim().toLowerCase();
          const path = rid ? relMap[rid] : null;
          if(path && !fallback) fallback = path;
          if(path && (name === "raw" || name.indexOf("raw") >= 0)){
            preferred = path;
          }
        });
        if(!preferred) preferred = fallback;
      }
      return preferred ? replayNormalizeZipPath(preferred) : null;
    }

    async function parseReplayXlsx(file){
      if(!file) throw new Error("리플레이 파일이 선택되지 않았습니다.");
      const entries = await replayUnzipEntries(await file.arrayBuffer());
      const worksheetPaths = Array.from(entries.keys())
        .filter(name=>/^xl\/worksheets\/.+\.xml$/i.test(name))
        .sort();
      if(!worksheetPaths.length){
        throw new Error("XLSX 워크시트를 찾지 못했습니다.");
      }

      const preferred = replaySelectSheetPath(entries);
      const targets = preferred
        ? [preferred, ...worksheetPaths.filter(name=>name !== preferred)]
        : worksheetPaths.slice();
      const sharedStrings = replayReadSharedStrings(entries);
      let lastErr = null;
      for(const path of targets){
        try{
          const sheetXml = replayZipText(entries, path);
          if(!sheetXml) continue;
          const rows = replayReadSheetRows(sheetXml, sharedStrings);
          const samples = replayBuildSamples(rows);
          if(samples.length) return samples;
        }catch(err){
          lastErr = err;
        }
      }
      throw (lastErr || new Error("리플레이 데이터를 해석하지 못했습니다."));
    }

    function replayDetectCsvDelimiter(line){
      const text = String(line || "");
      const candidates = [",", ";", "\t", "|"];
      let best = ",";
      let bestScore = -1;
      for(const d of candidates){
        let inQuotes = false;
        let score = 0;
        for(let i = 0; i < text.length; i++){
          const ch = text[i];
          if(ch === "\""){
            if(inQuotes && text[i + 1] === "\""){
              i += 1;
            }else{
              inQuotes = !inQuotes;
            }
            continue;
          }
          if(!inQuotes && ch === d){
            score += 1;
          }
        }
        if(score > bestScore){
          bestScore = score;
          best = d;
        }
      }
      return best;
    }

    function replayParseCsvLine(line, delimiter){
      const delim = delimiter || ",";
      const src = String(line == null ? "" : line);
      const out = [];
      let cur = "";
      let inQuotes = false;
      for(let i = 0; i < src.length; i++){
        const ch = src[i];
        if(ch === "\""){
          if(inQuotes && src[i + 1] === "\""){
            cur += "\"";
            i += 1;
          }else{
            inQuotes = !inQuotes;
          }
          continue;
        }
        if(!inQuotes && ch === delim){
          out.push(cur.trim());
          cur = "";
          continue;
        }
        cur += ch;
      }
      out.push(cur.trim());
      return out;
    }

    function replayParseCsvText(csvText){
      const text = String(csvText || "").replace(/^\uFEFF/, "");
      const lines = text.split(/\r\n|\n|\r/).filter((line)=>String(line || "").trim() !== "");
      if(!lines.length){
        throw new Error("CSV 데이터가 비어 있습니다.");
      }
      const delimiter = replayDetectCsvDelimiter(lines[0]);
      const rows = [];
      for(const line of lines){
        rows.push(replayParseCsvLine(line, delimiter));
      }
      return rows;
    }

    async function parseReplayCsv(file){
      if(!file) throw new Error("리플레이 CSV 파일이 선택되지 않았습니다.");
      const text = await file.text();
      const rows = replayParseCsvText(text);
      return replayBuildSamples(rows);
    }

    const REPLAY_BIN_HEADER_MIN_BYTES = 40;
    const REPLAY_BIN_RECORD_HEADER_BYTES = 16;
    const REPLAY_BIN_SAMPLE_PAYLOAD_BYTES = 70;
    const REPLAY_BIN_SAMPLE_V2_PAYLOAD_BYTES = 40;
    const REPLAY_BIN_SAMPLE_V3_PAYLOAD_BYTES = 52;
    const REPLAY_BIN_SAMPLE_V4_PAYLOAD_BYTES = 68;
    const REPLAY_BIN_SAMPLE_V5_PAYLOAD_BYTES = 88;
    const REPLAY_BIN_SAMPLE_APP_V6_PAYLOAD_BYTES = 80;
    const REPLAY_BIN_MISSION_ALARM_PAYLOAD_BYTES = 52;
    const REPLAY_BIN_MISSION_ALARM_V4_PAYLOAD_BYTES = 68;
    const REPLAY_BIN_MISSION_ALARM_V5_PAYLOAD_BYTES = 88;
    const REPLAY_BIN_APP_RECORD_V4_BYTES = REPLAY_BIN_RECORD_HEADER_BYTES + REPLAY_BIN_SAMPLE_V4_PAYLOAD_BYTES;
    const REPLAY_BIN_APP_RECORD_V6_BYTES = REPLAY_BIN_RECORD_HEADER_BYTES + REPLAY_BIN_SAMPLE_APP_V6_PAYLOAD_BYTES;
    const REPLAY_BIN_RECORD_MARKER = 0xA55A;
    const REPLAY_BIN_RECORD_MARKER_ALT = 0x5AA5;
    const REPLAY_BIN_SCAN_MAX_BYTES = 1024 * 1024;
    const REPLAY_BIN_APP_SOURCE_TAG = 0x31505041; // "APP1"
    const REPLAY_BIN_METADATA_BYTES = 64;
    const REPLAY_BIN_METADATA_MAGIC = 0x32544D48; // "HMT2"
    const REPLAY_PROTOCOL_COMPATIBLE_MIN = 8;
    const REPLAY_PROTOCOL_COMPATIBLE_MAX = 8;
    const REPLAY_LEGACY_ARM_DEBOUNCE_MS = 50;
    const REPLAY_LEGACY_THRUST_ACCEL_G = 1.5;
    const REPLAY_LEGACY_THRUST_HOLD_MS = 100;
    const REPLAY_LEGACY_ARM_CONFIRM_MS = 1000;
    const REPLAY_SEQUENCE_STATE_IDLE = 0;
    const REPLAY_SEQUENCE_STATE_TPLUS = 3;

    function replayReadMagicText(dv, offset, len){
      let out = "";
      for(let i = 0; i < len; i++){
        const c = dv.getUint8(offset + i);
        if(c === 0) break;
        out += String.fromCharCode(c);
      }
      return out;
    }

    function replayInspectBinProtocol(arrayBuffer){
      const result = {
        candidate:false,
        hasMetadata:false,
        compatible:false,
        protocolVersion:0,
        missionTimebaseVersion:0,
        firmwareBuildNumber:0,
        sessionId:0,
        reason:"missing"
      };
      if(!(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength < 2){
        return result;
      }
      const dv = new DataView(arrayBuffer);
      const magic = arrayBuffer.byteLength >= 8
        ? replayReadMagicText(dv, 0, 8).replace(/\0+$/g, "")
        : "";
      const headerCandidate = magic.toUpperCase().indexOf("HWLOGV") === 0;
      const rawCandidate =
        dv.getUint16(0, true) === REPLAY_BIN_RECORD_MARKER ||
        dv.getUint16(0, true) === REPLAY_BIN_RECORD_MARKER_ALT;
      result.candidate = headerCandidate || rawCandidate;
      if(!headerCandidate || arrayBuffer.byteLength < REPLAY_BIN_METADATA_BYTES){
        return result;
      }
      const headerSize = dv.getUint16(10, true);
      if(headerSize < REPLAY_BIN_METADATA_BYTES ||
         dv.getUint32(40, true) !== REPLAY_BIN_METADATA_MAGIC ||
         dv.getUint16(44, true) !== 1){
        return result;
      }
      const metadataFlags = dv.getUint16(46, true);
      const protocolVersion = dv.getUint16(52, true);
      result.sessionId = dv.getUint32(48, true);
      result.protocolVersion = protocolVersion;
      result.firmwareBuildNumber = dv.getUint16(54, true);
      result.missionTimebaseVersion = dv.getUint8(56);
      result.hasMetadata = (metadataFlags & 1) !== 0 && protocolVersion > 0;
      if(!result.hasMetadata) return result;
      result.compatible =
        protocolVersion >= REPLAY_PROTOCOL_COMPATIBLE_MIN &&
        protocolVersion <= REPLAY_PROTOCOL_COMPATIBLE_MAX;
      result.reason = result.compatible ? "native" : "outside-range";
      return result;
    }

    function replayLegacyEntryTimeMs(entry, fallbackMs){
      const entryTs = Number(entry && entry.tsMs);
      if(isFinite(entryTs) && entryTs >= 0) return entryTs;
      const sampleTs = Number(entry && entry.sample && entry.sample.ut);
      if(isFinite(sampleTs) && sampleTs >= 0) return sampleTs;
      return Math.max(0, Number(fallbackMs) || 0);
    }

    function replayLegacyArmInstalled(sample){
      if(!sample || typeof sample !== "object") return null;
      const physical = sample.sp == null ? NaN : Number(sample.sp);
      if(isFinite(physical)) return physical !== 0;
      const effective = sample.s == null ? NaN : Number(sample.s);
      return isFinite(effective) ? effective !== 0 : null;
    }

    function replayLegacyAccelMagnitudeG(sample){
      if(!sample || typeof sample !== "object") return NaN;
      const storedMagnitude = sample.flight_accel_raw_g == null
        ? NaN
        : Number(sample.flight_accel_raw_g);
      if(isFinite(storedMagnitude) && storedMagnitude >= 0){
        return storedMagnitude;
      }
      const ax = Number(sample.ax);
      const ay = Number(sample.ay);
      const az = Number(sample.az);
      if(!isFinite(ax) || !isFinite(ay) || !isFinite(az)) return NaN;
      return Math.hypot(ax, ay, az);
    }

    function replayDetectLegacyLaunchEvidence(samples){
      let armAtMs = null;
      let imuThrustAtMs = null;
      let storedPoweredAtMs = null;
      let storedPoweredIsBarometer = false;
      let armRaw = null;
      let armStable = null;
      let armRawChangedAtMs = 0;
      let armInstalledSeen = false;
      let thrustSinceMs = null;
      let previousTsMs = null;

      for(let index = 0; index < samples.length; index++){
        const entry = samples[index];
        const sample = entry && entry.sample;
        if(!sample) continue;
        const tsMs = replayLegacyEntryTimeMs(
          entry,
          previousTsMs == null ? 0 : previousTsMs + 5
        );

        const installed = replayLegacyArmInstalled(sample);
        if(installed != null && armAtMs == null){
          if(armRaw == null){
            armRaw = installed;
            armStable = installed;
            armRawChangedAtMs = tsMs;
            if(installed) armInstalledSeen = true;
          }else{
            if(installed !== armRaw){
              armRaw = installed;
              armRawChangedAtMs = tsMs;
            }
            if(installed !== armStable &&
               (tsMs - armRawChangedAtMs) >= REPLAY_LEGACY_ARM_DEBOUNCE_MS){
              const wasInstalled = armStable;
              armStable = installed;
              if(installed) armInstalledSeen = true;
              if(wasInstalled && !installed && armInstalledSeen){
                // Match the firmware: the debounce confirms the edge, but T+
                // keeps the first raw transition timestamp.
                armAtMs = armRawChangedAtMs;
              }
            }
          }
        }

        const phaseCode = Number(sample.flight_phase_code);
        const phaseName = String(sample.flight_phase || "").toUpperCase();
        if(storedPoweredAtMs == null &&
           (phaseCode === 1 || phaseName === "POWERED_FLIGHT")){
          storedPoweredAtMs = tsMs;
          storedPoweredIsBarometer =
            Number(sample.flight_transition_reason) === 2;
        }

        if(imuThrustAtMs == null){
          const accelG = replayLegacyAccelMagnitudeG(sample);
          const sampleGapMs = previousTsMs == null ? 0 : (tsMs - previousTsMs);
          if(sampleGapMs > REPLAY_LEGACY_THRUST_HOLD_MS){
            thrustSinceMs = null;
          }
          if(isFinite(accelG) && accelG > REPLAY_LEGACY_THRUST_ACCEL_G){
            if(thrustSinceMs == null) thrustSinceMs = tsMs;
            if((tsMs - thrustSinceMs) >= REPLAY_LEGACY_THRUST_HOLD_MS){
              imuThrustAtMs = thrustSinceMs;
            }
          }else{
            thrustSinceMs = null;
          }
        }
        previousTsMs = tsMs;
      }

      // V4/V5 records already carry the detected flight phase. Use that
      // transition as the authoritative validator, while retaining the raw
      // IMU run start as the exact T+ evidence timestamp. If the old record
      // has no usable IMU samples, subtract the same 100 ms hold interval from
      // the first stored POWERED_FLIGHT frame. Barometer-only launch
      // transitions are not treated as thrust evidence.
      let thrustAtMs = imuThrustAtMs;
      let thrustSource = imuThrustAtMs == null ? "NONE" : "IMU_FALLBACK";
      if(storedPoweredAtMs != null && !storedPoweredIsBarometer){
        const phaseEvidenceAtMs = Math.max(
          0,
          storedPoweredAtMs - REPLAY_LEGACY_THRUST_HOLD_MS
        );
        const imuMatchesStoredPhase =
          imuThrustAtMs != null &&
          Math.abs(
            (imuThrustAtMs + REPLAY_LEGACY_THRUST_HOLD_MS) -
            storedPoweredAtMs
          ) <= 500;
        thrustAtMs = imuMatchesStoredPhase ? imuThrustAtMs : phaseEvidenceAtMs;
        thrustSource = imuMatchesStoredPhase
          ? "STORED_POWERED_IMU"
          : "STORED_POWERED_PHASE";
      }
      return {
        armAtMs,
        thrustAtMs,
        thrustSource,
        storedPoweredAtMs
      };
    }

    function replayReconstructLegacyLaunchTimebase(samples, metadata){
      if(!Array.isArray(samples) || !samples.length ||
         (metadata && metadata.compatible)){
        return {
          reconstructed:false,
          mode:"NATIVE",
          launchAtMs:null,
          armAtMs:null,
          thrustAtMs:null,
          rejectAtMs:null
        };
      }

      const evidence = replayDetectLegacyLaunchEvidence(samples);
      const armAtMs = evidence.armAtMs;
      const thrustAtMs = evidence.thrustAtMs;
      let mode = "INSUFFICIENT";
      let launchAtMs = null;
      let rejectAtMs = null;

      if(armAtMs != null && (thrustAtMs == null || armAtMs <= thrustAtMs)){
        mode = "ARM_FIRST";
        launchAtMs = armAtMs;
      }else if(thrustAtMs != null){
        launchAtMs = thrustAtMs;
        if(armAtMs != null &&
           armAtMs <= (thrustAtMs + REPLAY_LEGACY_ARM_CONFIRM_MS)){
          mode = "THRUST_FIRST_CONFIRMED";
        }else{
          mode = "THRUST_REJECTED";
          rejectAtMs = thrustAtMs + REPLAY_LEGACY_ARM_CONFIRM_MS;
        }
      }

      if(launchAtMs == null){
        return {
          reconstructed:false,
          mode,
          launchAtMs,
          armAtMs,
          thrustAtMs,
          rejectAtMs
        };
      }

      samples.forEach((entry)=>{
        if(!entry || !entry.sample) return;
        const sample = entry.sample;
        const tsMs = replayLegacyEntryTimeMs(entry, 0);
        sample.bin_legacy_original_td = Number(sample.td);
        sample.bin_legacy_launch_mode = mode;
        sample.bin_legacy_arm_at_ms = armAtMs;
        sample.bin_legacy_thrust_at_ms = thrustAtMs;
        sample.bin_legacy_thrust_source = evidence.thrustSource;
        sample.bin_legacy_powered_at_ms = evidence.storedPoweredAtMs;
        sample.bin_legacy_timebase_reconstructed = 1;

        if(tsMs < launchAtMs) return;
        if(mode === "THRUST_REJECTED" &&
           rejectAtMs != null && tsMs >= rejectAtMs){
          sample.td = 0;
          sample.st = REPLAY_SEQUENCE_STATE_IDLE;
          sample.uw = 1;
          sample.bin_legacy_launch_validation_fault = 1;
          return;
        }
        sample.td = Math.max(0, Math.round(tsMs - launchAtMs));
        sample.st = REPLAY_SEQUENCE_STATE_TPLUS;
        sample.uw = mode === "THRUST_REJECTED" ? 1 : 0;
        sample.bin_legacy_launch_validation_fault = 0;
      });

      return {
        reconstructed:true,
        mode,
        launchAtMs,
        armAtMs,
        thrustAtMs,
        thrustSource:evidence.thrustSource,
        storedPoweredAtMs:evidence.storedPoweredAtMs,
        rejectAtMs
      };
    }

    function replayAttachBinProtocolMetadata(samples, metadata){
      if(!Array.isArray(samples) || !metadata) return samples;
      const reconstruction = replayReconstructLegacyLaunchTimebase(
        samples,
        metadata
      );
      metadata.legacyReconstruction = reconstruction;
      samples.forEach((entry)=>{
        if(!entry || !entry.sample) return;
        entry.sample.bin_protocol_version = metadata.protocolVersion || 0;
        entry.sample.bin_protocol_legacy = metadata.compatible ? 0 : 1;
        entry.sample.bin_mission_timebase_version =
          metadata.missionTimebaseVersion || 0;
        entry.sample.bin_firmware_build = metadata.firmwareBuildNumber || 0;
      });
      return samples;
    }

    function ensureReplayLegacyProtocolOverlay(){
      let overlay = document.getElementById("replayLegacyProtocolOverlay");
      if(overlay) return overlay;
      overlay = document.createElement("div");
      overlay.id = "replayLegacyProtocolOverlay";
      overlay.className = "mobile-chart-picker-overlay hidden";
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML =
        '<div class="mobile-chart-picker-dialog replay-legacy-protocol-dialog" role="dialog" aria-modal="true" aria-labelledby="replayLegacyProtocolTitle">' +
          '<div class="replay-legacy-protocol-kicker">LEGACY DATA</div>' +
          '<div id="replayLegacyProtocolTitle" class="replay-legacy-protocol-title">이전 데이터 프로토콜</div>' +
          '<p class="replay-legacy-protocol-copy">이 BIN은 현재 기본 프로토콜 범위 밖의 기록입니다. 이전 형식으로 해석하고 ARM·추력 우선 감지 기준으로 T+ 시간축을 재구성합니다.</p>' +
          '<div class="replay-legacy-protocol-meta">' +
            '<span>감지 버전<strong id="replayLegacyProtocolDetected">정보 없음</strong></span>' +
            '<span>현재 허용<strong id="replayLegacyProtocolRange">b8 ~ b8</strong></span>' +
          '</div>' +
          '<p id="replayLegacyProtocolFile" class="replay-legacy-protocol-file"></p>' +
          '<button id="replayLegacyProtocolContinue" class="replay-legacy-protocol-continue" type="button">이전 형식으로 열기</button>' +
        '</div>';
      document.body.appendChild(overlay);
      return overlay;
    }

    function showReplayLegacyProtocolNotice(metadata, fileName){
      const overlay = ensureReplayLegacyProtocolOverlay();
      const detected = overlay.querySelector("#replayLegacyProtocolDetected");
      const range = overlay.querySelector("#replayLegacyProtocolRange");
      const file = overlay.querySelector("#replayLegacyProtocolFile");
      const button = overlay.querySelector("#replayLegacyProtocolContinue");
      if(detected){
        detected.textContent = metadata && metadata.protocolVersion > 0
          ? ("b" + metadata.protocolVersion)
          : "버전 정보 없음";
      }
      if(range){
        range.textContent =
          "b" + REPLAY_PROTOCOL_COMPATIBLE_MIN +
          " ~ b" + REPLAY_PROTOCOL_COMPATIBLE_MAX;
      }
      if(file) file.textContent = String(fileName || "BIN flight data");
      overlay.classList.remove("hidden");
      overlay.style.display = "flex";
      overlay.setAttribute("aria-hidden", "false");
      return new Promise((resolve)=>{
        const close = ()=>{
          overlay.classList.add("hidden");
          overlay.style.display = "none";
          overlay.setAttribute("aria-hidden", "true");
          if(button) button.removeEventListener("click", close);
          resolve();
        };
        if(button){
          button.addEventListener("click", close, {once:true});
          requestAnimationFrame(()=>button.focus());
        }else{
          close();
        }
      });
    }

    function replayReadUtf8Text(dv, offset, len){
      const bytes = [];
      for(let i = 0; i < len; i++){
        const value = dv.getUint8(offset + i);
        if(value === 0) break;
        bytes.push(value);
      }
      if(!bytes.length) return "";
      try{
        return new TextDecoder("utf-8").decode(new Uint8Array(bytes)).replace(/\uFFFD+$/g, "");
      }catch(_e){
        return String.fromCharCode.apply(null, bytes);
      }
    }

    function replayResolveRecordMarkers(hint){
      const out = [];
      const push = (raw)=>{
        const mk = (Number(raw) || 0) & 0xFFFF;
        if(mk !== REPLAY_BIN_RECORD_MARKER && mk !== REPLAY_BIN_RECORD_MARKER_ALT) return;
        if(out.indexOf(mk) >= 0) return;
        out.push(mk);
      };
      push(hint);
      push(REPLAY_BIN_RECORD_MARKER);
      push(REPLAY_BIN_RECORD_MARKER_ALT);
      return out;
    }

    function replayLooksLikeFirmwareBin(dv){
      if(!(dv instanceof DataView)) return false;
      if(dv.byteLength < 8) return false;
      const imageMagic = dv.getUint8(0);
      const segmentCount = dv.getUint8(1);
      const flashMode = dv.getUint8(2);
      if(imageMagic !== 0xE9 && imageMagic !== 0xEA) return false;
      if(segmentCount < 1 || segmentCount > 32) return false;
      if(flashMode > 3) return false;
      return true;
    }

    function replayIsLikelyRawRecordStream(dv, startOffset, endOffset, marker){
      if(!(dv instanceof DataView)) return false;
      const start = Math.max(0, Number(startOffset) || 0);
      const end = Math.min(dv.byteLength, Number(endOffset) || dv.byteLength);
      if((start + REPLAY_BIN_RECORD_HEADER_BYTES) > end) return false;

      const mk = dv.getUint16(start + 0, true);
      const recVersion = dv.getUint8(start + 2);
      const recType = dv.getUint8(start + 3);
      const payloadSize = dv.getUint16(start + 4, true);
      const nextOffset = start + REPLAY_BIN_RECORD_HEADER_BYTES + payloadSize;

      if(mk !== marker) return false;
      if(recVersion > 16) return false;
      if(recType > 64 && recType !== 0xFF) return false;
      if(payloadSize === 0 || payloadSize > 2048) return false;
      if(nextOffset > end) return false;
      return true;
    }

    function replayNormalizePressureMpaForAltitude(rawPressure){
      const p = Number(rawPressure);
      if(!isFinite(p) || p <= 0) return NaN;
      // Preferred: already MPa absolute pressure.
      if(p > 0.03 && p < 0.2) return p;
      // Common alternate units from legacy logs.
      if(p > 50 && p < 200) return (p / 1000);      // kPa -> MPa
      if(p > 50000 && p < 200000) return (p / 1000000); // Pa -> MPa
      if(p > 0.5 && p < 2.0) return (p * 0.1);      // bar -> MPa
      return NaN;
    }

    function replayCrc16Ccitt(dv, offset, len){
      let crc = 0xFFFF;
      for(let i = 0; i < len; i++){
        crc ^= dv.getUint8(offset + i) << 8;
        for(let bit = 0; bit < 8; bit++){
          crc = (crc & 0x8000) ? (((crc << 1) ^ 0x1021) & 0xFFFF) : ((crc << 1) & 0xFFFF);
        }
      }
      return crc & 0xFFFF;
    }

    function replayParseBinRecordRange(dv, startOffset, endOffset, marker){
      const start = Math.max(0, Number(startOffset) || 0);
      const end = Math.min(dv.byteLength, Number(endOffset) || dv.byteLength);
      const samples = [];
      const pendingAlarmEvents = [];
      replayHasStoredMissionAlarms = false;
      let offset = start;
      let prevTs = null;
      let prevRawTs = null;
      let sessionOffsetMs = 0;
      let originPressureMpa = NaN;
      let replayDeploymentState = 0;
      let replayDeploymentFlags = 0;
      const appendSample = (sample, headerTsMs)=>{
        const rawUtMs = Number(sample.ut);
        const rawHeaderTsMs = Number(headerTsMs);
        let rawTsMs = (isFinite(rawUtMs) && rawUtMs >= 0) ? rawUtMs : rawHeaderTsMs;
        if(!isFinite(rawTsMs) || rawTsMs < 0){
          rawTsMs = (prevRawTs == null) ? 0 : (prevRawTs + 10);
        }
        const nominalDtMs = (isFinite(sample.lt) && sample.lt >= 1 && sample.lt <= 1000)
          ? Math.max(1, Math.round(sample.lt))
          : 5;
        let tsMs = rawTsMs + sessionOffsetMs;
        if(prevRawTs != null){
          const rawDelta = rawTsMs - prevRawTs;
          if(rawDelta < -1000){
            sessionOffsetMs = (prevTs == null ? 0 : (prevTs + nominalDtMs)) - rawTsMs;
            tsMs = rawTsMs + sessionOffsetMs;
            originPressureMpa = NaN;
            replayDeploymentState = 0;
            replayDeploymentFlags = 0;
          }else if(rawDelta <= 0 && prevTs != null){
            tsMs = prevTs + nominalDtMs;
          }
        }
        if(prevTs != null && tsMs <= prevTs){
          tsMs = prevTs + nominalDtMs;
        }
        prevRawTs = rawTsMs;

        if(!isFinite(Number(sample.alt_m))){
          const pressureMpa = replayNormalizePressureMpaForAltitude(sample.p);
          if(isFinite(pressureMpa)){
            if(!isFinite(originPressureMpa) || !(originPressureMpa > 0)){
              originPressureMpa = pressureMpa;
              sample.alt_m = 0;
            }else{
              const ratio = pressureMpa / originPressureMpa;
              if(isFinite(ratio) && ratio > 0){
                const h = 44330.0 * (1.0 - Math.pow(ratio, 0.19029495718363465));
                if(isFinite(h)) sample.alt_m = (Math.abs(h) < 0.05) ? 0 : h;
              }
            }
          }
        }

        prevTs = tsMs;
        if(pendingAlarmEvents.length > 0){
          sample.mission_alarm_events = pendingAlarmEvents.splice(0, pendingAlarmEvents.length);
        }
        const sampleDeploymentState = Number(sample.deployment_state);
        const sampleDeploymentFlags = Number(sample.deployment_flags);
        if(isFinite(sampleDeploymentState)) replayDeploymentState = Math.max(replayDeploymentState, sampleDeploymentState);
        if(isFinite(sampleDeploymentFlags)) replayDeploymentFlags |= sampleDeploymentFlags;
        if(missionAlarmSignalsPrimaryDeployment(sample)) replayDeploymentState = Math.max(replayDeploymentState, 2);
        if(missionAlarmSignalsSecondaryDeployment(sample)){
          replayDeploymentState = Math.max(replayDeploymentState, 3);
          replayDeploymentFlags |= (1 << 5);
        }
        sample.deployment_state = replayDeploymentState;
        sample.deployment_flags = replayDeploymentFlags;
        samples.push({tsMs, sample});
      };

      while((offset + REPLAY_BIN_RECORD_HEADER_BYTES) <= end){
        const mk = dv.getUint16(offset + 0, true);
        const recVersion = dv.getUint8(offset + 2);
        const recType = dv.getUint8(offset + 3);
        const payloadSize = dv.getUint16(offset + 4, true);
        const recordFlags = dv.getUint16(offset + 6, true);
        const headerTsMs = dv.getUint32(offset + 8, true);
        const payloadOffset = offset + REPLAY_BIN_RECORD_HEADER_BYTES;
        const nextOffset = payloadOffset + payloadSize;

        if(payloadSize === 0){
          offset += 1;
          continue;
        }
        if(nextOffset > end){
          if(samples.length > 0) break;
          throw new Error("BIN 레코드 경계가 손상되었습니다.");
        }
        if(mk !== marker){
          if(samples.length > 0) break;
          offset += 1;
          continue;
        }
        if(recVersion !== 6 && recVersion !== 5 && recVersion !== 4 && recVersion !== 3 && recVersion !== 2 && recVersion !== 1 && recVersion !== 0){
          if(samples.length > 0){
            offset = nextOffset;
            continue;
          }
          offset += 1;
          continue;
        }
        if((recVersion === 2 || recVersion === 3 || recVersion === 4 || recVersion === 5 || recVersion === 6) &&
            replayCrc16Ccitt(dv, payloadOffset, payloadSize) !== recordFlags){
          offset = nextOffset;
          continue;
        }

        if((recVersion === 3 || recVersion === 4 || recVersion === 5) &&
           recType === 2 &&
           payloadSize >= (recVersion >= 4
             ? (recVersion === 5
               ? REPLAY_BIN_MISSION_ALARM_V5_PAYLOAD_BYTES
               : REPLAY_BIN_MISSION_ALARM_V4_PAYLOAD_BYTES)
             : REPLAY_BIN_MISSION_ALARM_PAYLOAD_BYTES)){
          const base = payloadOffset;
          const utcMarker = recVersion >= 4 ? dv.getUint32(base + 60, true) : 0;
          const epochLow = recVersion >= 4 ? dv.getUint32(base + 52, true) : 0;
          const epochHigh = recVersion >= 4 ? dv.getUint32(base + 56, true) : 0;
          const recordedEpochMs = utcMarker === 0x31435455
            ? (epochHigh * 4294967296 + epochLow)
            : NaN;
          pendingAlarmEvents.push({
            seq:dv.getUint32(base + 0, true),
            block:dv.getUint8(base + 4),
            severity:dv.getUint8(base + 5),
            title:replayReadUtf8Text(dv, base + 6, 14) || "미션 알람",
            message:replayReadUtf8Text(dv, base + 20, 32) || "미션 알람",
            timestampMs:headerTsMs,
            recorded_epoch_ms:isFinite(recordedEpochMs) && recordedEpochMs >= 946684800000
              ? recordedEpochMs
              : null
          });
          replayHasStoredMissionAlarms = true;
        }else if((recVersion === 1 || recVersion === 0) &&
                 (recType === 1 || recType === 0) &&
                 payloadSize >= REPLAY_BIN_SAMPLE_PAYLOAD_BYTES){
          const base = payloadOffset;
          const sample = {
            t: dv.getFloat32(base + 0, true),
            p: dv.getFloat32(base + 4, true),
            ax: dv.getFloat32(base + 8, true),
            ay: dv.getFloat32(base + 12, true),
            az: dv.getFloat32(base + 16, true),
            gx: dv.getFloat32(base + 20, true),
            gy: dv.getFloat32(base + 24, true),
            gz: dv.getFloat32(base + 28, true),
            iv: dv.getFloat32(base + 32, true),
            bp: dv.getUint8(base + 36),
            ut: dv.getUint32(base + 37, true),
            lt: dv.getUint16(base + 41, true),
            ct: dv.getUint16(base + 43, true),
            hz: dv.getUint16(base + 45, true),
            s: dv.getUint8(base + 47),
            ic: dv.getUint8(base + 48),
            r: dv.getUint8(base + 49),
            gs: dv.getUint8(base + 50),
            st: dv.getUint8(base + 51),
            td: dv.getInt32(base + 52, true),
            uw: dv.getUint8(base + 56),
            ab: dv.getUint8(base + 57),
            ar: dv.getUint8(base + 58),
            m: dv.getUint8(base + 59),
            rs: dv.getUint8(base + 60),
            rf: dv.getUint8(base + 61),
            rm: dv.getUint8(base + 62),
            ss: dv.getUint8(base + 63),
            sm: dv.getUint8(base + 64),
            wq: dv.getUint32(base + 65, true),
            we: dv.getUint8(base + 69)
          };

          appendSample(sample, headerTsMs);
        }else if(recVersion === 5 && recType === 1 && payloadSize >= REPLAY_BIN_SAMPLE_V5_PAYLOAD_BYTES){
          const base = payloadOffset;
          const flags = dv.getUint16(base + 34, true);
          const storedFlightPhaseCode = (flags & (1 << 15)) ? ((flags >>> 8) & 0x07) : null;
          const thrustMilliKgf = dv.getInt32(base + 40, true);
          const lcFlags = dv.getUint16(base + 50, true);
          const gpsLatE7 = dv.getInt32(base + 52, true);
          const gpsLonE7 = dv.getInt32(base + 56, true);
          const gpsAltCm = dv.getInt32(base + 60, true);
          const gpsFlags = dv.getUint16(base + 66, true);
          const rawAccelMilliG = dv.getUint16(base + 68, true);
          const coastAccelMilliG = dv.getUint16(base + 70, true);
          const sample = {
            t: thrustMilliKgf === -2147483648 ? 0 : (thrustMilliKgf / 1000),
            p: dv.getFloat32(base + 0, true),
            alt_m: dv.getFloat32(base + 4, true),
            ax: dv.getInt16(base + 8, true) / 1000,
            ay: dv.getInt16(base + 10, true) / 1000,
            az: dv.getInt16(base + 12, true) / 1000,
            gx: dv.getInt16(base + 14, true) / 10,
            gy: dv.getInt16(base + 16, true) / 10,
            gz: dv.getInt16(base + 18, true) / 10,
            gr: dv.getInt16(base + 20, true) / 100,
            gp: dv.getInt16(base + 22, true) / 100,
            gyw: dv.getInt16(base + 24, true) / 100,
            ga: (flags >>> 1) & 1,
            td: dv.getInt32(base + 26, true),
            lt: dv.getUint16(base + 30, true) / 1000,
            ct: dv.getUint16(base + 32, true),
            st: dv.getUint8(base + 36),
            r: dv.getUint8(base + 37),
            ar: dv.getUint8(base + 38),
            m: dv.getUint8(base + 39),
            lc_raw: dv.getInt32(base + 44, true),
            hz: dv.getUint16(base + 48, true),
            hx_hz: dv.getUint16(base + 48, true),
            lc_ready: (lcFlags >>> 0) & 1,
            lc_raw_ok: (lcFlags >>> 1) & 1,
            lc_sat: (lcFlags >>> 2) & 1,
            lc_offset_ok: (lcFlags >>> 3) & 1,
            lc_noise: LOADCELL_NOISE_DB_FALLBACK,
            gps_lat: gpsLatE7 === -2147483648 ? null : (gpsLatE7 / 10000000),
            gps_lon: gpsLonE7 === -2147483648 ? null : (gpsLonE7 / 10000000),
            gps_alt: gpsAltCm === -2147483648 ? null : (gpsAltCm / 100),
            gps_age_ms: dv.getUint16(base + 64, true),
            gps_fix: (gpsFlags >>> 0) & 1,
            gps_seen: (gpsFlags >>> 1) & 1,
            gps_ready: (gpsFlags >>> 2) & 1,
            gps_time_valid: (gpsFlags >>> 3) & 1,
            s: (flags >>> 2) & 1,
            sp: (flags >>> 13) & 1,
            ic: 1,
            uw: (flags >>> 3) & 1,
            ab: (flags >>> 4) & 1,
            sm: (flags >>> 5) & 1,
            ss: (flags >>> 6) & 1,
            bo: flags & 1,
            flight_phase_code:storedFlightPhaseCode,
            flight_phase:storedFlightPhaseCode != null
              ? (FLIGHT_PHASE_CODE_NAMES[storedFlightPhaseCode] || null)
              : null,
            deployment_state:((flags >>> 11) & 0x01) |
              (((flags >>> 12) & 0x01) << 1) |
              (((flags >>> 14) & 0x01) << 2),
            deployment_flags:dv.getUint8(base + 87),
            flight_accel_raw_g:rawAccelMilliG === 0xFFFF ? null : (rawAccelMilliG / 1000),
            flight_accel_filtered_g:coastAccelMilliG === 0xFFFF ? null : (coastAccelMilliG / 1000),
            flight_fast_vertical_speed_mps:dv.getInt16(base + 72, true) / 10,
            flight_display_vertical_speed_mps:dv.getInt16(base + 74, true) / 10,
            vertical_speed_mps:dv.getInt16(base + 74, true) / 10,
            apogee_m:dv.getInt32(base + 76, true) / 100,
            coast_hold_ms:dv.getUint16(base + 80, true),
            descent_hold_ms:dv.getUint16(base + 82, true),
            flight_transition_at_ms:dv.getUint16(base + 84, true) * 10,
            flight_transition_reason:dv.getUint8(base + 86),
            backup_executed:(dv.getUint8(base + 87) & (1 << 2)) ? 1 : 0,
            ut: headerTsMs
          };
          appendSample(sample, headerTsMs);
        }else if((recVersion === 4 || recVersion === 6) &&
                 recType === 1 &&
                 payloadSize >= (recVersion === 6
                   ? REPLAY_BIN_SAMPLE_APP_V6_PAYLOAD_BYTES
                   : REPLAY_BIN_SAMPLE_V4_PAYLOAD_BYTES)){
          const base = payloadOffset;
          const flags = dv.getUint16(base + 34, true);
          const storedFlightPhaseCode = (flags & (1 << 15)) ? ((flags >>> 8) & 0x07) : null;
          const thrustMilliKgf = dv.getInt32(base + 40, true);
          const lcFlags = dv.getUint16(base + 50, true);
          const gpsLatE7 = dv.getInt32(base + 52, true);
          const gpsLonE7 = dv.getInt32(base + 56, true);
          const gpsAltCm = dv.getInt32(base + 60, true);
          const gpsFlags = dv.getUint16(base + 66, true);
          const encodedActualSpeed = recVersion === 6
            ? dv.getUint16(base + 78, true)
            : 0;
          const sample = {
            t: thrustMilliKgf === -2147483648 ? 0 : (thrustMilliKgf / 1000),
            p: dv.getFloat32(base + 0, true),
            alt_m: dv.getFloat32(base + 4, true),
            ax: dv.getInt16(base + 8, true) / 1000,
            ay: dv.getInt16(base + 10, true) / 1000,
            az: dv.getInt16(base + 12, true) / 1000,
            gx: dv.getInt16(base + 14, true) / 10,
            gy: dv.getInt16(base + 16, true) / 10,
            gz: dv.getInt16(base + 18, true) / 10,
            gr: dv.getInt16(base + 20, true) / 100,
            gp: dv.getInt16(base + 22, true) / 100,
            gyw: dv.getInt16(base + 24, true) / 100,
            ga: (flags >>> 1) & 1,
            td: dv.getInt32(base + 26, true),
            lt: dv.getUint16(base + 30, true) / 1000,
            ct: dv.getUint16(base + 32, true),
            st: dv.getUint8(base + 36),
            r: dv.getUint8(base + 37),
            ar: dv.getUint8(base + 38),
            m: dv.getUint8(base + 39),
            lc_raw: dv.getInt32(base + 44, true),
            hz: dv.getUint16(base + 48, true),
            hx_hz: dv.getUint16(base + 48, true),
            lc_ready: (lcFlags >>> 0) & 1,
            lc_raw_ok: (lcFlags >>> 1) & 1,
            lc_sat: (lcFlags >>> 2) & 1,
            lc_offset_ok: (lcFlags >>> 3) & 1,
            lc_noise: LOADCELL_NOISE_DB_FALLBACK,
            gps_lat: gpsLatE7 === -2147483648 ? null : (gpsLatE7 / 10000000),
            gps_lon: gpsLonE7 === -2147483648 ? null : (gpsLonE7 / 10000000),
            gps_alt: gpsAltCm === -2147483648 ? null : (gpsAltCm / 100),
            gps_age_ms: dv.getUint16(base + 64, true),
            gps_fix: (gpsFlags >>> 0) & 1,
            gps_seen: (gpsFlags >>> 1) & 1,
            gps_ready: (gpsFlags >>> 2) & 1,
            gps_time_valid: (gpsFlags >>> 3) & 1,
            speed_mps:(encodedActualSpeed & 0x8000)
              ? ((encodedActualSpeed & 0x7FFF) / 10)
              : null,
            actual_speed_recorded:(encodedActualSpeed & 0x8000) ? 1 : 0,
            actual_speed_source:(encodedActualSpeed & 0x8000) ? "APP_DERIVED" : "",
            s: (flags >>> 2) & 1,
            sp: (flags >>> 13) & 1,
            ic: 1,
            uw: (flags >>> 3) & 1,
            ab: (flags >>> 4) & 1,
            sm: (flags >>> 5) & 1,
            ss: (flags >>> 6) & 1,
            bo: flags & 1,
            flight_phase_code:storedFlightPhaseCode,
            flight_phase:storedFlightPhaseCode != null
              ? (FLIGHT_PHASE_CODE_NAMES[storedFlightPhaseCode] || null)
              : null,
            deployment_state:((flags >>> 11) & 0x01) |
              (((flags >>> 12) & 0x01) << 1) |
              (((flags >>> 14) & 0x01) << 2),
            ut: headerTsMs
          };
          if(recVersion === 6){
            const linkFlags = dv.getUint16(base + 76, true);
            const rssiDeciDbm = dv.getInt16(base + 72, true);
            const rssiAgeMs = dv.getUint16(base + 74, true);
            sample.fl_rx_hz = dv.getUint16(base + 68, true) / 10;
            sample.fl_loss_permille = dv.getUint16(base + 70, true);
            sample.fl_rssi_dbm = rssiDeciDbm === -32768
              ? null
              : (rssiDeciDbm / 10);
            sample.fl_rssi_age_ms = rssiAgeMs === 0xFFFF ? null : rssiAgeMs;
            sample.fl_link = (linkFlags >>> 0) & 1;
            sample.fl_remote_valid = (linkFlags >>> 1) & 1;
            sample.fl_stage1 = (linkFlags >>> 2) & 1;
            sample.fl_stage2 = (linkFlags >>> 3) & 1;
            sample.fl_role_code = (linkFlags >>> 4) & 1;
            sample.flash_link_role = sample.fl_role_code ? "ground" : "avionics";
            sample.fl_rssi_valid = (linkFlags >>> 5) & 1;
            sample.fl_rx_valid = (linkFlags >>> 6) & 1;
            sample.fl_loss_valid = (linkFlags >>> 7) & 1;
            sample.app_link_quality_recorded = 1;
          }
          appendSample(sample, headerTsMs);
        }else if(recVersion === 3 && recType === 1 && payloadSize >= REPLAY_BIN_SAMPLE_V3_PAYLOAD_BYTES){
          const base = payloadOffset;
          const flags = dv.getUint16(base + 34, true);
          const thrustMilliKgf = dv.getInt32(base + 40, true);
          const lcFlags = dv.getUint16(base + 50, true);
          const sample = {
            t: thrustMilliKgf === -2147483648 ? 0 : (thrustMilliKgf / 1000),
            p: dv.getFloat32(base + 0, true),
            alt_m: dv.getFloat32(base + 4, true),
            ax: dv.getInt16(base + 8, true) / 1000,
            ay: dv.getInt16(base + 10, true) / 1000,
            az: dv.getInt16(base + 12, true) / 1000,
            gx: dv.getInt16(base + 14, true) / 10,
            gy: dv.getInt16(base + 16, true) / 10,
            gz: dv.getInt16(base + 18, true) / 10,
            gr: dv.getInt16(base + 20, true) / 100,
            gp: dv.getInt16(base + 22, true) / 100,
            gyw: dv.getInt16(base + 24, true) / 100,
            ga: (flags >>> 1) & 1,
            td: dv.getInt32(base + 26, true),
            lt: dv.getUint16(base + 30, true) / 1000,
            ct: dv.getUint16(base + 32, true),
            st: dv.getUint8(base + 36),
            r: dv.getUint8(base + 37),
            ar: dv.getUint8(base + 38),
            m: dv.getUint8(base + 39),
            lc_raw: dv.getInt32(base + 44, true),
            hz: dv.getUint16(base + 48, true),
            hx_hz: dv.getUint16(base + 48, true),
            lc_ready: (lcFlags >>> 0) & 1,
            lc_raw_ok: (lcFlags >>> 1) & 1,
            lc_sat: (lcFlags >>> 2) & 1,
            lc_offset_ok: (lcFlags >>> 3) & 1,
            lc_noise: LOADCELL_NOISE_DB_FALLBACK,
            s: (flags >>> 2) & 1,
            ic: 1,
            uw: (flags >>> 3) & 1,
            ab: (flags >>> 4) & 1,
            sm: (flags >>> 5) & 1,
            ss: (flags >>> 6) & 1,
            bo: flags & 1,
            ut: headerTsMs
          };
          appendSample(sample, headerTsMs);
        }else if(recVersion === 2 && recType === 1 && payloadSize >= REPLAY_BIN_SAMPLE_V2_PAYLOAD_BYTES){
          const base = payloadOffset;
          const flags = dv.getUint16(base + 34, true);
          const sample = {
            t: 0,
            p: dv.getFloat32(base + 0, true),
            alt_m: dv.getFloat32(base + 4, true),
            ax: dv.getInt16(base + 8, true) / 1000,
            ay: dv.getInt16(base + 10, true) / 1000,
            az: dv.getInt16(base + 12, true) / 1000,
            gx: dv.getInt16(base + 14, true) / 10,
            gy: dv.getInt16(base + 16, true) / 10,
            gz: dv.getInt16(base + 18, true) / 10,
            gr: dv.getInt16(base + 20, true) / 100,
            gp: dv.getInt16(base + 22, true) / 100,
            gyw: dv.getInt16(base + 24, true) / 100,
            ga: (flags >>> 1) & 1,
            td: dv.getInt32(base + 26, true),
            lt: dv.getUint16(base + 30, true) / 1000,
            ct: dv.getUint16(base + 32, true),
            st: dv.getUint8(base + 36),
            r: dv.getUint8(base + 37),
            ar: dv.getUint8(base + 38),
            m: dv.getUint8(base + 39),
            s: (flags >>> 2) & 1,
            ic: 1,
            uw: (flags >>> 3) & 1,
            ab: (flags >>> 4) & 1,
            sm: (flags >>> 5) & 1,
            ss: (flags >>> 6) & 1,
            bo: flags & 1,
            ut: headerTsMs,
            hz: 200
          };
          appendSample(sample, headerTsMs);
        }

        offset = nextOffset;
      }

      if(pendingAlarmEvents.length && samples.length){
        const lastSample = samples[samples.length - 1].sample;
        const previous = Array.isArray(lastSample.mission_alarm_events)
          ? lastSample.mission_alarm_events
          : [];
        lastSample.mission_alarm_events = previous.concat(pendingAlarmEvents);
      }
      if(!samples.length){
        throw new Error("BIN 파일에 리플레이 샘플이 없습니다.");
      }
      return samples;
    }

    function replayBuildSamplesFromBin(arrayBuffer){
      if(!(arrayBuffer instanceof ArrayBuffer)){
        throw new Error("BIN 버퍼가 유효하지 않습니다.");
      }
      if(arrayBuffer.byteLength < REPLAY_BIN_HEADER_MIN_BYTES){
        throw new Error("BIN 헤더 길이가 너무 짧습니다.");
      }

      const dv = new DataView(arrayBuffer);
      const protocolMetadata = replayInspectBinProtocol(arrayBuffer);
      const magic = replayReadMagicText(dv, 0, 8).replace(/\0+$/g, "");
      let headerErr = null;
      if(magic.toUpperCase().indexOf("HWLOGV") === 0){
        try{
          const version = dv.getUint16(8, true);
          const headerSize = dv.getUint16(10, true);
          const dataBytes = dv.getUint32(12, true);
          const declaredMarker = dv.getUint32(28, true) & 0xFFFF;
          const appOriginCode = dv.getUint32(32, true);
          const appSourceTag = dv.getUint32(36, true);
          if(version < 1 || version > 16){
            throw new Error("지원되지 않는 BIN 버전: " + version);
          }
          if(headerSize < REPLAY_BIN_HEADER_MIN_BYTES || headerSize > arrayBuffer.byteLength){
            throw new Error("BIN 헤더 크기가 잘못되었습니다.");
          }

          const dataStart = headerSize;
          const dataEnd = (dataBytes > 0 && (dataStart + dataBytes) <= arrayBuffer.byteLength)
            ? (dataStart + dataBytes)
            : arrayBuffer.byteLength;
          const markers = replayResolveRecordMarkers(declaredMarker);
          let lastErr = null;
          for(const marker of markers){
            try{
              const parsed = replayParseBinRecordRange(dv, dataStart, dataEnd, marker);
              if(appSourceTag === REPLAY_BIN_APP_SOURCE_TAG){
                const origin = appOriginCode === 1 ? "avionics" : "local";
                parsed.forEach((entry)=>{
                  if(!entry || !entry.sample) return;
                  entry.sample.data_origin = origin;
                  entry.sample.data_capture_source = "app";
                  entry.sample.app_recorded = 1;
                });
              }
              return replayAttachBinProtocolMetadata(parsed, protocolMetadata);
            }catch(err){
              lastErr = err;
            }
          }
          if(lastErr) throw lastErr;
          throw new Error("BIN 파일에 리플레이 샘플이 없습니다.");
        }catch(err){
          headerErr = err;
        }
      }

      const markers = replayResolveRecordMarkers(REPLAY_BIN_RECORD_MARKER);
      for(const marker of markers){
        if(replayIsLikelyRawRecordStream(dv, 0, arrayBuffer.byteLength, marker)){
          return replayAttachBinProtocolMetadata(
            replayParseBinRecordRange(dv, 0, arrayBuffer.byteLength, marker),
            protocolMetadata
          );
        }
      }

      const scanLimit = Math.min(arrayBuffer.byteLength - 2, REPLAY_BIN_SCAN_MAX_BYTES);
      for(let i = 0; i <= scanLimit; i++){
        const mk = dv.getUint16(i, true);
        if(mk !== REPLAY_BIN_RECORD_MARKER && mk !== REPLAY_BIN_RECORD_MARKER_ALT) continue;
        if(replayIsLikelyRawRecordStream(dv, i, arrayBuffer.byteLength, mk)){
          return replayAttachBinProtocolMetadata(
            replayParseBinRecordRange(dv, i, arrayBuffer.byteLength, mk),
            protocolMetadata
          );
        }
      }

      if(replayLooksLikeFirmwareBin(dv)){
        throw new Error("펌웨어 BIN입니다. 리플레이용 BIN(로그 덤프)을 선택하세요.");
      }
      if(headerErr){
        const reason = (headerErr && headerErr.message) ? headerErr.message : String(headerErr || "UNKNOWN");
        throw new Error("BIN 헤더 인식 실패: " + reason);
      }
      throw new Error("지원되지 않는 BIN 매직입니다. (기대: HWLOGV1/HWLOGV2 헤더 또는 raw 0xA55A/0x5AA5 레코드)");
    }

    async function parseReplayBin(file){
      if(!file) throw new Error("리플레이 BIN 파일이 선택되지 않았습니다.");
      const arrayBuffer = await file.arrayBuffer();
      const protocolMetadata = replayInspectBinProtocol(arrayBuffer);
      const samples = replayBuildSamplesFromBin(arrayBuffer);
      if(protocolMetadata.candidate && !protocolMetadata.compatible){
        // This is an informational compatibility notice, not a parse gate.
        // Never keep replay activation waiting behind a hidden/covered modal.
        void showReplayLegacyProtocolNotice(protocolMetadata, file.name);
      }
      return samples;
    }

    function getReplayParserCandidates(file){
      const lowerName = String((file && file.name) || "").toLowerCase();
      const fileType = String((file && file.type) || "").toLowerCase();
      const candidates = [];
      const push = (id, label, parser)=>{
        if(candidates.some((item)=>item.id === id)) return;
        candidates.push({id, label, parser});
      };

      const isCsvExt = lowerName.endsWith(".csv");
      const isBinExt = lowerName.endsWith(".bin");
      const isXlsxExt = (
        lowerName.endsWith(".xlsx") ||
        lowerName.endsWith(".xlsm") ||
        lowerName.endsWith(".xls")
      );
      const csvMime = fileType.includes("csv") || fileType.includes("text/plain");
      const binMime = fileType.includes("octet-stream");

      if(isBinExt || binMime){
        push("bin", "BIN", parseReplayBin);
        push("csv", "CSV", parseReplayCsv);
        push("xlsx", "XLSX", parseReplayXlsx);
      }else if(isCsvExt || csvMime){
        push("csv", "CSV", parseReplayCsv);
        push("xlsx", "XLSX", parseReplayXlsx);
        push("bin", "BIN", parseReplayBin);
      }else if(isXlsxExt){
        push("xlsx", "XLSX", parseReplayXlsx);
        push("csv", "CSV", parseReplayCsv);
        push("bin", "BIN", parseReplayBin);
      }else{
        push("xlsx", "XLSX", parseReplayXlsx);
        push("csv", "CSV", parseReplayCsv);
        push("bin", "BIN", parseReplayBin);
      }

      return candidates;
    }

    async function parseReplayFileAuto(file){
      if(!file) throw new Error("리플레이 파일이 선택되지 않았습니다.");
      const candidates = getReplayParserCandidates(file);
      const reasons = [];
      for(const candidate of candidates){
        try{
          const samples = await candidate.parser(file);
          return {
            samples,
            parserLabel: candidate.label
          };
        }catch(err){
          const reason = (err && err.message) ? err.message : String(err || "unknown");
          reasons.push(candidate.label + ": " + reason);
        }
      }
      throw new Error("자동 판별 실패 (" + reasons.join(" | ") + ")");
    }

    function inferReplayDataMode(samples){
      const frames = Array.isArray(samples) ? samples : [];
      let flightScore = 0;
      let daqScore = 0;
      for(const frame of frames){
        const sample = frame && frame.sample;
        if(!sample) continue;
        const storedMode = Number(sample.m);
        if(storedMode === 1) flightScore += 100;
        else if(storedMode === 0) daqScore += 100;

        const phaseCode = Number(sample.flight_phase_code);
        const phaseName = String(sample.flight_phase || "").trim().toUpperCase();
        if((isFinite(phaseCode) && phaseCode >= 0 && phaseCode <= 4) ||
           FLIGHT_PHASE_CODE_NAMES.indexOf(phaseName) >= 0){
          flightScore += 8;
        }
        if(String(sample.data_origin || "").trim().toLowerCase() === "avionics") flightScore += 8;
        if(isFinite(Number(sample.gps_lat)) && isFinite(Number(sample.gps_lon))) flightScore += 2;
        if(isFinite(Number(sample.hx_hz)) && Number(sample.hx_hz) > 0) daqScore += 2;
        if(isFinite(Number(sample.t)) && Math.abs(Number(sample.t)) > 0.01) daqScore += 1;
      }
      if(flightScore === 0 && daqScore === 0) return null;
      return flightScore >= daqScore ? "flight" : "daq";
    }

    function parseReplayRecordingStartMs(fileName){
      const name = String(fileName || "");
      // SPI flash dumps are stamped when downloaded, not when recorded.
      // Only app-session filenames carry a real recording start timestamp.
      if(!/^ALTIS_APP_/i.test(name)) return NaN;
      const isoMatch = name.match(/(\d{4}-\d{2}-\d{2})T(\d{2})[-:](\d{2})[-:](\d{2})(?:[-.](\d{1,3}))?Z/i);
      if(isoMatch){
        const fraction = String(isoMatch[5] || "0").padEnd(3, "0").slice(0, 3);
        const parsed = Date.parse(
          isoMatch[1] + "T" + isoMatch[2] + ":" + isoMatch[3] + ":" + isoMatch[4] + "." + fraction + "Z"
        );
        if(isFinite(parsed)) return parsed;
      }
      const appCompactMatch = name.match(/(?:^|\D)(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\D|$)/i);
      if(appCompactMatch){
        const parsed = Date.UTC(
          Number(appCompactMatch[1]),
          Number(appCompactMatch[2]) - 1,
          Number(appCompactMatch[3]),
          Number(appCompactMatch[4]),
          Number(appCompactMatch[5]),
          Number(appCompactMatch[6])
        );
        if(isFinite(parsed)) return parsed;
      }
      const compactMatch = name.match(/(?:^|\D)(\d{4})(\d{2})(\d{2})[_-]?(\d{2})(\d{2})(\d{2})(?:\D|$)/);
      if(compactMatch){
        const parsed = Date.UTC(
          Number(compactMatch[1]),
          Number(compactMatch[2]) - 1,
          Number(compactMatch[3]),
          Number(compactMatch[4]),
          Number(compactMatch[5]),
          Number(compactMatch[6])
        );
        if(isFinite(parsed)) return parsed;
      }
      return NaN;
    }

    function replayRecordingStartMsFromStoredUtc(samples, firstTs){
      const frames = Array.isArray(samples) ? samples : [];
      if(!isFinite(firstTs)) return NaN;
      for(const frame of frames){
        const events = frame && frame.sample && Array.isArray(frame.sample.mission_alarm_events)
          ? frame.sample.mission_alarm_events
          : [];
        for(const event of events){
          const epochMs = Number(event && event.recorded_epoch_ms);
          const eventTimestampMs = Number(event && event.timestampMs);
          if(
            isFinite(epochMs) && epochMs >= 946684800000 && epochMs < 4102444800000 &&
            isFinite(eventTimestampMs)
          ){
            return epochMs - (eventTimestampMs - firstTs);
          }
        }
      }
      return NaN;
    }

    function buildReplayExportRows(){
      if(!replayState || !Array.isArray(replayState.samples) || !replayState.samples.length) return [];
      const out = [];
      const firstTs = Number(replayState.samples[0].tsMs);
      const hasAbsTime = isFinite(firstTs) && firstTs > 946684800000; // >= 2000-01-01
      const storedUtcStartMs = replayRecordingStartMsFromStoredUtc(replayState.samples, firstTs);
      const fileRecordingStartMs = parseReplayRecordingStartMs(replayState.fileName);
      const baseAbsMs = isFinite(storedUtcStartMs)
        ? storedUtcStartMs
        : (isFinite(fileRecordingStartMs) ? fileRecordingStartMs : NaN);
      const asFiniteOrNull = (value)=>{
        if(value == null) return null;
        const n = Number(value);
        return isFinite(n) ? n : null;
      };
      let originPressureMpa = null;
      let lastChangedAltM = null;
      let lastChangedAltRelMs = null;
      let lastDerivedAltitudeSpeedMps = null;
      for(let i = 0; i < replayState.samples.length; i++){
        const frame = replayState.samples[i];
        if(!frame || !frame.sample) continue;
        const sample = frame.sample;
        const ts = Number(frame.tsMs);
        const relMs = (isFinite(ts) && isFinite(firstTs)) ? Math.max(0, ts - firstTs) : (i * 100);
        const absMs = hasAbsTime && isFinite(ts)
          ? ts
          : (isFinite(baseAbsMs) ? (baseAbsMs + relMs) : NaN);
        const thrust = asFiniteOrNull(sample.t);
        const pressure = asFiniteOrNull(sample.p);
        let altM =
          asFiniteOrNull(sample.alt_m) ??
          asFiniteOrNull(sample.altitude_m) ??
          asFiniteOrNull(sample.altitude) ??
          asFiniteOrNull(sample.alt);
        const gpsAlt =
          asFiniteOrNull(sample.gps_alt) ??
          asFiniteOrNull(sample.gpsAlt) ??
          asFiniteOrNull(sample.gps_altitude) ??
          asFiniteOrNull(sample.nav_alt);
        if(altM == null && pressure != null && pressure > 0.001 && pressure < 0.2){
          if(originPressureMpa == null) originPressureMpa = pressure;
          const ratio = pressure / originPressureMpa;
          if(isFinite(ratio) && ratio > 0){
            const h = 44330.0 * (1.0 - Math.pow(ratio, 0.19029495718363465));
            if(isFinite(h)) altM = h;
          }
        }
        const recordedVerticalSpeedMps = asFiniteOrNull(
          sample.vertical_speed_mps ?? sample.verticalSpeedMps
        );
        const actualSpeedRecorded = Number(sample.actual_speed_recorded) === 1;
        const actualSpeedSource = String(sample.actual_speed_source || "").trim().toUpperCase();
        const speedMps = actualSpeedRecorded
          ? (
              asFiniteOrNull(sample.actual_speed_mps) ??
              asFiniteOrNull(sample.actualSpeedMps) ??
              asFiniteOrNull(sample.speed_mps) ??
              asFiniteOrNull(sample.speedMps) ??
              asFiniteOrNull(sample.speed)
            )
          : null;
        if(altM != null){
          if(lastChangedAltM == null || lastChangedAltRelMs == null){
            lastChangedAltM = altM;
            lastChangedAltRelMs = relMs;
          }else{
            const altitudeDeltaM = altM - lastChangedAltM;
            if(Math.abs(altitudeDeltaM) > 0.0001){
              const dtMs = relMs - lastChangedAltRelMs;
              if(isFinite(dtMs) && dtMs > 0){
                const estimateMps = altitudeDeltaM / (dtMs / 1000.0);
                if(isFinite(estimateMps)) lastDerivedAltitudeSpeedMps = estimateMps;
              }
              lastChangedAltM = altM;
              lastChangedAltRelMs = relMs;
            }
          }
        }
        out.push({
          time: isFinite(absMs) ? new Date(absMs).toISOString() : "",
          origin: normalizeDataOrigin(sample),
          t: thrust,
          p: pressure,
          alt_m: altM,
          speed_mps: speedMps,
          actual_speed_recorded:actualSpeedRecorded ? 1 : 0,
          actual_speed_source:actualSpeedSource,
          vertical_speed_mps: recordedVerticalSpeedMps ?? (
            lastDerivedAltitudeSpeedMps != null && lastChangedAltRelMs != null &&
            (relMs - lastChangedAltRelMs) <= 500
              ? lastDerivedAltitudeSpeedMps
              : null
          ),
          gps_lat: asFiniteOrNull(sample.gps_lat ?? sample.gpsLat ?? sample.gpsLatitude ?? sample.nav_lat ?? sample.lat ?? sample.latitude ?? sample.glat),
          gps_lon: asFiniteOrNull(sample.gps_lon ?? sample.gps_lng ?? sample.gpsLon ?? sample.gpsLng ?? sample.gpsLongitude ?? sample.nav_lon ?? sample.nav_lng ?? sample.lon ?? sample.lng ?? sample.longitude ?? sample.glon),
          gps_alt: gpsAlt,
          gps_age_ms:asFiniteOrNull(sample.gps_age_ms ?? sample.gpsAgeMs),
          gps_fix:asFiniteOrNull(sample.gps_fix ?? sample.gpsFix),
          gps_seen:asFiniteOrNull(sample.gps_seen ?? sample.gpsSeen),
          gps_ready:asFiniteOrNull(sample.gps_ready ?? sample.gpsReady),
          gps_time_valid:asFiniteOrNull(sample.gps_time_valid ?? sample.gpsTimeValid),
          gps_utc_ms:asFiniteOrNull(sample.gps_utc_ms ?? sample.gpsUtcMs),
          ax: asFiniteOrNull(sample.ax),
          ay: asFiniteOrNull(sample.ay),
          az: asFiniteOrNull(sample.az),
          gx: asFiniteOrNull(sample.gx),
          gy: asFiniteOrNull(sample.gy),
          gz: asFiniteOrNull(sample.gz),
          lt: asFiniteOrNull(sample.lt),
          elapsed: relMs,
          hz: asFiniteOrNull(sample.hz),
          ct: asFiniteOrNull(sample.ct),
          s: asFiniteOrNull(sample.s),
          sp: asFiniteOrNull(sample.sp ?? sample.arm_physical),
          al: asFiniteOrNull(sample.al ?? sample.arm_lock),
          ic: asFiniteOrNull(sample.ic),
          r: asFiniteOrNull(sample.r),
          gs: asFiniteOrNull(sample.gs),
          st: asFiniteOrNull(sample.st),
          td: asFiniteOrNull(sample.td) ?? 0,
          m: asFiniteOrNull(sample.m),
          flight_phase: sample.flight_phase || null,
          flight_phase_code: asFiniteOrNull(sample.flight_phase_code),
          flight_accel_raw_g:asFiniteOrNull(sample.flight_accel_raw_g),
          flight_accel_filtered_g:asFiniteOrNull(sample.flight_accel_filtered_g),
          flight_fast_vertical_speed_mps:asFiniteOrNull(sample.flight_fast_vertical_speed_mps),
          flight_display_vertical_speed_mps:asFiniteOrNull(sample.flight_display_vertical_speed_mps),
          apogee_m:asFiniteOrNull(sample.apogee_m),
          coast_hold_ms:asFiniteOrNull(sample.coast_hold_ms),
          descent_hold_ms:asFiniteOrNull(sample.descent_hold_ms),
          flight_transition_at_ms:asFiniteOrNull(sample.flight_transition_at_ms),
          flight_transition_reason:asFiniteOrNull(sample.flight_transition_reason),
          backup_executed:asFiniteOrNull(sample.backup_executed),
          deployment_state: asFiniteOrNull(sample.deployment_state) ?? 0,
          deployment_flags: asFiniteOrNull(sample.deployment_flags) ?? 0,
          mission_alarm_events:Array.isArray(sample.mission_alarm_events)
            ? sample.mission_alarm_events.map(event=>Object.assign({}, event))
            : []
        });
      }
      return out;
    }

    function isotonicAltitudeRegression(values, increasing){
      const source = Array.isArray(values) ? values : [];
      if(!source.length) return [];
      const direction = increasing ? 1 : -1;
      const blocks = [];
      for(let index = 0; index < source.length; index++){
        const value = Number(source[index]) * direction;
        blocks.push({start:index, end:index, sum:value, count:1});
        while(blocks.length > 1){
          const right = blocks[blocks.length - 1];
          const left = blocks[blocks.length - 2];
          if((left.sum / left.count) <= (right.sum / right.count)) break;
          blocks.splice(blocks.length - 2, 2, {
            start:left.start,
            end:right.end,
            sum:left.sum + right.sum,
            count:left.count + right.count
          });
        }
      }
      const result = new Array(source.length);
      blocks.forEach((block)=>{
        const value = (block.sum / block.count) * direction;
        for(let index = block.start; index <= block.end; index++){
          result[index] = value;
        }
      });
      return result;
    }

    function buildPressureRobustAltitudeSeries(
      timeMsValues,
      altitudeMValues,
      halfWindowMs = 450
    ){
      const count = Math.min(
        Array.isArray(timeMsValues) ? timeMsValues.length : 0,
        Array.isArray(altitudeMValues) ? altitudeMValues.length : 0
      );
      const empty = new Array(count).fill(NaN);
      if(count < 3) return empty.map((value, index)=>{
        const altitudeM = Number(altitudeMValues[index]);
        return isFinite(altitudeM) ? altitudeM : value;
      });

      const times = new Float64Array(count);
      const filled = new Float64Array(count);
      let firstFiniteIndex = -1;
      let previousTimeMs = NaN;
      for(let index = 0; index < count; index++){
        const rawTimeMs = Number(timeMsValues[index]);
        const timeMs = isFinite(rawTimeMs)
          ? rawTimeMs
          : (isFinite(previousTimeMs) ? previousTimeMs + 10 : index * 10);
        times[index] = isFinite(previousTimeMs) && timeMs <= previousTimeMs
          ? previousTimeMs + 0.001
          : timeMs;
        previousTimeMs = times[index];
        if(firstFiniteIndex < 0 && isFinite(Number(altitudeMValues[index]))){
          firstFiniteIndex = index;
        }
      }
      if(firstFiniteIndex < 0) return empty;

      const firstAltitudeM = Number(altitudeMValues[firstFiniteIndex]);
      for(let index = 0; index <= firstFiniteIndex; index++) filled[index] = firstAltitudeM;
      let previousFiniteIndex = firstFiniteIndex;
      for(let index = firstFiniteIndex + 1; index < count; index++){
        const altitudeM = Number(altitudeMValues[index]);
        if(!isFinite(altitudeM)) continue;
        const previousAltitudeM = filled[previousFiniteIndex];
        const spanMs = times[index] - times[previousFiniteIndex];
        for(let fillIndex = previousFiniteIndex + 1; fillIndex <= index; fillIndex++){
          const ratio = spanMs > 0
            ? (times[fillIndex] - times[previousFiniteIndex]) / spanMs
            : 1;
          filled[fillIndex] = previousAltitudeM + ((altitudeM - previousAltitudeM) * ratio);
        }
        previousFiniteIndex = index;
      }
      for(let index = previousFiniteIndex + 1; index < count; index++){
        filled[index] = filled[previousFiniteIndex];
      }

      // A separation/ejection pressure wave can last hundreds of milliseconds,
      // so a small sample-count Hampel filter is insufficient. Use a centered
      // time-domain median to establish the local flight envelope, then replace
      // only physically impossible innovations. The symmetric edge window
      // prevents launch/end samples from being pulled inward.
      const requestedHalfWindowMs = Math.max(120, Number(halfWindowMs) || 450);
      const robust = new Array(count);
      for(let index = 0; index < count; index++){
        const symmetricHalfWindowMs = Math.min(
          requestedHalfWindowMs,
          Math.max(0, times[index] - times[0]),
          Math.max(0, times[count - 1] - times[index])
        );
        if(symmetricHalfWindowMs < 20){
          robust[index] = filled[index];
          continue;
        }
        const fromMs = times[index] - symmetricHalfWindowMs;
        const toMs = times[index] + symmetricHalfWindowMs;
        let left = index;
        let right = index;
        while(left > 0 && times[left - 1] >= fromMs) left--;
        while(right + 1 < count && times[right + 1] <= toMs) right++;
        const local = [];
        for(let sampleIndex = left; sampleIndex <= right; sampleIndex++){
          local.push(filled[sampleIndex]);
        }
        local.sort((a, b)=>a - b);
        const medianM = local[Math.floor(local.length * 0.5)];
        robust[index] = Math.abs(filled[index] - medianM) > 1.5
          ? medianM
          : filled[index];
      }

      let apogeeIndex = 0;
      for(let index = 1; index < count; index++){
        if(robust[index] > robust[apogeeIndex]) apogeeIndex = index;
      }
      const ascent = isotonicAltitudeRegression(
        robust.slice(0, apogeeIndex + 1),
        true
      );
      const descent = isotonicAltitudeRegression(
        robust.slice(apogeeIndex),
        false
      );
      const corrected = ascent.concat(descent.slice(1));
      return corrected.map((value, index)=>
        isFinite(Number(altitudeMValues[index])) ? value : NaN
      );
    }

    function applyPressureRobustAltitudeToReplayFrames(frames){
      const source = Array.isArray(frames) ? frames : [];
      if(source.length < 3) return source;
      const timeMsValues = source.map((frame, index)=>{
        const timeMs = Number(frame && frame.tsMs);
        return isFinite(timeMs) ? timeMs : index * 10;
      });
      const altitudeMValues = source.map((frame)=>{
        const sample = frame && frame.sample;
        const altitudeM = Number(sample && sample.alt_m);
        return isFinite(altitudeM) ? altitudeM : NaN;
      });
      const finiteAltitudes = altitudeMValues.filter((value)=>isFinite(value));
      if(finiteAltitudes.length < 3) return source;
      const corrected = buildPressureRobustAltitudeSeries(
        timeMsValues,
        altitudeMValues
      );
      source.forEach((frame, index)=>{
        if(!frame || !frame.sample) return;
        const altitudeM = Number(corrected[index]);
        frame.sample.altitude_corrected_m = isFinite(altitudeM)
          ? altitudeM
          : null;
      });
      return source;
    }

    function deriveAltitudeSpeedSeries(timeMsValues, altitudeMValues, windowMs = 700){
      const count = Math.min(
        Array.isArray(timeMsValues) ? timeMsValues.length : 0,
        Array.isArray(altitudeMValues) ? altitudeMValues.length : 0
      );
      const result = new Array(count).fill(NaN);
      if(count < 2) return result;

      const points = [];
      let timeOriginMs = null;
      for(let i = 0; i < count; i++){
        const timeMs = Number(timeMsValues[i]);
        const altitudeM = Number(altitudeMValues[i]);
        if(!isFinite(timeMs) || !isFinite(altitudeM)) continue;
        if(timeOriginMs == null) timeOriginMs = timeMs;
        points.push({timeMs:timeMs - timeOriginMs, altitudeM});
      }
      if(points.length < 2 || timeOriginMs == null) return result;

      // A single pressure conversion glitch must not become a large velocity
      // impulse. A five-sample Hampel pass removes isolated altitude outliers
      // while preserving the real launch and apogee slopes.
      const originalAltitude = points.map((point)=>point.altitudeM);
      for(let i = 0; i < points.length; i++){
        const from = Math.max(0, i - 2);
        const to = Math.min(points.length - 1, i + 2);
        const local = [];
        for(let j = from; j <= to; j++) local.push(originalAltitude[j]);
        local.sort((a, b)=>a - b);
        const median = local[Math.floor(local.length * 0.5)];
        const deviations = local.map((value)=>Math.abs(value - median)).sort((a, b)=>a - b);
        const medianDeviation = deviations[Math.floor(deviations.length * 0.5)];
        const rejectionThresholdM = Math.max(0.65, medianDeviation * 4.5);
        if(Math.abs(originalAltitude[i] - median) > rejectionThresholdM){
          points[i].altitudeM = median;
        }
      }

      const prefixTime = new Float64Array(points.length + 1);
      const prefixAltitude = new Float64Array(points.length + 1);
      const prefixTimeSquared = new Float64Array(points.length + 1);
      const prefixTimeAltitude = new Float64Array(points.length + 1);
      for(let i = 0; i < points.length; i++){
        const point = points[i];
        prefixTime[i + 1] = prefixTime[i] + point.timeMs;
        prefixAltitude[i + 1] = prefixAltitude[i] + point.altitudeM;
        prefixTimeSquared[i + 1] = prefixTimeSquared[i] + (point.timeMs * point.timeMs);
        prefixTimeAltitude[i + 1] = prefixTimeAltitude[i] + (point.timeMs * point.altitudeM);
      }

      const halfWindowMs = Math.max(150, Number(windowMs) * 0.5);
      let left = 0;
      let right = 0;
      for(let i = 0; i < count; i++){
        const rawTargetMs = Number(timeMsValues[i]);
        if(!isFinite(rawTargetMs)) continue;
        const targetMs = rawTargetMs - timeOriginMs;
        while(left < points.length && points[left].timeMs < (targetMs - halfWindowMs)) left++;
        if(right < left) right = left;
        while(right < points.length && points[right].timeMs <= (targetMs + halfWindowMs)) right++;

        const samples = right - left;
        if(samples < 3) continue;
        const durationMs = points[right - 1].timeMs - points[left].timeMs;
        if(!(durationMs >= 80)) continue;
        const sumTime = prefixTime[right] - prefixTime[left];
        const sumAltitude = prefixAltitude[right] - prefixAltitude[left];
        const sumTimeSquared = prefixTimeSquared[right] - prefixTimeSquared[left];
        const sumTimeAltitude = prefixTimeAltitude[right] - prefixTimeAltitude[left];
        const denominator = (samples * sumTimeSquared) - (sumTime * sumTime);
        if(!(Math.abs(denominator) > 1e-9)) continue;
        const slopeMPerMs = ((samples * sumTimeAltitude) - (sumTime * sumAltitude)) / denominator;
        const speedMps = slopeMPerMs * 1000;
        if(isFinite(speedMps)) result[i] = speedMps;
      }

      const smoothingTimeMs = Math.max(240, Number(windowMs) * 0.5);
      const forward = new Float64Array(count);
      const backward = new Float64Array(count);
      forward.fill(NaN);
      backward.fill(NaN);
      let previousValue = NaN;
      let previousTimeMs = NaN;
      for(let i = 0; i < count; i++){
        const value = Number(result[i]);
        const timeMs = Number(timeMsValues[i]);
        if(!isFinite(value) || !isFinite(timeMs)) continue;
        if(!isFinite(previousValue)){
          previousValue = value;
        }else{
          const dtMs = Math.max(1, timeMs - previousTimeMs);
          const alpha = 1 - Math.exp(-dtMs / smoothingTimeMs);
          previousValue += (value - previousValue) * alpha;
        }
        forward[i] = previousValue;
        previousTimeMs = timeMs;
      }
      previousValue = NaN;
      previousTimeMs = NaN;
      for(let i = count - 1; i >= 0; i--){
        const value = Number(result[i]);
        const timeMs = Number(timeMsValues[i]);
        if(!isFinite(value) || !isFinite(timeMs)) continue;
        if(!isFinite(previousValue)){
          previousValue = value;
        }else{
          const dtMs = Math.max(1, previousTimeMs - timeMs);
          const alpha = 1 - Math.exp(-dtMs / smoothingTimeMs);
          previousValue += (value - previousValue) * alpha;
        }
        backward[i] = previousValue;
        previousTimeMs = timeMs;
      }
      for(let i = 0; i < count; i++){
        const a = forward[i];
        const b = backward[i];
        if(isFinite(a) && isFinite(b)) result[i] = (a + b) * 0.5;
        else if(isFinite(a)) result[i] = a;
        else if(isFinite(b)) result[i] = b;
      }
      return result;
    }
