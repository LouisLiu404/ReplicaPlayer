import { useEffect } from "react";

interface ScanProgressModalProps {
  scan: {
    status: "scanning" | "completed" | "error";
    processedFiles: number;
    discoveredFiles: number;
    message: string;
    files: string[];
  } | null;
  onClose: () => void;
  toFileLabel: (filePath: string) => string;
}

export function ScanProgressModal({ scan, onClose, toFileLabel }: ScanProgressModalProps) {
  const isScanning = scan?.status === "scanning";

  useEffect(() => {
    if (!scan || isScanning) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isScanning, onClose, scan]);

  if (!scan) {
    return null;
  }
  const title =
    scan.status === "completed"
      ? "Scan complete"
      : scan.status === "error"
        ? "Scan failed"
        : "Scanning library";
  const progressRatio =
    scan.discoveredFiles > 0
      ? Math.min(scan.processedFiles / scan.discoveredFiles, 1)
      : isScanning
        ? 0.08
        : 1;

  return (
    <div className="scan-modal-backdrop" role="presentation">
      <section
        className="scan-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-modal-title"
      >
        <div className="scan-modal-header">
          <div>
            <p className="section-kicker">Library Scan</p>
            <h2 id="scan-modal-title">{title}</h2>
            <p className="scan-modal-copy">{scan.message}</p>
          </div>

          {isScanning ? <div className="loading-spinner large" aria-hidden="true" /> : null}
        </div>

        <div className="scan-modal-progress">
          <div className="scan-modal-progress-copy">
            <strong>{`${scan.processedFiles} / ${scan.discoveredFiles || "?"} files`}</strong>
            <span>{isScanning ? "Working…" : "Finished"}</span>
          </div>
          <div className="scan-pill-track" aria-hidden="true">
            <div className="scan-pill-fill" style={{ width: `${Math.max(progressRatio * 100, isScanning ? 8 : 100)}%` }} />
          </div>
        </div>

        <div className="scan-modal-file-list">
          {scan.files.length === 0 ? (
            <div className="scan-modal-empty">
              <div className="loading-spinner" aria-hidden="true" />
              <span>{isScanning ? "Waiting for files…" : "No files were scanned."}</span>
            </div>
          ) : (
            scan.files.map((filePath, index) => (
              <div key={`${filePath}-${index}`} className="scan-modal-file-row">
                <span className="scan-modal-file-index">{index + 1}</span>
                <span className="scan-modal-file-name">{toFileLabel(filePath)}</span>
              </div>
            ))
          )}
        </div>

        {!isScanning ? (
          <div className="scan-modal-actions">
            <button type="button" className="cta-button" onClick={onClose}>
              OK
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
