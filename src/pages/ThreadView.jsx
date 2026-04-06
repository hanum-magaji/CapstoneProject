import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ProjectSidebar from "../components/ProjectSidebar"; // adjust path
import "./ThreadView.css";

const DEFAULT_AVATAR = "/default_avatar.png";

export default function ThreadView() {
  const { id: projectId, threadId } = useParams();
  const [messages, setMessages] = useState([]);
  const [threadTitle, setThreadTitle] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id || null);
    });
  }, []);

  async function loadThread() {
    const { data } = await supabase
      .from("project_threads")
      .select("title")
      .eq("id", threadId)
      .single();
    if (data) setThreadTitle(data.title);
  }

  async function loadMessages() {
    const { data: msgRows } = await supabase
      .from("project_messages")
      .select("id, message, user_id, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (!msgRows) return;

    const userIds = [...new Set(msgRows.map((m) => m.user_id))];

    const { data: userRows } = await supabase
      .from("users")
      .select("id, email, avatar_url, first_name, last_name")
      .in("id", userIds);

    const merged = msgRows.map((m) => {
      const u = userRows.find((x) => x.id === m.user_id);
      return {
        ...m,
        user: {
          email: u?.email,
          avatar_url: u?.avatar_url || DEFAULT_AVATAR,
          name:
            u?.first_name || u?.last_name
              ? `${u?.first_name || ""} ${u?.last_name || ""}`.trim()
              : u?.email,
        },
      };
    });

    setMessages(merged);
    scrollToBottom();
  }

  function scrollToBottom() {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }

  async function sendMessage() {
    if (!newMsg.trim()) return;

    await supabase.from("project_messages").insert([
      {
        thread_id: threadId,
        user_id: currentUserId,
        message: newMsg.trim(),
      },
    ]);

    setNewMsg("");
  }

  // Auto-scroll to bottom when messages change
useEffect(() => {
  if (scrollRef.current) {
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }
}, [messages]);


  useEffect(() => {
    loadThread();
    loadMessages();

    const channel = supabase
      .channel(`thread-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "project_messages" },
        () => loadMessages()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [threadId]);

  return (
    <div className="thread-page-container">
      <ProjectSidebar projectId={projectId} />

      <div className="thread-chat-container">
        <h1 className="thread-title">{threadTitle}</h1>

        <div className="thread-messages-full" ref={scrollRef}>
          {messages.map((m) => (
            <div
              key={m.id}
              className={`msg-row ${
                m.user_id === currentUserId ? "my-msg" : "their-msg"
              }`}
            >
              <img
                className="msg-avatar"
                src={m.user.avatar_url}
                alt="avatar"
              />
              <div className="msg-bubble">
                <div className="msg-user">{m.user.name}</div>
                <div className="msg-text">{m.message}</div>
                <div className="msg-time">
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="thread-input-full">
          <input
            type="text"
            placeholder="Write a message..."
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button className="primary-button" onClick={sendMessage}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
