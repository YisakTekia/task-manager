'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/types/supabase'

// Use Supabase generated types (Requirement R2)
type Task = Database['public']['Tables']['tasks']['Row']
type TaskStatus = Database['public']['Enums']['task_status']

export default function TaskList({ 
  projectId, 
  initialTasks 
}: { 
  projectId: string, 
  initialTasks: Task[] 
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Local State for Tasks and Error Handling
  const [overdueTasks, setOverdueTasks] = useState<(Task & { assignee_name: string })[] | null>(null)
  const [isCheckingOverdue, setIsCheckingOverdue] = useState(false)
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  // State for Inline Editing (Requirement R5)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTitleValue, setEditTitleValue] = useState<string>('')

  // URL-based Filters (Requirement R4)
  const statusFilter = searchParams.get('status')
  const assigneeFilter = searchParams.get('assignee')

  // Apply filters to the task list
  const filteredTasks = tasks.filter(task => {
    let match = true
    if (statusFilter && task.status !== statusFilter) match = false
    if (assigneeFilter && task.assignee_id !== assigneeFilter) match = false
    return match
  })

  // Function to sync filter state to URL query parameters
  const updateFilter = (key: string, value: string | null) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()))
    if (value) {
      current.set(key, value)
    } else {
      current.delete(key)
    }
    const search = current.toString()
    const query = search ? `?${search}` : ''
    router.push(`${pathname}${query}`, { scroll: false })
  }

  // Realtime Subscriptions (Requirement R3)
  useEffect(() => {
    const channel = supabase
      .channel(`realtime:project:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, and DELETE
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks((prev) => [payload.new as Task, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setTasks((prev) => prev.map(t => t.id === payload.new.id ? payload.new as Task : t))
          } else if (payload.eventType === 'DELETE') {
            setTasks((prev) => prev.filter(t => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, supabase])

  // Optimistic UI for Status Changes (Requirement R7)
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setErrorMsg(null)

    // 1. Save previous state for rollback
    const previousTasks = [...tasks]
    const taskToUpdate = tasks.find(t => t.id === taskId)
    if (!taskToUpdate || taskToUpdate.status === newStatus) return

    // 2. Optimistic Update: Update UI instantly without waiting for API
    setTasks((prev) => 
      prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
    )

    // 3. Perform API Call
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId)

    // 4. Rollback state if API fails and show feedback
    if (error) {
      setTasks(previousTasks)
      setErrorMsg(`Failed to update status: ${error.message}`)
    }
  }

  // Inline Title Editing - Save Action
  const handleTitleSave = async (taskId: string) => {
    if (!editTitleValue.trim()) {
      setEditingTaskId(null)
      return
    }

    const { error } = await supabase
      .from('tasks')
      .update({ title: editTitleValue })
      .eq('id', taskId)

    if (error) {
      setErrorMsg(`Failed to update title: ${error.message}`)
    }
    
    setEditingTaskId(null)
  }

  // Call Edge Function to get overdue tasks (Requirement R8)
  const checkOverdueTasks = async () => {
    setIsCheckingOverdue(true)
    setErrorMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('overdue-tasks', {
        body: { project_id: projectId }
      })
      
      if (error) throw error
      setOverdueTasks(data)
    } catch (err) {
  setErrorMsg(`Edge Function Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
} finally {
      setIsCheckingOverdue(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters UI synced with URL */}
      <div className="flex gap-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 mb-1">Status Filter</label>
          <select 
            value={statusFilter || ''} 
            onChange={(e) => updateFilter('status', e.target.value || null)}
            className="rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border"
          >
            <option value="">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>

      {/* Error State Feedback */}
      {errorMsg && (
        <div className="p-4 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
          {errorMsg}
        </div>
      )}

      {/* Task List Grid */}
      <div className="grid gap-4">
        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            No tasks found matching your criteria.
          </div>
        ) : (
          filteredTasks.map(task => (
            <div key={task.id} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-gray-300">
              
              {/* Inline Editable Title */}
              <div className="flex-1">
                {editingTaskId === task.id ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      autoFocus
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(task.id) }}
                      className="flex-1 rounded border border-blue-500 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button 
                      onClick={() => handleTitleSave(task.id)}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setEditingTaskId(null)}
                      className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <span 
                    onClick={() => {
                      setEditingTaskId(task.id)
                      setEditTitleValue(task.title)
                    }}
                    className="font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline decoration-dashed decoration-gray-300 underline-offset-4"
                    title="Click to edit"
                  >
                    {task.title}
                  </span>
                )}
              </div>

              {/* Status Dropdown (Triggers Optimistic Update) */}
              <div className="flex items-center gap-3">
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                  className={`text-xs font-semibold rounded-full px-3 py-1.5 border-0 cursor-pointer focus:ring-2 focus:ring-offset-1 
                    ${task.status === 'todo' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 
                      task.status === 'in_progress' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 
                      'bg-green-100 text-green-700 hover:bg-green-200'}`}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  )
}