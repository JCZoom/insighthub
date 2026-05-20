/**
 * Regression tests for the real-source schema registry.
 *
 * The registry in `src/lib/data/real-source-schemas.ts` is the single
 * source of truth that the Data Explorer (and any future tooling) uses
 * to describe Freshworks + Platform Health source row shapes. If the
 * registry drifts from the live provider output, the Data Explorer
 * lies to users — these tests guard against the most likely drift
 * scenarios:
 *
 *  - A new source added to FRESHWORKS_SOURCES or PLATFORM_HEALTH_SOURCES
 *    without a corresponding REAL_SOURCE_SCHEMAS entry.
 *  - A REAL_SOURCE_SCHEMAS entry whose columns array is empty.
 *  - A KPI source that drifted away from the 5-field shape contract.
 *
 * Runner: built-in `node:test` (Node >= 18) via tsx, same as the rest
 * of the unit suite. Invoked via `npm run test:unit`.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { FRESHWORKS_SOURCES } from '../src/lib/data/freshworks-sources';
import { PLATFORM_HEALTH_SOURCES } from '../src/lib/data/platform-health-sources';
import {
  REAL_SOURCE_SCHEMAS,
  hasRealSourceSchema,
  getRealSourceSchema,
  listRealSourceNames,
} from '../src/lib/data/real-source-schemas';

const KPI_5_FIELDS = [
  'value',
  'label',
  'previous_value',
  'comparison_label',
  'comparison_unavailable_reason',
] as const;

// Sources whose row shape is the canonical KPI 5-field contract.
// Updating this list is a deliberate act — adding a name here without
// the registry actually following the shape will fail loudly.
const KPI_SOURCES: readonly string[] = [
  // Freshworks KPIs
  'freshsales_pipeline_value',
  'freshsales_open_deal_count',
  'freshdesk_open_ticket_count',
  'freshdesk_overdue_ticket_count',
  'freshcaller_calls_today',
  'freshchat_active_conversations',
  // Platform Health KPIs
  'platform_user_count',
  'platform_active_users_7d',
  'platform_dashboards_total',
  'platform_dashboards_created_30d',
  'platform_glossary_term_count',
  'platform_audit_events_today',
];

describe('REAL_SOURCE_SCHEMAS — coverage of registered sources', () => {
  it('has a schema entry for every Freshworks source', () => {
    for (const name of FRESHWORKS_SOURCES) {
      assert.ok(
        hasRealSourceSchema(name),
        `Freshworks source "${name}" has no entry in REAL_SOURCE_SCHEMAS. ` +
          'If you added the source to FRESHWORKS_SOURCES, also add a ' +
          'schema entry in src/lib/data/real-source-schemas.ts.',
      );
    }
  });

  it('has a schema entry for every Platform Health source', () => {
    for (const name of PLATFORM_HEALTH_SOURCES) {
      assert.ok(
        hasRealSourceSchema(name),
        `Platform Health source "${name}" has no entry in REAL_SOURCE_SCHEMAS. ` +
          'If you added the source to PLATFORM_HEALTH_SOURCES, also add a ' +
          'schema entry in src/lib/data/real-source-schemas.ts.',
      );
    }
  });

  it('listRealSourceNames returns every key in REAL_SOURCE_SCHEMAS', () => {
    assert.deepEqual(
      [...listRealSourceNames()].sort(),
      Object.keys(REAL_SOURCE_SCHEMAS).sort(),
    );
  });

  it('every schema has a non-empty columns array', () => {
    for (const [name, schema] of Object.entries(REAL_SOURCE_SCHEMAS)) {
      assert.ok(
        schema.columns.length > 0,
        `Schema for "${name}" has zero columns. The Data Explorer would ` +
          'render the source with no fields, which defeats the purpose ' +
          'of having a registry entry at all.',
      );
    }
  });

  it('every schema has a non-empty description', () => {
    for (const [name, schema] of Object.entries(REAL_SOURCE_SCHEMAS)) {
      assert.ok(
        typeof schema.description === 'string' && schema.description.length > 0,
        `Schema for "${name}" has no description. The Data Explorer uses ` +
          'this as the source-tooltip text; missing descriptions are user-visible.',
      );
    }
  });
});

describe('REAL_SOURCE_SCHEMAS — KPI 5-field contract', () => {
  for (const source of KPI_SOURCES) {
    it(`"${source}" exposes the canonical KPI 5-field shape`, () => {
      const schema = getRealSourceSchema(source);
      assert.ok(schema, `${source} should exist in REAL_SOURCE_SCHEMAS`);
      const columnNames = schema.columns.map(c => c.name);
      assert.deepEqual(
        columnNames,
        KPI_5_FIELDS,
        `${source} drifted from the canonical KPI shape. The KpiCard ` +
          'renderer expects exactly these 5 columns in this order — ' +
          'if you intentionally changed the shape, update both the ' +
          'provider AND the KPI_5_FIELD_SHAPE constant in ' +
          'src/lib/data/real-source-schemas.ts.',
      );
    });
  }
});
