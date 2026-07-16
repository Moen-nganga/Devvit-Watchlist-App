# scammerwatchlist

A Reddit app (built on [Devvit](https://developers.reddit.com/)) that lets redditors flag scammers in the comment. 
The app confirms whether a user is blacklisted, then automatically replies to the comment thread to 
warn other users. 

## Why you should install it in your subreddit

- Marketplace, trading, gig-work, and freelancing subreddits are easy targets for repeat scammers.
- Banned accounts often resurface under the same username elsewhere.
- One flag from one person protects everyone who interacts with that account afterward.
- Mod approval is needed when listing someone as a scammer, to ensure no one is wrongfully listed. 

## How it works

| Comment | Effect |
|---|---|
These are the commands that a user can run if the app is installed in a subreddit. 
| `u/scammerwatchlist` | Checks if the target account is on the watchlist |
| `u/scammerwatchlist blacklist` | Adds the target account to the watchlist | Sends the report to the moderators | (Moderators have the final say)
| `u/scammerwatchlist remove blacklist` | Removes the target account (for corrections) | Sends the request to the moderators | (Moderators have the final say)

**Targeting:**
- If a user replies to a post as a new comment, the OP of the post is the target. 
- If a user replies to a comment as a thread, the comment's author is the target. 

**Ongoing enforcement:**
- Once listed, the account gets auto-flagged on future posts. The app only replies once under the post. 
- Once listed, the account gets auto-flagged on future comments. The app only replies to a single comment  posted by the flagged's account under a post. 

**Safeguards:**
- Anyone can flag, but moderators need to verify it. So they have the final say. 
- Can't blacklist or remove yourself
- Bot ignores its own replies (no loops)

## Data & privacy

- The only data stored is: the flagged Reddit username, who flagged them, when, and the post/comment where the flag happened.
- Data is stored in Reddit's own Devvit-managed Redis, scoped to the subreddit the app is installed in nothing is sent to any third-party service or external server.
- No API keys, analytics, or tracking are used by this app.
- Removing an account via `u/scammerwatchlist remove blacklist` deletes its entry entirely.
- Moderator-only actions (e.g. creating a post via the subreddit menu) are verified server-side, not just hidden in the UI.

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