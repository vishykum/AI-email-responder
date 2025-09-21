import { useLayoutEffect, useRef } from "react";
import { useGlobalContext, type Message } from "../context/GlobalContext";
import "./styles/Messages.css";
import DOMPurify from "dompurify";
import { Reply } from "lucide-react";

interface MessagesProps {
  messages: Message[];
  setReplyOpen: (isOpen: boolean) => void;
  setSelectedMessage: (message: Message) => void;
}

interface MessageProps {
  message: Message;
  setReplyOpen: (isOpen: boolean) => void;
  setSelectedMessage: (message: Message) => void;
}

// Just to check if JSON returned by server is an array of strings
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export function EmailHtmlIframe({ html }: { html: string }) {
  // Sanitize whole document
  const clean = DOMPurify.sanitize(html, { WHOLE_DOCUMENT: true });

  // Inject base + minimal CSS so content fits, wraps, and uses white text on dark bg
  const srcDoc = clean.replace(
    "</head>",
    `<base target="_blank" />
     <style>
       html, body {
         margin: 0; padding: 0; max-width: 100%;
         background: transparent !important;
         color: #fff !important;                 /* make text white */
       }
       a { color: #9ecbff !important; }          /* readable link color */
       img, video { max-width: 100%; height: auto; }
       table { width: 100%; }
       * { word-break: break-word; }
       blockquote {
         border-left: 2px solid rgba(255,255,255,.25);
         margin: 0; padding-left: .75rem;
       }
     </style></head>`
  );

  return (
    <div className="relative w-full h-full">
      <iframe
        title="Email"
        className="absolute inset-0 w-full h-full border-0"
        sandbox=""
        referrerPolicy="no-referrer"
        srcDoc={srcDoc}
      />
    </div>
  );
}

function Message({ message, setReplyOpen, setSelectedMessage }: MessageProps) {
  const timestamp = new Date(message.internal_date).toLocaleString();

  function onClickReply() {
    setReplyOpen(true);
    setSelectedMessage(message);
  }

  return (
    <article className="rounded-2xl border border-brand-dark/40 bg-brand-dark/20 text-brand-light shadow-sm overflow-hidden">
      {/* Header */}
      <header className="bg-brand-dark/60 text-brand-light border-b border-brand-dark/40 px-4 py-3">
        <div className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-brand-light/80 shrink-0">From:</span>
              <span className="truncate">{message.from_address}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-brand-light/80 shrink-0">To:</span>
              <span className="min-w-0 break-words">
                {isStringArray(message.to_addresses)
                  ? message.to_addresses.join(", ")
                  : "Invalid format"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="text-xs text-brand-light/70">{timestamp}</div>
            <button
              onClick={onClickReply}
              className="rounded p-1 hover:bg-brand-muted hover:text-brand-primary transition"
              aria-label="Reply"
            >
              <Reply size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="p-3">
        {message.body_html ? (
          <div className="h-[60vh] w-full overflow-auto rounded-lg border border-brand-dark/40 bg-brand-dark/10 text-brand-light">
            <EmailHtmlIframe html={message.body_html} />
          </div>
        ) : (
          <pre className="p-3 text-sm whitespace-pre-wrap break-words max-w-full rounded-lg border border-brand-dark/40 bg-brand-dark/10">
            {message.body_text ?? ""}
          </pre>
        )}
      </div>
    </article>
  );
}

export default function Messages({
  messages,
  setReplyOpen,
  setSelectedMessage,
}: MessagesProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // To ensure the most recent Message will be in view
  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages.length]);

  return (
    <div className="h-full w-full flex flex-col gap-3">
      {messages.map((message, idx) => {
        const card = (
          <div className="text-brand-light">
            <Message
              message={message}
              setReplyOpen={setReplyOpen}
              setSelectedMessage={setSelectedMessage}
            />
          </div>
        );

        if (idx === messages.length - 1) {
          return (
            <div ref={bottomRef} key={message.id}>
              {card}
            </div>
          );
        }

        return <div key={message.id}>{card}</div>;
      })}
    </div>
  );
}
