import "./styles/Inbox.css";
import InboxTable from "./InboxTable";
import { useRef, useState, useLayoutEffect } from "react";
import Thread from "./Thread";
import { useGlobalContext } from "../context/GlobalContext";
import { PlusSquare, X, PanelLeftOpenIcon, PanelLeftCloseIcon } from "lucide-react";
import Compose from "./Compose";

function AccountAddModal({ onClose }: { onClose: () => void }) {
  async function handleGoogleSubmit() {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/gmail/connect`;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <div className="h-[60vh] w-[40vw] max-w-xl rounded-2xl border border-brand-dark/40 bg-brand-dark/30 text-brand-light shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="w-full flex items-center gap-2 bg-brand-dark px-3 py-2">
          <button
            className="p-1 rounded hover:bg-brand-muted hover:text-brand-primary transition"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} strokeWidth={2} />
          </button>
          <h2 className="flex-1 text-center text-lg font-semibold">Connect New Account</h2>
        </div>

        {/* Body */}
        <div className="flex-1 grid place-items-center p-6">
          <button
            className="rounded-xl border border-brand-dark/40 bg-brand-primary/30 px-5 py-3 text-brand-light transition
                       hover:bg-brand-muted hover:text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            onClick={handleGoogleSubmit}
          >
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}

interface AccountFoldersProps {
  email_address: string;
  onAccountChange: (email_address: string) => void;
  selectedAccount: string | null;
  mailbox: string;
  setMailbox: (mailbox: "INBOX" | "SENT") => void;
  onCompose: () => void;
}

function AccountFolders({
  email_address,
  onAccountChange,
  selectedAccount,
  mailbox,
  setMailbox,
  onCompose,
}: AccountFoldersProps) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const selectedStyle = "bg-brand-muted text-brand-primary";

  function changeMailbox(e: React.MouseEvent<HTMLButtonElement>) {
    onAccountChange(email_address);
    setMailbox((e.currentTarget.id as "INBOX" | "SENT") ?? "INBOX");
  }

  function clickCompose() {
    onAccountChange(email_address);
    onCompose();
  }

  useLayoutEffect(() => {
    if (btnRef.current && selectedAccount && selectedAccount === email_address) {
      btnRef.current.click();
    }
  }, [btnRef, selectedAccount, email_address]);

  const itemBase =
    "w-full text-left px-3 py-2 text-sm transition border-b border-brand-dark/30 hover:bg-brand-muted hover:text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40";

  return (
    <div className="w-full rounded-2xl border border-brand-dark/40 bg-brand-dark/20 text-brand-light overflow-hidden">
      <h2 className="w-full px-3 py-2 text-sm font-semibold border-b border-brand-dark/40 text-brand-light/90 truncate">
        {email_address}
      </h2>
      <button id="COMPOSE" onClick={clickCompose} className={`${itemBase}`}>
        Compose
      </button>
      <button
        ref={btnRef}
        id="INBOX"
        onClick={changeMailbox}
        className={`${mailbox === "INBOX" && selectedAccount === email_address ? selectedStyle : ""} ${itemBase}`}
      >
        Inbox
      </button>
      <button
        id="SENT"
        onClick={changeMailbox}
        className={`${mailbox === "SENT" && selectedAccount === email_address ? selectedStyle : ""} ${itemBase} border-b-0`}
      >
        Sent
      </button>
    </div>
  );
}

export default function Inbox() {
  const [threadSelected, setThreadSelected] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const { user, selectedAccount, setSelectedAccount, mailbox, setMailbox } = useGlobalContext();
  const [addAccount, setAddAccount] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [accountsCollapsed, setAccountsCollapsed] = useState(false);

  function onAccountChange(email_address: string) {
    const account = user ? user.accounts.filter((a) => a.email_address === email_address) : null;
    if (account && account.length > 0) setSelectedAccount(account[0]);
  }

  return (
    <>
      {threadSelected ? (
        <div className="h-full w-full overflow-auto">
          <Thread selectedThreadId={selectedThreadId} setThreadSelected={setThreadSelected} />
        </div>
      ) : (
        <div className="h-full w-full overflow-auto flex flex-row items-start justify-center bg-transparent">
          {/* Sidebar wrapper with animated width */}
          <div
            className={`relative h-full border-r border-brand-dark/40 bg-brand-primary text-brand-light transition-[width] duration-300 ease-in-out
                       ${accountsCollapsed ? "w-10" : "w-72"}`}
          >
            {/* Collapsed rail */}
            {accountsCollapsed ? (
              <div className="h-full flex flex-col">
                <button
                  className="m-2 rounded p-1 hover:bg-brand-muted hover:text-brand-primary transition"
                  onClick={() => setAccountsCollapsed(false)}
                  aria-label="Expand accounts"
                >
                  <PanelLeftOpenIcon size={20} strokeWidth={2} />
                </button>
              </div>
            ) : (
              /* Expanded accounts panel (fades/slides in) */
              <div className="h-full flex flex-col items-center gap-3 mt-2 text-brand-light px-2 transition-all duration-300 ease-out opacity-100 translate-x-0">
                {/* Panel header (add + collapse) */}
                <div className="w-full flex items-center">
                  <div className="flex-1 flex justify-center">
                    <button
                      className="rounded p-2 hover:bg-brand-muted hover:text-brand-primary transition"
                      onClick={() => setAddAccount(true)}
                      aria-label="Add account"
                    >
                      <PlusSquare size={28} strokeWidth={2} />
                    </button>
                  </div>
                  <button
                    className="rounded p-2 hover:bg-brand-muted hover:text-brand-primary transition"
                    onClick={() => setAccountsCollapsed(true)}
                    aria-label="Collapse accounts"
                  >
                    <PanelLeftCloseIcon size={20} strokeWidth={2} />
                  </button>
                </div>

                {/* Accounts list */}
                <div className="w-64 space-y-3">
                  {user &&
                    user.accounts &&
                    user.accounts.length &&
                    user.accounts.length > 0 &&
                    user.accounts.map((account) => (
                      <AccountFolders
                        key={account.email_address}
                        email_address={account.email_address}
                        onAccountChange={onAccountChange}
                        selectedAccount={selectedAccount?.email_address ?? user.accounts[0].email_address}
                        mailbox={mailbox}
                        setMailbox={setMailbox}
                        onCompose={() => {
                          setComposeOpen(true);
                        }}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Threads table area */}
          <div className="flex-1 px-2">
            <InboxTable setThreadSelected={setThreadSelected} setSelectedThreadId={setSelectedThreadId} />
          </div>

          {addAccount && <AccountAddModal onClose={() => setAddAccount(false)} />}
          {composeOpen && <Compose onClose={() => setComposeOpen(false)} />}
        </div>
      )}
    </>
  );
}
