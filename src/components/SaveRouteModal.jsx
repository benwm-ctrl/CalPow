import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../services/supabase'
import { useRouteStore } from '../store/routeStore'
import { distanceKm, elevationGainM, maxElevationM } from '../utils/routeStats'
import { Loader2 } from 'lucide-react'

const REGION_OPTIONS = [
  { value: 'sierra', label: 'Sierra' },
  { value: 'shasta', label: 'Shasta' },
  { value: 'bridgeport', label: 'Bridgeport' },
  { value: 'eastern_sierra', label: 'Eastern Sierra (ESAC)' },
]
const DIFFICULTY_OPTIONS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
]
const RISK_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'considerable', label: 'Considerable' },
  { value: 'high', label: 'High' },
  { value: 'extreme', label: 'Extreme' },
]

const inputClass =
  'w-full px-3 py-2 rounded-lg bg-[#0F1923] border border-[#2D3748] text-white placeholder-text-muted focus:outline-none focus:border-[#3B8BEB]'

export default function SaveRouteModal({ isOpen, onClose, onSuccess }) {
  const waypoints = useRouteStore((s) => s.waypoints)
  const clearRoute = useRouteStore((s) => s.clearRoute)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(false)
  const [form, setForm] = useState({
    name: '',
    date_toured: new Date().toISOString().slice(0, 10),
    region: 'sierra',
    location_label: '',
    difficulty_rating: 'intermediate',
    avalanche_risk: 'moderate',
    notes: '',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) {
      setError('Route name is required')
      return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be signed in to save a route.')
        setSaving(false)
        return
      }
      const row = {
        user_id: user.id,
        name: form.name.trim(),
        region: form.region,
        location_label: form.location_label.trim() || null,
        date_toured: form.date_toured || null,
        difficulty_rating: form.difficulty_rating,
        avalanche_risk: form.avalanche_risk,
        notes: form.notes.trim() || null,
        gpx_data: waypoints,
        distance_km: distanceKm(waypoints),
        elevation_gain_m: elevationGainM(waypoints),
        max_elevation_m: maxElevationM(waypoints),
      }
      const { error: insertError } = await supabase.from('routes').insert(row)
      if (insertError) throw insertError
      setToast(true)
      setTimeout(() => {
        setToast(false)
        clearRoute()
        onSuccess?.()
        onClose()
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to save route')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="flex items-center justify-center p-4"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          backgroundColor: 'rgba(15, 25, 35, 0.9)',
        }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg rounded-xl shadow-xl"
          style={{ position: 'relative', backgroundColor: '#1E2D3D', zIndex: 201 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <h2 className="text-xl font-bold text-white">Save Route</h2>
            <p className="mt-1 text-sm text-text-secondary">Add to your touring library</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Route Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className={inputClass}
                  placeholder="e.g. East Bowl Tour"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Date Toured
                </label>
                <input
                  type="date"
                  name="date_toured"
                  value={form.date_toured}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Region
                </label>
                <select
                  name="region"
                  value={form.region}
                  onChange={handleChange}
                  className={inputClass}
                >
                  {REGION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Location Label
                </label>
                <input
                  type="text"
                  name="location_label"
                  value={form.location_label}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="e.g. Mt. Rose Wilderness"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Difficulty
                </label>
                <select
                  name="difficulty_rating"
                  value={form.difficulty_rating}
                  onChange={handleChange}
                  className={inputClass}
                >
                  {DIFFICULTY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Avalanche Risk
                </label>
                <select
                  name="avalanche_risk"
                  value={form.avalanche_risk}
                  onChange={handleChange}
                  className={inputClass}
                >
                  {RISK_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={3}
                  className={inputClass}
                  placeholder="Optional notes..."
                />
              </div>

              {error && (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <motion.button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-border py-2.5 font-medium text-text-primary hover:bg-background-elevated"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 font-medium text-white disabled:opacity-70"
                  style={{ backgroundColor: '#3B8BEB' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Route'
                  )}
                </motion.button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 font-medium text-white shadow-lg"
          style={{ backgroundColor: '#38A169', zIndex: 102 }}
        >
          Route saved!
        </div>
      )}
    </>
  )
}
