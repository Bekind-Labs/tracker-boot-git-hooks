# tracker-boot-git-hooks

Automatically posts a comment on a Tracker Boot story when you push a commit that references it.

**Requires:** Node.js ≥ 18, Git

---

## Installation

Install the package globally (requires access to the BKL GitHub org):

```sh
npm install -g bekindlabs/tracker-boot-git-hooks
```

Then run this once inside any repo you want to track:

```sh
tracker-boot-git-hooks install
```

The first time you push from any repo, you'll be prompted for your Tracker Boot API key. It's saved to your global git config (`~/.gitconfig`) and never asked again.

The first time you push from a *new* repo, you'll also be prompted for that repo's project ID. It's saved locally to that repo's `.git/config`.

---

## Referencing a story in a commit

Include the story ID (9 digits) in square brackets anywhere in your commit subject:

```
[#200022323] F-198B: ダンスのアニメーションを追加
[finishes #200022323] fix redirect after login
[fixes #200022323] typo
[#200022323 delivered] ship feature
```

Supported keywords: `fixes`, `fixed`, `finish`, `finishes`, `finished`, `completes`, `completed`, `delivers`, `delivered` — or no keyword at all. The keyword may appear before or after the ID.

> **Note:** Keywords are recognized but don't change story state yet. For now they're just included in the comment for context.

A commit can reference multiple stories. Each gets its own comment.

---

## If you already have a pre-push hook

If another tool already owns `.git/hooks/pre-push` (or `.husky/pre-push`), installation will stop and tell you. You have two options:

**Option A** — Replace it. Remove the existing hook and re-run `install`.

**Option B** — Append to it. Add this line to the bottom of your existing hook:

```sh
tracker-boot-git-hooks hook "$@"
```

---

## Debugging

```sh
TRACKER_DEBUG=1 git push
```

Prints each step to stderr: the raw push input, commits found, story IDs extracted, and which API calls are made.

To replay the hook against a commit you've already pushed:

```sh
echo "refs/heads/main $(git rev-parse HEAD) refs/heads/main $(git rev-parse HEAD~)" \
  | TRACKER_DEBUG=1 sh .git/hooks/pre-push
```

---

## Non-standard Tracker Boot instance

If you're running a local or staging instance, set `TRACKER_BASE_URL` before pushing:

```sh
TRACKER_BASE_URL=https://trackerboot.staging.example.com git push
```

The hook derives `/graphql` and `/analytics/graphql` from the base URL automatically.

To install a hook permanently pointed at a non-standard instance:

```sh
tracker-boot-git-hooks install --base-url https://trackerboot.staging.example.com
```

---

## Known limitations

**Commit links are GitHub-only.** The comment includes a hyperlinked commit SHA when the remote is a GitHub URL (HTTPS or SSH). For other hosts (GitLab, Bitbucket, etc.) the SHA appears as plain text.

**Hook manager detection is Husky-only.** If you use lefthook, simple-git-hooks, or another manager, `install` won't detect it — use the `tracker-boot-git-hooks hook` approach from the section above instead.

**Stdin must be available when using `tracker-boot-git-hooks hook`.** If another command in your existing hook reads stdin before the hook line, git's ref data will already be consumed and no commits will be found. Most hooks (linters, formatters) don't read stdin, so this is rarely an issue in practice.

**Multiple story IDs in one commit.** When a commit references more than one story, each story gets an identical comment — the full commit subject, including the other story IDs. Story `222222222` will see `` `[#111111111] [#222222222] some fix` `` quoted verbatim.

**Keywords don't change story state.** See the note in the commit format section above.

---

## How it works

1. Git calls the pre-push hook and passes the ref ranges being pushed via stdin
2. The hook runs `git log` over the new commits and extracts story IDs from each commit message
3. For each story ID, it posts a comment to Tracker Boot via the GraphQL API with a link to the commit

The hook never blocks a push — if the API is unreachable or returns an error, the push goes through and the error is printed to stderr.

## TODO

[ ] Release to the world 🌍
[ ] Support story state changes based on keywords
[ ] Support more Git hosting providers (GitLab, Bitbucket, etc.)
