import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import TaskList from './TaskList'
import Link from 'next/link'

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { id } = params

  // Fetch project details. RLS ensures users only see their workspace's projects.
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  // Return 404 if the project doesn't exist or access is denied
  if (projectError || !project) {
    notFound() 
  }

  // Fetch initial tasks for this project (No useEffect for initial data fetching - R38)
  const { data: initialTasks, error: tasksError } = await supabase
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

      {/* Injecting the Client Component that handles Realtime and Optimistic UI */}
      <TaskList 
        projectId={project.id} 
        initialTasks={initialTasks || []} 
      />
    </main>
  )
}