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

<p align="center"><img src="docs/screenshots/optimizer.png" width="720" alt="Optimizer plan compared with the Shopping Wizard"></p>

### Once: settings

Open the Want-Not settings (toolbar icon), choose the country you live in under **Ship to** and click
**Allow shipping prices**. The optimizer reads Cardmarket's public shipping price table for that, and
without it the **Optimize** button only shows a reminder.

### Every order

1. Open your wants list. Want-Not remembers which list you're working on.
2. Run the **Shopping Wizard** with **Reduce Price**. For bigger lists, run it a second time with
   **Reduce Shipments** (see the tips below).
3. On a results page, click **Optimize incl. shipping**. Want-Not loads what the candidate sellers have
   from your list plus the shipping prices. Small lists take about a minute, big ones several minutes.
4. Check the plan: total and saving at the top, one row per seller. Click "N cards" to see exactly which
   printing, condition and language you'd get.
5. Click **Add plan to cart**. Want-Not then reads your cart and shows the real total next to its estimate.
6. Check out as usual. Nothing is ordered before that.

### Getting the best result

The optimizer can only pick from the sellers it looks at. Those are the sellers from your Wizard runs on
this list (the current one and earlier ones from the last 7 days) and Cardmarket's "Sellers with the Most
Cards". More good candidates usually means a cheaper plan.

- **Run the Wizard twice.** "Reduce Price" brings in many cheap sellers, "Reduce Shipments" brings in the
  big ones that have most of your list. Optimize from either results page and the optimizer uses both.
  This matters most for lists with more than about 50 cards, because there Cardmarket often can't
  calculate "Sellers with the Most Cards".
- **Don't narrow the Wizard more than you need to.** Its seller location, seller type and reputation
  filters decide which sellers the optimizer gets to see. If you only allow sellers from your own country,
  for example, the optimizer can't find a cheaper one abroad.
- **Keep your wants list's filters honest.** The optimizer respects every entry's printings, language,
  minimum condition and foil setting. Each restriction you don't really need (say, English only for a
  card you'd happily take in German) removes offers and can make the plan more expensive. Excluded
  expansions from the first part of Want-Not are respected the same way.
- **Optimize right after the Wizard.** Offers sell out. The optimizer loads fresh offers itself, but the
  older a Wizard run is, the more of its sellers have sold the cards in the meantime.
- **Start with an empty cart.** Items already in the cart stay there. Want-Not warns you about them, but
  the "real total" it shows afterwards then includes those items too.
- **Leave the shipping method as it is.** The plan assumes the cheapest allowed method for each seller.
  Above 25 € Cardmarket requires tracked shipping, and some sellers only ship tracked; both are already
  part of the plan.
- **Give Cardmarket a break.** Every optimization loads dozens of pages, and the Wizard itself has a daily
  limit. Optimizing one list now and then is fine; many lists in a row can get you temporarily blocked.

### Good to know

- Shipping is estimated from Cardmarket's public price table. In a few countries the table is missing a
  cheaper option, so the estimate is a bit too high rather than too low. The cart always shows the final
  amount.
- Cardmarket doesn't allow more than 8 copies of the same card from different sellers. For larger
  quantities the optimizer takes all copies from one seller.
- If the Wizard's result is already the cheapest, the optimizer says so and doesn't offer to change your
  cart.
- Something looks wrong? Click **Debug: download data** under the plan and attach the file to an
  [issue](../../issues). It contains your wants list and the sellers' offers, but no login data.

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
