// Apple App Site Association for getklar.org.
//
// iOS fetches this (through Apple's CDN) to decide which https links open an
// installed app instead of Safari. Served from a route handler so the response
// is JSON with the right content type and no extension.
//
// Learnbound (com.podifyapp.app, called Focus Crew until 8 October 2026):
// everything under /learnbound opens the app, and so does the old /focuscrew
// prefix, except the legal pages, which must stay readable in the browser.

const LEARNBOUND = "SQ7SA4F47Q.com.podifyapp.app";

export const dynamic = "force-static";

export function GET() {
  return Response.json({
    applinks: {
      details: [
        {
          appIDs: [LEARNBOUND],
          components: [
            { "/": "/learnbound/privacy*", exclude: true },
            { "/": "/learnbound/terms*", exclude: true },
            { "/": "/learnbound" },
            { "/": "/learnbound/*" },
            { "/": "/focuscrew/privacy*", exclude: true },
            { "/": "/focuscrew/terms*", exclude: true },
            { "/": "/focuscrew" },
            { "/": "/focuscrew/*" },
          ],
        },
      ],
    },
  });
}
