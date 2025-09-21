import { useGlobalContext } from "../context/GlobalContext";
import "./styles/InboxTable.css";
import { FlagIcon, Trash2Icon } from "lucide-react";

//Get sender name from from_address provided by email provider
function getFromName(from_address: string): string {
  return from_address.split(" <")[0].replaceAll('"', '');
}

interface InboxTableProps {
  setThreadSelected: (threadSelected: boolean) => void;
  setSelectedThreadId: (selectedThreadId: string|null) => void
};

function getEmailRows(
  setThreadSelected: (threadSelected: boolean) => void,
  setSelectedThreadId: (selectedThreadId: string|null) => void
) {
  const {threads} = useGlobalContext();

  function handleOnClick(id: string) {
    setThreadSelected(true);
    setSelectedThreadId(id);
  }

  return (
    <>
      {threads?.map((thread) => {
        const timestamp = new Date(thread.last_message_at).toLocaleString();

        return (
          <tr
            key={thread.id}
            className="group/row cursor-pointer bg-transparent text-brand-light
                       hover:bg-brand-muted hover:text-brand-primary transition-colors"
            onClick={() => handleOnClick(thread.id)}
          >
            {/* FROM */}
            <td className="px-4 py-3 align-middle border-b border-brand-dark/40">
              {thread.messages.length > 0
                ? getFromName(thread.messages[0].from_address)
                : "No messages"}
            </td>

            {/* SUBJECT + ACTIONS + TIMESTAMP */}
            <td className="px-4 py-3 align-middle border-b border-brand-dark/40">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <span className="truncate">
                    {thread.subject || "(no subject)"}
                  </span>

                  {/* Row actions – appear on hover */}
                  <div className="hidden group-hover/row:flex items-center gap-1">
                    <button
                      className="p-1 rounded hover:bg-blue-500 hover:text-brand-primary transition"
                      aria-label="Flag"
                    >
                      <FlagIcon size={16} strokeWidth={2} />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-red-500 hover:text-brand-primary transition"
                      aria-label="Delete"
                    >
                      <Trash2Icon size={16} strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {/* Timestamp */}
                <div className="shrink-0 w-44 text-right text-xs text-brand-light/60
                                group-hover/row:text-brand-primary">
                  {timestamp}
                </div>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

export default function InboxTable ({setThreadSelected, setSelectedThreadId}: InboxTableProps) {
  return (
    <div className="rounded-2xl border border-brand-dark/40 bg-brand-dark/20 shadow-sm overflow-hidden">
      <table className="w-full table-fixed text-sm">
        <thead className="bg-brand-dark/30">
          <tr className="text-left text-xs uppercase tracking-wide text-brand-light/80">
            <th className="px-4 py-2 w-1/4 border-b border-brand-dark/40" scope="col">
              From
            </th>
            <th className="px-4 py-2 border-b border-brand-dark/40" scope="col">
              Subject
            </th>
          </tr>
        </thead>

        <tbody className="bg-brand-primary/0 text-brand-light">
          {getEmailRows(setThreadSelected, setSelectedThreadId)}
        </tbody>
      </table>
    </div>
  );
}
