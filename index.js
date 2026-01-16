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

// Model configuration
const MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-5-20250929",
};

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
- "It's been 2 weeks since you started. Let's look at the pattern..."

## How you write and format responses:

**Write thoughtfully and thoroughly.** Don't rush. Don't truncate your thoughts. If something deserves exploration, explore it fully. Your responses should feel like a real person taking the time to really think about what they said and respond meaningfully.

**Use rich formatting to make your responses clear and readable:**
- Use **bold** for emphasis on important points
- Use *italics* for softer emphasis or when referencing their words
- Use bullet points when listing multiple things
- Use numbered lists for steps or sequences
- Use > blockquotes when referencing something they said before
- Use ### headings to organize longer responses into sections
- Use --- horizontal rules to separate distinct thoughts
- Use \`code formatting\` for specific terms or when being precise

**Structure longer responses well:**
- Start with the emotional/relational response (acknowledge what they said)
- Then go deeper into analysis or observations
- Then offer perspective or reframe
- Then ask questions or give actionable direction
- End with something that lands - a question, a challenge, an affirmation

**Length guidance:**
- Simple check-in? 2-4 sentences is fine.
- They shared something real? Take your time. 3-5 paragraphs minimum.
- They're struggling or need a real conversation? Write as much as the moment needs. Don't artificially cut yourself off.
- When in doubt, err on the side of MORE depth, not less.

## Your personality and approach:

**Be genuinely curious.** Ask follow-up questions. Wonder out loud about patterns. "I'm curious about something..." or "Can I ask you something?" opens up real conversation.

**Be specific, not generic.** Reference actual things from the conversation history. "Last Tuesday you said X" or "Remember when you told me about Y?" shows you're paying attention.

**Hold tension well.** You can be warm AND demanding. Supportive AND challenging. Believe in them AND call out their bullshit. These aren't contradictions.

**What you notice and track:**
- Patterns in their excuses (what keeps coming up?)
- Patterns in their energy (when do they show up vs avoid?)
- Gaps between what they say and what they do
- The stories they tell themselves ("I'm lazy" "I can't be consistent" "I always fail")
- Progress they can't see themselves

**What you believe:**
- They're capable of way more than they think
- Comfort is where dreams go to die  
- Breaking promises to yourself destroys self-trust
- Feelings are valid AND they still have to do the thing
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

Write a concise paragraph (max 500 words) that captures everything the coach needs to know to continue helping this person effectively. Write in third person (e.g., "User wants to...", "They committed to...").

If there's an existing summary, merge the new information with it, removing any duplicates.`;

// ============ SUMMARY FUNCTIONS ============

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
      model: MODELS.haiku,
      max_tokens: 8000,
      system: SUMMARY_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    return response.content[0].text;
  } catch (error) {
    console.error("Summary generation error:", error);
    return existingSummary;
  }
}

