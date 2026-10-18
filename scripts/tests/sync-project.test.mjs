import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../sync-project.mjs', import.meta.url));

function fixture(t) {
  const temp = mkdtempSync(join(tmpdir(), 'fortcordis sync test-'));
  const remote = join(temp, 'origin.git');
  const samsung = join(temp, 'Samsung');
  const macbook = join(temp, 'MacBook');
  const config = join(temp, 'empty-gitconfig');
  writeFileSync(config, '');
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: config, GIT_TERMINAL_PROMPT: '0' };
  t.after(() => {
    // Delete only the exact temporary directory created for this test.
    assert.equal(dirname(resolve(temp)), resolve(tmpdir()));
    assert.ok(basename(temp).startsWith('fortcordis sync test-'));
    rmSync(temp, { recursive: true, force: true });
  });

  function run(cwd, command, args, ok = true) {
    const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', windowsHide: true });
    assert.ifError(result.error);
    if (ok) assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
    return { ...result, output: result.stdout + result.stderr };
  }
  const git = (cwd, ...args) => run(cwd, 'git', args).stdout.trim();
  const sync = (cwd, args = [], ok = true) => run(cwd, process.execPath, [script, ...args], ok);
  const head = (cwd) => git(cwd, 'rev-parse', 'HEAD');
  const contents = (cwd, path) => readFileSync(join(cwd, path), 'utf8');
  function commit(cwd, text, path = 'work.txt') {
    writeFileSync(join(cwd, path), text);
    git(cwd, 'add', '--all');
    git(cwd, 'commit', '--quiet', '-m', text);
    return head(cwd);
  }
  function identity(cwd) {
    git(cwd, 'config', 'user.name', 'Sync Test');
    git(cwd, 'config', 'user.email', 'sync@example.invalid');
    git(cwd, 'config', 'core.autocrlf', 'false');
  }

  git(temp, 'init', '--quiet', '--bare', '--initial-branch=stage', remote);
  git(temp, 'clone', '--quiet', remote, samsung);
  identity(samsung);
  mkdirSync(join(samsung, 'scripts'));
  copyFileSync(script, join(samsung, 'scripts', 'sync-project.mjs'));
  writeFileSync(join(samsung, '.gitignore'), '.env\n*.db\ncache/\n');
  commit(samsung, 'initial');
  git(samsung, 'push', '--quiet', '-u', 'origin', 'stage');
  git(samsung, 'switch', '--quiet', '-c', 'codex/trabalho');
  git(samsung, 'push', '--quiet', '-u', 'origin', 'codex/trabalho');
  git(temp, 'clone', '--quiet', remote, macbook);
  identity(macbook);
  git(macbook, 'switch', '--quiet', '--track', 'origin/codex/trabalho');
  return { temp, samsung, macbook, git, sync, run, head, contents, commit };
}

test('instala alias, recebe de uma subpasta com espacos e preserva runtime ignorado', (t) => {
  const f = fixture(t);
  f.sync(f.samsung, ['instalar']);
  const updated = f.commit(f.macbook, 'trabalho no Mac');
  f.git(f.macbook, 'push', '--quiet');
  writeFileSync(join(f.samsung, '.env'), 'local config');
  writeFileSync(join(f.samsung, 'local.db'), 'local data');
  mkdirSync(join(f.samsung, 'scripts', 'pasta com espacos'));
  const result = f.run(join(f.samsung, 'scripts', 'pasta com espacos'), 'git', ['sync']);
  assert.match(result.output, /Atualizado: codex\/trabalho/);
  assert.equal(f.head(f.samsung), updated);
  assert.equal(f.contents(f.samsung, '.env'), 'local config');
  assert.equal(f.contents(f.samsung, 'local.db'), 'local data');
});

test('envia alteracoes explicitamente e recebe na segunda copia sem interpretar mensagem como shell', (t) => {
  const f = fixture(t);
  f.sync(f.samsung, ['instalar']);
  const message = 'Ajuste clínico: "teste" $() `literal`';
  writeFileSync(join(f.samsung, 'novo.txt'), 'alteracao Samsung');
  const result = f.run(f.samsung, 'git', ['sync', 'enviar', message]);
  assert.match(result.output, /Enviado: codex\/trabalho/);
  assert.equal(f.git(f.samsung, 'log', '-1', '--format=%s'), message);
  f.sync(f.macbook);
  assert.equal(f.head(f.samsung), f.head(f.macbook));
  assert.equal(f.contents(f.macbook, 'novo.txt'), 'alteracao Samsung');
  assert.equal(f.git(f.samsung, 'status', '--porcelain'), '');
});

