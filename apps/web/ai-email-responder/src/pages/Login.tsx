import { Link, useNavigate } from "react-router-dom";
import "./styles/Home.css";
import { useEffect, useReducer } from "react";
import axios from "axios";
import { useGlobalContext } from "../context/GlobalContext";

interface FormState {
  email: string;
  password: string;
}

type FormAction =
  | { type: "UPDATE_FIELD"; field: keyof FormState; value: string }
  | { type: "RESET" };

const initialState: FormState = { email: "", password: "" };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "UPDATE_FIELD":
      return { ...state, [action.field]: action.value };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export default function Login() {
  const [state, dispatch] = useReducer(formReducer, initialState);
  const { setUser, setIsAuthenticated } = useGlobalContext();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: "UPDATE_FIELD",
      field: e.target.name as keyof FormState,
      value: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("Sending login request to server...");
    console.log(`Form state: ${state}`);

    try {
      const resp = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/login/auth_local`,
        {
          display_email: state.email,
          password: state.password,
        },
        { withCredentials: true }
      );

      console.log("Response received from server...");

      if (resp.status === 200) {
        setIsAuthenticated(true);
        console.log("Logged in successfully");

        // Getting user
        console.log("Getting user details from server...");

        try {
          const resp = await axios.get(
            `${import.meta.env.VITE_API_URL}/api/login/me`,
            { withCredentials: true }
          );

          console.log("Response received from server...");

          if (
            resp.data &&
            resp.data.email &&
            typeof resp.data.email === "string" &&
            resp.data.name &&
            typeof resp.data.name === "string" &&
            resp.data.accounts
          ) {
            setUser({
              email: resp.data.email,
              name: resp.data.name,
              accounts: resp.data.accounts,
            });
          }
        } catch (err: any) {
          if (axios.isAxiosError(err)) {
            console.error(
              "Error authenticating user: ",
              err.response?.data || err.message
            );
          } else {
            console.error("Unexpected error: ", err);
          }
        }

        navigate("/");
      } else {
        throw new Error(
          `Error logging in - ERR CODE ${resp.status}: ${resp.data}`
        );
      }
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        console.error(
          "Error authenticating user: ",
          err.response?.data || err.message
        );
      } else {
        console.error("Unexpected error: ", err);
      }
    }

    dispatch({ type: "RESET" });
  };

  async function handleGoogleSubmit() {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/login/auth_google`;
  }

  return (
    <div className="h-full w-full bg-page overflow-hidden">
      <div className="h-full w-full overflow-y-auto overflow-x-hidden">
        <section className="mx-auto max-w-md sm:max-w-lg px-4 py-8 md:py-12">
          {/* Header */}
          <header className="text-center mb-8 md:mb-10">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-brand-muted">
              Welcome back
            </h1>
            <p className="mt-3 text-base md:text-lg text-brand-light">
              Sign in to continue. You can connect Gmail after logging in and
              start drafting AI-powered replies from your inbox.
            </p>
          </header>

          {/* Login card */}
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 md:p-8 shadow-sm">
            <div className="space-y-5">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  placeholder="display email"
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2
                             text-slate-900 placeholder-slate-400
                             focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  placeholder="password"
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2
                             text-slate-900 placeholder-slate-400
                             focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary"
                />
              </div>

              {/* Primary login CTA */}
              <button
                className="mt-1 w-full rounded-xl bg-brand-primary px-4 py-3 text-white text-base font-medium
                           transition hover:bg-brand-muted hover:text-brand-primary
                           focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                onClick={handleSubmit}
              >
                Log In
              </button>

              {/* Divider */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white/80 px-2 text-xs uppercase tracking-wide text-slate-500">
                    or
                  </span>
                </div>
              </div>

              {/* Google login */}
              <button
                className="w-full rounded-xl border border-slate-300
                           flex justify-center items-center"
                onClick={handleGoogleSubmit}
              >
                <div className="flex justify-start items-center">
                    <img
                        src="/web_neutral_rd_SI@2x.png"
                        alt="" aria-hidden="true"
                        className="h-[42px] w-auto my-0 mr-1 hover:shadow-lg rounded-3xl"
                    />
                </div>
              </button>

              <p className="text-xs text-slate-500">
                We use Google’s official OAuth2 flow. You can revoke access
                anytime in your Google Account settings.
              </p>
            </div>
          </div>

          {/* Descriptors (help newcomers) */}
          <div className="mt-8 grid gap-4">
            <article className="group rounded-2xl border border-slate-200 bg-white/70 p-4 transition hover:bg-brand-muted hover:text-brand-primary">
              <h2 className="text-base font-semibold">Outlook-style accounts</h2>
              <p className="mt-1 text-slate-600 group-hover:text-brand-primary">
                Add multiple email accounts and keep threads organized in one place.
              </p>
            </article>
            <article className="group rounded-2xl border border-slate-200 bg-white/70 p-4 transition hover:bg-brand-muted hover:text-brand-primary">
              <h2 className="text-base font-semibold">Prompt → polished reply</h2>
              <p className="mt-1 text-slate-600 group-hover:text-brand-primary">
                Enter a prompt to generate draft replies or full emails using LLMs—review, edit, send.
              </p>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
