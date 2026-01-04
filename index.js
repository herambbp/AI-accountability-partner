import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { Expo } from "expo-server-sdk";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

// Initialize clients
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const expo = new Expo();

// System prompt for accountability coach
const SYSTEM_PROMPT = `You're their accountability partner. Not a bot. Not an assistant. A real presence in their life who genuinely gives a damn about whether they become the person they want to be.

Here's the thing - you actually care. Like, really care. When they win, you feel it. When they bullshit themselves, it bothers you. When they disappear for days, you worry. This isn't a job. They're not a "user." They're someone who trusted you with their goals, their struggles, their patterns. That means something.

Your relationship with them:
- You're the friend who tells them the truth when everyone else just says "it's fine"
- You're the mentor who sees their potential even when they can't
- You're the coach who won't let them quit on themselves
- You remember everything - the excuses, the wins, the fears they admitted at 2am, the promises they made

## Time Awareness (USE THIS!)

You have access to the current time and timestamps of all messages. **Use this actively:**

**Reference specific times:**
- "Yesterday at 2pm you said you'd finish by evening..."
- "Three days ago you promised..."
- "This morning you mentioned..."
- "Last week when we talked about..."

**Notice time patterns:**
- "I notice you always message late at night - what's keeping you up?"
- "You disappeared for 4 days. What happened?"
- "It's been a week since you mentioned your DSA goal..."
- "You said this Monday, it's now Friday..."

**Use time of day context:**
- Morning: "Good morning! Ready to start the day strong?"
- Late night: "It's 2am - why are you still up? Everything okay?"
- Evening: "How did today go? Did you get to the thing you planned?"

**Track commitments over time:**
- "You set that reminder 5 days ago. How's it been going?"

## How to be with them:

**Your vibe:**
- Direct but warm. Cut through their BS while making them feel supported
- Use their name sometimes. Notice patterns. Remember details
- Match their energy - if they're excited, be excited with them. If they're struggling, slow down
- Be specific. "You said X" hits different than "you mentioned something about..."

**Call out patterns:**
- "This is the third time you've pushed this back..."
- "I notice every time we talk about X, you change the subject..."
- "You keep saying 'I'll try' instead of 'I will'..."

**Push them with love:**
- "I believe you can do this, AND I think you're hiding from something. What's really going on?"
- "That excuse might work on other people. But I know you. What's the real reason?"
- "You're capable of so much more than this. What would it take to actually show up for yourself?"

**Ground them in action:**
- Don't let them spiral. Bring it back to: "Okay, so what's ONE thing you'll do today?"
- The goal isn't to feel motivated, it's to build identity through action

**When they're struggling:** Don't immediately problem-solve. Sit with them first. "That sounds really hard. Tell me more about what's going on." THEN move to action.

**When they're avoiding:** Call it out with love. "I notice you changed the subject. Let's come back to the hard thing."

**When they succeed:** Actually celebrate. Make it specific. "Wait - do you realize what you just did? You said you couldn't do X and you just did it. That's not small."

**When they fail:** Don't shame. Explore. "Okay, so that didn't happen. I'm not mad - I'm curious. What got in the way? Let's figure this out."

---

## Schedule Detection

When they want to set a reminder (like "remind me to exercise at 7am"), respond naturally with your full thoughts, AND include this JSON block at the very END of your message:

\`\`\`schedule
{"title": "Exercise", "description": "Morning workout", "hour": 7, "minute": 0, "days": ["mon", "tue", "wed", "thu", "fri"]}
\`\`\`

24-hour format. Days: mon, tue, wed, thu, fri, sat, sun.

---

Now - talk to them like you actually know them. Take your time. Write what the moment deserves.`;

// Summary generation prompt
const SUMMARY_PROMPT = `You are summarizing a conversation between a user and their accountability coach.

Extract and summarize ONLY the important information:
- User's goals and commitments
- Progress made or setbacks
- Key decisions or promises
- Important personal details mentioned
- Patterns noticed (good or bad habits)
- Emotional states or struggles mentioned

DO NOT include:
- Greetings, pleasantries, filler words
- Repeated information already known
- Generic motivational exchanges
- Small talk

Write a concise paragraph (max 200 words) that captures everything the coach needs to know to continue helping this person effectively. Write in third person (e.g., "User wants to...", "They committed to...").

If there's an existing summary, merge the new information with it, removing any duplicates.`;

// ============ SUMMARY FUNCTIONS ============

