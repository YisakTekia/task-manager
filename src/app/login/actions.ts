'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'https://task-manager-chi-pink-75.vercel.app',
    }
  })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function createWorkspace(formData: FormData) {
  // Initialize the Supabase server client securely
  const supabase = await createClient()
  
  // Extract and strictly type the workspace name
  const name = formData.get('name') as string

  // Fetch the currently authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Authentication required to create a workspace' }
  }

  // 1. Generate a new UUID for the workspace to use across tables
  const newWorkspaceId = crypto.randomUUID()

  // 2. Insert the core workspace record
  const { error: workspaceError } = await supabase.from('workspaces').insert({
    id: newWorkspaceId,
    name: name
  })

  if (workspaceError) {
    return { error: workspaceError.message }
  }

  // 3. Link the user to the workspace to satisfy RLS viewing policies
  // Note: If TS highlights 'user_id' or 'workspace_id', press Ctrl+Space to match your exact Supabase column names
  const { error: memberError } = await supabase.from('workspace_members').insert({
    workspace_id: newWorkspaceId,
    user_id: user.id
  })

  if (memberError) {
    console.error("Failed to link member to workspace:", memberError)
    // Optional: You can choose to return an error here, or let the workspace creation succeed
  }

  // Revalidate the dashboard to immediately display the new workspace
  revalidatePath('/')
}

export async function createProject(formData: FormData) {
  const supabase = await createClient()
  
  const name = formData.get('name') as string
  const workspace_id = formData.get('workspace_id') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Authentication required' }

  // Insert project
  const { error } = await supabase.from('projects').insert({
    name: name,
    workspace_id: workspace_id,
    // Add any other required fields here if your table needs them
  })

  if (error) {
    console.error("Project error:", error)
    return { error: error.message }
  }

  revalidatePath('/')

}
//create task server action for the form in TaskList.tsx
export async function createTask(formData: FormData) {
  const supabase = await createClient()
  
  const title = formData.get('title') as string
  const project_id = formData.get('project_id') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Authentication required' }

  const { error } = await supabase.from('tasks').insert({
    id: crypto.randomUUID(), 
    title: title,
    project_id: project_id,
    status: 'todo',
    assignee_id: user.id
  })

  if (error) {
    console.error("Task creation error:", error)
  }

  revalidatePath(`/projects/${project_id}`)
}