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
 * using `parentId` from User objects to determine parent-child relationships.
 *
 * IMPORTANT: Backend `getSubtree()` returns nodes ordered by `depth ASC`
 * (level-order / BFS), NOT DFS pre-order. Nodes at the same depth from
 * different branches are interleaved. Therefore we CANNOT rely on array
 * ordering to infer parent-child relationships — we MUST use `parentId`
 * from the User data.
 */
export function buildSubtreeHierarchy(
  flatNodes: SubtreeNode[],
  userMap: Map<string, User>,
): TreeSubtreeNode | null {
  if (flatNodes.length === 0) return null;

  const rootId = flatNodes[0].id;

  // 1. Build all TreeSubtreeNode objects keyed by id
  const nodeMap = new Map<string, TreeSubtreeNode>();
  for (const flatNode of flatNodes) {
    nodeMap.set(flatNode.id, {
      id: flatNode.id,
      depth: flatNode.depth,
      user: userMap.get(flatNode.id),
      children: [],
    });
  }

  // 2. Wire parent → child using parentId from User data
  //    Orphan nodes (parentId unknown or not in subtree) are attached to root.
  const orphans: TreeSubtreeNode[] = [];

  for (const flatNode of flatNodes) {
    if (flatNode.id === rootId) continue; // root has no parent in this subtree

    const userInfo = userMap.get(flatNode.id);
    const parentId = userInfo?.parentId;
    const treeNode = nodeMap.get(flatNode.id)!;

    if (parentId && nodeMap.has(parentId)) {
      // Normal case: parent is in the subtree, wire correctly
      nodeMap.get(parentId)!.children.push(treeNode);
    } else {
      // Orphan: parentId unknown (user not in userMap) or parent not in subtree
      // Attach to root as fallback so they're still visible
      orphans.push(treeNode);
      if (!userInfo) {
        console.warn(
          `[SubtreeTree] Node ${flatNode.id} (depth ${flatNode.depth}) not found in userMap — cannot determine parentId. Attached to root as orphan.`,
        );
      }
    }
  }

  const rootNode = nodeMap.get(rootId)!;

  // Append orphans at the end of root's children so they're visible
  if (orphans.length > 0) {
    rootNode.children.push(...orphans);
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
  const [isExpanded, setIsExpanded] = useState(
    node.depth < defaultExpandedDepth,
  );

  const userInfo = node.user;
  const isRootActor = node.depth === 0;

  // TUYỆT ĐỐI không hiện ID thô (kể cả rút gọn) — Phase 3 rule
  const displayName = userInfo
    ? userInfo.fullName
      ? `${userInfo.fullName} (${userInfo.email})`
      : userInfo.email
    : 'Người dùng không xác định';

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
          } ${!userInfo ? 'italic text-slate-400' : ''}`}
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
