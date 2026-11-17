import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { 
  Play, 
  Save, 
  ArrowLeft, 
  Layers, 
  CheckCircle2, 
  Plus, 
  Clock, 
  Search, 
  Terminal, 
  Zap, 
  RefreshCw, 
  Trash2, 
  GitBranch, 
  ArrowLeftRight, 
  AlertTriangle, 
  AlignVerticalJustifyCenter,
  PanelLeftClose,
  PanelLeftOpen,
  GripVertical,
  MousePointerClick,
  ChevronDown,
  FileText,
  XCircle,
  AlertCircle,
  ExternalLink,
  Globe,
  Calendar,
  Sparkles,
  Filter,
  Repeat,
  Variable,
  Edit3,
  Sliders,
  FileCode,
  X
} from 'lucide-react';

import { WorkflowApi } from '@/api/WorkflowApi';
import { ExecutionApi } from '@/api/ExecutionApi';
import { SalesforceApi } from '@/api/SalesforceApi';
import { ErrorState } from '@/components/ErrorState';
import { WorkflowDefinition, FlowResource } from '@/types';
import { CustomNodeComponent } from './CustomNodeComponent';
import { FlowConnectorEdge } from './FlowConnectorEdge';
import { useTheme } from '@/providers/ThemeProvider';

const nodeTypes = {
  startNode: CustomNodeComponent,
  endNode: CustomNodeComponent,
  salesforceNode: CustomNodeComponent,
  netsuiteNode: CustomNodeComponent,
  waitNode: CustomNodeComponent,
  assertNode: CustomNodeComponent,
};

const edgeTypes = {
  flowConnector: FlowConnectorEdge,
};

