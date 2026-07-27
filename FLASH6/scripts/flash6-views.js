/* FLASH6 view rendering and shared UI helpers. */
    // =====================
    // UI 헬퍼
    // =====================
    function startTetris(){
      if(!ENABLE_EASTER_TETRIS){
        showToast("Light mode: easter/tetris disabled", "notice", {key:"lite-tetris-disabled"});
        return;
      }
    }

    function stopTetris(){ /* no-op in light mode */ }
    function showTetrisWin(){ /* no-op in light mode */ }
    function hideTetrisWin(){ /* no-op in light mode */ }
    function showTetrisPrize(){ /* no-op in light mode */ }
    function hideTetrisPrize(){ /* no-op in light mode */ }
    function copyTetrisPrizeCode(){ /* no-op in light mode */ }

    function formatStatusMapCoord(v){
      return Number(v).toFixed(5);
    }
    function isStatusMapInKorea(lat, lon){
      return lat >= STATUS_MAP_KR_BOUNDS.south &&
             lat <= STATUS_MAP_KR_BOUNDS.north &&
             lon >= STATUS_MAP_KR_BOUNDS.west &&
             lon <= STATUS_MAP_KR_BOUNDS.east;
    }
    function clampStatusMapToKorea(lat, lon){
      return {
        lat: Math.max(STATUS_MAP_KR_BOUNDS.south, Math.min(STATUS_MAP_KR_BOUNDS.north, lat)),
        lon: Math.max(STATUS_MAP_KR_BOUNDS.west, Math.min(STATUS_MAP_KR_BOUNDS.east, lon))
      };
    }
    function clearStatusMapTileProbeTimer(){
      if(statusMapState.tileProbeTimer){
        clearTimeout(statusMapState.tileProbeTimer);
        statusMapState.tileProbeTimer = null;
      }
    }
    function getStatusMapOfflineMarkerPosition(){
      const lonRange = STATUS_MAP_KR_BOUNDS.east - STATUS_MAP_KR_BOUNDS.west;
      const latRange = STATUS_MAP_KR_BOUNDS.north - STATUS_MAP_KR_BOUNDS.south;
      if(!(lonRange > 0) || !(latRange > 0)){
        return {left: 50, top: 50};
      }
      const lonNorm = (statusMapState.lon - STATUS_MAP_KR_BOUNDS.west) / lonRange;
      const latNorm = (STATUS_MAP_KR_BOUNDS.north - statusMapState.lat) / latRange;
      return {
        left: Math.max(8, Math.min(92, lonNorm * 100)),
        top: Math.max(8, Math.min(92, latNorm * 100))
      };
    }
    function ensureStatusMapOfflineLayer(){
      if(!el.statusMap) return null;
      let layer = el.statusMap.querySelector(".status-map-offline");
      if(layer) return layer;
      layer = document.createElement("div");
      layer.className = "status-map-offline";
      layer.innerHTML =
        "<div class=\"status-map-offline-kr\" aria-hidden=\"true\"></div>" +
        "<div class=\"status-map-offline-jeju\" aria-hidden=\"true\"></div>" +
        "<div class=\"status-map-offline-marker\" aria-hidden=\"true\">🚀</div>" +
        "<div class=\"status-map-offline-badge\" aria-hidden=\"true\">OFFLINE</div>" +
        "<div class=\"status-map-offline-label\" aria-hidden=\"true\">Offline map</div>" +
        "<button class=\"status-map-troubleshoot-btn\" id=\"statusMapTroubleshootBtn\" type=\"button\">문제 해결하기</button>";
      el.statusMap.appendChild(layer);
      const troubleshootBtn = layer.querySelector(".status-map-troubleshoot-btn");
      if(troubleshootBtn){
        troubleshootBtn.addEventListener("click", (ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          showGpsHelpModal();
        });
      }
      return layer;
    }
    function updateStatusMapOfflineMarker(){
      if(!el.statusMap) return;
      const layer = el.statusMap.querySelector(".status-map-offline");
      if(!layer) return;
      const marker = layer.querySelector(".status-map-offline-marker");
      if(!marker) return;
      const pos = getStatusMapOfflineMarkerPosition();
      marker.style.left = pos.left.toFixed(2) + "%";
      marker.style.top = pos.top.toFixed(2) + "%";
    }
    function setStatusMapTileOffline(offline){
      const next = !!offline;
      statusMapState.tileOffline = next;
      if(!el.statusMap) return;
      el.statusMap.classList.toggle("status-map-canvas--offline", next);
      if(next){
        // Stop repeated local tile retries when no tile ever loaded.
        if(!isStatusMapViewportExpanded() && statusMapState.tileLoadCount === 0 && statusMapState.tileLayer){
          try{
            statusMapState.tileLayer.off();
            statusMapState.tileLayer.remove();
          }catch(e){}
          statusMapState.tileLayer = null;
        }
        ensureStatusMapOfflineLayer();
        updateStatusMapOfflineMarker();
      }else{
        const layer = el.statusMap.querySelector(".status-map-offline");
        if(layer) layer.remove();
      }
      updateStatusMapHud();
    }
    function scheduleStatusMapTileProbe(){
      clearStatusMapTileProbeTimer();
      statusMapState.tileProbeTimer = setTimeout(()=>{
        statusMapState.tileProbeTimer = null;
        if(statusMapState.tileCycleLoadCount > 0){
          setStatusMapTileOffline(false);
          return;
        }
        setStatusMapTileOffline(true);
      // A fullscreen resize or wheel-zoom can legitimately leave the current
      // tile cycle empty for a few seconds on a slow link. Do not replace the
      // map with the offline canvas while that normal cycle is still settling.
      }, 4200);
    }
    function getStatusMapTileSource(index){
      const idx = Number(index);
      if(!Number.isInteger(idx)) return null;
      if(idx < 0 || idx >= STATUS_MAP_TILE_SOURCES.length) return null;
      return STATUS_MAP_TILE_SOURCES[idx];
    }
    function attachStatusMapTileLayer(map, koreaBounds, sourceIndex){
      if(!map || typeof window.L === "undefined") return false;
      const source = getStatusMapTileSource(sourceIndex);
      if(!source) return false;
      clearStatusMapTileProbeTimer();
      if(statusMapState.tileLayer){
        try{
          const oldLayer = statusMapState.tileLayer;
          statusMapState.tileLayer = null;
          oldLayer.off();
          requestAnimationFrame(()=>{
            try{
              if(oldLayer && oldLayer._map) oldLayer.remove();
            }catch(_e){}
          });
        }catch(e){}
      }
      statusMapState.tileLoadCount = 0;
      statusMapState.tileErrorCount = 0;
      statusMapState.tileCycleLoadCount = 0;
      statusMapState.tileCycleErrorCount = 0;
      statusMapState.tileSourceIndex = sourceIndex;
      const layerOptions = {
        bounds: koreaBounds,
        noWrap: true,
        minZoom: 6,
        maxZoom: 19,
        keepBuffer: 3,
        updateWhenIdle: true,
        updateWhenZooming: false,
        updateInterval: 160,
        attribution: ""
      };
      if(source.subdomains) layerOptions.subdomains = source.subdomains;
      const tileLayer = window.L.tileLayer(source.url, layerOptions);
      const tryFallback = ()=>{
        if(statusMapState.tileCycleLoadCount > 0) return false;
        const nextIndex = sourceIndex + 1;
        const nextSource = getStatusMapTileSource(nextIndex);
        if(!nextSource) return false;
        console.warn("[MAP] tile source fallback -> " + nextSource.id);
        return attachStatusMapTileLayer(map, koreaBounds, nextIndex);
      };
      tileLayer.on("loading", ()=>{
        statusMapState.tileCycleLoadCount = 0;
        statusMapState.tileCycleErrorCount = 0;
        scheduleStatusMapTileProbe();
      });
      tileLayer.on("tileload", ()=>{
        statusMapState.tileLoadCount += 1;
        statusMapState.tileCycleLoadCount += 1;
        if(statusMapState.tileOffline){
          setStatusMapTileOffline(false);
        }
      });
      tileLayer.on("tileerror", ()=>{
        statusMapState.tileErrorCount += 1;
        statusMapState.tileCycleErrorCount += 1;
        // A few tiles can fail while the rest of the zoom level is still
        // loading. Defer fallback until Leaflet completes the whole cycle.
      });
      tileLayer.on("load", ()=>{
        if(statusMapState.tileCycleLoadCount > 0){
          setStatusMapTileOffline(false);
          return;
        }
        if(statusMapState.tileCycleErrorCount > 0){
          if(!tryFallback()){
            setStatusMapTileOffline(true);
          }
        }
      });
      tileLayer.addTo(map);
      statusMapState.tileLayer = tileLayer;
      scheduleStatusMapTileProbe();
      return true;
    }
    function patchStatusMapLeafletSafety(){
      const L = window.L;
      if(!L || !L.GridLayer || !L.GridLayer.prototype || L.GridLayer.prototype._flash6SafePatched) return;
      const proto = L.GridLayer.prototype;
      const originalUpdate = proto._update;
      if(typeof originalUpdate === "function"){
        proto._update = function(center){
          if(!this || !this._map || typeof this._map.getCenter !== "function") return;
          return originalUpdate.call(this, center);
        };
      }
      proto._flash6SafePatched = true;
    }
    function syncStatusMapInteractionMode(){
      if(!statusMapState.map) return;
      const expanded = isStatusMapViewportExpanded();
      const lockCollapsed = isPhoneLandscapeLayout() && !expanded;
      const allow = !lockCollapsed;
      const map = statusMapState.map;
      const setLeafletHandler = (handler, on)=>{
        if(!handler || typeof handler.enable !== "function" || typeof handler.disable !== "function") return;
        if(on) handler.enable();
        else handler.disable();
      };
      setLeafletHandler(map.dragging, allow);
      setLeafletHandler(map.touchZoom, allow);
      setLeafletHandler(map.doubleClickZoom, allow);
      setLeafletHandler(map.scrollWheelZoom, expanded);
      setLeafletHandler(map.boxZoom, allow);
      setLeafletHandler(map.keyboard, allow);
      if(map.tap) setLeafletHandler(map.tap, allow);
      if(lockCollapsed && statusMapState.hasLiveFix){
        const zoomVal = isFinite(map.getZoom()) ? map.getZoom() : statusMapState.zoom;
        map.setView([statusMapState.lat, statusMapState.lon], zoomVal, {animate:false});
      }
    }
    function updateStatusMapUserLocationMarker(lat, lon, accuracyM){
      if(!statusMapState.map || typeof window.L === "undefined") return;
      const latNum = Number(lat);
      const lonNum = Number(lon);
      if(!isFinite(latNum) || !isFinite(lonNum)) return;
      const ll = [latNum, lonNum];
      const acc = Math.max(6, Math.min(4000, Number(accuracyM) || 16));
      if(!statusMapState.userAccuracyCircle){
        statusMapState.userAccuracyCircle = window.L.circle(ll, {
          radius: acc,
          color: "rgba(56,189,248,0.75)",
          weight: 1,
          fillColor: "rgba(56,189,248,0.26)",
          fillOpacity: 0.26,
          interactive: false
        }).addTo(statusMapState.map);
      }else{
        statusMapState.userAccuracyCircle.setLatLng(ll);
        statusMapState.userAccuracyCircle.setRadius(acc);
      }
      if(!statusMapState.userMarker){
        statusMapState.userMarker = window.L.circleMarker(ll, {
          radius: 5,
          color: "rgba(191,219,254,0.96)",
          weight: 2,
          fillColor: "#2563eb",
          fillOpacity: 0.95,
          interactive: false
        }).addTo(statusMapState.map);
      }else{
        statusMapState.userMarker.setLatLng(ll);
      }
      if(statusMapState.marker && statusMapState.marker.getElement){
        const markerEl = statusMapState.marker.getElement();
        if(markerEl && markerEl.parentNode && markerEl.parentNode.appendChild){
          markerEl.parentNode.appendChild(markerEl);
        }
      }
    }
    function startStatusMapUserLocationWatch(){
      if(!statusMapState.map) return;
      if(statusMapState.userWatchId != null) return;
      if(!navigator.geolocation || !window.isSecureContext) return;
      try{
        statusMapState.userWatchId = navigator.geolocation.watchPosition((pos)=>{
          if(!pos || !pos.coords) return;
          updateStatusMapUserLocationMarker(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        }, ()=>{
          statusMapState.userWatchId = null;
        }, {
          enableHighAccuracy: true,
          maximumAge: 12000,
          timeout: 14000
        });
      }catch(e){
        statusMapState.userWatchId = null;
      }
    }
    function isStatusMapViewportExpanded(){
      return !!(el.statusMapViewport && el.statusMapViewport.classList.contains("is-expanded"));
    }
    function moveStatusMapViewportToBody(){
      if(!el.statusMapViewport || statusMapViewportPortalState.mountedToBody) return;
      const parent = el.statusMapViewport.parentNode;
      if(!parent) return;
      statusMapViewportPortalState.homeParent = parent;
      statusMapViewportPortalState.homeNextSibling = el.statusMapViewport.nextSibling;
      document.body.appendChild(el.statusMapViewport);
      statusMapViewportPortalState.mountedToBody = true;
    }
    function restoreStatusMapViewportFromBody(){
      if(!el.statusMapViewport || !statusMapViewportPortalState.mountedToBody) return;
      const parent = statusMapViewportPortalState.homeParent;
      const nextSibling = statusMapViewportPortalState.homeNextSibling;
      if(parent){
        if(nextSibling && nextSibling.parentNode === parent){
          parent.insertBefore(el.statusMapViewport, nextSibling);
        }else{
          parent.appendChild(el.statusMapViewport);
        }
      }
      statusMapViewportPortalState.homeParent = null;
      statusMapViewportPortalState.homeNextSibling = null;
      statusMapViewportPortalState.mountedToBody = false;
    }
    function restoreStatusMapViewportFromMobilePreview(){
      if(!el.statusMapViewport || !mobileMapPreviewPortalState.mounted) return;
      const parent = mobileMapPreviewPortalState.homeParent;
      const nextSibling = mobileMapPreviewPortalState.homeNextSibling;
      if(parent){
        if(nextSibling && nextSibling.parentNode === parent){
          parent.insertBefore(el.statusMapViewport, nextSibling);
        }else{
          parent.appendChild(el.statusMapViewport);
        }
      }
      mobileMapPreviewPortalState.homeParent = null;
      mobileMapPreviewPortalState.homeNextSibling = null;
      mobileMapPreviewPortalState.mounted = false;
    }
    function restoreStatusMapViewportFromCameraPreview(){
      if(!el.statusMapViewport || !cameraMapPreviewPortalState.mounted) return;
      const parent = cameraMapPreviewPortalState.homeParent;
      const nextSibling = cameraMapPreviewPortalState.homeNextSibling;
      if(parent){
        if(nextSibling && nextSibling.parentNode === parent){
          parent.insertBefore(el.statusMapViewport, nextSibling);
        }else{
          parent.appendChild(el.statusMapViewport);
        }
      }
      el.statusMapViewport.classList.remove("is-camera-map-mounted");
      cameraMapPreviewPortalState.homeParent = null;
      cameraMapPreviewPortalState.homeNextSibling = null;
      cameraMapPreviewPortalState.mounted = false;
    }
    function syncCameraMapPreviewMount(){
      if(!el.statusMapViewport || !el.cameraMapMount) return;
      const shouldMount = isDesktopLayout() &&
        document.body.classList.contains("camera-view-active") &&
        document.body.classList.contains("camera-dashboard-default");
      if(shouldMount){
        if(statusMapViewportPortalState.mountedToBody) return;
        restoreStatusMapViewportFromMobilePreview();
        if(cameraMapPreviewPortalState.mounted){
          if(el.statusMapViewport.parentNode !== el.cameraMapMount){
            el.cameraMapMount.appendChild(el.statusMapViewport);
          }
          scheduleStatusMapRefresh();
          return;
        }
        const parent = el.statusMapViewport.parentNode;
        if(!parent) return;
        cameraMapPreviewPortalState.homeParent = parent;
        cameraMapPreviewPortalState.homeNextSibling = el.statusMapViewport.nextSibling;
        el.cameraMapMount.appendChild(el.statusMapViewport);
        el.statusMapViewport.classList.add("is-camera-map-mounted");
        cameraMapPreviewPortalState.mounted = true;
        scheduleStatusMapRefresh();
        requestAnimationFrame(()=>scheduleStatusMapRefresh());
        return;
      }
      restoreStatusMapViewportFromCameraPreview();
      scheduleStatusMapRefresh();
    }
    function syncMobileMapPreviewMount(){
      if(!el.statusMapViewport || !el.mobileMapPreviewMount) return;
      if(isDesktopLayout()){
        restoreStatusMapViewportFromMobilePreview();
        return;
      }
      if(statusMapViewportPortalState.mountedToBody) return;
      if(cameraMapPreviewPortalState.mounted) return;
      const shouldMount = isMobileLayout() && document.body.classList.contains("dashboard-view-active");
      if(shouldMount){
        if(mobileMapPreviewPortalState.mounted) return;
        const parent = el.statusMapViewport.parentNode;
        if(!parent) return;
        mobileMapPreviewPortalState.homeParent = parent;
        mobileMapPreviewPortalState.homeNextSibling = el.statusMapViewport.nextSibling;
        el.mobileMapPreviewMount.appendChild(el.statusMapViewport);
        mobileMapPreviewPortalState.mounted = true;
        scheduleStatusMapRefresh();
        requestAnimationFrame(()=>scheduleStatusMapRefresh());
        return;
      }
      restoreStatusMapViewportFromMobilePreview();
      scheduleStatusMapRefresh();
    }
    function updateStatusMapExpandedViewportBounds(){
      if(!el.statusMapViewport || !isStatusMapViewportExpanded()) return;
      el.statusMapViewport.style.setProperty("--status-map-expand-left", "0px");
      el.statusMapViewport.style.setProperty("--status-map-expand-top", "0px");
      el.statusMapViewport.style.setProperty("--status-map-expand-right", "0px");
      el.statusMapViewport.style.setProperty("--status-map-expand-bottom", "0px");

      let hudLeft = window.innerWidth <= 900 ? 12 : 16;
      if(window.innerWidth > 900){
        const sideNavDesktop = document.querySelector(".side-nav-desktop");
        if(sideNavDesktop){
          const navRect = sideNavDesktop.getBoundingClientRect();
          if(navRect.width > 20){
            hudLeft = Math.max(hudLeft, Math.round(navRect.right + 10));
          }
        }
      }
      el.statusMapViewport.style.setProperty("--status-map-hud-left", hudLeft + "px");
    }
    function syncStatusMapExpandButton(){
      if(!el.statusMapExpandBtn) return;
      const expanded = isStatusMapViewportExpanded();
      el.statusMapExpandBtn.textContent = expanded ? "↙ Close" : "⛶";
      el.statusMapExpandBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    }
    function setStatusMapViewportExpanded(on){
      if(!el.statusMapViewport) return;
      const next = !!on;
      if(next && isGyroViewportExpanded()){
        setGyroViewportExpanded(false);
      }
      if(next){
        moveStatusMapViewportToBody();
        if(isPhoneLandscapeLayout()){
          moveGyroViewportToBody();
        }
        if(!statusMapState.map){
          try{ initStatusMap(); }catch(e){}
        }
      }
      el.statusMapViewport.classList.toggle("is-expanded", next);
      document.documentElement.classList.toggle("status-map-expanded", next);
      if(el.statusMapExpandedHud){
        el.statusMapExpandedHud.setAttribute("aria-hidden", next ? "false" : "true");
      }
      if(next){
        updateStatusMapExpandedViewportBounds();
        syncExpandedHud();
      }else{
        if(statusMapState.hasLiveFix){
          statusMapSetMarker(statusMapState.lat, statusMapState.lon, {recenter:true});
        }
        el.statusMapViewport.style.removeProperty("--status-map-expand-left");
        el.statusMapViewport.style.removeProperty("--status-map-expand-top");
        el.statusMapViewport.style.removeProperty("--status-map-expand-right");
        el.statusMapViewport.style.removeProperty("--status-map-expand-bottom");
        el.statusMapViewport.style.removeProperty("--status-map-hud-left");
        restoreStatusMapViewportFromBody();
        if(isPhoneLandscapeLayout() && !isGyroViewportExpanded()){
          restoreGyroViewportFromBody();
        }
      }
      syncStatusMapInteractionMode();
      syncStatusMapExpandButton();
      syncGyroExpandButton();
      syncCameraMapPreviewMount();
      syncMobileMapPreviewMount();
      refreshStatusMapSize();
      scheduleStatusMapRefresh();
      if(next){
        scheduleStatusMapExpandedReflow();
      }
      if(isPhoneLandscapeLayout()){
        requestAnimationFrame(()=>{
          resizeGyroGl();
          renderGyroPreview();
        });
      }
    }
    function bindStatusMapViewportInteractions(){
      if(statusMapViewportBindingsReady || !el.statusMapViewport) return;
      el.statusMapViewport.addEventListener("click", (ev)=>{
        if(isStatusMapViewportExpanded()) return;
        if(document.documentElement.classList.contains("mobile-preview-offline") && isMobileLayout()){
          return;
        }
        if(isInteractiveViewportTarget(ev.target)) return;
        const target = ev.target instanceof Element ? ev.target : null;
        if(target && target.closest(".leaflet-control, .status-map-hud, .status-map-return-actions")) return;
        setStatusMapViewportExpanded(true);
      });
      if(el.statusMapExpandBtn){
        el.statusMapExpandBtn.addEventListener("click", (ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          setStatusMapViewportExpanded(!isStatusMapViewportExpanded());
        });
      }
      document.addEventListener("keydown", (ev)=>{
        if(!isStatusMapViewportExpanded()) return;
        if(ev.key === "Escape"){
          ev.preventDefault();
          setStatusMapViewportExpanded(false);
        }
      });
      const sideNavDesktop = document.querySelector(".side-nav-desktop");
      if(sideNavDesktop){
        const refreshExpandedHudInset = ()=>{
          if(isStatusMapViewportExpanded()) updateStatusMapExpandedViewportBounds();
        };
        sideNavDesktop.addEventListener("mouseenter", refreshExpandedHudInset);
        sideNavDesktop.addEventListener("mouseleave", refreshExpandedHudInset);
        sideNavDesktop.addEventListener("transitionend", refreshExpandedHudInset);
      }
      syncStatusMapExpandButton();
      statusMapViewportBindingsReady = true;
    }
    function bindStatusMapControls(){
      if(statusMapState.uiBound) return;
      statusMapState.uiBound = true;
      if(el.statusMapRecenterBtn){
        el.statusMapRecenterBtn.addEventListener("click",(ev)=>{
          ev.preventDefault();
          statusMapState.hasLiveFix = false;
          statusMapSetMarker(STATUS_MAP_DEFAULT.lat, STATUS_MAP_DEFAULT.lon, {recenter:true, zoom:STATUS_MAP_DEFAULT.zoom});
        });
      }
      if(el.statusMapCopyBtn){
        el.statusMapCopyBtn.addEventListener("click", async (ev)=>{
          ev.preventDefault();
          if(!statusMapState.hasLiveFix){
            const prevNoGps = el.statusMapCopyBtn.textContent;
            el.statusMapCopyBtn.textContent = "No GPS";
            setTimeout(()=>{
              if(el.statusMapCopyBtn) el.statusMapCopyBtn.textContent = prevNoGps;
            }, 900);
            return;
          }
          const txt = formatStatusMapCoord(statusMapState.lat) + ", " + formatStatusMapCoord(statusMapState.lon);
          const ok = await copyTextSafe(txt);
          const prev = el.statusMapCopyBtn.textContent;
          el.statusMapCopyBtn.textContent = ok ? "✓ Copied" : "Copy failed";
          setTimeout(()=>{
            if(el.statusMapCopyBtn) el.statusMapCopyBtn.textContent = prev;
          }, 900);
        });
      }
    }
    function ensureStatusMapLeafletCss(){
      if(document.getElementById("statusMapLeafletCssFallback")) return;
      const link = document.createElement("link");
      link.id = "statusMapLeafletCssFallback";
      link.rel = "stylesheet";
      link.href = "vendor/leaflet/leaflet.css";
      document.head.appendChild(link);
    }
    function tryLoadStatusMapLeafletScript(){
      if(typeof window.L !== "undefined") return;
      if(statusMapState.leafletLoadInFlight) return;
      statusMapState.leafletLoadInFlight = true;
      statusMapState.leafletLoadFailed = false;
      const sources = [
        "vendor/leaflet/leaflet.js",
        "/vendor/leaflet/leaflet.js",
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      ];
      let idx = 0;
      const tryNext = ()=>{
        if(typeof window.L !== "undefined"){
          statusMapState.leafletLoadInFlight = false;
          statusMapState.leafletLoadFailed = false;
          initStatusMap();
          return;
        }
        if(idx >= sources.length){
          statusMapState.leafletLoadInFlight = false;
          statusMapState.leafletLoadFailed = true;
          setStatusMapTileOffline(true);
          updateStatusMapHud();
          return;
        }
        const src = sources[idx++];
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = ()=>{
          tryNext();
        };
        script.onerror = ()=>{
          if(script.parentNode) script.parentNode.removeChild(script);
          tryNext();
        };
        document.head.appendChild(script);
      };
      tryNext();
    }
    function updateStatusMapHud(){
      if(!el.statusMapCoordText || !el.statusMapZoomText) return;
      if(statusMapState.hasLiveFix){
        el.statusMapCoordText.textContent = formatStatusMapCoord(statusMapState.lat) + " , " + formatStatusMapCoord(statusMapState.lon);
      }else{
        el.statusMapCoordText.textContent = "-- , --";
      }
      if(!statusMapState.map && typeof window.L === "undefined"){
        if(statusMapState.leafletLoadInFlight){
          el.statusMapZoomText.textContent = "map loading...";
        }else if(statusMapState.leafletLoadFailed){
          el.statusMapZoomText.textContent = "map unavailable";
        }else{
          el.statusMapZoomText.textContent = "zoom " + String(statusMapState.zoom);
        }
        return;
      }
      if(statusMapState.tileOffline){
        el.statusMapZoomText.textContent = "OFFLINE";
        return;
      }
      const zoomVal = (statusMapState.map && isFinite(statusMapState.map.getZoom())) ? statusMapState.map.getZoom() : statusMapState.zoom;
      el.statusMapZoomText.textContent = "zoom " + String(zoomVal);
    }
    function escapeStatusMapPopupText(v){
      return String(v == null ? "" : v)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
    function getStatusMapMissionName(){
      const mission = (selectedMotorName || (el.missionName && el.missionName.value) || "").trim();
      return mission || "NO MISSION";
    }
    function getStatusMapPopupMode(){
      if(flashLinkDisplayDataMode === "flight" || flashLinkDisplayDataMode === "daq"){
        return flashLinkDisplayDataMode;
      }
      const selectMode = (el.opModeSelect && el.opModeSelect.value) ? String(el.opModeSelect.value).toLowerCase() : "";
      if(selectMode === "flight" || selectMode === "daq" || selectMode === "flash_link") return selectMode;
      const settingMode = (uiSettings && uiSettings.opMode) ? String(uiSettings.opMode).toLowerCase() : "";
      if(settingMode === "flight" || settingMode === "daq" || settingMode === "flash_link") return settingMode;
      if(document.documentElement.classList.contains("mode-daq")) return "daq";
      if(document.documentElement.classList.contains("mode-flight")) return "flight";
      if(document.documentElement.classList.contains("mode-flash-link")) return "flash_link";
      return "daq";
    }
    function normalizeOperationModeValue(raw){
      const mode = String(raw || "").trim().toLowerCase().replace(/[-\s]+/g, "_");
      if(mode === "flight") return "flight";
      if(mode === "flash_link" || mode === "flashlink" || mode === "link") return "flash_link";
      return "daq";
    }
    function normalizeDataModeValue(raw, fallback){
      const text = String(raw == null ? "" : raw).trim().toLowerCase().replace(/[-\s]+/g, "_");
      if(text === "flight" || text === "1" || text === "true" || text === "on") return "flight";
      if(text === "daq" || text === "0" || text === "false" || text === "off") return "daq";
      return arguments.length > 1 ? fallback : "daq";
    }
    function normalizeFlashLinkRole(raw){
      const role = String(raw || "").trim().toLowerCase().replace(/[-\s]+/g, "_");
      if(role === "ground" || role === "ground_station" || role === "station" || role === "gcs" || role === "1"){
        return "ground";
      }
      return "avionics";
    }
    function normalizeFlashLinkNodeId(raw){
      return Number(raw) === 2 ? 2 : 1;
    }
    function getSettingsOperationModeValue(){
      return normalizeOperationModeValue(uiSettings && uiSettings.opMode);
    }
    function getDisplayOperationModeValue(){
      if(flashLinkDisplayDataMode === "flight" || flashLinkDisplayDataMode === "daq") return flashLinkDisplayDataMode;
      return getSettingsOperationModeValue();
    }
    function setFlashLinkDisplayDataMode(mode){
      const next = (mode === "flight" || mode === "daq") ? mode : null;
      if(flashLinkDisplayDataMode === next) return;
      flashLinkDisplayDataMode = next;
      applySettingsToUI();
    }
    function isFlashLinkTransportActive(){
      return getSettingsOperationModeValue() === "flash_link" || flashLinkUiLinked || flashLinkUiRemoteValid;
    }
    function getOperationModeValue(){
      return normalizeOperationModeValue(getStatusMapPopupMode());
    }
    function isFlightModeUi(){
      return getStatusMapPopupMode() === "flight";
    }
    function getOperationModePanelTitle(){
      const mode = getOperationModeValue();
      if(mode === "flight") return "FLIGHT";
      if(mode === "flash_link") return "ALTIS INTELLIGENT LINK1";
      return "DAQ";
    }
    function getOperationModeToastLabel(mode){
      const normalized = normalizeOperationModeValue(mode);
      if(normalized === "flight") return t("opModeFlight");
      if(normalized === "flash_link") return t("opModeFlashLink");
      return t("opModeDaq");
    }
    function markOperationModeConfirmPending(mode){
      pendingOperationModeConfirm = {
        mode: normalizeOperationModeValue(mode),
        startedAt: Date.now()
      };
    }
    function isOperationModeConfirmPending(){
      if(!pendingOperationModeConfirm) return false;
      if((Date.now() - pendingOperationModeConfirm.startedAt) > 30000){
        pendingOperationModeConfirm = null;
        return false;
      }
      return true;
    }
    function confirmOperationModeFromBoard(mode){
      const actual = normalizeOperationModeValue(mode);
      lastConfirmedOperationMode = actual;
      if(!isOperationModeConfirmPending()) return false;
      const target = normalizeOperationModeValue(pendingOperationModeConfirm.mode);
      if(actual !== target) return false;
      pendingOperationModeConfirm = null;
      return true;
    }
    function buildOperationModeCommandPath(mode){
      const nextMode = normalizeOperationModeValue(mode);
      const role = normalizeFlashLinkRole(uiSettings && uiSettings.flashLinkRole);
      const dataMode = normalizeDataModeValue(uiSettings && uiSettings.flashLinkDataMode, "flight");
      const dataModePart = role === "avionics" ? ("&flash_link_data_mode=" + dataMode) : "";
      const nodePart = "&flash_link_node_id=" + normalizeFlashLinkNodeId(uiSettings && uiSettings.flashLinkNodeId);
      const stage2Part = "&flash_link_stage2_mode=" + ((uiSettings && uiSettings.flashLinkStage2Mode) ? 1 : 0);
      return "/set?op_mode=" + nextMode + "&flash_link_role=" + role + nodePart + stage2Part + dataModePart;
    }
    async function requestOperationModeChange(mode){
      const target = normalizeOperationModeValue(mode);
      const path = buildOperationModeCommandPath(target);
      const targetPattern = new RegExp("\\bOP_MODE=" + target.toUpperCase() + "(?:\\b|$)");
      if(simEnabled){
        return {ok:true, confirmed:true, reason:"SIM"};
      }

      if(serialConnected && serialWriter){
        const reply = await requestSerialCommandAck(
          path,
          (evt)=>{
            const message = String(evt.message || "").toUpperCase();
            return evt.kind === "ack" &&
              message.indexOf("STREAM=") === 0 &&
              targetPattern.test(message);
          },
          {timeoutMs:2400, writeTimeoutMs:900}
        );
        if(reply && reply.ok){
          return {ok:true, confirmed:true, reason:reply.message || "SERIAL_ACK"};
        }
        // The board can restart immediately after persisting a mode change.
        // In that narrow window the ACK may be lost even though the command
        // succeeded, so telemetry confirmation gets a short grace period.
        if(reply && reply.kind === "timeout"){
          return {ok:true, confirmed:false, reason:"SERIAL_ACK_PENDING"};
        }
        return {
          ok:false,
          confirmed:false,
          reason:(reply && (reply.message || reply.kind)) || "SERIAL_NO_REPLY"
        };
      }

      const API_BASE = getApiBaseForCommands();
      const controller = createAbortControllerSafe();
      const timer = controller ? setTimeout(()=>{
        try{ controller.abort(); }catch(_e){}
      }, 2800) : null;
      try{
        const response = await fetch((API_BASE || "") + path, Object.assign(
          {cache:"no-cache"},
          controller ? {signal:controller.signal} : {}
        ));
        const body = await response.text().catch(()=>"");
        const confirmed = response.ok && targetPattern.test(String(body || "").toUpperCase());
        return {
          ok:response.ok,
          confirmed,
          reason:(body && body.trim()) || ("HTTP " + response.status)
        };
      }catch(err){
        return {
          ok:false,
          confirmed:false,
          reason:(err && err.name === "AbortError")
            ? "HTTP_TIMEOUT"
            : ((err && err.message) || "NETWORK_ERROR")
        };
      }finally{
        if(timer) clearTimeout(timer);
      }
    }
    function waitForOperationModeConfirmation(mode, timeoutMs){
      const target = normalizeOperationModeValue(mode);
      const timeout = Math.max(500, Number(timeoutMs) || 8000);
      return new Promise((resolve)=>{
        const startedAt = Date.now();
        const poll = ()=>{
          if(lastConfirmedOperationMode === target){
            resolve(true);
            return;
          }
          if((Date.now() - startedAt) >= timeout){
            resolve(false);
            return;
          }
          setTimeout(poll, 100);
        };
        poll();
      });
    }
    async function applyOperationModeChange(mode){
      if(!uiSettings || operationModeChangeBusy) return false;
      const before = getSettingsOperationModeValue();
      const next = normalizeOperationModeValue(mode);
      if(before === next){
        applySettingsToUI();
        return true;
      }

      operationModeChangeBusy = true;
      lastConfirmedOperationMode = null;
      markOperationModeConfirmPending(next);
      applySettingsToUI();
      showToast("보드 모드 적용 중: " + getOperationModeToastLabel(next), "info", {
        key:"operation-mode-change",
        duration:3000
      });

      let result = null;
      let confirmed = false;
      try{
        result = await requestOperationModeChange(next);
        confirmed = !!(result && result.ok && result.confirmed);
        if(result && result.ok && !confirmed){
          confirmed = await waitForOperationModeConfirmation(next, 8000);
        }
        if(!confirmed){
          pendingOperationModeConfirm = null;
          uiSettings.opMode = before;
          if(el.opModeSelect) el.opModeSelect.value = before;
          saveSettings();
          showToast("보드 모드 변경 실패 · 기존 모드를 유지합니다. (" +
            String((result && result.reason) || "NO_CONFIRM") + ")", "error", {
            key:"operation-mode-change",
            duration:5200
          });
          return false;
        }

        // Keep the target guard active across the restart boundary. A few old
        // telemetry frames can still be queued after the ACK; they must not
        // roll the UI back before the first frame from the new mode arrives.
        markOperationModeConfirmPending(next);
        lastConfirmedOperationMode = next;
        uiSettings.opMode = next;
        if(el.opModeSelect) el.opModeSelect.value = next;
        resetQuickFlightMetricsState();
        saveSettings();
        showToast("보드 모드 적용 완료: " + getOperationModeToastLabel(next), "success", {
          key:"operation-mode-change",
          duration:3600
        });
        return true;
      }finally{
        operationModeChangeBusy = false;
        applySettingsToUI();
      }
    }
    function setFlashLinkEnabled(enabled){
      if(!uiSettings || operationModeChangeBusy) return;
      let next = enabled ? "flash_link" : null;
      if(!enabled){
        next = (flashLinkDisplayDataMode === "flight" || flashLinkDisplayDataMode === "daq")
          ? flashLinkDisplayDataMode
          : normalizeDataModeValue(uiSettings.flashLinkDataMode, "daq");
      }
      void applyOperationModeChange(next);
    }
    function syncFlashLinkRoleToBoard(logIt){
      const role = normalizeFlashLinkRole(uiSettings && uiSettings.flashLinkRole);
      const dataMode = normalizeDataModeValue(uiSettings && uiSettings.flashLinkDataMode, "flight");
      const dataModePart = role === "avionics" ? ("&flash_link_data_mode=" + dataMode) : "";
      const nodePart = "&flash_link_node_id=" + normalizeFlashLinkNodeId(uiSettings && uiSettings.flashLinkNodeId);
      const stage2Part = "&flash_link_stage2_mode=" + ((uiSettings && uiSettings.flashLinkStage2Mode) ? 1 : 0);
      sendCommand({
        http:"/set?flash_link_role=" + role + nodePart + stage2Part + dataModePart,
        ser:"/set?flash_link_role=" + role + nodePart + stage2Part + dataModePart
      }, !!logIt);
    }
    function syncFlashLinkNodeSelectionToBoard(logIt){
      const nodeId = normalizeFlashLinkNodeId(uiSettings && uiSettings.flashLinkNodeId);
      const stage2 = (uiSettings && uiSettings.flashLinkStage2Mode) ? 1 : 0;
      const path = "/set?flash_link_node_id=" + nodeId + "&flash_link_stage2_mode=" + stage2;
      sendCommand({http:path, ser:path}, !!logIt);
    }
    function syncFlashLinkStage2ModeToBoard(logIt){
      const enabled = (uiSettings && uiSettings.flashLinkStage2Mode) ? 1 : 0;
      const path = "/set?flash_link_stage2_mode=" + enabled;
      sendCommand({http:path, ser:path}, !!logIt);
    }
    function syncFlashLinkDataModeToBoard(logIt){
      const role = normalizeFlashLinkRole(uiSettings && uiSettings.flashLinkRole);
      if(role !== "avionics") return;
      const dataMode = normalizeDataModeValue(uiSettings && uiSettings.flashLinkDataMode, "flight");
      const path = "/set?flash_link_data_mode=" + dataMode;
      sendCommand({http:path, ser:path}, !!logIt);
    }
    function getFlashLinkChartDefinition(metric, samples){
      const list = Array.isArray(samples) ? samples : [];
      if(metric === "loss"){
        let observedMax = 0;
        list.forEach((sample)=>{
          const value = readFirstFiniteLinkMetric(sample && sample.loss);
          if(isFinite(value)) observedMax = Math.max(observedMax, value);
        });
        let max = 5;
        if(observedMax > 5) max = 10;
        if(observedMax > 10) max = 25;
        if(observedMax > 25) max = 50;
        if(observedMax > 50) max = 100;
        return {key:"loss", unit:"%", color:"#ef4444", min:0, max, digits:1};
      }
      if(metric === "hz"){
        let observedMax = 0;
        list.forEach((sample)=>{
          const value = readFirstFiniteLinkMetric(sample && sample.hz);
          if(isFinite(value)) observedMax = Math.max(observedMax, value);
        });
        return {
          key:"hz",
          unit:"Hz",
          color:"#3b82f6",
          min:0,
          max:Math.max(60, Math.ceil(observedMax / 10) * 10),
          digits:0
        };
      }
      return {key:"rssi", unit:"dBm", color:"#22c55e", min:-110, max:-20, digits:0};
    }
    function formatFlashLinkChartValue(value, definition){
      const number = Number(value);
      if(!isFinite(number)) return "-- " + definition.unit;
      return number.toFixed(definition.digits) + " " + definition.unit;
    }
    function updateFlashLinkChartTabs(){
      const tabs = el.flashLinkChartTabs || [];
      tabs.forEach((tab)=>{
        const active = tab.dataset.flChartMetric === flashLinkChartMetric;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
    }
    function updateDashboardSectionTabs(){
      (el.dashboardSectionTabs || []).forEach((tab)=>{
        const active = tab.dataset.dashboardSection === dashboardSectionView;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
      const communicationActive = dashboardSectionView === "communication";
      document.body.classList.toggle("dashboard-communication-active", communicationActive);
      (el.dashboardTelemetryRows || []).forEach((row)=>{
        row.classList.toggle("hidden", communicationActive);
      });
      if(el.dashboardCommunicationCard){
        el.dashboardCommunicationCard.classList.toggle("hidden", !communicationActive);
      }
      scheduleFlashLinkChartRender();
    }
    function setDashboardSectionView(view){
      dashboardSectionView = view === "communication" ? "communication" : "telemetry";
      updateDashboardSectionTabs();
      if(dashboardSectionView === "communication"){
        setDesktopControlDrawerOpen(false);
        syncDashboardCommunicationUi();
        requestAnimationFrame(()=>{
          scheduleFlashLinkChartRender();
        });
      }else{
        requestAnimationFrame(()=>{
          refreshChartLayout();
          redrawCharts();
        });
      }
    }
    function setFlashLinkChartMetric(metric, persist){
      const next = (metric === "loss" || metric === "hz") ? metric : "rssi";
      flashLinkChartMetric = next;
      updateFlashLinkChartTabs();
      if(persist !== false){
        try{ localStorage.setItem(FLASH_LINK_CHART_STORAGE_KEY, next); }catch(_e){}
      }
      scheduleFlashLinkChartRender();
    }
    function updateDashboardStageLinkChartTabs(stageId){
      const id = Number(stageId) === 2 ? 2 : 1;
      const metric = dashboardStageLinkChartMetrics[id];
      (el.dashboardStageLinkMetricButtons || []).forEach((tab)=>{
        if(Number(tab.dataset.stageId) !== id) return;
        const active = tab.dataset.dashboardStageLinkMetric === metric;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
    }
    function setDashboardStageLinkChartMetric(stageId, metric){
      const id = Number(stageId) === 2 ? 2 : 1;
      dashboardStageLinkChartMetrics[id] =
        (metric === "loss" || metric === "hz") ? metric : "rssi";
      updateDashboardStageLinkChartTabs(id);
      scheduleFlashLinkChartRender();
    }
    function readFirstFiniteLinkMetric(){
      for(let index = 0; index < arguments.length; index++){
        const raw = arguments[index];
        if(raw == null || raw === "") continue;
        const value = Number(raw);
        if(isFinite(value)) return value;
      }
      return NaN;
    }
    function recordDashboardStageLinkChartSample(stageId, sample){
      const id = Number(stageId);
      if(id !== 1 && id !== 2) return;
      const now = Date.now();
      const source = sample || {};
      const rssi = readFirstFiniteLinkMetric(
        source.stage_rssi_dbm, source.fl_rssi_dbm, source.flash_link_rssi_dbm
      );
      const rssiAgeMs = readFirstFiniteLinkMetric(
        source.stage_rssi_age_ms, source.fl_rssi_age_ms, source.flash_link_rssi_age_ms
      );
      const lossPermille = readFirstFiniteLinkMetric(
        source.stage_loss_permille, source.fl_loss_permille, source.flash_link_loss_permille
      );
      const rxHz = readFirstFiniteLinkMetric(
        source.stage_rx_hz, source.fl_rx_hz, source.flash_link_rx_hz
      );
      const samples = dashboardStageLinkChartSamples[id];
      const nextSample = {
        time:now,
        rssi:isFinite(rssi) && rssi > -126 &&
          (!isFinite(rssiAgeMs) || rssiAgeMs <= 6000) ? rssi : null,
        loss:isFinite(lossPermille) ? Math.max(0, lossPermille) / 10 : null,
        hz:isFinite(rxHz) ? Math.max(0, rxHz) : null
      };
      if(dashboardStageLinkChartLastSampleMs[id] > 0 &&
         (now - dashboardStageLinkChartLastSampleMs[id]) < FLASH_LINK_CHART_SAMPLE_MS){
        // Stage telemetry and the A.I LINK status can describe the same radio
        // interval through separate transports. Merge them into one slot so
        // an earlier empty relay snapshot cannot suppress a later valid RSSI.
        const current = samples[samples.length - 1];
        let changed = false;
        if(current){
          ["rssi", "loss", "hz"].forEach((key)=>{
            if(nextSample[key] != null && isFinite(Number(nextSample[key])) &&
               current[key] !== nextSample[key]){
              current[key] = nextSample[key];
              changed = true;
            }
          });
          if(changed) scheduleFlashLinkChartRender();
          return;
        }
      }
      dashboardStageLinkChartLastSampleMs[id] = now;
      samples.push(nextSample);
      const cutoff = now - FLASH_LINK_CHART_WINDOW_MS - 1000;
      while(samples.length && samples[0].time < cutoff) samples.shift();
      if(samples.length > FLASH_LINK_CHART_MAX_POINTS){
        samples.splice(0, samples.length - FLASH_LINK_CHART_MAX_POINTS);
      }
      scheduleFlashLinkChartRender();
    }
    function recordFlashLinkChartSample(sample){
      const now = Date.now();
      if(flashLinkChartLastSampleMs > 0 &&
         (now - flashLinkChartLastSampleMs) < FLASH_LINK_CHART_SAMPLE_MS){
        return;
      }
      flashLinkChartLastSampleMs = now;
      const rssi = readFirstFiniteLinkMetric(sample && sample.rssi);
      const loss = readFirstFiniteLinkMetric(sample && sample.loss);
      const hz = readFirstFiniteLinkMetric(sample && sample.hz);
      flashLinkChartSamples.push({
        time:now,
        rssi:isFinite(rssi) ? rssi : null,
        loss:isFinite(loss) ? Math.max(0, loss) : null,
        hz:isFinite(hz) ? Math.max(0, hz) : null
      });
      const cutoff = now - FLASH_LINK_CHART_WINDOW_MS - 1000;
      while(flashLinkChartSamples.length && flashLinkChartSamples[0].time < cutoff){
        flashLinkChartSamples.shift();
      }
      if(flashLinkChartSamples.length > FLASH_LINK_CHART_MAX_POINTS){
        flashLinkChartSamples.splice(0, flashLinkChartSamples.length - FLASH_LINK_CHART_MAX_POINTS);
      }
      scheduleFlashLinkChartRender();
    }
    function scheduleFlashLinkChartRender(){
      if(flashLinkChartRaf) return;
      flashLinkChartRaf = requestAnimationFrame(()=>{
        flashLinkChartRaf = 0;
        drawFlashLinkQualityChart();
      });
    }
    function drawFlashLinkQualityChartTarget(canvas, valueTarget, samples, definition, now){
      if(!canvas) return;
      const size = ensureCanvasSize(canvas);
      if(!size) return;
      const {w:width, h:height, ctx} = size;
      const cutoff = now - FLASH_LINK_CHART_WINDOW_MS;
      const dark = document.documentElement.dataset.theme === "dark";
      const textColor = dark ? "rgba(203,213,225,0.72)" : "rgba(71,85,105,0.72)";
      const gridColor = dark ? "rgba(148,163,184,0.15)" : "rgba(100,116,139,0.15)";
      const plot = {left:38, top:18, right:10, bottom:24};
      const plotLeft = plot.left;
      const plotTop = plot.top;
      const plotRight = width - plot.right;
      const plotBottom = height - plot.bottom;
      const plotWidth = Math.max(40, plotRight - plotLeft);
      const plotHeight = Math.max(40, plotBottom - plotTop);
      const span = Math.max(1, definition.max - definition.min);

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.font = "10px -apple-system,BlinkMacSystemFont,system-ui,sans-serif";
      ctx.lineWidth = 1;
      ctx.textBaseline = "middle";

      for(let index = 0; index <= 4; index++){
        const ratio = index / 4;
        const y = plotTop + (plotHeight * ratio);
        const value = definition.max - (span * ratio);
        ctx.strokeStyle = gridColor;
        ctx.beginPath();
        ctx.moveTo(plotLeft, y);
        ctx.lineTo(plotRight, y);
        ctx.stroke();
        ctx.fillStyle = textColor;
        ctx.textAlign = "right";
        ctx.fillText(value.toFixed(definition.digits), plotLeft - 6, y);
      }
      for(let index = 0; index <= 3; index++){
        const ratio = index / 3;
        const x = plotLeft + (plotWidth * ratio);
        ctx.strokeStyle = gridColor;
        ctx.beginPath();
        ctx.moveTo(x, plotTop);
        ctx.lineTo(x, plotBottom);
        ctx.stroke();
        ctx.fillStyle = textColor;
        ctx.textAlign = index === 0 ? "left" : (index === 3 ? "right" : "center");
        const seconds = Math.round((1 - ratio) * (FLASH_LINK_CHART_WINDOW_MS / 1000));
        ctx.fillText(seconds === 0 ? (currentLang === "ko" ? "현재" : "now") : ("-" + seconds + "s"), x, plotBottom + 14);
      }

      let latestValue = NaN;
      for(let index = samples.length - 1; index >= 0; index--){
        const value = readFirstFiniteLinkMetric(
          samples[index] && samples[index][definition.key]
        );
        if(isFinite(value)){
          latestValue = value;
          break;
        }
      }
      if(valueTarget){
        valueTarget.textContent = formatFlashLinkChartValue(latestValue, definition);
        valueTarget.style.color = definition.color;
      }

      const validCount = samples.reduce((count, sample)=>(
        isFinite(readFirstFiniteLinkMetric(sample && sample[definition.key]))
          ? count + 1
          : count
      ), 0);
      if(validCount === 0){
        ctx.fillStyle = textColor;
        ctx.font = "12px -apple-system,BlinkMacSystemFont,system-ui,sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(currentLang === "ko" ? "수신 데이터 대기 중" : "Waiting for link data", plotLeft + (plotWidth / 2), plotTop + (plotHeight / 2));
        ctx.restore();
        return;
      }

      const xForTime = (time)=>plotLeft + (((time - cutoff) / FLASH_LINK_CHART_WINDOW_MS) * plotWidth);
      const yForValue = (value)=>{
        const clamped = Math.max(definition.min, Math.min(definition.max, value));
        return plotBottom - (((clamped - definition.min) / span) * plotHeight);
      };
      ctx.strokeStyle = definition.color;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      let drawing = false;
      let lastPoint = null;
      samples.forEach((sample)=>{
        const value = readFirstFiniteLinkMetric(sample && sample[definition.key]);
        if(!isFinite(value)){
          return;
        }
        const x = xForTime(sample.time);
        const y = yForValue(value);
        if(!drawing) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        drawing = true;
        lastPoint = {x, y};
      });
      ctx.stroke();
      if(lastPoint){
        ctx.fillStyle = definition.color;
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    function drawFlashLinkQualityChart(){
      const now = Date.now();
      const cutoff = now - FLASH_LINK_CHART_WINDOW_MS;
      const samples = flashLinkChartSamples.filter((sample)=>sample.time >= cutoff);
      const definition = getFlashLinkChartDefinition(flashLinkChartMetric, samples);
      drawFlashLinkQualityChartTarget(
        el.flashLinkQualityChart,
        el.flashLinkChartValue,
        samples,
        definition,
        now
      );
      [1, 2].forEach((stageId)=>{
        const stageSamples = dashboardStageLinkChartSamples[stageId]
          .filter((sample)=>sample.time >= cutoff);
        const stageDefinition = getFlashLinkChartDefinition(
          dashboardStageLinkChartMetrics[stageId],
          stageSamples
        );
        drawFlashLinkQualityChartTarget(
          stageId === 1
            ? el.dashboardStage1LinkQualityChart
            : el.dashboardStage2LinkQualityChart,
          stageId === 1
            ? el.dashboardStage1LinkChartValue
            : el.dashboardStage2LinkChartValue,
          stageSamples,
          stageDefinition,
          now
        );
      });
    }
    function initFlashLinkQualityChart(){
      try{
        const saved = localStorage.getItem(FLASH_LINK_CHART_STORAGE_KEY);
        if(saved === "rssi" || saved === "loss" || saved === "hz"){
          flashLinkChartMetric = saved;
        }
      }catch(_e){}
      updateFlashLinkChartTabs();
      (el.flashLinkChartTabs || []).forEach((tab)=>{
        tab.addEventListener("click",()=>{
          setFlashLinkChartMetric(tab.dataset.flChartMetric, true);
        });
      });
      (el.dashboardSectionTabs || []).forEach((tab)=>{
        tab.addEventListener("click",()=>{
          setDashboardSectionView(tab.dataset.dashboardSection);
        });
      });
      (el.dashboardStageLinkMetricButtons || []).forEach((tab)=>{
        tab.addEventListener("click",()=>{
          setDashboardStageLinkChartMetric(
            Number(tab.dataset.stageId),
            tab.dataset.dashboardStageLinkMetric
          );
        });
      });
      updateDashboardStageLinkChartTabs(1);
      updateDashboardStageLinkChartTabs(2);
      updateDashboardSectionTabs();
      if(window.ResizeObserver &&
         (el.flashLinkQualityChart ||
          el.dashboardStage1LinkQualityChart ||
          el.dashboardStage2LinkQualityChart) &&
         !flashLinkChartResizeObserver){
        flashLinkChartResizeObserver = new ResizeObserver(()=>scheduleFlashLinkChartRender());
        if(el.flashLinkQualityChart) flashLinkChartResizeObserver.observe(el.flashLinkQualityChart);
        if(el.dashboardStage1LinkQualityChart){
          flashLinkChartResizeObserver.observe(el.dashboardStage1LinkQualityChart);
        }
        if(el.dashboardStage2LinkQualityChart){
          flashLinkChartResizeObserver.observe(el.dashboardStage2LinkQualityChart);
        }
      }
      scheduleFlashLinkChartRender();
    }
    function getFlashLinkReportPlacementSteps(step){
      const currentStep = Number(step) === 2 ? 2 : 1;
      if(currentLang === "en"){
        return currentStep === 1
          ? ["Place Ground beside the PC/phone and Avionics 2-5 m ahead at the same height."]
          : [
              "Align both antennas in the same direction and face them toward each other.",
              "Keep them 30 cm from metal, batteries, hands, and laptops, then do not move them."
            ];
      }
      return currentStep === 1
        ? ["지상국은 PC/폰 옆, 에비오닉스는 2~5m 앞 같은 높이에 두세요."]
        : [
            "두 안테나를 같은 방향으로 세우고 서로 마주 보게 하세요.",
            "금속·배터리·손·노트북에서 30cm 이상 띄운 뒤 움직이지 마세요."
          ];
    }
    function escapeHtmlText(text){
      return String(text == null ? "" : text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
    function renderFlashLinkReportSteps(){
      if(!el.flashLinkReportSteps) return;
      el.flashLinkReportSteps.innerHTML = getFlashLinkReportPlacementSteps(flashLinkReportState.introStep)
        .map((text)=>'<div class="flash-link-report-step">' + escapeHtmlText(text) + '</div>')
        .join("");
    }
    function flashLinkReportPhaseLabel(){
      const phase = flashLinkReportState.phase;
      if(phase === "countdown"){
        const remain = Math.max(1, Math.ceil((flashLinkReportState.countdownEndsAtMs - Date.now()) / 1000));
        return currentLang === "ko" ? ("START " + remain + "s") : ("START " + remain + "s");
      }
      if(phase === "running"){
        const remain = Math.max(0, Math.ceil((flashLinkReportState.endsAtMs - Date.now()) / 1000));
        return currentLang === "ko" ? ("REC " + remain + "s") : ("REC " + remain + "s");
      }
      if(phase === "exporting") return "XLSX";
      return flashLinkReportState.lastExportName ? "DONE" : "READY";
    }
    function updateFlashLinkReportUi(){
      const phase = flashLinkReportState.phase;
      if(el.flashLinkReportStatus){
        el.flashLinkReportStatus.textContent = flashLinkReportPhaseLabel();
      }
      if(el.flashLinkReportBtn){
        if(phase === "countdown"){
          const remain = Math.max(1, Math.ceil((flashLinkReportState.countdownEndsAtMs - Date.now()) / 1000));
          el.flashLinkReportBtn.textContent = String(remain) + "...";
        }else if(phase === "running"){
          const span = Math.max(1, flashLinkReportState.endsAtMs - flashLinkReportState.startedAtMs);
          const done = Math.max(0, Math.min(1, (Date.now() - flashLinkReportState.startedAtMs) / span));
          el.flashLinkReportBtn.textContent = currentLang === "ko"
            ? ("수집 중 " + Math.round(done * 100) + "%")
            : ("Recording " + Math.round(done * 100) + "%");
        }else if(phase === "exporting"){
          el.flashLinkReportBtn.textContent = currentLang === "ko" ? "XLSX 생성중" : "Building XLSX";
        }else{
          el.flashLinkReportBtn.textContent = t("flashLinkReportBtn");
        }
        el.flashLinkReportBtn.disabled = phase === "exporting";
      }
      if(!el.flashLinkReportOverlay || el.flashLinkReportOverlay.classList.contains("hidden")) return;
      const running = phase === "running";
      const countdown = phase === "countdown";
      const exporting = phase === "exporting";
      const introStep = flashLinkReportState.introStep === 2 ? 2 : 1;
      if(el.flashLinkReportTitle){
        el.flashLinkReportTitle.textContent = exporting
          ? (currentLang === "ko" ? "보고서 생성 중" : "Building report")
          : (running
              ? (currentLang === "ko" ? "통신 품질 기록 중" : "Recording link quality")
              : (countdown
                  ? (currentLang === "ko" ? "측정 준비" : "Get ready")
                  : (currentLang === "ko" ? "통신 보고서 내보내기" : "Export communication report")));
      }
      if(el.flashLinkReportText){
        if(exporting){
          el.flashLinkReportText.textContent = currentLang === "ko"
            ? "수집 데이터를 정리하고 보고서를 생성하는 중입니다."
            : "Summarizing collected data and generating Excel charts.";
        }else if(running){
          const remain = Math.max(0, Math.ceil((flashLinkReportState.endsAtMs - Date.now()) / 1000));
          el.flashLinkReportText.textContent = currentLang === "ko"
            ? ("남은 시간 " + remain + "초. 두 보드를 움직이지 말고 사이를 가리지 마세요.")
            : (remain + " seconds remaining. Do not move or block the boards.");
        }else if(countdown){
          el.flashLinkReportText.textContent = currentLang === "ko"
            ? "3초 후 60초 측정을 시작합니다. 지금부터 두 기기를 고정해 주세요."
            : "The 60-second capture starts after 3 seconds. Keep both devices still now.";
        }else{
          el.flashLinkReportText.textContent = currentLang === "ko"
            ? (introStep === 1 ? "기기 배치" : "안테나 및 주변 확인")
            : (introStep === 1 ? "Device placement" : "Antenna and surroundings");
        }
      }
      if(el.flashLinkReportStep){
        el.flashLinkReportStep.style.display = (phase === "idle") ? "" : "none";
        const stepOneLabel = currentLang === "ko" ? "배치" : "Placement";
        const stepTwoLabel = currentLang === "ko" ? "환경" : "Environment";
        el.flashLinkReportStep.setAttribute("aria-label", "STEP " + introStep + " / 2");
        el.flashLinkReportStep.innerHTML =
          '<span class="' + (introStep === 1 ? "is-active" : "is-complete") + '">' +
            '<b>01</b><em>' + stepOneLabel + '</em>' +
          '</span>' +
          '<i aria-hidden="true"></i>' +
          '<span class="' + (introStep === 2 ? "is-active" : "") + '">' +
            '<b>02</b><em>' + stepTwoLabel + '</em>' +
          '</span>';
      }
      if(el.flashLinkReportVisual){
        el.flashLinkReportVisual.style.display = (phase === "idle") ? "" : "none";
        el.flashLinkReportVisual.dataset.step = String(introStep);
      }
      if(el.flashLinkReportSteps){
        el.flashLinkReportSteps.style.display = (!running && !countdown && !exporting) ? "" : "none";
        if(phase === "idle") renderFlashLinkReportSteps();
      }
      if(el.flashLinkReportProgress){
        el.flashLinkReportProgress.classList.toggle("hidden", !(running || countdown || exporting));
        if(exporting){
          el.flashLinkReportProgress.textContent = "XLSX";
        }else if(countdown){
          const remain = Math.max(1, Math.ceil((flashLinkReportState.countdownEndsAtMs - Date.now()) / 1000));
          el.flashLinkReportProgress.textContent = String(remain);
        }else if(running){
          const remain = Math.max(0, Math.ceil((flashLinkReportState.endsAtMs - Date.now()) / 1000));
          el.flashLinkReportProgress.textContent = remain + "s";
        }
      }
      if(el.flashLinkReportStart){
        el.flashLinkReportStart.style.display = (phase === "idle") ? "" : "none";
        el.flashLinkReportStart.textContent = currentLang === "ko"
          ? (introStep === 1 ? "다음" : "측정 시작")
          : (introStep === 1 ? "Next" : "Start capture");
      }
      if(el.flashLinkReportCancel){
        el.flashLinkReportCancel.textContent = (phase === "countdown" || phase === "running")
          ? (currentLang === "ko" ? "측정 취소" : "Cancel capture")
          : (currentLang === "ko" ? "닫기" : "Close");
        el.flashLinkReportCancel.style.display = (phase === "countdown" || phase === "running") ? "" : "none";
      }
    }
    function clearFlashLinkReportTimer(){
      if(flashLinkReportState.timer){
        clearInterval(flashLinkReportState.timer);
        flashLinkReportState.timer = null;
      }
    }
    function showFlashLinkReportOverlay(){
      if(flashLinkReportState.phase === "idle"){
        flashLinkReportState.introStep = 1;
      }
      renderFlashLinkReportSteps();
      if(el.settingsOverlay && !el.settingsOverlay.classList.contains("hidden")){
        hideSettings();
      }
      setOverlayVisible(el.flashLinkReportOverlay, true);
      updateFlashLinkReportUi();
    }
    function hideFlashLinkReportOverlay(){
      setOverlayVisible(el.flashLinkReportOverlay, false);
    }
    function abortFlashLinkReport(){
      clearFlashLinkReportTimer();
      flashLinkReportState.phase = "idle";
      flashLinkReportState.startedAtMs = 0;
      flashLinkReportState.endsAtMs = 0;
      flashLinkReportState.countdownEndsAtMs = 0;
      flashLinkReportState.lastSampleMs = 0;
      flashLinkReportState.samples = [];
      updateFlashLinkReportUi();
      hideFlashLinkReportOverlay();
      showToast(currentLang === "ko" ? "통신 보고서 측정 취소됨" : "Communication report capture canceled.", "notice", {key:"flash-link-report"});
    }
    function startFlashLinkReportCountdown(){
      clearFlashLinkReportTimer();
      flashLinkReportState.phase = "countdown";
      flashLinkReportState.samples = [];
      flashLinkReportState.lastSampleMs = 0;
      flashLinkReportState.countdownEndsAtMs = Date.now() + (FLASH_LINK_REPORT_COUNTDOWN_SEC * 1000);
      flashLinkReportState.timer = setInterval(()=>{
        if(Date.now() >= flashLinkReportState.countdownEndsAtMs){
          beginFlashLinkReportCapture();
          return;
        }
        updateFlashLinkReportUi();
      }, 120);
      showFlashLinkReportOverlay();
      updateFlashLinkReportUi();
    }
    function handleFlashLinkReportControl(controlId){
      if(controlId === "flashLinkReportBtn"){
        showFlashLinkReportOverlay();
        return true;
      }
      if(controlId === "flashLinkReportStart"){
        if(flashLinkReportState.phase === "idle" && flashLinkReportState.introStep === 1){
          flashLinkReportState.introStep = 2;
          updateFlashLinkReportUi();
          return true;
        }
        startFlashLinkReportCountdown();
        return true;
      }
      if(controlId === "flashLinkReportCancel" || controlId === "flashLinkReportClose"){
        if(flashLinkReportState.phase === "countdown" || flashLinkReportState.phase === "running"){
          abortFlashLinkReport();
        }else{
          hideFlashLinkReportOverlay();
        }
        return true;
      }
      return false;
    }
    function beginFlashLinkReportCapture(){
      clearFlashLinkReportTimer();
      const now = Date.now();
      flashLinkReportState.phase = "running";
      flashLinkReportState.samples = [];
      flashLinkReportState.startedAtMs = now;
      flashLinkReportState.endsAtMs = now + FLASH_LINK_REPORT_DURATION_MS;
      flashLinkReportState.lastSampleMs = 0;
      flashLinkReportState.timer = setInterval(()=>{
        if(Date.now() >= flashLinkReportState.endsAtMs){
          finishFlashLinkReportCapture();
          return;
        }
        updateFlashLinkReportUi();
      }, 180);
      addLogLine("ALTIS INTELLIGENT LINK1 communication report capture started.", "INFO");
      showToast(currentLang === "ko" ? "통신 보고서 측정 시작. 60초 동안 기기를 움직이지 마세요." : "Communication report capture started. Keep both devices still for 60 seconds.", "info", {key:"flash-link-report"});
      updateFlashLinkReportUi();
    }
    function finishFlashLinkReportCapture(){
      if(flashLinkReportState.phase !== "running") return;
      clearFlashLinkReportTimer();
      flashLinkReportState.phase = "exporting";
      updateFlashLinkReportUi();
      setTimeout(()=>{
        try{
          exportFlashLinkCommunicationReport(flashLinkReportState.samples.slice());
        }catch(err){
          reportSilentException("flash-link-report-export", err);
          showToast(currentLang === "ko" ? "통신 보고서 생성 실패" : "Communication report export failed. Check the console log.", "error", {key:"flash-link-report"});
        }finally{
          flashLinkReportState.phase = "idle";
          flashLinkReportState.startedAtMs = 0;
          flashLinkReportState.endsAtMs = 0;
          flashLinkReportState.countdownEndsAtMs = 0;
          flashLinkReportState.lastSampleMs = 0;
          flashLinkReportState.samples = [];
          updateFlashLinkReportUi();
          hideFlashLinkReportOverlay();
        }
      }, 80);
    }
    function recordFlashLinkReportSample(sample){
      if(flashLinkReportState.phase !== "running") return;
      const now = Date.now();
      if(flashLinkReportState.lastSampleMs > 0 &&
         (now - flashLinkReportState.lastSampleMs) < FLASH_LINK_REPORT_SAMPLE_MS){
        return;
      }
      flashLinkReportState.lastSampleMs = now;
      flashLinkReportState.samples.push(Object.assign({time:now}, sample || {}));
    }
    function flashLinkReportNumbers(samples, key){
      const out = [];
      (Array.isArray(samples) ? samples : []).forEach((sample)=>{
        const value = Number(sample && sample[key]);
        if(isFinite(value)) out.push(value);
      });
      return out;
    }
    function calcNumberStats(values){
      const list = (Array.isArray(values) ? values : []).filter((value)=>isFinite(Number(value))).map(Number);
      if(!list.length){
        return {count:0, min:null, max:null, avg:null, std:null, p05:null, p95:null};
      }
      const sorted = list.slice().sort((a,b)=>a-b);
      const sum = list.reduce((acc, value)=>acc + value, 0);
      const avg = sum / list.length;
      const variance = list.reduce((acc, value)=>acc + Math.pow(value - avg, 2), 0) / list.length;
      const percentile = (p)=>{
        if(sorted.length === 1) return sorted[0];
        const pos = (sorted.length - 1) * p;
        const low = Math.floor(pos);
        const high = Math.ceil(pos);
        const frac = pos - low;
        return sorted[low] + ((sorted[high] - sorted[low]) * frac);
      };
      return {
        count:list.length,
        min:sorted[0],
        max:sorted[sorted.length - 1],
        avg,
        std:Math.sqrt(variance),
        p05:percentile(0.05),
        p95:percentile(0.95)
      };
    }
    function calcFlashLinkReportStats(samples){
      const list = Array.isArray(samples) ? samples : [];
      const modeSample = list.find((sample)=>sample && sample.stage2Mode != null);
      const targetHz = modeSample
        ? (modeSample.stage2Mode ? 50 : 100)
        : targetStreamHz();
      const sampleCount = list.length;
      const hzStats = calcNumberStats(flashLinkReportNumbers(list, "rxHz"));
      const lossStats = calcNumberStats(flashLinkReportNumbers(list, "lossPct"));
      const rssiStats = calcNumberStats(flashLinkReportNumbers(list, "rssiDbm"));
      let operationalCount = 0;
      let remoteValidCount = 0;
      let stableHzCount = 0;
      let offlineMs = 0;
      let dropoutCount = 0;
      let wasOffline = false;
      for(let i = 0; i < list.length; i++){
        const sample = list[i] || {};
        const operational = !!sample.operational;
        if(operational) operationalCount += 1;
        if(sample.remoteValid) remoteValidCount += 1;
        if(isFinite(Number(sample.rxHz)) && Number(sample.rxHz) >= targetHz * 0.9) stableHzCount += 1;
        const dt = Math.max(0, Math.min(1000,
          i + 1 < list.length ? (Number(list[i + 1].time) - Number(sample.time)) : FLASH_LINK_REPORT_SAMPLE_MS
        ));
        if(!operational) offlineMs += dt;
        if(!operational && !wasOffline) dropoutCount += 1;
        wasOffline = !operational;
      }
      const availabilityPct = sampleCount ? (operationalCount / sampleCount) * 100 : 0;
      const remoteValidPct = sampleCount ? (remoteValidCount / sampleCount) * 100 : 0;
      const stableHzPct = sampleCount ? (stableHzCount / sampleCount) * 100 : 0;
      const avgHz = hzStats.avg == null ? 0 : hzStats.avg;
      const avgLoss = lossStats.avg == null ? 100 : lossStats.avg;
      const avgRssi = rssiStats.avg == null ? -127 : rssiStats.avg;
      let grade = "FAIL";
      let verdict = currentLang === "ko" ? "링크 품질 확인 필요" : "Link quality needs review";
      if(sampleCount > 0 && availabilityPct >= 99 && avgHz >= targetHz * 0.9 && avgLoss <= 5 && avgRssi >= -70){
        grade = "EXCELLENT";
        verdict = currentLang === "ko" ? "대회 보고서에 쓰기 좋은 매우 안정적인 링크" : "Very stable link, suitable for report evidence";
      }else if(sampleCount > 0 && availabilityPct >= 95 && avgHz >= targetHz * 0.8 && avgLoss <= 10 && avgRssi >= -80){
        grade = "GOOD";
        verdict = currentLang === "ko" ? "운용 가능한 안정 링크" : "Operationally stable link";
      }else if(sampleCount > 0 && availabilityPct >= 85 && avgHz >= targetHz * 0.6){
        grade = "CHECK";
        verdict = currentLang === "ko" ? "안테나 배치/차폐/거리 재확인 권장" : "Recheck antenna placement, blockage, and distance";
      }
      return {
        sampleCount,
        durationSec: sampleCount >= 2
          ? Math.max(0, (Number(list[list.length - 1].time) - Number(list[0].time)) / 1000)
          : 0,
        availabilityPct,
        remoteValidPct,
        targetHz,
        stableHzPct,
        offlineSec: offlineMs / 1000,
        dropoutCount,
        hz:hzStats,
        loss:lossStats,
        rssi:rssiStats,
        grade,
        verdict
      };
    }
    function reportRound(value, digits){
      if(value == null || !isFinite(Number(value))) return "";
      return Number(Number(value).toFixed(digits == null ? 2 : digits));
    }
    function reportText(value, digits, suffix){
      if(value == null || !isFinite(Number(value))) return "-";
      return Number(value).toFixed(digits == null ? 2 : digits) + (suffix || "");
    }
    function exportFlashLinkCommunicationReport(samples){
      const list = Array.isArray(samples) ? samples : [];
      const stats = calcFlashLinkReportStats(list);
      const now = new Date();
      const pad = (n)=>String(n).padStart(2, "0");
      const stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + "_" +
        pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
      const filename = "ALTIS_INTELLIGENT_LINK1_REPORT_" + stamp + ".xlsx";
      const roleLabel = normalizeFlashLinkRole(flashLinkUiRole) === "ground" ? "GROUND" : "AVIONICS";
      const peer = list.length ? String(list[list.length - 1].peer || "--") : "--";
      const infoRows = [
        {cells:["ALTIS INTELLIGENT LINK1 COMMUNICATION REPORT"], style:2},
        {cells:["Generated at", now.toISOString()], style:3},
        {cells:["Protocol", "Flash6-Intelligent-b8 / ALTIS INTELLIGENT LINK1 ESP-NOW LR"], style:3},
        {cells:["Board role", roleLabel], style:3},
        {cells:["Peer", peer || "--"], style:3},
        {cells:["Target rate", stats.targetHz + " Hz"], style:3},
        {cells:["Capture duration target", (FLASH_LINK_REPORT_DURATION_MS / 1000) + " s"], style:3},
        {cells:["Captured samples", stats.sampleCount], style:3},
        {cells:["Verdict", stats.grade + " - " + stats.verdict], style:3},
        {cells:["Note", "RSSI is dBm. dBi is antenna gain, not received signal strength."], style:3}
      ];
      const summaryRows = [
        {cells:["SUMMARY"], style:2},
        ["Metric", "Value", "Unit", "Note"],
        ["Overall grade", stats.grade, "", stats.verdict],
        ["Capture span", reportRound(stats.durationSec, 2), "s", "First to last captured report sample"],
        ["Link availability", reportRound(stats.availabilityPct, 2), "%", "LINKED and remote data valid"],
        ["Remote/avionics data valid", reportRound(stats.remoteValidPct, 2), "%", "Ground station receiving avionics telemetry"],
        ["Stable rate ratio", reportRound(stats.stableHzPct, 2), "%", "Samples with receive Hz >= " + (stats.targetHz * 0.9).toFixed(0)],
        ["Dropout events", stats.dropoutCount, "count", "Contiguous offline periods in the capture"],
        ["Estimated offline time", reportRound(stats.offlineSec, 2), "s", "Estimated from report sample intervals"],
        ["Average receive rate", reportRound(stats.hz.avg, 2), "Hz", "ALTIS INTELLIGENT LINK1 receive Hz"],
        ["Minimum receive rate", reportRound(stats.hz.min, 2), "Hz", "Worst observed rate"],
        ["Average packet loss", reportRound(stats.loss.avg, 2), "%", "Protocol loss estimate"],
        ["Maximum packet loss", reportRound(stats.loss.max, 2), "%", "Worst observed packet loss"],
        ["Average RSSI", reportRound(stats.rssi.avg, 2), "dBm", "Closer to 0 is stronger"],
        ["Minimum RSSI", reportRound(stats.rssi.min, 2), "dBm", "Weakest observed signal"],
        ["RSSI standard deviation", reportRound(stats.rssi.std, 2), "dB", "Lower is steadier"],
        ["RSSI p05 / p95", reportText(stats.rssi.p05, 1, " dBm") + " / " + reportText(stats.rssi.p95, 1, " dBm"), "", "5th and 95th percentile"]
      ];
      const procedureRows = [
        {cells:["TEST PLACEMENT GUIDE"], style:2},
        ["Step", "Instruction"],
        [1, getFlashLinkReportPlacementSteps()[0]],
        [2, getFlashLinkReportPlacementSteps()[1]],
        [3, getFlashLinkReportPlacementSteps()[2]],
        [4, "Recommended baseline: first test at 2-5 m line of sight, then repeat at increasing range with the same antenna orientation."],
        [5, "Do not run long high-power tests with antennas disconnected."]
      ];
      const eventRows = [["Time ISO", "Tag", "Message"]];
      for(const e of eventLog.slice(-250)){
        eventRows.push([e.time || "", e.tag || "", e.message || ""]);
      }
      const sampleRows = [[
        "time_s", "time_iso", "status", "role", "origin", "peer",
        "rx_hz", "packet_loss_pct", "rssi_dbm", "rssi_age_ms",
        "linked", "remote_valid", "app_rx_hz", "transport_online"
      ]];
      const baseMs = list.length ? Number(list[0].time) : Date.now();
      for(const sample of list){
        const timeMs = Number(sample.time);
        sampleRows.push([
          reportRound((timeMs - baseMs) / 1000, 3),
          new Date(isFinite(timeMs) ? timeMs : Date.now()).toISOString(),
          sample.operational ? "LINKED" : "OFFLINE",
          String(sample.role || ""),
          dataOriginLabel(sample.origin || "local"),
          String(sample.peer || "--"),
          reportRound(sample.rxHz, 2),
          reportRound(sample.lossPct, 2),
          reportRound(sample.rssiDbm, 1),
          reportRound(sample.rssiAgeMs, 0),
          sample.linked ? 1 : 0,
          sample.remoteValid ? 1 : 0,
          reportRound(sample.appRxHz, 2),
          sample.transportOnline ? 1 : 0
        ]);
      }
      const chartRows = sampleRows.length;
      const hzMax = Math.max(60, Math.ceil(((stats.hz.max == null ? 0 : stats.hz.max) + 5) / 10) * 10);
      const lossMax = Math.max(5, Math.ceil(((stats.loss.max == null ? 0 : stats.loss.max) + 1) / 5) * 5);
      const xMax = stats.durationSec > 0 ? Math.ceil(stats.durationSec / 5) * 5 : 60;
      const xTickSkip = list.length > 12 ? Math.max(1, Math.round(list.length / 12)) : 1;
      const chartConfig = chartRows >= 3 ? {
        sheetName:"SAMPLES",
        startRow:2,
        endRow:chartRows,
        axisTitleX:"time (s)",
        hideXGridlines:true,
        xMajorUnit:5,
        xNumFmt:"0",
        xTickSkip,
        xMin:0,
        xMax,
        xLabelCol:"A",
        chart1:{
          title:"RSSI (dBm)",
          axisYTitle:"dBm",
          majorUnit:10,
          yMin:-110,
          yMax:-20,
          series:[{col:"I", nameCell:"SAMPLES!$I$1", color:"22C55E"}]
        },
        chart2:{
          title:"Packet Loss (%)",
          axisYTitle:"%",
          majorUnit:Math.max(1, Math.ceil(lossMax / 5)),
          yMin:0,
          yMax:lossMax,
          series:[{col:"H", nameCell:"SAMPLES!$H$1", color:"EF4444"}]
        },
        chart3:{
          title:"Receive Hz",
          axisYTitle:"Hz",
          majorUnit:10,
          yMin:0,
          yMax:hzMax,
          series:[{col:"G", nameCell:"SAMPLES!$G$1", color:"3B82F6"}]
        }
      } : null;
      const xlsxBytes = buildXlsxBytes([
        {name:"INFO", rows:infoRows},
        {name:"SUMMARY", rows:summaryRows},
        {name:"SAMPLES", rows:sampleRows},
        {name:"PROCEDURE", rows:procedureRows},
        {name:"EVENT", rows:eventRows}
      ], chartConfig);
      downloadBlobAsFile(
        new Blob([xlsxBytes], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),
        filename
      );
      flashLinkReportState.lastExportName = filename;
      addLogLine("ALTIS INTELLIGENT LINK1 communication report XLSX export: " + filename, "INFO");
      showToast(currentLang === "ko" ? "통신 보고서 내보내기 완료" : "Communication report exported as XLSX.", "success", {key:"flash-link-report"});
    }
    function setDashboardCommunicationNodeState(name, state, statusText, current){
      if(!el.dashboardCommunicationCard) return;
      const node = el.dashboardCommunicationCard.querySelector('[data-dashboard-node="' + name + '"]');
      const status = el.dashboardCommunicationCard.querySelector('[data-dashboard-node-status="' + name + '"]');
      if(node){
        node.classList.remove("is-online", "is-offline", "is-standby", "is-disabled", "is-current");
        node.classList.add("is-" + state);
        node.classList.toggle("is-current", !!current);
      }
      if(status) status.textContent = statusText;
    }
    function setDashboardCommunicationLinkState(name, state){
      if(!el.dashboardCommunicationCard) return;
      el.dashboardCommunicationCard.querySelectorAll(
        '[data-dashboard-link="' + name + '"],[data-dashboard-link-label="' + name + '"]'
      ).forEach((link)=>{
        link.classList.remove("is-online", "is-offline", "is-standby");
        link.classList.add("is-" + state);
        if(link.dataset.dashboardLinkLabel){
          if(state === "online" && link.dataset.labelOnline){
            link.textContent = link.dataset.labelOnline;
          }else if(state === "standby" && link.dataset.labelStandby){
            link.textContent = link.dataset.labelStandby;
          }
        }
      });
    }
    function getDashboardStageLinkSnapshot(stageId){
      const id = Number(stageId) === 2 ? 2 : 1;
      const state = stageTelemetryStore[id];
      const data = state && state.data ? state.data : {};
      let rxHz = readFirstFiniteLinkMetric(
        data.stage_rx_hz, data.fl_rx_hz, data.flash_link_rx_hz
      );
      let lossPermille = readFirstFiniteLinkMetric(
        data.stage_loss_permille, data.fl_loss_permille, data.flash_link_loss_permille
      );
      let rssiDbm = readFirstFiniteLinkMetric(
        data.stage_rssi_dbm, data.fl_rssi_dbm, data.flash_link_rssi_dbm
      );
      let rssiAgeMs = readFirstFiniteLinkMetric(
        data.stage_rssi_age_ms, data.fl_rssi_age_ms, data.flash_link_rssi_age_ms
      );
      if(flashLinkUiTargetNodeId === id){
        if(!isFinite(rxHz)) rxHz = flashLinkUiRxHz;
        if(!isFinite(lossPermille)) lossPermille = flashLinkUiLossPermille;
        if(!isFinite(rssiDbm) || rssiDbm <= -126){
          rssiDbm = flashLinkUiRssiDbm;
          rssiAgeMs = flashLinkUiRssiValid ? 0 : 4294967295;
        }
      }
      // Stage 2 normally reaches the ground through stage 1. Older ground
      // builds can expose the relayed stage-2 RX rate before they populate the
      // stage-2 RSSI tail fields. In that route the ground-facing physical hop
      // is the same stage-1 link, so use its fresh RSSI rather than leaving the
      // entire stage-2 chart blank. Direct stage-2 operation never uses this
      // fallback.
      if(id === 2 && flashLinkStage2Route === "relay" &&
         (!isFinite(rssiDbm) || rssiDbm <= -126 ||
          (isFinite(rssiAgeMs) && rssiAgeMs > 6000))){
        const relayRoute = getDashboardStageLinkSnapshot(1);
        if(relayRoute.rssiValid){
          rssiDbm = relayRoute.rssiDbm;
          rssiAgeMs = 0;
        }
      }
      const available = !!(
        (state && state.valid) ||
        (flashLinkUiTargetNodeId === id && flashLinkUiHasStatus)
      );
      return {
        available,
        rxHz:isFinite(rxHz) ? Math.max(0, rxHz) : NaN,
        lossPermille:isFinite(lossPermille) ? Math.max(0, lossPermille) : NaN,
        rssiDbm,
        rssiValid:available && isFinite(rssiDbm) && rssiDbm > -126 &&
          (!isFinite(rssiAgeMs) || rssiAgeMs <= 6000)
      };
    }
    function syncDashboardStageLinkMetrics(stageId, enabled){
      const id = Number(stageId) === 2 ? 2 : 1;
      const snapshot = enabled
        ? getDashboardStageLinkSnapshot(id)
        : {available:false, rxHz:NaN, lossPermille:NaN, rssiDbm:NaN, rssiValid:false};
      if(enabled && snapshot.available){
        recordDashboardStageLinkChartSample(id, {
          stage_rssi_dbm:snapshot.rssiValid ? snapshot.rssiDbm : null,
          stage_rssi_age_ms:snapshot.rssiValid ? 0 : null,
          stage_loss_permille:snapshot.lossPermille,
          stage_rx_hz:snapshot.rxHz
        });
      }
      const rssiEl = id === 1
        ? el.dashboardStage1CommunicationRssi
        : el.dashboardStage2CommunicationRssi;
      const lossEl = id === 1
        ? el.dashboardStage1CommunicationLoss
        : el.dashboardStage2CommunicationLoss;
      const rateEl = id === 1
        ? el.dashboardStage1CommunicationRate
        : el.dashboardStage2CommunicationRate;
      if(rssiEl){
        rssiEl.textContent = snapshot.rssiValid
          ? String(Math.round(snapshot.rssiDbm))
          : "--";
      }
      if(lossEl){
        lossEl.textContent = snapshot.available && isFinite(snapshot.lossPermille)
          ? (snapshot.lossPermille / 10).toFixed(1)
          : "--";
      }
      if(rateEl){
        rateEl.textContent = snapshot.available && isFinite(snapshot.rxHz)
          ? String(Math.round(snapshot.rxHz))
          : "--";
      }
    }
    function syncDashboardCommunicationUi(){
      if(!el.dashboardCommunicationCard) return;
      const flashLinkEnabled = getSettingsOperationModeValue() === "flash_link";
      const transportOnline = !!(connOk || wsConnected || serialConnected);
      const mobileClient = !!(
        isMobileLayout() ||
        (window.matchMedia && window.matchMedia("(max-width: 700px) and (pointer: coarse)").matches)
      );
      const roleNode1 = flashLinkUiRole === "avionics" && flashLinkUiNodeId === 1;
      const roleNode2 = flashLinkUiRole === "avionics" && flashLinkUiNodeId === 2;
      const stage2ModeEnabled = flashLinkUiHasStatus
        ? !!flashLinkUiStage2Mode
        : !!(uiSettings && uiSettings.flashLinkStage2Mode);
      const groundLinked = flashLinkUiRole === "ground" && flashLinkUiLinked;
      const stage1Online = flashLinkEnabled && (
        flashLinkStage1Connected ||
        (roleNode1 && (flashLinkUiLinked || transportOnline)) ||
        (groundLinked && flashLinkUiTargetNodeId === 1)
      );
      const connectedStage2 = flashLinkStage2Connected ||
        (roleNode2 && flashLinkUiLinked) ||
        (flashLinkUiRole === "ground" && flashLinkUiTargetNodeId === 2 && flashLinkUiRemoteValid);
      const stage2Online = flashLinkEnabled && stage2ModeEnabled && connectedStage2;
      const directRoute = stage2Online && flashLinkStage2Route === "direct";
      const relayRoute = stage2Online && !directRoute && stage1Online;
      const directRouteAvailable = stage2Online;
      const groundOnline = transportOnline;
      const mobileOnline = groundOnline && mobileClient && !serialConnected;
      const pcOnline = groundOnline && (!mobileClient || serialConnected);
      const currentClient = mobileClient && !serialConnected ? "mobile" : "pc";

      setDashboardCommunicationNodeState(
        "stage2",
        !stage2ModeEnabled ? "disabled" : (stage2Online ? "online" : "offline"),
        !stage2ModeEnabled
          ? "DISABLED"
          : (stage2Online ? (directRoute ? "DIRECT" : "RELAY") : "OFFLINE"),
        false
      );
      setDashboardCommunicationNodeState("stage1", stage1Online ? "online" : "offline", stage1Online ? "LINKED" : "OFFLINE", false);
      setDashboardCommunicationNodeState("ground", groundOnline ? "online" : "offline", groundOnline ? "ONLINE" : "WAITING", false);
      setDashboardCommunicationNodeState("mobile", mobileOnline ? "online" : "standby", mobileOnline ? "CONNECTED" : "STANDBY", currentClient === "mobile");
      setDashboardCommunicationNodeState("pc", pcOnline ? "online" : "standby", pcOnline ? "CONNECTED" : "STANDBY", currentClient === "pc");

      setDashboardCommunicationLinkState("stage2-stage1", relayRoute ? "online" : (stage2ModeEnabled ? "standby" : "offline"));
      setDashboardCommunicationLinkState(
        "stage2-ground",
        directRoute ? "online" : (directRouteAvailable ? "standby" : "offline")
      );
      setDashboardCommunicationLinkState("stage1-ground", stage1Online && groundOnline ? "online" : "offline");
      setDashboardCommunicationLinkState("ground-mobile", mobileOnline ? "online" : "standby");
      setDashboardCommunicationLinkState("ground-pc", pcOnline ? "online" : "standby");

      if(el.dashboardCommunicationRoute){
        el.dashboardCommunicationRoute.textContent = stage2ModeEnabled
          ? (directRoute ? "2단 직통 백업 경로" : "1단 중계 우선 경로")
          : "1단 전용 · 100 Hz";
      }
      if(el.dashboardCommunicationPeer){
        el.dashboardCommunicationPeer.textContent = "PEER  " + (flashLinkUiPeer || "--");
      }
      syncDashboardStageLinkMetrics(1, true);
      syncDashboardStageLinkMetrics(2, stage2ModeEnabled);
    }
    function setFlashTopologyNodeState(name, online, statusText, current){
      if(!el.flashLinkTopologyOverlay) return;
      const node = el.flashLinkTopologyOverlay.querySelector('[data-topology-node="' + name + '"]');
      const status = el.flashLinkTopologyOverlay.querySelector('[data-topology-status="' + name + '"]');
      if(node){
        node.classList.toggle("is-online", !!online);
        node.classList.toggle("is-offline", !online);
        node.classList.toggle("is-current", !!current);
      }
      if(status) status.textContent = statusText;
    }
    function setFlashTopologyLinkState(name, online){
      if(!el.flashLinkTopologyOverlay) return;
      el.flashLinkTopologyOverlay.querySelectorAll('[data-topology-link="' + name + '"]').forEach((link)=>{
        link.classList.toggle("is-online", !!online);
        link.classList.toggle("is-offline", !online);
      });
    }
    function syncFlashLinkTopologyUi(){
      syncDashboardCommunicationUi();
      if(!el.flashLinkTopologyOverlay) return;
      const flashLinkEnabled = getSettingsOperationModeValue() === "flash_link";
      const transportOnline = !!(connOk || wsConnected || serialConnected);
      const mobileClient = !!(
        isMobileLayout() ||
        (window.matchMedia && window.matchMedia("(max-width: 700px) and (pointer: coarse)").matches)
      );
      const roleNode1 = flashLinkUiRole === "avionics" && flashLinkUiNodeId === 1;
      const roleNode2 = flashLinkUiRole === "avionics" && flashLinkUiNodeId === 2;
      const stage2ModeEnabled = flashLinkUiHasStatus
        ? !!flashLinkUiStage2Mode
        : !!(uiSettings && uiSettings.flashLinkStage2Mode);
      if(el.flashTopologyModeDescription){
        el.flashTopologyModeDescription.textContent = stage2ModeEnabled
          ? "1단 중계 우선 · 링크 단절 시 2단 직통 백업 자동 전환"
          : "1단 전용 · 100Hz 저지연 텔레메트리";
      }
      if(el.flashTopologyStage1Role){
        el.flashTopologyStage1Role.textContent = stage2ModeEnabled
          ? "RELAY + FLIGHT"
          : "PRIMARY FLIGHT · 100Hz";
      }
      const groundLinked = flashLinkUiRole === "ground" && flashLinkUiLinked;
      const stage1Online = flashLinkEnabled && (
        flashLinkStage1Connected ||
        (roleNode1 && (flashLinkUiLinked || transportOnline)) ||
        (groundLinked && flashLinkUiTargetNodeId === 1)
      );
      const connectedStage2 = flashLinkStage2Connected ||
        (roleNode2 && flashLinkUiLinked) ||
        (flashLinkUiRole === "ground" && flashLinkUiTargetNodeId === 2 && flashLinkUiRemoteValid);
      const stage2Online = flashLinkEnabled && stage2ModeEnabled && connectedStage2;
      const directRoute = stage2Online && flashLinkStage2Route === "direct";
      const relayRoute = stage2Online && !directRoute && stage1Online;
      const groundOnline = transportOnline;
      const mobileOnline = groundOnline && mobileClient && !serialConnected;
      const pcOnline = groundOnline && (!mobileClient || serialConnected);
      const currentClient = mobileClient && !serialConnected ? "mobile" : "pc";

      setFlashTopologyNodeState(
        "stage2",
        stage2Online,
        !stage2ModeEnabled
          ? "DISABLED"
          : (stage2Online ? (directRoute ? "DIRECT BACKUP" : "RELAY LINK") : "OFFLINE"),
        false);
      const stage2Node = el.flashLinkTopologyOverlay.querySelector('[data-topology-node="stage2"]');
      if(stage2Node) stage2Node.classList.toggle("is-mode-disabled", !stage2ModeEnabled);
      setFlashTopologyNodeState("stage1", stage1Online, stage1Online ? "LINKED" : "OFFLINE", false);
      setFlashTopologyNodeState("ground", groundOnline, groundOnline ? "ONLINE" : "WAITING", false);
      setFlashTopologyNodeState("mobile", mobileOnline, mobileOnline ? "CONNECTED" : "STANDBY", currentClient === "mobile");
      setFlashTopologyNodeState("pc", pcOnline, pcOnline ? "CONNECTED" : "STANDBY", currentClient === "pc");

      setFlashTopologyLinkState("stage2-stage1", relayRoute);
      setFlashTopologyLinkState("stage2-ground", directRoute);
      setFlashTopologyLinkState("stage1-ground", stage1Online && groundOnline);
      setFlashTopologyLinkState("ground-mobile", mobileOnline);
      setFlashTopologyLinkState("ground-pc", pcOnline);

      const activeClientOnline = currentClient === "mobile" ? mobileOnline : pcOnline;
      const allOnline = stage1Online && (!stage2ModeEnabled || stage2Online) &&
        groundOnline && activeClientOnline;
      if(el.flashTopologyOverall){
        el.flashTopologyOverall.classList.toggle("is-online", allOnline);
        el.flashTopologyOverall.classList.toggle("is-degraded", !allOnline && groundOnline);
        el.flashTopologyOverall.textContent = allOnline
          ? (stage2ModeEnabled
              ? "LINK STATUS · ALL LINKS NOMINAL"
              : "LINK STATUS · STAGE 1 100Hz NOMINAL")
          : stage1Online && groundOnline
          ? (stage2ModeEnabled
              ? "LINK STATUS · STAGE 1 LINKED / STAGE 2 OFFLINE"
              : "LINK STATUS · STAGE 1 LINKED · 100Hz MODE")
          : groundOnline
          ? "LINK STATUS · GROUND ONLINE / VEHICLE OFFLINE"
          : "LINK STATUS · WAITING";
      }
      if(el.flashTopologyRate){
        el.flashTopologyRate.textContent = flashLinkUiHasStatus ? Math.round(flashLinkUiRxHz) + " Hz" : "-- Hz";
      }
      if(el.flashTopologyLoss){
        el.flashTopologyLoss.textContent = flashLinkUiHasStatus ? (flashLinkUiLossPermille / 10).toFixed(1) + "%" : "--";
      }
      if(el.flashTopologyRssi){
        el.flashTopologyRssi.textContent = flashLinkUiRssiValid
          ? Math.round(flashLinkUiRssiDbm) + " dBm"
          : "-- dBm";
      }
      if(el.flashTopologyPeer) el.flashTopologyPeer.textContent = flashLinkUiPeer || "--";
    }
    function showFlashLinkTopologyOverlay(){
      if(!el.flashLinkTopologyOverlay) return;
      if(el.settingsOverlay && !el.settingsOverlay.classList.contains("hidden")) hideSettings();
      syncFlashLinkTopologyUi();
      setOverlayVisible(el.flashLinkTopologyOverlay, true);
      requestAnimationFrame(()=>{
        if(el.flashLinkTopologyClose) el.flashLinkTopologyClose.focus({preventScroll:true});
      });
    }
    function hideFlashLinkTopologyOverlay(){
      setOverlayVisible(el.flashLinkTopologyOverlay, false);
    }
    function updateFlashLinkStatusUi(data, renderUi){
      const src = data || {};
      const shouldRender = renderUi !== false;
      const flashLinkEnabled = getSettingsOperationModeValue() === "flash_link";
      const linked = Number(src.fl_link ?? src.flash_link_connected ?? 0) !== 0;
      const remoteValid = Number(src.fl_remote_valid ?? src.flash_link_remote_valid ?? 0) !== 0;
      const rxHz = Number(src.fl_rx_hz ?? src.flash_link_rx_hz);
      const lossPermille = Number(src.fl_loss_permille ?? src.flash_link_loss_permille);
      const rssiDbm = Number(src.fl_rssi_dbm ?? src.flash_link_rssi_dbm);
      const rssiAgeMs = Number(src.fl_rssi_age_ms ?? src.flash_link_rssi_age_ms);
      const peer = String(src.fl_peer ?? src.flash_link_peer ?? "").trim();
      const stage2ModeRaw = src.fl_stage2_mode ?? src.flash_link_stage2_mode;
      const stage2ModeEnabled = stage2ModeRaw == null
        ? !!(uiSettings && uiSettings.flashLinkStage2Mode)
        : Number(stage2ModeRaw) !== 0;
      const nodeId = normalizeFlashLinkNodeId(src.fl_node ?? src.flash_link_node_id ?? (uiSettings && uiSettings.flashLinkNodeId));
      const targetNodeId = normalizeFlashLinkNodeId(src.fl_target ?? src.flash_link_target_node_id ?? (uiSettings && uiSettings.flashLinkTargetNodeId));
      const stage1Linked = Number(src.fl_stage1 ?? src.flash_link_stage1_connected ?? 0) !== 0;
      const stage2Linked = Number(src.fl_stage2 ?? src.flash_link_stage2_connected ?? 0) !== 0;
      const stage2RouteRaw = src.fl_stage2_route ?? src.flash_link_stage2_route ?? null;
      const stage2DirectRaw = src.fl_stage2_direct ?? src.flash_link_stage2_direct_connected ?? null;
      const stage2RelayRaw = src.fl_stage2_relay ?? src.flash_link_stage2_relay_connected ?? null;
      const wasOperational = flashLinkUiLinked &&
        (flashLinkUiRemoteValid || flashLinkUiRole === "avionics");
      flashLinkUiRole = normalizeFlashLinkRole(
        src.flash_link_role ?? src.fl_role ?? (uiSettings && uiSettings.flashLinkRole)
      );
      flashLinkUiHasStatus = true;
      flashLinkUiLinked = linked;
      flashLinkUiRemoteValid = remoteValid;
      flashLinkUiRxHz = isFinite(rxHz) ? Math.max(0, rxHz) : 0;
      flashLinkUiLossPermille = isFinite(lossPermille) ? Math.max(0, lossPermille) : 0;
      flashLinkUiNodeId = nodeId;
      flashLinkUiTargetNodeId = targetNodeId;
      flashLinkUiStage2Mode = stage2ModeEnabled;
      flashLinkStage1Connected = stage1Linked;
      flashLinkStage2Connected = stage2ModeEnabled && stage2Linked;
      if(stage2RouteRaw != null){
        const route = String(stage2RouteRaw).trim().toLowerCase();
        flashLinkStage2Route = route === "direct" ? "direct" : (route === "relay" ? "relay" : "offline");
      }
      if(stage2DirectRaw != null) flashLinkStage2DirectConnected = Number(stage2DirectRaw) !== 0;
      if(stage2RelayRaw != null) flashLinkStage2RelayConnected = Number(stage2RelayRaw) !== 0;
      if(stage2RouteRaw == null && (stage2DirectRaw != null || stage2RelayRaw != null)){
        flashLinkStage2Route = flashLinkStage2RelayConnected
          ? "relay"
          : (flashLinkStage2DirectConnected ? "direct" : "offline");
      }
      if(!stage2ModeEnabled){
        flashLinkStage2Route = "offline";
        flashLinkStage2DirectConnected = false;
        flashLinkStage2RelayConnected = false;
      }
      if(uiSettings){
        if(document.activeElement !== el.flashLinkNodeSelect) uiSettings.flashLinkNodeId = nodeId;
        uiSettings.flashLinkTargetNodeId = targetNodeId;
        if(document.activeElement !== el.flashLinkStage2ModePill){
          uiSettings.flashLinkStage2Mode = stage2ModeEnabled;
        }
      }
      const avionicsRole = flashLinkUiRole === "avionics";
      const operational = linked && (remoteValid || avionicsRole);
      if(shouldRender){
        if(el.flashLinkNodeSelect && document.activeElement !== el.flashLinkNodeSelect){
          el.flashLinkNodeSelect.value = String(nodeId);
        }
        if(el.flashLinkStageStatus){
          const stage1 = el.flashLinkStageStatus.querySelector('[data-stage-link="1"]');
          const stage2 = el.flashLinkStageStatus.querySelector('[data-stage-link="2"]');
          if(stage1){
            stage1.classList.toggle("is-linked", stage1Linked);
            stage1.textContent = (currentLang === "ko" ? "1단 " : "S1 ") + (stage1Linked ? "LINK" : "--");
          }
          if(stage2){
            stage2.classList.toggle("is-linked", stage2ModeEnabled && stage2Linked);
            stage2.textContent = !stage2ModeEnabled
              ? (currentLang === "ko" ? "2단 사용 안 함" : "S2 DISABLED")
              : (currentLang === "ko" ? "2단 " : "S2 ") + (stage2Linked ? "LINK" : "--");
          }
        }
        if(el.flashLinkStatus){
          el.flashLinkStatus.classList.toggle("is-linked", operational);
        }
        if(el.flashLinkStatusText){
          el.flashLinkStatusText.textContent = !flashLinkEnabled
            ? "OFF"
            : operational
            ? "LINKED"
            : "OFFLINE";
        }
        if(el.flashLinkRate){
          el.flashLinkRate.textContent = isFinite(rxHz) ? (Math.max(0, Math.round(rxHz)) + " Hz") : "-- Hz";
        }
        if(el.flashLinkLoss){
          el.flashLinkLoss.textContent = isFinite(lossPermille)
            ? ((Math.max(0, lossPermille) / 10).toFixed(1) + "%")
            : "--";
        }
      }
      const rssiValid = isFinite(rssiDbm) && rssiDbm > -126 &&
        (!isFinite(rssiAgeMs) || rssiAgeMs <= 6000);
      flashLinkUiRssiDbm = rssiDbm;
      flashLinkUiRssiValid = rssiValid;
      flashLinkUiPeer = peer && peer !== "--" ? peer : "--";
      if(shouldRender && el.flashLinkRssi){
        el.flashLinkRssi.textContent = rssiValid
          ? (Math.round(rssiDbm) + " dBm")
          : "-- dBm";
      }
      if(flashLinkEnabled){
        recordFlashLinkChartSample({
          rssi:rssiValid ? rssiDbm : null,
          loss:isFinite(lossPermille) ? (Math.max(0, lossPermille) / 10) : null,
          hz:isFinite(rxHz) ? Math.max(0, rxHz) : null
        });
        recordDashboardStageLinkChartSample(
          flashLinkUiRole === "ground" ? targetNodeId : nodeId,
          src
        );
      }
      recordFlashLinkReportSample({
        role:flashLinkUiRole,
        stage2Mode:stage2ModeEnabled,
        linked,
        remoteValid,
        operational,
        rxHz:isFinite(rxHz) ? Math.max(0, rxHz) : null,
        lossPct:isFinite(lossPermille) ? (Math.max(0, lossPermille) / 10) : null,
        rssiDbm:rssiValid ? rssiDbm : null,
        rssiAgeMs:isFinite(rssiAgeMs) ? Math.max(0, rssiAgeMs) : null,
        peer:peer && peer !== "--" ? peer : "--",
        origin:normalizeDataOrigin(src),
        appRxHz:isFinite(Number(rxHzWindow)) ? Math.max(0, Number(rxHzWindow)) : null,
        transportOnline:!!(connOk || linked)
      });
      if(!shouldRender) return;
      if(el.flashLinkPeer){
        el.flashLinkPeer.textContent = peer && peer !== "--" ? peer : "--";
      }
      if(el.flashLinkCommandStatus){
        const pending = Math.max(0, Number(src.fl_cmd_pending) || 0);
        const acked = Math.max(0, Number(src.fl_cmd_acked) || 0);
        const failed = Math.max(0, Number(src.fl_cmd_failed) || 0);
        const code = Math.max(0, Number(src.fl_cmd_last_code) || 0);
        const result = Math.max(0, Number(src.fl_cmd_last_result) || 0);
        const resultKo = ["ACK", "안전모드 거부", "처리 불가", "인자 오류", "미지원", "ARM 위험", "권한 없음"];
        const resultEn = ["ACK", "Denied: safety", "Busy", "Invalid argument", "Unsupported", "ARM unsafe", "Permission denied"];
        if(pending > 0){
          el.flashLinkCommandStatus.textContent =
            (currentLang === "ko" ? "전송 중 " : "Sending ") + pending;
        }else if(code > 0 && acked > 0){
          const labels = currentLang === "ko" ? resultKo : resultEn;
          el.flashLinkCommandStatus.textContent =
            (labels[result] || ("ERR " + result)) + " · CMD " + code;
        }else if(failed > 0){
          el.flashLinkCommandStatus.textContent =
            (currentLang === "ko" ? "전송 실패 " : "Failed ") + failed;
        }else{
          el.flashLinkCommandStatus.textContent = "--";
        }
        if(code === 27 && pending === 0 && acked > 0){
          const ackKey = code + ":" + result + ":" + acked + ":" + failed;
          if(ackKey !== lastMissionStandbyAckKey){
            lastMissionStandbyAckKey = ackKey;
            if(result === 5){
              userWaitingLocal = false;
              missionStandbyUiActive = false;
              enforceMissionStandbySafety([]);
            }else if(result !== 0){
              userWaitingLocal = false;
              missionStandbyUiActive = false;
              updateMissionStandbyButtonUi();
              showToast("미션 대기 거부: " + (resultKo[result] || ("ERR " + result)), "error", {
                key:"mission-standby-remote-rejected",
                duration:4500
              });
            }
          }
        }
      }
      if(wasOperational !== operational){
        updateMotorInfoPanel();
      }
      syncMobileBoardHeader();
      syncWelcomeConnectScreen(isVerifiedBoardTransportConnected());
      syncFlashLinkTopologyUi();
    }
    function syncDaqSequencePyroChannelToBoard(logIt){
      const channel = normalizePyroChannel(uiSettings && uiSettings.daqSequencePyroChannel, 1);
      sendCommand({http:"/set?daq_seq_pyro=" + channel, ser:"/set?daq_seq_pyro=" + channel}, !!logIt);
    }
    function getStatusMapMarkerMeta(){
      const mode = getStatusMapPopupMode();
      const kind = (mode === "flight") ? "VEHICLE" : "MOTOR";
      const mission = getStatusMapMissionName();
      const modeLabel = (mode === "flight") ? "FLIGHT" : "DAQ";
      return {modeLabel, kind, mission};
    }
    function buildStatusMapRocketHtml(){
      const meta = getStatusMapMarkerMeta();
      return "<button class=\"status-map-rocket-pill\" type=\"button\" aria-expanded=\"false\" tabindex=\"-1\">" +
        "<span class=\"status-map-rocket-circle\"><span class=\"emoji\">🚀</span><span class=\"status-map-info-icon\">i</span></span>" +
        "<span class=\"status-map-rocket-meta\">" +
          "<span class=\"status-map-rocket-kicker\">" + escapeStatusMapPopupText(meta.modeLabel) + "</span>" +
          "<span class=\"status-map-rocket-title\">" + escapeStatusMapPopupText(meta.kind) + "</span>" +
          "<span class=\"status-map-rocket-mission\">" + escapeStatusMapPopupText(meta.mission) + "</span>" +
        "</span>" +
      "</button>";
    }
    function refreshStatusMapMarkerContent(){
      if(!statusMapState.marker || !statusMapState.marker.getElement) return;
      const markerEl = statusMapState.marker.getElement();
      if(!markerEl) return;
      const meta = getStatusMapMarkerMeta();
      const kicker = markerEl.querySelector(".status-map-rocket-kicker");
      const title = markerEl.querySelector(".status-map-rocket-title");
      const mission = markerEl.querySelector(".status-map-rocket-mission");
      if(kicker) kicker.textContent = meta.modeLabel;
      if(title) title.textContent = meta.kind;
      if(mission) mission.textContent = meta.mission;
    }
    function setStatusMapMarkerExpanded(expanded){
      statusMapState.markerExpanded = !!expanded;
      if(!statusMapState.marker || !statusMapState.marker.getElement) return;
      const markerEl = statusMapState.marker.getElement();
      if(!markerEl) return;
      const pill = markerEl.querySelector(".status-map-rocket-pill");
      if(!pill) return;
      pill.classList.toggle("is-expanded", statusMapState.markerExpanded);
      pill.setAttribute("aria-expanded", statusMapState.markerExpanded ? "true" : "false");
      refreshStatusMapMarkerContent();
    }
    function statusMapSetMarker(lat, lon, opt){
      const latNum = Number(lat);
      const lonNum = Number(lon);
      if(!isFinite(latNum) || !isFinite(lonNum)) return;
      const clamped = clampStatusMapToKorea(latNum, lonNum);
      statusMapState.lat = clamped.lat;
      statusMapState.lon = clamped.lon;
      if(gyroPathState.originLat == null &&
         (!latestTelemetryGeo ||
          !isFinite(Number(latestTelemetryGeo.lat)) ||
          !isFinite(Number(latestTelemetryGeo.lon)))){
        ensureGyroTerrainForGeo(clamped);
      }
      if(statusMapState.marker){
        statusMapState.marker.setLatLng([clamped.lat, clamped.lon]);
      }
      updateStatusMapOfflineMarker();
      if(opt && opt.recenter && statusMapState.map){
        const zoomVal = isFinite(Number(opt.zoom)) ? Number(opt.zoom) : statusMapState.map.getZoom();
        statusMapState.map.setView([clamped.lat, clamped.lon], zoomVal, {animate:false});
      }
      updateStatusMapHud();
    }
    async function copyTextSafe(text){
      if(!text) return false;
      try{
        if(navigator.clipboard && window.isSecureContext){
          await navigator.clipboard.writeText(text);
          return true;
        }
      }catch(e){}
      try{
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return !!ok;
      }catch(e){
        return false;
      }
    }
    function extractTelemetryGeo(data, opt){
      if(!data || typeof data !== "object") return null;
      const gps = (data.gps && typeof data.gps === "object") ? data.gps : null;
      const latRaw = data.gps_lat ?? data.gpsLat ?? data.gpsLatitude ?? data.nav_lat ?? data.lat ?? data.latitude ?? data.glat ??
        (gps ? (gps.lat ?? gps.latitude ?? gps.glat ?? null) : null);
      const lonRaw = data.gps_lon ?? data.gps_lng ?? data.gpsLon ?? data.gpsLng ?? data.gpsLongitude ?? data.nav_lon ?? data.nav_lng ??
        data.lon ?? data.lng ?? data.longitude ?? data.glon ?? (gps ? (gps.lon ?? gps.lng ?? gps.longitude ?? gps.glon ?? null) : null);
      const latNum = Number(latRaw);
      const lonNum = Number(lonRaw);
      if(!isFinite(latNum) || !isFinite(lonNum)) return null;
      if(Math.abs(latNum) > 90 || Math.abs(lonNum) > 180) return null;
      if(Math.abs(latNum) < 1e-7 && Math.abs(lonNum) < 1e-7) return null;
      if(opt && opt.koreaOnly && !isStatusMapInKorea(latNum, lonNum)) return null;
      const altRaw = data.gps_alt ?? data.gpsAlt ?? data.gpsAltitude ?? data.nav_alt ?? data.alt ?? data.altitude ?? data.galt ??
        (gps ? (gps.alt ?? gps.altitude ?? gps.galt ?? null) : null);
      const altNum = Number(altRaw);
      return {
        lat: latNum,
        lon: lonNum,
        alt: isFinite(altNum) ? altNum : NaN
      };
    }
    function extractTelemetryLatLon(data){
      const geo = extractTelemetryGeo(data, {koreaOnly:false});
      if(!geo) return null;
      return {lat:geo.lat, lon:geo.lon};
    }
    function updateStatusMapFromTelemetry(data){
      const pos = extractTelemetryLatLon(data);
      if(!pos) return;
      const now = Date.now();
      if((now - statusMapState.lastUpdateMs) < 700 && statusMapState.hasLiveFix) return;
      statusMapState.lastUpdateMs = now;
      const shouldRecenter = !isStatusMapViewportExpanded() || !statusMapState.hasLiveFix;
      statusMapState.hasLiveFix = true;
      statusMapSetMarker(pos.lat, pos.lon, {recenter: shouldRecenter});
    }
    function getLatestIntelligentCalibrationGeo(){
      const telemetry = latestTelemetry || {};
      const cachedGeo = latestTelemetryGeo && (!latestTelemetryGeo.ts || (Date.now() - latestTelemetryGeo.ts) < 30000)
        ? latestTelemetryGeo
        : null;
      return extractTelemetryGeo(telemetry, {koreaOnly:false}) || cachedGeo;
    }
    function scheduleIntelligentCalibrationMapRefresh(){
      if(intelligentCalibrationMapState.refreshTimers.length){
        intelligentCalibrationMapState.refreshTimers.forEach(timer=>clearTimeout(timer));
      }
      intelligentCalibrationMapState.refreshTimers = [40, 140, 320, 720, 1200, 2000].map(delay=>setTimeout(()=>{
        if(intelligentCalibrationMapState.map && typeof intelligentCalibrationMapState.map.invalidateSize === "function"){
          try{
            intelligentCalibrationMapState.map.invalidateSize(false);
            if(isFinite(Number(intelligentCalibrationMapState.lastLat)) && isFinite(Number(intelligentCalibrationMapState.lastLon))){
              intelligentCalibrationMapState.map.setView(
                [Number(intelligentCalibrationMapState.lastLat), Number(intelligentCalibrationMapState.lastLon)],
                intelligentCalibrationMapState.map.getZoom() || 15,
                {animate:false}
              );
            }
          }catch(_e){}
        }
      }, delay));
    }
    function isIntelligentCalibrationOverlayOpen(){
      return !!(
        el.intelligentCalibrationOverlay &&
        !el.intelligentCalibrationOverlay.classList.contains("hidden") &&
        el.intelligentCalibrationOverlay.style.display !== "none"
      );
    }
    function getIntelligentCalibrationTileSources(){
      return [
        Object.freeze({
          id: "carto",
          url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          subdomains: "abcd"
        }),
        Object.freeze({
          id: "osm",
          url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        }),
        Object.freeze({id:"local-relative", url:"tiles/{z}/{x}/{y}.png"}),
        Object.freeze({id:"local-root", url:"/tiles/{z}/{x}/{y}.png"})
      ];
    }
    function setIntelligentCalibrationTileNotice(text, visible){
      if(!el.intelligentCalibrationMapEmpty) return;
      if(text) el.intelligentCalibrationMapEmpty.textContent = text;
      el.intelligentCalibrationMapEmpty.classList.toggle("is-hidden", !visible);
    }
    function attachIntelligentCalibrationTileLayer(map, sourceIndex){
      if(!map || typeof window.L === "undefined") return false;
      const sources = getIntelligentCalibrationTileSources();
      const source = sources[sourceIndex];
      if(!source) return false;
      if(intelligentCalibrationMapState.tileFallbackTimer){
        clearTimeout(intelligentCalibrationMapState.tileFallbackTimer);
        intelligentCalibrationMapState.tileFallbackTimer = null;
      }
      if(intelligentCalibrationMapState.tileLayer){
        try{
          const oldLayer = intelligentCalibrationMapState.tileLayer;
          intelligentCalibrationMapState.tileLayer = null;
          oldLayer.off();
          requestAnimationFrame(()=>{ try{ oldLayer.remove(); }catch(_e){} });
        }catch(_e){}
      }
      intelligentCalibrationMapState.tileSourceIndex = sourceIndex;
      intelligentCalibrationMapState.tileLoadCount = 0;
      intelligentCalibrationMapState.tileErrorCount = 0;
      const opt = {noWrap:true, minZoom:3, maxZoom:19, attribution:""};
      if(source.subdomains) opt.subdomains = source.subdomains;
      const layer = window.L.tileLayer(source.url, opt);
      const tryNext = ()=>{
        if(intelligentCalibrationMapState.tileLoadCount > 0) return;
        const nextIndex = sourceIndex + 1;
        if(nextIndex < sources.length){
          attachIntelligentCalibrationTileLayer(map, nextIndex);
          return;
        }
        setIntelligentCalibrationTileNotice("지도 배경을 불러오지 못했습니다. 좌표는 수신 중입니다.", true);
      };
      layer.on("tileload", ()=>{
        intelligentCalibrationMapState.tileLoadCount += 1;
        setIntelligentCalibrationTileNotice("", false);
      });
      layer.on("tileerror", ()=>{
        intelligentCalibrationMapState.tileErrorCount += 1;
        if(intelligentCalibrationMapState.tileErrorCount >= 2){
          tryNext();
        }
      });
      layer.on("load", ()=>{
        if(intelligentCalibrationMapState.tileLoadCount === 0) tryNext();
      });
      layer.addTo(map);
      intelligentCalibrationMapState.tileLayer = layer;
      setIntelligentCalibrationTileNotice("지도 타일 로딩중…", true);
      intelligentCalibrationMapState.tileFallbackTimer = setTimeout(tryNext, 1400);
      return true;
    }
    function initIntelligentCalibrationMap(){
      if(!el.intelligentCalibrationMap) return false;
      ensureStatusMapLeafletCss();
      if(statusMapState.leafletLoadFailed) return false;
      if(typeof window.L === "undefined"){
        tryLoadStatusMapLeafletScript();
        return false;
      }
      patchStatusMapLeafletSafety();
      if(intelligentCalibrationMapState.map) return true;
      const map = window.L.map(el.intelligentCalibrationMap, {
        zoomControl:false,
        attributionControl:false,
        minZoom:3,
        maxZoom:19,
        fadeAnimation:false,
        zoomAnimation:false,
        markerZoomAnimation:false
      }).setView([STATUS_MAP_DEFAULT.lat, STATUS_MAP_DEFAULT.lon], STATUS_MAP_DEFAULT.zoom);
      attachIntelligentCalibrationTileLayer(map, 0);
      const markerIcon = window.L.divIcon({
        className: "",
        html: "<div class=\"intelligent-calibration-marker\"></div>",
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
      intelligentCalibrationMapState.marker = window.L.marker([STATUS_MAP_DEFAULT.lat, STATUS_MAP_DEFAULT.lon], {icon:markerIcon}).addTo(map);
      intelligentCalibrationMapState.map = map;
      scheduleIntelligentCalibrationMapRefresh();
      return true;
    }
    function updateIntelligentCalibrationMap(){
      const geo = getLatestIntelligentCalibrationGeo();
      const hasGeo = !!geo && isFinite(Number(geo.lat)) && isFinite(Number(geo.lon));
      if(el.intelligentCalibrationCoordText){
        el.intelligentCalibrationCoordText.textContent = hasGeo
          ? (Number(geo.lat).toFixed(6) + ", " + Number(geo.lon).toFixed(6))
          : "GPS 대기중";
      }
      if(!hasGeo){
        setIntelligentCalibrationTileNotice("GPS 좌표가 들어오면 현재 위치가 표시됩니다.", true);
      }
      if(!hasGeo){
        return;
      }
      const lat = Number(geo.lat);
      const lon = Number(geo.lon);
      const overlayOpen = isIntelligentCalibrationOverlayOpen();
      if(!overlayOpen){
        return;
      }
      if(el.intelligentCalibrationMap){
        const rect = el.intelligentCalibrationMap.getBoundingClientRect();
        if(rect.width < 40 || rect.height < 40){
          scheduleIntelligentCalibrationMapRefresh();
          return;
        }
      }
      if(!initIntelligentCalibrationMap()){
        if(overlayOpen && !intelligentCalibrationMapState.retryTimer && !statusMapState.leafletLoadFailed){
          intelligentCalibrationMapState.retryTimer = setTimeout(()=>{
            intelligentCalibrationMapState.retryTimer = null;
            updateIntelligentCalibrationMap();
          }, 650);
        }
        return;
      }
      const moved =
        Math.abs(Number(intelligentCalibrationMapState.lastLat) - lat) > 0.00001 ||
        Math.abs(Number(intelligentCalibrationMapState.lastLon) - lon) > 0.00001;
      intelligentCalibrationMapState.lastLat = lat;
      intelligentCalibrationMapState.lastLon = lon;
      const ll = [lat, lon];
      if(intelligentCalibrationMapState.marker){
        intelligentCalibrationMapState.marker.setLatLng(ll);
      }
      if(intelligentCalibrationMapState.map && moved){
        intelligentCalibrationMapState.map.setView(ll, 15, {animate:false});
      }
      scheduleIntelligentCalibrationMapRefresh();
    }
    function updateGyroPathFromTelemetry(data, nowMs, chartSample){
      const now = nowMs || Date.now();
      return updateGyroPathFusion(data, now, chartSample);
    }
    function resetQuickFlightMetricsState(){
      quickFlightMetrics.originGeoAlt = NaN;
      // Use first valid pressure sample as baseline for relative altitude.
      quickFlightMetrics.originPressureMpa = NaN;
      quickFlightMetrics.lastLat = NaN;
      quickFlightMetrics.lastLon = NaN;
      quickFlightMetrics.lastAlt = NaN;
      quickFlightMetrics.lastMs = 0;
      quickFlightMetrics.speedMps = NaN;
      resetDerivedFlightPhase();
    }
    function resetDerivedFlightPhase(){
      derivedFlightPhase.phase = FLIGHT_PHASES.PRE_FLIGHT;
      derivedFlightPhase.candidate = "";
      derivedFlightPhase.candidateCount = 0;
      derivedFlightPhase.lastAltM = NaN;
      derivedFlightPhase.lastMs = 0;
      derivedFlightPhase.verticalSpeedMps = NaN;
    }
    function commitDerivedFlightPhase(candidate){
      if(!candidate || candidate === derivedFlightPhase.phase){
        derivedFlightPhase.candidate = "";
        derivedFlightPhase.candidateCount = 0;
        return;
      }
      if(derivedFlightPhase.candidate === candidate){
        derivedFlightPhase.candidateCount += 1;
      }else{
        derivedFlightPhase.candidate = candidate;
        derivedFlightPhase.candidateCount = 1;
      }
      if(derivedFlightPhase.candidateCount >= FLIGHT_PHASE_STABLE_SAMPLES){
        derivedFlightPhase.phase = candidate;
        derivedFlightPhase.candidate = "";
        derivedFlightPhase.candidateCount = 0;
      }
    }
    function readFirmwareFlightPhase(data){
      if(!data || typeof data !== "object") return null;
      let phase = typeof data.flight_phase === "string"
        ? data.flight_phase.trim().toUpperCase()
        : "";
      if(!Object.prototype.hasOwnProperty.call(FLIGHT_PHASE_LABELS, phase)){
        const rawCode = data.flight_phase_code;
        const code = rawCode != null ? Number(rawCode) : NaN;
        phase = Number.isInteger(code) && code >= 0 && code < FLIGHT_PHASE_CODE_NAMES.length
          ? FLIGHT_PHASE_CODE_NAMES[code]
          : "";
      }
      if(!phase) return null;
      const verticalSpeedMps = readTelemetryVerticalSpeedMps(data);
      const apogeeM = Number(data.apogee_m);
      return {
        phase,
        label:FLIGHT_PHASE_LABELS[phase] || phase,
        status:FLIGHT_PHASE_STATUS[phase] || null,
        verticalSpeedMps:isFinite(verticalSpeedMps) ? verticalSpeedMps : NaN,
        apogeeM:isFinite(apogeeM) ? apogeeM : NaN,
        source:"firmware"
      };
    }
    function readTelemetryVerticalSpeedMps(data){
      if(!data || typeof data !== "object") return NaN;
      const candidates = [
        data.vertical_speed_mps, data.verticalSpeedMps,
        data.flight_vertical_speed_mps, data.flightVerticalSpeedMps,
        data.climb_rate_mps, data.climbRateMps
      ];
      for(let i=0;i<candidates.length;i++){
        const raw = candidates[i];
        if(raw == null || (typeof raw === "string" && raw.trim() === "")) continue;
        const value = Number(raw);
        if(isFinite(value)) return value;
      }
      return NaN;
    }
    function updateDerivedFlightPhase(altitudeM, speedMps, specificForceG, nowMs){
      const now = nowMs || Date.now();
      const alt = Number(altitudeM);
      let verticalSpeed = NaN;
      if(isFinite(alt) && isFinite(derivedFlightPhase.lastAltM) && derivedFlightPhase.lastMs > 0){
        const dtSec = (now - derivedFlightPhase.lastMs) / 1000;
        if(isFinite(dtSec) && dtSec >= 0.04 && dtSec <= 2.5){
          const rawVerticalSpeed = (alt - derivedFlightPhase.lastAltM) / dtSec;
          if(isFinite(rawVerticalSpeed)){
            if(isFinite(derivedFlightPhase.verticalSpeedMps)){
              derivedFlightPhase.verticalSpeedMps += (rawVerticalSpeed - derivedFlightPhase.verticalSpeedMps) * 0.35;
            }else{
              derivedFlightPhase.verticalSpeedMps = rawVerticalSpeed;
            }
            verticalSpeed = derivedFlightPhase.verticalSpeedMps;
          }
        }
      }
      if(isFinite(alt)){
        derivedFlightPhase.lastAltM = alt;
        derivedFlightPhase.lastMs = now;
      }
      if(!isFinite(verticalSpeed) && isFinite(derivedFlightPhase.verticalSpeedMps)){
        verticalSpeed = derivedFlightPhase.verticalSpeedMps;
      }

      const fallbackSpeed = Number(speedMps);
      let climbSpeed = isFinite(verticalSpeed)
        ? verticalSpeed
        : (isFinite(fallbackSpeed) ? fallbackSpeed : NaN);
      if(isFinite(verticalSpeed) && verticalSpeed > 0 && isFinite(fallbackSpeed)){
        climbSpeed = Math.max(verticalSpeed, fallbackSpeed);
      }
      const absVelocity = isFinite(verticalSpeed)
        ? Math.abs(verticalSpeed)
        : (isFinite(fallbackSpeed) ? Math.abs(fallbackSpeed) : NaN);
      const specificForceMps2 = isFinite(Number(specificForceG))
        ? Math.abs(Number(specificForceG) * FLIGHT_PHASE_GRAVITY_MPS2)
        : NaN;

      const phase = derivedFlightPhase.phase;
      let candidate = "";
      if(phase === FLIGHT_PHASES.PRE_FLIGHT){
        if((isFinite(alt) && alt > 5) || (isFinite(climbSpeed) && climbSpeed > 5)){
          candidate = FLIGHT_PHASES.POWERED_FLIGHT;
        }
      }else if(phase === FLIGHT_PHASES.POWERED_FLIGHT){
        if(isFinite(specificForceMps2) &&
           specificForceMps2 < (0.35 * FLIGHT_PHASE_GRAVITY_MPS2) &&
           isFinite(climbSpeed) && climbSpeed > 3){
          candidate = FLIGHT_PHASES.COASTING;
        }
      }else if(phase === FLIGHT_PHASES.COASTING){
        if(isFinite(verticalSpeed) && verticalSpeed < -0.5 && isFinite(alt) && alt > 15){
          candidate = FLIGHT_PHASES.DESCENT;
        }
      }else if(phase === FLIGHT_PHASES.DESCENT){
        if(isFinite(absVelocity) && absVelocity < 1 && isFinite(alt) && alt < 10){
          candidate = FLIGHT_PHASES.LANDED;
        }
      }
      commitDerivedFlightPhase(candidate);
      return {
        phase: derivedFlightPhase.phase,
        label: FLIGHT_PHASE_LABELS[derivedFlightPhase.phase] || derivedFlightPhase.phase,
        status: FLIGHT_PHASE_STATUS[derivedFlightPhase.phase] || null,
        verticalSpeedMps: verticalSpeed,
        axialAccelMps2:specificForceMps2,
        source:"ui_fallback"
      };
    }
    function readTelemetryActualSpeedMps(data){
      if(!data || typeof data !== "object") return NaN;
      const east = Number(
        data.velocity_e_mps ?? data.velocityEastMps ??
        data.vel_e_mps ?? data.velEastMps
      );
      const north = Number(
        data.velocity_n_mps ?? data.velocityNorthMps ??
        data.vel_n_mps ?? data.velNorthMps
      );
      const up = Number(
        data.velocity_u_mps ?? data.velocityUpMps ??
        data.vel_u_mps ?? data.velUpMps
      );
      if(isFinite(east) && isFinite(north) && isFinite(up)){
        return Math.hypot(east, north, up);
      }

      const groundSpeedCandidates = [
        data.gps_speed_mps, data.gpsSpeedMps,
        data.ground_speed_mps, data.groundSpeedMps,
        data.gps_speed, data.gpsSpeed
      ];
      for(let i=0;i<groundSpeedCandidates.length;i++){
        const raw = groundSpeedCandidates[i];
        if(raw == null || (typeof raw === "string" && raw.trim() === "")) continue;
        const groundSpeed = Number(raw);
        if(!isFinite(groundSpeed)) continue;
        const verticalSpeed = readTelemetryVerticalSpeedMps(data);
        return isFinite(verticalSpeed)
          ? Math.hypot(groundSpeed, verticalSpeed)
          : Math.abs(groundSpeed);
      }

      const totalSpeedCandidates = [
        data.actual_speed_mps, data.actualSpeedMps,
        data.speed_mps, data.speedMps,
        data.speed, data.spd, data.vel, data.v
      ];
      for(let i=0;i<totalSpeedCandidates.length;i++){
        const raw = totalSpeedCandidates[i];
        if(raw == null) continue;
        if(typeof raw === "string" && raw.trim() === "") continue;
        const val = Number(raw);
        if(isFinite(val)) return Math.abs(val);
      }
      return NaN;
    }
    function readQuickTelemetrySpeedMps(data){
      const actualSpeedMps = readTelemetryActualSpeedMps(data);
      if(isFinite(actualSpeedMps)) return actualSpeedMps;
      return NaN;
    }
    function getQuickFlightMetrics(data, nowMs){
      const now = nowMs || Date.now();
      let altitudeM = NaN;
      let speedMps = readTelemetryActualSpeedMps(data);
      const hasRecordedSpeedMps = isFinite(speedMps);
      const useSimFlightMetrics = !!(simEnabled && !replaySourceActive && simState);

      if(useSimFlightMetrics){
        if(isFinite(simState.altM)) altitudeM = simState.altM;
        const vE = Number(simState.velE);
        const vN = Number(simState.velN);
        const vU = Number(simState.velU);
        if(!isFinite(speedMps) && isFinite(vE) && isFinite(vN) && isFinite(vU)){
          speedMps = Math.hypot(vE, vN, vU);
        }
      }
      if(!isFinite(altitudeM) && data && typeof data === "object"){
        const altCandidates = [
          replaySourceActive ? data.altitude_corrected_m : null,
          data.alt_m, data.altitude_m,
          data.baro_alt_m, data.baroAltitudeM,
          data.altitude, data.alt
        ];
        for(let i=0;i<altCandidates.length;i++){
          const raw = altCandidates[i];
          if(raw == null) continue;
          if(typeof raw === "string" && raw.trim() === "") continue;
          const val = Number(raw);
          if(isFinite(val)){
            altitudeM = val;
            break;
          }
        }
      }

      // Fallback: derive relative altitude from absolute barometric pressure (BMP388).
      if(!isFinite(altitudeM) && data && typeof data === "object"){
        const pressureMpa = parseBaroPressureMpa(data);
        if(isFinite(pressureMpa) && pressureMpa > 0.03 && pressureMpa < 0.2){
          if(!isFinite(quickFlightMetrics.originPressureMpa) || !(quickFlightMetrics.originPressureMpa > 0)){
            quickFlightMetrics.originPressureMpa = pressureMpa;
            altitudeM = 0;
          }else{
            const p0 = quickFlightMetrics.originPressureMpa;
            const ratio = pressureMpa / p0;
            if(isFinite(ratio) && ratio > 0){
              const h = 44330.0 * (1.0 - Math.pow(ratio, 0.19029495718363465));
              if(isFinite(h)){
                altitudeM = (Math.abs(h) < 0.05) ? 0 : h;
              }
            }
          }
        }
      }

      const geo = extractTelemetryGeo(data, {koreaOnly:false}) ||
        (useSimFlightMetrics && simState && simState.lastGeo ? simState.lastGeo : null);
      if(geo){
        if(isFinite(geo.alt) && !isFinite(altitudeM)){
          if(!isFinite(quickFlightMetrics.originGeoAlt)) quickFlightMetrics.originGeoAlt = geo.alt;
          altitudeM = isFinite(quickFlightMetrics.originGeoAlt)
            ? (geo.alt - quickFlightMetrics.originGeoAlt)
            : geo.alt;
        }

        const geoChanged =
          !isFinite(quickFlightMetrics.lastLat) ||
          !isFinite(quickFlightMetrics.lastLon) ||
          Math.abs(geo.lat - quickFlightMetrics.lastLat) > 0.00000001 ||
          Math.abs(geo.lon - quickFlightMetrics.lastLon) > 0.00000001 ||
          (isFinite(geo.alt) && isFinite(quickFlightMetrics.lastAlt) &&
            Math.abs(geo.alt - quickFlightMetrics.lastAlt) > 0.01);
        if(
          geoChanged &&
          isFinite(quickFlightMetrics.lastLat) &&
          isFinite(quickFlightMetrics.lastLon) &&
          quickFlightMetrics.lastMs > 0
        ){
          const dtSec = (now - quickFlightMetrics.lastMs) / 1000;
          if(isFinite(dtSec) && dtSec > 0.08 && dtSec < 4){
            const latAvg = ((geo.lat + quickFlightMetrics.lastLat) * 0.5) * DEG_TO_RAD;
            const dNorth = (geo.lat - quickFlightMetrics.lastLat) * 111320;
            const dEast = (geo.lon - quickFlightMetrics.lastLon) * (111320 * Math.cos(latAvg));
            const dUp = (isFinite(geo.alt) && isFinite(quickFlightMetrics.lastAlt))
              ? (geo.alt - quickFlightMetrics.lastAlt)
              : 0;
            const rawSpeed = Math.hypot(dNorth, dEast, dUp) / dtSec;
            if(isFinite(rawSpeed)){
              if(isFinite(quickFlightMetrics.speedMps)){
                quickFlightMetrics.speedMps += (rawSpeed - quickFlightMetrics.speedMps) * 0.34;
              }else{
                quickFlightMetrics.speedMps = rawSpeed;
              }
              if(!isFinite(speedMps)) speedMps = quickFlightMetrics.speedMps;
            }
          }
        }

        if(geoChanged){
          quickFlightMetrics.lastLat = geo.lat;
          quickFlightMetrics.lastLon = geo.lon;
          quickFlightMetrics.lastAlt = isFinite(geo.alt) ? geo.alt : NaN;
          quickFlightMetrics.lastMs = now;
        }
      }

      if(!hasRecordedSpeedMps && gyroPathState && gyroPathState.fusionReady){
        const fusionSpeed = Math.hypot(
          Number(gyroPathState.fusionVelX),
          Number(gyroPathState.fusionVelY),
          Number(gyroPathState.fusionVelZ)
        );
        if(isFinite(fusionSpeed)) speedMps = fusionSpeed;
      }
      if(!isFinite(speedMps) && isFinite(quickFlightMetrics.speedMps)){
        speedMps = quickFlightMetrics.speedMps;
      }
      return {altitudeM, speedMps};
    }
    function updateQuickMetricLabels(){
      const inFlightMode = isFlightModeUi();
      const primaryLabel = inFlightMode ? "Altitude" : "Thrust";
      const secondaryLabel = inFlightMode ? "Speed" : "Pressure";
      if(el.quickMetricPrimaryLabel){
        el.quickMetricPrimaryLabel.textContent = primaryLabel;
      }
      if(el.quickMetricSecondaryLabel){
        el.quickMetricSecondaryLabel.textContent = secondaryLabel;
      }
      if(el.statusMapHudMetricPrimaryLabel) el.statusMapHudMetricPrimaryLabel.textContent = primaryLabel;
      if(el.statusMapHudMetricSecondaryLabel) el.statusMapHudMetricSecondaryLabel.textContent = secondaryLabel;
      if(el.gyro3dHudMetricPrimaryLabel) el.gyro3dHudMetricPrimaryLabel.textContent = primaryLabel;
      if(el.gyro3dHudMetricSecondaryLabel) el.gyro3dHudMetricSecondaryLabel.textContent = secondaryLabel;
    }
    function formatQuickGyroDeg(value){
      const deg = Number(value);
      if(!isFinite(deg)){
        return `<span class="num">0.0</span><span class="unit">deg</span>`;
      }
      return `<span class="num">${deg.toFixed(1)}</span><span class="unit">deg</span>`;
    }
    function updateQuickAuxLabels(){
      const inFlightMode = isFlightModeUi();
      const quickRelay2Item = el.quickRelay2 ? el.quickRelay2.closest(".item") : null;
      const quickNull2Item = el.quickNull2Value ? el.quickNull2Value.closest(".item") : null;
      const quickNull3Item = el.quickNull3Value ? el.quickNull3Value.closest(".item") : null;
      if(el.quickDelayLabel){
        el.quickDelayLabel.innerHTML = `<span class="label-icon"></span>${t("labelDelay")}`;
      }
      if(el.quickMetricDelayLabel){
        el.quickMetricDelayLabel.textContent = t("labelDelay");
      }
      if(el.quickBurnLabel){
        el.quickBurnLabel.innerHTML = `<span class="label-icon"></span>${inFlightMode ? "GYRO Y" : "Burn"}`;
      }
      if(el.quickRelay1Label){
        el.quickRelay1Label.innerHTML = `<span class="label-icon"></span>PYRO`;
      }
      if(el.quickRelay2Label){
        el.quickRelay2Label.innerHTML = `<span class="label-icon"></span>GYRO X`;
      }
      if(el.quickHxHzLabel){
        el.quickHxHzLabel.innerHTML = `<span class="label-icon"></span>${inFlightMode ? "SD CARD" : "LOADCELL"}`;
      }
      if(el.quickNullLabel){
        el.quickNullLabel.innerHTML = `<span class="label-icon"></span>${inFlightMode ? "GYRO Z" : "SD CARD"}`;
      }
      if(el.quickNull2Label){
        el.quickNull2Label.innerHTML = `<span class="label-icon"></span>NULL`;
      }
      if(el.quickNull3Label){
        el.quickNull3Label.innerHTML = `<span class="label-icon"></span>NULL`;
      }
      if(quickRelay2Item){
        quickRelay2Item.classList.toggle("hidden", !inFlightMode);
      }
      if(quickNull2Item){
        quickNull2Item.classList.remove("hidden");
      }
      if(quickNull3Item){
        quickNull3Item.classList.toggle("hidden", inFlightMode);
      }
      if(inFlightMode){
        if(el.quickRelay2) el.quickRelay2.innerHTML = formatQuickGyroDeg(NaN);
        if(el.quickHxHz) el.quickHxHz.innerHTML = `<span class="num">--</span>`;
        if(el.quickNullValue) el.quickNullValue.innerHTML = formatQuickGyroDeg(NaN);
        if(el.quickNull2Value) el.quickNull2Value.innerHTML = `<span class="num">null</span>`;
        if(el.quickNull3Value) el.quickNull3Value.innerHTML = `<span class="num">null</span>`;
      }else{
        if(el.quickHxHz) el.quickHxHz.innerHTML = `<span class="num">--</span><span class="unit">Hz</span>`;
        if(el.quickNullValue){
          el.quickNullValue.innerHTML = `<span class="num">--</span>`;
        }
        if(el.quickNull2Value){
          el.quickNull2Value.innerHTML = `<span class="num">null</span>`;
        }
        if(el.quickNull3Value){
          el.quickNull3Value.innerHTML = `<span class="num">null</span>`;
        }
      }
    }
    function buildPhoneLandscapeMetricCaption(metricHtml, fallback){
      if(!metricHtml) return fallback || "--";
      const temp = document.createElement("div");
      temp.innerHTML = metricHtml;
      const num = temp.querySelector(".num") ? temp.querySelector(".num").textContent.trim() : temp.textContent.trim();
      const unit = temp.querySelector(".unit") ? temp.querySelector(".unit").textContent.trim().toLowerCase() : "";
      const value = [num, unit].filter(Boolean).join(" ").trim();
      return value ? ("max " + value) : (fallback || "--");
    }
    function syncExpandedQuickMetrics(){
      const primaryHtml = el.thrust ? el.thrust.innerHTML : "--";
      const secondaryHtml = el.pressure ? el.pressure.innerHTML : "--";
      const primaryAlert = !!(el.thrust && el.thrust.closest(".status-metric") && el.thrust.closest(".status-metric").classList.contains("is-alert"));
      const secondaryAlert = !!(el.pressure && el.pressure.closest(".status-metric") && el.pressure.closest(".status-metric").classList.contains("is-alert"));
      const phoneFlightMode = isPhoneLandscapeLayout() && isFlightModeUi();

      if(el.statusMapHudMetricPrimaryValue) el.statusMapHudMetricPrimaryValue.innerHTML = primaryHtml;
      if(el.statusMapHudMetricSecondaryValue) el.statusMapHudMetricSecondaryValue.innerHTML = secondaryHtml;
      if(el.gyro3dHudMetricPrimaryValue) el.gyro3dHudMetricPrimaryValue.innerHTML = primaryHtml;
      if(el.gyro3dHudMetricSecondaryValue) el.gyro3dHudMetricSecondaryValue.innerHTML = secondaryHtml;

      if(phoneFlightMode){
        const primaryCaption = buildPhoneLandscapeMetricCaption(primaryHtml, "max --");
        const secondaryCaption = buildPhoneLandscapeMetricCaption(secondaryHtml, "max --");
        if(el.statusMapHudMetricPrimaryLabel) el.statusMapHudMetricPrimaryLabel.textContent = primaryCaption;
        if(el.statusMapHudMetricSecondaryLabel) el.statusMapHudMetricSecondaryLabel.textContent = secondaryCaption;
        if(el.gyro3dHudMetricPrimaryLabel) el.gyro3dHudMetricPrimaryLabel.textContent = primaryCaption;
        if(el.gyro3dHudMetricSecondaryLabel) el.gyro3dHudMetricSecondaryLabel.textContent = secondaryCaption;
      }

      if(el.statusMapHudMetricPrimaryCard) el.statusMapHudMetricPrimaryCard.classList.toggle("is-alert", primaryAlert);
      if(el.statusMapHudMetricSecondaryCard) el.statusMapHudMetricSecondaryCard.classList.toggle("is-alert", secondaryAlert);
      if(el.gyro3dHudMetricPrimaryCard) el.gyro3dHudMetricPrimaryCard.classList.toggle("is-alert", primaryAlert);
      if(el.gyro3dHudMetricSecondaryCard) el.gyro3dHudMetricSecondaryCard.classList.toggle("is-alert", secondaryAlert);
    }
    function syncExpandedHud(){
      updateQuickMetricLabels();
      syncExpandedQuickMetrics();
      syncGyroExpandedHud();
      syncStatusMapExpandedHud();
    }
    function refreshStatusMapSize(){
      if(isStatusMapViewportExpanded()){
        updateStatusMapExpandedViewportBounds();
      }
      if(!statusMapState.map) return;
      try{
        // invalidateSize is sufficient after a portal/layout move. Calling
        // setView + redraw here tears down valid tiles and creates a visible
        // blank frame every time the map card changes size.
        statusMapState.map.invalidateSize({
          animate:false,
          // Preserve the geographic center while the card is moved into or
          // out of the fullscreen portal.
          pan:true,
          debounceMoveend:true
        });
      }catch(e){}
    }
    function ensureStatusMapTileLayerVisible(){
      if(!el.statusMap) return;
      if(!statusMapState.map){
        try{ initStatusMap(); }catch(e){}
      }
      if(!statusMapState.map || typeof window.L === "undefined"){
        if(isStatusMapViewportExpanded()) setStatusMapTileOffline(true);
        return;
      }
      const expanded = isStatusMapViewportExpanded();
      const tileCount = el.statusMap.querySelectorAll(".leaflet-tile").length;
      if(!expanded && tileCount > 0) return;
      if(expanded && tileCount > 0) return;
      try{
        const koreaBounds = window.L.latLngBounds(
          [STATUS_MAP_KR_BOUNDS.south, STATUS_MAP_KR_BOUNDS.west],
          [STATUS_MAP_KR_BOUNDS.north, STATUS_MAP_KR_BOUNDS.east]
        );
        const sourceIndex = statusMapState.tileSourceIndex >= 0 ? statusMapState.tileSourceIndex : 0;
        attachStatusMapTileLayer(statusMapState.map, koreaBounds, sourceIndex);
        if(statusMapState.hasLiveFix){
          statusMapSetMarker(statusMapState.lat, statusMapState.lon, {recenter:true});
        }else{
          statusMapSetMarker(STATUS_MAP_DEFAULT.lat, STATUS_MAP_DEFAULT.lon, {recenter:true, zoom:STATUS_MAP_DEFAULT.zoom});
        }
        requestAnimationFrame(()=>{
          refreshStatusMapSize();
        });
      }catch(e){}
    }
    function forceStatusMapExpandedReflow(){
      if(!statusMapState.map){
        try{ initStatusMap(); }catch(e){}
      }
      if(!statusMapState.map){
        if(isStatusMapViewportExpanded()) setStatusMapTileOffline(true);
        return;
      }
      try{
        refreshStatusMapSize();
        ensureStatusMapTileLayerVisible();
      }catch(e){}
    }
    function scheduleStatusMapRefresh(){
      if(statusMapRefreshRaf) cancelAnimationFrame(statusMapRefreshRaf);
      statusMapRefreshRaf = requestAnimationFrame(()=>{
        statusMapRefreshRaf = null;
        refreshStatusMapSize();
      });
      if(statusMapRefreshTimers.length){
        statusMapRefreshTimers.forEach(timer=>clearTimeout(timer));
      }
      // One post-layout pass and one transition-settle pass are enough. The
      // previous five redraw passes repeatedly discarded loaded map tiles.
      statusMapRefreshTimers = [90, 280].map(delay=>setTimeout(refreshStatusMapSize, delay));
    }
    function scheduleStatusMapExpandedReflow(){
      requestAnimationFrame(forceStatusMapExpandedReflow);
      [120, 360].forEach(delay=>{
        setTimeout(forceStatusMapExpandedReflow, delay);
      });
    }
    function initStatusMap(){
      if(!el.statusMap || statusMapState.map) return;
      bindStatusMapViewportInteractions();
      bindStatusMapControls();
      ensureStatusMapLeafletCss();
      if(typeof window.L === "undefined"){
        tryLoadStatusMapLeafletScript();
        console.warn("Status map init pending: Leaflet unavailable.");
        updateStatusMapHud();
        return;
      }
      patchStatusMapLeafletSafety();
      statusMapState.leafletLoadFailed = false;
      statusMapState.tileLoadCount = 0;
      statusMapState.tileErrorCount = 0;
      statusMapState.tileLayer = null;
      clearStatusMapTileProbeTimer();
      setStatusMapTileOffline(false);
      el.statusMap.innerHTML = "";
      const koreaBounds = [
        [STATUS_MAP_KR_BOUNDS.south, STATUS_MAP_KR_BOUNDS.west],
        [STATUS_MAP_KR_BOUNDS.north, STATUS_MAP_KR_BOUNDS.east]
      ];
      const map = window.L.map(el.statusMap, {
        zoomControl:false,
        attributionControl:false,
        maxBounds:koreaBounds,
        maxBoundsViscosity:1.0,
        minZoom:6,
        maxZoom:19,
        wheelDebounceTime:80,
        wheelPxPerZoomLevel:90,
        fadeAnimation:false,
        zoomAnimation:false,
        markerZoomAnimation:false
      }).setView(
        [statusMapState.lat, statusMapState.lon],
        statusMapState.zoom
      );
      if(!attachStatusMapTileLayer(map, koreaBounds, 0)){
        setStatusMapTileOffline(true);
      }
      const rocketIcon = window.L.divIcon({
        className: "status-map-rocket-icon",
        html: buildStatusMapRocketHtml(),
        iconSize: [44, 44],
        iconAnchor: [22, 44]
      });
      const marker = window.L.marker([statusMapState.lat, statusMapState.lon], {icon:rocketIcon}).addTo(map);
      statusMapState.markerExpanded = false;
      marker.on("click",(ev)=>{
        if(ev && ev.originalEvent){
          if(ev.originalEvent.preventDefault) ev.originalEvent.preventDefault();
          if(ev.originalEvent.stopPropagation) ev.originalEvent.stopPropagation();
        }
        setStatusMapMarkerExpanded(!statusMapState.markerExpanded);
      });
      statusMapState.map = map;
      statusMapState.marker = marker;
      refreshStatusMapMarkerContent();
      setStatusMapMarkerExpanded(false);
      map.on("click", ()=>{
        setStatusMapMarkerExpanded(false);
      });
      map.on("zoomend", ()=>{
        statusMapState.zoom = map.getZoom();
        updateStatusMapHud();
      });
      map.on("moveend", ()=>{
        updateStatusMapHud();
      });
      syncStatusMapInteractionMode();
      startStatusMapUserLocationWatch();
      updateStatusMapHud();
      scheduleStatusMapRefresh();
      if(window.ResizeObserver && el.statusMapViewport && !statusMapResizeObserver){
        statusMapResizeObserver = new ResizeObserver(()=>{ scheduleStatusMapRefresh(); });
        statusMapResizeObserver.observe(el.statusMapViewport);
      }
    }

    function syncCountdownInlineStatus(){
      if(!el.countdownInlineStatus || !el.countdownInlineStatusText || !el.countdownInlineStatusPill) return;
      const statusTextRaw = (el.statusText && el.statusText.textContent) ? el.statusText.textContent.trim() : "";
      const statusText = resolveMobileHudStatusText(statusTextRaw);
      const pillText = (el.statusPill && el.statusPill.textContent) ? el.statusPill.textContent.trim() : "";

      if(statusText){
        el.countdownInlineStatusText.textContent = statusText;
      }

      const pillClasses = ["countdown-inline-status-pill"];
      if(el.statusPill){
        const clsList = (el.statusPill.className || "").split(/\s+/);
        for(const cls of clsList){
          if(!cls || cls === "hidden") continue;
          if(/^status-/.test(cls)) pillClasses.push(cls);
        }
      }
      el.countdownInlineStatusPill.className = pillClasses.join(" ");

      if(pillText){
        el.countdownInlineStatusPill.textContent = pillText;
        el.countdownInlineStatusPill.classList.remove("hidden");
      }else{
        el.countdownInlineStatusPill.textContent = "";
        el.countdownInlineStatusPill.classList.add("hidden");
      }

      const hasContent = !!(statusText || pillText);
      el.countdownInlineStatus.classList.toggle("hidden", !hasContent);
      syncExpandedHud();
    }

    function syncGyroExpandedHud(){
      if(!el.gyro3dHudCountdown || !el.gyro3dHudStatusText || !el.gyro3dHudStatusPill || !el.gyro3dHudConn || !el.gyro3dHudBattery) return;
      if(el.gyro3dHudTitle) el.gyro3dHudTitle.textContent = "DASHBOARD";

      const countdownText = (el.countdown && el.countdown.textContent) ? el.countdown.textContent.trim() : "T- --:--:--";
      const statusTextRaw = (el.statusText && el.statusText.textContent) ? el.statusText.textContent.trim() : "";
      const statusText = resolveMobileHudStatusText(statusTextRaw);
      const pillTextRaw = (el.statusPill && el.statusPill.textContent) ? el.statusPill.textContent.trim() : "";
      const connText = (el.connStatusText && el.connStatusText.textContent) ? el.connStatusText.textContent.trim() : (connOk ? "CONNECTED · -- Hz" : "DISCONNECTED · -- Hz");
      const pathMeta = getGyroPathSourceMeta();
      const battText = (el.batteryStatus && el.batteryStatus.textContent) ? el.batteryStatus.textContent.trim() : "--%";
      const compactConnText = connOk ? (((rxHzWindow > 0 && isFinite(rxHzWindow)) ? rxHzWindow.toFixed(0) : "--") + "Hz") : "--Hz";
      const compactBatteryText = battText.replace(/[^0-9]/g, "").slice(0, 3) || "--";
      const compactTimeText = getCompactHudClockText();
      const showCompactClock = !!(sequenceActive || isFirmwareSequenceRunningState(currentSt) || localTplusActive);
      const pathText = pathMeta.show ? (pathMeta.label + " " + pathMeta.confidence) : "";
      const statusDisplayText = pathText ? ((statusText || "--") + " · " + pathText) : (statusText || "--");
      const connDisplayText = pathMeta.lowConfidence ? ((connText || "--") + " · EST") : (connText || "--");

      el.gyro3dHudCountdown.textContent = countdownText || "T- --:--:--";
      el.gyro3dHudStatusText.textContent = statusDisplayText;
      el.gyro3dHudConn.textContent = connDisplayText;
      el.gyro3dHudBattery.textContent = battText || "--%";
      if(el.gyro3dHudConnCompact) el.gyro3dHudConnCompact.textContent = compactConnText;
      if(el.gyro3dHudBatteryCompact) el.gyro3dHudBatteryCompact.textContent = compactBatteryText;
      if(el.gyro3dHudTimeCompact) el.gyro3dHudTimeCompact.textContent = compactTimeText;
      if(el.gyro3dHudClockCompact) el.gyro3dHudClockCompact.classList.toggle("hidden", !showCompactClock);

      const pillClasses = ["countdown-inline-status-pill", "gyro3d-expanded-hud-pill"];
      if(el.statusPill){
        const clsList = (el.statusPill.className || "").split(/\s+/);
        for(const cls of clsList){
          if(!cls || cls === "hidden") continue;
          if(/^status-/.test(cls)) pillClasses.push(cls);
        }
      }
      el.gyro3dHudStatusPill.className = pillClasses.join(" ");
      if(pillTextRaw){
        el.gyro3dHudStatusPill.textContent = pillTextRaw;
        el.gyro3dHudStatusPill.classList.remove("hidden");
      }else{
        el.gyro3dHudStatusPill.textContent = "--";
        el.gyro3dHudStatusPill.classList.add("hidden");
      }
      if(el.gyro3dHudStatusInline){
        const hasContent = !!(statusText || pillTextRaw);
        el.gyro3dHudStatusInline.classList.toggle("hidden", !hasContent);
      }
      if(el.gyro3dHudStatusBar){
        el.gyro3dHudStatusBar.className = "status-bar gyro3d-expanded-statusbar";
        const online = !!(el.statusBar && el.statusBar.classList.contains("is-online"));
        el.gyro3dHudStatusBar.classList.add(online ? "is-online" : "is-offline");
      }
      if(el.gyro3dHudBatteryWrap){
        el.gyro3dHudBatteryWrap.className = "status-battery";
        const sourceBatteryWrap = el.batteryStatus ? el.batteryStatus.closest(".status-battery") : null;
        if(sourceBatteryWrap){
          if(sourceBatteryWrap.classList.contains("status-ok")) el.gyro3dHudBatteryWrap.classList.add("status-ok");
          else if(sourceBatteryWrap.classList.contains("status-warn")) el.gyro3dHudBatteryWrap.classList.add("status-warn");
          else if(sourceBatteryWrap.classList.contains("status-bad")) el.gyro3dHudBatteryWrap.classList.add("status-bad");
        }
      }
      if(el.gyro3dHudBatteryFill){
        let fillWidth = "";
        if(el.batteryFill && el.batteryFill.style && el.batteryFill.style.width){
          fillWidth = el.batteryFill.style.width.trim();
        }
        if(!fillWidth) fillWidth = "45%";
        el.gyro3dHudBatteryFill.style.width = fillWidth;
      }
    }
    function syncStatusMapExpandedHud(){
      if(!el.statusMapHudCountdown || !el.statusMapHudStatusText || !el.statusMapHudStatusPill || !el.statusMapHudConn || !el.statusMapHudBattery) return;
      if(el.statusMapHudTitle) el.statusMapHudTitle.textContent = "DASHBOARD";

      const countdownText = (el.countdown && el.countdown.textContent) ? el.countdown.textContent.trim() : "T- --:--:--";
      const statusTextRaw = (el.statusText && el.statusText.textContent) ? el.statusText.textContent.trim() : "";
      const statusText = resolveMobileHudStatusText(statusTextRaw);
      const pillTextRaw = (el.statusPill && el.statusPill.textContent) ? el.statusPill.textContent.trim() : "";
      const connText = (el.connStatusText && el.connStatusText.textContent) ? el.connStatusText.textContent.trim() : (connOk ? "CONNECTED · -- Hz" : "DISCONNECTED · -- Hz");
      const pathMeta = getGyroPathSourceMeta();
      const battText = (el.batteryStatus && el.batteryStatus.textContent) ? el.batteryStatus.textContent.trim() : "--%";
      const compactConnText = connOk ? (((rxHzWindow > 0 && isFinite(rxHzWindow)) ? rxHzWindow.toFixed(0) : "--") + "Hz") : "--Hz";
      const compactBatteryText = battText.replace(/[^0-9]/g, "").slice(0, 3) || "--";
      const compactTimeText = getCompactHudClockText();
      const showCompactClock = !!(sequenceActive || isFirmwareSequenceRunningState(currentSt) || localTplusActive);
      const pathText = pathMeta.show ? (pathMeta.label + " " + pathMeta.confidence) : "";
      const statusDisplayText = pathText ? ((statusText || "--") + " · " + pathText) : (statusText || "--");
      const connDisplayText = pathMeta.lowConfidence ? ((connText || "--") + " · EST") : (connText || "--");

      el.statusMapHudCountdown.textContent = countdownText || "T- --:--:--";
      el.statusMapHudStatusText.textContent = statusDisplayText;
      el.statusMapHudConn.textContent = connDisplayText;
      el.statusMapHudBattery.textContent = battText || "--%";
      if(el.statusMapHudConnCompact) el.statusMapHudConnCompact.textContent = compactConnText;
      if(el.statusMapHudBatteryCompact) el.statusMapHudBatteryCompact.textContent = compactBatteryText;
      if(el.statusMapHudTimeCompact) el.statusMapHudTimeCompact.textContent = compactTimeText;
      if(el.statusMapHudClockCompact) el.statusMapHudClockCompact.classList.toggle("hidden", !showCompactClock);

      const pillClasses = ["countdown-inline-status-pill", "gyro3d-expanded-hud-pill"];
      if(el.statusPill){
        const clsList = (el.statusPill.className || "").split(/\s+/);
        for(const cls of clsList){
          if(!cls || cls === "hidden") continue;
          if(/^status-/.test(cls)) pillClasses.push(cls);
        }
      }
      el.statusMapHudStatusPill.className = pillClasses.join(" ");
      if(pillTextRaw){
        el.statusMapHudStatusPill.textContent = pillTextRaw;
        el.statusMapHudStatusPill.classList.remove("hidden");
      }else{
        el.statusMapHudStatusPill.textContent = "--";
        el.statusMapHudStatusPill.classList.add("hidden");
      }
      if(el.statusMapHudStatusInline){
        const hasContent = !!(statusText || pillTextRaw);
        el.statusMapHudStatusInline.classList.toggle("hidden", !hasContent);
      }
      if(el.statusMapHudStatusBar){
        el.statusMapHudStatusBar.className = "status-bar gyro3d-expanded-statusbar";
        const online = !!(el.statusBar && el.statusBar.classList.contains("is-online"));
        el.statusMapHudStatusBar.classList.add(online ? "is-online" : "is-offline");
      }
      if(el.statusMapHudBatteryWrap){
        el.statusMapHudBatteryWrap.className = "status-battery";
        const sourceBatteryWrap = el.batteryStatus ? el.batteryStatus.closest(".status-battery") : null;
        if(sourceBatteryWrap){
          if(sourceBatteryWrap.classList.contains("status-ok")) el.statusMapHudBatteryWrap.classList.add("status-ok");
          else if(sourceBatteryWrap.classList.contains("status-warn")) el.statusMapHudBatteryWrap.classList.add("status-warn");
          else if(sourceBatteryWrap.classList.contains("status-bad")) el.statusMapHudBatteryWrap.classList.add("status-bad");
        }
      }
      if(el.statusMapHudBatteryFill){
        let fillWidth = "";
        if(el.batteryFill && el.batteryFill.style && el.batteryFill.style.width){
          fillWidth = el.batteryFill.style.width.trim();
        }
        if(!fillWidth) fillWidth = "45%";
        el.statusMapHudBatteryFill.style.width = fillWidth;
      }
    }

    function updateConnectionUI(connected){
      if(el.connDot){
        if(connected) el.connDot.classList.add("ok");
        else el.connDot.classList.remove("ok");
      }
      if(el.connText){
        el.connText.textContent = connected ? t("connConnected") : t("connDisconnected");
      }
      if(connected || sampleCounter === 0) hideDisconnectOverlay();
      else showDisconnectOverlay();
      syncCountdownInlineStatus();
      updateInspectionAccess();
      updateMotorInfoPanel();
      updateHomeUI();
      syncMobileBoardHeader();
      updateGyroConnectionUI(connected);
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
      syncWelcomeConnectScreen(connected);
      if(!connected){
        if(el.gyroStatusPill && el.gyroStatusText){
          el.gyroStatusPill.className = "gyro-status-pill status-disc";
          el.gyroStatusPill.textContent = t("statusDisconnected");
          el.gyroStatusText.textContent = t("statusNoResponse");
        }
      }else{
        syncGyroStatusFromMain();
      }
    }

    function updateGyroConnectionUI(connected){
      if(!el.gyroConnPill || !el.gyroConnText) return;
      el.gyroConnPill.classList.toggle("ok", !!connected);
      el.gyroConnText.textContent = connected ? t("connConnected") : t("connDisconnected");
    }

    function syncGyroStatusFromMain(){
      if(!el.gyroStatusPill || !el.gyroStatusText) return;
      if(el.statusPill){
        const pillClass = el.statusPill.className || "";
        el.gyroStatusPill.className = ("gyro-status-pill " + pillClass).trim();
        el.gyroStatusPill.textContent = el.statusPill.textContent || "";
      }
      if(el.statusText){
        el.gyroStatusText.textContent = el.statusText.textContent || "";
      }
      syncMobileSequenceStatus();
    }

    function updateWsUI(){
      if(!el.wsDot || !el.wsText) return;
      if(wsConnected){
        el.wsDot.classList.add("ok");
        el.wsText.textContent = "ON";
      }else{
        el.wsDot.classList.remove("ok");
        el.wsText.textContent = wsEverConnected ? "OFF" : "INIT";
      }
      updateWsAlert();
      updateHomeUI();
      syncMobileBoardHeader();
      syncWelcomeConnectScreen(connOk || serialConnected || wsConnected);
      evaluateRuntimeAlarms(Date.now());
    }

    function updateWifiInfoUI(info){
      if(!el.wifiMode && !el.wifiSsid) return;
      if(!info){
        if(el.wifiMode) el.wifiMode.textContent = "-";
        if(el.wifiSsid) el.wifiSsid.textContent = "-";
        if(el.wifiChannel) el.wifiChannel.textContent = "-";
        if(el.wifiBandwidth) el.wifiBandwidth.textContent = "-";
        if(el.wifiTxPower) el.wifiTxPower.textContent = "-";
        if(el.wifiIp) el.wifiIp.textContent = "-";
        if(el.wifiStaCount) el.wifiStaCount.textContent = "-";
        if(el.wifiRssi) el.wifiRssi.textContent = "-";
        return;
      }
      const mode = info.mode || "-";
      const apSsid = info.ap_ssid || "";
      const staSsid = info.sta_ssid || "";
      const ssidLabel = (staSsid && staSsid.length) ? staSsid : apSsid;
      const channel = (info.channel != null) ? String(info.channel) : "-";
      const bandwidth = info.bandwidth || "-";
      const txDbm = (info.tx_dbm != null && isFinite(Number(info.tx_dbm))) ? Number(info.tx_dbm).toFixed(1) + " dBm" : "-";
      const apIp = info.ap_ip || "";
      const staIp = info.sta_ip || "";
      const ipLabel = (staIp && staIp !== "0.0.0.0") ? staIp : apIp;
      const staCount = (info.sta_count != null) ? String(info.sta_count) : "-";
      const rssiVal = Number(info.rssi);
      const rssiLabel = (isFinite(rssiVal) && rssiVal > -100) ? (rssiVal + " dBm") : "-";

      if(el.wifiMode) el.wifiMode.textContent = mode;
      if(el.wifiSsid) el.wifiSsid.textContent = ssidLabel || "-";
      if(el.wifiChannel) el.wifiChannel.textContent = channel;
      if(el.wifiBandwidth) el.wifiBandwidth.textContent = bandwidth;
      if(el.wifiTxPower) el.wifiTxPower.textContent = txDbm;
      if(el.wifiIp) el.wifiIp.textContent = ipLabel || "-";
      if(el.wifiStaCount) el.wifiStaCount.textContent = staCount;
      if(el.wifiRssi) el.wifiRssi.textContent = rssiLabel;
    }
    function clampServoAngle(value){
      let deg = Number(value);
      if(!isFinite(deg)) deg = SERVO_DEFAULT_DEG;
      if(deg < SERVO_MIN_DEG) deg = SERVO_MIN_DEG;
      if(deg > SERVO_MAX_DEG) deg = SERVO_MAX_DEG;
      return Math.round(deg);
    }
    function setServoUiAngle(channel, angleDeg){
      const row = servoUiMap[channel];
      if(!row) return;
      const deg = clampServoAngle(angleDeg);
      if(row.range) row.range.value = String(deg);
      if(row.value) row.value.textContent = deg + "°";
      if(row.currentAngle) row.currentAngle.textContent = deg + "°";
    }
    function setServoUiPin(channel, pin){
      const row = servoUiMap[channel];
      if(!row || !row.pin) return;
      if(pin == null || !isFinite(Number(pin))) row.pin.textContent = "-";
      else row.pin.textContent = String(Math.round(Number(pin)));
    }
    function updateServoInfoUI(info){
      if(!info || !Array.isArray(info.channels)) return;
      for(const item of info.channels){
        const hwCh = Number(item && (item.id != null ? item.id : item.ch));
        if(!isFinite(hwCh) || SERVO_CHANNELS.indexOf(hwCh) < 0) continue;
        const uiCh = mapServoHwToUiChannel(hwCh);
        setServoUiPin(uiCh, item.pin);
        setServoUiAngle(uiCh, item.angle);
      }
    }
    async function fetchServoInfo(){
      if(simEnabled) return;
      if(isLocalPreviewHost()) return;
      const isServoModalVisible = isServoControlVisible();
      if(!servoInfo || isServoModalVisible){
      try{
        const info = await fetchJsonTimeout("/servo", 700);
        servoInfo = info;
        servoInfoLastMs = Date.now();
        servoInfoWarned = false;
        updateServoInfoUI(info);
      }catch(e){
        if(!servoInfo || (Date.now() - servoInfoLastMs) > 5000){
          updateServoInfoUI(null);
          if(!servoInfoWarned){
            servoInfoWarned = true;
            showToast("서보 응답 없음. 펌웨어와 업로드 상태를 확인하세요.", "warn", {
              key:"servo-api-offline",
              duration:2800
            });
          }
        }
      }
      }
    }
    async function sendServoCommand(channel, deg){
      const uiCh = Math.max(1, Math.min(SERVO_CHANNELS.length, Math.round(Number(channel) || 1)));
      const hwCh = mapServoUiToHwChannel(uiCh);
      const path = "/servo?ch=" + hwCh + "&deg=" + deg;
      if(simEnabled){
        // Keep simulator behavior tied to UI channel labels.
        handleSimCommand({ http:"/servo?ch=" + uiCh + "&deg=" + deg, ser:"SERVO " + uiCh + " " + deg });
        return { ok:true, reason:"SIM" };
      }

      const serialMode = !!serialEnabled;
      const canSerial = !!(serialMode && serialConnected && serialTxEnabled);
      let serialReason = "";
      if(canSerial){
        try{
          const ackPattern = new RegExp("^PWM" + String(hwCh) + "\\s*=\\s*(-?\\d+)$", "i");
          const servoAckPattern = new RegExp("^SERVO\\s+ch\\s*=\\s*" + String(hwCh) + "\\s+deg\\s*=\\s*(-?\\d+)", "i");
          const sendOneSerialServo = async (lineToSend)=>{
            const waiter = createSerialAckWaiter((evt)=>{
              if(evt.kind === "err") return true;
              if(evt.kind !== "ack") return false;
              const msg = String(evt.message || "").trim();
              if(ackPattern.test(msg)) return true;
              if(servoAckPattern.test(msg)) return true;
              return /^FLASH_LINK_COMMAND_QUEUED\b/i.test(msg) && /\bcode=23\b/i.test(msg);
            }, SERVO_SERIAL_REPLY_TIMEOUT_MS);
            const wrote = await serialWriteLine(lineToSend);
            if(!wrote){
              cancelSerialAckWaiter(waiter, "SERIAL_WRITE_FAIL");
              return { ok:false, reason:"SERIAL_WRITE_FAIL" };
            }
            const reply = await waiter.promise;
            if(!reply.ok){
              return { ok:false, reason:reply.message || "SERIAL_NO_REPLY" };
            }
            const msg = String(reply.message || "").trim();
            const m = msg.match(ackPattern) || msg.match(servoAckPattern);
            const appliedDeg = m ? clampServoAngle(Number(m[1])) : deg;
            return { ok:true, reason:"SERIAL_ACK", appliedDeg };
          };

          // 1차: REST 형태(/servo?...), 2차: 레거시(SERVO ch deg) 폴백
          let serialResult = await sendOneSerialServo(path);
          if(!serialResult.ok){
            serialResult = await sendOneSerialServo("SERVO " + hwCh + " " + deg);
          }
          if(serialResult.ok){
            return { ok:true, reason:serialResult.reason || "SERIAL_ACK", appliedDeg:serialResult.appliedDeg };
          }
          serialReason = serialResult.reason || "SERIAL_NO_REPLY";
        }catch(e){
          serialReason = (e && e.message) ? e.message : "SERIAL_ERROR";
        }
      }else if(serialMode && !serialConnected){
        serialReason = "SERIAL_DISCONNECTED";
      }else if(serialMode && serialConnected && !serialTxEnabled){
        serialReason = "SERIAL_TX_DISABLED";
      }

      const API_BASE = getApiBaseForCommands();
      const url = API_BASE ? (API_BASE + path) : path;
      const opt = { cache:"no-cache" };

      try{
        const res = await fetch(url, opt);
        if(!res.ok){
          let bodyText = "";
          try{ bodyText = (await res.text()) || ""; }catch(e){}
          const reason = bodyText.trim() || ("HTTP " + res.status);
          if(serialReason){
            return { ok:false, reason:serialReason + " / " + reason };
          }
          return { ok:false, reason };
        }
      }catch(err){
        reportSilentException("servo-http", err);
        const reason = (err && err.message) ? err.message : "NETWORK_ERROR";
        if(serialReason){
          return { ok:false, reason:serialReason + " / " + reason };
        }
        return { ok:false, reason };
      }
      return { ok:true, reason:"HTTP" };
    }
    function scheduleServoAutoApply(channel, delayMs){
      const row = servoUiMap[channel];
      if(!row) return;
      if(row.autoTimer){
        clearTimeout(row.autoTimer);
        row.autoTimer = null;
      }
      row.autoTimer = setTimeout(()=>{
        row.autoTimer = null;
        applyServoAngle(channel, { showFeedback:false, logIt:false });
      }, Math.max(0, Number(delayMs) || 0));
    }
    async function applyServoAngle(channel, options){
      const row = servoUiMap[channel];
      if(!row || !row.range) return;
      const opts = options || {};
      const showFeedback = (opts.showFeedback !== false);
      const logIt = (opts.logIt !== false);
      const force = !!opts.force;
      if(row.autoTimer){
        clearTimeout(row.autoTimer);
        row.autoTimer = null;
      }
      const deg = clampServoAngle(row.range.value);
      setServoUiAngle(channel, deg);
      if(!force && row.lastAppliedDeg === deg) return;
      const result = await sendServoCommand(channel, deg);
      if(!result.ok){
        if(showFeedback){
          const reason = String(result.reason || "UNKNOWN");
          showToast("PWM" + channel + " 전송 실패: " + reason, "error", {
            key:"servo-set-fail-" + channel,
            duration:3200
          });
        }
        return;
      }
      const appliedDeg = clampServoAngle(result.appliedDeg != null ? result.appliedDeg : deg);
      row.lastAppliedDeg = appliedDeg;
      setServoUiAngle(channel, appliedDeg);
      if(logIt){
        addLogLine("PWM" + channel + " servo -> " + appliedDeg + "°", "SERVO");
      }
      if(showFeedback){
        showToast("PWM" + channel + " 각도 " + appliedDeg + "° 적용", "info", {
          key:"servo-set-" + channel,
          duration:1800
        });
      }
      fetchServoInfo();
    }
    function renderHomeViewLayout(){
      const homeView = document.getElementById("homeView");
      if(!homeView || homeView.children.length) return;
      homeView.innerHTML = `
        <div class="home-mobile-shell">
          <section class="home-mobile-hero">
            <div id="homeAttitudeMount" class="home-attitude-mount" aria-label="3D attitude preview"></div>
          </section>

          <section class="home-mission-card">
            <div class="home-mission-main">
              <div class="home-mission-thumb" aria-hidden="true">
                <div class="home-mission-rocket"></div>
              </div>
              <div class="home-mission-copy">
                <div class="home-mission-name" id="homeMissionName">--</div>
                <div class="home-mission-meta">
                  <span>Motor <strong id="homeMissionMotor">--</strong></span>
                  <span>Delay <strong id="homeMissionDelay">--</strong></span>
                </div>
                <div class="home-sequence-progress" aria-hidden="true">
                  <span></span>
                </div>
                <div class="home-sequence-label">
                  <strong>시퀀스</strong>
                  <span id="homeActionHint">00:00:00</span>
                </div>
              </div>
            </div>
            <div class="home-actions">
              <button id="homeArmBtn" class="home-action-btn" type="button">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>
                <span class="home-action-text">시퀀스 시작</span>
              </button>
              <button id="homeSafeBtn" class="home-action-btn" type="button">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8z"></path><path d="M13 5h3v14h-3z"></path></svg>
                <span class="home-action-text">일시 중지</span>
              </button>
              <button id="homeIgniterBtn" class="home-action-btn is-danger" type="button">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"></path></svg>
                <span class="home-action-text">중지</span>
              </button>
            </div>
          </section>

          <section class="home-basic-card">
            <div class="home-card-title">BASIC DATA</div>
            <div class="home-basic-grid">
              <div class="home-basic-item home-basic-item-wide">
                <span>ALTITUDE</span>
                <strong id="homeQuickAltitude">--</strong>
              </div>
              <div class="home-basic-item home-basic-item-wide">
                <span>G ACCEL</span>
                <strong id="homeQuickSpeed">--</strong>
              </div>
              <div class="home-basic-item">
                <span>STATE</span>
                <strong id="homeRelay">--</strong>
              </div>
              <div class="home-basic-item">
                <span>SD CARD</span>
                <strong id="homeSwitch">--</strong>
              </div>
              <div class="home-basic-item">
                <span>BATTERY</span>
                <strong id="homeHealthBattery">--</strong>
              </div>
              <div class="home-basic-item">
                <span>IGNITER</span>
                <strong id="homeHealthIgniter">--</strong>
              </div>
            </div>
          </section>
        </div>

        <div class="home-ref-hidden" aria-hidden="true">
          <span id="homeLog">-</span>
          <span id="homeFirmware">--</span>
          <span id="homeProtocol">--</span>
          <span id="homeHeroBoard">--</span>
          <span id="homeHeroPill">--</span>
          <span id="homeStatus">System ready</span>
          <span id="homeStatusBadge" class="home-status-badge is-off">OFF</span>
          <span id="homeConnStatus">--</span>
          <span id="homeWsStatus">--</span>
          <span id="homeMode">--</span>
          <span id="homeSerialStatus">--</span>
          <span id="homeIgniter">--</span>
          <span id="homeSafety">--</span>
          <span id="homeConnBadge">OFF</span>
          <span id="homeWsBadge">OFF</span>
          <span id="homeModeBadge">OFF</span>
          <span id="homeSafetyBadge">OFF</span>
          <span id="homeSerialBadge">OFF</span>
          <span id="homeHealthBatteryBadge">--</span>
          <span id="homeHealthIgniterBadge">--</span>
          <span id="homeHealthSwitch">--</span>
          <span id="homeHealthSwitchBadge">--</span>
          <span id="homeHealthRelay">--</span>
          <span id="homeHealthRelayBadge">--</span>
        </div>
      `;
    }
    function setHomeAttitudeMounted(mounted){
      const mount = document.getElementById("homeAttitudeMount");
      if(!el.gyro3dViewport || !mount) return;
      if(mounted){
        if(homeGyroDockState.mountedToHome) return;
        homeGyroDockState.homeParent = el.gyro3dViewport.parentNode;
        homeGyroDockState.homeNextSibling = el.gyro3dViewport.nextSibling;
        el.gyro3dViewport.classList.add("is-home-mounted");
        mount.appendChild(el.gyro3dViewport);
        homeGyroDockState.mountedToHome = true;
      }else{
        if(!homeGyroDockState.mountedToHome) return;
        const parent = homeGyroDockState.homeParent;
        const nextSibling = homeGyroDockState.homeNextSibling;
        el.gyro3dViewport.classList.remove("is-home-mounted");
        if(parent){
          if(nextSibling && nextSibling.parentNode === parent){
            parent.insertBefore(el.gyro3dViewport, nextSibling);
          }else{
            parent.appendChild(el.gyro3dViewport);
          }
        }
        homeGyroDockState.homeParent = null;
        homeGyroDockState.homeNextSibling = null;
        homeGyroDockState.mountedToHome = false;
      }
      requestAnimationFrame(()=>window.dispatchEvent(new Event("resize")));
    }
    function updateHomeLog(){
      if(!el.homeLog) return;
      if(!eventLog.length){
        el.homeLog.textContent = "-";
        return;
      }
      const recent = eventLog.slice(-3).reverse().map(item=>{
        const time = (item.time || "").slice(11, 19);
        const tag = item.tag ? "[" + item.tag + "] " : "";
        return time + " " + tag + item.message;
      });
      el.homeLog.textContent = recent.join("\n");
    }
    function setHomeBadge(node, label, tone){
      if(!node) return;
      node.classList.remove("is-ok","is-warn","is-alert","is-off");
      if(tone) node.classList.add(tone);
      node.textContent = label;
    }
    function formatBoardNameHtml(name){
      const normalized = String(name || "").trim().replace(/\s+/g, " ");
      if(!normalized || normalized === "-") return null;
      const upper = normalized.toUpperCase();
      if(upper === "ALTIS INTELLIGNET V1" || upper === "ALTIS INTELLIGENT V1"){
        return '<span class="board-name-strong">ALTIS</span> <span class="board-name-regular">INTELLIGNET</span> <span class="board-name-light">V1</span>';
      }
      return null;
    }
    function removeLegacyLuceText(){
      const needles = [
        "Luce in ALTIS",
        "ALTIS 안의 빛",
        "작은 점화 하나가",
        "우주로 향하는 길이 됩니다"
      ];
      const nodes = document.querySelectorAll("body *");
      nodes.forEach(node=>{
        if(!node || node.children.length) return;
        const text = String(node.textContent || "");
        if(!text) return;
        if(needles.some(k => text.indexOf(k) >= 0)){
          node.textContent = "";
        }
      });
    }

    function setBoardNameDisplay(node, name, fallback){
      if(!node) return;
      const value = String(name || "").trim();
      const label = (value && value !== "-") ? value : (fallback || "FLASH6");
      const html = formatBoardNameHtml(label);
      if(html){
        node.innerHTML = html;
      }else{
        node.textContent = label;
      }
    }

    function getSequenceProgressBlockReason(){
      const state = currentSt;
      const running = !!(
        sequenceActive ||
        isFirmwareSequenceRunningState(state) ||
        localTplusActive ||
        userWaitingLocal
      );
      if(running) return "";
      if(replaySourceActive) return "리플레이 모드에서는 진행 불가";
      if(!connOk && !simEnabled) return "수신기 미연결";
      if(lockoutLatched) return "제어 권한 제한";
      if(inspectionRunning) return "설비 점검이 진행 중입니다";
      if(!isControlUnlocked()) return "설비 점검 미완료";
      if(safetyModeEnabled) return "안전 모드 해제 필요";
      const storageGuard = getSequenceStorageGuard();
      if(storageGuard.blocked){
        if(storageGuard.level === "unknown"){
          return "에비오닉스 저장공간 확인 불가";
        }
        return "저장공간 초기화 필요";
      }
      if(state !== 0) return "현재 시스템 상태에서는 시작 불가";
      return "";
    }

    function getSequenceConditionItems(){
      const storageGuard = getSequenceStorageGuard();
      return [
        {name:"수신기 연결", ok:!!(connOk || simEnabled)},
        {name:"설비 점검", ok:!!isControlUnlocked()},
        {name:"안전 모드", ok:!safetyModeEnabled, okText:"해제", failText:"해제 필요"},
        {
          name:"에비오닉스 저장공간",
          ok:!storageGuard.blocked,
          okText:isFinite(storageGuard.pct) ? storageGuard.pct.toFixed(1) + "%" : "정상",
          failText:storageGuard.level === "unknown" ? "확인 불가" : "초기화 필요"
        }
      ];
    }

    function ensureSequenceInfoOverlay(){
      let overlay = document.getElementById("sequenceInfoOverlay");
      if(overlay) return overlay;
      overlay = document.createElement("div");
      overlay.id = "sequenceInfoOverlay";
      overlay.className = "mobile-chart-picker-overlay hidden";
      overlay.innerHTML =
        '<div class="mobile-chart-picker-dialog agent-help-dialog" role="dialog" aria-modal="true" aria-labelledby="sequenceInfoTitle">' +
          '<div class="mobile-chart-picker-head">' +
            '<div id="sequenceInfoTitle" class="mobile-chart-picker-title">시퀀스 진행 조건</div>' +
            '<button id="sequenceInfoCloseBtn" class="mobile-chart-picker-close" type="button" aria-label="닫기">×</button>' +
          '</div>' +
          '<div class="mobile-chart-picker-body">' +
            '<div id="sequenceInfoSummary" class="agent-help-summary"></div>' +
            '<div id="sequenceConditionList" class="sequence-condition-list"></div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      const close = ()=>{
        overlay.classList.add("hidden");
        overlay.style.display = "none";
      };
      const closeBtn = overlay.querySelector("#sequenceInfoCloseBtn");
      if(closeBtn) closeBtn.addEventListener("click", close);
      overlay.addEventListener("click", (ev)=>{ if(ev.target === overlay) close(); });
      return overlay;
    }

    function showSequenceInfoOverlay(){
      const overlay = ensureSequenceInfoOverlay();
      const blockReason = getSequenceProgressBlockReason();
      const summary = overlay.querySelector("#sequenceInfoSummary");
      const list = overlay.querySelector("#sequenceConditionList");
      if(summary){
        summary.classList.toggle("is-ok", !blockReason);
        summary.textContent = blockReason
          ? "진행 불가 · " + blockReason
          : "모든 조건이 충족되어 시퀀스를 진행할 수 있습니다.";
      }
      if(list){
        list.innerHTML = getSequenceConditionItems().map((item)=>{
          const value = item.ok
            ? (item.okText || "완료")
            : (item.failText || "확인 필요");
          return '<div class="sequence-condition-row' + (item.ok ? ' is-ok' : '') + '">' +
            '<span class="sequence-condition-dot" aria-hidden="true"></span>' +
            '<span class="sequence-condition-name">' + item.name + '</span>' +
            '<span class="sequence-condition-value">' + value + '</span>' +
          '</div>';
        }).join("");
      }
      overlay.classList.remove("hidden");
      overlay.style.display = "flex";
    }

    function syncMobileSequenceStatus(){
      if(!el.mobileSequenceStatusText && !el.mobileSequenceStatusPill) return;
      const blockReason = getSequenceProgressBlockReason();
      const statusText = blockReason ||
        el.statusText?.textContent?.trim() ||
        "시스템 준비 완료";
      const pillText = blockReason
        ? "진행 불가"
        : (el.statusPill?.textContent?.trim() || "READY");
      const pillClass = blockReason
        ? "status-lock"
        : (el.statusPill?.className || "status-ready");
      if(el.mobileSequenceStatusText) el.mobileSequenceStatusText.textContent = statusText;
      if(el.mobileSequenceStatusPill){
        el.mobileSequenceStatusPill.className = ("mobile-sequence-status-pill " + pillClass)
          .replace(/\bhidden\b/g, "")
          .replace(/\s+/g, " ")
          .trim();
        el.mobileSequenceStatusPill.textContent = pillText;
      }
      syncSequenceStorageGuardUi();
    }

    function getMobileBoardDisplayName(){
      const value = el.hwBoardName?.textContent?.trim();
      return (value && value !== "-") ? value : "N/A";
    }

    function setMobileBoardPanelOpen(open){
      if(!el.mobileBoardHeader) return;
      el.mobileBoardHeader.classList.toggle("is-open", !!open);
      if(el.mobileBoardPanel) el.mobileBoardPanel.setAttribute("aria-hidden", open ? "false" : "true");
      if(el.mobileBoardSelectBtn) el.mobileBoardSelectBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if(!open && el.mobileBoardConnectSection){
        el.mobileBoardConnectSection.classList.remove("is-open");
        el.mobileBoardConnectSection.classList.remove("is-info-open");
        if(el.mobileBoardAddBtn) el.mobileBoardAddBtn.setAttribute("aria-expanded", "false");
        if(el.mobileConnectInfoBtn) el.mobileConnectInfoBtn.setAttribute("aria-expanded", "false");
      }
    }

    function getMobileBoardHzText(){
      const hz = Number((rxHzWindow > 0 && isFinite(rxHzWindow)) ? rxHzWindow : sampleRateHzWindow);
      if(!(hz > 0 && isFinite(hz))) return "--hz";
      return String(Math.round(hz)).padStart(2, "0") + "hz";
    }

    function isFlashLinkGroundUi(){
      return isFlashLinkTransportActive() && flashLinkUiRole === "ground";
    }

    function getFlashLinkGroundStatusText(){
      if(simEnabled) return null;
      if(!isFlashLinkGroundUi()) return null;
      const hzText = Math.round(flashLinkUiRxHz) + " Hz";
      const lossText =
        (currentLang === "ko" ? "손실 " : "loss ") +
        (flashLinkUiLossPermille / 10).toFixed(1) + "%";
      return "LINK (avionics) · " + hzText;
    }

    function setMetricPlaceholder(node, unit){
      if(!node) return;
      updateNumValue(node, "--", unit);
      const metric = node.closest ? node.closest(".status-metric") : null;
      if(metric){
        metric.classList.remove("is-alert", "loadcell-blink");
      }
    }

    function applyFlashLinkGroundWaitingUi(force){
      if(!force && flashLinkGroundBlanked) return;
      flashLinkGroundBlanked = true;
      lastThrustKgf = null;
      lastBatteryPct = null;
      lastChipTempC = null;
      lastPerfLoadPct = null;
      lastPerfCpuUs = null;
      lastPerfLoopUs = null;
      lastLoadcellRaw = null;
      lastLoadcellRawValid = false;
      lastLoadcellReadyFlag = null;
      lastLoadcellSaturated = false;
      loadcellErrorActive = false;
      latestTelemetry = {sw:null, ic:null, rly:null, mode:null, uw:null, al:null, gs:0};
      latestTelemetryGeo = null;
      currentSt = 0;
      sequenceActive = false;
      localTplusActive = false;
      localTplusStartMs = null;
      resetGyroAttitudeState();
      resetGyroPathTracking();
      resetQuickFlightMetricsState();

      setMetricPlaceholder(el.thrust, isFlightModeUi() ? "m" : ((uiSettings && uiSettings.thrustUnit) || "kgf"));
      setMetricPlaceholder(el.pressure, isFlightModeUi() ? "G" : "MPa");
      setMetricPlaceholder(el.accelX, "g");
      setMetricPlaceholder(el.accelY, "g");
      setMetricPlaceholder(el.accelZ, "g");
      setMetricPlaceholder(el.accelMag, "g");
      setMetricPlaceholder(el.gyroX, "dps");
      setMetricPlaceholder(el.gyroY, "dps");
      setMetricPlaceholder(el.gyroZ, "dps");
      setMetricPlaceholder(el.gyroMag, "dps");
      setMetricPlaceholder(el.gyroRollDeg, "deg");
      setMetricPlaceholder(el.gyroPitchDeg, "deg");
      setMetricPlaceholder(el.gyroYawDeg, "deg");
      if(el.lt) el.lt.innerHTML = '<span class="lt-line"><span class="num">--</span><span class="unit">ms</span></span><span class="unit lt-sep">/</span><span class="lt-line"><span class="num">--</span><span class="unit">ms</span></span>';
      if(el.snapHz) el.snapHz.textContent = "-- Hz";
      if(el.hxHz) el.hxHz.textContent = "-- Hz";
      if(el.cpuUs) el.cpuUs.textContent = "-- us";
      if(el.loadcellLiveValue) el.loadcellLiveValue.textContent = "--";
      if(el.batteryStatus) el.batteryStatus.textContent = "N/A";
      if(el.chipTempStatus) el.chipTempStatus.textContent = "N/A";
      if(el.perfStatus) el.perfStatus.textContent = "N/A";
      if(el.mobilePreviewChipTemp) el.mobilePreviewChipTemp.textContent = "N/A";
      if(el.mobilePreviewPerf) el.mobilePreviewPerf.textContent = "N/A";
      if(el.mobilePreviewBattery) el.mobilePreviewBattery.textContent = "N/A";
      if(el.mobilePreviewState) el.mobilePreviewState.textContent = "N/A";
      if(el.commStatus) el.commStatus.innerHTML = '<span class="num">AVIONICS N/A</span>';
      if(el.motorDelay) el.motorDelay.innerHTML = '<span class="num">--</span><span class="unit">S</span>';
      if(el.motorBurn) el.motorBurn.innerHTML = '<span class="num">--</span><span class="unit">S</span>';
      if(el.quickMetricDelay) updateNumValue(el.quickMetricDelay, "--", "S");
      if(el.quickMetricPyro) updateNumValue(el.quickMetricPyro, "--");
      if(el.quickSw) updateNumValue(el.quickSw, "--");
      if(el.quickRelay1) updateNumValue(el.quickRelay1, "--");
      if(el.quickRelay2) updateNumValue(el.quickRelay2, "--");
      if(el.quickHxHz) updateNumValue(el.quickHxHz, "--");
      if(el.quickNullValue) updateNumValue(el.quickNullValue, "--");
      if(el.quickNull2Value) updateNumValue(el.quickNull2Value, "--");
      if(el.quickNull3Value) updateNumValue(el.quickNull3Value, "--");
      if(el.sw){ el.sw.textContent = "--"; el.sw.className = "pill pill-gray"; }
      if(el.ic){ el.ic.textContent = "--"; el.ic.className = "pill pill-gray"; }
      if(el.relay){ el.relay.textContent = "--"; el.relay.className = "pill pill-gray"; }
      if(el.thrustGauge) el.thrustGauge.style.setProperty("--gauge-pct", "0%");
      if(el.pressureGauge) el.pressureGauge.style.setProperty("--gauge-pct", "0%");
      if(el.statusPill){
        el.statusPill.className = "status-disc";
        el.statusPill.textContent = "진행 불가";
      }
      if(el.statusPillMeta){
        el.statusPillMeta.className = "status-disc";
        el.statusPillMeta.textContent = "진행 불가";
      }
      if(el.statusText) el.statusText.textContent = "에비오닉스 미연결";
      if(el.countdown) el.countdown.textContent = "T- --:--:--";
      if(el.countdownMobile) el.countdownMobile.textContent = "T- --:--:--";
      if(el.countdownBig) el.countdownBig.textContent = "T- --:--:--";
      syncMobileSequenceTime();
      syncGyroStatusFromMain();
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
      updateControlAccessUI(currentSt);
      syncMobilePreviewConnectionState();
    }

    function clearFlashLinkGroundWaitingUi(){
      flashLinkGroundBlanked = false;
    }

    function isDeviceUiOnline(){
      if(simEnabled) return true;
      const transportOnline = !!(wsConnected || serialConnected || connOk || simEnabled);
      if(isFlashLinkGroundUi()){
        return transportOnline && flashLinkUiLinked && flashLinkUiRemoteValid;
      }
      return transportOnline;
    }

    function syncMobilePreviewConnectionState(){
      try{
        const online = isDeviceUiOnline();
        const changed = lastMobilePreviewOnline !== online;
        lastMobilePreviewOnline = online;
        document.documentElement.classList.toggle("mobile-preview-offline", !online);
        document.documentElement.classList.toggle("board-connected", online);
        if(!online && changed && !simEnabled && !replaySourceActive){
          scheduleOfflineGyroDefaultPreview();
        }
      }catch(_e){}
      renderMobileChartPreview();
    }

    function syncMobileBoardHeader(){
      if(!el.mobileBoardHeader) return;
      const name = getMobileBoardDisplayName();
      const online = isDeviceUiOnline();
      const flashLinkStatusText = getFlashLinkGroundStatusText();
      const statusText = flashLinkStatusText ||
        (online
          ? ("온라인 · " + dataOriginLabel(currentDataOrigin) + " · " + getMobileBoardHzText())
          : "수신기 오프라인 · -- hz");
      if(el.mobileBoardName) el.mobileBoardName.textContent = name;
      if(el.mobileBoardPanelName) el.mobileBoardPanelName.textContent = name;
      if(el.mobileBoardStatus) el.mobileBoardStatus.textContent = statusText;
      if(el.mobileBoardPanelStatus) el.mobileBoardPanelStatus.textContent = statusText;
      if(el.mobileBoardConnectLabel) el.mobileBoardConnectLabel.textContent = online ? "연결 해제" : "기기 연결";
      if(el.mobileBoardConnectSummary) el.mobileBoardConnectSummary.textContent = (online ? "연결됨 · 현재: " : "연결 준비 · 현재: ") + statusText;
      if(el.mobileBoardAddBtn){
        el.mobileBoardAddBtn.classList.toggle("is-disconnect", online);
        el.mobileBoardAddBtn.setAttribute("aria-label", online ? "연결 해제" : "기기 연결");
      }
      if(el.mobileBoardConnectIcon){
        el.mobileBoardConnectIcon.innerHTML = online
          ? '<path d="M18.8 12.3l1.7-1.7a5 5 0 0 0-.1-7.1 5 5 0 0 0-7.1-.1l-1.7 1.7"></path><path d="M5.2 11.7l-1.7 1.7a5 5 0 0 0 .1 7.1 5 5 0 0 0 7.1.1l1.7-1.7"></path><path d="M8 2v3"></path><path d="M2 8h3"></path><path d="M16 19v3"></path><path d="M19 16h3"></path>'
          : '<path d="M12 5v14"></path><path d="M5 12h14"></path>';
      }
      el.mobileBoardHeader.classList.toggle("is-offline", !online);
      if(el.mobileBoardRow) el.mobileBoardRow.classList.toggle("is-offline", !online);
      if(online && !isFlashLinkGroundUi() && el.mobileBoardConnectSection && el.mobileBoardConnectSection.classList.contains("is-open")){
        el.mobileBoardConnectSection.classList.remove("is-open");
        if(el.mobileBoardAddBtn) el.mobileBoardAddBtn.setAttribute("aria-expanded", "false");
      }
      syncDataStorageActionButtons();
      syncMobilePreviewConnectionState();
    }

    function syncMobileBoardHeaderScrollState(){
      if(!el.mobileBoardHeader) return;
      const scrollTop = Math.max(
        0,
        Number(window.scrollY || 0),
        Number((document.scrollingElement && document.scrollingElement.scrollTop) || 0),
        Number((document.documentElement && document.documentElement.scrollTop) || 0),
        Number((document.body && document.body.scrollTop) || 0)
      );
      const active = document.body.classList.contains("mobile-board-header-active") && scrollTop > 12;
      el.mobileBoardHeader.classList.toggle("is-scrolled", active);
    }

    function initMobileBoardHeader(){
      if(!el.mobileBoardHeader) return;
      const togglePanel = ()=>setMobileBoardPanelOpen(!el.mobileBoardHeader.classList.contains("is-open"));
      if(el.mobileBoardSelectBtn) el.mobileBoardSelectBtn.addEventListener("click", togglePanel);
      if(el.mobileBoardPanelBtn) el.mobileBoardPanelBtn.addEventListener("click", togglePanel);
      if(el.mobileBoardRow) el.mobileBoardRow.addEventListener("click", ()=>setMobileBoardPanelOpen(false));
      const openConnect = async ()=>{
        if(isDeviceUiOnline()){
          await disconnectCurrentConnection();
          setMobileBoardPanelOpen(false);
          return;
        }
        if(el.mobileBoardConnectSection){
          setMobileBoardPanelOpen(true);
          const open = !el.mobileBoardConnectSection.classList.contains("is-open");
          el.mobileBoardConnectSection.classList.toggle("is-open", open);
          if(!open) el.mobileBoardConnectSection.classList.remove("is-info-open");
          if(el.mobileBoardAddBtn) el.mobileBoardAddBtn.setAttribute("aria-expanded", open ? "true" : "false");
          if(el.mobileConnectInfoBtn) el.mobileConnectInfoBtn.setAttribute("aria-expanded", "false");
          return;
        }
        handleConnectAction();
      };
      if(el.mobileBoardConnectBtn) el.mobileBoardConnectBtn.addEventListener("click", openConnect);
      if(el.mobileBoardAddBtn) el.mobileBoardAddBtn.addEventListener("click", openConnect);
      if(el.mobileConnectMethodUsbBtn){
        el.mobileConnectMethodUsbBtn.addEventListener("click", ()=>{
          setMobileBoardPanelOpen(false);
          startConnectMethod("serial");
        });
      }
      if(el.mobileConnectMethodSimBtn){
        el.mobileConnectMethodSimBtn.addEventListener("click", ()=>{
          setMobileBoardPanelOpen(false);
          startWelcomeSimulation();
        });
      }
      if(el.mobileConnectInfoBtn && el.mobileBoardConnectSection){
        el.mobileConnectInfoBtn.addEventListener("click", ()=>{
          const open = !el.mobileBoardConnectSection.classList.contains("is-info-open");
          el.mobileBoardConnectSection.classList.toggle("is-info-open", open);
          el.mobileConnectInfoBtn.setAttribute("aria-expanded", open ? "true" : "false");
        });
      }
      if(el.mobileBoardSearchInput && el.mobileBoardRow){
        el.mobileBoardSearchInput.addEventListener("input", ()=>{
          const query = el.mobileBoardSearchInput.value.trim().toLowerCase();
          const name = getMobileBoardDisplayName().toLowerCase();
          el.mobileBoardRow.classList.toggle("hidden", !!query && !name.includes(query));
        });
      }
      if(!el.mobileBoardHeader._scrollStateBound){
        let scrollStateRaf = 0;
        const scheduleScrollState = ()=>{
          if(scrollStateRaf) return;
          scrollStateRaf = requestAnimationFrame(()=>{
            scrollStateRaf = 0;
            syncMobileBoardHeaderScrollState();
          });
        };
        window.addEventListener("scroll", scheduleScrollState, {passive:true});
        window.addEventListener("resize", scheduleScrollState, {passive:true});
        el.mobileBoardHeader._scrollStateBound = true;
      }
      syncMobileBoardHeaderScrollState();
    }

    function syncMobilePreviewDots(){
      if(!el.mobilePreviewCarousel || !el.mobilePreviewDots || !el.mobilePreviewDots.length) return;
      const width = Math.max(1, el.mobilePreviewCarousel.clientWidth || 1);
      const index = Math.max(0, Math.min(el.mobilePreviewDots.length - 1, Math.round(el.mobilePreviewCarousel.scrollLeft / width)));
      el.mobilePreviewDots.forEach((dot, dotIndex)=>{
        dot.classList.toggle("is-active", dotIndex === index);
      });
      if(index === 1){
        syncMobileMapPreviewMount();
        scheduleStatusMapRefresh();
      }
    }

    function scrollMobilePreviewTo(index){
      if(!el.mobilePreviewCarousel || !el.mobilePreviewDots || !el.mobilePreviewDots.length) return false;
      const maxIndex = el.mobilePreviewDots.length - 1;
      const nextIndex = Math.max(0, Math.min(maxIndex, Math.round(Number(index) || 0)));
      const width = Math.max(1, el.mobilePreviewCarousel.clientWidth || 1);
      syncMobileMapPreviewMount();
      if(typeof el.mobilePreviewCarousel.scrollTo === "function"){
        el.mobilePreviewCarousel.scrollTo({left:width * nextIndex, behavior:"smooth"});
      }else{
        el.mobilePreviewCarousel.scrollLeft = width * nextIndex;
      }
      syncMobilePreviewDots();
      if(nextIndex === 1) scheduleStatusMapRefresh();
      return true;
    }

    function initMobilePreviewCarousel(){
      if(!el.mobilePreviewCarousel) return;
      syncMobileMapPreviewMount();
      el.mobilePreviewCarousel.addEventListener("scroll", ()=>{
        if(el.mobilePreviewCarousel._dotRaf) return;
        el.mobilePreviewCarousel._dotRaf = requestAnimationFrame(()=>{
          el.mobilePreviewCarousel._dotRaf = 0;
          syncMobilePreviewDots();
        });
      }, {passive:true});
      syncMobilePreviewDots();
    }

    function updateHomeUI(){
      if(!el.homeView) return;
      const textOrDash = (node)=> (node && node.textContent && node.textContent.trim()) ? node.textContent.trim() : "-";
      const boardName = textOrDash(el.hwBoardName);
      syncMobileSequenceStatus();
      syncMobileBoardHeader();
      if(el.pageKicker){
        setBoardNameDisplay(el.pageKicker, boardName, "FLASH6");
        el.pageKicker.classList.remove("hidden");
      }
      if(el.homeConnStatus) el.homeConnStatus.textContent = textOrDash(el.connText);
      if(el.homeWsStatus) el.homeWsStatus.textContent = textOrDash(el.wsText);
      if(el.homeMode) el.homeMode.textContent = textOrDash(el.modePill);
      if(el.homeStatus){
        const pill = textOrDash(el.statusPill);
        const text = textOrDash(el.statusText);
        el.homeStatus.textContent = (pill !== "-" && text !== "-") ? (pill + " — " + text) : (text !== "-" ? text : pill);
      }
      if(el.homeRelay) el.homeRelay.textContent = textOrDash(el.relay);
      if(el.homeSwitch) el.homeSwitch.textContent = textOrDash(el.sw);
      if(el.homeIgniter) el.homeIgniter.textContent = textOrDash(el.ic);
      if(el.homeSafety){
        const safety = (el.safeModeToggle && el.safeModeToggle.checked) ? "ON" : "OFF";
        el.homeSafety.textContent = safety;
      }
      if(el.homeHeroBoard) el.homeHeroBoard.textContent = boardName;
      if(el.homeFirmware) el.homeFirmware.textContent = textOrDash(el.hwFirmwareName);
      if(el.homeProtocol) el.homeProtocol.textContent = textOrDash(el.hwProtocolName);
      if(el.homeQuickAltitude) el.homeQuickAltitude.innerHTML = el.thrust ? el.thrust.innerHTML : "--";
      if(el.homeQuickSpeed) el.homeQuickSpeed.innerHTML = el.pressure ? el.pressure.innerHTML : "--";
      const serialLabel = !serialEnabled ? t("modeWifi") : (serialConnected ? t("serialConnected") : t("serialDisconnected"));
      if(el.homeSerialStatus) el.homeSerialStatus.textContent = serialLabel;

      const heroLive = connOk && wsConnected;
      if(el.homeHeroPill){
        el.homeHeroPill.textContent = heroLive ? "LIVE" : "OFFLINE";
        el.homeHeroPill.classList.toggle("is-offline", !heroLive);
      }

      setHomeBadge(el.homeStatusBadge,
        lockoutLatched ? "ALERT" : (safetyModeEnabled ? "SAFE" : "OK"),
        lockoutLatched ? "is-alert" : (safetyModeEnabled ? "is-warn" : "is-ok"));
      setHomeBadge(el.homeConnBadge, connOk ? "OK" : "OFF", connOk ? "is-ok" : "is-alert");
      if(wsConnected){
        setHomeBadge(el.homeWsBadge, "ON", "is-ok");
      }else if(wsEverConnected){
        setHomeBadge(el.homeWsBadge, "OFF", "is-warn");
      }else{
        setHomeBadge(el.homeWsBadge, "INIT", "is-off");
      }
      setHomeBadge(el.homeModeBadge, (textOrDash(el.modePill) !== "-") ? "OK" : "OFF", (textOrDash(el.modePill) !== "-") ? "is-ok" : "is-off");
      setHomeBadge(el.homeSafetyBadge,
        (el.safeModeToggle && el.safeModeToggle.checked) ? "ON" : "OFF",
        (el.safeModeToggle && el.safeModeToggle.checked) ? "is-ok" : "is-warn");
      if(!serialEnabled){
        setHomeBadge(el.homeSerialBadge, "WIFI", "is-off");
      }else if(serialConnected){
        setHomeBadge(el.homeSerialBadge, "OK", "is-ok");
      }else{
        setHomeBadge(el.homeSerialBadge, "ERR", "is-alert");
      }

      const missionName = (el.missionName && el.missionName.value && el.missionName.value.trim()) ? el.missionName.value.trim() : "-";
      const missionMotor = (selectedMotorName || (el.missionName && el.missionName.value) || "").trim() || "-";
      const missionDelay = (el.missionIgnDelay && el.missionIgnDelay.value && el.missionIgnDelay.value.trim()) ? (el.missionIgnDelay.value.trim() + " s") : "-";
      if(el.homeMissionName) el.homeMissionName.textContent = missionName;
      if(el.homeMissionMotor) el.homeMissionMotor.textContent = missionMotor;
      if(el.homeMissionDelay) el.homeMissionDelay.textContent = missionDelay;
      updateGyroMetaFromMain();

      const battValue = (lastBatteryV != null && isFinite(lastBatteryV)) ? lastBatteryV.toFixed(2) : null;
      const battPct = (lastBatteryPct != null && isFinite(lastBatteryPct)) ? Math.round(lastBatteryPct) : null;
      if(el.homeHealthBattery){
        el.homeHealthBattery.textContent = battValue ? (battValue + " V" + (battPct != null ? (" · " + battPct + "%") : "")) : "--";
      }
      setHomeBadge(el.homeHealthBatteryBadge, battValue ? "OK" : "WAIT", battValue ? "is-ok" : "is-warn");

      const igniterOk = !isIgniterCheckEnabled() || latestTelemetry.ic === 1;
      if(el.homeHealthIgniter) el.homeHealthIgniter.textContent = isIgniterCheckEnabled() ? (latestTelemetry.ic === 1 ? "OK" : "OPEN") : "SKIP";
      setHomeBadge(el.homeHealthIgniterBadge, isIgniterCheckEnabled() ? (igniterOk ? "OK" : "ALERT") : "OFF",
        isIgniterCheckEnabled() ? (igniterOk ? "is-ok" : "is-alert") : "is-off");

      const switchSafe = latestTelemetry.sw === 0;
      if(el.homeHealthSwitch) el.homeHealthSwitch.textContent = (latestTelemetry.sw == null) ? "--" : (switchSafe ? "OFF" : "ON");
      setHomeBadge(el.homeHealthSwitchBadge, (latestTelemetry.sw == null) ? "WAIT" : (switchSafe ? "OK" : "ALERT"),
        (latestTelemetry.sw == null) ? "is-warn" : (switchSafe ? "is-ok" : "is-alert"));

      if(el.homeHealthRelay) el.homeHealthRelay.textContent = lockoutLatched ? "LOCKOUT" : "OK";
      setHomeBadge(el.homeHealthRelayBadge, lockoutLatched ? "ALERT" : "OK", lockoutLatched ? "is-alert" : "is-ok");

      const armed = isControlUnlocked();
      if(el.homeArmBtn){
        const labelNode = el.homeArmBtn.querySelector(".home-action-text");
        const label = armed ? "시퀀스 진행" : "시퀀스 시작";
        if(labelNode) labelNode.textContent = label;
        else el.homeArmBtn.textContent = label;
        el.homeArmBtn.classList.toggle("is-active", armed);
      }
      if(el.homeSafeBtn) el.homeSafeBtn.classList.toggle("is-active", !!(el.safeModeToggle && el.safeModeToggle.checked));
      if(el.homeIgniterBtn) el.homeIgniterBtn.classList.toggle("is-active", !!(el.igswitch && el.igswitch.checked));
      if(el.homeActionHint){
        el.homeActionHint.textContent = "00:00:00";
      }
      updateHomeLog();
    }

    function updateGyroMetaFromMain(){
      if(el.gyroBattery){
        const battText = (el.batteryStatus && el.batteryStatus.textContent) ? el.batteryStatus.textContent.trim() : "--";
        el.gyroBattery.textContent = battText || "--";
      }
      if(el.gyroMode){
        const modeText = (el.modePill && el.modePill.textContent) ? el.modePill.textContent.trim() : "--";
        el.gyroMode.textContent = modeText || "--";
      }
      if(el.gyroRelay){
        const relayText = (el.relay && el.relay.textContent) ? el.relay.textContent.trim() : "--";
        el.gyroRelay.textContent = relayText || "--";
      }
    }

    function addLogLine(message, tag){
      if(!el.logView) return;
      const now = new Date();
      const timeStr = now.toLocaleTimeString();
      const timeIso = now.toISOString();
      const prefix = tag ? "[" + tag + "] " : "";
      const lineText = prefix + "[" + timeStr + "] " + message;

      logLines.push(lineText);
      eventLog.push({ time: timeIso, tag: tag || "", message: message });

      trimArrayToMax(eventLog, EVENT_LOG_MAX, LOG_TRIM_CHUNK);

      const div = document.createElement("div");
      div.className = "log-line";
      div.innerHTML = '<span class="log-prefix">$</span> ' + lineText.replace(/</g,"&lt;").replace(/>/g,"&gt;");
      el.logView.appendChild(div);

      while(el.logView.childNodes.length > MAX_VISIBLE_LOG){
        el.logView.removeChild(el.logView.firstChild);
      }
      trimArrayToMax(logLines, MAX_VISIBLE_LOG, LOG_TRIM_CHUNK);
      el.logView.scrollTop = el.logView.scrollHeight;
      updateHomeLog();
    }

    function normalizeToastType(type){
      const raw = String(type || "info").toLowerCase();
      if(raw === "notice") return "info";
      if(raw === "warning") return "warn";
      if(raw === "critical") return "error";
      return raw;
    }

    function normalizeToastTitleType(type){
      const raw = String(type || "info").toLowerCase();
      if(raw === "warn") return "warning";
      return raw;
    }

    function getToastIconSvg(type){
      const tType = normalizeToastType(type);
      if(tType === "success"){
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7.8"/></svg>';
      }
      if(tType === "warn"){
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.8l7.5 13h-15z"/><path d="M12 9.2v4.9"/><circle cx="12" cy="16.8" r="1"/></svg>';
      }
      if(tType === "error"){
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6"/></svg>';
      }
      if(tType === "ignite"){
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.4 3.8c.9 2-.1 3.1-1.1 4.3-1.1 1.3-2.2 2.6-2.2 4.8 0 2.4 1.9 4.3 4.3 4.3s4.3-1.9 4.3-4.3c0-2.6-1.8-4.1-3-5.2-.8-.7-1.5-1.3-2.3-3.9z"/><path d="M11.1 14.8c.4.9 1 1.4 2 1.7"/></svg>';
      }
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 8.6v4.7"/><circle cx="12" cy="16.6" r="1"/></svg>';
    }

    function dismissToast(toast){
      if(!toast || toast._dismissed) return;
      toast._dismissed = true;
      if(toast._timer){ clearTimeout(toast._timer); toast._timer = null; }
      if(toast._expandTimer){ clearTimeout(toast._expandTimer); toast._expandTimer = null; }
      toast.classList.remove("toast-show");
      toast.classList.add("toast-hide");
      setTimeout(()=>{ if(toast && toast.parentNode) toast.parentNode.removeChild(toast); }, 220);
    }

    function dismissCriticalAlert(alert){
      if(!alert || alert._dismissed) return;
      alert._dismissed = true;
      if(alert._dismissTimer){
        clearTimeout(alert._dismissTimer);
        alert._dismissTimer = null;
      }
      alert.classList.remove("is-visible");
      alert.classList.add("is-leaving");
      alert._dismissTimer = setTimeout(()=>{
        if(alert && alert.parentNode) alert.parentNode.removeChild(alert);
        if(alert) alert._dismissTimer = null;
      }, 220);
    }

    function dismissToastByKey(key){
      if(!key) return;
      const token = String(key);
      if(el.toastContainer){
        for(const node of Array.from(el.toastContainer.children)){
          if(node && node.dataset && node.dataset.key === token){
            dismissToast(node);
          }
        }
      }
      if(el.criticalAlertStack){
        for(const node of Array.from(el.criticalAlertStack.children)){
          if(node && node.dataset && node.dataset.key === token){
            dismissCriticalAlert(node);
          }
        }
      }
    }

    function ensureCriticalAlertStack(){
      let stack = el.criticalAlertStack || document.getElementById("criticalAlertStack");
      if(!stack && document.body){
        stack = document.createElement("aside");
        stack.id = "criticalAlertStack";
        stack.className = "critical-alert-stack";
        stack.setAttribute("aria-label", "Critical alerts");
        stack.setAttribute("aria-live", "assertive");
        document.body.appendChild(stack);
      }
      if(stack) el.criticalAlertStack = stack;
      return stack;
    }

    function showCriticalAlert(message, opts, titleText){
      const alertStack = ensureCriticalAlertStack();
      if(!alertStack) return false;
      const text = String(message || "");
      const key = (opts && opts.key) ? String(opts.key) : ("critical:" + text);
      let alert = null;
      for(const node of alertStack.children){
        if(node && node.dataset && node.dataset.key === key){
          alert = node;
          break;
        }
      }

      if(alert){
        const title = alert.querySelector(".critical-alert-title");
        const body = alert.querySelector(".critical-alert-text");
        const repeat = alert.querySelector(".critical-alert-repeat");
        const nextCount = Math.max(1, Number(alert.dataset.count) || 1) + 1;
        alert.dataset.count = String(nextCount);
        if(alert._dismissTimer){
          clearTimeout(alert._dismissTimer);
          alert._dismissTimer = null;
        }
        if(title) title.textContent = String(titleText || t("toastTitleCritical"));
        if(body) body.textContent = text;
        if(repeat){
          repeat.textContent = "×" + nextCount;
          repeat.hidden = false;
        }
        alert.classList.remove("is-leaving");
        alert._dismissed = false;
        void alert.offsetWidth;
        alert.classList.add("is-visible", "is-updated");
        setTimeout(()=>{ if(alert) alert.classList.remove("is-updated"); }, 360);
        return true;
      }

      alert = document.createElement("article");
      alert.className = "critical-alert";
      alert.dataset.key = key;
      alert.dataset.count = "1";
      alert.setAttribute("role", "alert");

      const body = document.createElement("div");
      body.className = "critical-alert-body";

      const meta = document.createElement("div");
      meta.className = "critical-alert-meta";
      const label = document.createElement("span");
      label.className = "critical-alert-label";
      label.textContent = "CRITICAL";
      const title = document.createElement("div");
      title.className = "critical-alert-title";
      title.textContent = String(titleText || t("toastTitleCritical"));
      const repeat = document.createElement("span");
      repeat.className = "critical-alert-repeat";
      repeat.hidden = true;
      meta.appendChild(label);
      meta.appendChild(title);
      meta.appendChild(repeat);

      const textNode = document.createElement("div");
      textNode.className = "critical-alert-text";
      textNode.textContent = text;

      body.appendChild(meta);
      body.appendChild(textNode);

      alert.appendChild(body);
      alertStack.appendChild(alert);
      requestAnimationFrame(()=>alert.classList.add("is-visible"));
      return true;
    }

    function getToastTitle(type, message){
      const msg = String(message || "");
      const lower = msg.toLowerCase();
      const rules = [
        {re:/lockout|락아웃/i, title:"LOCKOUT 경고"},
        {re:/abort|중단/i, title:"시퀀스 중단"},
        {re:/점화|ignition|ignite|thrust/i, title:"점화 상태"},
        {re:/카운트다운|countdown/i, title:"카운트다운"},
        {re:/시퀀스|sequence/i, title:"시퀀스 상태"},
        {re:/메타데이터|미지정/i, title:"메타데이터 없음"},
        {re:/미션|mission/i, title:"미션 설정"},
        {re:/점검|inspection/i, title:"설비 점검"},
        {re:/시리얼|serial/i, title:"시리얼 상태"},
        {re:/연결|connect|disconnected|connected|link/i, title:"연결 상태"},
        {re:/로드셀|loadcell/i, title:"로드셀"},
        {re:/복사|copy|clipboard/i, title:"복사 결과"},
        {re:/저장|save|saved/i, title:"저장"},
        {re:/설정|setting|변경|changed/i, title:"설정 변경"},
        {re:/안전|safety/i, title:"안전 모드"},
        {re:/스위치|switch/i, title:"스위치 상태"},
        {re:/이그나이터|igniter/i, title:"이그나이터 상태"},
        {re:/배터리|battery/i, title:"배터리 상태"},
        {re:/대시보드|dashboard/i, title:"대시보드"},
        {re:/강제|force/i, title:"강제 점화"}
      ];
      for(const rule of rules){
        if(rule.re.test(msg) || rule.re.test(lower)){
          return rule.title;
        }
      }
      if(type==="notice") return t("toastTitleNotice");
      if(type==="success") return t("toastTitleSuccess");
      if(type==="warning" || type==="warn") return t("toastTitleWarn");
      if(type==="critical") return t("toastTitleCritical");
      if(type==="error") return t("toastTitleError");
      if(type==="ignite") return t("toastTitleIgnite");
      return t("toastTitleInfo");
    }

    function compactMobileHudAlertText(message, toastType){
      const raw = String(message || "").replace(/\s+/g, " ").trim();
      if(!raw) return "";
      if(/(inspection|점검).*(완료|통과|ok|passed)/i.test(raw)) return "시스템 준비 완료";
      if(/(sequence|시퀀스).*(완료|complete)/i.test(raw)) return "시스템 준비 완료";
      if(/(lockout|락아웃)/i.test(raw)) return "LOCKOUT 감지";
      if(/(abort|중단)/i.test(raw)) return "시퀀스 중단";
      if(/(countdown|카운트다운)/i.test(raw)) return "카운트다운 시작";
      if(/(ignite|ignition|점화)/i.test(raw)) return "점화 진행";
      if(/(parachute|낙하산|사출)/i.test(raw)) return "낙하산 사출";
      if(/(disconnected|연결 해제|연결 끊)/i.test(raw)) return "연결 끊김";
      if(/(connected|연결됨|연결 완료)/i.test(raw)) return "연결됨";
      if(toastType === "success") return "시스템 준비 완료";
      let shortText = raw.split(/[.!?\n]/)[0].split("·")[0].trim();
      if(shortText.length > 20) shortText = shortText.slice(0, 19).trim() + "…";
      return shortText || "알림";
    }

    function resolveMobileHudStatusText(defaultText){
      if(!isMobileLayout()) return defaultText;
      if(!mobileHudAlertText || Date.now() > mobileHudAlertUntilMs) return defaultText;
      return mobileHudAlertText;
    }

    function showMobileHudAlert(message, toastType, durationMs){
      if(!isMobileLayout()) return false;
      const shortText = compactMobileHudAlertText(message, toastType);
      if(!shortText) return false;
      const holdMs = clampLocal(durationMs || 1500, 900, 2600);
      mobileHudAlertText = shortText;
      mobileHudAlertUntilMs = Date.now() + holdMs;
      if(mobileHudAlertTimer){
        clearTimeout(mobileHudAlertTimer);
        mobileHudAlertTimer = null;
      }
      mobileHudAlertTimer = setTimeout(()=>{
        mobileHudAlertText = "";
        mobileHudAlertUntilMs = 0;
        mobileHudAlertTimer = null;
        syncCountdownInlineStatus();
      }, holdMs + 40);
      syncCountdownInlineStatus();
      return true;
    }

    function showCameraBroadcastAlert(message, toastType, title, durationMs){
      if(!document.body.classList.contains("camera-view-active") || !el.cameraBroadcastAlert) return false;
      const type = String(toastType || "info").toLowerCase();
      const critical = type === "critical" || type === "error";
      const warning = type === "warning" || type === "warn" || type === "notice";
      const tone = critical ? "critical" : (warning ? "warning" : (type === "success" ? "success" : "info"));
      const label = critical ? "CRITICAL" : (warning ? "WARNING" : (type === "success" ? "CONFIRMED" : "INFORMATION"));
      if(cameraBroadcastAlertTimer){
        clearTimeout(cameraBroadcastAlertTimer);
        cameraBroadcastAlertTimer = 0;
      }
      if(cameraBroadcastAlertHideTimer){
        clearTimeout(cameraBroadcastAlertHideTimer);
        cameraBroadcastAlertHideTimer = 0;
      }
      if(el.cameraBroadcastAlertLabel) el.cameraBroadcastAlertLabel.textContent = label;
      if(el.cameraBroadcastAlertTitle) el.cameraBroadcastAlertTitle.textContent = String(title || "SYSTEM");
      if(el.cameraBroadcastAlertText) el.cameraBroadcastAlertText.textContent = String(message || "");
      el.cameraBroadcastAlert.className = "camera-broadcast-alert tone-" + tone;
      void el.cameraBroadcastAlert.offsetWidth;
      el.cameraBroadcastAlert.classList.add("is-visible");
      const holdMs = clampLocal(Number(durationMs) || 3600, 2200, 8000);
      cameraBroadcastAlertTimer = setTimeout(()=>{
        if(!el.cameraBroadcastAlert) return;
        el.cameraBroadcastAlert.classList.remove("is-visible");
        el.cameraBroadcastAlert.classList.add("is-leaving");
        cameraBroadcastAlertHideTimer = setTimeout(()=>{
          if(el.cameraBroadcastAlert){
            el.cameraBroadcastAlert.classList.add("hidden");
            el.cameraBroadcastAlert.classList.remove("is-leaving");
          }
          cameraBroadcastAlertHideTimer = 0;
        }, 260);
        cameraBroadcastAlertTimer = 0;
      }, holdMs);
      return true;
    }

    function showToast(message, type, opts){
      if(!el.toastContainer) el.toastContainer = document.getElementById("toastContainer");
      const rawType = type || "info";
      const rawTypeName = String(rawType).toLowerCase();
      const isCritical = rawTypeName === "critical" || !!(opts && opts.critical);
      const toastType = normalizeToastType(rawType);
      const titleType = isCritical ? "critical" : normalizeToastTitleType(rawType);
      const duration = (opts && opts.duration) ? opts.duration : 3000;
      const key = (opts && opts.key) ? String(opts.key) : null;
      const titleText = (opts && opts.title) ? String(opts.title) : getToastTitle(titleType, message);
      const sticky = !!(opts && opts.sticky);
      const forceToast = !!(opts && opts.forceToast);

      if(isCritical && showCriticalAlert(message, opts, titleText)) return;
      if(!el.toastContainer) return;

      if(!forceToast && showCameraBroadcastAlert(message, toastType, titleText, duration)) return;

      if(!forceToast && !sticky && showMobileHudAlert(message, toastType, duration)){
        return;
      }

      const keepExisting = opts && opts.keep;
      if(!keepExisting){
        for(const node of Array.from(el.toastContainer.children)){
          if(node && node.dataset && node.dataset.sticky === "1") continue;
          dismissToast(node);
        }
      }

      let existingToast = null;
      if(key){
        for(const node of el.toastContainer.children){
          if(node && node.dataset && node.dataset.key === key){
            existingToast = node;
            break;
          }
        }
      }

      if(existingToast){
        existingToast.className = "toast toast-" + toastType;
        const titleDiv = existingToast.querySelector(".toast-title");
        if(titleDiv) titleDiv.textContent = titleText;
        const textDiv = existingToast.querySelector(".toast-text");
        if(textDiv) textDiv.textContent = message;
        existingToast.dataset.full = message;
        existingToast.classList.remove("toast-expanded");
        if(existingToast._timer){ clearTimeout(existingToast._timer); }
        if(existingToast._expandTimer){ clearTimeout(existingToast._expandTimer); }
        existingToast.classList.remove("toast-hide");
        if(sticky) existingToast.dataset.sticky = "1";
        else if(existingToast.dataset && existingToast.dataset.sticky) delete existingToast.dataset.sticky;
        requestAnimationFrame(()=>existingToast.classList.add("toast-show"));
        existingToast._timer = setTimeout(()=>dismissToast(existingToast), duration);
        return;
      }

      const toast = document.createElement("div");
      toast.className = "toast toast-" + toastType;
      toast.setAttribute("role","status");
      toast.setAttribute("aria-live","polite");
      if(key) toast.dataset.key = key;
      if(sticky) toast.dataset.sticky = "1";


      const bodyDiv = document.createElement("div");
      bodyDiv.className = "toast-body";

      const titleDiv = document.createElement("div");
      titleDiv.className = "toast-title";
      titleDiv.textContent = titleText;

      const textDiv = document.createElement("div");
      textDiv.className = "toast-text";
      textDiv.textContent = message;

      toast.dataset.full = message;
      bodyDiv.appendChild(titleDiv);
      bodyDiv.appendChild(textDiv);

      toast.appendChild(bodyDiv);

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "toast-close";
      closeBtn.setAttribute("aria-label","Dismiss");
      closeBtn.textContent = "×";
      closeBtn.addEventListener("click",(ev)=>{
        ev.stopPropagation();
        dismissToast(toast);
      });
      toast.appendChild(closeBtn);

      toast.addEventListener("click", ()=>{
        if(!toast.classList.contains("toast-expanded")){
          toast.classList.add("toast-expanded");
          textDiv.textContent = toast.dataset.full || message;
          if(toast._timer){ clearTimeout(toast._timer); toast._timer = null; }
          if(toast._expandTimer){ clearTimeout(toast._expandTimer); toast._expandTimer = null; }
          return;
        }
        dismissToast(toast);
      });
      el.toastContainer.appendChild(toast);
      requestAnimationFrame(()=>toast.classList.add("toast-show"));
      toast._timer = setTimeout(()=>dismissToast(toast), duration);
    }

    function addDebugLog(message){
      addLogLine(String(message || ""), "DBG");
    }

    function getAlarmRuntime(code){
      const key = String(code || "");
      if(!alarmState[key]){
        alarmState[key] = {
          active: false,
          lastNotifyMs: 0,
          lastClearMs: 0
        };
      }
      return alarmState[key];
    }

    function alarmLevelToToastType(level){
      if(level === ALERT_LEVEL.CRITICAL) return "critical";
      if(level === ALERT_LEVEL.WARNING) return "warning";
      if(level === ALERT_LEVEL.NOTICE) return "notice";
      return "info";
    }

    function alarmLevelTitle(level){
      if(level === ALERT_LEVEL.CRITICAL) return t("toastTitleCritical");
      if(level === ALERT_LEVEL.WARNING) return t("toastTitleWarn");
      if(level === ALERT_LEVEL.NOTICE) return t("toastTitleNotice");
      return t("toastTitleInfo");
    }

    function alarmLogTag(level){
      if(level === ALERT_LEVEL.CRITICAL) return "ALARM!";
      if(level === ALERT_LEVEL.WARNING) return "ALARM";
      if(level === ALERT_LEVEL.NOTICE) return "NOTICE";
      return "INFO";
    }

    function notifyAlarm(code, params, opts){
      const def = ALARM_DEFS[code];
      if(!def) return;
      const runtime = getAlarmRuntime(code);
      const now = Date.now();
      const rateLimitMs = (opts && opts.rateLimitMs != null)
        ? Math.max(0, Number(opts.rateLimitMs) || 0)
        : (def.rateLimitMs || 0);
      if(!(opts && opts.force) && rateLimitMs > 0 && (now - runtime.lastNotifyMs) < rateLimitMs){
        return;
      }

      const message = (opts && opts.message != null)
        ? String(opts.message)
        : (def.textKey ? t(def.textKey, params || {}) : String(code));

      runtime.lastNotifyMs = now;
      addLogLine("[ALARM][" + code + "] " + message, alarmLogTag(def.level));

      if(opts && opts.toast === false) return;

      showToast(message, alarmLevelToToastType(def.level), {
        key: "alarm-" + code,
        keep: !!def.sticky,
        sticky: !!def.sticky,
        duration: (opts && opts.duration) ? opts.duration : (def.level === ALERT_LEVEL.CRITICAL ? 12000 : 7000),
        title: alarmLevelTitle(def.level)
      });
    }

    function setAlarmActive(code, active, params, opts){
      const def = ALARM_DEFS[code];
      if(!def) return;
      const runtime = getAlarmRuntime(code);
      const nextActive = !!active;

      if(nextActive){
        const firstRaise = !runtime.active;
        runtime.active = true;
        if(firstRaise){
          notifyAlarm(code, params, opts);
        }
        return;
      }

      if(!runtime.active) return;
      runtime.active = false;
      runtime.lastClearMs = Date.now();
      dismissToastByKey("alarm-" + code);

      if(def.clearKey){
        const clearMessage = t(def.clearKey, params || {});
        addLogLine("[ALARM CLEAR][" + code + "] " + clearMessage, "INFO");
      }
    }

    function reportSilentException(source, err){
      const src = String(source || "unknown");
      const now = Date.now();
      const msg = (err && err.message) ? err.message : String(err || "unknown");

      let stat = silentExceptionState[src];
      if(!stat){
        stat = {windowStartMs: now, count: 0, lastAlarmMs: 0};
        silentExceptionState[src] = stat;
      }

      if((now - stat.windowStartMs) > 5000){
        stat.windowStartMs = now;
        stat.count = 0;
      }
      stat.count += 1;

      addDebugLog("[" + src + "] " + msg);

      if(stat.count >= 3 && (now - stat.lastAlarmMs) >= 10000){
        stat.lastAlarmMs = now;
        notifyAlarm("INTERNAL_EXCEPTION", {
          source: src,
          err: msg
        }, {force: true});
      }
    }

    function handleWsBackpressureSignal(counter){
      const next = Math.max(0, Number(counter) || 0);
      if(next < lastWsQueueDropCount){
        lastWsQueueDropCount = next;
        return;
      }
      if(next === lastWsQueueDropCount) return;

      const delta = next - lastWsQueueDropCount;
      lastWsQueueDropCount = next;
      notifyAlarm("WS_BACKPRESSURE", {total: next, delta});
    }

    function evaluateRuntimeAlarms(nowMs){
      if(replaySourceActive || simEnabled){
        setAlarmActive("WS_DISCONNECTED", false);
        setAlarmActive("DATA_TIMEOUT", false);
        setAlarmActive("RX_HZ_DROP", false);
        return;
      }

      const now = Number(nowMs || Date.now());
      const sinceOk = Math.max(0, now - (lastOkMs || 0));
      const wsDisconnected = !!(wsEverConnected && connOk && !wsConnected);
      const dataTimedOut = !!(sampleCounter > 0 && sinceOk >= DATA_TIMEOUT_ALARM_MS);
      const hzDrop = !!(sampleCounter > 0 && wsConnected && rxHzWindow > 0 && rxHzWindow <= rxHzWarnThreshold());
      const hzRecovered = (rxHzWindow <= 0 || rxHzWindow >= rxHzRecoverThreshold() || !wsConnected);

      setAlarmActive("WS_DISCONNECTED", wsDisconnected, {ms: sinceOk});
      setAlarmActive("DATA_TIMEOUT", dataTimedOut, {ms: sinceOk});

      if(hzDrop){
        setAlarmActive("RX_HZ_DROP", true, {target: targetStreamHz(), hz: rxHzWindow});
      }else if(hzRecovered){
        setAlarmActive("RX_HZ_DROP", false, {target: targetStreamHz(), hz: rxHzWindow});
      }
    }

    function telemetryBool(value){
      if(value == null) return null;
      if(value === true) return true;
      if(value === false) return false;
      const n = Number(value);
      if(isFinite(n)) return n !== 0;
      const s = String(value).trim().toLowerCase();
      if(s === "true" || s === "yes" || s === "on") return true;
      if(s === "false" || s === "no" || s === "off") return false;
      return null;
    }

    function updateGpsFixAlarm(data, isReplaySample){
      if(isReplaySample || simEnabled || replaySourceActive || !data) return;
      const fix = telemetryBool(data.gps_fix ?? data.gpsFix ?? data.fix ?? null);
      if(fix == null) return;

      if(gpsFixAlarmState === null){
        gpsFixAlarmState = fix;
        if(fix){
          notifyAlarm("GPS_FIX_RECOVERED", {}, {force:true, duration:4200});
        }
        return;
      }

      if(fix === gpsFixAlarmState) return;
      gpsFixAlarmState = fix;
      if(fix){
        setAlarmActive("GPS_FIX_LOST", false);
        notifyAlarm("GPS_FIX_RECOVERED", {}, {force:true, duration:4200});
      }else{
        setAlarmActive("GPS_FIX_LOST", true, {}, {force:true});
      }
    }

    function mapAbortReasonCode(code){
      if(code === 1) return "user";
      if(code === 2) return "igniter";
      if(code === 3) return "lockout";
      return null;
    }
    function getAbortReasonLabel(){
      if(lastAbortReason === "user") return t("abortReasonUser");
      if(lastAbortReason === "igniter") return t("abortReasonIgniter");
      if(lastAbortReason === "lockout") return t("abortReasonLockout");
      return t("abortReasonUnknown");
    }

    let audioCtx = null;
    function getAudioCtx(){
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return null;
      if(!audioCtx) audioCtx = new Ctx();
      if(audioCtx.state === "suspended"){
        audioCtx.resume().catch(()=>{});
      }
      return audioCtx;
    }

    const COUNTDOWN_AUDIO_SOURCES = {
      10: "/mp3/t-10.mp3",
      9: "/mp3/9.mp3",
      8: "/mp3/8.mp3",
      7: "/mp3/7.mp3",
      6: "/mp3/6.mp3",
      5: "/mp3/5.mp3",
      4: "/mp3/4.mp3",
      3: "/mp3/3.mp3",
      2: "/mp3/2.mp3",
      1: "/mp3/1.mp3",
      0: "/mp3/ignition.mp3"
    };
    const countdownAudioCache = {};
    function playCountdownMp3(secRemain){
      const key = Number(secRemain);
      if(!isFinite(key) || !(key in COUNTDOWN_AUDIO_SOURCES)) return;
      let audio = countdownAudioCache[key];
      if(!audio){
        audio = new Audio(COUNTDOWN_AUDIO_SOURCES[key]);
        audio.preload = "auto";
        countdownAudioCache[key] = audio;
      }
      try{
        audio.currentTime = 0;
        audio.play().catch(()=>{});
      }catch(e){}
    }
    function playTone(freq, durationMs, delayMs){
      const ctx = getAudioCtx();
      if(!ctx) return;
      const startAt = ctx.currentTime + (delayMs || 0) / 1000;
      const durSec = (durationMs || 0) / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durSec);
      osc.connect(gain).connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + durSec + 0.05);
    }
    function playBeepPattern(pattern){
      let offset = 0;
      for(const tone of pattern){
        const freq = tone.freq || 440;
        const dur = tone.dur || 120;
        const gap = tone.gap || 0;
        playTone(freq, dur, offset);
        offset += dur + gap;
      }
    }

    function safetyLineSuffix(){
      return t("safetyLineSuffix");
    }

    function updateRelaySafePill(){
      if(!el.relaySafePill) return;
      setLockoutVisual(lockoutLatched);

      if(lockoutLatched){
        const name = relayMaskName(lockoutRelayMask);
        el.relaySafePill.textContent = t("relaySafeLockout", {name});
        el.relaySafePill.style.color = "#991b1b";
      }else{
        el.relaySafePill.textContent = relaySafeEnabled ? t("relaySafeSafe") : t("relaySafeOff");
        el.relaySafePill.style.color = relaySafeEnabled ? "#166534" : "#64748b";
      }
    }

    function updateSerialPill(){
      const mode = getConnectTransportMode();
      const enabled = (mode === "serial");
      const ok = enabled && serialConnected;
      if(el.serialStatus && el.serialStatusText){
        el.serialStatus.classList.remove("ok","bad");
        if(mode === "wifi"){
          el.serialStatus.classList.add("ok");
          el.serialStatusText.textContent = t("modeWifi");
        }else if(ok){
          el.serialStatus.classList.add("ok");
          el.serialStatusText.textContent = t("serialConnected");
        }else{
          el.serialStatus.classList.add("bad");
          el.serialStatusText.textContent = t("serialDisconnected");
        }
      }
      updateSerialControlTile();
      updateMobileControlPills();
      syncWelcomeConnectScreen(connOk || serialConnected || wsConnected);
    }

    function isControlUnlocked(){
      return controlAuthority && inspectionState==="passed" && !lockoutLatched;
    }
    function isArmLockEngaged(){
      return !!(el.armLockToggle && el.armLockToggle.checked);
    }
    function isSequenceBusyForPanelModes(){
      return virtualMissionActive || sequenceActive || isFirmwareSequenceRunningState(currentSt) || localTplusActive || tplusUiActive;
    }
    function isTabletPanelModeBlocked(){
      return isTabletControlsLayout() && isSequenceBusyForPanelModes();
    }
    function showTabletPanelBlockedToast(mode){
      const label = mode === "launcher" ? "발사대" : "리플레이";
      showToast("시퀀스 진행 중에는 " + label + "를 열 수 없습니다.", "notice", {key:"tablet-panel-lock-" + mode});
    }
    function canOperateLauncher(){
      const relayOn = latestTelemetry && latestTelemetry.rly === 1;
      const switchOn = latestTelemetry && latestTelemetry.sw === 1;
      return !(lockoutLatched || safetyModeEnabled || replaySourceActive || currentSt !== 0 || relayOn || switchOn);
    }

    function updateInspectionPill(){
      updateMobileControlPills();
    }

    function updateInspectionAccess(){
      syncMobileControlButtons();
    }

    function markInspectionSyncPending(passed){
      inspectionSyncPendingValue = passed ? 1 : 0;
      inspectionSyncPendingUntilMs = Date.now() + 1500;
    }

    function applyInspectionAuthorityFromTelemetry(rawValue){
      if(rawValue == null || inspectionRunning) return false;
      const num = Number(rawValue);
      if(!isFinite(num)) return false;
      const value = num !== 0 ? 1 : 0;
      const now = Date.now();
      if(inspectionSyncPendingValue != null){
        if(value === inspectionSyncPendingValue){
          inspectionSyncPendingValue = null;
          inspectionSyncPendingUntilMs = 0;
        }else if(now < inspectionSyncPendingUntilMs){
          return false;
        }else{
          inspectionSyncPendingValue = null;
          inspectionSyncPendingUntilMs = 0;
        }
      }
      const passed = value === 1;
      const nextState = passed ? "passed" : "failed";
      if(controlAuthority === passed && inspectionState === nextState) return false;
      controlAuthority = passed;
      inspectionState = nextState;
      if(passed) inspectionLastFailedKeys = [];
      updateInspectionPill();
      updateControlAccessUI(currentSt);
      return true;
    }

    function needsInspectionBeforeSequence(){
      return !(controlAuthority && inspectionState === "passed");
    }

    function syncMobileSequencePrimaryLabels(){
      const inspectionFirst = needsInspectionBeforeSequence();
      const label = inspectionFirst ? (t("controlInspectionLabel") || "설비 점검") : "시퀀스 시작";
      if(el.mobileSequenceStartLabel) el.mobileSequenceStartLabel.textContent = label;
      if(el.mobileSequenceStartBtn) el.mobileSequenceStartBtn.setAttribute("aria-label", label);
      if(el.mobileSequenceWideLabel) el.mobileSequenceWideLabel.textContent = label;
      if(el.mobileSequenceWideBtn) el.mobileSequenceWideBtn.setAttribute("aria-label", label);
    }

    function updateMobileSequenceCardButtons(st){
      const state = (st == null) ? currentSt : st;
      const running = !!(virtualMissionActive || sequenceActive || isFirmwareSequenceRunningState(state) || localTplusActive || userWaitingLocal);
      const storageGuard = getSequenceStorageGuard();
      const startBlocked = !!(replaySourceActive || lockoutLatched || running || inspectionRunning || safetyModeEnabled || storageGuard.blocked);
      const pauseBlocked = !!(replaySourceActive || lockoutLatched || !(state === 1 || userWaitingLocal));
      const stopBlocked = !!(replaySourceActive || lockoutLatched || !running);
      const setBtn = (btn, blocked)=>{
        if(!btn) return;
        btn.disabled = !!blocked;
        btn.classList.toggle("disabled", !!blocked);
        btn.setAttribute("aria-disabled", blocked ? "true" : "false");
      };
      setBtn(el.mobileSequenceStartBtn, startBlocked);
      setBtn(el.mobileSequenceWideBtn, startBlocked);
      setBtn(el.mobileSequencePauseBtn, pauseBlocked);
      setBtn(el.mobileSequenceStopBtn, stopBlocked);
      syncMobileSequencePrimaryLabels();
      syncSequenceStorageGuardUi();
    }

    function updateControlAccessUI(st){
      const state = (st==null) ? currentSt : st;
      const unlocked=isControlUnlocked();
      if(el.forceBtn){
        const igniterBlocked = isIgniterCheckEnabled() && latestTelemetry.ic !== 1;
        const blocked = replaySourceActive || ((!unlocked && !loadcellErrorActive) || lockoutLatched || state!==0 || sequenceActive || igniterBlocked || safetyModeEnabled);
        el.forceBtn.disabled = blocked;
        el.forceBtn.classList.toggle("disabled", blocked);
      }
      if(el.launcherOpenBtns && el.launcherOpenBtns.length){
        const blocked = !canOperateLauncher();
        el.launcherOpenBtns.forEach(btn=>{
          btn.classList.toggle("disabled", blocked);
          btn.setAttribute("aria-disabled", blocked ? "true" : "false");
        });
      }
      if(el.replayOpenBtns && el.replayOpenBtns.length){
        const blocked = isTabletPanelModeBlocked();
        el.replayOpenBtns.forEach(btn=>{
          btn.classList.toggle("disabled", blocked);
          btn.setAttribute("aria-disabled", blocked ? "true" : "false");
        });
      }
      updateInspectionPill();
      updateMobileControlPills();
      syncMobileControlButtons();
      updateMobileSequenceStatusLabel(sequenceActive, state, lockoutLatched);
      updateMobileSequenceCardButtons(state);
      updateMissionStandbyButtonUi();
      updateMissionEditLockUI();
      updateDesktopNavAbortButton();
    }

    const MOBILE_PANEL_MEDIA = window.matchMedia("(max-width: 900px) and (orientation: landscape), (max-width: 600px)");
    const PHONE_LANDSCAPE_MEDIA = window.matchMedia("(orientation: landscape) and (max-width: 900px)");
    const TABLET_CONTROLS_MEDIA = window.matchMedia("(min-width: 768px) and (max-width: 1440px)");
    let mobileControlsActive = false;
    let tabletControlsOpen = false;
    let gyroViewportExpandedAt = 0;
    let gyroViewportLastTapAt = 0;
    let gyroViewportLastTapX = 0;
    let gyroViewportLastTapY = 0;
    let launcherPanelActive = false;
    let missionPanelActive = false;
    let inspectionPanelActive = false;
    let mobileHudAlertText = "";
    let mobileHudAlertUntilMs = 0;
    let mobileHudAlertTimer = null;
    let intelligentMobileSessionActive = false;
    let intelligentMobilePreviousHudPreview = false;
    let intelligentMobileRequestedFullscreen = false;
    let intelligentMobileAutoEntering = false;

    function isForcedMobileHudPreview(){
      return !!(uiSettings && uiSettings.mobileHudPreview && PHONE_LANDSCAPE_MEDIA.matches && isTouchCapableDevice());
    }
    function setIntelligentMobileReturnVisible(show){
      const next = !!show;
      document.documentElement.classList.toggle("intelligent-mobile-active", next);
      if(el.intelligentMobileReturn){
        el.intelligentMobileReturn.setAttribute("aria-hidden", next ? "false" : "true");
      }
    }
    function enterIntelligentMobileFromGyroPreview(){
      if(!uiSettings || !isPhoneLandscapeLayout()) return;
      const alreadyActive = intelligentMobileSessionActive && isPhoneLandscapeLayout();
      if(!intelligentMobileSessionActive){
        intelligentMobilePreviousHudPreview = !!uiSettings.mobileHudPreview;
      }
      intelligentMobileSessionActive = true;
      setIntelligentMobileReturnVisible(true);
      uiSettings.mobileHudPreview = true;
      if(el.mobileHudPreviewToggle) el.mobileHudPreviewToggle.checked = true;
      saveSettings();
      applySettingsToUI();
      if(!alreadyActive){
        showToast(t("intelligentMobileEnteredToast"), "info");
      }
      if(!alreadyActive && !isDocumentFullscreen()){
        requestDocumentFullscreen().then((ok)=>{
          intelligentMobileRequestedFullscreen = !!ok;
        });
      }
    }
    function exitIntelligentMobile(){
      if(!uiSettings) return;
      const shouldRestore = intelligentMobileSessionActive;
      intelligentMobileSessionActive = false;
      setIntelligentMobileReturnVisible(false);
      if(shouldRestore){
        uiSettings.mobileHudPreview = !!intelligentMobilePreviousHudPreview;
      }else{
        uiSettings.mobileHudPreview = false;
      }
      if(el.mobileHudPreviewToggle) el.mobileHudPreviewToggle.checked = !!uiSettings.mobileHudPreview;
      saveSettings();
      applySettingsToUI();
      if(intelligentMobileRequestedFullscreen && isDocumentFullscreen()){
        exitDocumentFullscreen();
      }
      intelligentMobileRequestedFullscreen = false;
    }
    function getFullscreenElement(){
      return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
    }
    function isDocumentFullscreen(){
      return !!getFullscreenElement();
    }
    function requestDocumentFullscreen(){
      const root = document.documentElement;
      if(!root) return Promise.resolve(false);
      const fn = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
      if(typeof fn !== "function") return Promise.resolve(false);
      try{
        const ret = fn.call(root);
        if(ret && typeof ret.then === "function"){
          return ret.then(()=>true).catch(()=>false);
        }
        return Promise.resolve(true);
      }catch(e){
        return Promise.resolve(false);
      }
    }
    function exitDocumentFullscreen(){
      const fn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if(typeof fn !== "function") return Promise.resolve(false);
      try{
        const ret = fn.call(document);
        if(ret && typeof ret.then === "function"){
          return ret.then(()=>true).catch(()=>false);
        }
        return Promise.resolve(true);
      }catch(e){
        return Promise.resolve(false);
      }
    }
    function isMobileImmersiveEnabled(){
      return !!(uiSettings && uiSettings.mobileImmersive);
    }
    function shouldUseMobileImmersive(){
      if(!isMobileImmersiveEnabled()) return false;
      return document.documentElement.classList.contains("phone-landscape-layout");
    }
    function applyMobileImmersiveMode(fromUserGesture){
      if(shouldUseMobileImmersive()){
        if(!isDocumentFullscreen() && fromUserGesture){
          requestDocumentFullscreen();
        }
        return;
      }
      if(isDocumentFullscreen()){
        exitDocumentFullscreen();
      }
    }
    function syncMobileImmersiveToggleState(){
      if(!uiSettings || !el.mobileFullscreenToggle) return;
      if(uiSettings.mobileImmersive && !isDocumentFullscreen()){
        uiSettings.mobileImmersive = false;
        saveSettings();
      }
      el.mobileFullscreenToggle.checked = !!uiSettings.mobileImmersive;
    }
    function moveMobileAbortPanelToBody(){
      return;
    }
    function restoreMobileAbortPanelFromBody(){
      if(!el.mobileAbortPanel || !mobileAbortPanelPortalState.mountedToBody) return;
      const parent = mobileAbortPanelPortalState.homeParent;
      const nextSibling = mobileAbortPanelPortalState.homeNextSibling;
      if(parent){
        if(nextSibling && nextSibling.parentNode === parent){
          parent.insertBefore(el.mobileAbortPanel, nextSibling);
        }else{
          parent.appendChild(el.mobileAbortPanel);
        }
      }
      mobileAbortPanelPortalState.homeParent = null;
      mobileAbortPanelPortalState.homeNextSibling = null;
      mobileAbortPanelPortalState.mountedToBody = false;
    }
    function moveMobileControlsPanelToBody(){
      if(!el.mobileControlsPanel || mobileControlsPanelPortalState.mountedToBody) return;
      const parent = el.mobileControlsPanel.parentNode;
      if(!parent) return;
      mobileControlsPanelPortalState.homeParent = parent;
      mobileControlsPanelPortalState.homeNextSibling = el.mobileControlsPanel.nextSibling;
      document.body.appendChild(el.mobileControlsPanel);
      mobileControlsPanelPortalState.mountedToBody = true;
    }
    function restoreMobileControlsPanelFromBody(){
      if(!el.mobileControlsPanel || !mobileControlsPanelPortalState.mountedToBody) return;
      const parent = mobileControlsPanelPortalState.homeParent;
      const nextSibling = mobileControlsPanelPortalState.homeNextSibling;
      if(parent){
        if(nextSibling && nextSibling.parentNode === parent){
          parent.insertBefore(el.mobileControlsPanel, nextSibling);
        }else{
          parent.appendChild(el.mobileControlsPanel);
        }
      }
      mobileControlsPanelPortalState.homeParent = null;
      mobileControlsPanelPortalState.homeNextSibling = null;
      mobileControlsPanelPortalState.mountedToBody = false;
    }
    function isMobileLayout(){
      return isForcedMobileHudPreview() || (MOBILE_PANEL_MEDIA.matches && isTouchCapableDevice());
    }
    function isDesktopLayout(){
      return !!(window.matchMedia && window.matchMedia("(min-width: 768px) and (pointer: fine)").matches);
    }
    function restoreGyroViewportFromDesktopPreview(){
      if(!el.gyro3dViewport || !desktopGyroPreviewPortalState.mounted) return;
      const parent = desktopGyroPreviewPortalState.homeParent;
      const nextSibling = desktopGyroPreviewPortalState.homeNextSibling;
      if(parent){
        if(nextSibling && nextSibling.parentNode === parent){
          parent.insertBefore(el.gyro3dViewport, nextSibling);
        }else{
          parent.appendChild(el.gyro3dViewport);
        }
      }
      el.gyro3dViewport.classList.remove("is-desktop-preview-mounted");
      desktopGyroPreviewPortalState.homeParent = null;
      desktopGyroPreviewPortalState.homeNextSibling = null;
      desktopGyroPreviewPortalState.mounted = false;
    }
    function restoreGyroViewportFromCameraPreview(){
      if(!el.gyro3dViewport || !cameraGyroPreviewPortalState.mounted) return;
      const parent = cameraGyroPreviewPortalState.homeParent;
      const nextSibling = cameraGyroPreviewPortalState.homeNextSibling;
      if(parent){
        if(nextSibling && nextSibling.parentNode === parent){
          parent.insertBefore(el.gyro3dViewport, nextSibling);
        }else{
          parent.appendChild(el.gyro3dViewport);
        }
      }
      el.gyro3dViewport.classList.remove("is-camera-preview-mounted");
      el.gyro3dViewport.classList.remove("is-camera-gyro-plus-mounted");
      cameraGyroPreviewPortalState.homeParent = null;
      cameraGyroPreviewPortalState.homeNextSibling = null;
      cameraGyroPreviewPortalState.mounted = false;
    }
    function normalizeCameraLayerDom(){
      if(!el.cameraView) return;
      const layers = [
        el.cameraGyroPlusStage,
        el.webcamPanel,
        el.cameraSequenceDock,
        el.cameraControlMenuLayer,
        el.cameraHud
      ];
      layers.forEach((layer)=>{
        if(layer && layer.parentNode !== el.cameraView) el.cameraView.appendChild(layer);
      });
    }
    function activateCameraGyroPlusViewport(){
      gyroCameraState.panX = 0;
      gyroCameraState.panY = 0;
      gyroCameraState.panZ = 0;
      gyroCameraState.targetX = 0;
      gyroCameraState.targetY = GYRO_WORLD_ALTITUDE_BASE;
      gyroCameraState.targetZ = 0;
      gyroCameraState.distance = GYRO_TERRAIN_DEFAULT_CAMERA_DISTANCE;
      gyroCameraState.desiredDistance = GYRO_TERRAIN_DEFAULT_CAMERA_DISTANCE;
      gyroCameraState.manualZoomUntilMs = 0;
      gyroCameraState.yawDeg = GYRO_CAMERA_DEFAULT.yawDeg;
      gyroCameraState.pitchDeg = 20;

      if(gyroTerrainState.status === "ready" && gyroTerrainState.mesh &&
         gyroGl && gyroGl.terrain && gyroGl.terrain.count <= 0){
        applyGyroTerrainMeshToGl(gyroTerrainState.mesh);
      }
      ensureGyroTerrainForGeo(getGyroTerrainReferenceGeo());
      [0, 80, 240, 700].forEach((delay)=>{
        setTimeout(()=>{
          if(!document.body.classList.contains("camera-gyro-plus-layout")) return;
          resizeGyroGl();
          renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        }, delay);
      });
    }
    function syncCameraGyroPreviewMount(){
      if(!el.gyro3dViewport || !el.cameraGyroPreviewMount) return;
      normalizeCameraLayerDom();
      const gyroPlusLayout = document.body.classList.contains("camera-gyro-plus-layout");
      const cameraMount = gyroPlusLayout && el.cameraGyroPlusMount
        ? el.cameraGyroPlusMount
        : el.cameraGyroPreviewMount;
      const shouldMount = document.body.classList.contains("camera-view-active") &&
        !gyroViewportPortalState.mountedToBody &&
        !homeGyroDockState.mountedToHome &&
        !isGyroViewportExpanded();
      if(shouldMount){
        if(cameraGyroPreviewPortalState.mounted){
          const mountChanged = el.gyro3dViewport.parentNode !== cameraMount;
          const enteringGyroPlus = gyroPlusLayout &&
            !el.gyro3dViewport.classList.contains("is-camera-gyro-plus-mounted");
          if(mountChanged) cameraMount.appendChild(el.gyro3dViewport);
          el.gyro3dViewport.classList.toggle("is-camera-gyro-plus-mounted", gyroPlusLayout);
          if(gyroPlusLayout && (mountChanged || enteringGyroPlus)) activateCameraGyroPlusViewport();
          requestAnimationFrame(()=>{
            resizeGyroGl();
            renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          });
          return;
        }
        restoreGyroViewportFromDesktopPreview();
        const parent = el.gyro3dViewport.parentNode;
        if(!parent) return;
        cameraGyroPreviewPortalState.homeParent = parent;
        cameraGyroPreviewPortalState.homeNextSibling = el.gyro3dViewport.nextSibling;
        cameraMount.appendChild(el.gyro3dViewport);
        el.gyro3dViewport.classList.add("is-camera-preview-mounted");
        el.gyro3dViewport.classList.toggle("is-camera-gyro-plus-mounted", gyroPlusLayout);
        gyroCameraState.targetX = 0;
        gyroCameraState.targetY = gyroPlusLayout
          ? GYRO_WORLD_ALTITUDE_BASE
          : GYRO_WORLD_ALTITUDE_BASE + 0.34 + GYRO_CAMERA_PREVIEW_TARGET_Y_OFFSET;
        gyroCameraState.targetZ = 0;
        gyroCameraState.distance = gyroPlusLayout ? GYRO_TERRAIN_DEFAULT_CAMERA_DISTANCE : GYRO_CAMERA_PREVIEW_DISTANCE;
        gyroCameraState.desiredDistance = gyroCameraState.distance;
        if(gyroPlusLayout){
          activateCameraGyroPlusViewport();
        }
        cameraGyroPreviewPortalState.mounted = true;
        requestAnimationFrame(()=>{
          resizeGyroGl();
          renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        });
        return;
      }
      restoreGyroViewportFromCameraPreview();
    }
    function syncDesktopGyroPreviewMount(){
      // The dashboard now dedicates this space to vehicle status. The same
      // renderer is still portaled into the camera view when that page opens.
      restoreGyroViewportFromDesktopPreview();
    }
    function isTouchCapableDevice(){
      if((navigator.maxTouchPoints || 0) > 0) return true;
      if("ontouchstart" in window) return true;
      if(window.matchMedia){
        if(window.matchMedia("(pointer: coarse)").matches) return true;
        if(window.matchMedia("(any-pointer: coarse)").matches) return true;
      }
      const ua = String((navigator && navigator.userAgent) || "");
      return /Android|iPhone|iPad|iPod|Windows Phone|IEMobile|Opera Mini|Mobile/i.test(ua);
    }
    function isTabletControlsLayout(){
      return !isMobileLayout() && TABLET_CONTROLS_MEDIA.matches && isTouchCapableDevice();
    }
    function isLauncherOverlayVisible(){
      return !!(launcherOverlayEl && !launcherOverlayEl.classList.contains("hidden"));
    }
    function isMissionOverlayVisible(){
      return !!(el.missionOverlay && !el.missionOverlay.classList.contains("hidden"));
    }
    function isInspectionOverlayVisible(){
      return !!(el.inspectionOverlay && !el.inspectionOverlay.classList.contains("hidden"));
    }
    function cacheDialogDockHome(dialogEl, dockState){
      if(!dialogEl || !dockState || dockState.homeParent) return;
      dockState.homeParent = dialogEl.parentNode || null;
      dockState.homeNextSibling = dialogEl.nextSibling || null;
    }
    function mountDialogToPanel(dialogEl, mountEl, dockState){
      if(!dialogEl || !mountEl || !dockState) return false;
      cacheDialogDockHome(dialogEl, dockState);
      if(dialogEl.parentNode !== mountEl){
        mountEl.appendChild(dialogEl);
      }
      dialogEl.classList.add("is-embedded-panel");
      return true;
    }
    function restoreDialogFromPanel(dialogEl, dockState){
      if(!dialogEl || !dockState) return;
      dialogEl.classList.remove("is-embedded-panel");
      const parent = dockState.homeParent;
      if(!parent) return;
      if(dialogEl.parentNode === parent) return;
      const nextSibling = dockState.homeNextSibling;
      if(nextSibling && nextSibling.parentNode === parent){
        parent.insertBefore(dialogEl, nextSibling);
      }else{
        parent.appendChild(dialogEl);
      }
    }
    function isMobileLauncherPanelVisible(){
      return !!(el.mobileControlsPanel && el.mobileControlsPanel.classList.contains("is-launcher-view"));
    }
    function isMobileMissionPanelVisible(){
      return !!(el.mobileControlsPanel && el.mobileControlsPanel.classList.contains("is-mission-view"));
    }
    function isMobileInspectionPanelVisible(){
      return !!(el.mobileControlsPanel && el.mobileControlsPanel.classList.contains("is-inspection-view"));
    }
    function isMobileServoPanelVisible(){
      return !!(el.mobileControlsPanel && el.mobileControlsPanel.classList.contains("is-servo-view"));
    }
    function isServoControlVisible(){
      return !!(
        isMobileServoPanelVisible() ||
        (el.hardwareServoOverlay && !el.hardwareServoOverlay.classList.contains("hidden"))
      );
    }
    function getControlsPanelTitle(){
      if(replayUiActive) return "DATA REPLAY";
      if(launcherPanelActive || isMobileLauncherPanelVisible()) return "LAUNCHER CONTROL";
      if(isMobileServoPanelVisible()) return "SERVO MOTOR CONTROL";
      if(missionPanelActive || isMobileMissionPanelVisible()) return "MISSION PROFILE";
      if(inspectionPanelActive || isMobileInspectionPanelVisible()) return "INSPECTION";
      return "CONTROL PANEL";
    }
    function syncControlsPanelTitle(){
      const title = getControlsPanelTitle();
      if(el.controlsCardTitle){
        el.controlsCardTitle.textContent = title;
      }
      if(el.mobileControlsHeadTitle){
        el.mobileControlsHeadTitle.textContent = (title === "CONTROL PANEL") ? getOperationModePanelTitle() : title;
      }
    }
    function setMobileLauncherPanelVisible(show){
      if(!el.mobileControlsPanel) return;
      const next = !!show;
      if(next){
        setMobileMissionPanelVisible(false);
        setMobileInspectionPanelVisible(false);
        setMobileServoPanelVisible(false);
      }
      el.mobileControlsPanel.classList.toggle("is-launcher-view", next);
      if(el.mobileLauncherPanel){
        el.mobileLauncherPanel.setAttribute("aria-hidden", next ? "false" : "true");
      }
      syncControlsPanelTitle();
      updateNavActionState();
    }
    function setMobileMissionPanelVisible(show){
      if(!el.mobileControlsPanel) return;
      if(show && isFlightModeUi()) return;
      const next = !!show;
      if(next){
        setMobileLauncherPanelVisible(false);
        setMobileInspectionPanelVisible(false);
        setMobileServoPanelVisible(false);
        setOverlayVisible(el.missionOverlay, false);
        resetMissionToPresetList();
      }
      el.mobileControlsPanel.classList.toggle("is-mission-view", next);
      if(el.mobileMissionPanel){
        el.mobileMissionPanel.setAttribute("aria-hidden", next ? "false" : "true");
      }
      syncControlsPanelTitle();
      updateNavActionState();
    }
    function setMobileInspectionPanelVisible(show){
      if(!el.mobileControlsPanel) return;
      const next = !!show;
      if(next){
        setMobileLauncherPanelVisible(false);
        setMobileMissionPanelVisible(false);
        setMobileServoPanelVisible(false);
        setOverlayVisible(el.inspectionOverlay, false);
      }
      el.mobileControlsPanel.classList.toggle("is-inspection-view", next);
      if(el.mobileInspectionPanel){
        el.mobileInspectionPanel.setAttribute("aria-hidden", next ? "false" : "true");
      }
      syncControlsPanelTitle();
      updateNavActionState();
    }
    function setMobileServoPanelVisible(show){
      if(!el.mobileControlsPanel) return;
      const next = !!show;
      if(next){
        setMobileLauncherPanelVisible(false);
        setMobileMissionPanelVisible(false);
        setMobileInspectionPanelVisible(false);
        setOverlayVisible(el.hardwareServoOverlay, false);
        if(el.hardwareServoDialog && el.mobileServoPanelMount){
          mountDialogToPanel(el.hardwareServoDialog, el.mobileServoPanelMount, servoDialogDockState);
        }
      }else if(el.hardwareServoDialog && el.mobileServoPanelMount && el.hardwareServoDialog.parentNode === el.mobileServoPanelMount){
        restoreDialogFromPanel(el.hardwareServoDialog, servoDialogDockState);
      }
      el.mobileControlsPanel.classList.toggle("is-servo-view", next);
      if(el.mobileServoPanel){
        el.mobileServoPanel.setAttribute("aria-hidden", next ? "false" : "true");
      }
      syncControlsPanelTitle();
      updateNavActionState();
      if(next){
        fetchServoInfo();
      }
    }
    function updateNavActionState(){
      const replayActive = !!replayUiActive;
      const replayToolsActive = replayActive && isReplayToolsPanelOpen();
      const launcherActive = !!launcherPanelActive || isLauncherOverlayVisible() || isMobileLauncherPanelVisible();
      const missionActive = !!missionPanelActive || isMissionOverlayVisible() || isMobileMissionPanelVisible();
      const inspectionActive = !!inspectionPanelActive || isInspectionOverlayVisible() || isMobileInspectionPanelVisible();
      const servoActive = isServoControlVisible();
      const panelModeActive = replayActive || launcherActive || missionActive || inspectionActive || servoActive;
      const controlsActive = replayToolsActive || (!isMobileLayout() &&
        document.documentElement.classList.contains("control-drawer-open") &&
        !panelModeActive);
      if(el.replayOpenBtns && el.replayOpenBtns.length){
        el.replayOpenBtns.forEach(btn=>btn.classList.toggle("is-active", replayActive));
      }
      if(el.controlsToggleBtns && el.controlsToggleBtns.length){
        el.controlsToggleBtns.forEach(btn=>{
          btn.classList.toggle("is-active", controlsActive);
          if(replayActive) btn.setAttribute("aria-expanded", replayToolsActive ? "true" : "false");
        });
      }
      if(el.launcherOpenBtns && el.launcherOpenBtns.length){
        el.launcherOpenBtns.forEach(btn=>btn.classList.toggle("is-active", launcherActive));
      }
    }
    function setLauncherPanelVisible(show){
      launcherPanelActive = !!show;
      if(launcherPanelActive){
        setMissionPanelVisible(false);
        setInspectionPanelVisible(false);
        if(replayUiActive){
          exitReplayMode();
        }
        if(el.controlsCard){
          el.controlsCard.classList.remove("devtools-mode");
        }
        if(el.controlsHeader){
          el.controlsHeader.classList.remove("hidden");
        }
      }
      if(el.controlsCard){
        el.controlsCard.classList.toggle("launcher-mode", launcherPanelActive);
      }
      if(el.launcherPanel){
        el.launcherPanel.setAttribute("aria-hidden", launcherPanelActive ? "false" : "true");
      }
      syncControlsPanelTitle();
      if(!launcherPanelActive){
        launcherAutoActive = false;
        launcherPitchEst = null;
        launcherPitchEstMs = 0;
        stopLauncherHold("up");
        stopLauncherHold("down");
      }
      updateNavActionState();
    }
    function setMissionPanelVisible(show){
      if(show && isFlightModeUi()) return;
      missionPanelActive = !!show;
      if(missionPanelActive){
        setOverlayVisible(el.missionOverlay, false);
        setLauncherPanelVisible(false);
        setInspectionPanelVisible(false);
        if(replayUiActive){
          exitReplayMode();
        }
        if(el.controlsCard){
          el.controlsCard.classList.remove("devtools-mode");
        }
        if(el.controlsHeader){
          el.controlsHeader.classList.remove("hidden");
        }
        resetMissionToPresetList();
      }
      if(el.controlsCard){
        el.controlsCard.classList.toggle("mission-mode", missionPanelActive);
      }
      if(el.missionPanel){
        el.missionPanel.setAttribute("aria-hidden", missionPanelActive ? "false" : "true");
      }
      syncControlsPanelTitle();
      updateNavActionState();
    }
    function setInspectionPanelVisible(show){
      inspectionPanelActive = !!show;
      if(inspectionPanelActive){
        setOverlayVisible(el.inspectionOverlay, false);
        setLauncherPanelVisible(false);
        setMissionPanelVisible(false);
        if(replayUiActive){
          exitReplayMode();
        }
        if(el.controlsCard){
          el.controlsCard.classList.remove("devtools-mode");
        }
        if(el.controlsHeader){
          el.controlsHeader.classList.remove("hidden");
        }
      }
      if(el.controlsCard){
        el.controlsCard.classList.toggle("inspection-mode", inspectionPanelActive);
      }
      if(el.inspectionPanel){
        el.inspectionPanel.setAttribute("aria-hidden", inspectionPanelActive ? "false" : "true");
      }
      syncControlsPanelTitle();
      updateNavActionState();
    }
    function resetControlsModesOnClose(){
      if(replayUiActive){
        exitReplayMode({returnHome:true});
      }
      setMissionPanelVisible(false);
      setInspectionPanelVisible(false);
      setLauncherPanelVisible(false);
    }
    function isReplayToolsPanelOpen(){
      return document.documentElement.classList.contains("replay-tools-open");
    }
    function setReplayToolsPanelOpen(open){
      const next = !!open && !!replayUiActive;
      document.documentElement.classList.toggle("replay-tools-open", next);
      if(el.replayToolsPanel){
        el.replayToolsPanel.classList.toggle("is-open", next);
        el.replayToolsPanel.setAttribute("aria-hidden", next ? "false" : "true");
      }
      updateNavActionState();
    }
    function toggleReplayToolsPanel(){
      setReplayToolsPanelOpen(!isReplayToolsPanelOpen());
    }
    function applyTabletControlsLayout(){
      if(!el.controlsCard) return;
      const active = isTabletControlsLayout();
      document.documentElement.classList.toggle("tablet-controls-layout", active);
      document.documentElement.classList.toggle("tablet-controls-open", active && tabletControlsOpen);
      if(!active){
        tabletControlsOpen = false;
        el.controlsCard.classList.remove("tablet-collapsed");
        el.controlsCard.setAttribute("aria-expanded", "true");
        document.documentElement.classList.remove("tablet-controls-open");
        resetControlsModesOnClose();
        setTimeout(()=>{
          refreshChartLayout();
          redrawCharts();
        }, 0);
        updateControlAccessUI(currentSt);
        updateNavActionState();
        updateTabletAbortButton();
        return;
      }
      el.controlsCard.classList.toggle("tablet-collapsed", !tabletControlsOpen);
      el.controlsCard.setAttribute("aria-expanded", tabletControlsOpen ? "true" : "false");
      setTimeout(()=>{
        refreshChartLayout();
        redrawCharts();
      }, 0);
      updateControlAccessUI(currentSt);
      updateNavActionState();
      updateTabletAbortButton();
    }
    function showTabletControlsPanel(){
      if(!isTabletControlsLayout()) return;
      closeIgnitionModals();
      tabletControlsOpen = true;
      applyTabletControlsLayout();
    }
    function hideTabletControlsPanel(){
      if(!isTabletControlsLayout()) return;
      tabletControlsOpen = false;
      resetControlsModesOnClose();
      applyTabletControlsLayout();
    }
    function toggleTabletControlsPanel(){
      if(!isTabletControlsLayout()) return;
      const nextOpen = !tabletControlsOpen;
      if(nextOpen) closeIgnitionModals();
      tabletControlsOpen = nextOpen;
      applyTabletControlsLayout();
    }

    function applyPhoneLandscapeLayout(){
      const active = isForcedMobileHudPreview() || (PHONE_LANDSCAPE_MEDIA.matches && isTouchCapableDevice());
      const wasActive = document.documentElement.classList.contains("phone-landscape-layout");
      document.documentElement.classList.toggle("phone-landscape-layout", active);
      if(active && !wasActive){
        setMissionPanelVisible(false);
        setInspectionPanelVisible(false);
        setMobileServoPanelVisible(false);
      }
      if(active){
        moveMobileAbortPanelToBody();
        moveMobileControlsPanelToBody();
        if(!intelligentMobileSessionActive && !intelligentMobileAutoEntering){
          intelligentMobileAutoEntering = true;
          requestAnimationFrame(()=>{
            intelligentMobileAutoEntering = false;
            if(isPhoneLandscapeLayout() && isMobileLayout()){
              enterIntelligentMobileFromGyroPreview();
            }
          });
        }else if(intelligentMobileSessionActive){
          setIntelligentMobileReturnVisible(true);
        }
      }else{
        if(intelligentMobileSessionActive){
          exitIntelligentMobile();
        }else{
          setIntelligentMobileReturnVisible(false);
        }
        setMobileLauncherPanelVisible(false);
        setMobileMissionPanelVisible(false);
        setMobileInspectionPanelVisible(false);
        setMobileServoPanelVisible(false);
        restoreMobileAbortPanelFromBody();
        restoreMobileControlsPanelFromBody();
      }
      if(active && isGyroViewportExpanded()){
        setGyroViewportExpanded(false);
      }
      if(wasActive !== active){
        setTimeout(()=>{
          resizeGyroGl();
          if(gyroGl){
            renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          }
          renderGyroPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          renderNavBallPreview(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
          scheduleStatusMapRefresh();
          refreshChartLayout();
          redrawCharts();
          syncExpandedHud();
        }, 0);
      }else if(active){
        setTimeout(()=>{
          scheduleStatusMapRefresh();
          syncExpandedHud();
        }, 0);
      }
      updateNavActionState();
      updateMobileAbortButton();
      applyMobileImmersiveMode(false);
      syncControlsToggleButtonsForSettings();
      syncStatusMapInteractionMode();
      syncWelcomeConnectScreen(connOk || serialConnected || wsConnected);
      if(!active && !isMobileLayout()){
        hideMobileControlsPanel();
      }
    }

    function showMobileControlsPanel(){
      if(!el.mobileControlsPanel || mobileControlsActive) return;
      closeIgnitionModals();
      updateMobileControlPills();
      syncMobileControlButtons();
      updateMobileSequenceStatusLabel(sequenceActive, currentSt, lockoutLatched);
      setMobileLauncherPanelVisible(false);
      setMobileMissionPanelVisible(false);
      setMobileInspectionPanelVisible(false);
      setMobileServoPanelVisible(false);
      mobileControlsActive = true;
      el.mobileControlsPanel.classList.add("is-open");
      el.mobileControlsPanel.setAttribute("aria-hidden","false");
      document.documentElement.classList.add("mobile-controls-active");
    }

    function hideMobileControlsPanel(){
      if(!el.mobileControlsPanel || !mobileControlsActive) return;
      setMobileLauncherPanelVisible(false);
      setMobileMissionPanelVisible(false);
      setMobileInspectionPanelVisible(false);
      setMobileServoPanelVisible(false);
      mobileControlsActive = false;
      el.mobileControlsPanel.classList.remove("is-open");
      el.mobileControlsPanel.setAttribute("aria-hidden","true");
      document.documentElement.classList.remove("mobile-controls-active");
    }

    if(MOBILE_PANEL_MEDIA.addEventListener){
      MOBILE_PANEL_MEDIA.addEventListener("change",(event)=>{
        if(!event.matches) hideMobileControlsPanel();
        applyPhoneLandscapeLayout();
      });
    }else if(MOBILE_PANEL_MEDIA.addListener){
      MOBILE_PANEL_MEDIA.addListener((event)=>{
        if(!event.matches) hideMobileControlsPanel();
        applyPhoneLandscapeLayout();
      });
    }
    if(PHONE_LANDSCAPE_MEDIA.addEventListener){
      PHONE_LANDSCAPE_MEDIA.addEventListener("change",()=>{
        applyPhoneLandscapeLayout();
      });
    }else if(PHONE_LANDSCAPE_MEDIA.addListener){
      PHONE_LANDSCAPE_MEDIA.addListener(()=>{
        applyPhoneLandscapeLayout();
      });
    }
    if(TABLET_CONTROLS_MEDIA.addEventListener){
      TABLET_CONTROLS_MEDIA.addEventListener("change",()=>{
        applyTabletControlsLayout();
        applyPhoneLandscapeLayout();
      });
    }else if(TABLET_CONTROLS_MEDIA.addListener){
      TABLET_CONTROLS_MEDIA.addListener(()=>{
        applyTabletControlsLayout();
        applyPhoneLandscapeLayout();
      });
    }
    const FULLSCREEN_EVENTS = ["fullscreenchange", "webkitfullscreenchange", "MSFullscreenChange"];
    FULLSCREEN_EVENTS.forEach((evtName)=>{
      document.addEventListener(evtName, ()=>{
        syncMobileImmersiveToggleState();
      });
    });

    function updateMobileControlPills(){
      if(!el.mobileControlsPanel) return;
      const setMobileQuickIconTone = (type, toneClass)=>{
        if(!el.mobileControlButtonMap) return;
        const btn = el.mobileControlButtonMap[type];
        if(!btn || !btn.querySelector) return;
        const icon = btn.querySelector(".mobile-quick-icon");
        if(!icon) return;
        icon.classList.remove("tone-green", "tone-red", "tone-gray", "tone-blue");
        if(toneClass) icon.classList.add(toneClass);
      };
      const setMobileQuickPillTone = (node, tone)=>{
        if(!node) return;
        node.classList.remove("pill-green", "pill-red", "pill-gray");
        node.classList.add("mobile-quick-state", "pill");
        if(tone) node.classList.add(tone);
      };
      const serialPill = el.mobileControlPills ? el.mobileControlPills.serial : null;
      if(serialPill){
        const mode = getConnectTransportMode();
        const serialLabel = (mode === "wifi")
          ? t("modeWifi")
          : (serialConnected ? t("serialConnected") : t("serialDisconnected"));
        serialPill.textContent = serialLabel;
        if(mode === "wifi"){
          setMobileQuickPillTone(serialPill, "pill-gray");
          setMobileQuickIconTone("serial", "tone-blue");
        }else{
          setMobileQuickPillTone(serialPill, serialConnected ? "pill-green" : "pill-red");
          setMobileQuickIconTone("serial", serialConnected ? "tone-green" : "tone-red");
        }
      }
      const safetyPill = el.mobileControlPills ? el.mobileControlPills.safety : null;
      if(safetyPill){
        const safetyOn = el.safeModeToggle ? el.safeModeToggle.checked : safetyModeEnabled;
        safetyPill.textContent = safetyOn ? "ON" : "OFF";
        setMobileQuickPillTone(safetyPill, safetyOn ? "pill-green" : "pill-gray");
        setMobileQuickIconTone("safety", safetyOn ? "tone-green" : "tone-gray");
      }
      const inspectionPill = el.mobileControlPills ? el.mobileControlPills.inspection : null;
      if(inspectionPill){
        let tone = "pill-gray";
        let label = t("inspectionWait");
        if(inspectionState === "passed"){
          tone = "pill-green";
          label = t("inspectionOk");
        }else if(inspectionState === "failed"){
          tone = "pill-red";
          label = t("inspectionNeed");
        }else if(inspectionRunning){
          label = t("inspectionRunningLabel");
        }
        inspectionPill.textContent = label;
        setMobileQuickPillTone(inspectionPill, tone);
        setMobileQuickIconTone("inspection", tone === "pill-green" ? "tone-green" : (tone === "pill-red" ? "tone-red" : "tone-gray"));
      }
    }

    function setMobileControlButtonState(type, disabled){
      if(!el.mobileControlButtonMap) return;
      const btn = el.mobileControlButtonMap[type];
      if(!btn) return;
      btn.disabled = !!disabled;
      btn.classList.toggle("disabled", !!disabled);
      btn.setAttribute("aria-disabled", disabled ? "true" : "false");
    }

    function syncMobileControlButtons(){
      if(!el.mobileControlButtonMap) return;
      const sequenceDisabled = !!(el.igniteBtn && el.igniteBtn.disabled);
      const mobileSequenceBlocked = !!(replaySourceActive || lockoutLatched || sequenceActive || isFirmwareSequenceRunningState(currentSt) || localTplusActive || userWaitingLocal || inspectionRunning || safetyModeEnabled);
      const inspectionDisabled = !!(inspectionRunning || replaySourceActive);
      setMobileControlButtonState("sequence", sequenceDisabled);
      setMobileControlButtonState("inspection", inspectionDisabled);
      if(el.mobileSequenceWideBtn){
        el.mobileSequenceWideBtn.disabled = mobileSequenceBlocked;
        el.mobileSequenceWideBtn.classList.toggle("disabled", mobileSequenceBlocked);
        el.mobileSequenceWideBtn.setAttribute("aria-disabled", mobileSequenceBlocked ? "true" : "false");
      }
      syncMobileSequencePrimaryLabels();
    }

    function updateMobileArmLockWideButton(){
      const inFlightMode = isFlightModeUi();
      if(el.mobileArmLockWideBtn){
        const hasArmLockToggle = !!el.armLockToggle;
        const active = !!(inFlightMode && hasArmLockToggle && el.armLockToggle.checked);
        const visible = inFlightMode && hasArmLockToggle;
        el.mobileArmLockWideBtn.classList.toggle("hidden", !visible);
        const disabled = !visible;
        el.mobileArmLockWideBtn.disabled = disabled;
        el.mobileArmLockWideBtn.classList.toggle("disabled", disabled);
        el.mobileArmLockWideBtn.classList.toggle("is-active", active);
        el.mobileArmLockWideBtn.setAttribute("aria-hidden", visible ? "false" : "true");
        el.mobileArmLockWideBtn.setAttribute("aria-disabled", disabled ? "true" : "false");
        el.mobileArmLockWideBtn.title = visible
          ? (active ? "ARM ON LOCK 켜짐 (터치하면 해제)" : "ARM ON LOCK 해제 (스위치 따름)")
          : "Flight 모드에서만 사용 가능합니다.";
      }
      if(el.mobileMissionWideBtn){
        const missionVisible = !inFlightMode;
        el.mobileMissionWideBtn.classList.toggle("hidden", !missionVisible);
        el.mobileMissionWideBtn.disabled = !missionVisible;
        el.mobileMissionWideBtn.classList.toggle("disabled", !missionVisible);
        el.mobileMissionWideBtn.setAttribute("aria-hidden", missionVisible ? "false" : "true");
        el.mobileMissionWideBtn.setAttribute("aria-disabled", missionVisible ? "false" : "true");
        el.mobileMissionWideBtn.title = missionVisible ? "" : "Flight 모드에서는 미션 프로필을 사용할 수 없습니다.";
      }
      updateMobileDashboardSafetyArmState();
    }

    function updateMobileDashboardSafetyArmState(){
      const safetyBtn = document.getElementById("mobileSafetyModeBtn");
      const armBtn = document.getElementById("mobileArmUnlockBtn");
      const safetyOn = !!(el.safeModeToggle && el.safeModeToggle.checked);
      const armLocked = !!(el.armLockToggle && el.armLockToggle.checked);
      if(safetyBtn){
        safetyBtn.classList.toggle("is-active", safetyOn);
        safetyBtn.setAttribute("aria-pressed", safetyOn ? "true" : "false");
      }
      if(armBtn){
        armBtn.classList.toggle("is-locked", armLocked);
        armBtn.setAttribute("aria-pressed", armLocked ? "true" : "false");
        armBtn.setAttribute("aria-label", armLocked ? "ARM 잠김, 누르면 해제" : "ARM 해제");
        const label = armBtn.querySelector(".mobile-device-control-label");
        if(label) label.textContent = armLocked ? "ARM 잠김" : "ARM 해제";
      }
    }

    function shouldShowMobileAbortButton(){
      return false;
    }
    function shouldShowTabletAbortButton(){
      if(!isTabletControlsLayout() || !el.tabletAbortBtn) return false;
      return sequenceActive || isFirmwareSequenceRunningState(currentSt) || localTplusActive || tplusUiActive;
    }
    function updateMobileAbortButton(){
      if(!el.mobileAbortBtn) return;
      const show = false;
      el.mobileAbortBtn.classList.toggle("is-visible", show);
      if(el.mobileAbortPanel) el.mobileAbortPanel.classList.toggle("is-visible", show);
      el.mobileAbortBtn.disabled = !!(el.abortBtn && el.abortBtn.disabled);
      updateTabletAbortButton();
    }
    function updateTabletAbortButton(){
      if(!el.tabletAbortBtn) return;
      const show = shouldShowTabletAbortButton();
      el.tabletAbortBtn.classList.toggle("hidden", !show);
      el.tabletAbortBtn.disabled = !!(el.abortBtn && el.abortBtn.disabled);
    }

    function positionDesktopNavAbortButton(){
      if(!el.desktopNavAbortBtn || window.innerWidth <= 900) return;
      const nav = document.querySelector(".side-nav-desktop");
      if(!nav) return;
      const navRect = nav.getBoundingClientRect();
      const buttonRect = el.desktopNavAbortBtn.getBoundingClientRect();
      const buttonSize = buttonRect.height || 72;
      const top = Math.min(
        window.innerHeight - buttonSize - 12,
        Math.round(navRect.bottom + 10)
      );
      const right = Math.max(12, Math.round(window.innerWidth - navRect.right + ((navRect.width - (buttonRect.width || 72)) / 2)));
      el.desktopNavAbortBtn.style.top = top + "px";
      el.desktopNavAbortBtn.style.right = right + "px";
    }

    function updateDesktopNavAbortButton(){
      if(!el.desktopNavAbortBtn) return;
      const disabled = !el.abortBtn || !!el.abortBtn.disabled;
      const sequenceConfirmOpen = !!(
        confirmOverlayEl &&
        !confirmOverlayEl.classList.contains("hidden") &&
        confirmOverlayEl.getAttribute("aria-hidden") !== "true"
      );
      const visible = !sequenceConfirmOpen && !missionStandbyUiActive && !!(
        virtualMissionActive || sequenceActive ||
        isFirmwareSequenceRunningState(currentSt) ||
        localTplusActive || tplusUiActive
      );
      el.desktopNavAbortBtn.disabled = disabled;
      el.desktopNavAbortBtn.classList.toggle("is-visible", visible);
      el.desktopNavAbortBtn.classList.toggle("is-active", visible && !disabled);
      const isStop = tplusUiActive || isFirmwareTplusState(currentSt) || localTplusActive;
      const label = isStop ? "시퀀스 종료" : "시퀀스 중단";
      el.desktopNavAbortBtn.setAttribute("aria-label", label);
      el.desktopNavAbortBtn.setAttribute("title", label);
      if(visible) positionDesktopNavAbortButton();
    }

    function updateAbortButtonLabel(isTplus){
      const label = isTplus ? "STOP" : "ABORT";
      tplusUiActive = !!isTplus;
      if(el.abortBtn) el.abortBtn.textContent = label;
      if(el.mobileAbortBtn) el.mobileAbortBtn.textContent = label;
      if(el.tabletAbortBtn) el.tabletAbortBtn.textContent = label;
      updateTabletAbortButton();
      updateDesktopNavAbortButton();
    }

    function setIgniteButtonLabel(key){
      const label = t(key);
      if(el.igniteLabel){
        el.igniteLabel.textContent = label;
      }
      if(el.igniteBtn && !el.igniteLabel) el.igniteBtn.textContent = label;
      if(el.mobileSequenceLabel) el.mobileSequenceLabel.textContent = label;
      if(el.mobileSequenceWideLabel) el.mobileSequenceWideLabel.textContent = label;
    }

    function toggleInput(node){
      if(!node) return;
      node.checked = !node.checked;
      node.dispatchEvent(new Event("change", {bubbles:true}));
    }
    function setInspectionStepInfo(key){
      const info = INSPECTION_STEP_INFO[key] || {};
      const label = info.labelKey ? t(info.labelKey) : (info.label || key || "-");
      const desc = info.descKey ? t(info.descKey) : (info.desc || "");
      if(el.inspectionStepLabel) el.inspectionStepLabel.textContent = label;
      if(el.inspectionStepDesc) el.inspectionStepDesc.textContent = desc;
    }
    function getInspectionStepLabel(key){
      const info = INSPECTION_STEP_INFO[key] || {};
      return info.labelKey ? t(info.labelKey) : (info.label || key || "-");
    }
    function buildInspectionFailMessage(failedKeys){
      const base = t("inspectionFailText");
      if(!failedKeys || !failedKeys.length){
        return base;
      }
      const labels = failedKeys.map(getInspectionStepLabel).filter(Boolean);
      if(!labels.length){
        return base;
      }
      return base + "<br>" + t("inspectionFailItemsLabel") + ": " + labels.join(", ");
    }

    function setInspectionStatusPills(state){
      const pill = el.inspectionStatusSingle;
      if(!pill) return;
      pill.classList.remove("is-active","is-running","is-ok","is-bad");
      let label = "-";
      if(state==="running"){
        pill.classList.add("is-active","is-running");
        label = t("inspectionChecking");
      }else if(state==="ok" || state==="skip"){
        pill.classList.add("is-active","is-ok");
        label = t("inspectionOk");
      }else if(state==="bad"){
        pill.classList.add("is-active","is-bad");
        label = t("inspectionNeed");
      }else{
        label = t("inspectionWait");
      }
      pill.textContent = label;
    }

    function setInspectionItemState(key,state,label){
      setInspectionStepInfo(key);
      if(!state){
        setInspectionStatusPills("idle");
        return;
      }
      if(state==="running") setInspectionStatusPills("running");
      else if(state==="ok") setInspectionStatusPills("ok");
      else if(state==="bad") setInspectionStatusPills("bad");
      else if(state==="skip") setInspectionStatusPills("skip");
    }

    function setInspectionResult(text, state){
      const targets = [];
      if(el.inspectionResult) targets.push(el.inspectionResult);
      if(el.inspectionPanelResults && el.inspectionPanelResults.length){
        el.inspectionPanelResults.forEach(node=>{ if(node) targets.push(node); });
      }
      if(!targets.length) return;
      targets.forEach(node=>{
        node.classList.remove("ok","error","running");
        if(state) node.classList.add(state);
        node.textContent = text;
      });
    }

    function resetInspectionUI(){
      inspectionRunning=false;
      controlAuthority=false;
      inspectionState="idle";
      inspectionLastFailedKeys = [];
      if(INSPECTION_STEPS.length){
        setInspectionItemState(INSPECTION_STEPS[0].key,"", t("inspectionWait"));
      }
      setInspectionResult(t("inspectionIdleText"),"neutral");
      updateInspectionPill();
      updateControlAccessUI(currentSt);
    }

    async function runInspectionSequence(){
      if(inspectionRunning) return;
      hideInspectionWarning();
      inspectionRunning=true;
      inspectionState="running";
      controlAuthority=false;
      inspectionLastFailedKeys = [];
      updateInspectionPill();
      setInspectionResult(t("inspectionRunningText"),"running");
      updateControlAccessUI(currentSt);

      let hasFail=false;
      const failedKeys = [];
      for(const step of INSPECTION_STEPS){
        setInspectionItemState(step.key,"running", t("inspectionChecking"));
        await delay(320);
        let ok=false;
        let skipped=false;
        try{ ok = !!step.check(); }catch(e){ ok=false; }
        if(step.key==="serial" && simEnabled){
          ok = true;
          skipped = true;
        }
        if(skipped){
          setInspectionItemState(step.key, "skip", t("inspectionSkip"));
        }else{
          setInspectionItemState(step.key, ok ? "ok" : "bad", ok ? t("inspectionOk") : t("inspectionNeed"));
        }
        if(!ok && !skipped){
          hasFail=true;
          failedKeys.push(step.key);
        }
        await delay(180);
      }

      inspectionRunning=false;
      inspectionState = hasFail ? "failed" : "passed";
      inspectionLastFailedKeys = hasFail ? failedKeys.slice() : [];

      if(hasFail){
        controlAuthority=false;
        setInspectionResult(t("inspectionFailText"),"error");
        showToast(t("inspectFailToast"),"notice");
        showInspectionWarning(inspectionLastFailedKeys);
        const failLabels = inspectionLastFailedKeys.map(getInspectionStepLabel).filter(Boolean).join(", ");
        addLogLine(failLabels ? (t("inspectFailLog") + " (" + failLabels + ")") : t("inspectFailLog"),"SAFE");
        playBeepPattern([
          {freq:440, dur:120, gap:80},
          {freq:440, dur:120, gap:80},
          {freq:440, dur:120, gap:0}
        ]);
      }else{
        controlAuthority=true;
        setInspectionResult(t("inspectionPassText"),"ok");
        showToast(t("inspectPassToast"),"success");
        addLogLine(t("inspectPassLog"),"SAFE");
        playBeepPattern([
          {freq:660, dur:140, gap:60},
          {freq:880, dur:140, gap:60},
          {freq:1100, dur:180, gap:0}
        ]);
      }
      const inspectionPassedNow = !hasFail;
      markInspectionSyncPending(inspectionPassedNow);
      await sendCommand({
        http:"/set?inspection=" + (inspectionPassedNow ? 1 : 0),
        ser:"/set?inspection=" + (inspectionPassedNow ? 1 : 0)
      }, false);
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
      updateInspectionPill();
      return !hasFail;
    }

    function openInspectionFromUI(){
      if(!connOk && !simEnabled){
        showToast(t("inspectionOpenToast"), "notice");
        return;
      }
      showInspection();
    }

    function showInspection(){
      hideInspectionWarning();
      setInspectionPanelVisible(false);
      setMobileInspectionPanelVisible(false);
      setOverlayVisible(el.inspectionOverlay, false);
      resetInspectionUI();
      runInspectionSequence();
    }
    function hideInspection(){
      hideInspectionWarning();
      if(isMobileInspectionPanelVisible()){
        setMobileInspectionPanelVisible(false);
      }
      if(inspectionPanelActive){
        setInspectionPanelVisible(false);
      }
      setOverlayVisible(el.inspectionOverlay, false);
    }

    async function startSequenceFromMobileCard(){
      if(sequenceActive || isFirmwareSequenceRunningState(currentSt) || localTplusActive){
        return;
      }
      const storageGuard = getSequenceStorageGuard();
      if(storageGuard.blocked){
        showSequenceStorageGuardToast(true);
        setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
        return;
      }
      if(lockoutLatched){
        showToast(t("lockoutNoControl"), "error");
        return;
      }
      if(!connOk && !simEnabled){
        showToast(t("inspectionOpenToast"), "notice");
        return;
      }
      if(!isControlUnlocked()){
        const passed = await runInspectionSequence();
        if(!passed) return;
        setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
        return;
      }
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
      if(el.igniteBtn && !el.igniteBtn.disabled){
        el.igniteBtn.click();
      }else if(currentSt === 0){
        showConfirm();
      }
    }

    function pauseSequenceFromMobileCard(){
      if(lockoutLatched) return;
      if(currentSt === 2 || currentSt === 3 || localTplusActive){
        showToast("T+ 진행 중에는 일시중지 대신 중단만 가능합니다.", "notice");
        return;
      }
      const cdMs = Math.max(3000, Math.min(60000, ((uiSettings ? uiSettings.countdownSec : 10) * 1000)));
      userWaitingLocal = true;
      sendCommand({http:"/precount?uw=1&cd="+cdMs, ser:"PRECOUNT 1 "+cdMs}, false);
      showToast("시퀀스 일시중지 요청 전송됨", "info", {key:"mobile-sequence-pause"});
    }

    function stopSequenceFromMobileCard(){
      if(el.abortBtn && !el.abortBtn.disabled){
        el.abortBtn.click();
        return;
      }
      if(sequenceActive || isFirmwareSequenceRunningState(currentSt) || localTplusActive || userWaitingLocal){
        lastAbortReason = "user";
        sendCommand({http:"/abort", ser:"ABORT"}, true);
        showToast(t("abortRequestedToast", {safety:safetyLineSuffix()}), "error");
        hideConfirm();
        return;
      }
      showToast("진행 중인 시퀀스 없음", "notice", {key:"mobile-sequence-stop-idle"});
    }

    function showControlsModal(){
      hideMobileControlsPanel();
      closeIgnitionModals();
      if(!el.controlsOverlay || !el.controlsOverlaySlot || !el.controlsCard) return;
      if(!isMobileLayout()){
        setDesktopControlDrawerOpen(true);
        return;
      }
      if(!controlsCardParent){
        controlsCardParent = el.controlsCard.parentNode;
        controlsCardNext = el.controlsCard.nextSibling;
      }
      el.controlsCard.classList.remove(CONTROLS_MOBILE_CLASS);
      el.controlsOverlaySlot.appendChild(el.controlsCard);
      if(el.controlsOverlayClose){
        el.controlsCard.appendChild(el.controlsOverlayClose);
      }
      el.controlsOverlay.classList.remove("hidden");
      updateNavActionState();
    }
    function hideControlsModal(){
      setDesktopControlDrawerOpen(false);
      if(!el.controlsOverlay || !el.controlsCard || !controlsCardParent) return;
      resetControlsModesOnClose();
      el.controlsOverlay.classList.add("hidden");
      if(controlsCardNext && controlsCardNext.parentNode === controlsCardParent){
        controlsCardParent.insertBefore(el.controlsCard, controlsCardNext);
      }else{
        controlsCardParent.appendChild(el.controlsCard);
      }
      if(el.controlsCard && window.matchMedia("(max-width: 600px)").matches){
        el.controlsCard.classList.add(CONTROLS_MOBILE_CLASS);
      }
      if(el.controlsOverlayClose){
        el.controlsOverlay.appendChild(el.controlsOverlayClose);
      }
      updateNavActionState();
    }

    function isDesktopControlDrawerOpen(){
      return !isMobileLayout() && document.documentElement.classList.contains("control-drawer-open");
    }

    function setDesktopControlDrawerOpen(open){
      const next = !!open && !isMobileLayout();
      if(el.controlsOverlay && !el.controlsOverlay.classList.contains("hidden") && controlsCardParent){
        el.controlsOverlay.classList.add("hidden");
        if(controlsCardNext && controlsCardNext.parentNode === controlsCardParent){
          controlsCardParent.insertBefore(el.controlsCard, controlsCardNext);
        }else if(el.controlsCard){
          controlsCardParent.appendChild(el.controlsCard);
        }
        if(el.controlsOverlayClose) el.controlsOverlay.appendChild(el.controlsOverlayClose);
      }
      if(next && el.desktopControlDrawerMount && el.controlsCard &&
         el.controlsCard.parentNode !== el.desktopControlDrawerMount){
        el.desktopControlDrawerMount.appendChild(el.controlsCard);
      }
      document.documentElement.classList.toggle("control-drawer-open", next);
      document.body.classList.toggle("control-drawer-open", next);
      if(el.controlsCard){
        el.controlsCard.classList.toggle("control-drawer-card", next);
        el.controlsCard.setAttribute("aria-expanded", next ? "true" : "false");
      }
      if(el.desktopControlDrawerMount){
        el.desktopControlDrawerMount.setAttribute("aria-hidden", next ? "false" : "true");
      }
      const navButton = document.getElementById("desktopControlPanelNavBtn");
      if(navButton){
        const replayToolsActive = !!replayUiActive && isReplayToolsPanelOpen();
        navButton.classList.toggle("is-active", replayToolsActive || (next && !replayUiActive));
        navButton.setAttribute("aria-expanded", replayToolsActive ? "true" : ((next && !replayUiActive) ? "true" : "false"));
      }
      if(!next) resetControlsModesOnClose();
      updateNavActionState();
      requestAnimationFrame(()=>{
        refreshChartLayout();
        redrawCharts();
      });
    }

    function toggleDesktopControlDrawer(){
      setDesktopControlDrawerOpen(!isDesktopControlDrawerOpen());
    }

    let dashboardDrawerHideTimer = 0;
    function setDashboardDrawerOpen(open, immediate){
      if(!el.dashboardView || !isDesktopLayout()) return;
      clearTimeout(dashboardDrawerHideTimer);
      const dashboardButton = document.getElementById("desktopDashboardBtn");
      if(dashboardButton) dashboardButton.classList.toggle("active", !!open);
      if(open){
        el.dashboardView.classList.remove("hidden");
        el.dashboardView.setAttribute("aria-hidden", "false");
        document.body.classList.add("dashboard-view-active");
        requestAnimationFrame(()=>{
          document.body.classList.add("dashboard-drawer-open");
          syncChartHeightToControls(0);
          scheduleStatusMapRefresh();
          resizeGyroGl();
          if(gyroGl) renderGyroGl(gyroPitchDeg, gyroYawDeg, gyroRollDeg);
        });
        return;
      }
      document.body.classList.remove("dashboard-drawer-open");
      document.body.classList.remove("dashboard-view-active");
      const finish = ()=>{
        if(document.body.classList.contains("camera-view-active")){
          el.dashboardView.classList.add("hidden");
          el.dashboardView.setAttribute("aria-hidden", "true");
        }
      };
      if(immediate) finish();
      else dashboardDrawerHideTimer = setTimeout(finish, 360);
    }

    // KST 시각 표시
    const GPS_CLOCK_DAY_MS = 86400000;
    const GPS_CLOCK_KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const GPS_CLOCK_STALE_MS = 6000;
    let gpsClockUtcMs = NaN;
    let gpsClockReceivedAtMs = 0;

    function formatClockPartsFromMs(msOfDay, includeSeconds){
      const totalSeconds = Math.floor((((msOfDay % GPS_CLOCK_DAY_MS) + GPS_CLOCK_DAY_MS) % GPS_CLOCK_DAY_MS) / 1000);
      const hour = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const minute = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      if(!includeSeconds) return hour + ":" + minute;
      const second = String(totalSeconds % 60).padStart(2, "0");
      return hour + ":" + minute + ":" + second;
    }

    function syncGpsClockFromTelemetry(data){
      if(!data) return;
      const utcRaw = data.gps_utc_ms ?? data.gpsUtcMs ?? data.utc_ms ?? null;
      const validRaw = data.gps_time_valid ?? data.gpsTimeValid ?? data.time_valid ?? null;
      const fixRaw = data.gps_fix ?? data.gpsFix ?? data.fix ?? null;
      if(validRaw == null && fixRaw == null) return;
      const utcMs = Number(utcRaw);
      const valid = validRaw === true ||
        validRaw === 1 ||
        String(validRaw).trim().toLowerCase() === "1" ||
        String(validRaw).trim().toLowerCase() === "true";
      const fixValid = fixRaw === true ||
        fixRaw === 1 ||
        String(fixRaw).trim().toLowerCase() === "1" ||
        String(fixRaw).trim().toLowerCase() === "true";
      if(fixValid && valid && Number.isFinite(utcMs) && utcMs >= 0 && utcMs < GPS_CLOCK_DAY_MS){
        gpsClockUtcMs = utcMs;
        gpsClockReceivedAtMs = Date.now();
        return;
      }
      gpsClockUtcMs = NaN;
      gpsClockReceivedAtMs = 0;
    }

    function getKstClockState(includeSeconds){
      const nowMs = Date.now();
      const gpsValid = Number.isFinite(gpsClockUtcMs) &&
        gpsClockReceivedAtMs > 0 &&
        (nowMs - gpsClockReceivedAtMs) <= GPS_CLOCK_STALE_MS;
      if(gpsValid){
        const elapsedMs = Math.max(0, nowMs - gpsClockReceivedAtMs);
        return {
          text: formatClockPartsFromMs(gpsClockUtcMs + elapsedMs + GPS_CLOCK_KST_OFFSET_MS, includeSeconds),
          source: "GPS"
        };
      }
      const now = new Date();
      const opts = { hour:"2-digit", minute:"2-digit", hour12:false, timeZone:"Asia/Seoul" };
      if(includeSeconds) opts.second = "2-digit";
      return {
        text: now.toLocaleTimeString("ko-KR", opts),
        source: "LOCAL"
      };
    }

    function getCompactHudClockText(){
      return getKstClockState(false).text;
    }

    function formatMobileSequenceTime(raw){
      const text = String(raw || "").trim();
      const prefix = /T\+/.test(text) ? "T+" : "T-";
      const match = text.match(/(\d{1,}):(\d{2})/);
      if(!match) return prefix + "00:00";
      const minutes = String(Number(match[1]) || 0).padStart(2, "0");
      return prefix + minutes + ":" + match[2];
    }

    function syncMobileSequenceTime(){
      const countdownText = el.countdown ? el.countdown.textContent : "";
      const formatted = formatMobileSequenceTime(countdownText);
      if(el.mobileSequenceTime) el.mobileSequenceTime.textContent = formatted;
      if(el.mobileSequenceNavTime) el.mobileSequenceNavTime.textContent = formatted;
    }

    function setMobileSequenceProgress(ratio){
      if(!el.mobileSequenceBarFill) return;
      const progress = Math.max(0.04, Math.min(1, Number(ratio) || 0));
      el.mobileSequenceBarFill.style.width = (progress * 100).toFixed(2) + "%";
    }

    function formatVirtualMissionTime(ms){
      const value = Math.max(0, Math.round(Number(ms) || 0));
      const minutes = Math.floor(value / 60000);
      const seconds = Math.floor((value % 60000) / 1000);
      const centiseconds = Math.floor((value % 1000) / 10);
      return String(minutes).padStart(2, "0") + ":" +
        String(seconds).padStart(2, "0") + ":" +
        String(centiseconds).padStart(2, "0");
    }

    function updateVirtualMissionButtonUi(){
      const realSequenceBusy = !!(
        sequenceActive ||
        isFirmwareSequenceRunningState(currentSt) ||
        localTplusActive ||
        replaySourceActive
      );
      if(el.virtualMissionBtn){
        el.virtualMissionBtn.disabled = virtualMissionActive || realSequenceBusy;
        el.virtualMissionBtn.classList.toggle("is-running", virtualMissionActive);
        el.virtualMissionBtn.setAttribute(
          "aria-label",
          virtualMissionActive ? "시간 기반 강제 미션 진행 중" : "시간 기반 강제 미션 시작"
        );
      }
      if(el.virtualMissionBtnLabel){
        el.virtualMissionBtnLabel.textContent = virtualMissionActive ? "강제 미션 진행 중" : "미션 강제 구동";
      }
      if(el.virtualMissionBtnStatus){
        el.virtualMissionBtnStatus.textContent = virtualMissionActive ? "T+ ACTIVE" : "TIME BASED";
      }
      if(el.mobileVirtualMissionBtn){
        el.mobileVirtualMissionBtn.disabled = virtualMissionActive || realSequenceBusy;
        el.mobileVirtualMissionBtn.classList.toggle("is-active", virtualMissionActive);
        el.mobileVirtualMissionBtn.setAttribute(
          "aria-label",
          virtualMissionActive ? "시간 기반 강제 미션 진행 중" : "시간 기반 강제 미션 시작"
        );
      }
      if(el.mobileVirtualMissionStatus){
        el.mobileVirtualMissionStatus.textContent = virtualMissionActive ? "진행중" : "대기";
        el.mobileVirtualMissionStatus.className =
          "mobile-quick-state pill " + (virtualMissionActive ? "pill-blue" : "pill-gray");
      }
    }

    function missionStandbyPhysicalArmValue(data){
      if(!data || typeof data !== "object") return null;
      const physicalRaw = data.sp ?? data.arm_physical ?? data.swPhysical;
      const physical = physicalRaw == null ? NaN : Number(physicalRaw);
      if(Number.isFinite(physical)) return physical !== 0;
      const armLockRaw = data.al ?? data.arm_lock;
      const effectiveRaw = data.s ?? data.sw;
      const armLock = armLockRaw == null ? NaN : Number(armLockRaw);
      const effective = effectiveRaw == null ? NaN : Number(effectiveRaw);
      // Effective ARM reflects the physical input only while software ARM lock
      // is explicitly off. Otherwise the physical state remains unknown.
      if(Number.isFinite(armLock) && armLock === 0 && Number.isFinite(effective)){
        return effective !== 0;
      }
      return null;
    }

    function missionStandbyUnsafeStageIds(){
      const unsafe = [];
      if(stageTelemetryModeActive){
        [1, 2].forEach((stageId)=>{
          if(stageId === 2 && !flashLinkUiStage2Mode) return;
          const stage = stageTelemetryStore[stageId];
          if(!stage || !stage.connected || !stage.valid) return;
          if(missionStandbyPhysicalArmValue(stage.data) === false) unsafe.push(stageId);
        });
        return unsafe;
      }
      if(missionStandbyPhysicalArmValue(latestTelemetry) === false){
        unsafe.push(cameraHudActiveStageId === 2 ? 2 : 1);
      }
      return unsafe;
    }

    function hideMissionArmRiskWarning(){
      setOverlayVisible(el.missionArmRiskOverlay, false);
    }

    function showMissionArmRiskWarning(stageIds, reason){
      hideMobileControlsPanel();
      const stages = Array.from(new Set((stageIds || []).filter(id=>id === 1 || id === 2)));
      const stagePrefix = stages.length ? stages.map(id=>id + "단부").join(" · ") : "에비오닉스";
      const mode = reason || "released";
      let title = "ARM 해제 상태 감지";
      let body = "미션 대기를 중단하고 실행 권한을 회수했습니다. 안전 모드와 ARM 잠금이 적용되었습니다.";
      let stageText = stagePrefix + " 물리 ARM이 이미 해제되어 있습니다.";
      let note = "기체와 점화 계통 확인 후 물리 ARM 재설정 → 설비 점검 순서로 진행하세요.";
      if(mode === "contact"){
        title = "ARM 신호 불안정";
        body = "ARM 입력이 반복해서 전환되어 미션 권한을 회수하고 안전 모드로 전환했습니다.";
        stageText = stagePrefix + " ARM 커넥터·센서·배선을 점검하세요.";
        note = "접점이 안정된 뒤 물리 ARM 재설정 → 설비 점검 순서로 다시 진행하세요.";
      }else if(mode === "contact-flight"){
        title = "ARM 신호 불안정";
        body = "비행 중 ARM 접점 불안정이 감지되었습니다. 진행 중인 복구 시퀀스는 안전을 위해 계속 실행합니다.";
        stageText = stagePrefix + " ARM 커넥터·센서·배선을 회수 후 점검하세요.";
        note = "비행 종료 전에는 발사체에 접근하지 말고 원격 텔레메트리 상태를 계속 확인하세요.";
      }else if(mode === "launch"){
        title = "발사 감지 비정상";
        body = "점화 출력이 끝난 뒤에도 1단 ARM 해제가 확인되지 않았습니다. 발사 여부가 불명확합니다.";
        stageText = "발사체에 접근하지 말고 충분한 안전 대기 시간을 확보하세요.";
        note = "원격 상태와 점화 계통을 먼저 확인한 뒤 현장 안전 절차에 따라 접근하세요.";
      }else if(mode === "thrust-validation"){
        title = "추력 감지 검증 실패";
        body = "추력 비행 감지 후 1초 안에 물리 ARM 해제가 확인되지 않아 미션 대기로 복귀했습니다.";
        stageText = stagePrefix + " ARM 케이블·커넥터와 IMU 고정 상태를 점검하세요.";
        note = "발사 여부가 불명확하므로 원격 상태를 확인하고 충분한 안전 대기 후 접근하세요.";
      }
      if(el.missionArmRiskTitle) el.missionArmRiskTitle.textContent = title;
      if(el.missionArmRiskText) el.missionArmRiskText.textContent = body;
      if(el.missionArmRiskStage) el.missionArmRiskStage.textContent = stageText;
      if(el.missionArmRiskNote) el.missionArmRiskNote.textContent = note;
      setOverlayVisible(el.missionArmRiskOverlay, true);
    }

    async function enforceMissionStandbySafety(stageIds){
      markInspectionSyncPending(false);
      applyInspectionAuthorityFromTelemetry(0);
      applyBoardControlUiValue("safety", true);
      applyBoardControlUiValue("armLock", true);
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
      showMissionArmRiskWarning(stageIds);
      addLogLine("미션 대기 거부 · 물리 ARM 해제 · 권한 회수 및 안전 모드 적용", "SAFETY");
      const result = await sendCommand({
        http:"/set?safe=1&arm_lock=1&inspection=0",
        ser:"/set?safe=1&arm_lock=1&inspection=0"
      }, true);
      if(!result || !result.ok){
        showToast("안전 명령 응답을 확인하지 못했습니다. 기체에 접근하지 말고 전원을 차단하세요.", "error", {
          key:"mission-standby-safety-failed",
          duration:7000
        });
      }
    }

    function updateMissionStandbyButtonUi(){
      const waiting = !!missionStandbyUiActive;
      const busy = !!(
        virtualMissionActive || sequenceActive || isFirmwareSequenceRunningState(currentSt) ||
        localTplusActive || replaySourceActive
      );
      const storageGuard = getSequenceStorageGuard();
      const blocked = !waiting && (
        busy || lockoutLatched || safetyModeEnabled || !isControlUnlocked() ||
        !(connOk || serialConnected || simEnabled) || storageGuard.blocked || currentSt !== 0
      );
      if(el.missionStandbyBtn){
        el.missionStandbyBtn.disabled = waiting || blocked;
        el.missionStandbyBtn.classList.toggle("is-running", waiting);
        el.missionStandbyBtn.setAttribute("aria-label", waiting
          ? "1단 발사 감지 대기 중"
          : "유선 점화 발사 감지 대기 시작");
      }
      if(el.missionStandbyBtnLabel){
        el.missionStandbyBtnLabel.textContent = waiting ? "발사 감지 대기" : "미션 대기";
      }
      if(el.missionStandbyBtnStatus){
        el.missionStandbyBtnStatus.textContent = waiting ? "WAITING" : "READY";
        el.missionStandbyBtnStatus.className = "pill " + (waiting ? "pill-blue" : "pill-gray");
      }
      if(el.mobileMissionStandbyBtn){
        el.mobileMissionStandbyBtn.disabled = waiting || blocked;
        el.mobileMissionStandbyBtn.classList.toggle("is-active", waiting);
      }
      if(el.mobileMissionStandbyStatus){
        el.mobileMissionStandbyStatus.textContent = waiting ? "감지 대기" : "준비";
        el.mobileMissionStandbyStatus.className =
          "mobile-quick-state pill " + (waiting ? "pill-blue" : "pill-gray");
      }
    }

    function updateMissionStandbyReviewValues(){
      const sec = value=>(Math.max(0, Number(value) || 0) / 1000).toFixed(1) + " s";
      const forceS1Ms = Math.max(0, Number(uiSettings.missionStage1SeparationBackupMs) || 0);
      const forceS2Ms = forceS1Ms + Math.max(0, Number(uiSettings.missionStage1EjectionDelayMs) || 0);
      if(el.missionForceS1Time) el.missionForceS1Time.textContent = "T+" + (forceS1Ms / 1000).toFixed(1);
      if(el.missionForceS2Time) el.missionForceS2Time.textContent = "T+" + (forceS2Ms / 1000).toFixed(1);
      if(el.missionForceS1Action) el.missionForceS1Action.textContent = "CH1 서보 " + uiSettings.missionStage1SeparationAngleDeg + "°";
      if(el.missionForceS2Action) el.missionForceS2Action.textContent = "CH2 서보 " + uiSettings.missionStage1EjectionAngleDeg + "° · 파인딩 버저";
      if(el.missionReviewS1Separation){
        el.missionReviewS1Separation.textContent = "T+" + sec(uiSettings.missionStage1SeparationBackupMs) + " · " + uiSettings.missionStage1SeparationAngleDeg + "°";
      }
      if(el.missionReviewS1Ejection){
        el.missionReviewS1Ejection.textContent = "2단 ARM +" + sec(uiSettings.missionStage1EjectionDelayMs) + " · " + uiSettings.missionStage1EjectionAngleDeg + "°";
      }
      if(el.missionReviewLinkFallback){
        el.missionReviewLinkFallback.textContent = "단분리 +" + sec(uiSettings.missionStage1EjectionDelayMs);
      }
      if(el.missionReviewLinkLoss){
        el.missionReviewLinkLoss.textContent = sec(uiSettings.missionLinkLossMs) + " 연속 미수신";
      }
      if(el.missionReviewLaunchGrace){
        el.missionReviewLaunchGrace.textContent = "점화 종료 +" + sec(uiSettings.missionLaunchGraceMs);
      }
      if(el.missionReviewS2Ejection){
        el.missionReviewS2Ejection.textContent = "점화 +" + sec(uiSettings.missionStage2EjectionDelayMs) + " · " + uiSettings.missionStage2EjectionAngleDeg + "°";
      }
    }

    async function refreshMissionTimingFromBoard(){
      if(simEnabled) return true;
      if(serialConnected){
        const reply = await requestSerialSettingsAck(1400);
        return !!(reply && reply.ok);
      }
      try{
        const data = await fetchJsonTimeout("/data_full", 1400);
        if(!data || typeof data !== "object") return false;
        const fields = [
          ["missionStage1SeparationBackupMs", data.mission_s1_sep_backup_ms, 500, 15000],
          ["missionStage1EjectionDelayMs", data.mission_s1_eject_delay_ms, 100, 10000],
          ["missionStage2EjectionDelayMs", data.mission_s2_eject_delay_ms, 500, 30000],
          ["missionLaunchGraceMs", data.mission_launch_grace_ms, 1000, 30000],
          ["missionLinkLossMs", data.mission_link_loss_ms, 200, 5000],
          ["missionStage1SeparationAngleDeg", data.mission_s1_sep_angle_deg, 0, 180],
          ["missionStage1EjectionAngleDeg", data.mission_s1_eject_angle_deg, 0, 180],
          ["missionStage2EjectionAngleDeg", data.mission_s2_eject_angle_deg, 0, 180]
        ];
        let complete = true;
        fields.forEach(([key, raw, min, max])=>{
          if(raw == null || !isFinite(Number(raw))){ complete = false; return; }
          uiSettings[key] = Math.max(min, Math.min(max, Math.round(Number(raw))));
        });
        if(complete){ saveSettings(); applySettingsToUI(); }
        return complete;
      }catch(_e){
        return false;
      }
    }

    async function confirmMissionStandbyFromUi(){
      setOverlayVisible(el.missionStandbyReviewOverlay, false);
      const unsafeStages = missionStandbyUnsafeStageIds();
      if(unsafeStages.length){
        await enforceMissionStandbySafety(unsafeStages);
        return;
      }
      const result = await sendCommand({
        http:"/mission_standby",
        ser:"/mission_standby"
      }, true);
      if(!result || !result.ok){
        const reason = String(result && result.reason || "");
        if(reason.indexOf("ARM_RELEASED_SAFE_MODE") >= 0 || reason.indexOf("ARM_UNSAFE") >= 0){
          await enforceMissionStandbySafety([]);
          return;
        }
        showToast("미션 대기 진입 실패: " + (reason || "보드 응답 없음"), "error", {
          key:"mission-standby-failed",
          duration:4500
        });
        return;
      }
      userWaitingLocal = true;
      missionStandbyUiActive = true;
      updateMissionStandbyButtonUi();
      setButtonsFromState(currentSt, lockoutLatched, true);
      addLogLine("미션 대기 · 1단 ARM 해제 시 즉시 T+ 및 미션 제어권 획득", "MISSION");
      showToast("미션 대기 중 · 1단 ARM 해제를 감시합니다.", "success", {
        key:"mission-standby-active",
        duration:4200
      });
    }

    async function startMissionStandbyFromUi(){
      if(missionStandbyUiActive || sequenceActive) return;
      const unsafeStages = missionStandbyUnsafeStageIds();
      if(unsafeStages.length){
        await enforceMissionStandbySafety(unsafeStages);
        return;
      }
      const storageGuard = getSequenceStorageGuard();
      if(storageGuard.blocked){
        showSequenceStorageGuardToast(true);
        return;
      }
      if(lockoutLatched || safetyModeEnabled || !isControlUnlocked()){
        showToast(!isControlUnlocked()
          ? "설비 점검을 완료한 뒤 미션 대기를 시작하세요."
          : "안전 모드 또는 제어 제한을 해제한 뒤 다시 시도하세요.", "notice", {
          key:"mission-standby-blocked"
        });
        return;
      }
      if(!(connOk || serialConnected || simEnabled)){
        showToast("에비오닉스 연결 후 미션 대기를 시작하세요.", "notice", {key:"mission-standby-link"});
        return;
      }
      hideMobileControlsPanel();
      const settingsReady = await refreshMissionTimingFromBoard();
      if(!settingsReady){
        showToast("보드에 저장된 미션 타이머를 확인할 수 없어 미션 대기를 중단했습니다.", "error", {
          key:"mission-settings-unavailable",
          duration:5200
        });
        return;
      }
      updateMissionStandbyReviewValues();
      setOverlayVisible(el.missionStandbyReviewOverlay, true);
    }

    function renderVirtualMissionUi(nowMs){
      if(!virtualMissionActive) return;
      const elapsedMs = Math.max(0, Number(nowMs || Date.now()) - virtualMissionStartMs);
      const timeLabel = "T+ " + formatVirtualMissionTime(elapsedMs);

      if(el.countdown) el.countdown.textContent = timeLabel;
      if(el.countdownMobile) el.countdownMobile.textContent = timeLabel;
      if(el.countdownBig) el.countdownBig.textContent = timeLabel;
      setMobileSequenceProgress(Math.min(1, elapsedMs / VIRTUAL_MISSION_CH2_MS));
      syncMobileSequenceTime();

      let statusText = "시간 기반 강제 미션 실행 중";
      let statusPillText = "FORCED";
      if(elapsedMs >= VIRTUAL_MISSION_CH2_MS){
        statusText = "강제 CH2 · 회수 시퀀스";
        statusPillText = "CH2";
        if(!virtualMissionCh2Logged){
          virtualMissionCh2Logged = true;
          addLogLine("강제 미션 CH2 시점 도달 · T+3.000 s", "MISSION");
          showToast("T+3.0초 · 펌웨어 CH2 서보 구동 시점", "info", {key:"virtual-mission-ch2"});
        }
      }else if(elapsedMs >= VIRTUAL_MISSION_CH1_MS){
        statusText = "강제 CH1 · 단분리 시퀀스";
        statusPillText = "CH1";
        if(!virtualMissionCh1Logged){
          virtualMissionCh1Logged = true;
          addLogLine("강제 미션 CH1 시점 도달 · T+2.000 s", "MISSION");
          showToast("T+2.0초 · 펌웨어 CH1 서보 구동 시점", "info", {key:"virtual-mission-ch1"});
        }
      }

      if(el.statusPill){
        el.statusPill.className = "status-seq";
        el.statusPill.textContent = statusPillText;
      }
      if(el.statusPillMeta){
        el.statusPillMeta.className = "status-seq";
        el.statusPillMeta.textContent = statusPillText;
      }
      if(el.statusText) el.statusText.textContent = statusText;
      if(el.countdownStatus) el.countdownStatus.textContent = statusText;
      if(el.sequenceStatusDesktop) el.sequenceStatusDesktop.textContent = "강제";
      if(el.mobileSequenceWideStatus) el.mobileSequenceWideStatus.textContent = "강제";
      if(el.mobileSequenceStatusText) el.mobileSequenceStatusText.textContent = statusText;
      if(el.mobileSequenceStatusPill){
        el.mobileSequenceStatusPill.textContent = statusPillText;
        el.mobileSequenceStatusPill.className = "mobile-sequence-status-pill status-seq";
      }
      if(el.quickState){
        el.quickState.innerHTML = '<span class="num">FORCED</span>';
        setQuickItemStatus(el.quickState, "warn");
      }

      updateVirtualMissionButtonUi();
      syncCountdownInlineStatus();
      syncGyroStatusFromMain();
      syncExpandedHud();

      if(elapsedMs >= VIRTUAL_MISSION_COMPLETE_MS){
        stopVirtualMission("complete");
      }
    }

    function stopVirtualMission(reason){
      if(!virtualMissionActive) return;
      if(virtualMissionTimer != null){
        clearInterval(virtualMissionTimer);
        virtualMissionTimer = null;
      }
      const completed = reason === "complete";
      virtualMissionActive = false;
      virtualMissionStartMs = 0;
      virtualMissionCh1Logged = false;
      virtualMissionCh2Logged = false;
      updateVirtualMissionButtonUi();
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
      setStatusFromState(
        currentSt,
        !!(latestTelemetry && latestTelemetry.ic === 1),
        false,
        lockoutLatched,
        sequenceActive,
        false
      );
      if(el.countdown && (!connOk || !window.__flashLastSample)){
        el.countdown.textContent = "T- --:--:--";
        if(el.countdownMobile) el.countdownMobile.textContent = "T- --:--:--";
        if(el.countdownBig) el.countdownBig.textContent = "T- --:--:--";
        syncMobileSequenceTime();
      }
      if(completed){
        addLogLine("시간 기반 강제 미션 타임라인 완료", "MISSION");
        showToast("강제 미션 타임라인이 완료되었습니다.", "success", {key:"virtual-mission-complete"});
      }else if(reason === "failed"){
        addLogLine("강제 미션 명령 전송 실패", "ERR");
        showToast("강제 미션 명령을 전달하지 못했습니다.", "error", {key:"forced-mission-failed"});
      }else if(reason === "board"){
        addLogLine("실제 보드 시퀀스 감지 · 가상 미션 자동 종료", "VIRTUAL");
        showToast("실제 보드 시퀀스를 감지해 가상 미션을 종료했습니다.", "notice", {key:"virtual-mission-board"});
      }else{
        addLogLine("강제 미션 사용자 중단 · 대기 중인 서보 동작 취소", "MISSION");
        showToast("강제 미션을 중단했습니다.", "notice", {key:"virtual-mission-stop"});
      }
    }

    function canStartForcedTimedMission(){
      return !(
        virtualMissionActive ||
        sequenceActive ||
        isFirmwareSequenceRunningState(currentSt) ||
        localTplusActive ||
        replaySourceActive ||
        safetyModeEnabled ||
        lockoutLatched
      );
    }

    function hideMissionForceConfirm(){
      setOverlayVisible(el.missionForceOverlay, false);
    }

    function showMissionForceConfirm(){
      hideMobileControlsPanel();
      if(!canStartForcedTimedMission()){
        const message = safetyModeEnabled
          ? "안전 모드에서는 강제 미션을 실행할 수 없습니다."
          : "다른 시퀀스가 진행 중이거나 현재 제어가 잠겨 있습니다.";
        showToast(message, lockoutLatched ? "error" : "notice", {key:"forced-mission-blocked"});
        return;
      }
      if(!isControlUnlocked()){
        showToast(t("inspectionRequiredToast"), "notice", {key:"forced-mission-inspection"});
        return;
      }
      if(!(connOk || serialConnected || simEnabled)){
        showToast("에비오닉스 연결 후 강제 미션을 실행하세요.", "notice", {key:"forced-mission-link"});
        return;
      }
      updateMissionStandbyReviewValues();
      setOverlayVisible(el.missionForceOverlay, true);
    }

    async function confirmForcedTimedMission(){
      if(!canStartForcedTimedMission()){
        hideMissionForceConfirm();
        showToast("현재 상태가 변경되어 강제 미션을 시작하지 않았습니다.", "notice", {key:"forced-mission-state-changed"});
        return;
      }
      hideMissionForceConfirm();
      if(
        !isControlUnlocked() ||
        !(connOk || serialConnected || simEnabled)
      ){
        showToast("설비 점검과 에비오닉스 연결 상태를 다시 확인하세요.", "notice", {key:"forced-mission-preflight"});
        return;
      }
      virtualMissionActive = true;
      virtualMissionStartMs = Date.now();
      virtualMissionCh1Logged = false;
      virtualMissionCh2Logged = false;
      addLogLine("펌웨어 시간 기반 강제 미션 요청 · 파이로 출력 없음", "MISSION");
      showToast("강제 미션 요청 · T+2초/3초에 실제 서보가 동작합니다.", "warn", {key:"forced-mission-start"});
      setButtonsFromState(currentSt, lockoutLatched, sequenceActive);
      renderVirtualMissionUi(virtualMissionStartMs);
      virtualMissionTimer = setInterval(()=>renderVirtualMissionUi(Date.now()), 40);
      const commandResult = await sendCommand({
        http:"/mission_force_timed",
        ser:"/mission_force_timed"
      }, true);
      if(!commandResult || !commandResult.ok){
        stopVirtualMission("failed");
      }
    }

    function toggleVirtualMission(){
      if(virtualMissionActive) return;
      showMissionForceConfirm();
    }

    function updateKstClock(){
      const fullState = getKstClockState(true);
      const compactState = getKstClockState(false);
      const sourceText = "KST · " + fullState.source;
      const compactSourceText = "KST · " + compactState.source;
      if(el.kstTime) el.kstTime.textContent = fullState.text;
      if(el.mobileSequenceClock) el.mobileSequenceClock.textContent = fullState.text;
      if(el.mobileSequenceClockSource) el.mobileSequenceClockSource.textContent = sourceText;
      if(el.statusMapHudTimeCompact) el.statusMapHudTimeCompact.textContent = compactState.text;
      if(el.gyro3dHudTimeCompact) el.gyro3dHudTimeCompact.textContent = compactState.text;
      if(el.statusMapHudClockSourceCompact) el.statusMapHudClockSourceCompact.textContent = compactSourceText;
      if(el.gyro3dHudClockSourceCompact) el.gyro3dHudClockSourceCompact.textContent = compactSourceText;
      syncMobileSequenceTime();
    }

    function trimArrayToMax(list, maxLen, chunkSize){
      if(!Array.isArray(list)) return;
      const max = Math.max(0, Math.round(Number(maxLen) || 0));
      if(max <= 0){
        list.length = 0;
        return;
      }
      const chunk = Math.max(1, Math.round(Number(chunkSize) || 1));
      if(list.length <= max + chunk) return;
      list.splice(0, list.length - max);
    }

    function lowerBoundNumber(list, value){
      let lo = 0;
      let hi = Array.isArray(list) ? list.length : 0;
      while(lo < hi){
        const mid = (lo + hi) >> 1;
        if(Number(list[mid]) < value) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    }

    function upperBoundNumber(list, value){
      let lo = 0;
      let hi = Array.isArray(list) ? list.length : 0;
      while(lo < hi){
        const mid = (lo + hi) >> 1;
        if(Number(list[mid]) <= value) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    }

    function getViewIndices(data, view){
      const len=data.length;
      if(len===0) return {start:0,end:-1};

      if(view && view.windowMs && chartTimeHistory.length === len){
        let windowMs = view.windowMs;
        const allowSmallWindow = !!view.allowSmallWindow;
        if(windowMs < CHART_WINDOW_MS_MIN) windowMs = allowSmallWindow ? Math.max(1000, windowMs) : CHART_WINDOW_MS_MIN;
        if(windowMs > CHART_WINDOW_MS_MAX) windowMs = CHART_WINDOW_MS_MAX;

        const lastTime = chartTimeHistory[len - 1] || 0;
        let startMs = view.startMs;
        if(startMs == null) startMs = lastTime - windowMs;
        const endMs = startMs + windowMs;

        const start = Math.min(len - 1, lowerBoundNumber(chartTimeHistory, startMs));
        const end = Math.max(start, Math.min(len - 1, upperBoundNumber(chartTimeHistory, endMs) - 1));
        return {start, end};
      }

      let windowSize=view.window||len;
      if(windowSize<2) windowSize=2;
      if(windowSize>len) windowSize=len;
      let start=view.start||0;
      if(start<0) start=0;
      if(start+windowSize>len) start=len-windowSize;
      return {start:start,end:start+windowSize-1};
    }

    function colorToRgba(hex, alpha){
      if(!hex) hex="#000000";
      if(hex[0]==="#") hex=hex.substring(1);
      if(hex.length===3) hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
      const r=parseInt(hex.substring(0,2),16)||0;
      const g=parseInt(hex.substring(2,4),16)||0;
      const b=parseInt(hex.substring(4,6),16)||0;
      return "rgba("+r+","+g+","+b+","+alpha+")";
    }
