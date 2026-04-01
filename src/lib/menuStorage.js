import { setDoc, collection, doc, getDoc, getDocs, query, where, serverTimestamp, onSnapshot } from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

const MENUS_COLLECTION = 'menus'
const USERS_COLLECTION = 'users'
const RESTAURANTS_COLLECTION = 'restaurants'
const ORDERS_SUBCOLLECTION = 'orders'

export const getMenuRecord = async (menuId) => {
  if (!isFirebaseConfigured || !db) return null;
  const docRef = doc(db, MENUS_COLLECTION, menuId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }
  return null;
}

export const saveMenuRecord = async (menuPayload, uid, customSlug = null) => {
  if (!isFirebaseConfigured || !db) {
    return {
      remoteSaved: false,
      remoteId: null,
    }
  }
  
  if (!uid) {
    return { remoteSaved: false, remoteId: null };
  }

  // Generate URL slug from restaurant name
  const generatedSlug = menuPayload.restaurantName 
    ? menuPayload.restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.floor(Math.random() * 1000)
    : customSlug || `menu-${Math.floor(Math.random() * 100000)}`;

  const finalSlug = customSlug || generatedSlug;

  const docRef = doc(db, MENUS_COLLECTION, finalSlug);
  await setDoc(docRef, {
    ...menuPayload,
    ownerId: uid,
    slug: finalSlug,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return {
    remoteSaved: true,
    remoteId: finalSlug,
  }
}

export const getUserMenus = async (uid) => {
  if (!isFirebaseConfigured || !db || !uid) return []

  const menusQuery = query(collection(db, MENUS_COLLECTION), where('ownerId', '==', uid))
  const snapshot = await getDocs(menusQuery)

  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
}

export const getUserProfile = async (uid) => {
  if (!isFirebaseConfigured || !db) return null;
  const docRef = doc(db, USERS_COLLECTION, uid);
  const snap = await getDoc(docRef);
  if (snap.exists()) return snap.data();
  return null;
}

export const saveUserProfile = async (uid, profileData) => {
  if (!isFirebaseConfigured || !db) return false;
  await setDoc(doc(db, USERS_COLLECTION, uid), {
    ...profileData,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return true;
}

export const getRestaurantSettings = async (restaurantId) => {
  if (!isFirebaseConfigured || !db || !restaurantId) return null;
  const docRef = doc(db, RESTAURANTS_COLLECTION, restaurantId);
  const snap = await getDoc(docRef);
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  return null;
}

export const saveRestaurantProfile = async (restaurantId, profileData) => {
  if (!isFirebaseConfigured || !db || !restaurantId) return false;
  await setDoc(doc(db, RESTAURANTS_COLLECTION, restaurantId), {
    ...profileData,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return true;
}

export const saveRestaurantSettings = async (restaurantId, settings) => {
  if (!isFirebaseConfigured || !db || !restaurantId) return false;
  await setDoc(doc(db, RESTAURANTS_COLLECTION, restaurantId), {
    ...settings,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return true;
}

export const createRestaurantOrder = async (restaurantId, orderPayload) => {
  if (!isFirebaseConfigured || !db || !restaurantId) return null;
  const ordersRef = collection(db, RESTAURANTS_COLLECTION, restaurantId, ORDERS_SUBCOLLECTION);
  const orderRef = doc(ordersRef);

  await setDoc(orderRef, {
    ...orderPayload,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return orderRef.id;
}

export const subscribeToRestaurantOrder = (restaurantId, orderId, onChange) => {
  if (!isFirebaseConfigured || !db || !restaurantId || !orderId) return () => {};
  const orderRef = doc(db, RESTAURANTS_COLLECTION, restaurantId, ORDERS_SUBCOLLECTION, orderId);
  return onSnapshot(orderRef, (snap) => {
    if (!snap.exists()) {
      onChange(null);
      return;
    }
    onChange({ id: snap.id, ...snap.data() });
  });
}
