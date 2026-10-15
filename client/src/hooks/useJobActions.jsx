import { useState } from 'react';
import { ConfirmModal, Field } from '../components/ui';
import { useToast } from '../context/ToastContext';
import api, { errMsg } from '../services/api';

/** Shared accept / reject logic (with a reject confirmation modal) for the dashboard and jobs list. */
export function useJobActions(onChanged) {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const accept = async (job) => {
    setBusyId(job._id);
    try { await api.put(`/jobs/${job._id}/accept`); toast.success(`Accepted request #${job.requestNumber}`); } catch (e) { toast.error(errMsg(e)); } finally { setBusyId(null); onChanged(); }
  };
  const confirmReject = async () => {
    const job = rejecting;
    setBusyId(job._id);
    try { await api.put(`/jobs/${job._id}/reject`, { reason }); toast.info('Request rejected. It was offered to the next technician.'); } catch (e) { toast.error(errMsg(e)); } finally { setBusyId(null); setRejecting(null); setReason(''); onChanged(); }
  };

  const modal = (
    <ConfirmModal open={Boolean(rejecting)} onClose={() => setRejecting(null)} danger busy={Boolean(busyId)} title="Reject this request?" message="It will be offered to the next most suitable technician." confirmLabel="Reject" onConfirm={confirmReject}>
      <div className="mt-3"><Field label="Reason (optional)"><input className="input" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>
    </ConfirmModal>
  );
  return { accept, reject: setRejecting, busyId, modal };
}
