import Navbar from './components/Navbar';
import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom';
import { useGlobalContext, type Thread } from './context/GlobalContext';
import './App.css'
import axios from 'axios';

function App() {

  const {mailbox, isAuthenticated, selectedAccount, setThreads, setIsHealthy, setUser, setIsAuthenticated} = useGlobalContext();

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/health`);
        console.log("Backend healthy: ", res.data);

        setIsHealthy(true);
      } catch(err: any) {
        if (axios.isAxiosError(err)) {
          console.error("Backend unhealthy: ", err.response?.data || err.message);
        } else {
          console.error("Unexpected error: ", err);
        }
      }
    }

    checkHealth();
  }, []);

  //Check if user already logged in
  useEffect(() => {
    async function checkLoggedIn() {
      try {
          const resp = await axios.get(`${import.meta.env.VITE_API_URL}/api/login/me`, {withCredentials: true});

          console.log("Response received from server...");

          if (resp.data && resp.data.email && typeof resp.data.email === "string" && resp.data.name && typeof resp.data.name === "string" && resp.data.accounts) {
            setIsAuthenticated(true);
            setUser({email: resp.data.email, name: resp.data.name, accounts: resp.data.accounts});
          }

          else {
            console.log("Response structure invalid...");
          }
      } catch(err: any) {
          if (axios.isAxiosError(err)) {
          console.error("Error authenticating user: ", err.response?.data || err.message);
          } else {
          console.error("Unexpected error: ", err);
          }
      }
    }

    checkLoggedIn();
  }, []);

  //If user is logged in get the most recent 100 email threads
  useEffect(() => {
    async function getThreads() {
      console.log("Retreiving threads from backend...");
      if (isAuthenticated && selectedAccount) {
        try {
            if (selectedAccount.provider === "GOOGLE") {
                const resp = await axios.post(`${import.meta.env.VITE_API_URL}/api/gmail/inbox`,
              {
                gmail_address: selectedAccount.email_address,
                n_threads: 100, //Placeholder for now
              },
              {
                withCredentials: true,
              }
            );

            if (!resp || !resp.data) {
              console.error("Invalid response from backend...");
            }

            const threadsByLabel = (resp.data as Thread[]).filter(thread => 
              thread.message_count>0 && 
              thread.messages[0].message_labels.some(l => l.label.name?.toUpperCase() === mailbox
            ));

            //Set threads
            setThreads(threadsByLabel);
          }

        } catch(err: any) {
          if (axios.isAxiosError(err)) {
          console.error("Error authenticating user: ", err.response?.data || err.message);
          } else {
          console.error("Unexpected error: ", err);
          }
        }
      }
    }

    getThreads();
  }, [isAuthenticated, selectedAccount, mailbox]);

  return (
    <>
        <div className="h-screen w-screen flex flex-col justify-center items-center">
          <div className="h-16 w-full">
            <Navbar />
          </div>
          <main className="w-full bg-page flex-1 min-h-0">
              <Outlet />
          </main>
        </div>
    </>
  )
}

export default App
