import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'



const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { project_id } = await req.json()
    if (!project_id) {
      throw new Error('project_id is required')
    }

    // 1. Create a Supabase client with the Auth context of the logged-in user 
    // This strictly enforces RLS policies so users cannot query projects outside their workspace
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 2. Fetch overdue tasks for the given project
    const { data: tasks, error: tasksError } = await supabaseClient
      .from('tasks')
      .select('*')
      .eq('project_id', project_id)
      .neq('status', 'done')
      .lt('due_date', new Date().toISOString())

    if (tasksError) throw tasksError

    // 3. Since auth.users is restricted, we use the service_role key ONLY server-side 
    // to fetch the emails/names for the assignees of the tasks we ALREADY successfully fetched.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Map tasks to include assignee names (using email as name placeholder)
    const tasksWithAssignees = await Promise.all(
      tasks.map(async (task) => {
        if (!task.assignee_id) return { ...task, assignee_name: 'Unassigned' }
        
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(task.assignee_id)
        return {
          ...task,
          assignee_name: userData?.user?.email || 'Unknown User'
        }
      })
    )

    return new Response(JSON.stringify(tasksWithAssignees), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})