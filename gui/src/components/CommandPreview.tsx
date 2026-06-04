import { Clipboard, Terminal } from 'lucide-react';

type CommandPreviewProps = {
  title: string;
  command: string;
};

export function CommandPreview({ title, command }: CommandPreviewProps) {
  return (
    <section className="command-preview" aria-label={title}>
      <div className="panel-header">
        <div className="panel-title">
          <Terminal size={16} aria-hidden="true" />
          <span>{title}</span>
        </div>
        <button className="icon-button" type="button" title="Copy command" aria-label="Copy command">
          <Clipboard size={15} aria-hidden="true" />
        </button>
      </div>
      <pre>
        <code>{command}</code>
      </pre>
    </section>
  );
}