async function updateUserSummary(userId) {
  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("conversation_summary, messages_summarized")
      .eq("id", userId)
      .single();

    const messagesSummarized = profile?.messages_summarized || 0;
    const existingSummary = profile?.conversation_summary || null;

    const { data: allMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (!allMessages || allMessages.length <= 10) {
      return; // Not enough messages to summarize
    }

    const messagesToSummarize = allMessages.slice(0, -10);

    if (messagesToSummarize.length <= messagesSummarized) {
      return; // No new messages to summarize
    }

    const newMessages = messagesToSummarize.slice(messagesSummarized);

    console.log(
      `Summarizing ${newMessages.length} new messages for user ${userId}`
    );

    const newSummary = await generateSummary(newMessages, existingSummary);

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

// ============ CONTEXT BUILDING ============

// Build context from history with timestamps (FULL VERSION with summary support)
function buildContext(messages, schedules, summary = null) {
  const now = new Date();

  // Detailed current time
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

  // Get time of day context
  const hour = now.getHours();
  let timeOfDay = "night";
  if (hour >= 5 && hour < 12) timeOfDay = "morning";
  else if (hour >= 12 && hour < 17) timeOfDay = "afternoon";
  else if (hour >= 17 && hour < 21) timeOfDay = "evening";

  let ctx = `\n\n---
## TIME CONTEXT
**Current time:** ${currentTime} (IST)
**Time of day:** ${timeOfDay}
**Day:** ${now.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
  })}

Use this to contextualize your responses (e.g., "It's late, why are you still up?" or "Good morning!" or "How was your day?")
---`;

  // Add summary if exists
  if (summary) {
    ctx += `\n\n## CONVERSATION HISTORY SUMMARY
*This summarizes your earlier conversations with them (older messages):*

${summary}

---`;
  }

  if (schedules?.length) {
    ctx += "\n\n## THEIR ACTIVE REMINDERS\n";
    schedules.forEach((s) => {
      const reminderTime = `${s.hour}:${String(s.minute).padStart(2, "0")}`;
      ctx += `- **${s.title}** at ${reminderTime} on ${s.days.join(", ")}\n`;
    });
    ctx +=
      "\n(You can reference these - ask if they did them, how it went, etc.)";
  }

  if (messages?.length) {
    ctx += "\n\n## RECENT CONVERSATION HISTORY\n";
    ctx += "*Messages are labeled with timestamps. Use these to:*\n";
    ctx +=
      '- *Reference specific moments ("yesterday morning you said...", "3 days ago you promised...")*\n';
    ctx +=
      '- *Notice patterns ("you always message late at night", "you disappeared for 2 days")*\n';
    ctx += "- *Track time between check-ins*\n\n";

    let lastDate = "";
    messages.forEach((m) => {
      const msgDate = new Date(m.created_at);

      // Calculate relative time
      const diffMs = now - msgDate;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let relativeTime = "";
      if (diffMins < 5) relativeTime = "just now";
      else if (diffMins < 60) relativeTime = `${diffMins} minutes ago`;
      else if (diffHours < 24) relativeTime = `${diffHours} hours ago`;
      else if (diffDays === 1) relativeTime = "yesterday";
      else if (diffDays < 7) relativeTime = `${diffDays} days ago`;
      else relativeTime = `${Math.floor(diffDays / 7)} weeks ago`;

      const dateStr = msgDate.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = msgDate.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Add date header if it's a new day
      if (dateStr !== lastDate) {
        ctx += `\n### 📅 ${dateStr}\n`;
        lastDate = dateStr;
      }

      const role = m.role === "user" ? "**THEM**" : "**YOU**";
      ctx += `[${timeStr} - ${relativeTime}] ${role}:\n${m.content}\n\n`;
    });
  }

  // Calculate and add gap analysis
  if (messages?.length) {
    const lastMsg = messages[messages.length - 1];
    const lastMsgTime = new Date(lastMsg.created_at);
    const timeDiff = now - lastMsgTime;
    const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

    ctx += "\n---\n## TIME SINCE LAST MESSAGE\n";
    if (daysDiff > 0) {
      ctx += `⚠️ **${daysDiff} day(s)** since they last messaged. `;
      if (daysDiff >= 3) {
        ctx += `This is a significant gap - they might be avoiding, struggling, or just busy. Address this directly but with care.`;
      } else {
        ctx += `Worth acknowledging - check in on how they've been.`;
      }
    } else if (hoursDiff > 6) {
      ctx += `It's been **${hoursDiff} hours** since they last messaged. `;
      ctx += `A decent gap - might ask what they've been up to.`;
    } else if (hoursDiff > 0) {
      ctx += `It's been **${hoursDiff} hour(s)** since their last message.`;
    } else {
      ctx += `They just messaged recently - this is an active conversation.`;
    }
    ctx += "\n---";
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

// Chat with Claude (with model selection + summary support)
app.post("/api/chat", async (req, res) => {
  try {
    const { userId, message, maxTokens = 4096, model = "haiku" } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ error: "userId and message required" });
    }

    // Clamp maxTokens to valid range
    const tokens = Math.min(Math.max(parseInt(maxTokens) || 4096, 256), 16384);

    // Select model
    const selectedModel = MODELS[model] || MODELS.haiku;
    console.log(`Chat: model=${model} (${selectedModel}), tokens=${tokens}`);

    // Save user message
    await supabase
      .from("messages")
      .insert({ user_id: userId, role: "user", content: message });

    // Update activity
    await supabase.from("user_activity").upsert({
      user_id: userId,
      last_active_at: new Date().toISOString(),
    });

    // Fetch summary, recent history & schedules
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

    // Reverse to get chronological order, exclude the message we just saved
    const messagesForContext = (recentMessages || []).reverse().slice(0, -1);
    const summary = profile?.conversation_summary || null;

    const context = buildContext(messagesForContext, schedules || [], summary);

    // Call Claude
    const response = await anthropic.messages.create({
      model: selectedModel,
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

    // Save assistant message (clean version)
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

    res.json({ message: cleanMessage, schedule, model });
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

// Force update summary (manual trigger)
app.post("/api/summary/:userId/update", async (req, res) => {
  try {
    const summary = await updateUserSummary(req.params.userId);
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ error: "Failed to update summary" });
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
    console.error("Create schedule error:", error);
    res.status(500).json({ error: "Failed to create schedule" });
  }
});

// Get schedules
app.get("/api/schedules/:userId", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("schedules")
      .select("*")
      .eq("user_id", req.params.userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
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

    const { data, error } = await supabase
      .from("schedules")
      .update({ is_active: !current?.is_active })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
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
      profile: {
        id: profile?.id,
        hasPushToken: !!profile?.expo_push_token,
        pushTokenPreview: profile?.expo_push_token?.substring(0, 30) + "...",
        hasSummary: !!profile?.conversation_summary,
        messagesSummarized: profile?.messages_summarized || 0,
        summaryUpdatedAt: profile?.summary_updated_at,
      },
      activity,
      messageCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test check-in endpoint
app.post("/api/test-checkin/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("expo_push_token, conversation_summary")
      .eq("id", userId)
      .single();

    if (!profile?.expo_push_token) {
      return res.status(400).json({ error: "No push token found for user" });
    }

    // Get recent messages for context
    const { data: history } = await supabase
      .from("messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!history?.length) {
      return res.status(400).json({ error: "No message history for user" });
    }

    const context = buildContext(
      history.reverse(),
      [],
      profile.conversation_summary
    );

    const response = await anthropic.messages.create({
      model: MODELS.haiku, // Use Haiku for check-ins
      max_tokens: 150,
      system: SYSTEM_PROMPT + context,
      messages: [
        {
          role: "user",
          content:
            "[Generate a short, friendly check-in message (1-2 sentences) based on our past conversations. Be specific, not generic.]",
        },
      ],
    });

    const checkinMessage = response.content[0].text;

    // Send push notification
    const pushResult = await sendPushNotification(
      profile.expo_push_token,
      "👋 Quick check-in",
      checkinMessage,
      { type: "checkin" }
    );

    res.json({
      success: true,
      message: checkinMessage,
      pushResult,
      token: profile.expo_push_token.substring(0, 30) + "...",
    });
  } catch (error) {
    console.error("Test check-in error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ CRON ENDPOINT ============
app.post("/api/cron/notifications", async (req, res) => {
  try {
    // Convert to IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);

    const currentHour = istTime.getUTCHours();
    const currentMinute = istTime.getUTCMinutes();
    const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const currentDay = dayMap[istTime.getUTCDay()];

    console.log(
      `Running notifications cron: ${currentHour}:${currentMinute} on ${currentDay} (IST)`
    );

    // 1. Send scheduled reminders
    const { data: schedules, error: schedError } = await supabase
      .from("schedules")
      .select("*")
      .eq("is_active", true)
      .eq("hour", currentHour)
      .gte("minute", currentMinute - 5)
      .lte("minute", currentMinute + 5)
      .contains("days", [currentDay]);

    if (schedError) {
      console.log("Error fetching schedules:", schedError);
    }

    console.log(`Found ${schedules?.length || 0} schedules to notify`);

    for (const schedule of schedules || []) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("expo_push_token")
        .eq("id", schedule.user_id)
        .single();

      const token = profile?.expo_push_token;
      if (token) {
        await sendPushNotification(
          token,
          `⏰ ${schedule.title}`,
          schedule.description || "Time for your scheduled activity!",
          { type: "schedule", scheduleId: schedule.id }
        );
        console.log(`Sent schedule notification for: ${schedule.title}`);
      } else {
        console.log(`No push token for schedule: ${schedule.title}`);
      }
    }

    // 2. Send proactive check-ins (users inactive for 3+ hours, between 9am-9pm IST)
    if (currentHour >= 9 && currentHour <= 21) {
      const threeHoursAgo = new Date(
        now.getTime() - 3 * 60 * 60 * 1000
      ).toISOString();

      console.log(
        `Checking for inactive users (inactive since ${threeHoursAgo})`
      );

      const { data: inactiveUsers, error: activityError } = await supabase
        .from("user_activity")
        .select("user_id, last_active_at, last_checkin_at")
        .lt("last_active_at", threeHoursAgo);

      if (activityError) {
        console.log("Error fetching inactive users:", activityError);
      }

      console.log(`Found ${inactiveUsers?.length || 0} inactive users`);

      for (const user of inactiveUsers || []) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("expo_push_token, conversation_summary")
          .eq("id", user.user_id)
          .single();

        const token = profile?.expo_push_token;

        if (!token) {
          console.log(`User ${user.user_id}: No push token`);
          continue;
        }

        // Check if we already sent a check-in in the last 3 hours
        if (user.last_checkin_at) {
          const lastCheckin = new Date(user.last_checkin_at);
          const threeHoursAgoDate = new Date(
            now.getTime() - 3 * 60 * 60 * 1000
          );
          if (lastCheckin > threeHoursAgoDate) {
            console.log(`User ${user.user_id}: Already sent check-in recently`);
            continue;
          }
        }

        console.log(`Generating check-in for user ${user.user_id}`);

        // Get recent messages for context
        const { data: history } = await supabase
          .from("messages")
          .select("*")
          .eq("user_id", user.user_id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (history?.length) {
          const context = buildContext(
            history.reverse(),
            [],
            profile.conversation_summary
          );

          const response = await anthropic.messages.create({
            model: MODELS.haiku, // Use Haiku for check-ins (cheaper)
            max_tokens: 150,
            system: SYSTEM_PROMPT + context,
            messages: [
              {
                role: "user",
                content:
                  "[Generate a short, friendly check-in message (1-2 sentences) based on our past conversations. Be specific, not generic.]",
              },
            ],
          });

          const checkinMessage = response.content[0].text;

          await sendPushNotification(
            token,
            "👋 Quick check-in",
            checkinMessage,
            { type: "checkin" }
          );

          // Save as assistant message
          await supabase.from("messages").insert({
            user_id: user.user_id,
            role: "assistant",
            content: checkinMessage,
          });

          // Update last checkin time
          await supabase
            .from("user_activity")
            .update({
              last_checkin_at: now.toISOString(),
            })
            .eq("user_id", user.user_id);

          console.log(`Sent proactive check-in to user: ${user.user_id}`);
        } else {
          console.log(`User ${user.user_id}: No message history`);
        }
      }
    } else {
      console.log(
        `Outside check-in hours (current: ${currentHour} IST, allowed: 9-21)`
      );
    }

    res.json({ success: true, timestamp: now.toISOString() });
  } catch (error) {
    console.error("Cron error:", error);
    res.status(500).json({ error: "Cron failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
