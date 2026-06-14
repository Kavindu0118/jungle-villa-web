import {
  setDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

const USERS_COLLECTION = 'users'
const RESTAURANTS_COLLECTION = 'restaurants'
const MENU_SUBCOLLECTION = 'menu'
const CURRENT_MENU_DOC = 'current'
const ORDERS_SUBCOLLECTION = 'orders'

const slugify = (value = '') =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')

const normalizeMenu = ({ restaurantId, restaurantData, menuData }) => ({
  id: restaurantData.slug || restaurantId,
  restaurantId,
  slug: restaurantData.slug || restaurantId,
  restaurantName: restaurantData.name || menuData.restaurantName || 'Untitled Restaurant',
  templateId: menuData.templateId || 'minimal-cafe',
  templateLabel: menuData.templateLabel || 'Minimal Cafe',
  menuTitle: menuData.menuTitle || menuData.title || 'Untitled Menu',
  notes: menuData.notes || '',
  sections: menuData.sections || [],
  isPublished: Boolean(menuData.isPublished),
  updatedAt: menuData.updatedAt || restaurantData.updatedAt || null,
})

const findRestaurantBySlug = async (slug) => {
  const restaurantQuery = query(
    collection(db, RESTAURANTS_COLLECTION),
    where('slug', '==', slug),
    limit(1),
  )
  const snapshot = await getDocs(restaurantQuery)
  if (snapshot.empty) return null
  return snapshot.docs[0]
}

const ensureUniqueRestaurantSlug = async (restaurantName) => {
  const baseSlug = slugify(restaurantName) || `restaurant-${Math.floor(Math.random() * 100000)}`
  let nextSlug = baseSlug

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const existing = await findRestaurantBySlug(nextSlug)
    if (!existing) {
      return nextSlug
    }
    nextSlug = `${baseSlug}-${Math.floor(Math.random() * 1000)}`
  }

  return `${baseSlug}-${Date.now()}`
}

export const getMenuRecord = async (menuId) => {
  if (!isFirebaseConfigured || !db || !menuId) return null

  const byRestaurantIdRef = doc(db, RESTAURANTS_COLLECTION, menuId)
  const byRestaurantIdSnap = await getDoc(byRestaurantIdRef)

  let restaurantId = null
  let restaurantData = null

  if (byRestaurantIdSnap.exists()) {
    restaurantId = byRestaurantIdSnap.id
    restaurantData = byRestaurantIdSnap.data()
  } else {
    const restaurantBySlug = await findRestaurantBySlug(menuId)
    if (!restaurantBySlug) {
      return null
    }
    restaurantId = restaurantBySlug.id
    restaurantData = restaurantBySlug.data()
  }

  const menuRef = doc(db, RESTAURANTS_COLLECTION, restaurantId, MENU_SUBCOLLECTION, CURRENT_MENU_DOC)
  const menuSnap = await getDoc(menuRef)
  if (!menuSnap.exists()) return null

  return normalizeMenu({
    restaurantId,
    restaurantData,
    menuData: menuSnap.data(),
  })
}

export const saveMenuRecord = async (menuPayload, restaurantId, customSlug = null) => {
  if (!isFirebaseConfigured || !db) {
    return {
      remoteSaved: false,
      remoteId: null,
    }
  }

  if (!restaurantId) {
    return { remoteSaved: false, remoteId: null }
  }

  const restaurantRef = doc(db, RESTAURANTS_COLLECTION, restaurantId)
  const restaurantSnap = await getDoc(restaurantRef)
  const existingRestaurantData = restaurantSnap.exists() ? restaurantSnap.data() : null

  const generatedSlug = menuPayload.restaurantName
    ? slugify(menuPayload.restaurantName)
    : `restaurant-${Math.floor(Math.random() * 100000)}`
  const finalSlug = customSlug || existingRestaurantData?.slug || generatedSlug

  await setDoc(restaurantRef, {
    name: menuPayload.restaurantName?.trim() || existingRestaurantData?.name || 'Untitled Restaurant',
    slug: finalSlug,
    allowOnlineOrders: existingRestaurantData?.allowOnlineOrders ?? false,
    isActive: existingRestaurantData?.isActive ?? true,
    createdAt: existingRestaurantData?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true })

  const menuRef = doc(db, RESTAURANTS_COLLECTION, restaurantId, MENU_SUBCOLLECTION, CURRENT_MENU_DOC)
  await setDoc(menuRef, {
    title: menuPayload.menuTitle,
    menuTitle: menuPayload.menuTitle,
    templateId: menuPayload.templateId,
    templateLabel: menuPayload.templateLabel,
    restaurantName: menuPayload.restaurantName,
    notes: menuPayload.notes,
    sections: menuPayload.sections,
    isPublished: true,
    updatedAt: serverTimestamp(),
  }, { merge: true })

  return {
    remoteSaved: true,
    remoteId: finalSlug,
  }
}