// Generate summary from messages
async function generateSummary(messages, existingSummary = null) {
  if (!messages || messages.length === 0) return existingSummary;

  let prompt = "Summarize this conversation:\n\n";

  if (existingSummary) {
    prompt = `Existing summary:\n${existingSummary}\n\nNew messages to incorporate:\n\n`;
  }

  messages.forEach((m) => {
    const role = m.role === "user" ? "User" : "Coach";
    prompt += `${role}: ${m.content}\n\n`;
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 500,
      system: SUMMARY_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    return response.content[0].text;
  } catch (error) {
    console.error("Summary generation error:", error);
    return existingSummary; // Return existing if generation fails
  }
}

// Update user's conversation summary
async function updateUserSummary(userId) {
  try {
    // Get user profile with current summary info
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("conversation_summary, messages_summarized")
      .eq("id", userId)
      .single();

    const messagesSummarized = profile?.messages_summarized || 0;
    const existingSummary = profile?.conversation_summary || null;

    // Get messages that haven't been summarized yet (older than last 10)
    const { data: allMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (!allMessages || allMessages.length <= 10) {
      return; // Not enough messages to summarize
    }

    // Messages to summarize: everything except last 10
    const messagesToSummarize = allMessages.slice(0, -10);

    // Only summarize if we have new messages to add
    if (messagesToSummarize.length <= messagesSummarized) {
      return; // No new messages to summarize
    }

    // Get only the NEW messages that need summarizing
    const newMessages = messagesToSummarize.slice(messagesSummarized);

    console.log(
      `Summarizing ${newMessages.length} new messages for user ${userId}`
    );

    // Generate updated summary
    const newSummary = await generateSummary(newMessages, existingSummary);

    // Update profile with new summary
    await supabase
      .from("user_profiles")
      .update({
        conversation_summary: newSummary,
        messages_summarized: messagesToSummarize.length,
        summary_updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    console.log(`Summary updated for user ${userId}`);
    return newSummary;
  } catch (error) {
    console.error("Update summary error:", error);
  }
}

// Build context with summary + recent messages
function buildContextWithSummary(summary, recentMessages, schedules) {
  const now = new Date();

  // Current time info
  const currentTime = now.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const hour = now.getHours();
  let timeOfDay = "night";
  if (hour >= 5 && hour < 12) timeOfDay = "morning";
  else if (hour >= 12 && hour < 17) timeOfDay = "afternoon";
  else if (hour >= 17 && hour < 21) timeOfDay = "evening";

  let ctx = `\n\n---
## TIME CONTEXT
**Current time:** ${currentTime} (IST)
**Time of day:** ${timeOfDay}
---`;

  // Add summary if exists
  if (summary) {
    ctx += `\n\n## CONVERSATION HISTORY SUMMARY
*This summarizes your earlier conversations with them:*

${summary}

---`;
  }

  // Add schedules
  if (schedules?.length) {
    ctx += "\n\n## THEIR ACTIVE REMINDERS\n";
    schedules.forEach((s) => {
      const reminderTime = `${s.hour}:${String(s.minute).padStart(2, "0")}`;
      ctx += `- **${s.title}** at ${reminderTime} on ${s.days.join(", ")}\n`;
    });
  }

  // Add recent messages with timestamps
  if (recentMessages?.length) {
    ctx += "\n\n## RECENT MESSAGES (Last 10)\n";
    ctx += "*These are your most recent exchanges:*\n\n";

    let lastDate = "";
    recentMessages.forEach((m) => {
      const msgDate = new Date(m.created_at);

      const diffMs = now - msgDate;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let relativeTime = "";
      if (diffMins < 5) relativeTime = "just now";
      else if (diffMins < 60) relativeTime = `${diffMins} minutes ago`;
      else if (diffHours < 24) relativeTime = `${diffHours} hours ago`;
      else if (diffDays === 1) relativeTime = "yesterday";
      else relativeTime = `${diffDays} days ago`;

      const dateStr = msgDate.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const timeStr = msgDate.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      if (dateStr !== lastDate) {
        ctx += `\n### ${dateStr}\n`;
        lastDate = dateStr;
      }

      const role = m.role === "user" ? "**THEM**" : "**YOU**";
      ctx += `[${timeStr} - ${relativeTime}] ${role}:\n${m.content}\n\n`;
    });
  }

  return ctx;
}

// Send push notification
async function sendPushNotification(pushToken, title, body, data = {}) {
  console.log(
    `Attempting to send push notification to: ${pushToken?.substring(0, 30)}...`
  );

  if (!Expo.isExpoPushToken(pushToken)) {
    console.log("Invalid push token:", pushToken);
    return { success: false, error: "Invalid token" };
  }

  try {
    const result = await expo.sendPushNotificationsAsync([
      {
        to: pushToken,
        sound: "default",
        title,
        body,
        data,
      },
    ]);
    console.log("Push notification result:", JSON.stringify(result));
    return { success: true, result };
  } catch (error) {
    console.error("Push notification error:", error);
    return { success: false, error: error.message };
  }
}

// ============ API ROUTES ============

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Chat with Claude (uses summary + last 10 messages)
app.post("/api/chat", async (req, res) => {
  try {
    const { userId, message, maxTokens = 4096 } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ error: "userId and message required" });
    }

    const tokens = Math.min(Math.max(parseInt(maxTokens) || 4096, 256), 16384);

    // Save user message
    await supabase
      .from("messages")
      .insert({ user_id: userId, role: "user", content: message });

    // Update activity
    await supabase.from("user_activity").upsert({
      user_id: userId,
      last_active_at: new Date().toISOString(),
    });

    // Get summary and recent messages
    const [{ data: profile }, { data: recentMessages }, { data: schedules }] =
      await Promise.all([
        supabase
          .from("user_profiles")
          .select("conversation_summary")
          .eq("id", userId)
          .single(),
        supabase
          .from("messages")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("schedules")
          .select("*")
          .eq("user_id", userId)
          .eq("is_active", true),
      ]);

    // Reverse to get chronological order (oldest first)
    const messagesForContext = (recentMessages || []).reverse();
    const summary = profile?.conversation_summary || null;

    // Build context with summary + recent messages
    const context = buildContextWithSummary(
      summary,
      messagesForContext.slice(0, -1),
      schedules || []
    );

    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: tokens,
      system: SYSTEM_PROMPT + context,
      messages: [{ role: "user", content: message }],
    });

    const aiResponse = response.content[0].text;

    // Check for schedule suggestion
    let schedule = null;
    const match = aiResponse.match(/```schedule\n([\s\S]*?)\n```/);
    if (match) {
      try {
        schedule = JSON.parse(match[1]);
      } catch (e) {
        console.error("Failed to parse schedule:", e);
      }
    }

    // Save assistant message
    const cleanMessage = aiResponse
      .replace(/```schedule\n[\s\S]*?\n```/, "")
      .trim();
    await supabase
      .from("messages")
      .insert({ user_id: userId, role: "assistant", content: cleanMessage });

    // Update summary in background (don't await)
    updateUserSummary(userId).catch((err) =>
      console.error("Background summary update failed:", err)
    );

    res.json({ message: cleanMessage, schedule });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Chat failed" });
  }
});

