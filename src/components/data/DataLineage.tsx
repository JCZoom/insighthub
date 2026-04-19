'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Database,
  Table,
  BarChart3,
  ArrowRight,
  Eye,
  Code,
  GitBranch,
  Layers,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DataLineageNode {
  id: string;
  type: 'source' | 'table' | 'query' | 'transformation' | 'visualization';
  name: string;
  displayName?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface DataLineageEdge {
  id: string;
  from: string;
  to: string;
  type: 'table_reference' | 'join' | 'aggregation' | 'filter' | 'transformation';
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface DataLineageGraph {
  nodes: DataLineageNode[];
  edges: DataLineageEdge[];
}

interface DataLineageProps {
  graph: DataLineageGraph;
  selectedNode?: string;
  onNodeSelect?: (nodeId: string) => void;
  onNodeAction?: (nodeId: string, action: 'view' | 'edit' | 'query') => void;
  className?: string;
  layout?: 'hierarchical' | 'force' | 'radial';
}

export const DataLineage: React.FC<DataLineageProps> = ({
  graph,
  selectedNode,
  onNodeSelect,
  onNodeAction,
  className = '',
  layout = 'hierarchical'
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Filter nodes based on search and type
  const filteredNodes = useMemo(() => {
    let nodes = graph.nodes;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      nodes = nodes.filter(node =>
        node.name.toLowerCase().includes(query) ||
        node.displayName?.toLowerCase().includes(query) ||
        node.description?.toLowerCase().includes(query)
      );
    }

    if (filterType !== 'all') {
      nodes = nodes.filter(node => node.type === filterType);
    }

    return nodes;
  }, [graph.nodes, searchQuery, filterType]);

  // Get edges that connect filtered nodes
  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return graph.edges.filter(edge =>
      nodeIds.has(edge.from) && nodeIds.has(edge.to)
    );
  }, [filteredNodes, graph.edges]);

  // Group nodes by type for hierarchical view
  const nodesByType = useMemo(() => {
    return filteredNodes.reduce((acc, node) => {
      if (!acc[node.type]) acc[node.type] = [];
      acc[node.type].push(node);
      return acc;
    }, {} as Record<string, DataLineageNode[]>);
  }, [filteredNodes]);

  // Get node icon based on type
  const getNodeIcon = (type: string, size: number = 14) => {
    const iconProps = { size, className: "shrink-0" };

    switch (type) {
      case 'source':
        return <Database {...iconProps} className="text-accent-blue shrink-0" />;
      case 'table':
        return <Table {...iconProps} className="text-accent-green shrink-0" />;
      case 'query':
        return <Code {...iconProps} className="text-accent-purple shrink-0" />;
      case 'transformation':
        return <GitBranch {...iconProps} className="text-accent-orange shrink-0" />;
      case 'visualization':
        return <BarChart3 {...iconProps} className="text-accent-cyan shrink-0" />;
      default:
        return <Layers {...iconProps} className="text-[var(--text-muted)] shrink-0" />;
    }
  };

  // Get edge type description
  const getEdgeDescription = (type: string) => {
    switch (type) {
      case 'table_reference': return 'References';
      case 'join': return 'Joins with';
      case 'aggregation': return 'Aggregates';
      case 'filter': return 'Filters';
      case 'transformation': return 'Transforms';
      default: return 'Connected to';
    }
  };

  // Toggle node expansion
  const toggleNodeExpansion = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  // Get connected nodes
  const getConnectedNodes = useCallback((nodeId: string) => {
    const outgoing = filteredEdges
      .filter(edge => edge.from === nodeId)
      .map(edge => ({
        edge,
        node: filteredNodes.find(n => n.id === edge.to)
      }));

    const incoming = filteredEdges
      .filter(edge => edge.to === nodeId)
      .map(edge => ({
        edge,
        node: filteredNodes.find(n => n.id === edge.from)
      }));

    return { outgoing, incoming };
  }, [filteredNodes, filteredEdges]);

  const nodeTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'source', label: 'Data Sources' },
    { value: 'table', label: 'Tables' },
    { value: 'query', label: 'Queries' },
    { value: 'transformation', label: 'Transformations' },
    { value: 'visualization', label: 'Visualizations' }
  ];

  return (
    <div className={cn("flex flex-col h-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-accent-blue" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Data Lineage</h3>
          <span className="text-xs text-[var(--text-muted)]">
            {filteredNodes.length} node{filteredNodes.length !== 1 ? 's' : ''} • {filteredEdges.length} connection{filteredEdges.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-card)]/30">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes..."
              className="w-full pl-7 pr-3 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-accent-blue"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] rounded px-2 py-1.5"
          >
            {nodeTypeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredNodes.length === 0 ? (
          <div className="text-center py-8">
            <GitBranch size={32} className="mx-auto text-[var(--text-muted)] opacity-40 mb-2" />
            <p className="text-sm text-[var(--text-muted)]">
              {searchQuery ? 'No matching nodes found' : 'No data lineage available'}
            </p>
          </div>
        ) : layout === 'hierarchical' ? (
          // Hierarchical layout - grouped by type
          <div className="space-y-4">
            {Object.entries(nodesByType).map(([type, nodes]) => (
              <div key={type} className="border border-[var(--border-color)] rounded-lg">
                <div className="bg-[var(--bg-card)]/50 px-3 py-2 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2">
                    {getNodeIcon(type, 14)}
                    <h4 className="text-sm font-medium text-[var(--text-primary)] capitalize">
                      {type.replace('_', ' ')}s ({nodes.length})
                    </h4>
                  </div>
                </div>
                <div className="p-2 space-y-1">
                  {nodes.map(node => {
                    const isExpanded = expandedNodes.has(node.id);
                    const isSelected = selectedNode === node.id;
                    const { outgoing, incoming } = getConnectedNodes(node.id);

                    return (
                      <div key={node.id} className="border border-[var(--border-color)] rounded">
                        <div
                          className={cn(
                            "flex items-center gap-2 p-2 cursor-pointer transition-colors",
                            isSelected
                              ? "bg-accent-blue/10 text-accent-blue"
                              : "hover:bg-[var(--bg-card-hover)]"
                          )}
                          onClick={() => onNodeSelect?.(node.id)}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleNodeExpansion(node.id);
                            }}
                            className="p-0.5 hover:bg-[var(--bg-card)] rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown size={12} className="text-[var(--text-muted)]" />
                            ) : (
                              <ChevronRight size={12} className="text-[var(--text-muted)]" />
                            )}
                          </button>
                          {getNodeIcon(node.type, 12)}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                              {node.displayName || node.name}
                            </p>
                            {node.description && (
                              <p className="text-[10px] text-[var(--text-muted)] truncate">
                                {node.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {incoming.length + outgoing.length} connections
                            </span>
                            <div className="flex items-center gap-0.5 ml-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNodeAction?.(node.id, 'view');
                                }}
                                className="p-1 hover:bg-[var(--bg-card)] rounded"
                                title="View details"
                              >
                                <Eye size={10} className="text-[var(--text-muted)]" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNodeAction?.(node.id, 'query');
                                }}
                                className="p-1 hover:bg-[var(--bg-card)] rounded"
                                title="Query"
                              >
                                <Code size={10} className="text-[var(--text-muted)]" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded connections */}
                        {isExpanded && (incoming.length > 0 || outgoing.length > 0) && (
                          <div className="border-t border-[var(--border-color)] bg-[var(--bg-card)]/20 p-2">
                            {incoming.length > 0 && (
                              <div className="mb-2">
                                <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                                  Upstream
                                </p>
                                {incoming.map(({ edge, node: connectedNode }) => connectedNode && (
                                  <div key={edge.id} className="flex items-center gap-2 mb-1">
                                    {getNodeIcon(connectedNode.type, 10)}
                                    <span className="text-[10px] text-[var(--text-primary)]">
                                      {connectedNode.displayName || connectedNode.name}
                                    </span>
                                    <ArrowRight size={8} className="text-[var(--text-muted)]" />
                                    <span className="text-[9px] text-[var(--text-muted)]">
                                      {getEdgeDescription(edge.type)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {outgoing.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                                  Downstream
                                </p>
                                {outgoing.map(({ edge, node: connectedNode }) => connectedNode && (
                                  <div key={edge.id} className="flex items-center gap-2 mb-1">
                                    <span className="text-[9px] text-[var(--text-muted)]">
                                      {getEdgeDescription(edge.type)}
                                    </span>
                                    <ArrowRight size={8} className="text-[var(--text-muted)]" />
                                    {getNodeIcon(connectedNode.type, 10)}
                                    <span className="text-[10px] text-[var(--text-primary)]">
                                      {connectedNode.displayName || connectedNode.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Simple list layout
          <div className="space-y-2">
            {filteredNodes.map(node => {
              const isSelected = selectedNode === node.id;
              const { outgoing, incoming } = getConnectedNodes(node.id);

              return (
                <div
                  key={node.id}
                  className={cn(
                    "flex items-center gap-3 p-3 border border-[var(--border-color)] rounded-lg cursor-pointer transition-colors",
                    isSelected
                      ? "bg-accent-blue/10 border-accent-blue text-accent-blue"
                      : "hover:bg-[var(--bg-card-hover)]"
                  )}
                  onClick={() => onNodeSelect?.(node.id)}
                >
                  {getNodeIcon(node.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {node.displayName || node.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] capitalize">
                      {node.type.replace('_', ' ')} • {incoming.length + outgoing.length} connections
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNodeAction?.(node.id, 'view');
                      }}
                      className="p-2 hover:bg-[var(--bg-card)] rounded"
                      title="View details"
                    >
                      <Eye size={12} className="text-[var(--text-muted)]" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNodeAction?.(node.id, 'query');
                      }}
                      className="p-2 hover:bg-[var(--bg-card)] rounded"
                      title="Query"
                    >
                      <Code size={12} className="text-[var(--text-muted)]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};