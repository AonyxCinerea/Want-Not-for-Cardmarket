<p align="center"><img src="icons/icon-128.png" width="96" alt=""></p>

<h1 align="center">Want-Not for Cardmarket</h1>

<p align="center">
Keep the printings you don't want out of your Cardmarket orders.<br>
Exclude expansions like <b>Marvel</b> or <b>Teenage Mutant Ninja Turtles</b> from <i>every</i> card on a wants list — in one click.<br>
And let the optimizer find a cheaper order than the Shopping Wizard, <i>including shipping</i>.
</p>

<p align="center"><img src="docs/screenshots/demo.gif" width="720" alt="Analyze and apply on a Cardmarket wants list"></p>

---

## Why?

Cardmarket lets you pick the expansions you *want* for each card — but not the ones you *don't*.
If you'd rather not get Universes Beyond printings (or any other set) in a deck with a classic look,
you'd have to edit every single card by hand. Want-Not does that for you.

## Install

| Browser | |
|---|---|
| Chrome, Edge, Brave, Opera | [**Chrome Web Store**](https://chromewebstore.google.com/detail/want-not-for-cardmarket/cjckegenllnjjekaconmmanejaflhkdh) |
| Firefox | [**Firefox Add-ons**](https://addons.mozilla.org/firefox/addon/want-not-for-cardmarket/) |
| Manual install | [Download the latest release](../../releases/latest) — see [manual installation](#manual-installation) |

## How to use

1. **Open one of your wants lists** on cardmarket.com. A small Want-Not panel appears below the title.
2. **Click _Analyze_.** Want-Not checks each card and shows what it would change. Nothing is changed yet.
3. **Click _Apply_** to update all cards, or _Apply_ next to a single card to update just that one.

That's it — the Shopping Wizard now ignores the excluded expansions.

<p align="center"><img src="docs/screenshots/panel.png" width="720" alt="Want-Not panel with analysis results"></p>

### Choose what to exclude

Click the Want-Not icon in your browser toolbar (or *Settings* in the panel):

- **Presets** — one click per Universes Beyond franchise. Marvel and TMNT are on by default.
- **Custom patterns** — any part of an expansion name, e.g. `Secret Lair`.
  Power users can use a regular expression: `re:^Commander:`.
- **Expansion list** — tick individual expansions. The list fills up as you analyze your wants lists.

<p align="center"><img src="docs/screenshots/settings.png" width="420" alt="Want-Not settings"></p>

### Reset and undo

**Reset all to Any** sets every card on the list back to "any expansion". Your previous selections are
backed up, and **Undo reset** restores them.

## Optimizer: cheapest order including shipping

The Shopping Wizard either finds the cheapest card prices or the fewest shipments. Want-Not finds the
cheapest **total**: sometimes a card that costs a little more is the better buy, because it comes from a
seller you're ordering from anyway and saves a whole shipment.

1. Run the **Shopping Wizard** on a wants list as usual.
2. On the results page, click **Optimize incl. shipping**. Want-Not loads what the Wizard's sellers (and
   the sellers with the most cards from your list) have, plus Cardmarket's shipping prices. This takes a
   few minutes for big lists.
3. Compare: the plan shows the total, the saving against the Wizard and the cards per seller.
4. Click **Add plan to cart**. Afterwards Want-Not shows the actual total from your shopping cart.

<p align="center"><img src="docs/screenshots/optimizer.png" width="720" alt="Optimizer plan compared with the Shopping Wizard"></p>

Before the first use, open the settings once: choose where you live under **Ship to** and click
**Allow shipping prices**. The optimizer reads Cardmarket's public shipping price table for that.

Your wants list's filters (printings, language, condition, foil) are respected, so it works together
with the excluded expansions above. Shipping is estimated from Cardmarket's price table; the shopping
cart always shows the final amount, and nothing is ordered until you check out yourself.

## FAQ

**What exactly happens to a card?**

| Card on your list | What Want-Not does |
|---|---|
| Set to "Any", no excluded printing exists | Nothing — it stays "Any", so future reprints are still included |
| Set to "Any", some printings excluded | Selects all other printings |
| Specific expansions selected | Removes only the excluded ones (can be turned off in the settings) |
| Every printing is excluded | Nothing — the card is flagged so you can decide |

**Why are only 20 versions selected for some cards?**
Cardmarket allows at most 20 expansions per wants-list card. For cards with more printings
(Sol Ring, Counterspell, …) Want-Not keeps the 20 cheapest, based on Cardmarket's trend price.
Hover over the result to see which versions were left out.

**Can I exclude single Secret Lair drops?**
No — Cardmarket lists all Secret Lair cards under one expansion ("Secret Lair Drop Series"), so they
can only be excluded as a whole.

**Is it safe to use?**
Want-Not only does what you could do by hand: it opens pages and saves wants or adds cards to your cart,
one request at a time with a pause in between, in your own logged-in session. It never places orders and
never touches your account settings. If Cardmarket asks it to slow down, it waits, and it stops after
repeated refusals. Still, it is an unofficial tool that automates actions on Cardmarket. Use it at your
own risk, and don't run the optimizer on many lists in a row.

**How much does the optimizer save?**
It depends on the list. In our tests it was 7–22% cheaper than the Shopping Wizard's "cheapest" result,
almost entirely through fewer shipments. If the Wizard's result is already the cheapest, it says so.

**Why does the optimizer only look at some sellers?**
Loading every seller's offers would take hours and many thousands of requests. Want-Not looks at the
sellers the Wizard picked and the sellers with the most cards from your list. For very large lists,
Cardmarket sometimes can't compute the second list; the optimizer then works with the Wizard's sellers.

**What data does it collect?**
None. See the [privacy policy](PRIVACY.md).

## Manual installation

Only needed to try a version that isn't in the stores yet. Store installs update automatically.

**Chrome, Edge, Brave**
1. Download `want-not-<version>.zip` from the [latest release](../../releases/latest) and unzip it.
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and select the unzipped folder.

Manually installed extensions don't update automatically — repeat these steps for a new version.

**Firefox**
Firefox only installs signed add-ons permanently, so use [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/want-not-for-cardmarket/).
To try an unreleased version, load it temporarily (until the next restart): open `about:debugging#/runtime/this-firefox`,
click **Load Temporary Add-on** and pick `manifest.json` from the unzipped folder.

## Development

No build step — the folder is the extension.

```sh
git clone https://github.com/AonyxCinerea/Want-Not-for-Cardmarket.git
cd Want-Not-for-Cardmarket
npm install       # test dependencies only
npm test          # unit tests against saved, anonymised Cardmarket pages
./scripts/build.sh  # creates dist/want-not-<version>.zip
```

| Path | |
|---|---|
| `src/content.js` | the panel on the wants list (analyze, apply, reset) |
| `src/parse.js` | reads Cardmarket's wants list and edit pages |
| `src/selection.js` | decides which expansions to keep |
| `src/blocklist.js` | presets and pattern matching |
| `src/background.js` | Scryfall price lookup |
| `options/` | settings page / toolbar popup |

**Releasing:** bump `version` in `manifest.json` (and `package.json`), commit, then push a matching tag:

```sh
git tag v0.3.1 && git push origin v0.3.1
```

GitHub Actions runs the tests, checks that the tag matches the manifest version, builds the zip and
publishes it as a [release](../../releases).

Contributions and bug reports are welcome. If Cardmarket changes its pages, please include the
page URL and what went wrong in the issue.

## License

[MIT](LICENSE). Not affiliated with or endorsed by Cardmarket. Price data from [Scryfall](https://scryfall.com).
Magic: The Gathering is a trademark of Wizards of the Coast.
