import { useState } from 'react';
import { Link } from 'react-router';
import { useMonthDoses, type MonthDose, type MonthDoseReport } from '@/features/reports/monthDoses';
import { useStockItems, type StockItem } from '@/features/stock/stockItems';

const TIME_ZONE = 'Asia/Jerusalem';

/** The first of the current month in the owner's time zone: "2026-02-01". */
function currentMonth() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
  return `${today.slice(0, 7)}-01`;
}

/** The first of the month `delta` months from `month` ("YYYY-MM-01"). */
function addMonths(month: string, delta: number) {
  const [year, monthIndex] = [Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta];
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return date.toISOString().slice(0, 10);
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}T00:00:00Z`));
}

const TABS = ['Doses', 'Renewals', 'Visits'] as const;

export function ReportsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Doses');
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <div role="tablist" aria-label="Reports" className="flex gap-2 border-b">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={`px-3 py-1 ${tab === name ? 'border-b-2 border-black font-semibold' : ''}`}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={tab} className="space-y-4">
        {tab === 'Doses' ? <DosesTab /> : <p>Coming soon.</p>}
      </div>
      <Link to="/" className="underline">
        Home
      </Link>
    </main>
  );
}

function DosesTab() {
  const { data: items, error: itemsError } = useStockItems();
  const latest = currentMonth();
  const [month, setMonth] = useState(latest);
  const [itemId, setItemId] = useState('all');
  const { data: report, isPending, error } = useMonthDoses(month);
  const filtered = (items ?? []).filter((item) => itemId === 'all' || item.id === itemId);

  return (
    <>
      <label className="flex items-center gap-2">
        Stock Item
        <select
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
          className="rounded border px-2 py-1"
        >
          <option value="all">All</option>
          {(items ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous month"
          className="rounded border px-2"
          onClick={() => setMonth(addMonths(month, -1))}
        >
          ‹
        </button>
        <span className="min-w-36 text-center font-medium">{monthLabel(month)}</span>
        <button
          type="button"
          aria-label="Next month"
          className="rounded border px-2 disabled:opacity-40"
          disabled={month >= latest}
          onClick={() => setMonth(addMonths(month, 1))}
        >
          ›
        </button>
      </div>
      {(itemsError ?? error) && (
        <p role="alert" className="text-red-700">
          {(itemsError ?? error)?.message}
        </p>
      )}
      <Remaining items={filtered.filter((item) => !item.archived_at)} />
      {isPending && <p>Loading…</p>}
      {report && (
        <DoseHistory
          month={month}
          medications={filtered.filter((item) => item.kind === 'medication')}
          report={report}
        />
      )}
      <Legend />
    </>
  );
}

function Legend() {
  const entries = [
    ['taken', 'Taken'],
    ['skipped', 'Skipped'],
    ['missed', 'Missed'],
    ['pending', 'Pending'],
    ['none', 'No Dose due'],
  ] as const;
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-3 text-sm">
      {entries.map(([status, label]) => (
        <li key={status} className="flex items-center gap-1">
          <span className={`block size-3 rounded-sm border ${STATUS_CLASS[status]}`} />
          {label}
        </li>
      ))}
      <li className="font-semibold text-red-700">Red: at or below threshold</li>
    </ul>
  );
}

/** A quantity as it is, negatives with a real minus sign: "−2 pill". */
function formatQuantity(quantity: number, unit: string) {
  return `${quantity < 0 ? `−${-quantity}` : quantity} ${unit}`;
}

function Remaining({ items }: { items: StockItem[] }) {
  return (
    <table aria-label="Remaining" className="w-full text-left">
      <thead>
        <tr>
          <th>Item</th>
          <th>Left</th>
          <th>Red at or below</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const red = item.quantity <= item.low_stock_threshold;
          return (
            <tr
              key={item.id}
              data-red={red}
              className={red ? 'font-semibold text-red-700' : undefined}
            >
              <td>{item.name}</td>
              <td>{formatQuantity(item.quantity, item.unit)}</td>
              <td>{item.low_stock_threshold}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const STATUS_CLASS: Record<MonthDose['status'] | 'none', string> = {
  taken: 'bg-green-600 border-green-600',
  skipped: 'bg-gray-400 border-gray-400',
  missed: 'bg-red-600 border-red-600',
  pending: 'bg-amber-300 border-amber-400',
  none: 'border-gray-300',
};

/** Every local date of the month: "2026-02-01" … "2026-02-28". */
function daysOf(month: string) {
  const next = addMonths(month, 1);
  const days: string[] = [];
  for (let day = month; day < next;) {
    days.push(day);
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    day = date.toISOString().slice(0, 10);
  }
  return days;
}

function DoseHistory({
  month,
  medications,
  report,
}: {
  month: string;
  medications: StockItem[];
  report: MonthDoseReport;
}) {
  const shown = medications.filter(
    (item) =>
      report.schedules.some((s) => s.stock_item_id === item.id) ||
      report.doses.some((d) => d.stock_item_id === item.id),
  );
  return (
    <div className="space-y-4">
      {shown.map((item) => (
        <MedicationCard
          key={item.id}
          month={month}
          item={item}
          doses={report.doses.filter((d) => d.stock_item_id === item.id)}
          times={[
            ...new Set(
              report.schedules
                .filter((s) => s.stock_item_id === item.id)
                .flatMap((s) => s.times.map((t) => t.slice(0, 5))),
            ),
          ].sort()}
        />
      ))}
    </div>
  );
}

function MedicationCard({
  month,
  item,
  doses,
  times,
}: {
  month: string;
  item: StockItem;
  doses: MonthDose[];
  /** "08:00", the Dose Times in force on any day of the month */
  times: string[];
}) {
  const [selected, setSelected] = useState<MonthDose | null>(null);
  const scheduled = doses.filter((d) => d.dose_schedule_id !== null);
  const asNeeded = doses.filter((d) => d.dose_schedule_id === null);
  const count = (status: MonthDose['status']) =>
    scheduled.filter((d) => d.status === status).length;
  const byCell = new Map(scheduled.map((d) => [`${d.local_date} ${d.local_time.slice(0, 5)}`, d]));
  const days = daysOf(month);

  return (
    <section aria-label={item.name} className="space-y-2 rounded border p-3">
      <h2 className="text-lg font-semibold">{item.name}</h2>
      {times.length > 0 && (
        <>
          <p className="flex gap-4">
            <span>Taken {count('taken')}</span>
            <span>Skipped {count('skipped')}</span>
            <span className="text-red-700">Missed {count('missed')}</span>
          </p>
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-0.5">
              <thead>
                <tr>
                  <th />
                  {days.map((day) => (
                    <th key={day} className="text-xs font-normal">
                      {Number(day.slice(8))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {times.map((time) => (
                  <tr key={time}>
                    <th scope="row" className="pr-1 text-xs font-normal">
                      {time}
                    </th>
                    {days.map((day) => {
                      const dose = byCell.get(`${day} ${time}`);
                      const status = dose?.status ?? 'none';
                      return (
                        <td key={day} data-status={status}>
                          {dose ? (
                            <button
                              type="button"
                              aria-label={`${day} ${time} ${status}`}
                              className={`block size-4 rounded-sm border ${STATUS_CLASS[status]}`}
                              onClick={() => setSelected(dose)}
                            />
                          ) : (
                            <span
                              className={`block size-4 rounded-sm border ${STATUS_CLASS.none}`}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {(times.length === 0 || asNeeded.length > 0) && (
        <div>
          <p>
            Taken {asNeeded.length} {asNeeded.length === 1 ? 'time' : 'times'}
          </p>
          <ul className="text-sm">
            {asNeeded.map((d) => (
              <li key={d.id}>
                {formatLocalDate(d.local_date)} {d.local_time.slice(0, 5)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {selected && (
        <p role="status">
          {selected.local_date}, due {selected.local_time.slice(0, 5)}: {selected.status}
          {selected.taken_at && `, taken at ${formatLocalTime(selected.taken_at)}`}
        </p>
      )}
    </section>
  );
}

function formatLocalTime(at: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(at));
}

/** "2026-02-03" as "3 Feb". */
function formatLocalDate(day: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${day}T00:00:00Z`));
}
