export async function runAgent(userId: string): Promise<string> {
  // Simple agent that returns a personalized message
  // In a real implementation, you'd use the agents package API
  // For now, return a simple response
  return `Hello! This is your personal agent (user: ${userId}).`;
}

