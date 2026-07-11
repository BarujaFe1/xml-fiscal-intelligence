"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { createClient, isSupabaseConfigured } from "@/lib/auth/supabase-browser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      toast.message("Redefinição indisponível — configure Supabase Auth.");
      return;
    }
    if (password.length < 8) {
      toast.error("Use ao menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada");
      window.location.href = "/login";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao redefinir senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <Card className="w-full max-w-md bg-slate-900/60">
        <CardHeader>
          <CardTitle>Redefinir senha</CardTitle>
          <CardDescription>
            Abra esta página a partir do link do e-mail. Sessão de recuperação deve estar ativa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={loading || !configured} className="w-full">
              {loading ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-slate-400">
            <Link href="/login" className="text-sky-300">
              Voltar ao login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
