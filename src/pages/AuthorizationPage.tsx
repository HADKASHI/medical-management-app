import { Link, useNavigate, useParams } from 'react-router';
import {
  AuthorizationForm,
  type AuthorizationDraft,
} from '@/features/authorizations/AuthorizationForm';
import {
  useArchiveAuthorization,
  useAuthorizations,
  useDeleteAuthorization,
  useSaveAuthorization,
  type Authorization,
  type AuthorizationInput,
} from '@/features/authorizations/authorizations';
import { useStockItems } from '@/features/stock/stockItems';

/** A Renewal starts from the old Authorization, with new dates still to enter. */
function renewalDraft(old: Authorization): AuthorizationDraft {
  return {
    type: old.type,
    reference_number: old.reference_number,
    covers: old.covers,
    stock_item_id: old.stock_item_id,
    issued_on: null,
    expires_on: null,
  };
}

/**
 * Create an Authorization (`/authorizations/new`), edit, archive or delete one
 * (`/authorizations/:id`), or renew one (`/authorizations/:id/renew`).
 */
export function AuthorizationPage({ renew = false }: { renew?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const authorizations = useAuthorizations();
  const stockItems = useStockItems();
  const save = useSaveAuthorization();
  const archive = useArchiveAuthorization();
  const remove = useDeleteAuthorization();
  const authorization = id ? authorizations.data?.find((a) => a.id === id) : undefined;
  const error = save.error ?? archive.error ?? remove.error;
  const backToList = () => navigate('/authorizations');

  if (id && authorizations.isPending) return <p className="p-4">Loading…</p>;
  if (id && !authorization) {
    return (
      <main className="mx-auto max-w-xl space-y-4 p-4">
        <p>Authorization not found.</p>
        <Link to="/authorizations" className="underline">
          Authorizations
        </Link>
      </main>
    );
  }

  const selectable = (stockItems.data ?? []).filter(
    (item) => !item.archived_at || item.id === authorization?.stock_item_id,
  );
  const editing = authorization && !renew ? authorization : undefined;
  const initial = authorization && renew ? renewalDraft(authorization) : authorization;

  function handleSubmit(input: AuthorizationInput) {
    if (editing) save.mutate({ id: editing.id, input }, { onSuccess: backToList });
    else
      save.mutate(
        { input: renew ? { ...input, renews_authorization_id: authorization!.id } : input },
        { onSuccess: backToList },
      );
  }

  const heading = renew
    ? 'Renew Authorization'
    : editing
      ? 'Edit Authorization'
      : 'New Authorization';

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{heading}</h1>
      {editing?.renewed && <p className="text-gray-600">Renewed</p>}
      {editing?.archived_at && <p className="text-gray-600">Archived</p>}
      <AuthorizationForm
        key={heading}
        initial={initial}
        stockItems={selectable}
        submitting={save.isPending}
        onSubmit={handleSubmit}
      />
      {editing && (
        <div className="flex flex-wrap gap-2">
          {!editing.renewed && !editing.archived_at && (
            <Link
              to={`/authorizations/${editing.id}/renew`}
              className="rounded border border-gray-300 px-4 py-2"
            >
              Renew
            </Link>
          )}
          {!editing.archived_at && (
            <button
              type="button"
              disabled={archive.isPending}
              className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
              onClick={() => archive.mutate(editing.id, { onSuccess: backToList })}
            >
              Archive
            </button>
          )}
          <button
            type="button"
            disabled={remove.isPending}
            className="rounded border border-red-300 px-4 py-2 text-red-700 disabled:opacity-50"
            onClick={() => {
              if (window.confirm('Delete this Authorization? Only for one entered by mistake.'))
                remove.mutate(editing.id, { onSuccess: backToList });
            }}
          >
            Delete
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error.message}
        </p>
      )}
      <Link to="/authorizations" className="block underline">
        Authorizations
      </Link>
    </main>
  );
}
