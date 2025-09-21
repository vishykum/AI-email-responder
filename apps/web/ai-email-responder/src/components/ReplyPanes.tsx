import { useGlobalContext, type Message } from "../context/GlobalContext";
import "./styles/ReplyPanes.css";
import { X, SendIcon } from "lucide-react";
import { EmailHtmlIframe } from "./Messages";
import { useEffect, useRef, useState } from "react";
import axios from "axios";

async function generateReply(message_id: string, prompt: string): Promise<string> {
  console.log("Generating reply...");
  console.log("Sending details to server...");

  try {
    const resp = await axios.post(
      `${import.meta.env.VITE_API_URL}/api/ai/chat`,
      { message_id, prompt },
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

export default function ReplyPanes({
  onClose,
  message,
  subject,
}: {
  onClose: () => void;
  message: Message | null;
  subject: string;
}) {
  const promptElementRef = useRef<HTMLTextAreaElement>(null);
  const [generatedReply, setGeneratedReply] = useState("");
  const { selectedAccount } = useGlobalContext();

  const handleGenerateClick = async () => {
    const text = (promptElementRef.current?.value ?? "").trim();
    const generated = await generateReply(message!.id, text);
    setGeneratedReply(generated);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGeneratedReply(e.target.value);
  };

  const handleSend = async () => {
    console.log("Sending reply...");
    const resp = await axios.post(
      `${import.meta.env.VITE_API_URL}/api/gmail/reply`,
      {
        gmail_address: selectedAccount!.email_address,
        provider_message_id: message!.provider_message_id,
        body_text: generatedReply,
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

  // This component shouldn't be opened if there is no proper message body
  useEffect(() => {
    if (!message || (!message.body_html && !message.body_text)) {
      onClose();
    }
  }, [message]);

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
            aria-label="Close reply panes"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-row justify-around items-start gap-4 text-brand-light">
          {/* EMAIL pane */}
          <div className="h-[80vh] w-[30vw] bg-brand-dark/30 rounded-2xl overflow-hidden shadow-xl flex flex-col border border-brand-dark/40">
            <div className="sticky top-0 bg-brand-dark text-brand-light text-center px-3 py-1">
              <h2 className="text-base font-semibold">Email</h2>
            </div>

            {/* Content scrolls within pane */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {message && message.body_html ? (
                <div className="h-full w-full">
                  <EmailHtmlIframe html={message.body_html} />
                </div>
              ) : (
                <pre className="p-3 text-sm whitespace-pre-wrap break-words max-w-full">
                  {message ? message.body_text ?? "" : ""}
                </pre>
              )}
            </div>
          </div>

          {/* PROMPT pane */}
          <div className="h-[80vh] w-[30vw] bg-brand-dark/30 rounded-2xl overflow-hidden shadow-xl flex flex-col border border-brand-dark/40">
            <div className="sticky top-0 bg-brand-dark text-brand-light text-center px-3 py-1">
              <h2 className="text-base font-semibold">Prompt</h2>
            </div>

            {/* Everything (textarea) lives in the scrollable area */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              <textarea
                ref={promptElementRef}
                className="h-full w-full resize-none rounded-lg border border-brand-dark/40 bg-brand-dark/10
                           p-2 text-brand-light placeholder-brand-light/60 text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary"
                placeholder="Give the model instructions for your reply (tone, points to cover, length)…"
              />
            </div>

            {/* Footer */}
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

          {/* REPLY pane */}
          <div className="h-[80vh] w-[30vw] bg-brand-dark/30 rounded-2xl overflow-hidden shadow-xl flex flex-col border border-brand-dark/40">
            <div className="sticky top-0 bg-brand-dark text-brand-light text-center px-3 py-1">
              <h2 className="text-base font-semibold">Reply</h2>
            </div>

            {/* CONTENT SCROLLS TOGETHER (between header and footer) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 flex flex-col">
              {/* From — compact row */}
              <div className="flex items-center gap-2 border-b border-brand-dark/40 py-0.5 text-[12px] leading-5 shrink-0">
                <label className="text-brand-light/80 shrink-0">From:</label>
                <span className="text-brand-light/90 truncate">{selectedAccount!.email_address}</span>
              </div>

              {/* To — compact single row (label + value) */}
              <div className="flex items-center gap-2 border-b border-brand-dark/40 py-0.5 text-[12px] leading-5 shrink-0">
                <label className="text-brand-light/80 shrink-0">To:</label>
                <span className="text-brand-light/90 truncate">{message!.from_address}</span>
              </div>

              {/* Subject — compact */}
              <div className="flex items-center gap-2 border-b border-brand-dark/40 py-0.5 text-[12px] leading-5 shrink-0">
                <label className="text-brand-light/80 shrink-0">Subject:</label>
                <span className="text-brand-light/90 truncate">{subject}</span>
              </div>

              {/* BODY — main focus; container grows, scroll area provides overflow */}
              <div className="flex-1 min-h-[22rem] overflow-hidden">
                <textarea
                  value={generatedReply}
                  onChange={handleChange}
                  className="h-full w-full resize-none rounded-lg border border-brand-dark/40 bg-brand-dark/10
                             p-3 text-brand-light placeholder-brand-light/60
                             focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary"
                  placeholder="Type or refine your reply here…"
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
