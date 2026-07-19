/*
 * SQL FUNCTIONS REQUIRED — apply these manually in Supabase SQL editor before using PATCH/DELETE.
 *
 * ─── update_commission_transaction ────────────────────────────────────────────
 *
 * CREATE OR REPLACE FUNCTION update_commission_transaction(
 *   p_id   uuid,
 *   p      jsonb
 * )
 * RETURNS commission_transactions
 * LANGUAGE plpgsql
 * SECURITY DEFINER
 * SET search_path = public
 * AS $$
 * DECLARE
 *   v_tx         commission_transactions;
 *   v_entry      jsonb;
 *   v_changes    jsonb := '{}'::jsonb;
 *   v_new_sale   numeric;
 *   v_driver_fee numeric;
 *   v_company_fee numeric;
 *   v_drv        record;
 *   v_cmp        record;
 * BEGIN
 *   SELECT * INTO v_tx FROM commission_transactions WHERE id = p_id FOR UPDATE;
 *   IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
 *
 *   -- Build change diff for edit_history
 *   IF (p->>'tx_date') IS NOT NULL AND (p->>'tx_date') <> v_tx.tx_date::text THEN
 *     v_changes := v_changes || jsonb_build_object('tx_date', jsonb_build_object('old', v_tx.tx_date, 'new', p->>'tx_date'));
 *   END IF;
 *   IF (p->>'sale_amount') IS NOT NULL AND (p->>'sale_amount')::numeric <> v_tx.sale_amount THEN
 *     v_changes := v_changes || jsonb_build_object('sale_amount', jsonb_build_object('old', v_tx.sale_amount, 'new', (p->>'sale_amount')::numeric));
 *   END IF;
 *   IF (p->>'admin_fee') IS NOT NULL AND (p->>'admin_fee')::numeric <> v_tx.admin_fee THEN
 *     v_changes := v_changes || jsonb_build_object('admin_fee', jsonb_build_object('old', v_tx.admin_fee, 'new', (p->>'admin_fee')::numeric));
 *   END IF;
 *   IF (p->>'status') IS NOT NULL AND (p->>'status') <> v_tx.status THEN
 *     v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', v_tx.status, 'new', p->>'status'));
 *   END IF;
 *   IF (p->>'transfer_date') IS NOT NULL AND (p->>'transfer_date') <> coalesce(v_tx.transfer_date::text, '') THEN
 *     v_changes := v_changes || jsonb_build_object('transfer_date', jsonb_build_object('old', v_tx.transfer_date, 'new', p->>'transfer_date'));
 *   END IF;
 *   IF (p->>'transfer_note') IS NOT NULL THEN
 *     v_changes := v_changes || jsonb_build_object('transfer_note', jsonb_build_object('old', v_tx.transfer_note, 'new', p->>'transfer_note'));
 *   END IF;
 *
 *   -- Validate status transition
 *   IF (p->>'status') = 'paid' AND (p->>'transfer_date') IS NULL AND v_tx.transfer_date IS NULL THEN
 *     RAISE EXCEPTION 'transfer_date wajib saat status berubah ke paid';
 *   END IF;
 *
 *   -- Recalculate fee jika sale_amount berubah
 *   v_new_sale := coalesce((p->>'sale_amount')::numeric, v_tx.sale_amount);
 *   IF v_new_sale <> v_tx.sale_amount THEN
 *     SELECT fee_value INTO v_drv FROM drivers WHERE id = v_tx.driver_id;
 *     v_driver_fee := round(v_new_sale * coalesce(v_drv.fee_value, v_tx.driver_fee_pct) / 100, 2);
 *     IF v_tx.company_id IS NOT NULL THEN
 *       SELECT fee_value INTO v_cmp FROM driver_companies WHERE id = v_tx.company_id;
 *       v_company_fee := round(v_new_sale * coalesce(v_cmp.fee_value, v_tx.company_fee_pct) / 100, 2);
 *     ELSE
 *       v_company_fee := v_tx.company_fee_amount;
 *     END IF;
 *   ELSE
 *     v_driver_fee  := v_tx.driver_fee_amount;
 *     v_company_fee := v_tx.company_fee_amount;
 *   END IF;
 *
 *   -- Append change entry to edit_history
 *   v_entry := jsonb_build_object(
 *     'changed_at', now(),
 *     'reason', p->>'edit_reason',
 *     'changes', v_changes
 *   );
 *
 *   UPDATE commission_transactions SET
 *     tx_date          = coalesce((p->>'tx_date')::date, tx_date),
 *     sale_amount      = v_new_sale,
 *     admin_fee        = coalesce((p->>'admin_fee')::numeric, admin_fee),
 *     driver_fee_amount = v_driver_fee,
 *     company_fee_amount = v_company_fee,
 *     status           = coalesce(p->>'status', status),
 *     transfer_date    = coalesce((p->>'transfer_date')::date, transfer_date),
 *     transfer_note    = coalesce(p->>'transfer_note', transfer_note),
 *     edit_history     = coalesce(edit_history, '[]'::jsonb) || jsonb_build_array(v_entry),
 *     updated_at       = now()
 *   WHERE id = p_id
 *   RETURNING * INTO v_tx;
 *
 *   RETURN v_tx;
 * END;
 * $$;
 *
 *
 * ─── delete_commission_transaction ────────────────────────────────────────────
 *
 * CREATE OR REPLACE FUNCTION delete_commission_transaction(p_id uuid)
 * RETURNS void
 * LANGUAGE plpgsql
 * SECURITY DEFINER
 * SET search_path = public
 * AS $$
 * DECLARE
 *   v_status text;
 * BEGIN
 *   SELECT status INTO v_status FROM commission_transactions WHERE id = p_id;
 *   IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
 *   IF v_status = 'paid' THEN RAISE EXCEPTION 'Cannot delete a paid transaction'; END IF;
 *   DELETE FROM commission_transactions WHERE id = p_id;
 * END;
 * $$;
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const MANAGER_ROLES = ['owner', 'admin']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// PATCH /api/v1/commission-tracker/transactions/[id]
// Body: { tx_date?, sale_amount?, admin_fee?, status?, transfer_date?, transfer_note?, notes?, edit_reason (required) }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any).from('staff').select('role, can_access_commission').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || (!MANAGER_ROLES.includes(staff.role) && !(staff as any).can_access_commission))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { id } = await params
  if (!UUID_RE.test(id))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'ID tidak valid.' } }, { status: 400 })

  let body: {
    tx_date?: string
    sale_amount?: number
    admin_fee?: number
    status?: string
    transfer_date?: string
    transfer_note?: string
    notes?: string
    edit_reason: string
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Body tidak valid.' } }, { status: 400 })
  }

  if (!body.edit_reason?.trim())
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'edit_reason wajib.' } }, { status: 400 })
  if (body.tx_date && !DATE_RE.test(body.tx_date))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'tx_date harus format YYYY-MM-DD.' } }, { status: 400 })
  if (body.sale_amount !== undefined && body.sale_amount <= 0)
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'sale_amount harus lebih dari 0.' } }, { status: 400 })
  if (body.transfer_date && !DATE_RE.test(body.transfer_date))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'transfer_date harus format YYYY-MM-DD.' } }, { status: 400 })

  // Delegate to SECURITY DEFINER function
  const admin = createAdminClient()
  const { data, error } = await (admin as any).rpc('update_commission_transaction', {
    p_id: id,
    p: {
      tx_date:       body.tx_date       ?? null,
      sale_amount:   body.sale_amount   ?? null,
      admin_fee:     body.admin_fee     ?? null,
      status:        body.status        ?? null,
      transfer_date: body.transfer_date ?? null,
      transfer_note: body.transfer_note ?? null,
      notes:         body.notes         ?? null,
      edit_reason:   body.edit_reason,
    }
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('not found') || msg.includes('tidak ditemukan'))
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: msg } }, { status: 404 })
    if (msg.includes('transfer_date'))
      return NextResponse.json({ error: { code: 'VALIDATION', message: msg } }, { status: 400 })
    return NextResponse.json({ error: { code: 'DB_ERROR', message: msg } }, { status: 500 })
  }

  return NextResponse.json({ data: { transaction: data } })
}

// DELETE /api/v1/commission-tracker/transactions/[id]
// Cannot delete a paid transaction (409)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data: staff } = await (supabase as any).from('staff').select('role, can_access_commission').eq('auth_user_id', user.id).eq('active', true).single()
  if (!staff || (!MANAGER_ROLES.includes(staff.role) && !(staff as any).can_access_commission))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

  const { id } = await params
  if (!UUID_RE.test(id))
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'ID tidak valid.' } }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await (admin as any).rpc('delete_commission_transaction', { p_id: id })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('not found') || msg.includes('tidak ditemukan'))
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: msg } }, { status: 404 })
    if (msg.toLowerCase().includes('paid'))
      return NextResponse.json({ error: { code: 'CONFLICT', message: 'Transaksi yang sudah paid tidak bisa dihapus.' } }, { status: 409 })
    return NextResponse.json({ error: { code: 'DB_ERROR', message: msg } }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
