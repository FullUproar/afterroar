"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Store, Staff } from "@/lib/types";
import { type Role, type Permission, hasPermission } from "@/lib/permissions";

// GOD admin email — gets the test mode panel
const GOD_ADMIN_EMAIL = "info@fulluproar.com";

interface StoreContextValue {
  store: Store | null;
  staff: Staff | null;
  loading: boolean;
  // Effective role (may differ from actual role in test mode)
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
  const [store, setStore] = useState<Store | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [testRole, setTestRole] = useState<Role | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setUserEmail(user.email ?? null);

      const { data: staffRow } = await supabase
        .from("staff")
        .select("*, stores(*)")
        .eq("user_id", user.id)
        .eq("active", true)
        .single();

      if (staffRow) {
        const { stores: storeData, ...staffData } = staffRow as Record<string, unknown>;
        setStaff(staffData as unknown as Staff);
        setStore(storeData as unknown as Store);
      }

      setLoading(false);
    }

    load();
  }, []);

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
