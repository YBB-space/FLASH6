/* FLASH6 runtime module: stage-1 BIN driven stage-2 prediction workspace. */
    const SIM_PLUS_REFERENCE = Object.freeze({
      design:{stage1Accel:50.45, stage1Speed:65.83, stage1Apogee:140, separationAltitude:79},
      observed:{stage1Accel:61.07, stage1Speed:46, stage1Apogee:107, separationAltitude:45.53},
      stage2Design:{maxAccel:77.64, maxSpeed:112.45, apogee:561},
      stage2Observed:{maxAccel:77.4, maxSpeed:109, apogee:522},
      staticMargin:[1.56, 1.96],
      deploymentTerminalSpeed:11.5
    });
    const simulationPlusState = {
      file:null,
      frames:[],
      analysis:null,
      prediction:null,
      resizeObserver:null,
      renderRaf:0
    };

    function simulationPlusFinite(value, fallback){
      const numeric = Number(value);
      return isFinite(numeric) ? numeric : fallback;
    }

    function simulationPlusClamp(value, min, max){
      return Math.min(max, Math.max(min, Number(value) || 0));
    }

    function simulationPlusMedian(values){
      const clean = values.filter(isFinite).sort((a,b)=>a-b);
      if(!clean.length) return NaN;
      const center = Math.floor(clean.length / 2);
      return clean.length % 2 ? clean[center] : ((clean[center - 1] + clean[center]) / 2);
    }

    function simulationPlusRobustSigma(values){
      const clean = values.filter(isFinite);
      if(clean.length < 4) return NaN;
      const center = simulationPlusMedian(clean);
      return simulationPlusMedian(clean.map((value)=>Math.abs(value - center))) * 1.4826;
    }

    function simulationPlusEscape(value){
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function simulationPlusAltitude(sample){
      if(!sample) return NaN;
      const candidates = [sample.altitude_corrected_m, sample.alt_m, sample.altitude_m, sample.altitude, sample.alt];
      for(const value of candidates){
        const numeric = Number(value);
        if(isFinite(numeric)) return numeric;
      }
      return NaN;
    }

    function simulationPlusFrameTime(frame, fallback){
      const ts = Number(frame && frame.tsMs);
      if(isFinite(ts)) return ts;
      const ut = Number(frame && frame.sample && frame.sample.ut);
      return isFinite(ut) ? ut : fallback;
    }

    function simulationPlusLaunchTime(frames){
      let powered = NaN;
      let positiveMission = NaN;
      for(const frame of frames){
        const sample = frame && frame.sample;
        if(!sample) continue;
        const ts = simulationPlusFrameTime(frame, NaN);
        if(!isFinite(ts)) continue;
        const td = Number(sample.td);
        if(Number(sample.st) === 3){
          return isFinite(td) && td >= 0 ? ts - td : ts;
        }
        if(!isFinite(positiveMission) && isFinite(td) && td > 0) positiveMission = ts - td;
        const phaseCode = Number(sample.flight_phase_code);
        const phaseName = String(sample.flight_phase || "").trim().toUpperCase();
        if(!isFinite(powered) && (phaseCode === 1 || phaseName === "POWERED_FLIGHT")){
          powered = isFinite(td) && td >= 0 ? ts - td : ts;
        }
      }
      if(isFinite(powered)) return powered;
      if(isFinite(positiveMission)) return positiveMission;

      let highSince = NaN;
      for(const frame of frames){
        const sample = frame && frame.sample;
        const ts = simulationPlusFrameTime(frame, NaN);
        if(!sample || !isFinite(ts)) continue;
        const stored = Number(sample.flight_accel_raw_g);
        const magnitude = isFinite(stored)
          ? stored
          : Math.hypot(Number(sample.ax), Number(sample.ay), Number(sample.az));
        if(isFinite(magnitude) && magnitude > 1.8){
          if(!isFinite(highSince)) highSince = ts;
          if(ts - highSince >= 100) return highSince;
        }else{
          highSince = NaN;
        }
      }
      return simulationPlusFrameTime(frames[0], 0);
    }

    function simulationPlusHasSeparationAlarm(sample){
      const events = sample && Array.isArray(sample.mission_alarm_events)
        ? sample.mission_alarm_events
        : [];
      return events.some((event)=>{
        const text = String((event && event.title) || "") + " " + String((event && event.message) || "");
        return /STAGE[ _-]?SEP|단분리|SEPARATION/i.test(text);
      });
    }

    function simulationPlusSeparationIndex(frames, launchAtMs){
      let firstAfterLaunch = 0;
      for(let index = 0; index < frames.length; index++){
        const frame = frames[index];
        const sample = frame && frame.sample;
        const ts = simulationPlusFrameTime(frame, NaN);
        if(isFinite(ts) && ts >= launchAtMs) firstAfterLaunch = index;
        if(!sample || !isFinite(ts) || ts < launchAtMs) continue;
        if(Number(sample.deployment_state) >= 2 || simulationPlusHasSeparationAlarm(sample)) return index;
      }
      const fallbackAt = launchAtMs + 2500;
      for(let index = firstAfterLaunch; index < frames.length; index++){
        if(simulationPlusFrameTime(frames[index], Infinity) >= fallbackAt) return index;
      }
      return Math.max(0, frames.length - 1);
    }

    function simulationPlusSmoothedAltitudes(frames){
      const raw = frames.map((frame)=>simulationPlusAltitude(frame && frame.sample));
      return raw.map((value, index)=>{
        const window = [];
        for(let cursor = Math.max(0, index - 4); cursor <= Math.min(raw.length - 1, index + 4); cursor++){
          if(isFinite(raw[cursor])) window.push(raw[cursor]);
        }
        const median = simulationPlusMedian(window);
        return isFinite(median) ? median : value;
      });
    }

    function simulationPlusRegressionSlope(frames, values, endIndex, windowMs){
      if(endIndex < 1) return NaN;
      const endTs = simulationPlusFrameTime(frames[endIndex], NaN);
      if(!isFinite(endTs)) return NaN;
      const points = [];
      for(let index = endIndex; index >= 0; index--){
        const ts = simulationPlusFrameTime(frames[index], NaN);
        const value = Number(values[index]);
        if(!isFinite(ts) || !isFinite(value)) continue;
        if(endTs - ts > windowMs) break;
        points.push({x:(ts - endTs) / 1000, y:value});
      }
      if(points.length < 4) return NaN;
      const meanX = points.reduce((sum, point)=>sum + point.x, 0) / points.length;
      const meanY = points.reduce((sum, point)=>sum + point.y, 0) / points.length;
      let numerator = 0;
      let denominator = 0;
      points.forEach((point)=>{
        numerator += (point.x - meanX) * (point.y - meanY);
        denominator += Math.pow(point.x - meanX, 2);
      });
      return denominator > 0 ? numerator / denominator : NaN;
    }

    function simulationPlusAnalyzeStage1(frames){
      if(!Array.isArray(frames) || frames.length < 10){
        throw new Error("비행 샘플이 부족합니다.");
      }
      const launchAtMs = simulationPlusLaunchTime(frames);
      const separationIndex = simulationPlusSeparationIndex(frames, launchAtMs);
      const separationFrame = frames[separationIndex];
      const separationAtMs = simulationPlusFrameTime(separationFrame, launchAtMs + 2500);
      const altitudes = simulationPlusSmoothedAltitudes(frames);
      const launchIndex = Math.max(0, frames.findIndex((frame)=>simulationPlusFrameTime(frame, Infinity) >= launchAtMs));
      const flightAltitudes = altitudes.slice(launchIndex).filter(isFinite);
      const apogeeM = flightAltitudes.length ? Math.max.apply(null, flightAltitudes) : NaN;
      const separationAltitudeM = simulationPlusMedian(
        altitudes.slice(Math.max(0, separationIndex - 4), Math.min(altitudes.length, separationIndex + 5))
      );
      let separationSpeedMps = simulationPlusRegressionSlope(frames, altitudes, separationIndex, 650);
      const separationSample = separationFrame && separationFrame.sample;
      const storedFastSpeed = Number(separationSample && separationSample.flight_fast_vertical_speed_mps);
      const storedDisplaySpeed = Number(separationSample && separationSample.vertical_speed_mps);
      if(isFinite(storedFastSpeed) && storedFastSpeed > 0) separationSpeedMps = storedFastSpeed;
      else if(isFinite(storedDisplaySpeed) && storedDisplaySpeed > 0) separationSpeedMps = storedDisplaySpeed;

      let maxAccelMps2 = NaN;
      let maxRecordedSpeedMps = NaN;
      const derivedSpeeds = [];
      for(let index = Math.max(1, launchIndex); index < frames.length; index++){
        const sample = frames[index] && frames[index].sample;
        if(!sample) continue;
        const storedMagnitude = Number(sample.flight_accel_raw_g);
        const rawMagnitude = isFinite(storedMagnitude)
          ? storedMagnitude
          : Math.hypot(Number(sample.ax), Number(sample.ay), Number(sample.az));
        if(isFinite(rawMagnitude)){
          const accelMps2 = rawMagnitude * 9.80665;
          if(!isFinite(maxAccelMps2) || accelMps2 > maxAccelMps2) maxAccelMps2 = accelMps2;
        }
        const recordedSpeed = Number(sample.actual_speed_recorded) === 1
          ? Number(sample.speed_mps)
          : NaN;
        if(isFinite(recordedSpeed) && recordedSpeed >= 0){
          if(!isFinite(maxRecordedSpeedMps) || recordedSpeed > maxRecordedSpeedMps) maxRecordedSpeedMps = recordedSpeed;
        }
        const slope = simulationPlusRegressionSlope(frames, altitudes, index, 420);
        if(isFinite(slope) && slope > 0 && slope < 180) derivedSpeeds.push(slope);
      }
      const maxDerivedSpeedMps = derivedSpeeds.length
        ? derivedSpeeds.sort((a,b)=>a-b)[Math.floor((derivedSpeeds.length - 1) * 0.97)]
        : NaN;
      const maxSpeedMps = isFinite(maxRecordedSpeedMps) && maxRecordedSpeedMps > 5
        ? maxRecordedSpeedMps
        : maxDerivedSpeedMps;

      const altitudeResiduals = [];
      const accelDifferences = [];
      const sampleIntervals = [];
      let previousAccelMagnitude = NaN;
      let previousFrameTime = NaN;
      frames.forEach((frame, index)=>{
        const sample = frame && frame.sample;
        if(!sample) return;
        const rawAltitude = Number(sample.alt_m);
        const filteredAltitude = Number(altitudes[index]);
        if(isFinite(rawAltitude) && isFinite(filteredAltitude)){
          const residual = rawAltitude - filteredAltitude;
          if(Math.abs(residual) < 20) altitudeResiduals.push(residual);
        }
        const storedMagnitude = Number(sample.flight_accel_raw_g);
        const magnitude = isFinite(storedMagnitude)
          ? storedMagnitude
          : Math.hypot(Number(sample.ax), Number(sample.ay), Number(sample.az));
        if(isFinite(magnitude) && isFinite(previousAccelMagnitude)){
          const difference = (magnitude - previousAccelMagnitude) * 9.80665;
          if(Math.abs(difference) < 80) accelDifferences.push(difference);
        }
        if(isFinite(magnitude)) previousAccelMagnitude = magnitude;
        const ts = simulationPlusFrameTime(frame, NaN);
        if(isFinite(ts) && isFinite(previousFrameTime)){
          const interval = ts - previousFrameTime;
          if(interval > 0 && interval < 500) sampleIntervals.push(interval);
        }
        if(isFinite(ts)) previousFrameTime = ts;
      });
      const altitudeNoiseSigmaM = simulationPlusClamp(
        simulationPlusFinite(simulationPlusRobustSigma(altitudeResiduals), 0.38), 0.08, 3.5
      );
      const accelNoiseSigmaMps2 = simulationPlusClamp(
        simulationPlusFinite(simulationPlusRobustSigma(accelDifferences) / Math.sqrt(2), 0.9), 0.15, 9
      );
      const medianSampleIntervalMs = simulationPlusFinite(simulationPlusMedian(sampleIntervals), 10);
      const sampleJitterSigmaMs = simulationPlusClamp(
        simulationPlusFinite(simulationPlusRobustSigma(sampleIntervals), 0), 0, 40
      );

      const hasNativeSeparation = Number(separationSample && separationSample.deployment_state) >= 2 ||
        simulationPlusHasSeparationAlarm(separationSample);
      const qualitySignals = [apogeeM, separationAltitudeM, separationSpeedMps, maxAccelMps2, maxSpeedMps]
        .filter(isFinite).length;
      const quality = simulationPlusClamp(0.46 + (qualitySignals * 0.085) + (hasNativeSeparation ? 0.1 : 0), 0.55, 0.94);
      return {
        launchAtMs,
        separationAtMs,
        separationTPlusSec:Math.max(0, (separationAtMs - launchAtMs) / 1000),
        separationIndex,
        separationAltitudeM:isFinite(separationAltitudeM) ? separationAltitudeM : SIM_PLUS_REFERENCE.observed.separationAltitude,
        separationSpeedMps:simulationPlusClamp(isFinite(separationSpeedMps) ? separationSpeedMps : 34, 8, 78),
        stage1ApogeeM:isFinite(apogeeM) ? apogeeM : SIM_PLUS_REFERENCE.observed.stage1Apogee,
        stage1MaxSpeedMps:isFinite(maxSpeedMps) ? maxSpeedMps : SIM_PLUS_REFERENCE.observed.stage1Speed,
        stage1MaxAccelMps2:isFinite(maxAccelMps2) ? maxAccelMps2 : SIM_PLUS_REFERENCE.observed.stage1Accel,
        nativeSeparation:hasNativeSeparation,
        sampleCount:frames.length,
        durationSec:Math.max(0, (simulationPlusFrameTime(frames[frames.length - 1], launchAtMs) - launchAtMs) / 1000),
        altitudeNoiseSigmaM,
        accelNoiseSigmaMps2,
        medianSampleIntervalMs,
        sampleJitterSigmaMs,
        quality
      };
    }

    function simulationPlusSeededRandom(seed){
      let state = (Math.floor(Number(seed) || 1) >>> 0) || 1;
      return ()=>{
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 4294967296;
      };
    }

    function simulationPlusGaussian(random){
      const u = Math.max(1e-9, random());
      const v = Math.max(1e-9, random());
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    function simulationPlusQuantile(values, position){
      const sorted = values.filter(isFinite).sort((a,b)=>a-b);
      if(!sorted.length) return NaN;
      const index = simulationPlusClamp(position, 0, 1) * (sorted.length - 1);
      const low = Math.floor(index);
      const high = Math.ceil(index);
      const mix = index - low;
      return sorted[low] + ((sorted[high] - sorted[low]) * mix);
    }

    function simulationPlusReferencePosition(value, observed, design){
      const span = design - observed;
      if(Math.abs(span) < 1e-6) return 0;
      return simulationPlusClamp((value - observed) / span, -0.45, 1.45);
    }

    function simulationPlusPredictTargets(analysis){
      const ref = SIM_PLUS_REFERENCE;
      const pAltitude = simulationPlusReferencePosition(
        analysis.stage1ApogeeM, ref.observed.stage1Apogee, ref.design.stage1Apogee
      );
      const pSeparation = simulationPlusReferencePosition(
        analysis.separationAltitudeM, ref.observed.separationAltitude, ref.design.separationAltitude
      );
      const pSpeed = simulationPlusReferencePosition(
        analysis.stage1MaxSpeedMps, ref.observed.stage1Speed, ref.design.stage1Speed
      );
      const pAccel = simulationPlusReferencePosition(
        analysis.stage1MaxAccelMps2, ref.observed.stage1Accel, ref.design.stage1Accel
      );
      const energyPosition = simulationPlusClamp(
        (pAltitude * 0.45) + (pSeparation * 0.35) + (pSpeed * 0.20),
        -0.35,
        1.35
      );
      const speedPosition = simulationPlusClamp((pSpeed * 0.6) + (pAltitude * 0.4), -0.35, 1.35);
      const maxAccel = ref.stage2Observed.maxAccel +
        ((ref.stage2Design.maxAccel - ref.stage2Observed.maxAccel) * pAccel);
      const maxSpeed = ref.stage2Observed.maxSpeed +
        ((ref.stage2Design.maxSpeed - ref.stage2Observed.maxSpeed) * speedPosition);
      const apogee = ref.stage2Observed.apogee +
        ((ref.stage2Design.apogee - ref.stage2Observed.apogee) * energyPosition);
      return {
        maxAccel:simulationPlusClamp(maxAccel, 70, 84),
        maxSpeed:simulationPlusClamp(maxSpeed, 96, 119),
        apogee:simulationPlusClamp(Math.max(analysis.separationAltitudeM + 300, apogee), 410, 620),
        performanceIndex:energyPosition
      };
    }

    function simulationPlusCoastGain(initialSpeed, dragCoefficient, dt){
      let speed = initialSpeed;
      let height = 0;
      let time = 0;
      while(speed > 0 && time < 40){
        const accel = -9.80665 - (dragCoefficient * speed * speed);
        speed = Math.max(0, speed + accel * dt);
        height += speed * dt;
        time += dt;
      }
      return {height, time};
    }

    function simulationPlusBuildPrediction(analysis){
      const targets = simulationPlusPredictTargets(analysis);
      const dt = 0.02;
      const samples = [];
      const initialAltitude = Math.max(0, analysis.separationAltitudeM);
      const initialSpeed = simulationPlusClamp(analysis.separationSpeedMps, 8, targets.maxSpeed - 18);
      const baseAcceleration = targets.maxAccel * 0.28;
      const averageFactor = 0.28 + ((1 - 0.28) * (2 / Math.PI));
      const burnDuration = simulationPlusClamp(
        (targets.maxSpeed - initialSpeed) / Math.max(1, targets.maxAccel * averageFactor),
        0.9,
        2.1
      );
      let time = 0;
      let altitude = initialAltitude;
      let speed = initialSpeed;
      let maxSpeed = speed;
      while(time < burnDuration - (dt * 0.5)){
        const progress = simulationPlusClamp(time / burnDuration, 0, 1);
        const accel = baseAcceleration +
          ((targets.maxAccel - baseAcceleration) * Math.sin(Math.PI * progress));
        speed += accel * dt;
        altitude += speed * dt;
        maxSpeed = Math.max(maxSpeed, speed);
        samples.push({time, altitude, speed, accel, phase:"2단 추력 비행"});
        time += dt;
      }
      if(maxSpeed > 0){
        const correction = targets.maxSpeed / maxSpeed;
        samples.forEach((sample)=>{
          if(sample.phase === "2단 추력 비행") sample.speed *= correction;
        });
        speed *= correction;
        altitude = initialAltitude;
        samples.forEach((sample)=>{
          altitude += sample.speed * dt;
          sample.altitude = altitude;
        });
      }
      const burnoutTime = time;
      const burnoutAltitude = altitude;
      const requiredCoastGain = Math.max(40, targets.apogee - burnoutAltitude);
      let lowDrag = 0;
      let highDrag = 0.01;
      for(let iteration = 0; iteration < 36; iteration++){
        const middle = (lowDrag + highDrag) / 2;
        if(simulationPlusCoastGain(speed, middle, dt).height > requiredCoastGain) lowDrag = middle;
        else highDrag = middle;
      }
      const dragCoefficient = (lowDrag + highDrag) / 2;
      while(speed > 0.02 && time < 45){
        const accel = -9.80665 - (dragCoefficient * speed * speed);
        speed = Math.max(0, speed + accel * dt);
        altitude += speed * dt;
        samples.push({time, altitude, speed, accel, phase:"코스팅"});
        time += dt;
      }
      const apogeeTime = time;
      const apogeeAltitude = altitude;
      let descentSpeed = 0;
      const terminal = SIM_PLUS_REFERENCE.deploymentTerminalSpeed;
      while(altitude > 0 && time < 120){
        descentSpeed += ((terminal - descentSpeed) / 0.72) * dt;
        const nextAltitude = Math.max(0, altitude - (descentSpeed * dt));
        const accel = -(descentSpeed / Math.max(dt, 0.72));
        altitude = nextAltitude;
        samples.push({time, altitude, speed:descentSpeed, accel, phase:"낙하산 하강"});
        time += dt;
      }
      const uncertainty = simulationPlusClamp(0.17 - (analysis.quality * 0.09), 0.075, 0.12);
      const random = simulationPlusSeededRandom(
        analysis.sampleCount * 2654435761 + Math.round(analysis.separationAltitudeM * 100)
      );
      // A stage-2 prediction should resemble the signal that the avionics will
      // actually record, not a laboratory-perfect trajectory. Keep the model
      // truth deterministic, then pass it through a conservative sensor/body
      // disturbance model derived from the uploaded stage-1 record.
      const altitudeSigma = simulationPlusClamp(
        Math.max(1.6, analysis.altitudeNoiseSigmaM * 2.15), 1.6, 7.5
      );
      const accelSigma = simulationPlusClamp(
        Math.max(1.15, analysis.accelNoiseSigmaMps2 * 1.35), 1.15, 13
      );
      const vibrationScale = simulationPlusClamp(
        1.15 + (analysis.accelNoiseSigmaMps2 * 0.4), 1.15, 4.6
      );
      let coloredAltitudeNoise = simulationPlusGaussian(random) * altitudeSigma;
      let barometerBias = simulationPlusGaussian(random) * altitudeSigma * 0.35;
      let coloredSpeedNoise = 0;
      let coloredAccelNoise = simulationPlusGaussian(random) * accelSigma;
      samples.forEach((sample)=>{
        const phaseGrowth = sample.time <= apogeeTime
          ? (0.35 + (0.65 * sample.time / Math.max(apogeeTime, 0.1)))
          : 1;
        const spread = Math.max(3, sample.altitude * uncertainty * phaseGrowth);
        sample.altitudeLow = Math.max(0, sample.altitude - spread);
        sample.altitudeHigh = sample.altitude + spread;
        sample.tPlus = analysis.separationTPlusSec + sample.time;
        const isPowered = sample.phase === "2단 추력 비행";
        const isCoasting = sample.phase === "코스팅";
        const ignitionPulse = Math.exp(-sample.time / 0.075);
        const burnoutPulse = Math.exp(-Math.pow((sample.time - burnoutTime) / 0.095, 2));
        const deploymentPulse = Math.exp(-Math.pow((sample.time - apogeeTime) / 0.16, 2));
        const phaseAccelGain = isPowered ? 2.4 : (isCoasting ? 0.72 : 1.15);
        const motorVibration = isPowered
          ? vibrationScale * (
            (Math.sin(sample.time * 2 * Math.PI * 23.0) * 0.72) +
            (Math.sin(sample.time * 2 * Math.PI * 41.0 + 0.8) * 0.34)
          )
          : 0;
        const bodyBuffet = isCoasting
          ? (
            (Math.sin(sample.time * 2 * Math.PI * 2.7 + 0.35) * vibrationScale * 0.28) +
            (Math.sin(sample.time * 2 * Math.PI * 6.2 + 1.1) * vibrationScale * 0.12)
          )
          : 0;
        const eventShock = (ignitionPulse * vibrationScale * 4.8) -
          (burnoutPulse * vibrationScale * 3.2) +
          (deploymentPulse * vibrationScale * 5.4);

        coloredAltitudeNoise = (coloredAltitudeNoise * 0.965) +
          (simulationPlusGaussian(random) * altitudeSigma * Math.sqrt(1 - (0.965 * 0.965)));
        barometerBias = simulationPlusClamp(
          (barometerBias * 0.9985) + (simulationPlusGaussian(random) * altitudeSigma * 0.017),
          -altitudeSigma * 2.8,
          altitudeSigma * 2.8
        );
        const pressureTransient =
          (ignitionPulse * altitudeSigma * 1.7) -
          (burnoutPulse * altitudeSigma * 1.2) +
          (deploymentPulse * altitudeSigma * 2.1);
        const pressureRipple = isPowered
          ? altitudeSigma * (
            (Math.sin(sample.time * 2 * Math.PI * 4.3 + 0.4) * 0.52) +
            (Math.sin(sample.time * 2 * Math.PI * 9.1 + 1.3) * 0.18)
          )
          : (isCoasting
            ? altitudeSigma * Math.sin(sample.time * 2 * Math.PI * 1.35 + 0.7) * 0.23
            : altitudeSigma * Math.sin(sample.time * 2 * Math.PI * 0.82 + 0.2) * 0.16);
        coloredAccelNoise = (coloredAccelNoise * 0.78) +
          (simulationPlusGaussian(random) * accelSigma * phaseAccelGain * Math.sqrt(1 - (0.78 * 0.78)));
        const observedAccelNoise = coloredAccelNoise + motorVibration + bodyBuffet + eventShock;
        coloredSpeedNoise = (coloredSpeedNoise * 0.935) +
          (observedAccelNoise * dt * 0.5) + (simulationPlusGaussian(random) * 0.16);
        sample.sensorAltitude = Math.max(
          0,
          Math.round((sample.altitude + coloredAltitudeNoise + barometerBias + pressureTransient + pressureRipple) * 10) / 10
        );
        sample.sensorSpeed = Math.max(0, sample.speed + coloredSpeedNoise);
        sample.sensorAccel = sample.accel + observedAccelNoise;
      });

      const monteCarloApogees = [];
      const monteCarloSpeeds = [];
      const monteCarloAccels = [];
      for(let run = 0; run < 400; run++){
        const separationError = simulationPlusGaussian(random) * altitudeSigma * 1.35;
        const separationSpeedError = simulationPlusGaussian(random) * Math.max(0.9, accelSigma * 0.3);
        const ignitionDelayError = simulationPlusGaussian(random) * 0.065;
        const motorSigma = 0.035 + Math.min(0.06, accelSigma / Math.max(1, targets.maxAccel) * 0.8);
        const motorScale = 1 + (simulationPlusGaussian(random) * motorSigma);
        const dragScale = 1 + (simulationPlusGaussian(random) * 0.085);
        const speedCandidate = Math.max(
          0,
          (targets.maxSpeed + separationSpeedError - (ignitionDelayError * 9.80665)) * motorScale
        );
        const coastEnergy = Math.max(0, targets.apogee - analysis.separationAltitudeM);
        const apogeeCandidate = analysis.separationAltitudeM + separationError +
          (coastEnergy * motorScale * motorScale / Math.max(0.62, dragScale)) +
          (separationSpeedError * 1.7) - (ignitionDelayError * Math.max(8, analysis.separationSpeedMps));
        monteCarloSpeeds.push(speedCandidate);
        monteCarloAccels.push(targets.maxAccel * motorScale + (simulationPlusGaussian(random) * accelSigma * 0.2));
        monteCarloApogees.push(apogeeCandidate);
      }
      const intervals = {
        apogee:[simulationPlusQuantile(monteCarloApogees, 0.1), simulationPlusQuantile(monteCarloApogees, 0.9)],
        maxSpeed:[simulationPlusQuantile(monteCarloSpeeds, 0.1), simulationPlusQuantile(monteCarloSpeeds, 0.9)],
        maxAccel:[simulationPlusQuantile(monteCarloAccels, 0.1), simulationPlusQuantile(monteCarloAccels, 0.9)]
      };
      return {
        targets,
        samples,
        maxAccel:targets.maxAccel,
        maxSpeed:Math.max.apply(null, samples.map((sample)=>sample.speed)),
        apogee:apogeeAltitude,
        burnDuration,
        burnoutTime,
        apogeeTime,
        landingTime:time,
        dragCoefficient,
        uncertainty,
        intervals,
        confidence:Math.round(analysis.quality * 100)
      };
    }

    function simulationPlusFormat(value, digits){
      return isFinite(Number(value)) ? Number(value).toFixed(digits == null ? 1 : digits) : "--";
    }

    function simulationPlusMetricMarkup(label, value, unit, detail, tone){
      return '<article class="simulation-plus-metric ' + (tone || "") + '">' +
        '<span>' + simulationPlusEscape(label) + '</span>' +
        '<strong>' + simulationPlusEscape(value) + '<small>' + simulationPlusEscape(unit) + '</small></strong>' +
        '<p>' + simulationPlusEscape(detail) + '</p>' +
      '</article>';
    }

    function simulationPlusRenderResult(){
      const analysis = simulationPlusState.analysis;
      const prediction = simulationPlusState.prediction;
      if(!analysis || !prediction) return;
      const metrics = document.getElementById("simulationPlusMetrics");
      if(metrics){
        const range = (values, digits, unit)=>
          "P10–P90 " + simulationPlusFormat(values[0], digits) + "–" + simulationPlusFormat(values[1], digits) + " " + unit;
        metrics.innerHTML =
          simulationPlusMetricMarkup("예측 최고 고도", simulationPlusFormat(prediction.apogee, 0), "m", range(prediction.intervals.apogee, 0, "m"), "is-primary") +
          simulationPlusMetricMarkup("예측 최대 속도", simulationPlusFormat(prediction.maxSpeed, 1), "m/s", range(prediction.intervals.maxSpeed, 1, "m/s"), "") +
          simulationPlusMetricMarkup("예측 최대 가속도", simulationPlusFormat(prediction.maxAccel, 2), "m/s²", range(prediction.intervals.maxAccel, 1, "m/s²"), "") +
          simulationPlusMetricMarkup("2단 정점 도달", simulationPlusFormat(prediction.apogeeTime, 2), "s", "단분리 이후", "");
      }
      const eventTable = document.getElementById("simulationPlusEventTable");
      if(eventTable){
        const events = [
          ["단분리 · 2단 점화", analysis.separationTPlusSec, analysis.separationAltitudeM],
          ["2단 연소 종료", analysis.separationTPlusSec + prediction.burnoutTime, prediction.samples.find((sample)=>sample.time >= prediction.burnoutTime)?.altitude],
          ["정점 · 사출", analysis.separationTPlusSec + prediction.apogeeTime, prediction.apogee],
          ["착지 예측", analysis.separationTPlusSec + prediction.landingTime, 0]
        ];
        eventTable.innerHTML = events.map((event, index)=>
          '<div><i>' + String(index + 1).padStart(2, "0") + '</i><strong>' + simulationPlusEscape(event[0]) +
          '</strong><span>T+' + simulationPlusFormat(event[1], 2) + ' s</span><b>' + simulationPlusFormat(event[2], 1) + ' m</b></div>'
        ).join("");
      }
      const assumptions = document.getElementById("simulationPlusAssumptionList");
      if(assumptions){
        assumptions.innerHTML =
          '<div><span>분리 고도</span><strong>' + simulationPlusFormat(analysis.separationAltitudeM, 1) + ' m</strong></div>' +
          '<div><span>분리 상승속도</span><strong>' + simulationPlusFormat(analysis.separationSpeedMps, 1) + ' m/s</strong></div>' +
          '<div><span>2단 연소시간</span><strong>' + simulationPlusFormat(prediction.burnDuration, 2) + ' s</strong></div>' +
          '<div><span>Static margin</span><strong>' + SIM_PLUS_REFERENCE.staticMargin.join(" / ") + '</strong></div>' +
          '<div><span>사출 후 종단속도</span><strong>' + simulationPlusFormat(SIM_PLUS_REFERENCE.deploymentTerminalSpeed, 1) + ' m/s</strong></div>' +
          '<div><span>기압고도 노이즈 σ</span><strong>' + simulationPlusFormat(analysis.altitudeNoiseSigmaM, 2) + ' m</strong></div>' +
          '<div><span>IMU 노이즈 σ</span><strong>' + simulationPlusFormat(analysis.accelNoiseSigmaMps2, 2) + ' m/s²</strong></div>' +
          '<div><span>샘플 지터 σ</span><strong>' + simulationPlusFormat(analysis.sampleJitterSigmaMs, 1) + ' ms</strong></div>' +
          '<div><span>입력 신뢰도</span><strong>' + prediction.confidence + '%</strong></div>';
      }
      const note = document.getElementById("simulationPlusConfidenceNote");
      if(note){
        note.textContent = "400회 Monte Carlo · 기압 바이어스/IMU 진동/점화·분리 충격/시간 지터 전파 · " +
          (analysis.nativeSeparation ? "저장된 단분리 이벤트 사용" : "기본 T+2.50 s 단분리 조건 사용");
      }
      const altitudeLegend = document.getElementById("simulationPlusAltitudeLegend");
      if(altitudeLegend) altitudeLegend.textContent = "SENSOR PREDICTION · P10–P90";
      simulationPlusScheduleCharts();
    }

    function simulationPlusNiceMax(value){
      if(!(value > 0)) return 1;
      const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
      const normalized = value / magnitude;
      const step = normalized <= 1 ? 1 : (normalized <= 2 ? 2 : (normalized <= 5 ? 5 : 10));
      return step * magnitude;
    }

    function simulationPlusCanvasContext(canvas){
      if(!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(320, Math.round(rect.width));
      const height = Math.max(220, Math.round(rect.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if(canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)){
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return {ctx, width, height};
    }

    function simulationPlusDownsample(samples, maxPoints){
      if(samples.length <= maxPoints) return samples;
      const step = (samples.length - 1) / (maxPoints - 1);
      const out = [];
      for(let index = 0; index < maxPoints; index++) out.push(samples[Math.round(index * step)]);
      return out;
    }

    function simulationPlusDrawAxes(context, options){
      const {ctx, width, height} = context;
      const pad = {left:52, right:options.rightAxis ? 52 : 22, top:24, bottom:38};
      const plotWidth = width - pad.left - pad.right;
      const plotHeight = height - pad.top - pad.bottom;
      ctx.clearRect(0, 0, width, height);
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 1;
      for(let row = 0; row <= 4; row++){
        const y = pad.top + (plotHeight * row / 4);
        ctx.strokeStyle = "rgba(132,139,149,.22)";
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
        const value = options.yMax * (1 - row / 4);
        ctx.fillStyle = "#7d838d";
        ctx.textAlign = "right";
        ctx.fillText(value.toFixed(options.yMax <= 20 ? 1 : 0), pad.left - 10, y);
        if(options.rightAxis){
          const rightValue = options.rightMax * (1 - row / 4);
          ctx.textAlign = "left";
          ctx.fillStyle = "#8a8f98";
          ctx.fillText(rightValue.toFixed(0), width - pad.right + 10, y);
        }
      }
      for(let column = 0; column <= 4; column++){
        const x = pad.left + (plotWidth * column / 4);
        ctx.strokeStyle = "rgba(132,139,149,.15)";
        ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, height - pad.bottom); ctx.stroke();
        ctx.fillStyle = "#7d838d";
        ctx.textAlign = column === 0 ? "left" : (column === 4 ? "right" : "center");
        ctx.fillText((options.xMax * column / 4).toFixed(0) + "s", x, height - 18);
      }
      return {pad, plotWidth, plotHeight};
    }

    function simulationPlusPlotLine(ctx, points, xFor, yFor, color, width){
      ctx.strokeStyle = color;
      ctx.lineWidth = width || 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      points.forEach((point, index)=>{
        const x = xFor(point);
        const y = yFor(point);
        if(index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    function simulationPlusDrawAltitudeChart(){
      const canvas = document.getElementById("simulationPlusAltitudeChart");
      const context = simulationPlusCanvasContext(canvas);
      const prediction = simulationPlusState.prediction;
      if(!context || !prediction) return;
      const points = simulationPlusDownsample(prediction.samples, 700);
      const xMax = Math.max(1, prediction.landingTime);
      const yMax = simulationPlusNiceMax(prediction.apogee * 1.08);
      const axes = simulationPlusDrawAxes(context, {xMax, yMax});
      const {ctx, width, height} = context;
      const xFor = (point)=>axes.pad.left + (point.time / xMax) * axes.plotWidth;
      const yForValue = (value)=>axes.pad.top + (1 - value / yMax) * axes.plotHeight;
      ctx.fillStyle = "rgba(45,205,122,.10)";
      ctx.beginPath();
      points.forEach((point, index)=>{
        const x = xFor(point); const y = yForValue(point.altitudeHigh);
        if(index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      for(let index = points.length - 1; index >= 0; index--){
        ctx.lineTo(xFor(points[index]), yForValue(points[index].altitudeLow));
      }
      ctx.closePath(); ctx.fill();
      simulationPlusPlotLine(ctx, points, xFor, (point)=>yForValue(point.altitude), "rgba(53,207,124,.42)", 1.25);
      simulationPlusPlotLine(ctx, points, xFor, (point)=>yForValue(point.sensorAltitude), "rgba(235,239,244,.94)", 1.45);
      const events = [
        {time:0, label:"SEP / IGN"},
        {time:prediction.burnoutTime, label:"BURNOUT"},
        {time:prediction.apogeeTime, label:"APOGEE"}
      ];
      events.forEach((event)=>{
        const x = axes.pad.left + (event.time / xMax) * axes.plotWidth;
        ctx.strokeStyle = "rgba(226,230,235,.28)";
        ctx.setLineDash([3,4]); ctx.beginPath(); ctx.moveTo(x, axes.pad.top); ctx.lineTo(x, height - axes.pad.bottom); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = "#aeb3bb"; ctx.font = "9px ui-monospace, monospace";
        ctx.textAlign = event.time > xMax * 0.7 ? "right" : "left";
        ctx.fillText(event.label, x + (event.time > xMax * 0.7 ? -6 : 6), axes.pad.top + 9);
      });
      ctx.fillStyle = "#35cf7c"; ctx.textAlign = "right"; ctx.font = "700 11px ui-monospace, monospace";
      ctx.fillText(simulationPlusFormat(prediction.apogee, 0) + " m", width - axes.pad.right, yForValue(prediction.apogee) - 10);
    }

    function simulationPlusDrawDynamicsChart(){
      const canvas = document.getElementById("simulationPlusDynamicsChart");
      const context = simulationPlusCanvasContext(canvas);
      const prediction = simulationPlusState.prediction;
      if(!context || !prediction) return;
      const points = simulationPlusDownsample(prediction.samples, 700);
      const xMax = Math.max(1, prediction.landingTime);
      const speedMax = simulationPlusNiceMax(prediction.maxSpeed * 1.08);
      const accelMax = simulationPlusNiceMax(prediction.maxAccel * 1.12);
      const axes = simulationPlusDrawAxes(context, {xMax, yMax:speedMax, rightAxis:true, rightMax:accelMax});
      const {ctx, width} = context;
      const xFor = (point)=>axes.pad.left + (point.time / xMax) * axes.plotWidth;
      const speedY = (point)=>axes.pad.top + (1 - Math.max(0, point.speed) / speedMax) * axes.plotHeight;
      const accelY = (point)=>axes.pad.top + (1 - Math.max(0, point.accel) / accelMax) * axes.plotHeight;
      simulationPlusPlotLine(ctx, points, xFor, speedY, "rgba(232,235,239,.34)", 1.1);
      simulationPlusPlotLine(ctx, points, xFor, accelY, "rgba(245,166,35,.32)", 1.05);
      simulationPlusPlotLine(
        ctx, points, xFor,
        (point)=>axes.pad.top + (1 - Math.max(0, point.sensorSpeed) / speedMax) * axes.plotHeight,
        "rgba(232,235,239,.96)", 1.45
      );
      simulationPlusPlotLine(
        ctx, points, xFor,
        (point)=>axes.pad.top + (1 - Math.max(0, point.sensorAccel) / accelMax) * axes.plotHeight,
        "rgba(245,166,35,.92)", 1.25
      );
      ctx.font = "700 10px ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.fillStyle = "#e8ebef"; ctx.fillText("SPEED", width - axes.pad.right - 72, 13);
      ctx.fillStyle = "#f5a623"; ctx.fillText("ACCEL", width - axes.pad.right, 13);
    }

    function simulationPlusScheduleCharts(){
      if(simulationPlusState.renderRaf) cancelAnimationFrame(simulationPlusState.renderRaf);
      simulationPlusState.renderRaf = requestAnimationFrame(()=>{
        simulationPlusState.renderRaf = 0;
        simulationPlusDrawAltitudeChart();
        simulationPlusDrawDynamicsChart();
      });
    }

    function simulationPlusSetVisible(visible){
      const overlay = document.getElementById("simulationPlusOverlay");
      if(!overlay) return;
      const show = !!visible;
      overlay.classList.toggle("hidden", !show);
      overlay.style.display = show ? "flex" : "none";
      overlay.setAttribute("aria-hidden", show ? "false" : "true");
      document.documentElement.classList.toggle("simulation-plus-open", show);
      if(show && simulationPlusState.prediction) simulationPlusScheduleCharts();
    }

    function simulationPlusSetLoading(message){
      const status = document.getElementById("simulationPlusStatus");
      if(status){
        status.textContent = message || "분석 중입니다.";
        status.classList.add("is-loading");
      }
    }

    async function simulationPlusLoadFile(file){
      if(!file) return;
      if(!/\.bin$/i.test(String(file.name || ""))){
        showToast("Simulation Plus는 1단 비행 BIN 파일을 사용합니다.", "notice", {key:"sim-plus-bin-only"});
        return;
      }
      simulationPlusState.file = file;
      document.getElementById("simulationPlusInputPanel")?.classList.add("hidden");
      document.getElementById("simulationPlusWorkspace")?.classList.remove("hidden");
      const fileName = document.getElementById("simulationPlusFileName");
      if(fileName) fileName.textContent = file.name;
      const sourceMeta = document.getElementById("simulationPlusSourceMeta");
      if(sourceMeta) sourceMeta.textContent = (Number(file.size) / (1024 * 1024)).toFixed(2) + " MB · BIN 자동 분석";
      simulationPlusSetLoading("1단 비행 기록에서 T+와 단분리 조건을 추출하고 있습니다.");
      try{
        const parsed = await parseReplayFileAuto(file);
        const frames = Array.isArray(parsed && parsed.samples) ? parsed.samples : [];
        if(typeof applyPressureRobustAltitudeToReplayFrames === "function"){
          applyPressureRobustAltitudeToReplayFrames(frames);
        }
        const analysis = simulationPlusAnalyzeStage1(frames);
        const prediction = simulationPlusBuildPrediction(analysis);
        simulationPlusState.frames = frames;
        simulationPlusState.analysis = analysis;
        simulationPlusState.prediction = prediction;
        const status = document.getElementById("simulationPlusStatus");
        if(status){
          status.classList.remove("is-loading");
          status.textContent = "2단 비행 예측 완료 · 입력 " + analysis.sampleCount.toLocaleString("ko-KR") +
            " samples · 신뢰도 " + prediction.confidence + "%";
        }
        simulationPlusRenderResult();
      }catch(error){
        simulationPlusState.frames = [];
        simulationPlusState.analysis = null;
        simulationPlusState.prediction = null;
        const reason = error && error.message ? error.message : String(error || "unknown");
        const status = document.getElementById("simulationPlusStatus");
        if(status){
          status.classList.remove("is-loading");
          status.textContent = "분석 실패 · " + reason;
        }
        showToast("Simulation Plus 분석 실패: " + reason, "error", {key:"sim-plus-error"});
      }
    }

    function simulationPlusExportCsv(){
      const prediction = simulationPlusState.prediction;
      const analysis = simulationPlusState.analysis;
      if(!prediction || !analysis) return;
      const rows = [
        ["STAGE2_ELAPSED_S","MISSION_TPLUS_S","PHASE","ALTITUDE_TRUE_M","ALTITUDE_SENSOR_M","ALTITUDE_LOW_M","ALTITUDE_HIGH_M","SPEED_TRUE_MPS","SPEED_SENSOR_MPS","ACCEL_TRUE_MPS2","ACCEL_SENSOR_MPS2"],
        ...prediction.samples.filter((_sample, index)=>index % 5 === 0).map((sample)=>[
          sample.time.toFixed(2), sample.tPlus.toFixed(2), sample.phase,
          sample.altitude.toFixed(3), sample.sensorAltitude.toFixed(3), sample.altitudeLow.toFixed(3), sample.altitudeHigh.toFixed(3),
          sample.speed.toFixed(3), sample.sensorSpeed.toFixed(3), sample.accel.toFixed(3), sample.sensorAccel.toFixed(3)
        ])
      ];
      const csv = rows.map((row)=>row.map((cell)=>{
        const text = String(cell == null ? "" : cell);
        return /[",\n]/.test(text) ? ('"' + text.replace(/"/g, '""') + '"') : text;
      }).join(",")).join("\r\n");
      const blob = new Blob(["\uFEFF", csv], {type:"text/csv;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ALTIS_SIMULATION_PLUS_STAGE2_" + new Date().toISOString().replace(/[:.]/g, "-") + ".csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1000);
      showToast("2단 예측 데이터를 CSV로 저장했습니다.", "success", {key:"sim-plus-export"});
    }

    function initSimulationPlus(){
      const openBtn = document.getElementById("welcomeSimulationPlusBtn");
      const closeBtn = document.getElementById("simulationPlusCloseBtn");
      const overlay = document.getElementById("simulationPlusOverlay");
      const input = document.getElementById("simulationPlusFileInput");
      const dropzone = document.getElementById("simulationPlusDropzone");
      const changeFile = document.getElementById("simulationPlusChangeFileBtn");
      const exportBtn = document.getElementById("simulationPlusExportBtn");
      if(!overlay || !input || !dropzone) return;
      const chooseFile = ()=>{
        input.value = "";
        input.click();
      };
      openBtn?.addEventListener("click",()=>simulationPlusSetVisible(true));
      closeBtn?.addEventListener("click",()=>simulationPlusSetVisible(false));
      overlay.addEventListener("click",(event)=>{
        if(event.target === overlay) simulationPlusSetVisible(false);
      });
      dropzone.addEventListener("click",chooseFile);
      changeFile?.addEventListener("click",chooseFile);
      input.addEventListener("change",()=>{
        const file = input.files && input.files[0];
        if(file) simulationPlusLoadFile(file);
      });
      ["dragenter","dragover"].forEach((type)=>dropzone.addEventListener(type,(event)=>{
        event.preventDefault();
        dropzone.classList.add("is-dragover");
      }));
      ["dragleave","drop"].forEach((type)=>dropzone.addEventListener(type,()=>{
        dropzone.classList.remove("is-dragover");
      }));
      dropzone.addEventListener("drop",(event)=>{
        event.preventDefault();
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if(file) simulationPlusLoadFile(file);
      });
      exportBtn?.addEventListener("click",simulationPlusExportCsv);
      document.addEventListener("keydown",(event)=>{
        if(event.key === "Escape" && !overlay.classList.contains("hidden")) simulationPlusSetVisible(false);
      });
      if(typeof ResizeObserver !== "undefined"){
        simulationPlusState.resizeObserver = new ResizeObserver(()=>{
          if(!overlay.classList.contains("hidden")) simulationPlusScheduleCharts();
        });
        const workspace = document.getElementById("simulationPlusWorkspace");
        if(workspace) simulationPlusState.resizeObserver.observe(workspace);
      }
    }

    if(document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded", initSimulationPlus, {once:true});
    }else{
      initSimulationPlus();
    }
