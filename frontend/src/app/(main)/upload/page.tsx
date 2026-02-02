'use client';

import { useState, useEffect } from 'react';
import { documents, accounts } from '@/lib/api';
import { useTranslation } from '@/i18n/context';

type ProgressState = {
  phase: 'idle' | 'upload' | 'processing' | 'done';
  uploadPercent: number;
  status: string;
  transactionsCount?: number;
  fileName?: string;
};

export default function UploadPage() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState('');
  const [accountsList, setAccountsList] = useState<Array<{ id: string; name: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [recent, setRecent] = useState<Array<{ id: string; fileName: string; status: string; uploadedAt: string; _count?: { transactions: number } }>>([]);
  const [progress, setProgress] = useState<ProgressState>({ phase: 'idle', uploadPercent: 0, status: '' });

  useEffect(() => {
    accounts.list().then((a) => setAccountsList(a)).catch(() => {});
    documents.list().then((r) => setRecent(r)).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !accountId) {
      setMessage({ type: 'error', text: t('upload.selectFileAndAccount') });
      return;
    }
    setUploading(true);
    setMessage(null);
    setProgress({ phase: 'upload', uploadPercent: 0, status: t('upload.uploading'), fileName: file.name });
    let finalStatus: string | undefined;
    try {
      await documents.uploadWithProgress(file, accountId, (state) => {
        if (state.phase === 'upload') {
          setProgress((p) => ({ ...p, phase: 'upload', uploadPercent: state.uploadPercent ?? 0, status: t('upload.uploadingPercent', { percent: state.uploadPercent ?? 0 }) }));
        } else if (state.phase === 'processing') {
          setProgress((p) => ({
            ...p,
            phase: 'processing',
            status: state.status === 'PROCESSING' ? t('upload.processing') : (state.status ?? t('upload.processing')),
          }));
        } else {
          const count = state.transactionsCount ?? state.document?._count?.transactions ?? 0;
          finalStatus = state.document?.status;
          setProgress((p) => ({
            ...p,
            phase: 'done',
            status: state.document?.status === 'COMPLETED'
              ? t('upload.doneCount', { count })
              : state.document?.status === 'FAILED'
                ? t('upload.doneFailed')
                : (state.status ?? ''),
            transactionsCount: state.transactionsCount ?? state.document?._count?.transactions,
          }));
        }
      });
      // Show message based on actual document status
      if (finalStatus === 'FAILED') {
        setMessage({ type: 'error', text: t('upload.processingFailed') });
      } else if (finalStatus === 'COMPLETED') {
        setMessage({ type: 'success', text: t('upload.successMessage') });
        setFile(null);
      } else {
        // Still processing or unknown status - don't show message yet
        setFile(null);
      }
      documents.list().then((r) => setRecent(r)).catch(() => {});
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('upload.uploadFailed') });
    } finally {
      setUploading(false);
      setTimeout(() => setProgress({ phase: 'idle', uploadPercent: 0, status: '' }), 2500);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{t('upload.title')}</h1>
      <p className="text-slate-600 dark:text-slate-400">
        {t('upload.description')}
      </p>
      <div className="card max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('upload.account')}</label>
            {accountsList.length === 0 ? (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                  {t('upload.noAccountsYet')}
                </p>
                <a href="/settings" className="text-sm text-primary-600 hover:underline font-medium">
                  {t('upload.goToSettings')} →
                </a>
              </div>
            ) : (
              <>
                <select
                  className="input"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  required
                >
                  <option value="">{t('common.chooseAccount')}</option>
                  {accountsList.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1.5">
                  {t('upload.accountHint')}
                </p>
              </>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('upload.fileLabel')}</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {message && (
            <p
              className={`text-sm ${
                message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {message.text}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={uploading}>
            {uploading ? t('upload.uploadingProcessing') : t('upload.upload')}
          </button>
          {(progress.phase === 'upload' || progress.phase === 'processing' || progress.phase === 'done') && (
            <div className="mt-4 p-4 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[var(--border)]">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{progress.fileName ?? t('common.file')}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all duration-300 ease-out"
                    style={{
                      width:
                        progress.phase === 'upload'
                          ? `${progress.uploadPercent}%`
                          : progress.phase === 'processing'
                            ? '60%'
                            : '100%',
                    }}
                  />
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400 min-w-[140px]">{progress.status}</span>
              </div>
              {progress.phase === 'processing' && (
                <p className="text-xs text-slate-500 mt-2">{t('upload.ocrMayTakeMinute')}</p>
              )}
            </div>
          )}
        </form>
      </div>
      {recent.length > 0 && (
        <div className="card">
          <h2 className="font-medium mb-4">{t('upload.recentUploads')}</h2>
          <ul className="space-y-2">
            {recent.slice(0, 10).map((d) => (
              <li key={d.id} className="flex flex-col gap-1 py-2 border-b border-[var(--border)] last:border-0">
                <div className="flex justify-between items-center">
                  <span>{d.fileName}</span>
                  <span
                    className={`text-sm ${
                      d.status === 'COMPLETED'
                        ? 'text-green-600'
                        : d.status === 'FAILED'
                          ? 'text-red-600'
                          : 'text-slate-500'
                    }`}
                  >
                    {d.status === 'COMPLETED' && d._count?.transactions != null
                      ? t('upload.doneCount', { count: d._count.transactions })
                      : d.status === 'FAILED'
                        ? t('upload.doneFailed')
                        : d.status === 'PROCESSING'
                          ? t('upload.processing')
                          : d.status}
                  </span>
                </div>
                {d.status === 'COMPLETED' && (d._count?.transactions ?? 0) === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {t('upload.noTransactionsExtracted')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
