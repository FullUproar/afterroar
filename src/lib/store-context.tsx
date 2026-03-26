"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { type Role, type Permission, hasPermission } from "@/lib/permissions";

const GOD_ADMIN_EMAIL = "info@fulluproar.com";

interface StoreData {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
}

interface StaffData {
  id: string;
  role: string;
  name: string;
  store_id: string;
}

interface StoreContextValue {
  store: StoreData | null;
  staff: StaffData | null;
  loading: boolean;
  effectiveRole: Role | null;
  actualRole: Role | null;
  isGodAdmin: boolean;
  isTestMode: boolean;
  setTestRole: (role: Role | null) => void;
  can: (permission: Permission) => boolean;
  userEmail: string | null;
}

const StoreContext = createContext<StoreContextValue>({
  store: null,
  staff: null,
  loading: true,
  effectiveRole: null,
  actualRole: null,
  isGodAdmin: false,
  isTestMode: false,
  setTestRole: () => {},
  can: () => false,
  userEmail: null,
});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [store, setStore] = useState<StoreData | null>(null);
  const [staff, setStaff] = useState<StaffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testRole, setTestRole] = useState<Role | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    async function loadStoreData() {
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const data = await res.json();
          setStaff(data.staff);
          setStore(data.store);
        }
      } catch {
        // silently fail
      }
      setLoading(false);
    }

    loadStoreData();
  }, [session, status]);

  const userEmail = session?.user?.email ?? null;
  const isGodAdmin = userEmail === GOD_ADMIN_EMAIL;
  const actualRole = (staff?.role as Role) ?? null;
  const isTestMode = isGodAdmin && testRole !== null;
  const effectiveRole = isTestMode ? testRole : actualRole;

  const can = useCallback(
    (permission: Permission) => {
      if (!effectiveRole) return false;
      return hasPermission(effectiveRole, permission);
    },
    [effectiveRole]
  );

  return (
    <StoreContext.Provider
      value={{
        store,
        staff,
        loading,
        effectiveRole,
        actualRole,
        isGodAdmin,
        isTestMode,
        setTestRole,
        can,
        userEmail,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
