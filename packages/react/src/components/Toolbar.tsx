// The bundled toolbar = the primitives in `controls.tsx` arranged in a
// floating pill. Want a different layout/subset? Compose the primitives
// yourself instead of using this.
import {
  SamplesMenu,
  ToolbarDivider,
  BackButton,
  ActiveGroupPill,
  LayoutDirectionButton,
  CollapseAllButton,
  CommentModeButton,
  ResetLayoutButton,
  FitButton,
  ExportButton,
  ShareButton,
  ThemeButton,
} from './controls'

export interface SchemaToolbarProps {
  onFit: () => void
  onExport: () => void
  className?: string
}

export function Toolbar({ onFit, onExport, className }: SchemaToolbarProps) {
  return (
    <div
      className={`absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl backdrop-blur${
        className ? ` ${className}` : ''
      }`}
    >
      <SamplesMenu />
      <ToolbarDivider />
      <BackButton />
      <ActiveGroupPill />
      <LayoutDirectionButton />
      <CollapseAllButton />
      <CommentModeButton />
      <ToolbarDivider />
      <ResetLayoutButton />
      <FitButton onClick={onFit} />
      <ExportButton onClick={onExport} />
      <ShareButton />
      <ToolbarDivider />
      <ThemeButton />
    </div>
  )
}
