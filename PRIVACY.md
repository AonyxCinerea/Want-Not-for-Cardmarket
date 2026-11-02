# Privacy policy — Want-Not for Cardmarket

_Last updated: 2 November 2026_

Want-Not does not collect, sell or share any personal data. There is no analytics, tracking or
server operated by the developer.

## What the extension accesses

- **cardmarket.com** — on your wants list pages, the extension reads the list and each card's edit page,
  and saves changes you confirm. These requests go directly from your browser to Cardmarket in your
  own logged-in session, exactly as if you clicked through the pages yourself.
- **cardmarket.com, optimizer** — on a Shopping Wizard results page, when you click "Optimize incl. shipping",
  the extension reads your wants list and the offers of the sellers involved. When you click "Add plan to
  cart", it adds the chosen articles to your shopping cart and reads the cart to show the total. It never
  places an order.
- **help.cardmarket.com** — only if you allow it in the settings: the optimizer reads Cardmarket's public
  shipping price table for the seller's and your country. Nothing about you is sent.
- **api.scryfall.com** — only for cards with more than 20 versions, the extension sends Cardmarket
  product IDs of that card to Scryfall to look up public prices. No information about you or your
  account is sent. See [Scryfall's privacy policy](https://scryfall.com/docs/privacy).

## What is stored

Stored by your browser, on your device (synced settings use your browser's own sync, if enabled):

- your settings (presets, patterns, excluded expansions)
- names of expansions seen while analyzing, to offer them in the settings
- the latest analysis result per wants list (expires after 12 hours)
- a backup of expansion selections when you use "Reset all to Any", so it can be undone
- your shipping destination country and the ID of the wants list you last opened (for the optimizer)

Removing the extension deletes all of this.

## Contact

Questions: open an issue at https://github.com/AonyxCinerea/Want-Not-for-Cardmarket/issues
