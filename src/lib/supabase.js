import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null

/**
 * Uploads a menu item image to Supabase Storage.
 * @param {string} restaurantId - The ID of the restaurant.
 * @param {string} itemId - The ID of the menu item.
 * @param {File} file - The image file to upload.
 * @returns {Promise<string>} The public URL of the uploaded image.
 */
export const uploadMenuItemImage = async (restaurantId, itemId, file) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your environment.')
  }

  // 1 MB limit validation
  const MAX_SIZE = 1024 * 1024 // 1 MB in bytes
  if (file.size > MAX_SIZE) {
    throw new Error('Image size exceeds 1 MB limit. Please upload a smaller image.')
  }

  const fileExt = file.name.split('.').pop()
  const fileName = `${itemId}-${Date.now()}.${fileExt}`
  const filePath = `${restaurantId}/${fileName}`

  // Upload the file to the 'restaurant-menus' bucket
  const { data, error } = await supabase.storage
    .from('restaurant-menus')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    console.error('Error uploading image to Supabase Storage:', error)
    throw new Error(error.message || 'Failed to upload image.')
  }

  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from('restaurant-menus')
    .getPublicUrl(filePath)

  return publicUrl
}