test('receber com alteracoes locais para sem trocar branch, indice ou arquivos', (t) => {
  const f = fixture(t);
  const before = f.head(f.samsung);
  writeFileSync(join(f.samsung, 'work.txt'), 'nao enviar');
  const status = f.git(f.samsung, 'status', '--porcelain');
  const result = f.sync(f.samsung, ['receber', 'stage'], false);
  assert.equal(result.status, 1);
  assert.match(result.output, /alteracoes locais pendentes/);
  assert.equal(f.head(f.samsung), before);
  assert.equal(f.git(f.samsung, 'status', '--porcelain'), status);
  assert.equal(f.contents(f.samsung, 'work.txt'), 'nao enviar');
});

test('divergencia interrompe envio antes de salvar alteracoes adicionais', (t) => {
  const f = fixture(t);
  const before = f.commit(f.samsung, 'commit Samsung', 'samsung.txt');
  f.commit(f.macbook, 'commit Mac', 'mac.txt');
  f.git(f.macbook, 'push', '--quiet');
  writeFileSync(join(f.samsung, 'work.txt'), 'ainda nao commitado');
  const indexBefore = f.git(f.samsung, 'diff', '--cached');
  const result = f.sync(f.samsung, ['enviar', 'nao deve ser criado'], false);
  assert.equal(result.status, 1);
  assert.match(result.output, /historicos divergiram/);
  assert.equal(f.head(f.samsung), before);
  assert.equal(f.git(f.samsung, 'diff', '--cached'), indexBefore);
  assert.equal(f.contents(f.samsung, 'work.txt'), 'ainda nao commitado');
});

test('remoto avancado e arvore suja nao geram commit automatico', (t) => {
  const f = fixture(t);
  f.commit(f.macbook, 'remoto avancou');
  f.git(f.macbook, 'push', '--quiet');
  const before = f.head(f.samsung);
  writeFileSync(join(f.samsung, 'novo.txt'), 'pendente');
  const result = f.sync(f.samsung, ['enviar', 'nao deve ser criado'], false);
  assert.equal(result.status, 1);
  assert.match(result.output, /Nenhum commit foi criado/);
  assert.equal(f.head(f.samsung), before);
  assert.equal(f.git(f.samsung, 'diff', '--cached'), '');
});

test('main e stage recusam envio antes de registrar trabalho', (t) => {
  const f = fixture(t);
  f.git(f.samsung, 'switch', '--quiet', 'stage');
  const before = f.head(f.samsung);
  writeFileSync(join(f.samsung, 'pendente.txt'), 'preservar');
  for (const branch of ['stage', 'main']) {
    if (branch === 'main') f.git(f.samsung, 'switch', '--quiet', '-c', 'main');
    const result = f.sync(f.samsung, ['enviar', 'nao publicar'], false);
    assert.equal(result.status, 1);
    assert.match(result.output, new RegExp(`Envio bloqueado em ${branch}`));
    assert.equal(f.head(f.samsung), before);
    assert.equal(f.git(f.samsung, 'diff', '--cached'), '');
  }
});

test('publica uma branch nova e abre a mesma branch no outro computador', (t) => {
  const f = fixture(t);
  f.git(f.samsung, 'switch', '--quiet', '-c', 'codex/nova-tarefa');
  writeFileSync(join(f.samsung, 'novo.txt'), 'nova tarefa');
  f.sync(f.samsung, ['enviar', 'nova tarefa']);
  f.sync(f.macbook, ['receber', 'codex/nova-tarefa']);
  assert.equal(f.git(f.macbook, 'branch', '--show-current'), 'codex/nova-tarefa');
  assert.equal(f.head(f.samsung), f.head(f.macbook));
  assert.equal(f.git(f.macbook, 'rev-parse', '--abbrev-ref', '@{upstream}'), 'origin/codex/nova-tarefa');
});

test('receber recusa commits locais nao enviados e nao troca para branch adiantada', (t) => {
  const f = fixture(t);
  const before = f.commit(f.samsung, 'ainda local');
  f.git(f.samsung, 'switch', '--quiet', 'stage');
  const result = f.sync(f.samsung, ['receber', 'codex/trabalho'], false);
  assert.equal(result.status, 1);
  assert.match(result.output, /ainda nao enviados/);
  assert.equal(f.git(f.samsung, 'branch', '--show-current'), 'stage');
  assert.equal(f.git(f.samsung, 'rev-parse', 'codex/trabalho'), before);
});

