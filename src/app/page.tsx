import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
// Imported both server actions here
import { createWorkspace, createProject } from './login/actions'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('*')

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, project_id, status')

  if (wsError || projError || tasksError) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="rounded-md bg-red-50 p-6 border border-red-200 text-center">
          <h3 className="text-lg font-medium text-red-800">Error loading dashboard</h3>
          <p className="mt-2 text-sm text-red-700">
            {wsError?.message || projError?.message || tasksError?.message}
          </p>
        </div>
      </div>
    )
  }

  // 1. DEDUPLICATION LOGIC: Ensure workspaces are unique by ID
  const uniqueWorkspaces = workspaces 
    ? Array.from(new Map(workspaces.map(item => [item.id, item])).values())
    : []

  // Use uniqueWorkspaces instead of raw workspaces from here down
  if (uniqueWorkspaces.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 px-4 text-center">
        <div className="rounded-full bg-blue-50 p-3">
          <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">No Workspaces Found</h2>
        <p className="max-w-sm text-gray-500">You are not a member of any workspaces yet. Create one to start managing your projects.</p>
        
        <form 
          action={async (formData) => {
            'use server'
            await createWorkspace(formData)
          }} 
          className="mt-6 flex flex-col items-center gap-3 w-full max-w-xs"
        >
          <input 
            type="text" 
            name="name" 
            required 
            placeholder="Enter workspace name..." 
            className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
            Create Workspace
          </button>
        </form>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Workspaces Dashboard</h1>
        <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
          + New Workspace
        </button>
      </div>

      <div className="space-y-8">
        {/* Mapping through unique workspaces to prevent duplicates */}
        {uniqueWorkspaces.map((workspace) => {
          const workspaceProjects = projects?.filter(p => p.workspace_id === workspace.id) || []

          return (
            <div key={workspace.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
                <h2 className="text-xl font-semibold text-gray-800">{workspace.name}</h2>
                <span className="text-sm text-gray-500">{workspaceProjects.length} Projects</span>
              </div>
              
              {/* Projects Grid */}
              {workspaceProjects.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                  {workspaceProjects.map((project) => {
                    const projectTasks = tasks?.filter(t => t.project_id === project.id) || []
                    const todoCount = projectTasks.filter(t => t.status === 'todo').length
                    const inProgressCount = projectTasks.filter(t => t.status === 'in_progress').length
                    const doneCount = projectTasks.filter(t => t.status === 'done').length

                    return (
                      <Link 
                        key={project.id} 
                        href={`/projects/${project.id}`}
                        className="group flex flex-col justify-between rounded-lg border border-gray-200 bg-gray-50 p-5 transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm"
                      >
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 mb-4">{project.name}</h3>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">To Do</span>
                            <span className="font-medium text-gray-900">{todoCount}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-yellow-600">In Progress</span>
                            <span className="font-medium text-gray-900">{inProgressCount}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-green-600">Done</span>
                            <span className="font-medium text-gray-900">{doneCount}</span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-md bg-gray-50 py-8 text-center border border-dashed border-gray-200 mb-6">
                  <p className="text-sm text-gray-500">No projects in this workspace yet.</p>
                </div>
              )}

              {/* 2. CREATE PROJECT FORM: Added with use server wrapper */}
              <div className="border-t border-gray-100 pt-4">
                <form 
                  action={async (formData) => {
                    'use server'
                    await createProject(formData)
                  }} 
                  className="flex items-center gap-3 max-w-md"
                >
                  {/* Hidden input to securely link project to workspace */}
                  <input type="hidden" name="workspace_id" value={workspace.id} />
                  
                  <input 
                    type="text" 
                    name="name" 
                    required 
                    placeholder="New project name..." 
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button type="submit" className="rounded-md bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 transition-colors whitespace-nowrap">
                    Add Project
                  </button>
                </form>
              </div>

            </div>
          )
        })}
      </div>
    </main>
  )
}