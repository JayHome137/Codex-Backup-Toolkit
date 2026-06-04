import { useState } from 'react';
import { Clipboard, Terminal } from 'lucide-react';

type CommandPreviewProps = {
  title: string;
  command: string;
  onCopy?(command: string): Promise<void> | void;
};

export function CommandPreview({ title, command, onCopy }: CommandPreviewProps) {
  const [copied, setCopied] = useState(false);

  const copyCommand = async () => {
    if (onCopy) {
      await onCopy(command);
    } else {
      await navigator.clipboard.writeText(command);
    }
    setCopied(true);
  };

  return (
    <section className="command-preview" aria-label={title}>
      <div className="panel-header">
        <div className="panel-title">
          <Terminal size={16} aria-hidden="true" />
          <span>{title}</span>
        </div>
        <button className="icon-button" type="button" title={`Copy ${title}`} aria-label={`Copy ${title}`} onClick={copyCommand}>
          <Clipboard size={15} aria-hidden="true" />
        </button>
      </div>
      {copied && <span className="copy-status">Copied</span>}
      <pre>
        <code>{command}</code>
      </pre>
    </section>
  );
}
