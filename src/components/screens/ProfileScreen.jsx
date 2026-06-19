import { useState } from 'react'
import { IconLogout } from '../Icons'

export default function ProfileScreen({
  user,
  profile,
  restaurantSettings,
  restaurantId,
  initials,
  logoutUser,
  isUpdating = false,
  handleDisplayNameChange,
}) {
  const [editingDisplayName, setEditingDisplayName] = useState(false)
  const [tempDisplayName, setTempDisplayName] = useState(profile?.ownerName || '')

  const name = profile?.ownerName || user?.displayName || 'User'
  const email = user?.email || ''

  const handleSaveDisplayName = async () => {
    if (tempDisplayName.trim() && handleDisplayNameChange) {
      await handleDisplayNameChange(tempDisplayName.trim())
      setEditingDisplayName(false)
    }
  }

  const handleCancelDisplayName = () => {
    setTempDisplayName(profile?.ownerName || '')
    setEditingDisplayName(false)
  }

  return (
    <div className="p-6 sm:p-8 max-w-xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Profile</p>
      <h2 className="mt-1 mb-6 text-2xl font-bold text-neutral-900">Your Profile</h2>

      {/* Avatar + identity */}
      <div className="card p-6 flex items-center gap-5 mb-5">
        <div className="avatar">{initials(name)}</div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-neutral-900 truncate">{name}</p>
          <p className="text-sm text-neutral-500 truncate">{email}</p>
        </div>
      </div>

      {/* Details */}
      <div className="card p-5 mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#16a34a' }}>Account Details</p>
        <div className="space-y-4">
          {/* Display Name */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2">
            <span className="text-sm font-medium text-neutral-500">Display Name</span>
            {editingDisplayName ? (
              <div className="flex items-center gap-2">
                <input
                  value={tempDisplayName}
                  onChange={(e) => setTempDisplayName(e.target.value)}
                  disabled={isUpdating}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-sm outline-none transition focus:border-green-500"
                  placeholder="Enter display name"
                />
                <button
                  onClick={handleSaveDisplayName}
                  disabled={isUpdating || !tempDisplayName.trim()}
                  className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelDisplayName}
                  disabled={isUpdating}
                  className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setTempDisplayName(profile?.ownerName || '')
                  setEditingDisplayName(true)
                }}
                disabled={isUpdating}
                className="text-sm font-semibold text-neutral-900 hover:text-green-600 transition disabled:opacity-60"
              >
                {name}
              </button>
            )}
          </div>

          {/* Email Address (read-only) */}
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm font-medium text-neutral-500">Email Address</span>
            <span className="text-sm font-semibold text-neutral-900">{email}</span>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={logoutUser}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-6 py-3.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
      >
        <IconLogout /> Sign Out
      </button>
    </div>
  )
}
