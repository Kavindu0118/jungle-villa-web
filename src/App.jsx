import LoginModal from "./LoginModal";
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Routes, Route, useParams } from 'react-router-dom'
import { auth, signInWithGoogle, logoutUser } from './lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'
import { cloneTemplate, findTemplateById, menuTemplates } from './data/menuTemplates'
import DashboardScreen from './components/screens/DashboardScreen'
import MyMenuScreen from './components/screens/MyMenuScreen'
import SettingsScreen from './components/screens/SettingsScreen'
import ProfileScreen from './components/screens/ProfileScreen'
import {
  IconDashboard, IconMenu, IconSettings, IconProfile, IconQr, IconPlus, IconEdit, IconTrash, IconEye, IconLogout, IconX
} from './components/Icons'
import {
  saveMenuRecord,
  getMenuRecord,
  getRestaurantMenu,
  getRestaurantSettings,
  saveRestaurantSettings,
  saveUserProfile,
  createRestaurantOrder,
  subscribeToRestaurantOrder,
  cancelRestaurantOrder,
  deleteMenuRecord,
} from './lib/menuStorage'

import { uploadMenuItemImage, isSupabaseConfigured } from './lib/supabase'

const createId = (prefix = 'id') =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`

const getDeviceId = () => {
  if (typeof window === 'undefined') return createId('device')
  const storageKey = 'qr-device-id'
  const existing = window.localStorage.getItem(storageKey)
  if (existing) return existing
  const next = createId('device')
  window.localStorage.setItem(storageKey, next)
  return next
}

const createEmptyItem = () => ({
  id: createId('item'),
  name: '',
  description: '',
  price: '',
  imageUrl: '',
})

const createEmptySection = () => ({
  id: createId('section'),
  title: 'New Section',
  items: [createEmptyItem()],
})

// Icons moved to components/Icons.jsx

// ─── TemplateMenuPreview ──────────────────────────────────────────────────────
function TemplateMenuPreview({ menu, currencySymbol = '$', orderingEnabled = false, onAddToCart }) {
  if (!menu) return null
  const canOrder = orderingEnabled && typeof onAddToCart === 'function'

  const formatPrice = (price) => {
    if (!price) return '-'
    const cleanPrice = String(price).replace(/[^0-9.]/g, '')
    return cleanPrice ? `${currencySymbol}${cleanPrice}` : '-'
  }

  if (menu.templateId === 'chef-signature') {
    return (
      <div className="rounded-2xl border border-neutral-300 bg-neutral-100/70 p-5 sm:p-7">
        <div className="border-b border-neutral-300 pb-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-600">Chef Signature Layout</p>
          <h4 className="mt-2 text-2xl font-semibold text-neutral-900">{menu.menuTitle}</h4>
          <p className="text-sm text-neutral-600">{menu.restaurantName || 'Untitled Restaurant'}</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {menu.sections.map((section) => (
            <section key={section.id} className="rounded-xl border border-neutral-300 bg-white p-4">
              <h5 className="text-lg font-semibold text-neutral-900">{section.title}</h5>
              <div className="mt-3 space-y-3">
                {section.items.map((item) => (
                  <div key={item.id} className="border-b border-neutral-200 pb-2 last:border-none last:pb-0 flex items-start gap-4">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded-lg border border-neutral-200 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-neutral-900 truncate">{item.name || 'Untitled Item'}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <p className="font-mono text-sm text-neutral-800">{formatPrice(item.price)}</p>
                          {canOrder && (
                            <button type="button" onClick={() => onAddToCart(item)}
                              className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-800 transition hover:border-neutral-900">Add</button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-neutral-600 line-clamp-2">{item.description || 'No description'}</p>
                    </div>
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
                  <div key={item.id} className="rounded-lg border border-neutral-200 bg-white overflow-hidden flex flex-col">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-24 object-cover border-b border-neutral-100" />
                    )}
                    <div className="p-2 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="font-medium text-neutral-900 text-sm">{item.name || 'Untitled Item'}</p>
                        <p className="text-xs text-neutral-600 line-clamp-2">{item.description || 'No description'}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="font-mono text-xs text-neutral-800">{formatPrice(item.price)}</p>
                        {canOrder && (
                          <button type="button" onClick={() => onAddToCart(item)}
                            className="rounded-full border border-neutral-300 px-2.5 py-1 text-[0.7rem] font-medium text-neutral-800 transition hover:border-neutral-900">Add</button>
                        )}
                      </div>
                    </div>
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
            <h5 className="border-b border-neutral-300 pb-2 text-lg font-semibold text-neutral-900">{section.title}</h5>
            <div className="mt-3 space-y-3">
              {section.items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 text-sm border-b border-neutral-100 pb-2 last:border-none last:pb-0">
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt={item.name} className="w-12 h-12 object-cover rounded-md border border-neutral-200 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-neutral-900">{item.name || 'Untitled Item'}</p>
                        <p className="text-neutral-600">{item.description || 'No description'}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="font-mono text-neutral-800">{formatPrice(item.price)}</p>
                        {canOrder && (
                          <button type="button" onClick={() => onAddToCart(item)}
                            className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-800 transition hover:border-neutral-900">Add</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

// Toggle moved to components/Toggle.jsx

// ─── Editor (Main Dashboard) ──────────────────────────────────────────────────
function Editor() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [activeSection, setActiveSection] = useState('dashboard')
  const [showBuilder, setShowBuilder] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [isDeletingMenu, setIsDeletingMenu] = useState(false)

  // Menu builder state
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [draftMenu, setDraftMenu] = useState(null)
  const [savedMenus, setSavedMenus] = useState([])
  const [saveStatus, setSaveStatus] = useState('Choose a template to begin.')
  const [isSaving, setIsSaving] = useState(false)
  const [qrPreview, setQrPreview] = useState(null)
  const [uploadingItems, setUploadingItems] = useState({})
  const [copiedUrl, setCopiedUrl] = useState(null)

  const handleCopyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch (err) {
      console.error('Failed to copy link: ', err)
    }
  }

  const handleDownloadPdf = (qr) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      // Header background decoration (light gray banner)
      doc.setFillColor(248, 249, 250)
      doc.rect(0, 0, pageWidth, 65, 'F')

      // Main header line
      doc.setDrawColor(220, 252, 231) // light green border
      doc.setLineWidth(1)
      doc.line(0, 65, pageWidth, 65)

      // Brand / Restaurant Name
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(24)
      doc.setTextColor(18, 18, 18)
      const restaurantName = qrPreview.restaurantName || 'Untitled Restaurant'
      doc.text(restaurantName.toUpperCase(), pageWidth / 2, 32, { align: 'center' })

      // Menu Title
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(14)
      doc.setTextColor(115, 115, 115)
      const menuTitle = qrPreview.menuTitle || 'Digital Menu'
      doc.text(menuTitle, pageWidth / 2, 44, { align: 'center' })

      // Table indicator / QR code title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(32)
      doc.setTextColor(22, 163, 74) // brand green: #16a34a
      const tableText = qr.table ? `TABLE ${qr.table}` : 'MAIN MENU'
      doc.text(tableText, pageWidth / 2, 95, { align: 'center' })

      // QR Code Box
      const qrSize = 100 // 100mm
      const qrX = (pageWidth - qrSize) / 2
      const qrY = 110
      
      // Draw background board for the QR
      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(229, 231, 235) // border neutral-200
      doc.setLineWidth(0.5)
      // Draw card border slightly larger than QR code
      doc.roundedRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 4, 4, 'FD')

      // Add QR Image
      doc.addImage(qr.qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

      // Instructions block
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(18, 18, 18)
      doc.text('SCAN THE QR CODE', pageWidth / 2, 245, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(82, 82, 82)
      doc.text('Scan with your smartphone camera to view the menu & place your order.', pageWidth / 2, 253, { align: 'center' })

      // URL at the bottom
      doc.setFont('courier', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(163, 163, 163)
      doc.text(qr.url, pageWidth / 2, 275, { align: 'center' })

      // Save PDF
      const filename = qr.table
        ? `${restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-table-${qr.table}.pdf`
        : `${restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-menu.pdf`
      doc.save(filename)
    } catch (err) {
      console.error('Failed to generate PDF: ', err)
      alert('Error generating PDF. Please try again.')
    }
  }

  // Restaurant / settings state
  const [restaurantSettings, setRestaurantSettings] = useState(null)
  const [tableTrackingEnabled,setTableTrackingEnabled] = useState(false)
  const [tableCount,setTableCount] = useState(0)
  const [isRestaurantLoading, setIsRestaurantLoading] = useState(false)
  const [isRestaurantUpdating, setIsRestaurantUpdating] = useState(false)
  const restaurantId = profile?.restaurantId || null

  // Auth
  useEffect(() => {
    if (auth) return onAuthStateChanged(auth, setUser)
  }, [])

  //toggle service fee
  const handleToggleServiceFee = async()=>{

  if(!restaurantId || !restaurantSettings)
    return


  const next =
  !restaurantSettings.serviceFeeEnabled


  setRestaurantSettings(c=>({
    ...c,
    serviceFeeEnabled:next
  }))


  await saveRestaurantSettings(
    restaurantId,
    {
      ...restaurantSettings,
      serviceFeeEnabled:next
    }
  )

  }
  
  //Handle Service Fee Percentage in settings dashboard
  const handleServiceFeePercentageChange =
  async(value)=>{

  if(!restaurantId || !restaurantSettings)
    return


  setRestaurantSettings(c=>({
    ...c,
    serviceFeePercentage:value
  }))


  await saveRestaurantSettings(
    restaurantId,
    {
    ...restaurantSettings,
    serviceFeePercentage:value
    }
  )

  }

  // Load saved menus
  useEffect(() => {
    let isActive = true
    const loadMenus = async () => {
      if (!restaurantId) { setSavedMenus([]); return }
      const menu = await getRestaurantMenu(restaurantId)
      const menus = menu ? [menu] : []
      const menusWithQr = await Promise.all(
        menus.map(async (m) => {
          const slug = m.slug || m.id
          const targetUrl =
          restaurantSettings?.tableTrackingEnabled
          ?
          `${window.location.origin}/menu/${slug}/tableNo-1`
          :
          `${window.location.origin}/menu/${slug}`
          let qrDataUrl = m.qrDataUrl || ''
          if (!qrDataUrl) {
            try { qrDataUrl = await QRCode.toDataURL(targetUrl, { width: 320, margin: 1, color: { dark: '#101010', light: '#ffffff' } }) }
            catch { qrDataUrl = '' }
          }
          return { localId: m.id || slug, ...m, qrDataUrl, remoteSaved: true, remoteId: slug, savedAt: m.savedAt || m.updatedAt || new Date().toISOString() }
        })
      )
      if (isActive) setSavedMenus(menusWithQr)
    }
    loadMenus()
    return () => { isActive = false }
  }, [restaurantId])

  // Load restaurant settings
  useEffect(() => {
    let isActive = true
    const loadSettings = async () => {
      if (!restaurantId) { setRestaurantSettings(null); setIsRestaurantLoading(false); return }
      setIsRestaurantLoading(true)
      const settings = await getRestaurantSettings(restaurantId)
      if (!isActive) return
      if (settings) {
        setRestaurantSettings(settings)
        setTableTrackingEnabled(
        Boolean(settings.tableTrackingEnabled)
      )
        setTableCount(
        Number(settings.tableCount || 0)
        )
      }else {
        const defaults = { 
          name: '', 
          slug: '', 
          isActive: true,
          allowOnlineOrders: false,
          serviceFeeEnabled:false,
          serviceFeePercentage:10,
          tableTrackingEnabled:false,
          tableCount:0

          }
        setRestaurantSettings(defaults)
        await saveRestaurantSettings(restaurantId, defaults)
      }
      setIsRestaurantLoading(false)
    }
    loadSettings()
    return () => { isActive = false }
  }, [restaurantId, profile])

  // Close builder on Escape
  useEffect(() => {
    if (!showBuilder && !qrPreview) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') { setShowBuilder(false); setQrPreview(null) }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showBuilder, qrPreview])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleToggleOnlineOrders = async () => {
    if (!restaurantId || !restaurantSettings) return
    const nextValue = !restaurantSettings.allowOnlineOrders
    setRestaurantSettings((c) => ({ ...c, allowOnlineOrders: nextValue }))
    setIsRestaurantUpdating(true)
    await saveRestaurantSettings(restaurantId, { ...restaurantSettings, allowOnlineOrders: nextValue })
    setIsRestaurantUpdating(false)
  }
  const handleToggleTableTracking = async()=>{
    if(!restaurantId || !restaurantSettings)
    return
    const next =
    !tableTrackingEnabled
    setTableTrackingEnabled(next)
    const updated={
    ...restaurantSettings,
    tableTrackingEnabled:next,
    tableCount:
    next ? tableCount : 0
    }
    setRestaurantSettings(updated)
    await saveRestaurantSettings(
    restaurantId,
    updated
    )
  }
  const handleTableCountChange = async(value)=>{
    const count =
    Number(value)
    setTableCount(count)
    const updated={
    ...restaurantSettings,
    tableTrackingEnabled:true,
    tableCount:count
    }
    setRestaurantSettings(updated)
    await saveRestaurantSettings(
    restaurantId,
    updated
    )
  }
  const handleCurrencyChange = async (newCurrency) => {
    if (!restaurantId || !restaurantSettings) return
    setRestaurantSettings((c) => ({ ...c, currency: newCurrency }))
    setIsRestaurantUpdating(true)
    await saveRestaurantSettings(restaurantId, { ...restaurantSettings, currency: newCurrency })
    setIsRestaurantUpdating(false)
  }

  const handleRestaurantNameChange = async (newName) => {
    if (!restaurantId || !restaurantSettings) return
    setRestaurantSettings((c) => ({ ...c, name: newName }))
    setIsRestaurantUpdating(true)
    await saveRestaurantSettings(restaurantId, { ...restaurantSettings, name: newName })
    setIsRestaurantUpdating(false)
  }

  const handleSlugChange = async (newSlug) => {
    if (!restaurantId || !restaurantSettings) return
    setRestaurantSettings((c) => ({ ...c, slug: newSlug }))
    setIsRestaurantUpdating(true)
    await saveRestaurantSettings(restaurantId, { ...restaurantSettings, slug: newSlug })
    setIsRestaurantUpdating(false)
  }

  const handleDisplayNameChange = async (newDisplayName) => {
    if (!user) return
    setProfile((c) => ({ ...c, ownerName: newDisplayName }))
    setIsRestaurantUpdating(true)
    await saveUserProfile(user.uid, { ownerName: newDisplayName })
    setIsRestaurantUpdating(false)
  }



  const currencySymbol = restaurantSettings?.currency === 'LKR' ? 'Rs. ' : '$'

  const selectedTemplate = useMemo(() => findTemplateById(selectedTemplateId), [selectedTemplateId])
  const preferredRestaurantName = useMemo(() =>
    restaurantSettings?.name?.trim() || '', [restaurantSettings])
  const draftItemCount = useMemo(() =>
    draftMenu ? draftMenu.sections.reduce((c, s) => c + s.items.length, 0) : 0, [draftMenu])

  const loadTemplate = (templateId) => {
    const template = findTemplateById(templateId)
    if (!template) return
    setSelectedTemplateId(templateId)
    setDraftMenu((prev) => {
      if (prev) {
        return {
          ...prev,
          templateId: template.id,
          templateLabel: template.label,
          updatedAt: new Date().toISOString(),
        }
      }
      const cloned = cloneTemplate(template)
      return {
        id: createId('draft'),
        templateId: cloned.id,
        templateLabel: cloned.label,
        restaurantName: preferredRestaurantName || cloned.restaurantName,
        menuTitle: cloned.menuTitle,
        notes: '',
        sections: cloned.sections,
        updatedAt: new Date().toISOString(),
      }
    })
    setSaveStatus('Template layout applied.')
  }

  const updateDraft = (updater) => {
    setDraftMenu((cur) => {
      if (!cur) return cur
      return { ...updater(cur), updatedAt: new Date().toISOString() }
    })
  }

  const updateSectionList = (updater) =>
    updateDraft((cur) => ({ ...cur, sections: updater(cur.sections) }))

  const updateSectionField = (sectionId, title) =>
    updateSectionList((sections) => sections.map((s) => s.id === sectionId ? { ...s, title } : s))

  const removeSection = (sectionId) =>
    updateSectionList((sections) => sections.length <= 1 ? sections : sections.filter((s) => s.id !== sectionId))

  const addSection = () => updateSectionList((sections) => [...sections, createEmptySection()])

  const addItem = (sectionId) =>
    updateSectionList((sections) => sections.map((s) => s.id === sectionId ? { ...s, items: [...s.items, createEmptyItem()] } : s))

  const removeItem = (sectionId, itemId) =>
    updateSectionList((sections) => sections.map((s) => {
      if (s.id !== sectionId) return s
      if (s.items.length <= 1) return s
      return { ...s, items: s.items.filter((item) => item.id !== itemId) }
    }))

  const updateItemField = (sectionId, itemId, fieldName, value) =>
    updateSectionList((sections) => sections.map((s) => {
      if (s.id !== sectionId) return s
      return { ...s, items: s.items.map((item) => item.id === itemId ? { ...item, [fieldName]: value } : item) }
    }))

  const saveMenu = async () => {
    if (!draftMenu) { setSaveStatus('Pick a template first.'); return }
    if (!restaurantId) { setSaveStatus('Complete onboarding first.'); return }
    if (!draftMenu.menuTitle.trim()) { setSaveStatus('Add a menu title before saving.'); return }
    setIsSaving(true)
    const payload = {
      templateId: draftMenu.templateId,
      templateLabel: draftMenu.templateLabel,
      restaurantName: restaurantSettings?.name || draftMenu.restaurantName.trim(),
      menuTitle: draftMenu.menuTitle.trim(),
      notes: draftMenu.notes.trim(),
      sections: draftMenu.sections,
      updatedAt: new Date().toISOString(),
    }
    let qrDataUrl = ''
    let remoteSaved = false
    let remoteId = null
    try {
      const result = await saveMenuRecord(payload, restaurantId)
      remoteSaved = result.remoteSaved
      remoteId = result.remoteId
    } catch {
      remoteSaved = false
      remoteId = restaurantSettings?.slug || restaurantId
    }
    const targetUrl = `${window.location.origin}/menu/${remoteId || restaurantId}`
    try {
      qrDataUrl = await QRCode.toDataURL(targetUrl, { width: 320, margin: 1, color: { dark: '#101010', light: '#ffffff' } })
    } catch {
      setSaveStatus('QR code generation failed.')
      setIsSaving(false)
      return
    }
    setSavedMenus([{
      localId: createId('menu'), ...payload, qrDataUrl, remoteSaved,
      remoteId: remoteId || restaurantId, savedAt: new Date().toISOString(),
    }])
    setSaveStatus(remoteSaved ? 'Menu published and synced.' : 'Menu saved locally.')
    setIsSaving(false)
    // Go to My Menu after saving
    setActiveSection('my-menu')
    setShowBuilder(false)
  }
  const openQrPreview = async(menu)=>{
    const slug =
    menu.remoteId || menu.slug
    let qrList=[]
    if(restaurantSettings?.tableTrackingEnabled)
    {
    for(
    let i=1;
    i<=restaurantSettings.tableCount;
    i++
    )
    {
    qrList.push({
    table:i,
    url:
    `${window.location.origin}/menu/${slug}/tableNo-${i}`
    })
    }
    }
    else
    {
    qrList.push({
    table:null,
    url:
    `${window.location.origin}/menu/${slug}`
    })
    }
    const generated =
    await Promise.all(
    qrList.map(async(q)=>({
    ...q,
    qrDataUrl:
    await QRCode.toDataURL(q.url)
    }))
    )
    setQrPreview({
    menuTitle:menu.menuTitle,
    restaurantName:menu.restaurantName,
    qrs:generated
    })
  }
  const closeQrPreview = () => setQrPreview(null)

  const openMenuPreview = (menu) => {
    const slug = menu.remoteId || menu.slug
    if (!slug) { setSaveStatus('Save the menu first to preview.'); return }
    window.open(`${window.location.origin}/menu/${slug}`, '_blank', 'noopener')
  }

  const loadMenuForEditing = (menu) => {
    setSelectedTemplateId(menu.templateId)
    setDraftMenu({
      id: menu.localId,
      templateId: menu.templateId,
      templateLabel: menu.templateLabel,
      restaurantName: menu.restaurantName,
      menuTitle: menu.menuTitle,
      notes: menu.notes,
      sections: menu.sections,
      updatedAt: new Date().toISOString(),
    })
    setSaveStatus('Menu loaded for editing. Make changes and save.')
    setShowBuilder(true)
  }

  const openNewMenuBuilder = () => {
    const defaultTemplate = menuTemplates[0]
    setSelectedTemplateId(defaultTemplate.id)
    setDraftMenu({
      id: createId('draft'),
      templateId: defaultTemplate.id,
      templateLabel: defaultTemplate.label,
      restaurantName: preferredRestaurantName || '',
      menuTitle: '',
      notes: '',
      sections: [createEmptySection()],
      updatedAt: new Date().toISOString(),
    })
    setSaveStatus('Start building your menu.')
    setShowBuilder(true)
  }

  const handleDeleteMenu = async (menu) => {
    setIsDeletingMenu(true)
    await deleteMenuRecord(restaurantId)
    setSavedMenus((prev) => prev.filter((m) => m.localId !== menu.localId))
    setDeleteConfirmId(null)
    setIsDeletingMenu(false)
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <IconDashboard /> },
    { id: 'my-menu', label: 'My Menu', icon: <IconMenu /> },
    { id: 'settings', label: 'Settings', icon: <IconSettings /> },
    { id: 'profile', label: 'Profile', icon: <IconProfile /> },
  ]

  const initials = (name) => {
    if (!name) return '?'
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  }



  // ── Menu Builder Drawer ───────────────────────────────────────────────────
  const BuilderDrawer = () => (
    <>
      <div className="drawer-overlay" onClick={() => setShowBuilder(false)} />
      <div className="drawer-panel">
        {/* Drawer Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-neutral-100 bg-white px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Menu Builder</p>
            <h2 className="mt-0.5 text-lg font-bold text-neutral-900">
              {selectedTemplate ? selectedTemplate.label : 'Select a Template'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={saveMenu}
              disabled={!draftMenu || isSaving}
              className="btn-green"
            >
              {isSaving ? 'Saving…' : 'Save Menu'}
            </button>
            <button onClick={() => setShowBuilder(false)} className="btn-ghost p-2">
              <IconX />
            </button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Status bar */}
          <div className="rounded-xl border px-4 py-2.5 text-sm" style={{ borderColor: '#dcfce7', background: '#f0fdf4', color: '#15803d' }}>
            {saveStatus}
          </div>

          {/* Draft form */}
          {draftMenu && (
            <div className="flex flex-col gap-5">
              {/* Basic fields */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-neutral-700">Restaurant Name</span>
                  <input
                    value={draftMenu.restaurantName}
                    onChange={(e) => updateDraft((d) => ({ ...d, restaurantName: e.target.value }))}
                    className="input-field"
                    placeholder="Name of restaurant"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-neutral-700">Menu Title</span>
                  <input
                    value={draftMenu.menuTitle}
                    onChange={(e) => updateDraft((d) => ({ ...d, menuTitle: e.target.value }))}
                    className="input-field"
                    placeholder="e.g. Dinner Menu"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-neutral-700">Menu Notes</span>
                <textarea
                  value={draftMenu.notes}
                  onChange={(e) => updateDraft((d) => ({ ...d, notes: e.target.value }))}
                  rows={2}
                  className="input-field"
                  placeholder="Optional details, timings, or highlights"
                />
              </label>

              {/* Sections */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-700">Sections & Items</p>
                    {!isSupabaseConfigured && (
                      <p className="text-xs text-amber-600 font-medium mt-0.5">
                        ⚠️ Supabase credentials missing. Image uploads are disabled.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={addSection}
                    className="btn-ghost flex items-center gap-1 text-xs"
                  >
                    <IconPlus /> Add Section
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  {draftMenu.sections.map((section) => (
                    <article key={section.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <input
                          value={section.title}
                          onChange={(e) => updateSectionField(section.id, e.target.value)}
                          className="input-field text-sm font-semibold"
                          style={{ background: 'white' }}
                        />
                        <button
                          type="button"
                          onClick={() => removeSection(section.id)}
                          className="flex-shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600 transition hover:border-red-300 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="flex flex-col gap-2">
                        {section.items.map((item) => {
                          const isUploading = uploadingItems[item.id]
                          return (
                            <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center">
                              {/* Image Upload/Preview */}
                              <div className="flex-shrink-0 flex items-center justify-center">
                                {item.imageUrl ? (
                                  <div className="relative group w-16 h-16 rounded-lg overflow-hidden border border-neutral-200">
                                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => updateItemField(section.id, item.id, 'imageUrl', '')}
                                      className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                      title="Remove image"
                                    >
                                      <IconTrash className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <label 
                                    className={`w-16 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition ${
                                      isUploading 
                                        ? 'border-neutral-300 bg-neutral-50' 
                                        : !isSupabaseConfigured || !restaurantId
                                          ? 'border-neutral-200 bg-neutral-50/50 cursor-not-allowed opacity-50'
                                          : 'border-neutral-300 hover:border-green-500 bg-neutral-50/50 hover:bg-neutral-50'
                                    }`}
                                    title={
                                      !isSupabaseConfigured 
                                        ? "Supabase not configured" 
                                        : !restaurantId 
                                          ? "Onboarding not complete" 
                                          : "Upload image (up to 1MB)"
                                    }
                                  >
                                    {isUploading ? (
                                      <span className="text-[10px] text-neutral-500 animate-pulse font-medium">Uploading...</span>
                                    ) : (
                                      <>
                                        <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span className="text-[9px] text-neutral-400 font-semibold mt-0.5">Add Image</span>
                                      </>
                                    )}
                                    {isSupabaseConfigured && restaurantId && (
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        disabled={isUploading}
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0]
                                          if (!file) return
                                          if (file.size > 1024 * 1024) {
                                            alert('Image size exceeds 1 MB limit. Please upload a smaller image.')
                                            return
                                          }
                                          try {
                                            setUploadingItems(prev => ({ ...prev, [item.id]: true }))
                                            const url = await uploadMenuItemImage(restaurantId, item.id, file)
                                            updateItemField(section.id, item.id, 'imageUrl', url)
                                          } catch (err) {
                                            alert(err.message || 'Failed to upload image')
                                          } finally {
                                            setUploadingItems(prev => ({ ...prev, [item.id]: false }))
                                          }
                                        }}
                                      />
                                    )}
                                  </label>
                                )}
                              </div>

                              {/* Inputs */}
                              <div className="flex-1 grid gap-2 grid-cols-1 md:grid-cols-[1.5fr_2fr_1fr]">
                                <input value={item.name} onChange={(e) => updateItemField(section.id, item.id, 'name', e.target.value)}
                                  placeholder="Item name" className="input-field text-sm" />
                                <input value={item.description} onChange={(e) => updateItemField(section.id, item.id, 'description', e.target.value)}
                                  placeholder="Description" className="input-field text-sm" />
                                <div className="input-wrapper">
                                  <span className="text-sm font-medium text-neutral-500 mr-1.5 whitespace-nowrap">{currencySymbol}</span>
                                  <input 
                                    value={item.price} 
                                    onChange={(e) => {
                                      let val = e.target.value.replace(/[^0-9.]/g, '');
                                      const parts = val.split('.');
                                      if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                                      updateItemField(section.id, item.id, 'price', val);
                                    }}
                                    placeholder="0.00" 
                                  />
                                </div>
                              </div>

                              <button type="button" onClick={() => removeItem(section.id, item.id)}
                                className="rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-600 transition hover:border-red-300 hover:text-red-600 self-stretch sm:self-auto flex items-center justify-center">
                                ×
                              </button>
                            </div>
                          )
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => addItem(section.id)}
                        className="mt-3 flex items-center gap-1 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-600 transition hover:border-green-400 hover:text-green-700"
                      >
                        <IconPlus /> Add Item
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Template Selector */}
          <div>
            <p className="mb-3 text-sm font-semibold text-neutral-700">Choose Template</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {menuTemplates.map((template) => {
                const isActive = template.id === selectedTemplateId
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => loadTemplate(template.id)}
                    className={`rounded-2xl border p-4 text-left transition ${isActive
                        ? 'border-green-500 bg-green-600 text-white'
                        : 'border-neutral-200 bg-white text-neutral-900 hover:border-green-400'
                      }`}
                  >
                    <p className="text-sm font-bold">{template.label}</p>
                    <p className={`mt-1 text-xs leading-relaxed ${isActive ? 'text-green-100' : 'text-neutral-500'}`}>
                      {template.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Preview */}
          {draftMenu && (
            <div>
              <p className="mb-3 text-sm font-semibold text-neutral-700">Live Preview</p>
              <TemplateMenuPreview menu={draftMenu} currencySymbol={currencySymbol} />
            </div>
          )}

          {!draftMenu && (
            <div className="rounded-2xl border-2 border-dashed p-10 text-center" style={{ borderColor: '#dcfce7' }}>
              <p className="text-neutral-500">Select a template above to start building your menu.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <LoginModal user={user} onComplete={setProfile} />

      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-6 border-b" style={{ borderColor: '#dcfce7' }}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, #16a34a, #4ade80)' }}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="12" height="12" rx="2" fill="white" />
              <rect x="18" y="2" width="12" height="12" rx="2" fill="white" fillOpacity="0.7" />
              <rect x="2" y="18" width="12" height="12" rx="2" fill="white" fillOpacity="0.7" />
              <rect x="20" y="20" width="4" height="4" rx="1" fill="white" />
              <rect x="26" y="20" width="4" height="4" rx="1" fill="white" />
              <rect x="20" y="26" width="10" height="4" rx="1" fill="white" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-neutral-900 leading-tight">{restaurantSettings?.name || 'QR Menu Studio'}</p>
            <p className="text-xs text-neutral-400 truncate">QR Menu Studio</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActiveSection(item.id)}
              className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom user info */}
        {user && (
          <div className="border-t p-4" style={{ borderColor: '#dcfce7' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #16a34a, #4ade80)' }}
              >
                {initials(user.displayName || profile?.ownerName || 'U')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{user.displayName || 'User'}</p>
                <p className="truncate text-xs text-neutral-400">{user.email}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="main-content">
        {activeSection === 'dashboard' && <DashboardScreen
          profile={profile}
          restaurantSettings={restaurantSettings}
          savedMenus={savedMenus}
          draftMenu={draftMenu}
          draftItemCount={draftItemCount}
          openNewMenuBuilder={openNewMenuBuilder}
          setActiveSection={setActiveSection}
          loadMenuForEditing={loadMenuForEditing}
          openMenuPreview={openMenuPreview}
          openQrPreview={openQrPreview}
        />}
        {activeSection === 'my-menu' && <MyMenuScreen
          savedMenus={savedMenus}
          openNewMenuBuilder={openNewMenuBuilder}
          openQrPreview={openQrPreview}
          loadMenuForEditing={loadMenuForEditing}
          openMenuPreview={openMenuPreview}
          deleteConfirmId={deleteConfirmId}
          setDeleteConfirmId={setDeleteConfirmId}
          handleDeleteMenu={handleDeleteMenu}
          isDeletingMenu={isDeletingMenu}
        />}
        {activeSection === 'settings' && <SettingsScreen
          restaurantSettings={restaurantSettings}
          profile={profile}
          isRestaurantLoading={isRestaurantLoading}
          isRestaurantUpdating={isRestaurantUpdating}
          handleToggleOnlineOrders={handleToggleOnlineOrders}
          handleCurrencyChange={handleCurrencyChange}
          handleRestaurantNameChange={handleRestaurantNameChange}
          handleSlugChange={handleSlugChange}
          savedMenus={savedMenus}
          setDeleteConfirmId={setDeleteConfirmId}
          handleToggleServiceFee={handleToggleServiceFee}
          handleServiceFeePercentageChange={handleServiceFeePercentageChange}
          tableTrackingEnabled={tableTrackingEnabled}
          tableCount={tableCount}
          handleToggleTableTracking={
          handleToggleTableTracking
          }
          handleTableCountChange={
          handleTableCountChange
          }
        />}
        {activeSection === 'profile' && <ProfileScreen
          user={user}
          profile={profile}
          restaurantSettings={restaurantSettings}
          restaurantId={restaurantId}
          initials={initials}
          logoutUser={logoutUser}
          isUpdating={isRestaurantUpdating}
          handleDisplayNameChange={handleDisplayNameChange}
        />}
      </main>

      {/* Menu Builder Drawer */}
      {showBuilder && BuilderDrawer()}

      {/* QR Preview Modal */}
      {qrPreview && (
        <div className="modal-overlay" onClick={closeQrPreview} role="dialog" aria-modal="true" aria-label="QR preview">
          <div className="modal-panel max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <p className="text-lg font-bold text-neutral-900">{qrPreview.menuTitle}</p>
                  <p className="text-sm text-neutral-500">{qrPreview.restaurantName || 'Untitled Restaurant'}</p>
                </div>
                <button onClick={closeQrPreview} className="btn-ghost p-2 flex-shrink-0"><IconX /></button>
              </div>
              <div className="flex flex-wrap gap-6 justify-center rounded-2xl border p-6" style={{ background: '#f8f8f8', borderColor: '#e5e7eb' }}>
                {
                  qrPreview.qrs?.map((qr) => (
                    <div
                      key={qr.url}
                      className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm text-center flex flex-col items-center justify-between w-full max-w-[16rem]"
                    >
                      <h3 className="mb-3 font-bold text-neutral-900 text-sm">
                        {
                          qr.table
                          ?
                          `Table ${qr.table}`
                          :
                          "Main Menu QR"
                        }
                      </h3>
                      <img
                        src={qr.qrDataUrl}
                        alt={
                          qr.table
                          ?
                          `Table ${qr.table} QR code`
                          :
                          "Menu QR code"
                        }
                        className="mx-auto w-full max-w-[12rem] aspect-square object-contain rounded-xl"
                      />

                      {/* Action buttons (Copy and Download) */}
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(qr.url)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:bg-neutral-50 hover:text-green-600 hover:border-green-200 focus:outline-none"
                          title="Copy Link"
                        >
                          {copiedUrl === qr.url ? (
                            <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(qr)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:bg-neutral-50 hover:text-green-600 hover:border-green-200 focus:outline-none"
                          title="Download PDF"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>
                      </div>

                      <p className="mt-3 break-all text-[11px] text-neutral-400 font-mono">
                        {qr.url}
                      </p>
                    </div>
                  ))
                }
              </div>
              <p className="mt-3 text-center text-xs text-neutral-400">Scan this QR code to open the menu</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── parsePrice / getCurrencySymbol ──────────────────────────────────────────
const parsePrice = (priceStr) => {
  if (!priceStr) return 0
  const sanitized = priceStr.replace(/[^\d.]/g, '')
  const parsed = parseFloat(sanitized)
  return isNaN(parsed) ? 0 : parsed
}

const getCurrencySymbol = (priceStr) => {
  if (!priceStr) return '$'
  const match = priceStr.trim().match(/^([^\d\s.]+)/)
  return match ? match[1] : '$'
}

// ─── MenuViewer ───────────────────────────────────────────────────────────────
function MenuViewer() {
  const { id, tableNo } = useParams()
  const [menuData, setMenuData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [restaurantSettings, setRestaurantSettings] = useState(null)
  const [cartItems, setCartItems] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [activeOrderId, setActiveOrderId] = useState(null)
  const [orderData, setOrderData] = useState(null)
  const [orderError, setOrderError] = useState('')
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [deviceId] = useState(() => getDeviceId())

  const orderStorageKey = id ? `qr-order-${id}` : null

  const clearOrder = useCallback(() => {
    if (orderStorageKey) window.localStorage.removeItem(orderStorageKey)
    setActiveOrderId(null)
    setOrderData(null)
  }, [orderStorageKey])

  const subtotal = useMemo(()=>{

    if(!orderData?.items)
      {
        return cartItems.reduce(
          (sum, entry)=>
            sum + parsePrice(entry.price) * entry.qty,
          0
        )
      }


    // Use saved subtotal if available
    if(orderData?.subtotal !== undefined)
      return orderData.subtotal


    // fallback for old orders
    return orderData.items.reduce(
      (sum,entry)=>
        sum +
        parsePrice(entry.price) *
        entry.qty,
      0
    )

  },[orderData, cartItems])



  const serviceFee = useMemo(()=>{

    // Existing orders use saved snapshot
    if(orderData)
    {
      return Number(orderData.serviceFee || 0)
    }


    // New cart calculation only
    if(!restaurantSettings?.serviceFeeEnabled)
      return 0


    return subtotal *
    (
      Number(restaurantSettings.serviceFeePercentage || 10)
      /100
    )


  },[
    subtotal,
    restaurantSettings,
    orderData
  ])



  const orderTotal = useMemo(()=>{

    // Existing orders use saved snapshot
    if(orderData)
    {
      return Number(orderData.totalAmount || 0)
    }


    return subtotal + serviceFee


  },[
    orderData,
    subtotal,
    serviceFee
  ])

  const orderCurrency = useMemo(() => {
    return restaurantSettings?.currency === 'LKR'
      ? 'Rs. '
      : '$'
  }, [restaurantSettings])

  useEffect(() => {
    async function load() {
      if (id) {
        const data = await getMenuRecord(id)
        setMenuData(data)
      }
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    let isActive = true
    const loadRestaurantSettings = async () => {
      if (!menuData?.restaurantId) return
      const settings = await getRestaurantSettings(menuData.restaurantId)
      if (!isActive) return
      setRestaurantSettings(settings || { allowOnlineOrders: false })
    }
    loadRestaurantSettings()
    return () => { isActive = false }
  }, [menuData])

  useEffect(() => {
    if (!orderStorageKey || !menuData?.restaurantId) return
    const stored = window.localStorage.getItem(orderStorageKey)
    if (!stored) { setActiveOrderId(null); return }
    try {
      const parsed = JSON.parse(stored)
      if (parsed?.restaurantId === menuData.restaurantId && parsed?.orderId) {
        setActiveOrderId(parsed.orderId)
      }
    } catch {
      setActiveOrderId(null)
    }
  }, [orderStorageKey, menuData])

  useEffect(() => {
    if (!menuData?.restaurantId || !activeOrderId) { setOrderData(null); return }
    const unsubscribe = subscribeToRestaurantOrder(menuData.restaurantId, activeOrderId, (order) => {
      if (order === null) {
        clearOrder()
      } else {
        setOrderData(order)
      }
    })
    return () => { unsubscribe() }
  }, [menuData, activeOrderId, clearOrder])

  const allowOnlineOrders = Boolean(restaurantSettings?.allowOnlineOrders)
  const rawOrderStatus = (orderData?.status || '').trim().toLowerCase()
  const orderStatus = ['complete', 'completed', 'delivered'].includes(rawOrderStatus)
    ? 'completed'
    : rawOrderStatus || null
  const hasActiveOrder = Boolean(activeOrderId && orderStatus !== 'completed')

  const addToCart = (item) => {
    if (hasActiveOrder) return
    setCartItems((current) => {
      const existing = current.find((entry) => entry.itemId === item.id)
      if (existing) {
        return current.map((entry) =>
          entry.itemId === item.id ? { ...entry, qty: entry.qty + 1 } : entry
        )
      }
      return [...current, { itemId: item.id, name: item.name || 'Untitled Item', price: item.price || '-', qty: 1 }]
    })
  }

  const updateCartQty = (itemId, nextQty) => {
    setCartItems((current) =>
      current.map((entry) => (entry.itemId === itemId ? { ...entry, qty: nextQty } : entry)).filter((e) => e.qty > 0)
    )
  }

  const placeOrder = async () => {
  if (!menuData?.restaurantId || !allowOnlineOrders) return

  if (!customerName.trim()) {
    setOrderError('Please add your name before placing the order.')
    return
  }

  if (cartItems.length === 0) {
    setOrderError('Add at least one item to the cart.')
    return
  }

  setOrderError('')
  setIsPlacingOrder(true)


  // calculate new order subtotal from cart
  const newSubtotal = cartItems.reduce(
    (sum, item) =>
      sum + parsePrice(item.price) * item.qty,
    0
  )


  const newServiceFee =
    restaurantSettings?.serviceFeeEnabled
      ? newSubtotal *
        (
          Number(
            restaurantSettings.serviceFeePercentage || 10
          ) / 100
        )
      : 0


  const newTotal =
    newSubtotal + newServiceFee



  const orderPayload = {
    tableNo:
    tableNo
    ?
    tableNo.replace("tableNo-","")
    :
    null,
    menuId: id,

    menuTitle: menuData.menuTitle,

    restaurantId: menuData.restaurantId,

    restaurantName: menuData.restaurantName || '',


    currency:
      restaurantSettings?.currency || 'USD',


    deviceId,


    customerName:
      customerName.trim(),



    subtotal: newSubtotal,


    serviceFeeEnabled:
      Boolean(
        restaurantSettings?.serviceFeeEnabled
      ),


    serviceFeePercentage:
      Number(
        restaurantSettings?.serviceFeePercentage || 0
      ),


    serviceFee:
      newServiceFee,


    totalAmount:
      newTotal,



    items: cartItems.map((entry) => ({
      itemId: entry.itemId,
      name: entry.name,
      price: entry.price,
      qty: entry.qty
    }))

  }



  const orderId =
    await createRestaurantOrder(
      menuData.restaurantId,
      orderPayload
    )


  if(orderId){

    if(orderStorageKey){

      window.localStorage.setItem(
        orderStorageKey,
        JSON.stringify({
          orderId,
          restaurantId:
            menuData.restaurantId
        })
      )

    }


    setActiveOrderId(orderId)

    setCartItems([])

  }
  else{

    setOrderError(
      'Unable to place order. Please try again.'
    )

  }


  setIsPlacingOrder(false)
}



  const handleCancelOrder = async () => {
    if (!menuData?.restaurantId || !activeOrderId) return
    setIsCancelling(true)
    const success = await cancelRestaurantOrder(menuData.restaurantId, activeOrderId)
    if (success) {
      clearOrder()
      setShowCancelConfirm(false)
    } else {
      setOrderError('Failed to cancel the order. Please try again.')
      setShowCancelConfirm(false)
    }
    setIsCancelling(false)
  }

  if (loading) return <div className="p-10 text-center text-neutral-600">Loading menu…</div>
  if (!menuData) return <div className="p-10 text-center text-red-600">Menu not found or could not be loaded.</div>

  const currencySymbol = restaurantSettings?.currency === 'LKR' ? 'Rs. ' : '$'

  const menuPreviewEl = (
    <TemplateMenuPreview
      menu={menuData}
      currencySymbol={currencySymbol}
      orderingEnabled={allowOnlineOrders && !hasActiveOrder}
      onAddToCart={addToCart}
    />
  )

  const orderCardEl = (
    <div className="rounded-2xl border border-neutral-300 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">Order</p>
          <h3 className="mt-2 text-xl font-semibold text-neutral-900">
            {orderStatus ? 'Your order' : 'Your cart'}
          </h3>
        </div>
        {orderStatus && (
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${orderStatus === 'completed' ? 'border-emerald-500 bg-emerald-500 text-white'
              : orderStatus === 'preparing' ? 'border-amber-500 bg-amber-500 text-white'
                : orderStatus === 'confirmed' ? 'border-cyan-500 bg-cyan-500 text-white'
                  : 'border-blue-500 bg-blue-500 text-white'
            }`}>
            {orderStatus === 'confirmed' ? 'Confirmed' : orderStatus === 'preparing' ? 'Preparing' : orderStatus === 'completed' ? 'Completed' : 'Pending'}
          </span>
        )}
      </div>

      {!allowOnlineOrders && (
        <p className="mt-4 text-sm text-neutral-600">This restaurant is not accepting online orders at the moment.</p>
      )}

      {allowOnlineOrders && hasActiveOrder && orderStatus !== 'completed' && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-600">Your order has been placed. Status updates will appear here automatically.</p>
            {rawOrderStatus === 'pending' && (
              <div className="flex items-center gap-2">
                {!showCancelConfirm ? (
                  <button type="button" onClick={() => setShowCancelConfirm(true)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 hover:border-red-300">
                    Cancel Order
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-1.5">
                    <span className="text-[0.8rem] font-medium text-red-700 px-1">Are you sure?</span>
                    <button type="button" onClick={handleCancelOrder} disabled={isCancelling}
                      className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
                      {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
                    </button>
                    <button type="button" onClick={() => setShowCancelConfirm(false)} disabled={isCancelling}
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60">
                      No
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {orderData?.items && orderData.items.length > 0 && (
            <div className="border-t border-neutral-200 pt-4">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-neutral-500 mb-3">Ordered Items</p>
              <div className="space-y-3">
                {orderData.items.map((entry) => {
                  const priceVal = parsePrice(entry.price)
                  const itemTotal = priceVal * entry.qty
                  const currency = orderCurrency
                  return (
                    <div key={entry.itemId} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium text-neutral-900">{entry.name}</p>
                        <p className="text-xs text-neutral-500">{entry.price} × {entry.qty}</p>
                      </div>
                      <p className="font-mono text-sm font-semibold text-neutral-900">{currency}{itemTotal.toFixed(2)}</p>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 border-t border-dashed border-neutral-300 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-600">
                    Subtotal
                  </p>
                  <p className="font-mono text-sm text-neutral-900">
                    {orderCurrency}{subtotal.toFixed(2)}
                  </p>
                </div>

                {orderData?.serviceFeeEnabled && (
                  <div className="flex items-center justify-between">

                    <p className="text-sm text-neutral-600">
                      Service Fee ({orderData?.serviceFeePercentage || 0}%)
                    </p>

                    <p className="font-mono text-sm text-neutral-900">
                      {orderCurrency}{Number(orderData?.serviceFee || 0).toFixed(2)}
                    </p>

                  </div>
                )}

                <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
                  <p className="text-sm font-semibold text-neutral-900">
                    Total Amount
                  </p>
                  <p className="font-mono text-base font-bold text-neutral-900">
                    {orderCurrency}{orderTotal.toFixed(2)}
                  </p>
                </div>

              </div>
              </div>
            )}
          </div>
        )}

      {allowOnlineOrders && orderStatus === 'completed' && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3 text-sm text-neutral-600">
            <p>Your order is completed. You can start a new order anytime.</p>
            <button type="button" onClick={clearOrder}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-900">
              Start new order
            </button>
          </div>
          {orderData?.items && orderData.items.length > 0 && (
            <div className="border-t border-neutral-200 pt-4">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-neutral-500 mb-3">Ordered Items Summary</p>
              <div className="space-y-3">
                {orderData.items.map((entry) => {
                  const priceVal = parsePrice(entry.price)
                  const itemTotal = priceVal * entry.qty
                  const currency = orderCurrency
                  return (
                    <div key={entry.itemId} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium text-neutral-900">{entry.name}</p>
                        <p className="text-xs text-neutral-500">{entry.price} × {entry.qty}</p>
                      </div>
                      <p className="font-mono text-sm font-semibold text-neutral-900">{currency}{itemTotal.toFixed(2)}</p>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 border-t border-dashed border-neutral-300 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-600">
                    Subtotal
                  </p>
                  <p className="font-mono text-sm text-neutral-900">
                    {orderCurrency}{subtotal.toFixed(2)}
                  </p>
                </div>

                {orderData?.serviceFeeEnabled && (
                  <div className="flex items-center justify-between">

                    <p className="text-sm text-neutral-600">
                      Service Fee ({orderData?.serviceFeePercentage || 0}%)
                    </p>

                    <p className="font-mono text-sm text-neutral-900">
                      {orderCurrency}{Number(orderData?.serviceFee || 0).toFixed(2)}
                    </p>

                  </div>
                )}

                <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
                  <p className="text-sm font-semibold text-neutral-900">
                    Total Paid
                  </p>
                  <p className="font-mono text-base font-bold text-neutral-900">
                    {orderCurrency}{orderTotal.toFixed(2)}
                  </p>
                </div>

              </div>
            </div>
          )}
        </div>
      )}

      {allowOnlineOrders && !hasActiveOrder && orderStatus !== 'completed' && (
        <div className="mt-4 space-y-4">
          <label className="text-sm text-neutral-600">
            <span className="mb-2 block font-medium text-neutral-900">Your name</span>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-900"
              placeholder="Enter your name"
            />
          </label>

          {cartItems.length === 0 && (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
              Your cart is empty. Add items from the menu above.
            </div>
          )}

          {cartItems.length > 0 && (
            <>
              <div className="space-y-3">
                {cartItems.map((entry) => (
                  <div key={entry.itemId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
                    <div>
                      <p className="font-medium text-neutral-900">{entry.name}</p>
                      <p className="text-xs text-neutral-500">{entry.price} {entry.qty > 1 ? `× ${entry.qty}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateCartQty(entry.itemId, entry.qty - 1)}
                        className="rounded-full border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700">−</button>
                      <span className="w-6 text-center text-sm font-medium text-neutral-800">{entry.qty}</span>
                      <button type="button" onClick={() => updateCartQty(entry.itemId, entry.qty + 1)}
                        className="rounded-full border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700">+</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-dashed border-neutral-300 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-600">Subtotal</p>
                  <p className="font-mono text-sm font-semibold text-neutral-900">
                    {orderCurrency}{subtotal.toFixed(2)}
                  </p>
                </div>

                {restaurantSettings?.serviceFeeEnabled && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-neutral-600">
                      Service Fee ({restaurantSettings.serviceFeePercentage || 10}%)
                    </p>
                    <p className="font-mono text-sm font-semibold text-neutral-900">
                      {orderCurrency}{serviceFee.toFixed(2)}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
                  <p className="text-sm font-semibold text-neutral-900">Total Amount</p>
                  <p className="font-mono text-base font-bold text-neutral-900">
                    {orderCurrency}{orderTotal.toFixed(2)}
                  </p>
                </div>
              </div>
            </>
          )}

          {orderError && <p className="text-sm text-red-600">{orderError}</p>}

          <button type="button" onClick={placeOrder} disabled={isPlacingOrder}
            className="w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:bg-neutral-400">
            {isPlacingOrder ? 'Placing order...' : 'Place order'}
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-neutral-100 py-10 px-4">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        {orderStatus ? (
          <>{orderCardEl}{menuPreviewEl}</>
        ) : (
          <>{menuPreviewEl}{orderCardEl}</>
        )}
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <Routes>
      <Route path="/" element={<Editor />} />
      <Route 
      path="/menu/:id/:tableNo"
      element={<MenuViewer />}
      />
      <Route 
      path="/menu/:id"
      element={<MenuViewer />}
      />
    </Routes>
  )
}

export default App
