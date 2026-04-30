import { RefObject } from "react";

interface Props {
  repoUrl: string;
  setRepoUrl: (v: string) => void;
  pickedFiles: FileList | null;
  setPickedFiles: (v: FileList | null) => void;
  dirInputRef: RefObject<HTMLInputElement>;
  disabled: boolean;
}

export default function UrlForm({
  repoUrl,
  setRepoUrl,
  pickedFiles,
  setPickedFiles,
  dirInputRef,
  disabled,
}: Props) {
  return (
    <input
      type="text"
      value={repoUrl}
      onChange={(e) => {
        if (pickedFiles) {
          setPickedFiles(null);
          if (dirInputRef.current) dirInputRef.current.value = "";
        }
        setRepoUrl(e.target.value);
      }}
      placeholder="https://github.com/user/repo  —  or select a local folder →"
      className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 text-white font-mono text-base px-4 py-3 focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700 transition-colors disabled:opacity-40"
      required={!pickedFiles}
      disabled={disabled}
      readOnly={!!pickedFiles}
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
    />
  );
}
