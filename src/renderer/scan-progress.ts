export const MAX_SCAN_MODAL_FILES = 120;

export function appendRecentScanFile(
  files: string[],
  currentFile: string | undefined,
  seenFiles: Set<string>
): string[] {
  if (!currentFile || seenFiles.has(currentFile)) {
    return files;
  }

  seenFiles.add(currentFile);
  if (files.length >= MAX_SCAN_MODAL_FILES) {
    return [...files.slice(-(MAX_SCAN_MODAL_FILES - 1)), currentFile];
  }

  return [...files, currentFile];
}
