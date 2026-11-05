// Initiative whose projects (and their issues) the dashboard tracks.
// Defaults to "AMER Partner SE Programs" (I-503). Override with INITIATIVE_ID in .env.local.
export const INITIATIVE_ID =
  process.env.INITIATIVE_ID || "b8fdca15-b6d3-4304-b937-cbf50cee4829";

export const INITIATIVE_NAME = "AMER Partner SE Programs";

// Server-side cache lifetime for Linear data.
export const CACHE_TTL_MS = 60_000;

export const LINEAR_API_URL = "https://api.linear.app/graphql";
