# Store listings

Copy-paste texts for the Chrome Web Store and Firefox Add-ons (AMO).
Graphics: `docs/store/screenshot-1..4.png` (1280×800), `docs/store/promo-small-440x280.png`, `icons/icon-128.png`.

---

## Shared

**Name:** Want-Not for Cardmarket

**Summary** (Chrome max. 132 characters, AMO max. 250):

> Exclude unwanted expansions like Marvel or TMNT printings from every card on your Cardmarket wants lists, in one click.

**Description:**

```
Cardmarket lets you pick the expansions you WANT for each card on a wants list, but not the ones you DON'T. If you'd rather not get certain printings in your orders, for example Universes Beyond cards from Marvel or Teenage Mutant Ninja Turtles in a deck with a classic Magic look, you'd have to edit every card by hand.

Want-Not does it for you.

HOW IT WORKS
1. Open one of your wants lists on cardmarket.com. A small Want-Not panel appears.
2. Click "Analyze". Want-Not checks each card and shows what it would change. Nothing is changed yet.
3. Click "Apply" to update all cards, or "Apply" next to a single card.
The Shopping Wizard then only considers the expansions you want.

FEATURES
• Presets for Universes Beyond franchises (Marvel and TMNT are on by default)
• Custom patterns, including regular expressions for power users
• Exclude individual expansions from a searchable list
• Respects Cardmarket's limit of 20 expansions per card by keeping the 20 cheapest printings
• "Reset all to Any" with one-click undo
• Cards whose every printing is excluded are flagged, never emptied

PRIVACY
No tracking and no data collection. Settings stay in your browser. Want-Not only talks to cardmarket.com, in your own logged-in session, and to the public Scryfall API for price lookups.

Open source (MIT): https://github.com/AonyxCinerea/Want-Not-for-Cardmarket

Not affiliated with or endorsed by Cardmarket. Magic: The Gathering is a trademark of Wizards of the Coast.
```

**Links**
- Homepage / source: https://github.com/AonyxCinerea/Want-Not-for-Cardmarket
- Support: https://github.com/AonyxCinerea/Want-Not-for-Cardmarket/issues
- Privacy policy: https://github.com/AonyxCinerea/Want-Not-for-Cardmarket/blob/main/PRIVACY.md

---

## Chrome Web Store

**Store listing tab**
- Category: Shopping
- Language: English
- Store icon: `icons/icon-128.png`
- Screenshots: `docs/store/screenshot-1.png` … `screenshot-4.png`
- Small promo tile: `docs/store/promo-small-440x280.png`

**Privacy tab**

Single purpose description:
> Lets users exclude expansions they don't want from all cards on their Cardmarket wants lists, by updating each wants-list entry's expansion selection.

Permission justifications:
- `storage`: Stores the user's settings (excluded expansions and patterns), the latest analysis result per wants list, and a backup used to undo a reset. All data stays in the browser.
- Host permission `https://www.cardmarket.com/*`: Adds the Want-Not panel to the user's wants list pages, reads each wants-list entry's edit page and saves the new expansion selection when the user clicks Apply, Reset or Undo.
- Host permission `https://api.scryfall.com/*`: Looks up public card prices for cards with more than 20 printings, to keep the 20 cheapest within Cardmarket's limit. Only Cardmarket product IDs are sent.

Remote code: **No, I am not using remote code.**

Data usage: tick **none** of the data types. Tick all three certifications (no selling of data, no unrelated use, no creditworthiness use).

**Distribution tab:** Public, all regions.

---

## Firefox Add-ons (AMO)

- Upload: `want-not-<version>.zip` from the GitHub release. "Do you need to submit source code?" → **No** (the code isn't minified or bundled).
- Categories: Shopping
- Tags: cardmarket, magic the gathering, mtg, shopping
- License: MIT
- Privacy policy: paste the contents of `PRIVACY.md`
- Screenshots: `docs/store/screenshot-1.png` … `screenshot-4.png`

**Notes to reviewer:**
```
The extension only runs on Cardmarket wants list pages (https://www.cardmarket.com/<lang>/Magic/Wants/<id>), which require a free Cardmarket account. It reads the wants list and each entry's edit page with fetch() and saves changes by submitting the same edit form a user would submit manually, only after the user clicks Apply, Reset or Undo. Requests are sequential with a short delay. api.scryfall.com is used only for public price data. No minification or build step; the uploaded files are the source (https://github.com/AonyxCinerea/Want-Not-for-Cardmarket).
```
