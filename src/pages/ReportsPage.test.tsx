import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonthDose, MonthDoseReport, MonthDoseSchedule } from '@/features/reports/monthDoses';
import type { ChainLink, RenewalChain } from '@/features/reports/renewals';
import type { Visit } from '@/features/reports/visits';
import type { StockItem } from '@/features/stock/stockItems';
import { ReportsPage } from './ReportsPage';

let items: StockItem[] = [];
let report: MonthDoseReport = { doses: [], schedules: [] };
const requestedMonths: string[] = [];
let chains: RenewalChain[] = [];
let visits: Visit[] = [];

vi.mock('@/features/stock/stockItems', () => ({
  useStockItems: () => ({ data: items, isPending: false, error: null }),
}));

vi.mock('@/features/reports/monthDoses', () => ({
  useMonthDoses: (month: string) => {
    requestedMonths.push(month);
    return { data: report, isPending: false, error: null };
  },
}));

vi.mock('@/features/reports/renewals', () => ({
  useRenewalChains: () => ({ data: chains, isPending: false, error: null }),
}));

vi.mock('@/features/reports/visits', () => ({
  useVisits: () => ({ data: visits, isPending: false, error: null }),
}));

function stockItem(overrides: Partial<StockItem>): StockItem {
  return {
    id: '0',
    owner_id: '00000000-0000-4000-8000-00000000000a',
    name: 'Item',
    kind: 'medication',
    strength: null,
    unit: 'pill',
    quantity: 10,
    low_stock_threshold: 5,
    pack_size: null,
    archived_at: null,
    created_at: '2026-01-01T07:00:00Z',
    ...overrides,
  };
}

function schedule(overrides: Partial<MonthDoseSchedule>): MonthDoseSchedule {
  return {
    id: 's1',
    stock_item_id: 'a',
    pattern: 'daily',
    effective_from: '2026-01-01',
    effective_to: null,
    times: ['08:00:00'],
    ...overrides,
  };
}

function dose(overrides: Partial<MonthDose>): MonthDose {
  return {
    id: `${overrides.local_date}-${overrides.local_time}`,
    stock_item_id: 'a',
    dose_schedule_id: 's1',
    due_at: null,
    taken_at: null,
    status: 'taken',
    amount: 1,
    local_date: '2026-02-01',
    local_time: '08:00:00',
    ...overrides,
  };
}

function link(overrides: Partial<ChainLink>): ChainLink {
  return {
    current_id: overrides.id ?? 'r1',
    depth: 0,
    id: 'r1',
    type: 'prescription',
    reference_number: 'RX-1001',
    covers: 'Medication A, 3 months',
    stock_item_id: 'a',
    issued_on: '2026-01-01',
    expires_on: '2026-06-01',
    archived_at: null,
    renewed: false,
    restocks: [],
    ...overrides,
  };
}

/** A chain from its links, newest first. */
function chain(...links: ChainLink[]): RenewalChain {
  const current = links[0]!;
  const all = links.map((l, depth) => ({ ...l, current_id: current.id, depth }));
  return { current: all[0]!, links: all };
}

