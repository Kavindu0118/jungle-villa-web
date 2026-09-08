import { IconPlus, IconMenu, IconEdit, IconEye, IconQr } from '../Icons'

export default function DashboardScreen({
  profile,
  restaurantSettings,
  savedMenus,
  draftMenu,
  draftItemCount,
  openNewMenuBuilder,
  setActiveSection,
  loadMenuForEditing,
  openMenuPreview,
  openQrPreview
}) {
  return (
    <div className="p-6 sm:p-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl p-7" style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 60%, #166534 100%)' }}>
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-36 w-36 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <p className="font-mono text-xs uppercase tracking-widest text-green-200">Smart POS Dashboard</p>
        <h1 className="mt-3 text-3xl font-bold text-white">
          {restaurantSettings?.name ? `Welcome back, ${restaurantSettings.name}!` : 'Welcome to Smart POS Dashboard'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-green-100 max-w-xl">
          Manage your orders, point of sale, inventory, and menus all in one centralized smart dashboard.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={openNewMenuBuilder}
            className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold transition hover:bg-green-50"
            style={{ color: '#16a34a' }}
          >
            <IconPlus /> Build QR Menu
          </button>
          {savedMenus.length > 0 && (
            <button
              onClick={() => setActiveSection('my-menu')}
              className="flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <IconMenu /> View My Menu
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Saved Menus', value: savedMenus.length, color: '#0ea5e9' },
          { 
            label: 'Sections', 
            value: draftMenu 
              ? draftMenu.sections.filter((s) => !/discount/i.test(s?.title || s?.name || '')).length 
              : (savedMenus[0]?.sections?.filter((s) => !/discount/i.test(s?.title || s?.name || '')).length || 0), 
            color: '#f59e0b' 
          },
          { 
            label: 'Items', 
            value: draftItemCount || (savedMenus[0]?.sections?.filter((s) => !/discount/i.test(s?.title || s?.name || '')).reduce((c, s) => {
              if (s.subcategories && s.subcategories.length > 0) {
                return c + s.subcategories.filter((sub) => !/discount/i.test(sub?.title || sub?.name || '')).reduce((subCount, sub) => subCount + (sub.items?.length || 0), 0)
              }
              return c + (s.items?.length || 0)
            }, 0) || 0), 
            color: '#8b5cf6' 
          },
        ].map((stat) => (
          <div key={stat.label} className="stat-card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick-access saved menu */}
      {savedMenus.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-neutral-500">Your Active Menu</p>
          <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-4">
              {savedMenus[0].qrDataUrl && (
                <img src={savedMenus[0].qrDataUrl} alt="QR" className="h-16 w-16 rounded-lg border border-neutral-200 bg-white p-1" />
              )}
              <div>
                <p className="text-lg font-semibold text-neutral-900">{savedMenus[0].menuTitle}</p>
                <p className="text-sm text-neutral-500">{savedMenus[0].restaurantName}</p>
                <span className={savedMenus[0].remoteSaved ? 'badge-green' : 'badge-gray'} style={{ marginTop: '4px', display: 'inline-block' }}>
                  {savedMenus[0].remoteSaved ? 'Published' : 'Local'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => loadMenuForEditing(savedMenus[0])} className="btn-ghost flex items-center gap-1.5 text-xs">
                <IconEdit /> Edit
              </button>
              <button onClick={() => openMenuPreview(savedMenus[0])} className="btn-ghost flex items-center gap-1.5 text-xs">
                <IconEye /> Preview
              </button>
              <button onClick={() => openQrPreview(savedMenus[0])} className="btn-ghost flex items-center gap-1.5 text-xs">
                <IconQr /> QR Code
              </button>
            </div>
          </div>
        </div>
      )}

      {savedMenus.length === 0 && (
        <div className="mt-6 rounded-2xl border-2 border-dashed p-10 text-center" style={{ borderColor: '#bbf7d0' }}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: '#dcfce7' }}>
            <IconQr />
          </div>
          <p className="text-lg font-semibold text-neutral-800">No menu yet</p>
          <p className="mt-1 text-sm text-neutral-500">Create your first QR menu to get started</p>
          <button onClick={openNewMenuBuilder} className="btn-green mt-5 flex items-center gap-2 mx-auto">
            <IconPlus /> Create Menu
          </button>
        </div>
      )}
    </div>
  )
}
