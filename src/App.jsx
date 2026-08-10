import LoginModal from "./LoginModal";
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Routes, Route, useParams } from 'react-router-dom'
import { auth, signInWithGoogle, logoutUser } from './lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'
import { cloneTemplate, findTemplateById, menuTemplates } from './data/menuTemplates'
import DashboardScreen from './components/screens/DashboardScreen'
import AnalyticsScreen from './components/screens/AnalyticsScreen'
import MyMenuScreen from './components/screens/MyMenuScreen'
import SettingsScreen from './components/screens/SettingsScreen'
import ProfileScreen from './components/screens/ProfileScreen'
import LandingPage from './components/landing/LandingPage'
import {
  IconDashboard, IconMenu, IconSettings, IconProfile, IconQr, IconPlus, IconEdit, IconTrash, IconEye, IconLogout, IconX, IconAnalytics
} from './components/Icons'
import {
  saveMenuRecord,
  getMenuRecord,
  getRestaurantMenu,
  getRestaurantSettings,
  subscribeToRestaurantSettings,
  saveRestaurantSettings,
  isRestaurantSlugAvailable,
  saveUserProfile,
  createRestaurantOrder,
  subscribeToRestaurantOrder,
  cancelRestaurantOrder,
  deleteMenuRecord,
  getWaiterCodes,
  addWaiterCode,
  deleteWaiterCode,
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

  const [activeSectionId, setActiveSectionId] = useState('all')
  const [activeSubcategoryId, setActiveSubcategoryId] = useState('all')

  const formatPrice = (price) => {
    if (!price) return '-'
    const cleanPrice = String(price).replace(/[^0-9.]/g, '')
    return cleanPrice ? `${currencySymbol}${cleanPrice}` : '-'
  }

  const handleSectionSelect = (sectionId) => {
    setActiveSectionId(sectionId)
    setActiveSubcategoryId('all')
  }

  const renderFilterTabs = () => {
    if (!menu.sections || menu.sections.length === 0) return null

    const selectedSection = menu.sections.find((s) => s.id === activeSectionId)
    const activeSectionSubs = selectedSection?.subcategories || []

    return (
      <div className="mb-6 flex flex-col gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          <button
            type="button"
            onClick={() => handleSectionSelect('all')}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${activeSectionId === 'all'
                ? 'bg-neutral-900 text-white shadow-sm scale-[1.02]'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70'
              }`}
          >
            All Categories
          </button>
          {menu.sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => handleSectionSelect(section.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${activeSectionId === section.id
                  ? 'bg-green-600 text-white shadow-sm scale-[1.02]'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70'
                }`}
            >
              {section.title || 'Untitled Section'}
            </button>
          ))}
        </div>

        {/* Subcategory Tabs */}
        {activeSectionId !== 'all' && activeSectionSubs.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none border-t border-dashed border-neutral-200 pt-3">
            <button
              type="button"
              onClick={() => setActiveSubcategoryId('all')}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${activeSubcategoryId === 'all'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'bg-neutral-50 text-neutral-500 border border-neutral-200/40 hover:bg-neutral-100'
                }`}
            >
              All {selectedSection.title}
            </button>
            {activeSectionSubs.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setActiveSubcategoryId(sub.id)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${activeSubcategoryId === sub.id
                    ? 'bg-green-100 text-green-800 border border-green-200 font-semibold'
                    : 'bg-neutral-50 text-neutral-500 border border-neutral-200/40 hover:bg-neutral-100'
                  }`}
              >
                {sub.title || 'Untitled Sub'}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Filter sections and subcategories for rendering
  const filteredSections = menu.sections.map((section) => {
    if (activeSectionId !== 'all' && section.id !== activeSectionId) {
      return null
    }
    if (section.subcategories && section.subcategories.length > 0) {
      if (activeSubcategoryId !== 'all') {
        return {
          ...section,
          subcategories: section.subcategories.filter((sub) => sub.id === activeSubcategoryId)
        }
      }
    }
    return section
  }).filter(Boolean)

  const filteredMenu = {
    ...menu,
    sections: filteredSections
  }

  const renderChefItem = (item) => (
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
  )

  const renderMinimalItem = (item) => (
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
  )

  if (menu.templateId === 'chef-signature') {
    return (
      <div className="rounded-2xl border border-neutral-300 bg-neutral-100/70 p-5 sm:p-7">
        <div className="border-b border-neutral-300 pb-4 mb-5">
          <h4 className="text-2xl font-semibold text-neutral-900">{menu.restaurantName || 'Untitled Restaurant'}</h4>
          {(menu.restaurantAddress || menu.restaurantPhone || menu.restaurantWebsite) && (
            <div className="mt-2 text-sm text-neutral-600 space-y-0.5">
              {menu.restaurantAddress && <p>{menu.restaurantAddress}</p>}
              {menu.restaurantPhone && <p>{menu.restaurantPhone}</p>}
              {menu.restaurantWebsite && (
                <p>
                  <a href={menu.restaurantWebsite.startsWith('http') ? menu.restaurantWebsite : `https://${menu.restaurantWebsite}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700 hover:underline transition">
                    {menu.restaurantWebsite}
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
        {renderFilterTabs()}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {filteredMenu.sections.map((section) => (
            <section key={section.id} className="rounded-xl border border-neutral-300 bg-white p-4">
              <h5 className="text-lg font-semibold text-neutral-900 border-b border-neutral-100 pb-1.5">{section.title}</h5>
              <div className="mt-3 space-y-4">
                {section.subcategories && section.subcategories.length > 0 ? (
                  section.subcategories.map((sub) => (
                    <div key={sub.id} className="space-y-2">
                      <h6 className="text-xs font-bold uppercase tracking-wider text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded w-fit">{sub.title}</h6>
                      <div className="space-y-3 pl-2 border-l-2 border-neutral-200">
                        {sub.items.map((item) => renderChefItem(item))}
                      </div>
                    </div>
                  ))
                ) : (
                  section.items.map((item) => renderChefItem(item))
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    )
  }

  if (menu.templateId === 'quick-bites') {
    const renderQuickBitesItem = (item) => (
      <div
        key={item.id}
        className="group relative flex flex-col rounded-2xl overflow-hidden bg-white border border-neutral-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
        style={{ minHeight: '200px' }}
      >
        {/* Item image or gradient placeholder */}
        <div className="relative flex-shrink-0 h-36 overflow-hidden bg-gradient-to-br from-orange-50 to-amber-50">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-10 h-10 text-orange-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
          )}
          {/* Price badge */}
          <span
            className="absolute top-2.5 right-2.5 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm"
            style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', letterSpacing: '0.02em' }}
          >
            {formatPrice(item.price)}
          </span>
        </div>

        {/* Item info */}
        <div className="flex flex-col justify-between flex-1 p-3 gap-2">
          <div>
            <p className="font-semibold text-neutral-900 text-sm leading-tight line-clamp-1">
              {item.name || 'Untitled Item'}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2 leading-relaxed">
              {item.description || 'No description'}
            </p>
          </div>
          {canOrder && (
            <button
              type="button"
              onClick={() => onAddToCart(item)}
              className="self-end w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-base transition-all duration-200 hover:scale-110 active:scale-95 shadow-md"
              style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}
              title={`Add ${item.name || 'item'} to cart`}
            >
              +
            </button>
          )}
        </div>
      </div>
    )

    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(160deg,#111827 0%,#1f2937 100%)', border: '1px solid #374151' }}
      >
        {/* Dark gradient header */}
        <div className="px-6 pt-6 pb-5 flex flex-col items-center text-center">
          <h4 className="text-2xl font-bold text-white leading-tight">{menu.restaurantName || 'Untitled Restaurant'}</h4>
          {(menu.restaurantAddress || menu.restaurantPhone || menu.restaurantWebsite) && (
            <div className="mt-2 text-sm text-neutral-400 space-y-0.5">
              {menu.restaurantAddress && <p>{menu.restaurantAddress}</p>}
              {menu.restaurantPhone && <p>{menu.restaurantPhone}</p>}
              {menu.restaurantWebsite && (
                <p>
                  <a href={menu.restaurantWebsite.startsWith('http') ? menu.restaurantWebsite : `https://${menu.restaurantWebsite}`} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 hover:underline transition">
                    {menu.restaurantWebsite}
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Dark-variant filter tabs */}
          <div className="mt-5 w-full">
            {(() => {
              if (!menu.sections || menu.sections.length === 0) return null
              const selectedSection = menu.sections.find((s) => s.id === activeSectionId)
              const activeSectionSubs = selectedSection?.subcategories || []
              return (
                <div className="flex flex-col gap-2.5">
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => handleSectionSelect('all')}
                      className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-200"
                      style={
                        activeSectionId === 'all'
                          ? { background: '#f97316', color: '#fff', boxShadow: '0 2px 8px rgba(249,115,22,0.4)' }
                          : { background: 'rgba(255,255,255,0.08)', color: '#d1d5db' }
                      }
                    >
                      All
                    </button>
                    {menu.sections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => handleSectionSelect(section.id)}
                        className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-200"
                        style={
                          activeSectionId === section.id
                            ? { background: '#f97316', color: '#fff', boxShadow: '0 2px 8px rgba(249,115,22,0.4)' }
                            : { background: 'rgba(255,255,255,0.08)', color: '#d1d5db' }
                        }
                      >
                        {section.title}
                      </button>
                    ))}
                  </div>
                  {activeSectionId !== 'all' && activeSectionSubs.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                      <button
                        type="button"
                        onClick={() => setActiveSubcategoryId('all')}
                        className="flex-shrink-0 px-3.5 py-1 rounded-full text-xs font-medium transition-all duration-200"
                        style={
                          activeSubcategoryId === 'all'
                            ? { background: '#16a34a', color: '#fff' }
                            : { background: 'rgba(255,255,255,0.07)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }
                        }
                      >
                        All {selectedSection.title}
                      </button>
                      {activeSectionSubs.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setActiveSubcategoryId(sub.id)}
                          className="flex-shrink-0 px-3.5 py-1 rounded-full text-xs font-medium transition-all duration-200"
                          style={
                            activeSubcategoryId === sub.id
                              ? { background: '#16a34a', color: '#fff' }
                              : { background: 'rgba(255,255,255,0.07)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }
                          }
                        >
                          {sub.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>

        {/* Light card grid area */}
        <div className="bg-neutral-50 px-5 py-5 rounded-b-2xl">
          {filteredMenu.sections.map((section) => (
            <div key={section.id} className="mb-6 last:mb-0">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#f97316' }} />
                <h5 className="text-sm font-bold uppercase tracking-widest text-neutral-500">{section.title}</h5>
                <div className="flex-1 h-px bg-neutral-200" />
              </div>
              {section.subcategories && section.subcategories.length > 0 ? (
                section.subcategories.map((sub) => (
                  <div key={sub.id} className="mb-5 last:mb-0">
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3 px-2 py-0.5 rounded w-fit"
                      style={{ color: '#16a34a', background: '#f0fdf4' }}
                    >
                      {sub.title}
                    </p>
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                      {sub.items.map((item) => renderQuickBitesItem(item))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                  {section.items.map((item) => renderQuickBitesItem(item))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }


  return (
    <div className="rounded-2xl border border-neutral-300 bg-white p-5 sm:p-7">
      <div className="border-b border-dashed border-neutral-300 pb-4 text-center mb-5">
        <h4 className="text-2xl font-semibold text-neutral-900">{menu.restaurantName || 'Untitled Restaurant'}</h4>
        {(menu.restaurantAddress || menu.restaurantPhone || menu.restaurantWebsite) && (
          <div className="mt-2 text-sm text-neutral-500 space-y-0.5 flex flex-col items-center">
            {menu.restaurantAddress && <p>{menu.restaurantAddress}</p>}
            {menu.restaurantPhone && <p>{menu.restaurantPhone}</p>}
            {menu.restaurantWebsite && (
              <p>
                <a href={menu.restaurantWebsite.startsWith('http') ? menu.restaurantWebsite : `https://${menu.restaurantWebsite}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700 hover:underline transition">
                  {menu.restaurantWebsite}
                </a>
              </p>
            )}
          </div>
        )}
      </div>
      {renderFilterTabs()}
      <div className="mt-5 space-y-5">
        {filteredMenu.sections.map((section) => (
          <section key={section.id}>
            <h5 className="border-b border-neutral-300 pb-2 text-lg font-semibold text-neutral-900">{section.title}</h5>
            <div className="mt-3 space-y-4">
              {section.subcategories && section.subcategories.length > 0 ? (
                section.subcategories.map((sub) => (
                  <div key={sub.id} className="space-y-2">
                    <h6 className="text-xs font-bold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded w-fit">{sub.title}</h6>
                    <div className="space-y-3 pl-1.5 border-l border-neutral-200">
                      {sub.items.map((item) => renderMinimalItem(item))}
                    </div>
                  </div>
                ))
              ) : (
                section.items.map((item) => renderMinimalItem(item))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

// Toggle moved to components/Toggle.jsx

// ─── Editor (Main Dashboard) ──────────────────────────────────────────────────
// ── Menu Builder Inline Panel ───────────────────────────────────────────────────
function BuilderInlinePanel({ draftMenu, saveMenu, isSaving, setShowBuilder, saveStatus, updateDraft, menuTemplates, selectedTemplateId, loadTemplate, addSection, updateSectionField, removeSection, removeSubcategory, addSubcategory, updateSubcategoryTitle, restaurantSettings, currencySymbol, restaurantId, updateSectionList, isSupabaseConfigured, uploadMenuItemImage }) {
  const [activeTab, setActiveTab] = useState('items') // 'items' | 'setup'
  const [editingItem, setEditingItem] = useState(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [uploadingItemImage, setUploadingItemImage] = useState({})
  const [expandedSubcategories, setExpandedSubcategories] = useState({})

  const toggleSubcategory = (subcategoryId) => {
    setExpandedSubcategories((prev) => ({
      ...prev,
      [subcategoryId]: !prev[subcategoryId]
    }))
  }

  const handleSaveItem = (e) => {
    e.preventDefault()
    if (!editingItem) return
    if (!editingItem.name.trim()) {
      alert('Please enter an item name.')
      return
    }
    if (!editingItem.sectionId) {
      alert('Please select a category/section.')
      return
    }

    const { id, name, description, price, imageUrl, sectionId, subcategoryId } = editingItem

    updateSectionList((sections) => {
      // 1. Remove the item from its current location
      let cleanedSections = sections.map((s) => {
        const nextItems = s.items ? s.items.filter((it) => it.id !== id) : []
        const nextSubs = s.subcategories ? s.subcategories.map((sub) => ({
          ...sub,
          items: sub.items ? sub.items.filter((it) => it.id !== id) : []
        })) : []
        return { ...s, items: nextItems, subcategories: nextSubs }
      })

      // 2. Add the item to the new target section / subcategory
      return cleanedSections.map((s) => {
        if (s.id !== sectionId) return s

        if (subcategoryId) {
          return {
            ...s,
            subcategories: (s.subcategories || []).map((sub) => {
              if (sub.id !== subcategoryId) return sub
              return {
                ...sub,
                items: [...(sub.items || []), { id, name, description, price, imageUrl }]
              }
            })
          }
        } else {
          return {
            ...s,
            items: [...(s.items || []), { id, name, description, price, imageUrl }]
          }
        }
      })
    })

    setEditingItem(null)
    setIsAddingNew(false)
  }

  const handleDeleteItem = (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return
    updateSectionList((sections) => {
      return sections.map((s) => {
        const nextItems = s.items ? s.items.filter((it) => it.id !== itemId) : []
        const nextSubs = s.subcategories ? s.subcategories.map((sub) => ({
          ...sub,
          items: sub.items ? sub.items.filter((it) => it.id !== itemId) : []
        })) : []
        return { ...s, items: nextItems, subcategories: nextSubs }
      })
    })
  }

  const renderListItemRow = (item, sectionId, subcategoryId) => {
    return (
      <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 hover:border-green-300 bg-white hover:bg-neutral-50/50 shadow-sm transition duration-150 mb-2 group">
        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-semibold text-neutral-800 text-sm truncate">{item.name || 'Untitled Item'}</h4>
            <span className="text-sm font-bold text-neutral-900">{currencySymbol}{item.price || '0.00'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition duration-150 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditingItem({
                id: item.id,
                name: item.name,
                description: item.description,
                price: item.price,
                imageUrl: item.imageUrl,
                sectionId: sectionId,
                subcategoryId: subcategoryId || ''
              })
              setIsAddingNew(false)
            }}
            className="p-1 rounded-lg text-neutral-500 hover:text-green-600 hover:bg-green-50 transition"
            title="Edit Item"
          >
            <IconEdit className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteItem(item.id)}
            className="p-1 rounded-lg text-neutral-500 hover:text-red-600 hover:bg-red-50 transition"
            title="Delete Item"
          >
            <IconTrash className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Menu Workspace</p>
          <h2 className="mt-0.5 text-base font-bold text-neutral-900 truncate max-w-[180px]">
            {draftMenu?.menuTitle || 'Untitled Menu'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveMenu}
            disabled={!draftMenu || isSaving}
            className="btn-green text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setShowBuilder(false)}
            className="btn-ghost p-1.5 rounded-lg border-neutral-200"
            title="Close Builder"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      {saveStatus && (
        <div className="px-5 py-2 text-xs border-b font-medium text-green-700 bg-green-50/50 border-neutral-100 flex items-center justify-between">
          <span className="truncate">{saveStatus}</span>
        </div>
      )}

      {/* Tab Buttons */}
      <div className="flex border-b border-neutral-100 bg-neutral-50/50 p-1 gap-1">
        <button
          type="button"
          onClick={() => { setActiveTab('items'); setEditingItem(null); setIsAddingNew(false) }}
          className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition duration-150 ${activeTab === 'items' ? 'bg-green-600 text-white shadow-xs' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
        >
          Menu Items
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('setup'); setEditingItem(null); setIsAddingNew(false) }}
          className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition duration-150 ${activeTab === 'setup' ? 'bg-green-600 text-white shadow-xs' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
        >
          Menu Setup
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'items' && (
          <div className="space-y-4">
            {editingItem ? (
              /* Inline Add/Edit Form */
              <form onSubmit={handleSaveItem} className="border border-green-200 bg-green-50/10 rounded-2xl p-4 space-y-4">
                <h3 className="font-bold text-sm text-neutral-800 border-b pb-2 mb-2 flex items-center justify-between">
                  <span>{isAddingNew ? '✨ Add New Item' : '📝 Edit Item'}</span>
                  <button
                    type="button"
                    onClick={() => { setEditingItem(null); setIsAddingNew(false) }}
                    className="text-xs text-neutral-400 hover:text-neutral-600"
                  >
                    Cancel
                  </button>
                </h3>

                {/* Name & Price */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-neutral-700">Item Name</span>
                      <input
                        value={editingItem.name}
                        onChange={(e) => setEditingItem(prev => ({ ...prev, name: e.target.value }))}
                        className="input-field text-sm py-1.5 px-3 bg-white"
                        placeholder="e.g. Garlic Pizza"
                        required
                      />
                    </label>
                  </div>
                  <div>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-neutral-700">Price</span>
                      <div className="input-wrapper py-1 bg-white">
                        <span className="text-xs font-medium text-neutral-500 mr-1">{currencySymbol}</span>
                        <input
                          value={editingItem.price}
                          onChange={(e) => {
                            let val = e.target.value.replace(/[^0-9.]/g, '')
                            const parts = val.split('.')
                            if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('')
                            setEditingItem(prev => ({ ...prev, price: val }))
                          }}
                          placeholder="0.00"
                          className="w-full text-sm outline-none bg-transparent"
                          required
                        />
                      </div>
                    </label>
                  </div>
                </div>

                {/* Category Selection */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-neutral-700">Category</span>
                      <select
                        value={editingItem.sectionId}
                        onChange={(e) => {
                          const secId = e.target.value
                          const section = draftMenu.sections.find(s => s.id === secId)
                          const defaultSubId = section?.subcategories?.[0]?.id || ''
                          setEditingItem(prev => ({
                            ...prev,
                            sectionId: secId,
                            subcategoryId: defaultSubId
                          }))
                        }}
                        className="input-field text-xs py-1.5 px-3 bg-white"
                      >
                        {draftMenu.sections.map(sec => (
                          <option key={sec.id} value={sec.id}>{sec.title}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Subcategory */}
                  {(() => {
                    const selectedSection = draftMenu.sections.find(s => s.id === editingItem.sectionId)
                    if (!selectedSection || !selectedSection.subcategories || selectedSection.subcategories.length === 0) return null
                    return (
                      <div>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-neutral-700">Subcategory</span>
                          <select
                            value={editingItem.subcategoryId}
                            onChange={(e) => setEditingItem(prev => ({ ...prev, subcategoryId: e.target.value }))}
                            className="input-field text-xs py-1.5 px-3 bg-white"
                          >
                            <option value="">None (Direct Item)</option>
                            {selectedSection.subcategories.map(sub => (
                              <option key={sub.id} value={sub.id}>{sub.title}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )
                  })()}
                </div>

                {/* Description */}
                <div>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-neutral-700">Description</span>
                    <textarea
                      value={editingItem.description}
                      onChange={(e) => setEditingItem(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                      className="input-field text-xs py-1.5 px-3 bg-white"
                      placeholder="Ingredients, dietary details, or allergy info"
                    />
                  </label>
                </div>

                {/* Image Upload */}
                <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-neutral-200">
                  <div className="flex-shrink-0">
                    {editingItem.imageUrl ? (
                      <div className="relative group w-16 h-16 rounded-lg overflow-hidden border border-neutral-300">
                        <img src={editingItem.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setEditingItem(prev => ({ ...prev, imageUrl: '' }))}
                          className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          title="Remove image"
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label
                        className={`w-16 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition ${uploadingItemImage[editingItem.id]
                            ? 'border-neutral-300 bg-neutral-100'
                            : !isSupabaseConfigured || !restaurantId
                              ? 'border-neutral-200 bg-neutral-100/50 cursor-not-allowed opacity-50'
                              : 'border-neutral-300 hover:border-green-500 bg-white hover:bg-neutral-50'
                          }`}
                      >
                        {uploadingItemImage[editingItem.id] ? (
                          <span className="text-[9px] text-neutral-500 animate-pulse font-medium">Uploading...</span>
                        ) : (
                          <>
                            <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="text-[9px] text-neutral-400 font-semibold mt-0.5">Upload</span>
                          </>
                        )}
                        {isSupabaseConfigured && restaurantId && (
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingItemImage[editingItem.id]}
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              if (file.size > 1024 * 1024) {
                                alert('Image size exceeds 1 MB limit. Please upload a smaller image.')
                                return
                              }
                              try {
                                setUploadingItemImage(prev => ({ ...prev, [editingItem.id]: true }))
                                const url = await uploadMenuItemImage(restaurantId, editingItem.id, file)
                                setEditingItem(prev => ({ ...prev, imageUrl: url }))
                              } catch (err) {
                                alert(err.message || 'Failed to upload image')
                              } finally {
                                setUploadingItemImage(prev => ({ ...prev, [editingItem.id]: false }))
                              }
                            }}
                          />
                        )}
                      </label>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-neutral-700">Image Thumbnail</span>
                    <span className="block text-[10px] text-neutral-500 mt-0.5 leading-normal">
                      Max 1MB size. Fits square preview.
                    </span>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => { setEditingItem(null); setIsAddingNew(false) }}
                    className="btn-ghost text-xs px-3 py-1.5 border-neutral-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-green text-xs px-4 py-1.5"
                  >
                    {isAddingNew ? 'Add Item' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              /* Main List View */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Item Listings</h3>
                  <button
                    type="button"
                    onClick={() => {
                      if (draftMenu.sections.length === 0) {
                        alert('Please add a section/category under Setup tab first.')
                        return
                      }
                      setEditingItem({
                        id: createId('itm'),
                        name: '',
                        description: '',
                        price: '',
                        imageUrl: '',
                        sectionId: draftMenu.sections[0].id,
                        subcategoryId: ''
                      })
                      setIsAddingNew(true)
                    }}
                    className="btn-green text-xs py-1.5 px-3 rounded-lg flex items-center gap-1"
                  >
                    <IconPlus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                {/* Grouped Listings */}
                {draftMenu?.sections.length === 0 ? (
                  <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                    <p className="text-neutral-400 text-sm">No sections created yet.</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('setup')}
                      className="mt-2 text-xs font-semibold text-green-600 hover:underline"
                    >
                      Go to Setup to add categories
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {draftMenu.sections.map((section) => {
                      const directItems = section.items || []
                      const subcategories = section.subcategories || []

                      const hasItems = directItems.length > 0 || subcategories.some(sub => sub.items && sub.items.length > 0)

                      return (
                        <div key={section.id} className="bg-neutral-50/50 border border-neutral-100 rounded-xl p-3.5">
                          {/* Section Title */}
                          <div className="flex items-center justify-between border-b border-neutral-200/60 pb-1.5 mb-2.5">
                            <h4 className="font-bold text-xs text-neutral-700 tracking-wider uppercase">{section.title}</h4>
                          </div>

                          {/* Direct items */}
                          {directItems.map(item => renderListItemRow(item, section.id, null))}

                          {/* Subcategories */}
                          {subcategories.map(sub => {
                            const isExpanded = expandedSubcategories[sub.id]
                            const itemCount = sub.items?.length || 0

                            return (
                              <div key={sub.id} className="mt-3 rounded-xl border border-neutral-200/80 bg-white">
                                <button
                                  type="button"
                                  onClick={() => toggleSubcategory(sub.id)}
                                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-xs font-bold text-neutral-700 uppercase tracking-widest bg-neutral-50 hover:bg-neutral-100 rounded-t-xl"
                                >
                                  <span>{sub.title}</span>
                                  <span className="flex items-center gap-2 text-neutral-500">
                                    <span className="text-[10px] font-medium">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                                    <span className="text-sm">{isExpanded ? '▾' : '▸'}</span>
                                  </span>
                                </button>
                                {isExpanded && (
                                  <div className="space-y-2 px-3 py-2 border-t border-neutral-200/80">
                                    {sub.items && sub.items.length > 0 ? (
                                      sub.items.map(item => renderListItemRow(item, section.id, sub.id))
                                    ) : (
                                      <p className="text-[10px] text-neutral-400 italic">No items here.</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}

                          {!hasItems && (
                            <p className="text-[11px] text-neutral-400 italic text-center py-2">No items in this category yet.</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="space-y-5">
            {/* Restaurant Name & Menu Title */}
            <div className="grid grid-cols-2 gap-3 bg-neutral-50/30 p-3.5 rounded-xl border border-neutral-200/60">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-neutral-700">Restaurant Name</span>
                <input
                  value={draftMenu.restaurantName}
                  onChange={(e) => updateDraft((d) => ({ ...d, restaurantName: e.target.value }))}
                  className="input-field text-xs py-1.5 px-3 bg-white"
                  placeholder="Name of restaurant"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-neutral-700">Menu Title</span>
                <input
                  value={draftMenu.menuTitle}
                  onChange={(e) => updateDraft((d) => ({ ...d, menuTitle: e.target.value }))}
                  className="input-field text-xs py-1.5 px-3 bg-white"
                  placeholder="e.g. Dinner Menu"
                />
              </label>
            </div>

            {/* Notes */}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-700">Menu Notes</span>
              <textarea
                value={draftMenu.notes}
                onChange={(e) => updateDraft((d) => ({ ...d, notes: e.target.value }))}
                rows={2}
                className="input-field text-xs py-1.5 px-3 bg-white"
                placeholder="Optional timing details or highlights"
              />
            </label>

            {/* Template Selector */}
            <div>
              <span className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Select Template</span>
              <div className="grid grid-cols-3 gap-2">
                {menuTemplates.map((template) => {
                  const isActive = template.id === selectedTemplateId
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => loadTemplate(template.id)}
                      className={`rounded-xl border p-2.5 text-left transition duration-150 flex flex-col justify-between h-[80px] ${isActive
                        ? 'border-green-500 bg-green-50/40 text-green-900'
                        : 'border-neutral-200 bg-white text-neutral-800 hover:border-green-300'
                        }`}
                    >
                      <p className="text-xs font-bold truncate w-full">{template.label}</p>
                      <p className="text-[9px] text-neutral-500 leading-normal line-clamp-2 mt-1">{template.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Category / Section Management */}
            <div className="space-y-3 pt-3 border-t border-neutral-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Categories / Sections</span>
                <button
                  type="button"
                  onClick={addSection}
                  className="text-xs font-semibold text-green-700 hover:text-green-800 flex items-center gap-0.5"
                >
                  <IconPlus className="w-3.5 h-3.5" /> Add Category
                </button>
              </div>

              <div className="space-y-3">
                {draftMenu.sections.map((section) => (
                  <div key={section.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={section.title}
                        onChange={(e) => updateSectionField(section.id, e.target.value)}
                        className="input-field text-xs font-semibold flex-1 py-1.5 px-3 bg-white"
                        placeholder="Category Title"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (draftMenu.sections.length <= 1) {
                            alert('You must have at least one category.')
                            return
                          }
                          if (window.confirm(`Delete "${section.title}" category? All items inside will be deleted.`)) {
                            removeSection(section.id)
                          }
                        }}
                        className="p-1.5 text-neutral-400 hover:text-red-500 transition"
                        title="Delete Category"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Subcategories */}
                    <div className="pl-3 border-l-2 border-neutral-300 space-y-2">
                      {section.subcategories?.map(sub => (
                        <div key={sub.id} className="flex items-center gap-1.5">
                          <input
                            value={sub.title}
                            onChange={(e) => updateSubcategoryTitle(section.id, sub.id, e.target.value)}
                            className="input-field text-[11px] font-medium flex-1 py-1 px-2.5 bg-white"
                            placeholder="Subcategory Name"
                          />
                          <button
                            type="button"
                            onClick={() => removeSubcategory(section.id, sub.id)}
                            className="text-neutral-400 hover:text-red-500 font-bold px-1"
                            title="Delete Subcategory"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addSubcategory(section.id)}
                        className="text-[10px] font-semibold text-neutral-500 hover:text-green-600 flex items-center gap-0.5 mt-1"
                      >
                        <IconPlus className="w-3 h-3" /> Add Subcategory
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Collapsible Accordion */}
            <div className="pt-3 border-t border-neutral-100">
              <details className="group border border-neutral-200 rounded-xl bg-white overflow-hidden">
                <summary className="flex items-center justify-between p-3 text-xs font-bold text-neutral-700 bg-neutral-50 cursor-pointer select-none">
                  <span>Live Preview Mockup</span>
                  <span className="text-neutral-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-3 border-t border-neutral-200 max-h-[400px] overflow-y-auto bg-neutral-100/30">
                  <TemplateMenuPreview menu={{ ...draftMenu, restaurantAddress: restaurantSettings?.address, restaurantPhone: restaurantSettings?.phone, restaurantWebsite: restaurantSettings?.website }} currencySymbol={currencySymbol} />
                </div>
              </details>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}





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
  const [tableTrackingEnabled, setTableTrackingEnabled] = useState(false)
  const [tableCount, setTableCount] = useState(0)
  const [isRestaurantLoading, setIsRestaurantLoading] = useState(false)
  const [isRestaurantUpdating, setIsRestaurantUpdating] = useState(false)
  const restaurantId = profile?.restaurantId || null

  // Waiter codes state
  const [waiterCodes, setWaiterCodes] = useState([])
  const [isWaiterCodesLoading, setIsWaiterCodesLoading] = useState(false)
  const [isWaiterCodesUpdating, setIsWaiterCodesUpdating] = useState(false)

  // Auth
  useEffect(() => {
    if (auth) return onAuthStateChanged(auth, setUser)
  }, [])

  //toggle service fee
  const handleToggleServiceFee = async () => {

    if (!restaurantId || !restaurantSettings)
      return


    const next =
      !restaurantSettings.serviceFeeEnabled


    setRestaurantSettings(c => ({
      ...c,
      serviceFeeEnabled: next
    }))


    await saveRestaurantSettings(
      restaurantId,
      {
        ...restaurantSettings,
        serviceFeeEnabled: next
      }
    )

  }

  //Handle Service Fee Percentage in settings dashboard
  const handleServiceFeePercentageChange =
    async (value) => {

      if (!restaurantId || !restaurantSettings)
        return


      setRestaurantSettings(c => ({
        ...c,
        serviceFeePercentage: value
      }))


      await saveRestaurantSettings(
        restaurantId,
        {
          ...restaurantSettings,
          serviceFeePercentage: value
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
      } else {
        const defaults = {
          name: '',
          slug: '',
          website: '',
          isActive: true,
          allowOnlineOrders: false,
          serviceFeeEnabled: false,
          serviceFeePercentage: 10,
          tableTrackingEnabled: false,
          tableCount: 0

        }
        setRestaurantSettings(defaults)
        await saveRestaurantSettings(restaurantId, defaults)
      }
      setIsRestaurantLoading(false)
    }
    loadSettings()
    return () => { isActive = false }
  }, [restaurantId, profile])

  // Load waiter codes
  useEffect(() => {
    let isActive = true
    const loadWaiterCodes = async () => {
      if (!restaurantId) {
        setWaiterCodes([])
        return
      }
      setIsWaiterCodesLoading(true)
      const codes = await getWaiterCodes(restaurantId)
      if (isActive) {
        setWaiterCodes(codes)
        setIsWaiterCodesLoading(false)
      }
    }
    loadWaiterCodes()
    return () => {
      isActive = false
    }
  }, [restaurantId])

  const handleAddWaiterCode = async (code) => {
    if (!restaurantId) return
    setIsWaiterCodesUpdating(true)
    const success = await addWaiterCode(restaurantId, code)
    if (success) {
      const updated = await getWaiterCodes(restaurantId)
      setWaiterCodes(updated)
    } else {
      alert('Failed to add waiter code.')
    }
    setIsWaiterCodesUpdating(false)
  }

  const handleDeleteWaiterCode = async (code) => {
    if (!restaurantId) return
    setIsWaiterCodesUpdating(true)
    const success = await deleteWaiterCode(restaurantId, code)
    if (success) {
      const updated = await getWaiterCodes(restaurantId)
      setWaiterCodes(updated)
    } else {
      alert('Failed to delete waiter code.')
    }
    setIsWaiterCodesUpdating(false)
  }


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
  const handleToggleTableTracking = async () => {
    if (!restaurantId || !restaurantSettings)
      return
    const next =
      !tableTrackingEnabled
    setTableTrackingEnabled(next)
    const updated = {
      ...restaurantSettings,
      tableTrackingEnabled: next,
      tableCount:
        next ? tableCount : 0
    }
    setRestaurantSettings(updated)
    await saveRestaurantSettings(
      restaurantId,
      updated
    )
  }
  const handleTableCountChange = async (value) => {
    const count =
      Number(value)
    setTableCount(count)
    const updated = {
      ...restaurantSettings,
      tableTrackingEnabled: true,
      tableCount: count
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

    const normalizedSlug = (newSlug || '').trim().toLowerCase()
    if (!normalizedSlug) {
      throw new Error('Slug cannot be empty.')
    }

    const isAvailable = await isRestaurantSlugAvailable(restaurantId, normalizedSlug)
    if (!isAvailable) {
      throw new Error('This slug already exists. Please choose another one.')
    }

    setRestaurantSettings((c) => ({ ...c, slug: normalizedSlug }))
    setIsRestaurantUpdating(true)
    await saveRestaurantSettings(restaurantId, { ...restaurantSettings, slug: normalizedSlug })
    setIsRestaurantUpdating(false)
  }

  const handleRestaurantAddressChange = async (newAddress) => {
    if (!restaurantId || !restaurantSettings) return
    setRestaurantSettings((c) => ({ ...c, address: newAddress }))
    setIsRestaurantUpdating(true)
    await saveRestaurantSettings(restaurantId, { ...restaurantSettings, address: newAddress })
    setIsRestaurantUpdating(false)
  }

  const handleRestaurantPhoneChange = async (newPhone) => {
    if (!restaurantId || !restaurantSettings) return
    setRestaurantSettings((c) => ({ ...c, phone: newPhone }))
    setIsRestaurantUpdating(true)
    await saveRestaurantSettings(restaurantId, { ...restaurantSettings, phone: newPhone })
    setIsRestaurantUpdating(false)
  }

  const handleRestaurantWebsiteChange = async (newWebsite) => {
    if (!restaurantId || !restaurantSettings) return
    setRestaurantSettings((c) => ({ ...c, website: newWebsite }))
    setIsRestaurantUpdating(true)
    await saveRestaurantSettings(restaurantId, { ...restaurantSettings, website: newWebsite })
    setIsRestaurantUpdating(false)
  }

  const handleDisplayNameChange = async (newDisplayName) => {
    if (!user) return
    setProfile((c) => ({ ...c, ownerName: newDisplayName }))
    setIsRestaurantUpdating(true)
    await saveUserProfile(user.uid, { ownerName: newDisplayName })
    setIsRestaurantUpdating(false)
  }

  const handleUpdateBackupDatabase = async (backupConfig) => {
    if (!user) return
    setProfile((c) => ({ ...c, backupDatabase: backupConfig }))
    setIsRestaurantUpdating(true)
    await saveUserProfile(user.uid, { backupDatabase: backupConfig })
    setIsRestaurantUpdating(false)
  }



  const currencySymbol = restaurantSettings?.currency === 'LKR' ? 'Rs. ' : '$'

  const selectedTemplate = useMemo(() => findTemplateById(selectedTemplateId), [selectedTemplateId])
  const preferredRestaurantName = useMemo(() =>
    restaurantSettings?.name?.trim() || '', [restaurantSettings])
  const draftItemCount = useMemo(() => {
    if (!draftMenu) return 0
    return draftMenu.sections.reduce((count, section) => {
      if (section.subcategories && section.subcategories.length > 0) {
        return count + section.subcategories.reduce((subCount, sub) => subCount + (sub.items?.length || 0), 0)
      }
      return count + (section.items?.length || 0)
    }, 0)
  }, [draftMenu])

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

  const addSubcategory = (sectionId) => {
    updateSectionList((sections) => sections.map((s) => {
      if (s.id !== sectionId) return s
      const newSub = {
        id: createId('subcategory'),
        title: 'New Subcategory',
        items: [createEmptyItem()]
      }

      // Migrate existing direct items to a "General" subcategory first if they exist
      if (s.items && s.items.length > 0) {
        const generalSub = {
          id: createId('subcategory'),
          title: 'General',
          items: s.items
        }
        return {
          ...s,
          items: [],
          subcategories: [generalSub, newSub]
        }
      }

      const existingSubs = s.subcategories || []
      return {
        ...s,
        items: [],
        subcategories: [...existingSubs, newSub]
      }
    }))
  }

  const removeSubcategory = (sectionId, subcategoryId) => {
    updateSectionList((sections) => sections.map((s) => {
      if (s.id !== sectionId) return s
      const nextSubs = (s.subcategories || []).filter((sub) => sub.id !== subcategoryId)
      if (nextSubs.length === 0) {
        return {
          ...s,
          subcategories: [],
          items: [createEmptyItem()]
        }
      }
      return {
        ...s,
        subcategories: nextSubs
      }
    }))
  }

  const updateSubcategoryTitle = (sectionId, subcategoryId, title) => {
    updateSectionList((sections) => sections.map((s) => {
      if (s.id !== sectionId) return s
      return {
        ...s,
        subcategories: (s.subcategories || []).map((sub) =>
          sub.id === subcategoryId ? { ...sub, title } : sub
        )
      }
    }))
  }

  const addSubcategoryItem = (sectionId, subcategoryId) => {
    updateSectionList((sections) => sections.map((s) => {
      if (s.id !== sectionId) return s
      return {
        ...s,
        subcategories: (s.subcategories || []).map((sub) =>
          sub.id === subcategoryId
            ? { ...sub, items: [...sub.items, createEmptyItem()] }
            : sub
        )
      }
    }))
  }

  const removeSubcategoryItem = (sectionId, subcategoryId, itemId) => {
    updateSectionList((sections) => sections.map((s) => {
      if (s.id !== sectionId) return s
      return {
        ...s,
        subcategories: (s.subcategories || []).map((sub) => {
          if (sub.id !== subcategoryId) return sub
          if (sub.items.length <= 1) return sub
          return { ...sub, items: sub.items.filter((item) => item.id !== itemId) }
        })
      }
    }))
  }

  const updateSubcategoryItemField = (sectionId, subcategoryId, itemId, fieldName, value) => {
    updateSectionList((sections) => sections.map((s) => {
      if (s.id !== sectionId) return s
      return {
        ...s,
        subcategories: (s.subcategories || []).map((sub) => {
          if (sub.id !== subcategoryId) return sub
          return {
            ...sub,
            items: sub.items.map((item) =>
              item.id === itemId ? { ...item, [fieldName]: value } : item
            )
          }
        })
      }
    }))
  }

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
  const openQrPreview = async (menu) => {
    const slug =
      menu.remoteId || menu.slug
    let qrList = []
    if (restaurantSettings?.tableTrackingEnabled) {
      for (
        let i = 1;
        i <= restaurantSettings.tableCount;
        i++
      ) {
        qrList.push({
          table: i,
          url:
            `${window.location.origin}/menu/${slug}/tableNo-${i}`
        })
      }
    }
    else {
      qrList.push({
        table: null,
        url:
          `${window.location.origin}/menu/${slug}`
      })
    }
    const generated =
      await Promise.all(
        qrList.map(async (q) => ({
          ...q,
          qrDataUrl:
            await QRCode.toDataURL(q.url)
        }))
      )
    setQrPreview({
      menuTitle: menu.menuTitle,
      restaurantName: menu.restaurantName,
      qrs: generated
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
    setActiveSection('dashboard')
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
    setActiveSection('dashboard')
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
    { id: 'analytics', label: 'Analytics', icon: <IconAnalytics /> },
    { id: 'my-menu', label: 'My Menu', icon: <IconMenu /> },
    { id: 'settings', label: 'Settings', icon: <IconSettings /> },
    { id: 'profile', label: 'Profile', icon: <IconProfile /> },
  ]

  const initials = (name) => {
    if (!name) return '?'
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  }



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
        {/* When builder is open, it takes over the full main area */}
        {showBuilder ? (
          <div className="h-screen flex flex-col">
            <BuilderInlinePanel {...{ draftMenu, saveMenu, isSaving, setShowBuilder, saveStatus, updateDraft, menuTemplates, selectedTemplateId, loadTemplate, addSection, updateSectionField, removeSection, removeSubcategory, addSubcategory, updateSubcategoryTitle, restaurantSettings, currencySymbol, restaurantId, updateSectionList, isSupabaseConfigured, uploadMenuItemImage }} />
          </div>
        ) : (
          <>
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
            {activeSection === 'analytics' && <AnalyticsScreen
              profile={profile}
              restaurantSettings={restaurantSettings}
              setActiveSection={setActiveSection}
            />}
            {activeSection === 'settings' && <SettingsScreen
              restaurantSettings={restaurantSettings}
              profile={profile}
              isRestaurantLoading={isRestaurantLoading}
              isRestaurantUpdating={isRestaurantUpdating}
              handleToggleOnlineOrders={handleToggleOnlineOrders}
              handleCurrencyChange={handleCurrencyChange}
              handleRestaurantNameChange={handleRestaurantNameChange}
              handleRestaurantAddressChange={handleRestaurantAddressChange}
              handleRestaurantPhoneChange={handleRestaurantPhoneChange}
              handleRestaurantWebsiteChange={handleRestaurantWebsiteChange}
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
              handleUpdateBackupDatabase={handleUpdateBackupDatabase}
              waiterCodes={waiterCodes}
              isWaiterCodesLoading={isWaiterCodesLoading}
              isWaiterCodesUpdating={isWaiterCodesUpdating}
              onAddWaiterCode={handleAddWaiterCode}
              onDeleteWaiterCode={handleDeleteWaiterCode}
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
          </>
        )}
      </main>

      {/* Menu Builder Drawer */}
      {/* Removed BuilderDrawer since we now use BuilderInlinePanel on the dashboard page */}

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
  const [specialNote, setSpecialNote] = useState('')
  const [activeOrderId, setActiveOrderId] = useState(null)
  const [orderData, setOrderData] = useState(null)
  const [orderError, setOrderError] = useState('')
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [deviceId] = useState(() => getDeviceId())
  const [showCartDrawer, setShowCartDrawer] = useState(false)

  const orderStorageKey = id ? `qr-order-${id}` : null
  const historyStorageKey = id ? `qr-order-history-${id}` : null
  const [orderHistory, setOrderHistory] = useState([])

  // Load history from localStorage
  useEffect(() => {
    if (historyStorageKey) {
      const stored = window.localStorage.getItem(historyStorageKey)
      if (stored) {
        try {
          setOrderHistory(JSON.parse(stored))
        } catch (e) {
          console.error('Error parsing order history:', e)
        }
      }
    }
  }, [historyStorageKey])

  const clearOrder = useCallback(() => {
    if (orderStorageKey) window.localStorage.removeItem(orderStorageKey)
    setActiveOrderId(null)
    setOrderData(null)
  }, [orderStorageKey])

  const subtotal = useMemo(() => {

    if (!orderData?.items) {
      return cartItems.reduce(
        (sum, entry) =>
          sum + parsePrice(entry.price) * entry.qty,
        0
      )
    }


    // Use saved subtotal if available
    if (orderData?.subtotal !== undefined)
      return orderData.subtotal


    // fallback for old orders
    return orderData.items.reduce(
      (sum, entry) =>
        sum +
        parsePrice(entry.price) *
        entry.qty,
      0
    )

  }, [orderData, cartItems])



  const serviceFee = useMemo(() => {

    // Existing orders use saved snapshot
    if (orderData) {
      return Number(orderData.serviceFee || 0)
    }


    // New cart calculation only
    if (!restaurantSettings?.serviceFeeEnabled)
      return 0


    return subtotal *
      (
        Number(restaurantSettings.serviceFeePercentage || 10)
        / 100
      )


  }, [
    subtotal,
    restaurantSettings,
    orderData
  ])



  const orderTotal = useMemo(() => {

    // Existing orders use saved snapshot
    if (orderData) {
      return Number(orderData.totalAmount || 0)
    }


    return subtotal + serviceFee


  }, [
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
    if (!menuData?.restaurantId) return
    const unsubscribe = subscribeToRestaurantSettings(menuData.restaurantId, (settings) => {
      setRestaurantSettings(settings || { allowOnlineOrders: false })
    })
    return () => unsubscribe()
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

  // Save order to history if confirmed
  useEffect(() => {
    if (!orderData || !historyStorageKey) return
    const rawStatus = (orderData.status || '').trim().toLowerCase()
    if (['confirm', 'confirmed'].includes(rawStatus)) {
      setOrderHistory((prevHistory) => {
        const exists = prevHistory.some(o => o.orderId === orderData.id)
        if (exists) return prevHistory

        const newEntry = {
          orderId: orderData.id,
          dateTime: new Date().toLocaleString(),
          items: orderData.items || [],
          totalAmount: Number(orderData.totalAmount || 0),
          currency: orderData.currency || 'USD',
          tableNo: orderData.tableNo || null,
        }
        const updated = [newEntry, ...prevHistory]
        window.localStorage.setItem(historyStorageKey, JSON.stringify(updated))
        return updated
      })
    }
  }, [orderData, historyStorageKey])

  const allowOnlineOrders = Boolean(restaurantSettings?.allowOnlineOrders)
  const rawOrderStatus = (orderData?.status || '').trim().toLowerCase()
  const orderStatus = ['complete', 'completed', 'delivered'].includes(rawOrderStatus)
    ? 'completed'
    : ['confirm', 'confirmed'].includes(rawOrderStatus)
      ? 'confirmed'
      : rawOrderStatus || null
  const hasActiveOrder = Boolean(activeOrderId && !['completed', 'confirmed'].includes(orderStatus))

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
          tableNo.replace("tableNo-", "")
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

      specialNote:
        specialNote.trim(),

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


    if (orderId) {

      if (orderStorageKey) {

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
      setSpecialNote('')

    }
    else {

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
      menu={{ ...menuData, restaurantAddress: restaurantSettings?.address, restaurantPhone: restaurantSettings?.phone, restaurantWebsite: restaurantSettings?.website }}
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
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <p className="text-sm font-bold">Currently Busy</p>
          </div>
          <p className="mt-1 text-xs text-amber-800">
            This restaurant is currently busy and not accepting QR orders at the moment. You can browse the menu below.
          </p>
        </div>
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
              {orderData?.specialNote && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-amber-700">Special note</p>
                  <p className="mt-1 text-sm text-amber-900">{orderData.specialNote}</p>
                </div>
              )}
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

      {allowOnlineOrders && ['completed', 'confirmed'].includes(orderStatus) && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3 text-sm text-neutral-600">
            <p>
              {orderStatus === 'confirmed'
                ? 'Your order is confirmed. You can start a new order anytime.'
                : 'Your order is completed. You can start a new order anytime.'}
            </p>
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
              {orderData?.specialNote && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-amber-700">Special note</p>
                  <p className="mt-1 text-sm text-amber-900">{orderData.specialNote}</p>
                </div>
              )}
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

      {allowOnlineOrders && !hasActiveOrder && !['completed', 'confirmed'].includes(orderStatus) && (
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

          <label className="text-sm text-neutral-600">
            <span className="mb-2 block font-medium text-neutral-900">Special note</span>
            <textarea
              value={specialNote}
              onChange={(e) => setSpecialNote(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-900"
              placeholder="Any allergies, spice preference, or delivery instructions?"
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

  // ── total cart item count for the sticky bar ──────────────────────────────
  const cartTotalItems = cartItems.reduce((sum, e) => sum + e.qty, 0)

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* ── Main scrollable content ─────────────────────────────── */}
      <div className="py-10 px-4 pb-28 md:pb-10">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {/* Busy banner alert */}
          {!allowOnlineOrders && (
            <div className="rounded-2xl border border-amber-400/60 bg-amber-500/10 p-4 text-amber-900 shadow-sm sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-base text-amber-900">Currently Busy - Orders Paused</h4>
                  <p className="text-xs sm:text-sm mt-0.5 text-amber-800">
                    The restaurant is currently busy and not accepting QR orders right now. You can view items, but cannot place an order.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Desktop: keep original order (order card first if active) */}
          <div className="hidden md:flex flex-col gap-6">
            {orderStatus ? (
              <>{orderCardEl}{menuPreviewEl}</>
            ) : (
              <>{menuPreviewEl}{orderCardEl}</>
            )}
          </div>

          {/* Mobile: only the menu, cart is in sticky drawer */}
          <div className="md:hidden">
            {menuPreviewEl}
          </div>

          {/* Order History */}
          {orderHistory.length > 0 && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm">
              <h3 className="text-base font-semibold text-neutral-900 mb-4 flex items-center gap-2 border-b border-neutral-100 pb-3">
                <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Order History
              </h3>
              <div className="space-y-4 divide-y divide-neutral-100">
                {orderHistory.map((historyOrder, idx) => (
                  <div key={historyOrder.orderId} className={idx > 0 ? "pt-4" : ""}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-semibold text-neutral-800">
                          Order #{historyOrder.orderId.slice(-6).toUpperCase()}
                          {historyOrder.tableNo && ` (Table ${historyOrder.tableNo})`}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5">{historyOrder.dateTime}</p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Confirmed
                      </span>
                    </div>
                    <div className="mt-2.5 text-xs text-neutral-600">
                      {historyOrder.items.map((item) => `${item.name} x${item.qty}`).join(', ')}
                    </div>
                    <div className="mt-2 text-xs font-mono font-bold text-neutral-900 text-right">
                      Total: {historyOrder.currency === 'LKR' ? 'Rs. ' : '$'}{historyOrder.totalAmount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky bottom notice when busy (mobile only) ── */}
      {!allowOnlineOrders && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-amber-600 px-4 py-3 text-center text-xs font-bold text-white shadow-lg">
          Currently Busy • QR Orders Disabled
        </div>
      )}

      {/* ── Sticky bottom cart bar (mobile only, ordering enabled) ─ */}
      {allowOnlineOrders && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
          {/* Backdrop when drawer is open */}
          {showCartDrawer && (
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-30"
              onClick={() => setShowCartDrawer(false)}
            />
          )}

          {/* Slide-up drawer */}
          <div
            className="relative z-40 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out"
            style={{ transform: showCartDrawer ? 'translateY(0)' : 'translateY(100%)', position: 'fixed', bottom: 0, left: 0, right: 0 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-neutral-200" />
            </div>

            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 pb-3 pt-1">
              <h3 className="text-base font-bold text-neutral-900">
                {orderStatus ? 'Your order' : 'Your cart'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCartDrawer(false)}
                className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 transition"
                aria-label="Close cart"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer body — scrollable */}
            <div className="overflow-y-auto px-5 pb-6" style={{ maxHeight: '70vh' }}>
              {orderCardEl}
            </div>
          </div>

          {/* Sticky bottom pill / bar (always visible) */}
          {!showCartDrawer && (
            <div
              className="px-4 pb-4 pt-2"
              style={{ background: 'linear-gradient(to top, white 60%, transparent)' }}
            >
              {hasActiveOrder ? (
                /* Active order — show status bar */
                <button
                  type="button"
                  onClick={() => setShowCartDrawer(true)}
                  className="w-full flex items-center justify-between gap-3 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-lg transition-transform active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg,#0f766e,#14b8a6)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex w-6 h-6 rounded-full bg-white/20 items-center justify-center text-xs font-bold">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4" />
                      </svg>
                    </span>
                    <span>View order status</span>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{ background: 'rgba(255,255,255,0.2)' }}
                  >
                    {orderStatus === 'confirmed' ? 'Confirmed' : orderStatus === 'preparing' ? 'Preparing' : orderStatus === 'completed' ? 'Completed' : 'Pending'}
                  </span>
                </button>
              ) : cartTotalItems > 0 ? (
                /* Items in cart — show cart bar */
                <button
                  type="button"
                  onClick={() => setShowCartDrawer(true)}
                  className="w-full flex items-center justify-between gap-3 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-lg transition-transform active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex w-6 h-6 rounded-full bg-white/25 items-center justify-center text-xs font-bold"
                    >
                      {cartTotalItems}
                    </span>
                    <span>View cart</span>
                  </div>
                  <span className="font-mono font-bold">
                    {orderCurrency}{orderTotal.toFixed(2)}
                  </span>
                </button>
              ) : (
                /* Empty cart — show subtle hint */
                <div
                  className="w-full flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm text-neutral-500"
                  style={{ background: 'rgba(255,255,255,0.9)', border: '1px dashed #d1d5db' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Tap items to add to cart</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <Routes>
      <Route path="/" element={<Editor />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/menu/:id/:tableNo" element={<MenuViewer />} />
      <Route path="/menu/:id" element={<MenuViewer />} />
    </Routes>
  )
}

export default App
