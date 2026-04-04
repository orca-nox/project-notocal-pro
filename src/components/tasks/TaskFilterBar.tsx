import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TaskFilters, TaskSortField } from '@/types/store'
import type { Project } from '@/types/entities'

interface TaskFilterBarProps {
  filters: TaskFilters
  projects: Map<string, Project>
  onFilterChange: <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => void
  onReset: () => void
  totalCount: number
  filteredCount: number
}

function FilterSelect<V extends string>({
  value,
  onChange,
  options,
}: {
  value: V
  onChange: (v: V) => void
  options: { value: V; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as V)}
      className="h-7 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function TaskFilterBar({
  filters,
  projects,
  onFilterChange,
  onReset,
  totalCount,
  filteredCount,
}: TaskFilterBarProps) {
  const projectOptions: { value: string; label: string }[] = [
    { value: '', label: 'All Projects' },
    ...Array.from(projects.values())
      .sort((a, b) => a.priority - b.priority)
      .map((p) => ({ value: p.uid, label: p.summary })),
    { value: '__unassigned__', label: 'Unassigned' },
  ]

  const isFiltered = filters.status !== 'all' ||
    filters.dueDate !== 'all' ||
    filters.priority !== 'all' ||
    filters.projectId !== null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <FilterSelect
        value={filters.status}
        onChange={(v) => onFilterChange('status', v)}
        options={[
          { value: 'all', label: 'All Status' },
          { value: 'needs-action', label: 'Needs Action' },
          { value: 'in-process', label: 'In Process' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
        ]}
      />
      <FilterSelect
        value={filters.dueDate}
        onChange={(v) => onFilterChange('dueDate', v)}
        options={[
          { value: 'all', label: 'All Dates' },
          { value: 'overdue', label: 'Overdue' },
          { value: 'today', label: 'Today' },
          { value: 'week', label: 'This Week' },
          { value: 'month', label: 'This Month' },
          { value: 'none', label: 'No Due Date' },
        ]}
      />
      <FilterSelect
        value={filters.projectId ?? ''}
        onChange={(v) => onFilterChange('projectId', v || null)}
        options={projectOptions}
      />
      <FilterSelect
        value={filters.priority}
        onChange={(v) => onFilterChange('priority', v)}
        options={[
          { value: 'all', label: 'All Priority' },
          { value: 'high', label: 'High' },
          { value: 'medium', label: 'Medium' },
          { value: 'low', label: 'Low' },
          { value: 'none', label: 'No Priority' },
        ]}
      />
      <FilterSelect
        value={filters.sort}
        onChange={(v) => onFilterChange('sort', v as TaskSortField)}
        options={[
          { value: 'dueDate', label: 'Sort: Due Date' },
          { value: 'priority', label: 'Sort: Priority' },
          { value: 'project', label: 'Sort: Project' },
          { value: 'created', label: 'Sort: Created' },
        ]}
      />

      {isFiltered && (
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onReset}>
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      )}

      <span className="ml-auto text-xs text-muted-foreground">
        {filteredCount === totalCount
          ? `${totalCount} tasks`
          : `${filteredCount} of ${totalCount} tasks`}
      </span>
    </div>
  )
}