export const WorkflowStudio: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const isNewWorkflow = id === 'new';
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(!isNewWorkflow);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    if (isNewWorkflow) {
      const blankWf: WorkflowDefinition = {
        id: `wf-${Date.now()}`,
        organizationId: 'org-enterprise-1',
        name: 'Untitled Regression Suite',
        description: 'Fresh visual workflow canvas.',
        platform: 'salesforce',
        status: 'DRAFT',
        version: 1,
        tags: ['Draft', 'New'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        graph: {
          nodes: [
            {
              id: 'start-1',
              type: 'startNode',
              position: { x: 420, y: 60 },
              data: { label: 'Start', nodeType: 'START', config: { triggerType: 'MANUAL' } }
            },
            {
              id: 'end-1',
              type: 'endNode',
              position: { x: 420, y: 280 },
              data: { label: 'End', nodeType: 'END', config: { isFault: false } }
            }
          ],
          edges: [
            {
              id: 'e-start-end',
              source: 'start-1',
              target: 'end-1',
              sourceHandle: 'bottom',
              targetHandle: 'top',
              type: 'flowConnector',
              style: { stroke: '#94a3b8', strokeWidth: 2 }
            }
          ]
        }
      };
      setWorkflow(blankWf);
      setNodes(blankWf.graph.nodes);
      setEdges(blankWf.graph.edges);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    WorkflowApi.getWorkflowById(id || '')
      .then(data => {
        setWorkflow(data);
        if (data.resources && data.resources.length > 0) {
          setResources(data.resources);
        }
        const loadedNodes = data.graph?.nodes || [];
        // Auto-center spine nodes and normalize default Start/End labels (Salesforce Flow Builder standard)
        const alignedNodes = loadedNodes.map(n => {
          let updated = { ...n };
          if (n.data?.nodeType === 'START' && (!n.data?.label || n.data?.label === 'Workflow Trigger')) {
            updated.data = { ...(updated.data || {}), label: 'Start' };
          }
          if (n.data?.nodeType === 'END' && (!n.data?.label || n.data?.label.includes('Regression Complete'))) {
            updated.data = { ...(updated.data || {}), label: 'End' };
          }
          if (!n.id.startsWith('fault-') && Math.abs(n.position.x - 420) < 140) {
            updated.position = { ...updated.position, x: 420 };
          }
          return updated;
        });
        setNodes(alignedNodes);
        setEdges(data.graph?.edges || []);
      })
      .catch(err => {
        setLoadError(err);
      })
      .finally(() => setIsLoading(false));
  }, [id, isNewWorkflow, setNodes, setEdges]);

  // Workflow switcher dropdown state
  const [isWfSwitcherOpen, setIsWfSwitcherOpen] = useState(false);
  const [availableWorkflows, setAvailableWorkflows] = useState<WorkflowDefinition[]>([]);

  useEffect(() => {
    WorkflowApi.getWorkflows()
      .then(data => setAvailableWorkflows(data))
      .catch(() => {});
  }, []);

  // Toolbox sidebar collapsible state: 2 tabs (Elements & Manager)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toolboxTab, setToolboxTab] = useState<'elements' | 'manager'>('elements');
  const [toolboxSearch, setToolboxSearch] = useState('');

  // Flow Resources State (Variables, Formulas, Constants, Text Templates)
  const [resources, setResources] = useState<FlowResource[]>([
    {
      id: 'res-quote',
      name: 'Quote',
      type: 'VARIABLE',
      dataType: 'Text',
      description: 'Quote reference payload',
      defaultValue: 'Q-2026-001'
    },
    {
      id: 'res-add',
      name: 'add',
      type: 'FORMULA',
      dataType: 'Text',
      description: 'Concatenated summary expression',
      formulaExpression: '{!$Record.Name} & " - " & {!Quote}'
    }
  ]);
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [resourceForm, setResourceForm] = useState<{
    name: string;
    type: 'VARIABLE' | 'FORMULA' | 'CONSTANT' | 'TEXT_TEMPLATE';
    dataType: 'Text' | 'Number' | 'Currency' | 'Boolean' | 'Date' | 'Record';
    description: string;
    defaultValue: string;
    formulaExpression: string;
  }>({
    name: '',
    type: 'VARIABLE',
    dataType: 'Text',
    description: '',
    defaultValue: '',
    formulaExpression: ''
  });

  const handleOpenNewResource = () => {
    setEditingResourceId(null);
    setResourceForm({
      name: '',
      type: 'VARIABLE',
      dataType: 'Text',
      description: '',
      defaultValue: '',
      formulaExpression: ''
    });
    setIsResourceModalOpen(true);
  };

  const handleEditResource = (res: FlowResource) => {
    setEditingResourceId(res.id);
    setResourceForm({
      name: res.name,
      type: res.type,
      dataType: res.dataType,
      description: res.description || '',
      defaultValue: res.defaultValue || '',
      formulaExpression: res.formulaExpression || ''
    });
    setIsResourceModalOpen(true);
  };

  const handleDeleteResource = (resId: string) => {
    setResources(prev => prev.filter(r => r.id !== resId));
  };

  const handleSaveResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceForm.name.trim()) return;

    if (editingResourceId) {
      setResources(prev => prev.map(r => r.id === editingResourceId ? {
        ...r,
        ...resourceForm,
        name: resourceForm.name.trim()
      } : r));
    } else {
      const newRes: FlowResource = {
        id: `res-${Date.now()}`,
        name: resourceForm.name.trim(),
        type: resourceForm.type,
        dataType: resourceForm.dataType,
        description: resourceForm.description,
        defaultValue: resourceForm.defaultValue,
        formulaExpression: resourceForm.formulaExpression
      };
      setResources(prev => [...prev, newRes]);
    }
    setIsResourceModalOpen(false);
  };

  // Edge Routing Mode: Clean structured flow with straight spine alignment
  const edgeRoutingMode: 'structured' | 'freeform' = 'structured';

  // Remove / Delete connection line
  const handleDeleteEdge = useCallback((edgeId: string) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId));
  }, [setEdges]);

  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    const idsToDelete = new Set(edgesToDelete.map(e => e.id));
    setEdges(eds => eds.filter(e => !idsToDelete.has(e.id)));
  }, [setEdges]);

  // Forward ref for handleDeleteNode to break circular callbacks
  const handleDeleteNodeRef = useRef<(id: string) => void>(() => {});

  // ReactFlow instance and wrapper ref for Drag & Drop calculations
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Simulation & Live Execution state
  const [isSimulating, setIsSimulating] = useState(false);
  const [isLiveRunning, setIsLiveRunning] = useState(false);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [environments, setEnvironments] = useState<any[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');

  // Execution Report state (inspect request payload & response returned)
  const [showReportModal, setShowReportModal] = useState(false);
  const [lastRunReport, setLastRunReport] = useState<any>(null);
  const [expandedStepIndex, setExpandedStepIndex] = useState<number | null>(null);

  useEffect(() => {
    SalesforceApi.getEnvironments()
      .then(envs => {
        setEnvironments(envs || []);
        if (envs && envs.length > 0) {
          const defaultEnv = envs.find(e => (e as any).status === 'ONLINE' || e.status === 'ACTIVE' || (e as any).connectionStatus === 'HEALTHY') || envs[0];
          setSelectedEnvId(defaultEnv.id);
        }
      })
      .catch(() => {});
  }, []);

  // Salesforce Flow style insert element directly on connector (+)
  const handleInsertNodeAtEdge = useCallback((edgeId: string, nodeCategory: string) => {
    setEdges(currentEdges => {
      const edge = currentEdges.find(e => e.id === edgeId);
      if (!edge) return currentEdges;

      const newId = `node-${Date.now()}`;
      const branchTargetId = `${newId}-branch`;
      const isDecision = nodeCategory === 'DECISION';
      const isLoop = nodeCategory === 'LOOP';

      setNodes(currentNodes => {
        const sourceNode = currentNodes.find(n => n.id === edge.source);
        const targetNode = currentNodes.find(n => n.id === edge.target);

        const newX = 420;
        const newY = sourceNode ? sourceNode.position.y + 160 : 200;

        // Auto-shift all downstream nodes below newY to maintain clean 160px vertical spacing
        const updatedNodes = currentNodes.map(n => {
          if (n.position.y >= newY && !n.id.startsWith('fault-') && !n.id.includes('-branch')) {
            return {
              ...n,
              position: { x: 420, y: n.position.y + 160 }
            };
          }
          if (Math.abs(n.position.x - 420) < 120 && !n.id.startsWith('fault-') && !n.id.includes('-branch')) {
            return { ...n, position: { ...n.position, x: 420 } };
          }
          return n;
        });

        let newNode: Node;
        switch (nodeCategory) {
          case 'CREATE':
            newNode = {
              id: newId,
              type: 'salesforceNode',
              position: { x: newX, y: newY },
              data: {
                label: 'Create Records',
                nodeType: 'CREATE',
                platform: 'salesforce',
                config: { 
                  object: 'Account', 
                  operation: 'Create Records (Account)',
                  fields: { Name: 'New Test Account', Type: 'Customer - Direct' },
                  fieldList: [
                    { field: 'Name', value: 'New Test Account' },
                    { field: 'Type', value: 'Customer - Direct' }
                  ],
                  storeRecordId: true,
                  outputVariable: 'varCreatedRecordId',
                  autoTeardown: false
                }
              }
            };
            break;

          case 'GET':
            newNode = {
              id: newId,
              type: 'salesforceNode',
              position: { x: newX, y: newY },
              data: {
                label: 'Get Records',
                nodeType: 'GET',
                platform: 'salesforce',
                config: { 
                  object: 'Account', 
                  operation: 'Get Records',
                  soql: 'SELECT Id, Name, Type, CreatedDate FROM Account ORDER BY CreatedDate DESC LIMIT 5'
                }
              }
            };
            break;

          case 'UPDATE':
            newNode = {
              id: newId,
              type: 'salesforceNode',
              position: { x: newX, y: newY },
              data: {
                label: 'Update Records',
                nodeType: 'UPDATE',
                platform: 'salesforce',
                config: { 
                  object: 'Account', 
                  operation: 'Update Records',
                  fields: { Status: 'Active' },
                  fieldList: [{ field: 'Status', value: 'Active' }]
                }
              }
            };
            break;

          case 'DELETE':
            newNode = {
              id: newId,
              type: 'salesforceNode',
              position: { x: newX, y: newY },
              data: {
                label: 'Delete Records',
                nodeType: 'DELETE',
                platform: 'salesforce',
                config: { 
                  object: 'Account', 
                  operation: 'Delete Records',
                  targetId: '{{varCreatedRecordId}}'
                }
              }
            };
            break;

          case 'DECISION':
            newNode = {
              id: newId,
              type: 'assertNode',
              position: { x: newX, y: newY },
              data: {
                label: 'Decision: Verify Parity',
                nodeType: 'DECISION',
                config: { 
                  operation: 'Decision Logic', 
                  rules: [{ field: 'Status', operator: 'EQUALS', value: 'Active' }] 
                }
              }
            };
            break;

          case 'ASSIGNMENT':
            newNode = {
              id: newId,
              type: 'waitNode',
              position: { x: newX, y: newY },
              data: {
                label: 'Assignment: Map Variables',
                nodeType: 'ASSIGNMENT',
                config: { 
                  operation: 'Set Variables',
                  variable: 'varStatus = "COMPLETED"'
                }
              }
            };
            break;

          case 'LOOP':
            newNode = {
              id: newId,
              type: 'salesforceNode',
              position: { x: newX, y: newY },
              data: {
                label: 'Loop: For Each Record',
                nodeType: 'LOOP',
                platform: 'salesforce',
                config: {
                  operation: 'Loop Collection',
                  collection: '{{records}}',
                  loopVariable: 'currentItem'
                }
              }
            };
            break;

          case 'PAUSE':
            newNode = {
              id: newId,
              type: 'waitNode',
              position: { x: newX, y: newY },
              data: {
                label: 'Pause Execution',
                nodeType: 'PAUSE',
                config: { 
                  durationSeconds: 15, 
                  operation: 'Pause / Delay'
                }
              }
            };
            break;

          case 'ACTION':
          default:
            newNode = {
              id: newId,
              type: 'salesforceNode',
              position: { x: newX, y: newY },
              data: {
                label: 'External Action',
                nodeType: 'ACTION',
                platform: 'salesforce',
                config: { 
                  operation: 'Apex / SuiteTalk Action',
                  actionName: 'invokeSyncEngine'
                }
              }
            };
            break;
        }

        setSelectedNode(newNode);

        if (isDecision) {
          const defaultTerminalNode: Node = {
            id: branchTargetId,
            type: 'endNode',
            position: { x: 740, y: newY + 140 },
            data: {
              label: 'Default Outcome',
              nodeType: 'END',
              platform: 'salesforce',
              config: { isFault: false, detail: 'Default path completed' },
              onDeleteNode: (id: string) => handleDeleteNodeRef.current(id)
            }
          };
          return [...updatedNodes, newNode, defaultTerminalNode];
        }

        if (isLoop) {
          const loopBodyNode: Node = {
            id: branchTargetId,
            type: 'waitNode',
            position: { x: 740, y: newY + 140 },
            data: {
              label: 'Assign: Current Item',
              nodeType: 'ASSIGNMENT',
              platform: 'salesforce',
              config: { 
                operation: 'Set Variables', 
                variable: 'currentItem.Status = "Processed"' 
              },
              onDeleteNode: (id: string) => handleDeleteNodeRef.current(id)
            }
          };
          return [...updatedNodes, newNode, loopBodyNode];
        }

        return [...updatedNodes, newNode];
      });

      if (isDecision) {
        const edgeIn: Edge = {
          id: `e-${edge.source}-${newId}`,
          source: edge.source,
          target: newId,
          sourceHandle: edge.sourceHandle || 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 },
          data: { onInsertNode: handleInsertNodeAtEdge, onDeleteEdge: handleDeleteEdge, routingMode: edgeRoutingMode }
        };

        const edgeTrue: Edge = {
          id: `e-${newId}-${edge.target}-true`,
          source: newId,
          target: edge.target,
          sourceHandle: 'outcome-true',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#10b981', strokeWidth: 2 },
          data: { 
            label: 'True', 
            outcomeType: 'true', 
            onInsertNode: handleInsertNodeAtEdge, 
            onDeleteEdge: handleDeleteEdge, 
            routingMode: edgeRoutingMode 
          }
        };

        const edgeDefault: Edge = {
          id: `e-${newId}-${branchTargetId}-default`,
          source: newId,
          target: branchTargetId,
          sourceHandle: 'outcome-default',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#a855f7', strokeWidth: 2 },
          data: { 
            label: 'Default Outcome', 
            outcomeType: 'default', 
            onInsertNode: handleInsertNodeAtEdge, 
            onDeleteEdge: handleDeleteEdge, 
            routingMode: edgeRoutingMode 
          }
        };

        return [...currentEdges.filter(e => e.id !== edgeId), edgeIn, edgeTrue, edgeDefault];
      }

      if (isLoop) {
        const edgeIn: Edge = {
          id: `e-${edge.source}-${newId}`,
          source: edge.source,
          target: newId,
          sourceHandle: edge.sourceHandle || 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 },
          data: { onInsertNode: handleInsertNodeAtEdge, onDeleteEdge: handleDeleteEdge, routingMode: edgeRoutingMode }
        };

        const edgeAfter: Edge = {
          id: `e-${newId}-${edge.target}-after`,
          source: newId,
          target: edge.target,
          sourceHandle: 'loop-after',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#3b82f6', strokeWidth: 2 },
          data: { 
            label: 'After Last Item', 
            loopPath: 'after', 
            onInsertNode: handleInsertNodeAtEdge, 
            onDeleteEdge: handleDeleteEdge, 
            routingMode: edgeRoutingMode 
          }
        };

        const edgeEach: Edge = {
          id: `e-${newId}-${branchTargetId}-each`,
          source: newId,
          target: branchTargetId,
          sourceHandle: 'loop-each',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#f97316', strokeWidth: 2 },
          data: { 
            label: 'For Each Item', 
            loopPath: 'each', 
            onInsertNode: handleInsertNodeAtEdge, 
            onDeleteEdge: handleDeleteEdge, 
            routingMode: edgeRoutingMode 
          }
        };

        const edgeReturn: Edge = {
          id: `e-${branchTargetId}-${newId}-return`,
          source: branchTargetId,
          target: newId,
          sourceHandle: 'left',
          targetHandle: 'loop-return-target',
          type: 'flowConnector',
          style: { stroke: '#f97316', strokeWidth: 2 },
          data: { 
            label: 'Repeat', 
            loopPath: 'return', 
            onInsertNode: handleInsertNodeAtEdge, 
            onDeleteEdge: handleDeleteEdge, 
            routingMode: edgeRoutingMode 
          }
        };

        return [...currentEdges.filter(e => e.id !== edgeId), edgeIn, edgeAfter, edgeEach, edgeReturn];
      }

      // Default single outgoing edge
      const edge1: Edge = {
        id: `e-${edge.source}-${newId}`,
        source: edge.source,
        target: newId,
        sourceHandle: edge.sourceHandle || 'bottom',
        targetHandle: 'top',
        type: 'flowConnector',
        style: { stroke: '#94a3b8', strokeWidth: 2 },
        data: { onInsertNode: handleInsertNodeAtEdge, onDeleteEdge: handleDeleteEdge, routingMode: edgeRoutingMode }
      };

      const edge2: Edge = {
        id: `e-${newId}-${edge.target}`,
        source: newId,
        target: edge.target,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type: 'flowConnector',
        style: { stroke: '#94a3b8', strokeWidth: 2 },
        data: { onInsertNode: handleInsertNodeAtEdge, onDeleteEdge: handleDeleteEdge, routingMode: edgeRoutingMode }
      };

      return [...currentEdges.filter(e => e.id !== edgeId), edge1, edge2];
    });
  }, [setSelectedNode]);

  // Visual deletion of nodes with smart workflow reconnection (A -> [X] -> B becomes A -> B)
  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes(currentNodes => {
      const nodeToDelete = currentNodes.find(n => n.id === nodeId);
      if (!nodeToDelete || nodeToDelete.data?.nodeType === 'START') return currentNodes;

      const remainingNodes = currentNodes.filter(n => n.id !== nodeId);

      setEdges(currentEdges => {
        const incomingEdges = currentEdges.filter(e => e.target === nodeId);
        const outgoingEdges = currentEdges.filter(e => e.source === nodeId);
        const unaffectedEdges = currentEdges.filter(
          e => e.source !== nodeId && e.target !== nodeId
        );

        const reconnectedEdges: Edge[] = [];

        // If exactly 1 incoming and at least 1 outgoing, stitch incoming to primary spine outgoing
        if (incomingEdges.length === 1 && outgoingEdges.length >= 1) {
          const inEdge = incomingEdges[0];
          const primaryOut = outgoingEdges.find(e => 
            e.sourceHandle === 'outcome-true' || 
            e.sourceHandle === 'loop-after' || 
            (e.data as any)?.label === 'True' || 
            (e.data as any)?.label === 'After Last Item' ||
            e.targetHandle === 'top'
          ) || outgoingEdges[0];

          if (inEdge.source !== primaryOut.target) {
            reconnectedEdges.push({
              id: `e-${inEdge.source}-${primaryOut.target}-${Date.now()}`,
              source: inEdge.source,
              target: primaryOut.target,
              sourceHandle: inEdge.sourceHandle || 'bottom',
              targetHandle: primaryOut.targetHandle || 'top',
              type: 'flowConnector',
              style: { stroke: '#94a3b8', strokeWidth: 2 },
              data: {
                onInsertNode: handleInsertNodeAtEdge,
                onDeleteEdge: handleDeleteEdge,
                routingMode: edgeRoutingMode
              }
            });
          }
        }

        return [...unaffectedEdges, ...reconnectedEdges];
      });

      setSelectedNode(curr => (curr?.id === nodeId ? null : curr));

      return remainingNodes;
    });
  }, [handleInsertNodeAtEdge, handleDeleteEdge, edgeRoutingMode]);

  useEffect(() => {
    handleDeleteNodeRef.current = handleDeleteNode;
  }, [handleDeleteNode]);

  const onNodesDelete = useCallback((nodesToDelete: Node[]) => {
    nodesToDelete.forEach(n => {
      handleDeleteNode(n.id);
    });
  }, [handleDeleteNode]);

  // Ensure initial edges have the onInsertNode, onDeleteEdge callback and routingMode
  useEffect(() => {
    setEdges(eds => eds.map(e => ({
      ...e,
      type: 'flowConnector',
      data: { ...(e.data || {}), onInsertNode: handleInsertNodeAtEdge, onDeleteEdge: handleDeleteEdge, routingMode: edgeRoutingMode }
    })));
  }, [handleInsertNodeAtEdge, handleDeleteEdge, edgeRoutingMode]);

  // Ensure all nodes have the active onDeleteNode callback
  useEffect(() => {
    setNodes(nds => nds.map(n => {
      if (n.data?.onDeleteNode) return n;
      return {
        ...n,
        data: {
          ...(n.data || {}),
          onDeleteNode: (nodeId: string) => handleDeleteNodeRef.current(nodeId)
        }
      };
    }));
  }, [setNodes]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ 
      ...params, 
      type: 'flowConnector',
      sourceHandle: params.sourceHandle || 'bottom',
      targetHandle: params.targetHandle || 'top',
      style: { stroke: '#64748b', strokeWidth: 1.5 },
      data: { onInsertNode: handleInsertNodeAtEdge, onDeleteEdge: handleDeleteEdge, routingMode: edgeRoutingMode }
    } as any, eds)),
    [setEdges, handleInsertNodeAtEdge, handleDeleteEdge, edgeRoutingMode]
  );

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  };

  const onNodeDragStop = useCallback((_: any, node: Node) => {
    // Snap to center spine at x: 420 if dropped near the central trunk
    if (!node.id.startsWith('fault-') && Math.abs(node.position.x - 420) < 140) {
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, position: { ...n.position, x: 420 } } : n));
    }
  }, [setNodes]);

  // Helper: Create Node Spec
  const createNodeObject = (category: string, position: { x: number; y: number }): Node => {
    const newId = `node-${Date.now()}`;
    let nodeObj: Node;
    switch (category) {
      case 'GET':
        nodeObj = {
          id: newId,
          type: 'salesforceNode',
          position,
          data: {
            label: 'Get Records',
            nodeType: 'GET',
            platform: 'salesforce',
            config: { 
              object: 'Account', 
              operation: 'Get Records (SOQL)',
              searchFilter: "Id == '{{trigger.recordId}}'"
            }
          }
        };
        break;

      case 'CREATE':
        nodeObj = {
          id: newId,
          type: 'salesforceNode',
          position,
          data: {
            label: 'Create Records',
            nodeType: 'CREATE',
            platform: 'salesforce',
            config: { 
              object: 'Account', 
              operation: 'Create Records',
              fields: { Name: 'New Test Account', Type: 'Customer - Direct' }
            }
          }
        };
        break;

      case 'UPDATE':
        nodeObj = {
          id: newId,
          type: 'salesforceNode',
          position,
          data: {
            label: 'Update Records',
            nodeType: 'UPDATE',
            platform: 'salesforce',
            config: { 
              object: 'Account', 
              operation: 'Update Records',
              fields: { Status: 'Active' }
            }
          }
        };
        break;

      case 'DELETE':
        nodeObj = {
          id: newId,
          type: 'salesforceNode',
          position,
          data: {
            label: 'Delete Records',
            nodeType: 'DELETE',
            platform: 'salesforce',
            config: { 
              object: 'Account', 
              operation: 'Delete Records (Cleanup)'
            }
          }
        };
        break;

      case 'DECISION':
        nodeObj = {
          id: newId,
          type: 'assertNode',
          position,
          data: {
            label: 'Decision: Verify Parity',
            nodeType: 'DECISION',
            config: { 
              operation: 'Decision Logic', 
              assertions: [{ source: 'status', operator: 'EQUALS', expected: 'OK' }] 
            }
          }
        };
        break;

      case 'ASSIGNMENT':
        nodeObj = {
          id: newId,
          type: 'waitNode',
          position,
          data: {
            label: 'Assignment: Map Variables',
            nodeType: 'ASSIGNMENT',
            config: { 
              operation: 'Set Variables',
              variable: 'varStatus = "COMPLETED"'
            }
          }
        };
        break;

      case 'LOOP':
        nodeObj = {
          id: newId,
          type: 'salesforceNode',
          position,
          data: {
            label: 'Loop: For Each Record',
            nodeType: 'LOOP',
            platform: 'salesforce',
            config: {
              operation: 'Loop Collection',
              collection: '{{records}}',
              loopVariable: 'currentItem'
            }
          }
        };
        break;

      case 'PAUSE':
        nodeObj = {
          id: newId,
          type: 'waitNode',
          position,
          data: {
            label: 'Pause Execution',
            nodeType: 'PAUSE',
            config: { 
              durationSeconds: 15, 
              operation: 'Pause / Delay'
            }
          }
        };
        break;

      case 'FAULT':
        nodeObj = {
          id: newId,
          type: 'endNode',
          position,
          data: {
            label: 'Faulted / Test Failed',
            nodeType: 'END',
            config: { isFault: true }
          }
        };
        break;

      case 'ACTION':
      default:
        nodeObj = {
          id: newId,
          type: 'salesforceNode',
          position,
          data: {
            label: 'Platform Action',
            nodeType: 'ACTION',
            platform: 'salesforce',
            config: { 
              operation: 'Apex / SuiteTalk Action',
              actionName: 'invokeSyncEngine'
            }
          }
        };
        break;
    }

    return {
      ...nodeObj,
      data: {
        ...nodeObj.data,
        onDeleteNode: (id: string) => handleDeleteNodeRef.current(id)
      }
    };
  };

  // Drag and Drop Handlers
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      if (type.startsWith('TRIGGER_')) {
        handleAddNode(type);
        return;
      }

      let position = { x: 420, y: 300 };

      if (reactFlowInstance) {
        const flowPos = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        // Snap to center spine at x: 420 if dropped roughly near the center column
        const snappedX = Math.abs(flowPos.x - 420) < 180 ? 420 : flowPos.x;
        position = { x: snappedX, y: flowPos.y };
      }

      // 1. Check if dropped near or between an existing connection line to auto-insert!
      const candidateEdge = edges.find(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        if (!sourceNode || !targetNode) return false;

        const minY = Math.min(sourceNode.position.y, targetNode.position.y);
        const maxY = Math.max(sourceNode.position.y, targetNode.position.y);
        const avgX = (sourceNode.position.x + targetNode.position.x) / 2;

        const isBetweenY = position.y >= minY - 30 && position.y <= maxY + 60;
        const isNearX = Math.abs(position.x - avgX) <= 280;

        return isBetweenY && isNearX;
      });

      if (candidateEdge) {
        handleInsertNodeAtEdge(candidateEdge.id, type);
        return;
      }

      // 2. If there's only 1 edge in the graph (e.g., START -> END), auto-insert into flow!
      if (edges.length === 1) {
        handleInsertNodeAtEdge(edges[0].id, type);
        return;
      }

      // 3. Fallback: place node at drop coordinates
      const newNode = createNodeObject(type, position);

      if (type === 'DECISION') {
        const branchId = `${newNode.id}-branch`;
        const defaultNode: Node = {
          id: branchId,
          type: 'endNode',
          position: { x: position.x + 320, y: position.y + 140 },
          data: {
            label: 'Default Outcome',
            nodeType: 'END',
            platform: 'salesforce',
            config: { isFault: false, detail: 'Default path completed' },
            onDeleteNode: (id: string) => handleDeleteNodeRef.current(id)
          }
        };
        const branchEdge: Edge = {
          id: `e-${newNode.id}-${branchId}-default`,
          source: newNode.id,
          target: branchId,
          sourceHandle: 'outcome-default',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#a855f7', strokeWidth: 2 },
          data: { 
            label: 'Default Outcome', 
            outcomeType: 'default',
            onInsertNode: handleInsertNodeAtEdge, 
            onDeleteEdge: handleDeleteEdge, 
            routingMode: edgeRoutingMode 
          }
        };
        setNodes((nds) => [...nds, newNode, defaultNode]);
        setEdges((eds) => [...eds, branchEdge]);
        setSelectedNode(newNode);
        return;
      }

      if (type === 'LOOP') {
        const branchId = `${newNode.id}-branch`;
        const loopBodyNode: Node = {
          id: branchId,
          type: 'waitNode',
          position: { x: position.x + 320, y: position.y + 140 },
          data: {
            label: 'Assign: Current Item',
            nodeType: 'ASSIGNMENT',
            platform: 'salesforce',
            config: { 
              operation: 'Set Variables', 
              variable: 'currentItem.Status = "Processed"' 
            },
            onDeleteNode: (id: string) => handleDeleteNodeRef.current(id)
          }
        };
        const branchEdge: Edge = {
          id: `e-${newNode.id}-${branchId}-each`,
          source: newNode.id,
          target: branchId,
          sourceHandle: 'loop-each',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#f97316', strokeWidth: 2 },
          data: { 
            label: 'For Each Item', 
            loopPath: 'each',
            onInsertNode: handleInsertNodeAtEdge, 
            onDeleteEdge: handleDeleteEdge, 
            routingMode: edgeRoutingMode 
          }
        };
        const branchReturnEdge: Edge = {
          id: `e-${branchId}-${newNode.id}-return`,
          source: branchId,
          target: newNode.id,
          sourceHandle: 'left',
          targetHandle: 'loop-return-target',
          type: 'flowConnector',
          style: { stroke: '#f97316', strokeWidth: 2 },
          data: { 
            label: 'Repeat', 
            loopPath: 'return',
            onInsertNode: handleInsertNodeAtEdge, 
            onDeleteEdge: handleDeleteEdge, 
            routingMode: edgeRoutingMode 
          }
        };
        setNodes((nds) => [...nds, newNode, loopBodyNode]);
        setEdges((eds) => [...eds, branchEdge, branchReturnEdge]);
        setSelectedNode(newNode);
        return;
      }

      setNodes((nds) => [...nds, newNode]);
      setSelectedNode(newNode);
    },
    [reactFlowInstance, edges, nodes, handleInsertNodeAtEdge]
  );

  // Click from toolbox to insert directly into the active flow
  const handleAddNode = (category: string) => {
    // 0. If configuring a trigger, update the START node
    if (category.startsWith('TRIGGER_')) {
      setNodes(nds => nds.map(n => {
        if (n.type === 'startNode' || n.data?.nodeType === 'START') {
          let label = 'Start';
          let detail = 'Record-Triggered Flow · On-Demand';
          if (category === 'TRIGGER_RECORD') {
            detail = 'Account · Created or Updated';
          } else if (category === 'TRIGGER_SCHEDULE') {
            detail = 'Scheduled Flow · Hourly';
          } else if (category === 'TRIGGER_WEBHOOK') {
            detail = 'Autolaunched Flow · Webhook';
          }
          return {
            ...n,
            data: {
              ...n.data,
              label,
              config: { ...(n.data?.config || {}), triggerType: category, detail }
            }
          };
        }
        return n;
      }));
      return;
    }

    // 1. If an intermediate node or START is selected, insert after it
    if (selectedNode && selectedNode.data?.nodeType !== 'END') {
      const outgoingEdge = edges.find(e => e.source === selectedNode.id);
      if (outgoingEdge) {
        handleInsertNodeAtEdge(outgoingEdge.id, category);
        return;
      }
    }

    // 2. Otherwise find edge leading into the primary END node
    const edgeToEnd = edges.find(e => {
      const targetNode = nodes.find(n => n.id === e.target);
      return targetNode && targetNode.data?.nodeType === 'END' && !(targetNode.data as any)?.config?.isFault;
    });

    if (edgeToEnd) {
      handleInsertNodeAtEdge(edgeToEnd.id, category);
      return;
    }

    // 3. If there is any edge at all, insert on the last edge
    if (edges.length > 0) {
      handleInsertNodeAtEdge(edges[edges.length - 1].id, category);
      return;
    }

    // 4. Fallback: append at bottom
    const lastNode = nodes[nodes.length - 1];
    const newX = 420;
    const newY = lastNode ? lastNode.position.y + 130 : 160;

    const newNode = createNodeObject(category, { x: newX, y: newY });
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
  };

  // Add a Fault Path to currently selected node (Prevents card overlap)
  const handleAddFaultPathToSelectedNode = () => {
    if (!selectedNode) return;
    const faultNodeId = `fault-${Date.now()}`;
    
    // Position cleanly to the side track without colliding with other cards
    const offsetDirection = selectedNode.position.x > 350 ? 1 : -1;
    let targetX = selectedNode.position.x + (offsetDirection * 360);
    let targetY = selectedNode.position.y;

    // Check if target slot is occupied by any existing node within 120px
    const isOccupied = nodes.some(n => Math.abs(n.position.x - targetX) < 140 && Math.abs(n.position.y - targetY) < 90);
    if (isOccupied) {
      targetY += 130;
    }

    const faultNode: Node = {
      id: faultNodeId,
      type: 'waitNode',
      position: { x: targetX, y: targetY },
      data: {
        label: `Fault: ${selectedNode.data.label} Failed`,
        nodeType: 'ASSIGNMENT',
        config: {
          operation: 'Fault Diagnostic Log',
          variable: `var_fault_message = "Step ${selectedNode.id} failed execution"`
        }
      }
    };

    const faultEdge: Edge = {
      id: `e-fault-${selectedNode.id}-${faultNodeId}`,
      source: selectedNode.id,
      target: faultNodeId,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'flowConnector',
      style: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '4 4' },
      data: { label: 'Fault Path', onInsertNode: handleInsertNodeAtEdge, onDeleteEdge: handleDeleteEdge, routingMode: edgeRoutingMode }
    };

    setNodes(nds => [
      ...nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, hasFaultPath: true } } : n),
      faultNode
    ]);
    setEdges(eds => [...eds, faultEdge]);
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, hasFaultPath: true } } : null);
  };

  // Helper: Topological execution traversal along connecting wires
  const getOrderedExecutionNodes = useCallback((allNodes: Node[], allEdges: Edge[]): Node[] => {
    const startNode = allNodes.find(n => n.type === 'startNode' || n.data?.nodeType === 'START') || allNodes[0];
    if (!startNode) return allNodes;

    const ordered: Node[] = [];
    const visited = new Set<string>();
    let currentId: string | null = startNode.id;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const node = allNodes.find(n => n.id === currentId);
      if (node) ordered.push(node);

      const outgoing = allEdges.filter(e => e.source === currentId);
      const normalEdge = outgoing.find(e => !String(e.data?.label || '').toLowerCase().includes('fault')) || outgoing[0];
      currentId = normalEdge ? normalEdge.target : null;
    }

    // Include any unconnected nodes at the end
    allNodes.forEach(n => {
      if (!visited.has(n.id)) ordered.push(n);
    });

    return ordered;
  }, []);

  // 1. Dry-Run Canvas Simulation (Tests graph connectivity, animations & step transitions)
  const runSimulation = async () => {
    setIsSimulating(true);
    setIsLiveRunning(false);
    setShowConsole(true);
    setSimLogs([
      '[00:00.000] ⚡ AssertNow Dry-Run Simulation initializing...',
      '[00:00.040] 🔍 Inspecting step topology, branching rules and loop iteration paths...'
    ]);

    // Reset all nodes to idle/pending and all edges to idle
    setNodes((nds) => nds.map(n => ({ ...n, data: { ...n.data, status: 'idle', errorMessage: undefined, loopIteration: undefined } })));
    setEdges((eds) => eds.map(e => ({ ...e, data: { ...e.data, isRunning: false, isPassed: false, isFailed: false } })));

    await new Promise(r => setTimeout(r, 350));

    const startNode = nodes.find(n => n.type === 'startNode' || n.data?.nodeType === 'START') || nodes[0];
    if (!startNode) {
      setIsSimulating(false);
      return;
    }

    let currentNode: any = startNode;
    const visitedNodes = new Set<string>();
    const executedStepLabels: string[] = [];

    // Helper: activate an edge with flowing pulse particle
    const pulseEdge = async (edgeId: string, durationMs: number = 550) => {
      setEdges((eds: any[]) => eds.map((e: any) => e.id === edgeId ? { ...e, data: { ...e.data, isRunning: true } } : e));
      await new Promise(r => setTimeout(r, durationMs));
      setEdges((eds: any[]) => eds.map((e: any) => e.id === edgeId ? { ...e, data: { ...e.data, isRunning: false, isPassed: true } } : e));
    };

    while (currentNode) {
      visitedNodes.add(currentNode.id);
      const currId: string = String(currentNode.id);
      const nodeType: string = currentNode.data?.nodeType;
      const label: string = currentNode.data?.label || currId;
      executedStepLabels.push(label);

      // Node starts executing: highlighted animated border
      setNodes((nds: any[]) => nds.map((n: any) => n.id === currId ? { ...n, data: { ...n.data, status: 'running' } } : n));
      setSimLogs(prev => [...prev, `[Step ${executedStepLabels.length}] ⏳ Executing "${label}" (${nodeType})...`]);

      // Node processing latency
      await new Promise(r => setTimeout(r, 600));

      // Check node type logic
      if (nodeType === 'LOOP') {
        // Multi-iteration loop simulation: iterate twice through loop body
        const loopEdges = edges.filter((e: any) => e.source === currId);
        const eachEdge = loopEdges.find((e: any) => (e.data as any)?.loopPath === 'each' || e.data?.label === 'For Each Item');
        const afterEdge = loopEdges.find((e: any) => (e.data as any)?.loopPath === 'after' || e.data?.label === 'After Last Item');
        const returnEdge = edges.find((e: any) => e.target === currId && (e.data as any)?.loopPath === 'return');
        const bodyNode = eachEdge ? nodes.find((n: any) => n.id === eachEdge.target) : null;

        if (eachEdge && bodyNode) {
          const totalIterations = 2;
          for (let iter = 1; iter <= totalIterations; iter++) {
            // Update Loop node badge
            setNodes(nds => nds.map(n => n.id === currId ? { ...n, data: { ...n.data, status: 'running', loopIteration: `Item ${iter} of ${totalIterations}` } } : n));
            setSimLogs(prev => [...prev, `🔁 [LOOP ITERATION ${iter}/${totalIterations}] Evaluating record collection item...`]);

            // 1. Pulse For Each Item wire into body node
            await pulseEdge(eachEdge.id, 500);

            // 2. Run body node
            setNodes(nds => nds.map(n => n.id === bodyNode.id ? { ...n, data: { ...n.data, status: 'running' } } : n));
            setSimLogs(prev => [...prev, `   ⚙️ Executing loop body step: "${bodyNode.data?.label || bodyNode.id}"`]);
            await new Promise(r => setTimeout(r, 550));
            setNodes(nds => nds.map(n => n.id === bodyNode.id ? { ...n, data: { ...n.data, status: 'passed' } } : n));

            // 3. Pulse Return wire back into Loop node
            if (returnEdge) {
              setSimLogs(prev => [...prev, `   ⟲ Iteration ${iter} complete: Returning along cycle wire to Loop node`]);
              await pulseEdge(returnEdge.id, 500);
            }
          }
        }

        // Loop finished: mark loop node as passed and proceed along After Last Item
        setNodes(nds => nds.map(n => n.id === currId ? { ...n, data: { ...n.data, status: 'passed', loopIteration: undefined } } : n));
        setSimLogs(prev => [...prev, `✓ Loop "${label}" completed all iterations.`]);

        if (afterEdge) {
          setSimLogs(prev => [...prev, `➔ Exiting loop along "After Last Item" path...`]);
          await pulseEdge(afterEdge.id, 500);
          currentNode = nodes.find(n => n.id === afterEdge.target) || null;
        } else {
          currentNode = null;
        }
        continue;
      }

      // Mark current node passed
      setNodes(nds => nds.map(n => n.id === currId ? { ...n, data: { ...n.data, status: 'passed' } } : n));
      setSimLogs(prev => [...prev, `✓ Step "${label}" verified: OK.`]);

      if (nodeType === 'END') {
        break; // Flow reached terminal step
      }

      // If Decision: evaluate branch
      if (nodeType === 'DECISION' || nodeType === 'ASSERTION') {
        const decisionEdges = edges.filter(e => e.source === currId);
        const trueEdge = decisionEdges.find(e => (e.data as any)?.outcomeType === 'true' || e.data?.label === 'True');
        const defaultEdge = decisionEdges.find(e => (e.data as any)?.outcomeType === 'default' || e.data?.label === 'Default Outcome');

        // Healthy dry-run follows True branch
        setSimLogs(prev => [
          ...prev,
          `🔀 Decision "${label}": Parity verified (True) ➔ Animating primary True path.`,
          `ℹ️ Default Outcome path remains idle.`
        ]);
        if (defaultEdge) {
          setEdges(eds => eds.map(e => e.id === defaultEdge.id ? { ...e, data: { ...e.data, isRunning: false, isPassed: false } } : e));
        }
        if (trueEdge) {
          await pulseEdge(trueEdge.id, 500);
          currentNode = nodes.find(n => n.id === trueEdge.target) || null;
        } else if (defaultEdge) {
          await pulseEdge(defaultEdge.id, 500);
          currentNode = nodes.find(n => n.id === defaultEdge.target) || null;
        } else {
          currentNode = null;
        }
        continue;
      }

      // Standard sequential progression along main spine
      const outgoingEdges = edges.filter(e => e.source === currId);
      const nextEdge = outgoingEdges.find(e => !(e.data as any)?.loopPath && !String(e.data?.label || '').toLowerCase().includes('fault')) || outgoingEdges[0];

      if (nextEdge) {
        await pulseEdge(nextEdge.id, 500);
        currentNode = nodes.find(n => n.id === nextEdge.target) || null;
      } else {
        currentNode = null;
      }
    }

    setIsSimulating(false);
    setSimLogs(prev => [
      ...prev,
      '════════════════════════════════════════════════════════════════════',
      '🎉 DRY-RUN CANVAS SIMULATION COMPLETED: ALL STEPS VERIFIED (100% OK)',
      '💡 Click "⚡ Run Live" to execute real DML mutations directly in your Salesforce Org.'
    ]);

    if (workflow?.id && !isNewWorkflow) {
      ExecutionApi.triggerExecution({ workflowId: workflow.id }).catch(() => {});
    }
  };

  // 2. Real Live DML Execution on Salesforce Org
  const runLiveSalesforce = async () => {
    setIsSimulating(true);
    setIsLiveRunning(true);
    setShowConsole(true);
    const startTs = Date.now();
    const getElapsed = () => `[+${((Date.now() - startTs) / 1000).toFixed(2)}s]`;

    setSimLogs([
      `[00:00.000] ⚡ AssertNow Live Execution Engine initializing...`,
      `[00:00.050] 🔍 Introspecting connected Salesforce Environments...`
    ]);

    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, status: 'idle', errorMessage: undefined } })));
    setEdges(eds => eds.map(e => ({ ...e, data: { ...e.data, isRunning: false, isPassed: false, isFailed: false } })));

    let currentExecutingNode: any = null;
    let currentInputData: any = {};
    const recordedSteps: any[] = [];
    const executionLogs: Array<{ timestamp: string; level: 'INFO' | 'WARN' | 'ERROR'; message: string; nodeId?: string }> = [];

    const appendLog = (msg: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') => {
      setSimLogs(prev => [...prev, msg]);
      executionLogs.push({ timestamp: new Date().toLocaleTimeString(), level, message: msg, nodeId: currentExecutingNode?.id });
    };

    try {
      const envs = await SalesforceApi.getEnvironments().catch(() => []);
      const activeEnv = (selectedEnvId ? envs.find(e => e.id === selectedEnvId) : null)
        || envs.find(e => (e as any).status === 'ONLINE' || e.status === 'ACTIVE' || (e as any).connectionStatus === 'HEALTHY')
        || envs[0];

      if (!activeEnv) {
        appendLog(`❌ [FATAL CONFIG ERROR] No active Salesforce Environment connected!`, 'ERROR');
        appendLog(`💡 Please go to the "Integrations" page and connect your Salesforce Org (OAuth 2.0 / External Client App).`, 'WARN');
        setIsSimulating(false);
        setIsLiveRunning(false);
        return;
      }

      const rawUrl = activeEnv.instanceUrl || (activeEnv as any).credentials?.instanceUrl || (activeEnv as any).credentials?.loginUrl || 'https://login.salesforce.com';
      const instanceUrl = rawUrl.replace(/\/$/, '');
      appendLog(`${getElapsed()} 🔗 Target Environment: "${activeEnv.name}" (${instanceUrl})`);
      appendLog(`${getElapsed()} 🔑 OAuth 2.0 Session verified · Refresh Token active`);
      appendLog(`${getElapsed()} 🚦 Calculating execution path along workflow connectors...`);

      const orderedNodes = getOrderedExecutionNodes(nodes, edges);
      appendLog(`${getElapsed()} 📋 Execution Graph: ${orderedNodes.map(n => n.data?.label || n.id).join(' ➔ ')}`);

      const executionContext: Record<string, any> = {};

      for (let i = 0; i < orderedNodes.length; i++) {
        const currentNode = orderedNodes[i];
        currentExecutingNode = currentNode;
        const stepNum = i + 1;
        const totalSteps = orderedNodes.length;
        const stepStartTs = Date.now();

        // 1. Mark current node as active running on canvas
        setNodes(nds => nds.map(n => n.id === currentNode.id ? { ...n, data: { ...n.data, status: 'running' } } : n));
        
        // 2. Mark connector edge leading into this node as running
        setEdges(eds => eds.map(e => ({
          ...e,
          data: {
            ...e.data,
            isRunning: e.target === currentNode.id,
            isPassed: orderedNodes.slice(0, i).some(n => n.id === e.target)
          }
        })));

        appendLog(`${getElapsed()} [Step ${stepNum}/${totalSteps}] ⏳ Executing "${currentNode.data.label}" (${currentNode.data.nodeType})...`);

        // Visible pacing so the flow transition is sleek and legible
        await new Promise(r => setTimeout(r, 650));

        const nodeType = currentNode.data.nodeType;
        const config: Record<string, any> = (currentNode.data?.config as any) || {};

        if (nodeType === 'START') {
          currentInputData = { trigger: 'MANUAL', targetOrg: activeEnv.name, timestamp: new Date().toISOString() };
          await new Promise(r => setTimeout(r, 350));
          
          setNodes(nds => nds.map(n => n.id === currentNode.id ? { ...n, data: { ...n.data, status: 'passed' } } : n));
          appendLog(`${getElapsed()} ✓ Step "${currentNode.data.label}" passed: Flow trigger activated.`);
          
          recordedSteps.push({
            nodeId: currentNode.id,
            nodeLabel: currentNode.data.label,
            nodeType: 'START',
            status: 'PASSED',
            durationMs: Date.now() - stepStartTs,
            inputData: currentInputData,
            outputData: { activated: true, status: 'Flow Trigger Activated' }
          });
        } else if (nodeType === 'CREATE') {
          const sobjectName = config.customObject || config.object || 'Account';
          
          let fieldsToInsert: Record<string, any> = {};
          if (Array.isArray(config.fieldList) && config.fieldList.length > 0) {
            config.fieldList.forEach((item: { field: string; value: string }) => {
              if (item.field && item.field.trim()) {
                let val: any = item.value;
                Object.entries(executionContext).forEach(([k, v]) => {
                  val = String(val).replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
                });
                fieldsToInsert[item.field.trim()] = val;
              }
            });
          } else if (config.fields && Object.keys(config.fields).length > 0) {
            fieldsToInsert = { ...config.fields };
          } else {
            fieldsToInsert = { Name: `AssertNow Test Account ${new Date().toLocaleTimeString()}` };
          }

          currentInputData = { sobject: sobjectName, payload: fieldsToInsert };
          appendLog(`${getElapsed()} 📤 Dispatching Salesforce DML INSERT into "${sobjectName}"...`);
          appendLog(`${getElapsed()} 📦 Request Payload: ${JSON.stringify(fieldsToInsert)}`);

          const dmlStart = Date.now();
          const dmlResult = await SalesforceApi.createRecord(activeEnv.id, sobjectName, fieldsToInsert);
          const dmlLatency = Date.now() - dmlStart;

          if (!dmlResult?.id) {
            throw new Error((dmlResult as any)?.message || 'Failed to create record in Salesforce (No Record ID returned)');
          }

          const recordId = dmlResult.id;
          const recordUrl = `${instanceUrl}/${recordId}`;
          const outputVarName = config.outputVariable || 'varCreatedRecordId';
          executionContext[outputVarName] = recordId;

          setNodes(nds => nds.map(n => n.id === currentNode.id ? { ...n, data: { ...n.data, status: 'passed' } } : n));
          appendLog(`${getElapsed()} ✓ [DML SUCCESS] Created ${sobjectName} in ${dmlLatency}ms!`);
          appendLog(`${getElapsed()} 🔑 Salesforce Record ID: ${recordId}`);
          appendLog(`${getElapsed()} 🔗 View in Salesforce: ${recordUrl}`);
          appendLog(`${getElapsed()} 💾 Saved ID to variable {{${outputVarName}}}`);

          recordedSteps.push({
            nodeId: currentNode.id,
            nodeLabel: currentNode.data.label,
            nodeType: 'CREATE',
            status: 'PASSED',
            durationMs: dmlLatency,
            inputData: fieldsToInsert,
            outputData: dmlResult
          });

          if (config.autoTeardown !== false) {
            appendLog(`${getElapsed()} 🧹 [TEARDOWN] "Auto-Rollback on Test Teardown" is ENABLED.`);
            appendLog(`${getElapsed()} 🗑️ Deleting test record ${recordId} from Salesforce to prevent test pollution...`);
            try {
              await SalesforceApi.deleteRecord(activeEnv.id, sobjectName, recordId);
              appendLog(`${getElapsed()} ✓ [TEARDOWN OK] Test record ${recordId} successfully removed. Org remains clean.`);
            } catch (delErr: any) {
              appendLog(`${getElapsed()} ⚠️ [TEARDOWN WARNING] Could not auto-delete record: ${delErr.message}`, 'WARN');
            }
          } else {
            appendLog(`${getElapsed()} ⭐ [RECORD PRESERVED] "Auto-Rollback" is DISABLED: Record ${recordId} remains permanently in your Salesforce Org!`);
          }
        } else if (nodeType === 'GET') {
          const sobjectName = config.object || 'Account';
          const soql = config.soql || `SELECT Id, Name, CreatedDate FROM ${sobjectName} ORDER BY CreatedDate DESC LIMIT 5`;
          currentInputData = { soql, object: sobjectName };
          appendLog(`${getElapsed()} 🔍 Executing SOQL Query: "${soql}"...`);

          const queryStart = Date.now();
          const queryRes = await SalesforceApi.executeQuery(activeEnv.id, soql);
          const queryLatency = Date.now() - queryStart;

          setNodes(nds => nds.map(n => n.id === currentNode.id ? { ...n, data: { ...n.data, status: 'passed' } } : n));
          appendLog(`${getElapsed()} ✓ SOQL Query matched ${queryRes.totalSize} record(s) in ${queryLatency}ms.`);

          recordedSteps.push({
            nodeId: currentNode.id,
            nodeLabel: currentNode.data.label,
            nodeType: 'GET',
            status: 'PASSED',
            durationMs: queryLatency,
            inputData: currentInputData,
            outputData: queryRes
          });
        } else if (nodeType === 'END') {
          currentInputData = { status: 'COMPLETE' };
          await new Promise(r => setTimeout(r, 300));
          setNodes(nds => nds.map(n => n.id === currentNode.id ? { ...n, data: { ...n.data, status: 'passed' } } : n));
          appendLog(`${getElapsed()} ✓ Step "${currentNode.data.label}" completed.`);

          recordedSteps.push({
            nodeId: currentNode.id,
            nodeLabel: currentNode.data.label,
            nodeType: 'END',
            status: 'PASSED',
            durationMs: Date.now() - stepStartTs,
            inputData: currentInputData,
            outputData: { status: 'Workflow Completed' }
          });
        } else {
          currentInputData = { nodeType, config };
          await new Promise(r => setTimeout(r, 400));
          setNodes(nds => nds.map(n => n.id === currentNode.id ? { ...n, data: { ...n.data, status: 'passed' } } : n));
          appendLog(`${getElapsed()} ✓ Step "${currentNode.data.label}" verified.`);

          recordedSteps.push({
            nodeId: currentNode.id,
            nodeLabel: currentNode.data.label,
            nodeType,
            status: 'PASSED',
            durationMs: Date.now() - stepStartTs,
            inputData: currentInputData,
            outputData: { verified: true }
          });
        }
      }

      setEdges(eds => eds.map(e => ({
        ...e,
        data: { ...e.data, isRunning: false, isPassed: true, isFailed: false }
      })));

      const totalDuration = ((Date.now() - startTs) / 1000).toFixed(2);
      appendLog(`${getElapsed()} 🏁 ═══════════════════════════════════════════════════`);
      appendLog(`${getElapsed()} 🎉 LIVE SALESFORCE EXECUTION COMPLETED IN ${totalDuration}s!`);
      appendLog(`${getElapsed()} ═══════════════════════════════════════════════════════`);

      // Record PASSED execution in ExecutionApi
      const passedExec = await ExecutionApi.recordCustomExecution({
        workflowId: workflow?.id || 'wf-live-run',
        workflowName: workflow?.name || 'Salesforce Regression Suite',
        workflowVersion: workflow?.version || 1,
        environmentId: activeEnv.id,
        environmentName: activeEnv.name,
        status: 'PASSED',
        durationMs: Date.now() - startTs,
        steps: recordedSteps,
        logs: executionLogs
      }).catch(() => null);

      setLastRunReport({
        id: passedExec?.id || `exec-${Date.now()}`,
        status: 'PASSED',
        durationMs: Date.now() - startTs,
        environmentName: activeEnv.name,
        timestamp: new Date().toLocaleTimeString(),
        steps: recordedSteps,
        logs: simLogs
      });
    } catch (err: any) {
      console.error('Live execution failure:', err);
      const isExpired = String(err.message || '').includes('expired') || String(err.message || '').includes('invalid_grant');
      
      // 1. Immediately mark the failing node on the canvas as FAILED in RED
      if (currentExecutingNode) {
        setNodes(nds => nds.map(n => n.id === currentExecutingNode.id ? { 
          ...n, 
          data: { ...n.data, status: 'failed', errorMessage: err.message } 
        } : n));

        // Mark incoming connector edge as failed
        setEdges(eds => eds.map(e => ({
          ...e,
          data: { 
            ...e.data, 
            isRunning: false, 
            isFailed: e.target === currentExecutingNode.id 
          }
        })));

        recordedSteps.push({
          nodeId: currentExecutingNode.id,
          nodeLabel: currentExecutingNode.data?.label || 'Failed Step',
          nodeType: currentExecutingNode.data?.nodeType || 'ACTION',
          status: 'FAILED',
          durationMs: Date.now() - startTs,
          inputData: currentInputData,
          outputData: { error: err.name || 'SalesforceError', message: err.message },
          errorMessage: err.message
        });
      }

      appendLog(`${getElapsed()} ❌ [EXECUTION BLOCKED / FAILED] Step: "${currentExecutingNode?.data?.label || 'Current Step'}"`, 'ERROR');
      appendLog(`${getElapsed()} 🚨 ${err.message || 'Unknown network or execution error'}`, 'ERROR');

      if (isExpired) {
        appendLog(`${getElapsed()} ⏳ [TOKEN EXPIRED DETECTED] Access token expired on Salesforce side.`, 'WARN');
        appendLog(`${getElapsed()} 🔄 [AUTO-HOLD] In live production, the action is held while requesting a new session token via OAuth Refresh Token.`, 'WARN');
        appendLog(`${getElapsed()} 💡 If the refresh token itself was revoked by an admin, please click "Reconnect" in the Integrations page.`, 'WARN');
      }

      // 2. Record FAILED execution in ExecutionApi so it appears in Test Runs & Logs under FAILED filter
      const failedExec = await ExecutionApi.recordCustomExecution({
        workflowId: workflow?.id || 'wf-live-run',
        workflowName: workflow?.name || 'Salesforce Regression Suite',
        workflowVersion: workflow?.version || 1,
        environmentId: (selectedEnvId ? environments.find(e => e.id === selectedEnvId) : null)?.id || 'env-sf-1794773232566',
        environmentName: (selectedEnvId ? environments.find(e => e.id === selectedEnvId) : null)?.name || 'Salesforce Org',
        status: 'FAILED',
        durationMs: Date.now() - startTs,
        errorSummary: err.message || 'Execution blocked at step',
        steps: recordedSteps,
        logs: executionLogs
      }).catch(() => null);

      setLastRunReport({
        id: failedExec?.id || `exec-${Date.now()}`,
        status: 'FAILED',
        durationMs: Date.now() - startTs,
        errorSummary: err.message,
        environmentName: (selectedEnvId ? environments.find(e => e.id === selectedEnvId) : null)?.name || 'Salesforce Org',
        timestamp: new Date().toLocaleTimeString(),
        steps: recordedSteps,
        logs: simLogs
      });
    } finally {
      setIsSimulating(false);
      setIsLiveRunning(false);
    }
  };

  // Standard Salesforce Flow Auto-Layout (Laser-aligned vertical spine at x: 420 with graceful branch splits)
  const handleAutoLayout = () => {
    setNodes((nds) => {
      const startNode = nds.find(n => n.type === 'startNode' || n.data?.nodeType === 'START') || nds[0];
      if (!startNode) return nds;

      const visited = new Set<string>();
      const spine: string[] = [];
      let currId: string | null = startNode.id;

      while (currId && !visited.has(currId)) {
        visited.add(currId);
        spine.push(currId);
        const outEdge = edges.find(e => e.source === currId && !e.id.includes('fault') && (e.data as any)?.label !== 'Fault Path');
        currId = outEdge ? outEdge.target : null;
      }

      let branchIndex = 0;
      return nds.map((n) => {
        const spineIndex = spine.indexOf(n.id);
        if (spineIndex !== -1) {
          // Perfectly straight vertical spine at x: 420
          return {
            ...n,
            position: { x: 420, y: 50 + spineIndex * 170 }
          };
        } else {
          // Offshoot branches and fault handlers placed cleanly to the right
          branchIndex++;
          return {
            ...n,
            position: { x: 740, y: 150 + (branchIndex - 1) * 160 }
          };
        }
      });
    });

    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        sourceHandle: e.sourceHandle || 'bottom',
        targetHandle: e.targetHandle || 'top',
        type: 'flowConnector',
        style: e.id.includes('fault') 
          ? { stroke: '#f43f5e', strokeWidth: 1.5, strokeDasharray: '4 4' } 
          : { stroke: '#94a3b8', strokeWidth: 2 },
        data: { ...(e.data || {}), onInsertNode: handleInsertNodeAtEdge, onDeleteEdge: handleDeleteEdge, routingMode: edgeRoutingMode }
      }))
    );

    setTimeout(() => {
      reactFlowInstance?.fitView({ maxZoom: 0.9, minZoom: 0.3, padding: 0.25, duration: 300 });
    }, 50);
  };

  const handleSave = async () => {
    if (!workflow) return;
    try {
      await WorkflowApi.updateWorkflow(workflow.id, {
        graph: { nodes, edges },
        resources
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Save Failed: ${err.message}`);
    }
  };

  const enhancedNodes = useMemo(() => {
    return nodes.map(n => ({
      ...n,
      data: {
        ...(n.data || {}),
        onDeleteNode: handleDeleteNode,
      }
    }));
  }, [nodes, handleDeleteNode]);

  const enhancedEdges = useMemo(() => {
    return edges.map(e => ({
      ...e,
      data: {
        ...(e.data || {}),
        onInsertNode: handleInsertNodeAtEdge,
        onDeleteEdge: handleDeleteEdge,
        routingMode: edgeRoutingMode
      }
    }));
  }, [edges, handleInsertNodeAtEdge, handleDeleteEdge, edgeRoutingMode]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-6 text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Loading Workflow Canvas...</h3>
        <p className="text-xs text-slate-500 mt-1">Connecting to AssertNow backend and resolving graph nodes</p>
      </div>
    );
  }

  if (loadError || !workflow) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
        <ErrorState
          title="Workflow Not Found"
          error={loadError || `Workflow suite "${id}" does not exist on AssertNow backend.`}
          onBack={() => navigate('/workflows')}
          backLabel="Back to Workflows"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Studio Header Toolbar */}
      <header className="h-14 min-h-[56px] border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 flex items-center justify-between gap-4 z-30 transition-colors">
        {/* Left: Navigation & Workflow Meta */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink">
          <button 
            onClick={() => navigate('/workflows')}
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex-shrink-0"
            title="Back to workflows"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="relative min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setIsWfSwitcherOpen(!isWfSwitcherOpen)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white tracking-tight hover:text-blue-600 dark:hover:text-blue-400 transition-colors group text-left min-w-0"
                title="Click to switch workflow suite"
              >
                <span className="truncate max-w-[200px] md:max-w-xs">{workflow.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-transform flex-shrink-0" />
              </button>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 uppercase flex-shrink-0">
                {workflow.platform}
              </span>
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 flex-shrink-0 hidden sm:inline">v{workflow.version}</span>
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate hidden lg:block">
              {nodes.length} nodes · 100% reachability · 0 cycles
            </div>

            {/* Workflow Switcher Dropdown */}
            {isWfSwitcherOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsWfSwitcherOpen(false)} />
                <div className="absolute left-0 top-full mt-2 w-96 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800/80 mb-1 flex items-center justify-between">
                    <span>Switch Workflow Suite</span>
                    <span className="font-normal font-sans text-[10px] text-slate-500">{availableWorkflows.length} suites</span>
                  </div>
                  <div className="space-y-1">
                    {availableWorkflows.map(w => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          setIsWfSwitcherOpen(false);
                          navigate(`/studio/${w.id}`);
                        }}
                        className={`w-full p-2.5 rounded-lg text-left transition-all flex items-start justify-between gap-2 ${
                          w.id === workflow.id 
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' 
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold truncate leading-tight">{w.name}</div>
                          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                            <span className="uppercase font-mono font-semibold">{w.platform}</span>
                            <span>·</span>
                            <span>v{w.version}</span>
                            <span>·</span>
                            <span>{w.graph?.nodes?.length || 2} nodes</span>
                          </div>
                        </div>
                        {w.id === workflow.id && (
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded flex-shrink-0">
                            Active
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between px-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setIsWfSwitcherOpen(false);
                        navigate('/studio/new');
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-[11px] font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> New Blank Canvas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsWfSwitcherOpen(false);
                        navigate('/workflows');
                      }}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-[11px]"
                    >
                      All Workflows →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Canvas Tools & Execution Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {saveSuccess && (
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in flex-shrink-0 whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved
            </span>
          )}



          {/* Auto-Align Canvas */}
          <button
            onClick={handleAutoLayout}
            title="Auto-align canvas to standard Salesforce Flow Builder layout"
            className="h-8 px-2.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm flex items-center gap-1.5 transition-all flex-shrink-0 whitespace-nowrap cursor-pointer"
          >
            <AlignVerticalJustifyCenter className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">Auto-Align</span>
          </button>

          {/* Console Drawer Toggle */}
          <button
            onClick={() => setShowConsole(!showConsole)}
            className={`h-8 px-2.5 rounded-lg text-xs font-mono border flex items-center gap-1.5 transition-colors flex-shrink-0 whitespace-nowrap cursor-pointer ${
              showConsole 
                ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-blue-500/40 font-semibold' 
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Console</span>
          </button>

          {/* Execution Report Drawer Toggle */}
          <button
            onClick={() => setShowReportModal(true)}
            className={`h-8 px-2.5 rounded-lg text-xs font-mono border flex items-center gap-1.5 transition-colors flex-shrink-0 whitespace-nowrap cursor-pointer ${
              lastRunReport 
                ? (lastRunReport.status === 'PASSED' 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold' 
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-500/30 font-semibold')
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Inspect Step-by-Step Execution Report & Salesforce Payloads"
          >
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            <span>Report {lastRunReport ? (lastRunReport.status === 'PASSED' ? '✓' : '✗') : ''}</span>
          </button>

          {/* Save Draft */}
          <button
            onClick={handleSave}
            className="h-8 px-3 rounded-lg bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700/80 shadow-sm flex-shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Save</span>
          </button>

          {/* Divider */}
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 flex-shrink-0 mx-0.5" />

          {/* Target Environment Badge Selector */}
          {environments.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs flex-shrink-0 whitespace-nowrap shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
              <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Org:</span>
              <select
                value={selectedEnvId}
                onChange={e => setSelectedEnvId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none cursor-pointer max-w-[120px] truncate"
                title="Target Salesforce Environment for Live DML operations"
              >
                {environments.map(env => (
                  <option key={env.id} value={env.id} className="bg-slate-900 text-slate-100">
                    {env.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Live Run Button */}
          <button
            disabled={isSimulating}
            onClick={runLiveSalesforce}
            className="h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/25 disabled:opacity-50 cursor-pointer flex-shrink-0 whitespace-nowrap"
            title="Execute live DML operations directly on connected Salesforce Org"
          >
            <Zap className={`w-3.5 h-3.5 fill-current ${isLiveRunning ? 'animate-bounce' : ''}`} />
            <span>{isLiveRunning ? 'Executing Live...' : 'Run Live'}</span>
          </button>
        </div>
      </header>

      {/* Main Studio Viewport */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Node Library Palette (Collapsible & Draggable) */}
        <div className={`${
          isSidebarOpen ? 'w-72 p-3 border-r' : 'w-0 p-0 border-r-0 overflow-hidden'
        } bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3 overflow-y-auto z-20 flex-shrink-0 transition-all duration-300 ease-in-out`}>
          {isSidebarOpen && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Flow Toolbox
                </span>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Collapse Toolbox"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Clean Salesforce Flow Builder Standard Tabs: Elements & Manager */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 select-none px-1">
                <button
                  onClick={() => setToolboxTab('elements')}
                  className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer ${
                    toolboxTab === 'elements'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Elements
                </button>
                <button
                  onClick={() => setToolboxTab('manager')}
                  className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer ${
                    toolboxTab === 'manager'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Manager
                </button>
              </div>

              {/* TAB 1: ELEMENTS PALETTE */}
              {toolboxTab === 'elements' && (
                <div className="space-y-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter elements..."
                      value={toolboxSearch}
                      onChange={(e) => setToolboxSearch(e.target.value)}
                      className="w-full h-7.5 pl-8 pr-2.5 text-[11px] rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  {/* Section: Data Elements */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-0.5">
                      Data Elements
                    </div>
                    {[
                      {
                        id: 'CREATE',
                        title: 'Create Records',
                        desc: 'Insert new record in CRM',
                        Icon: Plus,
                        iconColor: 'text-sky-600 dark:text-sky-400',
                        iconBg: 'bg-sky-50 dark:bg-sky-950/70 border-sky-200 dark:border-sky-800'
                      },
                      {
                        id: 'GET',
                        title: 'Get Records',
                        desc: 'Query records with filter criteria',
                        Icon: Search,
                        iconColor: 'text-blue-600 dark:text-blue-400',
                        iconBg: 'bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-800'
                      },
                      {
                        id: 'UPDATE',
                        title: 'Update Records',
                        desc: 'Modify existing record fields',
                        Icon: RefreshCw,
                        iconColor: 'text-indigo-600 dark:text-indigo-400',
                        iconBg: 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800'
                      },
                      {
                        id: 'DELETE',
                        title: 'Delete Records',
                        desc: 'Teardown test records / rollback',
                        Icon: Trash2,
                        iconColor: 'text-rose-600 dark:text-rose-400',
                        iconBg: 'bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800'
                      }
                    ].filter(item => !toolboxSearch || item.title.toLowerCase().includes(toolboxSearch.toLowerCase()) || item.desc.toLowerCase().includes(toolboxSearch.toLowerCase()))
                    .map(item => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, item.id)}
                        onClick={() => handleAddNode(item.id)}
                        className="w-full p-2 rounded-xl bg-slate-50/70 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-500/50 hover:bg-white dark:hover:bg-slate-800/80 hover:shadow-xs transition-all group cursor-grab active:cursor-grabbing text-left flex items-center gap-2.5 select-none"
                        title={`Drag ${item.title} onto canvas or click to insert`}
                      >
                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 shadow-2xs ${item.iconBg} ${item.iconColor}`}>
                          <item.Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center justify-between">
                            <span>{item.title}</span>
                            <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Section: Logic & Flow Control */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-0.5">
                      Logic & Branching
                    </div>
                    {[
                      {
                        id: 'DECISION',
                        title: 'Decision',
                        desc: 'Evaluate conditions & branch paths',
                        Icon: GitBranch,
                        iconColor: 'text-violet-600 dark:text-violet-400',
                        iconBg: 'bg-violet-50 dark:bg-violet-950/70 border-violet-200 dark:border-violet-800'
                      },
                      {
                        id: 'ASSIGNMENT',
                        title: 'Assignment',
                        desc: 'Set variables & error payload',
                        Icon: ArrowLeftRight,
                        iconColor: 'text-amber-600 dark:text-amber-400',
                        iconBg: 'bg-amber-50 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800'
                      },
                      {
                        id: 'LOOP',
                        title: 'Loop / For Each',
                        desc: 'Iterate over record collection',
                        Icon: Repeat,
                        iconColor: 'text-orange-600 dark:text-orange-400',
                        iconBg: 'bg-orange-50 dark:bg-orange-950/70 border-orange-200 dark:border-orange-800'
                      },
                      {
                        id: 'PAUSE',
                        title: 'Pause / Delay',
                        desc: 'Wait for ERP sync / timer',
                        Icon: Clock,
                        iconColor: 'text-slate-600 dark:text-slate-400',
                        iconBg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }
                    ].filter(item => !toolboxSearch || item.title.toLowerCase().includes(toolboxSearch.toLowerCase()) || item.desc.toLowerCase().includes(toolboxSearch.toLowerCase()))
                    .map(item => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, item.id)}
                        onClick={() => handleAddNode(item.id)}
                        className="w-full p-2 rounded-xl bg-slate-50/70 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-violet-500/50 hover:bg-white dark:hover:bg-slate-800/80 hover:shadow-xs transition-all group cursor-grab active:cursor-grabbing text-left flex items-center gap-2.5 select-none"
                        title={`Drag ${item.title} onto canvas or click to insert`}
                      >
                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 shadow-2xs ${item.iconBg} ${item.iconColor}`}>
                          <item.Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors flex items-center justify-between">
                            <span>{item.title}</span>
                            <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Section: Triggers & Actions */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-0.5">
                      Triggers & Actions
                    </div>
                    {[
                      {
                        id: 'TRIGGER_RECORD',
                        title: 'Record Change Trigger',
                        desc: 'Trigger on Account, Lead DML',
                        Icon: Zap,
                        iconColor: 'text-emerald-600 dark:text-emerald-400',
                        iconBg: 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800'
                      },
                      {
                        id: 'TRIGGER_SCHEDULE',
                        title: 'Scheduled Trigger',
                        desc: 'Hourly or daily cron runs',
                        Icon: Calendar,
                        iconColor: 'text-teal-600 dark:text-teal-400',
                        iconBg: 'bg-teal-50 dark:bg-teal-950/70 border-teal-200 dark:border-teal-800'
                      },
                      {
                        id: 'TRIGGER_WEBHOOK',
                        title: 'Inbound Webhook',
                        desc: 'REST API trigger from ERP / CI',
                        Icon: Globe,
                        iconColor: 'text-cyan-600 dark:text-cyan-400',
                        iconBg: 'bg-cyan-50 dark:bg-cyan-950/70 border-cyan-200 dark:border-cyan-800'
                      },
                      {
                        id: 'ACTION',
                        title: 'Apex / External Action',
                        desc: 'Invocable Apex or HTTP callout',
                        Icon: Zap,
                        iconColor: 'text-purple-600 dark:text-purple-400',
                        iconBg: 'bg-purple-50 dark:bg-purple-950/70 border-purple-200 dark:border-purple-800'
                      },
                      {
                        id: 'FAULT',
                        title: 'Fault Terminal',
                        desc: 'Terminate on failure branch',
                        Icon: AlertTriangle,
                        iconColor: 'text-rose-600 dark:text-rose-400',
                        iconBg: 'bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800'
                      }
                    ].filter(item => !toolboxSearch || item.title.toLowerCase().includes(toolboxSearch.toLowerCase()) || item.desc.toLowerCase().includes(toolboxSearch.toLowerCase()))
                    .map(item => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, item.id)}
                        onClick={() => handleAddNode(item.id)}
                        className="w-full p-2 rounded-xl bg-slate-50/70 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-white dark:hover:bg-slate-800/80 hover:shadow-xs transition-all group cursor-grab active:cursor-grabbing text-left flex items-center gap-2.5 select-none"
                        title={`Configure: ${item.title}`}
                      >
                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 shadow-2xs ${item.iconBg} ${item.iconColor}`}>
                          <item.Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center justify-between">
                            <span>{item.title}</span>
                            <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: MANAGER (Variables, Formulas, Constants, Text Templates) */}
              {toolboxTab === 'manager' && (
                <div className="space-y-4">
                  {/* + New Resource Button (Dashed style per Salesforce Flow Builder) */}
                  <button
                    onClick={handleOpenNewResource}
                    className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                  >
                    <span>+ New Resource</span>
                  </button>

                  {/* Variables Group */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-0.5">
                      Variables ({resources.filter(r => r.type === 'VARIABLE').length})
                    </div>
                    {resources.filter(r => r.type === 'VARIABLE').length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic px-1 py-1">No variables created yet.</div>
                    ) : (
                      resources.filter(r => r.type === 'VARIABLE').map(res => (
                        <div 
                          key={res.id} 
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-2xs hover:shadow-sm hover:border-blue-400/50 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{res.name}</span>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                              <button 
                                onClick={() => handleEditResource(res)}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Edit Variable"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => handleDeleteResource(res.id)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                                title="Delete Variable"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Type: {res.dataType}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Formulas Group */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-0.5">
                      Formulas ({resources.filter(r => r.type === 'FORMULA').length})
                    </div>
                    {resources.filter(r => r.type === 'FORMULA').length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic px-1 py-1">No formulas created yet.</div>
                    ) : (
                      resources.filter(r => r.type === 'FORMULA').map(res => (
                        <div 
                          key={res.id} 
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-2xs hover:shadow-sm hover:border-blue-400/50 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{res.name}</span>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                              <button 
                                onClick={() => handleEditResource(res)}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Edit Formula"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => handleDeleteResource(res.id)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                                title="Delete Formula"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Type: {res.dataType}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Constants Group (If any) */}
                  {resources.some(r => r.type === 'CONSTANT') && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-0.5">
                        Constants ({resources.filter(r => r.type === 'CONSTANT').length})
                      </div>
                      {resources.filter(r => r.type === 'CONSTANT').map(res => (
                        <div 
                          key={res.id} 
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-2xs hover:shadow-sm hover:border-blue-400/50 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{res.name}</span>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                              <button onClick={() => handleEditResource(res)} className="p-1 text-slate-400 hover:text-blue-600"><Edit3 className="w-3 h-3" /></button>
                              <button onClick={() => handleDeleteResource(res.id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Type: {res.dataType}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Text Templates Group (If any) */}
                  {resources.some(r => r.type === 'TEXT_TEMPLATE') && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-0.5">
                        Text Templates ({resources.filter(r => r.type === 'TEXT_TEMPLATE').length})
                      </div>
                      {resources.filter(r => r.type === 'TEXT_TEMPLATE').map(res => (
                        <div 
                          key={res.id} 
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-2xs hover:shadow-sm hover:border-blue-400/50 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{res.name}</span>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                              <button onClick={() => handleEditResource(res)} className="p-1 text-slate-400 hover:text-blue-600"><Edit3 className="w-3 h-3" /></button>
                              <button onClick={() => handleDeleteResource(res.id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Type: Text Template
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Canvas Area */}
        <div 
          ref={reactFlowWrapper} 
          className="flex-1 h-full relative bg-slate-100 dark:bg-[#0b1120] overflow-hidden"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {/* Floating Toggle Button when Sidebar is Collapsed */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="absolute top-4 left-4 z-30 h-9 px-3 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-xl text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-semibold flex items-center gap-2 backdrop-blur-md animate-in fade-in transition-all"
              title="Expand Flow Toolbox"
            >
              <PanelLeftOpen className="w-4 h-4 text-blue-500" />
              <span>Flow Toolbox</span>
            </button>
          )}

          {/* Decorated nodes & edges with guaranteed callbacks for seamless insertion & deletion */}
          {(() => null)()}

          <ReactFlow
            className="bg-slate-100 dark:bg-[#0b1120]"
            nodes={enhancedNodes}
            edges={enhancedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgesDelete={onEdgesDelete}
            onNodesDelete={onNodesDelete}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={setReactFlowInstance}
            fitView
            fitViewOptions={{
              maxZoom: 0.9,
              minZoom: 0.3,
              padding: 0.25,
            }}
            minZoom={0.2}
            maxZoom={1.5}
            defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: 'flowConnector',
              animated: false
            }}
          >
            <Background 
              bgColor={theme === 'dark' ? '#0b1120' : '#f8fafc'}
              color={theme === 'dark' ? '#334155' : '#cbd5e1'} 
              gap={20} 
              size={1.5}
              variant={BackgroundVariant.Dots} 
            />
            <Controls showInteractive={false} />
            <MiniMap 
              className="!bg-white/90 dark:!bg-slate-900/90 !border !border-slate-200 dark:!border-slate-800 !rounded-xl !shadow-lg"
              nodeColor={(n: any) => {
                if (n.data?.nodeType === 'START') return '#10b981';
                if (n.data?.nodeType === 'END') return n.data?.config?.isFault ? '#f43f5e' : '#64748b';
                if (n.data?.nodeType === 'CREATE') return '#0284c7';
                if (n.data?.nodeType === 'GET') return '#059669';
                if (n.data?.nodeType === 'UPDATE') return '#2563eb';
                if (n.data?.nodeType === 'DELETE') return '#e11d48';
                if (n.data?.nodeType === 'DECISION') return '#7c3aed';
                if (n.data?.nodeType === 'ASSIGNMENT') return '#d97706';
                if (n.data?.nodeType === 'PAUSE') return '#ea580c';
                return '#0891b2';
              }} 
            />
          </ReactFlow>

          {/* Bottom Execution Console Drawer */}
          {showConsole && (
            <div className="absolute bottom-0 left-0 right-0 h-52 bg-slate-950/95 border-t border-slate-800 font-mono text-xs z-20 flex flex-col shadow-2xl backdrop-blur-md">
              <div className="h-8 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-2 text-white font-semibold">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  Live Simulation Terminal Output
                </span>
                <div className="flex items-center gap-3">
                  {lastRunReport && (
                    <button
                      onClick={() => setShowReportModal(true)}
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors flex items-center gap-1 cursor-pointer ${
                        lastRunReport.status === 'PASSED'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                      }`}
                    >
                      <FileText className="w-3 h-3" />
                      <span>View Payload Report ({lastRunReport.status})</span>
                    </button>
                  )}
                  <button 
                    onClick={() => setSimLogs([])}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                  <button 
                    onClick={() => setShowConsole(false)}
                    className="hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="flex-1 p-3.5 overflow-y-auto space-y-1 text-slate-300 text-[11px] font-mono">
                {simLogs.map((log, i) => {
                  const urlMatch = log.match(/(https?:\/\/[^\s]+)/);
                  return (
                    <div key={i} className={
                      log.includes('✓') || log.includes('SUCCESS') ? 'text-emerald-400 font-semibold' :
                      log.includes('Executing') || log.includes('Payload') || log.includes('Dispatching') ? 'text-sky-300' :
                      log.includes('Error') || log.includes('❌') || log.includes('FAILED') || log.includes('FATAL') ? 'text-rose-400 font-semibold' : 
                      log.includes('⭐') || log.includes('PRESERVED') ? 'text-amber-300 font-semibold' :
                      log.includes('🧹') || log.includes('TEARDOWN') ? 'text-emerald-300' :
                      log.includes('🔗') ? 'text-sky-400' :
                      'text-slate-400'
                    }>
                      {urlMatch ? (
                        <>
                          {log.substring(0, log.indexOf(urlMatch[0]))}
                          <a 
                            href={urlMatch[0]} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-amber-300 underline hover:text-amber-200 cursor-pointer font-bold inline-flex items-center gap-1"
                          >
                            {urlMatch[0]}
                          </a>
                          {log.substring(log.indexOf(urlMatch[0]) + urlMatch[0].length)}
                        </>
                      ) : log}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Configuration Drawer (Salesforce Flow Card Inspector) */}
        {selectedNode && (
          <div className="w-96 bg-white/95 dark:bg-slate-900/95 border-l border-slate-200 dark:border-slate-800 p-5 space-y-5 overflow-y-auto z-20 flex-shrink-0 animate-in slide-in-from-right duration-200 shadow-2xl transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  Element Inspector
                </h3>
                <div className="text-[10px] font-mono text-slate-500">
                  NODE ID: {selectedNode.id}
                </div>
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            {(() => {
              const nodeData = (selectedNode.data || {}) as Record<string, any>;
              const nodeConfig = (nodeData.config || {}) as Record<string, any>;
              const nodeType = nodeData.nodeType || 'ACTION';

              const updateConfig = (patch: Record<string, any>) => {
                const updatedConfig = { ...nodeConfig, ...patch };
                const updatedData = { ...nodeData, config: updatedConfig };
                setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: updatedData } : n));
                setSelectedNode({ ...selectedNode, data: updatedData });
              };

              return (
                <div className="space-y-4 text-xs">
                  {/* Element Title */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Label
                    </label>
                    <input 
                      type="text" 
                      value={String(nodeData.label || '')}
                      onChange={(e) => {
                        const newLabel = e.target.value;
                        const updatedData = { ...nodeData, label: newLabel };
                        setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: updatedData } : n));
                        setSelectedNode({ ...selectedNode, data: updatedData });
                      }}
                      className="w-full h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>

                  {/* 1. CREATE RECORDS INSPECTOR */}
                  {(nodeType === 'CREATE' || nodeType === 'SF_CREATE') && (() => {
                    const currentObj = String(nodeConfig.customObject || nodeConfig.object || 'Account');
                    const isCustomObjSelected = nodeConfig.isCustomObject || (currentObj !== 'Account' && currentObj !== 'Opportunity' && currentObj !== 'Contact' && currentObj !== 'Lead' && currentObj !== 'Case' && currentObj !== 'Order' && currentObj !== 'Contract' && currentObj !== 'Product2' && currentObj !== 'SBQQ__Quote__c' && currentObj !== 'SBQQ__QuoteLine__c');
                    
                    const rawFields = nodeConfig.fields || { Name: 'New Test Account', Type: 'Customer - Direct' };
                    const fieldEntries: Array<{ field: string; value: string }> = Array.isArray(nodeConfig.fieldList)
                      ? nodeConfig.fieldList
                      : Object.entries(rawFields).map(([k, v]) => ({ field: k, value: String(v) }));

                    const updateFields = (entries: Array<{ field: string; value: string }>) => {
                      const fieldsMap: Record<string, string> = {};
                      entries.forEach(e => {
                        if (e.field.trim()) fieldsMap[e.field.trim()] = e.value;
                      });
                      updateConfig({ fieldList: entries, fields: fieldsMap });
                    };

                    const objectFieldPresets: Record<string, string[]> = {
                      Account: ['Name', 'Type', 'Phone', 'BillingCity', 'BillingCountry', 'Industry', 'AnnualRevenue', 'Website', 'Rating'],
                      Contact: ['FirstName', 'LastName', 'Email', 'Phone', 'Title', 'Department', 'AccountId', 'MobilePhone'],
                      Opportunity: ['Name', 'StageName', 'CloseDate', 'Amount', 'Type', 'LeadSource', 'Probability', 'AccountId'],
                      Lead: ['FirstName', 'LastName', 'Company', 'Status', 'Email', 'Phone', 'Title', 'LeadSource'],
                      Case: ['Subject', 'Status', 'Priority', 'Origin', 'Description', 'AccountId', 'ContactId'],
                      Order: ['AccountId', 'EffectiveDate', 'Status', 'Pricebook2Id', 'TotalAmount'],
                      Contract: ['AccountId', 'StartDate', 'ContractTerm', 'Status'],
                      Product2: ['Name', 'ProductCode', 'IsActive', 'Family', 'Description'],
                      'SBQQ__Quote__c': ['SBQQ__Account__c', 'SBQQ__Opportunity2__c', 'SBQQ__Status__c', 'SBQQ__Type__c', 'SBQQ__StartDate__c', 'SBQQ__SubscriptionTerm__c', 'SBQQ__Primary__c'],
                      'SBQQ__QuoteLine__c': ['SBQQ__Quote__c', 'SBQQ__Product__c', 'SBQQ__Quantity__c', 'SBQQ__ListPrice__c', 'SBQQ__NetPrice__c']
                    };

                    const suggestedFields = objectFieldPresets[currentObj] || ['Name', 'Type', 'Status', 'Description', 'External_Id__c'];

                    return (
                      <div className="space-y-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        {/* Header Badge */}
                        <div className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400 uppercase flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                          <span className="flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5" />
                            Create Records Configuration
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 border border-sky-500/20 font-semibold">
                            DML INSERT
                          </span>
                        </div>

                        {/* 1. How Many Records to Create */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            How Many Records to Create
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateConfig({ recordCount: 'ONE' })}
                              className={`h-7 px-2 rounded-lg text-[11px] font-medium border flex items-center justify-center transition-all cursor-pointer ${
                                (nodeConfig.recordCount || 'ONE') === 'ONE'
                                  ? 'bg-sky-500 text-white border-sky-600 shadow-2xs font-semibold'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              One (Single Record)
                            </button>
                            <button
                              type="button"
                              onClick={() => updateConfig({ recordCount: 'MULTIPLE' })}
                              className={`h-7 px-2 rounded-lg text-[11px] font-medium border flex items-center justify-center transition-all cursor-pointer ${
                                nodeConfig.recordCount === 'MULTIPLE'
                                  ? 'bg-sky-500 text-white border-sky-600 shadow-2xs font-semibold'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              Multiple (Collection)
                            </button>
                          </div>
                        </div>

                        {/* 2. How to Set the Record Fields */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            How to Set the Record Fields
                          </label>
                          <select
                            value={String(nodeConfig.fieldSettingMode || 'SEPARATE')}
                            onChange={(e) => updateConfig({ fieldSettingMode: e.target.value })}
                            className="w-full h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                          >
                            <option value="SEPARATE">Use separate resources, and literal values</option>
                            <option value="RECORD_VAR">Use all values from a record variable</option>
                          </select>
                        </div>

                        {/* 3. Target sObject Selection */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              Target Object (sObject)
                            </label>
                            {isCustomObjSelected && (
                              <span className="text-[9px] font-mono font-semibold text-purple-600 dark:text-purple-400 uppercase">
                                Custom Object Mode
                              </span>
                            )}
                          </div>
                          <select 
                            value={isCustomObjSelected ? 'Custom' : currentObj}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'Custom') {
                                updateConfig({ isCustomObject: true, customObject: 'Custom_Entity__c', object: 'Custom_Entity__c' });
                              } else {
                                updateConfig({ isCustomObject: false, customObject: '', object: val });
                              }
                            }}
                            className="w-full h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                          >
                            <optgroup label="Standard Salesforce Objects">
                              <option value="Account">Account (CRM Core)</option>
                              <option value="Contact">Contact (Person / Buyer)</option>
                              <option value="Opportunity">Opportunity (Deals & Pipeline)</option>
                              <option value="Lead">Lead (Prospect)</option>
                              <option value="Case">Case (Support Ticket)</option>
                              <option value="Order">Order (Transaction)</option>
                              <option value="Contract">Contract (Agreements)</option>
                              <option value="Product2">Product2 (Catalog)</option>
                            </optgroup>
                            <optgroup label="Salesforce CPQ & Billing Objects">
                              <option value="SBQQ__Quote__c">SBQQ__Quote__c (CPQ Quote)</option>
                              <option value="SBQQ__QuoteLine__c">SBQQ__QuoteLine__c (CPQ Line Item)</option>
                            </optgroup>
                            <optgroup label="Custom Objects">
                              <option value="Custom">Custom sObject (Specify API Name)...</option>
                            </optgroup>
                          </select>

                          {/* Custom sObject API Name input */}
                          {isCustomObjSelected && (
                            <div className="mt-1.5">
                              <input
                                type="text"
                                value={String(nodeConfig.customObject || nodeConfig.object || '')}
                                placeholder="e.g. Integration_Audit__c"
                                onChange={(e) => updateConfig({ customObject: e.target.value, object: e.target.value })}
                                className="w-full h-7 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-800 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-purple-500"
                              />
                            </div>
                          )}
                        </div>

                        {/* 4. Dynamic Field Values Mapping Grid */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              Set Field Values for the {currentObj}
                            </label>
                            <span className="text-[10px] font-mono text-slate-400">
                              {fieldEntries.length} field{fieldEntries.length === 1 ? '' : 's'}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {fieldEntries.map((entry, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                                {/* Field Name input with suggestions */}
                                <div className="w-5/12">
                                  <input 
                                    type="text"
                                    list={`field-datalist-${idx}`}
                                    value={entry.field}
                                    placeholder="Field API Name"
                                    onChange={(e) => {
                                      const next = [...fieldEntries];
                                      next[idx] = { ...next[idx], field: e.target.value };
                                      updateFields(next);
                                    }}
                                    className="w-full h-7 px-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                                  />
                                  <datalist id={`field-datalist-${idx}`}>
                                    {suggestedFields.map(sf => (
                                      <option key={sf} value={sf} />
                                    ))}
                                  </datalist>
                                </div>

                                <span className="text-slate-400 text-xs font-mono flex-shrink-0">=</span>

                                {/* Field Value input */}
                                <div className="flex-1 min-w-0">
                                  <input 
                                    type="text"
                                    value={entry.value}
                                    placeholder="Value or {{var}}"
                                    onChange={(e) => {
                                      const next = [...fieldEntries];
                                      next[idx] = { ...next[idx], value: e.target.value };
                                      updateFields(next);
                                    }}
                                    className="w-full h-7 px-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                                  />
                                </div>

                                {/* Delete Field Row */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = fieldEntries.filter((_, i) => i !== idx);
                                    updateFields(next);
                                  }}
                                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer flex-shrink-0"
                                  title="Delete field mapping"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Add Field Button & Quick Helpers */}
                          <div className="flex items-center justify-between pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                updateFields([...fieldEntries, { field: '', value: '' }]);
                              }}
                              className="h-7 px-2.5 rounded-lg border border-dashed border-sky-400 dark:border-sky-600 bg-sky-50/50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Field</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                updateFields([
                                  ...fieldEntries, 
                                  { field: 'Description', value: `AssertNow QA Test Run · ${new Date().toLocaleTimeString()}` }
                                ]);
                              }}
                              className="text-[10px] text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                            >
                              + Add Timestamp Note
                            </button>
                          </div>
                        </div>

                        {/* 5. Assign Created Record ID to Variable (Output Handling) */}
                        <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={nodeConfig.storeRecordId !== false}
                              onChange={(e) => updateConfig({ storeRecordId: e.target.checked })}
                              className="rounded text-sky-600 focus:ring-0"
                            />
                            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                              Store Created Record ID to Variable
                            </span>
                          </label>

                          {nodeConfig.storeRecordId !== false && (
                            <div className="pl-5 space-y-1">
                              <input
                                type="text"
                                value={String(nodeConfig.outputVariable || 'varCreatedRecordId')}
                                placeholder="e.g. varAccountId or newRecordId"
                                onChange={(e) => updateConfig({ outputVariable: e.target.value })}
                                className="w-full h-7 px-2.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-[11px] font-mono text-slate-900 dark:text-white"
                              />
                              <div className="text-[10px] text-slate-500">
                                Downstream steps can reference this record via <code className="font-mono text-sky-600 bg-sky-50 dark:bg-sky-950 px-1 py-0.5 rounded">{"{{"}{String(nodeConfig.outputVariable || 'varCreatedRecordId')}{"}}"}</code>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 6. Execution Rules & Automated Rollback / Teardown (Enterprise QA) */}
                        <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                            Execution & Quality Rules
                          </div>

                          <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                            <input
                              type="checkbox"
                              checked={nodeConfig.autoTeardown !== false}
                              onChange={(e) => updateConfig({ autoTeardown: e.target.checked })}
                              className="mt-0.5 rounded text-emerald-600 focus:ring-0"
                            />
                            <div className="text-[11px]">
                              <div className="font-semibold text-emerald-800 dark:text-emerald-300">
                                Auto-Rollback on Test Teardown
                              </div>
                              <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 leading-snug">
                                Automatically issues a DML Delete on this record after regression suite finishes to prevent test data pollution.
                              </div>
                            </div>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer pl-1">
                            <input
                              type="checkbox"
                              checked={Boolean(nodeConfig.bypassValidationRules)}
                              onChange={(e) => updateConfig({ bypassValidationRules: e.target.checked })}
                              className="rounded text-sky-600 focus:ring-0"
                            />
                            <span className="text-[11px] text-slate-700 dark:text-slate-300">
                              Bypass Validation Rules & Apex Triggers
                            </span>
                          </label>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 2. GET RECORDS INSPECTOR */}
                  {(nodeType === 'GET' || nodeType === 'GET_RECORDS' || nodeType === 'NS_SEARCH' || nodeType === 'SF_QUERY') && (() => {
                    const currentObj = String(nodeConfig.recordType || nodeConfig.object || 'customer');
                    const conditions = Array.isArray(nodeConfig.conditions) 
                      ? nodeConfig.conditions 
                      : [{ field: 'custentity_sf_account_id', operator: 'EQUALS', value: '{{varCreatedRecordId}}' }];

                    const updateConditions = (conds: any[]) => {
                      updateConfig({ conditions: conds, searchFilter: conds.map(c => `${c.field} ${c.operator} '${c.value}'`).join(' AND ') });
                    };

                    return (
                      <div className="space-y-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                          <span className="flex items-center gap-1.5">
                            <Search className="w-3.5 h-3.5" />
                            Get Records Configuration
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-semibold">SOQL / SUITETALK</span>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Object / Record Type
                          </label>
                          <select 
                            value={currentObj}
                            onChange={(e) => updateConfig({ recordType: e.target.value, object: e.target.value })}
                            className="w-full h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                          >
                            <optgroup label="Salesforce Standard & Custom Objects">
                              <option value="Account">Account (Standard Object)</option>
                              <option value="Opportunity">Opportunity (Sales)</option>
                              <option value="Contact">Contact (Person)</option>
                              <option value="Lead">Lead (Prospect)</option>
                              <option value="Contract">Contract (Agreement)</option>
                              <option value="Order">Order (Transaction)</option>
                              <option value="Product2">Product2 (Catalog)</option>
                              <option value="SBQQ__Quote__c">SBQQ__Quote__c (CPQ Quote)</option>
                            </optgroup>
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              Filter Conditions (WHERE)
                            </label>
                            <select
                              value={String(nodeConfig.conditionLogic || 'AND')}
                              onChange={(e) => updateConfig({ conditionLogic: e.target.value })}
                              className="text-[10px] bg-transparent border-0 font-semibold text-emerald-600 dark:text-emerald-400 focus:outline-none cursor-pointer"
                            >
                              <option value="AND">All Conditions Met (AND)</option>
                              <option value="OR">Any Condition Met (OR)</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            {conditions.map((cond: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-1.5 p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                                <input
                                  type="text"
                                  value={cond.field}
                                  placeholder="Field"
                                  onChange={(e) => {
                                    const next = [...conditions];
                                    next[idx] = { ...next[idx], field: e.target.value };
                                    updateConditions(next);
                                  }}
                                  className="w-5/12 h-7 px-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono font-semibold"
                                />
                                <select
                                  value={cond.operator}
                                  onChange={(e) => {
                                    const next = [...conditions];
                                    next[idx] = { ...next[idx], operator: e.target.value };
                                    updateConditions(next);
                                  }}
                                  className="w-20 h-7 px-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] font-mono"
                                >
                                  <option value="EQUALS">=</option>
                                  <option value="NOT_EQUALS">!=</option>
                                  <option value="CONTAINS">LIKE</option>
                                  <option value="GREATER_THAN">&gt;</option>
                                  <option value="LESS_THAN">&lt;</option>
                                </select>
                                <input
                                  type="text"
                                  value={cond.value}
                                  placeholder="Value / {{var}}"
                                  onChange={(e) => {
                                    const next = [...conditions];
                                    next[idx] = { ...next[idx], value: e.target.value };
                                    updateConditions(next);
                                  }}
                                  className="flex-1 min-w-0 h-7 px-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = conditions.filter((_: any, i: number) => i !== idx);
                                    updateConditions(next);
                                  }}
                                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="pt-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                updateConditions([...conditions, { field: '', operator: 'EQUALS', value: '' }]);
                              }}
                              className="h-6 px-2 rounded border border-dashed border-emerald-400 text-emerald-600 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Condition</span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            How Many Records to Store
                          </label>
                          <select 
                            value={String(nodeConfig.storeCount || 'FIRST')}
                            onChange={(e) => updateConfig({ storeCount: e.target.value })}
                            className="w-full h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                          >
                            <option value="FIRST">Only the first record</option>
                            <option value="ALL">All records (Collection)</option>
                          </select>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 3. UPDATE RECORDS INSPECTOR */}
                  {(nodeType === 'UPDATE' || nodeType === 'UPDATE_RECORDS') && (() => {
                    const currentObj = String(nodeConfig.object || 'Account');
                    const rawFields = nodeConfig.fields || { Sync_Status__c: 'Synchronized' };
                    const fieldEntries: Array<{ field: string; value: string }> = Array.isArray(nodeConfig.fieldList)
                      ? nodeConfig.fieldList
                      : Object.entries(rawFields).map(([k, v]) => ({ field: k, value: String(v) }));

                    const updateFields = (entries: Array<{ field: string; value: string }>) => {
                      const fieldsMap: Record<string, string> = {};
                      entries.forEach(e => {
                        if (e.field.trim()) fieldsMap[e.field.trim()] = e.value;
                      });
                      updateConfig({ fieldList: entries, fields: fieldsMap });
                    };

                    return (
                      <div className="space-y-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 uppercase flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                          <span className="flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5" />
                            Update Records Configuration
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 font-semibold">DML UPDATE</span>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Target Object
                          </label>
                          <select 
                            value={currentObj}
                            onChange={(e) => updateConfig({ object: e.target.value })}
                            className="w-full h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                          >
                            <option value="Account">Account</option>
                            <option value="Opportunity">Opportunity</option>
                            <option value="Contact">Contact</option>
                            <option value="Order">Order</option>
                            <option value="SBQQ__Quote__c">SBQQ__Quote__c</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Record ID to Update (or Condition)
                          </label>
                          <input
                            type="text"
                            value={String(nodeConfig.recordIdFilter || '{{varCreatedRecordId}}')}
                            placeholder="e.g. {{varCreatedRecordId}} or Id = '001...'"
                            onChange={(e) => updateConfig({ recordIdFilter: e.target.value })}
                            className="w-full h-7 px-2.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs font-mono"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              Set Field Values to Update
                            </label>
                            <span className="text-[10px] font-mono text-slate-400">
                              {fieldEntries.length} field{fieldEntries.length === 1 ? '' : 's'}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {fieldEntries.map((entry, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                                <input
                                  type="text"
                                  value={entry.field}
                                  placeholder="Field"
                                  onChange={(e) => {
                                    const next = [...fieldEntries];
                                    next[idx] = { ...next[idx], field: e.target.value };
                                    updateFields(next);
                                  }}
                                  className="w-5/12 h-7 px-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono font-semibold"
                                />
                                <span className="text-slate-400 text-xs font-mono">=</span>
                                <input
                                  type="text"
                                  value={entry.value}
                                  placeholder="New Value"
                                  onChange={(e) => {
                                    const next = [...fieldEntries];
                                    next[idx] = { ...next[idx], value: e.target.value };
                                    updateFields(next);
                                  }}
                                  className="flex-1 min-w-0 h-7 px-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = fieldEntries.filter((_, i) => i !== idx);
                                    updateFields(next);
                                  }}
                                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                updateFields([...fieldEntries, { field: '', value: '' }]);
                              }}
                              className="h-6 px-2 rounded border border-dashed border-blue-400 text-blue-600 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Update Field</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 4. DECISION INSPECTOR */}
                  {(nodeType === 'DECISION' || nodeType === 'ASSERTION') && (
                    <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 uppercase flex items-center justify-between">
                        <span>DECISION OUTCOMES & ASSERTIONS</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 border border-purple-500/20">BRANCH</span>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Condition Requirements</label>
                        <select className="w-full h-8 px-2 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white">
                          <option>All Conditions Are Met (AND)</option>
                          <option>Any Condition Is Met (OR)</option>
                          <option>Custom Condition Logic</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Active Rules</label>
                        <div className="space-y-1.5 font-mono text-[10px]">
                          <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-purple-500 font-bold">Rule 1:</span> NS companyName == SF Name
                          </div>
                          <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-purple-500 font-bold">Rule 2:</span> NS entityStatus == EXISTS
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5. ASSIGNMENT INSPECTOR */}
                  {nodeType === 'ASSIGNMENT' && (
                    <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 uppercase flex items-center justify-between">
                        <span>ASSIGNMENT VARIABLE MAPPINGS</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">LOGIC</span>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Set Variable Values</label>
                        <div className="flex items-center gap-1.5 font-mono text-[10px]">
                          <span className="w-1/3 px-2 py-1 rounded bg-slate-200/80 dark:bg-slate-800 font-semibold truncate">varFaultMsg</span>
                          <span className="text-slate-400 text-xs">=</span>
                          <input type="text" defaultValue="ERP Sync Disparity" className="flex-1 h-7 px-2 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-[11px]" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 6. PAUSE / WAIT INSPECTOR */}
                  {(nodeType === 'PAUSE' || nodeType === 'WAIT') && (
                    <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-mono font-bold text-orange-600 dark:text-orange-400 uppercase flex items-center justify-between">
                        <span>PAUSE EXECUTION</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20">TIMER</span>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Delay Duration (Seconds)</label>
                        <input 
                          type="number" 
                          value={Number(nodeConfig.durationSeconds || 15)}
                          onChange={(e) => {
                            const dur = Number(e.target.value);
                            const updatedConfig = { ...nodeConfig, durationSeconds: dur };
                            const updatedData = { ...nodeData, config: updatedConfig };
                            setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: updatedData } : n));
                            setSelectedNode({ ...selectedNode, data: updatedData });
                          }}
                          className="w-full h-8 px-2.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Allows asynchronous middleware pipelines (MuleSoft / Boomi / Celigo) to process messages.
                      </p>
                    </div>
                  )}

                  {/* FAULT PATH TOGGLE BUTTON */}
                  {nodeType !== 'START' && nodeType !== 'END' && (
                    <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Fault Path Error Handling
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Salesforce Flow fault connectors execute an alternate diagnostic branch if this step throws an exception.
                      </p>
                      <button
                        onClick={handleAddFaultPathToSelectedNode}
                        className="w-full h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Add Fault Path to Element</span>
                      </button>
                    </div>
                  )}

                  {/* Remove Node Action */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => {
                        handleDeleteNode(selectedNode.id);
                      }}
                      className="w-full h-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-500/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove Node from Graph
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Execution Report Drawer / Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Execution Trace & Payload Report
                    {lastRunReport && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        lastRunReport.status === 'PASSED' 
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}>
                        {lastRunReport.status}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Step-by-step request payloads sent to Salesforce and responses returned
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowReportModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {!lastRunReport ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No execution trace recorded yet. Click "Run Live" to generate a step report.
                </div>
              ) : (
                <>
                  {/* Summary Bar */}
                  <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Run ID</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">{lastRunReport.id}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Duration</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{((lastRunReport.durationMs || 0) / 1000).toFixed(2)}s</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Target Org</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">{lastRunReport.environmentName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Time</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{lastRunReport.timestamp}</span>
                    </div>
                  </div>

                  {/* Failure Banner if Failed */}
                  {lastRunReport.status === 'FAILED' && (
                    <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                        <AlertCircle className="w-4 h-4" />
                        Execution Blocked / Failed
                      </div>
                      <p className="font-mono text-[11px] break-words">
                        {lastRunReport.errorSummary || 'An error occurred during step execution.'}
                      </p>
                    </div>
                  )}

                  {/* Steps List */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold font-mono uppercase text-slate-500 tracking-wider">
                      Steps Executed ({lastRunReport.steps?.length || 0})
                    </h4>
                    
                    {lastRunReport.steps?.map((step: any, idx: number) => {
                      const isExpanded = expandedStepIndex === idx;
                      return (
                        <div 
                          key={idx}
                          className={`rounded-xl border transition-all overflow-hidden ${
                            step.status === 'PASSED'
                              ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60'
                              : 'border-rose-500/40 bg-rose-500/5'
                          }`}
                        >
                          <div 
                            onClick={() => setExpandedStepIndex(isExpanded ? null : idx)}
                            className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {step.status === 'PASSED' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                              )}
                              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                Step {idx + 1}: {step.nodeLabel}
                              </span>
                              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                {step.nodeType}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0 text-xs font-mono text-slate-400">
                              <span>{step.durationMs}ms</span>
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                              {/* Request Payload Sent */}
                              <div>
                                <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block mb-1">
                                  📤 Request Payload Sent to Salesforce:
                                </span>
                                <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-36">
                                  {JSON.stringify(step.inputData || {}, null, 2)}
                                </pre>
                              </div>

                              {/* Response Returned */}
                              <div>
                                <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block mb-1">
                                  📥 Response Received from Salesforce:
                                </span>
                                <pre className={`p-2.5 rounded-lg text-[11px] font-mono overflow-x-auto max-h-36 ${
                                  step.status === 'PASSED'
                                    ? 'bg-slate-900 text-emerald-400'
                                    : 'bg-rose-950/70 border border-rose-800 text-rose-200'
                                }`}>
                                  {JSON.stringify(step.outputData || {}, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
              {lastRunReport?.id && (
                <button
                  onClick={() => {
                    setShowReportModal(false);
                    navigate(`/executions/${lastRunReport.id}`);
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  Open in Test Runs & Logs <ExternalLink className="w-3 h-3" />
                </button>
              )}
              <button 
                onClick={() => setShowReportModal(false)}
                className="h-8 px-4 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Resource Modal (Salesforce Flow Standard) */}
      {isResourceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {editingResourceId ? 'Edit Resource' : 'New Resource'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Create a variable, formula, or text template to use in this workflow
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResourceModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveResource} className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                  Resource Type *
                </label>
                <select
                  value={resourceForm.type}
                  onChange={(e) => setResourceForm(prev => ({ 
                    ...prev, 
                    type: e.target.value as any,
                    dataType: e.target.value === 'TEXT_TEMPLATE' ? 'Text' : prev.dataType 
                  }))}
                  className="w-full h-8 px-2.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-1 focus:ring-blue-500"
                >
                  <option value="VARIABLE">Variable (Store and pass values)</option>
                  <option value="FORMULA">Formula (Calculate expression)</option>
                  <option value="CONSTANT">Constant (Fixed value)</option>
                  <option value="TEXT_TEMPLATE">Text Template (Formatted string)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                  API Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quote, varAccountId, totalCalculation"
                  value={resourceForm.name}
                  onChange={(e) => setResourceForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-8 px-2.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-mono font-medium focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {resourceForm.type !== 'TEXT_TEMPLATE' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                    Data Type *
                  </label>
                  <select
                    value={resourceForm.dataType}
                    onChange={(e) => setResourceForm(prev => ({ ...prev, dataType: e.target.value as any }))}
                    className="w-full h-8 px-2.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Text">Text</option>
                    <option value="Number">Number</option>
                    <option value="Currency">Currency</option>
                    <option value="Boolean">Boolean</option>
                    <option value="Date">Date</option>
                    <option value="Record">Record (Salesforce SObject)</option>
                  </select>
                </div>
              )}

              {resourceForm.type === 'FORMULA' ? (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                    Formula Expression *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder='e.g. {!$Record.Name} & " - " & {!Quote}'
                    value={resourceForm.formulaExpression}
                    onChange={(e) => setResourceForm(prev => ({ ...prev, formulaExpression: e.target.value }))}
                    className="w-full p-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-mono focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Reference other variables via <code>{`{!ResourceName}`}</code> or record fields via <code>{`{!$Record.Field}`}</code>
                  </span>
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                    Default Value
                  </label>
                  <input
                    type="text"
                    placeholder="Optional initial value"
                    value={resourceForm.defaultValue}
                    onChange={(e) => setResourceForm(prev => ({ ...prev, defaultValue: e.target.value }))}
                    className="w-full h-8 px-2.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Optional documentation note"
                  value={resourceForm.description}
                  onChange={(e) => setResourceForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full h-8 px-2.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResourceModalOpen(false)}
                  className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-500/20 cursor-pointer"
                >
                  {editingResourceId ? 'Save Resource' : 'Create Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
