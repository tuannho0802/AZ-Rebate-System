'use client';

import { useState } from 'react';
import { User, SubtreeNode } from '../../lib/api/user';
import { ActiveBadge, RoleBadge } from '../ui/primitives';

export interface TreeSubtreeNode {
  id: string;
  depth: number;
  user?: User;
  children: TreeSubtreeNode[];
}

/**
 * Builds a hierarchical tree from a flat list of SubtreeNodes ({ id, depth })
 * using the depth and parent-child relationships inferred from the flat ordering.
 */
export function buildSubtreeHierarchy(
  flatNodes: SubtreeNode[],
  userMap: Map<string, User>,
): TreeSubtreeNode | null {
  if (flatNodes.length === 0) return null;

  const rootFlatNode = flatNodes[0];
  const rootNode: TreeSubtreeNode = {
    id: rootFlatNode.id,
    depth: rootFlatNode.depth,
    user: userMap.get(rootFlatNode.id),
    children: [],
  };

  const stack: TreeSubtreeNode[] = [rootNode];

  for (let i = 1; i < flatNodes.length; i++) {
    const flatNode = flatNodes[i];
    const node: TreeSubtreeNode = {
      id: flatNode.id,
      depth: flatNode.depth,
      user: userMap.get(flatNode.id),
      children: [],
    };

    // Pop nodes from stack that are at the same depth or deeper than the current node
    while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
      stack.pop();
    }

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }

  return rootNode;
}

export interface SubtreeTreeProps {
  root: TreeSubtreeNode;
  defaultExpandedDepth?: number;
  currentActorId?: string;
}

function SubtreeTreeNode({
  node,
  defaultExpandedDepth = 1,
  currentActorId,
}: {
  node: TreeSubtreeNode;
  defaultExpandedDepth?: number;
  currentActorId?: string;
}) {
  const hasChildren = node.children.length > 0;
  // Automatically expand if node.depth < defaultExpandedDepth
  const [isExpanded, setIsExpanded] = useState(
    node.depth < defaultExpandedDepth,
  );

  const userInfo = node.user;
  const isRootActor = node.depth === 0;

  const displayName = userInfo
    ? userInfo.fullName
      ? `${userInfo.fullName} (${userInfo.email})`
      : userInfo.email
    : `User (${node.id.slice(0, 8)}...)`;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 py-1.5 px-2.5 rounded-lg transition-colors ${
          isRootActor
            ? 'bg-indigo-50/80 border border-indigo-200/80 shadow-sm'
            : 'hover:bg-slate-100/70'
        }`}
      >
        {/* Toggle Chevron */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700 text-xs font-bold rounded transition-colors"
            aria-label="Toggle branch"
          >
            {isExpanded ? '▼' : '►'}
          </button>
        ) : (
          <span className="w-5 h-5 flex items-center justify-center text-slate-300 text-xs">
            •
          </span>
        )}

        {/* Display Name & Info */}
        <span
          className={`text-sm font-medium ${
            isRootActor ? 'text-indigo-950 font-semibold' : 'text-slate-800'
          }`}
          title={node.id}
        >
          {displayName}
        </span>

        {/* Root / You Badge */}
        {isRootActor && (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-600 text-white font-bold">
            Gốc Subtree
          </span>
        )}

        {/* Depth badge */}
        <span className="text-xs text-slate-400">cấp {node.depth}</span>

        {/* Role & Active Status */}
        {userInfo && <RoleBadge role={userInfo.role} />}
        {userInfo && <ActiveBadge active={userInfo.isActive} />}

        {/* Direct children count */}
        {hasChildren && (
          <span className="text-xs text-slate-400 font-medium">
            ({node.children.length} con)
          </span>
        )}
      </div>

      {/* Recursive Children Subtree */}
      {hasChildren && isExpanded && (
        <div className="pl-6 ml-2 border-l border-slate-200 mt-1 space-y-1">
          {node.children.map((child) => (
            <SubtreeTreeNode
              key={child.id}
              node={child}
              defaultExpandedDepth={defaultExpandedDepth}
              currentActorId={currentActorId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SubtreeTree({
  root,
  defaultExpandedDepth = 1,
  currentActorId,
}: SubtreeTreeProps) {
  return (
    <div className="space-y-1 bg-white p-3 border border-slate-200 rounded-xl">
      <SubtreeTreeNode
        node={root}
        defaultExpandedDepth={defaultExpandedDepth}
        currentActorId={currentActorId}
      />
    </div>
  );
}
