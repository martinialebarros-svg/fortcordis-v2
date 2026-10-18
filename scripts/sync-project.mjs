#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const alias = '!node "$(git rev-parse --git-common-dir)/fortcordis-sync.mjs"';
const help = `Sincronizacao FortCordis (Windows e macOS)

Instalar uma vez: node scripts/sync-project.mjs instalar
Ao comecar:      git sync
Trocar de tarefa: git sync receber codex/nome-da-tarefa
Ao terminar:    git sync enviar "Descricao do trabalho"
Enviar commits ja registrados: git sync enviar

Use a mesma branch nos dois computadores. Enviar com mensagem salva TODAS as
alteracoes nao ignoradas. Bancos, .env e uploads ignorados permanecem locais.
main e stage recebem atualizacoes; o envio exige uma branch de trabalho.
`;

let root = process.cwd();

function git(args, { optional = false, show = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw new Error(`Nao foi possivel executar Git: ${result.error.message}`);
  if (result.status !== 0 && !optional) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `Git falhou: ${args[0]}`);
  }
  if (show) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  return { ok: result.status === 0, text: result.stdout.trim(), raw: result.stdout };
}

function requireSafeState() {
  for (const state of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer', 'index.lock']) {
    const statePath = git(['rev-parse', '--git-path', state]).text;
    if (existsSync(resolve(root, statePath))) {
      throw new Error(`Operacao Git pendente (${state}). Conclua essa operacao antes de sincronizar.`);
    }
  }
  const hidden = git(['ls-files', '-v', '-z']).raw.split('\0')
    .filter((entry) => /^[a-zS] /.test(entry));
  if (hidden.length) {
    throw new Error(`O indice Git esta ocultando alteracoes (assume-unchanged/skip-worktree):\n${hidden.slice(0, 10).map((entry) => entry.slice(2)).join('\n')}\nRevise essas marcas antes de sincronizar.`);
  }
}

function currentBranch() {
  const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], { optional: true });
  if (!branch.ok) throw new Error('HEAD destacado. Abra uma branch antes de sincronizar.');
  return branch.text;
}

function requireClean() {
  if (git(['status', '--porcelain=v1', '-z', '--untracked-files=normal']).raw) {
    throw new Error('Ha alteracoes locais pendentes. Use git sync enviar "Descricao" na sua branch de trabalho antes de receber ou trocar de branch.');
  }
}

function validateBranch(branch) {
  if (branch.startsWith('-') || !git(['check-ref-format', `refs/heads/${branch}`], { optional: true }).ok) {
    throw new Error('Nome de branch invalido. Use o nome completo, por exemplo codex/minha-tarefa.');
  }
}

function hasRef(ref) {
  return git(['show-ref', '--verify', '--quiet', ref], { optional: true }).ok;
}

function checkUpstream(branch) {
  const upstream = git(['for-each-ref', '--format=%(upstream)', `refs/heads/${branch}`]).text;
  if (upstream && upstream !== `refs/remotes/origin/${branch}`) {
    throw new Error(`A branch ${branch} acompanha ${upstream}. Revise essa configuracao; este comando usa origin/${branch}.`);
  }
}

function counts(local, remote) {
  const [ahead, behind] = git(['rev-list', '--left-right', '--count', `${local}...${remote}`]).text.split(/\s+/).map(Number);
  if (ahead && behind) {
    throw new Error('Os historicos divergiram: existem commits diferentes nos dois lados. Sincronizacao interrompida; revise a divergencia antes de continuar.');
  }
  return { ahead, behind };
}

function fastForward(remote) {
  git(['merge', '--ff-only', '--no-stat', '--no-overwrite-ignore', remote], { show: true });
}

