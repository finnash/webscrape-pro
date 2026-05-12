import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ChatThread = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export const useThreads = () => {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("chat_conversations")
      .select("id,title,created_at,updated_at")
      .order("updated_at", { ascending: false });
    setThreads((data as ChatThread[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("chat_messages").delete().eq("conversation_id", id);
    await supabase.from("chat_conversations").delete().eq("id", id);
    setThreads((t) => t.filter((x) => x.id !== id));
  }, []);

  const rename = useCallback(async (id: string, title: string) => {
    await supabase.from("chat_conversations").update({ title }).eq("id", id);
    setThreads((t) => t.map((x) => x.id === id ? { ...x, title } : x));
  }, []);

  return { threads, loading, refresh, remove, rename };
};

export const loadThreadMessages = async (conversationId: string) => {
  const { data } = await supabase
    .from("chat_messages")
    .select("id,role,parts,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data || []).map((row: any) => ({
    id: row.id,
    role: row.role,
    parts: row.parts || [],
  }));
};