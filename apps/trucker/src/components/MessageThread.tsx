/**
 * MessageThread component for the LoadPilot trucker app.
 *
 * Renders messages for a single thread chronologically with
 * sender name and timestamp. Includes a text input and send button
 * for composing new messages.
 *
 * # Tests R-P3-05, R-P3-06
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { fetchThreadMessages, sendMessage } from "../services/messaging";
import type { Message } from "../types/message";

interface MessageThreadProps {
  threadId: string;
  currentUserId: string;
}

export default function MessageThread({
  threadId,
  currentUserId,
}: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchThreadMessages(threadId);
        if (!cancelled) {
          setMessages(data);
        }
      } catch {
        // Silently handle fetch errors
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const newMessage = await sendMessage(threadId, currentUserId, trimmed);
      setMessages((prev) => [...prev, newMessage]);
      setText("");
    } catch {
      // Silently handle send errors
    } finally {
      setSending(false);
    }
  }, [text, sending, threadId, currentUserId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.message}>
            <Text style={styles.sender}>{item.sender_name}</Text>
            <Text style={styles.text}>{item.text}</Text>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text>No messages yet</Text>
          </View>
        }
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
        />
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  message: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  sender: { fontSize: 14, fontWeight: "bold", marginBottom: 2 },
  text: { fontSize: 16, marginBottom: 4 },
  timestamp: { fontSize: 12, color: "#888" },
  inputRow: {
    flexDirection: "row",
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendText: { color: "#fff", fontWeight: "bold" },
});
