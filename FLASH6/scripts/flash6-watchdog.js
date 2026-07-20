/* FLASH6 boot watchdog and fallback connectivity probe. */
    (function(){
      window.__flashBoot = window.__flashBoot || { jsReady:false, lastError:"" };
      function isIgnorableRuntimeNoise(msg){
        var lowerMsg = String(msg || "").toLowerCase();
        return (
          lowerMsg.indexOf("response.result") >= 0 ||
          lowerMsg.indexOf("_fadeanimated") >= 0 ||
          lowerMsg.indexOf("getcenter") >= 0
        );
      }
      window.addEventListener("error", function(ev){
        try{
          var msg = String(ev && (ev.message || ev.error || ""));
          if(isIgnorableRuntimeNoise(msg)){
            try{ ev.preventDefault(); }catch(_e2){}
            return;
          }
          window.__flashBoot.lastError = msg;
          if(window.__flashBoot && typeof window.__flashBoot.showBootError === "function"){
            window.__flashBoot.showBootError("window error: " + msg);
          }
          if(window.__flashBoot && window.__flashBoot.emit){
            window.__flashBoot.emit("window_error", msg);
          }
        }catch(_e){}
      });
      window.addEventListener("unhandledrejection", function(ev){
        try{
          var reason = ev && ev.reason;
          var msg = "promise_reject";
          if(reason && typeof reason === "object" && reason.message) msg = reason.message;
          else if(reason != null) msg = String(reason);
          if(isIgnorableRuntimeNoise(msg)){
            try{ ev.preventDefault(); }catch(_e2){}
            return;
          }
          window.__flashBoot.lastError = msg;
          if(window.__flashBoot && typeof window.__flashBoot.showBootError === "function"){
            window.__flashBoot.showBootError("promise reject: " + msg);
          }
          if(window.__flashBoot && window.__flashBoot.emit){
            window.__flashBoot.emit("window_reject", msg);
          }
        }catch(_e){}
      });
      setTimeout(function(){
        var app = document.querySelector(".page-wrap");
        var splash = document.getElementById("splash");
        if(app && !app.classList.contains("ready")){
          app.classList.add("ready");
        }
        if(splash && !splash.classList.contains("hide")){
          splash.classList.add("hide");
        }
      }, 3500);
    })();

    window.addEventListener("load", function(){
      try{
        if(window.__flashBoot && window.__flashBoot.emit){
          window.__flashBoot.emit("html_load");
        }
      }catch(_e){}
      setTimeout(function(){
        if(window.__flashBoot && window.__flashBoot.localPreview) return;
        if(window.__flashBoot && window.__flashBoot.nativeShell) return;
        if(window.__flashBoot && window.__flashBoot.beaconEnabled === false) return;
        if(window.__flashBoot && window.__flashBoot.jsReady) return;
        try{
          if(window.__flashBoot && window.__flashBoot.emit){
            window.__flashBoot.emit("flash6_watchdog", window.__flashBoot.lastError || "js_not_ready");
          }
        if(window.__flashBoot && typeof window.__flashBoot.showBootError === "function"){
          window.__flashBoot.showBootError("대시보드 JS 로딩에 실패했습니다 (10초 타임아웃).\n연결 상태를 확인한 뒤 페이지를 새로고침하세요.");
        }
        }catch(_e){}
      }, 10000);

      // If main app JS is not ready, run a tiny inline fallback probe so we can
      // verify /data + /ws path independently in serial logs.
      setTimeout(function(){
        if(window.__flashBoot && window.__flashBoot.localPreview) return;
        if(window.__flashBoot && window.__flashBoot.nativeShell) return;
        if(window.__flashBoot && window.__flashBoot.beaconEnabled === false) return;
        if(window.__flashBoot && window.__flashBoot.jsReady) return;
        try{
          if(window.__flashBoot && window.__flashBoot.emit){
            window.__flashBoot.emit("fallback_probe_start");
          }
        }catch(_e){}

        try{
          fetch("/data", {cache:"no-store"})
            .then(function(resp){
              if(!resp || !resp.ok) throw new Error("HTTP_" + (resp ? resp.status : 0));
              return resp.text();
            })
            .then(function(){
              try{
                if(window.__flashBoot && window.__flashBoot.emit){
                  window.__flashBoot.emit("fallback_data_ok");
                }
              }catch(_e){}
            })
            .catch(function(err){
              try{
                if(window.__flashBoot && window.__flashBoot.emit){
                  window.__flashBoot.emit("fallback_data_fail", String((err && err.message) || err || "data_fail"));
                }
              }catch(_e){}
            });
        }catch(_e){}

        try{
          var wsProto = (location.protocol === "https:") ? "wss://" : "ws://";
          var ws = new WebSocket(wsProto + location.host + "/ws");
          ws.onopen = function(){
            try{
              if(window.__flashBoot && window.__flashBoot.emit){
                window.__flashBoot.emit("fallback_ws_open");
              }
            }catch(_e){}
            try{ ws.close(1000, "probe_done"); }catch(_e){}
          };
          ws.onerror = function(){
            try{
              if(window.__flashBoot && window.__flashBoot.emit){
                window.__flashBoot.emit("fallback_ws_error");
              }
            }catch(_e){}
          };
          ws.onclose = function(ev){
            try{
              if(window.__flashBoot && window.__flashBoot.emit){
                window.__flashBoot.emit("fallback_ws_close", "code=" + ((ev && ev.code) || 0));
              }
            }catch(_e){}
          };
        }catch(_e){
          try{
            if(window.__flashBoot && window.__flashBoot.emit){
              window.__flashBoot.emit("fallback_ws_fail", String((_e && _e.message) || _e || "ws_fail"));
            }
          }catch(_ex){}
        }
      }, 4500);
    });
