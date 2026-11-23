/**
 * Excel Export Service for Assert Now
 * Generates multi-sheet .xlsx workbooks strictly grounded in database records:
 * - salesforce_connections
 * - workflows
 * - workflow_test_logs
 */

import * as XLSX from 'xlsx';
import { ApiClient } from '@/api/ApiClient';
import { TestLogApi, BackendTestLog } from '@/api/TestLogApi';
import { ConnectionStatus, BackendWorkflow } from '@/types/api';

export interface ExportLogsOptions {
  workflowId?: number | string | null;
  workflowName?: string | null;
  logId?: number | string | null;
}

export class ExcelExportService {
  /**
   * Fetches required data from PostgreSQL via backend REST APIs and downloads the .xlsx workbook
   */
  public static async exportExecutionLogs(options: ExportLogsOptions = {}): Promise<{ filename: string; totalLogs: number }> {
    const numericWfId = options.workflowId && !isNaN(Number(options.workflowId)) ? Number(options.workflowId) : null;
    const numericLogId = options.logId && !isNaN(Number(options.logId)) ? Number(options.logId) : null;

    // 1. Fetch live Connection Status
    let connectionStatus: ConnectionStatus = {
      isConnected: false,
      connectionId: null,
      name: null,
      myDomain: null,
      instanceUrl: null,
      tokenExpiresAt: null,
    };
    try {
      const connRes = await ApiClient.get<{ data?: ConnectionStatus } | ConnectionStatus>('/status');
      const resolved = (connRes as any)?.data || connRes;
      if (resolved && typeof resolved === 'object') {
        connectionStatus = resolved;
      }
    } catch (connErr) {
      console.warn('Could not retrieve connection status for Excel export:', connErr);
    }

    // 2. Fetch Workflows metadata to map workflow names and versions
    const workflowsMap: Record<number, BackendWorkflow> = {};
    try {
      const wfRes = await ApiClient.get<{ workflows?: BackendWorkflow[] } | BackendWorkflow[]>('/workflows');
      const wfsList = (wfRes as any)?.workflows || (Array.isArray(wfRes) ? wfRes : []);
      wfsList.forEach((w: BackendWorkflow) => {
        if (w?.id) {
          workflowsMap[w.id] = w;
        }
      });
    } catch (wfErr) {
      console.warn('Could not retrieve workflows list for Excel export:', wfErr);
    }

    // 3. Fetch Test Logs from PostgreSQL
    let logs: BackendTestLog[] = [];
    try {
      const logsList = await TestLogApi.list({
        workflowId: numericWfId || undefined,
        limit: 100,
      });
      logs = logsList;
    } catch (logErr) {
      console.error('Failed to load test logs from backend:', logErr);
      throw new Error('Failed to retrieve test execution logs from the server.');
    }

    // If specific logId requested, filter down to that log
    if (numericLogId) {
      const filtered = logs.filter(l => l.id === numericLogId);
      if (filtered.length > 0) {
        logs = filtered;
      }
    }

    if (!logs || logs.length === 0) {
      throw new Error(
        numericLogId 
          ? `No test execution logs found for Run ID #${numericLogId}.` 
          : numericWfId
            ? `No test execution logs found for Workflow #${numericWfId}.`
            : 'No test execution logs found in the database to export.'
      );
    }

    // Sort logs chronologically (newest first)
    logs.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

    // Clean instance URL for record links
    const rawInstanceUrl = connectionStatus.instanceUrl || connectionStatus.myDomain || '';
    const instanceUrl = rawInstanceUrl.replace(/\/+$/, '');

    // Resolve workflow scope name
    let workflowScopeName = 'All Workflows';
    if (options.workflowName) {
      workflowScopeName = options.workflowName;
    } else if (numericWfId && workflowsMap[numericWfId]) {
      workflowScopeName = `${workflowsMap[numericWfId].name} (ID: ${numericWfId})`;
    } else if (numericWfId) {
      workflowScopeName = `Workflow #${numericWfId}`;
    }

    // ── Derive Summary Metrics ─────────────────────────────────────────────────
    let totalStepsCount = 0;
    let stepsPassedCount = 0;
    let stepsFailedCount = 0;
    let stepsSkippedCount = 0;
    let checksPassedCount = 0;
    let checksFailedCount = 0;
    let totalDurationMs = 0;

    const allStepRows: any[] = [];
    const allCheckRows: any[] = [];
    const allCreatedRecords: any[] = [];
    const scenarioRows: any[] = [];

    logs.forEach(log => {
      totalDurationMs += log.duration_ms || 0;
      const wf = log.workflow_id ? workflowsMap[log.workflow_id] : null;
      const scenarioName = wf?.name || (log.workflow_id ? `Workflow #${log.workflow_id}` : 'Ad-hoc Execution');
      const stepLogs = Array.isArray(log.step_logs) ? log.step_logs : [];

      let failedStepsInLog = 0;

      if (stepLogs.length > 0) {
        stepLogs.forEach((s: any, idx: number) => {
          totalStepsCount++;
          const status = String(s.status || 'PASSED').toUpperCase();
          if (status === 'PASSED') stepsPassedCount++;
          else if (status === 'FAILED') {
            stepsFailedCount++;
            failedStepsInLog++;
          } else {
            stepsSkippedCount++;
          }

          // Extract Salesforce record ID(s) if present
          const recordIds: string[] = [];
          if (s.recordId && typeof s.recordId === 'string') {
            recordIds.push(s.recordId);
          }
          if (s.output?.id && typeof s.output.id === 'string') {
            recordIds.push(s.output.id);
          }
          if (s.outputData?.id && typeof s.outputData.id === 'string') {
            recordIds.push(s.outputData.id);
          }
          if (Array.isArray(s.records)) {
            s.records.forEach((rec: any) => {
              const recId = rec?.Id || rec?.id;
              if (recId && typeof recId === 'string') recordIds.push(recId);
            });
          }
          if (Array.isArray(s.output?.createdIds)) {
            s.output.createdIds.forEach((id: string) => {
              if (id && typeof id === 'string') recordIds.push(id);
            });
          }
          const uniqueRecordIds = Array.from(new Set(recordIds));

          // Register in Steps Sheet
          const stepLabel = s.nodeLabel || s.sobject || s.action || s.key || `Step ${idx + 1}`;
          const stepAction = s.action || s.nodeType || (s.key?.startsWith('start') ? 'START' : s.key?.startsWith('end') ? 'END' : 'ACTION');
          const stepDurationSec = typeof s.durationMs === 'number' ? (s.durationMs / 1000).toFixed(3) : 'N/A';
          const stepError = s.error || s.errorMessage || (status === 'FAILED' ? log.error_message : '') || '';

          allStepRows.push({
            'Run Id': log.id,
            'Workflow / Scenario': scenarioName,
            '#': typeof s.step === 'number' ? s.step : idx + 1,
            'Step': stepLabel,
            'Action / Type': stepAction,
            'Status': status,
            'Duration (s)': stepDurationSec,
            'Record Ids': uniqueRecordIds.length > 0 ? uniqueRecordIds.join(', ') : 'N/A',
            'Error / Reason': stepError,
          });

          // Check for assertions / checks
          const checks = Array.isArray(s.checks) ? s.checks : Array.isArray(s.assertions) ? s.assertions : [];
          if (checks.length > 0) {
            checks.forEach((chk: any) => {
              const chkStatus = String(chk.status || (chk.passed ? 'PASSED' : 'FAILED')).toUpperCase();
              if (chkStatus === 'PASSED') checksPassedCount++;
              else checksFailedCount++;

              allCheckRows.push({
                'Run Id': log.id,
                'Step': stepLabel,
                'Check': chk.check || chk.name || chk.description || 'Assertion Check',
                'Expected': chk.expected !== undefined ? String(chk.expected) : 'N/A',
                'Actual': chk.actual !== undefined ? String(chk.actual) : 'N/A',
                'Status': chkStatus,
              });
            });
          } else if (s.check || s.expected !== undefined) {
            const chkStatus = String(s.status || 'PASSED').toUpperCase();
            if (chkStatus === 'PASSED') checksPassedCount++;
            else checksFailedCount++;

            allCheckRows.push({
              'Run Id': log.id,
              'Step': stepLabel,
              'Check': s.check || 'Step Assertion',
              'Expected': s.expected !== undefined ? String(s.expected) : 'N/A',
              'Actual': s.actual !== undefined ? String(s.actual) : 'N/A',
              'Status': chkStatus,
            });
          }

          // Register in Created Records Sheet
          if (uniqueRecordIds.length > 0) {
            const objName = s.sobject || s.object || s.customObject || 'Record';
            uniqueRecordIds.forEach(recId => {
              allCreatedRecords.push({
                'Run Id': log.id,
                'Step': stepLabel,
                'Object': objName,
                'Record Id': recId,
                'Open in Salesforce': instanceUrl ? `${instanceUrl}/${recId}` : 'N/A',
              });
            });
          }
        });
      } else if (log.error_message) {
        // If log has no step_logs array but contains an error_message, record 1 error row
        totalStepsCount++;
        stepsFailedCount++;
        failedStepsInLog++;
        allStepRows.push({
          'Run Id': log.id,
          'Workflow / Scenario': scenarioName,
          '#': 1,
          'Step': 'Execution Failure',
          'Action / Type': 'SYSTEM_HALT',
          'Status': log.status || 'FAILED',
          'Duration (s)': typeof log.duration_ms === 'number' ? (log.duration_ms / 1000).toFixed(3) : 'N/A',
          'Record Ids': 'N/A',
          'Error / Reason': log.error_message,
        });
      }

      // Add to Scenarios Sheet
      scenarioRows.push({
        'Run / Scenario Id': log.id,
        'Workflow / Scenario': scenarioName,
        'Trigger': log.trigger_type || 'MANUAL',
        'Steps': stepLogs.length,
        'Failed steps': failedStepsInLog,
        'Duration (s)': typeof log.duration_ms === 'number' ? (log.duration_ms / 1000).toFixed(2) : 'N/A',
        'Status': log.status,
        'Started At': log.started_at ? new Date(log.started_at).toLocaleString() : 'N/A',
        'Completed At': log.completed_at ? new Date(log.completed_at).toLocaleString() : 'N/A',
        'Error Summary': log.error_message || '',
      });
    });

    const passedRuns = logs.filter(l => l.status === 'PASSED').length;
    const failedRuns = logs.filter(l => l.status === 'FAILED').length;
    const runningRuns = logs.filter(l => l.status === 'RUNNING').length;
    const latestLog = logs[0];

    // ── Sheet 1: Summary (Key-Value Table) ────────────────────────────────────
    const summaryData = [
      ['Metric', 'Value'],
      ['Environment / Connection Name', connectionStatus.name || 'N/A'],
      ['Salesforce Org / Instance URL', instanceUrl || 'N/A'],
      ['Connection ID', connectionStatus.connectionId ? String(connectionStatus.connectionId) : 'N/A'],
      ['Connection Status', connectionStatus.isConnected ? 'Connected' : 'Disconnected'],
      ['Export Timestamp', new Date().toISOString()],
      ['Workflow Filter / Scope', workflowScopeName],
      ['Run / Log ID(s) Exported', logs.map(l => l.id).join(', ')],
      ['Trigger Type(s)', Array.from(new Set(logs.map(l => l.trigger_type || 'MANUAL'))).join(', ')],
      ['Total Runs / Scenarios', logs.length],
      ['Passed Runs', passedRuns],
      ['Failed Runs', failedRuns],
      ['Running / In-Progress Runs', runningRuns],
      ['Total Steps Executed', totalStepsCount],
      ['Steps Passed', stepsPassedCount],
      ['Steps Failed', stepsFailedCount],
      ['Steps Skipped / Pending', stepsSkippedCount],
      ['Checks Passed', checksPassedCount],
      ['Checks Failed', checksFailedCount],
      ['Total Duration (s)', (totalDurationMs / 1000).toFixed(2)],
      ['Latest Run Duration (s)', latestLog && typeof latestLog.duration_ms === 'number' ? (latestLog.duration_ms / 1000).toFixed(2) : 'N/A'],
    ];

    // ── Build Workbook with SheetJS (xlsx) ───────────────────────────────────
    const workbook = XLSX.utils.book_new();

    // 1. Summary Sheet
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 32 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // 2. Scenarios Sheet
    const scenariosSheet = XLSX.utils.json_to_sheet(
      scenarioRows.length > 0
        ? scenarioRows
        : [{ 'Run / Scenario Id': 'N/A', 'Workflow / Scenario': 'N/A', 'Trigger': 'N/A', 'Steps': 0, 'Failed steps': 0, 'Duration (s)': 'N/A', 'Status': 'N/A', 'Started At': 'N/A', 'Completed At': 'N/A', 'Error Summary': '' }]
    );
    scenariosSheet['!cols'] = [
      { wch: 18 }, { wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 40 }
    ];
    XLSX.utils.book_append_sheet(workbook, scenariosSheet, 'Scenarios');

    // 3. Steps Sheet
    const stepsSheet = XLSX.utils.json_to_sheet(
      allStepRows.length > 0
        ? allStepRows
        : [{ 'Run Id': 'N/A', 'Workflow / Scenario': 'N/A', '#': 0, 'Step': 'N/A', 'Action / Type': 'N/A', 'Status': 'N/A', 'Duration (s)': 'N/A', 'Record Ids': 'N/A', 'Error / Reason': '' }]
    );
    stepsSheet['!cols'] = [
      { wch: 10 }, { wch: 26 }, { wch: 6 }, { wch: 24 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 45 }
    ];
    XLSX.utils.book_append_sheet(workbook, stepsSheet, 'Steps');

    // 4. Checks Sheet
    const checksSheet = XLSX.utils.json_to_sheet(
      allCheckRows.length > 0
        ? allCheckRows
        : [{ 'Run Id': 'N/A', 'Step': 'N/A', 'Check': 'N/A', 'Expected': 'N/A', 'Actual': 'N/A', 'Status': 'N/A' }]
    );
    checksSheet['!cols'] = [
      { wch: 10 }, { wch: 24 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(workbook, checksSheet, 'Checks');

    // 5. Created Records Sheet
    const recordsSheet = XLSX.utils.json_to_sheet(
      allCreatedRecords.length > 0
        ? allCreatedRecords
        : [{ 'Run Id': 'N/A', 'Step': 'N/A', 'Object': 'N/A', 'Record Id': 'N/A', 'Open in Salesforce': 'N/A' }]
    );
    recordsSheet['!cols'] = [
      { wch: 10 }, { wch: 24 }, { wch: 18 }, { wch: 24 }, { wch: 55 }
    ];
    XLSX.utils.book_append_sheet(workbook, recordsSheet, 'Created Records');

    // ── Generate Filename & Trigger Download ─────────────────────────────────
    const scopeTag = numericLogId ? `run_${numericLogId}` : numericWfId ? `wf_${numericWfId}` : 'all';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `assert_now_logs_${scopeTag}_${timestamp}.xlsx`;

    XLSX.writeFile(workbook, filename);

    return { filename, totalLogs: logs.length };
  }
}
