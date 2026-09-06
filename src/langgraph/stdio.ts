import { denyExperimentNetwork, probeNetworkGuard } from "./networkGuard";

async function main() {
  if (process.argv[2] === "--verify-network-guard") {
    process.stdout.write(JSON.stringify({ blocked: probeNetworkGuard() }));
    return;
  }
  if (process.argv.length !== 2) throw new Error("UNSUPPORTED_ARGUMENT");
  const attempts = denyExperimentNetwork();
  // Load the framework only after isolation is installed, never in the Next/browser process.
  const { runLangGraphMock } = await import("./runLangGraphMock.js");
  const experiment = await runLangGraphMock();
  if (attempts() !== 0) throw new Error("UNEXPECTED_NETWORK_ATTEMPT");
  process.stdout.write(JSON.stringify(experiment));
}

main().catch(() => { process.exitCode = 1; });
