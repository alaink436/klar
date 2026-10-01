// Apple App Site Association for getklar.org.
//
// iOS fetches this (through Apple's CDN) to decide which https links open an
// installed app instead of Safari. Served from a route handler so the response
// is JSON with the right content type and no extension.
//
// Focus Crew (com.podifyapp.app): everything under /focuscrew opens the app,
// except the legal pages, which must stay readable in the browser.

const FOCUS_CREW = "SQ7SA4F47Q.com.podifyapp.app";

export const dynamic = "force-static";

export function GET() {
  return Response.json({
    applinks: {
      details: [
        {
          appIDs: [FOCUS_CREW],
          components: [
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