test('flags ocultas, merge pendente e HEAD destacado bloqueiam sincronizacao', (t) => {
  const f = fixture(t);
  for (const flag of ['assume-unchanged', 'skip-worktree']) {
    f.git(f.samsung, 'update-index', `--${flag}`, '--', 'work.txt');
    const result = f.sync(f.samsung, [], false);
    assert.equal(result.status, 1);
    assert.match(result.output, /indice Git esta ocultando alteracoes/);
    f.git(f.samsung, 'update-index', `--no-${flag}`, '--', 'work.txt');
  }
  const mergeHead = join(f.samsung, '.git', 'MERGE_HEAD');
  writeFileSync(mergeHead, f.head(f.samsung) + '\n');
  assert.match(f.sync(f.samsung, [], false).output, /Operacao Git pendente/);
  rmSync(mergeHead);
  f.git(f.samsung, 'switch', '--quiet', '--detach');
  assert.match(f.sync(f.samsung, [], false).output, /HEAD destacado/);
});

test('fast-forward nao sobrescreve arquivo ignorado que o remoto passou a versionar', (t) => {
  const f = fixture(t);
  const before = f.head(f.samsung);
  writeFileSync(join(f.samsung, '.env'), 'configuracao privada Samsung');
  writeFileSync(join(f.macbook, '.env'), 'exemplo remoto');
  f.git(f.macbook, 'add', '--force', '.env');
  f.git(f.macbook, 'commit', '--quiet', '-m', 'versiona caminho antes ignorado');
  f.git(f.macbook, 'push', '--quiet');
  const result = f.sync(f.samsung, [], false);
  assert.equal(result.status, 1);
  assert.equal(f.contents(f.samsung, '.env'), 'configuracao privada Samsung');
  assert.equal(f.head(f.samsung), before);
});

test('trocar de branch tambem preserva arquivos ignorados e alias existente', (t) => {
  const f = fixture(t);
  f.git(f.macbook, 'switch', '--quiet', '-c', 'codex/arquivo-ignorado');
  writeFileSync(join(f.macbook, '.env'), 'remoto');
  f.git(f.macbook, 'add', '--force', '.env');
  f.git(f.macbook, 'commit', '--quiet', '-m', 'novo caminho');
  f.git(f.macbook, 'push', '--quiet', '-u', 'origin', 'codex/arquivo-ignorado');
  writeFileSync(join(f.samsung, '.env'), 'privado');
  const result = f.sync(f.samsung, ['receber', 'codex/arquivo-ignorado'], false);
  assert.equal(result.status, 1);
  assert.equal(f.contents(f.samsung, '.env'), 'privado');
  assert.equal(f.git(f.samsung, 'branch', '--show-current'), 'codex/trabalho');
  f.git(f.samsung, 'config', '--local', 'alias.sync', 'status');
  assert.equal(f.sync(f.samsung, ['instalar'], false).status, 1);
  assert.equal(f.git(f.samsung, 'config', '--get', 'alias.sync'), 'status');
});

test('envia commits existentes sem mensagem, mas exige mensagem para salvar arquivos', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.samsung, 'novo.txt'), 'pendente');
  const before = f.head(f.samsung);
  assert.equal(f.sync(f.samsung, ['enviar'], false).status, 1);
  assert.equal(f.head(f.samsung), before);
  f.commit(f.samsung, 'commit ja registrado');
  f.sync(f.samsung, ['enviar']);
  f.sync(f.macbook);
  assert.equal(f.head(f.samsung), f.head(f.macbook));
  assert.ok(existsSync(join(f.macbook, 'novo.txt')));
});

test('alias continua funcionando ao abrir uma branch que nao contem o script', (t) => {
  const f = fixture(t);
  f.sync(f.samsung, ['instalar']);
  f.git(f.macbook, 'switch', '--quiet', 'stage');
  f.git(f.macbook, 'rm', '--quiet', 'scripts/sync-project.mjs');
  f.git(f.macbook, 'commit', '--quiet', '-m', 'simula branch antiga sem ferramenta');
  f.git(f.macbook, 'push', '--quiet');
  f.run(f.samsung, 'git', ['sync', 'receber', 'stage']);
  assert.equal(existsSync(join(f.samsung, 'scripts', 'sync-project.mjs')), false);
  assert.match(f.run(f.samsung, 'git', ['sync']).output, /Atualizado: stage/);
  assert.match(f.run(f.samsung, 'git', ['sync', 'ajuda']).output, /Sincronizacao FortCordis/);
});