function visit(overrides: Partial<Visit>): Visit {
  return {
    id: overrides.title ?? 'v1',
    title: 'Physiotherapy',
    starts_at: '2026-02-03T08:00:00Z',
    provider: 'Dr. Example',
    visit_summary: null,
    status: 'done',
    authorization: null,
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter>
      <ReportsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-02-10T10:00:00Z'));
  items = [];
  report = { doses: [], schedules: [] };
  chains = [];
  visits = [];
  requestedMonths.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Reports: Doses tab', () => {
  it('Remaining marks a row red at or below its threshold and shows negatives as they are', () => {
    items = [
      stockItem({ id: 'a', name: 'Medication A', quantity: 5, low_stock_threshold: 5 }),
      stockItem({ id: 'b', name: 'Medication B', quantity: -2, low_stock_threshold: 3 }),
      stockItem({ id: 'c', name: 'Supply A', kind: 'supply', quantity: 6, unit: 'strip' }),
      stockItem({ id: 'd', name: 'Medication C', archived_at: '2026-01-20T07:00:00Z' }),
    ];
    renderPage();

    const remaining = screen.getByRole('table', { name: 'Remaining' });
    const atThreshold = within(remaining).getByRole('row', { name: /Medication A/ });
    expect(atThreshold).toHaveAttribute('data-red', 'true');
    expect(within(atThreshold).getByText('5 pill')).toBeInTheDocument();

    const negative = within(remaining).getByRole('row', { name: /Medication B/ });
    expect(negative).toHaveAttribute('data-red', 'true');
    expect(within(negative).getByText('−2 pill')).toBeInTheDocument();

    const above = within(remaining).getByRole('row', { name: /Supply A/ });
    expect(above).toHaveAttribute('data-red', 'false');
    expect(within(above).getByText('6 strip')).toBeInTheDocument();

    expect(within(remaining).queryByText('Medication C')).not.toBeInTheDocument();
  });

  it('the grid has a row per Dose Time in force that month and empty days where none was due', () => {
    items = [stockItem({ id: 'a', name: 'Medication A' })];
    report = {
      schedules: [schedule({ times: ['08:00:00', '20:00:00'] })],
      doses: [
        dose({ local_date: '2026-02-01', local_time: '08:00:00', status: 'taken' }),
        dose({ local_date: '2026-02-01', local_time: '20:00:00', status: 'skipped' }),
        dose({ local_date: '2026-02-02', local_time: '08:00:00', status: 'missed' }),
        dose({ local_date: '2026-02-03', local_time: '08:00:00', status: 'pending' }),
      ],
    };
    renderPage();

    const card = screen.getByRole('region', { name: 'Medication A' });
    expect(within(card).getByText('Taken 1')).toBeInTheDocument();
    expect(within(card).getByText('Skipped 1')).toBeInTheDocument();
    expect(within(card).getByText('Missed 1')).toBeInTheDocument();

    const grid = within(card).getByRole('table');
    const rows = within(grid).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual([
      '08:00',
      '20:00',
    ]);
    const statuses = rows.map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.dataset.status),
    );
    expect(statuses[0]).toHaveLength(28);
    expect(statuses[0]!.slice(0, 4)).toEqual(['taken', 'missed', 'pending', 'none']);
    expect(statuses[1]!.slice(0, 3)).toEqual(['skipped', 'none', 'none']);
  });

  it('a Dose Time that existed for part of the month leaves its other days empty', () => {
    items = [stockItem({ id: 'a', name: 'Medication A' })];
    report = {
      schedules: [
        schedule({ id: 's1', effective_to: '2026-02-10', times: ['08:00:00'] }),
        schedule({ id: 's2', effective_from: '2026-02-10', times: ['08:00:00', '20:00:00'] }),
      ],
      doses: [
        dose({ dose_schedule_id: 's1', local_date: '2026-02-09', local_time: '08:00:00' }),
        dose({ dose_schedule_id: 's2', local_date: '2026-02-10', local_time: '08:00:00' }),
        dose({ dose_schedule_id: 's2', local_date: '2026-02-10', local_time: '20:00:00' }),
      ],
    };
    renderPage();

    const grid = within(screen.getByRole('region', { name: 'Medication A' })).getByRole('table');
    const evening = within(grid).getByRole('row', { name: /20:00/ });
    const statuses = within(evening)
      .getAllByRole('cell')
      .map((cell) => cell.dataset.status);
    expect(statuses.slice(0, 9)).toEqual(Array(9).fill('none'));
    expect(statuses[9]).toBe('taken');
    expect(statuses.slice(10)).toEqual(Array(18).fill('none'));
  });

  it('As Needed shows a count and list, no grid', () => {
    items = [stockItem({ id: 'b', name: 'Medication B' })];
    report = {
      schedules: [schedule({ id: 's3', stock_item_id: 'b', pattern: 'as_needed', times: [] })],
      doses: [
        dose({
          stock_item_id: 'b',
          dose_schedule_id: null,
          local_date: '2026-02-03',
          local_time: '09:15:00',
        }),
        dose({
          stock_item_id: 'b',
          dose_schedule_id: null,
          local_date: '2026-02-07',
          local_time: '22:40:00',
        }),
      ],
    };
    renderPage();

    const card = screen.getByRole('region', { name: 'Medication B' });
    expect(within(card).getByText('Taken 2 times')).toBeInTheDocument();
    const list = within(card).getByRole('list');
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['3 Feb 09:15', '7 Feb 22:40']);
    expect(within(card).queryByRole('table')).not.toBeInTheDocument();
  });

  it("the month stepper can't go past the current month", () => {
    renderPage();

    expect(screen.getByText('February 2026')).toBeInTheDocument();
    expect(requestedMonths.at(-1)).toBe('2026-02-01');
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('December 2025')).toBeInTheDocument();
    expect(requestedMonths.at(-1)).toBe('2025-12-01');

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('February 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
  });
});