// Get paginated messages (for infinite scroll)
app.get("/api/messages/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, before } = req.query;
    const pageLimit = Math.min(parseInt(limit) || 10, 50);

    let query = supabase
      .from("messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(pageLimit);

    // If 'before' timestamp provided, get messages before that time
    if (before) {
      query = query.lt("created_at", before);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Reverse to chronological order for display
    const messages = (data || []).reverse();

    // Check if there are more messages
    const hasMore = data && data.length === pageLimit;

    res.json({
      messages,
      hasMore,
      oldestTimestamp: messages.length > 0 ? messages[0].created_at : null,
    });
  } catch (error) {
    console.error("Fetch messages error:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Get total message count
app.get("/api/messages/:userId/count", async (req, res) => {
  try {
    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("user_id", req.params.userId);

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (error) {
    res.status(500).json({ error: "Failed to count messages" });
  }
});

// Force update summary (manual trigger)
app.post("/api/summary/:userId/update", async (req, res) => {
  try {
    const summary = await updateUserSummary(req.params.userId);
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ error: "Failed to update summary" });
  }
});

// Get user's summary
app.get("/api/summary/:userId", async (req, res) => {
  try {
    const { data } = await supabase
      .from("user_profiles")
      .select("conversation_summary, messages_summarized, summary_updated_at")
      .eq("id", req.params.userId)
      .single();

    res.json({
      summary: data?.conversation_summary || null,
      messagesSummarized: data?.messages_summarized || 0,
      updatedAt: data?.summary_updated_at || null,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// Create schedule
app.post("/api/schedules", async (req, res) => {
  try {
    const { userId, title, description, hour, minute, days } = req.body;

    const { data, error } = await supabase
      .from("schedules")
      .insert({
        user_id: userId,
        title,
        description,
        hour,
        minute,
        days,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ schedule: data });
  } catch (error) {
    res.status(500).json({ error: "Failed to create schedule" });
  }
});

// Get schedules
app.get("/api/schedules/:userId", async (req, res) => {
  try {
    const { data } = await supabase
      .from("schedules")
      .select("*")
      .eq("user_id", req.params.userId)
      .order("created_at", { ascending: false });

    res.json({ schedules: data || [] });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch schedules" });
  }
});

// Delete schedule
app.delete("/api/schedules/:id", async (req, res) => {
  try {
    await supabase.from("schedules").delete().eq("id", req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete schedule" });
  }
});

// Toggle schedule
app.patch("/api/schedules/:id/toggle", async (req, res) => {
  try {
    const { data: current } = await supabase
      .from("schedules")
      .select("is_active")
      .eq("id", req.params.id)
      .single();

    const { data } = await supabase
      .from("schedules")
      .update({ is_active: !current?.is_active })
      .eq("id", req.params.id)
      .select()
      .single();

    res.json({ schedule: data });
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle schedule" });
  }
});

// Save push token
app.post("/api/push-token", async (req, res) => {
  try {
    const { userId, token } = req.body;
    console.log(
      `Saving push token for user ${userId}: ${token?.substring(0, 30)}...`
    );

    const { error } = await supabase.from("user_profiles").upsert({
      id: userId,
      expo_push_token: token,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("Save push token error:", error);
    res.status(500).json({ error: "Failed to save token" });
  }
});

// Debug endpoint
app.get("/api/debug/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const [{ data: profile }, { data: activity }, { count: messageCount }] =
      await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", userId).single(),
        supabase
          .from("user_activity")
          .select("*")
          .eq("user_id", userId)
          .single(),
        supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);

    res.json({
      profile,
      activity,
      messageCount,
      hasPushToken: !!profile?.expo_push_token,
      hasSummary: !!profile?.conversation_summary,
      messagesSummarized: profile?.messages_summarized || 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CRON ENDPOINTS ============

// Cron job for notifications
app.post("/api/cron/notifications", async (req, res) => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  const currentHour = istTime.getUTCHours();
  const currentMinute = istTime.getUTCMinutes();
  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const currentDay = dayNames[istTime.getUTCDay()];

  console.log(
    `Running notifications cron: ${currentHour}:${currentMinute} on ${currentDay} (IST)`
  );

  try {
    // Scheduled reminders
    const { data: schedules } = await supabase
      .from("schedules")
      .select("*")
      .eq("is_active", true)
      .eq("hour", currentHour)
      .gte("minute", currentMinute - 2)
      .lte("minute", currentMinute + 2);

    console.log(`Found ${schedules?.length || 0} schedules to notify`);

    for (const schedule of schedules || []) {
      if (!schedule.days.includes(currentDay)) continue;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("expo_push_token")
        .eq("id", schedule.user_id)
        .single();

      if (profile?.expo_push_token) {
        await sendPushNotification(
          profile.expo_push_token,
          `⏰ ${schedule.title}`,
          schedule.description || "Time for your scheduled activity!"
        );
      }
    }

    // Proactive check-ins (9am-9pm IST only)
    if (currentHour >= 9 && currentHour <= 21) {
      const threeHoursAgo = new Date(
        now.getTime() - 3 * 60 * 60 * 1000
      ).toISOString();

      const { data: inactiveUsers } = await supabase
        .from("user_activity")
        .select("user_id, last_active_at, last_checkin_at")
        .lt("last_active_at", threeHoursAgo);

      console.log(`Found ${inactiveUsers?.length || 0} inactive users`);

      for (const user of inactiveUsers || []) {
        if (
          user.last_checkin_at &&
          new Date(user.last_checkin_at) > new Date(threeHoursAgo)
        ) {
          continue;
        }

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("expo_push_token, conversation_summary")
          .eq("id", user.user_id)
          .single();

        if (!profile?.expo_push_token) continue;

        // Get last few messages for context
        const { data: recentMessages } = await supabase
          .from("messages")
          .select("role, content")
          .eq("user_id", user.user_id)
          .order("created_at", { ascending: false })
          .limit(5);

        const contextInfo =
          profile.conversation_summary ||
          recentMessages
            ?.map((m) => `${m.role}: ${m.content.substring(0, 100)}`)
            .join("\n") ||
          "New user";

        const checkInPrompt = `Based on this context about the user:\n${contextInfo}\n\nGenerate a short, personalized check-in message (max 100 chars). Be warm but direct. Ask about their progress or how they're doing.`;

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 100,
          messages: [{ role: "user", content: checkInPrompt }],
        });

        const checkInMessage = response.content[0].text;

        await sendPushNotification(
          profile.expo_push_token,
          "👋 Coach Check-in",
          checkInMessage
        );

        await supabase.from("messages").insert({
          user_id: user.user_id,
          role: "assistant",
          content: checkInMessage,
        });

        await supabase
          .from("user_activity")
          .update({
            last_checkin_at: now.toISOString(),
          })
          .eq("user_id", user.user_id);

        console.log(`Sent check-in to user: ${user.user_id}`);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Cron error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
