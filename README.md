# tracker-boot-git-hooks

コミットにストーリーIDが含まれているとき、プッシュ時にTracker Bootのストーリーへ自動でコメントを投稿します。  
커밋에 스토리 ID가 포함된 경우, 푸시 시 Tracker Boot 스토리에 자동으로 댓글을 게시합니다。  
Automatically posts a comment on a Tracker Boot story when you push a commit that references it.

[日本語](#ja) · [한국어](#ko) · [English](#en)

---

<a id="ja"></a>
## 日本語

**必要環境:** Node.js ≥ 18、Git

---

### インストール

パッケージをグローバルインストールします（Bekind-Labs GitHubオーガニゼーションへのアクセスが必要です）。

**SSH認証を使用する場合:**

```sh
npm install -g git+ssh://git@github.com/Bekind-Labs/tracker-boot-git-hooks.git
```

**GitHub CLI（`gh auth login`）でHTTPS認証を使用する場合:**

```sh
npm install -g https://github.com/Bekind-Labs/tracker-boot-git-hooks.git
```

トラッキングしたいリポジトリ内で一度実行してください:

```sh
tracker-boot-git-hooks install
```

初回プッシュ時にTracker Boot APIキーの入力を求められます。グローバルgit設定（`~/.gitconfig`）に保存され、以降は聞かれません。

新しいリポジトリからの初回プッシュ時には、そのリポジトリのプロジェクトIDの入力も求められます。そのリポジトリの`.git/config`にローカル保存されます。

---

### コミットでストーリーを参照する

コミットメッセージの件名の任意の位置に、ストーリーID（9桁）を角括弧で囲んで記述します:

```
[#200022323] F-198B: ダンスのアニメーションを追加
[finishes #200022323] fix redirect after login
[fixes #200022323] typo
[#200022323 delivered] ship feature
```

対応キーワード: `fixes`、`fixed`、`finish`、`finishes`、`finished`、`completes`、`completed`、`delivers`、`delivered` — またはキーワードなしでも使用可能です。キーワードはIDの前後どちらに置いても構いません。

> **注意:** キーワードはコメントに含まれますが、現時点ではストーリーの状態を変更しません。

1つのコミットで複数のストーリーを参照できます。それぞれのストーリーに個別のコメントが投稿されます。

---

### すでにpre-pushフックがある場合

他のツールが`.git/hooks/pre-push`（または`.husky/pre-push`）を使用している場合、インストールは中断されます。対処法は2つあります:

**方法A** — 置き換える。既存のフックを削除してから`install`を再実行します。

**方法B** — 追記する。既存のフックの末尾に以下の行を追加します:

```sh
tracker-boot-git-hooks hook "$@"
```

---

### デバッグ

```sh
TRACKER_DEBUG=1 git push
```

各ステップをstderrに出力します: プッシュ入力の生データ、検出されたコミット、抽出されたストーリーID、APIコールの内容。

すでにプッシュ済みのコミットに対してフックを再実行するには:

```sh
echo "refs/heads/main $(git rev-parse HEAD) refs/heads/main $(git rev-parse HEAD~)" \
  | TRACKER_DEBUG=1 sh .git/hooks/pre-push
```

---

### 非標準のTracker Bootインスタンス

ローカルまたはステージングインスタンスを使用している場合は、プッシュ前に`TRACKER_BASE_URL`を設定してください:

```sh
TRACKER_BASE_URL=https://trackerboot.staging.example.com git push
```

ベースURLに`/graphql`を自動的に付加します。

フックを非標準インスタンスに恒久的に向けるには:

```sh
tracker-boot-git-hooks install --base-url https://trackerboot.staging.example.com
```

---

### 既知の制限事項

**コミットリンクはGitHubのみ対応。** リモートがGitHub URL（HTTPSまたはSSH）の場合のみ、コメントにハイパーリンク付きのコミットSHAが含まれます。その他のホスト（GitLab、Bitbucketなど）ではプレーンテキストで表示されます。

**フックマネージャーはHuskyのみ検出。** lefthook、simple-git-hooks、その他のマネージャーを使用している場合、`install`では検出されません — 上記のセクションで紹介した`tracker-boot-git-hooks hook`アプローチを使用してください。

**`tracker-boot-git-hooks hook`使用時はstdinが利用可能である必要があります。** 既存のフックでフック行の前にstdinを読み取るコマンドがある場合、gitのrefデータがすでに消費されてしまい、コミットが検出されません。ほとんどのフック（リンター、フォーマッターなど）はstdinを読み取らないため、実際にはほとんど問題になりません。

**1コミットで複数のストーリーIDを参照した場合。** コミットが複数のストーリーを参照している場合、各ストーリーに同一のコメントが投稿されます — 他のストーリーIDを含む完全なコミット件名がそのまま引用されます。

**キーワードはストーリーの状態を変更しません。** 上記のコミット書式セクションの注意を参照してください。

---

### 仕組み

1. Gitはpre-pushフックを呼び出し、プッシュされるrefの範囲をstdin経由で渡します
2. フックは新しいコミットに対して`git log`を実行し、各コミットメッセージからストーリーIDを抽出します
3. 各ストーリーIDに対して、GraphQL APIを通じてTracker Bootにコミットへのリンクを含むコメントを投稿します

フックはプッシュをブロックしません — APIに到達できない場合やエラーが返された場合でも、プッシュは続行され、エラーはstderrに出力されます。

### TODO

- [ ] 世界へのリリース 🌍
- [ ] キーワードに基づくストーリー状態変更のサポート
- [ ] より多くのGitホスティングプロバイダーのサポート（GitLab、Bitbucketなど）

---

<a id="ko"></a>
## 한국어

**필요 환경:** Node.js ≥ 18、Git

---

### 설치

패키지를 전역으로 설치합니다（Bekind-Labs GitHub 조직에 대한 액세스가 필요합니다）。

**SSH로 인증하는 경우:**

```sh
npm install -g git+ssh://git@github.com/Bekind-Labs/tracker-boot-git-hooks.git
```

**GitHub CLI（`gh auth login`）로 HTTPS 인증하는 경우:**

```sh
npm install -g https://github.com/Bekind-Labs/tracker-boot-git-hooks.git
```

추적하려는 저장소 안에서 한 번 실행하세요:

```sh
tracker-boot-git-hooks install
```

저장소에서 처음 푸시할 때 Tracker Boot API 키를 입력하라는 메시지가 표시됩니다。전역 git 설정（`~/.gitconfig`）에 저장되며 이후에는 묻지 않습니다。

새로운 저장소에서 처음 푸시할 때는 해당 저장소의 프로젝트 ID도 입력하라는 메시지가 표시됩니다。해당 저장소의 `.git/config`에 로컬로 저장됩니다。

---

### 커밋에서 스토리 참조하기

커밋 제목의 어느 위치에나 스토리 ID（9자리）를 대괄호로 감싸서 작성합니다:

```
[#200022323] F-198B: ダンスのアニメーションを追加
[finishes #200022323] fix redirect after login
[fixes #200022323] typo
[#200022323 delivered] ship feature
```

지원 키워드: `fixes`、`fixed`、`finish`、`finishes`、`finished`、`completes`、`completed`、`delivers`、`delivered` — 또는 키워드 없이도 사용 가능합니다。키워드는 ID 앞뒤 어디에나 올 수 있습니다。

> **참고:** 키워드는 댓글에 포함되지만 현재는 스토리 상태를 변경하지 않습니다。

하나의 커밋에서 여러 스토리를 참조할 수 있습니다。각 스토리에 개별 댓글이 게시됩니다。

---

### 이미 pre-push 훅이 있는 경우

다른 도구가 `.git/hooks/pre-push`（또는 `.husky/pre-push`）를 사용 중이면 설치가 중단됩니다。두 가지 방법이 있습니다:

**방법 A** — 교체하기。기존 훅을 삭제하고 `install`을 다시 실행합니다。

**방법 B** — 추가하기。기존 훅의 맨 아래에 다음 줄을 추가합니다:

```sh
tracker-boot-git-hooks hook "$@"
```

---

### 디버깅

```sh
TRACKER_DEBUG=1 git push
```

각 단계를 stderr에 출력합니다: 원시 푸시 입력、감지된 커밋、추출된 스토리 ID、수행된 API 호출。

이미 푸시된 커밋에 대해 훅을 재실행하려면:

```sh
echo "refs/heads/main $(git rev-parse HEAD) refs/heads/main $(git rev-parse HEAD~)" \
  | TRACKER_DEBUG=1 sh .git/hooks/pre-push
```

---

### 비표준 Tracker Boot 인스턴스

로컬 또는 스테이징 인스턴스를 사용하는 경우 푸시 전에 `TRACKER_BASE_URL`을 설정하세요:

```sh
TRACKER_BASE_URL=https://trackerboot.staging.example.com git push
```

베이스 URL에 `/graphql`을 자동으로 추가합니다。

비표준 인스턴스를 영구적으로 가리키는 훅을 설치하려면:

```sh
tracker-boot-git-hooks install --base-url https://trackerboot.staging.example.com
```

---

### 알려진 제한 사항

**커밋 링크는 GitHub 전용입니다。** 리모트가 GitHub URL（HTTPS 또는 SSH）인 경우에만 댓글에 하이퍼링크된 커밋 SHA가 포함됩니다。다른 호스트（GitLab、Bitbucket 등）에서는 일반 텍스트로 표시됩니다。

**훅 매니저는 Husky만 감지합니다。** lefthook、simple-git-hooks 또는 다른 매니저를 사용하는 경우 `install`이 감지하지 못합니다 — 위 섹션의 `tracker-boot-git-hooks hook` 방식을 사용하세요。

**`tracker-boot-git-hooks hook` 사용 시 stdin이 사용 가능해야 합니다。** 기존 훅에서 훅 줄 이전에 stdin을 읽는 명령이 있으면 git의 ref 데이터가 이미 소비되어 커밋을 찾을 수 없습니다。대부분의 훅（린터、포매터 등）은 stdin을 읽지 않으므로 실제로는 거의 문제가 없습니다。

**하나의 커밋에 여러 스토리 ID가 있는 경우。** 커밋이 여러 스토리를 참조하면 각 스토리에 동일한 댓글이 게시됩니다 — 다른 스토리 ID를 포함한 전체 커밋 제목이 그대로 인용됩니다。

**키워드는 스토리 상태를 변경하지 않습니다。** 위의 커밋 형식 섹션의 참고 사항을 확인하세요。

---

### 작동 방식

1. Git이 pre-push 훅을 호출하고 stdin을 통해 푸시되는 ref 범위를 전달합니다
2. 훅이 새 커밋에 대해 `git log`를 실행하고 각 커밋 메시지에서 스토리 ID를 추출합니다
3. 각 스토리 ID에 대해 GraphQL API를 통해 Tracker Boot에 커밋 링크가 포함된 댓글을 게시합니다

훅은 절대 푸시를 차단하지 않습니다 — API에 연결할 수 없거나 오류가 반환되더라도 푸시는 진행되고 오류는 stderr에 출력됩니다。

### TODO

- [ ] 세상에 출시하기 🌍
- [ ] 키워드를 기반으로 한 스토리 상태 변경 지원
- [ ] 더 많은 Git 호스팅 제공업체 지원（GitLab、Bitbucket 등）

---

<a id="en"></a>
## English

**Requires:** Node.js ≥ 18, Git

---

### Installation

Install the package globally (requires access to the Bekind-Labs GitHub org).

**If you authenticate with SSH:**

```sh
npm install -g git+ssh://git@github.com/Bekind-Labs/tracker-boot-git-hooks.git
```

**If you authenticate with HTTPS via the GitHub CLI (`gh auth login`):**

```sh
npm install -g https://github.com/Bekind-Labs/tracker-boot-git-hooks.git
```

Then run this once inside any repo you want to track:

```sh
tracker-boot-git-hooks install
```

The first time you push from any repo, you'll be prompted for your Tracker Boot API key. It's saved to your global git config (`~/.gitconfig`) and never asked again.

The first time you push from a *new* repo, you'll also be prompted for that repo's project ID. It's saved locally to that repo's `.git/config`.

---

### Referencing a story in a commit

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

### If you already have a pre-push hook

If another tool already owns `.git/hooks/pre-push` (or `.husky/pre-push`), installation will stop and tell you. You have two options:

**Option A** — Replace it. Remove the existing hook and re-run `install`.

**Option B** — Append to it. Add this line to the bottom of your existing hook:

```sh
tracker-boot-git-hooks hook "$@"
```

---

### Debugging

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

### Non-standard Tracker Boot instance

If you're running a local or staging instance, set `TRACKER_BASE_URL` before pushing:

```sh
TRACKER_BASE_URL=https://trackerboot.staging.example.com git push
```

The hook appends `/graphql` to the base URL automatically.

To install a hook permanently pointed at a non-standard instance:

```sh
tracker-boot-git-hooks install --base-url https://trackerboot.staging.example.com
```

---

### Known limitations

**Commit links are GitHub-only.** The comment includes a hyperlinked commit SHA when the remote is a GitHub URL (HTTPS or SSH). For other hosts (GitLab, Bitbucket, etc.) the SHA appears as plain text.

**Hook manager detection is Husky-only.** If you use lefthook, simple-git-hooks, or another manager, `install` won't detect it — use the `tracker-boot-git-hooks hook` approach from the section above instead.

**Stdin must be available when using `tracker-boot-git-hooks hook`.** If another command in your existing hook reads stdin before the hook line, git's ref data will already be consumed and no commits will be found. Most hooks (linters, formatters) don't read stdin, so this is rarely an issue in practice.

**Multiple story IDs in one commit.** When a commit references more than one story, each story gets an identical comment — the full commit subject, including the other story IDs, quoted verbatim.

**Keywords don't change story state.** See the note in the commit format section above.

---

### How it works

1. Git calls the pre-push hook and passes the ref ranges being pushed via stdin
2. The hook runs `git log` over the new commits and extracts story IDs from each commit message
3. For each story ID, it posts a comment to Tracker Boot via the GraphQL API with a link to the commit

The hook never blocks a push — if the API is unreachable or returns an error, the push goes through and the error is printed to stderr.

### TODO

- [ ] Release to the world 🌍
- [ ] Support story state changes based on keywords
- [ ] Support more Git hosting providers (GitLab, Bitbucket, etc.)
