'use client';

import { useMemo, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { AccessRuleResponse } from '@/shared/api/types';
import { cn } from '@/shared/lib/utils';

interface TreeNode extends AccessRuleResponse {
  children: TreeNode[];
}

function buildTree(rules: AccessRuleResponse[]): TreeNode[] {
  const byId = new Map<number, TreeNode>();
  rules.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    const parent = node.parentId != null ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  const sortRec = (ns: TreeNode[]) => {
    ns.sort((a, b) => a.description.localeCompare(b.description));
    ns.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function descendantIds(node: TreeNode): number[] {
  return [node.id, ...node.children.flatMap(descendantIds)];
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
            aria-label={open ? 'Recolher' : 'Expandir'}
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} aria-hidden />
          </button>
        ) : (
          <span className="inline-block h-4 w-4" />
        )}
        <label className="flex flex-1 cursor-pointer items-center gap-sm">
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            onChange={() => onToggle(node)}
            className="h-4 w-4 accent-[var(--orbit-color-primary)]"
          />
          <span className="text-sm text-text">{node.description}</span>
          <span className="font-mono text-[11px] text-dim">{node.keyName}</span>
        </label>
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
