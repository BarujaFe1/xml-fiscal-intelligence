"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { createClient, isSupabaseConfigured } from "@/lib/auth/supabase-browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const configured = isSupabaseConfigured();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      toast.message("Recuperação indisponível — configure Supabase Auth.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Se o e-mail existir, enviaremos o link de redefinição.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao solicitar recuperação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <Card className="w-full max-w-md bg-slate-900/60">
        <CardHeader>
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>
            {configured
              ? "Enviaremos um link seguro por e-mail (Supabase Auth)."
              : "Supabase não configurado — recuperação desabilitada."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm text-slate-300">
              Verifique sua caixa de entrada. O link leva à redefinição de senha.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <Button type="submit" disabled={loading || !configured} className="w-full">
                {loading ? "Enviando…" : "Enviar link"}
              </Button>
            </form>
          )}
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
