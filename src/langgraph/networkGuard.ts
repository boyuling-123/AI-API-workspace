import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import dgram from "node:dgram";
import { syncBuiltinESMExports } from "node:module";

/** Child process only. Defense against accidental egress, not a hostile-code sandbox. */
export function denyExperimentNetwork() {
  let attempts = 0;
  const blocked = (): never => { attempts += 1; throw new Error("EXPERIMENT_NETWORK_DISABLED"); };
  globalThis.fetch = blocked;
  http.request = blocked;
  http.get = blocked;
  https.request = blocked;
  https.get = blocked;
  net.Socket.prototype.connect = blocked;
  tls.connect = blocked;
  dgram.createSocket = blocked;
  syncBuiltinESMExports();
  return () => attempts;
}

export function probeNetworkGuard(): number {
  const getAttempts = denyExperimentNetwork();
  for (const attempt of [
    () => fetch("https://example.invalid"),
    () => http.get("http://example.invalid"),
    () => https.request("https://example.invalid"),
    () => new net.Socket().connect(443, "example.invalid"),
    () => tls.connect(443, "example.invalid"),
    () => dgram.createSocket("udp4"),
  ]) {
    try { attempt(); throw new Error("GUARD_NOT_ACTIVE"); }
    catch (error) { if (!(error instanceof Error) || error.message !== "EXPERIMENT_NETWORK_DISABLED") throw error; }
  }
  return getAttempts();
}
