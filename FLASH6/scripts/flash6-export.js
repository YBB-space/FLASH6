/* FLASH6 pure export builders. Loaded before flash6.js. */
(function(global){
  "use strict";
  function escapeXmlText(text){
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
  function toColumnName(index){
    let n = index + 1;
    let name = "";
    while(n > 0){
      const rem = (n - 1) % 26;
      name = String.fromCharCode(65 + rem) + name;
      n = Math.floor((n - 1) / 26);
    }
    return name;
  }
  function buildSheetXml(rows, drawingRelId, hiddenFromRow){
    let out = '<?xml version="1.0" encoding="UTF-8"?>';
    out += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    if(drawingRelId){
      out += ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    }
    out += ">";
    out += '<cols><col min="1" max="1" width="38" customWidth="1"/></cols>';
    out += "<sheetData>";
    for(let r = 0; r < rows.length; r++){
      const rowEntry = rows[r];
      const row = (rowEntry && !Array.isArray(rowEntry) && rowEntry.cells) ? rowEntry.cells : rowEntry;
      const rowStyle = (rowEntry && !Array.isArray(rowEntry) && rowEntry.style != null) ? rowEntry.style : null;
      const rowNum = r + 1;
      let rowXml = "";
      const styleId = (rowStyle != null) ? (' s="' + rowStyle + '"') : ((r === 0) ? ' s="1"' : "");
      for(let c = 0; c < row.length; c++){
        const value = row[c];
        if(value === null || value === undefined || value === "") continue;
        const cellRef = toColumnName(c) + rowNum;
        if(typeof value === "number" && isFinite(value)){
          rowXml += '<c r="' + cellRef + '" t="n"' + styleId + '><v>' + value + "</v></c>";
        }else{
          const text = String(value);
          const needsPreserve = /^\s|\s$/.test(text);
          rowXml += '<c r="' + cellRef + '" t="inlineStr"' + styleId + '><is><t' + (needsPreserve ? ' xml:space="preserve"' : "") + ">";
          rowXml += escapeXmlText(text);
          rowXml += "</t></is></c>";
        }
      }
      const hiddenAttr = (hiddenFromRow && rowNum >= hiddenFromRow) ? ' hidden="1"' : "";
      out += '<row r="' + rowNum + '"' + hiddenAttr + '>' + rowXml + "</row>";
    }
    out += "</sheetData>";
    if(drawingRelId){
      out += '<drawing r:id="' + drawingRelId + '"/>';
    }
    out += "</worksheet>";
    return out;
  }
  function buildWorkbookXml(sheets){
    let out = '<?xml version="1.0" encoding="UTF-8"?>';
    out += '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ';
    out += 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
    out += "<sheets>";
    for(let i = 0; i < sheets.length; i++){
      const name = escapeXmlText(sheets[i].name || "");
      const hiddenAttr = sheets[i].hidden ? ' state="hidden"' : "";
      out += '<sheet name="' + name + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"' + hiddenAttr + '/>';
    }
    out += "</sheets></workbook>";
    return out;
  }
  function buildWorkbookRelsXml(sheetCount){
    let out = '<?xml version="1.0" encoding="UTF-8"?>';
    out += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    for(let i = 0; i < sheetCount; i++){
      out += '<Relationship Id="rId' + (i + 1) + '" ';
      out += 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ';
      out += 'Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    }
    out += '<Relationship Id="rId' + (sheetCount + 1) + '" ';
    out += 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" ';
    out += 'Target="styles.xml"/>';
    out += "</Relationships>";
    return out;
  }
  function buildContentTypesXml(sheetCount, chartCount, hasDrawingImages){
    let out = '<?xml version="1.0" encoding="UTF-8"?>';
    out += '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">';
    out += '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>';
    out += '<Default Extension="xml" ContentType="application/xml"/>';
    if(hasDrawingImages){
      out += '<Default Extension="png" ContentType="image/png"/>';
    }
    out += '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
    for(let i = 0; i < sheetCount; i++){
      out += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ';
      out += 'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }
    if(chartCount > 0 || hasDrawingImages){
      out += '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>';
    }
    if(chartCount > 0){
      for(let i = 1; i <= chartCount; i++){
        out += '<Override PartName="/xl/charts/chart' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>';
      }
    }
    out += '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    out += "</Types>";
    return out;
  }
  function buildStylesXml(){
    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="4">' +
        '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>' +
        '<font><b/><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/><family val="2"/></font>' +
        '<font><b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
        '<font><sz val="12"/><color rgb="FF111827"/><name val="Calibri"/><family val="2"/></font>' +
      '</fonts>' +
      '<fills count="3">' +
        '<fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="4">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
        '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
        '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '</cellXfs>' +
      "</styleSheet>";
  }
  function buildSheetRelsXml(){
    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>' +
      "</Relationships>";
  }
  function buildDrawingXml(chartCount, drawingImages, drawingColumns, trajectoryFirst, cardStyle){
    const EMU_PER_INCH = 914400;
    const count = Math.max(0, Math.min(6, Number(chartCount) || 0));
    const images = Array.isArray(drawingImages) ? drawingImages : [];
    const hasTrajectoryImage = images.some((entry)=>entry && entry.role === "trajectory");
    const columns = Math.max(1, Math.min(2, Number(drawingColumns) || 1));
    const compactGrid = columns > 1;
    const flightCard = cardStyle === "flightCard";
    const chartWidth = Math.round((flightCard ? 8 : (compactGrid ? 5.6 : 6)) * EMU_PER_INCH);
    const chartHeight = Math.round((flightCard ? 5.15 : (compactGrid ? 3.65 : 4.5)) * EMU_PER_INCH);
    const startColumn = 7;
    const columnStep = flightCard ? 12 : (compactGrid ? 9 : 10);
    const rowStep = flightCard ? 26 : (compactGrid ? 18 : 22);
    const chartStartRow = (hasTrajectoryImage && trajectoryFirst) ? 28 : 2;
    const order = count === 3 ? [1, 3, 2] : Array.from({length:count}, (_, index)=>index + 1);
    let out = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ' +
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
    order.forEach((chartNumber, index)=>{
      const gridColumn = index % columns;
      const gridRow = Math.floor(index / columns);
      out += '<xdr:oneCellAnchor>' +
        '<xdr:from><xdr:col>' + (startColumn + gridColumn * columnStep) + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + (chartStartRow + gridRow * rowStep) + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
        '<xdr:ext cx="' + chartWidth + '" cy="' + chartHeight + '"/>' +
        '<xdr:graphicFrame macro="">' +
        '<xdr:nvGraphicFramePr><xdr:cNvPr id="' + (index + 2) + '" name="Chart ' + chartNumber + '"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>' +
        '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="' + chartWidth + '" cy="' + chartHeight + '"/></xdr:xfrm>' +
        '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
        '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId' + chartNumber + '"/>' +
        '</a:graphicData></a:graphic>' +
        '</xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>';
    });
    if(images.length){
      const imageWidth = Math.round(8 * EMU_PER_INCH);
      const imageHeight = Math.round(5.15 * EMU_PER_INCH);
      const regularImages = images.filter((entry)=>!(entry && entry.role === "trajectory" && trajectoryFirst));
      const chartRowsUsed = Math.ceil(count / columns) * rowStep;
      let regularStartRow = count > 0
        ? chartStartRow + chartRowsUsed
        : 2;
      if(hasTrajectoryImage && trajectoryFirst && count === 0) regularStartRow = 2 + rowStep;
      images.forEach((entry, imageIndex)=>{
        const isLeadingTrajectory = !!(entry && entry.role === "trajectory" && trajectoryFirst);
        const regularIndex = isLeadingTrajectory ? -1 : regularImages.indexOf(entry);
        const imageColumn = isLeadingTrajectory ? 0 : (regularIndex % columns);
        const imageGridRow = isLeadingTrajectory ? 0 : Math.floor(regularIndex / columns);
        const imageRow = isLeadingTrajectory ? 2 : (regularStartRow + imageGridRow * rowStep);
        const imageRelId = count + imageIndex + 1;
        const imageName = escapeXmlText((entry && entry.name) || ("Report Chart " + (imageIndex + 1)));
        out += '<xdr:oneCellAnchor>' +
          '<xdr:from><xdr:col>' + (startColumn + imageColumn * columnStep) + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + imageRow + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
          '<xdr:ext cx="' + imageWidth + '" cy="' + imageHeight + '"/>' +
          '<xdr:pic>' +
            '<xdr:nvPicPr><xdr:cNvPr id="' + (count + imageIndex + 2) + '" name="' + imageName + '"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
            '<xdr:blipFill><a:blip r:embed="rId' + imageRelId + '"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
            '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + imageWidth + '" cy="' + imageHeight + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln><a:solidFill><a:srgbClr val="CBD5E1"/></a:solidFill></a:ln></xdr:spPr>' +
          '</xdr:pic><xdr:clientData/></xdr:oneCellAnchor>';
      });
    }
    return out + '</xdr:wsDr>';
  }
  function buildDrawingRelsXml(chartCount, drawingImages){
    let out = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    for(let index=1; index<=chartCount; index++){
      out += '<Relationship Id="rId' + index + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart' + index + '.xml"/>';
    }
    const images = Array.isArray(drawingImages) ? drawingImages : [];
    images.forEach((entry, index)=>{
      out += '<Relationship Id="rId' + (chartCount + index + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/' + escapeXmlText(entry.filename) + '"/>';
    });
    return out + "</Relationships>";
  }
  function buildChartVisualTheme(cardStyle, chartSubtitle){
    const flightCard = cardStyle === "flightCard";
    const subtitleText = escapeXmlText(chartSubtitle || "");
    const titleColor = flightCard ? "14213D" : "202020";
    const subtitleColor = "60748F";
    const axisColor = flightCard ? "53657C" : "404040";
    const gridColor = flightCard ? "D7E1EC" : "D0D0D0";
    const titleSize = flightCard ? 1900 : 1400;
    const axisTitleSize = flightCard ? 1000 : 1100;
    const titleLayoutXml = flightCard
      ? '<c:layout><c:manualLayout><c:layoutTarget val="outer"/>' +
        '<c:xMode val="factor"/><c:yMode val="factor"/><c:wMode val="factor"/><c:hMode val="factor"/>' +
        '<c:x val="0.035"/><c:y val="0.028"/><c:w val="0.83"/><c:h val="0.14"/>' +
        '</c:manualLayout></c:layout>'
      : "";
    const axisTitleXml = (text)=>{
      if(!text) return "";
      return '<c:title>' +
        '<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r>' +
        '<a:rPr lang="en-US" sz="' + axisTitleSize + '"><a:solidFill><a:srgbClr val="' + axisColor + '"/></a:solidFill><a:latin typeface="Arial"/></a:rPr>' +
        '<a:t>' + text + '</a:t>' +
        '</a:r><a:endParaRPr lang="en-US"/></a:p></c:rich></c:tx>' +
        '<c:overlay val="0"/>' +
        '</c:title>';
    };
    const chartTitleXml = (text)=>{
      if(!text) return "";
      const subtitleXml = flightCard && subtitleText
        ? '<a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="1050">' +
          '<a:solidFill><a:srgbClr val="' + subtitleColor + '"/></a:solidFill><a:latin typeface="Arial"/>' +
          '</a:rPr><a:t>' + subtitleText + '</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>'
        : "";
      return '<c:title>' +
        '<c:tx><c:rich><a:bodyPr anchor="t"/><a:lstStyle/>' +
        '<a:p><a:pPr algn="l"/><a:r>' +
        '<a:rPr lang="en-US" b="1" sz="' + titleSize + '"><a:solidFill><a:srgbClr val="' + titleColor + '"/></a:solidFill><a:latin typeface="Arial"/></a:rPr>' +
        '<a:t>' + text + '</a:t>' +
        '</a:r><a:endParaRPr lang="en-US"/></a:p>' + subtitleXml +
        '</c:rich></c:tx>' + titleLayoutXml +
        '<c:overlay val="0"/>' +
        '</c:title>';
    };
    const plotAreaLayout = flightCard
      ? '<c:layout><c:manualLayout><c:layoutTarget val="outer"/>' +
        '<c:xMode val="edge"/><c:yMode val="edge"/>' +
        '<c:x val="0.075"/><c:y val="0.205"/><c:w val="0.89"/><c:h val="0.66"/>' +
        '</c:manualLayout></c:layout>'
      : '<c:layout><c:manualLayout>' +
        '<c:layoutTarget val="outer"/>' +
        '<c:xMode val="edge"/><c:yMode val="edge"/>' +
        '<c:x val="0.06"/><c:y val="0.20"/><c:w val="0.88"/><c:h val="0.70"/>' +
        '</c:manualLayout></c:layout>';
    const majorGridlinesXml = '<c:majorGridlines><c:spPr><a:ln w="' + (flightCard ? "9525" : "12700") + '">' +
      '<a:solidFill><a:srgbClr val="' + gridColor + '"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>';
    const axisShapeXml = flightCard
      ? '<c:spPr><a:noFill/><a:ln w="9525"><a:solidFill><a:srgbClr val="94A3B8"/></a:solidFill></a:ln></c:spPr>'
      : "";
    const axisTextXml = flightCard
      ? '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr lang="en-US" sz="900">' +
        '<a:solidFill><a:srgbClr val="53657C"/></a:solidFill><a:latin typeface="Arial"/>' +
        '</a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>'
      : "";
    const plotAreaShapeXml = flightCard
      ? '<c:spPr><a:solidFill><a:srgbClr val="F8FBFE"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>'
      : "";
    const chartSpaceShapeXml = flightCard
      ? '<c:spPr><a:solidFill><a:srgbClr val="EEF5FC"/></a:solidFill>' +
        '<a:ln w="12700"><a:solidFill><a:srgbClr val="CBD5E1"/></a:solidFill></a:ln></c:spPr>'
      : "";
    const legendXml = flightCard
      ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/>' +
        '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr lang="en-US" b="1" sz="900">' +
        '<a:solidFill><a:srgbClr val="334155"/></a:solidFill><a:latin typeface="Arial"/>' +
        '</a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr></c:legend>'
      : "";
    return {
      flightCard,
      axisTitleXml,
      chartTitleXml,
      plotAreaLayout,
      majorGridlinesXml,
      axisShapeXml,
      axisTextXml,
      plotAreaShapeXml,
      chartSpaceShapeXml,
      legendXml,
      lineWidth:flightCard ? 28575 : 19000,
      areaAlpha:flightCard ? 22000 : 32000
    };
  }
  function buildChartXml(sheetName, startRow, endRow, chartTitle, seriesCol, seriesNameCell, axisYTitle, lineColor, majorUnit, xMajorUnit, xNumFmt, axisXTitle, xMin, xMax, yMin, yMax, xTickSkip, xLabelCol, hideXGridlines, cardStyle, chartSubtitle){
    const xCol = xLabelCol || "A";
    const xRange = sheetName + "!$" + xCol + "$" + startRow + ":$" + xCol + "$" + endRow;
    const seriesRange = sheetName + "!$" + seriesCol + "$" + startRow + ":$" + seriesCol + "$" + endRow;
    const titleText = escapeXmlText(chartTitle || "");
    const yTitleText = escapeXmlText(axisYTitle || "");
    const xTitleText = escapeXmlText(axisXTitle || "time");
    const lineHex = escapeXmlText(lineColor || "3B82F6");
    const unitVal = (majorUnit && isFinite(majorUnit) && majorUnit > 0) ? Number(majorUnit.toFixed(6)) : null;
    const xUnitVal = (xMajorUnit && isFinite(xMajorUnit) && xMajorUnit > 0) ? Number(xMajorUnit.toFixed(6)) : null;
    const xMinVal = (xMin != null && isFinite(xMin)) ? Number(xMin.toFixed(6)) : null;
    const xMaxVal = (xMax != null && isFinite(xMax)) ? Number(xMax.toFixed(6)) : null;
    const yMinVal = (yMin != null && isFinite(yMin)) ? Number(yMin.toFixed(6)) : null;
    const yMaxVal = (yMax != null && isFinite(yMax)) ? Number(yMax.toFixed(6)) : null;
    const xFmt = escapeXmlText(xNumFmt || "0.0");
    const theme = buildChartVisualTheme(cardStyle, chartSubtitle);
    const xGridlineXml = hideXGridlines ? "" : theme.majorGridlinesXml;
    const axisBase = 120000 + (seriesCol.charCodeAt(0) - 64) * 10;
    const xAxisId = axisBase + 1;
    const yAxisId = axisBase + 2;
    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
      (theme.flightCard ? '<c:lang val="en-US"/><c:roundedCorners val="0"/>' : '') +
      '<c:chart>' +
      theme.chartTitleXml(titleText) +
      '<c:autoTitleDeleted val="0"/>' +
      '<c:plotArea>' +
      theme.plotAreaLayout +
      '<c:areaChart>' +
      '<c:grouping val="standard"/>' +
      '<c:ser>' +
      '<c:idx val="0"/><c:order val="0"/>' +
      '<c:tx><c:strRef><c:f>' + seriesNameCell + '</c:f></c:strRef></c:tx>' +
      '<c:spPr>' +
      '<a:gradFill rotWithShape="1">' +
      '<a:gsLst>' +
      '<a:gs pos="0"><a:srgbClr val="' + lineHex + '"><a:alpha val="' + theme.areaAlpha + '"/></a:srgbClr></a:gs>' +
      '<a:gs pos="100000"><a:srgbClr val="' + lineHex + '"><a:alpha val="0"/></a:srgbClr></a:gs>' +
      '</a:gsLst>' +
      '<a:lin ang="5400000" scaled="1"/>' +
      '</a:gradFill>' +
      '<a:ln><a:noFill/></a:ln>' +
      '</c:spPr>' +
      '<c:cat><c:numRef><c:f>' + xRange + '</c:f></c:numRef></c:cat>' +
      '<c:val><c:numRef><c:f>' + seriesRange + '</c:f></c:numRef></c:val>' +
      '</c:ser>' +
      '<c:dLbls><c:delete val="1"/></c:dLbls>' +
      '<c:axId val="' + xAxisId + '"/><c:axId val="' + yAxisId + '"/>' +
      '</c:areaChart>' +
      '<c:lineChart>' +
      '<c:grouping val="standard"/>' +
      '<c:ser>' +
      '<c:idx val="1"/><c:order val="1"/>' +
      '<c:tx><c:strRef><c:f>' + seriesNameCell + '</c:f></c:strRef></c:tx>' +
      '<c:spPr><a:ln w="' + theme.lineWidth + '" cap="rnd"><a:solidFill><a:srgbClr val="' + lineHex + '"/></a:solidFill><a:round/></a:ln></c:spPr>' +
      '<c:marker><c:symbol val="none"/></c:marker>' +
      '<c:cat><c:numRef><c:f>' + xRange + '</c:f></c:numRef></c:cat>' +
      '<c:val><c:numRef><c:f>' + seriesRange + '</c:f></c:numRef></c:val>' +
      '</c:ser>' +
      '<c:dLbls><c:delete val="1"/></c:dLbls>' +
      '<c:axId val="' + xAxisId + '"/><c:axId val="' + yAxisId + '"/>' +
      '</c:lineChart>' +
      '<c:catAx>' +
      '<c:axId val="' + xAxisId + '"/>' +
      '<c:scaling><c:orientation val="minMax"/></c:scaling>' +
      '<c:delete val="0"/>' +
      '<c:axPos val="b"/>' +
      xGridlineXml +
      theme.axisTitleXml(xTitleText) +
      '<c:numFmt formatCode="' + xFmt + '" sourceLinked="0"/>' +
      '<c:majorTickMark val="out"/>' +
      '<c:minorTickMark val="none"/>' +
      '<c:tickLblPos val="nextTo"/>' +
      theme.axisShapeXml + theme.axisTextXml +
      '<c:crossAx val="' + yAxisId + '"/>' +
      '<c:crosses val="autoZero"/>' +
      (xTickSkip && xTickSkip > 1 ? ('<c:tickLblSkip val="' + xTickSkip + '"/><c:tickMarkSkip val="' + xTickSkip + '"/>') : '') +
      '</c:catAx>' +
      '<c:valAx>' +
      '<c:axId val="' + yAxisId + '"/>' +
      '<c:scaling><c:orientation val="minMax"/>' +
      (yMinVal != null ? ('<c:min val="' + yMinVal + '"/>') : '') +
      (yMaxVal != null ? ('<c:max val="' + yMaxVal + '"/>') : '') +
      '</c:scaling>' +
      '<c:delete val="0"/>' +
      '<c:axPos val="l"/>' +
      theme.majorGridlinesXml +
      theme.axisTitleXml(yTitleText) +
      '<c:numFmt formatCode="General" sourceLinked="1"/>' +
      '<c:majorTickMark val="out"/>' +
      '<c:minorTickMark val="none"/>' +
      '<c:tickLblPos val="nextTo"/>' +
      theme.axisShapeXml + theme.axisTextXml +
      '<c:crossAx val="' + xAxisId + '"/>' +
      '<c:crosses val="autoZero"/>' +
      (unitVal ? ('<c:majorUnit val="' + unitVal + '"/>') : '') +
      '</c:valAx>' + theme.plotAreaShapeXml +
      '</c:plotArea>' +
      '<c:plotVisOnly val="1"/>' +
      '<c:dispBlanksAs val="gap"/>' +
      '</c:chart>' + theme.chartSpaceShapeXml +
      '</c:chartSpace>';
  }
  function buildChartXmlMultiSeries(sheetName, startRow, endRow, chartTitle, seriesDefs, axisYTitle, majorUnit, xMajorUnit, xNumFmt, axisXTitle, xMin, xMax, yMin, yMax, xTickSkip, xLabelCol, hideXGridlines, cardStyle, chartSubtitle){
    const xCol = xLabelCol || "A";
    const xRange = sheetName + "!$" + xCol + "$" + startRow + ":$" + xCol + "$" + endRow;
    const titleText = escapeXmlText(chartTitle || "");
    const yTitleText = escapeXmlText(axisYTitle || "");
    const xTitleText = escapeXmlText(axisXTitle || "time");
    const unitVal = (majorUnit && isFinite(majorUnit) && majorUnit > 0) ? Number(majorUnit.toFixed(6)) : null;
    const yMinVal = (yMin != null && isFinite(yMin)) ? Number(yMin.toFixed(6)) : null;
    const yMaxVal = (yMax != null && isFinite(yMax)) ? Number(yMax.toFixed(6)) : null;
    const xFmt = escapeXmlText(xNumFmt || "0.0");
    const theme = buildChartVisualTheme(cardStyle, chartSubtitle);
    const xGridlineXml = hideXGridlines ? "" : theme.majorGridlinesXml;
    const list = Array.isArray(seriesDefs) ? seriesDefs.filter((s)=>s && s.col && s.nameCell) : [];
    const firstCol = list.length ? list[0].col : "B";
    const axisBase = 130000 + (firstCol.charCodeAt(0) - 64) * 10;
    const xAxisId = axisBase + 1;
    const yAxisId = axisBase + 2;
    let seriesXml = "";
    for(let i = 0; i < list.length; i++){
      const def = list[i];
      const lineHex = escapeXmlText(def.color || "3B82F6");
      const seriesRange = sheetName + "!$" + def.col + "$" + startRow + ":$" + def.col + "$" + endRow;
      seriesXml +=
        '<c:ser>' +
        '<c:idx val="' + i + '"/><c:order val="' + i + '"/>' +
        '<c:tx><c:strRef><c:f>' + def.nameCell + '</c:f></c:strRef></c:tx>' +
        '<c:spPr><a:ln w="' + theme.lineWidth + '" cap="rnd"><a:solidFill><a:srgbClr val="' + lineHex + '"/></a:solidFill><a:round/></a:ln></c:spPr>' +
        '<c:marker><c:symbol val="none"/></c:marker>' +
        '<c:cat><c:numRef><c:f>' + xRange + '</c:f></c:numRef></c:cat>' +
        '<c:val><c:numRef><c:f>' + seriesRange + '</c:f></c:numRef></c:val>' +
        '</c:ser>';
    }
    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
      (theme.flightCard ? '<c:lang val="en-US"/><c:roundedCorners val="0"/>' : '') +
      '<c:chart>' +
      theme.chartTitleXml(titleText) +
      '<c:autoTitleDeleted val="0"/>' +
      '<c:plotArea>' +
      theme.plotAreaLayout +
      '<c:lineChart>' +
      '<c:grouping val="standard"/>' +
      '<c:varyColors val="0"/>' +
      seriesXml +
      '<c:dLbls><c:delete val="1"/></c:dLbls>' +
      '<c:axId val="' + xAxisId + '"/><c:axId val="' + yAxisId + '"/>' +
      '</c:lineChart>' +
      '<c:catAx>' +
      '<c:axId val="' + xAxisId + '"/>' +
      '<c:scaling><c:orientation val="minMax"/></c:scaling>' +
      '<c:delete val="0"/>' +
      '<c:axPos val="b"/>' +
      xGridlineXml +
      theme.axisTitleXml(xTitleText) +
      '<c:numFmt formatCode="' + xFmt + '" sourceLinked="0"/>' +
      '<c:majorTickMark val="out"/>' +
      '<c:minorTickMark val="none"/>' +
      '<c:tickLblPos val="nextTo"/>' +
      theme.axisShapeXml + theme.axisTextXml +
      '<c:crossAx val="' + yAxisId + '"/>' +
      '<c:crosses val="autoZero"/>' +
      (xTickSkip && xTickSkip > 1 ? ('<c:tickLblSkip val="' + xTickSkip + '"/><c:tickMarkSkip val="' + xTickSkip + '"/>') : '') +
      '</c:catAx>' +
      '<c:valAx>' +
      '<c:axId val="' + yAxisId + '"/>' +
      '<c:scaling><c:orientation val="minMax"/>' +
      (yMinVal != null ? ('<c:min val="' + yMinVal + '"/>') : '') +
      (yMaxVal != null ? ('<c:max val="' + yMaxVal + '"/>') : '') +
      '</c:scaling>' +
      '<c:delete val="0"/>' +
      '<c:axPos val="l"/>' +
      theme.majorGridlinesXml +
      theme.axisTitleXml(yTitleText) +
      '<c:numFmt formatCode="General" sourceLinked="1"/>' +
      '<c:majorTickMark val="out"/>' +
      '<c:minorTickMark val="none"/>' +
      '<c:tickLblPos val="nextTo"/>' +
      theme.axisShapeXml + theme.axisTextXml +
      '<c:crossAx val="' + xAxisId + '"/>' +
      '<c:crosses val="autoZero"/>' +
      (unitVal ? ('<c:majorUnit val="' + unitVal + '"/>') : '') +
      '</c:valAx>' + theme.plotAreaShapeXml +
      '</c:plotArea>' +
      theme.legendXml +
      '<c:plotVisOnly val="1"/>' +
      '<c:dispBlanksAs val="gap"/>' +
      '</c:chart>' + theme.chartSpaceShapeXml +
      '</c:chartSpace>';
  }
  const CRC32_TABLE = (()=>{
    const table = new Uint32Array(256);
    for(let i = 0; i < 256; i++){
      let c = i;
      for(let k = 0; k < 8; k++){
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    return table;
  })();
  function crc32(buf){
    let crc = 0 ^ -1;
    for(let i = 0; i < buf.length; i++){
      crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }
  function buildZip(files){
    const encoder = new TextEncoder();
    const fileEntries = [];
    let localSize = 0;

    for(const file of files){
      const nameBytes = encoder.encode(file.name);
      let dataBytes = null;
      if(file.dataBytes){
        dataBytes = file.dataBytes;
      }else if(file.data instanceof Uint8Array){
        dataBytes = file.data;
      }else if(file.data && file.data.buffer instanceof ArrayBuffer){
        dataBytes = new Uint8Array(file.data);
      }else{
        dataBytes = encoder.encode(file.data);
      }
      const crc = crc32(dataBytes);
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(localHeader.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, dataBytes.length, true);
      view.setUint32(22, dataBytes.length, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      fileEntries.push({
        nameBytes,
        dataBytes,
        crc,
        localHeader,
        offset: localSize
      });

      localSize += localHeader.length + dataBytes.length;
    }

    let centralSize = 0;
    const centralParts = [];
    for(const entry of fileEntries){
      const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
      const view = new DataView(centralHeader.buffer);
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint16(14, 0, true);
      view.setUint32(16, entry.crc, true);
      view.setUint32(20, entry.dataBytes.length, true);
      view.setUint32(24, entry.dataBytes.length, true);
      view.setUint16(28, entry.nameBytes.length, true);
      view.setUint16(30, 0, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, entry.offset, true);
      centralHeader.set(entry.nameBytes, 46);
      centralParts.push(centralHeader);
      centralSize += centralHeader.length;
    }

    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, fileEntries.length, true);
    endView.setUint16(10, fileEntries.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, localSize, true);
    endView.setUint16(20, 0, true);

    const totalSize = localSize + centralSize + end.length;
    const out = new Uint8Array(totalSize);
    let offset = 0;
    for(const entry of fileEntries){
      out.set(entry.localHeader, offset);
      offset += entry.localHeader.length;
      out.set(entry.dataBytes, offset);
      offset += entry.dataBytes.length;
    }
    for(const central of centralParts){
      out.set(central, offset);
      offset += central.length;
    }
    out.set(end, offset);
    return out;
  }
  function buildXlsxBytes(sheets, chart){
    const chartImages = chart && Array.isArray(chart.chartImages)
      ? chart.chartImages.filter((entry)=>entry && entry.pngBytes instanceof Uint8Array && entry.pngBytes.length > 0)
      : [];
    const renderChartsAsImages = !!(chart && chart.renderChartsAsImages);
    const chartCount = chart && !renderChartsAsImages
      ? (chart.chart6 ? 6 : (chart.chart5 ? 5 : (chart.chart4 ? 4 : 3)))
      : 0;
    const trajectoryImage = chart && chart.trajectoryImage instanceof Uint8Array
      ? chart.trajectoryImage
      : null;
    const hasTrajectoryImage = !!(trajectoryImage && trajectoryImage.length > 0);
    const drawingImages = [];
    if(hasTrajectoryImage){
      drawingImages.push({
        role:"trajectory",
        name:"3D Flight Trajectory",
        filename:"flight_trajectory_3d.png",
        pngBytes:trajectoryImage
      });
    }
    chartImages.forEach((entry, index)=>{
      drawingImages.push({
        role:"chart",
        name:String(entry.name || ("Flight Chart " + (index + 1))),
        filename:"flight_chart_" + (index + 1) + ".png",
        pngBytes:entry.pngBytes
      });
    });
    const hasDrawingImages = drawingImages.length > 0;
    const hasDrawing = chartCount > 0 || hasDrawingImages;
    const drawingSheetName = chart && chart.drawingSheetName
      ? chart.drawingSheetName
      : (chart && chart.sheetName);
    const chartSheetIndex = hasDrawing
      ? Math.max(0, sheets.findIndex((sheet)=>sheet && sheet.name === drawingSheetName))
      : -1;
    const files = [];
    files.push({name:"[Content_Types].xml", data:buildContentTypesXml(sheets.length, chartCount, hasDrawingImages)});
    files.push({name:"_rels/.rels", data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'});
    files.push({name:"xl/workbook.xml", data:buildWorkbookXml(sheets)});
    files.push({name:"xl/_rels/workbook.xml.rels", data:buildWorkbookRelsXml(sheets.length)});
    files.push({name:"xl/styles.xml", data:buildStylesXml()});
    for(let i = 0; i < sheets.length; i++){
      const drawingRelId = (hasDrawing && i === chartSheetIndex) ? "rId1" : null;
      const hiddenStart = (hasDrawing && i === chartSheetIndex && chart && chart.hideDataFromRow) ? chart.hideDataFromRow : null;
      files.push({name:"xl/worksheets/sheet" + (i + 1) + ".xml", data:buildSheetXml(sheets[i].rows, drawingRelId, hiddenStart)});
    }
    if(hasDrawing){
      files.push({name:"xl/worksheets/_rels/sheet" + (chartSheetIndex + 1) + ".xml.rels", data:buildSheetRelsXml()});
      files.push({
        name:"xl/drawings/drawing1.xml",
        data:buildDrawingXml(chartCount, drawingImages, chart.drawingColumns, chart.trajectoryFirst, chart.cardStyle)
      });
      files.push({name:"xl/drawings/_rels/drawing1.xml.rels", data:buildDrawingRelsXml(chartCount, drawingImages)});
      drawingImages.forEach((entry)=>{
        files.push({name:"xl/media/" + entry.filename, dataBytes:entry.pngBytes});
      });
    }
    if(chartCount > 0){
      const chart1 = (chart && chart.chart1) ? chart.chart1 : {
        title: chart.titleThrust,
        axisYTitle: chart.axisTitleThrust,
        majorUnit: chart.majorUnitThrust,
        yMin: chart.yMinThrust,
        yMax: chart.yMaxThrust,
        series: [{col:"B", nameCell: chart.seriesNameThrust, color:"EF4444"}]
      };
      const chart2 = (chart && chart.chart2) ? chart.chart2 : {
        title: chart.titlePressure,
        axisYTitle: chart.axisTitlePressure,
        majorUnit: chart.majorUnitPressure,
        yMin: chart.yMinPressure,
        yMax: chart.yMaxPressure,
        series: [{col:"D", nameCell: chart.seriesNamePressure, color:"3B82F6"}]
      };
      const chart3 = (chart && chart.chart3) ? chart.chart3 : {
        title: chart.titleThrustN,
        axisYTitle: chart.axisTitleThrustN,
        majorUnit: chart.majorUnitThrustN,
        yMin: chart.yMinThrustN,
        yMax: chart.yMaxThrustN,
        series: [{col:"C", nameCell: chart.seriesNameThrustN, color:"F59E0B"}]
      };
      const chart4 = chart && chart.chart4 ? chart.chart4 : null;
      const chart5 = chart && chart.chart5 ? chart.chart5 : null;
      const chart6 = chart && chart.chart6 ? chart.chart6 : null;
      const buildChartFile = (conf)=>{
        const hideXGridlines = !!((conf && conf.hideXGridlines) || (chart && chart.hideXGridlines));
        const cardStyle = (conf && conf.cardStyle) || (chart && chart.cardStyle) || "";
        const subtitle = (conf && conf.subtitle) || "";
        if(conf && Array.isArray(conf.series) && conf.series.length > 1){
          return buildChartXmlMultiSeries(
            chart.sheetName, chart.startRow, chart.endRow, conf.title, conf.series, conf.axisYTitle,
            conf.majorUnit, chart.xMajorUnit, chart.xNumFmt, chart.axisTitleX,
            chart.xMin, chart.xMax, conf.yMin, conf.yMax, chart.xTickSkip, chart.xLabelCol, hideXGridlines,
            cardStyle, subtitle
          );
        }
        const one = (conf && Array.isArray(conf.series) && conf.series.length) ? conf.series[0] : null;
        const col = one && one.col ? one.col : "B";
        const nameCell = one && one.nameCell ? one.nameCell : (chart.sheetName + "!$" + col + "$1");
        const color = one && one.color ? one.color : "3B82F6";
        return buildChartXml(
          chart.sheetName, chart.startRow, chart.endRow, conf ? conf.title : "", col, nameCell, conf ? conf.axisYTitle : "", color,
          conf ? conf.majorUnit : null, chart.xMajorUnit, chart.xNumFmt, chart.axisTitleX, chart.xMin, chart.xMax,
          conf ? conf.yMin : null, conf ? conf.yMax : null, chart.xTickSkip, chart.xLabelCol, hideXGridlines,
          cardStyle, subtitle
        );
      };
      files.push({name:"xl/charts/chart1.xml", data:buildChartFile(chart1)});
      files.push({name:"xl/charts/chart2.xml", data:buildChartFile(chart2)});
      files.push({name:"xl/charts/chart3.xml", data:buildChartFile(chart3)});
      if(chart4) files.push({name:"xl/charts/chart4.xml", data:buildChartFile(chart4)});
      if(chart5) files.push({name:"xl/charts/chart5.xml", data:buildChartFile(chart5)});
      if(chart6) files.push({name:"xl/charts/chart6.xml", data:buildChartFile(chart6)});
    }
    return buildZip(files);
  }

  function docxRun(text, options){
    const opts = options || {};
    const value = text == null ? "" : String(text);
    const needsPreserve = /^\s|\s$|\s{2}/.test(value);
    let properties = "";
    if(opts.bold) properties += "<w:b/>";
    if(opts.italic) properties += "<w:i/>";
    if(opts.color) properties += '<w:color w:val="' + escapeXmlText(opts.color) + '"/>';
    if(opts.size) properties += '<w:sz w:val="' + Math.round(Number(opts.size) * 2) + '"/><w:szCs w:val="' + Math.round(Number(opts.size) * 2) + '"/>';
    if(opts.font || opts.eastAsiaFont){
      const font = escapeXmlText(opts.font || "Arial");
      const eastAsiaFont = escapeXmlText(opts.eastAsiaFont || opts.font || "Apple SD Gothic Neo");
      properties += '<w:rFonts w:ascii="' + font + '" w:hAnsi="' + font + '" w:eastAsia="' + eastAsiaFont + '"/>';
    }
    return '<w:r>' + (properties ? ('<w:rPr>' + properties + '</w:rPr>') : '') +
      '<w:t' + (needsPreserve ? ' xml:space="preserve"' : '') + '>' + escapeXmlText(value) + '</w:t></w:r>';
  }
  function docxParagraph(text, options){
    const opts = options || {};
    let properties = "";
    if(opts.style) properties += '<w:pStyle w:val="' + escapeXmlText(opts.style) + '"/>';
    if(opts.align) properties += '<w:jc w:val="' + escapeXmlText(opts.align) + '"/>';
    if(opts.keepNext) properties += '<w:keepNext/>';
    if(opts.keepLines) properties += '<w:keepLines/>';
    if(opts.pageBreakBefore) properties += '<w:pageBreakBefore/>';
    if(opts.spacingBefore != null || opts.spacingAfter != null || opts.line != null){
      properties += '<w:spacing' +
        (opts.spacingBefore != null ? (' w:before="' + Math.max(0, Math.round(opts.spacingBefore)) + '"') : '') +
        (opts.spacingAfter != null ? (' w:after="' + Math.max(0, Math.round(opts.spacingAfter)) + '"') : '') +
        (opts.line != null ? (' w:line="' + Math.max(1, Math.round(opts.line)) + '" w:lineRule="auto"') : '') + '/>';
    }
    if(opts.indentLeft != null) properties += '<w:ind w:left="' + Math.max(0, Math.round(opts.indentLeft)) + '"/>';
    const runXml = opts.rawRunXml != null
      ? String(opts.rawRunXml)
      : docxRun(text, opts);
    return '<w:p>' + (properties ? ('<w:pPr>' + properties + '</w:pPr>') : '') + runXml + '</w:p>';
  }
  function docxCell(contentXml, width, options){
    const opts = options || {};
    const borderColor = escapeXmlText(opts.borderColor || "1F2937");
    const borderSize = opts.borderSize == null ? 10 : Math.max(0, Math.round(opts.borderSize));
    let cellProperties = '<w:tcW w:w="' + Math.max(1, Math.round(width)) + '" w:type="dxa"/>';
    if(opts.fill) cellProperties += '<w:shd w:val="clear" w:color="auto" w:fill="' + escapeXmlText(opts.fill) + '"/>';
    if(opts.vAlign) cellProperties += '<w:vAlign w:val="' + escapeXmlText(opts.vAlign) + '"/>';
    cellProperties += '<w:tcMar><w:top w:w="90" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar>';
    cellProperties += '<w:tcBorders>' +
      '<w:top w:val="' + (opts.topBorder ? "single" : "nil") + '" w:sz="' + borderSize + '" w:space="0" w:color="' + borderColor + '"/>' +
      '<w:left w:val="nil"/>' +
      '<w:bottom w:val="single" w:sz="' + borderSize + '" w:space="0" w:color="' + borderColor + '"/>' +
      '<w:right w:val="nil"/>' +
      '</w:tcBorders>';
    return '<w:tc><w:tcPr>' + cellProperties + '</w:tcPr>' + (contentXml || docxParagraph("")) + '</w:tc>';
  }
  function docxTable(rows, widths, options){
    const opts = options || {};
    const safeRows = Array.isArray(rows) ? rows : [];
    const safeWidths = Array.isArray(widths) && widths.length ? widths : [9360];
    const totalWidth = safeWidths.reduce((sum, value)=>sum + Number(value || 0), 0);
    let xml = '<w:tbl><w:tblPr><w:tblW w:w="' + Math.max(1, Math.round(totalWidth)) + '" w:type="dxa"/>' +
      '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
      '<w:tblGrid>' + safeWidths.map((width)=>'<w:gridCol w:w="' + Math.max(1, Math.round(width)) + '"/>').join("") + '</w:tblGrid>';
    safeRows.forEach((row, rowIndex)=>{
      const isHeader = rowIndex === 0 && opts.header !== false;
      xml += '<w:tr><w:trPr>' + (isHeader ? '<w:tblHeader/>' : '') + '<w:cantSplit/></w:trPr>';
      safeWidths.forEach((width, columnIndex)=>{
        const value = Array.isArray(row) && row[columnIndex] != null ? row[columnIndex] : "";
        const paragraph = docxParagraph(value, {
          align:(opts.alignments && opts.alignments[columnIndex]) || "center",
          bold:isHeader,
          size:isHeader ? 9 : 9,
          font:"Arial",
          eastAsiaFont:"Apple SD Gothic Neo",
          spacingAfter:0,
          line:220
        });
        xml += docxCell(paragraph, width, {
          fill:isHeader ? (opts.headerFill || "F1F1F1") : null,
          topBorder:isHeader,
          borderColor:opts.borderColor || "222222",
          borderSize:isHeader ? 12 : 8,
          vAlign:"center"
        });
      });
      xml += '</w:tr>';
    });
    return xml + '</w:tbl>';
  }
  function docxDrawing(relId, imageId, name, widthInches, heightInches){
    const cx = Math.round(Math.max(0.1, Number(widthInches) || 1) * 914400);
    const cy = Math.round(Math.max(0.1, Number(heightInches) || 1) * 914400);
    const safeName = escapeXmlText(name || ("Report chart " + imageId));
    return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
      '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/>' +
      '<wp:docPr id="' + imageId + '" name="' + safeName + '"/>' +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic><pic:nvPicPr><pic:cNvPr id="' + imageId + '" name="' + safeName + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + escapeXmlText(relId) + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>' +
      '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  }
  function docxImagePairTable(images){
    const source = Array.isArray(images) ? images.slice(0, 2) : [];
    const widths = [5120, 5120];
    let xml = '<w:tbl><w:tblPr><w:tblW w:w="10240" w:type="dxa"/><w:tblLayout w:type="fixed"/>' +
      '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="40" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
      '<w:tblGrid><w:gridCol w:w="5120"/><w:gridCol w:w="5120"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>';
    widths.forEach((width, index)=>{
      const image = source[index];
      const content = image
        ? docxParagraph("", {align:"center", spacingAfter:0, rawRunXml:docxDrawing(image.relId, image.imageId, image.name, 3.42, 2.20)})
        : docxParagraph("차트", {align:"center", size:10, color:"94A3B8", spacingAfter:0});
      xml += docxCell(content, width, {topBorder:true, borderColor:"9CA3AF", borderSize:6, vAlign:"center"});
    });
    return xml + '</w:tr></w:tbl>';
  }
  function buildDocxStylesXml(){
    const eastAsiaFont = "Apple SD Gothic Neo";
    const reportFonts = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="' + eastAsiaFont + '"/>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr>' + reportFonts +
      '<w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US" w:eastAsia="ko-KR"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="ReportTitle"><w:name w:val="Report Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="100"/></w:pPr><w:rPr>' + reportFonts + '<w:b/><w:color w:val="111827"/><w:sz w:val="34"/><w:szCs w:val="34"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="ReportSubtitle"><w:name w:val="Report Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr><w:rPr>' + reportFonts + '<w:color w:val="374151"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="SectionHeading"><w:name w:val="Section Heading"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:keepNext/><w:spacing w:before="180" w:after="80"/></w:pPr><w:rPr>' + reportFonts + '<w:b/><w:color w:val="111827"/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:jc w:val="center"/><w:spacing w:before="45" w:after="100"/></w:pPr><w:rPr>' + reportFonts + '<w:color w:val="374151"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>' +
      '</w:styles>';
  }
  function buildDocxDocumentXml(report, imageEntries){
    const data = report || {};
    const overviewRows = Array.isArray(data.overviewRows) && data.overviewRows.length
      ? data.overviewRows
      : [["항목", "결과"], ["최고고도", ""], ["최고속도", ""], ["최대가속도", ""], ["총 비행시간", ""], ["데이터 기록", ""], ["이벤트 기록", ""]];
    const eventRows = Array.isArray(data.eventRows) && data.eventRows.length
      ? data.eventRows
      : [["Sequence (T+)", "이벤트", "비고"], ["", "", ""], ["", "", ""], ["", "", ""], ["", "", ""]];
    const stageRows = Array.isArray(data.stageRows) && data.stageRows.length
      ? data.stageRows
      : [["항목", "결과"], ["고도", ""], ["상승속도", ""]];
    const ejectionRows = Array.isArray(data.ejectionRows) && data.ejectionRows.length
      ? data.ejectionRows
      : [["항목", "결과"], ["고도", ""], ["상승속도", ""]];
    let body = "";
    body += docxParagraph(data.title || "ALTIS MODEL ROCKET FLIGHT REPORT", {style:"ReportTitle"});
    body += docxParagraph(data.subtitle || "모델 로켓 비행 데이터 보고서", {style:"ReportSubtitle"});
    body += docxParagraph("Date:  " + (data.dateText || ""), {align:"center", size:9, spacingAfter:15});
    body += docxParagraph("Data Source:  " + (data.sourceText || "Avionics Flash Memory Flight Record"), {align:"center", size:9, spacingAfter:140});
    body += docxParagraph("1. 비행 개요", {style:"SectionHeading"});
    body += docxTable(overviewRows, [5120, 5120], {alignments:["center", "center"]});
    body += docxParagraph("Table 1. 비행 결과", {style:"Caption"});
    body += docxParagraph("2. 비행 데이터", {style:"SectionHeading"});
    body += docxImagePairTable(imageEntries);
    body += docxParagraph("Figure 1. 고도 및 가속도 데이터", {style:"Caption"});
    body += docxParagraph("3. 비행 이벤트", {style:"SectionHeading"});
    body += docxTable(eventRows, [2400, 3100, 4740], {alignments:["center", "center", "center"]});
    body += docxParagraph("Table 2. 비행 이벤트", {style:"Caption"});
    body += docxParagraph("4. 단분리", {style:"SectionHeading", pageBreakBefore:true});
    body += docxTable(stageRows, [5120, 5120], {alignments:["center", "center"]});
    body += docxParagraph("Table 3. 단분리 시점 상태", {style:"Caption"});
    body += docxParagraph("5. 낙하산 사출", {style:"SectionHeading"});
    body += docxTable(ejectionRows, [5120, 5120], {alignments:["center", "center"]});
    body += docxParagraph("Table 4. 사출 시점 상태", {style:"Caption"});
    body += '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/>' +
      '<w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
      'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<w:body>' + body + '</w:body></w:document>';
  }
  function buildDocxBytes(report){
    const data = report || {};
    const chartImages = Array.isArray(data.chartImages)
      ? data.chartImages.filter((entry)=>entry && entry.pngBytes instanceof Uint8Array && entry.pngBytes.length > 0).slice(0, 2)
      : [];
    const imageEntries = chartImages.map((entry, index)=>({
      relId:"rId" + (index + 1),
      imageId:index + 1,
      name:String(entry.name || ("Flight chart " + (index + 1))),
      filename:"report_chart_" + (index + 1) + ".png",
      pngBytes:entry.pngBytes
    }));
    const createdDate = data.createdDate instanceof Date ? data.createdDate : new Date(data.createdDate || Date.now());
    const createdIso = isFinite(createdDate.getTime()) ? createdDate.toISOString() : new Date().toISOString();
    const documentRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      imageEntries.map((entry)=>'<Relationship Id="' + entry.relId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + entry.filename + '"/>').join("") +
      '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
      '</Relationships>';
    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      (imageEntries.length ? '<Default Extension="png" ContentType="image/png"/>' : '') +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>';
    const files = [
      {name:"[Content_Types].xml", data:contentTypes},
      {name:"_rels/.rels", data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'},
      {name:"word/document.xml", data:buildDocxDocumentXml(data, imageEntries)},
      {name:"word/_rels/document.xml.rels", data:documentRels},
      {name:"word/styles.xml", data:buildDocxStylesXml()},
      {name:"word/settings.xml", data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>'},
      {name:"docProps/core.xml", data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + escapeXmlText(data.title || "ALTIS Flight Report") + '</dc:title><dc:creator>ALTIS FLASH</dc:creator><cp:lastModifiedBy>ALTIS FLASH</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">' + createdIso + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + createdIso + '</dcterms:modified></cp:coreProperties>'},
      {name:"docProps/app.xml", data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>ALTIS FLASH</Application><AppVersion>1.0</AppVersion></Properties>'}
    ];
    imageEntries.forEach((entry)=>files.push({name:"word/media/" + entry.filename, dataBytes:entry.pngBytes}));
    return buildZip(files);
  }

  global.FLASH6_EXPORT = Object.freeze({
    buildZip,
    buildXlsxBytes,
    buildDocxBytes
  });
})(typeof window !== "undefined" ? window : globalThis);
