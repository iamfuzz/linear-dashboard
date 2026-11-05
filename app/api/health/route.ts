// Liveness check used by the Mac app launcher to see whether its server is already running.
// Returns no data from Linear and never touches the API key.
export function GET() {
  return Response.json({ app: "LinearDashboard" });
}
