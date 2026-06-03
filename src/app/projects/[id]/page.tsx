import { createClient } from '@/utils/supabase/server'
import TaskList from './TaskList'
import Link from 'next/link'
import { createTask } from '@/app/login/actions'

// Next.js 15 requires params to be awaited
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const supabase = await createClient()
  
  // 1. Await params to safely get the project ID
  const resolvedParams = await params
  const id = resolvedParams.id

  // 2. Fetch project details
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  // 3. DEBUG UI: Instead of a blank 404 page, show exactly what failed
  if (projectError || !project) {
    return (
      <div className="mx-auto max-w-2xl p-10 mt-20 bg-red-50 border border-red-200 rounded-xl shadow-sm">
        <h1 className="text-2xl font-bold text-red-800 mb-4">Oops! Couldnot&apos;t load this project.</h1>
        <div className="space-y-2 text-sm text-red-700 bg-white p-4 rounded border border-red-100">
          <p><strong>Searched ID:</strong> {id}</p>
          <p><strong>Database Error:</strong> {projectError?.message || 'No project found with this ID. It might be deleted or blocked by RLS policies.'}</p>
        </div>
        <Link href="/" className="mt-6 inline-block font-medium text-blue-600 hover:text-blue-800 transition-colors">
          &larr; Back to Dashboard
        </Link>
      </div>
    )
  }

  // 4. Fetch initial tasks for this project
  const { data: initialTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
          &larr; Back to Dashboard
        </Link>
      </div>
      
      <div className="mb-8 flex items-center justify-between border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{project.name}</h1>
          <p className="mt-2 text-sm text-gray-500">Manage tasks, update statuses, and collaborate in real-time.</p>
        </div>
      </div>

      <div className="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <form 
          action={async (formData) => {
            'use server'
            await createTask(formData)
          }} 
          className="flex items-center gap-3"
        >
          <input type="hidden" name="project_id" value={project.id} />
          
          <input 
            type="text" 
            name="title" 
            required 
            placeholder="What needs to be done?" 
            className="flex-1 rounded-md border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
          />
          <button 
            type="submit" 
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            + Add Task
          </button>
        </form>
      </div>

      <TaskList 
        projectId={project.id} 
        initialTasks={initialTasks || []} 
      />
    </main>
  )
}