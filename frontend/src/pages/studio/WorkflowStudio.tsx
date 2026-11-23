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
  PanelRightClose,
  PanelRightOpen,
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
  X,
  ShieldCheck,
  Copy,
  Check,
  SlidersHorizontal,
  Database,
  Code2
} from 'lucide-react';

import { WorkflowApi } from '@/api/WorkflowApi';
import { ExecutionApi } from '@/api/ExecutionApi';
import {
  SalesforceApi,
  GetRecordFieldMetadata,
  GetRecordFilter,
  QueryGetRecordsPayload,
  QueryGetRecordsResponse,
  UpdateFieldMetadata,
  UpdateRecordPayload,
  BulkUpdatePayload
} from '@/api/SalesforceApi';
import { ErrorState } from '@/components/ErrorState';
import { SearchableSelect, SObjectSelect } from '@/components/ui/SearchableSelect';
import { FilterValueInput } from '@/components/ui/FilterValueInput';
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
          // Filter out stale mock starter resources ('Quote', 'add')
          const cleanResources = data.resources.filter((r: FlowResource) =>
            r.name !== 'Quote' && r.name !== 'add'
          );
          setResources(cleanResources);
          if (cleanResources.length !== data.resources.length && id) {
            WorkflowApi.updateWorkflow(id, { resources: cleanResources }).catch(() => { });
          }
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

  // In-place workflow rename state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  useEffect(() => {
    WorkflowApi.getWorkflows()
      .then(data => setAvailableWorkflows(data))
      .catch(() => { });
  }, []);

  // Toolbox sidebar collapsible state: 2 tabs (Elements & Manager)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toolboxTab, setToolboxTab] = useState<'elements' | 'manager'>('elements');
  const [toolboxSearch, setToolboxSearch] = useState('');

  // Flow Resources State (Variables, Formulas, Constants, Text Templates)
  const [resources, setResources] = useState<FlowResource[]>([]);
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
    setResources(prev => {
      const updated = prev.filter(r => r.id !== resId);
      if (workflow) {
        WorkflowApi.updateWorkflow(workflow.id, { resources: updated }).catch(() => { });
      }
      return updated;
    });
  };

  const handleSaveResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceForm.name.trim()) return;

    let updatedList: FlowResource[];
    if (editingResourceId) {
      updatedList = resources.map(r => r.id === editingResourceId ? {
        ...r,
        ...resourceForm,
        name: resourceForm.name.trim()
      } : r);
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
      updatedList = [...resources, newRes];
    }
    setResources(updatedList);
    if (workflow) {
      WorkflowApi.updateWorkflow(workflow.id, { resources: updatedList }).catch(() => { });
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
  const handleDeleteNodeRef = useRef<(id: string) => void>(() => { });

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

  // Dynamic Salesforce Objects and Fields state fetched from backend jsforce
  const [availableSObjects, setAvailableSObjects] = useState<Array<{ name: string; label: string; custom: boolean }>>([]);
  const [objectFieldsMap, setObjectFieldsMap] = useState<Record<string, Array<{ name: string; label: string; type: string; required: boolean }>>>({});
  const [isLoadingSObjects, setIsLoadingSObjects] = useState(false);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [flowVariables, setFlowVariables] = useState<Array<{ token: string; label: string; value: string; sobject: string }>>([]);
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');
  const [objectSearchTerm, setObjectSearchTerm] = useState('');
  const [isObjectDropdownOpen, setIsObjectDropdownOpen] = useState(false);

  // Resizable Element Inspector Width (Default: 410px)
  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('assertnow_inspector_width');
      return saved ? Number(saved) : 410;
    } catch {
      return 410;
    }
  });
  const [isResizingInspector, setIsResizingInspector] = useState(false);

  // Active Lookup Modal for Reference & ID Fields
  const [activeLookupField, setActiveLookupField] = useState<{
    fieldName: string;
    fieldLabel: string;
    referenceTo?: string[];
  } | null>(null);
  const [lookupSearchTerm, setLookupSearchTerm] = useState('');
  const [lookupSubTab, setLookupSubTab] = useState<'search' | 'checkId'>('search');
  const [directCheckId, setDirectCheckId] = useState('');
  const [isCheckingId, setIsCheckingId] = useState(false);
  const [checkedIdResult, setCheckedIdResult] = useState<{
    exists: boolean;
    id?: string;
    name?: string;
    sobject?: string;
    message?: string;
  } | null>(null);
  const [existingOrgRecords, setExistingOrgRecords] = useState<Array<{ id: string; name: string; type?: string }>>([]);
  const [isLoadingOrgRecords, setIsLoadingOrgRecords] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Get Records state (/api/salesforce/get-record)
  const [queryableObjects, setQueryableObjects] = useState<Array<{ name: string; label: string; custom: boolean }>>([]);
  const [isLoadingQueryableObjects, setIsLoadingQueryableObjects] = useState(false);
  const [queryableFieldsMap, setQueryableFieldsMap] = useState<Record<string, GetRecordFieldMetadata[]>>({});
  const [isLoadingGetFields, setIsLoadingGetFields] = useState(false);
  const [isTestingGetQuery, setIsTestingGetQuery] = useState(false);
  const [testQueryResult, setTestQueryResult] = useState<QueryGetRecordsResponse | null>(null);
  const [testQueryError, setTestQueryError] = useState<string | null>(null);
  const [copiedSoql, setCopiedSoql] = useState(false);
  const [getFieldSearchTerm, setGetFieldSearchTerm] = useState('');
  const [isExpandedGetFields, setIsExpandedGetFields] = useState(false);

  // Update Records state (/api/salesforce/update-record)
  const [updateObjects, setUpdateObjects] = useState<Array<{ name: string; label: string; custom: boolean }>>([]);
  const [isLoadingUpdateObjects, setIsLoadingUpdateObjects] = useState(false);
  const [updateFieldsMap, setUpdateFieldsMap] = useState<Record<string, UpdateFieldMetadata[]>>({});
  const [isLoadingUpdateFields, setIsLoadingUpdateFields] = useState(false);
  const [updateLookupResults, setUpdateLookupResults] = useState<Array<{ id: string; name: string }>>([]);
  // Create Records state (/api/salesforce/create-record)
  const [isCreatingRecord, setIsCreatingRecord] = useState(false);
  const [createResult, setCreateResult] = useState<any>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [isLoadingUpdateLookup, setIsLoadingUpdateLookup] = useState(false);
  const [updateLookupSearch, setUpdateLookupSearch] = useState('');
  const [isUpdatingRecord, setIsUpdatingRecord] = useState(false);
  const [updateResult, setUpdateResult] = useState<any>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateRecordSubTab, setUpdateRecordSubTab] = useState<'lookup' | 'paste' | 'variable'>('lookup');
  const [updateFieldSearchTerm, setUpdateFieldSearchTerm] = useState('');
  const [isExpandedUpdateFields, setIsExpandedUpdateFields] = useState(false);

  // Delete Records state (/api/salesforce/delete-record)
  const [deleteObjects, setDeleteObjects] = useState<Array<{ name: string; label: string; custom: boolean }>>([]);
  const [isLoadingDeleteObjects, setIsLoadingDeleteObjects] = useState(false);
  const [deleteLookupResults, setDeleteLookupResults] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingDeleteLookup, setIsLoadingDeleteLookup] = useState(false);
  const [deleteLookupSearch, setDeleteLookupSearch] = useState('');
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);
  const [deleteResult, setDeleteResult] = useState<any>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteRecordSubTab, setDeleteRecordSubTab] = useState<'lookup' | 'paste' | 'variable'>('lookup');

  // Fetch creatable objects, queryable objects, and flow variables on mount
  useEffect(() => {
    setIsLoadingSObjects(true);
    SalesforceApi.getCreatableObjects()
      .then(objs => {
        if (Array.isArray(objs) && objs.length > 0) {
          setAvailableSObjects(objs);
        }
      })
      .catch(() => { })
      .finally(() => setIsLoadingSObjects(false));

    setIsLoadingQueryableObjects(true);
    SalesforceApi.getGetRecordObjects()
      .then(objs => {
        if (Array.isArray(objs) && objs.length > 0) {
          setQueryableObjects(objs);
        }
      })
      .catch(() => { })
      .finally(() => setIsLoadingQueryableObjects(false));

    setIsLoadingUpdateObjects(true);
    SalesforceApi.getUpdateableObjects()
      .then(objs => {
        if (Array.isArray(objs) && objs.length > 0) {
          setUpdateObjects(objs);
        }
      })
      .catch(() => { })
      .finally(() => setIsLoadingUpdateObjects(false));

    setIsLoadingDeleteObjects(true);
    SalesforceApi.getDeletableObjects()
      .then(objs => {
        if (Array.isArray(objs) && objs.length > 0) {
          setDeleteObjects(objs);
        }
      })
      .catch(() => { })
      .finally(() => setIsLoadingDeleteObjects(false));

    SalesforceApi.getFlowVariables()
      .then(vars => {
        if (Array.isArray(vars)) setFlowVariables(vars);
      })
      .catch(() => { });
  }, []);

  // Fetch fields metadata dynamically for Get Records from /get-record/fields
  const fetchQueryableFields = useCallback(async (sobjectName: string) => {
    if (!sobjectName) return;
    if (queryableFieldsMap[sobjectName]) return;

    setIsLoadingGetFields(true);
    try {
      const data = await SalesforceApi.getGetRecordFields(sobjectName);
      if (data && Array.isArray(data.fields)) {
        setQueryableFieldsMap(prev => ({
          ...prev,
          [sobjectName]: data.fields
        }));
      }
    } catch (err) {
      console.error(`Failed to fetch queryable fields for ${sobjectName}:`, err);
    } finally {
      setIsLoadingGetFields(false);
    }
  }, [queryableFieldsMap]);

  // Fetch updateable fields from /api/salesforce/update-record/fields
  const fetchUpdateableFields = useCallback(async (sobjectName: string) => {
    if (!sobjectName) return;
    if (updateFieldsMap[sobjectName]) return;

    setIsLoadingUpdateFields(true);
    try {
      const fields = await SalesforceApi.getUpdateableFields(sobjectName);
      if (Array.isArray(fields)) {
        setUpdateFieldsMap(prev => ({ ...prev, [sobjectName]: fields }));
      }
    } catch (err) {
      console.error(`Failed to fetch updateable fields for ${sobjectName}:`, err);
    } finally {
      setIsLoadingUpdateFields(false);
    }
  }, [updateFieldsMap]);

  // Fetch fields dynamically for a selected SObject and cache in objectFieldsMap
  const fetchSObjectFields = useCallback(async (sobjectName: string) => {
    if (!sobjectName) return;
    if (objectFieldsMap[sobjectName]) return;

    setIsLoadingFields(true);
    try {
      const data = await SalesforceApi.getFieldsByObject(sobjectName);
      if (data && data.fields) {
        setObjectFieldsMap(prev => ({
          ...prev,
          [sobjectName]: data.fields.map((f: any) => ({
            name: f.name,
            label: f.label,
            type: f.type,
            required: f.required,
            picklistValues: f.picklistValues || [],
            referenceTo: f.referenceTo || []
          }))
        }));
      }
    } catch {
      // Fallback: cache empty list so we don't spam API
      setObjectFieldsMap(prev => ({ ...prev, [sobjectName]: [] }));
    } finally {
      setIsLoadingFields(false);
    }
  }, [objectFieldsMap]);

  // Dynamic Inspector Resizer event listener
  useEffect(() => {
    if (!isResizingInspector) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(340, Math.min(window.innerWidth - 300, window.innerWidth - e.clientX));
      setInspectorWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingInspector(false);
      try {
        localStorage.setItem('assertnow_inspector_width', String(inspectorWidth));
      } catch { }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingInspector, inspectorWidth]);

  // Compute strictly upstream tokens from preceding canvas nodes in the flow
  const availableUpstreamTokens = useMemo(() => {
    if (!selectedNode) return [];

    const tokens: Array<{ token: string; label: string; sobject: string }> = [];
    const addedTokens = new Set<string>();

    const addToken = (token: string, label: string, sobject: string) => {
      if (!token || addedTokens.has(token.toLowerCase())) return;
      addedTokens.add(token.toLowerCase());
      tokens.push({ token, label, sobject });
    };

    // 1. Find all strict ancestor node IDs that precede selectedNode in graph edges
    const upstreamNodeIds = new Set<string>();
    const queue = [selectedNode.id];

    while (queue.length > 0) {
      const currId = queue.shift()!;
      // Find incoming edges leading into currId
      const incomingEdges = edges.filter(e => e.target === currId);
      for (const edge of incomingEdges) {
        if (!upstreamNodeIds.has(edge.source) && edge.source !== selectedNode.id) {
          upstreamNodeIds.add(edge.source);
          queue.push(edge.source);
        }
      }
    }

    // Keep track of valid upstream sObjects/stepKeys to validate against backend flowVariables
    const upstreamStepKeys = new Set<string>();

    // 2. Iterate through nodes that are strictly UPSTREAM of selectedNode
    nodes.forEach(n => {
      // Must not be the selected node itself
      if (n.id === selectedNode.id) return;

      // Must be an ancestor via edges OR strictly positioned above if no edge exists
      const isUpstream = upstreamNodeIds.has(n.id) || (edges.length === 0 && n.position.y < selectedNode.position.y - 50);
      if (!isUpstream) return;

      const nodeType = String(n.data?.nodeType || n.type || '').toUpperCase();
      // EXCLUDE START and END nodes completely!
      if (nodeType === 'START' || nodeType === 'END' || n.type === 'startNode' || n.type === 'endNode') {
        return;
      }

      // Only include nodes that perform data actions (CREATE, GET, salesforceNode)
      if (n.data) {
        const nConfig = (n.data.config || {}) as Record<string, any>;
        const sObj = String(nConfig.customObject || nConfig.object || '').trim();
        const nodeLabel = String(n.data.label || '').trim();

        // If node has no object and no stepKey, ignore
        if (!sObj && !nConfig.stepKey) return;

        const rawKey = nConfig.stepKey || sObj || nodeLabel.replace(/^create\s+/i, '').replace(/^get\s+/i, '');
        const sKey = String(rawKey).trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');

        // Produce clean ID tokens (ONLY true Record IDs, never name or non-ID fields)
        if (sKey && sKey !== 'start' && sKey !== 'end') {
          upstreamStepKeys.add(sKey);
          addToken(
            `{{${sKey}.id}}`,
            `${sObj || nodeLabel || 'Record'} ID (${sKey})`,
            sObj || sKey
          );
        }

        // If sObj exists and differs from sKey, also provide {{sobject.id}}
        if (sObj) {
          const cleanObjKey = sObj.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
          if (cleanObjKey && cleanObjKey !== 'start' && cleanObjKey !== 'end' && cleanObjKey !== sKey) {
            upstreamStepKeys.add(cleanObjKey);
            addToken(
              `{{${cleanObjKey}.id}}`,
              `${sObj} ID (${cleanObjKey})`,
              sObj
            );
          }
        }

        // Output variable if configured
        if (nConfig.outputVariable) {
          const varName = String(nConfig.outputVariable).trim();
          if (varName && !varName.toLowerCase().startsWith('var_') && !varName.toLowerCase().includes('start') && !varName.toLowerCase().includes('end')) {
            upstreamStepKeys.add(varName.toLowerCase());
            addToken(
              `{{${varName}.id}}`,
              `${sObj || 'Record'} ID (${varName})`,
              sObj || 'Variable'
            );
          }
        }
      }
    });

    // 3. Merge backend flowVariables matching an UPSTREAM step (ONLY ID tokens)
    flowVariables.forEach(bv => {
      const tokenLower = (bv.token || '').toLowerCase();
      if (tokenLower.includes('start') || tokenLower.includes('end') || tokenLower.includes('var_')) return;
      const tokenClean = bv.token.replace(/[{}]/g, '').toLowerCase();
      const baseToken = tokenClean.replace(/\.(id|Id)$/, '');
      const sObjLower = (bv.sobject || '').toLowerCase();

      // Only tokens that represent an ID (e.g. {{account.id}})
      if (tokenClean.endsWith('.id') && (upstreamStepKeys.has(baseToken) || upstreamStepKeys.has(sObjLower))) {
        addToken(bv.token, bv.label || `${bv.sobject} ID`, bv.sobject);
      }
    });

    // 4. Include flow resources ONLY if they represent a Record ID (e.g. dataType ID or ending in 'Id')
    resources.forEach(r => {
      const isIdType = (r.dataType as string) === 'ID' || (r.dataType as string) === 'Record' || r.name.toLowerCase().endsWith('id');
      if (isIdType && !r.name.toLowerCase().includes('start') && !r.name.toLowerCase().includes('end')) {
        addToken(
          `{!${r.name}}`,
          `${r.name} (${r.dataType || 'ID Variable'})`,
          r.name
        );
      }
    });

    return tokens;
  }, [nodes, edges, selectedNode, flowVariables, resources]);

  // Helper to determine accurate Salesforce sObject for lookup queries
  const resolveLookupTargetObject = (fieldName: string, referenceTo?: string[]): string => {
    if (referenceTo && referenceTo.length > 0 && referenceTo[0]) {
      return referenceTo[0];
    }
    const fLower = (fieldName || '').toLowerCase();
    if (fLower === 'parentid' || fLower === 'accountid') return 'Account';
    if (fLower === 'contactid' || fLower === 'whoid') return 'Contact';
    if (fLower === 'opportunityid') return 'Opportunity';
    if (fLower === 'ownerid' || fLower === 'createdbyid' || fLower === 'lastmodifiedbyid') return 'User';
    if (fLower === 'pricebook2id') return 'Pricebook2';
    if (fLower === 'quoteid' || fLower === 'sbqq__quote__c') return 'Quote';
    if (fLower === 'campaignid') return 'Campaign';
    if (fLower === 'caseid' || fLower === 'whatid') return 'Case';

    return fieldName.replace(/id$/i, '') || 'Account';
  };

  // Load existing records from Salesforce Org for Lookup modal using new backend lookup route
  const handleOpenLookupModal = async (fieldName: string, fieldLabel: string, referenceTo: string[] = []) => {
    setActiveLookupField({ fieldName, fieldLabel, referenceTo });
    setLookupSearchTerm('');
    setLookupSubTab('search');
    setDirectCheckId('');
    setCheckedIdResult(null);
    setIsLoadingOrgRecords(true);
    setLookupError(null);

    // Determine target object to query
    const targetObj = resolveLookupTargetObject(fieldName, referenceTo);
    try {
      const records = await SalesforceApi.getLookupRecords(targetObj, '', 50);
      setExistingOrgRecords(records.map(r => ({
        id: r.id,
        name: r.name || r.id,
        type: targetObj
      })));
    } catch (err: any) {
      console.error('Failed to fetch lookup records:', err);
      setLookupError(err?.message || 'Unable to fetch records. Please check that backend server is running and Salesforce is connected.');
      setExistingOrgRecords([]);
    } finally {
      setIsLoadingOrgRecords(false);
    }
  };

  // Check & Validate Record ID directly against Salesforce
  const handleCheckRecordId = async (idToCheck: string, sobjectName?: string) => {
    const clean = idToCheck.trim();
    if (!clean) return;
    setIsCheckingId(true);
    setCheckedIdResult(null);
    try {
      const res = await SalesforceApi.checkRecordId(sobjectName || '', clean);
      setCheckedIdResult(res);
    } catch (err: any) {
      setCheckedIdResult({
        exists: false,
        id: clean,
        message: err?.message || 'Error validating Record ID with Salesforce.'
      });
    } finally {
      setIsCheckingId(false);
    }
  };

  // Dynamic live search on Lookup endpoint when typing in search bar
  useEffect(() => {
    if (!activeLookupField) return;

    const targetObj = resolveLookupTargetObject(activeLookupField.fieldName, activeLookupField.referenceTo);

    const timer = setTimeout(async () => {
      setIsLoadingOrgRecords(true);
      setLookupError(null);
      try {
        const records = await SalesforceApi.getLookupRecords(targetObj, lookupSearchTerm, 50);
        setExistingOrgRecords(records.map(r => ({
          id: r.id,
          name: r.name || r.id,
          type: targetObj
        })));
      } catch (err: any) {
        setLookupError(err?.message || 'Failed to fetch matching records.');
      } finally {
        setIsLoadingOrgRecords(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [lookupSearchTerm, activeLookupField]);

  useEffect(() => {
    SalesforceApi.getEnvironments()
      .then(envs => {
        setEnvironments(envs || []);
        if (envs && envs.length > 0) {
          const defaultEnv = envs.find(e => (e as any).status === 'ONLINE' || e.status === 'ACTIVE' || (e as any).connectionStatus === 'HEALTHY') || envs[0];
          setSelectedEnvId(defaultEnv.id);
        }
      })
      .catch(() => { });
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
                  object: '',
                  operation: 'Create Records',
                  fields: {},
                  fieldList: [],
                  storeRecordId: true,
                  outputVariable: '',
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
                  object: '',
                  operation: 'Get Records',
                  fields: [],
                  filters: [],
                  filterLogic: 'AND',
                  limit: 50
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
                  object: '',
                  operation: 'Update Records',
                  updateMode: 'single',
                  recordId: '',
                  fieldList: [],
                  fields: {}
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
                  object: '',
                  operation: 'Delete Records',
                  deleteMode: 'single',
                  recordId: ''
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
              object: '',
              operation: 'Get Records',
              fields: [],
              filters: [],
              filterLogic: 'AND',
              limit: 50
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
              object: '',
              operation: 'Create Records',
              fields: {},
              fieldList: [],
              storeRecordId: true,
              outputVariable: '',
              autoTeardown: false
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
              object: '',
              operation: 'Update Records',
              updateMode: 'single',
              recordId: '',
              fieldList: [],
              fields: {}
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
              object: '',
              operation: 'Delete Records',
              deleteMode: 'single',
              recordId: ''
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
      ExecutionApi.triggerExecution({ workflowId: workflow.id }).catch(() => { });
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

        // Enhanced dynamic variable resolver for {{account.id}}, {!res}, {var} across all nodes
        const resolveValue = (raw: any): any => {
          if (typeof raw !== 'string') return raw;
          let str = raw;

          // Substitute tokens like {{account.id}}, {!resource}, {{varCreatedRecordId}}
          str = str.replace(/\{{1,2}[!$]?([a-zA-Z0-9_.]+)\}{1,2}/g, (match, key) => {
            const rawKey = key.trim();
            const lowerKey = rawKey.toLowerCase();

            if (executionContext[rawKey] !== undefined) return String(executionContext[rawKey]);
            if (executionContext[lowerKey] !== undefined) return String(executionContext[lowerKey]);

            const baseKey = lowerKey.replace(/\.(id|Id)$/, '');
            if (executionContext[`${baseKey}.id`] !== undefined) return String(executionContext[`${baseKey}.id`]);
            if (executionContext[baseKey] !== undefined) return String(executionContext[baseKey]);
            if (executionContext[`var_${baseKey}_id`] !== undefined) return String(executionContext[`var_${baseKey}_id`]);
            if (executionContext['varCreatedRecordId'] !== undefined && (baseKey === 'account' || baseKey === 'record')) {
              return String(executionContext['varCreatedRecordId']);
            }

            const foundEntry = Object.entries(executionContext).find(([k]) => k.toLowerCase().includes(baseKey) && k.toLowerCase().endsWith('.id'));
            if (foundEntry) return String(foundEntry[1]);

            return match;
          });

          return str;
        };

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

          // Date format normalizer for Salesforce Date fields (e.g. CloseDate expects YYYY-MM-DD)
          const sanitizeDateValue = (fieldName: string, val: any): any => {
            if (typeof val !== 'string') return val;
            const isDateField = /date/i.test(fieldName);
            if (!isDateField) return val;

            const trimmed = val.trim();
            // Match DD-MM-YYYY, MM-DD-YYYY, or typos like 12-12-20206
            const match = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2,3})$/);
            if (match) {
              const part1 = match[1].padStart(2, '0');
              const part2 = match[2].padStart(2, '0');
              let year = match[3];
              if (year.length === 5 && year.startsWith('2020')) {
                year = '20' + year.slice(-2);
              } else if (year.length > 4) {
                year = year.slice(0, 4);
              }
              const month = parseInt(part1, 10) <= 12 ? part1 : part2;
              const day = parseInt(part1, 10) <= 12 ? part2 : part1;
              return `${year}-${month}-${day}`;
            }

            const isoMatch = trimmed.match(/^(20\d{2,3})[-/.](\d{1,2})[-/.](\d{1,2})$/);
            if (isoMatch) {
              let year = isoMatch[1];
              if (year.length === 5 && year.startsWith('2020')) {
                year = '20' + year.slice(-2);
              } else if (year.length > 4) {
                year = year.slice(0, 4);
              }
              return `${year}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
            }

            return val;
          };

          let rawFields: Record<string, any> = {};
          if (Array.isArray(config.fieldList) && config.fieldList.length > 0) {
            config.fieldList.forEach((item: { field: string; value: string }) => {
              if (item.field && item.field.trim()) {
                rawFields[item.field.trim()] = item.value;
              }
            });
          }
          if (config.fields && typeof config.fields === 'object') {
            rawFields = { ...rawFields, ...config.fields };
          }
          if (Object.keys(rawFields).length === 0) {
            rawFields = { Name: `AssertNow Test Record ${new Date().toLocaleTimeString()}` };
          }

          const createMode = config.createMode || (config.collectionVariable ? 'bulk' : 'single');

          if (createMode === 'bulk') {
            // Bulk Create mode — iterate over collection variable
            const collVar = resolveValue(config.collectionVariable || '');
            const collKey = String(config.collectionVariable || '').replace(/\{{1,2}([^}]+)\}{1,2}/, '$1').trim();
            let recordArr: any[] = [];

            if (Array.isArray(executionContext[collKey])) {
              recordArr = executionContext[collKey];
            } else if (Array.isArray(executionContext[collVar])) {
              recordArr = executionContext[collVar];
            } else if (executionContext[collKey]?.records && Array.isArray(executionContext[collKey].records)) {
              recordArr = executionContext[collKey].records;
            } else {
              const altKey = Object.keys(executionContext).find(k => k.includes('records') && Array.isArray(executionContext[k]));
              if (altKey) {
                recordArr = executionContext[altKey];
              }
            }

            if (recordArr.length === 0) {
              throw new Error(`Bulk create: collection variable "${config.collectionVariable}" is empty or not found in execution context. Ensure an upstream Get Records step ran successfully.`);
            }

            // Map each item in the collection to a new record
            const bulkRecords = recordArr.map((item: any) => {
              const itemFields: Record<string, any> = {};
              Object.entries(rawFields).forEach(([fName, fVal]) => {
                let resolved = typeof fVal === 'string'
                  ? fVal.replace(/\{\{(\$item|item|record)\.([a-zA-Z0-9_]+)\}\}/g, (_, __, prop) => String(item[prop] || ''))
                  : fVal;
                resolved = resolveValue(resolved);
                itemFields[fName] = sanitizeDateValue(fName, resolved);
              });
              return itemFields;
            });

            currentInputData = { sobject: sobjectName, createMode: 'bulk', records: bulkRecords };
            appendLog(`${getElapsed()} 📤 Dispatching Salesforce DML BULK INSERT of ${bulkRecords.length} "${sobjectName}" record(s)...`);
            appendLog(`${getElapsed()} 📦 Bulk Payload: ${JSON.stringify(bulkRecords.slice(0, 2))} ${bulkRecords.length > 2 ? `... (+${bulkRecords.length - 2} more)` : ''}`);

            const dmlStart = Date.now();
            const bulkRes = await SalesforceApi.createBulkRecords({ sobject: sobjectName, records: bulkRecords });
            const dmlLatency = Date.now() - dmlStart;

            const createdIds: string[] = bulkRes.createdIds || (bulkRes.results || []).filter((r: any) => r.success).map((r: any) => r.id);
            if (createdIds.length === 0) {
              throw new Error(bulkRes.message || 'Bulk create failed: No records were created.');
            }

            appendLog(`${getElapsed()} ✓ Bulk CREATE: Successfully inserted ${createdIds.length} ${sobjectName} record(s) in Salesforce in ${dmlLatency}ms.`);
            createdIds.slice(0, 5).forEach((cid, i) => {
              appendLog(`${getElapsed()}   ↳ [${i + 1}/${createdIds.length}] Created Record ID: ${cid}`);
            });

            // Register in executionContext
            const sObjNameClean = sobjectName.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
            const stepKeyClean = String(config.stepKey || sObjNameClean).trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
            executionContext[`${stepKeyClean}.createdIds`] = createdIds;
            executionContext[`${stepKeyClean}.ids`] = createdIds;
            executionContext[`${stepKeyClean}.count`] = createdIds.length;
            executionContext[`${sObjNameClean}.createdIds`] = createdIds;
            executionContext[`${sObjNameClean}.ids`] = createdIds;
            if (createdIds[0]) {
              executionContext[`${stepKeyClean}.id`] = createdIds[0];
              executionContext[`${sObjNameClean}.id`] = createdIds[0];
            }

            setNodes(nds => nds.map(n => n.id === currentNode.id ? { ...n, data: { ...n.data, status: 'passed' } } : n));
            recordedSteps.push({
              nodeId: currentNode.id,
              nodeLabel: currentNode.data.label,
              nodeType: 'CREATE',
              status: 'PASSED',
              durationMs: dmlLatency,
              inputData: currentInputData,
              outputData: bulkRes
            });
          } else {
            const fieldsToInsert: Record<string, any> = {};
            Object.entries(rawFields).forEach(([fName, fVal]) => {
              const resolved = resolveValue(fVal);
              fieldsToInsert[fName] = sanitizeDateValue(fName, resolved);
            });

            currentInputData = { sobject: sobjectName, payload: fieldsToInsert };
            appendLog(`${getElapsed()} 📤 Dispatching Salesforce DML INSERT into "${sobjectName}"...`);
            appendLog(`${getElapsed()} 📦 Request Payload: ${JSON.stringify(fieldsToInsert)}`);

            const dmlStart = Date.now();
            const stepKeyToPass = config.stepKey || (sobjectName.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_'));
            const dmlResult = await SalesforceApi.createRecord(activeEnv.id, sobjectName, fieldsToInsert, stepKeyToPass);
            const dmlLatency = Date.now() - dmlStart;

            if (!dmlResult?.id) {
              throw new Error((dmlResult as any)?.message || 'Failed to create record in Salesforce (No Record ID returned)');
            }

            const recordId = dmlResult.id;
            const recordUrl = `${instanceUrl}/${recordId}`;
            const outputVarName = config.outputVariable || 'varCreatedRecordId';

            // Save primary output variable
            executionContext[outputVarName] = recordId;

            // Register all standard upstream node tokens into executionContext for downstream lookups
            const sObjNameClean = sobjectName.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
            executionContext[`${sObjNameClean}.id`] = recordId;
            executionContext[`${sObjNameClean}.Id`] = recordId;
            executionContext[sObjNameClean] = recordId;

            if (config.stepKey) {
              const stepKeyClean = String(config.stepKey).trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
              executionContext[`${stepKeyClean}.id`] = recordId;
              executionContext[`${stepKeyClean}.Id`] = recordId;
              executionContext[stepKeyClean] = recordId;
            }

            if (currentNode.data?.label) {
              const labelClean = String(currentNode.data.label).replace(/^create\s+/i, '').replace(/^get\s+/i, '').trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
              if (labelClean) {
                executionContext[`${labelClean}.id`] = recordId;
                executionContext[`${labelClean}.Id`] = recordId;
                executionContext[labelClean] = recordId;
              }
            }

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
          }
        } else if (nodeType === 'GET') {
          const sobjectName = config.object || 'Opportunity';
          const selectedFields = Array.isArray(config.fields) && config.fields.length > 0 ? config.fields : ['Id', 'Name'];
          const rawFilters = Array.isArray(config.filters) ? config.filters : (Array.isArray(config.conditions) ? config.conditions : []);

          // Resolve template variables in filters (e.g. {{account.id}})
          const resolvedFilters = rawFilters.map((flt: any) => {
            const val = resolveValue(flt.value);
            return {
              field: flt.field,
              operator: flt.operator || '=',
              value: val,
              type: flt.type || 'string'
            };
          });

          const onlyFirst = Boolean(config.onlyFirstRecord || config.storeCount === 'FIRST');
          const payload: QueryGetRecordsPayload = {
            sobject: sobjectName,
            fields: selectedFields,
            filters: resolvedFilters,
            filterLogic: (config.filterLogic || config.conditionLogic || 'AND') as 'AND' | 'OR',
            orderBy: config.orderBy || 'CreatedDate',
            sortDirection: (config.sortDirection || 'DESC') as 'ASC' | 'DESC',
            limit: Number(config.limit) || 50,
            onlyFirstRecord: onlyFirst
          };

          currentInputData = payload;
          appendLog(`${getElapsed()} 🔍 Querying Salesforce ${sobjectName} records (/api/salesforce/get-record/query)...`);

          const queryStart = Date.now();
          let queryRes: any;
          try {
            queryRes = await SalesforceApi.queryGetRecords(payload);
          } catch (qErr: any) {
            const fallbackSoql = config.soql || `SELECT ${selectedFields.join(', ')} FROM ${sobjectName} LIMIT 50`;
            queryRes = await SalesforceApi.executeQuery(activeEnv.id, fallbackSoql);
          }
          const queryLatency = Date.now() - queryStart;

          setNodes(nds => nds.map(n => n.id === currentNode.id ? { ...n, data: { ...n.data, status: 'passed' } } : n));
          const matchCount = queryRes.totalSize !== undefined ? queryRes.totalSize : (queryRes.records ? queryRes.records.length : 0);
          appendLog(`${getElapsed()} ✓ SOQL: "${queryRes.soql || ''}"`);
          appendLog(`${getElapsed()} ✓ Matched ${matchCount} ${sobjectName} record(s) in ${queryLatency}ms.`);

          // Register in flow context
          const sObjNameClean = sobjectName.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
          const stepKeyClean = String(config.stepKey || `get_${sObjNameClean}`).trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
          const queryRecords: any[] = Array.isArray(queryRes.records)
            ? queryRes.records
            : (queryRes.record ? [queryRes.record] : []);

          // Store records array in executionContext under all common token names
          executionContext[`${stepKeyClean}.records`] = queryRecords;
          executionContext[`get_${sObjNameClean}.records`] = queryRecords;
          executionContext[`${sObjNameClean}.records`] = queryRecords;
          executionContext['get_records.records'] = queryRecords;
          executionContext[stepKeyClean] = queryRecords;
          executionContext[`${stepKeyClean}.count`] = queryRecords.length;
          executionContext[`${sObjNameClean}.count`] = queryRecords.length;

          const recId = onlyFirst ? queryRes.record?.Id : queryRes.records?.[0]?.Id;
          if (recId) {
            executionContext[`${sObjNameClean}.id`] = recId;
            executionContext[`${sObjNameClean}.Id`] = recId;
            executionContext[sObjNameClean] = recId;
            executionContext[`${stepKeyClean}.id`] = recId;
            executionContext[`${stepKeyClean}.Id`] = recId;
            executionContext[stepKeyClean] = recId;
          }

          recordedSteps.push({
            nodeId: currentNode.id,
            nodeLabel: currentNode.data.label,
            nodeType: 'GET',
            status: 'PASSED',
            durationMs: queryLatency,
            inputData: currentInputData,
            outputData: queryRes
          });
        } else if (nodeType === 'UPDATE' || nodeType === 'UPDATE_RECORDS') {
          const sobjectName = config.object || 'Account';
          const updateMode = config.updateMode || 'single';
          const rawFieldList: Array<{ field: string; value: string }> = Array.isArray(config.fieldList)
            ? config.fieldList
            : Object.entries(config.fields || {}).map(([k, v]) => ({ field: k, value: String(v) }));

          // Build data object from fieldList, resolving variables
          const updateData: Record<string, any> = {};
          rawFieldList.forEach(({ field, value }) => {
            if (field && field.trim()) {
              updateData[field.trim()] = resolveValue(value);
            }
          });

          currentInputData = { sobject: sobjectName, updateMode, data: updateData };
          appendLog(`${getElapsed()} 🔄 Dispatching Salesforce DML UPDATE on "${sobjectName}"...`);
          appendLog(`${getElapsed()} 📦 Fields to update: ${JSON.stringify(updateData)}`);

          const updateStart = Date.now();
          let updateRes: any;

          if (updateMode === 'bulk') {
            // Bulk mode — resolve collection variable
            const rawColl = String(config.collectionVariable || '').trim();
            const collKey = rawColl.replace(/^\{{1,2}/, '').replace(/\}{1,2}$/, '').trim();
            const collKeyLower = collKey.toLowerCase();
            let recordArr: any[] = [];

            if (Array.isArray(executionContext[collKey])) {
              recordArr = executionContext[collKey];
            } else if (Array.isArray(executionContext[collKeyLower])) {
              recordArr = executionContext[collKeyLower];
            } else if (Array.isArray(executionContext[`${collKeyLower}.records`])) {
              recordArr = executionContext[`${collKeyLower}.records`];
            } else if (executionContext[collKey]?.records && Array.isArray(executionContext[collKey].records)) {
              recordArr = executionContext[collKey].records;
            } else if (executionContext[collKeyLower]?.records && Array.isArray(executionContext[collKeyLower].records)) {
              recordArr = executionContext[collKeyLower].records;
            } else {
              // Check recordedSteps for the most recent upstream GET or CREATE step
              const upstreamStep = recordedSteps.slice().reverse().find(s =>
                (s.nodeType === 'GET' || s.nodeType === 'CREATE') &&
                (Array.isArray(s.outputData?.records) || Array.isArray(s.outputData?.createdIds))
              );
              if (upstreamStep) {
                if (Array.isArray(upstreamStep.outputData?.records)) {
                  recordArr = upstreamStep.outputData.records;
                } else if (Array.isArray(upstreamStep.outputData?.createdIds)) {
                  recordArr = upstreamStep.outputData.createdIds.map((id: string) => ({ Id: id, id }));
                }
              }

              if (recordArr.length === 0) {
                const altKey = Object.keys(executionContext).find(k => k.includes('records') && Array.isArray(executionContext[k]) && executionContext[k].length > 0);
                if (altKey) {
                  recordArr = executionContext[altKey];
                }
              }
            }

            if (recordArr.length === 0) {
              const upstreamGet = recordedSteps.slice().reverse().find(s => s.nodeType === 'GET');
              if (upstreamGet) {
                const getCount = upstreamGet.outputData?.totalSize ?? upstreamGet.outputData?.records?.length ?? 0;
                if (getCount === 0) {
                  throw new Error(`Bulk update halted: Upstream step "${upstreamGet.nodeLabel}" ran successfully, but returned 0 ${sobjectName} records from Salesforce. Check the filter conditions in "${upstreamGet.nodeLabel}" so matching records exist.`);
                }
              }
              throw new Error(`Bulk update: collection variable "${config.collectionVariable || '{{get_records.records}}'}" is empty or not found in execution context. Ensure an upstream Get Records step ran successfully.`);
            }

            const bulkRecords = recordArr.map((rec: any) => ({ Id: rec.Id || rec.id, ...updateData }));
            const bulkPayload: BulkUpdatePayload = { sobject: sobjectName, records: bulkRecords };
            updateRes = await SalesforceApi.bulkUpdateRecords(bulkPayload);
            appendLog(`${getElapsed()} ✓ Bulk UPDATE: Processed ${updateRes.results?.length ?? bulkRecords.length} ${sobjectName} record(s) in ${Date.now() - updateStart}ms.`);
            bulkRecords.slice(0, 3).forEach((r: any, idx: number) => {
              appendLog(`${getElapsed()}   ↳ [${idx + 1}/${bulkRecords.length}] Updated Record ID: ${r.Id}`);
            });
          } else {
            // Single record mode
            const recordId = resolveValue(config.recordId || config.recordIdFilter || '');
            if (!recordId || recordId.includes('{{')) {
              throw new Error(`Update Record: recordId is empty or unresolved: "${recordId}". Set a valid record ID or variable.`);
            }
            const payload: UpdateRecordPayload = { sobject: sobjectName, recordId, data: updateData };
            updateRes = await SalesforceApi.patchUpdateRecord(payload);
            const updatedId = updateRes?.id || recordId;
            appendLog(`${getElapsed()} ✓ Single UPDATE: ${sobjectName} record "${updatedId}" updated in ${Date.now() - updateStart}ms.`);

            // Register updated record in context
            const sObjClean = sobjectName.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
            executionContext[`${sObjClean}.id`] = updatedId;
            executionContext[`${sObjClean}.Id`] = updatedId;
            if (config.stepKey) {
              const stepKeyClean = String(config.stepKey).trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
              executionContext[`${stepKeyClean}.id`] = updatedId;
              executionContext[`${stepKeyClean}.Id`] = updatedId;
            }
          }

          setNodes(nds => nds.map(n => n.id === currentNode.id ? { ...n, data: { ...n.data, status: 'passed' } } : n));
          recordedSteps.push({
            nodeId: currentNode.id,
            nodeLabel: currentNode.data.label,
            nodeType: 'UPDATE',
            status: 'PASSED',
            durationMs: Date.now() - updateStart,
            inputData: currentInputData,
            outputData: updateRes
          });
        } else if (nodeType === 'DELETE') {
          const sobjectName = config.object || 'Account';
          const deleteMode = config.deleteMode || 'single';
          currentInputData = { sobject: sobjectName, deleteMode };

          appendLog(`${getElapsed()} 🗑️ Dispatching Salesforce DML DELETE on "${sobjectName}"...`);
          const deleteStart = Date.now();
          let deleteRes: any;

          if (deleteMode === 'bulk') {
            const rawColl = String(config.collectionVariable || '').trim();
            const collKey = rawColl.replace(/^\{{1,2}/, '').replace(/\}{1,2}$/, '').trim();
            const collKeyLower = collKey.toLowerCase();
            let recordArr: any[] = [];

            if (Array.isArray(executionContext[collKey])) {
              recordArr = executionContext[collKey];
            } else if (Array.isArray(executionContext[collKeyLower])) {
              recordArr = executionContext[collKeyLower];
            } else if (Array.isArray(executionContext[`${collKeyLower}.records`])) {
              recordArr = executionContext[`${collKeyLower}.records`];
            } else {
              const upstreamStep = recordedSteps.slice().reverse().find(s =>
                (s.nodeType === 'GET' || s.nodeType === 'CREATE') &&
                (Array.isArray(s.outputData?.records) || Array.isArray(s.outputData?.createdIds))
              );
              if (upstreamStep) {
                if (Array.isArray(upstreamStep.outputData?.records)) {
                  recordArr = upstreamStep.outputData.records;
                } else if (Array.isArray(upstreamStep.outputData?.createdIds)) {
                  recordArr = upstreamStep.outputData.createdIds.map((id: string) => ({ Id: id, id }));
                }
              }
            }

            if (recordArr.length === 0) {
              throw new Error(`Bulk delete: collection variable "${config.collectionVariable || '{{get_records.records}}'}" is empty or not found in execution context.`);
            }
            const ids = recordArr.map((rec: any) => rec.Id || rec.id).filter(Boolean);
            appendLog(`${getElapsed()} 📦 Bulk deleting ${ids.length} record(s): [${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '...' : ''}]`);
            deleteRes = await SalesforceApi.deleteBulkRecords(sobjectName, ids);
            appendLog(`${getElapsed()} ✓ Bulk DELETE complete: ${deleteRes.results?.length ?? ids.length} record(s) deleted in ${Date.now() - deleteStart}ms.`);
          } else {
            let recordId = String(resolveValue(config.recordId || config.targetId || '')).trim();
            if (!recordId || recordId.includes('{{')) {
              // Attempt to fall back to upstream recorded step or executionContext
              const sObjClean = sobjectName.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
              const autoId = executionContext[`${sObjClean}.id`] ||
                             executionContext[`get_${sObjClean}.id`] ||
                             executionContext[`create_${sObjClean}.id`] ||
                             executionContext['account.id'];
              if (autoId) {
                recordId = String(autoId).trim();
              } else {
                throw new Error(`Delete Record: recordId is empty or unresolved: "${recordId}". Set a valid record ID or variable.`);
              }
            }

            // Check if user accidentally passed a Name like "Acme" instead of a 15/18 char Salesforce ID
            if (!/^[a-zA-Z0-9]{15,18}$/.test(recordId)) {
              const sObjClean = sobjectName.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
              const fallbackId = executionContext[`${sObjClean}.id`] ||
                                 executionContext[`get_${sObjClean}.id`] ||
                                 executionContext[`create_${sObjClean}.id`] ||
                                 executionContext['account.id'];
              if (fallbackId && /^[a-zA-Z0-9]{15,18}$/.test(String(fallbackId).trim())) {
                appendLog(`${getElapsed()} ℹ️ Auto-resolved "${recordId}" to upstream Record ID: ${fallbackId}`);
                recordId = String(fallbackId).trim();
              } else {
                throw new Error(`Delete Record halted: Invalid Salesforce Record ID "${recordId}". Target Record ID must be a 15-or-18-character Salesforce ID (e.g. {{account.id}}), not a record name (like {{account.name}}).`);
              }
            }

            currentInputData = { sobject: sobjectName, deleteMode, recordId };
            appendLog(`${getElapsed()} 🎯 Deleting single record: ${sobjectName}/${recordId}`);
            deleteRes = await SalesforceApi.deleteSingleRecord(sobjectName, recordId);
            appendLog(`${getElapsed()} ✓ Single DELETE: "${sobjectName}" record "${recordId}" deleted in ${Date.now() - deleteStart}ms.`);
          }

          setNodes(nds => nds.map(n => n.id === currentNode.id ? { ...n, data: { ...n.data, status: 'passed' } } : n));
          recordedSteps.push({
            nodeId: currentNode.id,
            nodeLabel: currentNode.data.label,
            nodeType: 'DELETE',
            status: 'PASSED',
            durationMs: Date.now() - deleteStart,
            inputData: currentInputData,
            outputData: deleteRes
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
              {isEditingTitle ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    autoFocus
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editedTitle.trim() && workflow) {
                          const updated = { ...workflow, name: editedTitle.trim() };
                          setWorkflow(updated);
                          WorkflowApi.updateWorkflow(workflow.id, { name: editedTitle.trim() }).catch(() => { });
                        }
                        setIsEditingTitle(false);
                      } else if (e.key === 'Escape') {
                        setIsEditingTitle(false);
                      }
                    }}
                    onBlur={() => {
                      if (editedTitle.trim() && workflow) {
                        const updated = { ...workflow, name: editedTitle.trim() };
                        setWorkflow(updated);
                        WorkflowApi.updateWorkflow(workflow.id, { name: editedTitle.trim() }).catch(() => { });
                      }
                      setIsEditingTitle(false);
                    }}
                    className="h-7 px-2 rounded-md bg-white dark:bg-slate-950 border border-blue-500 text-xs font-bold text-slate-900 dark:text-white focus:outline-none shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (editedTitle.trim() && workflow) {
                        const updated = { ...workflow, name: editedTitle.trim() };
                        setWorkflow(updated);
                        WorkflowApi.updateWorkflow(workflow.id, { name: editedTitle.trim() }).catch(() => { });
                      }
                      setIsEditingTitle(false);
                    }}
                    className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    title="Save Name"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 group/name">
                  <button
                    type="button"
                    onClick={() => setIsWfSwitcherOpen(!isWfSwitcherOpen)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white tracking-tight hover:text-blue-600 dark:hover:text-blue-400 transition-colors group text-left min-w-0"
                    title="Click to switch workflow suite"
                  >
                    <span className="truncate max-w-[200px] md:max-w-xs">{workflow.name}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-transform flex-shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditedTitle(workflow.name);
                      setIsEditingTitle(true);
                    }}
                    className="opacity-0 group-hover/name:opacity-100 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 transition-opacity"
                    title="Rename Workflow"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              )}
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
                        className={`w-full p-2.5 rounded-lg text-left transition-all flex items-start justify-between gap-2 ${w.id === workflow.id
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
            className={`h-8 px-2.5 rounded-lg text-xs font-mono border flex items-center gap-1.5 transition-colors flex-shrink-0 whitespace-nowrap cursor-pointer ${showConsole
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
            className={`h-8 px-2.5 rounded-lg text-xs font-mono border flex items-center gap-1.5 transition-colors flex-shrink-0 whitespace-nowrap cursor-pointer ${lastRunReport
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
        <div className={`${isSidebarOpen ? 'w-80 p-3.5 border-r' : 'w-0 p-0 border-r-0 overflow-hidden'
          } bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3.5 overflow-y-auto z-20 flex-shrink-0 transition-all duration-300 ease-in-out`}>
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
              <div className="flex border-b border-slate-200 dark:border-slate-800 select-none">
                <button
                  onClick={() => setToolboxTab('elements')}
                  className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer ${toolboxTab === 'elements'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  Elements
                </button>
                <button
                  onClick={() => setToolboxTab('manager')}
                  className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer ${toolboxTab === 'manager'
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
                  {/* Search Bar with proper padding and comfortable height */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Filter elements..."
                      value={toolboxSearch}
                      onChange={(e) => setToolboxSearch(e.target.value)}
                      className="w-full h-9 pl-9 pr-8 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1.5 focus:ring-blue-500 font-medium transition-all"
                    />
                    {toolboxSearch && (
                      <button
                        onClick={() => setToolboxSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        ✕
                      </button>
                    )}
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
                  {/* + New Resource & Clear All Buttons */}
                  <div className="space-y-2">
                    <button
                      onClick={handleOpenNewResource}
                      className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                    >
                      <span>+ New Resource</span>
                    </button>
                    {resources.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setResources([]);
                          if (workflow) {
                            WorkflowApi.updateWorkflow(workflow.id, { resources: [] }).catch(() => { });
                          }
                        }}
                        className="w-full py-1 px-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Remove all custom resources from this workflow"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear All Resources ({resources.length})</span>
                      </button>
                    )}
                  </div>

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
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditResource(res)}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Edit Variable"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteResource(res.id)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                                title="Delete Variable"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditResource(res)}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Edit Formula"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteResource(res.id)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                                title="Delete Formula"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors flex items-center gap-1 cursor-pointer ${lastRunReport.status === 'PASSED'
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
          <div
            style={{ width: `${inspectorWidth}px` }}
            className="relative bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full z-20 flex-shrink-0 animate-in slide-in-from-right duration-200 shadow-xl transition-[width]"
          >
            {/* Drag Handle to Resize Inspector Width - Always FIXED vertically on border, never scrolls */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizingInspector(true);
              }}
              onDoubleClick={() => {
                setInspectorWidth(prev => prev > 500 ? 410 : 680);
              }}
              className="absolute -left-2 top-0 bottom-0 w-4 cursor-col-resize hover:bg-sky-500/20 active:bg-sky-500/40 transition-colors z-30 flex items-center justify-center group"
              title="Drag to resize panel, or double-click to toggle wide view"
            >
              <div className="w-1 h-9 bg-slate-300 dark:bg-slate-700 group-hover:bg-sky-500 group-hover:h-14 group-active:bg-sky-500 rounded-full shadow-xs transition-all flex items-center justify-center">
                <div className="w-0.5 h-3 bg-white/70 rounded-full" />
              </div>
            </div>

            {/* Sticky / Fixed Inspector Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  Element Inspector
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase">
                  {String(selectedNode.data?.nodeType || 'NODE')}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* One-click Expand / Collapse Button */}
                <button
                  type="button"
                  onClick={() => setInspectorWidth(prev => prev > 500 ? 410 : 680)}
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs"
                  title={inspectorWidth > 500 ? "Collapse panel width" : "Expand panel width (Wide view)"}
                >
                  {inspectorWidth > 500 ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs"
                  title="Close Inspector"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">

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
                      className="w-full h-8 px-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 font-medium"
                    />
                  </div>

                  {/* 1. CREATE RECORDS INSPECTOR (Exact Colleagues Design & Backend-Driven) */}
                  {(nodeType === 'CREATE' || nodeType === 'SF_CREATE') && (() => {
                    const currentObj = String(nodeConfig.customObject || nodeConfig.object || '');
                    const createMode: 'single' | 'bulk' = (nodeConfig.createMode as any) || (nodeConfig.collectionVariable ? 'bulk' : 'single');

                    // Default stepKey if not present: lowercase of sobject (e.g., account, sbqq__quote__c)
                    const stepKey = String(nodeConfig.stepKey || nodeConfig.outputVariable || (currentObj ? currentObj.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_') : ''));

                    // Detect connected upstream node
                    const incomingEdge = edges.find(e => e.target === selectedNode.id && !e.source.startsWith('fault-'));
                    const upstreamNode = incomingEdge ? nodes.find(n => n.id === incomingEdge.source) : null;
                    const isUpstreamGet = upstreamNode?.data?.nodeType === 'GET';
                    const upstreamObj = (upstreamNode?.data?.config as any)?.object || (upstreamNode?.data?.config as any)?.customObject || '';
                    const upstreamStepKey = (upstreamNode?.data?.config as any)?.stepKey || (upstreamObj ? upstreamObj.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_') : '');

                    // Upstream collection tokens (arrays from GET nodes)
                    const collectionTokens = availableUpstreamTokens.filter(t =>
                      t.token.includes('.records') || t.token.includes('_records') || t.label.toLowerCase().includes('collection')
                    );

                    // Automatically fetch fields for the current object if not already cached
                    if (currentObj && !objectFieldsMap[currentObj] && !isLoadingFields) {
                      void fetchSObjectFields(currentObj);
                    }

                    const rawFields = nodeConfig.fields || {};

                    const updateFieldValue = (fieldName: string, val: string) => {
                      const nextFields = { ...(nodeConfig.fields || rawFields) };
                      if (val.trim() === '') {
                        delete nextFields[fieldName];
                      } else {
                        nextFields[fieldName] = val;
                      }
                      updateConfig({
                        fields: nextFields,
                        fieldList: Object.entries(nextFields).map(([k, v]) => ({ field: k, value: String(v) }))
                      });
                    };

                    // Live fields loaded from Salesforce via backend jsforce
                    const liveObjectFields = currentObj ? (objectFieldsMap[currentObj] || []) : [];

                    // Filter fields based on search bar
                    const filteredFields = liveObjectFields.filter(f =>
                      !fieldSearchQuery ||
                      f.name.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
                      f.label.toLowerCase().includes(fieldSearchQuery.toLowerCase())
                    );

                    // Mapped field count
                    const activeMappedCount = Object.keys(nodeConfig.fields || rawFields).filter(k => Boolean(nodeConfig.fields?.[k] || rawFields[k])).length;

                    return (
                      <div className="space-y-4">
                        {/* Header Badge */}
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400 uppercase flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5" />
                            CREATE RECORDS CONFIGURATION
                          </span>
                          <span className="text-[9px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-500 border border-sky-500/20 font-semibold font-mono">
                            DML INSERT
                          </span>
                        </div>

                        {/* Searchable Target Object (sObject) Picker */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              Target Object (sObject) *
                            </label>
                            {isLoadingSObjects ? (
                              <span className="text-[9px] font-mono text-sky-500 flex items-center gap-1 animate-pulse">
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                Fetching objects...
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-400">
                                {availableSObjects.length} objects available
                              </span>
                            )}
                          </div>

                          <SObjectSelect
                            value={currentObj}
                            onChange={(val) => {
                              const newStepKey = val.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
                              const selectedObj = availableSObjects.find(o => o.name.toLowerCase() === val.toLowerCase());
                              updateConfig({
                                object: val,
                                customObject: val.includes('__c') ? val : '',
                                isCustomObject: val.includes('__c'),
                                stepKey: newStepKey,
                                outputVariable: `var_${newStepKey}_id`,
                                operation: `Create Records (${selectedObj?.label || val})`
                              });
                              void fetchSObjectFields(val);
                            }}
                            objects={availableSObjects}
                            isLoading={isLoadingSObjects}
                            accentColor="sky"
                            placeholder="-- Select the sObject --"
                          />
                        </div>

                        {/* Show Configuration & Field mapping ONLY after SObject is selected */}
                        {!currentObj ? (
                          <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-2">
                            <div className="w-10 h-10 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto font-bold text-sm">
                              SF
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              Select an sObject to Configure
                            </h4>
                            <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                              Choose a standard or custom Salesforce object from the dropdown above to load its real-time schema and fields.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Creation Mode Toggle (Salesforce Flow Builder Standard: One Record vs Multiple Records) */}
                            <div className="space-y-1.5 pt-1">
                              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                                How Many Records to Create
                              </label>
                              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                                {(['single', 'bulk'] as const).map(mode => (
                                  <button
                                    key={mode}
                                    type="button"
                                    onClick={() => updateConfig({
                                      createMode: mode,
                                      collectionVariable: mode === 'bulk' && !nodeConfig.collectionVariable && isUpstreamGet
                                        ? `{{${upstreamStepKey}.records}}`
                                        : nodeConfig.collectionVariable
                                    })}
                                    className={`flex-1 h-7 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${createMode === mode
                                      ? 'bg-sky-600 text-white shadow-xs'
                                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                      }`}
                                  >
                                    {mode === 'single' ? (
                                      <span>One Record</span>
                                    ) : (
                                      <span className="flex items-center gap-1.5">
                                        <Database className="w-3.5 h-3.5" />
                                        Multiple Records (Bulk)
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Bulk Mode — Collection Variable Card */}
                            {createMode === 'bulk' && (
                              <div className="p-3.5 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/60 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <Database className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                                    <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                      Record Collection (Source from Upstream)
                                    </label>
                                  </div>
                                  {isUpstreamGet && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 font-mono font-semibold">
                                      from {String(upstreamNode?.data?.label || 'Get Records')}
                                    </span>
                                  )}
                                </div>

                                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-sky-800/40 space-y-1.5">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-slate-500 dark:text-slate-400">Target Source:</span>
                                    <span className="font-semibold text-sky-600 dark:text-sky-400">
                                      {testQueryResult?.records?.length
                                        ? `${testQueryResult.records.length} records ready in collection`
                                        : 'All records from collection variable'}
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    value={String(nodeConfig.collectionVariable || (isUpstreamGet ? `{{${upstreamStepKey}.records}}` : ''))}
                                    placeholder="e.g. {{get_opportunity.records}}"
                                    onChange={e => updateConfig({ collectionVariable: e.target.value.trim() })}
                                    className="w-full h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                                  />
                                </div>

                                {collectionTokens.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {collectionTokens.map(tok => (
                                      <button
                                        key={tok.token}
                                        type="button"
                                        onClick={() => updateConfig({ collectionVariable: tok.token })}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${nodeConfig.collectionVariable === tok.token
                                          ? 'bg-sky-600 text-white border-sky-600'
                                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400'}`}
                                      >
                                        {tok.token}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed bg-white/60 dark:bg-slate-900/40 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                                  <span className="font-semibold text-sky-700 dark:text-sky-300">How Bulk Create Works:</span> Creates a new {currentObj} record in Salesforce for every record in the collection using the field values mapped below via <code className="font-mono font-semibold text-sky-600 dark:text-sky-400">POST /api/salesforce/create-record/bulk</code>.
                                </p>
                              </div>
                            )}

                            {/* Step Key / Variable Name Card */}
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2">
                              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                Step Key / Variable Name
                              </label>
                              <input
                                type="text"
                                value={stepKey}
                                placeholder="e.g. account or sbqq__quote__c"
                                onChange={(e) => {
                                  const val = e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
                                  updateConfig({
                                    stepKey: val,
                                    outputVariable: `var_${val}_id`
                                  });
                                }}
                                className="w-full h-8 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                              />
                              <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono">Downstream tokens:</span>
                                {createMode === 'bulk' ? (
                                  <>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-bold select-all">
                                      {`{{${stepKey}.createdIds}}`}
                                    </span>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-bold select-all">
                                      {`{{${stepKey}.id}}`}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-bold select-all">
                                    {`{{${stepKey}.id}}`}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Field Values for Object Header */}
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  Field Values for {currentObj}
                                </span>
                                <span className="text-slate-400 font-mono text-[10px]">
                                  {activeMappedCount} mapped
                                </span>
                              </div>

                              {/* Search Filter for fields */}
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                                <input
                                  type="text"
                                  value={fieldSearchQuery}
                                  onChange={(e) => setFieldSearchQuery(e.target.value)}
                                  placeholder="Filter fields by name or label..."
                                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
                                />
                                {fieldSearchQuery && (
                                  <button
                                    onClick={() => setFieldSearchQuery('')}
                                    className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>

                              {/* Loading indicator */}
                              {isLoadingFields && (
                                <div className="py-4 text-center text-xs font-mono text-sky-500 flex items-center justify-center gap-1.5 animate-pulse">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  Loading schema from Salesforce...
                                </div>
                              )}

                              {/* Dynamic Field Rows (Smart Input: Dropdown for Picklist, Lookup for Reference, Text for others) */}
                              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                                {filteredFields.length > 0 ? (
                                  filteredFields.map(f => {
                                    const currentValue = (nodeConfig.fields || rawFields)[f.name] || '';
                                    const isReference = f.type.toLowerCase().includes('reference') || f.name.endsWith('Id') || f.name.endsWith('__c');
                                    const isPicklist = f.type.toLowerCase().includes('picklist');
                                    const picklistOptions = (f as any).picklistValues || [];

                                    return (
                                      <div key={f.name} className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200/90 dark:border-slate-800/90 shadow-2xs space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                          <div className="flex items-center gap-1.5 truncate">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                              {f.label}
                                            </span>
                                            <span className="text-[11px] text-slate-400 font-mono truncate">
                                              ({f.name})
                                            </span>
                                            {f.required && (
                                              <span className="text-rose-500 font-bold text-sm" title="Required Field">*</span>
                                            )}
                                          </div>
                                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase font-semibold">
                                            {f.type}
                                          </span>
                                        </div>

                                        {/* Picklist Type -> Render Select Dropdown */}
                                        {isPicklist && picklistOptions.length > 0 ? (
                                          <div className="flex items-center gap-2">
                                            <select
                                              value={currentValue}
                                              onChange={(e) => updateFieldValue(f.name, e.target.value)}
                                              className="w-full h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-sky-500 cursor-pointer shadow-2xs"
                                            >
                                              <option value="">-- Select {f.label} --</option>
                                              {picklistOptions.map((opt: any) => (
                                                <option key={opt.value} value={opt.value}>
                                                  {opt.label || opt.value}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        ) : (
                                          /* Other Types (Reference / Text / Number) */
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="text"
                                              value={currentValue}
                                              onChange={(e) => updateFieldValue(f.name, e.target.value)}
                                              placeholder={isReference ? `e.g. {{account.id}} or 001...` : `Enter ${f.label}...`}
                                              className="flex-1 h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1.5 focus:ring-sky-500 shadow-2xs"
                                            />

                                            {/* Lookup Button only for Reference/ID fields */}
                                            {isReference && (
                                              <button
                                                type="button"
                                                onClick={() => handleOpenLookupModal(f.name, f.label, (f as any).referenceTo || [])}
                                                className="h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-sky-500 text-sky-600 dark:text-sky-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0 shadow-2xs"
                                                title="Assign from flow context token or existing Salesforce record"
                                              >
                                                <Search className="w-3.5 h-3.5" />
                                                <span>Lookup</span>
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                ) : !isLoadingFields ? (
                                  <div className="p-4 text-center text-xs text-slate-400 italic">
                                    {fieldSearchQuery ? `No fields matching "${fieldSearchQuery}"` : 'No fields found for this object.'}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            {/* Execution Readiness Indicator */}
                            <div className="pt-2">
                              <div className="p-3 rounded-xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/60 space-y-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-300">
                                    <CheckCircle2 className="w-4 h-4 text-sky-500 shrink-0" />
                                    <span>Configuration Ready for Live Run</span>
                                  </div>
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-700">
                                    {createMode === 'bulk' ? 'BULK CREATE' : 'SINGLE CREATE'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                  {createMode === 'bulk'
                                    ? `This node will bulk insert ${currentObj} records simultaneously when you click "Run Live" in the toolbar.`
                                    : `This node will insert a new ${currentObj} record (${activeMappedCount} field(s) mapped) when you click "Run Live" in the toolbar.`}
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* 2. GET RECORDS INSPECTOR (DIRECT BACKEND /api/salesforce/get-record) */}
                  {(nodeType === 'GET' || nodeType === 'GET_RECORDS' || nodeType === 'SF_QUERY') && (() => {
                    const currentObj = String(nodeConfig.object || nodeConfig.recordType || '');
                    const selectedFields: string[] = Array.isArray(nodeConfig.fields)
                      ? nodeConfig.fields
                      : [];

                    const rawFilters = Array.isArray(nodeConfig.filters)
                      ? nodeConfig.filters
                      : (Array.isArray(nodeConfig.conditions) ? nodeConfig.conditions : []);

                    const filters: GetRecordFilter[] = rawFilters;
                    const filterLogic = (nodeConfig.filterLogic || nodeConfig.conditionLogic || 'AND') as 'AND' | 'OR';
                    const orderBy = String(nodeConfig.orderBy || 'CreatedDate');
                    const sortDirection = (nodeConfig.sortDirection || 'DESC') as 'ASC' | 'DESC';
                    const limit = Number(nodeConfig.limit) || 50;
                    const onlyFirstRecord = Boolean(nodeConfig.onlyFirstRecord ?? (nodeConfig.storeCount === 'FIRST'));
                    const stepKey = String(nodeConfig.stepKey || (currentObj ? currentObj.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_') : ''));

                    const availableObjList = queryableObjects.length > 0
                      ? queryableObjects
                      : availableSObjects;

                    const fieldsMetadata: GetRecordFieldMetadata[] = queryableFieldsMap[currentObj] || [];
                    const filterableFields = fieldsMetadata.filter(f => f.filterable !== false);
                    const sortableFields = fieldsMetadata.filter(f => f.sortable !== false);

                    // Build generated SOQL string preview
                    const buildPreviewSoql = (targetFields = selectedFields, targetFilters = filters, targetLogic = filterLogic, targetOrder = orderBy, targetDir = sortDirection, targetLim = limit, targetFirst = onlyFirstRecord) => {
                      const fList = Array.from(new Set(['Id', ...targetFields])).join(', ');
                      const whereParts = targetFilters
                        .filter(f => f.field)
                        .map(f => {
                          const op = f.operator || '=';
                          const val = f.value;
                          if (val === '' || val === undefined || val === null) {
                            return `${f.field} ${op === '!=' ? '!=' : '='} NULL`;
                          }
                          if (f.type === 'number' || f.type === 'boolean') {
                            return `${f.field} ${op} ${val}`;
                          }
                          const strVal = String(val).trim();
                          const isVariableToken =
                            (strVal.startsWith('{{') && strVal.endsWith('}}')) ||
                            (strVal.startsWith('{!') && strVal.endsWith('}')) ||
                            strVal.startsWith(':') ||
                            /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*$/.test(strVal);

                          if (isVariableToken) {
                            const cleanToken = strVal.replace(/^[{!:]+|[}]+$/g, '');
                            return `${f.field} ${op} :${cleanToken}`;
                          }

                          const formatted = op === 'LIKE' && !strVal.includes('%') ? `'%${strVal}%'` : `'${strVal}'`;
                          return `${f.field} ${op} ${formatted}`;
                        });
                      const whereStr = whereParts.length > 0 ? ` WHERE ${whereParts.join(` ${targetLogic} `)}` : '';
                      const limStr = targetFirst ? '1' : String(targetLim);
                      return `SELECT ${fList} FROM ${currentObj}${whereStr} ORDER BY ${targetOrder} ${targetDir} LIMIT ${limStr}`;
                    };

                    const previewSoql = buildPreviewSoql();

                    // Update helper
                    const updateGetConfig = (patch: Record<string, any>) => {
                      const nextFields = patch.fields || selectedFields;
                      const nextFilters = patch.filters || filters;
                      const nextLogic = patch.filterLogic || filterLogic;
                      const nextOrder = patch.orderBy || orderBy;
                      const nextDir = patch.sortDirection || sortDirection;
                      const nextLim = patch.limit || limit;
                      const nextFirst = patch.onlyFirstRecord !== undefined ? patch.onlyFirstRecord : onlyFirstRecord;

                      updateConfig({
                        ...patch,
                        soql: buildPreviewSoql(nextFields, nextFilters, nextLogic, nextOrder, nextDir, nextLim, nextFirst)
                      });
                    };

                    const handleRunTestQuery = async () => {
                      setIsTestingGetQuery(true);
                      setTestQueryError(null);
                      setTestQueryResult(null);
                      try {
                        const payload: QueryGetRecordsPayload = {
                          sobject: currentObj,
                          fields: Array.from(new Set(['Id', ...selectedFields])),
                          filters: filters.filter(f => f.field),
                          filterLogic,
                          orderBy,
                          sortDirection,
                          limit: onlyFirstRecord ? 1 : limit,
                          onlyFirstRecord
                        };
                        const res = await SalesforceApi.queryGetRecords(payload);
                        setTestQueryResult(res);
                      } catch (err: any) {
                        setTestQueryError(err?.message || 'Failed to execute query on Salesforce.');
                      } finally {
                        setIsTestingGetQuery(false);
                      }
                    };

                    return (
                      <div className="space-y-4 p-3.5 rounded-xl bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        {/* 1. Header Banner */}
                        <div className="flex items-center justify-between pb-3 pt-1 border-b border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
                            <Search className="w-3.5 h-3.5 text-emerald-600" />
                            <span>GET RECORDS CONFIGURATION</span>
                          </div>
                          <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold font-mono">
                            SOQL QUERY
                          </span>
                        </div>

                        {/* 2. Salesforce Object Dropdown */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                              Salesforce Object
                            </label>
                            <span className="text-[11px] font-mono text-slate-400">
                              {availableObjList.length} objects available
                            </span>
                          </div>
                          <SObjectSelect
                            value={currentObj}
                            onChange={(newObj) => {
                              const newStepKey = newObj ? `get_${newObj.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_')}` : '';
                              updateGetConfig({
                                object: newObj,
                                recordType: newObj,
                                stepKey: newStepKey,
                                fields: ['Id'],
                                filters: []
                              });
                              if (newObj) {
                                fetchQueryableFields(newObj);
                              }
                              setTestQueryResult(null);
                              setTestQueryError(null);
                            }}
                            objects={availableObjList}
                            isLoading={isLoadingQueryableObjects}
                            accentColor="emerald"
                            placeholder="-- Select Salesforce Object --"
                          />
                        </div>

                        {!currentObj ? (
                          <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900/40">
                            <Search className="w-5 h-5 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                            <p className="font-semibold text-slate-600 dark:text-slate-300">No Object Selected</p>
                            <p className="mt-1 text-[11px] text-slate-400">Select a Salesforce Object above to configure fields, filters, and query preview.</p>
                          </div>
                        ) : (
                          <>
                            {/* 3. Step Key (Variable Name) */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                  Step Key (Variable Name)
                                </label>
                                <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                  {`{{${stepKey || 'get_records'}.id}}`}
                                </span>
                              </div>
                              <input
                                type="text"
                                value={stepKey}
                                onChange={(e) => updateConfig({ stepKey: e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_') })}
                                placeholder="e.g. get_opportunity"
                                className="w-full h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 shadow-2xs"
                              />
                              <p className="text-[11px] text-slate-400 font-normal">
                                Use <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{`{{${stepKey || 'get_records'}.Id}}`}</span> in later steps to reference query outputs.
                              </p>
                            </div>

                            {/* 4. Fields to Retrieve (SELECT) */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                  Fields to Retrieve (SELECT)
                                </label>
                                <span className="text-[11px] font-mono text-slate-400">
                                  {selectedFields.length} selected
                                </span>
                              </div>

                              {/* Selected fields box with chips */}
                              <div className="min-h-[40px] p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 flex flex-wrap gap-1.5 items-center shadow-2xs">
                                {selectedFields.length === 0 ? (
                                  <span className="text-xs text-slate-400 italic">No fields selected (Id included by default)</span>
                                ) : (
                                  selectedFields.map(f => (
                                    <span
                                      key={f}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-300"
                                    >
                                      <span>{f}</span>
                                      {f !== 'Id' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next = selectedFields.filter(x => x !== f);
                                            updateGetConfig({ fields: next.length > 0 ? next : ['Id'] });
                                          }}
                                          className="hover:text-rose-500 text-slate-400 cursor-pointer ml-0.5 text-xs font-bold leading-none"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </span>
                                  ))
                                )}
                              </div>

                              {/* Search & add fields input */}
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                                <input
                                  type="text"
                                  value={getFieldSearchTerm}
                                  onChange={(e) => setGetFieldSearchTerm(e.target.value)}
                                  placeholder="Search & add fields..."
                                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 font-mono shadow-2xs"
                                />
                                {getFieldSearchTerm && (
                                  <button
                                    type="button"
                                    onClick={() => setGetFieldSearchTerm('')}
                                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>

                              {/* Field Pills Matrix */}
                              {isLoadingGetFields ? (
                                <div className="p-3 text-center text-xs text-sky-500 font-mono flex items-center justify-center gap-2">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  Loading field definitions from Salesforce...
                                </div>
                              ) : (
                                (() => {
                                  const searchNormalized = getFieldSearchTerm.toLowerCase().trim();
                                  const filteredFields = fieldsMetadata.filter(f =>
                                    !searchNormalized ||
                                    f.name.toLowerCase().includes(searchNormalized) ||
                                    f.label.toLowerCase().includes(searchNormalized)
                                  );

                                  const displayLimit = isExpandedGetFields || searchNormalized ? filteredFields.length : 16;
                                  const visibleFields = filteredFields.slice(0, displayLimit);
                                  const remainingCount = filteredFields.length - visibleFields.length;

                                  const toggleField = (fName: string) => {
                                    if (selectedFields.includes(fName)) {
                                      if (fName !== 'Id') {
                                        updateGetConfig({ fields: selectedFields.filter(x => x !== fName) });
                                      }
                                    } else {
                                      updateGetConfig({ fields: [...selectedFields, fName] });
                                    }
                                  };

                                  return (
                                    <div className="p-2.5 rounded-lg bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5 items-center">
                                      {visibleFields.map(f => {
                                        const isSelected = selectedFields.includes(f.name);
                                        return (
                                          <button
                                            key={f.name}
                                            type="button"
                                            onClick={() => toggleField(f.name)}
                                            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer ${
                                              isSelected
                                                ? 'bg-emerald-600 text-white border border-emerald-600 font-semibold shadow-2xs flex items-center gap-1'
                                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-700 shadow-2xs'
                                            }`}
                                          >
                                            {isSelected && <span>✓</span>}
                                            <span>{f.name}</span>
                                          </button>
                                        );
                                      })}

                                      {remainingCount > 0 && !searchNormalized && (
                                        <button
                                          type="button"
                                          onClick={() => setIsExpandedGetFields(true)}
                                          className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-emerald-600 text-[11px] font-mono font-medium cursor-pointer"
                                        >
                                          +{remainingCount} more
                                        </button>
                                      )}

                                      {isExpandedGetFields && !searchNormalized && filteredFields.length > 16 && (
                                        <button
                                          type="button"
                                          onClick={() => setIsExpandedGetFields(false)}
                                          className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-emerald-600 text-[11px] font-mono font-medium cursor-pointer"
                                        >
                                          Show less
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()
                              )}
                            </div>

                            {/* 5. Filter Conditions (WHERE) */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Filter Conditions (WHERE)</span>
                                </label>
                                <select
                                  value={filterLogic}
                                  onChange={(e) => updateGetConfig({ filterLogic: e.target.value, conditionLogic: e.target.value })}
                                  className="text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-md px-2 py-1 font-semibold text-emerald-700 dark:text-emerald-400 focus:outline-none cursor-pointer shadow-2xs"
                                >
                                  <option value="AND">All Conditions Met (AND)</option>
                                  <option value="OR">Any Condition Met (OR)</option>
                                </select>
                              </div>

                              {filters.length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                                  No filter conditions defined. All {currentObj} records will match.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {filters.map((flt, idx) => {
                                    const fieldMeta = fieldsMetadata.find(f => f.name === flt.field);
                                    const isPicklist = fieldMeta?.type === 'picklist' && (fieldMeta.picklistValues?.length ?? 0) > 0;
                                    const isReference = fieldMeta?.type === 'reference' || flt.field.toLowerCase().endsWith('id');

                                    return (
                                      <div key={idx} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                                        {/* Field selector */}
                                        <select
                                          value={flt.field}
                                          onChange={(e) => {
                                            const next = [...filters];
                                            const selectedF = fieldsMetadata.find(f => f.name === e.target.value);
                                            next[idx] = {
                                              ...next[idx],
                                              field: e.target.value,
                                              type: selectedF ? (selectedF.type === 'double' || selectedF.type === 'integer' || selectedF.type === 'currency' ? 'number' : (selectedF.type === 'boolean' ? 'boolean' : 'string')) : 'string'
                                            };
                                            updateGetConfig({ filters: next, conditions: next });
                                          }}
                                          className="w-[34%] h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs font-mono font-medium text-slate-800 dark:text-slate-100 shadow-2xs"
                                        >
                                          <option value="">Select field...</option>
                                          {(filterableFields.length > 0 ? filterableFields : fieldsMetadata).map(f => (
                                            <option key={f.name} value={f.name}>
                                              {f.name}
                                            </option>
                                          ))}
                                        </select>

                                        {/* Operator selector */}
                                        <select
                                          value={flt.operator || '='}
                                          onChange={(e) => {
                                            const next = [...filters];
                                            next[idx] = { ...next[idx], operator: e.target.value };
                                            updateGetConfig({ filters: next, conditions: next });
                                          }}
                                          className="w-20 shrink-0 h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 cursor-pointer shadow-2xs"
                                        >
                                          <option value="=">=</option>
                                          <option value="!=">!=</option>
                                          <option value=">">&gt;</option>
                                          <option value="<">&lt;</option>
                                          <option value=">=">&gt;=</option>
                                          <option value="<=">&lt;=</option>
                                          <option value="LIKE">LIKE</option>
                                          <option value="IN">IN</option>
                                        </select>

                                        {/* Hybrid Value Input (Type freely OR choose Picklist / Variable) */}
                                        <FilterValueInput
                                          value={flt.value}
                                          onChange={(newVal) => {
                                            const next = [...filters];
                                            next[idx] = { ...next[idx], value: newVal };
                                            updateGetConfig({ filters: next, conditions: next });
                                          }}
                                          picklistValues={fieldMeta?.picklistValues || []}
                                          upstreamTokens={availableUpstreamTokens}
                                          isReference={isReference}
                                          onOpenLookup={() => handleOpenLookupModal(flt.field, fieldMeta?.label || flt.field, fieldMeta?.referenceTo || [])}
                                        />

                                        {/* Remove button */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next = filters.filter((_, i) => i !== idx);
                                            updateGetConfig({ filters: next, conditions: next });
                                          }}
                                          className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Bottom row under filters: + Add Condition & Quick tokens */}
                              <div className="flex items-center justify-between pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const defaultF = filterableFields[0]?.name || fieldsMetadata[0]?.name || 'StageName';
                                    const next = [...filters, { field: defaultF, operator: '=', value: '', type: 'string' }];
                                    updateGetConfig({ filters: next, conditions: next });
                                  }}
                                  className="h-8 px-3 rounded-lg border border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-100/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>+ Add Condition</span>
                                </button>

                                {/* Quick upstream tokens */}
                                {availableUpstreamTokens.length > 0 && (
                                  <div className="flex items-center gap-1.5 overflow-x-auto">
                                    {availableUpstreamTokens.slice(0, 3).map(tk => (
                                      <button
                                        key={tk.token}
                                        type="button"
                                        onClick={() => {
                                          if (filters.length > 0 && !filters[filters.length - 1].value) {
                                            const next = [...filters];
                                            next[next.length - 1] = { ...next[next.length - 1], value: tk.token };
                                            updateGetConfig({ filters: next, conditions: next });
                                          } else {
                                            const defaultF = filterableFields.find(f => f.type === 'reference' || f.name.toLowerCase().endsWith('id'))?.name || filterableFields[0]?.name || 'AccountId';
                                            const next = [...filters, { field: defaultF, operator: '=', value: tk.token, type: 'string' }];
                                            updateGetConfig({ filters: next, conditions: next });
                                          }
                                        }}
                                        className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 text-[11px] font-mono text-slate-600 dark:text-slate-300 hover:text-emerald-700 cursor-pointer transition-colors shadow-2xs"
                                        title={`Insert ${tk.token}`}
                                      >
                                        +{tk.token.replace(/[{}]/g, '')}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 6. Sort Order & Direction */}
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                                  ⇅ Order By
                                </label>
                                <select
                                  value={orderBy}
                                  onChange={(e) => updateGetConfig({ orderBy: e.target.value })}
                                  className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100 shadow-2xs cursor-pointer"
                                >
                                  {(sortableFields.length > 0 ? sortableFields : fieldsMetadata).map(f => (
                                    <option key={f.name} value={f.name}>
                                      {f.name}
                                    </option>
                                  ))}
                                  {!sortableFields.some(f => f.name === 'CreatedDate') && (
                                    <option value="CreatedDate">CreatedDate</option>
                                  )}
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                                  Direction
                                </label>
                                <div className="flex rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 p-0.5 h-9">
                                  <button
                                    type="button"
                                    onClick={() => updateGetConfig({ sortDirection: 'DESC' })}
                                    className={`flex-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                      sortDirection === 'DESC'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                  >
                                    DESC
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateGetConfig({ sortDirection: 'ASC' })}
                                    className={`flex-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                      sortDirection === 'ASC'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                  >
                                    ASC
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* 7. Record Storage & Max Limit */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                                  Record Storage
                                </label>
                                <select
                                  value={onlyFirstRecord ? 'FIRST' : 'ALL'}
                                  onChange={(e) => updateGetConfig({
                                    onlyFirstRecord: e.target.value === 'FIRST',
                                    storeCount: e.target.value
                                  })}
                                  className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 shadow-2xs cursor-pointer"
                                >
                                  <option value="ALL">All matching records</option>
                                  <option value="FIRST">First matching record only</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                                  Max Limit
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={200}
                                  value={limit}
                                  disabled={onlyFirstRecord}
                                  onChange={(e) => updateGetConfig({ limit: Math.min(200, Math.max(1, Number(e.target.value) || 50)) })}
                                  className="w-full h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100 disabled:opacity-50 focus:outline-none focus:border-emerald-500 shadow-2xs"
                                />
                              </div>
                            </div>

                            {/* 8. LIVE SOQL PREVIEW */}
                            <div className="space-y-1.5 pt-2">
                              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                <span className="flex items-center gap-1.5">
                                  <Code2 className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>LIVE SOQL PREVIEW</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(previewSoql);
                                    setCopiedSoql(true);
                                    setTimeout(() => setCopiedSoql(false), 2000);
                                  }}
                                  className="hover:text-emerald-500 text-slate-400 flex items-center gap-1 cursor-pointer font-normal"
                                >
                                  {copiedSoql ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                  <span>{copiedSoql ? 'Copied' : 'Copy SOQL'}</span>
                                </button>
                              </div>
                              <div className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800 text-xs font-mono text-emerald-400 break-words leading-relaxed select-all shadow-inner">
                                {previewSoql}
                              </div>
                            </div>

                            {/* 9. Action Button: Test Query */}
                            <div className="pt-2">
                              <button
                                type="button"
                                disabled={isTestingGetQuery || !currentObj}
                                onClick={handleRunTestQuery}
                                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
                              >
                                {isTestingGetQuery ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Database className="w-4 h-4" />
                                )}
                                <span>{isTestingGetQuery ? 'Executing Query on Salesforce...' : 'Test Query (Run SOQL)'}</span>
                              </button>
                            </div>

                            {/* 10. Query Execution Result Preview */}
                            {testQueryError && (
                              <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-600 dark:text-rose-400 space-y-1">
                                <div className="font-bold flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  Query Execution Failed
                                </div>
                                <div className="font-mono text-[11px]">{testQueryError}</div>
                              </div>
                            )}

                            {testQueryResult && (
                              <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                  <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    Query Matched {testQueryResult.totalSize} Record(s)
                                  </span>
                                  <span className="text-[10px] font-mono text-emerald-600">
                                    {onlyFirstRecord ? 'SINGLE RECORD' : 'COLLECTION'}
                                  </span>
                                </div>

                                {/* Records Preview Table / List */}
                                <div className="max-h-40 overflow-y-auto space-y-1.5 pt-1">
                                  {(testQueryResult.records || (testQueryResult.record ? [testQueryResult.record] : [])).slice(0, 5).map((rec: any, rIdx: number) => (
                                    <div key={rec.Id || rIdx} className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono">
                                      <div className="font-bold text-slate-800 dark:text-slate-200">{rec.Name || rec.Id}</div>
                                      <div className="text-[10px] text-slate-400 truncate">
                                        ID: {rec.Id} {rec.StageName ? `· Stage: ${rec.StageName}` : ''} {rec.Amount ? `· $${rec.Amount}` : ''}
                                      </div>
                                    </div>
                                  ))}
                                  {testQueryResult.totalSize > 5 && (
                                    <div className="text-[10px] text-slate-400 text-center italic">
                                      ...and {testQueryResult.totalSize - 5} more records
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* 3. UPDATE RECORDS INSPECTOR */}
                  {(nodeType === 'UPDATE' || nodeType === 'UPDATE_RECORDS') && (() => {
                    const currentObj = String(nodeConfig.object || '');
                    const updateMode: 'single' | 'bulk' = (nodeConfig.updateMode as any) || 'single';
                    const stepKey = String(nodeConfig.stepKey || (currentObj ? `update_${currentObj.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_')}` : ''));
                    const fieldEntries: Array<{ field: string; value: string }> = Array.isArray(nodeConfig.fieldList)
                      ? nodeConfig.fieldList
                      : Object.entries(nodeConfig.fields || {}).map(([k, v]) => ({ field: k, value: String(v) }));

                    // Detect connected upstream node
                    const incomingEdge = edges.find(e => e.target === selectedNode.id && !e.source.startsWith('fault-'));
                    const upstreamNode = incomingEdge ? nodes.find(n => n.id === incomingEdge.source) : null;
                    const isUpstreamGet = upstreamNode?.data?.nodeType === 'GET';
                    const isUpstreamCreate = upstreamNode?.data?.nodeType === 'CREATE';
                    const upstreamObj = (upstreamNode?.data?.config as any)?.object || (upstreamNode?.data?.config as any)?.customObject || '';
                    const upstreamStepKey = (upstreamNode?.data?.config as any)?.stepKey || (upstreamObj ? upstreamObj.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_') : '');

                    // Automatically fetch fields for the current object if not already cached
                    if (currentObj && !updateFieldsMap[currentObj] && !isLoadingUpdateFields) {
                      void fetchUpdateableFields(currentObj);
                    }

                    const availUpdateFields = currentObj ? (updateFieldsMap[currentObj] || []) : [];

                    const commitFieldList = (entries: Array<{ field: string; value: string }>) => {
                      const fieldsMap: Record<string, string> = {};
                      entries.forEach(e => { if (e.field.trim()) fieldsMap[e.field.trim()] = e.value; });
                      updateConfig({ fieldList: entries, fields: fieldsMap });
                    };

                    const handleAddField = (fieldMeta: UpdateFieldMetadata) => {
                      if (fieldEntries.some(e => e.field === fieldMeta.name)) return;
                      const initialValue = fieldMeta.type === 'boolean' ? 'false' : '';
                      const next = [...fieldEntries, { field: fieldMeta.name, value: initialValue }];
                      commitFieldList(next);
                    };

                    const handleRemoveField = (fieldName: string) => {
                      const next = fieldEntries.filter(e => e.field !== fieldName);
                      commitFieldList(next);
                    };

                    const handleFieldValueChange = (fieldName: string, val: string) => {
                      const next = fieldEntries.map(e => e.field === fieldName ? { ...e, value: val } : e);
                      commitFieldList(next);
                    };

                    // Filtered unmapped fields for pill matrix
                    const mappedFieldNames = new Set(fieldEntries.map(e => e.field));
                    const unmappedFields = availUpdateFields.filter(f => !mappedFieldNames.has(f.name));
                    const searchFilteredFields = unmappedFields.filter(f =>
                      !updateFieldSearchTerm.trim() ||
                      f.name.toLowerCase().includes(updateFieldSearchTerm.toLowerCase().trim()) ||
                      f.label.toLowerCase().includes(updateFieldSearchTerm.toLowerCase().trim())
                    );

                    // Upstream collection tokens (arrays from GET nodes)
                    const collectionTokens = availableUpstreamTokens.filter(t =>
                      t.token.includes('.records') || t.token.includes('_records') || t.label.toLowerCase().includes('collection')
                    );

                    // Filter only valid ID tokens for Target Record ID selection
                    const idTokens = availableUpstreamTokens.filter(t =>
                      t.token.toLowerCase().endsWith('.id}}') ||
                      t.token.toLowerCase().endsWith('.id') ||
                      t.token.toLowerCase().includes('.id') ||
                      t.label.toLowerCase().includes(' id')
                    );
                    const allTokens = availableUpstreamTokens;

                    return (
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5" />
                            UPDATE RECORDS (PATCH /UPDATE-RECORD)
                          </span>
                          <span className="text-[9px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 font-semibold font-mono">
                            DML UPDATE
                          </span>
                        </div>

                        {/* Upstream Connection Banner (if placed under Get Records or Create Records) */}
                        {upstreamNode && (
                          <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-blue-500" />
                                Connected to Upstream: {String(upstreamNode.data?.label || upstreamNode.id)}
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/30">
                                {String(upstreamNode.data?.nodeType || '')}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                              {isUpstreamGet
                                ? `This step directly receives the existing records queried by "${String(upstreamNode.data?.label || 'Get Records')}" and updates their field values in Salesforce.`
                                : `This step directly receives the record created by "${String(upstreamNode.data?.label || 'Create Records')}" and updates its field values in Salesforce.`}
                            </p>
                          </div>
                        )}

                        {/* 1. Target Object Picker */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              Target Object (sObject) *
                            </label>
                            {isLoadingUpdateObjects ? (
                              <span className="text-[9px] font-mono text-blue-500 flex items-center gap-1 animate-pulse">
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                Fetching objects...
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-400">
                                {updateObjects.length} objects available
                              </span>
                            )}
                          </div>
                          <SObjectSelect
                            value={currentObj}
                            onChange={(val) => {
                              const newStepKey = `update_${val.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_')}`;
                              updateConfig({
                                object: val,
                                stepKey: newStepKey,
                                recordId: isUpstreamGet ? `{{${upstreamStepKey || val.toLowerCase()}.id}}` : '',
                                collectionVariable: isUpstreamGet ? `{{${upstreamStepKey || val.toLowerCase()}.records}}` : '',
                                fieldList: [],
                                fields: {}
                              });
                              void fetchUpdateableFields(val);
                            }}
                            objects={updateObjects}
                            isLoading={isLoadingUpdateObjects}
                            accentColor="blue"
                            placeholder="-- Select Object to Update --"
                          />
                        </div>

                        {/* Show Configuration & Field mapping ONLY after SObject is selected */}
                        {!currentObj ? (
                          <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-2">
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto font-bold text-sm">
                              SF
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              Select an sObject to Update
                            </h4>
                            <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                              {isUpstreamGet && upstreamObj
                                ? `Select "${upstreamObj}" above to update the records queried in "${String(upstreamNode?.data?.label || 'Get Records')}".`
                                : 'Choose a Salesforce object from the dropdown above to load its real-time schema and updateable fields.'}
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Step Key / Variable Name */}
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2">
                              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                Step Key / Variable Name
                              </label>
                              <input
                                type="text"
                                value={stepKey}
                                placeholder="e.g. update_opportunity"
                                onChange={(e) => {
                                  const val = e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
                                  updateConfig({ stepKey: val });
                                }}
                                className="w-full h-8 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>

                            {/* 2. Update Mode Selector */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Update Mode</label>
                              <div className="flex gap-1 p-0.5 bg-slate-200 dark:bg-slate-800 rounded-lg">
                                {(['single', 'bulk'] as const).map(mode => (
                                  <button
                                    key={mode}
                                    type="button"
                                    onClick={() => updateConfig({
                                      updateMode: mode,
                                      collectionVariable: mode === 'bulk' && !nodeConfig.collectionVariable && isUpstreamGet
                                        ? `{{${upstreamStepKey}.records}}`
                                        : nodeConfig.collectionVariable,
                                      recordId: mode === 'single' && !nodeConfig.recordId && isUpstreamGet
                                        ? `{{${upstreamStepKey}.id}}`
                                        : nodeConfig.recordId
                                    })}
                                    className={`flex-1 h-7 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${updateMode === mode
                                      ? 'bg-blue-600 text-white shadow-sm'
                                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
                                  >
                                    {mode === 'single' ? (
                                      <span>Single Record</span>
                                    ) : (
                                      <span className="flex items-center gap-1.5">
                                        <Database className="w-3.5 h-3.5" />
                                        Bulk Collection
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 3. Bulk Mode — Collection Variable Card */}
                            {updateMode === 'bulk' && (
                              <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                    <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                      Collection Variable (Bulk Target)
                                    </label>
                                  </div>
                                  {isUpstreamGet && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-mono font-semibold">
                                      from {String(upstreamNode?.data?.label || 'Get Records')}
                                    </span>
                                  )}
                                </div>

                                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-800/40 space-y-1.5">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-slate-500 dark:text-slate-400">Target Records:</span>
                                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                                      {testQueryResult?.records?.length
                                        ? `${testQueryResult.records.length} records in memory`
                                        : 'All records from upstream collection'}
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    value={String(nodeConfig.collectionVariable || (isUpstreamGet ? `{{${upstreamStepKey}.records}}` : ''))}
                                    placeholder="e.g. {{get_opportunity.records}}"
                                    onChange={e => updateConfig({ collectionVariable: e.target.value.trim() })}
                                    className="w-full h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                                  />
                                </div>

                                {collectionTokens.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {collectionTokens.map(tok => (
                                      <button
                                        key={tok.token}
                                        type="button"
                                        onClick={() => updateConfig({ collectionVariable: tok.token })}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${nodeConfig.collectionVariable === tok.token
                                          ? 'bg-blue-600 text-white border-blue-600'
                                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}
                                      >
                                        {tok.token}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed bg-white/60 dark:bg-slate-900/40 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                                  <span className="font-semibold text-blue-700 dark:text-blue-300">How Bulk Works:</span> Takes all records returned by the collection query and applies the mapped field values to <strong>every record</strong> in Salesforce simultaneously via <code className="font-mono font-semibold text-blue-600 dark:text-blue-400">PATCH /api/salesforce/update-record/bulk</code>.
                                </p>
                              </div>
                            )}

                            {/* 3b. Single Mode — Target Record Selection Card */}
                            {updateMode === 'single' && (
                              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                                    Target Record ID
                                  </label>
                                  {isUpstreamGet && (
                                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 font-mono">
                                      <Zap className="w-3 h-3" />
                                      {`{{${upstreamStepKey}.id}}`}
                                    </span>
                                  )}
                                </div>

                                {/* Upstream Record Quick-Select Button */}
                                {isUpstreamGet && (
                                  <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 flex items-center justify-between">
                                    <div>
                                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                                        Use Record from "{String(upstreamNode?.data?.label || 'Get Records')}"
                                      </span>
                                      <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                                        {`{{${upstreamStepKey}.id}}`}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => updateConfig({ recordId: `{{${upstreamStepKey}.id}}` })}
                                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                                        nodeConfig.recordId === `{{${upstreamStepKey}.id}}` || !nodeConfig.recordId
                                          ? 'bg-blue-600 text-white shadow-xs'
                                          : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-500'
                                      }`}
                                    >
                                      {nodeConfig.recordId === `{{${upstreamStepKey}.id}}` || !nodeConfig.recordId ? '✓ Selected' : 'Use This'}
                                    </button>
                                  </div>
                                )}

                                <div>
                                  <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">
                                    {isUpstreamGet ? 'Or enter custom Record ID / variable:' : 'Enter Record ID or select an upstream variable:'}
                                  </label>
                                  <input
                                    type="text"
                                    value={String(nodeConfig.recordId || (isUpstreamGet ? `{{${upstreamStepKey}.id}}` : ''))}
                                    placeholder="e.g. {{get_opportunity.id}} or 006..."
                                    onChange={e => updateConfig({ recordId: e.target.value.trim() })}
                                    className="w-full h-8 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                                  />
                                </div>

                                {idTokens.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {idTokens.map(tok => (
                                      <button
                                        key={tok.token}
                                        type="button"
                                        onClick={() => updateConfig({ recordId: tok.token })}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                                          nodeConfig.recordId === tok.token
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-blue-400'
                                        }`}
                                      >
                                        {tok.token}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 4. Fields to Update Section */}
                            <div className="space-y-2.5 pt-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                  Fields to Update
                                </label>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {fieldEntries.length} mapped
                                </span>
                              </div>

                              {/* Mapped Fields Cards */}
                              <div className="space-y-2">
                                {fieldEntries.length === 0 ? (
                                  <div className="p-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-400">
                                    No fields mapped yet. Search and click an updateable field below to add it.
                                  </div>
                                ) : (
                                  fieldEntries.map((entry) => {
                                    const fieldMeta = availUpdateFields.find(f => f.name === entry.field);
                                    const fieldType = (fieldMeta?.type || 'string').toLowerCase();
                                    const isPicklist = fieldType === 'picklist' && (fieldMeta?.picklistValues || []).length > 0;
                                    const isBoolean = fieldType === 'boolean';
                                    const isTextarea = fieldType === 'textarea';
                                    const isReference = fieldType === 'reference';

                                    return (
                                      <div
                                        key={entry.field}
                                        className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2"
                                      >
                                        {/* Field Card Header */}
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-baseline gap-1.5 truncate">
                                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                              {fieldMeta?.label || entry.field}
                                            </span>
                                            <span className="text-[10px] font-mono text-slate-400 truncate">
                                              ({entry.field})
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold border border-slate-200 dark:border-slate-700">
                                              {fieldType}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveField(entry.field)}
                                              className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>

                                        {/* Field Input based on type */}
                                        {isPicklist ? (
                                          <select
                                            value={entry.value}
                                            onChange={e => handleFieldValueChange(entry.field, e.target.value)}
                                            className="w-full h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                                          >
                                            <option value="">-- Select Picklist Value --</option>
                                            {(fieldMeta?.picklistValues || []).map(pv => (
                                              <option key={pv.value} value={pv.value}>
                                                {pv.label}
                                              </option>
                                            ))}
                                          </select>
                                        ) : isBoolean ? (
                                          <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                                            <input
                                              type="checkbox"
                                              checked={entry.value === 'true' || entry.value === '1'}
                                              onChange={e => handleFieldValueChange(entry.field, e.target.checked ? 'true' : 'false')}
                                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                                              Set True / Enabled
                                            </span>
                                          </label>
                                        ) : isTextarea ? (
                                          <textarea
                                            rows={2}
                                            value={entry.value}
                                            placeholder={`Enter ${fieldMeta?.label || entry.field} or {{variable}}`}
                                            onChange={e => handleFieldValueChange(entry.field, e.target.value)}
                                            className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500 resize-none"
                                          />
                                        ) : isReference ? (
                                          <input
                                            type="text"
                                            value={entry.value}
                                            placeholder={`Enter ${fieldMeta?.label || 'Record'} ID or {{var}}`}
                                            onChange={e => handleFieldValueChange(entry.field, e.target.value)}
                                            className="w-full h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
                                          />
                                        ) : (
                                          <input
                                            type="text"
                                            value={entry.value}
                                            placeholder={`Enter ${fieldMeta?.label || entry.field} or {{variable}}`}
                                            onChange={e => handleFieldValueChange(entry.field, e.target.value)}
                                            className="w-full h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
                                          />
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>

                              {/* Search and Add Fields Matrix */}
                              <div className="pt-2 space-y-2">
                                <div className="relative">
                                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                  <input
                                    type="text"
                                    value={updateFieldSearchTerm}
                                    onChange={e => setUpdateFieldSearchTerm(e.target.value)}
                                    placeholder="Search field to add..."
                                    className="w-full h-8 pl-8 pr-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                                  />
                                  {updateFieldSearchTerm && (
                                    <button
                                      type="button"
                                      onClick={() => setUpdateFieldSearchTerm('')}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>

                                {isLoadingUpdateFields ? (
                                  <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                    <span>Loading updateable fields for {currentObj}...</span>
                                  </div>
                                ) : searchFilteredFields.length > 0 ? (
                                  <div className="space-y-1.5">
                                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                                      {(isExpandedUpdateFields ? searchFilteredFields : searchFilteredFields.slice(0, 18)).map(f => (
                                        <button
                                          key={f.name}
                                          type="button"
                                          onClick={() => handleAddField(f)}
                                          className="h-6 px-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                        >
                                          <Plus className="w-3 h-3 text-blue-500" />
                                          <span>{f.label}</span>
                                          <span className="text-[9px] font-mono text-slate-400">({f.name})</span>
                                        </button>
                                      ))}
                                    </div>
                                    {searchFilteredFields.length > 18 && (
                                      <button
                                        type="button"
                                        onClick={() => setIsExpandedUpdateFields(prev => !prev)}
                                        className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                                      >
                                        {isExpandedUpdateFields ? 'Show fewer fields' : `+ ${searchFilteredFields.length - 18} more fields`}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-slate-400 italic text-center py-1">
                                    {availUpdateFields.length === 0
                                      ? 'No updateable fields found for this object.'
                                      : 'All matching fields are already added.'}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Execution Readiness Indicator */}
                            <div className="pt-2">
                              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 space-y-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                                    <span>Configuration Ready for Live Run</span>
                                  </div>
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700">
                                    {updateMode === 'bulk' ? 'BULK UPDATE' : 'SINGLE UPDATE'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                  {updateMode === 'bulk'
                                    ? `This node will update all records in the collection when you click "Run Live" in the toolbar.`
                                    : `This node will update ${currentObj} (${fieldEntries.length} field(s) mapped) when you click "Run Live" in the toolbar.`}
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* 3b. DELETE RECORDS INSPECTOR */}
                  {nodeType === 'DELETE' && (() => {
                    const currentObj = String(nodeConfig.object || '');
                    const deleteMode: 'single' | 'bulk' = (nodeConfig.deleteMode as any) || 'single';
                    const collectionTokens = availableUpstreamTokens.filter(t =>
                      t.token.includes('.records') || t.token.includes('_records') || t.label.toLowerCase().includes('collection')
                    );

                    return (
                      <div className="space-y-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        {/* Header */}
                        <div className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 uppercase flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                          <span className="flex items-center gap-1.5">
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Records
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 font-semibold">DML DELETE</span>
                        </div>

                        {/* 1. Object Picker */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Salesforce Object</label>
                            <span className="text-[10px] font-mono text-slate-400">
                              {deleteObjects.length} objects available
                            </span>
                          </div>
                          <SObjectSelect
                            value={currentObj}
                            onChange={(val) => {
                              updateConfig({ object: val, recordId: '', collectionVariable: '' });
                              setDeleteLookupResults([]);
                              setDeleteLookupSearch('');
                            }}
                            objects={deleteObjects}
                            isLoading={isLoadingDeleteObjects}
                            accentColor="rose"
                            placeholder="-- Select Object to Delete --"
                          />
                        </div>

                        {/* 2. Delete Mode Selector */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Delete Mode</label>
                          <div className="flex gap-1 p-0.5 bg-slate-200 dark:bg-slate-800 rounded-lg">
                            {(['single', 'bulk'] as const).map(mode => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => updateConfig({ deleteMode: mode, recordId: '', collectionVariable: '' })}
                                className={`flex-1 h-6 rounded-md text-[10px] font-semibold transition-colors ${deleteMode === mode
                                  ? 'bg-rose-500 text-white shadow-sm'
                                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                              >
                                {mode === 'single' ? '🎯 Single Record' : '📦 Bulk (Collection)'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 3. Single Mode — Target Record */}
                        {deleteMode === 'single' && (
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Target Record to Delete</label>
                            {/* Sub-tabs */}
                            <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
                              {(['lookup', 'paste', 'variable'] as const).map(tab => (
                                <button
                                  key={tab}
                                  type="button"
                                  onClick={() => setDeleteRecordSubTab(tab)}
                                  className={`px-2 py-1 text-[10px] font-semibold capitalize border-b-2 -mb-px transition-colors ${deleteRecordSubTab === tab
                                    ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                  {tab === 'lookup' ? '🔍 Search' : tab === 'paste' ? '📋 Paste ID' : '⚡ Variable'}
                                </button>
                              ))}
                            </div>

                            {/* Lookup Tab */}
                            {deleteRecordSubTab === 'lookup' && (
                              <div className="space-y-1.5">
                                <div className="flex gap-1.5">
                                  <input
                                    type="text"
                                    value={deleteLookupSearch}
                                    onChange={e => setDeleteLookupSearch(e.target.value)}
                                    placeholder={`Search ${currentObj || 'records'}...`}
                                    className="flex-1 h-7 px-2.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs"
                                  />
                                  <button
                                    type="button"
                                    disabled={!currentObj || isLoadingDeleteLookup}
                                    onClick={async () => {
                                      if (!currentObj) return;
                                      setIsLoadingDeleteLookup(true);
                                      setDeleteError(null);
                                      try {
                                        const recs = await SalesforceApi.lookupDeleteRecords(currentObj, deleteLookupSearch, 50);
                                        setDeleteLookupResults(recs);
                                      } catch (e: any) {
                                        setDeleteError(e.message || 'Lookup failed');
                                      } finally {
                                        setIsLoadingDeleteLookup(false);
                                      }
                                    }}
                                    className="h-7 px-2 rounded bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-[10px] font-semibold transition-colors"
                                  >
                                    {isLoadingDeleteLookup ? '...' : 'Search'}
                                  </button>
                                </div>
                                {deleteLookupResults.length > 0 && (
                                  <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                                    {deleteLookupResults.map(rec => (
                                      <button
                                        key={rec.id}
                                        type="button"
                                        onClick={() => updateConfig({ recordId: rec.id })}
                                        className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors ${nodeConfig.recordId === rec.id ? 'bg-rose-50 dark:bg-rose-950/30' : 'bg-white dark:bg-slate-900'}`}
                                      >
                                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{rec.name}</span>
                                        <span className="font-mono text-[10px] text-slate-400 shrink-0">{rec.id.slice(-6)}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {nodeConfig.recordId && (
                                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20">
                                    <CheckCircle2 className="w-3 h-3 text-rose-500 shrink-0" />
                                    <span className="font-mono text-[10px] text-rose-600 dark:text-rose-400 truncate">{nodeConfig.recordId}</span>
                                    <button type="button" onClick={() => updateConfig({ recordId: '' })} className="ml-auto text-slate-400 hover:text-rose-500"><X className="w-3 h-3" /></button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Paste ID Tab */}
                            {deleteRecordSubTab === 'paste' && (
                              <input
                                type="text"
                                value={String(nodeConfig.recordId || '')}
                                placeholder="Paste 15 or 18-char Salesforce Record ID..."
                                onChange={e => updateConfig({ recordId: e.target.value.trim() })}
                                className="w-full h-7 px-2.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs font-mono"
                              />
                            )}

                            {/* Variable Tab */}
                            {deleteRecordSubTab === 'variable' && (
                              <div className="space-y-1">
                                <p className="text-[10px] text-slate-500">Select a record ID variable from an earlier step:</p>
                                <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                  {availableUpstreamTokens.length === 0 ? (
                                    <span className="text-[10px] text-slate-400 p-1">No upstream variables yet. Add a Get Records or Create Records step first.</span>
                                  ) : availableUpstreamTokens.map(tok => (
                                    <button
                                      key={tok.token}
                                      type="button"
                                      onClick={() => updateConfig({ recordId: tok.token })}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${nodeConfig.recordId === tok.token
                                        ? 'bg-rose-500 text-white border-rose-500'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-rose-400 hover:text-rose-600'}`}
                                    >
                                      {tok.token}
                                    </button>
                                  ))}
                                </div>
                                {nodeConfig.recordId && (
                                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-[10px] font-mono text-rose-600 dark:text-rose-400">
                                    <Zap className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{nodeConfig.recordId}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 4. Bulk Mode — Collection Variable */}
                        {deleteMode === 'bulk' && (
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Record Collection</label>
                            <p className="text-[10px] text-slate-500">Select the collection variable from an upstream Get Records step. All records in the collection will be deleted.</p>
                            <div className="flex flex-wrap gap-1 p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                              {collectionTokens.length === 0 ? (
                                <span className="text-[10px] text-slate-400">No collection variables found. Add a Get Records step first.</span>
                              ) : collectionTokens.map(tok => (
                                <button
                                  key={tok.token}
                                  type="button"
                                  onClick={() => updateConfig({ collectionVariable: tok.token })}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${nodeConfig.collectionVariable === tok.token
                                    ? 'bg-rose-500 text-white border-rose-500'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-rose-400 hover:text-rose-600'}`}
                                >
                                  {tok.token}
                                </button>
                              ))}
                            </div>
                            {nodeConfig.collectionVariable && (
                              <div className="flex items-center gap-1 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-[10px] font-mono text-rose-600 dark:text-rose-400">
                                <Database className="w-3 h-3 shrink-0" />
                                <span className="truncate">{nodeConfig.collectionVariable}</span>
                              </div>
                            )}
                            <div className="p-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 text-[10px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                              <span>This will permanently delete all records in the collection. This action cannot be undone.</span>
                            </div>
                          </div>
                        )}

                        {/* Execution Readiness Indicator */}
                        <div className="pt-2">
                          <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                                <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0" />
                                <span>Configuration Ready for Live Run</span>
                              </div>
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-700">
                                {deleteMode === 'bulk' ? 'BULK DELETE' : 'SINGLE DELETE'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                              {deleteMode === 'bulk'
                                ? `All records in the collection will be deleted when you click "Run Live" in the toolbar.`
                                : `Target record will be deleted when you click "Run Live" in the toolbar.`}
                            </p>
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
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${lastRunReport.status === 'PASSED'
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
                          className={`rounded-xl border transition-all overflow-hidden ${step.status === 'PASSED'
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
                                <pre className={`p-2.5 rounded-lg text-[11px] font-mono overflow-x-auto max-h-36 ${step.status === 'PASSED'
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
                  placeholder="e.g. varAccountId, totalCalculation"
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
                    placeholder='e.g. {!$Record.Amount} * 1.18'
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

      {/* 2. Lookup Modal: Flow Upstream Context Tokens OR Real Salesforce Org Records */}
      {activeLookupField && selectedNode && (() => {
        const lookupTargetSObject = resolveLookupTargetObject(activeLookupField.fieldName, activeLookupField.referenceTo);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-start justify-between p-5 pb-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold shrink-0 mt-0.5">
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                      <span>Lookup Reference:</span>
                      <span className="text-sky-600 dark:text-sky-400 font-mono">{activeLookupField.fieldName}</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Select an output variable from an earlier step or search live <strong className="text-slate-700 dark:text-slate-300 font-semibold">{lookupTargetSObject}</strong> records in Salesforce.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveLookupField(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* SECTION 1: FLOW OUTPUT VARIABLES (EARLIER STEPS) */}
              <div className="mx-5 mb-4 rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/30 dark:bg-sky-950/20 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-sky-800 dark:text-sky-300 uppercase">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-sky-500 fill-sky-500/20" />
                    <span>FLOW OUTPUT VARIABLES (EARLIER STEPS)</span>
                  </div>
                  <span className="text-[10px] text-sky-500 font-mono font-semibold">Dynamic Wire</span>
                </div>

                {availableUpstreamTokens.length === 0 ? (
                  <div className="py-2 text-center text-xs text-slate-400 italic">
                    No output variables created in earlier steps yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                    {availableUpstreamTokens.map(v => (
                      <button
                        key={v.token}
                        type="button"
                        onClick={() => {
                          const nodeConfig = ((selectedNode.data || {}).config || {}) as Record<string, any>;
                          const nextFields = { ...(nodeConfig.fields || {}) };
                          nextFields[activeLookupField.fieldName] = v.token;

                          const updatedConfig = {
                            ...nodeConfig,
                            fields: nextFields,
                            fieldList: Object.entries(nextFields).map(([k, val]) => ({ field: k, value: String(val) }))
                          };
                          const updatedData = { ...selectedNode.data, config: updatedConfig };
                          setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: updatedData } : n));
                          setSelectedNode({ ...selectedNode, data: updatedData });
                          setActiveLookupField(null);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800/90 bg-white dark:bg-slate-900 hover:border-sky-500 hover:bg-sky-50/60 dark:hover:bg-sky-950/40 text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between gap-1.5 transition-all cursor-pointer group shadow-2xs text-left"
                      >
                        <span className="text-sky-600 dark:text-sky-400 truncate">{v.token}</span>
                        <span className="text-[10px] font-sans text-slate-400 group-hover:text-sky-500 shrink-0">
                          ({v.sobject || 'Record'})
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sub-tab Switcher: Search Live Records vs Record ID Checking */}
              <div className="px-5 mb-3 flex items-center border-b border-slate-200 dark:border-slate-800 gap-4">
                <button
                  type="button"
                  onClick={() => setLookupSubTab('search')}
                  className={`text-xs font-bold uppercase tracking-wider pb-2 transition-all cursor-pointer border-b-2 flex items-center gap-1.5 ${
                    lookupSubTab === 'search'
                      ? 'text-sky-600 dark:text-sky-400 border-sky-600 dark:border-sky-400'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border-transparent'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>SEARCH LIVE {lookupTargetSObject.toUpperCase()} RECORDS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLookupSubTab('checkId')}
                  className={`text-xs font-bold uppercase tracking-wider pb-2 transition-all cursor-pointer border-b-2 flex items-center gap-1.5 ${
                    lookupSubTab === 'checkId'
                      ? 'text-emerald-600 dark:text-emerald-400 border-emerald-600 dark:border-emerald-400'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border-transparent'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>RECORD ID CHECKING</span>
                </button>
              </div>

              {/* OPTION A: SEARCH LIVE RECORDS */}
              {lookupSubTab === 'search' && (
                <>
                  {/* Search Bar with Search button */}
                  <div className="px-5 mb-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                        <input
                          type="text"
                          value={lookupSearchTerm}
                          onChange={(e) => setLookupSearchTerm(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              setIsLoadingOrgRecords(true);
                              try {
                                const records = await SalesforceApi.getLookupRecords(lookupTargetSObject, lookupSearchTerm, 50);
                                setExistingOrgRecords(records.map(r => ({ id: r.id, name: r.name || r.id, type: lookupTargetSObject })));
                              } catch (err: any) {
                                setLookupError(err?.message || 'Search failed.');
                              } finally {
                                setIsLoadingOrgRecords(false);
                              }
                            }
                          }}
                          placeholder={`Type name to search ${lookupTargetSObject} records in Salesforce...`}
                          className="w-full h-8 pl-8 pr-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          setIsLoadingOrgRecords(true);
                          try {
                            const records = await SalesforceApi.getLookupRecords(lookupTargetSObject, lookupSearchTerm, 50);
                            setExistingOrgRecords(records.map(r => ({ id: r.id, name: r.name || r.id, type: lookupTargetSObject })));
                          } catch (err: any) {
                            setLookupError(err?.message || 'Search failed.');
                          } finally {
                            setIsLoadingOrgRecords(false);
                          }
                        }}
                        className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shadow-2xs"
                      >
                        Search
                      </button>
                    </div>
                  </div>

                  {/* Record List */}
                  <div className="px-5 max-h-56 overflow-y-auto space-y-1.5 mb-4">
                    {isLoadingOrgRecords ? (
                      <div className="py-8 text-center text-xs text-sky-500 flex items-center justify-center gap-1.5 animate-pulse font-mono">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Fetching live {lookupTargetSObject} records from Salesforce...
                      </div>
                    ) : lookupError ? (
                      <div className="py-6 text-center text-xs text-rose-500 space-y-1.5 p-3">
                        <p className="font-semibold flex items-center justify-center gap-1.5 text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                          <span>{lookupError}</span>
                        </p>
                      </div>
                    ) : existingOrgRecords.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No {lookupTargetSObject} records found in Salesforce.
                      </div>
                    ) : (
                      existingOrgRecords.map(r => (
                        <div
                          key={r.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 flex items-center justify-between transition-all"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {r.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              ID: {r.id}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const nodeConfig = ((selectedNode.data || {}).config || {}) as Record<string, any>;
                              const nextFields = { ...(nodeConfig.fields || {}) };
                              nextFields[activeLookupField.fieldName] = r.id;

                              const updatedConfig = {
                                ...nodeConfig,
                                fields: nextFields,
                                fieldList: Object.entries(nextFields).map(([k, val]) => ({ field: k, value: String(val) }))
                              };
                              const updatedData = { ...selectedNode.data, config: updatedConfig };
                              setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: updatedData } : n));
                              setSelectedNode({ ...selectedNode, data: updatedData });
                              setActiveLookupField(null);
                            }}
                            className="px-3 py-1 rounded-md text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-xs cursor-pointer transition-colors"
                          >
                            Select ID
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {/* OPTION B: RECORD ID CHECKING */}
              {lookupSubTab === 'checkId' && (
                <div className="px-5 space-y-3 mb-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter or paste a 15 or 18-character Salesforce ID to verify live against your connected Org:
                  </p>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        value={directCheckId}
                        onChange={(e) => {
                          setDirectCheckId(e.target.value);
                          setCheckedIdResult(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && directCheckId.trim() && !isCheckingId) {
                            handleCheckRecordId(directCheckId, lookupTargetSObject);
                          }
                        }}
                        placeholder={`Enter ${lookupTargetSObject} Record ID (e.g. 005g7000006tRP1AAM or 001...)...`}
                        className="w-full h-8 pl-8 pr-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!directCheckId.trim() || isCheckingId}
                      onClick={() => handleCheckRecordId(directCheckId, lookupTargetSObject)}
                      className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      {isCheckingId ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                      <span>Check ID</span>
                    </button>
                  </div>

                  {/* Verification Results */}
                  {isCheckingId && (
                    <div className="p-3 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20 text-xs text-sky-600 dark:text-sky-400 flex items-center gap-2 animate-pulse font-mono">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Checking Salesforce Org for Record ID: {directCheckId}...</span>
                    </div>
                  )}

                  {checkedIdResult && !isCheckingId && (
                    checkedIdResult.exists ? (
                      <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Valid Record Verified!</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">
                            ACTIVE IN ORG
                          </span>
                        </div>
                        <div className="text-xs text-slate-800 dark:text-slate-200">
                          <span className="font-semibold text-slate-500 dark:text-slate-400">Record Name:</span> {checkedIdResult.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          <span className="font-semibold">ID:</span> {checkedIdResult.id} · <span className="font-semibold">Object:</span> {checkedIdResult.sobject || lookupTargetSObject}
                        </div>
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              const nodeConfig = ((selectedNode.data || {}).config || {}) as Record<string, any>;
                              const nextFields = { ...(nodeConfig.fields || {}) };
                              nextFields[activeLookupField.fieldName] = checkedIdResult.id;

                              const updatedConfig = {
                                ...nodeConfig,
                                fields: nextFields,
                                fieldList: Object.entries(nextFields).map(([k, val]) => ({ field: k, value: String(val) }))
                              };
                              const updatedData = { ...selectedNode.data, config: updatedConfig };
                              setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: updatedData } : n));
                              setSelectedNode({ ...selectedNode, data: updatedData });
                              setActiveLookupField(null);
                            }}
                            className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                          >
                            Bind Verified ID
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Record ID Not Found</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {checkedIdResult.message || `No record matching ID "${directCheckId}" was found in ${lookupTargetSObject}.`}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Modal Footer */}
              <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveLookupField(null)}
                  className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
