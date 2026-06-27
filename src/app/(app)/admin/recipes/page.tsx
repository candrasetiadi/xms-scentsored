import { createClient } from '@/lib/supabase/server'
import { RecipesClient } from './RecipesClient'

export const metadata = { title: 'Resep / BOM — Scentsored' }

export default async function RecipesPage() {
  const supabase = await createClient()

  const [{ data: products }, { data: rawMaterials }, { data: recipes }] = await Promise.all([
    supabase.from('products').select('id, name, type').eq('type', 'custom_racik').eq('active', true).order('name'),
    supabase.from('raw_materials').select('id, name, unit').eq('active', true).order('name'),
    supabase.from('product_recipes').select('id, product_id, raw_material_id, qty_per_unit'),
  ])

  return (
    <RecipesClient
      products={products ?? []}
      rawMaterials={rawMaterials ?? []}
      recipes={recipes ?? []}
    />
  )
}
