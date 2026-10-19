import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { FocusedLayout } from './components/layout/FocusedLayout'
import { RootShell } from './components/app/RootShell'
import type { RouteHandle } from './app/pages/ComingSoon'
import { RouteError } from './pages/RouteError'

/** Wraps a dynamic page import so each route ships as its own chunk. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => {
  const mod = await load()
  return { Component: mod.default }
}

const comingSoon = page(() => import('./app/pages/ComingSoon'))

/** An app section that isn't built yet: shows the Coming soon page with this title. */
const soon = (path: string, handle: RouteHandle): RouteObject => ({ path, handle, lazy: comingSoon })

const marketingRoutes: RouteObject = {
  element: <Layout />,
  errorElement: <RouteError />,
  children: [
    { index: true, lazy: page(() => import('./pages/Home')) },
    { path: 'features', lazy: page(() => import('./pages/Features')) },
    { path: 'solutions', lazy: page(() => import('./pages/Solutions')) },
    { path: 'pricing', lazy: page(() => import('./pages/Pricing')) },
    { path: 'integrations', lazy: page(() => import('./pages/Integrations')) },
    { path: 'about', lazy: page(() => import('./pages/About')) },
    { path: 'contact', lazy: page(() => import('./pages/Contact')) },
    { path: 'demo', lazy: page(() => import('./pages/Demo')) },
    { path: 'blog', lazy: page(() => import('./pages/Blog')) },
    { path: 'blog/:slug', lazy: page(() => import('./pages/BlogPost')) },
    { path: 'help', lazy: page(() => import('./pages/HelpCenter')) },
    { path: 'help/:slug', lazy: page(() => import('./pages/HelpArticle')) },
    { path: 'privacy', lazy: page(() => import('./pages/Privacy')) },
    { path: 'terms', lazy: page(() => import('./pages/Terms')) },
    { path: 'login', lazy: page(() => import('./pages/Login')) },
    { path: 'signup', lazy: page(() => import('./pages/Signup')) },
    { path: 'reset-password', lazy: page(() => import('./pages/ResetPassword')) },
    { path: 'newsletter/confirm', lazy: page(() => import('./pages/NewsletterConfirm')) },
    { path: 'newsletter/unsubscribe', lazy: page(() => import('./pages/NewsletterUnsubscribe')) },
    { path: 'confirm-email-change', lazy: page(() => import('./pages/EmailChange')) },
    { path: 'cancel-email-change', lazy: page(() => import('./pages/CancelEmailChange')) },
    { path: '*', lazy: page(() => import('./pages/NotFound')) },
  ],
}

/** Signed-in setup flow: verify email → onboarding (no marketing nav/footer). */
const setupRoutes: RouteObject = {
  element: <FocusedLayout />,
  errorElement: <RouteError />,
  children: [
    { path: 'verify-email', lazy: page(() => import('./pages/VerifyEmail')) },
    { path: 'onboarding', lazy: page(() => import('./pages/Onboarding')) },
    { path: 'setup-2fa', lazy: page(() => import('./pages/SetupTwoFactor')) },
    { path: 'invite', lazy: page(() => import('./pages/Invite')) },
    { path: 'workspace-suspended', lazy: page(() => import('./pages/WorkspaceSuspended')) },
  ],
}

/** The CRM app. AppLayout only renders for verified users with a workspace. */
const appRoutes: RouteObject = {
  path: 'app',
  // The whole app shell is its own chunk, so marketing visitors never download it.
  lazy: page(() => import('./app/AppLayout')),
  errorElement: <RouteError />,
  children: [
    { index: true, lazy: page(() => import('./app/pages/AppHome')) },
    { path: 'leads', lazy: page(() => import('./features/leads/LeadsPage')) },
    { path: 'leads/:id', lazy: page(() => import('./features/leads/LeadDetailPage')) },
    { path: 'contacts', lazy: page(() => import('./features/contacts/ContactsPage')) },
    { path: 'contacts/:id', lazy: page(() => import('./features/contacts/ContactDetailPage')) },
    { path: 'companies', lazy: page(() => import('./features/companies/CompaniesPage')) },
    { path: 'companies/:id', lazy: page(() => import('./features/companies/CompanyDetailPage')) },
    { path: 'deals', lazy: page(() => import('./features/deals/DealsPage')) },
    { path: 'deals/:id', lazy: page(() => import('./features/deals/DealDetailPage')) },
    { path: 'tasks', lazy: page(() => import('./features/tasks/TasksPage')) },
    soon('inbox', { title: 'Inbox', module: 'M19', description: 'A shared WhatsApp and email inbox for your team.' }),
    soon('quotes', { title: 'Quotes', module: 'M17', description: 'GST-ready quotes from your product catalogue.' }),
    soon('reports', { title: 'Reports', module: 'M15', description: 'Revenue, conversion by source and team performance at a glance.' }),
    soon('automation', { title: 'Automation', module: 'M18', description: 'Follow-ups and assignments that run themselves.' }),
    { path: 'notifications', lazy: page(() => import('./features/notifications/NotificationInbox')) },
    {
      path: 'settings',
      lazy: page(() => import('./app/pages/SettingsLayout')),
      children: [
        { index: true, element: <Navigate to="workspace" replace /> },
        { path: 'workspace', lazy: page(() => import('./app/pages/WorkspaceSettings')) },
        { path: 'profile', lazy: page(() => import('./app/pages/ProfileSettings')) },
        { path: 'security', lazy: page(() => import('./app/pages/SecuritySettings')) },
        { path: 'notifications', lazy: page(() => import('./features/notifications/NotificationSettings')) },
        { path: 'team', lazy: page(() => import('./app/pages/TeamSettings')) },
        { path: 'pipelines', lazy: page(() => import('./features/pipelines/PipelinesSettings')) },
        { path: 'custom-fields', lazy: page(() => import('./features/custom-fields/CustomFieldsSettings')) },
        { path: 'leads', lazy: page(() => import('./features/leads/LeadSettings')) },
        { path: 'plan', lazy: page(() => import('./app/pages/PlanSettings')) },
        soon('billing', { title: 'Billing', module: 'M16' }),
        soon('*', { title: 'Settings' }),
      ],
    },
    soon('*', { title: 'This page' }),
  ],
}

const routes: RouteObject[] = [{ element: <RootShell />, children: [marketingRoutes, setupRoutes, appRoutes] }]

export const router = createBrowserRouter(routes)
