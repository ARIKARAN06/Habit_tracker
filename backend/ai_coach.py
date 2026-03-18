import os
from groq import Groq
from dotenv import load_dotenv

# Load .env so the key is available
load_dotenv()

def get_chat_response(messages: list[dict], completed_tasks: list[str], missed_tasks: list[str]) -> str:
    """
    Conversational AI Habit Coach chatbot powered by Groq.
    Accepts a full message history for multi-turn conversation.
    """
    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

    system_prompt = f"""You are an expert AI Habit Coach chatbot. You help users build consistent daily habits.
You have access to the user's current habit data:

Completed Habits Today: {', '.join(completed_tasks) if completed_tasks else 'None'}
Missed Habits Today: {', '.join(missed_tasks) if missed_tasks else 'None'}

Use this data to provide personalized advice. Be encouraging, concise, and actionable.
If the user asks general questions, answer helpfully while tying it back to their habit journey.
Use a friendly, motivating tone. Keep responses to 2-4 sentences unless the user asks for detail.
Add relevant emojis sparingly to keep the tone upbeat."""

    full_messages = [{"role": "system", "content": system_prompt}] + messages

    try:
        chat_completion = client.chat.completions.create(
            messages=full_messages,
            model="llama-3.3-70b-versatile",
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        return f"Sorry, I'm having trouble connecting right now. Keep pushing forward! (Error: {str(e)})"
