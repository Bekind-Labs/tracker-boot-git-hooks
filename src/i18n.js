const MESSAGES = {
  en: {
    promptApiKey: 'Enter your tracker-boot API key: ',
    promptProjectId: 'Enter your tracker-boot project ID for this repo: ',
    apiKeyStored: 'API key saved to global git config (tracker.apiKey).',
    projectIdStored: 'Project ID saved to local git config (tracker.projectId).',
    apiError: 'tracker-boot: failed to post comment for story {storyId}: {message}',
    commentPosted: 'tracker-boot: comment posted on story {storyId}.',
    hookExistsError: '🚫  Hook conflict — installation aborted  🚫\nA pre-push hook already exists at:\n  {path}\n\nRemove it first, then re-run:\n  tracker-boot-git-hooks install\n\nOr append to your existing hook:\n  tracker-boot-git-hooks hook "$@"',
    updateAvailable: 'tracker-boot: update available {latest} (current: {current}). Run: npm install -g tracker-boot-git-hooks',
  },
  ko: {
    promptApiKey: 'tracker-boot API 키를 입력하세요: ',
    promptProjectId: '이 저장소의 tracker-boot 프로젝트 ID를 입력하세요: ',
    apiKeyStored: 'API 키가 전역 git 설정에 저장되었습니다 (tracker.apiKey).',
    projectIdStored: '프로젝트 ID가 로컬 git 설정에 저장되었습니다 (tracker.projectId).',
    apiError: 'tracker-boot: 스토리 {storyId}에 댓글을 게시하지 못했습니다: {message}',
    commentPosted: 'tracker-boot: 스토리 {storyId}에 댓글이 게시되었습니다.',
    hookExistsError: '🚫  훅 충돌 — 설치가 중단되었습니다  🚫\n이미 pre-push 훅이 존재합니다:\n  {path}\n\n먼저 삭제한 후 다시 실행하세요:\n  tracker-boot-git-hooks install\n\n또는 기존 훅에 다음 줄을 추가하세요:\n  tracker-boot-git-hooks hook "$@"',
    updateAvailable: 'tracker-boot: 업데이트 가능 {latest} (현재: {current}). 실행: npm install -g tracker-boot-git-hooks',
  },
  ja: {
    promptApiKey: 'tracker-boot APIキーを入力してください: ',
    promptProjectId: 'このリポジトリのtracker-bootプロジェクトIDを入力してください: ',
    apiKeyStored: 'APIキーがグローバルgit設定に保存されました (tracker.apiKey)。',
    projectIdStored: 'プロジェクトIDがローカルgit設定に保存されました (tracker.projectId)。',
    apiError: 'tracker-boot: ストーリー{storyId}へのコメント投稿に失敗しました: {message}',
    commentPosted: 'tracker-boot: ストーリー{storyId}にコメントが投稿されました。',
    hookExistsError: '🚫  フック競合 — インストールを中断しました  🚫\n以下のパスにpre-pushフックが既に存在します:\n  {path}\n\n先に削除してから再実行してください:\n  tracker-boot-git-hooks install\n\nまたは既存のフックに以下を追記してください:\n  tracker-boot-git-hooks hook "$@"',
    updateAvailable: 'tracker-boot: アップデートがあります {latest} (現在: {current})。実行: npm install -g tracker-boot-git-hooks',
  },
}

export function detectLang(langEnv) {
  if (!langEnv) return 'en'
  const code = langEnv.split('_')[0].toLowerCase()
  return MESSAGES[code] ? code : 'en'
}

export function t(key, lang, vars = {}) {
  const messages = MESSAGES[lang] ?? MESSAGES.en
  const template = messages[key] ?? MESSAGES.en[key] ?? key
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
}