export const getRestaurantMenu = async (restaurantId) => {
  if (!isFirebaseConfigured || !db || !restaurantId) return null

  const restaurantSnap = await getDoc(doc(db, RESTAURANTS_COLLECTION, restaurantId))
  if (!restaurantSnap.exists()) return null

  const menuSnap = await getDoc(
    doc(db, RESTAURANTS_COLLECTION, restaurantId, MENU_SUBCOLLECTION, CURRENT_MENU_DOC),
  )
  if (!menuSnap.exists()) return null

  return normalizeMenu({
    restaurantId,
    restaurantData: restaurantSnap.data(),
    menuData: menuSnap.data(),
  })
}

export const getUserMenus = async (restaurantId) => {
  const menu = await getRestaurantMenu(restaurantId)
  return menu ? [menu] : []
}

export const getUserProfile = async (uid) => {
  if (!isFirebaseConfigured || !db || !uid) return null
  const docRef = doc(db, USERS_COLLECTION, uid)
  const snap = await getDoc(docRef)
  if (!snap.exists()) return null
  return { uid: snap.id, ...snap.data() }
}

export const createRestaurantForUser = async (uid, profileData) => {
  if (!isFirebaseConfigured || !db || !uid || !profileData?.restaurantName) return null

  const restaurantName = profileData.restaurantName.trim()
  const ownerName = (profileData.ownerName || '').trim()
  const email = profileData.email || ''
  const uniqueSlug = await ensureUniqueRestaurantSlug(restaurantName)

  const restaurantRef = doc(collection(db, RESTAURANTS_COLLECTION))
  await setDoc(restaurantRef, {
    name: restaurantName,
    slug: uniqueSlug,
    allowOnlineOrders: false,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await setDoc(doc(db, USERS_COLLECTION, uid), {
    ownerName,
    email,
    restaurantName,
    restaurantId: restaurantRef.id,
    updatedAt: serverTimestamp(),
  }, { merge: true })

  return {
    ownerName,
    email,
    restaurantName,
    restaurantId: restaurantRef.id,
    slug: uniqueSlug,
  }
}

export const saveUserProfile = async (uid, profileData) => {
  if (!isFirebaseConfigured || !db || !uid) return false
  await setDoc(doc(db, USERS_COLLECTION, uid), {
    ...profileData,
    updatedAt: serverTimestamp(),
  }, { merge: true })
  return true
}

export const getRestaurantSettings = async (restaurantId) => {
  if (!isFirebaseConfigured || !db || !restaurantId) return null
  const docRef = doc(db, RESTAURANTS_COLLECTION, restaurantId)
  const snap = await getDoc(docRef)
  if (snap.exists()) return { id: snap.id, ...snap.data() }
  return null
}

export const saveRestaurantProfile = async (restaurantId, profileData) => {
  if (!isFirebaseConfigured || !db || !restaurantId) return false
  await setDoc(doc(db, RESTAURANTS_COLLECTION, restaurantId), {
    name: profileData.restaurantName || profileData.name,
    slug: profileData.slug,
    isActive: profileData.isActive ?? true,
    allowOnlineOrders: profileData.allowOnlineOrders ?? false,
    updatedAt: serverTimestamp(),
  }, { merge: true })
  return true
}

export const saveRestaurantSettings = async (restaurantId, settings) => {
  if (!isFirebaseConfigured || !db || !restaurantId) return false
  await setDoc(doc(db, RESTAURANTS_COLLECTION, restaurantId), {
    ...settings,
    updatedAt: serverTimestamp(),
  }, { merge: true })
  return true
}

export const createRestaurantOrder = async (restaurantId, orderPayload) => {
  if (!isFirebaseConfigured || !db || !restaurantId) return null
  const ordersRef = collection(db, RESTAURANTS_COLLECTION, restaurantId, ORDERS_SUBCOLLECTION)
  const orderRef = doc(ordersRef)

  await setDoc(orderRef, {
    ...orderPayload,
    restaurantId,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return orderRef.id
}

export const subscribeToRestaurantOrder = (restaurantId, orderId, onChange) => {
  if (!isFirebaseConfigured || !db || !restaurantId || !orderId) return () => {}
  const orderRef = doc(db, RESTAURANTS_COLLECTION, restaurantId, ORDERS_SUBCOLLECTION, orderId)
  return onSnapshot(orderRef, (snap) => {
    if (!snap.exists()) {
      onChange(null)
      return
    }
    onChange({ id: snap.id, ...snap.data() })
  })
}

export const cancelRestaurantOrder = async (restaurantId, orderId) => {
  if (!isFirebaseConfigured || !db || !restaurantId || !orderId) return false
  try {
    const orderRef = doc(db, RESTAURANTS_COLLECTION, restaurantId, ORDERS_SUBCOLLECTION, orderId)
    await deleteDoc(orderRef)
    return true
  } catch (error) {
    console.error("Error cancelling order:", error)
    return false
  }
}

export const deleteMenuRecord = async (restaurantId) => {
  if (!isFirebaseConfigured || !db || !restaurantId) return false
  try {
    const menuRef = doc(db, RESTAURANTS_COLLECTION, restaurantId, MENU_SUBCOLLECTION, CURRENT_MENU_DOC)
    await deleteDoc(menuRef)
    return true
  } catch (error) {
    console.error("Error deleting menu:", error)
    return false
  }
}

