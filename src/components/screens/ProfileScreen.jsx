import { IconStore, IconLogout } from '../Icons'

export default function ProfileScreen({
  user,
  profile,
  restaurantSettings,
  restaurantId,
  initials,
  logoutUser
}) {
  const name = user?.displayName || profile?.ownerName || 'User'
  const email = user?.email || ''
  const restaurantName = profile?.restaurantName || restaurantSettings?.name || ''

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
          {restaurantName && (
            <span className="badge-green mt-2 inline-flex items-center gap-1">
              <IconStore /> {restaurantName}
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="card p-5 mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#16a34a' }}>Account Details</p>
        <div className="space-y-3">
          {[
            { label: 'Display Name', value: name },
            { label: 'Email Address', value: email },
            { label: 'Restaurant', value: restaurantName || '—' },
            { label: 'Restaurant ID', value: restaurantId ? `${restaurantId.slice(0, 12)}…` : '—' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2 last:border-none">
              <span className="text-sm font-medium text-neutral-500">{row.label}</span>
              <span className="text-sm font-semibold text-neutral-900 text-right">{row.value}</span>
            </div>
          ))}
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