function receive(branch, args) {
  if (args.length > 1) throw new Error('Uso: git sync receber [branch]');
  requireClean();
  const target = args[0] || branch;
  validateBranch(target);
  checkUpstream(target);
  git(['fetch', '--prune', 'origin'], { show: true });
  const remote = `refs/remotes/origin/${target}`;
  const local = `refs/heads/${target}`;
  if (!hasRef(remote)) throw new Error(`A branch origin/${target} nao existe. Envie-a primeiro no outro computador.`);
  if (hasRef(local)) {
    const { ahead } = counts(local, remote);
    if (ahead) throw new Error(`A branch ${target} tem ${ahead} commit(s) ainda nao enviados. Abra essa branch e envie o trabalho primeiro.`);
    if (target !== branch) git(['switch', '--no-overwrite-ignore', target], { show: true });
    fastForward(remote);
  } else {
    git(['switch', '--no-overwrite-ignore', '--create', target, '--track', `origin/${target}`], { show: true });
  }
  console.log(`Atualizado: ${target} = origin/${target} (${git(['rev-parse', '--short', 'HEAD']).text}).`);
}

function send(branch, args) {
  if (args.length > 1 || (args.length && !args[0].trim())) throw new Error('Uso: git sync enviar "Descricao do trabalho"');
  if (['main', 'stage'].includes(branch)) {
    throw new Error(`Envio bloqueado em ${branch}, pois essa branch aciona deploy. Crie uma branch de trabalho com git switch -c codex/nome-da-tarefa e execute novamente.`);
  }
  checkUpstream(branch);
  const dirty = Boolean(git(['status', '--porcelain=v1', '-z', '--untracked-files=normal']).raw);
  if (dirty && !args.length) throw new Error('Para salvar e enviar alteracoes, informe uma mensagem: git sync enviar "Descricao do trabalho"');
  git(['fetch', '--prune', 'origin'], { show: true });
  const remote = `refs/remotes/origin/${branch}`;
  if (hasRef(remote)) {
    const { behind } = counts('HEAD', remote);
    if (behind && dirty) {
      throw new Error('O remoto avancou e ha alteracoes locais pendentes. Nenhum commit foi criado. Preserve seu trabalho em um commit e revise a atualizacao antes de enviar.');
    }
    if (behind) fastForward(remote);
  }
  if (dirty) {
    git(['status', '--short'], { show: true });
    git(['add', '--all']);
    git(['commit', '-m', args[0]], { show: true });
  }
  requireClean();
  git(['push', '--set-upstream', 'origin', `HEAD:refs/heads/${branch}`], { show: true });
  console.log(`Enviado: ${branch} (${git(['rev-parse', '--short', 'HEAD']).text}).\nNo outro computador: git sync receber ${branch}`);
}

try {
  const [action = 'receber', ...args] = process.argv.slice(2);
  if (['ajuda', '--help', '-h'].includes(action)) {
    console.log(help);
  } else {
    root = git(['rev-parse', '--show-toplevel']).text;
    if (action === 'instalar') {
      if (args.length) throw new Error('Uso: node scripts/sync-project.mjs instalar');
      const previous = git(['config', '--local', '--get', 'alias.sync'], { optional: true });
      if (previous.ok && previous.text !== alias) throw new Error('Ja existe outro alias Git chamado sync neste repositorio. Revise-o antes de instalar.');
      const installed = resolve(root, git(['rev-parse', '--git-common-dir']).text, 'fortcordis-sync.mjs');
      const source = fileURLToPath(import.meta.url);
      if (resolve(source) !== installed) copyFileSync(source, installed);
      git(['config', '--local', 'alias.sync', alias]);
      console.log(`git sync instalado neste repositorio.\n\n${help}`);
    } else {
      if (!['receber', 'enviar'].includes(action)) throw new Error('Acao desconhecida. Use git sync ajuda.');
      requireSafeState();
      const branch = currentBranch();
      git(['remote', 'get-url', 'origin']);
      if (action === 'receber') receive(branch, args);
      else send(branch, args);
    }
  }
} catch (error) {
  console.error(`Sincronizacao interrompida: ${error.message}`);
  process.exitCode = 1;
}
