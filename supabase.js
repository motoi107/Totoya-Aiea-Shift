import { createClient } from '@supabase/supabase-js'

// Reads from .env file: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ─── AVAILABILITY ─────────────────────────────────────────────────────────────
export async function fetchAvailability(week) {
  const q = supabase.from('availability').select('*').order('submitted_at', { ascending: false })
  if (week) q.eq('week', week)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map(row => ({
    id: row.id,
    name: row.staff_name,
    week: row.week,
    selected: row.selected_slots,
    requests: row.requests,
    submittedAt: row.submitted_at,
  }))
}

export async function upsertAvailability({ name, week, selected, requests }) {
  const { data, error } = await supabase
    .from('availability')
    .upsert(
      { staff_name: name, week, selected_slots: selected, requests, submitted_at: new Date().toISOString() },
      { onConflict: 'staff_name,week' }
    )
    .select()
  if (error) throw error
  return data
}

// ─── SCHEDULES ────────────────────────────────────────────────────────────────
export async function fetchSchedules() {
  const { data, error } = await supabase
    .from('schedules').select('*').order('published_at', { ascending: false })
  if (error) throw error
  return (data || []).map(row => ({
    id: row.id, week: row.week, shifts: row.shifts, publishedAt: row.published_at,
  }))
}

export async function upsertSchedule({ week, shifts }) {
  const { data, error } = await supabase
    .from('schedules')
    .upsert({ week, shifts, published_at: new Date().toISOString() }, { onConflict: 'week' })
    .select()
  if (error) throw error
  return data
}

// ─── STAFF SKILLS ─────────────────────────────────────────────────────────────
export async function fetchStaffSkills() {
  const { data, error } = await supabase.from('staff_skills').select('*').order('name')
  if (error) throw error
  const skills = {}, rules = {}
  ;(data || []).forEach(row => {
    skills[row.name] = {
      plater: row.plater, miso: row.miso, host: row.host,
      supporter: row.supporter, prep: row.prep, energy: row.energy, leadership: row.leadership,
    }
    rules[row.name] = {
      min: row.min_shifts, max: row.max_shifts,
      consecutive: row.consecutive, avoid: row.avoid,
    }
  })
  return { skills, rules }
}

export async function upsertStaffSkill({ name, skills, rule }) {
  const { error } = await supabase.from('staff_skills').upsert(
    {
      name,
      plater: skills.plater, miso: skills.miso, host: skills.host,
      supporter: skills.supporter, prep: skills.prep, energy: skills.energy,
      leadership: skills.leadership,
      min_shifts: rule.min, max_shifts: rule.max,
      consecutive: rule.consecutive, avoid: rule.avoid || null,
    },
    { onConflict: 'name' }
  )
  if (error) throw error
}

export async function deleteStaffSkill(name) {
  const { error } = await supabase.from('staff_skills').delete().eq('name', name)
  if (error) throw error
}

// ─── REALTIME ─────────────────────────────────────────────────────────────────
export function subscribeAvailability(week, callback) {
  return supabase.channel(`avail_${week||'all'}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'availability' }, callback)
    .subscribe()
}

export function subscribeSchedules(callback) {
  return supabase.channel('schedules_rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, callback)
    .subscribe()
}
