// Minimal GitHub client for committing data files straight to the repo, used by the
// public site's edit mode and by the setup script's self-test. Works in Node 22 and browsers.

export function githubClient({ token, repo, branch = 'main' }) {
  async function api(path, init = {}) {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      // GitHub sends Cache-Control: max-age=60; a cached branch head would make every commit fail.
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    if (!res.ok) {
      const error = new Error(`GitHub ${res.status} on ${init.method ?? 'GET'} ${path}`);
      error.status = res.status;
      throw error;
    }
    return res.status === 204 ? null : res.json();
  }

  /** File contents at a commit, or null if the file doesn't exist there. */
  async function readText(path, ref = branch) {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${ref}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub ${res.status} reading ${path}`);
    return res.text();
  }

  /**
   * Makes one commit on the branch. `buildFiles(read)` gets a reader for the current
   * head and returns { path: newContent }. If someone else committed in between,
   * the whole thing is rebuilt on the new head and retried.
   */
  async function commitFiles(buildFiles, message, attempts = 4) {
    for (let attempt = 1; ; attempt++) {
      const head = (await api(`/git/ref/heads/${branch}`)).object.sha;
      const commit = await api(`/git/commits/${head}`);
      const files = await buildFiles((path) => readText(path, head));
      const entries = Object.entries(files);
      if (!entries.length) return null;

      const tree = await api('/git/trees', {
        method: 'POST',
        body: JSON.stringify({
          base_tree: commit.tree.sha,
          tree: entries.map(([path, content]) => ({ path, mode: '100644', type: 'blob', content })),
        }),
      });
      const created = await api('/git/commits', {
        method: 'POST',
        body: JSON.stringify({ message, tree: tree.sha, parents: [head] }),
      });
      try {
        await api(`/git/refs/heads/${branch}`, { method: 'PATCH', body: JSON.stringify({ sha: created.sha, force: false }) });
        return created.sha;
      } catch (e) {
        // 422: the branch moved since we read it (not a fast-forward) — rebuild on the new head.
        if (e.status !== 422 || attempt >= attempts) throw e;
      }
    }
  }

  /** True if the token can push to this repo. */
  async function canPush() {
    const r = await api('');
    return Boolean(r.permissions?.push);
  }

  return { api, readText, commitFiles, canPush };
}
