#  Fullstack Task Manager

## ⏱️ Time Log
- **Exact Start Time:**  Monday, June 2, 2026, 02:40 PM (GMT+3)
- **Exact End Time:**  Tuesday, June 3, 2026, 01:00 PM (GMT+3)

## ✅ What is complete and working
I have successfully implemented all core and bonus requirements within the 24-hour window:
1. **Supabase Auth & RLS:** Full authentication flow. Strict Row Level Security (RLS) is implemented for all 4 operations (SELECT, INSERT, UPDATE, DELETE) across all tables to guarantee workspace isolation.
2. **Realtime Sync:** Tasks automatically sync across connected clients in the same workspace without page reloads using Supabase Channels.
3. **Inline Editing:** Full inline editing capability for tasks (Title, Description, Due Date, and Assignee) on the project view.
4. **URL-Synced Filtering:** Task list filtering by both status and assignee simultaneously, with state persisting in the URL.
5. **Typescript Strictness:** Zero `any` types used anywhere in the codebase. Supabase generated types are utilized extensively.
6. **Bonus - Optimistic UI:** Instant local state updates for task status changes and deletions, with automatic rollback and user-visible error feedback upon API failure.
7. **Bonus - Edge Function:** Created a secure Deno-based Supabase Edge Function (`overdue-tasks`) that fetches overdue, incomplete tasks for a specific project. Connected and displayed via the UI.
8. **Responsive UI/UX:** A clean, intentional, mobile-first design that adapts beautifully to 375px and 1280px minimums, including loading, empty, and error states.

## 🚧 What is incomplete, skipped, or broken — and why
- **Complex Animations/Transitions:** To strictly adhere to the 24-hour limit and prioritize bulletproof backend architecture (RLS, Edge Functions, Typescript strictness), I opted for clean, native-feeling micro-interactions (like hover opacities and subtle color shifts) rather than heavy animation libraries (like Framer Motion). 
- **Extensive Dashboard Analytics:** The workspace dashboard meets the core requirement (projects overview with task counts), but I skipped adding complex charts to focus entirely on perfecting the "Task Detail/Inline Editing" execution. As noted in the instructions, "A perfect task manager beats a half-built dashboard every time."

## 🏗️ Architectural Decisions & Tradeoffs
1. **Fixing Infinite Recursion in RLS:** Initially, writing RLS policies directly joining the `workspace_members` table caused a Postgres infinite recursion error. To fix this robustly, I implemented a `SECURITY DEFINER` function (`get_my_workspace_ids()`). This safely retrieves authorized workspaces for the current user and bypasses the recursion loop, keeping queries highly performant.
2. **Server Components vs. Client Components:**
   I leveraged Next.js App Router paradigms by keeping the data-fetching and layouts largely server-side, but explicitly made the `TaskList` a heavily interactive Client Component (`'use client'`). This allowed me to handle Realtime subscriptions, Optimistic UI, and complex local state (inline editing) seamlessly.
3. **Quick Add vs. Full Add Pattern:**
   For task creation, I implemented a "Quick Add" pattern where users only type the title to create a task. They can immediately use the robust inline-editor to fill in the due date, assignee, and description. This greatly reduces friction and enhances the UX for fast data entry.

## 💻 How to run locally 

1. Clone the repository and install dependencies:
   ```bash
   npm install

2. Copy the environment variables:

```Bash

cp .env.example .env.local
```
(Ensure you fill in your NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY)

3. Run the development server:

```Bash

npm run dev 