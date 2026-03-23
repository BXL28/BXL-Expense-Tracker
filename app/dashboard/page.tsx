"use client";

import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

type Category =
  | "Food"
  | "Transport"
  | "Shopping"
  | "Utilities"
  | "Health"
  | "Other";

type Transaction = {
  id: string;
  date: string;
  merchant: string;
  category: Category;
  amount: number;
};

const CATEGORY_OPTIONS: Category[] = [
  "Food",
  "Transport",
  "Shopping",
  "Utilities",
  "Health",
  "Other",
];

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: "1", date: "2026-03-03", merchant: "Carrefour", category: "Food", amount: 54.8 },
  { id: "2", date: "2026-03-08", merchant: "Uber", category: "Transport", amount: 18.9 },
  { id: "3", date: "2026-03-12", merchant: "Amazon", category: "Shopping", amount: 72.4 },
  { id: "4", date: "2026-03-16", merchant: "ENGIE", category: "Utilities", amount: 96.5 },
];

const MONTHLY_BUDGET = 700;

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  // This shape maps directly to a future Supabase "transactions" table fetch.
  const summary = useMemo(() => {
    const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);

    const categorySpend = transactions.reduce<Record<string, number>>((acc, tx) => {
      acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount;
      return acc;
    }, {});

    const topCategory = Object.entries(categorySpend).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";
    const budgetPct = Math.min((totalSpent / MONTHLY_BUDGET) * 100, 100);

    return { totalSpent, topCategory, budgetPct };
  }, [transactions]);

  const handleCategoryChange = (id: string, category: Category) => {
    setTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, category } : tx)));
  };

  const handleDelete = (id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Monthly Summary</h1>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Total Spent"
              value={`€${summary.totalSpent.toFixed(2)}`}
            />
            <SummaryCard label="Top Category" value={summary.topCategory} />
            <SummaryCard
              label="Budget Goal"
              value={`${summary.budgetPct.toFixed(0)}% used`}
            />
          </div>

          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-slate-900 transition-all"
                style={{ width: `${summary.budgetPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Budget: €{MONTHLY_BUDGET.toFixed(2)}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold tracking-tight">Transactions</h2>
          <p className="mt-1 text-sm text-slate-600">
            Inline-edit categories or remove a row.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Merchant</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isEditing = editingRowId === tx.id;

                  return (
                    <tr key={tx.id} className="rounded-xl bg-slate-100/70 text-slate-800">
                      <td className="whitespace-nowrap px-3 py-3">{tx.date}</td>
                      <td className="whitespace-nowrap px-3 py-3">{tx.merchant}</td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <select
                            value={tx.category}
                            onChange={(event) =>
                              handleCategoryChange(tx.id, event.target.value as Category)
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1"
                          >
                            {CATEGORY_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>{tx.category}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">€{tx.amount.toFixed(2)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingRowId((prev) => (prev === tx.id ? null : tx.id))
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {isEditing ? "Done" : "Edit"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(tx.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
