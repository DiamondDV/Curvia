import { useCallback, useState } from 'react';
import { limits } from '@/lib/config/limits';

const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export interface FileUploadState {
  file: File | null;
  previewUrl: string | null;
  error: string | null;
}

/** Drag/drop + file-picker state, validated against the same rules the
 *  server enforces in lib/config/limits.ts + lib/stages/normalize.ts, so
 *  users get instant feedback instead of a round trip to find out. */
export function useFileUpload() {
  const [state, setState] = useState<FileUploadState>({
    file: null,
    previewUrl: null,
    error: null,
  });

  const setFile = useCallback((file: File | null) => {
    if (!file) {
      setState({ file: null, previewUrl: null, error: null });
      return;
    }

    if (!SUPPORTED_TYPES.includes(file.type)) {
      setState({ file: null, previewUrl: null, error: `Unsupported type: ${file.type}` });
      return;
    }

    if (file.size > limits.MAX_FILE_SIZE_BYTES) {
      const maxMb = (limits.MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
      setState({ file: null, previewUrl: null, error: `File too large. Max ${maxMb}MB.` });
      return;
    }

    setState((prev) => {
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file), error: null };
    });
  }, []);

  const reset = useCallback(() => {
    setState((prev) => {
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return { file: null, previewUrl: null, error: null };
    });
  }, []);

  return { ...state, setFile, reset };
}
