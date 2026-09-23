# The design system

Three layers, and the rule that holds them together: **a component may only name a
semantic token.** Not a hex value, not a palette step, not a Sass colour function.

```
_palette.scss   raw colour        generated, never edited by hand
_tokens.scss    what colour is for   the only file that knows about themes
_type.scss      type, space, motion  no colour at all
custom.scss     Bootstrap + components  names tokens, nothing else
```

That rule is the entire reason the dark theme is 90 lines in one file instead of a
second copy of every screen.

## Colour

`scripts/palette.mjs` generates the scales in **OKLCH** and writes them out as hex.
OKLCH because a step in its lightness axis looks like the same step to the eye —
drag an HSL brightness slider down a blue and it turns muddy and violet on the way.
Hex on the way out because every browser reads it, and because the tests can then
measure exactly what ships.

Every scale climbs the same lightness ladder, so a `600` in one hue carries the same
weight as a `600` in another. Changing a hue is a one-line edit in that script and a
`npm run palette`, not a re-audit of every screen.

**The primary action is ink, not a colour.** The rule is *maximum contrast against
the canvas*, which is why the button inverts between themes — dark on light, light
on dark. This is the decision with the longest reach: it leaves the entire hue wheel
free to carry meaning. When the DRIP quadrants arrive, and estimated savings have to
be impossible to confuse with verified ones, those hues are not already spent on
brand.

The accent is one blue, rationed to links, focus and the selected thing. Colour
anywhere else in the interface is carrying information.

## Contrast

Nothing here was chosen by eye. `contrast.test.js` compiles `_tokens.scss` and
measures **every** foreground against **every** background it can appear on, in both
themes, against WCAG AA — 4.5:1 for text, 3:1 for a control edge or focus ring.

That still is not enough. It reads token *values* and cannot know which CSS rule
finally wins on a real element. Both of the real bugs found so far lived in that
gap, so `e2e/accessibility.spec.js` asks a browser what it computed:

- a focus ring Bootstrap was overriding at zero width, invisible on every button
- a Bootstrap default grey at 4.37:1 that was never overridden

## Type

Inter for the interface, Source Serif 4 for display, both variable, both
**self-hosted** from `@fontsource-variable` — no font-CDN request on the critical
path and no third party watching people use the product.

Font family names are single Sass strings with the quotes *inside* them. That looks
fussy and is load-bearing: interpolating a Sass list strips the quotes, and
`Source Serif 4 Variable` unquoted is not a valid CSS value — an identifier cannot
begin with a digit — so the browser silently discards the declaration. It shipped
once. `stylesheet.test.js` now fails if the quotes go missing.

Figures use tabular numerals everywhere. In a product about hours and money, digits
that do not line up in a column are not a cosmetic problem.

## Themes

Dark is a first-class theme built from the same tokens, not an inversion bolted on
later — which is the version of this everyone regrets. Three states:

| `data-theme` | behaviour |
| --- | --- |
| absent | follows the operating system |
| `light` | explicit, overrides the system |
| `dark` | explicit, overrides the system |

The `:root:not([data-theme='light'])` guard on the media query is what lets an
explicit light choice beat a dark system setting. Without it the toggle looks broken
to exactly the people who most want it.

`initTheme()` runs in `main.jsx` before React renders, so the page never paints in
the wrong theme and then corrects itself.

## Changing something

- **a hue** → edit `scripts/palette.mjs`, run `npm run palette`, run `npm test`
- **a semantic meaning** → edit `_tokens.scss`, in both the `light` and `dark` mixins
- **a component** → `custom.scss`, naming tokens only

`npm test` covers the values; `npm run e2e` covers what the browser does with them.
