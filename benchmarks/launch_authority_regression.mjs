import assert from "node:assert/strict";

const ARM_CONFIRM_MS = 1000;

function runLaunchAuthorityScenario({armAt = null, thrustAt = null, endAt = 2000}){
  const runtime = {
    state:"STANDBY",
    tplusMs:null,
    authority:false,
    deploymentAllowed:false,
    validationFault:false
  };

  for(let nowMs = 0; nowMs <= endAt; nowMs += 5){
    if(runtime.state === "STANDBY"){
      if(armAt != null && nowMs >= armAt &&
         (thrustAt == null || armAt <= thrustAt || nowMs < thrustAt)){
        runtime.state = "TPLUS";
        runtime.tplusMs = armAt;
        runtime.authority = true;
      }else if(thrustAt != null && nowMs >= thrustAt){
        runtime.state = "TPLUS_PROVISIONAL";
        runtime.tplusMs = thrustAt;
      }
    }

    if(runtime.state === "TPLUS_PROVISIONAL"){
      if(armAt != null && nowMs >= armAt && armAt <= thrustAt + ARM_CONFIRM_MS){
        runtime.state = "TPLUS";
        runtime.authority = true;
      }else if(nowMs >= thrustAt + ARM_CONFIRM_MS){
        runtime.state = "STANDBY";
        runtime.tplusMs = null;
        runtime.validationFault = true;
      }
    }

    runtime.deploymentAllowed = runtime.state === "TPLUS" && runtime.authority;
  }
  return runtime;
}

const armFirst = runLaunchAuthorityScenario({armAt:120, thrustAt:260});
assert.equal(armFirst.tplusMs, 120);
assert.equal(armFirst.authority, true);
assert.equal(armFirst.deploymentAllowed, true);

const thrustFirst = runLaunchAuthorityScenario({thrustAt:100, armAt:650});
assert.equal(thrustFirst.tplusMs, 100);
assert.equal(thrustFirst.authority, true);
assert.equal(thrustFirst.validationFault, false);

const thrustOnly = runLaunchAuthorityScenario({thrustAt:100});
assert.equal(thrustOnly.state, "STANDBY");
assert.equal(thrustOnly.tplusMs, null);
assert.equal(thrustOnly.deploymentAllowed, false);
assert.equal(thrustOnly.validationFault, true);

console.table([
  {scenario:"ARM first", tplusMs:armFirst.tplusMs, authority:armFirst.authority, result:"PASS"},
  {scenario:"thrust first + ARM", tplusMs:thrustFirst.tplusMs, authority:thrustFirst.authority, result:"PASS"},
  {scenario:"thrust only", tplusMs:"discarded", authority:thrustOnly.authority, result:"PASS"}
]);
