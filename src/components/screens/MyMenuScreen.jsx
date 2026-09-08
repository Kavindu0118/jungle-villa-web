import { IconPlus, IconEdit, IconEye, IconTrash } from '../Icons'

export default function MyMenuScreen({
  savedMenus,
  openNewMenuBuilder,
  openQrPreview,
  loadMenuForEditing,
  openMenuPreview,
  deleteConfirmId,
  setDeleteConfirmId,
  handleDeleteMenu,
  isDeletingMenu
}) {
  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">My Menu</p>
          <h2 className="mt-1 text-2xl font-bold text-neutral-900">Saved Menus</h2>
        </div>
        <button onClick={openNewMenuBuilder} className="btn-green flex items-center gap-2">
          <IconPlus /> Create New Menu
        </button>
      </div>

      {savedMenus.length === 0 ? (
        <div
          className="card card-interactive flex flex-col items-center justify-center p-14 text-center cursor-pointer"
          onClick={openNewMenuBuilder}
          style={{ border: '2px dashed #bbf7d0' }}
        >
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl" style={{ background: '#dcfce7' }}>
            <span style={{ fontSize: '2.5rem' }}>📋</span>
          </div>
          <p className="text-lg font-semibold text-neutral-800">Create your first menu</p>
          <p className="mt-2 text-sm text-neutral-500">Choose a template, add your items, and publish with a QR code.</p>
          <div className="btn-green mt-6 flex items-center gap-2">
            <IconPlus /> Create New Menu
          </div>
        </div>
      ) : (
        <div className="menu-grid">
          {savedMenus.map((menu) => (
            <article key={menu.localId} className="card flex flex-col p-5 gap-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-neutral-900">{menu.menuTitle}</p>
                  <p className="mt-0.5 truncate text-sm text-neutral-500">{menu.restaurantName || 'Untitled Restaurant'}</p>
                  <span className={menu.remoteSaved ? 'badge-green' : 'badge-gray'} style={{ marginTop: '6px', display: 'inline-block' }}>
                    {menu.remoteSaved ? 'Firestore Synced' : 'Local Only'}
                  </span>
                </div>
                {menu.qrDataUrl && (
                  <button
                    onClick={() => openQrPreview(menu)}
                    className="flex-shrink-0 rounded-xl border border-neutral-200 bg-white p-1.5 transition hover:border-green-400"
                    title="View QR Code"
                  >
                    <img src={menu.qrDataUrl} alt="QR" className="h-16 w-16" />
                  </button>
                )}
              </div>

              {/* Sections summary */}
              <div className="flex-1 space-y-1.5">
                {(() => {
                  const visibleSections = (menu.sections || []).filter(
                    (s) => !/discount/i.test(s?.title || s?.name || '')
                  )
                  return (
                    <>
                      {visibleSections.slice(0, 3).map((section) => {
                        const itemCount = section.subcategories && section.subcategories.length > 0
                          ? section.subcategories.reduce((c, sub) => c + (sub.items?.length || 0), 0)
                          : (section.items?.length || 0)
                        return (
                          <div key={section.id} className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm" style={{ background: '#f0fdf4' }}>
                            <span className="font-medium text-neutral-800">{section.title}</span>
                            <span className="text-xs text-neutral-500">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                          </div>
                        )
                      })}
                      {visibleSections.length > 3 && (
                        <p className="text-xs text-neutral-400 pl-1">+{visibleSections.length - 3} more sections</p>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Template label */}
              <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">{menu.templateLabel}</p>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                <button
                  onClick={() => loadMenuForEditing(menu)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-green-500 hover:text-green-700"
                  style={{ borderColor: '#e5e7eb' }}
                >
                  <IconEdit /> Edit Menu
                </button>
                <button
                  onClick={() => openMenuPreview(menu)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-blue-400 hover:text-blue-700"
                  style={{ borderColor: '#e5e7eb' }}
                >
                  <IconEye /> Preview
                </button>
                <button
                  onClick={() => setDeleteConfirmId(menu.localId)}
                  className="flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50"
                  style={{ borderColor: '#fecaca' }}
                  title="Delete Menu"
                >
                  <IconTrash />
                </button>
              </div>

              {/* Delete confirmation inline */}
              {deleteConfirmId === menu.localId && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                  <p className="text-sm font-semibold text-red-800">Delete this menu?</p>
                  <p className="mt-1 text-xs text-red-600">This action cannot be undone.</p>
                  <div className="mt-3 flex gap-2 justify-center">
                    <button
                      onClick={() => handleDeleteMenu(menu)}
                      disabled={isDeletingMenu}
                      className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      {isDeletingMenu ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      disabled={isDeletingMenu}
                      className="rounded-lg border border-neutral-300 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
