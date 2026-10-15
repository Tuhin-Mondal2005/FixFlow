import { useEffect, useState } from 'react';
import api, { errMsg } from '../services/api';
import { Modal, PageLoader } from './ui';

/**
 * Admin-only viewer for private documents. The file is fetched WITH the admin's JWT (documents are never
 * reachable through a public URL) and shown from an in-memory blob URL that is revoked on close.
 */
export default function DocViewer({ technicianId, doc, label, onClose }) {
  const [state, setState] = useState({ loading: true, url: '', type: '', error: '' });
  useEffect(() => {
    if (!doc) return undefined;
    let url = '';
    let cancelled = false;
    setState({ loading: true, url: '', type: '', error: '' });
    api.get(`/admin/technicians/${technicianId}/documents/${doc.kind}/${doc.index}`, { responseType: 'blob' })
      .then((r) => { if (cancelled) return; url = URL.createObjectURL(r.data); setState({ loading: false, url, type: r.data.type, error: '' }); })
      .catch(async (e) => {
        let msg = errMsg(e);
        if (e.response && e.response.data instanceof Blob) { try { msg = JSON.parse(await e.response.data.text()).message || msg; } catch { /* keep */ } }
        if (!cancelled) setState({ loading: false, url: '', type: '', error: msg });
      });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [technicianId, doc]);

  return (
    <Modal open={Boolean(doc)} onClose={onClose} title={label || 'Document'} wide>
      {state.loading && <PageLoader label="Decrypting document…" />}
      {state.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {state.url && (state.type === 'application/pdf'
        ? <iframe title={label} src={state.url} className="h-[65vh] w-full rounded-xl border border-slate-200" />
        : <img src={state.url} alt={label} className="mx-auto max-h-[65vh] rounded-xl" />)}
      <p className="mt-3 text-xs text-ink-500">Confidential. Viewing is recorded in the audit log. Never share or download this document.</p>
    </Modal>
  );
}
