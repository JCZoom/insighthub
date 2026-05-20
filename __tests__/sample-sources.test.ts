/**
 * Regression tests for the demo-source quarantine helpers.
 *
 * Pairs with the FEATURE_DEMO_SOURCES + NEXT_PUBLIC_FEATURE_DEMO_SOURCES
 * gating added in the post-2026-05-19 real-data migration. If anyone
 * removes the client/server flag split, the widget-source predicate, or
 * the filterSampleSources helper, the corresponding test fails. This is
 * the "discovery hidden, query path preserved" contract — every UI
 * surface that exposes data sources should be running through one of
 * these helpers, and the helpers should remain pure and testable.
 *
 * Runner: built-in `node:test` (Node >= 18) via tsx, same as env.test.ts.
 *   npm run test:unit
 */

import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  SAMPLE_SOURCES,
  isSampleSource,
  demoSourcesEnabled,
  clientDemoSourcesEnabled,
  widgetUsesSampleSource,
  filterSampleSources,
} from '../src/lib/data/sample-sources';

const KEYS = ['FEATURE_DEMO_SOURCES', 'NEXT_PUBLIC_FEATURE_DEMO_SOURCES'] as const;

const procEnv = process.env as Record<string, string | undefined>;
let snapshot: Record<string, string | undefined>;

function captureEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of KEYS) out[k] = process.env[k];
  return out;
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const k of KEYS) {
    const v = saved[k];
    if (v === undefined) delete procEnv[k];
    else procEnv[k] = v;
  }
}

describe('SAMPLE_SOURCES registry', () => {
  it('contains the 27 canonical names from the migration plan', () => {
    // The plan in docs/REAL_DATA_MIGRATION_PLAN_2026-05-19.md §3.1
    // enumerates exactly 27 canonical names. If this number changes the
    // operator should review the plan and the discovery filters at the
    // same time — adding a "sample_widgets" source by accident would
    // silently widen the quarantine surface.
    assert.equal(SAMPLE_SOURCES.length, 27);
  });

  it('isSampleSource returns true for canonical names', () => {
    assert.equal(isSampleSource('kpi_summary'), true);
    assert.equal(isSampleSource('sample_tickets'), true);
    assert.equal(isSampleSource('cs_automation_summary'), true);
  });

  it('isSampleSource returns false for real sources', () => {
    assert.equal(isSampleSource('freshsales_pipeline_value'), false);
    assert.equal(isSampleSource('platform_user_count'), false);
    assert.equal(isSampleSource('not_a_real_source'), false);
  });
});

describe('demoSourcesEnabled / clientDemoSourcesEnabled — flag split', () => {
  beforeEach(() => { snapshot = captureEnv(); });
  afterEach(() => { restoreEnv(snapshot); });

  it('demoSourcesEnabled reads server flag only', () => {
    procEnv.FEATURE_DEMO_SOURCES = 'true';
    procEnv.NEXT_PUBLIC_FEATURE_DEMO_SOURCES = 'false';
    assert.equal(demoSourcesEnabled(), true);
    assert.equal(clientDemoSourcesEnabled(), false);
  });

  it('clientDemoSourcesEnabled reads public flag only', () => {
    procEnv.FEATURE_DEMO_SOURCES = 'false';
    procEnv.NEXT_PUBLIC_FEATURE_DEMO_SOURCES = 'true';
    assert.equal(demoSourcesEnabled(), false);
    assert.equal(clientDemoSourcesEnabled(), true);
  });

  it('both default to false when unset', () => {
    delete procEnv.FEATURE_DEMO_SOURCES;
    delete procEnv.NEXT_PUBLIC_FEATURE_DEMO_SOURCES;
    assert.equal(demoSourcesEnabled(), false);
    assert.equal(clientDemoSourcesEnabled(), false);
  });

  it('non-"true" values are treated as false (no truthy coercion)', () => {
    // Guards against operators setting the flag to "1", "yes", "TRUE",
    // etc. Strict equality with the literal "true" string is the
    // documented contract — matching the DEV_MODE flag's parsing.
    procEnv.FEATURE_DEMO_SOURCES = 'TRUE';
    procEnv.NEXT_PUBLIC_FEATURE_DEMO_SOURCES = '1';
    assert.equal(demoSourcesEnabled(), false);
    assert.equal(clientDemoSourcesEnabled(), false);
  });
});

describe('widgetUsesSampleSource — pure predicate', () => {
  it('flags a widget bound directly to a sample source', () => {
    assert.equal(
      widgetUsesSampleSource({ dataConfig: { source: 'kpi_summary' } }),
      true,
    );
  });

  it('flags a WidgetTemplate (config-wrapped) bound to a sample source', () => {
    assert.equal(
      widgetUsesSampleSource({
        config: { dataConfig: { source: 'mrr_by_month' } },
      }),
      true,
    );
  });

  it('does NOT flag widgets bound to real sources', () => {
    assert.equal(
      widgetUsesSampleSource({ dataConfig: { source: 'freshsales_pipeline_value' } }),
      false,
    );
    assert.equal(
      widgetUsesSampleSource({
        config: { dataConfig: { source: 'platform_user_count' } },
      }),
      false,
    );
  });

  it('does NOT flag text blocks (empty source)', () => {
    assert.equal(widgetUsesSampleSource({ dataConfig: { source: '' } }), false);
    assert.equal(
      widgetUsesSampleSource({ config: { dataConfig: { source: '' } } }),
      false,
    );
  });

  it('handles missing dataConfig gracefully', () => {
    assert.equal(widgetUsesSampleSource({}), false);
    assert.equal(widgetUsesSampleSource({ config: {} }), false);
  });
});

describe('filterSampleSources — discovery gate', () => {
  beforeEach(() => { snapshot = captureEnv(); });
  afterEach(() => { restoreEnv(snapshot); });

  it('drops sample sources when FEATURE_DEMO_SOURCES is off', () => {
    delete procEnv.FEATURE_DEMO_SOURCES;
    const filtered = filterSampleSources([
      'kpi_summary',
      'freshsales_pipeline_value',
      'platform_user_count',
      'sample_tickets',
    ]);
    assert.deepEqual(filtered, ['freshsales_pipeline_value', 'platform_user_count']);
  });

  it('passes everything through when FEATURE_DEMO_SOURCES=true', () => {
    procEnv.FEATURE_DEMO_SOURCES = 'true';
    const filtered = filterSampleSources([
      'kpi_summary',
      'freshsales_pipeline_value',
    ]);
    assert.deepEqual(filtered, ['kpi_summary', 'freshsales_pipeline_value']);
  });

  it('preserves order of input names', () => {
    delete procEnv.FEATURE_DEMO_SOURCES;
    const filtered = filterSampleSources([
      'platform_user_count',
      'kpi_summary', // dropped
      'freshsales_pipeline_value',
    ]);
    assert.deepEqual(filtered, [
      'platform_user_count',
      'freshsales_pipeline_value',
    ]);
  });
});
