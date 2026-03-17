"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
  MarkerType,
  type NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import { motion } from "framer-motion";
import type { OpsTask } from "@/lib/ops-types";
import { getProjectColor } from "@/lib/ops-types";

interface TaskGraphProps {
  tasks: OpsTask[];
  onTaskClick?: (task: OpsTask) => void;
}

// Custom node component for task cards
function TaskNode({ data }: { data: { task: OpsTask; onClick: () => void } }) {
  const { task, onClick } = data;

  const statusColors: Record<string, { bg: string; border: string; text: string }> = {
    queued: { bg: "bg-cyan-500/10", border: "border-cyan-500", text: "text-cyan-400" },
    running: { bg: "bg-emerald-500/10", border: "border-emerald-500", text: "text-emerald-400" },
    in_progress: { bg: "bg-emerald-500/10", border: "border-emerald-500", text: "text-emerald-400" },
    completed: { bg: "bg-emerald-400/10", border: "border-emerald-400", text: "text-emerald-300" },
    failed: { bg: "bg-red-500/10", border: "border-red-500", text: "text-red-400" },
    blocked: { bg: "bg-amber-500/10", border: "border-amber-500", text: "text-amber-400" },
    pending_approval: { bg: "bg-purple-500/10", border: "border-purple-500", text: "text-purple-400" },
  };

  const colors = statusColors[task.status] || statusColors.queued;
  const projectColor = getProjectColor(task.project);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      className={`
        relative px-4 py-3 rounded-lg border-2 cursor-pointer
        ${colors.bg} ${colors.border}
        backdrop-blur-sm min-w-[200px] max-w-[280px]
        transition-all duration-200
        hover:shadow-lg hover:shadow-cyan-500/20
      `}
      style={{
        borderLeftWidth: "4px",
        borderLeftColor: projectColor,
      }}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-mono font-semibold uppercase tracking-wide ${colors.text}`}>
            {task.status.replace(/_/g, " ")}
          </span>
          {task.priority > 0 && (
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
              P{task.priority}
            </span>
          )}
        </div>

        <div className="text-sm font-medium text-white/90 line-clamp-2">
          {task.title}
        </div>

        {task.project && (
          <div className="text-xs font-mono text-white/50">
            {task.project}
          </div>
        )}

        {task.worker_type && (
          <div className="text-xs font-mono text-cyan-400/70">
            {task.worker_type}
          </div>
        )}

        {task.cost_cents > 0 && (
          <div className="text-xs font-mono text-emerald-400/70">
            ${(task.cost_cents / 100).toFixed(2)}
          </div>
        )}
      </div>
    </motion.div>
  );
}

const nodeTypes: NodeTypes = {
  taskNode: TaskNode,
};

export function TaskGraph({ tasks, onTaskClick }: TaskGraphProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");

  // Build nodes and edges from tasks
  const { initialNodes, initialEdges, projects, statuses } = useMemo(() => {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const projectSet = new Set<string>();
    const statusSet = new Set<string>();

    // Calculate layout positions using a simple layered approach
    const taskLayers = new Map<string, number>();
    const visited = new Set<string>();

    function calculateLayer(taskId: string): number {
      if (visited.has(taskId)) return taskLayers.get(taskId) || 0;
      visited.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) return 0;

      const dependsOn = (task as any).depends_on || [];
      if (!Array.isArray(dependsOn) || dependsOn.length === 0) {
        taskLayers.set(taskId, 0);
        return 0;
      }

      const maxDepLayer = Math.max(
        ...dependsOn
          .filter((depId: string) => taskMap.has(depId))
          .map((depId: string) => calculateLayer(depId))
      );

      const layer = maxDepLayer + 1;
      taskLayers.set(taskId, layer);
      return layer;
    }

    // Calculate layers for all tasks
    tasks.forEach((task) => calculateLayer(task.id));

    // Group tasks by layer
    const layerGroups = new Map<number, string[]>();
    taskLayers.forEach((layer, taskId) => {
      if (!layerGroups.has(layer)) layerGroups.set(layer, []);
      layerGroups.get(layer)!.push(taskId);
    });

    // Position nodes
    const LAYER_SPACING = 300;
    const NODE_SPACING = 150;

    tasks.forEach((task) => {
      if (task.project) projectSet.add(task.project);
      statusSet.add(task.status);

      const layer = taskLayers.get(task.id) || 0;
      const tasksInLayer = layerGroups.get(layer) || [];
      const indexInLayer = tasksInLayer.indexOf(task.id);
      const layerHeight = tasksInLayer.length * NODE_SPACING;

      nodes.push({
        id: task.id,
        type: "taskNode",
        position: {
          x: layer * LAYER_SPACING,
          y: indexInLayer * NODE_SPACING - layerHeight / 2,
        },
        data: {
          task,
          onClick: () => {
            setSelectedTaskId(task.id);
            onTaskClick?.(task);
          },
        },
      });

      // Create edges for dependencies
      const dependsOn = (task as any).depends_on || [];
      if (Array.isArray(dependsOn)) {
        dependsOn.forEach((depId: string) => {
          if (taskMap.has(depId)) {
            edges.push({
              id: `${depId}-${task.id}`,
              source: depId,
              target: task.id,
              type: "smoothstep",
              animated: task.status === "running" || task.status === "in_progress",
              style: {
                stroke: task.status === "blocked" ? "#f59e0b" : "#06b6d4",
                strokeWidth: 2,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: task.status === "blocked" ? "#f59e0b" : "#06b6d4",
              },
            });
          }
        });
      }
    });

    return {
      initialNodes: nodes,
      initialEdges: edges,
      projects: Array.from(projectSet).sort(),
      statuses: Array.from(statusSet).sort(),
    };
  }, [tasks, onTaskClick]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when tasks change
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Filter nodes and edges
  const { filteredNodes, filteredEdges } = useMemo(() => {
    let filtered = nodes;

    if (filterStatus !== "all") {
      const filteredTaskIds = new Set(
        nodes
          .filter((n) => n.data.task.status === filterStatus)
          .map((n) => n.id)
      );
      filtered = nodes.filter((n) => filteredTaskIds.has(n.id));
    }

    if (filterProject !== "all") {
      const filteredTaskIds = new Set(
        nodes
          .filter((n) => n.data.task.project === filterProject)
          .map((n) => n.id)
      );
      filtered = nodes.filter((n) => filteredTaskIds.has(n.id));
    }

    const visibleTaskIds = new Set(filtered.map((n) => n.id));
    const filteredEdges = edges.filter(
      (e) => visibleTaskIds.has(e.source) && visibleTaskIds.has(e.target)
    );

    return { filteredNodes: filtered, filteredEdges };
  }, [nodes, edges, filterStatus, filterProject]);

  return (
    <div className="h-full w-full relative bg-[#0a0a0f]">
      <ReactFlow
        nodes={filteredNodes}
        edges={filteredEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="bg-[#0a0a0f]"
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background color="#1a1a24" gap={16} />
        <Controls className="bg-black/40 border border-cyan-500/20 rounded-lg" />
        <MiniMap
          className="bg-black/60 border border-cyan-500/20 rounded-lg"
          nodeColor={(node) => {
            const status = node.data.task.status;
            const colors: Record<string, string> = {
              queued: "#06b6d4",
              running: "#10b981",
              in_progress: "#10b981",
              completed: "#34d399",
              failed: "#ef4444",
              blocked: "#f59e0b",
              pending_approval: "#a855f7",
            };
            return colors[status] || "#6b7280";
          }}
        />

        <Panel position="top-left" className="flex flex-col gap-3 p-4 bg-black/60 backdrop-blur-sm border border-cyan-500/20 rounded-lg">
          <div className="text-sm font-mono text-cyan-400 font-semibold">FILTERS</div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-white/50">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-black/60 border border-cyan-500/30 rounded text-sm font-mono text-white/90 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-white/50">Project</label>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="px-3 py-1.5 bg-black/60 border border-cyan-500/30 rounded text-sm font-mono text-white/90 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All</option>
              {projects.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 border-t border-white/10">
            <div className="text-xs font-mono text-white/50">
              {filteredNodes.length} / {nodes.length} tasks
            </div>
          </div>
        </Panel>

        <Panel position="top-right" className="p-4 bg-black/60 backdrop-blur-sm border border-cyan-500/20 rounded-lg">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-mono text-cyan-400 font-semibold mb-1">LEGEND</div>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan-500" />
              <span className="text-xs font-mono text-white/70">Queued</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs font-mono text-white/70">Running</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-xs font-mono text-white/70">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-xs font-mono text-white/70">Failed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-xs font-mono text-white/70">Blocked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-xs font-mono text-white/70">Pending Approval</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
