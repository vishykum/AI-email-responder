import { Link } from "react-router-dom";
import { useGlobalContext } from "../context/GlobalContext";
import Inbox from "../components/Inbox";
import { LogIn, Mail, Sparkles, ShieldCheck } from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useGlobalContext();

  if (isAuthenticated) {
    return (
      <div className="h-full w-full min-h-0">
        <Inbox />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-page overflow-hidden">
      <div className="h-full w-full overflow-y-auto overflow-x-hidden">
        <section className="mx-auto max-w-5xl px-4 py-8 md:py-12">
          {/* Header */}
          <header className="text-center mb-10 md:mb-14">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-brand-muted">
              AI-Powered Email Responder
            </h1>
            <p className="mt-3 text-base md:text-lg text-brand-light">
              Connect Gmail, write a quick prompt, and let the app draft clear, context-aware
              replies—without leaving your inbox.
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Feature descriptors */}
            <div className="md:col-span-2 grid gap-6">
              <article className="group rounded-2xl border border-slate-200 bg-white/70 p-6 transition hover:bg-brand-muted hover:text-brand-primary">
                <div className="flex items-start gap-3">
                  <Mail className="h-6 w-6 mt-1" />
                  <div>
                    <h2 className="text-xl font-medium">Outlook-style Accounts</h2>
                    <p className="mt-2 text-slate-600 group-hover:text-brand-primary">
                      Add multiple email accounts and keep threads organized in one place.
                    </p>
                  </div>
                </div>
              </article>

              <article className="group rounded-2xl border border-slate-200 bg-white/70 p-6 transition hover:bg-brand-muted hover:text-brand-primary">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-6 w-6 mt-1" />
                  <div>
                    <h2 className="text-xl font-medium">Prompt → Polished Reply</h2>
                    <p className="mt-2 text-slate-600 group-hover:text-brand-primary">
                      Type a prompt and generate a reply or full email using LLMs. Review, edit, and send.
                    </p>
                  </div>
                </div>
              </article>

              <article className="group rounded-2xl border border-slate-200 bg-white/70 p-6 transition hover:bg-brand-muted hover:text-brand-primary">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-6 w-6 mt-1" />
                  <div>
                    <h2 className="text-xl font-medium">Simple & Secure Sign-in</h2>
                    <p className="mt-2 text-slate-600 group-hover:text-brand-primary">
                      Sign in with Google and connect Gmail via OAuth2—no passwords shared.
                      You can revoke access from your Google settings any time.
                    </p>
                  </div>
                </div>
              </article>
            </div>

            {/* Single, emphasized login entry point */}
            <aside className="md:col-span-1">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 md:p-8 shadow-sm">
                <h2 className="text-xl font-semibold">Sign in to Continue</h2>
                <p className="mt-2 text-slate-600">
                  This is the only place to log in and start using the app.
                </p>

                <Link
                  to="/login"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl
                             bg-brand-primary px-5 py-3 text-lg font-medium text-white transition
                             hover:bg-brand-muted hover:text-brand-primary
                             focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  aria-label="Sign in with Google"
                >
                  <LogIn className="h-5 w-5" />
                  Sign in with Google
                </Link>

                <div className="mt-4 text-xs text-slate-500">
                  By continuing, you’ll connect Gmail via Google’s official OAuth2 flow so the app
                  can read threads you select and send replies on your behalf.
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
