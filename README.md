# scammerwatchlist

A Reddit app (built on [Devvit](https://developers.reddit.com/)) that lets redditors flag scammers in a comment — the app handles the lookup, the listing, and the ongoing warnings automatically.

## Why you should install it in your subreddit

- Marketplace, trading, gig-work, and freelancing subreddits are easy targets for repeat scammers.
- Banned accounts often resurface under the same username elsewhere.
- One flag from one person protects everyone who interacts with that account afterward.
- No mod approval needed, no separate form, just a comment.

## How it works

| Comment | Effect |
| `u/scammerwatchlist` | Checks if the target account is on the watchlist |
| `u/scammerwatchlist blacklist` | Adds the target account to the watchlist |
| `u/scammerwatchlist remove blacklist` | Removes the target account (for corrections) |

**Targeting:**
- Reply to a comment → that comment's author is the target
- Top-level comment on a post → the post's author (OP) is the target

**Ongoing enforcement:**
- Once listed, the account gets auto-flagged on *every* future post/comment in the subreddit
- No mention needed, it's automated from then on

**Safeguards:**
- Anyone can flag/check — no special permissions
- Can't blacklist or remove yourself
- Bot ignores its own replies (no loops)

## Commands

- `npm run dev` – local dev server, live on Reddit
- `npm run build` – build client + server
- `npm run deploy` – upload new version
- `npm run launch` – publish for review
- `npm run login` – log CLI into Reddit
- `npm run type-check` – type check, lint, format

## Built with

- [Devvit](https://developers.reddit.com/) – Reddit's developer platform
- [Hono](https://hono.dev/) – backend routing
- [React](https://react.dev/) + [Tailwind](https://tailwindcss.com/) – frontend
- [TypeScript](https://www.typescriptlang.org/) – type safety