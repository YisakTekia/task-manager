'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/types/supabase'

type Task = Database['public']['Tables']['tasks']['Row']
type TaskStatus = Database['public']['Enums']['task_status']
type User = { id: string, email: string } 

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

  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  // States for Adding and Editing Tasks
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isAddingTask, setIsAddingTask] = useState(false)
  
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{
    title: string;
    description: string | null;
    due_date: string | null;
    assignee_id: string | null;
  }>({ title: '', description: null, due_date: null, assignee_id: null })

  const [workspaceMembers, setWorkspaceMembers] = useState<User[]>([])

  // States for the Edge Function (Overdue Tasks)
  const [overdueTasks, setOverdueTasks] = useState<Task[] | null>(null)
  const [isCheckingOverdue, setIsCheckingOverdue] = useState(false)

  // URL-based Filtering Logic
  const statusFilter = searchParams.get('status')
  const assigneeFilter = searchParams.get('assignee')

  const filteredTasks = tasks.filter(task => {
    let match = true
    if (statusFilter && task.status !== statusFilter) match = false
    if (assigneeFilter && task.assignee_id !== assigneeFilter) match = false
    return match
  })

  const updateFilter = (key: string, value: string | null) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()))
    if (value) current.set(key, value)
    else current.delete(key)
    
    const search = current.toString()
    router.push(`${pathname}${search ? `?${search}` : ''}`, { scroll: false })
  }

  // Fetch workspace members for the assignee dropdown
  useEffect(() => {
    const fetchMembers = async () => {
      const { data: project } = await supabase.from('projects').select('workspace_id').eq('id', projectId).single()
      if (!project) return

      const { data: members } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', project.workspace_id)
        
      if (members) {
        // Create mock emails based on User IDs for display purposes
        setWorkspaceMembers(members.map(m => ({ id: m.user_id, email: `User-${m.user_id.substring(0,4)}` })))
      }
    }
    fetchMembers()
  }, [projectId, supabase])

  // Realtime Subscriptions via Supabase Channels
  useEffect(() => {
    const channel = supabase
      .channel(`realtime:project:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Prevent duplicate insertions during Optimistic UI updates
            setTasks((prev) => {
              const exists = prev.find(t => t.id === payload.new.id)
              return exists ? prev : [payload.new as Task, ...prev]
            })
          }
          else if (payload.eventType === 'UPDATE') {
            setTasks((prev) => prev.map(t => t.id === payload.new.id ? payload.new as Task : t))
          }
          else if (payload.eventType === 'DELETE') {
            setTasks((prev) => prev.filter(t => t.id !== payload.old.id))
          }
        }
      ).subscribe()

    // Cleanup subscription on unmount
    return () => { supabase.removeChannel(channel) }
  }, [projectId, supabase])

  // Add Task with Optimistic UI (No page reload)
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    setIsAddingTask(true)
    setErrorMsg(null)

    const newTask = {
      title: newTaskTitle,
      project_id: projectId,
      status: 'todo' as TaskStatus,
    }

    // 1. Optimistic UI: Render the task on the screen instantly
    const tempId = `temp-${Date.now()}`
    const optimisticTask: Task = {
      ...newTask,
      id: tempId,
      description: null,
      due_date: null,
      assignee_id: null,
      created_at: new Date().toISOString()
    }
    
    setTasks(prev => [optimisticTask, ...prev])
    setNewTaskTitle('')
    setIsAddingTask(false)

    // 2. Send data to the database
    const { data, error } = await supabase.from('tasks').insert(newTask).select().single()

    if (error) {
      setErrorMsg(`Failed to add task: ${error.message}`)
      setTasks(prev => prev.filter(t => t.id !== tempId)) // Rollback UI if API fails
    } else if (data) {
      setTasks(prev => prev.map(t => t.id === tempId ? data : t)) // Update temporary ID with real Database ID
    }
  }

  // Update Status with Optimistic UI
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setErrorMsg(null)
    const previousTasks = [...tasks]
    
    // Instantly update local state
    setTasks((prev) => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)

    if (error) {
      setTasks(previousTasks) // Rollback on error
      setErrorMsg(`Failed to update status: ${error.message}`)
    }
  }

  // Delete Task with Optimistic UI
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return

    setErrorMsg(null)
    const previousTasks = [...tasks]
    
    // Instantly remove from local state
    setTasks((prev) => prev.filter(t => t.id !== taskId))
    
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)

    if (error) {
      setTasks(previousTasks) // Rollback on error
      setErrorMsg(`Failed to delete task: ${error.message}`)
    }
  }

  // Save Inline Edits
  const handleSaveEdits = async (taskId: string) => {
    if (!editValues.title.trim()) {
      setEditingTaskId(null)
      return
    }

    const { error } = await supabase
      .from('tasks')
      .update({ 
        title: editValues.title,
        description: editValues.description || null,
        due_date: editValues.due_date || null,
        assignee_id: editValues.assignee_id || null
      })
      .eq('id', taskId)

    if (error) setErrorMsg(`Failed to save edits: ${error.message}`)
    
    setEditingTaskId(null)
    router.refresh()
  }

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id)
    setEditValues({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date || '',
      assignee_id: task.assignee_id || ''
    })
  }

  // Trigger Supabase Edge Function to fetch overdue tasks
  const handleCheckOverdue = async () => {
    setIsCheckingOverdue(true)
    setErrorMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('overdue-tasks', {
        body: { project_id: projectId }
      })
      if (error) throw error
      setOverdueTasks(data || [])
    } catch (err) {
      // Strict TypeScript error handling instead of using 'any'
      if (err instanceof Error) {
        setErrorMsg(`Edge Function Error: ${err.message}`)
      } else {
        setErrorMsg('An unknown error occurred while fetching overdue tasks.')
      }
    } finally {
      setIsCheckingOverdue(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Quick Add Task Form */}
      <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-3 p-3 sm:p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <input 
          type="text" 
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="What needs to be done?" 
          className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={isAddingTask}
        />
        <button 
          type="submit" 
          disabled={!newTaskTitle.trim() || isAddingTask}
          className="w-full sm:w-auto rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          {isAddingTask ? 'Adding...' : '+ Add Task'}
        </button>
      </form>

      {/* Filters and Edge Function Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-3 sm:p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
          <div className="flex flex-col w-full sm:w-auto">
            <label className="text-xs font-medium text-gray-500 mb-1">Status Filter</label>
            <select 
              value={statusFilter || ''} 
              onChange={(e) => updateFilter('status', e.target.value || null)}
              className="w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border bg-white"
            >
              <option value="">All Statuses</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          
          <div className="flex flex-col w-full sm:w-auto">
            <label className="text-xs font-medium text-gray-500 mb-1">Assignee Filter</label>
            <select 
              value={assigneeFilter || ''} 
              onChange={(e) => updateFilter('assignee', e.target.value || null)}
              className="w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border bg-white"
            >
              <option value="">All Members</option>
              {workspaceMembers.map(m => (
                <option key={m.id} value={m.id}>{m.email}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Edge Function Trigger Button */}
        <button 
          onClick={handleCheckOverdue}
          disabled={isCheckingOverdue}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isCheckingOverdue ? (
            <svg className="animate-spin h-4 w-4 text-red-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )}
          {isCheckingOverdue ? 'Checking...' : 'Find Overdue Tasks'}
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 sm:p-4 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">{errorMsg}</div>
      )}

      {/* Overdue Tasks Display Panel */}
      {overdueTasks !== null && (
        <div className="p-4 bg-red-50/50 border border-red-200 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-3 border-b border-red-100 pb-2">
            <h3 className="font-semibold text-red-800 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Overdue Tasks Found: {overdueTasks.length}
            </h3>
            <button onClick={() => setOverdueTasks(null)} className="text-red-500 hover:text-red-700 text-sm font-medium">Close</button>
          </div>
          
          {overdueTasks.length === 0 ? (
            <p className="text-sm text-red-600">Great job! There are no overdue tasks in this project.</p>
          ) : (
            <ul className="space-y-2">
              {overdueTasks.map(ot => (
                <li key={ot.id} className="flex justify-between items-center bg-white p-3 rounded border border-red-100 text-sm">
                  <span className="font-medium text-gray-900">{ot.title}</span>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span className="text-red-600 font-medium">Due: {new Date(ot.due_date!).toLocaleDateString()}</span>
                    <span>Assignee: {workspaceMembers.find(m => m.id === ot.assignee_id)?.email || 'Unassigned'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Task List Grid */}
      <div className="grid gap-3 sm:gap-4">
        {filteredTasks.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            No tasks found matching your criteria.
          </div>
        ) : (
          filteredTasks.map(task => (
            <div key={task.id} className="p-3 sm:p-4 bg-white rounded-lg border border-gray-200 shadow-sm transition-all hover:border-gray-300">
              
              {editingTaskId === task.id ? (
                // --- FULL INLINE EDITING PANEL ---
                <div className="space-y-3 sm:space-y-4">
                  <input 
                    type="text" 
                    value={editValues.title}
                    onChange={(e) => setEditValues({...editValues, title: e.target.value})}
                    placeholder="Task Title..."
                    className="w-full rounded border border-blue-500 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <textarea 
                    value={editValues.description || ''}
                    onChange={(e) => setEditValues({...editValues, description: e.target.value})}
                    placeholder="Add details or description..."
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={2}
                  />
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <input 
                      type="date"
                      value={editValues.due_date || ''}
                      onChange={(e) => setEditValues({...editValues, due_date: e.target.value})}
                      className="w-full sm:w-auto rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                    <select
                      value={editValues.assignee_id || ''}
                      onChange={(e) => setEditValues({...editValues, assignee_id: e.target.value})}
                      className="w-full sm:w-auto rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Unassigned</option>
                      {workspaceMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button onClick={() => setEditingTaskId(null)} className="flex-1 sm:flex-none text-xs bg-gray-100 text-gray-700 px-3 py-2 sm:py-1.5 rounded hover:bg-gray-200 font-medium">
                      Cancel
                    </button>
                    <button onClick={() => handleSaveEdits(task.id)} className="flex-1 sm:flex-none text-xs bg-blue-600 text-white px-3 py-2 sm:py-1.5 rounded hover:bg-blue-700 font-medium shadow-sm">
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                // --- VIEW MODE ---
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-2 pr-2">
                      <span className="font-semibold text-gray-900 text-base sm:text-lg break-words">
                        {task.title}
                      </span>
                      <button 
                        onClick={() => startEditing(task)}
                        className="mt-0.5 p-1 sm:p-1.5 text-blue-500 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors shrink-0"
                        title="Edit Task Details"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                        className={`text-xs font-semibold rounded-full px-3 py-1.5 border-0 cursor-pointer focus:ring-2 focus:ring-offset-1 shrink-0
                          ${task.status === 'todo' ? 'bg-gray-100 text-gray-700' : 
                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 
                            'bg-green-100 text-green-700'}`}
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>

                      <button 
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1 sm:p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0"
                        title="Delete Task"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2.5 sm:space-y-2">
                    <p className={`text-sm ${task.description ? 'text-gray-600' : 'text-gray-400 italic'} line-clamp-3 sm:line-clamp-2`}>
                      {task.description || "No description provided."}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 sm:gap-3 text-xs text-gray-500">
                      {task.due_date && (
                        <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                      
                      {task.assignee_id && (
                        <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          <span className="truncate max-w-[100px] sm:max-w-none">
                            {workspaceMembers.find(m => m.id === task.assignee_id)?.email || 'Assigned'}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}