describe('Reports: Renewals tab', () => {
  it('Renewals shows days left in red under 30', () => {
    chains = [
      chain(link({ id: 'r1', covers: 'Medication A, 3 months', expires_on: '2026-03-11' })),
      chain(link({ id: 'r2', covers: 'Medication B, 3 months', expires_on: '2026-03-12' })),
    ];
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Renewals' }));

    const soon = screen.getByRole('region', { name: 'Medication A, 3 months' });
    expect(within(soon).getByText('29 days left')).toHaveAttribute('data-red', 'true');
    const later = screen.getByRole('region', { name: 'Medication B, 3 months' });
    expect(within(later).getByText('30 days left')).toHaveAttribute('data-red', 'false');
  });

  it('filtering by a Stock Item hides Authorizations with no Stock Item', () => {
    items = [
      stockItem({ id: 'a', name: 'Medication A' }),
      stockItem({ id: 'b', name: 'Medication B' }),
    ];
    chains = [
      chain(link({ id: 'r1', covers: 'Medication A, 3 months', stock_item_id: 'a' })),
      chain(link({ id: 'r2', covers: 'Medication B, 3 months', stock_item_id: 'b' })),
      chain(
        link({
          id: 'f1',
          type: 'form_17',
          covers: 'Physiotherapy, 6 sessions',
          stock_item_id: null,
        }),
      ),
    ];
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Renewals' }));

    const cards = () =>
      screen.getAllByRole('region').map((card) => card.getAttribute('aria-label'));
    expect(cards()).toEqual([
      'Medication A, 3 months',
      'Medication B, 3 months',
      'Physiotherapy, 6 sessions',
    ]);

    fireEvent.change(screen.getByRole('combobox', { name: 'Stock Item' }), {
      target: { value: 'a' },
    });
    expect(cards()).toEqual(['Medication A, 3 months']);
  });
});

describe('Reports: Visits tab', () => {
  it('Visits leaves out cancelled and future Appointments', () => {
    visits = [
      visit({ title: 'Dermatology', starts_at: '2026-02-20T08:00:00Z', status: 'scheduled' }),
      visit({
        title: 'Orthopedics',
        starts_at: '2026-02-05T08:00:00Z',
        authorization: { reference_number: 'F17-2001' },
        visit_summary: 'Keep exercising twice a day.',
      }),
      visit({ title: 'Cardiology', starts_at: '2026-02-04T08:00:00Z', status: 'cancelled' }),
      visit({ title: 'Physiotherapy', starts_at: '2026-01-15T08:00:00Z' }),
    ];
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Visits' }));

    expect(screen.getAllByRole('region').map((card) => card.getAttribute('aria-label'))).toEqual([
      'Orthopedics',
      'Physiotherapy',
    ]);
    const done = screen.getByRole('region', { name: 'Orthopedics' });
    expect(within(done).getByText('F17-2001')).toBeInTheDocument();
    expect(within(done).getByText('Keep exercising twice a day.')).toBeInTheDocument();
    const noSummary = screen.getByRole('region', { name: 'Physiotherapy' });
    expect(within(noSummary).getByText('No visit summary yet')).toBeInTheDocument();
    expect(within(noSummary).getByRole('link', { name: 'Add Visit Summary' })).toHaveAttribute(
      'href',
      '/appointments/Physiotherapy',
    );
  });

  it('the Provider filter lists the distinct providers of past Appointments', () => {
    visits = [
      visit({ title: 'Check-up', provider: 'Dr. Future', status: 'scheduled' }),
      visit({ title: 'Follow-up', provider: 'Dr. Example' }),
      visit({ title: 'Cancelled visit', provider: 'Dr. Cancelled', status: 'cancelled' }),
      visit({ title: 'Physiotherapy', provider: 'Clinic B' }),
      visit({ title: 'First visit', provider: 'Dr. Example' }),
      visit({ title: 'No provider', provider: null }),
    ];
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Visits' }));

    const filter = screen.getByRole('combobox', { name: 'Provider' });
    expect(
      within(filter)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All', 'Clinic B', 'Dr. Example']);

    fireEvent.change(filter, { target: { value: 'Dr. Example' } });
    expect(screen.getAllByRole('region').map((card) => card.getAttribute('aria-label'))).toEqual([
      'Follow-up',
      'First visit',
    ]);
  });
});
