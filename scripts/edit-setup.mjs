// One-time setup for editing on the public site (repeat when the GitHub token expires).
//
// Asks for your GitHub fine-grained token and a passphrase (hidden input), checks the
// token can push, test-commits on a temporary branch, then encrypts the GitHub and
// TMDB tokens with the passphrase into public/vault.json and publishes it.
// Neither the tokens nor the passphrase are stored unencrypted anywhere.
//
// Usage: npm run edit:setup

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { githubClient } from '../shared/github.mjs';
import { encryptVault } from '../shared/vault.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const VAULT = path.join(ROOT, 'public', 'vault.json');
const MIN_PASSPHRASE = 14;

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Print the prompt, then swallow the echo of what's typed.
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(question);
        else if (s.includes('\n') || s.includes('\r')) rl.output.write('\n');
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const fail = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};

const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' }).trim();
const repo = remote.match(/github\.com[/:]([^/]+\/[^/.]+)/)?.[1];
if (!repo) fail(`Could not read the GitHub repo from the git remote (${remote}).`);
const tmdb = process.env.TMDB_TOKEN;
if (!tmdb) fail('TMDB_TOKEN missing from .env.');

console.log(`Setting up editing for ${repo}.\n`);

const token = await ask('GitHub token (github_pat_…, hidden): ', { hidden: true });
if (!token.startsWith('github_pat_')) fail('That does not look like a fine-grained token (should start with github_pat_).');

const gh = githubClient({ token, repo });
process.stdout.write('Checking the token… ');
try {
  if (!(await gh.canPush())) fail('The token cannot write to the repo. Set "Contents: Read and write" for movierank.');
} catch (e) {
  fail(`GitHub rejected the token (${e.message}). Check it was copied fully and has access to ${repo}.`);
}
console.log('can push ✓');

// Exercise the exact commit path the site uses, on a throwaway branch.
process.stdout.write('Test commit on a temporary branch… ');
const testBranch = `edit-setup-test-${Date.now()}`;
const head = (await gh.api('/git/ref/heads/main')).object.sha;
await gh.api('/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${testBranch}`, sha: head }) });
try {
  const test = githubClient({ token, repo, branch: testBranch });
  const sha = await test.commitFiles(async () => ({ 'data/.edit-setup-test': `ok ${new Date().toISOString()}\n` }), 'Edit setup self-test');
  if (!sha) fail('Test commit was not created.');
} finally {
  await gh.api(`/git/refs/heads/${testBranch}`, { method: 'DELETE' });
}
console.log('works ✓ (branch deleted)');

console.log(`\nChoose the passphrase you'll type on the site to edit.`);
console.log(`Use at least ${MIN_PASSPHRASE} characters — e.g. four random words. The encrypted file is public.`);
const passphrase = await ask('Passphrase (hidden): ', { hidden: true });
if (passphrase.length < MIN_PASSPHRASE) fail(`Passphrase too short (${passphrase.length} characters, need ${MIN_PASSPHRASE}+).`);
if ((await ask('Repeat passphrase (hidden): ', { hidden: true })) !== passphrase) fail('Passphrases do not match.');

process.stdout.write('\nEncrypting… ');
const vault = await encryptVault({ github: token, tmdb, repo, branch: 'main' }, passphrase);
fs.mkdirSync(path.dirname(VAULT), { recursive: true });
fs.writeFileSync(VAULT, JSON.stringify(vault, null, 1) + '\n');
console.log('saved public/vault.json');

process.stdout.write('Publishing… ');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
git('add', 'public/vault.json');
git('commit', '-m', 'Update encrypted editing credentials', '--', 'public/vault.json');
git('pull', '--rebase', '--autostash');
git('push');
console.log('done ✓');
console.log(`\nIn about a minute, open the site, click "Edit" and enter your passphrase.`);
