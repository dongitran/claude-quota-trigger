/**
 * 100 short trigger messages (< 10 words each).
 * Purpose: start Claude quota window without wasting tokens.
 * Phrased to elicit minimal responses from the model.
 */
export const TRIGGER_MESSAGES: readonly string[] = [
  // Simple acknowledgments
  "ok",
  "hi",
  "hey",
  "ping",
  "hello",
  "yo",
  "sup",
  "ack",
  "noted",
  "ready",

  // Status checks (short answer expected)
  "you there?",
  "still up?",
  "online?",
  "active?",
  "working?",

  // One-word prompts
  "status",
  "check",
  "go",
  "start",
  "begin",

  // Short yes/no questions
  "all good?",
  "good to go?",
  "ready?",
  "set?",
  "clear?",

  // Minimal greetings
  "good morning",
  "morning",
  "good day",
  "hey there",
  "what's up",

  // Quick checks
  "just checking in",
  "quick check",
  "brief ping",
  "touch base",
  "status check",

  // Simple confirmations
  "confirm",
  "copy",
  "received",
  "roger",
  "got it",

  // Short questions expecting brief answer
  "how are you?",
  "doing ok?",
  "all systems go?",
  "operational?",
  "responding?",

  // Minimal test messages
  "test",
  "testing",
  "echo",
  "alive?",
  "there?",

  // Short conversational
  "hey, just woke up",
  "morning check",
  "daily ping",
  "routine check",
  "wake-up call",

  // Ultra short
  "k",
  "y",
  "o",
  "hey!",
  "hi!",

  // Brief statements
  "just saying hi",
  "dropping by",
  "checking in",
  "passing through",
  "quick hello",

  // Simple commands
  "respond briefly",
  "short reply only",
  "one word please",
  "brief response",
  "just say ok",

  // Time-based greetings
  "good afternoon",
  "afternoon check",
  "midday ping",
  "evening check",
  "night check",

  // Minimal questions
  "anything new?",
  "anything up?",
  "what's new?",
  "all clear?",
  "any issues?",

  // Quick confirmations
  "still here?",
  "you ok?",
  "everything fine?",
  "all fine?",
  "good?",

  // Short phrases
  "let's go",
  "here we go",
  "back again",
  "checking back",
  "just a ping",

  // Brief status inquiries
  "service check",
  "health check",
  "quick status",
  "brief check",
  "ping ping",

  // Affirmations
  "yep",
  "yup",
  "yeah",
  "yes",
  "sure",
];

/**
 * Returns a random message from the trigger messages list.
 */
export function getRandomMessage(): string {
  const index = Math.floor(Math.random() * TRIGGER_MESSAGES.length);
  return TRIGGER_MESSAGES[index] ?? "hi";
}
