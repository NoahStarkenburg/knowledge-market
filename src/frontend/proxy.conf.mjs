// Dev server proxy: forwards /api to the API so the browser only ever talks to one origin.
//
// Without it the app is on :4200 and the API on :5116, two origins, which would mean CORS,
// preflights and SameSite=None cookies locally and nowhere else. nginx does this job in
// containers and Front Door in Azure, so there is one shape to reason about everywhere.
export default {
  '/api': {
    target: 'http://localhost:5116',
    // Send the target's Host header, as a real reverse proxy does, so nothing downstream that
    // builds absolute URLs or routes by host is told a hostname that is not its own.
    changeOrigin: true,
  },
};
