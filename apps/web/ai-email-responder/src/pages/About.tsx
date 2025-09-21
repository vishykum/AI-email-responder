import "./styles/About.css";

export default function About() {
  return (
    // Fill the Outlet and prevent horizontal scroll
    <div className="h-full w-full bg-page overflow-hidden">
      {/* Inner scroller: only this area scrolls, navbar stays put */}
      <div className="h-full w-full overflow-y-auto overflow-x-hidden">
        <section className="mx-auto max-w-5xl px-4 py-8 md:py-12">
          {/* Header */}
          <header className="mb-10 md:mb-14">
            <h1 className="text-brand-muted text-3xl md:text-4xl font-semibold tracking-tight">
              About This Project
            </h1>
            <p className="mt-3 text-base md:text-lg text-brand-light">
              I built this app after completing my Bachelor’s to deepen my
              full-stack skills: front end, back end, and everything in between.
            </p>
          </header>

          {/* Key Value */}
          <div className="grid gap-6 md:grid-cols-2">
            <article className="group rounded-2xl border border-slate-200 bg-white/70 p-6 transition hover:bg-brand-muted hover:text-brand-primary">
              <h2 className="text-xl font-medium">Email Accounts, Outlook-Style</h2>
              <p className="mt-2 text-slate-600 group-hover:text-brand-primary">
                Connect multiple email accounts and view threads in one place to
                keep your workflow tidy and consistent.
              </p>
            </article>

            <article className="group rounded-2xl border border-slate-200 bg-white/70 p-6 transition hover:bg-brand-muted hover:text-brand-primary">
              <h2 className="text-xl font-medium">Write with AI Prompts</h2>
              <p className="mt-2 text-slate-600 group-hover:text-brand-primary">
                Type a prompt and let LLMs draft replies or full emails. You
                stay in control: review, edit, and send.
              </p>
            </article>
          </div>

          {/* Plain-English OAuth/Gmail */}
          <section className="mt-10 md:mt-14 rounded-2xl border border-slate-200 bg-white/70 p-6">
            <h2 className="text-xl font-medium">Google Sign-In & Gmail, in Simple Terms</h2>
            <ul className="mt-4 space-y-3">
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-primary" />
                <p className="text-slate-700">
                  <strong>Sign in with Google:</strong> Log in using your Google
                  account: no new passwords to remember.
                </p>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-primary" />
                <p className="text-slate-700">
                  <strong>Connect Gmail (OAuth2):</strong> You grant the app
                  permission to read and send mail on your behalf using
                  Google’s secure method (OAuth2). You can revoke access
                  any time from your Google Account settings.
                </p>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-primary" />
                <p className="text-slate-700">
                  <strong>Send & Receive via Google APIs:</strong> The app uses
                  Google’s official client to fetch threads and send messages: no
                  scraping, just the trusted Google pipeline.
                </p>
              </li>
            </ul>
          </section>

          {/* Demo Placeholder */}
          <section className="mt-10 md:mt-14">
            <h2 className="text-brand-muted text-xl font-medium">Product Demo</h2>
            <div
              className="mt-4 aspect-video w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 grid place-items-center text-slate-500"
              aria-label="Demo video placeholder"
            >
              <div className="text-center">
                <p className="font-medium">Demo video goes here</p>
                <p className="text-sm">Embed or drop a thumbnail + play button</p>
              </div>
            </div>
          </section>

          {/* Tech Stack */}
          <section className="mt-10 md:mt-14">
            <h2 className="text-brand-muted text-xl font-medium">Tech Stack</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="inline-flex items-center rounded-full bg-brand-primary/90 px-3 py-1 text-sm font-medium text-white">
                React
              </span>
              <span className="inline-flex items-center rounded-full bg-brand-primary/90 px-3 py-1 text-sm font-medium text-white">
                Tailwind CSS
              </span>
              <span className="inline-flex items-center rounded-full bg-brand-primary/90 px-3 py-1 text-sm font-medium text-white">
                Express.js
              </span>
              <span className="inline-flex items-center rounded-full bg-brand-primary/90 px-3 py-1 text-sm font-medium text-white">
                Prisma
              </span>
              <span className="inline-flex items-center rounded-full bg-brand-primary/90 px-3 py-1 text-sm font-medium text-white">
                MySQL
              </span>
            </div>
            <p className="mt-3 text-brand-light">
              Built with a focus on clean UI, predictable state, and straightforward server APIs.
            </p>
          </section>

          {/* Why I Built It */}
          <section className="mt-10 md:mt-14">
            <h2 className="text-brand-muted text-xl font-medium">Why I Built It</h2>
            <p className="mt-2 text-brand-light">
              I wanted a practical way to learn how modern apps fit together <br />
              Front-end UX, server APIs, auth flows, and third-party integrations 
              while solving a real-world problem: writing faster, clearer emails without
              leaving your inbox.
            </p>
          </section>

          {/* Footer CTA */}
          <footer className="mt-12 md:mt-16 flex flex-wrap gap-3">
            <a
              href="#"
              className="rounded-lg bg-brand-dark px-4 py-2 text-white transition hover:bg-brand-muted hover:text-brand-primary"
            >
              Try the App
            </a>
            <a
              href="#"
              className="rounded-lg border border-slate-300 bg-white/70 px-4 py-2 text-slate-800 transition hover:bg-brand-muted hover:text-brand-primary"
            >
              View Source
            </a>
          </footer>
        </section>
      </div>
    </div>
  );
}
