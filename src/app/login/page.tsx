'use client'

import { useState } from 'react'
import { login, signup } from './actions' 

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isLoginView, setIsLoginView] = useState<boolean>(true)

  // Modern Next.js Server Action handler for the form
  async function handleAuth(formData: FormData) {
    setIsLoading(true)
    setErrorMsg(null)
    
    // Determine which server action to call based on the current UI state
    const actionToRun = isLoginView ? login : signup
    
    // Call the server action directly. 
    // Note: No try...catch block is used here so Next.js can handle redirects normally.
    const response = await actionToRun(formData)
        
    // Only display an error if the Supabase action explicitly returns one
    if (response?.error) {
      setErrorMsg(response.error)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-sm border border-gray-100">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
            {isLoginView ? 'Sign in to your account' : 'Create a new account'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isLoginView ? 'Welcome back to your workspace.' : 'Get started with task management.'}
          </p>
        </div>

        {/* Form handling using Next.js Server Actions */}
        <form action={handleAuth} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Error Message Display */}
          {errorMsg && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{errorMsg}</div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Processing...' : (isLoginView ? 'Sign in' : 'Sign up')}
          </button>
        </form>

        {/* Toggle between Login and Signup modes */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setIsLoginView(!isLoginView)
              setErrorMsg(null)
            }}
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            {isLoginView 
              ? "Don't have an account? Sign up" 
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  )
}