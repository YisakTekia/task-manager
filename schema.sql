-- 1. Create Enums
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE public.workspace_role AS ENUM ('owner', 'member');

-- 2. Create Tables
CREATE TABLE public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workspace_members (
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.workspace_role NOT NULL DEFAULT 'member',
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status public.task_status NOT NULL DEFAULT 'todo',
    assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 4. RLS Helper Functions for Security and Performance
CREATE OR REPLACE FUNCTION public.has_workspace_access(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_project_access(p_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
    WHERE p.id = p_id AND wm.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLS Policies (Covering SELECT, INSERT, UPDATE, DELETE for all tables)

-- Workspaces Policies
CREATE POLICY "Users can view their workspaces" ON public.workspaces FOR SELECT TO authenticated USING (public.has_workspace_access(id));
CREATE POLICY "Users can create workspaces" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update their workspaces" ON public.workspaces FOR UPDATE TO authenticated USING (public.has_workspace_access(id));
CREATE POLICY "Users can delete their workspaces" ON public.workspaces FOR DELETE TO authenticated USING (public.has_workspace_access(id));

-- Workspace Members Policies
CREATE POLICY "Users can view workspace members" ON public.workspace_members FOR SELECT TO authenticated USING (public.has_workspace_access(workspace_id));
CREATE POLICY "Users can insert workspace members" ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.has_workspace_access(workspace_id));
CREATE POLICY "Users can update workspace members" ON public.workspace_members FOR UPDATE TO authenticated USING (public.has_workspace_access(workspace_id));
CREATE POLICY "Users can delete workspace members" ON public.workspace_members FOR DELETE TO authenticated USING (public.has_workspace_access(workspace_id));

-- Projects Policies
CREATE POLICY "Users can view projects" ON public.projects FOR SELECT TO authenticated USING (public.has_workspace_access(workspace_id));
CREATE POLICY "Users can create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(workspace_id));
CREATE POLICY "Users can update projects" ON public.projects FOR UPDATE TO authenticated USING (public.has_workspace_access(workspace_id));
CREATE POLICY "Users can delete projects" ON public.projects FOR DELETE TO authenticated USING (public.has_workspace_access(workspace_id));

-- Tasks Policies
CREATE POLICY "Users can view tasks" ON public.tasks FOR SELECT TO authenticated USING (public.has_project_access(project_id));
CREATE POLICY "Users can create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.has_project_access(project_id));
CREATE POLICY "Users can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (public.has_project_access(project_id));
CREATE POLICY "Users can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (public.has_project_access(project_id));

-- 1. Insert Workspaces
INSERT INTO public.workspaces (id, name) VALUES 
('a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'Aspio Evaluation Workspace'),
('f6e5d4c3-b2a1-4f5e-8d7c-6b5a4f3e2d1c', 'Personal Projects Workspace')
ON CONFLICT DO NOTHING;

-- 2. Insert Workspace Members 
INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES 
('a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', '05d2db45-7d72-42df-807f-4c7b0563a997', 'owner'),
('f6e5d4c3-b2a1-4f5e-8d7c-6b5a4f3e2d1c', '05d2db45-7d72-42df-807f-4c7b0563a997', 'owner')
ON CONFLICT DO NOTHING;

-- 3. Insert Projects
INSERT INTO public.projects (id, workspace_id, name) VALUES
('11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'Frontend Development'),
('22222222-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'Backend Architecture'),
('33333333-3333-3333-3333-333333333333', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'UI/UX Design'),
('44444444-4444-4444-4444-444444444444', 'f6e5d4c3-b2a1-4f5e-8d7c-6b5a4f3e2d1c', 'House Renovation')
ON CONFLICT DO NOTHING;

-- 4. Insert 15 Tasks (Mixed statuses, assignees, and dates)
INSERT INTO public.tasks (project_id, title, description, status, assignee_id, due_date) VALUES 
('11111111-1111-1111-1111-111111111111', 'Setup Next.js App Router', 'Initialize Next.js with Tailwind and TypeScript', 'done', '05d2db45-7d72-42df-807f-4c7b0563a997', '2026-06-01'),
('11111111-1111-1111-1111-111111111111', 'Implement Task List UI', 'Create responsive grid for tasks', 'in_progress', '05d2db45-7d72-42df-807f-4c7b0563a997', '2026-06-10'),
('11111111-1111-1111-1111-111111111111', 'Add Optimistic UI', 'Update state before server response', 'todo', NULL, '2026-06-15'),
('11111111-1111-1111-1111-111111111111', 'Fix mobile layout', 'Adjust padding on small screens', 'todo', '05d2db45-7d72-42df-807f-4c7b0563a997', '2026-05-20'), -- Overdue
('22222222-2222-2222-2222-222222222222', 'Design Database Schema', 'Define tables and RLS', 'done', '05d2db45-7d72-42df-807f-4c7b0563a997', '2026-06-02'),
('22222222-2222-2222-2222-222222222222', 'Write RLS Policies', 'Secure all 4 operations', 'done', NULL, '2026-06-03'),
('22222222-2222-2222-2222-222222222222', 'Create Edge Function', 'Fetch overdue tasks', 'in_progress', '05d2db45-7d72-42df-807f-4c7b0563a997', '2026-06-05'),
('22222222-2222-2222-2222-222222222222', 'Test Realtime Subscriptions', 'Verify channel updates', 'todo', '05d2db45-7d72-42df-807f-4c7b0563a997', '2026-05-15'), -- Overdue
('33333333-3333-3333-3333-333333333333', 'Wireframe Dashboard', 'Low fidelity mockups', 'done', '05d2db45-7d72-42df-807f-4c7b0563a997', '2026-05-28'),
('33333333-3333-3333-3333-333333333333', 'Select Color Palette', 'Choose accessible colors', 'done', NULL, '2026-05-29'),
('33333333-3333-3333-3333-333333333333', 'Design Edit Icon Hover', 'Add micro-interactions', 'in_progress', '05d2db45-7d72-42df-807f-4c7b0563a997', '2026-06-12'),
('33333333-3333-3333-3333-333333333333', 'Export SVG assets', 'Prepare icons for dev', 'todo', '05d2db45-7d72-42df-807f-4c7b0563a997', '2026-06-20'),
('44444444-4444-4444-4444-444444444444', 'Call Plumber', 'Fix kitchen sink', 'todo', NULL, '2026-06-10'),
('44444444-4444-4444-4444-444444444444', 'Buy Paint', 'Get 2 gallons of white paint', 'in_progress', '05d2db45-7d72-42df-807f-4c7b0563a997', '2026-06-08'),
('44444444-4444-4444-4444-444444444444', 'Measure windows', 'For new blinds', 'todo', '05d2db45-7d72-42df-807f-4c7b0563a997', '2026-05-18') -- Overdue
ON CONFLICT DO NOTHING;