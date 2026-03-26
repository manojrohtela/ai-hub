import { FileSearch, Hash, Sigma } from "lucide-react";
import { AnswerAudit } from "../api";

interface AuditTrailProps {
  audit?: AnswerAudit;
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AuditTrail({ audit }: AuditTrailProps) {
  if (!audit) {
    return null;
  }

  const evidence = audit.evidence?.filter(Boolean) ?? [];
  const columnsUsed = audit.columns_used?.filter(Boolean) ?? [];
  const dimensions = audit.dimensions?.filter(Boolean) ?? [];
  const datasetRows = audit.dataset_scope?.rows;

  if (
    !audit.question_type &&
    columnsUsed.length === 0 &&
    evidence.length === 0 &&
    !audit.generated_query &&
    !audit.result_preview
  ) {
    return null;
  }

  return (
    <details className="app-surface-muted mt-3 rounded-2xl border px-4 py-3 text-xs text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-cyan-500 dark:text-cyan-100">
        <FileSearch className="h-3.5 w-3.5" />
        Audit & citations
      </summary>

      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {audit.question_type ? (
            <span className="app-chip rounded-full border px-3 py-1">
              Intent: {humanize(audit.question_type)}
            </span>
          ) : null}
          {audit.metric ? (
            <span className="app-chip rounded-full border px-3 py-1">
              <Sigma className="mr-1 inline h-3 w-3" />
              Metric: {humanize(audit.metric)}
            </span>
          ) : null}
          {typeof datasetRows === "number" ? (
            <span className="app-chip rounded-full border px-3 py-1">
              Rows reviewed: {datasetRows.toLocaleString()}
            </span>
          ) : null}
        </div>

        {dimensions.length > 0 ? (
          <p className="text-muted-foreground">Detected dimensions: {dimensions.map(humanize).join(", ")}</p>
        ) : null}

        {columnsUsed.length > 0 ? (
          <div>
            <p className="mb-2 flex items-center gap-2 text-foreground">
              <Hash className="h-3.5 w-3.5" />
              Columns used
            </p>
            <div className="flex flex-wrap gap-2">
              {columnsUsed.map((column) => (
                <span
                  key={column}
                  className="app-surface-inset rounded-full border px-3 py-1 text-[11px] text-foreground"
                >
                  {column}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {evidence.length > 0 ? (
          <div className="space-y-2">
            {evidence.map((item, index) => (
              <div
                key={`audit-evidence-${index}`}
                className="app-surface-inset rounded-xl border px-3 py-2 leading-relaxed text-muted-foreground"
              >
                {item}
              </div>
            ))}
          </div>
        ) : null}

        {audit.generated_query ? (
          <div className="app-surface-inset rounded-xl border px-3 py-3">
            <p className="mb-2 text-foreground">Generated query</p>
            <code className="block whitespace-pre-wrap break-words text-[11px] leading-relaxed text-cyan-600 dark:text-cyan-100">
              {audit.generated_query}
            </code>
          </div>
        ) : null}

        {audit.result_preview ? (
          <div className="app-surface-inset rounded-xl border px-3 py-3 text-muted-foreground">
            <p className="mb-2 text-foreground">Result preview</p>
            <p className="whitespace-pre-wrap break-words leading-relaxed">{audit.result_preview}</p>
          </div>
        ) : null}
      </div>
    </details>
  );
}
