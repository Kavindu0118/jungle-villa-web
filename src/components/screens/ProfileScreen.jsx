import { useState, useEffect } from 'react'
import { IconLogout } from '../Icons'
import { getOrCreateSubscription, subscribeToSubscription } from '../../lib/menuStorage'

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
  const [subscription, setSubscription] = useState(null)
  const [isSubLoading, setIsSubLoading] = useState(true)

  const name = profile?.ownerName || user?.displayName || 'User'
  const email = user?.email || ''

  // Load / ensure subscription document exists in Firestore
  useEffect(() => {
    let unsubscribe = () => {}
    async function initSubscription() {
      if (restaurantId) {
        setIsSubLoading(true)
        await getOrCreateSubscription(restaurantId, user?.uid)
        unsubscribe = subscribeToSubscription(restaurantId, (data) => {
          setSubscription(data)
          setIsSubLoading(false)
        })
      } else {
        setIsSubLoading(false)
      }
    }
    initSubscription()
    return () => unsubscribe()
  }, [restaurantId, user?.uid])

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

  const formatDate = (val) => {
    if (!val) return '—'
    if (typeof val === 'object' && val.toDate) {
      try {
        return val.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      } catch {
        return '—'
      }
    }
    if (typeof val === 'string') {
      const d = new Date(val)
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      }
      return val
    }
    return '—'
  }

  const getStatusBadge = (status) => {
    const s = (status || 'Inactive').toLowerCase()
    if (s === 'active') {
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">● Active</span>
    }
    if (s === 'trial') {
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">● Free Trial</span>
    }
    if (s === 'pending') {
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">● Pending</span>
    }
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">● Inactive</span>
  }

  return (
    <div className="p-6 sm:p-8 max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Profile</p>
      <h2 className="mt-1 mb-6 text-2xl font-bold text-neutral-900">Your Profile & Subscription</h2>

      {/* Avatar + identity */}
      <div className="card p-6 flex items-center gap-5 mb-5">
        <div className="avatar">{initials(name)}</div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-neutral-900 truncate">{name}</p>
          <p className="text-sm text-neutral-500 truncate">{email}</p>
        </div>
      </div>

      {/* Account Details */}
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

      {/* Subscription Details (Read-only) */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#16a34a' }}>Subscription Details</p>
          {isSubLoading ? (
            <span className="text-xs text-neutral-400">Loading...</span>
          ) : (
            getStatusBadge(subscription?.status)
          )}
        </div>

        <div className="space-y-3">
          {/* Subscription Type */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2">
            <span className="text-sm font-medium text-neutral-500">Subscription Type</span>
            <span className="text-sm font-semibold text-neutral-900">
              {subscription?.subscriptionType || '—'}
            </span>
          </div>

          {/* Monthly Charge */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2">
            <span className="text-sm font-medium text-neutral-500">Monthly Charge</span>
            <span className="text-sm font-semibold text-neutral-900">
              {subscription?.monthlyCharge ? `${subscription.monthlyCharge}` : '—'}
            </span>
          </div>

          {/* Current Status */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2">
            <span className="text-sm font-medium text-neutral-500">Current Status</span>
            <span className="text-sm font-semibold text-neutral-900 capitalize">
              {subscription?.status || 'Inactive'}
            </span>
          </div>

          {/* Subscribed Date */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2">
            <span className="text-sm font-medium text-neutral-500">Subscribed Date</span>
            <span className="text-sm font-semibold text-neutral-900">
              {formatDate(subscription?.subscribedDate)}
            </span>
          </div>

          {/* Next Renewal Date */}
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm font-medium text-neutral-500">Next Renewal Date</span>
            <span className="text-sm font-semibold text-neutral-900">
              {formatDate(subscription?.nextRenewalDate)}
            </span>
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
