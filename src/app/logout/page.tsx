"use client";
import { useEffect, useRef } from "react";
import { logout } from "@/lib/auth-actions";

export default function LogoutPage() {
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    ref.current?.requestSubmit();
  }, []);

  return (
    <form ref={ref} action={logout}>
      <button type="submit" className="sr-only">Sign out</button>
    </form>
  );
}
