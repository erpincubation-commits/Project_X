import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

// Uses argument arrays rather than a shell. Never reads environment files.
try {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--base', '--head'].includes(args[i]) || args[i + 1] === undefined || args[i + 1].startsWith('--') || (args[i] === '--head' && !args[i + 1])) throw new Error('Usage: npm run docs:check -- [--base <revision>] [--head <revision>]');
    if (Object.hasOwn(options, args[i])) throw new Error(`Duplicate option ${args[i]}`);
    options[args[i]] = args[i + 1];
  }
  const git = (values, extra = {}) => execFileSync('git', values, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...extra }).trimEnd();
  const root = git(['rev-parse', '--show-toplevel']);
  const at = values => git(['-C', root, ...values]);
  const commit = value => at(['rev-parse', '--verify', '--end-of-options', `${value}^{commit}`]);
  const emptyTree = () => git(['hash-object', '-t', 'tree', '--stdin'], { input: '' });
  const head = options['--head'] ? commit(options['--head']) : null;
  const ref = options['--base'];
  const base = ref ? (/^0+$/.test(ref) ? emptyTree() : commit(ref)) : head ? (at(['rev-list', '--parents', '-n', '1', head]).split(' ')[1] || emptyTree()) : commit('HEAD');
  const changed = new Set(at(['diff', '--name-only', '--no-renames', '-z', base, ...(head ? [head] : []), '--']).split('\0').filter(Boolean));
  if (!head) for (const path of at(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)) changed.add(path);
  const guide = 'docs/USER_GUIDE.md';
  const covered = path => path !== guide && (/^(apps|packages|tools|scripts|infra)\//.test(path) || path.startsWith('.github/workflows/') || (path.startsWith('docs/') && !path.startsWith('docs/archive/') && path.endsWith('.md')) || /^(AGENTS\.md|README\.md|package(?:-lock)?\.json|\.env\.example|tsconfig[^/]*\.json)$/.test(path));
  const triggers = [...changed].filter(covered);
  if (triggers.length && !changed.has(guide)) throw new Error(`Update ${guide} in the same change, including a dated review for internal changes. Covered paths:\n${triggers.map(path => `  ${path}`).join('\n')}`);
  const read = path => head ? at(['show', `${head}:${path}`]) : readFileSync(resolve(root, path), 'utf8');
  const available = path => {
    if (!head) return existsSync(resolve(root, path));
    try { at(['cat-file', '-e', `${head}:${path}`]); return true; } catch { return false; }
  };
  const headings = content => {
    const seen = new Map(), ids = new Set();
    let fenced = false;
    for (const line of content.split(/\r?\n/)) {
      if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
      if (fenced || !/^#{1,6}\s/.test(line)) continue;
      const slug = line.replace(/^#{1,6}\s+/, '').trim().toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
      const count = seen.get(slug) || 0;
      ids.add(count ? `${slug}-${count}` : slug); seen.set(slug, count + 1);
    }
    for (const match of content.matchAll(/\bid=["']([^"']+)["']/g)) ids.add(match[1]);
    return ids;
  };
  let links = 0;
  for (const source of [guide, 'docs/USER_GUIDE_MAINTENANCE.md']) {
    for (const match of read(source).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1].replace(/^<|>$/g, '');
      if (/^[a-z][a-z\d+.-]*:/i.test(target)) continue;
      const [file, anchor] = target.split('#');
      const absolute = file ? resolve(root, dirname(source), decodeURIComponent(file)) : resolve(root, source);
      const path = relative(root, absolute).replaceAll('\\', '/');
      if (path.startsWith('../') || isAbsolute(path) || !available(path)) throw new Error(`Broken local link in ${source}: ${target}`);
      if (anchor && !headings(read(path)).has(decodeURIComponent(anchor))) throw new Error(`Missing heading in ${source}: ${target}`);
      links++;
    }
  }
  const content = read(guide), version = JSON.parse(read('package.json')).version;
  const schema = read('apps/server/src/bootstrap.ts').match(/version\s*!==\s*(\d+)/)?.[1];
  const baseline = content.match(/^\*\*Application baseline:\*\*\s+package version ([^,\s]+),[^\r\n]*database schema (\d+)\b/m);
  if (!schema || baseline?.[1] !== version || baseline?.[2] !== schema) throw new Error(`Update the guide baseline to package version ${version} and the source schema requirement.`);
  if (!/^\*\*Last reviewed:\*\*\s+\S/m.test(content) || !content.includes('## Guide maintenance and revision history')) throw new Error('Keep the guide review date and revision history.');
  console.log(`User guide check passed: ${links} local links; version ${version}, schema ${schema}; ${triggers.length} covered changed paths${triggers.length ? ' with a guide edit' : ''}.`);
} catch (error) {
  console.error(error.status !== undefined ? 'User guide check failed: Git lookup failed. Check the revisions and fetch history.' : `User guide check failed: ${error.message}`);
  process.exitCode = 1;
}
