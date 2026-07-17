import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { LifeBuoy, Send, Clock, CheckCircle2, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import {
  sendSupportMessage,
  listMySupportMessages,
  getSupportAttachmentUrl,
} from "@/lib/support.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/support")({
  component: SupportPage,
});

const MAX = 500;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

type Attachment = { path: string; name: string; size: number; type: string };

const statusLabels: Record<string, { label: string; className: string; icon: any }> = {
  open: { label: "Aberta", className: "bg-amber-100 text-amber-900", icon: Clock },
  in_progress: { label: "Em análise", className: "bg-blue-100 text-blue-900", icon: Loader2 },
  resolved: { label: "Resolvida", className: "bg-emerald-100 text-emerald-900", icon: CheckCircle2 },
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentLink({ messageId, att }: { messageId: string; att: Attachment }) {
  const getUrl = useServerFn(getSupportAttachmentUrl);
  const [loading, setLoading] = useState(false);
  const open = async () => {
    try {
      setLoading(true);
      const { url } = await getUrl({ data: { messageId, path: att.path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao abrir anexo");
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
    >
      <Paperclip className="h-3 w-3" />
      <span className="max-w-[220px] truncate">{att.name}</span>
      <span className="text-muted-foreground">({formatBytes(att.size)})</span>
    </button>
  );
}

function SupportPage() {
  const qc = useQueryClient();
  const sendFn = useServerFn(sendSupportMessage);
  const listFn = useServerFn(listMySupportMessages);

  const messagesQuery = useQuery({
    queryKey: ["my-support-messages"],
    queryFn: () => listFn({}),
  });

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const merged = [...files];
    for (const f of incoming) {
      if (merged.length >= MAX_FILES) {
        toast.error(`Máximo de ${MAX_FILES} anexos por solicitação.`);
        break;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`"${f.name}" excede 10 MB.`);
        continue;
      }
      merged.push(f);
    }
    setFiles(merged);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getUser();
      const uid = sessionData.user?.id;
      if (!uid) throw new Error("Sessão expirada");

      const uploaded: Attachment[] = [];
      if (files.length > 0) {
        setUploading(true);
        try {
          const folder = `${uid}/${crypto.randomUUID()}`;
          for (const f of files) {
            const safeName = f.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
            const path = `${folder}/${Date.now()}-${safeName}`;
            const { error } = await supabase.storage
              .from("support-attachments")
              .upload(path, f, {
                contentType: f.type || "application/octet-stream",
                upsert: false,
              });
            if (error) throw new Error(`Falha ao enviar "${f.name}": ${error.message}`);
            uploaded.push({ path, name: f.name, size: f.size, type: f.type || "" });
          }
        } finally {
          setUploading(false);
        }
      }
      return sendFn({ data: { subject, body, attachments: uploaded } });
    },
    onSuccess: () => {
      toast.success("Mensagem enviada. Nossa equipe responderá em breve.");
      setSubject("");
      setBody("");
      setFiles([]);
      qc.invalidateQueries({ queryKey: ["my-support-messages"] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao enviar"),
  });

  const remaining = MAX - body.length;
  const canSend =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    body.length <= MAX &&
    !sendMutation.isPending &&
    !uploading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Suporte</h1>
          <p className="text-sm text-muted-foreground">
            Envie dúvidas, sugestões ou solicitações para moderadores e administradores.
          </p>
        </div>
        <LifeBuoy className="h-8 w-8 text-primary" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova solicitação</CardTitle>
          <CardDescription>
            Máximo de 500 caracteres na mensagem. Até {MAX_FILES} anexos de 10 MB cada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Assunto</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, 120))}
              placeholder="Ex: Solicitar nova marca, dúvida sobre lista…"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mensagem</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX))}
              placeholder="Descreva sua solicitação"
              rows={5}
              maxLength={MAX}
            />
            <div
              className={`text-xs ${remaining < 50 ? "text-coral" : "text-muted-foreground"}`}
            >
              {remaining} caracteres restantes
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Anexos (opcional)</label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={files.length >= MAX_FILES || uploading}
              >
                <Paperclip className="mr-2 h-4 w-4" />
                Anexar arquivo
              </Button>
              <span className="text-xs text-muted-foreground">
                {files.length}/{MAX_FILES} arquivos
              </span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              />
            </div>
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md border px-2 py-1 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{f.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        ({formatBytes(f.size)})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="ml-2 rounded p-1 text-muted-foreground hover:bg-accent"
                      aria-label={`Remover ${f.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => sendMutation.mutate()} disabled={!canSend}>
              <Send className="mr-2 h-4 w-4" />
              {uploading
                ? "Enviando anexos…"
                : sendMutation.isPending
                  ? "Enviando…"
                  : "Enviar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Minhas solicitações</CardTitle>
          <CardDescription>Histórico e respostas da equipe.</CardDescription>
        </CardHeader>
        <CardContent>
          {messagesQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : (messagesQuery.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Você ainda não enviou nenhuma solicitação.
            </p>
          ) : (
            <ul className="space-y-3">
              {(messagesQuery.data ?? []).map((m: any) => {
                const s = statusLabels[m.status] ?? statusLabels.open;
                const Icon = s.icon;
                const atts: Attachment[] = Array.isArray(m.attachments) ? m.attachments : [];
                return (
                  <li key={m.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{m.subject}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(m.created_at).toLocaleString("pt-BR")}
                        </div>
                      </div>
                      <Badge className={s.className}>
                        <Icon className="mr-1 h-3 w-3" /> {s.label}
                      </Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
                    {atts.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {atts.map((a) => (
                          <AttachmentLink key={a.path} messageId={m.id} att={a} />
                        ))}
                      </div>
                    )}
                    {m.staff_reply && (
                      <div className="mt-3 rounded-md bg-accent p-3">
                        <div className="mb-1 text-xs font-semibold text-muted-foreground">
                          Resposta da equipe
                          {m.replied_at
                            ? ` · ${new Date(m.replied_at).toLocaleString("pt-BR")}`
                            : ""}
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{m.staff_reply}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
