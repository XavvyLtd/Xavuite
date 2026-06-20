/**
 * modules/pmo/hooks/usePMOSelectors.ts
 *
 * Business logic extracted from PMO.tsx.
 */

import { useMemo } from 'react';
import { useProjects, useTasks, type Project, type Task } from '../../../hooks/api';

export interface ProjectMetrics {
  total:       number;
  active:      number;
  totalBudget: number;
  totalSpent:  number;
  openTasks:   number;
}

export function useProjectMetrics(projects: Project[], tasks: Task[]): ProjectMetrics {
  return useMemo(() => ({
    total:       projects.length,
    active:      projects.filter(p => p.status === 'active').length,
    totalBudget: projects.reduce((a, p) => a + (p.budget ?? 0), 0),
    totalSpent:  projects.reduce((a, p) => a + (p.spent  ?? 0), 0),
    openTasks:   tasks.filter(t => t.status !== 'done').length,
  }), [projects, tasks]);
}

export function getBudgetPct(project: Project): number {
  if (!project.budget || project.budget === 0) return 0;
  return Math.round(((project.spent ?? 0) / project.budget) * 100);
}

export const KANBAN_COLUMNS = [
  { key: 'backlog',     label: 'Backlog',      color: '#475569' },
  { key: 'todo',        label: 'To Do',        color: '#94A3B8' },
  { key: 'in_progress', label: 'In Progress',  color: '#F59E0B' },
  { key: 'review',      label: 'Review',       color: '#38BDF8' },
  { key: 'done',        label: 'Done',         color: '#10B981' },
] as const;
