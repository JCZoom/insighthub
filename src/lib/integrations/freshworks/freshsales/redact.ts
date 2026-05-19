/**
 * Freshsales — product-specific PII redactors.
 *
 * Shapes contacts/deals/accounts before they leave the connector. Uses the
 * shared maskers under the hood; this file only encodes the Freshsales
 * resource shape.
 */

import {
  shouldMaskForRole,
  maskEmail,
  maskPhone,
  maskName,
  maskFreeText,
  scanAndMaskPiiFields,
  type UserRole,
} from '../shared/redact';

export interface FreshsalesContact {
  id: number | string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  mobile_number?: string | null;
  work_number?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  [k: string]: unknown;
}

export function redactContact<T extends FreshsalesContact>(c: T, role: UserRole): T {
  if (!shouldMaskForRole(role)) return c;
  let out: T = { ...c };
  if (out.first_name != null) out.first_name = maskName(out.first_name);
  if (out.last_name != null) out.last_name = maskName(out.last_name);
  if (out.display_name != null) out.display_name = maskName(out.display_name);
  if (out.email != null) out.email = maskEmail(out.email);
  if (out.mobile_number != null) out.mobile_number = maskPhone(out.mobile_number);
  if (out.work_number != null) out.work_number = maskPhone(out.work_number);
  if (out.address != null) out.address = maskFreeText(out.address);
  // Defence in depth.
  out = scanAndMaskPiiFields(out as unknown as Record<string, unknown>) as T;
  return out;
}

export interface FreshsalesDeal {
  id: number | string;
  name?: string | null;
  amount?: number | null;
  deal_stage_id?: number | string | null;
  expected_close?: string | null;
  primary_contact?: { id: number | string; display_name?: string | null; email?: string | null } | null;
  [k: string]: unknown;
}

export function redactDeal<T extends FreshsalesDeal>(d: T, role: UserRole): T {
  if (!shouldMaskForRole(role)) return d;
  const out = { ...d };
  if (out.primary_contact) {
    out.primary_contact = {
      ...out.primary_contact,
      display_name: maskName(out.primary_contact.display_name ?? null),
      email: maskEmail(out.primary_contact.email ?? null),
    };
  }
  return out;
}

export interface FreshsalesAccount {
  id: number | string;
  name?: string | null;
  website?: string | null;
  phone?: string | null;
  [k: string]: unknown;
}

export function redactAccount<T extends FreshsalesAccount>(a: T, role: UserRole): T {
  if (!shouldMaskForRole(role)) return a;
  const out = { ...a };
  if (out.phone != null) out.phone = maskPhone(out.phone);
  return out;
}

export function redactContacts<T extends FreshsalesContact>(rows: T[], role: UserRole): T[] {
  return rows.map((r) => redactContact(r, role));
}
export function redactDeals<T extends FreshsalesDeal>(rows: T[], role: UserRole): T[] {
  return rows.map((r) => redactDeal(r, role));
}
export function redactAccounts<T extends FreshsalesAccount>(rows: T[], role: UserRole): T[] {
  return rows.map((r) => redactAccount(r, role));
}
