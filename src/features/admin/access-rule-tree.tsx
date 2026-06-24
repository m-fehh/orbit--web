'use client';

import { useMemo, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AccessRuleResponse } from '@/shared/api/types';
import { Checkbox } from '@/shared/ui/checkbox';
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
    <div className="flex flex-col gap-0.5">
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
  const tUi = useTranslations('ui');
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLInputElement>(null);

  const ids = descendantIds(node);
  const checkedCount = ids.filter((id) => selected.has(id)).length;
  const checked = checkedCount === ids.length;
  const indeterminate = checkedCount > 0 && !checked;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-panel-2"
        style={{ paddingLeft: depth * 18 + 4 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-4 w-4 place-items-center text-dim hover:text-text"
            aria-label={open ? tUi('collapse') : tUi('expand')}
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} aria-hidden />
          </button>
        ) : (
          <span className="inline-block h-4 w-4" />
        )}
        <div className="flex flex-1 items-center gap-sm">
          <Checkbox
            ref={ref}
            checked={checked}
            onChange={() => onToggle(node)}
            size="sm"
          />
          <span className={cn('text-sm', node.isModule ? 'font-semibold text-text' : 'text-text')}>
            {node.description}
          </span>
          {!node.isModule && (
            <span className="font-mono text-[11px] text-dim">{node.keyName}</span>
          )}
          {node.isModule && (
            <span className="ml-auto rounded-full bg-panel-2 px-1.5 text-[10px] font-medium text-dim">
              {ids.length}
            </span>
          )}
        </div>
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((c) => (
            <TreeRow key={c.id} node={c} depth={depth + 1} selected={selected} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
