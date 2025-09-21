import "./styles/Contact.css";
import { useState } from "react";
import { Mail, Github, Copy, Check } from "lucide-react";

export default function Contact() {
  const email = "vishymans@gmail.com";
  const githubUrl = "https://github.com/vishykum";
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // no-op
    }
  };

  return (
    // Fit inside the Outlet without creating a second page scrollbar
    <div className="h-full w-full bg-page overflow-hidden">
      <div className="h-full w-full overflow-y-auto overflow-x-hidden">
        <section className="mx-auto max-w-5xl px-4 py-8 md:py-12">
          {/* Header */}
          <header className="mb-10 md:mb-14">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-brand-muted">
              Get in Touch
            </h1>
            <p className="mt-3 text-base md:text-lg text-brand-light">
              I’m happy to connect about this project, collaboration ideas, or full-stack roles.
              The quickest way is email; you can also find me on GitHub.
            </p>
          </header>

          {/* Contact Options */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Email Card */}
            <article className="group rounded-2xl border border-slate-200 bg-white/70 p-6 transition hover:bg-brand-muted hover:text-brand-primary">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <Mail className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-medium">Email</h2>
                  <p className="mt-1 text-slate-600 group-hover:text-brand-primary">
                    Prefer direct contact? Send me a message any time.
                  </p>

                  <div className="mt-4 flex items-center gap-2">
                    <a
                      href={`mailto:${email}`}
                      className="rounded-lg bg-brand-primary px-4 py-2 text-white transition hover:bg-brand-muted hover:text-brand-primary"
                    >
                      Email me
                    </a>

                    <button
                      type="button"
                      onClick={copyEmail}
                      aria-label="Copy email address"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white/70 px-3 py-2 text-slate-800 transition hover:bg-brand-muted hover:text-brand-primary"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      <span className="text-sm">{copied ? "Copied" : email}</span>
                    </button>
                  </div>
                </div>
              </div>
            </article>

            {/* GitHub Card */}
            <article className="group rounded-2xl border border-slate-200 bg-white/70 p-6 transition hover:bg-brand-muted hover:text-brand-primary">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <Github className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-medium">GitHub</h2>
                  <p className="mt-1 text-slate-600 group-hover:text-brand-primary">
                    Explore my code, issues, and project history.
                  </p>

                  <div className="mt-4">
                    <a
                      href={githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-brand-primary px-4 py-2 text-white transition hover:bg-brand-muted hover:text-brand-primary"
                    >
                      Visit github.com/vishykum
                    </a>
                  </div>
                </div>
              </div>
            </article>
          </div>

          {/* Additional Info / Availability */}
          <section className="mt-10 md:mt-14 rounded-2xl border border-slate-200 bg-white/70 p-6">
            <h2 className="text-xl font-medium">Availability</h2>
            <p className="mt-2 text-slate-700">
              I typically respond within 1–2 business days. If your message includes context
              (repository links, a brief summary, or a timeline), that helps me get back faster.
            </p>
          </section>
        </section>
      </div>
    </div>
  );
}
