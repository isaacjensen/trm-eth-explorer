'use strict';

// Liveness: is the process up? Cheap, no dependencies.
function healthz(req, res) {
  return res.status(200).json({ status: 'ok' });
}

// Readiness: can we serve traffic? We intentionally do NOT call Infura here.
// Kubelet probes /readyz every few seconds; hitting upstream on each probe would
// burn the shared Infura quota and make readiness flap on transient blips. Config
// is validated at startup, so if the process is up it is ready to route requests.
// A cached, deeper dependency check is noted as a follow-up in the README.
function readyz(req, res) {
  return res.status(200).json({ status: 'ready' });
}

module.exports = { healthz, readyz };
