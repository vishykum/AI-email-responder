import { useGlobalContext, type Message } from "../context/GlobalContext";
import "./styles/ReplyPanes.css";
import { X, SendIcon } from "lucide-react";
import { EmailHtmlIframe } from "./Messages";
import { useEffect, useRef, useState } from "react";
import axios from "axios";

async function generateReply(prompt: string): Promise<string> {
  console.log("Generating reply...");
  console.log("Sending details to server...");

  try {
    const resp = await axios.post(
      `${import.meta.env.VITE_API_URL}/api/ai/chat`,
      { prompt },
      { withCredentials: true }
    );

    console.log("Response received from server...");
    console.log(`Response: ${JSON.stringify(resp.data)}`);

    if (resp && resp.data.response) {
      const response = JSON.parse(resp.data.response);
      if (response && response.body) return response.body;
      return resp.data.response;
    }
    return "";
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      console.error("Error authenticating user: ", err.response?.data || err.message);
    } else {
      console.error("Unexpected error: ", err);
    }
    return "";
  }
}

export default function Compose({ onClose }: { onClose: () => void }) {
  const promptElementRef = useRef<HTMLTextAreaElement>(null);
  const [generatedReply, setGeneratedReply] = useState("");
  const { selectedAccount } = useGlobalContext();
  const [subject, setSubject] = useState("");
  const [toList, setToList] = useState<string[]>([]);
  const [toInput, setToInput] = useState("");

  const COMMIT_KEYS = ["Enter", ",", ";", " "];
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

  const extractEmails = (s: string) => (s.match(emailRegex) ?? []).map((x) => x.trim().toLowerCase());

  const commit = (raw: string) => {
    const emails = extractEmails(raw);
    if (!emails.length) return;
    setToList((prev) => Array.from(new Set([...prev, ...emails])));
    setToInput("");
  };

  const onToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setToInput(v);
    if (/[,\s;]$/.test(v)) commit(v);
  };

  const onToKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (COMMIT_KEYS.includes(e.key)) {
      e.preventDefault();
      commit(toInput);
    }
  };

  const onToPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (/[,\s;]/.test(text)) {
      e.preventDefault();
      commit(text);
    }
  };

  const onToBlur = () => {
    if (toInput.trim()) commit(toInput);
  };

  const onToClose = (toToDelete: string) => {
    setToList(toList.filter((to) => to !== toToDelete));
  };

  const handleGenerateClick = async () => {
    const text = (promptElementRef.current?.value ?? "").trim();
    const generated = await generateReply(text);
    setGeneratedReply(generated);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGeneratedReply(e.target.value);
  };

  const onSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSubject(e.target.value);
  };

  const handleSend = async () => {
    console.log("Sending email...");
    const resp = await axios.post(
      `${import.meta.env.VITE_API_URL}/api/gmail/send`,
      {
        gmail_address: selectedAccount!.email_address,
        body_text: generatedReply,
        to: toList,
        subject,
      },
      { withCredentials: true }
    );

    if (resp) {
      console.log(`Response: ${JSON.stringify(resp.data)}`);
    } else {
      console.log("Response sent incorrectly");
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 h-full w-full z-50 bg-black/60 backdrop-blur-sm">
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
        {/* Close button */}
        <div className="flex justify-end items-center mr-1">
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-full
                       border border-brand-dark/40 bg-brand-primary/40 text-brand-light
                       hover:bg-brand-muted hover:text-brand-primary
                       focus:outline-none focus:ring-2 focus:ring-brand-primary/40 transition"
            onClick={onClose}
            aria-label="Close composer"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Panes */}
        <div className="flex flex-row justify-around items-start gap-4 text-brand-light">
          {/* Prompt Pane */}
          <div className="h-[80vh] w-[30vw] bg-brand-dark/30 rounded-2xl overflow-hidden shadow-xl flex flex-col border border-brand-dark/40">
            <div className="sticky top-0 bg-brand-dark text-brand-light text-center px-3 py-1">
              <h2 className="text-base font-semibold">Prompt</h2>
            </div>

            <div className="flex-1 min-h-0 p-2">
              <textarea
                ref={promptElementRef}
                className="h-full w-full resize-none rounded-lg border border-brand-dark/40 bg-brand-dark/10
                           p-2 text-brand-light placeholder-brand-light/60 text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary"
                placeholder="Describe how you’d like the reply to sound (tone, key points, length)…"
              />
            </div>

            <div className="px-2 pb-2">
              <button
                className="w-full rounded-lg border border-brand-dark/40 bg-brand-primary/30 px-3 py-2 text-brand-light
                           transition hover:bg-brand-muted hover:text-brand-primary
                           focus:outline-none focus:ring-2 focus:ring-brand-primary/40 text-sm"
                onClick={handleGenerateClick}
              >
                Generate
              </button>
            </div>
          </div>

          {/* Send Pane */}
          <div className="h-[80vh] w-[30vw] bg-brand-dark/30 rounded-2xl overflow-hidden shadow-xl flex flex-col border border-brand-dark/40">
            {/* Header */}
            <div className="sticky top-0 bg-brand-dark text-brand-light text-center px-3 py-1">
              <h2 className="text-base font-semibold">Send</h2>
            </div>

            {/* CONTENT SCROLLS TOGETHER (everything between header and footer) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
              {/* From — very compact row */}
              <div className="flex items-center gap-2 border-b border-brand-dark/40 py-0.5 text-[12px] leading-5">
                <label className="text-brand-light/80 shrink-0">From:</label>
                <span className="text-brand-light/90 truncate">{selectedAccount?.email_address}</span>
              </div>

              {/* To — label + input/chips on ONE ROW */}
              <div className="flex items-center gap-2 border-b border-brand-dark/40 py-0.5 text-[12px] leading-5">
                <label className="text-brand-light/80 shrink-0">To:</label>
                <div className="flex-1 min-w-0 flex items-center flex-wrap gap-1">
                  {toList &&
                    toList.map((to) => (
                      <div
                        key={to}
                        className="group relative inline-flex items-center gap-1 rounded-md bg-brand-dark px-2 py-0.5"
                      >
                        <span className="truncate">{to}</span>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity
                                     inline-flex h-4 w-4 items-center justify-center rounded
                                     text-brand-light/80 hover:bg-brand-muted hover:text-brand-primary"
                          onClick={() => onToClose(to)}
                          aria-label={`Remove ${to}`}
                        >
                          <X size={12} strokeWidth={2} />
                        </button>
                      </div>
                    ))}

                  <input
                    value={toInput}
                    onChange={onToChange}
                    onKeyDown={onToKeyDown}
                    onPaste={onToPaste}
                    onBlur={onToBlur}
                    className="flex-1 min-w-[8rem] h-7 bg-transparent text-[13px]
                               focus:outline-none focus:ring-0"
                    placeholder="Add recipients…"
                  />
                </div>
              </div>

              {/* Subject — compact row */}
              <div className="flex items-center gap-2 border-b border-brand-dark/40 py-0.5 text-[12px] leading-5">
                <label className="text-brand-light/80 shrink-0">Subject:</label>
                <input
                  value={subject}
                  onChange={onSubjectChange}
                  className="w-full rounded-md border border-brand-dark/40 bg-brand-dark/10 px-2 py-1
                             text-[13px] text-brand-light placeholder-brand-light/60
                             focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary"
                  placeholder="Subject"
                />
              </div>

              {/* BODY — main focus (grows naturally; container provides scroll) */}
              <div>
                <textarea
                  value={generatedReply}
                  onChange={handleChange}
                  className="min-h-[22rem] w-full resize-none rounded-lg border border-brand-dark/40 bg-brand-dark/10
                             p-3 text-brand-light placeholder-brand-light/60
                             focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary"
                  placeholder="Your message (you can edit the generated reply here)…"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-2 pb-2">
              <button
                className="w-full rounded-lg border border-brand-dark/40 bg-brand-primary/30 px-3 py-2 text-brand-light
                           transition hover:bg-brand-muted hover:text-brand-primary
                           focus:outline-none focus:ring-2 focus:ring-brand-primary/40 text-sm"
                onClick={handleSend}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <span>Send</span>
                  <SendIcon size={15} strokeWidth={2} />
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
