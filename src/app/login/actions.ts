'use server'

// Import Next.js server actions utilities for caching and routing
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Import the Supabase server client instance
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  // Initialize the Supabase client
  const supabase = await createClient()
  
  // Extract email and password from the submitted form data
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Attempt to sign in the user with Supabase Auth
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  // If there is an authentication error, return the error message to the client
  if (error) {
    return { error: error.message }
  }

  // Revalidate the layout cache to update UI state (e.g., navbar session state)
  revalidatePath('/', 'layout')
  
  // Redirect the user to the main dashboard upon successful login
  redirect('/')
}

export async function signup(formData: FormData) {
  // Initialize the Supabase client
  const supabase = await createClient()
  
  // Extract email and password from the submitted form data
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Attempt to register the new user
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Explicitly define the redirect URL for email verification
      // This strictly resolves the "Invalid path specified in request URL" error in production
      emailRedirectTo: 'https://task-manager-chi-pink-75.vercel.app',
    }
  })

  // If there is a registration error, return the error message to the client
  if (error) {
    return { error: error.message }
  }

  // Revalidate the layout cache to reflect the new session
  revalidatePath('/', 'layout')
  
  // Redirect the user to the main dashboard upon successful signup
  redirect('/')
}