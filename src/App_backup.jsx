import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, useParams } from 'react-router-dom'
import { auth, signInWithGoogle, logoutUser } from './lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import QRCode from 'qrcode'
import { cloneTemplate, findTemplateById, menuTemplates } from './data/menuTemplates'
import { saveMenuRecord, getMenuRecord } from './lib/menuStorage'

const createId = (prefix = 'id') =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`

const createEmptyItem = () => ({
  id: createId('item'),
  name: '',
  description: '',
  price: '',
})

const createEmptySection = () => ({
  id: createId('section'),
  title: 'New Section',
  items: [createEmptyItem()],
})

function TemplateMenuPreview({ menu }) {
  if (!menu) {
    return null
  }

  if (menu.templateId === 'chef-signature') {
    return (
      <div className="rounded-2xl border border-neutral-300 bg-neutral-100/70 p-5 sm:p-7">
        <div className="border-b border-neutral-300 pb-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-600">
            Chef Signature Layout
          </p>
          <h4 className="mt-2 text-2xl font-semibold text-neutral-900">{menu.menuTitle}</h4>
          <p className="text-sm text-neutral-600">{menu.restaurantName || 'Untitled Restaurant'}</p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {menu.sections.map((section) => (
            <section key={section.id} className="rounded-xl border border-neutral-300 bg-white p-4">
              <h5 className="text-lg font-semibold text-neutral-900">{section.title}</h5>
              <div className="mt-3 space-y-3">
                {section.items.map((item) => (
                  <div key={item.id} className="border-b border-neutral-200 pb-2 last:border-none last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-neutral-900">{item.name || 'Untitled Item'}</p>
                      <p className="font-mono text-sm text-neutral-800">{item.price || '-'}</p>
                    </div>
                    <p className="text-sm text-neutral-600">{item.description || 'No description'}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    )
  }

  if (menu.templateId === 'quick-bites') {
    return (
      <div className="rounded-2xl border border-neutral-300 bg-white p-5 sm:p-7">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-600">Quick Bites Layout</p>
        <h4 className="mt-2 text-2xl font-semibold text-neutral-900">{menu.menuTitle}</h4>
        <p className="text-sm text-neutral-600">{menu.restaurantName || 'Untitled Restaurant'}</p>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {menu.sections.map((section) => (
            <section key={section.id} className="rounded-xl border border-neutral-300 bg-neutral-50 p-4">
              <h5 className="text-base font-semibold text-neutral-900">{section.title}</h5>
              <div className="mt-3 space-y-2">
                {section.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-neutral-200 bg-white p-2">
                    <p className="font-medium text-neutral-900">{item.name || 'Untitled Item'}</p>
                    <p className="text-xs text-neutral-600">{item.description || 'No description'}</p>
                    <p className="mt-1 font-mono text-xs text-neutral-800">{item.price || '-'}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-neutral-300 bg-white p-5 sm:p-7">
      <div className="border-b border-dashed border-neutral-300 pb-4 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-600">Minimal Cafe Layout</p>
        <h4 className="mt-2 text-2xl font-semibold text-neutral-900">{menu.menuTitle}</h4>
        <p className="text-sm text-neutral-600">{menu.restaurantName || 'Untitled Restaurant'}</p>
      </div>

      <div className="mt-5 space-y-5">
        {menu.sections.map((section) => (
          <section key={section.id}>
            <h5 className="border-b border-neutral-300 pb-2 text-lg font-semibold text-neutral-900">
              {section.title}
            </h5>
            <div className="mt-3 space-y-3">
              {section.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-neutral-900">{item.name || 'Untitled Item'}</p>
                    <p className="text-neutral-600">{item.description || 'No description'}</p>
                  </div>
                  <p className="font-mono text-neutral-800">{item.price || '-'}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function Editor() {
  const [user, setUser] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [draftMenu, setDraftMenu] = useState(null)
  const [savedMenus, setSavedMenus] = useState([])
  const [saveStatus, setSaveStatus] = useState('Choose a template to begin.')
  const [isSaving, setIsSaving] = useState(false)
  const [qrPreview, setQrPreview] = useState(null)
  const [menuPreview, setMenuPreview] = useState(null)

  useEffect(() => {
    if (auth) {
      return onAuthStateChanged(auth, setUser);
    }
  }, [])

  const selectedTemplate = useMemo(
    () => findTemplateById(selectedTemplateId),
    [selectedTemplateId],
  )

  const draftItemCount = useMemo(() => {
    if (!draftMenu) {
      return 0
    }

    return draftMenu.sections.reduce((count, section) => count + section.items.length, 0)
  }, [draftMenu])

  const loadTemplate = (templateId) => {
    const template = findTemplateById(templateId)

    if (!template) {
      return
    }

    const clonedTemplate = cloneTemplate(template)

    setSelectedTemplateId(templateId)
    setDraftMenu({
      id: createId('draft'),
      templateId: clonedTemplate.id,
      templateLabel: clonedTemplate.label,
      restaurantName: clonedTemplate.restaurantName,
      menuTitle: clonedTemplate.menuTitle,
      notes: '',
      sections: clonedTemplate.sections,
      updatedAt: new Date().toISOString(),
    })
    setSaveStatus('Template loaded. Build your menu and save it to My Menu.')
  }

  const updateDraft = (updater) => {
    setDraftMenu((currentDraft) => {
      if (!currentDraft) {
        return currentDraft
      }

      const updatedDraft = updater(currentDraft)

      return {
        ...updatedDraft,
        updatedAt: new Date().toISOString(),
      }
    })
  }

  const updateSectionList = (updater) => {
    updateDraft((currentDraft) => ({
      ...currentDraft,
      sections: updater(currentDraft.sections),
    }))
  }

  const updateSectionField = (sectionId, title) => {
    updateSectionList((sections) =>
      sections.map((section) =>
        section.id === sectionId ? { ...section, title } : section,
      ),
    )
  }

  const removeSection = (sectionId) => {
    updateSectionList((sections) => {
      if (sections.length <= 1) {
        return sections
      }

      return sections.filter((section) => section.id !== sectionId)
    })
  }

  const addSection = () => {
    updateSectionList((sections) => [...sections, createEmptySection()])
  }

  const addItem = (sectionId) => {
    updateSectionList((sections) =>
      sections.map((section) =>
        section.id === sectionId
          ? { ...section, items: [...section.items, createEmptyItem()] }
          : section,
      ),
    )
  }

  const removeItem = (sectionId, itemId) => {
    updateSectionList((sections) =>
      sections.map((section) => {
        if (section.id !== sectionId) {
          return section
        }

        if (section.items.length <= 1) {
          return section
        }

        return {
          ...section,
          items: section.items.filter((item) => item.id !== itemId),
        }
      }),
    )
  }

  const updateItemField = (sectionId, itemId, fieldName, value) => {
    updateSectionList((sections) =>
      sections.map((section) => {
        if (section.id !== sectionId) {
          return section
        }

        return {
          ...section,
          items: section.items.map((item) =>
            item.id === itemId ? { ...item, [fieldName]: value } : item,
          ),
        }
      }),
    )
  }

  const saveMenu = async () => {
    if (!draftMenu) {
      setSaveStatus('Pick a template first.')
      return
    }

    if (!draftMenu.menuTitle.trim()) {
      setSaveStatus('Add a menu title before saving.')
      return
    }

    setIsSaving(true)

    const payload = {
      templateId: draftMenu.templateId,
      templateLabel: draftMenu.templateLabel,
      restaurantName: draftMenu.restaurantName.trim(),
      menuTitle: draftMenu.menuTitle.trim(),
      notes: draftMenu.notes.trim(),
      sections: draftMenu.sections,
      updatedAt: new Date().toISOString(),
    }

    let qrDataUrl = ''

    let remoteSaved = false
    let remoteId = null

    try {
      const remoteResult = await saveMenuRecord(payload);
      remoteSaved = remoteResult.remoteSaved;
      remoteId = remoteResult.remoteId;
    } catch {
      remoteSaved = false;
    }
    
    const targetUrl = remoteId ? `${window.location.origin}/menu/${remoteId}` : `${window.location.origin}/menu/${createId('local')}`;

    try {
      qrDataUrl = await QRCode.toDataURL(targetUrl, {
        width: 320,
        margin: 1,
        color: {
          dark: '#101010',
          light: '#ffffff',
        },
      })
    } catch {
      setSaveStatus('QR code generation failed, but you can still continue editing.')
      setIsSaving(false)
      return
    }

    setSavedMenus((currentMenus) => [
      {
        localId: createId('menu'),
        ...payload,
        qrDataUrl,
        remoteSaved,
        remoteId,
        savedAt: new Date().toISOString(),
      },
      ...currentMenus,
    ])

    setSaveStatus(
      remoteSaved
        ? 'Menu saved locally and synced to Firestore.'
        : 'Menu saved in My Menu. Add Firebase env values to sync with Firestore.',
    )
    setIsSaving(false)
  }

  const openQrPreview = (menu) => {
    setMenuPreview(null)
    setQrPreview({
      menuTitle: menu.menuTitle,
      restaurantName: menu.restaurantName,
      qrDataUrl: menu.qrDataUrl,
    })
  }

  const closeQrPreview = () => {
    setQrPreview(null)
  }

  const openMenuPreview = (menu) => {
    setQrPreview(null)
    setMenuPreview(menu)
  }

  const closeMenuPreview = () => {
    setMenuPreview(null)
  }

  useEffect(() => {
    if (!qrPreview && !menuPreview) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeQrPreview()
        closeMenuPreview()
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [qrPreview, menuPreview])

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="relative overflow-hidden rounded-3xl border border-neutral-300 bg-white/85 p-6 backdrop-blur-sm sm:p-8">
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-neutral-300"
            aria-hidden="true"
          />
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
            Restaurant Menu Studio
          </p>
          <div className="flex items-start justify-between">
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              Build your menu, then publish with QR
            </h1>
            <div>
              {user ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{user.displayName}</span>
                  <button onClick={logoutUser} className="rounded-lg bg-neutral-900 px-[0.875rem] py-2 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2">
                    Log out
                  </button>
                </div>
              ) : (
                <button onClick={signInWithGoogle} className="rounded-lg bg-neutral-900 px-[0.875rem] py-2 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2">
                  Sign in with Google
                </button>
              )}
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-base">
            Select a menu layout, customize each item, and save it into your My Menu
            collection. Firestore integration is already prepared and will start syncing
            when Firebase env variables are configured.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-3">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-neutral-500">
                Templates
              </p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{menuTemplates.length}</p>
            </div>
            <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-3">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-neutral-500">
                Sections
              </p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">
                {draftMenu ? draftMenu.sections.length : 0}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-3">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-neutral-500">
                Items
              </p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{draftItemCount}</p>
            </div>
            <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-3">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-neutral-500">
                Saved Menus
              </p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{savedMenus.length}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-neutral-300 bg-white p-5 sm:p-6">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
              Menu Templates
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {menuTemplates.map((template) => {
                const isActive = template.id === selectedTemplateId

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => loadTemplate(template.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      isActive
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-300 bg-white text-neutral-900 hover:border-neutral-500'
                    }`}
                  >
                    <p className="text-base font-semibold">{template.label}</p>
                    <p
                      className={`mt-1 text-sm leading-relaxed ${
                        isActive ? 'text-neutral-200' : 'text-neutral-600'
                      }`}
                    >
                      {template.description}
                    </p>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
              <p className="font-medium text-neutral-900">Build flow</p>
              <p className="mt-2">1. Choose template</p>
              <p>2. Edit sections and items</p>
              <p>3. Save and view in My Menu</p>
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-300 bg-white p-4 text-sm text-neutral-600">
              <p className="font-medium text-neutral-900">Status</p>
              <p className="mt-2">{saveStatus}</p>
            </div>
          </aside>

          <div className="rounded-3xl border border-neutral-300 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Menu Builder
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-neutral-900">
                  {selectedTemplate ? selectedTemplate.label : 'Select a template'}
                </h2>
              </div>
              <button
                type="button"
                onClick={saveMenu}
                disabled={!draftMenu || isSaving}
                className="rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:border-neutral-400 disabled:bg-neutral-300"
              >
                {isSaving ? 'Saving...' : 'Save Menu'}
              </button>
            </div>

            {!draftMenu && (
              <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-neutral-600">
                Pick a template from the left panel to start building your menu.
              </div>
            )}

            {draftMenu && (
              <div className="mt-6 flex flex-col gap-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-neutral-600">
                    <span className="mb-2 block font-medium text-neutral-900">Restaurant Name</span>
                    <input
                      value={draftMenu.restaurantName}
                      onChange={(event) =>
                        updateDraft((currentDraft) => ({
                          ...currentDraft,
                          restaurantName: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none transition focus:border-neutral-900"
                      placeholder="Name of restaurant"
                    />
                  </label>
                  <label className="text-sm text-neutral-600">
                    <span className="mb-2 block font-medium text-neutral-900">Menu Title</span>
                    <input
                      value={draftMenu.menuTitle}
                      onChange={(event) =>
                        updateDraft((currentDraft) => ({
                          ...currentDraft,
                          menuTitle: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none transition focus:border-neutral-900"
                      placeholder="Dinner Menu"
                    />
                  </label>
                </div>

                <label className="text-sm text-neutral-600">
                  <span className="mb-2 block font-medium text-neutral-900">Menu Notes</span>
                  <textarea
                    value={draftMenu.notes}
                    onChange={(event) =>
                      updateDraft((currentDraft) => ({
                        ...currentDraft,
                        notes: event.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none transition focus:border-neutral-900"
                    placeholder="Optional details, timings, or highlights"
                  />
                </label>

                <div className="flex items-center justify-between">
                  <p className="font-medium text-neutral-900">Sections and Items</p>
                  <button
                    type="button"
                    onClick={addSection}
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900 transition hover:border-neutral-900"
                  >
                    Add Section
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  {draftMenu.sections.map((section) => (
                    <article key={section.id} className="rounded-2xl border border-neutral-300 p-4">
                      <div className="mb-4 flex items-center gap-3">
                        <input
                          value={section.title}
                          onChange={(event) => updateSectionField(section.id, event.target.value)}
                          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-base font-medium outline-none transition focus:border-neutral-900"
                        />
                        <button
                          type="button"
                          onClick={() => removeSection(section.id)}
                          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-700 transition hover:border-neutral-900"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="flex flex-col gap-3">
                        {section.items.map((item) => (
                          <div
                            key={item.id}
                            className="grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 lg:grid-cols-[1.2fr_1.8fr_0.6fr_auto]"
                          >
                            <input
                              value={item.name}
                              onChange={(event) =>
                                updateItemField(
                                  section.id,
                                  item.id,
                                  'name',
                                  event.target.value,
                                )
                              }
                              placeholder="Item name"
                              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-900"
                            />
                            <input
                              value={item.description}
                              onChange={(event) =>
                                updateItemField(
                                  section.id,
                                  item.id,
                                  'description',
                                  event.target.value,
                                )
                              }
                              placeholder="Description"
                              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-900"
                            />
                            <input
                              value={item.price}
                              onChange={(event) =>
                                updateItemField(
                                  section.id,
                                  item.id,
                                  'price',
                                  event.target.value,
                                )
                              }
                              placeholder="$0.00"
                              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-900"
                            />
                            <button
                              type="button"
                              onClick={() => removeItem(section.id, item.id)}
                              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 transition hover:border-neutral-900"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => addItem(section.id)}
                        className="mt-3 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 transition hover:border-neutral-900"
                      >
                        Add Item
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-neutral-300 bg-white p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
                My Menu
              </p>
              <h3 className="mt-1 text-2xl font-semibold text-neutral-900">Saved menus</h3>
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
              {savedMenus.length} records
            </p>
          </div>

          {savedMenus.length === 0 && (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-neutral-600">
              No saved menus yet. Build one and click Save Menu.
            </div>
          )}

          {savedMenus.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {savedMenus.map((menu) => (
                <article key={menu.localId} className="rounded-2xl border border-neutral-300 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-neutral-900">{menu.menuTitle}</p>
                      <p className="text-sm text-neutral-600">{menu.restaurantName || 'Untitled Restaurant'}</p>
                      <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-neutral-500">
                        {menu.templateLabel}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-medium ${
                        menu.remoteSaved
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-300 bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {menu.remoteSaved ? 'Firestore Synced' : 'Local Only'}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
                    <button
                      type="button"
                      onClick={() => openQrPreview(menu)}
                      className="group w-fit rounded-lg"
                    >
                      <img
                        src={menu.qrDataUrl}
                        alt={`${menu.menuTitle} QR code`}
                        className="h-32 w-32 rounded-lg border border-neutral-300 bg-white p-1 transition group-hover:scale-[1.02]"
                      />
                      <span className="mt-2 block text-xs text-neutral-500">Click to enlarge</span>
                    </button>

                    <div className="space-y-2 text-sm text-neutral-700">
                      {menu.sections.map((section) => (
                        <div key={section.id}>
                          <p className="font-medium text-neutral-900">{section.title}</p>
                          <p className="text-neutral-600">{section.items.length} item(s)</p>
                        </div>
                      ))}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openMenuPreview(menu)}
                          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:border-neutral-900"
                        >
                          Preview Template
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {qrPreview && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={closeQrPreview}
            role="dialog"
            aria-modal="true"
            aria-label="QR preview dialog"
          >
            <div
              className="relative w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeQrPreview}
                className="absolute right-3 top-3 rounded-lg border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
              >
                Close
              </button>
              <p className="pr-14 text-lg font-semibold text-neutral-900">{qrPreview.menuTitle}</p>
              <p className="text-sm text-neutral-600">
                {qrPreview.restaurantName || 'Untitled Restaurant'}
              </p>

              <div className="mt-5 flex justify-center rounded-xl border border-neutral-300 bg-neutral-50 p-4">
                <img
                  src={qrPreview.qrDataUrl}
                  alt={`${qrPreview.menuTitle} enlarged QR code`}
                  className="h-[min(70vw,26rem)] w-[min(70vw,26rem)] rounded-lg border border-neutral-300 bg-white p-2"
                />
              </div>
            </div>
          </div>
        )}

        {menuPreview && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4"
            onClick={closeMenuPreview}
            role="dialog"
            aria-modal="true"
            aria-label="Menu template preview dialog"
          >
            <div className="mx-auto flex min-h-full w-full max-w-4xl items-center">
              <div
                className="relative w-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl sm:p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={closeMenuPreview}
                  className="absolute right-3 top-3 rounded-lg border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
                >
                  Close
                </button>

                <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Template Preview
                </p>
                <p className="mt-1 pr-14 text-sm text-neutral-600">{menuPreview.templateLabel}</p>

                <div className="mt-4">
                  <TemplateMenuPreview menu={menuPreview} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}



function MenuViewer() {
  const { id } = useParams();
  const [menuData, setMenuData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (id) {
        const data = await getMenuRecord(id);
        setMenuData(data);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return <div className="p-10 text-center text-neutral-600">Loading menu...</div>;
  }

  if (!menuData) {
    return <div className="p-10 text-center text-red-600">Menu not found or could not be loaded.</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-100 py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <TemplateMenuPreview menu={menuData} />
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Editor />} />
      <Route path="/menu/:id" element={<MenuViewer />} />
    </Routes>
  );
}

export default App;
