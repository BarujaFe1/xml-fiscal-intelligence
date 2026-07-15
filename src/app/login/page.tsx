"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { createClient, isSupabaseConfigured } from "@/lib/auth/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      toast.message("Modo privacidade: configure a autenticação para login.");
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
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle level={1}>Entrar</CardTitle>
          <CardDescription>
            {configured
              ? "Acesse sua conta usando seu e-mail e senha."
              : "Modo privacidade: continue sem login."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-11"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
            </div>
            <Button type="submit" disabled={loading || !configured} className="w-full">
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-slate-300">
            <Link href="/signup" className="text-sky-300 underline underline-offset-2">
              Criar conta
            </Link>
            {" · "}
            <Link href="/forgot-password" className="text-sky-300 underline underline-offset-2">
              Esqueci a senha
            </Link>
            {" · "}
            <Link href="/app" className="text-sky-300 underline underline-offset-2">
              Continuar sem login (privacidade)
            </Link>
          </p>
          <p className="mt-3 text-xs text-slate-300">
            Ao continuar você concorda com nossos{" "}
            <Link href="/termos" className="text-sky-300 underline underline-offset-2">
              Termos
            </Link>{" "}
            e{" "}
            <Link href="/privacidade" className="text-sky-300 underline underline-offset-2">
              Política de Privacidade
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
