import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function Header() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  if (!user) return null

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4 flex justify-between items-center sticky top-0 z-10">
      <h1 className="text-xl font-bold tracking-tight text-gray-900">Task Manager</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">{user.email}</span>
        <form action={signOut}>
          <button 
            type="submit" 
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  )
}