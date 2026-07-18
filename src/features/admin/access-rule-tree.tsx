'use client';

import { useMemo } from 'react';
import { ChevronRight, Check, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AccessRuleResponse } from '@/shared/api/types';
import { cn } from '@/shared/lib/utils';

interface TreeNode extends Omit<AccessRuleResponse, 'id'> {
  id: number;          // > 0 = regra real; < 0 = nó sintético de módulo
  isModule?: boolean;
  children: TreeNode[];
}

/** Rótulos amigáveis para os módulos derivados da `keyName` (ex.: "ticket.*"). */
const MODULE_LABEL: Record<string, string> = {
  ticket: 'Tickets',
  worklog: 'Worklogs',
  investigation: 'Investigações',
  rootcause: 'Causas raiz',
  resolution: 'Resoluções',
  learning: 'Aprendizados',
  knowledge: 'Base de conhecimento',
  pattern: 'Padrões de resolução',
  workitem: 'Work items',
  sla: 'SLA',
  auditlog: 'Auditoria',
  analytics: 'Analytics',
  intelligence: 'Inteligência',
  notification: 'Notificações',
  search: 'Busca',
  symptom: 'Sintomas',
  iteration: 'Iterações',
  tag: 'Tags',
  webhook: 'Webhooks',
  role: 'Papéis',
  admin: 'Administração',
};
const ADMIN_SUB_LABEL: Record<string, string> = {
  users: 'Usuários',
  teams: 'Equipes',
  tenants: 'Tenants',
};

/**
 * Resolve o caminho hierárquico de uma regra a partir da `keyName`.
 * Ex.: "admin.users.create" -> ["admin", "users"], "ticket.create" -> ["ticket"].
 * Estratégia: prefixo é tudo menos o último segmento; "admin.X.Y" ganha submódulo "X".
 */
function modulePath(key: string): string[] {
  const parts = key.split('.');
  if (parts.length <= 1) return ['outros'];
  if (parts[0] === 'admin' && parts.length >= 3) return ['admin', parts[1]];
  return [parts[0]];
}

function moduleLabel(path: string[]): string {
  if (path[0] === 'admin' && path[1]) {
    return `${MODULE_LABEL.admin} · ${ADMIN_SUB_LABEL[path[1]] ?? path[1]}`;
  }
  return MODULE_LABEL[path[0]] ?? path[0];
}

let synth = 0;
const nextSynthId = () => --synth; // ids negativos para nós sintéticos

/**
 * Constrói a árvore agrupando primeiro por MÓDULO (derivado da `keyName`),
 * e mantendo a hierarquia via `ParentId` dentro de cada módulo quando aplicável.
 */
function buildTree(rules: AccessRuleResponse[]): TreeNode[] {
  // Index original (ParentId hierarchy)
  const byId = new Map<number, TreeNode>();
  rules.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const realRoots: TreeNode[] = [];
  byId.forEach((node) => {
    const parent = node.parentId != null ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else realRoots.push(node);
  });

  // Agrupa as raízes reais pelos módulos derivados da keyName.
  const modules = new Map<string, TreeNode>();
  for (const root of realRoots) {
    const path = modulePath(root.keyName);
    const key = path.join('/');
    let mod = modules.get(key);
    if (!mod) {
      mod = {
        id: nextSynthId(),
        isModule: true,
        description: moduleLabel(path),
        keyName: key,
        parentId: null,
        forAdministratorOnly: false,
        createdAt: null,
        children: [],
      };
      modules.set(key, mod);
    }
    mod.children.push(root);
  }

  const sortRec = (ns: TreeNode[]) => {
    ns.sort((a, b) => a.description.localeCompare(b.description));
    ns.forEach((n) => sortRec(n.children));
  };
  const result = [...modules.values()];
  sortRec(result);
  return result;
}

function descendantIds(node: TreeNode): number[] {
  // Não incluir o próprio id quando for nó sintético de módulo.
  const own = node.isModule ? [] : [node.id];
  return [...own, ...node.children.flatMap(descendantIds)];
}

/**
 * Árvore de regras de acesso (hierarquia por ParentId) com checkboxes em cascata.
 * Marcar/desmarcar um nó propaga a todos os descendentes; pais ficam
 * indeterminados quando só parte dos filhos está marcada.
 */
