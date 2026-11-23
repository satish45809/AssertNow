import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { OverviewPage } from '@/pages/OverviewPage';
import { IntegrationsPage } from '@/pages/IntegrationsPage';
import { MetadataRegistryPage } from '@/pages/MetadataRegistryPage';
import { WorkflowListPage } from '@/pages/WorkflowListPage';
import { WorkflowStudio } from '@/pages/studio/WorkflowStudio';
import { ExecutionListPage } from '@/pages/ExecutionListPage';
import { ExecutionDetailPage } from '@/pages/ExecutionDetailPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { TeamPage } from '@/pages/TeamPage';
import { SubscriptionPage } from '@/pages/SubscriptionPage';
import { AuditPage } from '@/pages/AuditPage';
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/overview" replace />,
      },
      {
        path: 'overview',
        element: <OverviewPage />,
      },
      {
        path: 'integrations',
        element: <IntegrationsPage />,
      },
      {
        path: 'metadata',
        element: <Navigate to="/integrations" replace />,
      },
      {
        path: 'workflows',
        element: <WorkflowListPage />,
      },
      {
        path: 'executions',
        element: <ExecutionListPage />,
      },
      {
        path: 'executions/:id',
        element: <ExecutionDetailPage />,
      },
      {
        path: 'reports',
        element: <ReportsPage />,
      },
      {
        path: 'team',
        element: <TeamPage />,
      },
      {
        path: 'subscription',
        element: <SubscriptionPage />,
      },
      {
        path: 'audit',
        element: <AuditPage />,
      },
    ],
  },
  {
    path: '/studio/:id',
    element: <WorkflowStudio />,
  },
  {
    path: '/studio/new',
    element: <WorkflowStudio />,
  },
  {
    path: '/oauth/callback',
    element: <OAuthCallbackPage />,
  },
  {
    path: '*',
    element: <Navigate to="/overview" replace />,
  },
]);
