"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { createClient, isSupabaseConfigured } from "@/lib/auth/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      toast.message("Modo privacidade/demo: configure Supabase para login SaaS.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Login ok");
      window.location.href = "/app";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <Card className="w-full max-w-md bg-slate-900/60">
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>
            {configured
              ? "Supabase Auth (e-mail/senha)."
              : "Supabase não configurado — use /app em modo IndexedDB."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading || !configured} className="w-full">
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-slate-400">
            <Link href="/signup" className="text-sky-300">
              Criar conta
            </Link>
            {" · "}
            <Link href="/app" className="text-sky-300">
              Continuar sem login (privacidade)
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