export function AccessRuleTree({
  rules,
  selected,
  onChange,
  query = '',
  onlySelected = false,
}: {
  rules: AccessRuleResponse[];
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
  /** Filtra por texto (descrição/chave). */
  query?: string;
  /** Mostra apenas regras concedidas (ou com descendentes concedidos). */
  onlySelected?: boolean;
}) {
  const fullTree = useMemo(() => buildTree(rules), [rules]);

  const tree = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && !onlySelected) return fullTree;
    const prune = (nodes: TreeNode[]): TreeNode[] =>
      nodes
        .map((n) => {
          const children = prune(n.children);
          const matchesText = !q || n.description.toLowerCase().includes(q) || n.keyName.toLowerCase().includes(q);
          const matchesSel = !onlySelected || selected.has(n.id);
          const keep = (matchesText && matchesSel) || children.length > 0;
          return keep ? { ...n, children } : null;
        })
        .filter((n): n is TreeNode => n !== null);
    return prune(fullTree);
  }, [fullTree, query, onlySelected, selected]);

  function toggle(node: TreeNode) {
    const ids = descendantIds(node);
    const allChecked = ids.every((id) => selected.has(id));
    const next = new Set(selected);
    ids.forEach((id) => (allChecked ? next.delete(id) : next.add(id)));
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {tree.map((node) => (
        <TreeRow key={node.id} node={node} depth={0} selected={selected} onToggle={toggle} />
      ))}
    </div>
  );
}

function TreeRow({
  node,
  depth,
  selected,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  selected: Set<number>;
  onToggle: (node: TreeNode) => void;
}) {
  const t = useTranslations('admin.profiles');
  const [open, setOpen] = useState(true);

  const ids = descendantIds(node);
  const checkedCount = ids.filter((id) => selected.has(id)).length;
  const allChecked = checkedCount === ids.length && ids.length > 0;
  const someChecked = checkedCount > 0 && !allChecked;

  // ── Nó de MÓDULO: cartão com cabeçalho (contagem + marcar/limpar tudo) ──
  if (node.isModule) {
    return (
      <section className="overflow-hidden rounded-xl border border-border bg-panel">
        <header className="flex items-center gap-2 border-b border-border bg-panel-2/40 px-3 py-2">
          <button type="button" onClick={() => setOpen((v) => !v)} className="grid h-5 w-5 place-items-center text-dim hover:text-text" aria-label={open ? t('collapse') : t('expand')}>
            <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} aria-hidden />
          </button>
          <span className="text-sm font-bold text-text">{node.description}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', allChecked ? 'bg-success/15 text-success' : someChecked ? 'bg-warning/15 text-warning' : 'bg-panel-2 text-dim')}>
            {t('grantedOf', { granted: checkedCount, total: ids.length })}
          </span>
          <button
            type="button"
            onClick={() => onToggle(node)}
            className={cn('ml-auto rounded-md border px-2 py-1 text-[11px] font-medium transition-colors', allChecked ? 'border-border text-muted hover:bg-panel-2 hover:text-text' : 'border-primary/40 text-primary hover:bg-primary/10')}
          >
            {allChecked ? t('clearAll') : t('grantAll')}
          </button>
        </header>
        {open && (
          <div className="divide-y divide-border/50">
            {node.children.map((c) => (
              <TreeRow key={c.id} node={c} depth={depth + 1} selected={selected} onToggle={onToggle} />
            ))}
          </div>
        )}
      </section>
    );
  }

  // ── Nó FOLHA (ou submódulo com filhos): linha com toggle explícito Pode/Não pode ──
  const hasChildren = node.children.length > 0;
  const granted = allChecked;
  return (
    <div>
      <div className={cn('flex items-center gap-3 px-3 py-2 transition-colors', granted ? 'bg-success/[0.05]' : 'hover:bg-panel-2/40')}>
        {hasChildren ? (
          <button type="button" onClick={() => setOpen((v) => !v)} className="grid h-4 w-4 place-items-center text-dim hover:text-text" aria-label={open ? t('collapse') : t('expand')}>
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} aria-hidden />
          </button>
        ) : (
          <span className="inline-block h-4 w-4 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-text">{node.description}</p>
          <p className="truncate font-mono text-[10px] text-dim">{node.keyName}</p>
        </div>
        <button
          type="button"
          onClick={() => onToggle(node)}
          aria-pressed={granted}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
            granted
              ? 'border-success/40 bg-success/10 text-success hover:bg-success/15'
              : someChecked
                ? 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/15'
                : 'border-border bg-panel-2 text-dim hover:text-text',
          )}
        >
          {granted ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          {granted ? t('can') : someChecked ? t('partial') : t('cannot')}
        </button>
      </div>
      {hasChildren && open && (
        <div className="ml-4 border-l border-border/50">
          {node.children.map((c) => (
            <TreeRow key={c.id} node={c} depth={depth + 1} selected={selected} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
