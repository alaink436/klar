// @sneas/telephone registers device-frame custom elements at import time.
// JSX needs to know they exist; the frames take no props beyond `mode`.
import type * as React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "iphone-16-max": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { mode?: "light" | "dark" },
        HTMLElement
      >;
    }
  }
}
