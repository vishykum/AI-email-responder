import { useGlobalContext, type Message } from "../context/GlobalContext";
import "./styles/Thread.css";
import { ArrowLeft, ReplyAll } from "lucide-react";
import Messages from "./Messages.tsx";
import { useState } from "react";
import ReplyPanes from "./ReplyPanes.tsx";

interface ThreadProps {
  selectedThreadId: string | null;
  setThreadSelected: (threadSelected: boolean) => void;
}

function getThread(id: string | null) {
  if (id === null) return null;

  const { threads } = useGlobalContext();

  const thread = threads?.find((thread) => thread.id === id);

  return thread ? thread : null;
}

export default function Thread({ selectedThreadId, setThreadSelected }: ThreadProps) {
  const thread = getThread(selectedThreadId);
  const [replyOpen, setReplyOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  return (
    <>
      <div className="h-full w-full flex flex-col items-stretch justify-start px-2 py-2">
        {/* Header bar */}
        <div className="w-full rounded-2xl border border-brand-dark/40 bg-brand-dark/30 text-brand-light shadow-sm mb-2">
          <div className="flex items-center gap-2 px-2 py-2">
            <button
              className="w-9 h-9 rounded flex items-center justify-center
                         hover:bg-brand-muted hover:text-brand-primary transition"
              onClick={() => setThreadSelected(false)}
              aria-label="Back to inbox"
            >
              <ArrowLeft size={18} strokeWidth={2} />
            </button>

            <h2 className="flex-1 text-center px-2 text-base font-medium truncate">
              {thread?.subject}
            </h2>

            <button
              className="w-9 h-9 rounded flex items-center justify-center
                         hover:bg-brand-muted hover:text-brand-primary transition"
              aria-label="Reply all"
            >
              <ReplyAll size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 min-h-0 w-full overflow-y-auto rounded-2xl border border-brand-dark/40 bg-brand-dark/20 p-2 shadow-sm">
          <Messages
            messages={thread && thread?.messages ? thread.messages : ([] as Message[])}
            setReplyOpen={setReplyOpen}
            setSelectedMessage={setSelectedMessage}
          />
        </div>
      </div>

      {/* Reply overlay */}
      {replyOpen && (
        <div className="h-full w-full">
          <ReplyPanes
            onClose={() => setReplyOpen(false)}
            message={thread ? selectedMessage : null}
            subject={thread!.subject}
          />
        </div>
      )}
    </>
  );
}
