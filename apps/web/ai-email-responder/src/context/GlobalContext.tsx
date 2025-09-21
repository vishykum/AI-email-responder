import React, {createContext, useContext, useState} from 'react';
import type {ReactNode} from 'react';

//Define shape of global state
export interface Account {
    provider: string;
    email_address: string;
};

export interface User {
    email: string;
    name: string;
    accounts: Account[]
}

export interface Labels {
    label: {name: "UNREAD" | "INBOX" | "SENT"}
}

export interface Message {
    id: string;
    internal_date: string;
    snippet: string;
    from_address: string;
    to_addresses: JSON;
    body_text: string | null;
    body_html: string | null;
    provider_message_id: string;
    message_labels: Labels[];
}

export interface Thread {
    id: string;
    subject: string;
    message_count: number;
    messages: Message[];
    last_message_at: string;
};

interface GlobalState {
    user: User | null;
    threads: Thread[] | null;
    isAuthenticated: boolean;
    isHealthy: boolean;
    selectedAccount: Account | null;
    mailbox: string;
    setUser: (user: User) => void;
    setIsAuthenticated: (isAuthenticated: boolean) => void;
    setIsHealthy: (isAuthenticated: boolean) => void;
    setThreads: (threads: Thread[]) => void;
    setSelectedAccount: (account: Account) => void;
    setMailbox: (folder: string) => void;
}

//Create context with default value
const GlobalContext = createContext<GlobalState | undefined>(undefined);

//Create Provider Component
export const GlobalProvider: React.FC<{children: ReactNode}> = ({children}) => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isHealthy, setIsHealthy] = useState(false);
    const [threads, setThreads] = useState<Thread[] | null>(null);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [mailbox, setMailbox] = useState<string>("INBOX");

    return (
        <GlobalContext.Provider
            value={{user, isAuthenticated, isHealthy, threads, selectedAccount, mailbox, setUser, setIsAuthenticated, setIsHealthy, setThreads, setSelectedAccount, setMailbox}}
        >
            {children}
        </GlobalContext.Provider>
    );
};

//Custom hook for easier usage
export const useGlobalContext = (): GlobalState => {
    const context = useContext(GlobalContext);
    if (!context) {
        throw new Error("useGlobalContext must be used within a GlobalProvider");
    }
    return context;
};