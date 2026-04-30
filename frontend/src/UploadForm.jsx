export default function UploadForm({ dirInputRef, pickedFiles, onFolderPick, onClearFolder, disabled }) {
  return (
    <>
      <button
        type="button"
        onClick={pickedFiles ? onClearFolder : () => dirInputRef.current?.click()}
        disabled={disabled}
        className="border border-l-0 border-zinc-800 px-3 text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors disabled:opacity-40 shrink-0"
        title={pickedFiles ? "Clear selection" : "Open local folder"}
      >
        {pickedFiles ? (
          <span className="font-mono text-sm leading-none">×</span>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        )}
      </button>
      <input
        ref={dirInputRef}
        type="file"
        className="hidden"
        onChange={onFolderPick}
        multiple
      />
    </>
  );
}
